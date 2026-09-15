import { describe, it, expect } from 'vitest';
import {
  PLANES_MINEDUC,
  obtenerPlanPorCurso,
  DATA_PLANES_ESTUDIO_MINEDUC
} from '../src/planesEstudio';

describe('Planes y Programas MINEDUC', () => {
  it('contiene los planes convertidos para los distintos niveles en JEC y No JEC', () => {
    expect(PLANES_MINEDUC.length).toBeGreaterThan(6);
    const basica14Jec = PLANES_MINEDUC.find(p => p.nivel === '1° a 4° Básico' && p.regimen === 'JEC');
    expect(basica14Jec).toBeDefined();
    expect(basica14Jec?.totalHorasPlan).toBe(38);
    expect(basica14Jec?.horasLibreDisposicion).toBe(6.5);
  });

  it('identifica correctamente el plan curricular para un curso dado', () => {
    const plan = obtenerPlanPorCurso('2° Básico B', 'JEC');
    expect(plan).toBeDefined();
    expect(plan?.nivel).toBe('1° a 4° Básico');
    expect(plan?.asignaturasBase.some(a => a.nombre === 'Lenguaje y Comunicación')).toBe(true);
    expect(plan?.asignaturasBase.some(a => a.nombre === 'Matemática')).toBe(true);
  });

  it('verifica que 1° y 2° Medio JEC contempla 42 horas en total', () => {
    const p12m = DATA_PLANES_ESTUDIO_MINEDUC["1_2_medio"];
    expect(p12m.regimen.JEC.total).toBe(42);
    expect(p12m.regimen.JEC.libre).toBe(6);
  });

  it('resuelve correctamente especialidades TP por nombre de curso', () => {
    // 3° Medio Electricidad
    const planElec3 = obtenerPlanPorCurso('3° Medio Electricidad A', 'JEC');
    expect(planElec3).toBeDefined();
    expect(planElec3?.nivel).toBe('3° Medio - Especialidad Electricidad (Formación Diferenciada TP)');
    expect(planElec3?.categoria).toBe('MEDIA_TP');
    expect(planElec3?.totalHorasPlan).toBe(42);
    expect(planElec3?.horasLibreDisposicion).toBe(6);
    expect(planElec3?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('instalaci'))).toBe(true);

    // 4° Medio Gastronomía Cocina
    const planGastro4 = obtenerPlanPorCurso('4° Medio Gastronomía Mención Cocina', 'JEC');
    expect(planGastro4).toBeDefined();
    expect(planGastro4?.nivel).toBe('4° Medio - Especialidad Gastronomía, Mención Cocina');
    expect(planGastro4?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('cocina'))).toBe(true);

    // 4° Medio Programación en No-JEC
    const planProgNoJec = obtenerPlanPorCurso('4° Medio TP Programación', 'No JEC');
    expect(planProgNoJec).toBeDefined();
    expect(planProgNoJec?.totalHorasPlan).toBe(36);
    expect(planProgNoJec?.horasLibreDisposicion).toBe(0);
    expect(planProgNoJec?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('programaci'))).toBe(true);

    // Plan Común TP
    const planComunTP = obtenerPlanPorCurso('3° y 4° Medio Técnico-Profesional (Plan Común de Formación General)', 'JEC');
    expect(planComunTP).toBeDefined();
    expect(planComunTP?.totalHorasPlan).toBe(20);
  });

  it('verifica que todas las especialidades TP tienen distribución correcta de 42h JEC y 36h No-JEC', () => {
    const planesTP = PLANES_MINEDUC.filter(p => p.categoria === 'MEDIA_TP' && p.nivel.includes('Especialidad'));
    expect(planesTP.length).toBe(50); // 25 planes diferenciados de especialidad x 2 regímenes (JEC y No JEC)

    for (const plan of planesTP) {
      if (plan.regimen === 'JEC') {
        expect(plan.totalHorasPlan).toBe(42);
        expect(plan.horasLibreDisposicion).toBe(6);
      } else {
        expect(plan.totalHorasPlan).toBe(36);
        expect(plan.horasLibreDisposicion).toBe(0);
      }
      // Horas del plan general (14h) + Horas de especialidad (22h) = 36h obligatorias
      expect(plan.horasObligatorias).toBe(36);
      const totalAsignaturas = plan.asignaturasBase.reduce((sum, a) => sum + (a.horasSugeridas || 0), 0);
      expect(totalAsignaturas).toBe(36);
    }
  });

  it('resuelve 3° y 4° Medio Especialidad Atención de Párvulos como MEDIA_TP y nunca como Parvularia', () => {
    // 3° Medio Atención de Párvulos
    const planParv3 = obtenerPlanPorCurso('3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP) A', 'JEC');
    expect(planParv3).toBeDefined();
    expect(planParv3?.nivel).toBe('3° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)');
    expect(planParv3?.categoria).toBe('MEDIA_TP');
    expect(planParv3?.totalHorasPlan).toBe(42);
    expect(planParv3?.horasLibreDisposicion).toBe(6);
    expect(planParv3?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('didáctico'))).toBe(true);

    // 4° Medio Atención de Párvulos
    const planParv4 = obtenerPlanPorCurso('4° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP) B', 'JEC');
    expect(planParv4).toBeDefined();
    expect(planParv4?.nivel).toBe('4° Medio - Especialidad Atención de Párvulos (Formación Diferenciada TP)');
    expect(planParv4?.categoria).toBe('MEDIA_TP');
    expect(planParv4?.totalHorasPlan).toBe(42);
    expect(planParv4?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('educativas'))).toBe(true);

    // Educación Parvularia real
    const planParvulariaReal = obtenerPlanPorCurso('Kínder A', 'No JEC');
    expect(planParvulariaReal?.categoria).toBe('PARVULARIA');
    expect(planParvulariaReal?.totalHorasPlan).toBe(22);
  });

  it('resuelve correctamente cursos de Educación Especial y Niveles Laborales (Ord. 1470 & Dec. 83/87)', () => {
    // 1. Parvularia Especial
    const planParvEsp = obtenerPlanPorCurso('Parvularia Especial A', 'JEC');
    expect(planParvEsp).toBeDefined();
    expect(planParvEsp?.categoria).toBe('ESPECIAL');
    expect(planParvEsp?.totalHorasPlan).toBe(28);
    expect(planParvEsp?.horasLibreDisposicion).toBe(4);
    expect(planParvEsp?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('estimulación') || a.nombre.toLowerCase().includes('específico'))).toBe(true);

    // 2. Básica Especial (Dec. 83)
    const planBasicaEsp = obtenerPlanPorCurso('3° Básico Especial (Decreto 83) B', 'JEC');
    expect(planBasicaEsp).toBeDefined();
    expect(planBasicaEsp?.categoria).toBe('ESPECIAL');
    expect(planBasicaEsp?.totalHorasPlan).toBe(38);
    expect(planBasicaEsp?.horasLibreDisposicion).toBe(6);
    expect(planBasicaEsp?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('especializado'))).toBe(true);

    // 3. Nivel Laboral 1
    const planLab1 = obtenerPlanPorCurso('Nivel Laboral 1 A', 'JEC');
    expect(planLab1).toBeDefined();
    expect(planLab1?.categoria).toBe('LABORAL');
    expect(planLab1?.totalHorasPlan).toBe(38);
    expect(planLab1?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('vocacional') || a.nombre.toLowerCase().includes('oficios'))).toBe(true);

    // 4. Nivel Laboral 2 No JEC
    const planLab2NoJec = obtenerPlanPorCurso('Nivel Laboral 2', 'No JEC');
    expect(planLab2NoJec).toBeDefined();
    expect(planLab2NoJec?.categoria).toBe('LABORAL');
    expect(planLab2NoJec?.totalHorasPlan).toBe(30);

    // 5. Nivel Laboral 3 JEC
    const planLab3 = obtenerPlanPorCurso('Laboral 3 C', 'JEC');
    expect(planLab3).toBeDefined();
    expect(planLab3?.categoria).toBe('LABORAL');
    expect(planLab3?.totalHorasPlan).toBe(38);
    expect(planLab3?.asignaturasBase.some(a => a.nombre.toLowerCase().includes('práctica'))).toBe(true);
  });
});
