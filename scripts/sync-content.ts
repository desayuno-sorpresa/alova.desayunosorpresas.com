// Sincroniza el contenido del negocio desde Google Sheets + Drive hacia src/content/.
// Uso: GOOGLE_SERVICE_ACCOUNT_JSON='…' SPREADSHEET_ID='…' pnpm sync:content
import { appendFile, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  aboutImages,
  buildAboutEntry,
  parseAbout,
  type AboutDraft,
  type AboutEntry,
} from '../src/lib/content-sync/about.ts';
import {
  imageFiles,
  imageName,
  type CollectionParse,
  type DriveImageRef,
  type RowNote,
} from '../src/lib/content-sync/collection.ts';
import {
  buildFaqEntry,
  parseFaq,
  type FaqDraft,
  type FaqEntry,
} from '../src/lib/content-sync/faq.ts';
import {
  ABOUT_SHEET,
  ALL_SHEETS,
  FAQ_SHEET,
  formatProblem,
  isBlocking,
  PRODUCTS_SHEET,
  rowProblem,
  ZONES_SHEET,
  type Problem,
} from '../src/lib/content-sync/problems.ts';
import {
  buildProductEntry,
  parseProducts,
  productImages,
  type ProductDraft,
  type ProductEntry,
} from '../src/lib/content-sync/products.ts';
import {
  buildZoneEntry,
  parseZones,
  type ZoneDraft,
  type ZoneEntry,
} from '../src/lib/content-sync/zones.ts';
import type { SheetGrid } from '../src/lib/content-sync/sheet.ts';
import { buildStatusWrites } from '../src/lib/content-sync/status.ts';
import { getAccessToken, parseServiceAccount } from './google/auth.ts';
import { createGoogleSource, SCOPES, type ContentSource } from './google/client.ts';

export const DEFAULT_CONTENT_DIR = 'src/content';
const SUPPORTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

export interface SyncOptions {
  /** Carpeta con una subcarpeta por colección (`productos/`, `zonas/`…). */
  contentDir: string;
  /** Fecha YYYY-MM-DD para elementos nuevos o modificados. */
  today: string;
  /** Fecha y hora que se anota en la hoja junto al resultado de la revisión. */
  reviewedAt: string;
}

export interface CollectionReport {
  name: string;
  rows: number;
  drafts: number;
  published: number;
  images: number;
}

export interface SyncReport {
  /** Avisos que no bloquean la publicación. */
  warnings: string[];
  collections: CollectionReport[];
  changed: boolean;
}

export class SyncError extends Error {
  readonly problems: readonly Problem[];
  readonly warnings: readonly string[];

  constructor(problems: readonly Problem[], warnings: readonly string[] = []) {
    super(`La hoja tiene ${problems.filter(isBlocking).length} error(es).`);
    this.problems = problems;
    this.warnings = warnings;
  }
}

/** Cómo se lee, se nombra y se escribe cada colección. */
interface CollectionSpec<T, E extends { id: string; updatedAt: string }> {
  /** Subcarpeta y nombre del JSON (`productos` → `productos/productos.json`). */
  name: string;
  parsed: CollectionParse<T>;
  id(item: T): string;
  images(item: T): DriveImageRef[];
  entry(item: T, previous: E | undefined, imagesChanged: boolean, today: string): E;
}

/** Foto de Drive → WebP sin metadatos (EXIF/GPS), orientación corregida, máx. 2000 px. */
async function toWebp(ref: DriveImageRef, source: ContentSource): Promise<Uint8Array> {
  const file = await source.downloadImage(ref.fileId);
  if (!SUPPORTED_TYPES.has(file.mimeType)) {
    throw new Error(
      `La foto "${file.name}" (${file.mimeType || 'tipo desconocido'}) no es JPG, PNG, WebP ni AVIF. ` +
        'Si es HEIC (iPhone), guárdala como JPG y vuelve a subirla.',
    );
  }
  const output = await sharp(file.bytes)
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return new Uint8Array(output);
}

async function readIfExists(file: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(file));
  } catch {
    return null;
  }
}

function sameBytes(a: Uint8Array | null, b: Uint8Array): boolean {
  return a !== null && Buffer.from(a).equals(Buffer.from(b));
}

/**
 * Descarga y convierte las imágenes de cada elemento. Los fallos y las imágenes idénticas
 * dentro del mismo elemento se devuelven como problemas en la fila de la imagen.
 */
async function renderImages<T>(
  items: readonly T[],
  id: (item: T) => string,
  images: (item: T) => DriveImageRef[],
  source: ContentSource,
): Promise<{ rendered: Map<string, Uint8Array[]>; problems: Problem[] }> {
  const rendered = new Map<string, Uint8Array[]>();
  const problems: Problem[] = [];
  for (const item of items) {
    const refs = images(item);
    const bytes: Uint8Array[] = [];
    for (const ref of refs) {
      try {
        bytes.push(await toWebp(ref, source));
      } catch (error) {
        problems.push(rowProblem(ref.source, `"Foto": ${(error as Error).message}`));
      }
    }
    rendered.set(id(item), bytes);
    // Solo si todas se descargaron; si no, los índices no corresponden a las filas.
    if (bytes.length !== refs.length) continue;
    bytes.forEach((image, index) => {
      const twin = bytes.findIndex(
        (other, otherIndex) => otherIndex < index && sameBytes(other, image),
      );
      const ref = refs[index];
      const original = refs[twin];
      if (twin !== -1 && ref && original) {
        problems.push(
          rowProblem(
            ref.source,
            `"Foto" es idéntica a ${imageName(original)} (mismo archivo subido dos veces); usa otra foto.`,
          ),
        );
      }
    });
  }
  return { rendered, problems };
}

/**
 * Escribe el resultado de la revisión en "Errores a corregir" / "Detalle error" de cada pestaña.
 * Devuelve avisos si no puede: no bloquean la publicación ni ocultan los demás errores.
 */
async function writeReview(
  source: ContentSource,
  sheets: Map<string, SheetGrid>,
  problems: readonly Problem[],
  notes: readonly RowNote[],
  reviewedAt: string,
): Promise<string[]> {
  const warnings: string[] = [];
  for (const sheet of ALL_SHEETS) {
    const grid = sheets.get(sheet);
    if (!grid) continue;
    const writes = buildStatusWrites(sheet, grid, problems, notes, reviewedAt);
    if (writes === null) {
      warnings.push(
        `Pestaña "${sheet}": agrega las columnas "Errores a corregir" y "Detalle error" para ver ahí la revisión.`,
      );
      continue;
    }
    try {
      await source.writeColumns(sheet, writes);
    } catch (error) {
      warnings.push(`No se pudo escribir la revisión en la hoja: ${(error as Error).message}`);
    }
  }
  return warnings;
}

/** Escribe el JSON y las imágenes de una colección solo si cambiaron. */
async function writeCollection<T, E extends { id: string; updatedAt: string }>(
  spec: CollectionSpec<T, E>,
  rendered: Map<string, Uint8Array[]>,
  options: SyncOptions,
): Promise<{ changed: boolean; images: number }> {
  const dir = path.join(options.contentDir, spec.name);
  const jsonPath = path.join(dir, `${spec.name}.json`);
  const previousJson = await readFile(jsonPath, 'utf8').catch(() => '');
  let previous = new Map<string, E>();
  try {
    const parsed = JSON.parse(previousJson) as E[];
    previous = new Map(parsed.map((entry) => [entry.id, entry]));
  } catch {
    // Sin JSON previo: todo es nuevo.
  }

  let changed = false;
  let imageCount = 0;
  const entries: E[] = [];
  for (const item of spec.parsed.items) {
    const id = spec.id(item);
    const images = rendered.get(id) ?? [];
    const files = imageFiles(id, spec.images(item).length);
    const itemDir = path.join(dir, id);
    // Comparar con lo existente también detecta imágenes sobrantes de una versión anterior.
    const existing = await readdir(itemDir).catch(() => [] as string[]);
    const expected = new Set(files.map((file) => path.basename(file)));
    let imagesChanged = existing.some((name) => !expected.has(name));
    for (const [index, relative] of files.entries()) {
      const bytes = images[index];
      if (bytes && !sameBytes(await readIfExists(path.join(dir, relative)), bytes)) {
        imagesChanged = true;
      }
    }
    if (imagesChanged) {
      await rm(itemDir, { recursive: true, force: true });
      await mkdir(itemDir, { recursive: true });
      for (const [index, relative] of files.entries()) {
        const bytes = images[index];
        if (bytes) await writeFile(path.join(dir, relative), bytes);
      }
      changed = true;
    }
    imageCount += files.length;
    entries.push(spec.entry(item, previous.get(id), imagesChanged, options.today));
  }

  // Elimina carpetas de elementos que ya no están publicados.
  const keep = new Set(spec.parsed.items.map((item) => spec.id(item)));
  for (const entry of await readdir(dir, { withFileTypes: true }).catch(() => [])) {
    if (entry.isDirectory() && !keep.has(entry.name)) {
      await rm(path.join(dir, entry.name), { recursive: true, force: true });
      changed = true;
    }
  }

  const nextJson = `${JSON.stringify(entries, null, 2)}\n`;
  if (nextJson !== previousJson) {
    await mkdir(dir, { recursive: true });
    await writeFile(jsonPath, nextJson);
    changed = true;
  }
  return { changed, images: imageCount };
}

const noImages = (): DriveImageRef[] => [];
const noRows = <T>(): CollectionParse<T> => ({
  items: [],
  problems: [],
  notes: [],
  rows: 0,
  drafts: 0,
});

export async function runSync(source: ContentSource, options: SyncOptions): Promise<SyncReport> {
  const sheets = await source.readSheets(ALL_SHEETS);
  const products: CollectionSpec<ProductDraft, ProductEntry> = {
    name: 'productos',
    // Si falta la pestaña se informa una sola vez (abajo), sin "faltan las columnas".
    parsed: sheets.has(PRODUCTS_SHEET) ? parseProducts(sheets.get(PRODUCTS_SHEET) ?? []) : noRows(),
    id: (product) => product.slug,
    images: productImages,
    entry: buildProductEntry,
  };
  const zones: CollectionSpec<ZoneDraft, ZoneEntry> = {
    name: 'zonas',
    parsed: parseZones(sheets.get(ZONES_SHEET) ?? []),
    id: (zone) => zone.slug,
    images: noImages,
    entry: buildZoneEntry,
  };
  const faq: CollectionSpec<FaqDraft, FaqEntry> = {
    name: 'preguntas',
    parsed: parseFaq(sheets.get(FAQ_SHEET) ?? []),
    id: (item) => item.slug,
    images: noImages,
    entry: buildFaqEntry,
  };
  const about: CollectionSpec<AboutDraft, AboutEntry> = {
    name: 'nosotros',
    parsed: parseAbout(sheets.get(ABOUT_SHEET) ?? []),
    id: (block) => block.slug,
    images: aboutImages,
    entry: buildAboutEntry,
  };
  const all = [products.parsed, zones.parsed, faq.parsed, about.parsed];

  const problems: Problem[] = all.flatMap((parsed) => parsed.problems);
  const notes: RowNote[] = all.flatMap((parsed) => parsed.notes);
  const warnings: string[] = [];
  if (!sheets.has(PRODUCTS_SHEET)) {
    const found = (await source.listSheetTitles()).map((title) => `"${title}"`).join(', ');
    problems.unshift({
      message:
        `Falta la pestaña "${PRODUCTS_SHEET}". Pestañas encontradas: ${found || 'ninguna'}. ` +
        'Cámbiale el nombre a la que corresponda o créala con ese nombre exacto.',
    });
  }
  for (const sheet of [ZONES_SHEET, FAQ_SHEET, ABOUT_SHEET]) {
    if (!sheets.has(sheet)) warnings.push(`Crea la pestaña "${sheet}" para mostrar esa sección.`);
  }

  // Descarga y convierte todo antes de tocar el disco: si algo falla, no queda a medias.
  const rendered = new Map<string, Map<string, Uint8Array[]>>();
  if (!problems.some(isBlocking)) {
    for (const [name, result] of [
      [
        products.name,
        await renderImages(products.parsed.items, products.id, products.images, source),
      ],
      [about.name, await renderImages(about.parsed.items, about.id, about.images, source)],
    ] as const) {
      rendered.set(name, result.rendered);
      problems.push(...result.problems);
    }
  }

  warnings.push(...(await writeReview(source, sheets, problems, notes, options.reviewedAt)));
  if (problems.some(isBlocking)) throw new SyncError(problems, warnings);
  warnings.push(...problems.map(formatProblem));

  const empty = new Map<string, Uint8Array[]>();
  const results = [
    {
      spec: products,
      ...(await writeCollection(products, rendered.get(products.name) ?? empty, options)),
    },
    { spec: zones, ...(await writeCollection(zones, empty, options)) },
    { spec: faq, ...(await writeCollection(faq, empty, options)) },
    { spec: about, ...(await writeCollection(about, rendered.get(about.name) ?? empty, options)) },
  ];
  return {
    warnings,
    collections: results.map(({ spec, images }) => ({
      name: spec.name,
      rows: spec.parsed.rows,
      drafts: spec.parsed.drafts,
      published: spec.parsed.items.length,
      images,
    })),
    changed: results.some((result) => result.changed),
  };
}

function nowInBogota(): { today: string; reviewedAt: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const today = `${get('year')}-${get('month')}-${get('day')}`;
  return { today, reviewedAt: `${today} ${get('hour')}:${get('minute')}` };
}

async function appendToFiles(files: readonly (string | undefined)[], text: string): Promise<void> {
  for (const file of files) if (file) await appendFile(file, text);
}

function bulletList(items: readonly string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
}

async function main(): Promise<void> {
  const credentials = process.env['GOOGLE_SERVICE_ACCOUNT_JSON'];
  const spreadsheetId = process.env['SPREADSHEET_ID'];
  if (!credentials || !spreadsheetId) {
    throw new Error('Faltan las variables GOOGLE_SERVICE_ACCOUNT_JSON y/o SPREADSHEET_ID.');
  }
  const account = parseServiceAccount(credentials);
  const token = await getAccessToken(account, SCOPES);
  const report = await runSync(createGoogleSource(spreadsheetId, token, account.clientEmail), {
    contentDir: DEFAULT_CONTENT_DIR,
    ...nowInBogota(),
  });
  const lines = report.collections.map(
    (c) =>
      `${c.name}: ${c.rows} fila(s) (${c.drafts} en borrador), ${c.published} publicado(s), ${c.images} imagen(es).`,
  );
  const message = `${lines.join(' ')} ${report.changed ? 'Hay cambios.' : 'Sin cambios.'}`;
  console.log(message);
  if (report.warnings.length > 0) {
    console.warn('Avisos (no bloquean):');
    for (const warning of report.warnings) console.warn(`  - ${warning}`);
  }
  const warnings =
    report.warnings.length > 0
      ? `\n\n**Avisos (no bloquean):**\n\n${bulletList(report.warnings)}`
      : '';
  await appendToFiles([process.env['GITHUB_STEP_SUMMARY']], `${message}${warnings}\n\n`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(async (error: unknown) => {
    const problems =
      error instanceof SyncError
        ? error.problems
        : [{ message: error instanceof Error ? error.message : String(error) }];
    const warnings = error instanceof SyncError ? error.warnings : [];
    const title =
      error instanceof SyncError
        ? `${error.message} Corrígelos en Google Sheets:`
        : 'No se pudo sincronizar:';
    console.error(title);
    for (const problem of problems) console.error(`  - ${formatProblem(problem)}`);
    for (const warning of warnings) console.warn(`  - ${warning}`);

    // Resumen de la ejecución: lista completa.
    const all = bulletList(problems.map(formatProblem));
    const notice = warnings.length > 0 ? `\n\n**Avisos:**\n\n${bulletList(warnings)}` : '';
    await appendToFiles([process.env['GITHUB_STEP_SUMMARY']], `### ${title}\n\n${all}${notice}\n`);

    // Issue (público): los errores de filas se corrigen en la hoja; aquí solo se resumen.
    const blocking = problems.filter(isBlocking);
    const inRows = blocking.filter((problem) => problem.row !== undefined).length;
    const general = blocking.filter((problem) => problem.row === undefined).map(formatProblem);
    const writeFailed = warnings.some((warning) => warning.startsWith('No se pudo escribir'));
    const tabs = ALL_SHEETS.map((sheet) => `"${sheet}"`).join(', ');
    const lines = [
      ...(inRows > 0 && !writeFailed
        ? [
            `Hay **${inRows} error(es)** en filas de la hoja. Revisa las columnas **Errores a corregir** y **Detalle error** de las pestañas ${tabs}.`,
          ]
        : []),
      // Si no se pudo escribir en la hoja, la lista completa va en el issue.
      ...(inRows > 0 && writeFailed
        ? ['No se pudo escribir la revisión en la hoja. Errores:', '', all]
        : []),
      ...(general.length > 0 ? ['', bulletList(general)] : []),
      ...(warnings.length > 0 ? ['', '**Avisos:**', '', bulletList(warnings)] : []),
    ];
    await appendToFiles([process.env['SYNC_PROBLEMS_FILE']], `${lines.join('\n')}\n`);
    process.exit(1);
  });
}
