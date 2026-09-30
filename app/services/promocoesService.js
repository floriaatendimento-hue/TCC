'use strict';

const Promocao = require('../models/Promocao');
const dinheiro = require('../helpers/dinheiro');

let cache = { itens: [], carrinho: [] };

async function carregar() {
  try {
    const ativas = await Promocao.findAtivasComAlvos();
    cache = {
      itens: ativas.filter((p) => p.tipo !== 'valor_minimo_carrinho'),
      carrinho: ativas.filter((p) => p.tipo === 'valor_minimo_carrinho'),
    };
  } catch (err) {
    console.warn('⚠️  [promocoesService] Não foi possível carregar promoções, cache ficará vazio:', err.message);
    cache = { itens: [], carrinho: [] };
  }
  return cache;
}

async function invalidarCache() {
  return carregar();
}

const INTERVALO_RECARGA_MS = 15 * 60 * 1000;
let intervalo = null;

function iniciar() {
  if (intervalo) return;
  intervalo = setInterval(() => {
    carregar().catch((e) => console.error('[promocoesService] falha na recarga periódica:', e.message));
  }, INTERVALO_RECARGA_MS);
  if (typeof intervalo.unref === 'function') intervalo.unref();
}

function arredondar(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100;
}

function melhorDaLista(lista) {
  if (!lista.length) return null;
  return lista.reduce((melhor, atual) =>
    Number(atual.desconto_percentual) > Number(melhor.desconto_percentual) ? atual : melhor
  );
}

function resolverPrecoProduto(produto) {
  const precoOriginal = Number(produto.preco) || 0;

  const porProduto      = cache.itens.filter((p) => p.tipo === 'produto' && (p.produtoIds || []).includes(produto.id));
  const porSubcategoria = produto.subcategoria_id
    ? cache.itens.filter((p) => p.tipo === 'subcategoria' && Number(p.subcategoria_id) === Number(produto.subcategoria_id))
    : [];
  const porCategoria    = cache.itens.filter((p) => p.tipo === 'categoria' && Number(p.categoria_id) === Number(produto.categoria_id));
  const porValorMinimo  = cache.itens.filter((p) => p.tipo === 'valor_minimo_produto' && precoOriginal >= Number(p.valor_minimo));
  const porTodos        = cache.itens.filter((p) => p.tipo === 'todos');

  const vencedora = melhorDaLista(porProduto)
    || melhorDaLista(porSubcategoria)
    || melhorDaLista(porCategoria)
    || melhorDaLista(porValorMinimo)
    || melhorDaLista(porTodos)
    || null;

  const precoAutomatico = vencedora
    ? dinheiro.paraReais(dinheiro.comDescontoPercentual(dinheiro.paraCentavos(precoOriginal), vencedora.desconto_percentual))
    : null;
  const precoManual = produto.preco_promo != null ? Number(produto.preco_promo) : null;

  let precoFinal = precoOriginal;
  let origem = null;
  let promocaoId = null;
  let promocaoNome = null;

  if (precoAutomatico != null && (precoManual == null || precoAutomatico <= precoManual)) {
    precoFinal = precoAutomatico;
    origem = 'automatica';
    promocaoId = vencedora.id;
    promocaoNome = vencedora.nome;
  } else if (precoManual != null) {
    precoFinal = precoManual;
    origem = 'manual';
  }

  const temPromocao = precoFinal < precoOriginal;
  const percentual = temPromocao ? Math.round((1 - precoFinal / precoOriginal) * 100) : null;

  return { precoOriginal, precoFinal, temPromocao, origem, promocaoId, promocaoNome, percentual };
}

function resolverCarrinho(subtotal) {
  const sub = Number(subtotal) || 0;
  const elegiveis = cache.carrinho.filter((p) => sub >= Number(p.valor_minimo));
  const vencedora = melhorDaLista(elegiveis);
  if (!vencedora) return null;

  const subCentavos = dinheiro.paraCentavos(sub);
  const descontoCentavos = dinheiro.percentualDe(subCentavos, vencedora.desconto_percentual);
  const valorDesconto = dinheiro.paraReais(descontoCentavos < subCentavos ? descontoCentavos : subCentavos);
  return {
    promocaoId: vencedora.id,
    promocaoNome: vencedora.nome,
    percentual: Number(vencedora.desconto_percentual),
    valorDesconto,
  };
}

module.exports = { carregar, invalidarCache, iniciar, resolverPrecoProduto, resolverCarrinho };
