(function () {
  'use strict';

  var REGEX_DIACRITICOS = new RegExp(
    '[' + String.fromCharCode(0x0300) + '-' + String.fromCharCode(0x036f) + ']', 'g'
  );

  function slugify(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD').replace(REGEX_DIACRITICOS, '') /* remove acentos */
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function formatarPreco(valor) {
    return 'R$ ' + Number(valor).toFixed(2).replace('.', ',');
  }

  function chaveArmazenamento(fieldset) {
    var slug = slugify(location.pathname.replace(/^\/+/, '')) || 'produto';
    var tipo = fieldset && fieldset.dataset.tipo;
    if (!tipo || tipo === 'cor') return 'floriaCor:' + slug;
    return 'floriaVar:' + slug + ':' + tipo;
  }

  function identidadeBotao(btn) {
    return btn.dataset.cor || slugify(btn.title || btn.getAttribute('aria-label') || '');
  }

  function rotuloBotao(btn) {
    return btn.title || btn.getAttribute('aria-label') || btn.dataset.cor || '';
  }

  function initSeletorCores(fieldset) {
    var botoes = Array.prototype.slice.call(fieldset.querySelectorAll('.cor'));
    if (!botoes.length) return;

    var imgPrincipal = document.getElementById('imgPrincipal')
                     || document.querySelector('.imagem-principal img');
    var precoEl       = document.querySelector('.preco-novo');
    var precoOriginal = precoEl ? precoEl.textContent : null;
    var imagemOriginal = imgPrincipal ? imgPrincipal.getAttribute('src') : null;
    var chave = chaveArmazenamento(fieldset);

    botoes.forEach(function (btn) {
      if (btn.tagName === 'BUTTON' && !btn.getAttribute('type')) btn.type = 'button';

      var indisponivel = btn.dataset.disponivel === 'false' || btn.disabled;
      if (indisponivel) {
        btn.disabled = true;
        btn.classList.add('indisponivel');
        btn.classList.remove('selecionada');
        btn.setAttribute('aria-disabled', 'true');
        btn.setAttribute('aria-pressed', 'false');
        var rotulo = rotuloBotao(btn);
        var avisoTitle = rotulo + ': indisponível no momento';
        btn.title = avisoTitle;
        btn.setAttribute('aria-label', avisoTitle);
      }
    });

    var disponiveis = botoes.filter(function (b) { return !b.disabled; });
    if (!disponiveis.length) return;

    function selecionar(btn, opcoes) {
      opcoes = opcoes || {};

      botoes.forEach(function (b) {
        b.classList.remove('selecionada');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('selecionada');
      btn.setAttribute('aria-pressed', 'true');

      if (imgPrincipal) {
        var novaImagem = btn.dataset.imagem || imagemOriginal;
        if (novaImagem && imgPrincipal.getAttribute('src') !== novaImagem) {
          imgPrincipal.style.opacity = '0';
          setTimeout(function () {
            imgPrincipal.setAttribute('src', novaImagem);
            imgPrincipal.style.opacity = '1';
          }, 120);
        }
        var miniaturas = document.querySelectorAll('.miniaturas img');
        if (miniaturas.length) {
          var correspondente = null;
          miniaturas.forEach(function (m) {
            m.classList.remove('ativa');
            if (btn.dataset.imagem && m.getAttribute('src') === btn.dataset.imagem) correspondente = m;
          });
          if (correspondente) correspondente.classList.add('ativa');
          else if (!btn.dataset.imagem && miniaturas[0]) miniaturas[0].classList.add('ativa');
        }
      }

      if (precoEl) {
        precoEl.textContent = btn.dataset.preco
          ? formatarPreco(btn.dataset.preco)
          : precoOriginal;
      }

      fieldset.dataset.corSelecionada = rotuloBotao(btn);
      fieldset.dataset.corSelecionadaId = identidadeBotao(btn);

      if (opcoes.persistir !== false) {
        try { localStorage.setItem(chave, identidadeBotao(btn)); } catch (e) { /* localStorage indisponível */ }
      }
    }

    disponiveis.forEach(function (btn) {
      btn.addEventListener('click', function () { selecionar(btn); });
    });

    var salvo = null;
    try { salvo = localStorage.getItem(chave); } catch (e) { /* ignorar */ }

    var alvo = null;
    if (salvo) {
      alvo = disponiveis.filter(function (b) { return identidadeBotao(b) === salvo; })[0] || null;
    }
    if (!alvo && disponiveis.length === 1) {
      alvo = disponiveis[0];
    }
    if (!alvo) {
      alvo = disponiveis.filter(function (b) { return b.classList.contains('selecionada'); })[0]
          || disponiveis[0];
    }

    selecionar(alvo, { persistir: !!salvo || disponiveis.length === 1 });
  }

  function iniciar() {
    document.querySelectorAll('fieldset.cores').forEach(initSeletorCores);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }
})();
