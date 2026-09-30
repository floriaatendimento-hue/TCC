'use strict';

const db = require('../../config/db');

class MovimentacaoEstoque {
  static async registrar({ produto_id, tipo, quantidade, motivo, usuario_id, usuario_nome }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [produtoRows] = await conn.query(
        'SELECT id, nome, estoque FROM produtos WHERE id = ? FOR UPDATE',
        [produto_id]
      );
      const produto = produtoRows[0];
      if (!produto) {
        const erro = new Error('Produto não encontrado.');
        erro.code = 'PRODUTO_NAO_ENCONTRADO';
        throw erro;
      }

      const estoqueAnterior = Number(produto.estoque);
      const qtd = Number(quantidade);
      let estoqueNovo;
      if (tipo === 'entrada') estoqueNovo = estoqueAnterior + qtd;
      else if (tipo === 'saida') {
        if (qtd > estoqueAnterior) {
          const erro = new Error(`Saída de ${qtd} excede o estoque disponível (${estoqueAnterior}).`);
          erro.code = 'ESTOQUE_INSUFICIENTE';
          throw erro;
        }
        estoqueNovo = estoqueAnterior - qtd;
      } else estoqueNovo = qtd;

      if (estoqueNovo > MovimentacaoEstoque.ESTOQUE_MAXIMO) {
        const erro = new Error(`O estoque resultante (${estoqueNovo}) excede o limite permitido (${MovimentacaoEstoque.ESTOQUE_MAXIMO}).`);
        erro.code = 'VALOR_INVALIDO';
        throw erro;
      }

      await conn.query('UPDATE produtos SET estoque = ? WHERE id = ?', [estoqueNovo, produto.id]);
      await conn.query(
        `INSERT INTO movimentacoes_estoque
           (produto_id, produto_nome, tipo, quantidade, estoque_anterior, estoque_novo, motivo, usuario_id, usuario_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [produto.id, produto.nome, tipo, Number(quantidade), estoqueAnterior, estoqueNovo, motivo || null, usuario_id || null, usuario_nome || null]
      );

      await conn.commit();
      return { estoqueAnterior, estoqueNovo };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async historico({ produto_id = '', limite = 30, offset = 0 } = {}) {
    const params = [];
    let where = '';
    if (produto_id) { where = 'WHERE produto_id = ?'; params.push(produto_id); }
    params.push(limite, offset);
    const [rows] = await db.query(
      `SELECT * FROM movimentacoes_estoque ${where} ORDER BY criado_em DESC LIMIT ? OFFSET ?`,
      params
    );
    return rows;
  }

  static async relatorioPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT * FROM movimentacoes_estoque
        WHERE DATE(criado_em) BETWEEN ? AND ?
        ORDER BY criado_em DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({
      ...r,
      quantidade: Number(r.quantidade) || 0,
      estoque_anterior: Number(r.estoque_anterior) || 0,
      estoque_novo: Number(r.estoque_novo) || 0,
    }));
  }

  static async contar(produto_id = '') {
    const params = [];
    let where = '';
    if (produto_id) { where = 'WHERE produto_id = ?'; params.push(produto_id); }
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM movimentacoes_estoque ${where}`, params);
    return Number(total);
  }
}

MovimentacaoEstoque.ESTOQUE_MAXIMO = 1000000000;

module.exports = MovimentacaoEstoque;
