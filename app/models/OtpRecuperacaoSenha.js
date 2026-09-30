'use strict';

const crypto = require('crypto');
const db = require('../../config/db');

const OTP_DIGITOS = 6;
const OTP_EXPIRA_MINUTOS = parseInt(process.env.OTP_EXPIRA_MINUTOS || '10', 10);
const OTP_MAX_TENTATIVAS = parseInt(process.env.OTP_MAX_TENTATIVAS || '5', 10);
const AUTORIZACAO_EXPIRA_MINUTOS = parseInt(process.env.OTP_AUTORIZACAO_MINUTOS || '15', 10);
const COOLDOWN_REENVIO_SEGUNDOS = parseInt(process.env.OTP_COOLDOWN_SEGUNDOS || '60', 10);
const MAX_SOLICITACOES_POR_HORA = parseInt(process.env.OTP_MAX_SOLICITACOES_HORA || '5', 10);

const PEPPER = 'otp-recuperacao-senha:v1:' + (process.env.SESSION_SECRET || 'floria-dev-secret-TROQUE-em-producao');

function hashOtp(usuarioId, otp) {
  return crypto.createHmac('sha256', PEPPER).update(`${usuarioId}:${otp}`).digest('hex');
}

function hashAutorizacao(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function gerarOtp() {
  return String(crypto.randomInt(0, 10 ** OTP_DIGITOS)).padStart(OTP_DIGITOS, '0');
}

function iguaisEmTempoConstante(hexA, hexB) {
  const a = Buffer.from(hexA, 'hex');
  const b = Buffer.from(hexB, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

class OtpRecuperacaoSenha {
  static async criar({ usuarioId, ip, userAgent }) {
    const [[limites]] = await db.query(
      `SELECT
         COUNT(*) AS na_ultima_hora,
         COALESCE(MAX(TIMESTAMPDIFF(SECOND, criado_em, NOW())), 999999) AS segundos_desde_ultimo
         FROM otps_recuperacao_senha
        WHERE usuario_id = ? AND criado_em > DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [usuarioId]
    );
    if (limites.na_ultima_hora >= MAX_SOLICITACOES_POR_HORA) return null;
    if (limites.segundos_desde_ultimo < COOLDOWN_REENVIO_SEGUNDOS - 5) return null;

    const otp = gerarOtp();

    await db.query(
      `UPDATE otps_recuperacao_senha SET usado_em = NOW()
        WHERE usuario_id = ? AND usado_em IS NULL`,
      [usuarioId]
    );
    await db.query(
      `INSERT INTO otps_recuperacao_senha (usuario_id, otp_hash, expira_em, ip, user_agent)
       VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE), ?, ?)`,
      [usuarioId, hashOtp(usuarioId, otp), OTP_EXPIRA_MINUTOS, ip || null, (userAgent || '').slice(0, 255)]
    );
    return otp;
  }

  static async verificar({ usuarioId, otp }) {
    const [[linha]] = await db.query(
      `SELECT id, otp_hash, tentativas, (expira_em <= NOW()) AS expirado
         FROM otps_recuperacao_senha
        WHERE usuario_id = ? AND usado_em IS NULL AND verificado_em IS NULL
        ORDER BY id DESC LIMIT 1`,
      [usuarioId]
    );
    if (!linha) return { ok: false, motivo: 'INVALIDO' };
    if (linha.expirado) return { ok: false, motivo: 'EXPIRADO' };
    if (linha.tentativas >= OTP_MAX_TENTATIVAS) return { ok: false, motivo: 'BLOQUEADO' };

    const [reserva] = await db.query(
      `UPDATE otps_recuperacao_senha SET tentativas = tentativas + 1
        WHERE id = ? AND usado_em IS NULL AND verificado_em IS NULL
          AND expira_em > NOW() AND tentativas < ?`,
      [linha.id, OTP_MAX_TENTATIVAS]
    );
    if (reserva.affectedRows !== 1) return { ok: false, motivo: 'BLOQUEADO' };

    if (!iguaisEmTempoConstante(linha.otp_hash, hashOtp(usuarioId, otp))) {
      return { ok: false, motivo: 'INVALIDO' };
    }

    const autorizacao = crypto.randomBytes(32).toString('hex');
    const [promocao] = await db.query(
      `UPDATE otps_recuperacao_senha
          SET verificado_em = NOW(),
              reset_token_hash = ?,
              reset_expira_em = DATE_ADD(NOW(), INTERVAL ? MINUTE)
        WHERE id = ? AND usado_em IS NULL AND verificado_em IS NULL`,
      [hashAutorizacao(autorizacao), AUTORIZACAO_EXPIRA_MINUTOS, linha.id]
    );
    if (promocao.affectedRows !== 1) return { ok: false, motivo: 'INVALIDO' };

    return { ok: true, autorizacao };
  }

  static async autorizacaoValida(autorizacao) {
    if (typeof autorizacao !== 'string' || !/^[0-9a-f]{64}$/.test(autorizacao)) return false;
    const [rows] = await db.query(
      `SELECT id FROM otps_recuperacao_senha
        WHERE reset_token_hash = ? AND verificado_em IS NOT NULL
          AND usado_em IS NULL AND reset_expira_em > NOW()`,
      [hashAutorizacao(autorizacao)]
    );
    return rows.length === 1;
  }

  static async consumirAutorizacao(autorizacao) {
    if (typeof autorizacao !== 'string' || !/^[0-9a-f]{64}$/.test(autorizacao)) return null;
    const hash = hashAutorizacao(autorizacao);
    const [resultado] = await db.query(
      `UPDATE otps_recuperacao_senha SET usado_em = NOW()
        WHERE reset_token_hash = ? AND verificado_em IS NOT NULL
          AND usado_em IS NULL AND reset_expira_em > NOW()`,
      [hash]
    );
    if (resultado.affectedRows !== 1) return null;
    const [[linha]] = await db.query(
      `SELECT id, usuario_id FROM otps_recuperacao_senha WHERE reset_token_hash = ?`,
      [hash]
    );
    return linha ?? null;
  }

  static async limparAntigos() {
    const [result] = await db.query(
      `DELETE FROM otps_recuperacao_senha
        WHERE (usado_em IS NOT NULL OR expira_em < NOW())
          AND COALESCE(usado_em, expira_em) < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    return result.affectedRows;
  }
}

module.exports = OtpRecuperacaoSenha;
module.exports.hashOtp = hashOtp;
module.exports.constantes = {
  OTP_DIGITOS,
  OTP_EXPIRA_MINUTOS,
  OTP_MAX_TENTATIVAS,
  AUTORIZACAO_EXPIRA_MINUTOS,
  COOLDOWN_REENVIO_SEGUNDOS,
  MAX_SOLICITACOES_POR_HORA,
};
