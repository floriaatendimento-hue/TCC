(function () {
  'use strict';

  const wrapper = document.getElementById('otp-form-wrapper');
  if (!wrapper) return;

  const TOTAL = Number(wrapper.dataset.digitos);
  const campos = Array.from(document.querySelectorAll('.otp-digito'));
  const grupoCampos = document.getElementById('otp-campos');
  const msgGeral = document.getElementById('otp-msg-geral');
  const btnVerificar = document.getElementById('btn-verificar-otp');
  const btnReenviar = document.getElementById('btn-reenviar-otp');
  const timerEl = document.getElementById('otp-timer');
  const csrf = () => document.getElementById('csrf-otp').value;

  const COR_ERRO = '#c0392b';
  const COR_OK = 'var(--verde-escuro, #154030)';

  /* Valor do código */
  function valor() { return campos.map((c) => c.value).join(''); }

  function mostrarMsg(texto, cor) {
    msgGeral.textContent = texto || '';
    msgGeral.style.color = cor || '';
  }

  function marcarErro(sim) {
    grupoCampos.classList.toggle('estado-erro', sim);
    campos.forEach((c) => c.setAttribute('aria-invalid', sim ? 'true' : 'false'));
  }

  function limparCampos({ focar = true } = {}) {
    campos.forEach((c) => { c.value = ''; });
    if (focar) campos[0].focus();
  }

  function definirCamposHabilitados(habilitado) {
    campos.forEach((c) => { c.disabled = !habilitado; });
  }

  function preencherA_partirDe(indice, digitos) {
    let i = indice;
    for (const d of digitos) {
      if (i >= TOTAL) break;
      campos[i].value = d;
      i++;
    }
    campos[Math.min(i, TOTAL - 1)].focus();
  }

  campos.forEach((campo, indice) => {
    campo.addEventListener('focus', () => campo.select());

    campo.addEventListener('input', () => {
      marcarErro(false);
      const limpo = campo.value.replace(/\D/g, ''); // só dígitos — letras/símbolos somem
      if (!limpo) { campo.value = ''; return; }
      campo.value = '';
      if (limpo.length >= TOTAL) return preencherA_partirDe(0, limpo.slice(0, TOTAL)); // código inteiro
      preencherA_partirDe(indice, limpo);
    });

    campo.addEventListener('paste', (e) => {
      e.preventDefault();
      const limpo = (e.clipboardData?.getData('text') || '').replace(/\D/g, '');
      if (!limpo) return;
      marcarErro(false);
      preencherA_partirDe(limpo.length >= TOTAL ? 0 : indice, limpo.slice(0, TOTAL));
    });

    campo.addEventListener('keydown', (e) => {
      switch (e.key) {
        case 'Backspace':
          if (campo.value) { campo.value = ''; e.preventDefault(); }
          else if (indice > 0) { campos[indice - 1].value = ''; campos[indice - 1].focus(); e.preventDefault(); }
          break;
        case 'Delete':
          campo.value = '';
          e.preventDefault();
          break;
        case 'ArrowLeft':
          if (indice > 0) { campos[indice - 1].focus(); e.preventDefault(); }
          break;
        case 'ArrowRight':
          if (indice < TOTAL - 1) { campos[indice + 1].focus(); e.preventDefault(); }
          break;
        case 'Enter':
          e.preventDefault();
          btnVerificar.click();
          break;
        default:
          if (e.key.length === 1 && !/\d/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) e.preventDefault();
      }
    });
  });

  /* Timer do reenvio */
  let timerId = null;

  function iniciarContagem(segundos) {
    if (timerId !== null) { clearInterval(timerId); timerId = null; } // nunca dois timers vivos
    const fim = Date.now() + segundos * 1000;

    function atualizar() {
      const restante = Math.max(0, Math.ceil((fim - Date.now()) / 1000));
      if (restante <= 0) {
        clearInterval(timerId);
        timerId = null;
        timerEl.textContent = '';
        btnReenviar.disabled = false;
        return;
      }
      btnReenviar.disabled = true;
      timerEl.textContent = `Você poderá solicitar um novo código em ${restante} segundo${restante === 1 ? '' : 's'}.`;
    }

    atualizar();
    if (segundos > 0) timerId = setInterval(atualizar, 1000);
  }

  /* HTTP */
  async function postar(url, corpo) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
      body: JSON.stringify(corpo || {}),
    });
    let data = {};
    try { data = await resp.json(); } catch { /* corpo não-JSON */ }
    return { resp, data };
  }

  function irPara(url, atrasoMs) {
    setTimeout(() => { window.location.href = url; }, atrasoMs);
  }

  btnVerificar.addEventListener('click', async () => {
    mostrarMsg('');
    const otp = valor(); // string
    if (otp.length !== TOTAL) {
      marcarErro(true);
      mostrarMsg(`Digite os ${TOTAL} dígitos do código.`, COR_ERRO);
      (campos.find((c) => !c.value) || campos[0]).focus();
      return;
    }

    btnVerificar.disabled = true;
    btnVerificar.setAttribute('aria-busy', 'true');
    mostrarMsg('Verificando...');

    try {
      const { data } = await postar('/api/verificar-otp', { otp });

      if (data.ok) {
        mostrarMsg(data.message || 'Código verificado!', COR_OK);
        definirCamposHabilitados(false);
        irPara(data.redirect || '/redefinir-senha', 500);
        return;
      }

      if (data.redirect) {
        mostrarMsg(data.message, COR_ERRO);
        irPara(data.redirect, 1500);
        return;
      }

      marcarErro(true);
      mostrarMsg(data.message || 'Código inválido.', COR_ERRO);
      limparCampos({ focar: data.code === 'INVALIDO' });
      if (data.code === 'EXPIRADO' || data.code === 'BLOQUEADO') btnReenviar.focus();
    } catch {
      mostrarMsg('Erro de conexão. Tente novamente.', COR_ERRO);
    }

    btnVerificar.disabled = false;
    btnVerificar.removeAttribute('aria-busy');
  });

  btnReenviar.addEventListener('click', async () => {
    mostrarMsg('');
    btnReenviar.disabled = true;

    try {
      const { data } = await postar('/api/reenviar-codigo');

      if (data.ok) {
        marcarErro(false);
        limparCampos();
        mostrarMsg(data.message || 'Enviamos um novo código para o seu e-mail.', COR_OK);
        iniciarContagem(data.segundosRestantes || 60);
        return;
      }

      if (data.redirect) {
        mostrarMsg(data.message, COR_ERRO);
        irPara(data.redirect, 1500);
        return;
      }

      mostrarMsg(data.message || 'Não foi possível reenviar o código.', COR_ERRO);
      if (data.code === 'COOLDOWN' && data.segundosRestantes) iniciarContagem(data.segundosRestantes);
      else if (data.code !== 'LIMITE_REENVIOS') btnReenviar.disabled = false;
    } catch {
      mostrarMsg('Erro de conexão. Tente novamente.', COR_ERRO);
      btnReenviar.disabled = false;
    }
  });

  iniciarContagem(Number(wrapper.dataset.segundos) || 0);
  campos[0].focus();
})();
