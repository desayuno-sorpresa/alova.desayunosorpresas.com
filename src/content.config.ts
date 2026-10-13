import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { z } from 'astro/zod';
import { LIMITS as L, SLUG_PATTERN } from '@/lib/content-sync/limits';

/*
 * El JSON y las imágenes de cada colección los genera `pnpm sync:content`
 * (scripts/sync-content.ts) a partir de la hoja de Google del negocio.
 * No editar a mano: el próximo sync lo sobrescribe.
 *
 * CONTENT_DIR permite compilar con datos de ejemplo fijos (tests/fixtures/content) en e2e.
 */
const CONTENT_DIR = process.env['CONTENT_DIR'] || 'src/content';

/** Carga `<dir>/<nombre>/<nombre>.json` validando que los `id` sean aptos para URL. */
function jsonList(name: string) {
  return file(`${CONTENT_DIR}/${name}/${name}.json`, {
    parser: (text) => {
      const entries: unknown = JSON.parse(text);
      if (!Array.isArray(entries)) throw new Error(`${name}.json debe ser una lista.`);
      for (const entry of entries) {
        const id: unknown = entry?.id;
        if (typeof id !== 'string' || !SLUG_PATTERN.test(id)) {
          throw new Error(`Identificador no válido en ${name}.json: ${JSON.stringify(id)}`);
        }
      }
      return entries;
    },
  });
}

const published = {
  order: z.number().int(),
  status: z.literal('publicado'),
  updatedAt: z.coerce.date(),
};

const productos = defineCollection({
  loader: jsonList('productos'),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(L.product.name.min).max(L.product.name.max),
      description: z.string().min(L.product.description.min).max(L.product.description.max),
      includes: z.array(z.string().min(1)),
      price: z.number().int().positive().optional(),
      category: z.string().min(L.product.category.min).max(L.product.category.max),
      featured: z.boolean(),
      image: image(),
      imageAlt: z.string().min(L.altMin),
      ...published,
    }),
});

const zonas = defineCollection({
  loader: jsonList('zonas'),
  schema: z.object({
    name: z.string().min(L.zone.name.min).max(L.zone.name.max),
    schedule: z.string().min(L.zone.schedule.min).max(L.zone.schedule.max),
    fee: z.number().int().nonnegative().optional(),
    notes: z.string().min(L.zone.notes.min).max(L.zone.notes.max).optional(),
    ...published,
  }),
});

const preguntas = defineCollection({
  loader: jsonList('preguntas'),
  schema: z.object({
    question: z.string().min(L.faq.question.min).max(L.faq.question.max),
    answer: z.array(z.string().min(1)).min(1),
    ...published,
  }),
});

const nosotros = defineCollection({
  loader: jsonList('nosotros'),
  schema: ({ image }) =>
    z.object({
      title: z.string().min(L.about.title.min).max(L.about.title.max).optional(),
      text: z.array(z.string().min(1)).min(1),
      image: image().optional(),
      imageAlt: z.string().min(L.altMin).optional(),
      ...published,
    }),
});

export const collections = { productos, zonas, preguntas, nosotros };
