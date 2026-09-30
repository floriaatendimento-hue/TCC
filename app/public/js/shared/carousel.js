(function () {
  'use strict';

  /* Calcula passo de scroll */
  function calcStep(ul) {
    var li = ul.querySelector('li');
    if (!li) return 240;

    var cardW = li.getBoundingClientRect().width || li.offsetWidth || 200;
    if (cardW < 10) cardW = 200;

    var gap = 14;
    try {
      var cs = window.getComputedStyle(ul);
      var g = parseFloat(cs.gap || cs.columnGap);
      if (!isNaN(g) && g > 0) gap = g;
    } catch (_) {}

    var ulW    = ul.getBoundingClientRect().width || ul.clientWidth || 600;
    var visible = Math.max(1, Math.floor((ulW + gap) / (cardW + gap)));
    return visible * (cardW + gap);
  }

  /* Habilita / desabilita botão */
  function setDisabled(btn, state) {
    btn.disabled = !!state;
    if (state) btn.setAttribute('disabled', '');
    else       btn.removeAttribute('disabled');
  }

  function syncBtns(wrapper) {
    var ul   = wrapper.querySelector('ul');
    if (!ul) return;
    var btns = wrapper.querySelectorAll('.carousel-btn');
    if (btns.length < 2) return;

    var prev = btns[0];
    var next = btns[btns.length - 1];
    var sl   = Math.round(ul.scrollLeft);
    var max  = Math.round(ul.scrollWidth - ul.clientWidth);

    setDisabled(prev, sl <= 2);

    setDisabled(next, max > 20 && sl >= max - 2);
  }

  /* Swipe / touch mobile */
  function enableSwipe(ul, wrapper) {
    var startX = 0, startScroll = 0, active = false;

    ul.addEventListener('touchstart', function (e) {
      startX     = e.touches[0].clientX;
      startScroll = ul.scrollLeft;
      active     = true;
    }, { passive: true });

    ul.addEventListener('touchmove', function (e) {
      if (!active) return;
      ul.scrollLeft = startScroll - (e.touches[0].clientX - startX);
    }, { passive: true });

    ul.addEventListener('touchend', function () {
      active = false;
      setTimeout(function () { syncBtns(wrapper); }, 120);
    }, { passive: true });
  }

  /* Executa o scroll de fato */
  function doScroll(ul, wrapper, dir) {
    var step = calcStep(ul);
    ul.scrollBy({ left: dir * step, behavior: 'smooth' });
    setTimeout(function () { syncBtns(wrapper); }, 350);
    setTimeout(function () { syncBtns(wrapper); }, 750);
  }

  function scrollCarousel(btn, dir) {
    var wrapper = btn.closest
      ? btn.closest('.carousel-wrapper')
      : (function (el) {
          while (el && el !== document.documentElement) {
            if (el.classList && el.classList.contains('carousel-wrapper')) return el;
            el = el.parentElement;
          }
          return null;
        }(btn));
    if (!wrapper) return;
    var ul = wrapper.querySelector('ul');
    if (ul) doScroll(ul, wrapper, dir);
  }
  window.scrollCarousel = scrollCarousel;

  function init() {
    document.querySelectorAll('.carousel-wrapper').forEach(function (wrapper) {
      var ul = wrapper.querySelector('ul');
      if (!ul) return;

      ul.style.overflowX    = 'auto';
      ul.style.overflowY    = 'visible';
      ul.style.display      = 'flex';
      ul.style.flexWrap     = 'nowrap';
      ul.style.scrollBehavior = 'smooth';

      /* Vincula botões com addEventListener */
      var btns = Array.from(wrapper.querySelectorAll('.carousel-btn'));
      btns.forEach(function (btn, idx) {
        btn.removeAttribute('onclick');
        /* Garante que não submete form */
        btn.setAttribute('type', 'button');

        var dir = (idx === 0) ? -1 : 1;

        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          doScroll(ul, wrapper, dir);
        });
      });

      /* Swipe no mobile */
      enableSwipe(ul, wrapper);

      /* Atualiza botões ao rolar */
      ul.addEventListener('scroll', function () {
        syncBtns(wrapper);
      }, { passive: true });

      syncBtns(wrapper);
      [100, 300, 700, 1500, 3000].forEach(function (t) {
        setTimeout(function () { syncBtns(wrapper); }, t);
      });
    });

    /* Re-sincroniza ao redimensionar a janela */
    window.addEventListener('resize', function () {
      document.querySelectorAll('.carousel-wrapper').forEach(function (w) {
        setTimeout(function () { syncBtns(w); }, 200);
      });
    }, { passive: true });
  }

  /* Aguarda o DOM estar pronto */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
