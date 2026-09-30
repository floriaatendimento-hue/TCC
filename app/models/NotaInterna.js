'use strict';

const db = require('../../config/db');

class NotaInterna {
  static async findByUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT id, usuario_id, admin_id, admin_nome, nota, criado_em
         FROM clientes_notas_internas
        WHERE usuario_id = ?
        ORDER BY criado_em DESC`,
      [usuario_id]
    );
    return rows;
  }

  static async create({ usuario_id, admin_id, admin_nome, nota }) {
    const [result] = await db.query(
      `INSERT INTO clientes_notas_internas (usuario_id, admin_id, admin_nome, nota)
       VALUES (?, ?, ?, ?)`,
      [usuario_id, admin_id ?? null, admin_nome ?? null, nota]
    );
    return result.insertId;
  }
}

module.exports = NotaInterna;
