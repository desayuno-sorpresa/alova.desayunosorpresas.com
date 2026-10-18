import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatProblem } from '../src/lib/content-sync/problems';
import type { SheetCell, SheetGrid } from '../src/lib/content-sync/sheet';
import type { ColumnWrite } from '../src/lib/content-sync/status';
import type { ContentSource, DriveFile } from './google/client';
import { runSync, SyncError, type SyncOptions } from './sync-content';

const BOX = 'BOXBOXBOXBOXBOXBOXBOXBOXBOX01';
const TEAM = 'TEAMTEAMTEAMTEAMTEAMTEAMTEAM2';
const AT = '2026-10-12 06:00';
const REVIEW = ['Errores a corregir', 'Detalle error'];

const cells = (values: string[]): SheetCell[] => values.map((text) => ({ text }));

function productsGrid(status = 'Publicado', photo = BOX): SheetGrid {
  return [
    cells([
      'Nombre',
      'Descripción',
      'Precio',
      'Destacado',
      'Estado',
      'Foto',
      'Descripción foto',
      ...REVIEW,
    ]),
    cells([
      'Caja dulce',
      'Desayuno con fruta, pan artesanal y jugo natural.',
      '85000',
      'Sí',
      status,
      photo,
      'Caja de madera con fresas y croissant',
    ]),
  ];
}

const zonesGrid: SheetGrid = [
  cells(['Zona', 'Horario', 'Costo domicilio', 'Estado', ...REVIEW]),
  cells(['Chapinero', 'Lunes a sábado, 6:00 a 10:00 a. m.', 'Gratis', 'Publicado']),
];
const faqGrid: SheetGrid = [
  cells(['Pregunta', 'Respuesta', 'Estado', ...REVIEW]),
  cells(['¿Con cuánta anticipación pido?', 'Con un día de anticipación.', 'Publicado']),
];
const aboutGrid: SheetGrid = [
  cells(['Título', 'Texto', 'Foto', 'Descripción foto', 'Estado', ...REVIEW]),
  cells([
    'Nuestra historia',
    'Empezamos preparando desayunos para la familia.',
    TEAM,
    'Equipo preparando cajas en la cocina',
    'Publicado',
  ]),
];

function allSheets(products: SheetGrid = productsGrid()): Map<string, SheetGrid> {
  return new Map([
    ['Productos', products],
    ['Zonas', zonesGrid],
    ['Preguntas', faqGrid],
    ['Nosotros', aboutGrid],
  ]);
}

async function jpeg(color: string, width = 3000): Promise<Uint8Array> {
  return new Uint8Array(
    await sharp({ create: { width, height: 1000, channels: 3, background: color } })
      .jpeg()
      .toBuffer(),
  );
}

async function validFiles(): Promise<Record<string, DriveFile>> {
  return {
    [BOX]: { name: 'caja.jpg', mimeType: 'image/jpeg', bytes: await jpeg('#f4c27a') },
    [TEAM]: { name: 'equipo.jpg', mimeType: 'image/jpeg', bytes: await jpeg('#9cc9b4', 800) },
  };
}

interface FakeSource extends ContentSource {
  written: Map<string, ColumnWrite[]>;
}

function fakeSource(sheets: Map<string, SheetGrid>, files: Record<string, DriveFile>): FakeSource {
  const written = new Map<string, ColumnWrite[]>();
  return {
    written,
    async readSheets(names) {
      return new Map([...sheets].filter(([name]) => names.includes(name)));
    },
    async listSheetTitles() {
      return [...sheets.keys()];
    },
    async downloadImage(fileId) {
      const file = files[fileId];
      if (!file) throw new Error(`Archivo ${fileId} no encontrado o no compartido.`);
      return file;
    },
    async writeColumns(sheet, writes) {
      written.set(sheet, [...writes]);
    },
  };
}

async function readJson(dir: string, name: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(dir, name, `${name}.json`), 'utf8'));
}

async function failure(source: ContentSource, options: SyncOptions): Promise<SyncError> {
  const error = await runSync(source, options).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SyncError);
  return error as SyncError;
}

let contentDir: string;
let options: SyncOptions;

beforeEach(async () => {
  contentDir = await mkdtemp(path.join(tmpdir(), 'sync-'));
  options = { contentDir, today: '2026-10-12', reviewedAt: AT };
});

afterEach(async () => {
  await rm(contentDir, { recursive: true, force: true });
});

describe('runSync', () => {
  it('escribe las cuatro colecciones, marca la hoja y es idempotente', async () => {
    const files = await validFiles();
    const source = fakeSource(allSheets(), files);

    const report = await runSync(source, options);
    expect(report).toEqual({
      warnings: [],
      collections: [
        { name: 'productos', rows: 1, drafts: 0, published: 1, images: 1 },
        { name: 'zonas', rows: 1, drafts: 0, published: 1, images: 0 },
        { name: 'preguntas', rows: 1, drafts: 0, published: 1, images: 0 },
        { name: 'nosotros', rows: 1, drafts: 0, published: 1, images: 1 },
        { name: 'pedidos', rows: 0, drafts: 0, published: 0, images: 0 },
      ],
      changed: true,
    });
    for (const sheet of ['Productos', 'Zonas', 'Preguntas', 'Nosotros']) {
      expect(source.written.get(sheet)?.[0]?.values).toEqual([`✅ Sin errores · revisado ${AT}`]);
    }
    expect(await readJson(contentDir, 'productos')).toEqual([
      expect.objectContaining({
        id: 'caja-dulce',
        price: 85000,
        featured: true,
        image: './caja-dulce/01.webp',
      }),
    ]);
    expect(await readJson(contentDir, 'zonas')).toEqual([
      expect.objectContaining({ id: 'chapinero', fee: 0 }),
    ]);
    expect(await readJson(contentDir, 'nosotros')).toEqual([
      expect.objectContaining({ id: 'nuestra-historia', image: './nuestra-historia/01.webp' }),
    ]);
    const box = await sharp(path.join(contentDir, 'productos', 'caja-dulce', '01.webp')).metadata();
    expect(box).toMatchObject({ format: 'webp', width: 2000 });

    const second = await runSync(fakeSource(allSheets(), files), {
      ...options,
      today: '2026-11-01',
    });
    expect(second.changed).toBe(false);
  });

  it('sin las pestañas opcionales publica el catálogo y deja avisos', async () => {
    const sheets = new Map([['Productos', productsGrid()]]);
    const report = await runSync(fakeSource(sheets, await validFiles()), options);
    expect(report.collections.map((c) => c.published)).toEqual([1, 0, 0, 0, 0]);
    expect(report.warnings).toEqual([
      'Crea la pestaña "Zonas" para mostrar esa sección.',
      'Crea la pestaña "Preguntas" para mostrar esa sección.',
      'Crea la pestaña "Nosotros" para mostrar esa sección.',
    ]);
    expect(await readJson(contentDir, 'zonas')).toEqual([]);
  });

  it('publica pedidos anónimos y un pedido inválido no bloquea el catálogo', async () => {
    const sheets = allSheets();
    const cells = (values: string[]) => values.map((text) => ({ text }));
    sheets.set('Pedidos', [
      cells([
        'Fecha',
        'Producto',
        'Ciudad',
        'Cliente',
        'Estado',
        'Errores a corregir',
        'Detalle error',
      ]),
      cells(['2026-10-11', 'Desayuno para mujer', 'Chía', 'Ana Pérez', 'Publicado']),
      cells(['ayer', 'Desayuno para niño', '', 'Luis', 'Publicado']),
    ]);
    const source = fakeSource(sheets, await validFiles());
    const report = await runSync(source, options);
    expect(report.collections[0]?.published).toBe(1);
    expect(report.collections[4]).toMatchObject({ name: 'pedidos', rows: 2, published: 1 });
    expect(report.warnings).toContain(
      'Pedidos, fila 3: Aviso: "Fecha" debe tener el formato 2026-10-17 o 17/10/2026.',
    );
    expect(await readJson(contentDir, 'pedidos')).toEqual([
      {
        id: '2026-10-11-fila-2',
        date: '2026-10-11',
        product: 'Desayuno para mujer',
        city: 'Chía',
        kind: 'pedido',
        updatedAt: options.today,
      },
    ]);
    expect(JSON.stringify(await readJson(contentDir, 'pedidos'))).not.toMatch(/Ana|Luis/);
  });

  it('sin la pestaña Productos no publica nada', async () => {
    const sheets = allSheets();
    sheets.delete('Productos');
    const error = await failure(fakeSource(sheets, await validFiles()), options);
    expect(error.problems).toEqual([
      {
        message:
          'Falta la pestaña "Productos". Pestañas encontradas: "Zonas", "Preguntas", "Nosotros". ' +
          'Cámbiale el nombre a la que corresponda o créala con ese nombre exacto.',
      },
    ]);
  });

  it('escribe los errores de foto en su fila y no toca el disco', async () => {
    const source = fakeSource(allSheets(), {});
    const error = await failure(source, options);
    expect(error.problems.map(formatProblem)).toEqual([
      expect.stringMatching(/^Productos, fila 2: "Foto": Archivo .* no encontrado/),
      expect.stringMatching(/^Nosotros, fila 2: "Foto": Archivo .* no encontrado/),
    ]);
    expect(source.written.get('Productos')?.[0]?.values).toEqual([`⚠️ 1 error · revisado ${AT}`]);
    expect(source.written.get('Zonas')?.[0]?.values).toEqual([`✅ Sin errores · revisado ${AT}`]);
    expect(await readdir(contentDir)).toEqual([]);
  });

  it('elimina productos que pasan a borrador', async () => {
    await runSync(fakeSource(allSheets(), await validFiles()), options);
    const report = await runSync(
      fakeSource(allSheets(productsGrid('Borrador')), await validFiles()),
      options,
    );
    expect(report.collections[0]).toMatchObject({ drafts: 1, published: 0 });
    expect(await readdir(path.join(contentDir, 'productos'))).toEqual(['productos.json']);
  });
});
