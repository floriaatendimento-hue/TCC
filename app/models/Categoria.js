'use strict';

const db = require('../../config/db');

class Categoria {
  // Listagem

  static async findAll() {
    const [rows] = await db.query('SELECT * FROM categorias ORDER BY nome');
    return rows;
  }

  static async findAllAtivas() {
    const [rows] = await db.query(
      'SELECT id, nome, slug, ordem FROM categorias WHERE ativa = 1 ORDER BY ordem ASC, nome ASC'
    );
    return rows;
  }

  static async findAllAdmin() {
    const [rows] = await db.query(
      `SELECT c.*,
              (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id)      AS total_produtos,
              (SELECT COUNT(*) FROM subcategorias s WHERE s.categoria_id = c.id) AS total_subcategorias
         FROM categorias c
        ORDER BY c.ordem ASC, c.nome ASC`
    );
    return rows;
  }

  static async findAllAtivasComContagem() {
    const [rows] = await db.query(
      `SELECT c.id, c.nome, c.slug, c.ordem,
              (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id AND p.ativo = 1) AS total_produtos
         FROM categorias c
        WHERE c.ativa = 1
        ORDER BY c.ordem ASC, c.nome ASC`
    );
    return rows;
  }

  // Buscas unitárias

  static async findById(id) {
    const [rows] = await db.query(
      'SELECT * FROM categorias WHERE id = ?',
      [id]
    );
    return rows[0] ?? null;
  }

  static async findBySlug(slug) {
    const [rows] = await db.query(
      'SELECT * FROM categorias WHERE slug = ?',
      [slug]
    );
    return rows[0] ?? null;
  }

  // Criação

  static async create({ nome, slug, descricao, ativa = 1 }) {
    const [[{ maxOrdem }]] = await db.query('SELECT COALESCE(MAX(ordem), -1) AS maxOrdem FROM categorias');
    const [result] = await db.query(
      'INSERT INTO categorias (nome, slug, descricao, ativa, ordem) VALUES (?, ?, ?, ?, ?)',
      [nome, slug, descricao ?? null, ativa ? 1 : 0, maxOrdem + 1]
    );
    return result.insertId;
  }

  // Atualização

  static async update(id, campos) {
    const permitidos = ['nome', 'slug', 'descricao', 'ativa'];
    const sets   = [];
    const values = [];

    for (const [k, v] of Object.entries(campos)) {
      if (permitidos.includes(k)) {
        sets.push(`${k} = ?`);
        values.push(k === 'ativa' ? (v ? 1 : 0) : v);
      }
    }

    if (!sets.length) return 0;

    values.push(id);
    const [result] = await db.query(
      `UPDATE categorias SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows;
  }

  static async alternarAtiva(id) {
    await db.query('UPDATE categorias SET ativa = NOT ativa WHERE id = ?', [id]);
    return Categoria.findById(id);
  }

  static async mover(id, direcao) {
    const atual = await Categoria.findById(id);
    if (!atual) return false;

    const operador = direcao === 'cima' ? '<' : '>';
    const ordenacao = direcao === 'cima' ? 'DESC' : 'ASC';
    const [vizinhos] = await db.query(
      `SELECT id, ordem FROM categorias WHERE ordem ${operador} ? ORDER BY ordem ${ordenacao} LIMIT 1`,
      [atual.ordem]
    );
    const vizinho = vizinhos[0];
    if (!vizinho) return false;

    await db.query('UPDATE categorias SET ordem = ? WHERE id = ?', [vizinho.ordem, atual.id]);
    await db.query('UPDATE categorias SET ordem = ? WHERE id = ?', [atual.ordem, vizinho.id]);
    return true;
  }

  // Remoção

  static async delete(id) {
    const [result] = await db.query(
      'DELETE FROM categorias WHERE id = ?',
      [id]
    );
    return result.affectedRows;
  }
}

module.exports = Categoria;
