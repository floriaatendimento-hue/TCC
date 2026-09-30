(function () {
  'use strict';

  function iniciarTrocaMiniatura() {
    var miniaturas = document.querySelectorAll('.miniaturas img');
    var principal = document.getElementById('imgPrincipal');
    if (!miniaturas.length || !principal) return;

    function selecionar(img) {
      principal.src = img.src;
      principal.alt = img.alt;
      miniaturas.forEach(function (m) { m.classList.remove('ativa'); });
      img.classList.add('ativa');
    }

    miniaturas.forEach(function (img) {
      img.addEventListener('click', function () { selecionar(img); });
      img.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          selecionar(img);
        }
      });
    });
  }

  function iniciarZoom() {
    var figura = document.querySelector('.imagem-principal');
    if (!figura) return;

    var semHover = window.matchMedia('(hover: none)').matches;
    var reduzMovimento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (semHover || reduzMovimento) return;

    figura.classList.add('tem-zoom');

    figura.addEventListener('mousemove', function (e) {
      var rect = figura.getBoundingClientRect();
      var x = ((e.clientX - rect.left) / rect.width) * 100;
      var y = ((e.clientY - rect.top) / rect.height) * 100;
      figura.style.setProperty('--zoom-x', x + '%');
      figura.style.setProperty('--zoom-y', y + '%');
      figura.classList.add('zoom-ativo');
    });

    figura.addEventListener('mouseleave', function () {
      figura.classList.remove('zoom-ativo');
      figura.style.setProperty('--zoom-x', '50%');
      figura.style.setProperty('--zoom-y', '50%');
    });
  }

  function iniciar() {
    iniciarTrocaMiniatura();
    iniciarZoom();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
