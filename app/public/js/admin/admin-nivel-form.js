(function () {
  'use strict';

  var form = document.getElementById('form-nivel');
  if (!form) return;

  var modo = form.dataset.modo;
  var nivelId = form.dataset.id;

  var formMsg   = document.getElementById('form-nivel-msg');
  var btnSalvar = document.getElementById('btn-salvar-nivel');

  var campoNome       = document.getElementById('nivel-nome');
  var campoIcone      = document.getElementById('nivel-icone');
  var campoValor      = document.getElementById('nivel-valor');
  var campoDescricao  = document.getElementById('nivel-descricao');
  var campoBeneficios = document.getElementById('nivel-beneficios');
  var campoAtivo      = document.getElementById('nivel-ativo');

  var prIcone  = document.getElementById('pr-nivel-icone');
  var prNome   = document.getElementById('pr-nivel-nome');
  var prValor  = document.getElementById('pr-nivel-valor');
  var prStatus = document.getElementById('pr-nivel-status');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function fmtPreco(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }
  function mostrarMsg(t, tipo) {
    formMsg.textContent = t;
    formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso');
    formMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }

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

  /* Prévia em tempo real */
  function atualizarPreview() {
    if (prIcone) prIcone.innerHTML = '<i class="fas fa-' + (campoIcone.value || 'seedling') + '" aria-hidden="true"></i>';
    if (prNome) prNome.textContent = campoNome.value.trim() || 'Nome do nível';
    if (prValor) prValor.textContent = 'A partir de ' + fmtPreco(campoValor.value);
    if (prStatus) prStatus.textContent = campoAtivo.checked ? 'Ativo' : 'Inativo';
  }
  [campoNome, campoIcone, campoValor, campoAtivo].forEach(function (campo) {
    campo.addEventListener('input', atualizarPreview);
    campo.addEventListener('change', atualizarPreview);
  });
  atualizarPreview();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    var payload = {
      nome: campoNome.value.trim(),
      icone: campoIcone.value.trim(),
      valor_minimo: campoValor.value,
      descricao: campoDescricao.value.trim(),
      beneficios: campoBeneficios.value.trim(),
      ativo: campoAtivo.checked,
    };

    var url = modo === 'editar' ? '/api/admin/niveis/' + nivelId : '/api/admin/niveis';

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
          mostrarMsg(data.message || 'Não foi possível salvar o nível.', 'erro');
          btnSalvar.disabled = false;
          btnSalvar.classList.remove('is-carregando');
          return;
        }
        window.location.href = '/admin/niveis';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        btnSalvar.disabled = false;
        btnSalvar.classList.remove('is-carregando');
      });
  });
})();
