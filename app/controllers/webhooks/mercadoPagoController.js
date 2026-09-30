'use strict';

const Pedido = require('../../models/Pedido');
const MercadoPagoWebhookLog = require('../../models/MercadoPagoWebhookLog');
const mpConfig = require('../../../config/mercadoPago');
const webhookService = require('../../services/mercadopago/webhookService');
const paymentsService = require('../../services/mercadopago/paymentsService');
const statusMap = require('../../services/mercadopago/statusMap');

const TENTATIVAS_LOCALIZAR_PEDIDO = 3;
const INTERVALO_TENTATIVA_MS = 200;

function aguardar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function localizarPedido(mercadoPagoPaymentId, externalReference) {
  for (let tentativa = 1; tentativa <= TENTATIVAS_LOCALIZAR_PEDIDO; tentativa++) {
    const porPaymentId = await Pedido.findByMercadoPagoPaymentId(mercadoPagoPaymentId);
    if (porPaymentId) return porPaymentId;
    if (externalReference) {
      const porReferencia = await Pedido.findByMercadoPagoExternalReference(externalReference);
      if (porReferencia) return porReferencia;
    }
    if (tentativa < TENTATIVAS_LOCALIZAR_PEDIDO) await aguardar(INTERVALO_TENTATIVA_MS);
  }
  return null;
}

exports.processar = async (req, res) => {
  try {
    await processarNotificacao(req, res);
  } catch (err) {
    console.error('[webhook mercadopago] falha inesperada:', err.message);
    if (!res.headersSent) res.status(500).json({ ok: false });
  }
};

async function processarNotificacao(req, res) {
  if (!mpConfig.ativo) {
    return res.status(404).end();
  }

  const notificationId = req.body?.id != null ? String(req.body.id) : null;
  const tipoEvento = req.body?.type || req.query.type || null;

  const logId = await MercadoPagoWebhookLog.registrar({
    notification_id: notificationId,
    tipo_evento: tipoEvento,
    payload: req.body,
    ip: req.ip,
  });

  try {
    webhookService.validarAssinatura(req);
  } catch (err) {
    await MercadoPagoWebhookLog.marcarResultado(logId, { processado: false, erro: err.reason || err.message });
    return res.status(401).json({ ok: false });
  }
  await MercadoPagoWebhookLog.marcarAssinaturaValida(logId);

  if (tipoEvento !== 'payment') {
    await MercadoPagoWebhookLog.marcarResultado(logId, { processado: true });
    return res.status(200).json({ ok: true });
  }

  const dataId = req.query['data.id'] || req.body?.data?.id;
  if (!dataId) {
    await MercadoPagoWebhookLog.marcarResultado(logId, { processado: false, erro: 'data.id ausente na notificação' });
    return res.status(400).json({ ok: false });
  }

  let pagamento;
  try {
    pagamento = await paymentsService.consultarPagamento(dataId);
  } catch (err) {
    await MercadoPagoWebhookLog.marcarResultado(logId, { processado: false, erro: err.message });
    return res.status(502).json({ ok: false });
  }

  if (!pagamento.statusInterno) {
    const conhecido = statusMap.ehConhecidoSemMapeamento(pagamento.status);
    const erro = conhecido
      ? `disputa em andamento (${pagamento.status}) — sem desfecho definitivo ainda, acompanhar manualmente`
      : `status desconhecido: ${pagamento.status}`;
    await MercadoPagoWebhookLog.marcarResultado(logId, { processado: false, erro });
    return res.status(200).json({ ok: true });
  }

  const pedidoId = await localizarPedido(pagamento.mercadoPagoPaymentId, pagamento.externalReference);
  if (!pedidoId) {
    await MercadoPagoWebhookLog.marcarResultado(logId, { processado: false, erro: 'pedido correspondente não encontrado' });
    return res.status(404).json({ ok: false });
  }

  const resultado = await Pedido.aplicarStatusPagamentoWebhook(pedidoId, pagamento.statusInterno, {
    observacao: pagamento.statusDetail || null,
    mercadopago_notification_id: notificationId,
  });

  await MercadoPagoWebhookLog.marcarResultado(logId, {
    processado: true,
    erro: resultado.aplicado ? null : resultado.motivo,
  });
  res.status(200).json({ ok: true });
};
