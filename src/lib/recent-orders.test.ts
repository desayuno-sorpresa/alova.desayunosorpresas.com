import { describe, expect, it } from 'vitest';
import {
  dateInTimeZone,
  daysBetween,
  newestFirst,
  orderNotice,
  parseIsoDate,
  relativeDay,
} from './recent-orders';

describe('fechas', () => {
  it('valida fechas reales y cuenta días', () => {
    expect(parseIsoDate('2026-13-01')).toBeNull();
    expect(daysBetween('2026-09-30', '2026-10-02')).toBe(2);
  });

  it('usa el día de Colombia, no el de UTC', () => {
    expect(dateInTimeZone(new Date('2026-10-18T03:00:00Z'))).toBe('2026-10-17');
  });

  it('describe el día de forma relativa dentro del límite', () => {
    expect(relativeDay('2026-10-17', '2026-10-17', 14)).toBe('hoy');
    expect(relativeDay('2026-10-16', '2026-10-17', 14)).toBe('ayer');
    expect(relativeDay('2026-10-14', '2026-10-17', 14)).toBe('hace 3 días');
    expect(relativeDay('2026-10-18', '2026-10-17', 14)).toBeNull();
    expect(relativeDay('2026-10-02', '2026-10-17', 14)).toBeNull();
  });
});

describe('newestFirst', () => {
  it('ordena del más reciente al más antiguo', () => {
    const orders = [
      { date: '2026-10-10', product: 'B' },
      { date: '2026-10-16', product: 'A' },
    ];
    expect(newestFirst(orders).map((o) => o.product)).toEqual(['A', 'B']);
  });
});

describe('orderNotice', () => {
  it('es anónimo y nombra el producto, con ciudad si la hay', () => {
    expect(orderNotice({ date: '2026-10-17', product: 'Desayuno para mujer', city: 'Chía' })).toBe(
      'Alguien de Chía pidió «Desayuno para mujer»',
    );
    expect(orderNotice({ date: '2026-10-17', product: 'Desayuno para niño' })).toBe(
      'Alguien pidió «Desayuno para niño»',
    );
  });

  it('una consulta automática nunca dice que alguien pidió', () => {
    expect(
      orderNotice({ date: '2026-10-17', product: 'Desayuno para niño', kind: 'consulta' }),
    ).toBe('Alguien consultó por «Desayuno para niño»');
  });
});
