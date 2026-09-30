'use strict';

const Categoria = require('../../models/Categoria');
const Cupom = require('../../models/Cupom');
const Promocao = require('../../models/Promocao');
const promocoesService = require('../../services/promocoesService');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

exports.pagina = async (req, res) => {
  try {
    const hoje = new Date();
    const inicioPeriodo = new Date(hoje);
    inicioPeriodo.setDate(inicioPeriodo.getDate() - 30);
    const isoData = (d) => d.toISOString().slice(0, 10);

    const [promocoes, categorias, cupons, relatorioCupons] = await Promise.all([
      Promocao.findAllAdmin(),
      Categoria.findAllAtivas(),
      Cupom.findComCodigo(),
      Cupom.relatorioComCodigo(isoData(inicioPeriodo), isoData(hoje)),
    ]);
    const descontoConcedido30d = relatorioCupons.reduce((soma, c) => soma + (Number(c.desconto_periodo) || 0), 0);

    res.render('pages/admin/promocoes', {
      promocoes, categorias, cupons, descontoConcedido30d, secaoAtual: 'promocoes',
    });
  } catch (err) {
    console.error('Erro ao listar promoções/cupons:', err.message);
    res.render('pages/admin/promocoes', {
      promocoes: [], categorias: [], cupons: [], descontoConcedido30d: 0, secaoAtual: 'promocoes',
    });
  }
};

exports.telaNova = async (req, res) => {
  try {
    const categorias = await Categoria.findAllAtivas();
    res.render('pages/admin/promocao-form', { categorias, promocao: null, secaoAtual: 'promocoes' });
  } catch (err) {
    console.error('Erro ao abrir nova promoção:', err.message);
    res.redirect('/admin/promocoes');
  }
};

exports.telaEditar = async (req, res) => {
  try {
    const [categorias, promocao] = await Promise.all([
      Categoria.findAllAtivas(),
      Promocao.findById(req.params.id),
    ]);
    if (!promocao) return res.redirect('/admin/promocoes');
    if (promocao.tipo === 'produto') {
      promocao.produtos = await Promocao.findProdutosDaPromocao(promocao.id);
    }
    res.render('pages/admin/promocao-form', { categorias, promocao, secaoAtual: 'promocoes' });
  } catch (err) {
    console.error('Erro ao carregar promoção:', err.message);
    res.redirect('/admin/promocoes');
  }
};

exports.criar = async (req, res) => {
  try {
    const id = await Promocao.create(req.body);
    await promocoesService.invalidarCache();
    logAcao(req, 'promocao.criar', `#${id} — ${req.body.nome}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao criar promoção.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const promocaoAntes = await Promocao.findById(req.params.id);
    await Promocao.update(req.params.id, req.body);
    await promocoesService.invalidarCache();
    const diffPromocao = diffCampos(promocaoAntes, req.body, [
      'nome', 'tipo', 'categoria_id', 'subcategoria_id', 'valor_minimo',
      'desconto_percentual', 'data_inicio', 'data_fim',
    ]);
    logAcao(req, 'promocao.editar', `#${req.params.id} — ${req.body.nome}`, diffPromocao.mudou ? { dadosAntes: diffPromocao.antes, dadosDepois: diffPromocao.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao atualizar promoção.' });
  }
};

exports.alternarAtivo = async (req, res) => {
  try {
    const promocao = await Promocao.alternarAtivo(req.params.id);
    if (!promocao) return res.status(404).json({ ok: false, message: 'Promoção não encontrada.' });
    await promocoesService.invalidarCache();
    logAcao(req, 'promocao.status', `#${req.params.id} → ${promocao.ativo ? 'ativa' : 'inativa'}`, {
      dadosAntes: { ativo: !promocao.ativo },
      dadosDepois: { ativo: !!promocao.ativo },
    });
    res.json({ ok: true, data: promocao });
  } catch (err) {
    console.error('[admin] falha ao alternar status:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao alternar status da promoção.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    await Promocao.delete(req.params.id);
    await promocoesService.invalidarCache();
    logAcao(req, 'promocao.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao excluir promoção.' });
  }
};
