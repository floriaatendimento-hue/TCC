(function () {
  'use strict';

  var dialog = document.getElementById('dialog-logout');
  if (!dialog) return;

  var btnCancelar  = dialog.querySelector('[data-logout-cancelar]');
  var btnConfirmar = dialog.querySelector('[data-logout-confirmar]');

  function fecharMenuDoTrigger(trigger) {
    var details = trigger.closest('details[open]');
    if (details) details.removeAttribute('open');

    var contaMenu = document.getElementById('conta-menu');
    var contaTrigger = document.getElementById('conta-trigger');
    if (contaMenu && !contaMenu.hidden) {
      contaMenu.classList.remove('aberto');
      contaMenu.hidden = true;
      if (contaTrigger) contaTrigger.setAttribute('aria-expanded', 'false');
    }
  }

  document.querySelectorAll('[data-logout-trigger]').forEach(function (trigger) {
    trigger.addEventListener('click', function (e) {
      e.preventDefault();
      fecharMenuDoTrigger(trigger);
      dialog.showModal();
    });
  });

  btnCancelar?.addEventListener('click', function () {
    dialog.close();
  });

  dialog.addEventListener('click', function (e) {
    if (e.target === dialog) dialog.close();
  });

  btnConfirmar?.addEventListener('click', function () {
    btnConfirmar.disabled = true;
    var token = document.getElementById('csrf-token')?.value || '';
    fetch('/api/logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ _csrf: token }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) { window.location.href = data.redirect || '/'; })
      .catch(function () { window.location.href = '/logout'; });
  });
})();
