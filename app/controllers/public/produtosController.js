'use strict';

const Produto = require('../../models/Produto');
const Categoria = require('../../models/Categoria');
const Subcategoria = require('../../models/Subcategoria');
const CategoriaAcesso = require('../../models/CategoriaAcesso');
const Comentario = require('../../models/Comentario');
const { montarProdutoView } = require('../../helpers/produtoView');
const { aplicarPrecoLista } = require('../../helpers/precoView');
const { respostaErro } = require('../../helpers/respostaErro');
const produtoService = require('../../services/produtoService');
const { gerarGuiaProdutoPdfBuffer, CATEGORIAS_PERMITIDAS: CATEGORIAS_GUIA_PDF } = require('../../services/pdf/produtoGuiaPdf');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

exports.paginaFixa = async (req, res, next, slug, view) => {
  try {
    const categoria = await Categoria.findBySlug(slug);
    if (!categoria || !categoria.ativa) return next();

    CategoriaAcesso.registrar(slug);
    const subcategoriaSlug = String(req.query.subcategoria || '').trim() || null;
    const [produtos, subcategorias, subcategoriasComProdutos] = await Promise.all([
      Produto.findByCategoria(slug, { limite: 100, subcategoriaSlug }),
      Subcategoria.findByCategoria(categoria.id, { somenteAtivas: true }),
      subcategoriaSlug ? Promise.resolve([]) : Produto.findAgrupadosPorSubcategoria(slug),
    ]);
    res.render(view, {
      produtos: aplicarPrecoLista(produtos),
      subcategorias,
      subcategoriaAtiva: subcategoriaSlug,
      subcategoriasComProdutos: subcategoriasComProdutos.map((g) => ({ ...g, produtos: aplicarPrecoLista(g.produtos) })),
    });
  } catch (err) {
    console.error(`Erro ao carregar "${slug}":`, err.message);
    res.render(view, { produtos: [], subcategorias: [], subcategoriaAtiva: null, subcategoriasComProdutos: [] });
  }
};

exports.paginaCategoriaGenerica = async (req, res, next, slug) => {
  try {
    const categoria = await Categoria.findBySlug(slug);
    if (!categoria || !categoria.ativa) return next();

    CategoriaAcesso.registrar(slug);
    const subcategoriaSlug = String(req.query.subcategoria || '').trim() || null;
    const [produtos, subcategorias, subcategoriasComProdutos] = await Promise.all([
      Produto.findByCategoria(slug, { limite: 100, subcategoriaSlug }),
      Subcategoria.findByCategoria(categoria.id, { somenteAtivas: true }),
      subcategoriaSlug ? Promise.resolve([]) : Produto.findAgrupadosPorSubcategoria(slug),
    ]);
    res.render('pages/produtos/Categoria', {
      categoria,
      produtos: aplicarPrecoLista(produtos),
      subcategorias,
      subcategoriaAtiva: subcategoriaSlug,
      subcategoriasComProdutos: subcategoriasComProdutos.map((g) => ({ ...g, produtos: aplicarPrecoLista(g.produtos) })),
    });
  } catch (err) {
    console.error(`Erro ao carregar categoria "${slug}":`, err.message);
    next(err);
  }
};

exports.tentarRenderizarProdutoDb = async (slug, res) => {
  const produto = await Produto.findBySlugOuPagina(slug).catch(() => null);
  if (!produto) return false;
  res.render('pages/produtos/ProdutoDinamico', { produto, pv: montarProdutoView(produto) });
  return true;
};

exports.renderizarProdutoDinamico = async (slug, res, next) => {
  try {
    const produto = await Produto.findBySlugOuPagina(slug);
    if (!produto) return next();
    return res.render('pages/produtos/ProdutoDinamico', { produto, pv: montarProdutoView(produto) });
  } catch (err) {
    return next();
  }
};

function normalizarSlug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '') // remove acentos
    .replace(/[^a-z0-9]/g, '');
}

const PAGINAS_PRODUTO_PLANTAS = [
  'orquidea', 'alecrim', 'babosa',     'cacto',      'costeladeadao',
  'espadadesaojorge',    'hortela',    'jasmim',     'lavanda',
  'manjericao',          'samambaia',  'singonio',   'zamioculca',
  'philodendron',
];
const PAGINAS_PRODUTO_VASOS = [
  'vaso-ceramica-rosa', 'vaso-cimento-rustico', 'vaso-suspenso-macrame',
  'vaso-vidro-transparente', 'vaso-concreto-geometrico', 'vaso-ceramica-azul',
  'vaso-barro-tradicional', 'vaso-barro-artesanal', 'vaso-esmaltado',
  'vaso-ceramica-decorado', 'vaso-geometrico', 'vaso-minimalista',
  'vaso-autoirrigavel-transparente',
];
const ALIASES_SLUG_BANCO = {
  'comigo-ninguem-pode': 'Detalhes',
  'costela-de-adao':     'costeladeadao',
  'vaso-autoirrigavel':  'vaso-autoirrigavel-transparente',
  'vaso-de-barro':       'vaso-barro-artesanal',
  'detalhes':            'Detalhes',
  'detalhesv':           'DetalhesV',
  'vaso-decorativo-marrom': 'DetalhesV',
};
const TODAS_PAGINAS_PRODUTO = [...PAGINAS_PRODUTO_PLANTAS, ...PAGINAS_PRODUTO_VASOS];

const MAPA_SLUG_NORMALIZADO = new Map();
TODAS_PAGINAS_PRODUTO.forEach((s) => MAPA_SLUG_NORMALIZADO.set(normalizarSlug(s), s));
Object.entries(ALIASES_SLUG_BANCO).forEach(([k, v]) => MAPA_SLUG_NORMALIZADO.set(normalizarSlug(k), v));

function resolverPaginaProduto(slugPedido) {
  return MAPA_SLUG_NORMALIZADO.get(normalizarSlug(slugPedido)) || null;
}

exports.PAGINAS_PRODUTO_PLANTAS = PAGINAS_PRODUTO_PLANTAS;
exports.PAGINAS_PRODUTO_VASOS = PAGINAS_PRODUTO_VASOS;
exports.resolverPaginaProduto = resolverPaginaProduto;

exports.paginaProdutoPorSlug = async (req, res, next) => {
  if (await exports.tentarRenderizarProdutoDb(req.params.slug, res)) return;
  const view = resolverPaginaProduto(req.params.slug);
  if (view) return res.render(`pages/produtos/${view}`);
  return next();
};

exports.guiaPdf = async (req, res) => {
  try {
    const produto = await Produto.findBySlugOuPagina(req.params.slug);
    if (!produto || !CATEGORIAS_GUIA_PDF.includes(produto.categoria_slug)) {
      return res.status(404).render('pages/404');
    }

    const pdfBuffer = await gerarGuiaProdutoPdfBuffer(produto);
    const baixar = ['1', 'true'].includes(String(req.query.baixar || '').toLowerCase());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${baixar ? 'attachment' : 'inline'}; filename="guia-${produto.slug}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[guia de utilização pdf]', err.message);
    res.status(500).send('Não foi possível gerar o guia agora. Tente novamente.');
  }
};

/* API — busca / listagem */

exports.buscaDropdown = async (req, res) => {
  const q = String(req.query.q || '').trim().slice(0, 100);
  const limite = Math.min(parseInt(req.query.limite) || 6, 12);
  if (!q || q.length < 2) return res.json({ ok: true, data: [], total: 0 });
  try {
    const data = aplicarPrecoLista(await Produto.search(q, limite));
    res.json({ ok: true, data, total: data.length });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.buscarFiltrado = async (req, res) => {
  try {
    const { q = '', categoria = '', petFriendly = false, poucaLuz = false, limite = 60 } = req.query;
    const data = aplicarPrecoLista(await Produto.buscarComFiltros({ q, categoria, petFriendly, poucaLuz, limite }));
    res.json({ ok: true, data, total: data.length });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.listar = async (req, res) => {
  try {
    const { categoria, limite = 50, pagina = 1 } = req.query;
    const offset = (pagina - 1) * limite;
    const produtos = categoria
      ? await Produto.findByCategoria(categoria, { limite: +limite, offset })
      : await Produto.findAll({ limite: +limite, offset });
    res.json({ ok: true, data: produtos });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.destaque = async (req, res) => {
  try {
    const produtos = await Produto.findDestaque(req.query.limite || 12);
    res.json({ ok: true, data: produtos });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.avaliacoesEmLote = async (req, res) => {
  try {
    const slugs = String(req.query.slugs || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 60);
    const data = await Comentario.mediaEmLote(slugs);
    res.json({ ok: true, data });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.relacionados = async (req, res) => {
  try {
    const limite = Math.min(parseInt(req.query.limite, 10) || 8, 12);
    const slugParam = req.params.slug;

    const produtoAtual = await Produto.findBySlugOuPagina(slugParam);
    const categoriaSlug = produtoAtual ? produtoAtual.categoria_slug : (req.query.categoria || null);
    const excluirSlug = produtoAtual ? produtoAtual.slug : slugParam;

    if (!categoriaSlug) return res.json({ ok: true, data: [] });

    const produtos = aplicarPrecoLista(await Produto.findRelacionados({ categoriaSlug, excluirSlug, limite }));
    res.json({ ok: true, data: produtos });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.estoque = async (req, res) => {
  try {
    const produto = await Produto.findBySlugOuPagina(req.params.slug);
    if (!produto) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
    res.json({ ok: true, estoque: produto.estoque, estoque_minimo: produto.estoque_minimo });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.obterPorId = async (req, res) => {
  try {
    const produto = await Produto.findById(req.params.id);
    if (!produto) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
    res.json({ ok: true, data: produto });
  } catch (err) {
    respostaErro(res, err);
  }
};

/* API — CRUD de produto */

exports.criar = async (req, res) => {
  try {
    const id = await produtoService.criarProduto(req.body, req.files);
    logAcao(req, 'produto.criar', `#${id} — ${req.body.nome}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    console.error('Erro ao criar produto:', err.message);
    respostaErro(res, err);
  }
};

exports.atualizar = async (req, res) => {
  try {
    const resultado = await produtoService.atualizarProduto(req.params.id, req.body, req.files);
    if (!resultado.ok) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });

    const diffProduto = diffCampos(resultado.produtoAntes, resultado.dados, ['nome', 'preco', 'preco_promo', 'estoque', 'estoque_minimo', 'sku', 'marca', 'ativo', 'destaque']);
    logAcao(req, 'produto.editar', `#${req.params.id} — ${req.body.nome}`, diffProduto.mudou ? { dadosAntes: diffProduto.antes, dadosDepois: diffProduto.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    console.error('Erro ao editar produto:', err.message);
    respostaErro(res, err);
  }
};

exports.alternarAtivo = async (req, res) => {
  try {
    const rows = await Produto.update(req.params.id, { ativo: !!req.body.ativo });
    if (!rows) return res.status(404).json({ ok: false, message: 'Produto não encontrado.' });
    logAcao(req, 'produto.alternar-status', `#${req.params.id} → ${req.body.ativo ? 'ativo' : 'inativo'}`, {
      dadosAntes: { ativo: !req.body.ativo },
      dadosDepois: { ativo: !!req.body.ativo },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao alternar status do produto.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    await Produto.delete(req.params.id);
    logAcao(req, 'produto.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    respostaErro(res, err);
  }
};

/* API — categorias */

exports.listarCategorias = async (req, res) => {
  try {
    const categorias = await Categoria.findAll();
    res.json({ ok: true, data: categorias });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.aliasComigoNinguemPode = async (req, res) => {
  if (await exports.tentarRenderizarProdutoDb('comigo-ninguem-pode', res)) return;
  res.render('pages/produtos/Detalhes');
};
exports.aliasCostelaDeAdao = async (req, res) => {
  if (await exports.tentarRenderizarProdutoDb('costela-de-adao', res)) return;
  res.render('pages/produtos/costeladeadao');
};
exports.aliasVasoAutoirrigavel = async (req, res) => {
  if (await exports.tentarRenderizarProdutoDb('vaso-autoirrigavel-transparente', res)) return;
  res.render('pages/produtos/vaso-autoirrigavel-transparente');
};
exports.aliasVasoDeBarro = async (req, res) => {
  if (await exports.tentarRenderizarProdutoDb('vaso-barro-artesanal', res)) return;
  res.render('pages/produtos/vaso-barro-artesanal');
};

exports.slugSolto = async (req, res, next) => {
  const view = resolverPaginaProduto(req.params.slugSolto);
  if (view) return res.render(`pages/produtos/${view}`);
  return exports.renderizarProdutoDinamico(req.params.slugSolto, res, next);
};
