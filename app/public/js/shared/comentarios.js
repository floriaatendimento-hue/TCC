(function () {
  'use strict';

  var secao = document.getElementById('comentarios');
  if (!secao) return;

  var slug    = window.location.pathname.replace(/^\/+/, '').replace(/^produto\//, '') || 'produto';
  var csrf    = (document.getElementById('csrf-token') || {}).value || '';

  var starGroup  = document.getElementById('star-group');
  var form       = document.getElementById('review-form');
  var formTitulo = document.getElementById('review-form-titulo');
  var textarea   = document.getElementById('review-texto');
  var msgEl      = document.getElementById('review-msg');
  var listaEl    = document.getElementById('lista-comentarios');
  var resumoEl   = document.getElementById('avaliacoes-resumo');
  var topoWrap   = document.getElementById('produto-avaliacao-topo');
  var topoEstr   = document.getElementById('produto-avaliacao-estrelas');
  var topoQtd    = document.getElementById('produto-avaliacao-qtd');
  var btnEnviar  = document.getElementById('btn-enviar-review');
  var btnExcluirReview = document.getElementById('btn-excluir-review');
  var avisoStatusEl    = document.getElementById('review-status-aviso');
  var ctaBox     = document.getElementById('avaliar-cta');
  var ctaTitulo  = document.getElementById('avaliar-cta-titulo');
  var ctaTexto   = document.getElementById('avaliar-cta-texto');
  var btnToggleForm  = document.getElementById('btn-avaliar-toggle');
  var btnToggleLista = document.getElementById('btn-toggle-lista');
  var filtroWrap = document.getElementById('filtro-avaliacoes');

  var avaliacaoSelecionada = 0;
  var minhaAvaliacaoId     = null;
  var todosComentarios     = [];
  var filtroAtivo          = 'todas';
  var nomeLoja              = 'Floria';

  /* Helpers */
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatarData(str) {
    try {
      return new Date(str).toLocaleDateString('pt-BR', {
        day: '2-digit', month: 'long', year: 'numeric',
      });
    } catch (_) { return str; }
  }

  function renderEstrelas(nota, tamanho) {
    var html = '';
    for (var i = 1; i <= 5; i++) {
      var cheia = i <= nota;
      html += '<i class="' + (cheia ? 'estrela-cheia' : 'estrela-vazia') +
              '" aria-hidden="true"><i class="' + (cheia ? 'fas' : 'far') + ' fa-star" aria-hidden="true"></i></i>';
    }
    return html;
  }

  /* Estrelas interativas */
  if (starGroup) {
    var botoes = starGroup.querySelectorAll('button');

    botoes.forEach(function (btn) {
      btn.addEventListener('mouseenter', function () {
        iluminarAte(Number(btn.dataset.valor));
      });
      btn.addEventListener('click', function () {
        avaliacaoSelecionada = Number(btn.dataset.valor);
        iluminarAte(avaliacaoSelecionada);
      });
    });

    starGroup.addEventListener('mouseleave', function () {
      iluminarAte(avaliacaoSelecionada);
    });

    function iluminarAte(n) {
      botoes.forEach(function (b, i) {
        b.classList.toggle('ativo', i < n);
      });
    }
  }

  /* Alternar exibição do formulário */
  if (btnToggleForm && form) {
    btnToggleForm.addEventListener('click', function () {
      var abrindo = form.hasAttribute('hidden');
      if (abrindo) {
        form.removeAttribute('hidden');
        btnToggleForm.textContent = 'Fechar';
        if (textarea) textarea.focus();
      } else {
        form.setAttribute('hidden', '');
        btnToggleForm.textContent = minhaAvaliacaoId ? 'Editar' : 'Avaliar';
      }
    });
  }

  if (btnToggleLista && listaEl) {
    btnToggleLista.addEventListener('click', function () {
      var ocultando = !listaEl.hasAttribute('hidden');
      if (ocultando) {
        listaEl.setAttribute('hidden', '');
        btnToggleLista.textContent = 'Mostrar comentários';
        btnToggleLista.setAttribute('aria-expanded', 'false');
      } else {
        listaEl.removeAttribute('hidden');
        btnToggleLista.textContent = 'Ocultar comentários';
        btnToggleLista.setAttribute('aria-expanded', 'true');
      }
    });
  }

  var TIPOS_IMAGEM     = ['image/jpeg', 'image/png', 'image/webp'];
  var TIPOS_VIDEO       = ['video/mp4', 'video/webm', 'video/quicktime'];
  var LIMITE_IMAGENS    = 10;
  var LIMITE_VIDEOS     = 3;
  var MAX_IMG_BYTES     = 8  * 1024 * 1024;
  var MAX_VIDEO_BYTES   = 40 * 1024 * 1024;

  var inputImagens   = document.getElementById('review-imagens');
  var inputVideos    = document.getElementById('review-videos');
  var btnEscolherImg = document.getElementById('btn-escolher-imagens');
  var btnEscolherVid = document.getElementById('btn-escolher-videos');
  var previewEl       = document.getElementById('review-midia-preview');
  var progressoWrap   = document.getElementById('review-upload-progresso');
  var progressoFill   = document.getElementById('review-upload-barra-fill');
  var progressoTexto  = document.getElementById('review-upload-progresso-texto');

  var midiaExistente = [];
  var novasImagens   = [];
  var novosVideos    = [];

  if (btnEscolherImg && inputImagens) {
    btnEscolherImg.addEventListener('click', function () { inputImagens.click(); });
  }
  if (btnEscolherVid && inputVideos) {
    btnEscolherVid.addEventListener('click', function () { inputVideos.click(); });
  }

  function contarImagensAtual() {
    return midiaExistente.filter(function (m) { return m.tipo === 'imagem' && !m.remover; }).length + novasImagens.length;
  }
  function contarVideosAtual() {
    return midiaExistente.filter(function (m) { return m.tipo === 'video' && !m.remover; }).length + novosVideos.length;
  }

  function gerarThumbVideo(file) {
    return new Promise(function (resolve, reject) {
      var video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      var url = URL.createObjectURL(file);
      video.src = url;

      function limpar() { URL.revokeObjectURL(url); }

      video.addEventListener('loadeddata', function onLoaded() {
        video.removeEventListener('loadeddata', onLoaded);
        try {
          video.currentTime = Math.min(1, (video.duration || 1) * 0.1) || 0.1;
        } catch (_) {
          capturarFrame();
        }
      });
      video.addEventListener('seeked', capturarFrame);
      video.addEventListener('error', function () {
        limpar();
        reject(new Error('Não foi possível ler o vídeo "' + file.name + '". Verifique se o arquivo não está corrompido.'));
      });

      function capturarFrame() {
        try {
          var canvas = document.createElement('canvas');
          canvas.width  = video.videoWidth  || 320;
          canvas.height = video.videoHeight || 240;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(function (blob) {
            limpar();
            if (blob) resolve(blob);
            else reject(new Error('Não foi possível gerar a miniatura do vídeo "' + file.name + '".'));
          }, 'image/jpeg', 0.82);
        } catch (err) {
          limpar();
          reject(err);
        }
      }
    });
  }

  if (inputImagens) {
    inputImagens.addEventListener('change', function () {
      var arquivos = Array.prototype.slice.call(inputImagens.files || []);
      arquivos.forEach(function (f) {
        if (contarImagensAtual() >= LIMITE_IMAGENS) {
          mostrarMsg('Máximo de ' + LIMITE_IMAGENS + ' fotos por avaliação.', 'erro');
          return;
        }
        if (TIPOS_IMAGEM.indexOf(f.type) === -1) {
          mostrarMsg('Formato não permitido para "' + f.name + '". Use JPG, PNG ou WebP.', 'erro');
          return;
        }
        if (f.size > MAX_IMG_BYTES) {
          mostrarMsg('"' + f.name + '" excede o tamanho máximo de 8 MB por foto.', 'erro');
          return;
        }
        f._previewUrl = URL.createObjectURL(f);
        novasImagens.push(f);
      });
      inputImagens.value = '';
      renderizarPreview();
    });
  }

  if (inputVideos) {
    inputVideos.addEventListener('change', function () {
      var arquivos = Array.prototype.slice.call(inputVideos.files || []);
      arquivos.forEach(function (f) {
        if (contarVideosAtual() >= LIMITE_VIDEOS) {
          mostrarMsg('Máximo de ' + LIMITE_VIDEOS + ' vídeos por avaliação.', 'erro');
          return;
        }
        var pareceMov = /\.mov$/i.test(f.name);
        if (TIPOS_VIDEO.indexOf(f.type) === -1 && !(pareceMov && (f.type === '' || f.type === 'video/quicktime'))) {
          mostrarMsg('Formato não permitido para "' + f.name + '". Use MP4, WebM ou MOV.', 'erro');
          return;
        }
        if (f.size > MAX_VIDEO_BYTES) {
          mostrarMsg('"' + f.name + '" excede o tamanho máximo de 40 MB por vídeo.', 'erro');
          return;
        }

        var item = { file: f, thumbBlob: null, previewUrl: URL.createObjectURL(f), gerando: true };
        novosVideos.push(item);
        renderizarPreview();

        gerarThumbVideo(f).then(function (blob) {
          item.thumbBlob = blob;
          item.gerando = false;
          renderizarPreview();
        }).catch(function (err) {
          var idx = novosVideos.indexOf(item);
          if (idx > -1) novosVideos.splice(idx, 1);
          URL.revokeObjectURL(item.previewUrl);
          mostrarMsg(err.message || 'Não foi possível processar o vídeo.', 'erro');
          renderizarPreview();
        });
      });
      inputVideos.value = '';
    });
  }

  function renderizarPreview() {
    if (!previewEl) return;
    var html = '';

    midiaExistente.forEach(function (m) {
      if (m.remover) return;
      var thumb = m.thumbnail || m.arquivo;
      html +=
        '<figure class="midia-preview-item">' +
          (m.tipo === 'video' ? '<b class="midia-preview-badge">Vídeo</b>' : '') +
          '<img src="' + escHtml(thumb) + '" alt="">' +
          '<button type="button" class="midia-preview-remover" data-existente-id="' + m.id + '" aria-label="Remover mídia">&times;</button>' +
        '</figure>';
    });

    novasImagens.forEach(function (f, i) {
      html +=
        '<figure class="midia-preview-item">' +
          '<img src="' + f._previewUrl + '" alt="">' +
          '<button type="button" class="midia-preview-remover" data-nova-imagem="' + i + '" aria-label="Remover foto">&times;</button>' +
        '</figure>';
    });

    novosVideos.forEach(function (v, i) {
      html +=
        '<figure class="midia-preview-item">' +
          '<b class="midia-preview-badge">Vídeo</b>' +
          (v.gerando
            ? '<b class="midia-preview-carregando">Gerando prévia…</b>'
            : '<video src="' + v.previewUrl + '" muted></video>') +
          '<button type="button" class="midia-preview-remover" data-novo-video="' + i + '" aria-label="Remover vídeo">&times;</button>' +
        '</figure>';
    });

    previewEl.innerHTML = html;
    previewEl.hidden = !html;
  }

  if (previewEl) {
    previewEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.midia-preview-remover');
      if (!btn) return;

      if (btn.dataset.existenteId) {
        var id = Number(btn.dataset.existenteId);
        var m = midiaExistente.filter(function (x) { return x.id === id; })[0];
        if (m) m.remover = true;
      } else if (btn.dataset.novaImagem !== undefined) {
        var idxImg = Number(btn.dataset.novaImagem);
        if (novasImagens[idxImg]) {
          URL.revokeObjectURL(novasImagens[idxImg]._previewUrl);
          novasImagens.splice(idxImg, 1);
        }
      } else if (btn.dataset.novoVideo !== undefined) {
        var idxVid = Number(btn.dataset.novoVideo);
        if (novosVideos[idxVid]) {
          URL.revokeObjectURL(novosVideos[idxVid].previewUrl);
          novosVideos.splice(idxVid, 1);
        }
      }
      renderizarPreview();
    });
  }

  function limparSelecaoMidia() {
    novasImagens.forEach(function (f) { if (f._previewUrl) URL.revokeObjectURL(f._previewUrl); });
    novosVideos.forEach(function (v) { URL.revokeObjectURL(v.previewUrl); });
    novasImagens = [];
    novosVideos  = [];
    midiaExistente = [];
    renderizarPreview();
  }

  function mostrarProgresso(pct) {
    if (!progressoWrap) return;
    progressoWrap.hidden = false;
    if (progressoFill)  progressoFill.style.width = pct + '%';
    if (progressoTexto) progressoTexto.textContent = 'Enviando… ' + pct + '%';
  }
  function esconderProgresso() {
    if (!progressoWrap) return;
    progressoWrap.hidden = true;
    if (progressoFill) progressoFill.style.width = '0%';
  }

  /* LIGHTBOX — ampliar fotos da galeria */
  function abrirLightbox(src) {
    var overlay = document.getElementById('floria-lightbox');
    if (!overlay) {
      overlay = document.createElement('aside');
      overlay.id = 'floria-lightbox';
      overlay.className = 'floria-lightbox-overlay';
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      overlay.setAttribute('aria-label', 'Imagem ampliada');
      overlay.innerHTML =
        '<button type="button" class="floria-lightbox-fechar" aria-label="Fechar">&times;</button>' +
        '<img class="floria-lightbox-img" alt="Foto enviada pelo cliente, ampliada">';
      document.body.appendChild(overlay);

      overlay.addEventListener('click', function (e) {
        if (e.target === overlay || e.target.classList.contains('floria-lightbox-fechar')) fecharLightbox();
      });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') fecharLightbox();
      });
    }
    overlay.querySelector('.floria-lightbox-img').src = src;
    overlay.classList.add('show');
  }
  function fecharLightbox() {
    var overlay = document.getElementById('floria-lightbox');
    if (overlay) overlay.classList.remove('show');
  }

  var CHAVE_OCULTAR_MIDIAS = 'floria_ocultar_midias_avaliacoes';
  var toggleOcultarMidias  = document.getElementById('toggle-ocultar-midias');

  function aplicarPreferenciaMidias() {
    var oculto = false;
    try { oculto = localStorage.getItem(CHAVE_OCULTAR_MIDIAS) === '1'; } catch (_) {}
    secao.classList.toggle('ocultar-midias', oculto);
    if (toggleOcultarMidias) toggleOcultarMidias.checked = oculto;
  }
  if (toggleOcultarMidias) {
    toggleOcultarMidias.addEventListener('change', function () {
      try { localStorage.setItem(CHAVE_OCULTAR_MIDIAS, toggleOcultarMidias.checked ? '1' : '0'); } catch (_) {}
      aplicarPreferenciaMidias();
    });
  }
  aplicarPreferenciaMidias();

  function sincronizarMinhaAvaliacao(minha) {
    if (!form) return;

    minhaAvaliacaoId = minha ? minha.id : null;
    midiaExistente = (minha && minha.midias)
      ? minha.midias.map(function (m) { return { id: m.id, tipo: m.tipo, arquivo: m.arquivo, thumbnail: m.thumbnail, remover: false }; })
      : [];
    renderizarPreview();

    if (minha) {
      avaliacaoSelecionada = Number(minha.avaliacao);
      if (starGroup) {
        starGroup.querySelectorAll('button').forEach(function (b, i) {
          b.classList.toggle('ativo', i < avaliacaoSelecionada);
        });
      }
      if (textarea && !form.dataset.editadoPeloUsuario) textarea.value = minha.comentario || '';
      if (formTitulo) formTitulo.textContent = 'Atualizar sua avaliação';
      if (btnEnviar)  btnEnviar.textContent  = 'Atualizar avaliação';
      if (ctaTitulo)  ctaTitulo.textContent  = 'Você já avaliou este produto';
      if (ctaTexto)   ctaTexto.textContent   = 'Quer mudar sua nota, seu comentário ou suas fotos/vídeos?';
      if (btnToggleForm && form.hasAttribute('hidden')) btnToggleForm.textContent = 'Editar';
      if (btnExcluirReview) btnExcluirReview.hidden = false;

      if (avisoStatusEl) {
        if (minha.status === 'reprovado') {
          avisoStatusEl.hidden = false;
          avisoStatusEl.textContent = 'Sua avaliação foi reprovada pela moderação e não está visível publicamente no momento. Você pode editá-la e reenviar.';
        } else {
          avisoStatusEl.hidden = true;
        }
      }
    } else {
      if (formTitulo) formTitulo.textContent = 'Deixe sua avaliação';
      if (btnEnviar)  btnEnviar.textContent  = 'Publicar avaliação';
      if (ctaTitulo)  ctaTitulo.textContent  = 'Comprou este produto?';
      if (ctaTexto)   ctaTexto.textContent   = 'Conte-nos sua experiência.';
      if (btnToggleForm && form.hasAttribute('hidden')) btnToggleForm.textContent = 'Avaliar';
      if (btnExcluirReview) btnExcluirReview.hidden = true;
      if (avisoStatusEl) avisoStatusEl.hidden = true;
    }
  }

  /* Filtrar comentários por nota */
  if (filtroWrap) {
    filtroWrap.addEventListener('click', function (e) {
      var btn = e.target.closest('.filtro-btn');
      if (!btn) return;

      filtroAtivo = btn.dataset.filtro;
      filtroWrap.querySelectorAll('.filtro-btn').forEach(function (b) {
        b.classList.toggle('ativo', b === btn);
      });

      var filtrada = filtroAtivo === 'todas'
        ? todosComentarios
        : todosComentarios.filter(function (c) { return Number(c.avaliacao) === Number(filtroAtivo); });

      renderizarLista(filtrada, filtroAtivo);
    });
  }

  function renderizarResumo(media, total, lista) {
    if (!resumoEl) return;
    if (!total) { resumoEl.innerHTML = ''; return; }

    var contagem = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    (lista || []).forEach(function (c) {
      var n = Number(c.avaliacao);
      if (contagem[n] !== undefined) contagem[n]++;
    });

    var barras = '';
    for (var estrela = 5; estrela >= 1; estrela--) {
      var qtd = contagem[estrela] || 0;
      var pct = total ? Math.round((qtd / total) * 100) : 0;
      barras +=
        '<p class="resumo-barra-linha">' +
          '<b class="resumo-barra-label">' + estrela + ' <i class="fas fa-star" aria-hidden="true"></i></b>' +
          '<b class="resumo-barra-track">' +
            '<b class="resumo-barra-fill" style="width:' + pct + '%"></b>' +
          '</b>' +
          '<output class="resumo-barra-qtd">' + qtd + '</output>' +
        '</p>';
    }

    resumoEl.innerHTML =
      '<p class="resumo-principal">' +
        '<output class="resumo-numero">' + Number(media).toFixed(1).replace('.', ',') + '</output>' +
        '<i class="resumo-estrelas">' + renderEstrelas(Math.round(media)) + '</i>' +
        '<output class="resumo-total">' + total + (total === 1 ? ' avaliação' : ' avaliações') + '</output>' +
      '</p>' +
      '<section class="resumo-barras">' + barras + '</section>';
  }

  function renderMidiasComentario(midias) {
    if (!midias || !midias.length) return '';
    var imagens = midias.filter(function (m) { return m.tipo === 'imagem'; });
    var videos  = midias.filter(function (m) { return m.tipo === 'video'; });
    var html = '<section class="comentario-midias">';

    if (imagens.length) {
      html += '<section class="comentario-galeria-imagens">' + imagens.map(function (m) {
        return '<button type="button" class="comentario-midia-thumb" data-lightbox-src="' + escHtml(m.arquivo) + '" aria-label="Ampliar imagem">' +
          '<img src="' + escHtml(m.thumbnail || m.arquivo) + '" alt="Foto enviada por um cliente" loading="lazy"></button>';
      }).join('') + '</section>';
    }
    if (videos.length) {
      html += '<section class="comentario-galeria-videos">' + videos.map(function (m) {
        return '<video class="comentario-midia-video" controls preload="metadata" playsinline' +
          (m.thumbnail ? ' poster="' + escHtml(m.thumbnail) + '"' : '') + '>' +
          '<source src="' + escHtml(m.arquivo) + '">' +
          '</video>';
      }).join('') + '</section>';
    }
    html += '</section>';
    return html;
  }

  function renderRespostaComentario(c) {
    if (!c.resposta) return '';
    var autor = escHtml(nomeLoja ? 'Resposta da ' + nomeLoja : 'Resposta da Floria');
    var dataIso = c.resposta_em ? new Date(c.resposta_em).toISOString() : '';
    return (
      '<article class="comentario-resposta">' +
        '<header class="comentario-resposta-cabecalho">' +
          '<strong class="comentario-resposta-autor">' + autor + '</strong>' +
          (c.resposta_em ? '<time class="comentario-resposta-data" datetime="' + dataIso + '">' + formatarData(c.resposta_em) + '</time>' : '') +
        '</header>' +
        '<p class="comentario-resposta-texto">' + escHtml(c.resposta) + '</p>' +
      '</article>'
    );
  }

  /* Renderizar lista de comentários */
  function renderizarLista(lista, filtro) {
    if (!listaEl) return;
    if (!lista || lista.length === 0) {
      var msg = (filtro && filtro !== 'todas')
        ? 'Nenhuma avaliação com ' + filtro + ' estrela' + (filtro === '1' ? '' : 's') + ' ainda.'
        : 'Nenhum comentário ainda. Seja o primeiro a avaliar!';
      listaEl.innerHTML = '<p class="sem-comentario">' + msg + '</p>';
      return;
    }

    var html = lista.map(function (c) {
      var nome     = escHtml(c.usuario_nome || 'Usuário');
      var iniciais = nome.replace(/&\w+;/g, '?')
        .split(/\s+/).slice(0, 2)
        .map(function (p) { return p[0] || ''; })
        .join('').toUpperCase() || '?';

      var avatarHtml = c.usuario_foto
        ? '<img class="comentario-avatar" src="' + escHtml(c.usuario_foto) + '" alt="" aria-hidden="true">'
        : '<b class="comentario-avatar" aria-hidden="true">' + iniciais + '</b>';

      var ehMeu = window.__usuarioId && Number(c.usuario_id) === Number(window.__usuarioId);

      return (
        '<article class="comentario-item">' +
          '<header class="comentario-header">' +
            avatarHtml +
            '<section class="comentario-meta">' +
              '<strong class="comentario-autor">' + nome + '</strong>' +
              '<small class="comentario-data">' + formatarData(c.criado_em) +
                (c.editado_em ? ' <small class="comentario-editado">(editado)</small>' : '') +
              '</small>' +
            '</section>' +
            '<b class="comentario-stars"' +
              ' aria-label="Avaliação: ' + c.avaliacao + ' de 5 estrelas">' +
              renderEstrelas(c.avaliacao) +
            '</b>' +
          '</header>' +
          '<p class="comentario-texto">' + escHtml(c.comentario) + '</p>' +
          renderMidiasComentario(c.midias) +
          (ehMeu ? '<button type="button" class="comentario-excluir-link" data-id="' + c.id + '">Excluir minha avaliação</button>' : '') +
          renderRespostaComentario(c) +
        '</article>'
      );
    }).join('');

    listaEl.innerHTML = html;
  }

  if (listaEl) {
    listaEl.addEventListener('click', function (e) {
      var thumb = e.target.closest('.comentario-midia-thumb');
      if (thumb) { abrirLightbox(thumb.dataset.lightboxSrc); return; }

      var btnDel = e.target.closest('.comentario-excluir-link');
      if (btnDel) {
        excluirAvaliacao(btnDel.dataset.id);
      }
    });
  }

  function excluirAvaliacao(id) {
    if (!id) return;
    window.confirmarAcao('Excluir sua avaliação? Essa ação não pode ser desfeita.', function () {
      fetch('/api/comentarios/' + id, { method: 'DELETE', headers: { 'X-CSRF-Token': csrf } })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) { mostrarMsg(data.message || 'Não foi possível excluir.', 'erro'); return; }
          if (form) {
            form.reset();
            limparSelecaoMidia();
            form.setAttribute('hidden', '');
            delete form.dataset.editadoPeloUsuario;
          }
          if (btnToggleForm) btnToggleForm.textContent = 'Avaliar';
          carregarComentarios();
        })
        .catch(function () { mostrarMsg('Erro de conexão. Tente novamente.', 'erro'); });
    }, { rotuloConfirmar: 'Excluir' });
  }

  if (btnExcluirReview) {
    btnExcluirReview.addEventListener('click', function () { excluirAvaliacao(minhaAvaliacaoId); });
  }

  function renderizarTopo(media, total) {
    if (!topoWrap) return;
    if (!total) {
      if (topoEstr) topoEstr.innerHTML = renderEstrelas(0);
      if (topoQtd)  topoQtd.textContent  = 'Sem avaliações ainda';
      topoWrap.setAttribute('aria-label', 'Produto ainda sem avaliações');
      return;
    }
    var nota = Math.round(media);
    if (topoEstr) topoEstr.innerHTML = renderEstrelas(nota);
    if (topoQtd)  topoQtd.textContent  = '(' + total + (total === 1 ? ' avaliação)' : ' avaliações)');
    topoWrap.setAttribute('aria-label', 'Avaliação: ' + Number(media).toFixed(1) + ' de 5 estrelas, ' + total + (total === 1 ? ' avaliação' : ' avaliações'));
  }

  /* Carregar comentários do servidor */
  function carregarComentarios() {
    fetch('/api/comentarios/' + encodeURIComponent(slug))
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) return;
        if (data.lojaNome) nomeLoja = data.lojaNome;
        todosComentarios = data.comentarios || [];
        var filtrada = filtroAtivo === 'todas'
          ? todosComentarios
          : todosComentarios.filter(function (c) { return Number(c.avaliacao) === Number(filtroAtivo); });
        renderizarLista(filtrada, filtroAtivo);
        renderizarResumo(data.media, data.total, data.comentarios);
        renderizarTopo(data.media, data.total);
        sincronizarMinhaAvaliacao(data.minhaAvaliacao);
      })
      .catch(function () {});
  }

  if (textarea) {
    textarea.addEventListener('input', function () {
      form.dataset.editadoPeloUsuario = '1';
    });
  }

  /* Enviar avaliação */
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      if (avaliacaoSelecionada === 0) {
        mostrarMsg('Selecione uma nota em estrelas antes de publicar.', 'erro');
        return;
      }
      var texto = textarea ? textarea.value.trim() : '';
      if (!texto) {
        mostrarMsg('O comentário não pode estar vazio.', 'erro');
        return;
      }
      if (novosVideos.some(function (v) { return v.gerando; })) {
        mostrarMsg('Aguarde a prévia dos vídeos terminar de ser gerada antes de publicar.', 'erro');
        return;
      }

      var fd = new FormData();
      fd.append('avaliacao', String(avaliacaoSelecionada));
      fd.append('comentario', texto);

      var removerIds = midiaExistente.filter(function (m) { return m.remover; }).map(function (m) { return m.id; });
      if (removerIds.length) fd.append('remover_midias', JSON.stringify(removerIds));

      novasImagens.forEach(function (f) { fd.append('imagens', f); });
      novosVideos.forEach(function (v) {
        fd.append('videos', v.file);
        fd.append('video_thumbs', v.thumbBlob, 'thumb.jpg');
      });

      if (btnEnviar) {
        btnEnviar.disabled = true;
        btnEnviar.textContent = 'Publicando…';
      }
      mostrarProgresso(0);

      var xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/comentarios/' + encodeURIComponent(slug));
      xhr.setRequestHeader('X-CSRF-Token', csrf);
      xhr.setRequestHeader('Accept', 'application/json');

      xhr.upload.addEventListener('progress', function (evt) {
        if (evt.lengthComputable) mostrarProgresso(Math.round((evt.loaded / evt.total) * 100));
      });

      xhr.onload = function () {
        esconderProgresso();
        var data = {};
        try { data = JSON.parse(xhr.responseText); } catch (_) {}

        if (xhr.status >= 200 && xhr.status < 300 && data.ok) {
          mostrarMsg(data.atualizado ? 'Avaliação atualizada com sucesso!' : 'Avaliação publicada com sucesso!', 'ok');
          limparSelecaoMidia();
          delete form.dataset.editadoPeloUsuario;
          form.setAttribute('hidden', '');
          if (btnToggleForm) btnToggleForm.textContent = 'Editar';
          carregarComentarios();
        } else {
          mostrarMsg((data && data.message) || 'Erro ao publicar avaliação.', 'erro');
        }
        if (btnEnviar) {
          btnEnviar.disabled = false;
          btnEnviar.textContent = minhaAvaliacaoId ? 'Atualizar avaliação' : 'Publicar avaliação';
        }
      };
      xhr.onerror = function () {
        esconderProgresso();
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        if (btnEnviar) {
          btnEnviar.disabled = false;
          btnEnviar.textContent = minhaAvaliacaoId ? 'Atualizar avaliação' : 'Publicar avaliação';
        }
      };

      xhr.send(fd);
    });
  }

  function mostrarMsg(txt, tipo) {
    if (!msgEl) return;
    msgEl.textContent = txt;
    msgEl.className   = tipo === 'ok' ? 'review-msg-ok' : 'review-msg-erro';
    clearTimeout(msgEl._timer);
    msgEl._timer = setTimeout(function () {
      msgEl.textContent = '';
      msgEl.className   = '';
    }, 4500);
  }

  /* Inicialização */
  carregarComentarios();
})();
