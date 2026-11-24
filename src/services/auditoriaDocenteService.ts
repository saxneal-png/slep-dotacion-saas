import { Docente, AsignacionHoraria, CursoSae, Establecimiento } from '../types';
import { normalizarRut, esRunValidoParaDedup } from '../utils/rutUtils';
import {
  calcularAuditoriaDocenteMultitramo,
  buscarContratoMinimoPorTabla,
  esNivelParvulario,
  buscarContratoMinimoParvulariaPorMinutos,
  obtenerTramoMineduc,
  esModalidadEspecial,
  esModalidadLaboral,
  determinarRegimenNormativo
} from '@slep/mineduc-engine';

export function esCursoEspecialOLaboral(c: CursoSae | undefined): boolean {
  return Boolean(
    c &&
      (esModalidadEspecial(c.nivel) ||
        esModalidadLaboral(c.nivel) ||
        c.tipoModalidad === 'ESPECIAL' ||
        c.tipoModalidad === 'LABORAL')
  );
}

export function esExentoImprocedenciaPieEspecial(doc: Docente, curso: CursoSae | undefined): boolean {
  const contratoPie = Number(doc.horasPieTitular || 0) + Number(doc.horasPieContrata || 0);
  const contratoSep = Number(doc.horasSepTitular || 0) + Number(doc.horasSepContrata || 0);
  return (
    doc.estamento === 'DOCENTE_DIFERENCIAL' &&
    contratoPie > 0 &&
    contratoSep === 0 &&
    esCursoEspecialOLaboral(curso)
  );
}

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
  if (esDocenteEducacionEspecialPie(doc)) return false;
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
 * Identifica a una Educadora Diferencial / Docente PIE (incluso si fue importada históricamente como DOCENTE_AULA).
 */
export function esDocenteEducacionEspecialPie(doc: Docente): boolean {
  const subTotalDoc =
    (Number(doc.horasSubvencionGeneralTitular) || 0) +
    (Number(doc.horasSubvencionGeneralContrata) || 0);
  const sepTotalDoc =
    (Number(doc.horasSepTitular) || 0) + (Number(doc.horasSepContrata) || 0);
  const pieTotalDoc =
    (Number(doc.horasPieTitular) || 0) + (Number(doc.horasPieContrata) || 0);

  if (doc.estamento === 'DOCENTE_DIFERENCIAL') return true;
  if (pieTotalDoc > 0 && subTotalDoc === 0 && sepTotalDoc === 0) return true;

  const rxDif = /diferencial|educaci[oó]n\s+especial|\bdocente\s+(?:de\s+)?pie\b/i;
  if (
    (doc.titulo && rxDif.test(doc.titulo)) ||
    (doc.funcionPrincipal && rxDif.test(doc.funcionPrincipal)) ||
    (doc.asignaturaPrincipal && rxDif.test(doc.asignaturaPrincipal))
  ) {
    return true;
  }

  if (
    doc.cargoInstitucional &&
    /diferencial|educaci[oó]n\s+especial|\bpie\b/i.test(doc.cargoInstitucional) &&
    pieTotalDoc > subTotalDoc
  ) {
    return true;
  }

  return false;
}

/**
 * Normaliza las horas por fuente de financiamiento de un docente para garantizar
 * que la suma Subv. General + SEP + PIE equivalga exactamente a horasContrato
 * (prioriza PIE y SEP sin duplicar horas contra Subvención General).
 */
export function normalizarFuentesFinanciamientoDocente(
  horasContrato: number,
  calidadJuridica: string | undefined,
  sTit: number,
  sCon: number,
  spTit: number,
  spCon: number,
  pTit: number,
  pCon: number
): {
  subvGenTitular: number;
  subvGenContrata: number;
  sepTitular: number;
  sepContrata: number;
  pieTitular: number;
  pieContrata: number;
} {
  const contrato = Math.max(0, Number(horasContrato) || 0);
  if (contrato <= 0) {
    return {
      subvGenTitular: 0,
      subvGenContrata: 0,
      sepTitular: 0,
      sepContrata: 0,
      pieTitular: 0,
      pieContrata: 0
    };
  }

  let outSTit = Math.max(0, Number(sTit) || 0);
  let outSCon = Math.max(0, Number(sCon) || 0);
  let outSpTit = Math.max(0, Number(spTit) || 0);
  let outSpCon = Math.max(0, Number(spCon) || 0);
  let outPTit = Math.max(0, Number(pTit) || 0);
  let outPCon = Math.max(0, Number(pCon) || 0);

  const calJur = String(calidadJuridica || '').toUpperCase();
  const isTitular = calJur === 'TITULAR';
  const suma = outSTit + outSCon + outSpTit + outSpCon + outPTit + outPCon;

  if (suma === 0) {
    return {
      subvGenTitular: isTitular ? contrato : 0,
      subvGenContrata: isTitular ? 0 : contrato,
      sepTitular: 0,
      sepContrata: 0,
      pieTitular: 0,
      pieContrata: 0
    };
  }

  if (Math.abs(suma - contrato) < 0.001) {
    return {
      subvGenTitular: outSTit,
      subvGenContrata: outSCon,
      sepTitular: outSpTit,
      sepContrata: outSpCon,
      pieTitular: outPTit,
      pieContrata: outPCon
    };
  }

  if (isTitular) {
    outPTit = Math.min(contrato, outPTit);
    outPCon = Math.min(Math.max(0, contrato - outPTit), outPCon);
  } else {
    outPCon = Math.min(contrato, outPCon);
    outPTit = Math.min(Math.max(0, contrato - outPCon), outPTit);
  }

  const remAfterPie = Math.max(0, contrato - (outPTit + outPCon));
  if (isTitular) {
    outSpTit = Math.min(remAfterPie, outSpTit);
    outSpCon = Math.min(Math.max(0, remAfterPie - outSpTit), outSpCon);
  } else {
    outSpCon = Math.min(remAfterPie, outSpCon);
    outSpTit = Math.min(Math.max(0, remAfterPie - outSpCon), outSpTit);
  }

  const remSg = Math.max(0, Number((remAfterPie - (outSpTit + outSpCon)).toFixed(2)));
  if (outSTit > 0 && outSCon > 0) {
    outSTit = Math.min(remSg, outSTit);
    outSCon = Math.max(0, Number((remSg - outSTit).toFixed(2)));
  } else if ((isTitular && outSCon === 0) || (outSTit > 0 && outSCon === 0)) {
    outSTit = remSg;
    outSCon = 0;
  } else if (!isTitular || outSCon > outSTit) {
    outSTit = 0;
    outSCon = remSg;
  } else {
    outSTit = remSg;
    outSCon = 0;
  }

  return {
    subvGenTitular: outSTit,
    subvGenContrata: outSCon,
    sepTitular: outSpTit,
    sepContrata: outSpCon,
    pieTitular: outPTit,
    pieContrata: outPCon
  };
}

/**
 * Normaliza las horas por fuente de financiamiento de un Asistente de la Educación
 * para asegurar Subv. General + SEP + PIE + Honorarios === horasContrato.
 */
export function normalizarFuentesFinanciamientoAsistente(
  horasContrato: number,
  sInd: number,
  sPla: number,
  spInd: number,
  spPla: number,
  pInd: number,
  pPla: number,
  hon: number = 0
): {
  subvGenIndefinido: number;
  subvGenPlazoFijo: number;
  sepIndefinido: number;
  sepPlazoFijo: number;
  pieIndefinido: number;
  piePlazoFijo: number;
  honorarios: number;
} {
  const contrato = Math.max(0, Number(horasContrato) || 0);
  if (contrato <= 0) {
    return {
      subvGenIndefinido: 0,
      subvGenPlazoFijo: 0,
      sepIndefinido: 0,
      sepPlazoFijo: 0,
      pieIndefinido: 0,
      piePlazoFijo: 0,
      honorarios: 0
    };
  }

  let outSInd = Math.max(0, Number(sInd) || 0);
  let outSPla = Math.max(0, Number(sPla) || 0);
  let outSpInd = Math.max(0, Number(spInd) || 0);
  let outSpPla = Math.max(0, Number(spPla) || 0);
  let outPInd = Math.max(0, Number(pInd) || 0);
  let outPPla = Math.max(0, Number(pPla) || 0);
  let outHon = Math.max(0, Number(hon) || 0);

  const suma = outSInd + outSPla + outSpInd + outSpPla + outPInd + outPPla + outHon;
  if (suma === 0) {
    return {
      subvGenIndefinido: 0,
      subvGenPlazoFijo: contrato,
      sepIndefinido: 0,
      sepPlazoFijo: 0,
      pieIndefinido: 0,
      piePlazoFijo: 0,
      honorarios: 0
    };
  }

  if (Math.abs(suma - contrato) < 0.001) {
    return {
      subvGenIndefinido: outSInd,
      subvGenPlazoFijo: outSPla,
      sepIndefinido: outSpInd,
      sepPlazoFijo: outSpPla,
      pieIndefinido: outPInd,
      piePlazoFijo: outPPla,
      honorarios: outHon
    };
  }

  outPInd = Math.min(contrato, outPInd);
  outPPla = Math.min(Math.max(0, contrato - outPInd), outPPla);
  const remAfterPie = Math.max(0, contrato - (outPInd + outPPla));

  outSpInd = Math.min(remAfterPie, outSpInd);
  outSpPla = Math.min(Math.max(0, remAfterPie - outSpInd), outSpPla);
  const remAfterSep = Math.max(0, remAfterPie - (outSpInd + outSpPla));

  outHon = Math.min(remAfterSep, outHon);
  const remSg = Math.max(0, Number((remAfterSep - outHon).toFixed(2)));

  if (outSInd > 0 && outSPla > 0) {
    outSInd = Math.min(remSg, outSInd);
    outSPla = Math.max(0, Number((remSg - outSInd).toFixed(2)));
  } else if (outSInd > 0 && outSPla === 0) {
    outSInd = remSg;
    outSPla = 0;
  } else {
    outSInd = 0;
    outSPla = remSg;
  }

  return {
    subvGenIndefinido: outSInd,
    subvGenPlazoFijo: outSPla,
    sepIndefinido: outSpInd,
    sepPlazoFijo: outSpPla,
    pieIndefinido: outPInd,
    piePlazoFijo: outPPla,
    honorarios: outHon
  };
}

/**
 * Obtiene las horas pedagógicas de aula lectiva (45 min) de una asignación frente a estudiantes.
 * Prioriza siempre horasPedagogicasAula sin revertir a horasCronologicasPie.
 */
export function getHorasAulaLectivaAsig(a: Partial<AsignacionHoraria>): number {
  if (a.horasPedagogicasAula && a.horasPedagogicasAula > 0) {
    return a.horasPedagogicasAula;
  }
  if (a.horasCronologicasPie && a.horasCronologicasPie > 0) {
    return Math.round((a.horasCronologicasPie / 0.75) * 100) / 100;
  }
  return 0;
}

/**
 * Identifica asignaciones no-lectivas / exentas de proporción aula dentro del ámbito PIE
 * (Trabajo Colaborativo Art. 86, Coordinación PIE y Apoyo Clínico PAE).
 * Co-Docencia y Aula de Recursos quedan fuera de este predicado para computar como HA (45m).
 */
export function esTrabajoNoAulaPie(a: Partial<AsignacionHoraria>): boolean {
  return Boolean(
    a.esTrabajoColaborativo ||
      a.tipoApoyo === 'TRABAJO_COLABORATIVO' ||
      (a.tipoApoyo && /colaborativo|art\.?\s*86|cl[ií]nico|coordinaci[oó]n/i.test(a.tipoApoyo)) ||
      (a.asignatura && /colaborativo|art\.?\s*86|cl[ií]nico|coordinaci[oó]n/i.test(a.asignatura))
  );
}

/**
 * Convierte bloques de 45m a horas cronológicas exactas en cuartos de hora (sin redondeos .3/.8),
 * preservando valores explícitos enteros (ej: 11h PIE pactadas en contrato).
 */
export function obtenerHorasCronologicasExactasAsig(a: AsignacionHoraria): number {
  const ha = Number(a.horasPedagogicasAula) || 0;
  const cron = Number(a.horasCronologicasPie) || 0;
  if (cron > 0) {
    const exactFromHa = (ha * 45) / 60;
    const esRedondeoArtificialDecimal =
      !Number.isInteger(cron) &&
      ha > 0 &&
      Math.abs(exactFromHa - cron) < 0.06 &&
      Math.abs(cron * 60 - Math.round(cron * 4) * 15) > 0.01;
    if (esRedondeoArtificialDecimal) {
      return exactFromHa;
    }
    return cron;
  }
  return (ha * 45) / 60;
}

export function esAsignacionTrabajoColaborativo(a: AsignacionHoraria): boolean {
  return Boolean(
    a.esTrabajoColaborativo ||
      a.tipoApoyo === 'TRABAJO_COLABORATIVO' ||
      (a.tipoApoyo && /colaborativ|art\.?\s*86/i.test(a.tipoApoyo)) ||
      (a.asignatura && /colaborativ|art\.?\s*86/i.test(a.asignatura))
  );
}

/**
 * Para Docente de Aula Regular (!isPieDoc), el Trabajo Colaborativo PIE Art. 86 es 1:1 en horas cronológicas.
 * Para Educadora Diferencial (isPieDoc), sus horas en curso se consideran pedagógicas (45 min) o su equivalente exacto en minutos.
 */
export function obtenerHorasCronologicasTrabajoColab(a: AsignacionHoraria, isPieDoc: boolean): number {
  const ha = Number(a.horasPedagogicasAula) || 0;
  const cron = a.horasCronologicasPie;
  if (!isPieDoc) {
    if (Number(a.horasColaborativas) > 0) {
      return Number(a.horasColaborativas);
    }
    if (ha > 0 && (cron === undefined || cron === null || cron <= 0 || Math.abs(ha * 0.75 - cron) < 0.15)) {
      return ha;
    }
    return cron ?? ha;
  }
  return obtenerHorasCronologicasExactasAsig(a);
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

  const isPieDoc = esDocenteEducacionEspecialPie(doc);
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

  const asigsTrabajoColaborativo = asigsDocente.filter(a => esAsignacionTrabajoColaborativo(a));

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
    if (esTrabajoNoAulaPie(a) || getHorasAulaLectivaAsig(a) <= 0) return false;
    if (isPieDoc) return true;
    const tieneCurso = Boolean(
      a.cursoId && a.cursoId !== 'TRANSVERSAL' && a.cursoId !== 'SIN_CURSO'
    );
    return tieneCurso && Boolean(a.esProporcionDocente);
  });

  const asigsCoDocenciaPieCronologicas = asigsCoDocenciaPie.filter(
    a => !asigsCoDocenciaPieProporcional.includes(a)
  );

  const cronTrabajoColab = asigsTrabajoColaborativo.reduce(
    (s, a) => s + obtenerHorasCronologicasTrabajoColab(a, isPieDoc),
    0
  );
  const cronCoDocenciaPie = asigsCoDocenciaPieCronologicas.reduce(
    (s, a) => s + obtenerHorasCronologicasExactasAsig(a),
    0
  );
  const cronCoDocenciaSep = asigsCoDocenciaSep.reduce(
    (s, a) => s + obtenerHorasCronologicasExactasAsig(a),
    0
  );
  const cronTallerSep = asigsTallerSep.reduce(
    (s, a) => s + obtenerHorasCronologicasExactasAsig(a),
    0
  );
  const cronApoyoPie = Number((cronTrabajoColab + cronCoDocenciaPie).toFixed(2));
  const cronSepTotal = Number((cronCoDocenciaSep + cronTallerSep).toFixed(2));

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
  const pieCronologicas = isPieDoc
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
    (s, a) => s + obtenerHorasCronologicasExactasAsig(a),
    0
  );

  const horasInstitucionalesSubvGen = sumFuncionesNoAulaSubvGen;
  const horasExentasTotales = Number((horasInstitucionalesSubvGen + sepExentasCronologicas + pieCronologicas + cronResiduales).toFixed(2));
  const horasParaDocenciaAula = Math.max(0, Number((hContrato - horasExentasTotales).toFixed(2)));

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

  const {
    subvGenTitular: sTit,
    subvGenContrata: sCon,
    sepTitular: spTit,
    sepContrata: spCon,
    pieTitular: pTit,
    pieContrata: pCon
  } = normalizarFuentesFinanciamientoDocente(
    hContrato,
    calJur,
    Number(doc.horasSubvencionGeneralTitular) || 0,
    Number(doc.horasSubvencionGeneralContrata) || 0,
    Number(doc.horasSepTitular) || 0,
    Number(doc.horasSepContrata) || 0,
    Number(doc.horasPieTitular) || 0,
    Number(doc.horasPieContrata) || 0
  );

  const subTotalDoc = sTit + sCon;
  const contratoSepDoc = spTit + spCon;
  const contratoPieDoc = pTit + pCon;

  const isPieDoc = esDocenteEducacionEspecialPie({
    ...doc,
    horasSubvencionGeneralTitular: sTit,
    horasSubvencionGeneralContrata: sCon,
    horasSepTitular: spTit,
    horasSepContrata: spCon,
    horasPieTitular: pTit,
    horasPieContrata: pCon
  });
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
        isPieDoc
    );

  // Clasificar asignaciones
  const asigsTrabajoColaborativo = docenteAsigs.filter(a => esAsignacionTrabajoColaborativo(a));

  const asigsCoDocencia = [
    ...docenteAsigs.filter(
      a =>
        !asigsTrabajoColaborativo.includes(a) &&
        (a.esCoDocencia ||
          a.esCoDocenciaParvularia ||
          a.esAgrupacionFlexible ||
          a.tipoApoyo === 'CO_DOCENCIA' ||
          a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ||
          a.tipoApoyo === 'REFUERZO_AULA' ||
          a.tipoApoyo === 'APOYO_DOCENTE' ||
          (a.tipoApoyo && /co-?docencia|aula\s+de\s+recurso|apoyo\s+pie|decreto\s*170/i.test(a.tipoApoyo)) ||
          (a.asignatura && /apoyo\s+pie\s*-?\s*co-?docencia|aula\s+de\s+recursos/i.test(a.asignatura)))
    ),
    ...coDocenteAsigs
  ];

  const asigsTallerSep = docenteAsigs.filter(
    a => (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP') && !asigsCoDocencia.includes(a)
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

  // Asignaciones de co-docencia PIE frente a alumnos (incluye Aula de Recursos) con proporción docente Ley 20.903
  const asigsCoDocenciaPieProporcional = asigsCoDocenciaPie.filter(a => {
    if (esTrabajoNoAulaPie(a) || getHorasAulaLectivaAsig(a) <= 0) return false;
    if (isPieDoc) return true; // Docente diferencial / PIE frente a alumnos (curso o Aula de Recursos) = hora lectiva aula (45 min)
    const tieneCurso = Boolean(
      a.cursoId && a.cursoId !== 'TRANSVERSAL' && a.cursoId !== 'SIN_CURSO'
    );
    return tieneCurso && Boolean(a.esProporcionDocente);
  });

  const asigsCoDocenciaPieCronologicas = asigsCoDocenciaPie.filter(
    a => !asigsCoDocenciaPieProporcional.includes(a)
  );

  const cronTrabajoColab = asigsTrabajoColaborativo.reduce(
    (s, a) => s + obtenerHorasCronologicasTrabajoColab(a, isPieDoc),
    0
  );
  const cronCoDocenciaPie = asigsCoDocenciaPieCronologicas.reduce(
    (s, a) => s + obtenerHorasCronologicasExactasAsig(a),
    0
  );
  const cronCoDocenciaSep = asigsCoDocenciaSep.reduce(
    (s, a) => s + obtenerHorasCronologicasExactasAsig(a),
    0
  );
  const cronTallerSep = asigsTallerSep.reduce(
    (s, a) => s + obtenerHorasCronologicasExactasAsig(a),
    0
  );
  const cronApoyoPie = Number((cronTrabajoColab + cronCoDocenciaPie).toFixed(2));
  const cronSepTotal = Number((cronCoDocenciaSep + cronTallerSep).toFixed(2));

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

  const colabPieEfectivo = Math.max(cronTrabajoColab, hColabDoc);
  const hNoAulaPieEfectivas = Math.max(colabPieEfectivo + hCoordPie, sumFuncionesNoAulaPie);
  const pieCronologicas = isPieDoc
    ? asigsCoDocenciaPieProporcional.length > 0
      ? cronCoDocenciaPie + hNoAulaPieEfectivas
      : cronApoyoPie > 0
      ? Math.max(
          cronCoDocenciaPie + hNoAulaPieEfectivas,
          Math.min(
            contratoPieDoc,
            buscarContratoMinimoPorTabla(haCoDocencia + haTrabajoColab, regimenTabla) +
              hNoAulaPieEfectivas
          )
        )
      : hNoAulaPieEfectivas
    : Math.max(cronCoDocenciaPie + colabPieEfectivo + sumFuncionesNoAulaPie, colabPieEfectivo + hCoordPie);

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
    if (c) {
      if (esParv && !isEducadoraParvuloDoc) {
        return porcentajePrioritariosColegio >= 80;
      }
      return determinarRegimenNormativo(porcentajePrioritariosColegio, c.nivel) === '60_40';
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
      const saldoParv = Number((hContrato - contratoCalcParv).toFixed(2));
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
  const horasNoLectivasCronologicas = Number((auditDoc.minutosHnlTotal / 60).toFixed(4));
  const horasRecreoCronologicas = Number((auditDoc.minutosRecreoTotal / 60).toFixed(4));

  // Requerimientos por fuente de financiamiento
  const asigsCurricularesTitulares = docenteAsigs.filter(
    a =>
      !asigsCoDocencia.includes(a) &&
      !asigsTallerSep.includes(a) &&
      !asigsTrabajoColaborativo.includes(a) &&
      !esExentoImprocedenciaPieEspecial(doc, cursosMap.get(a.cursoId))
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

  const horasSepSinAsignar = Math.max(0, Number((contratoSepDoc - reqSepDoc).toFixed(2)));
  const horasPieSinAsignar = Math.max(0, Number((contratoPieDoc - pieAsignadasDoc).toFixed(2)));
  const horasSubvGenSinAsignar = Math.max(0, Number((subTotalDoc - reqSubvGenDoc).toFixed(2)));
  const totalHorasSinAsignar = Number((horasSepSinAsignar + horasPieSinAsignar + horasSubvGenSinAsignar).toFixed(2));

  const horasComprometidasDocente = auditDoc.contratoCalculadoTotal;
  const horasLibresDocente = Math.max(0, Number((hContrato - horasComprometidasDocente).toFixed(2)));
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

export interface DetalleOtroContratoSlep {
  rbd: string;
  nombreColegio: string;
  horasContrato: number;
  esSobreasignadoLocal: boolean;
}

export interface EvaluacionTopeTerritorialDocente {
  runNormalizado: string;
  esMultiEscuela: boolean;
  horasOtrasEscuelas: number;
  horasContratoActual: number;
  horasTotalesSlep: number;
  limiteLegal: number;
  excesoHoras: number;
  excedeLimite44h: boolean;
  margenDisponibleEnSlep: number;
  otrasEscuelas: DetalleOtroContratoSlep[];
  tieneSobreasignacionEnOtraEscuela: boolean;
}

/**
 * Evalúa si un docente (identificado por RUN válido) excede el tope legal de 44 horas
 * semanales con el mismo sostenedor (SLEP) al sumar sus contratos en otros establecimientos.
 */
export function evaluarTopeTerritorialDocente(params: {
  run: string;
  rbdActual: string;
  horasContratoActual: number;
  todosLosDocentes: Docente[];
  todosLosColegios?: Establecimiento[];
  todasLasAsignaciones?: AsignacionHoraria[];
  todosLosCursos?: CursoSae[];
  limiteLegal?: number;
}): EvaluacionTopeTerritorialDocente {
  const {
    run,
    rbdActual,
    horasContratoActual,
    todosLosDocentes,
    todosLosColegios = [],
    todasLasAsignaciones,
    todosLosCursos = [],
    limiteLegal = 44
  } = params;

  const hActual = Number(horasContratoActual) || 0;
  if (!esRunValidoParaDedup(run)) {
    return {
      runNormalizado: '',
      esMultiEscuela: false,
      horasOtrasEscuelas: 0,
      horasContratoActual: hActual,
      horasTotalesSlep: hActual,
      limiteLegal,
      excesoHoras: Math.max(0, hActual - limiteLegal),
      excedeLimite44h: hActual > limiteLegal,
      margenDisponibleEnSlep: limiteLegal,
      otrasEscuelas: [],
      tieneSobreasignacionEnOtraEscuela: false
    };
  }

  const runNorm = normalizarRut(run);
  const estMap = new Map<string, Establecimiento>(todosLosColegios.map(e => [e.rbd, e]));
  const cursosMap = todosLosCursos.length > 0 ? new Map<string, CursoSae>(todosLosCursos.map(c => [c.id, c])) : null;

  const otrosPorRbd = new Map<string, Docente[]>();
  for (const d of todosLosDocentes) {
    if (d.esVacanteNn || d.rbd === rbdActual) continue;
    if (normalizarRut(d.run) !== runNorm) continue;
    const arr = otrosPorRbd.get(d.rbd) || [];
    arr.push(d);
    otrosPorRbd.set(d.rbd, arr);
  }

  const otrasEscuelas: DetalleOtroContratoSlep[] = [];
  let horasOtrasEscuelas = 0;
  let tieneSobreasignacionEnOtraEscuela = false;

  for (const [rbdOtro, docsOtro] of otrosPorRbd.entries()) {
    const est = estMap.get(rbdOtro);
    const horasOtro = docsOtro.reduce((s, d) => s + (Number(d.horasContrato) || 0), 0);
    horasOtrasEscuelas += horasOtro;

    let esSobreasignadoLocal = false;
    if (todasLasAsignaciones && todasLasAsignaciones.length > 0) {
      for (const dOtro of docsOtro) {
        const asigsPropias = todasLasAsignaciones.filter(
          a => a.rbd === rbdOtro && a.docenteId === dOtro.id
        );
        const asigsCoDoc = todasLasAsignaciones.filter(
          a => a.rbd === rbdOtro && a.coDocenteId === dOtro.id && a.tieneCoDocente
        );
        if (asigsPropias.length > 0 || asigsCoDoc.length > 0) {
          const audit = auditarCargaDocenteIntegral(
            dOtro,
            asigsPropias,
            asigsCoDoc,
            cursosMap || new Map<string, CursoSae>(),
            est?.porcentajePrioritarios || 0
          );
          if (audit.estaSobreasignado) {
            esSobreasignadoLocal = true;
            tieneSobreasignacionEnOtraEscuela = true;
          }
        }
      }
    }

    otrasEscuelas.push({
      rbd: rbdOtro,
      nombreColegio: est ? est.nombre : `RBD ${rbdOtro}`,
      horasContrato: horasOtro,
      esSobreasignadoLocal
    });
  }

  const horasTotalesSlep = Number((hActual + horasOtrasEscuelas).toFixed(2));
  const excesoHoras = Math.max(0, Number((horasTotalesSlep - limiteLegal).toFixed(2)));
  const margenDisponibleEnSlep = Math.max(0, Number((limiteLegal - horasOtrasEscuelas).toFixed(2)));

  return {
    runNormalizado: runNorm,
    esMultiEscuela: otrasEscuelas.length > 0,
    horasOtrasEscuelas: Number(horasOtrasEscuelas.toFixed(2)),
    horasContratoActual: hActual,
    horasTotalesSlep,
    limiteLegal,
    excesoHoras,
    excedeLimite44h: horasTotalesSlep > limiteLegal,
    margenDisponibleEnSlep,
    otrasEscuelas,
    tieneSobreasignacionEnOtraEscuela
  };
}
