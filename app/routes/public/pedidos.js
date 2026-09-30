'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const pedidosController = require('../../controllers/public/pedidosController');
const { validarParamId, validarEnviarComprovanteEmail, validarCancelamentoPedido } = require('../../validators');
const { exigeLogin, exigeLoginApi } = require('../../middlewares/auth');

const comprovanteEmailLimiter = rateLimit({
  windowMs: parseInt(process.env.COMPROVANTE_EMAIL_JANELA_MINUTOS || '60', 10) * 60 * 1000,
  max: parseInt(process.env.COMPROVANTE_EMAIL_MAX_TENTATIVAS || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Muitas tentativas de envio de comprovante por e-mail. Tente novamente mais tarde.' },
});

router.get('/pedido/:id', exigeLogin, validarParamId, pedidosController.detalhes);
router.get('/pedido/:id/pagamento', exigeLogin, validarParamId, pedidosController.paginaPagamento);
router.get('/api/pedidos/:id/status-pagamento', exigeLoginApi, validarParamId, pedidosController.statusPagamento);

router.get('/pedido/:id/comprovante', exigeLogin, validarParamId, pedidosController.paginaComprovante);
router.get('/pedido/:id/comprovante/pdf', exigeLogin, validarParamId, pedidosController.pdfComprovante);
router.post('/api/pedidos/:id/comprovante/email', exigeLoginApi, comprovanteEmailLimiter, validarParamId, validarEnviarComprovanteEmail, pedidosController.enviarComprovantePorEmail);

router.get('/api/pedidos/:id', exigeLoginApi, validarParamId, pedidosController.obterPedido);
router.patch('/api/pedidos/:id/cancelar', exigeLoginApi, validarParamId, validarCancelamentoPedido, pedidosController.cancelar);

router.get('/api/meus-pedidos', exigeLoginApi, pedidosController.meusPedidos);

module.exports = router;
