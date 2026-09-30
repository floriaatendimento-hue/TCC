'use strict';

const db = require('../../config/db');

function gerarCodigo() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let sufixo = '';
  for (let i = 0; i < 8; i++) sufixo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `CMP-${sufixo}`;
}

class Comprovante {
  static async porPedido(pedido_id) {
    const [rows] = await db.query(`SELECT * FROM comprovantes WHERE pedido_id = ?`, [pedido_id]);
    return rows[0] ?? null;
  }

  static async obterOuCriar(pedido_id) {
    const existente = await Comprovante.porPedido(pedido_id);
    if (existente) return existente;

    const codigo = gerarCodigo();
    try {
      await db.query(
        `INSERT INTO comprovantes (pedido_id, codigo, emissoes) VALUES (?, ?, 1)`,
        [pedido_id, codigo]
      );
    } catch (err) {
      if (err.code !== 'ER_DUP_ENTRY') throw err;
    }
    return Comprovante.porPedido(pedido_id);
  }

  static async registrarEmissao(pedido_id) {
    await Comprovante.obterOuCriar(pedido_id);
    await db.query(
      `UPDATE comprovantes SET emissoes = emissoes + 1 WHERE pedido_id = ?`,
      [pedido_id]
    );
  }

  static async registrarEnvioEmail(pedido_id, email) {
    await Comprovante.obterOuCriar(pedido_id);
    await db.query(
      `UPDATE comprovantes
          SET enviado_email_em = CURRENT_TIMESTAMP,
              email_destino    = ?,
              envios_email     = envios_email + 1
        WHERE pedido_id = ?`,
      [email, pedido_id]
    );
  }

  static async relatorioPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT p.id AS pedido_id, p.criado_em, p.total, p.status_pagamento, p.forma_pagto,
              u.nome AS cliente_nome, u.email AS cliente_email,
              c.codigo, c.emissoes, c.enviado_email_em, c.envios_email, c.email_destino
         FROM pedidos p
         JOIN usuarios u ON u.id = p.usuario_id
         LEFT JOIN comprovantes c ON c.pedido_id = p.id
        WHERE DATE(p.criado_em) BETWEEN ? AND ?
        ORDER BY p.criado_em DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({ ...r, total: Number(r.total) || 0 }));
  }
}

module.exports = Comprovante;
