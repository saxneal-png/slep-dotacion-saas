import initSqlJs, { Database } from 'sql.js';
import { getEmbeddedSqlWasm } from './sqlWasmBinary';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  MatrizExcelParseResult,
  ComparativaPeriodosResult,
  ResumenPeriodo
} from '../types';
import {
  TraspasoConfig,
  TraspasoResult,
  SchoolSummary,
  TeacherRecord,
  CourseLoadSummary,
  TeacherConsolidatedLoad
} from '../types/analizadorTypes';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';
import { calcularDiagnosticoColegio } from '../services/dotacionCalculationService';
import { homologarAsignaturaPorRegla } from '../services/analizador/homologationService';

let dbInstance: Database | null = null;
const STORAGE_KEY = 'slep_valle_diguillin_sqlite_db';

const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS establecimientos (
  id TEXT PRIMARY KEY,
  rbd TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  comuna TEXT NOT NULL,
  regimen TEXT NOT NULL,
  porcentaje_prioritarios REAL NOT NULL,
  director TEXT,
  asesor_uatp TEXT,
  telefono TEXT,
  email TEXT
);

CREATE TABLE IF NOT EXISTS salas_infraestructura (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  pabellon TEXT,
  nombre_sala TEXT NOT NULL,
  superficie_m2 REAL NOT NULL,
  tipo TEXT NOT NULL,
  aforo_maximo INTEGER NOT NULL,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS cursos_sae (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  nivel TEXT NOT NULL,
  letra TEXT NOT NULL,
  regimen TEXT NOT NULL,
  sala_id TEXT,
  cupo_sae INTEGER NOT NULL,
  matricula_proyectada INTEGER NOT NULL,
  alumnos_neet INTEGER NOT NULL DEFAULT 0,
  alumnos_neep INTEGER NOT NULL DEFAULT 0,
  talleres_jec_json TEXT,
  periodo INTEGER NOT NULL DEFAULT 2026,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS docentes (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  run TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  titulo TEXT,
  calidad_juridica TEXT NOT NULL,
  estamento TEXT NOT NULL,
  horas_contrato INTEGER NOT NULL,
  horas_subvencion_general_titular REAL DEFAULT 0,
  horas_subvencion_general_contrata REAL DEFAULT 0,
  horas_sep_titular REAL DEFAULT 0,
  horas_sep_contrata REAL DEFAULT 0,
  horas_pie_titular REAL DEFAULT 0,
  horas_pie_contrata REAL DEFAULT 0,
  horas_directivas INTEGER DEFAULT 0,
  horas_inspector_general REAL DEFAULT 0,
  horas_tecnico_pedagogica INTEGER DEFAULT 0,
  horas_coordinacion INTEGER DEFAULT 0,
  tipo_coordinacion TEXT,
  horas_taller_sep REAL DEFAULT 0,
  horas_trabajo_colaborativo REAL DEFAULT 0,
  horas_coordinacion_pie REAL DEFAULT 0,
  horas_convivencia_escolar REAL DEFAULT 0,
  horas_extraescolar REAL DEFAULT 0,
  cargo_institucional TEXT,
  horas_aula INTEGER DEFAULT 0,
  horas_ingles INTEGER DEFAULT 0,
  funcion_principal TEXT,
  funcion_secundaria TEXT,
  asignatura_principal TEXT,
  aplica_articulo_69 INTEGER DEFAULT 0,
  funciones_no_aula_json TEXT,
  periodo INTEGER NOT NULL DEFAULT 2026,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS asignaciones_horarias (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  curso_id TEXT NOT NULL,
  docente_id TEXT NOT NULL,
  co_docente_id TEXT,
  tiene_co_docente INTEGER DEFAULT 0,
  es_taller_jec INTEGER DEFAULT 0,
  asignatura TEXT NOT NULL,
  horas_pedagogicas_aula REAL NOT NULL,
  horas_cronologicas_pie REAL DEFAULT 0,
  horas_colaborativas REAL DEFAULT 0,
  tipo_apoyo TEXT,
  periodo INTEGER NOT NULL DEFAULT 2026,
  es_taller_sep INTEGER DEFAULT 0,
  es_trabajo_colaborativo INTEGER DEFAULT 0,
  es_proporcion_docente INTEGER DEFAULT 0,
  es_co_docencia INTEGER DEFAULT 0,
  es_agrupacion_flexible INTEGER DEFAULT 0,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd),
  FOREIGN KEY (curso_id) REFERENCES cursos_sae(id),
  FOREIGN KEY (docente_id) REFERENCES docentes(id)
);
`;

/**
 * Inicializa la base de datos SQLite embebida (100% offline, sin fetch network)
 */
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

  // Ejecutar migraciones / creación de tablas
  db.run(INIT_SCHEMA_SQL);

  // Asegurar columnas nuevas en tabla docentes si fue creada con versión previa
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_subvencion_general_titular REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_subvencion_general_contrata REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_sep_titular REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_sep_contrata REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_pie_titular REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_pie_contrata REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_directivas INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_inspector_general REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_tecnico_pedagogica INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_coordinacion INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN tipo_coordinacion TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_aula INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_ingles INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN funcion_principal TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN funcion_secundaria TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN talleres_jec_json TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN co_docente_id TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN tiene_co_docente INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN es_taller_jec INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN periodo INTEGER NOT NULL DEFAULT 2026;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN periodo INTEGER NOT NULL DEFAULT 2026;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN periodo INTEGER NOT NULL DEFAULT 2026;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN es_taller_sep INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN es_proporcion_docente INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN regimen_proporcion TEXT DEFAULT '65_35';");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_coordinacion_pie REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_convivencia_escolar REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_extraescolar REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN cargo_institucional TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN es_co_docencia INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN es_agrupacion_flexible INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE asignaciones_horarias ADD COLUMN es_trabajo_colaborativo INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_taller_sep REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN horas_trabajo_colaborativo REAL DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE docentes ADD COLUMN funciones_no_aula_json TEXT;");
  } catch (_) {}

  persistDb();
  return dbInstance;
}

let lastPersistTime: string = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
type PersistListener = (status: 'saved' | 'error', time: string, error?: string) => void;
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
  dbInstance.run(INIT_SCHEMA_SQL);
  persistDb();
}

// -----------------------------------------------------------------------------
// Operaciones CRUD para Asesores UATP
// -----------------------------------------------------------------------------

export async function listarEstablecimientos(): Promise<Establecimiento[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nombre, comuna, regimen, porcentaje_prioritarios, director, asesor_uatp, telefono, email FROM establecimientos ORDER BY nombre ASC");
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    nombre: String(row[2]),
    comuna: row[3] as any,
    regimen: row[4] as any,
    porcentajePrioritarios: Number(row[5]),
    director: row[6] ? String(row[6]) : undefined,
    asesorUatp: row[7] ? String(row[7]) : undefined,
    telefono: row[8] ? String(row[8]) : undefined,
    email: row[9] ? String(row[9]) : undefined,
  }));
}

export async function guardarEstablecimiento(e: Establecimiento): Promise<void> {
  const db = await getDb();
  const rbdNorm = e.rbd.trim();

  // Buscar por RBD o por ID para evitar violación de UNIQUE constraint
  const existing = db.exec("SELECT id FROM establecimientos WHERE rbd = ? OR id = ?", [rbdNorm, e.id]);
  if (existing.length && existing[0].values.length) {
    const existingId = String(existing[0].values[0][0]);
    db.run(`
      UPDATE establecimientos SET
        rbd=?, nombre=?, comuna=?, regimen=?, porcentaje_prioritarios=?,
        director=?, asesor_uatp=?, telefono=?, email=?
      WHERE id=?
    `, [
      rbdNorm, e.nombre.trim(), e.comuna, e.regimen, e.porcentajePrioritarios,
      e.director || null, e.asesorUatp || null, e.telefono || null, e.email || null,
      existingId
    ]);
  } else {
    db.run(`
      INSERT INTO establecimientos (id, rbd, nombre, comuna, regimen, porcentaje_prioritarios, director, asesor_uatp, telefono, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      e.id, rbdNorm, e.nombre.trim(), e.comuna, e.regimen, e.porcentajePrioritarios,
      e.director || null, e.asesorUatp || null, e.telefono || null, e.email || null
    ]);
  }
  persistDb();
}

export async function obtenerEstablecimientoPorRbd(rbd: string): Promise<Establecimiento | null> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nombre, comuna, regimen, porcentaje_prioritarios, director, asesor_uatp, telefono, email FROM establecimientos WHERE rbd = ?", [rbd]);
  if (!res.length || !res[0].values.length) return null;
  const row = res[0].values[0];
  return {
    id: String(row[0]),
    rbd: String(row[1]),
    nombre: String(row[2]),
    comuna: row[3] as any,
    regimen: row[4] as any,
    porcentajePrioritarios: Number(row[5]),
    director: row[6] ? String(row[6]) : undefined,
    asesorUatp: row[7] ? String(row[7]) : undefined,
    telefono: row[8] ? String(row[8]) : undefined,
    email: row[9] ? String(row[9]) : undefined
  };
}

export async function eliminarEstablecimiento(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM establecimientos WHERE id = ?", [id]);
  persistDb();
}

export async function listarSalas(rbd: string): Promise<SalaInfraestructura[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo FROM salas_infraestructura WHERE rbd = ?", [rbd]);
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    pabellon: row[2] ? String(row[2]) : undefined,
    nombreSala: String(row[3]),
    superficieM2: Number(row[4]),
    tipo: row[5] as any,
    aforoMaximo: Number(row[6])
  }));
}

export async function listarTodasLasSalas(): Promise<SalaInfraestructura[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo FROM salas_infraestructura");
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    pabellon: row[2] ? String(row[2]) : undefined,
    nombreSala: String(row[3]),
    superficieM2: Number(row[4]),
    tipo: row[5] as any,
    aforoMaximo: Number(row[6])
  }));
}

export async function guardarSala(s: SalaInfraestructura): Promise<void> {
  const db = await getDb();
  db.run(`
    INSERT INTO salas_infraestructura (id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      pabellon=excluded.pabellon, nombre_sala=excluded.nombre_sala,
      superficie_m2=excluded.superficie_m2, tipo=excluded.tipo, aforo_maximo=excluded.aforo_maximo;
  `, [s.id, s.rbd, s.pabellon || null, s.nombreSala, s.superficieM2, s.tipo, s.aforoMaximo]);
  persistDb();
}

export async function eliminarSala(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM salas_infraestructura WHERE id = ?", [id]);
  persistDb();
}

export async function listarCursos(rbd: string, periodo: number = 2026): Promise<CursoSae[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep, talleres_jec_json, periodo, regimen_proporcion FROM cursos_sae WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026)) ORDER BY nivel, letra", [rbd, periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    let talleresJec = undefined;
    if (row[10]) {
      try { talleresJec = JSON.parse(String(row[10])); } catch (_) {}
    }
    return {
      id: String(row[0]),
      rbd: String(row[1]),
      nivel: String(row[2]),
      letra: String(row[3]),
      regimen: row[4] as any,
      salaId: row[5] ? String(row[5]) : undefined,
      cupoSae: Number(row[6]),
      matriculaProyectada: Number(row[7]),
      alumnosNeet: Number(row[8]),
      alumnosNeep: Number(row[9]),
      talleresJec,
      periodo: row[11] ? Number(row[11]) : 2026,
      regimenProporcion: (row[12] as any) || '65_35',
    };
  });
}

export async function listarTodosLosCursos(periodo: number = 2026): Promise<CursoSae[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep, talleres_jec_json, periodo, regimen_proporcion FROM cursos_sae WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026)) ORDER BY rbd, nivel, letra", [periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    let talleresJec = undefined;
    if (row[10]) {
      try { talleresJec = JSON.parse(String(row[10])); } catch (_) {}
    }
    return {
      id: String(row[0]),
      rbd: String(row[1]),
      nivel: String(row[2]),
      letra: String(row[3]),
      regimen: row[4] as any,
      salaId: row[5] ? String(row[5]) : undefined,
      cupoSae: Number(row[6]),
      matriculaProyectada: Number(row[7]),
      alumnosNeet: Number(row[8]),
      alumnosNeep: Number(row[9]),
      talleresJec,
      periodo: row[11] ? Number(row[11]) : 2026,
      regimenProporcion: (row[12] as any) || '65_35',
    };
  });
}

export async function guardarCurso(c: CursoSae): Promise<void> {
  const db = await getDb();
  const talleresJson = c.talleresJec && c.talleresJec.length ? JSON.stringify(c.talleresJec) : null;
  const cursoPeriodo = c.periodo || 2026;
  const regProp = c.regimenProporcion || '65_35';
  db.run(`
    INSERT INTO cursos_sae (id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep, talleres_jec_json, periodo, regimen_proporcion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rbd=excluded.rbd, nivel=excluded.nivel, letra=excluded.letra, regimen=excluded.regimen,
      sala_id=excluded.sala_id, cupo_sae=excluded.cupo_sae,
      matricula_proyectada=excluded.matricula_proyectada,
      alumnos_neet=excluded.alumnos_neet, alumnos_neep=excluded.alumnos_neep,
      talleres_jec_json=excluded.talleres_jec_json,
      periodo=excluded.periodo,
      regimen_proporcion=excluded.regimen_proporcion;
  `, [c.id, c.rbd, c.nivel, c.letra, c.regimen, c.salaId || null, c.cupoSae, c.matriculaProyectada, c.alumnosNeet, c.alumnosNeep, talleresJson, cursoPeriodo, regProp]);
  persistDb();
}

export async function eliminarCurso(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM cursos_sae WHERE id = ?", [id]);
  persistDb();
}

export async function listarDocentes(rbd: string, periodo: number = 2026): Promise<Docente[]> {
  const db = await getDb();
  const res = db.exec(`
    SELECT id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
           horas_subvencion_general_titular, horas_subvencion_general_contrata,
           horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
           horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
           horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
           periodo, horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
           horas_taller_sep, horas_trabajo_colaborativo, funciones_no_aula_json
    FROM docentes WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026)) ORDER BY apellidos, nombres
  `, [rbd, periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    const horasContrato = Number(row[8]);
    const calJuridica = row[6] as any;
    let subvGenTitular = Number(row[9] || 0);
    let subvGenContrata = Number(row[10] || 0);
    let sepTitular = Number(row[11] || 0);
    let sepContrata = Number(row[12] || 0);
    let pieTitular = Number(row[13] || 0);
    let pieContrata = Number(row[14] || 0);

    // Si todas las fuentes están en 0 (registro previo), inferir por defecto según calidad jurídica
    const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
    if (sumaFuentes === 0 && horasContrato > 0) {
      if (calJuridica === 'TITULAR') {
        subvGenTitular = horasContrato;
      } else {
        subvGenContrata = horasContrato;
      }
    }

    let funcionesNoAula: any[] = [];
    if (row[33]) {
      try {
        funcionesNoAula = JSON.parse(String(row[33]));
      } catch (_) {}
    }

    return {
      id: String(row[0]),
      rbd: String(row[1]),
      run: String(row[2]),
      nombres: String(row[3]),
      apellidos: String(row[4]),
      titulo: row[5] ? String(row[5]) : undefined,
      calidadJuridica: calJuridica,
      estamento: row[7] as any,
      horasContrato,
      horasSubvencionGeneralTitular: subvGenTitular,
      horasSubvencionGeneralContrata: subvGenContrata,
      horasSepTitular: sepTitular,
      horasSepContrata: sepContrata,
      horasPieTitular: pieTitular,
      horasPieContrata: pieContrata,
      horasDirectivas: Number(row[15] || 0),
      horasInspectorGeneral: Number(row[16] || 0),
      horasTecnicoPedagogicas: Number(row[17] || 0),
      horasCoordinacion: Number(row[18] || 0),
      tipoCoordinacion: row[19] ? String(row[19]) : undefined,
      horasAula: Number(row[20] || 0),
      horasIngles: Number(row[21] || 0),
      funcionPrincipal: row[22] ? String(row[22]) : undefined,
      funcionSecundaria: row[23] ? String(row[23]) : undefined,
      asignaturaPrincipal: row[24] ? String(row[24]) : undefined,
      aplicaArticulo69: Boolean(row[25]),
      periodo: row[26] ? Number(row[26]) : 2026,
      horasCoordinacionPie: Number(row[27] || 0),
      horasConvivenciaEscolar: Number(row[28] || 0),
      horasExtraescolar: Number(row[29] || 0),
      cargoInstitucional: row[30] ? String(row[30]) : undefined,
      horasTallerSep: Number(row[31] || 0),
      horasTrabajoColaborativo: Number(row[32] || 0),
      funcionesNoAula: funcionesNoAula.length > 0 ? funcionesNoAula : undefined
    };
  });
}

export async function listarTodosLosDocentesTerritorio(periodo: number = 2026): Promise<Docente[]> {
  const db = await getDb();
  const res = db.exec(`
    SELECT id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
           horas_subvencion_general_titular, horas_subvencion_general_contrata,
           horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
           horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
           horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
           periodo, horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
           horas_taller_sep, horas_trabajo_colaborativo, funciones_no_aula_json
    FROM docentes
    WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026))
  `, [periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    const horasContrato = Number(row[8]);
    const calJuridica = row[6] as any;
    let subvGenTitular = Number(row[9] || 0);
    let subvGenContrata = Number(row[10] || 0);
    let sepTitular = Number(row[11] || 0);
    let sepContrata = Number(row[12] || 0);
    let pieTitular = Number(row[13] || 0);
    let pieContrata = Number(row[14] || 0);

    const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
    if (sumaFuentes === 0 && horasContrato > 0) {
      if (calJuridica === 'TITULAR') {
        subvGenTitular = horasContrato;
      } else {
        subvGenContrata = horasContrato;
      }
    }

    let funcionesNoAula: any[] = [];
    if (row[33]) {
      try {
        funcionesNoAula = JSON.parse(String(row[33]));
      } catch (_) {}
    }

    return {
      id: String(row[0]),
      rbd: String(row[1]),
      run: String(row[2]),
      nombres: String(row[3]),
      apellidos: String(row[4]),
      titulo: row[5] ? String(row[5]) : undefined,
      calidadJuridica: calJuridica,
      estamento: row[7] as any,
      horasContrato,
      horasSubvencionGeneralTitular: subvGenTitular,
      horasSubvencionGeneralContrata: subvGenContrata,
      horasSepTitular: sepTitular,
      horasSepContrata: sepContrata,
      horasPieTitular: pieTitular,
      horasPieContrata: pieContrata,
      horasDirectivas: Number(row[15] || 0),
      horasInspectorGeneral: Number(row[16] || 0),
      horasTecnicoPedagogicas: Number(row[17] || 0),
      horasCoordinacion: Number(row[18] || 0),
      tipoCoordinacion: row[19] ? String(row[19]) : undefined,
      horasAula: Number(row[20] || 0),
      horasIngles: Number(row[21] || 0),
      funcionPrincipal: row[22] ? String(row[22]) : undefined,
      funcionSecundaria: row[23] ? String(row[23]) : undefined,
      asignaturaPrincipal: row[24] ? String(row[24]) : undefined,
      aplicaArticulo69: Boolean(row[25]),
      periodo: row[26] ? Number(row[26]) : 2026,
      horasCoordinacionPie: Number(row[27] || 0),
      horasConvivenciaEscolar: Number(row[28] || 0),
      horasExtraescolar: Number(row[29] || 0),
      cargoInstitucional: row[30] ? String(row[30]) : undefined,
      horasTallerSep: Number(row[31] || 0),
      horasTrabajoColaborativo: Number(row[32] || 0),
      funcionesNoAula: funcionesNoAula.length > 0 ? funcionesNoAula : undefined
    };
  });
}

export async function guardarDocente(d: Docente): Promise<void> {
  const db = await getDb();
  const docPeriodo = d.periodo || 2026;
  const existing = db.exec("SELECT id FROM docentes WHERE ((rbd = ? AND run = ? AND (periodo = ? OR periodo IS NULL)) OR id = ?)", [d.rbd, d.run, docPeriodo, d.id]);
  const docId = (existing.length && existing[0].values.length) ? String(existing[0].values[0][0]) : d.id;

  let subvGenTitular = Number(d.horasSubvencionGeneralTitular || 0);
  let subvGenContrata = Number(d.horasSubvencionGeneralContrata || 0);
  let sepTitular = Number(d.horasSepTitular || 0);
  let sepContrata = Number(d.horasSepContrata || 0);
  let pieTitular = Number(d.horasPieTitular || 0);
  let pieContrata = Number(d.horasPieContrata || 0);

  const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
  if (sumaFuentes === 0 && d.horasContrato > 0) {
    if (d.calidadJuridica === 'TITULAR') {
      subvGenTitular = d.horasContrato;
    } else {
      subvGenContrata = d.horasContrato;
    }
  }

  const funcionesJson = d.funcionesNoAula && d.funcionesNoAula.length > 0 ? JSON.stringify(d.funcionesNoAula) : null;

  db.run(`
    INSERT INTO docentes (
      id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
      horas_subvencion_general_titular, horas_subvencion_general_contrata,
      horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
      horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
      horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
      horas_taller_sep, horas_trabajo_colaborativo,
      horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
      funciones_no_aula_json, periodo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rbd=excluded.rbd, run=excluded.run, nombres=excluded.nombres, apellidos=excluded.apellidos,
      titulo=excluded.titulo, calidad_juridica=excluded.calidad_juridica,
      estamento=excluded.estamento, horas_contrato=excluded.horas_contrato,
      horas_subvencion_general_titular=excluded.horas_subvencion_general_titular,
      horas_subvencion_general_contrata=excluded.horas_subvencion_general_contrata,
      horas_sep_titular=excluded.horas_sep_titular,
      horas_sep_contrata=excluded.horas_sep_contrata,
      horas_pie_titular=excluded.horas_pie_titular,
      horas_pie_contrata=excluded.horas_pie_contrata,
      horas_directivas=excluded.horas_directivas,
      horas_inspector_general=excluded.horas_inspector_general,
      horas_tecnico_pedagogica=excluded.horas_tecnico_pedagogica,
      horas_coordinacion=excluded.horas_coordinacion, tipo_coordinacion=excluded.tipo_coordinacion,
      horas_coordinacion_pie=excluded.horas_coordinacion_pie,
      horas_convivencia_escolar=excluded.horas_convivencia_escolar,
      horas_extraescolar=excluded.horas_extraescolar,
      cargo_institucional=excluded.cargo_institucional,
      horas_taller_sep=excluded.horas_taller_sep,
      horas_trabajo_colaborativo=excluded.horas_trabajo_colaborativo,
      horas_aula=excluded.horas_aula, horas_ingles=excluded.horas_ingles,
      funcion_principal=excluded.funcion_principal, funcion_secundaria=excluded.funcion_secundaria,
      asignatura_principal=excluded.asignatura_principal, aplica_articulo_69=excluded.aplica_articulo_69,
      funciones_no_aula_json=excluded.funciones_no_aula_json,
      periodo=excluded.periodo;
  `, [
    docId, d.rbd, d.run, d.nombres, d.apellidos, d.titulo || null, d.calidadJuridica, d.estamento, d.horasContrato,
    subvGenTitular, subvGenContrata, sepTitular, sepContrata, pieTitular, pieContrata,
    d.horasDirectivas || 0, d.horasInspectorGeneral || 0, d.horasTecnicoPedagogicas || 0, d.horasCoordinacion || 0, d.tipoCoordinacion || null,
    d.horasCoordinacionPie || 0, d.horasConvivenciaEscolar || 0, d.horasExtraescolar || 0, d.cargoInstitucional || null,
    d.horasTallerSep || 0, d.horasTrabajoColaborativo || 0,
    d.horasAula || 0, d.horasIngles || 0,
    d.funcionPrincipal || null, d.funcionSecundaria || null, d.asignaturaPrincipal || null, d.aplicaArticulo69 ? 1 : 0,
    funcionesJson, docPeriodo
  ]);
  persistDb();
}

export async function guardarDocentesBatch(docentes: Docente[]): Promise<number> {
  if (!docentes.length) return 0;
  const db = await getDb();
  db.run("BEGIN TRANSACTION;");
  try {
    for (const d of docentes) {
      const docPeriodo = d.periodo || 2026;
      const existing = db.exec("SELECT id FROM docentes WHERE ((rbd = ? AND run = ? AND (periodo = ? OR periodo IS NULL)) OR id = ?)", [d.rbd, d.run, docPeriodo, d.id]);
      const docId = (existing.length && existing[0].values.length) ? String(existing[0].values[0][0]) : d.id;

      let subvGenTitular = Number(d.horasSubvencionGeneralTitular || 0);
      let subvGenContrata = Number(d.horasSubvencionGeneralContrata || 0);
      let sepTitular = Number(d.horasSepTitular || 0);
      let sepContrata = Number(d.horasSepContrata || 0);
      let pieTitular = Number(d.horasPieTitular || 0);
      let pieContrata = Number(d.horasPieContrata || 0);

      const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
      if (sumaFuentes === 0 && d.horasContrato > 0) {
        if (d.calidadJuridica === 'TITULAR') {
          subvGenTitular = d.horasContrato;
        } else {
          subvGenContrata = d.horasContrato;
        }
      }

      const funcionesJson = d.funcionesNoAula && d.funcionesNoAula.length > 0 ? JSON.stringify(d.funcionesNoAula) : null;

      db.run(`
        INSERT INTO docentes (
          id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
          horas_subvencion_general_titular, horas_subvencion_general_contrata,
          horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
          horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
          horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
          horas_taller_sep, horas_trabajo_colaborativo,
          horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
          funciones_no_aula_json, periodo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          rbd=excluded.rbd, run=excluded.run, nombres=excluded.nombres, apellidos=excluded.apellidos,
          titulo=excluded.titulo, calidad_juridica=excluded.calidad_juridica,
          estamento=excluded.estamento, horas_contrato=excluded.horas_contrato,
          horas_subvencion_general_titular=excluded.horas_subvencion_general_titular,
          horas_subvencion_general_contrata=excluded.horas_subvencion_general_contrata,
          horas_sep_titular=excluded.horas_sep_titular,
          horas_sep_contrata=excluded.horas_sep_contrata,
          horas_pie_titular=excluded.horas_pie_titular,
          horas_pie_contrata=excluded.horas_pie_contrata,
          horas_directivas=excluded.horas_directivas,
          horas_inspector_general=excluded.horas_inspector_general,
          horas_tecnico_pedagogica=excluded.horas_tecnico_pedagogica,
          horas_coordinacion=excluded.horas_coordinacion, tipo_coordinacion=excluded.tipo_coordinacion,
          horas_coordinacion_pie=excluded.horas_coordinacion_pie,
          horas_convivencia_escolar=excluded.horas_convivencia_escolar,
          horas_extraescolar=excluded.horas_extraescolar,
          cargo_institucional=excluded.cargo_institucional,
          horas_taller_sep=excluded.horas_taller_sep,
          horas_trabajo_colaborativo=excluded.horas_trabajo_colaborativo,
          horas_aula=excluded.horas_aula, horas_ingles=excluded.horas_ingles,
          funcion_principal=excluded.funcion_principal, funcion_secundaria=excluded.funcion_secundaria,
          asignatura_principal=excluded.asignatura_principal, aplica_articulo_69=excluded.aplica_articulo_69,
          funciones_no_aula_json=excluded.funciones_no_aula_json,
          periodo=excluded.periodo;
      `, [
        docId, d.rbd, d.run, d.nombres, d.apellidos, d.titulo || null, d.calidadJuridica, d.estamento, d.horasContrato,
        subvGenTitular, subvGenContrata, sepTitular, sepContrata, pieTitular, pieContrata,
        d.horasDirectivas || 0, d.horasInspectorGeneral || 0, d.horasTecnicoPedagogicas || 0, d.horasCoordinacion || 0, d.tipoCoordinacion || null,
        d.horasCoordinacionPie || 0, d.horasConvivenciaEscolar || 0, d.horasExtraescolar || 0, d.cargoInstitucional || null,
        d.horasTallerSep || 0, d.horasTrabajoColaborativo || 0,
        d.horasAula || 0, d.horasIngles || 0,
        d.funcionPrincipal || null, d.funcionSecundaria || null, d.asignaturaPrincipal || null, d.aplicaArticulo69 ? 1 : 0,
        funcionesJson, docPeriodo
      ]);
    }
    db.run("COMMIT;");
  } catch (err) {
    db.run("ROLLBACK;");
    throw err;
  }
  persistDb();
  return docentes.length;
}

export async function eliminarDocente(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM docentes WHERE id = ?", [id]);
  persistDb();
}

export async function listarAsignaciones(rbd: string, periodo: number = 2026): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    cursoId: String(row[2]),
    docenteId: String(row[3]),
    coDocenteId: row[4] ? String(row[4]) : undefined,
    tieneCoDocente: Boolean(row[5]),
    esTallerJec: Boolean(row[6]),
    asignatura: String(row[7]),
    horasPedagogicasAula: Number(row[8]),
    horasCronologicasPie: row[9] ? Number(row[9]) : undefined,
    horasColaborativas: row[10] ? Number(row[10]) : undefined,
    tipoApoyo: row[11] ? String(row[11]) : undefined,
    periodo: row[12] ? Number(row[12]) : 2026,
    esTallerSep: Boolean(row[13]),
    esProporcionDocente: Boolean(row[14]),
    esCoDocencia: Boolean(row[15]),
    esAgrupacionFlexible: Boolean(row[16]),
    esTrabajoColaborativo: Boolean(row[17]),
  }));
}

export async function listarTodasLasAsignaciones(periodo: number = 2026): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo FROM asignaciones_horarias WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026))", [periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    cursoId: String(row[2]),
    docenteId: String(row[3]),
    coDocenteId: row[4] ? String(row[4]) : undefined,
    tieneCoDocente: Boolean(row[5]),
    esTallerJec: Boolean(row[6]),
    asignatura: String(row[7]),
    horasPedagogicasAula: Number(row[8]),
    horasCronologicasPie: row[9] ? Number(row[9]) : undefined,
    horasColaborativas: row[10] ? Number(row[10]) : undefined,
    tipoApoyo: row[11] ? String(row[11]) : undefined,
    periodo: row[12] ? Number(row[12]) : 2026,
    esTallerSep: Boolean(row[13]),
    esProporcionDocente: Boolean(row[14]),
    esCoDocencia: Boolean(row[15]),
    esAgrupacionFlexible: Boolean(row[16]),
    esTrabajoColaborativo: Boolean(row[17]),
  }));
}

export async function guardarAsignacion(a: AsignacionHoraria): Promise<void> {
  const db = await getDb();
  const asigPeriodo = a.periodo || 2026;
  db.run(`
    INSERT INTO asignaciones_horarias (
      id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec,
      asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo,
      periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rbd=excluded.rbd, curso_id=excluded.curso_id, docente_id=excluded.docente_id,
      co_docente_id=excluded.co_docente_id, tiene_co_docente=excluded.tiene_co_docente,
      es_taller_jec=excluded.es_taller_jec,
      asignatura=excluded.asignatura, horas_pedagogicas_aula=excluded.horas_pedagogicas_aula,
      horas_cronologicas_pie=excluded.horas_cronologicas_pie, horas_colaborativas=excluded.horas_colaborativas,
      tipo_apoyo=excluded.tipo_apoyo,
      periodo=excluded.periodo,
      es_taller_sep=excluded.es_taller_sep,
      es_proporcion_docente=excluded.es_proporcion_docente,
      es_co_docencia=excluded.es_co_docencia,
      es_agrupacion_flexible=excluded.es_agrupacion_flexible,
      es_trabajo_colaborativo=excluded.es_trabajo_colaborativo;
  `, [
    a.id, a.rbd, a.cursoId, a.docenteId, a.coDocenteId || null, a.tieneCoDocente ? 1 : 0, a.esTallerJec ? 1 : 0,
    a.asignatura, a.horasPedagogicasAula, a.horasCronologicasPie || 0, a.horasColaborativas || 0, a.tipoApoyo || null,
    asigPeriodo, a.esTallerSep ? 1 : 0, a.esProporcionDocente ? 1 : 0, a.esCoDocencia ? 1 : 0, a.esAgrupacionFlexible ? 1 : 0,
    a.esTrabajoColaborativo ? 1 : 0
  ]);
  persistDb();
}

export async function eliminarAsignacion(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM asignaciones_horarias WHERE id = ?", [id]);
  persistDb();
}

export async function exportarCarteraCompleta(asesorNombre: string, asesorEmail: string): Promise<any> {
  const establecimientos = await listarEstablecimientos();
  const db = await getDb();

  const salasRes = db.exec("SELECT id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo FROM salas_infraestructura");
  const salas: SalaInfraestructura[] = salasRes.length ? salasRes[0].values.map(r => ({
    id: String(r[0]), rbd: String(r[1]), pabellon: r[2] ? String(r[2]) : undefined,
    nombreSala: String(r[3]), superficieM2: Number(r[4]), tipo: r[5] as any, aforoMaximo: Number(r[6])
  })) : [];

  const cursosRes = db.exec("SELECT id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep FROM cursos_sae");
  const cursos: CursoSae[] = cursosRes.length ? cursosRes[0].values.map(r => ({
    id: String(r[0]), rbd: String(r[1]), nivel: String(r[2]), letra: String(r[3]),
    regimen: r[4] as any, salaId: r[5] ? String(r[5]) : undefined,
    cupoSae: Number(r[6]), matriculaProyectada: Number(r[7]), alumnosNeet: Number(r[8]), alumnosNeep: Number(r[9])
  })) : [];

  const docentes = await listarTodosLosDocentesTerritorio();
  const asignaciones = await listarTodasLasAsignaciones();

  return {
    version: '1.1.0',
    fechaExportacion: new Date().toISOString(),
    asesor: { nombre: asesorNombre, email: asesorEmail },
    establecimientos,
    salas,
    cursos,
    docentes,
    asignaciones
  };
}

export async function importarCartera(data: any): Promise<{ importados: number; errores: string[] }> {
  const errores: string[] = [];
  if (!data || !data.establecimientos) {
    throw new Error('Archivo de cartera inválido o corrupto.');
  }

  for (const est of data.establecimientos) {
    try {
      await guardarEstablecimiento(est);
    } catch (e: any) {
      errores.push(`Error en establecimiento ${est.rbd}: ${e.message}`);
    }
  }

  if (data.salas) {
    for (const sala of data.salas) {
      try {
        await guardarSala(sala);
      } catch (e: any) {
        errores.push(`Error en sala ${sala.nombreSala}: ${e.message}`);
      }
    }
  }

  if (data.cursos) {
    for (const curso of data.cursos) {
      try {
        await guardarCurso(curso);
      } catch (e: any) {
        errores.push(`Error en curso ${curso.nivel} ${curso.letra}: ${e.message}`);
      }
    }
  }

  if (data.docentes) {
    for (const doc of data.docentes) {
      try {
        await guardarDocente(doc);
      } catch (e: any) {
        errores.push(`Error en docente ${doc.run}: ${e.message}`);
      }
    }
  }

  if (data.asignaciones) {
    for (const asig of data.asignaciones) {
      try {
        await guardarAsignacion(asig);
      } catch (e: any) {
        errores.push(`Error en asignación: ${e.message}`);
      }
    }
  }

  return { importados: (data.establecimientos?.length || 0), errores };
}

const MAPA_PROMOCION_NIVELES: Record<string, string> = {
  'Pre-Kínder': 'Kínder',
  'NT1': 'NT2',
  'Kínder': '1° Básico',
  'NT2': '1° Básico',
  '1° Básico': '2° Básico',
  '2° Básico': '3° Básico',
  '3° Básico': '4° Básico',
  '4° Básico': '5° Básico',
  '5° Básico': '6° Básico',
  '6° Básico': '7° Básico',
  '7° Básico': '8° Básico',
  '8° Básico': '1° Medio',
  '1° Medio': '2° Medio',
  '2° Medio': '3° Medio',
  '3° Medio': '4° Medio'
};

export async function proyectarPeriodoColegio(
  rbd: string,
  periodoOrigen: number = 2026,
  periodoDestino: number = 2027,
  opciones: { promoverCursos?: boolean; replicarAsignaciones?: boolean } = { promoverCursos: true, replicarAsignaciones: true }
): Promise<{ cursosCreados: number; docentesCreados: number; asignacionesCreadas: number }> {
  const cursosOrigen = await listarCursos(rbd, periodoOrigen);
  const docentesOrigen = await listarDocentes(rbd, periodoOrigen);
  const asignacionesOrigen = await listarAsignaciones(rbd, periodoOrigen);

  const idCursoMap = new Map<string, string>();
  let cursosCreados = 0;

  let teniaPrekinder = false;
  for (const c of cursosOrigen) {
    if (c.nivel === 'Pre-Kínder' || c.nivel === 'NT1') {
      teniaPrekinder = true;
    }
  }

  for (const c of cursosOrigen) {
    let nuevoNivel = c.nivel;
    if (opciones.promoverCursos && MAPA_PROMOCION_NIVELES[c.nivel]) {
      nuevoNivel = MAPA_PROMOCION_NIVELES[c.nivel];
    }
    const nuevoId = `c_${rbd}_${periodoDestino}_${nuevoNivel}_${c.letra}`.replace(/[\s°]/g, '_');
    idCursoMap.set(c.id, nuevoId);

    const cursoProyectado: CursoSae = {
      ...c,
      id: nuevoId,
      periodo: periodoDestino,
      nivel: nuevoNivel
    };
    await guardarCurso(cursoProyectado);
    cursosCreados++;
  }

  if (opciones.promoverCursos && teniaPrekinder) {
    const pkOriginales = cursosOrigen.filter(c => c.nivel === 'Pre-Kínder' || c.nivel === 'NT1');
    for (const pk of pkOriginales) {
      const nuevoIdPk = `c_${rbd}_${periodoDestino}_Pre_Kinder_${pk.letra}`;
      const nuevoPk: CursoSae = {
        ...pk,
        id: nuevoIdPk,
        periodo: periodoDestino,
        nivel: 'Pre-Kínder'
      };
      await guardarCurso(nuevoPk);
      cursosCreados++;
    }
  }

  const idDocenteMap = new Map<string, string>();
  let docentesCreados = 0;

  for (const d of docentesOrigen) {
    const nuevoIdDoc = `doc_${rbd}_${periodoDestino}_${d.run}`;
    idDocenteMap.set(d.id, nuevoIdDoc);

    const docenteProyectado: Docente = {
      ...d,
      id: nuevoIdDoc,
      periodo: periodoDestino
    };
    await guardarDocente(docenteProyectado);
    docentesCreados++;
  }

  let asignacionesCreadas = 0;
  if (opciones.replicarAsignaciones) {
    for (const a of asignacionesOrigen) {
      const nuevoCursoId = idCursoMap.get(a.cursoId);
      const nuevoDocId = idDocenteMap.get(a.docenteId);
      if (nuevoCursoId && nuevoDocId) {
        const nuevaAsigId = `asig_${rbd}_${periodoDestino}_${nuevoCursoId}_${nuevoDocId}_${a.asignatura}`.replace(/[\s°]/g, '_');
        const asigProyectada: AsignacionHoraria = {
          ...a,
          id: nuevaAsigId,
          cursoId: nuevoCursoId,
          docenteId: nuevoDocId,
          periodo: periodoDestino
        };
        await guardarAsignacion(asigProyectada);
        asignacionesCreadas++;
      }
    }
  }

  return { cursosCreados, docentesCreados, asignacionesCreadas };
}

export async function getComparativaPeriodos(
  rbd: string,
  periodoA: number = 2026,
  periodoB: number = 2027
): Promise<ComparativaPeriodosResult> {
  const est = await obtenerEstablecimientoPorRbd(rbd);
  if (!est) throw new Error(`Establecimiento con RBD ${rbd} no encontrado.`);

  const salas = await listarSalas(rbd);

  const cursosA = await listarCursos(rbd, periodoA);
  const docentesA = await listarDocentes(rbd, periodoA);
  const asignacionesA = await listarAsignaciones(rbd, periodoA);
  const diagA = calcularDiagnosticoColegio(est, salas, cursosA, docentesA, asignacionesA);

  const cursosB = await listarCursos(rbd, periodoB);
  const docentesB = await listarDocentes(rbd, periodoB);
  const asignacionesB = await listarAsignaciones(rbd, periodoB);
  const diagB = calcularDiagnosticoColegio(est, salas, cursosB, docentesB, asignacionesB);

  const totalSubvGenA = docentesA.reduce((s, d) => s + (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0), 0);
  const totalSepA = docentesA.reduce((s, d) => s + (d.horasSepTitular || 0) + (d.horasSepContrata || 0), 0);
  const totalPieA = docentesA.reduce((s, d) => s + (d.horasPieTitular || 0) + (d.horasPieContrata || 0), 0);

  const totalSubvGenB = docentesB.reduce((s, d) => s + (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0), 0);
  const totalSepB = docentesB.reduce((s, d) => s + (d.horasSepTitular || 0) + (d.horasSepContrata || 0), 0);
  const totalPieB = docentesB.reduce((s, d) => s + (d.horasPieTitular || 0) + (d.horasPieContrata || 0), 0);

  const resumenA: ResumenPeriodo = {
    periodo: periodoA,
    totalCursos: cursosA.length,
    matriculaTotal: cursosA.reduce((s, c) => s + c.matriculaProyectada, 0),
    docentesTotal: docentesA.length,
    horasContratoTotal: docentesA.reduce((s, d) => s + d.horasContrato, 0),
    horasAulaDemandadas: diagA.balanzaGeneral.horasAulaDemandadasCurriculo,
    horasLectivasDisponibles: diagA.balanzaGeneral.horasLectivasDisponibles,
    horasAsignadas: diagA.balanzaGeneral.horasLectivasAsignadas,
    balanceLectivo: diagA.balanzaGeneral.superavitDeficitLectivo,
    subvencionGeneralTotal: totalSubvGenA,
    sepTotal: totalSepA,
    pieTotal: totalPieA
  };

  const resumenB: ResumenPeriodo = {
    periodo: periodoB,
    totalCursos: cursosB.length,
    matriculaTotal: cursosB.reduce((s, c) => s + c.matriculaProyectada, 0),
    docentesTotal: docentesB.length,
    horasContratoTotal: docentesB.reduce((s, d) => s + d.horasContrato, 0),
    horasAulaDemandadas: diagB.balanzaGeneral.horasAulaDemandadasCurriculo,
    horasLectivasDisponibles: diagB.balanzaGeneral.horasLectivasDisponibles,
    horasAsignadas: diagB.balanzaGeneral.horasLectivasAsignadas,
    balanceLectivo: diagB.balanzaGeneral.superavitDeficitLectivo,
    subvencionGeneralTotal: totalSubvGenB,
    sepTotal: totalSepB,
    pieTotal: totalPieB
  };

  const mapDocA = new Map<string, Docente>();
  for (const d of docentesA) mapDocA.set(d.run, d);

  const mapDocB = new Map<string, Docente>();
  for (const d of docentesB) mapDocB.set(d.run, d);

  const todosLosRuns = Array.from(new Set([...mapDocA.keys(), ...mapDocB.keys()]));
  const variacionesDocentes = todosLosRuns.map(run => {
    const dA = mapDocA.get(run);
    const dB = mapDocB.get(run);
    const nombre = (dB ? `${dB.nombres} ${dB.apellidos}` : (dA ? `${dA.nombres} ${dA.apellidos}` : 'Docente')).trim();
    const hA = dA ? dA.horasContrato : 0;
    const hB = dB ? dB.horasContrato : 0;
    const delta = hB - hA;

    let tipo: 'NUEVO_CONTRATO' | 'REDUCCION_HORAS' | 'AUMENTO_HORAS' | 'SIN_CAMBIO' | 'EGRESO' = 'SIN_CAMBIO';
    if (!dA && dB) tipo = 'NUEVO_CONTRATO';
    else if (dA && !dB) tipo = 'EGRESO';
    else if (delta > 0) tipo = 'AUMENTO_HORAS';
    else if (delta < 0) tipo = 'REDUCCION_HORAS';

    let cambioCalidad = undefined;
    if (dA && dB && dA.calidadJuridica !== dB.calidadJuridica) {
      cambioCalidad = `${dA.calidadJuridica} -> ${dB.calidadJuridica}`;
    }

    return {
      run,
      nombre,
      horasA: hA,
      horasB: hB,
      deltaHoras: delta,
      cambioCalidad,
      tipoVariacion: tipo
    };
  });

  return {
    rbd,
    establecimientoNombre: est.nombre,
    periodoA: resumenA,
    periodoB: resumenB,
    deltaMatricula: resumenB.matriculaTotal - resumenA.matriculaTotal,
    deltaCursos: resumenB.totalCursos - resumenA.totalCursos,
    deltaHorasContrato: resumenB.horasContratoTotal - resumenA.horasContratoTotal,
    deltaHorasAulaDemandadas: resumenB.horasAulaDemandadas - resumenA.horasAulaDemandadas,
    deltaBalanceLectivo: resumenB.balanceLectivo - resumenA.balanceLectivo,
    variacionesDocentes
  };
}

export async function guardarMatrizExcelEnDb(
  result: MatrizExcelParseResult,
  rbdDestino: string,
  periodoDestino: number = 2026
): Promise<{ cursosNuevos: number; docentesGuardados: number; asignacionesGuardadas: number }> {
  const cursosExistentes = await listarCursos(rbdDestino, periodoDestino);
  let cursosNuevos = 0;

  const cursoMap = new Map<string, CursoSae>();
  for (const c of cursosExistentes) {
    const key = `${c.nivel}_${c.letra}`.toUpperCase();
    cursoMap.set(key, c);
  }

  for (const cDet of result.cursos) {
    const key = `${cDet.nivel}_${cDet.letra}`.toUpperCase();
    if (!cursoMap.has(key)) {
      const nuevoCursoId = `curso_${rbdDestino}_${periodoDestino}_${cDet.nivel}_${cDet.letra}`.replace(/[\s°]/g, '_');
      const nuevoCurso: CursoSae = {
        id: nuevoCursoId,
        rbd: rbdDestino,
        periodo: periodoDestino,
        nivel: cDet.nivel,
        letra: cDet.letra,
        regimen: cDet.regimen,
        cupoSae: 35,
        matriculaProyectada: 30,
        alumnosNeet: 5,
        alumnosNeep: 2
      };
      await guardarCurso(nuevoCurso);
      cursoMap.set(key, nuevoCurso);
      cursosNuevos++;
    }
  }

  let docentesGuardados = 0;
  const docenteMap = new Map<string, Docente>();

  for (const d of result.docentes) {
    const calidadJuridica = (d.contrataSubGral > 0 || d.contrataSep > 0 || d.contrataPie > 0) &&
      (d.titularSubGral === 0 && d.titularSep === 0 && d.titularPie === 0) ? 'CONTRATA' : 'TITULAR';
    const estamento = (d.titularPie > 0 || d.contrataPie > 0) ? 'DOCENTE_DIFERENCIAL' : 'DOCENTE_AULA';
    const totalHorasAula = d.totalHa || d.asignaciones.reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const docObj: Docente = {
      id: `doc_${rbdDestino}_${periodoDestino}_${d.run}`,
      rbd: rbdDestino,
      periodo: periodoDestino,
      run: d.run,
      nombres: d.nombres,
      apellidos: d.apellidos,
      calidadJuridica,
      estamento,
      horasContrato: d.horasContrato,
      horasSubvencionGeneralTitular: d.titularSubGral,
      horasSubvencionGeneralContrata: d.contrataSubGral,
      horasSepTitular: d.titularSep,
      horasSepContrata: d.contrataSep,
      horasPieTitular: d.titularPie,
      horasPieContrata: d.contrataPie,
      horasAula: totalHorasAula
    };

    await guardarDocente(docObj);
    docenteMap.set(d.run, docObj);
    docentesGuardados++;
  }

  let asignacionesGuardadas = 0;
  for (const d of result.docentes) {
    const doc = docenteMap.get(d.run);
    if (!doc) continue;

    for (const a of d.asignaciones) {
      const key = `${a.nivelCurso}_${a.letraCurso}`.toUpperCase();
      const curso = cursoMap.get(key);
      if (!curso) continue;

      const asigId = `asig_${rbdDestino}_${periodoDestino}_${d.run}_${curso.id}_${a.asignatura}`.replace(/[\s°]/g, '_');
      const asigObj: AsignacionHoraria = {
        id: asigId,
        rbd: rbdDestino,
        periodo: periodoDestino,
        cursoId: curso.id,
        docenteId: doc.id,
        asignatura: a.asignatura,
        horasPedagogicasAula: a.horasPedagogicasAula,
        esTallerJec: a.esTallerJec
      };
      await guardarAsignacion(asigObj);
      asignacionesGuardadas++;
    }
  }

  return { cursosNuevos, docentesGuardados, asignacionesGuardadas };
}

/**
 * Traspasa y alimenta la dotación oficial (ej. Periodo 2026) desde los datos procesados en el Analizador & IA,
 * aplicando la homologación de asignaturas MINEDUC y manejando descuadres y reemplazo limpio.
 */
export async function ejecutarTraspasoDotacionAnalizador(
  config: TraspasoConfig,
  data: {
    schools: SchoolSummary[];
    teachers: TeacherRecord[];
    courses: CourseLoadSummary[];
    teacherLoads: TeacherConsolidatedLoad[];
  }
): Promise<TraspasoResult> {
  const db = await getDb();
  const periodo = config.periodo || 2026;
  const alertas: string[] = [];
  const targetRbds = new Set(config.colegiosRbd);
  const targetOverride = config.targetRbdOverride?.trim();

  const filteredSchools = data.schools.filter(s => targetRbds.has(s.rbd));
  const filteredCourses = data.courses.filter(c => targetRbds.has(c.rbd));
  const filteredTeacherLoads = data.teacherLoads.filter(tl => targetRbds.has(tl.rbd));

  let cursosCreados = 0;
  let docentesGuardados = 0;
  let asignacionesGuardadas = 0;

  // 1. Si el modo es REEMPLAZAR, eliminar registros previos de estos colegios en el periodo destino
  if (config.modo === 'REEMPLAZAR') {
    const rbdsToClean = targetOverride ? new Set([targetOverride, ...targetRbds]) : targetRbds;
    for (const rbd of rbdsToClean) {
      db.run("DELETE FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
      db.run("DELETE FROM cursos_sae WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
      db.run("DELETE FROM docentes WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
    }
  }

  // 2. Asegurar que el o los establecimientos existan en la tabla establecimientos
  if (targetOverride) {
    const res = db.exec("SELECT id FROM establecimientos WHERE rbd = ?", [targetOverride]);
    if (!res.length || !res[0].values.length) {
      const catalogSchool = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === targetOverride);
      const fallbackSchool = filteredSchools[0];
      await guardarEstablecimiento({
        id: `est-${targetOverride}`,
        rbd: targetOverride,
        nombre: catalogSchool ? catalogSchool.nombre : (fallbackSchool?.establishment || `Establecimiento RBD ${targetOverride}`),
        comuna: (catalogSchool?.comuna as any) || (fallbackSchool?.comuna as any) || 'Chillán',
        regimen: 'JEC',
        porcentajePrioritarios: 75,
      });
    }
  } else {
    for (const s of filteredSchools) {
      const res = db.exec("SELECT id FROM establecimientos WHERE rbd = ?", [s.rbd]);
      if (!res.length || !res[0].values.length) {
        const catalogSchool = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(cs => cs.rbd === s.rbd);
        await guardarEstablecimiento({
          id: `est-${s.rbd}`,
          rbd: s.rbd,
          nombre: catalogSchool?.nombre || s.establishment,
          comuna: (catalogSchool?.comuna as any) || (s.comuna as any) || 'Chillán',
          regimen: 'JEC',
          porcentajePrioritarios: 75,
        });
      }
    }
  }

  // 3. Crear / mapear Cursos
  const cursoMap = new Map<string, CursoSae>();
  for (const sc of filteredCourses) {
    const effectiveRbd = targetOverride || sc.rbd;
    const key = `${effectiveRbd}_${sc.nivel}_${sc.letra}`.toUpperCase();
    if (!cursoMap.has(key)) {
      const cursoId = `curso_${effectiveRbd}_${periodo}_${sc.nivel}_${sc.letra}`.replace(/[\s°]/g, '_');
      const schoolInfo = filteredSchools.find(s => s.rbd === sc.rbd);
      const estMatricula = schoolInfo ? schoolInfo.matricula : 0;
      const schoolCoursesCount = filteredCourses.filter(c => c.rbd === sc.rbd).length;
      const matProy = Math.round(estMatricula / Math.max(1, schoolCoursesCount)) || 30;

      // Evaluar si tiene configuración explícita de JEC y Régimen Proporción Docente
      const customJec =
        config.cursosJecMap?.[sc.curso] ||
        config.cursosJecMap?.[`${sc.nivel} ${sc.letra}`] ||
        config.cursosJecMap?.[`${sc.nivel}_${sc.letra}`] ||
        config.cursosJecMap?.[sc.nivel];

      const defaultJec = (sc.nivel.toLowerCase().includes('parv') || sc.nivel.toLowerCase().includes('nt')) ? 'No JEC' : 'JEC';
      const effectiveJec = customJec || defaultJec;

      const isPrimerCicloOrParv =
        sc.nivel.toLowerCase().includes('parv') ||
        sc.nivel.toLowerCase().includes('nt') ||
        /^[1-4][°\.\s]?[bB]/.test(sc.nivel) ||
        sc.nivel.includes('1°') || sc.nivel.includes('2°') || sc.nivel.includes('3°') || sc.nivel.includes('4°');

      const customProp =
        config.cursosProporcionMap?.[sc.curso] ||
        config.cursosProporcionMap?.[`${sc.nivel} ${sc.letra}`] ||
        config.cursosProporcionMap?.[`${sc.nivel}_${sc.letra}`] ||
        config.cursosProporcionMap?.[sc.nivel];

      const effectiveProp = customProp || (isPrimerCicloOrParv ? '65_35' : undefined);

      const cursoObj: CursoSae = {
        id: cursoId,
        rbd: effectiveRbd,
        periodo,
        nivel: sc.nivel,
        letra: sc.letra || 'A',
        regimen: effectiveJec,
        regimenProporcion: effectiveProp,
        cupoSae: 35,
        matriculaProyectada: matProy,
        alumnosNeet: 5,
        alumnosNeep: 2,
      };
      await guardarCurso(cursoObj);
      cursoMap.set(key, cursoObj);
      cursoMap.set(`${effectiveRbd}_${sc.curso}`.toUpperCase(), cursoObj);
      cursosCreados++;
    }
  }

  // 4. Crear / mapear Docentes
  const docenteMap = new Map<string, Docente>();
  for (const tl of filteredTeacherLoads) {
    const effectiveRbd = targetOverride || tl.rbd;
    const cleanRun = (tl.rut || '').trim().replace(/[^0-9kK]/g, '') || `TEMP_${tl.teacher_name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10)}`;
    const key = `${effectiveRbd}_${cleanRun}`;

    if (tl.is_over_legal_limit || tl.horas_contrato > 44) {
      alertas.push(`Docente ${tl.teacher_name} (${tl.rut || 'S/RUN'}) excede las 44 horas semanales (${tl.horas_contrato} hrs).`);
    }

    const docId = `doc_${effectiveRbd}_${periodo}_${cleanRun}`;
    const nombres = tl.teacher_name.split(',')[1]?.trim() || tl.teacher_name.split(' ')[0] || 'Docente';
    const apellidos = tl.teacher_name.split(',')[0]?.trim() || tl.teacher_name.split(' ').slice(1).join(' ') || '';

    let horasDirectivasDeCursos = 0;
    let horasTecnicasDeCursos = 0;
    let horasCoordinacionAcum = 0;
    let horasCoordinacionPieAcum = 0;
    let horasConvivenciaAcum = 0;
    let horasExtraescolarAcum = 0;
    let cargoInstitucionalDetectado: string | undefined = undefined;
    let tipoCoordinacionDeterminado: string | undefined = undefined;

    interface AsignacionValida {
      cursoStr: string;
      rawSub: string;
      asigOficial: string;
      horas: number;
      esCoDocencia: boolean;
      esAgrupacionFlexible: boolean;
      esTallerSep: boolean;
      esTallerJec: boolean;
    }
    const asignacionesAProcesar: AsignacionValida[] = [];

    // Inspeccionar las asignaciones del docente y separar horas institucionales vs lectivas de aula
    for (const asig of tl.cursos) {
      const cursoStr = asig.curso || 'Aula Regular';
      const rawSub = (asig.asignatura || 'Docencia de Aula General').trim();
      const homologKey = `${rawSub}__${cursoStr}`;
      const asigOficial = config.homologaciones[homologKey] ||
                          config.homologaciones[rawSub] ||
                          rawSub;

      // Evaluar heurística normativa MINEDUC
      const infoNorm = homologarAsignaturaPorRegla(rawSub, cursoStr);
      const infoOficial = homologarAsignaturaPorRegla(asigOficial, cursoStr);

      const isDirectivo = Boolean(infoNorm.esDirectivo || infoOficial.esDirectivo || /director|subdirector|inspector.*general|profesor.*encargado|docente.*encargado/i.test(asigOficial) || /director|subdirector|inspector.*general|profesor.*encargado|docente.*encargado/i.test(rawSub));
      const isTecnico = Boolean(infoNorm.esTecnicoPedagogico || infoOficial.esTecnicoPedagogico || /jefe.*utp|jefatura.*utp|\butp\b|tecnico.*pedag|\bcurricul|evaluador/i.test(asigOficial) || /jefe.*utp|jefatura.*utp|\butp\b|tecnico.*pedag|\bcurricul|evaluador/i.test(rawSub));
      const isCoordPie = Boolean(infoNorm.esCoordinacionPie || infoOficial.esCoordinacionPie || /coordinad.*pie|coordinacion.*pie/i.test(asigOficial) || /coordinad.*pie|coordinacion.*pie/i.test(rawSub));
      const isConvivencia = Boolean(infoNorm.esConvivencia || infoOficial.esConvivencia || /convivencia|cra\b|enlaces/i.test(asigOficial) || /convivencia|cra\b|enlaces/i.test(rawSub));
      const isExtraescolar = Boolean(infoNorm.esExtraescolar || infoOficial.esExtraescolar || /extraescolar|\bacle\b/i.test(asigOficial) || /extraescolar|\bacle\b/i.test(rawSub));

      const isProporcionDocente = Boolean(
        infoNorm.esProporcionDocente || infoOficial.esProporcionDocente ||
        asigOficial.toLowerCase().includes('proporci') ||
        asigOficial.toLowerCase().includes('recreo') ||
        asigOficial.toLowerCase().includes('no lectiv') ||
        asigOficial.toLowerCase().includes('h.l.') ||
        /\bhl\b/i.test(asigOficial) ||
        /\brecreo\b/i.test(rawSub) ||
        /\bhl\b/i.test(rawSub)
      );

      // Si es Directivo institucional -> sumar a horas directivas y no registrar en asignaciones curriculares del curso
      if (isDirectivo) {
        horasDirectivasDeCursos += asig.horas;
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Técnico-Pedagógico institucional -> sumar a horas técnicas y no registrar en asignaciones curriculares
      if (isTecnico) {
        horasTecnicasDeCursos += asig.horas;
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Coordinación PIE -> sumar a horas de coordinación y no registrar en asignaciones curriculares del curso
      if (isCoordPie) {
        horasCoordinacionAcum += asig.horas;
        horasCoordinacionPieAcum += asig.horas;
        tipoCoordinacionDeterminado = 'PIE';
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Convivencia Escolar / CRA -> sumar a horas de coordinación y no registrar en asignaciones curriculares
      if (isConvivencia) {
        horasCoordinacionAcum += asig.horas;
        horasConvivenciaAcum += asig.horas;
        if (!tipoCoordinacionDeterminado) tipoCoordinacionDeterminado = 'CONVIVENCIA';
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Extraescolar / ACLE -> sumar a horas de coordinación y no registrar en asignaciones curriculares
      if (isExtraescolar) {
        horasCoordinacionAcum += asig.horas;
        horasExtraescolarAcum += asig.horas;
        if (!tipoCoordinacionDeterminado) tipoCoordinacionDeterminado = 'EXTRAESCOLAR';
        if (!cargoInstitucionalDetectado) cargoInstitucionalDetectado = asigOficial;
        continue;
      }

      // Si es Recreo o Proporción Docente (65/35 o 60/40) -> omitir de la carga lectiva curricular
      if (isProporcionDocente) {
        continue;
      }

      // Apoyos pedagógicos en aula: Co-Docencia y Agrupaciones Flexibles
      const esCoDocencia = Boolean(infoNorm.esCoDocencia || infoOficial.esCoDocencia || /co.*docenc|codocenc|docenc.*compartida/i.test(asigOficial) || /co.*docenc|codocenc/i.test(rawSub));
      const esAgrupacionFlexible = Boolean(infoNorm.esAgrupacionFlexible || infoOficial.esAgrupacionFlexible || /agrupaci[oó]n.*flexible|grupo.*flexible|refuerzo.*pedag/i.test(asigOficial) || /agrupaci[oó]n.*flexible/i.test(rawSub));

      // Talleres SEP y JEC
      const esTallerSep = Boolean(infoNorm.esTallerSep || infoOficial.esTallerSep || asigOficial === 'Taller Extracurricular SEP' || /taller.*sep|refuerzo.*sep|extraesc.*sep|\bsep\b/i.test(asigOficial) || /taller.*sep|refuerzo.*sep|extraesc.*sep|\bsep\b/i.test(rawSub));
      const esTallerJec = esTallerSep || Boolean(infoNorm.esTallerJec || infoOficial.esTallerJec || /taller|aele|reforz/i.test(asigOficial));

      asignacionesAProcesar.push({
        cursoStr,
        rawSub,
        asigOficial,
        horas: asig.horas,
        esCoDocencia,
        esAgrupacionFlexible,
        esTallerSep,
        esTallerJec,
      });
    }

    const horasDirectivasFinal = Math.max(Number(tl.horas_directivas || 0), horasDirectivasDeCursos);
    const horasTecnicasFinal = Math.max(Number(tl.horas_tecnicas || 0), horasTecnicasDeCursos);
    let estamentoDeterminado: any = 'DOCENTE_AULA';
    if (horasDirectivasFinal > 0) {
      estamentoDeterminado = 'DIRECTIVO';
    } else if (horasTecnicasFinal > 0) {
      estamentoDeterminado = 'TECNICO_PEDAGOGICO';
    }

    const docObj: Docente = {
      id: docId,
      rbd: effectiveRbd,
      periodo,
      run: tl.rut || cleanRun,
      nombres,
      apellidos,
      calidadJuridica: 'TITULAR',
      estamento: estamentoDeterminado,
      horasContrato: tl.horas_contrato,
      horasAula: tl.horas_aula,
      horasDirectivas: horasDirectivasFinal,
      horasTecnicoPedagogicas: horasTecnicasFinal,
      horasCoordinacion: horasCoordinacionAcum,
      tipoCoordinacion: tipoCoordinacionDeterminado,
      horasCoordinacionPie: horasCoordinacionPieAcum,
      horasConvivenciaEscolar: horasConvivenciaAcum,
      horasExtraescolar: horasExtraescolarAcum,
      cargoInstitucional: cargoInstitucionalDetectado,
      horasSubvencionGeneralTitular: tl.horas_contrato,
    };

    await guardarDocente(docObj);
    docenteMap.set(key, docObj);
    docentesGuardados++;

    // 5. Crear Asignaciones Horarias con la asignatura oficial homologada
    let asigIndex = 0;
    for (const asig of asignacionesAProcesar) {
      asigIndex++;
      const cursoStr = asig.cursoStr;
      const cursoKey = `${effectiveRbd}_${cursoStr}`.toUpperCase();
      let curso = cursoMap.get(cursoKey);

      if (!curso) {
        for (const [k, c] of cursoMap.entries()) {
          if (k.startsWith(`${effectiveRbd}_`.toUpperCase()) && (cursoStr.toUpperCase().includes(c.nivel.toUpperCase()) || c.nivel.toUpperCase().includes(cursoStr.toUpperCase()))) {
            curso = c;
            break;
          }
        }
      }

      if (!curso) {
        const anySchoolCourse = Array.from(cursoMap.values()).find(c => c.rbd === effectiveRbd);
        if (anySchoolCourse) {
          curso = anySchoolCourse;
        } else {
          const defaultCursoId = `curso_${effectiveRbd}_${periodo}_1_Basico_A`;
          curso = {
            id: defaultCursoId,
            rbd: effectiveRbd,
            periodo,
            nivel: '1° Básico',
            letra: 'A',
            regimen: 'JEC',
            cupoSae: 35,
            matriculaProyectada: 30,
            alumnosNeet: 5,
            alumnosNeep: 2,
          };
          await guardarCurso(curso);
          cursoMap.set(`${effectiveRbd}_1° BÁSICO_A`.toUpperCase(), curso);
          cursosCreados++;
        }
      }

      const asigId = `asig_${effectiveRbd}_${periodo}_${cleanRun}_${curso.id}_${asigIndex}`;

      const asigObj: AsignacionHoraria = {
        id: asigId,
        rbd: effectiveRbd,
        periodo,
        cursoId: curso.id,
        docenteId: docObj.id,
        asignatura: asig.asigOficial,
        horasPedagogicasAula: asig.horas,
        esTallerJec: asig.esTallerJec,
        esTallerSep: asig.esTallerSep,
        esProporcionDocente: false,
        tieneCoDocente: asig.esCoDocencia,
        esCoDocencia: asig.esCoDocencia,
        esAgrupacionFlexible: asig.esAgrupacionFlexible,
      };

      await guardarAsignacion(asigObj);
      asignacionesGuardadas++;
    }
  }

  persistDb();

  return {
    colegiosProcesados: targetOverride ? 1 : targetRbds.size,
    cursosCreados,
    docentesGuardados,
    asignacionesGuardadas,
    alertas,
  };
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



