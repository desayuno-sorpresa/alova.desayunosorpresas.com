/** Límites compartidos entre el sync (mensajes amigables) y los esquemas Zod de las colecciones. */
export const LIMITS = {
  product: {
    name: { min: 3, max: 80 },
    description: { min: 10, max: 240 },
    category: { min: 2, max: 40 },
  },
  zone: {
    name: { min: 2, max: 80 },
    schedule: { min: 3, max: 120 },
    notes: { min: 3, max: 200 },
  },
  faq: {
    question: { min: 5, max: 160 },
    answer: { min: 5, max: 1200 },
  },
  about: {
    title: { min: 3, max: 80 },
    text: { min: 10, max: 1500 },
  },
  order: {
    product: { min: 2, max: 80 },
    city: { min: 2, max: 60 },
    /** Días que un pedido sigue visible en el aviso. */
    days: 14,
    /** Máximo de pedidos publicados. */
    max: 20,
  },
  altMin: 5,
} as const;

/** Categoría cuando "Categoría" está vacía. */
export const DEFAULT_CATEGORY = 'Desayunos';

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
