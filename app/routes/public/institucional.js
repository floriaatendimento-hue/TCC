'use strict';

const express = require('express');
const router = express.Router();

const institucionalController = require('../../controllers/public/institucionalController');
const { validarSuporte } = require('../../validators');

router.get('/maisvendidos', institucionalController.maisVendidos);
router.get('/sobre-nos', institucionalController.sobreNos);
router.get('/termos-de-uso', institucionalController.termosDeUso);
router.get('/politica-de-privacidade', institucionalController.politicaPrivacidade);
router.get('/politica-de-cookies', institucionalController.politicaCookies);
router.get('/suporte', institucionalController.suporte);
router.post('/api/suporte', validarSuporte, institucionalController.enviarSuporte);

module.exports = router;
