import { parseExcelWorkbook, ParsedSchoolResult } from './excelParser';
import { classifyActivitiesHybrid } from './classifier';
import { buildTeacherConsolidatedLoads, buildCourseLoadSummaries } from './courseExtractor';
import { inicializarPlanesEstudioAnalizador } from './planesEstudioBridge';
import { parseAsistentesFromWorkbook } from './asistentesParser';
import { clasificarAsistentesConIa, RawAsistenteInput, AsistenteAnalizadoRecord } from './asistentesClassifier';
import { interpretarNotasDocentesConIa, TeacherNoteInput } from './aiTeacherNotesInterpreter';
import { normalizarCursosConIa } from './aiCourseNormalizer';
import { detectarModalidadEstablecimientoHeuristica } from './aiModalidadDetector';
import * as XLSX from 'xlsx';

/**
 * Ingesta resiliente de un archivo Excel unificando lectura binaria en un solo XLSX.read
 * y ejecutando en Web Worker cuando esté disponible para proteger la tasa de cuadros (60 FPS).
 */
async function parseFileIngest(
  file: File,
  fileIdx: number
): Promise<{ parsed: ParsedSchoolResult; rawAsistentes: RawAsistenteInput[] }> {
  const buffer = await file.arrayBuffer();

  if (typeof Worker !== 'undefined' && typeof window !== 'undefined') {
    try {
      const workerResult = await new Promise<any>((resolve, reject) => {
        const worker = new Worker(new URL('./excelIngest.worker.ts', import.meta.url), { type: 'module' });
        worker.onmessage = (e) => {
          worker.terminate();
          if (e.data.success) resolve(e.data);
          else reject(new Error(e.data.error || 'Fallo worker ingest'));
        };
        worker.onerror = (err) => {
          worker.terminate();
          reject(err);
        };
        worker.postMessage({ fileBuffer: buffer, fileName: file.name, fileIndex: fileIdx });
      });

      const rawAsistentes: RawAsistenteInput[] = (workerResult.asistentes || []).map((ast: any) => ({
        id: `${ast.id}-${fileIdx}`,
        rbd: ast.rbd || '3543',
        establishment: file.name.replace(/\.[^/.]+$/, ''),
        file_name: file.name,
        run: ast.run,
        nombres: ast.nombres,
        apellidos: ast.apellidos,
        cargo_original: ast.cargoFuncion,
        horas_contrato: ast.horasContrato,
        horas_subvencion_general_indefinido: ast.horasSubvencionGeneralIndefinido,
        horas_subvencion_general_plazo_fijo: ast.horasSubvencionGeneralPlazoFijo,
        horas_sep_indefinido: ast.horasSepIndefinido,
        horas_sep_plazo_fijo: ast.horasSepPlazoFijo,
        horas_pie_indefinido: ast.horasPieIndefinido,
        horas_pie_plazo_fijo: ast.horasPiePlazoFijo,
        observaciones_originales: ast.observaciones,
      }));

      return { parsed: workerResult.parsedSchool, rawAsistentes };
    } catch (workerErr) {
      console.warn('Web Worker fallback al hilo principal:', workerErr);
    }
  }

  // Fallback seguro: lectura unificada en hilo principal sin doble deserialización
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, raw: false });
  const rawAsistentes: RawAsistenteInput[] = [];
  try {
    const asistResult = parseAsistentesFromWorkbook(wb, '', 2026);
    if (asistResult.asistentes.length > 0) {
      asistResult.asistentes.forEach((ast) => {
        rawAsistentes.push({
          id: `${ast.id}-${fileIdx}`,
          rbd: ast.rbd || '3543',
          establishment: file.name.replace(/\.[^/.]+$/, ''),
          file_name: file.name,
          run: ast.run,
          nombres: ast.nombres,
          apellidos: ast.apellidos,
          cargo_original: ast.cargoFuncion,
          horas_contrato: ast.horasContrato,
          horas_subvencion_general_indefinido: ast.horasSubvencionGeneralIndefinido,
          horas_subvencion_general_plazo_fijo: ast.horasSubvencionGeneralPlazoFijo,
          horas_sep_indefinido: ast.horasSepIndefinido,
          horas_sep_plazo_fijo: ast.horasSepPlazoFijo,
          horas_pie_indefinido: ast.horasPieIndefinido,
          horas_pie_plazo_fijo: ast.horasPiePlazoFijo,
          observaciones_originales: ast.observaciones,
        });
      });
    }
  } catch (errAsist) {
    console.warn(`No se pudo procesar hoja de asistentes en ${file.name}:`, errAsist);
  }

  const parsed = parseExcelWorkbook(wb, file.name, fileIdx);
  return { parsed, rawAsistentes };
}
import type {
  SchoolSummary,
  TeacherRecord,
  KpiStats,
  ConsolidatedResponse,
  CourseLoadSummary,
  TeacherConsolidatedLoad,
} from '../../types/analizadorTypes';

export interface ProcessDotacionOptions {
  /** Si es false, se omite toda llamada a Gemini y se usa solo el motor heurístico local (rápido, offline). */
  useAiAssistance?: boolean;
  onProgressStep?: (step: string, percent: number) => void;
}

export async function processDotacionFilesClient(
  files: File[],
  apiKey: string,
  modelName: string,
  customPrompt?: string,
  options?: ProcessDotacionOptions
): Promise<ConsolidatedResponse> {
  const onProgress = options?.onProgressStep || (() => {});

  // Con la IA desactivada se entrega una clave vacía: todos los servicios (cursos, notas,
  // clasificación de actividades y asistentes) caen automáticamente a sus heurísticas locales.
  const aiEnabled = options?.useAiAssistance !== false && Boolean(apiKey && apiKey.trim());
  apiKey = aiEnabled ? apiKey : '';
  const modoLabel = aiEnabled ? 'con IA' : 'modo rápido';

  onProgress('Sincronizando planes de estudio y catálogo normativo...', 5);
  // Sincronizar catálogo de planes de estudio desde SQLite para enriquecer el análisis
  await inicializarPlanesEstudioAnalizador();

  const allTeachers: TeacherRecord[] = [];
  const rawAsistentesList: RawAsistenteInput[] = [];
  const schoolsMap = new Map<string, SchoolSummary>();
  const processedFiles: string[] = [];

  onProgress('Extrayendo docentes, cursos y asistentes de planillas...', 15);

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];
    processedFiles.push(file.name);

    try {
      const { parsed, rawAsistentes } = await parseFileIngest(file, fileIdx);
      rawAsistentes.forEach(ast => rawAsistentesList.push(ast));
      parsed.teachers.forEach((t) => allTeachers.push(t));

      // Construcción preliminar de la escuela
      const schoolKey = parsed.rbd || file.name;
      schoolsMap.set(schoolKey, {
        rbd: parsed.rbd,
        establishment: parsed.establishment,
        comuna: parsed.comuna,
        matricula: parsed.matricula,
        horas_aula: 0,
        horas_directivas: 0,
        horas_tecnicas: 0,
        horas_jefatura: 0,
        horas_utp: 0,
        horas_coordinacion_pie: 0,
        horas_convivencia: 0,
        horas_cra_enlaces: 0,
        horas_extraescolar: 0,
        total_horas_ee: 0,
        teachers_count: 0,
        courses_count: 0,
        over_44_count: 0,
        has_discrepancy: false,
        discrepancy_note: '',
        source_file: file.name,
      });
    } catch (err) {
      console.error(`Error procesando archivo ${file.name}:`, err);
    }
  }

  // 2-4. Normalización de cursos, interpretación de notas/funciones fuera de aula y
  // clasificación de actividades. Son etapas independientes: se ejecutan en paralelo.
  onProgress(
    aiEnabled
      ? 'Analizando cursos, funciones fuera de aula y actividades con IA (en paralelo)...'
      : 'Clasificando cursos, funciones y actividades con motor normativo local (modo rápido)...',
    35
  );

  const rawCourseNames = Array.from(
    new Set(
      allTeachers
        .flatMap((t) => [t.curso, ...(t.cursos_asignados || [])])
        .filter((c): c is string => Boolean(c && c.trim()))
    )
  );

  const teacherNoteInputs: TeacherNoteInput[] = allTeachers.map((t) => ({
    rut: t.rut,
    teacher_name: t.teacher_name,
    activity: t.activity,
    hours: t.hours,
    curso: t.curso,
    observaciones: t.observaciones,
  }));

  const uniqueActivities = Array.from(new Set(allTeachers.map((t) => t.activity.trim()))).filter(Boolean);

  let etapasCompletadas = 0;
  const marcarEtapa = (nombre: string) => {
    etapasCompletadas++;
    onProgress(`${nombre} listo (${etapasCompletadas}/3, ${modoLabel})...`, 35 + etapasCompletadas * 12);
  };

  const [courseNormMap, interpretedNotesMap, classification] = await Promise.all([
    normalizarCursosConIa(rawCourseNames, apiKey, modelName).then((r) => {
      marcarEtapa('Normalización de cursos');
      return r;
    }),
    interpretarNotasDocentesConIa(teacherNoteInputs, apiKey, modelName).then((r) => {
      marcarEtapa('Funciones fuera de aula');
      return r;
    }),
    classifyActivitiesHybrid(uniqueActivities, apiKey, modelName, customPrompt).then((r) => {
      marcarEtapa('Clasificación de actividades');
      return r;
    }),
  ]);

  // 5. Asignar resultados enriquecidos a los registros docentes
  allTeachers.forEach((t) => {
    // Normalización de curso
    if (t.curso && courseNormMap.has(t.curso)) {
      const norm = courseNormMap.get(t.curso)!;
      t.nivel_normalizado = norm.nivel_normalizado;
      t.letra_normalizada = norm.letra_normalizada;
    }

    // Interpretación de notas y funciones fuera de aula
    const noteKey = `${t.rut || t.teacher_name}__${t.activity}`;
    if (interpretedNotesMap.has(noteKey)) {
      const interp = interpretedNotesMap.get(noteKey)!;
      t.observaciones_limpias = interp.observaciones_limpias;
      t.dictamen_ia = interp.dictamen_ia;
      t.confianza_ia = interp.confianza;
      t.tipo_funcion_fuera_aula = interp.tipo_funcion_fuera_aula;
      t.horas_jefatura = interp.horas_jefatura;
      t.horas_coordinacion_pie = interp.horas_coordinacion_pie;
      t.horas_convivencia = interp.horas_convivencia;
      t.horas_cra_enlaces = interp.horas_cra_enlaces;
      t.horas_extraescolar = interp.horas_extraescolar;
      if (interp.asignatura_normalizada) {
        t.asignatura_normalizada = interp.asignatura_normalizada;
      }
    }

    // Clasificación de categoría
    const classResult = classification[t.activity.trim()] || {
      category: 'AULA' as const,
      source: 'Regla por Defecto (Atención Alumnos)',
      confidence: 0.7,
    };

    t.category = classResult.category || 'AULA';
    t.source = classResult.source;
  });

  // 6. Recalcular métricas, horas y modalidades por establecimiento
  onProgress('Deduciendo modalidades educativas y matrices de carga...', 80);
  schoolsMap.forEach((school, key) => {
    const schoolTeachers = allTeachers.filter(
      (t) => t.rbd === school.rbd || t.establishment === school.establishment || t.file_name === school.source_file
    );

    let schoolAula = 0;
    let schoolDirectiva = 0;
    let schoolTecnica = 0;
    let schoolJefatura = 0;
    let schoolUtp = 0;
    let schoolCoordPie = 0;
    let schoolConvivencia = 0;
    let schoolCraEnlaces = 0;
    let schoolExtraescolar = 0;

    const teacherNames = new Set<string>();
    const schoolCourses = new Set<string>();
    const teacherContractMap = new Map<string, number>();
    const over44Teachers = new Set<string>();

    schoolTeachers.forEach((t) => {
      teacherNames.add(t.teacher_name || t.rut);
      if (t.curso) schoolCourses.add(t.curso);
      if (t.cursos_asignados) {
        t.cursos_asignados.forEach((c) => schoolCourses.add(c));
      }

      const hours = Math.round(t.hours * 100) / 100;
      if (t.category === 'AULA') schoolAula += hours;
      else if (t.category === 'DIRECTIVA') schoolDirectiva += hours;
      else if (t.category === 'TECNICA') schoolTecnica += hours;

      if (t.horas_jefatura) schoolJefatura += t.horas_jefatura;
      if (t.horas_coordinacion_pie) schoolCoordPie += t.horas_coordinacion_pie;
      if (t.horas_convivencia) schoolConvivencia += t.horas_convivencia;
      if (t.horas_cra_enlaces) schoolCraEnlaces += t.horas_cra_enlaces;
      if (t.horas_extraescolar) schoolExtraescolar += t.horas_extraescolar;
      if (t.tipo_funcion_fuera_aula === 'UTP_CURRICULUM_EVALUACION') schoolUtp += hours;

      const tKey = t.rut || t.teacher_name || 'unknown';
      const decl = t.total_declared || t.hours || 0;
      if (!teacherContractMap.has(tKey) || decl > (teacherContractMap.get(tKey) || 0)) {
        teacherContractMap.set(tKey, decl);
      }
      if (t.is_over_legal_limit) {
        over44Teachers.add(tKey);
      }
    });

    const totalEE = Math.round((schoolAula + schoolDirectiva + schoolTecnica) * 100) / 100;
    const declaredSum = Array.from(teacherContractMap.values()).reduce((acc, val) => acc + val, 0);
    const over44Count = over44Teachers.size;

    let hasDiscrepancy = false;
    const discrepancyParts: string[] = [];

    if (declaredSum > 0 && Math.abs(declaredSum - totalEE) > 1.0) {
      hasDiscrepancy = true;
      discrepancyParts.push(`Descuadre: Suma calculada (${totalEE}h) vs Contrato (${Math.round(declaredSum)}h)`);
    }

    if (over44Count > 0) {
      hasDiscrepancy = true;
      discrepancyParts.push(`⚠️ ${over44Count} docente(s) superan tope legal de 44 hrs`);
    }

    // Modalidad detectada para el establecimiento
    const modalityInfo = detectarModalidadEstablecimientoHeuristica(
      school.rbd,
      school.establishment,
      Array.from(schoolCourses),
      schoolTeachers.map((t) => t.activity)
    );

    school.horas_aula = Math.round(schoolAula * 100) / 100;
    school.horas_directivas = Math.round(schoolDirectiva * 100) / 100;
    school.horas_tecnicas = Math.round(schoolTecnica * 100) / 100;
    school.horas_jefatura = Math.round(schoolJefatura * 100) / 100;
    school.horas_utp = Math.round(schoolUtp * 100) / 100;
    school.horas_coordinacion_pie = Math.round(schoolCoordPie * 100) / 100;
    school.horas_convivencia = Math.round(schoolConvivencia * 100) / 100;
    school.horas_cra_enlaces = Math.round(schoolCraEnlaces * 100) / 100;
    school.horas_extraescolar = Math.round(schoolExtraescolar * 100) / 100;
    school.modalidad_detectada = modalityInfo.modalidad_sugerida;
    school.modalidad_ambigua = modalityInfo.es_ambigua;
    school.total_horas_ee = totalEE;
    school.teachers_count = teacherNames.size;
    school.courses_count = schoolCourses.size;
    school.over_44_count = over44Count;
    school.has_discrepancy = hasDiscrepancy;
    school.discrepancy_note = discrepancyParts.join(' | ');
  });

  const schools = Array.from(schoolsMap.values());

  // 7. Construir consolidado de cursos y carga docente
  const teacherLoads = buildTeacherConsolidatedLoads(allTeachers);
  const courses = buildCourseLoadSummaries(allTeachers);

  // 8. Clasificar asistentes detectados
  onProgress('Auditando y clasificando asistentes de la educación...', 88);
  let enrichedAsistentes: AsistenteAnalizadoRecord[] = [];
  if (rawAsistentesList.length > 0) {
    try {
      enrichedAsistentes = await clasificarAsistentesConIa(
        rawAsistentesList,
        apiKey,
        modelName,
        customPrompt
      );
    } catch (errIa) {
      console.warn('Error clasificando asistentes con IA:', errIa);
    }
  }

  // 9. Calcular KPIs finales
  onProgress('Generando indicadores territoriales y matrices de dotación...', 96);
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

  onProgress('¡Análisis e ingesta completados exitosamente!', 100);

  return {
    schools,
    teachers: allTeachers,
    courses,
    teacherLoads,
    asistentes: enrichedAsistentes,
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
    let jefatura = 0;
    let utp = 0;
    let coordPie = 0;
    let convivencia = 0;
    let craEnlaces = 0;
    let extraescolar = 0;

    const teacherNames = new Set<string>();
    const schoolCourses = new Set<string>();

    schoolTeachers.forEach((t) => {
      teacherNames.add(t.teacher_name || t.rut);
      if (t.curso) schoolCourses.add(t.curso);
      if (t.category === 'AULA') aula += t.hours;
      else if (t.category === 'DIRECTIVA') directiva += t.hours;
      else if (t.category === 'TECNICA') tecnica += t.hours;

      if (t.horas_jefatura) jefatura += t.horas_jefatura;
      if (t.horas_coordinacion_pie) coordPie += t.horas_coordinacion_pie;
      if (t.horas_convivencia) convivencia += t.horas_convivencia;
      if (t.horas_cra_enlaces) craEnlaces += t.horas_cra_enlaces;
      if (t.horas_extraescolar) extraescolar += t.horas_extraescolar;
      if (t.tipo_funcion_fuera_aula === 'UTP_CURRICULUM_EVALUACION') utp += t.hours;
    });

    const totalEE = Math.round((aula + directiva + tecnica) * 100) / 100;

    return {
      ...school,
      horas_aula: Math.round(aula * 100) / 100,
      horas_directivas: Math.round(directiva * 100) / 100,
      horas_tecnicas: Math.round(tecnica * 100) / 100,
      horas_jefatura: Math.round(jefatura * 100) / 100,
      horas_utp: Math.round(utp * 100) / 100,
      horas_coordinacion_pie: Math.round(coordPie * 100) / 100,
      horas_convivencia: Math.round(convivencia * 100) / 100,
      horas_cra_enlaces: Math.round(craEnlaces * 100) / 100,
      horas_extraescolar: Math.round(extraescolar * 100) / 100,
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
