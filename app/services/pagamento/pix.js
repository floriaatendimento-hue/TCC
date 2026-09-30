'use strict';

const QRCode = require('qrcode');

const CHAVE_PIX_MOCK   = 'pagamentos@floria.com.br';
const NOME_RECEBEDOR   = 'FLORIA PLANTAS E VASOS';
const CIDADE_RECEBEDOR = 'SAO PAULO';

function normalizarTexto(v, max) {
  return String(v || '')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .toUpperCase()
    .trim()
    .slice(0, max);
}

function tlv(id, valor) {
  const tamanho = String(valor.length).padStart(2, '0');
  return `${id}${tamanho}${valor}`;
}

function crc16ccitt(payload) {
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xFFFF : (crc << 1) & 0xFFFF;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function gerarPayloadCopiaCola({ pedidoId, valor }) {
  const txid = `PED${pedidoId}`.slice(0, 25);
  const nome = normalizarTexto(NOME_RECEBEDOR, 25) || 'FLORIA';
  const cidade = normalizarTexto(CIDADE_RECEBEDOR, 15) || 'SAO PAULO';

  const contaPix = tlv('00', 'br.gov.bcb.pix') + tlv('01', CHAVE_PIX_MOCK);

  const semCrc =
    tlv('00', '01') +                       // Payload Format Indicator
    tlv('26', contaPix) +                   // Merchant Account Information — Pix
    tlv('52', '0000') +                     // Merchant Category Code
    tlv('53', '986') +                      // Moeda
    tlv('54', Number(valor).toFixed(2)) +   // Valor da transação
    tlv('58', 'BR') +                       // País
    tlv('59', nome) +                       // Nome do recebedor
    tlv('60', cidade) +                     // Cidade do recebedor
    tlv('62', tlv('05', txid)) +            // Additional Data Field
    '6304';                                 // ID+tamanho do CRC

  return semCrc + crc16ccitt(semCrc);
}

async function gerarExibicao({ pedidoId, valor }) {
  const payload = gerarPayloadCopiaCola({ pedidoId, valor });
  let qrDataUrl = null;
  try {
    qrDataUrl = await QRCode.toDataURL(payload, { margin: 1, width: 220 });
  } catch (err) {
    console.error('[pagamento/pix] Falha ao gerar QR code:', err.message);
  }
  return { payload, qrDataUrl };
}

function calcularJanela(agora = new Date()) {
  return {
    processaEm: new Date(agora.getTime() + 4_000),
    confirmaEm: new Date(agora.getTime() + 8_000),
    expiraEm:   new Date(agora.getTime() + 30 * 60_000),
  };
}

module.exports = { gerarPayloadCopiaCola, gerarExibicao, calcularJanela };
