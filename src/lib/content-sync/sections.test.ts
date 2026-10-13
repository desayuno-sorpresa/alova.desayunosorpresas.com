import { describe, expect, it } from 'vitest';
import { buildAboutEntry, parseAbout } from './about';
import { parseFaq } from './faq';
import { formatProblem } from './problems';
import type { SheetCell } from './sheet';
import { parseFee, parseZones } from './zones';

const row = (values: string[]): SheetCell[] => values.map((text) => ({ text }));
const PHOTO = 'PPPPPPPPPPPPPPPPPPPPPPPPPPPP';

describe('parseFee', () => {
  it.each([
    ['Gratis', 0],
    ['gratis', 0],
    ['0', 0],
    ['$ 8.000', 8000],
    ['', undefined],
    ['depende', null],
  ])('"%s" → %s', (value, expected) => {
    expect(parseFee(value)).toBe(expected);
  });
});

describe('parseZones', () => {
  const headers = row(['Zona', 'Horario', 'Costo domicilio', 'Notas', 'Orden', 'Estado']);

  it('convierte zonas y ordena', () => {
    const result = parseZones([
      headers,
      row(['Usaquén', '6:00 a 10:00 a. m.', '$ 8.000', '', '2', 'Publicado']),
      row(['Chapinero', '6:00 a 9:00 a. m.', 'Gratis', 'Solo lunes a viernes', '1', 'Publicado']),
    ]);
    expect(result.problems).toEqual([]);
    expect(result.items).toEqual([
      {
        slug: 'chapinero',
        name: 'Chapinero',
        schedule: '6:00 a 9:00 a. m.',
        fee: 0,
        notes: 'Solo lunes a viernes',
        order: 1,
      },
      { slug: 'usaquen', name: 'Usaquén', schedule: '6:00 a 10:00 a. m.', fee: 8000, order: 2 },
    ]);
  });

  it('acepta la pestaña inexistente y reporta errores', () => {
    expect(parseZones([]).items).toEqual([]);
    const result = parseZones([
      headers,
      row(['Usaquén', 'x', 'depende', '', '', 'Publicado']),
      row(['usaquen', '7:00 a. m.', '', '', '', 'Publicado']),
    ]);
    expect(result.problems.map(formatProblem)).toEqual([
      'Zonas, fila 2: "Horario" es demasiado corto (mínimo 3 caracteres).',
      'Zonas, fila 2: "Costo domicilio" debe ser un número, "Gratis" o quedar vacío.',
    ]);
    expect(result.items.map((zone) => zone.slug)).toEqual(['usaquen']);
  });
});

describe('parseFaq', () => {
  const headers = row(['Pregunta', 'Respuesta', 'Orden', 'Estado']);

  it('separa la respuesta en párrafos y genera un id estable', () => {
    const [item] = parseFaq([
      headers,
      row([
        '¿Con cuánta anticipación debo pedir?',
        'Con un día.\nPara fechas especiales, con tres días.',
        '',
        'Publicado',
      ]),
    ]).items;
    expect(item).toEqual({
      slug: 'con-cuanta-anticipacion-debo-pedir',
      question: '¿Con cuánta anticipación debo pedir?',
      answer: ['Con un día.', 'Para fechas especiales, con tres días.'],
      order: 2,
    });
  });

  it('detecta preguntas repetidas', () => {
    const result = parseFaq([
      headers,
      row(['¿Hacen domicilios?', 'Sí, en toda la ciudad.', '', 'Publicado']),
      row(['¿Hacen domicilios?', 'Sí, en el norte de la ciudad.', '', 'Publicado']),
    ]);
    expect(result.problems.map(formatProblem)).toEqual([
      'Preguntas, fila 3: la pregunta ya está en la fila 2.',
    ]);
  });
});

describe('parseAbout', () => {
  const headers = row(['Título', 'Texto', 'Foto', 'Descripción foto', 'Orden', 'Estado']);

  it('acepta bloques con y sin foto, y genera ids estables', () => {
    const result = parseAbout([
      headers,
      row(['', 'Somos una familia que prepara desayunos.', '', '', '2', 'Publicado']),
      row([
        'Nuestra historia',
        'Empezamos en 2020 en casa.',
        PHOTO,
        'Mesa con cajas',
        '1',
        'Publicado',
      ]),
    ]);
    expect(result.problems).toEqual([]);
    expect(result.items.map((block) => [block.slug, block.image?.fileId])).toEqual([
      ['nuestra-historia', PHOTO],
      ['bloque-2', undefined],
    ]);
    const [first] = result.items;
    if (!first) throw new Error('falta el bloque');
    expect(buildAboutEntry(first, undefined, true, '2026-10-12')).toMatchObject({
      image: './nuestra-historia/01.webp',
      imageAlt: 'Mesa con cajas',
    });
  });

  it('exige descripción si hay foto', () => {
    const result = parseAbout([
      headers,
      row(['', 'Texto suficientemente largo.', PHOTO, '', '', 'Publicado']),
    ]);
    expect(result.problems.map(formatProblem)).toEqual([
      'Nosotros, fila 2: "Descripción foto" debe describir la foto (mínimo 5 caracteres).',
    ]);
  });
});
