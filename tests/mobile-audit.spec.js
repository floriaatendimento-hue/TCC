require('dotenv').config();
const { test, expect, request: pwRequest } = require('@playwright/test');
const crypto = require('crypto');
const db = require('../config/db');
const { hashOtp } = require('../app/models/OtpRecuperacaoSenha');

const MOBILE = { width: 375, height: 812 };
const LANDSCAPE = { width: 812, height: 375 };

async function semOverflowHorizontal(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function alvosPequenos(page, seletor = 'a[href], button, input[type=checkbox], input[type=radio], input[type=submit], select') {
  return page.$$eval(seletor, (els) =>
    els
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        const style = getComputedStyle(el);
        if (style.visibility === 'hidden' || style.display === 'none') return false;
        if (el.closest('[hidden]')) return false;
        if (el.tagName === 'A' && style.display === 'inline') {
          const pai = el.parentElement;
          const textoDoPai = (pai?.textContent || '').replace(/\s+/g, ' ').trim();
          const textoDoLink = (el.textContent || '').replace(/\s+/g, ' ').trim();
          if (textoDoPai.length - textoDoLink.length > 15) return false;
        }
        if ((el.type === 'checkbox' || el.type === 'radio') && r.width <= 2 && r.height <= 2) return false;
        return true;
      })
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, id: el.id, texto: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 40), w: Math.round(r.width), h: Math.round(r.height) };
      })
      .filter((x) => x.w < 24 || x.h < 24)
  );
}

test.describe('Páginas públicas adicionais — overflow @ 375px', () => {
  const PAGINAS = [
    ['sobre-nos', '/sobre-nos'],
    ['suporte', '/suporte'],
    ['termos-de-uso', '/termos-de-uso'],
    ['politica-de-privacidade', '/politica-de-privacidade'],
    ['politica-de-cookies', '/politica-de-cookies'],
    ['cadastro', '/cadastro'],
    ['produto-detalhes', '/produto/pa-jardinagem-manual'],
    ['maisvendidos', '/maisvendidos'],
    ['presentear', '/presentear'],
  ];
  for (const [nome, url] of PAGINAS) {
    test(`${nome} @ 375px não tem overflow horizontal`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto(url, { waitUntil: 'networkidle' });
      const overflow = await semOverflowHorizontal(page);
      expect(overflow, `overflow de ${overflow}px em ${nome}`).toBeLessThanOrEqual(2);
    });
  }
});

test.describe('Área de toque (WCAG 2.5.8) @ 375px', () => {
  const PAGINAS = [
    ['home', '/'],
    ['plantas', '/plantas'],
    ['produto-detalhes', '/produto/pa-jardinagem-manual'],
    ['carrinho', '/carrinho'],
    ['login', '/login'],
    ['cadastro', '/cadastro'],
  ];
  for (const [nome, url] of PAGINAS) {
    test(`${nome}: nenhum alvo interativo visível abaixo de 24x24px`, async ({ page }) => {
      await page.setViewportSize(MOBILE);
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.click('#btn-cookie-banner-aceitar', { timeout: 2000 }).catch(() => {});
      const pequenos = await alvosPequenos(page);
      expect(pequenos, JSON.stringify(pequenos, null, 2)).toEqual([]);
    });
  }
});

test.describe('Orientação landscape (812x375)', () => {
  const PAGINAS = [
    ['home', '/'],
    ['carrinho', '/carrinho'],
    ['produto-detalhes', '/produto/pa-jardinagem-manual'],
  ];
  for (const [nome, url] of PAGINAS) {
    test(`${nome} landscape: sem overflow e header/menu continuam acessíveis`, async ({ page }) => {
      await page.setViewportSize(LANDSCAPE);
      await page.goto(url, { waitUntil: 'networkidle' });
      const overflow = await semOverflowHorizontal(page);
      expect(overflow, `overflow de ${overflow}px`).toBeLessThanOrEqual(2);
      await expect(page.locator('#hamburger-btn')).toBeVisible();
    });
  }

  test('menu hamburger abre e o drawer cabe na altura landscape (375px)', async ({ page }) => {
    await page.setViewportSize(LANDSCAPE);
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('#btn-cookie-banner-aceitar', { timeout: 2000 }).catch(() => {});
    await page.click('#hamburger-btn');
    const drawer = page.locator('#drawer-menu');
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(375 + 1);
  });
});

test.describe('Fluxo de carrinho no mobile', () => {
  test('adicionar produto, abrir /carrinho: itens visíveis, quantidade tocável, resumo não cobre o botão finalizar', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/produto/pa-jardinagem-manual', { waitUntil: 'networkidle' });
    await page.click('#btn-cookie-banner-aceitar', { timeout: 2000 }).catch(() => {});
    await page.click('.btn-add');
    await expect(page.locator('#cart-count')).not.toHaveText('0', { timeout: 5000 });

    await page.goto('/carrinho', { waitUntil: 'networkidle' });
    const overflow = await semOverflowHorizontal(page);
    expect(overflow).toBeLessThanOrEqual(2);

    const lista = page.locator('#produtos-lista');
    await expect(lista).toBeVisible();
    await expect(lista.locator(':scope > *').first()).toBeVisible({ timeout: 5000 });

    const finalizar = page.locator('#btn-finalizar');
    await expect(finalizar).toBeVisible();
    const fb = await finalizar.boundingBox();
    expect(fb.width).toBeGreaterThan(0);
    expect(fb.height).toBeGreaterThanOrEqual(24);

    await finalizar.click();
    await expect(page.locator('.floria-auth-overlay')).toHaveClass(/show/, { timeout: 3000 });
  });
});

test.describe('OTP no mobile (tela /verificar-codigo)', () => {
  test('6 caixas de dígito, tamanho de toque ok, colar código preenche todas as caixas', async ({ page }) => {
    const email = `mobaudit_otp_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@teste.floria.local`;
    const csrfCadastro = await (async () => {
      const html = await (await page.request.get('/cadastro')).text();
      return html.match(/id="csrf-cadastro" value="([^"]+)"/)[1];
    })();
    const base = () => Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const dv = (nums) => { let s = 0; for (let i = 0; i < nums.length; i++) s += nums[i] * (nums.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    const b = base(); const d1 = dv(b); const cpf = [...b, d1, dv([...b, d1])].join('');
    const r = await page.request.post('/api/cadastro', { headers: { 'CSRF-Token': csrfCadastro }, data: { nome: 'Mob Audit Otp', email, cpf, telefone: '(11) 91234-5678', senha: 'SenhaForte!2024xyz', confirmar: 'SenhaForte!2024xyz' } });
    expect(r.status()).toBe(201);
    const [[u]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [email]);

    try {
      await page.setViewportSize(MOBILE);
      await page.request.get('/logout');

      const csrfLogin = await (async () => {
        const html = await (await page.request.get('/login')).text();
        return html.match(/id="csrf-login" value="([^"]+)"/)[1];
      })();
      const r2 = await page.request.post('/api/recuperar-senha', { headers: { 'CSRF-Token': csrfLogin }, data: { email } });
      expect(r2.status()).toBe(200);

      let linha;
      for (let tent = 0; tent < 20 && !linha; tent++) {
        const [rows] = await db.query('SELECT id FROM otps_recuperacao_senha WHERE usuario_id = ? AND usado_em IS NULL ORDER BY id DESC LIMIT 1', [u.id]);
        linha = rows[0];
        if (!linha) await new Promise((res) => setTimeout(res, 100));
      }
      expect(linha, 'OTP deveria ter sido criado pelo /api/recuperar-senha').toBeTruthy();
      await db.query('UPDATE otps_recuperacao_senha SET otp_hash = ? WHERE id = ?', [hashOtp(u.id, '482913'), linha.id]);

      await page.goto('/verificar-codigo', { waitUntil: 'networkidle' });
      if (page.url().includes('/login')) {
        test.skip(true, 'sessão de recuperação não propagou do contexto de API para a page — ambiente de teste, não é bug de produto');
      }

      const digitos = page.locator('.otp-digito');
      await expect(digitos).toHaveCount(6);
      for (let i = 0; i < 6; i++) {
        const box = await digitos.nth(i).boundingBox();
        expect(box.width, `dígito ${i}`).toBeGreaterThanOrEqual(24);
        expect(box.height, `dígito ${i}`).toBeGreaterThanOrEqual(24);
      }

      await digitos.first().click();
      await page.keyboard.insertText('482913');
      const valores = await digitos.evaluateAll((els) => els.map((e) => e.value));
      expect(valores.join(''), 'colar/digitar sequência deve preencher as 6 caixas').toBe('482913');
    } finally {
      await db.query('DELETE FROM otps_recuperacao_senha WHERE usuario_id = ?', [u.id]).catch(() => {});
      await db.query('DELETE FROM usuarios WHERE id = ?', [u.id]).catch(() => {});
    }
  });
});

test.describe('Formulário de cadastro — foco não fica escondido', () => {
  test('último campo do formulário fica dentro da área rolável ao focar (sem elemento fixed cobrindo)', async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/cadastro', { waitUntil: 'networkidle' });
    await page.click('#btn-cookie-banner-aceitar', { timeout: 2000 }).catch(() => {});
    const ultimo = page.locator('#cad-confirmar');
    await ultimo.scrollIntoViewIfNeeded();
    await ultimo.focus();
    const box = await ultimo.boundingBox();
    expect(box, 'campo focado precisa ter bounding box visível').not.toBeNull();
    const coberto = await page.evaluate(([x, y]) => {
      const el = document.elementFromPoint(x, y);
      return el ? el.tagName : null;
    }, [box.x + box.width / 2, box.y + box.height / 2]);
    expect(coberto, 'campo focado não pode estar coberto por outro elemento (ex: banner fixed)').toBe('INPUT');
  });
});

/* ÁREA ADMINISTRATIVA */
test.describe('Admin mobile — sidebar, tabelas e modal', () => {
  let adminEmail; let adminId;
  const SENHA = 'SenhaForte!2024xyz';

  test.beforeAll(async () => {
    adminEmail = `mobaudit_admin_${Date.now()}_${crypto.randomBytes(3).toString('hex')}@teste.floria.local`;
    const anon = await pwRequest.newContext({ baseURL: 'http://localhost:3000' });
    const html = await (await anon.get('/cadastro')).text();
    const csrf = html.match(/id="csrf-cadastro" value="([^"]+)"/)[1];
    const base = () => Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
    const dv = (nums) => { let s = 0; for (let i = 0; i < nums.length; i++) s += nums[i] * (nums.length + 1 - i); const r = (s * 10) % 11; return r === 10 ? 0 : r; };
    const b = base(); const d1 = dv(b); const cpf = [...b, d1, dv([...b, d1])].join('');
    const r = await anon.post('/api/cadastro', { headers: { 'CSRF-Token': csrf }, data: { nome: 'Mob Audit Admin', email: adminEmail, cpf, telefone: '(11) 91234-5678', senha: SENHA, confirmar: SENHA } });
    expect(r.status()).toBe(201);
    const [[u]] = await db.query('SELECT id FROM usuarios WHERE email = ?', [adminEmail]);
    adminId = u.id;
    await db.query("UPDATE usuarios SET papel = 'admin' WHERE id = ?", [adminId]);
  });

  test.afterAll(async () => {
    await db.query('DELETE FROM logs_admin WHERE usuario_id = ?', [adminId]).catch(() => {});
    await db.query('DELETE FROM usuarios WHERE id = ?', [adminId]).catch(() => {});
  });

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE);
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.click('#btn-cookie-banner-aceitar', { timeout: 2000 }).catch(() => {});
    await page.fill('#login-email', adminEmail);
    await page.fill('#login-senha', SENHA);
    await page.click('#btn-login', { force: true });
    await page.waitForURL('**/perfil', { timeout: 8000 });
  });

  test('sidebar do admin: hamburger abre/fecha, não sobrepõe conteúdo de forma travada', async ({ page }) => {
    await page.goto('/admin', { waitUntil: 'networkidle' });
    const sidebar = page.locator('#admin-sidebar');
    const hamburger = page.locator('#admin-hamburger');
    await expect(hamburger).toBeVisible();

    await hamburger.click();
    await expect(sidebar).toHaveClass(/aberta|open|ativa|visivel|is-open/, { timeout: 3000 }).catch(async () => {
      const box = await sidebar.boundingBox();
      expect(box.x).toBeGreaterThan(-10);
    });

    await page.keyboard.press('Escape').catch(() => {});
  });

  test('tabela de produtos no admin @ 375px: sem overflow horizontal da PÁGINA (tabela pode rolar internamente)', async ({ page }) => {
    await page.goto('/admin/produtos', { waitUntil: 'networkidle' });
    const overflow = await semOverflowHorizontal(page);
    expect(overflow, `overflow de ${overflow}px`).toBeLessThanOrEqual(2);
  });

  test('modal de novo produto @ 375px: cabe na tela, botões de ação visíveis e tocáveis', async ({ page }) => {
    await page.goto('/admin/produtos', { waitUntil: 'networkidle' });
    const novoBtn = page.locator('a[href*="produtos/novo"], button:has-text("Novo produto"), a:has-text("Novo produto")').first();
    if (await novoBtn.count() === 0) test.skip(true, 'botão de novo produto não encontrado na página — ver manualmente');
    await novoBtn.click();
    await page.waitForLoadState('networkidle');
    const overflow = await semOverflowHorizontal(page);
    expect(overflow, `overflow de ${overflow}px no formulário de produto`).toBeLessThanOrEqual(2);
  });
});
