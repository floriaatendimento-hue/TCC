(function () {
  'use strict';

  const csrf = document.getElementById('csrf-token')?.value || '';
  const msg  = document.getElementById('pedido-acao-msg');

  function mostrarMsg(texto, tipo) {
    if (!msg) return;
    msg.textContent = texto;
    msg.className = 'pedido-msg' + (tipo ? ' ' + tipo : '');
  }

  function lerCarrinho() {
    try { return JSON.parse(localStorage.getItem('carrinho')) || []; }
    catch { return []; }
  }
  function salvarCarrinho(c) {
    localStorage.setItem('carrinho', JSON.stringify(c));
    document.dispatchEvent(new CustomEvent('carrinho:atualizado'));
  }

  document.getElementById('btn-comprar-novamente')?.addEventListener('click', () => {
    const itensPedido = window.__pedidoItensParaCompra || [];
    if (!itensPedido.length) {
      mostrarMsg('Não foi possível identificar os produtos deste pedido.', 'erro');
      return;
    }
    const carrinho = lerCarrinho();
    itensPedido.forEach((item) => {
      const existente = carrinho.find(c => c.nome === item.nome && c.cor === item.cor);
      if (existente) {
        existente.quantidade = (parseInt(existente.quantidade, 10) || 0) + item.quantidade;
        if (item.slug && !existente.link) existente.link = '/' + item.slug;
      } else {
        const { slug, ...resto } = item;
        carrinho.push({ ...resto, ...(slug ? { link: '/' + slug } : {}) });
      }
    });
    salvarCarrinho(carrinho);
    mostrarMsg('Produtos adicionados ao carrinho! Redirecionando…', 'sucesso');
    setTimeout(() => { window.location.href = '/carrinho'; }, 900);
  });

  document.getElementById('btn-avaliar')?.addEventListener('click', (ev) => {
    if (ev.currentTarget.disabled) return;
    const slug = window.__pedidoPrimeiroProdutoSlug;
    if (slug) {
      window.location.href = '/produto/' + slug + '#comentarios';
    } else {
      mostrarMsg('Use o link "Avaliar" ao lado de cada produto acima.', null);
    }
  });

  document.getElementById('btn-acompanhar')?.addEventListener('click', () => {
    const alvo = document.querySelector('.entrega-card') || document.querySelector('.pedido-timeline');
    alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    alvo?.animate(
      [{ boxShadow: '0 0 0 3px var(--dourado)' }, { boxShadow: '0 0 0 0px transparent' }],
      { duration: 900 }
    );
  });

  /* Copiar código de rastreio */
  document.getElementById('btn-copiar-rastreio')?.addEventListener('click', async (ev) => {
    const codigo = document.getElementById('rastreio-chip')?.textContent.trim();
    if (!codigo) return;
    try {
      await navigator.clipboard.writeText(codigo);
      const btn = ev.currentTarget;
      const original = btn.innerHTML;
      btn.innerHTML = '<i class="fas fa-check" aria-hidden="true"></i>';
      setTimeout(() => { btn.innerHTML = original; }, 1400);
    } catch {
      mostrarMsg('Não foi possível copiar automaticamente. Copie manualmente: ' + codigo, null);
    }
  });

  /* Enviar comprovante por e-mail */
  document.getElementById('btn-enviar-comprovante-email')?.addEventListener('click', async (ev) => {
    const btn = ev.currentTarget;
    const pedidoId = btn.dataset.pedidoId;
    const emailPadrao = btn.dataset.clienteEmail || '';

    const destino = window.prompt('Enviar comprovante para qual e-mail?', emailPadrao);
    if (destino === null) return;
    const emailFinal = destino.trim();
    if (!emailFinal) {
      mostrarMsg('Informe um e-mail válido.', 'erro');
      return;
    }

    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = 'Enviando…';
    mostrarMsg('', null);

    try {
      const resp = await fetch(`/api/pedidos/${pedidoId}/comprovante/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({ email: emailFinal }),
      });
      const data = await resp.json();

      if (data.ok) {
        mostrarMsg(data.message || 'Comprovante enviado com sucesso.', 'sucesso');
      } else {
        mostrarMsg(data.message || 'Não foi possível enviar o comprovante.', 'erro');
      }
    } catch {
      mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
    } finally {
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  });

  /* Cancelar pedido */
  document.getElementById('btn-cancelar-pedido')?.addEventListener('click', (ev) => {
    const btn = ev.currentTarget;
    const pedidoId = btn.dataset.pedidoId;

    window.confirmarAcao('Tem certeza que deseja cancelar este pedido? Essa ação não pode ser desfeita.', () => {
      cancelarPedido(btn, pedidoId);
    }, { rotuloConfirmar: 'Cancelar pedido' });
  });

  async function cancelarPedido(btn, pedidoId) {
    btn.disabled = true;
    const textoOriginal = btn.innerHTML;
    btn.innerHTML = 'Cancelando…';
    mostrarMsg('', null);

    try {
      const resp = await fetch(`/api/pedidos/${pedidoId}/cancelar`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: JSON.stringify({ motivo: 'Cancelado pelo cliente pela página de detalhes do pedido.' }),
      });
      const data = await resp.json();

      if (data.ok) {
        mostrarMsg('Pedido cancelado com sucesso. Atualizando…', 'sucesso');
        setTimeout(() => window.location.reload(), 900);
      } else {
        mostrarMsg(data.message || 'Não foi possível cancelar o pedido.', 'erro');
        btn.disabled = false;
        btn.innerHTML = textoOriginal;
      }
    } catch {
      mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
      btn.disabled = false;
      btn.innerHTML = textoOriginal;
    }
  }
})();
