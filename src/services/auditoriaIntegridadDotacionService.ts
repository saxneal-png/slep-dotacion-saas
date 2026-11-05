import { getDb, persistDb } from '../database/dbCore';
import { Docente, AsignacionHoraria, CursoSae } from '../types';
import { listarDocentes, guardarDocente } from '../database/repositories/docentesRepo';
import { listarAsignaciones } from '../database/repositories/asignacionesRepo';
import { listarCursos } from '../database/repositories/cursosRepo';
import { normalizarRut, limpiarRutParaId } from '../utils/rutUtils';
import { supabase, isSupabaseEnabled } from './supabaseClient';
import { normalizarNombreAsignatura, sonAsignaturasEquivalentes } from '../components/DocenteAsignacionPanel';

export interface GrupoDocenteDuplicado {
  cleanRun: string;
  runFormateado: string;
  nombres: string;
  apellidos: string;
  docenteIds: string[];
  docenteCanonicoId: string;
}

export interface AsignacionHuerfanaInfo {
  asignacionId: string;
  docenteIdInexistente: string;
  cursoId: string;
  asignatura: string;
  horas: number;
  docenteRecuperadoId?: string;
  docenteRecuperadoNombre?: string;
  esRecuperable: boolean;
}

export interface AsignacionDuplicadaInfo {
  cursoId: string;
  cursoNivel: string;
  docenteId: string;
  docenteNombre: string;
  asignatura: string;
  asignacionesIds: string[];
  horasTotalInfladas: number;
  horasValidasReales: number;
  horasExcesoPurgables: number;
}

export interface ReporteIntegridadColegio {
  rbd: string;
  periodo: number;
  totalDocentes: number;
  totalAsignaciones: number;
  totalCursos: number;
  docentesDuplicados: GrupoDocenteDuplicado[];
  asignacionesHuerfanas: AsignacionHuerfanaInfo[];
  asignacionesDuplicadas: AsignacionDuplicadaInfo[];
  horasTotalesInfladas: number;
  hayInconsistencias: boolean;
}

export interface ResultadoReparacionIntegridad {
  docentesFusionados: number;
  asignacionesHuerfanasReasignadas: number;
  asignacionesHuerfanasEliminadas: number;
  asignacionesDuplicadasEliminadas: number;
  horasRecuperadas: number;
  alertas: string[];
}

/**
 * Inspecciona y audita la base de datos local en busca de asignaciones duplicadas,
 * asignaciones huérfanas y docentes clonados con diferente formato de RUN o ID.
 */
export async function auditarIntegridadColegio(
  rbd: string,
  periodo: number = 2027
): Promise<ReporteIntegridadColegio> {
  const cleanRbd = rbd.trim();
  const docentes = await listarDocentes(cleanRbd, periodo);
  const asignaciones = await listarAsignaciones(cleanRbd, periodo);
  const cursos = await listarCursos(cleanRbd, periodo);

  const cursoMap = new Map<string, CursoSae>();
  for (const c of cursos) cursoMap.set(c.id, c);

  // 1. Detección de Docentes Duplicados (mismo cleanRun, diferentes IDs)
  const docentesPorRun = new Map<string, Docente[]>();
  for (const d of docentes) {
    const cleanRun = limpiarRutParaId(d.run);
    if (!cleanRun) continue;
    const arr = docentesPorRun.get(cleanRun) || [];
    arr.push(d);
    docentesPorRun.set(cleanRun, arr);
  }

  const docentesDuplicados: GrupoDocenteDuplicado[] = [];
  const runToDocenteCanonico = new Map<string, Docente>();
  const idToDocenteCanonico = new Map<string, Docente>();

  for (const [cleanRun, lista] of docentesPorRun.entries()) {
    // Escoger el docente canónico: preferir el que tenga id con formato estándar `doc_${cleanRbd}_${periodo}_${cleanRun}`
    // o el que tenga mayor carga horaria / datos completos
    const canonico = lista.find(d => d.id === `doc_${cleanRbd}_${periodo}_${cleanRun}`) ||
      [...lista].sort((a, b) => (b.horasContrato || 0) - (a.horasContrato || 0))[0];

    runToDocenteCanonico.set(cleanRun, canonico);
    for (const d of lista) {
      idToDocenteCanonico.set(d.id, canonico);
    }

    if (lista.length > 1) {
      docentesDuplicados.push({
        cleanRun,
        runFormateado: normalizarRut(canonico.run) || canonico.run,
        nombres: canonico.nombres,
        apellidos: canonico.apellidos,
        docenteIds: lista.map(d => d.id),
        docenteCanonicoId: canonico.id
      });
    }
  }

  // Mapa de docentes existentes por ID
  const docentePorId = new Map<string, Docente>();
  for (const d of docentes) docentePorId.set(d.id, d);

  // 2. Detección de Asignaciones Huérfanas
  const asignacionesHuerfanas: AsignacionHuerfanaInfo[] = [];
  for (const a of asignaciones) {
    if (!a.docenteId) continue;
    if (!docentePorId.has(a.docenteId)) {
      // Intentar extraer el RUN del docenteId huérfano (ej: doc_3677_2027_167345239 o asig_..._16734523-9_...)
      let runExtraido = '';
      const matchDoc = a.docenteId.match(/(?:doc_[^_]+_[^_]+_)?([0-9kK]{7,10})/i);
      if (matchDoc) {
        runExtraido = limpiarRutParaId(matchDoc[1]);
      } else {
        const matchAsig = a.id.match(/([0-9kK]{7,10})/i);
        if (matchAsig) runExtraido = limpiarRutParaId(matchAsig[1]);
      }

      const docenteRecuperado = runExtraido ? runToDocenteCanonico.get(runExtraido) : undefined;

      asignacionesHuerfanas.push({
        asignacionId: a.id,
        docenteIdInexistente: a.docenteId,
        cursoId: a.cursoId,
        asignatura: a.asignatura,
        horas: a.horasPedagogicasAula || a.horasCronologicasPie || 0,
        docenteRecuperadoId: docenteRecuperado?.id,
        docenteRecuperadoNombre: docenteRecuperado ? `${docenteRecuperado.nombres} ${docenteRecuperado.apellidos}` : undefined,
        esRecuperable: Boolean(docenteRecuperado)
      });
    }
  }

  // 3. Detección de Asignaciones Duplicadas / Infladas en Curso
  // Agrupamos por (cursoId, cleanRunDocente, asignaturaNormalizada)
  const gruposAsignaciones = new Map<string, AsignacionHoraria[]>();
  for (const a of asignaciones) {
    // Resolver al docente canónico si es posible (incluyendo huérfanas recuperables por RUN)
    let docCanon = idToDocenteCanonico.get(a.docenteId);
    if (!docCanon) {
      let runExtraido = '';
      const matchDoc = a.docenteId?.match(/(?:doc_[^_]+_[^_]+_)?([0-9kK]{7,10})/i);
      if (matchDoc) {
        runExtraido = limpiarRutParaId(matchDoc[1]);
      } else {
        const matchAsig = a.id?.match(/([0-9kK]{7,10})/i);
        if (matchAsig) runExtraido = limpiarRutParaId(matchAsig[1]);
      }
      if (runExtraido) {
        docCanon = runToDocenteCanonico.get(runExtraido);
      }
    }

    const cleanRun = docCanon ? limpiarRutParaId(docCanon.run) : (a.docenteId || 'SIN_DOCENTE');
    const asigNorm = normalizarNombreAsignatura(a.asignatura);
    const claveGrupo = `${a.cursoId}__${cleanRun}__${asigNorm}`;

    const arr = gruposAsignaciones.get(claveGrupo) || [];
    arr.push(a);
    gruposAsignaciones.set(claveGrupo, arr);
  }

  const asignacionesDuplicadas: AsignacionDuplicadaInfo[] = [];
  let horasTotalesInfladas = 0;

  for (const [clave, lista] of gruposAsignaciones.entries()) {
    if (lista.length <= 1) continue;

    // Si todas tienen la misma modalidad de aula regular (excluyendo co-docencias válidas que se sumen intencionalmente)
    const aulaRegular = lista.filter(a => !a.esCoDocencia && !a.esAgrupacionFlexible);
    if (aulaRegular.length > 1) {
      const c = cursoMap.get(aulaRegular[0].cursoId);
      const doc = idToDocenteCanonico.get(aulaRegular[0].docenteId) || docentePorId.get(aulaRegular[0].docenteId);
      
      const horasTotal = aulaRegular.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
      // Las horas válidas de una asignatura duplicada corresponden habitualmente al valor de una sola de las instancias
      const horasValidas = Math.max(...aulaRegular.map(a => a.horasPedagogicasAula || 0));
      const exceso = horasTotal - horasValidas;

      if (exceso > 0) {
        horasTotalesInfladas += exceso;
        asignacionesDuplicadas.push({
          cursoId: aulaRegular[0].cursoId,
          cursoNivel: c ? `${c.nivel} ${c.letra}` : aulaRegular[0].cursoId,
          docenteId: doc ? doc.id : aulaRegular[0].docenteId,
          docenteNombre: doc ? `${doc.nombres} ${doc.apellidos}` : 'Docente Desconocido',
          asignatura: aulaRegular[0].asignatura,
          asignacionesIds: aulaRegular.map(a => a.id),
          horasTotalInfladas: horasTotal,
          horasValidasReales: horasValidas,
          horasExcesoPurgables: exceso
        });
      }
    }
  }

  const hayInconsistencias = docentesDuplicados.length > 0 ||
    asignacionesHuerfanas.length > 0 ||
    asignacionesDuplicadas.length > 0;

  return {
    rbd: cleanRbd,
    periodo,
    totalDocentes: docentes.length,
    totalAsignaciones: asignaciones.length,
    totalCursos: cursos.length,
    docentesDuplicados,
    asignacionesHuerfanas,
    asignacionesDuplicadas,
    horasTotalesInfladas,
    hayInconsistencias
  };
}

/**
 * Ejecuta la reparación integral y atómica del colegio:
 * 1. Fusiona docentes duplicados bajo su ID canónico.
 * 2. Reasigna asignaciones huérfanas al docente real.
 * 3. Purga asignaciones duplicadas/infladas dejando únicamente la original válida.
 * 4. Reconcilia y elimina registros sobrantes en SQLite y en Supabase.
 */
export async function repararIntegridadColegio(
  rbd: string,
  periodo: number = 2027
): Promise<ResultadoReparacionIntegridad> {
  const cleanRbd = rbd.trim();
  const auditoria = await auditarIntegridadColegio(cleanRbd, periodo);
  const db = await getDb();
  const alertas: string[] = [];

  let docentesFusionados = 0;
  let asignacionesHuerfanasReasignadas = 0;
  let asignacionesHuerfanasEliminadas = 0;
  let asignacionesDuplicadasEliminadas = 0;
  let horasRecuperadas = auditoria.horasTotalesInfladas;

  const idsAsignacionesAEliminarRemoto: string[] = [];
  const idsDocentesAEliminarRemoto: string[] = [];

  db.run("BEGIN TRANSACTION;");

  try {
    // -------------------------------------------------------------------------
    // PASO 1: Unificar Docentes Duplicados
    // -------------------------------------------------------------------------
    for (const dup of auditoria.docentesDuplicados) {
      const canonId = dup.docenteCanonicoId;
      const idsSecundarios = dup.docenteIds.filter(id => id !== canonId);

      for (const idSec of idsSecundarios) {
        // Reasignar FKs en asignaciones_horarias
        db.run(
          "UPDATE asignaciones_horarias SET docente_id = ? WHERE docente_id = ? AND rbd = ? AND periodo = ?",
          [canonId, idSec, cleanRbd, periodo]
        );
        db.run(
          "UPDATE asignaciones_horarias SET co_docente_id = ? WHERE co_docente_id = ? AND rbd = ? AND periodo = ?",
          [canonId, idSec, cleanRbd, periodo]
        );

        // Eliminar docente secundario clonado
        db.run("DELETE FROM docentes WHERE id = ? AND rbd = ? AND periodo = ?", [idSec, cleanRbd, periodo]);
        idsDocentesAEliminarRemoto.push(idSec);
        docentesFusionados++;
      }

      // Asegurar que el docente canónico tenga su RUN normalizado
      db.run(
        "UPDATE docentes SET run = ? WHERE id = ? AND rbd = ? AND periodo = ?",
        [dup.runFormateado, canonId, cleanRbd, periodo]
      );
    }

    // -------------------------------------------------------------------------
    // PASO 2: Rescatar o Purgar Asignaciones Huérfanas
    // -------------------------------------------------------------------------
    for (const huerf of auditoria.asignacionesHuerfanas) {
      if (huerf.esRecuperable && huerf.docenteRecuperadoId) {
        db.run(
          "UPDATE asignaciones_horarias SET docente_id = ? WHERE id = ? AND rbd = ? AND periodo = ?",
          [huerf.docenteRecuperadoId, huerf.asignacionId, cleanRbd, periodo]
        );
        asignacionesHuerfanasReasignadas++;
      } else {
        // Si no se puede asociar a ningún docente, eliminar la asignación huérfana
        db.run(
          "DELETE FROM asignaciones_horarias WHERE id = ? AND rbd = ? AND periodo = ?",
          [huerf.asignacionId, cleanRbd, periodo]
        );
        idsAsignacionesAEliminarRemoto.push(huerf.asignacionId);
        asignacionesHuerfanasEliminadas++;
      }
    }

    // -------------------------------------------------------------------------
    // PASO 3: Deduplicar Asignaciones Multiplicadas en Curso
    // -------------------------------------------------------------------------
    for (const dupAsig of auditoria.asignacionesDuplicadas) {
      // Conservar la primera asignación y eliminar las copias redundantes
      const idPrincipal = dupAsig.asignacionesIds[0];
      const idsRedundantes = dupAsig.asignacionesIds.slice(1);

      // Asegurar que la asignación conservada tenga las horas correctas del plan
      db.run(
        "UPDATE asignaciones_horarias SET horas_pedagogicas_aula = ? WHERE id = ? AND rbd = ? AND periodo = ?",
        [dupAsig.horasValidasReales, idPrincipal, cleanRbd, periodo]
      );

      for (const idRed of idsRedundantes) {
        db.run(
          "DELETE FROM asignaciones_horarias WHERE id = ? AND rbd = ? AND periodo = ?",
          [idRed, cleanRbd, periodo]
        );
        idsAsignacionesAEliminarRemoto.push(idRed);
        asignacionesDuplicadasEliminadas++;
      }
    }

    db.run("COMMIT;");
    await persistDb(true);

    // -------------------------------------------------------------------------
    // PASO 4: Reconciliación en Supabase (Eliminación en Nube)
    // -------------------------------------------------------------------------
    if (isSupabaseEnabled()) {
      if (idsAsignacionesAEliminarRemoto.length > 0) {
        try {
          await supabase
            .from('asignaciones_horarias')
            .delete()
            .in('id', idsAsignacionesAEliminarRemoto);
        } catch (errCloud) {
          console.warn('[repararIntegridadColegio] Aviso eliminando asignaciones en Supabase:', errCloud);
        }
      }

      if (idsDocentesAEliminarRemoto.length > 0) {
        try {
          await supabase
            .from('docentes')
            .delete()
            .in('id', idsDocentesAEliminarRemoto);
        } catch (errCloud) {
          console.warn('[repararIntegridadColegio] Aviso eliminando docentes clonados en Supabase:', errCloud);
        }
      }
    }

    alertas.push(`Saneamiento exitoso: Se fusionaron ${docentesFusionados} docentes duplicados, se rescataron ${asignacionesHuerfanasReasignadas} asignaciones huérfanas y se purgaron ${asignacionesDuplicadasEliminadas} asignaciones multiplicadas.`);

  } catch (err: any) {
    db.run("ROLLBACK;");
    console.error('[repararIntegridadColegio] Error ejecutando saneamiento:', err);
    throw new Error(`Error en reparación de integridad: ${err.message || err}`);
  }

  return {
    docentesFusionados,
    asignacionesHuerfanasReasignadas,
    asignacionesHuerfanasEliminadas,
    asignacionesDuplicadasEliminadas,
    horasRecuperadas,
    alertas
  };
}
