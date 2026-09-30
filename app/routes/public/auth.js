'use strict';

const express = require('express');
const router = express.Router();

const authController = require('../../controllers/public/authController');
const { validarLogin, validarCadastro, validarSolicitarRecuperacaoSenha, validarVerificarOtp, validarRedefinirSenha } = require('../../validators');
const { somenteLogado } = require('../../middlewares/auth');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

router.get('/login',    somenteLogado, authController.telaLogin);
router.get('/cadastro', somenteLogado, authController.telaCadastro);
router.get('/login2',   authController.redirecionarLogin2);

router.post('/api/login',    validarLogin,    authController.login);
router.post('/api/cadastro', validarCadastro, authController.cadastro);
router.post('/api/logout',   authController.logout);
router.get('/logout',        authController.logoutGet);

router.post('/api/recuperar-senha',   validarSolicitarRecuperacaoSenha, authController.solicitarRecuperacaoSenha);
router.post('/api/reenviar-codigo',   authController.reenviarCodigo);
router.get('/verificar-codigo',       authController.telaVerificarCodigo);
router.post('/api/verificar-otp',     validarVerificarOtp,              authController.verificarOtp);
router.get('/redefinir-senha',        authController.telaRedefinirSenha);
router.post('/api/redefinir-senha',   validarRedefinirSenha,            authController.redefinirSenha);

module.exports = router;
