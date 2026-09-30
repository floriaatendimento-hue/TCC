require('dotenv').config();
const { test, expect, request: pwRequest, chromium } = require('@playwright/test');
const crypto = require('crypto');
const http = require('http');
const express = require('express');
const db = require('../config/db');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SENHA = 'SenhaForte!2024xyz';

function cpfValidoAleatorio() {
  const base = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const dv = (nums) => { let s = 0; for (let i = 0; i < nums.length; i++) s += nums[i] * (nums.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
  const d1 = dv(base);
  return [...base, d1, dv([...base, d1])].join('');
}
const csrfDe = async (ctx, url, id) => {
  const html = await (await ctx.get(url)).text();
  const m = html.match(new RegExp(`id="${id}" value="([^"]+)"`));
  if (!m) throw new Error(`campo ${id} não encontrado em ${url}`);
  return m[1];
};

const usuariosCriados = [];
const produtosCriados = [];
const fornecedoresCriados = [];
const cuponsCriados = [];
const pedidosCriados = [];

async function novoUsuario(papel = 'cliente') {
  const email = `chk_${papel}_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@teste.floria.local`;
  const anon = await pwRequest.newContext({ baseURL: BASE_URL });
  const r = await anon.post('/api/cadastro', {
    headers: { 'CSRF-Token': await csrfDe(anon, '/cadastro', 'csrf-cadastro') },
    data: { nome: `Chk ${papel}`, email, cpf: cpfValidoAleatorio(), telefone: '(11) 91234-5678', senha: SENHA, confirmar: SENHA },
  });
  expect(r.status()).toBe(201);
  const [[u]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);
  usuariosCriados.push(u.id);
  if (papel === 'admin') await db.query("UPDATE usuarios SET papel = 'admin' WHERE id = ?", [u.id]);
  const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
  const l = await ctx.post('/api/login', { headers: { 'CSRF-Token': await csrfDe(ctx, '/login', 'csrf-login') }, data: { email, senha: SENHA } });
  expect(l.status()).toBe(200);
  const H = { 'CSRF-Token': await csrfDe(ctx, '/perfil', 'csrf-token') };
  return { ctx, H, email, id: u.id };
}

async function comEndereco(u) {
  await db.query(
    "INSERT INTO enderecos (usuario_id, rotulo, destinatario, telefone, cep, logradouro, numero, bairro, cidade, uf, padrao) VALUES (?, 'Casa', 'Chk', '11912345678', '01310-100', 'Av Paulista', '1', 'Bela Vista', 'São Paulo', 'SP', 1)",
    [u.id]
  );
  return u;
}

async function produtoDescartavel({ preco = 10, estoque = 5 } = {}) {
  const [[cat]] = await db.query('SELECT id FROM categorias ORDER BY id LIMIT 1');
  const slug = `zz-checkup-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`;
  const [r] = await db.query(
    "INSERT INTO produtos (categoria_id, nome, slug, descricao, preco, estoque, imagem, ativo) VALUES (?, 'ZZ_CHECKUP produto', ?, 'x', ?, ?, '/imagens/Muda.png', 1)",
    [cat.id, slug, preco, estoque]
  );
  produtosCriados.push(r.insertId);
  return { id: r.insertId, slug };
}

async function fornecedorDescartavel(admin) {
  const r = await admin.ctx.post('/api/admin/fornecedores', { headers: admin.H, data: { razao_social: `ZZ_CHECKUP_TESTE ${Date.now()}`, status: 'ativo' } });
  const id = (await r.json()).id;
  expect(id).toBeTruthy();
  fornecedoresCriados.push(id);
  return id;
}

test.describe.configure({ mode: 'serial' });

test.afterAll(async () => {
  const q = (sql, p) => db.query(sql, p).catch(() => {});
  if (pedidosCriados.length) {
    await q('DELETE FROM pedido_timeline WHERE pedido_id IN (?)', [pedidosCriados]);
    await q('DELETE FROM itens_pedido WHERE pedido_id IN (?)', [pedidosCriados]);
    await q('DELETE FROM pedidos WHERE id IN (?)', [pedidosCriados]);
  }
  if (fornecedoresCriados.length) {
    await q('DELETE pf FROM pagamentos_fornecedor pf JOIN contas_pagar cp ON cp.id = pf.conta_pagar_id WHERE cp.fornecedor_id IN (?)', [fornecedoresCriados]);
    await q('DELETE FROM contas_pagar WHERE fornecedor_id IN (?)', [fornecedoresCriados]);
    await q('DELETE ic FROM itens_compra ic JOIN compras c ON c.id = ic.compra_id WHERE c.fornecedor_id IN (?)', [fornecedoresCriados]);
    await q('DELETE FROM compras WHERE fornecedor_id IN (?)', [fornecedoresCriados]);
    await q('DELETE FROM fornecedores WHERE id IN (?)', [fornecedoresCriados]);
  }
  if (produtosCriados.length) {
    await q('DELETE FROM movimentacoes_estoque WHERE produto_id IN (?)', [produtosCriados]);
    await q('DELETE FROM produtos WHERE id IN (?)', [produtosCriados]);
  }
  if (cuponsCriados.length) await q('DELETE FROM cupons WHERE id IN (?)', [cuponsCriados]);
  if (usuariosCriados.length) {
    await q('DELETE FROM logs_admin WHERE usuario_id IN (?)', [usuariosCriados]);
    await q('DELETE FROM usuarios WHERE id IN (?)', [usuariosCriados]);
  }
});

/* ROBUSTEZ GLOBAL */
test.describe('Tratamento de erros HTTP', () => {
  test('JSON malformado → 400 JSON (antes: 500 + página de erro do Express vazando caminhos)', async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const csrf = await csrfDe(ctx, '/login', 'csrf-login');
    const r = await ctx.post('/api/login', { headers: { 'CSRF-Token': csrf, 'Content-Type': 'application/json' }, data: '{"email": ' });
    expect(r.status()).toBe(400);
    const corpo = await r.text();
    expect(JSON.parse(corpo).ok).toBe(false);
    expect(corpo).not.toMatch(/node_modules|\.ejs|[A-Z]:\\|SyntaxError|ReferenceError/);
    await ctx.dispose();
  });

  test('corpo grande demais → 413 (antes: 500)', async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const csrf = await csrfDe(ctx, '/login', 'csrf-login');
    const r = await ctx.post('/api/login', { headers: { 'CSRF-Token': csrf }, data: { email: 'a@b.co', senha: 'x'.repeat(2 * 1024 * 1024) } });
    expect(r.status()).toBe(413);
    await ctx.dispose();
  });

  test('%-encoding inválido na URL → 400 com página de erro própria, sem vazar caminho/stack (antes: 500 + template quebrado)', async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const r = await ctx.get('/produto/%ff%fe', { failOnStatusCode: false });
    expect(r.status()).toBe(400);
    const html = await r.text();
    expect(html).toContain('Endereço inválido');
    expect(html).not.toMatch(/node_modules|\.ejs:|[A-Z]:\\|at .*\(.*:\d+:\d+\)/);
    await ctx.dispose();
  });

  test('erro de validação em rota /api/ com Accept padrão responde JSON 422 (antes: redirect → HTML 200)', async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const r = await ctx.get('/api/produtos?limite=-5', { failOnStatusCode: false, headers: { Accept: '*/*' } });
    expect(r.status()).toBe(422);
    expect((await r.json()).ok).toBe(false);
    await ctx.dispose();
  });

  test('handler async que rejeita NÃO derruba o processo — vira 500 controlado (proteção de app/helpers/asyncErrors.js)', async () => {
    require('../app/helpers/asyncErrors'); // instala o patch
    const app = express();
    app.get('/quebra', async () => { throw new Error('falha simulada de banco'); });
    app.use((err, req, res, next) => res.status(500).json({ ok: false, capturado: true })); // eslint-disable-line no-unused-vars
    const servidor = http.createServer(app);
    await new Promise((r) => servidor.listen(0, r));
    const porta = servidor.address().port;
    const antes = process.listenerCount('unhandledRejection');
    const resposta = await new Promise((resolve, reject) => http.get(`http://127.0.0.1:${porta}/quebra`, (res) => {
      let b = ''; res.on('data', (c) => { b += c; }); res.on('end', () => resolve({ status: res.statusCode, corpo: b }));
    }).on('error', reject));
    servidor.close();
    expect(resposta.status).toBe(500);
    expect(JSON.parse(resposta.corpo).capturado).toBe(true);
    expect(antes).toBeGreaterThan(0);
  });
});

/* AUTORIZAÇÃO / API */
test.describe('APIs JSON sem sessão respondem 401 (antes: 302 → HTML)', () => {
  for (const [metodo, rota] of [
    ['GET', '/api/perfil'], ['POST', '/api/perfil/foto'], ['POST', '/api/perfil/senha'],
    ['GET', '/api/meus-pedidos'], ['GET', '/api/pedidos/1'], ['POST', '/api/perfil/excluir-conta'],
  ]) {
    test(`${metodo} ${rota}`, async () => {
      const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
      const csrf = await csrfDe(ctx, '/login', 'csrf-login');
      const r = await ctx.fetch(rota, { method: metodo, headers: { 'CSRF-Token': csrf, Accept: 'application/json' }, maxRedirects: 0, failOnStatusCode: false, data: metodo === 'POST' ? {} : undefined });
      expect(r.status()).toBe(401);
      expect((await r.json()).ok).toBe(false);
      await ctx.dispose();
    });
  }
  test('o download de dados (link <a download>) continua redirecionando para o login (navegação)', async () => {
    const ctx = await pwRequest.newContext({ baseURL: BASE_URL });
    const r = await ctx.get('/api/perfil/exportar-dados', { maxRedirects: 0, failOnStatusCode: false });
    expect(r.status()).toBe(302);
    await ctx.dispose();
  });
});

test.describe('Admin: alternar status de registro inexistente → 404 (antes: 500 sem log)', () => {
  for (const rota of [
    '/api/admin/cupons/999999999/ativo', '/api/admin/promocoes/999999999/ativo', '/api/admin/banners/999999999/ativo',
    '/api/admin/categorias/999999999/ativa', '/api/admin/subcategorias/999999999/ativa', '/api/admin/clientes/999999999/ativo',
  ]) {
    test(`PATCH ${rota}`, async () => {
      const admin = await novoUsuario('admin');
      const r = await admin.ctx.patch(rota, { headers: admin.H, data: {} });
      expect(r.status()).toBe(404);
      await admin.ctx.dispose();
    });
  }
  test('bloquear um ADMINISTRADOR pela tela de clientes é recusado (antes: 200 "sucesso" sem mudar nada + auditoria falsa)', async () => {
    const admin = await novoUsuario('admin');
    const outroAdmin = await novoUsuario('admin');
    const r = await admin.ctx.patch(`/api/admin/clientes/${outroAdmin.id}/ativo`, { headers: admin.H, data: {} });
    expect(r.status()).toBe(404);
    const [[u]] = await db.query('SELECT ativo FROM usuarios WHERE id = ?', [outroAdmin.id]);
    expect(u.ativo).toBe(1);
  });
});

/* OPEN REDIRECT */
test.describe('Open redirect via ?next=', () => {
  test('caminhoInternoSeguro recusa //, /\\, TAB/quebra de linha, esquemas e controle', () => {
    const { caminhoInternoSeguro: ok } = require('../app/middlewares/auth');
    const bs = String.fromCharCode(92);
    for (const bom of ['/perfil', '/pagamento?x=1#a', '/', '/enderecos/novo']) expect(ok(bom), bom).toBe(true);
    for (const ruim of ['//evil.example', '/' + bs + 'evil.example', '/' + bs + '/evil.example', '/\t/evil.example', '/\n/evil.example', 'https://evil.example', 'javascript:alert(1)', '', undefined, null]) {
      expect(ok(ruim), JSON.stringify(ruim)).toBe(false);
    }
  });

  for (const [rotulo, next] of [['barra invertida', '/\\evil.example/x'], ['TAB', '/\t/evil.example/x']]) {
    test(`login com ?next= malicioso (${rotulo}) NÃO sai do site (antes: ia para evil.example)`, async () => {
      const email = `chk_redir_${Date.now()}_${crypto.randomBytes(2).toString('hex')}@teste.floria.local`;
      const anon = await pwRequest.newContext({ baseURL: BASE_URL });
      const c = await anon.post('/api/cadastro', { headers: { 'CSRF-Token': await csrfDe(anon, '/cadastro', 'csrf-cadastro') }, data: { nome: 'Chk Redir', email, cpf: cpfValidoAleatorio(), telefone: '(11) 91234-5678', senha: SENHA, confirmar: SENHA } });
      expect(c.status()).toBe(201);
      const [[u]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]); usuariosCriados.push(u.id);

      const browser = await chromium.launch();
      const page = await browser.newPage({ baseURL: BASE_URL });
      const destinosExternos = [];
      const ehExterno = (u) => { try { return new URL(u).hostname === 'evil.example'; } catch (e) { return false; } };
      page.on('request', (rq) => { if (ehExterno(rq.url())) destinosExternos.push(rq.url()); });
      await page.route((url) => url.hostname === 'evil.example', (route) => route.abort());
      await page.goto('/login?next=' + encodeURIComponent(next));
      await page.fill('#login-email', email);
      await page.fill('#login-senha', SENHA);
      await page.click('#btn-login');
      await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(400);
      expect(destinosExternos, 'tentou navegar para domínio externo').toEqual([]);
      expect(new URL(page.url()).origin).toBe(new URL(BASE_URL).origin);
      await browser.close();
    });
  }
});

/* FINANCEIRO */
test.describe('Compras: dinheiro exato e integridade das parcelas', () => {
  let admin; let fornecedorId;
  const hoje = () => new Date().toISOString().slice(0, 10);
  const compra = (extra) => admin.ctx.post('/api/admin/compras', { headers: admin.H, data: { fornecedor_id: fornecedorId, data_compra: hoje(), vencimento: hoje(), ...extra } });
  const item = (quantidade, preco_unit) => ({ descricao: 'x', quantidade, preco_unit });

  test.beforeAll(async () => { admin = await novoUsuario('admin'); fornecedorId = await fornecedorDescartavel(admin); });

  test('meio-centavo: 1,005 × R$1,00 = R$1,01 (antes: R$1,00, erro de ponto flutuante)', async () => {
    const r = await compra({ itens: [item(1.005, 1)] });
    expect(r.status()).toBe(201);
    const [[c]] = await db.query('SELECT subtotal, total FROM compras WHERE id = ?', [(await r.json()).id]);
    expect(c.subtotal).toBe('1.01'); expect(c.total).toBe('1.01');
  });

  test('R$ 10,00 em 60x: nenhuma parcela negativa e a soma bate (antes: última parcela = -R$0,03)', async () => {
    const r = await compra({ itens: [item(1, 10)], forma_pagamento: 'parcelado', numero_parcelas: 60, primeiro_vencimento: hoje() });
    expect(r.status()).toBe(201);
    const [ps] = await db.query('SELECT valor_original v FROM contas_pagar WHERE compra_id = ? ORDER BY parcela_numero', [(await r.json()).id]);
    expect(ps).toHaveLength(60);
    expect(ps.every((p) => Number(p.v) > 0)).toBe(true);
    expect(ps.reduce((s, p) => s + Math.round(Number(p.v) * 100), 0)).toBe(1000);
    const cents = ps.map((p) => Math.round(Number(p.v) * 100));
    expect(Math.max(...cents) - Math.min(...cents)).toBeLessThanOrEqual(1);
  });

  test('total menor que o nº de parcelas é REJEITADO com mensagem clara (antes: 59 parcelas de R$0,00)', async () => {
    const r = await compra({ itens: [item(1, 0.5)], forma_pagamento: 'parcelado', numero_parcelas: 60, primeiro_vencimento: hoje() });
    expect(r.status()).toBe(400);
    expect((await r.json()).message).toMatch(/baixo demais para 60 parcelas/);
  });

  test('compra de custo zero à vista gera conta JÁ PAGA (antes: pendente para sempre, sem como pagar)', async () => {
    const r = await compra({ itens: [item(1, 10)], desconto: 10 });
    expect(r.status()).toBe(201);
    const [[cp]] = await db.query('SELECT valor_original, status FROM contas_pagar WHERE compra_id = ?', [(await r.json()).id]);
    expect(Number(cp.valor_original)).toBe(0);
    expect(cp.status).toBe('paga');
  });

  test('estouro de DECIMAL(12,2): mensagem amigável, sem SQL cru (antes: HTTP 400 "Out of range value for column…")', async () => {
    for (const corpo of [{ itens: [item(999999999, 9999999999.99)] }, { itens: [item(1, 9999999999.99)], frete: 9999999999.99 }]) {
      const r = await compra(corpo);
      expect(r.status()).toBe(400);
      const msg = (await r.json()).message;
      expect(msg).toMatch(/excede o valor máximo permitido/);
      expect(msg).not.toMatch(/Out of range|column/i);
    }
  });

  test('valores pedidos no check-up são gravados EXATOS (R$0,01 … R$999.999.999,99)', async () => {
    for (const preco of [0.01, 1, 999.99, 9999.99, 999999.99, 999999999.99]) {
      const r = await compra({ itens: [item(1, preco)] });
      expect(r.status(), String(preco)).toBe(201);
      const [[c]] = await db.query('SELECT total FROM compras WHERE id = ?', [(await r.json()).id]);
      expect(c.total).toBe(preco.toFixed(2));
    }
  });

  test('erro de negócio CONHECIDO mantém status/mensagem (fornecedor inexistente → 404); o resto é 500 genérico, sem SQL', async () => {
    const r = await admin.ctx.post('/api/admin/compras', { headers: admin.H, data: { fornecedor_id: 999999999, data_compra: hoje(), vencimento: hoje(), itens: [item(1, 1)] } });
    expect(r.status()).toBe(404);
    expect((await r.json()).message).toMatch(/Fornecedor não encontrado/);
  });

  test('pagamento simultâneo do saldo inteiro: só um passa (sem pagar a mais)', async () => {
    const r = await compra({ itens: [item(1, 100)] });
    const [[cp]] = await db.query('SELECT id FROM contas_pagar WHERE compra_id = ?', [(await r.json()).id]);
    const pagar = () => admin.ctx.post(`/api/admin/contas-pagar/${cp.id}/pagamentos`, { headers: admin.H, data: { valor: 100, data_pagamento: hoje(), metodo: 'pix' } });
    const resp = await Promise.all([pagar(), pagar(), pagar()]);
    expect(resp.map((x) => x.status()).sort()).toEqual([201, 409, 409]);
    const [[soma]] = await db.query("SELECT SUM(valor) t FROM pagamentos_fornecedor WHERE conta_pagar_id = ? AND status = 'confirmado'", [cp.id]);
    expect(Number(soma.t)).toBe(100);
  });
});

test.describe('Helper de dinheiro (unitário)', () => {
  const d = require('../app/helpers/dinheiro');
  test('centavos exatos e half-up igual ao DECIMAL do MySQL', () => {
    expect(d.paraCentavos(1.005)).toBe(101n);
    expect(d.paraCentavos(2.675)).toBe(268n);
    expect(d.multiplicar(0.7, 0.15)).toBe(11n);
    expect(d.multiplicar(33.333, 3)).toBe(10000n);
    expect(d.paraCentavos('12,34')).toBe(1234n);
  });
  test('parcelas: soma exata, nunca <= 0, diferença <= 1 centavo; total < n é rejeitado', () => {
    for (const [total, n] of [[10, 60], [1, 60], [100.01, 3], [0.6, 60], [999999.99, 60]]) {
      const p = d.dividirEmParcelas(d.paraCentavos(total), n);
      expect(p.reduce((a, b) => a + b, 0n)).toBe(d.paraCentavos(total));
      expect(p.every((x) => x > 0n)).toBe(true);
    }
    expect(() => d.dividirEmParcelas(d.paraCentavos(0.5), 60)).toThrow(/baixo demais/);
  });
  test('cupom percentual nunca desconta mais que o subtotal (antes: 150% descontava 150%)', () => {
    const Cupom = require('../app/models/Cupom');
    expect(Cupom.calcularDesconto({ tipo: 'percentual', valor: 150 }, 100)).toBe(100);
    expect(Cupom.calcularDesconto({ tipo: 'percentual', valor: 10 }, 59.97)).toBe(6);
    expect(Cupom.calcularDesconto({ tipo: 'fixo', valor: 500 }, 100)).toBe(100);
  });
});

/* CHECKOUT */
test.describe('Checkout', () => {
  const corpo = (produto, quantidade, extra = {}) => ({ itens: [{ nome: 'x', link: `/produto/${produto.slug}`, quantidade, preco: 10 }], total: 10, forma_pagto: 'pix', ...extra });
  const enviar = async (u, payload, headers = {}) => {
    const r = await u.ctx.post('/api/pedidos/finalizar', { headers: { ...u.H, ...headers }, data: payload });
    const b = await r.json().catch(() => ({}));
    if (b.pedido_id) pedidosCriados.push(b.pedido_id);
    return { status: r.status(), b };
  };

  test('quantidade absurda → 422 (antes: 500 depois de processar o pagamento)', async () => {
    const u = await comEndereco(await novoUsuario());
    const p = await produtoDescartavel({ estoque: 5 });
    for (const q of [99999999999, 2147483647, 10000]) expect((await enviar(u, corpo(p, q))).status, String(q)).toBe(422);
  });

  test('Idempotency-Key inválida/gigante → 422 (antes: 500 "Data too long for column")', async () => {
    const u = await comEndereco(await novoUsuario());
    const p = await produtoDescartavel();
    const r = await enviar(u, corpo(p, 1), { 'Idempotency-Key': 'k'.repeat(10000) });
    expect(r.status).toBe(422);
    expect(r.b.code).toBe('IDEMPOTENCY_KEY_INVALIDA');
  });

  test('mesma Idempotency-Key em 5 requisições simultâneas cria UM pedido', async () => {
    const u = await comEndereco(await novoUsuario());
    const p = await produtoDescartavel({ estoque: 5 });
    const chave = `chk-${Date.now()}`;
    const rs = await Promise.all(Array.from({ length: 5 }, () => enviar(u, corpo(p, 1), { 'Idempotency-Key': chave })));
    const ids = [...new Set(rs.map((r) => r.b.pedido_id).filter(Boolean))];
    expect(ids).toHaveLength(1);
    const [[e]] = await db.query('SELECT estoque FROM produtos WHERE id = ?', [p.id]);
    expect(e.estoque).toBe(4); // debitou UMA vez
  });

  test('última unidade disputada por 4 requisições: 1 venda, estoque 0, nunca negativo', async () => {
    const a = await comEndereco(await novoUsuario());
    const b = await comEndereco(await novoUsuario());
    const p = await produtoDescartavel({ estoque: 1 });
    const rs = await Promise.all([enviar(a, corpo(p, 1)), enviar(b, corpo(p, 1)), enviar(a, corpo(p, 1)), enviar(b, corpo(p, 1))]);
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 422 && r.b.code === 'ESTOQUE_INSUFICIENTE')).toHaveLength(3);
    const [[e]] = await db.query('SELECT estoque FROM produtos WHERE id = ?', [p.id]);
    expect(e.estoque).toBe(0);
  });

  test('estoque insuficiente é barrado ANTES de cobrar (checagem prévia no service)', async () => {
    const u = await comEndereco(await novoUsuario());
    const p = await produtoDescartavel({ estoque: 2 });
    const r = await enviar(u, corpo(p, 3));
    expect(r.status).toBe(422);
    expect(r.b.code).toBe('ESTOQUE_INSUFICIENTE');
    expect(r.b.message).toMatch(/disponível: 2/);
  });

  test('preço/total adulterados no payload são ignorados (cobra o preço do banco)', async () => {
    const u = await comEndereco(await novoUsuario());
    const p = await produtoDescartavel({ preco: 39.9, estoque: 5 });
    const r = await enviar(u, { itens: [{ nome: 'x', link: `/produto/${p.slug}`, quantidade: 3, preco: 0.01 }], total: 0.01, forma_pagto: 'pix' });
    expect(r.status).toBe(201);
    const [[ped]] = await db.query('SELECT subtotal, total FROM pedidos WHERE id = ?', [r.b.pedido_id]);
    expect(ped.subtotal).toBe('119.70'); expect(ped.total).toBe('119.70');
  });

  test('pedido de OUTRO cliente não é acessível nem cancelável (IDOR)', async () => {
    const dono = await comEndereco(await novoUsuario());
    const intruso = await novoUsuario();
    const p = await produtoDescartavel({ estoque: 5 });
    const { b } = await enviar(dono, corpo(p, 1));
    for (const [m, url] of [['GET', `/api/pedidos/${b.pedido_id}`], ['GET', `/pedido/${b.pedido_id}`], ['PATCH', `/api/pedidos/${b.pedido_id}/cancelar`]]) {
      const r = await intruso.ctx.fetch(url, { method: m, headers: { ...intruso.H, Accept: 'application/json' }, maxRedirects: 0, failOnStatusCode: false, data: m === 'PATCH' ? { motivo: 'x' } : undefined });
      expect([403, 404], `${m} ${url}`).toContain(r.status());
    }
    const [[ped]] = await db.query('SELECT status FROM pedidos WHERE id = ?', [b.pedido_id]);
    expect(ped.status).toBe('preparando');
  });
});

/* REGRAS DE NEGÓCIO */
test.describe('Pedido cancelado é terminal', () => {
  test('cancelar devolve o estoque UMA vez e não dá para reabrir (antes: cancelado → entregue aceito, estoque fantasma)', async () => {
    const admin = await novoUsuario('admin');
    const cli = await comEndereco(await novoUsuario());
    const p = await produtoDescartavel({ estoque: 5 });
    const { b } = await (async () => { const r = await cli.ctx.post('/api/pedidos/finalizar', { headers: cli.H, data: { itens: [{ nome: 'x', link: `/produto/${p.slug}`, quantidade: 2, preco: 10 }], total: 20, forma_pagto: 'pix' } }); const j = await r.json(); pedidosCriados.push(j.pedido_id); return { b: j }; })();
    const estoque = async () => (await db.query('SELECT estoque FROM produtos WHERE id = ?', [p.id]))[0][0].estoque;
    expect(await estoque()).toBe(3);

    const status = (s) => admin.ctx.patch(`/api/pedidos/${b.pedido_id}/status`, { headers: admin.H, data: { status: s } });
    expect((await status('cancelado')).status()).toBe(200);
    expect(await estoque()).toBe(5);
    expect((await status('cancelado')).status()).toBe(200); // repetir o cancelamento é idempotente
    expect(await estoque()).toBe(5); // não devolve em dobro

    for (const s of ['entregue', 'preparando', 'enviado']) {
      const r = await status(s);
      expect(r.status(), s).toBe(409);
      expect((await r.json()).message).toMatch(/não pode ser reaberto/);
    }
    const [[ped]] = await db.query('SELECT status, status_pagamento FROM pedidos WHERE id = ?', [b.pedido_id]);
    expect(ped.status).toBe('cancelado');
    expect(await estoque()).toBe(5);
  });
});

test.describe('Estoque: movimentações', () => {
  test('saída maior que o estoque é recusada (antes: 201 e zerava, histórico incoerente); teto de entrada', async () => {
    const admin = await novoUsuario('admin');
    const p = await produtoDescartavel({ estoque: 10 });
    const mov = (data) => admin.ctx.post('/api/admin/estoque/movimentacao', { headers: admin.H, data: { produto_id: p.id, ...data } });

    const r1 = await mov({ tipo: 'saida', quantidade: 999999 });
    expect(r1.status()).toBe(409);
    expect((await r1.json()).message).toMatch(/excede o estoque disponível \(10\)/);
    expect((await db.query('SELECT estoque FROM produtos WHERE id = ?', [p.id]))[0][0].estoque).toBe(10);

    for (const q of [2147483647, 3000000000]) expect((await mov({ tipo: 'entrada', quantidade: q })).status(), String(q)).toBe(422);
    expect((await mov({ tipo: 'entrada', quantidade: 90 })).status()).toBe(201);
    expect((await mov({ tipo: 'entrada', quantidade: 1000000000 })).status()).toBe(422);
  });

  test('livro de movimentações fecha: 6 saídas simultâneas com estoque 3 → 3 aceitas, 3 recusadas, estoque 0', async () => {
    const admin = await novoUsuario('admin');
    const p = await produtoDescartavel({ estoque: 3 });
    const rs = await Promise.all(Array.from({ length: 6 }, () => admin.ctx.post('/api/admin/estoque/movimentacao', { headers: admin.H, data: { produto_id: p.id, tipo: 'saida', quantidade: 1 } })));
    expect(rs.map((r) => r.status()).sort()).toEqual([201, 201, 201, 409, 409, 409]);
    const [movs] = await db.query('SELECT quantidade, estoque_anterior, estoque_novo FROM movimentacoes_estoque WHERE produto_id = ?', [p.id]);
    expect(movs).toHaveLength(3);
    expect(movs.every((m) => m.estoque_anterior - m.quantidade === m.estoque_novo)).toBe(true);
    expect((await db.query('SELECT estoque FROM produtos WHERE id = ?', [p.id]))[0][0].estoque).toBe(0);
  });
});

test.describe('Cupons', () => {
  test('percentual acima de 100% e valores gigantes → 422 (antes: 150% aceito; fixo enorme = 500)', async () => {
    const admin = await novoUsuario('admin');
    const sufixo = Date.now();
    const criar = async (extra, nome) => {
      const r = await admin.ctx.post('/api/admin/cupons', { headers: admin.H, data: { codigo: `ZZC${nome}${sufixo}`, tipo: 'percentual', valor: 10, valor_minimo: 0, limite_usos: 5, ...extra } });
      const b = await r.json(); if (b.id) cuponsCriados.push(b.id); return r;
    };
    expect((await criar({ valor: 150 }, 'A')).status()).toBe(422);
    expect((await criar({ valor: 100.01 }, 'B')).status()).toBe(422);
    expect((await criar({ tipo: 'fixo', valor: 99999999999 }, 'C')).status()).toBe(422);
    expect((await criar({ limite_usos: 2000000000 }, 'D')).status()).toBe(422);
    expect((await criar({ valor: 100 }, 'E')).status()).toBe(201); // 100% é permitido
  });
});

/* SEGURANÇA */
test.describe('Injeção de fórmula no export de logs (CSV/Excel)', () => {
  test('células que começam com = + - @ são neutralizadas com apóstrofo', () => {
    const { gerarLogsCsv, gerarLogsExcelHtml } = require('../app/services/logsExportService');
    const log = (nome, detalhes) => ({ id: 1, criado_em: new Date(), usuario_nome: nome, acao: 'cliente.status', detalhes, ip: '1.1.1.1', navegador: 'x', sistema_operacional: 'x', dispositivo: 'x' });
    const csv = gerarLogsCsv([log('=HYPERLINK("http://evil","x")', '@SUM(1+1)'), log('+cmd|x', '-2+3')]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(`'@SUM(1+1)`);
    expect(csv).toContain(`'+cmd|x`);
    expect(csv).toContain(`'-2+3`);
    expect(csv).not.toMatch(/(^|,)=HYPERLINK/m);
    const xls = gerarLogsExcelHtml([log('=1+1', 'ok')]);
    expect(xls).toContain("<td>'=1+1</td>");
  });
});

test.describe('URL canônica do site (QR Code / e-mails)', () => {
  test('SITE_URL tem prioridade sobre o Host da requisição; sem ela cai no Host', () => {
    const { urlSite, urlDoSite } = require('../app/helpers/siteUrl');
    const reqFalsa = { protocol: 'http', get: () => 'localhost:3000' };
    const original = process.env.SITE_URL;
    try {
      process.env.SITE_URL = 'https://www.floria.com.br/';
      expect(urlSite('/pedido/7')).toBe('https://www.floria.com.br/pedido/7');
      expect(urlDoSite(reqFalsa, '/pedido/7')).toBe('https://www.floria.com.br/pedido/7'); // nunca localhost
      process.env.SITE_URL = 'javascript:alert(1)';
      expect(urlSite('/x')).toBeNull();
      delete process.env.SITE_URL;
      expect(urlDoSite(reqFalsa, '/pedido/7')).toBe('http://localhost:3000/pedido/7');
    } finally {
      if (original === undefined) delete process.env.SITE_URL; else process.env.SITE_URL = original;
    }
  });
});

/* BANCO */
test.describe('Banco de dados', () => {
  test('índices adicionados pelo check-up existem (a migração roda na subida do servidor)', async () => {
    for (const [tabela, indice] of [['produtos', 'idx_produtos_subcategoria'], ['promocoes', 'idx_promocoes_subcategoria'], ['itens_pedido', 'idx_itens_pedido_promocao'], ['pedidos', 'idx_pedidos_promocao_carrinho']]) {
      const [[r]] = await db.query('SELECT COUNT(*) n FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?', [tabela, indice]);
      expect(r.n, `${tabela}.${indice}`).toBeGreaterThan(0);
    }
  });

  test('nenhuma conta a pagar com valor negativo (integridade financeira)', async () => {
    const [[r]] = await db.query("SELECT COUNT(*) n FROM contas_pagar cp JOIN fornecedores f ON f.id = cp.fornecedor_id WHERE cp.valor_original < 0 AND f.razao_social NOT LIKE 'ZZ_CHECKUP%'");
    expect(r.n).toBe(0);
  });
});

/* PORTABILIDADE */
test.describe('Portabilidade', () => {
  test('imagens referenciadas nas views existem com a MESMA capitalização (no Linux "Muda.png" ≠ "muda.png")', () => {
    const fs = require('fs'); const path = require('path');
    const raiz = path.join(__dirname, '..');
    const arquivosDe = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? arquivosDe(path.join(dir, e.name)) : [path.join(dir, e.name)]);
    const noDisco = new Set(arquivosDe(path.join(raiz, 'app/public/imagens')).map((f) => path.relative(path.join(raiz, 'app/public'), f).split(path.sep).join('/')));
    const problemas = [];
    for (const f of arquivosDe(path.join(raiz, 'app/views')).filter((x) => x.endsWith('.ejs'))) {
      for (const m of fs.readFileSync(f, 'utf8').matchAll(/["'](\/imagens\/[^"'<>?#]+\.(?:png|jpe?g|webp|svg))["']/gi)) {
        const rel = m[1].slice(1);
        if (!noDisco.has(rel)) problemas.push(`${path.relative(raiz, f)} → ${m[1]}`);
      }
    }
    expect(problemas).toEqual([]);
  });
});
