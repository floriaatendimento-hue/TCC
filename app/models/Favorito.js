'use strict';

const db = require('../../config/db');
const { resolverImagemUrl } = require('../helpers/imagemUrl');

class Favorito {
  static async findByUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT id, produto_slug, produto_nome, produto_imagem, produto_preco, criado_em
         FROM favoritos
        WHERE usuario_id = ?
        ORDER BY criado_em DESC`,
      [usuario_id]
    );
    return rows.map(row => ({ ...row, produto_imagem: resolverImagemUrl(row.produto_imagem, null) }));
  }

  static async slugsByUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT produto_slug FROM favoritos WHERE usuario_id = ?`,
      [usuario_id]
    );
    return rows.map(r => r.produto_slug);
  }

  static async existe(usuario_id, produto_slug) {
    const [rows] = await db.query(
      `SELECT id FROM favoritos WHERE usuario_id = ? AND produto_slug = ? LIMIT 1`,
      [usuario_id, produto_slug]
    );
    return rows.length > 0;
  }

  static async add(usuario_id, { produto_slug, produto_nome, produto_imagem, produto_preco }) {
    await db.query(
      `INSERT INTO favoritos (usuario_id, produto_slug, produto_nome, produto_imagem, produto_preco)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         produto_nome   = VALUES(produto_nome),
         produto_imagem = VALUES(produto_imagem),
         produto_preco  = VALUES(produto_preco)`,
      [usuario_id, produto_slug, produto_nome, produto_imagem || null, produto_preco || null]
    );
    return true;
  }

  static async remove(usuario_id, produto_slug) {
    const [result] = await db.query(
      `DELETE FROM favoritos WHERE usuario_id = ? AND produto_slug = ?`,
      [usuario_id, produto_slug]
    );
    return result.affectedRows > 0;
  }

  static async maisFavoritados(qtd = 5) {
    const [rows] = await db.query(
      `SELECT produto_slug AS slug, produto_nome AS nome, produto_imagem AS imagem,
              COUNT(*) AS total
         FROM favoritos
        GROUP BY produto_slug, produto_nome, produto_imagem
        ORDER BY total DESC
        LIMIT ?`,
      [qtd]
    );
    return rows.map(r => ({ ...r, total: Number(r.total) || 0 }));
  }
}

module.exports = Favorito;
