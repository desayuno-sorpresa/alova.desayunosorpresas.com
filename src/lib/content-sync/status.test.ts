import { describe, expect, it } from 'vitest';
import type { SheetCell } from './sheet';
import { buildStatusWrites, columnLetter } from './status';

const cells = (values: string[]): SheetCell[] => values.map((text) => ({ text }));
const AT = '2026-10-12 06:00';

describe('columnLetter', () => {
  it.each([
    [0, 'A'],
    [10, 'K'],
    [25, 'Z'],
    [26, 'AA'],
    [51, 'AZ'],
    [52, 'BA'],
  ])('%i → %s', (index, letter) => {
    expect(columnLetter(index)).toBe(letter);
  });
});

describe('buildStatusWrites', () => {
  const grid = [
    cells(['Título', 'Estado', 'Errores a corregir', 'Detalle error']),
    cells(['Con errores', 'Publicado', 'viejo', 'viejo']),
    cells(['Bien', 'Publicado']),
    cells(['', '', '⚠️ 1 error', 'resto de una revisión anterior']),
    cells(['Borrador', 'Borrador']),
  ];

  it('escribe errores, estado correcto, notas y limpia filas vacías', () => {
    const writes = buildStatusWrites(
      'Productos',
      grid,
      [
        { sheet: 'Productos', row: 2, message: '"Resumen" es demasiado corto.' },
        { sheet: 'Productos', row: 2, message: '"Portada" debe ser un enlace.' },
        { sheet: 'Zonas', row: 3, message: 'De otra pestaña' },
        { message: 'General' },
      ],
      [{ sheet: 'Productos', row: 5, text: 'Borrador: no se publica ni se revisa' }],
      AT,
    );
    expect(writes).toEqual([
      {
        column: 'C',
        values: [
          `⚠️ 2 errores · revisado ${AT}`,
          `✅ Sin errores · revisado ${AT}`,
          '',
          `Borrador: no se publica ni se revisa · revisado ${AT}`,
        ],
      },
      {
        column: 'D',
        values: ['• "Resumen" es demasiado corto.\n• "Portada" debe ser un enlace.', '', '', ''],
      },
    ]);
  });

  it('repite en cada fila los problemas de toda la pestaña', () => {
    const writes = buildStatusWrites(
      'Productos',
      grid.slice(0, 3),
      [{ sheet: 'Productos', message: 'Faltan columnas.' }],
      [],
      AT,
    );
    expect(writes?.[0]?.values).toEqual([
      `⚠️ 1 error · revisado ${AT}`,
      `⚠️ 1 error · revisado ${AT}`,
    ]);
    expect(writes?.[1]?.values).toEqual(['• Faltan columnas.', '• Faltan columnas.']);
  });

  it('muestra avisos que no bloquean, y los errores tienen prioridad', () => {
    const businesses = [
      cells(['Nombre', 'Errores a corregir', 'Detalle error']),
      cells(['Solo aviso']),
      cells(['Error y aviso']),
    ];
    const writes = buildStatusWrites(
      'Preguntas',
      businesses,
      [
        { sheet: 'Preguntas', row: 2, warning: true, message: '"Enlace": la página no responde.' },
        { sheet: 'Preguntas', row: 3, warning: true, message: '"Enlace": la página no responde.' },
        { sheet: 'Preguntas', row: 3, message: '"Ciudad" es demasiado corto.' },
      ],
      [],
      AT,
    );
    expect(writes).toEqual([
      {
        column: 'B',
        values: [`🟡 1 aviso (no bloquea) · revisado ${AT}`, `⚠️ 1 error · revisado ${AT}`],
      },
      {
        column: 'C',
        values: [
          '• Aviso: "Enlace": la página no responde.',
          '• "Ciudad" es demasiado corto.\n• Aviso: "Enlace": la página no responde.',
        ],
      },
    ]);
  });

  it('devuelve null si faltan las columnas de resultado', () => {
    expect(buildStatusWrites('Zonas', [cells(['Servicio', 'Foto'])], [], [], AT)).toBeNull();
  });
});
