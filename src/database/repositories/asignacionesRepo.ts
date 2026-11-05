import { AsignacionHoraria } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { SupabaseDotacionService } from '../../services/supabaseDotacionService';

/**
 * Purga automática: Elimina asignaciones residuales de "Plan Común Electivo"
 * en cualquier curso que no corresponda a 3° o 4° Medio (ej. 3° y 4° Básico).
 */
export async function purgarAsignacionesPlanComunElectivoInvalidas(dbParam?: any): Promise<number> {
  const db = dbParam || await getDb();
  try {
    const res = db.exec(`
      SELECT a.id, a.asignatura, c.nivel
      FROM asignaciones_horarias a
      LEFT JOIN cursos_sae c ON a.curso_id = c.id
      WHERE (
        LOWER(a.asignatura) LIKE '%plan com%n electivo%' OR
        LOWER(a.asignatura) LIKE '%plan comun electivo%'
      )
    `);
    if (!res.length || !res[0].values.length) return 0;

    const idsAEliminar: string[] = [];
    for (const row of res[0].values) {
      const id = String(row[0]);
      const nivel = String(row[2] || '');
      const es34Medio = !/b[aá]sic[oa]|parvulari|k[ií]nder|transici[oó]n|nt[12]|sala\s*cuna/i.test(nivel) &&
        /([34][°ºo]?\s*(medio|em|tp)|tercer[oa]?\s*(medio|em)|cuart[oa]?\s*(medio|em))/i.test(nivel);

      if (!es34Medio) {
        idsAEliminar.push(id);
      }
    }

    if (idsAEliminar.length > 0) {
      for (const id of idsAEliminar) {
        db.run("DELETE FROM asignaciones_horarias WHERE id = ?", [id]);
      }
      persistDb();
      return idsAEliminar.length;
    }
  } catch (err) {
    console.warn('[purgarAsignacionesPlanComunElectivoInvalidas] Error:', err);
  }
  return 0;
}

export async function listarAsignaciones(rbd: string, periodo: number = 2027): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  await purgarAsignacionesPlanComunElectivoInvalidas(db);
  const res = db.exec("SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo, cursos_compartidos_json, es_diferenciado_compartido, codigo_asignatura, ambito_curricular FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))", [rbd, periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    let cursosCompartidosIds: string[] | undefined = undefined;
    if (row[18]) {
      try {
        cursosCompartidosIds = JSON.parse(String(row[18]));
      } catch (_) {}
    }
    return {
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
      periodo: row[12] ? Number(row[12]) : 2027,
      esTallerSep: Boolean(row[13]),
      esProporcionDocente: Boolean(row[14]),
      esCoDocencia: Boolean(row[15]),
      esAgrupacionFlexible: Boolean(row[16]),
      esTrabajoColaborativo: Boolean(row[17]),
      cursosCompartidosIds,
      esDiferenciadoCompartido: Boolean(row[19]) || Boolean(cursosCompartidosIds && cursosCompartidosIds.length > 0),
      codigoAsignatura: row[20] ? String(row[20]) : undefined,
      ambitoCurricular: row[21] ? (String(row[21]) as any) : undefined
    };
  });
}

export async function listarTodasLasAsignaciones(periodo: number = 2027): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo, cursos_compartidos_json, es_diferenciado_compartido, codigo_asignatura, ambito_curricular FROM asignaciones_horarias WHERE (periodo = ? OR (periodo IS NULL AND ? = 2027))", [periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    let cursosCompartidosIds: string[] | undefined = undefined;
    if (row[18]) {
      try {
        cursosCompartidosIds = JSON.parse(String(row[18]));
      } catch (_) {}
    }
    return {
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
      periodo: row[12] ? Number(row[12]) : 2027,
      esTallerSep: Boolean(row[13]),
      esProporcionDocente: Boolean(row[14]),
      esCoDocencia: Boolean(row[15]),
      esAgrupacionFlexible: Boolean(row[16]),
      esTrabajoColaborativo: Boolean(row[17]),
      cursosCompartidosIds,
      esDiferenciadoCompartido: Boolean(row[19]) || Boolean(cursosCompartidosIds && cursosCompartidosIds.length > 0),
      codigoAsignatura: row[20] ? String(row[20]) : undefined,
      ambitoCurricular: row[21] ? (String(row[21]) as any) : undefined
    };
  });
}

export async function guardarAsignacion(a: AsignacionHoraria, skipCloudSync: boolean = false): Promise<void> {
  const db = await getDb();
  const asigPeriodo = a.periodo || 2027;
  const cursosCompartidosJson = a.cursosCompartidosIds && a.cursosCompartidosIds.length > 0 
    ? JSON.stringify(a.cursosCompartidosIds) 
    : null;
  const esDiferenciado = a.esDiferenciadoCompartido || (a.cursosCompartidosIds && a.cursosCompartidosIds.length > 0) ? 1 : 0;

  db.run(`
    INSERT INTO asignaciones_horarias (
      id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec,
      asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo,
      periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo,
      cursos_compartidos_json, es_diferenciado_compartido, codigo_asignatura, ambito_curricular
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      es_trabajo_colaborativo=excluded.es_trabajo_colaborativo,
      cursos_compartidos_json=excluded.cursos_compartidos_json,
      es_diferenciado_compartido=excluded.es_diferenciado_compartido,
      codigo_asignatura=excluded.codigo_asignatura,
      ambito_curricular=excluded.ambito_curricular;
  `, [
    a.id, a.rbd, a.cursoId, a.docenteId, a.coDocenteId || null, a.tieneCoDocente ? 1 : 0, a.esTallerJec ? 1 : 0,
    a.asignatura, a.horasPedagogicasAula, a.horasCronologicasPie || 0, a.horasColaborativas || 0, a.tipoApoyo || null,
    asigPeriodo, a.esTallerSep ? 1 : 0, a.esProporcionDocente ? 1 : 0, a.esCoDocencia ? 1 : 0, a.esAgrupacionFlexible ? 1 : 0,
    a.esTrabajoColaborativo ? 1 : 0,
    cursosCompartidosJson, esDiferenciado,
    a.codigoAsignatura || null, a.ambitoCurricular || null
  ]);
  persistDb();
  if (!skipCloudSync) {
    SupabaseDotacionService.guardarAsignacion({ ...a, periodo: asigPeriodo }).catch(err =>
      console.warn('[asignacionesRepo] Aviso sincronizando con Supabase:', err)
    );
  }
}

export async function listarAsignacionesPorDocente(docenteId: string, rbd?: string, periodo: number = 2027): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  let sql = "SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo, cursos_compartidos_json, es_diferenciado_compartido, codigo_asignatura, ambito_curricular FROM asignaciones_horarias WHERE (docente_id = ? OR co_docente_id = ?) AND (periodo = ? OR (periodo IS NULL AND ? = 2027))";
  const params: any[] = [docenteId, docenteId, periodo, periodo];
  if (rbd) {
    sql += " AND rbd = ?";
    params.push(rbd);
  }
  const res = db.exec(sql, params);
  if (!res.length) return [];
  return res[0].values.map(row => {
    let cursosCompartidosIds: string[] | undefined = undefined;
    if (row[18]) {
      try {
        cursosCompartidosIds = JSON.parse(String(row[18]));
      } catch (_) {}
    }
    return {
      id: String(row[0]),
      rbd: String(row[1]),
      cursoId: String(row[2]),
      docenteId: String(row[3]),
      coDocenteId: row[4] ? String(row[4]) : undefined,
      tieneCoDocente: Boolean(row[5]),
      esTallerJec: Boolean(row[6]),
      asignatura: String(row[7]),
      horasPedagogicasAula: Number(row[8]),
      horasCronologicasPie: row[9] !== null && row[9] !== undefined ? Number(row[9]) : undefined,
      horasColaborativas: row[10] !== null && row[10] !== undefined ? Number(row[10]) : undefined,
      tipoApoyo: row[11] ? String(row[11]) : undefined,
      periodo: row[12] ? Number(row[12]) : 2027,
      esTallerSep: Boolean(row[13]),
      esProporcionDocente: Boolean(row[14]),
      esCoDocencia: Boolean(row[15]),
      esAgrupacionFlexible: Boolean(row[16]),
      esTrabajoColaborativo: Boolean(row[17]),
      cursosCompartidosIds,
      esDiferenciadoCompartido: Boolean(row[19]) || Boolean(cursosCompartidosIds && cursosCompartidosIds.length > 0),
      codigoAsignatura: row[20] ? String(row[20]) : undefined,
      ambitoCurricular: row[21] ? (String(row[21]) as any) : undefined
    };
  });
}

export async function guardarAsignacionesBatch(asignaciones: AsignacionHoraria[], skipCloudSync: boolean = false): Promise<void> {
  const db = await getDb();
  db.run("BEGIN TRANSACTION;");
  try {
    for (const a of asignaciones) {
      const asigPeriodo = a.periodo || 2027;
      const cursosCompartidosJson = a.cursosCompartidosIds && a.cursosCompartidosIds.length > 0 
        ? JSON.stringify(a.cursosCompartidosIds) 
        : null;
      const esDiferenciado = a.esDiferenciadoCompartido || (a.cursosCompartidosIds && a.cursosCompartidosIds.length > 0) ? 1 : 0;

      db.run(`
        INSERT INTO asignaciones_horarias (
          id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec,
          asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo,
          periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo,
          cursos_compartidos_json, es_diferenciado_compartido, codigo_asignatura, ambito_curricular
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          es_trabajo_colaborativo=excluded.es_trabajo_colaborativo,
          cursos_compartidos_json=excluded.cursos_compartidos_json,
          es_diferenciado_compartido=excluded.es_diferenciado_compartido,
          codigo_asignatura=excluded.codigo_asignatura,
          ambito_curricular=excluded.ambito_curricular;
      `, [
        a.id, a.rbd, a.cursoId, a.docenteId, a.coDocenteId || null, a.tieneCoDocente ? 1 : 0, a.esTallerJec ? 1 : 0,
        a.asignatura, a.horasPedagogicasAula, a.horasCronologicasPie || 0, a.horasColaborativas || 0, a.tipoApoyo || null,
        asigPeriodo, a.esTallerSep ? 1 : 0, a.esProporcionDocente ? 1 : 0, a.esCoDocencia ? 1 : 0, a.esAgrupacionFlexible ? 1 : 0,
        a.esTrabajoColaborativo ? 1 : 0,
        cursosCompartidosJson, esDiferenciado,
        a.codigoAsignatura || null, a.ambitoCurricular || null
      ]);
    }
    db.run("COMMIT;");
    persistDb();
    if (!skipCloudSync) {
      SupabaseDotacionService.guardarAsignacionesBatch(asignaciones).catch(err =>
        console.warn('[asignacionesRepo] Aviso sincronizando lote con Supabase:', err)
      );
    }
  } catch (err) {
    db.run("ROLLBACK;");
    throw err;
  }
}

export async function eliminarAsignacion(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM asignaciones_horarias WHERE id = ?", [id]);
  persistDb();
  SupabaseDotacionService.eliminarAsignacion(id).catch(err =>
    console.warn('[asignacionesRepo] Aviso eliminando en Supabase:', err)
  );
}

/**
 * Elimina todas las asignaciones horarias de un establecimiento para un periodo dado.
 */
export async function limpiarAsignacionesDeColegio(rbd: string, periodo: number = 2027): Promise<number> {
  const db = await getDb();
  const countBeforeRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))", [rbd, periodo, periodo]);
  const countBefore = countBeforeRes.length && countBeforeRes[0].values.length ? Number(countBeforeRes[0].values[0][0]) : 0;
  
  db.run("DELETE FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))", [rbd, periodo, periodo]);
  persistDb();
  SupabaseDotacionService.limpiarAsignacionesDeColegio(rbd, periodo).catch(err =>
    console.warn('[asignacionesRepo] Aviso limpiando asignaciones en Supabase:', err)
  );
  return countBefore;
}

/**
 * Purga asignaciones huérfanas (que apuntan a docentes o cursos que ya no existen en este colegio/periodo)
 * y consolida asignaciones exactamente duplicadas.
 */
export async function reconciliarYLimpiarAsignacionesEnDb(rbd: string, periodo: number = 2027): Promise<{ huerfanasEliminadas: number; duplicadasEliminadas: number }> {
  const db = await getDb();
  db.run("BEGIN TRANSACTION;");
  try {
    const countBeforeRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))", [rbd, periodo, periodo]);
    const countBefore = countBeforeRes.length && countBeforeRes[0].values.length ? Number(countBeforeRes[0].values[0][0]) : 0;

    // 1. Eliminar asignaciones huérfanas de docentes que no están en la nómina activa de este colegio
    db.run(`
      DELETE FROM asignaciones_horarias 
      WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
        AND docente_id != 'SIN_DOCENTE' AND docente_id != '' 
        AND docente_id NOT IN (
          SELECT id FROM docentes 
          WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
        )
    `, [rbd, periodo, periodo, rbd, periodo, periodo]);

    // 2. Desasociar co_docente_id huérfanos sin eliminar la asignatura del docente titular
    db.run(`
      UPDATE asignaciones_horarias
      SET co_docente_id = NULL, tiene_co_docente = 0
      WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
        AND co_docente_id IS NOT NULL AND co_docente_id != ''
        AND co_docente_id NOT IN (
          SELECT id FROM docentes 
          WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
        )
    `, [rbd, periodo, periodo, rbd, periodo, periodo]);

    // 3. Eliminar asignaciones huérfanas de cursos que ya no existen en este colegio
    db.run(`
      DELETE FROM asignaciones_horarias 
      WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
        AND curso_id != 'TRANSVERSAL' AND curso_id != 'SIN_CURSO'
        AND curso_id NOT IN (
          SELECT id FROM cursos_sae 
          WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
        )
    `, [rbd, periodo, periodo, rbd, periodo, periodo]);

    const countAfterHuerfanasRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))", [rbd, periodo, periodo]);
    const countAfterHuerfanas = countAfterHuerfanasRes.length && countAfterHuerfanasRes[0].values.length ? Number(countAfterHuerfanasRes[0].values[0][0]) : 0;
    const huerfanasEliminadas = Math.max(0, countBefore - countAfterHuerfanas);

    // 4. Deduplicar asignaciones preservando diferencias de co-docencia, talleres JEC/SEP y trabajo colaborativo
    db.run(`
      DELETE FROM asignaciones_horarias
      WHERE rowid NOT IN (
        SELECT MIN(rowid)
        FROM asignaciones_horarias
        WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))
        GROUP BY 
          curso_id, 
          docente_id, 
          COALESCE(co_docente_id, ''), 
          LOWER(TRIM(asignatura)), 
          COALESCE(tipo_apoyo, ''), 
          horas_pedagogicas_aula,
          COALESCE(es_taller_jec, 0),
          COALESCE(es_taller_sep, 0),
          COALESCE(es_co_docencia, 0),
          COALESCE(es_trabajo_colaborativo, 0)
      )
      AND rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027));
    `, [rbd, periodo, periodo, rbd, periodo, periodo]);

    const countFinalRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2027))", [rbd, periodo, periodo]);
    const countFinal = countFinalRes.length && countFinalRes[0].values.length ? Number(countFinalRes[0].values[0][0]) : 0;
    const duplicadasEliminadas = Math.max(0, countAfterHuerfanas - countFinal);

    db.run("COMMIT;");
    await persistDb(true);
    return { huerfanasEliminadas, duplicadasEliminadas };
  } catch (err) {
    db.run("ROLLBACK;");
    throw err;
  }
}