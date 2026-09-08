import { describe, it, expect } from 'vitest';
import { obtenerDocentesConsolidadosTerritorio } from '../src/services/dotacionCalculationService';
import type { Establecimiento, Docente, AsignacionHoraria } from '../src/types';

describe('Consolidación Territorial de Docentes Multi-Contrato y Financiamiento', () => {
  const colegioA: Establecimiento = {
    id: 'est-1',
    rbd: '3451',
    nombre: 'Liceo Manuel Bulnes',
    comuna: 'Bulnes',
    regimen: 'JEC',
    porcentajePrioritarios: 82.5 // Régimen 60/40
  };

  const colegioB: Establecimiento = {
    id: 'est-2',
    rbd: '3480',
    nombre: 'Colegio Quilamapu',
    comuna: 'Chillán Viejo',
    regimen: 'JEC',
    porcentajePrioritarios: 65.0 // Régimen 65/35
  };

  it('debe consolidar a un docente compartido entre 2 escuelas con régimen mixto y validar que 30h + 14h = 44h no infringe límite', () => {
    const docentes: Docente[] = [
      {
        id: 'doc-1',
        rbd: '3451',
        run: '13.345.678-2',
        nombres: 'Mónica',
        apellidos: 'Reyes Troncoso',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_AULA',
        horasContrato: 30,
        horasSubvencionGeneralContrata: 20,
        horasSepContrata: 10
      },
      {
        id: 'doc-2',
        rbd: '3480',
        run: '13.345.678-2',
        nombres: 'Mónica',
        apellidos: 'Reyes Troncoso',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_AULA',
        horasContrato: 14,
        horasSubvencionGeneralContrata: 14
      }
    ];

    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-1',
        rbd: '3451',
        cursoId: 'curso-1',
        docenteId: 'doc-1',
        asignatura: 'Inglés',
        horasPedagogicasAula: 12
      },
      {
        id: 'asig-2',
        rbd: '3480',
        cursoId: 'curso-2',
        docenteId: 'doc-2',
        asignatura: 'Inglés',
        horasPedagogicasAula: 8
      }
    ];

    const consolidados = obtenerDocentesConsolidadosTerritorio([colegioA, colegioB], docentes, asignaciones);

    expect(consolidados.length).toBe(1);
    const monica = consolidados[0];
    expect(monica.run).toBe('13.345.678-2');
    expect(monica.horasTotalesSlep).toBe(44);
    expect(monica.excedeLimiteSlep).toBe(false);
    expect(monica.excesoHorasSlep).toBe(0);
    expect(monica.contratos.length).toBe(2);

    // Contrato 1: Colegio A (Bulnes) bajo régimen 60/40
    const contratoA = monica.contratos.find(c => c.colegio.rbd === '3451');
    expect(contratoA).toBeDefined();
    expect(contratoA?.regimen).toBe('60/40');
    expect(contratoA?.horasPedagogicasAsignadas).toBe(12);
    expect(contratoA?.fuentesFinanciamiento.subvencionGeneralContrata).toBe(20);
    expect(contratoA?.fuentesFinanciamiento.sepContrata).toBe(10);

    // Contrato 2: Colegio B (Quilamapu) bajo régimen 65/35
    const contratoB = monica.contratos.find(c => c.colegio.rbd === '3480');
    expect(contratoB).toBeDefined();
    expect(contratoB?.regimen).toBe('65/35');
    expect(contratoB?.horasPedagogicasAsignadas).toBe(8);
    expect(contratoB?.fuentesFinanciamiento.subvencionGeneralContrata).toBe(14);

    // Resumen de financiamiento total
    expect(monica.resumenFinanciamiento.subvencionGeneral).toBe(34);
    expect(monica.resumenFinanciamiento.sep).toBe(10);
    expect(monica.resumenFinanciamiento.total).toBe(44);
  });

  it('debe detectar sobrecarga ilegal cuando la suma de horas en el SLEP supera las 44 hrs', () => {
    const docentes: Docente[] = [
      {
        id: 'doc-1',
        rbd: '3451',
        run: '9.876.543-1',
        nombres: 'Pedro',
        apellidos: 'Soto Valdés',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 30,
        horasSubvencionGeneralTitular: 30
      },
      {
        id: 'doc-2',
        rbd: '3480',
        run: '9.876.543-1',
        nombres: 'Pedro',
        apellidos: 'Soto Valdés',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_AULA',
        horasContrato: 18, // 30 + 18 = 48 hrs (>44h)
        horasSubvencionGeneralContrata: 18
      }
    ];

    const consolidados = obtenerDocentesConsolidadosTerritorio([colegioA, colegioB], docentes, []);
    expect(consolidados.length).toBe(1);
    const pedro = consolidados[0];
    expect(pedro.horasTotalesSlep).toBe(48);
    expect(pedro.excedeLimiteSlep).toBe(true);
    expect(pedro.excesoHorasSlep).toBe(4);
  });

  it('debe separar horas de Inspectoría General y Coordinaciones UTP, y eximir del cálculo de proporción a directivos/técnicos 100% no aula', () => {
    const docentes: Docente[] = [
      {
        id: 'doc-dir',
        rbd: '3451',
        run: '10.111.222-3',
        nombres: 'Carlos',
        apellidos: 'Inspector Directivo',
        calidadJuridica: 'TITULAR',
        estamento: 'DIRECTIVO',
        horasContrato: 44,
        horasDirectivas: 22, // Dirección
        horasInspectorGeneral: 22, // Inspectoría General (separado de UTP)
        horasSubvencionGeneralTitular: 44
      },
      {
        id: 'doc-utp',
        rbd: '3451',
        run: '11.222.333-4',
        nombres: 'María',
        apellidos: 'Jefa UTP y CRA',
        calidadJuridica: 'TITULAR',
        estamento: 'TECNICO_PEDAGOGICO',
        horasContrato: 44,
        horasTecnicoPedagogicas: 30, // Jefatura UTP
        horasCoordinacion: 14, // Coordinaciones UTP (CRA)
        tipoCoordinacion: 'CRA',
        horasSubvencionGeneralTitular: 44
      },
      {
        id: 'doc-mixto',
        rbd: '3451',
        run: '12.333.444-5',
        nombres: 'Andrés',
        apellidos: 'Docente y Coordinador TIC',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_AULA',
        horasContrato: 44,
        horasCoordinacion: 14, // Coordinación Enlaces UTP
        tipoCoordinacion: 'ENLACES',
        horasSubvencionGeneralContrata: 44
      }
    ];

    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-mixto',
        rbd: '3451',
        cursoId: 'c-1',
        docenteId: 'doc-mixto',
        asignatura: 'Tecnología',
        horasPedagogicasAula: 15
      }
    ];

    const consolidados = obtenerDocentesConsolidadosTerritorio([colegioA], docentes, asignaciones);
    expect(consolidados.length).toBe(3);

    // 1. Docente 100% Directivo (Dirección 22h + Inspector General 22h = 44h)
    const carlos = consolidados.find(c => c.run === '10.111.222-3');
    expect(carlos).toBeDefined();
    const contratoCarlos = carlos?.contratos[0];
    expect(contratoCarlos?.horasDirectivas).toBe(22);
    expect(contratoCarlos?.horasInspectorGeneral).toBe(22);
    expect(contratoCarlos?.horasDocenciaNeta).toBe(0);
    expect(contratoCarlos?.esExentoProporcion).toBe(true);
    expect(contratoCarlos?.maxHorasPedagogicasMineduc).toBe(0); // Exento, no tiene horas aula
    expect(contratoCarlos?.estaSobreasignado).toBe(false);

    // 2. Docente 100% UTP/Coordinación (Jefatura UTP 30h + Coordinación CRA 14h = 44h)
    const maria = consolidados.find(c => c.run === '11.222.333-4');
    expect(maria).toBeDefined();
    const contratoMaria = maria?.contratos[0];
    expect(contratoMaria?.horasTecnicoPedagogicas).toBe(30);
    expect(contratoMaria?.horasCoordinacion).toBe(14);
    expect(contratoMaria?.horasDocenciaNeta).toBe(0);
    expect(contratoMaria?.esExentoProporcion).toBe(true);
    expect(contratoMaria?.maxHorasPedagogicasMineduc).toBe(0);
    expect(contratoMaria?.estaSobreasignado).toBe(false);

    // 3. Docente Mixto (44h contrato - 14h Coordinación = 30h Docencia Neta disponible)
    const andres = consolidados.find(c => c.run === '12.333.444-5');
    expect(andres).toBeDefined();
    const contratoAndres = andres?.contratos[0];
    expect(contratoAndres?.horasCoordinacion).toBe(14);
    expect(contratoAndres?.horasDocenciaNeta).toBe(30);
    expect(contratoAndres?.esExentoProporcion).toBe(false);
    // Para 30h en 60/40: cálculo de jornada sobre 30h
    expect(contratoAndres?.maxHorasPedagogicasMineduc).toBeGreaterThan(0);
    expect(contratoAndres?.horasPedagogicasAsignadas).toBe(15);
  });
});
