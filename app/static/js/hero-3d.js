import * as THREE from './vendor/three.module.min.js';

(() => {
  const universe = document.querySelector('[data-hero-universe]');
  const hero = document.querySelector('.hero');
  const canvas = universe?.querySelector('.hero-orb-canvas');
  const skillElements = universe ? [...universe.querySelectorAll('[data-hero-skill]')] : [];
  if (!universe || !hero || !canvas || !skillElements.length) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const pointer = { x: 0, y: 0, localX: 0, localY: 0, active: false };
  const pointerEase = { x: 0, y: 0 };
  const skillStates = skillElements.map((element, index) => ({
    element,
    index,
    angle: (index / skillElements.length) * Math.PI * 2 + (index % 3) * 0.18,
    speed: (0.000045 + (index % 5) * 0.000008) * (index % 3 === 0 ? -1 : 1),
    plane: (index % 4) - 1.5,
    phase: index * 1.73,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    width: 80,
    height: 36,
    hovered: false,
    active: true,
  }));

  let width = 1;
  let height = 1;
  let centerX = 1;
  let centerY = 1;
  let scrollProgress = 0;
  let targetScrollProgress = 0;
  let heroVisible = true;
  let loopRunning = false;
  let rafId = 0;
  let lastTime = 0;
  let resizeTimer = 0;
  let frameCount = 0;
  let sceneTime = 0;
  let introProgress = reduced ? 1 : 0;
  let darkTarget = document.documentElement.dataset.theme === 'light' ? 0 : 1;
  let darkIntensity = darkTarget;
  let contextLost = false;
  let ctaHovered = false;
  let ctaCenter = { x: 0.9, y: 0.86 };
  let renderer = null;
  let scene = null;
  let camera = null;
  let sceneGroup = null;
  let coreMesh = null;
  let coreMaterial = null;
  let wireMaterial = null;
  let coreGeometry = null;
  let coreBasePositions = null;
  let particleGeometry = null;
  let particleCloud = null;
  let particleMaterial = null;
  let particleData = [];
  let ambientLight = null;
  let keyLight = null;
  let warmLight = null;
  let nebulaMaterial = null;
  let nebulaCloudMaterial = null;
  let nebulaScene = null;
  let nebulaTarget = null;
  let lastNebulaTime = -Infinity;
  let faceMaterial = null;
  let orbitLights = null;
  let shootingStar = null;
  let nextShootingStar = 7 + Math.random() * 11;
  let shootingStarted = -1;
  let shootingDuration = 1;
  const shootingOrigin = new THREE.Vector2();
  const shootingVelocity = new THREE.Vector2();
  const orbitRings = [];
  const orbitMaterials = [];

  const visibleStates = () => skillStates.filter((state) => state.active);

  const measure = (placeImmediately = false) => {
    const rect = universe.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    centerX = width * (window.innerWidth < 768 ? 0.57 : 0.65);
    centerY = height * 0.5;
    const ctaRect = hero.querySelector('.hero-cta')?.getBoundingClientRect();
    if (ctaRect) ctaCenter = { x: (ctaRect.left + ctaRect.width / 2 - rect.left) / width, y: (ctaRect.top + ctaRect.height / 2 - rect.top) / height };

    skillStates.forEach((state) => {
      state.active = getComputedStyle(state.element).display !== 'none';
      if (!state.active) return;
      state.width = state.element.offsetWidth || 80;
      state.height = state.element.offsetHeight || 36;
      if (placeImmediately || (!state.x && !state.y)) {
        const rx = width * (window.innerWidth < 768 ? 0.27 + (state.index % 4) * 0.018 : 0.22 + (state.index % 4) * 0.015);
        const ry = height * (0.25 + (state.index % 3) * 0.024);
        state.x = centerX + Math.cos(state.angle) * rx;
        state.y = centerY + Math.sin(state.angle) * ry;
        setSkillVisual(state, Math.sin(state.angle + state.phase), 0);
      }
    });

    if (renderer && camera) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = window.innerWidth < 768 ? 5.4 * Math.max(1, 0.82 / camera.aspect) : 5.4;
      camera.updateProjectionMatrix();
      nebulaCloudMaterial?.uniforms.uAspect.value.set(camera.aspect, 1);
      if (nebulaTarget) {
        const targetWidth = window.innerWidth < 768 ? 256 : 480;
        nebulaTarget.setSize(targetWidth, Math.min(512, Math.round(targetWidth / camera.aspect)));
        lastNebulaTime = -Infinity;
      }
      if (particleGeometry) particleGeometry.setDrawRange(0, getParticleCount());
      if (sceneGroup) {
        const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
        const viewWidth = viewHeight * camera.aspect;
        sceneGroup.position.x = ((centerX / width) * 2 - 1) * viewWidth * 0.5;
      }
    }
  };

  const applyTheme = (theme = document.documentElement.dataset.theme) => {
    darkTarget = theme === 'light' ? 0 : 1;
    if (reduced || !loopRunning) darkIntensity = darkTarget;
    if (!renderer) return;
    const light = theme === 'light';
    renderer.toneMappingExposure = light ? 1.18 : 1.3;
    coreMaterial?.color.set(light ? 0x25272a : 0x38302d);
    if (coreMaterial) {
      coreMaterial.roughness = light ? 0.46 : 0.38;
      coreMaterial.metalness = light ? 0.62 : 0.68;
    }
    if (wireMaterial) wireMaterial.opacity = light ? 0.18 : 0.24;
    orbitMaterials.forEach((material, index) => {
      material.color.set(index === 1 ? 0xff5c35 : light ? 0x313131 : 0xf7f4ee);
      material.opacity = index === 1 ? (light ? 0.13 : 0.18) : (light ? 0.105 : 0.13);
    });
    if (particleMaterial) {
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#ff5c35';
      particleMaterial.uniforms.uColor.value.set(accent);
      particleMaterial.uniforms.uThemeOpacity.value = 0.18 + darkIntensity * 0.82;
      particleMaterial.uniforms.uLightMode.value = 1 - darkIntensity;
    }
    if (ambientLight) ambientLight.intensity = light ? 1.35 : 1.05;
    if (keyLight) keyLight.intensity = light ? 4.2 : 3.5;
    if (warmLight) warmLight.intensity = light ? 6.5 : 10;
    if (nebulaMaterial) nebulaMaterial.uniforms.uIntensity.value = darkIntensity;
    renderer.render(scene, camera);
  };

  const getParticleCount = () => {
    const areaCount = Math.round(width * height / 4000);
    return window.innerWidth < 768 ? Math.max(60, Math.min(96, areaCount))
      : window.innerWidth < 1024 ? Math.max(120, Math.min(180, areaCount))
        : Math.max(260, Math.min(320, areaCount));
  };

  const buildAtmosphere = () => {
    // A procedural cloud plane in the existing scene; no images or second renderer.
    nebulaCloudMaterial = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 }, uIntensity: { value: darkIntensity },
        uIntro: { value: reduced ? 1 : 0 },
        uAspect: { value: new THREE.Vector2(width / height, 1) },
        uPointer: { value: new THREE.Vector2() },
      },
      vertexShader: `varying vec2 vUv;
        void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`,
      fragmentShader: `
        varying vec2 vUv;
        uniform float uTime, uIntensity, uIntro;
        uniform vec2 uAspect, uPointer;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1,0)), f.x), mix(hash(i + vec2(0,1)), hash(i + vec2(1)), f.x), f.y);
        }
        float cloud(vec2 p) {
          float n = 0.0, a = 0.5;
          for (int i = 0; i < 4; i++) { n += a * noise(p); p = mat2(1.6,1.2,-1.2,1.6) * p + 3.1; a *= 0.5; }
          return n;
        }
        void main() {
          vec2 uv = vUv + uPointer * 0.003;
          vec2 p = uv * vec2(min(uAspect.x, 2.0), 1.0);
          float mist = cloud(p * 5.0 + vec2(uTime * 0.008, -uTime * 0.004));
          float detail = cloud(p * 11.0 + mist * 2.4);
          float upper = exp(-dot((uv - vec2(0.19,0.77)) * vec2(2.8,5.8), (uv - vec2(0.19,0.77)) * vec2(2.8,5.8)));
          float planet = exp(-dot((uv - vec2(0.75,0.51)) * vec2(4.0,3.0), (uv - vec2(0.75,0.51)) * vec2(4.0,3.0)));
          float lower = exp(-dot((uv - vec2(0.79,0.12)) * vec2(2.8,7.2), (uv - vec2(0.79,0.12)) * vec2(2.8,7.2)));
          float dust = exp(-dot((uv - vec2(0.1,0.12)) * vec2(5.0,7.0), (uv - vec2(0.1,0.12)) * vec2(5.0,7.0)));
          float filaments = smoothstep(0.23, 0.77, mist) * smoothstep(0.18, 0.78, detail);
          vec3 warm = mix(vec3(0.32,0.026,0.008), vec3(0.72,0.19,0.052), detail);
          vec3 color = warm * filaments * (upper * 0.65 + planet * 0.38 + lower * 0.65 + dust * 0.2);
          color += vec3(0.035,0.07,0.14) * filaments * exp(-length((uv - vec2(0.91,0.78)) * vec2(4.0,5.0))) * 0.3;
          // Leave the introduction in a quiet pocket while retaining depth.
          color *= 1.0 - 0.72 * exp(-length((uv - vec2(0.5,0.11)) * vec2(7.0,12.0)));
          gl_FragColor = vec4(color * 0.4, 1.0);
          #include <colorspace_fragment>
          #include <premultiplied_alpha_fragment>
        }`,
      transparent: false, premultipliedAlpha: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    // Compute slow clouds at low resolution with the SAME renderer. The main
    // frame samples one inexpensive texture rather than full-resolution noise.
    nebulaTarget = new THREE.WebGLRenderTarget(480, 300, { depthBuffer: false, stencilBuffer: false });
    nebulaTarget.texture.generateMipmaps = false;
    nebulaScene = new THREE.Scene();
    const cloudPlane = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), nebulaCloudMaterial);
    cloudPlane.frustumCulled = false;
    nebulaScene.add(cloudPlane);
    nebulaMaterial = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: nebulaTarget.texture }, uIntensity: { value: darkIntensity }, uIntro: { value: reduced ? 1 : 0 }, uPointer: { value: new THREE.Vector2() } },
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.999, 1.0); }`,
      fragmentShader: `varying vec2 vUv; uniform sampler2D uMap; uniform float uIntensity, uIntro; uniform vec2 uPointer;
        void main() { vec2 uv = vUv * 0.99 + 0.005 + uPointer * 0.003;
          gl_FragColor = vec4(texture2D(uMap, uv).rgb, uIntensity * uIntro * 0.55);
          #include <colorspace_fragment>
          #include <premultiplied_alpha_fragment>
        }`,
      transparent: false, premultipliedAlpha: true, depthTest: false, depthWrite: false, toneMapped: false,
    });
    const nebula = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), nebulaMaterial);
    nebula.frustumCulled = false;
    nebula.renderOrder = -10;
    scene.add(nebula);

    const trailGeometry = new THREE.BufferGeometry();
    trailGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(24 * 3), 3));
    trailGeometry.setAttribute('aFade', new THREE.BufferAttribute(Float32Array.from({ length: 24 }, (_, i) => Math.pow(1 - i / 23, 1.8)), 1));
    shootingStar = new THREE.Line(trailGeometry, new THREE.ShaderMaterial({
      uniforms: { uOpacity: { value: 0 } },
      vertexShader: `attribute float aFade; varying float vFade;
        void main() { vFade = aFade; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform float uOpacity; varying float vFade;
        void main() { gl_FragColor = vec4(mix(vec3(1.0,0.29,0.08), vec3(1.0,0.93,0.83), vFade), vFade * uOpacity); }`,
      transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      blending: THREE.AdditiveBlending,
    }));
    shootingStar.frustumCulled = false;
    shootingStar.visible = false;
    scene.add(shootingStar);
  };

  const buildScene = () => {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      let shaderFailed = false;
      renderer.debug.onShaderError = () => { shaderFailed = true; };
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(33, width / height, 0.1, 100);
      camera.position.set(0, 0, 5.4);
      buildAtmosphere();

      sceneGroup = new THREE.Group();
      scene.add(sceneGroup);

      coreGeometry = new THREE.IcosahedronGeometry(1.02, window.innerWidth < 768 ? 2 : 3);
      coreBasePositions = Float32Array.from(coreGeometry.attributes.position.array);
      coreMaterial = new THREE.MeshStandardMaterial({
        color: 0x38302d,
        roughness: 0.38,
        metalness: 0.68,
        flatShading: true,
      });
      coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
      sceneGroup.add(coreMesh);

      wireMaterial = new THREE.MeshBasicMaterial({
        color: 0xff5c35,
        transparent: true,
        opacity: 0.24,
        wireframe: true,
        depthWrite: false,
      });
      const wireMesh = new THREE.Mesh(coreGeometry, wireMaterial);
      wireMesh.scale.setScalar(1.035);
      coreMesh.add(wireMesh);

      const orbitMaterial = new THREE.MeshBasicMaterial({
        color: 0xf7f4ee,
        transparent: true,
        opacity: 0.13,
        depthWrite: false,
      });
      [
        [1.54, 0.012, 1.02, 0.1, 0.28],
        [1.76, 0.009, -0.62, 0.78, -0.24],
        [1.38, 0.008, 0.42, -0.76, 0.88],
      ].forEach(([radius, tube, x, y, z], index) => {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(radius, tube, 6, 96),
          orbitMaterial.clone(),
        );
        ring.rotation.set(x, y, z);
        if (index === 1) {
          ring.material.color.set(0xff5c35);
          ring.material.opacity = 0.18;
        }
        orbitMaterials.push(ring.material);
        orbitRings.push({ ring, radius, phase: index * 2.1 });
        sceneGroup.add(ring);
      });
      orbitMaterial.dispose();
      const orbitGeometry = new THREE.BufferGeometry();
      orbitGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9), 3));
      orbitLights = new THREE.Points(orbitGeometry, new THREE.PointsMaterial({
        color: 0xffb45c, size: 0.034, transparent: true, opacity: 0.8, depthWrite: false,
      }));
      sceneGroup.add(orbitLights);

      // A handful of the existing planet's triangles illuminate independently.
      const facePositions = [], facePhases = [];
      const source = coreGeometry.attributes.position;
      for (let i = 0; i < 12; i += 1) {
        const face = Math.floor(Math.random() * (source.count / 3)) * 3;
        for (let vertex = 0; vertex < 3; vertex += 1) {
          facePositions.push(source.getX(face + vertex), source.getY(face + vertex), source.getZ(face + vertex));
          facePhases.push(i * 2.399);
        }
      }
      const faces = new THREE.BufferGeometry();
      faces.setAttribute('position', new THREE.Float32BufferAttribute(facePositions, 3));
      faces.setAttribute('aPhase', new THREE.Float32BufferAttribute(facePhases, 1));
      faceMaterial = new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uIntensity: { value: darkIntensity } },
        vertexShader: `attribute float aPhase; varying float vPhase;
          void main() { vPhase = aPhase; gl_Position = projectionMatrix * modelViewMatrix * vec4(position * 1.028, 1.0); }`,
        fragmentShader: `uniform float uTime, uIntensity; varying float vPhase;
          void main() { float pulse = pow(0.5 + 0.5 * sin(uTime * 0.42 + vPhase), 12.0);
          gl_FragColor = vec4(1.0,0.19,0.045,pulse * 0.19 * uIntensity); }`,
        transparent: true, depthWrite: false, side: THREE.FrontSide, blending: THREE.AdditiveBlending,
      });
      coreMesh.add(new THREE.Mesh(faces, faceMaterial));

      // Keep the star field dense at every viewport size without creating
      // thousands of DOM nodes (the whole field is still one GPU draw call).
      // Allocate once; drawRange adapts density on resize without scene rebuilds.
      const particleCount = 320;
      const particlePositions = new Float32Array(particleCount * 3);
      const particleColors = new Float32Array(particleCount * 3);
      const particleSizes = new Float32Array(particleCount);
      const particleMinAlphas = new Float32Array(particleCount);
      const particleMaxAlphas = new Float32Array(particleCount);
      const particlePhases = new Float32Array(particleCount);
      const particleTwinkleSpeeds = new Float32Array(particleCount);
      const particleBursts = new Float32Array(particleCount);
      const particleLightVisibility = new Float32Array(particleCount);
      particleData = [];
      for (let index = 0; index < particleCount; index += 1) {
        const jitter = 0.035;
        let nx = (index * 0.61803398875 + Math.random() * jitter) % 1;
        let ny = (index * 0.75487766625 + Math.random() * jitter) % 1;
        const nearOrb = nx > 0.52 && nx < 0.88 && ny > 0.2 && ny < 0.7;

        const layerRoll = ((index * 47) % 100) / 100;
        const layer = layerRoll < 0.58 ? 0 : layerRoll < 0.9 ? 1 : 2;
        const layerDepth = Math.random();
        const z = layer === 0
          ? -1.35 + layerDepth * 0.72
          : layer === 1
            ? -0.5 + layerDepth * 0.82
            : 0.42 + layerDepth * 0.68;
        const brightnessRoll = ((index * 37) % 100) / 100;
        const brightness = brightnessRoll < 0.65 ? 0 : brightnessRoll < 0.85 ? 1 : brightnessRoll < 0.95 ? 2 : 3;
        const protectedText = nx < 0.62 && ny > 0.2 && ny < 0.72;
        const protectedCta = nx > 0.76 && ny > 0.7;
        const protectedScrollLabel = nx < 0.1 && ny > 0.55;
        const protectedNav = ny < 0.1;
        const protectedCopy = nx > 0.32 && nx < 0.7 && ny > 0.78;
        const quietZone = protectedText || protectedCta || protectedScrollLabel || protectedNav || protectedCopy;
        const quietMultiplier = quietZone ? 0.52 : 1;
        const sizeRanges = [[1.25, 2.25], [2.2, 3.6], [3.4, 5.2], [5.5, 8.5]];
        const alphaRanges = [[0.16, 0.28, 0.38, 0.58], [0.22, 0.38, 0.6, 0.8], [0.28, 0.46, 0.8, 1], [0.18, 0.3, 0.92, 1]];
        const sizeRange = sizeRanges[brightness];
        const alphaRange = alphaRanges[brightness];
        const duration = 2.5 + Math.random() * 5.5;
        particleSizes[index] = sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0]);
        const palette = [0xff5c35, 0xff6b35, 0xff3d1f, 0xffb45c, 0xff5c35, 0xff6b35, 0xffffff, 0xcde8ff, 0x8ac7ff, 0xff5c35];
        new THREE.Color(palette[index % palette.length]).toArray(particleColors, index * 3);
        particleMinAlphas[index] = (alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0])) * quietMultiplier;
        particleMaxAlphas[index] = (alphaRange[2] + Math.random() * (alphaRange[3] - alphaRange[2])) * quietMultiplier;
        particlePhases[index] = Math.random() * Math.PI * 2;
        particleTwinkleSpeeds[index] = (Math.PI * 2) / duration;
        particleBursts[index] = brightness === 3 ? 1 : 0;
        particleLightVisibility[index] = index % 5 === 0 ? 1 : 0;
        particleData.push({
          nx,
          ny,
          z,
          layer,
          nearOrb,
          phase: particlePhases[index],
          driftX: 0.008 + layer * 0.008 + Math.random() * 0.012,
          driftY: 0.009 + layer * 0.009 + Math.random() * 0.013,
        });
      }
      particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleGeometry.setAttribute('aColor', new THREE.BufferAttribute(particleColors, 3));
      particleGeometry.setDrawRange(0, getParticleCount());
      particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(particleSizes, 1));
      particleGeometry.setAttribute('aMinAlpha', new THREE.BufferAttribute(particleMinAlphas, 1));
      particleGeometry.setAttribute('aMaxAlpha', new THREE.BufferAttribute(particleMaxAlphas, 1));
      particleGeometry.setAttribute('aPhase', new THREE.BufferAttribute(particlePhases, 1));
      particleGeometry.setAttribute('aTwinkleSpeed', new THREE.BufferAttribute(particleTwinkleSpeeds, 1));
      particleGeometry.setAttribute('aBurst', new THREE.BufferAttribute(particleBursts, 1));
      particleGeometry.setAttribute('aLightVisibility', new THREE.BufferAttribute(particleLightVisibility, 1));
      particleMaterial = new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(0xff5c35) },
          uThemeOpacity: { value: 1 },
          uScrollFade: { value: 1 },
          uIntroFade: { value: reduced ? 1 : 0.1 },
          uLightMode: { value: 0 },
          uTime: { value: 0 },
          uMotion: { value: reduced ? 0 : 1 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        },
        vertexShader: `
          attribute float aSize;
          attribute vec3 aColor;
          attribute float aMinAlpha;
          attribute float aMaxAlpha;
          attribute float aPhase;
          attribute float aTwinkleSpeed;
          attribute float aBurst;
          attribute float aLightVisibility;
          uniform float uTime;
          uniform float uMotion;
          uniform float uPixelRatio;
          uniform float uLightMode;
          uniform float uThemeOpacity;
          uniform float uScrollFade;
          uniform float uIntroFade;
          varying float vAlpha;
          varying float vBurst;
          varying vec3 vColor;
          void main() {
            float primaryWave = 0.5 + 0.5 * sin(uTime * aTwinkleSpeed + aPhase);
            float shimmerWave = 0.5 + 0.5 * sin(uTime * aTwinkleSpeed * 0.43 + aPhase * 1.71);
            float animatedTwinkle = smoothstep(0.06, 0.94, primaryWave) * mix(0.72, 1.0, shimmerWave);
            float twinkle = mix(0.38, animatedTwinkle, uMotion);
            float twinkleScale = mix(0.78, 1.28, twinkle);
            float themeVisibility = mix(1.0, aLightVisibility, uLightMode);
            vColor = mix(aColor, vec3(0.7, 0.12, 0.035), uLightMode);
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = aSize * uPixelRatio * 2.1 * twinkleScale;
            vAlpha = mix(aMinAlpha, aMaxAlpha, twinkle) * themeVisibility * uThemeOpacity * uScrollFade * uIntroFade;
            vBurst = aBurst * smoothstep(0.55, 0.95, twinkle);
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          varying float vBurst;
          varying vec3 vColor;
          void main() {
            vec2 point = gl_PointCoord - vec2(0.5);
            float radius = length(point);
            float core = 1.0 - smoothstep(0.015, 0.17, radius);
            float glow = exp(-radius * 8.0) * 0.3;
            float horizontal = (1.0 - smoothstep(0.0, 0.065, abs(point.y))) * (1.0 - smoothstep(0.14, 0.5, abs(point.x)));
            float vertical = (1.0 - smoothstep(0.0, 0.065, abs(point.x))) * (1.0 - smoothstep(0.14, 0.5, abs(point.y)));
            float starburst = max(horizontal, vertical) * vBurst * 0.7;
            float shape = max(core + glow, starburst);
            if (shape <= 0.01) discard;
            gl_FragColor = vec4(mix(vColor, vec3(1.0,0.88,0.72), core * vBurst * 0.4), vAlpha * shape);
            #include <colorspace_fragment>
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        blending: THREE.NormalBlending,
      });
      particleCloud = new THREE.Points(
        particleGeometry,
        particleMaterial,
      );
      particleCloud.frustumCulled = false;
      scene.add(particleCloud);

      ambientLight = new THREE.AmbientLight(0xf5f3ed, 1.05);
      scene.add(ambientLight);
      keyLight = new THREE.DirectionalLight(0xfff4ed, 3.5);
      keyLight.position.set(-2.3, 2.4, 3.8);
      scene.add(keyLight);
      warmLight = new THREE.PointLight(0xff5c35, 10, 8, 1.6);
      warmLight.position.set(2.1, -1.1, 3.1);
      scene.add(warmLight);

      measure(true);
      applyTheme();
      updateScene(sceneTime, 1);
      if (shaderFailed) throw new Error('Hero shader unavailable');
      universe.classList.add('is-webgl-ready');
    } catch (error) {
      universe.classList.add('is-webgl-fallback');
      universe.classList.remove('is-webgl-ready');
      renderer?.dispose();
      renderer = null;
      settleStaticSkills();
    }
  };

  const setSkillVisual = (state, z, tilt, forceStatic = false) => {
    const depth = forceStatic ? 0.5 : (z + 1) / 2;
    const hoveredBoost = state.hovered ? 0.13 : 0;
    const scale = (0.76 + depth * 0.29 + hoveredBoost).toFixed(3);
    const opacity = forceStatic ? 0.9 : (0.52 + depth * 0.48).toFixed(3);
    const x = state.x - state.width / 2;
    const y = state.y - state.height / 2;
    state.element.style.setProperty('--skill-scale', scale);
    state.element.style.setProperty('--skill-opacity', opacity);
    state.element.style.setProperty('--skill-tilt', `${state.hovered ? 0 : tilt.toFixed(2)}deg`);
    state.element.style.zIndex = state.hovered ? '9' : z > 0.02 ? '7' : '2';
    state.element.style.filter = !state.hovered && depth < 0.23 ? 'blur(.25px)' : 'none';
    state.element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(var(--skill-scale)) rotate(var(--skill-tilt))`;
  };

  const settleStaticSkills = () => {
    const states = visibleStates();
    states.forEach((state, index) => {
      const angle = (index / states.length) * Math.PI * 2 - Math.PI / 2;
      const rx = width * (window.innerWidth < 768 ? 0.34 : 0.31);
      const ry = height * (window.innerWidth < 768 ? 0.32 : 0.28);
      state.x = Math.max(state.width / 2 + 8, Math.min(width - state.width / 2 - 8, centerX + Math.cos(angle) * rx));
      state.y = Math.max(state.height / 2 + 8, Math.min(height - state.height / 2 - 8, centerY + Math.sin(angle) * ry));
      setSkillVisual(state, index % 2 ? -0.3 : 0.3, 0, true);
    });
  };

  const updateSkills = (frameScale, elapsed) => {
    const states = visibleStates();
    const mobile = window.innerWidth < 768;
    const speedBoost = 1 + scrollProgress * (mobile ? 0.06 : 0.18);
    const expansion = 1 + scrollProgress * 0.045;

    states.forEach((state) => {
      const hoverSpeed = state.hovered ? 0.035 : 1;
      state.angle += state.speed * frameScale * 16.67 * speedBoost * hoverSpeed;
      const rx = width * (mobile ? 0.265 + (state.index % 4) * 0.017 : 0.215 + (state.index % 4) * 0.015) * expansion;
      const ry = height * (0.235 + (state.index % 3) * 0.022) * expansion;
      const orbitWarp = Math.sin(state.angle * 1.8 + state.phase) * (mobile ? 2.5 : 6);
      const targetX = centerX + Math.cos(state.angle) * rx;
      const targetY = centerY + Math.sin(state.angle + state.plane * 0.08) * ry + orbitWarp;
      const spring = mobile ? 0.014 : 0.011;
      state.vx += (targetX - state.x) * spring * frameScale;
      state.vy += (targetY - state.y) * spring * frameScale;

      if (!mobile && finePointer && pointer.active) {
        const dx = state.x - pointer.localX;
        const dy = state.y - pointer.localY;
        const distance = Math.hypot(dx, dy) || 1;
        const reach = state.hovered ? 72 : 112;
        if (distance < reach) {
          const force = (reach - distance) * (state.hovered ? 0.0007 : 0.0025);
          state.vx += (dx / distance) * force * frameScale;
          state.vy += (dy / distance) * force * frameScale;
        }
      }
      state.vx *= Math.pow(0.875, frameScale);
      state.vy *= Math.pow(0.875, frameScale);
    });

    if (!mobile) {
      for (let first = 0; first < states.length; first += 1) {
        for (let second = first + 1; second < states.length; second += 1) {
          const a = states[first];
          const b = states[second];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const distance = Math.hypot(dx, dy) || 1;
          const minimum = (a.width + b.width) * 0.48 + 12;
          if (distance < minimum) {
            const hoverFactor = a.hovered || b.hovered ? 0.005 : 0.003;
            const force = (minimum - distance) * hoverFactor;
            const nx = dx / distance;
            const ny = dy / distance;
            a.vx -= nx * force;
            a.vy -= ny * force;
            b.vx += nx * force;
            b.vy += ny * force;
          }
        }
      }
    }

    states.forEach((state) => {
      state.x += state.vx * frameScale;
      state.y += state.vy * frameScale;
      const protectedLeft = mobile ? state.width * 0.52 + 6 : Math.max(state.width * 0.52 + 6, width * 0.4);
      const protectedTop = mobile ? state.height * 0.7 + 6 : Math.max(state.height * 0.7 + 6, height * 0.085);
      const safeX = Math.max(protectedLeft, Math.min(width - state.width * 0.52 - 6, state.x));
      const safeY = Math.max(protectedTop, Math.min(height - state.height * 0.7 - 6, state.y));
      if (safeX !== state.x) state.vx *= -0.16;
      if (safeY !== state.y) state.vy *= -0.16;
      state.x = safeX;
      state.y = safeY;
      const z = Math.sin(state.angle * 1.12 + state.phase * 0.37);
      const tilt = Math.cos(state.angle + state.phase) * (mobile ? 2.5 : 6);
      setSkillVisual(state, z, tilt);
    });
  };

  const updateScene = (elapsed, frameScale) => {
    if (!renderer || !scene || !camera || !sceneGroup || !coreMesh) return;
    pointerEase.x += (pointer.x - pointerEase.x) * 0.045 * frameScale;
    pointerEase.y += (pointer.y - pointerEase.y) * 0.045 * frameScale;
    scrollProgress += (targetScrollProgress - scrollProgress) * 0.07 * frameScale;

    const seconds = elapsed * 0.001;
    darkIntensity += (darkTarget - darkIntensity) * (reduced ? 1 : Math.min(1, 0.07 * frameScale));
    introProgress = reduced ? 1 : Math.min(1, seconds / 3.6);
    if (lastNebulaTime === -Infinity || (!reduced && darkIntensity > 0.02 && seconds - lastNebulaTime > 0.35)) {
      nebulaCloudMaterial.uniforms.uTime.value = reduced ? 0 : seconds;
      renderer.setRenderTarget(nebulaTarget);
      renderer.render(nebulaScene, camera);
      renderer.setRenderTarget(null);
      lastNebulaTime = seconds;
    }
    nebulaMaterial.uniforms.uIntensity.value = darkIntensity;
    nebulaMaterial.uniforms.uIntro.value = reduced ? 1 : Math.min(1, seconds / 1.1);
    nebulaMaterial.uniforms.uPointer.value.set(reduced ? 0 : pointerEase.x, reduced ? 0 : pointerEase.y);
    faceMaterial.uniforms.uTime.value = reduced ? 0 : seconds;
    faceMaterial.uniforms.uIntensity.value = darkIntensity;
    particleMaterial.uniforms.uThemeOpacity.value = 0.18 + darkIntensity * 0.82;
    particleMaterial.uniforms.uLightMode.value = 1 - darkIntensity;
    sceneGroup.rotation.y = seconds * 0.04 + pointerEase.x * 0.12 + scrollProgress * 0.22;
    sceneGroup.rotation.x = Math.sin(seconds * 0.16) * 0.04 - pointerEase.y * 0.075 + scrollProgress * 0.055;
    sceneGroup.rotation.z = Math.sin(seconds * 0.1) * 0.018;
    const baseOrbScale = window.innerWidth < 768 ? 0.62 : 0.75;
    const orbIntro = reduced ? 1 : THREE.MathUtils.smoothstep(seconds, 1.8, 3.1);
    sceneGroup.scale.setScalar((baseOrbScale + scrollProgress * 0.03) * orbIntro);
    coreMesh.rotation.y += reduced ? 0 : 0.00082 * frameScale;
    coreMesh.rotation.x += reduced ? 0 : 0.00024 * frameScale;
    coreMesh.position.y = Math.sin(seconds * 0.42) * 0.035;

    if (particleCloud && particleGeometry && particleData.length) {
      const position = particleGeometry.attributes.position;
      const perspective = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const fieldSeconds = seconds;
      const count = particleGeometry.drawRange.count;
      for (let index = 0; index < count; index += 1) {
        const particle = particleData[index];
        const distance = camera.position.z - particle.z;
        const viewHeight = 2 * perspective * distance;
        const viewWidth = viewHeight * camera.aspect;
        const expansion = 1 + scrollProgress * (0.018 + particle.layer * 0.014);
        const pointerRange = finePointer && !reduced && window.innerWidth >= 1024 ? (3 + particle.layer * 4) / width * viewWidth : 0;
        const movement = reduced ? 0 : 1;
        const driftX = Math.sin(seconds * (0.07 + particle.layer * 0.035) + particle.phase) * particle.driftX * movement;
        const driftY = Math.cos(seconds * (0.058 + particle.layer * 0.031) + particle.phase) * particle.driftY * movement;
        const orbitalX = particle.nearOrb ? Math.sin(seconds * 0.095 + particle.phase) * 0.018 * movement : 0;
        const orbitalY = particle.nearOrb ? Math.cos(seconds * 0.078 + particle.phase) * 0.014 * movement : 0;
        const scrollLift = scrollProgress * (0.035 + particle.layer * 0.045);
        const offset = index * 3;
        position.array[offset] = ((particle.nx - 0.5) * viewWidth + driftX + orbitalX + pointerEase.x * pointerRange) * expansion;
        position.array[offset + 1] = ((0.5 - particle.ny) * viewHeight + driftY + orbitalY - pointerEase.y * pointerRange + scrollLift) * expansion;
        position.array[offset + 2] = particle.z;
        // Repel only nearby foreground stars, with a slightly wider CTA halo.
        if (!reduced && finePointer && window.innerWidth >= 1024 && particle.layer > 0 && (pointer.active || ctaHovered)) {
          const sourceX = ctaHovered ? ctaCenter.x : pointer.localX / width;
          const sourceY = ctaHovered ? ctaCenter.y : pointer.localY / height;
          const dx = (particle.nx - sourceX) * width;
          const dy = (particle.ny - sourceY) * height;
          const distancePx = Math.hypot(dx, dy) || 1;
          const reach = ctaHovered ? 145 : 85;
          const push = Math.max(0, 1 - distancePx / reach) * (ctaHovered ? 12 : 5);
          position.array[offset] += dx / distancePx * push / width * viewWidth;
          position.array[offset + 1] -= dy / distancePx * push / height * viewHeight;
        }
      }
      position.needsUpdate = true;
      particleMaterial.uniforms.uTime.value = fieldSeconds;
      particleMaterial.uniforms.uIntroFade.value = reduced ? 1 : 0.1 + Math.min(1, fieldSeconds / 1.3) * 0.9;
      particleMaterial.uniforms.uScrollFade.value = Math.max(0.25, 1 - scrollProgress * 0.7);
    }
    const orbitPosition = orbitLights.geometry.attributes.position;
    orbitRings.forEach(({ ring, radius, phase }, index) => {
      const angle = seconds * (0.075 + index * 0.016) + phase;
      const point = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, 0).applyEuler(ring.rotation);
      orbitPosition.setXYZ(index, point.x, point.y, point.z);
      ring.material.opacity = (index === 1 ? 0.15 : 0.095) + (0.5 + 0.5 * Math.sin(angle * 2)) * 0.025 * darkIntensity;
    });
    orbitPosition.needsUpdate = true;
    orbitLights.material.opacity = 0.16 + darkIntensity * 0.7;

    if (!reduced && window.innerWidth >= 1024 && darkIntensity > 0.5 && seconds >= nextShootingStar && shootingStarted < 0) {
      shootingStarted = seconds;
      shootingDuration = 0.6 + Math.random() * 0.8;
      shootingOrigin.set(0.15 + Math.random() * 0.8, 0.75 + Math.random() * 0.2);
      shootingVelocity.set(-0.25 - Math.random() * 0.22, -0.22 - Math.random() * 0.15);
    }
    if (shootingStarted >= 0) {
      const progress = (seconds - shootingStarted) / shootingDuration;
      shootingStar.visible = !reduced && darkIntensity > 0.5 && progress < 1 && window.innerWidth >= 1024;
      shootingStar.material.uniforms.uOpacity.value = Math.sin(Math.min(1, progress) * Math.PI) * darkIntensity * 0.8;
      const trail = shootingStar.geometry.attributes.position;
      for (let i = 0; i < trail.count; i += 1) {
        const t = progress - i / trail.count * 0.17;
        trail.setXYZ(i, (shootingOrigin.x + shootingVelocity.x * t) * 2 - 1, (shootingOrigin.y + shootingVelocity.y * t) * 2 - 1, 0);
      }
      trail.needsUpdate = true;
      if (progress >= 1 || reduced) { shootingStarted = -1; nextShootingStar = seconds + 7 + Math.random() * 11; }
    }
    warmLight.position.x = 2.1 + pointerEase.x * 0.7;
    warmLight.position.y = -1.1 - pointerEase.y * 0.5;

    if (!reduced && ++frameCount % 3 === 0 && coreGeometry && coreBasePositions) {
      const position = coreGeometry.attributes.position;
      for (let index = 0; index < position.count; index += 1) {
        const offset = index * 3;
        const bx = coreBasePositions[offset];
        const by = coreBasePositions[offset + 1];
        const bz = coreBasePositions[offset + 2];
        const pulse = 1 + Math.sin(seconds * 0.72 + bx * 2.4 + by * 3.1 + bz) * 0.022;
        position.array[offset] = bx * pulse;
        position.array[offset + 1] = by * pulse;
        position.array[offset + 2] = bz * pulse;
      }
      position.needsUpdate = true;
      coreGeometry.computeVertexNormals();
    }
    renderer.render(scene, camera);
  };

  const animate = (timestamp) => {
    if (!heroVisible || document.hidden || reduced || !renderer || contextLost) {
      loopRunning = false;
      return;
    }
    const delta = lastTime ? Math.min(250, timestamp - lastTime) : 16.67;
    lastTime = timestamp;
    const frameScale = Math.min(2, delta / 16.67);
    sceneTime += delta;
    updateScene(sceneTime, frameScale);
    if (!renderer) {
      scrollProgress += (targetScrollProgress - scrollProgress) * 0.07 * frameScale;
    }
    if (introProgress > 0.75) updateSkills(frameScale, sceneTime);
    rafId = window.requestAnimationFrame(animate);
  };

  const startLoop = () => {
    if (loopRunning || reduced || !heroVisible || document.hidden || !renderer || contextLost) return;
    loopRunning = true;
    lastTime = 0;
    rafId = window.requestAnimationFrame(animate);
  };

  const updatePointer = (event) => {
    if (reduced || !finePointer || window.innerWidth < 1024) return;
    const rect = universe.getBoundingClientRect();
    pointer.localX = event.clientX - rect.left;
    pointer.localY = event.clientY - rect.top;
    pointer.x = Math.max(-1, Math.min(1, (pointer.localX / rect.width) * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, (pointer.localY / rect.height) * 2 - 1));
    pointer.active = true;
  };

  hero.addEventListener('pointermove', updatePointer, { passive: true });
  hero.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.x = 0;
    pointer.y = 0;
  });
  const cta = hero.querySelector('.hero-cta');
  cta?.addEventListener('pointerenter', () => { ctaHovered = true; });
  cta?.addEventListener('pointerleave', () => { ctaHovered = false; });
  skillStates.forEach((state) => {
    const activate = () => {
      state.hovered = true;
      state.element.classList.add('is-hovered');
    };
    const deactivate = () => {
      state.hovered = false;
      state.element.classList.remove('is-hovered');
    };
    state.element.addEventListener('pointerenter', activate);
    state.element.addEventListener('pointerleave', deactivate);
    state.element.addEventListener('focus', activate);
    state.element.addEventListener('blur', deactivate);
  });

  window.addEventListener('hero-universe-progress', (event) => {
    targetScrollProgress = Math.max(0, Math.min(1, Number(event.detail?.progress) || 0));
  });
  window.addEventListener('portfolio-theme-change', (event) => {
    applyTheme(event.detail?.theme);
  });
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      measure(true);
      if (reduced || !renderer || contextLost) {
        settleStaticSkills();
        updateScene(sceneTime, 1);
      }
    }, 120);
  }, { passive: true });
  const syncVisibility = () => {
    hero.classList.toggle('is-motion-paused', document.hidden || !heroVisible);
    if (document.hidden || !heroVisible) { cancelAnimationFrame(rafId); loopRunning = false; }
    else startLoop();
  };
  document.addEventListener('visibilitychange', syncVisibility);

  const visibilityObserver = new IntersectionObserver((entries) => {
    heroVisible = entries[0]?.isIntersecting ?? true;
    syncVisibility();
  }, { threshold: 0.01 });
  visibilityObserver.observe(hero);
  motionQuery.addEventListener('change', (event) => {
    reduced = event.matches;
    particleMaterial && (particleMaterial.uniforms.uMotion.value = reduced ? 0 : 1);
    if (reduced) {
      cancelAnimationFrame(rafId); loopRunning = false;
      pointer.x = pointer.y = pointerEase.x = pointerEase.y = 0;
      targetScrollProgress = scrollProgress = 0;
      settleStaticSkills(); updateScene(sceneTime, 1);
    } else startLoop();
    universe.classList.toggle('is-static', reduced);
  });
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault(); contextLost = true;
    cancelAnimationFrame(rafId); loopRunning = false;
    universe.classList.remove('is-webgl-ready');
    universe.classList.add('is-webgl-fallback');
    settleStaticSkills();
  });
  canvas.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    lastNebulaTime = -Infinity;
    universe.classList.remove('is-webgl-fallback');
    universe.classList.add('is-webgl-ready');
    measure(true); updateScene(sceneTime, 1); startLoop();
  });

  measure(true);
  buildScene();
  if (reduced) {
    universe.classList.add('is-static');
    settleStaticSkills();
    renderer?.render(scene, camera);
  } else {
    startLoop();
  }

  window.addEventListener('pageshow', (event) => { if (event.persisted) syncVisibility(); });
  window.addEventListener('pagehide', (event) => {
    window.cancelAnimationFrame(rafId);
    loopRunning = false;
    if (event.persisted) return;
    visibilityObserver.disconnect();
    coreGeometry?.dispose();
    particleGeometry?.dispose();
    nebulaTarget?.dispose();
    nebulaCloudMaterial?.dispose();
    nebulaScene?.children.forEach(object => object.geometry?.dispose());
    scene?.traverse((object) => {
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose?.());
      }
      if (object.geometry && object.geometry !== coreGeometry && object.geometry !== particleGeometry) object.geometry.dispose?.();
    });
    renderer?.dispose();
  });
})();
