import { generateGeminiResponse } from '../geminiApiClient';

export interface NormalizedCourseResult {
  raw_course: string;
  nivel_normalizado: string; // Ej: '1° Básico', 'NT1', '4° Medio TP', 'Multigrado (1°-6°)'
  letra_normalizada: string; // Ej: 'A', 'B', 'U' (Única)
  es_multigrado: boolean;
  es_tp: boolean;
  es_pie_especial: boolean;
  codigo_sige_sugerido?: string;
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
}

/**
 * Normaliza nombres de cursos utilizando heurísticas y expresiones regulares del MINEDUC chileno.
 */
export function normalizarCursoHeuristica(rawCourse: string): NormalizedCourseResult {
  const clean = (rawCourse || '').trim();
  const lower = clean.toLowerCase();

  let nivel = clean;
  let letra = 'A';
  let esMultigrado = false;
  let esTp = false;
  let esPieEspecial = false;

  if (!clean) {
    return {
      raw_course: clean,
      nivel_normalizado: 'Sin Asignar',
      letra_normalizada: 'A',
      es_multigrado: false,
      es_tp: false,
      es_pie_especial: false,
      confianza: 'BAJA',
    };
  }

  // Multigrado
  if (/multigrado|combinado|\b(1|2|3|4|5|6)\s*(a|al|-)\s*(2|3|4|5|6)\b/i.test(lower)) {
    esMultigrado = true;
    const match = clean.match(/(\d+)\s*(?:a|al|-)\s*(\d+)/i);
    if (match) {
      nivel = `Multigrado (${match[1]}°- ${match[2]}° Básico)`;
    } else {
      nivel = 'Multigrado Rural';
    }
    letra = 'U';
  }
  // Educación Parvularia
  else if (/pre-?k[ií]nder|nt1|primer.*transici[oó]n|1.*transici[oó]n/i.test(lower)) {
    nivel = 'NT1 (Pre-Kínder)';
  } else if (/k[ií]nder|nt2|segundo.*transici[oó]n|2.*transici[oó]n/i.test(lower)) {
    nivel = 'NT2 (Kínder)';
  }
  // Educación Básica
  else if (/(\d+)\s*(?:°|º|ero|do|to|ro|vo|no)?\s*(?:b[aá]sico|b[aá]sica|b)/i.test(lower)) {
    const numMatch = lower.match(/(\d+)\s*(?:°|º|ero|do|to|ro|vo|no)?\s*(?:b[aá]sico|b[aá]sica|b)/i);
    const num = numMatch ? numMatch[1] : '1';
    nivel = `${num}° Básico`;
  }
  // Educación Media
  else if (/(\d+)\s*(?:°|º|ero|do|to|ro)?\s*(?:medio|media|m)/i.test(lower)) {
    const numMatch = lower.match(/(\d+)\s*(?:°|º|ero|do|to|ro)?\s*(?:medio|media|m)/i);
    const num = numMatch ? numMatch[1] : '1';
    if (/tp|t[eé]cnico|profesional|agro|mecanica|contab/i.test(lower)) {
      esTp = true;
      nivel = `${num}° Medio TP`;
    } else {
      nivel = `${num}° Medio HC`;
    }
  }

  // Detección de Letra (A, B, C, D, etc.) solo si no es multigrado
  if (!esMultigrado) {
    const letraMatch = clean.match(/(?:^|\s|-)([A-G])(?:\s|$)/i);
    if (letraMatch && !/\b[1-8]\s*a\s*[1-8]\b/i.test(clean)) {
      letra = letraMatch[1].toUpperCase();
    }
  }

  // Detección de Educación Especial / PIE
  if (/tel|lenguaje|especial|trastorno/i.test(lower)) {
    esPieEspecial = true;
  }

  return {
    raw_course: clean,
    nivel_normalizado: nivel,
    letra_normalizada: letra,
    es_multigrado: esMultigrado,
    es_tp: esTp,
    es_pie_especial: esPieEspecial,
    confianza: 'MEDIA',
  };
}

/**
 * Normaliza una lista de cursos escolares utilizando Google Gemini AI con fallback heurístico.
 */
export async function normalizarCursosConIa(
  rawCourses: string[],
  apiKey: string,
  modelName: string = 'gemini-3.7-flash',
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, NormalizedCourseResult>> {
  const resultMap = new Map<string, NormalizedCourseResult>();
  const uniqueCourses = Array.from(new Set(rawCourses.map((c) => (c || '').trim()).filter(Boolean)));

  if (!uniqueCourses.length) return resultMap;

  if (!apiKey) {
    uniqueCourses.forEach((c, idx) => {
      resultMap.set(c, normalizarCursoHeuristica(c));
      if (onProgress) onProgress(idx + 1, uniqueCourses.length);
    });
    return resultMap;
  }

  const batchSize = 25;
  for (let i = 0; i < uniqueCourses.length; i += batchSize) {
    const batch = uniqueCourses.slice(i, i + batchSize);

    const promptText = `
Eres un Auditor del Sistema de Información General de Estudiantes (SIGE / MINEDUC) de Chile.
Tu tarea es estandarizar y clasificar los siguientes nombres de cursos escolares extraídos de planillas docentes del SLEP Valle Diguillín.

Para cada curso del lote, devuelve un objeto JSON con:
- "raw_course": el texto original exacto.
- "nivel_normalizado": nombre oficial del nivel educativo chileno (ejemplos: "NT1 (Pre-Kínder)", "NT2 (Kínder)", "1° Básico", "8° Básico", "1° Medio HC", "3° Medio TP", "Multigrado (1°-4° Básico)", "Educación Especial").
- "letra_normalizada": letra del curso ("A", "B", "C", o "U" para multigrado/única).
- "es_multigrado": true si es un aula multigrado rural combinada.
- "es_tp": true si es Técnico Profesional.
- "es_pie_especial": true si es aula especial o escuela de lenguaje.
- "confianza": "ALTA" | "MEDIA" | "BAJA".

Cursos a normalizar:
${JSON.stringify(batch, null, 2)}

Responde ÚNICAMENTE un array JSON válido con la estructura solicitada, sin explicaciones ni markdown envolvente.
`;

    try {
      const response = await generateGeminiResponse(promptText, apiKey, modelName);
      const cleanJson = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
      const parsedArray: any[] = JSON.parse(cleanJson);

      if (Array.isArray(parsedArray)) {
        parsedArray.forEach((item) => {
          if (item && item.raw_course) {
            resultMap.set(item.raw_course, {
              raw_course: item.raw_course,
              nivel_normalizado: item.nivel_normalizado || item.raw_course,
              letra_normalizada: item.letra_normalizada || 'A',
              es_multigrado: Boolean(item.es_multigrado),
              es_tp: Boolean(item.es_tp),
              es_pie_especial: Boolean(item.es_pie_especial),
              confianza: item.confianza || 'ALTA',
            });
          }
        });
      }
    } catch (err) {
      console.warn(`Error en normalización de cursos con IA (${i} a ${i + batchSize}):`, err);
      // Fallback a heurística
      batch.forEach((c) => {
        resultMap.set(c, normalizarCursoHeuristica(c));
      });
    }

    // Completar cualquier curso que la IA haya omitido en la respuesta
    batch.forEach((c) => {
      if (!resultMap.has(c)) {
        resultMap.set(c, normalizarCursoHeuristica(c));
      }
    });

    if (onProgress) {
      onProgress(Math.min(i + batchSize, uniqueCourses.length), uniqueCourses.length);
    }
  }

  return resultMap;
}
