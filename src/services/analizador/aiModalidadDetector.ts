import { TipoModalidadEstudio } from '../../types/analizadorTypes';
import { generateGeminiResponse } from '../geminiApiClient';

export interface SchoolModalityDetection {
  rbd: string;
  establishment: string;
  modalidad_sugerida: TipoModalidadEstudio;
  es_polivalente: boolean;
  es_ambigua: boolean;
  especialidades_detectadas: string[];
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
  justificacion: string;
}

export interface CourseModalityDetection {
  raw_course: string;
  modalidad: TipoModalidadEstudio;
  especialidad_tp?: string;
  es_multigrado: boolean;
  es_adultos: boolean;
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
}

/**
 * Detecta la modalidad de un curso a partir de su nombre o actividades relacionadas mediante heurística local.
 */
export function detectarModalidadCursoHeuristica(rawCourse: string, activities: string[] = []): CourseModalityDetection {
  const clean = (rawCourse || '').trim();
  const lower = clean.toLowerCase();
  const actJoined = activities.join(' ').toLowerCase();

  // 1. Adultos / EPJA
  if (/epja|adult|ceia|3ra.*jornada|tercera.*jornada|\bnivel\s*[1-3]\b/i.test(lower) || /alfabetiza|epja/i.test(actJoined)) {
    if (/media|oficio|tp|especialidad/i.test(lower) || /tp|t[eé]cnico/i.test(actJoined)) {
      return {
        raw_course: clean,
        modalidad: 'EPJA_MEDIA_TP',
        es_multigrado: false,
        es_adultos: true,
        confianza: 'ALTA',
      };
    }
    if (/media|hc|humanist/i.test(lower)) {
      return {
        raw_course: clean,
        modalidad: 'EPJA_MEDIA_HC',
        es_multigrado: false,
        es_adultos: true,
        confianza: 'ALTA',
      };
    }
    return {
      raw_course: clean,
      modalidad: 'EPJA_BASICA',
      es_multigrado: false,
      es_adultos: true,
      confianza: 'ALTA',
    };
  }

  // 2. Multigrado Rural
  if (/multigrado|combinado|\b(1|2|3|4|5|6)\s*(a|al|-)\s*(2|3|4|5|6)\b/i.test(lower)) {
    return {
      raw_course: clean,
      modalidad: 'RURAL_MULTIGRADO',
      es_multigrado: true,
      es_adultos: false,
      confianza: 'ALTA',
    };
  }

  // 3. Técnico Profesional (TP)
  const isTpKeywords = /tp|t[eé]cnico|profesional|agro|mec[aá]nic|electr|gastronom|enferm|parvul|contab|administr|forest/i.test(lower) ||
    /m[oó]dulo.*tp|taller.*especialidad|agropecuar|mec[aá]nic/i.test(actJoined);

  if (isTpKeywords && /3|4|tercero|cuarto/i.test(lower)) {
    let esp = 'Técnico Profesional';
    if (/agro/i.test(lower) || /agro/i.test(actJoined)) esp = 'Agropecuaria';
    else if (/mec[aá]nic/i.test(lower) || /mec[aá]nic/i.test(actJoined)) esp = 'Mecánica Industrial';
    else if (/electr/i.test(lower) || /electr/i.test(actJoined)) esp = 'Electricidad';
    else if (/gastron/i.test(lower) || /gastron/i.test(actJoined)) esp = 'Gastronomía';
    else if (/administr/i.test(lower) || /administr/i.test(actJoined)) esp = 'Administración';

    return {
      raw_course: clean,
      modalidad: 'MEDIA_TP',
      especialidad_tp: esp,
      es_multigrado: false,
      es_adultos: false,
      confianza: 'ALTA',
    };
  }

  // 4. Media Regular HC
  if (/(\d+)\s*(?:°|º)?\s*(?:medio|media|m)\b/i.test(lower)) {
    return {
      raw_course: clean,
      modalidad: 'REGULAR_MEDIA_HC',
      es_multigrado: false,
      es_adultos: false,
      confianza: 'ALTA',
    };
  }

  // 5. Especial / Trastornos
  if (/tel|especial|trastorno|lenguaje/i.test(lower)) {
    return {
      raw_course: clean,
      modalidad: 'ESPECIAL',
      es_multigrado: false,
      es_adultos: false,
      confianza: 'ALTA',
    };
  }

  // 6. Básica Regular y Parvularia por defecto
  return {
    raw_course: clean,
    modalidad: 'REGULAR_BASICA',
    es_multigrado: false,
    es_adultos: false,
    confianza: 'ALTA',
  };
}

/**
 * Detecta y consolida la modalidad institucional de un establecimiento educativo a partir de su nómina de cursos y actividades.
 */
export function detectarModalidadEstablecimientoHeuristica(
  rbd: string,
  establishment: string,
  courses: string[],
  activities: string[] = []
): SchoolModalityDetection {
  const estLower = (establishment || '').toLowerCase();
  const courseModalities = courses.map((c) => detectarModalidadCursoHeuristica(c, activities));

  const hasTp = courseModalities.some((c) => c.modalidad === 'MEDIA_TP') || /polit[eé]cnico|industrial|t[eé]cnico/i.test(estLower);
  const hasHc = courseModalities.some((c) => c.modalidad === 'REGULAR_MEDIA_HC') || /liceo/i.test(estLower);
  const hasBasica = courseModalities.some((c) => c.modalidad === 'REGULAR_BASICA') || /escuela/i.test(estLower);
  const hasEpja = courseModalities.some((c) => c.modalidad.startsWith('EPJA')) || /ceia|adultos/i.test(estLower);
  const hasEpjaBasica = courseModalities.some((c) => c.modalidad === 'EPJA_BASICA');
  const hasEpjaMedia = courseModalities.some((c) => c.modalidad === 'EPJA_MEDIA_HC' || c.modalidad === 'EPJA_MEDIA_TP');
  const hasMultigrado = courseModalities.some((c) => c.modalidad === 'RURAL_MULTIGRADO') || /rural/i.test(estLower);
  const hasEspecial = courseModalities.some((c) => c.modalidad === 'ESPECIAL') || /especial/i.test(estLower);

  const especialidades = Array.from(
    new Set(courseModalities.map((c) => c.especialidad_tp).filter(Boolean) as string[])
  );

  // Polivalente: combina TP con HC
  if ((hasTp && hasHc) || /polivalente/i.test(estLower)) {
    return {
      rbd,
      establishment,
      modalidad_sugerida: 'POLIVALENTE_MIXTO',
      es_polivalente: true,
      es_ambigua: true,
      especialidades_detectadas: especialidades,
      confianza: 'ALTA',
      justificacion: 'Establecimiento polivalente con cursos Humanístico-Científicos y Técnico-Profesionales.',
    };
  }

  // Adultos
  if (hasEpja) {
    const sugModalidad: TipoModalidadEstudio = (hasEpjaBasica && !hasEpjaMedia)
      ? 'EPJA_BASICA'
      : (hasTp ? 'EPJA_MEDIA_TP' : 'EPJA_MEDIA_HC');

    return {
      rbd,
      establishment,
      modalidad_sugerida: sugModalidad,
      es_polivalente: false,
      es_ambigua: false,
      especialidades_detectadas: especialidades,
      confianza: 'ALTA',
      justificacion: 'Centro de Educación de Personas Jóvenes y Adultos (EPJA).',
    };
  }

  // Multigrado
  if (hasMultigrado) {
    return {
      rbd,
      establishment,
      modalidad_sugerida: 'RURAL_MULTIGRADO',
      es_polivalente: false,
      es_ambigua: false,
      especialidades_detectadas: [],
      confianza: 'ALTA',
      justificacion: 'Escuela rural con aulas combinadas multigrado.',
    };
  }

  // Media TP Pura
  if (hasTp) {
    return {
      rbd,
      establishment,
      modalidad_sugerida: 'MEDIA_TP',
      es_polivalente: false,
      es_ambigua: false,
      especialidades_detectadas: especialidades,
      confianza: 'ALTA',
      justificacion: 'Liceo Técnico Profesional con especialidades formativas.',
    };
  }

  // Media HC
  if (hasHc && !hasBasica) {
    return {
      rbd,
      establishment,
      modalidad_sugerida: 'REGULAR_MEDIA_HC',
      es_polivalente: false,
      es_ambigua: false,
      especialidades_detectadas: [],
      confianza: 'ALTA',
      justificacion: 'Liceo de Educación Media Humanístico-Científica.',
    };
  }

  // Especial
  if (hasEspecial) {
    return {
      rbd,
      establishment,
      modalidad_sugerida: 'ESPECIAL',
      es_polivalente: false,
      es_ambigua: false,
      especialidades_detectadas: [],
      confianza: 'ALTA',
      justificacion: 'Escuela Especial o de Lenguaje.',
    };
  }

  // Básica Regular
  return {
    rbd,
    establishment,
    modalidad_sugerida: 'REGULAR_BASICA',
    es_polivalente: false,
    es_ambigua: false,
    especialidades_detectadas: [],
    confianza: 'ALTA',
    justificacion: 'Escuela de Educación Parvularia y Básica Regular.',
  };
}

/**
 * Consulta la IA Gemini para validar y auditar las modalidades detectadas si hay ambigüedad o API Key disponible.
 */
export async function auditarModalidadesConIa(
  schools: Array<{ rbd: string; establishment: string; courses: string[] }>,
  apiKey: string,
  modelName: string = 'gemini-3.7-flash'
): Promise<Map<string, SchoolModalityDetection>> {
  const resultMap = new Map<string, SchoolModalityDetection>();

  if (!schools.length) return resultMap;

  if (!apiKey) {
    schools.forEach((s) => {
      resultMap.set(s.rbd || s.establishment, detectarModalidadEstablecimientoHeuristica(s.rbd, s.establishment, s.courses));
    });
    return resultMap;
  }

  const promptText = `
Eres un Auditor del Ministerio de Educación de Chile (MINEDUC / SIGE).
Determina con precisión la modalidad de estudio principal de los siguientes establecimientos escolares del SLEP Valle Diguillín.

Modalidades válidas permitidas:
- "REGULAR_BASICA" (Educación Parvularia y Básica 1° a 8°)
- "REGULAR_MEDIA_HC" (Enseñanza Media Humanístico-Científica)
- "MEDIA_TP" (Enseñanza Media Técnico Profesional)
- "POLIVALENTE_MIXTO" (Liceo con ramas HC y TP simultáneas)
- "EPJA_BASICA" (Adultos Básica - Dto 257)
- "EPJA_MEDIA_HC" (Adultos Media HC - Dto 1000/2110)
- "EPJA_MEDIA_TP" (Adultos Media TP u Oficios)
- "RURAL_MULTIGRADO" (Escuelas rurales multigrado)
- "ESPECIAL" (Escuelas especiales / lenguaje)

Para cada escuela devuelve:
- "rbd": RBD o identificador recibido.
- "modalidad_sugerida": uno de los valores anteriores.
- "es_polivalente": boolean.
- "es_ambigua": true si requiere confirmación humana del usuario por cursos mixtos.
- "especialidades_detectadas": array de especialidades TP si aplica (ej: ["Agropecuaria", "Mecánica"]).
- "justificacion": breve explicación técnica.

Establecimientos y cursos:
${JSON.stringify(schools, null, 2)}

Responde ÚNICAMENTE un array JSON válido con la estructura solicitada.
`;

  try {
    const response = await generateGeminiResponse(promptText, apiKey, modelName);
    const cleanJson = response.trim().replace(/^```json\s*/, '').replace(/\s*```$/, '');
    const parsedArray: any[] = JSON.parse(cleanJson);

    if (Array.isArray(parsedArray)) {
      parsedArray.forEach((item) => {
        if (item && item.rbd) {
          resultMap.set(item.rbd, {
            rbd: item.rbd,
            establishment: item.establishment || item.rbd,
            modalidad_sugerida: item.modalidad_sugerida || 'REGULAR_BASICA',
            es_polivalente: Boolean(item.es_polivalente),
            es_ambigua: Boolean(item.es_ambigua),
            especialidades_detectadas: item.especialidades_detectadas || [],
            confianza: 'ALTA',
            justificacion: item.justificacion || 'Dictamen IA MINEDUC',
          });
        }
      });
    }
  } catch (err) {
    console.warn('Error en auditoría de modalidades con IA:', err);
    schools.forEach((s) => {
      resultMap.set(s.rbd || s.establishment, detectarModalidadEstablecimientoHeuristica(s.rbd, s.establishment, s.courses));
    });
  }

  // Fallback para los que hayan faltado
  schools.forEach((s) => {
    const key = s.rbd || s.establishment;
    if (!resultMap.has(key)) {
      resultMap.set(key, detectarModalidadEstablecimientoHeuristica(s.rbd, s.establishment, s.courses));
    }
  });

  return resultMap;
}
