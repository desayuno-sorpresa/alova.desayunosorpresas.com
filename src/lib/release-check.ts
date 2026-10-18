import { parseHttpsUrl } from './content-sync/links.ts';
import { normalizePhone } from './whatsapp.ts';

export interface ReleaseInput {
  businessName: string | null;
  tagline: string | null;
  description: string | null;
  city: string | null;
  whatsApp: string | null;
  instagramUrl: string | null;
  orderTracking: { endpoint: string | null };
}

function isAppsScriptUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'script.google.com';
  } catch {
    return false;
  }
}

const REQUIRED: readonly [Exclude<keyof ReleaseInput, 'orderTracking'>, string][] = [
  ['businessName', 'el nombre del negocio'],
  ['tagline', 'la frase corta del inicio'],
  ['description', 'la descripción para buscadores'],
  ['city', 'la ciudad o zona principal'],
  ['whatsApp', 'el número de WhatsApp de pedidos'],
];

/** Lista los datos del negocio que faltan o son inválidos. Vacía = listo para publicar. */
export function findReleaseBlockers(config: ReleaseInput): string[] {
  const blockers: string[] = [];
  for (const [key, label] of REQUIRED) {
    const value = config[key];
    if (value === null || value.trim() === '') blockers.push(`Falta ${label} (siteConfig.${key}).`);
  }
  if (config.whatsApp && normalizePhone(config.whatsApp) === null) {
    blockers.push(`El número de WhatsApp "${config.whatsApp}" no es válido.`);
  }
  if (config.description && config.description.length > 160) {
    blockers.push('La descripción para buscadores supera los 160 caracteres.');
  }
  if (config.instagramUrl !== null && !parseHttpsUrl(config.instagramUrl).ok) {
    blockers.push('El enlace de Instagram debe empezar por "https://".');
  }
  if (config.orderTracking.endpoint !== null && !isAppsScriptUrl(config.orderTracking.endpoint)) {
    blockers.push(
      'siteConfig.orderTracking.endpoint debe ser una URL https://script.google.com/….',
    );
  }
  return blockers;
}
