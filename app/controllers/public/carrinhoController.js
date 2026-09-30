'use strict';

const Cupom = require('../../models/Cupom');
const configCache = require('../../services/cache/configCache');
const freteService = require('../../services/freteService');
const checkoutService = require('../../services/checkoutService');
const mpConfig = require('../../../config/mercadoPago');
const { lerIdempotencyKey } = require('../../helpers/idempotencyKey');

const STATUS_POR_CODIGO_CHECKOUT = {
  SEM_ENDERECO: 422,
  ENDERECO_INVALIDO: 422,
  REGIAO_NAO_ATENDIDA: 422,
  PRODUTO_INVALIDO: 422,
  CARRINHO_VAZIO: 422,
  CUPOM_INVALIDO: 422,
  CUPOM_VALOR_MINIMO: 422,
  PAGAMENTO_RECUSADO: 422,
  ESTOQUE_INSUFICIENTE: 422,
  TOTAL_INVALIDO: 422,
  IDEMPOTENCIA_EM_ANDAMENTO: 409,
  MERCADOPAGO_TOKEN_INVALIDO: 422,
  MERCADOPAGO_CREDENCIAL_INVALIDA: 503,
  MERCADOPAGO_INDISPONIVEL: 503,
};

exports.validarCupom = async (req, res) => {
  try {
    const codigo = String(req.body.codigo).trim().toUpperCase();
    const subtotal = Number(req.body.subtotal) || 0;

    const cupomValido = await Cupom.findValidoPorCodigo(codigo);

    if (!cupomValido) {
      const bruto = await Cupom.findByCodigoBruto(codigo);
      if (!bruto) return res.status(404).json({ ok: false, code: 'INEXISTENTE', message: 'Cupom inexistente.' });
      if (!bruto.ativo) return res.status(422).json({ ok: false, code: 'INATIVO', message: 'Este cupom está desativado.' });

      const hoje = new Date().toISOString().slice(0, 10);
      const inicio = bruto.data_inicio ? new Date(bruto.data_inicio).toISOString().slice(0, 10) : null;
      const fim    = bruto.data_fim    ? new Date(bruto.data_fim).toISOString().slice(0, 10)    : null;
      if (inicio && inicio > hoje) return res.status(422).json({ ok: false, code: 'AINDA_NAO_VALIDO', message: 'Este cupom ainda não está disponível.' });
      if (fim && fim < hoje) return res.status(422).json({ ok: false, code: 'EXPIRADO', message: 'Este cupom expirou.' });
      if (bruto.limite_usos && bruto.usos_atual >= bruto.limite_usos) {
        return res.status(422).json({ ok: false, code: 'LIMITE_ATINGIDO', message: 'Este cupom atingiu o limite de usos.' });
      }
      return res.status(422).json({ ok: false, code: 'INVALIDO', message: 'Cupom inválido.' });
    }

    if (cupomValido.valor_minimo && subtotal < Number(cupomValido.valor_minimo)) {
      return res.status(422).json({
        ok: false,
        code: 'VALOR_MINIMO',
        message: `Este cupom exige uma compra mínima de ${Number(cupomValido.valor_minimo).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`,
        valor_minimo: Number(cupomValido.valor_minimo),
      });
    }

    const desconto = Cupom.calcularDesconto(cupomValido, subtotal, 0);
    res.json({
      ok: true,
      codigo: cupomValido.codigo,
      tipo: cupomValido.tipo,
      valor: Number(cupomValido.valor) || 0,
      valor_minimo: cupomValido.valor_minimo ? Number(cupomValido.valor_minimo) : 0,
      desconto,
    });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao validar cupom.' });
  }
};

exports.calcularFrete = async (req, res) => {
  try {
    const { cep, slug, quantidade } = req.body;
    const resultado = await freteService.calcularFrete({ cepDestino: cep, slug, quantidade });
    res.json({ ok: true, data: resultado });
  } catch (err) {
    const statusPorCodigo = {
      CEP_INVALIDO: 400,
      CEP_NAO_ENCONTRADO: 404,
      PRODUTO_NAO_ENCONTRADO: 404,
      PRODUTO_SEM_DIMENSOES: 422,
      SERVICO_INDISPONIVEL: 503,
      REGIAO_NAO_ATENDIDA: 422,
    };
    const status = statusPorCodigo[err.code] || 500;
    if (status === 500) console.error('Erro ao calcular frete:', err.message);
    res.status(status).json({
      ok: false,
      code: err.code || 'ERRO_INTERNO',
      message: err.code ? err.message : 'Não foi possível calcular o frete agora. Tente novamente em instantes.',
    });
  }
};

exports.paginaPresentear = (req, res) => res.render('pages/produtos/Presentear');
exports.paginaCarrinho = (req, res) => res.render('pages/carrinho/Carrinho');

exports.exigirLoginParaPagamento = (req, res, next) => {
  if (!req.session?.usuario) return res.redirect('/login?next=%2Fpagamento&motivo=checkout');
  next();
};

exports.paginaPagamento = (req, res) => res.render('pages/carrinho/Pagamento', {
  ufsEntregaPermitidas: configCache.obterUfsEntregaPermitidas(),
});

exports.paginaDetalhes = (req, res) => res.render('pages/produtos/Detalhes');
exports.paginaDetalhesV = (req, res) => res.render('pages/produtos/DetalhesV');

exports.configPagamento = (req, res) => {
  res.json(mpConfig.ativo
    ? { modo: 'mercadopago', publicKey: mpConfig.publicKey }
    : { modo: 'preparacao' });
};

exports.finalizarPedido = async (req, res) => {
  try {
    const {
      itens, forma_pagto, endereco_id, frete, cupom, parcelas, observacoes,
      numero_cartao,
      mp_token, mp_payment_method_id, mp_installments, mp_issuer_id, mp_payer,
    } = req.body;

    const chaveLida = lerIdempotencyKey(req);
    if (!chaveLida.ok) {
      return res.status(422).json({ ok: false, code: 'IDEMPOTENCY_KEY_INVALIDA', message: 'Cabeçalho Idempotency-Key inválido (use até 100 caracteres: letras, números, ponto, hífen, sublinhado ou dois-pontos).' });
    }
    const idempotencyKey = chaveLida.chave;

    const resultado = await checkoutService.finalizarPedidoIdempotente({
      usuarioId: req.session.usuario.id,
      usuarioEmail: req.session.usuario.email,
      itens,
      formaPagamento: forma_pagto,
      enderecoId: endereco_id,
      frete,
      cupom,
      parcelas,
      observacoes,
      dadosCartao: { numero: numero_cartao },
      dadosMercadoPago: mpConfig.ativo ? {
        token: mp_token,
        paymentMethodId: mp_payment_method_id,
        installments: mp_installments,
        issuerId: mp_issuer_id,
        payer: mp_payer,
      } : undefined,
    }, idempotencyKey);

    res.status(resultado.idempotente ? 200 : 201).json({
      ok: true,
      pedido_id: resultado.pedidoId,
      status_pagamento: resultado.statusPagamento,
      idempotente: resultado.idempotente,
      ponto_de_interacao: resultado.pontoDeInteracao || undefined,
    });
  } catch (err) {
    const status = STATUS_POR_CODIGO_CHECKOUT[err.code];
    if (status) {
      return res.status(status).json({ ok: false, code: err.code, message: err.message, ...(err.detalhes || {}) });
    }
    console.error('[finalizar pedido]', err.message);
    res.status(500).json({ ok: false, message: 'Não foi possível finalizar seu pedido. Tente novamente.' });
  }
};
