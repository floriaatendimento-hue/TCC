'use strict';

const Produto = require('../../models/Produto');
const Categoria = require('../../models/Categoria');
const LogAdmin = require('../../models/LogAdmin');
const MovimentacaoEstoque = require('../../models/MovimentacaoEstoque');
const { logAcao } = require('../../helpers/auditLog');
const { respostaErro } = require('../../helpers/respostaErro');

exports.pagina = (req, res) => {
  res.render('pages/admin/produtos', { secaoAtual: 'produtos' });
};

exports.telaNovo = async (req, res) => {
  try {
    const categorias = await Categoria.findAllAtivas();
    res.render('pages/admin/produto-form', { produto: null, categorias, historico: null, secaoAtual: 'produtos' });
  } catch (err) {
    console.error('Erro ao carregar página de novo produto:', err.message);
    res.render('pages/admin/produto-form', { produto: null, categorias: [], historico: null, secaoAtual: 'produtos' });
  }
};

exports.telaEditar = async (req, res) => {
  try {
    const [produto, categorias] = await Promise.all([
      Produto.findByIdAdmin(req.params.id),
      Categoria.findAllAtivas(),
    ]);
    if (!produto) return res.redirect('/admin/produtos');
    if (!categorias.some((c) => c.id === produto.categoria_id)) {
      const categoriaAtual = await Categoria.findById(produto.categoria_id);
      if (categoriaAtual) categorias.push(categoriaAtual);
    }
    const historico = await LogAdmin.historicoPorProduto(produto.id);
    res.render('pages/admin/produto-form', { produto, categorias, historico, secaoAtual: 'produtos' });
  } catch (err) {
    console.error('Erro ao carregar página de edição de produto:', err.message);
    res.redirect('/admin/produtos');
  }
};

exports.paginaEstoque = async (req, res) => {
  try {
    const paginaMov = Math.max(1, parseInt(req.query.paginaMov, 10) || 1);
    const limiteMov = 15;
    const offsetMov = (paginaMov - 1) * limiteMov;

    const [produtos, movimentacoes, totalMovimentacoes] = await Promise.all([
      Produto.findAllAdmin(),
      MovimentacaoEstoque.historico({ limite: limiteMov, offset: offsetMov }),
      MovimentacaoEstoque.contar(),
    ]);
    res.render('pages/admin/estoque', {
      produtos, movimentacoes, totalMovimentacoes,
      totalPaginasMov: Math.max(1, Math.ceil(totalMovimentacoes / limiteMov)),
      paginaMov, secaoAtual: 'estoque',
    });
  } catch (err) {
    console.error('Erro ao carregar Estoque:', err.message);
    res.render('pages/admin/estoque', {
      produtos: [], movimentacoes: [], totalMovimentacoes: 0, totalPaginasMov: 1, paginaMov: 1, secaoAtual: 'estoque',
    });
  }
};

exports.telaNovaMovimentacao = async (req, res) => {
  try {
    const produtos = await Produto.findAllAdmin();
    const produtoIdPreSelecionado = req.query.produto_id ? Number(req.query.produto_id) : null;
    res.render('pages/admin/estoque-movimentacao', { produtos, produtoIdPreSelecionado, secaoAtual: 'estoque' });
  } catch (err) {
    console.error('Erro ao carregar página de nova movimentação:', err.message);
    res.render('pages/admin/estoque-movimentacao', { produtos: [], produtoIdPreSelecionado: null, secaoAtual: 'estoque' });
  }
};

exports.historicoMovimentacoes = async (req, res) => {
  try {
    const produto_id = req.query.produto_id || '';
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = 15;
    const offset = (pagina - 1) * limite;
    const [movimentacoes, total] = await Promise.all([
      MovimentacaoEstoque.historico({ produto_id, limite, offset }),
      MovimentacaoEstoque.contar(produto_id),
    ]);
    res.json({ ok: true, data: movimentacoes, total, totalPaginas: Math.max(1, Math.ceil(total / limite)) });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao carregar histórico.' });
  }
};

exports.registrarMovimentacao = async (req, res) => {
  try {
    const usuario = req.session.usuario;
    const resultado = await MovimentacaoEstoque.registrar({
      produto_id: req.body.produto_id,
      tipo: req.body.tipo,
      quantidade: req.body.quantidade,
      motivo: req.body.motivo,
      usuario_id: usuario.id,
      usuario_nome: usuario.nome,
    });
    logAcao(req, 'estoque.movimentacao', `Produto #${req.body.produto_id} — ${req.body.tipo} de ${req.body.quantidade} (${resultado.estoqueAnterior} → ${resultado.estoqueNovo})`, {
      dadosAntes: { estoque: resultado.estoqueAnterior },
      dadosDepois: { estoque: resultado.estoqueNovo, tipo: req.body.tipo, quantidade: Number(req.body.quantidade), motivo: req.body.motivo || null },
    });
    res.status(201).json({ ok: true, data: resultado });
  } catch (err) {
    const status = { PRODUTO_NAO_ENCONTRADO: 404, ESTOQUE_INSUFICIENTE: 409, VALOR_INVALIDO: 422 }[err.code];
    if (status) return res.status(status).json({ ok: false, message: err.message });
    respostaErro(res, err, 'Erro ao registrar movimentação.');
  }
};

exports.listarTodos = async (req, res) => {
  try {
    const produtos = await Produto.findAllAdmin();
    res.json({ ok: true, data: produtos });
  } catch (err) {
    respostaErro(res, err);
  }
};
