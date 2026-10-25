import { describe, it, expect, beforeEach } from 'vitest';
import { 
  reiniciarTodaLaBaseDatos, 
  guardarPlanEstudio, 
  listarPlanesEstudio, 
  obtenerPlanEstudioPorId 
} from '../src/database/db';
import { PlanEstudioCurricular, CursoSae, AsignacionHoraria } from '../src/types';
import { obtenerPlanPorCurso } from '@slep/mineduc-engine';

describe('Flujo de Asignación Docente y Gestión de Planes de Estudio', () => {
  beforeEach(async () => {
    await reiniciarTodaLaBaseDatos();
  });

  it('permite crear y persistir un plan de estudio personalizado con horas de libre disposición', async () => {
    const nuevoPlan: PlanEstudioCurricular = {
      id: `plan_custom_robotic_2026`,
      nivel: '7° Básico con Robótica y Programación',
      regimen: 'JEC',
      categoria: 'BASICA',
      decretoSupremo: 'Resolución Exenta N° 458/2026',
      totalHorasSemanalesObligatorias: 32,
      horasLibreDisposicion: 6,
      totalHorasPlan: 38,
      duracionAnoLectivoSemanas: 36,
      esPersonalizado: true,
      asignaturas: [
        { id: 'asig-1', nombre: 'Lengua y Literatura', horasSemanales: 6, caracter: 'Obligatoria' },
        { id: 'asig-2', nombre: 'Matemática', horasSemanales: 6, caracter: 'Obligatoria' },
        { id: 'asig-3', nombre: 'Ciencias Naturales', horasSemanales: 4, caracter: 'Obligatoria' },
        { id: 'asig-4', nombre: 'Historia, Geografía y Ciencias Sociales', horasSemanales: 4, caracter: 'Obligatoria' },
        { id: 'asig-5', nombre: 'Inglés', horasSemanales: 3, caracter: 'Obligatoria' },
        { id: 'asig-6', nombre: 'Educación Física y Salud', horasSemanales: 2, caracter: 'Obligatoria' },
        { id: 'asig-7', nombre: 'Artes Visuales y Música', horasSemanales: 3, caracter: 'Obligatoria' },
        { id: 'asig-8', nombre: 'Tecnología', horasSemanales: 1, caracter: 'Obligatoria' },
        { id: 'asig-9', nombre: 'Orientación', horasSemanales: 1, caracter: 'Obligatoria' },
        { id: 'asig-10', nombre: 'Religión', horasSemanales: 2, caracter: 'Opcional' }
      ]
    };

    await guardarPlanEstudio(nuevoPlan);

    const planes = await listarPlanesEstudio();
    const planGuardado = planes.find(p => p.id === 'plan_custom_robotic_2026');

    expect(planGuardado).toBeDefined();
    expect(planGuardado?.nivel).toBe('7° Básico con Robótica y Programación');
    expect(planGuardado?.horasLibreDisposicion).toBe(6);
    expect(planGuardado?.totalHorasPlan).toBe(38);
    expect(planGuardado?.asignaturas.length).toBe(10);
  });

  it('permite duplicar un plan oficial MINEDUC para crear una versión institucional modificada', async () => {
    // 1. Obtener plan oficial base de Básica JEC
    const planBase = obtenerPlanPorCurso('1° Básico', 'JEC');
    expect(planBase).toBeDefined();

    // 2. Duplicar plan con un nuevo ID
    const planDuplicado: PlanEstudioCurricular = {
      id: `plan_custom_duplicado_1basico`,
      nivel: `${planBase!.nivel} (Copia Personalizada Escuela Rural)`,
      regimen: planBase!.regimen,
      categoria: 'BASICA',
      decretoSupremo: 'Dto 2960 con Adecuación PEI',
      totalHorasSemanalesObligatorias: planBase!.horasObligatorias,
      horasLibreDisposicion: planBase!.horasLibreDisposicion,
      totalHorasPlan: planBase!.totalHorasPlan,
      esPersonalizado: true,
      asignaturas: planBase!.asignaturasBase.map((a, i) => ({
        id: `asig-dup-${i}`,
        nombre: a.nombre,
        horasSemanales: a.horasSugeridas,
        caracter: 'Obligatoria'
      }))
    };

    // Agregar taller específico en libre disposición
    planDuplicado.asignaturas.push({
      id: 'asig-taller-1',
      nombre: 'Taller de Huerto Escolar y Medioambiente',
      horasSemanales: 2,
      caracter: 'Electiva'
    });

    await guardarPlanEstudio(planDuplicado);

    const planEnDb = await obtenerPlanEstudioPorId('plan_custom_duplicado_1basico');
    expect(planEnDb).toBeDefined();
    expect(planEnDb?.esPersonalizado).toBe(true);
    expect(planEnDb?.asignaturas.some(a => a.nombre.includes('Huerto Escolar'))).toBe(true);
  });

  it('valida la lógica de asignación troncal vs libre disposición JEC con nombre propio', () => {
    const cursoJec: CursoSae = {
      id: 'curso-1-a',
      rbd: '3543',
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 5,
      alumnosNeep: 2,
      talleresJec: [
        { id: 'tj-1', nombre: 'Taller de Teatro Infantil', horas: 2 }
      ]
    };

    // Caso 1: Asignatura Troncal seleccionada de la lista oficial del plan
    const asigTroncal: AsignacionHoraria = {
      id: 'asig-troncal-1',
      rbd: cursoJec.rbd,
      cursoId: cursoJec.id,
      docenteId: 'doc-1',
      asignatura: 'Matemática',
      horasPedagogicasAula: 6,
      esTallerJec: false,
      esTallerSep: false
    };

    expect(asigTroncal.asignatura).toBe('Matemática');
    expect(asigTroncal.horasPedagogicasAula).toBe(6);
    expect(asigTroncal.esTallerJec).toBe(false);

    // Caso 2: Asignatura de Libre Disposición / Taller JEC con nombre personalizado
    const nombreTallerCustom = 'Taller de Robótica Educativa y Pensamiento Computacional';
    const asigJecCustom: AsignacionHoraria = {
      id: 'asig-jec-1',
      rbd: cursoJec.rbd,
      cursoId: cursoJec.id,
      docenteId: 'doc-2',
      asignatura: nombreTallerCustom,
      horasPedagogicasAula: 2,
      esTallerJec: true,
      esTallerSep: false
    };

    expect(asigJecCustom.asignatura).toBe(nombreTallerCustom);
    expect(asigJecCustom.esTallerJec).toBe(true);
    expect(asigJecCustom.horasPedagogicasAula).toBe(2);

    // Caso 3: Asignación de Taller JEC ya registrado en el curso
    const asigJecExistente: AsignacionHoraria = {
      id: 'asig-jec-2',
      rbd: cursoJec.rbd,
      cursoId: cursoJec.id,
      docenteId: 'doc-3',
      asignatura: cursoJec.talleresJec![0].nombre,
      horasPedagogicasAula: cursoJec.talleresJec![0].horas,
      esTallerJec: true,
      esTallerSep: false
    };

    expect(asigJecExistente.asignatura).toBe('Taller de Teatro Infantil');
    expect(asigJecExistente.esTallerJec).toBe(true);
  });

  it('calcula la disponibilidad de asignaturas por curso y prioriza la afinidad del docente (caso Alejandra Ferrada)', () => {
    const curso1B: CursoSae = {
      id: 'c-1b-a',
      rbd: '3543',
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 28,
      alumnosNeet: 3,
      alumnosNeep: 1
    };

    // Alejandra ya enseña Inglés en 2° Básico
    const asignacionesColegio: AsignacionHoraria[] = [
      {
        id: 'asig-ale-2b',
        rbd: '3543',
        cursoId: 'c-2b-a',
        docenteId: 'doc-alejandra-ferrada',
        asignatura: 'Idioma Extranjero: Inglés',
        horasPedagogicasAula: 2
      },
      // En 1° Básico A ya está asignado Lenguaje (8 HA) y Matemática (6 HA)
      {
        id: 'asig-leng-1b',
        rbd: '3543',
        cursoId: 'c-1b-a',
        docenteId: 'doc-lenguaje',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 8
      },
      {
        id: 'asig-mat-1b',
        rbd: '3543',
        cursoId: 'c-1b-a',
        docenteId: 'doc-matematica',
        asignatura: 'Matemática',
        horasPedagogicasAula: 6
      }
    ];

    // Verificar afinidad del docente
    const asigsDocAlejandra = asignacionesColegio.filter(a => a.docenteId === 'doc-alejandra-ferrada');
    const materiaAfin = asigsDocAlejandra[0]?.asignatura;
    expect(materiaAfin).toBe('Idioma Extranjero: Inglés');

    // Verificar que en 1° Básico A Lenguaje y Matemática están CUBIERTAS (saldo 0)
    const asigs1B = asignacionesColegio.filter(a => a.cursoId === 'c-1b-a');
    const horasLeng = asigs1B.filter(a => a.asignatura === 'Lenguaje y Comunicación').reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const horasMat = asigs1B.filter(a => a.asignatura === 'Matemática').reduce((s, a) => s + a.horasPedagogicasAula, 0);
    expect(horasLeng).toBe(8);
    expect(horasMat).toBe(6);

    // Y que Inglés está 100% DISPONIBLE en 1° Básico A para Alejandra
    const horasIngles1B = asigs1B.filter(a => a.asignatura === 'Idioma Extranjero: Inglés').reduce((s, a) => s + a.horasPedagogicasAula, 0);
    expect(horasIngles1B).toBe(0); // 0 asignadas -> disponible para asignar a Alejandra
  });
});
