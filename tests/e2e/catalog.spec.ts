import { expect, test } from '@playwright/test';

// Datos de ejemplo: 5 productos en "Mujer" (2) y "Hombre" (3); 4 destacados; uno sin precio.

test.describe('catálogo', () => {
  test('agrupa por categoría con navegación interna', async ({ page }) => {
    await page.goto('catalogo/');
    await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Mujer', 'Hombre']);
    await expect(page.getByRole('heading', { level: 3 })).toHaveCount(5);
    const categories = page.getByRole('navigation', { name: 'Categorías' });
    await expect(categories.getByRole('link', { name: 'Hombre' })).toHaveAttribute(
      'href',
      '#hombre',
    );
  });

  test('muestra precio en pesos o "a consultar"', async ({ page }) => {
    await page.goto('catalogo/');
    await expect(page.getByText(/\$\s85\.000/)).toBeVisible();
    await expect(page.getByText('Precio a consultar')).toHaveCount(1);
  });

  test('cada producto tiene pedido por WhatsApp seguro, o aviso si falta el número', async ({
    page,
  }) => {
    await page.goto('catalogo/');
    const orders = page.getByRole('link', { name: /^Pedir por WhatsApp/ });
    if ((await orders.count()) === 0) {
      // Plantilla sin número configurado.
      await expect(page.getByText('Pedidos por WhatsApp disponibles muy pronto.')).toHaveCount(5);
      return;
    }
    await expect(orders).toHaveCount(5);
    for (const order of await orders.all()) {
      await expect(order).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);
      await expect(order).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });
});

test.describe('inicio', () => {
  test('el carrusel muestra solo los destacados y se mueve con los botones', async ({ page }) => {
    await page.goto('./');
    const track = page.getByRole('list', { name: 'Desayunos destacados' });
    // Solo los hijos directos: cada tarjeta tiene además su lista "Incluye".
    await expect(track.locator(':scope > li')).toHaveCount(4);
    await expect(track.getByText('Caja de prueba cinco')).toHaveCount(0);
    const next = page.getByRole('button', { name: 'Siguiente' });
    if (await next.isVisible()) {
      await next.click();
      await expect.poll(() => track.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    }
  });
});

test.describe('secciones', () => {
  test('entregas muestra una tabla con costo del domicilio', async ({ page }) => {
    await page.goto('entregas/');
    const table = page.getByRole('table', { name: /Zonas de entrega/ });
    await expect(table.getByRole('row')).toHaveCount(3);
    await expect(table.getByRole('cell', { name: 'Gratis' })).toBeVisible();
    await expect(table.getByRole('cell', { name: /8\.000/ })).toBeVisible();
  });

  test('las preguntas se abren con el teclado', async ({ page }) => {
    await page.goto('preguntas/');
    const summary = page.getByText('¿Pregunta de prueba dos?');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByText('Segundo párrafo ficticio.')).toBeVisible();
  });

  test('nosotros muestra los bloques con y sin foto', async ({ page }) => {
    await page.goto('nosotros/');
    await expect(page.getByRole('heading', { level: 2, name: 'Historia de prueba' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Rectángulo amarillo de prueba' })).toBeVisible();
    await expect(page.getByText('Texto ficticio del segundo bloque, sin foto.')).toBeVisible();
  });
});
