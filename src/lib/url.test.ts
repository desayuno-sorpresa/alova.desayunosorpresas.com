import { describe, expect, it } from 'vitest';
import { withBase } from './url';

describe('withBase', () => {
  it('devuelve la raíz con barra final', () => {
    expect(withBase('', '/')).toBe('/');
    expect(withBase('', '/repo')).toBe('/repo/');
  });

  it('añade la barra final a las páginas', () => {
    expect(withBase('servicios', '/repo/')).toBe('/repo/servicios/');
    expect(withBase('/servicios/', '/repo')).toBe('/repo/servicios/');
  });

  it('no añade barra a archivos con extensión', () => {
    expect(withBase('favicon.svg', '/repo/')).toBe('/repo/favicon.svg');
  });

  it('conserva fragmentos y consultas', () => {
    expect(withBase('#solicitud', '/')).toBe('/#solicitud');
    expect(withBase('condiciones#privado', '/repo')).toBe('/repo/condiciones/#privado');
  });
});
