'use strict';

const LogAdmin = require('../../models/LogAdmin');
const { gerarLogsCsv, gerarLogsExcelHtml, montarRelatorioLogsParaPdf } = require('../../services/logsExportService');
const { rotuloModulo, iconeModulo, moduloDaAcao, rotuloAcao, tipoDaAcao, compararDadosAlteracao } = require('../../helpers/logsRotulos');
const { gerarRelatorioPdfBuffer } = require('../../services/pdf/relatorioPdf');
const { logAcao } = require('../../helpers/auditLog');

const ORDENACOES_VALIDAS = ['recentes', 'antigos', 'usuario', 'modulo'];

function extrairFiltrosLogs(query) {
  const ordenar = String(query.ordenar || '').trim();
  return {
    acao: String(query.acao || '').trim(),
    modulo: String(query.modulo || '').trim(),
    usuarioId: String(query.usuarioId || '').trim(),
    dataInicio: String(query.dataInicio || '').trim(),
    dataFim: String(query.dataFim || '').trim(),
    busca: String(query.busca || '').trim(),
    ordenar: ORDENACOES_VALIDAS.includes(ordenar) ? ordenar : 'recentes',
  };
}

exports.pagina = async (req, res) => {
  const filtros = extrairFiltrosLogs(req.query);
  try {
    const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);
    const limite = 20;
    const offset = (pagina - 1) * limite;

    const [logs, total, acoesDisponiveis, modulosDisponiveis, usuariosDisponiveis, estatisticas] = await Promise.all([
      LogAdmin.findAllAdmin({ ...filtros, limite, offset }),
      LogAdmin.contar(filtros),
      LogAdmin.acoesDistintas(),
      LogAdmin.modulosDistintos(),
      LogAdmin.usuariosDistintos(),
      LogAdmin.estatisticas(),
    ]);

    res.render('pages/admin/logs', {
      logs, ...filtros, acoesDisponiveis, modulosDisponiveis, usuariosDisponiveis, estatisticas,
      pagina, totalPaginas: Math.max(1, Math.ceil(total / limite)), total, secaoAtual: 'logs', erro: false,
      rotuloAcao, rotuloModulo, iconeModulo, moduloDaAcao, tipoDaAcao,
    });
  } catch (err) {
    console.error('Erro ao listar logs:', err.message);
    res.render('pages/admin/logs', {
      logs: [], ...filtros, acoesDisponiveis: [], modulosDisponiveis: [], usuariosDisponiveis: [],
      estatisticas: { hoje: 0, semana: 0, mes: 0, usuarioMaisAtivo: null, usuarioMaisAtivoTotal: 0, produtos: 0, pedidos: 0, cupons: 0, clientes: 0, comentarios: 0, banners: 0 },
      pagina: 1, totalPaginas: 1, total: 0, secaoAtual: 'logs', erro: true,
      rotuloAcao, rotuloModulo, iconeModulo, moduloDaAcao, tipoDaAcao,
    });
  }
};

exports.comprovante = async (req, res) => {
  try {
    const log = await LogAdmin.buscarPorId(req.params.id);
    if (!log) return res.status(404).send('Registro de auditoria não encontrado.');
    res.render('partials/shared/logs-comprovante', { log, rotuloModulo, iconeModulo, moduloDaAcao, rotuloAcao, compararDadosAlteracao }, (err, html) => {
      if (err) { console.error('Erro ao renderizar comprovante:', err.message); return res.status(500).send('Erro ao gerar o comprovante.'); }
      res.send(html);
    });
  } catch (err) {
    console.error('Erro ao buscar comprovante de log:', err.message);
    res.status(500).send('Erro ao gerar o comprovante.');
  }
};

exports.exportar = async (req, res) => {
  const formato = req.params.formato;
  if (!['csv', 'excel', 'pdf'].includes(formato)) return res.status(400).send('Formato de exportação inválido.');

  const filtros = extrairFiltrosLogs(req.query);
  try {
    const logs = await LogAdmin.findAllAdmin({ ...filtros, limite: 5000, offset: 0 });
    const agora = new Date().toISOString().slice(0, 10);

    if (formato === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="logs-auditoria-${agora}.csv"`);
      return res.send(gerarLogsCsv(logs));
    }

    if (formato === 'excel') {
      res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="logs-auditoria-${agora}.xls"`);
      return res.send(gerarLogsExcelHtml(logs));
    }

    const periodoLabel = (filtros.dataInicio || filtros.dataFim)
      ? `${filtros.dataInicio || 'início'} a ${filtros.dataFim || 'hoje'}`
      : 'Todo o período';
    const relatorio = montarRelatorioLogsParaPdf(logs, periodoLabel);
    const pdfBuffer = await gerarRelatorioPdfBuffer(relatorio);
    logAcao(req, 'logs.exportar', `Exportação em PDF — ${logs.length} registro(s)`);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="logs-auditoria-${agora}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Erro ao exportar logs:', err.message);
    res.status(500).send('Não foi possível exportar os logs agora.');
  }
};
