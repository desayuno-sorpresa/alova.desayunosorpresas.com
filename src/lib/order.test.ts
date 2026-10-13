import { describe, expect, it } from 'vitest';
import { buildInquiryMessage, buildOrderMessage, formatCop, groupByCategory } from './order';

const spaces = (text: string) => text.replace(/\s/g, ' ');

describe('formatCop', () => {
  it('formatea pesos sin decimales', () => {
    expect(spaces(formatCop(85000))).toBe('$ 85.000');
  });
});

describe('buildOrderMessage', () => {
  it('incluye el producto y el precio cuando existe', () => {
    expect(spaces(buildOrderMessage('  Caja  dulce ', 85000))).toBe(
      'Hola, quiero pedir el desayuno "Caja dulce" ($ 85.000). ¿Me ayudas con la disponibilidad y la entrega?',
    );
  });

  it('omite el precio si no hay', () => {
    expect(buildOrderMessage('Caja dulce')).not.toContain('$');
  });
});

describe('buildInquiryMessage', () => {
  it('saluda al negocio', () => {
    expect(buildInquiryMessage('Alova')).toBe(
      'Hola Alova, quiero información sobre sus desayunos sorpresa.',
    );
  });
});

describe('groupByCategory', () => {
  it('agrupa conservando el orden de aparición', () => {
    const groups = groupByCategory([
      { id: 1, category: 'Mujer' },
      { id: 2, category: 'Hombre' },
      { id: 3, category: 'Mujer' },
    ]);
    expect(groups.map((g) => [g.category, g.items.map((i) => i.id)])).toEqual([
      ['Mujer', [1, 3]],
      ['Hombre', [2]],
    ]);
  });
});
