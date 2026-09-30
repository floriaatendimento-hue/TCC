'use strict';

const { renderLayout, escapeHtml, icone, titulo, paragrafo, detalhes, FONTE_CORPO, CORES } = require('./_layout');

function template({ nome, protocolo, assunto }) {
  const primeiroNome = escapeHtml((nome || '').split(' ')[0] || nome);

  const corpoHtml = `
    ${icone('&#128172;')}
    ${titulo('Recebemos sua solicitação')}
    ${paragrafo(`Olá, <strong>${primeiroNome}</strong>! Nossa equipe vai analisar o seu caso e entrar em contato pelo e-mail informado.`, { alinhar: 'center', margem: '0 0 6px' })}

    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto 22px;">
      <tr><td class="codigo-caixa" align="center" style="background:${CORES.VERDE_SUAVE};border:2px dashed ${CORES.DOURADO};border-radius:16px;padding:16px 36px;">
        <span style="display:block;margin:0 0 4px;font-family:${FONTE_CORPO};font-size:11px;letter-spacing:0.22em;text-transform:uppercase;font-weight:bold;color:${CORES.DOURADO_ESCURO};">Protocolo</span>
        <span class="codigo" style="display:block;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace;font-size:24px;line-height:1.2;font-weight:bold;letter-spacing:0.1em;color:${CORES.VERDE_ESCURO};">${escapeHtml(protocolo)}</span>
      </td></tr>
    </table>

    ${detalhes([['Assunto', escapeHtml(assunto)]])}

    ${paragrafo('Guarde este número de protocolo: se precisar retomar o assunto, é só mencioná-lo.', { suave: true, margem: '0' })}
  `;

  const text =
    `Olá, ${(nome || '').split(' ')[0] || nome}!\n\n` +
    `Recebemos sua solicitação de suporte. Nossa equipe irá analisar o problema e entrar em contato pelo e-mail informado.\n\n` +
    `Protocolo: ${protocolo}\n` +
    `Assunto: ${assunto}\n\n` +
    `Guarde este número de protocolo para referência futura.\n\n` +
    `Floria - Plantas & Vasos`;

  return {
    subject: `Recebemos sua solicitação - ${protocolo}`,
    text,
    html: renderLayout({ preheader: `Protocolo ${protocolo}: nossa equipe vai analisar seu caso.`, corpoHtml }),
  };
}

module.exports = template;
