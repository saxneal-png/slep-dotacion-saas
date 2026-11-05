import { supabase, isSupabaseEnabled } from './supabaseClient';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion,
  PlanEstudioCurricular
} from '../types';
import { UsuarioSistema } from '../types/authTypes';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';

/**
 * Normaliza y sanea cadenas de fecha para compatibilidad con tipo DATE de PostgreSQL (YYYY-MM-DD o null)
 */
export function sanitizeDbDate(d: string | null | undefined): string | null {
  if (!d) return null;
  const trimmed = d.trim();
  if (!trimmed || trimmed.toLowerCase() === 'indefinido' || trimmed.toLowerCase() === 'null') {
    return null;
  }
  // DD-MM-YYYY o DD/MM/YYYY
  const ddmmyyyy = trimmed.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = ddmmyyyy[1].padStart(2, '0');
    const month = ddmmyyyy[2].padStart(2, '0');
    const year = ddmmyyyy[3];
    return `${year}-${month}-${day}`;
  }
  // YYYY-MM-DD
  const yyyymmdd = trimmed.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyymmdd) {
    const year = yyyymmdd[1];
    const month = yyyymmdd[2].padStart(2, '0');
    const day = yyyymmdd[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

/**
 * Mapeo de tipos y entidades entre TypeScript y Supabase PostgreSQL
 */

export function mapEstablecimientoToDb(est: Establecimiento) {
  return {
    rbd: est.rbd.trim(),
    id: est.id || `est-${est.rbd.trim()}`,
    nombre: est.nombre,
    comuna: est.comuna,
    tipo: (est as any).tipo || 'ESCUELA',
    regimen: est.regimen || 'JEC',
    porcentaje_prioritarios: est.porcentajePrioritarios ?? 75.0,
    director: est.director || null,
    asesor_uatp: est.asesorUatp || null,
    telefono: est.telefono || null,
    email: est.email || null,
    subvencion_sep_mensual: est.subvencionSepMensual || 0,
    subvencion_pro_retencion: est.subvencionProRetencion || 0,
    cupo_horas_pie_diferencial: est.cupoHorasPieDiferencial || 0,
    cupo_horas_pie_asistentes: est.cupoHorasPieAsistentes || 0,
    estado_planificacion: (est as any).estadoPlanificacion || 'BORRADOR'
  };
}

export function mapEstablecimientoFromDb(row: any): Establecimiento {
  return {
    id: row.id || `est-${row.rbd}`,
    rbd: row.rbd,
    nombre: row.nombre,
    comuna: row.comuna,
    regimen: row.regimen,
    porcentajePrioritarios: Number(row.porcentaje_prioritarios ?? 75),
    director: row.director || undefined,
    asesorUatp: row.asesor_uatp || undefined,
    telefono: row.telefono || undefined,
    email: row.email || undefined,
    subvencionSepMensual: Number(row.subvencion_sep_mensual || 0),
    subvencionProRetencion: Number(row.subvencion_pro_retencion || 0),
    cupoHorasPieDiferencial: Number(row.cupo_horas_pie_diferencial || 0),
    cupoHorasPieAsistentes: Number(row.cupo_horas_pie_asistentes || 0)
  };
}

export function mapSalaToDb(sala: SalaInfraestructura) {
  return {
    id: sala.id,
    rbd: sala.rbd.trim(),
    pabellon: sala.pabellon || null,
    nombre_sala: sala.nombreSala,
    superficie_m2: sala.superficieM2 || 45,
    tipo: sala.tipo,
    aforo_maximo: sala.aforoMaximo || 35
  };
}

export function mapSalaFromDb(row: any): SalaInfraestructura {
  return {
    id: row.id,
    rbd: row.rbd,
    pabellon: row.pabellon || undefined,
    nombreSala: row.nombre_sala,
    superficieM2: Number(row.superficie_m2 || 0),
    tipo: row.tipo,
    aforoMaximo: Number(row.aforo_maximo || 0)
  };
}

export function mapCursoToDb(curso: CursoSae) {
  return {
    id: curso.id,
    rbd: curso.rbd.trim(),
    periodo: 2027,
    nivel: curso.nivel,
    letra: curso.letra || 'A',
    regimen: curso.regimen || 'JEC',
    regimen_proporcion: curso.regimenProporcion || '65_35',
    sala_id: curso.salaId || null,
    cupo_sae: curso.cupoSae ?? 35,
    matricula_proyectada: curso.matriculaProyectada ?? 30,
    alumnos_neet: curso.alumnosNeet ?? 0,
    alumnos_neep: curso.alumnosNeep ?? 0,
    talleres_jec_json: curso.talleresJec ? JSON.stringify(curso.talleresJec) : '[]',
    es_multigrado: Boolean(curso.esMultigrado),
    es_combinado: Boolean(curso.esCombinado),
    tipo_modalidad: curso.tipoModalidad || 'REGULAR',
    grados_combinados_json: curso.gradosCombinados ? JSON.stringify(curso.gradosCombinados) : '[]',
    especialidad_tp: curso.especialidadTp || null,
    plan_estudio_id: curso.planEstudioId || null
  };
}

export function mapCursoFromDb(row: any): CursoSae {
  let talleres: any[] = [];
  try {
    talleres = typeof row.talleres_jec_json === 'string' ? JSON.parse(row.talleres_jec_json) : (row.talleres_jec_json || []);
  } catch (_) {}

  let grados: string[] = [];
  try {
    grados = typeof row.grados_combinados_json === 'string' ? JSON.parse(row.grados_combinados_json) : (row.grados_combinados_json || []);
  } catch (_) {}

  return {
    id: row.id,
    rbd: row.rbd,
    periodo: 2027,
    nivel: row.nivel,
    letra: row.letra,
    regimen: row.regimen,
    regimenProporcion: row.regimen_proporcion,
    salaId: row.sala_id || undefined,
    cupoSae: Number(row.cupo_sae || 0),
    matriculaProyectada: Number(row.matricula_proyectada || 0),
    alumnosNeet: Number(row.alumnos_neet || 0),
    alumnosNeep: Number(row.alumnos_neep || 0),
    talleresJec: talleres,
    esMultigrado: Boolean(row.es_multigrado),
    esCombinado: Boolean(row.es_combinado),
    tipoModalidad: row.tipo_modalidad,
    gradosCombinados: grados,
    especialidadTp: row.especialidad_tp || undefined,
    planEstudioId: row.plan_estudio_id || undefined
  };
}

/**
 * Calidades jurídicas aceptadas por la restricción CHECK histórica de PostgreSQL
 * (calidad_juridica IN ('TITULAR', 'CONTRATA')). Cualquier otra calidad
 * (p. ej. POSTULANDO_A_TITULARIDAD) se envía como CONTRATA y su valor real se
 * preserva en metadatos dentro de funciones_no_aula_json para no perder información.
 */
const CALIDADES_REMOTAS_PERMITIDAS = new Set(['TITULAR', 'CONTRATA']);

/** Redondea horas a entero para columnas INTEGER de PostgreSQL (evita error 22P02). */
function toIntHoras(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : 0;
}

/** Elimina ids duplicados dentro de un lote (evita error 21000 "ON CONFLICT ... a second time"). */
export function deduplicarPorId<T extends { id: string }>(items: T[]): T[] {
  const map = new Map<string, T>();
  for (const it of items) {
    if (it && it.id) map.set(it.id, it);
  }
  return Array.from(map.values());
}

export function mapDocenteToDb(docente: Docente, incluirColumnaRequiere: boolean = false) {
  let funcionesArr: any[] = [];
  if (docente.funcionesNoAula && Array.isArray(docente.funcionesNoAula)) {
    funcionesArr = docente.funcionesNoAula.map(f => ({ ...f }));
  }
  if (docente.requiereAutorizacionDocente) {
    funcionesArr.push({ __metaRequiereAutorizacionDocente: true });
  }

  const calidadOriginal = String(docente.calidadJuridica || 'TITULAR').toUpperCase();
  const calidadRemota = CALIDADES_REMOTAS_PERMITIDAS.has(calidadOriginal) ? calidadOriginal : 'CONTRATA';
  if (calidadRemota !== calidadOriginal) {
    funcionesArr.push({ __metaCalidadJuridica: calidadOriginal });
  }

  const base: any = {
    id: docente.id,
    rbd: docente.rbd.trim(),
    periodo: 2027,
    run: docente.run,
    nombres: docente.nombres,
    apellidos: docente.apellidos,
    titulo: docente.titulo || null,
    calidad_juridica: calidadRemota,
    estamento: docente.estamento || 'DOCENTE_AULA',
    horas_contrato: Math.max(1, Math.min(44, toIntHoras(docente.horasContrato || 44))),
    horas_subvencion_general_titular: docente.horasSubvencionGeneralTitular || 0,
    horas_subvencion_general_contrata: docente.horasSubvencionGeneralContrata || 0,
    horas_sep_titular: docente.horasSepTitular || 0,
    horas_sep_contrata: docente.horasSepContrata || 0,
    horas_pie_titular: docente.horasPieTitular || 0,
    horas_pie_contrata: docente.horasPieContrata || 0,
    horas_directivas: toIntHoras(docente.horasDirectivas),
    horas_inspector_general: docente.horasInspectorGeneral || 0,
    horas_tecnico_pedagogica: toIntHoras(docente.horasTecnicoPedagogicas),
    horas_coordinacion: toIntHoras(docente.horasCoordinacion),
    tipo_coordinacion: docente.tipoCoordinacion || null,
    horas_taller_sep: docente.horasTallerSep || 0,
    horas_trabajo_colaborativo: docente.horasTrabajoColaborativo || 0,
    horas_coordinacion_pie: docente.horasCoordinacionPie || 0,
    horas_convivencia_escolar: docente.horasConvivenciaEscolar || 0,
    horas_extraescolar: docente.horasExtraescolar || 0,
    cargo_institucional: docente.cargoInstitucional || null,
    horas_aula: toIntHoras(docente.horasAula),
    horas_ingles: toIntHoras(docente.horasIngles),
    funcion_principal: docente.funcionPrincipal || null,
    funcion_secundaria: docente.funcionSecundaria || null,
    asignatura_principal: docente.asignaturaPrincipal || null,
    aplica_articulo_69: Boolean(docente.aplicaArticulo69),
    funciones_no_aula_json: funcionesArr.length > 0 ? JSON.stringify(funcionesArr) : '[]',
    horas_vigentes_anterior: docente.horasVigentesAnterior || 0,
    propuesta_gdp: docente.propuestaGdp || 'Continuidad',
    remuneracion_mensual_app: docente.remuneracionMensualApp || 0,
    fecha_inicio_contrato: sanitizeDbDate(docente.fechaInicioContrato) || '2026-03-01',
    fecha_termino_contrato: sanitizeDbDate(docente.fechaTerminoContrato) || (docente.calidadJuridica === 'TITULAR' ? null : '2027-02-28'),
    accion_pme_sep: docente.accionPmeSep || null,
    horas_pro_retencion: docente.horasProRetencion || 0,
    descripcion_funcion_gdp: docente.descripcionFuncionGdp || null,
    estado_sancion_gdp: docente.estadoSancionGdp || 'Pendiente',
    horas_aprobadas_gdp: docente.horasAprobadasGdp || 0,
    situacion_final_gdp: docente.situacionFinalGdp || 'Vigente',
    observaciones_director: docente.observacionesDirector || null,
    observaciones_slep: docente.observacionesSlep || null
  };

  if (incluirColumnaRequiere) {
    base.requiere_autorizacion_docente = Boolean(docente.requiereAutorizacionDocente);
  }

  return base;
}

export function mapDocenteFromDb(row: any): Docente {
  let funcionesNoAula: any[] = [];
  try {
    funcionesNoAula = typeof row.funciones_no_aula_json === 'string' 
      ? JSON.parse(row.funciones_no_aula_json) 
      : (row.funciones_no_aula_json || []);
  } catch (_) {}

  const metaItem = Array.isArray(funcionesNoAula)
    ? funcionesNoAula.find((f: any) => f && f.__metaRequiereAutorizacionDocente !== undefined)
    : undefined;
  const requiere = row.requiere_autorizacion_docente !== undefined && row.requiere_autorizacion_docente !== null
    ? Boolean(row.requiere_autorizacion_docente)
    : (metaItem ? Boolean(metaItem.__metaRequiereAutorizacionDocente) : false);

  const metaCalidad = Array.isArray(funcionesNoAula)
    ? funcionesNoAula.find((f: any) => f && f.__metaCalidadJuridica !== undefined)
    : undefined;

  const cleanFunciones = Array.isArray(funcionesNoAula)
    ? funcionesNoAula.filter((f: any) => !f || (f.__metaRequiereAutorizacionDocente === undefined && f.__metaCalidadJuridica === undefined))
    : [];

  return {
    id: row.id,
    rbd: row.rbd,
    periodo: 2027,
    run: row.run,
    nombres: row.nombres,
    apellidos: row.apellidos,
    titulo: row.titulo || undefined,
    calidadJuridica: (metaCalidad ? metaCalidad.__metaCalidadJuridica : row.calidad_juridica),
    estamento: row.estamento,
    horasContrato: Number(row.horas_contrato || 0),
    horasSubvencionGeneralTitular: Number(row.horas_subvencion_general_titular || 0),
    horasSubvencionGeneralContrata: Number(row.horas_subvencion_general_contrata || 0),
    horasSepTitular: Number(row.horas_sep_titular || 0),
    horasSepContrata: Number(row.horas_sep_contrata || 0),
    horasPieTitular: Number(row.horas_pie_titular || 0),
    horasPieContrata: Number(row.horas_pie_contrata || 0),
    horasDirectivas: Number(row.horas_directivas || 0),
    horasInspectorGeneral: Number(row.horas_inspector_general || 0),
    horasTecnicoPedagogicas: Number(row.horas_tecnico_pedagogica || 0),
    horasCoordinacion: Number(row.horas_coordinacion || 0),
    tipoCoordinacion: row.tipo_coordinacion || undefined,
    horasTallerSep: Number(row.horas_taller_sep || 0),
    horasTrabajoColaborativo: Number(row.horas_trabajo_colaborativo || 0),
    horasCoordinacionPie: Number(row.horas_coordinacion_pie || 0),
    horasConvivenciaEscolar: Number(row.horas_convivencia_escolar || 0),
    horasExtraescolar: Number(row.horas_extraescolar || 0),
    cargoInstitucional: row.cargo_institucional || undefined,
    horasAula: Number(row.horas_aula || 0),
    horasIngles: Number(row.horas_ingles || 0),
    funcionPrincipal: row.funcion_principal || undefined,
    funcionSecundaria: row.funcion_secundaria || undefined,
    asignaturaPrincipal: row.asignatura_principal || undefined,
    aplicaArticulo69: Boolean(row.aplica_articulo_69),
    requiereAutorizacionDocente: requiere,
    funcionesNoAula: cleanFunciones,
    horasVigentesAnterior: Number(row.horas_vigentes_anterior || 0),
    propuestaGdp: row.propuesta_gdp || undefined,
    remuneracionMensualApp: Number(row.remuneracion_mensual_app || 0),
    fechaInicioContrato: row.fecha_inicio_contrato || undefined,
    fechaTerminoContrato: row.fecha_termino_contrato || undefined,
    accionPmeSep: row.accion_pme_sep || undefined,
    horasProRetencion: Number(row.horas_pro_retencion || 0),
    descripcionFuncionGdp: row.descripcion_funcion_gdp || undefined,
    estadoSancionGdp: row.estado_sancion_gdp || undefined,
    horasAprobadasGdp: Number(row.horas_aprobadas_gdp || 0),
    situacionFinalGdp: row.situacion_final_gdp || undefined,
    observacionesDirector: row.observaciones_director || undefined,
    observacionesSlep: row.observaciones_slep || undefined
  };
}

export function mapAsignacionToDb(asig: AsignacionHoraria) {
  return {
    id: asig.id,
    rbd: asig.rbd.trim(),
    curso_id: asig.cursoId,
    docente_id: asig.docenteId,
    co_docente_id: asig.coDocenteId || null,
    tiene_co_docente: Boolean(asig.tieneCoDocente),
    es_taller_jec: Boolean(asig.esTallerJec),
    asignatura: asig.asignatura,
    horas_pedagogicas_aula: asig.horasPedagogicasAula || 0,
    horas_cronologicas_pie: asig.horasCronologicasPie || 0,
    horas_colaborativas: asig.horasColaborativas || 0,
    tipo_apoyo: asig.tipoApoyo || null,
    periodo: 2027,
    es_taller_sep: Boolean(asig.esTallerSep),
    es_trabajo_colaborativo: Boolean(asig.esTrabajoColaborativo),
    es_proporcion_docente: Boolean(asig.esProporcionDocente),
    es_co_docencia: Boolean(asig.esCoDocencia),
    es_agrupacion_flexible: Boolean(asig.esAgrupacionFlexible),
    cursos_compartidos_json: asig.cursosCompartidosIds ? JSON.stringify(asig.cursosCompartidosIds) : '[]',
    es_diferenciado_compartido: Boolean(asig.esDiferenciadoCompartido)
  };
}

export function mapAsignacionFromDb(row: any): AsignacionHoraria {
  let compartidos: string[] = [];
  try {
    compartidos = typeof row.cursos_compartidos_json === 'string'
      ? JSON.parse(row.cursos_compartidos_json)
      : (row.cursos_compartidos_json || []);
  } catch (_) {}

  return {
    id: row.id,
    rbd: row.rbd,
    cursoId: row.curso_id,
    docenteId: row.docente_id,
    coDocenteId: row.co_docente_id || undefined,
    tieneCoDocente: Boolean(row.tiene_co_docente),
    esTallerJec: Boolean(row.es_taller_jec),
    asignatura: row.asignatura,
    horasPedagogicasAula: Number(row.horas_pedagogicas_aula || 0),
    horasCronologicasPie: Number(row.horas_cronologicas_pie || 0),
    horasColaborativas: Number(row.horas_colaborativas || 0),
    tipoApoyo: row.tipo_apoyo || undefined,
    periodo: 2027,
    esTallerSep: Boolean(row.es_taller_sep),
    esTrabajoColaborativo: Boolean(row.es_trabajo_colaborativo),
    esProporcionDocente: Boolean(row.es_proporcion_docente),
    esCoDocencia: Boolean(row.es_co_docencia),
    esAgrupacionFlexible: Boolean(row.es_agrupacion_flexible),
    cursosCompartidosIds: compartidos,
    esDiferenciadoCompartido: Boolean(row.es_diferenciado_compartido)
  };
}

export function mapAsistenteToDb(ast: AsistenteEducacion) {
  return {
    id: ast.id,
    rbd: ast.rbd.trim(),
    periodo: 2027,
    run: ast.run,
    nombres: ast.nombres,
    apellidos: ast.apellidos,
    cargo_funcion: ast.cargoFuncion,
    estamento: ast.estamento,
    horas_contrato: ast.horasContrato || 44,
    horas_subvencion_general_indefinido: ast.horasSubvencionGeneralIndefinido || 0,
    horas_subvencion_general_plazo_fijo: ast.horasSubvencionGeneralPlazoFijo || 0,
    horas_sep_indefinido: ast.horasSepIndefinido || 0,
    horas_sep_plazo_fijo: ast.horasSepPlazoFijo || 0,
    horas_pie_indefinido: ast.horasPieIndefinido || 0,
    horas_pie_plazo_fijo: ast.horasPiePlazoFijo || 0,
    horas_honorarios: ast.horasHonorarios || 0,
    es_dupla_psicosocial: Boolean(ast.esDuplaPsicosocial),
    es_equipo_pie: Boolean(ast.esEquipoPie),
    es_tecnico_parvulo: Boolean(ast.esTecnicoParvulo),
    es_auxiliar_servicio: Boolean(ast.esAuxiliarServicio),
    es_inspector_patio: Boolean(ast.esInspectorPatio),
    observaciones: ast.observaciones || null,
    activo: ast.activo !== false,
    horas_vigentes_anterior: ast.horasVigentesAnterior || 0,
    propuesta_gdp: ast.propuestaGdp || 'Continuidad',
    remuneracion_mensual_app: ast.remuneracionMensualApp || 0,
    fecha_inicio_contrato: sanitizeDbDate(ast.fechaInicioContrato) || '2026-03-01',
    fecha_termino_contrato: sanitizeDbDate(ast.fechaTerminoContrato) || null,
    accion_pme_sep: ast.accionPmeSep || null,
    horas_pro_retencion: ast.horasProRetencion || 0,
    descripcion_funcion_gdp: ast.descripcionFuncionGdp || null,
    estado_sancion_gdp: ast.estadoSancionGdp || 'Pendiente',
    horas_aprobadas_gdp: ast.horasAprobadasGdp || 0,
    situacion_final_gdp: ast.situacionFinalGdp || 'Vigente',
    observaciones_director: ast.observacionesDirector || null,
    observaciones_slep: ast.observacionesSlep || null
  };
}

export function mapAsistenteFromDb(row: any): AsistenteEducacion {
  return {
    id: row.id,
    rbd: row.rbd,
    periodo: 2027,
    run: row.run,
    nombres: row.nombres,
    apellidos: row.apellidos,
    cargoFuncion: row.cargo_funcion,
    estamento: row.estamento,
    horasContrato: Number(row.horas_contrato || 0),
    horasSubvencionGeneralIndefinido: Number(row.horas_subvencion_general_indefinido || 0),
    horasSubvencionGeneralPlazoFijo: Number(row.horas_subvencion_general_plazo_fijo || 0),
    horasSepIndefinido: Number(row.horas_sep_indefinido || 0),
    horasSepPlazoFijo: Number(row.horas_sep_plazo_fijo || 0),
    horasPieIndefinido: Number(row.horas_pie_indefinido || 0),
    horasPiePlazoFijo: Number(row.horas_pie_plazo_fijo || 0),
    horasHonorarios: Number(row.horas_honorarios || 0),
    esDuplaPsicosocial: Boolean(row.es_dupla_psicosocial),
    esEquipoPie: Boolean(row.es_equipo_pie),
    esTecnicoParvulo: Boolean(row.es_tecnico_parvulo),
    esAuxiliarServicio: Boolean(row.es_auxiliar_servicio),
    esInspectorPatio: Boolean(row.es_inspector_patio),
    observaciones: row.observaciones || undefined,
    activo: Boolean(row.activo),
    horasVigentesAnterior: Number(row.horas_vigentes_anterior || 0),
    propuestaGdp: row.propuesta_gdp || undefined,
    remuneracionMensualApp: Number(row.remuneracion_mensual_app || 0),
    fechaInicioContrato: row.fecha_inicio_contrato || undefined,
    fechaTerminoContrato: row.fecha_termino_contrato || undefined,
    accionPmeSep: row.accion_pme_sep || undefined,
    horasProRetencion: Number(row.horas_pro_retencion || 0),
    descripcionFuncionGdp: row.descripcion_funcion_gdp || undefined,
    estadoSancionGdp: row.estado_sancion_gdp || undefined,
    horasAprobadasGdp: Number(row.horas_aprobadas_gdp || 0),
    situacionFinalGdp: row.situacion_final_gdp || undefined,
    observacionesDirector: row.observaciones_director || undefined,
    observacionesSlep: row.observaciones_slep || undefined
  };
}

/**
 * Servicio Central de Sincronización y Persistencia con Supabase PostgreSQL
 */
export class SupabaseDotacionService {
  // Bandera para rastrear si la columna `requiere_autorizacion_docente` existe en PostgreSQL
  private static soportaColumnaRequiereAutorizacion: boolean = false;
  // Bandera para rastrear si la columna `horas_honorarios` existe en PostgreSQL (migración 20261102182500)
  private static soportaColumnaHonorarios: boolean = true;

  private static payloadAsistente(ast: AsistenteEducacion): any {
    const p: any = mapAsistenteToDb(ast);
    if (!this.soportaColumnaHonorarios) delete p.horas_honorarios;
    return p;
  }

  private static esErrorColumnaHonorarios(error: any): boolean {
    return Boolean(error) && String(error.message || '').includes('horas_honorarios');
  }

  /**
   * Recupera TODAS las filas de una tabla en Supabase aplicando paginación exhaustiva
   * secuencial por bloques (range), evitando truncamiento al límite por defecto de PostgREST (1.000 filas).
   * Garantiza recuperar el 100% de la información remota sin importar cuántas filas existan.
   */
  static async fetchAllRows<T = any>(
    tableName: string,
    filterFn?: (query: any) => any,
    batchSize: number = 1000
  ): Promise<T[]> {
    if (!isSupabaseEnabled()) return [];
    let allRows: T[] = [];
    let from = 0;
    while (true) {
      let q = supabase.from(tableName).select('*').range(from, from + batchSize - 1);
      if (filterFn) {
        q = filterFn(q);
      }
      const { data, error } = await q;
      if (error) {
        console.error(`[SupabaseDotacionService] Error recuperando filas de ${tableName} [range ${from}..${from + batchSize - 1}]:`, error);
        break;
      }
      if (!data || data.length === 0) break;
      allRows = allRows.concat(data as T[]);
      if (data.length < batchSize) break;
      from += batchSize;
    }
    return allRows;
  }

  /**
   * Verifica que los establecimientos existan en la tabla remota `establecimientos`.
   * Si alguno falta, lo crea a partir del catálogo oficial SLEP para evitar violaciones de clave foránea.
   */
  /**
   * Garantiza que los establecimientos referenciados existan en Supabase antes de insertar registros dependientes.
   * IMPORTANTE: No crea colegios eliminados ni sintetiza colegios fantasma que no pertenezcan al catálogo SLEP oficial.
   */
  static async asegurarEstablecimientosExisten(rbds: string[]): Promise<void> {
    if (!isSupabaseEnabled() || !rbds.length) return;
    const cleanRbds = [...new Set(rbds.map(r => r ? r.trim() : '').filter(Boolean))];
    if (!cleanRbds.length) return;

    try {
      const { listarRbdsEliminados } = await import('../database/repositories/establecimientosRepo');
      const eliminados = await listarRbdsEliminados();

      // Filtrar RBDs que han sido eliminados expresamente por el Super Usuario
      const candidatos = cleanRbds.filter(r => !eliminados.has(r));
      if (!candidatos.length) return;

      const { data: existentes, error } = await supabase
        .from('establecimientos')
        .select('rbd')
        .in('rbd', candidatos);

      if (error) {
        console.warn('[SupabaseDotacionService] Aviso verificando establecimientos existentes:', error);
        return;
      }

      const existentesSet = new Set((existentes || []).map(e => String(e.rbd)));
      const faltantes = candidatos.filter(r => !existentesSet.has(r));

      // ÚNICAMENTE auto-crear si el colegio pertenece oficialmente al catálogo oficial SLEP.
      // NUNCA auto-crear colegios con nombres genéricos tipo 'ESTABLECIMIENTO RBD...' para evitar contaminación fantasma.
      const permitidosParaCrear = faltantes.filter(rbd => SLEP_VALLE_DIGUILLIN_SCHOOLS.some(s => s.rbd === rbd));

      if (permitidosParaCrear.length > 0) {
        const nuevosEstablecimientos: Establecimiento[] = permitidosParaCrear.map(rbd => {
          const info = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === rbd)!;
          return {
            id: `est-${rbd}`,
            rbd,
            nombre: info.nombre,
            comuna: info.comuna || 'Chillán',
            regimen: 'JEC',
            porcentajePrioritarios: 75.0,
            director: info.director || undefined,
            asesorUatp: 'UATP SLEP Valle Diguillín'
          };
        });

        await this.guardarEstablecimientosBatch(nuevosEstablecimientos);
      }
    } catch (err) {
      console.warn('[SupabaseDotacionService] Error asegurando establecimientos:', err);
    }
  }

  // Establecimientos
  static async guardarEstablecimiento(est: Establecimiento): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase
      .from('establecimientos')
      .upsert(mapEstablecimientoToDb(est), { onConflict: 'rbd' });
    if (error) {
      console.error('Error Supabase guardarEstablecimiento:', error);
      throw new Error(`Error Supabase guardarEstablecimiento: ${error.message}`);
    }
  }

  static async guardarEstablecimientosBatch(establecimientos: Establecimiento[]): Promise<void> {
    if (!isSupabaseEnabled() || !establecimientos.length) return;
    const chunkSize = 250;
    for (let i = 0; i < establecimientos.length; i += chunkSize) {
      const chunk = establecimientos.slice(i, i + chunkSize).map(mapEstablecimientoToDb);
      const { error } = await supabase
        .from('establecimientos')
        .upsert(chunk, { onConflict: 'rbd' });
      if (error) {
        console.error('Error Supabase guardarEstablecimientosBatch:', error);
        throw new Error(`Error Supabase guardarEstablecimientosBatch: ${error.message}`);
      }
    }
  }

  static async obtenerEstablecimientos(): Promise<Establecimiento[]> {
    if (!isSupabaseEnabled()) return [];
    try {
      const rows = await this.fetchAllRows('establecimientos', q => q.order('nombre'));
      const { listarRbdsEliminados } = await import('../database/repositories/establecimientosRepo');
      const eliminados = await listarRbdsEliminados();
      return rows
        .map(mapEstablecimientoFromDb)
        .filter(e => !eliminados.has(e.rbd));
    } catch (error) {
      console.error('Error Supabase obtenerEstablecimientos:', error);
      return [];
    }
  }

  static async eliminarEstablecimiento(rbd: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const clean = rbd.replace(/^est-/, '').trim();

    // 1. Registrar en lista de eliminados en Supabase para sincronización inter-usuarios
    try {
      await supabase.from('establecimientos_eliminados').upsert({
        rbd: clean,
        eliminado_por: 'Super Usuario',
        fecha: new Date().toISOString()
      }, { onConflict: 'rbd' });
    } catch {}

    // 2. Cascada relacional en Supabase para evitar errores de claves foráneas o datos huérfanos
    try {
      await Promise.allSettled([
        supabase.from('asignaciones_horarias').delete().eq('rbd', clean),
        supabase.from('asistentes_educacion').delete().eq('rbd', clean),
        supabase.from('docentes').delete().eq('rbd', clean),
        supabase.from('cursos_sae').delete().eq('rbd', clean),
        supabase.from('salas_infraestructura').delete().eq('rbd', clean),
        supabase.from('cartera_asesorias').delete().eq('rbd', clean)
      ]);
    } catch (errCascade) {
      console.warn('[SupabaseDotacionService] Aviso cascada al eliminar establecimiento:', errCascade);
    }

    // 3. Eliminar establecimiento
    const { error } = await supabase.from('establecimientos').delete().eq('rbd', clean);
    if (error) console.error('Error Supabase eliminarEstablecimiento:', error);
  }

  // Salas
  static async guardarSala(sala: SalaInfraestructura): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await this.asegurarEstablecimientosExisten([sala.rbd]);
    const { error } = await supabase.from('salas_infraestructura').upsert(mapSalaToDb(sala), { onConflict: 'id' });
    if (error) {
      console.error('Error Supabase guardarSala:', error);
      throw new Error(`Error Supabase guardarSala: ${error.message}`);
    }
  }

  static async eliminarSala(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase.from('salas_infraestructura').delete().eq('id', id);
    if (error) console.error('Error Supabase eliminarSala:', error);
  }

  // Cursos
  static async guardarCurso(curso: CursoSae): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await this.asegurarEstablecimientosExisten([curso.rbd]);
    const { error } = await supabase.from('cursos_sae').upsert(mapCursoToDb(curso), { onConflict: 'id' });
    if (error) {
      console.error('Error Supabase guardarCurso:', error);
      throw new Error(`Error Supabase guardarCurso: ${error.message}`);
    }
  }

  static async guardarCursosBatch(cursos: CursoSae[]): Promise<void> {
    if (!isSupabaseEnabled() || !cursos.length) return;
    await this.asegurarEstablecimientosExisten(cursos.map(c => c.rbd));
    const chunkSize = 250;
    for (let i = 0; i < cursos.length; i += chunkSize) {
      const chunk = cursos.slice(i, i + chunkSize).map(mapCursoToDb);
      const { error } = await supabase.from('cursos_sae').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error('Error Supabase guardarCursosBatch:', error);
        throw new Error(`Error Supabase guardarCursosBatch: ${error.message}`);
      }
    }
  }

  static async eliminarCurso(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase.from('cursos_sae').delete().eq('id', id);
    if (error) console.error('Error Supabase eliminarCurso:', error);
  }

  // Docentes
  static async guardarDocente(docente: Docente): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await this.asegurarEstablecimientosExisten([docente.rbd]);

    const payload = mapDocenteToDb(docente, this.soportaColumnaRequiereAutorizacion);
    const { error } = await supabase.from('docentes').upsert(payload, { onConflict: 'id' });

    if (error) {
      if (error.code === 'PGRST204' && String(error.message || '').includes('requiere_autorizacion_docente')) {
        this.soportaColumnaRequiereAutorizacion = false;
        const retryPayload = mapDocenteToDb(docente, false);
        const retry = await supabase.from('docentes').upsert(retryPayload, { onConflict: 'id' });
        if (retry.error) {
          console.error('[SupabaseDotacionService] Error reintentando guardarDocente:', retry.error);
          throw new Error(`Error Supabase guardarDocente: ${retry.error.message}`);
        }
        return;
      }
      console.error('[SupabaseDotacionService] Error guardarDocente:', error);
      throw new Error(`Error Supabase guardarDocente: ${error.message}`);
    }
  }

  static async guardarDocentesBatch(docentesEntrada: Docente[]): Promise<void> {
    if (!isSupabaseEnabled() || !docentesEntrada.length) return;
    const docentes = deduplicarPorId(docentesEntrada);
    await this.asegurarEstablecimientosExisten(docentes.map(d => d.rbd));

    const chunkSize = 250;
    for (let i = 0; i < docentes.length; i += chunkSize) {
      const slice = docentes.slice(i, i + chunkSize);
      let chunk = slice.map(d => mapDocenteToDb(d, this.soportaColumnaRequiereAutorizacion));
      const { error } = await supabase.from('docentes').upsert(chunk, { onConflict: 'id' });

      if (error) {
        if (error.code === 'PGRST204' && String(error.message || '').includes('requiere_autorizacion_docente')) {
          this.soportaColumnaRequiereAutorizacion = false;
          chunk = slice.map(d => mapDocenteToDb(d, false));
          const retry = await supabase.from('docentes').upsert(chunk, { onConflict: 'id' });
          if (retry.error) {
            console.error('[SupabaseDotacionService] Error reintentando guardarDocentesBatch:', retry.error);
            throw new Error(`Error Supabase guardarDocentesBatch: ${retry.error.message}`);
          }
        } else {
          console.error('[SupabaseDotacionService] Error guardarDocentesBatch:', error);
          throw new Error(`Error Supabase guardarDocentesBatch: ${error.message}`);
        }
      }
    }
  }

  static async eliminarDocente(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase.from('docentes').delete().eq('id', id);
    if (error) console.error('Error Supabase eliminarDocente:', error);
  }

  // Asignaciones Horarias
  static async guardarAsignacion(asignacion: AsignacionHoraria): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await this.asegurarEstablecimientosExisten([asignacion.rbd]);
    const { error } = await supabase.from('asignaciones_horarias').upsert(mapAsignacionToDb(asignacion), { onConflict: 'id' });
    if (error) {
      console.error('Error Supabase guardarAsignacion:', error);
      throw new Error(`Error Supabase guardarAsignacion: ${error.message}`);
    }
  }

  static async guardarAsignacionesBatch(asignaciones: AsignacionHoraria[]): Promise<void> {
    if (!isSupabaseEnabled() || !asignaciones.length) return;
    await this.asegurarEstablecimientosExisten(asignaciones.map(a => a.rbd));
    const chunkSize = 250;
    for (let i = 0; i < asignaciones.length; i += chunkSize) {
      const chunk = asignaciones.slice(i, i + chunkSize).map(mapAsignacionToDb);
      const { error } = await supabase.from('asignaciones_horarias').upsert(chunk, { onConflict: 'id' });
      if (error) {
        console.error('Error Supabase guardarAsignacionesBatch:', error);
        throw new Error(`Error Supabase guardarAsignacionesBatch: ${error.message}`);
      }
    }
  }

  static async eliminarAsignacion(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase.from('asignaciones_horarias').delete().eq('id', id);
    if (error) console.error('Error Supabase eliminarAsignacion:', error);
  }

  // Asistentes de la Educación
  static async guardarAsistente(asistente: AsistenteEducacion): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await this.asegurarEstablecimientosExisten([asistente.rbd]);
    let { error } = await supabase.from('asistentes_educacion').upsert(this.payloadAsistente(asistente), { onConflict: 'id' });
    if (error && this.soportaColumnaHonorarios && this.esErrorColumnaHonorarios(error)) {
      console.warn('[SupabaseDotacionService] Columna horas_honorarios ausente en Supabase. Aplique la migración 20261102182500_add_horas_honorarios.sql. Reintentando sin la columna.');
      this.soportaColumnaHonorarios = false;
      ({ error } = await supabase.from('asistentes_educacion').upsert(this.payloadAsistente(asistente), { onConflict: 'id' }));
    }
    if (error) {
      console.error('Error Supabase guardarAsistente:', error);
      throw new Error(`Error Supabase guardarAsistente: ${error.message}`);
    }
  }

  static async guardarAsistentesBatch(asistentesEntrada: AsistenteEducacion[]): Promise<void> {
    if (!isSupabaseEnabled() || !asistentesEntrada.length) return;
    const asistentes = deduplicarPorId(asistentesEntrada);
    await this.asegurarEstablecimientosExisten(asistentes.map(a => a.rbd));
    const chunkSize = 250;
    for (let i = 0; i < asistentes.length; i += chunkSize) {
      const slice = asistentes.slice(i, i + chunkSize);
      let { error } = await supabase.from('asistentes_educacion').upsert(slice.map(a => this.payloadAsistente(a)), { onConflict: 'id' });
      if (error && this.soportaColumnaHonorarios && this.esErrorColumnaHonorarios(error)) {
        console.warn('[SupabaseDotacionService] Columna horas_honorarios ausente en Supabase. Aplique la migración 20261102182500_add_horas_honorarios.sql. Reintentando sin la columna.');
        this.soportaColumnaHonorarios = false;
        ({ error } = await supabase.from('asistentes_educacion').upsert(slice.map(a => this.payloadAsistente(a)), { onConflict: 'id' }));
      }
      if (error) {
        console.error('Error Supabase guardarAsistentesBatch:', error);
        throw new Error(`Error Supabase guardarAsistentesBatch: ${error.message}`);
      }
    }
  }

  static async eliminarAsistente(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase.from('asistentes_educacion').delete().eq('id', id);
    if (error) console.error('Error Supabase eliminarAsistente:', error);
  }

  static async limpiarAsignacionesDeColegio(rbd: string, periodo: number = 2027): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const cleanRbd = rbd.trim();
    await supabase
      .from('asignaciones_horarias')
      .delete()
      .eq('rbd', cleanRbd)
      .eq('periodo', periodo);
  }

  static async eliminarAsistentesColegioPeriodo(rbd: string, periodo: number = 2027): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const cleanRbd = rbd.trim();
    await supabase
      .from('asistentes_educacion')
      .delete()
      .eq('rbd', cleanRbd)
      .eq('periodo', periodo);
  }

  static async borrarDotacionPeriodo(periodo: number, rbd?: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    let qAsig = supabase.from('asignaciones_horarias').delete().eq('periodo', periodo);
    let qCur = supabase.from('cursos_sae').delete().eq('periodo', periodo);
    let qDoc = supabase.from('docentes').delete().eq('periodo', periodo);
    let qAst = supabase.from('asistentes_educacion').delete().eq('periodo', periodo);

    if (rbd) {
      const cleanRbd = rbd.trim();
      qAsig = qAsig.eq('rbd', cleanRbd);
      qCur = qCur.eq('rbd', cleanRbd);
      qDoc = qDoc.eq('rbd', cleanRbd);
      qAst = qAst.eq('rbd', cleanRbd);
    }

    await qAsig;
    await qCur;
    await qDoc;
    await qAst;
  }

  /**
   * Obtiene la dotación completa de un RBD y Periodo desde Supabase
   */
  static async obtenerDotacionColegio(rbd: string, periodo: number = 2027) {
    if (!isSupabaseEnabled()) {
      return { establecimiento: null, cursos: [], docentes: [], asignaciones: [], asistentes: [] };
    }
    const cleanRbd = rbd.trim();

    const [estRes, cursosRows, docRows, asigRows, astRows] = await Promise.all([
      supabase.from('establecimientos').select('*').eq('rbd', cleanRbd).maybeSingle(),
      this.fetchAllRows('cursos_sae', q => q.eq('rbd', cleanRbd).eq('periodo', periodo)),
      this.fetchAllRows('docentes', q => q.eq('rbd', cleanRbd).eq('periodo', periodo)),
      this.fetchAllRows('asignaciones_horarias', q => q.eq('rbd', cleanRbd).eq('periodo', periodo)),
      this.fetchAllRows('asistentes_educacion', q => q.eq('rbd', cleanRbd).eq('periodo', periodo))
    ]);

    return {
      establecimiento: estRes.data ? mapEstablecimientoFromDb(estRes.data) : null,
      cursos: cursosRows.map(mapCursoFromDb),
      docentes: docRows.map(mapDocenteFromDb),
      asignaciones: asigRows.map(mapAsignacionFromDb),
      asistentes: astRows.map(mapAsistenteFromDb)
    };
  }

  /**
   * Guarda y sincroniza selectivamente en Supabase los apartados específicos de un colegio,
   * permitiendo a múltiples usuarios trabajar en la misma escuela sin sobrescribir
   * el trabajo que otros realizaron en otras secciones (p. ej., un usuario en Asistentes
   * y otro en Docentes o Cursos).
   */
  static async sincronizarApartadoColegioASupabase(
    rbd: string,
    periodo: number = 2027,
    apartados: Array<'docentes' | 'asistentes' | 'cursos' | 'salas' | 'asignaciones' | 'establecimiento'>
  ): Promise<{
    establecimientoActualizado: boolean;
    salasSincronizadas: number;
    cursosSincronizados: number;
    docentesSincronizados: number;
    asignacionesSincronizadas: number;
    asistentesSincronizados: number;
  }> {
    if (!isSupabaseEnabled()) {
      throw new Error('Supabase no está configurado o no está disponible.');
    }
    const cleanRbd = rbd.trim();
    if (!cleanRbd) throw new Error('RBD de colegio inválido');

    const result = {
      establecimientoActualizado: false,
      salasSincronizadas: 0,
      cursosSincronizados: 0,
      docentesSincronizados: 0,
      asignacionesSincronizadas: 0,
      asistentesSincronizados: 0
    };

    if (apartados.includes('establecimiento')) {
      const { obtenerEstablecimientoPorRbd } = await import('../database/repositories/establecimientosRepo');
      const est = await obtenerEstablecimientoPorRbd(cleanRbd);
      if (est) {
        await this.guardarEstablecimiento(est);
        result.establecimientoActualizado = true;
      }
    }

    if (apartados.includes('salas')) {
      const { listarSalas } = await import('../database/repositories/salasRepo');
      const salas = await listarSalas(cleanRbd);
      if (salas.length) {
        for (const s of salas) {
          await this.guardarSala({ ...s, rbd: cleanRbd });
        }
      }
      result.salasSincronizadas = salas.length;
    }

    if (apartados.includes('cursos')) {
      const { listarCursos } = await import('../database/repositories/cursosRepo');
      const cursos = await listarCursos(cleanRbd, periodo);
      if (cursos.length) {
        await this.guardarCursosBatch(cursos.map(c => ({ ...c, rbd: cleanRbd, periodo })));
      }
      result.cursosSincronizados = cursos.length;
    }

    if (apartados.includes('docentes')) {
      const { listarDocentes } = await import('../database/repositories/docentesRepo');
      const docentes = await listarDocentes(cleanRbd, periodo);
      if (docentes.length) {
        await this.guardarDocentesBatch(docentes.map(d => ({ ...d, rbd: cleanRbd, periodo })));
      }
      result.docentesSincronizados = docentes.length;
    }

    if (apartados.includes('asignaciones')) {
      const { listarAsignaciones } = await import('../database/repositories/asignacionesRepo');
      const asignaciones = await listarAsignaciones(cleanRbd, periodo);
      if (asignaciones.length) {
        await this.guardarAsignacionesBatch(asignaciones.map(a => ({ ...a, rbd: cleanRbd, periodo })));
      }
      result.asignacionesSincronizadas = asignaciones.length;
    }

    if (apartados.includes('asistentes')) {
      const { listarAsistentes } = await import('../database/repositories/asistentesRepo');
      const asistentes = await listarAsistentes(cleanRbd, periodo);
      if (asistentes.length) {
        await this.guardarAsistentesBatch(asistentes.map(ast => ({ ...ast, rbd: cleanRbd, periodo })));
      }
      result.asistentesSincronizados = asistentes.length;
    }

    return result;
  }

  /**
   * Guarda y sincroniza en Supabase EXCLUSIVAMENTE la escuela/RBD activa en el periodo dado.
   * Diseñado para trabajo concurrente multi-usuario: no toca ni sobrescribe datos de otras escuelas.
   */
  static async sincronizarColegioASupabase(
    rbd: string,
    periodo: number = 2027
  ): Promise<{
    establecimientoActualizado: boolean;
    salasSincronizadas: number;
    cursosSincronizados: number;
    docentesSincronizados: number;
    asignacionesSincronizadas: number;
    asistentesSincronizados: number;
  }> {
    if (!isSupabaseEnabled()) {
      throw new Error('Supabase no está configurado o no está disponible.');
    }
    const cleanRbd = rbd.trim();
    if (!cleanRbd) throw new Error('RBD de colegio inválido');

    const { getDb } = await import('../database/dbCore');
    const { obtenerEstablecimientoPorRbd } = await import('../database/repositories/establecimientosRepo');
    const { listarSalas } = await import('../database/repositories/salasRepo');
    const { listarCursos } = await import('../database/repositories/cursosRepo');
    const { listarDocentes } = await import('../database/repositories/docentesRepo');
    const { listarAsignaciones } = await import('../database/repositories/asignacionesRepo');
    const { listarAsistentes } = await import('../database/repositories/asistentesRepo');

    // 1. Obtener datos locales estrictamente limitados a este RBD y Periodo
    const est = await obtenerEstablecimientoPorRbd(cleanRbd);
    const salas = await listarSalas(cleanRbd);
    const cursos = await listarCursos(cleanRbd, periodo);
    const docentes = await listarDocentes(cleanRbd, periodo);
    const asignaciones = await listarAsignaciones(cleanRbd, periodo);
    const asistentes = await listarAsistentes(cleanRbd, periodo);

    // 2. Persistir Establecimiento si existe
    if (est) {
      await this.guardarEstablecimiento(est);
    }

    // 3. Persistir Salas de esta escuela
    if (salas.length) {
      for (const s of salas) {
        await this.guardarSala({ ...s, rbd: cleanRbd });
      }
    }

    // 4. Persistir Cursos de esta escuela
    if (cursos.length) {
      await this.guardarCursosBatch(cursos.map(c => ({ ...c, rbd: cleanRbd, periodo })));
    }

    // 5. Persistir Docentes de esta escuela
    if (docentes.length) {
      await this.guardarDocentesBatch(docentes.map(d => ({ ...d, rbd: cleanRbd, periodo })));
    }

    // 6. Persistir Asignaciones Horarias de esta escuela
    if (asignaciones.length) {
      await this.guardarAsignacionesBatch(asignaciones.map(a => ({ ...a, rbd: cleanRbd, periodo })));
    }

    // 7. Persistir Asistentes de la Educación de esta escuela
    if (asistentes.length) {
      await this.guardarAsistentesBatch(asistentes.map(ast => ({ ...ast, rbd: cleanRbd, periodo })));
    }

    return {
      establecimientoActualizado: Boolean(est),
      salasSincronizadas: salas.length,
      cursosSincronizados: cursos.length,
      docentesSincronizados: docentes.length,
      asignacionesSincronizadas: asignaciones.length,
      asistentesSincronizados: asistentes.length
    };
  }

  /**
   * Descarga la dotación completa de un RBD y Periodo desde Supabase PostgreSQL
   * e hidrata de forma atómica la base de datos local SQLite (IndexedDB).
   * Opcionalmente permite filtrar solo apartados específicos para no sobrescribir
   * el trabajo local en curso de otras pestañas.
   */
  static async descargarEIntegrarColegioDesdeSupabase(
    rbd: string,
    periodo: number = 2027,
    apartados?: Array<'docentes' | 'asistentes' | 'cursos' | 'salas' | 'asignaciones' | 'establecimiento'>
  ): Promise<{
    hayDatosRemotos: boolean;
    establecimientoActualizado: boolean;
    salasDescargadas: number;
    cursosDescargados: number;
    docentesDescargados: number;
    asignacionesDescargadas: number;
    asistentesDescargados: number;
  }> {
    if (!isSupabaseEnabled()) {
      return {
        hayDatosRemotos: false,
        establecimientoActualizado: false,
        salasDescargadas: 0,
        cursosDescargados: 0,
        docentesDescargados: 0,
        asignacionesDescargadas: 0,
        asistentesDescargados: 0
      };
    }
    const cleanRbd = rbd.trim();
    if (!cleanRbd) throw new Error('RBD de colegio inválido');

    // Verificar si el colegio fue eliminado por el Super Usuario para no re-descargarlo
    const { esRbdEliminado } = await import('../database/repositories/establecimientosRepo');
    if (await esRbdEliminado(cleanRbd)) {
      console.log(`[SupabaseDotacionService] Omitiendo descarga de colegio eliminado: ${cleanRbd}`);
      return {
        hayDatosRemotos: false,
        establecimientoActualizado: false,
        salasDescargadas: 0,
        cursosDescargados: 0,
        docentesDescargados: 0,
        asignacionesDescargadas: 0,
        asistentesDescargados: 0
      };
    }

    const incluyeTodos = !apartados || apartados.length === 0;
    const fetchEst = incluyeTodos || apartados.includes('establecimiento');
    const fetchSalas = incluyeTodos || apartados.includes('salas');
    const fetchCursos = incluyeTodos || apartados.includes('cursos');
    const fetchDoc = incluyeTodos || apartados.includes('docentes');
    const fetchAsig = incluyeTodos || apartados.includes('asignaciones');
    const fetchAst = incluyeTodos || apartados.includes('asistentes');

    // 1. Consultar datos en Supabase según los apartados solicitados
    const [estRes, salasData, cursosData, docData, asigData, astData] = await Promise.all([
      fetchEst ? supabase.from('establecimientos').select('*').eq('rbd', cleanRbd).maybeSingle() : Promise.resolve({ data: null }),
      fetchSalas ? this.fetchAllRows('salas_infraestructura', q => q.eq('rbd', cleanRbd)) : Promise.resolve([]),
      fetchCursos ? this.fetchAllRows('cursos_sae', q => q.eq('rbd', cleanRbd).eq('periodo', periodo)) : Promise.resolve([]),
      fetchDoc ? this.fetchAllRows('docentes', q => q.eq('rbd', cleanRbd).eq('periodo', periodo)) : Promise.resolve([]),
      fetchAsig ? this.fetchAllRows('asignaciones_horarias', q => q.eq('rbd', cleanRbd).eq('periodo', periodo)) : Promise.resolve([]),
      fetchAst ? this.fetchAllRows('asistentes_educacion', q => q.eq('rbd', cleanRbd).eq('periodo', periodo)) : Promise.resolve([])
    ]);

    const tieneRegistros = Boolean(
      cursosData.length > 0 ||
      docData.length > 0 ||
      asigData.length > 0 ||
      astData.length > 0 ||
      salasData.length > 0
    );

    if (!tieneRegistros && !estRes.data) {
      return {
        hayDatosRemotos: false,
        establecimientoActualizado: false,
        salasDescargadas: 0,
        cursosDescargados: 0,
        docentesDescargados: 0,
        asignacionesDescargadas: 0,
        asistentesDescargados: 0
      };
    }

    // 2. Importar repositorios locales
    const { guardarEstablecimiento } = await import('../database/repositories/establecimientosRepo');
    const { guardarSalasBatch } = await import('../database/repositories/salasRepo');
    const { guardarCursosBatch } = await import('../database/repositories/cursosRepo');
    const { guardarDocentesBatch } = await import('../database/repositories/docentesRepo');
    const { guardarAsignacionesBatch } = await import('../database/repositories/asignacionesRepo');
    const { guardarAsistentesBatch } = await import('../database/repositories/asistentesRepo');
    const { getDb, persistDb } = await import('../database/dbCore');
    const db = await getDb();

    // 3. Integrar Establecimiento (skipCloudSync = true para evitar bucles de re-subida)
    let estActualizado = false;
    if (fetchEst && estRes.data) {
      const estObj = mapEstablecimientoFromDb(estRes.data);
      await guardarEstablecimiento(estObj, true);
      estActualizado = true;
    }

    // 4. Integrar Salas con Diff & Prune (eliminar de SQLite salas que ya no existan en Supabase)
    let salasCount = 0;
    if (fetchSalas) {
      const remoteSalaIds = salasData.map(r => r.id).filter(Boolean);
      if (remoteSalaIds.length > 0) {
        const placeholders = remoteSalaIds.map(() => '?').join(',');
        db.run(`DELETE FROM salas_infraestructura WHERE rbd = ? AND id NOT IN (${placeholders})`, [cleanRbd, ...remoteSalaIds]);
      } else {
        db.run('DELETE FROM salas_infraestructura WHERE rbd = ?', [cleanRbd]);
      }
      if (salasData.length > 0) {
        const salasObj = salasData.map(mapSalaFromDb);
        await guardarSalasBatch(salasObj, true);
        salasCount = salasObj.length;
      }
    }

    // 5. Integrar Cursos con Diff & Prune (eliminar de SQLite cursos que ya no existan en Supabase)
    let cursosCount = 0;
    if (fetchCursos) {
      const remoteCursoIds = cursosData.map(r => r.id).filter(Boolean);
      if (remoteCursoIds.length > 0) {
        const placeholders = remoteCursoIds.map(() => '?').join(',');
        db.run(`DELETE FROM cursos_sae WHERE rbd = ? AND periodo = ? AND id NOT IN (${placeholders})`, [cleanRbd, periodo, ...remoteCursoIds]);
      } else {
        db.run('DELETE FROM cursos_sae WHERE rbd = ? AND periodo = ?', [cleanRbd, periodo]);
      }
      if (cursosData.length > 0) {
        const cursosObj = cursosData.map(mapCursoFromDb);
        await guardarCursosBatch(cursosObj, true);
        cursosCount = cursosObj.length;
      }
    }

    // 6. Integrar Docentes con Diff & Prune (eliminar de SQLite docentes que ya no existan en Supabase)
    let docCount = 0;
    if (fetchDoc) {
      const remoteDocIds = docData.map(r => r.id).filter(Boolean);
      if (remoteDocIds.length > 0) {
        const placeholders = remoteDocIds.map(() => '?').join(',');
        db.run(`DELETE FROM docentes WHERE rbd = ? AND periodo = ? AND id NOT IN (${placeholders})`, [cleanRbd, periodo, ...remoteDocIds]);
      } else {
        db.run('DELETE FROM docentes WHERE rbd = ? AND periodo = ?', [cleanRbd, periodo]);
      }
      if (docData.length > 0) {
        const docentesObj = docData.map(mapDocenteFromDb);
        await guardarDocentesBatch(docentesObj, true);
        docCount = docentesObj.length;
      }
    }

    // 7. Integrar Asignaciones con Diff & Prune (eliminar de SQLite asignaciones que ya no existan en Supabase)
    let asigCount = 0;
    if (fetchAsig) {
      const remoteAsigIds = asigData.map(r => r.id).filter(Boolean);
      if (remoteAsigIds.length > 0) {
        const placeholders = remoteAsigIds.map(() => '?').join(',');
        db.run(`DELETE FROM asignaciones_horarias WHERE rbd = ? AND periodo = ? AND id NOT IN (${placeholders})`, [cleanRbd, periodo, ...remoteAsigIds]);
      } else {
        db.run('DELETE FROM asignaciones_horarias WHERE rbd = ? AND periodo = ?', [cleanRbd, periodo]);
      }
      if (asigData.length > 0) {
        const asigsObj = asigData.map(mapAsignacionFromDb);
        await guardarAsignacionesBatch(asigsObj, true);
        asigCount = asigsObj.length;
      }
    }

    // 8. Integrar Asistentes (con reemplazar = true que ya ejecuta su propia purga)
    let astCount = 0;
    if (fetchAst) {
      if (astData.length > 0) {
        const asistentesObj = astData.map(mapAsistenteFromDb);
        await guardarAsistentesBatch(asistentesObj, cleanRbd, periodo, true);
        astCount = asistentesObj.length;
      } else {
        db.run('DELETE FROM asistentes_educacion WHERE rbd = ? AND periodo = ?', [cleanRbd, periodo]);
      }
    }

    // Persistir estado consolidado en IndexedDB
    await persistDb(true);

    return {
      hayDatosRemotos: true,
      establecimientoActualizado: estActualizado,
      salasDescargadas: salasCount,
      cursosDescargados: cursosCount,
      docentesDescargados: docCount,
      asignacionesDescargadas: asigCount,
      asistentesDescargados: astCount
    };
  }

  /**
   * Descarga la cartera territorial completa (todos los establecimientos y dotación del periodo)
   * desde Supabase PostgreSQL e hidrata la base de datos local SQLite.
   * Crucial para que el Consolidador Master, Estadísticas y Cartera muestren la realidad centralizada.
   */
  static async descargarTodaLaCarteraDesdeSupabase(periodo: number = 2027): Promise<{
    hayDatosRemotos: boolean;
    establecimientosDescargados: number;
    salasDescargadas: number;
    cursosDescargados: number;
    docentesDescargados: number;
    asignacionesDescargadas: number;
    asistentesDescargados: number;
  }> {
    if (!isSupabaseEnabled()) {
      return {
        hayDatosRemotos: false,
        establecimientosDescargados: 0,
        salasDescargadas: 0,
        cursosDescargados: 0,
        docentesDescargados: 0,
        asignacionesDescargadas: 0,
        asistentesDescargados: 0
      };
    }

    const [estRows, salasRows, cursosRows, docRows, asigRows, astRows] = await Promise.all([
      this.fetchAllRows('establecimientos', q => q.order('nombre')),
      this.fetchAllRows('salas_infraestructura'),
      this.fetchAllRows('cursos_sae', q => q.eq('periodo', periodo)),
      this.fetchAllRows('docentes', q => q.eq('periodo', periodo)),
      this.fetchAllRows('asignaciones_horarias', q => q.eq('periodo', periodo)),
      this.fetchAllRows('asistentes_educacion', q => q.eq('periodo', periodo))
    ]);

    const hayDatos = Boolean(
      estRows.length > 0 ||
      cursosRows.length > 0 ||
      docRows.length > 0
    );

    if (!hayDatos) {
      return {
        hayDatosRemotos: false,
        establecimientosDescargados: 0,
        salasDescargadas: 0,
        cursosDescargados: 0,
        docentesDescargados: 0,
        asignacionesDescargadas: 0,
        asistentesDescargados: 0
      };
    }

    const { listarRbdsEliminados, registrarRbdEliminado, guardarEstablecimiento } = await import('../database/repositories/establecimientosRepo');
    const { guardarSala } = await import('../database/repositories/salasRepo');
    const { guardarCurso } = await import('../database/repositories/cursosRepo');
    const { guardarDocentesBatch } = await import('../database/repositories/docentesRepo');
    const { guardarAsignacionesBatch } = await import('../database/repositories/asignacionesRepo');
    const { guardarAsistentesBatch } = await import('../database/repositories/asistentesRepo');
    const { persistDb } = await import('../database/dbCore');

    // 1. Sincronizar lista de colegios eliminados para mantener consistencia inter-usuarios
    let eliminadosRemotos: string[] = [];
    try {
      const { data: delData } = await supabase.from('establecimientos_eliminados').select('rbd');
      if (delData && delData.length) {
        eliminadosRemotos = delData.map(d => String(d.rbd).trim());
      }
    } catch {}

    const eliminadosSet = await listarRbdsEliminados();
    for (const remRbd of eliminadosRemotos) {
      if (remRbd) {
        eliminadosSet.add(remRbd);
        await registrarRbdEliminado(remRbd, 'Sincronizacion Remota');
      }
    }

    let estCount = 0;
    if (estRows.length > 0) {
      for (const row of estRows) {
        const rbdClean = String(row.rbd || '').trim();
        // Omitir colegios eliminados por el Super Usuario
        if (eliminadosSet.has(rbdClean)) continue;

        // Omitir nombres fantasma/sintéticos huérfanos que comiencen con "ESTABLECIMIENTO RBD" y no estén en el catálogo oficial
        if (row.nombre && String(row.nombre).startsWith('ESTABLECIMIENTO RBD') && !SLEP_VALLE_DIGUILLIN_SCHOOLS.some(s => s.rbd === rbdClean)) {
          continue;
        }

        await guardarEstablecimiento(mapEstablecimientoFromDb(row), true);
        estCount++;
      }
    }

    let salasCount = 0;
    if (salasRows.length > 0) {
      for (const row of salasRows) {
        const rbdClean = String(row.rbd || '').trim();
        if (eliminadosSet.has(rbdClean)) continue;
        await guardarSala(mapSalaFromDb(row), true);
        salasCount++;
      }
    }

    let cursosCount = 0;
    if (cursosRows.length > 0) {
      for (const row of cursosRows) {
        const rbdClean = String(row.rbd || '').trim();
        if (eliminadosSet.has(rbdClean)) continue;
        await guardarCurso(mapCursoFromDb(row), true);
        cursosCount++;
      }
    }

    let docCount = 0;
    if (docRows.length > 0) {
      const docentes = docRows
        .filter(r => !eliminadosSet.has(String(r.rbd || '').trim()))
        .map(mapDocenteFromDb);
      if (docentes.length > 0) {
        await guardarDocentesBatch(docentes);
        docCount = docentes.length;
      }
    }

    let asigCount = 0;
    if (asigRows.length > 0) {
      const asignaciones = asigRows
        .filter(r => !eliminadosSet.has(String(r.rbd || '').trim()))
        .map(mapAsignacionFromDb);
      if (asignaciones.length > 0) {
        await guardarAsignacionesBatch(asignaciones);
        asigCount = asignaciones.length;
      }
    }

    let astCount = 0;
    if (astRows.length > 0) {
      const asistentes = astRows
        .filter(r => !eliminadosSet.has(String(r.rbd || '').trim()))
        .map(mapAsistenteFromDb);
      if (asistentes.length > 0) {
        await guardarAsistentesBatch(asistentes, undefined, periodo, false);
        astCount = asistentes.length;
      }
    }

    await persistDb(true);

    return {
      hayDatosRemotos: true,
      establecimientosDescargados: estCount,
      salasDescargadas: salasCount,
      cursosDescargados: cursosCount,
      docentesDescargados: docCount,
      asignacionesDescargadas: asigCount,
      asistentesDescargados: astCount
    };
  }

  /**
   * Sincroniza y vuelca toda la base de datos local SQLite y catálogo de directores hacia Supabase
   */
  static async sincronizarTodaLaBaseDeDatosASupabase(): Promise<{
    establecimientosSincronizados: number;
    cursosSincronizados: number;
    docentesSincronizados: number;
    asignacionesSincronizados: number;
    asistentesSincronizados: number;
    salasSincronizadas: number;
    usuariosSincronizados: number;
  }> {
    if (!isSupabaseEnabled()) {
      throw new Error('Supabase no está configurado o no está disponible.');
    }

    const { getDb } = await import('../database/dbCore');
    const { listarEstablecimientos, listarRbdsEliminados } = await import('../database/repositories/establecimientosRepo');
    const { listarTodasLasSalas } = await import('../database/repositories/salasRepo');
    const { listarTodosLosCursos } = await import('../database/repositories/cursosRepo');
    const { listarTodosLosDocentesTerritorio } = await import('../database/repositories/docentesRepo');
    const { listarTodasLasAsignaciones } = await import('../database/repositories/asignacionesRepo');
    const { listarTodosLosAsistentesTerritorio } = await import('../database/repositories/asistentesRepo');
    const { listarUsuariosDb } = await import('../database/repositories/usuariosRepo');

    const eliminados = await listarRbdsEliminados();
    const establecimientos = (await listarEstablecimientos()).filter(e => !eliminados.has(e.rbd.trim()));
    const salas = await listarTodasLasSalas();
    const todosCursos = await listarTodosLosCursos(2027);
    const todosDocentes = await listarTodosLosDocentesTerritorio(2027);
    const todasAsigs = await listarTodasLasAsignaciones(2027);

    const db = await getDb();
    const todosAst = await listarTodosLosAsistentesTerritorio(db, 2027);

    const usuarios = await listarUsuariosDb();

    // 0. Sincronizar lista negra de establecimientos eliminados hacia Supabase
    try {
      if (eliminados.size > 0) {
        const delPayload = Array.from(eliminados).map(r => ({
          rbd: r,
          eliminado_por: 'Super Usuario',
          fecha: new Date().toISOString()
        }));
        await supabase.from('establecimientos_eliminados').upsert(delPayload, { onConflict: 'rbd' });
      }
    } catch {}

    // 1. Establecimientos (Entidad Padre Fundamental para evitar errores de Foreign Key 23503)
    if (establecimientos.length) {
      await this.guardarEstablecimientosBatch(establecimientos);
    }

    const estRbdsValidos = new Set(establecimientos.map(e => e.rbd.trim()));

    // 2. Salas
    if (salas.length) {
      const salasValidas = salas.filter(s => estRbdsValidos.has(s.rbd.trim()));
      for (const s of salasValidas) {
        await this.guardarSala(s);
      }
    }

    // 3. Cursos (Filtrados por RBD válido en establecimientos)
    const cursosValidos = todosCursos.filter(c => estRbdsValidos.has(c.rbd.trim()));
    if (cursosValidos.length) {
      await this.guardarCursosBatch(cursosValidos);
    }

    // 4. Docentes (Filtrados por RBD válido en establecimientos)
    const docentesValidos = todosDocentes.filter(d => estRbdsValidos.has(d.rbd.trim()));
    if (docentesValidos.length) {
      await this.guardarDocentesBatch(docentesValidos);
    }

    // 5. Asignaciones Horarias (Filtradas con integridad referencial completa RBD + Curso + Docente)
    const cursoIdsValidos = new Set(cursosValidos.map(c => c.id));
    const docenteIdsValidos = new Set(docentesValidos.map(d => d.id));
    const asigsValidas = todasAsigs.filter(a =>
      estRbdsValidos.has(a.rbd.trim()) &&
      cursoIdsValidos.has(a.cursoId) &&
      docenteIdsValidos.has(a.docenteId)
    );
    if (asigsValidas.length) {
      await this.guardarAsignacionesBatch(asigsValidas);
    }

    // 6. Asistentes de la Educación
    const astValidos = todosAst.filter(a => estRbdsValidos.has(a.rbd.trim()));
    if (astValidos.length) {
      await this.guardarAsistentesBatch(astValidos);
    }

    // 7. Usuarios (Sanitizando duplicados de correo para evitar 23505)
    if (usuarios.length) {
      const seenEmails = new Set<string>();
      const usersDb = usuarios.map(u => {
        let emailVal = u.email ? u.email.trim().toLowerCase() : null;
        if (emailVal && seenEmails.has(emailVal)) {
          emailVal = null;
        } else if (emailVal) {
          seenEmails.add(emailVal);
        }
        return {
          id: u.id,
          username: u.username || u.email || u.id,
          email: emailVal,
          nombre_completo: u.nombreCompleto,
          role: u.role,
          cargo: u.cargo || null,
          rbd_asignado: u.rbdAsignado || null,
          cartera_rbds_json: JSON.stringify(u.carteraRbds || []),
          asesores_supervisados_json: JSON.stringify(u.asesoresSupervisados || []),
          comunas_permitidas_json: JSON.stringify(u.comunasPermitidas || []),
          password_hash: u.passwordHash || null,
          salt: u.salt || null,
          gemini_api_key: u.geminiApiKey || null,
          activo: u.activo !== false,
          debe_cambiar_password: u.debeCambiarPassword ?? false
        };
      });
      await supabase.from('usuarios_sistema').upsert(usersDb, { onConflict: 'id' });
    }

    return {
      establecimientosSincronizados: establecimientos.length,
      salasSincronizadas: salas.length,
      cursosSincronizados: cursosValidos.length,
      docentesSincronizados: docentesValidos.length,
      asignacionesSincronizados: asigsValidas.length,
      asistentesSincronizados: astValidos.length,
      usuariosSincronizados: usuarios.length
    };
  }
}
