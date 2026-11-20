/**
 * Motor de Calce Territorial, Movilidad Docente y Vacantes de Rebote
 * Normativa: Ley 20.903 (65/35, 60/40), Art. 69 DFL 1/1996 (máx 32 HA / 1440 min lectivos),
 * Art. 42 Estatuto Docente (No menoscabo horas titulares), Tope Territorial SLEP 44h (2640 min),
 * Ley 20.248 SEP / Decreto 170 PIE y Matriz de Proximidad SLEP Valle Diguillín.
 *
 * REGLA DE ORO: Toda aritmética horaria se ejecuta estrictamente en MINUTOS ENTEROS.
 * @slep/mineduc-engine - 100% puro, sin dependencias externas.
 */

import { calcularJornadaMinutos, determinarRegimenNormativo } from './calculoJornada';
import { RegimenHorario } from './tablasMineduc';
import {
  EgresoProyectadoInput,
  validarConsolidacionSobreEgreso,
} from './egresosContingencia';

export const TOPE_MINUTOS_SEMANALES_SLEP = 2640; // 44 * 60
export const MAX_MINUTOS_LECTIVOS_ART_69 = 1440; // 24 * 60 (32 HA * 45 min)

export type ComunaValleDiguillin =
  | 'Chillán'
  | 'Chillán Viejo'
  | 'Bulnes'
  | 'San Ignacio'
  | 'El Carmen'
  | 'Pemuco'
  | 'Yungay';

/**
 * Matriz simétrica de distancias viales aproximadas (en km) entre las 7 comunas
 * del Servicio Local de Educación Pública (SLEP) Valle Diguillín, Región de Ñuble.
 */
export const MATRIZ_DISTANCIA_KM_VALLE_DIGUILLIN: Record<
  ComunaValleDiguillin,
  Record<ComunaValleDiguillin, number>
> = {
  Chillán: {
    Chillán: 0,
    'Chillán Viejo': 4,
    Bulnes: 26,
    'San Ignacio': 28,
    'El Carmen': 42,
    Pemuco: 44,
    Yungay: 65,
  },
  'Chillán Viejo': {
    Chillán: 4,
    'Chillán Viejo': 0,
    Bulnes: 22,
    'San Ignacio': 25,
    'El Carmen': 39,
    Pemuco: 40,
    Yungay: 61,
  },
  Bulnes: {
    Chillán: 26,
    'Chillán Viejo': 22,
    Bulnes: 0,
    'San Ignacio': 18,
    'El Carmen': 32,
    Pemuco: 21,
    Yungay: 44,
  },
  'San Ignacio': {
    Chillán: 28,
    'Chillán Viejo': 25,
    Bulnes: 18,
    'San Ignacio': 0,
    'El Carmen': 15,
    Pemuco: 24,
    Yungay: 42,
  },
  'El Carmen': {
    Chillán: 42,
    'Chillán Viejo': 39,
    Bulnes: 32,
    'San Ignacio': 15,
    'El Carmen': 0,
    Pemuco: 22,
    Yungay: 31,
  },
  Pemuco: {
    Chillán: 44,
    'Chillán Viejo': 40,
    Bulnes: 21,
    'San Ignacio': 24,
    'El Carmen': 22,
    Pemuco: 0,
    Yungay: 26,
  },
  Yungay: {
    Chillán: 65,
    'Chillán Viejo': 61,
    Bulnes: 44,
    'San Ignacio': 42,
    'El Carmen': 31,
    Pemuco: 26,
    Yungay: 0,
  },
};

const MAPA_NORMALIZADO_COMUNAS: Record<string, ComunaValleDiguillin> = {
  CHILLAN: 'Chillán',
  'CHILLAN VIEJO': 'Chillán Viejo',
  BULNES: 'Bulnes',
  'SAN IGNACIO': 'San Ignacio',
  'EL CARMEN': 'El Carmen',
  PEMUCO: 'Pemuco',
  YUNGAY: 'Yungay',
};

export type CarrilMovilidad =
  | 'NO_CONTINUIDAD_TITULAR'
  | 'TRASLADO_VOLUNTARIO'
  | 'HORAS_REMANENTES';

export type FuenteFinanciamientoCalce =
  | 'SUBVENCION_GENERAL'
  | 'SEP'
  | 'PIE'
  | 'MIXTO';

export type FuenteDestinoVacante = 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';

export type TipoCoberturaCalce = 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL';

export interface PrioridadMovilidadInput {
  carril: CarrilMovilidad;
  puntajeSalud?: number;
  puntajeLeyKarin?: number;
  puntajeCuidadoDependientes?: number;
  puntajeDistanciaRural?: number;
  puntajeAntiguedad?: number;
  horasRemanentes?: number;
}

export interface EvaluacionCalceInput {
  docenteId: string;
  calidadJuridica: string;
  asignaturaDocente?: string;
  tituloMencion?: string;
  aplicaArticulo69?: boolean;
  horasContratoActual: number;
  horasTitularesActuales?: number;
  horasOtrosEstablecimientos?: number;
  horasConservadasEnOrigen?: number;
  fuenteOrigen?: FuenteFinanciamientoCalce;
  comunaOrigen?: string;
  carril?: CarrilMovilidad;
  esTrasladoCompleto?: boolean;

  vacanteId: string;
  rbdDestino: string;
  horasVacante: number;
  horasPedagogicasVacante?: number;
  asignaturaVacante?: string;
  fuenteDestino: FuenteDestinoVacante;
  porcentajePrioritariosDestino: number;
  nivelCicloDestino?: string;
  comunaDestino?: string;
  esVacanteCondicional?: boolean;
  egresoAsociado?: EgresoProyectadoInput;
  tipoCobertura?: TipoCoberturaCalce;
}

export interface ResultadoEvaluacionCalce {
  docenteId: string;
  vacanteId: string;
  rbdDestino: string;
  minutosOtros: number;
  minutosConservadosOrigen: number;
  minutosVacante: number;
  minutosTotalesMultiEscuela: number;
  excedeTope44h: boolean;
  regimenDestino: RegimenHorario;
  horasPedagogicasMaximasDestino: number;
  minutosLectivosMaximosDestino: number;
  minutosRecreoDestino: number;
  minutosNoLectivosDestino: number;
  excedeTopeArt69: boolean;
  esSobreasignadoDestino: boolean;
  alertaMenoscaboArt42: boolean;
  deficitMinutosTitulares: number;
  alertaFinanciamientoSepPie: boolean;
  bloqueaConsolidacion: boolean;
  motivoBloqueo?: string;
  puntajeIdoneidad: number;
  coincideEspecialidad: boolean;
  distanciaKm: number;
  puntajeProximidad: number;
  indiceCompatibilidad: number;
  alertasNormativas: string[];
}

export interface AsignacionOrigenRebote {
  curso?: string;
  asignatura?: string;
  codigoAsignatura?: string;
  horasPedagogicas: number;
}

export interface FuncionNoAulaOrigenRebote {
  tipoFuncion?: string;
  descripcion?: string;
  horasCronologicas?: number;
  minutosSemanales?: number;
}

export interface GeneracionReboteInput {
  rbdOrigen: string;
  nombreEstablecimientoOrigen?: string;
  horasTrasladadas: number;
  asignaturaPrincipal?: string;
  fuenteFinanciamiento: FuenteFinanciamientoCalce | string;
  asignacionesOrigen?: AsignacionOrigenRebote[];
  funcionesNoAulaOrigen?: FuncionNoAulaOrigenRebote[];
}

export interface VacanteReboteOutput {
  rbdOrigen: string;
  nombreEstablecimientoOrigen?: string;
  asignaturaPrincipal?: string;
  fuenteFinanciamiento: FuenteFinanciamientoCalce | string;
  horasContratoRebote: number;
  minutosContratoRebote: number;
  horasPedagogicasAula: number;
  minutosLectivosAulaRebote: number;
  asignacionesHeredadas: AsignacionOrigenRebote[];
  funcionesNoLectivasHeredadas: FuncionNoAulaOrigenRebote[];
  deltaMinutosCadena: number;
  cadenaBalanceada: boolean;
}

export interface VacanteObjetivoCalce {
  vacanteId: string;
  rbdDestino: string;
  horasVacante: number;
  horasPedagogicasVacante?: number;
  asignaturaVacante?: string;
  fuenteDestino: FuenteDestinoVacante;
  porcentajePrioritariosDestino: number;
  nivelCicloDestino?: string;
  comunaDestino?: string;
  esVacanteCondicional?: boolean;
  egresoAsociado?: EgresoProyectadoInput;
  tipoCobertura?: TipoCoberturaCalce;
}

export interface DocenteCandidatoCalce
  extends Omit<EvaluacionCalceInput, keyof VacanteObjetivoCalce> {
  prioridadMovilidad?: PrioridadMovilidadInput;
}

export interface SugerenciaCalce {
  candidato: DocenteCandidatoCalce;
  puntajePrioridad: number;
  evaluacion: ResultadoEvaluacionCalce;
}

function normalizarTexto(valor?: string): string {
  if (!valor) return '';
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function clamp0_100(valor?: number): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0;
  return Math.min(100, Math.max(0, valor));
}

function puntajeDesdeDistanciaKm(distanciaKm: number): number {
  if (distanciaKm === 0) return 100;
  if (distanciaKm <= 15) return 90;
  if (distanciaKm <= 30) return 75;
  if (distanciaKm <= 50) return 55;
  return 35;
}

/**
 * Calcula la distancia aproximada (km) y el puntaje de proximidad (0..100) entre
 * comunas del SLEP Valle Diguillín.
 * Retorna distanciaKm = -1 y puntajeProximidad = 50 cuando alguna comuna es desconocida.
 */
export function calcularPuntajeProximidadComuna(
  comunaOrigen?: string,
  comunaDestino?: string
): { distanciaKm: number; puntajeProximidad: number } {
  const origNorm = normalizarTexto(comunaOrigen);
  const destNorm = normalizarTexto(comunaDestino);

  if (!origNorm || !destNorm) {
    return { distanciaKm: -1, puntajeProximidad: 50 };
  }

  const origCanonica = MAPA_NORMALIZADO_COMUNAS[origNorm];
  const destCanonica = MAPA_NORMALIZADO_COMUNAS[destNorm];

  if (origCanonica && destCanonica) {
    const distanciaKm = MATRIZ_DISTANCIA_KM_VALLE_DIGUILLIN[origCanonica][destCanonica];
    return {
      distanciaKm,
      puntajeProximidad: puntajeDesdeDistanciaKm(distanciaKm),
    };
  }

  if (origNorm === destNorm) {
    return { distanciaKm: 0, puntajeProximidad: 100 };
  }

  return { distanciaKm: -1, puntajeProximidad: 50 };
}

/**
 * Calcula el puntaje de prioridad de movilidad territorial según carril normativo:
 * - NO_CONTINUIDAD_TITULAR: 1000 + round(clamp(antiguedad) * 0.5) (siempre prioritario)
 * - TRASLADO_VOLUNTARIO: ponderación Karin 30% + Salud 25% + Dependientes 20% + Distancia 15% + Antigüedad 10%
 * - HORAS_REMANENTES: min(99, max(0, round(horasRemanentes * 2)))
 */
export function calcularPuntajePrioridadMovilidad(
  input: PrioridadMovilidadInput
): number {
  if (input.carril === 'NO_CONTINUIDAD_TITULAR') {
    const antiguedad = clamp0_100(input.puntajeAntiguedad);
    return 1000 + Math.round(antiguedad * 0.5);
  }

  if (input.carril === 'TRASLADO_VOLUNTARIO') {
    const karin = clamp0_100(input.puntajeLeyKarin);
    const salud = clamp0_100(input.puntajeSalud);
    const dependientes = clamp0_100(input.puntajeCuidadoDependientes);
    const distancia = clamp0_100(input.puntajeDistanciaRural);
    const antiguedad = clamp0_100(input.puntajeAntiguedad);

    return Math.round(
      karin * 0.3 +
        salud * 0.25 +
        dependientes * 0.2 +
        distancia * 0.15 +
        antiguedad * 0.1
    );
  }

  return Math.min(99, Math.max(0, Math.round((input.horasRemanentes || 0) * 2)));
}

type FamiliaCurricular =
  | 'LENGUAJE'
  | 'MATEMATICA'
  | 'HISTORIA'
  | 'CIENCIAS'
  | 'INGLES'
  | 'EDUCACION_FISICA'
  | 'ARTES_MUSICA'
  | 'TECNOLOGIA'
  | 'DIFERENCIAL_PIE'
  | 'PARVULARIA'
  | 'GENERAL_BASICA'
  | 'FILOSOFIA'
  | 'RELIGION'
  | 'TECNICO_PROFESIONAL';

const FAMILIAS_BASICA_COMUN = new Set<FamiliaCurricular>([
  'LENGUAJE',
  'MATEMATICA',
  'HISTORIA',
  'CIENCIAS',
  'ARTES_MUSICA',
  'TECNOLOGIA',
  'EDUCACION_FISICA',
  'GENERAL_BASICA',
]);

function clasificarFamiliaCurricular(textoNorm: string): FamiliaCurricular | null {
  if (!textoNorm) return null;

  if (
    textoNorm.includes('DIFERENCIAL') ||
    /\bPIE\b/.test(textoNorm) ||
    textoNorm.includes('EDUCACION ESPECIAL') ||
    textoNorm.includes('PSICOPEDAGOG') ||
    textoNorm.includes('INTEGRACION') ||
    textoNorm.includes('NECESIDADES EDUCATIVAS')
  ) {
    return 'DIFERENCIAL_PIE';
  }
  if (
    textoNorm.includes('PARVUL') ||
    textoNorm.includes('PREBASICA') ||
    textoNorm.includes('PRE BASICA') ||
    textoNorm.includes('KINDER') ||
    /\bNT[12]\b/.test(textoNorm)
  ) {
    return 'PARVULARIA';
  }
  if (
    textoNorm.includes('GENERAL BASICA') ||
    textoNorm.includes('EDUCACION BASICA') ||
    textoNorm.includes('BASICA GENERAL') ||
    textoNorm.includes('GENERALISTA') ||
    textoNorm.includes('MULTIGRADO') ||
    textoNorm.includes('DOCENTE BASICO')
  ) {
    return 'GENERAL_BASICA';
  }
  if (
    textoNorm.includes('LENGUAJE') ||
    textoNorm.includes('LENGUA Y LITERATURA') ||
    textoNorm.includes('CASTELLANO') ||
    textoNorm.includes('COMUNICACION')
  ) {
    return 'LENGUAJE';
  }
  if (
    textoNorm.includes('MATEMATICA') ||
    textoNorm.includes('ALGEBRA') ||
    textoNorm.includes('GEOMETRIA') ||
    textoNorm.includes('CALCULO')
  ) {
    return 'MATEMATICA';
  }
  if (
    textoNorm.includes('HISTORIA') ||
    textoNorm.includes('GEOGRAFIA') ||
    textoNorm.includes('CIENCIAS SOCIALES') ||
    textoNorm.includes('EDUCACION CIUDADANA') ||
    textoNorm.includes('CIVICA')
  ) {
    return 'HISTORIA';
  }
  if (
    textoNorm.includes('BIOLOGIA') ||
    textoNorm.includes('QUIMICA') ||
    textoNorm.includes('FISICA') && !textoNorm.includes('EDUCACION FISICA') ||
    textoNorm.includes('CIENCIAS NATURALES') ||
    textoNorm.includes('CIENCIAS PARA LA CIUDADANIA') ||
    textoNorm === 'CIENCIAS'
  ) {
    return 'CIENCIAS';
  }
  if (
    textoNorm.includes('EDUCACION FISICA') ||
    textoNorm.includes('ED FISICA') ||
    textoNorm.includes('ED. FISICA') ||
    textoNorm.includes('DEPORTE')
  ) {
    return 'EDUCACION_FISICA';
  }
  if (textoNorm.includes('INGLES') || textoNorm.includes('IDIOMA EXTRANJERO')) {
    return 'INGLES';
  }
  if (
    textoNorm.includes('ARTES') ||
    textoNorm.includes('MUSICA') ||
    textoNorm.includes('ARTISTICA')
  ) {
    return 'ARTES_MUSICA';
  }
  if (
    textoNorm.includes('TECNOLOGIA') ||
    textoNorm.includes('INFORMATICA') ||
    textoNorm.includes('COMPUTACION')
  ) {
    return 'TECNOLOGIA';
  }
  if (textoNorm.includes('FILOSOFIA')) {
    return 'FILOSOFIA';
  }
  if (textoNorm.includes('RELIGION')) {
    return 'RELIGION';
  }
  if (textoNorm.includes('TECNICO PROFESIONAL') || /\bTP\b/.test(textoNorm)) {
    return 'TECNICO_PROFESIONAL';
  }

  return null;
}

function normalizarSingularBasico(textoNorm: string): string {
  return textoNorm.replace(/MATEMATICAS/g, 'MATEMATICA');
}

/**
 * Evalúa compatibilidad curricular entre la mención/asignatura del docente y la especialidad de la vacante.
 * Retorna puntajes: exacta (100), familia curricular (75), generalista (55), discrepancia (15).
 */
export function evaluarCompatibilidadEspecialidad(
  mencionODocente?: string,
  especialidadVacante?: string
): { puntaje: number; coincide: boolean; motivo: string } {
  const docNorm = normalizarSingularBasico(normalizarTexto(mencionODocente));
  const vacNorm = normalizarSingularBasico(normalizarTexto(especialidadVacante));

  if (!docNorm && !vacNorm) {
    return {
      puntaje: 55,
      coincide: true,
      motivo: 'Sin especialidad declarada en docente ni vacante',
    };
  }
  if (!vacNorm) {
    return {
      puntaje: 75,
      coincide: true,
      motivo: 'Vacante sin especialidad restrictiva declarada',
    };
  }
  if (!docNorm) {
    return {
      puntaje: 35,
      coincide: false,
      motivo: 'Docente sin especialidad o mención registrada',
    };
  }

  if (docNorm === vacNorm) {
    return {
      puntaje: 100,
      coincide: true,
      motivo: `Coincidencia exacta de especialidad (${especialidadVacante})`,
    };
  }

  const famDoc = clasificarFamiliaCurricular(docNorm);
  const famVac = clasificarFamiliaCurricular(vacNorm);

  if (
    (docNorm.includes(vacNorm) || vacNorm.includes(docNorm)) &&
    Math.min(docNorm.length, vacNorm.length) >= 5 &&
    famDoc === famVac &&
    famDoc !== null
  ) {
    return {
      puntaje: 100,
      coincide: true,
      motivo: `Coincidencia directa de especialidad (${especialidadVacante})`,
    };
  }

  if (famDoc && famVac && famDoc === famVac) {
    return {
      puntaje: 75,
      coincide: true,
      motivo: `Coincidencia dentro de familia curricular (${famVac})`,
    };
  }

  if (
    (famDoc === 'GENERAL_BASICA' && (!famVac || FAMILIAS_BASICA_COMUN.has(famVac))) ||
    (famVac === 'GENERAL_BASICA' && (!famDoc || FAMILIAS_BASICA_COMUN.has(famDoc)))
  ) {
    return {
      puntaje: 55,
      coincide: true,
      motivo: 'Habilitación generalista compatible con asignatura base',
    };
  }

  return {
    puntaje: 15,
    coincide: false,
    motivo: `Incompatibilidad de especialidad (${mencionODocente} vs ${especialidadVacante})`,
  };
}

/**
 * Evalúa el calce normativo, horario (en minutos enteros), jurídico (Art. 42, Art. 69,
 * egresos en trámite), financiero (SEP/PIE) y territorial de un docente sobre una vacante.
 */
export function evaluarCalceDocenteVacante(
  input: EvaluacionCalceInput
): ResultadoEvaluacionCalce {
  const alertasNormativas: string[] = [];
  const motivosBloqueo: string[] = [];

  const horasVacanteSeguras = Math.max(0, input.horasVacante);
  const horasContratoSeguras = Math.max(0, input.horasContratoActual);

  const minutosOtros = Math.round(Math.max(0, input.horasOtrosEstablecimientos || 0) * 60);
  const minutosConservadosOrigen = input.esTrasladoCompleto
    ? 0
    : Math.round(Math.max(0, input.horasConservadasEnOrigen || 0) * 60);
  const minutosVacante = Math.round(horasVacanteSeguras * 60);
  const minutosTotalesMultiEscuela =
    minutosOtros + minutosConservadosOrigen + minutosVacante;

  const excedeTope44h = minutosTotalesMultiEscuela > TOPE_MINUTOS_SEMANALES_SLEP;
  if (excedeTope44h) {
    const msg = `Exceso de tope territorial 44h (${minutosTotalesMultiEscuela} min > ${TOPE_MINUTOS_SEMANALES_SLEP} min permitidos en SLEP).`;
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  }

  // Regimen y cálculo estricto en minutos enteros reutilizando @slep/mineduc-engine
  const regimenDestino = determinarRegimenNormativo(
    input.porcentajePrioritariosDestino,
    input.nivelCicloDestino
  );
  const haSolicitadas = Math.max(0, input.horasPedagogicasVacante ?? 0);
  const jornadaDestino = calcularJornadaMinutos(
    horasVacanteSeguras,
    haSolicitadas,
    regimenDestino,
    Boolean(input.aplicaArticulo69)
  );

  const horasPedagogicasMaximasDestino =
    jornadaDestino.horasPedagogicasDisponiblesMax;
  const minutosLectivosMaximosDestino =
    jornadaDestino.minutosLectivosDisponiblesMax;
  const minutosRecreoDestino = jornadaDestino.minutosRecreoAsignados;
  const minutosNoLectivosDestino = jornadaDestino.minutosNoLectivosCalculados;

  const excedeTopeArt69 =
    Boolean(input.aplicaArticulo69) &&
    (haSolicitadas > 32 ||
      jornadaDestino.minutosLectivosAsignados > MAX_MINUTOS_LECTIVOS_ART_69);

  if (excedeTopeArt69) {
    const msg = `Incumplimiento Artículo 69 DFL 1/1996: ${haSolicitadas} HA (${jornadaDestino.minutosLectivosAsignados} min lectivos) supera máximo legal de 32 HA (${MAX_MINUTOS_LECTIVOS_ART_69} min lectivos).`;
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  } else if (jornadaDestino.esSobreasignado) {
    const msg = `Sobreasignación Ley 20.903 en destino (régimen ${regimenDestino}): ${haSolicitadas} HA (${jornadaDestino.minutosLectivosAsignados} min) excede máximo ${horasPedagogicasMaximasDestino} HA (${minutosLectivosMaximosDestino} min).`;
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  }

  // Validación Art. 42 Estatuto Docente: No Menoscabo Titular
  const calidadUpper = (input.calidadJuridica || '').trim().toUpperCase();
  const esTitular =
    calidadUpper === 'TITULAR' || input.carril === 'NO_CONTINUIDAD_TITULAR';
  const esTrasladoCompletoEfectivo =
    input.esTrasladoCompleto === true ||
    (input.esTrasladoCompleto === undefined &&
      (input.horasConservadasEnOrigen || 0) === 0 &&
      (input.horasOtrosEstablecimientos || 0) === 0 &&
      input.carril !== 'HORAS_REMANENTES');

  let alertaMenoscaboArt42 = false;
  let deficitMinutosTitulares = 0;

  if (esTitular && esTrasladoCompletoEfectivo) {
    const minutosTitularesPrev = Math.round(
      Math.max(0, input.horasTitularesActuales ?? horasContratoSeguras) * 60
    );
    const minutosTitularesPost =
      input.fuenteDestino === 'SUBVENCION_GENERAL' || esTitular
        ? minutosVacante
        : 0;

    if (minutosTitularesPost < minutosTitularesPrev) {
      alertaMenoscaboArt42 = true;
      deficitMinutosTitulares = minutosTitularesPrev - minutosTitularesPost;
      const msg = `Menoscabo Art. 42 Estatuto Docente: vacante de ${horasVacanteSeguras}h (${minutosTitularesPost} min) es inferior a las horas titulares previas (${minutosTitularesPrev} min), con déficit de ${deficitMinutosTitulares} min.`;
      alertasNormativas.push(msg);
      motivosBloqueo.push(msg);
    }
  }

  // Validación Financiamiento SEP / PIE (alerta financiera/contractual, no bloquea simulación)
  const vieneDeSubvGeneral =
    input.fuenteOrigen === 'SUBVENCION_GENERAL' || input.fuenteOrigen === 'MIXTO';
  const destinoEsSepOPie =
    input.fuenteDestino === 'SEP' || input.fuenteDestino === 'PIE';
  const alertaFinanciamientoSepPie =
    esTitular && vieneDeSubvGeneral && destinoEsSepOPie;

  if (alertaFinanciamientoSepPie) {
    alertasNormativas.push(
      `Alerta de financiamiento (${input.fuenteDestino}): docente titular proviene de Subvención General; reubicación en cupo ${input.fuenteDestino} requiere resguardo contractual e imputación presupuestaria válida.`
    );
  }

  // Validación Egreso Condicional
  let bloqueadoPorEgreso = false;
  const tipoCoberturaEfectivo: TipoCoberturaCalce =
    input.tipoCobertura ??
    (calidadUpper === 'TITULAR' ? 'DEFINITIVA' : 'TRANSITORIA_CONDICIONAL');

  if (input.egresoAsociado) {
    const validacionEgreso = validarConsolidacionSobreEgreso(
      input.egresoAsociado,
      input.calidadJuridica,
      tipoCoberturaEfectivo
    );
    for (const alerta of validacionEgreso.alertas) {
      if (!alertasNormativas.includes(alerta)) {
        alertasNormativas.push(alerta);
      }
    }
    if (!validacionEgreso.permitido) {
      bloqueadoPorEgreso = true;
      if (validacionEgreso.motivoBloqueo) {
        motivosBloqueo.push(validacionEgreso.motivoBloqueo);
      }
    }
  } else if (input.esVacanteCondicional) {
    if (tipoCoberturaEfectivo === 'DEFINITIVA' || calidadUpper === 'TITULAR') {
      bloqueadoPorEgreso = true;
      const msg =
        'Vacante Condicional: se bloquea consolidación definitiva e ingreso de docente TITULAR hasta contar con decreto y fecha de cese confirmados (riesgo de doble titularidad y doble conteo PAL 2027 / GDP).';
      alertasNormativas.push(msg);
      motivosBloqueo.push(msg);
    } else {
      alertasNormativas.push(
        'Cobertura transitoria condicionada pendiente de decreto definitivo de egreso.'
      );
    }
  }

  const bloqueaConsolidacion =
    excedeTope44h ||
    excedeTopeArt69 ||
    jornadaDestino.esSobreasignado ||
    alertaMenoscaboArt42 ||
    bloqueadoPorEgreso;

  // Compatibilidad de especialidad y proximidad territorial
  const especialDocente = input.tituloMencion || input.asignaturaDocente;
  const compatibilidadEspecialidad = evaluarCompatibilidadEspecialidad(
    especialDocente,
    input.asignaturaVacante
  );
  if (!compatibilidadEspecialidad.coincide) {
    alertasNormativas.push(compatibilidadEspecialidad.motivo);
  }

  const { distanciaKm, puntajeProximidad } = calcularPuntajeProximidadComuna(
    input.comunaOrigen,
    input.comunaDestino
  );

  // Cálculo del Índice de Compatibilidad (0..100)
  // Idoneidad (35%), Ajuste horario <= 2640 min (25%), Cumplimiento normativo (20%), Financiamiento (10%), Proximidad (10%)
  const puntajeIdoneidad = compatibilidadEspecialidad.puntaje;

  let puntajeAjusteHorario = 100;
  if (excedeTope44h || minutosVacante <= 0) {
    puntajeAjusteHorario = 0;
  } else if (
    esTrasladoCompletoEfectivo &&
    horasContratoSeguras > 0 &&
    minutosVacante < Math.round(horasContratoSeguras * 60)
  ) {
    puntajeAjusteHorario = Math.max(
      20,
      Math.round((minutosVacante / Math.round(horasContratoSeguras * 60)) * 100)
    );
  }

  let puntajeNormativo = 100;
  if (alertaMenoscaboArt42) puntajeNormativo -= 80;
  if (excedeTopeArt69 || jornadaDestino.esSobreasignado) puntajeNormativo -= 70;
  if (bloqueadoPorEgreso) puntajeNormativo -= 50;
  puntajeNormativo = Math.max(0, puntajeNormativo);

  let puntajeFinanciamiento = 100;
  if (alertaFinanciamientoSepPie) {
    puntajeFinanciamiento = 30;
  } else if (
    input.fuenteOrigen &&
    input.fuenteOrigen !== 'MIXTO' &&
    input.fuenteOrigen !== input.fuenteDestino
  ) {
    puntajeFinanciamiento = 75;
  }

  let indiceCompatibilidad = Math.round(
    puntajeIdoneidad * 0.35 +
      puntajeAjusteHorario * 0.25 +
      puntajeNormativo * 0.2 +
      puntajeFinanciamiento * 0.1 +
      puntajeProximidad * 0.1
  );

  if (excedeTope44h || bloqueaConsolidacion) {
    indiceCompatibilidad = Math.min(indiceCompatibilidad, 45);
  }
  indiceCompatibilidad = clamp0_100(indiceCompatibilidad);

  return {
    docenteId: input.docenteId,
    vacanteId: input.vacanteId,
    rbdDestino: input.rbdDestino,
    minutosOtros,
    minutosConservadosOrigen,
    minutosVacante,
    minutosTotalesMultiEscuela,
    excedeTope44h,
    regimenDestino,
    horasPedagogicasMaximasDestino,
    minutosLectivosMaximosDestino,
    minutosRecreoDestino,
    minutosNoLectivosDestino,
    excedeTopeArt69,
    esSobreasignadoDestino: jornadaDestino.esSobreasignado,
    alertaMenoscaboArt42,
    deficitMinutosTitulares,
    alertaFinanciamientoSepPie,
    bloqueaConsolidacion,
    motivoBloqueo:
      motivosBloqueo.length > 0 ? motivosBloqueo.join(' | ') : undefined,
    puntajeIdoneidad,
    coincideEspecialidad: compatibilidadEspecialidad.coincide,
    distanciaKm,
    puntajeProximidad,
    indiceCompatibilidad,
    alertasNormativas,
  };
}

/**
 * Genera la vacante de rebote en el establecimiento de origen cuando un docente se traslada,
 * preservando horas de contrato en minutos enteros, horas pedagógicas de aula y funciones no lectivas.
 */
export function generarVacanteDeRebote(
  input: GeneracionReboteInput
): VacanteReboteOutput {
  const horasContratoRebote = Math.max(0, input.horasTrasladadas);
  const minutosContratoRebote = Math.round(horasContratoRebote * 60);
  const asignacionesHeredadas = (input.asignacionesOrigen ?? []).map((item) => ({
    ...item,
  }));
  const funcionesNoLectivasHeredadas = (input.funcionesNoAulaOrigen ?? []).map(
    (item) => ({ ...item })
  );

  const horasPedagogicasAula = asignacionesHeredadas.reduce(
    (acc, item) => acc + Math.max(0, item.horasPedagogicas || 0),
    0
  );
  const minutosLectivosAulaRebote = Math.round(horasPedagogicasAula * 45);

  const minutosEsperadosOrigen = Math.round(
    Math.max(0, input.horasTrasladadas) * 60
  );
  const deltaMinutosCadena = minutosContratoRebote - minutosEsperadosOrigen;

  return {
    rbdOrigen: input.rbdOrigen,
    nombreEstablecimientoOrigen: input.nombreEstablecimientoOrigen,
    asignaturaPrincipal: input.asignaturaPrincipal,
    fuenteFinanciamiento: input.fuenteFinanciamiento,
    horasContratoRebote,
    minutosContratoRebote,
    horasPedagogicasAula,
    minutosLectivosAulaRebote,
    asignacionesHeredadas,
    funcionesNoLectivasHeredadas,
    deltaMinutosCadena,
    cadenaBalanceada: deltaMinutosCadena === 0,
  };
}

/**
 * Ordena candidatos según prioridad normativa de carril y compatibilidad,
 * retornando únicamente aquellos cuyo índice >= umbralMinimo y sin exceder 2640 min (44h).
 */
export function sugerirCalcesAutomaticos(
  candidatos: DocenteCandidatoCalce[],
  vacante: VacanteObjetivoCalce,
  umbralMinimo: number = 55,
  maxResultados: number = 10
): SugerenciaCalce[] {
  const sugerencias: SugerenciaCalce[] = [];

  for (const candidato of candidatos) {
    const evaluacion = evaluarCalceDocenteVacante({
      ...candidato,
      ...vacante,
    });

    if (evaluacion.excedeTope44h || evaluacion.minutosTotalesMultiEscuela > TOPE_MINUTOS_SEMANALES_SLEP) {
      continue;
    }

    if (evaluacion.indiceCompatibilidad < umbralMinimo) {
      continue;
    }

    const carrilEfectivo: CarrilMovilidad =
      candidato.prioridadMovilidad?.carril ??
      candidato.carril ??
      'TRASLADO_VOLUNTARIO';

    const puntajePrioridad = calcularPuntajePrioridadMovilidad(
      candidato.prioridadMovilidad ?? {
        carril: carrilEfectivo,
        horasRemanentes:
          carrilEfectivo === 'HORAS_REMANENTES'
            ? Math.max(0, 44 - candidato.horasContratoActual)
            : undefined,
      }
    );

    sugerencias.push({
      candidato,
      puntajePrioridad,
      evaluacion,
    });
  }

  sugerencias.sort((a, b) => {
    if (b.puntajePrioridad !== a.puntajePrioridad) {
      return b.puntajePrioridad - a.puntajePrioridad;
    }
    return b.evaluacion.indiceCompatibilidad - a.evaluacion.indiceCompatibilidad;
  });

  return sugerencias.slice(0, Math.max(0, maxResultados));
}
