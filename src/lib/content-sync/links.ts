import { stripAccents } from './text.ts';

export type UrlCheck = { ok: true; url: string } | { ok: false; error: string };

/** Enlace público seguro: https, dominio con punto, sin usuario/contraseña ni espacios. */
export function parseHttpsUrl(text: string): UrlCheck {
  const trimmed = text.trim();
  if (trimmed === '') return { ok: false, error: 'está vacío.' };
  if (/\s/.test(trimmed)) return { ok: false, error: 'no puede tener espacios.' };
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return { ok: false, error: 'debe ser una dirección completa, p. ej. https://minegocio.com' };
  }
  if (url.protocol !== 'https:') {
    return { ok: false, error: 'debe empezar por "https://" (conexión segura).' };
  }
  if (url.username !== '' || url.password !== '') {
    return { ok: false, error: 'no puede incluir usuario ni contraseña.' };
  }
  if (!url.hostname.includes('.') || url.hostname.endsWith('.')) {
    return { ok: false, error: 'el dominio no es válido.' };
  }
  return { ok: true, url: url.href };
}

/** "Sí"/"Si"/"x" → true; vacío o "No" → false; cualquier otro valor → null. */
export function parseYesNo(text: string): boolean | null {
  const value = stripAccents(text).trim().toLowerCase();
  if (value === '' || value === 'no') return false;
  if (value === 'si' || value === 'x') return true;
  return null;
}
