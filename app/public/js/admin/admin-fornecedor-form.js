(function () {
  'use strict';

  var form = document.getElementById('form-fornecedor');
  if (!form) return;

  var modoEdicao = form.dataset.modo === 'editar';
  var fornecedorId = form.dataset.id;

  var fRazaoSocial  = document.getElementById('f-razao-social');
  var fNomeFantasia = document.getElementById('f-nome-fantasia');
  var fDocumento    = document.getElementById('f-documento');
  var fTelefone     = document.getElementById('f-telefone');
  var fEmail        = document.getElementById('f-email');
  var fObservacoes  = document.getElementById('f-observacoes');
  var fCep          = document.getElementById('f-cep');
  var fCepStatus    = document.getElementById('f-cep-status');
  var fLogradouro   = document.getElementById('f-logradouro');
  var fNumero       = document.getElementById('f-numero');
  var fComplemento  = document.getElementById('f-complemento');
  var fBairro       = document.getElementById('f-bairro');
  var fCidade       = document.getElementById('f-cidade');
  var fUf           = document.getElementById('f-uf');
  var formMsg       = document.getElementById('form-fornecedor-msg');
  var btnSalvar     = document.getElementById('btn-salvar-fornecedor');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }

  function formatarCpf(d) {
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0, 3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6);
    return d.slice(0, 3) + '.' + d.slice(3, 6) + '.' + d.slice(6, 9) + '-' + d.slice(9, 11);
  }
  function formatarCnpj(d) {
    if (d.length <= 2) return d;
    if (d.length <= 5) return d.slice(0, 2) + '.' + d.slice(2);
    if (d.length <= 8) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5);
    if (d.length <= 12) return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8);
    return d.slice(0, 2) + '.' + d.slice(2, 5) + '.' + d.slice(5, 8) + '/' + d.slice(8, 12) + '-' + d.slice(12, 14);
  }
  function formatarDocumento(digitos) {
    var d = digitos.slice(0, 14);
    return d.length > 11 ? formatarCnpj(d) : formatarCpf(d);
  }
  function cpfValido(digitos) {
    if (!/^\d{11}$/.test(digitos)) return false;
    if (/^(\d)\1{10}$/.test(digitos)) return false;
    var calc = function (base) {
      var soma = 0;
      for (var i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
      var resto = (soma * 10) % 11;
      return resto === 10 ? 0 : resto;
    };
    var base = digitos.slice(0, 9);
    var d1 = calc(base);
    var d2 = calc(base + d1);
    return digitos === base + String(d1) + String(d2);
  }
  function cnpjValido(digitos) {
    if (!/^\d{14}$/.test(digitos)) return false;
    if (/^(\d)\1{13}$/.test(digitos)) return false;
    var calc = function (base, pesos) {
      var soma = 0;
      for (var i = 0; i < base.length; i++) soma += Number(base[i]) * pesos[i];
      var resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    };
    var p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var p2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    var base = digitos.slice(0, 12);
    var d1 = calc(base, p1);
    var d2 = calc(base + d1, p2);
    return digitos === base + String(d1) + String(d2);
  }
  function validarDocumento() {
    var digitos = fDocumento.value.replace(/\D/g, '');
    if (!digitos) { fDocumento.setCustomValidity(''); return; } // opcional — vazio é válido
    if (digitos.length === 11 && cpfValido(digitos)) { fDocumento.setCustomValidity(''); return; }
    if (digitos.length === 14 && cnpjValido(digitos)) { fDocumento.setCustomValidity(''); return; }
    fDocumento.setCustomValidity('CPF ou CNPJ inválido — confira os números digitados.');
  }
  fDocumento.addEventListener('input', function () {
    this.value = formatarDocumento(this.value.replace(/\D/g, ''));
    this.setSelectionRange(this.value.length, this.value.length);
    validarDocumento();
  });
  fDocumento.addEventListener('blur', validarDocumento);

  function formatarTelefone(d) {
    d = d.slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 6) return '(' + d.slice(0, 2) + ') ' + d.slice(2);
    if (d.length <= 10) return '(' + d.slice(0, 2) + ') ' + d.slice(2, 6) + '-' + d.slice(6);
    return '(' + d.slice(0, 2) + ') ' + d.slice(2, 7) + '-' + d.slice(7);
  }
  fTelefone.addEventListener('input', function () {
    this.value = formatarTelefone(this.value.replace(/\D/g, ''));
    this.setSelectionRange(this.value.length, this.value.length);
  });

  var timerCep = null;
  function formatarCep(d) {
    d = d.slice(0, 8);
    return d.length > 5 ? d.slice(0, 5) + '-' + d.slice(5) : d;
  }
  fCep.addEventListener('input', function () {
    this.value = formatarCep(this.value.replace(/\D/g, ''));
    this.setSelectionRange(this.value.length, this.value.length);
    clearTimeout(timerCep);
    var digitos = this.value.replace(/\D/g, '');
    if (digitos.length !== 8) { fCepStatus.textContent = ''; return; }
    fCepStatus.textContent = 'Buscando endereço…';
    timerCep = setTimeout(function () {
      fetch('https://viacep.com.br/ws/' + digitos + '/json/')
        .then(function (r) { return r.json(); })
        .then(function (dados) {
          if (dados.erro) { fCepStatus.textContent = 'CEP não encontrado — confira os números.'; return; }
          if (!fLogradouro.value) fLogradouro.value = dados.logradouro || '';
          if (!fBairro.value) fBairro.value = dados.bairro || '';
          if (!fCidade.value) fCidade.value = dados.localidade || '';
          if (dados.uf) fUf.value = dados.uf;
          fCepStatus.textContent = 'Endereço encontrado — confira e complete o número.';
          fNumero.focus();
        })
        .catch(function () { fCepStatus.textContent = 'Não foi possível consultar o CEP agora — preencha manualmente.'; });
    }, 500);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    validarDocumento();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    var payload = {
      razao_social: fRazaoSocial.value.trim(),
      nome_fantasia: fNomeFantasia.value.trim(),
      documento: fDocumento.value.trim(),
      telefone: fTelefone.value.trim(),
      email: fEmail.value.trim(),
      observacoes: fObservacoes.value.trim(),
      cep: fCep.value.trim(),
      logradouro: fLogradouro.value.trim(),
      numero: fNumero.value.trim(),
      complemento: fComplemento.value.trim(),
      bairro: fBairro.value.trim(),
      cidade: fCidade.value.trim(),
      uf: fUf.value.trim(),
    };

    var url = modoEdicao ? '/api/admin/fornecedores/' + fornecedorId : '/api/admin/fornecedores';
    var metodo = modoEdicao ? 'PUT' : 'POST';

    btnSalvar.disabled = true;
    btnSalvar.classList.add('is-carregando');
    fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          mostrarMsg(data.message || 'Não foi possível salvar.', 'erro');
          btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
          return;
        }
        window.mostrarToastAoRecarregar(modoEdicao ? 'Fornecedor atualizado.' : 'Fornecedor cadastrado.', 'sucesso');
        window.location.href = '/admin/fornecedores';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
      });
  });
})();
