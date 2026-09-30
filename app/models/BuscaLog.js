'use strict';

const db = require('../../config/db');

class BuscaLog {
  static async registrar(termo, resultados = 0, usuario_id = null) {
    const termoLimpo = String(termo || '').trim().slice(0, 100);
    if (!termoLimpo) return;
    try {
      await db.query(
        'INSERT INTO buscas_log (termo, resultados, usuario_id) VALUES (?, ?, ?)',
        [termoLimpo, Number(resultados) || 0, usuario_id || null]
      );
    } catch (err) {
      console.error('Erro ao registrar busca:', err.message);
    }
  }

  static async maisPesquisadosPeriodo(dataInicio, dataFim, limite = 30) {
    const [rows] = await db.query(
      `SELECT termo, COUNT(*) AS qtd FROM buscas_log
        WHERE DATE(criado_em) BETWEEN ? AND ?
        GROUP BY termo
        ORDER BY qtd DESC
        LIMIT ?`,
      [dataInicio, dataFim, limite]
    );
    if (!rows.length) return [];

    const dias = Math.round((new Date(dataFim) - new Date(dataInicio)) / 86400000) + 1;
    const anteriorFim = new Date(dataInicio);
    anteriorFim.setDate(anteriorFim.getDate() - 1);
    const anteriorInicio = new Date(anteriorFim);
    anteriorInicio.setDate(anteriorInicio.getDate() - (dias - 1));
    const fmtISO = (d) => d.toISOString().slice(0, 10);

    const [anterioresRows] = await db.query(
      `SELECT termo, COUNT(*) AS qtd FROM buscas_log
        WHERE DATE(criado_em) BETWEEN ? AND ?
        GROUP BY termo`,
      [fmtISO(anteriorInicio), fmtISO(anteriorFim)]
    );
    const mapaAnterior = {};
    anterioresRows.forEach(r => { mapaAnterior[r.termo] = Number(r.qtd); });

    return Promise.all(rows.map(async (r) => {
      const [match] = await db.query(
        `SELECT nome FROM produtos
          WHERE LOWER(nome) LIKE CONCAT('%', LOWER(?), '%')
             OR LOWER(COALESCE(tags, '')) LIKE CONCAT('%', LOWER(?), '%')
          ORDER BY destaque DESC, id ASC
          LIMIT 1`,
        [r.termo, r.termo]
      );

      const qtdAtual = Number(r.qtd);
      const qtdAnterior = mapaAnterior[r.termo] || 0;
      const tendencia = qtdAnterior === 0
        ? (qtdAtual > 0 ? null : 0)
        : ((qtdAtual - qtdAnterior) / qtdAnterior) * 100;

      return {
        termo: r.termo,
        produto: match[0] ? match[0].nome : r.termo,
        correspondeProduto: !!match[0],
        qtd: qtdAtual,
        qtdAnterior,
        tendencia,
      };
    }));
  }
}

module.exports = BuscaLog;
