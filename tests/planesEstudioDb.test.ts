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

    // Planes EPJA en Base de Datos
    const epjaB1 = await obtenerPlanEstudioPorNivelYRegimen('Educación Básica - Nivel 1 (1° a 4° Básico)', 'No JEC');
    expect(epjaB1).toBeDefined();
    expect(epjaB1?.totalHorasPlan).toBe(10);
    expect(epjaB1?.asignaturas.length).toBe(2);

    const epjaMediaHc = await obtenerPlanEstudioPorNivelYRegimen('Educación Media HC - Nivel 1 (1° y 2° Medio)', 'No JEC');
    expect(epjaMediaHc).toBeDefined();
    expect(epjaMediaHc?.totalHorasPlan).toBe(26);

    const planesEpjaDb = await listarPlanesEstudio('EPJA');
    expect(planesEpjaDb.length).toBeGreaterThanOrEqual(16);

    // Planes Educación Especial y Laboral en Base de Datos
    const especialBasica = await obtenerPlanEstudioPorNivelYRegimen('Educación Básica Especial (1° a 8° Básico con Adecuaciones Curriculares - Dec. 83)', 'JEC');
    expect(especialBasica).toBeDefined();
    expect(especialBasica?.totalHorasPlan).toBe(38);
    expect(especialBasica?.horasLibreDisposicion).toBe(6);
    expect(especialBasica?.categoria).toBe('ESPECIAL');
    expect(especialBasica?.asignaturas.some(a => a.nombre.toLowerCase().includes('especializado'))).toBe(true);

    const laboral1 = await obtenerPlanEstudioPorNivelYRegimen('Nivel Laboral 1 (Decreto N° 87/1990 y Normativa Especial)', 'JEC');
    expect(laboral1).toBeDefined();
    expect(laboral1?.totalHorasPlan).toBe(38);
    expect(laboral1?.categoria).toBe('LABORAL');
    expect(laboral1?.asignaturas.some(a => a.nombre.toLowerCase().includes('vocacional'))).toBe(true);

    const planesEspecialDb = await listarPlanesEstudio('ESPECIAL');
    expect(planesEspecialDb.length).toBeGreaterThanOrEqual(4);

    const planesLaboralDb = await listarPlanesEstudio('LABORAL');
    expect(planesLaboralDb.length).toBeGreaterThanOrEqual(6);
  });
});
