(function () {
  'use strict';

  var dialog = document.getElementById('dialog-comprovante');
  if (dialog) {
    var corpo = document.getElementById('dialog-comprovante-corpo');
    var btnFechar = document.getElementById('dialog-comprovante-fechar');

    var abrir = function (id) {
      corpo.innerHTML = '<p class="tabela-admin__carregando">Carregando comprovante...</p>';
      dialog.showModal();
      fetch('/admin/logs/' + id + '/comprovante')
        .then(function (r) {
          if (!r.ok) throw new Error('falha na resposta');
          return r.text();
        })
        .then(function (html) { corpo.innerHTML = html; })
        .catch(function () { corpo.innerHTML = '<p class="tabela-admin__vazia">Não foi possível carregar o comprovante. Tente novamente.</p>'; });
    };
    var fechar = function () { dialog.close(); };

    document.querySelectorAll('.js-ver-comprovante').forEach(function (btn) {
      btn.addEventListener('click', function () { abrir(btn.dataset.id); });
    });

    btnFechar.addEventListener('click', fechar);
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); fechar(); });
    dialog.addEventListener('click', function (e) {
      var rect = dialog.getBoundingClientRect();
      var dentro = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!dentro) fechar();
    });
  }

  var progresso = document.getElementById('log-progresso');
  var mostrarProgresso = function () {
    if (!progresso) return;
    progresso.removeAttribute('value');
    progresso.hidden = false;
  };

  var form = document.getElementById('log-filtros-form');
  var btnAplicar = document.getElementById('log-filtros-submit');
  if (form) {
    form.addEventListener('submit', function () {
      mostrarProgresso();
      if (btnAplicar) btnAplicar.classList.add('is-carregando');
    });
  }

  var ordenar = document.getElementById('log-ordenar');
  if (ordenar && form) {
    ordenar.addEventListener('change', function () {
      mostrarProgresso();
      form.requestSubmit ? form.requestSubmit() : form.submit();
    });
  }

  document.querySelectorAll('nav.paginacao a').forEach(function (link) {
    link.addEventListener('click', function () { mostrarProgresso(); });
  });

  document.querySelectorAll('.js-exportar-log').forEach(function (link) {
    link.addEventListener('click', function () {
      link.classList.add('is-carregando');
      setTimeout(function () { link.classList.remove('is-carregando'); }, 3500);
    });
  });
})();
