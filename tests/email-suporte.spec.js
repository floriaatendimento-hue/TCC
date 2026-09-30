require('dotenv').config();
const { test, expect, request: pwRequest } = require('@playwright/test');
const crypto = require('crypto');
const db = require('../config/db');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function emailAleatorio(prefixo) {
  return `${prefixo}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@teste.floria.local`;
}

async function novoAtor() {
  return pwRequest.newContext({ baseURL: BASE_URL });
}

async function extrairCsrf(resp, idCampo) {
  const html = await resp.text();
  const m = html.match(new RegExp(`id="${idCampo}" value="([^"]+)"`));
  if (!m) throw new Error(`Não achei o campo ${idCampo} na resposta de ${resp.url()} (status ${resp.status()})`);
  return m[1];
}

function ticketPadrao(overrides = {}) {
  return {
    nome: 'Cliente Teste',
    email: emailAleatorio('suporte'),
    assunto: 'Dúvida sobre um pedido',
    categoria: 'pedido',
    mensagem: 'Minha planta chegou com uma folha amarelada, isso é normal ou devo me preocupar com o restante do pedido?',
    ...overrides,
  };
}

async function enviarSuporte(ctx, dados) {
  const pagina = await ctx.get('/suporte');
  const csrf = await extrairCsrf(pagina, 'csrf-suporte');
  const resp = await ctx.post('/api/suporte', { headers: { 'CSRF-Token': csrf }, data: dados });
  return { resp, body: await resp.json().catch(() => null) };
}

test.describe.configure({ mode: 'serial' });

test.describe('Envio de solicitação de suporte', () => {
  test('solicitação válida é aceita, salva no banco e devolve protocolo', async () => {
    const ctx = await novoAtor();
    const dados = ticketPadrao();

    const { resp, body } = await enviarSuporte(ctx, dados);

    expect(resp.status()).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.protocolo).toMatch(/^FLR-\d{6}$/);

    const [[registro]] = await db.query(
      'SELECT nome, email, assunto, categoria, mensagem, status FROM solicitacoes_suporte WHERE email = ?',
      [dados.email]
    );
    expect(registro).toBeTruthy();
    expect(registro.nome).toBe(dados.nome);
    expect(registro.assunto).toBe(dados.assunto);
    expect(registro.categoria).toBe('pedido');
    expect(registro.status).toBe('aberto');
    await ctx.dispose();
  });

  test('categoria é opcional', async () => {
    const ctx = await novoAtor();
    const dados = ticketPadrao({ categoria: '' });

    const { resp, body } = await enviarSuporte(ctx, dados);

    expect(resp.status()).toBe(200);
    expect(body.ok).toBe(true);
    const [[registro]] = await db.query('SELECT categoria FROM solicitacoes_suporte WHERE email = ?', [dados.email]);
    expect(registro.categoria).toBeNull();
    await ctx.dispose();
  });

  test('funciona (responde ok, salva no banco) mesmo sem SMTP configurado', async () => {
    const ctx = await novoAtor();
    const dados = ticketPadrao();

    const { resp, body } = await enviarSuporte(ctx, dados);

    expect(resp.status()).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.protocolo).toBeTruthy();
    await ctx.dispose();
  });
});

test.describe('Validação', () => {
  test('nome vazio é rejeitado', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await enviarSuporte(ctx, ticketPadrao({ nome: '' }));
    expect(resp.status()).toBe(422);
    expect(body.errors.some((e) => e.path === 'nome')).toBe(true);
    await ctx.dispose();
  });

  test('e-mail inválido é rejeitado', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await enviarSuporte(ctx, ticketPadrao({ email: 'nao-e-email' }));
    expect(resp.status()).toBe(422);
    expect(body.errors.some((e) => e.path === 'email')).toBe(true);
    await ctx.dispose();
  });

  test('categoria fora da allowlist é rejeitada', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await enviarSuporte(ctx, ticketPadrao({ categoria: 'categoria-inventada' }));
    expect(resp.status()).toBe(422);
    expect(body.errors.some((e) => e.path === 'categoria')).toBe(true);
    await ctx.dispose();
  });

  test('mensagem muito curta é rejeitada', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await enviarSuporte(ctx, ticketPadrao({ mensagem: 'oi' }));
    expect(resp.status()).toBe(422);
    expect(body.errors.some((e) => e.path === 'mensagem')).toBe(true);
    await ctx.dispose();
  });

  test('mensagem acima de 5000 caracteres é rejeitada', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await enviarSuporte(ctx, ticketPadrao({ mensagem: 'a'.repeat(5001) }));
    expect(resp.status()).toBe(422);
    expect(body.errors.some((e) => e.path === 'mensagem')).toBe(true);
    await ctx.dispose();
  });

  test('quebra de linha no assunto é rejeitada (defesa contra header injection)', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await enviarSuporte(ctx, ticketPadrao({ assunto: 'Assunto\r\nBcc: atacante@exemplo.com' }));
    expect(resp.status()).toBe(422);
    expect(body.errors.some((e) => e.path === 'assunto')).toBe(true);
    await ctx.dispose();
  });

  test('marcação HTML no nome é rejeitada', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await enviarSuporte(ctx, ticketPadrao({ nome: '<script>alert(1)</script>' }));
    expect(resp.status()).toBe(422);
    expect(body.errors.some((e) => e.path === 'nome')).toBe(true);
    await ctx.dispose();
  });

  test('mensagem com HTML é aceita mas gravada tal como digitada (defesa é na renderização do e-mail, não na entrada)', async () => {
    const ctx = await novoAtor();
    const dados = ticketPadrao({ mensagem: 'Meu pedido <#1234> não chegou, o que houve com ele?' });

    const { resp, body } = await enviarSuporte(ctx, dados);

    expect(resp.status()).toBe(200);
    expect(body.ok).toBe(true);
    const [[registro]] = await db.query('SELECT mensagem FROM solicitacoes_suporte WHERE email = ?', [dados.email]);
    expect(registro.mensagem).toBe(dados.mensagem);
    await ctx.dispose();
  });
});

test.describe('Honeypot (anti-spam)', () => {
  test('campo armadilha preenchido finge sucesso sem gravar nada', async () => {
    const ctx = await novoAtor();
    const dados = ticketPadrao({ site: 'http://spam.exemplo.com' });

    const { resp, body } = await enviarSuporte(ctx, dados);

    expect(resp.status()).toBe(200);
    expect(body.ok).toBe(true);
    const [[registro]] = await db.query('SELECT id FROM solicitacoes_suporte WHERE email = ?', [dados.email]);
    expect(registro).toBeUndefined();
    await ctx.dispose();
  });
});

test.describe('Duplo envio', () => {
  test('mesmo e-mail + mesma mensagem em sequência devolve o MESMO protocolo', async () => {
    const ctx = await novoAtor();
    const dados = ticketPadrao();

    const primeira = await enviarSuporte(ctx, dados);
    const segunda = await enviarSuporte(ctx, dados);

    expect(primeira.body.protocolo).toBe(segunda.body.protocolo);

    const [contagem] = await db.query('SELECT COUNT(*) AS total FROM solicitacoes_suporte WHERE email = ?', [dados.email]);
    expect(contagem[0].total).toBe(1);
    await ctx.dispose();
  });

  test('mesmo e-mail com mensagem DIFERENTE cria uma solicitação nova', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('suporte-msg-diferente');

    const primeira = await enviarSuporte(ctx, ticketPadrao({ email, mensagem: 'Primeira dúvida sobre o pedido, ainda não chegou.' }));
    const segunda = await enviarSuporte(ctx, ticketPadrao({ email, mensagem: 'Segunda dúvida, sobre outro assunto completamente diferente.' }));

    expect(primeira.body.protocolo).not.toBe(segunda.body.protocolo);
    await ctx.dispose();
  });
});

test.describe('Rate limiting', () => {
  test('envio de suporte bloqueia após várias tentativas seguidas', async () => {
    const ctx = await novoAtor();
    let ultimoStatus = 200;
    for (let i = 0; i < 300; i++) {
      const { resp } = await enviarSuporte(ctx, ticketPadrao({ mensagem: `Mensagem de teste número ${i} para o rate limit, com texto suficiente.` }));
      ultimoStatus = resp.status();
      if (ultimoStatus === 429) break;
    }
    expect(ultimoStatus).toBe(429);
    await ctx.dispose();
  });
});

test.describe('CSRF', () => {
  test('POST /api/suporte sem token CSRF é rejeitado', async () => {
    const ctx = await novoAtor();
    const resp = await ctx.post('/api/suporte', { data: ticketPadrao() });
    expect(resp.status()).toBe(403);
    await ctx.dispose();
  });
});
