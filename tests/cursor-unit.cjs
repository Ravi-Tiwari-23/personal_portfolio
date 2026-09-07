/* Event-level cursor tests, with no browser or external services required. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function target() {
  const handlers = new Map();
  const classes = new Set();
  return {
    dataset: {}, style: {}, textContent: '',
    classList: {
      add: (...names) => names.forEach(name => classes.add(name)),
      remove: (...names) => names.forEach(name => classes.delete(name)),
      contains: name => classes.has(name),
      toggle(name, force) { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); },
    },
    addEventListener(name, handler) { handlers.set(name, [...(handlers.get(name) || []), handler]); },
    dispatchEvent(event) { for (const handler of handlers.get(event.type) || []) handler(event); },
    closest: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    setAttribute() {},
  };
}

for (const initialReduced of [false, true]) {
  const document = target();
  document.body = target();
  document.body.classList.add('galaxy-site');
  document.documentElement = target();
  document.documentElement.dataset.theme = 'dark';
  const ring = target(), dot = target(), label = target(), orbit = target();
  ring.querySelector = selector => ({ '.cursor-label': label, '.cursor-orbit': orbit })[selector];
  document.querySelector = selector => ({ '.cursor-dot': dot, '.cursor-ring': ring })[selector] || null;
  const motion = Object.assign(target(), { matches: initialReduced });
  const pointer = Object.assign(target(), { matches: true });
  const window = Object.assign(target(), {
    location: { pathname: '/', href: 'http://localhost/', origin: 'http://localhost' },
    matchMedia: query => query.includes('prefers-reduced-motion') ? motion : pointer,
    setTimeout() {}, setInterval() {},
    gsap: { to(node, props) { Object.assign(node.style, props); }, killTweensOf() {} },
  });
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/static/js/main.js'), 'utf8'), {
    window, document, URL, Intl,
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
  });
  const move = (element = target()) => document.dispatchEvent({ type: 'pointermove', clientX: 140, clientY: 220, pointerType: 'mouse', target: element });
  move();
  assert.equal(document.body.classList.contains('cursor-ready'), !initialReduced);
  motion.matches = false;
  motion.dispatchEvent({ type: 'change', matches: false });
  move();
  assert(document.body.classList.contains('cursor-ready'));
  assert.equal(dot.style.transform, 'translate3d(140px, 220px, 0)');
  assert.equal(ring.style.x, 140);
  const anchor = target();
  anchor.dataset.cursor = 'LIVE ↗';
  anchor.closest = selector => selector.startsWith('a,') ? anchor : null;
  move(anchor);
  assert(ring.classList.contains('cursor--interactive'));
  assert.equal(label.textContent, 'LIVE ↗');
  const input = target();
  input.closest = selector => selector.startsWith('input,') ? input : null;
  move(input);
  assert(!document.body.classList.contains('cursor-ready'));
  move();
  document.dispatchEvent({ type: 'pointerdown' });
  assert(document.body.classList.contains('cursor-pressed'));
  document.dispatchEvent({ type: 'pointerup' });
  assert(!document.body.classList.contains('cursor-pressed'));
  window.dispatchEvent({ type: 'blur' });
  assert(!document.body.classList.contains('cursor-ready'));
  pointer.matches = false;
  pointer.dispatchEvent({ type: 'change' });
  move();
  assert(!document.body.classList.contains('cursor-ready'));
  pointer.matches = true;
  motion.matches = true;
  motion.dispatchEvent({ type: 'change', matches: true });
  move();
  assert(!document.body.classList.contains('cursor-ready'));
}
console.log('Cursor events passed: tracking, link labels, click feedback, input fallback, blur, touch media, and live reduced-motion changes.');
