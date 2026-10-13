import { describe, expect, it } from 'vitest';
import { reviewAltTexts, reviewTexts } from './content-review';

const review = (value: string) => reviewTexts([{ label: 'Descripción', value }]);

describe('reviewTexts', () => {
  it.each([
    ['Visibilidad mayor en google', /promete resultados en Google/],
    ['Te posicionamos en Google en una semana', /promete resultados en Google/],
    ['Aparece primero en los buscadores', /promete resultados en Google/],
    ['Resultados garantizados', /garantizados/],
    ['Satisfacción GARANTIZADA', /garantizados/],
    ['Primer lugar en ventas', /primeros lugares/],
    ['Efectividad 100 % asegurada', /promesa absoluta/],
    ['Lorem ipsum dolor', /relleno/],
    ['Texto de prueba', /relleno/],
  ])('marca "%s"', (text, expected) => {
    expect(review(text).join(' ')).toMatch(expected);
  });

  it.each([
    'Una página rápida y fácil de encontrar.',
    'Primer párrafo con todo lo que incluye el servicio.',
    'Te ayudamos con tu perfil de Google y tu catálogo de WhatsApp.',
    'Entregamos todo listo en 3 días.',
    'Garantía de atención por WhatsApp',
  ])('no marca "%s"', (text) => {
    expect(review(text)).toEqual([]);
  });

  it('corrige la escritura de marcas', () => {
    expect(review('Pedidos por whatsapp e instagram')).toEqual([
      '"Descripción" escribe la marca como "WhatsApp".',
      '"Descripción" escribe la marca como "Instagram".',
    ]);
  });

  it('detecta textos en mayúsculas sin marcar siglas cortas', () => {
    expect(review('PÁGINA WEB PARA TU NEGOCIO')).toEqual([
      '"Descripción" está casi todo en MAYÚSCULAS; escríbelo en minúsculas normales.',
    ]);
    expect(review('Diseño web con SEO técnico y HTML')).toEqual([]);
  });

  it('ignora campos vacíos y nombra la columna', () => {
    expect(
      reviewTexts([
        { label: 'Beneficios', value: '' },
        { label: 'Título', value: 'xxx' },
      ]),
    ).toEqual(['"Título" contiene texto de relleno; reemplázalo por el texto definitivo.']);
  });
});

describe('reviewAltTexts', () => {
  it('ignora descripciones y títulos vacíos', () => {
    expect(
      reviewAltTexts(
        [
          { label: 'Descripción foto', origin: 'la foto 1', alt: '' },
          { label: 'Descripción foto', origin: 'la foto 2', alt: '' },
        ],
        '',
        'Texto del bloque',
      ),
    ).toEqual([]);
  });

  it('rechaza descripciones que repiten título o resumen', () => {
    expect(
      reviewAltTexts(
        [
          { label: 'Descripción portada', origin: 'la portada', alt: 'Creación de página web' },
          { label: 'Descripción foto', origin: 'la foto 2', alt: 'Una página web lista para ti.' },
        ],
        'Creación de página web',
        'Una página web lista para ti.',
      ),
    ).toEqual([
      {
        index: 0,
        message:
          '"Descripción portada" repite el nombre o título; describe lo que se ve en la foto.',
      },
      {
        index: 1,
        message: '"Descripción foto" repite la descripción; describe lo que se ve en la foto.',
      },
    ]);
  });

  it('rechaza descripciones repetidas entre fotos e indica cuál es la original', () => {
    expect(
      reviewAltTexts(
        [
          { label: 'Descripción portada', origin: 'la portada', alt: 'Caja con globos' },
          { label: 'Descripción foto', origin: 'la foto 2', alt: 'caja con  globos' },
        ],
        'Título',
        'Resumen del servicio',
      ),
    ).toEqual([
      {
        index: 1,
        message:
          '"Descripción foto" es igual a la de la portada; cada foto necesita su propia descripción.',
      },
    ]);
  });
});
