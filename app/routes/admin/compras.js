'use strict';

const express = require('express');
const router = express.Router();

const comprasController = require('../../controllers/admin/comprasController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const {
  validarParamId, validarParamContaId, validarParamPagamentoId,
  validarCompra, validarCancelamentoCompra, validarPagamentoFornecedor,
} = require('../../validators');

router.get('/admin/compras', exigeLogin, exigeAdmin, comprasController.pagina);
router.get('/admin/compras/nova', exigeLogin, exigeAdmin, comprasController.telaNova);
router.get('/admin/compras/:id', exigeLogin, exigeAdmin, validarParamId, comprasController.detalhes);

router.post('/api/admin/compras', exigeLoginApi, exigeAdminApi, validarCompra, comprasController.criar);
router.patch('/api/admin/compras/:id/cancelar', exigeLoginApi, exigeAdminApi, validarParamId, validarCancelamentoCompra, comprasController.cancelar);

router.post('/api/admin/contas-pagar/:contaId/pagamentos', exigeLoginApi, exigeAdminApi, validarParamContaId, validarPagamentoFornecedor, comprasController.registrarPagamento);
router.patch('/api/admin/pagamentos-fornecedor/:pagamentoId/estornar', exigeLoginApi, exigeAdminApi, validarParamPagamentoId, comprasController.estornarPagamento);

module.exports = router;
