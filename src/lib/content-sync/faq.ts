import { stampEntry, type CollectionParse, type RowNote } from './collection.ts';
import { reviewTexts } from './content-review.ts';
import { LIMITS } from './limits.ts';
import { FAQ_SHEET, rowProblem, type Problem, type RowRef } from './problems.ts';
import { isPublished, lengthError, parseOrder } from './rows.ts';
import { readTable, type SheetGrid } from './sheet.ts';
import { singleLine, slugify, splitLines } from './text.ts';

const COLUMNS = ['pregunta', 'respuesta', 'estado'] as const;

export interface FaqDraft {
  slug: string;
  question: string;
  /** Un párrafo por línea de la celda. */
  answer: string[];
  order: number;
}

export interface FaqEntry {
  id: string;
  question: string;
  answer: string[];
  order: number;
  status: 'publicado';
  updatedAt: string;
}

/** Identificador estable y corto a partir de la pregunta. */
function questionSlug(question: string): string {
  return slugify(question).slice(0, 60).replace(/-+$/, '');
}

/** Convierte la pestaña opcional "Preguntas" en las preguntas frecuentes. */
export function parseFaq(grid: SheetGrid): CollectionParse<FaqDraft> {
  const problems: Problem[] = [];
  const notes: RowNote[] = [];
  if (grid.length === 0) return { items: [], problems, notes, rows: 0, drafts: 0 };

  const table = readTable(FAQ_SHEET, grid, COLUMNS);
  problems.push(...table.problems);
  const items: FaqDraft[] = [];
  const rowBySlug = new Map<string, number>();

  for (const record of table.records) {
    const at: RowRef = { sheet: FAQ_SHEET, row: record.row };
    if (!isPublished(record, at, notes, problems)) continue;

    const errors: string[] = [];
    const question = singleLine(record.get('pregunta').text);
    const answer = splitLines(record.get('respuesta').text);
    const slug = questionSlug(question);
    const order = parseOrder(record.get('orden').text, record.row);

    const { question: q, answer: a } = LIMITS.faq;
    for (const message of [
      lengthError('Pregunta', question, q.min, q.max),
      lengthError('Respuesta', answer.join('\n'), a.min, a.max),
    ]) {
      if (message) errors.push(message);
    }
    if (slug !== '' && rowBySlug.has(slug)) {
      errors.push(`la pregunta ya está en la fila ${rowBySlug.get(slug)}.`);
    }
    if (order === null) errors.push('"Orden" debe ser un número entero.');
    errors.push(
      ...reviewTexts([
        { label: 'Pregunta', value: question },
        { label: 'Respuesta', value: answer.join('\n') },
      ]),
    );

    if (errors.length > 0 || order === null) {
      problems.push(...errors.map((message) => rowProblem(at, message)));
      continue;
    }
    rowBySlug.set(slug, record.row);
    items.push({ slug, question, answer, order });
  }

  return {
    items: items.toSorted((a, b) => a.order - b.order),
    problems,
    notes,
    rows: table.records.length,
    drafts: notes.length,
  };
}

export function buildFaqEntry(
  faq: FaqDraft,
  previous: FaqEntry | undefined,
  imagesChanged: boolean,
  today: string,
): FaqEntry {
  return stampEntry<FaqEntry>(
    {
      id: faq.slug,
      question: faq.question,
      answer: faq.answer,
      order: faq.order,
      status: 'publicado',
    },
    previous,
    imagesChanged,
    today,
  );
}
