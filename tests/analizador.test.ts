import { describe, it, expect } from 'vitest';
import {
  normalizeCourseHeader,
  extractCoursesFromActivityText,
  buildTeacherConsolidatedLoads,
  buildCourseLoadSummaries,
} from '../src/services/analizador/courseExtractor';
import { classifyLocal } from '../src/services/analizador/classifier';
import { parseHoursCell } from '../src/services/analizador/excelParser';
import type { TeacherRecord } from '../src/types/analizadorTypes';

describe('Analizador - Extractor y Normalizador de Cursos', () => {
  it('normaliza encabezados de cursos en formato matricial', () => {
    const c1 = normalizeCourseHeader('1° BASICO A');
    expect(c1).not.toBeNull();
    expect(c1?.nivel).toBe('1° Básico');
    expect(c1?.letra).toBe('A');

    const c2 = normalizeCourseHeader('5°B');
    expect(c2).not.toBeNull();
    expect(c2?.nivel).toBe('5° Básico');
    expect(c2?.letra).toBe('B');

    const c3 = normalizeCourseHeader('1° MEDIO');
    expect(c3).not.toBeNull();
    expect(c3?.nivel).toBe('1° Medio');

    const c4 = normalizeCourseHeader('NT1');
    expect(c4).not.toBeNull();
    expect(c4?.nivel).toBe('Pre-Kínder');

    const c5 = normalizeCourseHeader('K');
    expect(c5).not.toBeNull();
    expect(c5?.nivel).toBe('Kínder');

    const c6 = normalizeCourseHeader('1°-4° BASICO');
    expect(c6).not.toBeNull();
    expect(c6?.esMultigrado).toBe(true);

    const notCourse = normalizeCourseHeader('HORAS CONTRATO');
    expect(notCourse).toBeNull();
  });

  it('extrae cursos embebidos en el texto de la actividad', () => {
    const res1 = extractCoursesFromActivityText('Lenguaje y Comunicación 5° Básico A');
    expect(res1.cursos).toContain('5° Básico A');
    expect(res1.asignaturaLimpia).toBe('Lenguaje y Comunicación');

    const res2 = extractCoursesFromActivityText('Matemática 1° y 2° Medio');
    expect(res2.cursos).toContain('1° Medio A');
    expect(res2.cursos).toContain('2° Medio A');

    const res3 = extractCoursesFromActivityText('Educación Parvularia Kínder');
    expect(res3.cursos).toContain('Kínder A');
  });

  it('calcula la carga asignada y detecta estado de carga', () => {
    const mockTeachers: TeacherRecord[] = [
      {
        id: '1',
        file_name: 'test.xlsx',
        rbd: '17822',
        establishment: 'ESCUELA ARTURO MERINO',
        rut: '12.345.678-9',
        teacher_name: 'PROFESOR CUADRADO',
        activity: 'Lenguaje 5° Básico A',
        curso: '5° Básico A',
        hours: 44,
        category: 'AULA',
        source: 'Test',
        total_declared: 44,
        total_teacher_hours: 44,
      },
      {
        id: '2',
        file_name: 'test.xlsx',
        rbd: '17822',
        establishment: 'ESCUELA ARTURO MERINO',
        rut: '14.567.890-1',
        teacher_name: 'PROFESOR PENDIENTE',
        activity: 'Matemática',
        curso: '6° Básico B',
        hours: 30,
        category: 'AULA',
        source: 'Test',
        total_declared: 44,
        total_teacher_hours: 30,
      },
      {
        id: '3',
        file_name: 'test.xlsx',
        rbd: '17822',
        establishment: 'ESCUELA ARTURO MERINO',
        rut: '16.789.012-3',
        teacher_name: 'PROFESOR SOBRECARGA LEGAL',
        activity: 'Ciencias',
        hours: 48,
        category: 'AULA',
        source: 'Test',
        total_declared: 48,
        total_teacher_hours: 48,
        is_over_legal_limit: true,
      },
    ];

    const loads = buildTeacherConsolidatedLoads(mockTeachers);
    expect(loads.length).toBe(3);

    const cuadrado = loads.find((d) => d.rut === '12.345.678-9');
    expect(cuadrado?.estado_carga).toBe('CUADRADA');
    expect(cuadrado?.diferencia).toBe(0);

    const sub = loads.find((d) => d.rut === '14.567.890-1');
    expect(sub?.estado_carga).toBe('SUBASIGNADA');
    expect(sub?.diferencia).toBe(-14);

    const sobre = loads.find((d) => d.rut === '16.789.012-3');
    expect(sobre?.estado_carga).toBe('EXCESO_LEGAL');
    expect(sobre?.is_over_legal_limit).toBe(true);
  });

  it('construye el resumen por curso', () => {
    const mockTeachers: TeacherRecord[] = [
      {
        id: '1',
        file_name: 'test.xlsx',
        rbd: '17822',
        establishment: 'ESCUELA TEST',
        rut: '11.111.111-1',
        teacher_name: 'JUAN PEREZ',
        activity: 'Lenguaje',
        curso: '5° Básico A',
        hours: 8,
        category: 'AULA',
        source: 'Test',
      },
      {
        id: '2',
        file_name: 'test.xlsx',
        rbd: '17822',
        establishment: 'ESCUELA TEST',
        rut: '22.222.222-2',
        teacher_name: 'MARIA LOPEZ',
        activity: 'Matemática',
        curso: '5° Básico A',
        hours: 8,
        category: 'AULA',
        source: 'Test',
      },
    ];

    const courses = buildCourseLoadSummaries(mockTeachers);
    expect(courses.length).toBe(1);
    expect(courses[0].curso).toBe('5° Básico A');
    expect(courses[0].total_horas).toBe(16);
    expect(courses[0].docentes.length).toBe(2);
  });
});

describe('Analizador - Clasificador Chileno y Horas', () => {
  it('clasifica correctamente los cargos según Estatuto Docente', () => {
    expect(classifyLocal('Director')?.category).toBe('DIRECTIVA');
    expect(classifyLocal('Inspector General')?.category).toBe('DIRECTIVA');
    expect(classifyLocal('Jefe UTP')?.category).toBe('TECNICA');
    expect(classifyLocal('Coordinación PIE')?.category).toBe('TECNICA');
    expect(classifyLocal('Encargado CRA')?.category).toBe('TECNICA');
    expect(classifyLocal('Lenguaje y Comunicación')?.category).toBe('AULA');
    expect(classifyLocal('Recreos 65/35')?.category).toBe('AULA');
    expect(classifyLocal('Horas no lectivas 60/40')?.category).toBe('AULA');
  });

  it('convierte formatos horarios complejos a decimales exactos', () => {
    expect(parseHoursCell('44')).toBe(44);
    expect(parseHoursCell('44.5')).toBe(44.5);
    expect(parseHoursCell('12:00')).toBe(12);
    expect(parseHoursCell('1:30')).toBe(1.5);
    expect(parseHoursCell('6h 30m')).toBe(6.5);
  });
});

describe('Analizador - Planillas Oficiales SLEP con Cursos entre CONTRATA PIE y TOTAL HA*', () => {
  it('reconoce encabezados de cursos con dígitos puros 1 a 8 y NT1/NT2', () => {
    for (let i = 1; i <= 8; i++) {
      const c = normalizeCourseHeader(String(i));
      expect(c).not.toBeNull();
      expect(c?.nivel).toBe(`${i}° Básico`);
    }

    const nt1 = normalizeCourseHeader('NT1');
    expect(nt1?.nivel).toBe('Pre-Kínder');

    const nt2 = normalizeCourseHeader('NT2');
    expect(nt2?.nivel).toBe('Kínder');
  });

  it('interpreta correctamente la estructura SLEP Fila 2 con columnas de curso delimitadas', async () => {
    const XLSX = await import('xlsx');
    const { parseExcelBrowser } = await import('../src/services/analizador/excelParser');

    // Construcción de la matriz según el formato oficial SLEP provisto por el usuario
    const sheetData = [
      // Fila 1: Título o metadatos de establecimiento
      ['SERVICIO LOCAL DE EDUCACION PUBLICA VALLE DIGUILLIN', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
      // Fila 2 (índice 1): Encabezados oficiales
      [
        'NOMBRES', 'RUN', 'HORAS CONTRATO',
        'TITULARES SUB GRAL', 'CONTRATA SUB GRAL',
        'TITULARES SEP', 'CONTRATA SEP',
        'TITULARES PIE', 'CONTRATA PIE',
        'NT1', 'NT2', '1', '2', '3', '4', '5', '6', '7', '8',
        'TOTAL HA*',
        'TOTAL HC** Sub. Gral', 'TOTAL HC** Sub. SEP', 'TOTAL HC** Sub. PIE', 'TOTAL HC'
      ],
      // Fila 3 (índice 2): Docente con horas en cursos
      [
        'GARCIA CORVALAN, NATALY GRACE', '16.735.997-3', 39,
        30, '',
        6, '',
        '', '',
        '', '', 4, 6, '', '', '', '', '', '',
        10,
        30, 6, '', 39
      ]
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    XLSX.utils.book_append_sheet(wb, ws, 'DOTACION 2026');

    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });

    const mockFile = {
      name: '17822 ESCUELA ARTURO MERINO.xlsx',
      arrayBuffer: async () => {
        const u8 = new Uint8Array(wbOut);
        return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      },
    } as unknown as File;

    const result = await parseExcelBrowser(mockFile);

    expect(result.teachers.length).toBeGreaterThan(0);
    const teacher = result.teachers.find(t => t.rut.includes('16.735.997'));
    expect(teacher).toBeDefined();
    expect(teacher?.teacher_name).toBe('GARCIA CORVALAN, NATALY GRACE');
    expect(teacher?.total_declared).toBe(39);

    // Debe haber detectado los cursos asignados: 1° Básico (4h) y 2° Básico (6h)
    const allCourses = result.teachers.flatMap(t => t.cursos_asignados || []);
    expect(allCourses).toContain('1° Básico');
    expect(allCourses).toContain('2° Básico');

    // Consolidación por docente
    const consolidated = buildTeacherConsolidatedLoads(result.teachers);
    const nataly = consolidated.find(d => d.rut.includes('16.735.997'));
    expect(nataly).toBeDefined();
    expect(nataly?.horas_contrato).toBe(39);
    expect(nataly?.total_asignado).toBe(39);
    expect(nataly?.estado_carga).toBe('CUADRADA');

    // Resumen por curso
    const courseSummaries = buildCourseLoadSummaries(result.teachers);
    const curso1 = courseSummaries.find(c => c.curso === '1° Básico');
    expect(curso1).toBeDefined();
    expect(curso1?.total_horas).toBe(4);

    const curso2 = courseSummaries.find(c => c.curso === '2° Básico');
    expect(curso2).toBeDefined();
    expect(curso2?.total_horas).toBe(6);
  });

  it('normaliza cursos TP y EPJA y calcula la cobertura del plan de estudio oficial', () => {
    // 1. Normalización TP
    const tp1 = normalizeCourseHeader('3° MEDIO TP AGROPECUARIA');
    expect(tp1).not.toBeNull();
    expect(tp1?.nivel).toContain('Agropecuaria');

    // 2. Normalización EPJA
    const epja1 = normalizeCourseHeader('EPJA TERCER NIVEL BASICA');
    expect(epja1).not.toBeNull();
    expect(epja1?.nivel).toContain('Nivel 3');

    // 3. Resumen de carga con plan de estudio
    const tpTeachers: TeacherRecord[] = [
      {
        id: 'tp-1',
        file_name: 'liceo_tp.xlsx',
        rbd: '22334',
        establishment: 'LICEO POLIVALENTE',
        rut: '15.111.222-3',
        teacher_name: 'DOCENTE TP',
        activity: 'Módulos Agropecuaria',
        curso: '3° Medio TP Agropecuaria A',
        hours: 42,
        category: 'AULA',
        source: 'Test',
      }
    ];

    const tpSummaries = buildCourseLoadSummaries(tpTeachers);
    expect(tpSummaries.length).toBe(1);
    const agroCourse = tpSummaries[0];
    expect(agroCourse.horas_plan_estudio).toBe(42);
    expect(agroCourse.total_horas).toBe(42);
    expect(agroCourse.estado_cobertura).toBe('CUBIERTO');
    expect(agroCourse.porcentaje_cobertura_plan).toBe(100);
    expect(agroCourse.plan_referencia).toContain('Agropecuaria');
  });

  it('reconoce 3° Medio Atención de Párvulos como TP y no como Parvularia regular', () => {
    const rawCourse = '3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP) A';
    const norm = normalizeCourseHeader(rawCourse);
    expect(norm).not.toBeNull();
    expect(norm?.nivel).toBe('3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)');

    const mockTeachers: TeacherRecord[] = [
      {
        id: 'parv-tp-1',
        file_name: 'liceo_tp.xlsx',
        rbd: '22334',
        establishment: 'LICEO TECNICO',
        rut: '17.222.333-4',
        teacher_name: 'DOCENTE PARVULOS TP',
        activity: 'Módulo: Material didáctico y de ambientación',
        curso: rawCourse,
        hours: 42,
        category: 'AULA',
        source: 'Test',
      }
    ];

    const summaries = buildCourseLoadSummaries(mockTeachers);
    expect(summaries.length).toBe(1);
    expect(summaries[0].categoria_plan).toBe('MEDIA_TP');
    expect(summaries[0].horas_plan_estudio).toBe(42);
    expect(summaries[0].estado_cobertura).toBe('CUBIERTO');
    expect(summaries[0].plan_referencia).toContain('Atención de Párvulos');
  });
});


