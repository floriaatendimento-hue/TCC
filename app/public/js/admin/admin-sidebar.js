(function () {
  'use strict';

  var btnAbrir = document.getElementById('admin-hamburger');
  var overlay  = document.getElementById('admin-sidebar-overlay');
  var sidebar  = document.getElementById('admin-sidebar');
  if (!btnAbrir || !overlay || !sidebar) return;

  function abrir() {
    sidebar.classList.add('is-aberta');
    btnAbrir.setAttribute('aria-expanded', 'true');
    document.addEventListener('keydown', aoTeclado);
  }

  function fechar() {
    sidebar.classList.remove('is-aberta');
    btnAbrir.setAttribute('aria-expanded', 'false');
    document.removeEventListener('keydown', aoTeclado);
  }

  function aoTeclado(e) {
    if (e.key === 'Escape') { fechar(); btnAbrir.focus(); }
  }

  btnAbrir.addEventListener('click', function () {
    if (sidebar.classList.contains('is-aberta')) fechar();
    else abrir();
  });
  overlay.addEventListener('click', fechar);
  sidebar.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', fechar);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth >= 600 && sidebar.classList.contains('is-aberta')) fechar();
  });
})();
