'use strict';

const db = require('../../config/db');

class MercadoPagoWebhookLog {
  static async registrar({ notification_id = null, tipo_evento = null, payload = null, ip = null }) {
    const [result] = await db.query(
      `INSERT INTO mercadopago_webhook_log (notification_id, tipo_evento, payload_json, ip) VALUES (?, ?, ?, ?)`,
      [notification_id, tipo_evento, payload ? JSON.stringify(payload) : null, ip]
    );
    return result.insertId;
  }

  static async marcarAssinaturaValida(id) {
    await db.query(`UPDATE mercadopago_webhook_log SET assinatura_valida = 1 WHERE id = ?`, [id]);
  }

  static async marcarResultado(id, { processado, erro = null }) {
    await db.query(
      `UPDATE mercadopago_webhook_log SET processado = ?, erro = ? WHERE id = ?`,
      [processado ? 1 : 0, erro ? String(erro).slice(0, 255) : null, id]
    );
  }

  static async limparAntigos(dias) {
    const [result] = await db.query(
      `DELETE FROM mercadopago_webhook_log WHERE criado_em < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [dias]
    );
    return result.affectedRows;
  }
}

module.exports = MercadoPagoWebhookLog;
