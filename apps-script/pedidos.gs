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
 *
 * Aviso en vivo (doGet): el sitio pide a esta misma URL la lista reciente cada vez que se abre,
 * sin esperar al sync. Solo devuelve Fecha, Producto, Ciudad (opcional) y Tipo de las filas con
 * Estado = Publicado de los últimos días; las consultas solo si el producto está publicado en la
 * pestaña Productos (se muestra con el nombre del catálogo) y una por producto y día. Nunca
 * devuelve otras columnas (p. ej. el cliente). Para retirar una fila, poner Estado = Borrador
 * (el cambio se nota en ~1 minuto por la caché).
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
// Aviso en vivo.
const PRODUCTS_SHEET_NAME = 'Productos';
const RECENT_DAYS = 14;
const MAX_ITEMS = 20;
const CACHE_SECONDS = 60;
const TIME_ZONE = 'America/Bogota';

/** Ejecutar una vez a mano: pide permisos y crea la pestaña o le añade la columna "Tipo". */
function preparar() {
  getSheet_();
}

/** Lista reciente en JSON para el aviso del sitio (con caché de 1 minuto). */
function doGet() {
  const cache = CacheService.getScriptCache();
  let body = cache.get('recientes');
  if (!body) {
    body = JSON.stringify(recientes_());
    cache.put('recientes', body, CACHE_SECONDS);
  }
  return ContentService.createTextOutput(body).setMimeType(ContentService.MimeType.JSON);
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

/** Filas de una pestaña como objetos {encabezado: valor}. */
function readRows_(sheet) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map((header) => String(header).trim());
  return values.slice(1).map((row) => {
    const record = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  });
}

/** Sin tildes, mayúsculas ni espacios repetidos: para comparar nombres. */
function key_(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** Nombres de los productos publicados: clave comparable → nombre oficial del catálogo. */
function catalog_(spreadsheet) {
  const names = {};
  readRows_(spreadsheet.getSheetByName(PRODUCTS_SHEET_NAME)).forEach((row) => {
    if (key_(row['Estado']) !== 'publicado') return;
    const name = String(row['Nombre'] || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (name !== '') names[key_(name)] = name;
  });
  return names;
}

/** "2026-10-17 08:15", "17/10/2026" o una fecha de Sheets → "2026-10-17"; otro valor → null. */
function dateOf_(value) {
  let date = null;
  if (Object.prototype.toString.call(value) === '[object Date]') {
    date = Utilities.formatDate(value, TIME_ZONE, 'yyyy-MM-dd');
  } else {
    const text = String(value || '').trim();
    const iso = /^(\d{4}-\d{2}-\d{2})(?:[ T]|$)/.exec(text);
    const local = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(text);
    if (iso) date = iso[1];
    else if (local)
      date = local[3] + '-' + ('0' + local[2]).slice(-2) + '-' + ('0' + local[1]).slice(-2);
  }
  if (date === null) return null;
  // Descarta fechas imposibles como 2026-02-30.
  return new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) === date ? date : null;
}

function daysBetween_(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

/** Pedidos y consultas publicables, del más reciente al más antiguo. */
function recientes_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  const rows = readRows_(spreadsheet.getSheetByName(SHEET_NAME));
  const catalog = catalog_(spreadsheet);
  const today = Utilities.formatDate(new Date(), TIME_ZONE, 'yyyy-MM-dd');
  const seen = {};
  const items = [];
  rows.forEach((row, index) => {
    if (key_(row['Estado']) !== 'publicado') return;
    const date = dateOf_(row['Fecha']);
    if (date === null) return;
    const age = daysBetween_(date, today);
    if (age < 0 || age > RECENT_DAYS) return;
    const type = key_(row['Tipo']);
    let product = String(row['Producto'] || '')
      .replace(/\s+/g, ' ')
      .trim();
    let city = String(row['Ciudad'] || '')
      .replace(/\s+/g, ' ')
      .trim();
    if (type === 'consulta') {
      const official = catalog[key_(product)];
      if (!official) return;
      const dayKey = date + '|' + key_(product);
      if (seen[dayKey]) return;
      seen[dayKey] = true;
      product = official;
      city = '';
    } else if (type !== '' && type !== 'pedido') {
      return;
    }
    if (product.length < 2 || product.length > MAX_LENGTH || city.length > 60) return;
    const item = {
      date: date,
      product: product,
      kind: type === 'consulta' ? 'consulta' : 'pedido',
    };
    if (city !== '') item.city = city;
    items.push({ item: item, order: index });
  });
  items.sort((a, b) =>
    a.item.date < b.item.date ? 1 : a.item.date > b.item.date ? -1 : b.order - a.order,
  );
  return items.slice(0, MAX_ITEMS).map((entry) => entry.item);
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
