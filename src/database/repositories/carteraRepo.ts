import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion,
  ComparativaPeriodosResult,
  ResumenPeriodo
} from '../../types';
import { getDb, borrarDotacionPeriodo } from '../dbCore';
import { listarEstablecimientos, obtenerEstablecimientoPorRbd, guardarEstablecimiento } from './establecimientosRepo';
import { listarSalas, guardarSala } from './salasRepo';
import { listarCursos, guardarCurso } from './cursosRepo';
import { listarDocentes, listarTodosLosDocentesTerritorio, guardarDocente } from './docentesRepo';
import { listarAsignaciones, listarTodasLasAsignaciones, guardarAsignacion } from './asignacionesRepo';
import { listarAsistentes, listarTodosLosAsistentesTerritorio, guardarAsistente } from './asistentesRepo';
import { calcularDiagnosticoColegio } from '../../services/dotacionCalculationService';
import { normalizarRut } from '../../utils/rutUtils';

export async function exportarDotacionEstablecimiento(
  rbd: string,
  periodo: number = 2026,
  asesorNombre: string = 'Asesor UATP',
  asesorEmail: string = 'uatp@slepvallediguillin.cl'
): Promise<any> {
  const est = await obtenerEstablecimientoPorRbd(rbd);
  if (!est) {
    throw new Error(`No se encontró el establecimiento con RBD ${rbd} para exportar.`);
  }

  const salas = await listarSalas(rbd);
  const cursos = await listarCursos(rbd, periodo);
  const docentes = await listarDocentes(rbd, periodo);
  const asignaciones = await listarAsignaciones(rbd, periodo);
  const asistentes = await listarAsistentes(await getDb(), rbd, periodo);

  return {
    tipo: 'DOTACION_ESTABLECIMIENTO',
    version: '1.2.0',
    fechaExportacion: new Date().toISOString(),
    periodo,
    rbd,
    asesor: {
      nombre: asesorNombre || est.asesorUatp || 'Asesor UATP',
      email: asesorEmail || 'uatp@slepvallediguillin.cl'
    },
    establecimiento: est,
    salas,
    cursos,
    docentes,
    asignaciones,
    asistentes
  };
}

export async function exportarCarteraCompleta(asesorNombre: string, asesorEmail: string): Promise<any> {
  const establecimientos = await listarEstablecimientos();
  const db = await getDb();

  const salasRes = db.exec("SELECT id, rbd, pabellon, nombre_sala, superficie_m2, tipo, aforo_maximo FROM salas_infraestructura");
  const salas: SalaInfraestructura[] = salasRes.length ? salasRes[0].values.map(r => ({
    id: String(r[0]), rbd: String(r[1]), pabellon: r[2] ? String(r[2]) : undefined,
    nombreSala: String(r[3]), superficieM2: Number(r[4]), tipo: r[5] as any, aforoMaximo: Number(r[6])
  })) : [];

  const cursosRes = db.exec("SELECT id, rbd, nivel, letra, regimen, sala_id, cupo_sae, matricula_proyectada, alumnos_neet, alumnos_neep FROM cursos_sae");
  const cursos: CursoSae[] = cursosRes.length ? cursosRes[0].values.map(r => ({
    id: String(r[0]), rbd: String(r[1]), nivel: String(r[2]), letra: String(r[3]),
    regimen: r[4] as any, salaId: r[5] ? String(r[5]) : undefined,
    cupoSae: Number(r[6]), matriculaProyectada: Number(r[7]), alumnosNeet: Number(r[8]), alumnosNeep: Number(r[9])
  })) : [];

  const docentes = await listarTodosLosDocentesTerritorio();
  const asignaciones = await listarTodasLasAsignaciones();
  const asistentes = await listarTodosLosAsistentesTerritorio(db);

  return {
    tipo: 'CARTERA_TERRITORIAL',
    version: '1.2.0',
    fechaExportacion: new Date().toISOString(),
    asesor: { nombre: asesorNombre, email: asesorEmail },
    establecimientos,
    salas,
    cursos,
    docentes,
    asignaciones,
    asistentes
  };
}

export async function importarCartera(data: any): Promise<{
  importados: number;
  colegiosNombres: string[];
  tipo: string;
  errores: string[];
}> {
  const errores: string[] = [];
  if (!data) {
    throw new Error('Archivo de dotación vacío o inválido.');
  }

  // CASO 1: Archivo de dotación individual de un establecimiento exportado por un asesor
  if (data.tipo === 'DOTACION_ESTABLECIMIENTO' || (data.establecimiento && !data.establecimientos)) {
    const est: Establecimiento = data.establecimiento;
    if (!est || !est.rbd) {
      throw new Error('El archivo no contiene un establecimiento válido.');
    }

    const periodo = Number(data.periodo) || 2026;

    // 1. Guardar o actualizar la ficha del establecimiento
    try {
      await guardarEstablecimiento(est);
    } catch (e: any) {
      errores.push(`Error en establecimiento ${est.nombre} (${est.rbd}): ${e.message}`);
    }

    // 2. Limpiar dotación anterior de este establecimiento en este periodo específico para evitar duplicaciones
    try {
      await borrarDotacionPeriodo(periodo, est.rbd);
    } catch (e: any) {
      console.warn('Error al limpiar periodo previo:', e);
    }

    // 3. Guardar salas
    if (Array.isArray(data.salas)) {
      for (const sala of data.salas) {
        try {
          await guardarSala({ ...sala, rbd: est.rbd });
        } catch (e: any) {
          errores.push(`Error en sala ${sala.nombreSala}: ${e.message}`);
        }
      }
    }

    // 4. Guardar cursos
    if (Array.isArray(data.cursos)) {
      for (const curso of data.cursos) {
        try {
          await guardarCurso({ ...curso, rbd: est.rbd, periodo });
        } catch (e: any) {
          errores.push(`Error en curso ${curso.nivel} ${curso.letra}: ${e.message}`);
        }
      }
    }

    // 5. Guardar docentes
    if (Array.isArray(data.docentes)) {
      for (const doc of data.docentes) {
        try {
          await guardarDocente({ ...doc, rbd: est.rbd, periodo });
        } catch (e: any) {
          errores.push(`Error en docente ${doc.run}: ${e.message}`);
        }
      }
    }

    // 6. Guardar asignaciones
    if (Array.isArray(data.asignaciones)) {
      for (const asig of data.asignaciones) {
        try {
          await guardarAsignacion({ ...asig, rbd: est.rbd, periodo });
        } catch (e: any) {
          errores.push(`Error en asignación: ${e.message}`);
        }
      }
    }

    // 7. Guardar asistentes de la educación
    if (Array.isArray(data.asistentes)) {
      const db = await getDb();
      for (const ast of data.asistentes) {
        try {
          await guardarAsistente(db, { ...ast, rbd: est.rbd, periodo });
        } catch (e: any) {
          errores.push(`Error en asistente ${ast.run}: ${e.message}`);
        }
      }
    }

    return {
      importados: 1,
      colegiosNombres: [est.nombre],
      tipo: 'DOTACION_ESTABLECIMIENTO',
      errores
    };
  }

  // CASO 2: Archivo de cartera territorial completa
  if (Array.isArray(data.establecimientos)) {
    const colegiosNombres: string[] = [];

    for (const est of data.establecimientos) {
      try {
        await guardarEstablecimiento(est);
        colegiosNombres.push(est.nombre);
      } catch (e: any) {
        errores.push(`Error en establecimiento ${est.rbd}: ${e.message}`);
      }
    }

    if (Array.isArray(data.salas)) {
      for (const sala of data.salas) {
        try {
          await guardarSala(sala);
        } catch (e: any) {
          errores.push(`Error en sala ${sala.nombreSala}: ${e.message}`);
        }
      }
    }

    if (Array.isArray(data.cursos)) {
      for (const curso of data.cursos) {
        try {
          await guardarCurso(curso);
        } catch (e: any) {
          errores.push(`Error en curso ${curso.nivel} ${curso.letra}: ${e.message}`);
        }
      }
    }

    if (Array.isArray(data.docentes)) {
      for (const doc of data.docentes) {
        try {
          await guardarDocente(doc);
        } catch (e: any) {
          errores.push(`Error en docente ${doc.run}: ${e.message}`);
        }
      }
    }

    if (Array.isArray(data.asignaciones)) {
      for (const asig of data.asignaciones) {
        try {
          await guardarAsignacion(asig);
        } catch (e: any) {
          errores.push(`Error en asignación: ${e.message}`);
        }
      }
    }

    if (Array.isArray(data.asistentes)) {
      const db = await getDb();
      for (const ast of data.asistentes) {
        try {
          await guardarAsistente(db, ast);
        } catch (e: any) {
          errores.push(`Error en asistente ${ast.run}: ${e.message}`);
        }
      }
    }

    return {
      importados: data.establecimientos.length,
      colegiosNombres,
      tipo: 'CARTERA_TERRITORIAL',
      errores
    };
  }

  throw new Error('El archivo no contiene un formato reconocido de dotación (.slep o .json).');
}

const MAPA_PROMOCION_NIVELES: Record<string, string> = {
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

export async function proyectarPeriodoColegio(
  rbd: string,
  periodoOrigen: number = 2026,
  periodoDestino: number = 2027,
  opciones: { promoverCursos?: boolean; replicarAsignaciones?: boolean } = { promoverCursos: true, replicarAsignaciones: true }
): Promise<{ cursosCreados: number; docentesCreados: number; asignacionesCreadas: number }> {
  const cursosOrigen = await listarCursos(rbd, periodoOrigen);
  const docentesOrigen = await listarDocentes(rbd, periodoOrigen);
  const asignacionesOrigen = await listarAsignaciones(rbd, periodoOrigen);

  const idCursoMap = new Map<string, string>();
  let cursosCreados = 0;

  // Detectar niveles que imparte el colegio
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

  for (const c of cursosOrigen) {
    let nuevoNivel = c.nivel;
    if (opciones.promoverCursos) {
      // 1. Alumnos de 4° Medio egresan de la etapa escolar
      if (c.nivel === '4° Medio') {
        continue;
      }

      // 2. Alumnos de 8° Básico en escuelas de enseñanza básica exclusiva egresan de la escuela
      if (c.nivel === '8° Básico' && !tieneMedia) {
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

  // Regeneración del curso inicial (cohorte entrante) al promover niveles
  if (opciones.promoverCursos) {
    if (teniaPrekinder) {
      const pkOriginales = cursosOrigen.filter(c => c.nivel === 'Pre-Kínder' || c.nivel === 'NT1');
      for (const pk of pkOriginales) {
        const nuevoIdPk = `c_${rbd}_${periodoDestino}_Pre_Kinder_${pk.letra}`.replace(/[\s°]/g, '_');
        const nuevoPk: CursoSae = {
          ...pk,
          id: nuevoIdPk,
          periodo: periodoDestino,
          nivel: pk.nivel
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
          nivel: k.nivel
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
          nivel: '1° Básico'
        };
        await guardarCurso(nuevoB);
        cursosCreados++;
      }
    }
  }

  const idDocenteMap = new Map<string, string>();
  let docentesCreados = 0;

  for (const d of docentesOrigen) {
    const runNorm = normalizarRut(d.run) || d.run;
    const nuevoIdDoc = `doc_${rbd}_${periodoDestino}_${runNorm}`.replace(/[\s°]/g, '_');
    idDocenteMap.set(d.id, nuevoIdDoc);

    const docenteProyectado: Docente = {
      ...d,
      id: nuevoIdDoc,
      periodo: periodoDestino
    };
    await guardarDocente(docenteProyectado);
    docentesCreados++;
  }

  let asignacionesCreadas = 0;
  if (opciones.replicarAsignaciones) {
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

  return { cursosCreados, docentesCreados, asignacionesCreadas };
}

export async function getComparativaPeriodos(
  rbd: string,
  periodoA: number = 2026,
  periodoB: number = 2027
): Promise<ComparativaPeriodosResult> {
  const est = await obtenerEstablecimientoPorRbd(rbd);
  if (!est) throw new Error(`Establecimiento con RBD ${rbd} no encontrado.`);

  const salas = await listarSalas(rbd);

  const cursosA = await listarCursos(rbd, periodoA);
  const docentesA = await listarDocentes(rbd, periodoA);
  const asignacionesA = await listarAsignaciones(rbd, periodoA);
  const diagA = calcularDiagnosticoColegio(est, salas, cursosA, docentesA, asignacionesA);

  const cursosB = await listarCursos(rbd, periodoB);
  const docentesB = await listarDocentes(rbd, periodoB);
  const asignacionesB = await listarAsignaciones(rbd, periodoB);
  const diagB = calcularDiagnosticoColegio(est, salas, cursosB, docentesB, asignacionesB);

  const totalSubvGenA = docentesA.reduce((s, d) => s + (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0), 0);
  const totalSepA = docentesA.reduce((s, d) => s + (d.horasSepTitular || 0) + (d.horasSepContrata || 0), 0);
  const totalPieA = docentesA.reduce((s, d) => s + (d.horasPieTitular || 0) + (d.horasPieContrata || 0), 0);

  const totalSubvGenB = docentesB.reduce((s, d) => s + (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0), 0);
  const totalSepB = docentesB.reduce((s, d) => s + (d.horasSepTitular || 0) + (d.horasSepContrata || 0), 0);
  const totalPieB = docentesB.reduce((s, d) => s + (d.horasPieTitular || 0) + (d.horasPieContrata || 0), 0);

  const resumenA: ResumenPeriodo = {
    periodo: periodoA,
    totalCursos: cursosA.length,
    matriculaTotal: cursosA.reduce((s, c) => s + c.matriculaProyectada, 0),
    docentesTotal: docentesA.length,
    horasContratoTotal: docentesA.reduce((s, d) => s + d.horasContrato, 0),
    horasAulaDemandadas: diagA.balanzaGeneral.horasAulaDemandadasCurriculo,
    horasLectivasDisponibles: diagA.balanzaGeneral.horasLectivasDisponibles,
    horasAsignadas: diagA.balanzaGeneral.horasLectivasAsignadas,
    balanceLectivo: diagA.balanzaGeneral.superavitDeficitLectivo,
    subvencionGeneralTotal: totalSubvGenA,
    sepTotal: totalSepA,
    pieTotal: totalPieA
  };

  const resumenB: ResumenPeriodo = {
    periodo: periodoB,
    totalCursos: cursosB.length,
    matriculaTotal: cursosB.reduce((s, c) => s + c.matriculaProyectada, 0),
    docentesTotal: docentesB.length,
    horasContratoTotal: docentesB.reduce((s, d) => s + d.horasContrato, 0),
    horasAulaDemandadas: diagB.balanzaGeneral.horasAulaDemandadasCurriculo,
    horasLectivasDisponibles: diagB.balanzaGeneral.horasLectivasDisponibles,
    horasAsignadas: diagB.balanzaGeneral.horasLectivasAsignadas,
    balanceLectivo: diagB.balanzaGeneral.superavitDeficitLectivo,
    subvencionGeneralTotal: totalSubvGenB,
    sepTotal: totalSepB,
    pieTotal: totalPieB
  };

  const mapDocA = new Map<string, Docente>();
  for (const d of docentesA) mapDocA.set(d.run, d);

  const mapDocB = new Map<string, Docente>();
  for (const d of docentesB) mapDocB.set(d.run, d);

  const todosLosRuns = Array.from(new Set([...mapDocA.keys(), ...mapDocB.keys()]));
  const variacionesDocentes = todosLosRuns.map(run => {
    const dA = mapDocA.get(run);
    const dB = mapDocB.get(run);
    const nombre = (dB ? `${dB.nombres} ${dB.apellidos}` : (dA ? `${dA.nombres} ${dA.apellidos}` : 'Docente')).trim();
    const hA = dA ? dA.horasContrato : 0;
    const hB = dB ? dB.horasContrato : 0;
    const delta = hB - hA;

    let tipo: 'NUEVO_CONTRATO' | 'REDUCCION_HORAS' | 'AUMENTO_HORAS' | 'SIN_CAMBIO' | 'EGRESO' = 'SIN_CAMBIO';
    if (!dA && dB) tipo = 'NUEVO_CONTRATO';
    else if (dA && !dB) tipo = 'EGRESO';
    else if (delta > 0) tipo = 'AUMENTO_HORAS';
    else if (delta < 0) tipo = 'REDUCCION_HORAS';

    let cambioCalidad = undefined;
    if (dA && dB && dA.calidadJuridica !== dB.calidadJuridica) {
      cambioCalidad = `${dA.calidadJuridica} -> ${dB.calidadJuridica}`;
    }

    return {
      run,
      nombre,
      horasA: hA,
      horasB: hB,
      deltaHoras: delta,
      cambioCalidad,
      tipoVariacion: tipo
    };
  });

  return {
    rbd,
    establecimientoNombre: est.nombre,
    periodoA: resumenA,
    periodoB: resumenB,
    deltaMatricula: resumenB.matriculaTotal - resumenA.matriculaTotal,
    deltaCursos: resumenB.totalCursos - resumenA.totalCursos,
    deltaHorasContrato: resumenB.horasContratoTotal - resumenA.horasContratoTotal,
    deltaHorasAulaDemandadas: resumenB.horasAulaDemandadas - resumenA.horasAulaDemandadas,
    deltaBalanceLectivo: resumenB.balanceLectivo - resumenA.balanceLectivo,
    variacionesDocentes
  };
}