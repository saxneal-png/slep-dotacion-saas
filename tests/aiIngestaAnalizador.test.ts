import { describe, it, expect } from 'vitest';
import {
  interpretarNotasDocenteHeuristica,
  interpretarNotasDocentesConIa,
  TeacherNoteInput,
} from '../src/services/analizador/aiTeacherNotesInterpreter';
import {
  normalizarCursoHeuristica,
  normalizarCursosConIa,
} from '../src/services/analizador/aiCourseNormalizer';

describe('AI-Assisted Ingestion & Normalization Engine', () => {
  describe('aiTeacherNotesInterpreter - Heuristics & Analysis', () => {
    it('debe detectar funciones directivas correctamente', () => {
      const input: TeacherNoteInput = {
        rut: '11.111.111-1',
        teacher_name: 'Director Ejemplo',
        activity: 'DIRECTOR ESTABLECIMIENTO',
        hours: 44,
      };
      const result = interpretarNotasDocenteHeuristica(input);
      expect(result.horas_directivas).toBe(44);
      expect(result.horas_aula).toBe(0);
      expect(result.asignatura_normalizada).toBe('Función Directiva Institucional');
    });

    it('debe clasificar horas de UTP y Currículum', () => {
      const input: TeacherNoteInput = {
        rut: '12.222.222-2',
        teacher_name: 'Jefe UTP',
        activity: 'JEFE UTP Y EVALUACION',
        hours: 30,
      };
      const result = interpretarNotasDocenteHeuristica(input);
      expect(result.horas_tecnicas).toBe(30);
      expect(result.horas_aula).toBe(0);
      expect(result.asignatura_normalizada).toBe('Unidad Técnico Pedagógica (UTP)');
    });

    it('debe identificar Co-Docencia y Coordinación PIE', () => {
      const inputPie: TeacherNoteInput = {
        rut: '13.333.333-3',
        teacher_name: 'Profesor PIE',
        activity: 'Co-docencia aula regular PIE',
        hours: 12,
        observaciones: 'Apoyo Dto 170',
      };
      const result = interpretarNotasDocenteHeuristica(inputPie);
      expect(result.es_co_docencia).toBe(true);
    });

    it('debe identificar Talleres SEP', () => {
      const inputSep: TeacherNoteInput = {
        rut: '14.444.444-4',
        teacher_name: 'Profesor Taller',
        activity: 'TALLER SEP ROBOTICA',
        hours: 4,
      };
      const result = interpretarNotasDocenteHeuristica(inputSep);
      expect(result.es_taller_sep).toBe(true);
    });

    it('debe procesar lote con fallback heurístico cuando no hay apiKey', async () => {
      const inputs: TeacherNoteInput[] = [
        { rut: '1', teacher_name: 'T1', activity: 'DIRECTOR', hours: 44 },
        { rut: '2', teacher_name: 'T2', activity: 'LENGUAJE 5B', hours: 6 },
      ];
      const resMap = await interpretarNotasDocentesConIa(inputs, '');
      expect(resMap.size).toBe(2);
      expect(resMap.get('1__DIRECTOR')?.horas_directivas).toBe(44);
      expect(resMap.get('2__LENGUAJE 5B')?.horas_aula).toBe(6);
    });
  });

  describe('aiCourseNormalizer - Chilean MINEDUC SIGE levels', () => {
    it('debe normalizar educación parvularia', () => {
      const r1 = normalizarCursoHeuristica('Pre-kinder A');
      expect(r1.nivel_normalizado).toBe('NT1 (Pre-Kínder)');
      expect(r1.letra_normalizada).toBe('A');

      const r2 = normalizarCursoHeuristica('Kínder B');
      expect(r2.nivel_normalizado).toBe('NT2 (Kínder)');
      expect(r2.letra_normalizada).toBe('B');
    });

    it('debe normalizar cursos de educación básica', () => {
      const r1 = normalizarCursoHeuristica('1° Basico A');
      expect(r1.nivel_normalizado).toBe('1° Básico');
      expect(r1.letra_normalizada).toBe('A');

      const r8 = normalizarCursoHeuristica('8vo Basico');
      expect(r8.nivel_normalizado).toBe('8° Básico');
    });

    it('debe normalizar cursos de educación media HC y TP', () => {
      const hc = normalizarCursoHeuristica('1 Medio A');
      expect(hc.nivel_normalizado).toBe('1° Medio HC');
      expect(hc.es_tp).toBe(false);

      const tp = normalizarCursoHeuristica('3° Medio Agropecuario TP');
      expect(tp.nivel_normalizado).toBe('3° Medio TP');
      expect(tp.es_tp).toBe(true);
    });

    it('debe normalizar cursos multigrado rurales', () => {
      const multi = normalizarCursoHeuristica('Multigrado 1 a 6 basico');
      expect(multi.es_multigrado).toBe(true);
      expect(multi.nivel_normalizado).toContain('Multigrado');
      expect(multi.letra_normalizada).toBe('U');
    });

    it('debe procesar lote de cursos con normalizarCursosConIa sin API key', async () => {
      const courses = ['1° Básico A', '2° Medio TP', 'Multigrado 1-4'];
      const map = await normalizarCursosConIa(courses, '');
      expect(map.size).toBe(3);
      expect(map.get('1° Básico A')?.nivel_normalizado).toBe('1° Básico');
      expect(map.get('2° Medio TP')?.es_tp).toBe(true);
      expect(map.get('Multigrado 1-4')?.es_multigrado).toBe(true);
    });
  });

  describe('Control de Asistencia IA (Activar / Desactivar)', () => {
    it('debe operar en modo rápido offline cuando useAiAssistance es false incluso si se provee apiKey', async () => {
      // Si useAiAssistance es false, el procesador pasa clave vacía internamente a los clasificadores
      const inputs: TeacherNoteInput[] = [
        { rut: '15.555.555-5', teacher_name: 'Profesor Jefe 2', activity: 'JEFATURA DE CURSO 8°B', hours: 2 },
      ];
      // Con apiKey vacía (comportamiento cuando useAiAssistance es false)
      const resMap = await interpretarNotasDocentesConIa(inputs, '');
      expect(resMap.size).toBe(1);
      const res = resMap.get('15.555.555-5__JEFATURA DE CURSO 8°B');
      expect(res).toBeDefined();
      expect(res?.horas_jefatura).toBe(2);
      expect(res?.tipo_funcion_fuera_aula).toBe('JEFATURA_CURSO');
    });
  });
});

