/**
 * Actividad publicada en el aviso, siempre anónima (sin nombre, teléfono ni dirección).
 * `pedido` lo anota el negocio a mano; `consulta` la registra el sitio al pulsar
 * "Pedir por WhatsApp" (no prueba una venta, por eso el aviso dice "consultó").
 */
export interface RecentOrder {
  /** Fecha en Colombia, `YYYY-MM-DD`. */
  date: string;
  product: string;
  city?: string | undefined;
  kind?: 'pedido' | 'consulta' | undefined;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Milisegundos UTC de una fecha `YYYY-MM-DD` válida, o `null`. */
export function parseIsoDate(date: string): number | null {
  const match = ISO_DATE.exec(date);
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  if (year === undefined || month === undefined || day === undefined) return null;
  const time = Date.UTC(year, month - 1, day);
  const check = new Date(time);
  // Descarta fechas imposibles como 2026-02-30.
  if (check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) return null;
  return time;
}

/** Días transcurridos de `from` a `to` (ambas `YYYY-MM-DD`), o `null` si alguna no es válida. */
export function daysBetween(from: string, to: string): number | null {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (start === null || end === null) return null;
  return Math.round((end - start) / DAY_MS);
}

/** Fecha `YYYY-MM-DD` de `now` en una zona horaria (por defecto, Colombia). */
export function dateInTimeZone(now: Date, timeZone = 'America/Bogota'): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** "hoy", "ayer" o "hace N días"; `null` si la fecha es futura o tiene más de `maxDays`. */
export function relativeDay(date: string, today: string, maxDays: number): string | null {
  const days = daysBetween(date, today);
  if (days === null || days < 0 || days > maxDays) return null;
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  return `hace ${days} días`;
}

/** Del más reciente al más antiguo (la fecha decide en el navegador cuáles se muestran). */
export function newestFirst<T extends RecentOrder>(orders: readonly T[]): T[] {
  return orders.toSorted((a, b) => b.date.localeCompare(a.date));
}

/** Texto del aviso: "Alguien de Chía pidió «…»" o "Alguien consultó por «…»". */
export function orderNotice(order: RecentOrder): string {
  const who = order.city ? `Alguien de ${order.city}` : 'Alguien';
  const verb = order.kind === 'consulta' ? 'consultó por' : 'pidió';
  return `${who} ${verb} «${order.product}»`;
}
