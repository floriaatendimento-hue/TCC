(function () {
  'use strict';

  var tbody = document.getElementById('pedidos-tbody');
  if (!tbody) return;

  var CLASSE_BADGE = {
    preparando: 'badge--dourado', enviado: 'badge--azul', em_transporte: 'badge--azul',
    saiu_entrega: 'badge--azul', entregue: 'badge--verde', cancelado: 'badge--vermelho',
  };
  var ICONE_STATUS = {
    preparando: 'fa-box', enviado: 'fa-truck', em_transporte: 'fa-route',
    saiu_entrega: 'fa-shipping-fast', entregue: 'fa-check-circle', cancelado: 'fa-ban',
  };
  var CLASSES_BADGE_TODAS = Object.keys(CLASSE_BADGE).map(function (k) { return CLASSE_BADGE[k]; })
    .filter(function (v, i, arr) { return arr.indexOf(v) === i; });

  function aplicarStatusNoBadge(badge, status) {
    CLASSES_BADGE_TODAS.forEach(function (c) { badge.classList.remove(c); });
    badge.classList.add(CLASSE_BADGE[status] || 'badge--cinza');
    var icone = badge.querySelector('[data-status-icone]');
    if (icone) icone.className = 'fas ' + (ICONE_STATUS[status] || 'fa-circle');
  }

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }

  tbody.addEventListener('change', function (e) {
    var select = e.target.closest('.js-status');
    if (!select) return;
    var badge = select.closest('[data-status-badge]');
    var valorAnterior = select.dataset.valorAnterior;
    var novoStatus = select.value;
    select.disabled = true;
    fetch('/api/pedidos/' + select.dataset.id + '/status', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify({ status: novoStatus }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          alert(data.message || 'Não foi possível atualizar o status.');
          select.value = valorAnterior;
          if (badge) aplicarStatusNoBadge(badge, valorAnterior);
          return;
        }
        select.dataset.valorAnterior = novoStatus;
        if (badge) aplicarStatusNoBadge(badge, novoStatus);
      })
      .catch(function () {
        alert('Erro de conexão. Tente novamente.');
        select.value = valorAnterior;
        if (badge) aplicarStatusNoBadge(badge, valorAnterior);
      })
      .finally(function () { select.disabled = false; });
  });
})();
