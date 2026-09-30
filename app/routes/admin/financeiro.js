'use strict';

const express = require('express');
const router = express.Router();

const financeiroController = require('../../controllers/admin/financeiroController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');

router.get('/admin/relatorios', exigeLogin, exigeAdmin, financeiroController.paginaFinanceiro);
router.get('/admin/relatorios/financeiro/pdf', exigeLogin, exigeAdmin, financeiroController.pdfFinanceiro);
router.get('/admin/relatorios/pdf', exigeLogin, exigeAdmin, financeiroController.pdfRelatorio);
router.get('/admin/relatorios/geral', exigeLogin, exigeAdmin, financeiroController.paginaRelatorioGeral);
router.get('/admin/relatorios/geral/pdf', exigeLogin, exigeAdmin, financeiroController.pdfRelatorioGeral);

module.exports = router;
