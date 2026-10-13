import { describe, expect, it } from 'vitest';
import { readTable } from './sheet';

const cell = (text: string) => ({ text });

describe('readTable', () => {
  it('lee por nombre de columna normalizado e ignora filas vacías', () => {
    const { records, problems } = readTable(
      'Productos',
      [
        [cell('Título'), cell('Estado')],
        [cell('Zonas'), cell('Publicado')],
        [cell(''), cell(' ')],
        [cell('Logo')],
      ],
      ['titulo'],
    );
    expect(problems).toEqual([]);
    expect(records.map((r) => [r.row, r.get('titulo').text, r.get('estado').text])).toEqual([
      [2, 'Zonas', 'Publicado'],
      [4, 'Logo', ''],
    ]);
  });

  it('informa las columnas que faltan', () => {
    const { problems } = readTable('Zonas', [[cell('Servicio')]], ['servicio', 'foto']);
    expect(problems).toEqual([
      { sheet: 'Zonas', message: 'Pestaña "Zonas": faltan las columnas "foto".' },
    ]);
  });
});
