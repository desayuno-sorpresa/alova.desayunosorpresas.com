import { describe, expect, it } from 'vitest';
import { normalizeHeader, parsePrice, slugify, splitLines } from './text';

describe('normalizeHeader', () => {
  it('quita tildes, mayúsculas y espacios', () => {
    expect(normalizeHeader(' Título ')).toBe('titulo');
    expect(normalizeHeader('Precio desde')).toBe('precio_desde');
    expect(normalizeHeader('Descripción portada')).toBe('descripcion_portada');
  });
});

describe('slugify', () => {
  it('genera identificadores aptos para URL', () => {
    expect(slugify('Fotografía de Producto ¡Nueva!')).toBe('fotografia-de-producto-nueva');
    expect(slugify('  Diseño & Logo  ')).toBe('diseno-logo');
  });
});

describe('splitLines', () => {
  it('separa por saltos de línea y quita viñetas', () => {
    expect(splitLines('- Uno\n\n• Dos \r\n* Tres')).toEqual(['Uno', 'Dos', 'Tres']);
  });
});

describe('parsePrice', () => {
  it('acepta formatos habituales en pesos', () => {
    expect(parsePrice('150000')).toBe(150000);
    expect(parsePrice('$ 150.000')).toBe(150000);
  });

  it('distingue vacío de inválido', () => {
    expect(parsePrice('  ')).toBeUndefined();
    expect(parsePrice('desde 100')).toBeNull();
    expect(parsePrice('0')).toBeNull();
  });
});
