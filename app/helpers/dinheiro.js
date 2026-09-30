'use strict';

const CENTAVOS_MAX = 999999999999n;

function erroValor(mensagem) {
  const erro = new Error(mensagem);
  erro.code = 'VALOR_INVALIDO';
  return erro;
}

function textoDecimal(valor) {
  if (typeof valor === 'bigint') return valor.toString();
  let texto;
  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) throw erroValor('Valor numérico inválido.');
    texto = String(valor);
    if (/e/i.test(texto)) texto = valor.toFixed(12);
  } else {
    texto = String(valor).trim().replace(',', '.');
  }
  if (!/^[+-]?\d+(\.\d*)?$/.test(texto)) throw erroValor('Valor numérico inválido.');
  return texto;
}

function escalar(valor, casas) {
  if (valor === null || valor === undefined || valor === '') return 0n;
  const m = /^([+-]?)(\d+)(?:\.(\d*))?$/.exec(textoDecimal(valor));
  const negativo = m[1] === '-';
  const fracao = m[3] || '';
  let inteiro = BigInt(m[2]) * (10n ** BigInt(casas)) + BigInt((fracao + '0'.repeat(casas)).slice(0, casas) || '0');
  if (fracao.length > casas && fracao[casas] >= '5') inteiro += 1n;
  return negativo ? -inteiro : inteiro;
}

function paraCentavos(valor) {
  return escalar(valor, 2);
}

function paraReais(centavos) {
  return Number(centavos) / 100;
}

function multiplicar(quantidade, precoUnit) {
  const milesimos = escalar(quantidade, 3);
  const produto = milesimos * paraCentavos(precoUnit); // em 1/100000 de real
  const positivo = produto < 0n ? -produto : produto;
  const arredondado = (positivo + 500n) / 1000n;
  return produto < 0n ? -arredondado : arredondado;
}

function percentualDe(centavos, percentual) {
  const produto = centavos * escalar(percentual, 2); // centavos ×
  const positivo = produto < 0n ? -produto : produto;
  const arredondado = (positivo + 5000n) / 10000n;
  return produto < 0n ? -arredondado : arredondado;
}

function comDescontoPercentual(centavos, percentual) {
  return (centavos * (10000n - escalar(percentual, 2)) + 5000n) / 10000n;
}

function dividirEmParcelas(totalCentavos, n) {
  if (totalCentavos < BigInt(n)) {
    throw erroValor(`O valor total (R$ ${formatarBRL(totalCentavos)}) é baixo demais para ${n} parcelas: cada parcela precisa ter pelo menos R$ 0,01.`);
  }
  const nn = BigInt(n);
  const base = totalCentavos / nn;
  const resto = Number(totalCentavos % nn);
  return Array.from({ length: n }, (_, i) => (i < resto ? base + 1n : base));
}

function garantirLimite(centavos, rotulo) {
  if (centavos > CENTAVOS_MAX) {
    throw erroValor(`${rotulo} excede o valor máximo permitido (R$ 9.999.999.999,99).`);
  }
  return centavos;
}

function formatarBRL(centavos) {
  const negativo = centavos < 0n;
  const abs = negativo ? -centavos : centavos;
  const inteiro = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${negativo ? '-' : ''}${inteiro},${(abs % 100n).toString().padStart(2, '0')}`;
}

module.exports = {
  CENTAVOS_MAX, paraCentavos, paraReais, multiplicar, percentualDe, comDescontoPercentual,
  dividirEmParcelas, garantirLimite, formatarBRL,
};
