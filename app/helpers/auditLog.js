'use strict';

const LogAdmin = require('../models/LogAdmin');

function logAcao(req, acao, detalhes, extra = {}) {
  const usuario = req.session && req.session.usuario;
  const { dadosAntes = null, dadosDepois = null } = extra;
  LogAdmin.registrar({
    usuario_id: usuario ? usuario.id : null,
    usuario_nome: usuario ? usuario.nome : null,
    acao,
    detalhes,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    dadosAntes,
    dadosDepois,
  });
}

function valoresIguais(a, b) {
  if (a === b) return true;
  if (a === null || a === undefined) return b === null || b === undefined || b === '';
  if (b === null || b === undefined) return a === '';
  const na = Number(a), nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && String(a).trim() !== '' && String(b).trim() !== '') return na === nb;
  return String(a) === String(b);
}

function diffCampos(antes, depois, campos) {
  const resultadoAntes = {};
  const resultadoDepois = {};
  for (const campo of campos) {
    const valorAntes = antes ? antes[campo] : undefined;
    const valorDepois = depois ? depois[campo] : undefined;
    if (valorAntes === undefined && valorDepois === undefined) continue;
    if (valoresIguais(valorAntes, valorDepois)) continue;
    resultadoAntes[campo] = valorAntes ?? null;
    resultadoDepois[campo] = valorDepois ?? null;
  }
  return { antes: resultadoAntes, depois: resultadoDepois, mudou: Object.keys(resultadoDepois).length > 0 };
}

module.exports = { logAcao, valoresIguais, diffCampos };
