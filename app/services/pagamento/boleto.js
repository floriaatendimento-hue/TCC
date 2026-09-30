'use strict';

const BANCO_MOCK = '999';
const MOEDA_REAL = '9';
const BASE_FATOR_VENCIMENTO = new Date(1997, 9, 7); // 07/10/1997 — data-base oficial

function fatorVencimento(dataVencimento) {
  const dias = Math.floor((dataVencimento - BASE_FATOR_VENCIMENTO) / 86_400_000);
  return String(Math.max(0, dias)).padStart(4, '0').slice(-4);
}

function valorCampo(valor) {
  return String(Math.round(Number(valor) * 100)).padStart(10, '0').slice(-10);
}

function dvGeralModulo11(digitos43) {
  const pesos = [2, 3, 4, 5, 6, 7, 8, 9];
  let soma = 0;
  let pesoIdx = 0;
  for (let i = digitos43.length - 1; i >= 0; i--) {
    soma += Number(digitos43[i]) * pesos[pesoIdx % pesos.length];
    pesoIdx++;
  }
  const resto = soma % 11;
  const dv = 11 - resto;
  return (dv === 0 || dv === 10 || dv === 11) ? 1 : dv;
}

function mod10(digitos) {
  let soma = 0;
  let peso = 2;
  for (let i = digitos.length - 1; i >= 0; i--) {
    let produto = Number(digitos[i]) * peso;
    if (produto > 9) produto -= 9;
    soma += produto;
    peso = peso === 2 ? 1 : 2;
  }
  const resto = soma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

function nossoNumero(pedidoId) {
  return String(pedidoId).padStart(12, '0').slice(-12);
}

function gerarCodigoBarras({ pedidoId, valor, vencimento }) {
  const campoLivre =
    '0001' +                 // agência fictícia
    '0000001' +               // conta fictícia
    nossoNumero(pedidoId) +   // referência ao pedido
    '09';                     // carteira fictícia

  const semDv =
    BANCO_MOCK +
    MOEDA_REAL +
    fatorVencimento(vencimento) +
    valorCampo(valor) +
    campoLivre;

  const dv = dvGeralModulo11(semDv);
  return `${BANCO_MOCK}${MOEDA_REAL}${dv}${fatorVencimento(vencimento)}${valorCampo(valor)}${campoLivre}`;
}

function gerarLinhaDigitavel(codigoBarras) {
  const banco = codigoBarras.slice(0, 3);
  const moeda = codigoBarras.slice(3, 4);
  const dvGeral = codigoBarras.slice(4, 5);
  const fator = codigoBarras.slice(5, 9);
  const valor = codigoBarras.slice(9, 19);
  const campoLivre = codigoBarras.slice(19, 44);

  const campo1Base = banco + moeda + campoLivre.slice(0, 5);
  const campo2Base = campoLivre.slice(5, 15);
  const campo3Base = campoLivre.slice(15, 25);

  const campo1 = campo1Base + mod10(campo1Base);
  const campo2 = campo2Base + mod10(campo2Base);
  const campo3 = campo3Base + mod10(campo3Base);
  const campo5 = fator + valor;

  const formatado =
    `${campo1.slice(0, 5)}.${campo1.slice(5)} ` +
    `${campo2.slice(0, 5)}.${campo2.slice(5)} ` +
    `${campo3.slice(0, 5)}.${campo3.slice(5)} ` +
    `${dvGeral} ${campo5}`;

  return { linha: campo1 + campo2 + campo3 + dvGeral + campo5, formatada: formatado };
}

function calcularVencimento(agora = new Date()) {
  const d = new Date(agora);
  d.setDate(d.getDate() + 3);
  d.setHours(23, 59, 59, 0);
  return d;
}

function gerarExibicao({ pedidoId, valor, vencimento }) {
  const dataVencimento = vencimento || calcularVencimento();
  const codigoBarras = gerarCodigoBarras({ pedidoId, valor, vencimento: dataVencimento });
  const { formatada } = gerarLinhaDigitavel(codigoBarras);
  return { codigoBarras, linhaDigitavel: formatada, vencimento: dataVencimento };
}

function calcularJanela(agora = new Date()) {
  return {
    processaEm: new Date(agora.getTime() + 20_000),
    confirmaEm: new Date(agora.getTime() + 45_000),
    expiraEm:   calcularVencimento(agora),
  };
}

module.exports = { gerarCodigoBarras, gerarLinhaDigitavel, gerarExibicao, calcularVencimento, calcularJanela };
