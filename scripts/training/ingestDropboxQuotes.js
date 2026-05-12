/**
 * ingestDropboxQuotes.js — Etapa 1 + 2 del Shadow Training Harness
 *
 * Recorre el directorio Dropbox de cotizaciones históricas (.ods), extrae datos
 * clave de cada archivo, normaliza al schema Lead JSON y escribe en:
 *   data/training/normalized-quotes.jsonl
 *
 * Uso:
 *   node scripts/training/ingestDropboxQuotes.js
 *   node scripts/training/ingestDropboxQuotes.js --limit 50 --dry-run
 *   node scripts/training/ingestDropboxQuotes.js --limit 200
 *
 * Flags:
 *   --limit N     Procesar solo N archivos (útil para pruebas rápidas)
 *   --dry-run     No escribir archivos; solo reportar
 *
 * Idempotencia: Los lead_id ya escritos se saltan en re-ejecuciones.
 *
 * NOTA: Los archivos de Dropbox que no están sincronizados localmente
 * tienen tamaño 0 bytes en disco (stubs). El script los detecta y omite
 * sin intentar leerlos, evitando timeouts de red.
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, statSync, mkdirSync } from 'fs';
import { readdir } from 'fs/promises';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

import { normalizeLead } from './normalizeLead.js';

// SheetJS para parseo de .ods (instalado como devDependency)
// Usamos createRequire porque xlsx es un módulo CJS
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

const DROPBOX_ROOT = process.env.DROPBOX_COTIZACIONES_PATH
  || '/Users/matias/Library/CloudStorage/Dropbox/BMC - Uruguay/Cotizaciones';

const OUTPUT_DIR = join(dirname(fileURLToPath(import.meta.url)), '../../data/training');
const OUTPUT_FILE = join(OUTPUT_DIR, 'normalized-quotes.jsonl');

// Tamaño mínimo en bytes para considerar un archivo como real (no stub de Dropbox)
// Los stubs tienen 0 bytes en disco; archivos reales típicamente > 10 KB
const MIN_FILE_SIZE_BYTES = 1024;

// ---------------------------------------------------------------------------
// Parseo de argumentos
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : Infinity;
const DRY_RUN = args.includes('--dry-run');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Recorre recursivamente un directorio y devuelve todos los archivos .ods.
 * Respeta los límites de profundidad para evitar travesías innecesarias.
 */
async function findOdsFiles(dir, files = [], depth = 0) {
  if (depth > 5) return files; // límite de profundidad
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    // Directorio no accesible (permisos, Dropbox no sincronizado, etc.)
    return files;
  }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue; // ignorar ocultos
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await findOdsFiles(fullPath, files, depth + 1);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.ods')) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Verifica si el archivo está realmente descargado localmente (no es un stub Dropbox).
 * Los stubs tienen 0 bytes en disco.
 */
function isLocallyAvailable(filepath) {
  try {
    const st = statSync(filepath);
    return st.size >= MIN_FILE_SIZE_BYTES;
  } catch {
    return false;
  }
}

/**
 * Extrae datos del contenido de un archivo .ods usando SheetJS.
 * Devuelve un objeto sheetData o {} si falla.
 * Solo lee la primera hoja para limitar tiempo de procesamiento.
 */
function extractSheetData(filepath) {
  try {
    const buf = readFileSync(filepath);
    const wb = XLSX.read(buf, { type: 'buffer', cellText: true, cellDates: false });

    if (!wb.SheetNames || wb.SheetNames.length === 0) return {};

    const sheet = wb.Sheets[wb.SheetNames[0]];
    if (!sheet) return {};

    // Convertir a array de arrays (filas)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });
    if (!rows || rows.length < 3) return {};

    const sd = {};

    // --- Extracción de campos según estructura documentada en §3 SHEETS-MAP ---
    // La estructura típica de un .ods de cotización BMC:
    //   Fila 3 (índice 2): fecha (ej. "Fecha: 01/12/2025")
    //   Fila 6 (índice 5): "Cliente:" + nombre
    //   Fila 7 (índice 6): "Dirección:" + dirección
    //   Fila 8 (índice 7): "Tel/cel:" + teléfono
    //   Filas 10-12: datos de paneles con precio m² y totales
    //   Fila 31: subtotal materiales
    //   Fila 33-35: total USD

    // Buscar cliente, dirección, teléfono en las primeras 15 filas
    for (let i = 0; i < Math.min(rows.length, 15); i++) {
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();

        if (/^cliente\s*:/i.test(cell)) {
          // El valor puede estar en la misma celda o en la siguiente columna
          const afterColon = cell.replace(/^cliente\s*:\s*/i, '').trim();
          sd.cliente_nombre = afterColon || String(row[j + 1] || '').trim() || null;
        }

        if (/^direcci[oó]n\s*:/i.test(cell)) {
          const afterColon = cell.replace(/^direcci[oó]n\s*:\s*/i, '').trim();
          sd.ubicacion = afterColon || String(row[j + 1] || '').trim() || null;
        }

        if (/^(tel|cel|tel\/cel)\s*[:/]/i.test(cell)) {
          const afterColon = cell.replace(/^(tel|cel|tel\/cel)\s*[:/]\s*/i, '').trim();
          sd.telefono = afterColon || String(row[j + 1] || '').trim() || null;
        }

        if (/^fecha\s*:/i.test(cell)) {
          const afterColon = cell.replace(/^fecha\s*:\s*/i, '').trim();
          const rawFecha = afterColon || String(row[j + 1] || '').trim();
          // Intentar parsear formatos comunes: DD/MM/YYYY, DD-MM-YYYY
          const fm = rawFecha.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
          if (fm) {
            sd.fecha = `${fm[3]}-${fm[2].padStart(2, '0')}-${fm[1].padStart(2, '0')}`;
          }
        }
      }
    }

    // Buscar totales en las últimas filas (buscar en todo el sheet)
    // Patrones: "TOTAL", "Subtotal", "Total USD", "Total m²"
    for (let i = rows.length - 1; i >= 0 && i >= rows.length - 30; i--) {
      const row = rows[i];
      for (let j = 0; j < row.length; j++) {
        const cell = String(row[j] || '').trim();

        if (/^total\s+(usd|final|materiales)/i.test(cell)) {
          // El valor está en la columna siguiente que no esté vacía
          for (let k = j + 1; k < row.length; k++) {
            const v = String(row[k] || '').trim();
            if (v && v !== '' && v !== '0') {
              sd.total_final_str = v;
              break;
            }
          }
        }

        if (/^(subtotal|total\s+m)/i.test(cell) && !sd.total_materiales_str) {
          for (let k = j + 1; k < row.length; k++) {
            const v = String(row[k] || '').trim();
            if (v && v !== '' && v !== '0') {
              sd.total_materiales_str = v;
              break;
            }
          }
        }

        // Buscar área m²
        if (/total\s*m[²2]/i.test(cell) && !sd.area_m2_str) {
          for (let k = j + 1; k < row.length; k++) {
            const v = String(row[k] || '').trim();
            if (v && v !== '' && /^\d/.test(v)) {
              sd.area_m2_str = v;
              break;
            }
          }
        }
      }
    }

    return sd;
  } catch {
    // Archivo ilegible, corrupto o Dropbox stub que pasó el check de tamaño
    return {};
  }
}

/**
 * Carga los lead_id ya procesados desde el archivo JSONL existente.
 * Usado para idempotencia: no duplicar entradas en re-ejecuciones.
 */
function loadExistingLeadIds(outputFile) {
  const ids = new Set();
  if (!existsSync(outputFile)) return ids;
  try {
    const content = readFileSync(outputFile, 'utf8');
    for (const line of content.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      try {
        const obj = JSON.parse(t);
        if (obj.lead_id) ids.add(obj.lead_id);
      } catch {
        // línea malformada, ignorar
      }
    }
  } catch {
    // archivo no legible, empezar desde cero
  }
  return ids;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Shadow Training Harness — Ingesta de Cotizaciones Históricas ===\n');

  if (DRY_RUN) {
    console.log('[DRY-RUN] No se escribirán archivos.\n');
  }

  if (!existsSync(DROPBOX_ROOT)) {
    console.error(`Error: No se encontró el directorio Dropbox:\n  ${DROPBOX_ROOT}`);
    console.error('Verificá que Dropbox esté sincronizado o seteá DROPBOX_COTIZACIONES_PATH.');
    process.exit(1);
  }

  console.log(`Buscando archivos .ods en:\n  ${DROPBOX_ROOT}\n`);

  // Descubrir todos los archivos .ods
  const allFiles = await findOdsFiles(DROPBOX_ROOT);
  console.log(`Total archivos .ods encontrados (índice Dropbox): ${allFiles.length}`);

  // Filtrar stubs: solo archivos con contenido real descargado localmente
  const localFiles = allFiles.filter(isLocallyAvailable);
  console.log(`Archivos con contenido local (tamaño > ${MIN_FILE_SIZE_BYTES} bytes): ${localFiles.length}`);
  console.log(`Stubs Dropbox omitidos: ${allFiles.length - localFiles.length}\n`);

  // Aplicar límite si se especificó --limit
  const filesToProcess = Number.isFinite(LIMIT)
    ? localFiles.slice(0, LIMIT)
    : localFiles;

  if (Number.isFinite(LIMIT)) {
    console.log(`[--limit ${LIMIT}] Procesando solo los primeros ${filesToProcess.length} archivos.\n`);
  }

  // Cargar IDs ya existentes para idempotencia
  const existingIds = loadExistingLeadIds(OUTPUT_FILE);
  if (existingIds.size > 0) {
    console.log(`Idempotencia: ${existingIds.size} leads ya procesados en ejecuciones previas.\n`);
  }

  // Preparar output
  if (!DRY_RUN) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    // No sobreescribir si ya existe (idempotencia — append)
    if (!existsSync(OUTPUT_FILE)) {
      writeFileSync(OUTPUT_FILE, '', 'utf8');
    }
  }

  // Contadores
  let procesados = 0;
  let exitosos = 0;
  let fallidos = 0;
  let saltados = 0;
  const errores = [];
  const distribucionAnio = {};

  // Procesar cada archivo
  for (const filepath of filesToProcess) {
    procesados++;
    const filename = basename(filepath);

    // Normalizar primer paso: solo desde filename (para generar lead_id estable)
    const leadPreview = normalizeLead({ filename, filepath, sheetData: {} });

    if (!leadPreview) {
      // El filename no tiene suficiente información
      fallidos++;
      errores.push({ filepath, razon: 'filename insuficiente para identificar lead' });
      continue;
    }

    // Verificar idempotencia
    if (existingIds.has(leadPreview.lead_id)) {
      saltados++;
      continue;
    }

    // Extraer datos del contenido del .ods
    const sheetData = extractSheetData(filepath);

    // Normalización final combinando filename + sheetData
    const lead = normalizeLead({ filename, filepath, sheetData });

    if (!lead) {
      fallidos++;
      errores.push({ filepath, razon: 'normalizeLead devolvió null' });
      continue;
    }

    // Registrar año para distribución
    const anio = lead.anio || 'desconocido';
    distribucionAnio[anio] = (distribucionAnio[anio] || 0) + 1;

    // Escribir en JSONL
    if (!DRY_RUN) {
      appendFileSync(OUTPUT_FILE, JSON.stringify(lead) + '\n', 'utf8');
    }

    exitosos++;

    // Log de progreso cada 50 archivos
    if (exitosos % 50 === 0) {
      process.stdout.write(`  Procesados: ${exitosos}...\r`);
    }
  }

  // Reporte final
  console.log('\n=== REPORTE FINAL ===\n');
  console.log(`Total archivos procesados:  ${procesados}`);
  console.log(`  Exitosos:                 ${exitosos}`);
  console.log(`  Saltados (ya existen):    ${saltados}`);
  console.log(`  Fallidos:                 ${fallidos}`);

  if (Object.keys(distribucionAnio).length > 0) {
    console.log('\nDistribución por año:');
    const aniosSorted = Object.keys(distribucionAnio).sort();
    for (const anio of aniosSorted) {
      console.log(`  ${anio}: ${distribucionAnio[anio]} leads`);
    }
  }

  if (errores.length > 0) {
    console.log(`\nPrimeros ${Math.min(errores.length, 5)} errores:`);
    errores.slice(0, 5).forEach(e => {
      const shortPath = e.filepath.split('/').slice(-2).join('/');
      console.log(`  [${shortPath}]: ${e.razon}`);
    });
  }

  if (!DRY_RUN && exitosos > 0) {
    console.log(`\nOutput escrito en:\n  ${OUTPUT_FILE}`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error fatal:', err.message);
  process.exit(1);
});
