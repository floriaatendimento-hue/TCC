'use strict';

const db = require('../../config/db');

class ComentarioMidia {
  static async findByComentario(comentario_id) {
    const [rows] = await db.query(
      `SELECT id, comentario_id, tipo, arquivo, thumbnail, oculto, ordem, criado_em
         FROM comentario_midias
        WHERE comentario_id = ?
        ORDER BY ordem ASC, id ASC`,
      [comentario_id]
    );
    return rows;
  }

  static async findByComentarioIds(ids) {
    const lista = (ids || []).filter(Boolean);
    if (!lista.length) return {};
    const [rows] = await db.query(
      `SELECT id, comentario_id, tipo, arquivo, thumbnail, oculto, ordem, criado_em
         FROM comentario_midias
        WHERE comentario_id IN (?)
        ORDER BY ordem ASC, id ASC`,
      [lista]
    );
    const mapa = {};
    for (const row of rows) {
      (mapa[row.comentario_id] = mapa[row.comentario_id] || []).push(row);
    }
    return mapa;
  }

  static async findByIdComDono(id) {
    const [rows] = await db.query(
      `SELECT m.id, m.comentario_id, m.tipo, m.arquivo, m.thumbnail, m.oculto,
              c.usuario_id
         FROM comentario_midias m
         JOIN comentarios c ON c.id = m.comentario_id
        WHERE m.id = ?
        LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async contarPorTipo(comentario_id) {
    const [rows] = await db.query(
      `SELECT tipo, COUNT(*) AS total
         FROM comentario_midias
        WHERE comentario_id = ?
        GROUP BY tipo`,
      [comentario_id]
    );
    const contagem = { imagem: 0, video: 0 };
    for (const row of rows) contagem[row.tipo] = Number(row.total);
    return contagem;
  }

  static async create({ comentario_id, tipo, arquivo, thumbnail, ordem }) {
    const [result] = await db.query(
      `INSERT INTO comentario_midias (comentario_id, tipo, arquivo, thumbnail, ordem)
       VALUES (?, ?, ?, ?, ?)`,
      [comentario_id, tipo, arquivo, thumbnail || null, ordem || 0]
    );
    return result.insertId;
  }

  static async setOculto(id, oculto) {
    await db.query('UPDATE comentario_midias SET oculto = ? WHERE id = ?', [oculto ? 1 : 0, id]);
    return true;
  }

  static async removerPorId(id) {
    const [result] = await db.query('DELETE FROM comentario_midias WHERE id = ?', [id]);
    return result.affectedRows;
  }

  static async removerPorIdsDoComentario(ids, comentario_id) {
    const lista = (ids || []).map(Number).filter((n) => Number.isInteger(n) && n > 0);
    if (!lista.length) return 0;
    const [result] = await db.query(
      'DELETE FROM comentario_midias WHERE comentario_id = ? AND id IN (?)',
      [comentario_id, lista]
    );
    return result.affectedRows;
  }

  static async removerPorComentario(comentario_id) {
    const [result] = await db.query('DELETE FROM comentario_midias WHERE comentario_id = ?', [comentario_id]);
    return result.affectedRows;
  }

  static async findAllAdmin({ tipo = '', limite = 60, offset = 0 } = {}) {
    const params = [];
    let where = '';
    if (tipo) { where = 'WHERE m.tipo = ?'; params.push(tipo); }
    params.push(limite, offset);
    const [rows] = await db.query(
      `SELECT m.id, m.comentario_id, m.tipo, m.arquivo, m.thumbnail, m.oculto, m.criado_em,
              c.produto_slug, c.usuario_nome
         FROM comentario_midias m
         JOIN comentarios c ON c.id = m.comentario_id
         ${where}
        ORDER BY m.criado_em DESC
        LIMIT ? OFFSET ?`,
      params
    );
    return rows;
  }
}

module.exports = ComentarioMidia;
