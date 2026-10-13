// Cliente mínimo de Google Sheets (lectura y escritura de la revisión) y Drive (solo lectura).
import type { SheetCell, SheetGrid } from '../../src/lib/content-sync/sheet.ts';
import type { ColumnWrite } from '../../src/lib/content-sync/status.ts';

// La hoja necesita escritura para las columnas "Errores a corregir" y "Detalle error";
// las fotos de Drive solo se leen.
export const SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.readonly',
] as const;

export interface DriveFile {
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

/** Lo que el sync necesita de Google; se inyecta para poder probarlo sin red. */
export interface ContentSource {
  readSheets(names: readonly string[]): Promise<Map<string, SheetGrid>>;
  downloadImage(fileId: string): Promise<DriveFile>;
  /** Escribe columnas completas desde la fila 2 de una pestaña. */
  writeColumns(sheet: string, writes: readonly ColumnWrite[]): Promise<void>;
}

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

interface CellData {
  formattedValue?: string;
  hyperlink?: string;
  chipRuns?: { chip?: { richLinkProperties?: { uri?: string } } }[];
}

interface SpreadsheetResponse {
  sheets?: {
    properties?: { title?: string };
    data?: { rowData?: { values?: CellData[] }[] }[];
  }[];
}

function toCell(data: CellData): SheetCell {
  const chipLink = data.chipRuns?.find((run) => run.chip?.richLinkProperties?.uri)?.chip
    ?.richLinkProperties?.uri;
  const link = chipLink ?? data.hyperlink;
  return { text: data.formattedValue ?? '', ...(link ? { link } : {}) };
}

export function createGoogleSource(
  spreadsheetId: string,
  accessToken: string,
  serviceAccountEmail: string,
): ContentSource {
  const headers = { Authorization: `Bearer ${accessToken}` };

  const sheetsBase = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;

  async function request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await fetch(url, {
      ...init,
      headers: { ...headers, ...(init.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (response.status === 403 || response.status === 404) {
      const what = url.startsWith(sheetsBase)
        ? init.method === 'POST'
          ? 'escribir en la hoja de cálculo'
          : 'la hoja de cálculo'
        : 'una foto';
      throw new Error(
        `Sin acceso a ${what} (${response.status}). Comparte la hoja de cálculo como "Editor" ` +
          `y la carpeta de fotos como "Lector" con ${serviceAccountEmail}.`,
      );
    }
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Google respondió ${response.status} para ${url.split('?')[0]}: ${detail}`);
    }
    return response;
  }

  return {
    async readSheets(names) {
      // Pedir una pestaña inexistente hace fallar toda la consulta: primero se listan.
      const meta = await request(`${sheetsBase}?fields=sheets.properties.title`);
      const metaBody = (await meta.json()) as SpreadsheetResponse;
      const existing = new Set((metaBody.sheets ?? []).map((sheet) => sheet.properties?.title));
      const wanted = names.filter((name) => existing.has(name));
      const result = new Map<string, SheetGrid>();
      if (wanted.length === 0) return result;

      const params = new URLSearchParams({
        fields:
          'sheets(properties.title,data.rowData.values(formattedValue,hyperlink,chipRuns.chip.richLinkProperties.uri))',
      });
      for (const name of wanted) params.append('ranges', `'${name}'`);
      const response = await request(`${sheetsBase}?${params}`);
      const body = (await response.json()) as SpreadsheetResponse;
      for (const sheet of body.sheets ?? []) {
        const title = sheet.properties?.title ?? '';
        const rows = (sheet.data?.[0]?.rowData ?? []).map((row) => (row.values ?? []).map(toCell));
        result.set(title, rows);
      }
      return result;
    },

    async downloadImage(fileId) {
      const base = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`;
      const metaResponse = await request(
        `${base}?fields=name,mimeType,size&supportsAllDrives=true`,
      );
      const meta = (await metaResponse.json()) as {
        name?: string;
        mimeType?: string;
        size?: string;
      };
      if (Number(meta.size ?? 0) > MAX_IMAGE_BYTES) {
        throw new Error(`La foto "${meta.name}" pesa más de 25 MB.`);
      }
      const media = await request(`${base}?alt=media&supportsAllDrives=true`);
      return {
        name: meta.name ?? fileId,
        mimeType: meta.mimeType ?? '',
        bytes: new Uint8Array(await media.arrayBuffer()),
      };
    },

    async writeColumns(sheet, writes) {
      const data = writes
        .filter((write) => write.values.length > 0)
        .map((write) => ({
          range: `'${sheet}'!${write.column}2:${write.column}${write.values.length + 1}`,
          values: write.values.map((value) => [value]),
        }));
      if (data.length === 0) return;
      await request(`${sheetsBase}/values:batchUpdate`, {
        method: 'POST',
        body: JSON.stringify({ valueInputOption: 'RAW', data }),
      });
    },
  };
}
