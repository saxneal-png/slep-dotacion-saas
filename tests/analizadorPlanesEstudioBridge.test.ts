import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDb,
  listarPlanesEstudio,
  poblarPlanesEstudioEnDb,
  guardarPlanEstudio
} from '../src/database/db';
import {
  inicializarPlanesEstudioAnalizador,
  buscarPlanEstudioAnalizador,
  getAsignaturasSugeridasPorPlanAnalizador,
  getTodasLasAsignaturasConocidas,
  getPlanesEstudioAnalizadorCache
} from '../src/services/analizador/planesEstudioBridge';
import { homologarAsignaturaPorRegla, getAsignaturasSugeridasParaNivel } from '../src/services/analizador/homologationService';
import { classifyLocal } from '../src/services/analizador/classifier';
import { buildCourseLoadSummaries } from '../src/services/analizador/courseExtractor';
import { PlanEstudioCurricular, TeacherRecord } from '../src/types';

describe('Integración del Analizador de Dotación con Planes de Estudio en Base de Datos', () => {
  beforeAll(async () => {
    await getDb();
    await poblarPlanesEstudioEnDb();
    await inicializarPlanesEstudioAnalizador();
  });

  it('inicializa la caché del analizador con todos los planes de estudio en SQLite', async () => {
    const planes = getPlanesEstudioAnalizadorCache();
    expect(planes.length).toBeGreaterThanOrEqual(10);

    const planesEpja = planes.filter(p => p.categoria === 'EPJA');
    expect(planesEpja.length).toBeGreaterThanOrEqual(10);
  });

  it('reconoce y resuelve planes de estudio dinámicos para cursos EPJA 2024 (Decreto 10/2022)', () => {
    const epjaB1 = buscarPlanEstudioAnalizador('Educación Básica - Nivel 1');
    expect(epjaB1).toBeDefined();
    expect(epjaB1?.totalHorasSemanalesObligatorias).toBe(10);
    expect(epjaB1?.decretoSupremo).toBe('Decreto Supremo de Educación N° 10/2022');

    const epjaTpOficios = buscarPlanEstudioAnalizador('Educación Media Técnico-Profesional con Formación en Oficios - Nivel 1');
    expect(epjaTpOficios).toBeDefined();
    expect(epjaTpOficios?.totalHorasSemanalesObligatorias).toBe(26);

    const epjaTpEspec = buscarPlanEstudioAnalizador('Educación Media Técnico-Profesional con Formación en Especialidades - Nivel 1');
    expect(epjaTpEspec).toBeDefined();
    expect(epjaTpEspec?.totalHorasSemanalesObligatorias).toBe(24);
  });

  it('proporciona asignaturas oficiales sugeridas para un curso extrayéndolas del plan dinámico', () => {
    const asignaturasEpjaB1 = getAsignaturasSugeridasParaNivel('Educación Básica - Nivel 1');
    expect(asignaturasEpjaB1).toContain('Lenguaje y Comunicación');
    expect(asignaturasEpjaB1).toContain('Matemática');
    expect(asignaturasEpjaB1).toContain('Apoyo PIE / Codocencia');
  });

  it('clasifica y homologa asignaturas específicas de los planes de estudio cargados en SQLite', () => {
    // Clasificación local con conocimiento de los planes
    const classResult = classifyLocal('Lengua y Literatura');
    expect(classResult).toBeDefined();
    expect(classResult?.category).toBe('AULA');

    // Homologación por regla contra plan EPJA 2024
    const homResult = homologarAsignaturaPorRegla('Matemática', 'Educación Básica - Nivel 1');
    expect(homResult.asignaturaOficial).toBe('Matemática');
    expect(homResult.confianza).toBe('ALTA');
  });

  it('calcula la cobertura horaria por curso utilizando los planes de estudio de la base de datos', () => {
    const teachers: TeacherRecord[] = [
      {
        rut: '11.222.333-4',
        teacher_name: 'Profesor EPJA Básica',
        establishment: 'CEIA Chillán',
        rbd: '12345',
        comuna: 'Chillán',
        activity: 'Lenguaje y Comunicación',
        hours: 5,
        category: 'AULA',
        source: 'Docente',
        curso: 'Educación Básica - Nivel 1 A'
      },
      {
        rut: '12.333.444-5',
        teacher_name: 'Profesor Matemática EPJA',
        establishment: 'CEIA Chillán',
        rbd: '12345',
        comuna: 'Chillán',
        activity: 'Matemática',
        hours: 5,
        category: 'AULA',
        source: 'Docente',
        curso: 'Educación Básica - Nivel 1 A'
      }
    ];

    const courseSummaries = buildCourseLoadSummaries(teachers);
    expect(courseSummaries.length).toBe(1);

    const curso = courseSummaries[0];
    expect(curso.total_horas).toBe(10);
    expect(curso.horas_plan_estudio).toBe(10);
    expect(curso.estado_cobertura).toBe('CUBIERTO');
    expect(curso.porcentaje_cobertura_plan).toBe(100);
  });

  it('aprende y reconoce inmediatamente nuevos planes de estudio personalizados agregados sin código', async () => {
    const planPersonalizado: PlanEstudioCurricular = {
      id: 'plan-agro-diguillin-2026',
      nivel: '3° Medio Especialidad Agropecuaria Mención Vitivinícola',
      regimen: 'JEC',
      categoria: 'MEDIA_TP',
      decretoSupremo: 'Plan Propio Aprobado SLEP 2026',
      totalHorasSemanalesObligatorias: 38,
      totalHorasPlan: 42,
      horasLibreDisposicion: 4,
      asignaturas: [
        { nombre: 'Manejo de Viñedos y Cepa País', horasSemanales: 10, caracter: 'Obligatoria' },
        { nombre: 'Enología y Fermentación Artesanal', horasSemanales: 8, caracter: 'Obligatoria' },
        { nombre: 'Gestión Comercial Vitivinícola', horasSemanales: 6, caracter: 'Obligatoria' },
        { nombre: 'Lengua y Literatura', horasSemanales: 4, caracter: 'Obligatoria' },
        { nombre: 'Matemática Aplicada', horasSemanales: 4, caracter: 'Obligatoria' }
      ],
      esPersonalizado: true
    };

    await guardarPlanEstudio(planPersonalizado);
    await inicializarPlanesEstudioAnalizador();

    // El analizador debe conocer el nuevo plan
    const planBuscado = buscarPlanEstudioAnalizador('3° Medio Especialidad Agropecuaria Mención Vitivinícola');
    expect(planBuscado).toBeDefined();
    expect(planBuscado?.totalHorasPlan).toBe(42);

    // Debe homologar la asignatura personalizada
    const homologado = homologarAsignaturaPorRegla('Manejo de Viñedos y Cepa País', '3° Medio Especialidad Agropecuaria Mención Vitivinícola');
    expect(homologado.asignaturaOficial).toBe('Manejo de Viñedos y Cepa País');
    expect(homologado.confianza).toBe('ALTA');
  });
});
