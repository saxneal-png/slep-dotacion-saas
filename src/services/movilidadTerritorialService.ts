/**
 * Servicio de Orquestación de Mesa de Movilidad Territorial, Egresos de Contingencia,
 * Saneamiento de Vacantes NN, Control Optimista, Reverso Controlado y Actos GDP
 * (SLEP Valle Diguillín).
 *
 * Aislado estrictamente para roles de Nivel Central UATP / GDP / Super Usuario.
 * Toda aritmética horaria delega al motor normativo en minutos enteros (@slep/mineduc-engine).
 */

import ExcelJS from 'exceljs';
import {
  AsignacionHoraria,
  AsistenteEducacion,
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
  EstadoNecesidadVacante,
  EstadoResolucionRebote,
  EstamentoAsistente,
  EstamentoDocente,
  FuncionNoAulaDocente,
  ImpactoPresupuestarioEgreso,
  PropuestaCalce,
  RegistroMovimientoMovilidad,
  SolicitudMovilidad,
  TipoFuncionNoAula,
  TipoMovimientoMovilidad,
  TipoRequerimientoVacante,
  TramoCarreraDocente,
  VacanteRebotePlan
} from '../types';
import { RolId } from '../types/authTypes';
import { esRolNivelCentral, normalizarRol } from '../security/rolesDefinitions';
import {
  calcularJornadaMinutos,
  calcularPuntajePrioridadMovilidad,
  CarrilMovilidad as CarrilMovilidadEngine,
  detectarDocenteVacanteNn,
  determinarRegimenNormativo,
  DocenteCandidatoCalce,
  EgresoProyectadoInput,
  EstamentoAsistenteMotor,
  evaluarCalceAsistenteLey21109,
  evaluarCalceDocenteVacante,
  evaluarEgresoProyectado,
  EvaluacionJuridicaEgreso,
  FuenteFinanciamientoCalce,
  generarVacanteDeRebote,
  resolverCalceOptimoConCadenasRebote,
  ResultadoDeteccionNn,
  ResultadoEvaluacionCalce,
  ResultadoEvaluacionCalceAsistente,
  VacanteObjetivoCalce,
  VacanteReboteOutput
} from '@slep/mineduc-engine';
import {
  eliminarAsistente,
  getDb,
  guardarAsistente,
  guardarDocente,
  listarAsignaciones,
  listarAsistentes,
  listarDocentes,
  listarEstablecimientos,
  listarTodasLasAsignaciones,
  listarTodosLosAsistentesTerritorio,
  listarTodosLosDocentesTerritorio,
  obtenerAsistentePorId,
  persistDb,
  registrarEventoAuditoria
} from '../database/db';
import { obtenerFeatureFlagsMovilidad } from './configuracionGeneralService';
import { isSupabaseEnabled, supabase } from './supabaseClient';
import { SupabaseDotacionService } from './supabaseDotacionService';
import {
  normalizarFuentesFinanciamientoAsistente,
  normalizarFuentesFinanciamientoDocente
} from './auditoriaDocenteService';
import { esPropuestaNoContinuidad } from './estadisticasHorasService';
import { sanitizeExcelText } from './depHomologationEngine';
import { limpiarRutParaId, normalizarRut } from '../utils/rutUtils';

export type {
  Docente,
  AsistenteEducacion,
  Establecimiento,
  EstamentoDocente,
  EstamentoAsistente,
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
  EstadoResolucionRebote,
  RolId,
  EvaluacionJuridicaEgreso,
  ResultadoEvaluacionCalce,
  ResultadoEvaluacionCalceAsistente,
  ResultadoDeteccionNn
};

export interface DetalleTechoPisoPorRbd {
  rbd: string;
  nombreEstablecimiento: string;
  horasContratadasActivas: number;
  horasVacantesConfirmadasSinTitular: number;
  horasVacantesCondicionales: number;
  horasTechoAntes1Marzo: number;
  horasPisoSiEgresanCondicionales: number;
}

export interface ProyeccionTechoPisoHoras {
  periodo: number;
  horasContratadasActivas: number;
  horasVacantesConfirmadasSinTitular: number;
  horasVacantesCondicionales: number;
  horasTechoAntes1Marzo: number;
  horasPisoSiEgresanCondicionales: number;
  detallePorRbd: DetalleTechoPisoPorRbd[];
}

// =============================================================================
// 1. Guards y Control de Acceso por Rol (RBAC)
// =============================================================================

export function esRolNivelCentralMovilidad(rol: unknown): boolean {
  return esRolNivelCentral(rol);
}

export function esRolEditorMovilidad(rol: unknown): boolean {
  const raw = typeof rol === 'string' ? rol.trim().toLowerCase() : '';
  if (raw === 'auditor' || raw === 'visualizador') return false;
  return esRolNivelCentralMovilidad(rol);
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

export function assertRolEditorMovilidad(rol: unknown, accion: string): void {
  if (!esRolEditorMovilidad(rol)) {
    throw new Error(
      `Acceso denegado: el rol '${String(rol ?? '')}' no tiene permisos de edición en Mesa de Movilidad para ${accion}.`
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
// 2. Helpers de Normalización, Filtro Anti-Doble-Conteo y Resiliencia Supabase
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

function mapCarrilAEngine(carril: CarrilMovilidad): CarrilMovilidadEngine {
  return carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO'
    ? 'NO_CONTINUIDAD_TITULAR'
    : carril;
}

function mapCarrilAsistenteMotor(
  carril?: CarrilMovilidad
): 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO' | 'TRASLADO_VOLUNTARIO' | 'HORAS_REMANENTES' | undefined {
  if (!carril) return undefined;
  if (carril === 'NO_CONTINUIDAD_TITULAR') return 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO';
  return carril;
}

function esErrorColumnaFaltanteSupabase(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || err.details || '');
  return (
    code === 'PGRST204' ||
    code === '42703' ||
    /column .* does not exist|Could not find the .* column/i.test(msg)
  );
}

function esErrorFuncionNoEncontradaSupabase(err: any): boolean {
  if (!err) return false;
  const code = String(err.code || '');
  const msg = String(err.message || err.details || '');
  return (
    code === 'PGRST202' ||
    code === '42883' ||
    /Could not find the function/i.test(msg)
  );
}

function construirErrorConflictoVersion(
  esperada: number | undefined,
  actual: number
): Error {
  return new Error(
    `CONFLICTO_VERSION: El escenario fue modificado por otro usuario (versión esperada ${esperada}, actual ${actual}).`
  );
}

export type OpSyncMovilidad =
  | { tabla: string; operacion: 'upsert'; payload: any; onConflict?: string }
  | {
      tabla: string;
      operacion: 'update';
      payload: any;
      match: Record<string, string | number | string[]>;
    }
  | {
      tabla: string;
      operacion: 'delete';
      match: Record<string, string | number | string[]>;
    }
  | {
      tabla:
        | 'guardarDocentesBatch'
        | 'eliminarDocente'
        | 'guardarAsistentesBatch'
        | 'eliminarAsistente';
      operacion: 'servicio';
      payload: any;
    };

async function ejecutarOpSyncMovilidad(op: OpSyncMovilidad): Promise<void> {
  if (op.operacion === 'servicio') {
    switch (op.tabla) {
      case 'guardarDocentesBatch':
        await SupabaseDotacionService.guardarDocentesBatch(op.payload);
        return;
      case 'eliminarDocente':
        await SupabaseDotacionService.eliminarDocente(op.payload);
        return;
      case 'guardarAsistentesBatch':
        await SupabaseDotacionService.guardarAsistentesBatch(op.payload);
        return;
      case 'eliminarAsistente':
        await SupabaseDotacionService.eliminarAsistente(op.payload);
        return;
    }
  }

  if (op.operacion === 'upsert') {
    const res = await supabase
      .from(op.tabla)
      .upsert(op.payload, op.onConflict ? { onConflict: op.onConflict } : undefined);
    if (res?.error) throw res.error;
    return;
  }

  let query: any =
    op.operacion === 'update'
      ? supabase.from(op.tabla).update(op.payload)
      : supabase.from(op.tabla).delete();

  for (const [k, v] of Object.entries(op.match || {})) {
    query = Array.isArray(v) ? query.in(k, v) : query.eq(k, v);
  }

  const res = await query;
  if (res?.error) throw res.error;
}

export async function syncSupabaseMovilidad(
  op: OpSyncMovilidad,
  etiqueta: string
): Promise<boolean> {
  if (!isSupabaseEnabled()) return true;

  try {
    await ejecutarOpSyncMovilidad(op);
    return true;
  } catch (err: any) {
    console.warn(`[movilidadTerritorialService] Aviso sync Supabase (${etiqueta}):`, err);
    try {
      const db = await getDb();
      const nowIso = new Date().toISOString();
      const id = `sync_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const msgErr = `${etiqueta}: ${String(err?.message || err || 'Error de sincronización')}`;
      const payloadJson = JSON.stringify(('payload' in op ? op.payload : undefined) ?? null);
      const matchJson = JSON.stringify(('match' in op ? op.match : undefined) ?? null);
      const onConflict = op.operacion === 'upsert' ? op.onConflict || null : null;

      db.run(
        `INSERT INTO sync_pendientes_movilidad (
          id, tabla, operacion, payload_json, match_json, on_conflict, error, intentos, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?);`,
        [id, op.tabla, op.operacion, payloadJson, matchJson, onConflict, msgErr, nowIso, nowIso]
      );
      await persistDb(true);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('slep:movilidad_sync_pendiente'));
      }
    } catch (dbErr) {
      console.warn('[movilidadTerritorialService] No se pudo registrar sync pendiente:', dbErr);
    }
    return false;
  }
}

export async function contarSyncPendientesMovilidad(): Promise<number> {
  const db = await getDb();
  const res = db.exec('SELECT COUNT(*) FROM sync_pendientes_movilidad;');
  return Number(res[0]?.values[0]?.[0] || 0);
}

export async function reintentarSyncPendientesMovilidad(
  rolActor: RolId
): Promise<{ ok: number; fallidos: number }> {
  assertRolNivelCentral(rolActor, 'reintentar sincronización');
  if (!isSupabaseEnabled()) {
    return { ok: 0, fallidos: await contarSyncPendientesMovilidad() };
  }

  const db = await getDb();
  const res = db.exec(
    `SELECT id, tabla, operacion, payload_json, match_json, on_conflict
     FROM sync_pendientes_movilidad
     ORDER BY created_at ASC, rowid ASC;`
  );
  const rows = res[0]?.values || [];
  if (rows.length === 0) {
    return { ok: 0, fallidos: 0 };
  }

  let ok = 0;
  let fallidos = 0;

  for (const row of rows) {
    const id = String(row[0]);
    const tabla = String(row[1]);
    const operacion = String(row[2]) as OpSyncMovilidad['operacion'];
    const payload = row[3] ? JSON.parse(String(row[3])) : null;
    const match = row[4] ? JSON.parse(String(row[4])) : null;
    const onConflict = row[5] ? String(row[5]) : undefined;

    let op: OpSyncMovilidad;
    if (operacion === 'servicio') {
      op = { tabla: tabla as any, operacion: 'servicio', payload };
    } else if (operacion === 'upsert') {
      op = { tabla, operacion: 'upsert', payload, onConflict };
    } else if (operacion === 'update') {
      op = { tabla, operacion: 'update', payload, match: match || {} };
    } else {
      op = { tabla, operacion: 'delete', match: match || {} };
    }

    try {
      await ejecutarOpSyncMovilidad(op);
      db.run('DELETE FROM sync_pendientes_movilidad WHERE id = ?;', [id]);
      ok++;
    } catch (err: any) {
      const nowIso = new Date().toISOString();
      const errMsg = String(err?.message || err || 'Error al reintentar sincronización');
      db.run(
        `UPDATE sync_pendientes_movilidad
         SET intentos = COALESCE(intentos, 0) + 1, error = ?, updated_at = ?
         WHERE id = ?;`,
        [errMsg, nowIso, id]
      );
      fallidos++;
    }
  }

  await persistDb(true);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('slep:movilidad_sync_pendiente'));
  }

  return { ok, fallidos };
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

  const activosPorEscuelaPeriodo = new Map<string, Docente[]>();
  for (const d of docentes) {
    const esVacante =
      Boolean(d.esVacanteNn) ||
      Boolean(d.vacanteCondicional) ||
      d.tipoVacante === 'CONDICIONAL_EGRESO';
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
    const esCandidataCondicional =
      d.vacanteCondicional === true || d.tipoVacante === 'CONDICIONAL_EGRESO';
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
): Promise<
  Array<{
    docente: Docente;
    motivos: string[];
    confianza: 'ALTA' | 'MEDIA' | 'BAJA';
    asignacionesCount: number;
  }>
> {
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
    if (!esSituacionFinalActiva(docente.situacionFinalGdp)) continue;
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

  const pesoConfianza: Record<'ALTA' | 'MEDIA' | 'BAJA', number> = {
    ALTA: 3,
    MEDIA: 2,
    BAJA: 1
  };
  resultados.sort((a, b) => pesoConfianza[b.confianza] - pesoConfianza[a.confianza]);

  return resultados;
}

export async function escanearYSanearVacantesNnTerritorio(params: {
  periodo?: number;
  rbd?: string;
  rolActor: RolId;
  usuarioActor?: string;
}): Promise<{
  escaneados: number;
  marcadosNn: number;
  asignacionesPreservadas: number;
  idsMarcados: string[];
}> {
  assertRolEditorMovilidad(params.rolActor, 'escanear y sanear vacantes NN en el territorio');
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
    if (!esSituacionFinalActiva(d.situacionFinalGdp)) continue;
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
    a =>
      idsMarcadosSet.has(a.docenteId) ||
      (a.tieneCoDocente && a.coDocenteId && idsMarcadosSet.has(a.coDocenteId))
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
    void syncSupabaseMovilidad(
      { tabla: 'guardarDocentesBatch', operacion: 'servicio', payload: docentesActualizados },
      'saneamiento_nn_docentes'
    );
  }

  return {
    escaneados: docentes.length,
    marcadosNn: idsMarcados.length,
    asignacionesPreservadas,
    idsMarcados
  };
}

export function esVacanteActivaEnMovilidad(d: Docente): boolean {
  if (!d.esVacanteNn) return false;
  if (d.situacionFinalGdp === 'Cancelada') return false;
  if (d.tipoVacante === 'NECESIDAD_ESCUELA') {
    return d.estadoNecesidad !== 'BORRADOR' && d.estadoNecesidad !== 'CANCELADA';
  }
  return true;
}

export function esVacanteAsistenteActivaEnMovilidad(a: AsistenteEducacion): boolean {
  if (!a.esVacanteNn) return false;
  if (a.situacionFinalGdp === 'Cancelada') return false;
  if (a.tipoVacante === 'NECESIDAD_ESCUELA') {
    return a.estadoNecesidad !== 'BORRADOR' && a.estadoNecesidad !== 'CANCELADA';
  }
  return true;
}

export function esVacanteCargoDocente(d: Docente): boolean {
  if (d.cargoInstitucional) return true;
  if (
    d.estamento === 'DIRECTIVO' ||
    d.estamento === 'TECNICO_PEDAGOGICO' ||
    d.estamento === 'COORDINADOR_CRA'
  ) {
    return true;
  }
  return (
    (d.horasDirectivas || 0) +
      (d.horasInspectorGeneral || 0) +
      (d.horasTecnicoPedagogicas || 0) +
      (d.horasCoordinacion || 0) +
      (d.horasCoordinacionPie || 0) +
      (d.horasConvivenciaEscolar || 0) +
      (d.horasExtraescolar || 0) >
    0
  );
}

function buildCamposCargoDocente(
  tipoRequerimiento: 'HORAS_AULA' | 'CARGO_DOCENTE' | undefined,
  cargoNombre: string,
  horasNum: number,
  tipoFuncionNoAula?: TipoFuncionNoAula
): Partial<Docente> {
  if (tipoRequerimiento !== 'CARGO_DOCENTE') {
    return {
      cargoInstitucional: undefined,
      horasDirectivas: 0,
      horasInspectorGeneral: 0,
      horasTecnicoPedagogicas: 0,
      horasCoordinacion: 0,
      horasCoordinacionPie: 0,
      horasConvivenciaEscolar: 0,
      horasExtraescolar: 0
    };
  }

  const norm = cargoNombre.toLowerCase();
  const base: Partial<Docente> = {
    cargoInstitucional: cargoNombre,
    horasDirectivas: 0,
    horasInspectorGeneral: 0,
    horasTecnicoPedagogicas: 0,
    horasCoordinacion: 0,
    horasCoordinacionPie: 0,
    horasConvivenciaEscolar: 0,
    horasExtraescolar: 0
  };

  if (tipoFuncionNoAula === 'INSPECTORIA' || norm.includes('inspector')) {
    base.horasInspectorGeneral = horasNum;
  } else if (tipoFuncionNoAula === 'DIRECTIVA' || norm.includes('director') || norm.includes('subdirector')) {
    base.horasDirectivas = horasNum;
  } else if (
    tipoFuncionNoAula === 'UTP' ||
    tipoFuncionNoAula === 'EVALUACION' ||
    tipoFuncionNoAula === 'ORIENTACION' ||
    norm.includes('utp') ||
    norm.includes('orientador') ||
    norm.includes('evaluador')
  ) {
    base.horasTecnicoPedagogicas = horasNum;
  } else if (norm.includes('pie')) {
    base.horasCoordinacionPie = horasNum;
  } else if (tipoFuncionNoAula === 'CONVIVENCIA' || norm.includes('convivencia')) {
    base.horasConvivenciaEscolar = horasNum;
  } else if (tipoFuncionNoAula === 'EXTRAESCOLAR' || norm.includes('extraescolar')) {
    base.horasExtraescolar = horasNum;
  } else {
    base.horasCoordinacion = horasNum;
  }

  return base;
}

export async function registrarMovimientoMovilidad(params: {
  periodo?: number;
  tipoMovimiento: TipoMovimientoMovilidad;
  entidad: RegistroMovimientoMovilidad['entidad'];
  entidadId: string;
  codigoReferencia?: string;
  rbdOrigen: string;
  nombreEstablecimiento?: string;
  comuna?: string;
  rbdDestino?: string;
  usuarioActor: string;
  rolActor?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  descripcion: string;
  motivo?: string;
  detalles?: Record<string, any>;
  fechaHora?: string;
}): Promise<RegistroMovimientoMovilidad> {
  const db = await getDb();
  const id = `mov_reg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const periodo = params.periodo || 2027;
  const fechaHora = params.fechaHora || new Date().toISOString();

  let nombreEst = params.nombreEstablecimiento;
  let comunaEst = params.comuna;
  if ((!nombreEst || !comunaEst) && params.rbdOrigen && params.rbdOrigen !== 'SLEP') {
    const estRes = db.exec('SELECT nombre, comuna FROM establecimientos WHERE rbd = ? LIMIT 1;', [params.rbdOrigen]);
    if (estRes.length > 0 && estRes[0].values.length > 0) {
      nombreEst = nombreEst || (estRes[0].values[0][0] ? String(estRes[0].values[0][0]) : undefined);
      comunaEst = comunaEst || (estRes[0].values[0][1] ? String(estRes[0].values[0][1]) : undefined);
    }
  }

  const registro: RegistroMovimientoMovilidad = {
    id,
    periodo,
    tipoMovimiento: params.tipoMovimiento,
    entidad: params.entidad,
    entidadId: params.entidadId,
    codigoReferencia: params.codigoReferencia,
    rbdOrigen: params.rbdOrigen,
    nombreEstablecimiento: nombreEst,
    comuna: comunaEst,
    rbdDestino: params.rbdDestino,
    usuarioActor: params.usuarioActor || 'sistema',
    rolActor: params.rolActor,
    estadoAnterior: params.estadoAnterior,
    estadoNuevo: params.estadoNuevo,
    descripcion: params.descripcion,
    motivo: params.motivo,
    detalles: params.detalles,
    fechaHora
  };

  db.run(
    `INSERT INTO movilidad_registro_movimientos (
      id, periodo, tipo_movimiento, entidad, entidad_id, codigo_referencia,
      rbd_origen, nombre_establecimiento, comuna, rbd_destino,
      usuario_actor, rol_actor, estado_anterior, estado_nuevo,
      descripcion, motivo, detalles_json, fecha_hora
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      registro.id,
      registro.periodo,
      registro.tipoMovimiento,
      registro.entidad,
      registro.entidadId,
      registro.codigoReferencia || null,
      registro.rbdOrigen,
      registro.nombreEstablecimiento || null,
      registro.comuna || null,
      registro.rbdDestino || null,
      registro.usuarioActor,
      registro.rolActor || null,
      registro.estadoAnterior || null,
      registro.estadoNuevo || null,
      registro.descripcion,
      registro.motivo || null,
      registro.detalles ? JSON.stringify(registro.detalles) : null,
      registro.fechaHora
    ]
  );

  await persistDb(true);

  if (isSupabaseEnabled()) {
    void syncSupabaseMovilidad(
      {
        tabla: 'movilidad_registro_movimientos',
        operacion: 'upsert',
        onConflict: 'id',
        payload: {
          id: registro.id,
          periodo: registro.periodo,
          tipo_movimiento: registro.tipoMovimiento,
          entidad: registro.entidad,
          entidad_id: registro.entidadId,
          codigo_referencia: registro.codigoReferencia || null,
          rbd_origen: registro.rbdOrigen,
          nombre_establecimiento: registro.nombreEstablecimiento || null,
          comuna: registro.comuna || null,
          rbd_destino: registro.rbdDestino || null,
          usuario_actor: registro.usuarioActor,
          rol_actor: registro.rolActor || null,
          estado_anterior: registro.estadoAnterior || null,
          estado_nuevo: registro.estadoNuevo || null,
          descripcion: registro.descripcion,
          motivo: registro.motivo || null,
          detalles_json: registro.detalles || null,
          fecha_hora: registro.fechaHora
        }
      },
      'registro_movimientos'
    );
  }

  return registro;
}

export async function listarRegistroMovimientosMovilidad(filtros?: {
  periodo?: number;
  rbd?: string;
  tipoMovimiento?: TipoMovimientoMovilidad;
  limit?: number;
}): Promise<RegistroMovimientoMovilidad[]> {
  const db = await getDb();
  const periodo = filtros?.periodo || 2027;
  const where: string[] = ['periodo = ?'];
  const params: any[] = [periodo];

  if (filtros?.rbd) {
    where.push('(rbd_origen = ? OR rbd_destino = ?)');
    params.push(filtros.rbd, filtros.rbd);
  }
  if (filtros?.tipoMovimiento) {
    where.push('tipo_movimiento = ?');
    params.push(filtros.tipoMovimiento);
  }

  const limit = filtros?.limit && filtros.limit > 0 ? filtros.limit : 500;
  params.push(limit);

  const res = db.exec(
    `SELECT id, periodo, tipo_movimiento, entidad, entidad_id, codigo_referencia,
            rbd_origen, nombre_establecimiento, comuna, rbd_destino,
            usuario_actor, rol_actor, estado_anterior, estado_nuevo,
            descripcion, motivo, detalles_json, fecha_hora
     FROM movilidad_registro_movimientos
     WHERE ${where.join(' AND ')}
     ORDER BY fecha_hora DESC, rowid DESC
     LIMIT ?;`,
    params
  );

  if (!res.length) return [];
  return res[0].values.map(row => {
    let detalles: Record<string, any> | undefined;
    if (row[16]) {
      try {
        detalles = JSON.parse(String(row[16]));
      } catch {
        detalles = undefined;
      }
    }
    return {
      id: String(row[0]),
      periodo: Number(row[1] || periodo),
      tipoMovimiento: String(row[2]) as TipoMovimientoMovilidad,
      entidad: String(row[3]) as RegistroMovimientoMovilidad['entidad'],
      entidadId: String(row[4]),
      codigoReferencia: row[5] ? String(row[5]) : undefined,
      rbdOrigen: String(row[6]),
      nombreEstablecimiento: row[7] ? String(row[7]) : undefined,
      comuna: row[8] ? String(row[8]) : undefined,
      rbdDestino: row[9] ? String(row[9]) : undefined,
      usuarioActor: String(row[10]),
      rolActor: row[11] ? String(row[11]) : undefined,
      estadoAnterior: row[12] ? String(row[12]) : undefined,
      estadoNuevo: row[13] ? String(row[13]) : undefined,
      descripcion: String(row[14]),
      motivo: row[15] ? String(row[15]) : undefined,
      detalles,
      fechaHora: String(row[17])
    };
  });
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
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
  estadoInicial?: 'BORRADOR' | 'ENVIADA';
  tipoRequerimiento?: 'HORAS_AULA' | 'CARGO_DOCENTE';
  tipoFuncionNoAula?: TipoFuncionNoAula;
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

  const estadoInicial: EstadoNecesidadVacante = params.estadoInicial || 'BORRADOR';

  const camposCargo = buildCamposCargoDocente(
    params.tipoRequerimiento,
    especialidadClean,
    horasNum,
    params.tipoFuncionNoAula
  );

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
    horasSubvencionGeneralContrata:
      params.fuenteFinanciamiento === 'SUBVENCION_GENERAL' ? horasNum : 0,
    horasSepTitular: 0,
    horasSepContrata: params.fuenteFinanciamiento === 'SEP' ? horasNum : 0,
    horasPieTitular: 0,
    horasPieContrata: params.fuenteFinanciamiento === 'PIE' ? horasNum : 0,
    ...camposCargo,
    asignaturaPrincipal: especialidadClean,
    esVacanteNn: true,
    tipoVacante: 'NECESIDAD_ESCUELA',
    justificacionVacante: justificacionClean,
    vacanteCondicional: false,
    propuestaGdp: 'Vacante por proveer',
    situacionFinalGdp: estadoInicial === 'ENVIADA' ? 'Vigente' : 'Borrador',
    estadoNecesidad: estadoInicial
  };

  await guardarDocente(vacante);

  await registrarEventoAuditoria({
    rbd: rbdClean,
    periodo,
    tipoEvento: 'CREACION',
    entidad: 'DOCENTE',
    entidadId: vacante.id,
    descripcion: `Creación de necesidad de vacante estructurada (${especialidadClean}, ${horasNum}h, ${params.fuenteFinanciamiento}) en estado ${estadoInicial}.`,
    detalles: {
      tipoVacante: 'NECESIDAD_ESCUELA',
      codigoVacante,
      fuenteFinanciamiento: params.fuenteFinanciamiento,
      justificacion: justificacionClean,
      estadoNecesidad: estadoInicial,
      usuarioActor: params.usuarioActor || 'establecimiento'
    }
  });

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'CREACION_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: vacante.id,
    codigoReferencia: codigoVacante,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoNuevo: estadoInicial,
    descripcion: `Necesidad creada: ${especialidadClean} (${horasNum}h · ${params.fuenteFinanciamiento})`,
    motivo: justificacionClean,
    detalles: {
      especialidad: especialidadClean,
      estamento: params.estamento,
      horasContrato: horasNum,
      fuenteFinanciamiento: params.fuenteFinanciamiento
    }
  });

  if (estadoInicial === 'ENVIADA') {
    await registrarMovimientoMovilidad({
      periodo,
      tipoMovimiento: 'ENVIO_MOVILIDAD',
      entidad: 'NECESIDAD_VACANTE',
      entidadId: vacante.id,
      codigoReferencia: codigoVacante,
      rbdOrigen: rbdClean,
      nombreEstablecimiento: params.nombreEstablecimiento,
      comuna: params.comuna,
      usuarioActor: params.usuarioActor || 'establecimiento',
      rolActor: params.rolActor,
      estadoAnterior: 'BORRADOR',
      estadoNuevo: 'ENVIADA',
      descripcion: `Necesidad ${codigoVacante} (${especialidadClean}, ${horasNum}h) enviada a Mesa de Movilidad.`
    });
  }

  return vacante;
}

export async function listarNecesidadesVacanteEscuela(
  rbd: string,
  periodo: number = 2027
): Promise<Docente[]> {
  const rbdClean = String(rbd || '').trim();
  if (!rbdClean) return [];
  const docentes = await listarDocentes(rbdClean, periodo);
  return docentes
    .filter(d => d.tipoVacante === 'NECESIDAD_ESCUELA')
    .sort((a, b) => b.id.localeCompare(a.id));
}

export async function obtenerVacantesConPropuestaActiva(
  vacanteIds: string[],
  periodo: number = 2027
): Promise<Set<string>> {
  if (!vacanteIds.length) return new Set();
  const db = await getDb();
  const placeholders = vacanteIds.map(() => '?').join(',');
  const res = db.exec(
    `SELECT DISTINCT vacante_destino_id
     FROM propuestas_calce
     WHERE periodo = ?
       AND vacante_destino_id IN (${placeholders})
       AND estado IN ('PROPUESTA', 'VALIDADA', 'CONSOLIDADA');`,
    [periodo, ...vacanteIds]
  );
  const result = new Set<string>();
  if (res.length > 0) {
    for (const row of res[0].values) {
      if (row[0]) result.add(String(row[0]));
    }
  }
  return result;
}

async function cargarNecesidadEscuela(id: string, rbd: string, periodo: number): Promise<Docente> {
  const docentes = await listarDocentes(rbd, periodo);
  const found = docentes.find(d => d.id === id && d.tipoVacante === 'NECESIDAD_ESCUELA');
  if (!found) {
    throw new Error('No se encontró la necesidad de vacante especificada en este establecimiento.');
  }
  return found;
}

export async function actualizarNecesidadVacanteEscuela(params: {
  id: string;
  rbd: string;
  periodo?: number;
  especialidad: string;
  estamento: EstamentoDocente;
  horasContrato: number;
  fuenteFinanciamiento: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
  justificacion: string;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
  tipoRequerimiento?: 'HORAS_AULA' | 'CARGO_DOCENTE';
  tipoFuncionNoAula?: TipoFuncionNoAula;
}): Promise<Docente> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const actual = await cargarNecesidadEscuela(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';

  if (estadoActual !== 'BORRADOR') {
    throw new Error(
      estadoActual === 'ENVIADA'
        ? 'Esta necesidad ya fue enviada a Movilidad. Debes retrotraerla a Borrador antes de editarla.'
        : 'No es posible editar una necesidad cancelada.'
    );
  }

  const especialidadClean = String(params.especialidad || '').trim();
  const justificacionClean = String(params.justificacion || '').trim();
  const horasNum = Number(params.horasContrato);
  if (!especialidadClean) throw new Error('Debe indicar la especialidad o asignatura requerida.');
  if (!justificacionClean) throw new Error('Debe ingresar una justificación pedagógica o normativa.');
  if (!Number.isInteger(horasNum) || horasNum < 1 || horasNum > 44) {
    throw new Error('Las horas de contrato deben ser un entero entre 1 y 44.');
  }

  const camposCargo = buildCamposCargoDocente(
    params.tipoRequerimiento ?? (esVacanteCargoDocente(actual) ? 'CARGO_DOCENTE' : 'HORAS_AULA'),
    especialidadClean,
    horasNum,
    params.tipoFuncionNoAula
  );

  const actualizada: Docente = {
    ...actual,
    apellidos: especialidadClean.toUpperCase(),
    estamento: params.estamento,
    horasContrato: horasNum,
    horasSubvencionGeneralTitular: 0,
    horasSubvencionGeneralContrata: params.fuenteFinanciamiento === 'SUBVENCION_GENERAL' ? horasNum : 0,
    horasSepTitular: 0,
    horasSepContrata: params.fuenteFinanciamiento === 'SEP' ? horasNum : 0,
    horasPieTitular: 0,
    horasPieContrata: params.fuenteFinanciamiento === 'PIE' ? horasNum : 0,
    ...camposCargo,
    asignaturaPrincipal: especialidadClean,
    justificacionVacante: justificacionClean
  };

  await guardarDocente(actualizada);

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'EDICION_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: actualizada.id,
    codigoReferencia: actualizada.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: 'BORRADOR',
    estadoNuevo: 'BORRADOR',
    descripcion: `Necesidad ${actualizada.run} editada en borrador: ${especialidadClean} (${horasNum}h · ${params.fuenteFinanciamiento}).`,
    motivo: justificacionClean
  });

  return actualizada;
}

export async function enviarNecesidadAMovilidad(params: {
  id: string;
  rbd: string;
  periodo?: number;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
}): Promise<Docente> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const actual = await cargarNecesidadEscuela(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';

  if (estadoActual === 'CANCELADA') {
    throw new Error('No se puede enviar a Movilidad una necesidad que fue cancelada.');
  }
  if (estadoActual === 'ENVIADA') {
    return actual;
  }

  const enviada: Docente = {
    ...actual,
    estadoNecesidad: 'ENVIADA',
    situacionFinalGdp: 'Vigente',
    motivoEstadoNecesidad: undefined
  };

  await guardarDocente(enviada);

  await registrarEventoAuditoria({
    rbd: rbdClean,
    periodo,
    tipoEvento: 'ACTUALIZACION',
    entidad: 'DOCENTE',
    entidadId: enviada.id,
    descripcion: `Necesidad ${enviada.run} (${enviada.asignaturaPrincipal}, ${enviada.horasContrato}h) enviada a Mesa de Movilidad.`,
    detalles: { estadoAnterior: estadoActual, estadoNuevo: 'ENVIADA', usuarioActor: params.usuarioActor }
  });

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'ENVIO_MOVILIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: enviada.id,
    codigoReferencia: enviada.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: estadoActual,
    estadoNuevo: 'ENVIADA',
    descripcion: `Necesidad ${enviada.run} (${enviada.asignaturaPrincipal}, ${enviada.horasContrato}h) enviada al módulo de Movilidad.`
  });

  return enviada;
}

export async function retrotraerNecesidadDeMovilidad(params: {
  id: string;
  rbd: string;
  motivo: string;
  periodo?: number;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
}): Promise<Docente> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const motivoClean = String(params.motivo || '').trim();
  if (!motivoClean) {
    throw new Error('Debe indicar el motivo para retrotraer la necesidad desde Movilidad.');
  }

  const actual = await cargarNecesidadEscuela(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';
  if (estadoActual !== 'ENVIADA') {
    throw new Error('Solo se pueden retrotraer necesidades que se encuentran enviadas a Movilidad.');
  }

  const enGestion = await obtenerVacantesConPropuestaActiva([actual.id], periodo);
  if (enGestion.has(actual.id)) {
    throw new Error(
      'Esta vacante ya tiene una propuesta o adjudicación activa en un escenario de la Mesa de Movilidad. Solicite a UATP/GDP liberar la propuesta antes de retrotraer.'
    );
  }

  const retrotraida: Docente = {
    ...actual,
    estadoNecesidad: 'BORRADOR',
    situacionFinalGdp: 'Borrador',
    motivoEstadoNecesidad: motivoClean
  };

  await guardarDocente(retrotraida);

  await registrarEventoAuditoria({
    rbd: rbdClean,
    periodo,
    tipoEvento: 'ACTUALIZACION',
    entidad: 'DOCENTE',
    entidadId: retrotraida.id,
    descripcion: `Necesidad ${retrotraida.run} retrotraída desde Movilidad a Borrador. Motivo: ${motivoClean}`,
    detalles: { estadoAnterior: 'ENVIADA', estadoNuevo: 'BORRADOR', motivo: motivoClean, usuarioActor: params.usuarioActor }
  });

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'RETROCESO_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: retrotraida.id,
    codigoReferencia: retrotraida.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: 'ENVIADA',
    estadoNuevo: 'BORRADOR',
    descripcion: `Necesidad ${retrotraida.run} (${retrotraida.asignaturaPrincipal}, ${retrotraida.horasContrato}h) retrotraída a Borrador.`,
    motivo: motivoClean
  });

  return retrotraida;
}

export async function cancelarNecesidadVacanteEscuela(params: {
  id: string;
  rbd: string;
  motivo: string;
  periodo?: number;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
}): Promise<Docente> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const motivoClean = String(params.motivo || '').trim();
  if (!motivoClean) {
    throw new Error('Debe indicar el motivo de cancelación de la necesidad.');
  }

  const actual = await cargarNecesidadEscuela(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';
  if (estadoActual === 'CANCELADA') {
    return actual;
  }

  const enGestion = await obtenerVacantesConPropuestaActiva([actual.id], periodo);
  if (enGestion.has(actual.id)) {
    throw new Error(
      'Esta vacante ya tiene una propuesta o adjudicación activa en la Mesa de Movilidad y no puede cancelarse directamente.'
    );
  }

  const cancelada: Docente = {
    ...actual,
    estadoNecesidad: 'CANCELADA',
    situacionFinalGdp: 'Cancelada',
    motivoEstadoNecesidad: motivoClean
  };

  await guardarDocente(cancelada);

  await registrarEventoAuditoria({
    rbd: rbdClean,
    periodo,
    tipoEvento: 'ELIMINACION',
    entidad: 'DOCENTE',
    entidadId: cancelada.id,
    descripcion: `Necesidad ${cancelada.run} (${cancelada.asignaturaPrincipal}, ${cancelada.horasContrato}h) cancelada. Motivo: ${motivoClean}`,
    detalles: { estadoAnterior: estadoActual, estadoNuevo: 'CANCELADA', motivo: motivoClean, usuarioActor: params.usuarioActor }
  });

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'CANCELACION_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: cancelada.id,
    codigoReferencia: cancelada.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: estadoActual,
    estadoNuevo: 'CANCELADA',
    descripcion: `Necesidad ${cancelada.run} (${cancelada.asignaturaPrincipal}, ${cancelada.horasContrato}h) cancelada.`,
    motivo: motivoClean
  });

  return cancelada;
}

// =============================================================================
// 3B. Necesidades de Cargos Asistentes de la Educación (Ley 21.109)
// =============================================================================

function inferirFlagsAsistenteCargo(
  cargoFuncion: string,
  estamento: EstamentoAsistente,
  fuenteFinanciamiento: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE'
) {
  const norm = cargoFuncion.toLowerCase();
  return {
    esDuplaPsicosocial:
      norm.includes('psicolog') ||
      norm.includes('psicólog') ||
      norm.includes('trabajador social') ||
      norm.includes('asistente social') ||
      norm.includes('dupla'),
    esEquipoPie: fuenteFinanciamiento === 'PIE' || norm.includes('pie') || norm.includes('fonoaudi') || norm.includes('terapeuta'),
    esTecnicoParvulo: estamento === 'TECNICO' && (norm.includes('parvul') || norm.includes('párvul')),
    esAuxiliarServicio: estamento === 'AUXILIAR',
    esInspectorPatio: estamento === 'PARADOCENTE_INSPECTORIA' || norm.includes('inspector')
  };
}

export async function crearNecesidadVacanteAsistente(params: {
  rbd: string;
  periodo: number;
  cargoFuncion: string;
  estamento: EstamentoAsistente;
  horasContrato: number;
  fuenteFinanciamiento: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
  justificacion: string;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
  estadoInicial?: 'BORRADOR' | 'ENVIADA';
}): Promise<AsistenteEducacion> {
  const flags = obtenerFeatureFlagsMovilidad();
  if (!flags.flag_saneamiento_nn_escuelas) {
    throw new Error('El feature flag flag_saneamiento_nn_escuelas se encuentra desactivado.');
  }

  const rbdClean = String(params.rbd || '').trim();
  const cargoClean = String(params.cargoFuncion || '').trim();
  const justificacionClean = String(params.justificacion || '').trim();
  const horasNum = Number(params.horasContrato);

  if (!rbdClean) throw new Error('Debe especificar un RBD válido.');
  if (!cargoClean) throw new Error('Debe indicar el cargo o función requerida.');
  if (!justificacionClean) throw new Error('Debe ingresar una justificación operativa o normativa.');
  if (!Number.isInteger(horasNum) || horasNum < 1 || horasNum > 44) {
    throw new Error('Las horas de contrato deben ser un número entero entre 1 y 44.');
  }

  const periodo = params.periodo || 2027;
  const sufijoId = Math.random().toString(36).slice(2, 6);
  const codigoVacante = `VAC-AST-${rbdClean}-${Math.floor(1000 + Math.random() * 9000)}`;
  const estadoInicial: EstadoNecesidadVacante = params.estadoInicial || 'BORRADOR';
  const banderas = inferirFlagsAsistenteCargo(cargoClean, params.estamento, params.fuenteFinanciamiento);

  const vacante: AsistenteEducacion = {
    id: `vac_ast_${rbdClean}_${periodo}_${Date.now()}_${sufijoId}`,
    rbd: rbdClean,
    periodo,
    run: codigoVacante,
    nombres: 'VACANTE POR PROVEER',
    apellidos: cargoClean.toUpperCase(),
    cargoFuncion: cargoClean,
    estamento: params.estamento,
    horasContrato: horasNum,
    horasSubvencionGeneralIndefinido: 0,
    horasSubvencionGeneralPlazoFijo: params.fuenteFinanciamiento === 'SUBVENCION_GENERAL' ? horasNum : 0,
    horasSepIndefinido: 0,
    horasSepPlazoFijo: params.fuenteFinanciamiento === 'SEP' ? horasNum : 0,
    horasPieIndefinido: 0,
    horasPiePlazoFijo: params.fuenteFinanciamiento === 'PIE' ? horasNum : 0,
    ...banderas,
    activo: true,
    propuestaGdp: 'Vacante por proveer',
    situacionFinalGdp: estadoInicial === 'ENVIADA' ? 'Vigente' : 'Borrador',
    esVacanteNn: true,
    tipoVacante: 'NECESIDAD_ESCUELA',
    justificacionVacante: justificacionClean,
    estadoNecesidad: estadoInicial
  };

  await guardarAsistente(vacante);

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'CREACION_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: vacante.id,
    codigoReferencia: codigoVacante,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoNuevo: estadoInicial,
    descripcion: `Necesidad de cargo Asistente creada: ${cargoClean} (${params.estamento}, ${horasNum}h · ${params.fuenteFinanciamiento})`,
    motivo: justificacionClean,
    detalles: {
      tipoRequerimiento: 'CARGO_ASISTENTE',
      estamento: params.estamento,
      horasContrato: horasNum,
      fuenteFinanciamiento: params.fuenteFinanciamiento
    }
  });

  if (estadoInicial === 'ENVIADA') {
    await registrarMovimientoMovilidad({
      periodo,
      tipoMovimiento: 'ENVIO_MOVILIDAD',
      entidad: 'NECESIDAD_VACANTE',
      entidadId: vacante.id,
      codigoReferencia: codigoVacante,
      rbdOrigen: rbdClean,
      nombreEstablecimiento: params.nombreEstablecimiento,
      comuna: params.comuna,
      usuarioActor: params.usuarioActor || 'establecimiento',
      rolActor: params.rolActor,
      estadoAnterior: 'BORRADOR',
      estadoNuevo: 'ENVIADA',
      descripcion: `Necesidad de cargo Asistente ${codigoVacante} (${cargoClean}, ${horasNum}h) enviada a Mesa de Movilidad.`
    });
  }

  return vacante;
}

export async function listarNecesidadesVacanteAsistente(
  rbd: string,
  periodo: number = 2027
): Promise<AsistenteEducacion[]> {
  const rbdClean = String(rbd || '').trim();
  if (!rbdClean) return [];
  const asistentes = await listarAsistentes(rbdClean, periodo);
  return asistentes
    .filter(a => a.tipoVacante === 'NECESIDAD_ESCUELA')
    .sort((a, b) => b.id.localeCompare(a.id));
}

async function cargarNecesidadAsistente(id: string, rbd: string, periodo: number): Promise<AsistenteEducacion> {
  const asistentes = await listarAsistentes(rbd, periodo);
  const found = asistentes.find(a => a.id === id && a.tipoVacante === 'NECESIDAD_ESCUELA');
  if (!found) {
    throw new Error('No se encontró la necesidad de cargo asistente especificada en este establecimiento.');
  }
  return found;
}

export async function actualizarNecesidadVacanteAsistente(params: {
  id: string;
  rbd: string;
  periodo?: number;
  cargoFuncion: string;
  estamento: EstamentoAsistente;
  horasContrato: number;
  fuenteFinanciamiento: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
  justificacion: string;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
}): Promise<AsistenteEducacion> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const actual = await cargarNecesidadAsistente(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';

  if (estadoActual !== 'BORRADOR') {
    throw new Error(
      estadoActual === 'ENVIADA'
        ? 'Esta necesidad ya fue enviada a Movilidad. Debes retrotraerla a Borrador antes de editarla.'
        : 'No es posible editar una necesidad cancelada.'
    );
  }

  const cargoClean = String(params.cargoFuncion || '').trim();
  const justificacionClean = String(params.justificacion || '').trim();
  const horasNum = Number(params.horasContrato);
  if (!cargoClean) throw new Error('Debe indicar el cargo o función requerida.');
  if (!justificacionClean) throw new Error('Debe ingresar una justificación operativa o normativa.');
  if (!Number.isInteger(horasNum) || horasNum < 1 || horasNum > 44) {
    throw new Error('Las horas de contrato deben ser un entero entre 1 y 44.');
  }

  const banderas = inferirFlagsAsistenteCargo(cargoClean, params.estamento, params.fuenteFinanciamiento);
  const actualizada: AsistenteEducacion = {
    ...actual,
    apellidos: cargoClean.toUpperCase(),
    cargoFuncion: cargoClean,
    estamento: params.estamento,
    horasContrato: horasNum,
    horasSubvencionGeneralIndefinido: 0,
    horasSubvencionGeneralPlazoFijo: params.fuenteFinanciamiento === 'SUBVENCION_GENERAL' ? horasNum : 0,
    horasSepIndefinido: 0,
    horasSepPlazoFijo: params.fuenteFinanciamiento === 'SEP' ? horasNum : 0,
    horasPieIndefinido: 0,
    horasPiePlazoFijo: params.fuenteFinanciamiento === 'PIE' ? horasNum : 0,
    ...banderas,
    justificacionVacante: justificacionClean
  };

  await guardarAsistente(actualizada);

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'EDICION_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: actualizada.id,
    codigoReferencia: actualizada.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: 'BORRADOR',
    estadoNuevo: 'BORRADOR',
    descripcion: `Necesidad de cargo Asistente ${actualizada.run} editada: ${cargoClean} (${horasNum}h · ${params.fuenteFinanciamiento}).`,
    motivo: justificacionClean
  });

  return actualizada;
}

export async function enviarNecesidadAsistenteAMovilidad(params: {
  id: string;
  rbd: string;
  periodo?: number;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
}): Promise<AsistenteEducacion> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const actual = await cargarNecesidadAsistente(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';
  if (estadoActual === 'CANCELADA') throw new Error('No se puede enviar a Movilidad una necesidad cancelada.');
  if (estadoActual === 'ENVIADA') return actual;

  const enviada: AsistenteEducacion = {
    ...actual,
    estadoNecesidad: 'ENVIADA',
    situacionFinalGdp: 'Vigente',
    motivoEstadoNecesidad: undefined
  };

  await guardarAsistente(enviada);

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'ENVIO_MOVILIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: enviada.id,
    codigoReferencia: enviada.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: estadoActual,
    estadoNuevo: 'ENVIADA',
    descripcion: `Necesidad de cargo Asistente ${enviada.run} (${enviada.cargoFuncion}, ${enviada.horasContrato}h) enviada a Mesa de Movilidad.`
  });

  return enviada;
}

export async function retrotraerNecesidadAsistenteDeMovilidad(params: {
  id: string;
  rbd: string;
  motivo: string;
  periodo?: number;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
}): Promise<AsistenteEducacion> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const motivoClean = String(params.motivo || '').trim();
  if (!motivoClean) throw new Error('Debe indicar el motivo para retrotraer la necesidad desde Movilidad.');

  const actual = await cargarNecesidadAsistente(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';
  if (estadoActual !== 'ENVIADA') {
    throw new Error('Solo se pueden retrotraer necesidades que se encuentran enviadas a Movilidad.');
  }

  const enGestion = await obtenerVacantesConPropuestaActiva([actual.id], periodo);
  if (enGestion.has(actual.id)) {
    throw new Error(
      'Esta vacante ya tiene una propuesta o adjudicación activa en un escenario de la Mesa de Movilidad. Solicite a UATP/GDP liberar la propuesta antes de retrotraer.'
    );
  }

  const retrotraida: AsistenteEducacion = {
    ...actual,
    estadoNecesidad: 'BORRADOR',
    situacionFinalGdp: 'Borrador',
    motivoEstadoNecesidad: motivoClean
  };

  await guardarAsistente(retrotraida);

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'RETROCESO_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: retrotraida.id,
    codigoReferencia: retrotraida.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: 'ENVIADA',
    estadoNuevo: 'BORRADOR',
    descripcion: `Necesidad de cargo Asistente ${retrotraida.run} (${retrotraida.cargoFuncion}, ${retrotraida.horasContrato}h) retrotraída a Borrador.`,
    motivo: motivoClean
  });

  return retrotraida;
}

export async function cancelarNecesidadVacanteAsistente(params: {
  id: string;
  rbd: string;
  motivo: string;
  periodo?: number;
  usuarioActor?: string;
  rolActor?: string;
  nombreEstablecimiento?: string;
  comuna?: string;
}): Promise<AsistenteEducacion> {
  const periodo = params.periodo || 2027;
  const rbdClean = String(params.rbd || '').trim();
  const motivoClean = String(params.motivo || '').trim();
  if (!motivoClean) throw new Error('Debe indicar el motivo de cancelación de la necesidad.');

  const actual = await cargarNecesidadAsistente(params.id, rbdClean, periodo);
  const estadoActual = actual.estadoNecesidad || 'ENVIADA';
  if (estadoActual === 'CANCELADA') return actual;

  const enGestion = await obtenerVacantesConPropuestaActiva([actual.id], periodo);
  if (enGestion.has(actual.id)) {
    throw new Error(
      'Esta vacante ya tiene una propuesta o adjudicación activa en la Mesa de Movilidad y no puede cancelarse directamente.'
    );
  }

  const cancelada: AsistenteEducacion = {
    ...actual,
    estadoNecesidad: 'CANCELADA',
    situacionFinalGdp: 'Cancelada',
    motivoEstadoNecesidad: motivoClean
  };

  await guardarAsistente(cancelada);

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'CANCELACION_NECESIDAD',
    entidad: 'NECESIDAD_VACANTE',
    entidadId: cancelada.id,
    codigoReferencia: cancelada.run,
    rbdOrigen: rbdClean,
    nombreEstablecimiento: params.nombreEstablecimiento,
    comuna: params.comuna,
    usuarioActor: params.usuarioActor || 'establecimiento',
    rolActor: params.rolActor,
    estadoAnterior: estadoActual,
    estadoNuevo: 'CANCELADA',
    descripcion: `Necesidad de cargo Asistente ${cancelada.run} (${cancelada.cargoFuncion}, ${cancelada.horasContrato}h) cancelada.`,
    motivo: motivoClean
  });

  return cancelada;
}

// =============================================================================
// 4. CRUD de Egresos Proyectados, Contingencia Jurídica y Reverso Controlado
// =============================================================================

const EGRESO_SELECT_COLS = `
  id, rbd, periodo, docente_id, run_docente, nombre_docente, asignatura_principal,
  horas_liberadas, horas_aula_liberadas, fuente_financiamiento, calidad_juridica,
  causal, certeza, excepcion_jubilacion_3_anios, fecha_cese, numero_decreto,
  impacto_presupuestario, vacante_docente_id, validado_por, observaciones,
  cpeip_notificacion_firme, estado_reversion, motivo_reversion, fecha_reversion, revertido_por,
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
    fuenteFinanciamiento: (row[9]
      ? String(row[9])
      : 'SUBVENCION_GENERAL') as EgresoProyectado['fuenteFinanciamiento'],
    calidadJuridica: (row[10] ? String(row[10]) : 'TITULAR') as CalidadJuridicaDocente,
    causal: String(row[11]) as CausalEgresoDocente,
    certeza: (row[12] ? String(row[12]) : 'en_tramite') as CertezaJuridicaEgreso,
    excepcionJubilacion3Anios: Boolean(row[13]),
    fechaCese: row[14] ? String(row[14]) : undefined,
    numeroDecreto: row[15] ? String(row[15]) : undefined,
    impactoPresupuestario: (row[16]
      ? String(row[16])
      : 'costo_doble_pendiente') as ImpactoPresupuestarioEgreso,
    vacanteDocenteId: row[17] ? String(row[17]) : undefined,
    validadoPor: row[18] ? String(row[18]) : undefined,
    observaciones: row[19] ? String(row[19]) : undefined,
    cpeipNotificacionFirme: Boolean(row[20]),
    estadoReversion: (row[21]
      ? String(row[21])
      : 'ACTIVO') as EgresoProyectado['estadoReversion'],
    motivoReversion: row[22] ? String(row[22]) : undefined,
    fechaReversion: row[23] ? String(row[23]) : undefined,
    revertidoPor: row[24] ? String(row[24]) : undefined,
    createdAt: row[25] ? String(row[25]) : undefined,
    updatedAt: row[26] ? String(row[26]) : undefined
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
    observaciones: e.observaciones || null,
    cpeip_notificacion_firme: Boolean(e.cpeipNotificacionFirme),
    estado_reversion: e.estadoReversion || 'ACTIVO',
    motivo_reversion: e.motivoReversion || null,
    fecha_reversion: e.fechaReversion || null,
    revertido_por: e.revertidoPor || null
  };
}

function toEgresoInput(e: EgresoProyectado): EgresoProyectadoInput {
  return {
    causal: e.causal,
    certeza: e.certeza,
    excepcionJubilacion3Anios: Boolean(e.excepcionJubilacion3Anios),
    cpeipNotificacionFirme: Boolean(e.cpeipNotificacionFirme),
    fechaCese: e.fechaCese,
    numeroDecreto: e.numeroDecreto,
    horasLiberadas: e.horasLiberadas,
    impactoPresupuestario: e.impactoPresupuestario
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
): Promise<{
  egreso: EgresoProyectado;
  evaluacion: EvaluacionJuridicaEgreso;
  vacanteGenerada?: Docente;
}> {
  assertRolValidadorGdp(rolActor, 'registrar o validar egresos proyectados');

  const periodo = egreso.periodo || 2027;
  const horasLiberadasInt = Math.max(0, Math.round(Number(egreso.horasLiberadas || 0)));
  const horasAulaLiberadasInt = Math.max(0, Math.round(Number(egreso.horasAulaLiberadas || 0)));
  const cpeipNotificacionFirme = Boolean(egreso.cpeipNotificacionFirme);

  const evaluacion = evaluarEgresoProyectado({
    causal: egreso.causal,
    certeza: egreso.certeza,
    excepcionJubilacion3Anios: Boolean(egreso.excepcionJubilacion3Anios),
    cpeipNotificacionFirme,
    fechaCese: egreso.fechaCese,
    numeroDecreto: egreso.numeroDecreto,
    horasLiberadas: horasLiberadasInt,
    impactoPresupuestario: egreso.impactoPresupuestario
  });

  const db = await getDb();
  const nowIso = new Date().toISOString();
  const egresoId =
    egreso.id?.trim() ||
    `egr_${egreso.rbd}_${periodo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

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
    if (generarVacanteVinculada) {
      vacanteDocenteId = vacanteDocenteId || `vac_egr_${egresoId}`;
    }
    if (vacanteDocenteId) {
      const horasVac = Math.max(1, Math.min(44, horasLiberadasInt || 1));
      const esPie = egreso.fuenteFinanciamiento === 'PIE';
      const esSep = egreso.fuenteFinanciamiento === 'SEP';
      const esSubv = !esPie && !esSep;

      const vacanteExistenteRes = db.exec('SELECT run, estamento FROM docentes WHERE id = ? LIMIT 1;', [
        vacanteDocenteId
      ]);
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
  const estadoReversionFinal: NonNullable<EgresoProyectado['estadoReversion']> =
    egreso.estadoReversion || 'ACTIVO';

  const egresoFinal: EgresoProyectado = {
    ...egreso,
    id: egresoId,
    periodo,
    horasLiberadas: horasLiberadasInt,
    horasAulaLiberadas: horasAulaLiberadasInt,
    excepcionJubilacion3Anios: Boolean(egreso.excepcionJubilacion3Anios),
    cpeipNotificacionFirme,
    estadoReversion: estadoReversionFinal,
    motivoReversion: egreso.motivoReversion,
    fechaReversion: egreso.fechaReversion,
    revertidoPor: egreso.revertidoPor,
    impactoPresupuestario: impactoFinal,
    vacanteDocenteId,
    createdAt: prevCreatedAt || nowIso,
    updatedAt: nowIso
  };

  db.run('BEGIN TRANSACTION;');
  try {
    for (const delVacId of idsVacantesEliminar) {
      db.run('DELETE FROM asignaciones_horarias WHERE docente_id = ? OR co_docente_id = ?;', [
        delVacId,
        delVacId
      ]);
      db.run('DELETE FROM docentes WHERE id = ?;', [delVacId]);
    }

    db.run(
      `INSERT INTO egresos_proyectados (
        id, rbd, periodo, docente_id, run_docente, nombre_docente, asignatura_principal,
        horas_liberadas, horas_aula_liberadas, fuente_financiamiento, calidad_juridica,
        causal, certeza, excepcion_jubilacion_3_anios, fecha_cese, numero_decreto,
        impacto_presupuestario, vacante_docente_id, validado_por, observaciones,
        cpeip_notificacion_firme, estado_reversion, motivo_reversion, fecha_reversion, revertido_por,
        created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        cpeip_notificacion_firme=excluded.cpeip_notificacion_firme,
        estado_reversion=excluded.estado_reversion,
        motivo_reversion=excluded.motivo_reversion,
        fecha_reversion=excluded.fecha_reversion,
        revertido_por=excluded.revertido_por,
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
        egresoFinal.cpeipNotificacionFirme ? 1 : 0,
        egresoFinal.estadoReversion || 'ACTIVO',
        egresoFinal.motivoReversion || null,
        egresoFinal.fechaReversion || null,
        egresoFinal.revertidoPor || null,
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
      void syncSupabaseMovilidad(
        { tabla: 'eliminarDocente', operacion: 'servicio', payload: delVacId },
        'egreso_eliminar_vacante_previa'
      );
    }
    void syncSupabaseMovilidad(
      {
        tabla: 'egresos_proyectados',
        operacion: 'upsert',
        payload: mapEgresoToSupabase(egresoFinal),
        onConflict: 'id'
      },
      'guardar_egreso_proyectado'
    );
  }

  return {
    egreso: egresoFinal,
    evaluacion,
    vacanteGenerada:
      generarVacanteVinculada && evaluacion.liberaVacante ? vacanteGenerada : undefined
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
      db.run('DELETE FROM asignaciones_horarias WHERE docente_id = ? OR co_docente_id = ?;', [
        vacId,
        vacId
      ]);
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
      void syncSupabaseMovilidad(
        { tabla: 'eliminarDocente', operacion: 'servicio', payload: vacId },
        'eliminar_egreso_vacante'
      );
    }
    void syncSupabaseMovilidad(
      { tabla: 'egresos_proyectados', operacion: 'delete', match: { id } },
      'eliminar_egreso_proyectado'
    );
  }
}

/**
 * Reverso Controlado: restituye al docente titular en contingencia, re-apunta las asignaciones
 * horarias desde la vacante condicional de vuelta al titular, archiva la vacante transitoria
 * y marca el egreso proyectado como 'REVERTIDO_REINCORPORADO'.
 */
export async function reincorporarTitularContingencia(params: {
  egresoId: string;
  motivo: string;
  rolActor: RolId;
  usuarioActor?: string;
}): Promise<{
  egreso: EgresoProyectado;
  docenteTitularRestituido: Docente | null;
  vacanteArchivadaId?: string;
  asignacionesReapuntadas: number;
}> {
  assertRolValidadorGdp(params.rolActor, 'revertir un egreso y reincorporar al docente titular');

  const motivoClean = String(params.motivo || '').trim();
  if (!motivoClean) {
    throw new Error('Debe ingresar un motivo fundamentado para reincorporar al docente titular.');
  }

  const db = await getDb();
  const resEgr = db.exec(`SELECT ${EGRESO_SELECT_COLS} FROM egresos_proyectados WHERE id = ? LIMIT 1;`, [
    params.egresoId
  ]);
  if (!resEgr.length || !resEgr[0].values.length) {
    throw new Error(`Egreso proyectado '${params.egresoId}' no encontrado.`);
  }
  const egresoActual = mapRowToEgreso(resEgr[0].values[0]);
  if (egresoActual.estadoReversion === 'REVERTIDO_REINCORPORADO') {
    throw new Error(`El egreso '${params.egresoId}' ya fue revertido previamente.`);
  }

  const periodo = egresoActual.periodo || 2027;
  const docsRbd = await listarDocentes(egresoActual.rbd, periodo, true);

  let titular = docsRbd.find(d => d.id === egresoActual.docenteId) || null;
  if (!titular && egresoActual.runDocente) {
    const runNorm = claveRunNormalizado(egresoActual.runDocente);
    titular =
      docsRbd.find(
        d =>
          !d.esVacanteNn &&
          !d.vacanteCondicional &&
          Boolean(runNorm) &&
          claveRunNormalizado(d.run) === runNorm
      ) || null;
  }

  const vacantesLigadasIds = new Set<string>();
  if (egresoActual.vacanteDocenteId) {
    vacantesLigadasIds.add(egresoActual.vacanteDocenteId);
  }
  const ligadasRes = db.exec('SELECT id FROM docentes WHERE origen_egreso_id = ?;', [egresoActual.id]);
  if (ligadasRes.length && ligadasRes[0].values.length) {
    for (const row of ligadasRes[0].values) {
      if (row[0]) vacantesLigadasIds.add(String(row[0]));
    }
  }

  const vacanteIdPrincipal = egresoActual.vacanteDocenteId || Array.from(vacantesLigadasIds)[0];
  const nowIso = new Date().toISOString();
  const actor = String(params.usuarioActor || 'Validador GDP').trim();
  let asignacionesReapuntadas = 0;
  const targetTitularId = titular?.id || egresoActual.docenteId;

  db.run('BEGIN TRANSACTION;');
  try {
    if (titular) {
      db.run(
        `UPDATE docentes
         SET situacion_final_gdp = 'Vigente',
             propuesta_gdp = 'Continuidad'
         WHERE id = ?;`,
        [titular.id]
      );
    }

    for (const vacId of vacantesLigadasIds) {
      if (targetTitularId) {
        const countRes = db.exec(
          `SELECT COUNT(*) FROM asignaciones_horarias
           WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
             AND (docente_id = ? OR co_docente_id = ?);`,
          [egresoActual.rbd, periodo, periodo, vacId, vacId]
        );
        asignacionesReapuntadas += Number(countRes[0]?.values[0]?.[0] || 0);

        db.run(
          `UPDATE asignaciones_horarias
           SET docente_id = ?
           WHERE docente_id = ? AND rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027));`,
          [targetTitularId, vacId, egresoActual.rbd, periodo, periodo]
        );
        db.run(
          `UPDATE asignaciones_horarias
           SET co_docente_id = ?
           WHERE co_docente_id = ? AND rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027));`,
          [targetTitularId, vacId, egresoActual.rbd, periodo, periodo]
        );
      }

      db.run(
        `UPDATE docentes
         SET es_vacante_nn = 0,
             vacante_condicional = 0,
             propuesta_gdp = 'Archivado por Reincorporación Titular',
             situacion_final_gdp = 'Cese'
         WHERE id = ?;`,
        [vacId]
      );
    }

    db.run(
      `UPDATE egresos_proyectados
       SET estado_reversion = 'REVERTIDO_REINCORPORADO',
           motivo_reversion = ?,
           fecha_reversion = ?,
           revertido_por = ?,
           updated_at = ?
       WHERE id = ?;`,
      [motivoClean, nowIso, actor, nowIso, egresoActual.id]
    );

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  const docsPost = await listarDocentes(egresoActual.rbd, periodo, true);
  const titularRestituido =
    docsPost.find(d => d.id === targetTitularId) ||
    (titular
      ? {
          ...titular,
          situacionFinalGdp: 'Vigente',
          propuestaGdp: 'Continuidad'
        }
      : null);

  const egresoActualizado: EgresoProyectado = {
    ...egresoActual,
    estadoReversion: 'REVERTIDO_REINCORPORADO',
    motivoReversion: motivoClean,
    fechaReversion: nowIso,
    revertidoPor: actor,
    updatedAt: nowIso
  };

  await registrarEventoAuditoria({
    rbd: egresoActual.rbd,
    periodo,
    tipoEvento: 'ACTUALIZACION',
    entidad: 'DOCENTE',
    entidadId: targetTitularId,
    descripcion: `Reverso controlado de egreso '${egresoActual.nombreDocente}' por ${actor}: titular restituido, ${asignacionesReapuntadas} asignación(es) reapuntada(s) y vacante transitoria archivada.`,
    detalles: {
      egresoId: egresoActual.id,
      motivo: motivoClean,
      vacantesArchivadas: Array.from(vacantesLigadasIds),
      asignacionesReapuntadas,
      usuarioActor: actor,
      rolActor: params.rolActor
    }
  });

  if (isSupabaseEnabled()) {
    const docentesSync = docsPost.filter(
      d => d.id === targetTitularId || vacantesLigadasIds.has(d.id)
    );
    if (docentesSync.length > 0) {
      void syncSupabaseMovilidad(
        { tabla: 'guardarDocentesBatch', operacion: 'servicio', payload: docentesSync },
        'reverso_egreso_docentes'
      );
    }
    for (const vacId of vacantesLigadasIds) {
      void syncSupabaseMovilidad(
        {
          tabla: 'asignaciones_horarias',
          operacion: 'update',
          payload: { docente_id: targetTitularId },
          match: { docente_id: vacId, rbd: egresoActual.rbd, periodo }
        },
        'reverso_egreso_asig_docente'
      );
      void syncSupabaseMovilidad(
        {
          tabla: 'asignaciones_horarias',
          operacion: 'update',
          payload: { co_docente_id: targetTitularId },
          match: { co_docente_id: vacId, rbd: egresoActual.rbd, periodo }
        },
        'reverso_egreso_asig_codocente'
      );
    }
    void syncSupabaseMovilidad(
      {
        tabla: 'egresos_proyectados',
        operacion: 'update',
        payload: {
          estado_reversion: 'REVERTIDO_REINCORPORADO',
          motivo_reversion: motivoClean,
          fecha_reversion: nowIso,
          revertido_por: actor,
          updated_at: nowIso
        },
        match: { id: egresoActual.id }
      },
      'reverso_egreso_estado'
    );
  }

  return {
    egreso: egresoActualizado,
    docenteTitularRestituido: titularRestituido,
    vacanteArchivadaId: vacanteIdPrincipal,
    asignacionesReapuntadas
  };
}

// =============================================================================
// 5. CRUD de Solicitudes de Movilidad, Remanentes, Asistentes Indefinidos y Techo/Piso
// =============================================================================

const SOLICITUD_SELECT_COLS = `
  id, periodo, carril, docente_id, run_docente, nombre_docente, rbd_origen,
  comuna_origen, rbd_destino_preferente, comuna_destino_preferente, calidad_juridica,
  horas_contrato_actual, horas_titulares_actuales, horas_disponibles_mover, horas_remanentes,
  asignatura_principal, titulo_mencion, aplica_articulo_69, fuente_actual, estado_flujo,
  puntaje_salud, puntaje_ley_karin, puntaje_cuidado_dependientes, puntaje_distancia_rural,
  puntaje_antiguedad, puntaje_prioridad_total, fundamento, creado_por,
  estamento_personal, categoria_asistente, horas_contrata_actuales,
  numero_resolucion, fecha_resolucion, fecha_vigencia,
  created_at, updated_at
`;

function mapRowToSolicitud(row: any[]): SolicitudMovilidad {
  const carril = String(row[2]) as CarrilMovilidad;
  const estamentoRaw = row[28] ? String(row[28]) : undefined;
  const estamentoPersonal: SolicitudMovilidad['estamentoPersonal'] =
    estamentoRaw === 'ASISTENTE' || carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO'
      ? 'ASISTENTE'
      : 'DOCENTE';

  return {
    id: String(row[0]),
    periodo: Number(row[1] || 2027),
    carril,
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
    estamentoPersonal,
    categoriaAsistente: row[29] ? (String(row[29]) as EstamentoAsistente) : undefined,
    horasContrataActuales:
      row[30] !== null && row[30] !== undefined ? Number(row[30]) : 0,
    numeroResolucion: row[31] ? String(row[31]) : undefined,
    fechaResolucion: row[32] ? String(row[32]) : undefined,
    fechaVigencia: row[33] ? String(row[33]) : undefined,
    createdAt: row[34] ? String(row[34]) : undefined,
    updatedAt: row[35] ? String(row[35]) : undefined
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
    creado_por: s.creadoPor || null,
    estamento_personal:
      s.estamentoPersonal ||
      (s.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO' ? 'ASISTENTE' : 'DOCENTE'),
    categoria_asistente: s.categoriaAsistente || null,
    horas_contrata_actuales: s.horasContrataActuales ?? 0,
    numero_resolucion: s.numeroResolucion || null,
    fecha_resolucion: s.fechaResolucion || null,
    fecha_vigencia: s.fechaVigencia || null
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
  sol: Omit<SolicitudMovilidad, 'id' | 'puntajePrioridadTotal' | 'createdAt' | 'updatedAt'> & {
    id?: string;
  },
  rolActor: RolId
): Promise<SolicitudMovilidad> {
  assertRolEditorMovilidad(rolActor, 'guardar solicitudes de movilidad');

  const periodo = sol.periodo || 2027;
  const db = await getDb();
  const nowIso = new Date().toISOString();
  const solId =
    sol.id?.trim() ||
    `sol_${periodo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  let prevCreatedAt: string | undefined;
  const prevRes = db.exec('SELECT created_at FROM solicitudes_movilidad WHERE id = ? LIMIT 1;', [
    solId
  ]);
  if (prevRes.length && prevRes[0].values.length && prevRes[0].values[0][0]) {
    prevCreatedAt = String(prevRes[0].values[0][0]);
  }

  const puntajePrioridadTotal = calcularPuntajePrioridadMovilidad({
    carril: mapCarrilAEngine(sol.carril),
    puntajeSalud: sol.puntajeSalud,
    puntajeLeyKarin: sol.puntajeLeyKarin,
    puntajeCuidadoDependientes: sol.puntajeCuidadoDependientes,
    puntajeDistanciaRural: sol.puntajeDistanciaRural,
    puntajeAntiguedad: sol.puntajeAntiguedad,
    horasRemanentes: sol.horasRemanentes
  });

  const horasContratoInt = Math.max(0, Math.round(Number(sol.horasContratoActual || 0)));
  const horasTitularesInt = Math.max(0, Math.round(Number(sol.horasTitularesActuales || 0)));
  const horasContrataInt =
    sol.horasContrataActuales !== undefined
      ? Math.max(0, Math.round(Number(sol.horasContrataActuales || 0)))
      : Math.max(0, horasContratoInt - horasTitularesInt);

  const estamentoPersonal: 'DOCENTE' | 'ASISTENTE' =
    sol.estamentoPersonal ||
    (sol.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO' ? 'ASISTENTE' : 'DOCENTE');

  const solicitudFinal: SolicitudMovilidad = {
    ...sol,
    id: solId,
    periodo,
    estamentoPersonal,
    horasContratoActual: horasContratoInt,
    horasTitularesActuales: horasTitularesInt,
    horasContrataActuales: horasContrataInt,
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
      puntaje_antiguedad, puntaje_prioridad_total, fundamento, creado_por,
      estamento_personal, categoria_asistente, horas_contrata_actuales,
      numero_resolucion, fecha_resolucion, fecha_vigencia,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      creado_por=excluded.creado_por,
      estamento_personal=excluded.estamento_personal,
      categoria_asistente=excluded.categoria_asistente,
      horas_contrata_actuales=excluded.horas_contrata_actuales,
      numero_resolucion=excluded.numero_resolucion,
      fecha_resolucion=excluded.fecha_resolucion,
      fecha_vigencia=excluded.fecha_vigencia,
      updated_at=excluded.updated_at;`,
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
      solicitudFinal.estamentoPersonal || 'DOCENTE',
      solicitudFinal.categoriaAsistente || null,
      solicitudFinal.horasContrataActuales ?? 0,
      solicitudFinal.numeroResolucion || null,
      solicitudFinal.fechaResolucion || null,
      solicitudFinal.fechaVigencia || null,
      solicitudFinal.createdAt ?? null,
      solicitudFinal.updatedAt ?? null
    ]
  );

  await persistDb(true);

  if (isSupabaseEnabled()) {
    void syncSupabaseMovilidad(
      {
        tabla: 'solicitudes_movilidad',
        operacion: 'upsert',
        payload: mapSolicitudToSupabase(solicitudFinal),
        onConflict: 'id'
      },
      'guardar_solicitud_movilidad'
    );
  }

  await registrarMovimientoMovilidad({
    periodo: solicitudFinal.periodo,
    tipoMovimiento: 'SOLICITUD_MOVILIDAD',
    entidad: 'SOLICITUD_MOVILIDAD',
    entidadId: solicitudFinal.id,
    codigoReferencia: solicitudFinal.runDocente,
    rbdOrigen: solicitudFinal.rbdOrigen,
    comuna: solicitudFinal.comunaOrigen,
    rbdDestino: solicitudFinal.rbdDestinoPreferente,
    usuarioActor: solicitudFinal.creadoPor || 'uatp',
    estadoNuevo: solicitudFinal.estadoFlujo,
    descripcion: `Solicitud de movilidad (${solicitudFinal.carril}) para ${solicitudFinal.nombreDocente} (${solicitudFinal.horasDisponiblesMover}h).`,
    motivo: solicitudFinal.fundamento
  });

  return solicitudFinal;
}

const TRANSICIONES_FLUJO_VALIDAS: Record<EstadoFlujoMovilidad, EstadoFlujoMovilidad[]> = {
  POSTULADO: ['PRE_ASIGNADO', 'RECHAZADO'],
  PRE_ASIGNADO: ['NOTIFICADO_DIRECCION_ORIGEN', 'RECHAZADO'],
  NOTIFICADO_DIRECCION_ORIGEN: ['ACEPTADO_CON_FIRMA', 'RECHAZADO'],
  ACEPTADO_CON_FIRMA: ['CONSOLIDADO', 'RECHAZADO'],
  CONSOLIDADO: ['RESOLUCION_EMITIDA'],
  RESOLUCION_EMITIDA: [],
  RECHAZADO: []
};

export async function avanzarEstadoFlujoMovilidad(
  id: string,
  nuevoEstado: EstadoFlujoMovilidad,
  rolActor: RolId
): Promise<SolicitudMovilidad> {
  assertRolEditorMovilidad(rolActor, 'avanzar estado de solicitud de movilidad');
  const db = await getDb();

  const res = db.exec(`SELECT ${SOLICITUD_SELECT_COLS} FROM solicitudes_movilidad WHERE id = ? LIMIT 1;`, [
    id
  ]);
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
  if (nuevoEstado === 'RESOLUCION_EMITIDA') {
    assertRolValidadorGdp(rolActor, 'emitir resolución exenta de una solicitud de movilidad');
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
    void syncSupabaseMovilidad(
      {
        tabla: 'solicitudes_movilidad',
        operacion: 'update',
        payload: { estado_flujo: nuevoEstado, updated_at: nowIso },
        match: { id }
      },
      'avanzar_estado_flujo_movilidad'
    );
  }

  await registrarMovimientoMovilidad({
    periodo: actual.periodo,
    tipoMovimiento: 'CAMBIO_ESTADO_SOLICITUD',
    entidad: 'SOLICITUD_MOVILIDAD',
    entidadId: actual.id,
    codigoReferencia: actual.runDocente,
    rbdOrigen: actual.rbdOrigen,
    comuna: actual.comunaOrigen,
    rbdDestino: actual.rbdDestinoPreferente,
    usuarioActor: String(rolActor),
    rolActor: String(rolActor),
    estadoAnterior: actual.estadoFlujo,
    estadoNuevo: nuevoEstado,
    descripcion: `Solicitud de ${actual.nombreDocente} avanzó de ${actual.estadoFlujo} a ${nuevoEstado}.`
  });

  return actualizada;
}

export async function eliminarSolicitudMovilidad(id: string, rolActor: RolId): Promise<void> {
  assertRolEditorMovilidad(rolActor, 'eliminar solicitudes de movilidad');
  const db = await getDb();
  db.run('DELETE FROM solicitudes_movilidad WHERE id = ?;', [id]);
  await persistDb(true);

  if (isSupabaseEnabled()) {
    void syncSupabaseMovilidad(
      { tabla: 'solicitudes_movilidad', operacion: 'delete', match: { id } },
      'eliminar_solicitud_movilidad'
    );
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
      hFuncionesNoAula +
      Number(d.horasTallerSep || 0) +
      Number(d.horasTrabajoColaborativo || 0);
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

/**
 * Detecta Asistentes de la Educación con horas indefinidas > 0 marcados con propuesta
 * o situación GDP de No Continuidad (Ley N° 21.109).
 */
export async function detectarAsistentesIndefinidosNoContinuidad(
  periodo: number = 2027,
  rolActor: RolId
): Promise<
  Array<{
    asistente: AsistenteEducacion;
    establecimiento?: Establecimiento;
    horasIndefinidas: number;
    horasPlazoFijo: number;
    razonGdp: string;
  }>
> {
  assertRolNivelCentral(rolActor, 'detectar asistentes indefinidos con no continuidad GDP');

  const [establecimientos, asistentes] = await Promise.all([
    listarEstablecimientos(),
    listarTodosLosAsistentesTerritorio(periodo)
  ]);

  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [e.rbd, e]));
  const resultados: Array<{
    asistente: AsistenteEducacion;
    establecimiento?: Establecimiento;
    horasIndefinidas: number;
    horasPlazoFijo: number;
    razonGdp: string;
  }> = [];

  for (const a of asistentes) {
    if (a.activo === false) continue;
    if (!esSituacionFinalActiva(a.situacionFinalGdp)) continue;

    const esNc =
      esPropuestaNoContinuidad(a.propuestaGdp) ||
      esPropuestaNoContinuidad(a.situacionFinalGdp);
    if (!esNc) continue;

    const horasIndefinidas =
      Number(a.horasSubvencionGeneralIndefinido || 0) +
      Number(a.horasSepIndefinido || 0) +
      Number(a.horasPieIndefinido || 0);
    if (horasIndefinidas <= 0) continue;

    const horasPlazoFijo =
      Number(a.horasSubvencionGeneralPlazoFijo || 0) +
      Number(a.horasSepPlazoFijo || 0) +
      Number(a.horasPiePlazoFijo || 0);

    const razonGdp =
      [a.observacionesDirector, a.observacionesSlep, a.observacionesPal, a.observaciones]
        .map(x => String(x || '').trim())
        .filter(Boolean)
        .join(' | ') ||
      a.propuestaGdp ||
      'No Continuidad GDP';

    resultados.push({
      asistente: a,
      establecimiento: estMap.get(a.rbd),
      horasIndefinidas,
      horasPlazoFijo,
      razonGdp
    });
  }

  resultados.sort((a, b) => b.horasIndefinidas - a.horasIndefinidas);
  return resultados;
}

/**
 * Calcula la proyección ejecutiva Techo vs Piso de horas antes del 1 de marzo
 * aplicando el filtro anti-doble-conteo sobre vacantes condicionales y los egresos proyectados activos.
 */
export async function calcularProyeccionTechoPisoHoras(
  periodo: number = 2027,
  rolActor: RolId
): Promise<ProyeccionTechoPisoHoras> {
  assertRolNivelCentral(rolActor, 'calcular proyección techo vs piso de horas');

  const [establecimientos, todosDocentes, egresos] = await Promise.all([
    listarEstablecimientos(),
    listarTodosLosDocentesTerritorio(periodo),
    listarEgresosProyectados(periodo, rolActor)
  ]);

  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [e.rbd, e]));
  const { docentesEfectivos, excluidosCondicionales } =
    filtrarDocentesSinDobleConteoCondicional(todosDocentes);

  const accPorRbd = new Map<
    string,
    {
      horasContratadasActivas: number;
      horasVacantesConfirmadasSinTitular: number;
      horasVacantesCondicionales: number;
    }
  >();

  const ensureRbd = (rbd: string) => {
    const key = String(rbd || '').trim();
    let item = accPorRbd.get(key);
    if (!item) {
      item = {
        horasContratadasActivas: 0,
        horasVacantesConfirmadasSinTitular: 0,
        horasVacantesCondicionales: 0
      };
      accPorRbd.set(key, item);
    }
    return item;
  };

  for (const est of establecimientos) {
    ensureRbd(est.rbd);
  }

  const vacantesCondContadasIds = new Set<string>();
  const egresosCubiertosIds = new Set<string>();

  for (const d of docentesEfectivos) {
    if (!esSituacionFinalActiva(d.situacionFinalGdp)) continue;
    const acc = ensureRbd(d.rbd);
    const hrs = Math.max(0, Number(d.horasContrato || 0));
    const esVac =
      Boolean(d.esVacanteNn) ||
      Boolean(d.vacanteCondicional) ||
      d.tipoVacante === 'CONDICIONAL_EGRESO';

    if (!esVac) {
      acc.horasContratadasActivas += hrs;
    } else if (d.vacanteCondicional === true || d.tipoVacante === 'CONDICIONAL_EGRESO') {
      acc.horasVacantesCondicionales += hrs;
      vacantesCondContadasIds.add(d.id);
      if (d.origenEgresoId) egresosCubiertosIds.add(d.origenEgresoId);
    } else {
      acc.horasVacantesConfirmadasSinTitular += hrs;
    }
  }

  for (const d of excluidosCondicionales) {
    if (!esSituacionFinalActiva(d.situacionFinalGdp)) continue;
    const acc = ensureRbd(d.rbd);
    acc.horasVacantesCondicionales += Math.max(0, Number(d.horasContrato || 0));
    vacantesCondContadasIds.add(d.id);
    if (d.origenEgresoId) egresosCubiertosIds.add(d.origenEgresoId);
  }

  for (const e of egresos) {
    if (e.estadoReversion === 'REVERTIDO_REINCORPORADO') continue;
    const evalJur = evaluarEgresoProyectado(toEgresoInput(e));
    if (!evalJur.liberaVacante || !evalJur.esVacanteCondicional) continue;

    const yaContadoPorVacante =
      (e.vacanteDocenteId && vacantesCondContadasIds.has(e.vacanteDocenteId)) ||
      egresosCubiertosIds.has(e.id);
    if (yaContadoPorVacante) continue;

    const acc = ensureRbd(e.rbd);
    acc.horasVacantesCondicionales += Math.max(0, Number(e.horasLiberadas || 0));
  }

  const detallePorRbd: DetalleTechoPisoPorRbd[] = [];
  let horasContratadasActivas = 0;
  let horasVacantesConfirmadasSinTitular = 0;
  let horasVacantesCondicionales = 0;
  let horasTechoAntes1Marzo = 0;
  let horasPisoSiEgresanCondicionales = 0;

  for (const [rbd, acc] of accPorRbd.entries()) {
    const piso = acc.horasContratadasActivas + acc.horasVacantesConfirmadasSinTitular;
    const techo = piso + acc.horasVacantesCondicionales;

    horasContratadasActivas += acc.horasContratadasActivas;
    horasVacantesConfirmadasSinTitular += acc.horasVacantesConfirmadasSinTitular;
    horasVacantesCondicionales += acc.horasVacantesCondicionales;
    horasPisoSiEgresanCondicionales += piso;
    horasTechoAntes1Marzo += techo;

    if (techo > 0 || piso > 0 || acc.horasVacantesCondicionales > 0) {
      detallePorRbd.push({
        rbd,
        nombreEstablecimiento: estMap.get(rbd)?.nombre || `RBD ${rbd}`,
        horasContratadasActivas: acc.horasContratadasActivas,
        horasVacantesConfirmadasSinTitular: acc.horasVacantesConfirmadasSinTitular,
        horasVacantesCondicionales: acc.horasVacantesCondicionales,
        horasTechoAntes1Marzo: techo,
        horasPisoSiEgresanCondicionales: piso
      });
    }
  }

  detallePorRbd.sort((a, b) => a.nombreEstablecimiento.localeCompare(b.nombreEstablecimiento, 'es'));

  return {
    periodo,
    horasContratadasActivas,
    horasVacantesConfirmadasSinTitular,
    horasVacantesCondicionales,
    horasTechoAntes1Marzo,
    horasPisoSiEgresanCondicionales,
    detallePorRbd
  };
}

// =============================================================================
// 6. Escenarios de Calce, Propuestas, Resolución de Rebotes y Consolidación
// =============================================================================

const ESCENARIO_SELECT_COLS = `
  id, periodo, nombre, descripcion, estado, version, creado_por, aprobado_por,
  consolidado_por, fecha_consolidacion, numero_resolucion, fecha_resolucion, fecha_vigencia,
  resumen_metricas_json, created_at, updated_at
`;

const PROPUESTA_SELECT_COLS = `
  id, escenario_id, periodo, solicitud_movilidad_id, docente_origen_id, run_docente,
  nombre_docente, rbd_origen, rbd_destino, vacante_destino_id, egreso_origen_id,
  tipo_cobertura, horas_asignadas, minutos_asignados, horas_pedagogicas_aula,
  fuente_destino, indice_compatibilidad, genera_rebote, vacante_rebote_json,
  alertas_normativas_json, bloquea_consolidacion, motivo_bloqueo, estado,
  estamento_personal, estado_resolucion_rebote, rebote_cubierto_por_propuesta_id,
  minutos_titulares_origen, minutos_contrata_origen,
  alerta_menoscabo_art50, alerta_condiciones_dificiles,
  alerta_habilitacion_seremi_dto352, alerta_itinerancia_rural,
  numero_resolucion, fecha_resolucion, fecha_vigencia,
  created_at, updated_at
`;

function mapRowToEscenario(row: any[]): EscenarioCalce {
  let resumenMetricas: EscenarioCalce['resumenMetricas'];
  if (row[13]) {
    try {
      resumenMetricas = JSON.parse(String(row[13]));
    } catch (_) {}
  }
  return {
    id: String(row[0]),
    periodo: Number(row[1] || 2027),
    nombre: String(row[2]),
    descripcion: row[3] ? String(row[3]) : undefined,
    estado: (row[4] ? String(row[4]) : 'BORRADOR') as EstadoEscenarioCalce,
    version: row[5] !== null && row[5] !== undefined ? Number(row[5]) : 1,
    creadoPor: row[6] ? String(row[6]) : undefined,
    aprobadoPor: row[7] ? String(row[7]) : undefined,
    consolidadoPor: row[8] ? String(row[8]) : undefined,
    fechaConsolidacion: row[9] ? String(row[9]) : undefined,
    numeroResolucion: row[10] ? String(row[10]) : undefined,
    fechaResolucion: row[11] ? String(row[11]) : undefined,
    fechaVigencia: row[12] ? String(row[12]) : undefined,
    resumenMetricas,
    createdAt: row[14] ? String(row[14]) : undefined,
    updatedAt: row[15] ? String(row[15]) : undefined
  };
}

function mapEscenarioToSupabase(e: EscenarioCalce) {
  return {
    id: e.id,
    periodo: e.periodo,
    nombre: e.nombre,
    descripcion: e.descripcion || null,
    estado: e.estado,
    version: e.version ?? 1,
    creado_por: e.creadoPor || null,
    aprobado_por: e.aprobadoPor || null,
    consolidado_por: e.consolidadoPor || null,
    fecha_consolidacion: e.fechaConsolidacion || null,
    numero_resolucion: e.numeroResolucion || null,
    fecha_resolucion: e.fechaResolucion || null,
    fecha_vigencia: e.fechaVigencia || null,
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

  const generaRebote = Boolean(row[17]);
  const estadoReboteRaw = row[24] ? String(row[24]) : undefined;
  const estadoResolucionRebote: EstadoResolucionRebote = estadoReboteRaw
    ? (estadoReboteRaw as EstadoResolucionRebote)
    : generaRebote
      ? 'PENDIENTE'
      : 'NO_APLICA';

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
    fuenteDestino: (row[15]
      ? String(row[15])
      : 'SUBVENCION_GENERAL') as PropuestaCalce['fuenteDestino'],
    indiceCompatibilidad: Number(row[16] || 0),
    generaRebote,
    vacanteRebote,
    alertasNormativas,
    bloqueaConsolidacion: Boolean(row[20]),
    motivoBloqueo: row[21] ? String(row[21]) : undefined,
    estado: (row[22] ? String(row[22]) : 'PROPUESTA') as PropuestaCalce['estado'],
    estamentoPersonal: (row[23] === 'ASISTENTE' ? 'ASISTENTE' : 'DOCENTE') as PropuestaCalce['estamentoPersonal'],
    estadoResolucionRebote,
    reboteCubiertoPorPropuestaId: row[25] ? String(row[25]) : undefined,
    minutosTitularesOrigen: Number(row[26] || 0),
    minutosContrataOrigen: Number(row[27] || 0),
    alertaMenoscaboEconomicoArt50: Boolean(row[28]),
    alertaCondicionesDificiles: Boolean(row[29]),
    alertaHabilitacionSeremiDto352: Boolean(row[30]),
    alertaItineranciaRural: Boolean(row[31]),
    numeroResolucion: row[32] ? String(row[32]) : undefined,
    fechaResolucion: row[33] ? String(row[33]) : undefined,
    fechaVigencia: row[34] ? String(row[34]) : undefined,
    createdAt: row[35] ? String(row[35]) : undefined,
    updatedAt: row[36] ? String(row[36]) : undefined
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
    estado: p.estado,
    estamento_personal: p.estamentoPersonal || 'DOCENTE',
    estado_resolucion_rebote:
      p.estadoResolucionRebote || (p.generaRebote ? 'PENDIENTE' : 'NO_APLICA'),
    rebote_cubierto_por_propuesta_id: p.reboteCubiertoPorPropuestaId || null,
    minutos_titulares_origen: p.minutosTitularesOrigen ?? 0,
    minutos_contrata_origen: p.minutosContrataOrigen ?? 0,
    alerta_menoscabo_art50: Boolean(p.alertaMenoscaboEconomicoArt50),
    alerta_condiciones_dificiles: Boolean(p.alertaCondicionesDificiles),
    alerta_habilitacion_seremi_dto352: Boolean(p.alertaHabilitacionSeremiDto352),
    alerta_itinerancia_rural: Boolean(p.alertaItineranciaRural),
    numero_resolucion: p.numeroResolucion || null,
    fecha_resolucion: p.fechaResolucion || null,
    fecha_vigencia: p.fechaVigencia || null
  };
}

function inferirFuenteDocenteCalce(d: Docente): FuenteFinanciamientoCalce {
  const sub =
    Number(d.horasSubvencionGeneralTitular || 0) +
    Number(d.horasSubvencionGeneralContrata || 0);
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
  const sub =
    Number(d.horasSubvencionGeneralTitular || 0) +
    Number(d.horasSubvencionGeneralContrata || 0);
  if (pie > 0 && pie >= sep && pie >= sub) return 'PIE';
  if (sep > 0 && sep >= sub) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function inferirFuenteAsistenteCalce(a: AsistenteEducacion): FuenteFinanciamientoCalce {
  const sub =
    Number(a.horasSubvencionGeneralIndefinido || 0) +
    Number(a.horasSubvencionGeneralPlazoFijo || 0);
  const sep = Number(a.horasSepIndefinido || 0) + Number(a.horasSepPlazoFijo || 0);
  const pie = Number(a.horasPieIndefinido || 0) + Number(a.horasPiePlazoFijo || 0);
  const activas = [sub > 0, sep > 0, pie > 0].filter(Boolean).length;
  if (activas > 1) return 'MIXTO';
  if (pie > 0) return 'PIE';
  if (sep > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function normalizarFuenteDestinoAsistente(a: AsistenteEducacion): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' {
  const pie = Number(a.horasPieIndefinido || 0) + Number(a.horasPiePlazoFijo || 0);
  const sep = Number(a.horasSepIndefinido || 0) + Number(a.horasSepPlazoFijo || 0);
  const sub =
    Number(a.horasSubvencionGeneralIndefinido || 0) +
    Number(a.horasSubvencionGeneralPlazoFijo || 0);
  if (pie > 0 && pie >= sep && pie >= sub) return 'PIE';
  if (sep > 0 && sep >= sub) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function mapDocEstamentoToAsistente(est: EstamentoDocente, fallback: EstamentoAsistente): EstamentoAsistenteMotor {
  if (est === 'PROFESIONAL_PAE') return 'PROFESIONAL';
  if (est === 'TECNICO_ESPECIAL') return 'TECNICO';
  if (est === 'ASISTENTE_AULA') return 'PARADOCENTE_INSPECTORIA';
  return fallback;
}

function calcularResumenMetricasEscenario(
  propuestas: PropuestaCalce[]
): NonNullable<EscenarioCalce['resumenMetricas']> {
  const vacantesCubiertas = new Set(
    propuestas
      .filter(p => !p.bloqueaConsolidacion && p.vacanteDestinoId)
      .map(p => p.vacanteDestinoId!)
  );
  const rebotesPendientes = propuestas.filter(
    p =>
      p.generaRebote &&
      (!p.estadoResolucionRebote ||
        p.estadoResolucionRebote === 'PENDIENTE' ||
        p.estadoResolucionRebote === 'NO_APLICA')
  ).length;
  const rebotesCubiertosCadena = propuestas.filter(
    p => p.generaRebote && p.estadoResolucionRebote === 'CUBIERTA_EN_CADENA'
  ).length;
  const rebotesDerivadosConcurso = propuestas.filter(
    p => p.generaRebote && p.estadoResolucionRebote === 'DERIVADA_A_CONCURSO_GDP'
  ).length;

  return {
    totalPropuestas: propuestas.length,
    propuestasValidas: propuestas.filter(p => !p.bloqueaConsolidacion).length,
    propuestasBloqueadas: propuestas.filter(p => p.bloqueaConsolidacion).length,
    vacantesNnCubiertas: vacantesCubiertas.size,
    rebotesGenerados: propuestas.filter(p => p.generaRebote).length,
    deltaMinutosTerritorial: propuestas.reduce(
      (sum, p) => sum + (p.vacanteRebote?.deltaMinutosCadena ?? 0),
      0
    ),
    rebotesPendientes,
    rebotesCubiertosCadena,
    rebotesDerivadosConcurso
  };
}

function actualizarResumenEscenarioEnDb(
  db: any,
  escenarioId: string,
  nowIso: string
): EscenarioCalce | null {
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

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    escenarioId
  ]);
  return escRes.length && escRes[0].values.length ? mapRowToEscenario(escRes[0].values[0]) : null;
}

function insertarPropuestaEnDb(db: any, propuesta: PropuestaCalce): void {
  db.run(
    `INSERT INTO propuestas_calce (
      id, escenario_id, periodo, solicitud_movilidad_id, docente_origen_id, run_docente,
      nombre_docente, rbd_origen, rbd_destino, vacante_destino_id, egreso_origen_id,
      tipo_cobertura, horas_asignadas, minutos_asignados, horas_pedagogicas_aula,
      fuente_destino, indice_compatibilidad, genera_rebote, vacante_rebote_json,
      alertas_normativas_json, bloquea_consolidacion, motivo_bloqueo, estado,
      estamento_personal, estado_resolucion_rebote, rebote_cubierto_por_propuesta_id,
      minutos_titulares_origen, minutos_contrata_origen,
      alerta_menoscabo_art50, alerta_condiciones_dificiles,
      alerta_habilitacion_seremi_dto352, alerta_itinerancia_rural,
      numero_resolucion, fecha_resolucion, fecha_vigencia,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
      propuesta.estamentoPersonal || 'DOCENTE',
      propuesta.estadoResolucionRebote || (propuesta.generaRebote ? 'PENDIENTE' : 'NO_APLICA'),
      propuesta.reboteCubiertoPorPropuestaId || null,
      propuesta.minutosTitularesOrigen ?? 0,
      propuesta.minutosContrataOrigen ?? 0,
      propuesta.alertaMenoscaboEconomicoArt50 ? 1 : 0,
      propuesta.alertaCondicionesDificiles ? 1 : 0,
      propuesta.alertaHabilitacionSeremiDto352 ? 1 : 0,
      propuesta.alertaItineranciaRural ? 1 : 0,
      propuesta.numeroResolucion || null,
      propuesta.fechaResolucion || null,
      propuesta.fechaVigencia || null,
      propuesta.createdAt ?? null,
      propuesta.updatedAt ?? null
    ]
  );
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
    asignaturaPrincipal:
      docenteOrigen.asignaturaPrincipal || docenteOrigen.funcionPrincipal || 'DOCENTE AULA',
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

  const asignacionesHeredadas: VacanteRebotePlan['asignacionesHeredadas'] = asignacionesOrigen.map(
    (a, idx) => {
      const outAsig = reboteOut.asignacionesHeredadas[idx];
      return {
        asignacionId: a.id,
        cursoId: a.cursoId,
        asignatura: outAsig?.asignatura || a.asignatura,
        horasPedagogicasAula: outAsig?.horasPedagogicas ?? a.horasPedagogicasAula
      };
    }
  );

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
      reboteOut.asignaturaPrincipal ||
      docenteOrigen.asignaturaPrincipal ||
      docenteOrigen.funcionPrincipal ||
      'DOCENTE AULA',
    fuenteFinanciamiento: fuenteNormalizada,
    asignacionesHeredadas,
    funcionesNoLectivasHeredadas,
    funcionesIntransferiblesDetectadas: reboteOut.funcionesIntransferiblesDetectadas,
    deltaMinutosCadena: reboteOut.deltaMinutosCadena
  };
}

/**
 * Actualiza versión de escenario condicionalmente en Supabase verificando conflicto optimista real,
 * tolerando errores offline o columnas faltantes (PGRST204 / 42703).
 */
async function sincronizarVersionEscenarioSupabase(params: {
  escenario: EscenarioCalce;
  versionAnterior: number;
  nuevaVersion: number;
  nowIso: string;
  onConflictoRollback: () => Promise<void>;
}): Promise<boolean> {
  if (!isSupabaseEnabled()) return true;

  try {
    const { data: verData, error: verError } = await supabase
      .from('escenarios_calce')
      .update({
        version: params.nuevaVersion,
        resumen_metricas_json: params.escenario.resumenMetricas || null,
        updated_at: params.nowIso
      })
      .eq('id', params.escenario.id)
      .eq('version', params.versionAnterior)
      .select('version');

    if (verError) {
      if (esErrorColumnaFaltanteSupabase(verError)) {
        await supabase
          .from('escenarios_calce')
          .update({
            resumen_metricas_json: params.escenario.resumenMetricas || null,
            updated_at: params.nowIso
          })
          .eq('id', params.escenario.id);
        return false;
      }
      console.warn('[movilidadTerritorialService] Aviso update version Supabase:', verError);
      return false;
    }

    if (Array.isArray(verData) && verData.length === 0) {
      const { data: actualRow, error: checkErr } = await supabase
        .from('escenarios_calce')
        .select('version')
        .eq('id', params.escenario.id)
        .maybeSingle();

      if (!checkErr && actualRow && Number(actualRow.version ?? 1) !== params.versionAnterior) {
        await params.onConflictoRollback();
        throw construirErrorConflictoVersion(params.versionAnterior, Number(actualRow.version ?? 1));
      }

      // Escenario creado offline: sembrar en Supabase con versión actualizada
      await supabase
        .from('escenarios_calce')
        .upsert(mapEscenarioToSupabase(params.escenario), { onConflict: 'id' });
    }
    return true;
  } catch (err: any) {
    if (String(err?.message || '').includes('CONFLICTO_VERSION')) {
      throw err;
    }
    console.warn('[movilidadTerritorialService] Aviso sync version escenario Supabase:', err);
    return false;
  }
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
  assertRolEditorMovilidad(rolActor, 'crear escenarios de calce');
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
    version: 1,
    creadoPor: params.creadoPor,
    resumenMetricas: {
      totalPropuestas: 0,
      propuestasValidas: 0,
      propuestasBloqueadas: 0,
      vacantesNnCubiertas: 0,
      rebotesGenerados: 0,
      deltaMinutosTerritorial: 0,
      rebotesPendientes: 0,
      rebotesCubiertosCadena: 0,
      rebotesDerivadosConcurso: 0
    },
    createdAt: nowIso,
    updatedAt: nowIso
  };

  const db = await getDb();
  db.run(
    `INSERT INTO escenarios_calce (
      id, periodo, nombre, descripcion, estado, version, creado_por, aprobado_por,
      consolidado_por, fecha_consolidacion, numero_resolucion, fecha_resolucion, fecha_vigencia,
      resumen_metricas_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?);`,
    [
      escenario.id,
      escenario.periodo,
      escenario.nombre,
      escenario.descripcion || null,
      escenario.estado,
      escenario.version ?? 1,
      escenario.creadoPor || null,
      JSON.stringify(escenario.resumenMetricas),
      escenario.createdAt ?? null,
      escenario.updatedAt ?? null
    ]
  );

  await persistDb(true);

  if (isSupabaseEnabled()) {
    void syncSupabaseMovilidad(
      {
        tabla: 'escenarios_calce',
        operacion: 'upsert',
        payload: mapEscenarioToSupabase(escenario),
        onConflict: 'id'
      },
      'crear_escenario_calce'
    );
  }

  return escenario;
}

export async function duplicarEscenarioCalce(
  escenarioId: string,
  nuevoNombre: string,
  rolActor: RolId,
  usuarioActor?: string
): Promise<EscenarioCalce> {
  assertRolEditorMovilidad(rolActor, 'duplicar escenarios de calce');
  const db = await getDb();

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${escenarioId}' no encontrado.`);
  }
  const orig = mapRowToEscenario(escRes[0].values[0]);

  const propRes = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ? ORDER BY created_at ASC;`,
    [escenarioId]
  );
  const origProps: PropuestaCalce[] = propRes.length
    ? propRes[0].values.map(mapRowToPropuesta)
    : [];

  const nowIso = new Date().toISOString();
  const nuevoEscenarioId = `esc_${orig.periodo}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const nombreFinal = String(nuevoNombre || '').trim() || `${orig.nombre} (Copia)`;

  const idMap = new Map<string, string>();
  const newIds = origProps.map((_, idx) => `prop_${nuevoEscenarioId}_${idx}_${Math.random().toString(36).slice(2, 6)}`);
  origProps.forEach((p, idx) => idMap.set(p.id, newIds[idx]));

  const nuevasProps: PropuestaCalce[] = origProps.map((p, idx) => ({
    ...p,
    id: newIds[idx],
    escenarioId: nuevoEscenarioId,
    estado: p.bloqueaConsolidacion ? 'BLOQUEADA' : 'PROPUESTA',
    reboteCubiertoPorPropuestaId: p.reboteCubiertoPorPropuestaId
      ? idMap.get(p.reboteCubiertoPorPropuestaId)
      : undefined,
    numeroResolucion: undefined,
    fechaResolucion: undefined,
    fechaVigencia: undefined,
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
    version: 1,
    creadoPor: usuarioActor || orig.creadoPor,
    resumenMetricas,
    createdAt: nowIso,
    updatedAt: nowIso
  };

  db.run('BEGIN TRANSACTION;');
  try {
    db.run(
      `INSERT INTO escenarios_calce (
        id, periodo, nombre, descripcion, estado, version, creado_por, aprobado_por,
        consolidado_por, fecha_consolidacion, numero_resolucion, fecha_resolucion, fecha_vigencia,
        resumen_metricas_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, NULL, NULL, NULL, ?, ?, ?);`,
      [
        nuevoEscenario.id,
        nuevoEscenario.periodo,
        nuevoEscenario.nombre,
        nuevoEscenario.descripcion || null,
        nuevoEscenario.estado,
        1,
        nuevoEscenario.creadoPor || null,
        JSON.stringify(resumenMetricas),
        nuevoEscenario.createdAt ?? null,
        nuevoEscenario.updatedAt ?? null
      ]
    );

    for (const p of nuevasProps) {
      insertarPropuestaEnDb(db, p);
    }

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  if (isSupabaseEnabled()) {
    void (async () => {
      await syncSupabaseMovilidad(
        {
          tabla: 'escenarios_calce',
          operacion: 'upsert',
          payload: mapEscenarioToSupabase(nuevoEscenario),
          onConflict: 'id'
        },
        'duplicar_escenario_calce'
      );
      if (nuevasProps.length > 0) {
        await syncSupabaseMovilidad(
          {
            tabla: 'propuestas_calce',
            operacion: 'upsert',
            payload: nuevasProps.map(mapPropuestaToSupabase),
            onConflict: 'id'
          },
          'duplicar_escenario_propuestas'
        );
      }
    })();
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
    vacanteDestinoId?: string;
    cubreRebotePropuestaId?: string;
    solicitudMovilidadId?: string;
    egresoOrigenId?: string;
    tipoCobertura?: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL';
    esTrasladoCompleto?: boolean;
    expectedVersion?: number;
    estamentoPersonal?: 'DOCENTE' | 'ASISTENTE';
    estadoResolucionRebote?: EstadoResolucionRebote;
    reboteCubiertoPorPropuestaId?: string;
  },
  rolActor: RolId
): Promise<PropuestaCalce> {
  assertRolEditorMovilidad(rolActor, 'agregar propuestas de calce');
  const db = await getDb();

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    params.escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${params.escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);
  if (escenario.estado === 'CONSOLIDADO' || escenario.estado === 'RESOLUCION_EMITIDA') {
    throw new Error(
      `El escenario '${escenario.nombre}' ya se encuentra ${escenario.estado} y no admite nuevas propuestas.`
    );
  }

  const versionAnterior = escenario.version ?? 1;
  if (params.expectedVersion !== undefined && versionAnterior !== params.expectedVersion) {
    throw construirErrorConflictoVersion(params.expectedVersion, versionAnterior);
  }

  const propRes = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ? ORDER BY created_at ASC;`,
    [params.escenarioId]
  );
  const propuestasExistentes: PropuestaCalce[] = (
    propRes.length ? propRes[0].values.map(mapRowToPropuesta) : []
  ).filter(p => (p.estado as string) !== 'DESCARTADA');

  if (!params.vacanteDestinoId && !params.cubreRebotePropuestaId) {
    throw new Error('Debe indicar una vacante destino válida para agregar la propuesta de calce.');
  }

  if (
    params.vacanteDestinoId &&
    propuestasExistentes.some(p => p.vacanteDestinoId === params.vacanteDestinoId)
  ) {
    throw new Error('Colisión de vacante: la vacante destino ya fue asignada en este escenario.');
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

  const periodo = params.periodo || escenario.periodo || 2027;
  const [establecimientos, todosDocentes, todasAsignaciones, todosAsistentes] = await Promise.all([
    listarEstablecimientos(),
    listarTodosLosDocentesTerritorio(periodo),
    listarTodasLasAsignaciones(periodo),
    listarTodosLosAsistentesTerritorio(periodo)
  ]);

  let estamentoPersonal: 'DOCENTE' | 'ASISTENTE' =
    params.estamentoPersonal ||
    (solicitud?.estamentoPersonal === 'ASISTENTE' ||
    solicitud?.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO'
      ? 'ASISTENTE'
      : 'DOCENTE');

  if (
    !params.estamentoPersonal &&
    estamentoPersonal === 'DOCENTE' &&
    !todosDocentes.some(d => d.id === params.docenteOrigenId) &&
    todosAsistentes.some(a => a.id === params.docenteOrigenId)
  ) {
    estamentoPersonal = 'ASISTENTE';
  }

  const docenteOrigen =
    estamentoPersonal === 'DOCENTE'
      ? todosDocentes.find(d => d.id === params.docenteOrigenId)
      : undefined;
  const asistenteOrigen =
    estamentoPersonal === 'ASISTENTE'
      ? todosAsistentes.find(a => a.id === params.docenteOrigenId)
      : undefined;

  if (estamentoPersonal === 'DOCENTE' && !docenteOrigen) {
    throw new Error(
      `Docente de origen '${params.docenteOrigenId}' no encontrado en el período ${periodo}.`
    );
  }
  if (estamentoPersonal === 'ASISTENTE' && !asistenteOrigen) {
    throw new Error(
      `Asistente de origen '${params.docenteOrigenId}' no encontrado en el período ${periodo}.`
    );
  }

  const runOrigen = docenteOrigen ? docenteOrigen.run : asistenteOrigen!.run;
  const runOrigenNorm = claveRunNormalizado(runOrigen);

  const propuestasMismoOrigen = propuestasExistentes.filter(
    p =>
      p.docenteOrigenId === params.docenteOrigenId ||
      (Boolean(runOrigenNorm) && claveRunNormalizado(p.runDocente) === runOrigenNorm)
  );

  const esTrasladoCompleto = params.esTrasladoCompleto !== false;

  // Consultar carriles de solicitudes vinculadas a propuestas previas del mismo funcionario
  const prevSolIds = Array.from(
    new Set(propuestasMismoOrigen.map(p => p.solicitudMovilidadId).filter(Boolean) as string[])
  );
  const solCarrilMap = new Map<string, CarrilMovilidad>();
  if (prevSolIds.length > 0) {
    const placeholders = prevSolIds.map(() => '?').join(',');
    const prevSolsRes = db.exec(
      `SELECT id, carril FROM solicitudes_movilidad WHERE id IN (${placeholders});`,
      prevSolIds
    );
    if (prevSolsRes.length && prevSolsRes[0].values.length) {
      for (const r of prevSolsRes[0].values) {
        solCarrilMap.set(String(r[0]), String(r[1]) as CarrilMovilidad);
      }
    }
  }

  if (propuestasMismoOrigen.length > 0) {
    const algunaPreviaEsCompleta = propuestasMismoOrigen.some(
      p =>
        Boolean(p.generaRebote) ||
        (Boolean(p.solicitudMovilidadId) &&
          solCarrilMap.get(p.solicitudMovilidadId!) !== 'HORAS_REMANENTES')
    );
    if (esTrasladoCompleto || algunaPreviaEsCompleta) {
      throw new Error(
        'Colisión de docente: este funcionario ya tiene un traslado completo asignado en el escenario.'
      );
    }
  }

  const minutosAdicionalesEscenario = propuestasMismoOrigen.reduce(
    (s, p) => s + Number(p.minutosAsignados || 0),
    0
  );

  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [e.rbd, e]));
  const nowIso = new Date().toISOString();

  // Resolver vacante destino real o rebote en cadena
  const propReboteObjetivo = params.cubreRebotePropuestaId
    ? propuestasExistentes.find(
        p => p.id === params.cubreRebotePropuestaId && p.generaRebote && p.vacanteRebote
      )
    : undefined;
  if (params.cubreRebotePropuestaId && !propReboteObjetivo) {
    throw new Error(
      `La propuesta origen de rebote '${params.cubreRebotePropuestaId}' no existe o no genera rebote.`
    );
  }
  if (
    propReboteObjetivo &&
    propReboteObjetivo.reboteCubiertoPorPropuestaId &&
    propReboteObjetivo.estadoResolucionRebote === 'CUBIERTA_EN_CADENA'
  ) {
    throw new Error(
      `Colisión de vacante: la vacante de rebote de '${propReboteObjetivo.id}' ya fue cubierta en cadena.`
    );
  }

  let propuesta: PropuestaCalce;

  if (estamentoPersonal === 'ASISTENTE' && asistenteOrigen) {
    const vacanteAst = params.vacanteDestinoId
      ? todosAsistentes.find(a => a.id === params.vacanteDestinoId)
      : undefined;
    const vacanteDoc =
      !vacanteAst && params.vacanteDestinoId
        ? todosDocentes.find(d => d.id === params.vacanteDestinoId)
        : undefined;

    if (!vacanteAst && !vacanteDoc) {
      throw new Error(
        `Vacante de destino '${params.vacanteDestinoId}' no encontrada en el período ${periodo}.`
      );
    }

    const rbdDestino = vacanteAst ? vacanteAst.rbd : vacanteDoc!.rbd;
    const horasVacante = vacanteAst
      ? Number(vacanteAst.horasContrato || 0)
      : Number(vacanteDoc!.horasContrato || 0);
    const estamentoVacante: EstamentoAsistenteMotor = vacanteAst
      ? vacanteAst.estamento
      : mapDocEstamentoToAsistente(vacanteDoc!.estamento, asistenteOrigen.estamento);
    const cargoVacante = vacanteAst
      ? vacanteAst.cargoFuncion
      : vacanteDoc!.asignaturaPrincipal || vacanteDoc!.cargoInstitucional || vacanteDoc!.apellidos;

    const egresoIdRef = params.egresoOrigenId || vacanteDoc?.origenEgresoId;
    let egresoAsociado: EgresoProyectadoInput | undefined;
    if (egresoIdRef) {
      const egrRes = db.exec(`SELECT ${EGRESO_SELECT_COLS} FROM egresos_proyectados WHERE id = ? LIMIT 1;`, [
        egresoIdRef
      ]);
      if (egrRes.length && egrRes[0].values.length) {
        egresoAsociado = toEgresoInput(mapRowToEgreso(egrRes[0].values[0]));
      }
    }

    const estOrigen = estMap.get(asistenteOrigen.rbd);
    const estDestino = estMap.get(rbdDestino);

    const otrosContratosAst = todosAsistentes.filter(a => {
      if (a.id === asistenteOrigen.id || (vacanteAst && a.id === vacanteAst.id)) return false;
      if (a.activo === false || !esSituacionFinalActiva(a.situacionFinalGdp)) return false;
      return Boolean(runOrigenNorm) && claveRunNormalizado(a.run) === runOrigenNorm;
    });
    const otrosContratosDoc = todosDocentes.filter(d => {
      if (d.id === vacanteDoc?.id || d.esVacanteNn || d.vacanteCondicional) return false;
      if (!esSituacionFinalActiva(d.situacionFinalGdp)) return false;
      return Boolean(runOrigenNorm) && claveRunNormalizado(d.run) === runOrigenNorm;
    });
    const horasOtrosEstablecimientos =
      otrosContratosAst.reduce((s, a) => s + Number(a.horasContrato || 0), 0) +
      otrosContratosDoc.reduce((s, d) => s + Number(d.horasContrato || 0), 0);

    const horasIndefOrigen =
      Number(asistenteOrigen.horasSubvencionGeneralIndefinido || 0) +
      Number(asistenteOrigen.horasSepIndefinido || 0) +
      Number(asistenteOrigen.horasPieIndefinido || 0);
    const horasPfOrigen =
      Number(asistenteOrigen.horasSubvencionGeneralPlazoFijo || 0) +
      Number(asistenteOrigen.horasSepPlazoFijo || 0) +
      Number(asistenteOrigen.horasPiePlazoFijo || 0);
    const tieneDesgloseAst = horasIndefOrigen > 0 || horasPfOrigen > 0;

    let horasIndefinidasReales = horasIndefOrigen;
    let horasPlazoFijoReales = horasPfOrigen;
    if (!tieneDesgloseAst) {
      if (solicitud?.horasTitularesActuales !== undefined) {
        horasIndefinidasReales = Math.max(0, Number(solicitud.horasTitularesActuales));
        horasPlazoFijoReales = Math.max(
          0,
          Number(asistenteOrigen.horasContrato || 0) - horasIndefinidasReales
        );
      } else {
        horasIndefinidasReales = 0;
        horasPlazoFijoReales = Number(asistenteOrigen.horasContrato || 0);
      }
    }

    const minutosIndefinidosOrigen = Math.round(horasIndefinidasReales * 60);
    const minutosPlazoFijoOrigen = Math.round(horasPlazoFijoReales * 60);
    const horasConservadasEnOrigen = esTrasladoCompleto
      ? 0
      : Number(asistenteOrigen.horasContrato || 0);

    const fuenteOrigen = inferirFuenteAsistenteCalce(asistenteOrigen);
    const fuenteDestino = vacanteAst
      ? normalizarFuenteDestinoAsistente(vacanteAst)
      : normalizarFuenteDestino(vacanteDoc!);
    const tipoCobertura: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL' =
      params.tipoCobertura ?? (horasIndefinidasReales > 0 ? 'DEFINITIVA' : 'TRANSITORIA_CONDICIONAL');

    const evalAst = evaluarCalceAsistenteLey21109({
      asistenteId: asistenteOrigen.id,
      calidadJuridica: horasIndefinidasReales > 0 ? 'INDEFINIDO' : 'PLAZO_FIJO',
      estamentoOrigen: asistenteOrigen.estamento,
      cargoFuncionOrigen: asistenteOrigen.cargoFuncion,
      horasContratoActual: asistenteOrigen.horasContrato,
      horasIndefinidasActuales: horasIndefinidasReales,
      minutosIndefinidosOrigen,
      minutosPlazoFijoOrigen,
      minutosAdicionalesEscenario,
      horasOtrosEstablecimientos,
      horasConservadasEnOrigen,
      fuenteOrigen,
      rbdOrigen: asistenteOrigen.rbd,
      accesibilidadOrigen: estOrigen?.accesibilidad ?? 'urbano',
      comunaOrigen: estOrigen?.comuna || solicitud?.comunaOrigen,
      carril: mapCarrilAsistenteMotor(solicitud?.carril),
      esTrasladoCompleto,
      topeHorasSemanales: asistenteOrigen.horasContrato === 45 ? 45 : 44,
      vacanteId: vacanteAst ? vacanteAst.id : vacanteDoc!.id,
      rbdDestino,
      estamentoVacante,
      cargoFuncionVacante: cargoVacante,
      horasVacante,
      fuenteDestino,
      accesibilidadDestino: estDestino?.accesibilidad ?? 'urbano',
      comunaDestino: estDestino?.comuna,
      esVacanteCondicional: vacanteDoc
        ? vacanteDoc.vacanteCondicional === true ||
          (vacanteDoc.tipoVacante === 'CONDICIONAL_EGRESO' &&
            vacanteDoc.vacanteCondicional !== false)
        : false,
      egresoAsociado,
      tipoCobertura
    });

    if (evalAst.excedeTopeSemanal && propuestasMismoOrigen.length > 0) {
      throw new Error(
        `Colisión de jornada (${evalAst.topeMinutosSemanal} min): la suma de propuestas en el escenario para este asistente excede ${evalAst.topeMinutosSemanal} min.`
      );
    }

    const generaRebote = esTrasladoCompleto && asistenteOrigen.rbd !== rbdDestino;
    let vacanteRebote: VacanteRebotePlan | undefined;
    if (generaRebote) {
      const fuenteRebote = normalizarFuenteDestinoAsistente(asistenteOrigen);
      const horasReb = Math.max(0, Number(asistenteOrigen.horasContrato || 0));
      vacanteRebote = {
        rbdOrigen: asistenteOrigen.rbd,
        nombreEstablecimientoOrigen: estOrigen?.nombre,
        horasContratoRebote: horasReb,
        minutosContratoRebote: Math.round(horasReb * 60),
        horasPedagogicasAula: 0,
        asignaturaPrincipal: asistenteOrigen.cargoFuncion || asistenteOrigen.estamento,
        fuenteFinanciamiento: fuenteRebote,
        asignacionesHeredadas: [],
        funcionesNoLectivasHeredadas: [],
        funcionesIntransferiblesDetectadas: [],
        deltaMinutosCadena: 0
      };
    }

    const estadoResolucionRebote: EstadoResolucionRebote = generaRebote
      ? params.estadoResolucionRebote || 'PENDIENTE'
      : 'NO_APLICA';

    propuesta = {
      id: `prop_${params.escenarioId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      escenarioId: params.escenarioId,
      periodo,
      solicitudMovilidadId: params.solicitudMovilidadId,
      docenteOrigenId: asistenteOrigen.id,
      runDocente: asistenteOrigen.run,
      nombreDocente: `${asistenteOrigen.nombres} ${asistenteOrigen.apellidos}`.trim(),
      rbdOrigen: asistenteOrigen.rbd,
      rbdDestino,
      vacanteDestinoId: vacanteAst ? vacanteAst.id : vacanteDoc!.id,
      egresoOrigenId: egresoIdRef,
      tipoCobertura,
      horasAsignadas: horasVacante,
      minutosAsignados: evalAst.minutosVacante,
      horasPedagogicasAula: 0,
      fuenteDestino,
      indiceCompatibilidad: evalAst.indiceCompatibilidad,
      generaRebote,
      vacanteRebote,
      alertasNormativas: evalAst.alertasNormativas,
      bloqueaConsolidacion: evalAst.bloqueaConsolidacion,
      motivoBloqueo: evalAst.motivoBloqueo,
      estado: evalAst.bloqueaConsolidacion ? 'BLOQUEADA' : 'PROPUESTA',
      estamentoPersonal: 'ASISTENTE',
      estadoResolucionRebote,
      reboteCubiertoPorPropuestaId: params.reboteCubiertoPorPropuestaId,
      minutosTitularesOrigen: evalAst.minutosIndefinidosOrigen,
      minutosContrataOrigen: evalAst.minutosPlazoFijoOrigen,
      alertaMenoscaboEconomicoArt50: false,
      alertaCondicionesDificiles: false,
      alertaHabilitacionSeremiDto352: false,
      alertaItineranciaRural: evalAst.alertaItineranciaRural,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  } else {
    // Rama DOCENTE
    const docOrig = docenteOrigen!;
    const vacanteDestino = params.vacanteDestinoId
      ? todosDocentes.find(d => d.id === params.vacanteDestinoId)
      : undefined;

    if (!vacanteDestino && !propReboteObjetivo) {
      throw new Error(
        `Vacante de destino '${params.vacanteDestinoId}' no encontrada en el período ${periodo}.`
      );
    }

    const rbdDestino = vacanteDestino
      ? vacanteDestino.rbd
      : propReboteObjetivo!.vacanteRebote!.rbdOrigen;
    const horasVacante = vacanteDestino
      ? Number(vacanteDestino.horasContrato || 0)
      : Number(propReboteObjetivo!.vacanteRebote!.horasContratoRebote || 0);
    const asignaturaVacante = vacanteDestino
      ? vacanteDestino.asignaturaPrincipal || vacanteDestino.apellidos
      : propReboteObjetivo!.vacanteRebote!.asignaturaPrincipal;

    const egresoIdRef = params.egresoOrigenId || vacanteDestino?.origenEgresoId;
    let egresoAsociado: EgresoProyectadoInput | undefined;
    if (egresoIdRef) {
      const egrRes = db.exec(`SELECT ${EGRESO_SELECT_COLS} FROM egresos_proyectados WHERE id = ? LIMIT 1;`, [
        egresoIdRef
      ]);
      if (egrRes.length && egrRes[0].values.length) {
        egresoAsociado = toEgresoInput(mapRowToEgreso(egrRes[0].values[0]));
      }
    }

    const estOrigen = estMap.get(docOrig.rbd);
    const estDestino = estMap.get(rbdDestino);

    const otrosContratos = todosDocentes.filter(d => {
      if (d.id === docOrig.id || (vacanteDestino && d.id === vacanteDestino.id)) return false;
      if (d.esVacanteNn || d.vacanteCondicional) return false;
      if (!esSituacionFinalActiva(d.situacionFinalGdp)) return false;
      return Boolean(runOrigenNorm) && claveRunNormalizado(d.run) === runOrigenNorm;
    });
    const horasOtrosEstablecimientos = otrosContratos.reduce(
      (s, d) => s + Number(d.horasContrato || 0),
      0
    );

    const horasConservadasEnOrigen = esTrasladoCompleto
      ? 0
      : Number(docOrig.horasContrato || 0);

    const asigsVacanteDestino = vacanteDestino
      ? todasAsignaciones.filter(
          a =>
            a.rbd === vacanteDestino.rbd &&
            (a.docenteId === vacanteDestino.id ||
              (a.tieneCoDocente && a.coDocenteId === vacanteDestino.id))
        )
      : [];
    const horasPedagogicasVacante = vacanteDestino
      ? asigsVacanteDestino
          .filter(a => !a.esTrabajoColaborativo)
          .reduce((s, a) => s + Number(a.horasPedagogicasAula || 0), 0) ||
        Number(vacanteDestino.horasAula || 0)
      : Number(propReboteObjetivo!.vacanteRebote!.horasPedagogicasAula || 0);

    const fuenteOrigen = inferirFuenteDocenteCalce(docOrig);
    const fuenteDestino = vacanteDestino
      ? normalizarFuenteDestino(vacanteDestino)
      : propReboteObjetivo!.vacanteRebote!.fuenteFinanciamiento;

    const sumTitDoc =
      Number(docOrig.horasSubvencionGeneralTitular || 0) +
      Number(docOrig.horasSepTitular || 0) +
      Number(docOrig.horasPieTitular || 0);
    const sumConDoc =
      Number(docOrig.horasSubvencionGeneralContrata || 0) +
      Number(docOrig.horasSepContrata || 0) +
      Number(docOrig.horasPieContrata || 0);
    const tieneDesgloseExplicito = sumTitDoc > 0 || sumConDoc > 0;

    let horasTitularesReales = sumTitDoc;
    let horasContrataReales = sumConDoc;
    if (!tieneDesgloseExplicito) {
      if (solicitud?.horasTitularesActuales !== undefined) {
        horasTitularesReales = Math.max(0, Number(solicitud.horasTitularesActuales));
        horasContrataReales = Math.max(
          0,
          Number(docOrig.horasContrato || 0) - horasTitularesReales
        );
      } else if (docOrig.calidadJuridica === 'TITULAR') {
        horasTitularesReales = Number(docOrig.horasContrato || 0);
        horasContrataReales = 0;
      } else {
        horasTitularesReales = 0;
        horasContrataReales = Number(docOrig.horasContrato || 0);
      }
    } else if (
      horasContrataReales === 0 &&
      Number(docOrig.horasContrato || 0) > horasTitularesReales
    ) {
      horasContrataReales = Math.max(
        0,
        Number(docOrig.horasContrato || 0) - horasTitularesReales
      );
    }

    const minutosTitularesOrigen = Math.round(horasTitularesReales * 60);
    const minutosContrataOrigen = Math.round(horasContrataReales * 60);

    const tipoCobertura: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL' =
      params.tipoCobertura ??
      (docOrig.calidadJuridica === 'TITULAR' || horasTitularesReales > 0
        ? 'DEFINITIVA'
        : 'TRANSITORIA_CONDICIONAL');

    const evaluacion = evaluarCalceDocenteVacante({
      docenteId: docOrig.id,
      calidadJuridica: docOrig.calidadJuridica,
      asignaturaDocente: docOrig.asignaturaPrincipal || docOrig.funcionPrincipal,
      tituloMencion: solicitud?.tituloMencion || docOrig.titulo,
      tituloMencionOficial: docOrig.titulo || solicitud?.tituloMencion,
      requiereAutorizacionDocente: Boolean(docOrig.requiereAutorizacionDocente),
      habilitacionSeremiRbd: docOrig.habilitacionSeremiRbd,
      habilitacionSeremiAsignatura: docOrig.habilitacionSeremiAsignatura,
      aplicaArticulo69: solicitud?.aplicaArticulo69 ?? Boolean(docOrig.aplicaArticulo69),
      horasContratoActual: docOrig.horasContrato,
      horasTitularesActuales: horasTitularesReales,
      minutosTitularesOrigen,
      minutosContrataOrigen,
      minutosAdicionalesEscenario,
      horasOtrosEstablecimientos,
      horasConservadasEnOrigen,
      fuenteOrigen,
      rbdOrigen: docOrig.rbd,
      porcentajePrioritariosOrigen: estOrigen?.porcentajePrioritarios,
      tramoCarreraDocente: docOrig.tramoCarreraDocente,
      condicionesDificilesOrigenPct: estOrigen?.condicionesDificilesPct ?? 0,
      accesibilidadOrigen: estOrigen?.accesibilidad ?? 'urbano',
      comunaOrigen: estOrigen?.comuna || solicitud?.comunaOrigen,
      carril: solicitud?.carril ? mapCarrilAEngine(solicitud.carril) : undefined,
      esTrasladoCompleto,
      vacanteId: vacanteDestino ? vacanteDestino.id : `rebote_${propReboteObjetivo!.id}`,
      rbdDestino,
      horasVacante,
      horasPedagogicasVacante,
      asignaturaVacante,
      fuenteDestino,
      porcentajePrioritariosDestino: estDestino?.porcentajePrioritarios ?? 75,
      condicionesDificilesDestinoPct: estDestino?.condicionesDificilesPct ?? 0,
      accesibilidadDestino: estDestino?.accesibilidad ?? 'urbano',
      comunaDestino: estDestino?.comuna,
      esVacanteCondicional: vacanteDestino
        ? vacanteDestino.vacanteCondicional === true ||
          (vacanteDestino.tipoVacante === 'CONDICIONAL_EGRESO' &&
            vacanteDestino.vacanteCondicional !== false)
        : false,
      egresoAsociado,
      tipoCobertura
    });

    if (evaluacion.excedeTope44h && propuestasMismoOrigen.length > 0) {
      throw new Error(
        'Colisión de jornada 44h (2640 min): la suma de propuestas en el escenario para este docente excede 2640 min.'
      );
    }

    const generaRebote = esTrasladoCompleto && docOrig.rbd !== rbdDestino;
    let vacanteRebote: VacanteRebotePlan | undefined;
    if (generaRebote) {
      const asignacionesOrigen = todasAsignaciones.filter(
        a =>
          a.rbd === docOrig.rbd &&
          (a.docenteId === docOrig.id || (a.tieneCoDocente && a.coDocenteId === docOrig.id))
      );
      const fuenteRebote = normalizarFuenteDestino(docOrig);
      vacanteRebote = construirVacanteRebotePlan(
        docOrig,
        estOrigen,
        asignacionesOrigen,
        fuenteRebote
      );
    }

    const estadoResolucionRebote: EstadoResolucionRebote = generaRebote
      ? params.estadoResolucionRebote || 'PENDIENTE'
      : 'NO_APLICA';

    propuesta = {
      id: `prop_${params.escenarioId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      escenarioId: params.escenarioId,
      periodo,
      solicitudMovilidadId: params.solicitudMovilidadId,
      docenteOrigenId: docOrig.id,
      runDocente: docOrig.run,
      nombreDocente: `${docOrig.nombres} ${docOrig.apellidos}`.trim(),
      rbdOrigen: docOrig.rbd,
      rbdDestino,
      vacanteDestinoId: vacanteDestino ? vacanteDestino.id : undefined,
      egresoOrigenId: egresoIdRef,
      tipoCobertura,
      horasAsignadas: horasVacante,
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
      estamentoPersonal: 'DOCENTE',
      estadoResolucionRebote,
      reboteCubiertoPorPropuestaId: params.reboteCubiertoPorPropuestaId,
      minutosTitularesOrigen: evaluacion.minutosTitularesOrigen,
      minutosContrataOrigen: evaluacion.minutosContrataOrigen,
      alertaMenoscaboEconomicoArt50: evaluacion.alertaMenoscaboEconomicoArt50,
      alertaCondicionesDificiles: evaluacion.alertaCondicionesDificiles,
      alertaHabilitacionSeremiDto352: evaluacion.alertaHabilitacionSeremiDto352,
      alertaItineranciaRural: evaluacion.alertaItineranciaRural,
      createdAt: nowIso,
      updatedAt: nowIso
    };
  }

  const nuevaVersion = versionAnterior + 1;
  let escenarioActualizado: EscenarioCalce | null = null;

  db.run('BEGIN TRANSACTION;');
  try {
    insertarPropuestaEnDb(db, propuesta);
    if (propReboteObjetivo) {
      db.run(
        `UPDATE propuestas_calce
         SET estado_resolucion_rebote = 'CUBIERTA_EN_CADENA',
             rebote_cubierto_por_propuesta_id = ?,
             updated_at = ?
         WHERE id = ?;`,
        [propuesta.id, nowIso, propReboteObjetivo.id]
      );
    }
    db.run('UPDATE escenarios_calce SET version = ?, updated_at = ? WHERE id = ?;', [
      nuevaVersion,
      nowIso,
      params.escenarioId
    ]);
    escenarioActualizado = actualizarResumenEscenarioEnDb(db, params.escenarioId, nowIso);
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  if (isSupabaseEnabled() && escenarioActualizado) {
    await sincronizarVersionEscenarioSupabase({
      escenario: escenarioActualizado,
      versionAnterior,
      nuevaVersion,
      nowIso,
      onConflictoRollback: async () => {
        db.run('BEGIN TRANSACTION;');
        try {
          db.run('DELETE FROM propuestas_calce WHERE id = ?;', [propuesta.id]);
          if (propReboteObjetivo) {
            db.run(
              `UPDATE propuestas_calce
               SET estado_resolucion_rebote = ?,
                   rebote_cubierto_por_propuesta_id = ?,
                   updated_at = ?
               WHERE id = ?;`,
              [
                propReboteObjetivo.estadoResolucionRebote || 'PENDIENTE',
                propReboteObjetivo.reboteCubiertoPorPropuestaId || null,
                propReboteObjetivo.updatedAt || nowIso,
                propReboteObjetivo.id
              ]
            );
          }
          db.run(
            'UPDATE escenarios_calce SET version = ?, resumen_metricas_json = ?, updated_at = ? WHERE id = ?;',
            [
              versionAnterior,
              escenario.resumenMetricas ? JSON.stringify(escenario.resumenMetricas) : null,
              escenario.updatedAt || nowIso,
              params.escenarioId
            ]
          );
          db.run('COMMIT;');
        } catch {
          db.run('ROLLBACK;');
        }
        await persistDb(true);
      }
    });

    void (async () => {
      const payloadCompleto = mapPropuestaToSupabase(propuesta);
      try {
        const { error }: any = await supabase
          .from('propuestas_calce')
          .upsert(payloadCompleto, { onConflict: 'id' });
        if (error && esErrorColumnaFaltanteSupabase(error)) {
          await syncSupabaseMovilidad(
            {
              tabla: 'propuestas_calce',
              operacion: 'upsert',
              payload: {
                id: propuesta.id,
                escenario_id: propuesta.escenarioId,
                periodo: propuesta.periodo,
                solicitud_movilidad_id: propuesta.solicitudMovilidadId || null,
                docente_origen_id: propuesta.docenteOrigenId,
                run_docente: propuesta.runDocente,
                nombre_docente: propuesta.nombreDocente,
                rbd_origen: propuesta.rbdOrigen,
                rbd_destino: propuesta.rbdDestino,
                vacante_destino_id: propuesta.vacanteDestinoId || null,
                egreso_origen_id: propuesta.egresoOrigenId || null,
                tipo_cobertura: propuesta.tipoCobertura,
                horas_asignadas: propuesta.horasAsignadas,
                minutos_asignados: propuesta.minutosAsignados,
                horas_pedagogicas_aula: propuesta.horasPedagogicasAula,
                fuente_destino: propuesta.fuenteDestino,
                indice_compatibilidad: propuesta.indiceCompatibilidad,
                genera_rebote: Boolean(propuesta.generaRebote),
                vacante_rebote_json: propuesta.vacanteRebote || null,
                alertas_normativas_json: propuesta.alertasNormativas || [],
                bloquea_consolidacion: Boolean(propuesta.bloqueaConsolidacion),
                motivo_bloqueo: propuesta.motivoBloqueo || null,
                estado: propuesta.estado
              },
              onConflict: 'id'
            },
            'agregar_propuesta_calce_compat'
          );
        } else if (error) {
          await syncSupabaseMovilidad(
            {
              tabla: 'propuestas_calce',
              operacion: 'upsert',
              payload: payloadCompleto,
              onConflict: 'id'
            },
            'agregar_propuesta_calce'
          );
        }
      } catch {
        await syncSupabaseMovilidad(
          {
            tabla: 'propuestas_calce',
            operacion: 'upsert',
            payload: payloadCompleto,
            onConflict: 'id'
          },
          'agregar_propuesta_calce'
        );
      }
    })();
  }

  return propuesta;
}

/**
 * Define explícitamente el cierre de una vacante NN-Rebote ('CUBIERTA_EN_CADENA' o 'DERIVADA_A_CONCURSO_GDP')
 * antes de poder consolidar el escenario.
 */
export async function resolverRebotePropuestaCalce(params: {
  propuestaId: string;
  estadoResolucion: 'CUBIERTA_EN_CADENA' | 'DERIVADA_A_CONCURSO_GDP';
  reboteCubiertoPorPropuestaId?: string;
  rolActor: RolId;
  expectedVersion?: number;
}): Promise<PropuestaCalce> {
  assertRolEditorMovilidad(params.rolActor, 'resolver vacante de rebote en propuesta de calce');

  const db = await getDb();
  const propRes = db.exec(`SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE id = ? LIMIT 1;`, [
    params.propuestaId
  ]);
  if (!propRes.length || !propRes[0].values.length) {
    throw new Error(`Propuesta de calce '${params.propuestaId}' no encontrada.`);
  }
  const actual = mapRowToPropuesta(propRes[0].values[0]);

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    actual.escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${actual.escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);
  if (escenario.estado === 'CONSOLIDADO' || escenario.estado === 'RESOLUCION_EMITIDA') {
    throw new Error(
      `El escenario '${escenario.nombre}' ya se encuentra ${escenario.estado} y no permite modificar rebotes.`
    );
  }

  const versionAnterior = escenario.version ?? 1;
  if (params.expectedVersion !== undefined && versionAnterior !== params.expectedVersion) {
    throw construirErrorConflictoVersion(params.expectedVersion, versionAnterior);
  }

  if (!actual.generaRebote) {
    throw new Error(`La propuesta '${params.propuestaId}' no genera vacante de rebote.`);
  }

  let cubiertoPorId: string | undefined;
  if (params.estadoResolucion === 'CUBIERTA_EN_CADENA' && params.reboteCubiertoPorPropuestaId) {
    if (params.reboteCubiertoPorPropuestaId === actual.id) {
      throw new Error('Una propuesta no puede cubrir su propia vacante de rebote.');
    }
    const targetRes = db.exec(
      'SELECT id FROM propuestas_calce WHERE id = ? AND escenario_id = ? LIMIT 1;',
      [params.reboteCubiertoPorPropuestaId, actual.escenarioId]
    );
    if (!targetRes.length || !targetRes[0].values.length) {
      throw new Error(
        `La propuesta vinculada '${params.reboteCubiertoPorPropuestaId}' no existe en el escenario '${actual.escenarioId}'.`
      );
    }
    cubiertoPorId = params.reboteCubiertoPorPropuestaId;
  }

  const nowIso = new Date().toISOString();
  const nuevaVersion = versionAnterior + 1;
  let escenarioActualizado: EscenarioCalce | null = null;

  db.run('BEGIN TRANSACTION;');
  try {
    db.run(
      `UPDATE propuestas_calce
       SET estado_resolucion_rebote = ?,
           rebote_cubierto_por_propuesta_id = ?,
           updated_at = ?
       WHERE id = ?;`,
      [params.estadoResolucion, cubiertoPorId || null, nowIso, actual.id]
    );
    db.run('UPDATE escenarios_calce SET version = ?, updated_at = ? WHERE id = ?;', [
      nuevaVersion,
      nowIso,
      actual.escenarioId
    ]);
    escenarioActualizado = actualizarResumenEscenarioEnDb(db, actual.escenarioId, nowIso);
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  const actualizada: PropuestaCalce = {
    ...actual,
    estadoResolucionRebote: params.estadoResolucion,
    reboteCubiertoPorPropuestaId: cubiertoPorId,
    updatedAt: nowIso
  };

  if (isSupabaseEnabled() && escenarioActualizado) {
    await sincronizarVersionEscenarioSupabase({
      escenario: escenarioActualizado,
      versionAnterior,
      nuevaVersion,
      nowIso,
      onConflictoRollback: async () => {
        db.run('BEGIN TRANSACTION;');
        try {
          db.run(
            `UPDATE propuestas_calce
             SET estado_resolucion_rebote = ?,
                 rebote_cubierto_por_propuesta_id = ?,
                 updated_at = ?
             WHERE id = ?;`,
            [
              actual.estadoResolucionRebote || 'PENDIENTE',
              actual.reboteCubiertoPorPropuestaId || null,
              actual.updatedAt || nowIso,
              actual.id
            ]
          );
          db.run(
            'UPDATE escenarios_calce SET version = ?, resumen_metricas_json = ?, updated_at = ? WHERE id = ?;',
            [
              versionAnterior,
              escenario.resumenMetricas ? JSON.stringify(escenario.resumenMetricas) : null,
              escenario.updatedAt || nowIso,
              actual.escenarioId
            ]
          );
          db.run('COMMIT;');
        } catch {
          db.run('ROLLBACK;');
        }
        await persistDb(true);
      }
    });

    void syncSupabaseMovilidad(
      {
        tabla: 'propuestas_calce',
        operacion: 'update',
        payload: {
          estado_resolucion_rebote: params.estadoResolucion,
          rebote_cubierto_por_propuesta_id: cubiertoPorId || null,
          updated_at: nowIso
        },
        match: { id: actual.id }
      },
      'resolver_rebote_propuesta'
    );
  }

  return actualizada;
}

export async function eliminarPropuestaCalce(propuestaId: string, rolActor: RolId): Promise<void> {
  assertRolEditorMovilidad(rolActor, 'eliminar propuestas de calce');
  const db = await getDb();

  const res = db.exec('SELECT escenario_id FROM propuestas_calce WHERE id = ? LIMIT 1;', [
    propuestaId
  ]);
  if (!res.length || !res[0].values.length) {
    return;
  }
  const escenarioId = String(res[0].values[0][0]);

  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) return;
  const escenario = mapRowToEscenario(escRes[0].values[0]);

  if (escenario.estado === 'CONSOLIDADO' || escenario.estado === 'RESOLUCION_EMITIDA') {
    throw new Error(
      `No se puede eliminar propuestas de un escenario que ya fue ${escenario.estado}.`
    );
  }

  const nowIso = new Date().toISOString();
  const nuevaVersion = (escenario.version ?? 1) + 1;
  let escenarioActualizado: EscenarioCalce | null = null;

  db.run('BEGIN TRANSACTION;');
  try {
    db.run(
      `UPDATE propuestas_calce
       SET estado_resolucion_rebote = 'PENDIENTE',
           rebote_cubierto_por_propuesta_id = NULL,
           updated_at = ?
       WHERE escenario_id = ? AND rebote_cubierto_por_propuesta_id = ?;`,
      [nowIso, escenarioId, propuestaId]
    );
    db.run('DELETE FROM propuestas_calce WHERE id = ?;', [propuestaId]);
    db.run('UPDATE escenarios_calce SET version = ?, updated_at = ? WHERE id = ?;', [
      nuevaVersion,
      nowIso,
      escenarioId
    ]);
    escenarioActualizado = actualizarResumenEscenarioEnDb(db, escenarioId, nowIso);
    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  if (isSupabaseEnabled()) {
    void (async () => {
      await syncSupabaseMovilidad(
        { tabla: 'propuestas_calce', operacion: 'delete', match: { id: propuestaId } },
        'eliminar_propuesta_calce'
      );
      if (escenarioActualizado) {
        await syncSupabaseMovilidad(
          {
            tabla: 'escenarios_calce',
            operacion: 'update',
            payload: {
              version: nuevaVersion,
              resumen_metricas_json: escenarioActualizado.resumenMetricas || null,
              updated_at: nowIso
            },
            match: { id: escenarioId }
          },
          'actualizar_escenario_tras_eliminar_propuesta'
        );
      }
    })();
  }
}

/**
 * Fase 3: Optimización Global Bipartita (Algoritmo Húngaro / Kuhn-Munkres) con 2ª Pasada
 * sobre vacantes de rebote.
 */
export async function generarSugerenciasCalceAutomatico(
  escenarioId: string,
  periodo: number = 2027,
  rolActor: RolId
): Promise<PropuestaCalce[]> {
  assertRolEditorMovilidad(rolActor, 'generar sugerencias de calce automático');

  const flags = obtenerFeatureFlagsMovilidad();
  if (!flags.flag_simulador_calce_automatico) {
    throw new Error(
      'El simulador de calce automático está desactivado (flag_simulador_calce_automatico = false).'
    );
  }

  const db = await getDb();
  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);
  if (escenario.estado === 'CONSOLIDADO' || escenario.estado === 'RESOLUCION_EMITIDA') {
    throw new Error(`No se pueden generar sugerencias sobre un escenario en estado ${escenario.estado}.`);
  }

  const propuestasExistentes = await listarPropuestasEscenario(escenarioId, rolActor);
  const docentesUsados = new Set(propuestasExistentes.map(p => p.docenteOrigenId));
  const vacantesUsadas = new Set(
    propuestasExistentes.map(p => p.vacanteDestinoId).filter(Boolean) as string[]
  );

  const [solicitudes, establecimientos, todosDocentes, todasAsignaciones, egresos] =
    await Promise.all([
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
      s.estadoFlujo !== 'RESOLUCION_EMITIDA' &&
      s.estadoFlujo !== 'RECHAZADO' &&
      s.estamentoPersonal !== 'ASISTENTE' &&
      s.carril !== 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO' &&
      !docentesUsados.has(s.docenteId) &&
      docMap.has(s.docenteId)
  );

  const vacantesAbiertas = todosDocentes.filter(
    d =>
      esSituacionFinalActiva(d.situacionFinalGdp) &&
      (Boolean(d.esVacanteNn) || detectarDocenteVacanteNn(d).esVacanteNn) &&
      !vacantesUsadas.has(d.id)
  );

  if (solicitudesActivas.length === 0 || vacantesAbiertas.length === 0) {
    return [];
  }

  const horasPorRun = new Map<string, Array<{ id: string; horas: number }>>();
  for (const d of todosDocentes) {
    if (d.esVacanteNn || d.vacanteCondicional || !esSituacionFinalActiva(d.situacionFinalGdp)) {
      continue;
    }
    const kRun = claveRunNormalizado(d.run);
    if (!kRun) continue;
    const list = horasPorRun.get(kRun) || [];
    list.push({ id: d.id, horas: Number(d.horasContrato || 0) });
    horasPorRun.set(kRun, list);
  }

  const candidatosPorId = new Map<
    string,
    { solicitud: SolicitudMovilidad; candidato: DocenteCandidatoCalce }
  >();
  for (const sol of solicitudesActivas) {
    const doc = docMap.get(sol.docenteId);
    if (!doc) continue;
    const kRun = claveRunNormalizado(doc.run);
    const otrosHoras = (horasPorRun.get(kRun) || [])
      .filter(x => x.id !== doc.id)
      .reduce((s, x) => s + x.horas, 0);

    const estOrig = estMap.get(doc.rbd);
    const esTrasladoComp = sol.carril !== 'HORAS_REMANENTES';

    const sumTitDoc =
      Number(doc.horasSubvencionGeneralTitular || 0) +
      Number(doc.horasSepTitular || 0) +
      Number(doc.horasPieTitular || 0);
    const sumConDoc =
      Number(doc.horasSubvencionGeneralContrata || 0) +
      Number(doc.horasSepContrata || 0) +
      Number(doc.horasPieContrata || 0);
    const horasTit =
      sumTitDoc > 0 || sumConDoc > 0
        ? sumTitDoc
        : sol.horasTitularesActuales ??
          (doc.calidadJuridica === 'TITULAR' ? doc.horasContrato : 0);
    const horasCon =
      sumTitDoc > 0 || sumConDoc > 0
        ? sumConDoc
        : Math.max(0, Number(doc.horasContrato || 0) - horasTit);

    const carrilEngine = mapCarrilAEngine(sol.carril);
    const candidato: DocenteCandidatoCalce = {
      docenteId: doc.id,
      calidadJuridica: doc.calidadJuridica,
      asignaturaDocente:
        sol.asignaturaPrincipal || doc.asignaturaPrincipal || doc.funcionPrincipal,
      tituloMencion: sol.tituloMencion || doc.titulo,
      tituloMencionOficial: doc.titulo || sol.tituloMencion,
      requiereAutorizacionDocente: Boolean(doc.requiereAutorizacionDocente),
      habilitacionSeremiRbd: doc.habilitacionSeremiRbd,
      habilitacionSeremiAsignatura: doc.habilitacionSeremiAsignatura,
      aplicaArticulo69: sol.aplicaArticulo69 ?? Boolean(doc.aplicaArticulo69),
      horasContratoActual: doc.horasContrato,
      horasTitularesActuales: horasTit,
      minutosTitularesOrigen: Math.round(horasTit * 60),
      minutosContrataOrigen: Math.round(horasCon * 60),
      horasOtrosEstablecimientos: otrosHoras,
      horasConservadasEnOrigen: esTrasladoComp ? 0 : doc.horasContrato,
      fuenteOrigen: inferirFuenteDocenteCalce(doc),
      rbdOrigen: doc.rbd,
      porcentajePrioritariosOrigen: estOrig?.porcentajePrioritarios,
      tramoCarreraDocente: doc.tramoCarreraDocente,
      condicionesDificilesOrigenPct: estOrig?.condicionesDificilesPct ?? 0,
      accesibilidadOrigen: estOrig?.accesibilidad ?? 'urbano',
      comunaOrigen: sol.comunaOrigen || estOrig?.comuna,
      carril: carrilEngine,
      esTrasladoCompleto: esTrasladoComp,
      rbdDestinoPreferente: sol.rbdDestinoPreferente,
      comunaDestinoPreferente: sol.comunaDestinoPreferente,
      prioridadMovilidad: {
        carril: carrilEngine,
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

  const vacantesObjMap = new Map<string, { doc: Docente; obj: VacanteObjetivoCalce }>();
  const vacantesObjetivos: VacanteObjetivoCalce[] = vacantesAbiertas.map(vacante => {
    const estDest = estMap.get(vacante.rbd);
    const egr = vacante.origenEgresoId ? egresoMap.get(vacante.origenEgresoId) : undefined;
    const egresoAsociado = egr ? toEgresoInput(egr) : undefined;

    const asigsVac = todasAsignaciones.filter(
      a =>
        a.rbd === vacante.rbd &&
        (a.docenteId === vacante.id || (a.tieneCoDocente && a.coDocenteId === vacante.id))
    );
    const horasPedVac =
      asigsVac
        .filter(a => !a.esTrabajoColaborativo)
        .reduce((s, a) => s + Number(a.horasPedagogicasAula || 0), 0) ||
      Number(vacante.horasAula || 0);

    const obj: VacanteObjetivoCalce = {
      vacanteId: vacante.id,
      rbdDestino: vacante.rbd,
      horasVacante: vacante.horasContrato,
      horasPedagogicasVacante: horasPedVac,
      asignaturaVacante: vacante.asignaturaPrincipal || vacante.apellidos,
      fuenteDestino: normalizarFuenteDestino(vacante),
      porcentajePrioritariosDestino: estDest?.porcentajePrioritarios ?? 75,
      condicionesDificilesDestinoPct: estDest?.condicionesDificilesPct ?? 0,
      accesibilidadDestino: estDest?.accesibilidad ?? 'urbano',
      comunaDestino: estDest?.comuna,
      esVacanteCondicional:
        vacante.vacanteCondicional === true ||
        (vacante.tipoVacante === 'CONDICIONAL_EGRESO' && vacante.vacanteCondicional !== false),
      egresoAsociado
    };
    vacantesObjMap.set(vacante.id, { doc: vacante, obj });
    return obj;
  });

  const candidatosDisponibles = Array.from(candidatosPorId.values()).map(c => c.candidato);
  const optimo = resolverCalceOptimoConCadenasRebote(
    candidatosDisponibles,
    vacantesObjetivos,
    55
  );

  const propuestasCreadas: PropuestaCalce[] = [];
  const propuestaPasada1PorOrigenDoc = new Map<string, PropuestaCalce>();

  // Pasada 1: Vacantes reales abiertas
  for (const asig of optimo.asignacionesPasada1) {
    if (
      docentesUsados.has(asig.candidato.docenteId) ||
      vacantesUsadas.has(asig.vacante.vacanteId)
    ) {
      continue;
    }
    const infoCand = candidatosPorId.get(asig.candidato.docenteId);
    const infoVac = vacantesObjMap.get(asig.vacante.vacanteId);
    if (!infoCand || !infoVac) continue;

    const prop = await agregarPropuestaCalce(
      {
        escenarioId,
        periodo,
        docenteOrigenId: asig.candidato.docenteId,
        vacanteDestinoId: infoVac.doc.id,
        solicitudMovilidadId: infoCand.solicitud.id,
        egresoOrigenId: infoVac.doc.origenEgresoId,
        tipoCobertura:
          asig.candidato.calidadJuridica === 'TITULAR' && !infoVac.obj.esVacanteCondicional
            ? 'DEFINITIVA'
            : 'TRANSITORIA_CONDICIONAL',
        esTrasladoCompleto: asig.candidato.esTrasladoCompleto
      },
      rolActor
    );

    docentesUsados.add(asig.candidato.docenteId);
    vacantesUsadas.add(infoVac.doc.id);
    propuestaPasada1PorOrigenDoc.set(asig.candidato.docenteId, prop);
    propuestasCreadas.push(prop);
  }

  // Pasada 2: Cadenas sobre NN-Rebote (cubriendo en cadena o aprovechando vacante real libre en ese RBD)
  for (const asig2 of optimo.asignacionesPasada2Rebotes) {
    if (docentesUsados.has(asig2.candidato.docenteId)) continue;
    const infoCand2 = candidatosPorId.get(asig2.candidato.docenteId);
    if (!infoCand2) continue;

    const origenDocId = asig2.vacante.vacanteId.replace(/^rebote_auto_/, '');
    const propOrigen = propuestaPasada1PorOrigenDoc.get(origenDocId);

    const vacRealDisponible = vacantesAbiertas.find(v => {
      if (vacantesUsadas.has(v.id)) return false;
      if (v.rbd !== asig2.vacante.rbdDestino) return false;
      const vacMeta = vacantesObjMap.get(v.id);
      if (!vacMeta) return false;
      const ev = evaluarCalceDocenteVacante({
        ...asig2.candidato,
        ...vacMeta.obj
      });
      return !ev.bloqueaConsolidacion && ev.indiceCompatibilidad >= 55;
    });

    if (vacRealDisponible) {
      const vacMeta = vacantesObjMap.get(vacRealDisponible.id)!;
      const prop2 = await agregarPropuestaCalce(
        {
          escenarioId,
          periodo,
          docenteOrigenId: asig2.candidato.docenteId,
          vacanteDestinoId: vacRealDisponible.id,
          solicitudMovilidadId: infoCand2.solicitud.id,
          egresoOrigenId: vacRealDisponible.origenEgresoId,
          tipoCobertura:
            asig2.candidato.calidadJuridica === 'TITULAR' && !vacMeta.obj.esVacanteCondicional
              ? 'DEFINITIVA'
              : 'TRANSITORIA_CONDICIONAL',
          esTrasladoCompleto: asig2.candidato.esTrasladoCompleto
        },
        rolActor
      );
      docentesUsados.add(asig2.candidato.docenteId);
      vacantesUsadas.add(vacRealDisponible.id);
      propuestasCreadas.push(prop2);

      if (propOrigen && propOrigen.generaRebote) {
        await resolverRebotePropuestaCalce({
          propuestaId: propOrigen.id,
          estadoResolucion: 'CUBIERTA_EN_CADENA',
          reboteCubiertoPorPropuestaId: prop2.id,
          rolActor
        });
      }
    } else if (propOrigen && propOrigen.generaRebote && propOrigen.vacanteRebote) {
      const prop2 = await agregarPropuestaCalce(
        {
          escenarioId,
          periodo,
          docenteOrigenId: asig2.candidato.docenteId,
          cubreRebotePropuestaId: propOrigen.id,
          solicitudMovilidadId: infoCand2.solicitud.id,
          tipoCobertura:
            asig2.candidato.calidadJuridica === 'TITULAR'
              ? 'DEFINITIVA'
              : 'TRANSITORIA_CONDICIONAL',
          esTrasladoCompleto: asig2.candidato.esTrasladoCompleto
        },
        rolActor
      );
      docentesUsados.add(asig2.candidato.docenteId);
      propuestasCreadas.push(prop2);
    }
  }

  return propuestasCreadas;
}

function ordenarPropuestasTopologicamente(propuestas: PropuestaCalce[]): PropuestaCalce[] {
  const cubiertasPorIds = new Set(
    propuestas
      .map(p => p.reboteCubiertoPorPropuestaId)
      .filter((id): id is string => Boolean(id))
  );
  return [...propuestas].sort((a, b) => {
    const aEsDependiente = cubiertasPorIds.has(a.id) ? 1 : 0;
    const bEsDependiente = cubiertasPorIds.has(b.id) ? 1 : 0;
    if (aEsDependiente !== bEsDependiente) return aEsDependiente - bEsDependiente;

    const aCubreAlgo = a.reboteCubiertoPorPropuestaId ? 0 : 1;
    const bCubreAlgo = b.reboteCubiertoPorPropuestaId ? 0 : 1;
    if (aCubreAlgo !== bCubreAlgo) return aCubreAlgo - bCubreAlgo;

    return (a.createdAt || '').localeCompare(b.createdAt || '') || a.id.localeCompare(b.id);
  });
}

export async function consolidarEscenarioAprobado(params: {
  escenarioId: string;
  rolActor: RolId;
  usuarioActor: string;
  expectedVersion?: number;
}): Promise<{
  propuestasConsolidadas: number;
  vacantesReemplazadas: number;
  rebotesCreados: number;
  rbdsAfectados: string[];
  nuevaVersion: number;
  modoEjecucion: 'SUPABASE_RPC' | 'SQLITE_LOCAL';
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
  if (escenario.estado === 'CONSOLIDADO' || escenario.estado === 'RESOLUCION_EMITIDA') {
    throw new Error(`El escenario '${escenario.nombre}' ya fue consolidado o emitido (${escenario.estado}).`);
  }

  const versionActual = escenario.version ?? 1;
  if (params.expectedVersion !== undefined && versionActual !== params.expectedVersion) {
    throw construirErrorConflictoVersion(params.expectedVersion, versionActual);
  }

  const propRes = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ? ORDER BY created_at ASC;`,
    [params.escenarioId]
  );
  const propuestas: PropuestaCalce[] = propRes.length
    ? propRes[0].values.map(mapRowToPropuesta)
    : [];

  if (propuestas.length === 0) {
    throw new Error('El escenario no contiene propuestas de calce para consolidar.');
  }

  const bloqueadas = propuestas.filter(p => p.bloqueaConsolidacion);
  if (bloqueadas.length > 0) {
    const motivos = bloqueadas
      .map(b => b.motivoBloqueo || `${b.nombreDocente} -> ${b.rbdDestino}`)
      .join(' | ');
    throw new Error(`Consolidación bloqueada por incumplimientos normativos: ${motivos}`);
  }

  // Validación 4: Unicidad de vacanteDestinoId, no duplicidad de docente en traslado completo
  const vacantesVistas = new Set<string>();
  const propuestasPorId = new Map<string, PropuestaCalce>(propuestas.map(p => [p.id, p]));
  for (const p of propuestas) {
    if (p.vacanteDestinoId) {
      if (vacantesVistas.has(p.vacanteDestinoId)) {
        throw new Error(
          `Inconsistencia de calce: la vacante destino '${p.vacanteDestinoId}' está repetida en el escenario.`
        );
      }
      vacantesVistas.add(p.vacanteDestinoId);
    } else {
      const cubreAlgunRebote = propuestas.some(
        prev => prev.generaRebote && prev.reboteCubiertoPorPropuestaId === p.id
      );
      if (!cubreAlgunRebote) {
        throw new Error(`La propuesta '${p.id}' no posee vacanteDestinoId.`);
      }
    }
  }

  // Validación 6: Cierre explícito de NN-Rebote
  const rebotesPendientes = propuestas.filter(
    p =>
      p.generaRebote &&
      p.estadoResolucionRebote !== 'CUBIERTA_EN_CADENA' &&
      p.estadoResolucionRebote !== 'DERIVADA_A_CONCURSO_GDP'
  );
  if (rebotesPendientes.length > 0) {
    throw new Error(
      `Consolidación bloqueada: existen ${rebotesPendientes.length} vacante(s) de NN-Rebote en estado PENDIENTE de resolución.`
    );
  }
  for (const p of propuestas) {
    if (
      p.generaRebote &&
      p.estadoResolucionRebote === 'CUBIERTA_EN_CADENA' &&
      p.reboteCubiertoPorPropuestaId &&
      !propuestasPorId.has(p.reboteCubiertoPorPropuestaId)
    ) {
      throw new Error(
        `La propuesta de cobertura en cadena '${p.reboteCubiertoPorPropuestaId}' no pertenece a este escenario.`
      );
    }
  }

  // Validación 5: Máquina de estados sobre solicitudes_movilidad referenciadas
  const solicitudIdsUnicos = Array.from(
    new Set(propuestas.map(p => p.solicitudMovilidadId).filter(Boolean) as string[])
  );
  const solicitudesMap = new Map<string, SolicitudMovilidad>();
  for (const solId of solicitudIdsUnicos) {
    const solRes = db.exec(`SELECT ${SOLICITUD_SELECT_COLS} FROM solicitudes_movilidad WHERE id = ? LIMIT 1;`, [
      solId
    ]);
    if (!solRes.length || !solRes[0].values.length) {
      throw new Error(`Solicitud de movilidad '${solId}' vinculada al escenario no encontrada.`);
    }
    const sol = mapRowToSolicitud(solRes[0].values[0]);
    solicitudesMap.set(sol.id, sol);

    if (
      sol.estadoFlujo === 'RECHAZADO' ||
      sol.estadoFlujo === 'CONSOLIDADO' ||
      sol.estadoFlujo === 'RESOLUCION_EMITIDA'
    ) {
      throw new Error(
        `La solicitud '${sol.id}' posee un estado incompatible para consolidar (${sol.estadoFlujo}).`
      );
    }
    if (sol.carril === 'TRASLADO_VOLUNTARIO' && sol.estadoFlujo !== 'ACEPTADO_CON_FIRMA') {
      throw new Error(
        `La solicitud '${sol.id}' (TRASLADO_VOLUNTARIO) requiere estado ACEPTADO_CON_FIRMA para consolidar (estado actual: ${sol.estadoFlujo}).`
      );
    }
    if (
      (sol.carril === 'NO_CONTINUIDAD_TITULAR' ||
        sol.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO') &&
      sol.estadoFlujo !== 'NOTIFICADO_DIRECCION_ORIGEN' &&
      sol.estadoFlujo !== 'ACEPTADO_CON_FIRMA'
    ) {
      throw new Error(
        `La solicitud '${sol.id}' (${sol.carril}) requiere estado NOTIFICADO_DIRECCION_ORIGEN o ACEPTADO_CON_FIRMA para consolidar (estado actual: ${sol.estadoFlujo}).`
      );
    }
  }

  const periodo = escenario.periodo || 2027;
  const [allDocs, allAsistentes] = await Promise.all([
    listarTodosLosDocentesTerritorio(periodo),
    listarTodosLosAsistentesTerritorio(periodo)
  ]);
  const docMap = new Map<string, Docente>(allDocs.map(d => [d.id, d]));
  const astMap = new Map<string, AsistenteEducacion>(allAsistentes.map(a => [a.id, a]));

  // Validación 4B: No duplicidad de origen en traslado completo + Verificación acumulativa por RUN
  const origenIdsEnEscenario = new Set<string>();
  const origenIdsTrasladadosCompleto = new Set<string>();
  const propsPorOrigenId = new Map<string, PropuestaCalce[]>();

  for (const p of propuestas) {
    origenIdsEnEscenario.add(p.docenteOrigenId);
    const list = propsPorOrigenId.get(p.docenteOrigenId) || [];
    list.push(p);
    propsPorOrigenId.set(p.docenteOrigenId, list);

    const sol = p.solicitudMovilidadId ? solicitudesMap.get(p.solicitudMovilidadId) : undefined;
    if (p.generaRebote || (sol && sol.carril !== 'HORAS_REMANENTES')) {
      origenIdsTrasladadosCompleto.add(p.docenteOrigenId);
    }
  }

  for (const [origId, list] of propsPorOrigenId.entries()) {
    if (list.length > 1 && origenIdsTrasladadosCompleto.has(origId)) {
      throw new Error(
        `Inconsistencia de calce: el funcionario origen '${origId}' figura repetido en traslado completo.`
      );
    }
  }

  const propsPorRunKey = new Map<string, PropuestaCalce[]>();
  for (const p of propuestas) {
    const kRun = claveRunNormalizado(p.runDocente) || `id:${p.docenteOrigenId}`;
    const list = propsPorRunKey.get(kRun) || [];
    list.push(p);
    propsPorRunKey.set(kRun, list);
  }

  for (const [kRun, propsDelRun] of propsPorRunKey.entries()) {
    const runNorm = kRun.startsWith('id:') ? '' : kRun;
    const minAsignadosEscenario = propsDelRun.reduce(
      (s, p) => s + Math.round(Number(p.horasAsignadas || 0) * 60),
      0
    );

    const origIdsRun = Array.from(new Set(propsDelRun.map(p => p.docenteOrigenId)));
    let minConservadosOrigen = 0;
    let maxHorasAst = 0;
    let todosAsistentesRun = true;

    for (const origId of origIdsRun) {
      const esAst = propsDelRun.some(
        p => p.docenteOrigenId === origId && p.estamentoPersonal === 'ASISTENTE'
      );
      if (!esAst) todosAsistentesRun = false;
      const origHoras = esAst
        ? Number(astMap.get(origId)?.horasContrato || 0)
        : Number(docMap.get(origId)?.horasContrato || 0);
      if (esAst && origHoras > maxHorasAst) maxHorasAst = origHoras;

      if (!origenIdsTrasladadosCompleto.has(origId)) {
        minConservadosOrigen += Math.round(origHoras * 60);
      }
    }

    let minOtrosContratos = 0;
    if (runNorm) {
      for (const d of allDocs) {
        if (d.esVacanteNn || d.vacanteCondicional || !esSituacionFinalActiva(d.situacionFinalGdp)) {
          continue;
        }
        if (vacantesVistas.has(d.id) || origenIdsEnEscenario.has(d.id)) continue;
        if (claveRunNormalizado(d.run) === runNorm) {
          todosAsistentesRun = false;
          minOtrosContratos += Math.round(Number(d.horasContrato || 0) * 60);
        }
      }
      for (const a of allAsistentes) {
        if (a.activo === false || !esSituacionFinalActiva(a.situacionFinalGdp)) continue;
        if (vacantesVistas.has(a.id) || origenIdsEnEscenario.has(a.id)) continue;
        if (claveRunNormalizado(a.run) === runNorm) {
          const hrs = Number(a.horasContrato || 0);
          if (hrs > maxHorasAst) maxHorasAst = hrs;
          minOtrosContratos += Math.round(hrs * 60);
        }
      }
    }

    const topeMinutos = todosAsistentesRun && maxHorasAst === 45 ? 2700 : 2640;
    const totalMinutosRun = minAsignadosEscenario + minConservadosOrigen + minOtrosContratos;
    if (totalMinutosRun > topeMinutos) {
      throw new Error(
        `Consolidación bloqueada por tope horario (${topeMinutos} min): '${propsDelRun[0].nombreDocente}' acumularía ${totalMinutosRun} min semanales.`
      );
    }
  }

  // Verificar existencia de origen/destino antes de RPC o SQLite
  for (const p of propuestas) {
    if (p.estamentoPersonal === 'ASISTENTE') {
      if (!astMap.has(p.docenteOrigenId)) {
        throw new Error(`Asistente de origen '${p.docenteOrigenId}' no existe en la base de datos.`);
      }
    } else {
      if (!docMap.has(p.docenteOrigenId)) {
        throw new Error(`Docente de origen '${p.docenteOrigenId}' no existe en la base de datos.`);
      }
      if (p.vacanteDestinoId && !docMap.has(p.vacanteDestinoId)) {
        throw new Error(`Vacante de destino '${p.vacanteDestinoId}' no existe en la base de datos.`);
      }
    }
  }

  let modoEjecucion: 'SUPABASE_RPC' | 'SQLITE_LOCAL' = 'SQLITE_LOCAL';
  let rpcNuevaVersion: number | undefined;

  if (isSupabaseEnabled()) {
    const { data: rpcData, error: rpcError } = await supabase.rpc(
      'consolidar_escenario_movilidad_rpc',
      {
        p_escenario_id: params.escenarioId,
        p_expected_version: versionActual,
        p_usuario_actor: params.usuarioActor
      }
    );

    if (rpcError) {
      if (esErrorFuncionNoEncontradaSupabase(rpcError)) {
        throw new Error(
          'La función consolidar_escenario_movilidad_rpc no está desplegada en Supabase. Aplique la migración 20261120140000_movilidad_hardening_fases123.sql antes de consolidar.'
        );
      }
      const msg = String((rpcError as any).message || 'Error ejecutando consolidación RPC.');
      if (String((rpcError as any).code || '') === '40001' || /CONFLICTO_VERSION/i.test(msg)) {
        throw new Error(msg.includes('CONFLICTO_VERSION') ? msg : `CONFLICTO_VERSION: ${msg}`);
      }
      throw new Error(msg);
    } else {
      modoEjecucion = 'SUPABASE_RPC';
      if (rpcData && typeof (rpcData as any).nuevaVersion === 'number') {
        rpcNuevaVersion = (rpcData as any).nuevaVersion;
      }
    }
  }

  const nowIso = new Date().toISOString();
  const nuevaVersion = rpcNuevaVersion ?? versionActual + 1;
  const propuestasOrdenadas = ordenarPropuestasTopologicamente(propuestas);

  // Captura previa para snapshot de reversión controlada
  const docSnapshotIds = new Set<string>();
  const astSnapshotIds = new Set<string>();
  const docOrigIdsParaAsig = new Set<string>();
  for (const p of propuestasOrdenadas) {
    if (p.estamentoPersonal === 'ASISTENTE') {
      astSnapshotIds.add(p.docenteOrigenId);
      if (p.vacanteDestinoId) {
        if (astMap.has(p.vacanteDestinoId)) astSnapshotIds.add(p.vacanteDestinoId);
        else if (docMap.has(p.vacanteDestinoId)) docSnapshotIds.add(p.vacanteDestinoId);
      }
    } else {
      docSnapshotIds.add(p.docenteOrigenId);
      docOrigIdsParaAsig.add(p.docenteOrigenId);
      if (p.vacanteDestinoId && docMap.has(p.vacanteDestinoId)) {
        docSnapshotIds.add(p.vacanteDestinoId);
      }
    }
  }

  const docentesPreviosRows: Array<{ columns: string[]; values: any[] }> = [];
  for (const dId of docSnapshotIds) {
    const r = db.exec('SELECT * FROM docentes WHERE id = ? LIMIT 1;', [dId]);
    if (r.length && r[0].values.length) {
      docentesPreviosRows.push({ columns: r[0].columns, values: r[0].values[0] });
    }
  }

  const asistentesPreviosRows: Array<{ columns: string[]; values: any[] }> = [];
  for (const aId of astSnapshotIds) {
    const r = db.exec('SELECT * FROM asistentes_educacion WHERE id = ? LIMIT 1;', [aId]);
    if (r.length && r[0].values.length) {
      asistentesPreviosRows.push({ columns: r[0].columns, values: r[0].values[0] });
    }
  }

  const asignacionesPrevias: Array<{ id: string; docenteId: string; coDocenteId: string | null }> = [];
  if (docOrigIdsParaAsig.size > 0) {
    const idsArr = Array.from(docOrigIdsParaAsig);
    const ph = idsArr.map(() => '?').join(',');
    const asigRes = db.exec(
      `SELECT id, docente_id, co_docente_id FROM asignaciones_horarias
       WHERE (docente_id IN (${ph}) OR co_docente_id IN (${ph}))
         AND (periodo = ? OR (periodo IS NULL AND ? = 2027));`,
      [...idsArr, ...idsArr, periodo, periodo]
    );
    if (asigRes.length && asigRes[0].values.length) {
      for (const row of asigRes[0].values) {
        asignacionesPrevias.push({
          id: String(row[0]),
          docenteId: String(row[1]),
          coDocenteId: row[2] !== null && row[2] !== undefined ? String(row[2]) : null
        });
      }
    }
  }

  const solicitudesPrevias = Array.from(solicitudesMap.values()).map(s => ({
    id: s.id,
    estadoFlujo: s.estadoFlujo
  }));
  const reboteDocenteIds: string[] = [];
  const reboteAsistenteIds: string[] = [];

  let propuestasConsolidadas = 0;
  let vacantesReemplazadas = 0;
  let rebotesCreados = 0;
  const rbdsAfectadosSet = new Set<string>();
  const docentesActualizadosSyncMap = new Map<string, Docente>();
  const docentesEliminadosIds: string[] = [];
  const asistentesActualizadosSyncMap = new Map<string, AsistenteEducacion>();
  const asistentesEliminadosIds: string[] = [];
  const solicitudesConsolidadasIds: string[] = [];
  const reboteIdByPropuesta = new Map<string, string>();

  db.run('BEGIN TRANSACTION;');
  try {
    for (const p of propuestasOrdenadas) {
      if (p.estamentoPersonal === 'ASISTENTE') {
        const astOrigen = astMap.get(p.docenteOrigenId)!;

        const sumIndefAst =
          Number(astOrigen.horasSubvencionGeneralIndefinido || 0) +
          Number(astOrigen.horasSepIndefinido || 0) +
          Number(astOrigen.horasPieIndefinido || 0);
        const horasIndefOrigen =
          (p.minutosTitularesOrigen ?? 0) > 0 || (p.minutosContrataOrigen ?? 0) > 0
            ? Math.round((p.minutosTitularesOrigen ?? 0) / 60)
            : sumIndefAst;

        const astDest = p.vacanteDestinoId ? astMap.get(p.vacanteDestinoId) : undefined;
        const docDestSiEsDoc =
          !astDest && p.vacanteDestinoId ? docMap.get(p.vacanteDestinoId) : undefined;

        const horasDestino = astDest
          ? Number(astDest.horasContrato || p.horasAsignadas || astOrigen.horasContrato)
          : docDestSiEsDoc
            ? Number(docDestSiEsDoc.horasContrato || p.horasAsignadas || astOrigen.horasContrato)
            : Number(p.horasAsignadas || astOrigen.horasContrato);

        const fuDestino = p.fuenteDestino || 'SUBVENCION_GENERAL';
        const horasIndefDestino = Math.min(horasDestino, horasIndefOrigen);
        const horasPfDestino = Math.max(0, horasDestino - horasIndefDestino);

        const subvIndef = fuDestino === 'SUBVENCION_GENERAL' ? horasIndefDestino : 0;
        const subvPf = fuDestino === 'SUBVENCION_GENERAL' ? horasPfDestino : 0;
        const sepIndef = fuDestino === 'SEP' ? horasIndefDestino : 0;
        const sepPf = fuDestino === 'SEP' ? horasPfDestino : 0;
        const pieIndef = fuDestino === 'PIE' ? horasIndefDestino : 0;
        const piePf = fuDestino === 'PIE' ? horasPfDestino : 0;

        let targetAstId = astDest?.id || p.vacanteDestinoId;
        if (astDest) {
          db.run(
            `UPDATE asistentes_educacion
             SET run = ?, nombres = ?, apellidos = ?,
                 cargo_funcion = ?, estamento = ?, horas_contrato = ?,
                 horas_subvencion_general_indefinido = ?, horas_subvencion_general_plazo_fijo = ?,
                 horas_sep_indefinido = ?, horas_sep_plazo_fijo = ?,
                 horas_pie_indefinido = ?, horas_pie_plazo_fijo = ?,
                 horas_honorarios = 0, activo = 1, situacion_final_gdp = 'Vigente',
                 es_vacante_nn = 0, tipo_vacante = NULL, justificacion_vacante = NULL,
                 estado_necesidad = NULL, motivo_estado_necesidad = NULL
             WHERE id = ?;`,
            [
              astOrigen.run,
              astOrigen.nombres,
              astOrigen.apellidos,
              astDest.cargoFuncion || astOrigen.cargoFuncion,
              astDest.estamento || astOrigen.estamento,
              horasDestino,
              subvIndef,
              subvPf,
              sepIndef,
              sepPf,
              pieIndef,
              piePf,
              astDest.id
            ]
          );
          asistentesActualizadosSyncMap.set(astDest.id, {
            ...astDest,
            run: astOrigen.run,
            nombres: astOrigen.nombres,
            apellidos: astOrigen.apellidos,
            horasContrato: horasDestino,
            horasSubvencionGeneralIndefinido: subvIndef,
            horasSubvencionGeneralPlazoFijo: subvPf,
            horasSepIndefinido: sepIndef,
            horasSepPlazoFijo: sepPf,
            horasPieIndefinido: pieIndef,
            horasPiePlazoFijo: piePf,
            horasHonorarios: 0,
            activo: true,
            situacionFinalGdp: 'Vigente',
            esVacanteNn: false,
            tipoVacante: undefined,
            justificacionVacante: undefined,
            estadoNecesidad: undefined,
            motivoEstadoNecesidad: undefined
          });
        } else {
          if (docDestSiEsDoc) {
            db.run('DELETE FROM docentes WHERE id = ?;', [docDestSiEsDoc.id]);
            docentesEliminadosIds.push(docDestSiEsDoc.id);
          }
          if (!targetAstId) {
            targetAstId = `ast_${p.rbdDestino}_${periodo}_${limpiarRutParaId(astOrigen.run)}`;
          }
          const nuevoAst: AsistenteEducacion = {
            ...astOrigen,
            id: targetAstId,
            rbd: p.rbdDestino,
            periodo,
            horasContrato: horasDestino,
            horasSubvencionGeneralIndefinido: subvIndef,
            horasSubvencionGeneralPlazoFijo: subvPf,
            horasSepIndefinido: sepIndef,
            horasSepPlazoFijo: sepPf,
            horasPieIndefinido: pieIndef,
            horasPiePlazoFijo: piePf,
            horasHonorarios: 0,
            activo: true,
            propuestaGdp: 'Continuidad',
            estadoSancionGdp: 'Aprobado',
            situacionFinalGdp: 'Vigente'
          };
          db.run(
            `INSERT OR REPLACE INTO asistentes_educacion (
              id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento, horas_contrato,
              horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
              horas_sep_indefinido, horas_sep_plazo_fijo,
              horas_pie_indefinido, horas_pie_plazo_fijo,
              horas_honorarios, es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo,
              es_auxiliar_servicio, es_inspector_patio, observaciones, activo,
              propuesta_gdp, estado_sancion_gdp, situacion_final_gdp
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, 1, 'Continuidad', 'Aprobado', 'Vigente');`,
            [
              nuevoAst.id,
              nuevoAst.rbd,
              nuevoAst.periodo,
              nuevoAst.run,
              nuevoAst.nombres,
              nuevoAst.apellidos,
              nuevoAst.cargoFuncion,
              nuevoAst.estamento,
              nuevoAst.horasContrato,
              subvIndef,
              subvPf,
              sepIndef,
              sepPf,
              pieIndef,
              piePf,
              nuevoAst.esDuplaPsicosocial ? 1 : 0,
              nuevoAst.esEquipoPie ? 1 : 0,
              nuevoAst.esTecnicoParvulo ? 1 : 0,
              nuevoAst.esAuxiliarServicio ? 1 : 0,
              nuevoAst.esInspectorPatio ? 1 : 0,
              nuevoAst.observaciones || null
            ]
          );
          asistentesActualizadosSyncMap.set(nuevoAst.id, nuevoAst);
        }

        vacantesReemplazadas++;
        rbdsAfectadosSet.add(p.rbdDestino);

        if (p.generaRebote && p.rbdOrigen !== p.rbdDestino) {
          const reb = p.vacanteRebote;
          const sufijo = `${p.id.slice(-4).toUpperCase()}${rebotesCreados}`;
          const reboteId = `vac_reb_ast_${p.rbdOrigen}_${periodo}_${p.id.slice(-6)}_${rebotesCreados}`;
          const reboteRun = `REB-${p.rbdOrigen}-${sufijo}`;
          const horasRebAst = Math.max(
            1,
            Number(reb?.horasContratoRebote || astOrigen.horasContrato || 1)
          );
          const fReb =
            reb?.fuenteFinanciamiento || normalizarFuenteDestinoAsistente(astOrigen);
          const normAstReb = normalizarFuentesFinanciamientoAsistente(
            horasRebAst,
            0,
            fReb === 'SUBVENCION_GENERAL' ? horasRebAst : 0,
            0,
            fReb === 'SEP' ? horasRebAst : 0,
            0,
            fReb === 'PIE' ? horasRebAst : 0,
            0
          );
          const obsReb = `Vacante de rebote generada por traslado de ${astOrigen.nombres} ${astOrigen.apellidos} hacia RBD ${p.rbdDestino} (Escenario ${escenario.nombre}).`;

          db.run(
            `INSERT OR REPLACE INTO asistentes_educacion (
              id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento, horas_contrato,
              horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
              horas_sep_indefinido, horas_sep_plazo_fijo,
              horas_pie_indefinido, horas_pie_plazo_fijo,
              horas_honorarios, activo, propuesta_gdp, estado_sancion_gdp, situacion_final_gdp, observaciones
            ) VALUES (?, ?, ?, ?, 'VACANTE REBOTE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, 'Vacante por proveer', 'Pendiente', 'Vigente', ?);`,
            [
              reboteId,
              p.rbdOrigen,
              periodo,
              reboteRun,
              (astOrigen.cargoFuncion || 'ASISTENTE').toUpperCase(),
              astOrigen.cargoFuncion,
              astOrigen.estamento,
              horasRebAst,
              normAstReb.subvGenIndefinido,
              normAstReb.subvGenPlazoFijo,
              normAstReb.sepIndefinido,
              normAstReb.sepPlazoFijo,
              normAstReb.pieIndefinido,
              normAstReb.piePlazoFijo,
              obsReb
            ]
          );

          const astRebObj: AsistenteEducacion = {
            id: reboteId,
            rbd: p.rbdOrigen,
            periodo,
            run: reboteRun,
            nombres: 'VACANTE REBOTE',
            apellidos: (astOrigen.cargoFuncion || 'ASISTENTE').toUpperCase(),
            cargoFuncion: astOrigen.cargoFuncion,
            estamento: astOrigen.estamento,
            horasContrato: horasRebAst,
            horasSubvencionGeneralIndefinido: normAstReb.subvGenIndefinido,
            horasSubvencionGeneralPlazoFijo: normAstReb.subvGenPlazoFijo,
            horasSepIndefinido: normAstReb.sepIndefinido,
            horasSepPlazoFijo: normAstReb.sepPlazoFijo,
            horasPieIndefinido: normAstReb.pieIndefinido,
            horasPiePlazoFijo: normAstReb.piePlazoFijo,
            horasHonorarios: 0,
            activo: true,
            propuestaGdp: 'Vacante por proveer',
            estadoSancionGdp: 'Pendiente',
            situacionFinalGdp: 'Vigente',
            observaciones: obsReb
          };
          asistentesActualizadosSyncMap.set(reboteId, astRebObj);
          astMap.set(reboteId, astRebObj);
          reboteIdByPropuesta.set(p.id, reboteId);
          reboteAsistenteIds.push(reboteId);
          rebotesCreados++;
          rbdsAfectadosSet.add(p.rbdOrigen);
        }

        if (targetAstId !== astOrigen.id) {
          if (horasDestino >= Number(astOrigen.horasContrato || 0)) {
            db.run('DELETE FROM asistentes_educacion WHERE id = ?;', [astOrigen.id]);
            asistentesEliminadosIds.push(astOrigen.id);
          } else {
            let rem = horasDestino;
            const dSgPf = Math.min(Number(astOrigen.horasSubvencionGeneralPlazoFijo || 0), rem);
            rem -= dSgPf;
            const dSepPf = Math.min(Number(astOrigen.horasSepPlazoFijo || 0), rem);
            rem -= dSepPf;
            const dPiePf = Math.min(Number(astOrigen.horasPiePlazoFijo || 0), rem);
            rem -= dPiePf;
            const dSgIn = Math.min(Number(astOrigen.horasSubvencionGeneralIndefinido || 0), rem);
            rem -= dSgIn;
            const dSepIn = Math.min(Number(astOrigen.horasSepIndefinido || 0), rem);
            rem -= dSepIn;
            const dPieIn = Math.min(Number(astOrigen.horasPieIndefinido || 0), rem);

            const nContrato = Math.max(0, Number(astOrigen.horasContrato || 0) - horasDestino);
            const nSgPf = Math.max(0, Number(astOrigen.horasSubvencionGeneralPlazoFijo || 0) - dSgPf);
            const nSepPf = Math.max(0, Number(astOrigen.horasSepPlazoFijo || 0) - dSepPf);
            const nPiePf = Math.max(0, Number(astOrigen.horasPiePlazoFijo || 0) - dPiePf);
            const nSgIn = Math.max(0, Number(astOrigen.horasSubvencionGeneralIndefinido || 0) - dSgIn);
            const nSepIn = Math.max(0, Number(astOrigen.horasSepIndefinido || 0) - dSepIn);
            const nPieIn = Math.max(0, Number(astOrigen.horasPieIndefinido || 0) - dPieIn);

            db.run(
              `UPDATE asistentes_educacion
               SET horas_contrato = ?,
                   horas_subvencion_general_plazo_fijo = ?,
                   horas_sep_plazo_fijo = ?,
                   horas_pie_plazo_fijo = ?,
                   horas_subvencion_general_indefinido = ?,
                   horas_sep_indefinido = ?,
                   horas_pie_indefinido = ?
               WHERE id = ?;`,
              [nContrato, nSgPf, nSepPf, nPiePf, nSgIn, nSepIn, nPieIn, astOrigen.id]
            );
            asistentesActualizadosSyncMap.set(astOrigen.id, {
              ...astOrigen,
              horasContrato: nContrato,
              horasSubvencionGeneralPlazoFijo: nSgPf,
              horasSepPlazoFijo: nSepPf,
              horasPiePlazoFijo: nPiePf,
              horasSubvencionGeneralIndefinido: nSgIn,
              horasSepIndefinido: nSepIn,
              horasPieIndefinido: nPieIn
            });
          }
          rbdsAfectadosSet.add(p.rbdOrigen);
        }
      } else {
        // Rama DOCENTE
        let targetVacanteId = p.vacanteDestinoId;
        if (!targetVacanteId) {
          const prevCubre = propuestasOrdenadas.find(
            prev => prev.generaRebote && prev.reboteCubiertoPorPropuestaId === p.id
          );
          if (prevCubre) {
            targetVacanteId = reboteIdByPropuesta.get(prevCubre.id);
          }
        }
        if (!targetVacanteId) {
          throw new Error(`La propuesta '${p.id}' no posee vacanteDestinoId.`);
        }

        const docenteOrigen = docMap.get(p.docenteOrigenId);
        if (!docenteOrigen) {
          throw new Error(`Docente de origen '${p.docenteOrigenId}' no existe en la base de datos.`);
        }
        const vacanteDestino = docMap.get(targetVacanteId);
        if (!vacanteDestino) {
          throw new Error(`Vacante de destino '${targetVacanteId}' no existe en la base de datos.`);
        }

        // Preservar desglose estricto Titular vs Contrata
        const sumTitOrig =
          Number(docenteOrigen.horasSubvencionGeneralTitular || 0) +
          Number(docenteOrigen.horasSepTitular || 0) +
          Number(docenteOrigen.horasPieTitular || 0);
        const sumConOrig =
          Number(docenteOrigen.horasSubvencionGeneralContrata || 0) +
          Number(docenteOrigen.horasSepContrata || 0) +
          Number(docenteOrigen.horasPieContrata || 0);
        const fallbackHorasTit =
          sumTitOrig > 0 || sumConOrig > 0
            ? sumTitOrig
            : docenteOrigen.calidadJuridica === 'TITULAR'
              ? Number(docenteOrigen.horasContrato || 0)
              : 0;
        const horasTitOrigenProp =
          (p.minutosTitularesOrigen ?? 0) > 0 || (p.minutosContrataOrigen ?? 0) > 0
            ? Math.round((p.minutosTitularesOrigen ?? 0) / 60)
            : fallbackHorasTit;

        const horasDestino = Number(vacanteDestino.horasContrato || p.horasAsignadas || 0);
        const calidadDestino: CalidadJuridicaDocente =
          p.tipoCobertura === 'TRANSITORIA_CONDICIONAL' && docenteOrigen.calidadJuridica !== 'TITULAR'
            ? docenteOrigen.calidadJuridica
            : horasTitOrigenProp > 0 || docenteOrigen.calidadJuridica === 'TITULAR'
              ? 'TITULAR'
              : docenteOrigen.calidadJuridica;

        const horasTitDestino =
          calidadDestino === 'TITULAR'
            ? Math.min(horasDestino, horasTitOrigenProp > 0 ? horasTitOrigenProp : horasDestino)
            : 0;
        const horasConDestino = Math.max(0, horasDestino - horasTitDestino);
        const fuDestino = p.fuenteDestino || normalizarFuenteDestino(vacanteDestino);

        const subvTit = fuDestino === 'SUBVENCION_GENERAL' ? horasTitDestino : 0;
        const subvCon = fuDestino === 'SUBVENCION_GENERAL' ? horasConDestino : 0;
        const sepTit = fuDestino === 'SEP' ? horasTitDestino : 0;
        const sepCon = fuDestino === 'SEP' ? horasConDestino : 0;
        const pieTit = fuDestino === 'PIE' ? horasTitDestino : 0;
        const pieCon = fuDestino === 'PIE' ? horasConDestino : 0;

        db.run(
          `UPDATE docentes
           SET run = ?, nombres = ?, apellidos = ?, titulo = ?,
               calidad_juridica = ?, aplica_articulo_69 = ?, requiere_autorizacion_docente = ?,
               tramo_carrera_docente = ?, habilitacion_seremi_rbd = ?, habilitacion_seremi_asignatura = ?,
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
            docenteOrigen.requiereAutorizacionDocente ? 1 : 0,
            docenteOrigen.tramoCarreraDocente || null,
            docenteOrigen.habilitacionSeremiRbd || null,
            docenteOrigen.habilitacionSeremiAsignatura || null,
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
          requiereAutorizacionDocente: docenteOrigen.requiereAutorizacionDocente,
          tramoCarreraDocente: docenteOrigen.tramoCarreraDocente,
          habilitacionSeremiRbd: docenteOrigen.habilitacionSeremiRbd,
          habilitacionSeremiAsignatura: docenteOrigen.habilitacionSeremiAsignatura,
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
        docentesActualizadosSyncMap.set(vacanteReemplazada.id, vacanteReemplazada);
        docMap.set(vacanteReemplazada.id, vacanteReemplazada);
        vacantesReemplazadas++;
        rbdsAfectadosSet.add(p.rbdDestino);

        if (p.generaRebote && p.vacanteRebote && p.rbdOrigen !== p.rbdDestino) {
          const reb = p.vacanteRebote;
          const sufijo = `${p.id.slice(-4).toUpperCase()}${rebotesCreados}`;
          const reboteId = `vac_reb_${p.rbdOrigen}_${periodo}_${p.id.slice(-6)}_${rebotesCreados}`;
          const reboteRun = `REB-${p.rbdOrigen}-${sufijo}`;
          const horasReb = Math.max(
            1,
            Math.min(44, Math.round(Number(reb.horasContratoRebote || docenteOrigen.horasContrato)))
          );
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

          if (horasReb >= docenteOrigen.horasContrato) {
            db.run('DELETE FROM docentes WHERE id = ?;', [docenteOrigen.id]);
            docentesEliminadosIds.push(docenteOrigen.id);
          }

          const reboteDocObj: Docente = {
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
          };
          docentesActualizadosSyncMap.set(reboteId, reboteDocObj);
          docMap.set(reboteId, reboteDocObj);
          reboteIdByPropuesta.set(p.id, reboteId);
          reboteDocenteIds.push(reboteId);
          rebotesCreados++;
          rbdsAfectadosSet.add(p.rbdOrigen);
        }
      }

      db.run("UPDATE propuestas_calce SET estado = 'CONSOLIDADA', updated_at = ? WHERE id = ?;", [
        nowIso,
        p.id
      ]);
      if (p.solicitudMovilidadId) {
        db.run(
          "UPDATE solicitudes_movilidad SET estado_flujo = 'CONSOLIDADO', updated_at = ? WHERE id = ?;",
          [nowIso, p.solicitudMovilidadId]
        );
        solicitudesConsolidadasIds.push(p.solicitudMovilidadId);
      }

      propuestasConsolidadas++;
    }

    db.run(
      `UPDATE escenarios_calce
       SET estado = 'CONSOLIDADO',
           version = ?,
           consolidado_por = ?,
           fecha_consolidacion = ?,
           updated_at = ?
       WHERE id = ?;`,
      [nuevaVersion, params.usuarioActor, nowIso, nowIso, params.escenarioId]
    );

    if (modoEjecucion === 'SUPABASE_RPC') {
      for (const rbd of rbdsAfectadosSet) {
        const audId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        db.run(
          `INSERT INTO auditoria_cambios (id, rbd, periodo, tipo_evento, entidad, entidad_id, descripcion, detalles_json, fecha_hora)
           VALUES (?, ?, ?, 'TRASPASO', 'DOTACION_COMPLETA', ?, ?, ?, ?);`,
          [
            audId,
            rbd,
            periodo,
            params.escenarioId,
            `Consolidación atómica RPC de escenario '${escenario.nombre}' por ${params.usuarioActor}: ${vacantesReemplazadas} vacante(s) cubiertas y ${rebotesCreados} vacante(s) de rebote.`,
            JSON.stringify({
              escenarioId: params.escenarioId,
              usuarioActor: params.usuarioActor,
              rolActor: params.rolActor,
              propuestasConsolidadas,
              vacantesReemplazadas,
              rebotesCreados,
              nuevaVersion
            }),
            nowIso
          ]
        );
      }
    }

    db.run(
      `INSERT OR REPLACE INTO escenarios_consolidacion_snapshots (
        escenario_id, periodo, snapshot_json, created_by, created_at
      ) VALUES (?, ?, ?, ?, ?);`,
      [
        params.escenarioId,
        periodo,
        JSON.stringify({
          docentesPrevios: docentesPreviosRows,
          asistentesPrevios: asistentesPreviosRows,
          asignacionesPrevias,
          solicitudesPrevias,
          reboteDocenteIds,
          reboteAsistenteIds,
          rbdsAfectados: Array.from(rbdsAfectadosSet)
        }),
        params.usuarioActor,
        nowIso
      ]
    );

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  const rbdsAfectados = Array.from(rbdsAfectadosSet);

  if (modoEjecucion === 'SQLITE_LOCAL') {
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
          rebotesCreados,
          nuevaVersion
        }
      });
    }

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'CONSOLIDACION_ESCENARIO',
    entidad: 'ESCENARIO',
    entidadId: params.escenarioId,
    codigoReferencia: escenario.nombre,
    rbdOrigen: rbdsAfectados[0] || 'SLEP',
    usuarioActor: params.usuarioActor,
    rolActor: String(params.rolActor),
    estadoAnterior: escenario.estado,
    estadoNuevo: 'CONSOLIDADO',
    descripcion: `Consolidación atómica del escenario '${escenario.nombre}': ${propuestasConsolidadas} propuesta(s), ${vacantesReemplazadas} vacante(s) cubiertas.`
  });

    if (isSupabaseEnabled()) {
      const docentesSync = Array.from(docentesActualizadosSyncMap.values());
      if (docentesSync.length > 0) {
        void syncSupabaseMovilidad(
          { tabla: 'guardarDocentesBatch', operacion: 'servicio', payload: docentesSync },
          'consolidar_docentes_batch'
        );
      }
      for (const delId of docentesEliminadosIds) {
        void syncSupabaseMovilidad(
          { tabla: 'eliminarDocente', operacion: 'servicio', payload: delId },
          'consolidar_eliminar_docente'
        );
      }
      const asistentesSync = Array.from(asistentesActualizadosSyncMap.values());
      if (asistentesSync.length > 0) {
        void syncSupabaseMovilidad(
          { tabla: 'guardarAsistentesBatch', operacion: 'servicio', payload: asistentesSync },
          'consolidar_asistentes_batch'
        );
      }
      for (const delAstId of asistentesEliminadosIds) {
        void syncSupabaseMovilidad(
          { tabla: 'eliminarAsistente', operacion: 'servicio', payload: delAstId },
          'consolidar_eliminar_asistente'
        );
      }
      void syncSupabaseMovilidad(
        {
          tabla: 'escenarios_calce',
          operacion: 'update',
          payload: {
            estado: 'CONSOLIDADO',
            version: nuevaVersion,
            consolidado_por: params.usuarioActor,
            fecha_consolidacion: nowIso,
            updated_at: nowIso
          },
          match: { id: params.escenarioId }
        },
        'consolidar_escenario_estado'
      );

      void syncSupabaseMovilidad(
        {
          tabla: 'propuestas_calce',
          operacion: 'update',
          payload: { estado: 'CONSOLIDADA', updated_at: nowIso },
          match: { escenario_id: params.escenarioId }
        },
        'consolidar_propuestas_estado'
      );

      if (solicitudesConsolidadasIds.length > 0) {
        void syncSupabaseMovilidad(
          {
            tabla: 'solicitudes_movilidad',
            operacion: 'update',
            payload: { estado_flujo: 'CONSOLIDADO', updated_at: nowIso },
            match: { id: solicitudesConsolidadasIds }
          },
          'consolidar_solicitudes_estado'
        );
      }
    }
  }

  return {
    propuestasConsolidadas,
    vacantesReemplazadas,
    rebotesCreados,
    rbdsAfectados,
    nuevaVersion,
    modoEjecucion
  };
}

interface SnapshotTablaRow {
  columns: string[];
  values: any[];
}

interface SnapshotConsolidacionEscenario {
  docentesPrevios: SnapshotTablaRow[];
  asistentesPrevios: SnapshotTablaRow[];
  asignacionesPrevias: Array<{ id: string; docenteId: string; coDocenteId: string | null }>;
  solicitudesPrevias: Array<{ id: string; estadoFlujo: EstadoFlujoMovilidad }>;
  reboteDocenteIds: string[];
  reboteAsistenteIds: string[];
  rbdsAfectados: string[];
}

export async function revertirEscenarioConsolidado(params: {
  escenarioId: string;
  motivo: string;
  rolActor: RolId;
  usuarioActor: string;
}): Promise<{
  escenarioId: string;
  docentesRestaurados: number;
  asistentesRestaurados: number;
  rebotesEliminados: number;
  solicitudesRestauradas: number;
  nuevaVersion: number;
}> {
  assertRolConsolidador(params.rolActor, 'revertir un escenario consolidado');

  const motivoClean = String(params.motivo || '').trim();
  if (motivoClean.length < 5) {
    throw new Error(
      'Debe ingresar un motivo fundado (mínimo 5 caracteres) para revertir la consolidación.'
    );
  }

  const db = await getDb();
  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    params.escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${params.escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);

  if (escenario.estado !== 'CONSOLIDADO') {
    throw new Error(
      `Solo se pueden revertir escenarios en estado CONSOLIDADO (estado actual: ${escenario.estado}).`
    );
  }

  const snapRes = db.exec(
    'SELECT snapshot_json FROM escenarios_consolidacion_snapshots WHERE escenario_id = ? LIMIT 1;',
    [params.escenarioId]
  );
  if (!snapRes.length || !snapRes[0].values.length || !snapRes[0].values[0][0]) {
    throw new Error('No existe snapshot de respaldo para revertir este escenario.');
  }

  const snapshot = JSON.parse(String(snapRes[0].values[0][0])) as SnapshotConsolidacionEscenario;
  const periodo = escenario.periodo || 2027;
  const nowIso = new Date().toISOString();
  const nuevaVersion = (escenario.version ?? 1) + 1;
  const actor = String(params.usuarioActor || 'Nivel Central').trim() || 'Nivel Central';

  let docentesRestaurados = 0;
  let asistentesRestaurados = 0;
  let rebotesEliminados = 0;
  let solicitudesRestauradas = 0;

  const docentesRestauradosIds: string[] = [];
  const asistentesRestauradosIds: string[] = [];
  const solicitudesRestauradasIdsByEstado = new Map<EstadoFlujoMovilidad, string[]>();

  db.run('BEGIN TRANSACTION;');
  try {
    for (const rebDocId of snapshot.reboteDocenteIds || []) {
      db.run('DELETE FROM docentes WHERE id = ?;', [rebDocId]);
      rebotesEliminados++;
    }
    for (const rebAstId of snapshot.reboteAsistenteIds || []) {
      db.run('DELETE FROM asistentes_educacion WHERE id = ?;', [rebAstId]);
      rebotesEliminados++;
    }

    for (const row of snapshot.docentesPrevios || []) {
      if (!row.columns.length) continue;
      const placeholders = row.columns.map(() => '?').join(', ');
      db.run(
        `INSERT OR REPLACE INTO docentes (${row.columns.join(', ')}) VALUES (${placeholders});`,
        row.values
      );
      const idIdx = row.columns.indexOf('id');
      if (idIdx >= 0 && row.values[idIdx]) {
        docentesRestauradosIds.push(String(row.values[idIdx]));
      }
      docentesRestaurados++;
    }

    for (const row of snapshot.asistentesPrevios || []) {
      if (!row.columns.length) continue;
      const placeholders = row.columns.map(() => '?').join(', ');
      db.run(
        `INSERT OR REPLACE INTO asistentes_educacion (${row.columns.join(', ')}) VALUES (${placeholders});`,
        row.values
      );
      const idIdx = row.columns.indexOf('id');
      if (idIdx >= 0 && row.values[idIdx]) {
        asistentesRestauradosIds.push(String(row.values[idIdx]));
      }
      asistentesRestaurados++;
    }

    for (const asig of snapshot.asignacionesPrevias || []) {
      db.run('UPDATE asignaciones_horarias SET docente_id = ?, co_docente_id = ? WHERE id = ?;', [
        asig.docenteId,
        asig.coDocenteId ?? null,
        asig.id
      ]);
    }

    for (const sol of snapshot.solicitudesPrevias || []) {
      db.run('UPDATE solicitudes_movilidad SET estado_flujo = ?, updated_at = ? WHERE id = ?;', [
        sol.estadoFlujo,
        nowIso,
        sol.id
      ]);
      const list = solicitudesRestauradasIdsByEstado.get(sol.estadoFlujo) || [];
      list.push(sol.id);
      solicitudesRestauradasIdsByEstado.set(sol.estadoFlujo, list);
      solicitudesRestauradas++;
    }

    db.run("UPDATE propuestas_calce SET estado = 'PROPUESTA', updated_at = ? WHERE escenario_id = ?;", [
      nowIso,
      params.escenarioId
    ]);

    db.run(
      `UPDATE escenarios_calce
       SET estado = 'BORRADOR', version = ?, consolidado_por = NULL, fecha_consolidacion = NULL, updated_at = ?
       WHERE id = ?;`,
      [nuevaVersion, nowIso, params.escenarioId]
    );

    db.run('DELETE FROM escenarios_consolidacion_snapshots WHERE escenario_id = ?;', [
      params.escenarioId
    ]);

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  const rbdsAfectados =
    snapshot.rbdsAfectados && snapshot.rbdsAfectados.length > 0 ? snapshot.rbdsAfectados : ['SLEP'];
  for (const rbd of rbdsAfectados) {
    await registrarEventoAuditoria({
      rbd,
      periodo,
      tipoEvento: 'ACTUALIZACION',
      entidad: 'DOTACION_COMPLETA',
      entidadId: params.escenarioId,
      descripcion: `Reversión controlada de consolidación de escenario '${escenario.nombre}' por ${actor}. Motivo: ${motivoClean}`,
      detalles: {
        escenarioId: params.escenarioId,
        motivo: motivoClean,
        usuarioActor: actor,
        rolActor: params.rolActor,
        docentesRestaurados,
        asistentesRestaurados,
        rebotesEliminados,
        solicitudesRestauradas,
        nuevaVersion
      }
    });
  }

  await registrarMovimientoMovilidad({
    periodo,
    tipoMovimiento: 'REVERSION_ESCENARIO',
    entidad: 'ESCENARIO',
    entidadId: params.escenarioId,
    codigoReferencia: escenario.nombre,
    rbdOrigen: rbdsAfectados[0] || 'SLEP',
    usuarioActor: actor,
    rolActor: String(params.rolActor),
    estadoAnterior: escenario.estado,
    estadoNuevo: 'BORRADOR',
    descripcion: `Reversión controlada del escenario '${escenario.nombre}': ${docentesRestaurados} docente(s) restaurados, ${rebotesEliminados} rebote(s) eliminados.`,
    motivo: motivoClean
  });

  if (isSupabaseEnabled()) {
    const [allDocsPost, allAsistentesPost] = await Promise.all([
      docentesRestauradosIds.length > 0 ? listarTodosLosDocentesTerritorio(periodo) : Promise.resolve([]),
      asistentesRestauradosIds.length > 0 ? listarTodosLosAsistentesTerritorio(periodo) : Promise.resolve([])
    ]);

    const docsRestSet = new Set(docentesRestauradosIds);
    const docsSync = allDocsPost.filter(d => docsRestSet.has(d.id));
    if (docsSync.length > 0) {
      void syncSupabaseMovilidad(
        { tabla: 'guardarDocentesBatch', operacion: 'servicio', payload: docsSync },
        'revertir_escenario_docentes'
      );
    }
    for (const rebDocId of snapshot.reboteDocenteIds || []) {
      void syncSupabaseMovilidad(
        { tabla: 'eliminarDocente', operacion: 'servicio', payload: rebDocId },
        'revertir_escenario_eliminar_rebote_docente'
      );
    }

    const astRestSet = new Set(asistentesRestauradosIds);
    const astSync = allAsistentesPost.filter(a => astRestSet.has(a.id));
    if (astSync.length > 0) {
      void syncSupabaseMovilidad(
        { tabla: 'guardarAsistentesBatch', operacion: 'servicio', payload: astSync },
        'revertir_escenario_asistentes'
      );
    }
    for (const rebAstId of snapshot.reboteAsistenteIds || []) {
      void syncSupabaseMovilidad(
        { tabla: 'eliminarAsistente', operacion: 'servicio', payload: rebAstId },
        'revertir_escenario_eliminar_rebote_asistente'
      );
    }

    for (const asig of snapshot.asignacionesPrevias || []) {
      void syncSupabaseMovilidad(
        {
          tabla: 'asignaciones_horarias',
          operacion: 'update',
          payload: { docente_id: asig.docenteId, co_docente_id: asig.coDocenteId ?? null },
          match: { id: asig.id }
        },
        'revertir_escenario_asignacion'
      );
    }

    void syncSupabaseMovilidad(
      {
        tabla: 'escenarios_calce',
        operacion: 'update',
        payload: {
          estado: 'BORRADOR',
          version: nuevaVersion,
          consolidado_por: null,
          fecha_consolidacion: null,
          updated_at: nowIso
        },
        match: { id: params.escenarioId }
      },
      'revertir_escenario_estado'
    );

    void syncSupabaseMovilidad(
      {
        tabla: 'propuestas_calce',
        operacion: 'update',
        payload: { estado: 'PROPUESTA', updated_at: nowIso },
        match: { escenario_id: params.escenarioId }
      },
      'revertir_escenario_propuestas'
    );

    for (const [estadoPrevio, solIds] of solicitudesRestauradasIdsByEstado.entries()) {
      void syncSupabaseMovilidad(
        {
          tabla: 'solicitudes_movilidad',
          operacion: 'update',
          payload: { estado_flujo: estadoPrevio, updated_at: nowIso },
          match: { id: solIds }
        },
        'revertir_escenario_solicitudes'
      );
    }
  }

  return {
    escenarioId: params.escenarioId,
    docentesRestaurados,
    asistentesRestaurados,
    rebotesEliminados,
    solicitudesRestauradas,
    nuevaVersion
  };
}

/**
 * Registra la Resolución Exenta formal sobre un escenario previamente CONSOLIDADO,
 * transicionando el escenario y sus solicitudes vinculadas a 'RESOLUCION_EMITIDA',
 * manteniendo propuestas en 'CONSOLIDADA' con trazabilidad documental e incrementando versión.
 */
export async function registrarResolucionExentaEscenario(params: {
  escenarioId: string;
  numeroResolucion: string;
  fechaResolucion: string;
  fechaVigencia?: string;
  rolActor: RolId;
  usuarioActor?: string;
  expectedVersion?: number;
}): Promise<{
  escenario: EscenarioCalce;
  propuestasActualizadas: number;
  solicitudesActualizadas: number;
}> {
  assertRolValidadorGdp(
    params.rolActor,
    'registrar resolución exenta sobre un escenario consolidado'
  );

  const numResClean = String(params.numeroResolucion || '').trim();
  const fechaResClean = String(params.fechaResolucion || '').trim();
  const fechaVigClean = params.fechaVigencia ? String(params.fechaVigencia).trim() : undefined;

  if (!numResClean) {
    throw new Error('Debe ingresar un número de Resolución Exenta válido.');
  }
  if (!fechaResClean) {
    throw new Error('Debe ingresar la fecha de emisión de la Resolución Exenta.');
  }

  const db = await getDb();
  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    params.escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${params.escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);

  if (escenario.estado !== 'CONSOLIDADO' && escenario.estado !== 'RESOLUCION_EMITIDA') {
    throw new Error(
      `El escenario '${escenario.nombre}' debe estar en estado CONSOLIDADO antes de emitir Resolución Exenta (estado actual: ${escenario.estado}).`
    );
  }

  const versionAnterior = escenario.version ?? 1;
  if (params.expectedVersion !== undefined && versionAnterior !== params.expectedVersion) {
    throw construirErrorConflictoVersion(params.expectedVersion, versionAnterior);
  }

  const propRes = db.exec(
    `SELECT ${PROPUESTA_SELECT_COLS} FROM propuestas_calce WHERE escenario_id = ?;`,
    [params.escenarioId]
  );
  const propuestas = propRes.length ? propRes[0].values.map(mapRowToPropuesta) : [];
  const solicitudIds = Array.from(
    new Set(propuestas.map(p => p.solicitudMovilidadId).filter(Boolean) as string[])
  );

  const nowIso = new Date().toISOString();
  const nuevaVersion = versionAnterior + 1;

  db.run('BEGIN TRANSACTION;');
  try {
    db.run(
      `UPDATE escenarios_calce
       SET estado = 'RESOLUCION_EMITIDA',
           version = ?,
           numero_resolucion = ?,
           fecha_resolucion = ?,
           fecha_vigencia = ?,
           updated_at = ?
       WHERE id = ?;`,
      [
        nuevaVersion,
        numResClean,
        fechaResClean,
        fechaVigClean || null,
        nowIso,
        params.escenarioId
      ]
    );

    db.run(
      `UPDATE propuestas_calce
       SET estado = 'CONSOLIDADA',
           numero_resolucion = ?,
           fecha_resolucion = ?,
           fecha_vigencia = ?,
           updated_at = ?
       WHERE escenario_id = ?;`,
      [numResClean, fechaResClean, fechaVigClean || null, nowIso, params.escenarioId]
    );

    for (const solId of solicitudIds) {
      db.run(
        `UPDATE solicitudes_movilidad
         SET estado_flujo = 'RESOLUCION_EMITIDA',
             numero_resolucion = ?,
             fecha_resolucion = ?,
             fecha_vigencia = ?,
             updated_at = ?
         WHERE id = ?;`,
        [numResClean, fechaResClean, fechaVigClean || null, nowIso, solId]
      );
    }

    db.run('COMMIT;');
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }

  await persistDb(true);

  const rbdsAfectados = Array.from(
    new Set(propuestas.flatMap(p => [p.rbdOrigen, p.rbdDestino]).filter(Boolean))
  );
  const actor = String(params.usuarioActor || 'Validador GDP').trim();

  for (const rbd of rbdsAfectados) {
    await registrarEventoAuditoria({
      rbd,
      periodo: escenario.periodo,
      tipoEvento: 'ACTUALIZACION',
      entidad: 'DOTACION_COMPLETA',
      entidadId: escenario.id,
      descripcion: `Emisión de Resolución Exenta ${numResClean} (${fechaResClean}) para escenario '${escenario.nombre}' por ${actor}.`,
      detalles: {
        escenarioId: escenario.id,
        numeroResolucion: numResClean,
        fechaResolucion: fechaResClean,
        fechaVigencia: fechaVigClean,
        usuarioActor: actor,
        rolActor: params.rolActor,
        nuevaVersion
      }
    });
  }

  const escenarioActualizado: EscenarioCalce = {
    ...escenario,
    estado: 'RESOLUCION_EMITIDA',
    version: nuevaVersion,
    numeroResolucion: numResClean,
    fechaResolucion: fechaResClean,
    fechaVigencia: fechaVigClean,
    updatedAt: nowIso
  };

  if (isSupabaseEnabled()) {
    void syncSupabaseMovilidad(
      {
        tabla: 'escenarios_calce',
        operacion: 'update',
        payload: {
          estado: 'RESOLUCION_EMITIDA',
          version: nuevaVersion,
          numero_resolucion: numResClean,
          fecha_resolucion: fechaResClean,
          fecha_vigencia: fechaVigClean || null,
          updated_at: nowIso
        },
        match: { id: params.escenarioId }
      },
      'resolucion_exenta_escenario'
    );

    void syncSupabaseMovilidad(
      {
        tabla: 'propuestas_calce',
        operacion: 'update',
        payload: {
          estado: 'CONSOLIDADA',
          numero_resolucion: numResClean,
          fecha_resolucion: fechaResClean,
          fecha_vigencia: fechaVigClean || null,
          updated_at: nowIso
        },
        match: { escenario_id: params.escenarioId }
      },
      'resolucion_exenta_propuestas'
    );

    if (solicitudIds.length > 0) {
      void syncSupabaseMovilidad(
        {
          tabla: 'solicitudes_movilidad',
          operacion: 'update',
          payload: {
            estado_flujo: 'RESOLUCION_EMITIDA',
            numero_resolucion: numResClean,
            fecha_resolucion: fechaResClean,
            fecha_vigencia: fechaVigClean || null,
            updated_at: nowIso
          },
          match: { id: solicitudIds }
        },
        'resolucion_exenta_solicitudes'
      );
    }
  }

  return {
    escenario: escenarioActualizado,
    propuestasActualizadas: propuestas.length,
    solicitudesActualizadas: solicitudIds.length
  };
}

/**
 * Genera el libro Excel oficial (.xlsx) de Nómina de Actos Administrativos GDP y Rebotes
 * con dos hojas: 'Actos Destinación y Traslado' y 'Rebotes y Concursos GDP'.
 */
export async function exportarNominaActosAdministrativosGdp(params: {
  escenarioId: string;
  periodo?: number;
  rolActor: RolId;
}): Promise<Uint8Array> {
  assertRolNivelCentral(params.rolActor, 'exportar nómina de actos administrativos GDP');

  const db = await getDb();
  const escRes = db.exec(`SELECT ${ESCENARIO_SELECT_COLS} FROM escenarios_calce WHERE id = ? LIMIT 1;`, [
    params.escenarioId
  ]);
  if (!escRes.length || !escRes[0].values.length) {
    throw new Error(`Escenario '${params.escenarioId}' no encontrado.`);
  }
  const escenario = mapRowToEscenario(escRes[0].values[0]);
  const periodo = params.periodo || escenario.periodo || 2027;

  const [propuestas, establecimientos, solicitudes] = await Promise.all([
    listarPropuestasEscenario(params.escenarioId, params.rolActor),
    listarEstablecimientos(),
    listarSolicitudesMovilidad(periodo, params.rolActor)
  ]);

  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [e.rbd, e]));
  const solMap = new Map<string, SolicitudMovilidad>(solicitudes.map(s => [s.id, s]));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SLEP Valle Diguillín - Mesa de Movilidad';
  workbook.created = new Date();

  const wsActos = workbook.addWorksheet('Actos Destinación y Traslado');
  wsActos.columns = [
    { header: 'N°', key: 'nro', width: 6 },
    { header: 'Escenario', key: 'escenario', width: 28 },
    { header: 'Estado Escenario', key: 'estadoEscenario', width: 20 },
    { header: 'N° Resolución Exenta', key: 'numeroResolucion', width: 22 },
    { header: 'Fecha Resolución', key: 'fechaResolucion', width: 16 },
    { header: 'Fecha Vigencia', key: 'fechaVigencia', width: 16 },
    { header: 'Estamento Personal', key: 'estamento', width: 18 },
    { header: 'RUN Funcionario', key: 'run', width: 15 },
    { header: 'Nombre Funcionario', key: 'nombre', width: 30 },
    { header: 'RBD Origen', key: 'rbdOrigen', width: 12 },
    { header: 'Establecimiento Origen', key: 'estOrigen', width: 32 },
    { header: 'RBD Destino', key: 'rbdDestino', width: 12 },
    { header: 'Establecimiento Destino', key: 'estDestino', width: 32 },
    { header: 'Carril Movilidad', key: 'carril', width: 28 },
    { header: 'Tipo Cobertura', key: 'tipoCobertura', width: 24 },
    { header: 'Horas Asignadas', key: 'horas', width: 16 },
    { header: 'Minutos Asignados', key: 'minutos', width: 18 },
    { header: 'Horas Titular / Indef.', key: 'horasTit', width: 18 },
    { header: 'Horas Contrata / PF', key: 'horasCon', width: 18 },
    { header: 'Fuente Destino', key: 'fuente', width: 22 },
    { header: 'Estado Propuesta', key: 'estadoProp', width: 16 },
    { header: 'Alertas Normativas', key: 'alertas', width: 45 }
  ];

  const headerStyle = (ws: ExcelJS.Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' }
    };
    row.commit();
  };
  headerStyle(wsActos);

  propuestas.forEach((p, idx) => {
    const sol = p.solicitudMovilidadId ? solMap.get(p.solicitudMovilidadId) : undefined;
    const estOrig = estMap.get(p.rbdOrigen);
    const estDest = estMap.get(p.rbdDestino);
    const horasTit = Math.round((p.minutosTitularesOrigen ?? 0) / 60);
    const horasCon = Math.round((p.minutosContrataOrigen ?? 0) / 60);

    wsActos.addRow({
      nro: idx + 1,
      escenario: sanitizeExcelText(escenario.nombre),
      estadoEscenario: escenario.estado,
      numeroResolucion: sanitizeExcelText(p.numeroResolucion || escenario.numeroResolucion || 'PENDIENTE'),
      fechaResolucion: sanitizeExcelText(p.fechaResolucion || escenario.fechaResolucion || ''),
      fechaVigencia: sanitizeExcelText(p.fechaVigencia || escenario.fechaVigencia || ''),
      estamento: p.estamentoPersonal || 'DOCENTE',
      run: sanitizeExcelText(p.runDocente),
      nombre: sanitizeExcelText(p.nombreDocente),
      rbdOrigen: sanitizeExcelText(p.rbdOrigen),
      estOrigen: sanitizeExcelText(estOrig?.nombre || `RBD ${p.rbdOrigen}`),
      rbdDestino: sanitizeExcelText(p.rbdDestino),
      estDestino: sanitizeExcelText(estDest?.nombre || `RBD ${p.rbdDestino}`),
      carril: sanitizeExcelText(sol?.carril || 'MOVILIDAD_DIRECTA'),
      tipoCobertura: p.tipoCobertura,
      horas: p.horasAsignadas,
      minutos: p.minutosAsignados,
      horasTit,
      horasCon,
      fuente: p.fuenteDestino,
      estadoProp: p.estado,
      alertas: sanitizeExcelText((p.alertasNormativas || []).join(' | '))
    });
  });

  const wsRebotes = workbook.addWorksheet('Rebotes y Concursos GDP');
  wsRebotes.columns = [
    { header: 'N°', key: 'nro', width: 6 },
    { header: 'Propuesta Origen ID', key: 'propId', width: 28 },
    { header: 'RBD Origen (Vacante Rebote)', key: 'rbdOrigen', width: 22 },
    { header: 'Establecimiento Origen', key: 'estOrigen', width: 32 },
    { header: 'RUN Funcionario Saliente', key: 'run', width: 16 },
    { header: 'Nombre Funcionario Saliente', key: 'nombre', width: 30 },
    { header: 'Estamento Personal', key: 'estamento', width: 18 },
    { header: 'Asignatura / Cargo Rebote', key: 'asignatura', width: 28 },
    { header: 'Horas Rebote', key: 'horas', width: 14 },
    { header: 'Minutos Rebote', key: 'minutos', width: 16 },
    { header: 'Fuente Financiamiento', key: 'fuente', width: 22 },
    { header: 'Estado Resolución Rebote', key: 'estadoRebote', width: 28 },
    { header: 'Propuesta Cobertura Cadena ID', key: 'cubreId', width: 28 },
    { header: 'N° Resolución Exenta', key: 'numeroResolucion', width: 22 },
    { header: 'Funciones Intransferibles Detectadas', key: 'intransferibles', width: 42 }
  ];
  headerStyle(wsRebotes);

  const propuestasConRebote = propuestas.filter(p => p.generaRebote);
  propuestasConRebote.forEach((p, idx) => {
    const estOrig = estMap.get(p.rbdOrigen);
    const reb = p.vacanteRebote;
    wsRebotes.addRow({
      nro: idx + 1,
      propId: p.id,
      rbdOrigen: sanitizeExcelText(p.rbdOrigen),
      estOrigen: sanitizeExcelText(estOrig?.nombre || `RBD ${p.rbdOrigen}`),
      run: sanitizeExcelText(p.runDocente),
      nombre: sanitizeExcelText(p.nombreDocente),
      estamento: p.estamentoPersonal || 'DOCENTE',
      asignatura: sanitizeExcelText(reb?.asignaturaPrincipal || ''),
      horas: reb?.horasContratoRebote ?? p.horasAsignadas,
      minutos: reb?.minutosContratoRebote ?? p.minutosAsignados,
      fuente: reb?.fuenteFinanciamiento || p.fuenteDestino,
      estadoRebote: p.estadoResolucionRebote || 'PENDIENTE',
      cubreId: sanitizeExcelText(p.reboteCubiertoPorPropuestaId || ''),
      numeroResolucion: sanitizeExcelText(p.numeroResolucion || escenario.numeroResolucion || 'PENDIENTE'),
      intransferibles: sanitizeExcelText((reb?.funcionesIntransferiblesDetectadas || []).join(' | '))
    });
  });

  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(outBuffer);
}
