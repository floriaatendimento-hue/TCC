'use strict';

const Pedido = require('../../models/Pedido');
const { logAcao } = require('../../helpers/auditLog');
const { respostaErro } = require('../../helpers/respostaErro');

exports.pagina = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const busca  = String(req.query.busca  || '').trim().slice(0, 100);
    const data   = String(req.query.data   || '').trim();
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = 20;
    const offset = (pagina - 1) * limite;

    const [pedidos, porStatus, totalFiltrado] = await Promise.all([
      Pedido.findAllAdmin({ status, busca, data, limite, offset }),
      Pedido.contarPorStatus(),
      Pedido.contarFiltrado({ status, busca, data }),
    ]);

    res.render('pages/admin/pedidos', {
      pedidos, status, busca, data, pagina,
      totalPaginas: Math.max(1, Math.ceil(totalFiltrado / limite)),
      totalFiltrado, porStatus, secaoAtual: 'pedidos',
    });
  } catch (err) {
    console.error('Erro ao listar pedidos (admin):', err.message);
    res.render('pages/admin/pedidos', {
      pedidos: [], status: '', busca: '', data: '', pagina: 1, totalPaginas: 1,
      totalFiltrado: 0, porStatus: {}, secaoAtual: 'pedidos',
    });
  }
};

exports.detalhes = async (req, res) => {
  try {
    const pedido = await Pedido.detalhesCompletos(req.params.id);
    if (!pedido) return res.redirect('/pedidos');

    res.render('pages/admin/pedido-detalhes', {
      pedido,
      rotulosEtapa: Pedido.rotulosEtapa(),
      rotulosStatusPagamento: Pedido.rotulosStatusPagamento(),
      statusValidos: Pedido.statusValidos(),
      statusPagamentoValidos: Pedido.statusPagamentoValidos(),
      secaoAtual: 'pedidos',
    });
  } catch (err) {
    console.error('Erro ao carregar pedido (admin):', err.message);
    res.redirect('/pedidos');
  }
};

exports.listar = async (req, res) => {
  try {
    const pedidos = await Pedido.findAll();
    res.json({ ok: true, data: pedidos });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.atualizarStatus = async (req, res) => {
  try {
    const nomeAdmin = req.session.usuario?.nome || null;
    const pedidoAntes = await Pedido.findById(req.params.id);
    const rows = await Pedido.atualizarStatus(req.params.id, req.body.status, req.body.observacao || null, nomeAdmin);
    if (!rows) return res.status(404).json({ ok: false, message: 'Pedido não encontrado.' });
    logAcao(req, 'pedido.status', `#${req.params.id} → ${req.body.status}`, {
      dadosAntes: { status: pedidoAntes ? pedidoAntes.status : null },
      dadosDepois: { status: req.body.status, observacao: req.body.observacao || null },
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.code === 'PEDIDO_CANCELADO') return res.status(409).json({ ok: false, message: err.message });
    respostaErro(res, err, 'Erro ao atualizar o status do pedido.');
  }
};

exports.atualizarStatusPagamento = async (req, res) => {
  try {
    const pedidoAntes = await Pedido.findById(req.params.id);
    const rows = await Pedido.atualizarStatusPagamento(req.params.id, req.body.status_pagamento, {
      observacao: req.body.observacao || null,
      origem: 'admin',
    });
    if (!rows) return res.status(404).json({ ok: false, message: 'Pedido não encontrado.' });
    logAcao(req, 'pedido.pagamento', `#${req.params.id} → ${req.body.status_pagamento}`, {
      dadosAntes: { status_pagamento: pedidoAntes ? pedidoAntes.status_pagamento : null },
      dadosDepois: { status_pagamento: req.body.status_pagamento },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};
