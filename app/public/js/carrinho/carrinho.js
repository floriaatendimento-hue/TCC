document.addEventListener('DOMContentLoaded', () => {

  const lista        = document.getElementById('produtos-lista');
  const elSubtotal   = document.getElementById('subtotal');
  const elTotal      = document.getElementById('total');
  const elCount      = document.getElementById('item-count');
  const btnFinalizar = document.getElementById('btn-finalizar');

  if (!lista) return;

  const csrf = (document.getElementById('csrf-token') || {}).value || '';

  /* Cupom de desconto */
  const CHAVE_CUPOM = 'floria_cupom_aplicado';
  const elLinhaDesconto      = document.getElementById('linha-desconto');
  const elDescontoValor      = document.getElementById('desconto-valor');
  const elDescontoCodigo     = document.getElementById('desconto-codigo');
  const cupomForm            = document.getElementById('cupom-form');
  const inputCupom           = document.getElementById('input-cupom');
  const btnCupom             = document.getElementById('btn-cupom');
  const cupomAplicadoInfo    = document.getElementById('cupom-aplicado-info');
  const cupomAplicadoCodigo  = document.getElementById('cupom-aplicado-codigo');
  const cupomAplicadoValor   = document.getElementById('cupom-aplicado-valor');
  const btnRemoverCupom      = document.getElementById('btn-remover-cupom');
  const cupomMsgEl           = document.getElementById('cupom-msg');

  let cupomAplicado = null;
  try { cupomAplicado = JSON.parse(localStorage.getItem(CHAVE_CUPOM)) || null; } catch (_) { cupomAplicado = null; }

  function salvarCupom(c) {
    cupomAplicado = c;
    try {
      if (c) localStorage.setItem(CHAVE_CUPOM, JSON.stringify(c));
      else localStorage.removeItem(CHAVE_CUPOM);
    } catch (_) {}
  }

  function mostrarCupomMsg(txt, tipo) {
    if (!cupomMsgEl) return;
    cupomMsgEl.textContent = txt || '';
    cupomMsgEl.className = 'cupom-msg' + (tipo ? ' is-' + tipo : '');
  }

  function alternarComAnimacao(el, mostrar) {
    if (!el) return;
    if (mostrar) {
      el.hidden = false;
      el.classList.add('cupom-anim-oculto');
      void el.offsetWidth;
      el.classList.remove('cupom-anim-oculto');
    } else {
      el.classList.add('cupom-anim-oculto');
      const finalizar = () => { el.hidden = true; };
      el.addEventListener('transitionend', finalizar, { once: true });
      setTimeout(finalizar, 350); /* fallback caso transitionend não dispare */
    }
  }

  function atualizarUiCupom() {
    if (cupomAplicado) {
      alternarComAnimacao(cupomForm, false);
      alternarComAnimacao(cupomAplicadoInfo, true);
      if (cupomAplicadoCodigo) cupomAplicadoCodigo.textContent = cupomAplicado.codigo;
    } else {
      alternarComAnimacao(cupomForm, true);
      alternarComAnimacao(cupomAplicadoInfo, false);
    }
  }

  function calcularDescontoLocal(subtotal) {
    if (!cupomAplicado) return 0;
    if (cupomAplicado.tipo === 'percentual') {
      return Math.round(subtotal * (cupomAplicado.valor / 100) * 100) / 100;
    }
    if (cupomAplicado.tipo === 'fixo') {
      return Math.min(cupomAplicado.valor, subtotal);
    }
    return cupomAplicado.desconto || 0;
  }

  function aplicarCupom(codigo, subtotalAtual) {
    if (!codigo) return;
    if (btnCupom) { btnCupom.disabled = true; btnCupom.textContent = 'Aplicando…'; }
    mostrarCupomMsg('', '');

    fetch('/api/cupons/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ codigo, subtotal: subtotalAtual }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          mostrarCupomMsg(data.message || 'Não foi possível aplicar o cupom.', 'erro');
          return;
        }
        salvarCupom({
          codigo: data.codigo, tipo: data.tipo, valor: data.valor,
          valor_minimo: data.valor_minimo || 0, desconto: data.desconto,
        });
        atualizarUiCupom();
        mostrarCupomMsg('Cupom aplicado com sucesso!', 'sucesso');
        renderizar();
      })
      .catch(() => mostrarCupomMsg('Erro de conexão. Tente novamente.', 'erro'))
      .finally(() => {
        if (btnCupom) { btnCupom.disabled = false; btnCupom.textContent = 'Aplicar'; }
      });
  }

  if (btnCupom && inputCupom) {
    btnCupom.addEventListener('click', () => {
      aplicarCupom(inputCupom.value.trim().toUpperCase(), calcularSubtotalAtual());
    });
    inputCupom.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); btnCupom.click(); }
    });
  }
  if (btnRemoverCupom) {
    btnRemoverCupom.addEventListener('click', () => {
      salvarCupom(null);
      atualizarUiCupom();
      mostrarCupomMsg('Cupom removido.', '');
      if (inputCupom) inputCupom.value = '';
      renderizar();
    });
  }

  function calcularSubtotalAtual() {
    return lerCarrinho().reduce((s, i) => s + precoNum(i.preco) * i.quantidade, 0);
  }

  /* Formatação */
  function fmt(valor) {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
  }
  function precoNum(v) {
    return Number(v) || 0;
  }

  /* LocalStorage */
  function lerCarrinho() {
    try { return JSON.parse(localStorage.getItem('carrinho')) || []; }
    catch { return []; }
  }
  function salvarCarrinho(c) {
    localStorage.setItem('carrinho', JSON.stringify(c));
  }
  function notificarMudanca() {
    document.dispatchEvent(new CustomEvent('carrinho:atualizado'));
  }

  const estoqueCache = {};

  function slugDoLink(link) {
    if (!link) return null;
    const partes = link.split('/').filter(Boolean);
    return partes.length ? partes[partes.length - 1] : null;
  }

  function consultarEstoque(slug) {
    if (!slug || Object.prototype.hasOwnProperty.call(estoqueCache, slug)) return;
    estoqueCache[slug] = null;
    fetch('/api/produtos/' + encodeURIComponent(slug) + '/estoque')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        estoqueCache[slug] = data && data.ok ? Number(data.estoque) || 0 : null;
      })
      .catch(() => { estoqueCache[slug] = null; });
  }

  function avisarLimiteEstoque(btnMais, max) {
    const artigo = btnMais.closest('article');
    if (!artigo) return;
    let aviso = artigo.querySelector('.limite-estoque-msg');
    if (!aviso) {
      aviso = document.createElement('output');
      aviso.className = 'limite-estoque-msg';
      artigo.querySelector('.produto-lado-direito')?.appendChild(aviso);
    }
    aviso.textContent = max > 0 ? `Só há ${max} em estoque` : 'Sem estoque disponível';
    aviso.classList.add('visivel');
    clearTimeout(aviso._t);
    aviso._t = setTimeout(() => aviso.classList.remove('visivel'), 2400);
  }

  const svgTrash = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6M14 11v6"/>
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
  </svg>`;

  /* Cria elemento de produto */
  function criarProdutoEl(item, index) {
    const preco    = precoNum(item.preco);
    const subtotal = preco * item.quantidade;
    const link = item.link || null;

    const artigo = document.createElement('article');
    artigo.className = 'produto-item';
    artigo.setAttribute('aria-label', item.nome);

    const imgWrap = document.createElement(link ? 'a' : 'figure');
    imgWrap.className = 'produto-img-wrap';
    if (link) {
      imgWrap.href = link;
      imgWrap.setAttribute('aria-label', 'Ver detalhes de ' + item.nome);
    }
    const img = document.createElement('img');
    img.className = 'produto-img';
    img.src = item.imagem || '/imagens/image.png';
    img.alt = item.nome;
    img.loading = 'lazy';
    imgWrap.appendChild(img);

    /* Info */
    const info = document.createElement('section');
    info.className = 'produto-info';

    const nome = document.createElement('h3');
    nome.className = 'produto-nome';
    nome.textContent = item.nome;
    const nomeEl = link ? Object.assign(document.createElement('a'), { href: link }) : null;
    if (nomeEl) nomeEl.appendChild(nome);

    const precoEl = document.createElement('p');
    precoEl.className = 'produto-preco-unit';
    precoEl.textContent = fmt(preco);
    const small = document.createElement('small');
    small.textContent = ' / unidade';
    precoEl.appendChild(small);

    const btnRemover = document.createElement('button');
    btnRemover.className = 'btn-remover';
    btnRemover.dataset.index = index;
    btnRemover.setAttribute('aria-label', 'Remover ' + item.nome);
    btnRemover.innerHTML = svgTrash + ' Remover';

    if (item.cor) {
      const corEl = document.createElement('p');
      corEl.className = 'produto-cor';
      corEl.textContent = 'Variação: ' + item.cor;
      const corLinkEl = link ? Object.assign(document.createElement('a'), { href: link }) : null;
      if (corLinkEl) corLinkEl.appendChild(corEl);
      info.append(nomeEl || nome, corLinkEl || corEl, precoEl, btnRemover);
    } else {
      info.append(nomeEl || nome, precoEl, btnRemover);
    }

    const ladoDireito = document.createElement('section');
    ladoDireito.className = 'produto-lado-direito';

    const qtyWrap = document.createElement('section');
    qtyWrap.className = 'qty-wrapper';

    const btnMenos = document.createElement('button');
    btnMenos.className = 'btn-menos';
    btnMenos.dataset.index = index;
    btnMenos.setAttribute('aria-label', 'Diminuir quantidade');
    btnMenos.textContent = '−';

    const qtyNum = document.createElement('output');
    qtyNum.className = 'qty-num';
    qtyNum.textContent = item.quantidade;

    const btnMais = document.createElement('button');
    btnMais.className = 'btn-mais';
    btnMais.dataset.index = index;
    btnMais.setAttribute('aria-label', 'Aumentar quantidade');
    btnMais.textContent = '+';
    const slugEstoque = slugDoLink(item.link);
    if (slugEstoque) {
      btnMais.dataset.slug = slugEstoque;
      consultarEstoque(slugEstoque);
    }

    qtyWrap.append(btnMenos, qtyNum, btnMais);

    const itemSubtotal = document.createElement('p');
    itemSubtotal.className = 'item-subtotal';
    itemSubtotal.textContent = fmt(subtotal);

    ladoDireito.append(qtyWrap, itemSubtotal);
    artigo.append(imgWrap, info, ladoDireito);

    return { artigo, preco, subtotal };
  }

  /* Renderiza lista */
  function renderizar() {
    const carrinho = lerCarrinho();
    lista.innerHTML = '';

    const totalItens = carrinho.reduce((s, i) => s + i.quantidade, 0);
    if (elCount) {
      elCount.textContent = totalItens > 0
        ? `${totalItens} ${totalItens === 1 ? 'item' : 'itens'}`
        : '';
    }

    if (carrinho.length === 0) {
      lista.innerHTML = `
        <section class="estado-vazio">
          <i class="vazio-icone" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
              <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
            </svg>
          </i>
          <h3>Seu carrinho está vazio</h3>
          <p>Explore nossos produtos e encontre algo especial para você</p>
          <a href="/" class="btn-explorar">Ver produtos</a>
        </section>`;
      atualizarTotais(0);
      return;
    }

    let totalGeral = 0;

    carrinho.forEach((item, index) => {
      const { artigo, subtotal } = criarProdutoEl(item, index);
      totalGeral += subtotal;
      lista.appendChild(artigo);
    });

    atualizarTotais(totalGeral);
    vincularEventos();
  }

  function atualizarTotais(subtotal) {
    if (cupomAplicado && cupomAplicado.valor_minimo && subtotal < cupomAplicado.valor_minimo) {
      salvarCupom(null);
      atualizarUiCupom();
      mostrarCupomMsg('O cupom foi removido: o subtotal ficou abaixo do valor mínimo exigido.', 'erro');
    }

    const desconto = calcularDescontoLocal(subtotal);
    const total = Math.max(0, subtotal - desconto);

    if (elSubtotal) elSubtotal.textContent = fmt(subtotal);
    if (elTotal)    elTotal.textContent    = fmt(total);

    if (elLinhaDesconto) {
      elLinhaDesconto.hidden = !cupomAplicado;
      if (cupomAplicado) {
        if (elDescontoValor)    elDescontoValor.textContent    = '− ' + fmt(desconto);
        if (elDescontoCodigo)   elDescontoCodigo.textContent   = '(' + cupomAplicado.codigo + ')';
        if (cupomAplicadoValor) cupomAplicadoValor.textContent = fmt(desconto);
      }
    }
  }

  /* Eventos de quantidade e remoção */
  function vincularEventos() {
    lista.querySelectorAll('.btn-remover').forEach(btn =>
      btn.addEventListener('click', () => {
        const c = lerCarrinho();
        c.splice(Number(btn.dataset.index), 1);
        salvarCarrinho(c);
        notificarMudanca();
      })
    );

    lista.querySelectorAll('.btn-mais').forEach(btn =>
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.index);
        const max = btn.dataset.slug ? estoqueCache[btn.dataset.slug] : null;
        const c = lerCarrinho();
        if (typeof max === 'number' && c[i].quantidade >= max) {
          avisarLimiteEstoque(btn, max);
          return;
        }
        c[i].quantidade++;
        salvarCarrinho(c);
        notificarMudanca();
      })
    );

    lista.querySelectorAll('.btn-menos').forEach(btn =>
      btn.addEventListener('click', () => {
        const c = lerCarrinho();
        const i = Number(btn.dataset.index);
        if (c[i].quantidade > 1) {
          c[i].quantidade--;
        } else {
          c.splice(i, 1);
        }
        salvarCarrinho(c);
        notificarMudanca();
      })
    );
  }

  /* Finalizar compra */
  if (btnFinalizar) {
    btnFinalizar.addEventListener('click', (e) => {
      e.preventDefault();

      if (!window.__logado) {
        if (typeof window.showAuthModal === 'function') window.showAuthModal(null, '/pagamento');
        return;
      }

      const carrinho = lerCarrinho();
      if (carrinho.length === 0) {
        alert('Seu carrinho está vazio.');
        return;
      }
      sessionStorage.setItem('carrinho_checkout', JSON.stringify(carrinho));
      if (cupomAplicado) sessionStorage.setItem('cupom_checkout', JSON.stringify(cupomAplicado));
      else sessionStorage.removeItem('cupom_checkout');
      window.location.href = '/pagamento';
    });
  }

  atualizarUiCupom();

  document.addEventListener('carrinho:atualizado', renderizar);
  window.addEventListener('storage', (e) => {
    if (e.key === 'carrinho') renderizar();
  });

  renderizar();

  if (cupomAplicado) {
    const codigoSalvo = cupomAplicado.codigo;
    fetch('/api/cupons/validar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf },
      body: JSON.stringify({ codigo: codigoSalvo, subtotal: calcularSubtotalAtual() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) {
          salvarCupom(null);
          atualizarUiCupom();
          mostrarCupomMsg('O cupom "' + codigoSalvo + '" não é mais válido e foi removido.', 'erro');
          renderizar();
          return;
        }
        salvarCupom({
          codigo: data.codigo, tipo: data.tipo, valor: data.valor,
          valor_minimo: data.valor_minimo || 0, desconto: data.desconto,
        });
        renderizar();
      })
      .catch(() => {});
  }
});
