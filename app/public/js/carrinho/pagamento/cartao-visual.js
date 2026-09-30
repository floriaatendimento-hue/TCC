(function () {
  'use strict';

  const visual = document.getElementById('cartao-visual');
  if (!visual) return;

  const chip = document.getElementById('cartao-tipo-chip');
  const chipNome = document.getElementById('cartao-tipo-chip-nome');
  const chipIcone = chip ? chip.querySelector('i') : null;

  const elNumero = document.getElementById('cartao-visual-numero');
  const elNome = document.getElementById('cartao-visual-nome');
  const elValidade = document.getElementById('cartao-visual-validade');
  const elCvv = document.getElementById('cartao-visual-cvv');
  const elBandeira = document.getElementById('cartao-visual-bandeira');

  const inputNumero = document.getElementById('cartao-numero');
  const inputNome = document.getElementById('cartao-nome');
  const inputValidade = document.getElementById('cartao-validade');
  const inputCvv = document.getElementById('cartao-cvv');
  const radiosMetodo = document.querySelectorAll('input[name="forma_pagto"]');

  const NOMES_TIPO = { credito: 'Cartão de Crédito', debito: 'Cartão de Débito' };
  const ICONE_TIPO = { credito: 'fa-credit-card', debito: 'fa-money-check-alt' };

  function tipoAtual() {
    const selecionado = document.querySelector('input[name="forma_pagto"]:checked');
    return selecionado && (selecionado.value === 'credito' || selecionado.value === 'debito') ? selecionado.value : 'credito';
  }

  function atualizarTipo() {
    const tipo = tipoAtual();
    visual.dataset.tipo = tipo;
    if (chip) chip.dataset.tipo = tipo;
    if (chipNome) chipNome.textContent = NOMES_TIPO[tipo];
    if (chipIcone) chipIcone.className = 'fas ' + ICONE_TIPO[tipo];
  }

  function atualizarNumero() {
    if (!elNumero) return;
    const v = (inputNumero && inputNumero.value || '').trim();
    elNumero.textContent = v || '•••• •••• •••• ••••';
    if (elBandeira && window.PagamentoCartao) {
      const bandeira = window.PagamentoCartao.detectarBandeira(v);
      elBandeira.textContent = bandeira || 'Floria';
    }
  }
  function atualizarNome() {
    if (!elNome) return;
    const v = (inputNome && inputNome.value || '').trim();
    elNome.textContent = v || 'NOME DO TITULAR';
  }
  function atualizarValidade() {
    if (!elValidade) return;
    const v = (inputValidade && inputValidade.value || '').trim();
    elValidade.textContent = v || 'MM/AA';
  }
  function atualizarCvv() {
    if (!elCvv) return;
    const v = (inputCvv && inputCvv.value || '').trim();
    elCvv.textContent = v || '•••';
  }

  radiosMetodo.forEach((r) => r.addEventListener('change', atualizarTipo));
  if (inputNumero) inputNumero.addEventListener('input', atualizarNumero);
  if (inputNome) inputNome.addEventListener('input', atualizarNome);
  if (inputValidade) inputValidade.addEventListener('input', atualizarValidade);
  if (inputCvv) {
    inputCvv.addEventListener('input', atualizarCvv);
    inputCvv.addEventListener('focus', () => visual.classList.add('is-virado'));
    inputCvv.addEventListener('blur', () => visual.classList.remove('is-virado'));
  }

  atualizarTipo();
  atualizarNumero();
  atualizarNome();
  atualizarValidade();
  atualizarCvv();
})();
