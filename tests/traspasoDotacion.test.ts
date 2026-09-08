import { describe, it, expect, beforeEach } from 'vitest';
import {
  homologarAsignaturaPorRegla,
  buildHomologacionList,
  getAsignaturasSugeridasParaNivel
} from '../src/services/analizador/homologationService';
import {
  ejecutarTraspasoDotacionAnalizador,
  getDb,
  listarCursos,
  listarDocentes,
  listarAsignaciones
} from '../src/database/db';
import {
  SchoolSummary,
  TeacherRecord,
  CourseLoadSummary,
  TeacherConsolidatedLoad,
  TraspasoConfig
} from '../src/types/analizadorTypes';

describe('Servicio de Homologación Curricular MINEDUC', () => {
  it('homologa asignaturas básicas a planes de estudio oficiales', () => {
    // 1° a 6° Básico
    expect(homologarAsignaturaPorRegla('LENGUAJE', '3° Básico').asignaturaOficial).toBe('Lenguaje y Comunicación');
    expect(homologarAsignaturaPorRegla('MAT.', '4° Básico').asignaturaOficial).toBe('Matemática');
    expect(homologarAsignaturaPorRegla('C. NATURALES', '2° Básico').asignaturaOficial).toBe('Ciencias Naturales');
    expect(homologarAsignaturaPorRegla('HISTORIA Y GEOGRAFIA', '5° Básico').asignaturaOficial).toBe('Historia, Geografía y Ciencias Sociales');
    expect(homologarAsignaturaPorRegla('ED. FISICA', '1° Básico').asignaturaOficial).toBe('Educación Física y Salud');
    expect(homologarAsignaturaPorRegla('INGLES', '5° Básico').asignaturaOficial).toBe('Idioma Extranjero: Inglés');
    expect(homologarAsignaturaPorRegla('ARTES PLASTICAS', '3° Básico').asignaturaOficial).toBe('Artes Visuales');
    expect(homologarAsignaturaPorRegla('TECNOLOGIA', '6° Básico').asignaturaOficial).toBe('Tecnología');
    expect(homologarAsignaturaPorRegla('RELIGION', '4° Básico').asignaturaOficial).toBe('Religión');
  });

  it('diferencia entre Básica y Media/7°-8° (Lengua y Literatura)', () => {
    // En 7° y 8° Básico o Media debe ser Lengua y Literatura
    expect(homologarAsignaturaPorRegla('LENGUAJE', '7° Básico').asignaturaOficial).toBe('Lengua y Literatura');
    expect(homologarAsignaturaPorRegla('LENGUAJE', '1° Medio').asignaturaOficial).toBe('Lengua y Literatura');
    expect(homologarAsignaturaPorRegla('LENGUAJE Y COMUNICACION', '3° Medio').asignaturaOficial).toBe('Lengua y Literatura');

    // En Básica 1°-6° debe ser Lenguaje y Comunicación
    expect(homologarAsignaturaPorRegla('LENGUAJE', '2° Básico').asignaturaOficial).toBe('Lenguaje y Comunicación');
  });

  it('identifica ámbitos de Educación Parvularia (NT1 y NT2)', () => {
    expect(homologarAsignaturaPorRegla('LENGUAJE VERBAL', 'Pre-Kínder').asignaturaOficial).toBe('Ámbito Comunicación Integral');
    expect(homologarAsignaturaPorRegla('DESARROLLO PERSONAL', 'Kínder').asignaturaOficial).toBe('Ámbito Desarrollo Personal y Social');
    expect(homologarAsignaturaPorRegla('ENTORNO NATURAL', 'NT1').asignaturaOficial).toBe('Ámbito Interacción y Comprensión del Entorno');
  });

  it('identifica funciones PIE y Talleres de libre disposición JEC', () => {
    const pie = homologarAsignaturaPorRegla('CODOCENCIA PIE MATEMATICA', '5° Básico');
    expect(pie.asignaturaOficial).toBe('Apoyo PIE / Codocencia');
    expect(pie.esPie).toBe(true);

    const taller = homologarAsignaturaPorRegla('TALLER DE ROBOTICA JEC', '7° Básico');
    expect(taller.asignaturaOficial).toBe('Talleres JEC / Libre Disposición');
    expect(taller.esTallerJec).toBe(true);
  });

  it('genera lista consolidada única de homologaciones con horas acumuladas', async () => {
    const dummyTeacherLoads: TeacherConsolidatedLoad[] = [
      {
        rut: '16.735.997-3',
        teacher_name: 'GARCIA CORVALAN, NATALY GRACE',
        rbd: '3663',
        establishment: 'ESCUELA REPUBLICA DE MEXICO',
        horas_contrato: 39,
        total_asignado: 39,
        diferencia: 0,
        estado_carga: 'CUADRADA',
        cursos: [
          { curso: '1° Básico A', asignatura: 'LENGUAJE', horas: 8, tipo: 'AULA' },
          { curso: '2° Básico A', asignatura: 'LENGUAJE', horas: 8, tipo: 'AULA' },
          { curso: '1° Básico A', asignatura: 'MATEMATICA', horas: 6, tipo: 'AULA' },
        ],
        horas_aula: 22,
        horas_tecnicas: 0,
        horas_directivas: 0,
        is_over_legal_limit: false,
      }
    ];

    const items = await buildHomologacionList([], dummyTeacherLoads);
    expect(items.length).toBe(3);

    const leng1 = items.find(i => i.key === 'LENGUAJE__1° Básico A');
    expect(leng1).toBeDefined();
    expect(leng1?.asignaturaOficial).toBe('Lenguaje y Comunicación');
    expect(leng1?.horasTotales).toBe(8);

    const mat1 = items.find(i => i.key === 'MATEMATICA__1° Básico A');
    expect(mat1).toBeDefined();
    expect(mat1?.asignaturaOficial).toBe('Matemática');
    expect(mat1?.horasTotales).toBe(6);
  });
});

describe('Transacción de Traspaso a Dotación 2026 en SQLite', () => {
  beforeEach(async () => {
    await getDb();
  });

  it('traspasa exitosamente cursos, docentes y asignaciones homologadas al periodo 2026', async () => {
    const schools: SchoolSummary[] = [
      {
        rbd: '3663',
        establishment: 'ESCUELA REPUBLICA DE MEXICO',
        comuna: 'Chillán',
        matricula: 250,
        total_cursos: 2,
        total_docentes: 1,
        total_horas_contrato: 39,
        total_horas_ee: 39,
        total_horas_aula: 30,
        total_horas_directivas: 0,
        total_horas_tecnicas: 0,
        discrepancy: 0,
      }
    ];

    const courses: CourseLoadSummary[] = [
      {
        curso: '1° Básico A',
        nivel: '1° Básico',
        letra: 'A',
        rbd: '3663',
        establishment: 'ESCUELA REPUBLICA DE MEXICO',
        comuna: 'Chillán',
        total_horas: 14,
        docentes: [],
      }
    ];

    const teacherLoads: TeacherConsolidatedLoad[] = [
      {
        rut: '16.735.997-3',
        teacher_name: 'GARCIA CORVALAN, NATALY GRACE',
        rbd: '3663',
        establishment: 'ESCUELA REPUBLICA DE MEXICO',
        comuna: 'Chillán',
        horas_contrato: 39,
        total_asignado: 39,
        diferencia: 0,
        estado_carga: 'CUADRADA',
        cursos: [
          { curso: '1° Básico A', asignatura: 'LENG.', horas: 8, tipo: 'AULA' },
          { curso: '1° Básico A', asignatura: 'MAT.', horas: 6, tipo: 'AULA' },
        ],
        horas_aula: 14,
        horas_tecnicas: 0,
        horas_directivas: 0,
        is_over_legal_limit: false,
      }
    ];

    const config: TraspasoConfig = {
      periodo: 2026,
      modo: 'REEMPLAZAR',
      homologaciones: {
        'LENG.__1° Básico A': 'Lenguaje y Comunicación',
        'MAT.__1° Básico A': 'Matemática',
      },
      colegiosRbd: ['3663'],
    };

    const res = await ejecutarTraspasoDotacionAnalizador(config, {
      schools,
      teachers: [],
      courses,
      teacherLoads,
    });

    expect(res.colegiosProcesados).toBe(1);
    expect(res.cursosCreados).toBeGreaterThanOrEqual(1);
    expect(res.docentesGuardados).toBe(1);
    expect(res.asignacionesGuardadas).toBe(2);

    // Verificar en SQLite
    const cursosDb = await listarCursos('3663', 2026);
    expect(cursosDb.some(c => c.nivel === '1° Básico' && c.letra === 'A')).toBe(true);

    const docentesDb = await listarDocentes('3663', 2026);
    expect(docentesDb.some(d => d.run.includes('16735997') || d.run.includes('16.735.997'))).toBe(true);

    const asigsDb = await listarAsignaciones('3663', 2026);
    expect(asigsDb.length).toBe(2);

    // Verificar que las asignaturas guardadas corresponden a los nombres oficiales MINEDUC homologados
    const asigNombres = asigsDb.map(a => a.asignatura);
    expect(asigNombres).toContain('Lenguaje y Comunicación');
    expect(asigNombres).toContain('Matemática');
  });

  it('homologa y aplica regla para Talleres SEP y Proporción Docente (Recreo / HL)', async () => {
    // 1. Homologación por regla
    const homRecreo = homologarAsignaturaPorRegla('RECREO', '2° Básico');
    expect(homRecreo.esProporcionDocente).toBe(true);
    expect(homRecreo.asignaturaOficial).toContain('Proporción Docente');

    const homHL = homologarAsignaturaPorRegla('H.L.', '3° Básico');
    expect(homHL.esProporcionDocente).toBe(true);

    const homSep = homologarAsignaturaPorRegla('TALLER SEP MUSICA', '4° Básico');
    expect(homSep.esTallerSep).toBe(true);
    expect(homSep.asignaturaOficial).toBe('Taller Extracurricular SEP');

    // 2. Traspaso: Recreo/HL debe ser omitido de asignaciones_horarias y Taller SEP marcado con esTallerSep
    const schools: SchoolSummary[] = [
      {
        rbd: '3638',
        establishment: 'LICEO BICENTENARIO MARTA BRUNET CÁRAVES',
        comuna: 'Chillán',
        matricula: 400,
        total_cursos: 1,
        total_docentes: 1,
        total_horas_contrato: 44,
        total_horas_ee: 44,
        total_horas_aula: 30,
        total_horas_directivas: 0,
        total_horas_tecnicas: 0,
        discrepancy: 0,
      }
    ];

    const courses: CourseLoadSummary[] = [
      {
        curso: '2° Básico A',
        nivel: '2° Básico',
        letra: 'A',
        rbd: '3638',
        establishment: 'LICEO BICENTENARIO MARTA BRUNET CÁRAVES',
        comuna: 'Chillán',
        total_horas: 16,
        docentes: [],
      }
    ];

    const teacherLoads: TeacherConsolidatedLoad[] = [
      {
        rut: '12.345.678-9',
        teacher_name: 'GONZALEZ, JUAN',
        rbd: '3638',
        establishment: 'LICEO BICENTENARIO MARTA BRUNET CÁRAVES',
        comuna: 'Chillán',
        horas_contrato: 44,
        total_asignado: 44,
        diferencia: 0,
        estado_carga: 'CUADRADA',
        cursos: [
          { curso: '2° Básico A', asignatura: 'LENGUAJE', horas: 8, tipo: 'AULA' },
          { curso: '2° Básico A', asignatura: 'TALLER SEP MUSICA', horas: 4, tipo: 'AULA' },
          { curso: '2° Básico A', asignatura: 'RECREO', horas: 4, tipo: 'AULA' },
        ],
        horas_aula: 16,
        horas_tecnicas: 0,
        horas_directivas: 0,
        is_over_legal_limit: false,
      }
    ];

    const config: TraspasoConfig = {
      periodo: 2026,
      modo: 'REEMPLAZAR',
      homologaciones: {
        'LENGUAJE__2° Básico A': 'Lenguaje y Comunicación',
        'TALLER SEP MUSICA__2° Básico A': 'Taller Extracurricular SEP',
        'RECREO__2° Básico A': 'Proporción Docente (Recreo / No Lectiva 65/35 o 60/40)'
      },
      colegiosRbd: ['3638'],
      targetRbdOverride: '3638',
      cursosJecMap: { '2° Básico A': 'No JEC' },
      cursosProporcionMap: { '2° Básico A': '60_40' }
    };

    const res = await ejecutarTraspasoDotacionAnalizador(config, {
      schools,
      teachers: [],
      courses,
      teacherLoads,
    });

    // Deben haberse guardado 2 asignaciones (Lenguaje y Taller SEP), Recreo NO debe estar en asignaciones_horarias
    expect(res.asignacionesGuardadas).toBe(2);

    const asigsDb = await listarAsignaciones('3638', 2026);
    expect(asigsDb.length).toBe(2);

    const tallerSepAsig = asigsDb.find(a => a.esTallerSep);
    expect(tallerSepAsig).toBeDefined();
    expect(tallerSepAsig?.asignatura).toBe('Taller Extracurricular SEP');

    const recreoAsig = asigsDb.find(a => a.asignatura.toLowerCase().includes('recreo'));
    expect(recreoAsig).toBeUndefined();

    // Verificar que el curso guardó régimen No JEC y proporción 60_40
    const cursosDb = await listarCursos('3638', 2026);
    const curso2 = cursosDb.find(c => c.nivel === '2° Básico');
    expect(curso2).toBeDefined();
    expect(curso2?.regimen).toBe('No JEC');
    expect(curso2?.regimenProporcion).toBe('60_40');
  });

  it('maneja roles directivos, UTP, coordinaciones (PIE, Convivencia, Extraescolar) y apoyos (Co-docencia, Agrupaciones Flexibles)', async () => {
    const schools: SchoolSummary[] = [
      {
        rbd: '3639',
        establishment: 'LICEO NARCISO TONDREAU',
        comuna: 'Chillán',
        matricula: 500,
        total_cursos: 2,
        total_docentes: 4,
        total_horas_contrato: 176,
        total_horas_ee: 176,
        total_horas_aula: 80,
        total_horas_directivas: 44,
        total_horas_tecnicas: 30,
        discrepancy: 0,
      }
    ];

    const courses: CourseLoadSummary[] = [
      {
        curso: '1° Medio A',
        nivel: '1° Medio',
        letra: 'A',
        rbd: '3639',
        establishment: 'LICEO NARCISO TONDREAU',
        comuna: 'Chillán',
        total_horas: 38,
        docentes: [],
      }
    ];

    const teacherLoads: TeacherConsolidatedLoad[] = [
      // 1. Director (44h Directivas puras, sin horas de aula)
      {
        rut: '11.111.111-1',
        teacher_name: 'PEREZ, CARLOS',
        rbd: '3639',
        establishment: 'LICEO NARCISO TONDREAU',
        comuna: 'Chillán',
        horas_contrato: 44,
        total_asignado: 44,
        diferencia: 0,
        estado_carga: 'CUADRADA',
        cursos: [
          { curso: 'Institucional', asignatura: 'DIRECTOR', horas: 44, tipo: 'AULA' }
        ],
        horas_aula: 0,
        horas_tecnicas: 0,
        horas_directivas: 44,
        is_over_legal_limit: false,
      },
      // 2. Jefe UTP (30h UTP + 14h Lenguaje)
      {
        rut: '22.222.222-2',
        teacher_name: 'ROJAS, MARIA',
        rbd: '3639',
        establishment: 'LICEO NARCISO TONDREAU',
        comuna: 'Chillán',
        horas_contrato: 44,
        total_asignado: 44,
        diferencia: 0,
        estado_carga: 'CUADRADA',
        cursos: [
          { curso: 'Institucional', asignatura: 'JEFE UTP', horas: 30, tipo: 'AULA' },
          { curso: '1° Medio A', asignatura: 'LENGUAJE', horas: 14, tipo: 'AULA' }
        ],
        horas_aula: 14,
        horas_tecnicas: 30,
        horas_directivas: 0,
        is_over_legal_limit: false,
      },
      // 3. Coordinador PIE (20h Coordinación PIE + 24h Co-docencia PIE)
      {
        rut: '33.333.333-3',
        teacher_name: 'SOTO, ANDREA',
        rbd: '3639',
        establishment: 'LICEO NARCISO TONDREAU',
        comuna: 'Chillán',
        horas_contrato: 44,
        total_asignado: 44,
        diferencia: 0,
        estado_carga: 'CUADRADA',
        cursos: [
          { curso: 'Institucional', asignatura: 'COORDINADOR PIE', horas: 20, tipo: 'AULA' },
          { curso: '1° Medio A', asignatura: 'CODOCENCIA PIE', horas: 24, tipo: 'AULA' }
        ],
        horas_aula: 24,
        horas_tecnicas: 0,
        horas_directivas: 0,
        is_over_legal_limit: false,
      },
      // 4. Convivencia (20h) + Extraescolar (10h) + Agrupaciones Flexibles (14h)
      {
        rut: '44.444.444-4',
        teacher_name: 'MOLINA, PEDRO',
        rbd: '3639',
        establishment: 'LICEO NARCISO TONDREAU',
        comuna: 'Chillán',
        horas_contrato: 44,
        total_asignado: 44,
        diferencia: 0,
        estado_carga: 'CUADRADA',
        cursos: [
          { curso: 'Institucional', asignatura: 'COORDINADOR DE CONVIVENCIA ESCOLAR', horas: 20, tipo: 'AULA' },
          { curso: 'Institucional', asignatura: 'COORDINADOR EXTRAESCOLAR ACLE', horas: 10, tipo: 'AULA' },
          { curso: '1° Medio A', asignatura: 'AGRUPACIONES FLEXIBLES', horas: 14, tipo: 'AULA' }
        ],
        horas_aula: 14,
        horas_tecnicas: 0,
        horas_directivas: 0,
        is_over_legal_limit: false,
      }
    ];

    const config: TraspasoConfig = {
      periodo: 2026,
      modo: 'REEMPLAZAR',
      homologaciones: {},
      colegiosRbd: ['3639'],
      targetRbdOverride: '3639'
    };

    const res = await ejecutarTraspasoDotacionAnalizador(config, {
      schools,
      teachers: [],
      courses,
      teacherLoads,
    });

    expect(res.docentesGuardados).toBe(4);
    // Asignaciones guardadas deben ser exactamente 3:
    // 1) Lenguaje de Rojas, 2) Co-docencia de Soto, 3) Agrupaciones Flexibles de Molina.
    // (Director, UTP, Coord PIE, Convivencia y Extraescolar NO deben insertarse como asignaturas de curso)
    expect(res.asignacionesGuardadas).toBe(3);

    const docentesDb = await listarDocentes('3639', 2026);
    const cleanRun = (r: string) => (r || '').replace(/[^0-9kK]/g, '');
    
    // Validar Director
    const director = docentesDb.find(d => cleanRun(d.run).includes('11111111'));
    expect(director).toBeDefined();
    expect(director?.horasDirectivas).toBe(44);
    expect(director?.estamento).toBe('DIRECTIVO');

    // Validar UTP
    const utp = docentesDb.find(d => cleanRun(d.run).includes('22222222'));
    expect(utp).toBeDefined();
    expect(utp?.horasTecnicoPedagogicas).toBe(30);
    expect(utp?.estamento).toBe('TECNICO_PEDAGOGICO');

    // Validar Coordinador PIE
    const coordPie = docentesDb.find(d => cleanRun(d.run).includes('33333333'));
    expect(coordPie).toBeDefined();
    expect(coordPie?.horasCoordinacion).toBe(20);
    expect(coordPie?.horasCoordinacionPie).toBe(20);
    expect(coordPie?.tipoCoordinacion).toBe('PIE');

    // Validar Convivencia y Extraescolar
    const multiasig = docentesDb.find(d => cleanRun(d.run).includes('44444444'));
    expect(multiasig).toBeDefined();
    expect(multiasig?.horasCoordinacion).toBe(30);
    expect(multiasig?.horasConvivenciaEscolar).toBe(20);
    expect(multiasig?.horasExtraescolar).toBe(10);

    // Validar Asignaciones de Aula
    const asigsDb = await listarAsignaciones('3639', 2026);
    expect(asigsDb.length).toBe(3);

    const codocencia = asigsDb.find(a => a.esCoDocencia);
    expect(codocencia).toBeDefined();
    expect(codocencia?.tieneCoDocente).toBe(true);

    const flexible = asigsDb.find(a => a.esAgrupacionFlexible);
    expect(flexible).toBeDefined();
  });

  it('ejecuta borrado masivo de dotación por periodo preservando el establecimiento', async () => {
    const { borrarDotacionPeriodo, listarEstablecimientos } = await import('../src/database/db');
    const deleteResult = await borrarDotacionPeriodo(2026, '3639');
    expect(deleteResult.cursosBorrados).toBeGreaterThanOrEqual(1);
    expect(deleteResult.docentesBorrados).toBe(4);
    expect(deleteResult.asignacionesBorradas).toBe(3);

    // Las asignaciones y docentes quedan en 0 para el colegio
    const asigsDespues = await listarAsignaciones('3639', 2026);
    expect(asigsDespues.length).toBe(0);

    const docentesDespues = await listarDocentes('3639', 2026);
    expect(docentesDespues.length).toBe(0);

    // Pero el establecimiento PERMANECE intacto en el catálogo
    const todosEst = await listarEstablecimientos();
    const existeColegio = todosEst.some(e => e.rbd === '3639');
    expect(existeColegio).toBe(true);
  });
});
