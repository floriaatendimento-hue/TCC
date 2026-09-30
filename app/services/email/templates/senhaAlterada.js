'use strict';

const { renderLayout, escapeHtml, urlSite, icone, titulo, paragrafo, caixa, botao, detalhes, CORES } = require('./_layout');

function template({ nome, quando, ip }) {
  const primeiroNome = escapeHtml(nome);
  const linkSuporte = urlSite('/suporte');

  const corpoHtml = `
    ${icone('&#9989;')}
    ${titulo('Senha alterada')}
    ${paragrafo(`Olá, <strong>${primeiroNome}</strong>! A senha da sua conta na Floria acabou de ser alterada.`, { alinhar: 'center', margem: '0 0 22px' })}

    ${detalhes([
      ['Quando', escapeHtml(quando)],
      ...(ip ? [['Endereço IP', escapeHtml(ip)]] : []),
    ])}

    ${paragrafo('Se foi você, não precisa fazer nada. Por segurança, encerramos as outras sessões abertas na sua conta.', { suave: true })}

    ${caixa(`<strong class="forte" style="color:${CORES.VERDE_ESCURO};">Não reconhece essa alteração?</strong><br>Alguém pode ter acessado sua conta. Fale com a gente agora para protegermos você${linkSuporte ? '.' : ' pela página de Suporte do site.'}`, { tom: 'alerta' })}
    ${linkSuporte ? botao('Falar com o suporte', linkSuporte) : ''}
  `;

  const text =
    `Olá, ${nome}!\n\n` +
    `A senha da sua conta na Floria foi alterada em ${quando}${ip ? ` (IP ${ip})` : ''}.\n\n` +
    `Se foi você, não precisa fazer nada.\n\n` +
    `Não reconhece essa alteração? Alguém pode ter acessado sua conta. Fale com a gente pela página de Suporte imediatamente${linkSuporte ? `: ${linkSuporte}` : '.'}\n\n` +
    `Floria - Plantas & Vasos`;

  return {
    subject: 'Sua senha foi alterada - Floria',
    text,
    html: renderLayout({ preheader: 'Confirmando: a senha da sua conta acabou de mudar.', corpoHtml }),
  };
}

module.exports = template;
