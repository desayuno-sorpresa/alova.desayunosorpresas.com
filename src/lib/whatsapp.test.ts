import { describe, expect, it } from 'vitest';
import { buildWaMeUrl, normalizePhone } from './whatsapp';

describe('normalizePhone', () => {
  it('acepta formatos habituales', () => {
    expect(normalizePhone('+57 300 123 4567')).toBe('573001234567');
    expect(normalizePhone('57-300-123-4567')).toBe('573001234567');
  });

  it('rechaza números incompletos o con letras', () => {
    expect(normalizePhone('300')).toBeNull();
    expect(normalizePhone('57300abc4567')).toBeNull();
    expect(normalizePhone('0573001234567')).toBeNull();
  });
});

describe('buildWaMeUrl', () => {
  it('codifica el mensaje', () => {
    expect(buildWaMeUrl('+57 300 123 4567', 'Hola & bienvenida\n¿sí?')).toBe(
      'https://wa.me/573001234567?text=Hola%20%26%20bienvenida%0A%C2%BFs%C3%AD%3F',
    );
  });

  it('sin mensaje no añade parámetros', () => {
    expect(buildWaMeUrl('+57 300 123 4567')).toBe('https://wa.me/573001234567');
  });

  it('falla con un número inválido', () => {
    expect(() => buildWaMeUrl('123', 'x')).toThrow(/no válido/);
  });
});
