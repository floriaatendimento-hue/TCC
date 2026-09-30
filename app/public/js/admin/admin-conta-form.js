(function () {
  'use strict';

  var form = document.getElementById('form-conta-avulsa');
  if (!form) return;

  var cFornecedor   = document.getElementById('c-fornecedor');
  var cDescricao    = document.getElementById('c-descricao');
  var cCategoria    = document.getElementById('c-categoria');
  var cValor        = document.getElementById('c-valor');
  var cVencimento   = document.getElementById('c-vencimento');
  var cObservacoes  = document.getElementById('c-observacoes');
  var formMsg       = document.getElementById('form-conta-msg');
  var btnSalvar     = document.getElementById('btn-salvar-conta');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    if (!cFornecedor.value) { mostrarMsg('Selecione um fornecedor/beneficiário.', 'erro'); cFornecedor.focus(); return; }
    if (!cDescricao.value.trim()) { mostrarMsg('Informe uma descrição.', 'erro'); cDescricao.focus(); return; }
    if (!(Number(cValor.value) > 0)) { mostrarMsg('Informe um valor válido.', 'erro'); cValor.focus(); return; }
    if (!cVencimento.value) { mostrarMsg('Informe o vencimento.', 'erro'); cVencimento.focus(); return; }

    var payload = {
      fornecedor_id: Number(cFornecedor.value),
      descricao: cDescricao.value.trim(),
      categoria: cCategoria.value,
      valor: Number(cValor.value),
      vencimento: cVencimento.value,
      observacoes: cObservacoes.value.trim(),
    };

    btnSalvar.disabled = true;
    btnSalvar.classList.add('is-carregando');
    fetch('/api/admin/contas-pagar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          mostrarMsg(data.message || 'Não foi possível cadastrar a conta.', 'erro');
          btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
          return;
        }
        window.mostrarToastAoRecarregar('Conta cadastrada.', 'sucesso');
        window.location.href = '/admin/contas-pagar';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
      });
  });
})();
