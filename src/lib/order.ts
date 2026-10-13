const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/** Precio en pesos colombianos, p. ej. "$ 85.000". */
export function formatCop(amount: number): string {
  return copFormatter.format(amount);
}

/** Mensaje de WhatsApp para pedir un producto concreto. */
export function buildOrderMessage(productName: string, price?: number): string {
  const name = productName.replace(/\s+/g, ' ').trim();
  const priceText = price === undefined ? '' : ` (${formatCop(price)})`;
  return `Hola, quiero pedir el desayuno "${name}"${priceText}. ¿Me ayudas con la disponibilidad y la entrega?`;
}

/** Mensaje de WhatsApp para consultas generales. */
export function buildInquiryMessage(businessName: string): string {
  return `Hola ${businessName}, quiero información sobre sus desayunos sorpresa.`;
}

/** Agrupa por categoría conservando el orden en que aparece cada categoría. */
export function groupByCategory<T extends { category: string }>(
  items: readonly T[],
): { category: string; items: T[] }[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const group = groups.get(item.category);
    if (group) group.push(item);
    else groups.set(item.category, [item]);
  }
  return [...groups].map(([category, grouped]) => ({ category, items: grouped }));
}
