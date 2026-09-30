'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const mercadoPagoController = require('../../controllers/webhooks/mercadoPagoController');

const webhookLimiter = rateLimit({
  windowMs: parseInt(process.env.MP_WEBHOOK_JANELA_MINUTOS || '1', 10) * 60 * 1000,
  max: parseInt(process.env.MP_WEBHOOK_MAX_REQUISICOES || '120', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false },
});

router.post('/api/webhooks/mercadopago', webhookLimiter, mercadoPagoController.processar);

module.exports = router;
