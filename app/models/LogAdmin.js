'use strict';

const db = require('../../config/db');
const { parseUserAgent } = require('../helpers/userAgent');

function montarFiltro({ acao = '', modulo = '', usuarioId = '', dataInicio = '', dataFim = '', busca = '' } = {}) {
  const condicoes = [];
  const params = [];

  if (acao)     { condicoes.push('acao = ?'); params.push(acao); }
  if (modulo)   { condicoes.push("SUBSTRING_INDEX(acao, '.', 1) = ?"); params.push(modulo); }
  if (usuarioId) { condicoes.push('usuario_id = ?'); params.push(usuarioId); }
  if (dataInicio) { condicoes.push('DATE(criado_em) >= ?'); params.push(dataInicio); }
  if (dataFim)     { condicoes.push('DATE(criado_em) <= ?'); params.push(dataFim); }
  if (busca) {
    condicoes.push('(detalhes LIKE ? OR usuario_nome LIKE ? OR acao LIKE ?)');
    const like = `%${busca}%`;
    params.push(like, like, like);
  }

  return { where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '', params };
}

const ORDENACOES = {
  recentes: 'criado_em DESC',
  antigos: 'criado_em ASC',
  usuario: 'usuario_nome ASC, criado_em DESC',
  modulo: "SUBSTRING_INDEX(acao, '.', 1) ASC, criado_em DESC",
};

class LogAdmin {
  static async registrar({ usuario_id, usuario_nome, acao, detalhes, ip, userAgent, dadosAntes, dadosDepois }) {
    try {
      const { navegador, sistemaOperacional, dispositivo } = parseUserAgent(userAgent);
      await db.query(
        `INSERT INTO logs_admin
           (usuario_id, usuario_nome, acao, detalhes, ip, navegador, sistema_operacional, dispositivo, dados_antes, dados_depois)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario_id || null,
          usuario_nome || null,
          acao,
          detalhes || null,
          ip || null,
          navegador,
          sistemaOperacional,
          dispositivo,
          dadosAntes != null ? JSON.stringify(dadosAntes) : null,
          dadosDepois != null ? JSON.stringify(dadosDepois) : null,
        ]
      );
    } catch (err) {
      console.error('[logs_admin] falha ao registrar log:', err.message);
    }
  }

  static async findAllAdmin({ acao = '', modulo = '', usuarioId = '', dataInicio = '', dataFim = '', busca = '', ordenar = 'recentes', limite = 30, offset = 0 } = {}) {
    const { where, params } = montarFiltro({ acao, modulo, usuarioId, dataInicio, dataFim, busca });
    const orderBy = ORDENACOES[ordenar] || ORDENACOES.recentes;
    const [rows] = await db.query(
      `SELECT * FROM logs_admin ${where} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );
    return rows;
  }

  static async contar(filtros = {}) {
    const { where, params } = montarFiltro(filtros);
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM logs_admin ${where}`, params);
    return Number(total);
  }

  static async historicoPorFornecedor(fornecedorId, limite = 50) {
    const exato = `#${fornecedorId}`;
    const comSufixo = `#${fornecedorId} %`;
    const [rows] = await db.query(
      `SELECT acao, detalhes, usuario_nome, criado_em FROM logs_admin
        WHERE acao LIKE 'fornecedor.%' AND (detalhes = ? OR detalhes LIKE ?)
        ORDER BY criado_em DESC LIMIT ?`,
      [exato, comSufixo, limite]
    );
    return rows;
  }

  static async historicoPorProduto(produtoId) {
    const exato = `#${produtoId}`;
    const comSufixo = `#${produtoId} %`;
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM logs_admin
        WHERE acao LIKE 'produto.%' AND (detalhes = ? OR detalhes LIKE ?)`,
      [exato, comSufixo]
    );
    const [ultimos] = await db.query(
      `SELECT usuario_nome, criado_em FROM logs_admin
        WHERE acao LIKE 'produto.%' AND (detalhes = ? OR detalhes LIKE ?)
        ORDER BY criado_em DESC LIMIT 1`,
      [exato, comSufixo]
    );
    return {
      total: Number(total) || 0,
      ultimaEdicao: ultimos[0] || null,
    };
  }

  static async buscarPorId(id) {
    const [rows] = await db.query(
      `SELECT l.*, u.foto_perfil, u.papel
         FROM logs_admin l
         LEFT JOIN usuarios u ON u.id = l.usuario_id
        WHERE l.id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async acoesDistintas() {
    const [rows] = await db.query('SELECT DISTINCT acao FROM logs_admin ORDER BY acao ASC');
    return rows.map(r => r.acao);
  }

  static async modulosDistintos() {
    const [rows] = await db.query(
      `SELECT DISTINCT SUBSTRING_INDEX(acao, '.', 1) AS modulo FROM logs_admin ORDER BY modulo ASC`
    );
    return rows.map(r => r.modulo);
  }

  static async usuariosDistintos() {
    const [rows] = await db.query(
      `SELECT DISTINCT usuario_id, usuario_nome FROM logs_admin
        WHERE usuario_id IS NOT NULL
        ORDER BY usuario_nome ASC`
    );
    return rows;
  }

  static async limparAntigos(diasRetencao = 548) {
    const [result] = await db.query(
      `DELETE FROM logs_admin WHERE criado_em < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [diasRetencao]
    );
    return result.affectedRows;
  }

  static async estatisticas() {
    const [[{ hoje }]] = await db.query(
      `SELECT COUNT(*) AS hoje FROM logs_admin WHERE DATE(criado_em) = CURDATE()`
    );
    const [[{ semana }]] = await db.query(
      `SELECT COUNT(*) AS semana FROM logs_admin WHERE YEARWEEK(criado_em, 3) = YEARWEEK(CURDATE(), 3)`
    );
    const [[{ mes }]] = await db.query(
      `SELECT COUNT(*) AS mes FROM logs_admin
        WHERE YEAR(criado_em) = YEAR(CURDATE()) AND MONTH(criado_em) = MONTH(CURDATE())`
    );
    const [maisAtivo] = await db.query(
      `SELECT usuario_nome, COUNT(*) AS total FROM logs_admin
        WHERE usuario_nome IS NOT NULL AND criado_em >= (NOW() - INTERVAL 30 DAY)
        GROUP BY usuario_nome ORDER BY total DESC LIMIT 1`
    );
    const [porModulo] = await db.query(
      `SELECT SUBSTRING_INDEX(acao, '.', 1) AS modulo, COUNT(*) AS total
         FROM logs_admin GROUP BY modulo`
    );
    const contagem = {};
    porModulo.forEach(r => { contagem[r.modulo] = Number(r.total); });

    return {
      hoje: Number(hoje) || 0,
      semana: Number(semana) || 0,
      mes: Number(mes) || 0,
      usuarioMaisAtivo: maisAtivo[0] ? maisAtivo[0].usuario_nome : null,
      usuarioMaisAtivoTotal: maisAtivo[0] ? Number(maisAtivo[0].total) : 0,
      produtos: contagem.produto || 0,
      pedidos: contagem.pedido || 0,
      cupons: contagem.cupom || 0,
      clientes: contagem.cliente || 0,
      comentarios: contagem.avaliacao || 0,
      banners: contagem.banner || 0,
    };
  }
}

module.exports = LogAdmin;
