import { describe, expect, it } from 'vitest';
import { formatProblem } from './problems';
import { buildProductEntry, parseProducts } from './products';
import type { SheetCell, SheetGrid } from './sheet';

const A = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const B = 'BBBBBBBBBBBBBBBBBBBBBBBBBBBB';
const HEADERS = [
  'Nombre',
  'Identificador',
  'Descripción',
  'Incluye',
  'Precio',
  'Categoría',
  'Destacado',
  'Orden',
  'Estado',
  'Foto',
  'Descripción foto',
];
const row = (values: string[]): SheetCell[] => values.map((text) => ({ text }));

const box = [
  'Caja dulce',
  '',
  'Desayuno con fruta, pan artesanal y jugo natural.',
  '- Fresas\n- Croissant\n- Jugo de naranja',
  '$ 85.000',
  'Mujer',
  'Sí',
  '',
  'Publicado',
  `https://drive.google.com/file/d/${A}/view`,
  'Caja de madera con fresas y croissant',
];

const errorsOf = (grid: SheetGrid) => parseProducts(grid).problems.map(formatProblem);

describe('parseProducts', () => {
  it('convierte un producto publicado', () => {
    const result = parseProducts([row(HEADERS), row(box)]);
    expect(result.problems).toEqual([]);
    expect(result.items).toEqual([
      {
        slug: 'caja-dulce',
        name: 'Caja dulce',
        description: 'Desayuno con fruta, pan artesanal y jugo natural.',
        includes: ['Fresas', 'Croissant', 'Jugo de naranja'],
        price: 85000,
        category: 'Mujer',
        featured: true,
        order: 2,
        image: {
          fileId: A,
          alt: 'Caja de madera con fresas y croissant',
          source: { sheet: 'Productos', row: 2 },
        },
      },
    ]);
  });

  it('usa valores por defecto para categoría, precio y destacado vacíos', () => {
    const minimal = [...box];
    minimal[3] = '';
    minimal[4] = '';
    minimal[5] = '';
    minimal[6] = '';
    const [product] = parseProducts([row(HEADERS), row(minimal)]).items;
    expect(product).toMatchObject({ category: 'Desayunos', featured: false, includes: [] });
    expect(product).not.toHaveProperty('price');
  });

  it('reporta errores por fila y columna', () => {
    const invalid = [...box];
    invalid[2] = 'Corto';
    invalid[4] = 'barato';
    invalid[6] = 'quizá';
    invalid[9] = 'foto.jpg';
    expect(errorsOf([row(HEADERS), row(invalid)])).toEqual([
      'Productos, fila 2: "Descripción" es demasiado corto (mínimo 10 caracteres).',
      'Productos, fila 2: "Precio" debe ser un número, p. ej. 85000 (o quedar vacío).',
      'Productos, fila 2: "Destacado" debe ser "Sí" o "No" (o quedar vacío).',
      'Productos, fila 2: "Foto" debe ser un enlace de Google Drive a la foto.',
    ]);
  });

  it('detecta la misma foto en dos productos y nombres repetidos', () => {
    const copy = [...box];
    copy[0] = 'Caja salada';
    const sameName = [...box];
    sameName[9] = B;
    expect(errorsOf([row(HEADERS), row(box), row(copy), row(sameName)])).toEqual([
      'Productos, fila 4: el identificador "caja-dulce" ya se usa en la fila 2.',
      'Productos, fila 3: "Foto" es la misma que la del producto "Caja dulce" (fila 2); usa otra foto.',
    ]);
  });

  it('aplica la revisión de contenido', () => {
    const promising = [...box];
    promising[2] = 'El mejor desayuno de Bogotá, garantizado.';
    expect(errorsOf([row(HEADERS), row(promising)])).toEqual([
      'Productos, fila 2: "Descripción" promete resultados garantizados; describe lo que incluye el servicio, no resultados.',
    ]);
  });

  it('anota los borradores', () => {
    const draft = [...box];
    draft[8] = 'Borrador';
    expect(parseProducts([row(HEADERS), row(draft)])).toMatchObject({
      items: [],
      problems: [],
      drafts: 1,
    });
  });
});

describe('buildProductEntry', () => {
  it('genera la entrada con la imagen 01', () => {
    const [product] = parseProducts([row(HEADERS), row(box)]).items;
    if (!product) throw new Error('falta el producto');
    expect(buildProductEntry(product, undefined, true, '2026-10-12')).toMatchObject({
      id: 'caja-dulce',
      image: './caja-dulce/01.webp',
      imageAlt: 'Caja de madera con fresas y croissant',
      status: 'publicado',
      updatedAt: '2026-10-12',
    });
  });
});
