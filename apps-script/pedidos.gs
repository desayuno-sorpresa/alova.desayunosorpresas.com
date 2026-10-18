/**
 * Pestaña "Pedidos" de la hoja del negocio: la crea y registra una "Consulta" por cada clic en
 * "Pedir por WhatsApp" del sitio. Proyecto independiente de Apps Script (script.google.com →
 * Nuevo proyecto); no forma parte del build del sitio.
 *
 * Despliegue:
 *   1. Cambiar SPREADSHEET_ID por el ID de la hoja del negocio (está en su URL).
 *   2. Ejecutar la función "preparar" una vez (pide permisos y crea/actualiza la pestaña).
 *   3. Implementar → Nueva implementación → Aplicación web.
 *      Ejecutar como: "Yo". Quién tiene acceso: "Cualquier usuario".
 *      Si ya existe una implementación: Administrar implementaciones → editar → Versión
 *      nueva (la URL no cambia).
 *   4. Copiar la URL (https://script.google.com/macros/s/…/exec) en
 *      `siteConfig.orderTracking.endpoint` (src/config/site.ts).
 *
 * Una consulta NO es un pedido: pulsar el botón no prueba una venta. El sitio la muestra como
 * "Alguien consultó por «…»". Los pedidos reales los anota el negocio a mano con Tipo = Pedido.
 * El sync solo publica Fecha, Producto, Ciudad, Tipo y Estado; solo consultas de productos que
 * existen en el catálogo y una por producto y día. Para retirar una, poner Estado = Borrador.
 */

const SPREADSHEET_ID = '1LrImMATgPHmHYEn6JxRZsjsIFqzmgHzOFMPnr56IOoI';
const SHEET_NAME = 'Pedidos';
const HEADERS = [
  'Fecha',
  'Producto',
  'Ciudad',
  'Tipo',
  'Estado',
  'Errores a corregir',
  'Detalle error',
];
const MAX_LENGTH = 80;
// Freno simple contra envíos masivos: máximo de consultas por cada 10 minutos.
const MAX_PER_WINDOW = 60;
const WINDOW_SECONDS = 600;

/** Ejecutar una vez a mano: pide permisos y crea la pestaña o le añade la columna "Tipo". */
function preparar() {
  getSheet_();
}

function doPost(e) {
  const product = clean_(e && e.parameter && e.parameter.product);
  if (product.length < 2) return reply_('invalid');
  if (!withinRateLimit_()) return reply_('busy');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getSheet_();
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const values = {
      Fecha: Utilities.formatDate(new Date(), 'America/Bogota', 'yyyy-MM-dd'),
      Producto: product,
      Tipo: 'Consulta',
      Estado: 'Publicado',
    };
    // Por nombre de columna: se pueden reordenar o añadir columnas en la hoja.
    const row = headers.map((header) => (header in values ? values[header] : ''));
    sheet
      .getRange(sheet.getLastRow() + 1, 1, 1, row.length)
      .setNumberFormat('@')
      .setValues([row]);
  } finally {
    lock.releaseLock();
  }
  return reply_('ok');
}

/** Una línea, longitud máxima y sin fórmulas: quita "=", "+" o "-" al inicio. */
function clean_(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[=+\-]+\s*/, '')
    .slice(0, MAX_LENGTH);
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    const rows = sheet.getMaxRows() - 1;
    sheet.getRange(2, HEADERS.indexOf('Fecha') + 1, rows).setNumberFormat('yyyy-mm-dd');
    sheet
      .getRange(2, HEADERS.indexOf('Tipo') + 1, rows)
      .setDataValidation(list_(['Pedido', 'Consulta']));
    sheet
      .getRange(2, HEADERS.indexOf('Estado') + 1, rows)
      .setDataValidation(list_(['Publicado', 'Borrador']));
    sheet
      .getRange(1, HEADERS.indexOf('Errores a corregir') + 1, sheet.getMaxRows(), 2)
      .setBackground('#f3f3f3');
    sheet.autoResizeColumns(1, HEADERS.length);
    return sheet;
  }
  // Pestaña creada antes de existir "Tipo": se añade al final (el script escribe por nombre).
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (headers.indexOf('Tipo') === -1) {
    const column = sheet.getLastColumn() + 1;
    sheet.getRange(1, column).setValue('Tipo').setFontWeight('bold');
    sheet
      .getRange(2, column, sheet.getMaxRows() - 1)
      .setDataValidation(list_(['Pedido', 'Consulta']));
  }
  return sheet;
}

function list_(values) {
  return SpreadsheetApp.newDataValidation()
    .requireValueInList(values)
    .setAllowInvalid(false)
    .build();
}

function withinRateLimit_() {
  const cache = CacheService.getScriptCache();
  const count = Number(cache.get('consultas') || 0);
  if (count >= MAX_PER_WINDOW) return false;
  cache.put('consultas', String(count + 1), WINDOW_SECONDS);
  return true;
}

function reply_(status) {
  return ContentService.createTextOutput(status).setMimeType(ContentService.MimeType.TEXT);
}
