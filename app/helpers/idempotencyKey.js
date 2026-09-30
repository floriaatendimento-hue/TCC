'use strict';

const FORMATO_VALIDO = /^[A-Za-z0-9._:-]{1,100}$/;

function lerIdempotencyKey(req) {
  const bruta = req.get('Idempotency-Key');
  if (bruta === undefined) return { ok: true, chave: null };
  return FORMATO_VALIDO.test(bruta) ? { ok: true, chave: bruta } : { ok: false };
}

module.exports = { lerIdempotencyKey };
