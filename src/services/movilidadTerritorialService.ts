/**
 * Servicio de Orquestación de Mesa de Movilidad Territorial, Egresos de Contingencia
 * y Saneamiento de Vacantes NN (SLEP Valle Diguillín).
 *
 * Aislado estrictamente para roles de Nivel Central UATP / GDP / Super Usuario.
 * Toda aritmética horaria delega al motor normativo en minutos enteros (@slep/mineduc-engine).
 */

import {
  AsignacionHoraria,
  CalidadJuridicaDocente,
  CarrilMovilidad,
  CausalEgresoDocente,
  CertezaJuridicaEgreso,
  Docente,
  EgresoProyectado,
  EscenarioCalce,
  Establecimiento,
  EstadoEscenarioCalce,
  EstadoFlujoMovilidad,
  EstamentoDocente,
  FuncionNoAulaDocente,
  ImpactoPresupuestarioEgreso,
  PropuestaCalce,
  SolicitudMovilidad,
  VacanteRebotePlan
} from '../types';
import { RolId } from '../types/authTypes';
import { esRolNivelCentral, normalizarRol } from '../security/rolesDefinitions';
import {
  calcularJornadaMinutos,
  calcularPuntajePrioridadMovilidad,
  detectarDocenteVacanteNn,
  determinarRegimenNormativo,
  EgresoProyectadoInput,
  evaluarCalceDocenteVacante,
  evaluarEgresoProyectado,
  EvaluacionJuridicaEgreso,
  FuenteFinanciamientoCalce,
  generarVacanteDeRebote,
  ResultadoDeteccionNn,
  ResultadoEvaluacionCalce,
  sugerirCalcesAutomaticos,
  VacanteObjetivoCalce,
  VacanteReboteOutput,
  DocenteCandidatoCalce
} from '@slep/mineduc-engine';
import {
  getDb,
  persistDb,
  guardarDocente,
  listarAsignaciones,
  listarDocentes,
  listarEstablecimientos,
  listarTodasLasAsignaciones,
  listarTodosLosDocentesTerritorio,
  registrarEventoAuditoria
} from '../database/db';
import { obtenerFeatureFlagsMovilidad } from './configuracionGeneralService';
import { isSupabaseEnabled, supabase } from './supabaseClient';
import { SupabaseDotacionService } from './supabaseDotacionService';
import { normalizarFuentesFinanciamientoDocente } from './auditoriaDocenteService';
import { limpiarRutParaId, normalizarRut } from '../utils/rutUtils';

export type {
  Docente,
  Establecimiento,
  EstamentoDocente,
  FuncionNoAulaDocente,
  EgresoProyectado,
  SolicitudMovilidad,
  EstadoFlujoMovilidad,
  EscenarioCalce,
  PropuestaCalce,
  VacanteRebotePlan,
  CausalEgresoDocente,
  CertezaJuridicaEgreso,
  ImpactoPresupuestarioEgreso,
  CarrilMovilidad,
  EstadoEscenarioCalce,
  RolId,
  EvaluacionJuridicaEgreso,
  ResultadoEvaluacionCalce,
  ResultadoDeteccionNn
};

// =============================================================================
// 1. Guards y Control de Acceso por Rol (RBAC)
// =============================================================================

export function esRolNivelCentralMovilidad(rol: unknown): boolean {
  return esRolNivelCentral(rol);
}

export function esRolValidadorGdp(rol: unknown): boolean {
  const norm = normalizarRol(rol);
  return norm === 'super_usuario' || norm === 'subdirector_uatp' || norm === 'gdp_validador';
}

export function esRolConsolidadorMovilidad(rol: unknown): boolean {
  const norm = normalizarRol(rol);
  return norm === 'super_usuario' || norm === 'subdirector_uatp';
}

function assertRolNivelCentral(rol: unknown, accion: string): void {
  if (!esRolNivelCentralMovilidad(rol)) {
    throw new Error(
      `Acceso denegado: el rol '${String(rol ?? '')}' no tiene permisos de nivel central para ${accion}.`
    );
  }
}

function assertRolValidadorGdp(rol: unknown, accion: string): void {
  if (!esRolValidadorGdp(rol)) {
    throw new Error(
      `Acceso denegado: solo Super Usuario, Subdirector UATP o Validador GDP pueden ${accion}.`
    );
  }
}

function assertRolConsolidador(rol: unknown, accion: string): void {
  if (!esRolConsolidadorMovilidad(rol)) {
    throw new Error(
      `Acceso denegado: solo Super Usuario o Subdirector UATP pueden ${accion}.`
    );
  }
}

// =============================================================================
// 2. Filtro Anti-Doble-Conteo de Vacantes Condicionales (PAL / GDP / Territorio)
// =============================================================================

function claveRunNormalizado(run?: string): string {
  const norm = normalizarRut(run);
  if (norm) return norm;
  return limpiarRutParaId(run);
}

function esSituacionFinalActiva(situacionFinalGdp?: string): boolean {
  const sit = (situacionFinalGdp || 'Vigente').trim().toLowerCase();
  return sit !== 'cese' && sit !== 'renuncia';
}

/**
 * Excluye vacantes condicionales cuando existe un docente titular/activo en el mismo (rbd, periodo)
 * cuya situación final GDP no sea 'Cese' ni 'Renuncia', evitando doble conteo en PAL 2027, GDP y consolidados.
 */
export function filtrarDocentesSinDobleConteoCondicional(docentes: Docente[]): {
  docentesEfectivos: Docente[];
  excluidosCondicionales: Docente[];
} {
  if (!docentes || docentes.length === 0) {
    return { docentesEfectivos: [], excluidosCondicionales: [] };
  }

  // Índice de docentes reales/activos por (rbd, periodo)
  const activosPorEscuelaPeriodo = new Map<string, Docente[]>();
  for (const d of docentes) {
    const esVacante = Boolean(d.esVacanteNn) || Boolean(d.vacanteCondicional) || d.tipoVacante === 'CONDICIONAL_EGRESO';
    if (esVacante) continue;
    if (!esSituacionFinalActiva(d.situacionFinalGdp)) continue;

    const key = `${String(d.rbd || '').trim()}__${Number(d.periodo || 2027)}`;
    const list = activosPorEscuelaPeriodo.get(key) || [];
    list.push(d);
    activosPorEscuelaPeriodo.set(key, list);
  }

  const docentesEfectivos: Docente[] = [];
  const excluidosCondicionales: Docente[] = [];

  for (const d of docentes) {
    const esCandidataCondicional = d.vacanteCondicional === true || d.tipoVacante === 'CONDICIONAL_EGRESO';
    if (!esCandidataCondicional) {
      docentesEfectivos.push(d);
      continue;
    }

    const key = `${String(d.rbd || '').trim()}__${Number(d.periodo || 2027)}`;
    const activos = activosPorEscuelaPeriodo.get(key) || [];
    const reemplazoRunNorm = claveRunNormalizado(d.reemplazoDeRun);
    const reemplazoRunClean = limpiarRutParaId(d.reemplazoDeRun);

    let tieneTitularActivo = false;
    if (reemplazoRunNorm || reemplazoRunClean) {
      tieneTitularActivo = activos.some(t => {
        if (t.id === d.id) return false;
        const tNorm = claveRunNormalizado(t.run);
        const tClean = limpiarRutParaId(t.run);
        return (
          (Boolean(reemplazoRunNorm) && tNorm === reemplazoRunNorm) ||
          (Boolean(reemplazoRunClean) && tClean === reemplazoRunClean)
        );
      });
    } else if (d.vacanteCondicional !== false) {
      // Sin RUN de reemplazo explícito, mientras siga marcada como condicional (sin cese confirmado)
      // y exista al menos un docente activo en el mismo (rbd, periodo), evita doble conteo.
      tieneTitularActivo = activos.some(t => t.id !== d.id);
    }

    if (tieneTitularActivo) {
      excluidosCondicionales.push(d);
    } else {
      docentesEfectivos.push(d);
    }
  }

  return { docentesEfectivos, excluidosCondicionales };
}

// =============================================================================
// 3. Saneamiento de Vacantes NN y Creación de Necesidad Estructurada de Escuela
// =============================================================================

export async function previsualizarEscaneoVacantesNn(
  periodo: number = 2027,
  rbd?: string
): Promise<Array<{ docente: Docente; motivos: string[]; confianza: 'ALTA' | 'MEDIA' | 'BAJA'; asignacionesCount: number }>> {
  const docentes = rbd
    ? await listarDocentes(rbd, periodo, true)
    : await listarTodosLosDocentesTerritorio(periodo);
  const asignaciones = rbd
    ? await listarAsignaciones(rbd, periodo)
    : await listarTodasLasAsignaciones(periodo);

  const countAsigPorDoc = new Map<string, number>();
  for (const a of asignaciones) {
    if (a.docenteId) {
      countAsigPorDoc.set(a.docenteId, (countAsigPorDoc.get(a.docenteId) || 0) + 1);
    }
    if (a.tieneCoDocente && a.coDocenteId && a.coDocenteId !== a.docenteId) {
      countAsigPorDoc.set(a.coDocenteId, (countAsigPorDoc.get(a.coDocenteId) || 0) + 1);
    }
  }

  const resultados: Array<{
    docente: Docente;
    motivos: string[];
    confianza: 'ALTA' | 'MEDIA' | 'BAJA';
    asignacionesCount: number;
  }> = [];

  for (const docente of docentes) {
    const deteccion = detectarDocenteVacanteNn(docente);
    if (deteccion.esVacanteNn) {
      resultados.push({
        docente,
        motivos: deteccion.motivos,
        confianza: deteccion.confianza,
        asignacionesCount: countAsigPorDoc.get(docente.id) || 0
      });
    }
  }

  const pesoConfianza: Record<'ALTA' | 'MEDIA' | 'BAJA', number> = { ALTA: 3, MEDIA: 2, BAJA: 1 };
  resultados.sort((a, b) => pesoConfianza[b.confianza] - pesoConfianza[a.confianza]);

  return resultados;
}

export async function escanearYSanearVacantesNnTerritorio(params: {
  periodo?: number;
  rbd?: string;
  rolActor: RolId;
  usuarioActor?: string;
}): Promise<{ escaneados: number; marcadosNn: number; asignacionesPreservadas: number; idsMarcados: string[] }> {
  assertRolNivelCentral(params.rolActor, 'escanear y sanear vacantes NN en el territorio');
  const periodo = params.periodo ?? 2027;

  const docentes = params.rbd
    ? await listarDocentes(params.rbd, periodo, true)
    : await listarTodosLosDocentesTerritorio(periodo);
  const asignaciones = params.rbd
    ? await listarAsignaciones(params.rbd, periodo)
    : await listarTodasLasAsignaciones(periodo);

  const candidatosActualizar: Array<{
    docente: Docente;
    tipoVacanteSugerido: 'NN_DETECTADO' | 'NECESIDAD_ESCUELA';
  }> = [];

  for (const d of docentes) {
    const deteccion = detectarDocenteVacanteNn(d);
    if (deteccion.esVacanteNn && (!d.esVacanteNn || !d.tipoVacante)) {
      candidatosActualizar.push({
        docente: d,
        tipoVacanteSugerido: deteccion.tipoVacanteSugerido
      });
    }
  }

  const idsMarcados: string[] = [];
  const rbdsAfectados = new Map<string, string[]>();
  const docentesActualizados: Docente[] = [];

  if (candidatosActualizar.length > 0) {
    const db = await getDb();
    db.run('BEGIN TRANSACTION;');
    try {
      for (const item of candidatosActualizar) {
        db.run(
          'UPDATE docentes SET es_vacante_nn = 1, tipo_vacante = COALESCE(tipo_vacante, ?) WHERE id = ?;',
          [item.tipoVacanteSugerido, item.docente.id]
        );
        idsMarcados.push(item.docente.id);

        const listaRbd = rbdsAfectados.get(item.docente.rbd) || [];
        listaRbd.push(item.docente.id);
        rbdsAfectados.set(item.docente.rbd, listaRbd);

        docentesActualizados.push({
          ...item.docente,
          esVacanteNn: true,
          tipoVacante: item.docente.tipoVacante || item.tipoVacanteSugerido
        });
      }
      db.run('COMMIT;');
    } catch (err) {
      db.run('ROLLBACK;');
      throw err;
    }

    await persistDb(true);
  }

  const idsMarcadosSet = new Set(idsMarcados);
  const asignacionesPreservadas = asignaciones.filter(
    a => idsMarcadosSet.has(a.docenteId) || (a.tieneCoDocente && a.coDocenteId && idsMarcadosSet.has(a.coDocenteId))
  ).length;

  for (const [rbdAfectado, docIds] of rbdsAfectados.entries()) {
    await registrarEventoAuditoria({
      rbd: rbdAfectado,
      periodo,
      tipoEvento: 'ACTUALIZACION',
      entidad: 'DOCENTE',
      descripcion: `Saneamiento NN territorial: ${docIds.length} registro(s) marcados como vacante NN preservando asignaciones horarias.`,
      detalles: {
        idsMarcados: docIds,
        usuarioActor: params.usuarioActor || 'nivel_central',
        rolActor: params.rolActor
      }
    });
  }

  if (isSupabaseEnabled() && docentesActualizados.length > 0) {
    SupabaseDotacionService.guardarDocentesBatch(docentesActualizados).catch(err =>
      console.warn('[movilidadTerritorialService] Aviso sync Supabase tras saneamiento NN:', err)
    );
  }

  return {
    escaneados: docentes.length,
    marcadosNn: idsMarcados.length,
    asignacionesPreservadas,
    idsMarcados
  };
}

export async function crearNecesidadVacanteEscuela(params: {
  rbd: string;
  periodo: number;
  especialidad: string;
  estamento: EstamentoDocente;
  horasContrato: number;
  fuenteFinanciamiento: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
  justificacion: string;
  usuarioActor?: string;
}): Promise<Docente> {
  const flags = obtenerFeatureFlagsMovilidad();
  if (!flags.flag_saneamiento_nn_escuelas) {
    throw new Error('El feature flag flag_saneamiento_nn_escuelas se encuentra desactivado.');
  }

  const rbdClean = String(params.rbd || '').trim();
  const especialidadClean = String(params.especialidad || '').trim();
  const justificacionClean = String(params.justificacion || '').trim();

  if (!rbdClean) {
    throw new Error('Debe especificar un RBD válido para registrar la necesidad de vacante.');
  }
  if (!especialidadClean) {
    throw new Error('Debe indicar la especialidad o asignatura requerida para la vacante.');
  }
  if (!justificacionClean) {
    throw new Error('Debe ingresar una justificación pedagógica o normativa no vacía.');
  }

  const horasNum = Number(params.horasContrato);
  if (!Number.isInteger(horasNum) || horasNum < 1 || horasNum > 44) {
    throw new Error('Las horas de contrato de la vacante deben ser un número entero entre 1 y 44.');
  }

  const periodo = params.periodo || 2027;
  const sufijoId = Math.random().toString(36).slice(2, 6);
  const codigoVacante = `VAC-${rbdClean}-${Math.floor(1000 + Math.random() * 9000)}`;

  const vacante: Docente = {
    id: `vac_esc_${rbdClean}_${periodo}_${Date.now()}_${sufijoId}`,
    rbd: rbdClean,
    periodo,
    run: codigoVacante,
    nombres: 'VACANTE POR PROVEER',
    apellidos: especialidadClean.toUpperCase(),
    calidadJuridica: 'CONTRATA',
    estamento: params.estamento,
    horasContrato: horasNum,
    horasSubvencionGeneralTitular: 0,
    horasSubvencionGeneralContrata: params.fuenteFinanciamiento === 'SUBVENCION_GENERAL' ? horasNum : 0,
    horasSepTitular: 0,
    horasSepContrata: params.fuenteFinanciamiento === 'SEP' ? horasNum : 0,
    horasPieTitular: 0,
    horasPieContrata: params.fuenteFinanciamiento === 'PIE' ? horasNum : 0,
    asignaturaPrincipal: especialidadClean,
    esVacanteNn: true,
    tipoVacante: 'NECESIDAD_ESCUELA',
    justificacionVacante: justificacionClean,
    vacanteCondicional: false,
    propuestaGdp: 'Vacante por proveer',
    situacionFinalGdp: 'Vigente'
  };

  await guardarDocente(vacante);

  await registrarEventoAuditoria({
    rbd: rbdClean,
    periodo,
    tipoEvento: 'CREACION',
    entidad: 'DOCENTE',
    entidadId: vacante.id,
    descripcion: `Creación de necesidad de vacante estructurada (${especialidadClean}, ${horasNum}h, ${params.fuenteFinanciamiento}).`,
    detalles: {
      tipoVacante: 'NECESIDAD_ESCUELA',
      codigoVacante,
      fuenteFinanciamiento: params.fuenteFinanciamiento,
      justificacion: justificacionClean,
      usuarioActor: params.usuarioActor || 'establecimiento'
    }
  });

  return vacante;
}

// =============================================================================
// 4. CRUD de Egresos Proyectados y Contingencia Jurídica
// =============================================================================

const EGRESO_SELECT_COLS = `
  id, rbd, periodo, docente_id, run_docente, nombre_docente, asignatura_principal,
  horas_liberadas, horas_aula_liberadas, fuente_financiamiento, calidad_juridica,
  causal, certeza, excepcion_jubilacion_3_anios, fecha_cese, numero_decreto,
  impacto_presupuestario, vacante_docente_id, validado_por, observaciones,
  created_at, updated_at
`;

function mapRowToEgreso(row: any[]): EgresoProyectado {
  return {
    id: String(row[0]),
    rbd: String(row[1]),
    periodo: Number(row[2] || 2027),
    docenteId: String(row[3]),
    runDocente: String(row[4]),
    nombreDocente: String(row[5]),
    asignaturaPrincipal: row[6] ? String(row[6]) : undefined,
    horasLiberadas: Number(row[7] || 0),
    horasAulaLiberadas: Number(row[8] || 0),
    fuenteFinanciamiento: (row[9] ? String(row[9]) : 'SUBVENCION_GENERAL') as EgresoProyectado['fuenteFinanciamiento'],
    calidadJuridica: (row[10] ? String(row[10]) : 'TITULAR') as CalidadJuridicaDocente,
    causal: String(row[11]) as CausalEgresoDocente,
    certeza: (row[12] ? String(row[12]) : 'en_tramite') as CertezaJuridicaEgreso,
    excepcionJubilacion3Anios: Boolean(row[13]),
    fechaCese: row[14] ? String(row[14]) : undefined,
    numeroDecreto: row[15] ? String(row[15]) : undefined,
    impactoPresupuestario: (row[16] ? String(row[16]) : 'costo_doble_pendiente') as ImpactoPresupuestarioEgreso,
    vacanteDocenteId: row[17] ? String(row[17]) : undefined,
    validadoPor: row[18] ? String(row[18]) : undefined,
    observaciones: row[19] ? String(row[19]) : undefined,
    createdAt: row[20] ? String(row[20]) : undefined,
    updatedAt: row[21] ? String(row[21]) : undefined
  };
}

function mapEgresoToSupabase(e: EgresoProyectado) {
  return {
    id: e.id,
    rbd: e.rbd,
    periodo: e.periodo,
    docente_id: e.docenteId,
    run_docente: e.runDocente,
    nombre_docente: e.nombreDocente,
    asignatura_principal: e.asignaturaPrincipal || null,
    horas_liberadas: e.horasLiberadas,
    horas_aula_liberadas: e.horasAulaLiberadas,
    fuente_financiamiento: e.fuenteFinanciamiento,
    calidad_juridica: e.calidadJuridica,
    causal: e.causal,
    certeza: e.certeza,
    excepcion_jubilacion_3_anios: Boolean(e.excepcionJubilacion3Anios),
    fecha_cese: e.fechaCese || null,
    numero_decreto: e.numeroDecreto || null,
    impacto_presupuestario: e.impactoPresupuestario,
    vacante_docente_id: e.vacanteDocenteId || null,
    validado_por: e.validadoPor || null,
    observaciones: e.observaciones || null
  };
}

export async function listarEgresosProyectados(
  periodo: number = 2027,
  rolActor: RolId
): Promise<EgresoProyectado[]> {
  assertRolNivelCentral(rolActor, 'listar egresos proyectados');
  const db = await getDb();
  const res = db.exec(
    `SELECT ${EGRESO_SELECT_COLS} FROM egresos_proyectados WHERE periodo = ? ORDER BY updated_at DESC, created_at DESC;`,
    [periodo]
  );
  if (!res.length) return [];
  return res[0].values.map(mapRowToEgreso);
}

export async function guardarEgresoProyectado(
  egreso: Omit<EgresoProyectado, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
  rolActor: RolId,
  generarVacanteVinculada: boolean = false
): Promise<{ egreso: EgresoProyectado; evaluacion: EvaluacionJuridicaEgreso; vacanteGenerada?: Docente }> {
  assertRolValidadorGdp(rolActor, 'registrar o validar egresos proyectados');

  const periodo = egreso.periodo || 2027;
  const horasLiberadasInt = Math.max(0, Math.round(Number(egreso.horasLiberadas || 0)));
  const horasAulaLiberadasInt = Math.max(0, Math.round(Number(egreso.horasAulaLiberadas || 0)));

  const evaluacion = evaluarEgresoProyectado({
    causal: egreso.causal,
    certeza: egreso.certeza,
    excepcionJubilacion3Anios: Boolean(egreso.excepcionJubilacion3Anios),
    fechaCese: egreso.fechaCese,
    numeroDecreto: egreso.numeroDecreto,
    horasLiberadas: horasLiberadasInt,
    impactoPresupuestario: egreso.impactoPresupuestario
  });

  const db = await getDb();
  const nowIso = new Date().toISOString();
  const egresoId = egreso.id?.trim() || `egr_${egreso.rbd}_${periodo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  let prevVacanteId: string | undefined;
  let prevCreatedAt: string | undefined;
  const prevRes = db.exec(
    'SELECT vacante_docente_id, created_at FROM egresos_proyectados WHERE id = ? LIMIT 1;',
    [egresoId]
  );
  if (prevRes.length && prevRes[0].values.length) {
    prevVacanteId = prevRes[0].values[0][0] ? String(prevRes[0].values[0][0]) : undefined;
    prevCreatedAt = prevRes[0].values[0][1] ? String(prevRes[0].values[0][1]) : undefined;
  }

  let vacanteDocenteId: string | undefined = prevVacanteId || egreso.vacanteDocenteId;
  let vacanteGenerada: Docente | undefined;
  const idsVacantesEliminar: string[] = [];

  // Regla Art. 19 S: excepción de jubilación <= 3 años NO libera vacante y elimina cualquier vacante previa ligada
  if (!evaluacion.liberaVacante) {
    if (vacanteDocenteId) {
      idsVacantesEliminar.push(vacanteDocenteId);
    }
    const ligadas = db.exec('SELECT id FROM docentes WHERE origen_egreso_id = ?;', [egresoId]);
    if (ligadas.length && ligadas[0].values.length) {
      for (const r of ligadas[0].values) {
        const lid = String(r[0]);
        if (!idsVacantesEliminar.includes(lid)) {
          idsVacantesEliminar.push(lid);
        }
      }
    }
    vacanteDocenteId = undefined;
  } else if (generarVacanteVinculada || vacanteDocenteId) {
    // Crear o actualizar la vacante vinculada si se solicitó o si ya existía una vinculada
    if (generarVacanteVinculada) {
      vacanteDocenteId = vacanteDocenteId || `vac_egr_${egresoId}`;
    }
    if (vacanteDocenteId) {
      const horasVac = Math.max(1, Math.min(44, horasLiberadasInt || 1));
      const esPie = egreso.fuenteFinanciamiento === 'PIE';
      const esSep = egreso.fuenteFinanciamiento === 'SEP';
      const esSubv = !esPie && !esSep;

      const vacanteExistenteRes = db.exec('SELECT run, estamento FROM docentes WHERE id = ? LIMIT 1;', [vacanteDocenteId]);
      const runExistente = vacanteExistenteRes[0]?.values[0]?.[0]
        ? String(vacanteExistenteRes[0].values[0][0])
        : undefined;
      const estamentoExistente = vacanteExistenteRes[0]?.values[0]?.[1]
        ? (String(vacanteExistenteRes[0].values[0][1]) as EstamentoDocente)
        : undefined;

      vacanteGenerada = {
        id: vacanteDocenteId,
        rbd: egreso.rbd,
        periodo,
        run: runExistente || `VAC-EGR-${egreso.rbd}-${egresoId.slice(-4).toUpperCase()}`,
        nombres: evaluacion.esVacanteCondicional ? 'VACANTE CONDICIONAL' : 'VACANTE POR EGRESO',
        apellidos: (egreso.asignaturaPrincipal || egreso.nombreDocente || 'DOCENTE').toUpperCase(),
        calidadJuridica: 'CONTRATA',
        estamento: estamentoExistente || (esPie ? 'DOCENTE_DIFERENCIAL' : 'DOCENTE_AULA'),
        horasContrato: horasVac,
        horasSubvencionGeneralTitular: 0,
        horasSubvencionGeneralContrata: esSubv ? horasVac : 0,
        horasSepTitular: 0,
        horasSepContrata: esSep ? horasVac : 0,
        horasPieTitular: 0,
        horasPieContrata: esPie ? horasVac : 0,
        horasAula: horasAulaLiberadasInt,
        asignaturaPrincipal: egreso.asignaturaPrincipal,
        esVacanteNn: true,
        tipoVacante: 'CONDICIONAL_EGRESO',
        justificacionVacante: `Vacante originada por egreso proyectado (${egreso.causal}, certeza: ${egreso.certeza})`,
        origenEgresoId: egresoId,
        reemplazoDeRun: egreso.runDocente,
        vacanteCondicional: evaluacion.esVacanteCondicional,
        propuestaGdp: evaluacion.esVacanteCondicional ? 'Reemplazo condicional' : 'Vacante por proveer',
        situacionFinalGdp: 'Vigente'
      };
    }
  }

  const impactoFinal = evaluacion.impactoPresupuestarioSugerido;
  const egresoFinal: EgresoProyectado = {
    ...egreso,
    id: egresoId,
    periodo,
    horasLiberadas: horasLiberadasInt,
    horasAulaLiberadas: horasAulaLiberadasInt,
    excepcionJubilacion3Anios: Boolean(egreso.excepcionJubilacion3Anios),
    impactoPresupuestario: impactoFinal,
    vacanteDocenteId,
    createdAt: prevCreatedAt || nowIso,
    updatedAt: nowIso
  };

  db.run('BEGIN TRANSACTION;');
  try {
    for (const delVacId of idsVacantesEliminar) {
      db.run('DELETE FROM asignaciones_horarias WHERE docente_id = ? OR co_docente_id = ?;', [delVacId, delVacId]);
      db.run('DELETE FROM docentes WHERE id = ?;', [delVacId]);
    }

    db.run(
      `INSERT INTO egresos_proyectados (
        id, rbd, periodo, docente_id, run_docente, nombre_docente, asignatura_principal,
        horas_liberadas, horas_aula_liberadas, fuente_financiamiento, calidad_juridica,
        causal, certeza, excepcion_jubilacion_3_anios, fecha_cese, numero_decreto,
        impacto_presupuestario, vacante_docente_id, validado_por, observaciones,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        rbd=excluded.rbd, periodo=excluded.periodo, docente_id=excluded.docente_id,
        run_docente=excluded.run_docente, nombre_docente=excluded.nombre_docente,
        asignatura_principal=excluded.asignatura_principal, horas_liberadas=excluded.horas_liberadas,
        horas_aula_liberadas=excluded.horas_aula_liberadas, fuente_financiamiento=excluded.fuente_financiamiento,
        calidad_juridica=excluded.calidad_juridica, causal=excluded.causal, certeza=excluded.certeza,
        excepcion_jubilacion_3_anios=excluded.excepcion_jubilacion_3_anios,
        fecha_cese=excluded.fecha_cese, numero_decreto=excluded.numero_decreto,
        impacto_presupuestario=excluded.impacto_presupuestario, vacante_docente_id=excluded.vacante_docente_id,
        validado_por=excluded.validado_por, observaciones=excluded.observaciones,
        updated_at=excluded.updated_at;`,
      [
        egresoFinal.id,
        egresoFinal.rbd,
        egresoFinal.periodo,
        egresoFinal.docenteId,
        egresoFinal.runDocente,
        egresoFinal.nombreDocente,
        egresoFinal.asignaturaPrincipal || null,
        egresoFinal.horasLiberadas,
        egresoFinal.horasAulaLiberadas,
        egresoFinal.fuenteFinanciamiento,
        egresoFinal.calidadJuridica,
        egresoFinal.causal,
        egresoFinal.certeza,
        egresoFinal.excepcionJubilacion3Anios ? 1 : 0,
        egresoFinal.fechaCese || null,
        egresoFinal.numeroDecreto || null,
        egresoFinal.impactoPresupuestario,
        egresoFinal.vacanteDocenteId || null,
        egresoFinal.validadoPor || null,
        egresoFinal.observaciones || null,
        egresoFinal.createdAt ?? null,
        egresoFinal.updatedAt ?? null
      ]
    );
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  if (vacanteGenerada) {
    await guardarDocente(vacanteGenerada);
  } else {
    await persistDb(true);
  }

  if (isSupabaseEnabled()) {
    for (const delVacId of idsVacantesEliminar) {
      SupabaseDotacionService.eliminarDocente(delVacId).catch(err =>
        console.warn('[movilidadTerritorialService] Aviso eliminando vacante previa en Supabase:', err)
      );
    }
    supabase
      .from('egresos_proyectados')
      .upsert(mapEgresoToSupabase(egresoFinal), { onConflict: 'id' })
      .then(() => {}, (err: any) => console.warn('[movilidadTerritorialService] Aviso sync egreso Supabase:', err));
  }

  return {
    egreso: egresoFinal,
    evaluacion,
    vacanteGenerada: generarVacanteVinculada && evaluacion.liberaVacante ? vacanteGenerada : undefined
  };
}

export async function eliminarEgresoProyectado(id: string, rolActor: RolId): Promise<void> {
  assertRolValidadorGdp(rolActor, 'eliminar egresos proyectados');
  const db = await getDb();

  const res = db.exec('SELECT vacante_docente_id FROM egresos_proyectados WHERE id = ? LIMIT 1;', [id]);
  const vacId = res[0]?.values[0]?.[0] ? String(res[0].values[0][0]) : undefined;

  db.run('BEGIN TRANSACTION;');
  try {
    if (vacId) {
      db.run('DELETE FROM asignaciones_horarias WHERE docente_id = ? OR co_docente_id = ?;', [vacId, vacId]);
      db.run('DELETE FROM docentes WHERE id = ? AND origen_egreso_id = ?;', [vacId, id]);
    }
    db.run('DELETE FROM egresos_proyectados WHERE id = ?;', [id]);
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  if (isSupabaseEnabled()) {
    if (vacId) {
      SupabaseDotacionService.eliminarDocente(vacId).catch(() => {});
    }
    supabase
      .from('egresos_proyectados')
      .delete()
      .eq('id', id)
      .then(() => {}, (err: any) => console.warn('[movilidadTerritorialService] Aviso delete egreso Supabase:', err));
  }
}

// =============================================================================
// 5. CRUD de Solicitudes de Movilidad y Detección de Horas Remanentes
// =============================================================================

const SOLICITUD_SELECT_COLS = `
  id, periodo, carril, docente_id, run_docente, nombre_docente, rbd_origen,
  comuna_origen, rbd_destino_preferente, comuna_destino_preferente, calidad_juridica,
  horas_contrato_actual, horas_titulares_actuales, horas_disponibles_mover, horas_remanentes,
  asignatura_principal, titulo_mencion, aplica_articulo_69, fuente_actual, estado_flujo,
  puntaje_salud, puntaje_ley_karin, puntaje_cuidado_dependientes, puntaje_distancia_rural,
  puntaje_antiguedad, puntaje_prioridad_total, fundamento, creado_por, created_at, updated_at
`;

function mapRowToSolicitud(row: any[]): SolicitudMovilidad {
  return {
    id: String(row[0]),
    periodo: Number(row[1] || 2027),
    carril: String(row[2]) as CarrilMovilidad,
    docenteId: String(row[3]),
    runDocente: String(row[4]),
    nombreDocente: String(row[5]),
    rbdOrigen: String(row[6]),
    comunaOrigen: row[7] ? String(row[7]) : undefined,
    rbdDestinoPreferente: row[8] ? String(row[8]) : undefined,
    comunaDestinoPreferente: row[9] ? String(row[9]) : undefined,
    calidadJuridica: (row[10] ? String(row[10]) : 'TITULAR') as CalidadJuridicaDocente,
    horasContratoActual: Number(row[11] || 0),
    horasTitularesActuales: Number(row[12] || 0),
    horasDisponiblesMover: Number(row[13] || 0),
    horasRemanentes: Number(row[14] || 0),
    asignaturaPrincipal: row[15] ? String(row[15]) : undefined,
    tituloMencion: row[16] ? String(row[16]) : undefined,
    aplicaArticulo69: Boolean(row[17]),
    fuenteActual: (row[18] ? String(row[18]) : 'SUBVENCION_GENERAL') as SolicitudMovilidad['fuenteActual'],
    estadoFlujo: (row[19] ? String(row[19]) : 'POSTULADO') as EstadoFlujoMovilidad,
    puntajeSalud: Number(row[20] || 0),
    puntajeLeyKarin: Number(row[21] || 0),
    puntajeCuidadoDependientes: Number(row[22] || 0),
    puntajeDistanciaRural: Number(row[23] || 0),
    puntajeAntiguedad: Number(row[24] || 0),
    puntajePrioridadTotal: Number(row[25] || 0),
    fundamento: row[26] ? String(row[26]) : undefined,
    creadoPor: row[27] ? String(row[27]) : undefined,
    createdAt: row[28] ? String(row[28]) : undefined,
    updatedAt: row[29] ? String(row[29]) : undefined
  };
}

function mapSolicitudToSupabase(s: SolicitudMovilidad) {
  return {
    id: s.id,
    periodo: s.periodo,
    carril: s.carril,
    docente_id: s.docenteId,
    run_docente: s.runDocente,
    nombre_docente: s.nombreDocente,
    rbd_origen: s.rbdOrigen,
    comuna_origen: s.comunaOrigen || null,
    rbd_destino_preferente: s.rbdDestinoPreferente || null,
    comuna_destino_preferente: s.comunaDestinoPreferente || null,
    calidad_juridica: s.calidadJuridica,
    horas_contrato_actual: s.horasContratoActual,
    horas_titulares_actuales: s.horasTitularesActuales,
    horas_disponibles_mover: s.horasDisponiblesMover,
    horas_remanentes: s.horasRemanentes,
    asignatura_principal: s.asignaturaPrincipal || null,
    titulo_mencion: s.tituloMencion || null,
    aplica_articulo_69: Boolean(s.aplicaArticulo69),
    fuente_actual: s.fuenteActual,
    estado_flujo: s.estadoFlujo,
    puntaje_salud: s.puntajeSalud,
    puntaje_ley_karin: s.puntajeLeyKarin,
    puntaje_cuidado_dependientes: s.puntajeCuidadoDependientes,
    puntaje_distancia_rural: s.puntajeDistanciaRural,
    puntaje_antiguedad: s.puntajeAntiguedad,
    puntaje_prioridad_total: s.puntajePrioridadTotal,
    fundamento: s.fundamento || null,
    creado_por: s.creadoPor || null
  };
}

export async function listarSolicitudesMovilidad(
  periodo: number = 2027,
  rolActor: RolId
): Promise<SolicitudMovilidad[]> {
  assertRolNivelCentral(rolActor, 'listar solicitudes de movilidad');
  const db = await getDb();
  const res = db.exec(
    `SELECT ${SOLICITUD_SELECT_COLS} FROM solicitudes_movilidad WHERE periodo = ? ORDER BY puntaje_prioridad_total DESC, updated_at DESC;`,
    [periodo]
  );
  if (!res.length) return [];
  return res[0].values.map(mapRowToSolicitud);
}

export async function guardarSolicitudMovilidad(
  sol: Omit<SolicitudMovilidad, 'id' | 'puntajePrioridadTotal' | 'createdAt' | 'updatedAt'> & { id?: string },
  rolActor: RolId
): Promise<SolicitudMovilidad> {
  assertRolNivelCentral(rolActor, 'guardar solicitudes de movilidad');

  const periodo = sol.periodo || 2027;
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const solId = sol.id?.trim() || `sol_${periodo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  let prevCreatedAt: string | undefined;
  const prevRes = db.exec('SELECT created_at FROM solicitudes_movilidad WHERE id = ? LIMIT 1;', [solId]);
  if (prevRes.length && prevRes[0].values.length && prevRes[0].values[0][0]) {
    prevCreatedAt = String(prevRes[0].values[0][0]);
  }

  const puntajePrioridadTotal = calcularPuntajePrioridadMovilidad({
    carril: sol.carril,
    puntajeSalud: sol.puntajeSalud,
    puntajeLeyKarin: sol.puntajeLeyKarin,
    puntajeCuidadoDependientes: sol.puntajeCuidadoDependientes,
    puntajeDistanciaRural: sol.puntajeDistanciaRural,
    puntajeAntiguedad: sol.puntajeAntiguedad,
    horasRemanentes: sol.horasRemanentes
  });

  const solicitudFinal: SolicitudMovilidad = {
    ...sol,
    id: solId,
    periodo,
    horasContratoActual: Math.max(0, Math.round(Number(sol.horasContratoActual || 0))),
    horasTitularesActuales: Math.max(0, Math.round(Number(sol.horasTitularesActuales || 0))),
    horasDisponiblesMover: Math.max(0, Math.round(Number(sol.horasDisponiblesMover || 0))),
    horasRemanentes: Math.max(0, Math.round(Number(sol.horasRemanentes || 0))),
    puntajePrioridadTotal,
    createdAt: prevCreatedAt || nowIso,
    updatedAt: nowIso
  };

  db.run(
    `INSERT INTO solicitudes_movilidad (
      id, periodo, carril, docente_id, run_docente, nombre_docente, rbd_origen,
      comuna_origen, rbd_destino_preferente, comuna_destino_preferente, calidad_juridica,
      horas_contrato_actual, horas_titulares_actuales, horas_disponibles_mover, horas_remanentes,
      asignatura_principal, titulo_mencion, aplica_articulo_69, fuente_actual, estado_flujo,
      puntaje_salud, puntaje_ley_karin, puntaje_cuidado_dependientes, puntaje_distancia_rural,
      puntaje_antiguedad, puntaje_prioridad_total, fundamento, creado_por, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      periodo=excluded.periodo, carril=excluded.carril, docente_id=excluded.docente_id,
      run_docente=excluded.run_docente, nombre_docente=excluded.nombre_docente, rbd_origen=excluded.rbd_origen,
      comuna_origen=excluded.comuna_origen, rbd_destino_preferente=excluded.rbd_destino_preferente,
      comuna_destino_preferente=excluded.comuna_destino_preferente, calidad_juridica=excluded.calidad_juridica,
      horas_contrato_actual=excluded.horas_contrato_actual, horas_titulares_actuales=excluded.horas_titulares_actuales,
      horas_disponibles_mover=excluded.horas_disponibles_mover, horas_remanentes=excluded.horas_remanentes,
      asignatura_principal=excluded.asignatura_principal, titulo_mencion=excluded.titulo_mencion,
      aplica_articulo_69=excluded.aplica_articulo_69, fuente_actual=excluded.fuente_actual,
      estado_flujo=excluded.estado_flujo, puntaje_salud=excluded.puntaje_salud,
      puntaje_ley_karin=excluded.puntaje_ley_karin, puntaje_cuidado_dependientes=excluded.puntaje_cuidado_dependientes,
      puntaje_distancia_rural=excluded.puntaje_distancia_rural, puntaje_antiguedad=excluded.puntaje_antiguedad,
      puntaje_prioridad_total=excluded.puntaje_prioridad_total, fundamento=excluded.fundamento,
      creado_por=excluded.creado_por, updated_at=excluded.updated_at;`,
    [
      solicitudFinal.id,
      solicitudFinal.periodo,
      solicitudFinal.carril,
      solicitudFinal.docenteId,
      solicitudFinal.runDocente,
      solicitudFinal.nombreDocente,
      solicitudFinal.rbdOrigen,
      solicitudFinal.comunaOrigen || null,
      solicitudFinal.rbdDestinoPreferente || null,
      solicitudFinal.comunaDestinoPreferente || null,
      solicitudFinal.calidadJuridica,
      solicitudFinal.horasContratoActual,
      solicitudFinal.horasTitularesActuales,
      solicitudFinal.horasDisponiblesMover,
      solicitudFinal.horasRemanentes,
      solicitudFinal.asignaturaPrincipal || null,
      solicitudFinal.tituloMencion || null,
      solicitudFinal.aplicaArticulo69 ? 1 : 0,
      solicitudFinal.fuenteActual,
      solicitudFinal.estadoFlujo,
      solicitudFinal.puntajeSalud,
      solicitudFinal.puntajeLeyKarin,
      solicitudFinal.puntajeCuidadoDependientes,
      solicitudFinal.puntajeDistanciaRural,
      solicitudFinal.puntajeAntiguedad,
      solicitudFinal.puntajePrioridadTotal,
      solicitudFinal.fundamento || null,
      solicitudFinal.creadoPor || null,
      solicitudFinal.createdAt ?? null,
      solicitudFinal.updatedAt ?? null
    ]
  );

  await persistDb(true);

  if (isSupabaseEnabled()) {
    supabase
      .from('solicitudes_movilidad')
      .upsert(mapSolicitudToSupabase(solicitudFinal), { onConflict: 'id' })
      .then(() => {}, (err: any) => console.warn('[movilidadTerritorialService] Aviso sync solicitud Supabase:', err));
  }

  return solicitudFinal;
}

const TRANSICIONES_FLUJO_VALIDAS: Record<EstadoFlujoMovilidad, EstadoFlujoMovilidad[]> = {
  POSTULADO: ['PRE_ASIGNADO', 'RECHAZADO'],
  PRE_ASIGNADO: ['NOTIFICADO_DIRECCION_ORIGEN', 'RECHAZADO'],
  NOTIFICADO_DIRECCION_ORIGEN: ['ACEPTADO_CON_FIRMA', 'RECHAZADO'],
  ACEPTADO_CON_FIRMA: ['CONSOLIDADO', 'RECHAZADO'],
  CONSOLIDADO: [],
  RECHAZADO: []
};

export async function avanzarEstadoFlujoMovilidad(
  id: string,
  nuevoEstado: EstadoFlujoMovilidad,
  rolActor: RolId
): Promise<SolicitudMovilidad> {
  assertRolNivelCentral(rolActor, 'avanzar estado de solicitud de movilidad');
  const db = await getDb();

  const res = db.exec(`SELECT ${SOLICITUD_SELECT_COLS} FROM solicitudes_movilidad WHERE id = ? LIMIT 1;`, [id]);
  if (!res.length || !res[0].values.length) {
    throw new Error(`Solicitud de movilidad '${id}' no encontrada.`);
  }

  const actual = mapRowToSolicitud(res[0].values[0]);
  const permitidos = TRANSICIONES_FLUJO_VALIDAS[actual.estadoFlujo] || [];

  if (!permitidos.includes(nuevoEstado)) {
    throw new Error(
      `Transición de estado inválida para solicitud '${id}': '${actual.estadoFlujo}' -> '${nuevoEstado}'. Permitidos: ${permitidos.join(', ') || 'ninguno (estado terminal)'}.`
    );
  }

  if (nuevoEstado === 'CONSOLIDADO') {
    assertRolConsolidador(rolActor, 'consolidar una solicitud de movilidad');
  }

  const nowIso = new Date().toISOString();
  db.run('UPDATE solicitudes_movilidad SET estado_flujo = ?, updated_at = ? WHERE id = ?;', [
    nuevoEstado,
    nowIso,
    id
  ]);

  await persistDb(true);

  const actualizada: SolicitudMovilidad = {
    ...actual,
    estadoFlujo: nuevoEstado,
    updatedAt: nowIso
  };

  if (isSupabaseEnabled()) {
    supabase
      .from('solicitudes_movilidad')
      .update({ estado_flujo: nuevoEstado, updated_at: nowIso })
      .eq('id', id)
      .then(() => {}, (err: any) => console.warn('[movilidadTerritorialService] Aviso update estado solicitud Supabase:', err));
  }

  return actualizada;
}

export async function eliminarSolicitudMovilidad(id: string, rolActor: RolId): Promise<void> {
  assertRolNivelCentral(rolActor, 'eliminar solicitudes de movilidad');
  const db = await getDb();
  db.run('DELETE FROM solicitudes_movilidad WHERE id = ?;', [id]);
  await persistDb(true);

  if (isSupabaseEnabled()) {
    supabase
      .from('solicitudes_movilidad')
      .delete()
      .eq('id', id)
      .then(() => {}, (err: any) => console.warn('[movilidadTerritorialService] Aviso delete solicitud Supabase:', err));
  }
}

export async function detectarDocentesHorasRemanentes(
  periodo: number = 2027,
  rolActor: RolId
): Promise<
  Array<{
    docente: Docente;
    establecimiento?: Establecimiento;
    horasContrato: number;
    horasLectivasMax: number;
    horasAsignadas: number;
    horasRemanentes: number;
  }>
> {
  assertRolNivelCentral(rolActor, 'detectar docentes con horas remanentes');

  const [establecimientos, docentesRaw, asignaciones] = await Promise.all([
    listarEstablecimientos(),
    listarTodosLosDocentesTerritorio(periodo),
    listarTodasLasAsignaciones(periodo)
  ]);

  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [e.rbd, e]));
  const { docentesEfectivos } = filtrarDocentesSinDobleConteoCondicional(docentesRaw);

  const asigsPorDoc = new Map<string, AsignacionHoraria[]>();
  for (const a of asignaciones) {
    if (a.docenteId) {
      const k1 = `${a.rbd}__${a.docenteId}`;
      const list = asigsPorDoc.get(k1) || [];
      list.push(a);
      asigsPorDoc.set(k1, list);
    }
    if (a.tieneCoDocente && a.coDocenteId && a.coDocenteId !== a.docenteId) {
      const k2 = `${a.rbd}__${a.coDocenteId}`;
      const list = asigsPorDoc.get(k2) || [];
      list.push(a);
      asigsPorDoc.set(k2, list);
    }
  }

  const resultados: Array<{
    docente: Docente;
    establecimiento?: Establecimiento;
    horasContrato: number;
    horasLectivasMax: number;
    horasAsignadas: number;
    horasRemanentes: number;
  }> = [];

  for (const d of docentesEfectivos) {
    if (d.esVacanteNn || d.vacanteCondicional) continue;
    if (!esSituacionFinalActiva(d.situacionFinalGdp)) continue;
    if (
      d.estamento !== 'DOCENTE_AULA' &&
      d.estamento !== 'DOCENTE_DIFERENCIAL' &&
      d.estamento !== 'EDUCADORA_PARVULO'
    ) {
      continue;
    }

    const est = estMap.get(d.rbd);
    const regimen = determinarRegimenNormativo(est?.porcentajePrioritarios ?? 75);

    const hFuncionesNoAula =
      d.funcionesNoAula && d.funcionesNoAula.length > 0
        ? d.funcionesNoAula.reduce((s, f) => s + Number(f.horas || 0), 0)
        : Number(d.horasDirectivas || 0) +
          Number(d.horasInspectorGeneral || 0) +
          Number(d.horasTecnicoPedagogicas || 0) +
          Number(d.horasCoordinacion || 0) +
          Number(d.horasCoordinacionPie || 0) +
          Number(d.horasConvivenciaEscolar || 0) +
          Number(d.horasExtraescolar || 0);

    const hExentasContrato =
      hFuncionesNoAula + Number(d.horasTallerSep || 0) + Number(d.horasTrabajoColaborativo || 0);
    const horasBaseAula = Math.max(0, Math.round(Number(d.horasContrato || 0) - hExentasContrato));
    if (horasBaseAula <= 0) continue;

    const asigsD = asigsPorDoc.get(`${d.rbd}__${d.id}`) || [];
    const horasAsignadas = asigsD
      .filter(a => !a.esTrabajoColaborativo && !(a.esTallerSep && Number(d.horasTallerSep || 0) > 0))
      .reduce((s, a) => s + Number(a.horasPedagogicasAula || 0), 0);

    const jornada = calcularJornadaMinutos(
      horasBaseAula,
      horasAsignadas,
      regimen,
      Boolean(d.aplicaArticulo69)
    );

    const horasRemanentes = Math.floor(jornada.minutosLectivosVacantes / 45);
    if (horasRemanentes > 0) {
      resultados.push({
        docente: d,
        establecimiento: est,
        horasContrato: d.horasContrato,
        horasLectivasMax: jornada.horasPedagogicasDisponiblesMax,
        horasAsignadas,
        horasRemanentes
      });
    }
  }

  resultados.sort((a, b) => b.horasRemanentes - a.horasRemanentes);
  return resultados;
}

// =============================================================================
// 6. Escenarios de Calce, Propuestas, Sugeridor Automático y Consolidación Atómica
// =============================================================================

const ESCENARIO_SELECT_COLS = `
  id, periodo, nombre, descripcion, estado, creado_por, aprobado_por,
  consolidado_por, fecha_consolidacion, resumen_metricas_json, created_at, updated_at
`;

const PROPUESTA_SELECT_COLS = `
  id, escenario_id, periodo, solicitud_movilidad_id, docente_origen_id, run_docente,
  nombre_docente, rbd_origen, rbd_destino, vacante_destino_id, egreso_origen_id,
  tipo_cobertura, horas_asignadas, minutos_asignados, horas_pedagogicas_aula,
  fuente_destino, indice_compatibilidad, genera_rebote, vacante_rebote_json,
  alertas_normativas_json, bloquea_consolidacion, motivo_bloqueo, estado,
  created_at, updated_at
`;

function mapRowToEscenario(row: any[]): EscenarioCalce {
  let resumenMetricas: EscenarioCalce['resumenMetricas'];
  if (row[9]) {
    try {
      resumenMetricas = JSON.parse(String(row[9]));
    } catch (_) {}
  }
  return {
    id: String(row[0]),
    periodo: Number(row[1] || 2027),
    nombre: String(row[2]),
    descripcion: row[3] ? String(row[3]) : undefined,
    estado: (row[4] ? String(row[4]) : 'BORRADOR') as EstadoEscenarioCalce,
    creadoPor: row[5] ? String(row[5]) : undefined,
    aprobadoPor: row[6] ? String(row[6]) : undefined,
    consolidadoPor: row[7] ? String(row[7]) : undefined,
    fechaConsolidacion: row[8] ? String(row[8]) : undefined,
    resumenMetricas,
    createdAt: row[10] ? String(row[10]) : undefined,
    updatedAt: row[11] ? String(row[11]) : undefined
  };
}

function mapEscenarioToSupabase(e: EscenarioCalce) {
  return {
    id: e.id,
    periodo: e.periodo,
    nombre: e.nombre,
    descripcion: e.descripcion || null,
    estado: e.estado,
    creado_por: e.creadoPor || null,
    aprobado_por: e.aprobadoPor || null,
    consolidado_por: e.consolidadoPor || null,
    fecha_consolidacion: e.fechaConsolidacion || null,
    resumen_metricas_json: e.resumenMetricas || null
  };
}

function mapRowToPropuesta(row: any[]): PropuestaCalce {
  let vacanteRebote: VacanteRebotePlan | undefined;
  if (row[18]) {
    try {
      vacanteRebote = JSON.parse(String(row[18]));
    } catch (_) {}
  }
  let alertasNormativas: string[] = [];
  if (row[19]) {
    try {
      const parsed = JSON.parse(String(row[19]));
      if (Array.isArray(parsed)) alertasNormativas = parsed;
    } catch (_) {}
  }

  return {
    id: String(row[0]),
    escenarioId: String(row[1]),
    periodo: Number(row[2] || 2027),
    solicitudMovilidadId: row[3] ? String(row[3]) : undefined,
    docenteOrigenId: String(row[4]),
    runDocente: String(row[5]),
    nombreDocente: String(row[6]),
    rbdOrigen: String(row[7]),
    rbdDestino: String(row[8]),
    vacanteDestinoId: row[9] ? String(row[9]) : undefined,
    egresoOrigenId: row[10] ? String(row[10]) : undefined,
    tipoCobertura: (row[11] ? String(row[11]) : 'DEFINITIVA') as PropuestaCalce['tipoCobertura'],
    horasAsignadas: Number(row[12] || 0),
    minutosAsignados: Number(row[13] || 0),
    horasPedagogicasAula: Number(row[14] || 0),
    fuenteDestino: (row[15] ? String(row[15]) : 'SUBVENCION_GENERAL') as PropuestaCalce['fuenteDestino'],
    indiceCompatibilidad: Number(row[16] || 0),
    generaRebote: Boolean(row[17]),
    vacanteRebote,
    alertasNormativas,
    bloqueaConsolidacion: Boolean(row[20]),
    motivoBloqueo: row[21] ? String(row[21]) : undefined,
    estado: (row[22] ? String(row[22]) : 'PROPUESTA') as PropuestaCalce['estado'],
    createdAt: row[23] ? String(row[23]) : undefined,
    updatedAt: row[24] ? String(row[24]) : undefined
  };
}

function mapPropuestaToSupabase(p: PropuestaCalce) {
  return {
    id: p.id,
    escenario_id: p.escenarioId,
    periodo: p.periodo,
    solicitud_movilidad_id: p.solicitudMovilidadId || null,
    docente_origen_id: p.docenteOrigenId,
    run_docente: p.runDocente,
    nombre_docente: p.nombreDocente,
    rbd_origen: p.rbdOrigen,
    rbd_destino: p.rbdDestino,
    vacante_destino_id: p.vacanteDestinoId || null,
    egreso_origen_id: p.egresoOrigenId || null,
    tipo_cobertura: p.tipoCobertura,
    horas_asignadas: p.horasAsignadas,
    minutos_asignados: p.minutosAsignados,
    horas_pedagogicas_aula: p.horasPedagogicasAula,
    fuente_destino: p.fuenteDestino,
    indice_compatibilidad: p.indiceCompatibilidad,
    genera_rebote: Boolean(p.generaRebote),
    vacante_rebote_json: p.vacanteRebote || null,
    alertas_normativas_json: p.alertasNormativas || [],
    bloquea_consolidacion: Boolean(p.bloqueaConsolidacion),
    motivo_bloqueo: p.motivoBloqueo || null,
    estado: p.estado
  };
}

function inferirFuenteDocenteCalce(d: Docente): FuenteFinanciamientoCalce {
  const sub = Number(d.horasSubvencionGeneralTitular || 0) + Number(d.horasSubvencionGeneralContrata || 0);
  const sep = Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0);
  const pie = Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0);
  const activas = [sub > 0, sep > 0, pie > 0].filter(Boolean).length;
  if (activas > 1) return 'MIXTO';
  if (pie > 0) return 'PIE';
  if (sep > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function normalizarFuenteDestino(d: Docente): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' {
  const pie = Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0);
  const sep = Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0);
  const sub = Number(d.horasSubvencionGeneralTitular || 0) + Number(d.horasSubvencionGeneralContrata || 0);
  if (pie > 0 && pie >= sep && pie >= sub) return 'PIE';
  if (sep > 0 && sep >= sub) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function calcularResumenMetricasEscenario(propuestas: PropuestaCalce[]): NonNullable<EscenarioCalce['resumenMetricas']> {
  const vacantesCubiertas = new Set(
    propuestas.filter(p => !p.bloqueaConsolidacion && p.vacanteDestinoId).map(p => p.vacanteDestinoId!)
  );
  return {
    totalPropuestas: propuestas.length,
    propuestasValidas: propuestas.filter(p => !p.bloqueaConsolidacion).length,
    propuestasBloqueadas: propuestas.filter(p => p.bloqueaConsolidacion).length,
    vacantesNnCubiertas: vacantesCubiertas.size,
    rebotesGenerados: propuestas.filter(p => p.generaRebote).length,
    deltaMinutosTerritorial: propuestas.reduce(
      (sum, p) => sum + (p.vacanteRebote?.deltaMinutosCadena ?? 0),
      0
    )
  };
}

function actualizarResumenEscenarioEnDb(db: any, escenarioId: string, nowIso: string): EscenarioCalce | null {
  const propRes = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ? ORDER BY created_at ASC;`,
    [escenarioId]
  );
  const propuestas = propRes.length ? propRes[0].values.map(mapRowToPropuesta) : [];
  const resumen = calcularResumenMetricasEscenario(propuestas);

  db.run('UPDATE escenarios_calce SET resumen_metricas_json = ?, updated_at = ? WHERE id = ?;', [
    JSON.stringify(resumen),
    nowIso,
    escenarioId
  ]);

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [escenarioId]);
  return escRes.length && escRes[0].values.length ? mapRowToEscenario(escRes[0].values[0]) : null;
}

function construirVacanteRebotePlan(
  docenteOrigen: Docente,
  estOrigen: Establecimiento | undefined,
  asignacionesOrigen: AsignacionHoraria[],
  fuenteRebote: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE'
): VacanteRebotePlan {
  const funcionesBase: FuncionNoAulaDocente[] =
    docenteOrigen.funcionesNoAula && docenteOrigen.funcionesNoAula.length > 0
      ? docenteOrigen.funcionesNoAula.map(f => ({ ...f }))
      : [];

  const reboteOut: VacanteReboteOutput = generarVacanteDeRebote({
    rbdOrigen: docenteOrigen.rbd,
    nombreEstablecimientoOrigen: estOrigen?.nombre,
    horasTrasladadas: docenteOrigen.horasContrato,
    asignaturaPrincipal: docenteOrigen.asignaturaPrincipal || docenteOrigen.funcionPrincipal || 'DOCENTE AULA',
    fuenteFinanciamiento: fuenteRebote,
    asignacionesOrigen: asignacionesOrigen.map(a => ({
      curso: a.cursoId,
      asignatura: a.asignatura,
      codigoAsignatura: a.codigoAsignatura,
      horasPedagogicas: a.horasPedagogicasAula
    })),
    funcionesNoAulaOrigen: funcionesBase.map(f => ({
      tipoFuncion: f.tipo,
      descripcion: f.nombre,
      horasCronologicas: f.horas,
      minutosSemanales: Math.round((f.horas || 0) * 60)
    }))
  });

  const asignacionesHeredadas: VacanteRebotePlan['asignacionesHeredadas'] = asignacionesOrigen.map((a, idx) => {
    const outAsig = reboteOut.asignacionesHeredadas[idx];
    return {
      asignacionId: a.id,
      cursoId: a.cursoId,
      asignatura: outAsig?.asignatura || a.asignatura,
      horasPedagogicasAula: outAsig?.horasPedagogicas ?? a.horasPedagogicasAula
    };
  });

  const funcionesNoLectivasHeredadas: FuncionNoAulaDocente[] =
    funcionesBase.length > 0
      ? funcionesBase
      : reboteOut.funcionesNoLectivasHeredadas.map((f, idx) => ({
          id: `func_reb_${idx}_${Date.now()}`,
          tipo: (f.tipoFuncion || 'OTRA') as FuncionNoAulaDocente['tipo'],
          nombre: f.descripcion || 'Función no lectiva',
          horas: Number(f.horasCronologicas || 0),
          financiamiento: fuenteRebote
        }));

  const fuenteRaw = String(reboteOut.fuenteFinanciamiento || fuenteRebote).toUpperCase();
  const fuenteNormalizada: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' =
    fuenteRaw === 'SEP' || fuenteRaw === 'PIE' ? fuenteRaw : 'SUBVENCION_GENERAL';

  return {
    rbdOrigen: reboteOut.rbdOrigen,
    nombreEstablecimientoOrigen: reboteOut.nombreEstablecimientoOrigen,
    horasContratoRebote: reboteOut.horasContratoRebote,
    minutosContratoRebote: reboteOut.minutosContratoRebote,
    horasPedagogicasAula: reboteOut.horasPedagogicasAula,
    asignaturaPrincipal:
      reboteOut.asignaturaPrincipal || docenteOrigen.asignaturaPrincipal || docenteOrigen.funcionPrincipal || 'DOCENTE AULA',
    fuenteFinanciamiento: fuenteNormalizada,
    asignacionesHeredadas,
    funcionesNoLectivasHeredadas,
    deltaMinutosCadena: reboteOut.deltaMinutosCadena
  };
}

export async function listarEscenariosCalce(
  periodo: number = 2027,
  rolActor: RolId
): Promise<EscenarioCalce[]> {
  assertRolNivelCentral(rolActor, 'listar escenarios de calce');
  const db = await getDb();
  const res = db.exec(
    `SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE periodo = ? ORDER BY updated_at DESC, created_at DESC;`,
    [periodo]
  );
  if (!res.length) return [];
  return res[0].values.map(mapRowToEscenario);
}

export async function crearEscenarioCalce(
  params: { periodo: number; nombre: string; descripcion?: string; creadoPor?: string },
  rolActor: RolId
): Promise<EscenarioCalce> {
  assertRolNivelCentral(rolActor, 'crear escenarios de calce');
  const nombreClean = String(params.nombre || '').trim();
  if (!nombreClean) {
    throw new Error('Debe ingresar un nombre válido para el escenario de calce.');
  }

  const periodo = params.periodo || 2027;
  const nowIso = new Date().toISOString();
  const escenario: EscenarioCalce = {
    id: `esc_${periodo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    periodo,
    nombre: nombreClean,
    descripcion: params.descripcion?.trim() || undefined,
    estado: 'BORRADOR',
    creadoPor: params.creadoPor,
    resumenMetricas: {
      totalPropuestas: 0,
      propuestasValidas: 0,
      propuestasBloqueadas: 0,
      vacantesNnCubiertas: 0,
      rebotesGenerados: 0,
      deltaMinutosTerritorial: 0
    },
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const db = await getDb();
  db.run(
    `INSERT INTO escenarios_calce (
      id, periodo, nombre, descripcion, estado, creado_por, aprobado_por,
      consolidado_por, fecha_consolidacion, resumen_metricas_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      escenario.id,
      escenario.periodo,
      escenario.nombre,
      escenario.descripcion || null,
      escenario.estado,
      escenario.creadoPor || null,
      null,
      null,
      null,
      JSON.stringify(escenario.resumenMetricas),
      escenario.createdAt ?? null,
      escenario.updatedAt ?? null
    ]
  );

  await persistDb(true);

  if (isSupabaseEnabled()) {
    supabase
      .from('escenarios_calce')
      .upsert(mapEscenarioToSupabase(escenario), { onConflict: 'id' })
      .then(() => {}, (err: any) => console.warn('[movilidadTerritorialService] Aviso sync escenario Supabase:', err));
  }

  return escenario;
}

export async function duplicarEscenarioCalce(
  escenarioId: string,
  nuevoNombre: string,
  rolActor: RolId,
  usuarioActor?: string
): Promise<EscenarioCalce> {
  assertRolNivelCentral(rolActor, 'duplicar escenarios de calce');
  const db = await getDb();

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [escenarioId]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${escenarioId}' no encontrado.`);
  }
  const orig = mapRowToEscenario(escRes[0].values[0]);

  const propRes = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ? ORDER BY created_at ASC;`,
    [escenarioId]
  );
  const origProps: PropuestaCalce[] = propRes.length ? propRes[0].values.map(mapRowToPropuesta) : [];

  const nowIso = new Date().toISOString();
  const nuevoEscenarioId = `esc_${orig.periodo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const nombreFinal = String(nuevoNombre || '').trim() || `${orig.nombre} (Copia)`;

  const nuevasProps: PropuestaCalce[] = origProps.map((p, idx) => ({
    ...p,
    id: `prop_${nuevoEscenarioId}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
    escenarioId: nuevoEscenarioId,
    estado: p.bloqueaConsolidacion ? 'BLOQUEADA' : 'PROPUESTA',
    createdAt: nowIso,
    updatedAt: nowIso
  }));

  const resumenMetricas = calcularResumenMetricasEscenario(nuevasProps);
  const nuevoEscenario: EscenarioCalce = {
    id: nuevoEscenarioId,
    periodo: orig.periodo,
    nombre: nombreFinal,
    descripcion: orig.descripcion,
    estado: 'BORRADOR',
    creadoPor: usuarioActor || orig.creadoPor,
    resumenMetricas,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  db.run('BEGIN TRANSACTION;');
  try {
    db.run(
      `INSERT INTO escenarios_calce (
        id, periodo, nombre, descripcion, estado, creado_por, aprobado_por,
        consolidado_por, fecha_consolidacion, resumen_metricas_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, ?);`,
      [
        nuevoEscenario.id,
        nuevoEscenario.periodo,
        nuevoEscenario.nombre,
        nuevoEscenario.descripcion || null,
        nuevoEscenario.estado,
        nuevoEscenario.creadoPor || null,
        JSON.stringify(resumenMetricas),
        nuevoEscenario.createdAt ?? null,
        nuevoEscenario.updatedAt ?? null
      ]
    );

    for (const p of nuevasProps) {
      db.run(
        `INSERT INTO propuestas_calce (
          id, escenario_id, periodo, solicitud_movilidad_id, docente_origen_id, run_docente,
          nombre_docente, rbd_origen, rbd_destino, vacante_destino_id, egreso_origen_id,
          tipo_cobertura, horas_asignadas, minutos_asignados, horas_pedagogicas_aula,
          fuente_destino, indice_compatibilidad, genera_rebote, vacante_rebote_json,
          alertas_normativas_json, bloquea_consolidacion, motivo_bloqueo, estado,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          p.id,
          p.escenarioId,
          p.periodo,
          p.solicitudMovilidadId || null,
          p.docenteOrigenId,
          p.runDocente,
          p.nombreDocente,
          p.rbdOrigen,
          p.rbdDestino,
          p.vacanteDestinoId || null,
          p.egresoOrigenId || null,
          p.tipoCobertura,
          p.horasAsignadas,
          p.minutosAsignados,
          p.horasPedagogicasAula,
          p.fuenteDestino,
          p.indiceCompatibilidad,
          p.generaRebote ? 1 : 0,
          p.vacanteRebote ? JSON.stringify(p.vacanteRebote) : null,
          JSON.stringify(p.alertasNormativas || []),
          p.bloqueaConsolidacion ? 1 : 0,
          p.motivoBloqueo || null,
          p.estado,
          p.createdAt ?? null,
          p.updatedAt ?? null
        ]
      );
    }

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  if (isSupabaseEnabled()) {
    supabase
      .from('escenarios_calce')
      .upsert(mapEscenarioToSupabase(nuevoEscenario), { onConflict: 'id' })
      .then(() => {
        if (nuevasProps.length > 0) {
          return supabase
            .from('propuestas_calce')
            .upsert(nuevasProps.map(mapPropuestaToSupabase), { onConflict: 'id' });
        }
      }, (err: any) => console.warn('[movilidadTerritorialService] Aviso duplicando escenario Supabase:', err));
  }

  return nuevoEscenario;
}

export async function listarPropuestasEscenario(
  escenarioId: string,
  rolActor: RolId
): Promise<PropuestaCalce[]> {
  assertRolNivelCentral(rolActor, 'listar propuestas de un escenario');
  const db = await getDb();
  const res = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ? ORDER BY created_at ASC;`,
    [escenarioId]
  );
  if (!res.length) return [];
  return res[0].values.map(mapRowToPropuesta);
}

export async function agregarPropuestaCalce(
  params: {
    escenarioId: string;
    periodo: number;
    docenteOrigenId: string;
    vacanteDestinoId: string;
    solicitudMovilidadId?: string;
    egresoOrigenId?: string;
    tipoCobertura?: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL';
    esTrasladoCompleto?: boolean;
  },
  rolActor: RolId
): Promise<PropuestaCalce> {
  assertRolNivelCentral(rolActor, 'agregar propuestas de calce');
  const db = await getDb();

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    params.escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${params.escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);
  if (escenario.estado === 'CONSOLIDADO') {
    throw new Error(`El escenario '${escenario.nombre}' ya se encuentra CONSOLIDADO y no admite nuevas propuestas.`);
  }

  const periodo = params.periodo || escenario.periodo || 2027;

  const [establecimientos, todosDocentes, todasAsignaciones] = await Promise.all([
    listarEstablecimientos(),
    listarTodosLosDocentesTerritorio(periodo),
    listarTodasLasAsignaciones(periodo)
  ]);

  const docenteOrigen = todosDocentes.find(d => d.id === params.docenteOrigenId);
  if (!docenteOrigen) {
    throw new Error(`Docente de origen '${params.docenteOrigenId}' no encontrado en el período ${periodo}.`);
  }

  const vacanteDestino = todosDocentes.find(d => d.id === params.vacanteDestinoId);
  if (!vacanteDestino) {
    throw new Error(`Vacante de destino '${params.vacanteDestinoId}' no encontrada en el período ${periodo}.`);
  }

  // Cargar solicitud si se especificó
  let solicitud: SolicitudMovilidad | undefined;
  if (params.solicitudMovilidadId) {
    const solRes = db.exec(`SELECT ${SOLICITUD_SELECT_COLS} FROM solicitudes_movilidad WHERE id = ? LIMIT 1;`, [
      params.solicitudMovilidadId
    ]);
    if (solRes.length && solRes[0].values.length) {
      solicitud = mapRowToSolicitud(solRes[0].values[0]);
    }
  }

  // Cargar egreso asociado si existe en params o en origenEgresoId de la vacante
  const egresoIdRef = params.egresoOrigenId || vacanteDestino.origenEgresoId;
  let egresoAsociado: EgresoProyectadoInput | undefined;
  if (egresoIdRef) {
    const egrRes = db.exec(`SELECT ${EGRESO_SELECT_COLS} FROM egresos_proyectados WHERE id = ? LIMIT 1;`, [
      egresoIdRef
    ]);
    if (egrRes.length && egrRes[0].values.length) {
      const egr = mapRowToEgreso(egrRes[0].values[0]);
      egresoAsociado = {
        causal: egr.causal,
        certeza: egr.certeza,
        excepcionJubilacion3Anios: egr.excepcionJubilacion3Anios,
        fechaCese: egr.fechaCese,
        numeroDecreto: egr.numeroDecreto,
        horasLiberadas: egr.horasLiberadas,
        impactoPresupuestario: egr.impactoPresupuestario
      };
    }
  }

  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [e.rbd, e]));
  const estOrigen = estMap.get(docenteOrigen.rbd);
  const estDestino = estMap.get(vacanteDestino.rbd);

  // Calcular horas en otros establecimientos del mismo RUN (para tope 44h / 2640 min)
  const runNormOrigen = claveRunNormalizado(docenteOrigen.run);
  const otrosContratos = todosDocentes.filter(d => {
    if (d.id === docenteOrigen.id || d.id === vacanteDestino.id) return false;
    if (d.esVacanteNn || d.vacanteCondicional) return false;
    if (!esSituacionFinalActiva(d.situacionFinalGdp)) return false;
    const rNorm = claveRunNormalizado(d.run);
    return Boolean(runNormOrigen) && rNorm === runNormOrigen;
  });
  const horasOtrosEstablecimientos = otrosContratos.reduce((s, d) => s + Number(d.horasContrato || 0), 0);

  const esTrasladoCompleto = params.esTrasladoCompleto !== false;
  const horasConservadasEnOrigen = esTrasladoCompleto
    ? 0
    : Math.max(0, Number(docenteOrigen.horasContrato || 0) - Number(vacanteDestino.horasContrato || 0));

  const asigsVacanteDestino = todasAsignaciones.filter(
    a => a.rbd === vacanteDestino.rbd && (a.docenteId === vacanteDestino.id || (a.tieneCoDocente && a.coDocenteId === vacanteDestino.id))
  );
  const horasPedagogicasVacante =
    asigsVacanteDestino.filter(a => !a.esTrabajoColaborativo).reduce((s, a) => s + Number(a.horasPedagogicasAula || 0), 0) ||
    Number(vacanteDestino.horasAula || 0);

  const fuenteOrigen = inferirFuenteDocenteCalce(docenteOrigen);
  const fuenteDestino = normalizarFuenteDestino(vacanteDestino);
  const tipoCobertura: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL' =
    params.tipoCobertura ?? (docenteOrigen.calidadJuridica === 'TITULAR' ? 'DEFINITIVA' : 'TRANSITORIA_CONDICIONAL');

  const horasTitularesActuales =
    solicitud?.horasTitularesActuales ??
    (Number(docenteOrigen.horasSubvencionGeneralTitular || 0) +
      Number(docenteOrigen.horasSepTitular || 0) +
      Number(docenteOrigen.horasPieTitular || 0) ||
      (docenteOrigen.calidadJuridica === 'TITULAR' ? docenteOrigen.horasContrato : 0));

  const evaluacion = evaluarCalceDocenteVacante({
    docenteId: docenteOrigen.id,
    calidadJuridica: docenteOrigen.calidadJuridica,
    asignaturaDocente: docenteOrigen.asignaturaPrincipal || docenteOrigen.funcionPrincipal,
    tituloMencion: solicitud?.tituloMencion || docenteOrigen.titulo,
    aplicaArticulo69: solicitud?.aplicaArticulo69 ?? Boolean(docenteOrigen.aplicaArticulo69),
    horasContratoActual: docenteOrigen.horasContrato,
    horasTitularesActuales,
    horasOtrosEstablecimientos,
    horasConservadasEnOrigen,
    fuenteOrigen,
    comunaOrigen: estOrigen?.comuna || solicitud?.comunaOrigen,
    carril: solicitud?.carril,
    esTrasladoCompleto,
    vacanteId: vacanteDestino.id,
    rbdDestino: vacanteDestino.rbd,
    horasVacante: vacanteDestino.horasContrato,
    horasPedagogicasVacante,
    asignaturaVacante: vacanteDestino.asignaturaPrincipal || vacanteDestino.apellidos,
    fuenteDestino,
    porcentajePrioritariosDestino: estDestino?.porcentajePrioritarios ?? 75,
    comunaDestino: estDestino?.comuna,
    esVacanteCondicional:
      vacanteDestino.vacanteCondicional === true ||
      (vacanteDestino.tipoVacante === 'CONDICIONAL_EGRESO' && vacanteDestino.vacanteCondicional !== false),
    egresoAsociado,
    tipoCobertura
  });

  const generaRebote = esTrasladoCompleto && docenteOrigen.rbd !== vacanteDestino.rbd;
  let vacanteRebote: VacanteRebotePlan | undefined;
  if (generaRebote) {
    const asignacionesOrigen = todasAsignaciones.filter(
      a => a.rbd === docenteOrigen.rbd && (a.docenteId === docenteOrigen.id || (a.tieneCoDocente && a.coDocenteId === docenteOrigen.id))
    );
    const fuenteRebote = normalizarFuenteDestino(docenteOrigen);
    vacanteRebote = construirVacanteRebotePlan(docenteOrigen, estOrigen, asignacionesOrigen, fuenteRebote);
  }

  const nowIso = new Date().toISOString();
  const propuesta: PropuestaCalce = {
    id: `prop_${params.escenarioId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    escenarioId: params.escenarioId,
    periodo,
    solicitudMovilidadId: params.solicitudMovilidadId,
    docenteOrigenId: docenteOrigen.id,
    runDocente: docenteOrigen.run,
    nombreDocente: `${docenteOrigen.nombres} ${docenteOrigen.apellidos}`.trim(),
    rbdOrigen: docenteOrigen.rbd,
    rbdDestino: vacanteDestino.rbd,
    vacanteDestinoId: vacanteDestino.id,
    egresoOrigenId: egresoIdRef,
    tipoCobertura,
    horasAsignadas: vacanteDestino.horasContrato,
    minutosAsignados: evaluacion.minutosVacante,
    horasPedagogicasAula: horasPedagogicasVacante,
    fuenteDestino,
    indiceCompatibilidad: evaluacion.indiceCompatibilidad,
    generaRebote,
    vacanteRebote,
    alertasNormativas: evaluacion.alertasNormativas,
    bloqueaConsolidacion: evaluacion.bloqueaConsolidacion,
    motivoBloqueo: evaluacion.motivoBloqueo,
    estado: evaluacion.bloqueaConsolidacion ? 'BLOQUEADA' : 'PROPUESTA',
    createdAt: nowIso,
    updatedAt: nowIso
  };

  let escenarioActualizado: EscenarioCalce | null = null;
  db.run('BEGIN TRANSACTION;');
  try {
    db.run(
      `INSERT INTO propuestas_calce (
        id, escenario_id, periodo, solicitud_movilidad_id, docente_origen_id, run_docente,
        nombre_docente, rbd_origen, rbd_destino, vacante_destino_id, egreso_origen_id,
        tipo_cobertura, horas_asignadas, minutos_asignados, horas_pedagogicas_aula,
        fuente_destino, indice_compatibilidad, genera_rebote, vacante_rebote_json,
        alertas_normativas_json, bloquea_consolidacion, motivo_bloqueo, estado,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        propuesta.id,
        propuesta.escenarioId,
        propuesta.periodo,
        propuesta.solicitudMovilidadId || null,
        propuesta.docenteOrigenId,
        propuesta.runDocente,
        propuesta.nombreDocente,
        propuesta.rbdOrigen,
        propuesta.rbdDestino,
        propuesta.vacanteDestinoId || null,
        propuesta.egresoOrigenId || null,
        propuesta.tipoCobertura,
        propuesta.horasAsignadas,
        propuesta.minutosAsignados,
        propuesta.horasPedagogicasAula,
        propuesta.fuenteDestino,
        propuesta.indiceCompatibilidad,
        propuesta.generaRebote ? 1 : 0,
        propuesta.vacanteRebote ? JSON.stringify(propuesta.vacanteRebote) : null,
        JSON.stringify(propuesta.alertasNormativas || []),
        propuesta.bloqueaConsolidacion ? 1 : 0,
        propuesta.motivoBloqueo || null,
        propuesta.estado,
        propuesta.createdAt ?? null,
        propuesta.updatedAt ?? null
      ]
    );

    escenarioActualizado = actualizarResumenEscenarioEnDb(db, params.escenarioId, nowIso);
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  if (isSupabaseEnabled()) {
    supabase
      .from('propuestas_calce')
      .upsert(mapPropuestaToSupabase(propuesta), { onConflict: 'id' })
      .then(() => {
        if (escenarioActualizado) {
          return supabase
            .from('escenarios_calce')
            .update({
              resumen_metricas_json: escenarioActualizado.resumenMetricas || null,
              updated_at: nowIso
            })
            .eq('id', params.escenarioId);
        }
      }, (err: any) => console.warn('[movilidadTerritorialService] Aviso sync propuesta Supabase:', err));
  }

  return propuesta;
}

export async function eliminarPropuestaCalce(propuestaId: string, rolActor: RolId): Promise<void> {
  assertRolNivelCentral(rolActor, 'eliminar propuestas de calce');
  const db = await getDb();

  const res = db.exec('SELECT escenario_id FROM propuestas_calce WHERE id = ? LIMIT 1;', [propuestaId]);
  if (!res.length || !res[0].values.length) {
    return;
  }
  const escenarioId = String(res[0].values[0][0]);

  const escRes = db.exec('SELECT estado FROM escenarios_calce WHERE id = ? LIMIT 1;', [escenarioId]);
  if (escRes.length && escRes[0].values.length && String(escRes[0].values[0][0]) === 'CONSOLIDADO') {
    throw new Error('No se puede eliminar propuestas de un escenario que ya fue CONSOLIDADO.');
  }

  const nowIso = new Date().toISOString();
  let escenarioActualizado: EscenarioCalce | null = null;
  db.run('BEGIN TRANSACTION;');
  try {
    db.run('DELETE FROM propuestas_calce WHERE id = ?;', [propuestaId]);
    escenarioActualizado = actualizarResumenEscenarioEnDb(db, escenarioId, nowIso);
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  if (isSupabaseEnabled()) {
    supabase
      .from('propuestas_calce')
      .delete()
      .eq('id', propuestaId)
      .then(() => {
        if (escenarioActualizado) {
          return supabase
            .from('escenarios_calce')
            .update({
              resumen_metricas_json: escenarioActualizado.resumenMetricas || null,
              updated_at: nowIso
            })
            .eq('id', escenarioId);
        }
      }, (err: any) => console.warn('[movilidadTerritorialService] Aviso delete propuesta Supabase:', err));
  }
}

export async function generarSugerenciasCalceAutomatico(
  escenarioId: string,
  periodo: number = 2027,
  rolActor: RolId
): Promise<PropuestaCalce[]> {
  assertRolNivelCentral(rolActor, 'generar sugerencias de calce automático');

  const flags = obtenerFeatureFlagsMovilidad();
  if (!flags.flag_simulador_calce_automatico) {
    throw new Error('El simulador de calce automático está desactivado (flag_simulador_calce_automatico = false).');
  }

  const db = await getDb();
  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [escenarioId]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);
  if (escenario.estado === 'CONSOLIDADO') {
    throw new Error('No se pueden generar sugerencias sobre un escenario ya CONSOLIDADO.');
  }

  const propuestasExistentes = await listarPropuestasEscenario(escenarioId, rolActor);
  const docentesUsados = new Set(propuestasExistentes.map(p => p.docenteOrigenId));
  const vacantesUsadas = new Set(propuestasExistentes.map(p => p.vacanteDestinoId).filter(Boolean) as string[]);

  const [solicitudes, establecimientos, todosDocentes, todasAsignaciones, egresos] = await Promise.all([
    listarSolicitudesMovilidad(periodo, rolActor),
    listarEstablecimientos(),
    listarTodosLosDocentesTerritorio(periodo),
    listarTodasLasAsignaciones(periodo),
    listarEgresosProyectados(periodo, rolActor)
  ]);

  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [e.rbd, e]));
  const docMap = new Map<string, Docente>(todosDocentes.map(d => [d.id, d]));
  const egresoMap = new Map<string, EgresoProyectado>(egresos.map(e => [e.id, e]));

  const solicitudesActivas = solicitudes.filter(
    s =>
      s.estadoFlujo !== 'CONSOLIDADO' &&
      s.estadoFlujo !== 'RECHAZADO' &&
      !docentesUsados.has(s.docenteId) &&
      docMap.has(s.docenteId)
  );

  const vacantesAbiertas = todosDocentes.filter(
    d => (Boolean(d.esVacanteNn) || detectarDocenteVacanteNn(d).esVacanteNn) && !vacantesUsadas.has(d.id)
  );

  if (solicitudesActivas.length === 0 || vacantesAbiertas.length === 0) {
    return [];
  }

  // Mapa rápido de horas por RUN para detectar multi-escuela
  const horasPorRun = new Map<string, Array<{ id: string; horas: number }>>();
  for (const d of todosDocentes) {
    if (d.esVacanteNn || d.vacanteCondicional || !esSituacionFinalActiva(d.situacionFinalGdp)) continue;
    const kRun = claveRunNormalizado(d.run);
    if (!kRun) continue;
    const list = horasPorRun.get(kRun) || [];
    list.push({ id: d.id, horas: Number(d.horasContrato || 0) });
    horasPorRun.set(kRun, list);
  }

  const candidatosPorId = new Map<string, { solicitud: SolicitudMovilidad; candidato: DocenteCandidatoCalce }>();
  for (const sol of solicitudesActivas) {
    const doc = docMap.get(sol.docenteId);
    if (!doc) continue;
    const kRun = claveRunNormalizado(doc.run);
    const otrosHoras = (horasPorRun.get(kRun) || [])
      .filter(x => x.id !== doc.id)
      .reduce((s, x) => s + x.horas, 0);

    const estOrig = estMap.get(doc.rbd);
    const esTrasladoComp = sol.carril !== 'HORAS_REMANENTES';

    const candidato: DocenteCandidatoCalce = {
      docenteId: doc.id,
      calidadJuridica: doc.calidadJuridica,
      asignaturaDocente: sol.asignaturaPrincipal || doc.asignaturaPrincipal || doc.funcionPrincipal,
      tituloMencion: sol.tituloMencion || doc.titulo,
      aplicaArticulo69: sol.aplicaArticulo69 ?? Boolean(doc.aplicaArticulo69),
      horasContratoActual: doc.horasContrato,
      horasTitularesActuales: sol.horasTitularesActuales,
      horasOtrosEstablecimientos: otrosHoras,
      horasConservadasEnOrigen: esTrasladoComp ? 0 : doc.horasContrato,
      fuenteOrigen: inferirFuenteDocenteCalce(doc),
      comunaOrigen: sol.comunaOrigen || estOrig?.comuna,
      carril: sol.carril,
      esTrasladoCompleto: esTrasladoComp,
      prioridadMovilidad: {
        carril: sol.carril,
        puntajeSalud: sol.puntajeSalud,
        puntajeLeyKarin: sol.puntajeLeyKarin,
        puntajeCuidadoDependientes: sol.puntajeCuidadoDependientes,
        puntajeDistanciaRural: sol.puntajeDistanciaRural,
        puntajeAntiguedad: sol.puntajeAntiguedad,
        horasRemanentes: sol.horasRemanentes
      }
    };
    candidatosPorId.set(doc.id, { solicitud: sol, candidato });
  }

  const propuestasCreadas: PropuestaCalce[] = [];

  for (const vacante of vacantesAbiertas) {
    if (vacantesUsadas.has(vacante.id)) continue;

    const candidatosDisponibles = Array.from(candidatosPorId.values())
      .filter(c => !docentesUsados.has(c.candidato.docenteId))
      .map(c => c.candidato);

    if (candidatosDisponibles.length === 0) break;

    const estDest = estMap.get(vacante.rbd);
    const egr = vacante.origenEgresoId ? egresoMap.get(vacante.origenEgresoId) : undefined;
    const egresoAsociado: EgresoProyectadoInput | undefined = egr
      ? {
          causal: egr.causal,
          certeza: egr.certeza,
          excepcionJubilacion3Anios: egr.excepcionJubilacion3Anios,
          fechaCese: egr.fechaCese,
          numeroDecreto: egr.numeroDecreto,
          horasLiberadas: egr.horasLiberadas,
          impactoPresupuestario: egr.impactoPresupuestario
        }
      : undefined;

    const asigsVac = todasAsignaciones.filter(
      a => a.rbd === vacante.rbd && (a.docenteId === vacante.id || (a.tieneCoDocente && a.coDocenteId === vacante.id))
    );
    const horasPedVac =
      asigsVac.filter(a => !a.esTrabajoColaborativo).reduce((s, a) => s + Number(a.horasPedagogicasAula || 0), 0) ||
      Number(vacante.horasAula || 0);

    const vacanteObj: VacanteObjetivoCalce = {
      vacanteId: vacante.id,
      rbdDestino: vacante.rbd,
      horasVacante: vacante.horasContrato,
      horasPedagogicasVacante: horasPedVac,
      asignaturaVacante: vacante.asignaturaPrincipal || vacante.apellidos,
      fuenteDestino: normalizarFuenteDestino(vacante),
      porcentajePrioritariosDestino: estDest?.porcentajePrioritarios ?? 75,
      comunaDestino: estDest?.comuna,
      esVacanteCondicional:
        vacante.vacanteCondicional === true ||
        (vacante.tipoVacante === 'CONDICIONAL_EGRESO' && vacante.vacanteCondicional !== false),
      egresoAsociado
    };

    const sugerencias = sugerirCalcesAutomaticos(candidatosDisponibles, vacanteObj, 55, 5);
    const mejor = sugerencias.find(s => !s.evaluacion.bloqueaConsolidacion);
    if (!mejor) continue;

    const infoCand = candidatosPorId.get(mejor.candidato.docenteId);
    if (!infoCand) continue;

    const prop = await agregarPropuestaCalce(
      {
        escenarioId,
        periodo,
        docenteOrigenId: mejor.candidato.docenteId,
        vacanteDestinoId: vacante.id,
        solicitudMovilidadId: infoCand.solicitud.id,
        egresoOrigenId: vacante.origenEgresoId,
        tipoCobertura:
          mejor.candidato.calidadJuridica === 'TITULAR' && !vacanteObj.esVacanteCondicional
            ? 'DEFINITIVA'
            : 'TRANSITORIA_CONDICIONAL',
        esTrasladoCompleto: mejor.candidato.esTrasladoCompleto
      },
      rolActor
    );

    docentesUsados.add(mejor.candidato.docenteId);
    vacantesUsadas.add(vacante.id);
    propuestasCreadas.push(prop);
  }

  return propuestasCreadas;
}

export async function consolidarEscenarioAprobado(params: {
  escenarioId: string;
  rolActor: RolId;
  usuarioActor: string;
}): Promise<{
  propuestasConsolidadas: number;
  vacantesReemplazadas: number;
  rebotesCreados: number;
  rbdsAfectados: string[];
}> {
  assertRolConsolidador(params.rolActor, 'consolidar un escenario aprobado');

  const db = await getDb();
  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    params.escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${params.escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);
  if (escenario.estado === 'CONSOLIDADO') {
    throw new Error(`El escenario '${escenario.nombre}' ya fue consolidado previamente.`);
  }

  const propRes = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ? ORDER BY created_at ASC;`,
    [params.escenarioId]
  );
  const propuestas: PropuestaCalce[] = propRes.length ? propRes[0].values.map(mapRowToPropuesta) : [];

  if (propuestas.length === 0) {
    throw new Error('El escenario no contiene propuestas de calce para consolidar.');
  }

  const bloqueadas = propuestas.filter(p => p.bloqueaConsolidacion);
  if (bloqueadas.length > 0) {
    const motivos = bloqueadas.map(b => b.motivoBloqueo || `${b.nombreDocente} -> ${b.rbdDestino}`).join(' | ');
    throw new Error(`Consolidación bloqueada por incumplimientos normativos: ${motivos}`);
  }

  const periodo = escenario.periodo || 2027;
  const allDocs = await listarTodosLosDocentesTerritorio(periodo);
  const docMap = new Map<string, Docente>(allDocs.map(d => [d.id, d]));

  const nowIso = new Date().toISOString();
  let propuestasConsolidadas = 0;
  let vacantesReemplazadas = 0;
  let rebotesCreados = 0;
  const rbdsAfectadosSet = new Set<string>();
  const docentesActualizadosSync: Docente[] = [];
  const docentesEliminadosIds: string[] = [];
  const solicitudesConsolidadasIds: string[] = [];

  db.run('BEGIN TRANSACTION;');
  try {
    for (const p of propuestas) {
      if (!p.vacanteDestinoId) {
        throw new Error(`La propuesta '${p.id}' no posee vacanteDestinoId.`);
      }

      const docenteOrigen = docMap.get(p.docenteOrigenId);
      if (!docenteOrigen) {
        throw new Error(`Docente de origen '${p.docenteOrigenId}' no existe en la base de datos.`);
      }

      const vacanteDestino = docMap.get(p.vacanteDestinoId);
      if (!vacanteDestino) {
        throw new Error(`Vacante de destino '${p.vacanteDestinoId}' no existe en la base de datos.`);
      }

      const calidadDestino: CalidadJuridicaDocente =
        p.tipoCobertura === 'TRANSITORIA_CONDICIONAL' && docenteOrigen.calidadJuridica !== 'TITULAR'
          ? docenteOrigen.calidadJuridica
          : docenteOrigen.calidadJuridica;

      const horasDestino = vacanteDestino.horasContrato;
      const esTitularDestino = calidadDestino === 'TITULAR';
      const fuDestino = p.fuenteDestino || normalizarFuenteDestino(vacanteDestino);

      const subvTit = fuDestino === 'SUBVENCION_GENERAL' && esTitularDestino ? horasDestino : 0;
      const subvCon = fuDestino === 'SUBVENCION_GENERAL' && !esTitularDestino ? horasDestino : 0;
      const sepTit = fuDestino === 'SEP' && esTitularDestino ? horasDestino : 0;
      const sepCon = fuDestino === 'SEP' && !esTitularDestino ? horasDestino : 0;
      const pieTit = fuDestino === 'PIE' && esTitularDestino ? horasDestino : 0;
      const pieCon = fuDestino === 'PIE' && !esTitularDestino ? horasDestino : 0;

      // 1. Reemplazar los datos del registro NN destino preservando su ID y asignaciones_horarias
      db.run(
        `UPDATE docentes
         SET run = ?, nombres = ?, apellidos = ?, titulo = ?,
             calidad_juridica = ?, aplica_articulo_69 = ?,
             horas_subvencion_general_titular = ?, horas_subvencion_general_contrata = ?,
             horas_sep_titular = ?, horas_sep_contrata = ?,
             horas_pie_titular = ?, horas_pie_contrata = ?,
             es_vacante_nn = 0, tipo_vacante = NULL, justificacion_vacante = NULL,
             vacante_condicional = 0, origen_egreso_id = NULL,
             situacion_final_gdp = 'Vigente'
         WHERE id = ?;`,
        [
          docenteOrigen.run,
          docenteOrigen.nombres,
          docenteOrigen.apellidos,
          docenteOrigen.titulo || null,
          calidadDestino,
          docenteOrigen.aplicaArticulo69 ? 1 : 0,
          subvTit,
          subvCon,
          sepTit,
          sepCon,
          pieTit,
          pieCon,
          vacanteDestino.id
        ]
      );

      const vacanteReemplazada: Docente = {
        ...vacanteDestino,
        run: docenteOrigen.run,
        nombres: docenteOrigen.nombres,
        apellidos: docenteOrigen.apellidos,
        titulo: docenteOrigen.titulo,
        calidadJuridica: calidadDestino,
        aplicaArticulo69: docenteOrigen.aplicaArticulo69,
        horasSubvencionGeneralTitular: subvTit,
        horasSubvencionGeneralContrata: subvCon,
        horasSepTitular: sepTit,
        horasSepContrata: sepCon,
        horasPieTitular: pieTit,
        horasPieContrata: pieCon,
        esVacanteNn: false,
        tipoVacante: undefined,
        justificacionVacante: undefined,
        vacanteCondicional: false,
        origenEgresoId: undefined,
        situacionFinalGdp: 'Vigente'
      };
      docentesActualizadosSync.push(vacanteReemplazada);
      vacantesReemplazadas++;
      rbdsAfectadosSet.add(p.rbdDestino);

      // 2. Si genera rebote en otro establecimiento, crear NN-Rebote en origen, re-apuntar asignaciones y retirar fila origen
      if (p.generaRebote && p.vacanteRebote && p.rbdOrigen !== p.rbdDestino) {
        const reb = p.vacanteRebote;
        const sufijo = `${p.id.slice(-4).toUpperCase()}${rebotesCreados}`;
        const reboteId = `vac_reb_${p.rbdOrigen}_${periodo}_${p.id.slice(-6)}_${rebotesCreados}`;
        const reboteRun = `REB-${p.rbdOrigen}-${sufijo}`;
        const horasReb = Math.max(1, Math.min(44, Math.round(Number(reb.horasContratoRebote || docenteOrigen.horasContrato))));
        const fReb = reb.fuenteFinanciamiento || 'SUBVENCION_GENERAL';

        const normFuentesReb = normalizarFuentesFinanciamientoDocente(
          horasReb,
          'CONTRATA',
          0,
          fReb === 'SUBVENCION_GENERAL' ? horasReb : 0,
          0,
          fReb === 'SEP' ? horasReb : 0,
          0,
          fReb === 'PIE' ? horasReb : 0
        );

        const funcionesNoAulaJson =
          reb.funcionesNoLectivasHeredadas && reb.funcionesNoLectivasHeredadas.length > 0
            ? JSON.stringify(reb.funcionesNoLectivasHeredadas)
            : null;

        db.run(
          `INSERT INTO docentes (
            id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
            horas_subvencion_general_titular, horas_subvencion_general_contrata,
            horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
            horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
            horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
            horas_taller_sep, horas_trabajo_colaborativo, horas_aula, horas_ingles,
            funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
            funciones_no_aula_json, periodo, propuesta_gdp, estado_sancion_gdp, situacion_final_gdp,
            es_vacante_nn, tipo_vacante, justificacion_vacante, vacante_condicional
          ) VALUES (?, ?, ?, ?, ?, NULL, 'CONTRATA', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'Vacante por proveer', 'Pendiente', 'Vigente', 1, 'REBOTE_MOVILIDAD', ?, 0);`,
          [
            reboteId,
            p.rbdOrigen,
            reboteRun,
            'VACANTE REBOTE',
            (reb.asignaturaPrincipal || docenteOrigen.asignaturaPrincipal || 'DOCENTE AULA').toUpperCase(),
            docenteOrigen.estamento || 'DOCENTE_AULA',
            horasReb,
            normFuentesReb.subvGenTitular,
            normFuentesReb.subvGenContrata,
            normFuentesReb.sepTitular,
            normFuentesReb.sepContrata,
            normFuentesReb.pieTitular,
            normFuentesReb.pieContrata,
            docenteOrigen.horasDirectivas || 0,
            docenteOrigen.horasInspectorGeneral || 0,
            docenteOrigen.horasTecnicoPedagogicas || 0,
            docenteOrigen.horasCoordinacion || 0,
            docenteOrigen.tipoCoordinacion || null,
            docenteOrigen.horasCoordinacionPie || 0,
            docenteOrigen.horasConvivenciaEscolar || 0,
            docenteOrigen.horasExtraescolar || 0,
            docenteOrigen.cargoInstitucional || null,
            docenteOrigen.horasTallerSep || 0,
            docenteOrigen.horasTrabajoColaborativo || 0,
            reb.horasPedagogicasAula || docenteOrigen.horasAula || 0,
            docenteOrigen.horasIngles || 0,
            docenteOrigen.funcionPrincipal || null,
            docenteOrigen.funcionSecundaria || null,
            reb.asignaturaPrincipal || docenteOrigen.asignaturaPrincipal || null,
            funcionesNoAulaJson,
            periodo,
            `Vacante de rebote generada por traslado de ${docenteOrigen.nombres} ${docenteOrigen.apellidos} hacia RBD ${p.rbdDestino} (Escenario ${escenario.nombre}).`
          ]
        );

        // Re-apuntar las asignaciones_horarias del docente origen hacia la nueva NN-Rebote
        db.run(
          `UPDATE asignaciones_horarias
           SET docente_id = ?
           WHERE docente_id = ? AND rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027));`,
          [reboteId, docenteOrigen.id, p.rbdOrigen, periodo, periodo]
        );
        db.run(
          `UPDATE asignaciones_horarias
           SET co_docente_id = ?
           WHERE co_docente_id = ? AND rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027));`,
          [reboteId, docenteOrigen.id, p.rbdOrigen, periodo, periodo]
        );

        // Retirar fila origen del docente trasladado (cuando el traslado desde origen fue completo)
        if (horasReb >= docenteOrigen.horasContrato) {
          db.run('DELETE FROM docentes WHERE id = ?;', [docenteOrigen.id]);
          docentesEliminadosIds.push(docenteOrigen.id);
        }

        docentesActualizadosSync.push({
          id: reboteId,
          rbd: p.rbdOrigen,
          periodo,
          run: reboteRun,
          nombres: 'VACANTE REBOTE',
          apellidos: (reb.asignaturaPrincipal || docenteOrigen.asignaturaPrincipal || 'DOCENTE AULA').toUpperCase(),
          calidadJuridica: 'CONTRATA',
          estamento: docenteOrigen.estamento || 'DOCENTE_AULA',
          horasContrato: horasReb,
          horasSubvencionGeneralTitular: normFuentesReb.subvGenTitular,
          horasSubvencionGeneralContrata: normFuentesReb.subvGenContrata,
          horasSepTitular: normFuentesReb.sepTitular,
          horasSepContrata: normFuentesReb.sepContrata,
          horasPieTitular: normFuentesReb.pieTitular,
          horasPieContrata: normFuentesReb.pieContrata,
          horasDirectivas: docenteOrigen.horasDirectivas,
          horasInspectorGeneral: docenteOrigen.horasInspectorGeneral,
          horasTecnicoPedagogicas: docenteOrigen.horasTecnicoPedagogicas,
          horasCoordinacion: docenteOrigen.horasCoordinacion,
          horasTallerSep: docenteOrigen.horasTallerSep,
          horasTrabajoColaborativo: docenteOrigen.horasTrabajoColaborativo,
          horasCoordinacionPie: docenteOrigen.horasCoordinacionPie,
          horasConvivenciaEscolar: docenteOrigen.horasConvivenciaEscolar,
          horasExtraescolar: docenteOrigen.horasExtraescolar,
          funcionesNoAula: reb.funcionesNoLectivasHeredadas,
          asignaturaPrincipal: reb.asignaturaPrincipal || docenteOrigen.asignaturaPrincipal,
          esVacanteNn: true,
          tipoVacante: 'REBOTE_MOVILIDAD',
          vacanteCondicional: false
        });

        rebotesCreados++;
        rbdsAfectadosSet.add(p.rbdOrigen);
      }

      // 3. Marcar propuesta y solicitud como CONSOLIDADAS
      db.run("UPDATE propuestas_calce SET estado = 'CONSOLIDADA', updated_at = ? WHERE id = ?;", [nowIso, p.id]);
      if (p.solicitudMovilidadId) {
        db.run("UPDATE solicitudes_movilidad SET estado_flujo = 'CONSOLIDADO', updated_at = ? WHERE id = ?;", [
          nowIso,
          p.solicitudMovilidadId
        ]);
        solicitudesConsolidadasIds.push(p.solicitudMovilidadId);
      }

      propuestasConsolidadas++;
    }

    db.run(
      `UPDATE escenarios_calce
       SET estado = 'CONSOLIDADO', consolidado_por = ?, fecha_consolidacion = ?, updated_at = ?
       WHERE id = ?;`,
      [params.usuarioActor, nowIso, nowIso, params.escenarioId]
    );

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  const rbdsAfectados = Array.from(rbdsAfectadosSet);

  for (const rbd of rbdsAfectados) {
    await registrarEventoAuditoria({
      rbd,
      periodo,
      tipoEvento: 'TRASPASO',
      entidad: 'DOTACION_COMPLETA',
      entidadId: params.escenarioId,
      descripcion: `Consolidación atómica de escenario '${escenario.nombre}' por ${params.usuarioActor}: ${vacantesReemplazadas} vacante(s) cubiertas y ${rebotesCreados} vacante(s) de rebote.`,
      detalles: {
        escenarioId: params.escenarioId,
        usuarioActor: params.usuarioActor,
        rolActor: params.rolActor,
        propuestasConsolidadas,
        vacantesReemplazadas,
        rebotesCreados
      }
    });
  }

  if (isSupabaseEnabled()) {
    if (docentesActualizadosSync.length > 0) {
      SupabaseDotacionService.guardarDocentesBatch(docentesActualizadosSync).catch(err =>
        console.warn('[movilidadTerritorialService] Aviso sync docentes consolidación Supabase:', err)
      );
    }
    for (const delId of docentesEliminadosIds) {
      SupabaseDotacionService.eliminarDocente(delId).catch(err =>
        console.warn('[movilidadTerritorialService] Aviso delete docente origen Supabase:', err)
      );
    }
    supabase
      .from('escenarios_calce')
      .update({
        estado: 'CONSOLIDADO',
        consolidado_por: params.usuarioActor,
        fecha_consolidacion: nowIso,
        updated_at: nowIso
      })
      .eq('id', params.escenarioId)
      .then(() => {}, () => {});

    supabase
      .from('propuestas_calce')
      .update({ estado: 'CONSOLIDADA', updated_at: nowIso })
      .eq('escenario_id', params.escenarioId)
      .then(() => {}, () => {});

    if (solicitudesConsolidadasIds.length > 0) {
      supabase
        .from('solicitudes_movilidad')
        .update({ estado_flujo: 'CONSOLIDADO', updated_at: nowIso })
        .in('id', solicitudesConsolidadasIds)
        .then(() => {}, () => {});
    }
  }

  return {
    propuestasConsolidadas,
    vacantesReemplazadas,
    rebotesCreados,
    rbdsAfectados
  };
}
