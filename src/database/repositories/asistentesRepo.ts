import { Database } from 'sql.js';
import { AsistenteEducacion, EstamentoAsistente } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { FirebaseDotacionService } from '../../services/firebaseDotacionService';

export function mapRowToAsistente(row: any[]): AsistenteEducacion {
  const horasContrato = Number(row[8]) || 0;
  return {
    id: String(row[0]),
    rbd: String(row[1]),
    periodo: Number(row[2]) || 2026,
    run: String(row[3] || ''),
    nombres: String(row[4] || ''),
    apellidos: String(row[5] || ''),
    cargoFuncion: String(row[6] || ''),
    estamento: row[7] as EstamentoAsistente,
    horasContrato,
    horasSubvencionGeneralIndefinido: Number(row[9]) || 0,
    horasSubvencionGeneralPlazoFijo: Number(row[10]) || 0,
    horasSepIndefinido: Number(row[11]) || 0,
    horasSepPlazoFijo: Number(row[12]) || 0,
    horasPieIndefinido: Number(row[13]) || 0,
    horasPiePlazoFijo: Number(row[14]) || 0,
    esDuplaPsicosocial: Boolean(row[15]),
    esEquipoPie: Boolean(row[16]),
    esTecnicoParvulo: Boolean(row[17]),
    esAuxiliarServicio: Boolean(row[18]),
    esInspectorPatio: Boolean(row[19]),
    observaciones: row[20] ? String(row[20]) : undefined,
    activo: row[21] !== undefined ? Boolean(row[21]) : true,
    horasVigentesAnterior: row[22] !== undefined && row[22] !== null ? Number(row[22]) : horasContrato,
    propuestaGdp: row[23] ? String(row[23]) : 'Continuidad',
    remuneracionMensualApp: Number(row[24] || 0),
    fechaInicioContrato: row[25] ? String(row[25]) : '01-03-2026',
    fechaTerminoContrato: row[26] ? String(row[26]) : '28-02-2027',
    accionPmeSep: row[27] ? String(row[27]) : undefined,
    horasProRetencion: Number(row[28] || 0),
    descripcionFuncionGdp: row[29] ? String(row[29]) : undefined,
    estadoSancionGdp: (row[30] as any) || 'Pendiente',
    horasAprobadasGdp: Number(row[31] || 0),
    situacionFinalGdp: row[32] ? String(row[32]) : 'Vigente',
    observacionesDirector: row[33] ? String(row[33]) : undefined,
    observacionesSlep: row[34] ? String(row[34]) : undefined
  };
}

export function listarAsistentesSync(db: Database, rbd: string, periodo: number = 2026): AsistenteEducacion[] {
  const stmt = db.prepare(`
    SELECT 
      id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento,
      horas_contrato, horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
      horas_sep_indefinido, horas_sep_plazo_fijo, horas_pie_indefinido, horas_pie_plazo_fijo,
      es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo, es_auxiliar_servicio,
      es_inspector_patio, observaciones, activo,
      horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
      accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
      situacion_final_gdp, observaciones_director, observaciones_slep
    FROM asistentes_educacion
    WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))
    ORDER BY apellidos ASC, nombres ASC
  `);
  stmt.bind([rbd, periodo, periodo]);
  const results: AsistenteEducacion[] = [];
  while (stmt.step()) {
    results.push(mapRowToAsistente(stmt.get()));
  }
  stmt.free();
  return results;
}

export async function listarAsistentes(
  rbdOrDb: string | Database,
  rbdOrPeriodo?: string | number,
  maybePeriodo?: number
): Promise<AsistenteEducacion[]> {
  if (typeof rbdOrDb !== 'string') {
    const rbd = String(rbdOrPeriodo || '');
    const periodo = typeof maybePeriodo === 'number' ? maybePeriodo : 2026;
    return listarAsistentesSync(rbdOrDb, rbd, periodo);
  }
  const rbd = rbdOrDb;
  const periodo = typeof rbdOrPeriodo === 'number' ? rbdOrPeriodo : 2026;
  const db = await getDb();
  return listarAsistentesSync(db, rbd, periodo);
}

export function listarTodosLosAsistentesTerritorioSync(db: Database, periodo: number = 2026): AsistenteEducacion[] {
  const stmt = db.prepare(`
    SELECT 
      id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento,
      horas_contrato, horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
      horas_sep_indefinido, horas_sep_plazo_fijo, horas_pie_indefinido, horas_pie_plazo_fijo,
      es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo, es_auxiliar_servicio,
      es_inspector_patio, observaciones, activo,
      horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
      accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
      situacion_final_gdp, observaciones_director, observaciones_slep
    FROM asistentes_educacion
    WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026))
    ORDER BY rbd ASC, apellidos ASC, nombres ASC
  `);
  stmt.bind([periodo, periodo]);
  const results: AsistenteEducacion[] = [];
  while (stmt.step()) {
    results.push(mapRowToAsistente(stmt.get()));
  }
  stmt.free();
  return results;
}

export async function listarTodosLosAsistentesTerritorio(
  dbOrPeriodo?: Database | number,
  maybePeriodo?: number
): Promise<AsistenteEducacion[]> {
  if (dbOrPeriodo && typeof dbOrPeriodo !== 'number') {
    const periodo = typeof maybePeriodo === 'number' ? maybePeriodo : 2026;
    return listarTodosLosAsistentesTerritorioSync(dbOrPeriodo, periodo);
  }
  const periodo = typeof dbOrPeriodo === 'number' ? dbOrPeriodo : 2026;
  const db = await getDb();
  return listarTodosLosAsistentesTerritorioSync(db, periodo);
}

export function obtenerAsistentePorIdSync(db: Database, id: string): AsistenteEducacion | null {
  const stmt = db.prepare(`
    SELECT 
      id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento,
      horas_contrato, horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
      horas_sep_indefinido, horas_sep_plazo_fijo, horas_pie_indefinido, horas_pie_plazo_fijo,
      es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo, es_auxiliar_servicio,
      es_inspector_patio, observaciones, activo
    FROM asistentes_educacion
    WHERE id = ?
  `);
  stmt.bind([id]);
  let result: AsistenteEducacion | null = null;
  if (stmt.step()) {
    result = mapRowToAsistente(stmt.get());
  }
  stmt.free();
  return result;
}

export async function obtenerAsistentePorId(
  idOrDb: string | Database,
  maybeId?: string
): Promise<AsistenteEducacion | null> {
  if (typeof idOrDb !== 'string') {
    return obtenerAsistentePorIdSync(idOrDb, String(maybeId || ''));
  }
  const db = await getDb();
  return obtenerAsistentePorIdSync(db, idOrDb);
}

export function guardarAsistenteSync(db: Database, a: AsistenteEducacion): void {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO asistentes_educacion (
      id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento,
      horas_contrato, horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
      horas_sep_indefinido, horas_sep_plazo_fijo, horas_pie_indefinido, horas_pie_plazo_fijo,
      es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo, es_auxiliar_servicio,
      es_inspector_patio, observaciones, activo,
      horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
      accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
      situacion_final_gdp, observaciones_director, observaciones_slep
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    a.id,
    a.rbd,
    a.periodo || 2026,
    a.run.trim(),
    a.nombres.trim(),
    a.apellidos.trim(),
    a.cargoFuncion.trim(),
    a.estamento,
    a.horasContrato || 0,
    a.horasSubvencionGeneralIndefinido || 0,
    a.horasSubvencionGeneralPlazoFijo || 0,
    a.horasSepIndefinido || 0,
    a.horasSepPlazoFijo || 0,
    a.horasPieIndefinido || 0,
    a.horasPiePlazoFijo || 0,
    a.esDuplaPsicosocial ? 1 : 0,
    a.esEquipoPie ? 1 : 0,
    a.esTecnicoParvulo ? 1 : 0,
    a.esAuxiliarServicio ? 1 : 0,
    a.esInspectorPatio ? 1 : 0,
    a.observaciones || null,
    a.activo !== false ? 1 : 0,
    a.horasVigentesAnterior !== undefined && a.horasVigentesAnterior !== null ? a.horasVigentesAnterior : (a.horasContrato || 0),
    a.propuestaGdp || 'Continuidad',
    a.remuneracionMensualApp || 0,
    a.fechaInicioContrato || '01-03-2026',
    a.fechaTerminoContrato || '28-02-2027',
    a.accionPmeSep || null,
    a.horasProRetencion || 0,
    a.descripcionFuncionGdp || null,
    a.estadoSancionGdp || 'Pendiente',
    a.horasAprobadasGdp || 0,
    a.situacionFinalGdp || 'Vigente',
    a.observacionesDirector || null,
    a.observacionesSlep || null
  ]);
  stmt.free();
}

export async function guardarAsistente(
  asistenteOrDb: AsistenteEducacion | Database,
  maybeAsistente?: AsistenteEducacion
): Promise<void> {
  if ('exec' in asistenteOrDb) {
    if (maybeAsistente) {
      guardarAsistenteSync(asistenteOrDb as Database, maybeAsistente);
      FirebaseDotacionService.guardarAsistente(maybeAsistente).catch(err =>
        console.warn('[asistentesRepo] Aviso sincronizando con Firestore:', err)
      );
    }
    return;
  }
  const db = await getDb();
  const ast = asistenteOrDb as AsistenteEducacion;
  guardarAsistenteSync(db, ast);
  await persistDb();
  FirebaseDotacionService.guardarAsistente(ast).catch(err =>
    console.warn('[asistentesRepo] Aviso sincronizando con Firestore:', err)
  );
}

export function guardarAsistentesBatchSync(
  db: Database,
  asistentes: AsistenteEducacion[],
  rbd?: string,
  periodo: number = 2026,
  reemplazarColegio: boolean = false
): void {
  db.exec('BEGIN TRANSACTION;');
  try {
    if (reemplazarColegio && rbd) {
      const delStmt = db.prepare('DELETE FROM asistentes_educacion WHERE rbd = ? AND periodo = ?');
      delStmt.run([rbd, periodo]);
      delStmt.free();
    }

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO asistentes_educacion (
        id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento,
        horas_contrato, horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
        horas_sep_indefinido, horas_sep_plazo_fijo, horas_pie_indefinido, horas_pie_plazo_fijo,
        es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo, es_auxiliar_servicio,
        es_inspector_patio, observaciones, activo,
        horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
        accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
        situacion_final_gdp, observaciones_director, observaciones_slep
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of asistentes) {
      stmt.run([
        a.id,
        a.rbd,
        a.periodo || periodo,
        a.run.trim(),
        a.nombres.trim(),
        a.apellidos.trim(),
        a.cargoFuncion.trim(),
        a.estamento,
        a.horasContrato || 0,
        a.horasSubvencionGeneralIndefinido || 0,
        a.horasSubvencionGeneralPlazoFijo || 0,
        a.horasSepIndefinido || 0,
        a.horasSepPlazoFijo || 0,
        a.horasPieIndefinido || 0,
        a.horasPiePlazoFijo || 0,
        a.esDuplaPsicosocial ? 1 : 0,
        a.esEquipoPie ? 1 : 0,
        a.esTecnicoParvulo ? 1 : 0,
        a.esAuxiliarServicio ? 1 : 0,
        a.esInspectorPatio ? 1 : 0,
        a.observaciones || null,
        a.activo !== false ? 1 : 0,
        a.horasVigentesAnterior !== undefined && a.horasVigentesAnterior !== null ? a.horasVigentesAnterior : (a.horasContrato || 0),
        a.propuestaGdp || 'Continuidad',
        a.remuneracionMensualApp || 0,
        a.fechaInicioContrato || '01-03-2026',
        a.fechaTerminoContrato || '28-02-2027',
        a.accionPmeSep || null,
        a.horasProRetencion || 0,
        a.descripcionFuncionGdp || null,
        a.estadoSancionGdp || 'Pendiente',
        a.horasAprobadasGdp || 0,
        a.situacionFinalGdp || 'Vigente',
        a.observacionesDirector || null,
        a.observacionesSlep || null
      ]);
    }
    stmt.free();
    db.exec('COMMIT;');
  } catch (error) {
    db.exec('ROLLBACK;');
    throw error;
  }
}

export async function guardarAsistentesBatch(
  dbOrAsistentes: Database | AsistenteEducacion[],
  asistentesOrRbd?: AsistenteEducacion[] | string,
  rbdOrPeriodo?: string | number,
  periodoOrReemplazar?: number | boolean,
  maybeReemplazar?: boolean
): Promise<void> {
  if ('exec' in dbOrAsistentes) {
    const db = dbOrAsistentes as Database;
    const asistentes = asistentesOrRbd as AsistenteEducacion[];
    const rbd = typeof rbdOrPeriodo === 'string' ? rbdOrPeriodo : undefined;
    const periodo = typeof periodoOrReemplazar === 'number' ? periodoOrReemplazar : 2026;
    const reemplazar = Boolean(maybeReemplazar);
    guardarAsistentesBatchSync(db, asistentes, rbd, periodo, reemplazar);
    FirebaseDotacionService.guardarAsistentesBatch(asistentes).catch(err =>
      console.warn('[asistentesRepo] Aviso sincronizando lote con Firestore:', err)
    );
    return;
  }

  const asistentes = dbOrAsistentes as AsistenteEducacion[];
  const rbd = typeof asistentesOrRbd === 'string' ? asistentesOrRbd : undefined;
  const periodo = typeof rbdOrPeriodo === 'number' ? rbdOrPeriodo : 2026;
  const reemplazar = Boolean(periodoOrReemplazar);

  const db = await getDb();
  guardarAsistentesBatchSync(db, asistentes, rbd, periodo, reemplazar);
  await persistDb();
  FirebaseDotacionService.guardarAsistentesBatch(asistentes).catch(err =>
    console.warn('[asistentesRepo] Aviso sincronizando lote con Firestore:', err)
  );
}

export function eliminarAsistenteSync(db: Database, id: string): void {
  const stmt = db.prepare('DELETE FROM asistentes_educacion WHERE id = ?');
  stmt.run([id]);
  stmt.free();
}

export async function eliminarAsistente(
  idOrDb: string | Database,
  maybeId?: string
): Promise<void> {
  if (typeof idOrDb !== 'string') {
    const targetId = String(maybeId || '');
    eliminarAsistenteSync(idOrDb, targetId);
    FirebaseDotacionService.eliminarAsistente(targetId).catch(err =>
      console.warn('[asistentesRepo] Aviso eliminando en Firestore:', err)
    );
    return;
  }
  const db = await getDb();
  eliminarAsistenteSync(db, idOrDb);
  await persistDb();
  FirebaseDotacionService.eliminarAsistente(idOrDb).catch(err =>
    console.warn('[asistentesRepo] Aviso eliminando en Firestore:', err)
  );
}

export function eliminarAsistentesColegioPeriodoSync(db: Database, rbd: string, periodo: number = 2026): void {
  const stmt = db.prepare('DELETE FROM asistentes_educacion WHERE rbd = ? AND periodo = ?');
  stmt.run([rbd, periodo]);
  stmt.free();
}

export async function eliminarAsistentesColegioPeriodo(
  rbdOrDb: string | Database,
  rbdOrPeriodo?: string | number,
  maybePeriodo?: number
): Promise<void> {
  if (typeof rbdOrDb !== 'string') {
    const rbd = String(rbdOrPeriodo || '');
    const periodo = typeof maybePeriodo === 'number' ? maybePeriodo : 2026;
    eliminarAsistentesColegioPeriodoSync(rbdOrDb, rbd, periodo);
    return;
  }
  const rbd = rbdOrDb;
  const periodo = typeof rbdOrPeriodo === 'number' ? rbdOrPeriodo : 2026;
  const db = await getDb();
  eliminarAsistentesColegioPeriodoSync(db, rbd, periodo);
  await persistDb();
}
