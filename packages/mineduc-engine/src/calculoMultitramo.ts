import {
  buscarContratoMinimoPorTabla,
  RAW_65_35,
  RAW_60_40,
  parseHHMMToMinutes
} from './tablasMineduc';

export interface ParametrosAuditoriaDocenteMultitramo {
  horasAula65_35: number;
  horasAula60_40: number;
  horasPieSepCronologicas?: number;
  horasNoAulaInstitucionales?: number;
  horasContratoReal?: number;
}

export interface ResultadoAuditoriaDocenteMultitramo {
  /** Requerimiento de contrato para cubrir la carga lectiva en tramo regular 65/35 */
  req65_35: number;
  /** Requerimiento de contrato para cubrir la carga lectiva en tramo vulnerable 60/40 */
  req60_40: number;
  /** Horas cronológicas de apoyo directo PIE o SEP */
  horasPieSep: number;
  /** Horas cronológicas de funciones no aula (Directivas, UTP, Coordinaciones) */
  horasNoAula: number;
  /** Contrato total mínimo calculado / carga total requerida (req65 + req60 + pie + noAula) */
  contratoCalculadoTotal: number;

  /** Total de horas de contrato pagadas/reales */
  contratoRealTotal: number;
  /** Horas de contrato regulares de docencia de aula (contratoRealTotal - horasPieSep - horasNoAula) */
  contratoRegularBase: number;
  /** Distribución proporcional del contrato real asignada al tramo 65/35 */
  contratoPonderado65_35: number;
  /** Distribución proporcional del contrato real asignada al tramo 60/40 */
  contratoPonderado60_40: number;

  /** Minutos cronológicos reales impartidos en aula por el docente: (HA 65 + HA 60) * 45 */
  minutosLectivosAula: number;
  /** Minutos lectivos cronológicos oficiales según tablas MINEDUC para (c65 + c60) */
  minutosLectivosTablaTotal: number;
  /** Minutos de recreo acumulados oficiales según tablas MINEDUC para (c65 + c60) */
  minutosRecreoTotal: number;
  /** Minutos no lectivos acumulados oficiales según tablas MINEDUC para (c65 + c60) */
  minutosHnlTotal: number;
  /** Minutos exclusivos para preparación docente (40% de HNL acumuladas) */
  minutosHnlPlanificacion40: number;

  /** Límite legal permitido en minutos cronológicos de docencia de aula */
  minutosLimitePermitido: number;
  /** Porcentaje real de docencia lectiva sobre la jornada regular base */
  porcentajeLectivoReal: number;
  /** Porcentaje límite ponderado legal permitido */
  porcentajeLimitePonderado: number;
  /** Indica si la carga de aula asignada excede el límite ponderado legal */
  esInfractorExcesoLectivo: boolean;

  /** Saldo entre contrato total del funcionario y la carga total de trabajo (saldo > 0: holgura, saldo < 0: déficit) */
  saldoHoras: number;
  /** Horas vacantes / disponibles del contrato (Math.max(0, saldoHoras)) */
  horasVacantes: number;
  /** Estado de auditoría del saldo */
  estadoSaldo: 'EXACTO' | 'HOLGURA' | 'DEFICIT' | 'POR_AUDITAR';
  /** Mensaje descriptivo con el veredicto de la auditoría */
  mensajeAuditoria: string;
}

/**
 * Realiza la auditoría integral multitramo de un docente con posible coexistencia
 * de horas lectivas en 65/35 y 60/40, además de horas PIE/SEP.
 */
export function calcularAuditoriaDocenteMultitramo(
  params: ParametrosAuditoriaDocenteMultitramo
): ResultadoAuditoriaDocenteMultitramo {
  const l65 = Math.max(0, Math.round(params.horasAula65_35 || 0));
  const l60 = Math.max(0, Math.round(params.horasAula60_40 || 0));
  const pie = Math.max(0, Math.round(params.horasPieSepCronologicas || 0));
  const noAula = Math.max(0, Math.round(params.horasNoAulaInstitucionales || 0));
  const contratoReal = Math.max(0, Math.round(params.horasContratoReal || 0));

  // 1. Obtención de jornadas requeridas por tramos independientes según tablas oficiales
  const req65 = buscarContratoMinimoPorTabla(l65, '65_35');
  const req60 = buscarContratoMinimoPorTabla(l60, '60_40');
  const contratoCalculadoTotal = req65 + req60 + pie + noAula;

  // 2. División del contrato base regular entre ambos regímenes (descontando funciones exentas PIE/No Aula)
  let cReg = 0;
  if (contratoReal > 0) {
    cReg = Math.max(0, contratoReal - pie - noAula);
  } else {
    cReg = req65 + req60; // fallback al requerido
  }

  let c65 = 0;
  let c60 = 0;
  const reqTotalReg = req65 + req60;

  if (cReg > 0) {
    if (req65 > 0 && req60 === 0) {
      c65 = cReg;
      c60 = 0;
    } else if (req65 === 0 && req60 > 0) {
      c65 = 0;
      c60 = cReg;
    } else if (req65 > 0 && req60 > 0) {
      // Split proporcional según requerimientos mínimos de aula de la tabla
      c65 = Math.round(cReg * (req65 / reqTotalReg));
      c60 = cReg - c65;
      // Ajuste para evitar asignaciones de 0 horas en tramos que sí tienen requerimiento
      if (c65 === 0 && cReg >= 1) {
        c65 = 1;
        c60 = cReg - 1;
      } else if (c60 === 0 && cReg >= 1) {
        c60 = 1;
        c65 = cReg - 1;
      }
    } else {
      // Caso por defecto (sin carga indicada), asume 65/35
      c65 = cReg;
      c60 = 0;
    }
  }

  // 3. Consultar y acumular minutos oficiales de la base de datos de tablas MINEDUC
  let totalRecreoMins = 0;
  let totalHnlMins = 0;
  let totalLectivaCronMins = 0;

  const clampJornada = (val: number) => Math.min(44, Math.max(1, val));

  if (c65 > 0) {
    const entry65 = RAW_65_35.find(e => e.jornada === clampJornada(c65));
    if (entry65) {
      totalRecreoMins += parseHHMMToMinutes(entry65.recreo);
      totalHnlMins += parseHHMMToMinutes(entry65.hnl);
      totalLectivaCronMins += parseHHMMToMinutes(entry65.lectivas);
    }
  }
  if (c60 > 0) {
    const entry60 = RAW_60_40.find(e => e.jornada === clampJornada(c60));
    if (entry60) {
      totalRecreoMins += parseHHMMToMinutes(entry60.recreo);
      totalHnlMins += parseHHMMToMinutes(entry60.hnl);
      totalLectivaCronMins += parseHHMMToMinutes(entry60.lectivas);
    }
  }

  const hnlPlanificacion40 = Math.round(totalHnlMins * 0.40);

  // 4. Auditoría de límites y exceso lectivo ponderado
  const minutosLectivosAula = (l65 + l60) * 45;
  const minutosLimitePermitido = (c65 * 0.65 + c60 * 0.60) * 60;

  let esInfractor = false;
  let limitePonderadoPct = 0;
  let lectivePctReal = 0;

  if (cReg > 0) {
    lectivePctReal = Number(((minutosLectivosAula / (cReg * 60)) * 100).toFixed(1));
    limitePonderadoPct = Number(((minutosLimitePermitido / (cReg * 60)) * 100).toFixed(1));

    if (minutosLectivosAula > minutosLimitePermitido + 0.1) {
      esInfractor = true;
    }
  }

  const saldoHoras = contratoReal > 0 ? (contratoReal - contratoCalculadoTotal) : 0;
  const horasVacantes = Math.max(0, saldoHoras);
  let estadoSaldo: 'EXACTO' | 'HOLGURA' | 'DEFICIT' | 'POR_AUDITAR' = 'POR_AUDITAR';
  let mensajeAuditoria = '';

  if (contratoReal === 0) {
    estadoSaldo = 'POR_AUDITAR';
    mensajeAuditoria = `Requiere contrato de ${contratoCalculadoTotal} hrs (${req65}h en 65/35 + ${req60}h en 60/40 + ${pie}h PIE + ${noAula}h No Aula).`;
  } else if (saldoHoras > 0) {
    estadoSaldo = 'HOLGURA';
    mensajeAuditoria = `Holgura de +${saldoHoras} hrs contractuales disponibles.`;
  } else if (saldoHoras < 0) {
    estadoSaldo = 'DEFICIT';
    mensajeAuditoria = `Déficit de ${saldoHoras} hrs contractuales. Faltan horas por contratar.`;
  } else {
    estadoSaldo = 'EXACTO';
    mensajeAuditoria = 'Contrato exacto con la carga de trabajo asignada.';
  }

  if (esInfractor) {
    mensajeAuditoria += ` ALERTA LEY 20.903: Exceso lectivo (${lectivePctReal}% > ${limitePonderadoPct}% ponderado permitido).`;
  }

  return {
    req65_35: req65,
    req60_40: req60,
    horasPieSep: pie,
    horasNoAula: noAula,
    contratoCalculadoTotal,
    contratoRealTotal: contratoReal,
    contratoRegularBase: cReg,
    contratoPonderado65_35: c65,
    contratoPonderado60_40: c60,
    minutosLectivosAula,
    minutosLectivosTablaTotal: totalLectivaCronMins,
    minutosRecreoTotal: totalRecreoMins,
    minutosHnlTotal: totalHnlMins,
    minutosHnlPlanificacion40: hnlPlanificacion40,
    minutosLimitePermitido,
    porcentajeLectivoReal: lectivePctReal,
    porcentajeLimitePonderado: limitePonderadoPct,
    esInfractorExcesoLectivo: esInfractor,
    saldoHoras,
    horasVacantes,
    estadoSaldo,
    mensajeAuditoria
  };
}
