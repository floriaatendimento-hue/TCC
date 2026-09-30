'use strict';

const db = require('../../config/db');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

class Usuario {

  // Listagem

  static async findAll({ limite = 50, offset = 0 } = {}) {
    const [rows] = await db.query(
      `SELECT id, nome, email, telefone, foto_perfil, papel, ativo, criado_em, atualizado_em, ultimo_acesso
         FROM usuarios
        ORDER BY criado_em DESC
        LIMIT ? OFFSET ?`,
      [limite, offset]
    );
    return rows;
  }

  // Buscas unitárias

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT id, nome, email, cpf, telefone, foto_perfil, papel, ativo, criado_em, atualizado_em, ultimo_acesso
         FROM usuarios
        WHERE id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByEmail(email) {
    const [rows] = await db.query(
      'SELECT * FROM usuarios WHERE email = ?',
      [email]
    );
    return rows[0] ?? null;
  }

  static async findByIdComSenha(id) {
    const [rows] = await db.query('SELECT * FROM usuarios WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  static async findByCpf(cpf) {
    const [rows] = await db.query(
      'SELECT id FROM usuarios WHERE cpf = ?',
      [cpf]
    );
    return rows[0] ?? null;
  }

  static async contarTodos() {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM usuarios');
    return Number(total);
  }

  static async contarClientes() {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM usuarios WHERE papel = 'cliente'`
    );
    return Number(total);
  }

  static async findClientesAdmin({ busca = '', status = '', ordenar = 'cadastro', direcao = 'desc', limite = 50, offset = 0 } = {}) {
    const termo = `%${busca}%`;

    const condicoesStatus = { ativo: 'u.ativo = 1', bloqueado: 'u.ativo = 0' };
    const clausulaStatus = condicoesStatus[status] || '1=1';

    const colunasOrdenacao = {
      nome: 'u.nome',
      cadastro: 'u.criado_em',
      pedidos: 'total_pedidos',
      gasto: 'total_gasto',
      ultima_compra: 'ultima_compra',
    };
    const colunaOrdenacao = colunasOrdenacao[ordenar] || colunasOrdenacao.cadastro;
    const direcaoOrdenacao = String(direcao).toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const [rows] = await db.query(
      `SELECT u.id, u.nome, u.email, u.telefone, u.foto_perfil, u.ativo, u.criado_em,
              e.cidade, e.uf,
              COUNT(DISTINCT p.id) AS total_pedidos,
              COALESCE(SUM(CASE WHEN p.status_pagamento = 'aprovado' THEN p.total ELSE 0 END), 0) AS total_gasto,
              MAX(p.criado_em) AS ultima_compra
         FROM usuarios u
         LEFT JOIN enderecos e ON e.usuario_id = u.id AND e.padrao = 1
         LEFT JOIN pedidos p ON p.usuario_id = u.id
        WHERE u.papel = 'cliente'
          AND (? = '' OR u.nome LIKE ? OR u.email LIKE ? OR u.telefone LIKE ?)
          AND ${clausulaStatus}
        GROUP BY u.id, e.cidade, e.uf
        ORDER BY ${colunaOrdenacao} ${direcaoOrdenacao}
        LIMIT ? OFFSET ?`,
      [busca, termo, termo, termo, limite, offset]
    );
    return rows.map(r => ({
      ...r,
      total_pedidos: Number(r.total_pedidos) || 0,
      total_gasto: Number(r.total_gasto) || 0,
    }));
  }

  static async contarClientesFiltrados(busca = '', status = '') {
    const termo = `%${busca}%`;
    const condicoesStatus = { ativo: 'ativo = 1', bloqueado: 'ativo = 0' };
    const clausulaStatus = condicoesStatus[status] || '1=1';
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM usuarios
        WHERE papel = 'cliente'
          AND (? = '' OR nome LIKE ? OR email LIKE ? OR telefone LIKE ?)
          AND ${clausulaStatus}`,
      [busca, termo, termo, termo]
    );
    return Number(total);
  }

  static async alternarAtivo(id) {
    const [resultado] = await db.query(`UPDATE usuarios SET ativo = NOT ativo WHERE id = ? AND papel = 'cliente'`, [id]);
    if (!resultado.affectedRows) return null;
    return Usuario.findById(id);
  }

  static async findAdmins() {
    const [rows] = await db.query(
      `SELECT id, nome, email, telefone, foto_perfil, ativo, criado_em, ultimo_acesso
         FROM usuarios
        WHERE papel = 'admin'
        ORDER BY criado_em ASC`
    );
    return rows;
  }

  static async buscarClientesParaPromover(busca, limite = 10) {
    const termo = `%${busca}%`;
    const [rows] = await db.query(
      `SELECT id, nome, email FROM usuarios
        WHERE papel = 'cliente' AND (nome LIKE ? OR email LIKE ?)
        ORDER BY nome ASC
        LIMIT ?`,
      [termo, termo, limite]
    );
    return rows;
  }

  static async contarNovosPeriodo(dataInicio, dataFim) {
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM usuarios
        WHERE papel = 'cliente' AND DATE(criado_em) BETWEEN ? AND ?`,
      [dataInicio, dataFim]
    );
    return Number(total);
  }

  static async relatorioClientesPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT u.id, u.nome, u.email, u.telefone, u.criado_em,
              COUNT(p.id) AS total_pedidos,
              COALESCE(SUM(CASE WHEN p.status_pagamento = 'aprovado' THEN p.total ELSE 0 END), 0) AS total_gasto
         FROM usuarios u
         LEFT JOIN pedidos p ON p.usuario_id = u.id
        WHERE u.papel = 'cliente' AND DATE(u.criado_em) BETWEEN ? AND ?
        GROUP BY u.id
        ORDER BY u.criado_em DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({
      ...r,
      total_pedidos: Number(r.total_pedidos) || 0,
      total_gasto: Number(r.total_gasto) || 0,
    }));
  }

  // Criação

  static async create({ nome, email, senha_hash, cpf, telefone, foto_perfil = null }) {
    const totalExistentes = await Usuario.contarTodos();
    const papel = totalExistentes === 0 ? 'admin' : 'cliente';

    const [result] = await db.query(
      `INSERT INTO usuarios (nome, email, senha_hash, cpf, telefone, foto_perfil, papel)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [nome, email, senha_hash, cpf ?? null, telefone ?? null, foto_perfil, papel]
    );
    return result.insertId;
  }

  // Atualização

  static async updatePapel(id, papel) {
    if (papel !== 'admin' && papel !== 'cliente') {
      throw new Error(`Papel inválido: ${papel}`);
    }
    const [result] = await db.query(
      'UPDATE usuarios SET papel = ? WHERE id = ?',
      [papel, id]
    );
    return result.affectedRows;
  }

  static async updateSenha(id, senha_hash) {
    const [result] = await db.query(
      'UPDATE usuarios SET senha_hash = ? WHERE id = ?',
      [senha_hash, id]
    );
    return result.affectedRows;
  }

  static async updateUltimoAcesso(id) {
    await db.query(
      'UPDATE usuarios SET ultimo_acesso = NOW() WHERE id = ?',
      [id]
    );
  }

  static async updateFoto(id, foto_perfil) {
    const [result] = await db.query(
      'UPDATE usuarios SET foto_perfil = ? WHERE id = ?',
      [foto_perfil, id]
    );
    return result.affectedRows;
  }

  // Remoção

  static async delete(id) {
    const [result] = await db.query(
      'UPDATE usuarios SET ativo = 0 WHERE id = ?',
      [id]
    );
    return result.affectedRows;
  }

  static async anonimizar(id) {
    const emailAnonimo = `removido-${id}-${crypto.randomBytes(4).toString('hex')}@anonimizado.floria.invalid`;
    const senhaInutilizavel = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 12);

    const [result] = await db.query(
      `UPDATE usuarios
          SET nome = 'Cliente removido',
              email = ?,
              senha_hash = ?,
              cpf = NULL,
              telefone = NULL,
              foto_perfil = NULL,
              ativo = 0
        WHERE id = ?`,
      [emailAnonimo, senhaInutilizavel, id]
    );
    return result.affectedRows;
  }
}

module.exports = Usuario;
