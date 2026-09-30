'use strict';

const Cupom = require('../../models/Cupom');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

exports.redirecionarParaPromocoes = (req, res) => {
  res.redirect('/admin/promocoes#cupons');
};

exports.telaNovo = (req, res) => {
  res.render('pages/admin/cupom-form', { cupom: null, secaoAtual: 'promocoes' });
};

exports.telaEditar = async (req, res) => {
  try {
    const cupom = await Cupom.findById(req.params.id);
    if (!cupom) return res.redirect('/admin/promocoes#cupons');
    res.render('pages/admin/cupom-form', { cupom, secaoAtual: 'promocoes' });
  } catch (err) {
    console.error('Erro ao carregar cupom:', err.message);
    res.redirect('/admin/promocoes#cupons');
  }
};

exports.criar = async (req, res) => {
  try {
    const id = await Cupom.create(req.body);
    logAcao(req, 'cupom.criar', `#${id}` + (req.body.codigo ? ` — ${req.body.codigo}` : ' — promoção automática'));
    res.status(201).json({ ok: true, id });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe um cupom com esse código.' : 'Erro ao criar cupom.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    const cupomAntes = await Cupom.findById(req.params.id);
    await Cupom.update(req.params.id, req.body);
    const diffCupom = diffCampos(cupomAntes, req.body, ['codigo', 'tipo', 'valor', 'valor_minimo', 'data_inicio', 'data_fim', 'limite_usos']);
    logAcao(req, 'cupom.editar', `#${req.params.id}` + (req.body.codigo ? ` — ${req.body.codigo}` : ' — promoção automática'), diffCupom.mudou ? { dadosAntes: diffCupom.antes, dadosDepois: diffCupom.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe um cupom com esse código.' : 'Erro ao atualizar cupom.' });
  }
};

exports.alternarAtivo = async (req, res) => {
  try {
    const cupom = await Cupom.alternarAtivo(req.params.id);
    if (!cupom) return res.status(404).json({ ok: false, message: 'Cupom não encontrado.' });
    logAcao(req, 'cupom.status', `#${req.params.id} → ${cupom.ativo ? 'ativo' : 'inativo'}`, {
      dadosAntes: { ativo: !cupom.ativo },
      dadosDepois: { ativo: !!cupom.ativo },
    });
    res.json({ ok: true, data: cupom });
  } catch (err) {
    console.error('[admin] falha ao alternar status:', err.message);
    res.status(500).json({ ok: false, message: 'Erro ao alternar status do cupom.' });
  }
};

exports.excluir = async (req, res) => {
  try {
    await Cupom.delete(req.params.id);
    logAcao(req, 'cupom.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao excluir cupom.' });
  }
};

exports.pedidosQueUsaram = async (req, res) => {
  try {
    const cupom = await Cupom.findById(req.params.id);
    if (!cupom) return res.status(404).json({ ok: false, message: 'Cupom não encontrado.' });
    if (!cupom.codigo) return res.json({ ok: true, pedidos: [] });

    const pedidos = await Cupom.pedidosQueUsaram(cupom.codigo);
    res.json({ ok: true, pedidos });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao buscar pedidos deste cupom.' });
  }
};
