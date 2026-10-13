/** Normaliza un encabezado de columna: "Precio desde" → "precio_desde", "Título" → "titulo". */
export function normalizeHeader(header: string): string {
  return stripAccents(header)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

/** Identificador apto para URL a partir de un texto libre. */
export function slugify(text: string): string {
  return stripAccents(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Una línea por elemento (saltos de línea dentro de la celda), sin viñetas ni líneas vacías. */
export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-•*·]\s*/, '').trim())
    .filter((line) => line !== '');
}

/** Texto de una sola línea con espacios normalizados. */
export function singleLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Precio en pesos sin decimales: acepta "150000", "150.000", "$ 150.000".
 * Devuelve `undefined` si está vacío y `null` si no es un precio válido.
 */
export function parsePrice(text: string): number | undefined | null {
  const trimmed = text.trim();
  if (trimmed === '') return undefined;
  if (!/^\$?\s*[\d.\s]+$/.test(trimmed)) return null;
  const amount = Number(trimmed.replace(/[^\d]/g, ''));
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
}

/** Quita tildes y diacríticos: "Fotografía" → "Fotografia". */
export function stripAccents(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}
