import { stampEntry, type CollectionParse, type RowNote } from './collection.ts';
import { reviewTexts } from './content-review.ts';
import { LIMITS } from './limits.ts';
import { rowProblem, ZONES_SHEET, type Problem, type RowRef } from './problems.ts';
import { isPublished, lengthError, parseOrder } from './rows.ts';
import { readTable, type SheetGrid } from './sheet.ts';
import { parsePrice, singleLine, slugify, stripAccents } from './text.ts';

const COLUMNS = ['zona', 'horario', 'estado'] as const;

/** Zona de entrega publicada. `fee` 0 = domicilio gratis; sin `fee` = no se muestra costo. */
export interface ZoneDraft {
  slug: string;
  name: string;
  schedule: string;
  fee?: number;
  notes?: string;
  order: number;
}

export interface ZoneEntry {
  id: string;
  name: string;
  schedule: string;
  fee?: number;
  notes?: string;
  order: number;
  status: 'publicado';
  updatedAt: string;
}

/** "Gratis" o "0" → 0; vacío → undefined; número válido → número; otro → null. */
export function parseFee(text: string): number | undefined | null {
  const value = stripAccents(text).trim().toLowerCase();
  if (value === 'gratis' || value === '0' || value === '$0' || value === '$ 0') return 0;
  return parsePrice(text);
}

/** Convierte la pestaña opcional "Zonas" en las zonas de entrega. */
export function parseZones(grid: SheetGrid): CollectionParse<ZoneDraft> {
  const problems: Problem[] = [];
  const notes: RowNote[] = [];
  if (grid.length === 0) return { items: [], problems, notes, rows: 0, drafts: 0 };

  const table = readTable(ZONES_SHEET, grid, COLUMNS);
  problems.push(...table.problems);
  const items: ZoneDraft[] = [];
  const rowBySlug = new Map<string, number>();

  for (const record of table.records) {
    const at: RowRef = { sheet: ZONES_SHEET, row: record.row };
    if (!isPublished(record, at, notes, problems)) continue;

    const errors: string[] = [];
    const name = singleLine(record.get('zona').text);
    const slug = slugify(name);
    const schedule = singleLine(record.get('horario').text);
    const fee = parseFee(record.get('costo_domicilio').text);
    const notesText = singleLine(record.get('notas').text);
    const order = parseOrder(record.get('orden').text, record.row);

    const { name: n, schedule: s, notes: o } = LIMITS.zone;
    for (const message of [
      lengthError('Zona', name, n.min, n.max),
      lengthError('Horario', schedule, s.min, s.max),
      notesText === '' ? null : lengthError('Notas', notesText, o.min, o.max),
    ]) {
      if (message) errors.push(message);
    }
    if (slug !== '' && rowBySlug.has(slug)) {
      errors.push(`la zona "${name}" ya está en la fila ${rowBySlug.get(slug)}.`);
    }
    if (fee === null) {
      errors.push('"Costo domicilio" debe ser un número, "Gratis" o quedar vacío.');
    }
    if (order === null) errors.push('"Orden" debe ser un número entero.');
    errors.push(
      ...reviewTexts([
        { label: 'Zona', value: name },
        { label: 'Horario', value: schedule },
        { label: 'Notas', value: notesText },
      ]),
    );

    if (errors.length > 0 || fee === null || order === null) {
      problems.push(...errors.map((message) => rowProblem(at, message)));
      continue;
    }
    rowBySlug.set(slug, record.row);
    items.push({
      slug,
      name,
      schedule,
      ...(fee === undefined ? {} : { fee }),
      ...(notesText === '' ? {} : { notes: notesText }),
      order,
    });
  }

  return {
    items: items.toSorted((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es')),
    problems,
    notes,
    rows: table.records.length,
    drafts: notes.length,
  };
}

export function buildZoneEntry(
  zone: ZoneDraft,
  previous: ZoneEntry | undefined,
  imagesChanged: boolean,
  today: string,
): ZoneEntry {
  return stampEntry<ZoneEntry>(
    {
      id: zone.slug,
      name: zone.name,
      schedule: zone.schedule,
      ...(zone.fee === undefined ? {} : { fee: zone.fee }),
      ...(zone.notes === undefined ? {} : { notes: zone.notes }),
      order: zone.order,
      status: 'publicado',
    },
    previous,
    imagesChanged,
    today,
  );
}
