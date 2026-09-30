(function () {
  'use strict';

  var dialog = document.getElementById('dialog-confirmar-admin');
  if (!dialog) return;

  var elTitulo      = document.getElementById('confirmar-admin-titulo');
  var elTexto       = document.getElementById('confirmar-admin-texto');
  var btnConfirmar  = document.getElementById('btn-confirmar-admin');
  var btnCancelar   = document.getElementById('btn-cancelar-admin');
  var btnFechar     = document.getElementById('confirmar-admin-fechar');
  var acaoPendente  = null;

  function fechar() { dialog.close(); }

  btnFechar.addEventListener('click', fechar);
  btnCancelar.addEventListener('click', fechar);
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); fechar(); });
  dialog.addEventListener('click', function (e) {
    var r = dialog.getBoundingClientRect();
    var dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    if (!dentro) fechar();
  });
  dialog.addEventListener('close', function () { acaoPendente = null; });
  btnConfirmar.addEventListener('click', function () {
    var executar = acaoPendente;
    fechar();
    if (executar) executar();
  });

  window.confirmarAdmin = function (texto, aoConfirmar, opcoes) {
    opcoes = opcoes || {};
    elTitulo.textContent = opcoes.titulo || 'Confirmar ação';
    elTexto.textContent = texto;
    btnConfirmar.textContent = opcoes.rotuloConfirmar || 'Excluir';
    btnConfirmar.className = 'btn-admin ' + (opcoes.perigo === false ? 'btn-admin--primario' : 'btn-admin--perigo');
    acaoPendente = aoConfirmar;
    dialog.showModal();
  };
})();
