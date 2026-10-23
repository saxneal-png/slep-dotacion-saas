import { TipoFuncionFueraAula } from '../../types/analizadorTypes';
import { generateGeminiResponse } from '../geminiApiClient';
import { createDeterministicPiiVault } from '../../utils/piiSovereigntySanitizer';

export interface InterpretedTeacherNote {
  raw_text: string;
  nombres?: string;
  apellidos?: string;
  horas_aula?: number;
  horas_directivas?: number;
  horas_tecnicas?: number;
  horas_jefatura?: number;
  horas_utp?: number;
  horas_coordinacion_pie?: number;
  horas_convivencia?: number;
  horas_cra_enlaces?: number;
  horas_extraescolar?: number;
  horas_no_lectivas?: number;
  tipo_funcion_fuera_aula: TipoFuncionFueraAula;
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
 * Heurística rápida local para interpretar notas docentes y funciones fuera de aula sin consumir tokens.
 */
export function interpretarNotasDocenteHeuristica(input: TeacherNoteInput): InterpretedTeacherNote {
  const text = `${input.activity} ${input.observaciones || ''}`.trim();
  const lower = text.toLowerCase();

  let horasDirectivas = 0;
  let horasTecnicas = 0;
  let horasJefatura = 0;
  let horasUtp = 0;
  let horasPie = 0;
  let horasConvivencia = 0;
  let horasCraEnlaces = 0;
  let horasExtraescolar = 0;
  let horasNoLectivas = 0;
  let esCoDocencia = false;
  let esTallerSep = false;
  let cursoDetectado = input.curso;
  let asignaturaNormalizada = input.activity;
  let tipoFuncion: TipoFuncionFueraAula = 'AULA_REGULAR';

  // 1. Detección de Co-Docencia
  if (/co.*docenc|docenc.*compartida/i.test(lower)) {
    esCoDocencia = true;
    tipoFuncion = 'CO_DOCENCIA_PIE';
  }

  // 2. Detección de Talleres SEP
  if (/taller.*sep|extraesc.*sep|\bsep\b/i.test(lower)) {
    esTallerSep = true;
  }

  // 3. Jefatura de Curso
  if (/jefatura.*curso|profesor.*jefe|profesora.*jefe|\bjefatura\b/i.test(lower)) {
    horasJefatura = input.hours;
    horasTecnicas = input.hours;
    tipoFuncion = 'JEFATURA_CURSO';
    asignaturaNormalizada = 'Jefatura de Curso';
  }
  // 4. Profesor / Docente Encargado de Escuela Rural
  else if (/profesor.*encargado|docente.*encargado|encargad.*escuela|microcentro/i.test(lower)) {
    horasDirectivas = input.hours;
    tipoFuncion = 'DOCENTE_ENCARGADO_RURAL';
    asignaturaNormalizada = 'Profesor Encargado de Escuela Rural';
  }
  // 5. Funciones Directivas Superiores DFL 1
  else if (/director|subdirector|inspector.*general|rector/i.test(lower)) {
    horasDirectivas = input.hours;
    tipoFuncion = 'DIRECTIVA_SUPERIOR';
    asignaturaNormalizada = 'Función Directiva Institucional';
  }
  // 6. UTP / Currículum / Evaluación
  else if (/jefe.*utp|jefatura.*utp|\butp\b|tecnico.*pedag|evaluador|curricul/i.test(lower)) {
    horasUtp = input.hours;
    horasTecnicas = input.hours;
    tipoFuncion = 'UTP_CURRICULUM_EVALUACION';
    asignaturaNormalizada = 'Unidad Técnico Pedagógica (UTP)';
  }
  // 7. Coordinación PIE (Dec. 170)
  else if (/coordinad.*pie|coordinacion.*pie/i.test(lower)) {
    horasPie = input.hours;
    horasTecnicas = input.hours;
    tipoFuncion = 'COORDINACION_PIE';
    asignaturaNormalizada = 'Coordinación PIE (Dec. 170)';
  }
  // 8. Convivencia Escolar / Orientación
  else if (/convivencia|orientador|orientadora|dupla/i.test(lower)) {
    horasConvivencia = input.hours;
    horasTecnicas = input.hours;
    tipoFuncion = 'CONVIVENCIA_ORIENTACION';
    asignaturaNormalizada = 'Convivencia Escolar / Orientación';
  }
  // 9. CRA / Biblioteca
  else if (/cra\b|biblioteca|recursos.*aprendizaje/i.test(lower)) {
    horasCraEnlaces = input.hours;
    horasTecnicas = input.hours;
    tipoFuncion = 'CRA_BIBLIOTECA';
    asignaturaNormalizada = 'Encargado(a) CRA / Biblioteca';
  }
  // 10. Enlaces / TIC
  else if (/enlaces|computaci[oó]n|tic\b|inform[aá]tica/i.test(lower)) {
    horasCraEnlaces = input.hours;
    horasTecnicas = input.hours;
    tipoFuncion = 'ENLACES_TIC';
    asignaturaNormalizada = 'Coordinación Enlaces / TIC';
  }
  // 11. Extraescolar / ACLE / Deportes
  else if (/extraescolar|\bacle\b|deport/i.test(lower)) {
    horasExtraescolar = input.hours;
    horasTecnicas = input.hours;
    tipoFuncion = 'EXTRAESCOLAR_DEPORTES';
    asignaturaNormalizada = 'Coordinación Extraescolar y Deportes';
  }
  // 12. No Lectivas Art 69 / Preparación de clases
  else if (/art.*69|no.*lectiv|preparaci[oó]n.*clase|recreo/i.test(lower)) {
    horasNoLectivas = input.hours;
    tipoFuncion = 'NO_LECTIVA_PREPARACION';
    asignaturaNormalizada = 'Horas No Lectivas (Art. 69)';
  }

  const esFueraDeAula = horasDirectivas > 0 || horasTecnicas > 0 || horasNoLectivas > 0;

  return {
    raw_text: text,
    horas_aula: esFueraDeAula ? 0 : input.hours,
    horas_directivas: horasDirectivas,
    horas_tecnicas: horasTecnicas,
    horas_jefatura: horasJefatura,
    horas_utp: horasUtp,
    horas_coordinacion_pie: horasPie,
    horas_convivencia: horasConvivencia,
    horas_cra_enlaces: horasCraEnlaces,
    horas_extraescolar: horasExtraescolar,
    horas_no_lectivas: horasNoLectivas,
    tipo_funcion_fuera_aula: tipoFuncion,
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
 * Interpreta notas y observaciones docentes en lote utilizando Google Gemini AI con clasificación granular de funciones fuera de aula.
 */
export async function interpretarNotasDocentesConIa(
  inputs: TeacherNoteInput[],
  apiKey: string,
  modelName: string = 'gemini-3.7-flash',
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, InterpretedTeacherNote>> {
  const resultMap = new Map<string, InterpretedTeacherNote>();
  if (!inputs.length) return resultMap;

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
    const vault = createDeterministicPiiVault(batch.map(b => ({ run: b.rut, teacher_name: b.teacher_name })));

    const sanitizedBatch = batch.map((b, idx) => ({
      index: idx,
      rut: vault.anonymizeText(b.rut),
      teacher_name: vault.anonymizeText(b.teacher_name),
      activity: vault.anonymizeText(b.activity),
      hours: b.hours,
      curso: b.curso,
      observaciones: vault.anonymizeText(b.observaciones || ''),
    }));

    const promptText = `
Eres un Auditor Experto en Dotación Docente y Normativa Escolar Chilena (MINEDUC, Ley 20.903, DFL 1/1996, Dec. 170 PIE, Ley SEP 20.248).
Analiza el siguiente lote de actividades y notas docentes extraídas de planillas escolares del SLEP Valle Diguillín.

Para cada elemento del lote, clasifica con precisión la función y devuelve un objeto JSON con:
- "index": índice correspondiente en la lista.
- "horas_aula": horas lectivas reales frente a alumnos en aula regular (number).
- "horas_directivas": horas de Dirección, Subdirección o Inspectoría General (number).
- "horas_tecnicas": horas técnicas de UTP, Coordinación, Orientación o CRA (number).
- "horas_jefatura": horas no lectivas asignadas a jefatura de curso (number).
- "horas_utp": horas de Jefe de UTP, Currículum o Evaluación (number).
- "horas_coordinacion_pie": horas de Coordinación PIE Dto 170 (number).
- "horas_convivencia": horas de Convivencia Escolar u Orientación (number).
- "horas_cra_enlaces": horas de CRA o Enlaces / TIC (number).
- "horas_extraescolar": horas de Coordinación Extraescolar o Deportes (number).
- "horas_no_lectivas": horas no lectivas de preparación o recreos (number).
- "tipo_funcion_fuera_aula": uno de ["AULA_REGULAR", "CO_DOCENCIA_PIE", "JEFATURA_CURSO", "UTP_CURRICULUM_EVALUACION", "COORDINACION_PIE", "CONVIVENCIA_ORIENTACION", "CRA_BIBLIOTECA", "ENLACES_TIC", "EXTRAESCOLAR_DEPORTES", "DOCENTE_ENCARGADO_RURAL", "DIRECTIVA_SUPERIOR", "NO_LECTIVA_PREPARACION", "OTRA_NO_LECTIVA"].
- "es_co_docencia": true si corresponde a co-docencia / docencia compartida en aula (boolean).
- "es_taller_sep": true si corresponde a taller extracurricular SEP o JEC (boolean).
- "asignatura_normalizada": nombre oficial y limpio de la asignatura o función institucional (string).
- "observaciones_limpias": resumen depurado y profesional de cualquier nota de reemplazo, licencia o condicionante (string).
- "dictamen_ia": breve justificación técnica normativa (string).
- "confianza": "ALTA" | "MEDIA" | "BAJA".

Datos a analizar:
${JSON.stringify(sanitizedBatch, null, 2)}

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
              horas_jefatura: typeof item.horas_jefatura === 'number' ? item.horas_jefatura : 0,
              horas_utp: typeof item.horas_utp === 'number' ? item.horas_utp : 0,
              horas_coordinacion_pie: typeof item.horas_coordinacion_pie === 'number' ? item.horas_coordinacion_pie : 0,
              horas_convivencia: typeof item.horas_convivencia === 'number' ? item.horas_convivencia : 0,
              horas_cra_enlaces: typeof item.horas_cra_enlaces === 'number' ? item.horas_cra_enlaces : 0,
              horas_extraescolar: typeof item.horas_extraescolar === 'number' ? item.horas_extraescolar : 0,
              horas_no_lectivas: typeof item.horas_no_lectivas === 'number' ? item.horas_no_lectivas : 0,
              tipo_funcion_fuera_aula: item.tipo_funcion_fuera_aula || 'AULA_REGULAR',
              es_co_docencia: Boolean(item.es_co_docencia),
              es_taller_sep: Boolean(item.es_taller_sep),
              curso_detectado: inp.curso,
              asignatura_normalizada: vault.deanonimizeText(item.asignatura_normalizada || inp.activity),
              observaciones_limpias: vault.deanonimizeText(item.observaciones_limpias || inp.observaciones || ''),
              dictamen_ia: vault.deanonimizeText(item.dictamen_ia || 'Interpretado por Gemini IA'),
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
