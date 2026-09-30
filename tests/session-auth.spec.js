require('dotenv').config();
const { test, expect, request: pwRequest } = require('@playwright/test');
const crypto = require('crypto');
const db = require('../config/db');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const LOGIN_MAX_TENTATIVAS = parseInt(process.env.LOGIN_MAX_TENTATIVAS || '5', 10);
const SENHA_FORTE = 'SenhaForte!2024xyz';

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

async function novoAtor() {
  return pwRequest.newContext({ baseURL: BASE_URL });
}

async function extrairCsrf(resp, idCampo) {
  const html = await resp.text();
  const m = html.match(new RegExp(`id="${idCampo}" value="([^"]+)"`));
  if (!m) throw new Error(`Não achei o campo ${idCampo} na resposta de ${resp.url()} (status ${resp.status()})`);
  return m[1];
}

async function cadastrar(ctx, { email, senha = SENHA_FORTE, nome = 'Teste AAA' } = {}) {
  const pagina = await ctx.get('/cadastro');
  const csrf = await extrairCsrf(pagina, 'csrf-cadastro');
  const cpf = cpfValidoAleatorio();
  const resp = await ctx.post('/api/cadastro', {
    headers: { 'CSRF-Token': csrf },
    data: { nome, email, cpf, telefone: '(11) 91234-5678', senha, confirmar: senha },
  });
  return { resp, body: await resp.json().catch(() => null) };
}

async function login(ctx, { email, senha }) {
  const pagina = await ctx.get('/login');
  const csrf = await extrairCsrf(pagina, 'csrf-login');
  const resp = await ctx.post('/api/login', { headers: { 'CSRF-Token': csrf }, data: { email, senha } });
  return { resp, body: await resp.json().catch(() => null) };
}

async function csrfLogado(ctx) {
  const pagina = await ctx.get('/perfil');
  return extrairCsrf(pagina, 'csrf-token');
}

test.describe.configure({ mode: 'serial' });

test.describe('Login', () => {
  test('credenciais válidas autenticam e criam sessão', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('login-ok');
    const { body: cadastroBody } = await cadastrar(ctx, { email });
    expect(cadastroBody.ok).toBe(true);
    const csrfPreLogout = await csrfLogado(ctx);
    await ctx.post('/api/logout', { headers: { 'CSRF-Token': csrfPreLogout } });

    // Act
    const { resp, body } = await login(ctx, { email, senha: SENHA_FORTE });

    // Assert
    expect(resp.status()).toBe(200);
    expect(body.ok).toBe(true);
    const me = await ctx.get('/api/me');
    expect(me.status()).toBe(200);
    await ctx.dispose();
  });

  test('senha inválida é rejeitada com mensagem genérica', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('login-senha-errada');
    await cadastrar(ctx, { email });

    const outroAtor = await novoAtor();
    const { resp, body } = await login(outroAtor, { email, senha: 'SenhaErrada!123456' });

    expect(resp.status()).toBe(401);
    expect(body.message).toBe('E-mail ou senha incorretos.');
    await ctx.dispose();
    await outroAtor.dispose();
  });

  test('usuário inexistente recebe a MESMA mensagem genérica (anti-enumeração)', async () => {
    const ctx = await novoAtor();
    const { resp, body } = await login(ctx, { email: emailAleatorio('nao-existe'), senha: 'QualquerSenha!123' });

    expect(resp.status()).toBe(401);
    expect(body.message).toBe('E-mail ou senha incorretos.');
    await ctx.dispose();
  });

  test.describe('Área administrativa', () => {
    test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, 'defina ADMIN_EMAIL/ADMIN_PASSWORD');

    test('conta bloqueada pelo admin não consegue logar', async () => {
      const clienteCtx = await novoAtor();
      const email = emailAleatorio('bloqueado');
      await cadastrar(clienteCtx, { email });

      const adminCtx = await novoAtor();
      await login(adminCtx, { email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_PASSWORD });
      const csrfAdmin = await csrfLogado(adminCtx);

      const [[cliente]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
      const bloquear = await adminCtx.patch(`/api/admin/clientes/${cliente.id}/ativo`, { headers: { 'CSRF-Token': csrfAdmin } });
      expect(bloquear.ok()).toBe(true);

      // Act
      const tentativaCtx = await novoAtor();
      const { resp, body } = await login(tentativaCtx, { email, senha: SENHA_FORTE });

      // Assert
      expect(resp.status()).toBe(403);
      expect(body.code).toBe('CONTA_BLOQUEADA');

      await adminCtx.patch(`/api/admin/clientes/${cliente.id}/ativo`, { headers: { 'CSRF-Token': csrfAdmin } });
      await clienteCtx.dispose();
      await adminCtx.dispose();
      await tentativaCtx.dispose();
    });
  });
});

test.describe('Sessão', () => {
  test('sessão válida permite acessar rota protegida', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('sessao-valida');
    await cadastrar(ctx, { email }); // já loga automaticamente

    const me = await ctx.get('/api/me');
    const body = await me.json();

    expect(me.status()).toBe(200);
    expect(body.data.email).toBe(email);
    await ctx.dispose();
  });

  test('sessão inexistente (sem cookie) é rejeitada em rota protegida', async () => {
    const ctx = await novoAtor(); // nunca logou nesse contexto
    const resp = await ctx.get('/api/me');
    expect(resp.status()).toBe(401);
    await ctx.dispose();
  });

  test('cookie de sessão adulterado é rejeitado', async () => {
    const ctx = await novoAtor();
    const resp = await ctx.get('/api/me', {
      headers: { cookie: 'floria.sid=s%3AvalorForjadoQueNaoExiste.assinaturaInvalida' },
    });
    expect(resp.status()).toBe(401);
    await ctx.dispose();
  });

  test('sessão revogada (logout em outro dispositivo) para de funcionar', async () => {
    // Arrange
    const ctx = await novoAtor();
    const email = emailAleatorio('sessao-revogada');
    await cadastrar(ctx, { email });
    const antes = await ctx.get('/api/me');
    expect(antes.status()).toBe(200);

    const [[usuario]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    await db.query('UPDATE sessoes_seguranca SET revogado_em = NOW() WHERE usuario_id = ?', [usuario.id]);

    const depois = await ctx.get('/api/me');

    // Assert
    expect(depois.status()).toBe(401);
    await ctx.dispose();
  });

  test('timeout absoluto expirado invalida a sessão mesmo com atividade', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('sessao-expirada');
    await cadastrar(ctx, { email });

    const [[usuario]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
    await db.query('UPDATE sessoes_seguranca SET expira_em = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE usuario_id = ?', [usuario.id]);

    const resp = await ctx.get('/api/me');
    expect(resp.status()).toBe(401);
    await ctx.dispose();
  });

  test('session fixation: session_id muda após login', async () => {
    const ctx = await novoAtor();
    const antes = await ctx.get('/');
    const cookiesAntes = await ctx.storageState();
    const sidAntes = cookiesAntes.cookies.find((c) => c.name.includes('floria.sid'))?.value;

    const email = emailAleatorio('fixation');
    const setupCtx = await novoAtor();
    await cadastrar(setupCtx, { email });

    await login(ctx, { email, senha: SENHA_FORTE });
    const cookiesDepois = await ctx.storageState();
    const sidDepois = cookiesDepois.cookies.find((c) => c.name.includes('floria.sid'))?.value;

    // Assert
    expect(sidAntes).toBeTruthy();
    expect(sidDepois).toBeTruthy();
    expect(sidDepois).not.toBe(sidAntes);
    await ctx.dispose();
    await setupCtx.dispose();
  });
});

test.describe('Cookies', () => {
  test('cookie de sessão tem HttpOnly e SameSite=Strict', async () => {
    const ctx = await novoAtor();
    const resp = await ctx.get('/');
    const setCookie = resp.headers()['set-cookie'] || '';
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Strict/i);
    if (process.env.NODE_ENV === 'production') {
      expect(setCookie).toMatch(/Secure/i);
    }
    await ctx.dispose();
  });
});

test.describe('Autorização (IDOR / BOLA)', () => {
  test('usuário A não acessa endereço do usuário B', async () => {
    const ctxB = await novoAtor();
    const emailB = emailAleatorio('usuarioB');
    await cadastrar(ctxB, { email: emailB });
    const csrfB = await csrfLogado(ctxB);
    const criarEndereco = await ctxB.post('/api/enderecos', {
      headers: { 'CSRF-Token': csrfB },
      data: {
        rotulo: 'Casa', destinatario: 'B', telefone: '11999999999', cep: '01310-100',
        logradouro: 'Rua B', numero: '1', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', padrao: true,
      },
    });
    const { id: enderecoIdDeB } = await criarEndereco.json();

    const ctxA = await novoAtor();
    const emailA = emailAleatorio('usuarioA');
    await cadastrar(ctxA, { email: emailA });
    const csrfA = await csrfLogado(ctxA);

    const tentativaLeitura = await ctxA.get('/api/enderecos');
    const enderecosDeA = (await tentativaLeitura.json()).enderecos;

    const tentativaEdicao = await ctxA.put(`/api/enderecos/${enderecoIdDeB}`, {
      headers: { 'CSRF-Token': csrfA },
      data: {
        rotulo: 'Hackeado', destinatario: 'A', telefone: '11888888888', cep: '01310-100',
        logradouro: 'Rua A', numero: '2', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
      },
    });

    // Assert
    expect(enderecosDeA.find((e) => e.id === enderecoIdDeB)).toBeUndefined();
    expect(tentativaEdicao.status()).toBe(404);
    await ctxA.dispose();
    await ctxB.dispose();
  });

  test('usuário comum não acessa endpoint admin', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('nao-admin');
    await cadastrar(ctx, { email });

    const resp = await ctx.get('/api/admin/usuarios/buscar-clientes?q=a', { maxRedirects: 0 });

    expect(resp.status()).toBe(403);
    const body = await resp.json();
    expect(body.ok).toBe(false);
    await ctx.dispose();
  });

  test.describe('Admin', () => {
    test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, 'defina ADMIN_EMAIL/ADMIN_PASSWORD');

    test('admin autorizado acessa endpoint admin', async () => {
      const ctx = await novoAtor();
      await login(ctx, { email: process.env.ADMIN_EMAIL, senha: process.env.ADMIN_PASSWORD });

      const resp = await ctx.get('/api/admin/usuarios/buscar-clientes?q=a');

      expect(resp.status()).toBe(200);
      await ctx.dispose();
    });
  });
});

test.describe('Logout', () => {
  test('logout invalida a sessão — acesso posterior é negado', async () => {
    // Arrange
    const ctx = await novoAtor();
    const email = emailAleatorio('logout');
    await cadastrar(ctx, { email });
    const antes = await ctx.get('/api/me');
    expect(antes.status()).toBe(200);
    const csrf = await csrfLogado(ctx);

    // Act
    await ctx.post('/api/logout', { headers: { 'CSRF-Token': csrf } });

    // Assert
    const depois = await ctx.get('/api/me');
    expect(depois.status()).toBe(401);
    await ctx.dispose();
  });
});

test.describe('CSRF', () => {
  test('POST sem token CSRF é rejeitado', async () => {
    const ctx = await novoAtor();
    const resp = await ctx.post('/api/login', { data: { email: 'qualquer@teste.com', senha: 'qualquer' } });
    expect(resp.status()).toBe(403);
    await ctx.dispose();
  });

  test('POST com Origin de outro domínio é rejeitado mesmo com cookie válido', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('csrf-origin');
    await cadastrar(ctx, { email });
    const csrf = await csrfLogado(ctx);

    const resp = await ctx.post('/api/logout', {
      headers: { 'CSRF-Token': csrf, origin: 'https://site-atacante.exemplo' },
    });

    expect(resp.status()).toBe(403);
    await ctx.dispose();
  });
});

test.describe('Rate limiting', () => {
  test('login bloqueia após várias tentativas seguidas', async () => {
    const ctx = await novoAtor();
    const email = emailAleatorio('rate-limit');
    let ultimoStatus = 200;
    for (let i = 0; i < LOGIN_MAX_TENTATIVAS + 2; i++) {
      const { resp } = await login(ctx, { email, senha: 'SenhaErrada!' + i });
      ultimoStatus = resp.status();
      if (ultimoStatus === 429) break;
    }
    expect(ultimoStatus).toBe(429);
    await ctx.dispose();
  });
});
