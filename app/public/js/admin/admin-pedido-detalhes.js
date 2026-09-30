(function () {
  'use strict';

  var secao = document.querySelector('.pedido-admin-detalhes');
  if (!secao) return;
  var idPedido = secao.dataset.pedidoId;

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }

  secao.addEventListener('click', function (e) {
    var btnCopiar = e.target.closest('.js-copiar');
    if (!btnCopiar) return;
    var texto = btnCopiar.dataset.copiar;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(texto).then(function () {
        var original = btnCopiar.innerHTML;
        btnCopiar.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Copiado!';
        setTimeout(function () { btnCopiar.innerHTML = original; }, 1800);
      }).catch(function () { alert('Não foi possível copiar. Valor: ' + texto); });
    } else {
      alert('Copie manualmente: ' + texto);
    }
  });

  var dialogConfirmar   = document.getElementById('dialog-confirmar-alteracao');
  var confirmarTexto    = document.getElementById('confirmar-alteracao-texto');
  var btnConfirmarAlt   = document.getElementById('btn-confirmar-alteracao');
  var acaoPendente      = null;

  function ligarFechamento(dialog, btnFechar, btnCancelar) {
    if (btnFechar)   btnFechar.addEventListener('click', function () { dialog.close(); });
    if (btnCancelar) btnCancelar.addEventListener('click', function () { dialog.close(); });
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); dialog.close(); });
    dialog.addEventListener('click', function (e) {
      var r = dialog.getBoundingClientRect();
      var dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!dentro) dialog.close();
    });
  }

  if (dialogConfirmar) {
    ligarFechamento(
      dialogConfirmar,
      document.getElementById('confirmar-alteracao-fechar'),
      document.getElementById('btn-cancelar-alteracao')
    );
    dialogConfirmar.addEventListener('close', function () { acaoPendente = null; });
    btnConfirmarAlt.addEventListener('click', function () {
      var executar = acaoPendente;
      dialogConfirmar.close();
      if (executar) executar();
    });
  }

  function pedirConfirmacao(texto, aoConfirmar) {
    if (!dialogConfirmar) { if (window.confirm(texto)) aoConfirmar(); return; }
    confirmarTexto.textContent = texto;
    acaoPendente = aoConfirmar;
    dialogConfirmar.showModal();
  }

  /* Alterar status do pedido */
  var formStatus = document.getElementById('form-status-pedido');
  if (formStatus) {
    formStatus.addEventListener('submit', function (e) {
      e.preventDefault();
      var select = document.getElementById('pedido-status-select');
      var novoStatus = select.value;
      var rotulo = select.options[select.selectedIndex].text;
      var msg = document.getElementById('status-pedido-msg');

      pedirConfirmacao('Confirma alterar o status do pedido #' + idPedido + ' para "' + rotulo + '"?', function () {
        var btnSalvar = formStatus.querySelector('button[type="submit"]');
        if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.classList.add('is-carregando'); }

        fetch('/api/pedidos/' + idPedido + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
          body: JSON.stringify({ status: novoStatus }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) {
              if (msg) { msg.textContent = data.message || 'Não foi possível atualizar o status.'; msg.className = 'form-admin__mensagem is-erro'; }
              if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando'); }
              return;
            }
            window.location.reload();
          })
          .catch(function () {
            if (msg) { msg.textContent = 'Erro de conexão. Tente novamente.'; msg.className = 'form-admin__mensagem is-erro'; }
            if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando'); }
          });
      });
    });
  }

  /* Alterar situação do pagamento */
  var formPagamento = document.getElementById('form-pagamento-pedido');
  if (formPagamento) {
    formPagamento.addEventListener('submit', function (e) {
      e.preventDefault();
      var select = document.getElementById('pedido-pagamento-select');
      var novoStatusPagamento = select.value;
      var rotulo = select.options[select.selectedIndex].text;
      var msg = document.getElementById('pagamento-pedido-msg');

      pedirConfirmacao('Confirma alterar a situação do pagamento do pedido #' + idPedido + ' para "' + rotulo + '"?', function () {
        var btnSalvar = formPagamento.querySelector('button[type="submit"]');
        if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.classList.add('is-carregando'); }

        fetch('/api/admin/pedidos/' + idPedido + '/pagamento', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
          body: JSON.stringify({ status_pagamento: novoStatusPagamento }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) {
              if (msg) { msg.textContent = data.message || 'Não foi possível atualizar o pagamento.'; msg.className = 'form-admin__mensagem is-erro'; }
              if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando'); }
              return;
            }
            window.location.reload();
          })
          .catch(function () {
            if (msg) { msg.textContent = 'Erro de conexão. Tente novamente.'; msg.className = 'form-admin__mensagem is-erro'; }
            if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando'); }
          });
      });
    });
  }
})();
