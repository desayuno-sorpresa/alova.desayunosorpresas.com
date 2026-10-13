import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { displayName } from '../../src/config/site';

// Datos de tests/fixtures/content (CONTENT_DIR); el nombre sale de la configuración del negocio.
const PAGES = [
  { path: './', h1: displayName },
  { path: 'catalogo/', h1: 'Catálogo' },
  { path: 'entregas/', h1: 'Zonas y horarios de entrega' },
  { path: 'nosotros/', h1: 'Nosotros' },
  { path: 'preguntas/', h1: 'Preguntas frecuentes' },
] as const;

for (const { path, h1 } of PAGES) {
  test.describe(`página ${path}`, () => {
    test('responde, tiene un único h1 y no viola CSP', async ({ page }) => {
      const cspErrors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error' && /Content Security Policy/i.test(message.text())) {
          cspErrors.push(message.text());
        }
      });
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(h1);
      await expect(page.locator('html')).toHaveAttribute('lang', 'es-CO');
      expect(cspErrors).toEqual([]);
    });

    test('sin violaciones de accesibilidad WCAG 2.2 AA', async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  });
}

test('todos los enlaces internos responden', async ({ page, request }) => {
  const visited = new Set<string>();
  for (const { path } of PAGES) {
    await page.goto(path);
    const hrefs = await page
      .locator('a[href^="/"]')
      .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
    for (const href of hrefs) {
      const url = href.split('#')[0] ?? href;
      if (visited.has(url)) continue;
      visited.add(url);
      expect((await request.get(url)).status(), url).toBe(200);
    }
  }
});

test('la página 404 se muestra para rutas inexistentes', async ({ page }) => {
  const response = await page.goto('no-existe/');
  expect(response?.status()).toBe(404);
  await expect(page.locator('h1')).toHaveText('Página no encontrada');
});
