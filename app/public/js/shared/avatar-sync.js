(function () {
  'use strict';

  var CHAVE_STORAGE = 'floria_foto_perfil_atualizada';

  function aplicarUrl(url) {
    document.querySelectorAll('img[data-avatar-usuario]').forEach(function (img) {
      img.src = url;
    });

    document.querySelectorAll('[data-avatar-usuario-fallback]').forEach(function (el) {
      var img = document.createElement('img');
      img.className = 'avatar-usuario';
      img.alt = '';
      img.setAttribute('data-avatar-usuario', '');
      img.src = url;
      el.replaceWith(img);
    });
  }

  window.FloriaAvatar = {
    atualizar: function (url) {
      aplicarUrl(url);
      try {
        localStorage.setItem(CHAVE_STORAGE, JSON.stringify({ url: url, t: Date.now() }));
      } catch (_) {   }
    },
  };

  window.addEventListener('storage', function (e) {
    if (e.key !== CHAVE_STORAGE || !e.newValue) return;
    try {
      var dado = JSON.parse(e.newValue);
      if (dado && dado.url) aplicarUrl(dado.url);
    } catch (_) { /* valor inesperado no storage — ignora */ }
  });
})();
