import { parseExcelBrowser } from './excelParser';
import { classifyActivitiesHybrid } from './classifier';
import { buildTeacherConsolidatedLoads, buildCourseLoadSummaries } from './courseExtractor';
import type {
  SchoolSummary,
  TeacherRecord,
  KpiStats,
  ConsolidatedResponse,
  CourseLoadSummary,
  TeacherConsolidatedLoad,
} from '../../types/analizadorTypes';

export async function processDotacionFilesClient(
  files: File[],
  apiKey: string,
  modelName: string,
  customPrompt?: string
): Promise<ConsolidatedResponse> {
  const allTeachers: TeacherRecord[] = [];
  const schoolsMap = new Map<string, SchoolSummary>();
  const processedFiles: string[] = [];

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    processedFiles.push(file.name);

    try {
      const parsed = await parseExcelBrowser(file, fileIdx);
      const uniqueActivities = Array.from(new Set(parsed.teachers.map((t) => t.activity.trim()))).filter(Boolean);

      // Clasificación híbrida (Diccionario chileno + Gemini AI)
      const classification = await classifyActivitiesHybrid(
        uniqueActivities,
        apiKey,
        modelName,
        customPrompt
      );

      let schoolAula = 0;
      let schoolDirectiva = 0;
      let schoolTecnica = 0;
      const teacherNames = new Set<string>();
      const schoolCourses = new Set<string>();

      parsed.teachers.forEach((t) => {
        teacherNames.add(t.teacher_name || t.rut);
        if (t.curso) schoolCourses.add(t.curso);
        if (t.cursos_asignados) {
          t.cursos_asignados.forEach((c) => schoolCourses.add(c));
        }

        const classResult = classification[t.activity.trim()] || {
          category: 'AULA' as const,
          source: 'Regla por Defecto (Atención Alumnos)',
          confidence: 0.7,
        };

        const cat = classResult.category || 'AULA';
        const hours = Math.round(t.hours * 100) / 100;

        if (cat === 'AULA') schoolAula += hours;
        else if (cat === 'DIRECTIVA') schoolDirectiva += hours;
        else if (cat === 'TECNICA') schoolTecnica += hours;

        t.category = cat;
        t.source = classResult.source;

        allTeachers.push(t);
      });

      const totalEE = Math.round((schoolAula + schoolDirectiva + schoolTecnica) * 100) / 100;

      // Validación de cuadratura
      let hasDiscrepancy = false;
      const discrepancyParts: string[] = [];

      const teacherContractMap = new Map<string, number>();
      const over44Teachers = new Set<string>();

      parsed.teachers.forEach((t) => {
        const key = t.rut || t.teacher_name || 'unknown';
        const decl = t.total_declared || t.hours || 0;
        if (!teacherContractMap.has(key) || decl > (teacherContractMap.get(key) || 0)) {
          teacherContractMap.set(key, decl);
        }
        if (t.is_over_legal_limit) {
          over44Teachers.add(key);
        }
      });
      const declaredSum = Array.from(teacherContractMap.values()).reduce((acc, val) => acc + val, 0);
      const over44Count = over44Teachers.size;

      if (declaredSum > 0 && Math.abs(declaredSum - totalEE) > 1.0) {
        hasDiscrepancy = true;
        discrepancyParts.push(`Descuadre: Suma calculada (${totalEE}h) vs Contrato (${Math.round(declaredSum)}h)`);
      }

      if (over44Count > 0) {
        hasDiscrepancy = true;
        discrepancyParts.push(`⚠️ ${over44Count} docente(s) superan tope legal de 44 hrs`);
      }

      const discrepancyNote = discrepancyParts.join(' | ');
      const schoolKey = parsed.rbd || file.name;

      schoolsMap.set(schoolKey, {
        rbd: parsed.rbd,
        establishment: parsed.establishment,
        comuna: parsed.comuna,
        matricula: parsed.matricula,
        horas_aula: Math.round(schoolAula * 100) / 100,
        horas_directivas: Math.round(schoolDirectiva * 100) / 100,
        horas_tecnicas: Math.round(schoolTecnica * 100) / 100,
        total_horas_ee: totalEE,
        teachers_count: teacherNames.size,
        courses_count: schoolCourses.size,
        over_44_count: over44Count,
        has_discrepancy: hasDiscrepancy,
        discrepancy_note: discrepancyNote,
        source_file: file.name,
      });
    } catch (err) {
      console.error(`Error procesando archivo ${file.name}:`, err);
    }
  }

  const schools = Array.from(schoolsMap.values());

  // Construir consolidado de cursos y carga docente
  const teacherLoads = buildTeacherConsolidatedLoads(allTeachers);
  const courses = buildCourseLoadSummaries(allTeachers);

  // Calcular KPIs
  const totalSchools = schools.length;
  const totalTeachers = new Set(allTeachers.map((t) => t.rut || t.teacher_name)).size;
  const totalMatricula = schools.reduce((acc, s) => acc + (s.matricula || 0), 0);
  const totalCourses = courses.length;
  const totalComunas = new Set(schools.map((s) => s.comuna).filter(Boolean)).size;

  const totalAula = Math.round(schools.reduce((acc, s) => acc + s.horas_aula, 0) * 100) / 100;
  const totalDirectivas = Math.round(schools.reduce((acc, s) => acc + s.horas_directivas, 0) * 100) / 100;
  const totalTecnicas = Math.round(schools.reduce((acc, s) => acc + s.horas_tecnicas, 0) * 100) / 100;
  const totalGeneral = Math.round((totalAula + totalDirectivas + totalTecnicas) * 100) / 100;

  const pctAula = totalGeneral > 0 ? Math.round((totalAula / totalGeneral) * 1000) / 10 : 0;
  const pctDirectivas = totalGeneral > 0 ? Math.round((totalDirectivas / totalGeneral) * 1000) / 10 : 0;
  const pctTecnicas = totalGeneral > 0 ? Math.round((totalTecnicas / totalGeneral) * 1000) / 10 : 0;
  const discrepanciesCount = schools.filter((s) => s.has_discrepancy).length;

  const teachersOver44Count = teacherLoads.filter((d) => d.is_over_legal_limit).length;
  const teachersSubasignadosCount = teacherLoads.filter((d) => d.estado_carga === 'SUBASIGNADA').length;
  const teachersSobreasignadosCount = teacherLoads.filter((d) => d.estado_carga === 'SOBREASIGNADA').length;

  const kpis: KpiStats = {
    total_schools: totalSchools,
    total_teachers: totalTeachers,
    total_matricula: totalMatricula,
    total_courses: totalCourses,
    total_comunas: totalComunas,
    total_horas_general: totalGeneral,
    total_horas_aula: totalAula,
    total_horas_directivas: totalDirectivas,
    total_horas_tecnicas: totalTecnicas,
    pct_aula: pctAula,
    pct_directivas: pctDirectivas,
    pct_tecnicas: pctTecnicas,
    discrepancies_count: discrepanciesCount,
    teachers_over_44_count: teachersOver44Count,
    teachers_subasignados_count: teachersSubasignadosCount,
    teachers_sobreasignados_count: teachersSobreasignadosCount,
  };

  return {
    schools,
    teachers: allTeachers,
    courses,
    teacherLoads,
    kpis,
    processed_files: processedFiles,
  };
}

export function recalculateSchoolTotals(
  teachers: TeacherRecord[],
  currentSchools: SchoolSummary[]
): {
  schools: SchoolSummary[];
  kpis: KpiStats;
  courses: CourseLoadSummary[];
  teacherLoads: TeacherConsolidatedLoad[];
} {
  const teacherLoads = buildTeacherConsolidatedLoads(teachers);
  const courses = buildCourseLoadSummaries(teachers);

  const updatedSchools = currentSchools.map((school) => {
    const schoolTeachers = teachers.filter((t) => t.rbd === school.rbd || t.establishment === school.establishment);

    let aula = 0;
    let directiva = 0;
    let tecnica = 0;
    const teacherNames = new Set<string>();
    const schoolCourses = new Set<string>();

    schoolTeachers.forEach((t) => {
      teacherNames.add(t.teacher_name || t.rut);
      if (t.curso) schoolCourses.add(t.curso);
      if (t.category === 'AULA') aula += t.hours;
      else if (t.category === 'DIRECTIVA') directiva += t.hours;
      else if (t.category === 'TECNICA') tecnica += t.hours;
    });

    const totalEE = Math.round((aula + directiva + tecnica) * 100) / 100;

    return {
      ...school,
      horas_aula: Math.round(aula * 100) / 100,
      horas_directivas: Math.round(directiva * 100) / 100,
      horas_tecnicas: Math.round(tecnica * 100) / 100,
      total_horas_ee: totalEE,
      teachers_count: teacherNames.size,
      courses_count: schoolCourses.size,
    };
  });

  const totalAula = Math.round(updatedSchools.reduce((acc, s) => acc + s.horas_aula, 0) * 100) / 100;
  const totalDirectivas = Math.round(updatedSchools.reduce((acc, s) => acc + s.horas_directivas, 0) * 100) / 100;
  const totalTecnicas = Math.round(updatedSchools.reduce((acc, s) => acc + s.horas_tecnicas, 0) * 100) / 100;
  const totalGeneral = Math.round((totalAula + totalDirectivas + totalTecnicas) * 100) / 100;

  const pctAula = totalGeneral > 0 ? Math.round((totalAula / totalGeneral) * 1000) / 10 : 0;
  const pctDirectivas = totalGeneral > 0 ? Math.round((totalDirectivas / totalGeneral) * 1000) / 10 : 0;
  const pctTecnicas = totalGeneral > 0 ? Math.round((totalTecnicas / totalGeneral) * 1000) / 10 : 0;

  const kpis: KpiStats = {
    total_schools: updatedSchools.length,
    total_teachers: new Set(teachers.map((t) => t.rut || t.teacher_name)).size,
    total_matricula: updatedSchools.reduce((acc, s) => acc + (s.matricula || 0), 0),
    total_courses: courses.length,
    total_comunas: new Set(updatedSchools.map((s) => s.comuna).filter(Boolean)).size,
    total_horas_general: totalGeneral,
    total_horas_aula: totalAula,
    total_horas_directivas: totalDirectivas,
    total_horas_tecnicas: totalTecnicas,
    pct_aula: pctAula,
    pct_directivas: pctDirectivas,
    pct_tecnicas: pctTecnicas,
    discrepancies_count: updatedSchools.filter((s) => s.has_discrepancy).length,
    teachers_over_44_count: teacherLoads.filter((d) => d.is_over_legal_limit).length,
    teachers_subasignados_count: teacherLoads.filter((d) => d.estado_carga === 'SUBASIGNADA').length,
    teachers_sobreasignados_count: teacherLoads.filter((d) => d.estado_carga === 'SOBREASIGNADA').length,
  };

  return { schools: updatedSchools, kpis, courses, teacherLoads };
}
