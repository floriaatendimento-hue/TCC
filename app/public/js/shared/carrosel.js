(function () {
  const carrossel = document.querySelector('.carrossel');
  if (!carrossel) return;

  const slides = Array.from(carrossel.querySelectorAll('.slide'));
  const indicadores = Array.from(carrossel.querySelectorAll('.indicador'));
  const btnAnterior = carrossel.querySelector('.carrossel-seta--anterior');
  const btnProximo = carrossel.querySelector('.carrossel-seta--proximo');
  const total = slides.length;
  const INTERVALO_MS = 4000;
  const LIMIAR_SWIPE = 40;

  if (total === 0) return;

  let indiceAtual = slides.findIndex((slide) => slide.classList.contains('active'));
  if (indiceAtual < 0) indiceAtual = 0;
  let autoplayId = null;

  function definirFocavel(slide, focavel) {
    slide.querySelectorAll('.slide-capa[href], .slide-botao').forEach((el) => {
      if (focavel) el.removeAttribute('tabindex');
      else el.setAttribute('tabindex', '-1');
    });
  }

  function irPara(indice) {
    const novoIndice = ((indice % total) + total) % total;
    if (novoIndice === indiceAtual) return;

    slides[indiceAtual].classList.remove('active');
    slides[indiceAtual].setAttribute('aria-hidden', 'true');
    definirFocavel(slides[indiceAtual], false);
    if (indicadores[indiceAtual]) {
      indicadores[indiceAtual].classList.remove('active');
      indicadores[indiceAtual].setAttribute('aria-current', 'false');
    }

    indiceAtual = novoIndice;

    slides[indiceAtual].classList.add('active');
    slides[indiceAtual].setAttribute('aria-hidden', 'false');
    definirFocavel(slides[indiceAtual], true);
    if (indicadores[indiceAtual]) {
      indicadores[indiceAtual].classList.add('active');
      indicadores[indiceAtual].setAttribute('aria-current', 'true');
    }
  }

  function proximo() { irPara(indiceAtual + 1); }
  function anterior() { irPara(indiceAtual - 1); }

  function pararAutoplay() {
    if (autoplayId) {
      clearInterval(autoplayId);
      autoplayId = null;
    }
  }

  function iniciarAutoplay() {
    pararAutoplay();
    if (total > 1) autoplayId = setInterval(proximo, INTERVALO_MS);
  }

  function reiniciarAutoplay() {
    iniciarAutoplay();
  }

  if (btnProximo) {
    btnProximo.addEventListener('click', () => { proximo(); reiniciarAutoplay(); });
  }
  if (btnAnterior) {
    btnAnterior.addEventListener('click', () => { anterior(); reiniciarAutoplay(); });
  }

  indicadores.forEach((indicador, indice) => {
    indicador.addEventListener('click', () => { irPara(indice); reiniciarAutoplay(); });
  });

  carrossel.addEventListener('mouseenter', pararAutoplay);
  carrossel.addEventListener('mouseleave', iniciarAutoplay);
  carrossel.addEventListener('focusin', pararAutoplay);
  carrossel.addEventListener('focusout', iniciarAutoplay);

  carrossel.addEventListener('keydown', (evento) => {
    if (evento.key === 'ArrowRight') {
      evento.preventDefault();
      proximo();
      reiniciarAutoplay();
    } else if (evento.key === 'ArrowLeft') {
      evento.preventDefault();
      anterior();
      reiniciarAutoplay();
    }
  });

  let toqueInicialX = null;

  carrossel.addEventListener('touchstart', (evento) => {
    toqueInicialX = evento.touches[0].clientX;
    pararAutoplay();
  }, { passive: true });

  carrossel.addEventListener('touchend', (evento) => {
    if (toqueInicialX === null) {
      iniciarAutoplay();
      return;
    }

    const deltaX = evento.changedTouches[0].clientX - toqueInicialX;
    if (Math.abs(deltaX) > LIMIAR_SWIPE) {
      if (deltaX < 0) proximo();
      else anterior();
    }

    toqueInicialX = null;
    iniciarAutoplay();
  });

  iniciarAutoplay();
})();
