'use strict';

const express = require('express');
const router = express.Router();

const homeController = require('../../controllers/public/homeController');

router.get('/', homeController.paginaInicial);
router.get('/busca', homeController.buscar);

module.exports = router;
