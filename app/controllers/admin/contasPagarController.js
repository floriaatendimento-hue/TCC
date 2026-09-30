'use strict';

const Compra = require('../../models/Compra');
const Fornecedor = require('../../models/Fornecedor');
const { logAcao } = require('../../helpers/auditLog');

const CATEGORIAS = ['compra_fornecedor', 'aluguel', 'utilidades', 'servicos', 'impostos', 'salarios', 'outro'];

exports.pagina = async (req, res) => {
  try {
    const fornecedorId = String(req.query.fornecedor_id || '').trim();
    const statusConta = String(req.query.status || '').trim();
    const categoria = String(req.query.categoria || '').trim();
    const busca = String(req.query.busca || '').trim().slice(0, 100);
    const de = String(req.query.de || '').trim();
    const ate = String(req.query.ate || '').trim();
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = 30;
    const offset = (pagina - 1) * limite;

    const filtros = { fornecedorId, statusConta, categoria, busca, de, ate };
    const [contas, fornecedores, resumo, resumoVencimentos, totalFiltrado] = await Promise.all([
      Compra.contasPagarTodas({ ...filtros, limite, offset }),
      Fornecedor.findAll({}),
      Compra.resumoGeral(),
      Compra.resumoVencimentos(),
      Compra.contarContasPagarTodas(filtros),
    ]);

    res.render('pages/admin/contas-pagar', {
      contas, fornecedores, resumo: { ...resumo, ...resumoVencimentos }, categorias: CATEGORIAS,
      fornecedorId, statusConta, categoria, busca, de, ate,
      pagina, totalPaginas: Math.max(1, Math.ceil(totalFiltrado / limite)), totalFiltrado,
      erro: null, secaoAtual: 'contas-pagar',
    });
  } catch (err) {
    console.error('Erro ao listar contas a pagar:', err.message);
    res.render('pages/admin/contas-pagar', {
      contas: [], fornecedores: [], resumo: { totalComprado: 0, totalPago: 0, totalEmAberto: 0, totalVencido: 0, venceHoje: 0, proximosVencimentos: 0 }, categorias: CATEGORIAS,
      fornecedorId: '', statusConta: '', categoria: '', busca: '', de: '', ate: '',
      pagina: 1, totalPaginas: 1, totalFiltrado: 0,
      erro: 'Não foi possível carregar as contas a pagar agora. Tente recarregar a página.',
      secaoAtual: 'contas-pagar',
    });
  }
};

exports.telaNovaAvulsa = async (req, res) => {
  try {
    const fornecedores = await Fornecedor.findAll({ status: 'ativo' });
    res.render('pages/admin/conta-form', { fornecedores, categorias: CATEGORIAS.filter(c => c !== 'compra_fornecedor'), secaoAtual: 'contas-pagar' });
  } catch (err) {
    console.error('Erro ao abrir formulário de conta:', err.message);
    res.redirect('/admin/contas-a-pagar');
  }
};
