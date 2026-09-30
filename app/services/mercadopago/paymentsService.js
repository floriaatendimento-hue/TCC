'use strict';

const { Payment, MercadoPagoError } = require('mercadopago');
const mpClient = require('./client');
const statusMap = require('./statusMap');

function traduzirErro(err) {
  if (err instanceof MercadoPagoError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      const erro = new Error('Falha de credenciais na integração com o Mercado Pago.');
      erro.code = 'MERCADOPAGO_CREDENCIAL_INVALIDA';
      return erro;
    }
    if (status === 400 || status === 422) {
      const erro = new Error('Dados de pagamento inválidos ou expirados. Tente novamente.');
      erro.code = 'MERCADOPAGO_TOKEN_INVALIDO';
      return erro;
    }
    const erro = new Error('O Mercado Pago está indisponível no momento. Tente novamente em instantes.');
    erro.code = 'MERCADOPAGO_INDISPONIVEL';
    return erro;
  }
  const erro = new Error('Não foi possível processar o pagamento. Tente novamente.');
  erro.code = 'MERCADOPAGO_INDISPONIVEL';
  return erro;
}

async function criarPagamento({
  transactionAmount, token, paymentMethodId, installments, issuerId, payer,
  externalReference, description, idempotencyKey,
}) {
  const payment = new Payment(mpClient.obterConfig());
  try {
    const resposta = await payment.create({
      body: {
        transaction_amount: transactionAmount,
        token: token || undefined,
        payment_method_id: paymentMethodId,
        installments: installments || 1,
        issuer_id: issuerId || undefined,
        payer,
        external_reference: externalReference || undefined,
        description: description || 'Pedido Floria',
        binary_mode: false,
      },
      requestOptions: idempotencyKey ? { idempotencyKey } : undefined,
    });

    return {
      mercadoPagoPaymentId: String(resposta.id),
      status: resposta.status,
      statusDetail: resposta.status_detail || null,
      statusInterno: statusMap.mapear(resposta.status),
      pontoDeInteracao: resposta.point_of_interaction || null,
      cartaoFinal: resposta.card?.last_four_digits || null,
      cartaoBandeira: resposta.payment_method_id || null,
    };
  } catch (err) {
    throw traduzirErro(err);
  }
}

async function consultarPagamento(mercadoPagoPaymentId) {
  const payment = new Payment(mpClient.obterConfig());
  try {
    const resposta = await payment.get({ id: mercadoPagoPaymentId });
    return {
      mercadoPagoPaymentId: String(resposta.id),
      status: resposta.status,
      statusDetail: resposta.status_detail || null,
      statusInterno: statusMap.mapear(resposta.status),
      externalReference: resposta.external_reference || null,
    };
  } catch (err) {
    throw traduzirErro(err);
  }
}

module.exports = { criarPagamento, consultarPagamento };
