import { parseIsoDate, relativeDay } from '../recent-orders.ts';
import { stampEntry, type CollectionParse, type RowNote } from './collection.ts';
import { reviewTexts } from './content-review.ts';
import { LIMITS } from './limits.ts';
import { ORDERS_SHEET, rowWarning, type Problem, type RowRef } from './problems.ts';
import { lengthError } from './rows.ts';
import { readTable, type SheetGrid } from './sheet.ts';
import { singleLine, stripAccents } from './text.ts';

// Solo se leen estas columnas (y "Ciudad", opcional): datos del cliente nunca salen de la hoja.
const COLUMNS = ['fecha', 'producto', 'estado'] as const;

/** Pedido o consulta publicados, ya validados. */
export interface OrderDraft {
  id: string;
  date: string;
  product: string;
  city?: string;
  kind: 'pedido' | 'consulta';
}

/** Entrada de `pedidos.json` (forma que valida el esquema de la colección). */
export interface OrderEntry extends OrderDraft {
  updatedAt: string;
}

/** "2026-10-17", "2026-10-17 08:15" o "17/10/2026" → `YYYY-MM-DD`; otro valor → `null`. */
export function parseOrderDate(text: string): string | null {
  const value = singleLine(text);
  const iso = /^(\d{4}-\d{2}-\d{2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(value);
  const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?: \d{1,2}:\d{2}(?::\d{2})?)?$/.exec(value);
  let date: string | null = null;
  if (iso?.[1]) date = iso[1];
  else if (local) {
    const [, day = '', month = '', year = ''] = local;
    date = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return date !== null && parseIsoDate(date) !== null ? date : null;
}

/** Nombre de producto comparable: sin tildes, mayúsculas ni espacios repetidos. */
export function catalogKey(name: string): string {
  return stripAccents(singleLine(name)).toLowerCase();
}

/**
 * Convierte la pestaña opcional "Pedidos" en avisos anónimos de los últimos días.
 * - "Tipo" vacío o "Pedido": pedido real que anota el negocio.
 * - "Tipo" = "Consulta": la registra el sitio al pulsar "Pedir por WhatsApp" (endpoint público).
 *   Solo se publica si el producto está en el catálogo (`catalog`) y como mucho una por
 *   producto y día, para que nadie pueda publicar texto propio ni inundar el aviso.
 * Un problema en esta pestaña es un aviso: se omite la fila y se anota en la hoja, pero nunca
 * bloquea la publicación del catálogo.
 */
export function parseOrders(
  grid: SheetGrid,
  today: string,
  catalog: ReadonlySet<string> | undefined = undefined,
): CollectionParse<OrderDraft> {
  const problems: Problem[] = [];
  const notes: RowNote[] = [];
  if (grid.length === 0) return { items: [], problems, notes, rows: 0, drafts: 0 };

  const table = readTable(ORDERS_SHEET, grid, COLUMNS);
  problems.push(...table.problems.map((problem) => ({ ...problem, warning: true })));
  const items: OrderDraft[] = [];
  const seenInquiries = new Set<string>();
  let drafts = 0;

  for (const record of table.records) {
    const at: RowRef = { sheet: ORDERS_SHEET, row: record.row };
    const status = singleLine(record.get('estado').text).toLowerCase();
    if (status === 'borrador') {
      drafts += 1;
      notes.push({ ...at, text: 'Borrador: no se muestra en el aviso' });
      continue;
    }
    if (status !== 'publicado') {
      problems.push(rowWarning(at, '"Estado" debe ser "Publicado" o "Borrador".'));
      continue;
    }

    const errors: string[] = [];
    const date = parseOrderDate(record.get('fecha').text);
    const product = singleLine(record.get('producto').text);
    const city = singleLine(record.get('ciudad').text);
    const typeText = catalogKey(record.get('tipo').text);
    const kind = typeText === 'consulta' ? 'consulta' : 'pedido';
    const { product: p, city: c } = LIMITS.order;

    if (typeText !== '' && typeText !== 'pedido' && typeText !== 'consulta') {
      errors.push('"Tipo" debe ser "Pedido" o "Consulta" (o quedar vacío).');
    }
    if (date === null) errors.push('"Fecha" debe tener el formato 2026-10-17 o 17/10/2026.');
    if (kind === 'consulta' && catalog && !catalog.has(catalogKey(product))) {
      errors.push('"Producto" no coincide con ningún producto publicado del catálogo.');
    }
    for (const message of [
      lengthError('Producto', product, p.min, p.max),
      city === '' ? null : lengthError('Ciudad', city, c.min, c.max),
    ]) {
      if (message) errors.push(message);
    }
    errors.push(
      ...reviewTexts([
        { label: 'Producto', value: product },
        { label: 'Ciudad', value: city },
      ]),
    );

    if (errors.length > 0 || date === null) {
      problems.push(...errors.map((message) => rowWarning(at, message)));
      continue;
    }
    if (relativeDay(date, today, LIMITS.order.days) === null) {
      notes.push({ ...at, text: `No se muestra: tiene más de ${LIMITS.order.days} días` });
      continue;
    }
    if (kind === 'consulta') {
      const key = `${date}|${catalogKey(product)}`;
      if (seenInquiries.has(key)) {
        notes.push({ ...at, text: 'No se muestra: ya hay una consulta igual ese día' });
        continue;
      }
      seenInquiries.add(key);
    }
    items.push({
      id: `${date}-fila-${record.row}`,
      date,
      product,
      // Una consulta automática no trae ciudad: no se publica ninguna.
      ...(city === '' || kind === 'consulta' ? {} : { city }),
      kind,
    });
  }

  return {
    items: items
      .toSorted((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
      .slice(0, LIMITS.order.max),
    problems,
    notes,
    rows: table.records.length,
    drafts,
  };
}

export function buildOrderEntry(
  order: OrderDraft,
  previous: OrderEntry | undefined,
  _imagesChanged: boolean,
  today: string,
): OrderEntry {
  return stampEntry<OrderEntry>({ ...order }, previous, false, today);
}
