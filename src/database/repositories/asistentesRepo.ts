import { Database } from 'sql.js';
import { AsistenteEducacion, EstamentoAsistente } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { SupabaseDotacionService } from '../../services/supabaseDotacionService';

export function mapRowToAsistente(row: any[]): AsistenteEducacion {
  const horasContrato = Number(row[8]) || 0;
  return {
    id: String(row[0]),
    rbd: String(row[1]),
    periodo: Number(row[2]) || 2027,
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
    observacionesSlep: row[34] ? String(row[34]) : undefined,
    horasHonorarios: Number(row[35]) || 0,
    esVtf: Boolean(row[36]),
    funcionVtf: row[37] ? (String(row[37]) as AsistenteEducacion['funcionVtf']) : undefined,
    grupoJiscId: row[38] ? String(row[38]) : undefined,
    horaIngresoTurno: row[39] ? String(row[39]) : undefined,
    horaSalidaTurno: row[40] ? String(row[40]) : undefined
  };
}

const ASISTENTE_SELECT_COLS = `
  id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento,
  horas_contrato, horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
  horas_sep_indefinido, horas_sep_plazo_fijo, horas_pie_indefinido, horas_pie_plazo_fijo,
  es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo, es_auxiliar_servicio,
  es_inspector_patio, observaciones, activo,
  horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
  accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
  situacion_final_gdp, observaciones_director, observaciones_slep, horas_honorarios,
  es_vtf, funcion_vtf, grupo_jisc_id, hora_ingreso_turno, hora_salida_turno
`;

export function listarAsistentesSync(db: Database, rbd: string, periodo: number = 2027): AsistenteEducacion[] {
  const stmt = db.prepare(`
    SELECT ${ASISTENTE_SELECT_COLS}
    FROM asistentes_educacion
    WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
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
    const periodo = typeof maybePeriodo === 'number' ? maybePeriodo : 2027;
    return listarAsistentesSync(rbdOrDb, rbd, periodo);
  }
  const rbd = rbdOrDb;
  const periodo = typeof rbdOrPeriodo === 'number' ? rbdOrPeriodo : 2027;
  const db = await getDb();
  return listarAsistentesSync(db, rbd, periodo);
}

export function listarTodosLosAsistentesTerritorioSync(db: Database, periodo: number = 2027): AsistenteEducacion[] {
  const stmt = db.prepare(`
    SELECT ${ASISTENTE_SELECT_COLS}
    FROM asistentes_educacion
    WHERE (periodo = ? OR (periodo IS NULL AND ? = 2027))
    ORDER BY rbd ASC, apellidos ASC, nombres ASC
  `);
  stmt.bind([periodo, periodo]);
  const results: AsistenteEducacion[] = [];
  const seenRbdRun = new Set<string>();

  while (stmt.step()) {
    const ast = mapRowToAsistente(stmt.get());
    const cleanRun = (ast.run || '').replace(/[.\s-]/g, '').toUpperCase();
    const key = `${ast.rbd}_${cleanRun || ast.id}`;
    if (!seenRbdRun.has(key)) {
      seenRbdRun.add(key);
      results.push(ast);
    }
  }
  stmt.free();
  return results;
}

export async function listarTodosLosAsistentesTerritorio(
  dbOrPeriodo?: Database | number,
  maybePeriodo?: number
): Promise<AsistenteEducacion[]> {
  if (dbOrPeriodo && typeof dbOrPeriodo !== 'number') {
    const periodo = typeof maybePeriodo === 'number' ? maybePeriodo : 2027;
    return listarTodosLosAsistentesTerritorioSync(dbOrPeriodo, periodo);
  }
  const periodo = typeof dbOrPeriodo === 'number' ? dbOrPeriodo : 2027;
  const db = await getDb();
  return listarTodosLosAsistentesTerritorioSync(db, periodo);
}

export function obtenerAsistentePorIdSync(db: Database, id: string): AsistenteEducacion | null {
  const stmt = db.prepare(`
    SELECT ${ASISTENTE_SELECT_COLS}
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
      situacion_final_gdp, observaciones_director, observaciones_slep, horas_honorarios,
      es_vtf, funcion_vtf, grupo_jisc_id, hora_ingreso_turno, hora_salida_turno
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run([
    a.id,
    a.rbd,
    a.periodo || 2027,
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
    a.observacionesSlep || null,
    a.horasHonorarios || 0,
    a.esVtf ? 1 : 0,
    a.funcionVtf || null,
    a.grupoJiscId || null,
    a.horaIngresoTurno || null,
    a.horaSalidaTurno || null
  ]);
  stmt.free();
}

export async function guardarAsistente(
  asistenteOrDb: AsistenteEducacion | Database,
  maybeAsistenteOrSkipCloud?: AsistenteEducacion | boolean,
  maybeSkipCloud?: boolean
): Promise<void> {
  if ('exec' in asistenteOrDb) {
    if (maybeAsistenteOrSkipCloud && typeof maybeAsistenteOrSkipCloud !== 'boolean') {
      const ast = maybeAsistenteOrSkipCloud;
      const skip = Boolean(maybeSkipCloud);
      guardarAsistenteSync(asistenteOrDb as Database, ast);
      if (!skip) {
        SupabaseDotacionService.guardarAsistente(ast).catch(err =>
          console.warn('[asistentesRepo] Aviso sincronizando con Supabase:', err)
        );
      }
    }
    return;
  }
  const db = await getDb();
  const ast = asistenteOrDb as AsistenteEducacion;
  const skip = Boolean(maybeAsistenteOrSkipCloud);
  guardarAsistenteSync(db, ast);
  await persistDb();
  if (!skip) {
    SupabaseDotacionService.guardarAsistente(ast).catch(err =>
      console.warn('[asistentesRepo] Aviso sincronizando con Supabase:', err)
    );
  }
}

export function guardarAsistentesBatchSync(
  db: Database,
  asistentes: AsistenteEducacion[],
  rbd?: string,
  periodo: number = 2027,
  reemplazarColegio: boolean = false
): void {
  db.exec('BEGIN TRANSACTION;');
  try {
    if (reemplazarColegio) {
      const rbdsParaLimpiar = rbd ? [rbd] : Array.from(new Set(asistentes.map(a => a.rbd).filter(Boolean)));
      for (const r of rbdsParaLimpiar) {
        const delStmt = db.prepare('DELETE FROM asistentes_educacion WHERE rbd = ? AND periodo = ?');
        delStmt.run([r, periodo]);
        delStmt.free();
      }
    }

    const delDupStmt = db.prepare(`
      DELETE FROM asistentes_educacion 
      WHERE rbd = ? AND periodo = ? 
        AND (run = ? OR REPLACE(REPLACE(run, '.', ''), '-', '') = ?)
        AND id != ?
    `);

    const stmt = db.prepare(`
      INSERT OR REPLACE INTO asistentes_educacion (
        id, rbd, periodo, run, nombres, apellidos, cargo_funcion, estamento,
        horas_contrato, horas_subvencion_general_indefinido, horas_subvencion_general_plazo_fijo,
        horas_sep_indefinido, horas_sep_plazo_fijo, horas_pie_indefinido, horas_pie_plazo_fijo,
        es_dupla_psicosocial, es_equipo_pie, es_tecnico_parvulo, es_auxiliar_servicio,
        es_inspector_patio, observaciones, activo,
        horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
        accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
        situacion_final_gdp, observaciones_director, observaciones_slep, horas_honorarios,
        es_vtf, funcion_vtf, grupo_jisc_id, hora_ingreso_turno, hora_salida_turno
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const a of asistentes) {
      const astPeriodo = a.periodo || periodo;
      const cleanRun = (a.run || '').replace(/[.\s-]/g, '');

      // Eliminar registros duplicados previos del mismo RUN en el mismo colegio con otro id
      delDupStmt.run([a.rbd, astPeriodo, a.run.trim(), cleanRun, a.id]);

      stmt.run([
        a.id,
        a.rbd,
        astPeriodo,
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
        a.observacionesSlep || null,
        a.horasHonorarios || 0,
        a.esVtf ? 1 : 0,
        a.funcionVtf || null,
        a.grupoJiscId || null,
        a.horaIngresoTurno || null,
        a.horaSalidaTurno || null
      ]);
    }
    delDupStmt.free();
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
  maybeReemplazarOrSkipCloud?: boolean,
  maybeSkipCloud?: boolean
): Promise<void> {
  if ('exec' in dbOrAsistentes) {
    const db = dbOrAsistentes as Database;
    const asistentes = asistentesOrRbd as AsistenteEducacion[];
    const rbd = typeof rbdOrPeriodo === 'string' ? rbdOrPeriodo : undefined;
    const periodo = typeof periodoOrReemplazar === 'number' ? periodoOrReemplazar : 2027;
    const reemplazar = Boolean(maybeReemplazarOrSkipCloud);
    const skipCloud = Boolean(maybeSkipCloud);
    guardarAsistentesBatchSync(db, asistentes, rbd, periodo, reemplazar);
    if (!skipCloud) {
      SupabaseDotacionService.guardarAsistentesBatch(asistentes).catch(err =>
        console.warn('[asistentesRepo] Aviso sincronizando lote con Supabase:', err)
      );
    }
    return;
  }

  const asistentes = dbOrAsistentes as AsistenteEducacion[];
  const rbd = typeof asistentesOrRbd === 'string' ? asistentesOrRbd : undefined;
  const periodo = typeof rbdOrPeriodo === 'number' ? rbdOrPeriodo : 2027;
  const reemplazar = Boolean(periodoOrReemplazar);
  const skipCloud = Boolean(maybeReemplazarOrSkipCloud);

  const db = await getDb();
  guardarAsistentesBatchSync(db, asistentes, rbd, periodo, reemplazar);
  await persistDb();
  if (!skipCloud) {
    SupabaseDotacionService.guardarAsistentesBatch(asistentes).catch(err =>
      console.warn('[asistentesRepo] Aviso sincronizando lote con Supabase:', err)
    );
  }
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
    SupabaseDotacionService.eliminarAsistente(targetId).catch(err =>
      console.warn('[asistentesRepo] Aviso eliminando en Supabase:', err)
    );
    return;
  }
  const db = await getDb();
  eliminarAsistenteSync(db, idOrDb);
  await persistDb();
  SupabaseDotacionService.eliminarAsistente(idOrDb).catch(err =>
    console.warn('[asistentesRepo] Aviso eliminando en Supabase:', err)
  );
}

export function eliminarAsistentesColegioPeriodoSync(db: Database, rbd: string, periodo: number = 2027): void {
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
    const periodo = typeof maybePeriodo === 'number' ? maybePeriodo : 2027;
    eliminarAsistentesColegioPeriodoSync(rbdOrDb, rbd, periodo);
    return;
  }
  const rbd = rbdOrDb;
  const periodo = typeof rbdOrPeriodo === 'number' ? rbdOrPeriodo : 2027;
  const db = await getDb();
  eliminarAsistentesColegioPeriodoSync(db, rbd, periodo);
  await persistDb();
  SupabaseDotacionService.eliminarAsistentesColegioPeriodo(rbd, periodo).catch(err =>
    console.warn('[asistentesRepo] Aviso eliminando asistentes en Supabase:', err)
  );
}
