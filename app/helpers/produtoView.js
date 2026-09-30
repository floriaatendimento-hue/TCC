'use strict';

const { cuidadosPara } = require('./cuidadosPadrao');
const promocoesService = require('../services/promocoesService');
const { resolverImagemUrl } = require('./imagemUrl');

function parseJsonDefensivo(valor) {
  if (valor == null) return null;
  if (typeof valor !== 'string') return valor;
  try { return JSON.parse(valor); } catch (e) { return null; }
}

function montarProdutoView(produto) {
  const slug = produto.slug_pagina || produto.slug;
  const categoriaSlug = produto.categoria_slug || null;

  const resolvidoPreco = promocoesService.resolverPrecoProduto(produto);
  const precoAtual  = resolvidoPreco.precoFinal;
  const precoAntigo = resolvidoPreco.temPromocao ? resolvidoPreco.precoOriginal : null;
  const percentualDesconto = resolvidoPreco.percentual;
  const promocaoNome = resolvidoPreco.origem === 'automatica' ? resolvidoPreco.promocaoNome : null;

  const imagens = [produto.imagem, produto.imagem_2, produto.imagem_3]
    .map((valor) => resolverImagemUrl(valor));
  while (imagens.length < 3) imagens.push(imagens[imagens.length - 1] || '/imagens/image.png');

  const especificacoes = parseJsonDefensivo(produto.especificacoes) || {};
  const ficha = Object.keys(especificacoes).map((chave) => ({ rotulo: chave, valor: especificacoes[chave] }));

  const cuidados = parseJsonDefensivo(produto.cuidados);
  const variacoes = parseJsonDefensivo(produto.variacoes) || [];

  const tags = (produto.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((texto) => ({ icone: 'fas fa-check', texto }));

  return {
    slug,
    nome: produto.nome,
    sku: produto.sku || null,
    marca: produto.marca || null,
    categoriaNome: produto.categoria_nome || null,
    categoriaSlug,
    subcategoriaNome: produto.subcategoria_nome || null,
    imagens: imagens.map((src) => ({ src, alt: produto.nome })),
    precoAtual,
    precoAntigo,
    percentualDesconto,
    promocaoNome,
    parcelasTexto: precoAtual >= 10 ? 'em até 3x sem juros' : null,
    estoque: produto.estoque != null ? Number(produto.estoque) : null,
    estoqueMinimo: produto.estoque_minimo != null ? Number(produto.estoque_minimo) : null,
    avaliacaoEstrelas: '<i class="far fa-star" aria-hidden="true"></i>'.repeat(5),
    avaliacaoTexto: 'Sem avaliações',
    variacoes,
    tags,
    descricao: produto.descricao || null,
    beneficios: produto.beneficios || null,
    comoUtilizar: produto.como_utilizar || null,
    recomendacoes: produto.recomendacoes || null,
    ficha,
    cuidados: (cuidados && cuidados.length) ? cuidados : cuidadosPara(categoriaSlug),
  };
}

module.exports = { montarProdutoView };
