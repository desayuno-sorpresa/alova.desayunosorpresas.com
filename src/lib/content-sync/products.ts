import {
  imageFiles,
  stampEntry,
  type CollectionParse,
  type DriveImageRef,
  type RowNote,
} from './collection.ts';
import { reviewAltTexts, reviewTexts } from './content-review.ts';
import { DEFAULT_CATEGORY, LIMITS, SLUG_PATTERN } from './limits.ts';
import { parseYesNo } from './links.ts';
import { PRODUCTS_SHEET, rowProblem, type Problem, type RowRef } from './problems.ts';
import { driveIdOf, isPublished, lengthError, parseOrder } from './rows.ts';
import { readTable, type SheetGrid } from './sheet.ts';
import { parsePrice, singleLine, slugify, splitLines } from './text.ts';

const COLUMNS = ['nombre', 'descripcion', 'estado', 'foto', 'descripcion_foto'] as const;

/** Producto publicado tal como sale de la hoja, antes de descargar su foto. */
export interface ProductDraft {
  slug: string;
  name: string;
  description: string;
  includes: string[];
  price?: number;
  category: string;
  featured: boolean;
  order: number;
  image: DriveImageRef;
}

/** Entrada de `productos.json`. */
export interface ProductEntry {
  id: string;
  name: string;
  description: string;
  includes: string[];
  price?: number;
  category: string;
  featured: boolean;
  order: number;
  image: string;
  imageAlt: string;
  status: 'publicado';
  updatedAt: string;
}

/** Convierte la pestaña "Productos" (obligatoria) en el catálogo publicado. */
export function parseProducts(grid: SheetGrid): CollectionParse<ProductDraft> {
  const problems: Problem[] = [];
  const notes: RowNote[] = [];
  const table = readTable(PRODUCTS_SHEET, grid, COLUMNS);
  problems.push(...table.problems);
  const items: ProductDraft[] = [];
  const rowBySlug = new Map<string, number>();

  for (const record of table.records) {
    const at: RowRef = { sheet: PRODUCTS_SHEET, row: record.row };
    if (!isPublished(record, at, notes, problems)) continue;

    const errors: string[] = [];
    const name = singleLine(record.get('nombre').text);
    const customSlug = singleLine(record.get('identificador').text);
    const slug = customSlug === '' ? slugify(name) : customSlug;
    const description = singleLine(record.get('descripcion').text);
    const includes = splitLines(record.get('incluye').text);
    const price = parsePrice(record.get('precio').text);
    const category = singleLine(record.get('categoria').text) || DEFAULT_CATEGORY;
    const featured = parseYesNo(record.get('destacado').text);
    const order = parseOrder(record.get('orden').text, record.row);
    const fileId = driveIdOf(record.get('foto'));
    const alt = singleLine(record.get('descripcion_foto').text);

    if (!SLUG_PATTERN.test(slug)) {
      errors.push(
        `"Identificador" solo puede tener minúsculas sin tildes, números y guiones (valor: "${slug}").`,
      );
    } else if (rowBySlug.has(slug)) {
      errors.push(`el identificador "${slug}" ya se usa en la fila ${rowBySlug.get(slug)}.`);
    }
    const { name: n, description: d, category: c } = LIMITS.product;
    for (const message of [
      lengthError('Nombre', name, n.min, n.max),
      lengthError('Descripción', description, d.min, d.max),
      lengthError('Categoría', category, c.min, c.max),
    ]) {
      if (message) errors.push(message);
    }
    if (price === null) errors.push('"Precio" debe ser un número, p. ej. 85000 (o quedar vacío).');
    if (featured === null) errors.push('"Destacado" debe ser "Sí" o "No" (o quedar vacío).');
    if (order === null) errors.push('"Orden" debe ser un número entero.');
    if (fileId === null) errors.push('"Foto" debe ser un enlace de Google Drive a la foto.');
    if (alt.length < LIMITS.altMin) {
      errors.push(
        `"Descripción foto" debe describir la foto (mínimo ${LIMITS.altMin} caracteres).`,
      );
    }
    errors.push(
      ...reviewTexts([
        { label: 'Nombre', value: name },
        { label: 'Descripción', value: description },
        { label: 'Incluye', value: includes.join('\n') },
        { label: 'Categoría', value: category },
        { label: 'Descripción foto', value: alt },
      ]),
      ...reviewAltTexts(
        [{ label: 'Descripción foto', origin: 'la foto', alt }],
        name,
        description,
      ).map((problem) => problem.message),
    );

    if (errors.length > 0 || price === null || featured === null || order === null || !fileId) {
      problems.push(...errors.map((message) => rowProblem(at, message)));
      continue;
    }
    rowBySlug.set(slug, record.row);
    items.push({
      slug,
      name,
      description,
      includes,
      ...(price === undefined ? {} : { price }),
      category,
      featured,
      order,
      image: { fileId, alt, source: at },
    });
  }

  // Misma foto en dos productos: casi siempre es un error al copiar el enlace.
  const firstUse = new Map<string, ProductDraft>();
  for (const product of items) {
    const previous = firstUse.get(product.image.fileId);
    if (previous) {
      problems.push(
        rowProblem(
          product.image.source,
          `"Foto" es la misma que la del producto "${previous.name}" (fila ${previous.image.source.row}); usa otra foto.`,
        ),
      );
    } else {
      firstUse.set(product.image.fileId, product);
    }
  }

  return {
    items: items.toSorted((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'es')),
    problems,
    notes,
    rows: table.records.length,
    drafts: notes.length,
  };
}

export function productImages(product: ProductDraft): DriveImageRef[] {
  return [product.image];
}

export function buildProductEntry(
  product: ProductDraft,
  previous: ProductEntry | undefined,
  imagesChanged: boolean,
  today: string,
): ProductEntry {
  const [image = ''] = imageFiles(product.slug, 1);
  return stampEntry<ProductEntry>(
    {
      id: product.slug,
      name: product.name,
      description: product.description,
      includes: product.includes,
      ...(product.price === undefined ? {} : { price: product.price }),
      category: product.category,
      featured: product.featured,
      order: product.order,
      image,
      imageAlt: product.image.alt,
      status: 'publicado',
    },
    previous,
    imagesChanged,
    today,
  );
}
