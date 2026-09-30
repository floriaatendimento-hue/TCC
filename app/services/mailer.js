'use strict';

const nodemailer = require('nodemailer');
const { logSeguranca } = require('../helpers/logSeguranca');
const templateRecuperacaoSenha = require('./email/templates/recuperacaoSenha');
const templateSenhaAlterada = require('./email/templates/senhaAlterada');
const templateNovaSolicitacaoSuporte = require('./email/templates/novaSolicitacaoSuporte');
const templateConfirmacaoSuporte = require('./email/templates/confirmacaoSuporte');
const { escapeHtml } = require('./email/templates/_layout');

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  SMTP_TIMEOUT_MS,
} = process.env;

const mailerDisponivel = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);
const TIMEOUT_MS = parseInt(SMTP_TIMEOUT_MS || '10000', 10);

let transporter = null;
if (mailerDisponivel) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === 'true',
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: TIMEOUT_MS,
    greetingTimeout: TIMEOUT_MS,
    socketTimeout: TIMEOUT_MS,
  });
}

const remetente = SMTP_FROM || SMTP_USER || 'nao-responda@floria.com.br';

const ERROS_TRANSITORIOS = new Set(['ETIMEDOUT', 'ECONNECTION', 'ESOCKET', 'ECONNRESET', 'EDNS', 'ENOTFOUND']);

function dominioDe(endereco) {
  const m = /@([^>,\s]+)/.exec(String(endereco || ''));
  return m ? m[1].toLowerCase() : null;
}

async function enviarComRetry(mensagem, { contexto }) {
  if (!mailerDisponivel) {
    const erro = new Error('Envio de e-mail não está configurado neste servidor.');
    erro.code = 'MAILER_INDISPONIVEL';
    throw erro;
  }

  const MAX_TENTATIVAS = 2;
  let ultimoErro;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    try {
      const info = await transporter.sendMail(mensagem);
      logSeguranca('email_enviado', { contexto, tentativa, para_dominio: dominioDe(mensagem.to) });
      return info;
    } catch (err) {
      ultimoErro = err;
      const transitorio = ERROS_TRANSITORIOS.has(err.code);
      logSeguranca('email_falhou', {
        contexto, tentativa, codigo: err.code || null, transitorio,
        para_dominio: dominioDe(mensagem.to),
      });
      if (!transitorio || tentativa === MAX_TENTATIVAS) break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }
  throw ultimoErro;
}

async function enviarComprovantePorEmail({ to, pedido, pdfBuffer }) {
  const primeiroNome = (pedido.cliente_nome || '').split(' ')[0] || 'cliente';
  const primeiroNomeHtml = escapeHtml(primeiroNome);

  await enviarComRetry({
    from: `"Floria" <${remetente}>`,
    to,
    subject: `Comprovante do pedido #${pedido.id} — Floria`,
    text:
      `Olá, ${primeiroNome}!\n\n` +
      `Segue em anexo o comprovante da sua compra #${pedido.id} na Floria.\n\n` +
      `Qualquer dúvida, é só responder este e-mail.\n\nFloria Plantas & Vasos`,
    html:
      `<p>Olá, <strong>${primeiroNomeHtml}</strong>!</p>` +
      `<p>Segue em anexo o comprovante da sua compra <strong>#${pedido.id}</strong> na Floria.</p>` +
      `<p>Qualquer dúvida, é só responder este e-mail.</p>` +
      `<p style="color:#9a9a8a;font-size:12px;">Floria Plantas &amp; Vasos</p>`,
    attachments: [
      {
        filename: `comprovante-pedido-${pedido.id}.pdf`,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  }, { contexto: 'comprovante_pedido' });
}

async function enviarRecuperacaoSenhaPorEmail({ to, nome, codigo, expiraMinutos, quando }) {
  const { subject, text, html } = templateRecuperacaoSenha({ nome, codigo, expiraMinutos, quando });
  await enviarComRetry({ from: `"Floria" <${remetente}>`, to, subject, text, html }, { contexto: 'recuperacao_senha' });
}

async function enviarSenhaAlteradaPorEmail({ to, nome, quando, ip }) {
  const { subject, text, html } = templateSenhaAlterada({ nome, quando, ip });
  await enviarComRetry({ from: `"Floria" <${remetente}>`, to, subject, text, html }, { contexto: 'senha_alterada' });
}

async function enviarNotificacaoSuporteEquipe({ destinatario, replyTo, protocolo, nome, email, assunto, categoria, mensagem, criadoEm }) {
  const { subject, text, html } = templateNovaSolicitacaoSuporte({ protocolo, nome, email, assunto, categoria, mensagem, criadoEm });
  await enviarComRetry({
    from: `"Floria — Suporte" <${remetente}>`,
    to: destinatario,
    replyTo,
    subject,
    text,
    html,
  }, { contexto: 'suporte_notificacao_equipe' });
}

async function enviarConfirmacaoSuporteCliente({ to, nome, protocolo, assunto }) {
  const { subject, text, html } = templateConfirmacaoSuporte({ nome, protocolo, assunto });
  await enviarComRetry({ from: `"Floria" <${remetente}>`, to, subject, text, html }, { contexto: 'suporte_confirmacao_cliente' });
}

module.exports = {
  mailerDisponivel,
  enviarComprovantePorEmail,
  enviarRecuperacaoSenhaPorEmail,
  enviarSenhaAlteradaPorEmail,
  enviarNotificacaoSuporteEquipe,
  enviarConfirmacaoSuporteCliente,
};
