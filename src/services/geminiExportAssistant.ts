/**
 * geminiExportAssistant.ts
 * Asistente Gemini AI para la exportación de la Matriz Excel de Dotación.
 *
 * Funciones:
 * 1. clasificarDocentesConGemini: Decide Sección 1 (Plan de Estudio) o
 *    Sección 2 (Apoyo/PIE/Directivos) para cada docente, con análisis AI completo.
 * 2. generarObservacionesConGemini: Produce observaciones cortas de auditoría
 *    para la columna OBSERVACIONES / AUDITORÍA del Excel.
 */

import { Docente, AsignacionHoraria, Establecimiento } from '../types';

/** Resultado de clasificación de sección por Gemini */
export interface GeminiSeccionResult {
  seccion: 'SECCION_1' | 'SECCION_2';
  razon: string;
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
}

/** Opciones de análisis AI para la exportación */
export interface GeminiExportOptions {
  apiKey: string;
  modelName?: string;
  /** Si true, analiza TODOS los docentes. Si false, solo los ambiguos. */
  analizarTodos?: boolean;
}

const CANDIDATE_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-3.7-flash',
  'gemini-3.8-flash',
];

/**
 * Realiza una petición a la API de Google Generative Language (Gemini).
 * Prueba modelos en cascada hasta obtener una respuesta válida.
 */
async function callGemini(
  prompt: string,
  apiKey: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<string | null> {
  const candidates = [modelName, ...CANDIDATE_MODELS.filter(m => m !== modelName)];

  for (const model of candidates) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.05, // Muy bajo para respuestas determinísticas
            maxOutputTokens: 4096,
          },
        }),
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch {
      // Continuar al siguiente modelo
    }
  }
  return null;
}

/**
 * Construye un resumen compacto de un docente para enviarlo a Gemini.
 */
function resumirDocente(
  docente: Docente,
  asignaciones: AsignacionHoraria[],
  esRegimen6040: boolean
): Record<string, unknown> {
  const asigsDoc = asignaciones.filter(a => a.docenteId === docente.id);
  const asignaturas = asigsDoc.map(a => ({
    asignatura: a.asignatura,
    horasHA: a.horasPedagogicasAula,
    esPIE: a.esTrabajoColaborativo || a.esCoDocencia,
    esTallerSep: a.esTallerSep,
    esCoDocencia: a.esCoDocencia,
  }));

  const totalHAAsignadas = asigsDoc.reduce((s, a) => s + Number(a.horasPedagogicasAula || 0), 0);

  return {
    id: docente.id,
    nombre: `${docente.apellidos}, ${docente.nombres}`,
    estamento: docente.estamento,
    calidadJuridica: docente.calidadJuridica,
    horasContrato: docente.horasContrato,
    horasSubGralTitular: docente.horasSubvencionGeneralTitular || 0,
    horasSubGralContrata: docente.horasSubvencionGeneralContrata || 0,
    horasSepTitular: docente.horasSepTitular || 0,
    horasSepContrata: docente.horasSepContrata || 0,
    horasPieTitular: docente.horasPieTitular || 0,
    horasPieContrata: docente.horasPieContrata || 0,
    horasDirectivas: docente.horasDirectivas || 0,
    horasTecnicoPedagogicas: docente.horasTecnicoPedagogicas || 0,
    horasInspectorGeneral: docente.horasInspectorGeneral || 0,
    horasTrabajoColaborativo: docente.horasTrabajoColaborativo || 0,
    horasCoordinacionPie: docente.horasCoordinacionPie || 0,
    horasTallerSep: docente.horasTallerSep || 0,
    cargoInstitucional: docente.cargoInstitucional || null,
    totalHAAsignadas,
    regimen: esRegimen6040 ? '60/40' : '65/35',
    asignaturas,
  };
}

// ============================================================
// FUNCIÓN 1: Clasificación de Sección 1 / Sección 2
// ============================================================

const PROMPT_CLASIFICACION_SECCION = `Eres un experto auditor de dotación docente del sistema escolar chileno (MINEDUC / SLEP - Servicios Locales de Educación Pública).

Tu tarea es clasificar a cada docente en exactamente UNA de estas dos secciones de la Matriz Oficial de Dotación:

**SECCION_1 — Plan de Estudio / Aula Regular:**
- Docentes que imparten asignaturas del curriculum: Lenguaje, Matemáticas, Historia, Ciencias Naturales, Biología, Física, Química, Artes, Música, Tecnología, Ed. Física, Inglés, Religión, Filosofía, Orientación, Formación Ciudadana.
- Educadoras de Párvulos (NT1/NT2/Kínder/Pre-kínder).
- Docentes con horas de aula regular aunque también tengan horas PIE menores (si la función principal es aula curricular).
- Docentes multigrado.

**SECCION_2 — Apoyo PIE / Co-docencia / Talleristas / Gestión Directiva:**
- Docentes Diferenciales cuya función principal es Aula de Recursos, Coordinación PIE, Trabajo Colaborativo Decreto 170.
- Co-docentes exclusivos (codocencia sin asignatura curricular propia).
- Talleristas JEC o SEP sin asignatura curricular propia.
- Directora/Director, Subdirectora/Subdirector, Inspector/Inspectora General.
- Jefa/Jefe UTP (Unidad Técnico Pedagógica), Orientador/a, Coordinador/a Convivencia Escolar, Encargado/a CRA.
- Profesionales PAE, Técnicos de apoyo especializado.

**Regla de desempate:** Si un docente tiene horas curriculares Y horas PIE/SEP, va a SECCION_1 si las horas curriculares son mayoría; a SECCION_2 si las horas PIE/Directivas son mayoría.

Analiza los siguientes docentes con sus datos completos:
{docentes_json}

Responde ÚNICAMENTE con un objeto JSON válido:
{
  "id_del_docente": {
    "seccion": "SECCION_1" | "SECCION_2",
    "razon": "breve explicación (máx 80 caracteres)",
    "confianza": "ALTA" | "MEDIA" | "BAJA"
  },
  ...
}`;

/**
 * Clasifica docentes en Sección 1 (Plan de Estudio) o Sección 2 (Apoyo/Directivos)
 * usando Google Gemini AI.
 *
 * @param docentes Lista de docentes del establecimiento
 * @param asignaciones Todas las asignaciones del establecimiento
 * @param establecimiento Datos del establecimiento (para saber el régimen)
 * @param options Opciones: apiKey, modelName, analizarTodos
 * @returns Map<docenteId, GeminiSeccionResult>
 */
export async function clasificarDocentesConGemini(
  docentes: Docente[],
  asignaciones: AsignacionHoraria[],
  establecimiento: Establecimiento,
  options: GeminiExportOptions
): Promise<Map<string, GeminiSeccionResult>> {
  const result = new Map<string, GeminiSeccionResult>();
  if (!options.apiKey || docentes.length === 0) return result;

  const esRegimen6040 = (establecimiento.porcentajePrioritarios || 0) >= 80;

  // Construir resúmenes de todos los docentes
  const resumenes = docentes.map(d => resumirDocente(d, asignaciones, esRegimen6040));

  const prompt = PROMPT_CLASIFICACION_SECCION.replace(
    '{docentes_json}',
    JSON.stringify(resumenes, null, 2)
  );

  const raw = await callGemini(prompt, options.apiKey, options.modelName);
  if (!raw) return result;

  try {
    const parsed: Record<string, { seccion: string; razon: string; confianza: string }> = JSON.parse(raw);
    for (const [docenteId, datos] of Object.entries(parsed)) {
      const seccion = datos.seccion === 'SECCION_2' ? 'SECCION_2' : 'SECCION_1';
      const confianza = (['ALTA', 'MEDIA', 'BAJA'].includes(datos.confianza) ? datos.confianza : 'MEDIA') as 'ALTA' | 'MEDIA' | 'BAJA';
      result.set(docenteId, {
        seccion,
        razon: datos.razon || '',
        confianza,
      });
    }
  } catch {
    // Si Gemini retorna JSON inválido, se ignora y se usa clasificación local
  }

  return result;
}

// ============================================================
// FUNCIÓN 2: Generación de Observaciones de Auditoría
// ============================================================

const PROMPT_OBSERVACIONES = `Eres un auditor experto en dotación docente del sistema escolar público chileno (MINEDUC / SLEP - Servicios Locales de Educación Pública), especializado en Ley 20.903 y regímenes 65/35 y 60/40.

Analiza los datos de cada docente y genera una observación de auditoría corta (máximo 90 caracteres) para la columna de auditoría de la planilla oficial de dotación.

Criterios de auditoría a detectar:
- "OK – Contrato cuadra" si las horas asignadas coinciden con el contrato y el régimen es correcto.
- Si las horas HA asignadas superan el máximo lectivo del régimen (65/35: 65% del contrato; 60/40: 60% del contrato) → indicar "⚠ Sobreasignación lectiva: XX HA asignadas, máximo YY".
- Si no tiene asignaciones registradas → "Sin asignaciones en sistema".
- Si tiene contrato mixto (SubGral + SEP + PIE) y las sumas no cuadran con horasContrato → "Revisar desglose financiero".
- Si es docente diferencial con horas de aula regular y horas PIE simultáneas → mencionar distribución.
- Si aplica Art. 69 (reducción a 24h máx aula) → indicar.
- Cualquier irregularidad relevante para auditoría.

Datos de docentes a analizar:
{docentes_json}

Responde ÚNICAMENTE con un objeto JSON válido donde la clave es el id del docente:
{
  "id_docente": "texto de observación (máx 90 caracteres)",
  ...
}`;

/**
 * Genera observaciones de auditoría inteligentes para la columna OBSERVACIONES del Excel.
 *
 * @param docentes Lista de docentes del establecimiento
 * @param asignaciones Todas las asignaciones del establecimiento
 * @param establecimiento Datos del establecimiento
 * @param options Opciones: apiKey, modelName
 * @returns Map<docenteId, string> con el texto de observación por docente
 */
export async function generarObservacionesConGemini(
  docentes: Docente[],
  asignaciones: AsignacionHoraria[],
  establecimiento: Establecimiento,
  options: GeminiExportOptions
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (!options.apiKey || docentes.length === 0) return result;

  const esRegimen6040 = (establecimiento.porcentajePrioritarios || 0) >= 80;

  const resumenes = docentes.map(d => resumirDocente(d, asignaciones, esRegimen6040));

  const prompt = PROMPT_OBSERVACIONES.replace(
    '{docentes_json}',
    JSON.stringify(resumenes, null, 2)
  );

  const raw = await callGemini(prompt, options.apiKey, options.modelName);
  if (!raw) return result;

  try {
    const parsed: Record<string, string> = JSON.parse(raw);
    for (const [docenteId, obs] of Object.entries(parsed)) {
      if (typeof obs === 'string' && obs.length > 0) {
        // Truncar a 90 caracteres por seguridad
        result.set(docenteId, obs.slice(0, 90));
      }
    }
  } catch {
    // Si el JSON es inválido, se omiten las observaciones
  }

  return result;
}
