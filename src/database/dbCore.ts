import initSqlJs, { Database } from 'sql.js';
import { getEmbeddedSqlWasm } from './sqlWasmBinary';
import { INIT_SCHEMA_SQL, runMigrations } from './schema';

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
  const savedData = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (savedData) {
    try {
      const uInt8Array = new Uint8Array(JSON.parse(savedData));
      db = new SQL.Database(uInt8Array);
    } catch (e) {
      console.error('Error al restaurar SQLite DB, creando nueva:', e);
      db = new SQL.Database();
    }
  } else {
    db = new SQL.Database();
  }

  dbInstance = db;
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

export function persistDb(): void {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(data)));
    }
    lastPersistTime = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    persistListeners.forEach(l => l('saved', lastPersistTime));
  } catch (e: any) {
    console.error('Error al persistir SQLite DB:', e);
    const msg = e?.name === 'QuotaExceededError'
      ? 'Límite de almacenamiento local excedido. Por favor exporta una copia SQLite como respaldo.'
      : (e?.message || 'Error de persistencia');
    persistListeners.forEach(l => l('error', new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }), msg));
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
export async function importarBaseDatosSqlite(bytes: Uint8Array): Promise<void> {
  const SQL = await initSqlJs({
    locateFile: file => `./${file}`
  });
  dbInstance = new SQL.Database(bytes);
  runMigrations(dbInstance);
  persistDb();
}
/**
 * Borra masivamente la dotación de un periodo específico (opcionalmente filtrado por RBD).
 */
export async function borrarDotacionPeriodo(periodo: number, rbd?: string): Promise<{
  cursosBorrados: number;
  docentesBorrados: number;
  asignacionesBorradas: number;
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

  const asignacionesBorradas = (countAsig[0]?.values[0]?.[0] as number) || 0;
  const cursosBorrados = (countCursos[0]?.values[0]?.[0] as number) || 0;
  const docentesBorrados = (countDoc[0]?.values[0]?.[0] as number) || 0;

  db.run(`DELETE FROM asignaciones_horarias ${whereClause}`, params);
  db.run(`DELETE FROM cursos_sae ${whereClause}`, params);
  db.run(`DELETE FROM docentes ${whereClause}`, params);

  persistDb();

  return {
    cursosBorrados,
    docentesBorrados,
    asignacionesBorradas
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
  db.run("DELETE FROM salas_infraestructura");
  db.run("DELETE FROM establecimientos");

  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error clearing localStorage SQLite database:', e);
  }

  persistDb();
}
