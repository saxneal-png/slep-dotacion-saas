import initSqlJs, { Database } from 'sql.js';
import { getEmbeddedSqlWasm } from './sqlWasmBinary';
import { INIT_SCHEMA_SQL, runMigrations } from './schema';
import { getIdbBytes, setIdbBytes, deleteIdbBytes } from './idbStorage';

let dbInstance: Database | null = null;
const STORAGE_KEY = 'slep_valle_diguillin_sqlite_db';

export async function getDb(): Promise<Database> {
  if (dbInstance) return dbInstance;

  let SQL: any;
  try {
    const wasmBytes = getEmbeddedSqlWasm();
    const arrayBuffer = wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength
    ) as ArrayBuffer;

    SQL = await initSqlJs({
      wasmBinary: arrayBuffer
    });
  } catch (err) {
    console.warn('Fallo inicialización con wasmBinary embebido, intentando locateFile:', err);
    SQL = await initSqlJs({
      locateFile: file => `./${file}`
    });
  }

  let db: Database;
  let rawBytes: Uint8Array | null = await getIdbBytes(STORAGE_KEY);

  // Si no está en IndexedDB, verificar si existe migración pendiente desde localStorage
  if (!rawBytes && typeof localStorage !== 'undefined') {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      try {
        rawBytes = new Uint8Array(JSON.parse(savedData));
        // Migrar a IndexedDB y limpiar localStorage
        await setIdbBytes(STORAGE_KEY, rawBytes);
        localStorage.removeItem(STORAGE_KEY);
        console.log('Migración exitosa de SQLite DB desde localStorage a IndexedDB.');
      } catch (e) {
        console.error('Error al migrar datos desde localStorage:', e);
      }
    }
  }

  if (rawBytes) {
    try {
      db = new SQL.Database(rawBytes);
    } catch (e) {
      console.error('Error al restaurar SQLite DB, creando nueva:', e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  dbInstance = db;
  try {
    dbInstance.run("PRAGMA foreign_keys = ON;");
  } catch (e) {
    console.warn('Advertencia al habilitar PRAGMA foreign_keys:', e);
  }
  runMigrations(dbInstance);
  persistDb();
  return dbInstance;
}

let lastPersistTime: string = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
export type PersistListener = (status: 'saved' | 'error', time: string, error?: string) => void;
let persistListeners: PersistListener[] = [];

export function subscribePersist(cb: PersistListener): () => void {
  persistListeners.push(cb);
  return () => {
    persistListeners = persistListeners.filter(l => l !== cb);
  };
}

export function getUltimaHoraGuardado(): string {
  return lastPersistTime;
}

let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
let isDbDirty = false;

// Auto-guardado en cierre o desenfoque de ventana
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (isDbDirty) {
      flushPersist();
    }
  });
}

function flushPersist(): void {
  if (!dbInstance || !isDbDirty) return;
  try {
    const data = dbInstance.export();
    isDbDirty = false;
    lastPersistTime = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (typeof indexedDB !== 'undefined') {
      setIdbBytes(STORAGE_KEY, data)
        .then(() => {
          persistListeners.forEach(l => l('saved', lastPersistTime));
        })
        .catch(err => {
          console.error('Error al persistir en IndexedDB:', err);
          persistListeners.forEach(l => l('error', lastPersistTime, err?.message));
        });
    } else if (typeof localStorage !== 'undefined') {
      // Fallback para entornos donde no exista IndexedDB
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(data)));
      persistListeners.forEach(l => l('saved', lastPersistTime));
    } else {
      persistListeners.forEach(l => l('saved', lastPersistTime));
    }
  } catch (e: any) {
    console.error('Error al persistir SQLite DB:', e);
    const msg = e?.name === 'QuotaExceededError'
      ? 'Límite de almacenamiento local excedido. Por favor exporta una copia SQLite como respaldo.'
      : (e?.message || 'Error de persistencia');
    persistListeners.forEach(l => l('error', new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), msg));
  }
}

export function persistDb(forceImmediate = false): void {
  isDbDirty = true;

  if (persistDebounceTimer) {
    clearTimeout(persistDebounceTimer);
    persistDebounceTimer = null;
  }

  if (forceImmediate) {
    flushPersist();
  } else {
    persistDebounceTimer = setTimeout(() => {
      persistDebounceTimer = null;
      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        (window as any).requestIdleCallback(() => flushPersist(), { timeout: 1000 });
      } else {
        flushPersist();
      }
    }, 1500);
  }
}

/**
 * Exporta el archivo binario nativo SQLite (.sqlite / .db)
 */
export async function exportarBaseDatosSqlite(): Promise<Uint8Array> {
  const db = await getDb();
  return db.export();
}

/**
 * Restaura la base de datos SQLite directamente desde un archivo binario (.sqlite / .db)
 */
/**
 * Restaura la base de datos SQLite directamente desde un archivo binario (.sqlite / .db)
 */
export async function importarBaseDatosSqlite(bytes: Uint8Array): Promise<void> {
  let SQL: any;
  try {
    const wasmBytes = getEmbeddedSqlWasm();
    const arrayBuffer = wasmBytes.buffer.slice(
      wasmBytes.byteOffset,
      wasmBytes.byteOffset + wasmBytes.byteLength
    ) as ArrayBuffer;
    SQL = await initSqlJs({ wasmBinary: arrayBuffer });
  } catch (err) {
    SQL = await initSqlJs({ locateFile: file => `./${file}` });
  }
  const db = new SQL.Database(bytes);
  dbInstance = db;
  try {
    db.run("PRAGMA foreign_keys = ON;");
  } catch (_) {}
  runMigrations(db);
  persistDb();
}
/**
 * Borra masivamente la dotación de un periodo específico (opcionalmente filtrado por RBD).
 */
export async function borrarDotacionPeriodo(periodo: number, rbd?: string): Promise<{
  cursosBorrados: number;
  docentesBorrados: number;
  asignacionesBorradas: number;
  asistentesBorrados: number;
}> {
  const db = await getDb();
  let whereClause = "WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026))";
  let params: any[] = [periodo, periodo];

  if (rbd) {
    whereClause += " AND rbd = ?";
    params.push(rbd);
  }

  const countAsig = db.exec(`SELECT count(*) FROM asignaciones_horarias ${whereClause}`, params);
  const countCursos = db.exec(`SELECT count(*) FROM cursos_sae ${whereClause}`, params);
  const countDoc = db.exec(`SELECT count(*) FROM docentes ${whereClause}`, params);
  const countAst = db.exec(`SELECT count(*) FROM asistentes_educacion ${whereClause}`, params);

  const asignacionesBorradas = (countAsig[0]?.values[0]?.[0] as number) || 0;
  const cursosBorrados = (countCursos[0]?.values[0]?.[0] as number) || 0;
  const docentesBorrados = (countDoc[0]?.values[0]?.[0] as number) || 0;
  const asistentesBorrados = (countAst[0]?.values[0]?.[0] as number) || 0;

  db.run(`DELETE FROM asignaciones_horarias ${whereClause}`, params);
  db.run(`DELETE FROM cursos_sae ${whereClause}`, params);
  db.run(`DELETE FROM docentes ${whereClause}`, params);
  db.run(`DELETE FROM asistentes_educacion ${whereClause}`, params);

  persistDb();

  return {
    cursosBorrados,
    docentesBorrados,
    asignacionesBorradas,
    asistentesBorrados
  };
}

/**
 * Reinicia completamente la base de datos a su estado inicial, eliminando todas las tablas y datos.
 */
export async function reiniciarTodaLaBaseDatos(): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM asignaciones_horarias");
  db.run("DELETE FROM cursos_sae");
  db.run("DELETE FROM docentes");
  db.run("DELETE FROM asistentes_educacion");
  db.run("DELETE FROM salas_infraestructura");
  db.run("DELETE FROM establecimientos");
  db.run("DELETE FROM planes_estudio_mineduc");

  try {
    await deleteIdbBytes(STORAGE_KEY);
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error clearing SQLite database storage:', e);
  }

  runMigrations(db);
  persistDb();
}
