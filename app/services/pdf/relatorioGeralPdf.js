'use strict';

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { moeda } = require('../relatorios/relatoriosService');

const LOGO_PATH = path.join(__dirname, '..', 'public', 'imagens', 'logoflor.png');

const VERDE = '#0E3124';
const VERDE_MEDIO = '#154030';
const DOURADO = '#b8945f';
const CINZA = '#5a5a4a';
const CINZA_CLARO = '#9a9a8a';
const LINHA = '#F2F2F0';
const CABECALHO_BG = '#f4f1ea';
const SUCESSO = '#2d7a58';
const ERRO = '#c0392b';
const CORES_PIZZA = [DOURADO, VERDE_MEDIO, VERDE, '#2c5896', '#9e7a46'];

function desenharFatiaPizza(doc, cx, cy, raio, anguloInicioGraus, anguloFimGraus, cor) {
  const passos = Math.max(2, Math.ceil((anguloFimGraus - anguloInicioGraus) / 4));
  doc.moveTo(cx, cy);
  for (let i = 0; i <= passos; i++) {
    const grau = anguloInicioGraus + (anguloFimGraus - anguloInicioGraus) * (i / passos) - 90;
    const rad = (grau * Math.PI) / 180;
    doc.lineTo(cx + raio * Math.cos(rad), cy + raio * Math.sin(rad));
  }
  doc.closePath().fill(cor);
}

function gerarRelatorioGeralPdfBuffer(relatorio) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const xEsq = doc.page.margins.left;
      const xDir = doc.page.width - doc.page.margins.right;
      let y = doc.page.margins.top;

      const espacoDisponivel = () => doc.page.height - doc.page.margins.bottom - y;
      function quebrarSeNecessario(alturaMinima) {
        if (espacoDisponivel() < alturaMinima) {
          doc.addPage();
          y = doc.page.margins.top;
        }
      }

      // Cabeçalho do documento
      let yTopo = y;
      if (fs.existsSync(LOGO_PATH)) {
        try { doc.image(LOGO_PATH, xEsq, yTopo - 4, { width: 34 }); } catch {   }
      }
      doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(17).text('Floria', xEsq + 42, yTopo);
      doc.fillColor(CINZA_CLARO).font('Helvetica').fontSize(8.5).text('Plantas & Vasos', xEsq + 42, yTopo + 21);

      doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(14).text('Relatório Geral da Loja', xEsq, yTopo, { width: larguraUtil, align: 'right' });
      doc.fillColor(CINZA).font('Helvetica').fontSize(9)
        .text(`Período analisado: ${relatorio.periodoLabel}`, xEsq, yTopo + 19, { width: larguraUtil, align: 'right' })
        .text(`Emitido em ${relatorio.geradoEm.toLocaleDateString('pt-BR')} às ${relatorio.geradoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`, xEsq, yTopo + 32, { width: larguraUtil, align: 'right' });

      y = yTopo + 54;
      doc.strokeColor(VERDE).lineWidth(1.4).moveTo(xEsq, y).lineTo(xDir, y).stroke();
      y += 14;

      // Helpers de conteúdo

      function tituloSecao(titulo, subtitulo) {
        quebrarSeNecessario(55);
        doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(13).text(titulo, xEsq, y, { width: larguraUtil });
        y += doc.heightOfString(titulo, { width: larguraUtil }) + 2;
        if (subtitulo) {
          doc.fillColor(CINZA_CLARO).font('Helvetica-Oblique').fontSize(8).text(subtitulo, xEsq, y, { width: larguraUtil });
          y += doc.heightOfString(subtitulo, { width: larguraUtil }) + 4;
        }
        doc.strokeColor(DOURADO).lineWidth(1.2).moveTo(xEsq, y).lineTo(xEsq + 36, y).stroke();
        y += 12;
      }

      function faixaResumo(itens) {
        if (!itens || !itens.length) return;
        quebrarSeNecessario(46);
        const porLinha = Math.min(4, itens.length);
        const largItem = larguraUtil / porLinha;
        itens.forEach((item, i) => {
          const col = i % porLinha;
          if (i > 0 && col === 0) y += 40;
          const x = xEsq + col * largItem;
          doc.fillColor(DOURADO).font('Helvetica-Bold').fontSize(7.5).text(String(item.rotulo).toUpperCase(), x, y, { width: largItem - 10 });
          doc.fillColor(VERDE).font('Helvetica-Bold').fontSize(12).text(String(item.valor), x, y + 11, { width: largItem - 10 });
          if (item.variacao !== undefined && item.variacao !== null) {
            const cor = item.variacao >= 0 ? SUCESSO : ERRO;
            const seta = item.variacao >= 0 ? '▲' : '▼';
            doc.fillColor(cor).font('Helvetica-Bold').fontSize(8)
              .text(`${seta} ${Math.abs(item.variacao).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`, x, y + 25, { width: largItem - 10 });
          }
        });
        y += 40;
        doc.strokeColor(LINHA).lineWidth(1).moveTo(xEsq, y).lineTo(xDir, y).stroke();
        y += 12;
      }

      function calcularLarguras(colunas) {
        const pesos = colunas.map((c, i) => (i === 0 ? 1.6 : c.alinhar === 'num' ? 0.9 : 1.2));
        const soma = pesos.reduce((s, p) => s + p, 0);
        return pesos.map(p => (larguraUtil * p) / soma);
      }

      function tabela(colunas, linhas) {
        if (!linhas || !linhas.length) {
          quebrarSeNecessario(20);
          doc.fillColor(CINZA_CLARO).font('Helvetica-Oblique').fontSize(8.5)
            .text('Nenhum registro encontrado para o período selecionado.', xEsq, y, { width: larguraUtil });
          y += 18;
          return;
        }

        const larguras = calcularLarguras(colunas);
        const xColunas = [];
        let xAcc = xEsq;
        larguras.forEach(l => { xColunas.push(xAcc); xAcc += l; });

        function cabecalhoTabela() {
          if (espacoDisponivel() < 30) { doc.addPage(); y = doc.page.margins.top; }
          doc.rect(xEsq, y - 3, larguraUtil, 16).fill(CABECALHO_BG);
          doc.fillColor(CINZA).font('Helvetica-Bold').fontSize(7);
          colunas.forEach((c, i) => {
            doc.text(c.rotulo.toUpperCase(), xColunas[i] + 4, y, { width: larguras[i] - 8, align: c.alinhar === 'num' ? 'right' : 'left' });
          });
          y += 16;
          doc.strokeColor(LINHA).lineWidth(1).moveTo(xEsq, y).lineTo(xDir, y).stroke();
          y += 5;
        }
        cabecalhoTabela();

        const alturaLinha = 13;
        linhas.forEach((linha, idx) => {
          if (espacoDisponivel() < alturaLinha + 20) {
            doc.addPage();
            y = doc.page.margins.top;
            cabecalhoTabela();
          }
          if (idx % 2 === 1) doc.rect(xEsq, y - 2, larguraUtil, alturaLinha).fill('#faf9f5');
          doc.fillColor('#1a1a1a').font('Helvetica').fontSize(7.2);
          colunas.forEach((c, i) => {
            const cel = linha[c.chave] || { texto: '-' };
            doc.text(cel.texto, xColunas[i] + 4, y, {
              width: larguras[i] - 8,
              align: c.alinhar === 'num' ? 'right' : 'left',
              height: alturaLinha,
              ellipsis: true,
              lineBreak: false,
            });
          });
          y += alturaLinha;
        });
        y += 10;
      }

      function graficoBarraVertical(serie) {
        if (!serie || !serie.length) return;
        const alturaGrafico = 120;
        quebrarSeNecessario(alturaGrafico + 30);
        const maior = Math.max(1, ...serie.map(d => d.total));
        const n = serie.length;
        const larguraBarra = Math.min(16, (larguraUtil / n) * 0.55);
        const espaco = larguraUtil / n;
        const baseY = y + alturaGrafico;
        serie.forEach((dia, i) => {
          const alturaBarra = maior > 0 ? (dia.total / maior) * (alturaGrafico - 16) : 0;
          const x = xEsq + i * espaco + (espaco - larguraBarra) / 2;
          doc.rect(x, baseY - alturaBarra, larguraBarra, Math.max(alturaBarra, 1)).fill(DOURADO);
        });
        doc.strokeColor(LINHA).lineWidth(0.5).moveTo(xEsq, baseY).lineTo(xDir, baseY).stroke();
        const passoLabel = Math.max(1, Math.ceil(n / 14));
        doc.fillColor(CINZA_CLARO).font('Helvetica').fontSize(6.5);
        serie.forEach((dia, i) => {
          if (i % passoLabel !== 0) return;
          const x = xEsq + i * espaco + espaco / 2;
          const rotulo = new Date(dia.dia).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
          doc.text(rotulo, x - 10, baseY + 3, { width: 20, align: 'center' });
        });
        y = baseY + 16;
      }

      function graficoBarraHorizontal(dados) {
        if (!dados || !dados.length) return;
        const alturaLinha = 15;
        const alturaBloco = dados.length * alturaLinha + 6;
        quebrarSeNecessario(alturaBloco + 16);
        const margemEsq = 150;
        const larguraDisp = larguraUtil - margemEsq - 36;
        const maior = Math.max(1, ...dados.map(d => d.valor));
        dados.forEach((d, i) => {
          const barY = y + i * alturaLinha;
          const largura = maior > 0 ? (d.valor / maior) * larguraDisp : 0;
          const nomeCurto = d.nome.length > 26 ? d.nome.slice(0, 26) + '…' : d.nome;
          doc.fillColor(CINZA).font('Helvetica').fontSize(7)
            .text(nomeCurto, xEsq, barY + 2, { width: margemEsq - 8, align: 'right' });
          doc.rect(xEsq + margemEsq, barY, Math.max(largura, 2), 10).fill(DOURADO);
          doc.fillColor(CINZA).font('Helvetica').fontSize(7)
            .text(String(d.valor), xEsq + margemEsq + largura + 4, barY + 1);
        });
        y += alturaBloco + 10;
      }

      function graficoPizza(dados) {
        if (!dados || !dados.length) return;
        const raio = 50;
        const alturaBloco = raio * 2 + 16;
        quebrarSeNecessario(alturaBloco + 16);
        const cx = xEsq + raio + 6;
        const cy = y + raio + 4;
        const total = dados.reduce((s, d) => s + d.valor, 0) || 1;
        let anguloAtual = 0;
        dados.forEach((d, i) => {
          const fatia = (d.valor / total) * 360;
          desenharFatiaPizza(doc, cx, cy, raio, anguloAtual, anguloAtual + fatia, CORES_PIZZA[i % CORES_PIZZA.length]);
          anguloAtual += fatia;
        });
        const legX = cx + raio + 22;
        let legY = y + 6;
        dados.forEach((d, i) => {
          doc.rect(legX, legY, 8, 8).fill(CORES_PIZZA[i % CORES_PIZZA.length]);
          doc.fillColor(CINZA).font('Helvetica').fontSize(7.5)
            .text(`${d.nome} - ${d.valor}`, legX + 12, legY - 1, { width: larguraUtil - (legX - xEsq) - 12 });
          legY += 14;
        });
        y += alturaBloco;
      }

      function paragrafos(lista) {
        lista.forEach(texto => {
          quebrarSeNecessario(22);
          doc.circle(xEsq + 2.5, y + 4.5, 1.5).fill(DOURADO);
          doc.fillColor('#333').font('Helvetica').fontSize(9).text(texto, xEsq + 10, y, { width: larguraUtil - 10 });
          y += doc.heightOfString(texto, { width: larguraUtil - 10 }) + 6;
        });
        y += 4;
      }

      function paragrafo(texto) {
        quebrarSeNecessario(30);
        doc.fillColor('#333').font('Helvetica').fontSize(9.5).text(texto, xEsq, y, { width: larguraUtil, lineGap: 2 });
        y += doc.heightOfString(texto, { width: larguraUtil }) + 10;
      }

      tituloSecao('1. Resumo Executivo', 'Principais números do período, comparados ao período anterior de mesma duração.');
      faixaResumo(relatorio.resumoExecutivo.indicadores);

      tituloSecao('2. Indicadores Gerais');
      faixaResumo(relatorio.indicadoresGerais);

      tituloSecao('3. Relatório de Vendas', 'Itens vendidos em pedidos com pagamento aprovado no período.');
      faixaResumo(relatorio.vendas.resumo);
      tabela(relatorio.vendas.colunas, relatorio.vendas.linhas);

      tituloSecao('4. Produtos Mais Vendidos', 'Ranking por unidades vendidas em pedidos aprovados no período.');
      graficoBarraHorizontal(relatorio.maisVendidos.grafico);
      tabela(relatorio.maisVendidos.colunas, relatorio.maisVendidos.linhas);

      tituloSecao('5. Produtos Mais Pesquisados', 'Termos digitados na busca do site no período.');
      tabela(relatorio.maisPesquisados.colunas, relatorio.maisPesquisados.linhas);

      tituloSecao('6. Categorias Mais Acessadas', 'Visitas às páginas de categoria do site no período.');
      graficoPizza(relatorio.categoriasAcessadas.grafico);
      tabela(relatorio.categoriasAcessadas.colunas, relatorio.categoriasAcessadas.linhas);

      tituloSecao('7. Clientes Cadastrados', 'Clientes que se cadastraram na loja durante o período.');
      tabela(relatorio.clientes.colunas, relatorio.clientes.linhas);

      tituloSecao('8. Estoque', 'Movimentações de estoque registradas no período.');
      tabela(relatorio.estoque.colunas, relatorio.estoque.linhas);

      tituloSecao('9. Faturamento', 'Faturamento diário de pedidos com pagamento aprovado no período.');
      graficoBarraVertical(relatorio.faturamento.serie);
      faixaResumo(relatorio.faturamento.resumo);

      tituloSecao('10. Ticket Médio');
      faixaResumo([{ rotulo: 'Ticket médio do período', valor: moeda(relatorio.ticketMedio.valor), variacao: relatorio.ticketMedio.variacao }]);

      tituloSecao('11. Pedidos Concluídos', 'Pedidos entregues, dentre os criados no período.');
      tabela(relatorio.pedidosConcluidos.colunas, relatorio.pedidosConcluidos.linhas);

      tituloSecao('12. Pedidos Pendentes', 'Pedidos ainda em andamento, dentre os criados no período.');
      tabela(relatorio.pedidosPendentes.colunas, relatorio.pedidosPendentes.linhas);

      tituloSecao('13. Pedidos Cancelados', 'Pedidos cancelados no período, pela data do cancelamento.');
      tabela(relatorio.pedidosCancelados.colunas, relatorio.pedidosCancelados.linhas);

      tituloSecao('14. Análise Geral');
      paragrafos(relatorio.analiseGeral);

      tituloSecao('15. Recomendações');
      paragrafos(relatorio.recomendacoes);

      tituloSecao('16. Conclusão');
      paragrafo(relatorio.conclusao);

      // Rodapé
      const range = doc.bufferedPageRange();
      for (let i = range.start; i < range.start + range.count; i++) {
        doc.switchToPage(i);
        doc.strokeColor(LINHA).lineWidth(0.5)
          .moveTo(xEsq, doc.page.height - 42).lineTo(xDir, doc.page.height - 42).stroke();
        doc.fillColor(CINZA_CLARO).font('Helvetica').fontSize(7.5)
          .text('Floria Plantas & Vasos: Relatório Geral gerado pelo painel administrativo.', xEsq, doc.page.height - 34, { width: larguraUtil - 100 });
        doc.text(`Página ${i - range.start + 1} de ${range.count}`, xDir - 100, doc.page.height - 34, { width: 100, align: 'right' });
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerarRelatorioGeralPdfBuffer };
