'use strict';

const CONTATO = {
  email:            'contato@floria.com.br',
  telefoneExibicao: '+55 11 4002-8922',
  telefoneE164:     '+551140028922',
  whatsappNumero:    '5511999999999',
  whatsappMensagem: 'Olá! Vim pelo site da Floria e gostaria de saber mais sobre os produtos.',
  whatsappMensagemSuporte: 'Olá! Preciso de ajuda com um pedido/dúvida no site da Floria. ',
};

const REDES_SOCIAIS = {
  facebook:  'https://www.facebook.com/floriaplantas',
  instagram: 'https://www.instagram.com/floriaplantas',
};

const socialLinks = {
  email: {
    href:     `mailto:${CONTATO.email}`,
    label:    'Enviar e-mail',
    title:    `Enviar e-mail para ${CONTATO.email}`,
    external: false,
  },
  whatsapp: {
    href:     `https://wa.me/${CONTATO.whatsappNumero}?text=${encodeURIComponent(CONTATO.whatsappMensagem)}`,
    label:    'Conversar no WhatsApp',
    title:    'Abrir conversa no WhatsApp',
    external: true,
  },
  telefone: {
    href:     `tel:${CONTATO.telefoneE164}`,
    label:    'Ligar agora',
    title:    `Ligar para ${CONTATO.telefoneExibicao}`,
    external: false,
  },
  facebook: {
    href:     REDES_SOCIAIS.facebook,
    label:    'Facebook',
    title:    'Ver nossa página no Facebook',
    external: true,
  },
  instagram: {
    href:     REDES_SOCIAIS.instagram,
    label:    'Instagram',
    title:    'Ver nosso perfil no Instagram',
    external: true,
  },
};

module.exports = { socialLinks, CONTATO, REDES_SOCIAIS };
