'use strict';

const cartao = require('./cartao');
const pix = require('./pix');
const boleto = require('./boleto');
const mpClient = require('../mercadopago/client');
const mpPaymentsService = require('../mercadopago/paymentsService');

const METODOS_VALIDOS = ['credito', 'debito', 'pix', 'boleto'];

const MP_PAYMENT_METHOD_ID_POR_FORMA = { pix: 'pix', boleto: 'bolbradesco' };

async function processarMercadoPago({ forma_pagto, dadosMercadoPago, transactionAmount, payerEmail, idempotencyKey, agora }) {
  if (!dadosMercadoPago) {
    const erro = new Error('Dados de pagamento do Mercado Pago ausentes.');
    erro.code = 'MERCADOPAGO_TOKEN_INVALIDO';
    throw erro;
  }

  const payer = {
    email: payerEmail,
    identification: dadosMercadoPago.payer?.identification || undefined,
  };

  const resultado = await mpPaymentsService.criarPagamento({
    transactionAmount,
    token: dadosMercadoPago.token || null,
    paymentMethodId: dadosMercadoPago.paymentMethodId || MP_PAYMENT_METHOD_ID_POR_FORMA[forma_pagto],
    installments: dadosMercadoPago.installments,
    issuerId: dadosMercadoPago.issuerId,
    payer,
    externalReference: idempotencyKey || null,
    idempotencyKey,
  });

  if (resultado.statusInterno === 'recusado') {
    return {
      aprovado: false,
      status_pagamento: 'recusado',
      motivo: 'Pagamento recusado pelo Mercado Pago. Verifique os dados e tente novamente.',
      cartaoFinal: resultado.cartaoFinal,
      cartaoBandeira: resultado.cartaoBandeira,
      mercadoPagoPaymentId: resultado.mercadoPagoPaymentId,
    };
  }

  const statusPagamento = resultado.statusInterno || 'pendente';
  if (!resultado.statusInterno) {
    console.error(`[mercadopago] status desconhecido "${resultado.status}" no pagamento ${resultado.mercadoPagoPaymentId} — tratado como pendente`);
  }

  return {
    aprovado: true,
    status_pagamento: statusPagamento,
    cartaoFinal: resultado.cartaoFinal,
    cartaoBandeira: resultado.cartaoBandeira,
    mercadoPagoPaymentId: resultado.mercadoPagoPaymentId,
    pagamentoConfirmadoEm: statusPagamento === 'aprovado' ? agora : null,
    pontoDeInteracao: resultado.pontoDeInteracao,
  };
}

async function processar({ forma_pagto, dadosCartao, dadosMercadoPago, transactionAmount, payerEmail, idempotencyKey, agora = new Date() }) {
  if (!METODOS_VALIDOS.includes(forma_pagto)) {
    throw new Error(`Forma de pagamento não suportada: ${forma_pagto}`);
  }

  if (mpClient.ativo()) {
    return processarMercadoPago({ forma_pagto, dadosMercadoPago, transactionAmount, payerEmail, idempotencyKey, agora });
  }

  if (forma_pagto === 'credito' || forma_pagto === 'debito') {
    const resultado = cartao.autorizar({ numero: dadosCartao.numero });
    if (!resultado.aprovado) {
      return {
        aprovado: false,
        status_pagamento: 'recusado',
        motivo: resultado.motivo,
        cartaoFinal: resultado.final,
        cartaoBandeira: resultado.bandeira,
      };
    }
    return {
      aprovado: true,
      status_pagamento: 'aprovado',
      cartaoFinal: resultado.final,
      cartaoBandeira: resultado.bandeira,
      pagamentoConfirmadoEm: agora,
    };
  }

  if (forma_pagto === 'pix') {
    return { aprovado: true, status_pagamento: 'pendente', ...pix.calcularJanela(agora) };
  }

  // boleto
  return { aprovado: true, status_pagamento: 'pendente', ...boleto.calcularJanela(agora) };
}

module.exports = { processar, cartao, pix, boleto, METODOS_VALIDOS };
