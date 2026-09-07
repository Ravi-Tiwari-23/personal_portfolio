import * as THREE from './vendor/three.module.min.js';

(() => {
  const universe = document.querySelector('[data-hero-universe]');
  const hero = document.querySelector('.hero');
  const canvas = universe?.querySelector('.hero-orb-canvas');
  const skillElements = universe ? [...universe.querySelectorAll('[data-hero-skill]')] : [];
  if (!universe || !hero || !canvas || !skillElements.length) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches;
  const pointer = { x: 0, y: 0, localX: 0, localY: 0, active: false };
  const pointerEase = { x: 0, y: 0 };
  const skillStates = skillElements.map((element, index) => ({
    element,
    index,
    angle: (index / skillElements.length) * Math.PI * 2 + (index % 3) * 0.18,
    speed: (0.00078 + (index % 5) * 0.00013) * (index % 3 === 0 ? -1 : 1),
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
  let fieldStartedAt = performance.now();
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
  const orbitMaterials = [];

  const visibleStates = () => skillStates.filter((state) => state.active);

  const measure = (placeImmediately = false) => {
    const rect = universe.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    centerX = width * (window.innerWidth < 768 ? 0.57 : 0.65);
    centerY = height * 0.5;

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
      }
    });

    if (renderer && camera) {
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.position.z = window.innerWidth < 768 ? 5.4 * Math.max(1, 0.82 / camera.aspect) : 5.4;
      camera.updateProjectionMatrix();
      if (sceneGroup) {
        const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) * camera.position.z;
        const viewWidth = viewHeight * camera.aspect;
        sceneGroup.position.x = ((centerX / width) * 2 - 1) * viewWidth * 0.5;
      }
    }
  };

  const applyTheme = (theme = document.documentElement.dataset.theme) => {
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
      particleMaterial.uniforms.uThemeOpacity.value = light ? 0.36 : 1;
      particleMaterial.uniforms.uLightMode.value = light ? 1 : 0;
      particleMaterial.blending = light ? THREE.NormalBlending : THREE.AdditiveBlending;
      particleMaterial.needsUpdate = true;
    }
    if (ambientLight) ambientLight.intensity = light ? 1.35 : 1.05;
    if (keyLight) keyLight.intensity = light ? 4.2 : 3.5;
    if (warmLight) warmLight.intensity = light ? 6.5 : 10;
    renderer.render(scene, camera);
  };

  const buildScene = () => {
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setClearColor(0x000000, 0);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.3;

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(33, width / height, 0.1, 100);
      camera.position.set(0, 0, 5.4);

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
      const wireMesh = new THREE.Mesh(coreGeometry.clone(), wireMaterial);
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
          index === 1 ? orbitMaterial.clone() : orbitMaterial,
        );
        ring.rotation.set(x, y, z);
        if (index === 1) {
          ring.material.color.set(0xff5c35);
          ring.material.opacity = 0.18;
        }
        orbitMaterials.push(ring.material);
        sceneGroup.add(ring);
      });

      // Keep the star field dense at every viewport size without creating
      // thousands of DOM nodes (the whole field is still one GPU draw call).
      const areaCount = Math.round((width * height) / 4000);
      const particleCount = window.innerWidth < 768
        ? Math.max(72, Math.min(96, areaCount))
        : window.innerWidth < 1024
          ? Math.max(135, Math.min(190, areaCount))
          : Math.max(260, Math.min(340, areaCount));
      const particlePositions = new Float32Array(particleCount * 3);
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
        const nearOrb = index % 9 === 0;
        if (nearOrb) {
          nx = 0.54 + Math.random() * 0.4;
          ny = 0.18 + Math.random() * 0.65;
        }

        const initiallyBehindType = nx < 0.62 && ny > 0.2 && ny < 0.72;
        // Move only some stars away from the headline. The remainder stay
        // faint behind the type so the complete black canvas still feels full.
        if (initiallyBehindType && index % 4 === 0) {
          nx = index % 2 === 0 ? 0.65 + Math.random() * 0.31 : nx;
          ny = index % 2 === 0 ? ny : (index % 4 === 1 ? Math.random() * 0.18 : 0.75 + Math.random() * 0.21);
        }

        const layerRoll = ((index * 47) % 100) / 100;
        const layer = layerRoll < 0.58 ? 0 : layerRoll < 0.9 ? 1 : 2;
        const layerDepth = Math.random();
        const z = layer === 0
          ? -1.35 + layerDepth * 0.72
          : layer === 1
            ? -0.5 + layerDepth * 0.82
            : 0.42 + layerDepth * 0.68;
        const brightnessRoll = ((index * 37) % 100) / 100;
        const brightness = brightnessRoll < 0.7 ? 0 : brightnessRoll < 0.9 ? 1 : 2;
        const protectedText = nx < 0.62 && ny > 0.2 && ny < 0.72;
        const protectedCta = nx > 0.76 && ny > 0.7;
        const protectedScrollLabel = nx < 0.1 && ny > 0.55;
        const protectedNav = ny < 0.1;
        const quietZone = protectedText || protectedCta || protectedScrollLabel || protectedNav;
        const quietMultiplier = quietZone ? 0.44 : nearOrb ? 1.1 : 1;
        const sizeRanges = [[1.8, 2.8], [2.8, 4.2], [4.2, 6.4]];
        const alphaRanges = [[0.24, 0.36, 0.56, 0.76], [0.34, 0.48, 0.7, 0.92], [0.48, 0.64, 0.92, 1]];
        const sizeRange = sizeRanges[layer];
        const alphaRange = alphaRanges[brightness];
        const duration = 2.5 + Math.random() * 4.5;
        particleSizes[index] = (sizeRange[0] + Math.random() * (sizeRange[1] - sizeRange[0])) * (window.innerWidth < 768 ? 0.86 : 1);
        particleMinAlphas[index] = (alphaRange[0] + Math.random() * (alphaRange[1] - alphaRange[0])) * quietMultiplier;
        particleMaxAlphas[index] = (alphaRange[2] + Math.random() * (alphaRange[3] - alphaRange[2])) * quietMultiplier;
        particlePhases[index] = Math.random() * Math.PI * 2;
        particleTwinkleSpeeds[index] = (Math.PI * 2) / duration;
        particleBursts[index] = brightness === 2 && index % 2 === 0 ? 1 : 0;
        particleLightVisibility[index] = index % 10 < 7 ? 1 : 0;
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
          void main() {
            float primaryWave = 0.5 + 0.5 * sin(uTime * aTwinkleSpeed + aPhase);
            float shimmerWave = 0.5 + 0.5 * sin(uTime * aTwinkleSpeed * 0.43 + aPhase * 1.71);
            float animatedTwinkle = smoothstep(0.06, 0.94, primaryWave) * mix(0.72, 1.0, shimmerWave);
            float twinkle = mix(0.38, animatedTwinkle, uMotion);
            float twinkleScale = mix(0.78, 1.28, twinkle);
            float themeVisibility = mix(1.0, aLightVisibility, uLightMode);
            vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
            gl_Position = projectionMatrix * viewPosition;
            gl_PointSize = aSize * uPixelRatio * 2.05 * twinkleScale * (5.0 / max(1.0, -viewPosition.z));
            vAlpha = mix(aMinAlpha, aMaxAlpha, twinkle) * themeVisibility * uThemeOpacity * uScrollFade * uIntroFade;
            vBurst = aBurst;
          }
        `,
        fragmentShader: `
          uniform vec3 uColor;
          varying float vAlpha;
          varying float vBurst;
          void main() {
            vec2 point = gl_PointCoord - vec2(0.5);
            float radius = length(point);
            float core = 1.0 - smoothstep(0.08, 0.42, radius);
            float glow = 1.0 - smoothstep(0.18, 0.5, radius);
            float horizontal = (1.0 - smoothstep(0.0, 0.065, abs(point.y))) * (1.0 - smoothstep(0.14, 0.5, abs(point.x)));
            float vertical = (1.0 - smoothstep(0.0, 0.065, abs(point.x))) * (1.0 - smoothstep(0.14, 0.5, abs(point.y)));
            float starburst = max(horizontal, vertical) * vBurst * 0.28;
            float shape = max(core, glow * 0.28 + starburst);
            if (shape <= 0.01) discard;
            gl_FragColor = vec4(uColor, vAlpha * shape);
          }
        `,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        blending: THREE.AdditiveBlending,
      });
      particleCloud = new THREE.Points(
        particleGeometry,
        particleMaterial,
      );
      particleCloud.frustumCulled = false;
      scene.add(particleCloud);
      fieldStartedAt = performance.now();

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
      updateScene(0, 1);
      universe.classList.add('is-webgl-ready');
    } catch {
      universe.classList.add('is-webgl-fallback');
      renderer = null;
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
    state.element.style.filter = !state.hovered && depth < 0.23 ? 'blur(.45px)' : 'none';
    state.element.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) scale(var(--skill-scale)) rotate(var(--skill-tilt))`;
  };

  const settleStaticSkills = () => {
    const states = visibleStates();
    states.forEach((state, index) => {
      const angle = (index / states.length) * Math.PI * 2 - Math.PI / 2;
      const rx = width * (window.innerWidth < 768 ? 0.34 : 0.31);
      const ry = height * (window.innerWidth < 768 ? 0.32 : 0.28);
      state.x = centerX + Math.cos(angle) * rx;
      state.y = centerY + Math.sin(angle) * ry;
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
    sceneGroup.rotation.y = seconds * 0.04 + pointerEase.x * 0.12 + scrollProgress * 0.22;
    sceneGroup.rotation.x = Math.sin(seconds * 0.16) * 0.04 - pointerEase.y * 0.075 + scrollProgress * 0.055;
    sceneGroup.rotation.z = Math.sin(seconds * 0.1) * 0.018;
    const baseOrbScale = window.innerWidth < 768 ? 0.62 : 0.75;
    sceneGroup.scale.setScalar(baseOrbScale + scrollProgress * 0.03);
    coreMesh.rotation.y += 0.00082 * frameScale;
    coreMesh.rotation.x += 0.00024 * frameScale;
    coreMesh.position.y = Math.sin(seconds * 0.42) * 0.035;

    if (particleCloud && particleGeometry && particleData.length) {
      const position = particleGeometry.attributes.position;
      const perspective = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
      const fieldSeconds = Math.max(0, (elapsed - fieldStartedAt) * 0.001);
      particleData.forEach((particle, index) => {
        const distance = camera.position.z - particle.z;
        const viewHeight = 2 * perspective * distance;
        const viewWidth = viewHeight * camera.aspect;
        const expansion = 1 + scrollProgress * (0.018 + particle.layer * 0.014);
        const pointerRange = finePointer ? 0.006 + particle.layer * 0.012 : 0;
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
      });
      position.needsUpdate = true;
      particleMaterial.uniforms.uTime.value = fieldSeconds;
      particleMaterial.uniforms.uIntroFade.value = reduced ? 1 : 0.1 + Math.min(1, fieldSeconds / 1.8) * 0.9;
      particleMaterial.uniforms.uScrollFade.value = Math.max(0.04, 1 - scrollProgress * 0.96);
    }
    warmLight.position.x = 2.1 + pointerEase.x * 0.7;
    warmLight.position.y = -1.1 - pointerEase.y * 0.5;

    if (++frameCount % 3 === 0 && coreGeometry && coreBasePositions) {
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
    if (!heroVisible || document.hidden || reduced) {
      loopRunning = false;
      return;
    }
    const delta = lastTime ? Math.min(32, timestamp - lastTime) : 16.67;
    lastTime = timestamp;
    const frameScale = delta / 16.67;
    updateScene(timestamp, frameScale);
    if (!renderer) {
      scrollProgress += (targetScrollProgress - scrollProgress) * 0.07 * frameScale;
    }
    updateSkills(frameScale, timestamp);
    rafId = window.requestAnimationFrame(animate);
  };

  const startLoop = () => {
    if (loopRunning || reduced || !heroVisible || document.hidden) return;
    loopRunning = true;
    lastTime = 0;
    rafId = window.requestAnimationFrame(animate);
  };

  const updatePointer = (event) => {
    if (!finePointer || window.innerWidth < 768) return;
    const rect = universe.getBoundingClientRect();
    pointer.localX = event.clientX - rect.left;
    pointer.localY = event.clientY - rect.top;
    pointer.x = Math.max(-1, Math.min(1, (pointer.localX / rect.width) * 2 - 1));
    pointer.y = Math.max(-1, Math.min(1, (pointer.localY / rect.height) * 2 - 1));
    pointer.active = true;
  };

  universe.addEventListener('pointermove', updatePointer, { passive: true });
  universe.addEventListener('pointerleave', () => {
    pointer.active = false;
    pointer.x = 0;
    pointer.y = 0;
  });
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
      if (reduced) {
        settleStaticSkills();
        renderer?.render(scene, camera);
      }
    }, 120);
  }, { passive: true });
  document.addEventListener('visibilitychange', startLoop);

  const visibilityObserver = new IntersectionObserver((entries) => {
    heroVisible = entries[0]?.isIntersecting ?? true;
    if (heroVisible) startLoop();
  }, { threshold: 0.01 });
  visibilityObserver.observe(hero);

  measure(true);
  buildScene();
  if (reduced) {
    universe.classList.add('is-static');
    settleStaticSkills();
    renderer?.render(scene, camera);
  } else {
    startLoop();
  }

  window.addEventListener('pagehide', () => {
    window.cancelAnimationFrame(rafId);
    visibilityObserver.disconnect();
    coreGeometry?.dispose();
    particleGeometry?.dispose();
    scene?.traverse((object) => {
      if (object.material) {
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        materials.forEach((material) => material.dispose?.());
      }
      if (object.geometry && object.geometry !== coreGeometry && object.geometry !== particleGeometry) object.geometry.dispose?.();
    });
    renderer?.dispose();
  }, { once: true });
})();
