(function () {
  'use strict';

  var btnAbrir   = document.getElementById('hamburger-btn');
  var btnFechar  = document.getElementById('drawer-fechar');
  var overlay    = document.getElementById('drawer-overlay');
  var drawer     = document.getElementById('drawer-menu');
  if (!btnAbrir || !overlay || !drawer) return;

  var TRANSICAO_MS = 280;
  var fechando = null;

  function abrir() {
    clearTimeout(fechando);
    overlay.hidden = false;
    drawer.hidden  = false;
    void drawer.offsetWidth;
    overlay.classList.add('aberto');
    drawer.classList.add('aberto');
    btnAbrir.setAttribute('aria-expanded', 'true');
    document.body.classList.add('drawer-travado');
    document.addEventListener('keydown', aoTeclado);
  }

  function fechar() {
    overlay.classList.remove('aberto');
    drawer.classList.remove('aberto');
    btnAbrir.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('drawer-travado');
    document.removeEventListener('keydown', aoTeclado);
    fechando = setTimeout(function () {
      overlay.hidden = true;
      drawer.hidden  = true;
    }, TRANSICAO_MS);
  }

  function aoTeclado(e) {
    if (e.key === 'Escape') { fechar(); btnAbrir.focus(); }
  }

  btnAbrir.addEventListener('click', abrir);
  if (btnFechar) btnFechar.addEventListener('click', fechar);
  overlay.addEventListener('click', fechar);
  drawer.querySelectorAll('a').forEach(function (a) {
    a.addEventListener('click', fechar);
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth >= 1024 && drawer.classList.contains('aberto')) fechar();
  });
})();
