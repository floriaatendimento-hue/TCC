'use strict';

let avisouFallbackEmProducao = false;

function baseSite() {
  const base = String(process.env.SITE_URL || '').trim().replace(/\/+$/, '');
  return /^https?:\/\/[^\s/]+/i.test(base) ? base : null;
}

function urlSite(caminho = '') {
  const base = baseSite();
  return base ? base + caminho : null;
}

function urlDoSite(req, caminho = '') {
  const configurada = urlSite(caminho);
  if (configurada) return configurada;

  if (process.env.NODE_ENV === 'production' && !avisouFallbackEmProducao) {
    avisouFallbackEmProducao = true;
    console.warn('[siteUrl] SITE_URL não definida em produção — QR Codes/links absolutos usarão o Host da requisição (pode ser um host interno). Defina SITE_URL no .env.');
  }
  return `${req.protocol}://${req.get('host')}${caminho}`;
}

module.exports = { urlSite, urlDoSite };
