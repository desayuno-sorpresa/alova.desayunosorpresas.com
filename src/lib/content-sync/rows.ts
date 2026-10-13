import type { RowNote } from './collection.ts';
import { extractDriveFileId } from './drive.ts';
import { rowProblem, type Problem, type RowRef } from './problems.ts';
import type { SheetCell, SheetRecord } from './sheet.ts';
import { singleLine } from './text.ts';

/** Validaciones comunes a todas las pestañas. */

export function lengthError(label: string, value: string, min: number, max: number): string | null {
  if (value.length < min) return `"${label}" es demasiado corto (mínimo ${min} caracteres).`;
  if (value.length > max) {
    return `"${label}" es demasiado largo (${value.length} de ${max} caracteres).`;
  }
  return null;
}

/** "Orden" vacío usa la posición de la fila; si no es entero devuelve `null`. */
export function parseOrder(text: string, fallback: number): number | null {
  const trimmed = text.trim();
  if (trimmed === '') return fallback;
  const value = Number(trimmed.replace(',', '.'));
  return Number.isInteger(value) ? value : null;
}

/** ID de Drive desde el enlace de la celda (chip o hipervínculo) o desde su texto. */
export function driveIdOf(cell: SheetCell): string | null {
  return extractDriveFileId(cell.link ?? '') ?? extractDriveFileId(cell.text);
}

/**
 * Lee "Estado": "Publicado" → true; "Borrador" → false con nota; otro valor → false con error.
 */
export function isPublished(
  record: SheetRecord,
  at: RowRef,
  notes: RowNote[],
  problems: Problem[],
): boolean {
  const status = singleLine(record.get('estado').text).toLowerCase();
  if (status === 'publicado') return true;
  if (status === 'borrador') {
    notes.push({ ...at, text: 'Borrador: no se publica ni se revisa' });
  } else {
    problems.push(rowProblem(at, '"Estado" debe ser "Publicado" o "Borrador".'));
  }
  return false;
}
