(function () {
  'use strict';

  const dialog = document.getElementById('dialog-confirmar');
  if (!dialog) return; // página não incluiu o partial

  const titulo      = document.getElementById('dialog-confirmar-titulo');
  const texto       = document.getElementById('dialog-confirmar-texto');
  const btnCancelar = dialog.querySelector('[data-confirmar-cancelar]');
  const btnConfirmar= dialog.querySelector('[data-confirmar-confirmar]');
  let acaoPendente = null;

  function fechar() { dialog.close(); }

  btnCancelar?.addEventListener('click', fechar);
  dialog.addEventListener('click', (e) => { if (e.target === dialog) fechar(); });
  dialog.addEventListener('close', () => { acaoPendente = null; });
  btnConfirmar?.addEventListener('click', () => {
    const executar = acaoPendente;
    fechar();
    if (executar) executar();
  });

  window.confirmarAcao = function (mensagem, aoConfirmar, opcoes) {
    opcoes = opcoes || {};
    titulo.textContent = opcoes.titulo || 'Confirmar ação';
    texto.textContent = mensagem;
    btnConfirmar.textContent = opcoes.rotuloConfirmar || 'Confirmar';
    btnConfirmar.classList.toggle('is-perigo', opcoes.perigo !== false);
    acaoPendente = aoConfirmar;
    dialog.showModal();
  };
})();
