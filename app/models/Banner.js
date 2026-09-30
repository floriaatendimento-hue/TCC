'use strict';

const db = require('../../config/db');

class Banner {
  static async findAll() {
    const [rows] = await db.query('SELECT * FROM banners ORDER BY ordem ASC, id ASC');
    return rows;
  }

  static async findAtivos() {
    const [rows] = await db.query(
      `SELECT * FROM banners
        WHERE ativo = 1
          AND (data_inicio IS NULL OR data_inicio <= NOW())
          AND (data_fim    IS NULL OR data_fim    >= NOW())
        ORDER BY ordem ASC, id ASC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM banners WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  static _paraDatetime(valor) {
    if (!valor) return null;
    const data = new Date(valor);
    return Number.isNaN(data.getTime()) ? null : data;
  }

  static async create({ titulo, subtitulo, imagem, texto_botao, link, ordem, data_inicio, data_fim, ativo = 1 }) {
    let ordemFinal = Number.isInteger(ordem) ? ordem : null;
    if (ordemFinal === null) {
      const [[{ maxOrdem }]] = await db.query('SELECT COALESCE(MAX(ordem), -1) AS maxOrdem FROM banners');
      ordemFinal = maxOrdem + 1;
    }
    const [result] = await db.query(
      `INSERT INTO banners (titulo, subtitulo, imagem, texto_botao, link, ordem, ativo, data_inicio, data_fim)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [titulo, subtitulo || null, imagem, texto_botao || null, link || null, ordemFinal, ativo ? 1 : 0, Banner._paraDatetime(data_inicio), Banner._paraDatetime(data_fim)]
    );
    return result.insertId;
  }

  static async update(id, dados) {
    const permitidos = ['titulo', 'subtitulo', 'imagem', 'texto_botao', 'link', 'ordem', 'ativo', 'data_inicio', 'data_fim'];
    const sets = []; const values = [];
    for (const [k, v] of Object.entries(dados)) {
      if (!permitidos.includes(k)) continue;
      sets.push(`${k} = ?`);
      if (k === 'ativo') values.push(v ? 1 : 0);
      else if (k === 'data_inicio' || k === 'data_fim') values.push(Banner._paraDatetime(v));
      else values.push(v === '' ? null : v);
    }
    if (!sets.length) return 0;
    values.push(id);
    const [result] = await db.query(`UPDATE banners SET ${sets.join(', ')} WHERE id = ?`, values);
    return result.affectedRows;
  }

  static async reordenar(ids) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      for (let i = 0; i < ids.length; i++) {
        await conn.query('UPDATE banners SET ordem = ? WHERE id = ?', [i, ids[i]]);
      }
      await conn.commit();
      return true;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async alternarAtivo(id) {
    await db.query('UPDATE banners SET ativo = NOT ativo WHERE id = ?', [id]);
    return Banner.findById(id);
  }

  static async mover(id, direcao) {
    const atual = await Banner.findById(id);
    if (!atual) return false;
    const operador  = direcao === 'cima' ? '<' : '>';
    const ordenacao = direcao === 'cima' ? 'DESC' : 'ASC';
    const [vizinhos] = await db.query(
      `SELECT id, ordem FROM banners WHERE ordem ${operador} ? ORDER BY ordem ${ordenacao} LIMIT 1`,
      [atual.ordem]
    );
    const vizinho = vizinhos[0];
    if (!vizinho) return false;
    await db.query('UPDATE banners SET ordem = ? WHERE id = ?', [vizinho.ordem, atual.id]);
    await db.query('UPDATE banners SET ordem = ? WHERE id = ?', [atual.ordem, vizinho.id]);
    return true;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM banners WHERE id = ?', [id]);
    return result.affectedRows;
  }
}

module.exports = Banner;
