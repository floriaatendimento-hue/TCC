'use strict';

const { WebhookSignatureValidator, InvalidWebhookSignatureError, SignatureFailureReason } = require('mercadopago');
const mpConfig = require('../../../config/mercadoPago');

const TOLERANCIA_SEGUNDOS = 5 * 60;

function validarAssinatura(req) {
  if (!mpConfig.webhookSecret) {
    throw new InvalidWebhookSignatureError('MP_WEBHOOK_SECRET não configurado — assinatura não pode ser verificada.');
  }
  WebhookSignatureValidator.validate({
    xSignature: req.headers['x-signature'],
    xRequestId: req.headers['x-request-id'],
    dataId: req.query['data.id'],
    secret: mpConfig.webhookSecret,
    toleranceSeconds: TOLERANCIA_SEGUNDOS,
  });
}

module.exports = { validarAssinatura, InvalidWebhookSignatureError, SignatureFailureReason };
