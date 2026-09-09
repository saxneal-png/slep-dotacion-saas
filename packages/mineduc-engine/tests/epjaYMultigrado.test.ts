import { describe, it, expect } from 'vitest';
import {
  obtenerPlanPorCurso,
  PLANES_MINEDUC,
  esModalidadAdultos,
  esModalidadMultigradoOCombinado,
  esModalidadElegiblePie
} from '../src';

describe('Planes de Estudio EPJA (Educación de Adultos)', () => {
  it('resuelve plan de estudio de 1° Nivel Básico Adultos (20 HA No JEC)', () => {
    const plan = obtenerPlanPorCurso('1° Nivel Básico Adultos', 'No JEC');
    expect(plan).toBeDefined();
    expect(plan?.totalHorasPlan).toBe(20);
    expect(plan?.asignaturasBase.some(a => a.nombre.includes('Lengua'))).toBe(true);
    expect(plan?.asignaturasBase.some(a => a.nombre.includes('Matemática'))).toBe(true);
  });

  it('resuelve plan de estudio de 2° y 3° Nivel Básico Adultos (22 HA No JEC con Inglés)', () => {
    const plan2 = obtenerPlanPorCurso('2° Nivel Básico Adultos', 'No JEC');
    expect(plan2?.totalHorasPlan).toBe(22);
    expect(plan2?.asignaturasBase.some(a => a.nombre.includes('Inglés'))).toBe(true);

    const plan3 = obtenerPlanPorCurso('EPJA 3° Nivel Básico', 'No JEC');
    expect(plan3?.totalHorasPlan).toBe(22);
  });

  it('resuelve plan de estudio de EPJA Media HC (26 HA No JEC)', () => {
    const planMedia = obtenerPlanPorCurso('1° Nivel Medio HC Adultos', 'No JEC');
    expect(planMedia).toBeDefined();
    expect(planMedia?.totalHorasPlan).toBe(26);
    expect(planMedia?.asignaturasBase.some(a => a.nombre.includes('Filosofía') || a.nombre.includes('Convivencia'))).toBe(true);
  });

  it('resuelve plan de estudio de EPJA Media TP (32 HA / 34 HA No JEC)', () => {
    const planTp1 = obtenerPlanPorCurso('1° Nivel Medio TP Adultos', 'No JEC');
    expect(planTp1?.totalHorasPlan).toBe(32);
    expect(planTp1?.asignaturasBase.some(a => a.nombre.includes('Diferenciada'))).toBe(true);

    const planTp2 = obtenerPlanPorCurso('2° Nivel Medio TP Adultos', 'No JEC');
    expect(planTp2?.totalHorasPlan).toBe(34);
  });
});

describe('Planes de Estudio Cursos Multigrado y Combinados', () => {
  it('resuelve plan de estudio para Multigrado Parvularia NT1-NT2', () => {
    const planParv = obtenerPlanPorCurso('Multigrado NT1-NT2', 'No JEC');
    expect(planParv).toBeDefined();
    expect(planParv?.totalHorasPlan).toBe(22);
  });

  it('resuelve plan de estudio para Cursos Multigrado Básica (30 HA No JEC / 38 HA JEC)', () => {
    const planMultiNoJec = obtenerPlanPorCurso('Multigrado 1°-2° Básico', 'No JEC');
    expect(planMultiNoJec?.totalHorasPlan).toBe(30);

    const planMultiJec = obtenerPlanPorCurso('Multigrado 1° a 6° Básico', 'JEC');
    expect(planMultiJec?.totalHorasPlan).toBe(38);
  });

  it('resuelve plan de estudio para Cursos Combinados', () => {
    const planComb = obtenerPlanPorCurso('1° y 2° Básico Combinado', 'JEC');
    expect(planComb?.totalHorasPlan).toBe(38);
  });
});

describe('Clasificación de Modalidades', () => {
  it('detecta modalidades EPJA y Multigrado correctamente', () => {
    expect(esModalidadAdultos('1° Nivel Básico Adultos')).toBe(true);
    expect(esModalidadAdultos('3° Medio HC')).toBe(false);

    expect(esModalidadMultigradoOCombinado('Multigrado 1°-2° Básico')).toBe(true);
    expect(esModalidadMultigradoOCombinado('Curso Combinado 3° y 4°')).toBe(true);
    expect(esModalidadMultigradoOCombinado('5° Básico A')).toBe(false);

    expect(esModalidadElegiblePie('131')).toBe(false);
    expect(esModalidadElegiblePie('110')).toBe(true);
  });
});
