'use strict';

const SessaoSegura = require('../models/SessaoSegura');

function destruirSessao(req) {
  req.session.usuario = null;
}

async function sessaoSegura(req, res, next) {
  if (!req.session?.usuario) return next();

  try {
    const registro = await SessaoSegura.buscarPorSessionId(req.sessionID);

    if (
      !registro ||
      registro.revogado_em ||
      new Date(registro.expira_em).getTime() < Date.now() ||
      SessaoSegura.idleExpirada(registro)
    ) {
      destruirSessao(req);
      return next();
    }

    SessaoSegura.tocar(req.sessionID, registro.ultima_atividade_em).catch((err) => {
      console.error('[sessaoSegura] falha ao atualizar última atividade:', err.message);
    });

    return next();
  } catch (err) {
    console.error('[sessaoSegura] erro ao validar sessão (fail-open):', err.message);
    return next();
  }
}

module.exports = { sessaoSegura, destruirSessao };
