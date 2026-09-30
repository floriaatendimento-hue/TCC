'use strict';

const db = require('../../config/db');

class CategoriaAcesso {
  static async registrar(categoria_slug) {
    const slug = String(categoria_slug || '').trim().slice(0, 80);
    if (!slug) return;
    try {
      await db.query('INSERT INTO categoria_acessos (categoria_slug) VALUES (?)', [slug]);
    } catch (err) {
      console.error('Erro ao registrar acesso de categoria:', err.message);
    }
  }

  static async serieTrafego(periodo = '30d') {
    const agora = new Date();
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const pad = n => String(n).padStart(2, '0');

    const config = {
      '24h': { unidade: 'hora', qtdBuckets: 24 },
      '7d':  { unidade: 'dia',  qtdBuckets: 7 },
      '30d': { unidade: 'dia',  qtdBuckets: 30 },
      '12m': { unidade: 'mes',  qtdBuckets: 12 },
    }[periodo] || { unidade: 'dia', qtdBuckets: 30 };

    function inicioBucket(offsetDoFim) {
      if (config.unidade === 'hora') {
        const d = new Date(agora); d.setMinutes(0, 0, 0);
        d.setHours(d.getHours() - offsetDoFim);
        return d;
      }
      if (config.unidade === 'dia') {
        const d = new Date(agora); d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - offsetDoFim);
        return d;
      }
      return new Date(agora.getFullYear(), agora.getMonth() - offsetDoFim, 1);
    }

    function chaveBucket(d) {
      if (config.unidade === 'hora') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}`;
      if (config.unidade === 'dia')  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    }

    function rotuloBucket(d) {
      if (config.unidade === 'hora') return pad(d.getHours()) + 'h';
      if (config.unidade === 'dia')  return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
      return MESES[d.getMonth()];
    }

    const formatoSql = config.unidade === 'hora' ? '%Y-%m-%d %H'
                      : config.unidade === 'dia'  ? '%Y-%m-%d'
                      : '%Y-%m';

    const inicioConsulta = inicioBucket(config.qtdBuckets * 2 - 1);
    const [rows] = await db.query(
      `SELECT DATE_FORMAT(criado_em, ?) AS bucket, COUNT(*) AS total
         FROM categoria_acessos
        WHERE criado_em >= ?
        GROUP BY bucket`,
      [formatoSql, inicioConsulta]
    );
    const mapa = new Map(rows.map(r => [r.bucket, Number(r.total) || 0]));

    const serie = [];
    for (let i = config.qtdBuckets - 1; i >= 0; i--) {
      const d = inicioBucket(i);
      serie.push({ label: rotuloBucket(d), total: mapa.get(chaveBucket(d)) || 0 });
    }

    let totalAnterior = 0;
    for (let i = config.qtdBuckets * 2 - 1; i >= config.qtdBuckets; i--) {
      totalAnterior += mapa.get(chaveBucket(inicioBucket(i))) || 0;
    }

    return {
      serie,
      totalAtual: serie.reduce((s, b) => s + b.total, 0),
      totalAnterior,
      maiorValor: Math.max(1, ...serie.map(b => b.total)),
    };
  }

  static async maisAcessadasPeriodo(dataInicio, dataFim) {
    const [acessos] = await db.query(
      `SELECT categoria_slug, COUNT(*) AS qtd_acessos
         FROM categoria_acessos
        WHERE DATE(criado_em) BETWEEN ? AND ?
        GROUP BY categoria_slug
        ORDER BY qtd_acessos DESC`,
      [dataInicio, dataFim]
    );
    if (!acessos.length) return [];

    const [vendasRows] = await db.query(
      `SELECT c.slug AS categoria_slug, SUM(i.quantidade) AS qtd_vendas
         FROM itens_pedido i
         JOIN pedidos p   ON p.id = i.pedido_id
         JOIN produtos pr ON pr.id = i.produto_id
         JOIN categorias c ON c.id = pr.categoria_id
        WHERE p.status_pagamento = 'aprovado'
          AND DATE(p.criado_em) BETWEEN ? AND ?
        GROUP BY c.slug`,
      [dataInicio, dataFim]
    );
    const mapaVendas = {};
    vendasRows.forEach(r => { mapaVendas[r.categoria_slug] = Number(r.qtd_vendas) || 0; });

    const [categorias] = await db.query('SELECT slug, nome FROM categorias');
    const mapaNomes = {};
    categorias.forEach(c => { mapaNomes[c.slug] = c.nome; });

    return acessos.map(a => ({
      categoria_slug: a.categoria_slug,
      categoria_nome: mapaNomes[a.categoria_slug] || a.categoria_slug,
      qtd_acessos: Number(a.qtd_acessos) || 0,
      qtd_vendas: mapaVendas[a.categoria_slug] || 0,
    }));
  }
}

module.exports = CategoriaAcesso;
