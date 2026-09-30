(function () {
  'use strict';

  document.addEventListener('error', function (evento) {
    var img = evento.target;
    if (!img || img.tagName !== 'IMG' || !img.dataset) return;
    if (img.dataset.fallbackAplicado === '1') return;

    if (img.dataset.fallbackIcon) {
      img.dataset.fallbackAplicado = '1';
      var icone = document.createElement('i');
      icone.className = img.dataset.fallbackIcon;
      icone.setAttribute('aria-hidden', 'true');
      if (img.parentNode) img.parentNode.replaceChild(icone, img);
      return;
    }

    if (img.dataset.fallback && img.src !== location.origin + img.dataset.fallback) {
      img.dataset.fallbackAplicado = '1';
      img.src = img.dataset.fallback;
    }
  }, true);
})();
