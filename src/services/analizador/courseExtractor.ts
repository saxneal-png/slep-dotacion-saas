import { TeacherCourseAssignment, CourseLoadSummary, TeacherConsolidatedLoad, TeacherRecord } from '../../types/analizadorTypes';
import { obtenerPlanPorCurso } from '@slep/mineduc-engine';

export interface NormalizedCourseInfo {
  cursoCompleto: string;
  nivel: string;
  letra: string;
  regimen: 'JEC' | 'No JEC';
  esMultigrado: boolean;
}

/**
 * Normaliza un texto de encabezado o referencia a un curso chileno oficial.
 */
export function normalizeCourseHeader(raw: string): NormalizedCourseInfo | null {
  if (!raw) return null;
  const clean = raw.trim().toUpperCase().replace(/\s+/g, ' ');

  // Descartar encabezados que claramente no son cursos
  if (/^(NOMBRES?|RUN|RUT|HORAS?|TITULAR(ES)?|CONTRATA|TOTAL|OBSERVA|SUBV|SUB\b|CARGO|FUNCION|ESTAMENTO|ACTIVIDAD|DOCENTE|CORREO|TELEFONO|FIRMA)/i.test(clean)) {
    return null;
  }

  // 1. EPJA - Educación de Adultos (Bases Curriculares Decreto Supremo N° 10/2022)
  if (/(?:EPJA|ADULTO)/i.test(clean) || /(?:PRIMER|SEGUNDO|TERCER|[123]°?)\s*NIVEL/i.test(clean) || /OFICIO/i.test(clean)) {
    const letraMatch = clean.match(/\b([A-Z])\b$/);
    const letra = letraMatch ? letraMatch[1] : 'A';
    if (/OFICIO/i.test(clean)) {
      const nivel = 'Educación Media TP en Oficios - Niveles 1 y 2 (1° a 4° Medio TP)';
      return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/TP|T[EÉ]CNICO|PROFESIONAL|ESPECIALIDAD/i.test(clean)) {
      if (/(?:2|SEGUNDO|3|4|TERCER|CUARTO)/i.test(clean)) {
        const nivel = 'Educación Media TP en Especialidades - Niveles 2 y 3 (3° y 4° Medio TP)';
        return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
      }
      const nivel = 'Educación Media TP en Especialidades - Nivel 1 (1° y 2° Medio TP)';
      return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/MEDIO|SECUNDARIA|HC|HUMAN/i.test(clean)) {
      if (/(?:2|SEGUNDO|3|4)/i.test(clean)) {
        const nivel = 'Educación Media HC - Nivel 2 (3° y 4° Medio)';
        return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
      }
      const nivel = 'Educación Media HC - Nivel 1 (1° y 2° Medio)';
      return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/(?:3|TERCER|7|8)/i.test(clean)) {
      const nivel = 'Educación Básica - Nivel 3 (7° y 8° Básico)';
      return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/(?:2|SEGUNDO|5|6)/i.test(clean)) {
      const nivel = 'Educación Básica - Nivel 2 (5° y 6° Básico)';
      return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
    }
    const nivel = 'Educación Básica - Nivel 1 (1° a 4° Básico)';
    return { cursoCompleto: `${nivel} ${letra}`, nivel, letra, regimen: 'No JEC', esMultigrado: false };
  }

  // 2. Especialidades Técnico-Profesionales (Decretos 452/2013 y 0954/2015)
  if (/(?:ELECTRIC|PROGRAMAC|GASTRONOM|PARVULO|ADMINISTRAC|CONSTRUCC|MECANIC|AGROPEC|ELABORACION|ALIMENTO|EDIFICAC|TERMINACION|VIAL|MATRICER|HERRAMIENTA|COCINA|PASTEL)/i.test(clean)) {
    const letraMatch = clean.match(/\b([A-Z])\b$/);
    const letra = letraMatch ? letraMatch[1] : 'A';
    const planDetectado = obtenerPlanPorCurso(clean, 'JEC');
    if (planDetectado) {
      return {
        cursoCompleto: `${planDetectado.nivel} ${letra}`,
        nivel: planDetectado.nivel,
        letra,
        regimen: 'JEC',
        esMultigrado: false,
      };
    }
  }

  // Cursos Combinados
  if (/COMBINAD/i.test(clean) || /COMB\b/i.test(clean)) {
    const label = `Curso Combinado ${raw.trim()}`;
    return { cursoCompleto: label, nivel: label, letra: 'U', regimen: 'JEC', esMultigrado: true };
  }

  // Multigrado Parvularia NT1-NT2 / Prekínder - Kínder
  if (/^(?:NT1\s*[-/]\s*NT2|PRE-?K(?:INDER)?\s*[-/]\s*K(?:INDER)?)/i.test(clean)) {
    return { cursoCompleto: 'Multigrado NT1-NT2', nivel: 'Multigrado NT1-NT2', letra: 'U', regimen: 'No JEC', esMultigrado: true };
  }

  // Multigrado Básica (ej: 1°-2° Básico, 1° a 6°, 1-2-3-4)
  const multiBasicaMatch = clean.match(/^([1-8])°?\s*[-/aA]\s*([1-8])°?(?:\s*[-/]\s*([1-8])°?)?(?:\s*B[AÁ]SICO)?$/i);
  if (multiBasicaMatch) {
    const start = multiBasicaMatch[1];
    const end = multiBasicaMatch[2];
    const label = `Multigrado ${start}°-${end}° Básico`;
    return { cursoCompleto: label, nivel: label, letra: 'U', regimen: 'JEC', esMultigrado: true };
  }

  // Educación Parvularia NT1 / Pre-Kínder
  if (/^(?:NT1|PK|PRE-?K(?:INDER)?)\s*([A-Z])?$/i.test(clean)) {
    const m = clean.match(/^(?:NT1|PK|PRE-?K(?:INDER)?)\s*([A-Z])?$/i);
    const letra = m && m[1] ? m[1].toUpperCase() : 'A';
    return { cursoCompleto: `Pre-Kínder ${letra}`, nivel: 'Pre-Kínder', letra, regimen: 'No JEC', esMultigrado: false };
  }

  // Educación Parvularia NT2 / Kínder
  if (/^(?:NT2|K|K(?:INDER)?)\s*([A-Z])?$/i.test(clean)) {
    const m = clean.match(/^(?:NT2|K|K(?:INDER)?)\s*([A-Z])?$/i);
    const letra = m && m[1] ? m[1].toUpperCase() : 'A';
    return { cursoCompleto: `Kínder ${letra}`, nivel: 'Kínder', letra, regimen: 'No JEC', esMultigrado: false };
  }

  // Educación Media (ej: 1° MEDIO, 1° MEDIO A, 1°M A, 4° MEDIO TP)
  const mediaMatch = clean.match(/^([1-4])°?\s*(?:M|MED|MEDIO)\s*(HC|TP)?\s*([A-Z])?$/i);
  if (mediaMatch) {
    const num = mediaMatch[1];
    const tipo = mediaMatch[2] ? ` ${mediaMatch[2].toUpperCase()}` : '';
    const letra = mediaMatch[3] ? mediaMatch[3].toUpperCase() : 'A';
    return { cursoCompleto: `${num}° Medio${tipo} ${letra}`, nivel: `${num}° Medio${tipo}`, letra, regimen: 'JEC', esMultigrado: false };
  }

  // Educación Básica formato palabra (ej: 1° BASICO, 5° BASICO B, 8 BASICO)
  const basicaPalabraMatch = clean.match(/^([1-8])°?\s*B[AÁ]SICO(?:\s*([A-Z]))?$/i);
  if (basicaPalabraMatch) {
    const num = basicaPalabraMatch[1];
    const letra = basicaPalabraMatch[2] ? basicaPalabraMatch[2].toUpperCase() : 'A';
    return { cursoCompleto: `${num}° Básico ${letra}`, nivel: `${num}° Básico`, letra, regimen: 'JEC', esMultigrado: false };
  }

  // Educación Básica abreviado con letra (ej: 1A, 2B, 6A, 8C, 1°A, 4°B)
  const basicaAbrevMatch = clean.match(/^([1-8])°?\s*([A-Z])$/i);
  if (basicaAbrevMatch) {
    const num = basicaAbrevMatch[1];
    const letra = basicaAbrevMatch[2].toUpperCase();
    return { cursoCompleto: `${num}° Básico ${letra}`, nivel: `${num}° Básico`, letra, regimen: 'JEC', esMultigrado: false };
  }

  // Educación Básica dígitos puros o con ordinal (ej: 1, 2, 3, 4, 5, 6, 7, 8 o 1°, 2°, ..., 8°)
  const basicaDigitoMatch = clean.match(/^([1-8])°?$/);
  if (basicaDigitoMatch) {
    const num = basicaDigitoMatch[1];
    return { cursoCompleto: `${num}° Básico`, nivel: `${num}° Básico`, letra: 'U', regimen: 'JEC', esMultigrado: false };
  }

  // Educación Media abreviado (ej: 1M, 2M, 3M, 4M o I, II, III, IV)
  const mediaRomanoMatch = clean.match(/^(?:([1-4])°?\s*M(?:ED)?|(I|II|III|IV))(?:\s*([A-Z]))?$/i);
  if (mediaRomanoMatch) {
    const numMap: Record<string, string> = { I: '1', II: '2', III: '3', IV: '4' };
    const num = mediaRomanoMatch[1] || (mediaRomanoMatch[2] ? numMap[mediaRomanoMatch[2].toUpperCase()] : '1') || '1';
    const letra = mediaRomanoMatch[3] ? mediaRomanoMatch[3].toUpperCase() : 'U';
    return { cursoCompleto: `${num}° Medio ${letra}`, nivel: `${num}° Medio`, letra, regimen: 'JEC', esMultigrado: false };
  }

  // Nivel Laboral / Educación Especial
  const laboralMatch = clean.match(/^LABORAL\s*([0-9]+)?(?:\s*([A-Z]))?$/i);
  if (laboralMatch) {
    const num = laboralMatch[1] || '1';
    const letra = laboralMatch[2] ? laboralMatch[2].toUpperCase() : 'U';
    return { cursoCompleto: `Laboral ${num} ${letra}`, nivel: `Laboral ${num}`, letra, regimen: 'No JEC', esMultigrado: false };
  }

  return null;
}

/**
 * Resuelve un nombre de curso garantizado para cualquier columna ubicada dentro del bloque delimitado.
 */
export function resolveCourseNameByHeader(header: string): NormalizedCourseInfo {
  const normalized = normalizeCourseHeader(header);
  if (normalized) return normalized;

  const rawClean = (header || '').trim();
  return {
    cursoCompleto: rawClean || 'Curso',
    nivel: rawClean || 'Curso',
    letra: 'U',
    regimen: 'JEC',
    esMultigrado: false,
  };
}

/**
 * Extrae referencias a cursos que puedan estar embebidas dentro del texto de la actividad.
 * Ejemplo: "Lenguaje y Comunicación 5° Básico A" -> { cursos: ["5° Básico A"], asignaturaLimpia: "Lenguaje y Comunicación" }
 */
export function extractCoursesFromActivityText(activityText: string): {
  cursos: string[];
  asignaturaLimpia: string;
} {
  if (!activityText) return { cursos: [], asignaturaLimpia: '' };

  const raw = activityText.trim();
  const detectedCourses: string[] = [];
  let cleaned = raw;

  // 1. Detección de rangos de cursos: ej. "1° a 4° Básico", "5° y 6° Básico"
  const rangeMatch = raw.match(/\b([1-8])°?\s*(?:a|al|-|y)\s*([1-8])°?\s*B[AÁ]SICO/i);
  if (rangeMatch) {
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    if (start <= end && end - start <= 8) {
      for (let i = start; i <= end; i++) {
        detectedCourses.push(`${i}° Básico A`);
      }
      cleaned = cleaned.replace(rangeMatch[0], '').trim();
    }
  }

  // 2. Detección de rangos en Media: ej. "1° y 2° Medio"
  const rangeMediaMatch = raw.match(/\b([1-4])°?\s*(?:a|al|-|y)\s*([1-4])°?\s*MEDIO/i);
  if (rangeMediaMatch) {
    const start = parseInt(rangeMediaMatch[1], 10);
    const end = parseInt(rangeMediaMatch[2], 10);
    if (start <= end && end - start <= 4) {
      for (let i = start; i <= end; i++) {
        detectedCourses.push(`${i}° Medio A`);
      }
      cleaned = cleaned.replace(rangeMediaMatch[0], '').trim();
    }
  }

  // 3. Detección de cursos individuales: ej. "5° Básico A", "1° Medio", "Kínder", "Prekínder"
  const singleCourseRegexes = [
    { regex: /\b([1-8])°?\s*B[AÁ]SICO\s*([A-Z])?\b/gi, type: 'BASICA' },
    { regex: /\b([1-4])°?\s*MEDIO(?:\s*(?:HC|TP))?\s*([A-Z])?\b/gi, type: 'MEDIA' },
    { regex: /\b(?:PRE-?K(?:INDER)?|NT1)\s*([A-Z])?\b/gi, type: 'PREKINDER' },
    { regex: /\b(?:K(?:INDER)?|NT2)\s*([A-Z])?\b/gi, type: 'KINDER' },
  ];

  for (const item of singleCourseRegexes) {
    let match: RegExpExecArray | null;
    while ((match = item.regex.exec(raw)) !== null) {
      if (item.type === 'BASICA') {
        const num = match[1];
        const letra = match[2] ? match[2].toUpperCase() : 'A';
        detectedCourses.push(`${num}° Básico ${letra}`);
      } else if (item.type === 'MEDIA') {
        const num = match[1];
        const letra = match[2] ? match[2].toUpperCase() : 'A';
        detectedCourses.push(`${num}° Medio ${letra}`);
      } else if (item.type === 'PREKINDER') {
        const letra = match[1] ? match[1].toUpperCase() : 'A';
        detectedCourses.push(`Pre-Kínder ${letra}`);
      } else if (item.type === 'KINDER') {
        const letra = match[1] ? match[1].toUpperCase() : 'A';
        detectedCourses.push(`Kínder ${letra}`);
      }
      cleaned = cleaned.replace(match[0], '').trim();
    }
  }

  // Limpiar caracteres remanentes como paréntesis vacíos, guiones, comas
  cleaned = cleaned
    .replace(/[()]/g, '')
    .replace(/^[-–—\s,]+|[-–—\s,]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Deduplicar cursos
  const uniqueCourses = Array.from(new Set(detectedCourses));

  return {
    cursos: uniqueCourses,
    asignaturaLimpia: cleaned || raw,
  };
}

/**
 * Consolida la carga horaria total por docente, calculando horas asignadas vs horas de contrato,
 * y diagnosticando el estado de la carga horaria.
 */
export function buildTeacherConsolidatedLoads(teachers: TeacherRecord[]): TeacherConsolidatedLoad[] {
  const teacherMap = new Map<string, {
    rut: string;
    teacher_name: string;
    rbd: string;
    establishment: string;
    comuna?: string;
    contract: number;
    hoursAula: number;
    hoursTecnicas: number;
    hoursDirectivas: number;
    assignments: TeacherCourseAssignment[];
  }>();

  for (const t of teachers) {
    const key = t.rut || t.teacher_name;
    if (!key) continue;

    if (!teacherMap.has(key)) {
      teacherMap.set(key, {
        rut: t.rut,
        teacher_name: t.teacher_name,
        rbd: t.rbd,
        establishment: t.establishment,
        comuna: t.comuna,
        contract: t.total_declared || 0,
        hoursAula: 0,
        hoursTecnicas: 0,
        hoursDirectivas: 0,
        assignments: [],
      });
    }

    const entry = teacherMap.get(key)!;
    if (!entry.comuna && t.comuna) {
      entry.comuna = t.comuna;
    }
    if (t.total_declared && t.total_declared > entry.contract) {
      entry.contract = t.total_declared;
    }

    if (t.category === 'AULA') entry.hoursAula += t.hours;
    else if (t.category === 'TECNICA') entry.hoursTecnicas += t.hours;
    else if (t.category === 'DIRECTIVA') entry.hoursDirectivas += t.hours;

    // Agregar asignaciones de curso
    if (t.desglose_cursos && t.desglose_cursos.length > 0) {
      for (const asig of t.desglose_cursos) {
        entry.assignments.push(asig);
      }
    } else {
      entry.assignments.push({
        curso: t.curso || 'Sin Curso Específico',
        asignatura: t.activity,
        horas: t.hours,
        tipo: t.category === 'AULA' ? 'AULA' : 'OTRO',
      });
    }
  }

  const results: TeacherConsolidatedLoad[] = [];

  teacherMap.forEach((entry) => {
    const totalAsignado = Math.round((entry.hoursAula + entry.hoursTecnicas + entry.hoursDirectivas) * 100) / 100;
    const contract = entry.contract > 0 ? entry.contract : totalAsignado;
    const diferencia = Math.round((totalAsignado - contract) * 100) / 100;
    const isOver44 = totalAsignado > 44.05 || contract > 44.05;

    let estadoCarga: TeacherConsolidatedLoad['estado_carga'] = 'CUADRADA';
    if (isOver44) {
      estadoCarga = 'EXCESO_LEGAL';
    } else if (diferencia > 0.5) {
      estadoCarga = 'SOBREASIGNADA';
    } else if (diferencia < -0.5) {
      estadoCarga = 'SUBASIGNADA';
    }

    results.push({
      rut: entry.rut,
      teacher_name: entry.teacher_name,
      rbd: entry.rbd,
      establishment: entry.establishment,
      comuna: entry.comuna,
      horas_contrato: contract,
      total_asignado: totalAsignado,
      diferencia,
      estado_carga: estadoCarga,
      cursos: entry.assignments,
      horas_aula: Math.round(entry.hoursAula * 100) / 100,
      horas_tecnicas: Math.round(entry.hoursTecnicas * 100) / 100,
      horas_directivas: Math.round(entry.hoursDirectivas * 100) / 100,
      is_over_legal_limit: isOver44,
    });
  });

  return results.sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));
}

/**
 * Agrupa todas las asignaciones por curso para generar la vista "Por Curso".
 */
export function buildCourseLoadSummaries(teachers: TeacherRecord[]): CourseLoadSummary[] {
  const courseMap = new Map<string, CourseLoadSummary>();

  for (const t of teachers) {
    const isNonCourseActivity = !t.curso && (!t.desglose_cursos || t.desglose_cursos.length === 0);
    const actLower = (t.activity || '').toLowerCase();
    if (isNonCourseActivity && (actLower.includes('no lectiv') || actLower.includes('preparaci') || t.category !== 'AULA')) {
      continue;
    }

    const asignaciones = (t.desglose_cursos && t.desglose_cursos.length > 0)
      ? t.desglose_cursos
      : [{
          curso: t.curso || (t.category === 'AULA' ? 'Aula Regular' : 'Funciones Institucionales'),
          asignatura: t.activity,
          horas: t.hours,
          tipo: t.category === 'AULA' ? 'AULA' as const : 'OTRO' as const,
        }];

    for (const asig of asignaciones) {
      if (!asig.curso && (actLower.includes('no lectiv') || actLower.includes('preparaci'))) {
        continue;
      }
      const cNombre = asig.curso || 'Sin Curso Asignado';
      const key = `${t.rbd}-${cNombre}`;

      if (!courseMap.has(key)) {
        const norm = normalizeCourseHeader(cNombre);
        courseMap.set(key, {
          curso: cNombre,
          nivel: norm?.nivel || cNombre,
          letra: norm?.letra || 'A',
          regimen: norm?.regimen || 'JEC',
          rbd: t.rbd,
          establishment: t.establishment,
          comuna: t.comuna,
          total_horas: 0,
          docentes: [],
        });
      }

      const cEntry = courseMap.get(key)!;
      cEntry.total_horas = Math.round((cEntry.total_horas + asig.horas) * 100) / 100;
      cEntry.docentes.push({
        rut: t.rut,
        teacher_name: t.teacher_name,
        asignatura: asig.asignatura || t.activity,
        horas: asig.horas,
        categoria: t.category,
      });
    }
  }

  // Enriquecer cada curso con la comparación frente al Plan de Estudio Oficial Mineduc
  courseMap.forEach((cEntry) => {
    const plan = obtenerPlanPorCurso(cEntry.nivel, cEntry.regimen || 'JEC') || obtenerPlanPorCurso(cEntry.curso, cEntry.regimen || 'JEC');
    if (plan) {
      cEntry.horas_plan_estudio = plan.totalHorasPlan;
      cEntry.horas_obligatorias_plan = plan.horasObligatorias;
      cEntry.horas_libre_disposicion_plan = plan.horasLibreDisposicion;
      cEntry.plan_referencia = plan.nivel;
      cEntry.categoria_plan = plan.categoria;

      const diff = Math.round((cEntry.total_horas - plan.totalHorasPlan) * 100) / 100;
      cEntry.diferencia_horas_plan = diff;
      cEntry.porcentaje_cobertura_plan = plan.totalHorasPlan > 0 ? Math.round((cEntry.total_horas / plan.totalHorasPlan) * 100) : 100;

      if (Math.abs(diff) <= 0.5) {
        cEntry.estado_cobertura = 'CUBIERTO';
      } else if (diff < -0.5) {
        cEntry.estado_cobertura = 'DEFICIT';
      } else {
        cEntry.estado_cobertura = 'SUPERAVIT';
      }
    } else {
      cEntry.estado_cobertura = 'SIN_PLAN';
    }
  });

  return Array.from(courseMap.values()).sort((a, b) => a.curso.localeCompare(b.curso));
}
