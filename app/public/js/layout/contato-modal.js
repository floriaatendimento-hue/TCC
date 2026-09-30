(function () {
  'use strict';

  const modal = document.getElementById('modal-contato');
  if (!modal) return;

  const ICONES = {
    telefone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
    email: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  };
  const ROTULOS  = { telefone: 'Telefone',      email: 'E-mail' };
  const BOTOES   = { telefone: 'Copiar número', email: 'Copiar e-mail' };
  const FEEDBACK = { telefone: 'Número copiado!', email: 'E-mail copiado!' };

  const elIcone         = document.getElementById('modal-contato-icone');
  const elTitulo        = document.getElementById('modal-contato-titulo');
  const elRotulo        = document.getElementById('modal-contato-rotulo');
  const elValor         = document.getElementById('modal-contato-valor');
  const btnCopiar       = document.getElementById('modal-contato-copiar');
  const elCopiarTexto   = document.getElementById('modal-contato-copiar-texto');

  let tipoAtual = null;
  let copiadoTimer = null;
  let fechandoTimer = null;

  function abrir(tipo, valor) {
    tipoAtual = tipo;
    elIcone.innerHTML = ICONES[tipo] || '';
    elTitulo.textContent = ROTULOS[tipo] || 'Contato';
    elRotulo.textContent = ROTULOS[tipo] || 'Contato';
    elValor.textContent = valor;
    elCopiarTexto.textContent = BOTOES[tipo] || 'Copiar';
    btnCopiar.classList.remove('is-copiado');
    clearTimeout(copiadoTimer);

    modal.classList.remove('fechando');
    modal.showModal();
  }

  function fechar() {
    if (!modal.open) return;
    clearTimeout(fechandoTimer);
    modal.classList.add('fechando');
    fechandoTimer = setTimeout(() => {
      modal.close();
      modal.classList.remove('fechando');
    }, 180);
  }

  document.getElementById('fechar-modal-contato')?.addEventListener('click', fechar);
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });
  modal.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });

  document.querySelectorAll('[data-abrir-modal-contato]').forEach((el) => {
    const tipo = el.getAttribute('data-abrir-modal-contato');
    const valor = el.getAttribute('data-contato-valor');
    if (!valor) return;
    el.addEventListener('click', (e) => {
      e.preventDefault();
      abrir(tipo, valor);
    });
  });

  btnCopiar?.addEventListener('click', () => {
    const texto = elValor.textContent || '';
    navigator.clipboard?.writeText(texto).then(() => {
      btnCopiar.classList.add('is-copiado');
      elCopiarTexto.textContent = FEEDBACK[tipoAtual] || 'Copiado!';
      clearTimeout(copiadoTimer);
      copiadoTimer = setTimeout(() => {
        btnCopiar.classList.remove('is-copiado');
        elCopiarTexto.textContent = BOTOES[tipoAtual] || 'Copiar';
      }, 2200);
    }).catch(() => {});
  });
})();
