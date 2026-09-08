/**
 * Motor Core MINEDUC - Tablas de Distribución Horaria Inmutables
 * Normativa: Ley N° 21.040, Ley N° 20.903 & Estatuto Docente Chile
 * 
 * Regla de Oro: Toda la aritmética interna se ejecuta estrictamente en MINUTOS ENTEROS.
 * (1 hora cronológica = 60 minutos | 1 hora pedagógica = 45 minutos)
 */

export interface MineducTramoMinutos {
  /** Horas cronológicas semanales de contrato */
  jornadaSemanalHoras: number;
  /** Total de minutos cronológicos del contrato (jornadaSemanalHoras * 60) */
  contratoMinutosTotales: number;
  /** Máximo de horas pedagógicas de aula (HA) asignables */
  lectivasHorasPedagogicas: number;
  /** Máximo de minutos cronológicos lectivos en aula (lectivasHorasPedagogicas * 45) */
  lectivasMinutosCronologicos: number;
  /** Minutos cronológicos de recreo asociados */
  recreoMinutosCronologicos: number;
  /** Mínimo de minutos cronológicos no lectivos (planificación, evaluación, etc.) */
  noLectivasMinutosCronologicos: number;
}

export type RegimenHorario = '65_35' | '60_40';

/** Utility para parsear cadenas formato "X h Y m" a minutos enteros */
export function parseHHMMToMinutes(hhmmStr: string): number {
  const match = hhmmStr.match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
  if (!match) return 0;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  return hours * 60 + minutes;
}

export const RAW_65_35 = [
  { jornada: 44, ha: 38, lectivas: "28 h 30 m", recreo: "3 h 0 m", hnl: "12 h 30 m" },
  { jornada: 43, ha: 37, lectivas: "27 h 45 m", recreo: "2 h 56 m", hnl: "12 h 19 m" },
  { jornada: 42, ha: 36, lectivas: "27 h 0 m", recreo: "2 h 52 m", hnl: "12 h 8 m" },
  { jornada: 41, ha: 35, lectivas: "26 h 15 m", recreo: "2 h 48 m", hnl: "11 h 57 m" },
  { jornada: 40, ha: 35, lectivas: "26 h 15 m", recreo: "2 h 44 m", hnl: "11 h 1 m" },
  { jornada: 39, ha: 34, lectivas: "25 h 30 m", recreo: "2 h 40 m", hnl: "10 h 50 m" },
  { jornada: 38, ha: 33, lectivas: "24 h 45 m", recreo: "2 h 35 m", hnl: "10 h 40 m" },
  { jornada: 37, ha: 32, lectivas: "24 h 0 m", recreo: "2 h 31 m", hnl: "10 h 29 m" },
  { jornada: 36, ha: 31, lectivas: "23 h 15 m", recreo: "2 h 27 m", hnl: "10 h 18 m" },
  { jornada: 35, ha: 30, lectivas: "22 h 30 m", recreo: "2 h 23 m", hnl: "10 h 7 m" },
  { jornada: 34, ha: 29, lectivas: "21 h 45 m", recreo: "2 h 19 m", hnl: "9 h 56 m" },
  { jornada: 33, ha: 29, lectivas: "21 h 45 m", recreo: "2 h 15 m", hnl: "9 h 0 m" },
  { jornada: 32, ha: 28, lectivas: "21 h 0 m", recreo: "2 h 11 m", hnl: "8 h 49 m" },
  { jornada: 31, ha: 27, lectivas: "20 h 15 m", recreo: "2 h 7 m", hnl: "8 h 38 m" },
  { jornada: 30, ha: 26, lectivas: "19 h 30 m", recreo: "2 h 3 m", hnl: "8 h 27 m" },
  { jornada: 29, ha: 25, lectivas: "18 h 45 m", recreo: "1 h 59 m", hnl: "8 h 16 m" },
  { jornada: 28, ha: 24, lectivas: "18 h 0 m", recreo: "1 h 55 m", hnl: "8 h 5 m" },
  { jornada: 27, ha: 23, lectivas: "17 h 15 m", recreo: "1 h 50 m", hnl: "7 h 55 m" },
  { jornada: 26, ha: 22, lectivas: "16 h 30 m", recreo: "1 h 46 m", hnl: "7 h 44 m" },
  { jornada: 25, ha: 22, lectivas: "16 h 30 m", recreo: "1 h 42 m", hnl: "6 h 48 m" },
  { jornada: 24, ha: 21, lectivas: "15 h 45 m", recreo: "1 h 38 m", hnl: "6 h 37 m" },
  { jornada: 23, ha: 20, lectivas: "15 h 0 m", recreo: "1 h 34 m", hnl: "6 h 26 m" },
  { jornada: 22, ha: 19, lectivas: "14 h 15 m", recreo: "1 h 30 m", hnl: "6 h 15 m" },
  { jornada: 21, ha: 18, lectivas: "13 h 30 m", recreo: "1 h 26 m", hnl: "6 h 4 m" },
  { jornada: 20, ha: 17, lectivas: "12 h 45 m", recreo: "1 h 22 m", hnl: "5 h 53 m" },
  { jornada: 19, ha: 16, lectivas: "12 h 0 m", recreo: "1 h 18 m", hnl: "5 h 42 m" },
  { jornada: 18, ha: 16, lectivas: "12 h 0 m", recreo: "1 h 14 m", hnl: "4 h 46 m" },
  { jornada: 17, ha: 15, lectivas: "11 h 15 m", recreo: "1 h 10 m", hnl: "4 h 35 m" },
  { jornada: 16, ha: 14, lectivas: "10 h 30 m", recreo: "1 h 5 m", hnl: "4 h 25 m" },
  { jornada: 15, ha: 13, lectivas: "9 h 45 m", recreo: "1 h 1 m", hnl: "4 h 14 m" },
  { jornada: 14, ha: 12, lectivas: "9 h 0 m", recreo: "0 h 57 m", hnl: "4 h 3 m" },
  { jornada: 13, ha: 11, lectivas: "8 h 15 m", recreo: "0 h 53 m", hnl: "3 h 52 m" },
  { jornada: 12, ha: 10, lectivas: "7 h 30 m", recreo: "0 h 49 m", hnl: "3 h 41 m" },
  { jornada: 11, ha: 10, lectivas: "7 h 30 m", recreo: "0 h 45 m", hnl: "2 h 45 m" },
  { jornada: 10, ha: 9, lectivas: "6 h 45 m", recreo: "0 h 41 m", hnl: "2 h 34 m" },
  { jornada: 9, ha: 8, lectivas: "6 h 0 m", recreo: "0 h 37 m", hnl: "2 h 23 m" },
  { jornada: 8, ha: 7, lectivas: "5 h 15 m", recreo: "0 h 33 m", hnl: "2 h 12 m" },
  { jornada: 7, ha: 6, lectivas: "4 h 30 m", recreo: "0 h 29 m", hnl: "2 h 1 m" },
  { jornada: 6, ha: 5, lectivas: "3 h 45 m", recreo: "0 h 25 m", hnl: "1 h 50 m" },
  { jornada: 5, ha: 4, lectivas: "3 h 0 m", recreo: "0 h 20 m", hnl: "1 h 40 m" },
  { jornada: 4, ha: 3, lectivas: "2 h 15 m", recreo: "0 h 16 m", hnl: "1 h 29 m" },
  { jornada: 3, ha: 3, lectivas: "2 h 15 m", recreo: "0 h 12 m", hnl: "0 h 33 m" },
  { jornada: 2, ha: 2, lectivas: "1 h 30 m", recreo: "0 h 8 m", hnl: "0 h 22 m" },
  { jornada: 1, ha: 1, lectivas: "0 h 45 m", recreo: "0 h 4 m", hnl: "0 h 11 m" }
];

export const RAW_60_40 = [
  { jornada: 44, ha: 35, lectivas: "26 h 15 m", recreo: "3 h 0 m", hnl: "14 h 45 m" },
  { jornada: 43, ha: 34, lectivas: "25 h 30 m", recreo: "2 h 56 m", hnl: "14 h 34 m" },
  { jornada: 42, ha: 33, lectivas: "24 h 45 m", recreo: "2 h 52 m", hnl: "14 h 23 m" },
  { jornada: 41, ha: 33, lectivas: "24 h 45 m", recreo: "2 h 48 m", hnl: "13 h 27 m" },
  { jornada: 40, ha: 32, lectivas: "24 h 0 m", recreo: "2 h 44 m", hnl: "13 h 16 m" },
  { jornada: 39, ha: 31, lectivas: "23 h 15 m", recreo: "2 h 40 m", hnl: "13 h 5 m" },
  { jornada: 38, ha: 30, lectivas: "22 h 30 m", recreo: "2 h 35 m", hnl: "12 h 55 m" },
  { jornada: 37, ha: 29, lectivas: "21 h 45 m", recreo: "2 h 31 m", hnl: "12 h 44 m" },
  { jornada: 36, ha: 29, lectivas: "21 h 45 m", recreo: "2 h 27 m", hnl: "11 h 48 m" },
  { jornada: 35, ha: 28, lectivas: "21 h 0 m", recreo: "2 h 23 m", hnl: "11 h 37 m" },
  { jornada: 34, ha: 27, lectivas: "20 h 15 m", recreo: "2 h 19 m", hnl: "11 h 26 m" },
  { jornada: 33, ha: 26, lectivas: "19 h 30 m", recreo: "2 h 15 m", hnl: "11 h 15 m" },
  { jornada: 32, ha: 25, lectivas: "18 h 45 m", recreo: "2 h 11 m", hnl: "11 h 4 m" },
  { jornada: 31, ha: 25, lectivas: "18 h 45 m", recreo: "2 h 7 m", hnl: "10 h 8 m" },
  { jornada: 30, ha: 24, lectivas: "18 h 0 m", recreo: "2 h 3 m", hnl: "9 h 57 m" },
  { jornada: 29, ha: 23, lectivas: "17 h 15 m", recreo: "1 h 59 m", hnl: "9 h 46 m" },
  { jornada: 28, ha: 22, lectivas: "16 h 30 m", recreo: "1 h 55 m", hnl: "9 h 35 m" },
  { jornada: 27, ha: 21, lectivas: "15 h 45 m", recreo: "1 h 50 m", hnl: "9 h 25 m" },
  { jornada: 26, ha: 21, lectivas: "15 h 45 m", recreo: "1 h 46 m", hnl: "8 h 29 m" },
  { jornada: 25, ha: 20, lectivas: "15 h 0 m", recreo: "1 h 42 m", hnl: "8 h 18 m" },
  { jornada: 24, ha: 19, lectivas: "14 h 15 m", recreo: "1 h 38 m", hnl: "8 h 7 m" },
  { jornada: 23, ha: 18, lectivas: "13 h 30 m", recreo: "1 h 34 m", hnl: "7 h 56 m" },
  { jornada: 22, ha: 18, lectivas: "13 h 30 m", recreo: "1 h 30 m", hnl: "7 h 0 m" },
  { jornada: 21, ha: 17, lectivas: "12 h 45 m", recreo: "1 h 26 m", hnl: "6 h 49 m" },
  { jornada: 20, ha: 16, lectivas: "12 h 0 m", recreo: "1 h 22 m", hnl: "6 h 38 m" },
  { jornada: 19, ha: 15, lectivas: "11 h 15 m", recreo: "1 h 18 m", hnl: "6 h 27 m" },
  { jornada: 18, ha: 14, lectivas: "10 h 30 m", recreo: "1 h 14 m", hnl: "6 h 16 m" },
  { jornada: 17, ha: 14, lectivas: "10 h 30 m", recreo: "1 h 10 m", hnl: "5 h 20 m" },
  { jornada: 16, ha: 13, lectivas: "9 h 45 m", recreo: "1 h 5 m", hnl: "5 h 10 m" },
  { jornada: 15, ha: 12, lectivas: "9 h 0 m", recreo: "1 h 1 m", hnl: "4 h 59 m" },
  { jornada: 14, ha: 11, lectivas: "8 h 15 m", recreo: "0 h 57 m", hnl: "4 h 48 m" },
  { jornada: 13, ha: 10, lectivas: "7 h 30 m", recreo: "0 h 53 m", hnl: "4 h 37 m" },
  { jornada: 12, ha: 10, lectivas: "7 h 30 m", recreo: "0 h 49 m", hnl: "3 h 41 m" },
  { jornada: 11, ha: 9, lectivas: "6 h 45 m", recreo: "0 h 45 m", hnl: "3 h 30 m" },
  { jornada: 10, ha: 8, lectivas: "6 h 0 m", recreo: "0 h 41 m", hnl: "3 h 19 m" },
  { jornada: 9, ha: 7, lectivas: "5 h 15 m", recreo: "0 h 37 m", hnl: "3 h 8 m" },
  { jornada: 8, ha: 6, lectivas: "4 h 30 m", recreo: "0 h 33 m", hnl: "2 h 57 m" },
  { jornada: 7, ha: 6, lectivas: "4 h 30 m", recreo: "0 h 29 m", hnl: "2 h 1 m" },
  { jornada: 6, ha: 5, lectivas: "3 h 45 m", recreo: "0 h 25 m", hnl: "1 h 50 m" },
  { jornada: 5, ha: 4, lectivas: "3 h 0 m", recreo: "0 h 20 m", hnl: "1 h 40 m" },
  { jornada: 4, ha: 3, lectivas: "2 h 15 m", recreo: "0 h 16 m", hnl: "1 h 29 m" },
  { jornada: 3, ha: 2, lectivas: "1 h 30 m", recreo: "0 h 12 m", hnl: "1 h 18 m" },
  { jornada: 2, ha: 2, lectivas: "1 h 30 m", recreo: "0 h 8 m", hnl: "0 h 22 m" },
  { jornada: 1, ha: 1, lectivas: "0 h 45 m", recreo: "0 h 4 m", hnl: "0 h 11 m" }
];

function buildMinutesMap(rawList: typeof RAW_65_35): Map<number, MineducTramoMinutos> {
  const map = new Map<number, MineducTramoMinutos>();
  for (const item of rawList) {
    const contratoMins = item.jornada * 60;
    const lectivasMins = item.ha * 45;
    const recreoMins = parseHHMMToMinutes(item.recreo);
    const hnlMins = parseHHMMToMinutes(item.hnl);
    
    const entry: MineducTramoMinutos = Object.freeze({
      jornadaSemanalHoras: item.jornada,
      contratoMinutosTotales: contratoMins,
      lectivasHorasPedagogicas: item.ha,
      lectivasMinutosCronologicos: lectivasMins,
      recreoMinutosCronologicos: recreoMins,
      noLectivasMinutosCronologicos: hnlMins
    });
    map.set(item.jornada, entry);
  }
  return map;
}

/** Mapa inmutable 65/35 indexed por horas de contrato */
export const MAPA_MINEDUC_65_35: ReadonlyMap<number, MineducTramoMinutos> = buildMinutesMap(RAW_65_35);

/** Mapa inmutable 60/40 indexed por horas de contrato */
export const MAPA_MINEDUC_60_40: ReadonlyMap<number, MineducTramoMinutos> = buildMinutesMap(RAW_60_40);

export interface DetalleTramoHorasAula {
  /** Horas cronológicas semanales de contrato de este tramo */
  jornada: number;
  /** Horas pedagógicas de aula del tramo */
  ha: number;
  /** Minutos cronológicos lectivos en aula */
  lectivasMinutos: number;
  /** Minutos cronológicos de recreo asociados */
  recreoMinutos: number;
  /** Minutos cronológicos no lectivos (HNL) asociados */
  hnlMinutos: number;
  /** Texto original de minutos lectivos cronológicos, ej: "7 h 30 m" */
  lectivasTexto: string;
  /** Texto original de recreo, ej: "0 h 49 m" */
  recreoTexto: string;
  /** Texto original de tiempo no lectivo, ej: "3 h 41 m" */
  hnlTexto: string;
}

/**
 * Busca el detalle normativo completo (jornada requerida, minutos lectivos cronológicos,
 * minutos de recreo y minutos no lectivos HNL) para una cantidad dada de horas de aula (HA)
 * en un régimen específico ('65_35' o '60_40').
 */
export function buscarDetallePorHorasAula(
  horasAulaRequeridas: number,
  regimen: RegimenHorario = '65_35'
): DetalleTramoHorasAula {
  if (horasAulaRequeridas <= 0) {
    return {
      jornada: 0,
      ha: 0,
      lectivasMinutos: 0,
      recreoMinutos: 0,
      hnlMinutos: 0,
      lectivasTexto: "0 h 0 m",
      recreoTexto: "0 h 0 m",
      hnlTexto: "0 h 0 m"
    };
  }

  const lista = regimen === '60_40' ? RAW_60_40 : RAW_65_35;

  for (let i = lista.length - 1; i >= 0; i--) {
    if (lista[i].ha >= horasAulaRequeridas) {
      const item = lista[i];
      return {
        jornada: item.jornada,
        ha: horasAulaRequeridas,
        lectivasMinutos: horasAulaRequeridas * 45,
        recreoMinutos: parseHHMMToMinutes(item.recreo),
        hnlMinutos: parseHHMMToMinutes(item.hnl),
        lectivasTexto: item.lectivas,
        recreoTexto: item.recreo,
        hnlTexto: item.hnl
      };
    }
  }

  // Si supera el máximo de la tabla oficial (ej. > 38 HA en 65/35 o > 35 HA en 60/40)
  const maxItem = lista[0];
  const maxHA = maxItem.ha;
  const factor = maxItem.jornada / maxHA;
  const jornadaExtrapolada = Math.ceil(horasAulaRequeridas * factor);
  const lectivasMins = horasAulaRequeridas * 45;
  const recreoMins = Math.round(lectivasMins * (regimen === '60_40' ? (3 / 26.25) : (3 / 28.5)));
  const contratoMins = jornadaExtrapolada * 60;
  const hnlMins = Math.max(0, contratoMins - lectivasMins - recreoMins);

  return {
    jornada: jornadaExtrapolada,
    ha: horasAulaRequeridas,
    lectivasMinutos: lectivasMins,
    recreoMinutos: recreoMins,
    hnlMinutos: hnlMins,
    lectivasTexto: `${Math.floor(lectivasMins / 60)} h ${lectivasMins % 60} m`,
    recreoTexto: `${Math.floor(recreoMins / 60)} h ${recreoMins % 60} m`,
    hnlTexto: `${Math.floor(hnlMins / 60)} h ${hnlMins % 60} m`
  };
}

/**
 * Busca el contrato mínimo en la tabla oficial MINEDUC para cubrir una determinada cantidad de horas de aula (HA).
 * Si horasAulaRequeridas <= 0, retorna 0.
 * Recorre la tabla buscando la jornada mínima que cumpla horas_lectivas_HA >= horasAulaRequeridas.
 */
export function buscarContratoMinimoPorTabla(horasAulaRequeridas: number, regimen: RegimenHorario = '65_35'): number {
  return buscarDetallePorHorasAula(horasAulaRequeridas, regimen).jornada;
}

// =============================================================================
// CATÁLOGO OFICIAL DE ASIGNATURAS (CEDS v7.1 / RefAcademicSubject - MINEDUC)
// =============================================================================
export interface RefAcademicSubject {
  code: string;
  name: string;
  category: 'PLAN_COMUN' | 'PLAN_ELECTIVO' | 'DIFERENCIADA_TP' | 'DIFERENCIADA_HC' | 'DIFERENCIADA_ART' | 'APOYO_PIE';
  description: string;
}

export const CATALOGO_ASIGNATURAS_MINEDUC: RefAcademicSubject[] = [
  { code: 'ASIG-110', name: 'Lengua y Literatura / Lenguaje y Comunicación', category: 'PLAN_COMUN', description: 'Desarrollo de habilidades comunicativas, comprensión lectora y producción escrita.' },
  { code: 'ASIG-120', name: 'Matemática', category: 'PLAN_COMUN', description: 'Razonamiento lógico, álgebra, geometría, cálculo y resolución de problemas.' },
  { code: 'ASIG-130', name: 'Ciencias Naturales', category: 'PLAN_COMUN', description: 'Formación científica integrada en Biología, Física y Química.' },
  { code: 'ASIG-140', name: 'Historia, Geografía y Ciencias Sociales', category: 'PLAN_COMUN', description: 'Comprensión histórica, espacial, cívica y memoria cultural.' },
  { code: 'ASIG-150', name: 'Idioma Extranjero: Inglés', category: 'PLAN_COMUN', description: 'Comunicación en lengua inglesa para contextos académicos y cotidianos.' },
  { code: 'ASIG-160', name: 'Artes Visuales', category: 'PLAN_COMUN', description: 'Expresión plástica, historia del arte y diseño visual.' },
  { code: 'ASIG-170', name: 'Música', category: 'PLAN_COMUN', description: 'Apreciación musical, teoría, interpretación coral e instrumental.' },
  { code: 'ASIG-180', name: 'Educación Física y Salud', category: 'PLAN_COMUN', description: 'Desarrollo motriz, deporte formativo y promoción de estilos de vida saludables.' },
  { code: 'ASIG-190', name: 'Tecnología', category: 'PLAN_COMUN', description: 'Diseño, innovación tecnológica y uso responsable de tecnologías digitales.' },
  { code: 'ASIG-200', name: 'Orientación', category: 'PLAN_COMUN', description: 'Desarrollo socioemocional, vocacional y formativo integral.' },
  { code: 'ASIG-210', name: 'Religión', category: 'PLAN_ELECTIVO', description: 'Formación espiritual y valórica confesional o ecuménica según proyecto escolar.' },
  { code: 'ASIG-220', name: 'Filosofía', category: 'PLAN_COMUN', description: 'Pensamiento crítico, ética, epistemología y argumentación para 3° y 4° Medio.' },
  { code: 'ASIG-230', name: 'Educación Ciudadana', category: 'PLAN_COMUN', description: 'Formación cívica, derechos humanos, democracia e institucionalidad para 3° y 4° Medio.' },
  { code: 'ASIG-240', name: 'Ciencias para la Ciudadanía', category: 'PLAN_COMUN', description: 'Alfabetización científica aplicada a salud, ambiente, tecnología y sociedad.' },
  { code: 'ASIG-250', name: 'Lengua Indígena', category: 'PLAN_COMUN', description: 'Sector de lengua y cosmovisión de pueblos originarios (Mapudungun, Quechua, Rapa Nui, Aymara).' },
  { code: 'ASIG-300', name: 'Especialidad Técnico-Profesional', category: 'DIFERENCIADA_TP', description: 'Módulos de formación profesional por especialidad técnica decretada.' },
  { code: 'ASIG-400', name: 'Formación Diferenciada Artística', category: 'DIFERENCIADA_ART', description: 'Módulos artísticos avanzados para liceos artísticos especializados.' },
  { code: 'ASIG-500', name: 'Apoyo Especializado PIE / Co-docencia', category: 'APOYO_PIE', description: 'Atención pedagógica diversificada por equipo multiprofesional de integración.' }
];
