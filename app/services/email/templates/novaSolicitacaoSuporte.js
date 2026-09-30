'use strict';

const { renderLayout, escapeHtml, icone, titulo, paragrafo, botao, detalhes, FONTE_TITULO, FONTE_CORPO, CORES } = require('./_layout');

const ROTULOS_CATEGORIA = {
  pedido: 'Pedido', entrega: 'Entrega', produto: 'Produto',
  pagamento: 'Pagamento', conta: 'Conta', outras: 'Outras dúvidas',
};

function template({ protocolo, nome, email, assunto, categoria, mensagem, criadoEm }) {
  const mensagemHtml = escapeHtml(mensagem).replace(/\n/g, '<br>');
  const categoriaTexto = categoria ? (ROTULOS_CATEGORIA[categoria] || categoria) : 'Não informada';

  const corpoHtml = `
    ${icone('&#128236;')}
    ${titulo('Nova solicitação de suporte')}
    <p style="margin:0 0 22px;text-align:center;font-family:${FONTE_CORPO};font-size:13px;letter-spacing:0.16em;text-transform:uppercase;font-weight:bold;color:${CORES.DOURADO_ESCURO};">Protocolo ${escapeHtml(protocolo)}</p>

    ${detalhes([
      ['Nome', escapeHtml(nome)],
      ['E-mail', `<a href="mailto:${escapeHtml(email)}" style="color:${CORES.VERDE_ESCURO};">${escapeHtml(email)}</a>`],
      ['Assunto', escapeHtml(assunto)],
      ['Categoria', escapeHtml(categoriaTexto)],
      ['Recebido em', escapeHtml(criadoEm)],
    ])}

    <p style="margin:6px 0 8px;font-family:${FONTE_CORPO};font-size:13px;color:${CORES.TEXTO_SUAVE};">Mensagem do cliente</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 6px;">
      <tr><td class="cx-suave" style="background:${CORES.AREIA};border-left:4px solid ${CORES.DOURADO};border-radius:8px;padding:16px 18px;font-family:${FONTE_CORPO};font-size:14px;line-height:1.7;color:${CORES.TEXTO};">${mensagemHtml}</td></tr>
    </table>

    ${botao('Responder ao cliente', `mailto:${email}?subject=${encodeURIComponent('Re: [Suporte ' + protocolo + '] ' + assunto)}`)}
    ${paragrafo('Também dá pra responder este e-mail diretamente: o campo "responder" já está configurado para o e-mail do cliente.', { alinhar: 'center', suave: true, margem: '0' })}
  `;

  const text =
    `Nova solicitação de suporte - ${protocolo}\n\n` +
    `Nome: ${nome}\n` +
    `E-mail: ${email}\n` +
    `Assunto: ${assunto}\n` +
    `Categoria: ${categoriaTexto}\n` +
    `Recebido em: ${criadoEm}\n\n` +
    `Mensagem:\n${mensagem}\n`;

  return {
    subject: `[Suporte ${protocolo}] ${assunto}`,
    text,
    html: renderLayout({ preheader: `Nova solicitação de ${nome} - ${assunto}`, corpoHtml }),
  };
}

module.exports = template;
