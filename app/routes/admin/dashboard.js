'use strict';

const express = require('express');
const router = express.Router();

const dashboardController = require('../../controllers/admin/dashboardController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');

router.get('/admin', exigeLogin, exigeAdmin, dashboardController.pagina);
router.get('/api/admin/dashboard/evolucao', exigeLoginApi, exigeAdminApi, dashboardController.evolucao);
router.get('/api/admin/dashboard/trafego', exigeLoginApi, exigeAdminApi, dashboardController.trafego);
router.get('/api/admin/dashboard/atividade-clientes', exigeLoginApi, exigeAdminApi, dashboardController.atividadeClientes);
router.get('/api/admin/dashboard/alertas', exigeLoginApi, exigeAdminApi, dashboardController.alertas);

module.exports = router;
