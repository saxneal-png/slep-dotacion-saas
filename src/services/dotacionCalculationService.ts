import {
  calcularJornadaMinutos,
  validarSobreasignacionDocente,
  calcularAuditoriaDocenteMultitramo,
  buscarContratoMinimoPorTabla,
  calcularDemandaNormativaPieCurso,
  evaluarCapacidadSaeYInfraestructura,
  obtenerPlanPorCurso
} from '@slep/mineduc-engine';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  BalanzaHorariaColegio,
  InconsistenciaTerritorial,
  DocenteConsolidadoTerritorial,
  ContratoDocenteColegio
} from '../types';

export interface DiagnosticoEspecialidad {
  asignatura: string;
  horasDemandadas: number;
  horasAsignadas: number;
  balance: number; // positivo = superavit, negativo = deficit
  docentesAsignados: string[];
}

export interface DiagnosticoColegioCompleto {
  establecimiento: Establecimiento;
  balanzaGeneral: BalanzaHorariaColegio;
  diagnosticoPorEspecialidad: DiagnosticoEspecialidad[];
  evaluacionesSalasSae: ReturnType<typeof evaluarCapacidadSaeYInfraestructura>[];
  demandaPiePorCurso: {
    curso: CursoSae;
    demanda: ReturnType<typeof calcularDemandaNormativaPieCurso>;
  }[];
  estadoDocentes: {
    docente: Docente;
    horasPedagogicasAsignadas: number;
    horasAulaRegular?: number;
    horasCoDocencia?: number;
    horasTallerSep?: number;
    horasTrabajoColaborativo?: number;
    horasDocenciaAfecta?: number;
    horasExentas?: number;
    horasLectivasMaximas: number;
    estaSobreasignado: boolean;
    excesoHoras: number;
    horasVacantes: number;
  }[];
}

/**
 * Calcula el diagnóstico integral de dotación, capacidad y balance de un establecimiento escolar
 */
export function calcularDiagnosticoColegio(
  est: Establecimiento,
  salas: SalaInfraestructura[],
  cursos: CursoSae[],
  docentes: Docente[],
  asignaciones: AsignacionHoraria[]
): DiagnosticoColegioCompleto {
  const regimenTabla = est.porcentajePrioritarios >= 80 ? '60_40' : '65_35';
  const regimenProporcion = est.porcentajePrioritarios >= 80 ? '60/40' : '65/35';

  // 1. Capacidad Física de Salas y Cruce SAE
  const evaluacionesSalasSae: ReturnType<typeof evaluarCapacidadSaeYInfraestructura>[] = [];
  const alertasInfraestructura: string[] = [];

  let totalMatriculaProyectada = 0;
  let totalCuposSae = 0;

  for (const curso of cursos) {
    totalMatriculaProyectada += curso.matriculaProyectada;
    totalCuposSae += curso.cupoSae;

    const salaAsoc = salas.find(s => s.id === curso.salaId) || {
      id: 'default',
      rbd: est.rbd,
      nombreSala: 'Sin Sala Asignada',
      superficieM2: 45,
      tipo: 'REGULAR' as const,
      aforoMaximo: 40
    };

    const ev = evaluarCapacidadSaeYInfraestructura(
      `${curso.nivel} ${curso.letra}`,
      salaAsoc,
      curso.cupoSae,
      curso.matriculaProyectada
    );
    evaluacionesSalasSae.push(ev);

    if (ev.estadoAforo === 'ALERTA_SOBRECUPO_FISICO') {
      alertasInfraestructura.push(`${ev.cursoNombre}: Hacinamiento físico en ${ev.salaAsignada}.`);
    } else if (ev.estadoAforo === 'EXCEDE_SAE') {
      alertasInfraestructura.push(`${ev.cursoNombre}: Matrícula supera cupo SAE.`);
    }
  }

  // 2. Demanda Curricular según Planes MINEDUC y Talleres JEC
  let horasAulaDemandadasCurriculo = 0;
  const demandaPorAsignatura: { [asig: string]: number } = {};

  for (const curso of cursos) {
    const plan = obtenerPlanPorCurso(curso.nivel, curso.regimen);
    const horasPlan = plan ? plan.totalHorasPlan : (curso.regimen === 'JEC' ? 38 : 30);
    const horasTalleres = (curso.talleresJec || []).reduce((sum, t) => sum + t.horas, 0);

    horasAulaDemandadasCurriculo += (horasPlan + horasTalleres);

    if (plan) {
      for (const asig of plan.asignaturasBase) {
        demandaPorAsignatura[asig.nombre] = (demandaPorAsignatura[asig.nombre] || 0) + asig.horasSugeridas;
      }
    }

    if (curso.talleresJec && curso.talleresJec.length > 0) {
      for (const t of curso.talleresJec) {
        demandaPorAsignatura[t.nombre] = (demandaPorAsignatura[t.nombre] || 0) + t.horas;
      }
    }
  }

  // 2.1 Talleres Institucionales / Transversales (no asociados a un curso específico)
  const asignacionesTransversales = asignaciones.filter(
    a => !a.cursoId || a.cursoId === 'TRANSVERSAL' || a.cursoId === 'SIN_CURSO'
  );
  for (const asig of asignacionesTransversales) {
    const hrs = asig.horasPedagogicasAula || 0;
    if (hrs > 0) {
      horasAulaDemandadasCurriculo += hrs;
      const nombreTaller = asig.asignatura || 'Taller Institucional Transversal';
      demandaPorAsignatura[nombreTaller] = (demandaPorAsignatura[nombreTaller] || 0) + hrs;
    }
  }

  // 3. Demanda PIE Decreto 170 y Trabajo Colaborativo
  let horasPieDemandadas = 0;
  let horasColaborativasDemandadas = 0;
  const demandaPiePorCurso: { curso: CursoSae; demanda: ReturnType<typeof calcularDemandaNormativaPieCurso> }[] = [];
  const alertasAforoPie: string[] = [];

  for (const curso of cursos) {
    const isJec = curso.regimen === 'JEC';
    const demanda = calcularDemandaNormativaPieCurso(curso.alumnosNeet, curso.alumnosNeep, isJec);
    demandaPiePorCurso.push({ curso, demanda });

    horasPieDemandadas += demanda.horasTotalCronologicas;
    horasColaborativasDemandadas += demanda.horasTrabajoColaborativoCronologicas;

    if (!demanda.cumpleAforo) {
      alertasAforoPie.push(`${curso.nivel} ${curso.letra}: Aforo PIE excedido (${curso.alumnosNeet} NEET, ${curso.alumnosNeep} NEEP).`);
    }
  }

  // 4. Dotación Docente y Detección de Sobreasignación (considerando Directivas, Inspectoría General, UTP, Coordinación, Taller SEP, Trabajo Colaborativo y Co-Docencia)
  let horasContratadasTotales = 0;
  let horasDirectivasTotales = 0;
  let horasInspectorGeneralTotales = 0;
  let horasTecnicoPedagogicasTotales = 0;
  let horasCoordinacionTotales = 0;
  let horasLectivasDisponibles = 0;
  let horasLectivasAsignadas = 0;
  const sobreasignacionesAlertas: string[] = [];

  const estadoDocentes = docentes.map(doc => {
    horasContratadasTotales += doc.horasContrato;
    const hDir = doc.horasDirectivas || 0;
    const hInsp = doc.horasInspectorGeneral || 0;
    const hTec = doc.horasTecnicoPedagogicas || 0;
    const hCoord = doc.horasCoordinacion || 0;
    const hCoordPie = doc.horasCoordinacionPie || 0;
    const hConv = doc.horasConvivenciaEscolar || 0;
    const hExtra = doc.horasExtraescolar || 0;
    const hTallerSepDoc = doc.horasTallerSep || 0;
    const hColabDoc = doc.horasTrabajoColaborativo || 0;

    horasDirectivasTotales += hDir;
    horasInspectorGeneralTotales += hInsp;
    horasTecnicoPedagogicasTotales += hTec;
    horasCoordinacionTotales += hCoord;

    // Clasificar asignaciones del docente en este establecimiento
    const docenteAsigs = asignaciones.filter(a => a.docenteId === doc.id);
    const coDocenteAsigs = asignaciones.filter(a => a.coDocenteId === doc.id && a.tieneCoDocente);

    const asigsAulaRegular = docenteAsigs.filter(
      a => !a.esCoDocencia && !a.esTallerSep && !a.esTrabajoColaborativo && a.tipoApoyo !== 'TRABAJO_COLABORATIVO'
    );
    const asigsCoDocencia = [
      ...docenteAsigs.filter(a => a.esCoDocencia),
      ...coDocenteAsigs
    ];
    const asigsTallerSep = docenteAsigs.filter(a => a.esTallerSep);
    const asigsTrabajoColaborativo = docenteAsigs.filter(
      a => a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO' || a.asignatura.toLowerCase().includes('colaborativ')
    );

    const pedAulaRegular = asigsAulaRegular.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedCoDocencia = asigsCoDocencia.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedTallerSep = asigsTallerSep.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedTrabajoColab = asigsTrabajoColaborativo.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedTotalAsignadas = pedAulaRegular + pedCoDocencia + pedTallerSep + pedTrabajoColab;

    // Solo las horas de aula regular lectivas se comparan con la demanda curricular del plan
    horasLectivasAsignadas += pedAulaRegular;

    // Deducir funciones exentas de proporción (Directivas, Inspectoría, UTP, Coordinación, Taller SEP, Trabajo Colaborativo / PIE)
    const sepExentas = Math.max(hTallerSepDoc, pedTallerSep);
    const pieCronologicas = Math.max(hColabDoc, pedTrabajoColab, hCoordPie, (doc.estamento === 'DOCENTE_DIFERENCIAL' || ((Number(doc.horasPieTitular || 0) + Number(doc.horasPieContrata || 0)) > 0 && pedAulaRegular === 0) ? (Number(doc.horasPieTitular || 0) + Number(doc.horasPieContrata || 0)) : 0));

    const hExentas = hDir + hInsp + hTec + hCoord + hConv + hExtra + sepExentas + pieCronologicas;
    const horasParaDocenciaAula = Math.max(0, doc.horasContrato - hExentas);

    // Verificar si el docente imparte clases en algún curso con régimen 60/40 (ej. NT1 a 4° Básico)
    const teacherCourseIds = new Set(asigsAulaRegular.map(a => a.cursoId));
    const teacherCourses = cursos.filter(c => teacherCourseIds.has(c.id));
    const has60_40Course = teacherCourses.some(c => c.regimenProporcion === '60_40');
    const docRegimenTabla = (has60_40Course || est.porcentajePrioritarios >= 80) ? '60_40' : '65_35';
    const docRegimenProporcion = (has60_40Course || est.porcentajePrioritarios >= 80) ? '60/40' : '65/35';

    // El cálculo de proporción Ley 20.903 aplica EXCLUSIVAMENTE a las horas de aula regular
    const calculo = horasParaDocenciaAula > 0 
      ? calcularJornadaMinutos(horasParaDocenciaAula, pedAulaRegular, docRegimenTabla)
      : {
          horasContrato: 0,
          minutosContratoTotales: 0,
          horasPedagogicasDisponiblesMax: 0,
          minutosLectivosDisponiblesMax: 0,
          horasPedagogicasAsignadas: pedAulaRegular,
          minutosLectivosAsignados: pedAulaRegular * 45,
          horasPedagogicasVacantes: 0,
          minutosLectivosVacantes: 0,
          minutosRecreoAsignados: 0,
          minutosNoLectivosCalculados: 0,
          minutosUsadosTotales: 0,
          esSobreasignado: pedAulaRegular > 0,
          minutosSobreasignados: pedAulaRegular * 45,
          cumple65_35: pedAulaRegular === 0
        };

    horasLectivasDisponibles += calculo.horasPedagogicasDisponiblesMax;

    const valSobre = horasParaDocenciaAula > 0
      ? validarSobreasignacionDocente(horasParaDocenciaAula, pedAulaRegular, docRegimenProporcion)
      : {
          estaSobreasignado: pedAulaRegular > 0,
          horasAsignadas: pedAulaRegular,
          horasMaxLectivasPermitidas: 0,
          excesoHoras: pedAulaRegular,
          mensaje: pedAulaRegular > 0 ? `Funcionario sin horas aula afectas con ${pedAulaRegular} HA de aula asignadas.` : 'Sin horas de aula regular asignadas.'
        };

    if (valSobre.estaSobreasignado) {
      sobreasignacionesAlertas.push(
        `${doc.nombres} ${doc.apellidos} (${doc.run}): Asignadas ${pedAulaRegular} HA regulares de máx ${calculo.horasPedagogicasDisponiblesMax} HA (+${valSobre.excesoHoras} HA).`
      );
    }

    const hInstNoAula = hDir + hInsp + hTec + hCoord + hConv + hExtra;
    const cargaTotalTrabajo = pedAulaRegular + pedCoDocencia + sepExentas + pieCronologicas + hInstNoAula;
    const horasVacantesFuncionario = Math.max(0, doc.horasContrato - cargaTotalTrabajo);

    return {
      docente: doc,
      horasPedagogicasAsignadas: pedTotalAsignadas,
      horasAulaRegular: pedAulaRegular,
      horasCoDocencia: pedCoDocencia,
      horasTallerSep: pedTallerSep,
      horasTrabajoColaborativo: pedTrabajoColab,
      horasDocenciaAfecta: horasParaDocenciaAula,
      horasExentas: hExentas,
      horasLectivasMaximas: calculo.horasPedagogicasDisponiblesMax,
      estaSobreasignado: valSobre.estaSobreasignado,
      excesoHoras: valSobre.excesoHoras,
      horasVacantes: horasVacantesFuncionario
    };
  });

  // 5. Diagnóstico por Especialidad
  const asignadoPorAsignatura: { [asig: string]: { horas: number; docentes: string[] } } = {};
  for (const asig of asignaciones) {
    if (!asignadoPorAsignatura[asig.asignatura]) {
      asignadoPorAsignatura[asig.asignatura] = { horas: 0, docentes: [] };
    }
    asignadoPorAsignatura[asig.asignatura].horas += asig.horasPedagogicasAula;
    const doc = docentes.find(d => d.id === asig.docenteId);
    if (doc) {
      const nombreD = `${doc.nombres} ${doc.apellidos}`;
      if (!asignadoPorAsignatura[asig.asignatura].docentes.includes(nombreD)) {
        asignadoPorAsignatura[asig.asignatura].docentes.push(nombreD);
      }
    }
    if (asig.tieneCoDocente && asig.coDocenteId) {
      const coDoc = docentes.find(d => d.id === asig.coDocenteId);
      if (coDoc) {
        const nombreCoDoc = `${coDoc.nombres} ${coDoc.apellidos} (Co-docente)`;
        if (!asignadoPorAsignatura[asig.asignatura].docentes.includes(nombreCoDoc)) {
          asignadoPorAsignatura[asig.asignatura].docentes.push(nombreCoDoc);
        }
      }
    }
  }

  const todasLasAsignaturas = Array.from(
    new Set([...Object.keys(demandaPorAsignatura), ...Object.keys(asignadoPorAsignatura)])
  );

  const diagnosticoPorEspecialidad: DiagnosticoEspecialidad[] = todasLasAsignaturas.map(asig => {
    const demandadas = demandaPorAsignatura[asig] || 0;
    const asignadas = asignadoPorAsignatura[asig]?.horas || 0;
    return {
      asignatura: asig,
      horasDemandadas: demandadas,
      horasAsignadas: asignadas,
      balance: asignadas - demandadas,
      docentesAsignados: asignadoPorAsignatura[asig]?.docentes || []
    };
  }).sort((a, b) => a.balance - b.balance);

  const superavitDeficitLectivo = horasLectivasDisponibles - horasAulaDemandadasCurriculo;

  const balanzaGeneral: BalanzaHorariaColegio = {
    rbd: est.rbd,
    nombre: est.nombre,
    comuna: est.comuna,
    totalCursos: cursos.length,
    totalMatriculaProyectada,
    totalCuposSae,
    horasAulaDemandadasCurriculo,
    horasPieDemandadas: parseFloat(horasPieDemandadas.toFixed(1)),
    horasColaborativasDemandadas: parseFloat(horasColaborativasDemandadas.toFixed(1)),
    horasContratadasTotales,
    horasDirectivasTotales,
    horasInspectorGeneralTotales,
    horasTecnicoPedagogicasTotales,
    horasCoordinacionTotales,
    horasLectivasDisponibles,
    horasLectivasAsignadas,
    superavitDeficitLectivo,
    sobreasignacionesAlertas,
    alertasInfraestructura,
    alertasAforoPie
  };

  return {
    establecimiento: est,
    balanzaGeneral,
    diagnosticoPorEspecialidad,
    evaluacionesSalasSae,
    demandaPiePorCurso,
    estadoDocentes
  };
}

/**
 * Consolidador Territorial SLEP Valle Diguillín:
 * Reúne y audita de forma cruzada todos los colegios de la cartera.
 */
export function consolidarCarteraTerritorial(
  establecimientos: Establecimiento[],
  docentes: Docente[],
  diagnosticos: DiagnosticoColegioCompleto[]
): {
  inconsistencias: InconsistenciaTerritorial[];
  resumenPorComuna: {
    [comuna: string]: {
      colegiosCount: number;
      matriculaTotal: number;
      cuposSaeTotal: number;
      horasDemandadasTotal: number;
      horasDisponiblesTotal: number;
      balanceHoras: number;
    };
  };
  vacantesCruzadas: {
    asignatura: string;
    colegiosConDeficit: { colegio: string; rbd: string; comuna: string; deficit: number }[];
    colegiosConSuperavit: { colegio: string; rbd: string; comuna: string; superavit: number }[];
  }[];
} {
  const inconsistencias: InconsistenciaTerritorial[] = [];

  // 1. Detección de RUTs Duplicados y Sobrecarga Cruzada Territorial
  const docentesPorRun: { [run: string]: Docente[] } = {};
  for (const d of docentes) {
    if (!docentesPorRun[d.run]) {
      docentesPorRun[d.run] = [];
    }
    docentesPorRun[d.run].push(d);
  }

  for (const [run, list] of Object.entries(docentesPorRun)) {
    if (list.length > 1) {
      const horasTotales = list.reduce((sum, doc) => sum + doc.horasContrato, 0);
      const nombresColegios = list.map(doc => {
        const est = establecimientos.find(e => e.rbd === doc.rbd);
        return est ? `${est.nombre} (${doc.horasContrato}h)` : `RBD ${doc.rbd} (${doc.horasContrato}h)`;
      });

      if (horasTotales > 44) {
        inconsistencias.push({
          tipo: 'EXCESO_JORNADA_GLOBAL',
          run,
          docenteNombre: `${list[0].nombres} ${list[0].apellidos}`,
          colegiosInvolucrados: nombresColegios,
          horasTotalesSumadas: horasTotales,
          descripcion: `Infracción Territorial: El docente suma ${horasTotales} hrs semanales entre múltiples escuelas (Límite legal del Estatuto Docente es 44 hrs).`
        });
      } else {
        inconsistencias.push({
          tipo: 'RUT_DUPLICADO',
          run,
          docenteNombre: `${list[0].nombres} ${list[0].apellidos}`,
          colegiosInvolucrados: nombresColegios,
          horasTotalesSumadas: horasTotales,
          descripcion: `Docente compartido en ${list.length} establecimientos con un total de ${horasTotales} hrs.`
        });
      }
    }
  }

  // 2. Resumen Agregado por Comuna (Bulnes, Chillán Viejo, Yungay, etc.)
  const resumenPorComuna: {
    [comuna: string]: {
      colegiosCount: number;
      matriculaTotal: number;
      cuposSaeTotal: number;
      horasDemandadasTotal: number;
      horasDisponiblesTotal: number;
      balanceHoras: number;
    };
  } = {};

  for (const diag of diagnosticos) {
    const com = diag.establecimiento.comuna;
    if (!resumenPorComuna[com]) {
      resumenPorComuna[com] = {
        colegiosCount: 0,
        matriculaTotal: 0,
        cuposSaeTotal: 0,
        horasDemandadasTotal: 0,
        horasDisponiblesTotal: 0,
        balanceHoras: 0
      };
    }
    const r = resumenPorComuna[com];
    r.colegiosCount += 1;
    r.matriculaTotal += diag.balanzaGeneral.totalMatriculaProyectada;
    r.cuposSaeTotal += diag.balanzaGeneral.totalCuposSae;
    r.horasDemandadasTotal += diag.balanzaGeneral.horasAulaDemandadasCurriculo;
    r.horasDisponiblesTotal += diag.balanzaGeneral.horasLectivasDisponibles;
    r.balanceHoras += diag.balanzaGeneral.superavitDeficitLectivo;
  }

  // 3. Matriz de Emparejamiento de Vacantes Cruzadas por Especialidad
  const especialidadesMap: {
    [asig: string]: {
      deficits: { colegio: string; rbd: string; comuna: string; deficit: number }[];
      superavits: { colegio: string; rbd: string; comuna: string; superavit: number }[];
    };
  } = {};

  for (const diag of diagnosticos) {
    for (const esp of diag.diagnosticoPorEspecialidad) {
      if (esp.balance === 0) continue;
      if (!especialidadesMap[esp.asignatura]) {
        especialidadesMap[esp.asignatura] = { deficits: [], superavits: [] };
      }
      if (esp.balance < 0) {
        especialidadesMap[esp.asignatura].deficits.push({
          colegio: diag.establecimiento.nombre,
          rbd: diag.establecimiento.rbd,
          comuna: diag.establecimiento.comuna,
          deficit: Math.abs(esp.balance)
        });
      } else {
        especialidadesMap[esp.asignatura].superavits.push({
          colegio: diag.establecimiento.nombre,
          rbd: diag.establecimiento.rbd,
          comuna: diag.establecimiento.comuna,
          superavit: esp.balance
        });
      }
    }
  }

  const vacantesCruzadas = Object.entries(especialidadesMap)
    .filter(([, data]) => data.deficits.length > 0 || data.superavits.length > 0)
    .map(([asignatura, data]) => ({
      asignatura,
      colegiosConDeficit: data.deficits,
      colegiosConSuperavit: data.superavits
    }));

  return {
    inconsistencias,
    resumenPorComuna,
    vacantesCruzadas
  };
}

/**
 * Agrupa y consolida todos los contratos docentes a nivel territorial (SLEP)
 * permitiendo auditar la carga en cada escuela, fuentes de financiamiento y límite legal de 44 hrs.
 */
export function obtenerDocentesConsolidadosTerritorio(
  establecimientos: Establecimiento[],
  docentes: Docente[],
  asignaciones: AsignacionHoraria[],
  cursos: CursoSae[] = []
): DocenteConsolidadoTerritorial[] {
  // Agrupar por RUN
  const porRun: { [run: string]: Docente[] } = {};
  for (const d of docentes) {
    const cleanRun = d.run.trim();
    if (!porRun[cleanRun]) {
      porRun[cleanRun] = [];
    }
    porRun[cleanRun].push(d);
  }

  const resultado: DocenteConsolidadoTerritorial[] = [];

  for (const [run, listaDocentes] of Object.entries(porRun)) {
    const primerDoc = listaDocentes[0];
    const contratos: ContratoDocenteColegio[] = [];

    let totalHorasSlep = 0;
    let totalPedAula = 0;
    let totalAulaRegular = 0;
    let totalCoDocencia = 0;
    let totalTallerSep = 0;
    let totalTrabajoColaborativo = 0;
    let totalInstitucionalesNoAula = 0;

    let totalSubvTitular = 0;
    let totalSubvContrata = 0;
    let totalSepTitular = 0;
    let totalSepContrata = 0;
    let totalPieTitular = 0;
    let totalPieContrata = 0;

    for (const doc of listaDocentes) {
      const colegio = establecimientos.find(e => e.rbd === doc.rbd) || {
        id: `est-${doc.rbd}`,
        rbd: doc.rbd,
        nombre: `Establecimiento RBD ${doc.rbd}`,
        comuna: 'Bulnes' as any,
        regimen: 'JEC' as any,
        porcentajePrioritarios: 70
      };

      const asigsColegio = asignaciones.filter(
        a => a.rbd === doc.rbd && (a.docenteId === doc.id || (a.coDocenteId === doc.id && a.tieneCoDocente))
      );

      const asigsAulaRegular = asigsColegio.filter(
        a => a.docenteId === doc.id && !a.esCoDocencia && !a.esTallerSep && !a.esTrabajoColaborativo && a.tipoApoyo !== 'TRABAJO_COLABORATIVO'
      );
      const asigsCoDocencia = asigsColegio.filter(
        a => (a.coDocenteId === doc.id && a.tieneCoDocente) || (a.docenteId === doc.id && a.esCoDocencia)
      );
      const asigsTallerSep = asigsColegio.filter(
        a => a.docenteId === doc.id && a.esTallerSep
      );
      const asigsTrabajoColaborativo = asigsColegio.filter(
        a => a.docenteId === doc.id && (a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO' || a.asignatura.toLowerCase().includes('colaborativ'))
      );

      const pedAulaRegular = asigsAulaRegular.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedCoDocencia = asigsCoDocencia.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTallerSep = asigsTallerSep.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTrabajoColab = asigsTrabajoColaborativo.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTotalAsignadas = pedAulaRegular + pedCoDocencia + pedTallerSep + pedTrabajoColab;

      const hDir = doc.horasDirectivas || 0;
      const hInsp = doc.horasInspectorGeneral || 0;
      const hTec = doc.horasTecnicoPedagogicas || 0;
      const hCoord = doc.horasCoordinacion || 0;
      const hCoordPie = doc.horasCoordinacionPie || 0;
      const hConv = doc.horasConvivenciaEscolar || 0;
      const hExtra = doc.horasExtraescolar || 0;
      const hTallerSepDoc = doc.horasTallerSep || 0;
      const hColabDoc = doc.horasTrabajoColaborativo || 0;

      // Fuentes de financiamiento
      let subTit = Number(doc.horasSubvencionGeneralTitular || 0);
      let subCon = Number(doc.horasSubvencionGeneralContrata || 0);
      let sepTit = Number(doc.horasSepTitular || 0);
      let sepCon = Number(doc.horasSepContrata || 0);
      let pieTit = Number(doc.horasPieTitular || 0);
      let pieCon = Number(doc.horasPieContrata || 0);

      const sumaF = subTit + subCon + sepTit + sepCon + pieTit + pieCon;
      if (sumaF === 0 && doc.horasContrato > 0) {
        if (doc.calidadJuridica === 'TITULAR') {
          subTit = doc.horasContrato;
        } else {
          subCon = doc.horasContrato;
        }
      }

      // Horas PIE cronológicas directas (Dec. 170 / Trabajo Colaborativo)
      const pieCronologicas = Math.max(hColabDoc, pedTrabajoColab, hCoordPie, (doc.estamento === 'DOCENTE_DIFERENCIAL' || ((pieTit + pieCon > 0) && pedAulaRegular === 0) ? (pieTit + pieCon) : (pieTit + pieCon > 0 ? (pieTit + pieCon) : 0)));
      // Horas SEP exentas (talleres específicos fuera de aula regular / financiamiento SEP)
      const sepExentas = Math.max(hTallerSepDoc, pedTallerSep);

      const hInstNoAula = hDir + hInsp + hTec + hCoord + hConv + hExtra;
      const hExentas = hInstNoAula + sepExentas + pieCronologicas;
      const horasDocenciaNeta = Math.max(0, doc.horasContrato - hExentas);

      const regimen: '65/35' | '60/40' = colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35';
      const regimenTabla = regimen === '60/40' ? '60_40' : '65_35';

      // Proporción evaluada sobre horas de aula regular
      const calculo = horasDocenciaNeta > 0
        ? calcularJornadaMinutos(horasDocenciaNeta, pedAulaRegular, regimenTabla)
        : {
            horasContrato: 0,
            minutosContratoTotales: 0,
            horasPedagogicasDisponiblesMax: 0,
            minutosLectivosDisponiblesMax: 0,
            horasPedagogicasAsignadas: pedAulaRegular,
            minutosLectivosAsignados: pedAulaRegular * 45,
            horasPedagogicasVacantes: 0,
            minutosLectivosVacantes: 0,
            minutosRecreoAsignados: 0,
            minutosNoLectivosCalculados: 0,
            minutosUsadosTotales: 0,
            esSobreasignado: pedAulaRegular > 0,
            minutosSobreasignados: pedAulaRegular * 45,
            cumple65_35: pedAulaRegular === 0
          };

      const valSobre = horasDocenciaNeta > 0
        ? validarSobreasignacionDocente(horasDocenciaNeta, pedAulaRegular, regimen)
        : {
            estaSobreasignado: pedAulaRegular > 0,
            horasAsignadas: pedAulaRegular,
            horasMaxLectivasPermitidas: 0,
            excesoHoras: pedAulaRegular,
            mensaje: ''
          };
      const cursosColegio = (cursos || []).filter(c => c.rbd === colegio.rbd);

      const horasAula65_35 = asigsAulaRegular
        .filter(a => {
          const c = cursosColegio.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const horasAula60_40 = asigsAulaRegular
        .filter(a => {
          const c = cursosColegio.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const auditMulti = calcularAuditoriaDocenteMultitramo({
        horasAula65_35,
        horasAula60_40,
        horasPieCronologicas: pieCronologicas,
        horasTallerSepExento: sepExentas,
        horasPieSepCronologicas: pieCronologicas,
        horasNoAulaInstitucionales: hInstNoAula,
        horasContratoReal: doc.horasContrato
      });

      totalSubvTitular += subTit;
      totalSubvContrata += subCon;
      totalSepTitular += sepTit;
      totalSepContrata += sepCon;
      totalPieTitular += pieTit;
      totalPieContrata += pieCon;

      totalHorasSlep += doc.horasContrato;
      totalPedAula += pedTotalAsignadas;
      totalAulaRegular += pedAulaRegular;
      totalCoDocencia += pedCoDocencia;
      totalTallerSep += (hTallerSepDoc || pedTallerSep);
      totalTrabajoColaborativo += (hColabDoc || pedTrabajoColab);
      totalInstitucionalesNoAula += hInstNoAula;

      contratos.push({
        colegio,
        docente: doc,
        asignaciones: asigsColegio,
        horasDocenciaNeta,
        horasDirectivas: hDir,
        horasInspectorGeneral: hInsp,
        horasTecnicoPedagogicas: hTec,
        horasCoordinacion: hCoord,
        horasTallerSep: sepExentas,
        horasTrabajoColaborativo: pieCronologicas,
        horasCoDocencia: pedCoDocencia,
        horasAulaRegular: pedAulaRegular,
        esExentoProporcion: horasDocenciaNeta === 0,
        horasPedagogicasAsignadas: pedTotalAsignadas,
        regimen,
        maxHorasPedagogicasMineduc: calculo.horasPedagogicasDisponiblesMax,
        minutosLectivosMineduc: calculo.minutosLectivosDisponiblesMax,
        minutosRecreoMineduc: auditMulti.minutosRecreoTotal || calculo.minutosRecreoAsignados,
        minutosNoLectivosMineduc: auditMulti.minutosHnlTotal || calculo.minutosNoLectivosCalculados,
        minutosTotalesContrato: Math.round(doc.horasContrato * 60),
        estaSobreasignado: valSobre.estaSobreasignado || auditMulti.esInfractorExcesoLectivo,
        excesoHorasAula: valSobre.excesoHoras,
        fuentesFinanciamiento: {
          subvencionGeneralTitular: subTit,
          subvencionGeneralContrata: subCon,
          sepTitular: sepTit,
          sepContrata: sepCon,
          pieTitular: pieTit,
          pieContrata: pieCon,
          total: doc.horasContrato
        },
        horasAula65_35,
        horasAula60_40,
        horasPieCronologicas: pieCronologicas,
        horasTallerSepExento: sepExentas,
        horasPieSepCronologicas: pieCronologicas,
        contratoCalculadoTotal: auditMulti.contratoCalculadoTotal,
        contratoReq65_35: auditMulti.req65_35,
        contratoReq60_40: auditMulti.req60_40,
        contratoPonderado65_35: auditMulti.contratoPonderado65_35,
        contratoPonderado60_40: auditMulti.contratoPonderado60_40,
        minutosHnlPlanificacion40: auditMulti.minutosHnlPlanificacion40,
        porcentajeLectivoReal: auditMulti.porcentajeLectivoReal,
        porcentajeLimitePonderado: auditMulti.porcentajeLimitePonderado,
        esInfractorExcesoLectivo: auditMulti.esInfractorExcesoLectivo,
        saldoHoras: auditMulti.saldoHoras,
        estadoSaldo: auditMulti.estadoSaldo
      });
    }

    const excede = totalHorasSlep > 44;
    const exceso = Math.max(0, totalHorasSlep - 44);

    const colegiosNombres = Array.from(new Set(contratos.map(c => c.colegio.nombre)));

    resultado.push({
      run,
      nombres: primerDoc.nombres,
      apellidos: primerDoc.apellidos,
      titulo: primerDoc.titulo,
      estamentoPrincipal: primerDoc.estamento,
      contratos,
      horasTotalesSlep: totalHorasSlep,
      excedeLimiteSlep: excede,
      excesoHorasSlep: exceso,
      colegiosNombres,
      totalHorasPedagogicasAula: totalPedAula,
      totalHorasAulaRegular: totalAulaRegular,
      totalHorasCoDocencia: totalCoDocencia,
      totalHorasTallerSep: totalTallerSep,
      totalHorasTrabajoColaborativo: totalTrabajoColaborativo,
      totalHorasInstitucionalesNoAula: totalInstitucionalesNoAula,
      resumenFinanciamiento: {
        subvencionGeneralTitular: totalSubvTitular,
        subvencionGeneralContrata: totalSubvContrata,
        sepTitular: totalSepTitular,
        sepContrata: totalSepContrata,
        pieTitular: totalPieTitular,
        pieContrata: totalPieContrata,
        subvencionGeneral: totalSubvTitular + totalSubvContrata,
        sep: totalSepTitular + totalSepContrata,
        pie: totalPieTitular + totalPieContrata,
        titular: totalSubvTitular + totalSepTitular + totalPieTitular,
        contrata: totalSubvContrata + totalSepContrata + totalPieContrata,
        total: totalHorasSlep
      }
    });
  }

  // Ordenar por apellidos, nombres
  return resultado.sort((a, b) => {
    const ap = a.apellidos.localeCompare(b.apellidos);
    if (ap !== 0) return ap;
    return a.nombres.localeCompare(b.nombres);
  });
}
