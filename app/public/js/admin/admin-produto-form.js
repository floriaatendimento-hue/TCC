(function () {
  'use strict';

  var form = document.getElementById('form-produto');
  if (!form) return;

  var modo = form.dataset.modo;
  var produtoId = form.dataset.id;

  var formMsg   = document.getElementById('produtos-form-msg');
  var btnSalvar = document.getElementById('btn-salvar');
  var btnSalvarContinuar = document.getElementById('btn-salvar-continuar');

  var fNome           = document.getElementById('f-nome');
  var fSlug           = document.getElementById('f-slug');
  var fSku            = document.getElementById('f-sku');
  var fMarca          = document.getElementById('f-marca');
  var fCategoria      = document.getElementById('f-categoria');
  var fSubcategoria   = document.getElementById('f-subcategoria');
  var fDescricao      = document.getElementById('f-descricao');
  var fBeneficios     = document.getElementById('f-beneficios');
  var fComoUtilizar   = document.getElementById('f-como-utilizar');
  var fRecomendacoes  = document.getElementById('f-recomendacoes');
  var fPreco          = document.getElementById('f-preco');
  var fPrecoPromo     = document.getElementById('f-preco-promo');
  var fEstoque        = document.getElementById('f-estoque');
  var fEstoqueMinimo  = document.getElementById('f-estoque-minimo');
  var fImagens        = [1, 2, 3].map(function (n) { return document.getElementById('f-imagem-' + n); });
  var fImagensPreview = [1, 2, 3].map(function (n) { return document.getElementById('f-imagem-' + n + '-preview'); });
  var fImagensRemover = [1, 2, 3].map(function (n) { return document.getElementById('f-imagem-' + n + '-remover'); });
  var fTags           = document.getElementById('f-tags');
  var fDestaque       = document.getElementById('f-destaque');
  var fAtivo          = document.getElementById('f-ativo');
  var listaSpecs      = document.getElementById('f-especificacoes-lista');
  var btnAddSpec      = document.getElementById('f-add-spec');
  var listaCuidados   = document.getElementById('f-cuidados-lista');
  var btnAddCuidado   = document.getElementById('f-add-cuidado');
  var fVariacaoTipo   = document.getElementById('f-variacao-tipo');
  var fVariacaoRotulo = document.getElementById('f-variacao-rotulo');
  var listaVariacoes  = document.getElementById('f-variacoes-lista');
  var btnAddVariacao  = document.getElementById('f-add-variacao');

  // Resumo lateral
  var prNome       = document.getElementById('pr-nome');
  var prCategoria  = document.getElementById('pr-categoria');
  var prPreco      = document.getElementById('pr-preco');
  var prEstoque    = document.getElementById('pr-estoque');
  var prStatus     = document.getElementById('pr-status');
  var prImagens    = document.getElementById('pr-imagens');
  var prImagemImg  = document.getElementById('pr-imagem-principal-img');

  var subcategoriasPorCategoria = {};

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function fmtPreco(v) { return 'R$ ' + Number(v || 0).toFixed(2).replace('.', ','); }
  function normalizar(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function mostrarMsg(t, tipo) {
    formMsg.textContent = t;
    formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso');
    formMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }

  var formAcoes = document.querySelector('.produto-form-acoes');
  if (formAcoes) {
    var atualizarAlturaAcoes = function () {
      document.documentElement.style.setProperty('--produto-acoes-h', formAcoes.offsetHeight + 'px');
    };
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(atualizarAlturaAcoes).observe(formAcoes);
    } else {
      window.addEventListener('resize', atualizarAlturaAcoes);
    }
    atualizarAlturaAcoes();
  }

  var dadosIniciais = null;
  var elDados = document.getElementById('produto-dados-json');
  if (elDados && elDados.textContent.trim()) {
    try { dadosIniciais = JSON.parse(elDados.textContent); } catch (e) { dadosIniciais = null; }
  }

  var CUIDADOS_PADRAO = {
    plantas: [
      ['fas fa-sun', 'Luz', 'Posicione em local com boa luminosidade, de preferência luz indireta.'],
      ['fas fa-tint', 'Rega', 'Regue quando os primeiros centímetros do substrato estiverem secos.'],
      ['fas fa-thermometer-half', 'Temperatura', 'Mantenha entre 18°C e 28°C, protegida de frio intenso e correntes de ar.'],
      ['fas fa-exclamation-triangle', 'Atenção', 'Verifique periodicamente pragas e folhas amareladas.'],
    ],
    vasos: [
      ['fas fa-cube', 'Material', 'Verifique a resistência do material a sol, chuva e variações de temperatura.'],
      ['fas fa-ruler-combined', 'Capacidade', 'Escolha o porte adequado ao tamanho da planta e de suas raízes.'],
      ['fas fa-tint', 'Drenagem', 'Utilize um prato coletor quando não houver escoamento direto para o solo.'],
      ['fas fa-broom', 'Limpeza', 'Limpe com pano úmido e sabão neutro, evitando produtos abrasivos.'],
    ],
    ferramentas: [
      ['fas fa-hand-paper', 'Uso', 'Utilize sempre com a proteção adequada e sobre superfície firme.'],
      ['fas fa-tools', 'Manutenção', 'Limpe após o uso e lubrifique partes metálicas periodicamente.'],
      ['fas fa-warehouse', 'Armazenamento', 'Guarde em local seco, longe da umidade, para evitar ferrugem.'],
      ['fas fa-exclamation-triangle', 'Atenção', 'Mantenha fora do alcance de crianças.'],
    ],
    adubos: [
      ['fas fa-seedling', 'Modo de Uso', 'Aplique diretamente no substrato, evitando contato direto com o caule.'],
      ['fas fa-weight-hanging', 'Dosagem', 'Respeite a quantidade indicada na embalagem para o porte da planta.'],
      ['fas fa-calendar-alt', 'Frequência', 'Reaplique conforme a periodicidade recomendada para cada espécie.'],
      ['fas fa-exclamation-triangle', 'Atenção', 'Armazene em local seco e fora do alcance de crianças e animais.'],
    ],
    'controle-pragas': [
      ['fas fa-spray-can', 'Modo de Uso', 'Aplique diretamente sobre a área afetada, preferencialmente ao entardecer.'],
      ['fas fa-weight-hanging', 'Dosagem', 'Siga rigorosamente a diluição e a quantidade indicadas na embalagem.'],
      ['fas fa-calendar-alt', 'Frequência', 'Repita a aplicação conforme a recorrência da praga, respeitando o intervalo indicado.'],
      ['fas fa-exclamation-triangle', 'Atenção', 'Use proteção adequada durante a aplicação e mantenha longe de crianças e pets.'],
    ],
    _padrao: [
      ['fas fa-info-circle', 'Como Usar', 'Siga as instruções da embalagem para o melhor resultado.'],
      ['fas fa-box', 'Conservação', 'Mantenha em local apropriado, protegido de sol e umidade excessiva.'],
      ['fas fa-warehouse', 'Armazenamento', 'Guarde em local seco e arejado quando não estiver em uso.'],
      ['fas fa-exclamation-triangle', 'Atenção', 'Mantenha fora do alcance de crianças e animais de estimação.'],
    ],
  };
  var ICONES_CUIDADO = [
    'fas fa-sun', 'fas fa-tint', 'fas fa-thermometer-half', 'fas fa-exclamation-triangle',
    'fas fa-cube', 'fas fa-ruler-combined', 'fas fa-broom', 'fas fa-hand-paper', 'fas fa-tools',
    'fas fa-warehouse', 'fas fa-seedling', 'fas fa-weight-hanging', 'fas fa-calendar-alt',
    'fas fa-spray-can', 'fas fa-info-circle', 'fas fa-box',
  ];
  var ICONES_CUIDADO_LABEL = {
    'fas fa-sun': 'Sol',
    'fas fa-tint': 'Água',
    'fas fa-thermometer-half': 'Temperatura',
    'fas fa-exclamation-triangle': 'Atenção',
    'fas fa-cube': 'Material',
    'fas fa-ruler-combined': 'Medidas',
    'fas fa-broom': 'Limpeza',
    'fas fa-hand-paper': 'Manuseio',
    'fas fa-tools': 'Manutenção',
    'fas fa-warehouse': 'Armazenamento',
    'fas fa-seedling': 'Plantio',
    'fas fa-weight-hanging': 'Peso',
    'fas fa-calendar-alt': 'Frequência',
    'fas fa-spray-can': 'Aplicação',
    'fas fa-info-circle': 'Informação',
    'fas fa-box': 'Conservação',
  };

  /* Categoria → Subcategoria */
  function carregarSubcategorias(categoriaId) {
    if (!categoriaId) return Promise.resolve([]);
    if (subcategoriasPorCategoria[categoriaId]) return Promise.resolve(subcategoriasPorCategoria[categoriaId]);
    return fetch('/api/admin/subcategorias?categoria_id=' + categoriaId)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var lista = (data && data.ok && Array.isArray(data.data)) ? data.data : [];
        subcategoriasPorCategoria[categoriaId] = lista;
        return lista;
      });
  }

  function escHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  var pedidoSubcategoriaAtual = 0;
  function atualizarSelectSubcategoria(categoriaId, selecionarId, extraOpcaoInativa) {
    var pedido = ++pedidoSubcategoriaAtual;
    fSubcategoria.innerHTML = '<option value="">Selecione...</option>';
    if (!categoriaId) return Promise.resolve();
    fSubcategoria.disabled = true;
    return carregarSubcategorias(categoriaId).then(function (lista) {
      if (pedido !== pedidoSubcategoriaAtual) return;
      lista.forEach(function (s) {
        var opt = '<option value="' + s.id + '"' + (String(s.id) === String(selecionarId) ? ' selected' : '') + '>' + escHtml(s.nome) + '</option>';
        fSubcategoria.insertAdjacentHTML('beforeend', opt);
      });
      var jaTemSelecionada = selecionarId && lista.some(function (s) { return String(s.id) === String(selecionarId); });
      if (extraOpcaoInativa && selecionarId && !jaTemSelecionada) {
        var optInativa = '<option value="' + extraOpcaoInativa.id + '" selected>' + escHtml(extraOpcaoInativa.nome) + ' (inativa)</option>';
        fSubcategoria.insertAdjacentHTML('beforeend', optInativa);
      }
    }).finally(function () {
      if (pedido === pedidoSubcategoriaAtual) fSubcategoria.disabled = false;
    });
  }

  function categoriaSlugAtual() {
    var opt = fCategoria.options[fCategoria.selectedIndex];
    return opt ? opt.dataset.slug || '' : '';
  }

  fCategoria.addEventListener('change', function () {
    atualizarSelectSubcategoria(fCategoria.value, '');
    if (!listaCuidados.querySelector('.cuidado-linha')) {
      preencherCuidadosPadrao(categoriaSlugAtual());
    }
    atualizarResumo();
  });

  function criarLinhaSpec(chave, valor) {
    var linha = document.createElement('p');
    linha.className = 'spec-linha';
    linha.innerHTML =
      '<input type="text" class="spec-chave" placeholder="Ex: Material" value="' + (chave || '').replace(/"/g, '&quot;') + '">' +
      '<input type="text" class="spec-valor" placeholder="Ex: Aço inox" value="' + (valor || '').replace(/"/g, '&quot;') + '">' +
      '<button type="button" class="spec-remover" aria-label="Remover">×</button>';
    linha.querySelector('button').addEventListener('click', function () { linha.remove(); });
    return linha;
  }

  if (btnAddSpec) btnAddSpec.addEventListener('click', function () { listaSpecs.appendChild(criarLinhaSpec('', '')); });

  function lerEspecificacoes() {
    var linhas = listaSpecs.querySelectorAll('.spec-linha');
    var obj = {}; var temAlguma = false;
    linhas.forEach(function (linha) {
      var chave = linha.querySelector('.spec-chave').value.trim();
      var valor = linha.querySelector('.spec-valor').value.trim();
      if (chave && valor) { obj[chave] = valor; temAlguma = true; }
    });
    return temAlguma ? obj : null;
  }

  function criarLinhaCuidado(icone, titulo, texto) {
    var linha = document.createElement('p');
    linha.className = 'cuidado-linha';
    var opcoesIcone = ICONES_CUIDADO.map(function (i) {
      var rotulo = ICONES_CUIDADO_LABEL[i] || i.replace('fas fa-', '');
      return '<option value="' + i + '"' + (i === icone ? ' selected' : '') + '>' + rotulo + '</option>';
    }).join('');
    linha.innerHTML =
      '<i class="cuidado-icone-preview ' + icone + '" aria-hidden="true"></i>' +
      '<select class="cuidado-icone" aria-label="Ícone do cuidado">' + opcoesIcone + '</select>' +
      '<input type="text" class="cuidado-titulo" placeholder="Título (ex: Luz)" maxlength="40" value="' + (titulo || '').replace(/"/g, '&quot;') + '">' +
      '<input type="text" class="cuidado-texto" placeholder="Texto explicativo" maxlength="200" value="' + (texto || '').replace(/"/g, '&quot;') + '">' +
      '<button type="button" class="spec-remover" aria-label="Remover">×</button>';
    var elIcone = linha.querySelector('.cuidado-icone-preview');
    linha.querySelector('.cuidado-icone').addEventListener('change', function () {
      elIcone.className = 'cuidado-icone-preview ' + this.value;
    });
    linha.querySelector('button').addEventListener('click', function () { linha.remove(); });
    return linha;
  }

  if (btnAddCuidado) btnAddCuidado.addEventListener('click', function () { listaCuidados.appendChild(criarLinhaCuidado('fas fa-info-circle', '', '')); });

  function preencherCuidadosPadrao(categoriaSlug) {
    var preset = CUIDADOS_PADRAO[categoriaSlug] || CUIDADOS_PADRAO._padrao;
    listaCuidados.innerHTML = '';
    preset.forEach(function (c) { listaCuidados.appendChild(criarLinhaCuidado(c[0], c[1], c[2])); });
  }

  function lerCuidados() {
    var linhas = listaCuidados.querySelectorAll('.cuidado-linha');
    var lista = [];
    linhas.forEach(function (linha) {
      var icone = linha.querySelector('.cuidado-icone').value;
      var titulo = linha.querySelector('.cuidado-titulo').value.trim();
      var texto = linha.querySelector('.cuidado-texto').value.trim();
      if (titulo && texto) lista.push({ icone: icone, titulo: titulo, texto: texto });
    });
    return lista;
  }

  function criarLinhaVariacao(rotulo, corHex, preco, disponivel) {
    var tipo = fVariacaoTipo.value;
    var linha = document.createElement('p');
    linha.className = 'variacao-linha';
    linha.innerHTML =
      '<input type="text" class="variacao-rotulo" placeholder="Ex: Verde Escuro" maxlength="40" value="' + (rotulo || '').replace(/"/g, '&quot;') + '">' +
      (tipo === 'cor' ? '<input type="color" class="variacao-cor" value="' + (corHex || '#4a7c5f') + '">' : '') +
      '<input type="number" class="variacao-preco" placeholder="Preço (opc.)" min="0.01" step="0.01" value="' + (preco != null ? preco : '') + '">' +
      '<label><input type="checkbox" class="variacao-disponivel"' + (disponivel === false ? '' : ' checked') + '> Disponível</label>' +
      '<button type="button" class="spec-remover" aria-label="Remover">×</button>';
    linha.querySelector('.spec-remover').addEventListener('click', function () { linha.remove(); });
    return linha;
  }

  if (btnAddVariacao) btnAddVariacao.addEventListener('click', function () {
    if (!fVariacaoTipo.value) { alert('Selecione o tipo de variação antes de adicionar uma opção.'); return; }
    listaVariacoes.appendChild(criarLinhaVariacao('', '', null, true));
  });

  function lerVariacoes() {
    var tipo = fVariacaoTipo.value;
    if (!tipo) return null;
    var linhas = listaVariacoes.querySelectorAll('.variacao-linha');
    var opcoes = [];
    linhas.forEach(function (linha) {
      var rotulo = linha.querySelector('.variacao-rotulo').value.trim();
      if (!rotulo) return;
      var corEl = linha.querySelector('.variacao-cor');
      var precoEl = linha.querySelector('.variacao-preco');
      var disponivelEl = linha.querySelector('.variacao-disponivel');
      opcoes.push({
        id: normalizar(rotulo).replace(/[^a-z0-9]+/g, '-'),
        rotulo: rotulo,
        corHex: corEl ? corEl.value : undefined,
        preco: precoEl && precoEl.value ? Number(precoEl.value) : undefined,
        disponivel: disponivelEl ? disponivelEl.checked : true,
      });
    });
    if (!opcoes.length) return null;
    return [{ tipo: tipo, rotulo: fVariacaoRotulo.value.trim() || tipo, opcoes: opcoes }];
  }

  fImagens.forEach(function (input, i) {
    var preview = fImagensPreview[i];
    var remover = fImagensRemover[i];
    var original = { hidden: preview.hidden, src: preview.src };

    function restaurarOriginal() {
      input.value = '';
      preview.hidden = original.hidden;
      preview.src = original.hidden ? '' : original.src;
      if (remover) remover.hidden = true;
      if (i === 0) prImagemImg.src = original.hidden ? '/imagens/image.png' : original.src;
      atualizarResumo();
    }

    input.addEventListener('change', function () {
      var arquivo = input.files && input.files[0];
      if (!arquivo) { restaurarOriginal(); return; }
      var url = URL.createObjectURL(arquivo);
      preview.src = url;
      preview.hidden = false;
      if (remover) remover.hidden = false;
      if (i === 0) prImagemImg.src = url;
      atualizarResumo();
    });

    if (remover) remover.addEventListener('click', function (e) { e.preventDefault(); restaurarOriginal(); });
  });

  /* Resumo do produto */
  function atualizarResumo() {
    prNome.textContent = fNome.value.trim() || 'Nome do produto';
    var opt = fCategoria.options[fCategoria.selectedIndex];
    prCategoria.textContent = (opt && opt.value) ? opt.textContent : 'Categoria não selecionada';

    var preco = fPreco.value ? Number(fPreco.value) : null;
    var precoPromo = fPrecoPromo.value ? Number(fPrecoPromo.value) : null;
    prPreco.textContent = preco != null ? (precoPromo != null ? fmtPreco(preco) + ' → ' + fmtPreco(precoPromo) : fmtPreco(preco)) : '-';

    prEstoque.textContent = fEstoque.value !== '' ? fEstoque.value + ' un.' : '-';
    prStatus.textContent = fAtivo.checked ? (fDestaque.checked ? 'Ativo · Destaque' : 'Ativo') : 'Inativo';

    var qtdImagens = fImagens.filter(function (input, i) { return (input.files && input.files[0]) || !fImagensPreview[i].hidden; }).length;
    prImagens.textContent = qtdImagens + ' de 3';
  }

  [fNome, fPreco, fPrecoPromo, fEstoque].forEach(function (el) { el.addEventListener('input', atualizarResumo); });
  [fAtivo, fDestaque].forEach(function (el) { el.addEventListener('change', atualizarResumo); });

  /* Preenchimento inicial */
  if (modo === 'editar' && dadosIniciais) {
    var extraSubInativa = dadosIniciais.subcategoria_id && dadosIniciais.subcategoria_nome
      ? { id: dadosIniciais.subcategoria_id, nome: dadosIniciais.subcategoria_nome }
      : null;
    atualizarSelectSubcategoria(fCategoria.value, dadosIniciais.subcategoria_id, extraSubInativa);

    var especificacoes = dadosIniciais.especificacoes;
    if (especificacoes) {
      Object.keys(especificacoes).forEach(function (chave) {
        listaSpecs.appendChild(criarLinhaSpec(chave, especificacoes[chave]));
      });
    }

    var cuidados = dadosIniciais.cuidados;
    if (Array.isArray(cuidados) && cuidados.length) {
      cuidados.forEach(function (c) { listaCuidados.appendChild(criarLinhaCuidado(c.icone, c.titulo, c.texto)); });
    }

    var variacoes = dadosIniciais.variacoes;
    if (Array.isArray(variacoes) && variacoes.length) {
      var grupo = variacoes[0];
      fVariacaoTipo.value = grupo.tipo || '';
      fVariacaoRotulo.value = grupo.rotulo || '';
      (grupo.opcoes || []).forEach(function (op) {
        listaVariacoes.appendChild(criarLinhaVariacao(op.rotulo, op.corHex, op.preco, op.disponivel));
      });
    }
  } else if (fCategoria.value) {
    atualizarSelectSubcategoria(fCategoria.value, '');
  }

  atualizarResumo();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    var continuar = !!(e.submitter && e.submitter.dataset.continuar === 'true');
    var botaoClicado = e.submitter || btnSalvar;

    var especificacoes = lerEspecificacoes();
    var cuidados = lerCuidados();
    if (!especificacoes) { mostrarMsg('Informe ao menos uma especificação (ficha técnica).', 'erro'); return; }
    if (cuidados.length < 3) { mostrarMsg('Informe ao menos 3 cuidados (ícone, título e texto).', 'erro'); return; }

    var fd = new FormData();
    fd.append('nome', fNome.value.trim());
    fd.append('slug', fSlug.value.trim());
    fd.append('sku', fSku.value.trim());
    fd.append('marca', fMarca.value.trim());
    fd.append('categoria_id', fCategoria.value);
    fd.append('subcategoria_id', fSubcategoria.value);
    fd.append('descricao', fDescricao.value.trim());
    fd.append('beneficios', fBeneficios.value.trim());
    fd.append('como_utilizar', fComoUtilizar.value.trim());
    fd.append('recomendacoes', fRecomendacoes.value.trim());
    fd.append('preco', fPreco.value);
    fd.append('preco_promo', fPrecoPromo.value || '');
    fd.append('estoque', fEstoque.value);
    fd.append('estoque_minimo', fEstoqueMinimo.value || '5');
    fd.append('tags', fTags.value.trim());
    fd.append('destaque', fDestaque.checked ? 'true' : 'false');
    fd.append('ativo', fAtivo.checked ? 'true' : 'false');
    fd.append('especificacoes', JSON.stringify(especificacoes));
    fd.append('cuidados', JSON.stringify(cuidados));
    var variacoes = lerVariacoes();
    if (variacoes) fd.append('variacoes', JSON.stringify(variacoes));

    fImagens.forEach(function (input, i) {
      if (input.files && input.files[0]) fd.append('imagem_' + (i + 1), input.files[0]);
    });
    if (modo === 'novo' && !fImagens.every(function (input) { return input.files && input.files[0]; })) {
      mostrarMsg('Envie as 3 imagens do produto.', 'erro');
      return;
    }

    var url = modo === 'editar' ? '/api/produtos/' + produtoId : '/api/produtos';
    var metodo = modo === 'editar' ? 'PUT' : 'POST';

    [btnSalvar, btnSalvarContinuar].forEach(function (b) { if (b) b.disabled = true; });
    botaoClicado.classList.add('is-carregando');
    fetch(url, {
      method: metodo,
      headers: { 'X-CSRF-Token': csrfToken() },
      body: fd,
    })
      .then(function (r) { return r.json().then(function (data) { return { status: r.status, data: data }; }); })
      .then(function (res) {
        if (!res.data.ok) {
          mostrarMsg(res.data.message || 'Não foi possível salvar o produto.', 'erro');
          return;
        }
        if (modo === 'novo') {
          var novoId = res.data.id;
          window.location.href = continuar ? ('/admin/produtos/' + novoId + '/editar') : '/admin/produtos';
          return;
        }
        // Edição
        if (continuar) {
          mostrarMsg('Produto atualizado com sucesso.', 'sucesso');
        } else {
          window.location.href = '/admin/produtos';
        }
      })
      .catch(function () { mostrarMsg('Erro de conexão. Tente novamente.', 'erro'); })
      .finally(function () {
        [btnSalvar, btnSalvarContinuar].forEach(function (b) { if (b) b.disabled = false; });
        botaoClicado.classList.remove('is-carregando');
      });
  });
})();
