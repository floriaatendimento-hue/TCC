'use strict';

const QRCode = require('qrcode');
const Pedido = require('../../models/Pedido');
const Comprovante = require('../../models/Comprovante');
const configCache = require('../../services/cache/configCache');
const pagamentoService = require('../../services/pagamento');
const { gerarComprovantePdfBuffer } = require('../../services/pdf/comprovantePdf');
const { mailerDisponivel, enviarComprovantePorEmail } = require('../../services/mailer');
const { respostaErro } = require('../../helpers/respostaErro');
const { urlDoSite } = require('../../helpers/siteUrl');

function urlVerificacaoComprovante(req, pedidoId) {
  return urlDoSite(req, `/pedido/${pedidoId}`);
}

async function gerarPdfComprovante(req, pedido, comprovante) {
  const socialLinksPdf = configCache.montarSocialLinks();
  return gerarComprovantePdfBuffer(pedido, comprovante, Pedido.rotulosStatusPagamento(), {
    urlVerificacao: urlVerificacaoComprovante(req, pedido.id),
    lojaNome: configCache.obterLojaNome(),
    emailSuporte: socialLinksPdf.email.valor,
  });
}

exports.detalhes = async (req, res) => {
  try {
    const pedido = await Pedido.detalhesCompletos(req.params.id);
    if (!pedido) return res.status(404).render('pages/404');
    if (!Pedido.usuarioTemAcesso(pedido, req.session.usuario)) return res.status(403).render('pages/403');

    res.render('pages/pedidos/PedidoDetalhes', {
      pedido,
      rotulosEtapa: Pedido.rotulosEtapa(),
      rotulosStatusPagamento: Pedido.rotulosStatusPagamento(),
      podeCancelar: Pedido.podeCancelar(pedido.status),
    });
  } catch (err) {
    console.error('[detalhes do pedido]', err.message);
    res.status(500).render('pages/Home');
  }
};

exports.paginaPagamento = async (req, res) => {
  try {
    const pedido = await Pedido.detalhesCompletos(req.params.id);
    if (!pedido) return res.status(404).render('pages/404');
    if (!Pedido.usuarioTemAcesso(pedido, req.session.usuario)) return res.status(403).render('pages/403');

    let pagamentoExibicao = null;
    const aguardandoPagamento = ['pendente', 'processando'].includes(pedido.status_pagamento);
    if (aguardandoPagamento && pedido.forma_pagto === 'pix') {
      pagamentoExibicao = { tipo: 'pix', ...(await pagamentoService.pix.gerarExibicao({ pedidoId: pedido.id, valor: pedido.total })) };
    } else if (aguardandoPagamento && pedido.forma_pagto === 'boleto') {
      pagamentoExibicao = {
        tipo: 'boleto',
        ...pagamentoService.boleto.gerarExibicao({
          pedidoId: pedido.id,
          valor: pedido.total,
          vencimento: pedido.pagamento_expira_em ? new Date(pedido.pagamento_expira_em) : undefined,
        }),
      };
    }

    res.render('pages/carrinho/PagamentoPedido', { pedido, rotulosStatusPagamento: Pedido.rotulosStatusPagamento(), pagamentoExibicao });
  } catch (err) {
    console.error('[pagamento do pedido]', err.message);
    res.status(500).render('pages/Home');
  }
};

exports.statusPagamento = async (req, res) => {
  try {
    const pedido = await Pedido.findById(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, message: 'Pedido não encontrado.' });
    if (!Pedido.usuarioTemAcesso(pedido, req.session.usuario)) return res.status(403).json({ ok: false, message: 'Acesso negado.' });

    res.json({ ok: true, status: pedido.status, status_pagamento: pedido.status_pagamento });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível consultar o status do pagamento.' });
  }
};

exports.paginaComprovante = async (req, res) => {
  try {
    const pedido = await Pedido.detalhesCompletos(req.params.id);
    if (!pedido) return res.status(404).render('pages/404');
    if (!Pedido.usuarioTemAcesso(pedido, req.session.usuario)) return res.status(403).render('pages/403');

    const comprovante = await Comprovante.obterOuCriar(pedido.id);
    const urlVerificacao = urlVerificacaoComprovante(req, pedido.id);
    let qrDataUrl = null;
    try { qrDataUrl = await QRCode.toDataURL(urlVerificacao, { margin: 1, width: 160 }); } catch { /* segue sem QR se falhar */ }

    res.render('pages/pedidos/PedidoComprovante', {
      pedido,
      comprovante,
      rotulosEtapa: Pedido.rotulosEtapa(),
      rotulosStatusPagamento: Pedido.rotulosStatusPagamento(),
      mailerDisponivel,
      clienteEmail: pedido.cliente_email,
      qrDataUrl,
      imprimirAuto: ['1', 'true'].includes(String(req.query.imprimir || '').toLowerCase()),
    });
  } catch (err) {
    console.error('[comprovante do pedido]', err.message);
    res.status(500).render('pages/Home');
  }
};

exports.pdfComprovante = async (req, res) => {
  try {
    const pedido = await Pedido.detalhesCompletos(req.params.id);
    if (!pedido) return res.status(404).send('Pedido não encontrado.');
    if (!Pedido.usuarioTemAcesso(pedido, req.session.usuario)) return res.status(403).send('Acesso negado.');

    const comprovante = await Comprovante.obterOuCriar(pedido.id);
    await Comprovante.registrarEmissao(pedido.id);
    const pdfBuffer = await gerarPdfComprovante(req, pedido, comprovante);

    const baixar = ['1', 'true'].includes(String(req.query.baixar || '').toLowerCase());
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `${baixar ? 'attachment' : 'inline'}; filename="comprovante-pedido-${pedido.id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('[pdf do comprovante]', err.message);
    res.status(500).send('Não foi possível gerar o comprovante. Tente novamente.');
  }
};

exports.enviarComprovantePorEmail = async (req, res) => {
  try {
    const pedido = await Pedido.detalhesCompletos(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, message: 'Pedido não encontrado.' });
    if (!Pedido.usuarioTemAcesso(pedido, req.session.usuario)) return res.status(403).json({ ok: false, message: 'Acesso negado.' });

    const destino = req.body.email || pedido.cliente_email;
    if (!destino) return res.status(422).json({ ok: false, message: 'Nenhum e-mail disponível para envio.' });

    const comprovante = await Comprovante.obterOuCriar(pedido.id);
    const pdfBuffer = await gerarPdfComprovante(req, pedido, comprovante);

    await enviarComprovantePorEmail({ to: destino, pedido, pdfBuffer });
    await Comprovante.registrarEnvioEmail(pedido.id, destino);

    res.json({ ok: true, message: `Comprovante enviado para ${destino}.` });
  } catch (err) {
    if (err.code === 'MAILER_INDISPONIVEL') {
      return res.status(503).json({ ok: false, code: err.code, message: 'Envio de e-mail não está configurado neste servidor.' });
    }
    console.error('[enviar comprovante por e-mail]', err.message);
    res.status(500).json({ ok: false, message: 'Não foi possível enviar o comprovante por e-mail. Tente novamente.' });
  }
};

exports.obterPedido = async (req, res) => {
  try {
    const pedido = await Pedido.detalhesCompletos(req.params.id);
    if (!pedido) return res.status(404).json({ ok: false, message: 'Pedido não encontrado.' });
    if (!Pedido.usuarioTemAcesso(pedido, req.session.usuario)) return res.status(403).json({ ok: false, message: 'Acesso negado.' });

    res.json({ ok: true, data: pedido });
  } catch (err) {
    respostaErro(res, err);
  }
};

exports.cancelar = async (req, res) => {
  try {
    const resultado = await Pedido.cancelarPeloCliente(req.params.id, req.session.usuario.id, req.body.motivo || null);
    if (!resultado.ok) {
      const status = resultado.code === 'NAO_ENCONTRADO' ? 404 : 422;
      return res.status(status).json({ ok: false, message: resultado.message, code: resultado.code });
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Não foi possível cancelar o pedido. Tente novamente.' });
  }
};

exports.meusPedidos = async (req, res) => {
  try {
    const pedidos = await Pedido.findByUsuario(req.session.usuario.id);
    const pedidosComItens = await Promise.all(
      pedidos.map(async (p) => ({ ...p, itens: await Pedido.itensDoPedido(p.id) }))
    );
    res.json({ ok: true, data: pedidosComItens });
  } catch (err) {
    respostaErro(res, err);
  }
};
