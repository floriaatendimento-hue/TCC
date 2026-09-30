(function () {
  'use strict';

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }

  document.querySelectorAll('.js-status').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var id = link.dataset.id;
      var novoStatus = link.dataset.status;
      var acaoTexto = novoStatus === 'bloqueado' ? 'Bloquear este fornecedor? Ele deixa de poder receber novas compras.' : 'Reativar este fornecedor?';
      window.confirmarAdmin(acaoTexto, function () {
        fetch('/api/admin/fornecedores/' + id + '/status', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
          body: JSON.stringify({ status: novoStatus }),
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { window.mostrarToast(data.message || 'Erro ao alterar status.', 'erro'); return; }
            window.mostrarToastAoRecarregar('Status atualizado.', 'sucesso');
            window.location.reload();
          })
          .catch(function () { window.mostrarToast('Erro de conexão.', 'erro'); });
      }, { rotuloConfirmar: novoStatus === 'bloqueado' ? 'Bloquear' : 'Reativar', perigo: novoStatus === 'bloqueado' });
    });
  });

  document.querySelectorAll('.js-excluir').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      var id = link.dataset.id;
      var nome = link.dataset.nome;
      window.confirmarAdmin('Excluir o fornecedor "' + nome + '"? Essa ação não pode ser desfeita.', function () {
        fetch('/api/admin/fornecedores/' + id, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { window.mostrarToast(data.message || 'Erro ao excluir fornecedor.', 'erro'); return; }
            window.mostrarToastAoRecarregar('Fornecedor excluído.', 'sucesso');
            window.location.reload();
          })
          .catch(function () { window.mostrarToast('Erro de conexão.', 'erro'); });
      });
    });
  });
})();
