'use strict';

const express = require('express');
const router = express.Router();

const avaliacoesController = require('../../controllers/admin/avaliacoesController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarRespostaAvaliacao } = require('../../validators');

router.get('/admin/avaliacoes', exigeLogin, exigeAdmin, avaliacoesController.pagina);

router.post('/api/admin/avaliacoes/:id/responder', exigeLoginApi, exigeAdminApi, validarParamId, validarRespostaAvaliacao, avaliacoesController.responder);
router.delete('/api/admin/avaliacoes/:id/resposta', exigeLoginApi, exigeAdminApi, validarParamId, avaliacoesController.removerResposta);
router.delete('/api/admin/avaliacoes/:id', exigeLoginApi, exigeAdminApi, validarParamId, avaliacoesController.excluir);
router.patch('/api/admin/avaliacoes/:id/status', exigeLoginApi, exigeAdminApi, validarParamId, avaliacoesController.atualizarStatus);

router.patch('/api/admin/avaliacoes/midia/:id/ocultar', exigeLoginApi, exigeAdminApi, validarParamId, avaliacoesController.ocultarMidia);
router.delete('/api/admin/avaliacoes/midia/:id', exigeLoginApi, exigeAdminApi, validarParamId, avaliacoesController.excluirMidia);

module.exports = router;
