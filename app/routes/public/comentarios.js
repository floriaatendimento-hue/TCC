'use strict';

const express = require('express');
const router = express.Router();

const comentariosController = require('../../controllers/public/comentariosController');
const { validarComentario, validarParamId } = require('../../validators');
const { exigeLoginApi } = require('../../middlewares/auth');

router.get('/api/comentarios/:slug', comentariosController.listarPorProduto);

router.post(
  '/api/comentarios/:slug',
  exigeLoginApi,
  comentariosController.uploadMidiaAvaliacao,
  validarComentario,
  comentariosController.salvar
);

router.delete('/api/comentarios/:id', exigeLoginApi, validarParamId, comentariosController.excluir);

module.exports = router;
