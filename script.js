/* ==========================================================================
   3D MODEL CONFIGURATION (.GLB & .OBJ SUPPORT)
   ==========================================================================
   To use your own 3D file instead of the built-in procedural golden stilettos:
   1. Place your `.glb` or `.obj` (and optional `.mtl`) file in this folder.
   2. Set `MODEL_TYPE` to `'glb'` or `'obj'`.
   3. Update `MODEL_PATH` (and `MTL_PATH` if using an `.obj` with materials).
   4. Serve via a local server (e.g. VS Code Live Server or `npx serve`) so the
      browser can fetch the local 3D file. When opened directly via `file://` or
      if the file is missing, the procedural 3D golden stilettos render automatically.
   ========================================================================== */
const MODEL_TYPE = 'glb';        // Options: 'glb' or 'obj'
const MODEL_PATH = 'model.glb';  // Path to your custom .glb or .obj file
const MTL_PATH   = '';           // Optional: path to .mtl file when MODEL_TYPE === 'obj'

/* ==========================================================================
   01. UI INTERACTIONS (NAVIGATION, IMAGE FALLBACKS, PARALLAX)
   ========================================================================== */
(() => {
  const navbar = document.getElementById('navbar');
  const navToggle = document.getElementById('navToggle');
  const navLinks = document.getElementById('navLinks');
  const links = document.querySelectorAll('.nav-links a');
  const sections = document.querySelectorAll('section[id], footer[id]');

  // Fallback handler for home.png
  const yorImage = document.getElementById('yorImage');
  const charFallback = document.getElementById('charFallback');

  if (yorImage && charFallback) {
    const showCharFallback = () => {
      yorImage.style.display = 'none';
      charFallback.classList.add('visible');
    };
    yorImage.addEventListener('error', showCharFallback);
    if (yorImage.complete && yorImage.naturalWidth === 0) {
      showCharFallback();
    }
  }

  // Fallback handler for forger.png
  const forgerImage = document.getElementById('forgerImage');
  const forgerFallback = document.getElementById('forgerFallback');

  if (forgerImage && forgerFallback) {
    const showForgerFallback = () => {
      forgerImage.style.display = 'none';
      forgerFallback.classList.add('visible');
    };
    forgerImage.addEventListener('error', showForgerFallback);
    if (forgerImage.complete && forgerImage.naturalWidth === 0) {
      showForgerFallback();
    }
  }

  // Sticky navbar styling + active link tracking
  const updateNav = () => {
    if (navbar) {
      navbar.classList.toggle('scrolled', window.scrollY > 36);
    }

    let currentId = 'home';
    sections.forEach((sec) => {
      const rect = sec.getBoundingClientRect();
      if (rect.top <= window.innerHeight * 0.42) {
        currentId = sec.id;
      }
    });

    links.forEach((link) => {
      link.classList.toggle('active', link.getAttribute('href') === `#${currentId}`);
    });
  };

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();

  // Mobile drawer toggle
  if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
      const isOpen = navLinks.classList.toggle('open');
      navToggle.classList.toggle('open', isOpen);
      navToggle.setAttribute('aria-expanded', String(isOpen));
    });

    links.forEach((link) => {
      link.addEventListener('click', () => {
        navLinks.classList.remove('open');
        navToggle.classList.remove('open');
        navToggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Subtle mouse parallax on Yor character image
  const hero = document.getElementById('home');
  const heroChar = document.getElementById('heroCharacter');

  if (hero && heroChar) {
    hero.addEventListener('mousemove', (e) => {
      if (window.innerWidth <= 768) return;
      const rect = hero.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;
      heroChar.style.setProperty('--px', `${normX * -22}px`);
      heroChar.style.setProperty('--py', `${normY * -14}px`);
    });

    hero.addEventListener('mouseleave', () => {
      heroChar.style.setProperty('--px', '0px');
      heroChar.style.setProperty('--py', '0px');
    });
  }
})();

/* ==========================================================================
   02. THREE.JS SCENE (.GLB / .OBJ LOADER + PROCEDURAL FALLBACK)
   ========================================================================== */
(() => {
  if (typeof THREE === 'undefined') {
    console.warn('Three.js failed to load from CDN.');
    return;
  }

  const canvas = document.getElementById('weapon-canvas');
  const stage = document.getElementById('weaponStage');
  if (!canvas || !stage) return;

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;

  // Scene
  const scene = new THREE.Scene();

  // Procedural Studio Environment Map (guarded for WebGL compatibility)
  try {
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x140307);

    const addLightPanel = (color, w, h, pos, rot) => {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide })
      );
      panel.position.set(...pos);
      if (rot) panel.rotation.set(...rot);
      envScene.add(panel);
    };

    addLightPanel(0xfff4d6, 12, 6, [0, 7, 2], [Math.PI / 2, 0, 0]);
    addLightPanel(0xffffff, 8, 12, [7, 2, 4], [0, -Math.PI / 2.4, 0]);
    addLightPanel(0xffe099, 8, 10, [-7, 1, 3], [0, Math.PI / 2.4, 0]);
    addLightPanel(0x9e1b32, 10, 8, [0, -5, -5], [-Math.PI / 3, 0, 0]);

    const envRT = pmremGenerator.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();
  } catch (err) {
    console.warn('PMREM studio reflection fallback to direct lights:', err);
  }

  // Camera
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0.45, 0.25, 6.2);

  // Controls (360-degree drag/touch rotation, idle auto-rotate, disabled zoom)
  let controls = null;
  if (typeof THREE.OrbitControls === 'function') {
    controls = new THREE.OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.6;

    let idleTimeout;
    controls.addEventListener('start', () => {
      controls.autoRotate = false;
      clearTimeout(idleTimeout);
    });
    controls.addEventListener('end', () => {
      idleTimeout = setTimeout(() => {
        controls.autoRotate = true;
      }, 1800);
    });
  }

  // Studio Lighting
  const ambient = new THREE.AmbientLight(0x3a0c15, 1.1);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xfff1d0, 2.8);
  keyLight.position.set(4, 6, 5);
  scene.add(keyLight);

  const rimLight = new THREE.DirectionalLight(0x9e1b32, 2.2);
  rimLight.position.set(-5, -2, -4);
  scene.add(rimLight);

  const goldFill = new THREE.PointLight(0xd4af37, 2.6, 16);
  goldFill.position.set(-2.5, 2.5, 3);
  scene.add(goldFill);

  // Metallic Brushed Gold Material
  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#E5BA4E'),
    metalness: 0.94,
    roughness: 0.22,
    clearcoat: 0.35,
    clearcoatRoughness: 0.14,
    envMapIntensity: 1.55
  });

  // Root container for whichever 3D asset is active (procedural or external)
  const modelRoot = new THREE.Group();
  scene.add(modelRoot);

  // --------------------------------------------------------------------------
  // Procedural Fallback Mesh: Twin Crossed Golden Stilettos (~68% scale)
  // --------------------------------------------------------------------------
  function createGoldenStiletto() {
    const stiletto = new THREE.Group();
    const pts = [];

    pts.push(new THREE.Vector2(0.001, -2.12));
    pts.push(new THREE.Vector2(0.015, -1.98));
    pts.push(new THREE.Vector2(0.028, -1.70));
    pts.push(new THREE.Vector2(0.040, -1.10));
    pts.push(new THREE.Vector2(0.049, -0.35));
    pts.push(new THREE.Vector2(0.056, 0.30));

    pts.push(new THREE.Vector2(0.058, 0.32));
    pts.push(new THREE.Vector2(0.075, 0.34));
    pts.push(new THREE.Vector2(0.078, 0.41));
    pts.push(new THREE.Vector2(0.066, 0.43));

    const ribCount = 14;
    const gripStart = 0.43;
    const gripHeight = 1.12;
    const ribStep = gripHeight / ribCount;
    const samplesPerRib = 6;

    for (let i = 0; i < ribCount; i++) {
      const y0 = gripStart + i * ribStep;
      for (let s = 0; s <= samplesPerRib; s++) {
        const t = s / samplesPerRib;
        const y = y0 + t * ribStep;
        const ridge = 0.5 - 0.5 * Math.cos(t * Math.PI * 2);
        const r = 0.062 + ridge * 0.025;
        pts.push(new THREE.Vector2(r, y));
      }
    }

    pts.push(new THREE.Vector2(0.072, 1.56));
    pts.push(new THREE.Vector2(0.085, 1.61));
    pts.push(new THREE.Vector2(0.082, 1.67));
    pts.push(new THREE.Vector2(0.054, 1.71));
    pts.push(new THREE.Vector2(0.044, 1.75));
    pts.push(new THREE.Vector2(0.001, 1.76));

    const bodyMesh = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), goldMaterial);
    stiletto.add(bodyMesh);

    const ringMesh = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.043, 32, 64), goldMaterial);
    ringMesh.position.y = 1.91;
    stiletto.add(ringMesh);

    return stiletto;
  }

  function mountProceduralFallback() {
    modelRoot.clear();

    const weaponPair = new THREE.Group();
    const stilettoA = createGoldenStiletto();
    stilettoA.rotation.z = -0.22;
    stilettoA.rotation.y = 0.14;
    stilettoA.position.set(-0.08, 0.06, 0.048);

    const stilettoB = createGoldenStiletto();
    stilettoB.rotation.z = -0.44;
    stilettoB.rotation.y = -0.14;
    stilettoB.position.set(0.16, -0.06, -0.048);

    weaponPair.add(stilettoA, stilettoB);
    weaponPair.rotation.x = 0.12;
    weaponPair.rotation.z = 0.14;
    weaponPair.scale.setScalar(0.68);

    modelRoot.add(weaponPair);
  }

  mountProceduralFallback();

  // --------------------------------------------------------------------------
  // External .GLB & .OBJ Model Loader
  // --------------------------------------------------------------------------
  function mountNormalizedCustomModel(object3d, applyGoldFallback) {
    const box = new THREE.Box3().setFromObject(object3d);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 1;
    const scale = 2.55 / maxDim;

    object3d.scale.multiplyScalar(scale);
    object3d.position.sub(center.multiplyScalar(scale));

    object3d.traverse((child) => {
      if (child.isMesh) {
        if (applyGoldFallback) {
          child.material = goldMaterial;
        } else if (child.material) {
          child.material.envMapIntensity = 1.4;
        }
      }
    });

    modelRoot.clear();
    modelRoot.add(object3d);
  }

  function loadCustomModel() {
    if (!MODEL_PATH || window.location.protocol === 'file:') {
      return;
    }

    const type = MODEL_TYPE.toLowerCase();

    if (type === 'glb' && typeof THREE.GLTFLoader === 'function') {
      const gltfLoader = new THREE.GLTFLoader();
      gltfLoader.load(
        MODEL_PATH,
        (gltf) => {
          mountNormalizedCustomModel(gltf.scene, false);
        },
        undefined,
        () => {}
      );
    } else if (type === 'obj' && typeof THREE.OBJLoader === 'function') {
      const loadObj = (materials) => {
        const objLoader = new THREE.OBJLoader();
        if (materials) objLoader.setMaterials(materials);
        objLoader.load(
          MODEL_PATH,
          (obj) => {
            mountNormalizedCustomModel(obj, !materials);
          },
          undefined,
          () => {}
        );
      };

      if (MTL_PATH && typeof THREE.MTLLoader === 'function') {
        const mtlLoader = new THREE.MTLLoader();
        mtlLoader.load(
          MTL_PATH,
          (materials) => {
            materials.preload();
            loadObj(materials);
          },
          undefined,
          () => loadObj(null)
        );
      } else {
        loadObj(null);
      }
    }
  }

  loadCustomModel();

  // Subtle floating gold dust motes
  const moteCount = 42;
  const motePositions = new Float32Array(moteCount * 3);
  for (let i = 0; i < moteCount; i++) {
    motePositions[i * 3] = (Math.random() - 0.5) * 3.8;
    motePositions[i * 3 + 1] = (Math.random() - 0.5) * 4.4;
    motePositions[i * 3 + 2] = (Math.random() - 0.5) * 2.6;
  }
  const moteGeo = new THREE.BufferGeometry();
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
  const moteMat = new THREE.PointsMaterial({
    color: 0xd4af37,
    size: 0.025,
    transparent: true,
    opacity: 0.5
  });
  const motes = new THREE.Points(moteGeo, moteMat);
  scene.add(motes);

  // Responsive sizing
  function resizeCanvas() {
    const width = stage.clientWidth;
    const height = stage.clientHeight;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(resizeCanvas).observe(stage);
  } else {
    window.addEventListener('resize', resizeCanvas);
  }
  resizeCanvas();

  // Animation loop
  const clock = new THREE.Clock();
  function animate() {
    requestAnimationFrame(animate);
    const t = clock.getElapsedTime();

    modelRoot.position.y = Math.sin(t * 1.4) * 0.05;
    motes.rotation.y = t * 0.06;

    if (controls) {
      controls.update();
    } else {
      modelRoot.rotation.y = t * 0.45;
    }

    renderer.render(scene, camera);
  }
  animate();
})();