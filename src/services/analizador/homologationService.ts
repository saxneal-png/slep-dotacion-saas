import { TeacherRecord, TeacherConsolidatedLoad, HomologacionItem, TipoHoraInstitucional } from '../../types/analizadorTypes';

/**
 * Asignaturas oficiales agrupadas por nivel según Decretos y Bases Curriculares MINEDUC.
 */
export const ASIGNATURAS_OFICIALES_POR_NIVEL: Record<string, string[]> = {
  parvularia: [
    'Ámbito Comunicación Integral',
    'Ámbito Desarrollo Personal y Social',
    'Ámbito Interacción y Comprensión del Entorno',
    'Experiencias de Aprendizaje Integradas',
    'Apoyo PIE / Codocencia',
    'Talleres JEC / Libre Disposición',
  ],
  basica_1_6: [
    'Lenguaje y Comunicación',
    'Matemática',
    'Historia, Geografía y Ciencias Sociales',
    'Ciencias Naturales',
    'Idioma Extranjero: Inglés',
    'Artes Visuales',
    'Música',
    'Educación Física y Salud',
    'Tecnología',
    'Orientación',
    'Religión',
    'Apoyo PIE / Codocencia',
    'Talleres JEC / Libre Disposición',
  ],
  basica_7_8: [
    'Lengua y Literatura',
    'Matemática',
    'Historia, Geografía y Ciencias Sociales',
    'Ciencias Naturales',
    'Idioma Extranjero: Inglés',
    'Artes Visuales y Música',
    'Educación Física y Salud',
    'Tecnología',
    'Orientación',
    'Religión',
    'Apoyo PIE / Codocencia',
    'Talleres JEC / Libre Disposición',
  ],
  media_1_2: [
    'Lengua y Literatura',
    'Matemática',
    'Historia, Geografía y Ciencias Sociales',
    'Ciencias Naturales',
    'Idioma Extranjero: Inglés',
    'Artes Visuales o Música',
    'Educación Física y Salud',
    'Tecnología',
    'Orientación',
    'Religión',
    'Apoyo PIE / Codocencia',
    'Talleres JEC / Libre Disposición',
  ],
  media_3_4: [
    'Lengua y Literatura',
    'Matemática',
    'Educación Ciudadana',
    'Filosofía',
    'Inglés',
    'Ciencias para la Ciudadanía',
    'Electivo Común (Religión/Historia/Artes/Ed.Física)',
    'Formación Diferenciada TP',
    'Formación Diferenciada HC',
    'Apoyo PIE / Codocencia',
    'Talleres JEC / Libre Disposición',
  ],
  general: [
    'Docencia de Aula General',
    'Apoyo PIE / Codocencia',
    'Talleres JEC / Libre Disposición',
    'Funciones Institucionales / No Lectivas',
  ]
};

/**
 * Obtiene la lista de asignaturas oficiales sugeridas para un curso o nivel determinado.
 */
export function getAsignaturasSugeridasParaNivel(nivel: string): string[] {
  const n = (nivel || '').toLowerCase();
  if (n.includes('pre-k') || n.includes('kínder') || n.includes('kinder') || n.includes('nt1') || n.includes('nt2') || n.includes('parv')) {
    return ASIGNATURAS_OFICIALES_POR_NIVEL.parvularia;
  }
  if (n.includes('7°') || n.includes('8°') || n.includes('7o') || n.includes('8o')) {
    return ASIGNATURAS_OFICIALES_POR_NIVEL.basica_7_8;
  }
  if (n.includes('1° b') || n.includes('2° b') || n.includes('3° b') || n.includes('4° b') || n.includes('5° b') || n.includes('6° b') || n.includes('básico') || n.includes('basico')) {
    return ASIGNATURAS_OFICIALES_POR_NIVEL.basica_1_6;
  }
  if (n.includes('1° m') || n.includes('2° m') || n.includes('1° medio') || n.includes('2° medio')) {
    return ASIGNATURAS_OFICIALES_POR_NIVEL.media_1_2;
  }
  if (n.includes('3° m') || n.includes('4° m') || n.includes('3° medio') || n.includes('4° medio')) {
    return ASIGNATURAS_OFICIALES_POR_NIVEL.media_3_4;
  }
  // Lista integral completa por defecto
  return Array.from(new Set([
    ...ASIGNATURAS_OFICIALES_POR_NIVEL.basica_1_6,
    ...ASIGNATURAS_OFICIALES_POR_NIVEL.basica_7_8,
    ...ASIGNATURAS_OFICIALES_POR_NIVEL.media_3_4,
    ...ASIGNATURAS_OFICIALES_POR_NIVEL.parvularia,
    ...ASIGNATURAS_OFICIALES_POR_NIVEL.general,
  ]));
}

function normalizeStr(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Homologación heurística por reglas normativas chilenas MINEDUC.
 */
export function homologarAsignaturaPorRegla(
  rawSubject: string,
  nivel: string
): {
  asignaturaOficial: string;
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
  justificacion: string;
  tipoHoraInstitucional?: TipoHoraInstitucional;
  esDirectivo?: boolean;
  esTecnicoPedagogico?: boolean;
  esCoordinacionPie?: boolean;
  esConvivencia?: boolean;
  esExtraescolar?: boolean;
  esCoDocencia?: boolean;
  esAgrupacionFlexible?: boolean;
  esTallerJec?: boolean;
  esTallerSep?: boolean;
  esPie?: boolean;
  esProporcionDocente?: boolean;
} {
  const norm = normalizeStr(rawSubject);
  const normNivel = normalizeStr(nivel);

  const esParvularia = normNivel.includes('nt1') || normNivel.includes('nt2') || normNivel.includes('k') || normNivel.includes('parv');
  const esMediaO78 = normNivel.includes('7') || normNivel.includes('8') || normNivel.includes('med');

  // 1. Cargos y Funciones Directivas (Director, Subdirector, Inspector General, Profesor Encargado)
  if (/subdirector|subdireccion|sub-director/i.test(norm)) {
    return {
      asignaturaOficial: 'Función Directiva: Subdirección',
      confianza: 'ALTA',
      justificacion: 'Cargo directivo institucional según Estatuto Docente y dotación SLEP',
      tipoHoraInstitucional: 'DIRECTIVA',
      esDirectivo: true
    };
  }
  if (/inspector.*general|inspeccion.*general/i.test(norm)) {
    return {
      asignaturaOficial: 'Función Directiva: Inspectoría General',
      confianza: 'ALTA',
      justificacion: 'Cargo directivo de inspectoría general según Estatuto Docente',
      tipoHoraInstitucional: 'DIRECTIVA',
      esDirectivo: true
    };
  }
  if (/profesor.*encargado|docente.*encargado|prof.*encargado/i.test(norm)) {
    return {
      asignaturaOficial: 'Función Directiva: Profesor Encargado',
      confianza: 'ALTA',
      justificacion: 'Dirección y gestión de establecimiento rural / unidocente',
      tipoHoraInstitucional: 'DIRECTIVA',
      esDirectivo: true
    };
  }
  if (/^director|direccion\b|directiv/i.test(norm) && !/coro|orquesta|banda/i.test(norm)) {
    return {
      asignaturaOficial: 'Función Directiva: Dirección',
      confianza: 'ALTA',
      justificacion: 'Cargo directivo superior del establecimiento educacional',
      tipoHoraInstitucional: 'DIRECTIVA',
      esDirectivo: true
    };
  }

  // 2. Funciones Técnico-Pedagógicas (Jefe UTP, Currículum, Evaluación)
  if (/jefe.*utp|jefatura.*utp|\butp\b|tecnico.*pedag|\bcurricul|evaluador|evaluacion.*pedag/i.test(norm)) {
    return {
      asignaturaOficial: 'Función Técnico-Pedagógica: Jefatura UTP',
      confianza: 'ALTA',
      justificacion: 'Unidad Técnico Pedagógica (UTP) según Estatuto Docente',
      tipoHoraInstitucional: 'TECNICO_PEDAGOGICA',
      esTecnicoPedagogico: true
    };
  }

  // 3. Coordinaciones Institucionales (PIE, Convivencia Escolar, Extraescolar)
  if (/coordinad.*pie|coordinacion.*pie/i.test(norm)) {
    return {
      asignaturaOficial: 'Coordinación PIE (Decreto 170)',
      confianza: 'ALTA',
      justificacion: 'Coordinación técnica del Programa de Integración Escolar (Decreto 170)',
      tipoHoraInstitucional: 'COORDINACION_PIE',
      esCoordinacionPie: true,
      esPie: true
    };
  }
  if (/convivencia|coordinad.*convivencia|encargad.*convivencia/i.test(norm)) {
    return {
      asignaturaOficial: 'Coordinación de Convivencia Escolar',
      confianza: 'ALTA',
      justificacion: 'Encargado/Coordinador de Convivencia Escolar (Ley 20.536 / PME)',
      tipoHoraInstitucional: 'CONVIVENCIA',
      esConvivencia: true
    };
  }
  if (/extraescolar|coordinad.*extraescolar|encargad.*extraescolar|\bacle\b/i.test(norm)) {
    return {
      asignaturaOficial: 'Coordinación Extraescolar / ACLE',
      confianza: 'ALTA',
      justificacion: 'Coordinación de actividades extraescolares y deportivas institucionales',
      tipoHoraInstitucional: 'EXTRAESCOLAR',
      esExtraescolar: true
    };
  }
  if (/coordinad.*cra|encargad.*cra|\bcra\b|enlaces|computacion.*coordinad/i.test(norm)) {
    return {
      asignaturaOficial: 'Coordinación CRA / Enlaces',
      confianza: 'ALTA',
      justificacion: 'Coordinación del Centro de Recursos del Aprendizaje (CRA) / Informática',
      tipoHoraInstitucional: 'CONVIVENCIA'
    };
  }

  // 4. Apoyos Pedagógicos en Aula: Co-docencia y Agrupaciones Flexibles
  if (/co.*docenc|co docenc|codocenc|docenc.*compartida/i.test(norm)) {
    return {
      asignaturaOficial: 'Apoyo PIE / Codocencia',
      confianza: 'ALTA',
      justificacion: 'Trabajo colaborativo y apoyo pedagógico en aula regular (PIE - Dec. 170)',
      tipoHoraInstitucional: 'CO_DOCENCIA',
      esCoDocencia: true,
      esPie: true
    };
  }
  if (/agrupaci[oó]n.*flexible|agrupaciones.*flexibles|grupo.*flexible|refuerzo.*pedag[oó]gico/i.test(norm)) {
    return {
      asignaturaOficial: 'Agrupaciones Flexibles / Refuerzo Pedagógico',
      confianza: 'ALTA',
      justificacion: 'Estrategia pedagógica de diversificación y agrupamiento flexible (Decreto 67 / PME)',
      tipoHoraInstitucional: 'AGRUPACION_FLEXIBLE',
      esAgrupacionFlexible: true
    };
  }

  // 5. Proporciones Docentes: Recreos, Horas No Lectivas (HL), 65/35 o 60/40 (Ley 20.903)
  if (/recreo|hl\b|h\.l\.|no lectiv|proporci[oó]n|art.*69|gestion pedag/i.test(norm)) {
    return {
      asignaturaOficial: 'Proporción Docente (Recreo / No Lectiva 65/35 o 60/40)',
      confianza: 'ALTA',
      justificacion: 'Horas no lectivas / recreo según proporción de contrato docente (Ley 20.903)',
      esProporcionDocente: true,
    };
  }

  // 6. Talleres SEP Extracurriculares (Financiados por SEP, no imputables a plan de estudio regular)
  if (/sep|taller.*sep|refuerzo.*sep|extraesc.*sep/i.test(norm)) {
    return {
      asignaturaOficial: 'Taller Extracurricular SEP',
      confianza: 'ALTA',
      justificacion: 'Taller financiado por Subvención Escolar Preferencial (SEP), extracurricular no imputable al plan regular',
      esTallerSep: true,
    };
  }

  // 7. Apoyo PIE / Diferencial general
  if (/pie|diferenc|recurso|integrac|fonoaudi|psico|terap/i.test(norm)) {
    return {
      asignaturaOficial: 'Apoyo PIE / Codocencia',
      confianza: 'ALTA',
      justificacion: 'Función asociada al Programa de Integración Escolar (PIE - Dec. 170)',
      esPie: true,
    };
  }

  // 4. Talleres JEC / Libre Disposición (debe evaluarse antes de materias específicas si es taller)
  if (/^taller|aele|reforz|extraesc|patrimon|ajedrez|medioamb|huert|libre disposici/i.test(norm)) {
    return {
      asignaturaOficial: 'Talleres JEC / Libre Disposición',
      confianza: 'ALTA',
      justificacion: 'Horas de libre disposición pedagógica JEC',
      esTallerJec: true,
    };
  }

  // 5. Educación Física y Salud (debe evaluarse antes de física de ciencias)
  if (/ed.*f[ií]s|e\.?\s*f\.?|educaci[oó]n f[ií]sica|gimnas|deport|corporal|motricidad/i.test(norm)) {
    return { asignaturaOficial: 'Educación Física y Salud', confianza: 'ALTA', justificacion: 'Sector Educación Física y Salud MINEDUC' };
  }

  // 4. Parvularia
  if (esParvularia) {
    if (/comunic|lengu|verbal|lect/i.test(norm)) {
      return { asignaturaOficial: 'Ámbito Comunicación Integral', confianza: 'ALTA', justificacion: 'Bases Curriculares Educación Parvularia' };
    }
    if (/personal|social|autonom|conviv|motri/i.test(norm)) {
      return { asignaturaOficial: 'Ámbito Desarrollo Personal y Social', confianza: 'ALTA', justificacion: 'Bases Curriculares Educación Parvularia' };
    }
    if (/entorno|natural|sociedad|pensamiento|matem/i.test(norm)) {
      return { asignaturaOficial: 'Ámbito Interacción y Comprensión del Entorno', confianza: 'ALTA', justificacion: 'Bases Curriculares Educación Parvularia' };
    }
    return { asignaturaOficial: 'Experiencias de Aprendizaje Integradas', confianza: 'MEDIA', justificacion: 'Núcleo integrado de Educación Parvularia' };
  }

  // 5. Lenguaje / Lengua y Literatura
  if (/^leng|^castellano|lengua|literatura|lectura|comprension lectora/i.test(norm)) {
    const oficial = esMediaO78 ? 'Lengua y Literatura' : 'Lenguaje y Comunicación';
    return { asignaturaOficial: oficial, confianza: 'ALTA', justificacion: `Plan de estudio oficial MINEDUC para ${nivel || 'Educación Básica/Media'}` };
  }

  // 6. Matemática
  if (/^mat|algebra|geometr|aritmet|calculo/i.test(norm)) {
    return { asignaturaOficial: 'Matemática', confianza: 'ALTA', justificacion: 'Plan común obligatorio MINEDUC' };
  }

  // 7. Historia / Ciencias Sociales
  if (/^hist|geograf|sociedad|cs\.?\s*soc/i.test(norm)) {
    return { asignaturaOficial: 'Historia, Geografía y Ciencias Sociales', confianza: 'ALTA', justificacion: 'Plan común obligatorio MINEDUC' };
  }

  // 8. Ciencias Naturales / Biología / Química / Física (sin confundir con ed. física)
  if (/^cien|c\.?\s*nat|natural|biolog|quimic|^(fisica|ciencias fisicas)/i.test(norm)) {
    return { asignaturaOficial: 'Ciencias Naturales', confianza: 'ALTA', justificacion: 'Plan común obligatorio MINEDUC' };
  }

  // 9. Idioma Extranjero: Inglés
  if (/^ingl|idioma|foreign/i.test(norm)) {
    return { asignaturaOficial: 'Idioma Extranjero: Inglés', confianza: 'ALTA', justificacion: 'Subsector oficial Idioma Extranjero' };
  }

  // 10. Artes Visuales
  if (/^art|plastica|visual/i.test(norm)) {
    const oficial = (normNivel.includes('7') || normNivel.includes('8')) ? 'Artes Visuales y Música' : 'Artes Visuales';
    return { asignaturaOficial: oficial, confianza: 'ALTA', justificacion: 'Sector Artístico MINEDUC' };
  }

  // 11. Música
  if (/^mus|musical|sonor/i.test(norm)) {
    const oficial = (normNivel.includes('7') || normNivel.includes('8')) ? 'Artes Visuales y Música' : 'Música';
    return { asignaturaOficial: oficial, confianza: 'ALTA', justificacion: 'Sector Musical MINEDUC' };
  }

  // 12. Tecnología
  if (/^tecn|computac|inform|robotic/i.test(norm)) {
    return { asignaturaOficial: 'Tecnología', confianza: 'ALTA', justificacion: 'Sector Tecnología MINEDUC' };
  }

  // 13. Orientación / Jefatura
  if (/orientac|jefat|consejo|tutor/i.test(norm)) {
    return { asignaturaOficial: 'Orientación', confianza: 'ALTA', justificacion: 'Hora de Orientación y Consejo de Curso' };
  }

  // 14. Religión
  if (/relig|catol|evang|moral|espirit/i.test(norm)) {
    return { asignaturaOficial: 'Religión', confianza: 'ALTA', justificacion: 'Sector Religión (optativo según normativa)' };
  }

  // 15. Filosofía (Media)
  if (/filosof|pensamiento crit/i.test(norm)) {
    return { asignaturaOficial: 'Filosofía', confianza: 'ALTA', justificacion: 'Plan común formación general 3° y 4° Medio' };
  }

  // 16. Formación Ciudadana / Educación Ciudadana
  if (/ciudadan|formacion c/i.test(norm)) {
    return { asignaturaOficial: 'Educación Ciudadana', confianza: 'ALTA', justificacion: 'Plan común formación general 3° y 4° Medio' };
  }

  // 17. Ciencias para la Ciudadanía (3° y 4° Medio)
  if (/ciudadania.*cien|cien.*ciudad/i.test(norm)) {
    return { asignaturaOficial: 'Ciencias para la Ciudadanía', confianza: 'ALTA', justificacion: 'Plan común formación general 3° y 4° Medio' };
  }

  // 17. Talleres JEC / Libre Disposición
  if (/taller|reforz|aele|extraesc|patrimon|ajedrez|medioamb|huert/i.test(norm)) {
    return {
      asignaturaOficial: 'Talleres JEC / Libre Disposición',
      confianza: 'ALTA',
      justificacion: 'Horas de libre disposición pedagógica JEC',
      esTallerJec: true
    };
  }

  // 18. Especialidades Técnico-Profesionales
  if (/mecanic|agric|electric|contab|administr|enferm|gastronom|turism|forest/i.test(norm)) {
    return {
      asignaturaOficial: 'Formación Diferenciada TP',
      confianza: 'ALTA',
      justificacion: 'Módulos de Especialidad Técnico-Profesional (Decreto 240/Diferenciada TP)'
    };
  }

  // 19. Funciones no lectivas
  if (/no lect|preparac|gestion|coordinac|admin/i.test(norm)) {
    return {
      asignaturaOficial: 'Funciones Institucionales / No Lectivas',
      confianza: 'MEDIA',
      justificacion: 'Horas no lectivas de contrato (Ley 20.903)'
    };
  }

  // Fallback por defecto: Docencia de Aula General
  return {
    asignaturaOficial: 'Docencia de Aula General',
    confianza: 'BAJA',
    justificacion: 'Asignatura genérica frente a estudiantes; requiere revisión o consulta con IA'
  };
}

/**
 * Consulta a Gemini AI para homologar un lote de asignaturas ambiguas o complejas.
 */
export async function homologarAsignaturasConGemini(
  itemsToQuery: { rawSubject: string; nivel: string }[],
  apiKey: string,
  modelName: string = 'gemini-3.7-flash'
): Promise<Record<string, { asignaturaOficial: string; confianza: 'ALTA' | 'MEDIA' | 'BAJA'; justificacion: string }>> {
  if (!apiKey || itemsToQuery.length === 0) return {};

  const prompt = `Eres el Director Curricular Nacional del Ministerio de Educación de Chile (MINEDUC) y experto en planes de estudio de los Servicios Locales de Educación Pública (SLEP).
Se te entrega una lista de asignaturas o actividades docentes tal como vienen escritas en las planillas de carga horaria de colegios, junto con el nivel escolar donde se imparten.

Debes homologar cada una a la ASIGNATURA OFICIAL DE LOS PLANES Y PROGRAMAS MINEDUC correspondientes a ese nivel en Chile.

Niveles y Planes Oficiales de Referencia:
- Educación Parvularia (NT1 y NT2):
  * "Ámbito Comunicación Integral"
  * "Ámbito Desarrollo Personal y Social"
  * "Ámbito Interacción y Comprensión del Entorno"
  * "Experiencias de Aprendizaje Integradas"
  * "Apoyo PIE / Codocencia"
  * "Talleres JEC / Libre Disposición"

- 1° a 6° Básico:
  * "Lenguaje y Comunicación"
  * "Matemática"
  * "Historia, Geografía y Ciencias Sociales"
  * "Ciencias Naturales"
  * "Idioma Extranjero: Inglés" (desde 5° Básico obligatorio, o antes como taller)
  * "Artes Visuales"
  * "Música"
  * "Educación Física y Salud"
  * "Tecnología"
  * "Orientación"
  * "Religión"
  * "Apoyo PIE / Codocencia"
  * "Talleres JEC / Libre Disposición"

- 7° y 8° Básico:
  * "Lengua y Literatura"
  * "Matemática"
  * "Historia, Geografía y Ciencias Sociales"
  * "Ciencias Naturales"
  * "Idioma Extranjero: Inglés"
  * "Artes Visuales y Música"
  * "Educación Física y Salud"
  * "Tecnología"
  * "Orientación"
  * "Religión"
  * "Apoyo PIE / Codocencia"
  * "Talleres JEC / Libre Disposición"

- 1° y 2° Medio:
  * "Lengua y Literatura"
  * "Matemática"
  * "Historia, Geografía y Ciencias Sociales"
  * "Ciencias Naturales"
  * "Idioma Extranjero: Inglés"
  * "Artes Visuales o Música"
  * "Educación Física y Salud"
  * "Tecnología"
  * "Orientación"
  * "Religión"
  * "Apoyo PIE / Codocencia"
  * "Talleres JEC / Libre Disposición"

- 3° y 4° Medio:
  * "Lengua y Literatura"
  * "Matemática"
  * "Educación Ciudadana"
  * "Filosofía"
  * "Inglés"
  * "Ciencias para la Ciudadanía"
  * "Electivo Común (Religión/Historia/Artes/Ed.Física)"
  * "Formación Diferenciada TP" (módulos técnicos)
  * "Formación Diferenciada HC" (electivos humanistas, científicos o artísticos)
  * "Apoyo PIE / Codocencia"
  * "Talleres JEC / Libre Disposición"

- Si corresponde a funciones institucionales fuera de curso: "Funciones Institucionales / No Lectivas".

Entrada a homologar:
${JSON.stringify(itemsToQuery, null, 2)}

Instrucciones de formato:
Responde ÚNICAMENTE con un JSON válido que sea un objeto donde cada clave sea exactamente: "\${rawSubject}__\${nivel}" y el valor contenga:
{
  "asignaturaOficial": "Nombre oficial MINEDUC exacto",
  "confianza": "ALTA" | "MEDIA" | "BAJA",
  "justificacion": "Explicación breve de 1 frase"
}
`;

  const candidateModels = [
    modelName,
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
  ];

  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) {
          return parsed;
        }
      }
    } catch {
      // Intentar siguiente modelo candidato
    }
  }

  return {};
}

/**
 * Genera la lista consolidada de homologaciones para los datos analizados.
 * Utiliza reglas MINEDUC locales primero y enriquece con Gemini AI si está disponible.
 */
export async function buildHomologacionList(
  teachers: TeacherRecord[],
  teacherLoads: TeacherConsolidatedLoad[],
  apiKey?: string,
  modelName?: string,
  onProgress?: (msg: string) => void
): Promise<HomologacionItem[]> {
  const mapUnique = new Map<string, {
    rawSubject: string;
    nivel: string;
    horasTotales: number;
    docentes: Set<string>;
  }>();

  // 1. Extraer asignaciones desde desglose de cursos
  for (const dl of teacherLoads) {
    for (const c of dl.cursos) {
      const rawSub = (c.asignatura || 'Docencia de Aula Regular').trim();
      const cursoStr = (c.curso || 'Aula Regular').trim();
      const key = `${rawSub}__${cursoStr}`;

      if (!mapUnique.has(key)) {
        mapUnique.set(key, {
          rawSubject: rawSub,
          nivel: cursoStr,
          horasTotales: 0,
          docentes: new Set(),
        });
      }

      const item = mapUnique.get(key)!;
      item.horasTotales = Math.round((item.horasTotales + (c.horas || 0)) * 100) / 100;
      item.docentes.add(dl.rut);
    }
  }

  // Si no hay desgloses en teacherLoads, extraer de teachers
  if (mapUnique.size === 0) {
    for (const t of teachers) {
      const rawSub = (t.activity || 'Docencia de Aula Regular').trim();
      const cursoStr = (t.curso || 'Aula Regular').trim();
      const key = `${rawSub}__${cursoStr}`;

      if (!mapUnique.has(key)) {
        mapUnique.set(key, {
          rawSubject: rawSub,
          nivel: cursoStr,
          horasTotales: 0,
          docentes: new Set(),
        });
      }

      const item = mapUnique.get(key)!;
      item.horasTotales = Math.round((item.horasTotales + (t.hours || 0)) * 100) / 100;
      item.docentes.add(t.rut);
    }
  }

  const items: HomologacionItem[] = [];
  const needsAi: { rawSubject: string; nivel: string }[] = [];

  // 2. Homologación inicial con Reglas Locales
  for (const [key, val] of mapUnique.entries()) {
    const regResult = homologarAsignaturaPorRegla(val.rawSubject, val.nivel);

    items.push({
      key,
      rawSubject: val.rawSubject,
      nivel: val.nivel,
      asignaturaOficial: regResult.asignaturaOficial,
      horasTotales: val.horasTotales,
      docentesCount: val.docentes.size,
      fuente: 'REGLA_MINEDUC',
      confianza: regResult.confianza,
      justificacion: regResult.justificacion,
      tipoHoraInstitucional: regResult.tipoHoraInstitucional,
      esDirectivo: regResult.esDirectivo,
      esTecnicoPedagogico: regResult.esTecnicoPedagogico,
      esCoordinacionPie: regResult.esCoordinacionPie,
      esConvivencia: regResult.esConvivencia,
      esExtraescolar: regResult.esExtraescolar,
      esCoDocencia: regResult.esCoDocencia,
      esAgrupacionFlexible: regResult.esAgrupacionFlexible,
      esTallerJec: regResult.esTallerJec,
      esTallerSep: regResult.esTallerSep,
      esPie: regResult.esPie,
      esProporcionDocente: regResult.esProporcionDocente,
    });

    if (regResult.confianza !== 'ALTA' && apiKey) {
      needsAi.push({ rawSubject: val.rawSubject, nivel: val.nivel });
    }
  }

  // 3. Consulta opcional a Gemini AI para casos ambiguos
  if (apiKey && needsAi.length > 0) {
    if (onProgress) onProgress(`Consultando Gemini AI (${needsAi.length} asignaturas atípicas)...`);
    try {
      const aiResults = await homologarAsignaturasConGemini(needsAi, apiKey, modelName);
      for (const item of items) {
        if (aiResults[item.key]) {
          const ai = aiResults[item.key];
          if (ai.asignaturaOficial) {
            item.asignaturaOficial = ai.asignaturaOficial;
            item.fuente = 'IA_GEMINI';
            item.confianza = ai.confianza || 'ALTA';
            item.justificacion = ai.justificacion || 'Homologación inteligente Gemini AI';
          }
        }
      }
    } catch (e) {
      console.warn('Fallo consulta a Gemini para homologación, se mantienen reglas locales:', e);
    }
  }

  // Ordenar por nivel y horas descendente
  return items.sort((a, b) => b.horasTotales - a.horasTotales);
}
