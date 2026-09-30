'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'public', 'imagens', 'logoflor.png');

const VERDE = '#0E3124';
const DOURADO = '#b8945f';
const CINZA = '#5a5a4a';
const CINZA_CLARO = '#9a9a8a';
const LINHA = '#F2F2F0';
const CABECALHO_BG = '#f4f1ea';

function calcularLarguras(colunas, larguraUtil) {
  const pesos = colunas.map((c, i) => (i === 0 ? 1.6 : c.alinhar === 'num' ? 0.9 : 1.2));
  const somaPesos = pesos.reduce((s, p) => s + p, 0);
  return pesos.map(p => (larguraUtil * p) / somaPesos);
}

function gerarRelatorioPdfBuffer(relatorio) {
  return new Promise((resolve, reject) => {
    try {
      const { titulo, subtitulo, periodoLabel, colunas, linhas, resumo } = relatorio;
      const layout = colunas.length > 6 ? 'landscape' : 'portrait';
      const doc = new PDFDocument({ size: 'A4', layout, margin: 50, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const xEsq = doc.page.margins.left;
      const xDir = doc.page.width - doc.page.margins.right;

      // Cabeçalho
      let yTopo = 50;
      if (fs.existsSync(LOGO_PATH)) {
        try { doc.image(LOGO_PATH, xEsq, yTopo - 4, { width: 34 }); } catch {   }
      }
      doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(17).text('Floria', xEsq + 42, yTopo);
      doc.fillColor(CINZA_CLARO).font('Helvetica').fontSize(8.5).text('Plantas & Vasos', xEsq + 42, yTopo + 21);

      doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(14).text(titulo, xEsq, yTopo, { width: larguraUtil, align: 'right' });
      doc.fillColor(CINZA).font('Helvetica').fontSize(9)
        .text(`Período: ${periodoLabel}`, xEsq, yTopo + 19, { width: larguraUtil, align: 'right' })
        .text(`Gerado em ${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, xEsq, yTopo + 32, { width: larguraUtil, align: 'right' });

      let y = yTopo + 54;
      doc.strokeColor(VERDE).lineWidth(1.4).moveTo(xEsq, y).lineTo(xDir, y).stroke();
      y += 10;

      if (subtitulo) {
        doc.fillColor(CINZA_CLARO).font('Helvetica-Oblique').fontSize(8.5).text(subtitulo, xEsq, y, { width: larguraUtil });
        y += doc.heightOfString(subtitulo, { width: larguraUtil }) + 10;
      }

      // Faixa de resumo
      if (resumo && resumo.length) {
        const porLinha = Math.min(4, resumo.length);
        const largItem = larguraUtil / porLinha;
        resumo.forEach((item, i) => {
          const col = i % porLinha;
          if (i > 0 && col === 0) y += 34;
          const x = xEsq + col * largItem;
          doc.fillColor(DOURADO).font('Helvetica-Bold').fontSize(7.5).text(item.rotulo.toUpperCase(), x, y, { width: largItem - 10 });
          doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(12).text(String(item.valor), x, y + 11, { width: largItem - 10 });
        });
        y += 34;
        doc.strokeColor(LINHA).lineWidth(1).moveTo(xEsq, y).lineTo(xDir, y).stroke();
        y += 14;
      }

      // Tabela
      const larguras = calcularLarguras(colunas, larguraUtil);
      const xColunas = [];
      let xAcc = xEsq;
      larguras.forEach(l => { xColunas.push(xAcc); xAcc += l; });

      function cabecalhoTabela() {
        doc.rect(xEsq, y - 3, larguraUtil, 18).fill(CABECALHO_BG);
        doc.fillColor(CINZA).font('Helvetica-Bold').fontSize(7.8);
        colunas.forEach((c, i) => {
          doc.text(c.rotulo.toUpperCase(), xColunas[i] + 4, y, { width: larguras[i] - 8, align: c.alinhar === 'num' ? 'right' : 'left' });
        });
        y += 18;
        doc.strokeColor(LINHA).lineWidth(1).moveTo(xEsq, y).lineTo(xDir, y).stroke();
        y += 6;
      }
      cabecalhoTabela();

      const alturaLinha = 15;
      const somasMoeda = {};
      colunas.forEach(c => { if (c.tipo === 'moeda') somasMoeda[c.chave] = 0; });

      doc.font('Helvetica').fontSize(8).fillColor('#1a1a1a');
      linhas.forEach((linha, idx) => {
        if (y > doc.page.height - doc.page.margins.bottom - 70) {
          doc.addPage();
          y = doc.page.margins.top;
          cabecalhoTabela();
        }
        if (idx % 2 === 1) doc.rect(xEsq, y - 2, larguraUtil, alturaLinha).fill('#faf9f5');
        doc.fillColor('#1a1a1a').font('Helvetica').fontSize(8);
        colunas.forEach((c, i) => {
          const cel = linha[c.chave] || { texto: '-', valor: 0 };
          doc.text(cel.texto, xColunas[i] + 4, y, {
            width: larguras[i] - 8,
            align: c.alinhar === 'num' ? 'right' : 'left',
            height: alturaLinha,
            ellipsis: true,
            lineBreak: false,
          });
          if (c.tipo === 'moeda') somasMoeda[c.chave] += Number(cel.valor) || 0;
        });
        y += alturaLinha;
      });

      doc.strokeColor(LINHA).lineWidth(0.5).moveTo(xEsq, y).lineTo(xDir, y).stroke();

      if (!linhas.length) {
        y += 10;
        doc.fillColor(CINZA_CLARO).font('Helvetica-Oblique').fontSize(9).text('Nenhum registro encontrado para o período selecionado.', xEsq, y, { width: larguraUtil, align: 'center' });
        y += 20;
      }

      // Totais por coluna monetária
      const colunasMoeda = colunas.filter(c => c.tipo === 'moeda');
      if (linhas.length && colunasMoeda.length) {
        y += 4;
        if (y > doc.page.height - doc.page.margins.bottom - 40) {
          doc.addPage();
          y = doc.page.margins.top;
        }
        doc.font('Helvetica-Bold').fontSize(8.5).fillColor(VERDE);
        colunas.forEach((c, i) => {
          if (i === 0) {
            doc.text('TOTAL', xColunas[i] + 4, y, { width: larguras[i] - 8 });
          } else if (c.tipo === 'moeda') {
            const soma = somasMoeda[c.chave] || 0;
            const partes = soma.toFixed(2).split('.');
            partes[0] = partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
            doc.text('R$ ' + partes.join(','), xColunas[i] + 4, y, { width: larguras[i] - 8, align: 'right' });
          }
        });
        y += 20;
      }

      // Rodapé
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.strokeColor(LINHA).lineWidth(0.5)
          .moveTo(xEsq, doc.page.height - 42).lineTo(xDir, doc.page.height - 42).stroke();
        doc.fillColor(CINZA_CLARO).font('Helvetica').fontSize(7.5)
          .text('Floria Plantas & Vasos: Relatório gerado pelo painel administrativo.', xEsq, doc.page.height - 34, { width: larguraUtil - 100 });
        doc.text(`Página ${i - range.start + 1} de ${range.count}`, xDir - 100, doc.page.height - 34, { width: 100, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerarRelatorioPdfBuffer };
