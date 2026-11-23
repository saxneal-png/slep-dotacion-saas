import {
  AsistenteEducacion,
  DesgloseFuentesSolicitud,
  Docente,
  Establecimiento,
  EstadoRevisionSolicitudDotacion,
  SolicitudMovimientoDotacion,
  TipoMovimientoDotacion,
  TipoMovimientoMovilidad
} from '../types';
import {
  getDb,
  guardarAsistente,
  guardarDocente,
  listarAsistentes,
  listarDocentes,
  persistDb
} from '../database/db';
import { isSupabaseEnabled, supabase } from './supabaseClient';
import { esRolValidadorGdp, guardarSolicitudMovilidad } from './movilidadTerritorialService';

function generarIdSolicitudDotacion(): string {
  return `smd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseJsonSafe<T>(raw: unknown): T | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'object') return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return undefined;
  }
}

function mapRowToSolicitud(row: any[]): SolicitudMovimientoDotacion {
  return {
    id: String(row[0]),
    periodo: Number(row[1]) || 2027,
    rbd: String(row[2]),
    nombreEstablecimiento: row[3] ? String(row[3]) : undefined,
    comuna: row[4] ? String(row[4]) : undefined,
    entidadTipo: (row[5] as 'DOCENTE' | 'ASISTENTE') || 'DOCENTE',
    funcionarioId: String(row[6]),
    runFuncionario: String(row[7]),
    nombreFuncionario: String(row[8]),
    calidadJuridica: row[9] ? String(row[9]) : undefined,
    cargoOAsignatura: row[10] ? String(row[10]) : undefined,
    tipoMovimiento: row[11] as TipoMovimientoDotacion,
    propuestaGdpOrigen: row[12] ? String(row[12]) : undefined,
    horasVigentes: Number(row[13]) || 0,
    horasSolicitadas: Number(row[14]) || 0,
    deltaHoras: Number(row[15]) || 0,
    aplicaArticulo69Previo: Boolean(row[16]),
    aplicaArticulo69Solicitado: Boolean(row[17]),
    fuentesActuales: parseJsonSafe<DesgloseFuentesSolicitud>(row[18]),
    fuentesSolicitadas: parseJsonSafe<DesgloseFuentesSolicitud>(row[19]),
    remuneracionMensualEstimada: Number(row[20]) || 0,
    accionPme: row[21] ? String(row[21]) : undefined,
    justificacionEscuela: String(row[22] || ''),
    estadoRevision: (row[23] as EstadoRevisionSolicitudDotacion) || 'PENDIENTE',
    horasAprobadas: row[24] !== null && row[24] !== undefined ? Number(row[24]) : undefined,
    visadoUatpPor: row[25] ? String(row[25]) : undefined,
    fechaVisacionUatp: row[26] ? String(row[26]) : undefined,
    observacionUatp: row[27] ? String(row[27]) : undefined,
    sancionadoGdpPor: row[28] ? String(row[28]) : undefined,
    rolSancionador: row[29] ? String(row[29]) : undefined,
    fechaSancionGdp: row[30] ? String(row[30]) : undefined,
    observacionSancion: row[31] ? String(row[31]) : undefined,
    aplicadoANomina: Boolean(row[32]),
    solicitudMovilidadId: row[33] ? String(row[33]) : undefined,
    creadoPor: row[34] ? String(row[34]) : undefined,
    createdAt: row[35] ? String(row[35]) : undefined,
    updatedAt: row[36] ? String(row[36]) : undefined
  };
}

const SOLICITUD_COLS = `
  id, periodo, rbd, nombre_establecimiento, comuna, entidad_tipo,
  funcionario_id, run_funcionario, nombre_funcionario, calidad_juridica, cargo_o_asignatura,
  tipo_movimiento, propuesta_gdp_origen, horas_vigentes, horas_solicitadas, delta_horas,
  aplica_articulo_69_previo, aplica_articulo_69_solicitado,
  fuentes_actuales_json, fuentes_solicitadas_json,
  remuneracion_mensual_estimada, accion_pme, justificacion_escuela,
  estado_revision, horas_aprobadas, visado_uatp_por, fecha_visacion_uatp, observacion_uatp,
  sancionado_gdp_por, rol_sancionador, fecha_sancion_gdp, observacion_sancion,
  aplicado_a_nomina, solicitud_movilidad_id, creado_por, created_at, updated_at
`;

async function registrarBitacoraDotacion(params: {
  periodo: number;
  tipoMovimiento: TipoMovimientoMovilidad;
  entidadId: string;
  rbdOrigen: string;
  nombreEstablecimiento?: string;
  comuna?: string;
  usuarioActor: string;
  rolActor?: string;
  estadoAnterior?: string;
  estadoNuevo?: string;
  descripcion: string;
  motivo?: string;
  detalles?: Record<string, any>;
}): Promise<void> {
  try {
    const db = await getDb();
    const id = `mov_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fechaHora = new Date().toISOString();
    db.run(
      `INSERT INTO movilidad_registro_movimientos (
        id, periodo, tipo_movimiento, entidad, entidad_id, codigo_referencia,
        rbd_origen, nombre_establecimiento, comuna, rbd_destino,
        usuario_actor, rol_actor, estado_anterior, estado_nuevo,
        descripcion, motivo, detalles_json, fecha_hora
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        params.periodo,
        params.tipoMovimiento,
        'SOLICITUD_DOTACION',
        params.entidadId,
        params.entidadId,
        params.rbdOrigen,
        params.nombreEstablecimiento || null,
        params.comuna || null,
        null,
        params.usuarioActor,
        params.rolActor || null,
        params.estadoAnterior || null,
        params.estadoNuevo || null,
        params.descripcion,
        params.motivo || null,
        params.detalles ? JSON.stringify(params.detalles) : null,
        fechaHora
      ]
    );
    persistDb();
    if (isSupabaseEnabled()) {
      void supabase.from('movilidad_registro_movimientos').insert({
        id,
        periodo: params.periodo,
        tipo_movimiento: params.tipoMovimiento,
        entidad: 'SOLICITUD_DOTACION',
        entidad_id: params.entidadId,
        codigo_referencia: params.entidadId,
        rbd_origen: params.rbdOrigen,
        nombre_establecimiento: params.nombreEstablecimiento || null,
        comuna: params.comuna || null,
        usuario_actor: params.usuarioActor,
        rol_actor: params.rolActor || null,
        estado_anterior: params.estadoAnterior || null,
        estado_nuevo: params.estadoNuevo || null,
        descripcion: params.descripcion,
        motivo: params.motivo || null,
        detalles_json: params.detalles || null,
        fecha_hora: fechaHora
      });
    }
  } catch (err) {
    console.warn('[solicitudesDotacionService] Aviso registrando bitácora:', err);
  }
}

function syncSolicitudSupabase(sol: SolicitudMovimientoDotacion): void {
  if (!isSupabaseEnabled()) return;
  void supabase
    .from('solicitudes_movimiento_dotacion')
    .upsert(
      {
        id: sol.id,
        periodo: sol.periodo,
        rbd: sol.rbd,
        nombre_establecimiento: sol.nombreEstablecimiento || null,
        comuna: sol.comuna || null,
        entidad_tipo: sol.entidadTipo,
        funcionario_id: sol.funcionarioId,
        run_funcionario: sol.runFuncionario,
        nombre_funcionario: sol.nombreFuncionario,
        calidad_juridica: sol.calidadJuridica || null,
        cargo_o_asignatura: sol.cargoOAsignatura || null,
        tipo_movimiento: sol.tipoMovimiento,
        propuesta_gdp_origen: sol.propuestaGdpOrigen || null,
        horas_vigentes: sol.horasVigentes,
        horas_solicitadas: sol.horasSolicitadas,
        delta_horas: sol.deltaHoras,
        aplica_articulo_69_previo: Boolean(sol.aplicaArticulo69Previo),
        aplica_articulo_69_solicitado: Boolean(sol.aplicaArticulo69Solicitado),
        fuentes_actuales_json: sol.fuentesActuales || null,
        fuentes_solicitadas_json: sol.fuentesSolicitadas || null,
        remuneracion_mensual_estimada: sol.remuneracionMensualEstimada || 0,
        accion_pme: sol.accionPme || null,
        justificacion_escuela: sol.justificacionEscuela,
        estado_revision: sol.estadoRevision,
        horas_aprobadas: sol.horasAprobadas ?? null,
        visado_uatp_por: sol.visadoUatpPor || null,
        fecha_visacion_uatp: sol.fechaVisacionUatp || null,
        observacion_uatp: sol.observacionUatp || null,
        sancionado_gdp_por: sol.sancionadoGdpPor || null,
        rol_sancionador: sol.rolSancionador || null,
        fecha_sancion_gdp: sol.fechaSancionGdp || null,
        observacion_sancion: sol.observacionSancion || null,
        aplicado_a_nomina: Boolean(sol.aplicadoANomina),
        solicitud_movilidad_id: sol.solicitudMovilidadId || null,
        creado_por: sol.creadoPor || null,
        created_at: sol.createdAt || new Date().toISOString(),
        updated_at: sol.updatedAt || new Date().toISOString()
      },
      { onConflict: 'id' }
    )
    .then(
      () => {},
      err => console.warn('[solicitudesDotacionService] Error sincronizando con Supabase:', err)
    );
}

export async function listarSolicitudesMovimientoDotacion(filtros?: {
  periodo?: number;
  rbd?: string;
  estadoRevision?: EstadoRevisionSolicitudDotacion;
  tipoMovimiento?: TipoMovimientoDotacion;
}): Promise<SolicitudMovimientoDotacion[]> {
  const db = await getDb();
  const periodo = filtros?.periodo ?? 2027;
  const where: string[] = ['periodo = ?'];
  const params: any[] = [periodo];

  if (filtros?.rbd) {
    where.push('rbd = ?');
    params.push(filtros.rbd);
  }
  if (filtros?.estadoRevision) {
    where.push('estado_revision = ?');
    params.push(filtros.estadoRevision);
  }
  if (filtros?.tipoMovimiento) {
    where.push('tipo_movimiento = ?');
    params.push(filtros.tipoMovimiento);
  }

  const res = db.exec(
    `SELECT ${SOLICITUD_COLS}
     FROM solicitudes_movimiento_dotacion
     WHERE ${where.join(' AND ')}
     ORDER BY COALESCE(updated_at, created_at) DESC;`,
    params
  );
  if (!res[0]) return [];
  return res[0].values.map(mapRowToSolicitud);
}

export async function obtenerSolicitudPorId(
  id: string
): Promise<SolicitudMovimientoDotacion | null> {
  const db = await getDb();
  const res = db.exec(
    `SELECT ${SOLICITUD_COLS} FROM solicitudes_movimiento_dotacion WHERE id = ? LIMIT 1;`,
    [id]
  );
  if (!res[0] || res[0].values.length === 0) return null;
  return mapRowToSolicitud(res[0].values[0]);
}

const ESTADOS_ACTIVOS_EN_REVISION: EstadoRevisionSolicitudDotacion[] = [
  'PENDIENTE',
  'EN_REVISION_UATP',
  'VISADO_UATP'
];

export async function guardarSolicitudMovimientoDotacion(
  input: Omit<SolicitudMovimientoDotacion, 'id' | 'createdAt' | 'updatedAt' | 'estadoRevision'> & {
    id?: string;
    estadoRevision?: EstadoRevisionSolicitudDotacion;
  },
  actor?: { usuario?: string; rol?: string }
): Promise<SolicitudMovimientoDotacion> {
  const db = await getDb();
  const ahora = new Date().toISOString();

  // Buscar solicitud abierta equivalente para evitar duplicados al re-editar el formulario
  let existente: SolicitudMovimientoDotacion | null = null;
  if (input.id) {
    existente = await obtenerSolicitudPorId(input.id);
  } else {
    const resExist = db.exec(
      `SELECT ${SOLICITUD_COLS}
       FROM solicitudes_movimiento_dotacion
       WHERE periodo = ? AND rbd = ? AND funcionario_id = ? AND tipo_movimiento = ?
         AND estado_revision IN ('PENDIENTE', 'EN_REVISION_UATP', 'VISADO_UATP')
       LIMIT 1;`,
      [input.periodo, input.rbd, input.funcionarioId, input.tipoMovimiento]
    );
    if (resExist[0] && resExist[0].values.length > 0) {
      existente = mapRowToSolicitud(resExist[0].values[0]);
    }
  }

  const sol: SolicitudMovimientoDotacion = {
    ...input,
    id: existente?.id || input.id || generarIdSolicitudDotacion(),
    // Preservar línea base original si la escuela vuelve a editar mientras está pendiente
    horasVigentes: existente ? existente.horasVigentes : input.horasVigentes,
    aplicaArticulo69Previo: existente
      ? existente.aplicaArticulo69Previo
      : Boolean(input.aplicaArticulo69Previo),
    fuentesActuales: existente?.fuentesActuales || input.fuentesActuales,
    deltaHoras: Number((input.horasSolicitadas - (existente ? existente.horasVigentes : input.horasVigentes)).toFixed(2)),
    estadoRevision: input.estadoRevision || (existente?.estadoRevision && ESTADOS_ACTIVOS_EN_REVISION.includes(existente.estadoRevision) ? existente.estadoRevision : 'PENDIENTE'),
    creadoPor: existente?.creadoPor || input.creadoPor || actor?.usuario || 'sistema',
    createdAt: existente?.createdAt || ahora,
    updatedAt: ahora
  };

  db.run(
    `INSERT OR REPLACE INTO solicitudes_movimiento_dotacion (
      id, periodo, rbd, nombre_establecimiento, comuna, entidad_tipo,
      funcionario_id, run_funcionario, nombre_funcionario, calidad_juridica, cargo_o_asignatura,
      tipo_movimiento, propuesta_gdp_origen, horas_vigentes, horas_solicitadas, delta_horas,
      aplica_articulo_69_previo, aplica_articulo_69_solicitado,
      fuentes_actuales_json, fuentes_solicitadas_json,
      remuneracion_mensual_estimada, accion_pme, justificacion_escuela,
      estado_revision, horas_aprobadas, visado_uatp_por, fecha_visacion_uatp, observacion_uatp,
      sancionado_gdp_por, rol_sancionador, fecha_sancion_gdp, observacion_sancion,
      aplicado_a_nomina, solicitud_movilidad_id, creado_por, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      sol.id,
      sol.periodo,
      sol.rbd,
      sol.nombreEstablecimiento || null,
      sol.comuna || null,
      sol.entidadTipo,
      sol.funcionarioId,
      sol.runFuncionario,
      sol.nombreFuncionario,
      sol.calidadJuridica || null,
      sol.cargoOAsignatura || null,
      sol.tipoMovimiento,
      sol.propuestaGdpOrigen || null,
      sol.horasVigentes,
      sol.horasSolicitadas,
      sol.deltaHoras,
      sol.aplicaArticulo69Previo ? 1 : 0,
      sol.aplicaArticulo69Solicitado ? 1 : 0,
      sol.fuentesActuales ? JSON.stringify(sol.fuentesActuales) : null,
      sol.fuentesSolicitadas ? JSON.stringify(sol.fuentesSolicitadas) : null,
      sol.remuneracionMensualEstimada || 0,
      sol.accionPme || null,
      sol.justificacionEscuela,
      sol.estadoRevision,
      sol.horasAprobadas ?? null,
      sol.visadoUatpPor || null,
      sol.fechaVisacionUatp || null,
      sol.observacionUatp || null,
      sol.sancionadoGdpPor || null,
      sol.rolSancionador || null,
      sol.fechaSancionGdp || null,
      sol.observacionSancion || null,
      sol.aplicadoANomina ? 1 : 0,
      sol.solicitudMovilidadId || null,
      sol.creadoPor || null,
      sol.createdAt || ahora,
      sol.updatedAt || ahora
    ]
  );
  persistDb();
  syncSolicitudSupabase(sol);

  await registrarBitacoraDotacion({
    periodo: sol.periodo,
    tipoMovimiento: 'SOLICITUD_AJUSTE_GDP',
    entidadId: sol.id,
    rbdOrigen: sol.rbd,
    nombreEstablecimiento: sol.nombreEstablecimiento,
    comuna: sol.comuna,
    usuarioActor: actor?.usuario || sol.creadoPor || 'establecimiento',
    rolActor: actor?.rol,
    estadoAnterior: existente?.estadoRevision,
    estadoNuevo: sol.estadoRevision,
    descripcion: `${sol.tipoMovimiento}: ${sol.nombreFuncionario} (${sol.runFuncionario}) · ${sol.horasVigentes}h → ${sol.horasSolicitadas}h`,
    motivo: sol.justificacionEscuela,
    detalles: { tipoMovimiento: sol.tipoMovimiento, deltaHoras: sol.deltaHoras }
  });

  return sol;
}

function extraerFuentesDocente(d: Docente): DesgloseFuentesSolicitud {
  return {
    subvGeneralTitular: Number(d.horasSubvencionGeneralTitular || 0),
    subvGeneralContrata: Number(d.horasSubvencionGeneralContrata || 0),
    sepTitular: Number(d.horasSepTitular || 0),
    sepContrata: Number(d.horasSepContrata || 0),
    pieTitular: Number(d.horasPieTitular || 0),
    pieContrata: Number(d.horasPieContrata || 0)
  };
}

function extraerFuentesAsistente(a: AsistenteEducacion): DesgloseFuentesSolicitud {
  return {
    subvGeneralIndefinido: Number(a.horasSubvencionGeneralIndefinido || 0),
    subvGeneralPlazoFijo: Number(a.horasSubvencionGeneralPlazoFijo || 0),
    sepIndefinido: Number(a.horasSepIndefinido || 0),
    sepPlazoFijo: Number(a.horasSepPlazoFijo || 0),
    pieIndefinido: Number(a.horasPieIndefinido || 0),
    piePlazoFijo: Number(a.horasPiePlazoFijo || 0),
    honorarios: Number(a.horasHonorarios || 0),
    proRetencion: Number(a.horasProRetencion || 0)
  };
}

function fuentesCambiaron(a?: DesgloseFuentesSolicitud, b?: DesgloseFuentesSolicitud): boolean {
  if (!a || !b) return false;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof DesgloseFuentesSolicitud>;
  for (const k of keys) {
    if (Math.abs(Number(a[k] || 0) - Number(b[k] || 0)) > 0.05) return true;
  }
  return false;
}

/**
 * Detecta y registra automáticamente solicitudes de movimiento desde la edición de un Docente
 * (Aumento/Disminución de horas, No Continuidad, Nuevo, Cambio de Fuente y Acogimiento Art. 69).
 * Mantiene intacta la simulación activa en la escuela y marca `estadoSancionGdp = 'Pendiente'`.
 */
export async function detectarYRegistrarSolicitudesDocente(params: {
  previo?: Docente | null;
  nuevo: Docente;
  establecimiento?: Establecimiento | null;
  usuarioActor?: string;
  rolActor?: string;
}): Promise<{ docenteParaGuardar: Docente; solicitudesGeneradas: SolicitudMovimientoDotacion[] }> {
  const { previo, nuevo, establecimiento, usuarioActor, rolActor } = params;
  const solicitudesGeneradas: SolicitudMovimientoDotacion[] = [];
  const periodo = nuevo.periodo ?? 2027;
  const rbd = nuevo.rbd;
  const nombreEst = establecimiento?.nombre;
  const comuna = establecimiento?.comuna;
  const nombreCompleto = `${nuevo.nombres} ${nuevo.apellidos}`.trim();
  const justificacion =
    (nuevo.observacionesPal || nuevo.observacionesDirector || '').trim() ||
    `Solicitud registrada desde ficha docente (${nuevo.propuestaGdp || 'Ajuste dotación'})`;

  const horasBase = previo
    ? Number(previo.horasVigentesAnterior ?? previo.horasContrato ?? 0)
    : Number(nuevo.horasVigentesAnterior ?? nuevo.horasContrato ?? 0);
  const horasSol = Number(nuevo.horasContrato || 0);
  const fuentesPrev = previo ? extraerFuentesDocente(previo) : undefined;
  const fuentesNuev = extraerFuentesDocente(nuevo);
  const prop = (nuevo.propuestaGdp || 'Continuidad').trim();

  // 1. Acogimiento al Art. 69 Ley 19.070 (solicitud específica de reducción lectiva a 24h crono / 32 HA)
  const solicitoArt69 = Boolean(nuevo.aplicaArticulo69) && !Boolean(previo?.aplicaArticulo69);
  if (solicitoArt69) {
    const solArt69 = await guardarSolicitudMovimientoDotacion(
      {
        periodo,
        rbd,
        nombreEstablecimiento: nombreEst,
        comuna,
        entidadTipo: 'DOCENTE',
        funcionarioId: nuevo.id,
        runFuncionario: nuevo.run,
        nombreFuncionario: nombreCompleto,
        calidadJuridica: nuevo.calidadJuridica,
        cargoOAsignatura: nuevo.asignaturaPrincipal || nuevo.cargoInstitucional || nuevo.estamento,
        tipoMovimiento: 'ACOGIMIENTO_ART_69',
        propuestaGdpOrigen: prop,
        horasVigentes: horasBase,
        horasSolicitadas: horasSol,
        deltaHoras: horasSol - horasBase,
        aplicaArticulo69Previo: Boolean(previo?.aplicaArticulo69),
        aplicaArticulo69Solicitado: true,
        fuentesActuales: fuentesPrev,
        fuentesSolicitadas: fuentesNuev,
        remuneracionMensualEstimada: nuevo.remuneracionMensual || 0,
        accionPme: nuevo.accionPme,
        justificacionEscuela: justificacion,
        creadoPor: usuarioActor
      },
      { usuario: usuarioActor, rol: rolActor }
    );
    solicitudesGeneradas.push(solArt69);
  }

  // 2. Movimiento contractual / GDP principal
  let tipoMov: TipoMovimientoDotacion | null = null;
  if (prop === 'No Continuidad') {
    tipoMov = 'NO_CONTINUIDAD';
  } else if (!previo && prop === 'Nuevo') {
    tipoMov = 'CONTRATO_NUEVO';
  } else if (prop === 'Aumento Horas' || (previo && horasSol > horasBase)) {
    tipoMov = 'AUMENTO_HORAS';
  } else if (prop === 'Disminución Horas' || (previo && horasSol < horasBase)) {
    tipoMov = 'DISMINUCION_HORAS';
  } else if (previo && fuentesCambiaron(fuentesPrev, fuentesNuev)) {
    tipoMov = 'CAMBIO_FUENTE';
  }

  if (tipoMov) {
    const solPrincipal = await guardarSolicitudMovimientoDotacion(
      {
        periodo,
        rbd,
        nombreEstablecimiento: nombreEst,
        comuna,
        entidadTipo: 'DOCENTE',
        funcionarioId: nuevo.id,
        runFuncionario: nuevo.run,
        nombreFuncionario: nombreCompleto,
        calidadJuridica: nuevo.calidadJuridica,
        cargoOAsignatura: nuevo.asignaturaPrincipal || nuevo.cargoInstitucional || nuevo.estamento,
        tipoMovimiento: tipoMov,
        propuestaGdpOrigen: prop,
        horasVigentes: tipoMov === 'CONTRATO_NUEVO' ? 0 : horasBase,
        horasSolicitadas: horasSol,
        deltaHoras: tipoMov === 'CONTRATO_NUEVO' ? horasSol : horasSol - horasBase,
        aplicaArticulo69Previo: Boolean(previo?.aplicaArticulo69),
        aplicaArticulo69Solicitado: Boolean(nuevo.aplicaArticulo69),
        fuentesActuales: fuentesPrev,
        fuentesSolicitadas: fuentesNuev,
        remuneracionMensualEstimada: nuevo.remuneracionMensual || 0,
        accionPme: nuevo.accionPme,
        justificacionEscuela: justificacion,
        creadoPor: usuarioActor
      },
      { usuario: usuarioActor, rol: rolActor }
    );
    solicitudesGeneradas.push(solPrincipal);
  }

  const docenteParaGuardar: Docente =
    solicitudesGeneradas.length > 0
      ? {
          ...nuevo,
          horasVigentesAnterior: previo ? horasBase : nuevo.horasVigentesAnterior ?? horasBase,
          estadoSancionGdp: 'Pendiente'
        }
      : nuevo;

  return { docenteParaGuardar, solicitudesGeneradas };
}

/**
 * Detecta y registra automáticamente solicitudes de movimiento desde la edición de un Asistente.
 */
export async function detectarYRegistrarSolicitudesAsistente(params: {
  previo?: AsistenteEducacion | null;
  nuevo: AsistenteEducacion;
  establecimiento?: Establecimiento | null;
  usuarioActor?: string;
  rolActor?: string;
}): Promise<{ asistenteParaGuardar: AsistenteEducacion; solicitudesGeneradas: SolicitudMovimientoDotacion[] }> {
  const { previo, nuevo, establecimiento, usuarioActor, rolActor } = params;
  const solicitudesGeneradas: SolicitudMovimientoDotacion[] = [];
  const periodo = nuevo.periodo ?? 2027;
  const rbd = nuevo.rbd;
  const nombreCompleto = `${nuevo.nombres} ${nuevo.apellidos}`.trim();
  const justificacion =
    (nuevo.observacionesPal || nuevo.observacionesDirector || nuevo.observaciones || '').trim() ||
    `Solicitud registrada desde ficha asistente (${nuevo.propuestaGdp || 'Ajuste dotación'})`;

  const horasBase = previo
    ? Number(previo.horasVigentesAnterior ?? previo.horasContrato ?? 0)
    : Number(nuevo.horasVigentesAnterior ?? nuevo.horasContrato ?? 0);
  const horasSol = Number(nuevo.horasContrato || 0);
  const fuentesPrev = previo ? extraerFuentesAsistente(previo) : undefined;
  const fuentesNuev = extraerFuentesAsistente(nuevo);
  const prop = (nuevo.propuestaGdp || 'Continuidad').trim();

  let tipoMov: TipoMovimientoDotacion | null = null;
  if (prop === 'No Continuidad') {
    tipoMov = 'NO_CONTINUIDAD';
  } else if (!previo && prop === 'Nuevo') {
    tipoMov = 'CONTRATO_NUEVO';
  } else if (prop === 'Aumento Horas' || (previo && horasSol > horasBase)) {
    tipoMov = 'AUMENTO_HORAS';
  } else if (prop === 'Disminución Horas' || (previo && horasSol < horasBase)) {
    tipoMov = 'DISMINUCION_HORAS';
  } else if (previo && fuentesCambiaron(fuentesPrev, fuentesNuev)) {
    tipoMov = 'CAMBIO_FUENTE';
  }

  if (tipoMov) {
    const sol = await guardarSolicitudMovimientoDotacion(
      {
        periodo,
        rbd,
        nombreEstablecimiento: establecimiento?.nombre,
        comuna: establecimiento?.comuna,
        entidadTipo: 'ASISTENTE',
        funcionarioId: nuevo.id,
        runFuncionario: nuevo.run,
        nombreFuncionario: nombreCompleto,
        calidadJuridica:
          (nuevo.horasSubvencionGeneralIndefinido || 0) +
            (nuevo.horasSepIndefinido || 0) +
            (nuevo.horasPieIndefinido || 0) >
          0
            ? 'INDEFINIDO'
            : 'PLAZO FIJO',
        cargoOAsignatura: nuevo.cargoFuncion || nuevo.estamento,
        tipoMovimiento: tipoMov,
        propuestaGdpOrigen: prop,
        horasVigentes: tipoMov === 'CONTRATO_NUEVO' ? 0 : horasBase,
        horasSolicitadas: horasSol,
        deltaHoras: tipoMov === 'CONTRATO_NUEVO' ? horasSol : horasSol - horasBase,
        fuentesActuales: fuentesPrev,
        fuentesSolicitadas: fuentesNuev,
        remuneracionMensualEstimada: nuevo.remuneracionMensual || 0,
        accionPme: nuevo.accionPme,
        justificacionEscuela: justificacion,
        creadoPor: usuarioActor
      },
      { usuario: usuarioActor, rol: rolActor }
    );
    solicitudesGeneradas.push(sol);
  }

  const asistenteParaGuardar: AsistenteEducacion =
    solicitudesGeneradas.length > 0
      ? {
          ...nuevo,
          horasVigentesAnterior: previo ? horasBase : nuevo.horasVigentesAnterior ?? horasBase,
          estadoSancionGdp: 'Pendiente'
        }
      : nuevo;

  return { asistenteParaGuardar, solicitudesGeneradas };
}

/**
 * Visación técnica de nivel UATP (Asesor / Coordinador / Subdirector).
 */
export async function visarTecnicoSolicitudDotacion(params: {
  id: string;
  estadoDestino: 'EN_REVISION_UATP' | 'VISADO_UATP';
  observacionUatp?: string;
  usuarioActor: string;
  rolActor?: string;
}): Promise<SolicitudMovimientoDotacion> {
  const sol = await obtenerSolicitudPorId(params.id);
  if (!sol) throw new Error('Solicitud de movimiento no encontrada.');

  const estadoAnterior = sol.estadoRevision;
  const actualizada: SolicitudMovimientoDotacion = {
    ...sol,
    estadoRevision: params.estadoDestino,
    visadoUatpPor: params.usuarioActor,
    fechaVisacionUatp: new Date().toISOString(),
    observacionUatp: params.observacionUatp?.trim() || sol.observacionUatp,
    updatedAt: new Date().toISOString()
  };

  await guardarSolicitudMovimientoDotacion(actualizada, {
    usuario: params.usuarioActor,
    rol: params.rolActor
  });

  await registrarBitacoraDotacion({
    periodo: sol.periodo,
    tipoMovimiento: 'VISACION_UATP_SOLICITUD',
    entidadId: sol.id,
    rbdOrigen: sol.rbd,
    nombreEstablecimiento: sol.nombreEstablecimiento,
    comuna: sol.comuna,
    usuarioActor: params.usuarioActor,
    rolActor: params.rolActor,
    estadoAnterior,
    estadoNuevo: params.estadoDestino,
    descripcion: `Visación técnica (${params.estadoDestino}) para ${sol.nombreFuncionario} (${sol.tipoMovimiento})`,
    motivo: params.observacionUatp
  });

  return actualizada;
}

/**
 * Sanción definitiva (Aprobado / Aprobado Parcial / Rechazado) con aplicación segura a nómina.
 * Respeta permisos delegables por el Super Usuario (`puedeSancionar`).
 */
export async function sancionarSolicitudDotacion(params: {
  id: string;
  decision: 'APROBADO' | 'APROBADO_PARCIAL' | 'RECHAZADO';
  horasAprobadas?: number;
  observacionSancion?: string;
  usuarioActor: string;
  rolActor?: string;
  puedeSancionar?: boolean;
}): Promise<SolicitudMovimientoDotacion> {
  const autorizado =
    params.puedeSancionar !== undefined ? params.puedeSancionar : esRolValidadorGdp(params.rolActor);
  if (!autorizado) {
    throw new Error(
      'No tienes permiso para sancionar solicitudes de dotación. Solicita al Super Usuario habilitar `solicitudes_dotacion.ejecutar`.'
    );
  }

  const sol = await obtenerSolicitudPorId(params.id);
  if (!sol) throw new Error('Solicitud de movimiento no encontrada.');

  const obs = (params.observacionSancion || '').trim();
  if ((params.decision === 'RECHAZADO' || params.decision === 'APROBADO_PARCIAL') && !obs) {
    throw new Error('Debes ingresar una observación o fundamento para rechazar o aprobar parcialmente.');
  }

  let horasFinales = sol.horasSolicitadas;
  if (params.decision === 'APROBADO_PARCIAL') {
    const h = Number(params.horasAprobadas);
    if (!Number.isFinite(h) || h < 0 || h > 44) {
      throw new Error('Las horas aprobadas parcialmente deben estar entre 0 y 44.');
    }
    horasFinales = h;
  } else if (params.decision === 'RECHAZADO') {
    horasFinales = sol.horasVigentes;
  }

  const ahora = new Date().toISOString();
  const estadoAnterior = sol.estadoRevision;
  const actualizada: SolicitudMovimientoDotacion = {
    ...sol,
    estadoRevision: params.decision,
    horasAprobadas: horasFinales,
    sancionadoGdpPor: params.usuarioActor,
    rolSancionador: params.rolActor,
    fechaSancionGdp: ahora,
    observacionSancion: obs || undefined,
    aplicadoANomina: true,
    updatedAt: ahora
  };

  await guardarSolicitudMovimientoDotacion(actualizada, {
    usuario: params.usuarioActor,
    rol: params.rolActor
  });

  // Aplicar impacto en la ficha del docente o asistente sin dañar registros previos
  if (sol.entidadTipo === 'DOCENTE') {
    const docs = await listarDocentes(sol.rbd, sol.periodo);
    const doc = docs.find(d => d.id === sol.funcionarioId);
    if (doc) {
      const estadoSancionGdp: Docente['estadoSancionGdp'] =
        params.decision === 'APROBADO'
          ? 'Aprobado'
          : params.decision === 'APROBADO_PARCIAL'
          ? 'Aprobado parcial.'
          : 'Rechazado';

      const docActualizado: Docente = {
        ...doc,
        estadoSancionGdp,
        horasAprobadasGdp: horasFinales,
        observacionesSlep: obs || doc.observacionesSlep
      };

      if (params.decision === 'RECHAZADO') {
        docActualizado.horasContrato = sol.horasVigentes;
        if (sol.tipoMovimiento === 'ACOGIMIENTO_ART_69') {
          docActualizado.aplicaArticulo69 = Boolean(sol.aplicaArticulo69Previo);
        }
        if (sol.fuentesActuales) {
          docActualizado.horasSubvencionGeneralTitular = sol.fuentesActuales.subvGeneralTitular ?? doc.horasSubvencionGeneralTitular;
          docActualizado.horasSubvencionGeneralContrata = sol.fuentesActuales.subvGeneralContrata ?? doc.horasSubvencionGeneralContrata;
          docActualizado.horasSepTitular = sol.fuentesActuales.sepTitular ?? doc.horasSepTitular;
          docActualizado.horasSepContrata = sol.fuentesActuales.sepContrata ?? doc.horasSepContrata;
          docActualizado.horasPieTitular = sol.fuentesActuales.pieTitular ?? doc.horasPieTitular;
          docActualizado.horasPieContrata = sol.fuentesActuales.pieContrata ?? doc.horasPieContrata;
        }
      } else {
        docActualizado.horasContrato = horasFinales;
        if (sol.tipoMovimiento !== 'ACOGIMIENTO_ART_69') {
          docActualizado.horasVigentesAnterior = horasFinales;
        }
        if (sol.tipoMovimiento === 'NO_CONTINUIDAD') {
          docActualizado.situacionFinalGdp = 'No Continuidad';
        }
      }

      await guardarDocente(docActualizado);
    }
  } else {
    const asts = await listarAsistentes(sol.rbd, sol.periodo);
    const ast = asts.find(a => a.id === sol.funcionarioId);
    if (ast) {
      const estadoSancionGdp: AsistenteEducacion['estadoSancionGdp'] =
        params.decision === 'APROBADO'
          ? 'Aprobado'
          : params.decision === 'APROBADO_PARCIAL'
          ? 'Aprobado parcial.'
          : 'Rechazado';

      const astActualizado: AsistenteEducacion = {
        ...ast,
        estadoSancionGdp,
        horasAprobadasGdp: horasFinales,
        observacionesSlep: obs || ast.observacionesSlep
      };

      if (params.decision === 'RECHAZADO') {
        astActualizado.horasContrato = sol.horasVigentes;
        if (sol.fuentesActuales) {
          astActualizado.horasSubvencionGeneralIndefinido = sol.fuentesActuales.subvGeneralIndefinido ?? ast.horasSubvencionGeneralIndefinido;
          astActualizado.horasSubvencionGeneralPlazoFijo = sol.fuentesActuales.subvGeneralPlazoFijo ?? ast.horasSubvencionGeneralPlazoFijo;
          astActualizado.horasSepIndefinido = sol.fuentesActuales.sepIndefinido ?? ast.horasSepIndefinido;
          astActualizado.horasSepPlazoFijo = sol.fuentesActuales.sepPlazoFijo ?? ast.horasSepPlazoFijo;
          astActualizado.horasPieIndefinido = sol.fuentesActuales.pieIndefinido ?? ast.horasPieIndefinido;
          astActualizado.horasPiePlazoFijo = sol.fuentesActuales.piePlazoFijo ?? ast.horasPiePlazoFijo;
          astActualizado.horasHonorarios = sol.fuentesActuales.honorarios ?? ast.horasHonorarios;
        }
      } else {
        astActualizado.horasContrato = horasFinales;
        astActualizado.horasVigentesAnterior = horasFinales;
        if (sol.tipoMovimiento === 'NO_CONTINUIDAD') {
          astActualizado.situacionFinalGdp = 'No Continuidad';
        }
      }

      await guardarAsistente(astActualizado);
    }
  }

  await registrarBitacoraDotacion({
    periodo: sol.periodo,
    tipoMovimiento: 'SANCION_GDP_SOLICITUD',
    entidadId: sol.id,
    rbdOrigen: sol.rbd,
    nombreEstablecimiento: sol.nombreEstablecimiento,
    comuna: sol.comuna,
    usuarioActor: params.usuarioActor,
    rolActor: params.rolActor,
    estadoAnterior,
    estadoNuevo: params.decision,
    descripcion: `Sanción GDP (${params.decision}): ${sol.nombreFuncionario} · ${horasFinales}h aprobadas`,
    motivo: obs,
    detalles: { horasSolicitadas: sol.horasSolicitadas, horasAprobadas: horasFinales }
  });

  return actualizada;
}

/**
 * Deriva una solicitud (ej. No Continuidad Titular / Asistente Indefinido) al submódulo Mesa de Movilidad.
 */
export async function derivarSolicitudAMesaMovilidad(params: {
  id: string;
  usuarioActor: string;
  rolActor?: string;
}): Promise<SolicitudMovimientoDotacion> {
  const sol = await obtenerSolicitudPorId(params.id);
  if (!sol) throw new Error('Solicitud de movimiento no encontrada.');

  let solicitudMovilidadId = sol.solicitudMovilidadId;
  if (!solicitudMovilidadId) {
    const esAsistente = sol.entidadTipo === 'ASISTENTE';
    const mov = await guardarSolicitudMovilidad(
      {
        periodo: sol.periodo,
        carril: esAsistente ? 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO' : 'NO_CONTINUIDAD_TITULAR',
        docenteId: sol.funcionarioId,
        runDocente: sol.runFuncionario,
        nombreDocente: sol.nombreFuncionario,
        rbdOrigen: sol.rbd,
        comunaOrigen: sol.comuna,
        calidadJuridica: sol.calidadJuridica === 'TITULAR' ? 'TITULAR' : 'CONTRATA',
        horasContratoActual: sol.horasVigentes,
        horasTitularesActuales: sol.calidadJuridica === 'TITULAR' ? sol.horasVigentes : 0,
        horasDisponiblesMover: sol.horasVigentes,
        horasRemanentes: 0,
        asignaturaPrincipal: sol.cargoOAsignatura,
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'POSTULADO',
        estamentoPersonal: sol.entidadTipo,
        puntajeSalud: 0,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 0,
        fundamento: sol.justificacionEscuela,
        creadoPor: params.usuarioActor
      },
      (params.rolActor || 'subdirector_uatp') as any
    );
    solicitudMovilidadId = mov.id;
  }

  const actualizada: SolicitudMovimientoDotacion = {
    ...sol,
    estadoRevision: 'DERIVADO_MOVILIDAD',
    solicitudMovilidadId,
    sancionadoGdpPor: sol.sancionadoGdpPor || params.usuarioActor,
    rolSancionador: sol.rolSancionador || params.rolActor,
    fechaSancionGdp: sol.fechaSancionGdp || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await guardarSolicitudMovimientoDotacion(actualizada, {
    usuario: params.usuarioActor,
    rol: params.rolActor
  });

  return actualizada;
}
