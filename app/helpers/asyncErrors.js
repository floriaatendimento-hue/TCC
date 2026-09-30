'use strict';

const Layer = require('express/lib/router/layer');

Layer.prototype.handle_request = function handleRequestAsync(req, res, next) {
  const fn = this.handle;
  if (fn.length > 3) return next();

  try {
    const retorno = fn(req, res, next);
    if (retorno && typeof retorno.then === 'function') {
      retorno.then(undefined, next);
    }
  } catch (err) {
    next(err);
  }
};

process.on('unhandledRejection', (motivo) => {
  const msg = motivo && motivo.message ? motivo.message : String(motivo);
  console.error('[unhandledRejection] (processo mantido no ar):', msg);
});
