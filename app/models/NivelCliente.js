'use strict';

const db = require('../../config/db');

const SQL_TOTAL_POR_CLIENTE = `
  SELECT u.id AS usuario_id,
         COALESCE(SUM(CASE WHEN p.status_pagamento = 'aprovado' THEN p.total ELSE 0 END), 0) AS total_gasto
    FROM usuarios u
    LEFT JOIN pedidos p ON p.usuario_id = u.id
   WHERE u.papel = 'cliente'
   GROUP BY u.id`;

class NivelCliente {

  /* Leitura */

  static async findAll() {
    const [rows] = await db.query(
      `SELECT * FROM niveis_clientes ORDER BY ordem ASC, valor_minimo ASC, id ASC`
    );
    return rows.map(NivelCliente.normalizarLinha);
  }

  static async findAllAtivos() {
    const [rows] = await db.query(
      `SELECT * FROM niveis_clientes WHERE ativo = 1 ORDER BY ordem ASC, valor_minimo ASC, id ASC`
    );
    return rows.map(NivelCliente.normalizarLinha);
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM niveis_clientes WHERE id = ?', [id]);
    return rows[0] ? NivelCliente.normalizarLinha(rows[0]) : null;
  }

  static normalizarLinha(row) {
    return {
      ...row,
      valor_minimo: Number(row.valor_minimo) || 0,
      ordem: Number(row.ordem) || 0,
      ativo: !!row.ativo,
    };
  }

  static calcularNivel(totalGasto, niveisAtivos) {
    if (!niveisAtivos || !niveisAtivos.length) return null;

    const total = Number(totalGasto) || 0;

    const porValor = [...niveisAtivos].sort((a, b) => a.valor_minimo - b.valor_minimo);

    let atual = null;
    let proximo = null;
    for (const nivel of porValor) {
      if (total >= nivel.valor_minimo) atual = nivel;
      else { proximo = nivel; break; }
    }

    const faltaParaProximo = proximo ? Math.max(0, proximo.valor_minimo - total) : 0;

    return {
      atual,
      proximo,
      total_gasto: total,
      falta_para_proximo: faltaParaProximo,
      progresso_percentual: proximo
        ? Math.min(100, Math.max(0, Math.round(
            ((total - (atual ? atual.valor_minimo : 0)) /
             (proximo.valor_minimo - (atual ? atual.valor_minimo : 0) || 1)) * 100
          )))
        : 100,
    };
  }

  static async totalGastoDoUsuario(usuarioId) {
    const [[linha]] = await db.query(
      `SELECT COALESCE(SUM(CASE WHEN status_pagamento = 'aprovado' THEN total ELSE 0 END), 0) AS total_gasto
         FROM pedidos WHERE usuario_id = ?`,
      [usuarioId]
    );
    return Number(linha ? linha.total_gasto : 0) || 0;
  }

  static async progressoDoUsuario(usuarioId) {
    const [niveisAtivos, totalGasto] = await Promise.all([
      NivelCliente.findAllAtivos(),
      NivelCliente.totalGastoDoUsuario(usuarioId),
    ]);
    return NivelCliente.calcularNivel(totalGasto, niveisAtivos);
  }

  static async contarClientesPorNivel() {
    const [niveisAtivos, [totais]] = await Promise.all([
      NivelCliente.findAllAtivos(),
      db.query(SQL_TOTAL_POR_CLIENTE),
    ]);

    const contagem = {};
    let semNivel = 0;
    for (const linha of totais) {
      const resultado = NivelCliente.calcularNivel(Number(linha.total_gasto) || 0, niveisAtivos);
      const idAtual = resultado && resultado.atual ? resultado.atual.id : null;
      if (idAtual == null) { semNivel++; continue; }
      contagem[idAtual] = (contagem[idAtual] || 0) + 1;
    }
    return { contagem, semNivel, totalClientes: totais.length };
  }

  static async impactoDaRemocao(id) {
    const nivel = await NivelCliente.findById(id);
    if (!nivel) return null;

    const { contagem } = await NivelCliente.contarClientesPorNivel();
    const clientesNoNivel = contagem[nivel.id] || 0;

    const restantes = (await NivelCliente.findAllAtivos()).filter(n => n.id !== nivel.id);
    const destino = NivelCliente.calcularNivel(nivel.valor_minimo, restantes);

    return {
      nivel,
      clientes_no_nivel: clientesNoNivel,
      destino: destino && destino.atual ? destino.atual : null,
      total_niveis: (await NivelCliente.findAll()).length,
    };
  }

  /* Escrita */

  static async create({ nome, icone, valor_minimo, descricao, beneficios, ativo = 1 }) {
    const [[{ maxOrdem }]] = await db.query(
      'SELECT COALESCE(MAX(ordem), -1) AS maxOrdem FROM niveis_clientes'
    );
    const [result] = await db.query(
      `INSERT INTO niveis_clientes (nome, icone, valor_minimo, ordem, descricao, beneficios, ativo)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        nome,
        icone || null,
        Number(valor_minimo) || 0,
        Number(maxOrdem) + 1,
        descricao || null,
        beneficios || null,
        ativo ? 1 : 0,
      ]
    );
    return result.insertId;
  }

  static async update(id, campos) {
    const permitidos = ['nome', 'icone', 'valor_minimo', 'descricao', 'beneficios', 'ativo'];
    const sets = [];
    const values = [];

    for (const [chave, valor] of Object.entries(campos)) {
      if (!permitidos.includes(chave)) continue;
      sets.push(`${chave} = ?`);
      if (chave === 'ativo') values.push(valor ? 1 : 0);
      else if (chave === 'valor_minimo') values.push(Number(valor) || 0);
      else values.push(valor === '' ? null : valor);
    }
    if (!sets.length) return 0;

    values.push(id);
    const [result] = await db.query(
      `UPDATE niveis_clientes SET ${sets.join(', ')} WHERE id = ?`,
      values
    );
    return result.affectedRows;
  }

  static async alternarAtivo(id) {
    await db.query('UPDATE niveis_clientes SET ativo = NOT ativo WHERE id = ?', [id]);
    return NivelCliente.findById(id);
  }

  static async mover(id, direcao) {
    const atual = await NivelCliente.findById(id);
    if (!atual) return false;

    const operador  = direcao === 'cima' ? '<' : '>';
    const ordenacao = direcao === 'cima' ? 'DESC' : 'ASC';
    const [vizinhos] = await db.query(
      `SELECT id, ordem FROM niveis_clientes WHERE ordem ${operador} ? ORDER BY ordem ${ordenacao} LIMIT 1`,
      [atual.ordem]
    );
    const vizinho = vizinhos[0];
    if (!vizinho) return false;

    await db.query('UPDATE niveis_clientes SET ordem = ? WHERE id = ?', [vizinho.ordem, atual.id]);
    await db.query('UPDATE niveis_clientes SET ordem = ? WHERE id = ?', [atual.ordem, vizinho.id]);
    return true;
  }

  static async reordenarPorValor() {
    const [rows] = await db.query(
      `SELECT id FROM niveis_clientes ORDER BY valor_minimo ASC, ordem ASC, id ASC`
    );
    for (let i = 0; i < rows.length; i++) {
      await db.query('UPDATE niveis_clientes SET ordem = ? WHERE id = ?', [i, rows[i].id]);
    }
    return rows.length;
  }

  static async delete(id) {
    const [result] = await db.query('DELETE FROM niveis_clientes WHERE id = ?', [id]);
    const [rows] = await db.query('SELECT id FROM niveis_clientes ORDER BY ordem ASC, id ASC');
    for (let i = 0; i < rows.length; i++) {
      await db.query('UPDATE niveis_clientes SET ordem = ? WHERE id = ?', [i, rows[i].id]);
    }
    return result.affectedRows;
  }

  static async contarTodos() {
    const [[{ total }]] = await db.query('SELECT COUNT(*) AS total FROM niveis_clientes');
    return Number(total);
  }
}

module.exports = NivelCliente;
