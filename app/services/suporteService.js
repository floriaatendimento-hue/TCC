'use strict';

const { SolicitacaoSuporte } = require('../models/SolicitacaoSuporte');
const { mailerDisponivel, enviarNotificacaoSuporteEquipe, enviarConfirmacaoSuporteCliente } = require('./mailer');
const { logSeguranca } = require('../helpers/logSeguranca');

const EMAIL_SUPORTE = process.env.EMAIL_SUPORTE || process.env.SMTP_USER || null;

async function criarSolicitacao({ usuarioId = null, nome, email, assunto, categoria, mensagem, ip, userAgent }) {
  const duplicata = await SolicitacaoSuporte.buscarDuplicataRecente({ email, mensagem });
  if (duplicata) {
    logSeguranca('suporte_duplicata_ignorada', { protocolo: duplicata.protocolo, email });
    return { protocolo: duplicata.protocolo, duplicada: true };
  }

  const { id, protocolo } = await SolicitacaoSuporte.criar({
    usuarioId, nome, email, assunto, categoria: categoria || null, mensagem, ip, userAgent,
  });

  logSeguranca('suporte_solicitacao_criada', { id, protocolo, email, categoria: categoria || null, ip });

  const criadoEm = new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' });

  if (!mailerDisponivel) {
    logSeguranca('suporte_email_indisponivel', { protocolo });
    return { protocolo, duplicada: false };
  }

  if (EMAIL_SUPORTE) {
    enviarNotificacaoSuporteEquipe({
      destinatario: EMAIL_SUPORTE, replyTo: email, protocolo, nome, email, assunto, categoria, mensagem, criadoEm,
    }).catch((e) => {
      logSeguranca('suporte_email_equipe_falhou', { protocolo, erro: e.code || e.message });
    });
  } else {
    logSeguranca('suporte_sem_email_destino_configurado', { protocolo });
  }

  enviarConfirmacaoSuporteCliente({ to: email, nome, protocolo, assunto }).catch((e) => {
    logSeguranca('suporte_email_confirmacao_falhou', { protocolo, erro: e.code || e.message });
  });

  return { protocolo, duplicada: false };
}

module.exports = { criarSolicitacao, EMAIL_SUPORTE };
