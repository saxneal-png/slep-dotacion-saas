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

describe('Auditoría y Validación: Catálogo de Electivos de Formación Diferenciada HC (Decreto 0876/2019)', () => {
  it('sonAsignaturasEquivalentes vincula los 27 electivos oficiales a Formación Diferenciada HC sin alterar el plan común', () => {
    // Electivos de Área A
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Taller de Literatura')).toBe(true);
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Seminario de Filosofía')).toBe(true);
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Economía y sociedad')).toBe(true);

    // Electivos de Área B
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Límites, derivadas e integrales')).toBe(true);
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Biología celular y molecular')).toBe(true);
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Física')).toBe(true);
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Química')).toBe(true);

    // Electivos de Área C
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Promoción de estilos de vida activos y saludables')).toBe(true);
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Creación y composición musical')).toBe(true);

    // No debe confundir asignaturas del plan común con formación diferenciada
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Educación Ciudadana')).toBe(false);
    expect(sonAsignaturasEquivalentes('Formación Diferenciada (Humanístico-Científico)', 'Inglés')).toBe(false);
  });

  it('sonAsignaturasEquivalentes vincula correctamente el Plan Común Electivo (2 HA)', () => {
    expect(sonAsignaturasEquivalentes('Plan Común Electivo', 'Historia, Geografía y Ciencias Sociales (Electivo)')).toBe(true);
    expect(sonAsignaturasEquivalentes('Plan Común Electivo', 'Artes (Electivo)')).toBe(true);
    expect(sonAsignaturasEquivalentes('Plan Común Electivo', 'Educación Física y Salud (Electivo)')).toBe(true);
    expect(sonAsignaturasEquivalentes('Plan Común Electivo', 'Religión (Electivo)')).toBe(true);
  });
});

describe('Auditoría y Validación: Educación Parvularia en Aula Combinada y Multigrado (Decreto Supremo 306/2007)', () => {
  it('un curso combinado de párvulos en JEC carga 38 horas totales oficiales (32h obligatorias + 6h libre disposición)', () => {
    const planCombJec = obtenerPlanPorCurso('Nivel Heterogéneo NT1-NT2 Combinado', 'JEC');
    expect(planCombJec).toBeDefined();
    expect(planCombJec?.totalHorasPlan).toBe(38);
    expect(planCombJec?.horasObligatorias).toBe(32);
    expect(planCombJec?.horasLibreDisposicion).toBe(6);
    expect(planCombJec?.categoria).toBe('PARVULARIA');
    expect(planCombJec?.referenciaFuente).toContain('306/2007');

    // Debe contener los 3 ámbitos fundamentales de las Bases Curriculares más experiencias integradas
    const sumHoras = planCombJec?.asignaturasBase.reduce((s, a) => s + a.horasSugeridas, 0);
    expect(sumHoras).toBe(32);
  });

  it('un curso combinado de párvulos en No JEC carga 30 horas totales oficiales de régimen escolar regular', () => {
    const planCombNoJec = obtenerPlanPorCurso('Nivel Heterogéneo NT1-NT2 Combinado', 'No JEC');
    expect(planCombNoJec).toBeDefined();
    expect(planCombNoJec?.totalHorasPlan).toBe(30);
    expect(planCombNoJec?.horasObligatorias).toBe(30);
    expect(planCombNoJec?.horasLibreDisposicion).toBe(0);

    const sumHoras = planCombNoJec?.asignaturasBase.reduce((s, a) => s + a.horasSugeridas, 0);
    expect(sumHoras).toBe(30);
  });

  it('cursos multigrado parvularia y niveles regulares (Prekínder y Kínder) cargan 38h con JEC y 30h sin JEC', () => {
    const planMultiJec = obtenerPlanPorCurso('Multigrado Parvularia (NT1-NT2)', 'JEC');
    expect(planMultiJec?.totalHorasPlan).toBe(38);
    expect(planMultiJec?.horasLibreDisposicion).toBe(6);

    const planMultiNoJec = obtenerPlanPorCurso('Multigrado Parvularia (NT1-NT2)', 'No JEC');
    expect(planMultiNoJec?.totalHorasPlan).toBe(30);

    const planKinderJec = obtenerPlanPorCurso('Kínder B', 'JEC');
    expect(planKinderJec?.totalHorasPlan).toBe(38);

    const planPrekinderNoJec = obtenerPlanPorCurso('Pre-Kínder A', 'No JEC');
    expect(planPrekinderNoJec?.totalHorasPlan).toBe(30);
  });

  it('normalizarNombreAsignatura reconoce adecuadamente los ámbitos de Educación Parvularia', () => {
    expect(normalizarNombreAsignatura('Ámbito Desarrollo Personal y Social')).toBe('ambito desarrollo personal y social');
    expect(normalizarNombreAsignatura('Comunicación Integral')).toBe('ambito comunicacion integral');
    expect(normalizarNombreAsignatura('Interacción y Comprensión del Entorno')).toBe('ambito interaccion y comprension del entorno');
    expect(normalizarNombreAsignatura('Experiencias de Aprendizaje Integradas')).toBe('experiencias de aprendizaje integradas');
  });
});

describe('Auditoría y Corrección: Exclusión de Plan Común Electivo en 3° y 4° Básico', () => {
  it('el plan de estudio de 3° Básico y 4° Básico jamás incluye "Plan Común Electivo"', () => {
    const plan3Basico = obtenerPlanPorCurso('3° Básico A', 'JEC');
    expect(plan3Basico).toBeDefined();
    expect(plan3Basico?.categoria).toBe('BASICA');
    const electivo3B = plan3Basico?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('electivo'));
    expect(electivo3B).toBe(false);

    const plan4Basico = obtenerPlanPorCurso('4° Básico B', 'JEC');
    expect(plan4Basico).toBeDefined();
    expect(plan4Basico?.categoria).toBe('BASICA');
    const electivo4B = plan4Basico?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('electivo'));
    expect(electivo4B).toBe(false);

    const planComb34 = obtenerPlanPorCurso('3° y 4° Básico Combinado', 'JEC');
    expect(planComb34).toBeDefined();
    expect(planComb34?.categoria).toBe('BASICA');
    const electivoComb = planComb34?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('electivo'));
    expect(electivoComb).toBe(false);
  });

  it('validador regex de nivel restringe Plan Común Electivo exclusivamente a 3° y 4° Medio', () => {
    const esNivel34MedioValido = (nivel: string, categoria?: string) => {
      return !/b[aá]sic[oa]|parvulari|k[ií]nder|transici[oó]n|nt[12]|sala\s*cuna/i.test(nivel) && (
        /([34][°ºo]?\s*(medio|em|tp)|tercer[oa]?\s*(medio|em)|cuart[oa]?\s*(medio|em))/i.test(nivel) ||
        ((categoria === 'MEDIA_HC' || categoria === 'MEDIA_TP') && /[34]/i.test(nivel))
      );
    };

    // Casos que NO deben ser considerados 3°/4° Medio
    expect(esNivel34MedioValido('3° Básico', 'BASICA')).toBe(false);
    expect(esNivel34MedioValido('4° Básico', 'BASICA')).toBe(false);
    expect(esNivel34MedioValido('3° Básico A', 'BASICA')).toBe(false);
    expect(esNivel34MedioValido('3° y 4° Básico Combinado', 'MULTIGRADO')).toBe(false);
    expect(esNivel34MedioValido('Multigrado 1°-6° Básico', 'MULTIGRADO')).toBe(false);
    expect(esNivel34MedioValido('1° Medio', 'MEDIA_HC')).toBe(false);
    expect(esNivel34MedioValido('2° Medio', 'MEDIA_HC')).toBe(false);
    expect(esNivel34MedioValido('Kínder A', 'PARVULARIA')).toBe(false);

    // Casos que SÍ corresponden a 3°/4° Medio
    expect(esNivel34MedioValido('3° Medio HC', 'MEDIA_HC')).toBe(true);
    expect(esNivel34MedioValido('4° Medio HC', 'MEDIA_HC')).toBe(true);
    expect(esNivel34MedioValido('3° Medio TP - Electricidad', 'MEDIA_TP')).toBe(true);
    expect(esNivel34MedioValido('4° Medio TP', 'MEDIA_TP')).toBe(true);
    expect(esNivel34MedioValido('3° Medio', 'MEDIA_HC')).toBe(true);
  });
});
