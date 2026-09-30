require('dotenv').config();
const { test, expect, request: pwRequest } = require('@playwright/test');
const crypto = require('crypto');
const db = require('../config/db');
const { hashOtp } = require('../app/models/OtpRecuperacaoSenha');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SENHA_FORTE = 'SenhaForte!2024xyz';
const SENHA_NOVA = 'OutraSenhaForte!2025';
const COOLDOWN_MS = 8_000;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function emailAleatorio(prefixo) {
  return `${prefixo}_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@teste.floria.local`;
}

function cpfValidoAleatorio() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const calcularDigito = (nums) => {
    let soma = 0;
    for (let i = 0; i < nums.length; i++) soma += nums[i] * (nums.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = calcularDigito(base);
  const d2 = calcularDigito([...base, d1]);
  return [...base, d1, d2].join('');
}

const novoAtor = () => pwRequest.newContext({ baseURL: BASE_URL });

async function extrairCsrf(resp, idCampo) {
  const html = await resp.text();
  const m = html.match(new RegExp(`id="${idCampo}" value="([^"]+)"`));
  if (!m) throw new Error(`Não achei o campo ${idCampo} em ${resp.url()} (status ${resp.status()})`);
  return m[1];
}

async function cadastrar(ctx, { email, senha = SENHA_FORTE, nome = 'Teste Recuperacao' } = {}) {
  const csrf = await extrairCsrf(await ctx.get('/cadastro'), 'csrf-cadastro');
  const resp = await ctx.post('/api/cadastro', {
    headers: { 'CSRF-Token': csrf },
    data: { nome, email, cpf: cpfValidoAleatorio(), telefone: '(11) 91234-5678', senha, confirmar: senha },
  });
  return { resp, body: await resp.json().catch(() => null) };
}

async function login(ctx, { email, senha }) {
  const csrf = await extrairCsrf(await ctx.get('/login'), 'csrf-login');
  const resp = await ctx.post('/api/login', { headers: { 'CSRF-Token': csrf }, data: { email, senha } });
  return { resp, body: await resp.json().catch(() => null) };
}

async function criarConta(prefixo) {
  const ctx = await novoAtor();
  const email = emailAleatorio(prefixo);
  await cadastrar(ctx, { email });
  await ctx.dispose();
  const [[u]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  return { email, usuarioId: u.id };
}

async function solicitar(ctx, email) {
  const csrf = await extrairCsrf(await ctx.get('/login'), 'csrf-login');
  const resp = await ctx.post('/api/recuperar-senha', { headers: { 'CSRF-Token': csrf }, data: { email } });
  return { resp, body: await resp.json().catch(() => null) };
}

async function plantarOtp(usuarioId, otp, { esperarNovaLinhaAlemDe = 0 } = {}) {
  for (let i = 0; i < 60; i++) {
    const [[linha]] = await db.query(
      `SELECT id FROM otps_recuperacao_senha WHERE usuario_id = ? AND usado_em IS NULL AND id > ? ORDER BY id DESC LIMIT 1`,
      [usuarioId, esperarNovaLinhaAlemDe]
    );
    if (linha) {
      await db.query('UPDATE otps_recuperacao_senha SET otp_hash = ? WHERE id = ?', [hashOtp(usuarioId, otp), linha.id]);
      return linha.id;
    }
    await dormir(100);
  }
  throw new Error('OTP não foi criado no banco a tempo (o servidor de teste está rodando com o código novo?)');
}

async function ultimoIdOtp(usuarioId) {
  const [[r]] = await db.query('SELECT COALESCE(MAX(id), 0) AS id FROM otps_recuperacao_senha WHERE usuario_id = ?', [usuarioId]);
  return r.id;
}

async function csrfOtp(ctx) {
  const pagina = await ctx.get('/verificar-codigo');
  return extrairCsrf(pagina, 'csrf-otp');
}

async function verificarOtp(ctx, otp, csrf) {
  const token = csrf || await csrfOtp(ctx);
  const resp = await ctx.post('/api/verificar-otp', { headers: { 'CSRF-Token': token }, data: { otp } });
  return { resp, body: await resp.json().catch(() => null) };
}

async function redefinir(ctx, { novaSenha = SENHA_NOVA, confirmarSenha = novaSenha, extra = {} } = {}) {
  const pagina = await ctx.get('/redefinir-senha');
  const csrf = await extrairCsrf(pagina, 'csrf-redefinir');
  const resp = await ctx.post('/api/redefinir-senha', {
    headers: { 'CSRF-Token': csrf },
    data: { novaSenha, confirmarSenha, ...extra },
  });
  return { resp, body: await resp.json().catch(() => null) };
}

async function redefinirDireto(ctx, data) {
  const csrf = await extrairCsrf(await ctx.get('/login'), 'csrf-login');
  const resp = await ctx.post('/api/redefinir-senha', { headers: { 'CSRF-Token': csrf }, data });
  return { resp, body: await resp.json().catch(() => null) };
}

async function ateAutorizacao(ctx, { email, usuarioId }, otp = '482913') {
  await solicitar(ctx, email);
  await plantarOtp(usuarioId, otp);
  const { body } = await verificarOtp(ctx, otp);
  expect(body.ok).toBe(true);
}

test.describe.configure({ mode: 'serial' }); // limiters por IP são compartilhados

test.describe('Fluxo completo', () => {
  test('e-mail → OTP → verificação → nova senha → login com a nova senha', async () => {
    const conta = await criarConta('otp-feliz');
    const ctx = await novoAtor();

    const { resp, body } = await solicitar(ctx, conta.email);
    expect(resp.status()).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.redirect).toBe('/verificar-codigo');

    const antes = await ctx.get('/redefinir-senha', { maxRedirects: 0 });
    expect(antes.status()).toBe(302);
    expect(antes.headers().location).toBe('/verificar-codigo');

    await plantarOtp(conta.usuarioId, '482913');
    const telaOtp = await ctx.get('/verificar-codigo');
    expect(telaOtp.status()).toBe(200);
    expect((await telaOtp.text()).match(/class="otp-digito"/g)).toHaveLength(6);

    const ver = await verificarOtp(ctx, '482913');
    expect(ver.resp.status()).toBe(200);
    expect(ver.body).toMatchObject({ ok: true, redirect: '/redefinir-senha' });
    expect(JSON.stringify(ver.body)).not.toContain('autorizacao'); // autorização nunca sai do servidor

    const red = await redefinir(ctx);
    expect(red.resp.status()).toBe(200);
    expect(red.body.ok).toBe(true);

    expect((await login(await novoAtor(), { email: conta.email, senha: SENHA_FORTE })).resp.status()).toBe(401);
    expect((await login(await novoAtor(), { email: conta.email, senha: SENHA_NOVA })).resp.status()).toBe(200);
    await ctx.dispose();
  });

  test('o OTP nunca é gravado em texto puro no banco', async () => {
    const conta = await criarConta('otp-hash');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    const id = await plantarOtp(conta.usuarioId, '482913');
    const [[linha]] = await db.query('SELECT otp_hash FROM otps_recuperacao_senha WHERE id = ?', [id]);
    expect(linha.otp_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(linha.otp_hash).not.toContain('482913');
    await ctx.dispose();
  });
});

test.describe('Validação do OTP', () => {
  test('OTP incorreto é rejeitado e a redefinição continua bloqueada', async () => {
    const conta = await criarConta('otp-errado');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '482913');

    const { resp, body } = await verificarOtp(ctx, '000000');
    expect(resp.status()).toBe(400);
    expect(body).toMatchObject({ ok: false, code: 'INVALIDO', message: 'Código inválido.' });

    const tela = await ctx.get('/redefinir-senha', { maxRedirects: 0 });
    expect(tela.status()).toBe(302);
    const post = await redefinirDireto(ctx, { novaSenha: SENHA_NOVA, confirmarSenha: SENHA_NOVA });
    expect(post.resp.status()).toBe(403);
    await ctx.dispose();
  });

  test('OTP expirado é rejeitado', async () => {
    const conta = await criarConta('otp-expirado');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '482913');
    await db.query(
      'UPDATE otps_recuperacao_senha SET expira_em = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE usuario_id = ? AND usado_em IS NULL',
      [conta.usuarioId]
    );

    const { resp, body } = await verificarOtp(ctx, '482913');
    expect(resp.status()).toBe(400);
    expect(body).toMatchObject({ ok: false, code: 'EXPIRADO', message: 'Este código expirou. Solicite um novo código.' });
    await ctx.dispose();
  });

  test('OTP só vale uma vez (segunda verificação do mesmo código falha)', async () => {
    const conta = await criarConta('otp-reuso');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '482913');

    const csrf = await csrfOtp(ctx);
    expect((await verificarOtp(ctx, '482913', csrf)).body.ok).toBe(true);
    const segunda = await verificarOtp(ctx, '482913', csrf);
    expect(segunda.resp.status()).toBe(400);
    expect(segunda.body.ok).toBe(false);
    await ctx.dispose();
  });

  test('OTP já usado numa redefinição não serve de novo', async () => {
    const conta = await criarConta('otp-reuso-pos-reset');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);
    expect((await redefinir(ctx)).body.ok).toBe(true);

    const dnv = await ctx.post('/api/verificar-otp', {
      headers: { 'CSRF-Token': await extrairCsrf(await ctx.get('/login'), 'csrf-login') },
      data: { otp: '482913' },
    });
    expect(dnv.status()).toBe(400);
    await ctx.dispose();
  });

  test('tentativas erradas são limitadas: depois do teto nem o código certo passa', async () => {
    const conta = await criarConta('otp-limite');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '482913');
    const csrf = await csrfOtp(ctx);

    for (let i = 0; i < 5; i++) {
      const r = await verificarOtp(ctx, '111111', csrf);
      expect(r.resp.status()).toBe(400);
      expect(r.body.code).toBe('INVALIDO');
      expect(r.body.tentativasRestantes).toBe(4 - i);
    }
    const certo = await verificarOtp(ctx, '482913', csrf);
    expect(certo.resp.status()).toBe(429);
    expect(certo.body).toMatchObject({ ok: false, code: 'BLOQUEADO' });

    const outra = await novoAtor();
    await solicitar(outra, conta.email);
    const viaOutraSessao = await verificarOtp(outra, '482913');
    expect(viaOutraSessao.resp.status()).toBe(429);
    expect(viaOutraSessao.body.code).toBe('BLOQUEADO');

    const [[linha]] = await db.query(
      'SELECT tentativas, verificado_em FROM otps_recuperacao_senha WHERE usuario_id = ? AND usado_em IS NULL', [conta.usuarioId]
    );
    expect(linha.tentativas).toBe(5);
    expect(linha.verificado_em).toBeNull();
    await ctx.dispose();
    await outra.dispose();
  });

  test('tentativas paralelas não furam o limite (reserva atômica)', async () => {
    const conta = await criarConta('otp-paralelo');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '482913');
    const csrf = await csrfOtp(ctx);

    await Promise.all(Array.from({ length: 12 }, () =>
      ctx.post('/api/verificar-otp', { headers: { 'CSRF-Token': csrf }, data: { otp: '999999' } })));

    const [[linha]] = await db.query(
      'SELECT tentativas FROM otps_recuperacao_senha WHERE usuario_id = ? AND usado_em IS NULL', [conta.usuarioId]
    );
    expect(linha.tentativas).toBeLessThanOrEqual(5);
    await ctx.dispose();
  });

  test('OTP em formato inválido é rejeitado na validação e NÃO gasta tentativa', async () => {
    const conta = await criarConta('otp-formato');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '012345');
    const csrf = await csrfOtp(ctx);

    for (const ruim of ['12345', '1234567', 'abcdef', '12 345', '', 12345, 482913, ['482913'], { a: 1 }, null]) {
      const r = await ctx.post('/api/verificar-otp', { headers: { 'CSRF-Token': csrf }, data: { otp: ruim } });
      expect(r.status(), `otp=${JSON.stringify(ruim)}`).toBe(422);
    }
    const [[linha]] = await db.query(
      'SELECT tentativas FROM otps_recuperacao_senha WHERE usuario_id = ? AND usado_em IS NULL', [conta.usuarioId]
    );
    expect(linha.tentativas).toBe(0);
    await ctx.dispose();
  });

  test('OTP com zero à esquerda ("012345") é preservado como string de ponta a ponta', async () => {
    const conta = await criarConta('otp-zero');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '012345');

    const comoNumero = await ctx.post('/api/verificar-otp', {
      headers: { 'CSRF-Token': await csrfOtp(ctx) }, data: { otp: 12345 },
    });
    expect(comoNumero.status()).toBe(422);
    expect((await verificarOtp(ctx, '123450')).body.ok).toBe(false);
    expect((await verificarOtp(ctx, '012345')).body.ok).toBe(true);
    await ctx.dispose();
  });
});

test.describe('Não dá pra pular o OTP', () => {
  test('/redefinir-senha e /verificar-codigo sem nenhuma solicitação → login', async () => {
    const ctx = await novoAtor();
    for (const rota of ['/redefinir-senha', '/verificar-codigo']) {
      const r = await ctx.get(rota, { maxRedirects: 0 });
      expect(r.status(), rota).toBe(302);
      expect(r.headers().location, rota).toBe('/login');
    }
    await ctx.dispose();
  });

  test('link antigo com ?token=, e-mail/OTP/token forjados na URL não abrem nada', async () => {
    const ctx = await novoAtor();
    const forjado = crypto.randomBytes(32).toString('hex');
    for (const rota of [
      `/redefinir-senha?token=${forjado}`,
      `/redefinir-senha?otp=482913&email=vitima@teste.com`,
      `/verificar-codigo?email=vitima@teste.com&otp=482913`,
    ]) {
      const r = await ctx.get(rota, { maxRedirects: 0 });
      expect(r.status(), rota).toBe(302);
      expect(r.headers().location, rota).toBe('/login');
    }
    await ctx.dispose();
  });

  test('POST /api/redefinir-senha sem OTP validado → 403, mesmo com token/e-mail forjados no body', async () => {
    const conta = await criarConta('sem-otp');
    const ctx = await novoAtor();
    const senhaNova = 'SenhaInvasora!2025';

    const a = await redefinirDireto(ctx, { novaSenha: senhaNova, confirmarSenha: senhaNova });
    expect(a.resp.status()).toBe(403);
    const b = await redefinirDireto(ctx, {
      email: conta.email, token: crypto.randomBytes(32).toString('hex'), autorizacao: 'a'.repeat(64),
      novaSenha: senhaNova, confirmarSenha: senhaNova,
    });
    expect(b.resp.status()).toBe(403);

    await solicitar(ctx, conta.email);
    const c = await redefinirDireto(ctx, { email: conta.email, novaSenha: senhaNova, confirmarSenha: senhaNova });
    expect(c.resp.status()).toBe(403);

    expect((await login(await novoAtor(), { email: conta.email, senha: senhaNova })).resp.status()).toBe(401);
    expect((await login(await novoAtor(), { email: conta.email, senha: SENHA_FORTE })).resp.status()).toBe(200);
    await ctx.dispose();
  });

  test('a autorização é da SESSÃO que acertou o OTP: outro navegador não a usa', async () => {
    const conta = await criarConta('autorizacao-sessao');
    const dono = await novoAtor();
    await ateAutorizacao(dono, conta);

    const invasor = await novoAtor();
    const tela = await invasor.get('/redefinir-senha', { maxRedirects: 0 });
    expect(tela.status()).toBe(302);
    const post = await redefinirDireto(invasor, { email: conta.email, novaSenha: 'SenhaInvasora!2025', confirmarSenha: 'SenhaInvasora!2025' });
    expect(post.resp.status()).toBe(403);

    expect((await dono.get('/redefinir-senha')).status()).toBe(200);
    await dono.dispose();
    await invasor.dispose();
  });

  test('IDOR: o e-mail vem da sessão — mandar o e-mail da vítima no body não move o OTP dela', async () => {
    const atacante = await criarConta('idor-atacante');
    const vitima = await criarConta('idor-vitima');

    const ctxVitima = await novoAtor();
    await solicitar(ctxVitima, vitima.email);
    await plantarOtp(vitima.usuarioId, '222222');

    const ctxAtacante = await novoAtor();
    await solicitar(ctxAtacante, atacante.email);
    await plantarOtp(atacante.usuarioId, '111111');

    const csrf = await csrfOtp(ctxAtacante);
    const r = await ctxAtacante.post('/api/verificar-otp', {
      headers: { 'CSRF-Token': csrf }, data: { otp: '222222', email: vitima.email, usuario_id: vitima.usuarioId },
    });
    expect(r.status()).toBe(400);
    expect((await ctxAtacante.get('/redefinir-senha', { maxRedirects: 0 })).status()).toBe(302);

    const [[linha]] = await db.query(
      'SELECT tentativas, verificado_em FROM otps_recuperacao_senha WHERE usuario_id = ? AND usado_em IS NULL', [vitima.usuarioId]
    );
    expect(linha.tentativas).toBe(0);
    expect(linha.verificado_em).toBeNull();
    expect((await verificarOtp(ctxVitima, '222222')).body.ok).toBe(true);
    await ctxVitima.dispose();
    await ctxAtacante.dispose();
  });

  test('atualizar a página / nova aba mantém o estado seguro (tentativas não zeram)', async () => {
    const conta = await criarConta('otp-refresh');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    await plantarOtp(conta.usuarioId, '482913');

    const csrf = await csrfOtp(ctx);
    for (let i = 0; i < 3; i++) await verificarOtp(ctx, '111111', csrf);

    expect((await ctx.get('/verificar-codigo')).status()).toBe(200);
    expect((await ctx.get('/verificar-codigo')).status()).toBe(200);

    await verificarOtp(ctx, '111111', csrf);
    await verificarOtp(ctx, '111111', csrf);
    const certo = await verificarOtp(ctx, '482913', csrf);
    expect(certo.body.code).toBe('BLOQUEADO');
    await ctx.dispose();
  });

  test('voltar para /verificar-codigo depois do OTP válido leva direto à nova senha (sem pedir código gasto)', async () => {
    const conta = await criarConta('otp-voltar');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);
    const r = await ctx.get('/verificar-codigo', { maxRedirects: 0 });
    expect(r.status()).toBe(302);
    expect(r.headers().location).toBe('/redefinir-senha');
    await ctx.dispose();
  });

  test('autorização expirada não abre a tela nem troca a senha', async () => {
    const conta = await criarConta('autorizacao-expirada');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);
    await db.query(
      'UPDATE otps_recuperacao_senha SET reset_expira_em = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE usuario_id = ? AND usado_em IS NULL',
      [conta.usuarioId]
    );
    expect((await ctx.get('/redefinir-senha', { maxRedirects: 0 })).status()).toBe(302);
    const post = await redefinirDireto(ctx, { novaSenha: SENHA_NOVA, confirmarSenha: SENHA_NOVA });
    expect(post.resp.status()).toBe(403);
    expect((await login(await novoAtor(), { email: conta.email, senha: SENHA_FORTE })).resp.status()).toBe(200);
    await ctx.dispose();
  });
});

test.describe('Redefinição de senha', () => {
  test('após trocar a senha, OTP e autorização ficam invalidados (uso único)', async () => {
    const conta = await criarConta('reset-invalida');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);
    expect((await redefinir(ctx)).body.ok).toBe(true);

    const [[linha]] = await db.query(
      'SELECT usado_em FROM otps_recuperacao_senha WHERE usuario_id = ? ORDER BY id DESC LIMIT 1', [conta.usuarioId]
    );
    expect(linha.usado_em).not.toBeNull();

    expect((await ctx.get('/redefinir-senha', { maxRedirects: 0 })).status()).toBe(302);
    const outra = await redefinirDireto(ctx, { novaSenha: 'MaisUmaSenha!999x', confirmarSenha: 'MaisUmaSenha!999x' });
    expect(outra.resp.status()).toBe(403);
    expect((await login(await novoAtor(), { email: conta.email, senha: SENHA_NOVA })).resp.status()).toBe(200);
    await ctx.dispose();
  });

  test('duas trocas simultâneas com a mesma autorização: só uma passa', async () => {
    const conta = await criarConta('reset-corrida');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);
    const csrf = await extrairCsrf(await ctx.get('/redefinir-senha'), 'csrf-redefinir');

    const [a, b] = await Promise.all(['SenhaCorrida!AAA111', 'SenhaCorrida!BBB222'].map((s) =>
      ctx.post('/api/redefinir-senha', { headers: { 'CSRF-Token': csrf }, data: { novaSenha: s, confirmarSenha: s } })));
    expect([a.status(), b.status()].sort()).toEqual([200, 403]);
    await ctx.dispose();
  });

  test('senha fraca é rejeitada e NÃO queima a autorização (dá pra tentar de novo)', async () => {
    const conta = await criarConta('reset-fraca');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);

    const fraca = await redefinir(ctx, { novaSenha: '123456789012' });
    expect(fraca.resp.status()).toBe(422);
    const ok = await redefinir(ctx, { novaSenha: SENHA_NOVA });
    expect(ok.body.ok).toBe(true);
    await ctx.dispose();
  });

  test('confirmação diferente da nova senha é rejeitada', async () => {
    const conta = await criarConta('reset-confirmacao');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);
    const r = await redefinir(ctx, { novaSenha: SENHA_NOVA, confirmarSenha: SENHA_NOVA + 'x' });
    expect(r.resp.status()).toBe(422);
    await ctx.dispose();
  });

  test('redefinir a senha revoga sessões ativas anteriores', async () => {
    const sessaoAtiva = await novoAtor();
    const email = emailAleatorio('reset-revoga-sessao');
    await cadastrar(sessaoAtiva, { email }); // cadastro já loga
    expect((await sessaoAtiva.get('/api/me')).status()).toBe(200);
    const [[u]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);

    const outro = await novoAtor();
    await ateAutorizacao(outro, { email, usuarioId: u.id });
    expect((await redefinir(outro)).body.ok).toBe(true);

    expect((await sessaoAtiva.get('/api/me')).status()).toBe(401);
    await sessaoAtiva.dispose();
    await outro.dispose();
  });

  test('conta bloqueada pelo admin no meio do fluxo não consegue trocar a senha', async () => {
    const conta = await criarConta('reset-bloqueada');
    const ctx = await novoAtor();
    await ateAutorizacao(ctx, conta);
    await db.query('UPDATE usuarios SET ativo = 0 WHERE id = ?', [conta.usuarioId]);

    const post = await redefinirDireto(ctx, { novaSenha: SENHA_NOVA, confirmarSenha: SENHA_NOVA });
    expect(post.resp.status()).toBe(403);
    await ctx.dispose();
  });
});

/* TESTE 7 + reenvio/cooldown */
test.describe('Reenvio do código', () => {
  test('cooldown bloqueia reenvio imediato; após o cooldown gera código novo e invalida o anterior', async () => {
    test.setTimeout(60_000);
    const conta = await criarConta('reenvio');
    const ctx = await novoAtor();
    const primeira = await solicitar(ctx, conta.email);
    expect(primeira.body.segundosRestantes).toBeGreaterThan(0);
    const idA = await plantarOtp(conta.usuarioId, '111111');

    const csrf = await csrfOtp(ctx);
    const cedo = await ctx.post('/api/reenviar-codigo', { headers: { 'CSRF-Token': csrf } });
    expect(cedo.status()).toBe(429);
    const cedoBody = await cedo.json();
    expect(cedoBody.code).toBe('COOLDOWN');
    expect(cedoBody.segundosRestantes).toBeGreaterThan(0);

    await dormir(COOLDOWN_MS + 1_000);

    const depois = await ctx.post('/api/reenviar-codigo', { headers: { 'CSRF-Token': csrf } });
    expect(depois.status()).toBe(200);
    expect((await depois.json()).segundosRestantes).toBe(COOLDOWN_MS / 1000);

    const idB = await plantarOtp(conta.usuarioId, '222222', { esperarNovaLinhaAlemDe: idA });
    expect(idB).toBeGreaterThan(idA);

    const comA = await verificarOtp(ctx, '111111', csrf);
    expect(comA.resp.status()).toBe(400);
    expect((await verificarOtp(ctx, '222222', csrf)).body.ok).toBe(true);
    await ctx.dispose();
  });

  test('reenviar sem ter solicitado → 400 apontando pro login', async () => {
    const ctx = await novoAtor();
    const csrf = await extrairCsrf(await ctx.get('/login'), 'csrf-login');
    const r = await ctx.post('/api/reenviar-codigo', { headers: { 'CSRF-Token': csrf } });
    expect(r.status()).toBe(400);
    expect((await r.json()).redirect).toBe('/login');
    await ctx.dispose();
  });

  test('pedir de novo o MESMO e-mail dentro do cooldown não recria o OTP nem zera a contagem', async () => {
    const conta = await criarConta('reenvio-mesmo-email');
    const ctx = await novoAtor();
    await solicitar(ctx, conta.email);
    const idA = await plantarOtp(conta.usuarioId, '111111');
    const dnv = await solicitar(ctx, conta.email);
    expect(dnv.body.segundosRestantes).toBeLessThanOrEqual(COOLDOWN_MS / 1000);
    await dormir(600);
    expect(await ultimoIdOtp(conta.usuarioId)).toBe(idA); // nenhuma linha nova
    await ctx.dispose();
  });

  test('cooldown do usuário vale no banco mesmo trocando de sessão (sem inundar a caixa de e-mail)', async () => {
    const conta = await criarConta('reenvio-multi-sessao');
    const a = await novoAtor();
    await solicitar(a, conta.email);
    const idA = await plantarOtp(conta.usuarioId, '111111');

    for (let i = 0; i < 3; i++) {
      const outra = await novoAtor();
      await solicitar(outra, conta.email); // sessão nova a cada pedido
      await outra.dispose();
    }
    await dormir(600);
    expect(await ultimoIdOtp(conta.usuarioId)).toBe(idA);
    await a.dispose();
  });
});

/* Anti-enumeração */
test.describe('Anti-enumeração de contas', () => {
  test('e-mail inexistente recebe a MESMA resposta, a MESMA tela de OTP e "Código inválido."', async () => {
    const existe = await criarConta('enum-existe');
    const ctxA = await novoAtor();
    const ctxB = await novoAtor();

    const a = await solicitar(ctxA, existe.email);
    const b = await solicitar(ctxB, emailAleatorio('enum-nao-existe'));
    expect(b.resp.status()).toBe(a.resp.status());
    expect({ ...b.body, segundosRestantes: 0 }).toEqual({ ...a.body, segundosRestantes: 0 });

    expect((await ctxA.get('/verificar-codigo')).status()).toBe(200);
    expect((await ctxB.get('/verificar-codigo')).status()).toBe(200);

    const errA = await verificarOtp(ctxA, '000000');
    const errB = await verificarOtp(ctxB, '000000');
    expect(errB.resp.status()).toBe(errA.resp.status());
    expect(errB.body).toEqual(errA.body);
    await ctxA.dispose();
    await ctxB.dispose();
  });

  test('e-mail inexistente também esgota tentativas (mesmo comportamento da conta real)', async () => {
    const ctx = await novoAtor();
    await solicitar(ctx, emailAleatorio('enum-limite'));
    const csrf = await csrfOtp(ctx);
    for (let i = 0; i < 5; i++) await verificarOtp(ctx, '000000', csrf);
    const r = await verificarOtp(ctx, '000000', csrf);
    expect(r.resp.status()).toBe(429);
    expect(r.body.code).toBe('BLOQUEADO');
    await ctx.dispose();
  });
});

test.describe('OTP Input (navegador)', () => {
  async function irParaTelaOtp(page, conta, otp) {
    await page.goto('/login');
    await page.click('#abrir-modal-senha');
    await page.fill('#rec-email', conta.email);
    await page.click('#btn-rec-senha');
    await page.waitForURL('**/verificar-codigo');
    await plantarOtp(conta.usuarioId, otp);
  }
  const campos = (page) => page.locator('.otp-digito');
  const valores = async (page) => campos(page).evaluateAll((els) => els.map((e) => e.value));

  test('fluxo pela UI: modal → tela OTP → digitando manualmente (zero à esquerda) → nova senha', async ({ page }) => {
    const conta = await criarConta('ui-manual');
    await irParaTelaOtp(page, conta, '012345');

    await expect(campos(page)).toHaveCount(6);
    await expect(campos(page).first()).toBeFocused();
    await expect(page.locator('#btn-redefinir-senha')).toHaveCount(0);

    await page.keyboard.type('012345');
    expect(await valores(page)).toEqual(['0', '1', '2', '3', '4', '5']);

    const reqPromise = page.waitForRequest((r) => r.url().endsWith('/api/verificar-otp'));
    await page.click('#btn-verificar-otp');
    const req = await reqPromise;
    expect(req.postDataJSON()).toEqual({ otp: '012345' }); // STRING com o zero preservado
    expect(typeof req.postDataJSON().otp).toBe('string');

    await page.waitForURL('**/redefinir-senha');
    await expect(page.locator('#btn-redefinir-senha')).toBeVisible();
    // token/e-mail nunca aparecem na URL
    expect(page.url()).not.toMatch(/token|otp|email/i);

    await page.fill('#nova-senha-redefinir', SENHA_NOVA);
    await page.fill('#confirmar-senha-redefinir', SENHA_NOVA);
    await page.click('#btn-redefinir-senha');
    await page.waitForURL('**/login');
    expect((await login(await novoAtor(), { email: conta.email, senha: SENHA_NOVA })).resp.status()).toBe(200);
  });

  test('colar o código completo (mesmo com espaços/hífen) preenche as 6 caixas na ordem', async ({ page }) => {
    const conta = await criarConta('ui-colar');
    await irParaTelaOtp(page, conta, '012345');

    await campos(page).nth(3).focus();
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text', ' 012-345 ');
      document.querySelectorAll('.otp-digito')[3].dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
    });
    expect(await valores(page)).toEqual(['0', '1', '2', '3', '4', '5']);

    const reqPromise = page.waitForRequest((r) => r.url().endsWith('/api/verificar-otp'));
    await page.click('#btn-verificar-otp');
    expect((await reqPromise).postDataJSON()).toEqual({ otp: '012345' });
    await page.waitForURL('**/redefinir-senha');
  });

  test('autofill/colagem que chega no evento "input" da 1.ª caixa é distribuído', async ({ page }) => {
    const conta = await criarConta('ui-autofill');
    await irParaTelaOtp(page, conta, '907001');
    await campos(page).first().evaluate((el) => {
      el.value = '907001';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(await valores(page)).toEqual(['9', '0', '7', '0', '0', '1']);
  });

  test('só dígitos: letras/símbolos são barrados; backspace apaga e volta; setas movem o foco', async ({ page }) => {
    const conta = await criarConta('ui-teclado');
    await irParaTelaOtp(page, conta, '123456');

    await page.keyboard.type('a-b!1');
    expect(await valores(page)).toEqual(['1', '', '', '', '', '']);
    await expect(campos(page).nth(1)).toBeFocused();

    await page.keyboard.type('23');
    expect(await valores(page)).toEqual(['1', '2', '3', '', '', '']);

    await page.keyboard.press('Backspace');
    expect(await valores(page)).toEqual(['1', '2', '', '', '', '']);
    await expect(campos(page).nth(2)).toBeFocused();

    await page.keyboard.press('ArrowLeft');
    await expect(campos(page).nth(1)).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(campos(page).nth(2)).toBeFocused();
  });

  test('código incompleto não é enviado; código errado limpa as caixas e mostra "Código inválido."', async ({ page }) => {
    const conta = await criarConta('ui-erro');
    await irParaTelaOtp(page, conta, '482913');
    let chamadas = 0;
    page.on('request', (r) => { if (r.url().endsWith('/api/verificar-otp')) chamadas++; });

    await page.keyboard.type('4829');
    await page.click('#btn-verificar-otp');
    await expect(page.locator('#otp-msg-geral')).toContainText('Digite os 6 dígitos');
    expect(chamadas).toBe(0);

    await campos(page).first().focus();
    await page.keyboard.type('000000');
    await page.click('#btn-verificar-otp');
    await expect(page.locator('#otp-msg-geral')).toHaveText('Código inválido.');
    expect(await valores(page)).toEqual(['', '', '', '', '', '']);
    await expect(campos(page).first()).toBeFocused();
    expect(page.url()).toContain('/verificar-codigo'); // continua na tela do OTP
  });

  test('timer: um único contador, botão de reenvio travado, e refresh retoma o tempo do servidor', async ({ page }) => {
    test.setTimeout(60_000);
    const conta = await criarConta('ui-timer');
    await irParaTelaOtp(page, conta, '482913');

    await expect(page.locator('#btn-reenviar-otp')).toBeDisabled();
    await expect(page.locator('#otp-timer')).toContainText(/novo código em \d+ segundo/);
    const antes = Number((await page.locator('#otp-timer').textContent()).match(/\d+/)[0]);

    await page.reload();
    await expect(page.locator('#otp-timer')).toContainText(/novo código em \d+ segundo/);
    const depois = Number((await page.locator('#otp-timer').textContent()).match(/\d+/)[0]);
    expect(depois).toBeLessThanOrEqual(antes);

    await expect(page.locator('#btn-reenviar-otp')).toBeEnabled({ timeout: (COOLDOWN_MS + 2_000) });
    await expect(page.locator('#otp-timer')).toHaveText('');

    await page.click('#btn-reenviar-otp');
    await expect(page.locator('#otp-msg-geral')).toContainText('novo código');
    const leituras = [];
    for (let i = 0; i < 4; i++) {
      leituras.push(Number((await page.locator('#otp-timer').textContent()).match(/\d+/)[0]));
      await page.waitForTimeout(700);
    }
    for (let i = 1; i < leituras.length; i++) expect(leituras[i]).toBeLessThanOrEqual(leituras[i - 1]);
  });

  test('layout em 320px não gera rolagem horizontal', async ({ page }) => {
    const conta = await criarConta('ui-320');
    await page.setViewportSize({ width: 320, height: 640 });
    await irParaTelaOtp(page, conta, '482913');
    const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    expect(sw).toBeLessThanOrEqual(cw);
    for (const box of await campos(page).all()) {
      const r = await box.boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(320);
    }
  });
});

/* CSRF e rate limiting */
test.describe('CSRF', () => {
  test('todos os POSTs do fluxo sem token CSRF são rejeitados', async () => {
    const ctx = await novoAtor();
    for (const [rota, data] of [
      ['/api/recuperar-senha', { email: 'qualquer@teste.com' }],
      ['/api/reenviar-codigo', {}],
      ['/api/verificar-otp', { otp: '123456' }],
      ['/api/redefinir-senha', { novaSenha: SENHA_NOVA, confirmarSenha: SENHA_NOVA }],
    ]) {
      expect((await ctx.post(rota, { data })).status(), rota).toBe(403);
    }
    await ctx.dispose();
  });
});

test.describe('Rate limiting', () => {
  test('solicitação/reenvio de OTP bloqueia por IP após várias tentativas seguidas', async () => {
    const ctx = await novoAtor();
    let ultimoStatus = 200;
    for (let i = 0; i < 300; i++) {
      const { resp } = await solicitar(ctx, emailAleatorio('rate-otp-' + i));
      ultimoStatus = resp.status();
      if (ultimoStatus === 429) break;
    }
    expect(ultimoStatus).toBe(429);
    await ctx.dispose();
  });

  test('verificação de OTP tem teto por IP (independente do limite por código)', async () => {
    const ctx = await novoAtor();
    const csrf = await extrairCsrf(await ctx.get('/login'), 'csrf-login');
    let codigo = null;
    for (let i = 0; i < 300; i++) {
      const r = await ctx.post('/api/verificar-otp', { headers: { 'CSRF-Token': csrf }, data: { otp: '000000' } });
      if (r.status() === 429) { codigo = (await r.json()).code; break; }
    }
    expect(codigo).toBe('LIMITE_IP');
    await ctx.dispose();
  });
});
