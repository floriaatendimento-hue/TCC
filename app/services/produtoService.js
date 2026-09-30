'use strict';

const Produto = require('../models/Produto');
const { processarImagemProduto, removerImagemProduto } = require('../middlewares/uploadProdutos');

function gerarSlug(nome) {
  return String(nome).toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

async function criarProduto(dadosBody, arquivosPorCampo) {
  const imagensGravadas = [];
  try {
    const camposImagem = ['imagem_1', 'imagem_2', 'imagem_3'];
    const urlsOrdenadas = await Promise.all(camposImagem.map(async (campo) => {
      const arquivo = arquivosPorCampo[campo][0];
      const url = await processarImagemProduto(arquivo.buffer, arquivo.mimetype);
      imagensGravadas.push(url);
      return url;
    }));

    const slug = dadosBody.slug || gerarSlug(dadosBody.nome);
    const id = await Produto.create({
      ...dadosBody,
      slug,
      imagem: urlsOrdenadas[0],
      imagem_2: urlsOrdenadas[1],
      imagem_3: urlsOrdenadas[2],
    });
    return id;
  } catch (err) {
    imagensGravadas.forEach(removerImagemProduto);
    throw err;
  }
}

async function atualizarProduto(id, dadosBody, arquivosPorCampo) {
  const imagensNovas = {};
  try {
    const produtoAtual = await Produto.findByIdAdmin(id);
    if (!produtoAtual) return { ok: false, motivo: 'NAO_ENCONTRADO' };

    const dados = { ...dadosBody };
    const mapaColuna = { imagem_1: 'imagem', imagem_2: 'imagem_2', imagem_3: 'imagem_3' };
    for (const [campo, coluna] of Object.entries(mapaColuna)) {
      const arquivo = arquivosPorCampo && arquivosPorCampo[campo] && arquivosPorCampo[campo][0];
      if (arquivo) {
        imagensNovas[coluna] = await processarImagemProduto(arquivo.buffer, arquivo.mimetype);
        dados[coluna] = imagensNovas[coluna];
      }
    }

    const rows = await Produto.update(id, dados);
    if (!rows) return { ok: false, motivo: 'NAO_ENCONTRADO' };

    for (const [coluna, urlNova] of Object.entries(imagensNovas)) {
      if (produtoAtual[coluna] && produtoAtual[coluna] !== urlNova) removerImagemProduto(produtoAtual[coluna]);
    }

    return { ok: true, produtoAntes: produtoAtual, dados };
  } catch (err) {
    Object.values(imagensNovas).forEach(removerImagemProduto);
    throw err;
  }
}

module.exports = { criarProduto, atualizarProduto };
