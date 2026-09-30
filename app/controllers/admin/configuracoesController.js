'use strict';

const Configuracao = require('../../models/Configuracao');
const configCache = require('../../services/cache/configCache');
const { logAcao, diffCampos } = require('../../helpers/auditLog');

exports.pagina = async (req, res) => {
  try {
    const config = await Configuracao.obterTodas();
    res.render('pages/admin/configuracoes', { secaoAtual: 'configuracoes', config });
  } catch (err) {
    console.error('Erro ao carregar configurações:', err.message);
    res.render('pages/admin/configuracoes', { secaoAtual: 'configuracoes', config: {} });
  }
};

exports.salvar = async (req, res) => {
  try {
    const configAntes = await Configuracao.obterTodas();
    await Configuracao.salvarVarias(req.body);
    await configCache.carregar();
    const diffConfig = diffCampos(configAntes, req.body, Object.keys(req.body));
    logAcao(req, 'configuracoes.salvar', 'Configurações da loja atualizadas', diffConfig.mudou ? { dadosAntes: diffConfig.antes, dadosDepois: diffConfig.depois } : {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, message: 'Erro ao salvar configurações.' });
  }
};
