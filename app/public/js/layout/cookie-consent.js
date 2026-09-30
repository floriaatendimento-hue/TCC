(function () {
  'use strict';

  const banner = document.getElementById('cookie-banner');
  const dialog = document.getElementById('dialog-cookie-preferencias');
  if (!banner || !dialog) return; // página não incluiu o partial

  const CHAVE = 'floria_cookie_consent';
  const VERSAO = 1;

  function obter() {
    try {
      const dados = JSON.parse(localStorage.getItem(CHAVE));
      if (!dados || dados.versao !== VERSAO) return null;
      return dados;
    } catch {
      return null;
    }
  }

  function salvar(categorias) {
    const dados = {
      versao: VERSAO,
      necessarios: true,
      preferencia: !!categorias.preferencia,
      analise: !!categorias.analise,
      marketing: !!categorias.marketing,
      escolhidoEm: new Date().toISOString(),
    };
    try { localStorage.setItem(CHAVE, JSON.stringify(dados)); } catch {}
    document.dispatchEvent(new CustomEvent('cookieconsent:alterado', { detail: dados }));
    return dados;
  }

  function mostrarBanner() { banner.hidden = false; }
  function esconderBanner() { banner.hidden = true; }

  function sincronizarTogglesComConsentimentoSalvo() {
    const salvo = obter();
    const preferenciaEl = document.getElementById('pref-cookie-preferencia');
    const analiseEl = document.getElementById('pref-cookie-analise');
    const marketingEl = document.getElementById('pref-cookie-marketing');
    if (preferenciaEl) preferenciaEl.checked = !!salvo?.preferencia;
    if (analiseEl) analiseEl.checked = !!salvo?.analise;
    if (marketingEl) marketingEl.checked = !!salvo?.marketing;
  }

  function abrirPreferencias() {
    const msg = document.getElementById('cookie-preferencias-msg');
    if (msg) msg.textContent = '';
    sincronizarTogglesComConsentimentoSalvo();
    if (typeof dialog.showModal === 'function') dialog.showModal();
  }
  function fecharPreferencias() { dialog.close(); }

  dialog.addEventListener('click', (e) => { if (e.target === dialog) fecharPreferencias(); });
  document.getElementById('fechar-cookie-preferencias')?.addEventListener('click', fecharPreferencias);

  function aplicarEFechar(categorias) {
    salvar(categorias);
    esconderBanner();
    fecharPreferencias();
  }

  document.getElementById('btn-cookie-banner-aceitar')
    ?.addEventListener('click', () => aplicarEFechar({ preferencia: true, analise: true, marketing: true }));
  document.getElementById('btn-cookie-banner-recusar')
    ?.addEventListener('click', () => aplicarEFechar({}));
  document.getElementById('btn-cookie-banner-configurar')
    ?.addEventListener('click', abrirPreferencias);

  document.getElementById('btn-cookie-aceitar-todos')
    ?.addEventListener('click', () => aplicarEFechar({ preferencia: true, analise: true, marketing: true }));
  document.getElementById('btn-cookie-recusar')
    ?.addEventListener('click', () => aplicarEFechar({}));
  document.getElementById('btn-cookie-salvar')
    ?.addEventListener('click', () => {
      aplicarEFechar({
        preferencia: document.getElementById('pref-cookie-preferencia')?.checked,
        analise: document.getElementById('pref-cookie-analise')?.checked,
        marketing: document.getElementById('pref-cookie-marketing')?.checked,
      });
    });

  document.querySelectorAll('[data-abrir-preferencias-cookies]').forEach((el) => {
    el.addEventListener('click', (e) => { e.preventDefault(); abrirPreferencias(); });
  });

  if (!obter()) mostrarBanner();

  window.FloriaCookieConsent = { obter, abrirPreferencias };
})();
