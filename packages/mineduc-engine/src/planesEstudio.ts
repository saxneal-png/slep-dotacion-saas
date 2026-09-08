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
  }
};

export function getPlanesMineducConvertidos(): PlanEstudioNivel[] {
  const result: PlanEstudioNivel[] = [];

  // 0. Educación Parvularia (NT1 y NT2)
  const pParv = DATA_PLANES_ESTUDIO_MINEDUC["parvularia"];
  result.push({
    nivel: "Educación Parvularia (NT1 y NT2)",
    regimen: "JEC",
    horasObligatorias: pParv.regimen.JEC.total - pParv.regimen.JEC.libre,
    horasLibreDisposicion: pParv.regimen.JEC.libre,
    totalHorasPlan: pParv.regimen.JEC.total,
    asignaturasBase: pParv.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.JEC }))
  });
  result.push({
    nivel: "Educación Parvularia (NT1 y NT2)",
    regimen: "No JEC",
    horasObligatorias: pParv.regimen.No_JEC.total - pParv.regimen.No_JEC.libre,
    horasLibreDisposicion: pParv.regimen.No_JEC.libre,
    totalHorasPlan: pParv.regimen.No_JEC.total,
    asignaturasBase: pParv.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.No_JEC }))
  });

  // 1. 1° a 4° Básico
  const p14 = DATA_PLANES_ESTUDIO_MINEDUC["1_4_basico"];
  result.push({
    nivel: "1° a 4° Básico",
    regimen: "JEC",
    horasObligatorias: p14.regimen.JEC.total - p14.regimen.JEC.libre,
    horasLibreDisposicion: p14.regimen.JEC.libre,
    totalHorasPlan: p14.regimen.JEC.total,
    asignaturasBase: p14.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.JEC }))
  });
  result.push({
    nivel: "1° a 4° Básico",
    regimen: "No JEC",
    horasObligatorias: p14.regimen.No_JEC.total - p14.regimen.No_JEC.libre,
    horasLibreDisposicion: p14.regimen.No_JEC.libre,
    totalHorasPlan: p14.regimen.No_JEC.total,
    asignaturasBase: p14.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.No_JEC }))
  });

  // 2. 5° a 6° Básico
  const p56 = DATA_PLANES_ESTUDIO_MINEDUC["5_6_basico"];
  result.push({
    nivel: "5° a 6° Básico",
    regimen: "JEC",
    horasObligatorias: p56.regimen.JEC.total - p56.regimen.JEC.libre,
    horasLibreDisposicion: p56.regimen.JEC.libre,
    totalHorasPlan: p56.regimen.JEC.total,
    asignaturasBase: p56.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.JEC }))
  });
  result.push({
    nivel: "5° a 6° Básico",
    regimen: "No JEC",
    horasObligatorias: p56.regimen.No_JEC.total - p56.regimen.No_JEC.libre,
    horasLibreDisposicion: p56.regimen.No_JEC.libre,
    totalHorasPlan: p56.regimen.No_JEC.total,
    asignaturasBase: p56.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.No_JEC }))
  });

  // 3. 7° a 8° Básico
  const p78 = DATA_PLANES_ESTUDIO_MINEDUC["7_8_basico"];
  result.push({
    nivel: "7° a 8° Básico",
    regimen: "JEC",
    horasObligatorias: p78.regimen.JEC.total - p78.regimen.JEC.libre,
    horasLibreDisposicion: p78.regimen.JEC.libre,
    totalHorasPlan: p78.regimen.JEC.total,
    asignaturasBase: p78.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.JEC }))
  });
  result.push({
    nivel: "7° a 8° Básico",
    regimen: "No JEC",
    horasObligatorias: p78.regimen.No_JEC.total - p78.regimen.No_JEC.libre,
    horasLibreDisposicion: p78.regimen.No_JEC.libre,
    totalHorasPlan: p78.regimen.No_JEC.total,
    asignaturasBase: p78.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.No_JEC }))
  });

  // 4. 1° y 2° Medio
  const p12m = DATA_PLANES_ESTUDIO_MINEDUC["1_2_medio"];
  result.push({
    nivel: "1° y 2° Medio",
    regimen: "JEC",
    horasObligatorias: p12m.regimen.JEC.total - p12m.regimen.JEC.libre,
    horasLibreDisposicion: p12m.regimen.JEC.libre,
    totalHorasPlan: p12m.regimen.JEC.total,
    asignaturasBase: p12m.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.JEC }))
  });
  result.push({
    nivel: "1° y 2° Medio",
    regimen: "No JEC",
    horasObligatorias: p12m.regimen.No_JEC.total - p12m.regimen.No_JEC.libre,
    horasLibreDisposicion: p12m.regimen.No_JEC.libre,
    totalHorasPlan: p12m.regimen.No_JEC.total,
    asignaturasBase: p12m.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.No_JEC }))
  });

  // 5. 3° y 4° Medio
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

  return result;
}

export const PLANES_MINEDUC: PlanEstudioNivel[] = getPlanesMineducConvertidos();

/**
 * Obtiene el plan de estudios más adecuado según nombre de curso y régimen.
 */
export function obtenerPlanPorCurso(cursoNombre: string, regimen: 'JEC' | 'No JEC' = 'JEC'): PlanEstudioNivel | null {
  const c = cursoNombre.toLowerCase();
  let grupo = '';

  if (c.includes('prekínder') || c.includes('prekinder') || c.includes('kínder') || c.includes('kinder') || c.includes('nt1') || c.includes('nt2') || c.includes('parvular')) {
    grupo = 'Educación Parvularia (NT1 y NT2)';
  } else if (c.includes('1°') || c.includes('2°') || c.includes('3°') || c.includes('4°') ||
      c.includes('1o') || c.includes('2o') || c.includes('3o') || c.includes('4o')) {
    if (c.includes('medio') || c.includes('secundaria')) {
      if (c.includes('1°') || c.includes('2°') || c.includes('1o') || c.includes('2o')) {
        grupo = '1° y 2° Medio';
      } else if (c.includes('tp') || c.includes('técnico') || c.includes('tecnico') || c.includes('profesional')) {
        grupo = '3° y 4° Medio (Técnico-Profesional)';
      } else if (c.includes('artístic') || c.includes('artistic')) {
        grupo = '3° y 4° Medio (Artístico)';
      } else {
        grupo = '3° y 4° Medio (Humanístico-Científico)';
      }
    } else {
      grupo = '1° a 4° Básico';
    }
  } else if (c.includes('5°') || c.includes('6°') || c.includes('5o') || c.includes('6o')) {
    grupo = '5° a 6° Básico';
  } else if (c.includes('7°') || c.includes('8°') || c.includes('7o') || c.includes('8o')) {
    grupo = '7° a 8° Básico';
  }

  if (!grupo) return null;

  return PLANES_MINEDUC.find(p => p.nivel === grupo && p.regimen === regimen) || null;
}
