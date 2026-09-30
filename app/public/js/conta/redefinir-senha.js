(function () {
  'use strict';

  /* Toggle visibilidade de senha */
  document.querySelectorAll('.toggle-senha').forEach(btn => {
    btn.addEventListener('click', () => {
      const alvo = document.getElementById(btn.dataset.alvo);
      const icone = btn.querySelector('i');
      if (!alvo) return;
      if (alvo.type === 'password') {
        alvo.type = 'text';
        icone?.classList.replace('fa-eye', 'fa-eye-slash');
        btn.setAttribute('aria-label', 'Ocultar senha');
      } else {
        alvo.type = 'password';
        icone?.classList.replace('fa-eye-slash', 'fa-eye');
        btn.setAttribute('aria-label', 'Mostrar senha');
      }
    });
  });

  const btnRedefinir = document.getElementById('btn-redefinir-senha');
  if (!btnRedefinir) return;

  const msgGeral = document.getElementById('redefinir-msg-geral');
  const erroSenha = document.getElementById('nova-senha-redefinir-erro');
  const erroConfirmar = document.getElementById('confirmar-senha-redefinir-erro');

  function limparErros() {
    [msgGeral, erroSenha, erroConfirmar].forEach(el => { if (el) el.textContent = ''; });
    document.getElementById('grupo-nova-senha')?.classList.remove('estado-erro');
    document.getElementById('grupo-confirmar-senha')?.classList.remove('estado-erro');
  }

  btnRedefinir.addEventListener('click', async () => {
    limparErros();

    const novaSenha = document.getElementById('nova-senha-redefinir').value;
    const confirmarSenha = document.getElementById('confirmar-senha-redefinir').value;

    if (novaSenha !== confirmarSenha) {
      document.getElementById('grupo-confirmar-senha')?.classList.add('estado-erro');
      if (erroConfirmar) erroConfirmar.textContent = 'As senhas não conferem.';
      return;
    }

    btnRedefinir.disabled = true;
    btnRedefinir.setAttribute('aria-busy', 'true');
    if (msgGeral) msgGeral.textContent = 'Redefinindo...';

    try {
      const resp = await fetch('/api/redefinir-senha', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': document.getElementById('csrf-redefinir').value,
        },
        body: JSON.stringify({ novaSenha, confirmarSenha }),
      });
      const data = await resp.json();

      if (data.ok) {
        if (msgGeral) { msgGeral.textContent = data.message; msgGeral.style.color = 'var(--verde-escuro, #154030)'; }
        setTimeout(() => { window.location.href = data.redirect || '/login'; }, 1500);
      } else if (data.code === 'SEM_AUTORIZACAO' && data.redirect) {
        if (msgGeral) { msgGeral.textContent = data.message; msgGeral.style.color = '#c0392b'; }
        setTimeout(() => { window.location.href = data.redirect; }, 1800);
      } else {
        if (msgGeral) { msgGeral.textContent = data.message || 'Não foi possível redefinir a senha.'; msgGeral.style.color = '#c0392b'; }
      }
    } catch {
      if (msgGeral) { msgGeral.textContent = 'Erro de conexão. Tente novamente.'; msgGeral.style.color = '#c0392b'; }
    } finally {
      btnRedefinir.disabled = false;
      btnRedefinir.removeAttribute('aria-busy');
    }
  });
})();
