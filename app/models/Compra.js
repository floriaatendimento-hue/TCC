'use strict';

const db = require('../../config/db');
const dinheiro = require('../helpers/dinheiro');

const STATUS_CONTA_VALIDOS = ['pendente', 'parcialmente_paga', 'paga', 'cancelada'];
const METODOS_PAGAMENTO_VALIDOS = ['transferencia', 'pix', 'boleto', 'cartao', 'dinheiro', 'outro'];

function arred2(v) {
  return dinheiro.paraReais(dinheiro.paraCentavos(v));
}

function statusExibicao(conta) {
  if (['pendente', 'parcialmente_paga'].includes(conta.status)) {
    const hoje = dataLocalIso(new Date());
    const vencimento = conta.vencimento instanceof Date
      ? dataLocalIso(conta.vencimento)
      : String(conta.vencimento).slice(0, 10);
    if (vencimento < hoje) return 'vencida';
  }
  return conta.status;
}

function dataLocalIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function condicaoStatusConta(statusConta) {
  switch (statusConta) {
    case 'vencida':
      return { sql: `cp.status IN ('pendente','parcialmente_paga') AND cp.vencimento < CURDATE()`, params: [] };
    case 'pendente':
      return { sql: `cp.status = 'pendente' AND cp.vencimento >= CURDATE()`, params: [] };
    case 'parcialmente_paga':
      return { sql: `cp.status = 'parcialmente_paga' AND cp.vencimento >= CURDATE()`, params: [] };
    case 'paga':
    case 'cancelada':
      return { sql: `cp.status = ?`, params: [statusConta] };
    default:
      return null;
  }
}

function somarDias(dataIso, dias) {
  const d = new Date(String(dataIso).slice(0, 10) + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function dividirEmParcelas(total, n) {
  return dinheiro.dividirEmParcelas(dinheiro.paraCentavos(total), n).map(dinheiro.paraReais);
}

class Compra {
  // Criação

  static async create({
    fornecedor_id, data_compra, itens = [], desconto = 0, frete = 0, impostos = 0, taxas = 0,
    vencimento, observacoes = null,
    forma_pagamento = 'a_vista', numero_parcelas = 1, primeiro_vencimento = null, intervalo_dias = 30,
  }, usuarioAdminNome = null) {
    if (!itens.length) {
      const erro = new Error('A compra precisa ter pelo menos um item.');
      erro.code = 'SEM_ITENS';
      throw erro;
    }
    if (!['a_vista', 'parcelado'].includes(forma_pagamento)) {
      const erro = new Error('Forma de pagamento inválida. Use "a_vista" ou "parcelado".');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }
    const nParcelas = forma_pagamento === 'parcelado' ? Math.trunc(Number(numero_parcelas) || 0) : 1;
    if (forma_pagamento === 'parcelado' && !(nParcelas >= 2 && nParcelas <= 60)) {
      const erro = new Error('Número de parcelas inválido — use entre 2 e 60.');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }
    const primeiroVencimentoUsado = forma_pagamento === 'parcelado' ? primeiro_vencimento : vencimento;
    if (!primeiroVencimentoUsado) {
      const erro = new Error('Informe o vencimento da conta a pagar.');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }
    const intervaloDiasUsado = Math.trunc(Number(intervalo_dias) || 30);
    if (forma_pagamento === 'parcelado' && !(intervaloDiasUsado >= 1 && intervaloDiasUsado <= 365)) {
      const erro = new Error('Intervalo entre parcelas inválido — use entre 1 e 365 dias.');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[fornecedor]] = await conn.query('SELECT id, status FROM fornecedores WHERE id = ? FOR UPDATE', [fornecedor_id]);
      if (!fornecedor) {
        const erro = new Error('Fornecedor não encontrado.');
        erro.code = 'FORNECEDOR_INVALIDO';
        throw erro;
      }
      if (fornecedor.status !== 'ativo') {
        const erro = new Error(`Fornecedor está "${fornecedor.status}" e não pode receber novas compras. Reative-o primeiro.`);
        erro.code = 'FORNECEDOR_NAO_ATIVO';
        throw erro;
      }

      const produtosVistos = new Set();
      const itensValidados = itens.map(i => {
        const quantidade = Number(i.quantidade);
        const preco_unit = Number(i.preco_unit);
        const produto_id = i.produto_id ? Number(i.produto_id) : null;
        const unidade = i.unidade ? String(i.unidade).trim().slice(0, 10) : null;

        if (!(quantidade > 0) || quantidade > 999999999) {
          const erro = new Error('Quantidade do item deve ser maior que zero.');
          erro.code = 'ITEM_INVALIDO';
          throw erro;
        }
        if (!(preco_unit >= 0) || preco_unit > 9999999999.99) {
          const erro = new Error('Preço unitário do item inválido.');
          erro.code = 'ITEM_INVALIDO';
          throw erro;
        }
        const brutoCentavos = dinheiro.multiplicar(quantidade, preco_unit);
        const descontoCentavos = dinheiro.paraCentavos(i.desconto || 0);
        if (descontoCentavos < 0n) {
          const erro = new Error('Desconto do item não pode ser negativo.');
          erro.code = 'ITEM_INVALIDO';
          throw erro;
        }
        if (descontoCentavos > brutoCentavos) {
          const erro = new Error('Desconto do item não pode ser maior que o subtotal dele.');
          erro.code = 'ITEM_INVALIDO';
          throw erro;
        }
        if (brutoCentavos > dinheiro.CENTAVOS_MAX) {
          const erro = new Error('O subtotal deste item excede o valor máximo permitido (R$ 9.999.999.999,99).');
          erro.code = 'ITEM_INVALIDO';
          throw erro;
        }
        if (produto_id) {
          if (produtosVistos.has(produto_id)) {
            const erro = new Error('Este produto já foi adicionado nesta compra — ajuste a quantidade em vez de repetir o item.');
            erro.code = 'ITEM_DUPLICADO';
            throw erro;
          }
          produtosVistos.add(produto_id);
        }
        const descricao = String(i.descricao || '').trim();
        if (!descricao) {
          const erro = new Error('Todo item precisa de uma descrição.');
          erro.code = 'ITEM_INVALIDO';
          throw erro;
        }
        return {
          descricao: descricao.slice(0, 200), quantidade, preco_unit, produto_id, unidade,
          desconto: dinheiro.paraReais(descontoCentavos),
          subtotal: dinheiro.paraReais(brutoCentavos - descontoCentavos),
          subtotalCentavos: brutoCentavos - descontoCentavos,
        };
      });

      const subtotalCentavos = itensValidados.reduce((s, i) => s + i.subtotalCentavos, 0n);
      const descontoCentavosCompra = dinheiro.paraCentavos(desconto);
      const freteCentavos = dinheiro.paraCentavos(frete);
      const impostosCentavos = dinheiro.paraCentavos(impostos);
      const taxasCentavos = dinheiro.paraCentavos(taxas);

      if (descontoCentavosCompra < 0n || freteCentavos < 0n || impostosCentavos < 0n || taxasCentavos < 0n) {
        const erro = new Error('Desconto, frete, impostos e taxas não podem ser negativos.');
        erro.code = 'VALOR_INVALIDO';
        throw erro;
      }
      if (descontoCentavosCompra > subtotalCentavos) {
        const erro = new Error('O desconto não pode ser maior que o subtotal dos itens.');
        erro.code = 'DESCONTO_MAIOR_QUE_SUBTOTAL';
        throw erro;
      }

      const totalCentavos = subtotalCentavos - descontoCentavosCompra + freteCentavos + impostosCentavos + taxasCentavos;
      dinheiro.garantirLimite(subtotalCentavos, 'O subtotal da compra');
      dinheiro.garantirLimite(freteCentavos, 'O frete');
      dinheiro.garantirLimite(impostosCentavos, 'Os impostos');
      dinheiro.garantirLimite(taxasCentavos, 'As taxas');
      dinheiro.garantirLimite(totalCentavos, 'O total da compra');

      const subtotal = dinheiro.paraReais(subtotalCentavos);
      const descontoVal = dinheiro.paraReais(descontoCentavosCompra);
      const freteVal = dinheiro.paraReais(freteCentavos);
      const impostosVal = dinheiro.paraReais(impostosCentavos);
      const taxasVal = dinheiro.paraReais(taxasCentavos);
      const total = dinheiro.paraReais(totalCentavos);

      const [resultCompra] = await conn.query(
        `INSERT INTO compras (fornecedor_id, status, data_compra, subtotal, desconto, frete, impostos, taxas, total, observacoes, usuario_admin_nome, forma_pagamento)
         VALUES (?, 'registrada', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [fornecedor_id, data_compra, subtotal, descontoVal, freteVal, impostosVal, taxasVal, total,
          observacoes ? String(observacoes).trim().slice(0, 500) : null, usuarioAdminNome, forma_pagamento]
      );
      const compra_id = resultCompra.insertId;

      await conn.query(
        `INSERT INTO itens_compra (compra_id, produto_id, descricao, quantidade, preco_unit, desconto, unidade, subtotal) VALUES ?`,
        [itensValidados.map(i => [compra_id, i.produto_id, i.descricao, i.quantidade, i.preco_unit, i.desconto, i.unidade, i.subtotal])]
      );

      const semCusto = totalCentavos === 0n && nParcelas === 1;
      const valoresParcelas = semCusto ? [0] : dividirEmParcelas(total, nParcelas);
      const statusConta = semCusto ? 'paga' : 'pendente';
      const linhasContas = valoresParcelas.map((valor, idx) => [
        compra_id, fornecedor_id, valor, somarDias(primeiroVencimentoUsado, idx * intervaloDiasUsado),
        statusConta, idx + 1, nParcelas, 'compra_fornecedor',
      ]);
      await conn.query(
        `INSERT INTO contas_pagar (compra_id, fornecedor_id, valor_original, vencimento, status, parcela_numero, parcela_total, categoria) VALUES ?`,
        [linhasContas]
      );

      await conn.commit();
      return compra_id;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async createIdempotente(dados, usuarioAdminNome, idempotencyKey, usuarioAdminId) {
    if (!idempotencyKey) return { idempotente: false, compra_id: await Compra.create(dados, usuarioAdminNome) };
    if (!usuarioAdminId) throw new Error('createIdempotente exige o ID numérico do admin quando uma Idempotency-Key é usada.');

    const IdempotenciaAdmin = require('./IdempotenciaAdmin');
    const chave = String(idempotencyKey).slice(0, 100);
    const reserva = await IdempotenciaAdmin.reservar(chave, usuarioAdminId, 'compra.criar');
    if (!reserva.novo) {
      if (reserva.registro.status === 'concluido') {
        return { idempotente: true, compra_id: reserva.registro.referencia_id };
      }
      const erro = new Error('Esta compra já está sendo registrada. Aguarde antes de tentar novamente.');
      erro.code = 'IDEMPOTENCIA_EM_ANDAMENTO';
      throw erro;
    }

    try {
      const compra_id = await Compra.create(dados, usuarioAdminNome);
      await IdempotenciaAdmin.concluir(chave, usuarioAdminId, compra_id);
      return { idempotente: false, compra_id };
    } catch (err) {
      await IdempotenciaAdmin.liberar(chave, usuarioAdminId).catch((erroLiberar) => {
        console.error('[compra] falha ao liberar chave de idempotência:', erroLiberar.message);
      });
      throw err;
    }
  }

  static async criarContaAvulsa({ fornecedor_id, descricao, categoria = 'outro', valor, vencimento, observacoes = null }, usuarioAdminNome = null) {
    const descricaoLimpa = String(descricao || '').trim();
    if (!descricaoLimpa) {
      const erro = new Error('Informe uma descrição para a conta.');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }
    const valorNum = arred2(valor);
    if (!(valorNum > 0) || valorNum > 9999999999.99) {
      const erro = new Error('Valor da conta inválido.');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }
    if (!vencimento) {
      const erro = new Error('Informe o vencimento da conta.');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [[fornecedor]] = await conn.query('SELECT id, status FROM fornecedores WHERE id = ? FOR UPDATE', [fornecedor_id]);
      if (!fornecedor) {
        const erro = new Error('Fornecedor/beneficiário não encontrado.');
        erro.code = 'FORNECEDOR_INVALIDO';
        throw erro;
      }
      if (fornecedor.status !== 'ativo') {
        const erro = new Error(`Fornecedor está "${fornecedor.status}" — reative-o antes de lançar uma conta.`);
        erro.code = 'FORNECEDOR_NAO_ATIVO';
        throw erro;
      }
      const [result] = await conn.query(
        `INSERT INTO contas_pagar (compra_id, fornecedor_id, valor_original, vencimento, status, parcela_numero, parcela_total, descricao, categoria, observacoes)
         VALUES (NULL, ?, ?, ?, 'pendente', 1, 1, ?, ?, ?)`,
        [fornecedor_id, valorNum, vencimento, descricaoLimpa.slice(0, 200), String(categoria).trim().slice(0, 40),
          observacoes ? String(observacoes).trim().slice(0, 500) : null]
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

  // Listagens

  static _condicoesCompras({ fornecedorId = '', statusConta = '', busca = '', de = '', ate = '' } = {}) {
    const condicoes = [];
    const params = [];
    if (fornecedorId) { condicoes.push('c.fornecedor_id = ?'); params.push(fornecedorId); }
    if (de) { condicoes.push('c.data_compra >= ?'); params.push(de); }
    if (ate) { condicoes.push('c.data_compra <= ?'); params.push(ate); }
    const buscaLimpa = String(busca || '').trim();
    if (buscaLimpa) {
      const ehNumero = /^\d+$/.test(buscaLimpa);
      const partes = [];
      if (ehNumero) { partes.push('c.id = ?'); params.push(Number(buscaLimpa)); }
      partes.push('f.razao_social LIKE ?'); params.push(`%${buscaLimpa}%`);
      partes.push('f.nome_fantasia LIKE ?'); params.push(`%${buscaLimpa}%`);
      condicoes.push(`(${partes.join(' OR ')})`);
    }
    if (statusConta === 'cancelada') {
      condicoes.push(`c.status = 'cancelada'`);
    } else if (statusConta) {
      condicoes.push(`c.status != 'cancelada'`);
    }
    return { where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '', params };
  }

  static _havingStatusConta(statusConta) {
    switch (statusConta) {
      case 'vencida': return 'HAVING tem_vencida = 1';
      case 'paga': return 'HAVING tem_vencida = 0 AND qtd_paga = qtd_parcelas';
      case 'parcialmente_paga': return 'HAVING tem_vencida = 0 AND qtd_paga < qtd_parcelas AND (qtd_paga > 0 OR qtd_parcial > 0)';
      case 'pendente': return 'HAVING tem_vencida = 0 AND qtd_paga = 0 AND qtd_parcial = 0';
      default: return '';
    }
  }

  static _nucleoAgregadoCompras({ fornecedorId, statusConta, busca, de, ate }) {
    const { where, params } = Compra._condicoesCompras({ fornecedorId, statusConta, busca, de, ate });
    const having = statusConta === 'cancelada' ? '' : Compra._havingStatusConta(statusConta);
    const sql = `
      SELECT c.id, c.data_compra, c.status, c.total, c.criado_em, c.forma_pagamento,
             f.id AS fornecedor_id, f.razao_social AS fornecedor_nome,
             COUNT(cp.id) AS qtd_parcelas,
             MIN(cp.vencimento) AS proximo_vencimento,
             SUM(cp.valor_original) AS valor_parcelas,
             SUM(COALESCE(pg.total_pago, 0)) AS total_pago,
             MAX(CASE WHEN cp.status IN ('pendente','parcialmente_paga') AND cp.vencimento < CURDATE() THEN 1 ELSE 0 END) AS tem_vencida,
             SUM(CASE WHEN cp.status = 'parcialmente_paga' THEN 1 ELSE 0 END) AS qtd_parcial,
             SUM(CASE WHEN cp.status = 'pendente' THEN 1 ELSE 0 END) AS qtd_pendente,
             SUM(CASE WHEN cp.status = 'paga' THEN 1 ELSE 0 END) AS qtd_paga
        FROM compras c
        JOIN fornecedores f ON f.id = c.fornecedor_id
        LEFT JOIN contas_pagar cp ON cp.compra_id = c.id
        LEFT JOIN (
          SELECT conta_pagar_id, SUM(valor) AS total_pago
            FROM pagamentos_fornecedor WHERE status = 'confirmado'
           GROUP BY conta_pagar_id
        ) pg ON pg.conta_pagar_id = cp.id
        ${where}
       GROUP BY c.id
       ${having}`;
    return { sql, params };
  }

  static _statusAgregadoCompra(r) {
    if (r.status === 'cancelada') return 'cancelada';
    const qtdParcelas = Number(r.qtd_parcelas) || 0;
    if (qtdParcelas === 0) return null; // defensivo — nunca deveria acontecer
    if (Number(r.tem_vencida)) return 'vencida';
    const qtdPaga = Number(r.qtd_paga) || 0;
    if (qtdPaga === qtdParcelas) return 'paga';
    if (qtdPaga > 0 || Number(r.qtd_parcial) > 0) return 'parcialmente_paga';
    return 'pendente';
  }

  static async findAllAdmin({ fornecedorId = '', statusConta = '', busca = '', de = '', ate = '', limite = 50, offset = 0 } = {}) {
    const { sql, params } = Compra._nucleoAgregadoCompras({ fornecedorId, statusConta, busca, de, ate });
    const [rows] = await db.query(
      `${sql} ORDER BY data_compra DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );
    return rows.map(r => {
      const totalPago = Number(r.total_pago) || 0;
      const valorParcelas = Number(r.valor_parcelas) || 0;
      return {
        id: r.id, data_compra: r.data_compra, status: r.status, total: Number(r.total) || 0,
        forma_pagamento: r.forma_pagamento,
        fornecedor_id: r.fornecedor_id, fornecedor_nome: r.fornecedor_nome,
        qtd_parcelas: Number(r.qtd_parcelas) || 0,
        vencimento: r.proximo_vencimento,
        saldo: arred2(valorParcelas - totalPago),
        total_pago: totalPago,
        conta_status: Compra._statusAgregadoCompra(r),
      };
    });
  }

  static async contarFiltrado({ fornecedorId = '', statusConta = '', busca = '', de = '', ate = '' } = {}) {
    const { sql, params } = Compra._nucleoAgregadoCompras({ fornecedorId, statusConta, busca, de, ate });
    const [[{ total }]] = await db.query(`SELECT COUNT(*) AS total FROM (${sql}) sub`, params);
    return Number(total) || 0;
  }

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT c.*, f.razao_social AS fornecedor_nome, f.nome_fantasia AS fornecedor_fantasia, f.status AS fornecedor_status
         FROM compras c
         JOIN fornecedores f ON f.id = c.fornecedor_id
        WHERE c.id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async itensDaCompra(compra_id) {
    const [rows] = await db.query(
      `SELECT * FROM itens_compra WHERE compra_id = ? ORDER BY id`, [compra_id]
    );
    return rows.map(r => ({
      ...r,
      quantidade: Number(r.quantidade), preco_unit: Number(r.preco_unit),
      desconto: Number(r.desconto) || 0, subtotal: Number(r.subtotal),
    }));
  }

  static async contasPagarDaCompra(compra_id) {
    const [rows] = await db.query(
      `SELECT cp.*, COALESCE(pg.total_pago, 0) AS total_pago
         FROM contas_pagar cp
         LEFT JOIN (
           SELECT conta_pagar_id, SUM(valor) AS total_pago
             FROM pagamentos_fornecedor WHERE status = 'confirmado'
            GROUP BY conta_pagar_id
         ) pg ON pg.conta_pagar_id = cp.id
        WHERE cp.compra_id = ?
        ORDER BY cp.parcela_numero`,
      [compra_id]
    );
    return rows.map(conta => {
      const valorOriginal = Number(conta.valor_original);
      const pago = Number(conta.total_pago) || 0;
      return {
        ...conta,
        valor_original: valorOriginal,
        total_pago: pago,
        saldo: arred2(valorOriginal - pago),
        status_exibicao: statusExibicao(conta),
      };
    });
  }

  static _condicoesContasPagar({ fornecedorId = '', statusConta = '', categoria = '', de = '', ate = '', compraId = '', busca = '' } = {}) {
    const condicoes = [];
    const params = [];
    if (fornecedorId) { condicoes.push('cp.fornecedor_id = ?'); params.push(fornecedorId); }
    if (categoria) { condicoes.push('cp.categoria = ?'); params.push(categoria); }
    if (de) { condicoes.push('cp.vencimento >= ?'); params.push(de); }
    if (ate) { condicoes.push('cp.vencimento <= ?'); params.push(ate); }
    if (compraId) { condicoes.push('cp.compra_id = ?'); params.push(compraId); }
    const buscaLimpa = String(busca || '').trim();
    if (buscaLimpa) {
      const ehNumero = /^\d+$/.test(buscaLimpa);
      const partes = [];
      if (ehNumero) { partes.push('cp.id = ?'); params.push(Number(buscaLimpa)); partes.push('cp.compra_id = ?'); params.push(Number(buscaLimpa)); }
      partes.push('f.razao_social LIKE ?'); params.push(`%${buscaLimpa}%`);
      partes.push('cp.descricao LIKE ?'); params.push(`%${buscaLimpa}%`);
      condicoes.push(`(${partes.join(' OR ')})`);
    }
    if (statusConta) {
      const cond = condicaoStatusConta(statusConta);
      if (cond) { condicoes.push(cond.sql); params.push(...cond.params); }
    }
    return { where: condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '', params };
  }

  static async contasPagarTodas({ fornecedorId = '', statusConta = '', categoria = '', de = '', ate = '', compraId = '', busca = '', limite = 50, offset = 0 } = {}) {
    const { where, params } = Compra._condicoesContasPagar({ fornecedorId, statusConta, categoria, de, ate, compraId, busca });
    const [rows] = await db.query(
      `SELECT cp.*, f.razao_social AS fornecedor_nome, c.id AS compra_numero,
              COALESCE(pg.total_pago, 0) AS total_pago
         FROM contas_pagar cp
         JOIN fornecedores f ON f.id = cp.fornecedor_id
         LEFT JOIN compras c ON c.id = cp.compra_id
         LEFT JOIN (
           SELECT conta_pagar_id, SUM(valor) AS total_pago
             FROM pagamentos_fornecedor WHERE status = 'confirmado'
            GROUP BY conta_pagar_id
         ) pg ON pg.conta_pagar_id = cp.id
         ${where}
        ORDER BY cp.vencimento ASC, cp.id ASC
        LIMIT ? OFFSET ?`,
      [...params, limite, offset]
    );
    return rows.map(r => {
      const valorOriginal = Number(r.valor_original);
      const pago = Number(r.total_pago) || 0;
      return {
        ...r, valor_original: valorOriginal, total_pago: pago,
        saldo: arred2(valorOriginal - pago),
        status_exibicao: statusExibicao(r),
      };
    });
  }

  static async contarContasPagarTodas(filtros) {
    const { where, params } = Compra._condicoesContasPagar(filtros || {});
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total
         FROM contas_pagar cp
         JOIN fornecedores f ON f.id = cp.fornecedor_id
         ${where}`,
      params
    );
    return Number(total) || 0;
  }

  static async pagamentosDaConta(conta_pagar_id) {
    const [rows] = await db.query(
      `SELECT * FROM pagamentos_fornecedor WHERE conta_pagar_id = ? ORDER BY data_pagamento DESC, id DESC`,
      [conta_pagar_id]
    );
    return rows.map(r => ({ ...r, valor: Number(r.valor) }));
  }

  // Pagamentos

  static async registrarPagamento({ conta_pagar_id, valor, data_pagamento, metodo, referencia = null, observacoes = null }, usuarioAdminNome = null) {
    if (!METODOS_PAGAMENTO_VALIDOS.includes(metodo)) {
      const erroMetodo = new Error(`Método de pagamento inválido. Use: ${METODOS_PAGAMENTO_VALIDOS.join(', ')}`);
      erroMetodo.code = 'VALOR_INVALIDO';
      throw erroMetodo;
    }
    const valorNum = arred2(valor);
    if (!(valorNum > 0)) {
      const erro = new Error('O valor do pagamento deve ser maior que zero.');
      erro.code = 'VALOR_INVALIDO';
      throw erro;
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[conta]] = await conn.query('SELECT * FROM contas_pagar WHERE id = ? FOR UPDATE', [conta_pagar_id]);
      if (!conta) {
        const erro = new Error('Conta a pagar não encontrada.');
        erro.code = 'CONTA_NAO_ENCONTRADA';
        throw erro;
      }
      if (conta.status === 'cancelada') {
        const erro = new Error('Esta conta a pagar foi cancelada e não aceita mais pagamentos.');
        erro.code = 'CONTA_CANCELADA';
        throw erro;
      }

      const [[{ total_pago }]] = await conn.query(
        `SELECT COALESCE(SUM(valor), 0) AS total_pago FROM pagamentos_fornecedor WHERE conta_pagar_id = ? AND status = 'confirmado' FOR UPDATE`,
        [conta_pagar_id]
      );
      const saldoAtual = arred2(Number(conta.valor_original) - (Number(total_pago) || 0));

      if (valorNum > saldoAtual) {
        const erro = new Error(`Pagamento de ${valorNum.toFixed(2)} excede o saldo devedor de ${saldoAtual.toFixed(2)}.`);
        erro.code = 'PAGAMENTO_MAIOR_QUE_SALDO';
        throw erro;
      }

      await conn.query(
        `INSERT INTO pagamentos_fornecedor (conta_pagar_id, valor, data_pagamento, metodo, referencia, observacoes, usuario_admin_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [conta_pagar_id, valorNum, data_pagamento, metodo, referencia ? String(referencia).trim().slice(0, 120) : null,
          observacoes ? String(observacoes).trim().slice(0, 500) : null, usuarioAdminNome]
      );

      const novoSaldo = arred2(saldoAtual - valorNum);
      const novoStatus = novoSaldo <= 0 ? 'paga' : 'parcialmente_paga';
      await conn.query(`UPDATE contas_pagar SET status = ? WHERE id = ?`, [novoStatus, conta_pagar_id]);

      await conn.commit();
      return { saldo: novoSaldo, status: novoStatus };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static async estornarPagamento(pagamento_id, usuarioAdminNome = null) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[referencia]] = await conn.query(
        'SELECT conta_pagar_id FROM pagamentos_fornecedor WHERE id = ?', [pagamento_id]
      );
      if (!referencia) {
        const erro = new Error('Pagamento não encontrado.');
        erro.code = 'PAGAMENTO_NAO_ENCONTRADO';
        throw erro;
      }

      const [[conta]] = await conn.query('SELECT * FROM contas_pagar WHERE id = ? FOR UPDATE', [referencia.conta_pagar_id]);
      const [[pagamento]] = await conn.query('SELECT * FROM pagamentos_fornecedor WHERE id = ? FOR UPDATE', [pagamento_id]);
      if (pagamento.status === 'estornado') {
        await conn.rollback();
        return { jaEstava: true };
      }

      await conn.query(
        `UPDATE pagamentos_fornecedor SET status = 'estornado', estornado_por = ?, estornado_em = NOW() WHERE id = ?`,
        [usuarioAdminNome, pagamento_id]
      );

      const [[{ total_pago }]] = await conn.query(
        `SELECT COALESCE(SUM(valor), 0) AS total_pago FROM pagamentos_fornecedor WHERE conta_pagar_id = ? AND status = 'confirmado'`,
        [pagamento.conta_pagar_id]
      );
      const novoSaldo = arred2(Number(conta.valor_original) - (Number(total_pago) || 0));
      const novoStatus = conta.status === 'cancelada' ? 'cancelada' : (novoSaldo <= 0 ? 'paga' : (novoSaldo < Number(conta.valor_original) ? 'parcialmente_paga' : 'pendente'));
      await conn.query(`UPDATE contas_pagar SET status = ? WHERE id = ?`, [novoStatus, pagamento.conta_pagar_id]);

      await conn.commit();
      return { jaEstava: false, saldo: novoSaldo, status: novoStatus };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Cancelamento

  static async cancelar(compra_id, motivo, usuarioAdminNome = null) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[compra]] = await conn.query('SELECT * FROM compras WHERE id = ? FOR UPDATE', [compra_id]);
      if (!compra) {
        const erro = new Error('Compra não encontrada.');
        erro.code = 'COMPRA_NAO_ENCONTRADA';
        throw erro;
      }
      if (compra.status === 'cancelada') {
        await conn.rollback();
        return { jaEstava: true };
      }

      const [contas] = await conn.query('SELECT * FROM contas_pagar WHERE compra_id = ? FOR UPDATE', [compra_id]);
      const [[{ total_pago }]] = await conn.query(
        `SELECT COALESCE(SUM(pf.valor), 0) AS total_pago
           FROM pagamentos_fornecedor pf
           JOIN contas_pagar cp ON cp.id = pf.conta_pagar_id
          WHERE cp.compra_id = ? AND pf.status = 'confirmado'`,
        [compra_id]
      );
      if (Number(total_pago) > 0) {
        const erro = new Error('Esta compra já tem pagamento(s) registrado(s) — estorne os pagamentos antes de cancelar.');
        erro.code = 'COMPRA_COM_PAGAMENTO';
        throw erro;
      }

      await conn.query(
        `UPDATE compras SET status = 'cancelada', motivo_cancelamento = ? WHERE id = ?`,
        [motivo ? String(motivo).trim().slice(0, 255) : null, compra_id]
      );
      if (contas.length) {
        await conn.query(`UPDATE contas_pagar SET status = 'cancelada' WHERE compra_id = ?`, [compra_id]);
      }

      await conn.commit();
      return { jaEstava: false };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Agregados

  static async resumoGeral() {
    const [[{ total_comprado }]] = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS total_comprado FROM compras WHERE status = 'registrada'`
    );
    const [[{ total_pago }]] = await db.query(
      `SELECT COALESCE(SUM(pf.valor), 0) AS total_pago
         FROM pagamentos_fornecedor pf
         JOIN contas_pagar cp ON cp.id = pf.conta_pagar_id
        WHERE pf.status = 'confirmado' AND cp.status != 'cancelada'`
    );
    const [[{ total_vencido }]] = await db.query(
      `SELECT COALESCE(SUM(cp.valor_original - COALESCE(pg.total_pago, 0)), 0) AS total_vencido
         FROM contas_pagar cp
         LEFT JOIN (
           SELECT conta_pagar_id, SUM(valor) AS total_pago FROM pagamentos_fornecedor WHERE status = 'confirmado' GROUP BY conta_pagar_id
         ) pg ON pg.conta_pagar_id = cp.id
        WHERE cp.status IN ('pendente', 'parcialmente_paga') AND cp.vencimento < CURDATE()`
    );
    const comprado = Number(total_comprado) || 0;
    const pago = Number(total_pago) || 0;
    return {
      totalComprado: comprado,
      totalPago: pago,
      totalEmAberto: arred2(comprado - pago),
      totalVencido: Number(total_vencido) || 0,
    };
  }

  static async resumoVencimentos() {
    const [[{ vence_hoje }]] = await db.query(
      `SELECT COALESCE(SUM(cp.valor_original - COALESCE(pg.total_pago, 0)), 0) AS vence_hoje
         FROM contas_pagar cp
         LEFT JOIN (
           SELECT conta_pagar_id, SUM(valor) AS total_pago FROM pagamentos_fornecedor WHERE status = 'confirmado' GROUP BY conta_pagar_id
         ) pg ON pg.conta_pagar_id = cp.id
        WHERE cp.status IN ('pendente', 'parcialmente_paga') AND cp.vencimento = CURDATE()`
    );
    const [[{ proximos_7_dias }]] = await db.query(
      `SELECT COALESCE(SUM(cp.valor_original - COALESCE(pg.total_pago, 0)), 0) AS proximos_7_dias
         FROM contas_pagar cp
         LEFT JOIN (
           SELECT conta_pagar_id, SUM(valor) AS total_pago FROM pagamentos_fornecedor WHERE status = 'confirmado' GROUP BY conta_pagar_id
         ) pg ON pg.conta_pagar_id = cp.id
        WHERE cp.status IN ('pendente', 'parcialmente_paga') AND cp.vencimento BETWEEN DATE_ADD(CURDATE(), INTERVAL 1 DAY) AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)`
    );
    return {
      venceHoje: Number(vence_hoje) || 0,
      proximosVencimentos: Number(proximos_7_dias) || 0,
    };
  }

  static statusContaValidos() {
    return STATUS_CONTA_VALIDOS;
  }

  static metodosPagamentoValidos() {
    return METODOS_PAGAMENTO_VALIDOS;
  }

  static statusExibicaoContaPagar(conta) {
    return statusExibicao(conta);
  }
}

module.exports = Compra;
