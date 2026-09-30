'use strict';

const express = require('express');
const router = express.Router();

const cuponsController = require('../../controllers/admin/cuponsController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarCupom } = require('../../validators');

router.get('/admin/cupons', exigeLogin, exigeAdmin, cuponsController.redirecionarParaPromocoes);
router.get('/admin/cupons/novo', exigeLogin, exigeAdmin, cuponsController.telaNovo);
router.get('/admin/cupons/:id/editar', exigeLogin, exigeAdmin, validarParamId, cuponsController.telaEditar);

router.post('/api/admin/cupons', exigeLoginApi, exigeAdminApi, validarCupom, cuponsController.criar);
router.put('/api/admin/cupons/:id', exigeLoginApi, exigeAdminApi, validarParamId, validarCupom, cuponsController.atualizar);
router.patch('/api/admin/cupons/:id/ativo', exigeLoginApi, exigeAdminApi, validarParamId, cuponsController.alternarAtivo);
router.delete('/api/admin/cupons/:id', exigeLoginApi, exigeAdminApi, validarParamId, cuponsController.excluir);
router.get('/api/admin/cupons/:id/pedidos', exigeLoginApi, exigeAdminApi, validarParamId, cuponsController.pedidosQueUsaram);

module.exports = router;
