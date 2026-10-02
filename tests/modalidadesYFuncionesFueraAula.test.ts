import { describe, it, expect } from 'vitest';
import {
  detectarModalidadCursoHeuristica,
  detectarModalidadEstablecimientoHeuristica,
  auditarModalidadesConIa,
} from '../src/services/analizador/aiModalidadDetector';
import {
  interpretarNotasDocenteHeuristica,
  interpretarNotasDocentesConIa,
  TeacherNoteInput,
} from '../src/services/analizador/aiTeacherNotesInterpreter';

describe('Modalidades Educativas y Funciones Fuera del Aula', () => {
  describe('Detección de Modalidad de Cursos y Establecimientos', () => {
    it('debe detectar modalidad Básica Regular', () => {
      const c = detectarModalidadCursoHeuristica('5° Básico A');
      expect(c.modalidad).toBe('REGULAR_BASICA');
      expect(c.es_multigrado).toBe(false);
      expect(c.es_adultos).toBe(false);
    });

    it('debe detectar modalidad Media Humanístico-Científica', () => {
      const c = detectarModalidadCursoHeuristica('2° Medio B');
      expect(c.modalidad).toBe('REGULAR_MEDIA_HC');
    });

    it('debe detectar modalidad Media Técnico Profesional con especialidad', () => {
      const c = detectarModalidadCursoHeuristica('3° Medio Agropecuaria TP', ['Módulo de Riego', 'Taller Agro']);
      expect(c.modalidad).toBe('MEDIA_TP');
      expect(c.especialidad_tp).toBe('Agropecuaria');
    });

    it('debe detectar modalidad EPJA Adultos', () => {
      const bAdultos = detectarModalidadCursoHeuristica('1° Nivel Básico Adultos');
      expect(bAdultos.modalidad).toBe('EPJA_BASICA');
      expect(bAdultos.es_adultos).toBe(true);

      const mAdultos = detectarModalidadCursoHeuristica('2° Nivel Medio Adultos HC');
      expect(mAdultos.modalidad).toBe('EPJA_MEDIA_HC');
      expect(mAdultos.es_adultos).toBe(true);
    });

    it('debe detectar escuelas rurales multigrado', () => {
      const multi = detectarModalidadCursoHeuristica('Multigrado 1°-6° Básico');
      expect(multi.modalidad).toBe('RURAL_MULTIGRADO');
      expect(multi.es_multigrado).toBe(true);
    });

    it('debe clasificar un establecimiento polivalente con cursos mixtos como ambiguo', () => {
      const courses = ['1° Medio A', '2° Medio A', '3° Medio HC A', '3° Medio Mecánica TP B', '4° Medio Agro TP'];
      const sch = detectarModalidadEstablecimientoHeuristica('3543', 'Liceo Bicentenario Polivalente', courses);
      expect(sch.modalidad_sugerida).toBe('POLIVALENTE_MIXTO');
      expect(sch.es_polivalente).toBe(true);
      expect(sch.es_ambigua).toBe(true);
      expect(sch.especialidades_detectadas).toContain('Mecánica Industrial');
    });

    it('debe auditar modalidades en lote con fallback sin API Key', async () => {
      const schools = [
        { rbd: '101', establishment: 'Escuela Básica San Pedro', courses: ['1° Básico', '2° Básico'] },
        { rbd: '102', establishment: 'CEIA Adultos', courses: ['1° Nivel Básico Adultos'] },
      ];
      const res = await auditarModalidadesConIa(schools, '');
      expect(res.size).toBe(2);
      expect(res.get('101')?.modalidad_sugerida).toBe('REGULAR_BASICA');
      expect(res.get('102')?.modalidad_sugerida).toBe('EPJA_BASICA');
    });
  });

  describe('Clasificación Granular de Funciones Fuera del Aula', () => {
    it('debe identificar Jefatura de Curso y registrar horas técnicas/jefatura', () => {
      const input: TeacherNoteInput = {
        rut: '1-1',
        teacher_name: 'Profesor Jefe',
        activity: 'Jefatura de Curso 6° Básico',
        hours: 2,
      };
      const res = interpretarNotasDocenteHeuristica(input);
      expect(res.tipo_funcion_fuera_aula).toBe('JEFATURA_CURSO');
      expect(res.horas_jefatura).toBe(2);
      expect(res.horas_tecnicas).toBe(2);
      expect(res.horas_aula).toBe(0);
    });

    it('debe identificar Profesor Encargado de Escuela Rural', () => {
      const input: TeacherNoteInput = {
        rut: '2-2',
        teacher_name: 'Encargado Rural',
        activity: 'Profesor Encargado de Escuela Unidocente',
        hours: 10,
      };
      const res = interpretarNotasDocenteHeuristica(input);
      expect(res.tipo_funcion_fuera_aula).toBe('DOCENTE_ENCARGADO_RURAL');
      expect(res.horas_directivas).toBe(10);
      expect(res.horas_aula).toBe(0);
    });

    it('debe identificar Encargado CRA y Biblioteca', () => {
      const input: TeacherNoteInput = {
        rut: '3-3',
        teacher_name: 'Encargado CRA',
        activity: 'Encargada CRA Biblioteca Escolar',
        hours: 6,
      };
      const res = interpretarNotasDocenteHeuristica(input);
      expect(res.tipo_funcion_fuera_aula).toBe('CRA_BIBLIOTECA');
      expect(res.horas_cra_enlaces).toBe(6);
      expect(res.horas_tecnicas).toBe(6);
      expect(res.horas_aula).toBe(0);
    });

    it('debe identificar Coordinación Enlaces y TIC', () => {
      const input: TeacherNoteInput = {
        rut: '4-4',
        teacher_name: 'Coordinador Enlaces',
        activity: 'Coordinación Enlaces e Informática Educativa',
        hours: 8,
      };
      const res = interpretarNotasDocenteHeuristica(input);
      expect(res.tipo_funcion_fuera_aula).toBe('ENLACES_TIC');
      expect(res.horas_cra_enlaces).toBe(8);
      expect(res.horas_tecnicas).toBe(8);
    });

    it('debe identificar Convivencia Escolar y Orientación', () => {
      const input: TeacherNoteInput = {
        rut: '5-5',
        teacher_name: 'Orientadora',
        activity: 'Orientador y Convivencia Escolar',
        hours: 15,
      };
      const res = interpretarNotasDocenteHeuristica(input);
      expect(res.tipo_funcion_fuera_aula).toBe('CONVIVENCIA_ORIENTACION');
      expect(res.horas_convivencia).toBe(15);
      expect(res.horas_tecnicas).toBe(15);
    });

    it('debe identificar Horas No Lectivas Art 69', () => {
      const input: TeacherNoteInput = {
        rut: '6-6',
        teacher_name: 'Docente Aula',
        activity: 'Horas no lectivas Art 69 preparación de clases',
        hours: 12,
      };
      const res = interpretarNotasDocenteHeuristica(input);
      expect(res.tipo_funcion_fuera_aula).toBe('NO_LECTIVA_PREPARACION');
      expect(res.horas_no_lectivas).toBe(12);
      expect(res.horas_aula).toBe(0);
    });

    it('debe procesar lote de notas docentes con funciones fuera de aula', async () => {
      const inputs: TeacherNoteInput[] = [
        { rut: '1', teacher_name: 'Doc1', activity: 'JEFE UTP', hours: 30 },
        { rut: '2', teacher_name: 'Doc2', activity: 'COORDINADOR PIE DTO 170', hours: 10 },
        { rut: '3', teacher_name: 'Doc3', activity: 'MATEMATICA 8B', hours: 6 },
      ];
      const resMap = await interpretarNotasDocentesConIa(inputs, '');
      expect(resMap.size).toBe(3);
      expect(resMap.get('1__JEFE UTP')?.tipo_funcion_fuera_aula).toBe('UTP_CURRICULUM_EVALUACION');
      expect(resMap.get('2__COORDINADOR PIE DTO 170')?.tipo_funcion_fuera_aula).toBe('COORDINACION_PIE');
      expect(resMap.get('3__MATEMATICA 8B')?.tipo_funcion_fuera_aula).toBe('AULA_REGULAR');
    });
  });
});
