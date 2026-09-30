'use strict';

const promocoesService = require('../services/promocoesService');

function aplicarPrecoProduto(produto) {
  const resolvido = promocoesService.resolverPrecoProduto(produto);
  return {
    ...produto,
    preco_exibido: resolvido.precoFinal,
    preco_riscado: resolvido.temPromocao ? resolvido.precoOriginal : null,
    percentual_desconto: resolvido.percentual,
  };
}

function aplicarPrecoLista(produtos) {
  return (produtos || []).map(aplicarPrecoProduto);
}

module.exports = { aplicarPrecoProduto, aplicarPrecoLista };
