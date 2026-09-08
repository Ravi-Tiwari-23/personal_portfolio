(() => {
  const section = document.querySelector('.skills-section');
  if (!section) return;
  const hoverQuery = matchMedia('(hover: hover) and (pointer: fine)');
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  section.classList.add('skills-enhanced');
  const states = [];

  section.querySelectorAll('[data-skill-row]').forEach((row) => {
    const button = row.querySelector('.skill-toggle');
    const detail = row.querySelector('.skill-detail');
    let pinned = false;
    let hovered = false;
    const update = () => {
      const open = pinned || hovered;
      row.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      detail.setAttribute('aria-hidden', String(!open));
    };
    update();
    row.addEventListener('pointerenter', (event) => {
      if (hoverQuery.matches && event.pointerType !== 'touch') { hovered = true; update(); }
    });
    row.addEventListener('pointerleave', () => { hovered = false; update(); });
    button.addEventListener('click', () => { pinned = !pinned; if (!pinned) hovered = false; update(); });
    button.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { pinned = false; hovered = false; update(); }
    });
    states.push(() => { hovered = false; update(); });
    row.querySelectorAll('.skill-icon img').forEach((img) => {
      const fallback = () => { img.hidden = true; img.nextElementSibling.hidden = false; };
      img.addEventListener('error', fallback, { once: true });
      if (img.complete && img.naturalWidth === 0) fallback();
    });
  });
  hoverQuery.addEventListener('change', () => states.forEach(reset => reset()));

  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger) return; // Content and expansion work without animation libraries.
  gsap.registerPlugin(ScrollTrigger);
  gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
    const intro = gsap.timeline({ scrollTrigger: { trigger: '.skills-intro', start: 'top 86%', once: true } });
    intro.from('.skills-intro .section-number', { y: 12, opacity: 0, duration: .4 })
      .from('.skills-title .line-mask > span', { yPercent: 108, stagger: .08, duration: .65, ease: 'power3.out' }, '-=.15')
      .from('.skills-intro-copy, .skills-count', { opacity: 0, y: 12, duration: .4 }, '-=.25');
    const rows = section.querySelectorAll('[data-skill-row]');
    // Batch only the rows entering view; never hide all ten for a long sequence.
    gsap.set(rows, { opacity: 0, y: innerWidth < 600 ? 12 : 24 });
    const batches = ScrollTrigger.batch(rows, {
      start: 'top 96%', once: true, interval: .08, batchMax: 3,
      onEnter: batch => gsap.to(batch, { opacity: 1, y: 0, stagger: .08, duration: .5, ease: 'power2.out', clearProps: 'opacity,transform' }),
    });
    return () => {
      batches.forEach(trigger => trigger.kill());
      gsap.killTweensOf(rows);
      gsap.set(rows, { clearProps: 'opacity,transform' });
    };
  });
  // Layout settles after expansion; refresh positions without per-frame work.
  section.addEventListener('transitionend', event => {
    if (event.propertyName === 'grid-template-rows') ScrollTrigger.refresh();
  });
  section.addEventListener('click', () => { if (motionQuery.matches) ScrollTrigger.refresh(); });
})();
