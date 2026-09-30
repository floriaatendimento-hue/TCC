'use strict';

const PreferenciaAcessibilidade = require('../../models/PreferenciaAcessibilidade');
const { respostaErro } = require('../../helpers/respostaErro');

/* GET /api/acessibilidade */
exports.obter = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    const preferencias = await PreferenciaAcessibilidade.buscar(req.session.usuario.id);
    res.json({ ok: true, data: preferencias });
  } catch (err) {
    respostaErro(res, err, 'Erro ao carregar preferências de acessibilidade.');
  }
};

exports.salvar = async (req, res) => {
  try {
    const campos = {
      tamanho_fonte: req.body.tamanho_fonte,
      espacamento_texto: req.body.espacamento_texto,
      alto_contraste: req.body.alto_contraste,
      reduzir_movimento: req.body.reduzir_movimento,
      destacar_links: req.body.destacar_links,
      destacar_foco: req.body.destacar_foco,
      interface_simplificada: req.body.interface_simplificada,
      otimizar_leitor_tela: req.body.otimizar_leitor_tela,
      libras_ativo: req.body.libras_ativo,
      pausar_midia_automatica: req.body.pausar_midia_automatica,
    };
    Object.keys(campos).forEach((k) => campos[k] === undefined && delete campos[k]);

    const atual = await PreferenciaAcessibilidade.buscar(req.session.usuario.id);
    const preferencias = await PreferenciaAcessibilidade.salvar(req.session.usuario.id, { ...atual, ...campos });
    res.json({ ok: true, message: 'Preferências de acessibilidade salvas.', data: preferencias });
  } catch (err) {
    respostaErro(res, err, 'Erro ao salvar preferências de acessibilidade.');
  }
};

exports.salvarCampo = async (req, res) => {
  try {
    const preferencias = await PreferenciaAcessibilidade.salvarCampo(
      req.session.usuario.id,
      req.params.campo,
      req.body.valor
    );
    res.json({ ok: true, data: preferencias });
  } catch (err) {
    respostaErro(res, err, 'Erro ao atualizar preferência de acessibilidade.');
  }
};

/* POST /api/acessibilidade/restaurar */
exports.restaurar = async (req, res) => {
  try {
    const preferencias = await PreferenciaAcessibilidade.restaurarPadrao(req.session.usuario.id);
    res.json({ ok: true, message: 'Preferências restauradas ao padrão.', data: preferencias });
  } catch (err) {
    respostaErro(res, err, 'Erro ao restaurar preferências de acessibilidade.');
  }
};
