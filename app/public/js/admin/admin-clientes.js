(function () {
  'use strict';

  var tbody = document.getElementById('clientes-tbody');
  if (!tbody) return;

  function csrfToken() {
    var el = document.getElementById('csrf-token');
    return el ? el.value : '';
  }

  tbody.addEventListener('change', function (e) {
    var toggle = e.target.closest('.js-toggle-ativo');
    if (!toggle) return;
    var linha = toggle.closest('tr');
    fetch('/api/admin/clientes/' + linha.dataset.id + '/ativo', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken() },
    }).catch(function () {
      alert('Não foi possível alternar o status agora.');
      toggle.checked = !toggle.checked;
    });
  });
})();
