import {
  imageFiles,
  stampEntry,
  type CollectionParse,
  type DriveImageRef,
  type RowNote,
} from './collection.ts';
import { reviewAltTexts, reviewTexts } from './content-review.ts';
import { LIMITS } from './limits.ts';
import { ABOUT_SHEET, rowProblem, type Problem, type RowRef } from './problems.ts';
import { driveIdOf, isPublished, lengthError, parseOrder } from './rows.ts';
import { readTable, type SheetGrid } from './sheet.ts';
import { singleLine, slugify, splitLines } from './text.ts';

const COLUMNS = ['texto', 'estado'] as const;

/** Bloque de la página "Nosotros": título opcional, párrafos y foto opcional. */
export interface AboutDraft {
  slug: string;
  title?: string;
  text: string[];
  order: number;
  image?: DriveImageRef;
}

export interface AboutEntry {
  id: string;
  title?: string;
  text: string[];
  order: number;
  image?: string;
  imageAlt?: string;
  status: 'publicado';
  updatedAt: string;
}

/** Convierte la pestaña opcional "Nosotros" en bloques de texto con foto opcional. */
export function parseAbout(grid: SheetGrid): CollectionParse<AboutDraft> {
  const problems: Problem[] = [];
  const notes: RowNote[] = [];
  if (grid.length === 0) return { items: [], problems, notes, rows: 0, drafts: 0 };

  const table = readTable(ABOUT_SHEET, grid, COLUMNS);
  problems.push(...table.problems);
  const valid: Omit<AboutDraft, 'slug'>[] = [];

  for (const record of table.records) {
    const at: RowRef = { sheet: ABOUT_SHEET, row: record.row };
    if (!isPublished(record, at, notes, problems)) continue;

    const errors: string[] = [];
    const title = singleLine(record.get('titulo').text);
    const text = splitLines(record.get('texto').text);
    const order = parseOrder(record.get('orden').text, record.row);
    const photoCell = record.get('foto');
    const hasPhoto = photoCell.text.trim() !== '' || photoCell.link !== undefined;
    const fileId = hasPhoto ? driveIdOf(photoCell) : null;
    const alt = singleLine(record.get('descripcion_foto').text);

    const { title: t, text: x } = LIMITS.about;
    for (const message of [
      title === '' ? null : lengthError('Título', title, t.min, t.max),
      lengthError('Texto', text.join('\n'), x.min, x.max),
    ]) {
      if (message) errors.push(message);
    }
    if (order === null) errors.push('"Orden" debe ser un número entero.');
    if (hasPhoto && fileId === null) errors.push('"Foto" debe ser un enlace de Google Drive.');
    if (hasPhoto && alt.length < LIMITS.altMin) {
      errors.push(
        `"Descripción foto" debe describir la foto (mínimo ${LIMITS.altMin} caracteres).`,
      );
    }
    errors.push(
      ...reviewTexts([
        { label: 'Título', value: title },
        { label: 'Texto', value: text.join('\n') },
        { label: 'Descripción foto', value: hasPhoto ? alt : '' },
      ]),
      ...(hasPhoto
        ? reviewAltTexts(
            [{ label: 'Descripción foto', origin: 'la foto', alt }],
            title,
            text.join(' '),
          ).map((problem) => problem.message)
        : []),
    );

    if (errors.length > 0 || order === null || (hasPhoto && fileId === null)) {
      problems.push(...errors.map((message) => rowProblem(at, message)));
      continue;
    }
    valid.push({
      ...(title === '' ? {} : { title }),
      text,
      order,
      ...(fileId ? { image: { fileId, alt, source: at } } : {}),
    });
  }

  // Identificadores estables según el orden: título si existe, si no "bloque-N".
  const used = new Set<string>();
  const items = valid
    .toSorted((a, b) => a.order - b.order)
    .map((block, index) => {
      let slug = (block.title && slugify(block.title)) || `bloque-${index + 1}`;
      if (used.has(slug)) slug = `${slug}-${index + 1}`;
      used.add(slug);
      return { ...block, slug };
    });

  return { items, problems, notes, rows: table.records.length, drafts: notes.length };
}

export function aboutImages(block: AboutDraft): DriveImageRef[] {
  return block.image ? [block.image] : [];
}

export function buildAboutEntry(
  block: AboutDraft,
  previous: AboutEntry | undefined,
  imagesChanged: boolean,
  today: string,
): AboutEntry {
  const [image] = imageFiles(block.slug, block.image ? 1 : 0);
  return stampEntry<AboutEntry>(
    {
      id: block.slug,
      ...(block.title === undefined ? {} : { title: block.title }),
      text: block.text,
      order: block.order,
      ...(image && block.image ? { image, imageAlt: block.image.alt } : {}),
      status: 'publicado',
    },
    previous,
    imagesChanged,
    today,
  );
}
