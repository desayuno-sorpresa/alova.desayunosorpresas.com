import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Fecha fija: los pedidos de prueba (tests/fixtures/content/pedidos) son del 16 y 17 de octubre.
const NOW = new Date('2026-10-17T12:00:00-05:00');

test.describe('aviso de pedidos recientes', () => {
  test.beforeEach(async ({ page }) => {
    await page.clock.install({ time: NOW });
    await page.goto('./');
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

test.describe('registro de consultas', () => {
  test('el clic en "Pedir por WhatsApp" registra solo el producto, una vez por visita', async ({
    page,
  }) => {
    const bodies: string[] = [];
    // Nunca se llama al Apps Script real: se intercepta y se responde "ok".
    await page.route('https://script.google.com/**', async (route) => {
      bodies.push(route.request().postData() ?? '');
      await route.fulfill({ status: 200, body: 'ok' });
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

    await order.click();
    await page.waitForTimeout(300);
    expect(bodies).toHaveLength(1);
  });
});
