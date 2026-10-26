import { describe, it, expect } from 'vitest';
import {
  obtenerPlanPorCurso,
  PLANES_MINEDUC,
  DATA_PLANES_ESTUDIO_MINEDUC,
  PLAN_COMUN_GENERAL_TP_ASIGNATURAS
} from '../src/planesEstudio';

describe('Normativa Curricular: Unificación Plan Común HC/TP y Cursos Combinados vs Multigrado', () => {

  describe('1. Unificación del Plan Común Formación General para 3° y 4° Medio (HC y TP) - Decreto 0876/2019', () => {
    it('comprueba que la Formación General TP tiene las 6 asignaturas obligatorias del Decreto 0876/2019 (14 horas)', () => {
      expect(PLAN_COMUN_GENERAL_TP_ASIGNATURAS.length).toBe(6);
      const nombres = PLAN_COMUN_GENERAL_TP_ASIGNATURAS.map(a => a.nombre);
      expect(nombres).toEqual([
        'Lengua y Literatura',
        'Matemática',
        'Educación Ciudadana',
        'Filosofía',
        'Inglés',
        'Ciencias para la Ciudadanía'
      ]);

      const sumaHoras = PLAN_COMUN_GENERAL_TP_ASIGNATURAS.reduce((sum, a) => sum + a.JEC, 0);
      expect(sumaHoras).toBe(14);
    });

    it('verifica que las especialidades TP incorporan el Plan Común de 14h + 22h de especialidad = 36h obligatorias', () => {
      const planElec3 = PLANES_MINEDUC.find(p => p.nivel.includes('Electricidad') && p.nivel.includes('3°') && p.regimen === 'JEC');
      expect(planElec3).toBeDefined();

      // Debe contener las asignaturas del Plan Común
      expect(planElec3?.asignaturasBase.some(a => a.nombre === 'Lengua y Literatura' && a.horasSugeridas === 3)).toBe(true);
      expect(planElec3?.asignaturasBase.some(a => a.nombre === 'Matemática' && a.horasSugeridas === 3)).toBe(true);
      expect(planElec3?.asignaturasBase.some(a => a.nombre === 'Educación Ciudadana' && a.horasSugeridas === 2)).toBe(true);
      expect(planElec3?.asignaturasBase.some(a => a.nombre === 'Filosofía' && a.horasSugeridas === 2)).toBe(true);
      expect(planElec3?.asignaturasBase.some(a => a.nombre === 'Inglés' && a.horasSugeridas === 2)).toBe(true);
      expect(planElec3?.asignaturasBase.some(a => a.nombre === 'Ciencias para la Ciudadanía' && a.horasSugeridas === 2)).toBe(true);

      // Y los módulos de la especialidad
      expect(planElec3?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('instalaciones'))).toBe(true);

      // Total de asignaturas obligatorias: 36h (14h común + 22h especialidad)
      expect(planElec3?.horasObligatorias).toBe(36);
      expect(planElec3?.totalHorasPlan).toBe(42);
      expect(planElec3?.horasLibreDisposicion).toBe(6);
    });
  });

  describe('2. Cursos Combinados por Ciclo Oficial (Decreto Exento N° 2960/2012 y N° 1363/2011)', () => {
    it('resuelve 1° y 2° Básico Combinado con el plan correcto de 1° Ciclo (8h Lenguaje, 0h Inglés)', () => {
      const planComb12 = obtenerPlanPorCurso('1° y 2° Básico Combinado', 'JEC');
      expect(planComb12).toBeDefined();
      expect(planComb12?.nivel).toContain('1° y 2° Básico Combinado');
      expect(planComb12?.totalHorasPlan).toBe(38);
      expect(planComb12?.horasLibreDisposicion).toBe(6.5);

      const asigLeng = planComb12?.asignaturasBase.find(a => a.nombre === 'Lenguaje y Comunicación');
      expect(asigLeng?.horasSugeridas).toBe(8); // 8h en primer ciclo

      const asigIngles = planComb12?.asignaturasBase.find(a => a.nombre.toLowerCase().includes('inglés'));
      expect(asigIngles).toBeUndefined(); // Sin inglés obligatorio en 1° ciclo
    });

    it('resuelve 3° y 4° Básico Combinado con el plan normativo de 1° a 4° Básico', () => {
      const planComb34 = obtenerPlanPorCurso('3°-4° Básico Combinado', 'JEC');
      expect(planComb34).toBeDefined();
      expect(planComb34?.nivel).toContain('3° y 4° Básico Combinado');
      const asigLeng = planComb34?.asignaturasBase.find(a => a.nombre === 'Lenguaje y Comunicación');
      expect(asigLeng?.horasSugeridas).toBe(8);
    });

    it('resuelve 5° y 6° Básico Combinado con el plan de 2° Ciclo (6h Lenguaje, 3h Inglés, 4h Ciencias)', () => {
      const planComb56 = obtenerPlanPorCurso('5° y 6° Básico Combinado', 'JEC');
      expect(planComb56).toBeDefined();
      expect(planComb56?.nivel).toContain('5° y 6° Básico Combinado');
      expect(planComb56?.totalHorasPlan).toBe(38);
      expect(planComb56?.horasLibreDisposicion).toBe(6);

      const asigLeng = planComb56?.asignaturasBase.find(a => a.nombre === 'Lenguaje y Comunicación');
      expect(asigLeng?.horasSugeridas).toBe(6);

      const asigIngles = planComb56?.asignaturasBase.find(a => a.nombre.toLowerCase().includes('inglés'));
      expect(asigIngles?.horasSugeridas).toBe(3); // 3h de inglés en segundo ciclo

      const asigCiencias = planComb56?.asignaturasBase.find(a => a.nombre === 'Ciencias Naturales');
      expect(asigCiencias?.horasSugeridas).toBe(4);
    });

    it('resuelve 7° y 8° Básico Combinado con el plan de 3° Ciclo (Decreto 1363/2011)', () => {
      const planComb78Jec = obtenerPlanPorCurso('7°-8° Básico Combinado', 'JEC');
      expect(planComb78Jec).toBeDefined();
      expect(planComb78Jec?.nivel).toContain('7° y 8° Básico Combinado');
      expect(planComb78Jec?.totalHorasPlan).toBe(38);

      const planComb78NoJec = obtenerPlanPorCurso('7°-8° Básico Combinado', 'No JEC');
      expect(planComb78NoJec).toBeDefined();
      expect(planComb78NoJec?.totalHorasPlan).toBe(33); // 33h en No JEC según Decreto 1363/2011
      expect(planComb78NoJec?.horasLibreDisposicion).toBe(2);
    });

    it('resuelve Nivel Heterogéneo Parvularia NT1-NT2 Combinado', () => {
      const planParv = obtenerPlanPorCurso('Nivel Heterogéneo NT1-NT2 Combinado', 'No JEC');
      expect(planParv).toBeDefined();
      expect(planParv?.nivel).toContain('Nivel Heterogéneo Parvularia');
      expect(planParv?.totalHorasPlan).toBe(22);
      expect(planParv?.categoria).toBe('PARVULARIA');
    });
  });

  describe('3. Aula Multigrado Rural Integrada (Escuelas Unidocentes 1° a 6° - Decreto 477/1995)', () => {
    it('resuelve correctamente escuelas rurales multigrado 1° a 6° Básico con la matriz integrada', () => {
      const planMulti = obtenerPlanPorCurso('Multigrado 1° a 6° Básico', 'JEC');
      expect(planMulti).toBeDefined();
      expect(planMulti?.nivel).toContain('Aula Multigrado Rural Integrada');
      expect(planMulti?.categoria).toBe('MULTIGRADO');
      expect(planMulti?.totalHorasPlan).toBe(38);

      // Asignaturas integradas: Lenguaje 7h (eje estructurante), Artes y Música 3h integradas
      const asigLeng = planMulti?.asignaturasBase.find(a => a.nombre === 'Lenguaje y Comunicación');
      expect(asigLeng?.horasSugeridas).toBe(7);

      const asigArtes = planMulti?.asignaturasBase.find(a => a.nombre === 'Artes Visuales y Música');
      expect(asigArtes?.horasSugeridas).toBe(3);
    });
  });

});
