'use strict';

const express = require('express');
const router = express.Router();

const contasPagarController = require('../../controllers/admin/contasPagarController');
const comprasController = require('../../controllers/admin/comprasController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarContaAvulsa } = require('../../validators');

router.get('/admin/contas-pagar', exigeLogin, exigeAdmin, contasPagarController.pagina);
router.get('/admin/contas-pagar/nova', exigeLogin, exigeAdmin, contasPagarController.telaNovaAvulsa);

router.post('/api/admin/contas-pagar', exigeLoginApi, exigeAdminApi, validarContaAvulsa, comprasController.criarContaAvulsa);

module.exports = router;
