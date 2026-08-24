document.addEventListener('click', (e) => {
  const open = document.querySelectorAll('details[open]');
  open.forEach((d) => {
    if (!d.contains(e.target)) d.removeAttribute('open');
  });
});
