'use strict';

const Categoria = require('../../models/Categoria');

let cache = [];

async function carregar() {
  try {
    cache = await Categoria.findAllAtivas();
  } catch (err) {
    console.warn('⚠️  [categoriasNavCache] Não foi possível carregar categorias do banco:', err.message);
    cache = [];
  }
  return cache;
}

function obter() {
  return cache;
}

module.exports = { carregar, obter };
