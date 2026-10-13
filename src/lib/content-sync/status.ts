import type { Problem, SheetName } from './problems.ts';
import type { RowNote } from './collection.ts';
import { DETAIL_COLUMN, headerNames, isEmptyRow, STATUS_COLUMN, type SheetGrid } from './sheet.ts';

/** Valores de una columna desde la fila 2 hasta la última fila con datos. */
export interface ColumnWrite {
  /** Columna en notación A1 ("A", "K", "AA"). */
  column: string;
  values: string[];
}

/** Índice de columna (0 = A) a letra(s) A1. */
export function columnLetter(index: number): string {
  let letters = '';
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return letters;
}

/**
 * Calcula el contenido de "Errores a corregir" y "Detalle error" para cada fila de una pestaña.
 * Devuelve `null` si la pestaña no tiene esas dos columnas.
 */
export function buildStatusWrites(
  sheet: SheetName,
  grid: SheetGrid,
  problems: readonly Problem[],
  notes: readonly RowNote[],
  reviewedAt: string,
): ColumnWrite[] | null {
  const headers = headerNames(grid);
  const statusIndex = headers.indexOf(STATUS_COLUMN);
  const detailIndex = headers.indexOf(DETAIL_COLUMN);
  if (statusIndex === -1 || detailIndex === -1) return null;

  const own = problems.filter((problem) => problem.sheet === sheet);
  // Problemas de toda la pestaña (p. ej. columnas faltantes) se muestran en cada fila.
  const sheetWide = own
    .filter((problem) => problem.row === undefined && !problem.warning)
    .map((problem) => problem.message);
  const status: string[] = [];
  const detail: string[] = [];

  grid.slice(1).forEach((cells, index) => {
    const row = index + 2;
    if (isEmptyRow(cells, headers)) {
      status.push('');
      detail.push('');
      return;
    }
    const inRow = own.filter((problem) => problem.row === row);
    const errors = [
      ...sheetWide,
      ...inRow.filter((problem) => !problem.warning).map((problem) => problem.message),
    ];
    const warnings = inRow.filter((problem) => problem.warning).map((problem) => problem.message);
    const lines = [
      ...errors.map((message) => `• ${message}`),
      ...warnings.map((message) => `• Aviso: ${message}`),
    ].join('\n');
    const note = notes.find((item) => item.sheet === sheet && item.row === row);
    if (errors.length > 0) {
      const count = errors.length === 1 ? '1 error' : `${errors.length} errores`;
      status.push(`⚠️ ${count} · revisado ${reviewedAt}`);
      detail.push(lines);
    } else if (warnings.length > 0) {
      const count = warnings.length === 1 ? '1 aviso' : `${warnings.length} avisos`;
      status.push(`🟡 ${count} (no bloquea) · revisado ${reviewedAt}`);
      detail.push(lines);
    } else if (note) {
      status.push(`${note.text} · revisado ${reviewedAt}`);
      detail.push('');
    } else {
      status.push(`✅ Sin errores · revisado ${reviewedAt}`);
      detail.push('');
    }
  });

  return [
    { column: columnLetter(statusIndex), values: status },
    { column: columnLetter(detailIndex), values: detail },
  ];
}
