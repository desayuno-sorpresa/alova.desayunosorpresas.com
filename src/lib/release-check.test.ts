import { describe, expect, it } from 'vitest';
import { findReleaseBlockers } from './release-check';

const ready = {
  businessName: 'Alova',
  tagline: 'Desayunos sorpresa hechos a mano',
  description: 'Desayunos sorpresa con entrega a domicilio.',
  city: 'Bogotá',
  whatsApp: '+57 300 123 4567',
  instagramUrl: null,
};

describe('findReleaseBlockers', () => {
  it('no bloquea una configuración completa', () => {
    expect(findReleaseBlockers(ready)).toEqual([]);
  });

  it('lista cada dato pendiente', () => {
    const blockers = findReleaseBlockers({
      businessName: null,
      tagline: null,
      description: null,
      city: ' ',
      whatsApp: null,
      instagramUrl: null,
    });
    expect(blockers).toHaveLength(5);
    expect(blockers[4]).toBe('Falta el número de WhatsApp de pedidos (siteConfig.whatsApp).');
  });

  it('valida WhatsApp, longitud de la descripción e Instagram', () => {
    expect(
      findReleaseBlockers({
        ...ready,
        whatsApp: '123',
        description: 'x'.repeat(161),
        instagramUrl: 'instagram.com/alova',
      }),
    ).toEqual([
      'El número de WhatsApp "123" no es válido.',
      'La descripción para buscadores supera los 160 caracteres.',
      'El enlace de Instagram debe empezar por "https://".',
    ]);
  });
});
