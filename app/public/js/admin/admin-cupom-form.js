(function () {
  'use strict';

  var form = document.getElementById('form-cupom');
  if (!form) return;

  var modoEdicao = form.dataset.modo === 'editar';
  var cupomId = form.dataset.id;

  var fCodigo      = document.getElementById('f-codigo');
  var btnGerar     = document.getElementById('btn-gerar-codigo');
  var fTipo        = document.getElementById('f-tipo');
  var campoValor   = document.getElementById('f-campo-valor');
  var rotuloValor  = document.getElementById('f-rotulo-valor');
  var fValor       = document.getElementById('f-valor');
  var fValorMinimo = document.getElementById('f-valor-minimo');
  var fLimiteUsos  = document.getElementById('f-limite-usos');
  var fDataInicio  = document.getElementById('f-data-inicio');
  var fDataFim     = document.getElementById('f-data-fim');
  var fAtivo       = document.getElementById('f-ativo');
  var formMsg      = document.getElementById('form-cupom-msg');
  var btnSalvar    = document.getElementById('btn-salvar');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }
  function fmtMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDataBR(iso) { return iso ? new Intl.DateTimeFormat('pt-BR').format(new Date(iso + 'T00:00:00')) : ''; }

  function gerarCodigo() {
    var alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var codigo = 'FLORIA';
    for (var i = 0; i < 4; i++) codigo += alfabeto.charAt(Math.floor(Math.random() * alfabeto.length));
    return codigo;
  }
  btnGerar.addEventListener('click', function () {
    fCodigo.value = gerarCodigo();
    atualizarPreview();
    fCodigo.focus();
  });
  fCodigo.addEventListener('input', function () {
    fCodigo.value = fCodigo.value.toUpperCase();
    atualizarPreview();
  });

  function atualizarVisibilidadeTipo() {
    var ehFrete = fTipo.value === 'frete_gratis';
    campoValor.hidden = ehFrete;
    fValor.required = !ehFrete;
    rotuloValor.textContent = fTipo.value === 'fixo' ? 'Valor do desconto (R$) *' : 'Valor do desconto (%) *';
    atualizarPreview();
  }
  fTipo.addEventListener('change', atualizarVisibilidadeTipo);

  /* Prévia em tempo real */
  function atualizarPreview() {
    var cpCodigo = document.getElementById('cp-codigo');
    var cpDesconto = document.getElementById('cp-desconto');
    var cpValidade = document.getElementById('cp-validade');
    var pvMinimo = document.getElementById('pv-minimo');
    var pvLimite = document.getElementById('pv-limite');
    var pvStatus = document.getElementById('pv-status');

    cpCodigo.textContent = fCodigo.value.trim() || 'SEUCODIGO';

    var descontoTxt = 'Frete grátis';
    if (fTipo.value === 'percentual') descontoTxt = (Number(fValor.value) || 0).toLocaleString('pt-BR') + '% OFF';
    else if (fTipo.value === 'fixo') descontoTxt = fmtMoeda(fValor.value) + ' OFF';
    cpDesconto.textContent = descontoTxt;

    cpValidade.textContent = fDataFim.value ? ('Válido até ' + fmtDataBR(fDataFim.value)) : 'Sem prazo definido';
    pvMinimo.textContent = fValorMinimo.value ? fmtMoeda(fValorMinimo.value) : 'Sem mínimo';
    pvLimite.textContent = fLimiteUsos.value ? (fLimiteUsos.value + ' uso(s)') : 'Sem limite';
    pvStatus.textContent = fAtivo.checked ? 'Ativo' : 'Pausado';
  }
  [fValor, fValorMinimo, fLimiteUsos, fDataInicio, fDataFim, fAtivo].forEach(function (el) {
    el.addEventListener('input', atualizarPreview);
    el.addEventListener('change', atualizarPreview);
  });

  /* Envio */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    var payload = {
      codigo: fCodigo.value.trim().toUpperCase(),
      tipo: fTipo.value,
      valor: fTipo.value === 'frete_gratis' ? null : Number(fValor.value),
      valor_minimo: fValorMinimo.value ? Number(fValorMinimo.value) : '',
      data_inicio: fDataInicio.value || '',
      data_fim: fDataFim.value || '',
      limite_usos: fLimiteUsos.value ? Number(fLimiteUsos.value) : '',
      ativo: fAtivo.checked,
    };

    if (!payload.codigo) { mostrarMsg('Informe um código para o cupom.', 'erro'); fCodigo.focus(); return; }
    if (!/^[A-Za-z0-9-]+$/.test(payload.codigo)) { mostrarMsg('Código deve conter apenas letras, números e hífens.', 'erro'); fCodigo.focus(); return; }
    if (fTipo.value !== 'frete_gratis' && !(Number(fValor.value) > 0)) { mostrarMsg('Informe um valor de desconto válido.', 'erro'); fValor.focus(); return; }
    if (fDataInicio.value && fDataFim.value && fDataFim.value < fDataInicio.value) { mostrarMsg('A data de término deve ser depois da data de início.', 'erro'); return; }

    var url = modoEdicao ? '/api/admin/cupons/' + cupomId : '/api/admin/cupons';
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
        window.mostrarToastAoRecarregar(modoEdicao ? 'Cupom atualizado.' : 'Cupom criado.', 'sucesso');
        window.location.href = '/admin/promocoes#cupons';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
      });
  });

  function preencherComDados(d, comCodigo) {
    if (comCodigo && d.codigo) fCodigo.value = d.codigo;
    fTipo.value = d.tipo || 'percentual';
    if (d.valor != null) fValor.value = d.valor;
    if (d.valor_minimo != null) fValorMinimo.value = d.valor_minimo;
    if (d.limite_usos != null) fLimiteUsos.value = d.limite_usos;
    fDataInicio.value = d.data_inicio || '';
    fDataFim.value = d.data_fim || '';
    if (comCodigo) fAtivo.checked = d.ativo !== false;
    atualizarVisibilidadeTipo();
  }

  var dadosJsonEl = document.getElementById('cupom-dados-json');
  var dadosIniciais = null;
  if (dadosJsonEl && dadosJsonEl.textContent.trim()) {
    try { dadosIniciais = JSON.parse(dadosJsonEl.textContent); } catch (e) { dadosIniciais = null; }
  }

  if (modoEdicao && dadosIniciais) {
    preencherComDados(dadosIniciais, true);
  } else if (!modoEdicao) {
    var duplicado = null;
    try {
      var bruto = sessionStorage.getItem('floria-duplicar-cupom');
      if (bruto) { duplicado = JSON.parse(bruto); sessionStorage.removeItem('floria-duplicar-cupom'); }
    } catch (e) { duplicado = null; }
    if (duplicado) {
      preencherComDados(duplicado, false);
      window.mostrarToast && setTimeout(function () { window.mostrarToast('Dados copiados. Defina um novo código e revise antes de salvar.', 'sucesso'); }, 300);
    } else {
      atualizarVisibilidadeTipo();
    }
  }

  atualizarPreview();
})();
