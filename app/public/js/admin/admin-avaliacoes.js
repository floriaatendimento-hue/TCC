(function () {
  'use strict';

  var main = document.querySelector('.admin-main');
  if (!main) return;

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }

  main.addEventListener('submit', function (e) {
    var form = e.target.closest('.js-form-resposta');
    if (!form) return;
    e.preventDefault();

    var id = form.dataset.id;
    var texto = form.querySelector('.js-resposta-texto').value.trim();
    var msg = form.querySelector('.js-resposta-msg');
    var btnEnviar = form.querySelector('button[type="submit"]');
    msg.textContent = ''; msg.className = 'form-admin__mensagem js-resposta-msg';

    if (!texto) {
      msg.textContent = 'Escreva uma resposta antes de enviar.';
      msg.className = 'form-admin__mensagem is-erro js-resposta-msg';
      return;
    }

    if (btnEnviar) { btnEnviar.disabled = true; btnEnviar.classList.add('is-carregando'); }
    fetch('/api/admin/avaliacoes/' + id + '/responder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify({ resposta: texto }),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          msg.textContent = data.message || 'Não foi possível salvar a resposta.';
          msg.className = 'form-admin__mensagem is-erro js-resposta-msg';
          if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.classList.remove('is-carregando'); }
          return;
        }
        window.location.reload();
      })
      .catch(function () {
        msg.textContent = 'Erro de conexão. Tente novamente.';
        msg.className = 'form-admin__mensagem is-erro js-resposta-msg';
        if (btnEnviar) { btnEnviar.disabled = false; btnEnviar.classList.remove('is-carregando'); }
      });
  });

  main.addEventListener('click', function (e) {
    var btnRemover = e.target.closest('.js-remover-resposta');
    if (btnRemover) {
      window.confirmarAdmin('Remover a resposta desta avaliação?', function () {
        fetch('/api/admin/avaliacoes/' + btnRemover.dataset.id + '/resposta', {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { alert(data.message || 'Não foi possível remover.'); return; }
            window.location.reload();
          })
          .catch(function () { alert('Erro de conexão. Tente novamente.'); });
      }, { rotuloConfirmar: 'Remover' });
      return;
    }

    var btnExcluir = e.target.closest('.js-excluir-avaliacao');
    if (btnExcluir) {
      window.confirmarAdmin('Excluir esta avaliação permanentemente? As fotos e vídeos anexados também serão apagados.', function () {
        fetch('/api/admin/avaliacoes/' + btnExcluir.dataset.id, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { alert(data.message || 'Não foi possível excluir.'); return; }
            btnExcluir.closest('article').remove();
          })
          .catch(function () { alert('Erro de conexão. Tente novamente.'); });
      });
      return;
    }

    var btnStatus = e.target.closest('.js-toggle-status');
    if (btnStatus) {
      var proximo = btnStatus.dataset.proximoStatus;
      fetch('/api/admin/avaliacoes/' + btnStatus.dataset.id + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ status: proximo }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) { alert(data.message || 'Não foi possível atualizar o status.'); return; }
          var artigo = btnStatus.closest('article');
          var badge  = artigo.querySelector('.js-status-badge');
          if (badge) {
            var reprovada = data.status === 'reprovado';
            badge.textContent = reprovada ? 'Reprovada' : 'Aprovada';
            badge.classList.toggle('badge--vermelho', reprovada);
            badge.classList.toggle('badge--verde', !reprovada);
          }
          btnStatus.textContent = data.status === 'reprovado' ? 'Aprovar' : 'Reprovar';
          btnStatus.dataset.proximoStatus = data.status === 'reprovado' ? 'aprovado' : 'reprovado';
        })
        .catch(function () { alert('Erro de conexão. Tente novamente.'); });
      return;
    }

    var btnOcultar = e.target.closest('.js-midia-ocultar');
    if (btnOcultar) {
      var ocultarAgora = btnOcultar.dataset.oculto !== '1';
      fetch('/api/admin/avaliacoes/midia/' + btnOcultar.dataset.id + '/ocultar', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ oculto: ocultarAgora }),
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) { alert(data.message || 'Não foi possível atualizar a mídia.'); return; }
          var item = btnOcultar.closest('.admin-midia-item');
          if (item) item.classList.toggle('is-oculta', data.oculto);
          btnOcultar.dataset.oculto = data.oculto ? '1' : '0';
          btnOcultar.textContent = data.oculto ? 'Reexibir' : 'Ocultar';
          var aviso = item ? item.querySelector('.admin-midia-oculta-aviso') : null;
          if (data.oculto && !aviso && item) {
            var span = document.createElement('b');
            span.className = 'admin-midia-oculta-aviso';
            span.textContent = 'Oculta';
            item.appendChild(span);
          } else if (!data.oculto && aviso) {
            aviso.remove();
          }
        })
        .catch(function () { alert('Erro de conexão. Tente novamente.'); });
      return;
    }

    var btnMidiaExcluir = e.target.closest('.js-midia-excluir');
    if (btnMidiaExcluir) {
      window.confirmarAdmin('Excluir esta mídia permanentemente?', function () {
        fetch('/api/admin/avaliacoes/midia/' + btnMidiaExcluir.dataset.id, {
          method: 'DELETE',
          headers: { 'X-CSRF-Token': csrfToken() },
        })
          .then(function (r) { return r.json(); })
          .then(function (data) {
            if (!data.ok) { alert(data.message || 'Não foi possível excluir a mídia.'); return; }
            var item = btnMidiaExcluir.closest('.admin-midia-item');
            if (item) item.remove();
          })
          .catch(function () { alert('Erro de conexão. Tente novamente.'); });
      });
    }
  });
})();
