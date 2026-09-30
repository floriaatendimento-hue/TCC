(function () {
  'use strict';

  const form = document.getElementById('form-suporte');
  if (!form) return;

  const ctx = window.__suporteContexto || {};

  const CAMPO_ERRO_ID = {
    nome: 'erro-suporte-nome',
    email: 'erro-suporte-email',
    assunto: 'erro-suporte-assunto',
    mensagem: 'erro-suporte-mensagem',
  };

  const msgGeral = document.getElementById('suporte-msg-geral');
  const btnEnviar = document.getElementById('btn-enviar-suporte');
  const sucesso = document.getElementById('suporte-sucesso');
  const protocoloEl = document.getElementById('suporte-protocolo-numero');
  const mensagemInput = document.getElementById('suporte-mensagem');
  const contador = document.getElementById('suporte-mensagem-contador');

  function csrf() {
    return document.getElementById('csrf-suporte')?.value || '';
  }

  function limparErros() {
    Object.values(CAMPO_ERRO_ID).forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    form.querySelectorAll('[aria-invalid="true"]').forEach((el) => el.removeAttribute('aria-invalid'));
    if (msgGeral) msgGeral.textContent = '';
  }

  function marcarErroCampo(campo, msg) {
    const erroEl = document.getElementById(CAMPO_ERRO_ID[campo]);
    if (erroEl) erroEl.textContent = msg;
    const inputEl = document.getElementById('suporte-' + campo);
    if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
  }

  function validarLocal(payload) {
    const erros = {};
    if (!payload.nome || payload.nome.length < 2) erros.nome = 'Informe seu nome.';
    if (!payload.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) erros.email = 'Digite um e-mail válido.';
    if (!payload.assunto || payload.assunto.length < 3) erros.assunto = 'Informe o assunto.';
    if (!payload.mensagem || payload.mensagem.length < 10) erros.mensagem = 'Escreva uma mensagem com pelo menos 10 caracteres.';
    return erros;
  }

  if (mensagemInput && contador) {
    const atualizarContador = () => { contador.textContent = mensagemInput.value.length + '/5000'; };
    mensagemInput.addEventListener('input', atualizarContador);
    atualizarContador();
  }

  if (ctx.pedidoInicial) {
    const categoriaSelect = document.getElementById('suporte-categoria');
    if (categoriaSelect) categoriaSelect.value = 'pedido';
  }

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (btnEnviar.disabled) return; // trava contra duplo clique/duplo envio

    limparErros();

    const payload = {
      nome: document.getElementById('suporte-nome').value.trim(),
      email: document.getElementById('suporte-email').value.trim(),
      categoria: document.getElementById('suporte-categoria').value || '',
      assunto: document.getElementById('suporte-assunto').value.trim(),
      mensagem: document.getElementById('suporte-mensagem').value.trim(),
      site: document.getElementById('suporte-site').value,
    };

    const erros = validarLocal(payload);
    const camposComErro = Object.keys(erros);
    if (camposComErro.length) {
      camposComErro.forEach((campo) => marcarErroCampo(campo, erros[campo]));
      document.getElementById('suporte-' + camposComErro[0])?.focus();
      return;
    }

    btnEnviar.disabled = true;
    const textoOriginal = btnEnviar.textContent;
    btnEnviar.textContent = 'Enviando…';

    try {
      const resp = await fetch('/api/suporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf() },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();

      if (data.ok) {
        form.hidden = true;
        if (protocoloEl) protocoloEl.textContent = data.protocolo || '';
        if (sucesso) { sucesso.hidden = false; sucesso.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
      } else if (Array.isArray(data.errors) && data.errors.length) {
        data.errors.forEach((err) => { if (CAMPO_ERRO_ID[err.path]) marcarErroCampo(err.path, err.msg); });
        document.getElementById('suporte-' + data.errors[0].path)?.focus();
      } else if (resp.status === 429) {
        if (msgGeral) msgGeral.textContent = data.message || 'Muitas solicitações em pouco tempo. Tente novamente mais tarde.';
      } else {
        if (msgGeral) msgGeral.textContent = data.message || 'Não foi possível enviar sua solicitação agora. Tente novamente.';
      }
    } catch {
      if (msgGeral) msgGeral.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
    } finally {
      btnEnviar.disabled = false;
      btnEnviar.textContent = textoOriginal;
    }
  });
})();
