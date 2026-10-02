import { generateGeminiResponse } from '../geminiApiClient';

export interface InterpretedTeacherNote {
  raw_text: string;
  nombres?: string;
  apellidos?: string;
  horas_aula?: number;
  horas_directivas?: number;
  horas_tecnicas?: number;
  horas_coordinacion_pie?: number;
  horas_convivencia?: number;
  horas_extraescolar?: number;
  es_co_docencia?: boolean;
  es_taller_sep?: boolean;
  curso_detectado?: string;
  asignatura_normalizada?: string;
  observaciones_limpias: string;
  dictamen_ia: string;
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
}

export interface TeacherNoteInput {
  rut: string;
  teacher_name: string;
  activity: string;
  hours: number;
  curso?: string;
  observaciones?: string;
}

/**
 * Heurística rápida local para interpretar notas docentes sin consumir tokens si no hay API key.
 */
export function interpretarNotasDocenteHeuristica(input: TeacherNoteInput): InterpretedTeacherNote {
  const text = `${input.activity} ${input.observaciones || ''}`.trim();
  const lower = text.toLowerCase();

  let horasDirectivas = 0;
  let horasTecnicas = 0;
  let horasPie = 0;
  let horasConvivencia = 0;
  let horasExtraescolar = 0;
  let esCoDocencia = false;
  let esTallerSep = false;
  let cursoDetectado = input.curso;
  let asignaturaNormalizada = input.activity;

  // Detección de Co-Docencia
  if (/co.*docenc|docenc.*compartida/i.test(lower)) {
    esCoDocencia = true;
  }

  // Detección de Talleres SEP
  if (/taller.*sep|extraesc.*sep|\bsep\b/i.test(lower)) {
    esTallerSep = true;
  }

  // Detección de Funciones Directivas
  if (/director|subdirector|inspector.*general|profesor.*encargado|docente.*encargado/i.test(lower)) {
    horasDirectivas = input.hours;
    asignaturaNormalizada = 'Función Directiva Institucional';
  }
  // Detección UTP
  else if (/jefe.*utp|jefatura.*utp|\butp\b|tecnico.*pedag|evaluador/i.test(lower)) {
    horasTecnicas = input.hours;
    asignaturaNormalizada = 'Unidad Técnico Pedagógica (UTP)';
  }
  // Detección PIE
  else if (/coordinad.*pie|coordinacion.*pie/i.test(lower)) {
    horasPie = input.hours;
    asignaturaNormalizada = 'Coordinación PIE (Dec. 170)';
  }
  // Detección Convivencia
  else if (/convivencia|orientador|enlaces|cra\b/i.test(lower)) {
    horasConvivencia = input.hours;
    asignaturaNormalizada = 'Convivencia Escolar / Orientación';
  }
  // Detección Extraescolar
  else if (/extraescolar|\bacle\b/i.test(lower)) {
    horasExtraescolar = input.hours;
    asignaturaNormalizada = 'Coordinación Extraescolar';
  }

  return {
    raw_text: text,
    horas_aula: horasDirectivas === 0 && horasTecnicas === 0 && horasPie === 0 && horasConvivencia === 0 && horasExtraescolar === 0 ? input.hours : 0,
    horas_directivas: horasDirectivas,
    horas_tecnicas: horasTecnicas,
    horas_coordinacion_pie: horasPie,
    horas_convivencia: horasConvivencia,
    horas_extraescolar: horasExtraescolar,
    es_co_docencia: esCoDocencia,
    es_taller_sep: esTallerSep,
    curso_detectado: cursoDetectado,
    asignatura_normalizada: asignaturaNormalizada,
    observaciones_limpias: text,
    dictamen_ia: 'Clasificado mediante heurística normativa MINEDUC',
    confianza: 'MEDIA',
  };
}

/**
 * Interpreta notas y observaciones docentes en lote utilizando Google Gemini AI.
 */
export async function interpretarNotasDocentesConIa(
  inputs: TeacherNoteInput[],
  apiKey: string,
  modelName: string = 'gemini-3.7-flash',
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, InterpretedTeacherNote>> {
  const resultMap = new Map<string, InterpretedTeacherNote>();
  if (!inputs.length) return resultMap;

  // Si no hay API key, resolver por heurística
  if (!apiKey) {
    inputs.forEach((inp, idx) => {
      const key = `${inp.rut || inp.teacher_name}__${inp.activity}`;
      resultMap.set(key, interpretarNotasDocenteHeuristica(inp));
      if (onProgress) onProgress(idx + 1, inputs.length);
    });
    return resultMap;
  }

  const batchSize = 15;
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);

    const promptText = `
Eres un Auditor Experto en Dotación Docente y Normativa Escolar Chilena (MINEDUC, Ley 20.903, DFL 1/1996, Dec. 170 PIE, Ley SEP 20.248).
Analiza el siguiente lote de actividades y notas docentes extraídas de planillas escolares del SLEP Valle Diguillín.

Para cada elemento del lote, interpreta y devuelve un objeto JSON estructurado con:
- "index": índice correspondiente en la lista.
- "horas_aula": horas lectivas reales frente a alumnos en aula regular (number).
- "horas_directivas": horas de Dirección, Subdirección o Inspectoría General (number).
- "horas_tecnicas": horas de Jefe de UTP, Currículum o Evaluación (number).
- "horas_coordinacion_pie": horas de Coordinación PIE (number).
- "horas_convivencia": horas de Convivencia Escolar, Orientación, Enlaces o CRA (number).
- "horas_extraescolar": horas de Coordinación Extraescolar o ACLE (number).
- "es_co_docencia": true si corresponde a co-docencia / docencia compartida en aula (boolean).
- "es_taller_sep": true si corresponde a taller extracurricular SEP o JEC (boolean).
- "asignatura_normalizada": nombre oficial y limpio de la asignatura o función institucional (string).
- "observaciones_limpias": resumen depurado y profesional de cualquier nota de reemplazo, licencia o condicionante (string).
- "dictamen_ia": breve justificación técnica normativa (string).
- "confianza": "ALTA" | "MEDIA" | "BAJA".

Datos a analizar:
${JSON.stringify(
  batch.map((b, idx) => ({
    index: idx,
    rut: b.rut,
    teacher_name: b.teacher_name,
    activity: b.activity,
    hours: b.hours,
    curso: b.curso,
    observaciones: b.observaciones,
  })),
  null,
  2
)}

Responde ÚNICAMENTE un array JSON válido con la estructura solicitada, sin formato markdown adicional.
`;

    try {
      const response = await generateGeminiResponse(promptText, apiKey, modelName);
      const cleanJson = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsedArray: any[] = JSON.parse(cleanJson);

      if (Array.isArray(parsedArray)) {
        parsedArray.forEach((item, idx) => {
          const inp = batch[item.index !== undefined ? item.index : idx] || batch[idx];
          if (inp) {
            const key = `${inp.rut || inp.teacher_name}__${inp.activity}`;
            resultMap.set(key, {
              raw_text: `${inp.activity} ${inp.observaciones || ''}`.trim(),
              horas_aula: typeof item.horas_aula === 'number' ? item.horas_aula : inp.hours,
              horas_directivas: typeof item.horas_directivas === 'number' ? item.horas_directivas : 0,
              horas_tecnicas: typeof item.horas_tecnicas === 'number' ? item.horas_tecnicas : 0,
              horas_coordinacion_pie: typeof item.horas_coordinacion_pie === 'number' ? item.horas_coordinacion_pie : 0,
              horas_convivencia: typeof item.horas_convivencia === 'number' ? item.horas_convivencia : 0,
              horas_extraescolar: typeof item.horas_extraescolar === 'number' ? item.horas_extraescolar : 0,
              es_co_docencia: Boolean(item.es_co_docencia),
              es_taller_sep: Boolean(item.es_taller_sep),
              curso_detectado: inp.curso,
              asignatura_normalizada: item.asignatura_normalizada || inp.activity,
              observaciones_limpias: item.observaciones_limpias || inp.observaciones || '',
              dictamen_ia: item.dictamen_ia || 'Interpretado por Gemini IA',
              confianza: item.confianza || 'ALTA',
            });
          }
        });
      }
    } catch (err) {
      console.warn(`Error en lote de interpretación de notas con IA (${i} a ${i + batchSize}):`, err);
      // Fallback a heurística
      batch.forEach((inp) => {
        const key = `${inp.rut || inp.teacher_name}__${inp.activity}`;
        resultMap.set(key, interpretarNotasDocenteHeuristica(inp));
      });
    }

    if (onProgress) {
      onProgress(Math.min(i + batchSize, inputs.length), inputs.length);
    }
  }

  return resultMap;
}
