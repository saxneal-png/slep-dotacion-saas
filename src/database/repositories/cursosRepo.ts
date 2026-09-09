import { CursoSae } from '../../types';
import { getDb, persistDb } from '../dbCore';

export async function listarCursos(rbd: string, periodo: number = 2026): Promise<CursoSae[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep, talleres_jec_json, periodo, regimen_proporcion, es_multigrado, es_combinado, tipo_modalidad, grados_combinados_json FROM cursos_sae WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026)) ORDER BY nivel, letra", [rbd, periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    let talleresJec = undefined;
    if (row[10]) {
      try { talleresJec = JSON.parse(String(row[10])); } catch (_) {}
    }
    let gradosCombinados = undefined;
    if (row[16]) {
      try { gradosCombinados = JSON.parse(String(row[16])); } catch (_) {}
    }
    const nivelStr = String(row[2]);
    const esMulti = Boolean(row[13]) || nivelStr.toLowerCase().includes('multigrado');
    const esComb = Boolean(row[14]) || nivelStr.toLowerCase().includes('combinado');
    return {
      id: String(row[0]),
      rbd: String(row[1]),
      nivel: nivelStr,
      letra: String(row[3]),
      regimen: row[4] as any,
      salaId: row[5] ? String(row[5]) : undefined,
      cupoSae: Number(row[6]),
      matriculaProyectada: Number(row[7]),
      alumnosNeet: Number(row[8]),
      alumnosNeep: Number(row[9]),
      talleresJec,
      periodo: row[11] ? Number(row[11]) : 2026,
      regimenProporcion: (row[12] as any) || '65_35',
      esMultigrado: esMulti,
      esCombinado: esComb,
      tipoModalidad: (row[15] as any) || (esMulti ? 'MULTIGRADO' : esComb ? 'COMBINADO' : 'REGULAR'),
      gradosCombinados
    };
  });
}

export async function listarTodosLosCursos(periodo: number = 2026): Promise<CursoSae[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep, talleres_jec_json, periodo, regimen_proporcion, es_multigrado, es_combinado, tipo_modalidad, grados_combinados_json FROM cursos_sae WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026)) ORDER BY rbd, nivel, letra", [periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    let talleresJec = undefined;
    if (row[10]) {
      try { talleresJec = JSON.parse(String(row[10])); } catch (_) {}
    }
    let gradosCombinados = undefined;
    if (row[16]) {
      try { gradosCombinados = JSON.parse(String(row[16])); } catch (_) {}
    }
    const nivelStr = String(row[2]);
    const esMulti = Boolean(row[13]) || nivelStr.toLowerCase().includes('multigrado');
    const esComb = Boolean(row[14]) || nivelStr.toLowerCase().includes('combinado');
    return {
      id: String(row[0]),
      rbd: String(row[1]),
      nivel: nivelStr,
      letra: String(row[3]),
      regimen: row[4] as any,
      salaId: row[5] ? String(row[5]) : undefined,
      cupoSae: Number(row[6]),
      matriculaProyectada: Number(row[7]),
      alumnosNeet: Number(row[8]),
      alumnosNeep: Number(row[9]),
      talleresJec,
      periodo: row[11] ? Number(row[11]) : 2026,
      regimenProporcion: (row[12] as any) || '65_35',
      esMultigrado: esMulti,
      esCombinado: esComb,
      tipoModalidad: (row[15] as any) || (esMulti ? 'MULTIGRADO' : esComb ? 'COMBINADO' : 'REGULAR'),
      gradosCombinados
    };
  });
}

export async function guardarCurso(c: CursoSae): Promise<void> {
  const db = await getDb();
  const talleresJson = c.talleresJec && c.talleresJec.length ? JSON.stringify(c.talleresJec) : null;
  const gradosJson = c.gradosCombinados && c.gradosCombinados.length ? JSON.stringify(c.gradosCombinados) : null;
  const cursoPeriodo = c.periodo || 2026;
  const regProp = c.regimenProporcion || '65_35';
  const esMulti = c.esMultigrado ? 1 : 0;
  const esComb = c.esCombinado ? 1 : 0;
  const tipoMod = c.tipoModalidad || (c.esMultigrado ? 'MULTIGRADO' : c.esCombinado ? 'COMBINADO' : 'REGULAR');
  db.run(`
    INSERT INTO cursos_sae (id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep, talleres_jec_json, periodo, regimen_proporcion, es_multigrado, es_combinado, tipo_modalidad, grados_combinados_json)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rbd=excluded.rbd, nivel=excluded.nivel, letra=excluded.letra, regimen=excluded.regimen,
      sala_id=excluded.sala_id, cupo_sae=excluded.cupo_sae,
      matricula_proyectada=excluded.matricula_proyectada,
      alumnos_neet=excluded.alumnos_neet, alumnos_neep=excluded.alumnos_neep,
      talleres_jec_json=excluded.talleres_jec_json,
      periodo=excluded.periodo,
      regimen_proporcion=excluded.regimen_proporcion,
      es_multigrado=excluded.es_multigrado,
      es_combinado=excluded.es_combinado,
      tipo_modalidad=excluded.tipo_modalidad,
      grados_combinados_json=excluded.grados_combinados_json;
  `, [c.id, c.rbd, c.nivel, c.letra, c.regimen, c.salaId || null, c.cupoSae, c.matriculaProyectada, c.alumnosNeet, c.alumnosNeep, talleresJson, cursoPeriodo, regProp, esMulti, esComb, tipoMod, gradosJson]);
  persistDb();
}

export async function eliminarCurso(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM cursos_sae WHERE id = ?", [id]);
  persistDb();
}