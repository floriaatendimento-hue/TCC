(function () {
  'use strict';

  const modal = document.getElementById('modal-endereco');
  if (!modal) return;

  function csrfGlobal() {
    return document.getElementById('csrf-token')?.value || '';
  }

  function escHtml(str) {
    return String(str ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }

  const ROTULOS_PADRAO = ['Casa', 'Trabalho', 'Apartamento', 'Família'];

  const ICONES_ENDERECO = {
    Casa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9.5 12 3l9 6.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>',
    Trabalho: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    Apartamento: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="2" width="16" height="20" rx="1"/><line x1="8" y1="7" x2="8" y2="7.01"/><line x1="12" y1="7" x2="12" y2="7.01"/><line x1="16" y1="7" x2="16" y2="7.01"/><line x1="8" y1="12" x2="8" y2="12.01"/><line x1="12" y1="12" x2="12" y2="12.01"/><line x1="16" y1="12" x2="16" y2="12.01"/><path d="M10 22v-4h4v4"/></svg>',
    'Família': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    Personalizado: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  };
  function iconeEndereco(rotulo) {
    return ICONES_ENDERECO[rotulo] || ICONES_ENDERECO.Personalizado;
  }

  /* Formatação de telefone */
  function formatarTelefone(v) {
    const d = String(v || '').replace(/\D/g, '');
    if (d.length === 11) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if (d.length === 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    return v || '';
  }
  document.getElementById('end-telefone')?.addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 11);
    e.target.value = formatarTelefone(d) || d;
  });

  function marcarRotuloAtivo(botaoAlvo) {
    document.querySelectorAll('.rotulo-opcao').forEach(b => {
      const ativo = b === botaoAlvo;
      b.classList.toggle('ativo', ativo);
      b.setAttribute('aria-checked', String(ativo));
      b.tabIndex = ativo ? 0 : -1;
    });
  }
  const grupoRotulo = document.getElementById('rotulo-opcoes');
  grupoRotulo?.addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const opcoes = Array.from(grupoRotulo.querySelectorAll('.rotulo-opcao'));
    const atual = opcoes.indexOf(document.activeElement);
    if (atual === -1) return;
    const passo = (e.key === 'ArrowRight' || e.key === 'ArrowDown') ? 1 : -1;
    const proximo = opcoes[(atual + passo + opcoes.length) % opcoes.length];
    proximo.focus();
    proximo.click();
  });
  function aplicarRotulo(valor) {
    const campoCustom = document.getElementById('end-rotulo-personalizado');
    const campoHidden = document.getElementById('end-rotulo');
    const ehPadrao = ROTULOS_PADRAO.includes(valor);
    const alvo = document.querySelector(
      `.rotulo-opcao[data-rotulo="${ehPadrao ? valor : 'Personalizado'}"]`
    );
    marcarRotuloAtivo(alvo);
    campoCustom.hidden = ehPadrao;
    campoCustom.value = ehPadrao ? '' : (valor || '');
    campoHidden.value = ehPadrao ? valor : (valor || '');
  }
  document.querySelectorAll('.rotulo-opcao').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.rotulo === 'Personalizado') {
        marcarRotuloAtivo(btn);
        const custom = document.getElementById('end-rotulo-personalizado');
        custom.hidden = false;
        custom.focus();
        document.getElementById('end-rotulo').value = custom.value.trim();
      } else {
        aplicarRotulo(btn.dataset.rotulo);
      }
    });
  });
  document.getElementById('end-rotulo-personalizado')?.addEventListener('input', (e) => {
    document.getElementById('end-rotulo').value = e.target.value.trim();
  });

  let cepAbort = null, cepTimer = null;
  async function buscarCep(valorDigitado) {
    const statusEl = document.getElementById('cep-status');
    const cep = valorDigitado.replace(/\D/g, '');
    if (cep.length !== 8) { if (statusEl) { statusEl.textContent = ''; statusEl.className = 'cep-status'; } return; }

    if (cepAbort) cepAbort.abort();
    cepAbort = new AbortController();
    statusEl.textContent = 'Buscando endereço…';
    statusEl.className = 'cep-status cep-status-carregando';

    try {
      const resp = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: cepAbort.signal });
      const data = await resp.json();
      if (data.erro) {
        statusEl.textContent = 'CEP não encontrado. Preencha o endereço manualmente.';
        statusEl.className = 'cep-status cep-status-erro';
        return;
      }
      document.getElementById('end-logradouro').value = data.logradouro || document.getElementById('end-logradouro').value;
      document.getElementById('end-bairro').value      = data.bairro || document.getElementById('end-bairro').value;
      document.getElementById('end-cidade').value       = data.localidade || document.getElementById('end-cidade').value;
      document.getElementById('end-uf').value            = data.uf || document.getElementById('end-uf').value;
      statusEl.textContent = 'Endereço encontrado automaticamente.';
      statusEl.className = 'cep-status cep-status-ok';
      document.getElementById('end-numero').focus();
    } catch (err) {
      if (err.name === 'AbortError') return;
      statusEl.textContent = 'Não foi possível buscar o CEP agora. Preencha manualmente.';
      statusEl.className = 'cep-status cep-status-erro';
    }
  }
  document.getElementById('end-cep')?.addEventListener('input', (e) => {
    let v = e.target.value.replace(/\D/g, '').slice(0, 8);
    e.target.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
    clearTimeout(cepTimer);
    cepTimer = setTimeout(() => buscarCep(e.target.value), 500);
  });

  /* Abrir / fechar modal */
  function abrir(endereco) {
    const form = document.getElementById('form-endereco');
    form.reset();
    document.getElementById('modal-endereco-titulo').textContent = endereco ? 'Editar endereço' : 'Novo endereço';
    document.getElementById('endereco-id').value        = endereco?.id || '';
    aplicarRotulo(endereco?.rotulo || 'Casa');
    document.getElementById('end-cep').value             = endereco?.cep || '';
    document.getElementById('end-logradouro').value      = endereco?.logradouro || '';
    document.getElementById('end-numero').value          = endereco?.numero || '';
    document.getElementById('end-complemento').value     = endereco?.complemento || '';
    document.getElementById('end-bairro').value          = endereco?.bairro || '';
    document.getElementById('end-cidade').value          = endereco?.cidade || '';
    document.getElementById('end-uf').value              = endereco?.uf || '';
    document.getElementById('end-referencia').value      = endereco?.referencia || '';
    document.getElementById('end-destinatario').value    = endereco?.destinatario || window.__usuarioNome || '';
    document.getElementById('end-telefone').value        = formatarTelefone(endereco?.telefone) || '';
    document.getElementById('end-padrao').checked        = !!endereco?.padrao;
    document.getElementById('cep-status').textContent    = '';
    document.getElementById('cep-status').className      = 'cep-status';
    limparErrosEndereco();
    modal.showModal();
    document.getElementById('end-cep').focus();
  }

  function fechar() { modal.close(); }

  document.getElementById('fechar-modal-endereco')?.addEventListener('click', fechar);
  document.getElementById('btn-cancelar-endereco')?.addEventListener('click', fechar);
  modal.addEventListener('click', (e) => { if (e.target === modal) fechar(); });

  document.querySelectorAll('[data-abrir-modal-endereco]').forEach(el => {
    el.addEventListener('click', () => abrir(null));
  });

  const CAMPO_ERRO_ID = {
    rotulo: 'erro-rotulo', cep: 'erro-cep', logradouro: 'erro-logradouro',
    numero: 'erro-numero', bairro: 'erro-bairro', cidade: 'erro-cidade',
    uf: 'erro-uf', destinatario: 'erro-destinatario', telefone: 'erro-telefone',
  };

  function limparErrosEndereco() {
    Object.values(CAMPO_ERRO_ID).forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '';
    });
    document.getElementById('form-endereco')?.querySelectorAll('[aria-invalid="true"]')
      .forEach(el => el.removeAttribute('aria-invalid'));
    const msgEl = document.getElementById('msg-endereco');
    msgEl.textContent = ''; msgEl.className = '';
  }

  function marcarErroCampoEndereco(campo, msg) {
    const erroEl = document.getElementById(CAMPO_ERRO_ID[campo]);
    if (erroEl) erroEl.textContent = msg;
    const inputEl = document.getElementById('end-' + campo);
    if (inputEl) inputEl.setAttribute('aria-invalid', 'true');
  }

  function validarCamposEndereco(payload) {
    const erros = {};
    if (!payload.rotulo) erros.rotulo = 'Escolha um título para o endereço.';
    if (!payload.cep || payload.cep.replace(/\D/g, '').length !== 8) erros.cep = 'Informe um CEP válido.';
    if (!payload.logradouro) erros.logradouro = 'Informe a rua/logradouro.';
    if (!payload.numero) erros.numero = 'Informe o número (use "S/N" se não houver).';
    if (!payload.bairro) erros.bairro = 'Informe o bairro.';
    if (!payload.cidade) erros.cidade = 'Informe a cidade.';
    if (!payload.uf || payload.uf.length !== 2) erros.uf = 'Selecione o estado.';
    if (!payload.destinatario) erros.destinatario = 'Informe o nome de quem vai receber a entrega.';
    if (!payload.telefone || payload.telefone.replace(/\D/g, '').length < 8) erros.telefone = 'Informe um telefone válido para a entrega.';
    return erros;
  }

  document.getElementById('form-endereco')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('endereco-id').value;
    const payload = {
      rotulo:       document.getElementById('end-rotulo').value.trim(),
      cep:          document.getElementById('end-cep').value.trim(),
      logradouro:   document.getElementById('end-logradouro').value.trim(),
      numero:       document.getElementById('end-numero').value.trim(),
      complemento:  document.getElementById('end-complemento').value.trim(),
      bairro:       document.getElementById('end-bairro').value.trim(),
      cidade:       document.getElementById('end-cidade').value.trim(),
      uf:           document.getElementById('end-uf').value.trim().toUpperCase(),
      referencia:   document.getElementById('end-referencia').value.trim(),
      destinatario: document.getElementById('end-destinatario').value.trim(),
      telefone:     document.getElementById('end-telefone').value.trim(),
      padrao:       document.getElementById('end-padrao').checked,
    };

    limparErrosEndereco();
    const msgEl = document.getElementById('msg-endereco');

    const erros = validarCamposEndereco(payload);
    const camposComErro = Object.keys(erros);
    if (camposComErro.length > 0) {
      camposComErro.forEach(campo => marcarErroCampoEndereco(campo, erros[campo]));
      document.getElementById('end-' + camposComErro[0])?.focus();
      return;
    }

    const btnSalvar = document.getElementById('btn-salvar-endereco');
    btnSalvar.disabled = true;
    msgEl.className = ''; msgEl.textContent = 'Salvando…';
    try {
      const resp = await fetch(id ? `/api/enderecos/${id}` : '/api/enderecos', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfGlobal() },
        body: JSON.stringify(payload),
      });
      const data = await resp.json();
      if (data.ok) {
        const idSalvo = id ? Number(id) : data.id;
        const validacao = data.validacao;
        if (validacao && validacao.status !== 'valid') {
          msgEl.className = 'msg-aviso';
          msgEl.textContent = validacao.mensagem || 'Endereço salvo, mas não conseguimos confirmar todos os dados automaticamente.';
          setTimeout(() => {
            fechar();
            document.dispatchEvent(new CustomEvent('endereco:salvo', { detail: { id: idSalvo, endereco: payload } }));
          }, 2600);
          return;
        }
        fechar();
        document.dispatchEvent(new CustomEvent('endereco:salvo', { detail: { id: idSalvo, endereco: payload } }));
      } else if (Array.isArray(data.errors) && data.errors.length > 0) {
        msgEl.textContent = '';
        data.errors.forEach(err => { if (CAMPO_ERRO_ID[err.path]) marcarErroCampoEndereco(err.path, err.msg); });
      } else {
        msgEl.className = 'msg-erro'; msgEl.textContent = data.message || 'Erro ao salvar o endereço.';
      }
    } catch {
      msgEl.className = 'msg-erro'; msgEl.textContent = 'Erro de conexão. Verifique sua internet e tente novamente.';
    } finally {
      btnSalvar.disabled = false;
    }
  });

  window.EnderecoUI = {
    escHtml,
    formatarTelefone,
    iconeEndereco,
    ROTULOS_PADRAO,
    abrir,
    fechar,
  };
})();
