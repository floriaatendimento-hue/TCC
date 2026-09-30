(function () {
  'use strict';

  var trigger = document.getElementById('conta-trigger');
  var menu    = document.getElementById('conta-menu');
  if (!trigger || !menu) return;

  var TRANSICAO_MS = 160;
  var fechando = null;

  function abrir() {
    clearTimeout(fechando);
    menu.hidden = false;
    void menu.offsetWidth;
    menu.classList.add('aberto');
    trigger.setAttribute('aria-expanded', 'true');
    var primeiroItem = menu.querySelector('[role="menuitem"]');
    if (primeiroItem) primeiroItem.focus();
    document.addEventListener('click', aoClicarFora);
    document.addEventListener('keydown', aoTeclado);
  }

  function fechar() {
    menu.classList.remove('aberto');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', aoClicarFora);
    document.removeEventListener('keydown', aoTeclado);
    fechando = setTimeout(function () { menu.hidden = true; }, TRANSICAO_MS);
  }

  function aoClicarFora(e) {
    if (!menu.contains(e.target) && e.target !== trigger) fechar();
  }

  function aoTeclado(e) {
    if (e.key === 'Escape') {
      fechar();
      trigger.focus();
      return;
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    var itens = Array.prototype.slice.call(menu.querySelectorAll('[role="menuitem"]'));
    if (!itens.length) return;
    var atual = itens.indexOf(document.activeElement);
    var proximo;
    if (e.key === 'Home') proximo = itens[0];
    else if (e.key === 'End') proximo = itens[itens.length - 1];
    else if (e.key === 'ArrowDown') proximo = itens[(atual + 1 + itens.length) % itens.length];
    else proximo = itens[(atual - 1 + itens.length) % itens.length];
    proximo.focus();
  }

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    if (menu.hidden) abrir(); else fechar();
  });
})();
