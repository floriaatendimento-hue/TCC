(function () {
  'use strict';

  var wrapper      = document.querySelector('.carrinho-item');
  var trigger      = document.getElementById('cart-trigger');
  var painel       = document.getElementById('mini-cart-panel');
  var btnFechar    = document.getElementById('mini-cart-fechar');
  var corpo        = document.getElementById('mini-cart-corpo');
  var rodape       = document.getElementById('mini-cart-rodape');
  var elQtdTotal   = document.getElementById('mini-cart-qtd-total');
  var elSubtotal   = document.getElementById('mini-cart-subtotal-total');
  var btnFinalizar = document.getElementById('mini-cart-finalizar');
  var badge        = document.getElementById('cart-count');

  if (!wrapper || !trigger || !painel) return;

  var suportaHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var TRANSICAO_MS = 220;
  var fechando = null;

  /* LocalStorage */
  function lerCarrinho() {
    try { return JSON.parse(localStorage.getItem('carrinho')) || []; }
    catch (e) { return []; }
  }
  function salvarCarrinho(c) {
    localStorage.setItem('carrinho', JSON.stringify(c));
  }
  function notificarMudanca() {
    document.dispatchEvent(new CustomEvent('carrinho:atualizado'));
  }

  function fmt(valor) {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
  }

  var svgTrash =
    '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    '<polyline points="3 6 5 6 21 6"/>' +
    '<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>' +
    '<path d="M10 11v6M14 11v6"/>' +
    '<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>' +
    '</svg>';

  /* Badge de quantidade no ícone */
  function atualizarBadge(totalItens) {
    if (!badge) return;
    badge.textContent = totalItens > 0 ? totalItens : '';
    badge.style.display = totalItens > 0 ? 'flex' : 'none';
  }
  function totalDeItens(carrinho) {
    return carrinho.reduce(function (s, i) { return s + (parseInt(i.quantidade, 10) || 0); }, 0);
  }

  /* Monta um item */
  function criarItemEl(item, index) {
    var preco = parseFloat(item.preco) || 0;
    var subtotal = preco * item.quantidade;
    var link = item.link || null;

    var el = document.createElement('li');
    el.className = 'mini-cart-item';

    var imgWrap = document.createElement(link ? 'a' : 'figure');
    imgWrap.className = 'mini-cart-img-wrap';
    if (link) {
      imgWrap.href = link;
      imgWrap.setAttribute('aria-label', 'Ver detalhes de ' + item.nome);
    }
    var img = document.createElement('img');
    img.className = 'mini-cart-img';
    img.src = item.imagem || '/imagens/image.png';
    img.alt = item.nome;
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    var info = document.createElement('section');
    info.className = 'mini-cart-info';

    var nome = document.createElement('p');
    nome.className = 'mini-cart-nome';
    nome.textContent = item.nome;
    if (link) {
      var nomeLink = document.createElement('a');
      nomeLink.href = link;
      nomeLink.appendChild(nome);
      info.appendChild(nomeLink);
    } else {
      info.appendChild(nome);
    }

    if (item.cor) {
      var cor = document.createElement('p');
      cor.className = 'mini-cart-cor';
      cor.textContent = 'Variação: ' + item.cor;
      if (link) {
        var corLink = document.createElement('a');
        corLink.href = link;
        corLink.appendChild(cor);
        info.appendChild(corLink);
      } else {
        info.appendChild(cor);
      }
    }

    var linhaQty = document.createElement('section');
    linhaQty.className = 'mini-cart-linha-qty';

    var qtyWrap = document.createElement('section');
    qtyWrap.className = 'qty-wrapper mini-cart-qty-wrapper';

    var btnMenos = document.createElement('button');
    btnMenos.type = 'button';
    btnMenos.className = 'btn-menos';
    btnMenos.dataset.index = index;
    btnMenos.setAttribute('aria-label', 'Diminuir quantidade');
    btnMenos.textContent = '−';

    var qtyNum = document.createElement('output');
    qtyNum.className = 'qty-num';
    qtyNum.textContent = item.quantidade;

    var btnMais = document.createElement('button');
    btnMais.type = 'button';
    btnMais.className = 'btn-mais';
    btnMais.dataset.index = index;
    btnMais.setAttribute('aria-label', 'Aumentar quantidade');
    btnMais.textContent = '+';

    qtyWrap.append(btnMenos, qtyNum, btnMais);

    var btnRemover = document.createElement('button');
    btnRemover.type = 'button';
    btnRemover.className = 'mini-cart-remover';
    btnRemover.dataset.index = index;
    btnRemover.setAttribute('aria-label', 'Remover ' + item.nome);
    btnRemover.innerHTML = svgTrash;

    linhaQty.append(qtyWrap, btnRemover);
    info.appendChild(linhaQty);

    var precos = document.createElement('section');
    precos.className = 'mini-cart-precos';

    var precoUnit = document.createElement('small');
    precoUnit.className = 'mini-cart-preco-unit';
    precoUnit.textContent = fmt(preco) + ' / un.';

    var itemSubtotal = document.createElement('strong');
    itemSubtotal.className = 'mini-cart-item-subtotal';
    itemSubtotal.textContent = fmt(subtotal);

    precos.append(precoUnit, itemSubtotal);
    info.appendChild(precos);

    el.append(imgWrap, info);
    return { el: el, subtotal: subtotal };
  }

  /* Renderiza o conteúdo do painel */
  function render() {
    var carrinho = lerCarrinho();
    atualizarBadge(totalDeItens(carrinho));

    corpo.innerHTML = '';

    if (carrinho.length === 0) {
      rodape.hidden = true;
      var vazio = document.createElement('li');
      vazio.className = 'mini-cart-vazio';
      vazio.innerHTML =
        '<i class="mini-cart-vazio-icone" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>' +
            '<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>' +
          '</svg>' +
        '</i>' +
        '<p class="mini-cart-vazio-msg">Seu carrinho está vazio.</p>' +
        '<a href="/" class="mini-cart-btn mini-cart-btn-primario">Continuar Comprando</a>';
      corpo.appendChild(vazio);
      return;
    }

    var totalGeral = 0;
    carrinho.forEach(function (item, index) {
      var criado = criarItemEl(item, index);
      totalGeral += criado.subtotal;
      corpo.appendChild(criado.el);
    });

    if (elQtdTotal) elQtdTotal.textContent = totalDeItens(carrinho);
    if (elSubtotal) elSubtotal.textContent = fmt(totalGeral);
    rodape.hidden = false;

    vincularEventosItens();
  }

  function vincularEventosItens() {
    corpo.querySelectorAll('.btn-mais').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = lerCarrinho();
        var i = Number(btn.dataset.index);
        if (!c[i]) return;
        c[i].quantidade++;
        salvarCarrinho(c);
        notificarMudanca();
      });
    });

    corpo.querySelectorAll('.btn-menos').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = lerCarrinho();
        var i = Number(btn.dataset.index);
        if (!c[i]) return;
        if (c[i].quantidade > 1) {
          c[i].quantidade--;
        } else {
          c.splice(i, 1);
        }
        salvarCarrinho(c);
        notificarMudanca();
      });
    });

    corpo.querySelectorAll('.mini-cart-remover').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = lerCarrinho();
        c.splice(Number(btn.dataset.index), 1);
        salvarCarrinho(c);
        notificarMudanca();
      });
    });
  }

  /* Abrir / fechar */
  function abrir() {
    clearTimeout(fechando);
    clearTimeout(hoverFechando);
    var jaAberto = !painel.hidden && painel.classList.contains('aberto');
    if (!jaAberto) render();
    painel.hidden = false;
    void painel.offsetWidth;
    painel.classList.add('aberto');
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('click', aoClicarFora, true);
    document.addEventListener('keydown', aoTeclado);
  }

  function fechar() {
    painel.classList.remove('aberto');
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', aoClicarFora, true);
    document.removeEventListener('keydown', aoTeclado);
    fechando = setTimeout(function () { painel.hidden = true; }, TRANSICAO_MS);
  }

  function aoClicarFora(e) {
    if (!painel.contains(e.target) && !trigger.contains(e.target)) fechar();
  }

  function aoTeclado(e) {
    if (e.key === 'Escape') {
      fechar();
      trigger.focus();
    }
  }

  trigger.addEventListener('click', function (e) {
    e.stopPropagation();
    if (painel.hidden) abrir(); else fechar();
  });

  if (btnFechar) {
    btnFechar.addEventListener('click', function (e) {
      e.stopPropagation();
      fechar();
    });
  }

  var HOVER_LEAVE_MS = 300;
  var hoverFechando = null;

  if (suportaHover) {
    wrapper.addEventListener('mouseenter', function () {
      clearTimeout(hoverFechando);
      abrir();
    });
    wrapper.addEventListener('mouseleave', function () {
      clearTimeout(hoverFechando);
      hoverFechando = setTimeout(fechar, HOVER_LEAVE_MS);
    });
  }

  /* Finalizar compra */
  if (btnFinalizar) {
    btnFinalizar.addEventListener('click', function () {
      if (!window.__logado) {
        if (typeof window.showAuthModal === 'function') window.showAuthModal(null, '/pagamento');
        return;
      }
      var carrinho = lerCarrinho();
      if (carrinho.length === 0) return;
      sessionStorage.setItem('carrinho_checkout', JSON.stringify(carrinho));
      try {
        var cupomSalvo = localStorage.getItem('floria_cupom_aplicado');
        if (cupomSalvo) sessionStorage.setItem('cupom_checkout', cupomSalvo);
        else sessionStorage.removeItem('cupom_checkout');
      } catch (_) {}
      window.location.href = '/pagamento';
    });
  }

  /* Sincronização em tempo real */
  function aoAtualizar() {
    atualizarBadge(totalDeItens(lerCarrinho()));
    if (!painel.hidden) render();
  }
  document.addEventListener('carrinho:atualizado', aoAtualizar);
  window.addEventListener('storage', function (e) {
    if (e.key === 'carrinho') aoAtualizar();
  });

  /* Estado inicial do badge */
  atualizarBadge(totalDeItens(lerCarrinho()));

})();
