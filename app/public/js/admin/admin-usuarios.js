(function () {
  'use strict';

  var tbody = document.getElementById('admins-tbody');
  if (!tbody) return;

  var btnPromover = document.getElementById('btn-promover-admin');
  var dialog = document.getElementById('dialog-promover');
  var btnFechar = document.getElementById('dialog-promover-fechar');
  var busca = document.getElementById('promover-busca');
  var msg = document.getElementById('promover-msg');
  var resultados = document.getElementById('promover-resultados');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  btnPromover.addEventListener('click', function () {
    busca.value = '';
    resultados.innerHTML = '';
    msg.textContent = ''; msg.className = 'form-admin__mensagem';
    dialog.showModal();
    busca.focus();
  });
  btnFechar.addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('cancel', function (e) { e.preventDefault(); dialog.close(); });
  dialog.addEventListener('click', function (e) {
    var rect = dialog.getBoundingClientRect();
    var dentro = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (!dentro) dialog.close();
  });

  var timerBusca = null;
  busca.addEventListener('input', function () {
    clearTimeout(timerBusca);
    var termo = busca.value.trim();
    if (termo.length < 2) { resultados.innerHTML = ''; return; }
    timerBusca = setTimeout(function () {
      fetch('/api/admin/usuarios/buscar-clientes?q=' + encodeURIComponent(termo))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var lista = (data && data.ok && data.data) || [];
          if (!lista.length) {
            resultados.innerHTML = '<li class="lista-ranking--vazia">Nenhum cliente encontrado.</li>';
            return;
          }
          resultados.innerHTML = lista.map(function (c) {
            var nome = escHtml(c.nome);
            var email = escHtml(c.email);
            return '<li>' +
              '<b class="lista-ranking__nome">' + nome + '<br><small class="texto-fraco">' + email + '</small></b>' +
              '<button type="button" class="btn-admin btn-admin--primario btn-admin--pequeno js-confirmar-promover" data-id="' + Number(c.id) + '" data-nome="' + nome + '">Promover</button>' +
              '</li>';
          }).join('');
        })
        .catch(function () { resultados.innerHTML = '<li class="lista-ranking--vazia">Erro ao buscar. Tente novamente.</li>'; });
    }, 300);
  });

  resultados.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-confirmar-promover');
    if (!btn) return;
    window.confirmarAdmin('Promover "' + btn.dataset.nome + '" a administrador? Essa pessoa passará a ter acesso total ao painel.', function () {
      btn.disabled = true;
      btn.classList.add('is-carregando');
      fetch('/api/admin/usuarios/' + btn.dataset.id + '/promover', {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrfToken() },
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) {
            msg.textContent = data.message || 'Não foi possível promover.'; msg.className = 'form-admin__mensagem is-erro';
            btn.disabled = false; btn.classList.remove('is-carregando');
            return;
          }
          window.location.reload();
        })
        .catch(function () {
          msg.textContent = 'Erro de conexão. Tente novamente.'; msg.className = 'form-admin__mensagem is-erro';
          btn.disabled = false; btn.classList.remove('is-carregando');
        });
    }, { rotuloConfirmar: 'Promover', perigo: false });
  });

  tbody.addEventListener('click', function (e) {
    var btn = e.target.closest('.js-rebaixar');
    if (!btn) return;
    window.confirmarAdmin('Remover o acesso administrativo de "' + btn.dataset.nome + '"? A pessoa volta a ser uma cliente comum.', function () {
      fetch('/api/admin/usuarios/' + btn.dataset.id + '/rebaixar', {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrfToken() },
      })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (!data.ok) { alert(data.message || 'Não foi possível remover o acesso.'); return; }
          window.location.reload();
        })
        .catch(function () { alert('Erro de conexão. Tente novamente.'); });
    }, { rotuloConfirmar: 'Remover acesso' });
  });
})();
