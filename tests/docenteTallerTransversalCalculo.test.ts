import { describe, it, expect } from 'vitest';
import { calcularDiagnosticoColegio, obtenerDocentesConsolidadosTerritorio } from '../src/services/dotacionCalculationService';
import { Establecimiento, Docente, CursoSae, AsignacionHoraria } from '../src/types';

describe('Cálculo de Proporción Ley 20.903 para Talleres Transversales y Talleres SEP de Aula', () => {
  const colegioMock: Establecimiento = {
    rbd: '12345',
    nombre: 'Escuela Prueba Taller Transversal',
    comuna: 'San Ignacio',
    dependencia: 'SLEP',
    director: 'Director Prueba',
    regimen: 'JEC',
    porcentajePrioritarios: 70 // Régimen 65/35
  };

  const cursosMock: CursoSae[] = [
    { id: 'c4a', rbd: '12345', periodo: 2026, nivel: '4° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' }
  ];

  // Caso Laura Soledad de la Hoz Cárdenas
  // RUT 13.130.331-9, DOCENTE AULA CONTRATA 32 hrs
  // 22 HA Codocencia en 4° Básico A
  // 6 HA Docente de Refuerzo Educativo PME (Taller Transversal Sin Curso)
  // Total Aula: 28 HA -> En 65/35 requiere exactamente 32 hrs de contrato
  const docenteLaura: Docente = {
    id: 'doc-laura-hoz',
    rbd: '12345',
    periodo: 2026,
    run: '13.130.331-9',
    nombres: 'Laura Soledad',
    apellidos: 'De La Hoz Cardenas',
    estamento: 'DOCENTE_AULA',
    calidadJuridica: 'CONTRATA',
    horasContrato: 32,
    horasSubvencionGeneralContrata: 0,
    horasSepContrata: 32
  };

  const asignacionesLaura: AsignacionHoraria[] = [
    {
      id: 'asig-codoc-4a',
      rbd: '12345',
      periodo: 2026,
      cursoId: 'c4a',
      docenteId: 'doc-laura-hoz',
      asignatura: 'Codocencia',
      horasPedagogicasAula: 22,
      esCoDocencia: true,
      tipoApoyo: 'CO_DOCENCIA'
    },
    {
      id: 'asig-taller-pme',
      rbd: '12345',
      periodo: 2026,
      cursoId: 'TRANSVERSAL',
      docenteId: 'doc-laura-hoz',
      asignatura: 'Docente de Refuerzo Educativo PME',
      horasPedagogicasAula: 6,
      esTallerSep: true,
      tipoApoyo: 'TALLER_SEP'
    }
  ];

  it('calcula correctamente la auditoría multitramo asignando 28 HA a 65/35 y contrato de 32h exactas', () => {
    const consolidado = obtenerDocentesConsolidadosTerritorio(
      [colegioMock],
      [docenteLaura],
      asignacionesLaura,
      cursosMock
    );

    const contrato = consolidado[0]?.contratos[0];
    expect(contrato).toBeDefined();
    if (!contrato) return;

    // 1. Horas de aula regular 65/35 deben sumar 28 HA (22 HA Codoc + 6 HA Taller PME)
    expect(contrato.horasAula65_35).toBe(28);
    expect(contrato.horasAula60_40).toBe(0);

    // 2. Horas SEP/PIE exentas cronológicas deben ser 0 (el taller tiene proporción de aula)
    expect(contrato.horasTallerSepExento).toBe(0);
    expect(contrato.horasPieCronologicas).toBe(0);

    // 3. Contrato Calculado debe ser exactamente 32 hrs
    expect(contrato.contratoCalculadoTotal).toBe(32);
    expect(contrato.saldoHoras).toBe(0);
    expect(contrato.estadoSaldo).toBe('EXACTO');

    // 4. Minutos y proporción Ley 20.903 para 28 HA
    expect(contrato.minutosLectivosMineduc).toBe(28 * 45); // 1.260 min (21h 00m)
    expect(contrato.minutosRecreoMineduc).toBe(131); // 2h 11m
    expect(contrato.minutosNoLectivosMineduc).toBe(529); // 8h 49m HNL
    expect(contrato.minutosHnlPlanificacion40).toBe(212); // 3h 32m (40% de 529 min)

    // 5. Sin infracción de exceso lectivo
    expect(contrato.esInfractorExcesoLectivo).toBe(false);
  });

  it('computa la demanda global del colegio incluyendo el plan de curso y el taller transversal', () => {
    const diag = calcularDiagnosticoColegio(
      colegioMock,
      [],
      cursosMock,
      [docenteLaura],
      asignacionesLaura
    );

    // Demanda global del colegio: 38 HA del plan de estudio de 4° Básico + 6 HA del taller transversal = 44 HA
    expect(diag.balanzaGeneral.horasAulaDemandadasCurriculo).toBe(44);
    expect(diag.estadoDocentes[0].horasPedagogicasAsignadas).toBe(28);
  });
});
