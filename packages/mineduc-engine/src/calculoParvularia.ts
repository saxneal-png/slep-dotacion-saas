/**
 * Motor Core MINEDUC - Cálculo de Dotación en Educación Parvularia
 * Normativa: Ley N° 20.903, Decreto Supremo N° 306/2007, Decreto N° 315/2010 (LGE)
 * y Dictamen Ord. N° 101/2022 de la Dirección del Trabajo.
 * 
 * Regla de Oro: Toda la aritmética de permanencia y docencia de aula en Parvularia
 * se computa estrictamente en MINUTOS CRONOLÓGICOS ENTEROS.
 */

import {
  RAW_65_35,
  RAW_60_40,
  parseHHMMToMinutes,
  RegimenHorario
} from './tablasMineduc';
import { determinarRegimenNormativo, obtenerTramoMineduc } from './calculoJornada';

export const CONSTANTES_PARVULARIA = {
  /** Permanencia semanal oficial de párvulos en JECD: 35 horas y 25 minutos (DTO 306/2007) */
  PERMANENCIA_JEC_MINUTOS: 2125, // 35 * 60 + 25
  /** Permanencia semanal mínima NT1 sin JEC: 22 horas cronológicas */
  PERMANENCIA_MEDIA_JORNADA_NT1_MINUTOS: 1320, // 22 * 60
  /** Permanencia semanal mínima NT2 sin JEC: 20 horas cronológicas */
  PERMANENCIA_MEDIA_JORNADA_NT2_MINUTOS: 1200, // 20 * 60
  /** Permanencia semanal típica media jornada estándar: 22 horas 30 minutos */
  PERMANENCIA_MEDIA_JORNADA_DEFAULT_MINUTOS: 1350, // 22.5 * 60
  /** Umbral de matrícula para exigencia de Técnico en Párvulos (TEP) según DTO 315/2010 */
  UMBRAL_MATRICULA_TEP_DTO315: 15
} as const;

/**
 * Catálogo Oficial Curricular BCEP (Decreto 28/2019 y DTO 306/2007)
 * Ámbitos de Experiencias y Núcleos de Aprendizaje expresados en horas cronológicas (60 min).
 */
export interface NucleoParvulariaBcep {
  id: string;
  ambito: string;
  nucleo: string;
  horasJecCronologicas: number; // Horas cronológicas de 60 min para JEC
  horasMediaJornadaCronologicas: number; // Horas cronológicas de 60 min para Sin JEC
  descripcion?: string;
}

export const CATALOGO_BCEP_PARVULARIA: NucleoParvulariaBcep[] = [
  // 1. Ámbito Desarrollo Personal y Social
  {
    id: 'bcep_identidad',
    ambito: 'Desarrollo Personal y Social',
    nucleo: 'Identidad y Autonomía',
    horasJecCronologicas: 3,
    horasMediaJornadaCronologicas: 2,
    descripcion: 'Toma de conciencia de sus capacidades, emociones, corporalidad y toma de decisiones autónomas.'
  },
  {
    id: 'bcep_convivencia',
    ambito: 'Desarrollo Personal y Social',
    nucleo: 'Convivencia y Ciudadanía',
    horasJecCronologicas: 2.5,
    horasMediaJornadaCronologicas: 1.5,
    descripcion: 'Pautas de convivencia armónica, empatía, sentido de pertenencia y resolución pacífica.'
  },
  {
    id: 'bcep_corporalidad',
    ambito: 'Desarrollo Personal y Social',
    nucleo: 'Corporalidad y Movimiento',
    horasJecCronologicas: 2.5,
    horasMediaJornadaCronologicas: 1.5,
    descripcion: 'Esquema corporal, motricidad fina y gruesa, tono muscular y bienestar físico.'
  },

  // 2. Ámbito Comunicación Integral
  {
    id: 'bcep_lenguaje_verbal',
    ambito: 'Comunicación Integral',
    nucleo: 'Lenguaje Verbal',
    horasJecCronologicas: 6,
    horasMediaJornadaCronologicas: 4,
    descripcion: 'Comunicación oral reflexiva, conciencia fonológica, iniciación a la lectura y escritura.'
  },
  {
    id: 'bcep_lenguajes_artisticos',
    ambito: 'Comunicación Integral',
    nucleo: 'Lenguajes Artísticos',
    horasJecCronologicas: 4.5,
    horasMediaJornadaCronologicas: 3.5,
    descripcion: 'Expresión visual, plástica, musical, dramática y apreciación estética.'
  },

  // 3. Ámbito Interacción y Comprensión del Entorno
  {
    id: 'bcep_entorno_natural',
    ambito: 'Interacción y Comprensión del Entorno',
    nucleo: 'Exploración del Entorno Natural',
    horasJecCronologicas: 2.5,
    horasMediaJornadaCronologicas: 1.5,
    descripcion: 'Curiosidad científica, seres vivos, sostenibilidad y fenómenos de la naturaleza.'
  },
  {
    id: 'bcep_entorno_sociocultural',
    ambito: 'Interacción y Comprensión del Entorno',
    nucleo: 'Comprensión del Entorno Sociocultural',
    horasJecCronologicas: 2.5,
    horasMediaJornadaCronologicas: 1.5,
    descripcion: 'Diversidad social, patrimonio cultural, instituciones y modos de vida.'
  },
  {
    id: 'bcep_pensamiento_matematico',
    ambito: 'Interacción y Comprensión del Entorno',
    nucleo: 'Pensamiento Matemático',
    horasJecCronologicas: 4,
    horasMediaJornadaCronologicas: 3,
    descripcion: 'Nociones espaciotemporales, seriación, clasificación, cuantificación y patrones.'
  },

  // 4. Experiencias Integradas, Juego y Talleres JEC
  {
    id: 'bcep_talleres_integrados',
    ambito: 'Experiencias Integradas y Libre Disposición',
    nucleo: 'Juego Libre Guiado y Talleres de Desarrollo Integral',
    horasJecCronologicas: 7.9, // Complemento para totalizar 35h 25m (~35.41h)
    horasMediaJornadaCronologicas: 4,
    descripcion: 'Proyectos integrados, rincones de juego libre guiado, talleres psicomotrices y de libre disposición.'
  }
];

/**
 * Determina si el nivel o curso corresponde a Educación Parvularia (NT1, NT2, Kínder, Pre-Kínder o Combinado Parvulario).
 */
export function esNivelParvulario(nivelOCurso: string): boolean {
  if (!nivelOCurso) return false;
  const n = nivelOCurso.toLowerCase().trim();
  return (
    n.includes('nt1') ||
    n.includes('nt2') ||
    n.includes('prek') ||
    n.includes('pre-k') ||
    n.includes('kinder') ||
    n.includes('kínder') ||
    n.includes('parvul') ||
    n.includes('transicion') ||
    n.includes('transición') ||
    n.includes('heterogeneo parv') ||
    n.includes('heterogéneo parv')
  );
}

/**
 * Determina la permanencia cronológica requerida para los párvulos en minutos.
 */
export function determinarPermanenciaParvularia(
  nivel: string,
  regimen: 'JEC' | 'No JEC' | 'Mixto',
  permanenciaCustomMinutos?: number
): number {
  if (permanenciaCustomMinutos && permanenciaCustomMinutos > 0) {
    return permanenciaCustomMinutos;
  }

  if (regimen === 'JEC') {
    return CONSTANTES_PARVULARIA.PERMANENCIA_JEC_MINUTOS;
  }

  // Media Jornada (Sin JEC)
  const n = (nivel || '').toLowerCase().trim();
  if (n.includes('nt2') || (n.includes('kinder') && !n.includes('pre'))) {
    return CONSTANTES_PARVULARIA.PERMANENCIA_MEDIA_JORNADA_NT2_MINUTOS;
  }
  if (n.includes('nt1') || n.includes('prek') || n.includes('pre-k')) {
    return CONSTANTES_PARVULARIA.PERMANENCIA_MEDIA_JORNADA_NT1_MINUTOS;
  }

  return CONSTANTES_PARVULARIA.PERMANENCIA_MEDIA_JORNADA_DEFAULT_MINUTOS;
}

/** Formatea minutos a formato legible "X h Y m" */
export function formatearMinutosAHHMM(minutos: number): string {
  const m = Math.max(0, Math.round(minutos));
  const horas = Math.floor(m / 60);
  const minsRestantes = m % 60;
  return `${horas} h ${minsRestantes} m`;
}

export interface DetalleContratoParvularia {
  horasContrato: number;
  minutosAula: number;
  minutosRecreo: number;
  minutosHnl: number;
  textoAula: string;
}

/**
 * Busca en la tabla oficial MINEDUC (del régimen dado) la jornada de contrato entera mínima
 * cuya capacidad de aula directa cronológica cubra o supere `minutosRequeridos`.
 */
export function buscarContratoMinimoParvulariaPorMinutos(
  minutosRequeridos: number,
  regimen: RegimenHorario = '65_35'
): DetalleContratoParvularia {
  if (minutosRequeridos <= 0) {
    return {
      horasContrato: 0,
      minutosAula: 0,
      minutosRecreo: 0,
      minutosHnl: 0,
      textoAula: "0 h 0 m"
    };
  }

  const rawList = regimen === '60_40' ? RAW_60_40 : RAW_65_35;

  // Recorrer de menor a mayor jornada contractual (1 a 44)
  for (let i = rawList.length - 1; i >= 0; i--) {
    const item = rawList[i];
    const minsAula = parseHHMMToMinutes(item.lectivas);
    if (minsAula >= minutosRequeridos) {
      return {
        horasContrato: item.jornada,
        minutosAula: minsAula,
        minutosRecreo: parseHHMMToMinutes(item.recreo),
        minutosHnl: parseHHMMToMinutes(item.hnl),
        textoAula: item.lectivas
      };
    }
  }

  // Si excede el tope de 44 horas de una sola docente (ej. 1.710 min en 65/35 o 1.575 min en 60/40)
  const maxItem = rawList[0];
  const maxMinsAula = parseHHMMToMinutes(maxItem.lectivas);
  const factor = maxItem.jornada / maxMinsAula;
  const contratoEstimado = Math.ceil(minutosRequeridos * factor);

  return {
    horasContrato: contratoEstimado,
    minutosAula: minutosRequeridos,
    minutosRecreo: Math.round(minutosRequeridos * (regimen === '60_40' ? (180 / 1575) : (180 / 1710))),
    minutosHnl: Math.round(minutosRequeridos * (regimen === '60_40' ? (885 / 1575) : (750 / 1710))),
    textoAula: formatearMinutosAHHMM(minutosRequeridos)
  };
}

export interface InputCursoParvularia {
  id?: string;
  nivel: string;
  letra?: string;
  regimen: 'JEC' | 'No JEC' | 'Mixto';
  matriculaProyectada: number;
  esCombinado?: boolean;
  permanenciaMinutosCustom?: number;
}

export interface InputEducadoraTitular {
  horasContrato: number;
  horasNoAulaDeducibles?: number;
  horasContratoDisponiblesAula?: number;
  aplicaArticulo69?: boolean;
}

export interface ResultadoDotacionParvulariaCurso {
  cursoId?: string;
  nivel: string;
  letra?: string;
  regimenJornada: 'JEC' | 'No JEC' | 'Mixto';
  regimenNormativoProporcion: RegimenHorario;
  permanenciaMinutos: number;
  permanenciaTexto: string;
  horasContratoTitular: number;
  horasDisponiblesAulaTitular?: number;
  minutosAulaTitular: number;
  minutosAulaTitularTexto: string;
  minutosDeficit: number;
  minutosDeficitTexto: string;
  segundaEducadoraRequerida: boolean;
  horasContratoSegundaEducadora: number;
  minutosAulaSegundaEducadora: number;
  superavitMinutosAula: number;
  requiereTecnicoParvuloDto315: boolean;
  cantidadTecnicosSugeridos: number;
  esCursoCombinado: boolean;
  advertenciasNormativas: string[];
}

/**
 * Calcula con rigor normativo y aritmético en minutos la dotación requerida para un curso de Educación Parvularia
 * aplicando la Ley N° 20.903, Decreto N° 306/2007 (JECD) y Decreto N° 315/2010.
 */
export function calcularDotacionParvulariaCurso(
  curso: InputCursoParvularia,
  porcentajePrioritariosColegio: number,
  educadoraTitular?: InputEducadoraTitular | null
): ResultadoDotacionParvulariaCurso {
  // 1. Determinar Régimen Normativo:
  // En NT1 y NT2, colegios con >= 60% prioritarios pasan obligatoriamente a régimen 60/40 (Ley 20.903)
  const regimenNormativo: RegimenHorario = determinarRegimenNormativo(
    porcentajePrioritariosColegio,
    true // Es ciclo inicial parvulario
  );

  // 2. Determinar Permanencia Requerida del Curso (Minutos)
  const permanenciaMinutos = determinarPermanenciaParvularia(
    curso.nivel,
    curso.regimen,
    curso.permanenciaMinutosCustom
  );

  // 3. Aporte de Aula de la Educadora Titular
  let minutosAulaTitular = 0;
  let horasContratoTitular = 0;
  let horasDisponiblesAulaTitular = 0;
  const advertencias: string[] = [];

  if (educadoraTitular && educadoraTitular.horasContrato > 0) {
    horasContratoTitular = educadoraTitular.horasContrato;
    
    // Determinar las horas de contrato efectivas para aula:
    // Si se especifican horas disponibles para aula o se deducen horas no lectivas/funciones no aula
    if (typeof educadoraTitular.horasContratoDisponiblesAula === 'number') {
      horasDisponiblesAulaTitular = Math.max(0, Math.min(44, educadoraTitular.horasContratoDisponiblesAula));
    } else if (typeof educadoraTitular.horasNoAulaDeducibles === 'number') {
      horasDisponiblesAulaTitular = Math.max(0, horasContratoTitular - educadoraTitular.horasNoAulaDeducibles);
    } else {
      horasDisponiblesAulaTitular = horasContratoTitular;
    }

    if (horasDisponiblesAulaTitular < horasContratoTitular) {
      advertencias.push(
        `Educadora Titular con ${horasContratoTitular}h contrato tiene ${horasContratoTitular - horasDisponiblesAulaTitular}h en funciones no aula/colaboración. Horas disponibles para aula: ${horasDisponiblesAulaTitular}h.`
      );
    }

    const tramo = obtenerTramoMineduc(horasDisponiblesAulaTitular, regimenNormativo);
    
    if (tramo) {
      minutosAulaTitular = tramo.lectivasMinutosCronologicos;
    } else {
      const prop = regimenNormativo === '60_40' ? 0.60 : 0.65;
      minutosAulaTitular = Math.floor(horasDisponiblesAulaTitular * 60 * prop);
    }

    // Si aplica Artículo 69 (rebaja por antigüedad), tope de 24 horas cronológicas de aula (1.440 min)
    if (educadoraTitular.aplicaArticulo69 && minutosAulaTitular > 1440) {
      minutosAulaTitular = 1440;
      advertencias.push(
        "Aplica reducción del Art. 69 (DFL 1/1996): docencia de aula limitada a 24 horas cronológicas (1.440 min)."
      );
    }
  } else {
    advertencias.push("El curso no cuenta con Educadora Titular asignada.");
  }

  // 4. Calcular Déficit de Atención Directa
  const minutosDeficit = Math.max(0, permanenciaMinutos - minutosAulaTitular);
  const segundaEducadoraRequerida = minutosDeficit > 0;

  // 5. Ceil Matching para Segunda Educadora (Co-docente)
  let horasContratoSegunda = 0;
  let minutosAulaSegunda = 0;
  let superavitMinutosAula = 0;

  if (segundaEducadoraRequerida) {
    const matching = buscarContratoMinimoParvulariaPorMinutos(minutosDeficit, regimenNormativo);
    horasContratoSegunda = matching.horasContrato;
    minutosAulaSegunda = matching.minutosAula;
    superavitMinutosAula = minutosAulaSegunda - minutosDeficit;

    advertencias.push(
      `Permanencia del curso (${formatearMinutosAHHMM(permanenciaMinutos)}) supera el tope de aula de la titular (${formatearMinutosAHHMM(minutosAulaTitular)}). Se proyecta Segunda Educadora con contrato de ${horasContratoSegunda} hrs (aporta ${formatearMinutosAHHMM(minutosAulaSegunda)}).`
    );
  }

  // 6. Coeficiente Técnico de Asistentes (DTO 315 / DTO 100)
  const requiereTecnicoParvuloDto315 = (curso.matriculaProyectada || 0) > CONSTANTES_PARVULARIA.UMBRAL_MATRICULA_TEP_DTO315;
  const cantidadTecnicosSugeridos = requiereTecnicoParvuloDto315 ? 1 : 0;

  if (requiereTecnicoParvuloDto315) {
    advertencias.push(
      `Por DTO 315/2010 (matrícula > ${CONSTANTES_PARVULARIA.UMBRAL_MATRICULA_TEP_DTO315}), el curso requiere obligatoriamente 1 Técnico en Educación Parvularia (TEP).`
    );
  }

  if (curso.esCombinado) {
    advertencias.push("Curso clasificado como Combinado/Heterogéneo: permanencia de sala unificada para el grupo.");
  }

  return {
    cursoId: curso.id,
    nivel: curso.nivel,
    letra: curso.letra,
    regimenJornada: curso.regimen,
    regimenNormativoProporcion: regimenNormativo,
    permanenciaMinutos,
    permanenciaTexto: formatearMinutosAHHMM(permanenciaMinutos),
    horasContratoTitular,
    horasDisponiblesAulaTitular,
    minutosAulaTitular,
    minutosAulaTitularTexto: formatearMinutosAHHMM(minutosAulaTitular),
    minutosDeficit,
    minutosDeficitTexto: formatearMinutosAHHMM(minutosDeficit),
    segundaEducadoraRequerida,
    horasContratoSegundaEducadora: horasContratoSegunda,
    minutosAulaSegundaEducadora: minutosAulaSegunda,
    superavitMinutosAula,
    requiereTecnicoParvuloDto315,
    cantidadTecnicosSugeridos,
    esCursoCombinado: Boolean(curso.esCombinado),
    advertenciasNormativas: advertencias
  };
}

export interface ConsolidadoDotacionParvulariaColegio {
  totalCursosParvularia: number;
  totalMatriculaParvularia: number;
  totalPermanenciaMinutos: number;
  totalMinutosAulaTitulares: number;
  totalMinutosDeficit: number;
  totalMinutosDeficitTexto: string;
  cursosConDeficitCount: number;
  sumaContratosAisladosSegundaEducadoraHoras: number;
  /** Contrato consolidado optimizado (Pool de co-docencia compartido a nivel colegio) */
  contratoSugeridoPoolSegundaEducadoraHoras: number;
  minutosAulaPoolSegundaEducadora: number;
  ahorroHorasPorPool: number;
  totalTecnicosParvuloRequeridosDto315: number;
  regimenPredominante: RegimenHorario;
  diagnosticoCursos: ResultadoDotacionParvulariaCurso[];
}

/**
 * Consolida la demanda parvularia a nivel de establecimiento, permitiendo optimizar
 * la contratación de educadoras de apoyo en un pool multicurso en vez de contratos aislados.
 */
export function consolidarDotacionParvulariaEstablecimiento(
  cursos: InputCursoParvularia[],
  porcentajePrioritariosColegio: number,
  titularesPorCurso?: Map<string, InputEducadoraTitular>
): ConsolidadoDotacionParvulariaColegio {
  const cursosParvularios = cursos.filter(c => esNivelParvulario(c.nivel));
  const regimenPredominante = determinarRegimenNormativo(porcentajePrioritariosColegio, true);

  let totalMatricula = 0;
  let totalPermanencia = 0;
  let totalAulaTitulares = 0;
  let totalDeficit = 0;
  let sumaContratosAislados = 0;
  let totalTecnicosReq = 0;
  let cursosConDeficit = 0;

  const diagnosticoCursos: ResultadoDotacionParvulariaCurso[] = [];

  for (const c of cursosParvularios) {
    const titular = (c.id && titularesPorCurso) ? titularesPorCurso.get(c.id) : undefined;
    const diag = calcularDotacionParvulariaCurso(c, porcentajePrioritariosColegio, titular);

    diagnosticoCursos.push(diag);
    totalMatricula += c.matriculaProyectada || 0;
    totalPermanencia += diag.permanenciaMinutos;
    totalAulaTitulares += diag.minutosAulaTitular;
    totalDeficit += diag.minutosDeficit;
    sumaContratosAislados += diag.horasContratoSegundaEducadora;
    totalTecnicosReq += diag.cantidadTecnicosSugeridos;
    if (diag.segundaEducadoraRequerida) {
      cursosConDeficit++;
    }
  }

  // Contratación optimizada en Pool Unificado
  let contratoPoolHoras = 0;
  let minutosAulaPool = 0;
  if (totalDeficit > 0) {
    const matchingPool = buscarContratoMinimoParvulariaPorMinutos(totalDeficit, regimenPredominante);
    contratoPoolHoras = matchingPool.horasContrato;
    minutosAulaPool = matchingPool.minutosAula;
  }

  const ahorroHoras = Math.max(0, sumaContratosAislados - contratoPoolHoras);

  return {
    totalCursosParvularia: cursosParvularios.length,
    totalMatriculaParvularia: totalMatricula,
    totalPermanenciaMinutos: totalPermanencia,
    totalMinutosAulaTitulares: totalAulaTitulares,
    totalMinutosDeficit: totalDeficit,
    totalMinutosDeficitTexto: formatearMinutosAHHMM(totalDeficit),
    cursosConDeficitCount: cursosConDeficit,
    sumaContratosAisladosSegundaEducadoraHoras: sumaContratosAislados,
    contratoSugeridoPoolSegundaEducadoraHoras: contratoPoolHoras,
    minutosAulaPoolSegundaEducadora: minutosAulaPool,
    ahorroHorasPorPool: ahorroHoras,
    totalTecnicosParvuloRequeridosDto315: totalTecnicosReq,
    regimenPredominante,
    diagnosticoCursos
  };
}
