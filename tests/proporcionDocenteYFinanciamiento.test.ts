import { describe, it, expect } from 'vitest';
import { calcularDiagnosticoColegio, obtenerDocentesConsolidadosTerritorio } from '../src/services/dotacionCalculationService';
import type { Establecimiento, CursoSae, Docente, AsignacionHoraria, SalaInfraestructura } from '../src/types';

describe('Exención Ley 20.903 (Taller SEP / Trabajo Colaborativo), Co-Docencia y 7 Métricas de Financiamiento', () => {
  const colegio: Establecimiento = {
    id: 'est-101',
    rbd: '9999',
    nombre: 'Escuela Rural El Roble',
    comuna: 'San Ignacio',
    regimen: 'JEC',
    porcentajePrioritarios: 75 // Régimen 65/35
  };

  const salas: SalaInfraestructura[] = [
    { id: 'sala-1', rbd: '9999', nombreSala: 'Sala 101', superficieM2: 50, cupoNormativoMineduc: 40 }
  ];

  const cursos: CursoSae[] = [
    {
      id: 'curso-5b',
      rbd: '9999',
      nivel: '5° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 5,
      alumnosNeep: 2,
      regimenProporcion: '65_35'
    }
  ];

  it('debe eximir de la proporción Ley 20.903 las horas de Taller SEP y Trabajo Colaborativo', () => {
    // Docente de 44 hrs:
    // 4h Directivas, 2h Coordinación, 4h Taller SEP, 2h Trabajo Colaborativo
    // Horas netas afectas para docencia de aula: 44 - 12 = 32 hrs.
    // Según tabla 65/35 para 32 hrs: max lectivo = floor(32 * 60 * 0.65 / 45) = 27 HA.
    const docentes: Docente[] = [
      {
        id: 'doc-exento',
        rbd: '9999',
        run: '11.222.333-4',
        nombres: 'Carlos',
        apellidos: 'Valenzuela',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 44,
        horasSubvencionGeneralTitular: 32,
        horasSepTitular: 8,
        horasPieTitular: 4,
        horasDirectivas: 4,
        horasCoordinacion: 2,
        horasTallerSep: 4,
        horasTrabajoColaborativo: 2
      }
    ];

    // Asignaciones del docente:
    // 25 HA en Matemática (Aula Regular)
    // 4 HA en Taller SEP
    // 2 HA en Trabajo Colaborativo Art. 86
    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-mat',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-exento',
        asignatura: 'Matemática',
        horasPedagogicasAula: 25
      },
      {
        id: 'asig-sep',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-exento',
        asignatura: 'Taller de Refuerzo SEP',
        horasPedagogicasAula: 4,
        esTallerSep: true
      },
      {
        id: 'asig-colab',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-exento',
        asignatura: 'Trabajo Colaborativo Art. 86',
        horasPedagogicasAula: 2,
        esTrabajoColaborativo: true,
        tipoApoyo: 'TRABAJO_COLABORATIVO'
      }
    ];

    const diagnostico = calcularDiagnosticoColegio(colegio, salas, cursos, docentes, asignaciones);
    const estadoDoc = diagnostico.estadoDocentes[0];

    // Solo las 25 HA regulares se comparan contra las horas de docencia afectas (32 hrs -> máx 27 HA)
    expect(estadoDoc.horasAulaRegular).toBe(25);
    expect(estadoDoc.horasTallerSep).toBe(4);
    expect(estadoDoc.horasTrabajoColaborativo).toBe(2);
    expect(estadoDoc.horasDocenciaAfecta).toBe(32);
    expect(estadoDoc.horasExentas).toBe(12);
    expect(estadoDoc.estaSobreasignado).toBe(false);
    expect(estadoDoc.horasVacantes).toBeGreaterThanOrEqual(0);
  });

  it('la co-docencia no debe inflar la demanda horaria del plan de estudio del curso', () => {
    const docentes: Docente[] = [
      {
        id: 'doc-titular',
        rbd: '9999',
        run: '12.345.678-9',
        nombres: 'Ana',
        apellidos: 'Gómez',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 44,
        horasSubvencionGeneralTitular: 44
      },
      {
        id: 'doc-pie',
        rbd: '9999',
        run: '15.678.901-2',
        nombres: 'Beatriz',
        apellidos: 'Muñoz',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_DIFERENCIAL',
        horasContrato: 30,
        horasPieContrata: 30
      }
    ];

    // Curso 5° Básico JEC: Demanda oficial MINEDUC = 38 HA
    // Ana imparte 38 HA regulares
    // Beatriz realiza Co-Docencia de 8 HA en el mismo curso
    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-ana',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-titular',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 38
      },
      {
        id: 'asig-codoc',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-pie',
        asignatura: 'Apoyo PIE - Co-docencia Aula Común',
        horasPedagogicasAula: 8,
        esCoDocencia: true,
        tipoApoyo: 'Co-Docencia en Aula Regular'
      }
    ];

    const diagnostico = calcularDiagnosticoColegio(colegio, salas, cursos, docentes, asignaciones);

    // La demanda curricular del colegio debe seguir siendo exactamente 38 HA
    expect(diagnostico.balanzaGeneral.horasAulaDemandadasCurriculo).toBe(38);
    // Las horas lectivas asignadas de aula regular deben ser 38 HA (co-docencia NO suma a la cobertura curricular)
    expect(diagnostico.balanzaGeneral.horasLectivasAsignadas).toBe(38);
    expect(diagnostico.balanzaGeneral.horasLectivasAsignadas).toBe(diagnostico.balanzaGeneral.horasAulaDemandadasCurriculo);
  });

  it('debe calcular con precisión las 7 métricas de financiamiento por docente y consolidado territorial', () => {
    const docentes: Docente[] = [
      {
        id: 'doc-multi-fuente',
        rbd: '9999',
        run: '14.555.666-7',
        nombres: 'Rodrigo',
        apellidos: 'Pérez',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 44,
        horasSubvencionGeneralTitular: 20,
        horasSubvencionGeneralContrata: 6,
        horasSepTitular: 8,
        horasSepContrata: 2,
        horasPieTitular: 6,
        horasPieContrata: 2
      }
    ];

    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], docentes, []);
    expect(consolidado.length).toBe(1);

    const resFin = consolidado[0].resumenFinanciamiento;
    // Las 7 métricas obligatorias:
    expect(resFin.total).toBe(44); // 1. Total Contrato
    expect(resFin.subvencionGeneralTitular).toBe(20); // 2. Subv General Titular
    expect(resFin.subvencionGeneralContrata).toBe(6); // 3. Subv General Contrata
    expect(resFin.sepTitular).toBe(8); // 4. SEP Titular
    expect(resFin.sepContrata).toBe(2); // 5. SEP Contrata
    expect(resFin.pieTitular).toBe(6); // 6. PIE Titular
    expect(resFin.pieContrata).toBe(2); // 7. PIE Contrata

    // Comprobación de integridad de suma
    const suma7 = resFin.subvencionGeneralTitular + resFin.subvencionGeneralContrata +
                 resFin.sepTitular + resFin.sepContrata +
                 resFin.pieTitular + resFin.pieContrata;
    expect(suma7).toBe(resFin.total);
  });

  it('detecta alerta de improcedencia cuando el Plan de Estudio o JEC se financia indebidamente con SEP o PIE', () => {
    // Docente con 40h de contrato: 20h Subvención General + 20h SEP
    // Asignado a 30 HA de Plan de Estudio / JEC (requiere 35h de Subvención General en 65/35)
    const docentes: Docente[] = [
      {
        id: 'doc-alerta-fin',
        rbd: '9999',
        run: '15.999.888-1',
        nombres: 'Marcos',
        apellidos: 'Soto',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 40,
        horasSubvencionGeneralTitular: 20,
        horasSubvencionGeneralContrata: 0,
        horasSepTitular: 20,
        horasSepContrata: 0,
        horasPieTitular: 0,
        horasPieContrata: 0
      }
    ];

    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig-plan-1',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-alerta-fin',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 30
      }
    ];

    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], docentes, asignaciones);
    const contrato = consolidado[0].contratos[0];

    // 30 HA de plan curricular exigen 35h de Subvención General
    expect(contrato.horasAulaPlanEstudioYJec).toBe(30);
    expect(contrato.contratoReqSubvencionGeneral).toBe(35);
    expect(contrato.subvencionGeneralContratoTotal).toBe(20);
    expect(contrato.deficitSubvencionGeneral).toBe(15); // 35 - 20 = 15h déficit
    expect(contrato.esImprocedenteFinanciamientoSepPie).toBe(true);
    expect(contrato.alertaFinanciamientoSepPie).toContain('Improcedencia Financiera');
  });
});
