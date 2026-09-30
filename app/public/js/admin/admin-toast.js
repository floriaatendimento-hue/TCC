(function () {
  'use strict';

  var container = null;
  function obterContainer() {
    if (container && document.body.contains(container)) return container;
    container = document.createElement('output');
    container.className = 'toast-pilha';
    container.setAttribute('aria-live', 'polite');
    document.body.appendChild(container);
    return container;
  }

  window.mostrarToast = function (texto, tipo) {
    var pilha = obterContainer();
    var item = document.createElement('p');
    item.className = 'toast ' + (tipo === 'erro' ? 'toast--erro' : 'toast--sucesso');
    var icone = document.createElement('i');
    icone.className = 'fas ' + (tipo === 'erro' ? 'fa-exclamation-circle' : 'fa-check-circle');
    icone.setAttribute('aria-hidden', 'true');
    var texto_el = document.createElement('b');
    texto_el.textContent = texto;
    item.appendChild(icone);
    item.appendChild(texto_el);
    pilha.appendChild(item);
    requestAnimationFrame(function () { item.classList.add('is-visivel'); });
    setTimeout(function () {
      item.classList.remove('is-visivel');
      setTimeout(function () { item.remove(); }, 260);
    }, 3200);
  };

  window.mostrarToastAoRecarregar = function (texto, tipo) {
    try { sessionStorage.setItem('floria-toast-pendente', JSON.stringify({ texto: texto, tipo: tipo })); } catch (e) {}
  };

  document.addEventListener('DOMContentLoaded', function () {
    var pendente;
    try { pendente = sessionStorage.getItem('floria-toast-pendente'); } catch (e) { pendente = null; }
    if (!pendente) return;
    try { sessionStorage.removeItem('floria-toast-pendente'); } catch (e) {}
    try {
      var dados = JSON.parse(pendente);
      window.mostrarToast(dados.texto, dados.tipo);
    } catch (e) {}
  });
})();
