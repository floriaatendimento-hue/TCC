(function () {
  'use strict';

  var grade = document.getElementById('banners-grade');
  if (!grade) return;

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function toast(t, tipo) { if (window.mostrarToast) window.mostrarToast(t, tipo); }
  function toastAoRecarregar(t, tipo) { if (window.mostrarToastAoRecarregar) window.mostrarToastAoRecarregar(t, tipo); }

  var inputBusca   = document.getElementById('banners-busca');
  var abas         = Array.prototype.slice.call(document.querySelectorAll('.filtro-aba'));
  var selectOrdem  = document.getElementById('banners-ordenar');
  var vazioFiltro  = document.getElementById('banners-vazio-filtro');
  var statusAtual  = '';

  function cards() { return Array.prototype.slice.call(grade.querySelectorAll('.banner-card[data-id]')); }

  function aplicarFiltro() {
    var termo = (inputBusca ? inputBusca.value : '').trim().toLowerCase();
    var todos = cards();
    var visiveis = 0;
    todos.forEach(function (card) {
      var bateBusca = !termo || (card.dataset.busca || '').indexOf(termo) !== -1;
      var bateStatus = !statusAtual || card.dataset.status === statusAtual;
      var mostra = bateBusca && bateStatus;
      card.hidden = !mostra;
      if (mostra) visiveis++;
    });
    if (vazioFiltro) vazioFiltro.hidden = !(todos.length > 0 && visiveis === 0);
  }

  function aplicarOrdenacao() {
    var criterio = selectOrdem ? selectOrdem.value : 'ordem';
    var todos = cards();
    todos.sort(function (a, b) {
      if (criterio === 'nome') return (a.dataset.titulo || '').localeCompare(b.dataset.titulo || '', 'pt-BR');
      if (criterio === 'inicio') return Number(a.dataset.inicioTs || 0) - Number(b.dataset.inicioTs || 0);
      return Number(a.dataset.ordem || 0) - Number(b.dataset.ordem || 0);
    });
    todos.forEach(function (card) { grade.appendChild(card); });
  }

  if (inputBusca) inputBusca.addEventListener('input', aplicarFiltro);
  abas.forEach(function (aba) {
    aba.addEventListener('click', function () {
      abas.forEach(function (a) { a.classList.remove('is-ativa'); });
      aba.classList.add('is-ativa');
      statusAtual = aba.dataset.status || '';
      aplicarFiltro();
    });
  });
  if (selectOrdem) selectOrdem.addEventListener('change', aplicarOrdenacao);
  aplicarFiltro();

  function fecharMenus(exceto) {
    document.querySelectorAll('.acoes-menu[open]').forEach(function (det) {
      if (det !== exceto) det.removeAttribute('open');
    });
  }
  document.querySelectorAll('.acoes-menu > summary').forEach(function (summary) {
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      var det = summary.parentElement;
      var estavaAberto = det.hasAttribute('open');
      fecharMenus();
      if (!estavaAberto) det.setAttribute('open', '');
    });
  });
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.acoes-menu[open]').forEach(function (det) {
      if (!det.contains(e.target)) det.removeAttribute('open');
    });
  });

  function chamar(url, metodo, corpo) {
    var opcoes = { method: metodo, headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() } };
    if (corpo) { opcoes.headers['Content-Type'] = 'application/json'; opcoes.body = JSON.stringify(corpo); }
    return fetch(url, opcoes).then(function (r) { return r.json(); });
  }

  grade.addEventListener('click', function (e) {
    var card = e.target.closest('.banner-card[data-id]');
    if (!card) return;
    var id = card.dataset.id;

    var btnMover = e.target.closest('.js-mover');
    if (btnMover) {
      chamar('/api/admin/banners/' + id + '/mover', 'PATCH', { direcao: btnMover.dataset.direcao })
        .then(function () { window.location.reload(); })
        .catch(function () { toast('Não foi possível reordenar agora.', 'erro'); });
      return;
    }

    var btnDuplicar = e.target.closest('.js-duplicar');
    if (btnDuplicar) {
      fecharMenus();
      chamar('/api/admin/banners/' + id + '/duplicar', 'POST')
        .then(function (data) {
          if (!data.ok) { toast(data.message || 'Não foi possível duplicar.', 'erro'); return; }
          toastAoRecarregar('Banner duplicado como rascunho pausado.', 'sucesso');
          window.location.reload();
        })
        .catch(function () { toast('Erro de conexão. Tente novamente.', 'erro'); });
      return;
    }

    var btnToggle = e.target.closest('.js-toggle-ativo');
    if (btnToggle) {
      fecharMenus();
      var ativo = card.dataset.ativo === '1';
      chamar('/api/admin/banners/' + id + '/ativo', 'PATCH')
        .then(function (data) {
          if (!data.ok) { toast(data.message || 'Não foi possível alternar o status.', 'erro'); return; }
          toastAoRecarregar('Banner ' + (ativo ? 'pausado' : 'ativado') + '.', 'sucesso');
          window.location.reload();
        })
        .catch(function () { toast('Erro de conexão. Tente novamente.', 'erro'); });
      return;
    }

    var btnExcluir = e.target.closest('.js-excluir');
    if (btnExcluir) {
      fecharMenus();
      window.confirmarAdmin('Excluir o banner "' + card.dataset.titulo + '"? Essa ação não pode ser desfeita.', function () {
        chamar('/api/admin/banners/' + id, 'DELETE')
          .then(function (data) {
            if (!data.ok) { toast(data.message || 'Não foi possível excluir.', 'erro'); return; }
            toastAoRecarregar('Banner excluído.', 'sucesso');
            window.location.reload();
          })
          .catch(function () { toast('Erro de conexão. Tente novamente.', 'erro'); });
      });
      return;
    }
  });

  var arrastando = null;

  grade.addEventListener('dragstart', function (e) {
    var card = e.target.closest('.banner-card[data-id]');
    if (!card) return;
    arrastando = card;
    card.classList.add('is-arrastando');
    e.dataTransfer.effectAllowed = 'move';
    try { e.dataTransfer.setData('text/plain', card.dataset.id); } catch (err) {}
  });

  grade.addEventListener('dragover', function (e) {
    if (!arrastando) return;
    e.preventDefault();
    var alvo = e.target.closest('.banner-card[data-id]');
    if (!alvo || alvo === arrastando) return;
    var rect = alvo.getBoundingClientRect();
    var depois = (e.clientY - rect.top) > rect.height / 2;
    grade.insertBefore(arrastando, depois ? alvo.nextSibling : alvo);
  });

  grade.addEventListener('dragend', function () {
    if (!arrastando) return;
    arrastando.classList.remove('is-arrastando');
    var ids = cards().map(function (card) { return Number(card.dataset.id); });
    arrastando = null;
    if (selectOrdem) selectOrdem.value = 'ordem';
    chamar('/api/admin/banners/reordenar', 'PATCH', { ids: ids })
      .then(function (data) {
        if (!data.ok) { toast(data.message || 'Não foi possível salvar a nova ordem.', 'erro'); return; }
        toast('Ordem dos banners atualizada.', 'sucesso');
        cards().forEach(function (card, indice) { card.dataset.ordem = String(indice); });
      })
      .catch(function () { toast('Erro de conexão ao reordenar. Tente novamente.', 'erro'); });
  });
})();
