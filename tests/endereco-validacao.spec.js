require('dotenv').config();
const { test, expect, request: pwRequest } = require('@playwright/test');
const crypto = require('crypto');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

function emailAleatorio() {
  return `endereco_teste_${Date.now()}_${crypto.randomBytes(4).toString('hex')}@teste.floria.local`;
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

async function extrairCsrf(resp, idCampo) {
  const html = await resp.text();
  const m = html.match(new RegExp(`id="${idCampo}" value="([^"]+)"`));
  if (!m) throw new Error(`Não achei o campo ${idCampo} na resposta de ${resp.url()} (status ${resp.status()})`);
  return m[1];
}

async function atorAutenticado() {
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  const paginaCadastro = await ctx.get('/cadastro');
  const csrfCadastro = await extrairCsrf(paginaCadastro, 'csrf-cadastro');
  const senha = 'SenhaForte!2024xyz';
  await ctx.post('/api/cadastro', {
    headers: { 'CSRF-Token': csrfCadastro },
    data: {
      nome: 'Teste Endereco', email: emailAleatorio(), cpf: cpfValidoAleatorio(),
      telefone: '(11) 91234-5678', senha, confirmar: senha,
    },
  });
  const paginaPerfil = await ctx.get('/perfil');
  const csrf = await extrairCsrf(paginaPerfil, 'csrf-token');
  return { ctx, csrf };
}

const ENDERECO_BASE = {
  rotulo: 'Casa', destinatario: 'Teste Automatizado', telefone: '11987654321',
  cep: '01310-100', logradouro: 'Avenida Paulista', numero: '1000',
  complemento: '', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP', referencia: '', padrao: false,
};

test.describe.configure({ mode: 'serial' });

test.describe('Validação de existência de endereço', () => {
  let ctx, csrf;

  test.beforeAll(async () => {
    ({ ctx, csrf } = await atorAutenticado());
  });

  test.afterAll(async () => {
    await ctx.dispose();
  });

  test('endereço real com CEP/rua/número existentes → VALID', async () => {
    const resp = await ctx.post('/api/enderecos/verificar', { headers: { 'CSRF-Token': csrf }, data: ENDERECO_BASE });
    const body = await resp.json();
    expect(resp.status()).toBe(200);
    expect(body.validacao.status).toBe('valid');
  });

  test('CEP inexistente é BLOQUEADO (não salva), erro aponta pro campo cep', async () => {
    const resp = await ctx.post('/api/enderecos', {
      headers: { 'CSRF-Token': csrf },
      data: { ...ENDERECO_BASE, cep: '00000-000' },
    });
    const body = await resp.json();
    expect(resp.status()).toBe(422);
    expect(body.ok).toBe(false);
    expect(body.errors.some(e => e.path === 'cep')).toBe(true);
  });

  test('UF incompatível com o CEP é BLOQUEADA (não salva)', async () => {
    const resp = await ctx.post('/api/enderecos', {
      headers: { 'CSRF-Token': csrf },
      data: { ...ENDERECO_BASE, uf: 'RJ' },
    });
    const body = await resp.json();
    expect(resp.status()).toBe(422);
    expect(body.errors.some(e => e.path === 'uf')).toBe(true);
  });

  test('cidade incompatível com o CEP é BLOQUEADA (não salva)', async () => {
    const resp = await ctx.post('/api/enderecos', {
      headers: { 'CSRF-Token': csrf },
      data: { ...ENDERECO_BASE, cidade: 'Campinas' },
    });
    const body = await resp.json();
    expect(resp.status()).toBe(422);
    expect(body.errors.some(e => e.path === 'cidade')).toBe(true);
  });

  test('endereço real de verdade É SALVO com validacao.status = valid', async () => {
    const resp = await ctx.post('/api/enderecos', { headers: { 'CSRF-Token': csrf }, data: ENDERECO_BASE });
    const body = await resp.json();
    expect(resp.status()).toBe(201);
    expect(body.ok).toBe(true);
    expect(body.validacao.status).toBe('valid');

    const lista = await (await ctx.get('/api/enderecos')).json();
    const salvo = lista.enderecos.find(e => e.id === body.id);
    expect(salvo.validacao_status).toBe('valid');
    expect(salvo.validacao_fonte).toBe('viacep+nominatim');
  });

  test('rua não localizável NÃO bloqueia o salvamento (NOT_FOUND é avisado, não recusado)', async () => {
    const resp = await ctx.post('/api/enderecos', {
      headers: { 'CSRF-Token': csrf },
      data: { ...ENDERECO_BASE, logradouro: 'Rua Inexistente Fictícia Xyzabc123', numero: '1' },
    });
    const body = await resp.json();
    expect(resp.status()).toBe(201); // salva mesmo assim
    expect(body.validacao.status).toBe('not_found');
  });

  test('tentativa de mass assignment (id/usuario_id/validacao_status forjados) é ignorada', async () => {
    const resp = await ctx.post('/api/enderecos', {
      headers: { 'CSRF-Token': csrf },
      data: { ...ENDERECO_BASE, id: 999999, usuario_id: 1, validacao_status: 'valid', admin: true },
    });
    const body = await resp.json();
    expect(resp.status()).toBe(201);
    expect(body.id).not.toBe(999999);

    const lista = await (await ctx.get('/api/enderecos')).json();
    const salvo = lista.enderecos.find(e => e.id === body.id);
    expect(salvo.validacao_status).toBe('valid');
  });

  test('duas gravações concorrentes marcando padrão=true nunca deixam 2 endereços padrão', async () => {
    const [a, b] = await Promise.all([
      ctx.post('/api/enderecos', { headers: { 'CSRF-Token': csrf }, data: { ...ENDERECO_BASE, logradouro: 'Rua Augusta', numero: '500', padrao: true } }),
      ctx.post('/api/enderecos', { headers: { 'CSRF-Token': csrf }, data: { ...ENDERECO_BASE, logradouro: 'Rua Oscar Freire', numero: '300', padrao: true } }),
    ]);
    expect(a.status()).toBe(201);
    expect(b.status()).toBe(201);

    const lista = await (await ctx.get('/api/enderecos')).json();
    const padroes = lista.enderecos.filter(e => e.padrao);
    expect(padroes.length).toBe(1);
  });

  test('serviço externo indisponível não vira "endereço inválido" (timeout simulado)', async () => {
    const originalTimeout = process.env.VIACEP_TIMEOUT_MS;
    process.env.VIACEP_TIMEOUT_MS = '1';
    delete require.cache[require.resolve('../app/services/enderecoValidationService')];
    const servico = require('../app/services/enderecoValidationService');
    const resultado = await servico.validarExistenciaEndereco({
      cep: '01310-100', logradouro: 'Avenida Paulista', numero: '1000', bairro: 'Bela Vista', cidade: 'São Paulo', uf: 'SP',
    });
    if (originalTimeout === undefined) delete process.env.VIACEP_TIMEOUT_MS;
    else process.env.VIACEP_TIMEOUT_MS = originalTimeout;
    delete require.cache[require.resolve('../app/services/enderecoValidationService')];

    expect(resultado.status).toBe('SERVICE_UNAVAILABLE');
    expect(resultado.status).not.toBe('INVALID');
  });

  test('rate limit de /api/enderecos/verificar bloqueia excesso de chamadas', async () => {
    const limite = parseInt(process.env.ENDERECO_VERIFICAR_MAX_REQUISICOES || '15', 10);
    let bloqueado = 0;
    for (let i = 0; i < limite + 5; i++) {
      const resp = await ctx.post('/api/enderecos/verificar', { headers: { 'CSRF-Token': csrf }, data: ENDERECO_BASE });
      if (resp.status() === 429) bloqueado++;
    }
    expect(bloqueado).toBeGreaterThan(0);
  });
});
