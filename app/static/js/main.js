(() => {
  if (window.location.pathname.startsWith('/admin')) return;

  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduced = motionQuery.matches;
  const finePointer = window.matchMedia('(pointer: fine)').matches && window.innerWidth >= 768;
  const gsap = window.gsap;
  const ScrollTrigger = window.ScrollTrigger;
  const themeKey = 'portfolio-theme';
  motionQuery.addEventListener('change', (event) => {
    reduced = event.matches;
    if (reduced) {
      document.body.classList.remove('cursor-ready');
      gsap?.killTweensOf('.cursor-ring');
    }
  });

  const setTheme = (theme, persist = true) => {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    document.documentElement.dataset.theme = nextTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'light' ? '#f4f1ea' : '#0b0b0b');
    document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
      const isLight = nextTheme === 'light';
      button.setAttribute('aria-label', `Switch to ${isLight ? 'dark' : 'light'} theme`);
      button.setAttribute('aria-pressed', String(isLight));
      const label = button.querySelector('[data-theme-label]');
      if (label) label.textContent = `${isLight ? 'Light' : 'Dark'} mode active`;
    });
    if (persist) {
      try { localStorage.setItem(themeKey, nextTheme); } catch (error) { /* Theme still applies for this visit. */ }
    }
    window.dispatchEvent(new CustomEvent('portfolio-theme-change', { detail: { theme: nextTheme } }));
  };

  setTheme(document.documentElement.dataset.theme, false);
  document.querySelectorAll('[data-theme-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      setTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light');
    });
  });

  window.addEventListener('load', () => {
    window.setTimeout(() => document.body.classList.add('loaded'), reduced ? 0 : 350);
  });

  const revealItems = document.querySelectorAll('[data-reveal]');
  if (reduced || !('IntersectionObserver' in window)) {
    revealItems.forEach((item) => item.classList.add('revealed'));
  } else if (revealItems.length) {
    document.body.classList.add('motion-ready');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach((item, index) => {
      item.style.transitionDelay = `${Math.min(index % 4, 3) * 70}ms`;
      observer.observe(item);
    });
  }

  if (gsap && ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {

    document.querySelectorAll('.chapter-heading').forEach((heading) => {
      const lines = heading.querySelectorAll('.line-mask > span');
      if (!lines.length) return;
      gsap.from(lines, {
        yPercent: 112,
        duration: 1.05,
        stagger: 0.1,
        ease: 'power4.out',
        scrollTrigger: { trigger: heading, start: 'top 84%', once: true },
      });
    });

    if (document.body.classList.contains('home-page')) {
      const heroTimeline = gsap.timeline({ delay: 0.28, defaults: { ease: 'power4.out' } });
      heroTimeline
        .from('.hero-intro', { y: 22, opacity: 0, duration: 0.7 })
        .from('.hero-name .hero-line:not(.outline)', { yPercent: 112, duration: 1.05 }, '-=0.3')
        .call(() => document.querySelector('.hero-name')?.classList.add('is-illuminated'), [], '-=0.45')
        .from('.hero-name .hero-line.outline', { yPercent: 110, opacity: 0, duration: 0.95 }, '-=0.45')
        .from('.hero-skill', { opacity: 0, duration: 0.52, stagger: 0.055, clearProps: 'opacity' }, '-=0.48')
        .from('.hero-copy > *', { y: 24, opacity: 0, duration: 0.65, stagger: 0.1 }, '-=0.42')
        .from('.hero-cta', { scale: 0.72, opacity: 0, duration: 0.75 }, '-=0.5')
        .from('.scroll-note', { x: -18, opacity: 0, duration: 0.55 }, '-=0.4');

      const heroScroll = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: '.hero',
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
          onUpdate: (self) => window.dispatchEvent(new CustomEvent('hero-universe-progress', { detail: { progress: self.progress } })),
        },
      });
      heroScroll
        .to('.hero-name > .line-mask:first-child', { y: -64 }, 0)
        .to('.hero-name > .line-mask.hero-line-indent', { y: -38 }, 0)
        .to('.hero-name-sparkles', { y: -50, opacity: 0.2 }, 0)
        .to('.hero-copy', { y: -58, opacity: 0.34 }, 0)
        .to('.hero-top', { y: -30, opacity: 0.35 }, 0)
        .to('.hero-cta', { y: -90, scale: 0.86 }, 0)
        .to('.hero-universe', { y: -22 }, 0)
        .fromTo('.intro-band', { y: 70 }, { y: 0 }, 0.52);

      gsap.from('.about-declaration', {
        y: 60,
        opacity: 0,
        duration: 0.95,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.about-declaration', start: 'top 82%', once: true },
      });
      gsap.from('.intro-detail > *, .about-keywords span', {
        y: 28,
        opacity: 0,
        duration: 0.72,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.intro-detail', start: 'top 84%', once: true },
      });

      gsap.from('.skill-row', {
        y: 46,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.skill-list', start: 'top 78%', once: true },
      });

      document.querySelectorAll('.exposure-item').forEach((item) => {
        gsap.from(item.children, {
          y: 42,
          opacity: 0,
          duration: 0.85,
          stagger: 0.08,
          ease: 'power3.out',
          scrollTrigger: { trigger: item, start: 'top 82%', once: true },
        });
      });

      gsap.fromTo('.project-intro .chapter-heading',
        { scale: 1.06, transformOrigin: 'left bottom' },
        {
          y: -55,
          scale: 0.96,
          ease: 'none',
          scrollTrigger: { trigger: '.project-intro', start: 'top 25%', end: 'bottom 20%', scrub: 1 },
        });

      const panels = gsap.utils.toArray('.project-stack .project-panel');
      const current = document.querySelector('[data-project-current]');
      panels.forEach((panel, index) => {
        const title = panel.querySelector('.project-copy h3 span');
        const meta = panel.querySelectorAll('.project-meta, .project-copy > p, .project-copy ul, .project-visual, .project-cta');
        if (title) {
          gsap.from(title, {
            yPercent: 110,
            duration: 0.9,
            ease: 'power4.out',
            scrollTrigger: { trigger: panel, start: 'top 76%', once: true },
          });
        }
        gsap.from(meta, {
          y: 30,
          opacity: 0,
          duration: 0.72,
          stagger: 0.07,
          ease: 'power3.out',
          scrollTrigger: { trigger: panel, start: 'top 74%', once: true },
        });
        const image = panel.querySelector('.project-visual img');
        if (image) {
          gsap.fromTo(image, { scale: 1.08, yPercent: -2 }, {
            scale: 1,
            yPercent: 3,
            ease: 'none',
            scrollTrigger: { trigger: panel, start: 'top bottom', end: 'bottom top', scrub: 1 },
          });
        }
        ScrollTrigger.create({
          trigger: panel,
          start: 'top 45%',
          end: 'bottom 45%',
          onEnter: () => { if (current) current.textContent = String(index + 1).padStart(2, '0'); },
          onEnterBack: () => { if (current) current.textContent = String(index + 1).padStart(2, '0'); },
        });
        if (panels[index + 1]) {
          gsap.to(panel, {
            scale: 0.96,
            y: -14,
            opacity: 0.62,
            ease: 'none',
            scrollTrigger: { trigger: panels[index + 1], start: 'top 94%', end: 'top 8%', scrub: 1 },
          });
        }
      });

      gsap.from('.home-contact h2 .line-mask > span', {
        yPercent: 112,
        duration: 0.95,
        stagger: 0.11,
        ease: 'power4.out',
        scrollTrigger: { trigger: '.home-contact h2', start: 'top 82%', once: true },
      });
      gsap.from('.home-contact p, .contact-actions > *', {
        y: 28,
        opacity: 0,
        duration: 0.65,
        stagger: 0.08,
        ease: 'power3.out',
        scrollTrigger: { trigger: '.contact-actions', start: 'top 88%', once: true },
      });

      gsap.matchMedia().add('(min-width: 1024px)', () => {
        gsap.to('.about-content .chapter-heading', {
          y: -45,
          ease: 'none',
          scrollTrigger: { trigger: '.intro-band', start: 'top bottom', end: 'bottom top', scrub: 1 },
        });
        gsap.to('.intro-detail', {
          y: -18,
          ease: 'none',
          scrollTrigger: { trigger: '.intro-band', start: 'top 70%', end: 'bottom top', scrub: 1 },
        });
      });
    }

    const footer = document.querySelector('[data-footer]');
    if (footer) {
      const footerTimeline = gsap.timeline({
        defaults: { duration: 0.7, ease: 'power3.out' },
        scrollTrigger: { trigger: footer, start: 'top 88%', once: true },
      });
      footerTimeline
        .from('[data-footer-name] p', { yPercent: 105, opacity: 0, duration: 0.85 })
        .from('[data-footer-name] span', { y: 18, opacity: 0 }, '-=0.48')
        .from('.footer-divider', { scaleX: 0, duration: 0.75 }, '-=0.38')
        .from('.footer-lead', { y: 22, opacity: 0 }, '-=0.3')
        .from('.footer-links', { y: 18, opacity: 0, stagger: 0.1 }, '-=0.48')
        .from('.footer-bottom > *', { y: 12, opacity: 0, stagger: 0.08, duration: 0.5 }, '-=0.28');
    }
    });
  }

  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('.mobile-menu');
  const closeMenu = () => {
    if (!menuButton || !menu) return;
    menuButton.setAttribute('aria-expanded', 'false');
    menuButton.setAttribute('aria-label', 'Open navigation');
    menuButton.querySelector('span').textContent = 'Menu';
    menu.setAttribute('aria-hidden', 'true');
    menu.classList.remove('open');
    document.body.classList.remove('menu-open');
  };
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menuButton.querySelector('span').textContent = open ? 'Close' : 'Menu';
    menu.setAttribute('aria-hidden', String(!open));
    menu.classList.toggle('open', open);
    document.body.classList.toggle('menu-open', open);
  });
  menu?.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMenu));
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeMenu(); });

  document.querySelector('.back-to-top')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' }));
  document.querySelectorAll('.flash button').forEach((button) => button.addEventListener('click', () => button.parentElement.remove()));

  const filters = document.querySelectorAll('[data-filter]');
  const projects = document.querySelectorAll('.project-row[data-category]');
  filters.forEach((filter) => filter.addEventListener('click', () => {
    filters.forEach((item) => item.classList.remove('active'));
    filter.classList.add('active');
    projects.forEach((project) => project.classList.toggle('hidden', filter.dataset.filter !== 'all' && project.dataset.category !== filter.dataset.filter));
  }));

  const time = document.querySelector('#local-time');
  const updateTime = () => {
    if (!time) return;
    time.textContent = `IST — ${new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())}`;
  };
  updateTime();
  if (time) window.setInterval(updateTime, 30000);

  if (finePointer && !reduced) {
    const dot = document.querySelector('.cursor-dot');
    const ring = document.querySelector('.cursor-ring');
    const label = ring?.querySelector('.cursor-label');
    if (dot && ring && label) {
      let mouseX = -100;
      let mouseY = -100;
      let started = false;

      const setCursorTheme = (target) => {
        const sectionTheme = target?.closest?.('[data-cursor-theme]')?.dataset.cursorTheme;
        const theme = sectionTheme === 'light' || sectionTheme === 'dark'
          ? sectionTheme
          : document.documentElement.dataset.theme;
        [dot, ring].forEach((part) => {
          part.classList.toggle('cursor--on-light', theme === 'light');
          part.classList.toggle('cursor--on-dark', theme === 'dark');
        });
      };

      document.addEventListener('pointermove', (event) => {
        if (reduced) return;
        mouseX = event.clientX;
        mouseY = event.clientY;
        setCursorTheme(event.target);
        if (!started) {
          started = true;
          document.body.classList.add('cursor-ready');
        }
      }, { passive: true });

      // Reuse GSAP's existing ticker for cursor easing instead of another RAF loop.
      document.addEventListener('pointermove', () => {
        if (reduced) return;
        document.body.classList.add('cursor-ready');
        dot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
        if (gsap) gsap.to(ring, { x: mouseX, y: mouseY, duration: 0.22, ease: 'power2.out', overwrite: true });
        else ring.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0)`;
      }, { passive: true });

      document.querySelectorAll('a, button, [data-cursor]').forEach((item) => {
        item.addEventListener('pointerenter', () => {
          dot.classList.add('cursor--interactive');
          ring.classList.add('cursor--interactive');
          label.textContent = item.dataset.cursor || '';
        });
        item.addEventListener('pointerleave', () => {
          dot.classList.remove('cursor--interactive');
          ring.classList.remove('cursor--interactive');
          label.textContent = '';
        });
      });

      document.querySelectorAll('[data-hero-skill]').forEach((item) => {
        item.addEventListener('pointerenter', () => {
          dot.classList.add('cursor--skill');
          ring.classList.add('cursor--skill');
        });
        item.addEventListener('pointerleave', () => {
          dot.classList.remove('cursor--skill');
          ring.classList.remove('cursor--skill');
        });
      });

      document.querySelectorAll('[data-magnetic]').forEach((item) => {
        item.addEventListener('pointermove', (event) => {
          if (reduced) return;
          const box = item.getBoundingClientRect();
          const x = (event.clientX - box.left - box.width / 2) * 0.1;
          const y = (event.clientY - box.top - box.height / 2) * 0.1;
          item.style.translate = `${x}px ${y}px`;
        });
        item.addEventListener('pointerleave', () => { item.style.translate = ''; });
      });
    }
  }

  document.querySelectorAll('a[href]').forEach((link) => {
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || link.target === '_blank' || url.hash || link.hasAttribute('download') || reduced) return;
    link.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      document.body.classList.add('is-transitioning');
      window.setTimeout(() => { window.location.href = link.href; }, 340);
    });
  });
})();
