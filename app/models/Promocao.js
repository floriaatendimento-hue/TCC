'use strict';

const db = require('../../config/db');

const TIPOS_COM_PRODUTOS = 'produto';

class Promocao {
  static async findAllAdmin() {
    const [rows] = await db.query(
      `SELECT p.*, c.nome AS categoria_nome, s.nome AS subcategoria_nome
         FROM promocoes p
         LEFT JOIN categorias c ON c.id = p.categoria_id
         LEFT JOIN subcategorias s ON s.id = p.subcategoria_id
        ORDER BY p.criado_em DESC`
    );
    const comProdutos = rows.filter((r) => r.tipo === TIPOS_COM_PRODUTOS);
    if (comProdutos.length) {
      const mapa = await Promocao._produtosEmLote(comProdutos.map((r) => r.id));
      for (const r of rows) {
        if (r.tipo === TIPOS_COM_PRODUTOS) r.produtos = mapa.get(r.id) || [];
      }
    }
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM promocoes WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  static async findProdutosDaPromocao(id) {
    const [rows] = await db.query(
      `SELECT pr.id, pr.nome
         FROM promocao_produtos pp
         JOIN produtos pr ON pr.id = pp.produto_id
        WHERE pp.promocao_id = ?
        ORDER BY pr.nome`,
      [id]
    );
    return rows;
  }

  static async _produtosEmLote(promocaoIds) {
    const [rows] = await db.query(
      `SELECT pp.promocao_id, pr.id, pr.nome
         FROM promocao_produtos pp
         JOIN produtos pr ON pr.id = pp.produto_id
        WHERE pp.promocao_id IN (?)
        ORDER BY pr.nome`,
      [promocaoIds]
    );
    const mapa = new Map();
    for (const r of rows) {
      if (!mapa.has(r.promocao_id)) mapa.set(r.promocao_id, []);
      mapa.get(r.promocao_id).push({ id: r.id, nome: r.nome });
    }
    return mapa;
  }

  static async findAtivasComAlvos() {
    const [rows] = await db.query(
      `SELECT * FROM promocoes
        WHERE ativo = 1
          AND (data_inicio IS NULL OR data_inicio <= CURDATE())
          AND (data_fim    IS NULL OR data_fim    >= CURDATE())`
    );
    const comProdutos = rows.filter((r) => r.tipo === TIPOS_COM_PRODUTOS);
    if (comProdutos.length) {
      const mapa = await Promocao._produtosEmLote(comProdutos.map((r) => r.id));
      for (const r of rows) {
        if (r.tipo === TIPOS_COM_PRODUTOS) r.produtoIds = (mapa.get(r.id) || []).map((p) => p.id);
      }
    }
    return rows;
  }

  static async create(dados) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const {
        nome, tipo, categoria_id, subcategoria_id, valor_minimo,
        desconto_percentual, data_inicio, data_fim, ativo = 1, produtos = [],
      } = dados;

      const [result] = await conn.query(
        `INSERT INTO promocoes
           (nome, tipo, categoria_id, subcategoria_id, valor_minimo, desconto_percentual,
            data_inicio, data_fim, ativo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          nome, tipo,
          categoria_id || null, subcategoria_id || null, valor_minimo || null,
          desconto_percentual, data_inicio || null, data_fim || null, ativo ? 1 : 0,
        ]
      );
      const id = result.insertId;

      if (tipo === TIPOS_COM_PRODUTOS && produtos.length) {
        await conn.query(
          `INSERT INTO promocao_produtos (promocao_id, produto_id) VALUES ?`,
          [produtos.map((produtoId) => [id, produtoId])]
        );
      }

      await conn.commit();
      return id;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async update(id, dados) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const permitidos = [
        'nome', 'tipo', 'categoria_id', 'subcategoria_id', 'valor_minimo',
        'desconto_percentual', 'data_inicio', 'data_fim', 'ativo',
      ];
      const sets = []; const values = [];
      for (const [k, v] of Object.entries(dados)) {
        if (!permitidos.includes(k)) continue;
        sets.push(`${k} = ?`);
        if (k === 'ativo') values.push(v ? 1 : 0);
        else values.push(v === '' ? null : v);
      }
      if (sets.length) {
        values.push(id);
        await conn.query(`UPDATE promocoes SET ${sets.join(', ')} WHERE id = ?`, values);
      }

      if (Object.prototype.hasOwnProperty.call(dados, 'produtos')) {
        await conn.query('DELETE FROM promocao_produtos WHERE promocao_id = ?', [id]);
        if (dados.tipo === TIPOS_COM_PRODUTOS && Array.isArray(dados.produtos) && dados.produtos.length) {
          await conn.query(
            `INSERT INTO promocao_produtos (promocao_id, produto_id) VALUES ?`,
            [dados.produtos.map((produtoId) => [id, produtoId])]
          );
        }
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
    await db.query('UPDATE promocoes SET ativo = NOT ativo WHERE id = ?', [id]);
    return Promocao.findById(id);
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM promocoes WHERE id = ?', [id]);
    return result.affectedRows;
  }
}

module.exports = Promocao;
