'use strict';

const db = require('../../config/db');
const dinheiro = require('../helpers/dinheiro');

class Cupom {
  static async findAll() {
    const [rows] = await db.query('SELECT * FROM cupons ORDER BY criado_em DESC');
    return rows;
  }

  static async findComCodigo() {
    const [rows] = await db.query(
      `SELECT * FROM cupons WHERE codigo IS NOT NULL ORDER BY criado_em DESC`
    );
    return rows;
  }

  static async findAutomaticos() {
    const [rows] = await db.query(
      `SELECT * FROM cupons WHERE codigo IS NULL ORDER BY criado_em DESC`
    );
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM cupons WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  static async findValidoPorCodigo(codigo) {
    const [rows] = await db.query(
      `SELECT * FROM cupons
        WHERE codigo = ? AND ativo = 1
          AND (data_inicio IS NULL OR data_inicio <= CURDATE())
          AND (data_fim    IS NULL OR data_fim    >= CURDATE())
          AND (limite_usos IS NULL OR usos_atual < limite_usos)`,
      [codigo]
    );
    return rows[0] ?? null;
  }

  static async findByCodigoBruto(codigo) {
    const [rows] = await db.query('SELECT * FROM cupons WHERE codigo = ?', [codigo]);
    return rows[0] ?? null;
  }

  static calcularDesconto(cupom, subtotal, frete = 0) {
    if (!cupom) return 0;
    const subCentavos = dinheiro.paraCentavos(Number(subtotal) || 0);
    const menor = (a, b) => (a < b ? a : b);
    if (cupom.tipo === 'percentual') {
      return dinheiro.paraReais(menor(dinheiro.percentualDe(subCentavos, cupom.valor), subCentavos));
    }
    if (cupom.tipo === 'fixo') {
      return dinheiro.paraReais(menor(dinheiro.paraCentavos(Number(cupom.valor) || 0), subCentavos));
    }
    if (cupom.tipo === 'frete_gratis') {
      return Number(frete) || 0;
    }
    return 0;
  }

  static async pedidosQueUsaram(codigo) {
    const [rows] = await db.query(
      `SELECT id, usuario_id, total, desconto, status, status_pagamento, criado_em
         FROM pedidos
        WHERE cupom = ?
        ORDER BY criado_em DESC
        LIMIT 100`,
      [codigo]
    );
    return rows;
  }

  static async relatorioComCodigo(dataInicio, dataFim) {
    return Cupom._relatorioBase(dataInicio, dataFim, true);
  }

  static async relatorioAutomaticos(dataInicio, dataFim) {
    return Cupom._relatorioBase(dataInicio, dataFim, false);
  }

  static async _relatorioBase(dataInicio, dataFim, comCodigo) {
    const [rows] = await db.query(
      `SELECT c.*,
              COALESCE(u.usos_periodo, 0) AS usos_periodo,
              COALESCE(u.desconto_periodo, 0) AS desconto_periodo
         FROM cupons c
         LEFT JOIN (
           SELECT cupom, COUNT(*) AS usos_periodo, SUM(desconto) AS desconto_periodo
             FROM pedidos
            WHERE cupom IS NOT NULL AND DATE(criado_em) BETWEEN ? AND ?
            GROUP BY cupom
         ) u ON u.cupom = c.codigo
        WHERE c.codigo IS ${comCodigo ? 'NOT NULL' : 'NULL'}
        ORDER BY c.criado_em DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({
      ...r,
      valor: r.valor != null ? Number(r.valor) : null,
      valor_minimo: r.valor_minimo != null ? Number(r.valor_minimo) : null,
      usos_periodo: Number(r.usos_periodo) || 0,
      desconto_periodo: Number(r.desconto_periodo) || 0,
    }));
  }

  static async create(dados) {
    const { codigo, tipo, valor, valor_minimo, data_inicio, data_fim, limite_usos, ativo = 1 } = dados;
    const [result] = await db.query(
      `INSERT INTO cupons (codigo, tipo, valor, valor_minimo, data_inicio, data_fim, limite_usos, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo || null, tipo,
        tipo === 'frete_gratis' ? null : valor,
        valor_minimo || null, data_inicio || null, data_fim || null,
        limite_usos || null, ativo ? 1 : 0,
      ]
    );
    return result.insertId;
  }

  static async update(id, dados) {
    const permitidos = ['codigo', 'tipo', 'valor', 'valor_minimo', 'data_inicio', 'data_fim', 'limite_usos', 'ativo'];
    const sets = []; const values = [];
    for (const [k, v] of Object.entries(dados)) {
      if (!permitidos.includes(k)) continue;
      sets.push(`${k} = ?`);
      if (k === 'ativo') values.push(v ? 1 : 0);
      else if (k === 'codigo') values.push(v || null);
      else values.push(v === '' ? null : v);
    }
    if (!sets.length) return 0;
    values.push(id);
    const [result] = await db.query(`UPDATE cupons SET ${sets.join(', ')} WHERE id = ?`, values);
    return result.affectedRows;
  }

  static async alternarAtivo(id) {
    await db.query('UPDATE cupons SET ativo = NOT ativo WHERE id = ?', [id]);
    return Cupom.findById(id);
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM cupons WHERE id = ?', [id]);
    return result.affectedRows;
  }
}

module.exports = Cupom;
