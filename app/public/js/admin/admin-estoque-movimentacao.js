(function () {
  'use strict';

  var form = document.getElementById('form-movimentacao');
  if (!form) return;

  var formMsg     = document.getElementById('form-movimentacao-msg');
  var btnSalvar   = document.getElementById('btn-registrar-movimentacao');
  var fProduto    = document.getElementById('mov-produto');
  var fTipoRadios = form.querySelectorAll('input[name="mov-tipo"]');
  var fQuantidade = document.getElementById('mov-quantidade');
  var fMotivo     = document.getElementById('mov-motivo');

  var fQuantidadeRotulo = document.getElementById('mov-quantidade-rotulo');

  var fProdutoResumo          = document.getElementById('mov-produto-resumo');
  var fProdutoResumoImg       = document.getElementById('mov-produto-resumo-img');
  var fProdutoResumoNome      = document.getElementById('mov-produto-resumo-nome');
  var fProdutoResumoCategoria = document.getElementById('mov-produto-resumo-categoria');

  var fResumoEstoqueAtual  = document.getElementById('mov-resumo-estoque-atual');
  var fResumoTipo          = document.getElementById('mov-resumo-tipo');
  var fResumoQuantidade    = document.getElementById('mov-resumo-quantidade');
  var fResumoEstoqueDepois = document.getElementById('mov-resumo-estoque-depois');

  var fStatus      = document.getElementById('mov-status');
  var fStatusIcone = fStatus.querySelector('i');
  var fStatusTexto = document.getElementById('mov-status-texto');

  var ROTULO_TIPO = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' };
  var ROTULO_QUANTIDADE = { entrada: 'Quantidade a somar *', saida: 'Quantidade a subtrair *', ajuste: 'Novo valor do estoque *' };

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }

  function tipoAtual() {
    var marcado = form.querySelector('input[name="mov-tipo"]:checked');
    return marcado ? marcado.value : '';
  }

  function produtoOptionSelecionada() {
    var opt = fProduto.options[fProduto.selectedIndex];
    return (opt && opt.value) ? opt : null;
  }

  function atualizarResumoProduto() {
    var opt = produtoOptionSelecionada();
    if (!opt) { fProdutoResumo.hidden = true; return; }
    fProdutoResumoImg.src = opt.dataset.imagem || '/imagens/image.png';
    fProdutoResumoImg.alt = opt.dataset.nome || '';
    fProdutoResumoNome.textContent = opt.dataset.nome || '';
    fProdutoResumoCategoria.textContent = opt.dataset.categoria || '';
    fProdutoResumo.hidden = false;
  }

  function atualizarRotuloQuantidade() {
    fQuantidadeRotulo.textContent = ROTULO_QUANTIDADE[tipoAtual()] || 'Quantidade *';
  }

  function atualizarResumoENoStatus() {
    var opt = produtoOptionSelecionada();
    var tipo = tipoAtual();
    var temQuantidade = fQuantidade.value !== '' && !isNaN(Number(fQuantidade.value));

    if (!opt) {
      fResumoEstoqueAtual.textContent = '-';
      fResumoTipo.textContent = '-';
      fResumoQuantidade.textContent = '-';
      fResumoEstoqueDepois.textContent = '-';
      fResumoEstoqueDepois.className = '';
      definirStatus('info', 'Selecione um produto para começar.');
      return;
    }

    var atual = Number(opt.dataset.estoque || 0);
    fResumoEstoqueAtual.textContent = atual + ' un.';
    fResumoTipo.textContent = ROTULO_TIPO[tipo] || '-';

    if (!temQuantidade) {
      fResumoQuantidade.textContent = '-';
      fResumoEstoqueDepois.textContent = '-';
      fResumoEstoqueDepois.className = '';
      definirStatus('info', 'Informe a quantidade da movimentação.');
      return;
    }

    var qtd = Number(fQuantidade.value);
    var novo = tipo === 'entrada' ? atual + qtd
             : tipo === 'saida'   ? Math.max(0, atual - qtd)
             : qtd;

    fResumoQuantidade.textContent = qtd;
    fResumoEstoqueDepois.textContent = atual + ' → ' + novo + ' un.';
    fResumoEstoqueDepois.className = novo > atual ? 'resumo-movimentacao__estoque--sobe'
                                    : novo < atual ? 'resumo-movimentacao__estoque--desce' : '';
    definirStatus('pronto', 'Pronto para registrar a movimentação.');
  }

  function definirStatus(estado, texto) {
    fStatusTexto.textContent = texto;
    fStatus.className = 'movimentacao-status' + (estado === 'pronto' ? ' movimentacao-status--pronto' : '');
    fStatusIcone.className = 'fas ' + (estado === 'pronto' ? 'fa-check-circle' : 'fa-info-circle');
  }

  function atualizarTudo() {
    atualizarResumoProduto();
    atualizarRotuloQuantidade();
    atualizarResumoENoStatus();
  }

  fProduto.addEventListener('change', atualizarTudo);
  fQuantidade.addEventListener('input', atualizarTudo);
  fTipoRadios.forEach(function (radio) { radio.addEventListener('change', atualizarTudo); });

  atualizarTudo();
  if (!fProduto.value) fProduto.focus();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    var payload = {
      produto_id: Number(fProduto.value),
      tipo: tipoAtual(),
      quantidade: Number(fQuantidade.value),
      motivo: fMotivo.value.trim(),
    };

    if (!payload.produto_id) { mostrarMsg('Selecione um produto.', 'erro'); return; }

    if (btnSalvar) { btnSalvar.disabled = true; btnSalvar.classList.add('is-carregando'); }
    fetch('/api/admin/estoque/movimentacao', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken() },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          mostrarMsg(data.message || 'Não foi possível registrar a movimentação.', 'erro');
          if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando'); }
          return;
        }
        window.location.href = '/estoque';
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        if (btnSalvar) { btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando'); }
      });
  });
})();
