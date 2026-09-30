'use strict';

const express = require('express');
const router = express.Router();

const contaController = require('../../controllers/public/contaController');
const { validarParamId, validarAlterarSenha, validarEndereco, validarEnderecoExistencia } = require('../../validators');
const { exigeLogin, exigeLoginApi } = require('../../middlewares/auth');

router.get('/perfil', exigeLogin, contaController.paginaPerfil);

router.get('/api/perfil', exigeLoginApi, contaController.obterPerfil);
router.get('/api/me', exigeLoginApi, contaController.quemSouEu);

router.get('/api/sessoes', exigeLoginApi, contaController.listarSessoes);
router.delete('/api/sessoes/:id', exigeLoginApi, validarParamId, contaController.revogarSessao);
router.post('/api/sessoes/revogar-outras', exigeLoginApi, contaController.revogarOutrasSessoes);

router.post('/api/perfil/foto', exigeLoginApi, contaController.atualizarFoto);
router.post('/api/perfil/senha', exigeLoginApi, validarAlterarSenha, contaController.alterarSenha);

router.get('/api/perfil/exportar-dados', exigeLogin, contaController.exportarDados);
router.post('/api/perfil/excluir-conta', exigeLoginApi, contaController.excluirConta);

router.get('/api/favoritos', exigeLoginApi, contaController.listarFavoritos);
router.get('/api/favoritos/slugs', contaController.listarSlugsFavoritos);
router.post('/api/favoritos/:slug', exigeLoginApi, contaController.adicionarFavorito);
router.delete('/api/favoritos/:slug', exigeLoginApi, contaController.removerFavorito);
router.get('/favoritos', exigeLogin, contaController.atalhoFavoritos);

router.get('/enderecos/novo', exigeLogin, contaController.paginaNovoEndereco);
router.get('/api/enderecos', exigeLoginApi, contaController.listarEnderecos);
router.post('/api/enderecos/verificar', exigeLoginApi, validarEnderecoExistencia, contaController.verificarEndereco);
router.post('/api/enderecos', exigeLoginApi, validarEndereco, contaController.criarEndereco);
router.put('/api/enderecos/:id', exigeLoginApi, validarParamId, validarEndereco, contaController.atualizarEndereco);
router.patch('/api/enderecos/:id/principal', exigeLoginApi, validarParamId, contaController.definirEnderecoPrincipal);
router.delete('/api/enderecos/:id', exigeLoginApi, validarParamId, contaController.removerEndereco);

module.exports = router;
