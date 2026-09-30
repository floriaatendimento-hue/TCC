'use strict';

const { rotuloAcao, rotuloModulo, moduloDaAcao } = require('../helpers/logsRotulos');

const dataHoraFmt = (d) => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(d));

function neutralizarFormula(valor) {
  if (typeof valor === 'string' && /^[=+\-@\t\r]/.test(valor)) return `'${valor}`;
  return valor;
}

function celulaCsv(valor) {
  const texto = String(neutralizarFormula(valor) ?? '');
  if (/[",;\n]/.test(texto)) return `"${texto.replace(/"/g, '""')}"`;
  return texto;
}

function escaparHtml(texto) {
  return String(texto ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function linhasTabulares(logs) {
  return logs.map(l => ({
    id: l.id,
    quando: dataHoraFmt(l.criado_em),
    administrador: l.usuario_nome || '—',
    modulo: rotuloModulo(moduloDaAcao(l.acao)),
    acao: rotuloAcao(l.acao),
    detalhes: l.detalhes || '—',
    ip: l.ip || '—',
    navegador: l.navegador || '—',
    sistema_operacional: l.sistema_operacional || '—',
    dispositivo: l.dispositivo || '—',
  }));
}

function gerarLogsCsv(logs) {
  const cabecalho = ['ID', 'Quando', 'Administrador', 'Módulo', 'Ação', 'Detalhes', 'IP', 'Navegador', 'Sistema Operacional', 'Dispositivo'];
  const linhas = linhasTabulares(logs).map(r => [
    r.id, r.quando, r.administrador, r.modulo, r.acao, r.detalhes, r.ip, r.navegador, r.sistema_operacional, r.dispositivo,
  ].map(celulaCsv).join(','));
  return '﻿' + [cabecalho.map(celulaCsv).join(','), ...linhas].join('\r\n');
}

function gerarLogsExcelHtml(logs) {
  const cabecalho = ['ID', 'Quando', 'Administrador', 'Módulo', 'Ação', 'Detalhes', 'IP', 'Navegador', 'Sistema Operacional', 'Dispositivo'];
  const linhasHtml = linhasTabulares(logs).map(r => `<tr>${
    [r.id, r.quando, r.administrador, r.modulo, r.acao, r.detalhes, r.ip, r.navegador, r.sistema_operacional, r.dispositivo]
      .map(v => `<td>${escaparHtml(neutralizarFormula(v))}</td>`).join('')
  }</tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body>
<table border="1">
  <thead><tr>${cabecalho.map(c => `<th>${escaparHtml(c)}</th>`).join('')}</tr></thead>
  <tbody>${linhasHtml}</tbody>
</table>
</body></html>`;
}

function montarRelatorioLogsParaPdf(logs, periodoLabel) {
  const colunas = [
    { chave: 'quando', rotulo: 'Quando', alinhar: 'esq' },
    { chave: 'administrador', rotulo: 'Administrador', alinhar: 'esq' },
    { chave: 'modulo', rotulo: 'Módulo', alinhar: 'esq' },
    { chave: 'acao', rotulo: 'Ação', alinhar: 'esq' },
    { chave: 'detalhes', rotulo: 'Detalhes', alinhar: 'esq' },
  ];
  const linhas = linhasTabulares(logs).map(r => ({
    quando: { texto: r.quando, valor: r.quando },
    administrador: { texto: r.administrador, valor: r.administrador },
    modulo: { texto: r.modulo, valor: r.modulo },
    acao: { texto: r.acao, valor: r.acao },
    detalhes: { texto: r.detalhes, valor: r.detalhes },
  }));
  return {
    titulo: 'Logs do Sistema — Auditoria',
    subtitulo: 'Histórico de ações administrativas registradas no painel.',
    periodoLabel,
    colunas,
    linhas,
    resumo: [{ rotulo: 'Total de registros', valor: logs.length }],
  };
}

module.exports = { gerarLogsCsv, gerarLogsExcelHtml, montarRelatorioLogsParaPdf };
