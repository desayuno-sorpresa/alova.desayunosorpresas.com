import { describe, expect, it } from 'vitest';
import { orderHref } from './catalog';

describe('orderHref', () => {
  it('arma el enlace de pedido con el producto', () => {
    const href = orderHref('+57 300 123 4567', 'Caja dulce', 85000);
    expect(href).toMatch(/^https:\/\/wa\.me\/573001234567\?text=/);
    expect(decodeURIComponent(href?.split('text=')[1] ?? '')).toContain('"Caja dulce"');
  });

  it('devuelve null sin número o con un número inválido', () => {
    expect(orderHref(null, 'Caja dulce')).toBeNull();
    expect(orderHref('123', 'Caja dulce')).toBeNull();
  });
});
