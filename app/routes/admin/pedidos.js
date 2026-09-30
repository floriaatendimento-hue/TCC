'use strict';

const express = require('express');
const router = express.Router();

const pedidosController = require('../../controllers/admin/pedidosController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarStatusPedido, validarStatusPagamentoAdmin } = require('../../validators');

router.get('/pedidos', exigeLogin, exigeAdmin, pedidosController.pagina);
router.get('/pedidos/:id', exigeLogin, exigeAdmin, validarParamId, pedidosController.detalhes);

router.get('/api/pedidos', exigeLoginApi, exigeAdminApi, pedidosController.listar);
router.patch('/api/pedidos/:id/status', exigeLoginApi, exigeAdminApi, validarParamId, validarStatusPedido, pedidosController.atualizarStatus);
router.patch('/api/admin/pedidos/:id/pagamento', exigeLoginApi, exigeAdminApi, validarParamId, validarStatusPagamentoAdmin, pedidosController.atualizarStatusPagamento);

module.exports = router;
