'use strict';

const db = require('../../config/db');

class Comentario {
  static async findByProduto(slug) {
    const [rows] = await db.query(
      `SELECT c.id, c.produto_slug, c.usuario_id, c.usuario_nome,
              c.avaliacao, c.comentario, c.criado_em, c.editado_em,
              c.resposta, c.resposta_em,
              u.foto_perfil AS usuario_foto
         FROM comentarios c
         LEFT JOIN usuarios u ON u.id = c.usuario_id
        WHERE c.produto_slug = ? AND c.status = 'aprovado'
        ORDER BY c.criado_em DESC
        LIMIT 200`,
      [slug]
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT id, produto_slug, usuario_id, usuario_nome, avaliacao, comentario,
              status, criado_em, editado_em
         FROM comentarios
        WHERE id = ?
        LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  static async mediaAvaliacao(slug) {
    const [rows] = await db.query(
      `SELECT ROUND(AVG(avaliacao), 1) AS media, COUNT(*) AS total
         FROM comentarios
        WHERE produto_slug = ? AND status = 'aprovado'`,
      [slug]
    );
    return {
      media: Number(rows[0]?.media) || 0,
      total: Number(rows[0]?.total) || 0,
    };
  }

  static async mediaEmLote(slugs) {
    const lista = (slugs || []).filter(Boolean);
    if (!lista.length) return {};
    const [rows] = await db.query(
      `SELECT produto_slug, ROUND(AVG(avaliacao), 1) AS media, COUNT(*) AS total
         FROM comentarios
        WHERE produto_slug IN (?) AND status = 'aprovado'
        GROUP BY produto_slug`,
      [lista]
    );
    const mapa = {};
    for (const row of rows) {
      mapa[row.produto_slug] = { media: Number(row.media) || 0, total: Number(row.total) || 0 };
    }
    return mapa;
  }

  static async findByUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT id, produto_slug, avaliacao, comentario, status, criado_em, editado_em
         FROM comentarios
        WHERE usuario_id = ?
        ORDER BY criado_em DESC`,
      [usuario_id]
    );
    return rows;
  }

  static async anonimizarNomeDoUsuario(usuario_id) {
    const [result] = await db.query(
      `UPDATE comentarios SET usuario_nome = 'Cliente removido' WHERE usuario_id = ?`,
      [usuario_id]
    );
    return result.affectedRows;
  }

  static async findByUsuarioProduto(slug, usuario_id) {
    const [rows] = await db.query(
      `SELECT id, produto_slug, usuario_id, usuario_nome,
              avaliacao, comentario, status, criado_em, editado_em,
              resposta, resposta_em
         FROM comentarios
        WHERE produto_slug = ? AND usuario_id = ?
        LIMIT 1`,
      [slug, usuario_id]
    );
    return rows[0] || null;
  }

  static async update(id, { avaliacao, comentario }) {
    await db.query(
      `UPDATE comentarios
          SET avaliacao = ?, comentario = ?, editado_em = NOW()
        WHERE id = ?`,
      [Number(avaliacao), comentario, id]
    );
    return true;
  }

  static async atualizarStatus(id, status) {
    await db.query('UPDATE comentarios SET status = ? WHERE id = ?', [status, id]);
    return true;
  }

  static async create({ produto_slug, usuario_id, usuario_nome, avaliacao, comentario }) {
    const [result] = await db.query(
      `INSERT INTO comentarios
         (produto_slug, usuario_id, usuario_nome, avaliacao, comentario)
       VALUES (?, ?, ?, ?, ?)`,
      [produto_slug, usuario_id, usuario_nome, Number(avaliacao), comentario]
    );
    return result.insertId;
  }

  static async findAllAdmin({ nota = '', status = '', limite = 20, offset = 0 } = {}) {
    const condicoes = [];
    const params = [];
    if (nota)   { condicoes.push('avaliacao = ?'); params.push(Number(nota)); }
    if (status) { condicoes.push('status = ?');    params.push(status); }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    params.push(limite, offset);
    const [rows] = await db.query(
      `SELECT id, produto_slug, usuario_id, usuario_nome, avaliacao, comentario,
              status, resposta, resposta_em, criado_em, editado_em
         FROM comentarios
         ${where}
        ORDER BY criado_em DESC
        LIMIT ? OFFSET ?`,
      params
    );
    return rows;
  }

  static async contarAdmin(nota = '', status = '') {
    const condicoes = [];
    const params = [];
    if (nota)   { condicoes.push('avaliacao = ?'); params.push(Number(nota)); }
    if (status) { condicoes.push('status = ?');    params.push(status); }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM comentarios ${where}`, params);
    return Number(total);
  }

  static async responder(id, resposta) {
    await db.query(
      `UPDATE comentarios SET resposta = ?, resposta_em = NOW() WHERE id = ?`,
      [resposta, id]
    );
    return true;
  }

  static async removerResposta(id) {
    await db.query(`UPDATE comentarios SET resposta = NULL, resposta_em = NULL WHERE id = ?`, [id]);
    return true;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM comentarios WHERE id = ?', [id]);
    return result.affectedRows;
  }

  static async semResposta(qtd = 5) {
    const [rows] = await db.query(
      `SELECT id, produto_slug, usuario_nome, avaliacao, comentario, criado_em
         FROM comentarios
        WHERE resposta IS NULL
        ORDER BY criado_em DESC
        LIMIT ?`,
      [qtd]
    );
    return rows;
  }

  static async recentes(qtd = 5) {
    const [rows] = await db.query(
      `SELECT id, produto_slug, usuario_nome, avaliacao, comentario, criado_em
         FROM comentarios
        ORDER BY criado_em DESC
        LIMIT ?`,
      [qtd]
    );
    return rows;
  }
}

module.exports = Comentario;
