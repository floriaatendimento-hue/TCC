(function () {
  'use strict';

  var form = document.getElementById('form-categoria');
  if (!form) return;

  var modo = form.dataset.modo;
  var categoriaId = form.dataset.id;

  var formMsg   = document.getElementById('form-categoria-msg');
  var btnSalvar = document.getElementById('btn-salvar-categoria');

  var campoNome      = document.getElementById('cat-nome');
  var campoSlug      = document.getElementById('cat-slug');
  var campoDescricao = document.getElementById('cat-descricao');
  var campoAtiva     = document.getElementById('cat-ativa');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function mostrarMsg(t, tipo) {
    formMsg.textContent = t;
    formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso');
    formMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }

  function slugificar(texto) {
    return String(texto || '')
      .toLowerCase()
      .normalize('NFD').replace(/[^\x00-\x7F]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  var formAcoes = document.querySelector('.form-pagina-acoes');
  if (formAcoes) {
    var atualizarAlturaAcoes = function () {
      document.documentElement.style.setProperty('--form-pagina-acoes-h', formAcoes.offsetHeight + 'px');
    };
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(atualizarAlturaAcoes).observe(formAcoes);
    } else {
      window.addEventListener('resize', atualizarAlturaAcoes);
    }
    atualizarAlturaAcoes();
  }

  var slugEditadoManualmente = modo === 'editar';
  campoSlug.addEventListener('input', function () { slugEditadoManualmente = true; });
  campoNome.addEventListener('input', function () {
    if (!slugEditadoManualmente) campoSlug.value = slugificar(campoNome.value);
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    var payload = {
      nome: campoNome.value.trim(),
      slug: slugificar(campoSlug.value),
      descricao: campoDescricao.value.trim(),
      ativa: campoAtiva.checked,
    };

    var url = modo === 'editar' ? '/api/admin/categorias/' + categoriaId : '/api/admin/categorias';

    btnSalvar.disabled = true;
    btnSalvar.classList.add('is-carregando');

    fetch(url, {
      method: modo === 'editar' ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          mostrarMsg(data.message || 'Não foi possível salvar a categoria.', 'erro');
          btnSalvar.disabled = false;
          btnSalvar.classList.remove('is-carregando');
          return;
        }
        window.location.href = '/admin/categorias';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        btnSalvar.disabled = false;
        btnSalvar.classList.remove('is-carregando');
      });
  });
})();
