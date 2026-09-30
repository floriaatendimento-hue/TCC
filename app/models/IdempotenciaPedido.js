'use strict';

const db = require('../../config/db');

class IdempotenciaPedido {
  static async reservar(chave, usuarioId) {
    try {
      await db.query(
        `INSERT INTO idempotencia_pedidos (chave, usuario_id, status) VALUES (?, ?, 'processando')`,
        [chave, usuarioId]
      );
      return { novo: true };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      const [rows] = await db.query(
        `SELECT * FROM idempotencia_pedidos WHERE chave = ? AND usuario_id = ?`,
        [chave, usuarioId]
      );
      return { novo: false, registro: rows[0] || null };
    }
  }

  static async concluir(chave, usuarioId, { pedidoId, resposta }) {
    await db.query(
      `UPDATE idempotencia_pedidos SET status = 'concluido', pedido_id = ?, resposta_json = ?
        WHERE chave = ? AND usuario_id = ?`,
      [pedidoId ?? null, JSON.stringify(resposta), chave, usuarioId]
    );
  }

  static async liberar(chave, usuarioId) {
    await db.query(`DELETE FROM idempotencia_pedidos WHERE chave = ? AND usuario_id = ? AND status = 'processando'`, [chave, usuarioId]);
  }

  static async limparAntigas() {
    const [result] = await db.query(
      `DELETE FROM idempotencia_pedidos WHERE criado_em < DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    return result.affectedRows;
  }
}

module.exports = IdempotenciaPedido;
