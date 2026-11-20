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

export type AccesibilidadEstablecimiento =
  | 'urbano'
  | 'rural_conectado'
  | 'rural_aislado';

export type TramoCarreraDocente =
  | 'INICIAL'
  | 'TEMPRANO'
  | 'AVANZADO'
  | 'EXPERTO_I'
  | 'EXPERTO_II'
  | 'ACCESO'
  | 'SIN_TRAMO';

export type EstamentoAsistenteMotor =
  | 'PROFESIONAL'
  | 'TECNICO'
  | 'ADMINISTRATIVO'
  | 'AUXILIAR'
  | 'PARADOCENTE_INSPECTORIA';

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
  tituloMencionOficial?: string;
  requiereAutorizacionDocente?: boolean;
  habilitacionSeremiRbd?: string;
  habilitacionSeremiAsignatura?: string;
  aplicaArticulo69?: boolean;
  horasContratoActual: number;
  horasTitularesActuales?: number;
  minutosTitularesOrigen?: number;
  minutosContrataOrigen?: number;
  minutosAdicionalesEscenario?: number;
  horasOtrosEstablecimientos?: number;
  horasConservadasEnOrigen?: number;
  fuenteOrigen?: FuenteFinanciamientoCalce;
  rbdOrigen?: string;
  porcentajePrioritariosOrigen?: number;
  tramoCarreraDocente?: TramoCarreraDocente;
  condicionesDificilesOrigenPct?: number;
  accesibilidadOrigen?: AccesibilidadEstablecimiento;
  comunaOrigen?: string;
  carril?: CarrilMovilidad;
  esTrasladoCompleto?: boolean;
  bloqueaPorItineranciaRuralOpcional?: boolean;

  vacanteId: string;
  rbdDestino: string;
  horasVacante: number;
  horasPedagogicasVacante?: number;
  asignaturaVacante?: string;
  fuenteDestino: FuenteDestinoVacante;
  porcentajePrioritariosDestino: number;
  condicionesDificilesDestinoPct?: number;
  accesibilidadDestino?: AccesibilidadEstablecimiento;
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
  minutosTitularesOrigen: number;
  minutosContrataOrigen: number;
  minutosAdicionalesEscenario: number;
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
  alertaMenoscaboEconomicoArt50: boolean;
  alertaCondicionesDificiles: boolean;
  requiereValidacionJuridicaMenoscabo: boolean;
  alertaHabilitacionSeremiDto352: boolean;
  requiereHomologacionTpHumana: boolean;
  alertaItineranciaRural: boolean;
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
  funcionesIntransferiblesDetectadas: string[];
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
  condicionesDificilesDestinoPct?: number;
  accesibilidadDestino?: AccesibilidadEstablecimiento;
  nivelCicloDestino?: string;
  comunaDestino?: string;
  esVacanteCondicional?: boolean;
  egresoAsociado?: EgresoProyectadoInput;
  tipoCobertura?: TipoCoberturaCalce;
}

export interface DocenteCandidatoCalce
  extends Omit<EvaluacionCalceInput, keyof VacanteObjetivoCalce> {
  prioridadMovilidad?: PrioridadMovilidadInput;
  rbdDestinoPreferente?: string;
  comunaDestinoPreferente?: string;
}

export interface SugerenciaCalce {
  candidato: DocenteCandidatoCalce;
  puntajePrioridad: number;
  evaluacion: ResultadoEvaluacionCalce;
}

export interface EvaluacionCalceAsistenteInput {
  asistenteId: string;
  calidadJuridica: string;
  estamentoOrigen: EstamentoAsistenteMotor;
  cargoFuncionOrigen?: string;
  horasContratoActual: number;
  horasIndefinidasActuales?: number;
  minutosIndefinidosOrigen?: number;
  minutosPlazoFijoOrigen?: number;
  minutosAdicionalesEscenario?: number;
  horasOtrosEstablecimientos?: number;
  horasConservadasEnOrigen?: number;
  fuenteOrigen?: FuenteFinanciamientoCalce;
  rbdOrigen?: string;
  accesibilidadOrigen?: AccesibilidadEstablecimiento;
  comunaOrigen?: string;
  carril?: 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO' | 'TRASLADO_VOLUNTARIO' | 'HORAS_REMANENTES';
  esTrasladoCompleto?: boolean;
  topeHorasSemanales?: 44 | 45;
  bloqueaPorItineranciaRuralOpcional?: boolean;

  vacanteId: string;
  rbdDestino: string;
  estamentoVacante: EstamentoAsistenteMotor;
  cargoFuncionVacante?: string;
  horasVacante: number;
  fuenteDestino: FuenteDestinoVacante;
  accesibilidadDestino?: AccesibilidadEstablecimiento;
  comunaDestino?: string;
  esVacanteCondicional?: boolean;
  egresoAsociado?: EgresoProyectadoInput;
  tipoCobertura?: TipoCoberturaCalce;
}

export interface ResultadoEvaluacionCalceAsistente {
  asistenteId: string;
  vacanteId: string;
  rbdDestino: string;
  topeMinutosSemanal: number;
  minutosIndefinidosOrigen: number;
  minutosPlazoFijoOrigen: number;
  minutosAdicionalesEscenario: number;
  minutosOtros: number;
  minutosConservadosOrigen: number;
  minutosVacante: number;
  minutosTotalesMultiEscuela: number;
  excedeTopeSemanal: boolean;
  alertaMenoscaboIndefinido: boolean;
  deficitMinutosIndefinidos: number;
  estamentoCompatible: boolean;
  degradacionEstamento: boolean;
  alertaItineranciaRural: boolean;
  bloqueaConsolidacion: boolean;
  motivoBloqueo?: string;
  puntajeEstamento: number;
  distanciaKm: number;
  puntajeProximidad: number;
  indiceCompatibilidad: number;
  alertasNormativas: string[];
}

export interface AsignacionOptimaBipartita {
  candidato: DocenteCandidatoCalce;
  vacante: VacanteObjetivoCalce;
  evaluacion: ResultadoEvaluacionCalce;
  puntajePrioridad: number;
  pesoOptimo: number;
  esSegundaPasadaRebote?: boolean;
}

export interface ResultadoCalceOptimoCadenasRebote {
  asignacionesPasada1: AsignacionOptimaBipartita[];
  asignacionesPasada2Rebotes: AsignacionOptimaBipartita[];
  rebotesGeneradosIds: string[];
  rebotesCubiertosEnCadena: number;
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

export type FamiliaCurricular =
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
  | 'TP_GASTRONOMIA'
  | 'TP_MECANICA_AUTOMOTRIZ'
  | 'TP_MECANICA_INDUSTRIAL'
  | 'TP_ELECTRICIDAD'
  | 'TP_ELECTRONICA'
  | 'TP_ADMINISTRACION'
  | 'TP_CONTABILIDAD'
  | 'TP_PROGRAMACION'
  | 'TP_CONECTIVIDAD_REDES'
  | 'TP_ENFERMERIA'
  | 'TP_ATENCION_PARVULOS'
  | 'TP_AGROPECUARIA'
  | 'TP_FORESTAL'
  | 'TP_CONSTRUCCION'
  | 'TP_CONSTRUCCIONES_METALICAS'
  | 'TP_TURISMO'
  | 'TP_GRAFICA_VESTUARIO'
  | 'TP_ACUICULTURA_MARITIMA'
  | 'TP_MINERIA'
  | 'TP_GENERICO_SIN_ESPECIALIDAD';

function esFamiliaTp(familia: FamiliaCurricular | null): boolean {
  return familia !== null && familia.startsWith('TP_');
}

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

function clasificarFamiliaTpEspecifica(textoNorm: string): FamiliaCurricular | null {
  if (
    !textoNorm.includes('EDUCADORA') &&
    (textoNorm.includes('ATENCION DE PARVUL') ||
      textoNorm.includes('ATENCION PARVUL') ||
      textoNorm.includes('TECNICO EN PARVUL') ||
      textoNorm.includes('TECNICO DE PARVUL') ||
      textoNorm.includes('TECNICO PARVUL') ||
      textoNorm.includes('AUXILIAR DE PARVUL') ||
      /\bTP\b.*\bPARVUL/.test(textoNorm) ||
      /\bPARVUL.*\bTP\b/.test(textoNorm))
  ) {
    return 'TP_ATENCION_PARVULOS';
  }
  if (
    textoNorm.includes('GASTRONOMIA') ||
    textoNorm.includes('COCINA') ||
    textoNorm.includes('ALIMENTACION COLECTIVA') ||
    textoNorm.includes('PANADERIA') ||
    textoNorm.includes('PASTELERIA') ||
    textoNorm.includes('REPOSTERIA') ||
    textoNorm.includes('ARTE CULINARIO') ||
    textoNorm.includes('SERVICIOS DE ALIMENTACION')
  ) {
    return 'TP_GASTRONOMIA';
  }
  if (
    textoNorm.includes('AUTOMOTRIZ') ||
    textoNorm.includes('AUTOTRONICA')
  ) {
    return 'TP_MECANICA_AUTOMOTRIZ';
  }
  if (
    textoNorm.includes('MECANICA INDUSTRIAL') ||
    textoNorm.includes('ELECTROMECANICA') ||
    textoNorm.includes('MANTENIMIENTO INDUSTRIAL') ||
    textoNorm.includes('MAQUINAS HERRAMIENTAS') ||
    textoNorm.includes('MATRICERIA') ||
    textoNorm.includes('MECATRONICA') ||
    (/\bMECANIC[AO]\b/.test(textoNorm) && !textoNorm.includes('FISICA'))
  ) {
    return 'TP_MECANICA_INDUSTRIAL';
  }
  if (
    textoNorm.includes('CONECTIVIDAD') ||
    /\bREDES\b/.test(textoNorm) ||
    textoNorm.includes('TELECOMUNICACIONES')
  ) {
    return 'TP_CONECTIVIDAD_REDES';
  }
  if (
    textoNorm.includes('PROGRAMACION') ||
    textoNorm.includes('DESARROLLO DE SOFTWARE') ||
    textoNorm.includes('ANALISIS DE SISTEMAS') ||
    textoNorm.includes('SOPORTE INFORMATICO') ||
    textoNorm.includes('TECNICO EN INFORMATICA') ||
    textoNorm.includes('TECNICO INFORMATICA') ||
    textoNorm.includes('TP INFORMATICA') ||
    textoNorm.includes('COMPUTACION E INFORMATICA') ||
    (textoNorm.includes('INFORMATICA') && !textoNorm.includes('EDUCACION TECNOLOGICA'))
  ) {
    return 'TP_PROGRAMACION';
  }
  if (
    textoNorm.includes('ELECTRONICA') ||
    textoNorm.includes('ELECTRONICO') ||
    textoNorm.includes('AUTOMATIZACION INDUSTRIAL') ||
    textoNorm.includes('INSTRUMENTACION')
  ) {
    return 'TP_ELECTRONICA';
  }
  if (
    textoNorm.includes('ELECTRICIDAD') ||
    textoNorm.includes('INSTALACIONES ELECTRICAS') ||
    textoNorm.includes('ELECTRICISTA') ||
    /\bELECTRIC[AO]\b/.test(textoNorm)
  ) {
    return 'TP_ELECTRICIDAD';
  }
  if (textoNorm.includes('ADMINISTRACION')) {
    return 'TP_ADMINISTRACION';
  }
  if (
    textoNorm.includes('CONTABILIDAD') ||
    textoNorm.includes('CONTABLE') ||
    textoNorm.includes('TRIBUTARIA') ||
    textoNorm.includes('AUDITORIA')
  ) {
    return 'TP_CONTABILIDAD';
  }
  if (
    textoNorm.includes('ENFERMERIA') ||
    /\bTENS\b/.test(textoNorm)
  ) {
    return 'TP_ENFERMERIA';
  }
  if (
    textoNorm.includes('AGROPECUARI') ||
    textoNorm.includes('AGRICULTURA') ||
    textoNorm.includes('AGRICOLA') ||
    textoNorm.includes('PECUARIA') ||
    textoNorm.includes('VITIVINICULTURA') ||
    textoNorm.includes('FRUTICULTURA') ||
    textoNorm.includes('HORTICULTURA')
  ) {
    return 'TP_AGROPECUARIA';
  }
  if (
    textoNorm.includes('FORESTAL') ||
    textoNorm.includes('SILVICULTURA') ||
    textoNorm.includes('MADERERA')
  ) {
    return 'TP_FORESTAL';
  }
  if (
    textoNorm.includes('CONSTRUCCIONES METALICAS') ||
    textoNorm.includes('CONSTRUCCION METALICA') ||
    textoNorm.includes('ESTRUCTURAS METALICAS') ||
    textoNorm.includes('METALURGIA') ||
    textoNorm.includes('SOLDADURA') ||
    textoNorm.includes('CALDERERIA')
  ) {
    return 'TP_CONSTRUCCIONES_METALICAS';
  }
  if (
    textoNorm.includes('CONSTRUCCION') ||
    textoNorm.includes('EDIFICACION') ||
    textoNorm.includes('OBRAS CIVILES') ||
    textoNorm.includes('INSTALACIONES SANITARIAS') ||
    textoNorm.includes('CLIMATIZACION') ||
    textoNorm.includes('REFRIGERACION')
  ) {
    return 'TP_CONSTRUCCION';
  }
  if (
    textoNorm.includes('TURISMO') ||
    textoNorm.includes('HOTELERIA')
  ) {
    return 'TP_TURISMO';
  }
  if (
    textoNorm.includes('GRAFICA') ||
    textoNorm.includes('DISENO GRAFICO') ||
    textoNorm.includes('IMPRENTA') ||
    textoNorm.includes('VESTUARIO') ||
    textoNorm.includes('CONFECCION') ||
    textoNorm.includes('TEXTIL')
  ) {
    return 'TP_GRAFICA_VESTUARIO';
  }
  if (
    textoNorm.includes('ACUICULTURA') ||
    textoNorm.includes('PESQUERA') ||
    textoNorm.includes('PORTUARIAS') ||
    textoNorm.includes('MARITIMA') ||
    textoNorm.includes('TRIPULACION DE NAVES') ||
    textoNorm.includes('NAVEGACION')
  ) {
    return 'TP_ACUICULTURA_MARITIMA';
  }
  if (
    textoNorm.includes('MINERIA') ||
    textoNorm.includes('MINERO') ||
    textoNorm.includes('EXPLOTACION MINERA') ||
    textoNorm.includes('METALURGICA EXTRACTIVA') ||
    textoNorm.includes('GEOLOGIA MINERA')
  ) {
    return 'TP_MINERIA';
  }
  return null;
}

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

  // Detectar especialidades TP MINEDUC diferenciadas antes de TECNOLOGIA / CIENCIAS / PARVULARIA
  const famTp = clasificarFamiliaTpEspecifica(textoNorm);
  if (famTp) {
    return famTp;
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
    (textoNorm.includes('FISICA') && !textoNorm.includes('EDUCACION FISICA')) ||
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
    textoNorm.includes('TECNOLOGIC') ||
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
  if (
    textoNorm.includes('TECNICO PROFESIONAL') ||
    /\bTP\b/.test(textoNorm) ||
    /\bEMTP\b/.test(textoNorm)
  ) {
    return 'TP_GENERICO_SIN_ESPECIALIDAD';
  }

  return null;
}

function normalizarSingularBasico(textoNorm: string): string {
  return textoNorm.replace(/MATEMATICAS/g, 'MATEMATICA');
}

/**
 * Evalúa compatibilidad curricular entre la mención/asignatura del docente y la especialidad de la vacante.
 * Retorna puntajes: exacta (100), misma especialidad TP afín (90), familia curricular (75),
 * generalista (55), TP genérica (25), discrepancia HC (15), especialidades TP distintas (10).
 */
export function evaluarCompatibilidadEspecialidad(
  mencionODocente?: string,
  especialidadVacante?: string
): { puntaje: number; coincide: boolean; motivo: string; requiereHomologacionTp?: boolean } {
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

  const famDoc = clasificarFamiliaCurricular(docNorm);
  const famVac = clasificarFamiliaCurricular(vacNorm);

  if (
    famDoc === 'TP_GENERICO_SIN_ESPECIALIDAD' &&
    famVac === 'TP_GENERICO_SIN_ESPECIALIDAD'
  ) {
    return {
      puntaje: 25,
      coincide: false,
      requiereHomologacionTp: true,
      motivo: 'Mención TP genérica requiere confirmación humana de homologación curricular.',
    };
  }

  if (docNorm === vacNorm) {
    return {
      puntaje: 100,
      coincide: true,
      motivo: `Coincidencia exacta de especialidad (${especialidadVacante})`,
    };
  }

  if (
    (docNorm.includes(vacNorm) || vacNorm.includes(docNorm)) &&
    Math.min(docNorm.length, vacNorm.length) >= 5 &&
    famDoc === famVac &&
    famDoc !== null &&
    famDoc !== 'TP_GENERICO_SIN_ESPECIALIDAD'
  ) {
    return {
      puntaje: 100,
      coincide: true,
      motivo: `Coincidencia directa de especialidad (${especialidadVacante})`,
    };
  }

  if (
    (famDoc === 'TP_GENERICO_SIN_ESPECIALIDAD' && esFamiliaTp(famVac)) ||
    (famVac === 'TP_GENERICO_SIN_ESPECIALIDAD' && esFamiliaTp(famDoc))
  ) {
    return {
      puntaje: 25,
      coincide: false,
      requiereHomologacionTp: true,
      motivo: 'Mención TP genérica requiere confirmación humana de homologación curricular.',
    };
  }

  if (esFamiliaTp(famDoc) && esFamiliaTp(famVac)) {
    if (famDoc === famVac) {
      return {
        puntaje: 90,
        coincide: true,
        motivo: `Coincidencia directa de especialidad TP (${famVac})`,
      };
    }
    return {
      puntaje: 10,
      coincide: false,
      requiereHomologacionTp: true,
      motivo: `Especialidades TP incompatibles (${famDoc} vs ${famVac}): sectores económicos MINEDUC distintos.`,
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

function nivelVulnerabilidadArt50(porcentajePrioritarios: number): 0 | 1 | 2 {
  if (porcentajePrioritarios >= 80) return 2;
  if (porcentajePrioritarios >= 60) return 1;
  return 0;
}

const TRAMOS_MENOSCABO_ART_50 = new Set<TramoCarreraDocente>([
  'AVANZADO',
  'EXPERTO_I',
  'EXPERTO_II',
]);

const TIPOS_FUNCION_INTRANSFERIBLE = new Set<string>([
  'DIRECTIVA',
  'INSPECTORIA',
  'UTP',
  'CONVIVENCIA',
]);

const JERARQUIA_ESTAMENTO_ASISTENTE: Record<EstamentoAsistenteMotor, number> = {
  PROFESIONAL: 4,
  TECNICO: 3,
  ADMINISTRATIVO: 2,
  PARADOCENTE_INSPECTORIA: 2,
  AUXILIAR: 1,
};

/**
 * Evalúa el calce normativo, horario (en minutos enteros), jurídico (Art. 42, Art. 50, Art. 69,
 * Dto. 352, egresos en trámite), financiero (SEP/PIE) y territorial de un docente sobre una vacante.
 */
export function evaluarCalceDocenteVacante(
  input: EvaluacionCalceInput
): ResultadoEvaluacionCalce {
  const alertasNormativas: string[] = [];
  const motivosBloqueo: string[] = [];

  const horasVacanteSeguras = Math.max(0, input.horasVacante);
  const horasContratoSeguras = Math.max(0, input.horasContratoActual);
  const minutosContratoTotalOrigen = Math.round(horasContratoSeguras * 60);

  const calidadUpper = (input.calidadJuridica || '').trim().toUpperCase();
  const minutosTitularesOrigen =
    input.minutosTitularesOrigen !== undefined
      ? Math.max(0, Math.round(input.minutosTitularesOrigen))
      : input.horasTitularesActuales !== undefined
        ? Math.round(Math.max(0, input.horasTitularesActuales) * 60)
        : calidadUpper === 'TITULAR'
          ? minutosContratoTotalOrigen
          : 0;
  const minutosContrataOrigen =
    input.minutosContrataOrigen !== undefined
      ? Math.max(0, Math.round(input.minutosContrataOrigen))
      : Math.max(0, minutosContratoTotalOrigen - minutosTitularesOrigen);
  const minutosAdicionalesEscenario = Math.max(
    0,
    Math.round(input.minutosAdicionalesEscenario ?? 0)
  );

  const minutosOtros = Math.round(Math.max(0, input.horasOtrosEstablecimientos || 0) * 60);
  const minutosConservadosOrigen = input.esTrasladoCompleto
    ? 0
    : Math.round(Math.max(0, input.horasConservadasEnOrigen || 0) * 60);
  const minutosVacante = Math.round(horasVacanteSeguras * 60);
  const minutosTotalesMultiEscuela =
    minutosOtros +
    minutosConservadosOrigen +
    minutosVacante +
    minutosAdicionalesEscenario;

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

  // Validación Art. 42 Estatuto Docente: protege exclusivamente minutosTitularesOrigen
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

  if (esTrasladoCompletoEfectivo) {
    if (
      (esTitular || minutosTitularesOrigen > 0) &&
      minutosTitularesOrigen > 0 &&
      minutosVacante < minutosTitularesOrigen
    ) {
      alertaMenoscaboArt42 = true;
      deficitMinutosTitulares = minutosTitularesOrigen - minutosVacante;
      const msg = `Menoscabo Art. 42 Estatuto Docente: vacante de ${horasVacanteSeguras}h (${minutosVacante} min) es inferior a las horas titulares previas (${minutosTitularesOrigen} min), con déficit de ${deficitMinutosTitulares} min.`;
      alertasNormativas.push(msg);
      motivosBloqueo.push(msg);
    } else if (
      minutosVacante >= minutosTitularesOrigen &&
      minutosContrataOrigen > 0 &&
      minutosVacante < minutosTitularesOrigen + minutosContrataOrigen
    ) {
      const minutosContrataExpiran = Math.min(
        minutosContrataOrigen,
        minutosTitularesOrigen + minutosContrataOrigen - minutosVacante
      );
      alertasNormativas.push(
        `Nota informativa Art. 42: las horas a contrata/extensión (${minutosContrataExpiran} min) vencen legalmente el 28 de febrero sin constituir menoscabo Art. 42 sobre las horas titulares (${minutosTitularesOrigen} min).`
      );
    }
  }

  // Regla Art. 50 Ley 20.903: Menoscabo económico por Alta Concentración de Prioritarios
  let alertaMenoscaboEconomicoArt50 = false;
  if (input.porcentajePrioritariosOrigen !== undefined) {
    const nivelOrig = nivelVulnerabilidadArt50(input.porcentajePrioritariosOrigen);
    const nivelDest = nivelVulnerabilidadArt50(input.porcentajePrioritariosDestino);
    if (nivelDest < nivelOrig) {
      if (
        input.tramoCarreraDocente &&
        TRAMOS_MENOSCABO_ART_50.has(input.tramoCarreraDocente)
      ) {
        alertaMenoscaboEconomicoArt50 = true;
        alertasNormativas.push(
          `Alerta jurídica Art. 50 Ley 20.903 / Art. 42 DFL 1: docente tramo ${input.tramoCarreraDocente} desciende de concentración de alumnos prioritarios (${input.porcentajePrioritariosOrigen}% → ${input.porcentajePrioritariosDestino}%), con posible pérdida de asignación imponible en destinación no voluntaria.`
        );
      } else if (!input.tramoCarreraDocente && input.porcentajePrioritariosOrigen >= 60) {
        alertasNormativas.push(
          `Alerta preventiva Art. 50 Ley 20.903: descenso de tramo de prioritarios (${input.porcentajePrioritariosOrigen}% → ${input.porcentajePrioritariosDestino}%); verificar tramo CPEIP del docente para descartar menoscabo económico.`
        );
      }
    }
  }

  // Regla Condiciones Difíciles
  const condDifOrig = Math.max(0, input.condicionesDificilesOrigenPct ?? 0);
  const condDifDest = Math.max(0, input.condicionesDificilesDestinoPct ?? 0);
  const alertaCondicionesDificiles = condDifOrig > condDifDest;
  if (alertaCondicionesDificiles) {
    alertasNormativas.push(
      `Alerta jurídica Condiciones Difíciles: pérdida o reducción de Asignación de Desempeño en Condiciones Difíciles (${condDifOrig}% en origen → ${condDifDest}% en destino).`
    );
  }

  const requiereValidacionJuridicaMenoscabo =
    alertaMenoscaboEconomicoArt50 || alertaCondicionesDificiles;

  // Validación Financiamiento SEP / PIE (alerta financiera/contractual, no bloquea simulación)
  const vieneDeSubvGeneral =
    input.fuenteOrigen === 'SUBVENCION_GENERAL' || input.fuenteOrigen === 'MIXTO';
  const destinoEsSepOPie =
    input.fuenteDestino === 'SEP' || input.fuenteDestino === 'PIE';
  const alertaFinanciamientoSepPie =
    (esTitular || minutosTitularesOrigen > 0) && vieneDeSubvGeneral && destinoEsSepOPie;

  if (alertaFinanciamientoSepPie) {
    alertasNormativas.push(
      `Alerta de financiamiento (${input.fuenteDestino}): docente titular proviene de Subvención General; reubicación en cupo ${input.fuenteDestino} requiere resguardo contractual e imputación presupuestaria válida.`
    );
  }

  // Validación Egreso Condicional
  let bloqueadoPorEgreso = false;
  const tipoCoberturaEfectivo: TipoCoberturaCalce =
    input.tipoCobertura ??
    (calidadUpper === 'TITULAR' || minutosTitularesOrigen > 0
      ? 'DEFINITIVA'
      : 'TRANSITORIA_CONDICIONAL');

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

  // Regla Habilitación SEREMI (Decreto N° 352/2003)
  let alertaHabilitacionSeremiDto352 = false;
  const enOtroRbd = Boolean(input.rbdOrigen && input.rbdOrigen !== input.rbdDestino);
  const requiereChequeoSeremiDto352 =
    enOtroRbd &&
    (input.requiereAutorizacionDocente === true ||
      (Boolean(input.habilitacionSeremiRbd) &&
        input.habilitacionSeremiRbd !== input.rbdDestino));

  let puntajeIdoneidad: number;
  let coincideEspecialidad: boolean;
  let requiereHomologacionTpHumana: boolean;

  if (requiereChequeoSeremiDto352) {
    const mencionParaSeremi = input.tituloMencionOficial || input.tituloMencion;
    const compatSeremi = evaluarCompatibilidadEspecialidad(
      mencionParaSeremi,
      input.asignaturaVacante
    );
    puntajeIdoneidad = compatSeremi.puntaje;
    coincideEspecialidad = compatSeremi.coincide;
    requiereHomologacionTpHumana = Boolean(compatSeremi.requiereHomologacionTp);

    if (!input.tituloMencionOficial || !compatSeremi.coincide) {
      alertaHabilitacionSeremiDto352 = true;
      coincideEspecialidad = false;
      puntajeIdoneidad = Math.min(puntajeIdoneidad, 35);
      const asigRef = input.habilitacionSeremiAsignatura
        ? ` (habilitada en ${input.habilitacionSeremiAsignatura})`
        : '';
      alertasNormativas.push(
        `Alerta Habilitación SEREMI (Decreto N° 352/2003)${asigRef}: la autorización docente está atada al RBD de origen (${input.habilitacionSeremiRbd || input.rbdOrigen}) y no viaja automáticamente al RBD destino (${input.rbdDestino}); validar título/mención oficial o tramitar nueva resolución SEREMI.`
      );
    }
  } else {
    const especialDocente =
      input.tituloMencionOficial || input.tituloMencion || input.asignaturaDocente;
    const compatibilidadEspecialidad = evaluarCompatibilidadEspecialidad(
      especialDocente,
      input.asignaturaVacante
    );
    puntajeIdoneidad = compatibilidadEspecialidad.puntaje;
    coincideEspecialidad = compatibilidadEspecialidad.coincide;
    requiereHomologacionTpHumana = Boolean(
      compatibilidadEspecialidad.requiereHomologacionTp
    );
    if (!compatibilidadEspecialidad.coincide) {
      alertasNormativas.push(compatibilidadEspecialidad.motivo);
    }
  }

  // Proximidad territorial e Itinerancia Rural Real (accesibilidad)
  const proximidad = calcularPuntajeProximidadComuna(
    input.comunaOrigen,
    input.comunaDestino
  );
  const distanciaKm = proximidad.distanciaKm;
  let puntajeProximidad = proximidad.puntajeProximidad;

  const entreRbdsDistintos = !input.rbdOrigen || input.rbdOrigen !== input.rbdDestino;
  const hayContratoCompartido =
    entreRbdsDistintos &&
    (!esTrasladoCompletoEfectivo ||
      minutosOtros > 0 ||
      minutosConservadosOrigen > 0);
  const ambosRuralAislado =
    hayContratoCompartido &&
    input.accesibilidadOrigen === 'rural_aislado' &&
    input.accesibilidadDestino === 'rural_aislado';
  const algunoRuralAislado =
    hayContratoCompartido &&
    (input.accesibilidadOrigen === 'rural_aislado' ||
      input.accesibilidadDestino === 'rural_aislado');

  let alertaItineranciaRural = false;
  let bloqueadoPorItineranciaRural = false;

  if (ambosRuralAislado) {
    alertaItineranciaRural = true;
    bloqueadoPorItineranciaRural = true;
    puntajeProximidad = Math.min(puntajeProximidad, 30);
    const msg =
      'Itinerancia rural inviable: no se permite contrato compartido entre dos establecimientos rurales aislados (verificar traslado físico y bloques JEC).';
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  } else if (algunoRuralAislado) {
    alertaItineranciaRural = true;
    puntajeProximidad = Math.min(puntajeProximidad, 30);
    const msg =
      'Alerta itinerancia rural: contrato compartido involucra establecimiento rural aislado; verificar factibilidad de traslado físico y bloques JEC.';
    alertasNormativas.push(msg);
    if (input.bloqueaPorItineranciaRuralOpcional === true) {
      bloqueadoPorItineranciaRural = true;
      motivosBloqueo.push(msg);
    }
  }

  const bloqueaConsolidacion =
    excedeTope44h ||
    excedeTopeArt69 ||
    jornadaDestino.esSobreasignado ||
    alertaMenoscaboArt42 ||
    bloqueadoPorEgreso ||
    bloqueadoPorItineranciaRural;

  // Cálculo del Índice de Compatibilidad (0..100)
  // Idoneidad (35%), Ajuste horario <= 2640 min (25%), Cumplimiento normativo (20%), Financiamiento (10%), Proximidad (10%)
  let puntajeAjusteHorario = 100;
  if (excedeTope44h || minutosVacante <= 0) {
    puntajeAjusteHorario = 0;
  } else if (
    esTrasladoCompletoEfectivo &&
    horasContratoSeguras > 0 &&
    minutosVacante < minutosContratoTotalOrigen
  ) {
    puntajeAjusteHorario = Math.max(
      20,
      Math.round((minutosVacante / minutosContratoTotalOrigen) * 100)
    );
  }

  let puntajeNormativo = 100;
  if (alertaMenoscaboArt42) puntajeNormativo -= 80;
  if (excedeTopeArt69 || jornadaDestino.esSobreasignado) puntajeNormativo -= 70;
  if (bloqueadoPorEgreso) puntajeNormativo -= 50;
  if (bloqueadoPorItineranciaRural) puntajeNormativo -= 50;
  if (
    input.carril === 'NO_CONTINUIDAD_TITULAR' &&
    requiereValidacionJuridicaMenoscabo
  ) {
    puntajeNormativo -= 20;
  }
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
    minutosTitularesOrigen,
    minutosContrataOrigen,
    minutosAdicionalesEscenario,
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
    alertaMenoscaboEconomicoArt50,
    alertaCondicionesDificiles,
    requiereValidacionJuridicaMenoscabo,
    alertaHabilitacionSeremiDto352,
    requiereHomologacionTpHumana,
    alertaItineranciaRural,
    alertaFinanciamientoSepPie,
    bloqueaConsolidacion,
    motivoBloqueo:
      motivosBloqueo.length > 0 ? motivosBloqueo.join(' | ') : undefined,
    puntajeIdoneidad,
    coincideEspecialidad,
    distanciaKm,
    puntajeProximidad,
    indiceCompatibilidad,
    alertasNormativas,
  };
}

/**
 * Evalúa el calce normativo y territorial para Asistentes de la Educación bajo Ley N° 21.109
 * (sin proporciones 65/35 ni 60/40 ni Art. 69). Toda aritmética en minutos enteros.
 */
export function evaluarCalceAsistenteLey21109(
  input: EvaluacionCalceAsistenteInput
): ResultadoEvaluacionCalceAsistente {
  const alertasNormativas: string[] = [];
  const motivosBloqueo: string[] = [];

  const topeMin = input.topeHorasSemanales === 45 ? 2700 : 2640;
  const horasVacanteSeguras = Math.max(0, input.horasVacante);
  const horasContratoSeguras = Math.max(0, input.horasContratoActual);
  const minutosContratoTotalOrigen = Math.round(horasContratoSeguras * 60);

  const calidadUpper = (input.calidadJuridica || '').trim().toUpperCase();
  const esIndefinido =
    calidadUpper === 'INDEFINIDO' ||
    calidadUpper === 'TITULAR' ||
    input.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO';

  const minutosIndefinidosOrigen =
    input.minutosIndefinidosOrigen !== undefined
      ? Math.max(0, Math.round(input.minutosIndefinidosOrigen))
      : input.horasIndefinidasActuales !== undefined
        ? Math.round(Math.max(0, input.horasIndefinidasActuales) * 60)
        : esIndefinido
          ? minutosContratoTotalOrigen
          : 0;

  const minutosPlazoFijoOrigen =
    input.minutosPlazoFijoOrigen !== undefined
      ? Math.max(0, Math.round(input.minutosPlazoFijoOrigen))
      : Math.max(0, minutosContratoTotalOrigen - minutosIndefinidosOrigen);

  const minutosAdicionalesEscenario = Math.max(
    0,
    Math.round(input.minutosAdicionalesEscenario ?? 0)
  );
  const minutosOtros = Math.round(Math.max(0, input.horasOtrosEstablecimientos || 0) * 60);
  const minutosConservadosOrigen = input.esTrasladoCompleto
    ? 0
    : Math.round(Math.max(0, input.horasConservadasEnOrigen || 0) * 60);
  const minutosVacante = Math.round(horasVacanteSeguras * 60);

  const minutosTotalesMultiEscuela =
    minutosOtros +
    minutosConservadosOrigen +
    minutosVacante +
    minutosAdicionalesEscenario;

  const excedeTopeSemanal = minutosTotalesMultiEscuela > topeMin;
  if (excedeTopeSemanal) {
    const msg = `Exceso de tope semanal Ley N° 21.109 (${minutosTotalesMultiEscuela} min > ${topeMin} min permitidos).`;
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  }

  const esTrasladoCompletoEfectivo =
    input.esTrasladoCompleto === true ||
    (input.esTrasladoCompleto === undefined &&
      (input.horasConservadasEnOrigen || 0) === 0 &&
      (input.horasOtrosEstablecimientos || 0) === 0 &&
      input.carril !== 'HORAS_REMANENTES');

  let alertaMenoscaboIndefinido = false;
  let deficitMinutosIndefinidos = 0;

  if (esTrasladoCompletoEfectivo) {
    if (
      (esIndefinido || minutosIndefinidosOrigen > 0) &&
      minutosIndefinidosOrigen > 0 &&
      minutosVacante < minutosIndefinidosOrigen
    ) {
      alertaMenoscaboIndefinido = true;
      deficitMinutosIndefinidos = minutosIndefinidosOrigen - minutosVacante;
      const msg = `Menoscabo contrato indefinido Ley N° 21.109: vacante de ${horasVacanteSeguras}h (${minutosVacante} min) es inferior a los minutos indefinidos previos (${minutosIndefinidosOrigen} min), con déficit de ${deficitMinutosIndefinidos} min.`;
      alertasNormativas.push(msg);
      motivosBloqueo.push(msg);
    } else if (
      minutosVacante >= minutosIndefinidosOrigen &&
      minutosPlazoFijoOrigen > 0 &&
      minutosVacante < minutosIndefinidosOrigen + minutosPlazoFijoOrigen
    ) {
      const minutosPlazoExpiran = Math.min(
        minutosPlazoFijoOrigen,
        minutosIndefinidosOrigen + minutosPlazoFijoOrigen - minutosVacante
      );
      alertasNormativas.push(
        `Nota informativa Ley N° 21.109: las horas a plazo fijo (${minutosPlazoExpiran} min) vencen legalmente el 28 de febrero sin constituir menoscabo sobre el contrato indefinido (${minutosIndefinidosOrigen} min).`
      );
    }
  }

  // Evaluación de estamento (Ley N° 21.109)
  const rankOrig = JERARQUIA_ESTAMENTO_ASISTENTE[input.estamentoOrigen] ?? 1;
  const rankDest = JERARQUIA_ESTAMENTO_ASISTENTE[input.estamentoVacante] ?? 1;
  const esCarrilObligatorio = input.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO';

  let estamentoCompatible = true;
  let degradacionEstamento = false;
  let bloqueadoPorEstamento = false;
  let puntajeEstamento = 100;

  if (input.estamentoOrigen === input.estamentoVacante) {
    const cargoOrigNorm = normalizarTexto(input.cargoFuncionOrigen);
    const cargoVacNorm = normalizarTexto(input.cargoFuncionVacante);
    if (
      cargoOrigNorm &&
      cargoVacNorm &&
      cargoOrigNorm !== cargoVacNorm &&
      !cargoOrigNorm.includes(cargoVacNorm) &&
      !cargoVacNorm.includes(cargoOrigNorm)
    ) {
      puntajeEstamento = 85;
    }
  } else if (rankDest < rankOrig) {
    degradacionEstamento = true;
    estamentoCompatible = false;
    bloqueadoPorEstamento = true;
    puntajeEstamento = 15;
    const msg = `Degradación de estamento Ley N° 21.109 no permitida: asistente ${input.estamentoOrigen} no puede ser destinado a cupo de menor jerarquía (${input.estamentoVacante}).`;
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  } else if (rankDest > rankOrig) {
    estamentoCompatible = false;
    puntajeEstamento = 25;
    const msg = `Discrepancia de estamento Ley N° 21.109 (${input.estamentoOrigen} → ${input.estamentoVacante}): requiere acreditación de requisitos del estamento superior.`;
    alertasNormativas.push(msg);
    if (esCarrilObligatorio) {
      bloqueadoPorEstamento = true;
      motivosBloqueo.push(msg);
    }
  } else {
    // Misma jerarquía administrativa: ADMINISTRATIVO <-> PARADOCENTE_INSPECTORIA
    if (esCarrilObligatorio) {
      estamentoCompatible = false;
      bloqueadoPorEstamento = true;
      puntajeEstamento = 40;
      const msg = `Discrepancia de estamento en carril obligatorio (${input.estamentoOrigen} vs ${input.estamentoVacante}): en NO_CONTINUIDAD_ASISTENTE_INDEFINIDO debe respetarse estamento exacto.`;
      alertasNormativas.push(msg);
      motivosBloqueo.push(msg);
    } else {
      puntajeEstamento = 75;
      alertasNormativas.push(
        `Equivalencia funcional Art. 5 Ley N° 21.109 entre ${input.estamentoOrigen} y ${input.estamentoVacante}.`
      );
    }
  }

  // Egreso condicional (si aplica)
  let bloqueadoPorEgreso = false;
  const tipoCoberturaEfectivo: TipoCoberturaCalce =
    input.tipoCobertura ??
    (esIndefinido ? 'DEFINITIVA' : 'TRANSITORIA_CONDICIONAL');

  if (input.egresoAsociado) {
    const validacionEgreso = validarConsolidacionSobreEgreso(
      input.egresoAsociado,
      esIndefinido ? 'TITULAR' : 'CONTRATA',
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
  } else if (input.esVacanteCondicional && tipoCoberturaEfectivo === 'DEFINITIVA') {
    bloqueadoPorEgreso = true;
    const msg =
      'Vacante Condicional: se bloquea consolidación de contrato indefinido hasta contar con decreto y fecha de cese confirmados.';
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  }

  // Proximidad comunal e itinerancia rural compartida
  const proximidad = calcularPuntajeProximidadComuna(
    input.comunaOrigen,
    input.comunaDestino
  );
  const distanciaKm = proximidad.distanciaKm;
  let puntajeProximidad = proximidad.puntajeProximidad;

  const entreRbdsDistintos = !input.rbdOrigen || input.rbdOrigen !== input.rbdDestino;
  const hayContratoCompartido =
    entreRbdsDistintos &&
    (!esTrasladoCompletoEfectivo ||
      minutosOtros > 0 ||
      minutosConservadosOrigen > 0);
  const ambosRuralAislado =
    hayContratoCompartido &&
    input.accesibilidadOrigen === 'rural_aislado' &&
    input.accesibilidadDestino === 'rural_aislado';
  const algunoRuralAislado =
    hayContratoCompartido &&
    (input.accesibilidadOrigen === 'rural_aislado' ||
      input.accesibilidadDestino === 'rural_aislado');

  let alertaItineranciaRural = false;
  let bloqueadoPorItineranciaRural = false;

  if (ambosRuralAislado) {
    alertaItineranciaRural = true;
    bloqueadoPorItineranciaRural = true;
    puntajeProximidad = Math.min(puntajeProximidad, 30);
    const msg =
      'Itinerancia rural inviable: no se permite contrato compartido entre dos establecimientos rurales aislados.';
    alertasNormativas.push(msg);
    motivosBloqueo.push(msg);
  } else if (algunoRuralAislado) {
    alertaItineranciaRural = true;
    puntajeProximidad = Math.min(puntajeProximidad, 30);
    const msg =
      'Alerta itinerancia rural: contrato compartido involucra establecimiento rural aislado; verificar traslado físico.';
    alertasNormativas.push(msg);
    if (input.bloqueaPorItineranciaRuralOpcional === true) {
      bloqueadoPorItineranciaRural = true;
      motivosBloqueo.push(msg);
    }
  }

  const bloqueaConsolidacion =
    excedeTopeSemanal ||
    alertaMenoscaboIndefinido ||
    bloqueadoPorEstamento ||
    bloqueadoPorEgreso ||
    bloqueadoPorItineranciaRural;

  let puntajeAjusteHorario = 100;
  if (excedeTopeSemanal || minutosVacante <= 0) {
    puntajeAjusteHorario = 0;
  } else if (
    esTrasladoCompletoEfectivo &&
    horasContratoSeguras > 0 &&
    minutosVacante < minutosContratoTotalOrigen
  ) {
    puntajeAjusteHorario = Math.max(
      20,
      Math.round((minutosVacante / minutosContratoTotalOrigen) * 100)
    );
  }

  let puntajeNormativo = 100;
  if (alertaMenoscaboIndefinido) puntajeNormativo -= 80;
  if (bloqueadoPorEstamento) puntajeNormativo -= 60;
  if (bloqueadoPorEgreso) puntajeNormativo -= 50;
  if (bloqueadoPorItineranciaRural) puntajeNormativo -= 50;
  puntajeNormativo = Math.max(0, puntajeNormativo);

  const vieneDeSubvGeneral =
    input.fuenteOrigen === 'SUBVENCION_GENERAL' || input.fuenteOrigen === 'MIXTO';
  const destinoEsSepOPie =
    input.fuenteDestino === 'SEP' || input.fuenteDestino === 'PIE';
  let puntajeFinanciamiento = 100;
  if (esIndefinido && vieneDeSubvGeneral && destinoEsSepOPie) {
    puntajeFinanciamiento = 50;
    alertasNormativas.push(
      `Alerta de financiamiento (${input.fuenteDestino}): asistente con contrato indefinido proviene de Subvención General; verificar imputación presupuestaria.`
    );
  } else if (
    input.fuenteOrigen &&
    input.fuenteOrigen !== 'MIXTO' &&
    input.fuenteOrigen !== input.fuenteDestino
  ) {
    puntajeFinanciamiento = 75;
  }

  let indiceCompatibilidad = Math.round(
    puntajeEstamento * 0.35 +
      puntajeAjusteHorario * 0.25 +
      puntajeNormativo * 0.2 +
      puntajeFinanciamiento * 0.1 +
      puntajeProximidad * 0.1
  );

  if (excedeTopeSemanal || bloqueaConsolidacion) {
    indiceCompatibilidad = Math.min(indiceCompatibilidad, 45);
  }
  indiceCompatibilidad = clamp0_100(indiceCompatibilidad);

  return {
    asistenteId: input.asistenteId,
    vacanteId: input.vacanteId,
    rbdDestino: input.rbdDestino,
    topeMinutosSemanal: topeMin,
    minutosIndefinidosOrigen,
    minutosPlazoFijoOrigen,
    minutosAdicionalesEscenario,
    minutosOtros,
    minutosConservadosOrigen,
    minutosVacante,
    minutosTotalesMultiEscuela,
    excedeTopeSemanal,
    alertaMenoscaboIndefinido,
    deficitMinutosIndefinidos,
    estamentoCompatible,
    degradacionEstamento,
    alertaItineranciaRural,
    bloqueaConsolidacion,
    motivoBloqueo:
      motivosBloqueo.length > 0 ? motivosBloqueo.join(' | ') : undefined,
    puntajeEstamento,
    distanciaKm,
    puntajeProximidad,
    indiceCompatibilidad,
    alertasNormativas,
  };
}

function esFuncionNoLectivaIntransferible(fn: FuncionNoAulaOrigenRebote): boolean {
  const tipoNorm = normalizarTexto(fn.tipoFuncion);
  const descNorm = normalizarTexto(fn.descripcion);
  const combinado = `${tipoNorm} ${descNorm}`.trim();

  if (TIPOS_FUNCION_INTRANSFERIBLE.has(tipoNorm)) {
    return true;
  }
  if (
    tipoNorm.includes('DIRECTIVA') ||
    tipoNorm.includes('INSPECTORIA') ||
    /\bUTP\b/.test(tipoNorm) ||
    tipoNorm.includes('CONVIVENCIA')
  ) {
    return true;
  }
  return (
    combinado.includes('JEFATURA') ||
    combinado.includes('CONVIVENCIA') ||
    combinado.includes('COORDINADOR PIE') ||
    combinado.includes('COORDINACION PIE')
  );
}

/**
 * Genera la vacante de rebote en el establecimiento de origen cuando un docente se traslada,
 * preservando horas de contrato en minutos enteros, horas pedagógicas de aula y funciones no lectivas,
 * además de detectar funciones no lectivas intransferibles.
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

  const funcionesIntransferiblesDetectadas: string[] = [];
  for (const fn of funcionesNoLectivasHeredadas) {
    if (esFuncionNoLectivaIntransferible(fn)) {
      const etiqueta =
        fn.tipoFuncion && fn.descripcion
          ? `${fn.tipoFuncion}: ${fn.descripcion}`
          : fn.descripcion || fn.tipoFuncion || 'Función intransferible';
      if (!funcionesIntransferiblesDetectadas.includes(etiqueta)) {
        funcionesIntransferiblesDetectadas.push(etiqueta);
      }
    }
  }

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
    funcionesIntransferiblesDetectadas,
    deltaMinutosCadena,
    cadenaBalanceada: deltaMinutosCadena === 0,
  };
}

function obtenerCarrilYPuntajeCandidato(candidato: DocenteCandidatoCalce): {
  carrilEfectivo: CarrilMovilidad;
  puntajePrioridad: number;
} {
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

  return { carrilEfectivo, puntajePrioridad };
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

    if (
      evaluacion.excedeTope44h ||
      evaluacion.minutosTotalesMultiEscuela > TOPE_MINUTOS_SEMANALES_SLEP
    ) {
      continue;
    }

    if (evaluacion.indiceCompatibilidad < umbralMinimo) {
      continue;
    }

    const { puntajePrioridad } = obtenerCarrilYPuntajeCandidato(candidato);

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

/**
 * Resuelve el matching bipartito óptimo global (Algoritmo Húngaro / Kuhn-Munkres)
 * maximizando el peso determinista entero sobre aristas válidas sin bloqueos normativos.
 */
export function resolverCalceOptimoBipartito(
  candidatos: DocenteCandidatoCalce[],
  vacantes: VacanteObjetivoCalce[],
  umbralMinimo: number = 55
): AsignacionOptimaBipartita[] {
  const n = candidatos.length;
  const numVac = vacantes.length;
  if (n === 0 || numVac === 0) return [];

  interface CeldaArista {
    valida: boolean;
    evaluacion?: ResultadoEvaluacionCalce;
    puntajePrioridad: number;
    peso: number;
  }

  const celdas: CeldaArista[][] = Array.from({ length: n }, () => []);
  let maxPeso = 0;

  for (let i = 0; i < n; i++) {
    const candidato = candidatos[i];
    const { carrilEfectivo, puntajePrioridad } =
      obtenerCarrilYPuntajeCandidato(candidato);
    const comunaPrefNorm = normalizarTexto(candidato.comunaDestinoPreferente);

    for (let j = 0; j < numVac; j++) {
      const vac = vacantes[j];
      const evaluacion = evaluarCalceDocenteVacante({
        ...candidato,
        ...vac,
      });

      const esValida =
        !evaluacion.bloqueaConsolidacion &&
        !evaluacion.excedeTope44h &&
        evaluacion.indiceCompatibilidad >= umbralMinimo;

      if (!esValida) {
        celdas[i][j] = {
          valida: false,
          puntajePrioridad,
          peso: 0,
        };
        continue;
      }

      const comunaVacNorm = normalizarTexto(vac.comunaDestino);
      const bonoPreferenciaDestino =
        candidato.rbdDestinoPreferente &&
        candidato.rbdDestinoPreferente === vac.rbdDestino
          ? 600
          : comunaPrefNorm && comunaPrefNorm === comunaVacNorm
            ? 300
            : 0;

      const peso = Math.round(
        (carrilEfectivo === 'NO_CONTINUIDAD_TITULAR' ? 50000 : 0) +
          puntajePrioridad * 20 +
          evaluacion.indiceCompatibilidad * 10 +
          bonoPreferenciaDestino
      );

      if (peso > maxPeso) {
        maxPeso = peso;
      }

      celdas[i][j] = {
        valida: true,
        evaluacion,
        puntajePrioridad,
        peso,
      };
    }
  }

  // Si ninguna arista es válida, retorno inmediato
  const hayAlgunaAristaValida = celdas.some((fila) =>
    fila.some((c) => c.valida)
  );
  if (!hayAlgunaAristaValida) return [];

  // Matriz rectangular 1-indexed de n filas x (numVac + n) columnas.
  // Las n columnas dummy permiten que cualquier candidato quede sin asignar con ganancia 0
  // cuando un matching completo es imposible o subóptimo.
  const m = numVac + n;
  const costoBase = maxPeso + 1;
  const COSTO_INVIABLE = (n + 2) * costoBase + 1_000_000;
  const INF_HUNGARO = COSTO_INVIABLE * (n + 2);

  const a: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(costoBase)
  );

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= numVac; j++) {
      const celda = celdas[i - 1][j - 1];
      a[i][j] = celda.valida ? costoBase - celda.peso : COSTO_INVIABLE;
    }
    // Columnas dummy (numVac + 1 .. m) quedan con costo = costoBase (ganancia 0)
  }

  const u = new Array<number>(n + 1).fill(0);
  const v = new Array<number>(m + 1).fill(0);
  const p = new Array<number>(m + 1).fill(0);
  const way = new Array<number>(m + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array<number>(m + 1).fill(INF_HUNGARO);
    const used = new Array<boolean>(m + 1).fill(false);

    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF_HUNGARO;
      let j1 = 0;

      for (let j = 1; j <= m; j++) {
        if (!used[j]) {
          const cur = a[i0][j] - u[i0] - v[j];
          if (cur < minv[j]) {
            minv[j] = cur;
            way[j] = j0;
          }
          if (minv[j] < delta) {
            delta = minv[j];
            j1 = j;
          }
        }
      }

      for (let j = 0; j <= m; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }

      j0 = j1;
    } while (p[j0] !== 0);

    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0 !== 0);
  }

  const resultado: AsignacionOptimaBipartita[] = [];
  for (let j = 1; j <= numVac; j++) {
    const i = p[j];
    if (i >= 1 && i <= n) {
      const celda = celdas[i - 1][j - 1];
      if (celda.valida && celda.evaluacion) {
        resultado.push({
          candidato: candidatos[i - 1],
          vacante: vacantes[j - 1],
          evaluacion: celda.evaluacion,
          puntajePrioridad: celda.puntajePrioridad,
          pesoOptimo: celda.peso,
        });
      }
    }
  }

  resultado.sort((x, y) => {
    if (y.pesoOptimo !== x.pesoOptimo) return y.pesoOptimo - x.pesoOptimo;
    const cmpDoc = x.candidato.docenteId.localeCompare(y.candidato.docenteId);
    if (cmpDoc !== 0) return cmpDoc;
    return x.vacante.vacanteId.localeCompare(y.vacante.vacanteId);
  });

  return resultado;
}

/**
 * Ejecuta optimización bipartita en dos pasadas:
 * - Pasada 1: calza candidatos sobre vacantes reales disponibles.
 * - Pasada 2: genera vacantes virtuales NN-Rebote en los RBDs de origen liberados por traslado completo
 *   y calza óptimamente a los candidatos aún no asignados sobre dichos rebotes.
 */
export function resolverCalceOptimoConCadenasRebote(
  candidatos: DocenteCandidatoCalce[],
  vacantes: VacanteObjetivoCalce[],
  umbralMinimo: number = 55
): ResultadoCalceOptimoCadenasRebote {
  const asignacionesPasada1 = resolverCalceOptimoBipartito(
    candidatos,
    vacantes,
    umbralMinimo
  );

  const asignadosPasada1Ids = new Set(
    asignacionesPasada1.map((a) => a.candidato.docenteId)
  );
  const candidatosRestantes = candidatos.filter(
    (c) => !asignadosPasada1Ids.has(c.docenteId)
  );

  const vacantesRebote: VacanteObjetivoCalce[] = [];
  for (const asig of asignacionesPasada1) {
    if (
      asig.candidato.esTrasladoCompleto !== false &&
      asig.candidato.rbdOrigen &&
      asig.candidato.rbdOrigen !== asig.vacante.rbdDestino
    ) {
      const fuenteRebote: FuenteDestinoVacante =
        asig.candidato.fuenteOrigen === 'SEP' ||
        asig.candidato.fuenteOrigen === 'PIE'
          ? asig.candidato.fuenteOrigen
          : 'SUBVENCION_GENERAL';

      vacantesRebote.push({
        vacanteId: `rebote_auto_${asig.candidato.docenteId}`,
        rbdDestino: asig.candidato.rbdOrigen,
        horasVacante: Math.max(0, asig.candidato.horasContratoActual),
        asignaturaVacante:
          asig.candidato.asignaturaDocente ||
          asig.candidato.tituloMencionOficial ||
          asig.candidato.tituloMencion,
        fuenteDestino: fuenteRebote,
        porcentajePrioritariosDestino:
          asig.candidato.porcentajePrioritariosOrigen ?? 75,
        condicionesDificilesDestinoPct:
          asig.candidato.condicionesDificilesOrigenPct,
        accesibilidadDestino: asig.candidato.accesibilidadOrigen,
        comunaDestino: asig.candidato.comunaOrigen,
        esVacanteCondicional: false,
      });
    }
  }

  const rebotesGeneradosIds = vacantesRebote.map((v) => v.vacanteId);

  const asignacionesPasada2Rebotes =
    candidatosRestantes.length > 0 && vacantesRebote.length > 0
      ? resolverCalceOptimoBipartito(
          candidatosRestantes,
          vacantesRebote,
          umbralMinimo
        ).map((asig) => ({
          ...asig,
          esSegundaPasadaRebote: true,
        }))
      : [];

  return {
    asignacionesPasada1,
    asignacionesPasada2Rebotes,
    rebotesGeneradosIds,
    rebotesCubiertosEnCadena: asignacionesPasada2Rebotes.length,
  };
}
