import { describe, it, expect, beforeEach } from 'vitest';
import {
  obtenerPreferenciaModoAsignacion,
  guardarPreferenciaModoAsignacion
} from '../src/services/configuracionGeneralService';
import {
  calcularEstadoCursosParvularios,
  calcularMapaDisponibilidadDocentePorCursos,
  calcularSaldoDocentePorFuente,
  simularImpactoAsignacion
} from '../src/services/curricularPlanService';
import { auditarCargaDocenteIntegral, esDocenteEducadoraParvulos } from '../src/services/auditoriaDocenteService';
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

  it('unifica cálculo de Educación Parvularia DTO 306 (60m cronológicos) entre auditoría, simulador y mapa de cursos', () => {
    const educadora = crearDocenteFixture({
      id: 'ed-1',
      estamento: 'EDUCADORA_PARVULO',
      esEducadoraParvulo: true,
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      asignaturaPrincipal: 'Educación Parvularia'
    });

    const cursoNt1 = crearCursoFixture({
      id: 'nt1-a',
      nivel: 'NT1 (Pre-Kínder)',
      letra: 'A',
      regimen: 'JEC',
      regimenJornada: 'JEC',
      matriculaProyectada: 26,
      regimenProporcion: '65_35'
    });

    // 28.5 horas cronológicas = 1.710 min (tope legal de 44h en 65/35)
    const asigParv: AsignacionHoraria = {
      id: 'asig-parv-1',
      rbd: '4100',
      docenteId: 'ed-1',
      cursoId: 'nt1-a',
      asignatura: 'Atención Directa Parvularia (BCEP Integral)',
      horasPedagogicasAula: 28.5,
      periodo: 2027
    };

    const cursosMap = new Map([[cursoNt1.id, cursoNt1]]);
    const integral = auditarCargaDocenteIntegral(educadora, [asigParv], [], cursosMap, 40);
    expect(integral.isEducadoraParvulo).toBe(true);
    expect(integral.horasComprometidasDocente).toBe(44);
    expect(integral.saldoHoras).toBe(0);
    expect(integral.auditDoc.minutosRecreoTotal).toBe(180);
    expect(integral.auditDoc.minutosHnlTotal).toBe(750);
    expect(integral.auditDoc.minutosHnlPlanificacion40).toBe(300);

    // Simulador debe usar exactamente los 60m cronológicos: asignar 4h extra a 28.5h excede las 44h
    const simExtra = simularImpactoAsignacion(educadora, [asigParv], cursoNt1, 4, 40, {
      cursosColegio: [cursoNt1]
    });
    expect(simExtra.isEducadoraParvulo).toBe(true);
    expect(simExtra.excedeContrato).toBe(true);
    expect(simExtra.contratoCalculadoAntes).toBe(44);
    expect(simExtra.contratoCalculadoDespues).toBeGreaterThan(44);

    // Mapa de permanencia DTO 306 detecta los 35h25m JEC (2.125 min) vs 28.5h (1.710 min) cubiertas -> faltan 415 min / 6.92h (2da educadora)
    const mapaParv = calcularEstadoCursosParvularios([cursoNt1], [educadora], [asigParv], 40, '65_35');
    const estado = mapaParv.get('nt1-a')!;
    expect(estado.resultado.permanenciaMinutos).toBe(2125);
    expect(estado.resultado.minutosDeficitRestante).toBe(415);
    expect(estado.resultado.segundaEducadoraRequerida).toBe(true);
    expect(estado.resultado.requiereTecnicoParvuloDto315).toBe(true);

    const mapaCursos = calcularMapaDisponibilidadDocentePorCursos(
      educadora,
      [cursoNt1],
      [asigParv],
      [],
      null,
      [educadora]
    );
    expect(mapaCursos[0].esParvulario).toBe(true);
    expect(mapaCursos[0].tieneAfinidad).toBe(true);
    expect(mapaCursos[0].totalHorasFaltantesPlan).toBe(6.92);
  });

  it('expone desglose exacto de horas asignadas y disponibles de SEP y PIE para micro-fichas', () => {
    const docenteMixto = crearDocenteFixture({
      id: 'doc-mix',
      horasContrato: 38,
      horasSubvencionGeneralTitular: 24,
      horasSepTitular: 8,
      horasPieTitular: 6
    });
    const curso = crearCursoFixture({ id: 'c-5a' });

    const asigs: AsignacionHoraria[] = [
      {
        id: 'a-reg',
        rbd: '4100',
        docenteId: 'doc-mix',
        cursoId: 'c-5a',
        asignatura: 'Matemática',
        horasPedagogicasAula: 12,
        periodo: 2027
      },
      {
        id: 'a-sep',
        rbd: '4100',
        docenteId: 'doc-mix',
        cursoId: 'c-5a',
        asignatura: 'Taller Refuerzo Matemática SEP',
        horasPedagogicasAula: 4,
        esTallerSep: true,
        tipoApoyo: 'TALLER_SEP',
        periodo: 2027
      },
      {
        id: 'a-pie',
        rbd: '4100',
        docenteId: 'doc-mix',
        cursoId: 'c-5a',
        asignatura: 'Trabajo Colaborativo PIE',
        horasPedagogicasAula: 3,
        horasCronologicasPie: 3,
        esTrabajoColaborativo: true,
        tipoApoyo: 'TRABAJO_COLABORATIVO',
        periodo: 2027
      }
    ];

    const saldoFuente = calcularSaldoDocentePorFuente(docenteMixto, asigs, 40, [curso]);
    expect(saldoFuente.contratoSep).toBe(8);
    expect(saldoFuente.sepAsignado).toBeGreaterThan(0);
    expect(saldoFuente.sepDisponible).toBe(saldoFuente.contratoSep - saldoFuente.sepAsignado);
    expect(saldoFuente.contratoPie).toBe(6);
    expect(saldoFuente.pieAsignado).toBe(3);
    expect(saldoFuente.pieDisponible).toBe(3);
  });

  it('detecta Educadora de Párvulos por asignaturaPrincipal y reporta maxHAPermitidas según contrato aunque tenga carga parcial', () => {
    const educadoraPorAsignatura = crearDocenteFixture({
      id: 'ed-asig',
      estamento: 'DOCENTE_AULA',
      asignaturaPrincipal: 'Educación Parvularia',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44
    });

    expect(esDocenteEducadoraParvulos(educadoraPorAsignatura)).toBe(true);

    const cursoKinder = crearCursoFixture({
      id: 'c-kinder',
      nivel: 'Kínder',
      letra: 'A',
      regimenJornada: 'JEC',
      regimenProporcion: '65_35'
    });

    const asigParcial: AsignacionHoraria[] = [
      {
        id: 'asig-parcial',
        rbd: '4100',
        docenteId: 'ed-asig',
        cursoId: 'c-kinder',
        asignatura: 'Atención Directa Parvularia (BCEP Integral)',
        horasPedagogicasAula: 10,
        periodo: 2027
      }
    ];

    const integral = auditarCargaDocenteIntegral(
      educadoraPorAsignatura,
      asigParcial,
      [],
      new Map([[cursoKinder.id, cursoKinder]]),
      40
    );

    expect(integral.isEducadoraParvulo).toBe(true);
    expect(integral.haDocenciaEfectiva).toBe(10);
    expect(integral.maxHAPermitidas).toBe(28.5);
  });

  it('calcularEstadoCursosParvularios considera cursosCompartidosIds y excluye apoyos PIE/SEP en permanencia DTO 306', () => {
    const educadora = crearDocenteFixture({
      id: 'ed-comp',
      estamento: 'DOCENTE_AULA',
      asignaturaPrincipal: 'Educación Parvularia',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44
    });
    const diferencialPie = crearDocenteFixture({
      id: 'dif-pie',
      estamento: 'DOCENTE_DIFERENCIAL',
      asignaturaPrincipal: 'Educación Diferencial',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 0,
      horasPieTitular: 30
    });

    const preKinder = crearCursoFixture({
      id: 'c-pk',
      nivel: 'Pre-Kínder',
      letra: 'A',
      regimenJornada: 'SIN_JEC',
      regimen: 'SIN_JEC',
      esCombinado: true
    });
    const kinder = crearCursoFixture({
      id: 'c-k',
      nivel: 'Kínder',
      letra: 'A',
      regimenJornada: 'SIN_JEC',
      regimen: 'SIN_JEC',
      esCombinado: true
    });

    const asigs: AsignacionHoraria[] = [
      {
        id: 'asig-pk-k',
        rbd: '4100',
        docenteId: 'ed-comp',
        cursoId: 'c-pk',
        cursosCompartidosIds: ['c-k'],
        asignatura: 'Atención Directa Parvularia (BCEP Integral)',
        horasPedagogicasAula: 22.5,
        periodo: 2027
      },
      {
        id: 'asig-pie-k',
        rbd: '4100',
        docenteId: 'dif-pie',
        cursoId: 'c-k',
        asignatura: 'Apoyo PIE Aula Común',
        horasPedagogicasAula: 8,
        horasCronologicasPie: 8,
        tipoApoyo: 'PIE_AULA_COMUN',
        periodo: 2027
      }
    ];

    const estado = calcularEstadoCursosParvularios([preKinder, kinder], [educadora, diferencialPie], asigs, 40);
    expect(estado.get('c-pk')?.resultado.coberturaCompletaPermanencia).toBe(true);
    expect(estado.get('c-k')?.resultado.coberturaCompletaPermanencia).toBe(true);
    // El apoyo PIE de 8h no debe inflar las horas cubiertas DTO 306 de Kínder
    expect(estado.get('c-k')?.resultado.minutosCubiertosTotales).toBe(22.5 * 60);
  });
});
