'use strict';

function logSeguranca(evento, dados = {}) {
  try {
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      tipo: 'seguranca',
      evento,
      ...dados,
    }));
  } catch (e) {
    console.error('[logSeguranca] falha ao serializar evento:', evento);
  }
}

module.exports = { logSeguranca };
