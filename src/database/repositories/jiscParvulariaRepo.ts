import {
  JiscNivelParvularia,
  JiscParvuloB3,
  SubtipoNivelJisc,
  TurnoParvulariaVtf,
} from '../../types';
import { getDb, persistDb } from '../dbCore';

function mapNivelRow(row: any[]): JiscNivelParvularia {
  return {
    id: String(row[0]),
    rbd: String(row[1]),
    periodo: Number(row[2] || 2027),
    codigoUeJunji: row[3] ? String(row[3]) : undefined,
    correlGrupo: Number(row[4] || 1),
    codPrograma: row[5] ? String(row[5]) : undefined,
    nivelNombre: String(row[6] || ''),
    subtipoNivel: (row[7] ? String(row[7]) : 'MEDIO_HETEROGENEO') as SubtipoNivelJisc,
    esHeterogeneo: Number(row[8] || 0) === 1,
    capacidadAutorizada: Number(row[9] || 0),
    matriculaActiva: Number(row[10] || 0),
    retiros: Number(row[11] || 0),
    asistenciaPromedio: Number(row[12] || 0),
    edadMesesMin: row[13] !== null && row[13] !== undefined ? Number(row[13]) : undefined,
    edadMesesMax: row[14] !== null && row[14] !== undefined ? Number(row[14]) : undefined,
    edadMinimaCriterio: row[15] !== null && row[15] !== undefined ? Number(row[15]) : undefined,
    jornada: (row[16] ? String(row[16]) : 'COMPLETA') as JiscNivelParvularia['jornada'],
    horarioInicio: row[17] ? String(row[17]) : '08:30',
    horarioFin: row[18] ? String(row[18]) : '16:30',
    tieneExtensionHoraria: Number(row[19] || 0) === 1,
    matriculaExtension: Number(row[20] || 0),
    educadorasAsignadasJisc: Number(row[21] || 0),
    tecnicosAsignadosJisc: Number(row[22] || 0),
    directorasAsignadasJisc: Number(row[23] || 0),
    fuenteDato: row[24] ? String(row[24]) : 'MANUAL',
    updatedAt: row[25] ? String(row[25]) : undefined,
  };
}

const NIVEL_SELECT_COLS = `
  id, rbd, periodo, codigo_ue_junji, correl_grupo, cod_programa,
  nivel_nombre, subtipo_nivel, es_heterogeneo, capacidad_autorizada,
  matricula_activa, retiros, asistencia_promedio, edad_meses_min,
  edad_meses_max, edad_minima_criterio, jornada, horario_inicio,
  horario_fin, tiene_extension_horaria, matricula_extension,
  educadoras_asignadas_jisc, tecnicos_asignados_jisc,
  directoras_asignadas_jisc, fuente_dato, updated_at
`;

export async function listarJiscNiveles(
  rbd: string,
  periodo: number = 2027
): Promise<JiscNivelParvularia[]> {
  const db = await getDb();
  const res = db.exec(
    `SELECT ${NIVEL_SELECT_COLS} FROM jisc_niveles_parvularia WHERE rbd = ? AND periodo = ? ORDER BY correl_grupo ASC`,
    [rbd, periodo]
  );
  if (!res.length) return [];
  return res[0].values.map(mapNivelRow);
}

export async function listarTodosJiscNiveles(
  periodo: number = 2027
): Promise<JiscNivelParvularia[]> {
  const db = await getDb();
  const res = db.exec(
    `SELECT ${NIVEL_SELECT_COLS} FROM jisc_niveles_parvularia WHERE periodo = ? ORDER BY rbd ASC, correl_grupo ASC`,
    [periodo]
  );
  if (!res.length) return [];
  return res[0].values.map(mapNivelRow);
}

export async function guardarJiscNivel(nivel: JiscNivelParvularia): Promise<void> {
  await guardarJiscNivelesBatch([nivel]);
}

export async function guardarJiscNivelesBatch(niveles: JiscNivelParvularia[]): Promise<void> {
  if (!niveles.length) return;
  const db = await getDb();
  const nowIso = new Date().toISOString();
  db.run('BEGIN TRANSACTION;');
  try {
    for (const n of niveles) {
      db.run(
        `
        INSERT INTO jisc_niveles_parvularia (
          id, rbd, periodo, codigo_ue_junji, correl_grupo, cod_programa,
          nivel_nombre, subtipo_nivel, es_heterogeneo, capacidad_autorizada,
          matricula_activa, retiros, asistencia_promedio, edad_meses_min,
          edad_meses_max, edad_minima_criterio, jornada, horario_inicio,
          horario_fin, tiene_extension_horaria, matricula_extension,
          educadoras_asignadas_jisc, tecnicos_asignados_jisc,
          directoras_asignadas_jisc, fuente_dato, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          codigo_ue_junji=excluded.codigo_ue_junji,
          correl_grupo=excluded.correl_grupo,
          cod_programa=excluded.cod_programa,
          nivel_nombre=excluded.nivel_nombre,
          subtipo_nivel=excluded.subtipo_nivel,
          es_heterogeneo=excluded.es_heterogeneo,
          capacidad_autorizada=excluded.capacidad_autorizada,
          matricula_activa=excluded.matricula_activa,
          retiros=excluded.retiros,
          asistencia_promedio=excluded.asistencia_promedio,
          edad_meses_min=excluded.edad_meses_min,
          edad_meses_max=excluded.edad_meses_max,
          edad_minima_criterio=excluded.edad_minima_criterio,
          jornada=excluded.jornada,
          horario_inicio=excluded.horario_inicio,
          horario_fin=excluded.horario_fin,
          tiene_extension_horaria=excluded.tiene_extension_horaria,
          matricula_extension=excluded.matricula_extension,
          educadoras_asignadas_jisc=excluded.educadoras_asignadas_jisc,
          tecnicos_asignados_jisc=excluded.tecnicos_asignados_jisc,
          directoras_asignadas_jisc=excluded.directoras_asignadas_jisc,
          fuente_dato=excluded.fuente_dato,
          updated_at=excluded.updated_at;
        `,
        [
          n.id,
          n.rbd,
          n.periodo || 2027,
          n.codigoUeJunji || null,
          n.correlGrupo,
          n.codPrograma || null,
          n.nivelNombre,
          n.subtipoNivel,
          n.esHeterogeneo ? 1 : 0,
          n.capacidadAutorizada || 0,
          n.matriculaActiva || 0,
          n.retiros || 0,
          n.asistenciaPromedio || 0,
          n.edadMesesMin ?? null,
          n.edadMesesMax ?? null,
          n.edadMinimaCriterio ?? null,
          n.jornada || 'COMPLETA',
          n.horarioInicio || '08:30',
          n.horarioFin || '16:30',
          n.tieneExtensionHoraria ? 1 : 0,
          n.matriculaExtension || 0,
          n.educadorasAsignadasJisc || 0,
          n.tecnicosAsignadosJisc || 0,
          n.directorasAsignadasJisc || 0,
          n.fuenteDato || 'MANUAL',
          n.updatedAt || nowIso,
        ]
      );
    }
    db.run('COMMIT;');
    persistDb();
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}

export async function eliminarJiscNivel(id: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM jisc_niveles_parvularia WHERE id = ?', [id]);
  persistDb();
}

export async function listarTurnosVtf(
  rbd: string,
  periodo: number = 2027
): Promise<TurnoParvulariaVtf[]> {
  const db = await getDb();
  const res = db.exec(
    `SELECT id, rbd, periodo, nivel_jisc_id, run_funcionario, nombre_funcionario,
            estamento_vtf, dias_semana, hora_entrada, hora_salida, minutos_colacion,
            franja, horas_semanales_cronologicas, observaciones, updated_at
     FROM jisc_turnos_personal
     WHERE rbd = ? AND periodo = ?
     ORDER BY hora_entrada ASC, nombre_funcionario ASC`,
    [rbd, periodo]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    id: String(row[0]),
    rbd: String(row[1]),
    periodo: Number(row[2] || 2027),
    nivelJiscId: row[3] ? String(row[3]) : undefined,
    runFuncionario: String(row[4] || ''),
    nombreFuncionario: row[5] ? String(row[5]) : undefined,
    estamentoVtf: String(row[6] || 'TECNICO') as TurnoParvulariaVtf['estamentoVtf'],
    diasSemana: row[7] ? String(row[7]) : 'L-V',
    horaEntrada: String(row[8] || '08:30'),
    horaSalida: String(row[9] || '17:30'),
    minutosColacion: Number(row[10] ?? 45),
    franja: String(row[11] || 'REGULAR') as TurnoParvulariaVtf['franja'],
    horasSemanalesCronologicas: Number(row[12] ?? 44),
    observaciones: row[13] ? String(row[13]) : undefined,
    updatedAt: row[14] ? String(row[14]) : undefined,
  }));
}

export async function guardarTurnosVtfBatch(turnos: TurnoParvulariaVtf[]): Promise<void> {
  if (!turnos.length) return;
  const db = await getDb();
  const nowIso = new Date().toISOString();
  db.run('BEGIN TRANSACTION;');
  try {
    for (const t of turnos) {
      db.run(
        `
        INSERT INTO jisc_turnos_personal (
          id, rbd, periodo, nivel_jisc_id, run_funcionario, nombre_funcionario,
          estamento_vtf, dias_semana, hora_entrada, hora_salida, minutos_colacion,
          franja, horas_semanales_cronologicas, observaciones, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          nivel_jisc_id=excluded.nivel_jisc_id,
          run_funcionario=excluded.run_funcionario,
          nombre_funcionario=excluded.nombre_funcionario,
          estamento_vtf=excluded.estamento_vtf,
          dias_semana=excluded.dias_semana,
          hora_entrada=excluded.hora_entrada,
          hora_salida=excluded.hora_salida,
          minutos_colacion=excluded.minutos_colacion,
          franja=excluded.franja,
          horas_semanales_cronologicas=excluded.horas_semanales_cronologicas,
          observaciones=excluded.observaciones,
          updated_at=excluded.updated_at;
        `,
        [
          t.id,
          t.rbd,
          t.periodo || 2027,
          t.nivelJiscId || null,
          t.runFuncionario,
          t.nombreFuncionario || null,
          t.estamentoVtf,
          t.diasSemana || 'L-V',
          t.horaEntrada,
          t.horaSalida,
          t.minutosColacion ?? 45,
          t.franja || 'REGULAR',
          t.horasSemanalesCronologicas ?? 44,
          t.observaciones || null,
          t.updatedAt || nowIso,
        ]
      );
    }
    db.run('COMMIT;');
    persistDb();
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}

export async function eliminarTurnoVtf(id: string): Promise<void> {
  const db = await getDb();
  db.run('DELETE FROM jisc_turnos_personal WHERE id = ?', [id]);
  persistDb();
}

export async function listarParvulosB3(
  rbd: string,
  periodo: number = 2027
): Promise<JiscParvuloB3[]> {
  const db = await getDb();
  const res = db.exec(
    `SELECT id, rbd, periodo, codigo_ue_junji, correl_grupo, desc_nivel,
            rut_parvulo, edad_meses, fecha_nacimiento, fecha_ingreso, fecha_retiro,
            activo, presentes_mes, dias_trabajados_mes, porcentaje_asistencia,
            requiere_nee, updated_at
     FROM jisc_parvulos_b3
     WHERE rbd = ? AND periodo = ?
     ORDER BY correl_grupo ASC, edad_meses ASC`,
    [rbd, periodo]
  );
  if (!res.length) return [];
  return res[0].values.map((row) => ({
    id: String(row[0]),
    rbd: String(row[1]),
    periodo: Number(row[2] || 2027),
    codigoUeJunji: row[3] ? String(row[3]) : undefined,
    correlGrupo: Number(row[4] || 1),
    descNivel: String(row[5] || ''),
    rutParvulo: row[6] ? String(row[6]) : undefined,
    edadMeses: Number(row[7] || 0),
    fechaNacimiento: row[8] ? String(row[8]) : undefined,
    fechaIngreso: row[9] ? String(row[9]) : undefined,
    fechaRetiro: row[10] ? String(row[10]) : undefined,
    activo: Number(row[11] ?? 1) === 1,
    presentesMes: Number(row[12] || 0),
    diasTrabajadosMes: Number(row[13] || 0),
    porcentajeAsistencia: Number(row[14] || 0),
    requiereNee: Number(row[15] || 0) === 1,
    updatedAt: row[16] ? String(row[16]) : undefined,
  }));
}

export async function guardarParvulosB3Batch(
  registros: JiscParvuloB3[],
  reemplazarPorRbdPeriodo?: { rbd: string; periodo: number }
): Promise<void> {
  if (!registros.length && !reemplazarPorRbdPeriodo) return;
  const db = await getDb();
  const nowIso = new Date().toISOString();
  db.run('BEGIN TRANSACTION;');
  try {
    if (reemplazarPorRbdPeriodo) {
      db.run('DELETE FROM jisc_parvulos_b3 WHERE rbd = ? AND periodo = ?', [
        reemplazarPorRbdPeriodo.rbd,
        reemplazarPorRbdPeriodo.periodo,
      ]);
    }
    const stmt = db.prepare(`
      INSERT INTO jisc_parvulos_b3 (
        id, rbd, periodo, codigo_ue_junji, correl_grupo, desc_nivel,
        rut_parvulo, edad_meses, fecha_nacimiento, fecha_ingreso, fecha_retiro,
        activo, presentes_mes, dias_trabajados_mes, porcentaje_asistencia,
        requiere_nee, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        codigo_ue_junji=excluded.codigo_ue_junji,
        correl_grupo=excluded.correl_grupo,
        desc_nivel=excluded.desc_nivel,
        rut_parvulo=excluded.rut_parvulo,
        edad_meses=excluded.edad_meses,
        fecha_nacimiento=excluded.fecha_nacimiento,
        fecha_ingreso=excluded.fecha_ingreso,
        fecha_retiro=excluded.fecha_retiro,
        activo=excluded.activo,
        presentes_mes=excluded.presentes_mes,
        dias_trabajados_mes=excluded.dias_trabajados_mes,
        porcentaje_asistencia=excluded.porcentaje_asistencia,
        requiere_nee=excluded.requiere_nee,
        updated_at=excluded.updated_at;
    `);
    try {
      for (const r of registros) {
        stmt.run([
          r.id,
          r.rbd,
          r.periodo || 2027,
          r.codigoUeJunji || null,
          r.correlGrupo,
          r.descNivel,
          r.rutParvulo || null,
          r.edadMeses,
          r.fechaNacimiento || null,
          r.fechaIngreso || null,
          r.fechaRetiro || null,
          r.activo ? 1 : 0,
          r.presentesMes || 0,
          r.diasTrabajadosMes || 0,
          r.porcentajeAsistencia || 0,
          r.requiereNee ? 1 : 0,
          r.updatedAt || nowIso,
        ]);
      }
    } finally {
      stmt.free();
    }
    db.run('COMMIT;');
    persistDb();
  } catch (err) {
    db.run('ROLLBACK;');
    throw err;
  }
}
