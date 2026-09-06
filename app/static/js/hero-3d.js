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
    speed: (0.00145 + (index % 5) * 0.00023) * (index % 3 === 0 ? -1 : 1),
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
  let renderer = null;
  let scene = null;
  let camera = null;
  let sceneGroup = null;
  let coreMesh = null;
  let coreGeometry = null;
  let coreBasePositions = null;
  let particleGeometry = null;
  let particleCloud = null;
  let warmLight = null;

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
      camera.updateProjectionMatrix();
    }
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
      sceneGroup.position.x = window.innerWidth < 768 ? 0.82 : 0.48;
      scene.add(sceneGroup);

      coreGeometry = new THREE.IcosahedronGeometry(1.02, window.innerWidth < 768 ? 2 : 3);
      coreBasePositions = Float32Array.from(coreGeometry.attributes.position.array);
      const coreMaterial = new THREE.MeshStandardMaterial({
        color: 0x38302d,
        roughness: 0.38,
        metalness: 0.68,
        flatShading: true,
      });
      coreMesh = new THREE.Mesh(coreGeometry, coreMaterial);
      sceneGroup.add(coreMesh);

      const wireMaterial = new THREE.MeshBasicMaterial({
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
        sceneGroup.add(ring);
      });

      const particleCount = window.innerWidth < 768 ? 18 : 42;
      const particlePositions = new Float32Array(particleCount * 3);
      for (let index = 0; index < particleCount; index += 1) {
        const radius = 1.4 + Math.random() * 1.25;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        particlePositions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
        particlePositions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        particlePositions[index * 3 + 2] = radius * Math.cos(phi);
      }
      particleGeometry = new THREE.BufferGeometry();
      particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      particleCloud = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
          color: 0xff7657,
          size: window.innerWidth < 768 ? 0.018 : 0.025,
          transparent: true,
          opacity: 0.68,
          depthWrite: false,
        }),
      );
      sceneGroup.add(particleCloud);

      scene.add(new THREE.AmbientLight(0xf5f3ed, 1.05));
      const keyLight = new THREE.DirectionalLight(0xfff4ed, 3.5);
      keyLight.position.set(-2.3, 2.4, 3.8);
      scene.add(keyLight);
      warmLight = new THREE.PointLight(0xff5c35, 10, 8, 1.6);
      warmLight.position.set(2.1, -1.1, 3.1);
      scene.add(warmLight);

      measure(true);
      renderer.render(scene, camera);
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
    const speedBoost = 1 + scrollProgress * (mobile ? 0.35 : 1.6);
    const expansion = 1 + scrollProgress * 0.1;

    states.forEach((state) => {
      const hoverSpeed = state.hovered ? 0.1 : 1;
      state.angle += state.speed * frameScale * 16.67 * speedBoost * hoverSpeed;
      const rx = width * (mobile ? 0.265 + (state.index % 4) * 0.017 : 0.215 + (state.index % 4) * 0.015) * expansion;
      const ry = height * (0.235 + (state.index % 3) * 0.022) * expansion;
      const orbitWarp = Math.sin(state.angle * 1.8 + state.phase) * (mobile ? 4 : 11);
      const targetX = centerX + Math.cos(state.angle) * rx;
      const targetY = centerY + Math.sin(state.angle + state.plane * 0.08) * ry + orbitWarp;
      const spring = mobile ? 0.028 : 0.018;
      state.vx += (targetX - state.x) * spring * frameScale;
      state.vy += (targetY - state.y) * spring * frameScale;

      if (!mobile && finePointer && pointer.active) {
        const dx = state.x - pointer.localX;
        const dy = state.y - pointer.localY;
        const distance = Math.hypot(dx, dy) || 1;
        const reach = state.hovered ? 72 : 112;
        if (distance < reach) {
          const force = (reach - distance) * (state.hovered ? 0.001 : 0.006);
          state.vx += (dx / distance) * force * frameScale;
          state.vy += (dy / distance) * force * frameScale;
        }
      }
      state.vx *= Math.pow(0.91, frameScale);
      state.vy *= Math.pow(0.91, frameScale);
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
            const force = (minimum - distance) * 0.006;
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
      if (safeX !== state.x) state.vx *= -0.42;
      if (safeY !== state.y) state.vy *= -0.42;
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
    sceneGroup.rotation.y = seconds * 0.075 + pointerEase.x * 0.18 + scrollProgress * 0.72;
    sceneGroup.rotation.x = Math.sin(seconds * 0.21) * 0.055 - pointerEase.y * 0.11 + scrollProgress * 0.12;
    sceneGroup.rotation.z = Math.sin(seconds * 0.13) * 0.025;
    sceneGroup.scale.setScalar(1 + scrollProgress * 0.075);
    coreMesh.rotation.y += 0.0015 * frameScale;
    coreMesh.rotation.x += 0.00045 * frameScale;
    coreMesh.position.y = Math.sin(seconds * 0.62) * 0.045;
    particleCloud.rotation.y -= 0.0007 * frameScale;
    particleCloud.rotation.z += 0.00035 * frameScale;
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
