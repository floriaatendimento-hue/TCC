'use strict';

const Cupom = require('../models/Cupom');
const Endereco = require('../models/Endereco');
const Pedido = require('../models/Pedido');
const Produto = require('../models/Produto');
const IdempotenciaPedido = require('../models/IdempotenciaPedido');
const { resolverImagemUrl } = require('../helpers/imagemUrl');
const configCache = require('./cache/configCache');
const promocoesService = require('./promocoesService');
const pagamentoService = require('./pagamento');
const dinheiro = require('../helpers/dinheiro');

const CENTAVOS_MAX_PEDIDO = 9999999999n;

function slugDoLink(link) {
  if (!link || typeof link !== 'string') return null;
  const partes = link.split('/').filter(Boolean);
  return partes.length ? partes[partes.length - 1] : null;
}

function resolverEnderecoEntrega(enderecosUsuario, enderecoIdInformado) {
  if (enderecoIdInformado) {
    return enderecosUsuario.find((e) => e.id === Number(enderecoIdInformado)) || null;
  }
  return enderecosUsuario.find((e) => e.padrao) || enderecosUsuario[0];
}

async function resolverItensDoCarrinho(itens) {
  let subtotalCentavos = 0n;
  const itensBanco = [];
  const quantidadePorProduto = new Map();

  for (const item of itens) {
    const quantidade = parseInt(item.quantidade) || 1;
    const cor = item.cor ? String(item.cor).trim().slice(0, 60) : null;

    const slug = slugDoLink(item.link);
    const produto = slug ? await Produto.findBySlugOuPagina(slug) : null;

    if (!produto) {
      const erro = new Error('Um dos itens do carrinho não foi encontrado no catálogo. Remova-o e adicione o produto novamente.');
      erro.code = 'PRODUTO_INVALIDO';
      throw erro;
    }

    const resolvido = promocoesService.resolverPrecoProduto(produto);
    const preco_unit = resolvido.precoFinal;

    subtotalCentavos += dinheiro.multiplicar(quantidade, preco_unit);

    const acumulado = quantidadePorProduto.get(produto.id) || { quantidade: 0, estoque: Number(produto.estoque), nome: produto.nome };
    acumulado.quantidade += quantidade;
    quantidadePorProduto.set(produto.id, acumulado);

    itensBanco.push({
      produto_id:     produto.id,
      produto_nome:   produto.nome,
      produto_imagem: resolverImagemUrl(produto.imagem, null)?.slice(0, 255) ?? null,
      categoria_nome: produto.categoria_nome || null,
      quantidade,
      preco_unit,
      cor,
      promocao_id:     resolvido.origem === 'automatica' ? resolvido.promocaoId : null,
      promocao_nome:   resolvido.origem === 'automatica' ? resolvido.promocaoNome : null,
      preco_original:  resolvido.temPromocao ? resolvido.precoOriginal : null,
    });
  }

  for (const { quantidade, estoque, nome } of quantidadePorProduto.values()) {
    if (Number.isFinite(estoque) && quantidade > estoque) {
      const erro = new Error(`Estoque insuficiente para "${nome}" (disponível: ${Math.max(0, estoque)}).`);
      erro.code = 'ESTOQUE_INSUFICIENTE';
      throw erro;
    }
  }

  if (subtotalCentavos > CENTAVOS_MAX_PEDIDO) {
    const erro = new Error('O valor do carrinho excede o máximo permitido por pedido.');
    erro.code = 'TOTAL_INVALIDO';
    throw erro;
  }

  return { subtotal: dinheiro.paraReais(subtotalCentavos), itensBanco };
}

async function resolverCupom(codigoCupom, subtotal, frete) {
  if (!codigoCupom) return { cupomValidado: null, desconto: 0 };

  const cupomValidado = await Cupom.findValidoPorCodigo(String(codigoCupom).trim().toUpperCase());
  if (!cupomValidado) {
    const erro = new Error('O cupom aplicado não é mais válido. Remova-o e tente novamente.');
    erro.code = 'CUPOM_INVALIDO';
    throw erro;
  }
  if (cupomValidado.valor_minimo && subtotal < Number(cupomValidado.valor_minimo)) {
    const erro = new Error('O subtotal do carrinho não atinge mais o valor mínimo exigido pelo cupom.');
    erro.code = 'CUPOM_VALOR_MINIMO';
    throw erro;
  }
  return { cupomValidado, desconto: Cupom.calcularDesconto(cupomValidado, subtotal, frete) };
}

async function finalizarPedido({ usuarioId, usuarioEmail, itens, formaPagamento, enderecoId, cupom, parcelas, observacoes, dadosCartao, dadosMercadoPago, idempotencyKey }) {
  const enderecosUsuario = await Endereco.findByUsuario(usuarioId);
  if (enderecosUsuario.length === 0) {
    const erro = new Error('Para finalizar sua compra, é necessário cadastrar pelo menos um endereço de entrega.');
    erro.code = 'SEM_ENDERECO';
    throw erro;
  }

  const enderecoEntrega = resolverEnderecoEntrega(enderecosUsuario, enderecoId);
  if (!enderecoEntrega) {
    const erro = new Error('Endereço de entrega inválido.');
    erro.code = 'ENDERECO_INVALIDO';
    throw erro;
  }

  const ufsEntregaPermitidas = configCache.obterUfsEntregaPermitidas();
  if (ufsEntregaPermitidas.length && !ufsEntregaPermitidas.includes(String(enderecoEntrega.uf || '').toUpperCase())) {
    const erro = new Error('No momento, não realizamos entregas para este endereço.');
    erro.code = 'REGIAO_NAO_ATENDIDA';
    erro.detalhes = { ufsEntregaPermitidas };
    throw erro;
  }

  const { subtotal: subtotalCalculado, itensBanco } = await resolverItensDoCarrinho(itens);
  if (itensBanco.length === 0) {
    const erro = new Error('O carrinho não pode estar vazio.');
    erro.code = 'CARRINHO_VAZIO';
    throw erro;
  }

  const freteVal = 0;
  const { cupomValidado, desconto: descontoCupom } = await resolverCupom(cupom, subtotalCalculado, freteVal);

  const promoCarrinho = promocoesService.resolverCarrinho(subtotalCalculado);
  const descontoPromoCarrinho = promoCarrinho ? promoCarrinho.valorDesconto : 0;
  const descontoCentavos = dinheiro.paraCentavos(descontoCupom) + dinheiro.paraCentavos(descontoPromoCarrinho);
  const descontoVal = dinheiro.paraReais(descontoCentavos);

  const totalCentavosBruto = dinheiro.paraCentavos(subtotalCalculado) + dinheiro.paraCentavos(freteVal) - descontoCentavos;
  const totalCalculado = dinheiro.paraReais(totalCentavosBruto > 0n ? totalCentavosBruto : 0n);

  const resultadoPagamento = await pagamentoService.processar({
    forma_pagto: formaPagamento,
    dadosCartao,
    dadosMercadoPago,
    transactionAmount: totalCalculado,
    payerEmail: usuarioEmail,
    idempotencyKey,
  });
  if (!resultadoPagamento.aprovado) {
    const erro = new Error(resultadoPagamento.motivo || 'Pagamento recusado. Verifique os dados do cartão e tente novamente.');
    erro.code = 'PAGAMENTO_RECUSADO';
    throw erro;
  }

  const pedidoId = await Pedido.create({
    usuario_id: usuarioId,
    endereco_id: enderecoEntrega.id,
    endereco: enderecoEntrega,
    financeiro: {
      subtotal: subtotalCalculado,
      frete: freteVal,
      desconto: descontoVal,
      cupom: cupomValidado ? cupomValidado.codigo : null,
      cupom_id: cupomValidado ? cupomValidado.id : null,
      promocao_carrinho_id: promoCarrinho ? promoCarrinho.promocaoId : null,
      promocao_carrinho_nome: promoCarrinho ? promoCarrinho.promocaoNome : null,
      desconto_promocao_carrinho: descontoPromoCarrinho,
      total: totalCalculado,
      forma_pagto: formaPagamento || null,
      parcelas: formaPagamento === 'credito' ? (parcelas || 1) : 1,
      status_pagamento: resultadoPagamento.status_pagamento,
      pagamento_processa_em: resultadoPagamento.processaEm || null,
      pagamento_confirma_em: resultadoPagamento.confirmaEm || null,
      pagamento_expira_em: resultadoPagamento.expiraEm || null,
      pagamento_confirmado_em: resultadoPagamento.pagamentoConfirmadoEm || null,
      cartao_final: resultadoPagamento.cartaoFinal || null,
      cartao_bandeira: resultadoPagamento.cartaoBandeira || null,
      // real — ver checkoutService
      mercadopago_payment_id: resultadoPagamento.mercadoPagoPaymentId || null,
      mercadopago_external_reference: idempotencyKey || null,
    },
    itens: itensBanco,
    observacoes: observacoes || null,
  });

  return {
    pedidoId,
    statusPagamento: resultadoPagamento.status_pagamento,
    pontoDeInteracao: resultadoPagamento.pontoDeInteracao || null,
  };
}

async function finalizarPedidoIdempotente(dados, idempotencyKey) {
  if (!idempotencyKey) {
    const resultado = await finalizarPedido(dados);
    return { idempotente: false, ...resultado };
  }

  const reserva = await IdempotenciaPedido.reservar(idempotencyKey, dados.usuarioId);
  if (!reserva.novo) {
    if (reserva.registro.status === 'concluido') {
      return { idempotente: true, ...JSON.parse(reserva.registro.resposta_json) };
    }
    const erro = new Error('Esta operação já está sendo processada. Aguarde antes de tentar novamente.');
    erro.code = 'IDEMPOTENCIA_EM_ANDAMENTO';
    throw erro;
  }

  try {
    const resultado = await finalizarPedido({ ...dados, idempotencyKey });
    await IdempotenciaPedido.concluir(idempotencyKey, dados.usuarioId, { pedidoId: resultado.pedidoId, resposta: resultado });
    return { idempotente: false, ...resultado };
  } catch (err) {
    await IdempotenciaPedido.liberar(idempotencyKey, dados.usuarioId).catch((erroLiberar) => {
      console.error('[checkout] falha ao liberar chave de idempotência:', erroLiberar.message);
    });
    throw err;
  }
}

module.exports = { finalizarPedido, finalizarPedidoIdempotente };
