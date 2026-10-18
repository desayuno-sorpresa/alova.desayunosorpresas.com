import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Fecha fija: los pedidos de prueba (tests/fixtures/content/pedidos) son del 16 y 17 de octubre.
const NOW = new Date('2026-10-17T12:00:00-05:00');
const APPS_SCRIPT = 'https://script.google.com/**';
const CORS = { 'access-control-allow-origin': '*' };

/**
 * Abre el inicio con reloj fijo. Nunca se llama al Apps Script real: la lista en vivo se
 * intercepta (`live` = respuesta JSON; sin `live`, la petición falla y se usa la del sync).
 */
async function openHome(page: Page, live?: unknown): Promise<void> {
  await page.clock.install({ time: NOW });
  await page.route(APPS_SCRIPT, async (route) => {
    if (live === undefined) return route.abort();
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify(live),
    });
  });
  await page.goto('./');
  // El script marca el aviso como listo cuando ya decidió de dónde salen los datos.
  await page.waitForSelector('[data-orders-toast][data-ready]', { state: 'attached' });
}

async function hasLiveEndpoint(page: Page): Promise<boolean> {
  return Boolean(await page.locator('[data-orders-toast]').getAttribute('data-live-endpoint'));
}

test.describe('aviso de pedidos recientes (datos del sync)', () => {
  test.beforeEach(async ({ page }) => {
    await openHome(page);
  });

  test('muestra cada pedido reciente una vez, sin los antiguos', async ({ page }) => {
    const toast = page.getByRole('complementary', { name: 'Pedidos recientes' });
    await expect(toast).toBeHidden();

    await page.clock.runFor(4_500);
    await expect(toast).toContainText('Alguien de Chía pidió «Desayuno de prueba»');
    await expect(toast).toContainText('Hoy');

    // Una consulta automática nunca dice que alguien "pidió".
    await page.clock.runFor(7_000 + 300 + 9_000 + 500);
    await expect(toast).toContainText('Alguien consultó por «Caja de prueba uno»');
    await expect(toast).not.toContainText('pidió');

    await page.clock.runFor(7_000 + 300 + 9_000 + 500);
    await expect(toast).toContainText('Alguien pidió «Desayuno para mujer»');
    await expect(toast).toContainText('Ayer');

    await page.clock.runFor(7_000 + 300 + 9_000 + 7_000 + 1_000);
    await expect(toast).toBeHidden();
    await expect(page.getByText('Desayuno antiguo')).toHaveCount(0);
  });

  test('se puede cerrar, es accesible y no vuelve en la visita', async ({ page }) => {
    const toast = page.getByRole('complementary', { name: 'Pedidos recientes' });
    await page.clock.runFor(4_500);
    await expect(toast).toBeVisible();

    const results = await new AxeBuilder({ page })
      .include('[data-orders-toast]')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);

    await toast.getByRole('button', { name: 'Ocultar avisos de pedidos' }).click();
    await expect(toast).toBeHidden();
    await page.reload();
    await page.clock.runFor(30_000);
    await expect(toast).toBeHidden();
  });
});

test.describe('aviso en vivo (Apps Script)', () => {
  test('la lista en vivo manda sobre la del sync, sin esperar un despliegue', async ({ page }) => {
    await openHome(page, [
      { date: '2026-10-17', product: 'Desayuno recién consultado', kind: 'consulta' },
    ]);
    test.skip(!(await hasLiveEndpoint(page)), 'Plantilla sin endpoint configurado.');

    const toast = page.getByRole('complementary', { name: 'Pedidos recientes' });
    await page.clock.runFor(4_500);
    await expect(toast).toContainText('Alguien consultó por «Desayuno recién consultado»');
    await expect(toast).toContainText('Hoy');

    // Era el único: el aviso termina y no aparecen los del sync.
    await page.clock.runFor(7_000 + 300 + 9_000 + 1_000);
    await expect(toast).toBeHidden();
    await expect(page.getByText('Desayuno de prueba')).toHaveCount(0);
  });

  test('ignora entradas con forma inválida y no pinta HTML ajeno', async ({ page }) => {
    await openHome(page, [
      { date: 'ayer', product: 'Fecha inválida', kind: 'consulta' },
      { date: '2026-10-17', product: 'x'.repeat(200), kind: 'consulta' },
      { date: '2026-10-17', product: 'Tipo raro', kind: 'venta' },
      { date: '2026-10-17', product: '<img src=x onerror=alert(1)>', kind: 'pedido' },
    ]);
    test.skip(!(await hasLiveEndpoint(page)), 'Plantilla sin endpoint configurado.');

    const toast = page.getByRole('complementary', { name: 'Pedidos recientes' });
    await page.clock.runFor(4_500);
    // Solo la última es válida; se muestra como texto, nunca como HTML.
    await expect(toast).toContainText('Alguien pidió «<img src=x onerror=alert(1)>»');
    await expect(toast.locator('img')).toHaveCount(0);
    await expect(page.getByText('Fecha inválida')).toHaveCount(0);
    await expect(page.getByText('Tipo raro')).toHaveCount(0);
  });

  test('si el Apps Script falla, usa la lista del último sync', async ({ page }) => {
    await openHome(page);
    test.skip(!(await hasLiveEndpoint(page)), 'Plantilla sin endpoint configurado.');

    const toast = page.getByRole('complementary', { name: 'Pedidos recientes' });
    await page.clock.runFor(4_500);
    await expect(toast).toContainText('Alguien de Chía pidió «Desayuno de prueba»');
  });
});

test.describe('registro de consultas', () => {
  test('el clic en "Pedir por WhatsApp" registra solo el producto y no duplica un doble clic', async ({
    page,
  }) => {
    const bodies: string[] = [];
    await page.clock.install({ time: NOW });
    // Nunca se llama al Apps Script real: se intercepta (la lista en vivo responde vacía).
    await page.route(APPS_SCRIPT, async (route) => {
      if (route.request().method() !== 'POST') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          headers: CORS,
          body: '[]',
        });
      }
      bodies.push(route.request().postData() ?? '');
      return route.fulfill({ status: 200, body: 'ok' });
    });
    await page.goto('catalogo/');

    // Plantilla sin endpoint: no hay seguimiento y no se envía nada.
    if ((await page.locator('[data-order-tracker]').count()) === 0) {
      expect(bodies).toEqual([]);
      return;
    }

    const order = page
      .getByRole('main')
      .getByRole('link', { name: /^Pedir por WhatsApp/ })
      .first();
    // No se abre WhatsApp de verdad: se cancela la navegación del enlace.
    await order.evaluate((link) => link.addEventListener('click', (e) => e.preventDefault()));
    const product = await order.getAttribute('data-order-product');
    expect(product).toBeTruthy();

    await order.click();
    await expect.poll(() => bodies.length).toBe(1);
    expect(new URLSearchParams(bodies[0]).get('product')).toBe(product);
    expect([...new URLSearchParams(bodies[0]).keys()]).toEqual(['product']);

    // Un segundo clic enseguida (doble clic) no se duplica.
    await order.click();
    await page.waitForTimeout(300);
    expect(bodies).toHaveLength(1);

    // Pasado el freno, otro pedido del mismo producto sí se registra: cada clic real cuenta.
    await page.clock.runFor(11_000);
    await order.click();
    await expect.poll(() => bodies.length).toBe(2);
  });
});
