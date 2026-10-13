import type { Problem, SheetName } from './problems.ts';
import { normalizeHeader } from './text.ts';

/** Celda de Google Sheets: texto visible y, si existe, el enlace (hipervínculo o chip de Drive). */
export interface SheetCell {
  text: string;
  link?: string;
}

export type SheetGrid = readonly (readonly SheetCell[])[];

/** Columnas que escribe el sync con el resultado de la revisión; nunca se leen como datos. */
export const STATUS_COLUMN = 'errores_a_corregir';
export const DETAIL_COLUMN = 'detalle_error';
const OUTPUT_COLUMNS: readonly string[] = [STATUS_COLUMN, DETAIL_COLUMN];

export interface SheetRecord {
  /** Número de fila tal como se ve en Google Sheets (el encabezado es la fila 1). */
  row: number;
  get(column: string): SheetCell;
}

export interface TableResult {
  records: SheetRecord[];
  problems: Problem[];
}

const EMPTY: SheetCell = { text: '' };

export function headerNames(grid: SheetGrid): string[] {
  return (grid[0] ?? []).map((cell) => normalizeHeader(cell.text));
}

/** Una fila está vacía si no tiene datos fuera de las columnas de resultado. */
export function isEmptyRow(cells: readonly SheetCell[], headers: readonly string[]): boolean {
  return cells.every(
    (cell, index) =>
      OUTPUT_COLUMNS.includes(headers[index] ?? '') || (cell.text.trim() === '' && !cell.link),
  );
}

/** Convierte una pestaña (primera fila = encabezados) en registros; ignora filas vacías. */
export function readTable(
  sheet: SheetName,
  grid: SheetGrid,
  requiredColumns: readonly string[],
): TableResult {
  const headers = headerNames(grid);
  const missing = requiredColumns.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    const list = missing.map((m) => `"${m}"`).join(', ');
    return {
      records: [],
      problems: [{ sheet, message: `Pestaña "${sheet}": faltan las columnas ${list}.` }],
    };
  }

  const records: SheetRecord[] = [];
  grid.slice(1).forEach((cells, index) => {
    if (isEmptyRow(cells, headers)) return;
    records.push({
      row: index + 2,
      get(column) {
        if (OUTPUT_COLUMNS.includes(column)) return EMPTY;
        const position = headers.indexOf(column);
        return position === -1 ? EMPTY : (cells[position] ?? EMPTY);
      },
    });
  });
  return { records, problems: [] };
}
