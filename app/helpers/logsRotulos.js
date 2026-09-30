'use strict';

const ROTULOS_ACAO = {
  'produto.criar':            'Criou o produto',
  'produto.editar':           'Editou o produto',
  'produto.excluir':          'Excluiu o produto',
  'produto.alternar-status':  'Alterou o status do produto',
  'estoque.movimentacao':     'Alterou o estoque',
  'categoria.criar':          'Criou a categoria',
  'categoria.editar':         'Editou a categoria',
  'categoria.status':         'Alterou o status da categoria',
  'categoria.excluir':        'Excluiu a categoria',
  'subcategoria.criar':       'Criou a subcategoria',
  'subcategoria.editar':      'Editou a subcategoria',
  'subcategoria.status':      'Alterou o status da subcategoria',
  'subcategoria.excluir':     'Excluiu a subcategoria',
  'cliente.status':           'Alterou o status do cliente',
  'nivel.criar':              'Criou o nível de cliente',
  'nivel.editar':             'Editou o nível de cliente',
  'nivel.status':             'Alterou o status do nível de cliente',
  'nivel.reordenar':          'Reordenou os níveis de clientes',
  'nivel.excluir':            'Excluiu o nível de cliente',

  'cupom.criar':              'Criou o cupom/promoção',
  'cupom.editar':             'Editou o cupom/promoção',
  'cupom.status':             'Alterou o status do cupom/promoção',
  'cupom.excluir':            'Excluiu o cupom/promoção',
  'banner.criar':             'Criou o banner',
  'banner.editar':            'Editou o banner',
  'banner.status':            'Alterou o status do banner',
  'banner.duplicar':          'Duplicou o banner',
  'banner.reordenar':         'Reordenou os banners',
  'banner.excluir':           'Excluiu o banner',
  'avaliacao.responder':      'Respondeu uma avaliação',
  'avaliacao.status':         'Alterou o status de uma avaliação',
  'avaliacao.excluir':        'Excluiu uma avaliação',
  'avaliacao.midia.ocultar':  'Ocultou/reexibiu mídia de avaliação',
  'avaliacao.midia.excluir':  'Excluiu mídia de avaliação',
  'relatorio.pdf':            'Exportou um relatório em PDF',
  'relatorio.geral.pdf':      'Exportou o relatório geral em PDF',
  'configuracoes.salvar':     'Atualizou as configurações da loja',
  'usuario.promover':         'Promoveu um cliente a administrador',
  'usuario.rebaixar':         'Rebaixou um administrador a cliente',
  'pedido.status':            'Alterou o status do pedido',
  'pedido.pagamento':         'Alterou o status de pagamento do pedido',
  'logs.exportar':            'Exportou os logs de auditoria',
};

const ROTULOS_MODULO = {
  produto:        'Produtos',
  estoque:        'Estoque',
  categoria:      'Categorias',
  subcategoria:   'Subcategorias',
  cliente:        'Clientes',
  nivel:          'Níveis de clientes',
  cupom:          'Cupons e promoções',
  banner:         'Banners',
  avaliacao:      'Comentários',
  relatorio:      'Relatórios',
  configuracoes:  'Configurações',
  usuario:        'Usuários e permissões',
  pedido:         'Pedidos',
};

const ICONE_MODULO = {
  produto:        'fa-seedling',
  estoque:        'fa-boxes-stacked',
  categoria:      'fa-layer-group',
  subcategoria:   'fa-sitemap',
  cliente:        'fa-users',
  nivel:          'fa-medal',
  cupom:          'fa-tag',
  banner:         'fa-image',
  avaliacao:      'fa-star',
  relatorio:      'fa-chart-line',
  configuracoes:  'fa-gear',
  usuario:        'fa-user-shield',
  pedido:         'fa-receipt',
};

function tipoDaAcao(acao) {
  const sufixo = String(acao || '').split('.').pop();
  if (sufixo === 'criar') return 'criar';
  if (sufixo === 'excluir') return 'excluir';
  if (['status', 'alternar-status', 'ocultar'].includes(sufixo)) return 'status';
  return 'editar';
}

function moduloDaAcao(acao) {
  return String(acao || '').split('.')[0];
}

function rotuloAcao(acao) {
  return ROTULOS_ACAO[acao] || acao;
}

function rotuloModulo(modulo) {
  return ROTULOS_MODULO[modulo] || (modulo ? modulo.charAt(0).toUpperCase() + modulo.slice(1) : '—');
}

function iconeModulo(modulo) {
  return ICONE_MODULO[modulo] || 'fa-clipboard-list';
}

const ROTULOS_CAMPO = {
  nome: 'Nome', slug: 'Slug', descricao: 'Descrição', sku: 'SKU', marca: 'Marca',
  preco: 'Preço', preco_promo: 'Preço promocional', estoque: 'Estoque', estoque_minimo: 'Estoque mínimo',
  ativo: 'Status', ativa: 'Status', destaque: 'Destaque', categoria_id: 'Categoria', subcategoria_id: 'Subcategoria',
  codigo: 'Código', tipo: 'Tipo', valor: 'Valor', valor_minimo: 'Pedido mínimo',
  data_inicio: 'Data de início', data_fim: 'Data de término', limite_usos: 'Limite de usos',
  titulo: 'Título', subtitulo: 'Subtítulo', texto_botao: 'Texto do botão', link: 'Link',
  quantidade: 'Quantidade', motivo: 'Motivo', status: 'Status', status_pagamento: 'Status do pagamento',
  observacao: 'Observação',
};

const CAMPOS_MOEDA = ['preco', 'preco_promo', 'valor', 'valor_minimo'];
const CAMPOS_BOOLEANO = ['ativo', 'ativa', 'destaque'];

function moeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarValorCampo(campo, valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  if (CAMPOS_BOOLEANO.includes(campo)) return (valor === true || valor === 1 || valor === '1') ? 'Ativo' : 'Inativo';
  if (CAMPOS_MOEDA.includes(campo)) return moeda(valor);
  return String(valor);
}

function compararDadosAlteracao(dadosAntes, dadosDepois) {
  const antes = dadosAntes && typeof dadosAntes === 'object' ? dadosAntes : {};
  const depois = dadosDepois && typeof dadosDepois === 'object' ? dadosDepois : {};
  const chaves = Array.from(new Set([...Object.keys(antes), ...Object.keys(depois)]));

  return chaves.map(campo => {
    const temAntes = Object.prototype.hasOwnProperty.call(antes, campo);
    const ehDiff = temAntes;
    const valorAntes = antes[campo];
    const valorDepois = depois[campo];
    let diferenca = null;
    if (ehDiff && CAMPOS_MOEDA.includes(campo)) {
      const na = Number(valorAntes) || 0, nb = Number(valorDepois) || 0;
      const delta = nb - na;
      if (delta !== 0) diferenca = (delta > 0 ? '+' : '−') + moeda(Math.abs(delta));
    }
    return {
      campo,
      rotulo: ROTULOS_CAMPO[campo] || (campo.charAt(0).toUpperCase() + campo.slice(1).replace(/_/g, ' ')),
      ehDiff,
      antes: ehDiff ? formatarValorCampo(campo, valorAntes) : null,
      depois: formatarValorCampo(campo, valorDepois),
      diferenca,
    };
  });
}

module.exports = {
  ROTULOS_ACAO, ROTULOS_MODULO, ICONE_MODULO, ROTULOS_CAMPO,
  tipoDaAcao, moduloDaAcao, rotuloAcao, rotuloModulo, iconeModulo,
  formatarValorCampo, compararDadosAlteracao,
};
