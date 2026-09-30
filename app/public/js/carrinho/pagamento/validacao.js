(function (window) {
  'use strict';

  function elementoErro(input) {
    const id = input.getAttribute('aria-describedby');
    return id ? document.getElementById(id) : null;
  }

  function mostrarErroCampo(input, mensagem) {
    if (!input) return;
    input.setAttribute('aria-invalid', 'true');
    const saida = elementoErro(input);
    if (saida) saida.textContent = mensagem || '';
  }

  function limparErroCampo(input) {
    if (!input) return;
    input.removeAttribute('aria-invalid');
    const saida = elementoErro(input);
    if (saida) saida.textContent = '';
  }

  function limparErrosDoEscopo(escopo) {
    if (!escopo) return;
    escopo.querySelectorAll('[aria-invalid]').forEach((el) => limparErroCampo(el));
  }

  window.PagamentoValidacao = { mostrarErroCampo, limparErroCampo, limparErrosDoEscopo };
})(window);
