import { Database } from 'sql.js';
import { poblarPlanesEstudioEnDb } from './repositories/planesEstudioRepo';

export const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS establecimientos (
  id TEXT PRIMARY KEY,
  rbd TEXT UNIQUE NOT NULL,
  nombre TEXT NOT NULL,
  comuna TEXT NOT NULL,
  tipo TEXT DEFAULT 'ESCUELA',
  tipo_perfil TEXT DEFAULT 'ESCUELA_BASICA',
  modalidades_autorizadas_json TEXT,
  codigo_junji TEXT,
  nombre_fantasia TEXT,
  localidad TEXT,
  direccion TEXT,
  horario_apertura TEXT,
  horario_cierre TEXT,
  horario_extension_inicio TEXT,
  horario_extension_cierre TEXT,
  regimen TEXT NOT NULL,
  porcentaje_prioritarios REAL NOT NULL,
  director TEXT,
  asesor_uatp TEXT,
  telefono TEXT,
  email TEXT,
  subvencion_sep_mensual REAL DEFAULT 0,
  subvencion_pro_retencion REAL DEFAULT 0,
  cupo_horas_pie_diferencial REAL DEFAULT 0,
  cupo_horas_pie_asistentes REAL DEFAULT 0,
  accesibilidad TEXT DEFAULT 'urbano',
  condiciones_dificiles_pct REAL DEFAULT 0
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
  periodo INTEGER NOT NULL DEFAULT 2027,
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
  requiere_autorizacion_docente INTEGER DEFAULT 0,
  funciones_no_aula_json TEXT,
  horas_vigentes_anterior REAL DEFAULT 0,
  propuesta_gdp TEXT DEFAULT 'Continuidad',
  remuneracion_mensual_app REAL DEFAULT 0,
  fecha_inicio_contrato TEXT DEFAULT '01-03-2026',
  fecha_termino_contrato TEXT DEFAULT '28-02-2027',
  accion_pme_sep TEXT,
  horas_pro_retencion REAL DEFAULT 0,
  descripcion_funcion_gdp TEXT,
  estado_sancion_gdp TEXT DEFAULT 'Pendiente',
  horas_aprobadas_gdp REAL DEFAULT 0,
  situacion_final_gdp TEXT DEFAULT 'Vigente',
  observaciones_director TEXT,
  observaciones_slep TEXT,
  periodo INTEGER NOT NULL DEFAULT 2027,
  es_vacante_nn INTEGER DEFAULT 0,
  tipo_vacante TEXT,
  justificacion_vacante TEXT,
  origen_egreso_id TEXT,
  vacante_condicional INTEGER DEFAULT 0,
  tramo_carrera_docente TEXT,
  habilitacion_seremi_rbd TEXT,
  habilitacion_seremi_asignatura TEXT,
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
  periodo INTEGER NOT NULL DEFAULT 2027,
  es_taller_sep INTEGER DEFAULT 0,
  es_trabajo_colaborativo INTEGER DEFAULT 0,
  es_proporcion_docente INTEGER DEFAULT 0,
  es_co_docencia INTEGER DEFAULT 0,
  es_agrupacion_flexible INTEGER DEFAULT 0,
  cursos_compartidos_json TEXT,
  es_diferenciado_compartido INTEGER DEFAULT 0,
  codigo_asignatura TEXT,
  ambito_curricular TEXT,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
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

CREATE TABLE IF NOT EXISTS planes_estudio_colegio (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  nivel TEXT NOT NULL,
  regimen TEXT NOT NULL,
  categoria TEXT,
  referencia_fuente TEXT,
  horas_obligatorias REAL NOT NULL DEFAULT 0,
  horas_libre_disposicion REAL NOT NULL DEFAULT 0,
  total_horas_plan REAL NOT NULL DEFAULT 0,
  asignaturas_json TEXT NOT NULL,
  actualizado_en TEXT,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS auditoria_cambios (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2027,
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
  periodo INTEGER NOT NULL DEFAULT 2027,
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
  horas_honorarios REAL DEFAULT 0,
  es_dupla_psicosocial INTEGER DEFAULT 0,
  es_equipo_pie INTEGER DEFAULT 0,
  es_tecnico_parvulo INTEGER DEFAULT 0,
  es_auxiliar_servicio INTEGER DEFAULT 0,
  es_inspector_patio INTEGER DEFAULT 0,
  observaciones TEXT,
  activo INTEGER DEFAULT 1,
  horas_vigentes_anterior REAL DEFAULT 0,
  propuesta_gdp TEXT DEFAULT 'Continuidad',
  remuneracion_mensual_app REAL DEFAULT 0,
  fecha_inicio_contrato TEXT DEFAULT '01-03-2026',
  fecha_termino_contrato TEXT DEFAULT '28-02-2027',
  accion_pme_sep TEXT,
  horas_pro_retencion REAL DEFAULT 0,
  descripcion_funcion_gdp TEXT,
  estado_sancion_gdp TEXT DEFAULT 'Pendiente',
  horas_aprobadas_gdp REAL DEFAULT 0,
  situacion_final_gdp TEXT DEFAULT 'Vigente',
  observaciones_director TEXT,
  observaciones_slep TEXT,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS usuarios_sistema (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  email TEXT,
  nombre_completo TEXT NOT NULL,
  role TEXT NOT NULL,
  cargo TEXT,
  rbd_asignado TEXT,
  cartera_rbds_json TEXT,
  asesores_supervisados_json TEXT,
  comunas_permitidas_json TEXT,
  roles_adicionales_json TEXT,
  password_hash TEXT,
  salt TEXT,
  gemini_api_key TEXT,
  activo INTEGER DEFAULT 1,
  debe_cambiar_password INTEGER DEFAULT 0,
  ultimo_acceso TEXT
);

CREATE TABLE IF NOT EXISTS establecimientos_eliminados (
  rbd TEXT PRIMARY KEY,
  eliminado_por TEXT,
  fecha TEXT
);

CREATE TABLE IF NOT EXISTS jisc_niveles_parvularia (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2027,
  codigo_ue_junji TEXT,
  correl_grupo INTEGER NOT NULL,
  cod_programa TEXT,
  nivel_nombre TEXT NOT NULL,
  subtipo_nivel TEXT NOT NULL,
  es_heterogeneo INTEGER DEFAULT 0,
  capacidad_autorizada INTEGER DEFAULT 0,
  matricula_activa INTEGER DEFAULT 0,
  retiros INTEGER DEFAULT 0,
  asistencia_promedio REAL DEFAULT 0,
  edad_meses_min INTEGER,
  edad_meses_max INTEGER,
  edad_minima_criterio INTEGER,
  jornada TEXT DEFAULT 'COMPLETA',
  horario_inicio TEXT DEFAULT '08:30',
  horario_fin TEXT DEFAULT '16:30',
  tiene_extension_horaria INTEGER DEFAULT 0,
  matricula_extension INTEGER DEFAULT 0,
  educadoras_asignadas_jisc INTEGER DEFAULT 0,
  tecnicos_asignados_jisc INTEGER DEFAULT 0,
  directoras_asignadas_jisc INTEGER DEFAULT 0,
  fuente_dato TEXT DEFAULT 'MANUAL',
  updated_at TEXT,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS jisc_turnos_personal (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2027,
  nivel_jisc_id TEXT,
  run_funcionario TEXT NOT NULL,
  nombre_funcionario TEXT,
  estamento_vtf TEXT NOT NULL,
  dias_semana TEXT DEFAULT 'L-V',
  hora_entrada TEXT NOT NULL,
  hora_salida TEXT NOT NULL,
  minutos_colacion INTEGER DEFAULT 45,
  franja TEXT DEFAULT 'REGULAR',
  horas_semanales_cronologicas REAL DEFAULT 44,
  observaciones TEXT,
  updated_at TEXT,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS jisc_parvulos_b3 (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2027,
  codigo_ue_junji TEXT,
  correl_grupo INTEGER NOT NULL,
  desc_nivel TEXT NOT NULL,
  rut_parvulo TEXT,
  edad_meses INTEGER NOT NULL,
  fecha_nacimiento TEXT,
  fecha_ingreso TEXT,
  fecha_retiro TEXT,
  activo INTEGER DEFAULT 1,
  presentes_mes INTEGER DEFAULT 0,
  dias_trabajados_mes INTEGER DEFAULT 0,
  porcentaje_asistencia REAL DEFAULT 0,
  requiere_nee INTEGER DEFAULT 0,
  updated_at TEXT,
  FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
);

CREATE TABLE IF NOT EXISTS configuracion_general (
  id TEXT PRIMARY KEY DEFAULT 'global',
  parametros_mineduc_json TEXT,
  ui_config_json TEXT,
  asesores_registrados_json TEXT,
  feature_flags_json TEXT,
  actualizado_por TEXT,
  ultima_modificacion TEXT
);

CREATE TABLE IF NOT EXISTS egresos_proyectados (
  id TEXT PRIMARY KEY,
  rbd TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2027,
  docente_id TEXT NOT NULL,
  run_docente TEXT NOT NULL,
  nombre_docente TEXT NOT NULL,
  asignatura_principal TEXT,
  horas_liberadas INTEGER NOT NULL DEFAULT 0,
  horas_aula_liberadas INTEGER NOT NULL DEFAULT 0,
  fuente_financiamiento TEXT NOT NULL DEFAULT 'SUBVENCION_GENERAL',
  calidad_juridica TEXT NOT NULL DEFAULT 'TITULAR',
  causal TEXT NOT NULL,
  certeza TEXT NOT NULL DEFAULT 'en_tramite',
  excepcion_jubilacion_3_anios INTEGER DEFAULT 0,
  fecha_cese TEXT,
  numero_decreto TEXT,
  impacto_presupuestario TEXT NOT NULL DEFAULT 'costo_doble_pendiente',
  vacante_docente_id TEXT,
  validado_por TEXT,
  observaciones TEXT,
  cpeip_notificacion_firme INTEGER DEFAULT 0,
  estado_reversion TEXT DEFAULT 'ACTIVO',
  motivo_reversion TEXT,
  fecha_reversion TEXT,
  revertido_por TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS solicitudes_movilidad (
  id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL DEFAULT 2027,
  carril TEXT NOT NULL,
  docente_id TEXT NOT NULL,
  run_docente TEXT NOT NULL,
  nombre_docente TEXT NOT NULL,
  rbd_origen TEXT NOT NULL,
  comuna_origen TEXT,
  rbd_destino_preferente TEXT,
  comuna_destino_preferente TEXT,
  calidad_juridica TEXT NOT NULL DEFAULT 'TITULAR',
  horas_contrato_actual INTEGER NOT NULL DEFAULT 0,
  horas_titulares_actuales INTEGER NOT NULL DEFAULT 0,
  horas_disponibles_mover INTEGER NOT NULL DEFAULT 0,
  horas_remanentes INTEGER NOT NULL DEFAULT 0,
  asignatura_principal TEXT,
  titulo_mencion TEXT,
  aplica_articulo_69 INTEGER DEFAULT 0,
  fuente_actual TEXT NOT NULL DEFAULT 'SUBVENCION_GENERAL',
  estado_flujo TEXT NOT NULL DEFAULT 'POSTULADO',
  puntaje_salud REAL DEFAULT 0,
  puntaje_ley_karin REAL DEFAULT 0,
  puntaje_cuidado_dependientes REAL DEFAULT 0,
  puntaje_distancia_rural REAL DEFAULT 0,
  puntaje_antiguedad REAL DEFAULT 0,
  puntaje_prioridad_total REAL DEFAULT 0,
  fundamento TEXT,
  creado_por TEXT,
  estamento_personal TEXT DEFAULT 'DOCENTE',
  categoria_asistente TEXT,
  horas_contrata_actuales INTEGER DEFAULT 0,
  numero_resolucion TEXT,
  fecha_resolucion TEXT,
  fecha_vigencia TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS escenarios_calce (
  id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL DEFAULT 2027,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  estado TEXT NOT NULL DEFAULT 'BORRADOR',
  version INTEGER NOT NULL DEFAULT 1,
  creado_por TEXT,
  aprobado_por TEXT,
  consolidado_por TEXT,
  fecha_consolidacion TEXT,
  numero_resolucion TEXT,
  fecha_resolucion TEXT,
  fecha_vigencia TEXT,
  resumen_metricas_json TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS propuestas_calce (
  id TEXT PRIMARY KEY,
  escenario_id TEXT NOT NULL,
  periodo INTEGER NOT NULL DEFAULT 2027,
  solicitud_movilidad_id TEXT,
  docente_origen_id TEXT NOT NULL,
  run_docente TEXT NOT NULL,
  nombre_docente TEXT NOT NULL,
  rbd_origen TEXT NOT NULL,
  rbd_destino TEXT NOT NULL,
  vacante_destino_id TEXT,
  egreso_origen_id TEXT,
  tipo_cobertura TEXT NOT NULL DEFAULT 'DEFINITIVA',
  horas_asignadas INTEGER NOT NULL DEFAULT 0,
  minutos_asignados INTEGER NOT NULL DEFAULT 0,
  horas_pedagogicas_aula INTEGER NOT NULL DEFAULT 0,
  fuente_destino TEXT NOT NULL DEFAULT 'SUBVENCION_GENERAL',
  indice_compatibilidad INTEGER NOT NULL DEFAULT 0,
  genera_rebote INTEGER DEFAULT 0,
  vacante_rebote_json TEXT,
  alertas_normativas_json TEXT,
  bloquea_consolidacion INTEGER DEFAULT 0,
  motivo_bloqueo TEXT,
  estado TEXT NOT NULL DEFAULT 'PROPUESTA',
  estamento_personal TEXT DEFAULT 'DOCENTE',
  estado_resolucion_rebote TEXT DEFAULT 'NO_APLICA',
  rebote_cubierto_por_propuesta_id TEXT,
  minutos_titulares_origen INTEGER DEFAULT 0,
  minutos_contrata_origen INTEGER DEFAULT 0,
  alerta_menoscabo_art50 INTEGER DEFAULT 0,
  alerta_condiciones_dificiles INTEGER DEFAULT 0,
  alerta_habilitacion_seremi_dto352 INTEGER DEFAULT 0,
  alerta_itinerancia_rural INTEGER DEFAULT 0,
  numero_resolucion TEXT,
  fecha_resolucion TEXT,
  fecha_vigencia TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS sync_pendientes_movilidad (
  id TEXT PRIMARY KEY,
  tabla TEXT NOT NULL,
  operacion TEXT NOT NULL,
  payload_json TEXT,
  match_json TEXT,
  on_conflict TEXT,
  error TEXT,
  intentos INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS escenarios_consolidacion_snapshots (
  escenario_id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS movilidad_registro_movimientos (
  id TEXT PRIMARY KEY,
  periodo INTEGER NOT NULL DEFAULT 2027,
  tipo_movimiento TEXT NOT NULL,
  entidad TEXT NOT NULL,
  entidad_id TEXT NOT NULL,
  codigo_referencia TEXT,
  rbd_origen TEXT NOT NULL,
  nombre_establecimiento TEXT,
  comuna TEXT,
  rbd_destino TEXT,
  usuario_actor TEXT NOT NULL,
  rol_actor TEXT,
  estado_anterior TEXT,
  estado_nuevo TEXT,
  descripcion TEXT NOT NULL,
  motivo TEXT,
  detalles_json TEXT,
  fecha_hora TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS __schema_migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);
`;

const EXTRA_COLUMNS_BY_TABLE: Record<string, ReadonlyArray<readonly [string, string]>> = {
  establecimientos: [
    ['tipo', "TEXT DEFAULT 'ESCUELA'"],
    ['tipo_perfil', "TEXT DEFAULT 'ESCUELA_BASICA'"],
    ['modalidades_autorizadas_json', 'TEXT'],
    ['codigo_junji', 'TEXT'],
    ['nombre_fantasia', 'TEXT'],
    ['localidad', 'TEXT'],
    ['direccion', 'TEXT'],
    ['horario_apertura', 'TEXT'],
    ['horario_cierre', 'TEXT'],
    ['horario_extension_inicio', 'TEXT'],
    ['horario_extension_cierre', 'TEXT'],
    ['subvencion_sep_mensual', 'REAL DEFAULT 0'],
    ['subvencion_pro_retencion', 'REAL DEFAULT 0'],
    ['cupo_horas_pie_diferencial', 'REAL DEFAULT 0'],
    ['cupo_horas_pie_asistentes', 'REAL DEFAULT 0'],
    ['accesibilidad', "TEXT DEFAULT 'urbano'"],
    ['condiciones_dificiles_pct', 'REAL DEFAULT 0']
  ],
  cursos_sae: [
    ['talleres_jec_json', 'TEXT'],
    ['periodo', 'INTEGER NOT NULL DEFAULT 2027'],
    ['regimen_proporcion', "TEXT DEFAULT '65_35'"],
    ['es_multigrado', 'INTEGER DEFAULT 0'],
    ['es_combinado', 'INTEGER DEFAULT 0'],
    ['tipo_modalidad', "TEXT DEFAULT 'REGULAR'"],
    ['grados_combinados_json', 'TEXT'],
    ['especialidad_tp', 'TEXT'],
    ['plan_estudio_id', 'TEXT'],
    ['edad_meses_minima', 'INTEGER'],
    ['edad_meses_maxima', 'INTEGER'],
    ['codigo_grupo_jisc', 'TEXT'],
    ['horario_jornada', 'TEXT'],
    ['tiene_extension_horaria', 'INTEGER DEFAULT 0'],
    ['matricula_extension', 'INTEGER DEFAULT 0'],
    ['jornada_nivel', "TEXT DEFAULT 'COMPLETA'"]
  ],
  docentes: [
    ['horas_subvencion_general_titular', 'REAL DEFAULT 0'],
    ['horas_subvencion_general_contrata', 'REAL DEFAULT 0'],
    ['horas_sep_titular', 'REAL DEFAULT 0'],
    ['horas_sep_contrata', 'REAL DEFAULT 0'],
    ['horas_pie_titular', 'REAL DEFAULT 0'],
    ['horas_pie_contrata', 'REAL DEFAULT 0'],
    ['horas_directivas', 'INTEGER DEFAULT 0'],
    ['horas_inspector_general', 'REAL DEFAULT 0'],
    ['horas_tecnico_pedagogica', 'INTEGER DEFAULT 0'],
    ['horas_coordinacion', 'INTEGER DEFAULT 0'],
    ['tipo_coordinacion', 'TEXT'],
    ['horas_aula', 'INTEGER DEFAULT 0'],
    ['horas_ingles', 'INTEGER DEFAULT 0'],
    ['funcion_principal', 'TEXT'],
    ['funcion_secundaria', 'TEXT'],
    ['periodo', 'INTEGER NOT NULL DEFAULT 2027'],
    ['horas_coordinacion_pie', 'REAL DEFAULT 0'],
    ['horas_convivencia_escolar', 'REAL DEFAULT 0'],
    ['horas_extraescolar', 'REAL DEFAULT 0'],
    ['cargo_institucional', 'TEXT'],
    ['horas_taller_sep', 'REAL DEFAULT 0'],
    ['horas_trabajo_colaborativo', 'REAL DEFAULT 0'],
    ['funciones_no_aula_json', 'TEXT'],
    ['requiere_autorizacion_docente', 'INTEGER DEFAULT 0'],
    ['horas_vigentes_anterior', 'REAL DEFAULT 0'],
    ['propuesta_gdp', "TEXT DEFAULT 'Continuidad'"],
    ['remuneracion_mensual_app', 'REAL DEFAULT 0'],
    ['fecha_inicio_contrato', "TEXT DEFAULT '01-03-2026'"],
    ['fecha_termino_contrato', "TEXT DEFAULT '28-02-2027'"],
    ['accion_pme_sep', 'TEXT'],
    ['horas_pro_retencion', 'REAL DEFAULT 0'],
    ['descripcion_funcion_gdp', 'TEXT'],
    ['estado_sancion_gdp', "TEXT DEFAULT 'Pendiente'"],
    ['horas_aprobadas_gdp', 'REAL DEFAULT 0'],
    ['situacion_final_gdp', "TEXT DEFAULT 'Vigente'"],
    ['observaciones_director', 'TEXT'],
    ['observaciones_slep', 'TEXT'],
    ['es_vtf', 'INTEGER DEFAULT 0'],
    ['funcion_vtf', 'TEXT'],
    ['grupo_jisc_id', 'TEXT'],
    ['hora_ingreso_turno', 'TEXT'],
    ['hora_salida_turno', 'TEXT'],
    ['reemplazo_de_run', 'TEXT'],
    ['es_vacante_nn', 'INTEGER DEFAULT 0'],
    ['tipo_vacante', 'TEXT'],
    ['justificacion_vacante', 'TEXT'],
    ['origen_egreso_id', 'TEXT'],
    ['vacante_condicional', 'INTEGER DEFAULT 0'],
    ['tramo_carrera_docente', 'TEXT'],
    ['habilitacion_seremi_rbd', 'TEXT'],
    ['habilitacion_seremi_asignatura', 'TEXT'],
    ['estado_necesidad', 'TEXT'],
    ['motivo_estado_necesidad', 'TEXT']
  ],
  asignaciones_horarias: [
    ['co_docente_id', 'TEXT'],
    ['tiene_co_docente', 'INTEGER DEFAULT 0'],
    ['es_taller_jec', 'INTEGER DEFAULT 0'],
    ['periodo', 'INTEGER NOT NULL DEFAULT 2027'],
    ['es_taller_sep', 'INTEGER DEFAULT 0'],
    ['es_proporcion_docente', 'INTEGER DEFAULT 0'],
    ['cursos_compartidos_json', 'TEXT'],
    ['es_diferenciado_compartido', 'INTEGER DEFAULT 0'],
    ['es_co_docencia', 'INTEGER DEFAULT 0'],
    ['es_agrupacion_flexible', 'INTEGER DEFAULT 0'],
    ['es_trabajo_colaborativo', 'INTEGER DEFAULT 0'],
    ['codigo_asignatura', 'TEXT'],
    ['ambito_curricular', 'TEXT']
  ],
  asistentes_educacion: [
    ['horas_honorarios', 'REAL DEFAULT 0'],
    ['horas_vigentes_anterior', 'REAL DEFAULT 0'],
    ['propuesta_gdp', "TEXT DEFAULT 'Continuidad'"],
    ['remuneracion_mensual_app', 'REAL DEFAULT 0'],
    ['fecha_inicio_contrato', "TEXT DEFAULT '01-03-2026'"],
    ['fecha_termino_contrato', "TEXT DEFAULT '28-02-2027'"],
    ['accion_pme_sep', 'TEXT'],
    ['horas_pro_retencion', 'REAL DEFAULT 0'],
    ['descripcion_funcion_gdp', 'TEXT'],
    ['estado_sancion_gdp', "TEXT DEFAULT 'Pendiente'"],
    ['horas_aprobadas_gdp', 'REAL DEFAULT 0'],
    ['situacion_final_gdp', "TEXT DEFAULT 'Vigente'"],
    ['observaciones_director', 'TEXT'],
    ['observaciones_slep', 'TEXT'],
    ['es_vtf', 'INTEGER DEFAULT 0'],
    ['funcion_vtf', 'TEXT'],
    ['grupo_jisc_id', 'TEXT'],
    ['hora_ingreso_turno', 'TEXT'],
    ['hora_salida_turno', 'TEXT']
  ],
  usuarios_sistema: [
    ['debe_cambiar_password', 'INTEGER DEFAULT 0'],
    ['roles_adicionales_json', 'TEXT']
  ],
  configuracion_general: [
    ['feature_flags_json', 'TEXT']
  ],
  egresos_proyectados: [
    ['cpeip_notificacion_firme', 'INTEGER DEFAULT 0'],
    ['estado_reversion', "TEXT DEFAULT 'ACTIVO'"],
    ['motivo_reversion', 'TEXT'],
    ['fecha_reversion', 'TEXT'],
    ['revertido_por', 'TEXT']
  ],
  solicitudes_movilidad: [
    ['estamento_personal', "TEXT DEFAULT 'DOCENTE'"],
    ['categoria_asistente', 'TEXT'],
    ['horas_contrata_actuales', 'INTEGER DEFAULT 0'],
    ['numero_resolucion', 'TEXT'],
    ['fecha_resolucion', 'TEXT'],
    ['fecha_vigencia', 'TEXT']
  ],
  escenarios_calce: [
    ['version', 'INTEGER NOT NULL DEFAULT 1'],
    ['numero_resolucion', 'TEXT'],
    ['fecha_resolucion', 'TEXT'],
    ['fecha_vigencia', 'TEXT']
  ],
  propuestas_calce: [
    ['estamento_personal', "TEXT DEFAULT 'DOCENTE'"],
    ['estado_resolucion_rebote', "TEXT DEFAULT 'NO_APLICA'"],
    ['rebote_cubierto_por_propuesta_id', 'TEXT'],
    ['minutos_titulares_origen', 'INTEGER DEFAULT 0'],
    ['minutos_contrata_origen', 'INTEGER DEFAULT 0'],
    ['alerta_menoscabo_art50', 'INTEGER DEFAULT 0'],
    ['alerta_condiciones_dificiles', 'INTEGER DEFAULT 0'],
    ['alerta_habilitacion_seremi_dto352', 'INTEGER DEFAULT 0'],
    ['alerta_itinerancia_rural', 'INTEGER DEFAULT 0'],
    ['numero_resolucion', 'TEXT'],
    ['fecha_resolucion', 'TEXT'],
    ['fecha_vigencia', 'TEXT']
  ]
};

function ensureTableColumns(db: Database, table: string, columns: ReadonlyArray<readonly [string, string]>): void {
  const info = db.exec(`PRAGMA table_info(${table});`);
  const existing = new Set<string>((info[0]?.values || []).map(row => String(row[1]).toLowerCase()));
  for (const [colName, colDef] of columns) {
    if (!existing.has(colName.toLowerCase())) {
      db.run(`ALTER TABLE ${table} ADD COLUMN ${colName} ${colDef};`);
      existing.add(colName.toLowerCase());
    }
  }
}

export function hasAppliedMigration(db: Database, migrationId: string): boolean {
  try {
    const res = db.exec('SELECT 1 FROM __schema_migrations WHERE id = ? LIMIT 1;', [migrationId]);
    return Boolean(res[0]?.values?.length);
  } catch {
    return false;
  }
}

export function markAppliedMigration(db: Database, migrationId: string): void {
  db.run('INSERT OR IGNORE INTO __schema_migrations (id, applied_at) VALUES (?, ?);', [
    migrationId,
    new Date().toISOString()
  ]);
}

export function runMigrations(db: Database): void {
  db.run(INIT_SCHEMA_SQL);

  // Poblar y sincronizar planes de estudio oficiales MINEDUC (incluyendo especialidades TP)
  try {
    poblarPlanesEstudioEnDb(db);
  } catch (e) {
    console.warn('Error al sincronizar planes de estudio en SQLite:', e);
  }

  for (const [table, cols] of Object.entries(EXTRA_COLUMNS_BY_TABLE)) {
    try {
      ensureTableColumns(db, table, cols);
    } catch (e) {
      console.warn(`[schema] Error asegurando columnas en ${table}:`, e);
    }
  }

  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_cursos_rbd_periodo ON cursos_sae(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_docentes_rbd_periodo ON docentes(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asignaciones_rbd_periodo ON asignaciones_horarias(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asignaciones_curso ON asignaciones_horarias(curso_id);',
    'CREATE INDEX IF NOT EXISTS idx_asignaciones_docente ON asignaciones_horarias(docente_id);',
    'CREATE INDEX IF NOT EXISTS idx_salas_rbd ON salas_infraestructura(rbd);',
    'CREATE INDEX IF NOT EXISTS idx_planes_estudio ON planes_estudio_mineduc(nivel, regimen);',
    'CREATE INDEX IF NOT EXISTS idx_planes_colegio_rbd ON planes_estudio_colegio(rbd, nivel, regimen);',
    'CREATE INDEX IF NOT EXISTS idx_auditoria_rbd_periodo ON auditoria_cambios(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asistentes_rbd_periodo ON asistentes_educacion(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_asistentes_run ON asistentes_educacion(run);',
    'CREATE INDEX IF NOT EXISTS idx_asistentes_estamento ON asistentes_educacion(estamento);',
    'CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios_sistema(email);',
    'CREATE INDEX IF NOT EXISTS idx_usuarios_role ON usuarios_sistema(role);',
    'CREATE INDEX IF NOT EXISTS idx_jisc_niveles_rbd_periodo ON jisc_niveles_parvularia(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_jisc_turnos_rbd_periodo ON jisc_turnos_personal(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_jisc_b3_rbd_periodo ON jisc_parvulos_b3(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_docentes_vacante_nn ON docentes(es_vacante_nn, rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_egresos_rbd_periodo ON egresos_proyectados(rbd, periodo);',
    'CREATE INDEX IF NOT EXISTS idx_solicitudes_movilidad_periodo ON solicitudes_movilidad(periodo, carril, estado_flujo);',
    'CREATE INDEX IF NOT EXISTS idx_escenarios_calce_periodo ON escenarios_calce(periodo, estado);',
    'CREATE INDEX IF NOT EXISTS idx_propuestas_calce_escenario ON propuestas_calce(escenario_id);',
    'CREATE INDEX IF NOT EXISTS idx_movilidad_registro_periodo ON movilidad_registro_movimientos(periodo, fecha_hora);',
    'CREATE INDEX IF NOT EXISTS idx_movilidad_registro_rbd ON movilidad_registro_movimientos(rbd_origen, tipo_movimiento);'
  ];

  for (const idxSql of indexes) {
    try { db.run(idxSql); } catch (e) { console.warn('Error idx:', e); }
  }

  try {
    const defaultFeatureFlagsJson = JSON.stringify({
      modulo_movilidad_activo: true,
      flag_saneamiento_nn_escuelas: true,
      flag_egresos_contingencia: true,
      flag_traslados_voluntarios: true,
      flag_no_continuidad_titulares: true,
      flag_simulador_calce_automatico: true
    });
    db.run(
      `INSERT OR IGNORE INTO configuracion_general (id, feature_flags_json, ultima_modificacion) VALUES ('global', ?, ?);`,
      [defaultFeatureFlagsJson, new Date().toISOString()]
    );
  } catch (e) {
    console.warn('[schema] Aviso sembrando configuracion_general:', e);
  }

  // Purga Automática Proactiva: Si existen asignaciones residuales de "Plan Común Electivo"
  // en cursos de Básica, Multigrado o Parvularia generadas previamente por error, eliminarlas automáticamente.
  try {
    db.run(`
      DELETE FROM asignaciones_horarias
      WHERE id IN (
        SELECT a.id
        FROM asignaciones_horarias a
        JOIN cursos_sae c ON a.curso_id = c.id
        WHERE (
          LOWER(a.asignatura) LIKE '%plan com%n electivo%' OR
          LOWER(a.asignatura) LIKE '%plan comun electivo%'
        )
        AND (
          LOWER(c.nivel) LIKE '%b_sic%' OR
          LOWER(c.nivel) LIKE '%parvul%' OR
          LOWER(c.nivel) LIKE '%k_nder%' OR
          LOWER(c.nivel) LIKE '%transici%' OR
          LOWER(c.nivel) LIKE '%nt1%' OR
          LOWER(c.nivel) LIKE '%nt2%' OR
          LOWER(c.nivel) LIKE '%multigrado%' OR
          LOWER(c.nivel) LIKE '%1%medio%' OR
          LOWER(c.nivel) LIKE '%2%medio%'
        )
      );
    `);
  } catch (e) {
    console.warn('Aviso en purga automática de Plan Común Electivo básico:', e);
  }

  // Migración Automática de Período 2026 -> 2027:
  // Garantiza que cualquier registro local residual en período 2026 pase a 2027 sin duplicados.
  try {
    db.run(`
      DELETE FROM cursos_sae
      WHERE periodo != 2027
        AND EXISTS (
          SELECT 1 FROM cursos_sae c27
          WHERE c27.rbd = cursos_sae.rbd
            AND c27.periodo = 2027
            AND c27.nivel = cursos_sae.nivel
            AND c27.letra = cursos_sae.letra
        );
      UPDATE cursos_sae SET periodo = 2027 WHERE periodo != 2027 OR periodo IS NULL;

      DELETE FROM docentes
      WHERE periodo != 2027
        AND EXISTS (
          SELECT 1 FROM docentes d27
          WHERE d27.rbd = docentes.rbd
            AND d27.periodo = 2027
            AND d27.run = docentes.run
        );
      UPDATE docentes SET periodo = 2027 WHERE periodo != 2027 OR periodo IS NULL;

      DELETE FROM asistentes_educacion
      WHERE periodo != 2027
        AND EXISTS (
          SELECT 1 FROM asistentes_educacion a27
          WHERE a27.rbd = asistentes_educacion.rbd
            AND a27.periodo = 2027
            AND a27.run = asistentes_educacion.run
        );
      UPDATE asistentes_educacion SET periodo = 2027 WHERE periodo != 2027 OR periodo IS NULL;

      UPDATE asignaciones_horarias SET periodo = 2027 WHERE periodo != 2027 OR periodo IS NULL;
      UPDATE auditoria_cambios SET periodo = 2027 WHERE periodo != 2027 OR periodo IS NULL;

      CREATE TABLE IF NOT EXISTS establecimientos_eliminados (
        rbd TEXT PRIMARY KEY,
        eliminado_por TEXT,
        fecha TEXT
      );
    `);
  } catch (e) {
    console.warn('Aviso en migración automática de período 2026 -> 2027:', e);
  }

  if (!hasAppliedMigration(db, 'fix_asignaciones_transversal_fk_v1')) {
    try {
      const fkInfo = db.exec('PRAGMA foreign_key_list(asignaciones_horarias);');
      const fkTables = new Set<string>((fkInfo[0]?.values || []).map(row => String(row[2]).toLowerCase()));
      if (fkTables.has('cursos_sae') || fkTables.has('docentes')) {
        db.run('PRAGMA foreign_keys = OFF;');
        db.run('BEGIN TRANSACTION;');
        try {
          db.run(`
            CREATE TABLE asignaciones_horarias_new (
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
              periodo INTEGER NOT NULL DEFAULT 2027,
              es_taller_sep INTEGER DEFAULT 0,
              es_trabajo_colaborativo INTEGER DEFAULT 0,
              es_proporcion_docente INTEGER DEFAULT 0,
              es_co_docencia INTEGER DEFAULT 0,
              es_agrupacion_flexible INTEGER DEFAULT 0,
              cursos_compartidos_json TEXT,
              es_diferenciado_compartido INTEGER DEFAULT 0,
              codigo_asignatura TEXT,
              ambito_curricular TEXT,
              FOREIGN KEY (rbd) REFERENCES establecimientos(rbd)
            );
          `);
          db.run(`
            INSERT INTO asignaciones_horarias_new (
              id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec,
              asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo,
              periodo, es_taller_sep, es_trabajo_colaborativo, es_proporcion_docente, es_co_docencia,
              es_agrupacion_flexible, cursos_compartidos_json, es_diferenciado_compartido,
              codigo_asignatura, ambito_curricular
            )
            SELECT
              id, rbd, COALESCE(curso_id, 'TRANSVERSAL'), COALESCE(docente_id, 'SIN_DOCENTE'),
              co_docente_id, tiene_co_docente, es_taller_jec,
              asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo,
              COALESCE(periodo, 2027), es_taller_sep, es_trabajo_colaborativo, es_proporcion_docente, es_co_docencia,
              es_agrupacion_flexible, cursos_compartidos_json, es_diferenciado_compartido,
              codigo_asignatura, ambito_curricular
            FROM asignaciones_horarias;
          `);
          db.run('DROP TABLE asignaciones_horarias;');
          db.run('ALTER TABLE asignaciones_horarias_new RENAME TO asignaciones_horarias;');
          db.run('CREATE INDEX IF NOT EXISTS idx_asignaciones_rbd_periodo ON asignaciones_horarias(rbd, periodo);');
          db.run('CREATE INDEX IF NOT EXISTS idx_asignaciones_curso ON asignaciones_horarias(curso_id);');
          db.run('CREATE INDEX IF NOT EXISTS idx_asignaciones_docente ON asignaciones_horarias(docente_id);');
          db.run('COMMIT;');
        } catch (innerErr) {
          db.run('ROLLBACK;');
          throw innerErr;
        } finally {
          db.run('PRAGMA foreign_keys = ON;');
        }
      }
      markAppliedMigration(db, 'fix_asignaciones_transversal_fk_v1');
    } catch (e) {
      console.warn('[schema] Aviso en migración fix_asignaciones_transversal_fk_v1:', e);
    }
  }
}