(function () {
  'use strict';

  const cfg = window.__pagamentoPedido;
  if (!cfg) return;

  /* COPIAR CÓDIGO */
  const btnCopiar = document.getElementById('btn-copiar');
  if (btnCopiar) {
    const textoOriginal = btnCopiar.querySelector('.botao__texto')?.textContent || 'Copiar código';
    btnCopiar.addEventListener('click', () => {
      const texto = btnCopiar.getAttribute('data-copiar') || '';
      const span = btnCopiar.querySelector('.botao__texto');
      navigator.clipboard?.writeText(texto).then(() => {
        btnCopiar.classList.add('is-copiado');
        if (span) span.textContent = 'Copiado!';
        setTimeout(() => {
          btnCopiar.classList.remove('is-copiado');
          if (span) span.textContent = textoOriginal;
        }, 2200);
      }).catch(() => {});
    });
  }

  if (!cfg.aguardando) {
    if (cfg.statusInicial === 'aprovado') {
      setTimeout(() => { window.location.href = '/pedido/' + cfg.id; }, 2200);
    }
    return;
  }

  const card = document.getElementById('status-card');
  const rotuloEl = document.getElementById('status-card-rotulo');
  const descEl = document.getElementById('status-card-desc');
  const icones = card ? card.querySelectorAll('.status-card__icone svg') : [];
  const acaoEl = document.querySelector('.pagpedido__acao');
  const ESTADO_CLASSE = {
    pendente: 'aguardando', processando: 'processando', aprovado: 'pago',
    expirado: 'expirado', recusado: 'recusado', estornado: 'estornado',
  };

  function aplicarEstado(status) {
    if (card) card.className = 'status-card status-card--' + (ESTADO_CLASSE[status] || 'aguardando');
    if (rotuloEl) rotuloEl.textContent = cfg.rotulos[status] || status;
    if (descEl) descEl.textContent = cfg.descricoes[status] || '';
    icones.forEach((svg) => { svg.hidden = svg.dataset.estado !== status; });
  }

  const timer = setInterval(() => {
    fetch('/api/pedidos/' + cfg.id + '/status-pagamento')
      .then((r) => r.json())
      .then((data) => {
        if (!data.ok) return;
        if (data.status_pagamento === 'pendente' || data.status_pagamento === 'processando') {
          aplicarEstado(data.status_pagamento);
          return;
        }
        clearInterval(timer);
        aplicarEstado(data.status_pagamento);
        if (acaoEl) acaoEl.style.display = 'none';
        if (data.status_pagamento === 'aprovado') {
          setTimeout(() => { window.location.href = '/pedido/' + cfg.id; }, 1800);
        }
      })
      .catch(() => {});
  }, 3000);
})();
