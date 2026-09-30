'use strict';

const Fornecedor = require('../../models/Fornecedor');
const Compra = require('../../models/Compra');
const LogAdmin = require('../../models/LogAdmin');
const enderecoValidationService = require('../../services/enderecoValidationService');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

function temEnderecoInformado(body) {
  return !!String(body?.cep || '').trim();
}

async function confirmarEnderecoFornecedor(body) {
  const camposObrigatorios = ['logradouro', 'numero', 'bairro', 'cidade', 'uf'];
  const faltando = camposObrigatorios.filter(c => !String(body[c] || '').trim());
  if (faltando.length) {
    return {
      bloqueado: true,
      resposta: { ok: false, message: `Endereço incompleto — falta preencher: ${faltando.join(', ')}.` },
    };
  }
  const dados = {
    cep: String(body.cep).trim(), logradouro: String(body.logradouro).trim(),
    numero: String(body.numero).trim(), bairro: String(body.bairro).trim(),
    cidade: String(body.cidade).trim(), uf: String(body.uf).trim().toUpperCase(),
  };
  const resultado = await enderecoValidationService.validarExistenciaEndereco(dados);
  if (resultado.status === enderecoValidationService.STATUS.INVALID) {
    return { bloqueado: true, resposta: { ok: false, message: resultado.mensagem } };
  }
  return {
    bloqueado: false,
    validacao: { status: resultado.status.toLowerCase(), fonte: resultado.fonte, detalhes: resultado.detalhes },
  };
}

exports.pagina = async (req, res) => {
  try {
    const status = String(req.query.status || '').trim();
    const busca = String(req.query.busca || '').trim().slice(0, 100);
    const cidade = String(req.query.cidade || '').trim();
    const uf = String(req.query.uf || '').trim();
    const dataCadastroDe = String(req.query.data_de || '').trim();
    const dataCadastroAte = String(req.query.data_ate || '').trim();
    const comCompras = String(req.query.com_compras || '').trim();
    const comContasAbertas = String(req.query.com_contas_abertas || '').trim();

    const [fornecedores, indicadores] = await Promise.all([
      Fornecedor.findAll({ status, busca, cidade, uf, dataCadastroDe, dataCadastroAte, comCompras, comContasAbertas }),
      Fornecedor.indicadores(),
    ]);

    res.render('pages/admin/fornecedores', {
      fornecedores, indicadores,
      status, busca, cidade, uf, dataCadastroDe, dataCadastroAte, comCompras, comContasAbertas,
      erro: null, secaoAtual: 'fornecedores',
    });
  } catch (err) {
    console.error('Erro ao listar fornecedores:', err.message);
    res.render('pages/admin/fornecedores', {
      fornecedores: [], indicadores: { total: 0, ativos: 0, inativos: 0, comContasAbertas: 0, totalEmAberto: 0 },
      status: '', busca: '', cidade: '', uf: '', dataCadastroDe: '', dataCadastroAte: '', comCompras: '', comContasAbertas: '',
      erro: 'Não foi possível carregar a lista de fornecedores agora. Tente recarregar a página.',
      secaoAtual: 'fornecedores',
    });
  }
};

exports.telaNovo = (req, res) => {
  res.render('pages/admin/fornecedor-form', { fornecedor: null, secaoAtual: 'fornecedores' });
};

exports.telaEditar = async (req, res) => {
  try {
    const fornecedor = await Fornecedor.findById(req.params.id);
    if (!fornecedor) return res.redirect('/admin/fornecedores');
    res.render('pages/admin/fornecedor-form', { fornecedor, secaoAtual: 'fornecedores' });
  } catch (err) {
    console.error('Erro ao carregar fornecedor:', err.message);
    res.redirect('/admin/fornecedores');
  }
};

exports.detalhes = async (req, res) => {
  try {
    const fornecedor = await Fornecedor.findById(req.params.id);
    if (!fornecedor) return res.redirect('/admin/fornecedores');

    const [resumo, compras, contas, historico] = await Promise.all([
      Fornecedor.resumoFinanceiro(fornecedor.id),
      Compra.findAllAdmin({ fornecedorId: fornecedor.id, limite: 20, offset: 0 }),
      Compra.contasPagarTodas({ fornecedorId: fornecedor.id, limite: 20, offset: 0 }),
      LogAdmin.historicoPorFornecedor(fornecedor.id),
    ]);

    res.render('pages/admin/fornecedor-detalhes', {
      fornecedor, resumo, compras, contas, historico,
      secaoAtual: 'fornecedores',
    });
  } catch (err) {
    console.error('Erro ao carregar detalhes do fornecedor:', err.message);
    res.redirect('/admin/fornecedores');
  }
};

exports.criar = async (req, res) => {
  try {
    let validacao = null;
    if (temEnderecoInformado(req.body)) {
      const checagem = await confirmarEnderecoFornecedor(req.body);
      if (checagem.bloqueado) return res.status(422).json(checagem.resposta);
      validacao = checagem.validacao;
    }
    const id = await Fornecedor.create({ ...req.body, validacao });
    logAcao(req, 'fornecedor.criar', `#${id} — ${req.body.razao_social}`);
    res.status(201).json({ ok: true, id });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe um fornecedor com esse documento.' : 'Erro ao criar fornecedor.' });
  }
};

exports.atualizar = async (req, res) => {
  try {
    let validacao = null;
    if (temEnderecoInformado(req.body)) {
      const checagem = await confirmarEnderecoFornecedor(req.body);
      if (checagem.bloqueado) return res.status(422).json(checagem.resposta);
      validacao = checagem.validacao;
    }
    const antes = await Fornecedor.findById(req.params.id);
    await Fornecedor.update(req.params.id, { ...req.body, validacao });
    const diff = diffCampos(antes, req.body, ['razao_social', 'nome_fantasia', 'documento', 'telefone', 'email', 'endereco', 'cidade', 'uf']);
    logAcao(req, 'fornecedor.editar', `#${req.params.id}`, diff.mudou ? { dadosAntes: diff.antes, dadosDepois: diff.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    const dup = err.code === 'ER_DUP_ENTRY';
    res.status(dup ? 409 : 500).json({ ok: false, message: dup ? 'Já existe um fornecedor com esse documento.' : 'Erro ao atualizar fornecedor.' });
  }
};

exports.definirStatus = async (req, res) => {
  try {
    const antes = await Fornecedor.findById(req.params.id);
    if (!antes) return res.status(404).json({ ok: false, message: 'Fornecedor não encontrado.' });
    await Fornecedor.definirStatus(req.params.id, req.body.status);
    logAcao(req, 'fornecedor.status', `#${req.params.id} → ${req.body.status}`, {
      dadosAntes: { status: antes.status }, dadosDepois: { status: req.body.status },
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(400).json({ ok: false, message: err.message });
  }
};

exports.excluir = async (req, res) => {
  try {
    await Fornecedor.delete(req.params.id);
    logAcao(req, 'fornecedor.excluir', `#${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    const conflito = err.code === 'FORNECEDOR_COM_HISTORICO' || err.code === 'ER_ROW_IS_REFERENCED_2';
    const mensagem = err.code === 'ER_ROW_IS_REFERENCED_2'
      ? 'Este fornecedor já tem compras ou contas a pagar registradas e não pode ser excluído — use "Bloquear" ou "Inativar" em vez disso.'
      : (err.message || 'Erro ao excluir fornecedor.');
    res.status(conflito ? 409 : 500).json({ ok: false, message: mensagem });
  }
};
