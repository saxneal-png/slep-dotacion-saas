import { describe, it, expect } from 'vitest';
import {
  obtenerPlanPorCurso,
  PLANES_MINEDUC,
  esModalidadAdultos,
  esModalidadMultigradoOCombinado,
  esModalidadElegiblePie
} from '../src';

describe('Planes de Estudio EPJA (Educación de Adultos - Decreto Supremo N° 10/2022)', () => {
  it('resuelve plan de estudio de 1° Nivel Básico Adultos (10 HA)', () => {
    const plan = obtenerPlanPorCurso('1° Nivel Básico Adultos', 'No JEC');
    expect(plan).toBeDefined();
    expect(plan?.totalHorasPlan).toBe(10);
    expect(plan?.asignaturasBase.some(a => a.nombre.includes('Lenguaje'))).toBe(true);
    expect(plan?.asignaturasBase.some(a => a.nombre.includes('Matemática'))).toBe(true);
    const sum = plan?.asignaturasBase.reduce((acc, a) => acc + (a.horasSugeridas || 0), 0);
    expect(sum).toBe(10);
  });

  it('resuelve plan de estudio de 2° y 3° Nivel Básico Adultos (16 HA No JEC obligatorias / 24 HA JEC con opcionales)', () => {
    const plan2NoJec = obtenerPlanPorCurso('2° Nivel Básico Adultos', 'No JEC');
    expect(plan2NoJec?.totalHorasPlan).toBe(16);
    expect(plan2NoJec?.asignaturasBase.some(a => a.nombre.includes('Ciencias Naturales'))).toBe(true);

    const plan2Jec = obtenerPlanPorCurso('2° Nivel Básico Adultos', 'JEC');
    expect(plan2Jec?.totalHorasPlan).toBe(24);
    expect(plan2Jec?.asignaturasBase.some(a => a.nombre.includes('Oficios'))).toBe(true);

    const plan3 = obtenerPlanPorCurso('EPJA 3° Nivel Básico', 'No JEC');
    expect(plan3?.totalHorasPlan).toBe(16);
  });

  it('resuelve plan de estudio de EPJA Media HC (26 HA)', () => {
    const planMedia1 = obtenerPlanPorCurso('1° Nivel Medio HC Adultos', 'No JEC');
    expect(planMedia1).toBeDefined();
    expect(planMedia1?.totalHorasPlan).toBe(26);
    expect(planMedia1?.asignaturasBase.some(a => a.nombre.includes('Formación Instrumental'))).toBe(true);
    expect(planMedia1?.asignaturasBase.some(a => a.nombre.includes('Formación Diferenciada HC'))).toBe(true);

    const planMedia2 = obtenerPlanPorCurso('2° Nivel Medio HC Adultos', 'JEC');
    expect(planMedia2?.totalHorasPlan).toBe(26);
    expect(planMedia2?.asignaturasBase.some(a => a.nombre.includes('Educación Ciudadana'))).toBe(true);
  });

  it('resuelve plan de estudio de EPJA Media TP (Oficios 26 HA / Especialidades 24 HA)', () => {
    const planOficios = obtenerPlanPorCurso('EPJA Media Oficios Adultos', 'No JEC');
    expect(planOficios?.totalHorasPlan).toBe(26);
    expect(planOficios?.asignaturasBase.some(a => a.nombre.includes('Oficios'))).toBe(true);

    const planTpEspec1 = obtenerPlanPorCurso('1° Nivel Medio TP Especialidad Adultos', 'No JEC');
    expect(planTpEspec1?.totalHorasPlan).toBe(24);

    const planTpEspec2 = obtenerPlanPorCurso('2° Nivel Medio TP Especialidad Adultos', 'No JEC');
    expect(planTpEspec2?.totalHorasPlan).toBe(24);
    expect(planTpEspec2?.asignaturasBase.some(a => a.nombre.includes('Especialización') || a.nombre.includes('Módulos'))).toBe(true);
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
