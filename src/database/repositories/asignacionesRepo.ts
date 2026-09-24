import { AsignacionHoraria } from '../../types';
import { getDb, persistDb } from '../dbCore';

export async function listarAsignaciones(rbd: string, periodo: number = 2026): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => ({
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
    periodo: row[12] ? Number(row[12]) : 2026,
    esTallerSep: Boolean(row[13]),
    esProporcionDocente: Boolean(row[14]),
    esCoDocencia: Boolean(row[15]),
    esAgrupacionFlexible: Boolean(row[16]),
    esTrabajoColaborativo: Boolean(row[17]),
  }));
}

export async function listarTodasLasAsignaciones(periodo: number = 2026): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo FROM asignaciones_horarias WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026))", [periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => ({
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
    periodo: row[12] ? Number(row[12]) : 2026,
    esTallerSep: Boolean(row[13]),
    esProporcionDocente: Boolean(row[14]),
    esCoDocencia: Boolean(row[15]),
    esAgrupacionFlexible: Boolean(row[16]),
    esTrabajoColaborativo: Boolean(row[17]),
  }));
}

export async function guardarAsignacion(a: AsignacionHoraria): Promise<void> {
  const db = await getDb();
  const asigPeriodo = a.periodo || 2026;
  db.run(`
    INSERT INTO asignaciones_horarias (
      id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec,
      asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo,
      periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      es_trabajo_colaborativo=excluded.es_trabajo_colaborativo;
  `, [
    a.id, a.rbd, a.cursoId, a.docenteId, a.coDocenteId || null, a.tieneCoDocente ? 1 : 0, a.esTallerJec ? 1 : 0,
    a.asignatura, a.horasPedagogicasAula, a.horasCronologicasPie || 0, a.horasColaborativas || 0, a.tipoApoyo || null,
    asigPeriodo, a.esTallerSep ? 1 : 0, a.esProporcionDocente ? 1 : 0, a.esCoDocencia ? 1 : 0, a.esAgrupacionFlexible ? 1 : 0,
    a.esTrabajoColaborativo ? 1 : 0
  ]);
  persistDb();
}

export async function listarAsignacionesPorDocente(docenteId: string, rbd?: string, periodo: number = 2026): Promise<AsignacionHoraria[]> {
  const db = await getDb();
  let sql = "SELECT id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec, asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo, periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo FROM asignaciones_horarias WHERE (docente_id = ? OR co_docente_id = ?) AND (periodo = ? OR (periodo IS NULL AND ? = 2026))";
  const params: any[] = [docenteId, docenteId, periodo, periodo];
  if (rbd) {
    sql += " AND rbd = ?";
    params.push(rbd);
  }
  const res = db.exec(sql, params);
  if (!res.length) return [];
  return res[0].values.map(row => ({
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
    periodo: row[12] ? Number(row[12]) : 2026,
    esTallerSep: Boolean(row[13]),
    esProporcionDocente: Boolean(row[14]),
    esCoDocencia: Boolean(row[15]),
    esAgrupacionFlexible: Boolean(row[16]),
    esTrabajoColaborativo: Boolean(row[17]),
  }));
}

export async function guardarAsignacionesBatch(asignaciones: AsignacionHoraria[]): Promise<void> {
  const db = await getDb();
  db.run("BEGIN TRANSACTION;");
  try {
    for (const a of asignaciones) {
      const asigPeriodo = a.periodo || 2026;
      db.run(`
        INSERT INTO asignaciones_horarias (
          id, rbd, curso_id, docente_id, co_docente_id, tiene_co_docente, es_taller_jec,
          asignatura, horas_pedagogicas_aula, horas_cronologicas_pie, horas_colaborativas, tipo_apoyo,
          periodo, es_taller_sep, es_proporcion_docente, es_co_docencia, es_agrupacion_flexible, es_trabajo_colaborativo
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          es_trabajo_colaborativo=excluded.es_trabajo_colaborativo;
      `, [
        a.id, a.rbd, a.cursoId, a.docenteId, a.coDocenteId || null, a.tieneCoDocente ? 1 : 0, a.esTallerJec ? 1 : 0,
        a.asignatura, a.horasPedagogicasAula, a.horasCronologicasPie || 0, a.horasColaborativas || 0, a.tipoApoyo || null,
        asigPeriodo, a.esTallerSep ? 1 : 0, a.esProporcionDocente ? 1 : 0, a.esCoDocencia ? 1 : 0, a.esAgrupacionFlexible ? 1 : 0,
        a.esTrabajoColaborativo ? 1 : 0
      ]);
    }
    db.run("COMMIT;");
    persistDb();
  } catch (err) {
    db.run("ROLLBACK;");
    throw err;
  }
}

export async function eliminarAsignacion(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM asignaciones_horarias WHERE id = ?", [id]);
  persistDb();
}

/**
 * Elimina todas las asignaciones horarias de un establecimiento para un periodo dado.
 */
export async function limpiarAsignacionesDeColegio(rbd: string, periodo: number = 2026): Promise<number> {
  const db = await getDb();
  const countBeforeRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
  const countBefore = countBeforeRes.length && countBeforeRes[0].values.length ? Number(countBeforeRes[0].values[0][0]) : 0;
  
  db.run("DELETE FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
  persistDb();
  return countBefore;
}

/**
 * Purga asignaciones huérfanas (que apuntan a docentes o cursos que ya no existen en este colegio/periodo)
 * y consolida asignaciones exactamente duplicadas.
 */
export async function reconciliarYLimpiarAsignacionesEnDb(rbd: string, periodo: number = 2026): Promise<{ huerfanasEliminadas: number; duplicadasEliminadas: number }> {
  const db = await getDb();
  const countBeforeRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
  const countBefore = countBeforeRes.length && countBeforeRes[0].values.length ? Number(countBeforeRes[0].values[0][0]) : 0;

  // 1. Eliminar asignaciones huérfanas de docentes que no están en la nómina activa de este colegio
  db.run(`
    DELETE FROM asignaciones_horarias 
    WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))
      AND docente_id != 'SIN_DOCENTE' AND docente_id != '' 
      AND docente_id NOT IN (
        SELECT id FROM docentes 
        WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))
      )
  `, [rbd, periodo, periodo, rbd, periodo, periodo]);

  // 2. Eliminar asignaciones huérfanas de cursos que ya no existen en este colegio
  db.run(`
    DELETE FROM asignaciones_horarias 
    WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))
      AND curso_id != 'TRANSVERSAL' AND curso_id != 'SIN_CURSO'
      AND curso_id NOT IN (
        SELECT id FROM cursos_sae 
        WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))
      )
  `, [rbd, periodo, periodo, rbd, periodo, periodo]);

  const countAfterHuerfanasRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
  const countAfterHuerfanas = countAfterHuerfanasRes.length && countAfterHuerfanasRes[0].values.length ? Number(countAfterHuerfanasRes[0].values[0][0]) : 0;
  const huerfanasEliminadas = Math.max(0, countBefore - countAfterHuerfanas);

  // 3. Deduplicar asignaciones idénticas (mismo curso, docente, asignatura, tipo de apoyo y horas)
  db.run(`
    DELETE FROM asignaciones_horarias
    WHERE id NOT IN (
      SELECT MIN(id)
      FROM asignaciones_horarias
      WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))
      GROUP BY curso_id, docente_id, asignatura, COALESCE(tipo_apoyo, ''), horas_pedagogicas_aula
    )
    AND rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026));
  `, [rbd, periodo, periodo, rbd, periodo, periodo]);

  const countFinalRes = db.exec("SELECT COUNT(*) FROM asignaciones_horarias WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026))", [rbd, periodo, periodo]);
  const countFinal = countFinalRes.length && countFinalRes[0].values.length ? Number(countFinalRes[0].values[0][0]) : 0;
  const duplicadasEliminadas = Math.max(0, countAfterHuerfanas - countFinal);

  persistDb();
  return { huerfanasEliminadas, duplicadasEliminadas };
}