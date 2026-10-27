import { describe, it, expect } from 'vitest';
import {
  normalizarNombreAsignatura,
  sonAsignaturasEquivalentes
} from '../src/components/DocenteAsignacionPanel';
import {
  obtenerPlanPorCurso,
  PLAN_COMUN_GENERAL_TP_ASIGNATURAS,
  PLANES_MINEDUC
} from '@slep/mineduc-engine';
import { CursoSae } from '../src/types';

describe('Auditoría y Corrección: División de Ciencias Naturales vs. Educación Física y Salud', () => {
  it('normalizarNombreAsignatura distingue estrictamente Educación Física y Salud de Ciencias Naturales', () => {
    expect(normalizarNombreAsignatura('Educación Física y Salud')).toBe('educacion fisica y salud');
    expect(normalizarNombreAsignatura('Ed. Física')).toBe('educacion fisica y salud');
    expect(normalizarNombreAsignatura('Educación Física')).toBe('educacion fisica y salud');
    expect(normalizarNombreAsignatura('Educación y Salud')).toBe('educacion fisica y salud');

    expect(normalizarNombreAsignatura('Ciencias Naturales')).toBe('ciencias naturales');
    expect(normalizarNombreAsignatura('Física')).toBe('ciencias naturales');
    expect(normalizarNombreAsignatura('Biología')).toBe('ciencias naturales');
    expect(normalizarNombreAsignatura('Química')).toBe('ciencias naturales');
  });

  it('sonAsignaturasEquivalentes NUNCA confunde Educación Física con Ciencias o Física de Ciencias', () => {
    expect(sonAsignaturasEquivalentes('Educación Física y Salud', 'Ciencias Naturales')).toBe(false);
    expect(sonAsignaturasEquivalentes('Educación Física y Salud', 'Física')).toBe(false);
    expect(sonAsignaturasEquivalentes('Educación Física y Salud', 'Biología')).toBe(false);
    expect(sonAsignaturasEquivalentes('Educación Física y Salud', 'Química')).toBe(false);
    expect(sonAsignaturasEquivalentes('Educación Física', 'Ciencias Naturales')).toBe(false);
  });

  it('sonAsignaturasEquivalentes permite imputar Biología, Física y Química al cupo de Ciencias Naturales', () => {
    expect(sonAsignaturasEquivalentes('Ciencias Naturales', 'Biología')).toBe(true);
    expect(sonAsignaturasEquivalentes('Ciencias Naturales', 'Física')).toBe(true);
    expect(sonAsignaturasEquivalentes('Ciencias Naturales', 'Química')).toBe(true);
    expect(sonAsignaturasEquivalentes('Ciencias Naturales', 'Ciencias Naturales')).toBe(true);
  });
});

describe('Auditoría y Corrección: Cursos Técnico-Profesionales con Plan Común Electivo y Libre Disposición', () => {
  it('un curso de especialidad TP carga Formación General (14h), Diferenciada (22h) y Libre Disposición JEC (6h)', () => {
    const planElectricidad = obtenerPlanPorCurso(
      '3° Medio - Especialidad Electricidad (Formación Diferenciada TP)',
      'JEC'
    );

    expect(planElectricidad).toBeDefined();
    expect(planElectricidad?.totalHorasPlan).toBe(42);
    expect(planElectricidad?.horasObligatorias).toBe(36);
    expect(planElectricidad?.horasLibreDisposicion).toBe(6);

    // Debe contener las 6 asignaturas del plan común (14h)
    const asignaturasComunes = [
      'Lengua y Literatura',
      'Matemática',
      'Educación Ciudadana',
      'Filosofía',
      'Inglés',
      'Ciencias para la Ciudadanía'
    ];
    for (const nom of asignaturasComunes) {
      const encontrada = planElectricidad?.asignaturasBase.find(a => a.nombre === nom);
      expect(encontrada).toBeDefined();
    }

    // Debe contener los módulos técnicos de especialidad (22h)
    const modulos = planElectricidad?.asignaturasBase.filter(a => a.nombre.startsWith('Módulo'));
    expect(modulos && modulos.length).toBeGreaterThan(0);
    const sumaModulos = modulos?.reduce((s, m) => s + m.horasSugeridas, 0);
    expect(sumaModulos).toBe(22);
  });

  it('un curso genérico TP "3° Medio (Técnico-Profesional)" carga las 42 horas oficiales', () => {
    const planTpGenerico = obtenerPlanPorCurso('3° Medio (Técnico-Profesional)', 'JEC');
    expect(planTpGenerico).toBeDefined();
    expect(planTpGenerico?.totalHorasPlan).toBe(42);
    expect(planTpGenerico?.horasObligatorias).toBe(36);
    expect(planTpGenerico?.horasLibreDisposicion).toBe(6);
  });
});
