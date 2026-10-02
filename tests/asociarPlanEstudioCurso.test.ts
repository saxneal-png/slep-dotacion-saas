import { describe, it, expect, beforeEach } from 'vitest';
import { reiniciarTodaLaBaseDatos, listarCursos, guardarEstablecimiento } from '../src/database/db';
import { ejecutarTraspasoDotacionAnalizador } from '../src/database/repositories/traspasoRepo';
import { CourseLoadSummary, SchoolSummary, TeacherConsolidatedLoad } from '../src/types/analizadorTypes';

describe('Asociación de Planes de Estudio a Cursos Detectados', () => {
  beforeEach(async () => {
    await reiniciarTodaLaBaseDatos();
    await guardarEstablecimiento({
      id: 'est-3543',
      rbd: '3543',
      nombre: 'Liceo Polivalente San Ignacio',
      comuna: 'San Ignacio',
      regimen: 'JEC',
      porcentajePrioritarios: 80,
    });
  });

  it('debe transferir cursos a SQLite con su planEstudioId y especialidad asociados', async () => {
    const mockSchools: SchoolSummary[] = [
      {
        rbd: '3543',
        establishment: 'Liceo Polivalente San Ignacio',
        comuna: 'San Ignacio',
        matricula: 450,
        horas_aula: 100,
        horas_directivas: 44,
        horas_tecnicas: 30,
        total_horas_ee: 174,
        teachers_count: 5,
        has_discrepancy: false,
        source_file: 'nomina.xlsx',
        modalidad_detectada: 'POLIVALENTE_MIXTO',
      },
    ];

    const mockCourses: CourseLoadSummary[] = [
      {
        curso: '1° Básico A',
        nivel: '1° Básico',
        letra: 'A',
        regimen: 'JEC',
        rbd: '3543',
        establishment: 'Liceo Polivalente San Ignacio',
        total_horas: 38,
        plan_estudio_id: 'plan-basica-1-jec',
        plan_referencia: '1° Básico JEC (Dto 2960)',
        horas_plan_estudio: 38,
        estado_cobertura: 'CUBIERTO',
        docentes: [],
      },
      {
        curso: '3° Medio Agropecuario TP',
        nivel: '3° Medio TP',
        letra: 'A',
        regimen: 'JEC',
        rbd: '3543',
        establishment: 'Liceo Polivalente San Ignacio',
        total_horas: 42,
        plan_estudio_id: 'plan-tp-agro-3medio',
        plan_referencia: '3° Medio TP Agropecuaria (Dto 452)',
        especialidad_tp: 'Agropecuaria',
        horas_plan_estudio: 42,
        estado_cobertura: 'CUBIERTO',
        docentes: [],
      },
    ];

    const mockTeacherLoads: TeacherConsolidatedLoad[] = [];

    const result = await ejecutarTraspasoDotacionAnalizador(
      {
        periodo: 2026,
        modo: 'REEMPLAZAR',
        alcance: 'COMPLETO',
        homologaciones: {},
        colegiosRbd: ['3543'],
      },
      {
        schools: mockSchools,
        teachers: [],
        courses: mockCourses,
        teacherLoads: mockTeacherLoads,
        asistentes: [],
      }
    );

    expect(result.cursosCreados).toBe(2);

    const cursosDb = await listarCursos('3543', 2026);
    expect(cursosDb.length).toBe(2);

    const cursoBasica = cursosDb.find((c) => c.nivel === '1° Básico');
    expect(cursoBasica).toBeDefined();
    expect(cursoBasica?.planEstudioId).toBe('plan-basica-1-jec');

    const cursoTp = cursosDb.find((c) => c.nivel === '3° Medio TP');
    expect(cursoTp).toBeDefined();
    expect(cursoTp?.planEstudioId).toBe('plan-tp-agro-3medio');
    expect(cursoTp?.especialidadTp).toBe('Agropecuaria');
  });
});
