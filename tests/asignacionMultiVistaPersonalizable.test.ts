import { describe, it, expect, beforeEach } from 'vitest';
import {
  obtenerPreferenciaModoAsignacion,
  guardarPreferenciaModoAsignacion
} from '../src/services/configuracionGeneralService';
import {
  calcularMapaDisponibilidadDocentePorCursos,
  simularImpactoAsignacion
} from '../src/services/curricularPlanService';
import { AsignacionHoraria, CursoSae, Docente } from '../src/types';

function crearDocenteFixture(overrides: Partial<Docente> = {}): Docente {
  return {
    id: 'doc-1',
    rbd: '4100',
    run: '12.345.678-9',
    nombres: 'María',
    apellidos: 'González Pérez',
    estamento: 'DOCENTE_AULA',
    calidadJuridica: 'TITULAR',
    horasContrato: 30,
    horasSubvencionGeneralTitular: 30,
    horasSubvencionGeneralContrata: 0,
    horasSepTitular: 0,
    horasSepContrata: 0,
    horasPieTitular: 0,
    horasPieContrata: 0,
    asignaturaPrincipal: 'Matemática',
    aplicaArticulo69: false,
    ...overrides
  };
}

function crearCursoFixture(overrides: Partial<CursoSae> = {}): CursoSae {
  return {
    id: 'curso-5a',
    rbd: '4100',
    nivel: '5° Básico',
    letra: 'A',
    regimenJornada: 'JEC',
    matriculados: 28,
    cuposTotales: 35,
    prioritarios: 15,
    preferentes: 4,
    estudiantesPieNEE: 2,
    esMultigrado: false,
    ...overrides
  };
}

describe('Preferencias personalizables de vista de asignación y motor único', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('retorna "drawer" por defecto y aísla la preferencia por usuario + establecimiento (RBD)', () => {
    expect(obtenerPreferenciaModoAsignacion('dir-1', '4100')).toBe('drawer');
    expect(obtenerPreferenciaModoAsignacion('dir-2', '4100')).toBe('drawer');

    guardarPreferenciaModoAsignacion('sabana', 'dir-1', '4100');
    guardarPreferenciaModoAsignacion('split', 'dir-1', '4200');
    guardarPreferenciaModoAsignacion('split', 'dir-2', '4100');

    expect(obtenerPreferenciaModoAsignacion('dir-1', '4100')).toBe('sabana');
    expect(obtenerPreferenciaModoAsignacion('dir-1', '4200')).toBe('split');
    expect(obtenerPreferenciaModoAsignacion('dir-2', '4100')).toBe('split');
    expect(obtenerPreferenciaModoAsignacion('otro-dir', '4100')).toBe('drawer');
  });

  it('calcula mapa panorámico de cursos con afinidad y cobertura compartida entre las 3 vistas', () => {
    const docente = crearDocenteFixture({ asignaturaPrincipal: 'Matemática' });
    const curso5A = crearCursoFixture({ id: 'c-5a', nivel: '5° Básico', letra: 'A' });
    const curso6A = crearCursoFixture({ id: 'c-6a', nivel: '6° Básico', letra: 'A' });

    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-1',
        rbd: '4100',
        docenteId: 'doc-1',
        cursoId: 'c-5a',
        asignatura: 'Matemática',
        horasPedagogicasAula: 6,
        subvencionFinanciamiento: 'SUBV_GENERAL',
        periodo: 2027
      }
    ];

    const mapa = calcularMapaDisponibilidadDocentePorCursos(docente, [curso5A, curso6A], asignaciones);
    expect(mapa).toHaveLength(2);

    const item5A = mapa.find(m => m.curso.id === 'c-5a')!;
    const item6A = mapa.find(m => m.curso.id === 'c-6a')!;

    expect(item5A.horasAsignadasDocenteEnCurso).toBe(6);
    expect(item5A.estadoCobertura).toBe('PARCIAL');
    expect(item6A.horasAsignadasDocenteEnCurso).toBe(0);
    expect(item6A.estadoCobertura).toBe('SIN_ASIGNAR');
    expect(item6A.tieneAfinidad).toBe(true);
    expect(item6A.totalHorasFaltantesPlan).toBeGreaterThan(0);
  });

  it('simula impacto en tiempo real antes de asignar y alerta sobreasignación contractual', () => {
    const docente = crearDocenteFixture({
      horasContrato: 20,
      horasSubvencionGeneralTitular: 20
    });
    const curso = crearCursoFixture();

    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-base',
        rbd: '4100',
        docenteId: 'doc-1',
        cursoId: curso.id,
        asignatura: 'Matemática',
        horasPedagogicasAula: 12,
        subvencionFinanciamiento: 'SUBV_GENERAL',
        periodo: 2027
      }
    ];

    const impactoHolgado = simularImpactoAsignacion(docente, asignaciones, curso, 4, 40);
    expect(impactoHolgado.excedeContrato).toBe(false);
    expect(impactoHolgado.contratoCalculadoDespues).toBeGreaterThan(impactoHolgado.contratoCalculadoAntes);
    expect(impactoHolgado.saldoDespues).toBeLessThan(impactoHolgado.saldoAntes);

    const impactoExcedido = simularImpactoAsignacion(docente, asignaciones, curso, 20, 40);
    expect(impactoExcedido.excedeContrato).toBe(true);
    expect(impactoExcedido.saldoDespues).toBeLessThan(0);
    expect(impactoExcedido.advertencia).toBeTruthy();
  });
});
