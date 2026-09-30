'use strict';

const VERDE_ESCURO = '#0E3124';
const VERDE_MEDIO = '#154030';
const VERDE_SUAVE = '#E8F5EE';
const DOURADO = '#B8945F';
const DOURADO_ESCURO = '#846339'; // texto dourado legível
const DOURADO_CLARO = '#D4B483';
const CREME = '#F4F1EA';
const PAPEL = '#FFFFFF';
const AREIA = '#FBFAF7';
const TEXTO = '#1C1A16';
const TEXTO_SUAVE = '#5B5648';
const BORDA = '#E4DFD3';
const ALERTA_FUNDO = '#FDF3E3';
const ALERTA_BORDA = '#E8B96A';

const FONTE_TITULO = "Georgia,'Times New Roman',serif";
const FONTE_CORPO = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

const { urlSite } = require('../../../helpers/siteUrl'); // fonte única

/* Componentes */

function icone(emoji, { fundo = VERDE_SUAVE } = {}) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:0 auto 20px;">
    <tr><td class="ic" align="center" valign="middle" width="72" height="72" style="width:72px;height:72px;border-radius:36px;background:${fundo};font-size:32px;line-height:72px;text-align:center;">${emoji}</td></tr>
  </table>`;
}

function titulo(texto) {
  return `<h1 class="tx-titulo" style="margin:0 0 10px;font-family:${FONTE_TITULO};font-size:28px;line-height:1.25;font-weight:normal;color:${VERDE_ESCURO};text-align:center;">${escapeHtml(texto)}</h1>`;
}

function paragrafo(html, { alinhar = 'left', suave = false, margem = '0 0 16px' } = {}) {
  return `<p class="${suave ? 'tx-suave' : 'tx'}" style="margin:${margem};font-family:${FONTE_CORPO};font-size:15px;line-height:1.65;color:${suave ? TEXTO_SUAVE : TEXTO};text-align:${alinhar};">${html}</p>`;
}

function caixa(html, { tom = 'suave' } = {}) {
  const cores = tom === 'alerta'
    ? { fundo: ALERTA_FUNDO, barra: ALERTA_BORDA, cls: 'cx-alerta' }
    : { fundo: VERDE_SUAVE, barra: VERDE_MEDIO, cls: 'cx-suave' };
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0;">
    <tr><td class="${cores.cls}" style="background:${cores.fundo};border-left:4px solid ${cores.barra};border-radius:8px;padding:14px 18px;font-family:${FONTE_CORPO};font-size:14px;line-height:1.6;color:${TEXTO_SUAVE};">${html}</td></tr>
  </table>`;
}

function botao(texto, url, { fundo = VERDE_ESCURO } = {}) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:26px auto;">
    <tr><td class="bt" align="center" bgcolor="${fundo}" style="border-radius:999px;background:${fundo};">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:15px 34px;font-family:${FONTE_CORPO};font-size:14px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#FFFFFF;text-decoration:none;border-radius:999px;">${escapeHtml(texto)}</a>
    </td></tr>
  </table>`;
}

function detalhes(itens) {
  const linhas = itens.map(([rotulo, valor], i) => `
      <tr>
        <td class="ln" width="120" valign="top" style="padding:11px 0;${i ? `border-top:1px solid ${BORDA};` : ''}font-family:${FONTE_CORPO};font-size:13px;color:${TEXTO_SUAVE};">${escapeHtml(rotulo)}</td>
        <td class="ln" valign="top" style="padding:11px 0;${i ? `border-top:1px solid ${BORDA};` : ''}font-family:${FONTE_CORPO};font-size:14px;color:${TEXTO};">${valor}</td>
      </tr>`).join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;">${linhas}
  </table>`;
}

function renderLayout({ preheader = '', corpoHtml }) {
  const site = urlSite();
  const enchimento = '&#847;&zwnj;&nbsp;'.repeat(60);

  return `<!DOCTYPE html>
<html lang="pt-BR" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>Floria</title>
<style>
  @media only screen and (max-width:600px) {
    .cartao { width:100% !important; border-radius:0 !important; border-left:0 !important; border-right:0 !important; }
    .miolo { padding:32px 22px !important; }
    .fora { padding:0 !important; }
    .tx-titulo { font-size:24px !important; }
    .codigo { font-size:32px !important; letter-spacing:0.22em !important; padding:16px 12px 16px 22px !important; }
  }
  @media (prefers-color-scheme: dark) {
    body, .fundo { background:#0B120E !important; }
    .cartao { background:#16201A !important; border-color:#26362D !important; }
    .miolo { background:#16201A !important; }
    .tx { color:#ECE8DF !important; }
    .tx-suave, .ln { color:#B7B2A3 !important; }
    .tx-titulo { color:#F1EDE2 !important; }
    .ic { background:#1F3A2C !important; }
    .cx-suave { background:#1F3A2C !important; color:#CFE3D6 !important; border-left-color:#5FAF87 !important; }
    .cx-alerta { background:#3A2E18 !important; color:#F0DDB8 !important; }
    .forte { color:#F6E7C6 !important; }
    .codigo-caixa { background:#1F3A2C !important; border-color:#5FAF87 !important; }
    .codigo { color:#F1EDE2 !important; }
    .rodape { background:#111A15 !important; border-top-color:#26362D !important; }
    .rodape-txt { color:#98937F !important; }
    .bt { background:#5FAF87 !important; }
    .bt a { color:#0B120E !important; }
  }
</style>
</head>
<body class="fundo" style="margin:0;padding:0;background:${CREME};font-family:${FONTE_CORPO};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:${CREME};">${escapeHtml(preheader)}${enchimento}</div>
  <table role="presentation" class="fundo" width="100%" cellpadding="0" cellspacing="0" style="background:${CREME};">
    <tr>
      <td class="fora" align="center" style="padding:32px 16px;">
        <table role="presentation" class="cartao" width="560" cellpadding="0" cellspacing="0" style="width:560px;max-width:560px;background:${PAPEL};border:1px solid ${BORDA};border-radius:20px;overflow:hidden;">
          <tr>
            <td align="center" bgcolor="${VERDE_ESCURO}" style="background:${VERDE_ESCURO};background-image:linear-gradient(135deg,${VERDE_ESCURO} 0%,${VERDE_MEDIO} 100%);padding:34px 28px 28px;">
              <span style="font-family:${FONTE_TITULO};font-size:34px;line-height:1;letter-spacing:0.04em;color:#FFFFFF;">Floria</span>
              <table role="presentation" cellpadding="0" cellspacing="0" align="center" style="margin:12px auto 0;">
                <tr>
                  <td width="34" style="width:34px;border-top:1px solid ${DOURADO};font-size:0;line-height:0;">&nbsp;</td>
                  <td style="padding:0 12px;font-family:${FONTE_CORPO};font-size:11px;letter-spacing:0.28em;text-transform:uppercase;color:${DOURADO_CLARO};white-space:nowrap;">Plantas &amp; Vasos</td>
                  <td width="34" style="width:34px;border-top:1px solid ${DOURADO};font-size:0;line-height:0;">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td bgcolor="${DOURADO}" height="3" style="height:3px;background:${DOURADO};font-size:0;line-height:0;">&nbsp;</td></tr>
          <tr>
            <td class="miolo" style="padding:40px 44px 36px;background:${PAPEL};font-family:${FONTE_CORPO};color:${TEXTO};font-size:15px;line-height:1.65;">
              ${corpoHtml}
            </td>
          </tr>
          <tr>
            <td class="rodape" align="center" style="padding:24px 32px 28px;background:${AREIA};border-top:1px solid ${BORDA};">
              <p class="rodape-txt" style="margin:0 0 6px;font-family:${FONTE_TITULO};font-size:15px;color:${VERDE_ESCURO};letter-spacing:0.03em;">Floria &middot; Plantas &amp; Vasos</p>
              <p class="rodape-txt" style="margin:0;font-family:${FONTE_CORPO};font-size:12px;line-height:1.6;color:${TEXTO_SUAVE};">Este é um e-mail automático, por favor não responda.<br>Se você não reconhece esta solicitação, apenas ignore esta mensagem.${site ? `<br><a href="${escapeHtml(site)}" style="color:${DOURADO_ESCURO};text-decoration:underline;">Visitar a loja</a>` : ''}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

module.exports = {
  renderLayout, escapeHtml, urlSite,
  icone, titulo, paragrafo, caixa, botao, detalhes,
  FONTE_TITULO, FONTE_CORPO,
  CORES: { VERDE_ESCURO, VERDE_MEDIO, VERDE_SUAVE, DOURADO, DOURADO_ESCURO, DOURADO_CLARO, CREME, PAPEL, AREIA, TEXTO, TEXTO_SUAVE, BORDA, ALERTA_FUNDO, ALERTA_BORDA },
};
