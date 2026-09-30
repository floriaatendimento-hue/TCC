'use strict';

const SessaoSegura = require('../models/SessaoSegura');
const IdempotenciaPedido = require('../models/IdempotenciaPedido');
const IdempotenciaAdmin = require('../models/IdempotenciaAdmin');
const LogAdmin = require('../models/LogAdmin');
const OtpRecuperacaoSenha = require('../models/OtpRecuperacaoSenha');
const { SolicitacaoSuporte } = require('../models/SolicitacaoSuporte');
const MercadoPagoWebhookLog = require('../models/MercadoPagoWebhookLog');

const INTERVALO_MS = 6 * 60 * 60 * 1000;
const LOGS_ADMIN_RETENCAO_DIAS = parseInt(process.env.LOGS_ADMIN_RETENCAO_DIAS || '548', 10); // 18 meses
const SUPORTE_RETENCAO_DIAS = parseInt(process.env.SUPORTE_RETENCAO_DIAS || '730', 10); // 2 anos
const MP_WEBHOOK_LOG_RETENCAO_DIAS = parseInt(process.env.MP_WEBHOOK_LOG_RETENCAO_DIAS || '90', 10);

async function ciclo() {
  const sessoesRemovidas = await SessaoSegura.limparAntigas();
  if (sessoesRemovidas) console.log(`[retencao] sessoes_seguranca: ${sessoesRemovidas} registro(s) expirado(s) removido(s).`);

  const idempotenciaRemovida = await IdempotenciaPedido.limparAntigas();
  if (idempotenciaRemovida) console.log(`[retencao] idempotencia_pedidos: ${idempotenciaRemovida} chave(s) antiga(s) removida(s).`);

  const idempotenciaAdminRemovida = await IdempotenciaAdmin.limparAntigas();
  if (idempotenciaAdminRemovida) console.log(`[retencao] idempotencia_admin: ${idempotenciaAdminRemovida} chave(s) antiga(s) removida(s).`);

  const logsRemovidos = await LogAdmin.limparAntigos(LOGS_ADMIN_RETENCAO_DIAS);
  if (logsRemovidos) console.log(`[retencao] logs_admin: ${logsRemovidos} registro(s) além de ${LOGS_ADMIN_RETENCAO_DIAS} dias removido(s).`);

  const tokensRemovidos = await OtpRecuperacaoSenha.limparAntigos();
  if (tokensRemovidos) console.log(`[retencao] otps_recuperacao_senha: ${tokensRemovidos} registro(s) antigo(s) removido(s).`);

  const suporteRemovidas = await SolicitacaoSuporte.limparAntigas(SUPORTE_RETENCAO_DIAS);
  if (suporteRemovidas) console.log(`[retencao] solicitacoes_suporte: ${suporteRemovidas} registro(s) além de ${SUPORTE_RETENCAO_DIAS} dias removido(s).`);

  const mpWebhookLogRemovidos = await MercadoPagoWebhookLog.limparAntigos(MP_WEBHOOK_LOG_RETENCAO_DIAS);
  if (mpWebhookLogRemovidos) console.log(`[retencao] mercadopago_webhook_log: ${mpWebhookLogRemovidos} registro(s) além de ${MP_WEBHOOK_LOG_RETENCAO_DIAS} dias removido(s).`);
}

let timer = null;

function iniciar() {
  if (timer) return;
  ciclo().catch(err => console.error('[retencao] erro no ciclo inicial de expurgo:', err.message));
  timer = setInterval(() => {
    ciclo().catch(err => console.error('[retencao] erro no ciclo de expurgo:', err.message));
  }, INTERVALO_MS);
  console.log(`🧹  Expurgo de retenção de dados ativo (a cada ${INTERVALO_MS / 3_600_000}h).`);
}

module.exports = { iniciar };
