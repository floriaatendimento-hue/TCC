'use strict';

const express = require('express');
const router = express.Router();

const bannersController = require('../../controllers/admin/bannersController');
const { exigeLogin, exigeAdmin, exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { validarParamId, validarBanner, validarReordenarBanners } = require('../../validators');
const { uploadImagemBanner } = require('../../middlewares/uploadBanners');

router.get('/admin/banners', exigeLogin, exigeAdmin, bannersController.pagina);
router.get('/admin/banners/novo', exigeLogin, exigeAdmin, bannersController.telaNovo);
router.get('/admin/banners/:id/editar', exigeLogin, exigeAdmin, validarParamId, bannersController.telaEditar);

function exigeImagemBanner(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ ok: false, message: 'Selecione uma imagem para o banner.' });
  }
  next();
}

router.post('/api/admin/banners', exigeLoginApi, exigeAdminApi, uploadImagemBanner, exigeImagemBanner, validarBanner, bannersController.criar);
router.put('/api/admin/banners/:id', exigeLoginApi, exigeAdminApi, validarParamId, uploadImagemBanner, validarBanner, bannersController.atualizar);
router.patch('/api/admin/banners/:id/ativo', exigeLoginApi, exigeAdminApi, validarParamId, bannersController.alternarAtivo);
router.patch('/api/admin/banners/:id/mover', exigeLoginApi, exigeAdminApi, validarParamId, bannersController.mover);
router.patch('/api/admin/banners/reordenar', exigeLoginApi, exigeAdminApi, validarReordenarBanners, bannersController.reordenar);
router.post('/api/admin/banners/:id/duplicar', exigeLoginApi, exigeAdminApi, validarParamId, bannersController.duplicar);
router.delete('/api/admin/banners/:id', exigeLoginApi, exigeAdminApi, validarParamId, bannersController.excluir);

module.exports = router;
