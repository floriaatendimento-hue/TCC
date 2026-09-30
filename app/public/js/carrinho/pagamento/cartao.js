(function (window) {
  'use strict';

  const BANDEIRAS = [
    { nome: 'Visa',       regex: /^4/ },
    { nome: 'Mastercard', regex: /^(5[1-5]|22[2-9]|2[3-6]\d|27[01]\d|2720)/ },
    { nome: 'Elo',        regex: /^(4011|4312|4389|4514|4573|6277|6362|6363|6504|6505|6506|6507|6509|6516|6550)/ },
    { nome: 'Amex',       regex: /^3[47]/ },
  ];

  function apenasDigitos(v) {
    return String(v || '').replace(/\D/g, '');
  }

  function luhnValido(numero) {
    const digitos = apenasDigitos(numero);
    if (digitos.length < 13 || digitos.length > 19) return false;
    let soma = 0;
    let dobrar = false;
    for (let i = digitos.length - 1; i >= 0; i--) {
      let d = Number(digitos[i]);
      if (dobrar) { d *= 2; if (d > 9) d -= 9; }
      soma += d;
      dobrar = !dobrar;
    }
    return soma % 10 === 0;
  }

  function numeroSimuladoValido(numero) {
    const tamanho = apenasDigitos(numero).length;
    return tamanho >= 13 && tamanho <= 19;
  }

  function detectarBandeira(numero) {
    const digitos = apenasDigitos(numero);
    const encontrada = BANDEIRAS.find((b) => b.regex.test(digitos));
    return encontrada ? encontrada.nome : null;
  }

  function formatarNumero(valor) {
    return apenasDigitos(valor).slice(0, 19).replace(/(\d{4})(?=\d)/g, '$1 ').trim();
  }

  function formatarValidade(valor) {
    const digitos = apenasDigitos(valor).slice(0, 4);
    return digitos.length > 2 ? `${digitos.slice(0, 2)}/${digitos.slice(2)}` : digitos;
  }

  function validadeValida(validade) {
    const m = String(validade || '').match(/^(\d{2})\/(\d{2})$/);
    if (!m) return false;
    const mes = Number(m[1]);
    if (mes < 1 || mes > 12) return false;
    const ano = 2000 + Number(m[2]);
    const fimDoMes = new Date(ano, mes, 0, 23, 59, 59);
    return fimDoMes >= new Date();
  }

  function cvvValido(cvv, bandeira) {
    const digitos = apenasDigitos(cvv);
    const tamanhoEsperado = bandeira === 'Amex' ? 4 : 3;
    return digitos.length === tamanhoEsperado;
  }

  window.PagamentoCartao = {
    apenasDigitos, luhnValido, numeroSimuladoValido, detectarBandeira, formatarNumero, formatarValidade, validadeValida, cvvValido,
  };
})(window);
