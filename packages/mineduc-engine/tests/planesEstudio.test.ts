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
});
