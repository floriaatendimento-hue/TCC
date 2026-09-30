(function () {
  'use strict';

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }

  var form = document.querySelector('[data-config-form]');
  if (!form) return;

  var msg = form.querySelector('.form-admin__mensagem');
  var btnSalvar = form.querySelector('button[type="submit"]');
  var alertaPendente = document.getElementById('config-alteracoes-pendentes');
  var formSujo = false;

  function marcarSujo() {
    if (formSujo) return;
    formSujo = true;
    if (alertaPendente) alertaPendente.hidden = false;
  }
  function marcarLimpo() {
    formSujo = false;
    if (alertaPendente) alertaPendente.hidden = true;
  }
  form.addEventListener('input', marcarSujo);
  form.addEventListener('change', marcarSujo);

  function mostrarMsg(t, tipo) {
    if (!msg) return;
    msg.textContent = t;
    msg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso');
  }

  function montarPayload() {
    var payload = {};
    var campo = function (id) { var el = document.getElementById(id); return el ? el.value : undefined; };

    if (document.getElementById('cfg-loja-nome')) {
      payload.loja_nome = campo('cfg-loja-nome').trim();
    }
    if (document.getElementById('cfg-loja-email')) {
      payload.loja_email          = campo('cfg-loja-email').trim();
      payload.telefone_exibicao   = campo('cfg-telefone-exibicao').trim();
      payload.telefone_e164       = campo('cfg-telefone-e164').trim();
      payload.whatsapp_numero     = campo('cfg-whatsapp-numero').trim();
      payload.whatsapp_mensagem   = campo('cfg-whatsapp-mensagem').trim();
      payload.whatsapp_mensagem_suporte = campo('cfg-whatsapp-mensagem-suporte').trim();
      payload.facebook            = campo('cfg-facebook').trim();
      payload.instagram           = campo('cfg-instagram').trim();
    }
    if (document.getElementById('cfg-cep-origem')) {
      var ufsSelecionadas = Array.prototype.slice
        .call(form.querySelectorAll('.js-uf-entrega:checked'))
        .map(function (el) { return el.value; });

      payload.frete_padrao       = campo('cfg-frete-padrao');
      payload.frete_gratis_acima = campo('cfg-frete-gratis-acima');
      payload.cep_origem         = campo('cfg-cep-origem');
      payload.logradouro_origem  = campo('cfg-logradouro-origem').trim();
      payload.numero_origem      = campo('cfg-numero-origem').trim();
      payload.bairro_origem      = campo('cfg-bairro-origem').trim();
      payload.cidade_origem      = campo('cfg-cidade-origem').trim();
      payload.uf_origem          = campo('cfg-uf-origem').trim();
      payload.ufs_entrega_permitidas = ufsSelecionadas.join(',');
    }
    return payload;
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    mostrarMsg('', '');
    if (msg) msg.className = 'form-admin__mensagem';

    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.classList.add('is-carregando'); }
    fetch('/api/admin/configuracoes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(montarPayload()),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) { mostrarMsg(data.message || 'Não foi possível salvar as configurações. Tente novamente.', 'erro'); return; }
        mostrarMsg('Configurações salvas com sucesso.', 'sucesso');
        marcarLimpo();
      })
      .catch(function () { mostrarMsg('Não foi possível salvar as configurações. Tente novamente.', 'erro'); })
      .then(function () { if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando'); } });
  });

  form.addEventListener('reset', function () {
    marcarLimpo();
    mostrarMsg('', '');
    if (msg) msg.className = 'form-admin__mensagem';
    if (cepStatus) { cepStatus.textContent = ''; cepStatus.className = 'cep-status-admin'; }
  });

  var cepInput = document.getElementById('cfg-cep-origem');
  var cepStatus = document.getElementById('cfg-cep-origem-status');
  if (cepInput && cepStatus) {
    var cepAbort = null, cepTimer = null;

    var buscarCepOrigem = async function (valorDigitado) {
      var cep = valorDigitado.replace(/\D/g, '');
      if (cep.length !== 8) { cepStatus.textContent = ''; cepStatus.className = 'cep-status-admin'; return; }

      if (cepAbort) cepAbort.abort();
      cepAbort = new AbortController();
      cepStatus.textContent = 'Buscando endereço…';
      cepStatus.className = 'cep-status-admin is-carregando';

      try {
        var resp = await fetch('https://viacep.com.br/ws/' + cep + '/json/', { signal: cepAbort.signal });
        var data = await resp.json();
        if (data.erro) {
          cepStatus.textContent = 'CEP não encontrado. Preencha o endereço manualmente.';
          cepStatus.className = 'cep-status-admin is-erro';
          return;
        }
        document.getElementById('cfg-logradouro-origem').value = data.logradouro || document.getElementById('cfg-logradouro-origem').value;
        document.getElementById('cfg-bairro-origem').value     = data.bairro || document.getElementById('cfg-bairro-origem').value;
        document.getElementById('cfg-cidade-origem').value     = data.localidade || document.getElementById('cfg-cidade-origem').value;
        document.getElementById('cfg-uf-origem').value         = data.uf || document.getElementById('cfg-uf-origem').value;
        cepStatus.textContent = 'Endereço encontrado automaticamente.';
        cepStatus.className = 'cep-status-admin is-ok';
        marcarSujo();
      } catch (err) {
        if (err.name === 'AbortError') return;
        cepStatus.textContent = 'Não foi possível buscar o CEP agora. Preencha manualmente.';
        cepStatus.className = 'cep-status-admin is-erro';
      }
    };

    cepInput.addEventListener('input', function (e) {
      var v = e.target.value.replace(/\D/g, '').slice(0, 8);
      e.target.value = v.length > 5 ? v.slice(0, 5) + '-' + v.slice(5) : v;
      clearTimeout(cepTimer);
      cepTimer = setTimeout(function () { buscarCepOrigem(e.target.value); }, 500);
    });
  }

  document.addEventListener('click', function (e) {
    if (!formSujo) return;
    var link = e.target.closest('a[href]');
    if (!link || link.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (link.href === window.location.href) return;
    if (!window.confirmarAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    window.confirmarAdmin(
      'Você possui alterações que ainda não foram salvas.',
      function () { window.location.href = link.href; },
      { titulo: 'Alterações não salvas', rotuloConfirmar: 'Sair sem salvar', perigo: true }
    );
  }, true);

  window.addEventListener('beforeunload', function (e) {
    if (!formSujo) return;
    e.preventDefault();
    e.returnValue = '';
  });
})();
