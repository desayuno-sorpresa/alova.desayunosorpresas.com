export type PublishStatus = 'borrador' | 'publicado';

interface Publishable {
  status: PublishStatus;
  order: number;
}

/** Elementos visibles ordenados; los borradores solo se incluyen si se pide explícitamente. */
export function visibleItems<T extends Publishable>(
  items: readonly T[],
  includeDrafts: boolean,
): T[] {
  return items
    .filter((item) => includeDrafts || item.status === 'publicado')
    .toSorted((a, b) => a.order - b.order);
}
