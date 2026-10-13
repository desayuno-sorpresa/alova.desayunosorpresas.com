import { describe, expect, it } from 'vitest';
import { parseHttpsUrl, parseYesNo } from './links';

describe('parseHttpsUrl', () => {
  it('acepta enlaces https y los normaliza', () => {
    expect(parseHttpsUrl(' https://alova.desayunosorpresas.com ')).toEqual({
      ok: true,
      url: 'https://alova.desayunosorpresas.com/',
    });
  });

  it.each([
    ['', 'está vacío.'],
    ['alova.desayunosorpresas.com', 'debe ser una dirección completa'],
    ['http://alova.desayunosorpresas.com', 'debe empezar por "https://"'],
    ['https://usuario:clave@alova.com', 'usuario ni contraseña'],
    ['https://localhost', 'el dominio no es válido'],
    ['https://mi negocio.com', 'no puede tener espacios'],
    ['javascript:alert(1)', 'debe empezar por "https://"'],
  ])('rechaza "%s"', (value, message) => {
    const result = parseHttpsUrl(value);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });
});

describe('parseYesNo', () => {
  it.each([
    ['Sí', true],
    ['si', true],
    ['X', true],
    ['', false],
    ['No', false],
    ['tal vez', null],
  ])('"%s" → %s', (value, expected) => {
    expect(parseYesNo(value)).toBe(expected);
  });
});
