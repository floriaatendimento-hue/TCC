(function () {
  'use strict';

  var tbody = document.getElementById('produtos-tbody');
  if (!tbody) return;

  var contagemEl      = document.getElementById('produtos-contagem');
  var buscaInput       = document.getElementById('produtos-busca');
  var filtroCategoria  = document.getElementById('produtos-filtro-categoria');
  var filtroStatus     = document.getElementById('produtos-filtro-status');
  var avisoSubcategoria     = document.getElementById('produtos-aviso-subcategoria');
  var avisoSubcategoriaTexto = document.getElementById('produtos-aviso-subcategoria-texto');

  var produtos = [];

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function fmtPreco(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }
  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function carregarCategorias() {
    return fetch('/api/categorias')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var categorias = (data && data.ok && Array.isArray(data.data)) ? data.data : [];
        var opcoesFiltro = '<option value="">Todas as categorias</option>';
        categorias.forEach(function (c) { opcoesFiltro += '<option value="' + c.id + '">' + escHtml(c.nome) + '</option>'; });
        if (filtroCategoria) filtroCategoria.innerHTML = opcoesFiltro;
      });
  }

  /* Carrega produtos */
  function carregarProdutos() {
    return fetch('/api/admin/produtos')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        produtos = (data && data.ok && Array.isArray(data.data)) ? data.data : [];
        atualizarAvisoSubcategoria();
        renderizarTabela();
      })
      .catch(function () {
        if (contagemEl) contagemEl.textContent = 'Não foi possível carregar os produtos.';
      });
  }

  function atualizarAvisoSubcategoria() {
    if (!avisoSubcategoria || !avisoSubcategoriaTexto) return;
    var semSubcategoria = produtos.filter(function (p) { return !p.subcategoria_id; }).length;
    if (!semSubcategoria) { avisoSubcategoria.hidden = true; return; }
    avisoSubcategoriaTexto.textContent = semSubcategoria + ' produto' + (semSubcategoria !== 1 ? 's' : '') +
      ' sem subcategoria definida. Edite cada um para completar a classificação.';
    avisoSubcategoria.hidden = false;
  }

  /* Renderização da tabela */
  function renderizarTabela() {
    var termo = normalizar(buscaInput ? buscaInput.value : '');
    var catId = filtroCategoria ? filtroCategoria.value : '';
    var status = filtroStatus ? filtroStatus.value : '';

    var filtrados = produtos.filter(function (p) {
      if (termo && normalizar(p.nome).indexOf(termo) === -1) return false;
      if (catId && String(p.categoria_id) !== String(catId)) return false;
      if (status === 'ativo' && !p.ativo) return false;
      if (status === 'inativo' && p.ativo) return false;
      return true;
    });

    if (contagemEl) {
      contagemEl.textContent = filtrados.length + ' produto' + (filtrados.length !== 1 ? 's' : '') + ' encontrado' + (filtrados.length !== 1 ? 's' : '');
    }

    if (!filtrados.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="tabela-admin__vazia">Nenhum produto encontrado.</td></tr>';
      return;
    }

    tbody.innerHTML = filtrados.map(function (p) {
      var nome = escHtml(p.nome);
      var img = p.imagem ? (p.imagem.indexOf('/') === 0 ? p.imagem : '/imagens/' + p.imagem) : '/imagens/image.png';
      var precoHtml = p.preco_promo
        ? '<s class="texto-fraco">' + fmtPreco(p.preco) + '</s> ' + fmtPreco(p.preco_promo)
        : fmtPreco(p.preco);
      var estoqueBaixo = Number(p.estoque) <= Number(p.estoque_minimo || 5);
      var estoqueHtml = '<b class="badge ' + (estoqueBaixo ? 'badge--vermelho' : 'badge--verde') + '">' + p.estoque + '</b>';
      var subcategoriaHtml = p.subcategoria_nome
        ? escHtml(p.subcategoria_nome)
        : '<b class="badge badge--aviso">Sem subcategoria</b>';
      var statusHtml = '<label class="toggle"><input type="checkbox" class="js-toggle-status" data-id="' + p.id + '" data-ativo="' + p.ativo + '" aria-label="Produto ativo: ' + nome + '" ' + (p.ativo ? 'checked' : '') + '><i class="toggle__trilho" aria-hidden="true"></i></label>';

      return (
        '<tr data-id="' + p.id + '">' +
          '<td><img src="' + img + '" alt="" class="tabela-admin__thumb" data-fallback="/imagens/image.png"></td>' +
          '<td><strong>' + nome + '</strong></td>' +
          '<td>' + (p.categoria_nome ? escHtml(p.categoria_nome) : '-') + '</td>' +
          '<td>' + subcategoriaHtml + '</td>' +
          '<td class="num">' + precoHtml + '</td>' +
          '<td class="num">' + estoqueHtml + '</td>' +
          '<td>' + statusHtml + '</td>' +
          '<td class="acoes-tabela">' +
            '<a href="/admin/produtos/' + p.id + '/editar">Editar</a>' +
            '<button type="button" class="excluir js-excluir" data-id="' + p.id + '" data-nome="' + nome + '">Excluir</button>' +
          '</td>' +
        '</tr>'
      );
    }).join('');
  }

  if (buscaInput) buscaInput.addEventListener('input', renderizarTabela);
  if (filtroCategoria) filtroCategoria.addEventListener('change', renderizarTabela);
  if (filtroStatus) filtroStatus.addEventListener('change', renderizarTabela);

  tbody.addEventListener('click', function (e) {
    var excluirBtn = e.target.closest('.js-excluir');
    if (!excluirBtn) return;
    window.confirmarAdmin('Excluir "' + excluirBtn.dataset.nome + '"? O produto será desativado (soft-delete).', function () {
      fetch('/api/produtos/' + excluirBtn.dataset.id, { method: 'DELETE', headers: { 'X-CSRF-Token': csrfToken() } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) { alert(data.message || 'Não foi possível excluir.'); return; }
          carregarProdutos();
        })
        .catch(function () { alert('Erro de conexão. Tente novamente.'); });
    });
  });

  tbody.addEventListener('change', function (e) {
    var toggle = e.target.closest('.js-toggle-status');
    if (!toggle) return;
    var ativoAtual = toggle.dataset.ativo === '1' || toggle.dataset.ativo === 'true';
    fetch('/api/produtos/' + toggle.dataset.id + '/ativo', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify({ ativo: !ativoAtual }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { alert(data.message || 'Não foi possível alternar o status.'); toggle.checked = ativoAtual; return; }
        carregarProdutos();
      })
      .catch(function () { alert('Erro de conexão.'); toggle.checked = ativoAtual; });
  });

  carregarCategorias().then(carregarProdutos);
})();
