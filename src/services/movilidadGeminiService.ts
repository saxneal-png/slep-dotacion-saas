/**
 * Servicio Asistido por IA (Google Gemini) para Mesa de Movilidad Territorial SLEP Valle Diguillín.
 *
 * REGLA JURÍDICA ESTRICTA (PROHIBICIÓN DE DISCRECIONALIDAD ALGORÍTMICA EN PUNTAJES):
 * Está ESTRICTAMENTE PROHIBIDO utilizar Google Gemini o cualquier modelo de IA generativa
 * para asignar, recalcular o modificar puntajes de traslado voluntario (Ley Karin, Salud,
 * Cuidado de Dependientes, Distancia Rural, Antigüedad) ni puntajes de prioridad legal.
 *
 * Los puntajes de traslado y las reglas de jornada/menoscabo/tope 44h se calculan 100% de
 * forma determinista en `@slep/mineduc-engine` en minutos enteros. Gemini solo se utiliza
 * de forma consultiva y opcional para:
 *  1) Redactar resúmenes comparativos ejecutivos de escenarios ya evaluados determinísticamente.
 *  2) Sugerir equivalencias curriculares orientativas en homologación Técnico-Profesional (TP),
 *     siempre sujetas a confirmación humana obligatoria (`requiereConfirmacionHumana: true`).
 */

import { evaluarCompatibilidadEspecialidad } from '@slep/mineduc-engine';
import { EscenarioCalce, PropuestaCalce } from '../types';
import { generateGeminiResponse } from './geminiApiClient';
import { obtenerGeminiApiKeyActiva } from './geminiKeyResolver';

export interface ResumenComparativoEscenariosInput {
  escenarios: EscenarioCalce[];
  propuestasPorEscenario?: Record<string, PropuestaCalce[]>;
  periodo?: number;
  contextoTerritorial?: string;
}

export interface ComparativaEscenarioItem {
  escenarioId: string;
  nombre: string;
  estado: EscenarioCalce['estado'];
  totalPropuestas: number;
  propuestasValidas: number;
  propuestasBloqueadas: number;
  rebotesPendientes: number;
  puntajeDeterministicRanking: number;
  riesgosDetectados: string[];
}

export interface ResumenComparativoEscenariosResult {
  resumenEjecutivo: string;
  escenarioRecomendadoId?: string;
  escenarioRecomendadoNombre?: string;
  comparativaEscenarios: ComparativaEscenarioItem[];
  alertasJuridicasClave: string[];
  recomendacionesOperativas: string[];
  origenAnalisis: 'GEMINI' | 'FALLBACK_DETERMINISTA';
  puntajesModificadosPorIa: false;
  requiereConfirmacionHumana: true;
  notaNormativa: string;
}

export interface SugerenciaHomologacionTpInput {
  docenteId?: string;
  nombreDocente?: string;
  tituloMencionDocente?: string;
  asignaturaDocente?: string;
  especialidadVacante?: string;
  rbdDestino?: string;
  nivelCurso?: string;
}

export interface SugerenciaHomologacionTpResult {
  compatibleDeterminista: boolean;
  puntajeIdoneidadBase: number;
  requiereHomologacionHumana: boolean;
  sectorEconomicoDocente: string;
  sectorEconomicoVacante: string;
  diagnosticoDeterminista: string;
  criteriosValidacionMineduc: string[];
  recomendacionIa?: string;
  equivalenciasCurricularesSugeridas: string[];
  origenAnalisis: 'GEMINI' | 'FALLBACK_DETERMINISTA';
  puntajesModificadosPorIa: false;
  requiereConfirmacionHumana: true;
  notaNormativa: string;
}

const NOTA_NORMATIVA_FIJA =
  'Análisis consultivo asistido. Ningún puntaje de traslado voluntario ni prioridad legal fue asignado o modificado por IA; toda decisión requiere validación humana UATP/GDP.';

function esEntornoTest(): boolean {
  const procVitest =
    typeof process !== 'undefined' &&
    Boolean((process.env as any)?.VITEST || (process.env as any)?.NODE_ENV === 'test');
  const globalVitest = typeof (globalThis as any).__vitest_environment__ !== 'undefined';
  return procVitest || globalVitest;
}

function resolverCredencialGemini(): { usarGemini: boolean; apiKey: string } {
  const key = obtenerGeminiApiKeyActiva();
  if (key) {
    return { usarGemini: true, apiKey: key };
  }
  const isElectron = typeof window !== 'undefined' && Boolean(window.electronAPI?.geminiRequest);
  const isWebBrowser =
    typeof window !== 'undefined' &&
    !isElectron &&
    typeof window.fetch === 'function' &&
    typeof window.location?.protocol === 'string' &&
    window.location.protocol.startsWith('http');

  if (isWebBrowser && !esEntornoTest()) {
    return { usarGemini: true, apiKey: '__SERVER_PROXY__' };
  }
  return { usarGemini: false, apiKey: '' };
}

function parseJsonSeguroGemini<T>(rawText: string): T | null {
  if (!rawText || typeof rawText !== 'string') return null;
  const trimmed = rawText.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as T;
    } catch {
      return null;
    }
  }
}

function inferirSectorTpDesdeTexto(texto?: string): string {
  const norm = String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!norm.trim()) return 'No especificado';
  if (/GASTRONOM|COCINA|ALIMENTACION|PASTELERIA/.test(norm)) return 'Hotelería y Gastronomía';
  if (/TURISMO|HOTELERIA/.test(norm)) return 'Hotelería y Turismo';
  if (/AUTOMOTRIZ|AUTOTRONICA/.test(norm)) return 'Metalmecánico / Automotriz';
  if (/MECANIC|ELECTROMECANIC|MATRICERIA|CONSTRUCCIONES METALICAS|SOLDADURA/.test(norm)) {
    return 'Metalmecánico';
  }
  if (/ELECTRIC|ELECTRONICA|AUTOMATIZACION/.test(norm)) return 'Electricidad y Electrónica';
  if (/PROGRAMACION|INFORMATICA|CONECTIVIDAD|REDES|TELECOMUNICACIONES|SOFTWARE/.test(norm)) {
    return 'Tecnología y Telecomunicaciones';
  }
  if (/ADMINISTRACION|CONTABILIDAD|CONTABLE|TRIBUTARIA/.test(norm)) {
    return 'Administración y Comercio';
  }
  if (/ENFERMERIA|TENS|ATENCION DE PARVUL|TECNICO.*PARVUL/.test(norm)) {
    return 'Programas y Proyectos Sociales / Salud y Educación';
  }
  if (/AGROPECUAR|AGRICOLA|FORESTAL|SILVICULTURA|VITIVINIC/.test(norm)) {
    return 'Agropecuario y Forestal';
  }
  if (/CONSTRUCCION|EDIFICACION|OBRAS CIVILES/.test(norm)) {
    return 'Construcción';
  }
  if (/MINERIA|MINERO|METALURGICA EXTRACTIVA/.test(norm)) {
    return 'Minero';
  }
  if (/GRAFICA|VESTUARIO|TEXTIL/.test(norm)) {
    return 'Gráfico y Confección';
  }
  if (/ACUICULTURA|PESQUERA|MARITIMA/.test(norm)) {
    return 'Marítimo';
  }
  if (/TECNICO PROFESIONAL|\bTP\b|\bEMTP\b/.test(norm)) {
    return 'TP Genérico (requiere especificación de sector económico)';
  }
  return 'Formación General / Humanístico-Científica';
}

/**
 * Genera un resumen comparativo ejecutivo de escenarios de calce territorial.
 * El ranking y diagnóstico base son 100% deterministas. Solo si existe API Key activa
 * (o proxy web en navegador) enriquece la redacción ejecutiva con Gemini, manteniendo
 * siempre `puntajesModificadosPorIa: false` y `requiereConfirmacionHumana: true`.
 */
export async function generarResumenComparativoEscenariosGemini(
  input: ResumenComparativoEscenariosInput
): Promise<ResumenComparativoEscenariosResult> {
  const escenarios = input.escenarios || [];
  const propsMap = input.propuestasPorEscenario || {};
  const alertasJuridicasSet = new Set<string>();
  const comparativaEscenarios: ComparativaEscenarioItem[] = [];

  for (const esc of escenarios) {
    const props = propsMap[esc.id] || [];
    const resumen = esc.resumenMetricas;

    const totalPropuestas = props.length > 0 ? props.length : Number(resumen?.totalPropuestas || 0);
    const propuestasBloqueadas =
      props.length > 0
        ? props.filter(p => p.bloqueaConsolidacion).length
        : Number(resumen?.propuestasBloqueadas || 0);
    const propuestasValidas =
      props.length > 0
        ? props.filter(p => !p.bloqueaConsolidacion).length
        : Number(resumen?.propuestasValidas || 0);
    const rebotesPendientes =
      props.length > 0
        ? props.filter(
            p =>
              p.generaRebote &&
              (!p.estadoResolucionRebote ||
                p.estadoResolucionRebote === 'PENDIENTE' ||
                p.estadoResolucionRebote === 'NO_APLICA')
          ).length
        : Number(resumen?.rebotesPendientes || 0);

    const riesgosDetectados: string[] = [];
    if (propuestasBloqueadas > 0) {
      const m = `${propuestasBloqueadas} propuesta(s) con bloqueo normativo (Art. 42, 44h, Art. 69 o vacante condicional).`;
      riesgosDetectados.push(m);
      alertasJuridicasSet.add(m);
    }
    if (rebotesPendientes > 0) {
      const m = `${rebotesPendientes} vacante(s) NN-Rebote en estado PENDIENTE de cierre (Cadena o Concurso GDP).`;
      riesgosDetectados.push(m);
      alertasJuridicasSet.add(m);
    }

    const art50Count = props.filter(p => p.alertaMenoscaboEconomicoArt50).length;
    if (art50Count > 0) {
      const m = `${art50Count} caso(s) con alerta de menoscabo económico Art. 50 Ley 20.903 (tramo carrera docente).`;
      riesgosDetectados.push(m);
      alertasJuridicasSet.add(m);
    }

    const condDifCount = props.filter(p => p.alertaCondicionesDificiles).length;
    if (condDifCount > 0) {
      const m = `${condDifCount} caso(s) con pérdida o reducción de asignación por Condiciones Difíciles.`;
      riesgosDetectados.push(m);
      alertasJuridicasSet.add(m);
    }

    const dto352Count = props.filter(p => p.alertaHabilitacionSeremiDto352).length;
    if (dto352Count > 0) {
      const m = `${dto352Count} caso(s) requieren nueva habilitación SEREMI (Decreto N° 352/2003) en el RBD destino.`;
      riesgosDetectados.push(m);
      alertasJuridicasSet.add(m);
    }

    const ruralCount = props.filter(p => p.alertaItineranciaRural).length;
    if (ruralCount > 0) {
      const m = `${ruralCount} caso(s) con contrato compartido en zona rural aislada (verificar factibilidad horaria).`;
      riesgosDetectados.push(m);
      alertasJuridicasSet.add(m);
    }

    // Ranking determinista puro basado solo en cumplimiento normativo y cobertura operativa (no en puntajes de traslado)
    const puntajeDeterministicRanking =
      propuestasValidas * 100 -
      propuestasBloqueadas * 150 -
      rebotesPendientes * 40 -
      art50Count * 15 -
      dto352Count * 15 -
      ruralCount * 10;

    comparativaEscenarios.push({
      escenarioId: esc.id,
      nombre: esc.nombre,
      estado: esc.estado,
      totalPropuestas,
      propuestasValidas,
      propuestasBloqueadas,
      rebotesPendientes,
      puntajeDeterministicRanking,
      riesgosDetectados
    });
  }

  comparativaEscenarios.sort((a, b) => b.puntajeDeterministicRanking - a.puntajeDeterministicRanking);
  const mejor = comparativaEscenarios[0];

  const alertasJuridicasClave = Array.from(alertasJuridicasSet);
  const recomendacionesOperativas: string[] = [];

  if (comparativaEscenarios.length === 0) {
    recomendacionesOperativas.push(
      'Cree al menos un escenario de calce y ejecute el simulador óptimo para comparar alternativas territoriales.'
    );
  } else {
    if (mejor && mejor.propuestasBloqueadas > 0) {
      recomendacionesOperativas.push(
        `Resolver los ${mejor.propuestasBloqueadas} bloqueo(s) normativo(s) en '${mejor.nombre}' antes de solicitar consolidación a Subdirección UATP.`
      );
    }
    if (mejor && mejor.rebotesPendientes > 0) {
      recomendacionesOperativas.push(
        `Cerrar los ${mejor.rebotesPendientes} rebote(s) pendiente(s) en '${mejor.nombre}' marcándolos como Cubiertos en Cadena o Derivados a Concurso GDP.`
      );
    }
    if (alertasJuridicasClave.some(a => a.includes('Art. 50') || a.includes('Condiciones Difíciles'))) {
      recomendacionesOperativas.push(
        'Solicitar visación jurídica de resguardo remuneracional antes de emitir resoluciones exentas en casos con alerta Art. 50 o Condiciones Difíciles.'
      );
    }
    if (recomendacionesOperativas.length === 0) {
      recomendacionesOperativas.push(
        'Verificar firmas de aceptación en solicitudes de traslado voluntario y proceder a consolidación atómica y emisión de resolución exenta.'
      );
    }
  }

  const resumenDeterminista =
    comparativaEscenarios.length === 0
      ? 'No se proporcionaron escenarios de calce para comparar.'
      : `Comparativa determinista de ${comparativaEscenarios.length} escenario(s) (período ${input.periodo || 2027}): ` +
        `el escenario mejor posicionado por cumplimiento normativo es '${mejor.nombre}' ` +
        `(${mejor.propuestasValidas} válida(s), ${mejor.propuestasBloqueadas} bloqueada(s), ${mejor.rebotesPendientes} rebote(s) pendiente(s)).`;

  const fallbackResult: ResumenComparativoEscenariosResult = {
    resumenEjecutivo: resumenDeterminista,
    escenarioRecomendadoId: mejor?.escenarioId,
    escenarioRecomendadoNombre: mejor?.nombre,
    comparativaEscenarios,
    alertasJuridicasClave,
    recomendacionesOperativas,
    origenAnalisis: 'FALLBACK_DETERMINISTA',
    puntajesModificadosPorIa: false,
    requiereConfirmacionHumana: true,
    notaNormativa: NOTA_NORMATIVA_FIJA
  };

  const cred = resolverCredencialGemini();
  if (!cred.usarGemini || comparativaEscenarios.length === 0) {
    return fallbackResult;
  }

  try {
    const prompt = [
      'Eres un asesor jurídico-administrativo de Educación Pública en Chile (SLEP Valle Diguillín).',
      'REGLA INVIOLABLE: NO asignes ni modifiques puntajes de traslado voluntario ni puntajes de prioridad legal.',
      'Solo redacta un resumen comparativo ejecutivo en español formal y recomendaciones operativas basadas estrictamente en los datos deterministas adjuntos.',
      'Responde EXCLUSIVAMENTE en formato JSON válido con las llaves:',
      '{ "resumenEjecutivo": string, "alertasAdicionales": string[], "recomendacionesOperativas": string[] }',
      `Periodo: ${input.periodo || 2027}`,
      input.contextoTerritorial ? `Contexto: ${input.contextoTerritorial}` : '',
      `Datos deterministas de escenarios: ${JSON.stringify(comparativaEscenarios)}`,
      `Alertas jurídicas base: ${JSON.stringify(alertasJuridicasClave)}`
    ]
      .filter(Boolean)
      .join('\n');

    const raw = await generateGeminiResponse(prompt, cred.apiKey);
    const parsed = parseJsonSeguroGemini<{
      resumenEjecutivo?: string;
      alertasAdicionales?: string[];
      recomendacionesOperativas?: string[];
    }>(raw);

    if (!parsed || !parsed.resumenEjecutivo) {
      return fallbackResult;
    }

    const alertasCombinadas = Array.from(
      new Set([
        ...alertasJuridicasClave,
        ...(Array.isArray(parsed.alertasAdicionales)
          ? parsed.alertasAdicionales.map(x => String(x || '').trim()).filter(Boolean)
          : [])
      ])
    );

    const recomendacionesCombinadas =
      Array.isArray(parsed.recomendacionesOperativas) && parsed.recomendacionesOperativas.length > 0
        ? parsed.recomendacionesOperativas.map(x => String(x || '').trim()).filter(Boolean)
        : recomendacionesOperativas;

    return {
      resumenEjecutivo: String(parsed.resumenEjecutivo).trim(),
      escenarioRecomendadoId: mejor?.escenarioId,
      escenarioRecomendadoNombre: mejor?.nombre,
      comparativaEscenarios,
      alertasJuridicasClave: alertasCombinadas,
      recomendacionesOperativas: recomendacionesCombinadas,
      origenAnalisis: 'GEMINI',
      puntajesModificadosPorIa: false,
      requiereConfirmacionHumana: true,
      notaNormativa: NOTA_NORMATIVA_FIJA
    };
  } catch {
    return fallbackResult;
  }
}

/**
 * Evalúa determinísticamente la compatibilidad Técnico-Profesional (TP) y, cuando existe
 * credencial activa de Gemini, aporta equivalencias curriculares orientativas para apoyar
 * la homologación humana UATP/SEREMI (nunca sustituye la autorización oficial Dto. 352).
 */
export async function sugerirHomologacionCurricularTpGemini(
  input: SugerenciaHomologacionTpInput
): Promise<SugerenciaHomologacionTpResult> {
  const mencionDocente = [input.tituloMencionDocente, input.asignaturaDocente]
    .map(v => String(v || '').trim())
    .filter(Boolean)
    .join(' / ');

  const compat = evaluarCompatibilidadEspecialidad(mencionDocente, input.especialidadVacante);
  const sectorEconomicoDocente = inferirSectorTpDesdeTexto(mencionDocente);
  const sectorEconomicoVacante = inferirSectorTpDesdeTexto(input.especialidadVacante);

  const requiereHomologacionHumana =
    Boolean(compat.requiereHomologacionTp) || !compat.coincide || compat.puntaje < 90;

  const criteriosValidacionMineduc: string[] = [
    'Verificar título profesional, mención o habilitación técnico-profesional registrada en CPEIP / Decreto N° 352/2003.',
    'Contrastación de módulos del Plan de Estudios EMTP (Decreto 452/2013 y Decreto 954/2015) con la experiencia acreditada.',
    'Si los sectores económicos difieren o la mención es TP genérica, requerir autorización docente SEREMI vinculada al RBD destino.'
  ];

  const equivalenciasDeterministas: string[] = [];
  if (compat.coincide) {
    equivalenciasDeterministas.push(
      `Compatibilidad curricular directa o dentro del mismo sector (${sectorEconomicoVacante}): validar módulos específicos del plan de estudios del liceo.`
    );
  } else {
    equivalenciasDeterministas.push(
      `Brecha detectada entre '${sectorEconomicoDocente}' y '${sectorEconomicoVacante}': revisar experiencia técnica acreditada o tramitar autorización SEREMI.`
    );
  }

  const fallbackResult: SugerenciaHomologacionTpResult = {
    compatibleDeterminista: compat.coincide,
    puntajeIdoneidadBase: compat.puntaje,
    requiereHomologacionHumana,
    sectorEconomicoDocente,
    sectorEconomicoVacante,
    diagnosticoDeterminista: compat.motivo,
    criteriosValidacionMineduc,
    equivalenciasCurricularesSugeridas: equivalenciasDeterministas,
    origenAnalisis: 'FALLBACK_DETERMINISTA',
    puntajesModificadosPorIa: false,
    requiereConfirmacionHumana: true,
    notaNormativa: NOTA_NORMATIVA_FIJA
  };

  const cred = resolverCredencialGemini();
  if (!cred.usarGemini) {
    return fallbackResult;
  }

  try {
    const prompt = [
      'Eres un especialista curricular en Educación Media Técnico-Profesional (EMTP) del MINEDUC en Chile.',
      'REGLA INVIOLABLE: NO asignes ni modifiques puntajes de traslado ni puntajes de idoneidad numéricos.',
      'Solo entrega una orientación técnica cualitativa sobre homologación curricular de módulos TP, sujeta a validación humana.',
      'Responde EXCLUSIVAMENTE en JSON válido con las llaves:',
      '{ "recomendacionIa": string, "equivalenciasCurricularesSugeridas": string[], "criteriosAdicionales": string[] }',
      `Docente: ${input.nombreDocente || 'No informado'}`,
      `Título / Mención / Asignatura docente: ${mencionDocente || 'No informado'}`,
      `Especialidad de vacante destino: ${input.especialidadVacante || 'No informada'}`,
      `Nivel / Curso: ${input.nivelCurso || 'EMTP'}`,
      `RBD Destino: ${input.rbdDestino || 'No informado'}`,
      `Diagnóstico determinista previo: ${compat.motivo} (Puntaje base: ${compat.puntaje}, Sector docente: ${sectorEconomicoDocente}, Sector vacante: ${sectorEconomicoVacante})`
    ].join('\n');

    const raw = await generateGeminiResponse(prompt, cred.apiKey);
    const parsed = parseJsonSeguroGemini<{
      recomendacionIa?: string;
      equivalenciasCurricularesSugeridas?: string[];
      criteriosAdicionales?: string[];
    }>(raw);

    if (!parsed || !parsed.recomendacionIa) {
      return fallbackResult;
    }

    const eqSugeridas =
      Array.isArray(parsed.equivalenciasCurricularesSugeridas) &&
      parsed.equivalenciasCurricularesSugeridas.length > 0
        ? parsed.equivalenciasCurricularesSugeridas.map(x => String(x || '').trim()).filter(Boolean)
        : equivalenciasDeterministas;

    const criteriosCombinados = Array.from(
      new Set([
        ...criteriosValidacionMineduc,
        ...(Array.isArray(parsed.criteriosAdicionales)
          ? parsed.criteriosAdicionales.map(x => String(x || '').trim()).filter(Boolean)
          : [])
      ])
    );

    return {
      compatibleDeterminista: compat.coincide,
      puntajeIdoneidadBase: compat.puntaje,
      requiereHomologacionHumana: true,
      sectorEconomicoDocente,
      sectorEconomicoVacante,
      diagnosticoDeterminista: compat.motivo,
      criteriosValidacionMineduc: criteriosCombinados,
      recomendacionIa: String(parsed.recomendacionIa).trim(),
      equivalenciasCurricularesSugeridas: eqSugeridas,
      origenAnalisis: 'GEMINI',
      puntajesModificadosPorIa: false,
      requiereConfirmacionHumana: true,
      notaNormativa: NOTA_NORMATIVA_FIJA
    };
  } catch {
    return fallbackResult;
  }
}
