'use strict';

const Pedido = require('../../models/Pedido');
const Usuario = require('../../models/Usuario');
const Produto = require('../../models/Produto');
const Cupom = require('../../models/Cupom');
const MovimentacaoEstoque = require('../../models/MovimentacaoEstoque');

// Formatação compartilhada

function moeda(v) {
  const n = Number(v) || 0;
  const partes = n.toFixed(2).split('.');
  partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return 'R$ ' + partes.join(',');
}

function dataFmt(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function dataHoraFmt(d) {
  if (!d) return '—';
  const dt = new Date(d);
  return dataFmt(dt) + ' ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function celula(texto, valor, extra) {
  return { texto: texto == null || texto === '' ? '—' : String(texto), valor, ...extra };
}

const ROTULOS_STATUS_PEDIDO = {
  preparando: 'Preparando', enviado: 'Enviado', em_transporte: 'Em transporte',
  saiu_entrega: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado',
};
const BADGE_STATUS_PEDIDO = {
  preparando: 'cinza', enviado: 'dourado', em_transporte: 'dourado',
  saiu_entrega: 'dourado', entregue: 'verde', cancelado: 'vermelho',
};
const ROTULOS_STATUS_PAGAMENTO = Pedido.rotulosStatusPagamento();
const BADGE_STATUS_PAGAMENTO = { pendente: 'dourado', aprovado: 'verde', recusado: 'vermelho', estornado: 'vermelho' };

const ROTULO_TIPO_CUPOM = { percentual: 'Percentual', fixo: 'Valor fixo', frete_gratis: 'Frete grátis' };
function valorCupomTexto(c) {
  if (c.tipo === 'frete_gratis') return '—';
  if (c.tipo === 'percentual') return Number(c.valor).toLocaleString('pt-BR') + '%';
  return moeda(c.valor);
}
function statusCupom(c) {
  const hoje = new Date().toISOString().slice(0, 10);
  const fimStr = c.data_fim ? new Date(c.data_fim).toISOString().slice(0, 10) : null;
  if (!c.ativo) return { texto: 'Inativo', badge: 'cinza' };
  if (fimStr && fimStr < hoje) return { texto: 'Expirado', badge: 'vermelho' };
  if (c.limite_usos && c.usos_atual >= c.limite_usos) return { texto: 'Esgotado', badge: 'vermelho' };
  return { texto: 'Ativo', badge: 'verde' };
}

// Período

const PRESETS = {
  hoje: 0,
  '7d': 6,
  '30d': 29,
  '6m': 182,
  '1a': 364,
};

function fmtISO(d) { return d.toISOString().slice(0, 10); }
function ehDataValida(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function resolverPeriodo({ preset = '', de = '', ate = '' } = {}) {
  const hoje = new Date();

  if (preset && Object.prototype.hasOwnProperty.call(PRESETS, preset)) {
    const inicio = new Date(hoje);
    inicio.setDate(hoje.getDate() - PRESETS[preset]);
    return { de: fmtISO(inicio), ate: fmtISO(hoje), preset };
  }

  if (ehDataValida(de) && ehDataValida(ate) && de <= ate) {
    return { de, ate, preset: 'personalizado' };
  }

  const trintaDiasAtras = new Date(hoje);
  trintaDiasAtras.setDate(hoje.getDate() - 29);
  return { de: fmtISO(trintaDiasAtras), ate: fmtISO(hoje), preset: '30d' };
}

// Catálogo dos 10 relatórios

const TIPOS = [
  { chave: 'vendas', titulo: 'Vendas', icone: 'fa-cart-shopping', subtitulo: 'Itens vendidos em pedidos com pagamento aprovado no período.' },
  { chave: 'pedidos', titulo: 'Pedidos', icone: 'fa-receipt', subtitulo: 'Todos os pedidos criados no período, em qualquer status.' },
  { chave: 'clientes', titulo: 'Clientes', icone: 'fa-users', subtitulo: 'Clientes cadastrados no período.' },
  { chave: 'produtos', titulo: 'Produtos', icone: 'fa-seedling', subtitulo: 'Produtos do catálogo cadastrados no período.' },
  { chave: 'estoque', titulo: 'Estoque', icone: 'fa-boxes-stacked', subtitulo: 'Movimentações de estoque (entradas, saídas e ajustes) registradas no período.' },
  { chave: 'cupons', titulo: 'Cupons', icone: 'fa-tag', subtitulo: 'Cupons com código e seu uso dentro do período (o cupom pode ter sido criado antes).' },
  { chave: 'promocoes', titulo: 'Promoções', icone: 'fa-bullhorn', subtitulo: 'Promoções automáticas (sem código) e seu uso dentro do período.' },
  { chave: 'faturamento', titulo: 'Faturamento', icone: 'fa-sack-dollar', subtitulo: 'Faturamento diário de pedidos com pagamento aprovado no período.' },
  { chave: 'mais-vendidos', titulo: 'Produtos mais vendidos', icone: 'fa-ranking-star', subtitulo: 'Ranking por unidades vendidas em pedidos aprovados no período.' },
  { chave: 'cancelados', titulo: 'Pedidos cancelados', icone: 'fa-ban', subtitulo: 'Pedidos cancelados no período, pela data do cancelamento.' },
];

function periodoLabel(de, ate) {
  return `${dataFmt(de)} – ${dataFmt(ate)}`;
}

// Montagem por tipo

async function montarVendas(de, ate) {
  const itens = await Pedido.itensVendidosPeriodo(de, ate);
  const colunas = [
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'pedido', rotulo: 'Pedido', tipo: 'numero' },
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'texto' },
    { chave: 'qtd', rotulo: 'Qtd', tipo: 'numero', alinhar: 'num' },
    { chave: 'unit', rotulo: 'Unit.', tipo: 'moeda', alinhar: 'num' },
    { chave: 'subtotal', rotulo: 'Subtotal', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = itens.map(i => ({
    data: celula(dataFmt(i.criado_em), new Date(i.criado_em).getTime()),
    pedido: celula('#' + i.pedido_id, i.pedido_id),
    cliente: celula(i.cliente_nome, i.cliente_nome),
    produto: celula(i.produto_nome, i.produto_nome),
    categoria: celula(i.categoria_nome, i.categoria_nome),
    qtd: celula(i.quantidade, i.quantidade),
    unit: celula(moeda(i.preco_unit), i.preco_unit),
    subtotal: celula(moeda(i.subtotal), i.subtotal),
  }));
  const receitaTotal = itens.reduce((s, i) => s + i.subtotal, 0);
  const totalItens = itens.reduce((s, i) => s + i.quantidade, 0);
  const pedidosUnicos = new Set(itens.map(i => i.pedido_id)).size;
  const resumo = [
    { rotulo: 'Receita total', valor: moeda(receitaTotal) },
    { rotulo: 'Itens vendidos', valor: String(totalItens) },
    { rotulo: 'Pedidos únicos', valor: String(pedidosUnicos) },
    { rotulo: 'Ticket médio', valor: moeda(pedidosUnicos ? receitaTotal / pedidosUnicos : 0) },
  ];
  return { colunas, linhas, resumo };
}

async function montarPedidos(de, ate) {
  const pedidos = await Pedido.relatorioPedidosPeriodo(de, ate);
  const colunas = [
    { chave: 'pedido', rotulo: 'Pedido', tipo: 'numero' },
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'email', rotulo: 'E-mail', tipo: 'texto' },
    { chave: 'itens', rotulo: 'Itens', tipo: 'numero', alinhar: 'num' },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'pagamento', rotulo: 'Pagamento', tipo: 'texto' },
    { chave: 'total', rotulo: 'Total', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = pedidos.map(p => ({
    pedido: celula('#' + p.id, p.id),
    data: celula(dataFmt(p.criado_em), new Date(p.criado_em).getTime()),
    cliente: celula(p.cliente_nome, p.cliente_nome),
    email: celula(p.cliente_email, p.cliente_email),
    itens: celula(p.total_itens, p.total_itens),
    status: celula(ROTULOS_STATUS_PEDIDO[p.status] || p.status, p.status, { badge: BADGE_STATUS_PEDIDO[p.status] }),
    pagamento: celula(ROTULOS_STATUS_PAGAMENTO[p.status_pagamento] || p.status_pagamento, p.status_pagamento, { badge: BADGE_STATUS_PAGAMENTO[p.status_pagamento] }),
    total: celula(moeda(p.total), p.total),
  }));
  const valorTotal = pedidos.reduce((s, p) => s + p.total, 0);
  const cancelados = pedidos.filter(p => p.status === 'cancelado').length;
  const resumo = [
    { rotulo: 'Total de pedidos', valor: String(pedidos.length) },
    { rotulo: 'Valor total', valor: moeda(valorTotal) },
    { rotulo: 'Ticket médio', valor: moeda(pedidos.length ? valorTotal / pedidos.length : 0) },
    { rotulo: 'Cancelados', valor: String(cancelados) },
  ];
  return { colunas, linhas, resumo };
}

async function montarClientes(de, ate) {
  const clientes = await Usuario.relatorioClientesPeriodo(de, ate);
  const colunas = [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto' },
    { chave: 'email', rotulo: 'E-mail', tipo: 'texto' },
    { chave: 'telefone', rotulo: 'Telefone', tipo: 'texto' },
    { chave: 'cadastro', rotulo: 'Cadastro', tipo: 'data' },
    { chave: 'pedidos', rotulo: 'Pedidos', tipo: 'numero', alinhar: 'num' },
    { chave: 'total_gasto', rotulo: 'Total gasto', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = clientes.map(c => ({
    nome: celula(c.nome, c.nome),
    email: celula(c.email, c.email),
    telefone: celula(c.telefone, c.telefone || ''),
    cadastro: celula(dataFmt(c.criado_em), new Date(c.criado_em).getTime()),
    pedidos: celula(c.total_pedidos, c.total_pedidos),
    total_gasto: celula(moeda(c.total_gasto), c.total_gasto),
  }));
  const totalGasto = clientes.reduce((s, c) => s + c.total_gasto, 0);
  const resumo = [
    { rotulo: 'Novos clientes', valor: String(clientes.length) },
    { rotulo: 'Total gasto por eles', valor: moeda(totalGasto) },
    { rotulo: 'Ticket médio por cliente', valor: moeda(clientes.length ? totalGasto / clientes.length : 0) },
  ];
  return { colunas, linhas, resumo };
}

async function montarProdutos(de, ate) {
  const produtos = await Produto.relatorioProdutosPeriodo(de, ate);
  const colunas = [
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'texto' },
    { chave: 'sku', rotulo: 'SKU', tipo: 'texto' },
    { chave: 'preco', rotulo: 'Preço', tipo: 'moeda', alinhar: 'num' },
    { chave: 'preco_promo', rotulo: 'Preço promo.', tipo: 'moeda', alinhar: 'num' },
    { chave: 'estoque', rotulo: 'Estoque', tipo: 'numero', alinhar: 'num' },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'cadastro', rotulo: 'Cadastro', tipo: 'data' },
  ];
  const linhas = produtos.map(p => ({
    produto: celula(p.nome, p.nome),
    categoria: celula(p.categoria_nome, p.categoria_nome),
    sku: celula(p.sku, p.sku || ''),
    preco: celula(moeda(p.preco), p.preco),
    preco_promo: celula(p.preco_promo != null ? moeda(p.preco_promo) : '—', p.preco_promo ?? 0),
    estoque: celula(p.estoque, p.estoque),
    status: celula(p.ativo ? 'Ativo' : 'Inativo', p.ativo ? 1 : 0, { badge: p.ativo ? 'verde' : 'cinza' }),
    cadastro: celula(dataFmt(p.criado_em), new Date(p.criado_em).getTime()),
  }));
  const resumo = [
    { rotulo: 'Total de produtos', valor: String(produtos.length) },
    { rotulo: 'Ativos', valor: String(produtos.filter(p => p.ativo).length) },
    { rotulo: 'Sem estoque', valor: String(produtos.filter(p => p.estoque === 0).length) },
  ];
  return { colunas, linhas, resumo };
}

const ROTULO_TIPO_MOVIMENTACAO = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' };
const BADGE_TIPO_MOVIMENTACAO = { entrada: 'verde', saida: 'vermelho', ajuste: 'dourado' };

async function montarEstoque(de, ate) {
  const [movimentacoes, statsAtuais] = await Promise.all([
    MovimentacaoEstoque.relatorioPeriodo(de, ate),
    Produto.statsBasicos(),
  ]);
  const colunas = [
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
    { chave: 'qtd', rotulo: 'Qtd', tipo: 'numero', alinhar: 'num' },
    { chave: 'anterior', rotulo: 'Estoque anterior', tipo: 'numero', alinhar: 'num' },
    { chave: 'novo', rotulo: 'Estoque novo', tipo: 'numero', alinhar: 'num' },
    { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto' },
    { chave: 'responsavel', rotulo: 'Responsável', tipo: 'texto' },
  ];
  const linhas = movimentacoes.map(m => ({
    data: celula(dataHoraFmt(m.criado_em), new Date(m.criado_em).getTime()),
    produto: celula(m.produto_nome, m.produto_nome),
    tipo: celula(ROTULO_TIPO_MOVIMENTACAO[m.tipo] || m.tipo, m.tipo, { badge: BADGE_TIPO_MOVIMENTACAO[m.tipo] }),
    qtd: celula(m.quantidade, m.quantidade),
    anterior: celula(m.estoque_anterior, m.estoque_anterior),
    novo: celula(m.estoque_novo, m.estoque_novo),
    motivo: celula(m.motivo, m.motivo || ''),
    responsavel: celula(m.usuario_nome, m.usuario_nome || ''),
  }));
  const resumo = [
    { rotulo: 'Entradas', valor: String(movimentacoes.filter(m => m.tipo === 'entrada').length) },
    { rotulo: 'Saídas', valor: String(movimentacoes.filter(m => m.tipo === 'saida').length) },
    { rotulo: 'Ajustes', valor: String(movimentacoes.filter(m => m.tipo === 'ajuste').length) },
    { rotulo: 'Estoque baixo (agora)', valor: String(statsAtuais.estoqueBaixo + statsAtuais.semEstoque) },
  ];
  return { colunas, linhas, resumo };
}

function montarCupomOuPromocao(comCodigo) {
  return async (de, ate) => {
    const cupons = comCodigo
      ? await Cupom.relatorioComCodigo(de, ate)
      : await Cupom.relatorioAutomaticos(de, ate);
    const colunas = [
      { chave: 'identificacao', rotulo: comCodigo ? 'Código' : 'Promoção', tipo: 'texto' },
      { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
      { chave: 'valor', rotulo: 'Valor', tipo: 'texto' },
      { chave: 'vigencia', rotulo: 'Válido de / até', tipo: 'texto' },
      { chave: 'limite', rotulo: 'Limite de usos', tipo: 'numero', alinhar: 'num' },
      { chave: 'usos', rotulo: 'Usos no período', tipo: 'numero', alinhar: 'num' },
      { chave: 'desconto', rotulo: 'Desconto concedido', tipo: 'moeda', alinhar: 'num' },
      { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    ];
    const linhas = cupons.map(c => {
      const st = statusCupom(c);
      return {
        identificacao: celula(comCodigo ? c.codigo : `Promoção #${c.id}`, comCodigo ? c.codigo : c.id),
        tipo: celula(ROTULO_TIPO_CUPOM[c.tipo] || c.tipo, c.tipo),
        valor: celula(valorCupomTexto(c), 0),
        vigencia: celula(`${dataFmt(c.data_inicio)} – ${dataFmt(c.data_fim)}`, c.data_inicio || ''),
        limite: celula(c.limite_usos ?? '—', c.limite_usos ?? 0),
        usos: celula(c.usos_periodo, c.usos_periodo),
        desconto: celula(moeda(c.desconto_periodo), c.desconto_periodo),
        status: celula(st.texto, st.texto, { badge: st.badge }),
      };
    });
    const usosTotais = cupons.reduce((s, c) => s + c.usos_periodo, 0);
    const descontoTotal = cupons.reduce((s, c) => s + c.desconto_periodo, 0);
    const resumo = [
      { rotulo: comCodigo ? 'Cupons ativos' : 'Promoções ativas', valor: String(cupons.filter(c => statusCupom(c).texto === 'Ativo').length) },
      { rotulo: 'Usos no período', valor: String(usosTotais) },
      { rotulo: 'Desconto total concedido', valor: moeda(descontoTotal) },
    ];
    return { colunas, linhas, resumo };
  };
}

async function montarFaturamento(de, ate) {
  const [faturamento, porFormaPagto] = await Promise.all([
    Pedido.faturamentoPorPeriodo(de, ate),
    Pedido.faturamentoPorFormaPagamento(de, ate),
  ]);
  const colunas = [
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'pedidos', rotulo: 'Pedidos aprovados', tipo: 'numero', alinhar: 'num' },
    { chave: 'faturamento', rotulo: 'Faturamento', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = faturamento.serie.map(d => ({
    data: celula(dataFmt(d.dia), new Date(d.dia).getTime()),
    pedidos: celula(d.qtd_pedidos, d.qtd_pedidos),
    faturamento: celula(moeda(d.total), d.total),
  }));
  const totalPedidosAprovados = porFormaPagto.reduce((s, f) => s + f.total_pedidos, 0);
  const resumo = [
    { rotulo: 'Faturamento total', valor: moeda(faturamento.total) },
    { rotulo: 'Pedidos aprovados', valor: String(totalPedidosAprovados) },
    { rotulo: 'Ticket médio', valor: moeda(totalPedidosAprovados ? faturamento.total / totalPedidosAprovados : 0) },
    ...porFormaPagto.map(f => ({ rotulo: f.forma_pagto.charAt(0).toUpperCase() + f.forma_pagto.slice(1), valor: moeda(f.total) })),
  ];
  return { colunas, linhas, resumo, extra: { serie: faturamento.serie } };
}

async function montarMaisVendidos(de, ate) {
  const produtos = await Pedido.produtosMaisVendidosPeriodo(de, ate, 100);
  const receitaTotal = produtos.reduce((s, p) => s + p.receita, 0);
  const colunas = [
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'texto' },
    { chave: 'unidades', rotulo: 'Unidades vendidas', tipo: 'numero', alinhar: 'num' },
    { chave: 'receita', rotulo: 'Receita', tipo: 'moeda', alinhar: 'num' },
    { chave: 'participacao', rotulo: '% da receita', tipo: 'texto', alinhar: 'num' },
  ];
  const linhas = produtos.map(p => {
    const pct = receitaTotal ? (p.receita / receitaTotal) * 100 : 0;
    return {
      produto: celula(p.nome, p.nome),
      categoria: celula(p.categoria_nome, p.categoria_nome || ''),
      unidades: celula(p.total_vendido, p.total_vendido),
      receita: celula(moeda(p.receita), p.receita),
      participacao: celula(pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%', pct),
    };
  });
  const resumo = [
    { rotulo: 'Produto #1', valor: produtos[0] ? produtos[0].nome : '—' },
    { rotulo: 'Unidades totais', valor: String(produtos.reduce((s, p) => s + p.total_vendido, 0)) },
    { rotulo: 'Receita total', valor: moeda(receitaTotal) },
  ];
  return { colunas, linhas, resumo };
}

async function montarCancelados(de, ate) {
  const [cancelados, totalCriados] = await Promise.all([
    Pedido.relatorioCanceladosPeriodo(de, ate),
    Pedido.contarCriadosPeriodo(de, ate),
  ]);
  const colunas = [
    { chave: 'pedido', rotulo: 'Pedido', tipo: 'numero' },
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'data_pedido', rotulo: 'Data do pedido', tipo: 'data' },
    { chave: 'data_cancelamento', rotulo: 'Data do cancelamento', tipo: 'data' },
    { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto' },
    { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = cancelados.map(c => ({
    pedido: celula('#' + c.id, c.id),
    cliente: celula(c.cliente_nome, c.cliente_nome),
    data_pedido: celula(dataFmt(c.criado_em), new Date(c.criado_em).getTime()),
    data_cancelamento: celula(dataFmt(c.cancelado_em), new Date(c.cancelado_em).getTime()),
    motivo: celula(c.motivo_cancelamento, c.motivo_cancelamento || ''),
    valor: celula(moeda(c.total), c.total),
  }));
  const valorTotal = cancelados.reduce((s, c) => s + c.total, 0);
  const taxa = totalCriados ? (cancelados.length / totalCriados) * 100 : 0;
  const resumo = [
    { rotulo: 'Total cancelados', valor: String(cancelados.length) },
    { rotulo: 'Valor total cancelado', valor: moeda(valorTotal) },
    { rotulo: 'Taxa de cancelamento', valor: taxa.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%' },
  ];
  return { colunas, linhas, resumo };
}

const MONTADORES = {
  vendas: montarVendas,
  pedidos: montarPedidos,
  clientes: montarClientes,
  produtos: montarProdutos,
  estoque: montarEstoque,
  cupons: montarCupomOuPromocao(true),
  promocoes: montarCupomOuPromocao(false),
  faturamento: montarFaturamento,
  'mais-vendidos': montarMaisVendidos,
  cancelados: montarCancelados,
};

async function montarRelatorio(tipo, de, ate) {
  const meta = TIPOS.find(t => t.chave === tipo) || TIPOS[0];
  const montador = MONTADORES[meta.chave];
  const { colunas, linhas, resumo, extra } = await montador(de, ate);
  return {
    chave: meta.chave,
    titulo: meta.titulo,
    subtitulo: meta.subtitulo,
    periodoLabel: periodoLabel(de, ate),
    colunas,
    linhas,
    resumo,
    extra: extra || null,
  };
}

module.exports = {
  TIPOS,
  resolverPeriodo,
  montarRelatorio,
  moeda,
  dataFmt,
  dataHoraFmt,
  periodoLabel,
  celula,
};
