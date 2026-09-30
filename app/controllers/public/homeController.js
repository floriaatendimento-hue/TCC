'use strict';

const Produto = require('../../models/Produto');
const Banner = require('../../models/Banner');
const BuscaLog = require('../../models/BuscaLog');
const { aplicarPrecoLista } = require('../../helpers/precoView');

exports.paginaInicial = async (req, res) => {
  let banners = [];
  let maisVendidos = [];
  try {
    banners = await Banner.findAtivos();
  } catch (err) {
    console.error('Erro ao carregar banners da home:', err.message);
  }
  try {
    maisVendidos = aplicarPrecoLista(await Produto.buscarMaisVendidos({ limite: 10 }));
  } catch (err) {
    console.error('Erro ao carregar mais vendidos da home:', err.message);
  }
  res.render('pages/Home', { banners, maisVendidos });
};

exports.buscar = async (req, res) => {
  const q           = String(req.query.q || '').trim().slice(0, 100);
  const categoria   = String(req.query.categoria || '').trim().slice(0, 50);
  const petFriendly = ['1', 'true'].includes(String(req.query.petFriendly || '').toLowerCase());
  const poucaLuz    = ['1', 'true'].includes(String(req.query.poucaLuz || '').toLowerCase());
  const semFiltros   = !q && !categoria && !petFriendly && !poucaLuz;
  const somenteTexto = !!q && !categoria && !petFriendly && !poucaLuz;

  try {
    let resultados;
    if (semFiltros) {
      resultados = await Produto.findDestaque(12);
    } else if (somenteTexto) {
      resultados = await Produto.search(q, 40);
    } else {
      resultados = await Produto.buscarComFiltros({ q, categoria, petFriendly, poucaLuz, limite: 200 });
    }

    const vistos = new Set();
    const produtos = aplicarPrecoLista(resultados.filter((p) => {
      if (vistos.has(p.id)) return false;
      vistos.add(p.id);
      return true;
    }));

    if (q) BuscaLog.registrar(q, produtos.length, req.session?.usuario?.id);

    res.render('pages/busca', { q, categoria, petFriendly, poucaLuz, produtos });
  } catch (err) {
    res.render('pages/busca', { q, categoria, petFriendly, poucaLuz, produtos: [] });
  }
};
