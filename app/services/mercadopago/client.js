'use strict';

const { MercadoPagoConfig } = require('mercadopago');
const mpConfig = require('../../../config/mercadoPago');

let configSdk = null;

function obterConfig() {
  if (!mpConfig.ativo) {
    throw new Error('Mercado Pago não está configurado (MP_ACCESS_TOKEN ausente) — use o Modo Preparação.');
  }
  if (!configSdk) {
    configSdk = new MercadoPagoConfig({
      accessToken: mpConfig.accessToken,
      options: {
        timeout: 8000,
        maxRetries: 2,
        retryOn: [429, 500, 502, 503, 504],
        initialDelay: 300,
        maxDelay: 3000,
        jitter: true,
      },
    });
  }
  return configSdk;
}

module.exports = { obterConfig, ativo: () => mpConfig.ativo };
