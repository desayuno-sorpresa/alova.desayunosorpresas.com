/** Número en formato internacional sin `+` ni separadores (E.164: 8–15 dígitos). */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/[\s()+.-]/g, '');
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : null;
}

/** Enlace `wa.me` que abre un chat, opcionalmente con el mensaje ya escrito. */
export function buildWaMeUrl(phone: string, text = ''): string {
  const normalized = normalizePhone(phone);
  if (normalized === null) throw new Error(`Número de WhatsApp no válido: "${phone}"`);
  const base = `https://wa.me/${normalized}`;
  return text === '' ? base : `${base}?text=${encodeURIComponent(text)}`;
}
