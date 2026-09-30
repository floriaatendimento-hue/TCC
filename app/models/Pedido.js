'use strict';

const db = require('../../config/db');
const { resolverImagemUrl } = require('../helpers/imagemUrl');

const STATUS_VALIDOS = ['preparando', 'enviado', 'em_transporte', 'saiu_entrega', 'entregue', 'cancelado'];

const STATUS_CANCELAVEL = ['preparando', 'enviado'];

const ROTULOS_ETAPA = {
  confirmado:    'Pedido confirmado',
  preparando:    'Em preparação',
  enviado:       'Enviado',
  em_transporte: 'Em transporte',
  saiu_entrega:  'Saiu para entrega',
  entregue:      'Entregue',
  cancelado:     'Cancelado',
};

const STATUS_PAGAMENTO_VALIDOS = ['pendente', 'processando', 'aprovado', 'recusado', 'expirado', 'estornado'];

const ROTULOS_STATUS_PAGAMENTO = {
  pendente:    'Aguardando pagamento',
  processando: 'Pagamento em processamento',
  aprovado:    'Pago',
  recusado:    'Pagamento recusado',
  expirado:    'Pagamento expirado',
  estornado:   'Reembolsado',
};

function gerarCodigoRastreio() {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  let sufixo = '';
  for (let i = 0; i < 8; i++) sufixo += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return `BR-${sufixo}`;
}

function somarDias(dias, base = new Date()) {
  const d = new Date(base);
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

class Pedido {
  // Listagens

  static async findAll({ limite = 50, offset = 0 } = {}) {
    const [rows] = await db.query(
      `SELECT p.*, u.nome AS cliente_nome, u.email AS cliente_email
         FROM pedidos p
         JOIN usuarios u ON u.id = p.usuario_id
        ORDER BY p.criado_em DESC
        LIMIT ? OFFSET ?`,
      [limite, offset]
    );
    return rows;
  }

  static async findByUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT p.*, COUNT(i.id) AS qtd_itens
         FROM pedidos p
         LEFT JOIN itens_pedido i ON i.pedido_id = p.id
        WHERE p.usuario_id = ?
        GROUP BY p.id
        ORDER BY p.criado_em DESC`,
      [usuario_id]
    );
    return rows;
  }

  // Busca unitária

  static async findById(id) {
    const [rows] = await db.query(
      `SELECT p.*, u.nome AS cliente_nome, u.email AS cliente_email,
              u.telefone AS cliente_telefone, u.foto_perfil AS cliente_foto,
              u.cpf AS cliente_cpf
         FROM pedidos p
         JOIN usuarios u ON u.id = p.usuario_id
        WHERE p.id = ?`,
      [id]
    );
    return rows[0] ?? null;
  }

  static async findByMercadoPagoPaymentId(paymentId) {
    const [rows] = await db.query(`SELECT id FROM pedidos WHERE mercadopago_payment_id = ? LIMIT 1`, [paymentId]);
    return rows[0]?.id ?? null;
  }

  static async findByMercadoPagoExternalReference(externalReference) {
    const [rows] = await db.query(`SELECT id FROM pedidos WHERE mercadopago_external_reference = ? LIMIT 1`, [externalReference]);
    return rows[0]?.id ?? null;
  }

  static async itensDoPedido(pedido_id) {
    const [rows] = await db.query(
      `SELECT i.*,
              COALESCE(i.produto_nome,   pr.nome)            AS produto_nome,
              COALESCE(i.produto_imagem, pr.imagem)           AS produto_imagem,
              COALESCE(i.categoria_nome, c.nome)               AS categoria_nome,
              pr.slug AS produto_slug
         FROM itens_pedido i
         LEFT JOIN produtos pr   ON pr.id = i.produto_id
         LEFT JOIN categorias c  ON c.id = pr.categoria_id
        WHERE i.pedido_id = ?
        ORDER BY i.id`,
      [pedido_id]
    );
    return rows.map(row => ({ ...row, produto_imagem: resolverImagemUrl(row.produto_imagem, null) }));
  }

  static async timelineDoPedido(pedido_id) {
    const [rows] = await db.query(
      `SELECT * FROM pedido_timeline WHERE pedido_id = ? ORDER BY criado_em ASC, id ASC`,
      [pedido_id]
    );
    return rows;
  }

  // CRM de Clientes

  static async itensPorUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT i.*,
              COALESCE(i.produto_nome,   pr.nome)   AS produto_nome,
              COALESCE(i.categoria_nome, c.nome)     AS categoria_nome,
              pr.slug AS produto_slug
         FROM itens_pedido i
         JOIN pedidos p           ON p.id = i.pedido_id
         LEFT JOIN produtos pr    ON pr.id = i.produto_id
         LEFT JOIN categorias c   ON c.id = pr.categoria_id
        WHERE p.usuario_id = ?
        ORDER BY i.pedido_id, i.id`,
      [usuario_id]
    );
    return rows;
  }

  static async timelinePorUsuario(usuario_id) {
    const [rows] = await db.query(
      `SELECT t.*
         FROM pedido_timeline t
         JOIN pedidos p ON p.id = t.pedido_id
        WHERE p.usuario_id = ?
        ORDER BY t.criado_em ASC, t.id ASC`,
      [usuario_id]
    );
    return rows;
  }

  static async estatisticasCliente(usuario_id) {
    const [[row]] = await db.query(
      `SELECT
          COUNT(*) AS total_pedidos,
          COALESCE(SUM(CASE WHEN status_pagamento = 'aprovado' THEN total ELSE 0 END), 0) AS total_gasto,
          COALESCE(AVG(CASE WHEN status_pagamento = 'aprovado' THEN total END), 0) AS ticket_medio,
          MIN(criado_em) AS primeira_compra,
          MAX(criado_em) AS ultima_compra,
          SUM(CASE WHEN cupom IS NOT NULL THEN 1 ELSE 0 END) AS total_cupons
         FROM pedidos
        WHERE usuario_id = ?`,
      [usuario_id]
    );
    return {
      totalPedidos: Number(row.total_pedidos) || 0,
      totalGasto: Number(row.total_gasto) || 0,
      ticketMedio: Number(row.ticket_medio) || 0,
      primeiraCompra: row.primeira_compra,
      ultimaCompra: row.ultima_compra,
      totalCupons: Number(row.total_cupons) || 0,
    };
  }

  static async produtoECategoriaMaisCompradosPorUsuario(usuario_id) {
    const [produtoRows] = await db.query(
      `SELECT i.produto_nome AS nome, SUM(i.quantidade) AS total
         FROM itens_pedido i
         JOIN pedidos p ON p.id = i.pedido_id
        WHERE p.usuario_id = ? AND p.status_pagamento = 'aprovado' AND i.produto_nome IS NOT NULL
        GROUP BY i.produto_nome
        ORDER BY total DESC
        LIMIT 1`,
      [usuario_id]
    );
    const [categoriaRows] = await db.query(
      `SELECT i.categoria_nome AS nome, SUM(i.quantidade) AS total
         FROM itens_pedido i
         JOIN pedidos p ON p.id = i.pedido_id
        WHERE p.usuario_id = ? AND p.status_pagamento = 'aprovado' AND i.categoria_nome IS NOT NULL
        GROUP BY i.categoria_nome
        ORDER BY total DESC
        LIMIT 1`,
      [usuario_id]
    );
    return {
      produtoMaisComprado: produtoRows[0]?.nome || null,
      categoriaMaisComprada: categoriaRows[0]?.nome || null,
    };
  }

  static async detalhesCompletos(id) {
    const pedido = await Pedido.findById(id);
    if (!pedido) return null;
    const [itens, timeline] = await Promise.all([
      Pedido.itensDoPedido(id),
      Pedido.timelineDoPedido(id),
    ]);
    return { ...pedido, itens, timeline };
  }

  static async findAllAdmin({ status = '', busca = '', data = '', limite = 50, offset = 0 } = {}) {
    const condicoes = [];
    const params = [];

    if (status) { condicoes.push('p.status = ?'); params.push(status); }

    const buscaLimpa = String(busca || '').trim();
    if (buscaLimpa) {
      const ehNumero = /^\d+$/.test(buscaLimpa);
      const partes = [];
      if (ehNumero) { partes.push('p.id = ?'); params.push(Number(buscaLimpa)); }
      partes.push('u.nome LIKE ?');  params.push(`%${buscaLimpa}%`);
      partes.push('u.email LIKE ?'); params.push(`%${buscaLimpa}%`);
      condicoes.push(`(${partes.join(' OR ')})`);
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) {
      condicoes.push('DATE(p.criado_em) = ?');
      params.push(data);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    params.push(limite, offset);

    const [rows] = await db.query(
      `SELECT p.id, p.status, p.status_pagamento, p.total, p.criado_em,
              u.nome AS cliente_nome, u.email AS cliente_email,
              (SELECT COUNT(*) FROM itens_pedido i WHERE i.pedido_id = p.id) AS total_itens
         FROM pedidos p
         JOIN usuarios u ON u.id = p.usuario_id
         ${where}
        ORDER BY p.criado_em DESC
        LIMIT ? OFFSET ?`,
      params
    );
    return rows;
  }

  static async contarFiltrado({ status = '', busca = '', data = '' } = {}) {
    const condicoes = [];
    const params = [];

    if (status) { condicoes.push('p.status = ?'); params.push(status); }

    const buscaLimpa = String(busca || '').trim();
    if (buscaLimpa) {
      const ehNumero = /^\d+$/.test(buscaLimpa);
      const partes = [];
      if (ehNumero) { partes.push('p.id = ?'); params.push(Number(buscaLimpa)); }
      partes.push('u.nome LIKE ?');  params.push(`%${buscaLimpa}%`);
      partes.push('u.email LIKE ?'); params.push(`%${buscaLimpa}%`);
      condicoes.push(`(${partes.join(' OR ')})`);
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(data || ''))) {
      condicoes.push('DATE(p.criado_em) = ?');
      params.push(data);
    }
    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total FROM pedidos p JOIN usuarios u ON u.id = p.usuario_id ${where}`,
      params
    );
    return Number(row.total) || 0;
  }

  static async contarPorStatus() {
    const [rows] = await db.query('SELECT status, COUNT(*) AS total FROM pedidos GROUP BY status');
    const mapa = {};
    rows.forEach(r => { mapa[r.status] = Number(r.total); });
    return mapa;
  }

  // Relatórios por período

  static async faturamentoPorPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT DATE(criado_em) AS dia, COUNT(*) AS qtd_pedidos, SUM(total) AS total
         FROM pedidos
        WHERE status_pagamento = 'aprovado'
          AND DATE(criado_em) BETWEEN ? AND ?
        GROUP BY DATE(criado_em)
        ORDER BY dia ASC`,
      [dataInicio, dataFim]
    );
    const serie = rows.map(r => ({ dia: r.dia, qtd_pedidos: Number(r.qtd_pedidos) || 0, total: Number(r.total) || 0 }));
    const total = serie.reduce((s, r) => s + r.total, 0);
    return { serie, total };
  }

  static async contarPorStatusPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT status, COUNT(*) AS total FROM pedidos
        WHERE DATE(criado_em) BETWEEN ? AND ?
        GROUP BY status`,
      [dataInicio, dataFim]
    );
    const mapa = {};
    rows.forEach(r => { mapa[r.status] = Number(r.total); });
    return mapa;
  }

  static async produtosMaisVendidosPeriodo(dataInicio, dataFim, qtd = 10) {
    const [rows] = await db.query(
      `SELECT i.produto_id AS produto_id, i.produto_nome AS nome,
              COALESCE(i.categoria_nome, c.nome) AS categoria_nome,
              SUM(i.quantidade) AS total_vendido,
              SUM(i.quantidade * i.preco_unit) AS receita
         FROM itens_pedido i
         JOIN pedidos p ON p.id = i.pedido_id
         LEFT JOIN produtos pr ON pr.id = i.produto_id
         LEFT JOIN categorias c ON c.id = pr.categoria_id
        WHERE p.status_pagamento = 'aprovado'
          AND DATE(p.criado_em) BETWEEN ? AND ?
        GROUP BY i.produto_id, i.produto_nome, COALESCE(i.categoria_nome, c.nome)
        ORDER BY total_vendido DESC
        LIMIT ?`,
      [dataInicio, dataFim, qtd]
    );
    return rows.map(r => ({ ...r, total_vendido: Number(r.total_vendido) || 0, receita: Number(r.receita) || 0 }));
  }

  // Relatórios

  static async itensVendidosPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT p.id AS pedido_id, p.criado_em, u.nome AS cliente_nome,
              i.produto_nome, COALESCE(i.categoria_nome, c.nome) AS categoria_nome,
              i.quantidade, i.preco_unit, (i.quantidade * i.preco_unit) AS subtotal
         FROM itens_pedido i
         JOIN pedidos p ON p.id = i.pedido_id
         JOIN usuarios u ON u.id = p.usuario_id
         LEFT JOIN produtos pr ON pr.id = i.produto_id
         LEFT JOIN categorias c ON c.id = pr.categoria_id
        WHERE p.status_pagamento = 'aprovado'
          AND DATE(p.criado_em) BETWEEN ? AND ?
        ORDER BY p.criado_em DESC, i.id ASC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({
      ...r,
      quantidade: Number(r.quantidade) || 0,
      preco_unit: Number(r.preco_unit) || 0,
      subtotal: Number(r.subtotal) || 0,
    }));
  }

  static async relatorioPedidosPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT p.id, p.criado_em, p.status, p.status_pagamento, p.forma_pagto, p.total,
              u.nome AS cliente_nome, u.email AS cliente_email,
              (SELECT COUNT(*) FROM itens_pedido i WHERE i.pedido_id = p.id) AS total_itens
         FROM pedidos p
         JOIN usuarios u ON u.id = p.usuario_id
        WHERE DATE(p.criado_em) BETWEEN ? AND ?
        ORDER BY p.criado_em DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({ ...r, total: Number(r.total) || 0, total_itens: Number(r.total_itens) || 0 }));
  }

  static async relatorioCanceladosPeriodo(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT p.id, p.criado_em, t.criado_em AS cancelado_em, p.motivo_cancelamento, p.total,
              u.nome AS cliente_nome, u.email AS cliente_email
         FROM pedido_timeline t
         JOIN pedidos p ON p.id = t.pedido_id
         JOIN usuarios u ON u.id = p.usuario_id
        WHERE t.etapa = 'cancelado'
          AND DATE(t.criado_em) BETWEEN ? AND ?
        ORDER BY t.criado_em DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({ ...r, total: Number(r.total) || 0 }));
  }

  static async faturamentoPorFormaPagamento(dataInicio, dataFim) {
    const [rows] = await db.query(
      `SELECT COALESCE(forma_pagto, 'não informado') AS forma_pagto,
              COUNT(*) AS total_pedidos, SUM(total) AS total
         FROM pedidos
        WHERE status_pagamento = 'aprovado'
          AND DATE(criado_em) BETWEEN ? AND ?
        GROUP BY COALESCE(forma_pagto, 'não informado')
        ORDER BY total DESC`,
      [dataInicio, dataFim]
    );
    return rows.map(r => ({ ...r, total_pedidos: Number(r.total_pedidos) || 0, total: Number(r.total) || 0 }));
  }

  static async contarCriadosPeriodo(dataInicio, dataFim) {
    const [[row]] = await db.query(
      `SELECT COUNT(*) AS total FROM pedidos WHERE DATE(criado_em) BETWEEN ? AND ?`,
      [dataInicio, dataFim]
    );
    return Number(row.total) || 0;
  }

  // Estatísticas

  static async statsHoje() {
    const [[row]] = await db.query(
      `SELECT
          SUM(DATE(criado_em) = CURDATE())  AS pedidos_hoje,
          SUM(status = 'preparando')        AS pedidos_pendentes
         FROM pedidos`
    );
    return {
      pedidosHoje:      Number(row.pedidos_hoje)      || 0,
      pedidosPendentes: Number(row.pedidos_pendentes) || 0,
    };
  }

  static async faturamentoSerieDiaria(dias = 7) {
    const [rows] = await db.query(
      `SELECT DATE(criado_em) AS dia, SUM(total) AS total
         FROM pedidos
        WHERE status_pagamento = 'aprovado'
          AND criado_em >= (CURDATE() - INTERVAL ? DAY)
        GROUP BY DATE(criado_em)
        ORDER BY dia ASC`,
      [dias - 1]
    );
    return rows.map(r => ({ dia: r.dia, total: Number(r.total) || 0 }));
  }

  static async pedidosSerieDiaria(dias = 7) {
    const [rows] = await db.query(
      `SELECT DATE(criado_em) AS dia, COUNT(*) AS total
         FROM pedidos
        WHERE criado_em >= (CURDATE() - INTERVAL ? DAY)
        GROUP BY DATE(criado_em)
        ORDER BY dia ASC`,
      [dias - 1]
    );
    return rows.map(r => ({ dia: r.dia, total: Number(r.total) || 0 }));
  }

  static async faturamentoEntreDiasAtras(diasInicioAtras, diasFimAtras) {
    const [[row]] = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS total
         FROM pedidos
        WHERE status_pagamento = 'aprovado'
          AND criado_em >= (CURDATE() - INTERVAL ? DAY)
          AND criado_em <  (CURDATE() - INTERVAL ? DAY)`,
      [diasInicioAtras, diasFimAtras]
    );
    return Number(row.total) || 0;
  }

  static async atividadeClientesSerie(periodo = '90d') {
    const agora = new Date();
    const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const pad = n => String(n).padStart(2, '0');

    const config = {
      '30d': { unidade: 'dia', qtdBuckets: 30 },
      '90d': { unidade: 'dia', qtdBuckets: 90 },
      '12m': { unidade: 'mes', qtdBuckets: 12 },
    }[periodo] || { unidade: 'dia', qtdBuckets: 90 };

    function inicioBucket(offsetDoFim) {
      if (config.unidade === 'dia') {
        const d = new Date(agora); d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() - offsetDoFim);
        return d;
      }
      return new Date(agora.getFullYear(), agora.getMonth() - offsetDoFim, 1);
    }
    function chaveBucket(d) {
      if (config.unidade === 'dia') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    }
    function rotuloBucket(d) {
      if (config.unidade === 'dia') return pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
      return MESES[d.getMonth()];
    }

    const formatoSql = config.unidade === 'dia' ? '%Y-%m-%d' : '%Y-%m';
    const inicioJanela = inicioBucket(config.qtdBuckets - 1);

    const [rows] = await db.query(
      `SELECT DATE_FORMAT(p.criado_em, ?) AS bucket,
              SUM(CASE WHEN DATE(p.criado_em) = DATE(primeiro.primeira_data) THEN 1 ELSE 0 END) AS novos,
              SUM(CASE WHEN DATE(p.criado_em) != DATE(primeiro.primeira_data) THEN 1 ELSE 0 END) AS recorrentes
         FROM pedidos p
         JOIN (
           SELECT usuario_id, MIN(criado_em) AS primeira_data
             FROM pedidos
            WHERE status_pagamento = 'aprovado'
            GROUP BY usuario_id
         ) primeiro ON primeiro.usuario_id = p.usuario_id
        WHERE p.status_pagamento = 'aprovado'
          AND p.criado_em >= ?
        GROUP BY bucket`,
      [formatoSql, inicioJanela]
    );
    const mapa = new Map(rows.map(r => [r.bucket, { novos: Number(r.novos) || 0, recorrentes: Number(r.recorrentes) || 0 }]));

    const serie = [];
    for (let i = config.qtdBuckets - 1; i >= 0; i--) {
      const d = inicioBucket(i);
      const v = mapa.get(chaveBucket(d)) || { novos: 0, recorrentes: 0 };
      serie.push({ label: rotuloBucket(d), novos: v.novos, recorrentes: v.recorrentes, total: v.novos + v.recorrentes });
    }

    return {
      serie,
      totalNovos: serie.reduce((s, d) => s + d.novos, 0),
      totalRecorrentes: serie.reduce((s, d) => s + d.recorrentes, 0),
      maiorValor: Math.max(1, ...serie.map(d => d.total)),
    };
  }

  static async faturamentoMesAtual() {
    const [[row]] = await db.query(
      `SELECT COALESCE(SUM(total), 0) AS total
         FROM pedidos
        WHERE status_pagamento = 'aprovado'
          AND YEAR(criado_em) = YEAR(CURDATE())
          AND MONTH(criado_em) = MONTH(CURDATE())`
    );
    return Number(row.total) || 0;
  }

  static async produtosMaisVendidos(qtd = 5) {
    const [rows] = await db.query(
      `SELECT i.produto_nome AS nome, i.produto_imagem AS imagem,
              SUM(i.quantidade) AS total_vendido
         FROM itens_pedido i
         JOIN pedidos p ON p.id = i.pedido_id
        WHERE p.status_pagamento = 'aprovado'
        GROUP BY i.produto_nome, i.produto_imagem
        ORDER BY total_vendido DESC
        LIMIT ?`,
      [qtd]
    );
    return rows.map(r => ({ ...r, total_vendido: Number(r.total_vendido) || 0 }));
  }

  static async pedidosParados(diasParado = 2, qtd = 5) {
    const [rows] = await db.query(
      `SELECT id, status, atualizado_em,
              DATEDIFF(NOW(), atualizado_em) AS dias_parado
         FROM pedidos
        WHERE status NOT IN ('entregue', 'cancelado')
          AND atualizado_em <= (NOW() - INTERVAL ? DAY)
        ORDER BY atualizado_em ASC
        LIMIT ?`,
      [diasParado, qtd]
    );
    return rows.map(r => ({ ...r, dias_parado: Number(r.dias_parado) || 0 }));
  }

  // Criação

  static async create({ usuario_id, endereco_id, endereco, financeiro = {}, itens = [], observacoes = null }) {
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const {
        subtotal = 0, frete = 0, desconto = 0, cupom = null, cupom_id = null,
        promocao_carrinho_id = null, promocao_carrinho_nome = null,
        desconto_promocao_carrinho = 0,
        total, forma_pagto = null, parcelas = 1,
        status_pagamento = 'pendente',
        pagamento_processa_em = null,
        pagamento_confirma_em = null,
        pagamento_expira_em = null,
        pagamento_confirmado_em = null,
        cartao_final = null,
        cartao_bandeira = null,
        mercadopago_payment_id = null,
        mercadopago_external_reference = null,
      } = financeiro;

      const transportadora   = 'Floria Log Entregas';
      const codigo_rastreio  = gerarCodigoRastreio();
      const previsao_entrega = somarDias(3);

      const [result] = await conn.query(
        `INSERT INTO pedidos
           (usuario_id, endereco_id, status, subtotal, frete, desconto, cupom,
            promocao_carrinho_id, promocao_carrinho_nome, desconto_promocao_carrinho, total,
            forma_pagto, parcelas, status_pagamento, observacoes,
            transportadora, codigo_rastreio, previsao_entrega,
            pagamento_processa_em, pagamento_confirma_em, pagamento_expira_em, pagamento_confirmado_em,
            cartao_final, cartao_bandeira, mercadopago_payment_id, mercadopago_external_reference,
            end_rotulo, end_destinatario, end_telefone, end_cep, end_logradouro,
            end_numero, end_complemento, end_bairro, end_cidade, end_uf)
         VALUES (?, ?, 'preparando', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          usuario_id, endereco_id ?? null, subtotal, frete, desconto, cupom,
          promocao_carrinho_id, promocao_carrinho_nome, desconto_promocao_carrinho, total,
          forma_pagto, parcelas, status_pagamento, observacoes ? String(observacoes).slice(0, 500) : null,
          transportadora, codigo_rastreio, previsao_entrega,
          pagamento_processa_em, pagamento_confirma_em, pagamento_expira_em, pagamento_confirmado_em,
          cartao_final, cartao_bandeira, mercadopago_payment_id, mercadopago_external_reference,
          endereco?.rotulo ?? null, endereco?.destinatario ?? null, endereco?.telefone ?? null,
          endereco?.cep ?? null, endereco?.logradouro ?? null, endereco?.numero ?? null,
          endereco?.complemento ?? null, endereco?.bairro ?? null, endereco?.cidade ?? null,
          endereco?.uf ?? null,
        ]
      );

      const pedido_id = result.insertId;

      const idsProdutosEnvolvidos = [...new Set(itens.map(i => i.produto_id).filter(Boolean))];
      if (idsProdutosEnvolvidos.length) {
        await conn.query(`SELECT id FROM produtos WHERE id IN (?) FOR UPDATE`, [idsProdutosEnvolvidos]);
      }

      if (itens.length) {
        const valores = itens.map(i => [
          pedido_id, i.produto_id ?? null, i.produto_nome ?? null,
          i.produto_imagem ?? null, i.categoria_nome ?? null,
          i.quantidade, i.cor ?? null, i.preco_unit,
          i.promocao_id ?? null, i.promocao_nome ?? null, i.preco_original ?? null,
        ]);
        await conn.query(
          `INSERT INTO itens_pedido
             (pedido_id, produto_id, produto_nome, produto_imagem, categoria_nome, quantidade, cor, preco_unit,
              promocao_id, promocao_nome, preco_original)
           VALUES ?`,
          [valores]
        );
      }

      for (const item of itens) {
        if (!item.produto_id) continue;
        const [resultado] = await conn.query(
          `UPDATE produtos SET estoque = estoque - ? WHERE id = ? AND estoque >= ?`,
          [item.quantidade, item.produto_id, item.quantidade]
        );
        if (resultado.affectedRows === 0) {
          const erro = new Error(`Estoque insuficiente para "${item.produto_nome || 'produto'}".`);
          erro.code = 'ESTOQUE_INSUFICIENTE';
          throw erro;
        }
      }

      await conn.query(
        `INSERT INTO pedido_timeline (pedido_id, etapa) VALUES (?, 'confirmado'), (?, 'preparando')`,
        [pedido_id, pedido_id]
      );

      if (cupom_id) {
        const [resultadoCupom] = await conn.query(
          `UPDATE cupons SET usos_atual = usos_atual + 1
            WHERE id = ? AND (limite_usos IS NULL OR usos_atual < limite_usos)`,
          [cupom_id]
        );
        if (resultadoCupom.affectedRows === 0) {
          const erro = new Error('O cupom aplicado não é mais válido. Remova-o e tente novamente.');
          erro.code = 'CUPOM_INVALIDO';
          throw erro;
        }
      }

      await conn.commit();
      return pedido_id;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Atualização de status

  static async _restaurarEstoqueDoPedido(conn, pedido_id) {
    const [itens] = await conn.query(
      `SELECT produto_id, quantidade FROM itens_pedido WHERE pedido_id = ? AND produto_id IS NOT NULL`,
      [pedido_id]
    );
    if (!itens.length) return;

    await conn.query(
      `SELECT id FROM produtos WHERE id IN (?) FOR UPDATE`,
      [itens.map(i => i.produto_id)]
    );
    for (const item of itens) {
      await conn.query(
        `UPDATE produtos SET estoque = estoque + ? WHERE id = ?`,
        [item.quantidade, item.produto_id]
      );
    }
  }

  static async atualizarStatus(id, status, observacao = null, usuarioAdminNome = null) {
    if (!STATUS_VALIDOS.includes(status)) {
      throw new Error(`Status inválido: "${status}". Use: ${STATUS_VALIDOS.join(', ')}`);
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[pedidoAtual]] = await conn.query(
        `SELECT status FROM pedidos WHERE id = ? FOR UPDATE`, [id]
      );
      const jaEstavaCancelado = pedidoAtual?.status === 'cancelado';

      if (jaEstavaCancelado && status !== 'cancelado') {
        const erro = new Error('Este pedido foi cancelado e não pode ser reaberto. Peça ao cliente para fazer um novo pedido.');
        erro.code = 'PEDIDO_CANCELADO';
        throw erro;
      }

      const camposExtras = [];
      const valoresExtras = [];
      if (status === 'entregue') {
        camposExtras.push('previsao_entrega = COALESCE(previsao_entrega, CURDATE())');
      }
      if (status === 'cancelado') {
        camposExtras.push('status_pagamento = ?');
        valoresExtras.push('estornado');
      }

      const [result] = await conn.query(
        `UPDATE pedidos SET status = ?${camposExtras.length ? ', ' + camposExtras.join(', ') : ''} WHERE id = ?`,
        [status, ...valoresExtras, id]
      );

      if (result.affectedRows) {
        await conn.query(
          `INSERT INTO pedido_timeline (pedido_id, etapa, observacao, usuario_admin_nome) VALUES (?, ?, ?, ?)`,
          [id, status, observacao, usuarioAdminNome]
        );
        if (status === 'cancelado' && !jaEstavaCancelado) {
          await Pedido._restaurarEstoqueDoPedido(conn, id);
        }
      }

      await conn.commit();
      return result.affectedRows;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  // Status de pagamento

  static async _travarPedidoPagamento(conn, id) {
    const [[pedidoAtual]] = await conn.query(
      `SELECT status_pagamento FROM pedidos WHERE id = ? FOR UPDATE`, [id]
    );
    return pedidoAtual || null;
  }

  static _STATUS_PAGAMENTO_DEVOLVE_ESTOQUE = ['expirado', 'recusado', 'estornado'];

  static async _gravarStatusPagamento(conn, id, status_pagamento, statusAnterior, { observacao = null, origem = null, mercadopago_notification_id = null } = {}) {
    const campoConfirmado = status_pagamento === 'aprovado' ? ', pagamento_confirmado_em = NOW()' : '';
    const [result] = await conn.query(
      `UPDATE pedidos SET status_pagamento = ?${campoConfirmado} WHERE id = ?`,
      [status_pagamento, id]
    );

    if (result.affectedRows) {
      await conn.query(
        `INSERT INTO pedido_pagamento_eventos (pedido_id, status_pagamento, origem, observacao, mercadopago_notification_id) VALUES (?, ?, ?, ?, ?)`,
        [id, status_pagamento, origem, observacao, mercadopago_notification_id]
      );
      const devolveEstoque = Pedido._STATUS_PAGAMENTO_DEVOLVE_ESTOQUE.includes(status_pagamento)
        && !Pedido._STATUS_PAGAMENTO_DEVOLVE_ESTOQUE.includes(statusAnterior);
      if (devolveEstoque) {
        await Pedido._restaurarEstoqueDoPedido(conn, id);
      }
    }

    return result.affectedRows;
  }

  static async atualizarStatusPagamento(id, status_pagamento, { observacao = null, origem = null } = {}) {
    if (!STATUS_PAGAMENTO_VALIDOS.includes(status_pagamento)) {
      throw new Error(`Status de pagamento inválido: "${status_pagamento}". Use: ${STATUS_PAGAMENTO_VALIDOS.join(', ')}`);
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const pedidoAtual = await Pedido._travarPedidoPagamento(conn, id);
      const affectedRows = await Pedido._gravarStatusPagamento(conn, id, status_pagamento, pedidoAtual?.status_pagamento, { observacao, origem });
      await conn.commit();
      return affectedRows;
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static _ESTADOS_TERMINAIS_PAGAMENTO = ['aprovado', 'recusado', 'expirado', 'estornado'];

  static _transicaoStatusPagamentoValida(statusAnterior, novoStatus) {
    if (novoStatus === statusAnterior) return false;
    if (!Pedido._ESTADOS_TERMINAIS_PAGAMENTO.includes(statusAnterior)) return true; // pendente/processando → qualquer coisa
    return statusAnterior === 'aprovado' && novoStatus === 'estornado';
  }

  static async aplicarStatusPagamentoWebhook(id, novoStatus, { observacao = null, mercadopago_notification_id = null } = {}) {
    if (!STATUS_PAGAMENTO_VALIDOS.includes(novoStatus)) {
      throw new Error(`Status de pagamento inválido: "${novoStatus}". Use: ${STATUS_PAGAMENTO_VALIDOS.join(', ')}`);
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const pedidoAtual = await Pedido._travarPedidoPagamento(conn, id);
      if (!pedidoAtual) {
        await conn.rollback();
        return { aplicado: false, motivo: 'PEDIDO_NAO_ENCONTRADO' };
      }

      if (mercadopago_notification_id) {
        const [[jaProcessada]] = await conn.query(
          `SELECT COUNT(*) AS total FROM mercadopago_webhook_log WHERE notification_id = ? AND processado = 1`,
          [mercadopago_notification_id]
        );
        if (jaProcessada.total > 0) {
          await conn.rollback();
          return { aplicado: false, motivo: 'NOTIFICACAO_JA_PROCESSADA', statusAnterior: pedidoAtual.status_pagamento };
        }
      }

      if (!Pedido._transicaoStatusPagamentoValida(pedidoAtual.status_pagamento, novoStatus)) {
        await conn.rollback();
        return { aplicado: false, motivo: 'TRANSICAO_INVALIDA', statusAnterior: pedidoAtual.status_pagamento };
      }

      await Pedido._gravarStatusPagamento(conn, id, novoStatus, pedidoAtual.status_pagamento, {
        observacao, origem: 'mercadopago_webhook', mercadopago_notification_id,
      });
      await conn.commit();
      return { aplicado: true, statusAnterior: pedidoAtual.status_pagamento };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static statusPagamentoValidos() {
    return STATUS_PAGAMENTO_VALIDOS;
  }

  static async cancelarPeloCliente(id, usuario_id, motivo = null) {
    const pedido = await Pedido.findById(id);
    if (!pedido || pedido.usuario_id !== usuario_id) {
      return { ok: false, code: 'NAO_ENCONTRADO', message: 'Pedido não encontrado.' };
    }
    if (!STATUS_CANCELAVEL.includes(pedido.status)) {
      return {
        ok: false, code: 'NAO_CANCELAVEL',
        message: 'Este pedido já está a caminho e não pode mais ser cancelado por aqui. Entre em contato com o suporte.',
      };
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      const [[pedidoTravado]] = await conn.query(
        `SELECT status FROM pedidos WHERE id = ? FOR UPDATE`, [id]
      );
      if (!pedidoTravado || !STATUS_CANCELAVEL.includes(pedidoTravado.status)) {
        await conn.rollback();
        return {
          ok: false, code: 'NAO_CANCELAVEL',
          message: 'Este pedido já está a caminho e não pode mais ser cancelado por aqui. Entre em contato com o suporte.',
        };
      }

      await conn.query(
        `UPDATE pedidos SET status = 'cancelado', status_pagamento = 'estornado', motivo_cancelamento = ? WHERE id = ?`,
        [motivo ? String(motivo).slice(0, 255) : 'Cancelado pelo cliente.', id]
      );
      await conn.query(
        `INSERT INTO pedido_timeline (pedido_id, etapa, observacao) VALUES (?, 'cancelado', ?)`,
        [id, motivo ? String(motivo).slice(0, 255) : 'Cancelado pelo cliente.']
      );
      await Pedido._restaurarEstoqueDoPedido(conn, id);
      await conn.commit();
      return { ok: true };
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }

  static rotulosEtapa() {
    return ROTULOS_ETAPA;
  }

  static rotulosStatusPagamento() {
    return ROTULOS_STATUS_PAGAMENTO;
  }

  static statusValidos() {
    return STATUS_VALIDOS;
  }

  static podeCancelar(status) {
    return STATUS_CANCELAVEL.includes(status);
  }

  static usuarioTemAcesso(pedido, usuarioSessao) {
    if (!pedido || !usuarioSessao) return false;
    return usuarioSessao.papel === 'admin' || pedido.usuario_id === usuarioSessao.id;
  }
}

module.exports = Pedido;
