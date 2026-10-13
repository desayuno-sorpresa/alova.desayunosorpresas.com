import { buildOrderMessage } from './order.ts';
import { buildWaMeUrl, normalizePhone } from './whatsapp.ts';

/** Enlace de pedido de un producto, o `null` si no hay un WhatsApp válido configurado. */
export function orderHref(
  whatsApp: string | null,
  productName: string,
  price?: number,
): string | null {
  if (whatsApp === null || normalizePhone(whatsApp) === null) return null;
  return buildWaMeUrl(whatsApp, buildOrderMessage(productName, price));
}
