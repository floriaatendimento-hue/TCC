'use strict';

const db = require('../../config/db');

const CAMPOS = [
  'rotulo', 'destinatario', 'telefone', 'cep', 'logradouro',
  'numero', 'complemento', 'bairro', 'cidade', 'uf', 'referencia',
];

class Endereco {
  static async findByUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY padrao DESC, criado_em DESC`,
      [usuario_id]
    );
    return rows;
  }

  static async findById(id, usuario_id) {
    const [rows] = await db.query(
      `SELECT * FROM enderecos WHERE id = ? AND usuario_id = ?`,
      [id, usuario_id]
    );
    return rows[0] || null;
  }

  static async padraoDoUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT * FROM enderecos WHERE usuario_id = ? AND padrao = 1 LIMIT 1`,
      [usuario_id]
    );
    return rows[0] || null;
  }

  static async create(usuario_id, dados) {
    const {
      rotulo, destinatario, telefone, cep, logradouro,
      numero, complemento, bairro, cidade, uf, referencia, padrao, validacao,
    } = dados;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (padrao) {
        await conn.query(`UPDATE enderecos SET padrao = 0 WHERE usuario_id = ?`, [usuario_id]);
      }
      const [result] = await conn.query(
        `INSERT INTO enderecos
           (usuario_id, rotulo, destinatario, telefone, cep, logradouro,
            numero, complemento, bairro, cidade, uf, referencia, padrao,
            validacao_status, validacao_em, validacao_fonte, validacao_detalhes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [usuario_id, rotulo, destinatario, telefone, cep, logradouro,
         numero, complemento || null, bairro, cidade, uf, referencia || null, padrao ? 1 : 0,
         validacao ? validacao.status : 'nao_validado',
         validacao ? new Date() : null,
         validacao ? validacao.fonte : null,
         validacao ? JSON.stringify(validacao.detalhes || {}) : null]
      );
      await conn.commit();
      return result.insertId;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async update(id, usuario_id, dados) {
    const {
      rotulo, destinatario, telefone, cep, logradouro,
      numero, complemento, bairro, cidade, uf, referencia, padrao, validacao,
    } = dados;

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      if (padrao) {
        await conn.query(`UPDATE enderecos SET padrao = 0 WHERE usuario_id = ?`, [usuario_id]);
      }
      const [result] = await conn.query(
        `UPDATE enderecos
            SET rotulo = ?, destinatario = ?, telefone = ?, cep = ?, logradouro = ?,
                numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ?,
                referencia = ?, padrao = ?,
                validacao_status = ?, validacao_em = ?, validacao_fonte = ?, validacao_detalhes = ?
          WHERE id = ? AND usuario_id = ?`,
        [rotulo, destinatario, telefone, cep, logradouro, numero,
         complemento || null, bairro, cidade, uf, referencia || null, padrao ? 1 : 0,
         validacao ? validacao.status : 'nao_validado',
         validacao ? new Date() : null,
         validacao ? validacao.fonte : null,
         validacao ? JSON.stringify(validacao.detalhes || {}) : null,
         id, usuario_id]
      );
      await conn.commit();
      return result.affectedRows > 0;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async definirPrincipal(id, usuario_id) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [existentes] = await conn.query(
        `SELECT id FROM enderecos WHERE id = ? AND usuario_id = ?`,
        [id, usuario_id]
      );
      if (!existentes[0]) {
        await conn.rollback();
        return false;
      }
      await conn.query(`UPDATE enderecos SET padrao = 0 WHERE usuario_id = ?`, [usuario_id]);
      const [result] = await conn.query(
        `UPDATE enderecos SET padrao = 1 WHERE id = ? AND usuario_id = ?`,
        [id, usuario_id]
      );
      await conn.commit();
      return result.affectedRows > 0;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async remove(id, usuario_id) {
    const [result] = await db.query(
      `DELETE FROM enderecos WHERE id = ? AND usuario_id = ?`,
      [id, usuario_id]
    );
    if (result.affectedRows > 0) {
      const restante = await Endereco.padraoDoUsuario(usuario_id);
      if (!restante) {
        const [rows] = await db.query(
          `SELECT id FROM enderecos WHERE usuario_id = ? ORDER BY criado_em DESC LIMIT 1`,
          [usuario_id]
        );
        if (rows[0]) {
          await db.query(`UPDATE enderecos SET padrao = 1 WHERE id = ?`, [rows[0].id]);
        }
      }
    }
    return result.affectedRows > 0;
  }
}

module.exports = Endereco;
