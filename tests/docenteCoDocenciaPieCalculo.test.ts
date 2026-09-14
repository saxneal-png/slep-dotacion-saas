import { describe, it, expect } from 'vitest';
import { calcularDiagnosticoColegio, obtenerDocentesConsolidadosTerritorio } from '../src/services/dotacionCalculationService';
import { Establecimiento, Docente, CursoSae, AsignacionHoraria } from '../src/types';

describe('Cálculo de Carga Horaria para Docente de Aula con Co-Docencia / Apoyo PIE', () => {
  const colegioMock: Establecimiento = {
    rbd: '12345',
    nombre: 'Escuela Prueba Co-Docencia',
    comuna: 'San Ignacio',
    dependencia: 'SLEP',
    director: 'Director Prueba',
    regimen: 'JEC',
    porcentajePrioritarios: 70 // Régimen 65/35
  };

  const cursosMock: CursoSae[] = [
    { id: 'c1', rbd: '12345', periodo: 2026, nivel: '1° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' },
    { id: 'c2', rbd: '12345', periodo: 2026, nivel: '2° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' },
    { id: 'c3', rbd: '12345', periodo: 2026, nivel: '3° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' },
    { id: 'c4', rbd: '12345', periodo: 2026, nivel: '4° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' },
    { id: 'c5', rbd: '12345', periodo: 2026, nivel: '5° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' },
    { id: 'c6', rbd: '12345', periodo: 2026, nivel: '6° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' },
    { id: 'c7', rbd: '12345', periodo: 2026, nivel: '7° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' },
    { id: 'c8', rbd: '12345', periodo: 2026, nivel: '8° Básico', letra: 'A', regimen: 'JEC', cupoSae: 35, matriculaProyectada: 30, regimenProporcion: '65_35' }
  ];

  const docenteLeyla: Docente = {
    id: 'doc-leyla',
    rbd: '12345',
    periodo: 2026,
    run: '13.377.908-6',
    nombres: 'Leyla Georgina',
    apellidos: 'Saldias Salamanca',
    estamento: 'DOCENTE_AULA',
    calidadJuridica: 'TITULAR',
    horasContrato: 40,
    horasSubvencionGeneralTitular: 40,
    funcionesNoAula: [
      { id: 'f1', nombre: 'Coordinación Pedagógica', horas: 1, tipo: 'COORDINACION_PEDAGOGICA', financiamiento: 'SUBVENCION_GENERAL' }
    ]
  };

  const asignacionesLeyla: AsignacionHoraria[] = [
    // 20 HA de Inglés (1° a 4°: 2h c/u = 8h; 5° a 8°: 3h c/u = 12h)
    { id: 'a1', rbd: '12345', periodo: 2026, cursoId: 'c1', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 2 },
    { id: 'a2', rbd: '12345', periodo: 2026, cursoId: 'c2', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 2 },
    { id: 'a3', rbd: '12345', periodo: 2026, cursoId: 'c3', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 2 },
    { id: 'a4', rbd: '12345', periodo: 2026, cursoId: 'c4', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 2 },
    { id: 'a5', rbd: '12345', periodo: 2026, cursoId: 'c5', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 3 },
    { id: 'a6', rbd: '12345', periodo: 2026, cursoId: 'c6', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 3 },
    { id: 'a7', rbd: '12345', periodo: 2026, cursoId: 'c7', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 3 },
    { id: 'a8', rbd: '12345', periodo: 2026, cursoId: 'c8', docenteId: 'doc-leyla', asignatura: 'Inglés', horasPedagogicasAula: 3 },
    // 4 HA de Artes Visuales
    { id: 'a9', rbd: '12345', periodo: 2026, cursoId: 'c3', docenteId: 'doc-leyla', asignatura: 'Artes Visuales', horasPedagogicasAula: 2 },
    { id: 'a10', rbd: '12345', periodo: 2026, cursoId: 'c4', docenteId: 'doc-leyla', asignatura: 'Artes Visuales', horasPedagogicasAula: 2 },
    // 11 hrs cronológicas de Apoyo PIE - Co-docencia Aula Regular en 2° Básico A
    {
      id: 'a11',
      rbd: '12345',
      periodo: 2026,
      cursoId: 'c2',
      docenteId: 'doc-leyla',
      asignatura: 'Apoyo PIE - Co-docencia Aula Regular',
      horasPedagogicasAula: 15,
      horasCronologicasPie: 11,
      esCoDocencia: true,
      tipoApoyo: 'Co-Docencia en Aula Regular'
    }
  ];

  it('calcula correctamente la auditoría completa sin inflar el aula 65/35 con el apoyo PIE', () => {
    const consolidado = obtenerDocentesConsolidadosTerritorio(
      [colegioMock],
      [docenteLeyla],
      asignacionesLeyla,
      cursosMock
    );

    const docContrato = consolidado[0]?.contratos[0];
    expect(docContrato).toBeDefined();
    if (!docContrato) return;

    // 1. Horas de aula regular deben ser exactamente 24 HA (20 HA Inglés + 4 HA Artes)
    expect(docContrato.horasAula65_35).toBe(24);
    expect(docContrato.horasAula60_40).toBe(0);

    // 2. Horas PIE deben ser 11 hrs cronológicas
    expect(docContrato.horasPieCronologicas).toBe(11);

    // 3. Contrato calculado debe ser 40h (28h para 24 HA + 1h no aula + 11h PIE)
    expect(docContrato.contratoCalculadoTotal).toBe(40);
    expect(docContrato.saldoHoras).toBe(0);
    expect(docContrato.estadoSaldo).toBe('EXACTO');

    // 4. No debe marcar infracción de exceso lectivo (24 HA en 28h docencia neta = 64.3% <= 65.4% legal)
    expect(docContrato.esInfractorExcesoLectivo).toBe(false);
    expect(docContrato.porcentajeLectivoReal).toBe(64.3);
  });

  it('calcula el diagnóstico del colegio contabilizando exactamente las 24 HA de aula lectiva', () => {
    const diagnostico = calcularDiagnosticoColegio(
      colegioMock,
      [],
      cursosMock,
      [docenteLeyla],
      asignacionesLeyla
    );

    expect(diagnostico.balanzaGeneral.horasLectivasAsignadas).toBe(24);
  });
});
