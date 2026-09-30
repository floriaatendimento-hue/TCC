'use strict';

const db = require('../../config/db');

const CATEGORIAS_VALIDAS = ['pedido', 'entrega', 'produto', 'pagamento', 'conta', 'outras'];

class SolicitacaoSuporte {
  static protocoloDe(id) {
    return `FLR-${String(id).padStart(6, '0')}`;
  }

  static async criar({ usuarioId = null, nome, email, assunto, categoria = null, mensagem, ip = null, userAgent = null }) {
    const [result] = await db.query(
      `INSERT INTO solicitacoes_suporte
         (usuario_id, nome, email, assunto, categoria, mensagem, ip, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [usuarioId, nome, email, assunto, categoria, mensagem, ip, userAgent]
    );
    return { id: result.insertId, protocolo: SolicitacaoSuporte.protocoloDe(result.insertId) };
  }

  static async buscarDuplicataRecente({ email, mensagem, janelaSegundos = 120 }) {
    const [rows] = await db.query(
      `SELECT id FROM solicitacoes_suporte
       WHERE email = ? AND mensagem = ? AND criado_em >= DATE_SUB(NOW(), INTERVAL ? SECOND)
       ORDER BY id DESC LIMIT 1`,
      [email, mensagem, janelaSegundos]
    );
    if (!rows[0]) return null;
    return { id: rows[0].id, protocolo: SolicitacaoSuporte.protocoloDe(rows[0].id) };
  }

  static async limparAntigas(diasRetencao = 730) {
    const [result] = await db.query(
      `DELETE FROM solicitacoes_suporte WHERE criado_em < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [diasRetencao]
    );
    return result.affectedRows;
  }
}

module.exports = { SolicitacaoSuporte, CATEGORIAS_VALIDAS };
