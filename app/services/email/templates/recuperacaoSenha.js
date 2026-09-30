'use strict';

const {
  renderLayout, escapeHtml, icone, titulo, paragrafo, caixa,
  FONTE_TITULO, FONTE_CORPO, CORES,
} = require('./_layout');

function template({ nome, codigo, expiraMinutos, quando }) {
  const primeiroNome = escapeHtml(nome);
  const codigoSeguro = escapeHtml(codigo);

  const corpoHtml = `
    ${icone('&#128274;')}
    ${titulo('Seu código de verificação')}
    ${paragrafo(`Olá, <strong>${primeiroNome}</strong>! Use o código abaixo para confirmar que é você e escolher uma nova senha na Floria.`, { alinhar: 'center', margem: '0 0 6px' })}

    <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto 14px;">
      <tr><td class="codigo-caixa" align="center" style="background:${CORES.VERDE_SUAVE};border:2px dashed ${CORES.DOURADO};border-radius:16px;">
        <span class="codigo" style="display:block;padding:20px 26px 20px 40px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,'Courier New',monospace;font-size:42px;line-height:1;font-weight:bold;letter-spacing:0.36em;color:${CORES.VERDE_ESCURO};">${codigoSeguro}</span>
      </td></tr>
    </table>
    ${paragrafo(`Válido por <strong>${expiraMinutos} minutos</strong> &middot; uso único`, { alinhar: 'center', suave: true, margem: '0 0 8px' })}

    ${caixa(`<strong class="forte" style="color:${CORES.VERDE_ESCURO};">Não compartilhe este código com ninguém.</strong><br>A equipe da Floria nunca pede esse código por telefone, mensagem ou e-mail.`, { tom: 'alerta' })}

    ${quando ? paragrafo(`Solicitado em ${escapeHtml(quando)}`, { alinhar: 'center', suave: true, margem: '0 0 18px' }) : ''}

    ${paragrafo('Não foi você? Pode ignorar este e-mail com segurança: sua senha continua a mesma e nenhuma ação é necessária.', { suave: true, margem: '0' })}
  `;

  const text =
    `Olá, ${nome}!\n\n` +
    `Recebemos um pedido para redefinir a senha da sua conta na Floria.\n\n` +
    `SEU CÓDIGO DE VERIFICAÇÃO: ${codigo}\n\n` +
    `Digite esse código na tela de verificação do site (válido por ${expiraMinutos} minutos, uso único).\n` +
    (quando ? `Solicitado em: ${quando}\n` : '') +
    `\nNão compartilhe este código com ninguém. A equipe da Floria nunca pede esse código por telefone, mensagem ou e-mail.\n\n` +
    `Não foi você? Pode ignorar este e-mail com segurança. Sua senha continua a mesma.\n\n` +
    `Floria - Plantas & Vasos`;

  return {
    subject: 'Seu código de verificação - Floria',
    text,
    html: renderLayout({ preheader: 'Use o código para redefinir sua senha. Ele vale por poucos minutos.', corpoHtml }),
  };
}

module.exports = template;
