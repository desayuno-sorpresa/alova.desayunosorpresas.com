import { expect, test } from '@playwright/test';

test.describe('botón flotante de WhatsApp', () => {
  test('está a la derecha, abre WhatsApp de forma segura y el botón del hero ya no existe', async ({
    page,
  }) => {
    await page.goto('./');
    const float = page.getByRole('link', { name: /^Escribir por WhatsApp/ });

    // Plantilla sin número configurado: no hay botón.
    if ((await float.count()) === 0) {
      await expect(page.locator('.whatsapp-float')).toHaveCount(0);
      return;
    }

    await expect(float).toBeVisible();
    await expect(float).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);
    await expect(float).toHaveAttribute('target', '_blank');
    await expect(float).toHaveAttribute('rel', 'noopener noreferrer');

    // Fijo en la esquina inferior derecha, también al desplazarse.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const box = await float.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(viewport).not.toBeNull();
    if (box && viewport) {
      expect(box.x + box.width).toBeGreaterThan(viewport.width * 0.8);
      expect(box.y + box.height).toBeGreaterThan(viewport.height * 0.8);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }

    // El botón "Escríbenos por WhatsApp" del hero fue reemplazado por este.
    await expect(page.getByRole('link', { name: /^Escríbenos por WhatsApp/ })).toHaveCount(0);
  });
});
