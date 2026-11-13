import { Docente, AsignacionHoraria, CursoSae } from '../types';
import {
  calcularAuditoriaDocenteMultitramo,
  buscarContratoMinimoPorTabla,
  esNivelParvulario,
  buscarContratoMinimoParvulariaPorMinutos,
  obtenerTramoMineduc
} from '@slep/mineduc-engine';

export type AuditoriaDocenteMultitramoResult = ReturnType<typeof calcularAuditoriaDocenteMultitramo>;

export interface AuditoriaIntegralDocenteResult {
  auditDoc: AuditoriaDocenteMultitramoResult;
  haRegular: number;
  haCoDocencia: number;
  haTallerSep: number;
  haTrabajoColab: number;
  haTotalAsignadas: number;
  haDocenciaEfectiva: number;
  ha65_35: number;
  ha60_40: number;
  maxHAPermitidas: number;
  horasNoLectivasCronologicas: number;
  horasRecreoCronologicas: number;
  horasInstitucionalesSubvGen: number;
  sepExentasCronologicas: number;
  pieCronologicas: number;
  horasExentasTotales: number;
  horasParaDocenciaAula: number;
  estaSobreasignado: boolean;
  esInfractorExcesoLectivo: boolean;
  saldoHoras: number;
  horasComprometidasDocente: number;
  horasLibresDocente: number;
  reqSubvGenDoc: number;
  reqSepDoc: number;
  pieAsignadasDoc: number;
  horasSubvGenSinAsignar: number;
  horasSepSinAsignar: number;
  horasPieSinAsignar: number;
  totalHorasSinAsignar: number;
  pedCurricularTitular: number;
  deficitSubvencionGeneral: number;
  esImprocedenteFinanciamientoSepPie: boolean;
  isEducadoraParvulo: boolean;
}

/**
 * Helper canónico para identificar a una Educadora de Párvulos (régimen DTO 306 en horas cronológicas de 60m).
 */
export function esDocenteEducadoraParvulos(doc: Docente): boolean {
  const rxParv = /p[aá]rvul[oa]|infantil|pre[- ]?b[aá]sica|preescolar|prek[ií]nder|k[ií]nder|\bnt[12]\b/i;
  return (
    doc.estamento === 'EDUCADORA_PARVULO' ||
    Boolean(doc.esEducadoraParvulo) ||
    Boolean(doc.cargoInstitucional && rxParv.test(doc.cargoInstitucional)) ||
    Boolean(doc.titulo && rxParv.test(doc.titulo)) ||
    Boolean(doc.funcionPrincipal && rxParv.test(doc.funcionPrincipal)) ||
    Boolean(doc.asignaturaPrincipal && rxParv.test(doc.asignaturaPrincipal))
  );
}

/**
 * Obtiene las horas pedagógicas de aula lectiva (45 min) de una asignación frente a curso,
 * corrigiendo conversiones duplicadas en asignaciones PIE.
 */
export function getHorasAulaLectivaAsig(a: AsignacionHoraria): number {
  if (
    a.horasPedagogicasAula &&
    a.horasCronologicasPie &&
    Math.abs(a.horasPedagogicasAula * 0.75 - a.horasCronologicasPie) < 0.1
  ) {
    return a.horasPedagogicasAula;
  }
  if (
    a.horasCronologicasPie &&
    a.horasPedagogicasAula === Math.round(a.horasCronologicasPie * 1.333)
  ) {
    return a.horasCronologicasPie;
  }
  return a.horasPedagogicasAula || a.horasCronologicasPie || 0;
}

export interface DesgloseHorasFueraAulaDocente {
  horasInstitucionalesSubvGen: number;
  sepExentasCronologicas: number;
  pieCronologicas: number;
  horasExentasTotales: number;
  horasParaDocenciaAula: number;
}

/**
 * Calcula con precisión las horas deducibles fuera del aula de un docente (Institucionales, SEP, PIE y exentas),
 * deduciéndolas de su contrato para obtener las horas de contrato realmente disponibles para docencia de aula.
 */
export function calcularHorasFueraAulaDocente(
  doc: Docente,
  asignacionesDocente: AsignacionHoraria[],
  porcentajePrioritariosColegio: number = 0
): DesgloseHorasFueraAulaDocente {
  const isSepFin = (f: any) => Boolean(f && (f.tipo === 'SEP' || f.financiamiento === 'SEP' || /sep/i.test(f.nombre || '') || /sep/i.test(f.tipo || '')));
  const isPieFin = (f: any) => Boolean(f && (f.tipo === 'PIE' || f.financiamiento === 'PIE' || /pie/i.test(f.nombre || '') || /pie/i.test(f.tipo || '')));

  const hContrato = Number(doc.horasContrato) || 0;
  const hDir = Number(doc.horasDirectivas) || 0;
  const hInsp = Number(doc.horasInspectorGeneral) || 0;
  const hTec = Number(doc.horasTecnicoPedagogicas) || 0;
  const hCoord = Number(doc.horasCoordinacion) || 0;
  const hCoordPie = Number(doc.horasCoordinacionPie) || 0;
  const hConv = Number(doc.horasConvivenciaEscolar) || 0;
  const hExtra = Number(doc.horasExtraescolar) || 0;
  const hTallerSepDoc = Number(doc.horasTallerSep) || 0;
  const hColabDoc = Number(doc.horasTrabajoColaborativo) || 0;

  const isDiferencialDoc = doc.estamento === 'DOCENTE_DIFERENCIAL';
  const isPieDoc =
    isDiferencialDoc ||
    (doc.horasPieTitular || 0) + (doc.horasPieContrata || 0) > 0;
  const isSepDoc =
    (doc.horasSepTitular || 0) + (doc.horasSepContrata || 0) > 0 ||
    hTallerSepDoc > 0;

  const contratoPieDoc = (doc.horasPieTitular || 0) + (doc.horasPieContrata || 0);
  const contratoSepDoc = (doc.horasSepTitular || 0) + (doc.horasSepContrata || 0);

  const sumFuncionesNoAulaSep =
    doc.funcionesNoAula && doc.funcionesNoAula.length > 0
      ? doc.funcionesNoAula
          .filter(f => isSepFin(f))
          .reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;

  const sumFuncionesNoAulaPie =
    doc.funcionesNoAula && doc.funcionesNoAula.length > 0
      ? doc.funcionesNoAula
          .filter(f => isPieFin(f))
          .reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;

  const sumFuncionesNoAulaSubvGen =
    doc.funcionesNoAula && doc.funcionesNoAula.length > 0
      ? doc.funcionesNoAula
          .filter(f => !isSepFin(f) && !isPieFin(f))
          .reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : hDir + hInsp + hTec + hCoord + hConv + hExtra;

  const asigsDocente = asignacionesDocente.filter(a => a.docenteId === doc.id);

  const asigsTrabajoColaborativo = asigsDocente.filter(
    a =>
      a.esTrabajoColaborativo ||
      a.tipoApoyo === 'TRABAJO_COLABORATIVO' ||
      (a.tipoApoyo && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.tipoApoyo)) ||
      (a.asignatura && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.asignatura))
  );

  const esSepAsigCheck = (a: AsignacionHoraria) =>
    Boolean(
      a.esTallerSep ||
        a.tipoApoyo === 'TALLER_SEP' ||
        (a.tipoApoyo && /sep/i.test(a.tipoApoyo)) ||
        (a.asignatura && /sep/i.test(a.asignatura)) ||
        (isSepDoc &&
          !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.asignatura || '') &&
          !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.tipoApoyo || ''))
    );

  const esPieAsigCheck = (a: AsignacionHoraria) =>
    !esSepAsigCheck(a) &&
    Boolean(
      (a.tipoApoyo &&
        /pie|decreto 170|aula de recurso|apoyo especializado|cl[ií]nico/i.test(a.tipoApoyo)) ||
        (a.asignatura && /pie|decreto 170|aula de recurso/i.test(a.asignatura)) ||
        isPieDoc
    );

  const asigsCoDocenciaPie = asigsDocente.filter(
    a =>
      !asigsTrabajoColaborativo.includes(a) &&
      (a.tipoApoyo === 'CO_DOCENCIA' ||
        a.esCoDocencia ||
        esPieAsigCheck(a))
  );

  const asigsTallerSep = asigsDocente.filter(
    a =>
      a.esTallerSep ||
      a.tipoApoyo === 'TALLER_SEP' ||
      (a.asignatura && /taller\s*sep/i.test(a.asignatura))
  );

  const asigsCoDocenciaSep = asigsDocente.filter(
    a =>
      !asigsTrabajoColaborativo.includes(a) &&
      !asigsCoDocenciaPie.includes(a) &&
      !asigsTallerSep.includes(a) &&
      esSepAsigCheck(a)
  );

  const asigsAulaRegular = asigsDocente.filter(
    a =>
      !asigsTrabajoColaborativo.includes(a) &&
      !asigsCoDocenciaPie.includes(a) &&
      !asigsCoDocenciaSep.includes(a) &&
      !asigsTallerSep.includes(a) &&
      Boolean(a.cursoId && a.cursoId !== 'TRANSVERSAL' && a.cursoId !== 'SIN_CURSO')
  );

  const asigsCoDocenciaPieProporcional = asigsCoDocenciaPie.filter(a => {
    const tieneCurso = Boolean(
      a.cursoId && a.cursoId !== 'TRANSVERSAL' && a.cursoId !== 'SIN_CURSO'
    );
    const esTrabajoNoAula = Boolean(
      a.esTrabajoColaborativo ||
        a.tipoApoyo === 'TRABAJO_COLABORATIVO' ||
        (a.tipoApoyo && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.tipoApoyo)) ||
        (a.asignatura && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.asignatura))
    );
    if (!tieneCurso || esTrabajoNoAula) return false;
    if (isPieDoc) return true;
    return Boolean(a.esProporcionDocente);
  });

  const asigsCoDocenciaPieCronologicas = asigsCoDocenciaPie.filter(
    a => !asigsCoDocenciaPieProporcional.includes(a)
  );

  const cronTrabajoColab = asigsTrabajoColaborativo.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronCoDocenciaPie = asigsCoDocenciaPieCronologicas.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronCoDocenciaSep = asigsCoDocenciaSep.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronTallerSep = asigsTallerSep.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronApoyoPie = Math.round((cronTrabajoColab + cronCoDocenciaPie) * 10) / 10;
  const cronSepTotal = Math.round((cronCoDocenciaSep + cronTallerSep) * 10) / 10;

  const regimenTabla: '60_40' | '65_35' = porcentajePrioritariosColegio >= 80 ? '60_40' : '65_35';

  const asigsTallerSepLectivos = hTallerSepDoc > 0 ? [] : asigsTallerSep;
  const asigsCandidatasAula = [
    ...asigsAulaRegular,
    ...asigsCoDocenciaSep,
    ...asigsTallerSepLectivos,
    ...asigsCoDocenciaPieProporcional
  ];
  const pedCandidatas = asigsCandidatasAula.reduce((s, a) => s + getHorasAulaLectivaAsig(a), 0);
  const esSepProporcional =
    isSepDoc && hContrato > 0 && buscarContratoMinimoPorTabla(pedCandidatas, regimenTabla) <= hContrato;

  const sepExentasCronologicas =
    isPieDoc || (isSepDoc && !esSepProporcional)
      ? cronSepTotal > 0 || hTallerSepDoc > 0 || sumFuncionesNoAulaSep > 0
        ? Math.max(contratoSepDoc, hTallerSepDoc, cronSepTotal + sumFuncionesNoAulaSep)
        : 0
      : hTallerSepDoc + sumFuncionesNoAulaSep;

  const colabPieEfectivo = Math.max(cronTrabajoColab, hColabDoc);
  const hNoAulaPieEfectivas = Math.max(colabPieEfectivo + hCoordPie, sumFuncionesNoAulaPie);
  const pieCronologicas = isDiferencialDoc
    ? asigsCoDocenciaPieProporcional.length > 0
      ? cronCoDocenciaPie + hNoAulaPieEfectivas
      : cronApoyoPie > 0
      ? Math.max(
          cronCoDocenciaPie + hNoAulaPieEfectivas,
          Math.min(
            contratoPieDoc,
            buscarContratoMinimoPorTabla(
              asigsCoDocenciaPie.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0) +
                asigsTrabajoColaborativo.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0),
              regimenTabla
            ) + hNoAulaPieEfectivas
          )
        )
      : hNoAulaPieEfectivas
    : Math.max(cronCoDocenciaPie + colabPieEfectivo + sumFuncionesNoAulaPie, colabPieEfectivo + hCoordPie);

  // Asignaciones exentas residuales
  const asigsClasificadas = new Set([
    ...asigsAulaRegular,
    ...asigsCoDocenciaPieProporcional,
    ...asigsCoDocenciaPieCronologicas,
    ...asigsTrabajoColaborativo,
    ...asigsCoDocenciaSep,
    ...asigsTallerSep
  ]);
  const asigsResidualesExentas = asigsDocente.filter(a => !asigsClasificadas.has(a));
  const cronResiduales = asigsResidualesExentas.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );

  const horasInstitucionalesSubvGen = sumFuncionesNoAulaSubvGen;
  const horasExentasTotales = Math.round((horasInstitucionalesSubvGen + sepExentasCronologicas + pieCronologicas + cronResiduales) * 10) / 10;
  const horasParaDocenciaAula = Math.max(0, Math.round((hContrato - horasExentasTotales) * 10) / 10);

  return {
    horasInstitucionalesSubvGen,
    sepExentasCronologicas,
    pieCronologicas,
    horasExentasTotales,
    horasParaDocenciaAula
  };
}

/**
 * Ejecuta la auditoría integral oficial de un docente en un establecimiento,
 * garantizando 100% de consistencia entre Vista Escuela, Consolidado Territorial y Estadísticas.
 */
export function auditarCargaDocenteIntegral(
  doc: Docente,
  docenteAsigs: AsignacionHoraria[],
  coDocenteAsigs: AsignacionHoraria[],
  cursosMap: Map<string, CursoSae>,
  porcentajePrioritariosColegio: number
): AuditoriaIntegralDocenteResult {
  const hContrato = Number(doc.horasContrato) || 0;
  const calJur = (doc.calidadJuridica || '').toUpperCase();

  let sTit = Number(doc.horasSubvencionGeneralTitular) || 0;
  let sCon = Number(doc.horasSubvencionGeneralContrata) || 0;
  const spTit = Number(doc.horasSepTitular) || 0;
  const spCon = Number(doc.horasSepContrata) || 0;
  const pTit = Number(doc.horasPieTitular) || 0;
  const pCon = Number(doc.horasPieContrata) || 0;

  const sumaFuentesDoc = sTit + sCon + spTit + spCon + pTit + pCon;
  if (sumaFuentesDoc === 0 && hContrato > 0) {
    if (calJur === 'TITULAR') {
      sTit = hContrato;
    } else {
      sCon = hContrato;
    }
  }

  const subTotalDoc = sTit + sCon;
  const contratoSepDoc = spTit + spCon;
  const contratoPieDoc = pTit + pCon;

  const isPieDoc =
    doc.estamento === 'DOCENTE_DIFERENCIAL' ||
    (contratoPieDoc > 0 && subTotalDoc === 0 && contratoSepDoc === 0);
  const isSepDoc = contratoSepDoc > 0 && contratoPieDoc === 0 && subTotalDoc === 0;

  const isSepFin = (f: any) => {
    if (f.financiamiento && /sep/i.test(f.financiamiento)) return true;
    if (f.tipo === 'COORDINACION_SEP') return true;
    if (f.nombre && /\bsep\b/i.test(f.nombre)) return true;
    return false;
  };

  const isPieFin = (f: any) => {
    if (f.financiamiento && /pie/i.test(f.financiamiento)) return true;
    if (f.tipo === 'COORDINACION_PIE') return true;
    if (f.nombre && /\bpie\b/i.test(f.nombre)) return true;
    if (isPieDoc && (!f.financiamiento || f.financiamiento === 'PIE')) return true;
    return false;
  };

  const esSepAsig = (a: AsignacionHoraria) =>
    Boolean(
      a.esTallerSep ||
        a.tipoApoyo === 'TALLER_SEP' ||
        (a.tipoApoyo && /sep/i.test(a.tipoApoyo)) ||
        (a.asignatura && /sep/i.test(a.asignatura)) ||
        (isSepDoc &&
          !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.asignatura || '') &&
          !/pie|decreto 170|recurso|cl[ií]nico/i.test(a.tipoApoyo || ''))
    );

  const esPieAsig = (a: AsignacionHoraria) =>
    !esSepAsig(a) &&
    Boolean(
      (a.tipoApoyo &&
        /pie|decreto 170|aula de recurso|apoyo especializado|cl[ií]nico/i.test(a.tipoApoyo)) ||
        (a.asignatura && /pie|decreto 170|aula de recurso/i.test(a.asignatura)) ||
        doc.estamento === 'DOCENTE_DIFERENCIAL' ||
        (contratoPieDoc > 0 && subTotalDoc === 0 && contratoSepDoc === 0)
    );

  // Clasificar asignaciones
  const asigsCoDocencia = [
    ...docenteAsigs.filter(
      a =>
        a.esCoDocencia ||
        a.esCoDocenciaParvularia ||
        a.esAgrupacionFlexible ||
        a.tipoApoyo === 'CO_DOCENCIA' ||
        a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ||
        a.tipoApoyo === 'REFUERZO_AULA' ||
        a.tipoApoyo === 'APOYO_DOCENTE'
    ),
    ...coDocenteAsigs
  ];

  const asigsTallerSep = docenteAsigs.filter(
    a => (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP') && !asigsCoDocencia.includes(a)
  );

  const asigsTrabajoColaborativo = docenteAsigs.filter(
    a =>
      a.esTrabajoColaborativo ||
      a.tipoApoyo === 'TRABAJO_COLABORATIVO' ||
      (a.asignatura && a.asignatura.toLowerCase().includes('colaborativ'))
  );

  const asigsCoDocenciaPie = asigsCoDocencia.filter(a => esPieAsig(a));
  const asigsCoDocenciaSep = asigsCoDocencia.filter(
    a => !asigsCoDocenciaPie.includes(a) && (esSepAsig(a) || isSepDoc)
  );
  const asigsCoDocenciaSubvGen = asigsCoDocencia.filter(
    a => !asigsCoDocenciaPie.includes(a) && !asigsCoDocenciaSep.includes(a)
  );

  const asigsAulaRegular = [
    ...docenteAsigs.filter(
      a =>
        !asigsCoDocencia.includes(a) &&
        !asigsTallerSep.includes(a) &&
        !asigsTrabajoColaborativo.includes(a)
    ),
    ...asigsCoDocenciaSubvGen
  ];

  const haRegular = asigsAulaRegular.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const haCoDocencia = asigsCoDocencia.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const haTallerSep = asigsTallerSep.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const haTrabajoColab = asigsTrabajoColaborativo.reduce(
    (s, a) => s + (a.horasPedagogicasAula || 0),
    0
  );
  const haTotalAsignadas = [...docenteAsigs, ...coDocenteAsigs].reduce(
    (s, a) => s + (a.horasPedagogicasAula || 0),
    0
  );

  const hDir = Number(doc.horasDirectivas) || 0;
  const hInsp = Number(doc.horasInspectorGeneral) || 0;
  const hTec = Number(doc.horasTecnicoPedagogicas) || 0;
  const hCoord = Number(doc.horasCoordinacion) || 0;
  const hCoordPie = Number(doc.horasCoordinacionPie) || 0;
  const hConv = Number(doc.horasConvivenciaEscolar) || 0;
  const hExtra = Number(doc.horasExtraescolar) || 0;
  const hTallerSepDoc = Number(doc.horasTallerSep) || 0;
  const hColabDoc = Number(doc.horasTrabajoColaborativo) || 0;

  // IMPORTANTE: Si doc.funcionesNoAula tiene elementos, ya contiene el desglose de horasDirectivas/Tecnicas/etc.
  // Nunca se deben sumar ambos simultáneamente.
  const sumFuncionesNoAulaSep =
    doc.funcionesNoAula && doc.funcionesNoAula.length > 0
      ? doc.funcionesNoAula
          .filter(f => isSepFin(f))
          .reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;

  const sumFuncionesNoAulaPie =
    doc.funcionesNoAula && doc.funcionesNoAula.length > 0
      ? doc.funcionesNoAula
          .filter(f => isPieFin(f))
          .reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;

  const sumFuncionesNoAulaSubvGen =
    doc.funcionesNoAula && doc.funcionesNoAula.length > 0
      ? doc.funcionesNoAula
          .filter(f => !isSepFin(f) && !isPieFin(f))
          .reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : hDir + hInsp + hTec + hCoord + hConv + hExtra;

  // Asignaciones de co-docencia PIE frente a curso con proporción docente Ley 20.903
  const asigsCoDocenciaPieProporcional = asigsCoDocenciaPie.filter(a => {
    const tieneCurso = Boolean(
      a.cursoId && a.cursoId !== 'TRANSVERSAL' && a.cursoId !== 'SIN_CURSO'
    );
    const esTrabajoNoAula = Boolean(
      a.esTrabajoColaborativo ||
        a.tipoApoyo === 'TRABAJO_COLABORATIVO' ||
        (a.tipoApoyo && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.tipoApoyo)) ||
        (a.asignatura && /colaborativo|art\.?\s*86|cl[ií]nico/i.test(a.asignatura))
    );
    if (!tieneCurso || esTrabajoNoAula) return false;
    if (isPieDoc) return true; // Docente diferencial frente a curso = hora lectiva aula (45 min)
    return Boolean(a.esProporcionDocente);
  });

  const asigsCoDocenciaPieCronologicas = asigsCoDocenciaPie.filter(
    a => !asigsCoDocenciaPieProporcional.includes(a)
  );

  const cronTrabajoColab = asigsTrabajoColaborativo.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronCoDocenciaPie = asigsCoDocenciaPieCronologicas.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronCoDocenciaSep = asigsCoDocenciaSep.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronTallerSep = asigsTallerSep.reduce(
    (s, a) => s + (a.horasCronologicasPie ?? Math.round((a.horasPedagogicasAula || 0) * 0.75 * 10) / 10),
    0
  );
  const cronApoyoPie = Math.round((cronTrabajoColab + cronCoDocenciaPie) * 10) / 10;
  const cronSepTotal = Math.round((cronCoDocenciaSep + cronTallerSep) * 10) / 10;

  const regimenTabla: '60_40' | '65_35' = porcentajePrioritariosColegio >= 80 ? '60_40' : '65_35';

  const asigsTallerSepLectivos = hTallerSepDoc > 0 ? [] : asigsTallerSep;
  const asigsCandidatasAula = [
    ...asigsAulaRegular,
    ...asigsCoDocenciaSep,
    ...asigsTallerSepLectivos,
    ...asigsCoDocenciaPieProporcional
  ];
  const pedCandidatas = asigsCandidatasAula.reduce((s, a) => s + getHorasAulaLectivaAsig(a), 0);
  const esSepProporcional =
    isSepDoc && hContrato > 0 && buscarContratoMinimoPorTabla(pedCandidatas, regimenTabla) <= hContrato;

  const asigsDocenciaAulaEfectiva = isPieDoc
    ? [...asigsAulaRegular, ...asigsCoDocenciaPieProporcional]
    : isSepDoc && !esSepProporcional
    ? asigsAulaRegular
    : asigsCandidatasAula;

  const sepExentasCronologicas =
    isPieDoc || (isSepDoc && !esSepProporcional)
      ? cronSepTotal > 0 || hTallerSepDoc > 0 || sumFuncionesNoAulaSep > 0
        ? Math.max(contratoSepDoc, hTallerSepDoc, cronSepTotal + sumFuncionesNoAulaSep)
        : 0
      : hTallerSepDoc + sumFuncionesNoAulaSep;

  const hNoAulaPieEfectivas = Math.max(hColabDoc + hCoordPie, sumFuncionesNoAulaPie);
  const pieCronologicas = isPieDoc
    ? asigsCoDocenciaPieProporcional.length > 0
      ? cronApoyoPie + hNoAulaPieEfectivas
      : cronApoyoPie > 0
      ? Math.max(
          cronApoyoPie + hNoAulaPieEfectivas,
          Math.min(
            contratoPieDoc,
            buscarContratoMinimoPorTabla(haCoDocencia + haTrabajoColab, regimenTabla) +
              hNoAulaPieEfectivas
          )
        )
      : hNoAulaPieEfectivas
    : Math.max(cronApoyoPie + sumFuncionesNoAulaPie, hColabDoc + hCoordPie);

  const horasInstitucionalesSubvGen = sumFuncionesNoAulaSubvGen;
  const horasExentasTotales =
    horasInstitucionalesSubvGen + sepExentasCronologicas + pieCronologicas;
  const horasParaDocenciaAula = Math.max(0, hContrato - horasExentasTotales);

  const isEducadoraParvuloDoc = esDocenteEducadoraParvulos(doc);

  const cursosParvulariosColegio = Array.from(cursosMap.values()).filter((x: CursoSae) => esNivelParvulario(x.nivel));
  const regimenParvularioPredominante: '65_35' | '60_40' =
    cursosParvulariosColegio.find((x: CursoSae) => x.regimenProporcion)?.regimenProporcion ||
    '65_35';

  const esCurso60ParvORegular = (c: CursoSae | undefined): boolean => {
    const esParv = Boolean(c && esNivelParvulario(c.nivel));
    if (c?.regimenProporcion) return c.regimenProporcion === '60_40';
    if (isEducadoraParvuloDoc && (esParv || !c)) {
      return regimenParvularioPredominante === '60_40';
    }
    return porcentajePrioritariosColegio >= 80;
  };

  const ha60_40 = asigsDocenciaAulaEfectiva
    .filter(a => {
      const c = cursosMap.get(a.cursoId);
      return esCurso60ParvORegular(c);
    })
    .reduce((s, a) => s + getHorasAulaLectivaAsig(a), 0);

  const ha65_35 = asigsDocenciaAulaEfectiva
    .filter(a => {
      const c = cursosMap.get(a.cursoId);
      return !esCurso60ParvORegular(c);
    })
    .reduce((s, a) => s + getHorasAulaLectivaAsig(a), 0);

  let auditDoc = calcularAuditoriaDocenteMultitramo({
    horasAula65_35: ha65_35,
    horasAula60_40: ha60_40,
    horasPieCronologicas: pieCronologicas,
    horasTallerSepExento: sepExentasCronologicas,
    horasPieSepCronologicas: pieCronologicas,
    horasNoAulaInstitucionales: horasInstitucionalesSubvGen,
    horasContratoReal: hContrato,
    aplicaArticulo69: Boolean(doc.aplicaArticulo69)
  });

  if (isEducadoraParvuloDoc) {
    const regCap: '65_35' | '60_40' =
      ha60_40 > ha65_35
        ? '60_40'
        : ha65_35 > 0
        ? '65_35'
        : regimenParvularioPredominante;
    const tramoCap = horasParaDocenciaAula > 0 ? obtenerTramoMineduc(horasParaDocenciaAula, regCap) : null;
    const minsCapBase = tramoCap
      ? tramoCap.lectivasMinutosCronologicos
      : Math.floor(horasParaDocenciaAula * 60 * (regCap === '60_40' ? 0.60 : 0.65));
    const limiteArt69Min = doc.aplicaArticulo69 ? 24 * 60 : Number.POSITIVE_INFINITY;
    const minsCapFinal = Math.min(minsCapBase, limiteArt69Min);

    if (ha65_35 > 0 || ha60_40 > 0) {
      const match65 = buscarContratoMinimoParvulariaPorMinutos(Math.round(ha65_35 * 60), '65_35');
      const match60 = buscarContratoMinimoParvulariaPorMinutos(Math.round(ha60_40 * 60), '60_40');
      const reqAulaParv = match65.horasContrato + match60.horasContrato;
      const contratoCalcParv = reqAulaParv + pieCronologicas + sepExentasCronologicas + horasInstitucionalesSubvGen;
      const saldoParv = Math.round((hContrato - contratoCalcParv) * 10) / 10;
      const minHnlParv = match65.minutosHnl + match60.minutosHnl;
      const minRecParv = match65.minutosRecreo + match60.minutosRecreo;
      const minAulaTablaParv = match65.minutosAula + match60.minutosAula;
      const totalHorasAulaParv = ha65_35 + ha60_40;
      const pctRealParv = horasParaDocenciaAula > 0
        ? Math.round((totalHorasAulaParv / horasParaDocenciaAula) * 1000) / 10
        : 0;
      const pctLimiteParv = regCap === '60_40' ? 60 : 65;

      auditDoc = {
        ...auditDoc,
        req65_35: match65.horasContrato,
        req60_40: match60.horasContrato,
        contratoPonderado65_35: match65.horasContrato,
        contratoPonderado60_40: match60.horasContrato,
        contratoCalculadoTotal: contratoCalcParv,
        saldoHoras: saldoParv,
        esInfractorExcesoLectivo: saldoParv < 0 || Boolean(doc.aplicaArticulo69 && totalHorasAulaParv > 24.05),
        porcentajeLectivoReal: pctRealParv,
        porcentajeLimitePonderado: pctLimiteParv,
        minutosLectivosTablaTotal: minAulaTablaParv,
        minutosLimitePermitido: minsCapFinal,
        minutosHnlTotal: minHnlParv,
        minutosRecreoTotal: minRecParv,
        minutosHnlPlanificacion40: Math.round(minHnlParv * 0.40)
      };
    } else {
      auditDoc = {
        ...auditDoc,
        minutosLimitePermitido: minsCapFinal,
        porcentajeLimitePonderado: regCap === '60_40' ? 60 : 65
      };
    }
  }

  const maxHAPermitidas = isEducadoraParvuloDoc
    ? Math.round((auditDoc.minutosLimitePermitido / 60) * 100) / 100
    : Math.floor(auditDoc.minutosLimitePermitido / 45);
  const horasNoLectivasCronologicas = Math.round((auditDoc.minutosHnlTotal / 60) * 10) / 10;
  const horasRecreoCronologicas = Math.round((auditDoc.minutosRecreoTotal / 60) * 10) / 10;

  // Requerimientos por fuente de financiamiento
  const asigsCurricularesTitulares = docenteAsigs.filter(
    a =>
      !asigsCoDocencia.includes(a) &&
      !asigsTallerSep.includes(a) &&
      !asigsTrabajoColaborativo.includes(a)
  );
  const pedCurricular65 = asigsCurricularesTitulares
    .filter(a => {
      const c = cursosMap.get(a.cursoId);
      return !esCurso60ParvORegular(c);
    })
    .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const pedCurricular60 = asigsCurricularesTitulares
    .filter(a => {
      const c = cursosMap.get(a.cursoId);
      return esCurso60ParvORegular(c);
    })
    .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

  const pedCurricularTitular = pedCurricular65 + pedCurricular60;
  const reqSubvGenDoc =
    (pedCurricularTitular > 0
      ? isEducadoraParvuloDoc
        ? buscarContratoMinimoParvulariaPorMinutos(Math.round(pedCurricular65 * 60), '65_35').horasContrato +
          buscarContratoMinimoParvulariaPorMinutos(Math.round(pedCurricular60 * 60), '60_40').horasContrato
        : buscarContratoMinimoPorTabla(pedCurricular65, '65_35') +
          buscarContratoMinimoPorTabla(pedCurricular60, '60_40')
      : 0) + horasInstitucionalesSubvGen;

  const sepPieTotalDoc = contratoSepDoc + contratoPieDoc;
  const deficitSubvencionGeneral =
    reqSubvGenDoc > subTotalDoc && sepPieTotalDoc > 0 && pedCurricularTitular > 0
      ? reqSubvGenDoc - subTotalDoc
      : 0;
  const esImprocedenteFinanciamientoSepPie = deficitSubvencionGeneral > 0;

  const asigsSepAula = isPieDoc ? [] : [...asigsCoDocenciaSep, ...asigsTallerSep];
  const pedSep65 = asigsSepAula
    .filter(a => {
      const c = cursosMap.get(a.cursoId);
      return c ? c.regimenProporcion !== '60_40' : porcentajePrioritariosColegio < 80;
    })
    .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
  const pedSep60 = asigsSepAula
    .filter(a => {
      const c = cursosMap.get(a.cursoId);
      return c ? c.regimenProporcion === '60_40' : porcentajePrioritariosColegio >= 80;
    })
    .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

  const reqSepDoc =
    pedSep65 > 0 || pedSep60 > 0
      ? buscarContratoMinimoPorTabla(pedSep65, '65_35') +
        buscarContratoMinimoPorTabla(pedSep60, '60_40') +
        sumFuncionesNoAulaSep
      : isSepDoc
      ? cronSepTotal > 0 || hTallerSepDoc > 0 || sumFuncionesNoAulaSep > 0
        ? Math.max(contratoSepDoc, hTallerSepDoc, cronSepTotal + sumFuncionesNoAulaSep)
        : 0
      : sumFuncionesNoAulaSep + hTallerSepDoc;

  const pieAsignadasDoc = isPieDoc
    ? asigsCoDocenciaPieProporcional.length > 0
      ? buscarContratoMinimoPorTabla(ha65_35, '65_35') +
        buscarContratoMinimoPorTabla(ha60_40, '60_40') +
        pieCronologicas
      : pieCronologicas
    : pieCronologicas;

  const horasSepSinAsignar = Math.max(0, contratoSepDoc - reqSepDoc);
  const horasPieSinAsignar = Math.max(0, contratoPieDoc - pieAsignadasDoc);
  const horasSubvGenSinAsignar = Math.max(0, subTotalDoc - reqSubvGenDoc);
  const totalHorasSinAsignar = horasSepSinAsignar + horasPieSinAsignar + horasSubvGenSinAsignar;

  const horasComprometidasDocente = auditDoc.contratoCalculadoTotal;
  const horasLibresDocente = Math.max(0, hContrato - horasComprometidasDocente);
  const estaSobreasignado =
    auditDoc.esInfractorExcesoLectivo || (hContrato > 0 && auditDoc.saldoHoras < 0);

  return {
    auditDoc,
    haRegular,
    haCoDocencia,
    haTallerSep,
    haTrabajoColab,
    haTotalAsignadas,
    haDocenciaEfectiva: ha65_35 + ha60_40,
    ha65_35,
    ha60_40,
    maxHAPermitidas,
    horasNoLectivasCronologicas,
    horasRecreoCronologicas,
    horasInstitucionalesSubvGen,
    sepExentasCronologicas,
    pieCronologicas,
    horasExentasTotales,
    horasParaDocenciaAula,
    estaSobreasignado,
    esInfractorExcesoLectivo: auditDoc.esInfractorExcesoLectivo,
    saldoHoras: auditDoc.saldoHoras,
    horasComprometidasDocente,
    horasLibresDocente,
    reqSubvGenDoc,
    reqSepDoc,
    pieAsignadasDoc,
    horasSubvGenSinAsignar,
    horasSepSinAsignar,
    horasPieSinAsignar,
    totalHorasSinAsignar,
    pedCurricularTitular,
    deficitSubvencionGeneral,
    esImprocedenteFinanciamientoSepPie,
    isEducadoraParvulo: isEducadoraParvuloDoc
  };
}
