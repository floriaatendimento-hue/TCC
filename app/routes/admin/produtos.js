'use strict';

const express = require('express');
const router = express.Router();

const produtosController = require('../../controllers/admin/produtosController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarMovimentacaoEstoque } = require('../../validators');

router.get('/admin/produtos', exigeLogin, exigeAdmin, produtosController.pagina);
router.get('/admin/produtos/novo', exigeLogin, exigeAdmin, produtosController.telaNovo);
router.get('/admin/produtos/:id/editar', exigeLogin, exigeAdmin, validarParamId, produtosController.telaEditar);

router.get('/estoque', exigeLogin, exigeAdmin, produtosController.paginaEstoque);
router.get('/admin/estoque/movimentacao/nova', exigeLogin, exigeAdmin, produtosController.telaNovaMovimentacao);
router.get('/api/admin/estoque/movimentacoes', exigeLoginApi, exigeAdminApi, produtosController.historicoMovimentacoes);
router.post('/api/admin/estoque/movimentacao', exigeLoginApi, exigeAdminApi, validarMovimentacaoEstoque, produtosController.registrarMovimentacao);

router.get('/api/admin/produtos', exigeLoginApi, exigeAdminApi, produtosController.listarTodos);

module.exports = router;
