(() => {
  const field = document.querySelector('.site-galaxy');
  const canvas = field?.querySelector('canvas');
  if (!canvas || location.pathname.startsWith('/admin')) return;
  const context = canvas.getContext('2d');
  if (!context) return; // CSS stars remain available.

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const pointerMedia = matchMedia('(pointer: fine)');
  const hero = document.querySelector('.hero');
  const ticker = window.gsap?.ticker;
  let width = 1, height = 1, ratio = 1;
  let stars = [], active = false, frame = 0, time = 0, lastFrame = 0;
  let scroll = window.scrollY, pointerX = 0, pointerY = 0, easedX = 0, easedY = 0;
  let shooting = null, nextShot = 7 + Math.random() * 11;
  let light = document.documentElement.dataset.theme === 'light';
  let resizeTimer;
  const colors = ['#ff5c35', '#ff6b35', '#ffb45c', '#ff5c35', '#ff3d1f', '#cde8ff', '#ffffff', '#ff6b35', '#8ac7ff', '#ff5c35'];
  const sprites = colors.map(color => {
    const sprite = document.createElement('canvas'); sprite.width = sprite.height = 32;
    const ctx = sprite.getContext('2d');
    const glow = ctx.createRadialGradient(16,16,0,16,16,16);
    glow.addColorStop(0, '#fff7ec'); glow.addColorStop(.09, color); glow.addColorStop(.22, `${color}99`); glow.addColorStop(1, `${color}00`);
    ctx.fillStyle = glow; ctx.fillRect(0,0,32,32);
    return sprite;
  });

  // Small procedural cloud tiles are generated once, then reused while drifting.
  const cloud = document.createElement('canvas'); cloud.width = 192; cloud.height = 128;
  const cloudContext = cloud.getContext('2d');
  const pixels = cloudContext.createImageData(cloud.width, cloud.height);
  const hash = (x,y) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
  const noise = (x,y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    let fx = x - ix, fy = y - iy; fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
    return (hash(ix,iy) * (1-fx) + hash(ix+1,iy) * fx) * (1-fy) + (hash(ix,iy+1) * (1-fx) + hash(ix+1,iy+1) * fx) * fy;
  };
  for (let y = 0; y < 128; y++) for (let x = 0; x < 192; x++) {
    let value = 0, amplitude = .5, frequency = .035;
    for (let octave = 0; octave < 4; octave++) { value += noise(x * frequency, y * frequency) * amplitude; amplitude *= .5; frequency *= 2.1; }
    const edge = Math.pow(Math.max(0, Math.sin(x / 191 * Math.PI) * Math.sin(y / 127 * Math.PI)), 1.6);
    const density = Math.max(0, value - .24) * edge;
    const i = (y * 192 + x) * 4;
    pixels.data[i] = 162 + value * 55; pixels.data[i+1] = 50 + value * 30; pixels.data[i+2] = 20 + value * 19;
    pixels.data[i+3] = Math.min(150, density * 190);
  }
  cloudContext.putImageData(pixels,0,0);

  const resize = () => {
    width = innerWidth; height = innerHeight; ratio = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    context.setTransform(ratio,0,0,ratio,0,0);
    const count = width < 768 ? 85 : width < 1024 ? 160 : Math.max(220, Math.min(320, Math.round(width * height / 4400)));
    stars = Array.from({length:count}, (_,i) => {
      const tier = (i * 37 % 100) / 100;
      return { x:(i * .61803398875 + Math.random() * .035) % 1, y:(i * .75487766625 + Math.random() * .035) % 1,
        layer:i % 3, size:tier < .65 ? 2.4 : tier < .9 ? 4.2 : 7, min:tier < .65 ? .22 : .35,
        max:tier < .65 ? .55 : .95, phase:Math.random() * Math.PI * 2, speed:Math.PI * 2 / (2.5 + Math.random() * 5.5), color:i % colors.length, flare:tier >= .95 };
    });
    draw(); sync();
  };

  const draw = () => {
    context.clearRect(0,0,width,height);
    if (!light) {
      context.globalAlpha = .64;
      const drift = motion.matches ? 0 : Math.sin(time * .025) * 18;
      context.drawImage(cloud, -width * .32 + drift + easedX * 3, -height * .28, width * 1.1, height * .9);
      context.globalAlpha = .5;
      context.drawImage(cloud, width * .34 - drift - easedX * 4, height * .35, width, height * .95);
      if (width >= 768) { context.globalAlpha = .22; context.drawImage(cloud, -width * .12, height * .6 + drift, width * .8, height * .7); }
    }
    stars.forEach((star, i) => {
      if (light && i % 4 !== 0) return;
      const twinkle = motion.matches ? .45 : .5 + .5 * Math.sin(time * star.speed + star.phase);
      const parallax = motion.matches || width < 1024 ? 0 : 3 + star.layer * 3;
      const drift = motion.matches ? 0 : Math.sin(time * .065 + star.phase) * (2 + star.layer * 2);
      const x = star.x * width + drift + easedX * parallax;
      const y = ((star.y * height - (motion.matches ? 0 : scroll * (.014 + star.layer * .012))) % height + height) % height + easedY * parallax;
      const size = star.size * (.8 + twinkle * .4);
      context.globalAlpha = (star.min + (star.max - star.min) * twinkle) * (light ? .7 : 1);
      if (light) { context.fillStyle = '#e84622'; context.beginPath(); context.arc(x,y,size * .13,0,Math.PI * 2); context.fill(); }
      else context.drawImage(sprites[star.color],x-size/2,y-size/2,size,size);
      if (!light && star.flare && twinkle > .88) {
        context.globalAlpha *= (twinkle - .88) / .12;
        context.strokeStyle = colors[star.color]; context.lineWidth = .65;
        context.beginPath(); context.moveTo(x-size*.7,y); context.lineTo(x+size*.7,y); context.moveTo(x,y-size*.7); context.lineTo(x,y+size*.7); context.stroke();
      }
    });
    if (!motion.matches && !light && width >= 1024) {
      if (!shooting && time >= nextShot) shooting = { start:time, duration:.7 + Math.random() * .7, x:width * (.45 + Math.random() * .45), y:height * (.05 + Math.random() * .25) };
      if (shooting) {
        const progress = (time - shooting.start) / shooting.duration;
        if (progress >= 1) { shooting = null; nextShot = time + 7 + Math.random() * 11; }
        else {
          const x = shooting.x - progress * width * .23, y = shooting.y + progress * height * .25;
          const trail = context.createLinearGradient(x,y,x+55,y-35); trail.addColorStop(0,'#fff0d5'); trail.addColorStop(1,'#ff5c3500');
          context.globalAlpha = Math.sin(progress * Math.PI) * .8; context.strokeStyle = trail; context.lineWidth = 1;
          context.beginPath(); context.moveTo(x,y); context.lineTo(x+55,y-35); context.stroke();
        }
      }
    }
    context.globalAlpha = 1;
  };

  const tick = () => {
    if (!active || document.hidden || motion.matches) return;
    const now = performance.now();
    if (now - lastFrame >= 32) {
      time += Math.min(.1, (now - lastFrame) / 1000); lastFrame = now;
      easedX += (pointerX - easedX) * .075; easedY += (pointerY - easedY) * .075;
      draw();
    }
    if (!ticker && active) frame = requestAnimationFrame(tick);
  };
  function sync() {
    // The hero already owns its WebGL galaxy; activate this field as it leaves.
    const covered = hero && hero.getBoundingClientRect().bottom >= height;
    const shouldRun = !document.hidden && !motion.matches && !covered;
    document.body.classList.toggle('galaxy-paused', document.hidden);
    if (shouldRun !== active) {
      active = shouldRun; lastFrame = performance.now();
      if (active) { if (ticker) ticker.add(tick); else frame = requestAnimationFrame(tick); }
      else { ticker?.remove(tick); cancelAnimationFrame(frame); }
    }
  }
  addEventListener('scroll', () => { scroll = scrollY; sync(); }, {passive:true});
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize,120); }, {passive:true});
  addEventListener('pointermove', event => {
    if (!pointerMedia.matches || motion.matches || width < 1024) return;
    pointerX = event.clientX / width * 2 - 1; pointerY = event.clientY / height * 2 - 1;
  }, {passive:true});
  document.addEventListener('visibilitychange',sync);
  motion.addEventListener('change',() => { shooting = null; draw(); sync(); });
  addEventListener('portfolio-theme-change', event => { light = event.detail?.theme === 'light'; shooting = null; draw(); });
  addEventListener('pagehide', () => { ticker?.remove(tick); cancelAnimationFrame(frame); active = false; });
  addEventListener('pageshow',sync);

  const headings = document.querySelectorAll('main h1:not(.hero-name), .chapter-heading, .footer-name p');
  const headingObserver = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
    entries.forEach(entry => entry.target.classList.toggle('is-in-view',entry.isIntersecting));
  }) : null;
  headings.forEach((heading,i) => { heading.classList.add('cosmic-heading'); heading.style.animationDelay = `${-(i % 5) * 2.3}s`; headingObserver?.observe(heading); });
  resize(); field.classList.add('is-ready');
})();
