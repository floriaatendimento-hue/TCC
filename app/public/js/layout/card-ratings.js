(function () {
  'use strict';

  function estrelasHtml(media) {
    var cheias = Math.round(Number(media) || 0);
    var s = '';
    for (var i = 1; i <= 5; i++) {
      s += i <= cheias
        ? '<i class="fas fa-star" aria-hidden="true"></i>'
        : '<i class="far fa-star" aria-hidden="true"></i>';
    }
    return s;
  }

  function rotuloNota(media, total) {
    if (!total) return 'Ainda sem avaliações.';
    var notaFormatada = (Math.round(Number(media) * 10) / 10).toString().replace('.', ',');
    return 'Avaliação: ' + notaFormatada + ' de 5 estrelas (' + total + ' avaliação' + (total !== 1 ? 'ões' : '') + ').';
  }

  function preencher(slot, info) {
    var estrelas = slot.querySelector('.card-rating-estrelas');
    var qtdEl    = slot.querySelector('.card-rating-qtd');
    var media    = info ? info.media : 0;
    var total    = info ? info.total : 0;
    if (estrelas) estrelas.innerHTML = estrelasHtml(media);
    if (qtdEl)    qtdEl.textContent    = total > 0 ? '(' + total + ')' : 'Sem avaliações';
    slot.setAttribute('aria-label', rotuloNota(media, total));
    slot.removeAttribute('data-rating-pendente');
  }

  function enhance() {
    var slots = Array.prototype.slice
      .call(document.querySelectorAll('.card-rating[data-rating-slot][data-rating-pendente]'));
    if (!slots.length) return;

    var slugs = [];
    slots.forEach(function (el) {
      var s = el.dataset.ratingSlot;
      if (s && slugs.indexOf(s) === -1) slugs.push(s);
    });
    if (!slugs.length) return;

    fetch('/api/produtos/avaliacoes?slugs=' + encodeURIComponent(slugs.join(',')))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var mapa = (data && data.ok && data.data) ? data.data : {};
        slots.forEach(function (el) { preencher(el, mapa[el.dataset.ratingSlot]); });
      })
      .catch(function () {
        slots.forEach(function (el) { preencher(el, null); });
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', enhance);
  } else {
    enhance();
  }

  /* Cobre cards que aparecem depois */
  var observer = new MutationObserver(function () { enhance(); });
  observer.observe(document.body, { childList: true, subtree: true });
})();
