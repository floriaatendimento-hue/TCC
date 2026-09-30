'use strict';

const Categoria = require('../../models/Categoria');
const Subcategoria = require('../../models/Subcategoria');
const categoriasNavCache = require('../../services/cache/categoriasNavCache');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

exports.pagina = async (req, res) => {
  try {
    const [categorias, subcategorias] = await Promise.all([
      Categoria.findAllAdmin(),
      Subcategoria.findAllAgrupadas(),
    ]);
    res.render('pages/admin/categorias', { categorias, subcategorias, secaoAtual: 'categorias' });
  } catch (err) {
    console.error('Erro ao listar categorias:', err.message);
    res.render('pages/admin/categorias', { categorias: [], subcategorias: [], secaoAtual: 'categorias' });
  }
};

exports.telaNovaCategoria = (req, res) => {
  res.render('pages/admin/categoria-form', { categoria: null, secaoAtual: 'categorias' });
};

exports.telaEditarCategoria = async (req, res) => {
  try {
    const categoria = await Categoria.findById(req.params.id);
    if (!categoria) return res.redirect('/admin/categorias');
    res.render('pages/admin/categoria-form', { categoria, secaoAtual: 'categorias' });
  } catch (err) {
    console.error('Erro ao carregar página de edição de categoria:', err.message);
    res.redirect('/admin/categorias');
  }
};

exports.listar = async (req, res) => {
  try {
    res.json({ ok: true, data: await Categoria.findAllAdmin() });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao listar categorias.' });
  }
};

exports.criar = async (req, res) => {
  try {
    const id = await Categoria.create(req.body);
    await categoriasNavCache.carregar();
    logAcao(req, 'categoria.criar', `#${id} — ${req.body.nome}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe uma categoria com esse slug.' : 'Erro ao criar categoria.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const categoriaAntes = await Categoria.findById(req.params.id);
    await Categoria.update(req.params.id, req.body);
    await categoriasNavCache.carregar();
    const diffCategoria = diffCampos(categoriaAntes, req.body, ['nome', 'slug', 'descricao']);
    logAcao(req, 'categoria.editar', `#${req.params.id} — ${req.body.nome}`, diffCategoria.mudou ? { dadosAntes: diffCategoria.antes, dadosDepois: diffCategoria.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe uma categoria com esse slug.' : 'Erro ao atualizar categoria.' });
  }
};

exports.alternarAtiva = async (req, res) => {
  try {
    const categoria = await Categoria.alternarAtiva(req.params.id);
    if (!categoria) return res.status(404).json({ ok: false, message: 'Categoria não encontrada.' });
    await categoriasNavCache.carregar();
    logAcao(req, 'categoria.status', `#${req.params.id} → ${categoria.ativa ? 'ativa' : 'inativa'}`, {
      dadosAntes: { ativa: !categoria.ativa },
      dadosDepois: { ativa: !!categoria.ativa },
    });
    res.json({ ok: true, data: categoria });
  } catch (err) {
    console.error('[admin] falha ao alternar status:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao alternar status da categoria.' });
  }
};

exports.mover = async (req, res) => {
  try {
    const direcao = req.body.direcao === 'cima' ? 'cima' : 'baixo';
    const moveu = await Categoria.mover(req.params.id, direcao);
    if (moveu) await categoriasNavCache.carregar();
    res.json({ ok: moveu });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao reordenar categoria.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    await Categoria.delete(req.params.id);
    await categoriasNavCache.carregar();
    logAcao(req, 'categoria.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    const emUso = err.code === 'ER_ROW_IS_REFERENCED_2' || err.code === 'ER_ROW_IS_REFERENCED';
    res.status(emUso ? 409 : 500).json({
      ok: false,
      message: emUso
        ? 'Não é possível excluir: existem produtos ou subcategorias vinculados a esta categoria.'
        : 'Erro ao excluir categoria.',
    });
  }
};

exports.redirecionarSubcategorias = (req, res) => res.redirect('/admin/categorias');

exports.telaNovaSubcategoria = async (req, res) => {
  try {
    const categorias = await Categoria.findAllAdmin();
    res.render('pages/admin/subcategoria-form', {
      subcategoria: null,
      categorias,
      categoriaIdPreSelecionada: req.query.categoria_id || '',
      secaoAtual: 'categorias',
    });
  } catch (err) {
    console.error('Erro ao carregar página de nova subcategoria:', err.message);
    res.redirect('/admin/categorias');
  }
};

exports.telaEditarSubcategoria = async (req, res) => {
  try {
    const [subcategoria, categorias] = await Promise.all([
      Subcategoria.findById(req.params.id),
      Categoria.findAllAdmin(),
    ]);
    if (!subcategoria) return res.redirect('/admin/categorias');
    res.render('pages/admin/subcategoria-form', {
      subcategoria,
      categorias,
      categoriaIdPreSelecionada: '',
      secaoAtual: 'categorias',
    });
  } catch (err) {
    console.error('Erro ao carregar página de edição de subcategoria:', err.message);
    res.redirect('/admin/categorias');
  }
};

exports.listarSubcategorias = async (req, res) => {
  try {
    if (req.query.categoria_id) {
      return res.json({ ok: true, data: await Subcategoria.findByCategoria(req.query.categoria_id, { somenteAtivas: true }) });
    }
    res.json({ ok: true, data: await Subcategoria.findAllAgrupadas() });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao listar subcategorias.' });
  }
};

exports.criarSubcategoria = async (req, res) => {
  try {
    const id = await Subcategoria.create(req.body);
    logAcao(req, 'subcategoria.criar', `#${id} — ${req.body.nome}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe uma subcategoria com esse slug nesta categoria.' : 'Erro ao criar subcategoria.' });
  }
};

exports.atualizarSubcategoria = async (req, res) => {
  try {
    const subAntes = await Subcategoria.findById(req.params.id);
    await Subcategoria.update(req.params.id, req.body);
    const diffSub = diffCampos(subAntes, req.body, ['nome', 'slug', 'descricao', 'categoria_id']);
    logAcao(req, 'subcategoria.editar', `#${req.params.id} — ${req.body.nome}`, diffSub.mudou ? { dadosAntes: diffSub.antes, dadosDepois: diffSub.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe uma subcategoria com esse slug nesta categoria.' : 'Erro ao atualizar subcategoria.' });
  }
};

exports.alternarAtivaSubcategoria = async (req, res) => {
  try {
    const subcategoria = await Subcategoria.alternarAtiva(req.params.id);
    if (!subcategoria) return res.status(404).json({ ok: false, message: 'Subcategoria não encontrada.' });
    logAcao(req, 'subcategoria.status', `#${req.params.id} → ${subcategoria.ativa ? 'ativa' : 'inativa'}`, {
      dadosAntes: { ativa: !subcategoria.ativa },
      dadosDepois: { ativa: !!subcategoria.ativa },
    });
    res.json({ ok: true, data: subcategoria });
  } catch (err) {
    console.error('[admin] falha ao alternar status:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao alternar status da subcategoria.' });
  }
};

exports.moverSubcategoria = async (req, res) => {
  try {
    const direcao = req.body.direcao === 'cima' ? 'cima' : 'baixo';
    const moveu = await Subcategoria.mover(req.params.id, direcao);
    res.json({ ok: moveu });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao reordenar subcategoria.' });
  }
};

exports.excluirSubcategoria = async (req, res) => {
  try {
    await Subcategoria.delete(req.params.id);
    logAcao(req, 'subcategoria.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao excluir subcategoria.' });
  }
};
