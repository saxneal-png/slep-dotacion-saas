import { Database } from 'sql.js';
import { poblarPlanesEstudioEnDb } from './repositories/planesEstudioRepo';

export const INIT_SCHEMA_SQL = `
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
  regimen_proporcion TEXT DEFAULT '65_35',
  es_multigrado INTEGER DEFAULT 0,
  es_combinado INTEGER DEFAULT 0,
  tipo_modalidad TEXT DEFAULT 'REGULAR',
  grados_combinados_json TEXT,
  especialidad_tp TEXT,
  plan_estudio_id TEXT,
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

CREATE TABLE IF NOT EXISTS planes_estudio_mineduc (
  id TEXT PRIMARY KEY,
  nivel TEXT NOT NULL,
  regimen TEXT NOT NULL,
  categoria TEXT,
  referencia_fuente TEXT,
  horas_obligatorias REAL NOT NULL,
  horas_libre_disposicion REAL NOT NULL,
  total_horas_plan REAL NOT NULL,
  asignaturas_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auditoria_cambios (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2026,
  tipo_evento TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT,
  descripcion TEXT NOT NULL,
  detalles_json TEXT,
  fecha_hora TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS asistentes_educacion (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2026,
  run TEXT NOT NULL,
  nombres TEXT NOT NULL,
  apellidos TEXT NOT NULL,
  cargo_funcion TEXT NOT NULL,
  estamento TEXT NOT NULL,
  horas_contrato REAL NOT NULL,
  horas_subvencion_general_indefinido REAL DEFAULT 0,
  horas_subvencion_general_plazo_fijo REAL DEFAULT 0,
  horas_sep_indefinido REAL DEFAULT 0,
  horas_sep_plazo_fijo REAL DEFAULT 0,
  horas_pie_indefinido REAL DEFAULT 0,
  horas_pie_plazo_fijo REAL DEFAULT 0,
  es_dupla_psicosocial INTEGER DEFAULT 0,
  es_equipo_pie INTEGER DEFAULT 0,
  es_tecnico_parvulo INTEGER DEFAULT 0,
  es_auxiliar_servicio INTEGER DEFAULT 0,
  es_inspector_patio INTEGER DEFAULT 0,
  observaciones TEXT,
  activo INTEGER DEFAULT 1,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);
`;

export function runMigrations(db: Database): void {
  db.run(INIT_SCHEMA_SQL);

  // Poblar y sincronizar planes de estudio oficiales MINEDUC (incluyendo especialidades TP)
  try {
    poblarPlanesEstudioEnDb(db);
  } catch (e) {
    console.warn('Error al sincronizar planes de estudio en SQLite:', e);
  }

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
    db.run("ALTER TABLE cursos_sae ADD COLUMN es_multigrado INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN es_combinado INTEGER DEFAULT 0;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN tipo_modalidad TEXT DEFAULT 'REGULAR';");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN grados_combinados_json TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN especialidad_tp TEXT;");
  } catch (_) {}
  try {
    db.run("ALTER TABLE cursos_sae ADD COLUMN plan_estudio_id TEXT;");
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

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_cursos_rbd_periodo ON cursos_sae(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_docentes_rbd_periodo ON docentes(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asignaciones_rbd_periodo ON asignaciones_horarias(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asignaciones_curso ON asignaciones_horarias(curso_id);',
    'CREATE INDEX IF NOT EXISTS idx_asignaciones_docente ON asignaciones_horarias(docente_id);',
    'CREATE INDEX IF NOT EXISTS idx_salas_rbd ON salas_infraestructura(rbd);',
    'CREATE INDEX IF NOT EXISTS idx_planes_estudio ON planes_estudio_mineduc(nivel, regimen);',
    'CREATE INDEX IF NOT EXISTS idx_auditoria_rbd_periodo ON auditoria_cambios(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asistentes_rbd_periodo ON asistentes_educacion(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asistentes_run ON asistentes_educacion(run);',
    'CREATE INDEX IF NOT EXISTS idx_asistentes_estamento ON asistentes_educacion(estamento);'
  ];

  for (const idxSql of indexes) {
    try { db.run(idxSql); } catch (e) { console.warn('Error idx:', e); }
  }
}