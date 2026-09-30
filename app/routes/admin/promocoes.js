'use strict';

const express = require('express');
const router = express.Router();

const promocoesController = require('../../controllers/admin/promocoesController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarPromocao } = require('../../validators');

router.get('/admin/promocoes', exigeLogin, exigeAdmin, promocoesController.pagina);
router.get('/admin/promocoes/nova', exigeLogin, exigeAdmin, promocoesController.telaNova);
router.get('/admin/promocoes/:id/editar', exigeLogin, exigeAdmin, validarParamId, promocoesController.telaEditar);

router.post('/api/admin/promocoes', exigeLoginApi, exigeAdminApi, validarPromocao, promocoesController.criar);
router.put('/api/admin/promocoes/:id', exigeLoginApi, exigeAdminApi, validarParamId, validarPromocao, promocoesController.atualizar);
router.patch('/api/admin/promocoes/:id/ativo', exigeLoginApi, exigeAdminApi, validarParamId, promocoesController.alternarAtivo);
router.delete('/api/admin/promocoes/:id', exigeLoginApi, exigeAdminApi, validarParamId, promocoesController.excluir);

module.exports = router;
