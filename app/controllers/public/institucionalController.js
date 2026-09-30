'use strict';

const Produto = require('../../models/Produto');
const Categoria = require('../../models/Categoria');
const Pedido = require('../../models/Pedido');
const { aplicarPrecoLista } = require('../../helpers/precoView');
const configCache = require('../../services/cache/configCache');
const suporteService = require('../../services/suporteService');
const { respostaErro } = require('../../helpers/respostaErro');

exports.maisVendidos = async (req, res) => {
  let secoes = [];
  try {
    const categorias = await Categoria.findAllAtivas();
    const resultados = await Promise.all(
      categorias.map((cat) => Produto.buscarMaisVendidos({ limite: 10, categoriaSlug: cat.slug }))
    );
    secoes = categorias
      .map((categoria, i) => ({ categoria, produtos: aplicarPrecoLista(resultados[i]) }))
      .filter((secao) => secao.produtos.length > 0);
  } catch (err) {
    console.error('Erro ao carregar mais vendidos:', err.message);
  }
  res.render('pages/produtos/MaisVendidos', { secoes });
};

exports.sobreNos = (req, res) => res.render('pages/institucional/sobre-nos');
exports.termosDeUso = (req, res) => res.render('pages/institucional/termos-de-uso');
exports.politicaPrivacidade = (req, res) => res.render('pages/institucional/politica-privacidade');
exports.politicaCookies = (req, res) => res.render('pages/institucional/politica-cookies');

exports.suporte = async (req, res) => {
  let pedidoContexto = null;
  const pedidoId = parseInt(req.query.pedido, 10);

  if (req.session?.usuario && Number.isInteger(pedidoId) && pedidoId > 0) {
    try {
      const pedido = await Pedido.findById(pedidoId);
      const isAdmin = req.session.usuario.papel === 'admin';
      const isOwner = pedido && pedido.usuario_id === req.session.usuario.id;
      if (pedido && (isAdmin || isOwner)) {
        pedidoContexto = {
          id: pedido.id,
          status: pedido.status,
          status_pagamento: pedido.status_pagamento,
          podeCancelar: Pedido.podeCancelar(pedido.status),
        };
      }
    } catch (err) {
      console.error('Erro ao carregar contexto do pedido no Suporte:', err.message);
    }
  }

  res.render('pages/institucional/Suporte', {
    pedidoContexto,
    rotulosEtapa: Pedido.rotulosEtapa(),
    rotulosStatusPagamento: Pedido.rotulosStatusPagamento(),
    frete: configCache.obterFrete(),
  });
};

exports.enviarSuporte = async (req, res) => {
  if (req.body.site) {
    return res.json({ ok: true, message: 'Recebemos sua solicitação de suporte. Nossa equipe irá analisar o problema e entrar em contato pelo e-mail informado.' });
  }

  try {
    const { protocolo } = await suporteService.criarSolicitacao({
      usuarioId: req.session.usuario ? req.session.usuario.id : null,
      nome: req.body.nome,
      email: req.body.email,
      assunto: req.body.assunto,
      categoria: req.body.categoria || null,
      mensagem: req.body.mensagem,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      ok: true,
      message: 'Recebemos sua solicitação de suporte. Nossa equipe irá analisar o problema e entrar em contato pelo e-mail informado.',
      protocolo,
    });
  } catch (err) {
    respostaErro(res, err, 'Não foi possível enviar sua solicitação agora. Tente novamente em instantes.');
  }
};
