import { CursoSae, Docente, AsignacionHoraria, Establecimiento } from '../types';
import {
  listarCursos,
  guardarCurso,
  eliminarCurso,
  listarDocentes,
  guardarDocente,
  eliminarDocente,
  listarAsignaciones,
  guardarAsignacion,
  eliminarAsignacion,
  obtenerEstablecimientoPorRbd,
  registrarEventoAuditoria,
  persistDb
} from '../database/db';
import { normalizarRut } from '../utils/rutUtils';

export interface OpcionesTraspasoPeriodo {
  promoverCursos: boolean;
  estrategiaDocentes: 'TODOS' | 'SOLO_TITULARES' | 'PERSONALIZADO';
  docentesExcluidosRuns?: string[]; // RUNs de docentes que no continúan
  estrategiaAsignaciones: 'REPLICAR_CONTINUIDAD' | 'SOLO_DEMANDA_VACANTE' | 'NINGUNA';
  ajusteMatriculaEntrante?: number; // Capacidad o matrícula del curso inicial
  sobreescribirSiExiste?: boolean;
}

export interface DiagnosticoPrevioTraspaso {
  rbd: string;
  nombreColegio: string;
  periodoOrigen: number;
  periodoDestino: number;
  totalCursosOrigen: number;
  totalDocentesOrigen: number;
  totalHorasContratoOrigen: number;
  totalAsignacionesOrigen: number;
  totalTitulares: number;
  totalContratas: number;
  directorDetectado?: string;
  cursosYaExistenEnDestino: number;
  docentesYaExistenEnDestino: number;
  advertencias: string[];
}

export interface ResultadoTraspasoPeriodo {
  exito: boolean;
  mensaje: string;
  cursosCreados: number;
  docentesCreados: number;
  asignacionesCreadas: number;
  periodoOrigen: number;
  periodoDestino: number;
  rbd: string;
}

export const MAPA_PROMOCION_NIVELES: Record<string, string> = {
  'Pre-Kínder': 'Kínder',
  'NT1': 'NT2',
  'Kínder': '1° Básico',
  'NT2': '1° Básico',
  '1° Básico': '2° Básico',
  '2° Básico': '3° Básico',
  '3° Básico': '4° Básico',
  '4° Básico': '5° Básico',
  '5° Básico': '6° Básico',
  '6° Básico': '7° Básico',
  '7° Básico': '8° Básico',
  '8° Básico': '1° Medio',
  '1° Medio': '2° Medio',
  '2° Medio': '3° Medio',
  '3° Medio': '4° Medio'
};

/**
 * Realiza un diagnóstico exhaustivo de la escuela antes de autorizar el traspaso.
 */
export async function diagnosticarTraspasoColegio(
  rbd: string,
  periodoOrigen: number = 2026,
  periodoDestino: number = 2027
): Promise<DiagnosticoPrevioTraspaso> {
  const colegio = await obtenerEstablecimientoPorRbd(rbd);
  const cursosOrigen = await listarCursos(rbd, periodoOrigen);
  const docentesOrigen = await listarDocentes(rbd, periodoOrigen);
  const asignacionesOrigen = await listarAsignaciones(rbd, periodoOrigen);

  const cursosDestino = await listarCursos(rbd, periodoDestino);
  const docentesDestino = await listarDocentes(rbd, periodoDestino);

  let totalHorasContratoOrigen = 0;
  let totalTitulares = 0;
  let totalContratas = 0;
  let directorDetectado: string | undefined = colegio?.director;

  for (const d of docentesOrigen) {
    totalHorasContratoOrigen += d.horasContrato || 0;
    if (d.calidadJuridica === 'TITULAR') {
      totalTitulares++;
    } else {
      totalContratas++;
    }

    if (
      d.estamento === 'DIRECTIVO' ||
      /director/i.test(d.cargoInstitucional || '') ||
      /director/i.test(d.funcionPrincipal || '')
    ) {
      directorDetectado = `${d.nombres} ${d.apellidos}`;
    }
  }

  const advertencias: string[] = [];
  if (cursosOrigen.length === 0) {
    advertencias.push(`El establecimiento no registra cursos activos en el periodo origen (${periodoOrigen}).`);
  }
  if (docentesOrigen.length === 0) {
    advertencias.push(`No hay docentes registrados en el periodo ${periodoOrigen}.`);
  }
  if (cursosDestino.length > 0 || docentesDestino.length > 0) {
    advertencias.push(`Ya existen datos registrados en el periodo destino (${periodoDestino}): ${cursosDestino.length} cursos y ${docentesDestino.length} docentes.`);
  }

  return {
    rbd,
    nombreColegio: colegio?.nombre || `Establecimiento RBD ${rbd}`,
    periodoOrigen,
    periodoDestino,
    totalCursosOrigen: cursosOrigen.length,
    totalDocentesOrigen: docentesOrigen.length,
    totalHorasContratoOrigen,
    totalAsignacionesOrigen: asignacionesOrigen.length,
    totalTitulares,
    totalContratas,
    directorDetectado,
    cursosYaExistenEnDestino: cursosDestino.length,
    docentesYaExistenEnDestino: docentesDestino.length,
    advertencias
  };
}

/**
 * Ejecuta el traspaso interanual normativo de dotación por establecimiento.
 */
export async function ejecutarTraspasoPeriodoColegio(
  rbd: string,
  periodoOrigen: number = 2026,
  periodoDestino: number = 2027,
  opciones: OpcionesTraspasoPeriodo = {
    promoverCursos: true,
    estrategiaDocentes: 'TODOS',
    estrategiaAsignaciones: 'REPLICAR_CONTINUIDAD'
  }
): Promise<ResultadoTraspasoPeriodo> {
  const colegio = await obtenerEstablecimientoPorRbd(rbd);
  const cursosOrigen = await listarCursos(rbd, periodoOrigen);
  const docentesOrigen = await listarDocentes(rbd, periodoOrigen);
  const asignacionesOrigen = await listarAsignaciones(rbd, periodoOrigen);

  if (cursosOrigen.length === 0 && docentesOrigen.length === 0) {
    throw new Error(`No hay información en el periodo ${periodoOrigen} para realizar el traspaso.`);
  }

  // Si se solicita sobrescribir y ya hay datos en el destino, limpiamos primero el destino
  if (opciones.sobreescribirSiExiste) {
    const cursosDestinoActuales = await listarCursos(rbd, periodoDestino);
    for (const c of cursosDestinoActuales) {
      await eliminarCurso(c.id);
    }
    const docentesDestinoActuales = await listarDocentes(rbd, periodoDestino);
    for (const d of docentesDestinoActuales) {
      await eliminarDocente(d.id);
    }
    const asigDestinoActuales = await listarAsignaciones(rbd, periodoDestino);
    for (const a of asigDestinoActuales) {
      await eliminarAsignacion(a.id);
    }
  }

  const idCursoMap = new Map<string, string>();
  let cursosCreados = 0;

  // 1. Detectar si el establecimiento imparte enseñanza media
  const tieneMedia = cursosOrigen.some(c =>
    /medio|media/i.test(c.nivel) || (c.tipoModalidad && /media/i.test(c.tipoModalidad))
  );

  let teniaPrekinder = false;
  let teniaKinder = false;
  let tiene1Basico = false;

  for (const c of cursosOrigen) {
    if (c.nivel === 'Pre-Kínder' || c.nivel === 'NT1') teniaPrekinder = true;
    if (c.nivel === 'Kínder' || c.nivel === 'NT2') teniaKinder = true;
    if (c.nivel === '1° Básico') tiene1Basico = true;
  }

  // 2. Promover cursos existentes
  for (const c of cursosOrigen) {
    let nuevoNivel = c.nivel;

    if (opciones.promoverCursos) {
      // Alumnos de 4° Medio egresan
      if (c.nivel === '4° Medio' || /4°\s*Medio/i.test(c.nivel)) {
        continue;
      }

      // Alumnos de 8° Básico en escuelas básicas exclusivas egresan
      if ((c.nivel === '8° Básico' || /8°\s*Básico/i.test(c.nivel)) && !tieneMedia) {
        continue;
      }

      if (MAPA_PROMOCION_NIVELES[c.nivel]) {
        nuevoNivel = MAPA_PROMOCION_NIVELES[c.nivel];
      }
    }

    const nuevoId = `c_${rbd}_${periodoDestino}_${nuevoNivel}_${c.letra}`.replace(/[\s°]/g, '_');
    idCursoMap.set(c.id, nuevoId);

    const cursoProyectado: CursoSae = {
      ...c,
      id: nuevoId,
      periodo: periodoDestino,
      nivel: nuevoNivel
    };
    await guardarCurso(cursoProyectado);
    cursosCreados++;
  }

  // 3. Regenerar cohorte inicial entrante (Pre-Kínder / Kínder / 1° Básico)
  if (opciones.promoverCursos) {
    if (teniaPrekinder) {
      const pkOriginales = cursosOrigen.filter(c => c.nivel === 'Pre-Kínder' || c.nivel === 'NT1');
      for (const pk of pkOriginales) {
        const nuevoIdPk = `c_${rbd}_${periodoDestino}_Pre_Kinder_${pk.letra}`.replace(/[\s°]/g, '_');
        const nuevoPk: CursoSae = {
          ...pk,
          id: nuevoIdPk,
          periodo: periodoDestino,
          nivel: pk.nivel,
          matriculaProyectada: opciones.ajusteMatriculaEntrante !== undefined ? opciones.ajusteMatriculaEntrante : pk.matriculaProyectada
        };
        await guardarCurso(nuevoPk);
        cursosCreados++;
      }
    } else if (teniaKinder) {
      const kOriginales = cursosOrigen.filter(c => c.nivel === 'Kínder' || c.nivel === 'NT2');
      for (const k of kOriginales) {
        const nuevoIdK = `c_${rbd}_${periodoDestino}_Kinder_${k.letra}`.replace(/[\s°]/g, '_');
        const nuevoK: CursoSae = {
          ...k,
          id: nuevoIdK,
          periodo: periodoDestino,
          nivel: k.nivel,
          matriculaProyectada: opciones.ajusteMatriculaEntrante !== undefined ? opciones.ajusteMatriculaEntrante : k.matriculaProyectada
        };
        await guardarCurso(nuevoK);
        cursosCreados++;
      }
    } else if (tiene1Basico) {
      const bOriginales = cursosOrigen.filter(c => c.nivel === '1° Básico');
      for (const b of bOriginales) {
        const nuevoIdB = `c_${rbd}_${periodoDestino}_1_Basico_${b.letra}`.replace(/[\s°]/g, '_');
        const nuevoB: CursoSae = {
          ...b,
          id: nuevoIdB,
          periodo: periodoDestino,
          nivel: '1° Básico',
          matriculaProyectada: opciones.ajusteMatriculaEntrante !== undefined ? opciones.ajusteMatriculaEntrante : b.matriculaProyectada
        };
        await guardarCurso(nuevoB);
        cursosCreados++;
      }
    }
  }

  // 4. Traspasar Docentes según la estrategia seleccionada
  const idDocenteMap = new Map<string, string>();
  let docentesCreados = 0;
  const excluidosSet = new Set((opciones.docentesExcluidosRuns || []).map(r => normalizarRut(r)));

  for (const d of docentesOrigen) {
    const runNorm = normalizarRut(d.run) || d.run;

    // Filtros de estrategia
    if (opciones.estrategiaDocentes === 'SOLO_TITULARES' && d.calidadJuridica !== 'TITULAR') {
      continue;
    }
    if (opciones.estrategiaDocentes === 'PERSONALIZADO' && excluidosSet.has(runNorm)) {
      continue;
    }

    const nuevoIdDoc = `doc_${rbd}_${periodoDestino}_${runNorm}`.replace(/[\s°]/g, '_');
    idDocenteMap.set(d.id, nuevoIdDoc);

    // Resguardo DFL 1 para directores
    const esDirector = d.estamento === 'DIRECTIVO' ||
      /director/i.test(d.cargoInstitucional || '') ||
      (colegio?.director && d.nombres && colegio.director.toLowerCase().includes(d.nombres.toLowerCase()));

    const docenteProyectado: Docente = {
      ...d,
      id: nuevoIdDoc,
      periodo: periodoDestino,
      horasDirectivas: esDirector ? (d.horasDirectivas || d.horasContrato) : d.horasDirectivas
    };

    await guardarDocente(docenteProyectado);
    docentesCreados++;
  }

  // 5. Asignaciones Curriculares
  let asignacionesCreadas = 0;
  if (opciones.estrategiaAsignaciones === 'REPLICAR_CONTINUIDAD') {
    for (const a of asignacionesOrigen) {
      const nuevoCursoId = idCursoMap.get(a.cursoId);
      const nuevoDocId = idDocenteMap.get(a.docenteId);

      if (nuevoCursoId && nuevoDocId) {
        const nuevaAsigId = `asig_${rbd}_${periodoDestino}_${nuevoCursoId}_${nuevoDocId}_${a.asignatura}`.replace(/[\s°]/g, '_');
        const asigProyectada: AsignacionHoraria = {
          ...a,
          id: nuevaAsigId,
          cursoId: nuevoCursoId,
          docenteId: nuevoDocId,
          periodo: periodoDestino
        };
        await guardarAsignacion(asigProyectada);
        asignacionesCreadas++;
      }
    }
  }

  // 6. Forzar persistencia y registrar auditoría
  await persistDb(true);

  await registrarEventoAuditoria({
    rbd,
    periodo: periodoDestino,
    tipoEvento: 'TRASPASO',
    entidad: 'DOTACION_COMPLETA',
    descripcion: `Traspaso interanual ejecutado desde ${periodoOrigen} hacia ${periodoDestino}. Creados: ${cursosCreados} cursos, ${docentesCreados} docentes y ${asignacionesCreadas} asignaciones.`,
    detalles: {
      periodoOrigen,
      periodoDestino,
      cursosCreados,
      docentesCreados,
      asignacionesCreadas,
      opciones
    }
  });

  return {
    exito: true,
    mensaje: `✓ Traspaso exitoso a ${periodoDestino}: ${cursosCreados} cursos, ${docentesCreados} docentes y ${asignacionesCreadas} asignaciones creadas.`,
    cursosCreados,
    docentesCreados,
    asignacionesCreadas,
    periodoOrigen,
    periodoDestino,
    rbd
  };
}
