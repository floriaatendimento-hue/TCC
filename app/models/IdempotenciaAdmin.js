'use strict';

const db = require('../../config/db');

class IdempotenciaAdmin {
  static async reservar(chave, usuarioId, tipo) {
    try {
      await db.query(
        `INSERT INTO idempotencia_admin (chave, usuario_id, tipo, status) VALUES (?, ?, ?, 'processando')`,
        [chave, usuarioId, tipo]
      );
      return { novo: true };
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
      const [rows] = await db.query(
        `SELECT * FROM idempotencia_admin WHERE chave = ? AND usuario_id = ?`,
        [chave, usuarioId]
      );
      return { novo: false, registro: rows[0] || null };
    }
  }

  static async concluir(chave, usuarioId, referenciaId) {
    await db.query(
      `UPDATE idempotencia_admin SET status = 'concluido', referencia_id = ? WHERE chave = ? AND usuario_id = ?`,
      [referenciaId ?? null, chave, usuarioId]
    );
  }

  static async liberar(chave, usuarioId) {
    await db.query(`DELETE FROM idempotencia_admin WHERE chave = ? AND usuario_id = ? AND status = 'processando'`, [chave, usuarioId]);
  }

  static async limparAntigas() {
    const [result] = await db.query(
      `DELETE FROM idempotencia_admin WHERE criado_em < DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );
    return result.affectedRows;
  }
}

module.exports = IdempotenciaAdmin;
