'use strict';

const express = require('express');
const router = express.Router();

const logsController = require('../../controllers/admin/logsController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId } = require('../../validators');

router.get('/admin/logs', exigeLogin, exigeAdmin, logsController.pagina);
router.get('/admin/logs/:id/comprovante', exigeLogin, exigeAdmin, validarParamId, logsController.comprovante);
router.get('/admin/logs/exportar/:formato', exigeLogin, exigeAdmin, logsController.exportar);

module.exports = router;
