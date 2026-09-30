'use strict';

const IMAGEM_PADRAO = '/imagens/image.png';

function resolverImagemUrl(valor, fallback = IMAGEM_PADRAO) {
  if (typeof valor !== 'string') return fallback;
  const limpo = valor.trim();
  if (!limpo) return fallback;
  if (/^(https?:)?\/\//i.test(limpo)) return limpo;
  if (limpo.startsWith('/')) return limpo;
  return '/imagens/' + limpo;
}

module.exports = { resolverImagemUrl, IMAGEM_PADRAO };
