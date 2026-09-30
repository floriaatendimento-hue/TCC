(function () {
  'use strict';

  var secao = document.querySelector('.relacionados[data-slug-atual]');
  if (!secao) return;

  var ul = document.getElementById('relacionados-cards');
  if (!ul) return;

  var slugAtual = secao.dataset.slugAtual || '';
  var categoria = secao.dataset.categoria || '';

  function fmtPreco(v) {
    return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  }

  function estrelasHtml(media) {
    var cheias = Math.round(Number(media) || 0);
    var s = '';
    for (var i = 1; i <= 5; i++) {
      s += i <= cheias
        ? '<i class="fas fa-star" aria-hidden="true"></i>'
        : '<i class="far fa-star" aria-hidden="true"></i>';
    }
    return s;
  }

  function criarCard(p) {
    var slugPagina  = p.slug_pagina || p.slug;
    var precoAtual  = p.preco_exibido;
    var precoAntigo = p.preco_riscado;
    var href        = '/' + slugPagina;
    var imagemSrc   = '/imagens/' + (p.imagem || 'image.png');
    var media       = Number(p.media_avaliacoes) || 0;
    var qtd         = Number(p.qtd_avaliacoes) || 0;
    var semEstoque  = Number(p.estoque) <= 0;

    var li = document.createElement('li');

    var article = document.createElement('article');
    article.className = 'card card-home';

    var a = document.createElement('a');
    a.href = href;

    var figure = document.createElement('figure');

    if (p.selo) {
      var badge = document.createElement('b');
      badge.className = 'card-badge ' + (p.selo === 'Novo' ? 'card-badge-novo' : 'card-badge-vendida');
      badge.textContent = p.selo;
      figure.appendChild(badge);
    }

    var img = document.createElement('img');
    img.src = imagemSrc;
    img.alt = p.nome || 'Produto';
    img.loading = 'lazy';
    img.addEventListener('error', function () {
      this.onerror = null;
      this.src = '/imagens/image.png';
    });
    figure.appendChild(img);

    var btnFav = document.createElement('button');
    btnFav.type = 'button';
    btnFav.className = 'btn-favorito btn-favorito--card';
    btnFav.dataset.slug   = slugPagina;
    btnFav.dataset.nome   = p.nome || '';
    btnFav.dataset.imagem = imagemSrc;
    btnFav.dataset.preco  = precoAtual;
    btnFav.setAttribute('aria-label', 'Favoritar');
    btnFav.setAttribute('aria-pressed', 'false');
    btnFav.innerHTML = '<i class="far fa-heart" aria-hidden="true"></i>';
    figure.appendChild(btnFav);

    a.appendChild(figure);

    var caption = document.createElement('section');
    caption.className = 'card-caption';

    if (p.categoria_nome) {
      var cat = document.createElement('b');
      cat.className = 'card-categoria';
      cat.textContent = p.categoria_nome;
      caption.appendChild(cat);
    }

    var h3 = document.createElement('h3');
    h3.textContent = p.nome || 'Produto';
    caption.appendChild(h3);

    if (p.descricao) {
      var desc = document.createElement('p');
      desc.className = 'card-desc';
      desc.textContent = p.descricao;
      caption.appendChild(desc);
    }

    var rating = document.createElement('p');
    rating.className = 'card-rating';
    var estrelasEl = document.createElement('i');
    estrelasEl.className = 'card-rating-estrelas';
    estrelasEl.setAttribute('aria-hidden', 'true');
    estrelasEl.innerHTML = estrelasHtml(media);
    rating.appendChild(estrelasEl);
    var qtdEl = document.createElement('b');
    qtdEl.className = 'card-rating-qtd';
    qtdEl.textContent = qtd > 0 ? '(' + qtd + ')' : 'Sem avaliações';
    rating.appendChild(qtdEl);
    if (qtd > 0) {
      var notaFormatada = (Math.round(Number(media) * 10) / 10).toString().replace('.', ',');
      rating.setAttribute('aria-label', 'Avaliação: ' + notaFormatada + ' de 5 estrelas (' + qtd + ' avaliação' + (qtd !== 1 ? 'ões' : '') + ').');
    } else {
      rating.setAttribute('aria-label', 'Ainda sem avaliações.');
    }
    caption.appendChild(rating);

    if (precoAntigo) {
      var pOld = document.createElement('p');
      pOld.className = 'price-old';
      pOld.textContent = fmtPreco(precoAntigo);
      caption.appendChild(pOld);
    }
    var pNew = document.createElement('p');
    pNew.className = 'price';
    pNew.textContent = fmtPreco(precoAtual);
    caption.appendChild(pNew);

    a.appendChild(caption);
    article.appendChild(a);

    var footer = document.createElement('footer');
    footer.className = 'card-footer';
    var btnComprar = document.createElement('button');
    btnComprar.type = 'button';
    btnComprar.className = 'btn-comprar';
    if (semEstoque) {
      btnComprar.disabled = true;
      btnComprar.textContent = 'Esgotado';
    } else {
      btnComprar.textContent = 'Adicionar';
    }
    footer.appendChild(btnComprar);
    article.appendChild(footer);

    li.appendChild(article);
    return li;
  }

  function esconderSecao() {
    secao.style.display = 'none';
  }

  var url = '/api/produtos/' + encodeURIComponent(slugAtual) + '/relacionados?limite=8';
  if (categoria) url += '&categoria=' + encodeURIComponent(categoria);

  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function (data) {
      var produtos = (data && data.ok && Array.isArray(data.data)) ? data.data : [];
      ul.innerHTML = '';
      ul.removeAttribute('aria-busy');
      if (!produtos.length) {
        esconderSecao();
        return;
      }
      produtos.forEach(function (p) { ul.appendChild(criarCard(p)); });
    })
    .catch(function () {
      esconderSecao();
    });
})();
