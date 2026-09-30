'use strict';

const crypto = require('crypto');
const db = require('../../config/db');

const HORAS_ABSOLUTO_CLIENTE = parseInt(process.env.SESSION_ABSOLUTO_CLIENTE_HORAS || '168', 10); // 7 dias
const HORAS_ABSOLUTO_ADMIN   = parseInt(process.env.SESSION_ABSOLUTO_ADMIN_HORAS   || '12', 10);
const MINUTOS_IDLE_ADMIN     = parseInt(process.env.SESSION_IDLE_ADMIN_MINUTOS     || '30', 10);

function hashSessionId(sessionId) {
  return crypto.createHash('sha256').update(String(sessionId)).digest('hex');
}

function horasAbsolutoPara(papel) {
  return papel === 'admin' ? HORAS_ABSOLUTO_ADMIN : HORAS_ABSOLUTO_CLIENTE;
}

class SessaoSegura {
  static async criar({ sessionId, usuarioId, papel, ip, userAgent }) {
    const horas = horasAbsolutoPara(papel);
    await db.query(
      `INSERT INTO sessoes_seguranca
         (usuario_id, session_id_hash, papel_no_momento, expira_em, ip, user_agent)
       VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR), ?, ?)
       ON DUPLICATE KEY UPDATE
         usuario_id = VALUES(usuario_id), papel_no_momento = VALUES(papel_no_momento),
         criado_em = NOW(), ultima_atividade_em = NOW(), expira_em = VALUES(expira_em),
         ip = VALUES(ip), user_agent = VALUES(user_agent), revogado_em = NULL`,
      [usuarioId, hashSessionId(sessionId), papel, horas, ip || null, (userAgent || '').slice(0, 255)]
    );
  }

  static async buscarPorSessionId(sessionId) {
    const [rows] = await db.query(
      `SELECT * FROM sessoes_seguranca WHERE session_id_hash = ? LIMIT 1`,
      [hashSessionId(sessionId)]
    );
    return rows[0] || null;
  }

  static idleExpirada(registro) {
    if (!registro || registro.papel_no_momento !== 'admin') return false;
    const limiteMs = MINUTOS_IDLE_ADMIN * 60 * 1000;
    return Date.now() - new Date(registro.ultima_atividade_em).getTime() > limiteMs;
  }

  static async tocar(sessionId, ultimaAtividadeAtual) {
    if (ultimaAtividadeAtual && Date.now() - new Date(ultimaAtividadeAtual).getTime() < 60_000) return;
    await db.query(
      `UPDATE sessoes_seguranca SET ultima_atividade_em = NOW() WHERE session_id_hash = ?`,
      [hashSessionId(sessionId)]
    );
  }

  static async revogar(sessionId) {
    await db.query(
      `UPDATE sessoes_seguranca SET revogado_em = NOW() WHERE session_id_hash = ? AND revogado_em IS NULL`,
      [hashSessionId(sessionId)]
    );
  }

  static async revogarPorId(id, usuarioId) {
    const [result] = await db.query(
      `UPDATE sessoes_seguranca SET revogado_em = NOW()
        WHERE id = ? AND usuario_id = ? AND revogado_em IS NULL`,
      [id, usuarioId]
    );
    return result.affectedRows > 0;
  }

  static async revogarTodasDoUsuario(usuarioId, { exceto_session_id = null } = {}) {
    if (exceto_session_id) {
      await db.query(
        `UPDATE sessoes_seguranca SET revogado_em = NOW()
          WHERE usuario_id = ? AND revogado_em IS NULL AND session_id_hash <> ?`,
        [usuarioId, hashSessionId(exceto_session_id)]
      );
    } else {
      await db.query(
        `UPDATE sessoes_seguranca SET revogado_em = NOW() WHERE usuario_id = ? AND revogado_em IS NULL`,
        [usuarioId]
      );
    }
  }

  static async listarAtivasDoUsuario(usuarioId, sessionIdAtual) {
    const [rows] = await db.query(
      `SELECT id, criado_em, ultima_atividade_em, expira_em, ip, user_agent, session_id_hash
         FROM sessoes_seguranca
        WHERE usuario_id = ? AND revogado_em IS NULL AND expira_em > NOW()
        ORDER BY ultima_atividade_em DESC`,
      [usuarioId]
    );
    const hashAtual = sessionIdAtual ? hashSessionId(sessionIdAtual) : null;
    return rows.map(({ session_id_hash, ...r }) => ({ ...r, atual: session_id_hash === hashAtual }));
  }

  static async limparAntigas() {
    const [result] = await db.query(
      `DELETE FROM sessoes_seguranca
        WHERE (expira_em < NOW() OR revogado_em IS NOT NULL)
          AND COALESCE(revogado_em, expira_em) < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    return result.affectedRows;
  }
}

module.exports = SessaoSegura;
