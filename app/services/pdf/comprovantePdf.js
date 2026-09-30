'use strict';

const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const LOGO_PATH = path.join(__dirname, '..', 'public', 'imagens', 'logoflor.png');

const VERDE_ESCURO = '#0E3124';
const VERDE_MEDIO  = '#154030';
const DOURADO      = '#b8945f';
const CREME        = '#FFFFFF';
const BRANCO       = '#ffffff';
const TEXTO        = '#1a1a1a';
const TEXTO_SUAVE  = '#5a5a4a';
const TEXTO_FRACO  = '#9a9a8a';
const BORDA        = '#F2F2F0';

const ESTILO_STATUS_PAGAMENTO = {
  pendente:    { bg: '#fdf3e3', fg: '#8a5a12' },
  processando: { bg: '#e7eef7', fg: '#2c5896' },
  aprovado:    { bg: '#e8f5ee', fg: '#2d7a58' },
  recusado:    { bg: '#fdf0ef', fg: '#c0392b' },
  expirado:    { bg: '#F2F2F0', fg: '#5a5a4a' },
  estornado:   { bg: '#F2F2F0', fg: '#5a5a4a' },
};

const DESTAQUE_TOTAL_POR_STATUS = {
  pendente:    { rotulo: 'TOTAL A PAGAR',    cor: '#6b4a1a' },
  processando: { rotulo: 'TOTAL A PAGAR',    cor: '#1d3a5f' },
  aprovado:    { rotulo: 'TOTAL PAGO',       cor: VERDE_ESCURO },
  recusado:    { rotulo: 'VALOR DO PEDIDO',  cor: '#7a2419' },
  expirado:    { rotulo: 'VALOR DO PEDIDO',  cor: '#4a4a42' },
  estornado:   { rotulo: 'VALOR REEMBOLSADO', cor: '#4a4a42' },
};

const fmt = (v) => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function fmtData(d, comHora) {
  if (!d) return null;
  const dt = new Date(d);
  const data = dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (!comHora) return data;
  return data + ' às ' + dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtCpf(cpf) {
  const d = String(cpf || '').replace(/\D/g, '');
  if (d.length !== 11) return null;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function fmtTelefone(tel) {
  const d = String(tel || '').replace(/\D/g, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return tel || null;
}

const ROTULO_FORMA_PAGTO = {
  credito: 'Cartão de crédito',
  debito: 'Cartão de débito',
  pix: 'Pix',
  boleto: 'Boleto bancário',
};

function gerarComprovantePdfBuffer(pedido, comprovante, rotulosStatusPagamento, opts = {}) {
  return new Promise(async (resolve, reject) => {
    try {
      const lojaNome = opts.lojaNome || 'Floria';
      const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const larguraUtil = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const xEsq = doc.page.margins.left;
      const xDir = doc.page.width - doc.page.margins.right;
      const maxY = () => doc.page.height - doc.page.margins.bottom;

      /* Helpers de desenho */

      function pill(texto, xDireita, yTopo, estilo, fontSize = 9.5) {
        doc.font('Helvetica-Bold').fontSize(fontSize);
        const largura = doc.widthOfString(texto) + 22;
        const altura = fontSize + 11;
        const x = xDireita - largura;
        doc.roundedRect(x, yTopo, largura, altura, altura / 2).fill(estilo.bg);
        doc.fillColor(estilo.fg).text(texto, x, yTopo + (altura - fontSize) / 2 - 1, { width: largura, align: 'center' });
        return altura;
      }

      function selo(cx, cy, cor) {
        doc.save();
        doc.circle(cx, cy, 7).lineWidth(1.3).stroke(cor);
        doc.moveTo(cx - 3.2, cy).lineTo(cx - 0.6, cy + 3).lineTo(cx + 3.6, cy - 3.4)
          .lineWidth(1.4).stroke(cor);
        doc.restore();
      }

      function linhaDivisoria(yPos, cor = BORDA, espessura = 1) {
        doc.strokeColor(cor).lineWidth(espessura).moveTo(xEsq, yPos).lineTo(xDir, yPos).stroke();
      }

      function tituloSecao(texto, x, yPos, largura = larguraUtil) {
        doc.fillColor(DOURADO).font('Helvetica-Bold').fontSize(8.5)
          .text(texto.toUpperCase(), x, yPos, { width: largura, characterSpacing: 0.4 });
      }

      function garantirEspaco(alturaNecessaria) {
        if (y + alturaNecessaria > maxY()) {
          doc.addPage();
          y = doc.page.margins.top;
          return true;
        }
        return false;
      }

      // Barra superior discreta
      doc.rect(0, 0, doc.page.width, 5).fill(VERDE_ESCURO);

      // Cabeçalho
      let y = 40;
      const yTopo = y;
      if (fs.existsSync(LOGO_PATH)) {
        try { doc.image(LOGO_PATH, xEsq, yTopo - 2, { width: 34 }); } catch {   }
      }
      doc.fillColor(VERDE_ESCURO).font('Helvetica-Bold').fontSize(19).text(lojaNome, xEsq + 42, yTopo - 3);
      doc.fillColor(TEXTO_FRACO).font('Helvetica').fontSize(8.5).text('Comprovante de pagamento', xEsq + 42, yTopo + 19);

      doc.fillColor(TEXTO_SUAVE).font('Helvetica-Bold').fontSize(8).text('COMPROVANTE DE PAGAMENTO', xEsq, yTopo - 2, { width: larguraUtil, align: 'right', characterSpacing: 0.5 });
      doc.fillColor(VERDE_ESCURO).font('Helvetica-Bold').fontSize(15).text(`Pedido #${pedido.id}`, xEsq, yTopo + 9, { width: larguraUtil, align: 'right' });
      doc.fillColor(TEXTO_FRACO).font('Helvetica').fontSize(8)
        .text(`Emitido em ${fmtData(new Date(), true)}`, xEsq, yTopo + 28, { width: larguraUtil, align: 'right' });

      const statusPag = pedido.status_pagamento || 'aprovado';
      const rotuloStatusPag = (rotulosStatusPagamento && rotulosStatusPagamento[statusPag]) || statusPag;
      const estiloStatus = ESTILO_STATUS_PAGAMENTO[statusPag] || ESTILO_STATUS_PAGAMENTO.expirado;
      const yPill = yTopo + 41;
      pill(rotuloStatusPag.toUpperCase(), xDir, yPill, estiloStatus);
      if (statusPag === 'aprovado') selo(xDir - doc.widthOfString(rotuloStatusPag.toUpperCase()) - 34, yPill + 10, estiloStatus.fg);

      y = yTopo + 66;
      linhaDivisoria(y, VERDE_ESCURO, 1.6);
      y += 18;

      // Cliente + Endereço
      const temEndereco = !!pedido.end_logradouro;
      const cpfFmt = fmtCpf(pedido.cliente_cpf);
      const telFmt = fmtTelefone(pedido.cliente_telefone);

      const linhasCliente = [pedido.cliente_nome || '-', pedido.cliente_email || '-'];
      if (telFmt) linhasCliente.push(telFmt);
      if (cpfFmt) linhasCliente.push(`CPF ${cpfFmt}`);

      const linhasEndereco = [];
      if (temEndereco) {
        if (pedido.end_destinatario) linhasEndereco.push(pedido.end_destinatario);
        const complemento = pedido.end_complemento ? `, ${pedido.end_complemento}` : '';
        linhasEndereco.push(`${pedido.end_logradouro}, ${pedido.end_numero || 'S/N'}${complemento}`);
        if (pedido.end_bairro) linhasEndereco.push(pedido.end_bairro);
        const cidadeUf = [pedido.end_cidade, pedido.end_uf].filter(Boolean).join(' - ');
        if (cidadeUf) linhasEndereco.push(cidadeUf);
        if (pedido.end_cep) linhasEndereco.push(`CEP ${pedido.end_cep}`);
      }

      const alturaCartaoInfo = 30 + Math.max(linhasCliente.length, temEndereco ? linhasEndereco.length : 0) * 13.5;
      garantirEspaco(alturaCartaoInfo + 20);

      const largColCliente = temEndereco ? (larguraUtil - 16) / 2 : larguraUtil;
      doc.roundedRect(xEsq, y, largColCliente, alturaCartaoInfo, 6).fillAndStroke(CREME, BORDA);
      tituloSecao('Dados do cliente', xEsq + 16, y + 12, largColCliente - 32);
      let yLinha = y + 28;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXTO).text(linhasCliente[0], xEsq + 16, yLinha, { width: largColCliente - 32 });
      doc.font('Helvetica').fontSize(9).fillColor(TEXTO_SUAVE);
      for (let i = 1; i < linhasCliente.length; i++) {
        doc.text(linhasCliente[i], xEsq + 16, yLinha + 15 * i, { width: largColCliente - 32 });
      }

      if (temEndereco) {
        const xCol2 = xEsq + largColCliente + 16;
        doc.roundedRect(xCol2, y, largColCliente, alturaCartaoInfo, 6).fillAndStroke(CREME, BORDA);
        tituloSecao('Endereço de entrega', xCol2 + 16, y + 12, largColCliente - 32);
        doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXTO).text(linhasEndereco[0], xCol2 + 16, y + 28, { width: largColCliente - 32 });
        doc.font('Helvetica').fontSize(9).fillColor(TEXTO_SUAVE);
        for (let i = 1; i < linhasEndereco.length; i++) {
          doc.text(linhasEndereco[i], xCol2 + 16, y + 28 + 15 * i, { width: largColCliente - 32 });
        }
      }
      y += alturaCartaoInfo + 16;

      // Pagamento
      const camposPagamento = [];
      camposPagamento.push(['Forma de pagamento', ROTULO_FORMA_PAGTO[pedido.forma_pagto] || pedido.forma_pagto || '-']);
      camposPagamento.push(['Situação', rotuloStatusPag]);
      if (pedido.forma_pagto === 'credito' && Number(pedido.parcelas) > 1) {
        camposPagamento.push(['Parcelamento', `${pedido.parcelas}x de ${fmt(pedido.total / pedido.parcelas)}`]);
      }
      if (pedido.cartao_final) {
        camposPagamento.push(['Cartão', `${pedido.cartao_bandeira ? pedido.cartao_bandeira.charAt(0).toUpperCase() + pedido.cartao_bandeira.slice(1) + ' ' : ''}final ${pedido.cartao_final}`]);
      }
      const dataPagamentoFmt = fmtData(pedido.pagamento_confirmado_em, true);
      if (dataPagamentoFmt) camposPagamento.push(['Data do pagamento', dataPagamentoFmt]);
      camposPagamento.push([statusPag === 'aprovado' ? 'Valor pago' : 'Valor do pedido', fmt(pedido.total)]);
      if (comprovante?.codigo) camposPagamento.push(['Identificador do comprovante', comprovante.codigo]);

      const colsPorLinha = 2;
      const linhasPagamento = Math.ceil(camposPagamento.length / colsPorLinha);
      const alturaCartaoPagamento = 30 + linhasPagamento * 28;
      garantirEspaco(alturaCartaoPagamento + 20);

      doc.roundedRect(xEsq, y, larguraUtil, alturaCartaoPagamento, 6).fillAndStroke(BRANCO, BORDA);
      tituloSecao('Informações de pagamento', xEsq + 16, y + 12, larguraUtil - 32);
      const largCampoPag = (larguraUtil - 32) / colsPorLinha;
      camposPagamento.forEach((campo, i) => {
        const linha = Math.floor(i / colsPorLinha);
        const coluna = i % colsPorLinha;
        const cx = xEsq + 16 + coluna * largCampoPag;
        const cy = y + 30 + linha * 28;
        doc.fillColor(TEXTO_FRACO).font('Helvetica').fontSize(7.8).text(campo[0].toUpperCase(), cx, cy, { width: largCampoPag - 12, characterSpacing: 0.3 });
        doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(10).text(campo[1], cx, cy + 11, { width: largCampoPag - 12 });
      });
      y += alturaCartaoPagamento + 20;

      // Tabela de produtos
      const itens = pedido.itens || [];
      const temVariacao = itens.some((i) => i.cor);

      let colProd, colVar, colQtd, colUnit, colSub;
      if (temVariacao) {
        colProd = larguraUtil * 0.36; colVar = larguraUtil * 0.16; colQtd = larguraUtil * 0.09;
        colUnit = larguraUtil * 0.18; colSub = larguraUtil - colProd - colVar - colQtd - colUnit;
      } else {
        colProd = larguraUtil * 0.46; colVar = 0; colQtd = larguraUtil * 0.1;
        colUnit = larguraUtil * 0.2; colSub = larguraUtil - colProd - colQtd - colUnit;
      }
      const xVar = xEsq + colProd;
      const xQtd = xVar + colVar;
      const xUnit = xQtd + colQtd;
      const xSub = xUnit + colUnit;

      tituloSecao('Produtos do pedido', xEsq, y, larguraUtil);
      y += 16;

      function cabecalhoTabela() {
        doc.roundedRect(xEsq, y, larguraUtil, 22, 4).fill(VERDE_ESCURO);
        doc.fillColor(BRANCO).font('Helvetica-Bold').fontSize(8);
        doc.text('PRODUTO', xEsq + 8, y + 7, { width: colProd - 8 });
        if (temVariacao) doc.text('VARIAÇÃO', xVar, y + 7, { width: colVar - 4 });
        doc.text('QTD', xQtd, y + 7, { width: colQtd - 4, align: 'right' });
        doc.text('VALOR UNIT.', xUnit, y + 7, { width: colUnit - 8, align: 'right' });
        doc.text('TOTAL', xSub, y + 7, { width: colSub - 8, align: 'right' });
        y += 22;
      }
      cabecalhoTabela();

      itens.forEach((item, idx) => {
        doc.font('Helvetica').fontSize(9.3);
        const nomeAltura = doc.heightOfString(item.produto_nome || 'Produto', { width: colProd - 16 });
        const alturaLinha = Math.max(22, nomeAltura + 12);

        if (garantirEspaco(alturaLinha)) cabecalhoTabela();

        if (idx % 2 === 1) doc.rect(xEsq, y, larguraUtil, alturaLinha).fill(CREME);

        doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(9.3).text(item.produto_nome || 'Produto', xEsq + 8, y + 6, { width: colProd - 16 });
        if (temVariacao) doc.fillColor(TEXTO_SUAVE).font('Helvetica').fontSize(9).text(item.cor || '-', xVar, y + 6, { width: colVar - 4 });
        doc.fillColor(TEXTO_SUAVE).font('Helvetica').fontSize(9).text(String(item.quantidade), xQtd, y + 6, { width: colQtd - 4, align: 'right' });
        doc.text(fmt(item.preco_unit), xUnit, y + 6, { width: colUnit - 8, align: 'right' });
        doc.fillColor(TEXTO).font('Helvetica-Bold').fontSize(9.3).text(fmt(item.preco_unit * item.quantidade), xSub, y + 6, { width: colSub - 8, align: 'right' });

        y += alturaLinha;
        linhaDivisoria(y, BORDA, 0.6);
      });

      y += 14;

      // Totais + destaque do valor pago
      const temDesconto = Number(pedido.desconto) > 0;
      const linhasTotalLadder = 2 + (temDesconto ? 1 : 0);
      const alturaBlocoTotais = linhasTotalLadder * 16 + 66;
      garantirEspaco(alturaBlocoTotais + 10);

      const larguraLadder = 230;
      const xLadderLabel = xDir - larguraLadder;
      function linhaTotalLadder(label, valor, destaque) {
        doc.font(destaque ? 'Helvetica-Bold' : 'Helvetica').fontSize(destaque ? 10.5 : 9.5)
          .fillColor(destaque ? VERDE_ESCURO : TEXTO_SUAVE)
          .text(label, xLadderLabel, y, { width: larguraLadder * 0.55 })
          .text(valor, xLadderLabel + larguraLadder * 0.55, y, { width: larguraLadder * 0.45, align: 'right' });
        y += destaque ? 17 : 15;
      }
      linhaTotalLadder('Subtotal', fmt(pedido.subtotal));
      linhaTotalLadder('Frete', Number(pedido.frete) > 0 ? fmt(pedido.frete) : 'Grátis');
      if (temDesconto) linhaTotalLadder(`Desconto${pedido.cupom ? ` (${pedido.cupom})` : ''}`, `− ${fmt(pedido.desconto)}`);

      y += 8;
      const alturaCaixaTotal = 46;
      const destaqueTotal = DESTAQUE_TOTAL_POR_STATUS[statusPag] || DESTAQUE_TOTAL_POR_STATUS.pendente;
      doc.roundedRect(xEsq, y, larguraUtil, alturaCaixaTotal, 6).fill(destaqueTotal.cor);
      doc.fillOpacity(0.72).fillColor(BRANCO).font('Helvetica-Bold').fontSize(9.5).text(destaqueTotal.rotulo, xEsq + 20, y + 12, { characterSpacing: 0.6 });
      doc.fillOpacity(1).fillColor(BRANCO).font('Helvetica-Bold').fontSize(20).text(fmt(pedido.total), xEsq, y + 10, { width: larguraUtil - 20, align: 'right' });
      y += alturaCaixaTotal + 20;

      // Observações
      if (pedido.observacoes) {
        doc.font('Helvetica').fontSize(9.5);
        const alturaObs = doc.heightOfString(pedido.observacoes, { width: larguraUtil - 32 });
        const alturaCartaoObs = alturaObs + 40;
        garantirEspaco(alturaCartaoObs + 16);
        doc.roundedRect(xEsq, y, larguraUtil, alturaCartaoObs, 6).fillAndStroke(CREME, BORDA);
        tituloSecao('Observações do pedido', xEsq + 16, y + 12, larguraUtil - 32);
        doc.fillColor(TEXTO_SUAVE).font('Helvetica').fontSize(9.5).text(pedido.observacoes, xEsq + 16, y + 27, { width: larguraUtil - 32 });
        y += alturaCartaoObs + 16;
      }

      // Rodapé
      const temRastreio = pedido.transportadora || pedido.codigo_rastreio || pedido.previsao_entrega;
      const alturaRodape = 108;
      garantirEspaco(alturaRodape);
      const yRodape = y;
      linhaDivisoria(yRodape, BORDA, 1);

      const urlVerificacao = opts.urlVerificacao || null;
      const largColRodapeDir = 220;
      const xColRodapeEsq = xEsq;
      const largColRodapeEsq = larguraUtil - largColRodapeDir - 20;
      const xColRodapeDir = xDir - largColRodapeDir;

      let xInfoRodape = xColRodapeEsq;
      let yTextoEsq = yRodape + 14;
      if (urlVerificacao) {
        try {
          const qrBuffer = await QRCode.toBuffer(urlVerificacao, { type: 'png', margin: 1, width: 200 });
          doc.image(qrBuffer, xColRodapeEsq, yRodape + 14, { width: 58 });
          doc.fillColor(TEXTO_FRACO).font('Helvetica').fontSize(7).text('Escaneie para acompanhar\neste pedido on-line', xColRodapeEsq, yRodape + 74, { width: 76 });
          xInfoRodape = xColRodapeEsq + 72;
        } catch {   }
      }

      if (temRastreio) {
        const largColTexto = largColRodapeEsq - (xInfoRodape - xColRodapeEsq);
        doc.fillColor(TEXTO_SUAVE).font('Helvetica').fontSize(8.5);
        if (pedido.transportadora) { doc.text(`Transportadora: ${pedido.transportadora}`, xInfoRodape, yTextoEsq, { width: largColTexto }); yTextoEsq += 13; }
        if (pedido.codigo_rastreio) { doc.text(`Código de rastreio: ${pedido.codigo_rastreio}`, xInfoRodape, yTextoEsq, { width: largColTexto }); yTextoEsq += 13; }
        const previsaoFmt = fmtData(pedido.previsao_entrega);
        if (previsaoFmt) doc.text(`Previsão de entrega: ${previsaoFmt}`, xInfoRodape, yTextoEsq, { width: largColTexto });
      }

      const infoEmpresa = [lojaNome];
      if (opts.emailSuporte) infoEmpresa.push(opts.emailSuporte);
      let yTextoDir = yRodape + 14;
      doc.fillColor(TEXTO_SUAVE).font('Helvetica-Bold').fontSize(8.5).text(infoEmpresa.join('   ·   '), xColRodapeDir, yTextoDir, { width: largColRodapeDir, align: 'right' });
      yTextoDir += doc.heightOfString(infoEmpresa.join('   ·   '), { width: largColRodapeDir, align: 'right' }) + 6;
      doc.fillColor(TEXTO_FRACO).font('Helvetica').fontSize(7.5)
        .text('Comprovante eletrônico gerado automaticamente. Este documento não possui valor fiscal.', xColRodapeDir, yTextoDir, { width: largColRodapeDir, align: 'right' });

      // Numeração de páginas
      const paginas = doc.bufferedPageRange();
      if (paginas.count > 1) {
        const margemInferiorOriginal = doc.page.margins.bottom;
        for (let i = 0; i < paginas.count; i++) {
          doc.switchToPage(i);
          doc.page.margins.bottom = 0;
          doc.fillColor(TEXTO_FRACO).font('Helvetica').fontSize(7.5)
            .text(`Página ${i + 1} de ${paginas.count}`, xEsq, doc.page.height - margemInferiorOriginal + 12, { width: larguraUtil, align: 'center', lineBreak: false });
          doc.page.margins.bottom = margemInferiorOriginal;
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { gerarComprovantePdfBuffer };
