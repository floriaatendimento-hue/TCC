'use strict';

const Pedido = require('../../models/Pedido');
const Usuario = require('../../models/Usuario');
const Produto = require('../../models/Produto');
const MovimentacaoEstoque = require('../../models/MovimentacaoEstoque');
const BuscaLog = require('../../models/BuscaLog');
const CategoriaAcesso = require('../../models/CategoriaAcesso');
const { moeda, dataFmt, periodoLabel, celula } = require('./relatoriosService');

const STATUS_PENDENTES = ['preparando', 'enviado', 'em_transporte', 'saiu_entrega'];
const ROTULOS_STATUS = {
  preparando: 'Preparando', enviado: 'Enviado', em_transporte: 'Em transporte',
  saiu_entrega: 'Saiu para entrega', entregue: 'Entregue', cancelado: 'Cancelado',
};
const BADGE_STATUS = {
  preparando: 'cinza', enviado: 'dourado', em_transporte: 'dourado',
  saiu_entrega: 'dourado', entregue: 'verde', cancelado: 'vermelho',
};

function pct(v) {
  const n = Number(v) || 0;
  const sinal = n > 0 ? '+' : '';
  return `${sinal}${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
}

function variacaoPct(atual, anterior) {
  if (!anterior) return atual ? null : 0;
  return ((atual - anterior) / anterior) * 100;
}

function periodoAnterior(de, ate) {
  const dias = Math.round((new Date(ate) - new Date(de)) / 86400000) + 1;
  const fimAnt = new Date(de);
  fimAnt.setDate(fimAnt.getDate() - 1);
  const inicioAnt = new Date(fimAnt);
  inicioAnt.setDate(inicioAnt.getDate() - (dias - 1));
  const fmtISO = (d) => d.toISOString().slice(0, 10);
  return { de: fmtISO(inicioAnt), ate: fmtISO(fimAnt) };
}

// Tabelas auxiliares

function tabelaPedidos(pedidos) {
  const colunas = [
    { chave: 'pedido', rotulo: 'Pedido', tipo: 'numero' },
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'status', rotulo: 'Status', tipo: 'texto' },
    { chave: 'total', rotulo: 'Total', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = pedidos.map(p => ({
    pedido: celula('#' + p.id, p.id),
    data: celula(dataFmt(p.criado_em), new Date(p.criado_em).getTime()),
    cliente: celula(p.cliente_nome, p.cliente_nome),
    status: celula(ROTULOS_STATUS[p.status] || p.status, p.status, { badge: BADGE_STATUS[p.status] }),
    total: celula(moeda(p.total), p.total),
  }));
  const valorTotal = pedidos.reduce((s, p) => s + p.total, 0);
  const resumo = [
    { rotulo: 'Total de pedidos', valor: String(pedidos.length) },
    { rotulo: 'Valor total', valor: moeda(valorTotal) },
  ];
  return { colunas, linhas, resumo };
}

async function montarVendas(de, ate) {
  const itens = await Pedido.itensVendidosPeriodo(de, ate);
  const colunas = [
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'texto' },
    { chave: 'qtd', rotulo: 'Qtd. vendida', tipo: 'numero', alinhar: 'num' },
    { chave: 'unit', rotulo: 'Valor unitário', tipo: 'moeda', alinhar: 'num' },
    { chave: 'total', rotulo: 'Valor total', tipo: 'moeda', alinhar: 'num' },
    { chave: 'data', rotulo: 'Data da venda', tipo: 'data' },
  ];
  const linhas = itens.map(i => ({
    produto: celula(i.produto_nome, i.produto_nome),
    categoria: celula(i.categoria_nome, i.categoria_nome),
    qtd: celula(i.quantidade, i.quantidade),
    unit: celula(moeda(i.preco_unit), i.preco_unit),
    total: celula(moeda(i.subtotal), i.subtotal),
    data: celula(dataFmt(i.criado_em), new Date(i.criado_em).getTime()),
  }));
  const receitaTotal = itens.reduce((s, i) => s + i.subtotal, 0);
  const resumo = [
    { rotulo: 'Itens vendidos', valor: String(itens.reduce((s, i) => s + i.quantidade, 0)) },
    { rotulo: 'Receita total', valor: moeda(receitaTotal) },
  ];
  return { colunas, linhas, resumo };
}

async function montarMaisVendidos(de, ate) {
  const produtos = await Pedido.produtosMaisVendidosPeriodo(de, ate, 10);
  const receitaTotal = produtos.reduce((s, p) => s + p.receita, 0);
  const colunas = [
    { chave: 'posicao', rotulo: 'Posição', tipo: 'numero' },
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'qtd', rotulo: 'Quantidade vendida', tipo: 'numero', alinhar: 'num' },
    { chave: 'participacao', rotulo: '% de participação', tipo: 'texto', alinhar: 'num' },
  ];
  const linhas = produtos.map((p, i) => {
    const participacao = receitaTotal ? (p.receita / receitaTotal) * 100 : 0;
    return {
      posicao: celula(String(i + 1), i + 1),
      produto: celula(p.nome, p.nome),
      qtd: celula(p.total_vendido, p.total_vendido),
      participacao: celula(participacao.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + '%', participacao),
    };
  });
  return { colunas, linhas, grafico: produtos.map(p => ({ nome: p.nome, valor: p.total_vendido })) };
}

async function montarMaisPesquisados(de, ate) {
  const termos = await BuscaLog.maisPesquisadosPeriodo(de, ate, 20);
  const colunas = [
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'pesquisas', rotulo: 'Número de pesquisas', tipo: 'numero', alinhar: 'num' },
    { chave: 'tendencia', rotulo: 'Tendência de crescimento', tipo: 'texto', alinhar: 'num' },
  ];
  const linhas = termos.map(t => ({
    produto: celula(t.produto, t.produto, t.correspondeProduto ? {} : { badge: 'cinza' }),
    pesquisas: celula(t.qtd, t.qtd),
    tendencia: celula(t.tendencia === null ? 'Termo novo' : pct(t.tendencia), t.tendencia ?? 0),
  }));
  return { colunas, linhas };
}

async function montarCategoriasAcessadas(de, ate) {
  const categorias = await CategoriaAcesso.maisAcessadasPeriodo(de, ate);
  const colunas = [
    { chave: 'categoria', rotulo: 'Categoria', tipo: 'texto' },
    { chave: 'acessos', rotulo: 'Quantidade de acessos', tipo: 'numero', alinhar: 'num' },
    { chave: 'vendas', rotulo: 'Quantidade de vendas', tipo: 'numero', alinhar: 'num' },
  ];
  const linhas = categorias.map(c => ({
    categoria: celula(c.categoria_nome, c.categoria_nome),
    acessos: celula(c.qtd_acessos, c.qtd_acessos),
    vendas: celula(c.qtd_vendas, c.qtd_vendas),
  }));
  return { colunas, linhas, grafico: categorias.map(c => ({ nome: c.categoria_nome, valor: c.qtd_acessos })) };
}

async function montarClientes(de, ate) {
  const clientes = await Usuario.relatorioClientesPeriodo(de, ate);
  const colunas = [
    { chave: 'nome', rotulo: 'Nome', tipo: 'texto' },
    { chave: 'email', rotulo: 'E-mail', tipo: 'texto' },
    { chave: 'cadastro', rotulo: 'Cadastro', tipo: 'data' },
    { chave: 'pedidos', rotulo: 'Pedidos', tipo: 'numero', alinhar: 'num' },
    { chave: 'total_gasto', rotulo: 'Total gasto', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = clientes.map(c => ({
    nome: celula(c.nome, c.nome),
    email: celula(c.email, c.email),
    cadastro: celula(dataFmt(c.criado_em), new Date(c.criado_em).getTime()),
    pedidos: celula(c.total_pedidos, c.total_pedidos),
    total_gasto: celula(moeda(c.total_gasto), c.total_gasto),
  }));
  return { colunas, linhas };
}

async function montarEstoque(de, ate) {
  const movimentacoes = await MovimentacaoEstoque.relatorioPeriodo(de, ate);
  const colunas = [
    { chave: 'produto', rotulo: 'Produto', tipo: 'texto' },
    { chave: 'tipo', rotulo: 'Tipo', tipo: 'texto' },
    { chave: 'qtd', rotulo: 'Quantidade', tipo: 'numero', alinhar: 'num' },
    { chave: 'novo', rotulo: 'Estoque resultante', tipo: 'numero', alinhar: 'num' },
    { chave: 'data', rotulo: 'Data', tipo: 'data' },
  ];
  const ROTULO_TIPO = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' };
  const BADGE_TIPO = { entrada: 'verde', saida: 'vermelho', ajuste: 'dourado' };
  const linhas = movimentacoes.map(m => ({
    produto: celula(m.produto_nome, m.produto_nome),
    tipo: celula(ROTULO_TIPO[m.tipo] || m.tipo, m.tipo, { badge: BADGE_TIPO[m.tipo] }),
    qtd: celula(m.quantidade, m.quantidade),
    novo: celula(m.estoque_novo, m.estoque_novo),
    data: celula(dataFmt(m.criado_em), new Date(m.criado_em).getTime()),
  }));
  return { colunas, linhas };
}

async function montarCancelados(de, ate) {
  const cancelados = await Pedido.relatorioCanceladosPeriodo(de, ate);
  const colunas = [
    { chave: 'pedido', rotulo: 'Pedido', tipo: 'numero' },
    { chave: 'cliente', rotulo: 'Cliente', tipo: 'texto' },
    { chave: 'data_cancelamento', rotulo: 'Data do cancelamento', tipo: 'data' },
    { chave: 'motivo', rotulo: 'Motivo', tipo: 'texto' },
    { chave: 'valor', rotulo: 'Valor', tipo: 'moeda', alinhar: 'num' },
  ];
  const linhas = cancelados.map(c => ({
    pedido: celula('#' + c.id, c.id),
    cliente: celula(c.cliente_nome, c.cliente_nome),
    data_cancelamento: celula(dataFmt(c.cancelado_em), new Date(c.cancelado_em).getTime()),
    motivo: celula(c.motivo_cancelamento, c.motivo_cancelamento || ''),
    valor: celula(moeda(c.total), c.total),
  }));
  return { colunas, linhas, valorTotal: cancelados.reduce((s, c) => s + c.total, 0) };
}

// Análise por regras

function gerarAnalise(d) {
  const analiseGeral = [];
  const recomendacoes = [];

  const variacaoFat = variacaoPct(d.faturamento.total, d.faturamentoAnterior);
  if (variacaoFat === null) {
    analiseGeral.push('Não há dados do período anterior para comparar a evolução do faturamento.');
  } else if (variacaoFat >= 0) {
    analiseGeral.push(`O faturamento cresceu ${pct(variacaoFat)} em relação ao período anterior de mesma duração.`);
  } else {
    analiseGeral.push(`O faturamento caiu ${Math.abs(variacaoFat).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% em relação ao período anterior de mesma duração.`);
    recomendacoes.push('Investigar a queda de faturamento: revisar preços, campanhas ativas e a disponibilidade dos produtos mais vendidos no período anterior.');
  }

  const taxaCancelamento = d.totalCriados ? (d.totalCancelados / d.totalCriados) * 100 : 0;
  if (taxaCancelamento > 10) {
    analiseGeral.push(`A taxa de cancelamento no período foi de ${taxaCancelamento.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%, acima do recomendável.`);
    recomendacoes.push('Investigar os motivos de cancelamento mais frequentes (ver seção "Pedidos Cancelados") e agir sobre a causa mais comum.');
  } else {
    analiseGeral.push(`A taxa de cancelamento no período (${taxaCancelamento.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%) está em um nível saudável.`);
  }

  const estoqueCritico = d.statsEstoque.semEstoque + d.statsEstoque.estoqueBaixo;
  if (estoqueCritico > 0) {
    recomendacoes.push(`Repor estoque: ${d.statsEstoque.semEstoque} produto(s) sem estoque e ${d.statsEstoque.estoqueBaixo} com estoque baixo no momento.`);
  }

  if (d.maisVendidos.grafico.length) {
    analiseGeral.push(`O produto mais vendido do período foi "${d.maisVendidos.grafico[0].nome}", com ${d.maisVendidos.grafico[0].valor} unidades.`);
  }

  const naoEncontrados = d.termosSemProduto;
  if (naoEncontrados.length) {
    recomendacoes.push(`Clientes pesquisaram por termos sem produto correspondente no catálogo (ex.: "${naoEncontrados.slice(0, 3).join('", "')}"). Avaliar se vale ampliar o catálogo ou ajustar tags de produtos existentes.`);
  }

  if (d.novosClientes > 0) {
    analiseGeral.push(`${d.novosClientes} novo(s) cliente(s) se cadastraram na loja durante o período.`);
  }

  if (!recomendacoes.length) {
    recomendacoes.push('Nenhum ponto crítico identificado neste período — manter o acompanhamento regular dos indicadores.');
  }

  const conclusao = variacaoFat === null || variacaoFat >= 0
    ? 'A loja apresentou um desempenho estável ou em crescimento no período analisado. Recomenda-se manter o monitoramento periódico deste relatório para identificar tendências com antecedência.'
    : 'A loja apresentou queda de desempenho no período analisado. As recomendações acima devem ser priorizadas antes do próximo ciclo de análise.';

  return { analiseGeral, recomendacoes, conclusao };
}

// Montagem completa

async function montarRelatorioGeral(de, ate) {
  const { de: deAnt, ate: ateAnt } = periodoAnterior(de, ate);

  const [
    faturamento, faturamentoAnt, novosClientes, novosClientesAnt,
    totalClientes, statsProdutos, pedidosPeriodo, totalCriados,
    vendas, maisVendidos, maisPesquisados, categoriasAcessadas, clientes, estoque, cancelados,
  ] = await Promise.all([
    Pedido.faturamentoPorPeriodo(de, ate),
    Pedido.faturamentoPorPeriodo(deAnt, ateAnt),
    Usuario.contarNovosPeriodo(de, ate),
    Usuario.contarNovosPeriodo(deAnt, ateAnt),
    Usuario.contarClientes(),
    Produto.statsBasicos(),
    Pedido.relatorioPedidosPeriodo(de, ate),
    Pedido.contarCriadosPeriodo(de, ate),
    montarVendas(de, ate),
    montarMaisVendidos(de, ate),
    montarMaisPesquisados(de, ate),
    montarCategoriasAcessadas(de, ate),
    montarClientes(de, ate),
    montarEstoque(de, ate),
    montarCancelados(de, ate),
  ]);

  const pedidosAprovados = faturamento.serie.reduce((s, d) => s + d.qtd_pedidos, 0);
  const pedidosAprovadosAnt = faturamentoAnt.serie.reduce((s, d) => s + d.qtd_pedidos, 0);
  const ticketMedio = pedidosAprovados ? faturamento.total / pedidosAprovados : 0;
  const ticketMedioAnt = pedidosAprovadosAnt ? faturamentoAnt.total / pedidosAprovadosAnt : 0;

  const concluidos = pedidosPeriodo.filter(p => p.status === 'entregue');
  const pendentes = pedidosPeriodo.filter(p => STATUS_PENDENTES.includes(p.status));

  const termosSemProduto = maisPesquisados.linhas
    .filter(l => l.produto.badge === 'cinza')
    .map(l => l.produto.texto);

  const analise = gerarAnalise({
    faturamento,
    faturamentoAnterior: faturamentoAnt.total,
    totalCriados,
    totalCancelados: cancelados.linhas.length,
    statsEstoque: statsProdutos,
    maisVendidos,
    termosSemProduto,
    novosClientes,
  });

  return {
    periodoLabel: periodoLabel(de, ate),
    geradoEm: new Date(),

    resumoExecutivo: {
      indicadores: [
        { rotulo: 'Faturamento do período', valor: moeda(faturamento.total), variacao: variacaoPct(faturamento.total, faturamentoAnt.total) },
        { rotulo: 'Pedidos aprovados', valor: String(pedidosAprovados), variacao: variacaoPct(pedidosAprovados, pedidosAprovadosAnt) },
        { rotulo: 'Ticket médio', valor: moeda(ticketMedio), variacao: variacaoPct(ticketMedio, ticketMedioAnt) },
        { rotulo: 'Novos clientes', valor: String(novosClientes), variacao: variacaoPct(novosClientes, novosClientesAnt) },
      ],
    },

    indicadoresGerais: [
      { rotulo: 'Clientes cadastrados (total)', valor: String(totalClientes) },
      { rotulo: 'Produtos ativos', valor: String(statsProdutos.ativos) },
      { rotulo: 'Produtos sem estoque', valor: String(statsProdutos.semEstoque) },
      { rotulo: 'Pedidos criados no período', valor: String(totalCriados) },
    ],

    vendas,
    maisVendidos,
    maisPesquisados,
    categoriasAcessadas,
    clientes,
    estoque,
    faturamento: {
      serie: faturamento.serie,
      resumo: [
        { rotulo: 'Faturamento total', valor: moeda(faturamento.total) },
        { rotulo: 'Pedidos aprovados', valor: String(pedidosAprovados) },
      ],
    },
    ticketMedio: {
      valor: ticketMedio,
      variacao: variacaoPct(ticketMedio, ticketMedioAnt),
    },
    pedidosConcluidos: tabelaPedidos(concluidos),
    pedidosPendentes: tabelaPedidos(pendentes),
    pedidosCancelados: cancelados,

    analiseGeral: analise.analiseGeral,
    recomendacoes: analise.recomendacoes,
    conclusao: analise.conclusao,
  };
}

module.exports = { montarRelatorioGeral };
