const Produto         = require('../../models/Produto');
const Pedido          = require('../../models/Pedido');
const Usuario         = require('../../models/Usuario');
const Favorito        = require('../../models/Favorito');
const Comentario      = require('../../models/Comentario');
const CategoriaAcesso = require('../../models/CategoriaAcesso');

const DIAS_SERIE_FATURAMENTO = 7;
const DIAS_PEDIDO_PARADO = 2;
const DIAS_FORMAS_PAGAMENTO = 30;

const DIAS_SEMANA = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const FORMAS_PAGAMENTO_META = {
  pix:     { rotulo: 'Pix',                  cor: '#2a78d6' },
  credito: { rotulo: 'Cartão de crédito',    cor: '#eb6834' },
  debito:  { rotulo: 'Cartão de débito',     cor: '#1baf7a' },
  outros:  { rotulo: 'Outros',               cor: '#a8a49c' },
};

function variacaoPercentual(atual, anterior) {
  if (!anterior) return atual > 0 ? 100 : 0;
  return Number((((atual - anterior) / anterior) * 100).toFixed(1));
}

function formatarMoeda(valor) {
  return Number(valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function preencherSerieDiaria(serie, dias) {
  const porDia = new Map(
    serie.map(item => {
      const chave = (item.dia instanceof Date ? item.dia : new Date(item.dia))
        .toISOString()
        .slice(0, 10);
      return [chave, item.total];
    })
  );

  const resultado = [];
  const hoje = new Date();
  for (let i = dias - 1; i >= 0; i--) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    const chave = data.toISOString().slice(0, 10);
    resultado.push({
      data:  chave,
      label: DIAS_SEMANA[data.getDay()],
      total: porDia.get(chave) || 0,
    });
  }
  return resultado;
}

async function montarEvolucao() {
  const [faturamentoBruto, pedidosBruto] = await Promise.all([
    Pedido.faturamentoSerieDiaria(DIAS_SERIE_FATURAMENTO),
    Pedido.pedidosSerieDiaria(DIAS_SERIE_FATURAMENTO),
  ]);

  const serieFaturamento = preencherSerieDiaria(faturamentoBruto, DIAS_SERIE_FATURAMENTO);
  const seriePedidos     = preencherSerieDiaria(pedidosBruto, DIAS_SERIE_FATURAMENTO);

  const serie = serieFaturamento.map((dia, i) => ({
    data:        dia.data,
    label:       dia.label,
    faturamento: dia.total,
    pedidos:     seriePedidos[i].total,
  }));

  return {
    serie,
    maiorFaturamento: Math.max(1, ...serie.map(d => d.faturamento)),
    maiorPedidos:     Math.max(1, ...serie.map(d => d.pedidos)),
  };
}

async function montarAlertas() {
  const [pedidoStatsHoje, estoqueBaixoLista, pedidosParados, avaliacoesRecentes] = await Promise.all([
    Pedido.statsHoje(),
    Produto.listaEstoqueBaixo(5),
    Pedido.pedidosParados(DIAS_PEDIDO_PARADO, 5),
    Comentario.semResposta(3),
  ]);

  return {
    pedidosPendentes:   pedidoStatsHoje.pedidosPendentes,
    estoqueBaixo:       estoqueBaixoLista,
    pedidosParados,
    avaliacoesRecentes,
  };
}

const PERIODOS_TRAFEGO_VALIDOS = ['24h', '7d', '30d', '12m'];
const ROTULO_PERIODO_TRAFEGO = {
  '24h': 'últimas 24 horas',
  '7d':  'últimos 7 dias',
  '30d': 'últimos 30 dias',
  '12m': 'últimos 12 meses',
};

async function montarTrafego(periodo) {
  const periodoValido = PERIODOS_TRAFEGO_VALIDOS.includes(periodo) ? periodo : '30d';
  const { serie, totalAtual, totalAnterior, maiorValor } = await CategoriaAcesso.serieTrafego(periodoValido);

  return {
    periodo: periodoValido,
    periodoRotulo: ROTULO_PERIODO_TRAFEGO[periodoValido],
    serie,
    maiorValor,
    total: totalAtual,
    variacaoPercentual: variacaoPercentual(totalAtual, totalAnterior),
  };
}

const PERIODOS_ATIVIDADE_VALIDOS = ['30d', '90d', '12m'];
const ROTULO_PERIODO_ATIVIDADE = {
  '30d': 'últimos 30 dias',
  '90d': 'últimos 3 meses',
  '12m': 'últimos 12 meses',
};

async function montarAtividadeClientes(periodo) {
  const periodoValido = PERIODOS_ATIVIDADE_VALIDOS.includes(periodo) ? periodo : '90d';
  const { serie, totalNovos, totalRecorrentes, maiorValor } = await Pedido.atividadeClientesSerie(periodoValido);

  return {
    periodo: periodoValido,
    periodoRotulo: ROTULO_PERIODO_ATIVIDADE[periodoValido],
    serie,
    maiorValor,
    totalNovos,
    totalRecorrentes,
    totalGeral: totalNovos + totalRecorrentes,
  };
}

function montarFormasPagamento(linhas) {
  const somas = { pix: 0, credito: 0, debito: 0, outros: 0 };
  const pedidosPorBalde = { pix: 0, credito: 0, debito: 0, outros: 0 };

  linhas.forEach(r => {
    const balde = somas.hasOwnProperty(r.forma_pagto) ? r.forma_pagto : 'outros';
    somas[balde] += r.total;
    pedidosPorBalde[balde] += r.total_pedidos;
  });

  const totalGeral = somas.pix + somas.credito + somas.debito + somas.outros;

  const itens = ['pix', 'credito', 'debito', 'outros'].map(chave => ({
    chave,
    rotulo: FORMAS_PAGAMENTO_META[chave].rotulo,
    cor: FORMAS_PAGAMENTO_META[chave].cor,
    total: somas[chave],
    totalFormatado: formatarMoeda(somas[chave]),
    totalPedidos: pedidosPorBalde[chave],
    percentual: totalGeral > 0 ? Number(((somas[chave] / totalGeral) * 100).toFixed(1)) : 0,
  }));

  return { itens, total: totalGeral, totalFormatado: formatarMoeda(totalGeral) };
}

async function montarDashboard() {
  const [
    produtoStats,
    pedidoStatsHoje,
    totalClientes,
    serieBruta,
    faturamentoSemanaAnterior,
    produtosMaisVendidos,
    produtosMaisFavoritados,
    estoqueBaixoLista,
    pedidosParados,
    avaliacoesRecentes,
    evolucao,
    formasPagamentoBruto,
    trafego,
    atividadeClientes,
  ] = await Promise.all([
    Produto.statsBasicos(),
    Pedido.statsHoje(),
    Usuario.contarClientes(),
    Pedido.faturamentoSerieDiaria(DIAS_SERIE_FATURAMENTO),
    Pedido.faturamentoEntreDiasAtras(DIAS_SERIE_FATURAMENTO * 2, DIAS_SERIE_FATURAMENTO),
    Pedido.produtosMaisVendidos(5),
    Favorito.maisFavoritados(5),
    Produto.listaEstoqueBaixo(5),
    Pedido.pedidosParados(DIAS_PEDIDO_PARADO, 5),
    Comentario.semResposta(3),
    montarEvolucao(),
    Pedido.faturamentoPorFormaPagamento(
      new Date(Date.now() - (DIAS_FORMAS_PAGAMENTO - 1) * 86400000).toISOString().slice(0, 10),
      new Date().toISOString().slice(0, 10)
    ),
    montarTrafego('30d'),
    montarAtividadeClientes('90d'),
  ]);

  const serie = preencherSerieDiaria(serieBruta, DIAS_SERIE_FATURAMENTO);
  const faturamentoSemanaAtual = serie.reduce((soma, dia) => soma + dia.total, 0);
  const maiorValorDia = Math.max(1, ...serie.map(d => d.total));

  return {
    cards: {
      totalProdutos:      produtoStats.total,
      produtosAtivos:     produtoStats.ativos,
      produtosSemEstoque: produtoStats.semEstoque,
      pedidosHoje:        pedidoStatsHoje.pedidosHoje,
      pedidosPendentes:   pedidoStatsHoje.pedidosPendentes,
      clientesCadastrados: totalClientes,
    },

    faturamento: {
      serie,
      maiorValorDia,
      totalSemanaFormatado: formatarMoeda(faturamentoSemanaAtual),
      variacaoPercentual:   variacaoPercentual(faturamentoSemanaAtual, faturamentoSemanaAnterior),
    },

    produtosMaisVendidos,
    produtosMaisFavoritados,

    formasPagamento: montarFormasPagamento(formasPagamentoBruto),

    alertas: {
      estoqueBaixo:  estoqueBaixoLista,
      pedidosParados,
      avaliacoesRecentes,
    },

    evolucao,
    trafego,
    atividadeClientes,
  };
}

module.exports = {
  montarDashboard,
  montarEvolucao,
  montarAlertas,
  montarTrafego,
  montarAtividadeClientes,
  formatarMoeda,
};
