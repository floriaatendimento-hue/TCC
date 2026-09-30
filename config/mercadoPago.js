'use strict';

function detectarAmbienteDoToken(token) {
  if (token.startsWith('TEST-')) return 'test';
  if (token.startsWith('APP_USR-')) return 'production';
  return null;
}

function validar() {
  const accessToken = process.env.MP_ACCESS_TOKEN || '';
  const isProducao = process.env.NODE_ENV === 'production';

  if (!accessToken) {
    console.log('💳  Mercado Pago: MP_ACCESS_TOKEN ausente — rodando em Modo Preparação (pagamento simulado).');
    return { ativo: false };
  }

  const publicKey = process.env.MP_PUBLIC_KEY || '';
  const webhookSecret = process.env.MP_WEBHOOK_SECRET || '';
  const environment = (process.env.MP_ENVIRONMENT || 'test').trim().toLowerCase();

  const problemas = [];
  if (!publicKey) problemas.push('MP_PUBLIC_KEY ausente');
  if (!webhookSecret) problemas.push('MP_WEBHOOK_SECRET ausente');
  if (!['test', 'production'].includes(environment)) {
    problemas.push(`MP_ENVIRONMENT inválido ("${environment}") — use "test" ou "production"`);
  }

  const ambienteDoToken = detectarAmbienteDoToken(accessToken);
  if (ambienteDoToken && ambienteDoToken !== environment) {
    problemas.push(
      `MP_ACCESS_TOKEN parece ser de "${ambienteDoToken}" (prefixo ${ambienteDoToken === 'test' ? 'TEST-' : 'APP_USR-'}) mas MP_ENVIRONMENT="${environment}" — nunca misture credencial de teste com produção`
    );
  }

  if (problemas.length) {
    const mensagem = `❌  Configuração do Mercado Pago inconsistente:\n${problemas.map((p) => `    - ${p}`).join('\n')}`;
    if (isProducao) {
      console.error(mensagem);
      console.error('    Corrija as variáveis MP_* antes de subir o servidor em produção.');
      process.exit(1);
    }
    console.warn(mensagem);
    console.warn('    Fora de produção isso não derruba o servidor, mas a integração pode se comportar de forma inesperada.');
  }

  console.log(`💳  Mercado Pago ativo — ambiente: ${environment}${ambienteDoToken ? '' : ' (prefixo do token não reconhecido)'}`);
  return { ativo: true, accessToken, publicKey, webhookSecret, environment };
}

const config = validar();

module.exports = config;
