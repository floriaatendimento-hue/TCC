(function () {
  'use strict';

  var tabs        = document.getElementById('busca-tabs');
  var toggles      = document.getElementById('busca-toggles');
  var grid         = document.getElementById('busca-grid');
  var secaoResultados = document.getElementById('busca-resultados-section');
  var secaoVazia      = document.getElementById('busca-vazio-section');
  var vazioTermo   = document.getElementById('busca-vazio-termo');
  var contagem     = document.getElementById('busca-contagem-num');
  var inputQ       = document.getElementById('busca-page-input');
  var campoCategoria   = document.getElementById('busca-page-categoria');
  var campoPetFriendly = document.getElementById('busca-page-petfriendly');
  var campoPoucaLuz    = document.getElementById('busca-page-poucaluz');

  if (!tabs || !grid) return;

  var estado = {
    categoria:   (campoCategoria && campoCategoria.value) || '',
    petFriendly: !!(campoPetFriendly && campoPetFriendly.value),
    poucaLuz:    !!(campoPoucaLuz && campoPoucaLuz.value),
  };

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function normalizar(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  function formatPreco(valor) {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
  }

  function montarCard(p) {
    var preco = p.preco_exibido;
    var precoFmt = formatPreco(preco);
    var precoAntigo = p.preco_riscado ? formatPreco(p.preco_riscado) : null;
    var slugPagina = p.slug_pagina || p.slug;
    var href = '/' + slugPagina;
    var categoriaSlug = normalizar(p.categoria_nome);
    var novo = p.criado_em && (Date.now() - new Date(p.criado_em).getTime()) < 1000 * 60 * 60 * 24 * 30;
    var imgSrc = '/imagens/' + (p.imagem || 'image.png');

    var badge = '';
    if (p.destaque) {
      badge = '<b class="card-badge card-badge-vendida">Mais vendida</b>';
    } else if (novo) {
      badge = '<b class="card-badge card-badge-novo">Novo</b>';
    }

    var categoriaTag = p.categoria_nome
      ? '<b class="card-categoria">' + escHtml(p.categoria_nome) + '</b>'
      : '';

    var precoAntigoTag = precoAntigo ? '<p class="price-old">' + precoAntigo + '</p>' : '';

    var li = document.createElement('li');
    li.className = 'busca-card-item';
    li.dataset.categoria = categoriaSlug;
    li.innerHTML =
      '<article class="card card-home">' +
        '<a href="' + href + '">' +
          '<figure>' +
            badge +
            '<img src="' + imgSrc + '" alt="' + escHtml(p.nome) + '" loading="lazy" ' +
              'data-fallback="/imagens/image.png">' +
            '<button type="button" class="btn-favorito btn-favorito--card" ' +
              'data-slug="' + escHtml(slugPagina) + '" data-nome="' + escHtml(p.nome) + '" ' +
              'data-imagem="' + imgSrc + '" data-preco="' + preco + '" ' +
              'aria-label="Favoritar" aria-pressed="false">' +
              '<i class="far fa-heart" aria-hidden="true"></i>' +
            '</button>' +
          '</figure>' +
          '<section class="card-caption">' +
            categoriaTag +
            '<h3>' + escHtml(p.nome) + '</h3>' +
            '<output class="card-rating" data-rating-slot="' + escHtml(slugPagina) + '" data-rating-pendente>' +
              '<i class="card-rating-estrelas" aria-hidden="true"></i>' +
              '<b class="card-rating-qtd"></b>' +
            '</output>' +
            precoAntigoTag +
            '<p class="price">' + precoFmt + '</p>' +
          '</section>' +
        '</a>' +
        '<footer class="card-footer"><button type="button" class="btn-comprar">Adicionar</button></footer>' +
      '</article>';
    return li;
  }

  function renderizar(produtos) {
    grid.innerHTML = '';
    produtos.forEach(function (p) { grid.appendChild(montarCard(p)); });

    if (contagem) contagem.textContent = produtos.length;

    var temResultado = produtos.length > 0;
    if (secaoResultados) secaoResultados.hidden = !temResultado;
    if (secaoVazia)      secaoVazia.hidden = temResultado;

    if (vazioTermo) {
      var q = (inputQ && inputQ.value.trim()) || '';
      vazioTermo.textContent = q ? ('para "' + q + '"') : 'com esses filtros';
    }
  }

  function atualizarUrlECampos() {
    var params = new URLSearchParams();
    var q = (inputQ && inputQ.value.trim()) || '';
    if (q) params.set('q', q);
    if (estado.categoria)   params.set('categoria', estado.categoria);
    if (estado.petFriendly) params.set('petFriendly', '1');
    if (estado.poucaLuz)    params.set('poucaLuz', '1');

    var query = params.toString();
    var novaUrl = '/busca' + (query ? '?' + query : '');
    window.history.replaceState(null, '', novaUrl);

    if (campoCategoria)   campoCategoria.value = estado.categoria;
    if (campoPetFriendly) campoPetFriendly.value = estado.petFriendly ? '1' : '';
    if (campoPoucaLuz)    campoPoucaLuz.value = estado.poucaLuz ? '1' : '';
  }

  function aplicarEstadoVisual() {
    tabs.querySelectorAll('button[data-filtro]').forEach(function (b) {
      var ativo = b.dataset.filtro === estado.categoria;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-selected', ativo ? 'true' : 'false');
    });
    if (toggles) {
      toggles.querySelectorAll('button[data-toggle]').forEach(function (b) {
        var ativo = !!estado[b.dataset.toggle];
        b.classList.toggle('ativo', ativo);
        b.setAttribute('aria-pressed', ativo ? 'true' : 'false');
      });
    }
  }

  function buscar() {
    var params = new URLSearchParams();
    var q = (inputQ && inputQ.value.trim()) || '';
    if (q) params.set('q', q);
    if (estado.categoria)   params.set('categoria', estado.categoria);
    if (estado.petFriendly) params.set('petFriendly', '1');
    if (estado.poucaLuz)    params.set('poucaLuz', '1');
    params.set('limite', '100');

    grid.setAttribute('aria-busy', 'true');

    fetch('/api/produtos/filtrar?' + params.toString())
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderizar((data && data.ok && data.data) ? data.data : []);
      })
      .catch(function () {
        renderizar([]);
      })
      .finally(function () {
        grid.removeAttribute('aria-busy');
      });
  }

  tabs.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-filtro]');
    if (!btn) return;
    estado.categoria = btn.dataset.filtro || '';
    aplicarEstadoVisual();
    atualizarUrlECampos();
    buscar();
  });

  if (toggles) {
    toggles.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-toggle]');
      if (!btn) return;
      var chave = btn.dataset.toggle;
      estado[chave] = !estado[chave];
      aplicarEstadoVisual();
      atualizarUrlECampos();
      buscar();
    });
  }

})();
