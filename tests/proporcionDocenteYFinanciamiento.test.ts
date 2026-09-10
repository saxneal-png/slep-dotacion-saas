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

  it('debe registrar y calcular correctamente múltiples funciones no aula con distintas fuentes de financiamiento', () => {
    const docMultiFunc: Docente = {
      id: 'doc-multi-func',
      rbd: '9999',
      run: '16.111.222-3',
      nombres: 'Francisca',
      apellidos: 'Reyes',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 34,
      horasSepTitular: 6,
      horasPieTitular: 4,
      funcionesNoAula: [
        {
          id: 'f-1',
          tipo: 'UTP',
          nombre: 'Jefa de UTP',
          horas: 10,
          financiamiento: 'SUBVENCION_GENERAL'
        },
        {
          id: 'f-2',
          tipo: 'CONVIVENCIA',
          nombre: 'Encargada Convivencia SEP',
          horas: 6,
          financiamiento: 'SEP'
        },
        {
          id: 'f-3',
          tipo: 'COORDINACION',
          nombre: 'Coordinación PIE',
          horas: 4,
          financiamiento: 'PIE'
        }
      ]
    };

    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], [docMultiFunc], []);
    const contrato = consolidado[0].contratos[0];

    expect(contrato.funcionesNoAula?.length).toBe(3);
    expect(contrato.funcionesNoAula?.[0].financiamiento).toBe('SUBVENCION_GENERAL');
    expect(contrato.funcionesNoAula?.[1].financiamiento).toBe('SEP');
    expect(contrato.funcionesNoAula?.[2].financiamiento).toBe('PIE');

    // Total de horas no aula: 10 + 6 + 4 = 20 hrs.
    // Horas netas de docencia afectas: 44 - 20 = 24 hrs.
    expect(contrato.horasDocenciaNeta).toBe(24);
  });

  it('calcula la proporción docente (65/35 y 60/40) para horas de co-docencia bajo el Estatuto Docente', () => {
    // Docente de Educación Diferencial (PIE):
    // 24 HA de Co-Docencia en curso 65/35 (según tabla oficial 65/35, 24 HA exige 28h de contrato)
    // 3h de Trabajo Colaborativo (Art. 86 no aula)
    // 1h de Coordinación PIE (no aula)
    // Total contrato requerido = 28h + 4h = 32h
    const docPie: Docente = {
      id: 'doc-pie-proporcion',
      rbd: '9999',
      run: '19.876.543-2',
      nombres: 'Camila',
      apellidos: 'Herrera',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 32,
      horasPieContrata: 32,
      horasTrabajoColaborativo: 3,
      horasCoordinacionPie: 1
    };

    const asigsPie: AsignacionHoraria[] = [
      {
        id: 'asig-codoc-1',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-pie-proporcion',
        asignatura: 'Co-docencia Lenguaje',
        horasPedagogicasAula: 24,
        esCoDocencia: true,
        tipoApoyo: 'CO_DOCENCIA'
      },
      {
        id: 'asig-colab-1',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-pie-proporcion',
        asignatura: 'Trabajo Colaborativo Art. 86',
        horasPedagogicasAula: 3,
        esTrabajoColaborativo: true,
        tipoApoyo: 'TRABAJO_COLABORATIVO'
      }
    ];

    // 24 HA en 65/35 exige 28h de contrato + 4h no aula = 32h de contrato total requerido
    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], [docPie], asigsPie, cursos);
    const contrato = consolidado[0].contratos[0];

    expect(contrato.horasCoDocencia).toBe(24);
    expect(contrato.horasAula65_35).toBe(24);
    expect(contrato.horasTrabajoColaborativo).toBe(4); // 3h colab + 1h coord
    expect(contrato.contratoCalculadoTotal).toBe(32);
    expect(contrato.saldoHoras).toBe(0);
    expect(contrato.estadoSaldo).toBe('EXACTO');
    expect(contrato.esInfractorExcesoLectivo).toBe(false);
  });

  it('audita caso real de Docente PIE con 39h contrata (11 HA apoyo aula + 28h Coordinadora PIE): calcula proporción de aula y horas no aula', () => {
    // Caso de usuario:
    // Docente diferencial con contrato de 39h PIE contrata (0 Subv. Gen, 0 SEP)
    // 11 HA de apoyo en aula (co-docencia PIE en 65/35 -> exige 14h de contrato)
    // 28h como Coordinadora PIE de primer ciclo (registrada en funcionesNoAula con financiamiento PIE)
    // Carga total calculada = 14h + 28h = 42h
    const docPie39: Docente = {
      id: 'doc-pie-39',
      rbd: '9999',
      run: '17.888.999-0',
      nombres: 'Claudia',
      apellidos: 'Morales',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 41,
      horasPieContrata: 41,
      funcionesNoAula: [
        {
          id: 'func-coord-pie',
          tipo: 'COORDINACION_PIE',
          nombre: 'Coordinadora PIE de primer Ciclo',
          horas: 28,
          financiamiento: 'PIE'
        }
      ]
    };

    const asigPie11: AsignacionHoraria[] = [
      {
        id: 'asig-pie-11',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-pie-39',
        asignatura: 'Apoyo Especializado PIE Matemática',
        horasPedagogicasAula: 11,
        esCoDocencia: true,
        tipoApoyo: 'CO_DOCENCIA'
      }
    ];

    // 1. Diagnóstico del colegio
    const diag = calcularDiagnosticoColegio(colegio, salas, cursos, [docPie39], asigPie11);
    const estDoc = diag.estadoDocentes[0];

    expect(estDoc.horasAulaRegular).toBe(0); // Co-docencia no es titular plan de estudio
    expect(estDoc.horasCoDocencia).toBe(11);
    expect(estDoc.horasExentas).toBe(28); // 28h coord PIE no aula
    expect(estDoc.horasDocenciaAfecta).toBe(13); // 41h contrato - 28h no aula = 13h para docencia de aula
    expect(estDoc.estaSobreasignado).toBe(false);

    // 2. Consolidado territorial multitramo
    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], [docPie39], asigPie11, cursos);
    const contrato = consolidado[0].contratos[0];

    // 11 HA en 65/35 exige 13h de contrato + 28h no aula = 41h total
    expect(contrato.contratoCalculadoTotal).toBe(41);
    expect(contrato.fuentesFinanciamiento.total).toBe(41);
    expect(contrato.saldoHoras).toBe(0);
    expect(contrato.estadoSaldo).toBe('EXACTO');
    expect(contrato.esInfractorExcesoLectivo).toBe(false);
  });

  it('audita caso de Docente con Co-Docencia SEP (calcula proporción lectiva docente sobre horas aula)', () => {
    const colegioVulnerable: Establecimiento = {
      ...colegio,
      porcentajePrioritarios: 85 // Escuela vulnerable (>80% prioritarios, régimen 60/40)
    };

    const cursosVuln: CursoSae[] = [
      {
        id: 'curso-5b-vuln',
        rbd: '9999',
        nivel: '5° Básico',
        letra: 'A',
        regimen: 'JEC',
        cupoSae: 35,
        matriculaProyectada: 30,
        regimenProporcion: '60_40'
      }
    ];

    // Marianela: 35h de contrato (3h Subv. Gral + 32h SEP)
    // 4 HA de talleres en aula + 24 HA de co-docencia SEP en aula = 28 HA totales de aula
    // En 60/40: 28 HA exige exactamente 35h de contrato (21h aula + 11h 40m HNL + 2h 20m recreo = 35h)
    const docMarianela: Docente = {
      id: 'doc-marianela',
      rbd: '9999',
      run: '12.345.678-9',
      nombres: 'Marianela',
      apellidos: 'Ortiz Ortiz Castro',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 35,
      horasSubvencionGeneralContrata: 3,
      horasSepContrata: 32
    };

    const asigsMarianela: AsignacionHoraria[] = [
      {
        id: 'asig-aele',
        rbd: '9999',
        cursoId: 'curso-5b-vuln',
        docenteId: 'doc-marianela',
        asignatura: 'Taller AELE',
        horasPedagogicasAula: 2,
        esTallerJec: true
      },
      {
        id: 'asig-extension',
        rbd: '9999',
        cursoId: 'curso-5b-vuln',
        docenteId: 'doc-marianela',
        asignatura: 'Taller Extensión Horaria',
        horasPedagogicasAula: 2
      },
      {
        id: 'asig-codoc-sep',
        rbd: '9999',
        cursoId: 'curso-5b-vuln',
        docenteId: 'doc-marianela',
        asignatura: 'Co-docencia SEP',
        horasPedagogicasAula: 24,
        esCoDocencia: true,
        tipoApoyo: 'CO_DOCENCIA'
      }
    ];

    const consolidado = obtenerDocentesConsolidadosTerritorio([colegioVulnerable], [docMarianela], asigsMarianela, cursosVuln);
    const contrato = consolidado[0].contratos[0];

    expect(contrato.horasAula60_40).toBe(4); // 4 HA talleres regular/JEC
    expect(contrato.horasTallerSep).toBe(24); // 24 hrs cronológicas SEP
    expect(contrato.contratoCalculadoTotal).toBe(29); // 5h base aula + 24h SEP
    expect(contrato.saldoHoras).toBe(6); // 35h contrato - 29h asignadas = 6h vacantes
    expect(contrato.esInfractorExcesoLectivo).toBe(false);
  });

  it('audita caso real de Valentina Alarcón Jünemann (26h SEP, 22 HA Co-Docencia SEP en 65/35): no debe generar horas exentas ficticias ni falso exceso lectivo', () => {
    // Valentina Alarcón Jünemann:
    // Contrato 26 hrs SEP (TITULAR)
    // 22 HA de Co-Docencia SEP distribuidas en 3 cursos (10 HA en 1° Básico + 6 HA en 2° Básico + 6 HA en 3° Básico)
    // Campo legacy en docente con horasTallerSep: 2 (no debe descontar horas del contrato de aula si no hay asignaciones fuera de aula)
    const docValentina: Docente = {
      id: 'doc-valentina-alarcon',
      rbd: '9999',
      run: '16.217.826-1',
      nombres: 'Valentina',
      apellidos: 'Alarcón Jünemann',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 26,
      horasSepTitular: 26,
      horasTallerSep: 2 // legacy field que no debe generar horas exentas fantasma
    };

    const asigsValentina: AsignacionHoraria[] = [
      {
        id: 'asig-val-1',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-valentina-alarcon',
        asignatura: 'Codocencia Lenguaje 1B',
        horasPedagogicasAula: 10,
        esCoDocencia: true,
        tipoApoyo: 'CO_DOCENCIA'
      },
      {
        id: 'asig-val-2',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-valentina-alarcon',
        asignatura: 'Codocencia Matemática 2B',
        horasPedagogicasAula: 6,
        esCoDocencia: true,
        tipoApoyo: 'CO_DOCENCIA'
      },
      {
        id: 'asig-val-3',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-valentina-alarcon',
        asignatura: 'Codocencia Lenguaje 3B',
        horasPedagogicasAula: 6,
        esCoDocencia: true,
        tipoApoyo: 'CO_DOCENCIA'
      }
    ];

    // 1. Diagnóstico del colegio
    const diag = calcularDiagnosticoColegio(colegio, salas, cursos, [docValentina], asigsValentina);
    const estDoc = diag.estadoDocentes[0];

    expect(estDoc.horasTallerSep).toBe(22); // 22 hrs SEP cronológicas asignadas
    expect(estDoc.horasExentas).toBe(22); // 22 hrs cronológicas exentas de proporción regular
    expect(estDoc.horasSepSinAsignar).toBe(4); // 26h contrato SEP - 22h asignadas = 4h vacantes
    expect(estDoc.estaSobreasignado).toBe(false);

    // 2. Consolidado territorial
    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], [docValentina], asigsValentina, cursos);
    const contrato = consolidado[0].contratos[0];

    expect(contrato.horasAula65_35).toBe(0); // 0 HA de aula regular (son 100% SEP cronológicas)
    expect(contrato.horasTallerSep).toBe(22); // 22 hrs cronológicas SEP
    expect(contrato.contratoCalculadoTotal).toBe(22); // 22h calculadas (Base: 0h + 22h SEP)
    expect(contrato.esInfractorExcesoLectivo).toBe(false); // NO exceso lectivo!
    expect(contrato.saldoHoras).toBe(4); // 4h de saldo a favor / vacantes
  });
});
