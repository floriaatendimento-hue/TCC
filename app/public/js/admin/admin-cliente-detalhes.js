(function () {
  'use strict';

  var secao = document.querySelector('.cliente-detalhes');
  if (!secao) return;
  var clienteId = secao.dataset.clienteId;

  function csrfToken() {
    var el = document.getElementById('csrf-token');
    return el ? el.value : '';
  }

  // Ativar / bloquear conta
  var toggleAtivo = document.getElementById('toggle-ativo-cliente');
  if (toggleAtivo) {
    toggleAtivo.addEventListener('change', function () {
      fetch('/api/admin/clientes/' + clienteId + '/ativo', {
        method: 'PATCH',
        headers: { 'X-CSRF-Token': csrfToken() },
      })
        .then(function (r) { if (!r.ok) throw new Error(); })
        .catch(function () {
          alert('Não foi possível alternar o status agora.');
          toggleAtivo.checked = !toggleAtivo.checked;
        });
    });
  }

  // Observações internas
  var form = document.getElementById('form-nota-interna');
  var lista = document.getElementById('cliente-notas-lista');
  var vazio = document.getElementById('cliente-notas-vazio');
  var msg = document.getElementById('nota-interna-msg');
  var textarea = form ? form.querySelector('textarea[name="nota"]') : null;

  function montarItemNota(nota) {
    var li = document.createElement('li');
    li.className = 'cliente-nota-card';

    var header = document.createElement('header');
    var strong = document.createElement('strong');
    strong.textContent = nota.admin_nome || 'Administrador';
    var time = document.createElement('time');
    var data = new Date(nota.criado_em);
    time.dateTime = data.toISOString();
    time.textContent = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(data);
    header.appendChild(strong);
    header.appendChild(time);

    var p = document.createElement('p');
    p.textContent = nota.nota;

    li.appendChild(header);
    li.appendChild(p);
    return li;
  }

  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var texto = textarea.value.trim();
      if (!texto) return;

      var botao = form.querySelector('button[type="submit"]');
      botao.disabled = true;
      botao.classList.add('is-carregando');
      msg.textContent = '';
      msg.classList.remove('is-erro', 'is-sucesso');

      fetch('/api/admin/clientes/' + clienteId + '/notas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
        body: JSON.stringify({ nota: texto }),
      })
        .then(function (r) { return r.json().then(function (data) { return { ok: r.ok, data: data }; }); })
        .then(function (resultado) {
          if (!resultado.ok || !resultado.data.ok) {
            throw new Error((resultado.data && resultado.data.message) || 'Erro ao salvar observação.');
          }
          if (vazio) { vazio.remove(); vazio = null; }
          lista.insertBefore(montarItemNota(resultado.data.data), lista.firstChild);
          textarea.value = '';
          msg.textContent = 'Observação adicionada.';
          msg.classList.add('is-sucesso');
        })
        .catch(function (err) {
          msg.textContent = err.message || 'Erro ao salvar observação.';
          msg.classList.add('is-erro');
        })
        .finally(function () {
          botao.disabled = false;
          botao.classList.remove('is-carregando');
        });
    });
  }

  var cpfValorEl = document.getElementById('cliente-cpf-valor');
  var cpfToggleEl = document.getElementById('cliente-cpf-toggle');
  if (cpfValorEl && cpfToggleEl) {
    cpfToggleEl.addEventListener('click', function () {
      var revelado = cpfToggleEl.getAttribute('aria-pressed') === 'true';
      cpfValorEl.textContent = revelado ? cpfValorEl.dataset.mascarado : cpfValorEl.dataset.cheio;
      cpfToggleEl.setAttribute('aria-pressed', String(!revelado));
      cpfToggleEl.setAttribute('aria-label', revelado ? 'Mostrar CPF completo' : 'Ocultar CPF');
      var icone = cpfToggleEl.querySelector('i');
      if (icone) icone.className = revelado ? 'far fa-eye' : 'far fa-eye-slash';
    });
  }
})();
