(() => {
  const key = 'portfolio-theme';
  let theme;
  try { theme = localStorage.getItem(key); } catch (error) { theme = null; }
  if (theme !== 'dark' && theme !== 'light') {
    theme = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f4f1ea' : '#0b0b0b');
})();
