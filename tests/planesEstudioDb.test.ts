import { describe, it, expect, beforeAll } from 'vitest';
import { getDb, listarPlanesEstudio, obtenerPlanEstudioPorNivelYRegimen } from '../src/database/db';

describe('Planes de Estudio en Base de Datos SQLite', () => {
  beforeAll(async () => {
    await getDb();
  });

  it('siembra y lista todos los planes de estudio en la base de datos', async () => {
    const todosLosPlanes = await listarPlanesEstudio();
    expect(todosLosPlanes.length).toBeGreaterThanOrEqual(30);

    const planesTP = await listarPlanesEstudio('MEDIA_TP');
    expect(planesTP.length).toBeGreaterThanOrEqual(24);
  });

  it('obtiene planes de estudio específicos por nivel y régimen', async () => {
    const elec3Jec = await obtenerPlanEstudioPorNivelYRegimen('3° Medio - Especialidad Electricidad (Formación Diferenciada TP)', 'JEC');
    expect(elec3Jec).toBeDefined();
    expect(elec3Jec?.totalHorasPlan).toBe(42);
    expect(elec3Jec?.horasLibreDisposicion).toBe(6);
    expect(elec3Jec?.asignaturas.length).toBeGreaterThan(5);

    const gastro4NoJec = await obtenerPlanEstudioPorNivelYRegimen('4° Medio - Especialidad Gastronomía, Mención Cocina', 'NO_JEC');
    expect(gastro4NoJec).toBeDefined();
    expect(gastro4NoJec?.totalHorasPlan).toBe(36);
    expect(gastro4NoJec?.horasLibreDisposicion).toBe(0);
  });
});
