'use strict';

const express = require('express');
const router = express.Router();

const clientesController = require('../../controllers/admin/clientesController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarNotaInterna, validarNivelCliente } = require('../../validators');

router.get('/admin/clientes', exigeLogin, exigeAdmin, clientesController.pagina);
router.patch('/api/admin/clientes/:id/ativo', exigeLoginApi, exigeAdminApi, validarParamId, clientesController.alternarAtivo);
router.get('/admin/clientes/:id', exigeLogin, exigeAdmin, validarParamId, clientesController.detalhes);
router.post('/api/admin/clientes/:id/notas', exigeLoginApi, exigeAdminApi, validarParamId, validarNotaInterna, clientesController.criarNota);

router.get('/admin/niveis', exigeLogin, exigeAdmin, clientesController.paginaNiveis);
router.get('/admin/niveis/novo', exigeLogin, exigeAdmin, clientesController.telaNovoNivel);
router.get('/admin/niveis/:id/editar', exigeLogin, exigeAdmin, validarParamId, clientesController.telaEditarNivel);
router.get('/api/admin/niveis', exigeLoginApi, exigeAdminApi, clientesController.listarNiveis);
router.post('/api/admin/niveis', exigeLoginApi, exigeAdminApi, validarNivelCliente, clientesController.criarNivel);
router.put('/api/admin/niveis/:id', exigeLoginApi, exigeAdminApi, validarParamId, validarNivelCliente, clientesController.atualizarNivel);
router.patch('/api/admin/niveis/reordenar-por-valor', exigeLoginApi, exigeAdminApi, clientesController.reordenarNiveisPorValor);
router.patch('/api/admin/niveis/:id/ativo', exigeLoginApi, exigeAdminApi, validarParamId, clientesController.alternarAtivoNivel);
router.patch('/api/admin/niveis/:id/mover', exigeLoginApi, exigeAdminApi, validarParamId, clientesController.moverNivel);
router.get('/api/admin/niveis/:id/impacto', exigeLoginApi, exigeAdminApi, validarParamId, clientesController.impactoRemocaoNivel);
router.delete('/api/admin/niveis/:id', exigeLoginApi, exigeAdminApi, validarParamId, clientesController.excluirNivel);

module.exports = router;
