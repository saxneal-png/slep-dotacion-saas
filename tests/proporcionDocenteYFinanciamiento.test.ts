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

  it('audita caso real de Docente PIE con 39h contrata (11h apoyo aula + 28h Coordinadora PIE): calcula 39h exactas sin inflación', () => {
    // Caso de usuario:
    // Docente diferencial con contrato de 39h PIE contrata (0 Subv. Gen, 0 SEP)
    // 11h de apoyo en aula (co-docencia PIE)
    // 28h como Coordinadora PIE de primer ciclo (registrada en funcionesNoAula con financiamiento PIE)
    const docPie39: Docente = {
      id: 'doc-pie-39',
      rbd: '9999',
      run: '17.888.999-0',
      nombres: 'Claudia',
      apellidos: 'Morales',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 39,
      horasSubvencionGeneralTitular: 0,
      horasSubvencionGeneralContrata: 0,
      horasSepTitular: 0,
      horasSepContrata: 0,
      horasPieTitular: 0,
      horasPieContrata: 39,
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
        horasCronologicasPie: 11,
        esCoDocencia: true,
        tipoApoyo: 'Co-Docencia en Aula Regular'
      }
    ];

    // 1. Diagnóstico del colegio
    const diag = calcularDiagnosticoColegio(colegio, salas, cursos, [docPie39], asigPie11);
    const estDoc = diag.estadoDocentes[0];

    expect(estDoc.horasAulaRegular).toBe(0); // Co-docencia no es aula regular
    expect(estDoc.horasCoDocencia).toBe(11);
    expect(estDoc.horasExentas).toBe(39); // 28h coord PIE + 11h apoyo = 39h
    expect(estDoc.horasDocenciaAfecta).toBe(0);
    expect(estDoc.estaSobreasignado).toBe(false);
    expect(estDoc.horasVacantes).toBe(0); // 39h contrato - 39h carga = 0

    // 2. Consolidado territorial multitramo
    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], [docPie39], asigPie11);
    const contrato = consolidado[0].contratos[0];

    expect(contrato.contratoCalculadoTotal).toBe(39); // NO 67h!
    expect(contrato.fuentesFinanciamiento.total).toBe(39);
    expect(contrato.saldoHoras).toBe(0);
    expect(contrato.estadoSaldo).toBe('EXACTO');
    expect(contrato.esInfractorExcesoLectivo).toBe(false);
  });

  it('audita caso real de Natalia Bórquez Barría (15 HA / 11h cronológicas apoyo PIE + 28h Coordinadora PIE): calcula 39h exactas', () => {
    // Natalia Bórquez Barría:
    // DOCENTE DIFERENCIAL, TITULAR 39 hrs.
    // 1 función no aula de 28h (Coordinadora PIE).
    // Asignación PIE con 15 HA pedagógicas (equivalente a 11h cronológicas).
    const docNatalia: Docente = {
      id: 'doc-natalia-borquez',
      rbd: '9999',
      run: '18.281.913-1',
      nombres: 'Natalia',
      apellidos: 'Bórquez Barría',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 39,
      horasSubvencionGeneralTitular: 0,
      horasSubvencionGeneralContrata: 0,
      horasSepTitular: 0,
      horasSepContrata: 0,
      horasPieTitular: 39,
      horasPieContrata: 0,
      funcionesNoAula: [
        {
          id: 'func-coord-natalia',
          tipo: 'COORDINACION_PIE',
          nombre: 'Coordinadora PIE Primer Ciclo',
          horas: 28,
          financiamiento: 'PIE'
        }
      ]
    };

    const asigNatalia: AsignacionHoraria[] = [
      {
        id: 'asig-natalia-apoyo',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-natalia-borquez',
        asignatura: 'Apoyo PIE - Co-docencia Aula Común',
        horasPedagogicasAula: 15, // 15 HA pedagógicas = 11h cronológicas
        horasCronologicasPie: 11,
        esCoDocencia: true,
        tipoApoyo: 'Co-Docencia en Aula Regular'
      }
    ];

    const diag = calcularDiagnosticoColegio(colegio, salas, cursos, [docNatalia], asigNatalia);
    const estDoc = diag.estadoDocentes[0];
    expect(estDoc.horasExentas).toBe(39);
    expect(estDoc.horasVacantes).toBe(0);
    expect(estDoc.estaSobreasignado).toBe(false);

    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], [docNatalia], asigNatalia);
    const contrato = consolidado[0].contratos[0];
    expect(contrato.contratoCalculadoTotal).toBe(39); // 39h exactas, NO 43h!
    expect(contrato.saldoHoras).toBe(0);
    expect(contrato.estadoSaldo).toBe('EXACTO');
  });

  it('audita correctamente el caso Ortiz Ortiz Castro Marianela con 36 horas de contrato (32 HA Co-Docencia SEP + 4 HA Talleres)', () => {
    const colegioVulnerable: Establecimiento = {
      ...colegio,
      porcentajePrioritarios: 85 // Escuela vulnerable (>80% prioritarios)
    };

    const docMarianela: Docente = {
      id: 'doc-marianela',
      rbd: '9999',
      run: '12.345.678-9',
      nombres: 'Marianela',
      apellidos: 'Ortiz Ortiz Castro',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 36,
      horasSubvencionGeneralTitular: 0,
      horasSubvencionGeneralContrata: 4,
      horasSepTitular: 0,
      horasSepContrata: 32,
      horasPieTitular: 0,
      horasPieContrata: 0
    };

    const asigsMarianela: AsignacionHoraria[] = [
      {
        id: 'asig-aele',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-marianela',
        asignatura: 'Taller AELE',
        horasPedagogicasAula: 2,
        esTallerJec: true
      },
      {
        id: 'asig-extension',
        rbd: '9999',
        cursoId: 'TRANSVERSAL',
        docenteId: 'doc-marianela',
        asignatura: 'Taller Extensión Horaria',
        horasPedagogicasAula: 2
      },
      {
        id: 'asig-codoc-sep',
        rbd: '9999',
        cursoId: 'TRANSVERSAL',
        docenteId: 'doc-marianela',
        asignatura: 'Co-docencia',
        horasPedagogicasAula: 25,
        esCoDocencia: true,
        esTallerSep: true,
        tipoApoyo: 'CO_DOCENCIA'
      }
    ];

    const consolidado = obtenerDocentesConsolidadosTerritorio([colegioVulnerable], [docMarianela], asigsMarianela, cursos);
    const contrato = consolidado[0].contratos[0];

    // En régimen 60/40, 29 HA de aula (4 HA regular + 25 HA Co-docencia SEP) exigen exactamente 36h de contrato
    expect(contrato.contratoCalculadoTotal).toBe(36);
    expect(contrato.saldoHoras).toBe(0);
    expect(contrato.estadoSaldo).toBe('EXACTO');
    expect(contrato.esInfractorExcesoLectivo).toBe(false);
  });

  it('audita caso real de Daniela Cabrera Gutiérrez (32h contrato: 2 HA regular + 26 HA Co-Docencia SEP = 28 HA): calcula 32h exactas con proporción Ley 20.903 y 0h libres', () => {
    // Daniela Cabrera:
    // DOCENTE AULA, CONTRATA 32 hrs (2h Subvención General + 30h SEP)
    // 2 HA Plan Regular / JEC (1 HA Orientación + 1 HA Taller Socioemocional)
    // 26 HA Co-docencia SEP en aula
    // Total aula: 28 HA en 65/35 -> Exige exactamente 32 hrs de contrato (21h lectivas + 8h 49m HNL + 2h 11m recreos)
    const docDaniela: Docente = {
      id: 'doc-daniela-cabrera',
      rbd: '9999',
      run: '17.747.745-1',
      nombres: 'Daniela Marioly',
      apellidos: 'Cabrera Gutierrez',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 32,
      horasSubvencionGeneralTitular: 0,
      horasSubvencionGeneralContrata: 2,
      horasSepTitular: 0,
      horasSepContrata: 30,
      horasPieTitular: 0,
      horasPieContrata: 0
    };

    const asigsDaniela: AsignacionHoraria[] = [
      {
        id: 'asig-daniela-orient',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-daniela-cabrera',
        asignatura: 'Orientación',
        horasPedagogicasAula: 1
      },
      {
        id: 'asig-daniela-socioem',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-daniela-cabrera',
        asignatura: 'Jec: Taller Socioemocional',
        horasPedagogicasAula: 1,
        esTallerJec: true
      },
      {
        id: 'asig-daniela-codoc-sep-1',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-daniela-cabrera',
        asignatura: 'Co-docencia SEP Lenguaje',
        horasPedagogicasAula: 14,
        esCoDocencia: true,
        esTallerSep: true,
        tipoApoyo: 'CO_DOCENCIA'
      },
      {
        id: 'asig-daniela-codoc-sep-2',
        rbd: '9999',
        cursoId: 'curso-5b',
        docenteId: 'doc-daniela-cabrera',
        asignatura: 'Co-docencia SEP Matemática',
        horasPedagogicasAula: 12,
        esCoDocencia: true,
        esTallerSep: true,
        tipoApoyo: 'CO_DOCENCIA'
      }
    ];

    // 1. Diagnóstico del colegio
    const diag = calcularDiagnosticoColegio(colegio, salas, cursos, [docDaniela], asigsDaniela);
    const estDoc = diag.estadoDocentes[0];

    // Aula regular solo 2 HA (las 26 HA de co-docencia no inflan la demanda curricular)
    expect(estDoc.horasAulaRegular).toBe(2);
    expect(estDoc.horasCoDocencia).toBe(26);
    expect(estDoc.horasPedagogicasAsignadas).toBe(28);
    // 0 horas vacantes/libres (se consumen exactamente las 32h)
    expect(estDoc.horasVacantes).toBe(0);
    expect(estDoc.estaSobreasignado).toBe(false);
    expect(estDoc.horasSepSinAsignar).toBe(0);
    expect(estDoc.horasSubvGeneralSinAsignar).toBe(0);

    // Balanza curricular de la escuela: solo 2 HA lectivas regulares sumadas
    expect(diag.balanzaGeneral.horasLectivasAsignadas).toBe(2);

    // 2. Consolidado territorial multitramo
    const consolidado = obtenerDocentesConsolidadosTerritorio([colegio], [docDaniela], asigsDaniela, cursos);
    const contrato = consolidado[0].contratos[0];

    expect(contrato.contratoCalculadoTotal).toBe(32); // Exactamente 32 hrs
    expect(contrato.saldoHoras).toBe(0);
    expect(contrato.estadoSaldo).toBe('EXACTO');
    expect(contrato.esInfractorExcesoLectivo).toBe(false);
    expect(contrato.esImprocedenteFinanciamientoSepPie).toBe(false);
    expect(contrato.deficitSubvencionGeneral).toBe(0);

    // Minutos oficiales: 28 HA = 1260 mins lectivas, recreo > 0, HNL > 0
    expect(contrato.minutosLectivosMineduc).toBe(28 * 45); // 1260 mins (21h 00m)
    expect(contrato.minutosRecreoMineduc).toBe(131); // 2h 11m según tabla RAW_65_35
    expect(contrato.minutosNoLectivosMineduc).toBe(529); // 8h 49m según tabla RAW_65_35
  });
});
