'use strict';

const express = require('express');
const router = express.Router();

const fornecedoresController = require('../../controllers/admin/fornecedoresController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarFornecedor, validarStatusFornecedor } = require('../../validators');

router.get('/admin/fornecedores', exigeLogin, exigeAdmin, fornecedoresController.pagina);
router.get('/admin/fornecedores/novo', exigeLogin, exigeAdmin, fornecedoresController.telaNovo);
router.get('/admin/fornecedores/:id/editar', exigeLogin, exigeAdmin, validarParamId, fornecedoresController.telaEditar);
router.get('/admin/fornecedores/:id', exigeLogin, exigeAdmin, validarParamId, fornecedoresController.detalhes);

router.post('/api/admin/fornecedores', exigeLoginApi, exigeAdminApi, validarFornecedor, fornecedoresController.criar);
router.put('/api/admin/fornecedores/:id', exigeLoginApi, exigeAdminApi, validarParamId, validarFornecedor, fornecedoresController.atualizar);
router.patch('/api/admin/fornecedores/:id/status', exigeLoginApi, exigeAdminApi, validarParamId, validarStatusFornecedor, fornecedoresController.definirStatus);
router.delete('/api/admin/fornecedores/:id', exigeLoginApi, exigeAdminApi, validarParamId, fornecedoresController.excluir);

module.exports = router;
