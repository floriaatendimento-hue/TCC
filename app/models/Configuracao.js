'use strict';

const db = require('../../config/db');

class Configuracao {
  static async obterTodas() {
    const [rows] = await db.query('SELECT chave, valor FROM configuracoes');
    const mapa = {};
    rows.forEach(r => { mapa[r.chave] = r.valor; });
    return mapa;
  }

  static async salvarVarias(pares) {
    const entradas = Object.entries(pares);
    if (!entradas.length) return 0;
    for (const [chave, valor] of entradas) {
      await db.query(
        `INSERT INTO configuracoes (chave, valor) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE valor = VALUES(valor)`,
        [chave, valor == null ? null : String(valor)]
      );
    }
    return entradas.length;
  }
}

module.exports = Configuracao;
