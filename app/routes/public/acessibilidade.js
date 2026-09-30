'use strict';

const express = require('express');
const router = express.Router();

const acessibilidadeController = require('../../controllers/public/acessibilidadeController');
const { validarPreferenciasAcessibilidade, validarCampoUnicoAcessibilidade } = require('../../validators');
const { exigeLoginApi } = require('../../middlewares/auth');

router.get('/api/acessibilidade', exigeLoginApi, acessibilidadeController.obter);
router.put('/api/acessibilidade', exigeLoginApi, validarPreferenciasAcessibilidade, acessibilidadeController.salvar);
router.patch('/api/acessibilidade/:campo', exigeLoginApi, validarCampoUnicoAcessibilidade, acessibilidadeController.salvarCampo);
router.post('/api/acessibilidade/restaurar', exigeLoginApi, acessibilidadeController.restaurar);

module.exports = router;
