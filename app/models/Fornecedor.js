'use strict';

const db = require('../../config/db');

const STATUS_VALIDOS = ['ativo', 'inativo', 'bloqueado'];

function arred2(v) {
  return Math.round((Number(v) || 0) * 100) / 100;
}

class Fornecedor {
  static async findAll({
    status = '', busca = '', cidade = '', uf = '',
    dataCadastroDe = '', dataCadastroAte = '',
    comCompras = '', comContasAbertas = '',
  } = {}) {
    const condicoes = [];
    const params = [];
    if (status) { condicoes.push('f.status = ?'); params.push(status); }
    const buscaLimpa = String(busca || '').trim();
    if (buscaLimpa) {
      condicoes.push('(f.razao_social LIKE ? OR f.nome_fantasia LIKE ? OR f.documento LIKE ? OR f.email LIKE ? OR f.telefone LIKE ?)');
      params.push(`%${buscaLimpa}%`, `%${buscaLimpa}%`, `%${buscaLimpa}%`, `%${buscaLimpa}%`, `%${buscaLimpa}%`);
    }
    if (cidade) { condicoes.push('f.cidade LIKE ?'); params.push(`%${cidade}%`); }
    if (uf) { condicoes.push('f.uf = ?'); params.push(uf); }
    if (dataCadastroDe) { condicoes.push('f.criado_em >= ?'); params.push(dataCadastroDe); }
    if (dataCadastroAte) { condicoes.push('f.criado_em <= ?'); params.push(`${dataCadastroAte} 23:59:59`); }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const havingPartes = [];
    if (comCompras === 'true') havingPartes.push('qtd_compras > 0');
    if (comCompras === 'false') havingPartes.push('qtd_compras = 0');
    if (comContasAbertas === 'true') havingPartes.push('qtd_contas_abertas > 0');
    if (comContasAbertas === 'false') havingPartes.push('qtd_contas_abertas = 0');
    const having = havingPartes.length ? `HAVING ${havingPartes.join(' AND ')}` : '';

    const [rows] = await db.query(
      `SELECT f.*,
              COALESCE(c.qtd_compras, 0)     AS qtd_compras,
              COALESCE(c.total_comprado, 0)  AS total_comprado,
              COALESCE(p.total_pago, 0)      AS total_pago,
              COALESCE(ab.qtd_contas_abertas, 0) AS qtd_contas_abertas,
              c.ultima_compra_em
         FROM fornecedores f
         LEFT JOIN (
           SELECT fornecedor_id, COUNT(*) AS qtd_compras,
                  SUM(total) AS total_comprado, MAX(data_compra) AS ultima_compra_em
             FROM compras
            WHERE status = 'registrada'
            GROUP BY fornecedor_id
         ) c ON c.fornecedor_id = f.id
         LEFT JOIN (
           SELECT cp.fornecedor_id, SUM(pf.valor) AS total_pago
             FROM pagamentos_fornecedor pf
             JOIN contas_pagar cp ON cp.id = pf.conta_pagar_id
            WHERE pf.status = 'confirmado' AND cp.status != 'cancelada'
            GROUP BY cp.fornecedor_id
         ) p ON p.fornecedor_id = f.id
         LEFT JOIN (
           SELECT fornecedor_id, COUNT(*) AS qtd_contas_abertas
             FROM contas_pagar
            WHERE status IN ('pendente', 'parcialmente_paga')
            GROUP BY fornecedor_id
         ) ab ON ab.fornecedor_id = f.id
         ${where}
        GROUP BY f.id
        ${having}
        ORDER BY f.razao_social ASC`,
      params
    );
    return rows.map(r => ({
      ...r,
      qtd_compras: Number(r.qtd_compras) || 0,
      total_comprado: Number(r.total_comprado) || 0,
      total_pago: Number(r.total_pago) || 0,
      qtd_contas_abertas: Number(r.qtd_contas_abertas) || 0,
      saldo_em_aberto: arred2((Number(r.total_comprado) || 0) - (Number(r.total_pago) || 0)),
    }));
  }

  static async indicadores() {
    const [[porStatus]] = await db.query(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'ativo' THEN 1 ELSE 0 END) AS ativos,
              SUM(CASE WHEN status != 'ativo' THEN 1 ELSE 0 END) AS inativos
         FROM fornecedores`
    );
    const [[abertas]] = await db.query(
      `SELECT COUNT(DISTINCT fornecedor_id) AS fornecedores_com_contas_abertas,
              COALESCE(SUM(cp.valor_original - COALESCE(pg.total_pago, 0)), 0) AS total_em_aberto
         FROM contas_pagar cp
         LEFT JOIN (
           SELECT conta_pagar_id, SUM(valor) AS total_pago FROM pagamentos_fornecedor WHERE status = 'confirmado' GROUP BY conta_pagar_id
         ) pg ON pg.conta_pagar_id = cp.id
        WHERE cp.status IN ('pendente', 'parcialmente_paga')`
    );
    return {
      total: Number(porStatus.total) || 0,
      ativos: Number(porStatus.ativos) || 0,
      inativos: Number(porStatus.inativos) || 0,
      comContasAbertas: Number(abertas.fornecedores_com_contas_abertas) || 0,
      totalEmAberto: arred2(abertas.total_em_aberto),
    };
  }

  static async resumoFinanceiro(fornecedorId) {
    const [[{ total_comprado }]] = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS total_comprado FROM compras WHERE fornecedor_id = ? AND status = 'registrada'`,
      [fornecedorId]
    );
    const [[{ total_pago }]] = await db.query(
      `SELECT COALESCE(SUM(pf.valor), 0) AS total_pago
         FROM pagamentos_fornecedor pf
         JOIN contas_pagar cp ON cp.id = pf.conta_pagar_id
        WHERE cp.fornecedor_id = ? AND pf.status = 'confirmado' AND cp.status != 'cancelada'`,
      [fornecedorId]
    );
    const [[{ qtd_compras }]] = await db.query(
      `SELECT COUNT(*) AS qtd_compras FROM compras WHERE fornecedor_id = ? AND status = 'registrada'`,
      [fornecedorId]
    );
    const [[{ qtd_contas, total_em_aberto }]] = await db.query(
      `SELECT COUNT(*) AS qtd_contas, COALESCE(SUM(cp.valor_original - COALESCE(pg.total_pago, 0)), 0) AS total_em_aberto
         FROM contas_pagar cp
         LEFT JOIN (
           SELECT conta_pagar_id, SUM(valor) AS total_pago FROM pagamentos_fornecedor WHERE status = 'confirmado' GROUP BY conta_pagar_id
         ) pg ON pg.conta_pagar_id = cp.id
        WHERE cp.fornecedor_id = ? AND cp.status != 'cancelada'`,
      [fornecedorId]
    );
    const [[{ qtd_vencidas }]] = await db.query(
      `SELECT COUNT(*) AS qtd_vencidas FROM contas_pagar
        WHERE fornecedor_id = ? AND status IN ('pendente', 'parcialmente_paga') AND vencimento < CURDATE()`,
      [fornecedorId]
    );
    const comprado = Number(total_comprado) || 0;
    const pago = Number(total_pago) || 0;
    return {
      totalComprado: comprado,
      totalPago: pago,
      totalEmAberto: arred2(total_em_aberto),
      qtdCompras: Number(qtd_compras) || 0,
      qtdContas: Number(qtd_contas) || 0,
      qtdContasVencidas: Number(qtd_vencidas) || 0,
    };
  }

  static async findById(id) {
    const [rows] = await db.query('SELECT * FROM fornecedores WHERE id = ?', [id]);
    return rows[0] ?? null;
  }

  static _camposEndereco(dados) {
    return {
      cep: dados.cep ? String(dados.cep).replace(/\D/g, '').slice(0, 8) : null,
      logradouro: dados.logradouro ? String(dados.logradouro).trim().slice(0, 180) : null,
      numero: dados.numero ? String(dados.numero).trim().slice(0, 20) : null,
      complemento: dados.complemento ? String(dados.complemento).trim().slice(0, 80) : null,
      bairro: dados.bairro ? String(dados.bairro).trim().slice(0, 100) : null,
      cidade: dados.cidade ? String(dados.cidade).trim().slice(0, 100) : null,
      uf: dados.uf ? String(dados.uf).trim().toUpperCase().slice(0, 2) : null,
    };
  }

  static async create(dados) {
    const {
      razao_social, nome_fantasia, documento, telefone, email,
      endereco, status = 'ativo', observacoes,
    } = dados;
    const end = Fornecedor._camposEndereco(dados);
    const validacao = dados.validacao || null;
    const [result] = await db.query(
      `INSERT INTO fornecedores
         (razao_social, nome_fantasia, documento, telefone, email, endereco, status, observacoes,
          cep, logradouro, numero, complemento, bairro, cidade, uf,
          validacao_status, validacao_em, validacao_fonte, validacao_detalhes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(razao_social).trim(),
        nome_fantasia ? String(nome_fantasia).trim() : null,
        documento ? String(documento).trim() : null,
        telefone ? String(telefone).trim() : null,
        email ? String(email).trim() : null,
        endereco ? String(endereco).trim() : null,
        STATUS_VALIDOS.includes(status) ? status : 'ativo',
        observacoes ? String(observacoes).trim().slice(0, 500) : null,
        end.cep, end.logradouro, end.numero, end.complemento, end.bairro, end.cidade, end.uf,
        validacao ? validacao.status : 'nao_validado',
        validacao ? new Date() : null,
        validacao ? validacao.fonte || null : null,
        validacao ? JSON.stringify(validacao.detalhes || {}) : null,
      ]
    );
    return result.insertId;
  }

  static async update(id, dados) {
    const permitidos = ['razao_social', 'nome_fantasia', 'documento', 'telefone', 'email', 'endereco', 'observacoes'];
    const sets = []; const values = [];
    for (const campo of permitidos) {
      if (!(campo in dados)) continue;
      sets.push(`${campo} = ?`);
      const v = dados[campo];
      values.push(v === '' || v == null ? null : String(v).trim());
    }
    const temCampoEndereco = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf'].some(c => c in dados);
    if (temCampoEndereco) {
      const end = Fornecedor._camposEndereco(dados);
      sets.push('cep = ?', 'logradouro = ?', 'numero = ?', 'complemento = ?', 'bairro = ?', 'cidade = ?', 'uf = ?');
      values.push(end.cep, end.logradouro, end.numero, end.complemento, end.bairro, end.cidade, end.uf);
    }
    if (dados.validacao) {
      sets.push('validacao_status = ?', 'validacao_em = NOW()', 'validacao_fonte = ?', 'validacao_detalhes = ?');
      values.push(dados.validacao.status, dados.validacao.fonte || null, JSON.stringify(dados.validacao.detalhes || {}));
    }
    if (!sets.length) return 0;
    values.push(id);
    const [result] = await db.query(`UPDATE fornecedores SET ${sets.join(', ')} WHERE id = ?`, values);
    return result.affectedRows;
  }

  static async definirStatus(id, status) {
    if (!STATUS_VALIDOS.includes(status)) {
      throw new Error(`Status inválido: "${status}". Use: ${STATUS_VALIDOS.join(', ')}`);
    }
    const [result] = await db.query('UPDATE fornecedores SET status = ? WHERE id = ?', [status, id]);
    return result.affectedRows;
  }

  static async delete(id) {
    const [[{ total }]] = await db.query(
      `SELECT
         (SELECT COUNT(*) FROM compras WHERE fornecedor_id = ?) +
         (SELECT COUNT(*) FROM contas_pagar WHERE fornecedor_id = ?) AS total`,
      [id, id]
    );
    if (Number(total) > 0) {
      const erro = new Error('Este fornecedor já tem compras ou contas a pagar registradas e não pode ser excluído — use "Bloquear" ou "Inativar" em vez disso.');
      erro.code = 'FORNECEDOR_COM_HISTORICO';
      throw erro;
    }
    const [result] = await db.query('DELETE FROM fornecedores WHERE id = ?', [id]);
    return result.affectedRows;
  }

  static statusValidos() {
    return STATUS_VALIDOS;
  }
}

module.exports = Fornecedor;
