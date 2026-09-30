(function () {
  'use strict';

  var form = document.getElementById('form-banner');
  if (!form) return;

  var modo = form.dataset.modo;
  var bannerId = form.dataset.id;

  var FORMATOS_ACEITOS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  var TAMANHO_MAXIMO_MB = 5;

  var formMsg      = document.getElementById('form-banner-msg');
  var btnRascunho  = document.getElementById('btn-rascunho');
  var btnPublicar  = document.getElementById('btn-publicar');

  var fTitulo      = document.getElementById('f-titulo');
  var fSubtitulo   = document.getElementById('f-subtitulo');
  var fTextoBotao  = document.getElementById('f-texto-botao');
  var fLink        = document.getElementById('f-link');
  var fOrdem       = document.getElementById('f-ordem');
  var fAtivo       = document.getElementById('f-ativo');

  var fImagem           = document.getElementById('f-imagem');
  var uploadLabel       = document.getElementById('banner-upload');
  var imagemPreviewWrap = document.getElementById('f-imagem-preview-wrap');
  var imagemPreviewImg  = document.getElementById('f-imagem-preview');
  var imagemZona        = document.getElementById('f-imagem-zona');
  var btnImagemRemover  = document.getElementById('f-imagem-remover');

  var fExibirImediatamente = document.getElementById('f-exibir-imediatamente');
  var campoInicio  = document.getElementById('f-campo-inicio');
  var fDataInicio  = document.getElementById('f-data-inicio');
  var fHoraInicio  = document.getElementById('f-hora-inicio');
  var fSemDataFim  = document.getElementById('f-sem-data-fim');
  var campoFim     = document.getElementById('f-campo-fim');
  var fDataFim     = document.getElementById('f-data-fim');
  var fHoraFim     = document.getElementById('f-hora-fim');

  var dispositivoBotoes = Array.prototype.slice.call(document.querySelectorAll('.banner-preview-dispositivos button'));
  var previewFrame  = document.getElementById('banner-preview-frame');
  var pvImagem      = document.getElementById('pv-imagem');
  var pvVazio       = document.getElementById('pv-vazio');
  var pvVeu         = document.getElementById('pv-veu');
  var pvLegenda     = document.getElementById('pv-legenda');
  var pvTitulo      = document.getElementById('pv-titulo');
  var pvSubtitulo   = document.getElementById('pv-subtitulo');
  var pvBotao       = document.getElementById('pv-botao');
  var pvStatusBadge = document.getElementById('pv-status-badge');
  var pvStatusExplicacao = document.getElementById('pv-status-explicacao');
  var pvOrdem       = document.getElementById('pv-ordem');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }

  var dadosIniciais = null;
  var elDados = document.getElementById('banner-dados-json');
  if (elDados && elDados.textContent.trim()) {
    try { dadosIniciais = JSON.parse(elDados.textContent); } catch (e) { dadosIniciais = null; }
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function paraDataHoraLocal(iso) {
    if (!iso) return { data: '', hora: '' };
    var d = new Date(iso);
    if (isNaN(d.getTime())) return { data: '', hora: '' };
    return {
      data: d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()),
      hora: pad(d.getHours()) + ':' + pad(d.getMinutes()),
    };
  }
  function paraISO(dataStr, horaStr) {
    if (!dataStr) return '';
    var p = dataStr.split('-').map(Number);
    var h = (horaStr || '00:00').split(':').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2], h[0] || 0, h[1] || 0, 0);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  function paraDataObjeto(dataStr, horaStr) {
    if (!dataStr) return null;
    var p = dataStr.split('-').map(Number);
    var h = (horaStr || '00:00').split(':').map(Number);
    var d = new Date(p[0], p[1] - 1, p[2], h[0] || 0, h[1] || 0, 0);
    return isNaN(d.getTime()) ? null : d;
  }

  /* Hidrata a edição */
  if (modo === 'editar' && dadosIniciais) {
    if (dadosIniciais.data_inicio) {
      var ini = paraDataHoraLocal(dadosIniciais.data_inicio);
      fDataInicio.value = ini.data;
      fHoraInicio.value = ini.hora;
    }
    if (dadosIniciais.data_fim) {
      var fim = paraDataHoraLocal(dadosIniciais.data_fim);
      fDataFim.value = fim.data;
      fHoraFim.value = fim.hora;
    }
  }

  function sincronizarInicio() {
    var imediato = fExibirImediatamente.checked;
    fDataInicio.disabled = imediato;
    fHoraInicio.disabled = imediato;
    if (imediato) { fDataInicio.value = ''; fHoraInicio.value = ''; }
    campoInicio.style.opacity = imediato ? '.5' : '';
    atualizarPreview();
  }
  function sincronizarFim() {
    var semFim = fSemDataFim.checked;
    fDataFim.disabled = semFim;
    fHoraFim.disabled = semFim;
    if (semFim) { fDataFim.value = ''; fHoraFim.value = ''; }
    campoFim.style.opacity = semFim ? '.5' : '';
    atualizarPreview();
  }
  fExibirImediatamente.addEventListener('change', sincronizarInicio);
  fSemDataFim.addEventListener('change', sincronizarFim);

  function mostrarPreviewImagem(src) {
    imagemPreviewImg.src = src;
    imagemPreviewWrap.hidden = false;
    imagemZona.hidden = true;
  }
  function limparPreviewImagem() {
    if (modo === 'editar' && dadosIniciais && dadosIniciais.imagem) {
      mostrarPreviewImagem(dadosIniciais.imagem);
    } else {
      imagemPreviewWrap.hidden = true;
      imagemZona.hidden = false;
    }
  }

  function processarArquivo(arquivo) {
    if (!arquivo) return;
    if (FORMATOS_ACEITOS.indexOf(arquivo.type) === -1) {
      mostrarMsg('Formato de imagem não permitido. Use JPG, PNG ou WEBP.', 'erro');
      fImagem.value = '';
      return;
    }
    if (arquivo.size > TAMANHO_MAXIMO_MB * 1024 * 1024) {
      mostrarMsg('Arquivo muito grande (máx. ' + TAMANHO_MAXIMO_MB + ' MB).', 'erro');
      fImagem.value = '';
      return;
    }
    limparMsg();
    var leitor = new FileReader();
    leitor.onload = function (e) { mostrarPreviewImagem(e.target.result); atualizarPreview(); };
    leitor.readAsDataURL(arquivo);
  }

  fImagem.addEventListener('change', function () { processarArquivo(fImagem.files && fImagem.files[0]); });

  btnImagemRemover.addEventListener('click', function (e) {
    e.preventDefault();
    fImagem.value = '';
    limparPreviewImagem();
    atualizarPreview();
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    uploadLabel.addEventListener(evt, function (e) { e.preventDefault(); uploadLabel.classList.add('is-arrastando'); });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    uploadLabel.addEventListener(evt, function (e) { e.preventDefault(); uploadLabel.classList.remove('is-arrastando'); });
  });
  uploadLabel.addEventListener('drop', function (e) {
    var arquivo = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (!arquivo) return;
    try {
      var dt = new DataTransfer();
      dt.items.add(arquivo);
      fImagem.files = dt.files;
    } catch (err) {   }
    processarArquivo(arquivo);
  });

  dispositivoBotoes.forEach(function (botao) {
    botao.addEventListener('click', function () {
      dispositivoBotoes.forEach(function (b) { b.classList.remove('is-ativo'); });
      botao.classList.add('is-ativo');
      previewFrame.className = 'banner-preview-frame is-' + botao.dataset.dispositivo;
    });
  });

  function calcularStatus() {
    if (!fAtivo.checked) return { texto: 'Pausado', classe: 'badge--cinza', explicacao: 'Banner pausado: não aparece na loja.' };
    var agora = new Date();
    var inicio = fExibirImediatamente.checked ? null : paraDataObjeto(fDataInicio.value, fHoraInicio.value);
    var fim = fSemDataFim.checked ? null : paraDataObjeto(fDataFim.value, fHoraFim.value);
    if (inicio && inicio > agora) return { texto: 'Agendado', classe: 'badge--dourado', explicacao: 'Entra no ar automaticamente em ' + inicio.toLocaleString('pt-BR') + '.' };
    if (fim && fim < agora) return { texto: 'Expirado', classe: 'badge--vermelho', explicacao: 'Vigência encerrada em ' + fim.toLocaleString('pt-BR') + '.' };
    return { texto: 'Ativo', classe: 'badge--verde', explicacao: 'Visível na loja agora.' };
  }

  function atualizarPreview() {
    var temImagem = !imagemPreviewWrap.hidden && imagemPreviewImg.src;
    pvImagem.hidden = !temImagem;
    pvVazio.hidden = !!temImagem;
    if (temImagem) pvImagem.src = imagemPreviewImg.src;

    var temLegenda = !!(fTitulo.value.trim() || fSubtitulo.value.trim());
    pvVeu.hidden = !(temImagem && temLegenda);
    pvLegenda.hidden = !temLegenda;
    pvTitulo.textContent = fTitulo.value.trim();
    pvTitulo.hidden = !fTitulo.value.trim();
    pvSubtitulo.textContent = fSubtitulo.value.trim();
    pvSubtitulo.hidden = !fSubtitulo.value.trim();

    var temBotao = !!(fTextoBotao.value.trim() && fLink.value.trim());
    pvBotao.hidden = !temBotao;
    pvBotao.textContent = fTextoBotao.value.trim();

    var status = calcularStatus();
    pvStatusBadge.textContent = status.texto;
    pvStatusBadge.className = 'badge ' + status.classe;
    pvStatusExplicacao.textContent = status.explicacao;

    pvOrdem.textContent = fOrdem.value.trim() ? ('#' + fOrdem.value.trim()) : (modo === 'editar' && dadosIniciais ? ('#' + dadosIniciais.ordem) : 'Último');
  }

  [fTitulo, fSubtitulo, fTextoBotao, fLink, fOrdem, fDataInicio, fHoraInicio, fDataFim, fHoraFim].forEach(function (campo) {
    campo.addEventListener('input', atualizarPreview);
  });
  fAtivo.addEventListener('change', atualizarPreview);

  sincronizarInicio();
  sincronizarFim();
  atualizarPreview();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    var botao = e.submitter;
    if (botao === btnRascunho) fAtivo.checked = false;
    else if (botao === btnPublicar) fAtivo.checked = true;
    atualizarPreview();

    if (!fExibirImediatamente.checked && !fSemDataFim.checked) {
      var inicioValido = paraDataObjeto(fDataInicio.value, fHoraInicio.value);
      var fimValido = paraDataObjeto(fDataFim.value, fHoraFim.value);
      if (inicioValido && fimValido && fimValido < inicioValido) {
        mostrarMsg('A data/hora de término deve ser depois da data/hora de início.', 'erro');
        return;
      }
    }

    var dados = new FormData();
    dados.append('titulo', fTitulo.value.trim());
    dados.append('subtitulo', fSubtitulo.value.trim());
    dados.append('texto_botao', fTextoBotao.value.trim());
    dados.append('link', fLink.value.trim());
    dados.append('ordem', fOrdem.value.trim());
    dados.append('ativo', fAtivo.checked ? '1' : '0');
    dados.append('data_inicio', fExibirImediatamente.checked ? '' : paraISO(fDataInicio.value, fHoraInicio.value));
    dados.append('data_fim', fSemDataFim.checked ? '' : paraISO(fDataFim.value, fHoraFim.value));
    if (fImagem.files && fImagem.files[0]) dados.append('imagem', fImagem.files[0]);

    var url = modo === 'novo' ? '/api/admin/banners' : ('/api/admin/banners/' + bannerId);
    var metodo = modo === 'novo' ? 'POST' : 'PUT';

    [btnRascunho, btnPublicar].forEach(function (b) { b.disabled = true; });
    if (botao) botao.classList.add('is-carregando');

    fetch(url, { method: metodo, headers: { 'Accept': 'application/json', 'X-CSRF-Token': csrfToken() }, body: dados })
      .then(function (r) { return r.json(); })
      .then(function (res) {
        if (!res.ok) {
          mostrarMsg(res.message || 'Não foi possível salvar o banner.', 'erro');
          [btnRascunho, btnPublicar].forEach(function (b) { b.disabled = false; });
          if (botao) botao.classList.remove('is-carregando');
          return;
        }
        if (window.mostrarToastAoRecarregar) {
          window.mostrarToastAoRecarregar(modo === 'novo' ? 'Banner criado com sucesso.' : 'Banner atualizado com sucesso.', 'sucesso');
        }
        window.location.href = '/admin/banners';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        [btnRascunho, btnPublicar].forEach(function (b) { b.disabled = false; });
        if (botao) botao.classList.remove('is-carregando');
      });
  });
})();
