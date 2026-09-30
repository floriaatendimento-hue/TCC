(function () {
  'use strict';

  var form = document.getElementById('form-promocao');
  if (!form) return;

  var modoEdicao = form.dataset.modo === 'editar';
  var promocaoId = form.dataset.id;

  var fNome     = document.getElementById('f-nome');
  var radiosTipo = Array.prototype.slice.call(document.querySelectorAll('input[name="f-tipo"]'));

  var campoCategoria    = document.getElementById('f-campo-categoria');
  var fCategoria        = document.getElementById('f-categoria');
  var campoSubcategoria = document.getElementById('f-campo-subcategoria');
  var fSubcategoria     = document.getElementById('f-subcategoria');
  var campoProdutos     = document.getElementById('f-campo-produtos');
  var fProdutosBusca    = document.getElementById('f-produtos-busca');
  var listaProdutos     = document.getElementById('f-produtos-lista');
  var contagemProdutos  = document.getElementById('f-produtos-contagem');
  var campoValorMinimo  = document.getElementById('f-campo-valor-minimo');
  var rotuloValorMinimo = document.getElementById('f-rotulo-valor-minimo');
  var fValorMinimo      = document.getElementById('f-valor-minimo');
  var avisoTodos        = document.getElementById('f-aviso-todos');

  var fDesconto        = document.getElementById('f-desconto');
  var descontoPreview  = document.getElementById('f-desconto-preview');

  var fDataInicio  = document.getElementById('f-data-inicio');
  var campoDataFim = document.getElementById('f-campo-data-fim');
  var fDataFim     = document.getElementById('f-data-fim');
  var fSemDataFim  = document.getElementById('f-sem-data-fim');
  var fAtivo       = document.getElementById('f-ativo');

  var formMsg   = document.getElementById('form-promocao-msg');
  var btnVoltar = document.getElementById('btn-voltar');
  var btnAvancar= document.getElementById('btn-avancar');
  var btnSalvar = document.getElementById('btn-salvar');

  var ROTULOS_TIPO = {
    categoria: 'Categoria', subcategoria: 'Subcategoria', produto: 'Produto específico',
    valor_minimo_produto: 'Valor mínimo do produto', valor_minimo_carrinho: 'Valor mínimo do carrinho',
    todos: 'Todos os produtos',
  };

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }
  function fmtMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function fmtDataBR(iso) { return iso ? new Intl.DateTimeFormat('pt-BR').format(new Date(iso + 'T00:00:00')) : ''; }
  function tipoSelecionado() {
    var marcado = radiosTipo.filter(function (r) { return r.checked; })[0];
    return marcado ? marcado.value : 'categoria';
  }

  /* Categoria → subcategoria */
  var subcategoriasPorCategoria = {};
  function carregarSubcategorias(categoriaId, selecionarId) {
    if (!categoriaId) {
      fSubcategoria.innerHTML = '<option value="">Selecione a categoria primeiro...</option>';
      return Promise.resolve([]);
    }
    var promessa = subcategoriasPorCategoria[categoriaId]
      ? Promise.resolve(subcategoriasPorCategoria[categoriaId])
      : fetch('/api/admin/subcategorias?categoria_id=' + categoriaId)
          .then(function (r) { return r.json(); })
          .then(function (data) { return data.ok ? data.data : []; })
          .catch(function () { return []; });

    return promessa.then(function (lista) {
      subcategoriasPorCategoria[categoriaId] = lista;
      fSubcategoria.innerHTML = '<option value="">Selecione...</option>' + lista.map(function (s) {
        return '<option value="' + s.id + '">' + escHtml(s.nome) + '</option>';
      }).join('');
      if (selecionarId) fSubcategoria.value = String(selecionarId);
      return lista;
    });
  }
  fCategoria.addEventListener('change', function () { carregarSubcategorias(fCategoria.value).then(atualizarPreview); });

  /* Seletor de produtos */
  var todosProdutos = null;
  var produtosSelecionados = new Set();

  function carregarProdutos() {
    if (todosProdutos) return Promise.resolve(todosProdutos);
    listaProdutos.innerHTML = '<li class="lista-selecao__vazia">Carregando produtos...</li>';
    return fetch('/api/admin/produtos')
      .then(function (r) { return r.json(); })
      .then(function (data) { todosProdutos = data.ok ? data.data : []; renderizarProdutos(); return todosProdutos; })
      .catch(function () { listaProdutos.innerHTML = '<li class="lista-selecao__vazia">Erro ao carregar produtos.</li>'; return []; });
  }
  function renderizarProdutos() {
    if (!todosProdutos) return;
    var termo = (fProdutosBusca.value || '').trim().toLowerCase();
    var filtrados = todosProdutos.filter(function (p) { return !termo || p.nome.toLowerCase().indexOf(termo) !== -1; });
    listaProdutos.innerHTML = !filtrados.length
      ? '<li class="lista-selecao__vazia">Nenhum produto encontrado.</li>'
      : filtrados.map(function (p) {
          var marcado = produtosSelecionados.has(String(p.id)) ? ' checked' : '';
          return '<li><label><input type="checkbox" value="' + p.id + '"' + marcado + '> ' + escHtml(p.nome) + '</label></li>';
        }).join('');
    atualizarContagemProdutos();
  }
  function atualizarContagemProdutos() {
    var n = produtosSelecionados.size;
    contagemProdutos.textContent = n === 0 ? 'Nenhum produto selecionado.' : n + ' produto(s) selecionado(s).';
  }
  listaProdutos.addEventListener('change', function (e) {
    var chk = e.target.closest('input[type="checkbox"]');
    if (!chk) return;
    if (chk.checked) produtosSelecionados.add(chk.value); else produtosSelecionados.delete(chk.value);
    atualizarContagemProdutos();
    atualizarPreview();
  });
  fProdutosBusca.addEventListener('input', renderizarProdutos);

  function atualizarVisibilidade() {
    var tipo = tipoSelecionado();
    var precisaCategoria = tipo === 'categoria' || tipo === 'subcategoria';
    var precisaValorMinimo = tipo === 'valor_minimo_produto' || tipo === 'valor_minimo_carrinho';

    campoCategoria.hidden = !precisaCategoria;
    campoSubcategoria.hidden = tipo !== 'subcategoria';
    campoProdutos.hidden = tipo !== 'produto';
    campoValorMinimo.hidden = !precisaValorMinimo;
    avisoTodos.hidden = tipo !== 'todos';

    rotuloValorMinimo.textContent = tipo === 'valor_minimo_carrinho' ? 'Valor mínimo do carrinho (R$) *' : 'Valor mínimo do produto (R$) *';

    fCategoria.required = precisaCategoria;
    fSubcategoria.required = tipo === 'subcategoria';
    fValorMinimo.required = precisaValorMinimo;

    if (tipo === 'produto' && !todosProdutos) carregarProdutos();
    atualizarPreview();
  }
  radiosTipo.forEach(function (r) { r.addEventListener('change', atualizarVisibilidade); });

  function atualizarSemDataFim() {
    fDataFim.disabled = fSemDataFim.checked;
    if (fSemDataFim.checked) fDataFim.value = '';
    campoDataFim.style.opacity = fSemDataFim.checked ? '.5' : '';
    atualizarPreview();
  }
  fSemDataFim.addEventListener('change', atualizarSemDataFim);
  [fDataInicio, fDataFim, fAtivo].forEach(function (el) { el.addEventListener('change', atualizarPreview); });
  fNome.addEventListener('input', atualizarPreview);
  fValorMinimo.addEventListener('input', atualizarPreview);
  fSubcategoria.addEventListener('change', atualizarPreview);

  /* Prévia do desconto */
  fDesconto.addEventListener('input', function () {
    var v = Number(fDesconto.value) || 0;
    descontoPreview.querySelector('strong').textContent = (v ? v.toLocaleString('pt-BR') : '0') + '%';
    atualizarPreview();
  });

  function textoRegra() {
    var tipo = tipoSelecionado();
    if (tipo === 'categoria') {
      var opt = fCategoria.options[fCategoria.selectedIndex];
      return opt && opt.value ? opt.textContent : 'Selecione uma categoria';
    }
    if (tipo === 'subcategoria') {
      var optC = fCategoria.options[fCategoria.selectedIndex];
      var optS = fSubcategoria.options[fSubcategoria.selectedIndex];
      var nomeC = optC && optC.value ? optC.textContent : '-';
      var nomeS = optS && optS.value ? optS.textContent : 'selecione a subcategoria';
      return nomeC + ' → ' + nomeS;
    }
    if (tipo === 'produto') {
      var n = produtosSelecionados.size;
      return n === 0 ? 'Nenhum produto selecionado' : n + ' produto(s) selecionado(s)';
    }
    if (tipo === 'valor_minimo_produto') return fValorMinimo.value ? 'Produto ≥ ' + fmtMoeda(fValorMinimo.value) : 'Informe o valor mínimo';
    if (tipo === 'valor_minimo_carrinho') return fValorMinimo.value ? 'Carrinho ≥ ' + fmtMoeda(fValorMinimo.value) : 'Informe o valor mínimo';
    return 'Todos os produtos ativos da loja';
  }
  function textoVigencia() {
    if (!fDataInicio.value && !fDataFim.value) return 'Sem prazo definido';
    var ini = fDataInicio.value ? fmtDataBR(fDataInicio.value) : '-';
    var fim = fSemDataFim.checked || !fDataFim.value ? 'sem término' : fmtDataBR(fDataFim.value);
    return ini + ' até ' + fim;
  }

  function atualizarPreview() {
    var nome = fNome.value.trim() || 'Nova promoção';
    var tipoTxt = ROTULOS_TIPO[tipoSelecionado()];
    var regraTxt = textoRegra();
    var descontoTxt = (Number(fDesconto.value) || 0).toLocaleString('pt-BR') + '% OFF';
    var vigenciaTxt = textoVigencia();
    var statusTxt = fAtivo.checked ? 'Ativa' : 'Pausada';

    var pvNome = document.getElementById('pv-nome'); if (pvNome) pvNome.textContent = nome;
    var pvTipo = document.getElementById('pv-tipo'); if (pvTipo) pvTipo.textContent = tipoTxt;
    var pvRegra = document.getElementById('pv-regra'); if (pvRegra) pvRegra.textContent = regraTxt;
    var pvDesconto = document.getElementById('pv-desconto'); if (pvDesconto) pvDesconto.textContent = descontoTxt;
    var pvVigencia = document.getElementById('pv-vigencia'); if (pvVigencia) pvVigencia.textContent = vigenciaTxt;
    var pvStatus = document.getElementById('pv-status'); if (pvStatus) pvStatus.textContent = statusTxt;

    var rvNome = document.getElementById('rv-nome'); if (rvNome) rvNome.textContent = nome;
    var rvRegra = document.getElementById('rv-regra'); if (rvRegra) {
      rvRegra.textContent = tipoSelecionado() === 'todos'
        ? 'Aplicado automaticamente a todos os produtos ativos da loja.'
        : 'Aplicado automaticamente para ' + tipoTxt.toLowerCase() + ': ' + regraTxt + '.';
    }
    var rvDesconto = document.getElementById('rv-desconto'); if (rvDesconto) rvDesconto.textContent = descontoTxt;
    var rvVigencia = document.getElementById('rv-vigencia'); if (rvVigencia) rvVigencia.textContent = vigenciaTxt;
    var rvStatus = document.getElementById('rv-status'); if (rvStatus) rvStatus.textContent = statusTxt;
  }

  /* Navegação do assistente */
  var TOTAL_PASSOS = 5;
  var passoAtual = 1;
  var stepperItens = Array.prototype.slice.call(document.querySelectorAll('#wizard-lista li'));
  var passos = Array.prototype.slice.call(document.querySelectorAll('.wizard-step'));

  function validarPasso(n) {
    if (n === 1) {
      if (!fNome.value.trim()) { mostrarMsg('Informe um nome para a promoção.', 'erro'); fNome.focus(); return false; }
      return true;
    }
    if (n === 2) {
      var tipo = tipoSelecionado();
      if ((tipo === 'categoria' || tipo === 'subcategoria') && !fCategoria.value) { mostrarMsg('Selecione uma categoria.', 'erro'); return false; }
      if (tipo === 'subcategoria' && !fSubcategoria.value) { mostrarMsg('Selecione uma subcategoria.', 'erro'); return false; }
      if (tipo === 'produto' && !produtosSelecionados.size) { mostrarMsg('Selecione ao menos um produto.', 'erro'); return false; }
      if ((tipo === 'valor_minimo_produto' || tipo === 'valor_minimo_carrinho') && !(Number(fValorMinimo.value) > 0)) { mostrarMsg('Informe um valor mínimo válido.', 'erro'); return false; }
      return true;
    }
    if (n === 3) {
      var v = Number(fDesconto.value);
      if (!(v > 0 && v <= 90)) { mostrarMsg('Informe um desconto entre 0,01% e 90%.', 'erro'); fDesconto.focus(); return false; }
      return true;
    }
    if (n === 4) {
      if (fDataInicio.value && fDataFim.value && !fSemDataFim.checked && fDataFim.value < fDataInicio.value) {
        mostrarMsg('A data de término deve ser depois da data de início.', 'erro');
        return false;
      }
      return true;
    }
    return true;
  }

  function irParaPasso(n) {
    passoAtual = n;
    passos.forEach(function (fs) { fs.hidden = Number(fs.dataset.passo) !== n; });
    stepperItens.forEach(function (li) {
      var p = Number(li.dataset.passo);
      li.classList.toggle('is-atual', p === n);
      li.classList.toggle('is-concluido', p < n);
    });
    btnVoltar.hidden = n === 1;
    btnAvancar.hidden = n === TOTAL_PASSOS;
    btnSalvar.hidden = n !== TOTAL_PASSOS;
    limparMsg();
    if (n === TOTAL_PASSOS) atualizarPreview();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  btnAvancar.addEventListener('click', function () {
    if (!validarPasso(passoAtual)) return;
    if (passoAtual < TOTAL_PASSOS) irParaPasso(passoAtual + 1);
  });
  btnVoltar.addEventListener('click', function () {
    if (passoAtual > 1) irParaPasso(passoAtual - 1);
  });
  stepperItens.forEach(function (li) {
    li.addEventListener('click', function () {
      var alvo = Number(li.dataset.passo);
      if (alvo <= passoAtual) irParaPasso(alvo);
    });
    li.style.cursor = 'pointer';
  });

  /* Envio */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!validarPasso(1) || !validarPasso(2) || !validarPasso(3) || !validarPasso(4)) { irParaPasso(1); return; }
    limparMsg();

    var tipo = tipoSelecionado();
    var payload = {
      nome: fNome.value.trim(),
      tipo: tipo,
      desconto_percentual: Number(fDesconto.value),
      categoria_id: (tipo === 'categoria' || tipo === 'subcategoria') ? Number(fCategoria.value) || '' : '',
      subcategoria_id: tipo === 'subcategoria' ? Number(fSubcategoria.value) || '' : '',
      produtos: tipo === 'produto' ? Array.from(produtosSelecionados).map(Number) : [],
      valor_minimo: (tipo === 'valor_minimo_produto' || tipo === 'valor_minimo_carrinho') ? Number(fValorMinimo.value) || '' : '',
      data_inicio: fDataInicio.value || '',
      data_fim: fSemDataFim.checked ? '' : (fDataFim.value || ''),
      ativo: fAtivo.checked,
    };

    var url = modoEdicao ? '/api/admin/promocoes/' + promocaoId : '/api/admin/promocoes';
    var metodo = modoEdicao ? 'PUT' : 'POST';

    btnSalvar.disabled = true;
    btnSalvar.classList.add('is-carregando');
    fetch(url, {
      method: metodo,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          mostrarMsg(data.message || 'Não foi possível salvar.', 'erro');
          btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
          return;
        }
        window.mostrarToastAoRecarregar(modoEdicao ? 'Promoção atualizada.' : 'Promoção criada.', 'sucesso');
        window.location.href = '/admin/promocoes#promocoes';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
      });
  });

  function marcarTipo(valor) {
    radiosTipo.forEach(function (r) { r.checked = r.value === valor; });
  }

  function preencherComDados(d, comDatasEAtivo) {
    fNome.value = d.nome || '';
    marcarTipo(d.tipo || 'categoria');

    var pProdutos = new Set((d.produtos || []).map(function (p) { return String(p.id); }));
    produtosSelecionados = pProdutos;

    var terminouCascata = Promise.resolve();
    if (d.tipo === 'categoria' || d.tipo === 'subcategoria') {
      if (d.categoria_id) {
        fCategoria.value = String(d.categoria_id);
        terminouCascata = carregarSubcategorias(d.categoria_id, d.subcategoria_id);
      }
    }
    if (d.tipo === 'produto') carregarProdutos().then(renderizarProdutos);
    if (d.valor_minimo != null) fValorMinimo.value = d.valor_minimo;
    fDesconto.value = d.desconto_percentual != null ? d.desconto_percentual : '';
    fDesconto.dispatchEvent(new Event('input'));

    if (comDatasEAtivo) {
      fDataInicio.value = d.data_inicio || '';
      fDataFim.value = d.data_fim || '';
      fSemDataFim.checked = !!d.data_inicio && !d.data_fim;
      fAtivo.checked = d.ativo !== false;
    }

    atualizarVisibilidade();
    atualizarSemDataFim();
    terminouCascata.then(atualizarPreview);
  }

  var dadosJsonEl = document.getElementById('promocao-dados-json');
  var dadosIniciais = null;
  if (dadosJsonEl && dadosJsonEl.textContent.trim()) {
    try { dadosIniciais = JSON.parse(dadosJsonEl.textContent); } catch (e) { dadosIniciais = null; }
  }

  if (modoEdicao && dadosIniciais) {
    preencherComDados(dadosIniciais, true);
  } else if (!modoEdicao) {
    var duplicado = null;
    try {
      var bruto = sessionStorage.getItem('floria-duplicar-promocao');
      if (bruto) { duplicado = JSON.parse(bruto); sessionStorage.removeItem('floria-duplicar-promocao'); }
    } catch (e) { duplicado = null; }
    if (duplicado) {
      preencherComDados(duplicado, false);
      window.mostrarToast && setTimeout(function () { window.mostrarToast('Dados copiados. Revise antes de salvar.', 'sucesso'); }, 300);
    } else {
      atualizarVisibilidade();
      atualizarSemDataFim();
      atualizarPreview();
    }
  }

  irParaPasso(1);
})();
