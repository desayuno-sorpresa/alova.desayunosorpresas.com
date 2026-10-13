import type { Problem, RowRef } from './problems.ts';

/** Imagen de Drive referenciada desde una fila de la hoja. */
export interface DriveImageRef {
  fileId: string;
  alt: string;
  /** Fila de la hoja donde está el enlace a la imagen. */
  source: RowRef;
}

/** Estado informativo de una fila que no se publica pero tampoco tiene errores. */
export interface RowNote extends RowRef {
  text: string;
}

/** Resultado de leer una colección desde la hoja. */
export interface CollectionParse<T> {
  items: T[];
  problems: Problem[];
  notes: RowNote[];
  /** Filas con datos en la pestaña principal y cuántas están en borrador. */
  rows: number;
  drafts: number;
}

/** Cómo citar una imagen desde otra fila: "la imagen de Productos, fila 2". */
export function imageName(ref: DriveImageRef): string {
  return `la imagen de ${ref.source.sheet}, fila ${ref.source.row}`;
}

/** Ruta de cada imagen relativa al JSON de la colección: `./<id>/01.webp`, `02.webp`… */
export function imageFiles(id: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    return `./${id}/${String(index + 1).padStart(2, '0')}.webp`;
  });
}

/**
 * Añade `updatedAt`: conserva la fecha anterior si ni los datos ni las imágenes cambiaron,
 * para que la fecha refleje cambios reales y el PR no tenga ruido.
 */
export function stampEntry<E extends { updatedAt: string }>(
  entry: Omit<E, 'updatedAt'>,
  previous: E | undefined,
  imagesChanged: boolean,
  today: string,
): E {
  let unchanged = false;
  if (previous !== undefined && !imagesChanged) {
    const { updatedAt: _updatedAt, ...rest } = previous;
    unchanged = JSON.stringify(rest) === JSON.stringify(entry);
  }
  const updatedAt = unchanged && previous ? previous.updatedAt : today;
  // TypeScript no puede demostrar que `Omit<E, 'updatedAt'> & { updatedAt }` sea `E`.
  return { ...entry, updatedAt } as E;
}
