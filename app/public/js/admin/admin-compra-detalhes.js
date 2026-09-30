(function () {
  'use strict';

  var main = document.getElementById('compra-detalhes');
  if (!main) return;

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }

  // Cancelar compra
  var btnCancelar = document.getElementById('btn-cancelar-compra');
  if (btnCancelar) {
    btnCancelar.addEventListener('click', function () {
      var motivo = window.prompt('Motivo do cancelamento (obrigatório):', '');
      if (motivo === null) return; // admin desistiu do prompt
      motivo = motivo.trim();
      if (!motivo) { window.mostrarToast('Informe o motivo do cancelamento.', 'erro'); return; }

      window.confirmarAdmin(
        'Cancelar esta compra? Só é possível enquanto nenhum pagamento tiver sido registrado.',
        function () {
          fetch('/api/admin/compras/' + main.dataset.compraId + '/cancelar', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
            body: JSON.stringify({ motivo: motivo }),
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (!data.ok) { window.mostrarToast(data.message || 'Não foi possível cancelar a compra.', 'erro'); return; }
              window.mostrarToastAoRecarregar('Compra cancelada.', 'sucesso');
              window.location.reload();
            })
            .catch(function () { window.mostrarToast('Erro de conexão.', 'erro'); });
        },
        { rotuloConfirmar: 'Cancelar compra', perigo: true }
      );
    });
  }

  // Registrar pagamento
  var formPagamento = document.getElementById('form-pagamento');
  if (formPagamento) {
    var painelFormPagamento = document.getElementById('painel-form-pagamento');
    var formMsg = document.getElementById('form-pagamento-msg');
    var btnRegistrar = document.getElementById('btn-registrar-pagamento');
    var btnCancelarPagamento = document.getElementById('btn-cancelar-pagamento');
    var pValor = document.getElementById('p-valor');
    var labelParcela = document.getElementById('form-pagamento-parcela-label');

    function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }

    document.querySelectorAll('.js-abrir-pagamento').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        formPagamento.dataset.contaId = link.dataset.contaId;
        pValor.max = link.dataset.saldo;
        pValor.value = link.dataset.saldo;
        labelParcela.textContent = link.dataset.parcela ? '— parcela ' + link.dataset.parcela : '';
        mostrarMsg('', '');
        painelFormPagamento.hidden = false;
        painelFormPagamento.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
    });
    btnCancelarPagamento.addEventListener('click', function () {
      painelFormPagamento.hidden = true;
      formPagamento.reset();
    });

    formPagamento.addEventListener('submit', function (e) {
      e.preventDefault();
      formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem';

      var contaId = formPagamento.dataset.contaId;
      var valor = Number(pValor.value);
      var payload = {
        valor: valor,
        data_pagamento: document.getElementById('p-data').value,
        metodo: document.getElementById('p-metodo').value,
        referencia: document.getElementById('p-referencia').value.trim(),
        observacoes: document.getElementById('p-observacoes').value.trim(),
      };

      if (!contaId) { mostrarMsg('Selecione uma parcela/conta antes de registrar o pagamento.', 'erro'); return; }
      if (!(valor > 0)) { mostrarMsg('Informe um valor de pagamento válido.', 'erro'); return; }
      if (!payload.data_pagamento) { mostrarMsg('Informe a data do pagamento.', 'erro'); return; }

      btnRegistrar.disabled = true;
      btnRegistrar.classList.add('is-carregando');
      fetch('/api/admin/contas-pagar/' + contaId + '/pagamentos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify(payload),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) {
            mostrarMsg(data.message || 'Não foi possível registrar o pagamento.', 'erro');
            btnRegistrar.disabled = false; btnRegistrar.classList.remove('is-carregando');
            return;
          }
          window.mostrarToastAoRecarregar('Pagamento registrado.', 'sucesso');
          window.location.reload();
        })
        .catch(function () {
          mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
          btnRegistrar.disabled = false; btnRegistrar.classList.remove('is-carregando');
        });
    });
  }

  // Estornar pagamento
  document.querySelectorAll('.js-estornar-pagamento').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var pagamentoId = link.dataset.id;
      window.confirmarAdmin(
        'Estornar este pagamento? O valor volta a compor o saldo devedor da conta a pagar.',
        function () {
          fetch('/api/admin/pagamentos-fornecedor/' + pagamentoId + '/estornar', {
            method: 'PATCH',
            headers: { 'X-CSRF-Token': csrfToken() },
          })
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (!data.ok) { window.mostrarToast(data.message || 'Não foi possível estornar o pagamento.', 'erro'); return; }
              window.mostrarToastAoRecarregar('Pagamento estornado.', 'sucesso');
              window.location.reload();
            })
            .catch(function () { window.mostrarToast('Erro de conexão.', 'erro'); });
        },
        { rotuloConfirmar: 'Estornar', perigo: true }
      );
    });
  });
})();
