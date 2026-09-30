'use strict';

const isProducao = process.env.NODE_ENV === 'production';

function respostaErro(res, err, mensagemPadrao = 'Erro interno. Tente novamente.') {
  console.error(err && err.message ? err.message : err);
  return res.status(500).json({
    ok: false,
    message: isProducao ? mensagemPadrao : (err && err.message ? err.message : mensagemPadrao),
  });
}

module.exports = { respostaErro, isProducao };
