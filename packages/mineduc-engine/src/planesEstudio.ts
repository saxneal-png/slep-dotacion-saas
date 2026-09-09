// =============================================================================
// REGLA DE NEGOCIO PURA: PLANES Y PROGRAMAS DE ESTUDIO OFICIALES MINEDUC
// =============================================================================

export interface AsignaturaPlan {
  nombre: string;
  horasSugeridas: number;
}

export interface PlanEstudioNivel {
  nivel: string;
  regimen: 'JEC' | 'No JEC';
  horasObligatorias: number;
  horasLibreDisposicion: number;
  totalHorasPlan: number;
  asignaturasBase: AsignaturaPlan[];
}

export const DATA_PLANES_ESTUDIO_MINEDUC = {
  "parvularia": {
    nombre: "Educación Parvularia (NT1 y NT2)",
    regimen: {
      JEC: { total: 28, libre: 4 },
      No_JEC: { total: 22, libre: 0 }
    },
    asignaturas: [
      { nombre: "Ámbito Desarrollo Personal y Social", JEC: 8, No_JEC: 6 },
      { nombre: "Ámbito Comunicación Integral", JEC: 10, No_JEC: 8 },
      { nombre: "Ámbito Interacción y Comprensión del Entorno", JEC: 6, No_JEC: 6 },
      { nombre: "Experiencias de Aprendizaje Integradas", JEC: 4, No_JEC: 2 }
    ]
  },
  "multigrado_parvularia": {
    nombre: "Multigrado Parvularia (NT1-NT2)",
    regimen: {
      JEC: { total: 28, libre: 4 },
      No_JEC: { total: 22, libre: 0 }
    },
    asignaturas: [
      { nombre: "Ámbito Desarrollo Personal y Social", JEC: 8, No_JEC: 6 },
      { nombre: "Ámbito Comunicación Integral", JEC: 10, No_JEC: 8 },
      { nombre: "Ámbito Interacción y Comprensión del Entorno", JEC: 6, No_JEC: 6 },
      { nombre: "Experiencias de Aprendizaje Integradas", JEC: 4, No_JEC: 2 }
    ]
  },
  "1_4_basico": {
    nombre: "1° a 4° año de Educación Básica",
    regimen: {
      JEC: { total: 38, libre: 6.5 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 8, No_JEC: 8 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 3, No_JEC: 3 },
      { nombre: "Artes Visuales", JEC: 2, No_JEC: 2 },
      { nombre: "Música", JEC: 2, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 4, No_JEC: 3 },
      { nombre: "Orientación", JEC: 0.5, No_JEC: 0.5 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 0.5 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 3, No_JEC: 3 }
    ]
  },
  "5_6_basico": {
    nombre: "5° a 6° año de Educación Básica",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 6, No_JEC: 6 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Artes Visuales", JEC: 1.5, No_JEC: 1 },
      { nombre: "Música", JEC: 1.5, No_JEC: 1 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 3, No_JEC: 3 }
    ]
  },
  "7_8_basico": {
    nombre: "7° a 8° año de Educación Básica (Estándar)",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 33, libre: 2 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 6, No_JEC: 6 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Artes Visuales y Música", JEC: 3, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 3, No_JEC: 3 }
    ]
  },
  "7_8_basico_indigena": {
    nombre: "7° a 8° año de Educación Básica - Con Sector Lengua Indígena",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 33, libre: 2 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 5, No_JEC: 4 },
      { nombre: "Lengua Indígena", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 3, No_JEC: 3 },
      { nombre: "Artes Visuales y Música", JEC: 3, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 1, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 3, No_JEC: 4 }
    ]
  },
  "multigrado_basica": {
    nombre: "Educación Básica Multigrado / Combinada",
    regimen: {
      JEC: { total: 38, libre: 6 },
      No_JEC: { total: 30, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lenguaje y Comunicación", JEC: 7, No_JEC: 7 },
      { nombre: "Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 3.5, No_JEC: 3.5 },
      { nombre: "Ciencias Naturales", JEC: 3.5, No_JEC: 3 },
      { nombre: "Artes Visuales y Música", JEC: 3, No_JEC: 2.5 },
      { nombre: "Educación Física y Salud", JEC: 3, No_JEC: 2.5 },
      { nombre: "Tecnología", JEC: 1.5, No_JEC: 1 },
      { nombre: "Orientación", JEC: 1, No_JEC: 0.5 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2.5, No_JEC: 2 }
    ]
  },
  "1_2_medio": {
    nombre: "1° y 2° año de Educación Media",
    regimen: {
      JEC: { total: 42, libre: 6 },
      No_JEC: { total: 33, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua y Literatura", JEC: 6, No_JEC: 6 },
      { nombre: "Matemática", JEC: 7, No_JEC: 6 },
      { nombre: "Historia, Geografía y Ciencias Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Artes Visuales o Música", JEC: 2, No_JEC: 2 },
      { nombre: "Educación Física y Salud", JEC: 2, No_JEC: 2 },
      { nombre: "Orientación", JEC: 1, No_JEC: 1 },
      { nombre: "Tecnología", JEC: 2, No_JEC: 1 },
      { nombre: "Religión", JEC: 2, No_JEC: 2 },
      { nombre: "Ciencias Naturales", JEC: 6, No_JEC: 6 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 4, No_JEC: 3 }
    ]
  },
  "3_4_medio": {
    nombre: "3° y 4° año de Educación Media",
    plan_comun_general: [
      { nombre: "Lengua y Literatura", horas: 3 },
      { nombre: "Matemática", horas: 3 },
      { nombre: "Educación Ciudadana", horas: 2 },
      { nombre: "Filosofía", horas: 2 },
      { nombre: "Inglés", horas: 2 },
      { nombre: "Ciencias para la Ciudadanía", horas: 2 }
    ],
    plan_comun_electivo: [
      { nombre: "Electivo Común (Religión/Historia/Artes/Ed.Física)", horas: 2 }
    ],
    modalidades: {
      humanistico_cientifico: {
        nombre: "Humanístico-Científico",
        diferenciada: 18,
        JEC: { total: 42, libre: 8 },
        No_JEC: { total: 36, libre: 2 }
      },
      tecnico_profesional: {
        nombre: "Técnico-Profesional",
        diferenciada: 22,
        JEC: { total: 42, libre: 6 },
        No_JEC: { total: 38, libre: 2 }
      },
      artistico: {
        nombre: "Artístico",
        diferenciada: 21,
        JEC: { total: 42, libre: 5 },
        No_JEC: { total: 0, libre: 0 }
      }
    }
  },
  // ===========================================================================
  // EDUCACIÓN DE PERSONAS JÓVENES Y ADULTAS (EPJA)
  // ===========================================================================
  "epja_basica_1_nivel": {
    nombre: "EPJA Básica - 1° Nivel Básico (1° a 4° Básico)",
    regimen: {
      JEC: { total: 24, libre: 4 },
      No_JEC: { total: 20, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua Castellana y Comunicación", JEC: 7, No_JEC: 6 },
      { nombre: "Educación Matemática", JEC: 7, No_JEC: 6 },
      { nombre: "Ciencias Naturales", JEC: 3, No_JEC: 4 },
      { nombre: "Estudios Sociales", JEC: 3, No_JEC: 4 }
    ]
  },
  "epja_basica_2_nivel": {
    nombre: "EPJA Básica - 2° Nivel Básico (5° a 6° Básico)",
    regimen: {
      JEC: { total: 26, libre: 4 },
      No_JEC: { total: 22, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua Castellana y Comunicación", JEC: 6, No_JEC: 6 },
      { nombre: "Educación Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Estudios Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 }
    ]
  },
  "epja_basica_3_nivel": {
    nombre: "EPJA Básica - 3° Nivel Básico (7° a 8° Básico)",
    regimen: {
      JEC: { total: 26, libre: 4 },
      No_JEC: { total: 22, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua Castellana y Comunicación", JEC: 6, No_JEC: 6 },
      { nombre: "Educación Matemática", JEC: 6, No_JEC: 6 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Estudios Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 }
    ]
  },
  "epja_media_hc_1_nivel": {
    nombre: "EPJA Media HC - 1° Nivel Medio (1° y 2° Medio)",
    regimen: {
      JEC: { total: 30, libre: 4 },
      No_JEC: { total: 26, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua Castellana y Comunicación", JEC: 6, No_JEC: 5 },
      { nombre: "Educación Matemática", JEC: 6, No_JEC: 5 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Estudios Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 3, No_JEC: 3 },
      { nombre: "Filosofía y Psicología / Formación Ciudadana", JEC: 2, No_JEC: 2 },
      { nombre: "Convivencia Social y Formación Instrumental", JEC: 1, No_JEC: 3 }
    ]
  },
  "epja_media_hc_2_nivel": {
    nombre: "EPJA Media HC - 2° Nivel Medio (3° y 4° Medio)",
    regimen: {
      JEC: { total: 30, libre: 4 },
      No_JEC: { total: 26, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua Castellana y Comunicación", JEC: 6, No_JEC: 5 },
      { nombre: "Educación Matemática", JEC: 6, No_JEC: 5 },
      { nombre: "Ciencias Naturales", JEC: 4, No_JEC: 4 },
      { nombre: "Estudios Sociales", JEC: 4, No_JEC: 4 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 3, No_JEC: 3 },
      { nombre: "Filosofía y Psicología / Formación Ciudadana", JEC: 2, No_JEC: 2 },
      { nombre: "Convivencia Social y Formación Instrumental", JEC: 1, No_JEC: 3 }
    ]
  },
  "epja_media_tp_1_nivel": {
    nombre: "EPJA Media TP - 1° Nivel Medio (1° y 2° Medio TP)",
    regimen: {
      JEC: { total: 36, libre: 4 },
      No_JEC: { total: 32, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua Castellana y Comunicación", JEC: 4, No_JEC: 4 },
      { nombre: "Educación Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Ciencias Naturales", JEC: 3, No_JEC: 3 },
      { nombre: "Estudios Sociales", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Convivencia Social", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Diferenciada Técnico-Profesional", JEC: 14, No_JEC: 14 }
    ]
  },
  "epja_media_tp_2_nivel": {
    nombre: "EPJA Media TP - 2° Nivel Medio (3° y 4° Medio TP)",
    regimen: {
      JEC: { total: 38, libre: 4 },
      No_JEC: { total: 34, libre: 0 }
    },
    asignaturas: [
      { nombre: "Lengua Castellana y Comunicación", JEC: 4, No_JEC: 4 },
      { nombre: "Educación Matemática", JEC: 4, No_JEC: 4 },
      { nombre: "Estudios Sociales", JEC: 3, No_JEC: 3 },
      { nombre: "Idioma Extranjero: Inglés", JEC: 2, No_JEC: 2 },
      { nombre: "Convivencia Social", JEC: 2, No_JEC: 2 },
      { nombre: "Formación Diferenciada Técnico-Profesional", JEC: 19, No_JEC: 19 }
    ]
  }
};

export function getPlanesMineducConvertidos(): PlanEstudioNivel[] {
  const result: PlanEstudioNivel[] = [];

  const addSimplePlan = (key: keyof typeof DATA_PLANES_ESTUDIO_MINEDUC, customNivelName?: string) => {
    const item = DATA_PLANES_ESTUDIO_MINEDUC[key] as any;
    if (!item || !item.regimen) return;
    const nivelName = customNivelName || item.nombre;

    if (item.regimen.JEC && item.regimen.JEC.total > 0) {
      result.push({
        nivel: nivelName,
        regimen: "JEC",
        horasObligatorias: item.regimen.JEC.total - (item.regimen.JEC.libre || 0),
        horasLibreDisposicion: item.regimen.JEC.libre || 0,
        totalHorasPlan: item.regimen.JEC.total,
        asignaturasBase: item.asignaturas.map((a: any) => ({ nombre: a.nombre, horasSugeridas: a.JEC }))
      });
    }

    if (item.regimen.No_JEC && item.regimen.No_JEC.total > 0) {
      result.push({
        nivel: nivelName,
        regimen: "No JEC",
        horasObligatorias: item.regimen.No_JEC.total - (item.regimen.No_JEC.libre || 0),
        horasLibreDisposicion: item.regimen.No_JEC.libre || 0,
        totalHorasPlan: item.regimen.No_JEC.total,
        asignaturasBase: item.asignaturas.map((a: any) => ({ nombre: a.nombre, horasSugeridas: a.No_JEC }))
      });
    }
  };

  // 0. Parvularia
  addSimplePlan("parvularia", "Educación Parvularia (NT1 y NT2)");
  addSimplePlan("multigrado_parvularia", "Multigrado Parvularia (NT1-NT2)");

  // 1. Básica Regular
  addSimplePlan("1_4_basico", "1° a 4° Básico");
  addSimplePlan("5_6_basico", "5° a 6° Básico");
  addSimplePlan("7_8_basico", "7° a 8° Básico");
  addSimplePlan("7_8_basico_indigena", "7° a 8° año de Educación Básica - Con Sector Lengua Indígena");
  addSimplePlan("multigrado_basica", "Educación Básica Multigrado / Combinada");

  // 2. Media 1° y 2°
  addSimplePlan("1_2_medio", "1° y 2° Medio");

  // 3. Media 3° y 4° Diferenciada
  const p34 = DATA_PLANES_ESTUDIO_MINEDUC["3_4_medio"];
  const general = p34.plan_comun_general;
  const electivo = p34.plan_comun_electivo;

  for (const [, mod] of Object.entries(p34.modalidades)) {
    const listBase = [
      ...general.map(g => ({ nombre: g.nombre, horasSugeridas: g.horas })),
      ...electivo.map(e => ({ nombre: e.nombre, horasSugeridas: e.horas })),
      { nombre: `Formación Diferenciada (${mod.nombre})`, horasSugeridas: mod.diferenciada }
    ];

    if (mod.JEC.total > 0) {
      result.push({
        nivel: `3° y 4° Medio (${mod.nombre})`,
        regimen: "JEC",
        horasObligatorias: mod.JEC.total - mod.JEC.libre,
        horasLibreDisposicion: mod.JEC.libre,
        totalHorasPlan: mod.JEC.total,
        asignaturasBase: listBase
      });
    }

    if (mod.No_JEC.total > 0) {
      result.push({
        nivel: `3° y 4° Medio (${mod.nombre})`,
        regimen: "No JEC",
        horasObligatorias: mod.No_JEC.total - mod.No_JEC.libre,
        horasLibreDisposicion: mod.No_JEC.libre,
        totalHorasPlan: mod.No_JEC.total,
        asignaturasBase: listBase
      });
    }
  }

  // 4. EPJA (Educación de Adultos)
  addSimplePlan("epja_basica_1_nivel");
  addSimplePlan("epja_basica_2_nivel");
  addSimplePlan("epja_basica_3_nivel");
  addSimplePlan("epja_media_hc_1_nivel");
  addSimplePlan("epja_media_hc_2_nivel");
  addSimplePlan("epja_media_tp_1_nivel");
  addSimplePlan("epja_media_tp_2_nivel");

  return result;
}

export const PLANES_MINEDUC: PlanEstudioNivel[] = getPlanesMineducConvertidos();

/**
 * Obtiene el plan de estudios más adecuado según nombre de curso y régimen.
 */
export function obtenerPlanPorCurso(cursoNombre: string, regimen: 'JEC' | 'No JEC' = 'JEC'): PlanEstudioNivel | null {
  if (!cursoNombre) return null;
  const c = cursoNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  let grupo = '';

  // 1. EPJA - EDUCACIÓN DE ADULTOS
  if (c.includes('adulto') || c.includes('epja') || c.includes('nivel basico') || c.includes('nivel medio')) {
    if (c.includes('tp') || c.includes('tecnico') || c.includes('profesional')) {
      if (c.includes('2') || c.includes('segundo') || c.includes('3') || c.includes('4')) {
        grupo = "EPJA Media TP - 2° Nivel Medio (3° y 4° Medio TP)";
      } else {
        grupo = "EPJA Media TP - 1° Nivel Medio (1° y 2° Medio TP)";
      }
    } else if (c.includes('medio') || c.includes('hc') || c.includes('human')) {
      if (c.includes('2') || c.includes('segundo') || c.includes('3') || c.includes('4')) {
        grupo = "EPJA Media HC - 2° Nivel Medio (3° y 4° Medio)";
      } else {
        grupo = "EPJA Media HC - 1° Nivel Medio (1° y 2° Medio)";
      }
    } else if (c.includes('3') || c.includes('tercer') || c.includes('7') || c.includes('8')) {
      grupo = "EPJA Básica - 3° Nivel Básico (7° a 8° Básico)";
    } else if (c.includes('2') || c.includes('segundo') || c.includes('5') || c.includes('6')) {
      grupo = "EPJA Básica - 2° Nivel Básico (5° a 6° Básico)";
    } else {
      grupo = "EPJA Básica - 1° Nivel Básico (1° a 4° Básico)";
    }
  }
  // 2. CURSOS MULTIGRADO Y COMBINADOS
  else if (c.includes('multigrado') || c.includes('combinado') || c.includes('comb')) {
    if (c.includes('nt') || c.includes('kinder') || c.includes('parvular')) {
      grupo = "Multigrado Parvularia (NT1-NT2)";
    } else if (c.includes('medio')) {
      grupo = "1° y 2° Medio";
    } else {
      grupo = "Educación Básica Multigrado / Combinada";
    }
  }
  // 3. PARVULARIA REGULAR
  else if (c.includes('prekinder') || c.includes('kinder') || c.includes('nt1') || c.includes('nt2') || c.includes('parvular')) {
    grupo = 'Educación Parvularia (NT1 y NT2)';
  }
  // 4. BÁSICA Y MEDIA REGULAR
  else if (c.includes('1°') || c.includes('2°') || c.includes('3°') || c.includes('4°') ||
      c.includes('1o') || c.includes('2o') || c.includes('3o') || c.includes('4o') ||
      c.includes('1 ') || c.includes('2 ') || c.includes('3 ') || c.includes('4 ')) {
    if (c.includes('medio') || c.includes('secundaria')) {
      if (c.includes('1°') || c.includes('2°') || c.includes('1o') || c.includes('2o') || c.includes('1 ') || c.includes('2 ')) {
        grupo = '1° y 2° Medio';
      } else if (c.includes('tp') || c.includes('tecnico') || c.includes('profesional')) {
        grupo = '3° y 4° Medio (Técnico-Profesional)';
      } else if (c.includes('artistic')) {
        grupo = '3° y 4° Medio (Artístico)';
      } else {
        grupo = '3° y 4° Medio (Humanístico-Científico)';
      }
    } else {
      grupo = '1° a 4° Básico';
    }
  } else if (c.includes('5°') || c.includes('6°') || c.includes('5o') || c.includes('6o') || c.includes('5 ') || c.includes('6 ')) {
    grupo = '5° a 6° Básico';
  } else if (c.includes('7°') || c.includes('8°') || c.includes('7o') || c.includes('8o') || c.includes('7 ') || c.includes('8 ')) {
    grupo = '7° a 8° Básico';
  }

  if (!grupo) return null;

  // Buscar coincidencia exacta por nivel y régimen; si no existe, retornar el primer régimen disponible para ese nivel
  const match = PLANES_MINEDUC.find(p => p.nivel === grupo && p.regimen === regimen);
  if (match) return match;

  return PLANES_MINEDUC.find(p => p.nivel === grupo) || null;
}
