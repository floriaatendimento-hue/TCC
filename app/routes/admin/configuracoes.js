'use strict';

const express = require('express');
const router = express.Router();

const configuracoesController = require('../../controllers/admin/configuracoesController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarConfiguracoes } = require('../../validators');

router.get('/admin/configuracoes', exigeLogin, exigeAdmin, configuracoesController.pagina);
router.put('/api/admin/configuracoes', exigeLoginApi, exigeAdminApi, validarConfiguracoes, configuracoesController.salvar);

module.exports = router;
