(function () {
  'use strict';

  var CHAVE_LOCAL = 'floria_a11y_prefs';

  var PADRAO = Object.freeze({
    tamanho_fonte: 'normal',
    espacamento_texto: 'normal',
    alto_contraste: false,
    reduzir_movimento: false,
    destacar_links: false,
    destacar_foco: false,
    interface_simplificada: false,
    otimizar_leitor_tela: false,
    libras_ativo: false,
    pausar_midia_automatica: false,
  });

  var CAMPOS = Object.keys(PADRAO);

  function normalizar(obj) {
    var limpo = {};
    CAMPOS.forEach(function (campo) {
      limpo[campo] = (obj && obj[campo] !== undefined) ? obj[campo] : PADRAO[campo];
    });
    return limpo;
  }

  function iguais(a, b) {
    return JSON.stringify(normalizar(a)) === JSON.stringify(normalizar(b));
  }

  function lerLocal() {
    try {
      var bruto = localStorage.getItem(CHAVE_LOCAL);
      return bruto ? normalizar(JSON.parse(bruto)) : normalizar(PADRAO);
    } catch (e) {
      return normalizar(PADRAO);
    }
  }

  function salvarLocal(prefs) {
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(normalizar(prefs))); } catch (e) {   }
  }

  function csrfToken() {
    return document.getElementById('csrf-token')?.value || '';
  }

  var atual = lerLocal();

  function setAttr(el, nome, valor) {
    if (valor === null || valor === undefined || valor === false) el.removeAttribute(nome);
    else el.setAttribute(nome, String(valor));
  }

  function aplicar(prefs, opcoes) {
    atual = normalizar(prefs);
    var h = document.documentElement;

    setAttr(h, 'data-a11y-fonte', atual.tamanho_fonte !== 'normal' ? atual.tamanho_fonte : null);
    setAttr(h, 'data-a11y-espacamento', atual.espacamento_texto !== 'normal' ? atual.espacamento_texto : null);
    setAttr(h, 'data-a11y-contraste', atual.alto_contraste ? '1' : null);
    setAttr(h, 'data-a11y-movimento', atual.reduzir_movimento ? '1' : null);
    setAttr(h, 'data-a11y-links', atual.destacar_links ? '1' : null);
    setAttr(h, 'data-a11y-foco', atual.destacar_foco ? '1' : null);
    setAttr(h, 'data-a11y-simples', atual.interface_simplificada ? '1' : null);
    setAttr(h, 'data-a11y-leitor', atual.otimizar_leitor_tela ? '1' : null);
    setAttr(h, 'data-a11y-libras', atual.libras_ativo ? '1' : null);

    if (atual.libras_ativo) carregarVLibras();
    if (atual.pausar_midia_automatica) pausarMidiaAutomatica();

    if (!opcoes || opcoes.persistirLocal !== false) salvarLocal(atual);

    document.dispatchEvent(new CustomEvent('floria:a11y-aplicado', { detail: atual }));
  }

  var vlibrasCarregando = false;

  function carregarVLibras() {
    if (window.__vlibrasPronto || vlibrasCarregando) return;
    vlibrasCarregando = true;
    var script = document.createElement('script');
    script.src = 'https://vlibras.gov.br/app/vlibras-plugin.js';
    script.onload = function () {
      try {
        if (window.VLibras && !window.__vlibrasPronto) {
          new window.VLibras.Widget({ rootPath: 'https://vlibras.gov.br/app' });
          window.__vlibrasPronto = true;
        }
      } catch (e) {   }
      vlibrasCarregando = false;
    };
    script.onerror = function () { vlibrasCarregando = false; };
    document.body.appendChild(script);
  }

  function pausarUmElemento(el) {
    if (!el.hasAttribute('autoplay') && el.paused === false) return;
    try { el.pause(); } catch (e) {}
    el.removeAttribute('autoplay');
  }

  function pausarMidiaAutomatica() {
    document.querySelectorAll('video[autoplay], audio[autoplay]').forEach(pausarUmElemento);
  }

  var observadorMidia = new MutationObserver(function (mutacoes) {
    if (!atual.pausar_midia_automatica) return;
    mutacoes.forEach(function (m) {
      m.addedNodes && m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.matches && node.matches('video[autoplay], audio[autoplay]')) pausarUmElemento(node);
        node.querySelectorAll && node.querySelectorAll('video[autoplay], audio[autoplay]').forEach(pausarUmElemento);
      });
    });
  });
  observadorMidia.observe(document.documentElement, { childList: true, subtree: true });

  function configurarSkipLink() {
    var link = document.querySelector('a.skip-link');
    if (!link) return;

    if (document.body.firstElementChild !== link) {
      document.body.insertBefore(link, document.body.firstChild);
    }

    var principal = document.querySelector('main');
    if (!principal) return;
    if (!principal.id) principal.id = 'conteudo-principal';
    link.setAttribute('href', '#' + principal.id);
    if (!principal.hasAttribute('tabindex')) principal.setAttribute('tabindex', '-1');
  }
  configurarSkipLink();

  /* Sincronização com a conta */
  function salvarNoServidor(prefs) {
    return fetch('/api/acessibilidade', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(normalizar(prefs)),
    }).then(function (r) { return r.json(); });
  }

  function sincronizarComServidor() {
    if (!window.__logado) return;
    fetch('/api/acessibilidade', { headers: { Accept: 'application/json' } })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !data.ok || !data.data) return;
        var doServidor = normalizar(data.data);
        var localCustomizado = !iguais(atual, PADRAO);
        var servidorNoPadrao = iguais(doServidor, PADRAO);

        if (servidorNoPadrao && localCustomizado) {
          aplicar(atual);
          salvarNoServidor(atual).catch(function () {});
        } else {
          aplicar(doServidor);
        }
      })
      .catch(function () {   });
  }

  window.FloriaA11y = {
    PADRAO: normalizar(PADRAO),

    obter: function () { return normalizar(atual); },

    definir: function (campo, valor) {
      if (!CAMPOS.includes(campo)) return Promise.reject(new Error('Campo de acessibilidade inválido.'));
      var proximo = normalizar(atual);
      proximo[campo] = valor;
      aplicar(proximo);

      if (!window.__logado) return Promise.resolve(normalizar(atual));

      return fetch('/api/acessibilidade/' + encodeURIComponent(campo), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ valor: valor }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.ok && data.data) aplicar(data.data);
          return normalizar(atual);
        });
    },

    restaurar: function () {
      aplicar(PADRAO);
      if (!window.__logado) return Promise.resolve(normalizar(atual));
      return fetch('/api/acessibilidade/restaurar', {
        method: 'POST',
        headers: { 'X-CSRF-Token': csrfToken() },
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.ok && data.data) aplicar(data.data);
          return normalizar(atual);
        });
    },
  };

  aplicar(atual, { persistirLocal: false });
  sincronizarComServidor();
})();
