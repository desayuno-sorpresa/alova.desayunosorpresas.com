import { describe, expect, it } from 'vitest';
import { visibleItems } from './publishing';

const items = [
  { id: 'b', status: 'publicado', order: 2 },
  { id: 'a', status: 'borrador', order: 1 },
  { id: 'c', status: 'publicado', order: 0 },
] as const;

describe('visibleItems', () => {
  it('oculta borradores y ordena', () => {
    expect(visibleItems(items, false).map((item) => item.id)).toEqual(['c', 'b']);
  });

  it('incluye borradores si se pide', () => {
    expect(visibleItems(items, true).map((item) => item.id)).toEqual(['c', 'a', 'b']);
  });
});
