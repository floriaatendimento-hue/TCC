(function () {
  'use strict';

  var main = document.querySelector('.admin-main');
  if (!main || !document.getElementById('dialog-confirmar-exclusao')) return;

  function csrfToken() {
    var el = document.getElementById('csrf-token');
    return el ? el.value : '';
  }

  function fecharDialog(dialog) { dialog.close(); }

  function ligarFechamento(dialog, btnFechar, btnCancelar) {
    btnFechar.addEventListener('click', function () { fecharDialog(dialog); });
    btnCancelar.addEventListener('click', function () { fecharDialog(dialog); });
    dialog.addEventListener('cancel', function (e) { e.preventDefault(); fecharDialog(dialog); });
    dialog.addEventListener('click', function (e) {
      var rect = dialog.getBoundingClientRect();
      var dentro = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!dentro) fecharDialog(dialog);
    });
  }

  var dialogConfirmarExclusao = document.getElementById('dialog-confirmar-exclusao');
  var confirmarExclusaoTexto  = document.getElementById('confirmar-exclusao-texto');
  var btnConfirmarExclusao    = document.getElementById('btn-confirmar-exclusao');
  var exclusaoPendente        = null;

  ligarFechamento(
    dialogConfirmarExclusao,
    document.getElementById('confirmar-exclusao-fechar'),
    document.getElementById('btn-cancelar-exclusao')
  );
  dialogConfirmarExclusao.addEventListener('close', function () { exclusaoPendente = null; });
  btnConfirmarExclusao.addEventListener('click', function () {
    var executar = exclusaoPendente;
    fecharDialog(dialogConfirmarExclusao);
    if (executar) executar();
  });

  function pedirConfirmacaoExclusao(texto, aoConfirmar) {
    confirmarExclusaoTexto.textContent = texto;
    exclusaoPendente = aoConfirmar;
    dialogConfirmarExclusao.showModal();
  }

  /* CATEGORIA */

  main.addEventListener('click', function (e) {
    var btnMover = e.target.closest('.js-mover-categoria');
    if (btnMover) {
      var card = btnMover.closest('.js-categoria-card');
      fetch('/api/admin/categorias/' + card.dataset.id + '/mover', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ direcao: btnMover.dataset.direcao }),
      })
        .then(function () { window.location.reload(); })
        .catch(function () { alert('Não foi possível reordenar agora.'); });
      return;
    }

    var btnExcluir = e.target.closest('.js-excluir-categoria');
    if (btnExcluir) {
      var nome = btnExcluir.dataset.nome;
      pedirConfirmacaoExclusao('Excluir a categoria "' + nome + '"? Essa ação não pode ser desfeita.', function () {
        fetch('/api/admin/categorias/' + btnExcluir.dataset.id, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { alert(data.message || 'Não foi possível excluir.'); return; }
            window.location.reload();
          })
          .catch(function () { alert('Erro de conexão. Tente novamente.'); });
      });
    }
  });

  main.addEventListener('change', function (e) {
    var toggle = e.target.closest('.js-toggle-ativa-categoria');
    if (!toggle) return;
    var card = toggle.closest('.js-categoria-card');
    var estadoAnterior = !toggle.checked;
    fetch('/api/admin/categorias/' + card.dataset.id + '/ativa', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken() },
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (!data || !data.ok) {
          toggle.checked = estadoAnterior;
          alert((data && data.message) || 'Não foi possível alternar o status agora.');
        }
      })
      .catch(function () {
        toggle.checked = estadoAnterior;
        alert('Erro de conexão. Tente novamente.');
      });
  });

  /* SUBCATEGORIA */

  main.addEventListener('click', function (e) {
    var btnMover = e.target.closest('.js-mover');
    if (btnMover && btnMover.closest('.js-tbody-subcategorias')) {
      var linha = btnMover.closest('tr');
      fetch('/api/admin/subcategorias/' + linha.dataset.id + '/mover', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ direcao: btnMover.dataset.direcao }),
      })
        .then(function () { window.location.reload(); })
        .catch(function () { alert('Não foi possível reordenar agora.'); });
      return;
    }

    var btnExcluir = e.target.closest('.js-excluir');
    if (btnExcluir && btnExcluir.closest('.js-tbody-subcategorias')) {
      pedirConfirmacaoExclusao('Excluir a subcategoria "' + btnExcluir.dataset.nome + '"? Produtos vinculados ficarão sem subcategoria.', function () {
        fetch('/api/admin/subcategorias/' + btnExcluir.dataset.id, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { alert(data.message || 'Não foi possível excluir.'); return; }
            window.location.reload();
          })
          .catch(function () { alert('Erro de conexão. Tente novamente.'); });
      });
    }
  });

  main.addEventListener('change', function (e) {
    var toggle = e.target.closest('.js-toggle-ativa');
    if (!toggle || !toggle.closest('.js-tbody-subcategorias')) return;
    var linha = toggle.closest('tr');
    var estadoAnterior = !toggle.checked;
    fetch('/api/admin/subcategorias/' + linha.dataset.id + '/ativa', {
      method: 'PATCH',
      headers: { 'X-CSRF-Token': csrfToken() },
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (!data || !data.ok) {
          toggle.checked = estadoAnterior;
          alert((data && data.message) || 'Não foi possível alternar o status agora.');
        }
      })
      .catch(function () {
        toggle.checked = estadoAnterior;
        alert('Erro de conexão. Tente novamente.');
      });
  });

  var inputBusca   = document.getElementById('cat-busca');
  var selectStatus = document.getElementById('cat-filtro-status');
  var semResultado = document.getElementById('categorias-sem-resultado');

  function aplicarFiltro() {
    var termo  = (inputBusca ? inputBusca.value : '').trim().toLowerCase();
    var status = selectStatus ? selectStatus.value : '';
    var algumCardVisivel = false;

    document.querySelectorAll('.js-categoria-card').forEach(function (card) {
      var catBateBusca  = !termo || (card.dataset.busca || '').indexOf(termo) !== -1;
      var catBateStatus = !status || card.dataset.status === status;

      var algumaSubVisivel = false;
      card.querySelectorAll('.js-subcategoria-row').forEach(function (row) {
        var subBateBusca  = !termo || catBateBusca || (row.dataset.busca || '').indexOf(termo) !== -1;
        var subBateStatus = !status || row.dataset.status === status;
        var visivel = subBateBusca && subBateStatus;
        row.hidden = !visivel;
        if (visivel) algumaSubVisivel = true;
      });

      var cardVisivel = (catBateBusca && catBateStatus) || algumaSubVisivel;
      card.hidden = !cardVisivel;
      if (cardVisivel) algumCardVisivel = true;
    });

    if (semResultado) semResultado.hidden = algumCardVisivel;
  }

  if (inputBusca)   inputBusca.addEventListener('input', aplicarFiltro);
  if (selectStatus) selectStatus.addEventListener('change', aplicarFiltro);
})();
