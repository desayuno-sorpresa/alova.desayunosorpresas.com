const ID = '[-\\w]{20,}';
const PATTERNS = [
  new RegExp(`/file/d/(${ID})`),
  new RegExp(`[?&]id=(${ID})`),
  new RegExp(`/d/(${ID})`),
  new RegExp(`^(${ID})$`),
];

/** Extrae el ID de un archivo de Google Drive a partir de su enlace de compartir o del ID suelto. */
export function extractDriveFileId(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  const isUrl = /^https?:\/\//i.test(trimmed);
  if (isUrl && !/^https:\/\/(drive|docs)\.google\.com\//i.test(trimmed)) return null;
  for (const pattern of PATTERNS) {
    const match = pattern.exec(trimmed);
    if (match?.[1]) return match[1];
  }
  return null;
}
