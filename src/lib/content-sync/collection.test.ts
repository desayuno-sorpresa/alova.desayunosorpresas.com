import { describe, expect, it } from 'vitest';
import { imageFiles, imageName, stampEntry } from './collection';

describe('imageFiles', () => {
  it('numera las imágenes con dos dígitos', () => {
    expect(imageFiles('caja-dulce', 2)).toEqual(['./caja-dulce/01.webp', './caja-dulce/02.webp']);
    expect(imageFiles('x', 0)).toEqual([]);
  });
});

describe('imageName', () => {
  it('nombra la imagen con su pestaña y fila', () => {
    const ref = { fileId: 'a', alt: 'x', source: { sheet: 'Productos' as const, row: 4 } };
    expect(imageName(ref)).toBe('la imagen de Productos, fila 4');
  });
});

describe('stampEntry', () => {
  const previous = { id: 'a', name: 'Uno', updatedAt: '2026-01-01' };

  it('usa la fecha de hoy para elementos nuevos o modificados', () => {
    expect(stampEntry({ id: 'a', name: 'Uno' }, undefined, false, '2026-10-12').updatedAt).toBe(
      '2026-10-12',
    );
    expect(stampEntry({ id: 'a', name: 'Dos' }, previous, false, '2026-10-12').updatedAt).toBe(
      '2026-10-12',
    );
  });

  it('conserva la fecha anterior si nada cambió', () => {
    expect(stampEntry({ id: 'a', name: 'Uno' }, previous, false, '2026-10-12').updatedAt).toBe(
      '2026-01-01',
    );
  });
});
