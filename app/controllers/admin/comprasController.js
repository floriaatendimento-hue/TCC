'use strict';

const Compra = require('../../models/Compra');
const Fornecedor = require('../../models/Fornecedor');
const { logAcao } = require('../../helpers/auditLog');

const CODIGOS_HTTP = {
  FORNECEDOR_INVALIDO: 404,
  FORNECEDOR_NAO_ATIVO: 409,
  SEM_ITENS: 400,
  ITEM_INVALIDO: 400,
  VALOR_INVALIDO: 400,
  DESCONTO_MAIOR_QUE_SUBTOTAL: 400,
  CONTA_NAO_ENCONTRADA: 404,
  CONTA_CANCELADA: 409,
  PAGAMENTO_MAIOR_QUE_SALDO: 409,
  PAGAMENTO_NAO_ENCONTRADO: 404,
  COMPRA_NAO_ENCONTRADA: 404,
  COMPRA_COM_PAGAMENTO: 409,
  ITEM_DUPLICADO: 400,
  IDEMPOTENCIA_EM_ANDAMENTO: 409,
};

function responderErro(res, err, mensagemPadrao) {
  const status = CODIGOS_HTTP[err.code];
  if (status) return res.status(status).json({ ok: false, message: err.message || mensagemPadrao });
  console.error('[compras]', err && err.message ? err.message : err);
  return res.status(500).json({ ok: false, message: mensagemPadrao });
}

exports.pagina = async (req, res) => {
  try {
    const fornecedorId = String(req.query.fornecedor_id || '').trim();
    const statusConta = String(req.query.status || '').trim();
    const busca = String(req.query.busca || '').trim().slice(0, 100);
    const de = String(req.query.de || '').trim();
    const ate = String(req.query.ate || '').trim();
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = 30;
    const offset = (pagina - 1) * limite;

    const [compras, fornecedores, resumo, totalFiltrado] = await Promise.all([
      Compra.findAllAdmin({ fornecedorId, statusConta, busca, de, ate, limite, offset }),
      Fornecedor.findAll({}),
      Compra.resumoGeral(),
      Compra.contarFiltrado({ fornecedorId, statusConta, busca, de, ate }),
    ]);

    res.render('pages/admin/compras', {
      compras, fornecedores, resumo,
      fornecedorId, statusConta, busca, de, ate,
      pagina, totalPaginas: Math.max(1, Math.ceil(totalFiltrado / limite)), totalFiltrado,
      erro: null, secaoAtual: 'compras',
    });
  } catch (err) {
    console.error('Erro ao listar compras:', err.message);
    res.render('pages/admin/compras', {
      compras: [], fornecedores: [], resumo: { totalComprado: 0, totalPago: 0, totalEmAberto: 0, totalVencido: 0 },
      fornecedorId: '', statusConta: '', busca: '', de: '', ate: '',
      pagina: 1, totalPaginas: 1, totalFiltrado: 0,
      erro: 'Não foi possível carregar a lista de compras agora. Tente recarregar a página.',
      secaoAtual: 'compras',
    });
  }
};

exports.telaNova = async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({ status: 'ativo' });
    const fornecedorIdPreSelecionado = String(req.query.fornecedor_id || '').trim();
    res.render('pages/admin/compra-form', { fornecedores, fornecedorIdPreSelecionado, secaoAtual: 'compras' });
  } catch (err) {
    console.error('Erro ao abrir formulário de compra:', err.message);
    res.redirect('/admin/compras');
  }
};

exports.detalhes = async (req, res) => {
  try {
    const compra = await Compra.findById(req.params.id);
    if (!compra) return res.redirect('/admin/compras');

    const [itens, contas] = await Promise.all([
      Compra.itensDaCompra(compra.id),
      Compra.contasPagarDaCompra(compra.id),
    ]);
    const pagamentosPorConta = await Promise.all(contas.map(c => Compra.pagamentosDaConta(c.id)));
    const pagamentos = contas
      .map((c, i) => pagamentosPorConta[i].map(p => ({ ...p, parcela_numero: c.parcela_numero })))
      .flat()
      .sort((a, b) => new Date(b.data_pagamento) - new Date(a.data_pagamento) || b.id - a.id);

    res.render('pages/admin/compra-detalhes', {
      compra, itens, contas, pagamentos,
      metodosPagamento: Compra.metodosPagamentoValidos(),
      secaoAtual: 'compras',
    });
  } catch (err) {
    console.error('Erro ao carregar compra:', err.message);
    res.redirect('/admin/compras');
  }
};

exports.criar = async (req, res) => {
  try {
    const nomeAdmin = req.session.usuario?.nome || null;
    const idempotencyKey = req.get('Idempotency-Key') || null;
    const resultado = await Compra.createIdempotente(req.body, nomeAdmin, idempotencyKey, req.session.usuario.id);
    if (!resultado.idempotente) {
      logAcao(req, 'compra.criar', `#${resultado.compra_id} — fornecedor #${req.body.fornecedor_id}`);
    }
    res.status(resultado.idempotente ? 200 : 201).json({ ok: true, id: resultado.compra_id, idempotente: resultado.idempotente });
  } catch (err) {
    responderErro(res, err, 'Erro ao registrar compra.');
  }
};

exports.criarContaAvulsa = async (req, res) => {
  try {
    const nomeAdmin = req.session.usuario?.nome || null;
    const id = await Compra.criarContaAvulsa(req.body, nomeAdmin);
    logAcao(req, 'conta_pagar.criar_avulsa', `#${id} — fornecedor #${req.body.fornecedor_id} — ${req.body.descricao}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    responderErro(res, err, 'Erro ao criar a conta.');
  }
};

exports.cancelar = async (req, res) => {
  try {
    const nomeAdmin = req.session.usuario?.nome || null;
    const resultado = await Compra.cancelar(req.params.id, req.body.motivo, nomeAdmin);
    logAcao(req, 'compra.cancelar', `#${req.params.id}`, { dadosDepois: { motivo: req.body.motivo || null } });
    res.json({ ok: true, jaEstava: !!resultado.jaEstava });
  } catch (err) {
    responderErro(res, err, 'Erro ao cancelar compra.');
  }
};

exports.registrarPagamento = async (req, res) => {
  try {
    const nomeAdmin = req.session.usuario?.nome || null;
    const contaId = Number(req.params.contaId);
    const resultado = await Compra.registrarPagamento({
      conta_pagar_id: contaId,
      valor: req.body.valor,
      data_pagamento: req.body.data_pagamento,
      metodo: req.body.metodo,
      referencia: req.body.referencia,
      observacoes: req.body.observacoes,
    }, nomeAdmin);
    logAcao(req, 'conta_pagar.pagamento', `conta #${contaId} — R$ ${Number(req.body.valor).toFixed(2)}`, {
      dadosDepois: { valor: req.body.valor, metodo: req.body.metodo, novoSaldo: resultado.saldo, novoStatus: resultado.status },
    });
    res.status(201).json({ ok: true, ...resultado });
  } catch (err) {
    responderErro(res, err, 'Erro ao registrar pagamento.');
  }
};

exports.estornarPagamento = async (req, res) => {
  try {
    const nomeAdmin = req.session.usuario?.nome || null;
    const resultado = await Compra.estornarPagamento(req.params.pagamentoId, nomeAdmin);
    logAcao(req, 'pagamento_fornecedor.estornar', `#${req.params.pagamentoId}`);
    res.json({ ok: true, ...resultado });
  } catch (err) {
    responderErro(res, err, 'Erro ao estornar pagamento.');
  }
};
