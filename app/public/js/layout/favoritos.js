(function () {
  'use strict';

  var favoritados = new Set();
  var carregado = false;

  function csrfToken() {
    var el = document.getElementById('csrf-token');
    return el ? el.value : '';
  }

  function pintar(btn, ativo) {
    btn.classList.toggle('ativo', ativo);
    btn.setAttribute('aria-pressed', ativo ? 'true' : 'false');
    var icone = btn.querySelector('i');
    if (icone) {
      icone.classList.toggle('fas', ativo);
      icone.classList.toggle('far', !ativo);
    }
  }

  function pintarTodos() {
    document.querySelectorAll('.btn-favorito[data-slug]').forEach(function (btn) {
      pintar(btn, favoritados.has(btn.dataset.slug));
    });
  }

  function carregarFavoritos() {
    if (!window.__logado) { carregado = true; pintarTodos(); return; }
    fetch('/api/favoritos/slugs')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.ok) favoritados = new Set(data.slugs || []);
        carregado = true;
        pintarTodos();
      })
      .catch(function () { carregado = true; });
  }

  function alternar(btn) {
    if (!window.__logado) {
      if (typeof window.showAuthModal === 'function') {
        window.showAuthModal('Para favoritar produtos, você precisa estar logado na sua conta Floria.');
      } else {
        window.location.href = '/login';
      }
      return;
    }

    var slug = btn.dataset.slug;
    if (!slug) return;
    var jaFavoritado = favoritados.has(slug);

    if (jaFavoritado) {
      favoritados.delete(slug);
    } else {
      favoritados.add(slug);
    }
    document.querySelectorAll('.btn-favorito[data-slug="' + CSS.escape(slug) + '"]')
      .forEach(function (b) { pintar(b, !jaFavoritado); });

    var requisicao = jaFavoritado
      ? fetch('/api/favoritos/' + encodeURIComponent(slug), {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken() },
        })
      : fetch('/api/favoritos/' + encodeURIComponent(slug), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfToken(),
          },
          body: JSON.stringify({
            nome:   btn.dataset.nome   || slug,
            imagem: btn.dataset.imagem || '',
            preco:  btn.dataset.preco  || '',
          }),
        });

    requisicao
      .then(function (r) {
        if (r.status === 401 || r.status === 403) throw new Error('sessao');
        if (!r.ok) throw new Error('falha');
        return r.json();
      })
      .then(function (data) {
        if (!data.ok) throw new Error(data.message || 'falha');
        var card = btn.closest('.favorito-card');
        if (card && jaFavoritado === true) card.remove();
      })
      .catch(function (err) {
        /* reverte em caso de erro */
        if (jaFavoritado) favoritados.add(slug); else favoritados.delete(slug);
        document.querySelectorAll('.btn-favorito[data-slug="' + CSS.escape(slug) + '"]')
          .forEach(function (b) { pintar(b, jaFavoritado); });

        if (err && err.message === 'sessao' && typeof window.showAuthModal === 'function') {
          window.showAuthModal('Sua sessão expirou. Faça login novamente para favoritar produtos.');
        }
      });
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.btn-favorito[data-slug]');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    alternar(btn);
  });

  var observer = new MutationObserver(function () {
    if (carregado) pintarTodos();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', carregarFavoritos);
  } else {
    carregarFavoritos();
  }
})();
