import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDb,
  listarPlanesEstudio,
  obtenerPlanEstudioPorId,
  guardarPlanEstudio,
  adjuntarPlanACursos,
  poblarPlanesEstudioEnDb,
  guardarEstablecimiento,
  guardarCurso,
  listarCursos,
  PLAN_EPJA_2024_OFICIAL_JSON
} from '../src/database/db';
import { PlanEstudioCurricular } from '../src/types';

describe('Catálogo y Gestión de Planes de Estudio - Integración Oficial EPJA 2024 (Dto. 10/2022)', () => {
  beforeAll(async () => {
    await getDb();
    await poblarPlanesEstudioEnDb();
  });

  it('valida la integridad y completitud del JSON oficial EPJA 2024 con 10 niveles formativos', () => {
    const info = PLAN_EPJA_2024_OFICIAL_JSON.informacion_curricular;
    expect(info.decreto_supremo).toBe('Decreto Supremo de Educación N° 10/2022');
    expect(info.duracion_ano_lectivo_semanas).toBe(36);
    expect(info.organizacion_modular_sugerida.modulos_obligatorios).toBe(4);
    expect(info.organizacion_modular_sugerida.modulos_electivos).toBe(2);

    const planes = PLAN_EPJA_2024_OFICIAL_JSON.planes_de_estudio_epja;
    expect(planes.length).toBe(10);

    // Verificar niveles clave
    const basica1 = planes.find(p => p.nivel.includes('Básica - Nivel 1'));
    expect(basica1).toBeDefined();
    expect(basica1?.total_horas_semanales_obligatorias).toBe(10);
    expect(basica1?.total_horas_anuales_obligatorias).toBe(360);

    const mediaHc1 = planes.find(p => p.nivel.includes('Media Humanístico-Científica - Nivel 1'));
    expect(mediaHc1).toBeDefined();
    expect(mediaHc1?.total_horas_semanales_obligatorias).toBe(26);
    expect(mediaHc1?.total_horas_anuales_obligatorias).toBe(936);

    const tpOficios1 = planes.find(p => p.nivel.includes('Técnico-Profesional con Formación en Oficios - Nivel 1'));
    expect(tpOficios1).toBeDefined();
    expect(tpOficios1?.total_horas_semanales_obligatorias).toBe(26);
    expect(tpOficios1?.total_horas_anuales_obligatorias).toBe(936);

    const tpEspec1 = planes.find(p => p.nivel.includes('Técnico-Profesional con Formación en Especialidades - Nivel 1'));
    expect(tpEspec1).toBeDefined();
    expect(tpEspec1?.total_horas_semanales_obligatorias).toBe(24);
    expect(tpEspec1?.total_horas_anuales_obligatorias).toBe(864);
  });

  it('lista y filtra correctamente los planes EPJA 2024 en SQLite', async () => {
    const planesEpja = await listarPlanesEstudio('EPJA');
    expect(planesEpja.length).toBeGreaterThanOrEqual(10);

    const basicaNivel1 = planesEpja.find(p => p.nivel.includes('Básica - Nivel 1'));
    expect(basicaNivel1).toBeDefined();
    expect(basicaNivel1?.decretoSupremo).toBe('Decreto Supremo de Educación N° 10/2022');
    expect(basicaNivel1?.totalHorasSemanalesObligatorias).toBe(10);
    expect(basicaNivel1?.asignaturas.length).toBeGreaterThanOrEqual(2);
    expect(basicaNivel1?.ambitosFormativos?.length).toBeGreaterThanOrEqual(1);
  });

  it('permite crear, editar y persistir un plan de estudio personalizado', async () => {
    const customPlan: PlanEstudioCurricular = {
      id: 'plan-custom-test-epja',
      nivel: 'EPJA Especializado Robótica y Automatización 2026',
      categoria: 'EPJA',
      regimen: 'JEC',
      decretoSupremo: 'Decreto Exento SLEP 2026-99',
      totalHorasSemanalesObligatorias: 34,
      totalHorasAnualesObligatorias: 1224,
      totalHorasPlan: 34,
      asignaturas: [
        { nombre: 'Lengua y Literatura EPJA', horasSemanales: 6, caracter: 'Obligatoria' },
        { nombre: 'Matemática Aplicada', horasSemanales: 6, caracter: 'Obligatoria' },
        { nombre: 'Taller de Automatización e IA', horasSemanales: 14, caracter: 'Obligatoria' },
        { nombre: 'Proyecto Modular Productivo', horasSemanales: 8, caracter: 'Obligatoria' }
      ],
      esPersonalizado: true
    };

    await guardarPlanEstudio(customPlan);

    const recuperado = await obtenerPlanEstudioPorId('plan-custom-test-epja');
    expect(recuperado).toBeDefined();
    expect(recuperado?.nivel).toBe('EPJA Especializado Robótica y Automatización 2026');
    expect(recuperado?.totalHorasSemanalesObligatorias).toBe(34);
    expect(recuperado?.asignaturas.length).toBe(4);
    expect(recuperado?.esPersonalizado).toBe(true);
  });

  it('adjunta correctamente un plan de estudio a cursos de un establecimiento', async () => {
    // 1. Crear establecimiento y cursos de prueba
    await guardarEstablecimiento({
      id: 'est-test-epja',
      rbd: '999901',
      nombre: 'CEIA Adultos Valle Diguillín',
      comuna: 'Chillán',
      regimen: 'No JEC',
      porcentajePrioritarios: 85.0
    });

    await guardarCurso({
      id: 'curso-epja-1',
      rbd: '999901',
      periodo: 2026,
      nivel: 'Educación Media HC - Nivel 1',
      letra: 'A',
      regimen: 'No JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 0,
      alumnosNeep: 0
    });

    await guardarCurso({
      id: 'curso-epja-2',
      rbd: '999901',
      periodo: 2026,
      nivel: 'Educación Media HC - Nivel 2',
      letra: 'A',
      regimen: 'No JEC',
      cupoSae: 35,
      matriculaProyectada: 28,
      alumnosNeet: 0,
      alumnosNeep: 0
    });

    // 2. Adjuntar plan EPJA Media HC Nivel 1
    const planes = await listarPlanesEstudio('EPJA');
    const planMediaHc1 = planes.find(p => p.nivel.includes('Media Humanístico-Científica - Nivel 1'));
    expect(planMediaHc1).toBeDefined();

    const result = await adjuntarPlanACursos(
      planMediaHc1!.id,
      '999901',
      ['curso-epja-1', 'curso-epja-2'],
      2026
    );

    expect(result.cursosActualizados).toBe(2);

    // 3. Verificar que los cursos tengan el planEstudioId
    const cursosActualizados = await listarCursos('999901', 2026);
    const c1 = cursosActualizados.find(c => c.id === 'curso-epja-1');
    const c2 = cursosActualizados.find(c => c.id === 'curso-epja-2');

    expect(c1?.planEstudioId).toBe(planMediaHc1!.id);
    expect(c2?.planEstudioId).toBe(planMediaHc1!.id);
  });
});
