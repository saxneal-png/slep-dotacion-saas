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
import { normalizarRut } from '../utils/rutUtils';

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
    horasSepSinAsignar?: number;
    horasPieSinAsignar?: number;
    horasSubvGeneralSinAsignar?: number;
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

    let hDirEfectivo = hDir;
    let hInspEfectivo = hInsp;
    let hTecEfectivo = hTec;
    let hCoordEfectivo = hCoord;
    if (doc.funcionesNoAula && doc.funcionesNoAula.length > 0) {
      hDirEfectivo = doc.funcionesNoAula.filter(f => f.tipo === 'DIRECTIVA').reduce((s, f) => s + Number(f.horas || 0), 0);
      hInspEfectivo = doc.funcionesNoAula.filter(f => f.tipo === 'INSPECTORIA').reduce((s, f) => s + Number(f.horas || 0), 0);
      hTecEfectivo = doc.funcionesNoAula.filter(f => f.tipo === 'UTP' || f.tipo === 'EVALUACION' || f.tipo === 'ORIENTACION').reduce((s, f) => s + Number(f.horas || 0), 0);
      hCoordEfectivo = doc.funcionesNoAula.filter(f => f.tipo === 'COORDINACION' || f.tipo === 'CONVIVENCIA' || f.tipo === 'CRA' || f.tipo === 'ENLACES' || f.tipo === 'EXTRAESCOLAR' || f.tipo === 'GREMIAL' || f.tipo === 'ADMINISTRATIVA' || f.tipo === 'OTRA').reduce((s, f) => s + Number(f.horas || 0), 0);
    }

    // Inferencia automática de horas institucionales para Directores, Inspectores y Jefes UTP
    const docNombreCompleto = `${doc.nombres} ${doc.apellidos}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const docApellidosNombres = `${doc.apellidos} ${doc.nombres}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const directorColegioNorm = (est?.director || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const esDirectorPorNombre = Boolean(directorColegioNorm && (docNombreCompleto.includes(directorColegioNorm) || directorColegioNorm.includes(docNombreCompleto) || docApellidosNombres.includes(directorColegioNorm)));
    const esCargoDirector = Boolean(doc.cargoInstitucional && /director|directora|rector/i.test(doc.cargoInstitucional)) || doc.estamento === 'DIRECTIVO';
    const esInspectorGeneral = Boolean(doc.cargoInstitucional && /inspector/i.test(doc.cargoInstitucional));
    const esJefeUtp = Boolean(doc.cargoInstitucional && /utp|tecnico pedag/i.test(doc.cargoInstitucional)) || doc.estamento === 'TECNICO_PEDAGOGICO';

    const docenteAsigs = asignaciones.filter(a => a.docenteId === doc.id);
    if (hDirEfectivo === 0 && (esDirectorPorNombre || esCargoDirector) && docenteAsigs.length === 0) {
      hDirEfectivo = doc.horasContrato;
    } else if (hInspEfectivo === 0 && esInspectorGeneral && docenteAsigs.length === 0) {
      hInspEfectivo = doc.horasContrato;
    } else if (hTecEfectivo === 0 && esJefeUtp && docenteAsigs.length === 0) {
      hTecEfectivo = doc.horasContrato;
    }

    horasDirectivasTotales += hDirEfectivo;
    horasInspectorGeneralTotales += hInspEfectivo;
    horasTecnicoPedagogicasTotales += hTecEfectivo;
    horasCoordinacionTotales += hCoordEfectivo;

    // Clasificar asignaciones del docente en este establecimiento
    const coDocenteAsigs = asignaciones.filter(a => a.coDocenteId === doc.id && a.tieneCoDocente);

    const asigsCoDocencia = [
      ...docenteAsigs.filter(a => a.esCoDocencia || a.esAgrupacionFlexible || a.tipoApoyo === 'CO_DOCENCIA' || a.tipoApoyo === 'AGRUPACION_FLEXIBLE' || a.tipoApoyo === 'REFUERZO_AULA' || a.tipoApoyo === 'APOYO_DOCENTE'),
      ...coDocenteAsigs
    ];
    const asigsTallerSep = docenteAsigs.filter(a => (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP') && !asigsCoDocencia.includes(a));
    const asigsTrabajoColaborativo = docenteAsigs.filter(
      a => a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO' || a.asignatura.toLowerCase().includes('colaborativ')
    );

    const subTotalDoc = Number(doc.horasSubvencionGeneralTitular || 0) + Number(doc.horasSubvencionGeneralContrata || 0);
    const contratoSepDoc = Number(doc.horasSepTitular || 0) + Number(doc.horasSepContrata || 0);
    const contratoPieDoc = Number(doc.horasPieTitular || 0) + Number(doc.horasPieContrata || 0);

    const isPieDoc = doc.estamento === 'DOCENTE_DIFERENCIAL' || (contratoPieDoc > 0 && subTotalDoc === 0 && contratoSepDoc === 0);
    const isSepDoc = contratoSepDoc > 0 && contratoPieDoc === 0 && subTotalDoc === 0;

    const isSepFin = (f: any) => {
      if (f.financiamiento && /sep/i.test(f.financiamiento)) return true;
      if (f.tipo === 'COORDINACION_SEP') return true;
      return false;
    };

    const isPieFin = (f: any) => {
      if (f.financiamiento && /pie/i.test(f.financiamiento)) return true;
      if (f.tipo === 'COORDINACION_PIE') return true;
      if (f.nombre && /\bpie\b/i.test(f.nombre)) return true;
      if (isPieDoc && (!f.financiamiento || f.financiamiento === 'PIE')) return true;
      return false;
    };

    // Clasificación de asignaciones:
    // Si la asignación está explícitamente marcada como SEP o el docente es 100% SEP, se clasifica como SEP (nunca como PIE)
    const esSepAsig = (a: any) => Boolean(
      a.esTallerSep || 
      a.tipoApoyo === 'TALLER_SEP' || 
      (a.tipoApoyo && /sep/i.test(a.tipoApoyo)) || 
      (a.asignatura && /sep/i.test(a.asignatura)) ||
      (isSepDoc && !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.asignatura || '') && !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.tipoApoyo || ''))
    );

    const esPieAsig = (a: any) => !esSepAsig(a) && Boolean(
      (a.horasCronologicasPie && a.horasCronologicasPie > 0) || 
      (a.tipoApoyo && /pie|decreto 170|aula de recurso|apoyo especializado|cl[ií]nico/i.test(a.tipoApoyo)) || 
      (a.asignatura && /pie|decreto 170|aula de recurso/i.test(a.asignatura)) ||
      doc.estamento === 'DOCENTE_DIFERENCIAL' || 
      (contratoPieDoc > 0 && subTotalDoc === 0 && contratoSepDoc === 0)
    );

    const asigsCoDocenciaPie = asigsCoDocencia.filter(a => esPieAsig(a));
    const asigsCoDocenciaSep = asigsCoDocencia.filter(a => !asigsCoDocenciaPie.includes(a) && (esSepAsig(a) || isSepDoc));
    const asigsCoDocenciaSubvGen = asigsCoDocencia.filter(a => 
      !asigsCoDocenciaPie.includes(a) && 
      !asigsCoDocenciaSep.includes(a)
    );

    const asigsAulaRegular = [
      ...docenteAsigs.filter(a => !asigsCoDocencia.includes(a) && !asigsTallerSep.includes(a) && !asigsTrabajoColaborativo.includes(a)),
      ...asigsCoDocenciaSubvGen
    ];

    const pedAulaRegular = asigsAulaRegular.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedCoDocencia = asigsCoDocencia.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedTallerSep = asigsTallerSep.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedTrabajoColab = asigsTrabajoColaborativo.reduce((sum, a) => sum + a.horasPedagogicasAula, 0);
    const pedTotalAsignadas = [
      ...docenteAsigs,
      ...coDocenteAsigs
    ].reduce((sum, a) => sum + a.horasPedagogicasAula, 0);

    // Solo las horas de aula regular lectivas se comparan con la demanda curricular del plan
    horasLectivasAsignadas += pedAulaRegular;

    const sumFuncionesNoAulaSep = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
      ? doc.funcionesNoAula.filter(f => isSepFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;
    const sumFuncionesNoAulaPie = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
      ? doc.funcionesNoAula.filter(f => isPieFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;
    const sumFuncionesNoAulaSubvGen = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
      ? doc.funcionesNoAula.filter(f => !isSepFin(f) && !isPieFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : (hDir + hInsp + hTec + hCoord + hConv + hExtra);

    // Conversión rigurosa de horas cronológicas
    const cronTrabajoColab = asigsTrabajoColaborativo.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
    const cronCoDocenciaPie = asigsCoDocenciaPie.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
    const cronCoDocenciaSep = asigsCoDocenciaSep.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
    const cronTallerSep = asigsTallerSep.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
    const cronApoyoPie = Math.round((cronTrabajoColab + cronCoDocenciaPie) * 10) / 10;
    const cronSepTotal = Math.round((cronCoDocenciaSep + cronTallerSep) * 10) / 10;

    // Docencia efectiva de aula lectiva que requiere proporción Ley 20.903 (HNL + recreos)
    // Para docentes con contrato SEP estándar de aula (como Laura de la Hoz y Valentina Alarcón), las horas de aula (co-docencia y talleres) forman parte de su carga lectiva regulada
    const asigsTallerSepLectivos = (hTallerSepDoc > 0) ? [] : asigsTallerSep;
    const asigsCandidatasAula = [...asigsAulaRegular, ...asigsCoDocenciaSep, ...asigsTallerSepLectivos];
    const pedCandidatas = asigsCandidatasAula.reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const esSepProporcional = isSepDoc && (doc.horasContrato > 0 && buscarContratoMinimoPorTabla(pedCandidatas, regimenTabla) <= doc.horasContrato);

    const asigsDocenciaAulaEfectiva = (isPieDoc || (isSepDoc && !esSepProporcional))
      ? asigsAulaRegular
      : asigsCandidatasAula;

    const sepExentas = (isPieDoc || (isSepDoc && !esSepProporcional))
      ? Math.max(contratoSepDoc, hTallerSepDoc, cronSepTotal + sumFuncionesNoAulaSep)
      : (hTallerSepDoc + sumFuncionesNoAulaSep);

    const pieCronologicas = isPieDoc
      ? Math.max(contratoPieDoc, hColabDoc + hCoordPie, cronApoyoPie + sumFuncionesNoAulaPie)
      : Math.max(cronApoyoPie + sumFuncionesNoAulaPie, hColabDoc + hCoordPie);

    const hInstNoAula = sumFuncionesNoAulaSubvGen;
    const hExentas = hInstNoAula + sepExentas + pieCronologicas;
    const horasParaDocenciaAula = Math.max(0, doc.horasContrato - hExentas);

    // Separar horas de docencia efectiva según régimen del curso (60/40 vs 65/35) para cálculo independiente
    const ped60 = asigsDocenciaAulaEfectiva
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion === '60_40' : (est.porcentajePrioritarios >= 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const ped65 = asigsDocenciaAulaEfectiva
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion !== '60_40' : (est.porcentajePrioritarios < 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const auditDoc = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: ped65,
      horasAula60_40: ped60,
      horasPieCronologicas: pieCronologicas,
      horasTallerSepExento: sepExentas,
      horasPieSepCronologicas: pieCronologicas,
      horasNoAulaInstitucionales: hInstNoAula,
      horasContratoReal: doc.horasContrato,
      aplicaArticulo69: Boolean(doc.aplicaArticulo69)
    });

    const maxHAPermitidas = Math.floor(auditDoc.minutosLimitePermitido / 45);
    horasLectivasDisponibles += maxHAPermitidas;

    const totalHADocente = ped65 + ped60;
    if (auditDoc.esInfractorExcesoLectivo || (doc.horasContrato > 0 && auditDoc.saldoHoras < 0)) {
      const exceso = Math.max(0, totalHADocente - maxHAPermitidas);
      sobreasignacionesAlertas.push(
        `${doc.nombres} ${doc.apellidos} (${doc.run}): Asignadas ${totalHADocente} HA efectivas (${ped65} HA en 65/35 + ${ped60} HA en 60/40) de máx ${maxHAPermitidas} HA (+${exceso} HA).`
      );
    }

    if (doc.aplicaArticulo69 && totalHADocente > 32) {
      sobreasignacionesAlertas.push(
        `ALERTA ARTÍCULO 69: ${doc.nombres} ${doc.apellidos} (${doc.run}): Asignadas ${totalHADocente} HA, excediendo el tope legal de 24h cronológicas aula (32 HA).`
      );
    }

    // Auditoría Financiera: El Plan de Estudio y talleres JEC deben financiarse exclusivamente con Subvención General
    const pedCurricular65 = asigsAulaRegular
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion !== '60_40' : (est.porcentajePrioritarios < 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const pedCurricular60 = asigsAulaRegular
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion === '60_40' : (est.porcentajePrioritarios >= 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const reqSubvDoc = buscarContratoMinimoPorTabla(pedCurricular65, '65_35') + buscarContratoMinimoPorTabla(pedCurricular60, '60_40') + sumFuncionesNoAulaSubvGen;
    const sepPieTotalDoc = contratoSepDoc + contratoPieDoc;
    if (reqSubvDoc > subTotalDoc && sepPieTotalDoc > 0 && pedAulaRegular > 0) {
      const defSub = reqSubvDoc - subTotalDoc;
      sobreasignacionesAlertas.push(
        `ALERTA FINANCIERA: ${doc.nombres} ${doc.apellidos} (${doc.run}): Imparte ${pedAulaRegular} HA de Plan de Estudio / JEC que exigen ${reqSubvDoc}h de Subvención General, pero solo tiene ${subTotalDoc}h de Subv. General (Déficit de ${defSub}h pagadas improcedentemente con fondos SEP o PIE).`
      );
    }

    // Requerimientos específicos por fuente de financiamiento
    const asigsSepAula = isPieDoc ? [] : [
      ...asigsCoDocenciaSep,
      ...asigsTallerSep
    ];
    const pedSep65 = asigsSepAula
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion !== '60_40' : (est.porcentajePrioritarios < 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const pedSep60 = asigsSepAula
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion === '60_40' : (est.porcentajePrioritarios >= 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const reqSepDoc = (pedSep65 > 0 || pedSep60 > 0)
      ? (buscarContratoMinimoPorTabla(pedSep65, '65_35') + buscarContratoMinimoPorTabla(pedSep60, '60_40') + sumFuncionesNoAulaSep)
      : (isSepDoc ? Math.max(contratoSepDoc, hTallerSepDoc, cronSepTotal + sumFuncionesNoAulaSep) : (sumFuncionesNoAulaSep + hTallerSepDoc));

    // Carga total de trabajo calculada por auditoría oficial
    const cargaTotalTrabajo = auditDoc.contratoCalculadoTotal;
    const horasVacantesFuncionario = Math.max(0, doc.horasContrato - cargaTotalTrabajo);

    const horasSepSinAsignarDoc = Math.max(0, contratoSepDoc - reqSepDoc);
    const horasPieSinAsignarDoc = Math.max(0, contratoPieDoc - (isPieDoc ? Math.max(contratoPieDoc, cronApoyoPie + sumFuncionesNoAulaPie) : (cronTrabajoColab + sumFuncionesNoAulaPie + hColabDoc + hCoordPie)));
    const horasSubvGenSinAsignarDoc = Math.max(0, subTotalDoc - reqSubvDoc);

    return {
      docente: doc,
      horasPedagogicasAsignadas: pedTotalAsignadas,
      horasAulaRegular: pedAulaRegular,
      horasCoDocencia: pedCoDocencia,
      horasTallerSep: pedTallerSep,
      horasTrabajoColaborativo: pedTrabajoColab,
      horasDocenciaAfecta: horasParaDocenciaAula,
      horasExentas: hExentas,
      horasLectivasMaximas: maxHAPermitidas,
      estaSobreasignado: auditDoc.esInfractorExcesoLectivo || (doc.horasContrato > 0 && auditDoc.saldoHoras < 0),
      excesoHoras: Math.max(0, totalHADocente - maxHAPermitidas),
      horasVacantes: horasVacantesFuncionario,
      horasSepSinAsignar: horasSepSinAsignarDoc,
      horasPieSinAsignar: horasPieSinAsignarDoc,
      horasSubvGeneralSinAsignar: horasSubvGenSinAsignarDoc
    };
  });

  // 5. Diagnóstico por Especialidad (solo docencia del plan regular; la co-docencia, independiente de su financiamiento, y los talleres exentos no suman a las horas del plan de estudio)
  const asignadoPorAsignatura: { [asig: string]: { horas: number; docentes: string[] } } = {};
  for (const asig of asignaciones) {
    const esCoDoc = Boolean(
      asig.esCoDocencia ||
      asig.esAgrupacionFlexible ||
      asig.tipoApoyo === 'CO_DOCENCIA' ||
      asig.tipoApoyo === 'AGRUPACION_FLEXIBLE' ||
      asig.tipoApoyo === 'REFUERZO_AULA' ||
      asig.tipoApoyo === 'APOYO_DOCENTE' ||
      (asig.asignatura && /co.*docenc|codocenc|agrupaci/i.test(asig.asignatura))
    );
    const esSep = Boolean(asig.esTallerSep || asig.tipoApoyo === 'TALLER_SEP');
    const esColab = Boolean(asig.esTrabajoColaborativo || asig.tipoApoyo === 'TRABAJO_COLABORATIVO' || (asig.asignatura && /colaborativ/i.test(asig.asignatura)));
    const esPie = Boolean((asig.asignatura && /pie/i.test(asig.asignatura)) || (asig.horasCronologicasPie && asig.horasCronologicasPie > 0));

    // La co-docencia, independiente de la subvención con la que se financie, no debe sumar a las horas del plan de estudio del curso
    if (esCoDoc || esSep || esColab || esPie) {
      continue;
    }

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
    const runLimpio = normalizarRut(d.run);
    if (!runLimpio) continue;
    if (!docentesPorRun[runLimpio]) {
      docentesPorRun[runLimpio] = [];
    }
    docentesPorRun[runLimpio].push(d);
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
          run: list[0].run,
          docenteNombre: `${list[0].nombres} ${list[0].apellidos}`,
          colegiosInvolucrados: nombresColegios,
          horasTotalesSumadas: horasTotales,
          descripcion: `Infracción Territorial: El docente suma ${horasTotales} hrs semanales entre múltiples escuelas (Límite legal del Estatuto Docente es 44 hrs).`
        });
      } else {
        inconsistencias.push({
          tipo: 'RUT_DUPLICADO',
          run: list[0].run,
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
    const cleanRun = normalizarRut(d.run);
    if (!cleanRun) continue;
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

      const asigsCoDocencia = asigsColegio.filter(
        a => (a.coDocenteId === doc.id && a.tieneCoDocente) || (a.docenteId === doc.id && (a.esCoDocencia || a.esAgrupacionFlexible || a.tipoApoyo === 'CO_DOCENCIA' || a.tipoApoyo === 'AGRUPACION_FLEXIBLE' || a.tipoApoyo === 'REFUERZO_AULA' || a.tipoApoyo === 'APOYO_DOCENTE'))
      );
      const asigsTallerSep = asigsColegio.filter(
        a => a.docenteId === doc.id && (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP') && !asigsCoDocencia.includes(a)
      );
      const asigsTrabajoColaborativo = asigsColegio.filter(
        a => a.docenteId === doc.id && (a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO' || a.asignatura.toLowerCase().includes('colaborativ'))
      );

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

      const subTotalDoc = subTit + subCon;
      const contratoSepDoc = sepTit + sepCon;
      const contratoPieDoc = pieTit + pieCon;

      const isPieDoc = doc.estamento === 'DOCENTE_DIFERENCIAL' || (contratoPieDoc > 0 && subTotalDoc === 0 && contratoSepDoc === 0);
      const isSepDoc = contratoSepDoc > 0 && contratoPieDoc === 0 && subTotalDoc === 0;

      const isSepFin = (f: any) => {
        if (f.financiamiento && /sep/i.test(f.financiamiento)) return true;
        if (f.tipo === 'COORDINACION_SEP') return true;
        return false;
      };

      const isPieFin = (f: any) => {
        if (f.financiamiento && /pie/i.test(f.financiamiento)) return true;
        if (f.tipo === 'COORDINACION_PIE') return true;
        if (f.nombre && /\bpie\b/i.test(f.nombre)) return true;
        if (isPieDoc && (!f.financiamiento || f.financiamiento === 'PIE')) return true;
        return false;
      };

      // Clasificación de asignaciones:
      // Si la asignación está explícitamente marcada como SEP o el docente es 100% SEP, se clasifica como SEP (nunca como PIE)
      const esSepAsig = (a: any) => Boolean(
        a.esTallerSep || 
        a.tipoApoyo === 'TALLER_SEP' || 
        (a.tipoApoyo && /sep/i.test(a.tipoApoyo)) || 
        (a.asignatura && /sep/i.test(a.asignatura)) ||
        (isSepDoc && !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.asignatura || '') && !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.tipoApoyo || ''))
      );

      const esPieAsig = (a: any) => !esSepAsig(a) && Boolean(
        (a.horasCronologicasPie && a.horasCronologicasPie > 0) || 
        (a.tipoApoyo && /pie|decreto 170|aula de recurso|apoyo especializado|cl[ií]nico/i.test(a.tipoApoyo)) || 
        (a.asignatura && /pie|decreto 170|aula de recurso/i.test(a.asignatura)) ||
        doc.estamento === 'DOCENTE_DIFERENCIAL' || 
        (contratoPieDoc > 0 && subTotalDoc === 0 && contratoSepDoc === 0)
      );

      const asigsCoDocenciaPie = asigsCoDocencia.filter(a => esPieAsig(a));
      const asigsCoDocenciaSep = asigsCoDocencia.filter(a => !asigsCoDocenciaPie.includes(a) && (esSepAsig(a) || isSepDoc));
      const asigsCoDocenciaSubvGen = asigsCoDocencia.filter(a => 
        !asigsCoDocenciaPie.includes(a) && 
        !asigsCoDocenciaSep.includes(a)
      );

      const asigsAulaRegular = [
        ...asigsColegio.filter(a => a.docenteId === doc.id && !asigsCoDocencia.includes(a) && !asigsTallerSep.includes(a) && !asigsTrabajoColaborativo.includes(a)),
        ...asigsCoDocenciaSubvGen
      ];

      const pedAulaRegular = asigsAulaRegular.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedCoDocencia = asigsCoDocencia.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTallerSep = asigsTallerSep.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTrabajoColab = asigsTrabajoColaborativo.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTotalAsignadas = asigsColegio.reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const hDir = doc.horasDirectivas || 0;
      const hInsp = doc.horasInspectorGeneral || 0;
      const hTec = doc.horasTecnicoPedagogicas || 0;
      const hCoord = doc.horasCoordinacion || 0;
      const hCoordPie = doc.horasCoordinacionPie || 0;
      const hConv = doc.horasConvivenciaEscolar || 0;
      const hExtra = doc.horasExtraescolar || 0;
      const hTallerSepDoc = doc.horasTallerSep || 0;
      const hColabDoc = doc.horasTrabajoColaborativo || 0;

      const sumFuncionesNoAulaSep = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
        ? doc.funcionesNoAula.filter(f => isSepFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
        : 0;
      const sumFuncionesNoAulaPie = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
        ? doc.funcionesNoAula.filter(f => isPieFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
        : 0;
      const sumFuncionesNoAulaSubvGen = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
        ? doc.funcionesNoAula.filter(f => !isSepFin(f) && !isPieFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
        : (hDir + hInsp + hTec + hCoord + hConv + hExtra);

      // Conversión rigurosa de horas cronológicas
      const cronTrabajoColab = asigsTrabajoColaborativo.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
      const cronCoDocenciaPie = asigsCoDocenciaPie.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
      const cronCoDocenciaSep = asigsCoDocenciaSep.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
      const cronTallerSep = asigsTallerSep.reduce((s, a) => s + (a.horasCronologicasPie ?? Math.round(a.horasPedagogicasAula * 0.75 * 10) / 10), 0);
      const cronApoyoPie = Math.round((cronTrabajoColab + cronCoDocenciaPie) * 10) / 10;
      const cronSepTotal = Math.round((cronCoDocenciaSep + cronTallerSep) * 10) / 10;

      const regimen: '65/35' | '60/40' = colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35';
      const regimenTabla = regimen === '60/40' ? '60_40' : '65_35';

      // Docencia efectiva de aula lectiva que requiere proporción Ley 20.903 (HNL + recreos)
      // Para docentes con contrato SEP estándar de aula (como Laura de la Hoz y Valentina Alarcón), las horas de aula (co-docencia y talleres) forman parte de su carga lectiva regulada
      const asigsTallerSepLectivos = (hTallerSepDoc > 0) ? [] : asigsTallerSep;
      const asigsCandidatasAula = [...asigsAulaRegular, ...asigsCoDocenciaSep, ...asigsTallerSepLectivos];
      const pedCandidatas = asigsCandidatasAula.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const esSepProporcional = isSepDoc && (doc.horasContrato > 0 && buscarContratoMinimoPorTabla(pedCandidatas, regimenTabla) <= doc.horasContrato);

      const asigsDocenciaAulaEfectiva = (isPieDoc || (isSepDoc && !esSepProporcional))
        ? asigsAulaRegular
        : asigsCandidatasAula;

      const sepExentas = (isPieDoc || (isSepDoc && !esSepProporcional))
        ? Math.max(contratoSepDoc, hTallerSepDoc, cronSepTotal + sumFuncionesNoAulaSep)
        : (hTallerSepDoc + sumFuncionesNoAulaSep);

      const pieCronologicas = isPieDoc
        ? Math.max(contratoPieDoc, hColabDoc + hCoordPie, cronApoyoPie + sumFuncionesNoAulaPie)
        : Math.max(cronApoyoPie + sumFuncionesNoAulaPie, hColabDoc + hCoordPie);

      const hInstNoAula = sumFuncionesNoAulaSubvGen;
      const hExentas = hInstNoAula + sepExentas + pieCronologicas;
      const horasDocenciaNeta = Math.max(0, doc.horasContrato - hExentas);

      // Proporción evaluada sobre horas de aula regular
      const calculo = horasDocenciaNeta > 0
        ? calcularJornadaMinutos(horasDocenciaNeta, pedAulaRegular, regimenTabla, Boolean(doc.aplicaArticulo69))
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
            cumple65_35: pedAulaRegular === 0,
            aplicaArticulo69: Boolean(doc.aplicaArticulo69),
            minutosReduccionArticulo69: 0,
            horasReduccionArticulo69: 0
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

      const horasAula65_35 = asigsDocenciaAulaEfectiva
        .filter(a => {
          const c = cursosColegio.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const horasAula60_40 = asigsDocenciaAulaEfectiva
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
        horasContratoReal: doc.horasContrato,
        aplicaArticulo69: Boolean(doc.aplicaArticulo69)
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

      // Auditoría Financiera: Restricción de financiamiento de Plan de Estudio y JEC con SEP/PIE
      const pedCurricular65 = asigsAulaRegular
        .filter(a => {
          const c = cursosColegio.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedCurricular60 = asigsAulaRegular
        .filter(a => {
          const c = cursosColegio.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const horasAulaPlanEstudioYJec = pedAulaRegular;
      const contratoReqSubvencionGeneral = buscarContratoMinimoPorTabla(pedCurricular65, '65_35') + buscarContratoMinimoPorTabla(pedCurricular60, '60_40') + sumFuncionesNoAulaSubvGen;
      const subvencionGeneralContratoTotal = subTit + subCon;
      const sepPieContratoTotal = sepTit + sepCon + pieTit + pieCon;

      let deficitSubvencionGeneral = 0;
      let esImprocedenteFinanciamientoSepPie = false;
      let alertaFinanciamientoSepPie = '';

      if (contratoReqSubvencionGeneral > subvencionGeneralContratoTotal && sepPieContratoTotal > 0 && horasAulaPlanEstudioYJec > 0) {
        deficitSubvencionGeneral = contratoReqSubvencionGeneral - subvencionGeneralContratoTotal;
        esImprocedenteFinanciamientoSepPie = true;
        alertaFinanciamientoSepPie = `Improcedencia Financiera: El docente imparte ${horasAulaPlanEstudioYJec} HA de Plan de Estudio / JEC que exigen ${contratoReqSubvencionGeneral}h de Subvención General, pero su contrato solo dispone de ${subvencionGeneralContratoTotal}h de Subv. General (Déficit: ${deficitSubvencionGeneral}h cubiertas improcedentemente con fondos SEP o PIE).`;
      }

      const maxPermitidasDoc = Math.floor(auditMulti.minutosLimitePermitido / 45);

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
        maxHorasPedagogicasMineduc: doc.aplicaArticulo69 ? Math.min(maxPermitidasDoc, 32) : maxPermitidasDoc,
        minutosLectivosMineduc: doc.aplicaArticulo69 ? Math.min(auditMulti.minutosLectivosTablaTotal, 1440) : auditMulti.minutosLectivosTablaTotal,
        minutosRecreoMineduc: auditMulti.minutosRecreoTotal,
        minutosNoLectivosMineduc: auditMulti.minutosHnlTotal,
        minutosTotalesContrato: Math.round(doc.horasContrato * 60),
        estaSobreasignado: auditMulti.esInfractorExcesoLectivo || (doc.horasContrato > 0 && auditMulti.saldoHoras < 0),
        excesoHorasAula: Math.max(0, pedAulaRegular - (doc.aplicaArticulo69 ? Math.min(maxPermitidasDoc, 32) : maxPermitidasDoc)),
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
        estadoSaldo: auditMulti.estadoSaldo,
        horasAulaPlanEstudioYJec,
        contratoReqSubvencionGeneral,
        subvencionGeneralContratoTotal,
        deficitSubvencionGeneral,
        esImprocedenteFinanciamientoSepPie,
        alertaFinanciamientoSepPie,
        funcionesNoAula: doc.funcionesNoAula,
        aplicaArticulo69: Boolean(doc.aplicaArticulo69),
        horasReduccionArticulo69: auditMulti.horasReduccionArticulo69 || calculo.horasReduccionArticulo69 || 0,
        minutosReduccionArticulo69: auditMulti.minutosReduccionArticulo69 || calculo.minutosReduccionArticulo69 || 0,
        horasSepSinAsignar: Math.max(0, contratoSepDoc - (cronSepTotal + sumFuncionesNoAulaSep + hTallerSepDoc)),
        horasPieSinAsignar: Math.max(0, contratoPieDoc - (cronApoyoPie + sumFuncionesNoAulaPie + hColabDoc + hCoordPie)),
        horasSubvGeneralSinAsignar: Math.max(0, subTotalDoc - (auditMulti.req65_35 + auditMulti.req60_40 + sumFuncionesNoAulaSubvGen))
      });
    }

    const excede = totalHorasSlep > 44;
    const exceso = Math.max(0, totalHorasSlep - 44);

    const colegiosNombres = Array.from(new Set(contratos.map(c => c.colegio.nombre)));

    resultado.push({
      run: primerDoc.run,
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
      funcionesNoAula: primerDoc.funcionesNoAula,
      aplicaArticulo69: Boolean(primerDoc.aplicaArticulo69 || listaDocentes.some(d => d.aplicaArticulo69)),
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
