/* alterarQtd — escopo GLOBAL */
function alterarQtd(delta) {
  var input = document.getElementById('qtd');
  if (!input) return;
  var atual = parseInt(input.value, 10);
  if (isNaN(atual) || atual < 1) atual = 1;
  var novo = Math.max(1, atual + delta);
  var max = parseInt(input.max, 10);
  if (!isNaN(max) && max > 0) novo = Math.min(novo, max);
  input.value = String(novo);

  /* Feedback visual suave */
  input.style.transition = 'transform 0.12s ease';
  input.style.transform  = 'scale(1.15)';
  setTimeout(function () { input.style.transform = 'scale(1)'; }, 130);
}

/* Core do carrinho */
(function () {

  /* Helpers localStorage */
  function lerCarrinho() {
    try { return JSON.parse(localStorage.getItem('carrinho')) || []; }
    catch (e) { return []; }
  }
  function salvarCarrinho(c) {
    localStorage.setItem('carrinho', JSON.stringify(c));
  }

  function atualizarBadge() {
    var c = lerCarrinho();
    var total = c.reduce(function (s, p) { return s + (parseInt(p.quantidade, 10) || 0); }, 0);
    var badge = document.querySelector(
      '.cart-badge, .carrinho-badge, [data-badge], .badge-carrinho, #cart-count'
    );
    if (badge) {
      badge.textContent = total > 0 ? total : '';
      badge.style.display = total > 0 ? 'flex' : 'none';
    }
  }

  document.addEventListener('carrinho:atualizado', atualizarBadge);
  window.addEventListener('storage', function (e) {
    if (e.key === 'carrinho') atualizarBadge();
  });

  var TOAST_DURACAO_MS    = 4200;
  var TOAST_TRANSICAO_MS  = 260;
  var toastEl        = null;
  var toastTimerFechar = null;
  var toastTimerOcultar = null;

  function formatarPrecoToast(v) {
    return 'R$ ' + Number(v).toFixed(2).replace('.', ',');
  }

  function montarToast() {
    var aside = document.createElement('aside');
    aside.id = 'floria-toast';
    aside.className = 'floria-toast';
    aside.setAttribute('role', 'status');
    aside.setAttribute('aria-live', 'polite');
    aside.setAttribute('aria-atomic', 'true');
    aside.setAttribute('aria-labelledby', 'floria-toast-titulo');
    aside.hidden = true;

    var artigo = document.createElement('article');
    artigo.className = 'floria-toast-card';

    var cabecalho = document.createElement('header');
    cabecalho.className = 'floria-toast-cabecalho';

    var icone = document.createElement('i');
    icone.className = 'floria-toast-icone';
    icone.setAttribute('aria-hidden', 'true');
    icone.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';

    var titulo = document.createElement('p');
    titulo.className = 'floria-toast-titulo';
    titulo.id = 'floria-toast-titulo';
    titulo.textContent = 'Produto adicionado ao carrinho com sucesso.';

    var btnFechar = document.createElement('button');
    btnFechar.type = 'button';
    btnFechar.className = 'floria-toast-fechar';
    btnFechar.setAttribute('aria-label', 'Fechar notificação');
    btnFechar.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
    btnFechar.addEventListener('click', fecharToast);

    cabecalho.append(icone, titulo, btnFechar);

    var corpo = document.createElement('section');
    corpo.className = 'floria-toast-corpo';

    var figura = document.createElement('figure');
    figura.className = 'floria-toast-figura';
    var img = document.createElement('img');
    img.className = 'floria-toast-imagem';
    img.alt = '';
    figura.appendChild(img);

    var info = document.createElement('section');
    info.className = 'floria-toast-info';

    var nomeEl = document.createElement('p');
    nomeEl.className = 'floria-toast-nome';

    var variacaoEl = document.createElement('p');
    variacaoEl.className = 'floria-toast-variacao';

    var detalhesEl = document.createElement('p');
    detalhesEl.className = 'floria-toast-detalhes';
    var qtdEl = document.createElement('b');
    qtdEl.className = 'floria-toast-qtd';
    var precoEl = document.createElement('b');
    precoEl.className = 'floria-toast-preco';
    detalhesEl.append(qtdEl, precoEl);

    info.append(nomeEl, variacaoEl, detalhesEl);
    corpo.append(figura, info);

    var acoes = document.createElement('footer');
    acoes.className = 'floria-toast-acoes';

    var btnContinuar = document.createElement('button');
    btnContinuar.type = 'button';
    btnContinuar.className = 'floria-toast-btn floria-toast-btn-secundario';
    btnContinuar.textContent = 'Continuar comprando';
    btnContinuar.addEventListener('click', fecharToast);

    var linkCarrinho = document.createElement('a');
    linkCarrinho.className = 'floria-toast-btn floria-toast-btn-primario';
    linkCarrinho.href = '/carrinho';
    linkCarrinho.textContent = 'Ver carrinho';

    acoes.append(btnContinuar, linkCarrinho);

    var progresso = document.createElement('output');
    progresso.className = 'floria-toast-progresso';
    progresso.setAttribute('aria-hidden', 'true');

    artigo.append(cabecalho, corpo, acoes, progresso);
    aside.appendChild(artigo);
    document.body.appendChild(aside);
    return aside;
  }

  function fecharToast() {
    if (!toastEl || toastEl.hidden) return;
    clearTimeout(toastTimerFechar);
    toastEl.classList.remove('aberto');
    clearTimeout(toastTimerOcultar);
    toastTimerOcultar = setTimeout(function () {
      toastEl.hidden = true;
    }, TOAST_TRANSICAO_MS);
  }

  function mostrarToast(dados) {
    if (!toastEl) toastEl = montarToast();
    var artigo = toastEl.querySelector('.floria-toast-card');
    var qtd = Math.max(1, parseInt(dados.quantidade, 10) || 1);

    toastEl.querySelector('.floria-toast-nome').textContent = dados.nome || 'Produto';

    var variacaoEl = toastEl.querySelector('.floria-toast-variacao');
    if (dados.cor) {
      variacaoEl.textContent = 'Variação: ' + dados.cor;
      variacaoEl.hidden = false;
    } else {
      variacaoEl.hidden = true;
    }

    toastEl.querySelector('.floria-toast-qtd').textContent =
      'Qtd: ' + qtd;

    var precoEl = toastEl.querySelector('.floria-toast-preco');
    if (dados.preco) {
      precoEl.textContent = formatarPrecoToast(dados.preco);
      precoEl.hidden = false;
    } else {
      precoEl.hidden = true;
    }

    var figura = toastEl.querySelector('.floria-toast-figura');
    var img = toastEl.querySelector('.floria-toast-imagem');
    if (dados.imagem) {
      img.src = dados.imagem;
      img.alt = dados.nome || '';
      figura.hidden = false;
    } else {
      figura.hidden = true;
    }

    if (!toastEl.hidden && toastEl.classList.contains('aberto')) {
      artigo.classList.remove('atualizado');
      void artigo.offsetWidth;
      artigo.classList.add('atualizado');
    }

    clearTimeout(toastTimerOcultar);
    toastEl.hidden = false;
    void toastEl.offsetWidth;
    toastEl.classList.add('aberto');

    var barra = toastEl.querySelector('.floria-toast-progresso');
    barra.style.animation = 'none';
    void barra.offsetWidth;
    barra.style.animation = 'floriaToastProgresso ' + (TOAST_DURACAO_MS / 1000) + 's linear forwards';

    clearTimeout(toastTimerFechar);
    toastTimerFechar = setTimeout(fecharToast, TOAST_DURACAO_MS);
  }

  /* Adiciona ao carrinho */
  function adicionarAoCarrinho(nome, preco, imagem, quantidade, cor, link) {
    quantidade = Math.max(1, parseInt(quantidade, 10) || 1);
    preco = parseFloat(preco) || 0;
    cor = cor || null;
    link = link || null;

    var c = lerCarrinho();
    var item = c.find(function (p) { return p.nome === nome && (p.cor || null) === cor; });

    if (item) {
      item.quantidade += quantidade;
      if (link && !item.link) item.link = link;
    } else {
      var novoItem = { nome: nome, preco: preco, imagem: imagem, quantidade: quantidade };
      if (cor) novoItem.cor = cor;
      if (link) novoItem.link = link;
      c.push(novoItem);
    }

    salvarCarrinho(c);
    atualizarBadge();
    document.dispatchEvent(new CustomEvent('carrinho:atualizado'));

    mostrarToast({ nome: nome, imagem: imagem, cor: cor, quantidade: quantidade, preco: preco });
  }

  /* Página de DETALHES */

  function montarItemDaPagina() {
    var qtdInput = document.getElementById('qtd');
    var qtd = 1;
    if (qtdInput) {
      qtd = parseInt(qtdInput.value, 10);
      if (isNaN(qtd) || qtd < 1) qtd = 1;
    }

    var nome = '';
    var h1 = document.querySelector('h1');
    if (h1) nome = h1.innerText.trim();
    if (!nome) nome = 'Produto';

    var preco = 0;
    var precoEl = document.querySelector('.preco-novo');
    if (precoEl) {
      preco = parseFloat(
        precoEl.innerText.replace(/[^\d,]/g, '').replace(',', '.')
      ) || 0;
    }

    var imgEl = document.getElementById('imgPrincipal')
             || document.querySelector('.imagem-principal img')
             || document.querySelector('.galeria figure img');
    var imagem = imgEl ? imgEl.src : '';

    var gruposVariacao = document.querySelectorAll('fieldset.cores');
    var cor = null;
    if (gruposVariacao.length) {
      var rotulos = Array.prototype.map.call(gruposVariacao, function (g) {
        return g.dataset.corSelecionada || '';
      }).filter(Boolean);
      if (rotulos.length) cor = rotulos.join(' · ');
    }

    var link = window.location.pathname;

    return { nome: nome, preco: preco, imagem: imagem, quantidade: qtd, cor: cor, link: link };
  }

  document.addEventListener('DOMContentLoaded', function () {
    atualizarBadge();

    var btnAdd = document.querySelector('.btn-add');
    if (btnAdd) {
      btnAdd.addEventListener('click', function () {
        var d = montarItemDaPagina();
        adicionarAoCarrinho(d.nome, d.preco, d.imagem, d.quantidade, d.cor, d.link);
      });
    }

    var btnComprarAgora = document.querySelector('.btn-comprar-agora');
    if (btnComprarAgora) {
      btnComprarAgora.addEventListener('click', function () {
        var d = montarItemDaPagina();
        adicionarAoCarrinho(d.nome, d.preco, d.imagem, d.quantidade, d.cor, d.link);
        window.location.href = '/pagamento';
      });
    }
  });

  function aplicarEstoque(estoque, estoqueMinimo) {
    var btnAdd    = document.querySelector('.btn-add');
    var btnComprarAgora = document.querySelector('.btn-comprar-agora');
    var qtdInput  = document.getElementById('qtd');
    var acaoWrap  = document.querySelector('.acao-produto');
    var esgotado  = estoque <= 0;
    var limiar    = estoqueMinimo > 0 ? estoqueMinimo : 5;
    var estoqueBaixo = !esgotado && estoque <= limiar;

    if (qtdInput) {
      qtdInput.max = String(Math.max(1, estoque));
      var atual = parseInt(qtdInput.value, 10) || 1;
      if (esgotado) qtdInput.value = '1';
      else if (atual > estoque) qtdInput.value = String(estoque);
    }

    if (btnAdd) {
      btnAdd.disabled = esgotado;
      btnAdd.setAttribute('aria-disabled', esgotado ? 'true' : 'false');
    }
    if (btnComprarAgora) {
      btnComprarAgora.disabled = esgotado;
      btnComprarAgora.setAttribute('aria-disabled', esgotado ? 'true' : 'false');
    }

    if (acaoWrap) {
      var status = document.getElementById('estoque-status');
      if (!status) {
        status = document.createElement('output');
        status.id = 'estoque-status';
        status.className = 'estoque-status';
        acaoWrap.insertAdjacentElement('afterend', status);
      }
      if (esgotado) {
        status.textContent = 'Produto indisponível';
        status.className = 'estoque-status estoque-status-esgotado';
        status.hidden = false;
      } else if (estoqueBaixo) {
        status.textContent = 'Últimas unidades: restam ' + estoque + '.';
        status.className = 'estoque-status estoque-status-baixo';
        status.hidden = false;
      } else {
        status.hidden = true;
      }
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var campoFavorito = document.querySelector('.btn-favorito[data-slug]');
    var estaEmPaginaDeProduto = document.querySelector('.btn-add') || document.getElementById('qtd');
    if (!campoFavorito || !estaEmPaginaDeProduto) return;

    fetch('/api/produtos/' + encodeURIComponent(campoFavorito.dataset.slug) + '/estoque')
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (data) {
        if (data && data.ok) aplicarEstoque(Number(data.estoque) || 0, Number(data.estoque_minimo) || 0);
      })
      .catch(function () {   });
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.qty-btn[data-qty-delta]');
    if (!btn) return;
    alterarQtd(parseInt(btn.dataset.qtyDelta, 10) || 0);
  });

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-comprar');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();

    var card = btn.closest('.card');
    if (!card) return;

    var nome = '';
    var nEl = card.querySelector('h3, h4');
    if (nEl) nome = nEl.innerText.trim();
    if (!nome) nome = 'Produto';

    var preco = 0;
    var pEl = card.querySelector('.price');
    if (pEl) {
      preco = parseFloat(pEl.innerText.replace(/[^\d,]/g, '').replace(',', '.')) || 0;
    }

    var imagem = '';
    var iEl = card.querySelector('img');
    if (iEl) imagem = iEl.src;

    var linkEl = card.querySelector('a[href]');
    var link = linkEl ? linkEl.getAttribute('href') : null;

    var adicionado = adicionarAoCarrinho(nome, preco, imagem, 1, null, link);
    if (adicionado === false) return;

    btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i> Adicionado';
    btn.style.background = '#b8945f';
    setTimeout(function () {
      btn.textContent = 'Comprar';
      btn.style.background = '';
    }, 1600);
  });

})();
