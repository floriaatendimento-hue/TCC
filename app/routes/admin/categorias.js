'use strict';

const express = require('express');
const router = express.Router();

const categoriasController = require('../../controllers/admin/categoriasController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarCategoria, validarSubcategoria } = require('../../validators');

router.get('/admin/categorias', exigeLogin, exigeAdmin, categoriasController.pagina);
router.get('/admin/categorias/novo', exigeLogin, exigeAdmin, categoriasController.telaNovaCategoria);
router.get('/admin/categorias/:id/editar', exigeLogin, exigeAdmin, validarParamId, categoriasController.telaEditarCategoria);

router.get('/api/admin/categorias', exigeLoginApi, exigeAdminApi, categoriasController.listar);
router.post('/api/admin/categorias', exigeLoginApi, exigeAdminApi, validarCategoria, categoriasController.criar);
router.put('/api/admin/categorias/:id', exigeLoginApi, exigeAdminApi, validarParamId, validarCategoria, categoriasController.atualizar);
router.patch('/api/admin/categorias/:id/ativa', exigeLoginApi, exigeAdminApi, validarParamId, categoriasController.alternarAtiva);
router.patch('/api/admin/categorias/:id/mover', exigeLoginApi, exigeAdminApi, validarParamId, categoriasController.mover);
router.delete('/api/admin/categorias/:id', exigeLoginApi, exigeAdminApi, validarParamId, categoriasController.excluir);

router.get('/admin/subcategorias/novo', exigeLogin, exigeAdmin, categoriasController.telaNovaSubcategoria);
router.get('/admin/subcategorias/:id/editar', exigeLogin, exigeAdmin, validarParamId, categoriasController.telaEditarSubcategoria);
router.get('/admin/subcategorias', exigeLogin, exigeAdmin, categoriasController.redirecionarSubcategorias);

router.get('/api/admin/subcategorias', exigeLoginApi, exigeAdminApi, categoriasController.listarSubcategorias);
router.post('/api/admin/subcategorias', exigeLoginApi, exigeAdminApi, validarSubcategoria, categoriasController.criarSubcategoria);
router.put('/api/admin/subcategorias/:id', exigeLoginApi, exigeAdminApi, validarParamId, validarSubcategoria, categoriasController.atualizarSubcategoria);
router.patch('/api/admin/subcategorias/:id/ativa', exigeLoginApi, exigeAdminApi, validarParamId, categoriasController.alternarAtivaSubcategoria);
router.patch('/api/admin/subcategorias/:id/mover', exigeLoginApi, exigeAdminApi, validarParamId, categoriasController.moverSubcategoria);
router.delete('/api/admin/subcategorias/:id', exigeLoginApi, exigeAdminApi, validarParamId, categoriasController.excluirSubcategoria);

module.exports = router;
