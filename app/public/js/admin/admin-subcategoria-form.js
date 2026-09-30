(function () {
  'use strict';

  var form = document.getElementById('form-subcategoria');
  if (!form) return;

  var modo = form.dataset.modo;
  var subcategoriaId = form.dataset.id;

  var formMsg   = document.getElementById('form-subcategoria-msg');
  var btnSalvar = document.getElementById('btn-salvar-subcategoria');

  var campoCategoria = document.getElementById('sub-categoria');
  var campoNome      = document.getElementById('sub-nome');
  var campoSlug      = document.getElementById('sub-slug');
  var campoDescricao = document.getElementById('sub-descricao');
  var campoAtiva     = document.getElementById('sub-ativa');

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
      categoria_id: Number(campoCategoria.value),
      nome: campoNome.value.trim(),
      slug: slugificar(campoSlug.value),
      descricao: campoDescricao.value.trim(),
      ativa: campoAtiva.checked,
    };

    var url = modo === 'editar' ? '/api/admin/subcategorias/' + subcategoriaId : '/api/admin/subcategorias';

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
          mostrarMsg(data.message || 'Nao foi possivel salvar a subcategoria.', 'erro');
          btnSalvar.disabled = false;
          btnSalvar.classList.remove('is-carregando');
          return;
        }
        window.location.href = '/admin/categorias';
      })
      .catch(function () {
        mostrarMsg('Erro de conexao. Tente novamente.', 'erro');
        btnSalvar.disabled = false;
        btnSalvar.classList.remove('is-carregando');
      });
  });
})();
