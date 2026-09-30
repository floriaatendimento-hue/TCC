'use strict';

const express = require('express');
const router = express.Router();

const usuariosController = require('../../controllers/admin/usuariosController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId } = require('../../validators');

router.get('/admin/usuarios', exigeLogin, exigeAdmin, usuariosController.pagina);
router.get('/api/admin/usuarios/buscar-clientes', exigeLoginApi, exigeAdminApi, usuariosController.buscarClientes);
router.patch('/api/admin/usuarios/:id/promover', exigeLoginApi, exigeAdminApi, validarParamId, usuariosController.promover);
router.patch('/api/admin/usuarios/:id/rebaixar', exigeLoginApi, exigeAdminApi, validarParamId, usuariosController.rebaixar);

router.get('/api/usuarios', exigeLoginApi, exigeAdminApi, usuariosController.listar);

module.exports = router;
