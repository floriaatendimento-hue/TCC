'use strict';

const Pedido = require('../../models/Pedido');
const Cupom = require('../../models/Cupom');
const Comprovante = require('../../models/Comprovante');
const Compra = require('../../models/Compra');
const { moeda, dataFmt, dataHoraFmt, periodoLabel, celula } = require('./relatoriosService');

const ROTULOS_STATUS_PAGAMENTO = Pedido.rotulosStatusPagamento();
const BADGE_STATUS_PAGAMENTO = {
  pendente: 'dourado', processando: 'dourado', aprovado: 'verde',
  recusado: 'vermelho', expirado: 'vermelho', estornado: 'vermelho',
};
const ROTULOS_ETAPA = Pedido.rotulosEtapa();
const BADGE_ETAPA = {
  preparando: 'cinza', enviado: 'dourado', em_transporte: 'dourado',
  saiu_entrega: 'dourado', entregue: 'verde', cancelado: 'vermelho',
};

const MAX_COMPROVANTES_LISTADOS = 50;
const MAX_MOVIMENTACOES_RECENTES = 25;
const MAX_DIAS_GRAFICO = 400;

// Datas

function addDias(iso, dias) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function periodoAnterior(de, ate) {
  const duracao = Math.round((new Date(ate + 'T00:00:00') - new Date(de + 'T00:00:00')) / 86400000) + 1;
  const anteAte = addDias(de, -1);
  const anteDe = addDias(anteAte, -(duracao - 1));
  return { de: anteDe, ate: anteAte };
}

function variacaoPercentual(atual, anterior) {
  if (!anterior) return atual > 0 ? 100 : 0;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

function todosOsDias(de, ate) {
  const dias = [];
  let cursor = de;
  let guarda = 0;
  while (cursor <= ate && guarda < 3660) {
    dias.push(cursor);
    cursor = addDias(cursor, 1);
    guarda++;
  }
  return dias;
}

function chaveDia(valor) {
  return new Date(valor).toISOString().slice(0, 10);
}

function labelDia(iso) {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

function capitalizar(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// Livro-razão

function montarLedger(movimentacoes) {
  const colunas = [
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
    { chave: 'descricao', rotulo: 'Descrição', tipo: 'texto' },
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = movimentacoes.map(m => ({
    data: celula(m.data, m.dataOrdenacao),
    tipo: celula(m.tipo === 'entrada' ? 'Entrada' : 'Saída', m.tipo, { badge: m.badge }),
    descricao: celula(m.descricao, m.descricao, { link: m.href }),
    cliente: celula(m.cliente, m.cliente),
    valor: celula(m.totalFormatado, m.total),
  }));
  const totalEntradas = movimentacoes.filter(m => m.tipo === 'entrada').reduce((s, m) => s + m.total, 0);
  const totalSaidas = movimentacoes.filter(m => m.tipo === 'saida').reduce((s, m) => s + m.total, 0);
  const resumo = [
    { rotulo: 'Entradas no período', valor: moeda(totalEntradas) },
    { rotulo: 'Saídas no período', valor: moeda(totalSaidas) },
    { rotulo: 'Resultado financeiro', valor: moeda(totalEntradas - totalSaidas) },
    { rotulo: 'Movimentações', valor: String(movimentacoes.length) },
  ];
  return { colunas, linhas, resumo };
}

// Montagem principal

async function montarFinanceiro(de, ate) {
  const anterior = periodoAnterior(de, ate);

  const [
    faturamento, faturamentoAnterior,
    cancelados, canceladosAnterior,
    porFormaPagamento,
    cuponsComCodigo, promocoesAutomaticas,
    pedidosPeriodo,
    comprovantes,
    fornecedoresResumo,
  ] = await Promise.all([
    Pedido.faturamentoPorPeriodo(de, ate),
    Pedido.faturamentoPorPeriodo(anterior.de, anterior.ate),
    Pedido.relatorioCanceladosPeriodo(de, ate),
    Pedido.relatorioCanceladosPeriodo(anterior.de, anterior.ate),
    Pedido.faturamentoPorFormaPagamento(de, ate),
    Cupom.relatorioComCodigo(de, ate),
    Cupom.relatorioAutomaticos(de, ate),
    Pedido.relatorioPedidosPeriodo(de, ate),
    Comprovante.relatorioPeriodo(de, ate),
    Compra.resumoGeral(),
  ]);

  // Resumo / KPIs
  const entradas = faturamento.total;
  const entradasAnterior = faturamentoAnterior.total;
  const saidas = cancelados.reduce((s, c) => s + c.total, 0);
  const saidasAnterior = canceladosAnterior.reduce((s, c) => s + c.total, 0);
  const descontosCupons = cuponsComCodigo.reduce((s, c) => s + c.desconto_periodo, 0);
  const descontosPromocoes = promocoesAutomaticas.reduce((s, c) => s + c.desconto_periodo, 0);
  const descontos = descontosCupons + descontosPromocoes;
  const saldo = entradas - saidas;
  const qtdAprovados = faturamento.serie.reduce((s, d) => s + d.qtd_pedidos, 0);
  const transacoes = qtdAprovados + cancelados.length;
  const ticketMedio = qtdAprovados ? entradas / qtdAprovados : 0;

  const resumo = {
    saldo, saldoFormatado: moeda(saldo),
    entradas, entradasFormatado: moeda(entradas),
    entradasVariacao: variacaoPercentual(entradas, entradasAnterior),
    saidas, saidasFormatado: moeda(saidas),
    saidasVariacao: variacaoPercentual(saidas, saidasAnterior),
    descontos, descontosFormatado: moeda(descontos),
    ticketMedio, ticketMedioFormatado: moeda(ticketMedio),
    transacoes,
    qtdAprovados, qtdCancelados: cancelados.length,
  };

  const diasCompletos = todosOsDias(de, ate);
  const graficoTruncado = diasCompletos.length > MAX_DIAS_GRAFICO;
  const dias = graficoTruncado ? diasCompletos.slice(-MAX_DIAS_GRAFICO) : diasCompletos;
  const entradasPorDia = new Map(faturamento.serie.map(d => [chaveDia(d.dia), d.total]));
  const saidasPorDia = new Map();
  cancelados.forEach(c => {
    const chave = chaveDia(c.cancelado_em);
    saidasPorDia.set(chave, (saidasPorDia.get(chave) || 0) + c.total);
  });
  const serieEvolucao = dias.map(dia => ({
    dia, label: labelDia(dia),
    entradas: entradasPorDia.get(dia) || 0,
    saidas: saidasPorDia.get(dia) || 0,
  }));
  const maiorEntrada = Math.max(1, ...serieEvolucao.map(d => d.entradas));
  const maiorSaida = Math.max(1, ...serieEvolucao.map(d => d.saidas));

  // Entradas por forma de pagamento
  const entradasPorFormaPagamento = porFormaPagamento.map(f => ({
    forma: f.forma_pagto, formaRotulo: capitalizar(f.forma_pagto),
    pedidos: f.total_pedidos, total: f.total, totalFormatado: moeda(f.total),
    pct: entradas ? (f.total / entradas) * 100 : 0,
  }));

  // Saídas detalhadas
  const reembolsos = cancelados
    .map(c => ({
      pedidoId: c.id, cliente: c.cliente_nome,
      data: dataFmt(c.cancelado_em), dataOrdenacao: new Date(c.cancelado_em).getTime(),
      motivo: c.motivo_cancelamento || 'Não informado',
      total: c.total, totalFormatado: moeda(c.total),
      href: `/pedidos/${c.id}`,
    }))
    .sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);

  const descontosLista = [
    ...cuponsComCodigo.filter(c => c.desconto_periodo > 0).map(c => ({
      identificacao: c.codigo, tipo: 'Cupom', usos: c.usos_periodo,
      valor: c.desconto_periodo, valorFormatado: moeda(c.desconto_periodo),
    })),
    ...promocoesAutomaticas.filter(c => c.desconto_periodo > 0).map(c => ({
      identificacao: `Promoção #${c.id}`, tipo: 'Automática', usos: c.usos_periodo,
      valor: c.desconto_periodo, valorFormatado: moeda(c.desconto_periodo),
    })),
  ].sort((a, b) => b.valor - a.valor);
  const maiorDesconto = Math.max(1, ...descontosLista.map(d => d.valor));

  // Movimentações
  const movimentacoes = [];
  pedidosPeriodo.forEach(p => {
    if (p.status_pagamento === 'aprovado') {
      movimentacoes.push({
        tipo: 'entrada', badge: 'verde',
        data: dataHoraFmt(p.criado_em), dataOrdenacao: new Date(p.criado_em).getTime(),
        descricao: `Venda — Pedido #${p.id}`, cliente: p.cliente_nome,
        total: p.total, totalFormatado: moeda(p.total), href: `/pedidos/${p.id}`,
      });
    } else if (p.status_pagamento === 'estornado') {
      movimentacoes.push({
        tipo: 'saida', badge: 'vermelho',
        data: dataHoraFmt(p.criado_em), dataOrdenacao: new Date(p.criado_em).getTime(),
        descricao: `Reembolso — Pedido #${p.id}`, cliente: p.cliente_nome,
        total: p.total, totalFormatado: moeda(p.total), href: `/pedidos/${p.id}`,
      });
    }
  });
  movimentacoes.sort((a, b) => b.dataOrdenacao - a.dataOrdenacao);
  const movimentacoesRecentes = movimentacoes.slice(0, MAX_MOVIMENTACOES_RECENTES);

  // Compras
  const colunasCompras = [
    { chave: 'pedido', rotulo: 'Nº', tipo: 'numero' },
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'itens', rotulo: 'Itens', tipo: 'numero', alinhar: 'num' },
    { chave: 'forma', rotulo: 'Forma de pagamento', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'pagamento', rotulo: 'Pagamento', tipo: 'texto' },
    { chave: 'total', rotulo: 'Valor', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhasCompras = pedidosPeriodo.map(p => ({
    pedido: celula('#' + p.id, p.id, { link: `/pedidos/${p.id}` }),
    data: celula(dataFmt(p.criado_em), new Date(p.criado_em).getTime()),
    cliente: celula(p.cliente_nome, p.cliente_nome),
    itens: celula(p.total_itens, p.total_itens),
    forma: celula(p.forma_pagto ? capitalizar(p.forma_pagto) : 'Não informado', p.forma_pagto || ''),
    status: celula(ROTULOS_ETAPA[p.status] || p.status, p.status, { badge: BADGE_ETAPA[p.status] }),
    pagamento: celula(ROTULOS_STATUS_PAGAMENTO[p.status_pagamento] || p.status_pagamento, p.status_pagamento, { badge: BADGE_STATUS_PAGAMENTO[p.status_pagamento] }),
    total: celula(moeda(p.total), p.total),
  }));

  const porStatusPagamentoMapa = new Map();
  pedidosPeriodo.forEach(p => {
    const atual = porStatusPagamentoMapa.get(p.status_pagamento) || { status: p.status_pagamento, qtd: 0, total: 0 };
    atual.qtd += 1; atual.total += p.total;
    porStatusPagamentoMapa.set(p.status_pagamento, atual);
  });
  const porStatusPagamento = [...porStatusPagamentoMapa.values()]
    .map(s => ({
      ...s,
      rotulo: ROTULOS_STATUS_PAGAMENTO[s.status] || s.status,
      badge: BADGE_STATUS_PAGAMENTO[s.status],
      totalFormatado: moeda(s.total),
    }))
    .sort((a, b) => b.qtd - a.qtd);

  // Comprovantes
  const comprovantesLista = comprovantes.slice(0, MAX_COMPROVANTES_LISTADOS).map(c => ({
    pedidoId: c.pedido_id, cliente: c.cliente_nome, clienteEmail: c.cliente_email,
    data: dataFmt(c.criado_em), total: c.total, totalFormatado: moeda(c.total),
    statusPagamentoRotulo: ROTULOS_STATUS_PAGAMENTO[c.status_pagamento] || c.status_pagamento,
    statusPagamentoBadge: BADGE_STATUS_PAGAMENTO[c.status_pagamento],
    codigo: c.codigo, emitido: !!c.codigo, emissoes: c.emissoes || 0,
    hrefVisualizar: `/pedido/${c.pedido_id}/comprovante`,
    hrefBaixar: `/pedido/${c.pedido_id}/comprovante/pdf?baixar=1`,
  }));

  // Compras por período
  const comprasPorDiaMapa = new Map();
  pedidosPeriodo.forEach(p => {
    const chave = chaveDia(p.criado_em);
    const atual = comprasPorDiaMapa.get(chave) || { dia: chave, qtd: 0, total: 0 };
    atual.qtd += 1; atual.total += p.total;
    comprasPorDiaMapa.set(chave, atual);
  });
  const comprasPorDia = dias.map(dia => {
    const registro = comprasPorDiaMapa.get(dia);
    return { dia, label: labelDia(dia), qtd: registro ? registro.qtd : 0, total: registro ? registro.total : 0 };
  });
  const maiorComprasDia = Math.max(1, ...comprasPorDia.map(d => d.qtd));

  const ledger = montarLedger(movimentacoes);

  return {
    periodoLabel: periodoLabel(de, ate),
    resumo,
    grafico: { serie: serieEvolucao, maiorEntrada, maiorSaida, truncado: graficoTruncado, diasNoPeriodo: diasCompletos.length },
    entradasPorFormaPagamento,
    saidas: {
      reembolsos, descontos: descontosLista, maiorDesconto,
      fornecedores: {
        totalComprado: fornecedoresResumo.totalComprado, totalCompradoFormatado: moeda(fornecedoresResumo.totalComprado),
        totalPago: fornecedoresResumo.totalPago, totalPagoFormatado: moeda(fornecedoresResumo.totalPago),
        totalEmAberto: fornecedoresResumo.totalEmAberto, totalEmAbertoFormatado: moeda(fornecedoresResumo.totalEmAberto),
        totalVencido: fornecedoresResumo.totalVencido, totalVencidoFormatado: moeda(fornecedoresResumo.totalVencido),
      },
    },
    movimentacoesRecentes,
    totalMovimentacoes: movimentacoes.length,
    compras: { colunas: colunasCompras, linhas: linhasCompras, total: pedidosPeriodo.length },
    pagamentos: { porFormaPagamento: entradasPorFormaPagamento, porStatus: porStatusPagamento },
    comprovantes: comprovantesLista,
    totalComprovantes: comprovantes.length,
    graficoComprasPorDia: { serie: comprasPorDia, maior: maiorComprasDia },
    ledger,
  };
}

async function montarLedgerPdf(de, ate) {
  const financeiro = await montarFinanceiro(de, ate);
  return {
    titulo: 'Relatório Financeiro',
    subtitulo: 'Entradas (vendas aprovadas) e saídas (reembolsos/estornos) registradas no período.',
    periodoLabel: financeiro.periodoLabel,
    colunas: financeiro.ledger.colunas,
    linhas: financeiro.ledger.linhas,
    resumo: financeiro.ledger.resumo,
  };
}

module.exports = { montarFinanceiro, montarLedgerPdf };
