'use strict';

const express = require('express');
const router = express.Router();

const carrinhoController = require('../../controllers/public/carrinhoController');
const { validarAplicarCupom, validarCalcularFrete, validarFinalizarPedido } = require('../../validators');
const { exigeLoginApi } = require('../../middlewares/auth');

router.post('/api/cupons/validar', validarAplicarCupom, carrinhoController.validarCupom);
router.post('/api/frete/calcular', validarCalcularFrete, carrinhoController.calcularFrete);
router.get('/api/pagamento/config', carrinhoController.configPagamento);

router.get('/presentear', carrinhoController.paginaPresentear);
router.get('/carrinho',   carrinhoController.paginaCarrinho);
router.get('/pagamento',  carrinhoController.exigirLoginParaPagamento, carrinhoController.paginaPagamento);
router.get('/detalhes',   carrinhoController.paginaDetalhes);
router.get('/detalhesv',  carrinhoController.paginaDetalhesV);

router.post('/api/pedidos/finalizar', exigeLoginApi, validarFinalizarPedido, carrinhoController.finalizarPedido);

module.exports = router;
