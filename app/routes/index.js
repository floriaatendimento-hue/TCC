'use strict';

const express = require('express');
const router = express.Router();

router.use(require('./admin/dashboard'));
router.use(require('./admin/produtos'));
router.use(require('./admin/categorias'));
router.use(require('./admin/clientes'));
router.use(require('./admin/cupons'));
router.use(require('./admin/promocoes'));
router.use(require('./admin/banners'));
router.use(require('./admin/avaliacoes'));
router.use(require('./admin/financeiro'));
router.use(require('./admin/configuracoes'));
router.use(require('./admin/usuarios'));
router.use(require('./admin/logs'));
router.use(require('./admin/pedidos'));
router.use(require('./admin/fornecedores'));
router.use(require('./admin/compras'));
router.use(require('./admin/contas-pagar'));

router.use(require('./public/home'));
router.use(require('./public/institucional'));
router.use(require('./public/carrinho'));
router.use(require('./public/pedidos'));
router.use(require('./public/auth'));
router.use(require('./public/conta'));
router.use(require('./public/comentarios'));
router.use(require('./public/acessibilidade'));

router.use(require('./public/produtos'));

module.exports = router;
