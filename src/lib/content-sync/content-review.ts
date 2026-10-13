import { stripAccents } from './text.ts';

/**
 * Revisión editorial automática de los textos de un servicio. Reglas deliberadamente
 * concretas (pocas falsas alarmas): cada problema bloquea la publicación hasta corregirlo.
 */

export interface ReviewField {
  /** Nombre de la columna tal como la ve quien edita la hoja. */
  label: string;
  value: string;
}

interface Rule {
  pattern: RegExp;
  message: string;
}

/** Se aplican sobre el texto en minúsculas y sin tildes. */
const RULES: readonly Rule[] = [
  {
    pattern: /\bgarantiz\w*/,
    message: 'promete resultados garantizados; describe lo que incluye el servicio, no resultados.',
  },
  {
    pattern: /\b(primer[oa]?s?|top)\s+(lugar|puesto|resultado|pagina)/,
    message: 'promete posiciones o primeros lugares; nadie puede garantizarlos.',
  },
  {
    pattern:
      /\b(posicion\w*|visibilidad|aparece\w*|salir|rankea\w*)\b.{0,40}\b(google|buscador\w*|chatgpt)\b|\b(google|buscador\w*)\b.{0,40}\b(posicion\w*|visibilidad|primer\w*)/,
    message: 'promete resultados en Google o buscadores; no se pueden asegurar.',
  },
  {
    pattern: /\b100\s*%\s*(seguro|garantizad\w*|efectiv\w*|asegurad\w*)/,
    message: 'usa una promesa absoluta ("100 %"); describe el servicio sin asegurar resultados.',
  },
  {
    pattern: /\blorem\b|\bipsum\b|\bx{3,}\b|texto de (prueba|ejemplo)|\(completar\)|\[\.\.\.\]/,
    message: 'contiene texto de relleno; reemplázalo por el texto definitivo.',
  },
];

const BRANDS: readonly [RegExp, string][] = [
  [/\bgoogle\b/, 'Google'],
  [/\bwhatsapp\b/, 'WhatsApp'],
  [/\binstagram\b/, 'Instagram'],
  [/\bfacebook\b/, 'Facebook'],
  [/\btiktok\b/, 'TikTok'],
];

export function normalizeForReview(text: string): string {
  return stripAccents(text).toLowerCase().replace(/\s+/g, ' ').trim();
}

function isShouting(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, '');
  if (letters.length < 12) return false;
  const upper = letters.replace(/[^\p{Lu}]/gu, '').length;
  return upper / letters.length > 0.7;
}

/** Problemas de redacción de cada campo, con el formato `"Columna" mensaje`. */
export function reviewTexts(fields: readonly ReviewField[]): string[] {
  const problems: string[] = [];
  for (const { label, value } of fields) {
    if (value.trim() === '') continue;
    const normalized = normalizeForReview(value);
    for (const rule of RULES) {
      if (rule.pattern.test(normalized)) problems.push(`"${label}" ${rule.message}`);
    }
    for (const [pattern, brand] of BRANDS) {
      const original = value.normalize('NFC');
      const matches = original.match(new RegExp(pattern.source, 'gi')) ?? [];
      if (matches.some((match) => match !== brand)) {
        problems.push(`"${label}" escribe la marca como "${brand}".`);
      }
    }
    if (isShouting(value)) {
      problems.push(`"${label}" está casi todo en MAYÚSCULAS; escríbelo en minúsculas normales.`);
    }
  }
  return problems;
}

export interface AltReview {
  /** Columna donde está la descripción ("Descripción portada" o "Descripción foto"). */
  label: string;
  /** Dónde está, para citarla desde otra fila: "la imagen de Productos, fila 2". */
  origin: string;
  alt: string;
}

export interface AltProblem {
  /** Posición en la lista recibida. */
  index: number;
  message: string;
}

/**
 * Las descripciones de fotos deben describir la imagen: no repetir título o resumen
 * ni repetirse entre sí dentro del mismo servicio.
 */
export function reviewAltTexts(
  alts: readonly AltReview[],
  title: string,
  summary: string,
): AltProblem[] {
  const problems: AltProblem[] = [];
  // Los textos vacíos no cuentan: una descripción vacía no "repite" un título vacío.
  const forbidden = new Map(
    (
      [
        [normalizeForReview(title), 'el nombre o título'],
        [normalizeForReview(summary), 'la descripción'],
      ] as const
    ).filter(([text]) => text !== ''),
  );
  const seen = new Map<string, string>();
  alts.forEach(({ label, origin, alt }, index) => {
    const normalized = normalizeForReview(alt);
    if (normalized === '') return;
    const repeated = forbidden.get(normalized);
    if (repeated) {
      problems.push({
        index,
        message: `"${label}" repite ${repeated}; describe lo que se ve en la foto.`,
      });
    }
    const previous = seen.get(normalized);
    if (previous) {
      problems.push({
        index,
        message: `"${label}" es igual a la de ${previous}; cada foto necesita su propia descripción.`,
      });
    } else {
      seen.set(normalized, origin);
    }
  });
  return problems;
}
