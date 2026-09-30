'use strict';

const { TIPOS: TIPOS_RELATORIO, resolverPeriodo, montarRelatorio, moeda } = require('../../services/relatorios/relatoriosService');
const { montarFinanceiro, montarLedgerPdf } = require('../../services/relatorios/financeiroService');
const { gerarRelatorioPdfBuffer } = require('../../services/pdf/relatorioPdf');
const { montarRelatorioGeral } = require('../../services/relatorios/relatorioGeralService');
const { gerarRelatorioGeralPdfBuffer } = require('../../services/pdf/relatorioGeralPdf');
const { logAcao } = require('../../helpers/auditLog');

exports.paginaFinanceiro = async (req, res) => {
  const { de, ate, preset } = resolverPeriodo(req.query);
  try {
    const financeiro = await montarFinanceiro(de, ate);
    res.render('pages/admin/financeiro', {
      de, ate, preset, financeiro, erro: null, secaoAtual: 'relatorios',
    });
  } catch (err) {
    console.error('Erro ao montar o Financeiro:', err.message);
    res.render('pages/admin/financeiro', {
      de, ate, preset, financeiro: null,
      erro: 'Não foi possível carregar os dados financeiros agora.', secaoAtual: 'relatorios',
    });
  }
};

exports.pdfFinanceiro = async (req, res) => {
  const { de, ate } = resolverPeriodo(req.query);
  try {
    const relatorio = await montarLedgerPdf(de, ate);
    const pdfBuffer = await gerarRelatorioPdfBuffer(relatorio);
    logAcao(req, 'financeiro.pdf', `Relatório financeiro — ${de} a ${ate}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="financeiro-${de}-a-${ate}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar PDF do relatório financeiro:', err.message);
    res.status(500).send('Não foi possível gerar o PDF do relatório financeiro agora.');
  }
};

exports.pdfRelatorio = async (req, res) => {
  const tipoAtual = TIPOS_RELATORIO.some(t => t.chave === req.query.tipo) ? req.query.tipo : TIPOS_RELATORIO[0].chave;
  const { de, ate } = resolverPeriodo(req.query);
  try {
    const relatorio = await montarRelatorio(tipoAtual, de, ate);
    const pdfBuffer = await gerarRelatorioPdfBuffer(relatorio);
    logAcao(req, 'relatorio.pdf', `${relatorio.titulo} — ${de} a ${ate}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-${tipoAtual}-${de}-a-${ate}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar PDF do relatório:', err.message);
    res.status(500).send('Não foi possível gerar o PDF deste relatório agora.');
  }
};

exports.paginaRelatorioGeral = async (req, res) => {
  const { de, ate, preset } = resolverPeriodo(req.query);
  try {
    const relatorio = await montarRelatorioGeral(de, ate);
    res.render('pages/admin/relatorio-geral', { de, ate, preset, relatorio, erro: null, moeda, secaoAtual: 'relatorio-geral' });
  } catch (err) {
    console.error('Erro ao montar o Relatório Geral da Loja:', err.message);
    res.render('pages/admin/relatorio-geral', {
      de, ate, preset, relatorio: null, moeda,
      erro: 'Não foi possível carregar o Relatório Geral agora.', secaoAtual: 'relatorio-geral',
    });
  }
};

exports.pdfRelatorioGeral = async (req, res) => {
  const { de, ate } = resolverPeriodo(req.query);
  try {
    const relatorio = await montarRelatorioGeral(de, ate);
    const pdfBuffer = await gerarRelatorioGeralPdfBuffer(relatorio);
    logAcao(req, 'relatorio.geral.pdf', `${de} a ${ate}`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="relatorio-geral-floria-${de}-a-${ate}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao gerar o PDF do Relatório Geral da Loja:', err.message);
    res.status(500).send('Não foi possível gerar o PDF do Relatório Geral agora.');
  }
};
