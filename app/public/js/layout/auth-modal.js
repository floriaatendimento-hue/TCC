(function () {
  /* CSS injetado */
  var style = document.createElement('style');
  style.textContent = [
    '.floria-auth-overlay{',
      'position:fixed;inset:0;z-index:99999;',
      'background:rgba(10,30,18,0.68);',
      'display:flex;align-items:center;justify-content:center;',
      'padding:1.5rem;',
      'opacity:0;transition:opacity 0.26s ease;',
      'pointer-events:none;',
    '}',
    '.floria-auth-overlay.show{opacity:1;pointer-events:all;}',

    '.floria-auth-modal{',
      'background:#fff;',
      'border-radius:22px;',
      'padding:2.8rem 2.4rem 2.4rem;',
      'max-width:430px;width:100%;',
      'position:relative;',
      'box-shadow:0 28px 70px rgba(10,30,18,0.24);',
      'text-align:center;',
      'border-top:4px solid #b8945f;',
      'transform:translateY(22px);transition:transform 0.26s ease;',
    '}',
    '.floria-auth-overlay.show .floria-auth-modal{transform:translateY(0);}',

    '.floria-auth-close{',
      'position:absolute;top:0.6rem;right:0.7rem;',
      'width:32px;height:32px;',
      'display:flex;align-items:center;justify-content:center;',
      'background:none;border:none;cursor:pointer;',
      'font-size:1.5rem;color:#aaa;line-height:1;',
      'transition:color 0.15s;padding:0;',
    '}',
    '.floria-auth-close:hover{color:#0E3124;}',

    '.floria-auth-icon{',
      'width:70px;height:70px;margin:0 auto 1.5rem;',
      'background:#f0ebe3;border-radius:50%;',
      'display:flex;align-items:center;justify-content:center;',
    '}',

    '.floria-auth-modal h2{',
      'font-family:"Fraunces",Georgia,serif;',
      'font-size:1.8rem;font-weight:700;',
      'color:#0E3124;margin:0 0 0.8rem;line-height:1.2;',
    '}',

    '.floria-auth-modal p{',
      'font-family:"DM Sans",Arial,sans-serif;',
      'color:#666;font-size:0.95rem;line-height:1.65;',
      'margin:0 0 1.9rem;',
    '}',

    '.floria-auth-actions{',
      'display:flex;gap:0.75rem;flex-wrap:wrap;',
      'justify-content:center;align-items:center;',
    '}',

    '.floria-auth-btn-login{',
      'background:#0E3124;color:#fff;',
      'border:2px solid #0E3124;',
      'padding:0.72rem 1.8rem;border-radius:10px;',
      'font-family:"Lato",Arial,sans-serif;font-size:0.95rem;font-weight:700;',
      'cursor:pointer;text-decoration:none;display:inline-block;',
      'transition:background 0.18s,border-color 0.18s;',
    '}',
    '.floria-auth-btn-login:hover{background:#245c3f;border-color:#245c3f;color:#fff;}',

    '.floria-auth-btn-cadastro{',
      'background:transparent;color:#0E3124;',
      'border:2px solid #0E3124;',
      'padding:0.72rem 1.8rem;border-radius:10px;',
      'font-family:"Lato",Arial,sans-serif;font-size:0.95rem;font-weight:700;',
      'cursor:pointer;text-decoration:none;display:inline-block;',
      'transition:background 0.18s,color 0.18s;',
    '}',
    '.floria-auth-btn-cadastro:hover{background:#0E3124;color:#fff;}',

    '.floria-auth-ou{',
      'font-family:"Lato",Arial,sans-serif;',
      'font-size:0.82rem;color:#bbb;',
    '}',
  ].join('');
  (document.head || document.body).appendChild(style);

  /* Estrutura HTML do modal */
  var overlay = document.createElement('section');
  overlay.className = 'floria-auth-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'floria-auth-titulo');
  overlay.setAttribute('inert', '');

  var svgIcon = [
    '<svg width="36" height="36" viewBox="0 0 24 24" fill="none"',
    ' stroke="#0E3124" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"',
    ' aria-hidden="true">',
    '<circle cx="10" cy="7" r="4"/>',
    '<path d="M10.3 15H7a4 4 0 0 0-4 4v2"/>',
    '<rect x="13" y="16" width="8" height="5" rx="1"/>',
    '<path d="M15 16v-1.5a2 2 0 0 1 4 0V16"/>',
    '</svg>',
  ].join('');

  overlay.innerHTML =
    '<section class="floria-auth-modal">' +
      '<button class="floria-auth-close" aria-label="Fechar">&times;</button>' +
      '<i class="floria-auth-icon" aria-hidden="true">' + svgIcon + '</i>' +
      '<h2 id="floria-auth-titulo">Acesso necessário</h2>' +
      '<p>' +
        'Para finalizar sua compra,' +
        ' você precisa estar logado na sua conta Floria.' +
      '</p>' +
      '<section class="floria-auth-actions">' +
        '<a href="/login" class="floria-auth-btn-login">Fazer Login</a>' +
        '<b class="floria-auth-ou">ou</b>' +
        '<a href="/cadastro" class="floria-auth-btn-cadastro">Criar Conta</a>' +
      '</section>' +
    '</section>';

  var linkLogin    = overlay.querySelector('.floria-auth-btn-login');
  var linkCadastro = overlay.querySelector('.floria-auth-btn-cadastro');

  /* Eventos de fechamento */
  function fechar() {
    overlay.classList.remove('show');
    overlay.setAttribute('inert', '');
  }

  overlay.querySelector('.floria-auth-close').addEventListener('click', fechar);
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) fechar();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && overlay.classList.contains('show')) fechar();
  });

  document.body.appendChild(overlay);

  /* API pública */
  var paragrafo = overlay.querySelector('.floria-auth-modal p');
  var MENSAGEM_PADRAO = paragrafo.innerHTML;

  window.showAuthModal = function (mensagem, redirectPara) {
    paragrafo.innerHTML = mensagem || MENSAGEM_PADRAO;

    var sufixo = redirectPara ? '?next=' + encodeURIComponent(redirectPara) : '';
    linkLogin.href    = '/login' + sufixo;
    linkCadastro.href = '/cadastro' + sufixo;

    overlay.removeAttribute('inert');
    overlay.classList.add('show');
  };
})();
