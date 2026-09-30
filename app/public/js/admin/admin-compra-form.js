(function () {
  'use strict';

  var form = document.getElementById('form-compra');
  if (!form) return;

  var itensTbody       = document.getElementById('itens-tbody');
  var btnAddItem        = document.getElementById('btn-add-item');
  var listaProdutos     = document.getElementById('lista-produtos');
  var fFornecedor        = document.getElementById('f-fornecedor');
  var fDataCompra        = document.getElementById('f-data-compra');
  var fDesconto          = document.getElementById('f-desconto');
  var fFrete             = document.getElementById('f-frete');
  var fImpostos          = document.getElementById('f-impostos');
  var fTaxas             = document.getElementById('f-taxas');
  var fFormaPagamento    = document.getElementById('f-forma-pagamento');
  var blocoAVista        = document.getElementById('bloco-a-vista');
  var blocoParcelado     = document.getElementById('bloco-parcelado');
  var fVencimento        = document.getElementById('f-vencimento');
  var fNumeroParcelas    = document.getElementById('f-numero-parcelas');
  var fPrimeiroVenc      = document.getElementById('f-primeiro-vencimento');
  var fIntervaloDias     = document.getElementById('f-intervalo-dias');
  var previewParcelas    = document.getElementById('preview-parcelas');
  var fObservacoes       = document.getElementById('f-observacoes');
  var formMsg            = document.getElementById('form-compra-msg');
  var btnSalvar          = document.getElementById('btn-salvar-compra');

  function csrfToken() { var el = document.getElementById('csrf-token'); return el ? el.value : ''; }
  function mostrarMsg(t, tipo) { formMsg.textContent = t; formMsg.className = 'form-admin__mensagem ' + (tipo === 'erro' ? 'is-erro' : 'is-sucesso'); }
  function limparMsg() { formMsg.textContent = ''; formMsg.className = 'form-admin__mensagem'; }
  function fmtMoeda(v) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
  function arred2(v) { return Math.round((Number(v) || 0) * 100) / 100; }

  var produtosPorNome = {};
  fetch('/api/admin/produtos')
    .then(function (r) { return r.json(); })
    .then(function (data) {
      if (!data.ok) return;
      data.data.forEach(function (p) {
        produtosPorNome[p.nome] = p.id;
        var opt = document.createElement('option');
        opt.value = p.nome;
        listaProdutos.appendChild(opt);
      });
    })
    .catch(function () {   });

  var contadorLinhas = 0;

  function criarLinhaItem() {
    contadorLinhas++;
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td><input type="text" class="item-produto" list="lista-produtos" placeholder="Opcional" aria-label="Produto do catálogo (opcional)" style="width:9rem;"></td>' +
      '<td><input type="text" class="item-descricao" maxlength="200" placeholder="Ex.: Vaso cerâmico 20cm" aria-label="Descrição do item"></td>' +
      '<td class="num"><input type="number" class="item-quantidade" min="0.001" step="0.001" value="1" aria-label="Quantidade" style="width:5rem;"></td>' +
      '<td><input type="text" class="item-unidade" maxlength="10" placeholder="un" aria-label="Unidade" style="width:3.5rem;"></td>' +
      '<td class="num"><input type="number" class="item-preco" min="0" step="0.01" value="0" aria-label="Preço unitário em reais" style="width:6.5rem;"></td>' +
      '<td class="num"><input type="number" class="item-desconto" min="0" step="0.01" value="0" aria-label="Desconto do item em reais" style="width:6rem;"></td>' +
      '<td class="num item-subtotal">R$ 0,00</td>' +
      '<td><button type="button" class="btn-admin btn-admin--perigo btn-remover-item" aria-label="Remover item"><i class="fas fa-trash" aria-hidden="true"></i></button></td>';
    itensTbody.appendChild(tr);

    tr.querySelector('.item-produto').addEventListener('change', function () {
      var id = produtosPorNome[this.value];
      if (id && !tr.querySelector('.item-descricao').value) {
        tr.querySelector('.item-descricao').value = this.value;
      }
    });

    tr.querySelector('.item-quantidade').addEventListener('input', atualizarResumo);
    tr.querySelector('.item-preco').addEventListener('input', atualizarResumo);
    tr.querySelector('.item-desconto').addEventListener('input', atualizarResumo);
    tr.querySelector('.btn-remover-item').addEventListener('click', function () {
      tr.remove();
      atualizarResumo();
    });
    return tr;
  }

  btnAddItem.addEventListener('click', function () { criarLinhaItem(); atualizarResumo(); });

  function linhasItens() {
    return Array.prototype.slice.call(itensTbody.querySelectorAll('tr'));
  }

  function atualizarResumo() {
    var subtotal = 0;
    linhasItens().forEach(function (tr) {
      var qtd = Number(tr.querySelector('.item-quantidade').value) || 0;
      var preco = Number(tr.querySelector('.item-preco').value) || 0;
      var descontoItem = Number(tr.querySelector('.item-desconto').value) || 0;
      var sub = Math.max(0, qtd * preco - descontoItem);
      tr.querySelector('.item-subtotal').textContent = fmtMoeda(sub);
      subtotal += sub;
    });

    var desconto = Number(fDesconto.value) || 0;
    var frete = Number(fFrete.value) || 0;
    var impostos = Number(fImpostos.value) || 0;
    var taxas = Number(fTaxas.value) || 0;
    var total = Math.max(0, subtotal - desconto + frete + impostos + taxas);

    document.getElementById('resumo-subtotal').textContent = fmtMoeda(subtotal);
    document.getElementById('resumo-desconto').textContent = '- ' + fmtMoeda(desconto);
    document.getElementById('resumo-frete').textContent = '+ ' + fmtMoeda(frete);
    document.getElementById('resumo-impostos').textContent = '+ ' + fmtMoeda(impostos);
    document.getElementById('resumo-taxas').textContent = '+ ' + fmtMoeda(taxas);
    document.getElementById('resumo-total').textContent = fmtMoeda(total);

    atualizarPreviewParcelas(total);
    return total;
  }

  /* Condição de pagamento */
  function formaParcelada() { return fFormaPagamento.value === 'parcelado'; }

  function alternarBlocoPagamento() {
    var parcelado = formaParcelada();
    blocoAVista.hidden = parcelado;
    blocoParcelado.hidden = !parcelado;
    fVencimento.required = !parcelado;
    fNumeroParcelas.required = parcelado;
    fPrimeiroVenc.required = parcelado;
    atualizarResumo();
  }
  fFormaPagamento.addEventListener('change', alternarBlocoPagamento);
  [fDesconto, fFrete, fImpostos, fTaxas].forEach(function (el) { el.addEventListener('input', atualizarResumo); });
  [fNumeroParcelas, fPrimeiroVenc, fIntervaloDias].forEach(function (el) {
    el.addEventListener('input', function () { atualizarPreviewParcelas(atualizarResumoSemPreview()); });
  });

  function atualizarResumoSemPreview() {
    var subtotal = 0;
    linhasItens().forEach(function (tr) {
      var qtd = Number(tr.querySelector('.item-quantidade').value) || 0;
      var preco = Number(tr.querySelector('.item-preco').value) || 0;
      var descontoItem = Number(tr.querySelector('.item-desconto').value) || 0;
      subtotal += Math.max(0, qtd * preco - descontoItem);
    });
    var desconto = Number(fDesconto.value) || 0;
    var frete = Number(fFrete.value) || 0;
    var impostos = Number(fImpostos.value) || 0;
    var taxas = Number(fTaxas.value) || 0;
    return Math.max(0, subtotal - desconto + frete + impostos + taxas);
  }

  function dividirEmParcelas(total, n) {
    var totalCentavos = Math.round(total * 100);
    if (totalCentavos < n) return [];
    var base = Math.floor(totalCentavos / n);
    var resto = totalCentavos % n;
    var valores = [];
    for (var i = 0; i < n; i++) valores.push((base + (i < resto ? 1 : 0)) / 100);
    return valores;
  }
  function somarDias(dataIso, dias) {
    if (!dataIso) return '';
    var d = new Date(dataIso + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() + dias);
    return d.toISOString().slice(0, 10);
  }
  function dataFmtBr(iso) {
    if (!iso) return '-';
    var partes = iso.split('-');
    return partes[2] + '/' + partes[1] + '/' + partes[0];
  }

  function atualizarPreviewParcelas(total) {
    if (!formaParcelada()) { previewParcelas.innerHTML = ''; return; }
    var n = Math.max(2, Math.min(60, Math.trunc(Number(fNumeroParcelas.value)) || 2));
    var intervalo = Math.max(1, Math.trunc(Number(fIntervaloDias.value)) || 30);
    var valores = dividirEmParcelas(total, n);
    if (!valores.length) {
      previewParcelas.innerHTML = '<li><small>O valor total é baixo demais para ' + n + ' parcelas (mínimo R$ 0,01 por parcela).</small></li>';
      return;
    }
    previewParcelas.innerHTML = valores.map(function (v, i) {
      var venc = somarDias(fPrimeiroVenc.value, i * intervalo);
      return '<li><small>Parcela ' + (i + 1) + '/' + n + (venc ? ' — ' + dataFmtBr(venc) : '') + '</small><strong>' + fmtMoeda(v) + '</strong></li>';
    }).join('');
  }

  criarLinhaItem();
  alternarBlocoPagamento();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    limparMsg();

    var itens = linhasItens().map(function (tr) {
      var nomeProduto = tr.querySelector('.item-produto').value.trim();
      return {
        produto_id: produtosPorNome[nomeProduto] || null,
        descricao: tr.querySelector('.item-descricao').value.trim(),
        quantidade: Number(tr.querySelector('.item-quantidade').value),
        unidade: tr.querySelector('.item-unidade').value.trim(),
        preco_unit: Number(tr.querySelector('.item-preco').value),
        desconto: Number(tr.querySelector('.item-desconto').value) || 0,
      };
    }).filter(function (i) { return i.descricao || i.quantidade || i.preco_unit; });

    if (!fFornecedor.value) { mostrarMsg('Selecione um fornecedor.', 'erro'); fFornecedor.focus(); return; }
    if (!fDataCompra.value) { mostrarMsg('Informe a data da compra.', 'erro'); fDataCompra.focus(); return; }
    if (!itens.length) { mostrarMsg('Adicione ao menos um item.', 'erro'); return; }
    for (var i = 0; i < itens.length; i++) {
      if (!itens[i].descricao) { mostrarMsg('Todo item precisa de uma descrição.', 'erro'); return; }
      if (!(itens[i].quantidade > 0)) { mostrarMsg('Quantidade do item deve ser maior que zero.', 'erro'); return; }
      if (!(itens[i].preco_unit >= 0)) { mostrarMsg('Preço unitário inválido.', 'erro'); return; }
    }
    var idsProdutos = itens.map(function (i) { return i.produto_id; }).filter(Boolean);
    if (new Set(idsProdutos).size !== idsProdutos.length) {
      mostrarMsg('Um mesmo produto do catálogo foi adicionado mais de uma vez — ajuste a quantidade em vez de repetir o item.', 'erro');
      return;
    }

    var payload = {
      fornecedor_id: Number(fFornecedor.value),
      data_compra: fDataCompra.value,
      itens: itens,
      desconto: Number(fDesconto.value) || 0,
      frete: Number(fFrete.value) || 0,
      impostos: Number(fImpostos.value) || 0,
      taxas: Number(fTaxas.value) || 0,
      forma_pagamento: fFormaPagamento.value,
      observacoes: fObservacoes.value.trim(),
    };
    if (formaParcelada()) {
      if (!fNumeroParcelas.value) { mostrarMsg('Informe o número de parcelas.', 'erro'); return; }
      if (!fPrimeiroVenc.value) { mostrarMsg('Informe o vencimento da 1ª parcela.', 'erro'); return; }
      payload.numero_parcelas = Number(fNumeroParcelas.value);
      payload.primeiro_vencimento = fPrimeiroVenc.value;
      payload.intervalo_dias = Number(fIntervaloDias.value) || 30;
    } else {
      if (!fVencimento.value) { mostrarMsg('Informe o vencimento da conta a pagar.', 'erro'); fVencimento.focus(); return; }
      payload.vencimento = fVencimento.value;
    }

    btnSalvar.disabled = true;
    btnSalvar.classList.add('is-carregando');
    var idempotencyKey = 'compra-' + Date.now() + '-' + Math.random().toString(36).slice(2);
    fetch('/api/admin/compras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken(), 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(payload),
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data.ok) {
          mostrarMsg(data.message || 'Não foi possível registrar a compra.', 'erro');
          btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
          return;
        }
        window.location.href = '/admin/compras/' + data.id;
      })
      .catch(function () {
        mostrarMsg('Erro de conexão. Tente novamente.', 'erro');
        btnSalvar.disabled = false; btnSalvar.classList.remove('is-carregando');
      });
  });
})();
