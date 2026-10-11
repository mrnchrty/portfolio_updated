document.querySelectorAll('a[href]').forEach(link => {
  if (link.hostname === location.hostname && link.pathname === location.pathname && link.hash) {
    link.addEventListener('click', () => document.querySelector(link.hash)?.scrollIntoView({behavior:'smooth'}));
  }
});
