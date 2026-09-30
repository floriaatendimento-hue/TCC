(function () {
  'use strict';

  function csrfToken() {
    var el = document.getElementById('csrf-token');
    return el ? el.value : '';
  }

  /* Busca + filtro por status */
  var inputBusca = document.getElementById('filtro-busca');
  var abas = document.querySelectorAll('.filtro-aba');
  var statusAtual = '';

  function aplicarFiltroEm(tbodyId, vazioFiltroId) {
    var termo = (inputBusca ? inputBusca.value : '').trim().toLowerCase();
    var tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    var linhas = tbody.querySelectorAll('tr[data-id]');
    var visiveis = 0;
    linhas.forEach(function (tr) {
      var bateBusca = !termo || (tr.dataset.busca || '').indexOf(termo) !== -1;
      var bateStatus = !statusAtual || tr.dataset.status === statusAtual;
      var mostra = bateBusca && bateStatus;
      tr.hidden = !mostra;
      if (mostra) visiveis++;
    });
    var vazioFiltro = document.getElementById(vazioFiltroId);
    if (vazioFiltro) vazioFiltro.classList.toggle('is-visivel', linhas.length > 0 && visiveis === 0);
  }

  function aplicarFiltro() {
    aplicarFiltroEm('promocoes-tbody', 'promocoes-vazia-filtro');
    aplicarFiltroEm('cupons-tbody', 'cupons-vazia-filtro');
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
  aplicarFiltro();

  function posicionarMenu(details) {
    var summary = details.querySelector('summary');
    var menu = details.querySelector('menu');
    if (!summary || !menu) return;
    var rect = summary.getBoundingClientRect();
    var largura = menu.offsetWidth || 190;
    var esquerda = Math.max(8, Math.min(rect.right - largura, window.innerWidth - largura - 8));
    var topo = rect.bottom + 6;
    if (topo + menu.offsetHeight > window.innerHeight - 8) topo = rect.top - menu.offsetHeight - 6;
    menu.style.left = esquerda + 'px';
    menu.style.top = topo + 'px';
  }
  function fecharMenus(exceto) {
    document.querySelectorAll('.acoes-menu[open]').forEach(function (det) {
      if (det !== exceto) det.removeAttribute('open');
    });
  }
  document.querySelectorAll('.acoes-menu > summary').forEach(function (summary) {
    summary.addEventListener('click', function (e) {
      e.preventDefault();
      var det = summary.parentElement;
      var jaAberto = det.hasAttribute('open');
      fecharMenus();
      if (!jaAberto) {
        det.setAttribute('open', '');
        posicionarMenu(det);
      }
    });
  });
  document.addEventListener('click', function (e) {
    document.querySelectorAll('.acoes-menu[open]').forEach(function (det) {
      if (!det.contains(e.target)) det.removeAttribute('open');
    });
  });
  window.addEventListener('scroll', function () {
    var aberto = document.querySelector('.acoes-menu[open]');
    if (aberto) posicionarMenu(aberto);
  }, true);
  window.addEventListener('resize', function () { fecharMenus(); });

  var dialogDetalhes = document.getElementById('dialog-detalhes');
  var dialogDetalhesTitulo = document.getElementById('dialog-detalhes-titulo');
  var dialogDetalhesCorpo = document.getElementById('dialog-detalhes-corpo');
  var btnFecharDetalhes = document.getElementById('dialog-detalhes-fechar');

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function abrirDetalhes(tr) {
    if (!dialogDetalhes) return;
    var tabela = tr.closest('table');
    var titulos = Array.prototype.map.call(tabela.querySelectorAll('thead th'), function (th) { return th.textContent.trim(); });
    var celulas = tr.children;
    var linhas = '';
    for (var i = 0; i < titulos.length; i++) {
      if (titulos[i] === 'Ações' || !celulas[i]) continue;
      var texto = celulas[i].textContent.replace(/\s+/g, ' ').trim();
      linhas += '<li><small>' + escHtml(titulos[i]) + '</small><strong>' + escHtml(texto) + '</strong></li>';
    }
    dialogDetalhesTitulo.textContent = tr.dataset.nome || tr.dataset.codigo || 'Detalhes';
    dialogDetalhesCorpo.innerHTML = '<ul class="resumo-movimentacao">' + linhas + '</ul>';
    dialogDetalhes.showModal();
  }
  if (btnFecharDetalhes && dialogDetalhes) {
    btnFecharDetalhes.addEventListener('click', function () { dialogDetalhes.close(); });
    dialogDetalhes.addEventListener('cancel', function (e) { e.preventDefault(); dialogDetalhes.close(); });
    dialogDetalhes.addEventListener('click', function (e) {
      var rect = dialogDetalhes.getBoundingClientRect();
      var dentro = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!dentro) dialogDetalhes.close();
    });
  }

  /* Pedidos que usaram um cupom */
  var dialogPedidos = document.getElementById('dialog-pedidos-cupom');
  var dialogPedidosTitulo = document.getElementById('dialog-pedidos-titulo');
  var dialogPedidosCorpo = document.getElementById('dialog-pedidos-corpo');
  var btnFecharPedidos = document.getElementById('dialog-pedidos-fechar');

  function fmtBRL(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDataHora(d) { return new Intl.DateTimeFormat('pt-BR').format(new Date(d)); }

  function abrirPedidosDoCupom(id, codigo) {
    if (!dialogPedidos) return;
    dialogPedidosTitulo.textContent = 'Pedidos com o cupom ' + codigo;
    dialogPedidosCorpo.innerHTML = '<p class="tabela-admin__vazia">Carregando…</p>';
    dialogPedidos.showModal();
    fetch('/api/admin/cupons/' + id + '/pedidos')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { dialogPedidosCorpo.innerHTML = '<p class="tabela-admin__vazia">Não foi possível carregar os pedidos.</p>'; return; }
        if (!data.pedidos.length) { dialogPedidosCorpo.innerHTML = '<p class="tabela-admin__vazia">Nenhum pedido usou este cupom ainda.</p>'; return; }
        var linhas = data.pedidos.map(function (p) {
          return '<tr>' +
            '<td><a href="/pedido/' + p.id + '" target="_blank" rel="noopener">#' + p.id + '</a></td>' +
            '<td>' + fmtDataHora(p.criado_em) + '</td>' +
            '<td class="num">' + fmtBRL(p.total) + '</td>' +
            '<td class="num">' + fmtBRL(p.desconto) + '</td>' +
            '<td>' + p.status + '</td>' +
          '</tr>';
        }).join('');
        dialogPedidosCorpo.innerHTML =
          '<section class="tabela-scroll"><table class="tabela-admin">' +
            '<thead><tr><th>Pedido</th><th>Data</th><th class="num">Total</th><th class="num">Desconto</th><th>Status</th></tr></thead>' +
            '<tbody>' + linhas + '</tbody>' +
          '</table></section>';
      })
      .catch(function () { dialogPedidosCorpo.innerHTML = '<p class="tabela-admin__vazia">Erro de conexão. Tente novamente.</p>'; });
  }
  if (btnFecharPedidos && dialogPedidos) {
    btnFecharPedidos.addEventListener('click', function () { dialogPedidos.close(); });
    dialogPedidos.addEventListener('cancel', function (e) { e.preventDefault(); dialogPedidos.close(); });
    dialogPedidos.addEventListener('click', function (e) {
      var rect = dialogPedidos.getBoundingClientRect();
      var dentro = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      if (!dentro) dialogPedidos.close();
    });
  }

  function alternarAtivo(url, nomeParaToast, verbo) {
    fetch(url, { method: 'PATCH', headers: { 'X-CSRF-Token': csrfToken() } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { window.mostrarToast(data.message || 'Não foi possível alternar o status.', 'erro'); return; }
        window.mostrarToastAoRecarregar(nomeParaToast + ' ' + verbo + '.', 'sucesso');
        window.location.reload();
      })
      .catch(function () { window.mostrarToast('Erro de conexão. Tente novamente.', 'erro'); });
  }

  function excluir(url, nome, tipoLabel) {
    window.confirmarAdmin('Excluir ' + tipoLabel + ' "' + nome + '"? Essa ação não pode ser desfeita.', function () {
      fetch(url, { method: 'DELETE', headers: { 'X-CSRF-Token': csrfToken() } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) { window.mostrarToast(data.message || 'Não foi possível excluir.', 'erro'); return; }
          window.mostrarToastAoRecarregar(tipoLabel.charAt(0).toUpperCase() + tipoLabel.slice(1) + ' excluído(a).', 'sucesso');
          window.location.reload();
        })
        .catch(function () { window.mostrarToast('Erro de conexão. Tente novamente.', 'erro'); });
    });
  }

  function duplicarPromocao(tr) {
    try {
      var dados = JSON.parse(tr.dataset.duplicar || '{}');
      sessionStorage.setItem('floria-duplicar-promocao', JSON.stringify(dados));
    } catch (e) { /* segue sem pré-preencher */ }
    window.location.href = '/admin/promocoes/nova';
  }
  function duplicarCupom(tr) {
    try {
      var dados = JSON.parse(tr.dataset.duplicar || '{}');
      sessionStorage.setItem('floria-duplicar-cupom', JSON.stringify(dados));
    } catch (e) { /* segue sem pré-preencher */ }
    window.location.href = '/admin/cupons/novo';
  }

  /* Delegação de eventos — promoções */
  var tbodyPromocoes = document.getElementById('promocoes-tbody');
  if (tbodyPromocoes) {
    tbodyPromocoes.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (!tr) return;

      if (e.target.closest('.js-detalhes')) { fecharMenus(); return abrirDetalhes(tr); }
      if (e.target.closest('.js-duplicar-promocao')) { fecharMenus(); return duplicarPromocao(tr); }
      if (e.target.closest('.js-toggle-ativo-promocao')) {
        fecharMenus();
        var ativo = tr.dataset.ativo === '1';
        return alternarAtivo('/api/admin/promocoes/' + tr.dataset.id + '/ativo', 'Promoção', ativo ? 'pausada' : 'ativada');
      }
      if (e.target.closest('.js-excluir-promocao')) {
        fecharMenus();
        return excluir('/api/admin/promocoes/' + tr.dataset.id, tr.dataset.nome, 'a promoção');
      }
    });
  }

  /* Delegação de eventos — cupons */
  var tbodyCupons = document.getElementById('cupons-tbody');
  if (tbodyCupons) {
    tbodyCupons.addEventListener('click', function (e) {
      var tr = e.target.closest('tr[data-id]');
      if (!tr) return;

      if (e.target.closest('.js-detalhes')) { fecharMenus(); return abrirDetalhes(tr); }
      var btnPedidos = e.target.closest('.js-ver-pedidos');
      if (btnPedidos) { fecharMenus(); return abrirPedidosDoCupom(btnPedidos.dataset.id, btnPedidos.dataset.codigo); }
      if (e.target.closest('.js-duplicar-cupom')) { fecharMenus(); return duplicarCupom(tr); }
      if (e.target.closest('.js-toggle-ativo-cupom')) {
        fecharMenus();
        var ativo = tr.dataset.ativo === '1';
        return alternarAtivo('/api/admin/cupons/' + tr.dataset.id + '/ativo', 'Cupom', ativo ? 'pausado' : 'ativado');
      }
      if (e.target.closest('.js-excluir-cupom')) {
        fecharMenus();
        return excluir('/api/admin/cupons/' + tr.dataset.id, tr.dataset.codigo, 'o cupom');
      }
    });
  }
})();
