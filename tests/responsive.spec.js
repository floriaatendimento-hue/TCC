const { test, expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');

const BREAKPOINTS = [320, 375, 390, 768, 1024, 1440];

const PUBLIC_PAGES = [
  ['home', '/'],
  ['plantas', '/plantas'],
  ['busca', '/busca?q=planta'],
  ['carrinho', '/carrinho'],
  ['login', '/login'],
];

async function semOverflowHorizontal(page) {
  return page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
}

test.describe('Overflow horizontal — páginas públicas', () => {
  for (const [nome, url] of PUBLIC_PAGES) {
    for (const width of BREAKPOINTS) {
      test(`${nome} @ ${width}px não tem overflow horizontal`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url, { waitUntil: 'networkidle' });
        const overflow = await semOverflowHorizontal(page);
        expect(overflow, `overflow de ${overflow}px em ${nome}@${width}`).toBeLessThanOrEqual(2);
      });
    }
  }
});

test.describe('Menu mobile', () => {
  test('hamburger abre e fecha o drawer sem vazar da tela', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/', { waitUntil: 'networkidle' });
    await page.click('text=Aceitar todos', { timeout: 2000 }).catch(() => {});

    const drawer = page.locator('#drawer-menu');
    await expect(drawer).toBeHidden();

    await page.click('#hamburger-btn');
    await expect(drawer).toBeVisible();
    const box = await drawer.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(375 + 1);

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });
});

test.describe('Acessibilidade (axe-core, WCAG A/AA)', () => {
  for (const [nome, url] of PUBLIC_PAGES) {
    test(`${nome} não tem violação crítica/séria de acessibilidade`, async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 900 });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.click('text=Aceitar todos', { timeout: 2000 }).catch(() => {});
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      const graves = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
      const resumo = graves.map((v) => `${v.impact} ${v.id}: ${v.help} (${v.nodes.length}x)`).join('\n');
      expect(graves, resumo).toEqual([]);
    });
  }
});

test.describe('Área administrativa', () => {
  test.skip(!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD, 'defina ADMIN_EMAIL/ADMIN_PASSWORD para rodar os testes de admin');

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.click('text=Aceitar todos', { timeout: 2000 }).catch(() => {});
    await page.fill('#login-email', process.env.ADMIN_EMAIL);
    await page.fill('#login-senha', process.env.ADMIN_PASSWORD);
    await page.click('#btn-login', { force: true });
    await page.waitForURL('**/perfil', { timeout: 5000 });
  });

  const ADMIN_PAGES = [
    ['dashboard', '/admin'],
    ['produtos', '/admin/produtos'],
    ['pedidos', '/pedidos'],
    ['relatorios', '/admin/relatorios'],
  ];

  for (const [nome, url] of ADMIN_PAGES) {
    for (const width of [375, 1024]) {
      test(`admin/${nome} @ ${width}px não tem overflow horizontal`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(url, { waitUntil: 'networkidle' });
        const overflow = await semOverflowHorizontal(page);
        expect(overflow, `overflow de ${overflow}px em admin/${nome}@${width}`).toBeLessThanOrEqual(2);
      });
    }
  }
});
