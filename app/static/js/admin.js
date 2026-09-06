(() => {
  const sidebar = document.querySelector('.admin-sidebar');
  document.querySelector('.sidebar-toggle')?.addEventListener('click', () => sidebar?.classList.toggle('open'));
  document.querySelectorAll('[data-confirm]').forEach((form) => form.addEventListener('submit', (event) => {
    if (!window.confirm(form.dataset.confirm)) event.preventDefault();
  }));
  document.querySelectorAll('.admin-flash button').forEach((button) => button.addEventListener('click', () => button.parentElement.remove()));
  const resume = document.querySelector('#resume');
  resume?.addEventListener('change', () => {
    const label = document.querySelector('label[for="resume"] strong');
    if (label && resume.files[0]) label.textContent = resume.files[0].name;
  });
  document.querySelectorAll('form').forEach((form) => form.addEventListener('submit', () => {
    const button = form.querySelector('input[type="submit"], button[type="submit"]');
    if (button && !form.dataset.confirm) {
      button.disabled = true;
      if ('value' in button) button.value = 'Saving…'; else button.textContent = 'Working…';
    }
  }));
})();
