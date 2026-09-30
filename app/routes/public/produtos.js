'use strict';

const express = require('express');
const router = express.Router();

const produtosController = require('../../controllers/public/produtosController');
const {
  validarBuscaFiltrada, validarListagem, validarProduto, parsearCamposJsonProduto,
  exigeTresImagensProdutoNovo, validarParamId,
} = require('../../validators');
const { exigeLoginApi, exigeAdminApi } = require('../../middlewares/auth');
const { uploadImagensProduto } = require('../../middlewares/uploadProdutos');

router.get('/plantas', (req, res, next) => produtosController.paginaFixa(req, res, next, 'plantas', 'pages/produtos/plantas'));
router.get('/vasos',   (req, res, next) => produtosController.paginaFixa(req, res, next, 'vasos', 'pages/produtos/Vasos'));

['ferramentas', 'adubos', 'controle-pragas'].forEach((slug) => {
  router.get(`/${slug}`, (req, res, next) => produtosController.paginaCategoriaGenerica(req, res, next, slug));
});
router.get('/categoria/:slug', (req, res, next) => produtosController.paginaCategoriaGenerica(req, res, next, req.params.slug));

[...produtosController.PAGINAS_PRODUTO_PLANTAS, ...produtosController.PAGINAS_PRODUTO_VASOS].forEach((slug) => {
  router.get(`/${slug}`, async (req, res) => {
    if (await produtosController.tentarRenderizarProdutoDb(slug, res)) return;
    res.render(`pages/produtos/${slug}`);
  });
});

router.get('/produto/:slug', produtosController.paginaProdutoPorSlug);
router.get('/produto/:slug/guia.pdf', produtosController.guiaPdf);

router.get('/api/busca', produtosController.buscaDropdown);
router.get('/api/produtos/filtrar', validarBuscaFiltrada, produtosController.buscarFiltrado);

router.get('/api/produtos', validarListagem, produtosController.listar);
router.get('/api/produtos/destaque', produtosController.destaque);
router.get('/api/produtos/avaliacoes', produtosController.avaliacoesEmLote);
router.get('/api/produtos/:slug/relacionados', produtosController.relacionados);
router.get('/api/produtos/:slug/estoque', produtosController.estoque);
router.get('/api/produtos/:id', validarParamId, produtosController.obterPorId);

router.post('/api/produtos', exigeLoginApi, exigeAdminApi,
  uploadImagensProduto, exigeTresImagensProdutoNovo, parsearCamposJsonProduto, validarProduto,
  produtosController.criar);

router.put('/api/produtos/:id', exigeLoginApi, exigeAdminApi, validarParamId,
  uploadImagensProduto, parsearCamposJsonProduto, validarProduto,
  produtosController.atualizar);

router.patch('/api/produtos/:id/ativo', exigeLoginApi, exigeAdminApi, validarParamId, produtosController.alternarAtivo);
router.delete('/api/produtos/:id', exigeLoginApi, exigeAdminApi, validarParamId, produtosController.excluir);

router.get('/api/categorias', produtosController.listarCategorias);

// Aliases case-insensitive
router.get('/Plantas',        (req, res) => res.redirect('/plantas'));
router.get('/Vasos',          (req, res) => res.redirect('/vasos'));
router.get('/MaisVendidos',   (req, res) => res.redirect('/maisvendidos'));
router.get('/Ferramentas',    (req, res) => res.redirect('/ferramentas'));
router.get('/Adubos',         (req, res) => res.redirect('/adubos'));
router.get('/ControlePragas', (req, res) => res.redirect('/controle-pragas'));

router.get('/comigo-ninguem-pode', produtosController.aliasComigoNinguemPode);
router.get('/costela-de-adao',     produtosController.aliasCostelaDeAdao);
router.get('/vaso-autoirrigavel',  produtosController.aliasVasoAutoirrigavel);
router.get('/vaso-de-barro',       produtosController.aliasVasoDeBarro);

router.get('/:slugSolto', produtosController.slugSolto);

module.exports = router;
