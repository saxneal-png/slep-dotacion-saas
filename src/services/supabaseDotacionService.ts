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
    periodo: curso.periodo || 2026,
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
    periodo: Number(row.periodo || 2026),
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

export function mapDocenteToDb(docente: Docente) {
  return {
    id: docente.id,
    rbd: docente.rbd.trim(),
    periodo: docente.periodo || 2026,
    run: docente.run,
    nombres: docente.nombres,
    apellidos: docente.apellidos,
    titulo: docente.titulo || null,
    calidad_juridica: docente.calidadJuridica || 'TITULAR',
    estamento: docente.estamento || 'DOCENTE_AULA',
    horas_contrato: Math.max(1, Math.min(44, Number(docente.horasContrato || 44))),
    horas_subvencion_general_titular: docente.horasSubvencionGeneralTitular || 0,
    horas_subvencion_general_contrata: docente.horasSubvencionGeneralContrata || 0,
    horas_sep_titular: docente.horasSepTitular || 0,
    horas_sep_contrata: docente.horasSepContrata || 0,
    horas_pie_titular: docente.horasPieTitular || 0,
    horas_pie_contrata: docente.horasPieContrata || 0,
    horas_directivas: docente.horasDirectivas || 0,
    horas_inspector_general: docente.horasInspectorGeneral || 0,
    horas_tecnico_pedagogica: docente.horasTecnicoPedagogicas || 0,
    horas_coordinacion: docente.horasCoordinacion || 0,
    tipo_coordinacion: docente.tipoCoordinacion || null,
    horas_taller_sep: docente.horasTallerSep || 0,
    horas_trabajo_colaborativo: docente.horasTrabajoColaborativo || 0,
    horas_coordinacion_pie: docente.horasCoordinacionPie || 0,
    horas_convivencia_escolar: docente.horasConvivenciaEscolar || 0,
    horas_extraescolar: docente.horasExtraescolar || 0,
    cargo_institucional: docente.cargoInstitucional || null,
    horas_aula: docente.horasAula || 0,
    horas_ingles: docente.horasIngles || 0,
    funcion_principal: docente.funcionPrincipal || null,
    funcion_secundaria: docente.funcionSecundaria || null,
    asignatura_principal: docente.asignaturaPrincipal || null,
    aplica_articulo_69: Boolean(docente.aplicaArticulo69),
    funciones_no_aula_json: docente.funcionesNoAula ? JSON.stringify(docente.funcionesNoAula) : '[]',
    horas_vigentes_anterior: docente.horasVigentesAnterior || 0,
    propuesta_gdp: docente.propuestaGdp || 'Continuidad',
    remuneracion_mensual_app: docente.remuneracionMensualApp || 0,
    fecha_inicio_contrato: docente.fechaInicioContrato || '2026-03-01',
    fecha_termino_contrato: docente.fechaTerminoContrato || '2027-02-28',
    accion_pme_sep: docente.accionPmeSep || null,
    horas_pro_retencion: docente.horasProRetencion || 0,
    descripcion_funcion_gdp: docente.descripcionFuncionGdp || null,
    estado_sancion_gdp: docente.estadoSancionGdp || 'Pendiente',
    horas_aprobadas_gdp: docente.horasAprobadasGdp || 0,
    situacion_final_gdp: docente.situacionFinalGdp || 'Vigente',
    observaciones_director: docente.observacionesDirector || null,
    observaciones_slep: docente.observacionesSlep || null
  };
}

export function mapDocenteFromDb(row: any): Docente {
  let funcionesNoAula: any[] = [];
  try {
    funcionesNoAula = typeof row.funciones_no_aula_json === 'string' 
      ? JSON.parse(row.funciones_no_aula_json) 
      : (row.funciones_no_aula_json || []);
  } catch (_) {}

  return {
    id: row.id,
    rbd: row.rbd,
    periodo: Number(row.periodo || 2026),
    run: row.run,
    nombres: row.nombres,
    apellidos: row.apellidos,
    titulo: row.titulo || undefined,
    calidadJuridica: row.calidad_juridica,
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
    funcionesNoAula,
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
    periodo: asig.periodo || 2026,
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
    periodo: Number(row.periodo || 2026),
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
    periodo: ast.periodo || 2026,
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
    fecha_inicio_contrato: ast.fechaInicioContrato || '2026-03-01',
    fecha_termino_contrato: ast.fechaTerminoContrato || '2027-02-28',
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
    periodo: Number(row.periodo || 2026),
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
  // Establecimientos
  static async guardarEstablecimiento(est: Establecimiento): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const { error } = await supabase
      .from('establecimientos')
      .upsert(mapEstablecimientoToDb(est), { onConflict: 'rbd' });
    if (error) console.error('Error Supabase guardarEstablecimiento:', error);
  }

  static async guardarEstablecimientosBatch(establecimientos: Establecimiento[]): Promise<void> {
    if (!isSupabaseEnabled() || !establecimientos.length) return;
    const chunkSize = 100;
    for (let i = 0; i < establecimientos.length; i += chunkSize) {
      const chunk = establecimientos.slice(i, i + chunkSize).map(mapEstablecimientoToDb);
      const { error } = await supabase
        .from('establecimientos')
        .upsert(chunk, { onConflict: 'rbd' });
      if (error) console.error('Error Supabase guardarEstablecimientosBatch:', error);
    }
  }

  static async obtenerEstablecimientos(): Promise<Establecimiento[]> {
    if (!isSupabaseEnabled()) return [];
    const { data, error } = await supabase
      .from('establecimientos')
      .select('*')
      .order('nombre');
    if (error || !data) {
      console.error('Error Supabase obtenerEstablecimientos:', error);
      return [];
    }
    return data.map(mapEstablecimientoFromDb);
  }

  static async eliminarEstablecimiento(rbd: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    const clean = rbd.replace(/^est-/, '').trim();
    await supabase.from('establecimientos').delete().eq('rbd', clean);
  }

  // Salas
  static async guardarSala(sala: SalaInfraestructura): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('salas_infraestructura').upsert(mapSalaToDb(sala), { onConflict: 'id' });
  }

  static async eliminarSala(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('salas_infraestructura').delete().eq('id', id);
  }

  // Cursos
  static async guardarCurso(curso: CursoSae): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('cursos_sae').upsert(mapCursoToDb(curso), { onConflict: 'id' });
  }

  static async guardarCursosBatch(cursos: CursoSae[]): Promise<void> {
    if (!isSupabaseEnabled() || !cursos.length) return;
    const chunkSize = 100;
    for (let i = 0; i < cursos.length; i += chunkSize) {
      const chunk = cursos.slice(i, i + chunkSize).map(mapCursoToDb);
      await supabase.from('cursos_sae').upsert(chunk, { onConflict: 'id' });
    }
  }

  static async eliminarCurso(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('cursos_sae').delete().eq('id', id);
  }

  // Docentes
  static async guardarDocente(docente: Docente): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('docentes').upsert(mapDocenteToDb(docente), { onConflict: 'id' });
  }

  static async guardarDocentesBatch(docentes: Docente[]): Promise<void> {
    if (!isSupabaseEnabled() || !docentes.length) return;
    const chunkSize = 100;
    for (let i = 0; i < docentes.length; i += chunkSize) {
      const chunk = docentes.slice(i, i + chunkSize).map(mapDocenteToDb);
      await supabase.from('docentes').upsert(chunk, { onConflict: 'id' });
    }
  }

  static async eliminarDocente(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('docentes').delete().eq('id', id);
  }

  // Asignaciones Horarias
  static async guardarAsignacion(asignacion: AsignacionHoraria): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('asignaciones_horarias').upsert(mapAsignacionToDb(asignacion), { onConflict: 'id' });
  }

  static async guardarAsignacionesBatch(asignaciones: AsignacionHoraria[]): Promise<void> {
    if (!isSupabaseEnabled() || !asignaciones.length) return;
    const chunkSize = 100;
    for (let i = 0; i < asignaciones.length; i += chunkSize) {
      const chunk = asignaciones.slice(i, i + chunkSize).map(mapAsignacionToDb);
      await supabase.from('asignaciones_horarias').upsert(chunk, { onConflict: 'id' });
    }
  }

  static async eliminarAsignacion(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('asignaciones_horarias').delete().eq('id', id);
  }

  // Asistentes de la Educación
  static async guardarAsistente(asistente: AsistenteEducacion): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('asistentes_educacion').upsert(mapAsistenteToDb(asistente), { onConflict: 'id' });
  }

  static async guardarAsistentesBatch(asistentes: AsistenteEducacion[]): Promise<void> {
    if (!isSupabaseEnabled() || !asistentes.length) return;
    const chunkSize = 100;
    for (let i = 0; i < asistentes.length; i += chunkSize) {
      const chunk = asistentes.slice(i, i + chunkSize).map(mapAsistenteToDb);
      await supabase.from('asistentes_educacion').upsert(chunk, { onConflict: 'id' });
    }
  }

  static async eliminarAsistente(id: string): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await supabase.from('asistentes_educacion').delete().eq('id', id);
  }

  /**
   * Obtiene la dotación completa de un RBD y Periodo desde Supabase
   */
  static async obtenerDotacionColegio(rbd: string, periodo: number = 2027) {
    if (!isSupabaseEnabled()) {
      return { establecimiento: null, cursos: [], docentes: [], asignaciones: [], asistentes: [] };
    }
    const cleanRbd = rbd.trim();

    const [estRes, cursosRes, docRes, asigRes, astRes] = await Promise.all([
      supabase.from('establecimientos').select('*').eq('rbd', cleanRbd).maybeSingle(),
      supabase.from('cursos_sae').select('*').eq('rbd', cleanRbd).eq('periodo', periodo),
      supabase.from('docentes').select('*').eq('rbd', cleanRbd).eq('periodo', periodo),
      supabase.from('asignaciones_horarias').select('*').eq('rbd', cleanRbd).eq('periodo', periodo),
      supabase.from('asistentes_educacion').select('*').eq('rbd', cleanRbd).eq('periodo', periodo)
    ]);

    return {
      establecimiento: estRes.data ? mapEstablecimientoFromDb(estRes.data) : null,
      cursos: (cursosRes.data || []).map(mapCursoFromDb),
      docentes: (docRes.data || []).map(mapDocenteFromDb),
      asignaciones: (asigRes.data || []).map(mapAsignacionFromDb),
      asistentes: (astRes.data || []).map(mapAsistenteFromDb)
    };
  }

  /**
   * Guarda en lote la dotación completa de un colegio en Supabase
   */
  static async guardarDotacionBatch(
    rbd: string,
    periodo: number,
    cursos: CursoSae[],
    docentes: Docente[],
    asignaciones: AsignacionHoraria[],
    asistentes: AsistenteEducacion[] = []
  ): Promise<void> {
    if (!isSupabaseEnabled()) return;
    await Promise.all([
      this.guardarCursosBatch(cursos.map(c => ({ ...c, rbd, periodo }))),
      this.guardarDocentesBatch(docentes.map(d => ({ ...d, rbd, periodo }))),
      this.guardarAsignacionesBatch(asignaciones.map(a => ({ ...a, rbd, periodo }))),
      this.guardarAsistentesBatch(asistentes.map(ast => ({ ...ast, rbd, periodo })))
    ]);
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
    const { listarEstablecimientos } = await import('../database/repositories/establecimientosRepo');
    const { listarTodasLasSalas } = await import('../database/repositories/salasRepo');
    const { listarTodosLosCursos } = await import('../database/repositories/cursosRepo');
    const { listarTodosLosDocentesTerritorio } = await import('../database/repositories/docentesRepo');
    const { listarTodasLasAsignaciones } = await import('../database/repositories/asignacionesRepo');
    const { listarTodosLosAsistentesTerritorio } = await import('../database/repositories/asistentesRepo');
    const { listarUsuariosDb } = await import('../database/repositories/usuariosRepo');

    const establecimientos = await listarEstablecimientos();
    const salas = await listarTodasLasSalas();
    const cursos2026 = await listarTodosLosCursos(2026);
    const cursos2027 = await listarTodosLosCursos(2027);
    const todosCursos = [...cursos2026, ...cursos2027.filter(c27 => !cursos2026.some(c26 => c26.id === c27.id))];

    const docentes2026 = await listarTodosLosDocentesTerritorio(2026);
    const docentes2027 = await listarTodosLosDocentesTerritorio(2027);
    const todosDocentes = [...docentes2026, ...docentes2027.filter(d27 => !docentes2026.some(d26 => d26.id === d27.id))];

    const asigs2026 = await listarTodasLasAsignaciones(2026);
    const asigs2027 = await listarTodasLasAsignaciones(2027);
    const todasAsigs = [...asigs2026, ...asigs2027.filter(a27 => !asigs2026.some(a26 => a26.id === a27.id))];

    const db = await getDb();
    const ast2026 = await listarTodosLosAsistentesTerritorio(db, 2026);
    const ast2027 = await listarTodosLosAsistentesTerritorio(db, 2027);
    const todosAst = [...ast2026, ...ast2027.filter(a27 => !ast2026.some(a26 => a26.id === a27.id))];

    const usuarios = await listarUsuariosDb();

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
          activo: u.activo !== false
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
