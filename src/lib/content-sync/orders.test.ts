import { describe, expect, it } from 'vitest';
import { buildOrderEntry, parseOrderDate, parseOrders } from './orders';
import { formatProblem, isBlocking } from './problems';
import type { SheetCell, SheetGrid } from './sheet';

const TODAY = '2026-10-17';
const HEADERS = [
  'Fecha',
  'Producto',
  'Ciudad',
  'Cliente',
  'Estado',
  'Tipo',
  'Errores a corregir',
  'Detalle error',
];

const row = (values: string[]): SheetCell[] => values.map((text) => ({ text }));
const grid = (...rows: string[][]): SheetGrid => [row(HEADERS), ...rows.map(row)];
type Overrides = Partial<Record<'fecha' | 'producto' | 'ciudad' | 'estado' | 'tipo', string>>;
const order = (overrides: Overrides) => [
  overrides.fecha ?? '2026-10-16',
  overrides.producto ?? 'Desayuno para mujer',
  overrides.ciudad ?? 'Chía',
  'Ana Pérez',
  overrides.estado ?? 'Publicado',
  overrides.tipo ?? '',
];

describe('parseOrderDate', () => {
  it('acepta fechas ISO y escritas a mano', () => {
    expect(parseOrderDate('2026-10-16')).toBe('2026-10-16');
    expect(parseOrderDate('2026-10-16 09:30')).toBe('2026-10-16');
    expect(parseOrderDate('6/10/2026')).toBe('2026-10-06');
  });

  it('rechaza fechas imposibles u otros formatos', () => {
    expect(parseOrderDate('2026-02-30')).toBeNull();
    expect(parseOrderDate('ayer')).toBeNull();
  });
});

describe('parseOrders', () => {
  it('sin la pestaña no hay pedidos ni avisos', () => {
    expect(parseOrders([], TODAY)).toEqual({
      items: [],
      problems: [],
      notes: [],
      rows: 0,
      drafts: 0,
    });
  });

  it('publica fecha, producto y ciudad (opcional), nunca datos del cliente', () => {
    const parsed = parseOrders(
      grid(
        order({}),
        order({ ciudad: '', fecha: '2026-10-17', producto: 'Desayuno para niño' }),
        order({ estado: 'Borrador' }),
      ),
      TODAY,
    );
    expect(parsed.problems).toEqual([]);
    expect(parsed.items).toEqual([
      {
        id: '2026-10-17-fila-3',
        date: '2026-10-17',
        product: 'Desayuno para niño',
        kind: 'pedido',
      },
      {
        id: '2026-10-16-fila-2',
        date: '2026-10-16',
        product: 'Desayuno para mujer',
        city: 'Chía',
        kind: 'pedido',
      },
    ]);
    expect(parsed.drafts).toBe(1);
    expect(JSON.stringify(parsed.items)).not.toMatch(/Ana/);
  });

  it('no publica pedidos antiguos ni futuros', () => {
    const parsed = parseOrders(
      grid(order({ fecha: '2026-09-01' }), order({ fecha: '2026-10-20' })),
      TODAY,
    );
    expect(parsed.items).toEqual([]);
    expect(parsed.notes.map((note) => note.row)).toEqual([2, 3]);
  });

  it('los problemas son avisos que no bloquean y no citan al cliente', () => {
    const parsed = parseOrders(
      grid(order({ fecha: 'ayer' }), order({ producto: 'X' }), order({ estado: 'Listo' })),
      TODAY,
    );
    expect(parsed.items).toEqual([]);
    expect(parsed.problems.map(formatProblem)).toEqual([
      'Pedidos, fila 2: Aviso: "Fecha" debe tener el formato 2026-10-17 o 17/10/2026.',
      'Pedidos, fila 3: Aviso: "Producto" es demasiado corto (mínimo 2 caracteres).',
      'Pedidos, fila 4: Aviso: "Estado" debe ser "Publicado" o "Borrador".',
    ]);
    expect(parsed.problems.some(isBlocking)).toBe(false);
    expect(parsed.problems.map(formatProblem).join(' ')).not.toMatch(/Ana/);
  });

  it('las columnas faltantes también son un aviso', () => {
    const parsed = parseOrders([row(['Fecha'])], TODAY);
    expect(parsed.problems.some(isBlocking)).toBe(false);
    expect(parsed.problems).toHaveLength(1);
  });

  it('publica como máximo 20 pedidos', () => {
    const parsed = parseOrders(grid(...Array.from({ length: 25 }, () => order({}))), TODAY);
    expect(parsed.items).toHaveLength(20);
  });
});

describe('consultas automáticas', () => {
  const catalog = new Set(['desayuno para mujer', 'desayuno para nino']);
  const inquiry = (overrides: Overrides = {}) =>
    order({ ...overrides, tipo: 'Consulta', ciudad: '' });

  it('publica la consulta de un producto del catálogo, sin ciudad ni datos del cliente', () => {
    const parsed = parseOrders(grid(inquiry()), TODAY, catalog);
    expect(parsed.problems).toEqual([]);
    expect(parsed.items).toEqual([
      {
        id: '2026-10-16-fila-2',
        date: '2026-10-16',
        product: 'Desayuno para mujer',
        kind: 'consulta',
      },
    ]);
  });

  it('compara el producto sin tildes ni mayúsculas', () => {
    const parsed = parseOrders(grid(inquiry({ producto: 'desayuno Para niño' })), TODAY, catalog);
    expect(parsed.items).toHaveLength(1);
  });

  it('descarta con aviso un producto que no está en el catálogo (texto libre)', () => {
    const parsed = parseOrders(
      grid(inquiry({ producto: 'Visita mi tienda en ejemplo' })),
      TODAY,
      catalog,
    );
    expect(parsed.items).toEqual([]);
    expect(parsed.problems.map(formatProblem)).toEqual([
      'Pedidos, fila 2: Aviso: "Producto" no coincide con ningún producto publicado del catálogo.',
    ]);
    expect(parsed.problems.some(isBlocking)).toBe(false);
  });

  it('publica una sola consulta por producto y día', () => {
    const parsed = parseOrders(
      grid(inquiry(), inquiry(), inquiry({ fecha: '2026-10-17' })),
      TODAY,
      catalog,
    );
    expect(parsed.items.map((item) => item.id)).toEqual(['2026-10-17-fila-4', '2026-10-16-fila-2']);
    expect(parsed.notes).toEqual([
      { sheet: 'Pedidos', row: 3, text: 'No se muestra: ya hay una consulta igual ese día' },
    ]);
  });

  it('un pedido anotado a mano no necesita estar en el catálogo', () => {
    const parsed = parseOrders(grid(order({ producto: 'Pedido especial' })), TODAY, catalog);
    expect(parsed.items[0]).toMatchObject({ product: 'Pedido especial', kind: 'pedido' });
  });

  it('avisa si "Tipo" no es Pedido ni Consulta', () => {
    const parsed = parseOrders(grid(order({ tipo: 'Venta' })), TODAY, catalog);
    expect(parsed.problems.map(formatProblem)).toEqual([
      'Pedidos, fila 2: Aviso: "Tipo" debe ser "Pedido" o "Consulta" (o quedar vacío).',
    ]);
  });
});

describe('buildOrderEntry', () => {
  it('conserva la fecha de actualización si no cambió', () => {
    const draft = {
      id: '2026-10-16-fila-2',
      date: '2026-10-16',
      product: 'Desayuno',
      kind: 'pedido',
    } as const;
    expect(
      buildOrderEntry(draft, { ...draft, updatedAt: '2026-10-16' }, false, TODAY).updatedAt,
    ).toBe('2026-10-16');
    expect(buildOrderEntry(draft, undefined, false, TODAY).updatedAt).toBe(TODAY);
  });
});
