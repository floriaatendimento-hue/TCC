'use strict';

const Configuracao = require('../../models/Configuracao');
const { CONTATO, REDES_SOCIAIS } = require('../../../config/socialLinks');

let cache = {};

async function carregar() {
  try {
    cache = await Configuracao.obterTodas();
  } catch (err) {
    console.warn('⚠️  [configCache] Não foi possível carregar configurações do banco, usando padrões estáticos:', err.message);
    cache = {};
  }
  return cache;
}

function obter() {
  return cache;
}

function montarSocialLinks() {
  const v = (chave, padrao) => (cache[chave] != null && cache[chave] !== '' ? cache[chave] : padrao);

  const email           = v('loja_email', CONTATO.email);
  const telefoneExibicao= v('telefone_exibicao', CONTATO.telefoneExibicao);
  const telefoneE164    = v('telefone_e164', CONTATO.telefoneE164);
  const whatsappNumero  = v('whatsapp_numero', CONTATO.whatsappNumero);
  const whatsappMensagem= v('whatsapp_mensagem', CONTATO.whatsappMensagem);
  const facebook        = v('facebook', REDES_SOCIAIS.facebook);
  const instagram       = v('instagram', REDES_SOCIAIS.instagram);

  const whatsappMensagemSuporte = v('whatsapp_mensagem_suporte', CONTATO.whatsappMensagemSuporte);

  return {
    email:    { href: `mailto:${email}`, label: 'Enviar e-mail', title: `Enviar e-mail para ${email}`, external: false, valor: email },
    whatsapp: { href: `https://wa.me/${whatsappNumero}?text=${encodeURIComponent(whatsappMensagem)}`, label: 'Conversar no WhatsApp', title: 'Abrir conversa no WhatsApp', external: true },
    telefone: { href: `tel:${telefoneE164}`, label: 'Ligar agora', title: `Ligar para ${telefoneExibicao}`, external: false, valor: telefoneExibicao },
    facebook: { href: facebook, label: 'Facebook', title: 'Ver nossa página no Facebook', external: true },
    instagram:{ href: instagram, label: 'Instagram', title: 'Ver nosso perfil no Instagram', external: true },
    whatsappSuporte: { numero: whatsappNumero, mensagemBase: whatsappMensagemSuporte },
  };
}

function obterLojaNome() {
  return cache.loja_nome || 'Floria';
}

function obterFrete() {
  return {
    padrao:      Number(cache.frete_padrao ?? 15),
    gratisAcima: Number(cache.frete_gratis_acima ?? 150),
  };
}

function obterOrigemFrete() {
  return {
    cep:        cache.cep_origem || '',
    uf:         cache.uf_origem || 'SP',
    cidade:     cache.cidade_origem || '',
    bairro:     cache.bairro_origem || '',
    logradouro: cache.logradouro_origem || '',
    numero:     cache.numero_origem || '',
  };
}

function obterUfsEntregaPermitidas() {
  return String(cache.ufs_entrega_permitidas || '')
    .split(',')
    .map((uf) => uf.trim().toUpperCase())
    .filter(Boolean);
}

module.exports = {
  carregar, obter, montarSocialLinks, obterLojaNome, obterFrete,
  obterOrigemFrete, obterUfsEntregaPermitidas,
};
