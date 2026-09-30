'use strict';

const db = require('../../config/db');

class Subcategoria {
  static async findAllAgrupadas({ somenteAtivas = false } = {}) {
    const [rows] = await db.query(
      `SELECT s.*, c.nome AS categoria_nome, c.slug AS categoria_slug,
              (SELECT COUNT(*) FROM produtos p WHERE p.subcategoria_id = s.id) AS total_produtos
         FROM subcategorias s
         JOIN categorias c ON c.id = s.categoria_id
        ${somenteAtivas ? 'WHERE s.ativa = 1' : ''}
        ORDER BY c.ordem ASC, c.nome ASC, s.ordem ASC, s.nome ASC`
    );
    return rows;
  }

  static async findByCategoria(categoria_id, { somenteAtivas = false } = {}) {
    const [rows] = await db.query(
      `SELECT * FROM subcategorias
        WHERE categoria_id = ? ${somenteAtivas ? 'AND ativa = 1' : ''}
        ORDER BY ordem ASC, nome ASC`,
      [categoria_id]
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM subcategorias WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  static async create({ categoria_id, nome, slug, descricao, ativa = 1 }) {
    const [[{ maxOrdem }]] = await db.query(
      'SELECT COALESCE(MAX(ordem), -1) AS maxOrdem FROM subcategorias WHERE categoria_id = ?',
      [categoria_id]
    );
    const [result] = await db.query(
      `INSERT INTO subcategorias (categoria_id, nome, slug, descricao, ativa, ordem)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [categoria_id, nome, slug, descricao ?? null, ativa ? 1 : 0, maxOrdem + 1]
    );
    return result.insertId;
  }

  static async update(id, campos) {
    const permitidos = ['categoria_id', 'nome', 'slug', 'descricao', 'ativa'];
    const sets   = [];
    const values = [];

    for (const [k, v] of Object.entries(campos)) {
      if (permitidos.includes(k)) {
        sets.push(`${k} = ?`);
        values.push(k === 'ativa' ? (v ? 1 : 0) : v);
      }
    }
    if (!sets.length) return 0;

    const trocaCategoria = Object.prototype.hasOwnProperty.call(campos, 'categoria_id');
    if (!trocaCategoria) {
      values.push(id);
      const [result] = await db.query(
        `UPDATE subcategorias SET ${sets.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows;
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [atualRows] = await conn.query('SELECT categoria_id FROM subcategorias WHERE id = ? FOR UPDATE', [id]);
      const atual = atualRows[0];
      if (!atual) { await conn.rollback(); return 0; }

      values.push(id);
      const [result] = await conn.query(
        `UPDATE subcategorias SET ${sets.join(', ')} WHERE id = ?`,
        values
      );

      const novaCategoriaId = Number(campos.categoria_id);
      if (novaCategoriaId !== Number(atual.categoria_id)) {
        await conn.query(
          'UPDATE produtos SET categoria_id = ? WHERE subcategoria_id = ?',
          [novaCategoriaId, id]
        );
      }

      await conn.commit();
      return result.affectedRows;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async alternarAtiva(id) {
    await db.query('UPDATE subcategorias SET ativa = NOT ativa WHERE id = ?', [id]);
    return Subcategoria.findById(id);
  }

  static async mover(id, direcao) {
    const atual = await Subcategoria.findById(id);
    if (!atual) return false;

    const operador  = direcao === 'cima' ? '<' : '>';
    const ordenacao = direcao === 'cima' ? 'DESC' : 'ASC';
    const [vizinhos] = await db.query(
      `SELECT id, ordem FROM subcategorias
        WHERE categoria_id = ? AND ordem ${operador} ?
        ORDER BY ordem ${ordenacao} LIMIT 1`,
      [atual.categoria_id, atual.ordem]
    );
    const vizinho = vizinhos[0];
    if (!vizinho) return false;

    await db.query('UPDATE subcategorias SET ordem = ? WHERE id = ?', [vizinho.ordem, atual.id]);
    await db.query('UPDATE subcategorias SET ordem = ? WHERE id = ?', [atual.ordem, vizinho.id]);
    return true;
  }

  static async delete(id) {
    await db.query('UPDATE produtos SET subcategoria_id = NULL WHERE subcategoria_id = ?', [id]);
    const [result] = await db.query('DELETE FROM subcategorias WHERE id = ?', [id]);
    return result.affectedRows;
  }
}

module.exports = Subcategoria;
