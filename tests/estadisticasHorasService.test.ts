import { describe, it, expect } from 'vitest';
import {
  calcularEstadisticasColegio,
  calcularEstadisticasTerritoriales,
  calcularEstadisticasAsistentesColegio,
  clasificarCategoriaEstablecimiento,
  esPropuestaNoContinuidad,
  filtrarCarteraPorTipoYContinuidad,
  CATEGORIAS_ESCOLARES_SIN_VTF,
} from '../src/services/estadisticasHorasService';
import {
  esDocenteEducacionEspecialPie,
  normalizarFuentesFinanciamientoDocente,
  normalizarFuentesFinanciamientoAsistente,
  obtenerHorasCronologicasExactasAsig
} from '../src/services/auditoriaDocenteService';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, AsistenteEducacion } from '../src/types';

describe('Servicio de Estadísticas y Auditoría de Dotación de Personal SLEP', () => {
  const colegioMock: Establecimiento = {
    id: 'col-1',
    rbd: '1234',
    nombre: 'Escuela Diguillín Central',
    comuna: 'San Ignacio',
    regimen: 'JEC',
    porcentajePrioritarios: 75,
    director: 'Juan Pérez'
  };

  const cursosMock: CursoSae[] = [
    {
      id: 'c-1',
      rbd: '1234',
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 5,
      alumnosNeep: 2
    },
    {
      id: 'c-2',
      rbd: '1234',
      nivel: '2° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 32,
      alumnosNeet: 4,
      alumnosNeep: 1
    }
  ];

  const docentesMock: Docente[] = [
    {
      id: 'doc-1',
      rbd: '1234',
      run: '11.111.111-1',
      nombres: 'María',
      apellidos: 'González',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44
    },
    {
      id: 'doc-2',
      rbd: '1234',
      run: '22.222.222-2',
      nombres: 'Carlos',
      apellidos: 'Muñoz',
      calidadJuridica: 'POSTULANDO_A_TITULARIDAD',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30
    },
    {
      id: 'doc-3',
      rbd: '1234',
      run: '33.333.333-3',
      nombres: 'Lucía',
      apellidos: 'Reyes',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 44,
      horasPieContrata: 44
    }
  ];

  const asignacionesMock: AsignacionHoraria[] = [
    {
      id: 'asig-1',
      rbd: '1234',
      cursoId: 'c-1',
      docenteId: 'doc-1',
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 8
    },
    {
      id: 'asig-2',
      rbd: '1234',
      cursoId: 'c-1',
      docenteId: 'doc-1',
      asignatura: 'Matemática',
      horasPedagogicasAula: 6
    },
    {
      id: 'asig-3',
      rbd: '1234',
      cursoId: 'c-2',
      docenteId: 'doc-2',
      asignatura: 'Ciencias Naturales',
      horasPedagogicasAula: 4
    }
  ];

  const asistentesMock: AsistenteEducacion[] = [
    {
      id: 'asist-1',
      rbd: '1234',
      periodo: 2027,
      run: '44.444.444-4',
      nombres: 'Pedro',
      apellidos: 'Soto',
      cargoFuncion: 'Psicólogo Dupla',
      estamento: 'PROFESIONAL',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 44,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      esDuplaPsicosocial: true,
      activo: true
    },
    {
      id: 'asist-2',
      rbd: '1234',
      periodo: 2027,
      run: '55.555.555-5',
      nombres: 'Ana',
      apellidos: 'López',
      cargoFuncion: 'Auxiliar de Aseo',
      estamento: 'AUXILIAR',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 0,
      horasSubvencionGeneralPlazoFijo: 44,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      esAuxiliarServicio: true,
      activo: true
    }
  ];

  it('debe desglosar fielmente la calidad jurídica docente distinguiendo Titulares, Postulando a Titularidad y Contrata', () => {
    const stats = calcularEstadisticasColegio(colegioMock, cursosMock, docentesMock, asignacionesMock, asistentesMock);

    expect(stats.calidadJuridica.titularesCount).toBe(1);
    expect(stats.calidadJuridica.titularesHoras).toBe(44);

    expect(stats.calidadJuridica.postulandoTitularidadCount).toBe(1);
    expect(stats.calidadJuridica.postulandoTitularidadHoras).toBe(30);

    expect(stats.calidadJuridica.contrataCount).toBe(1);
    expect(stats.calidadJuridica.contrataHoras).toBe(44);

    // Total de horas docentes = 44 + 30 + 44 = 118
    expect(stats.horasContratoTotal).toBe(118);

    // Porcentaje a contrata (44h / 118h = ~37.3%)
    expect(stats.calidadJuridica.porcentajeContrata).toBeCloseTo(37.3, 0);
    expect(stats.calidadJuridica.cumpleNorma8020).toBe(false); // Supera el 20%
  });

  it('debe integrar y auditar a los Asistentes de la Educación según Ley 21.109', () => {
    const stats = calcularEstadisticasColegio(colegioMock, cursosMock, docentesMock, asignacionesMock, asistentesMock);

    expect(stats.asistentes.totalAsistentes).toBe(2);
    expect(stats.asistentes.totalHorasContrato).toBe(88);
    expect(stats.asistentes.profesionalesCount).toBe(1);
    expect(stats.asistentes.auxiliaresCount).toBe(1);
    expect(stats.asistentes.horasIndefinidas).toBe(44);
    expect(stats.asistentes.horasPlazoFijo).toBe(44);

    // Ratio de alumnos por auxiliar (62 matrícula / 1 auxiliar = 62)
    expect(stats.asistentes.ratioAlumnosPorAuxiliar).toBe(62);

    // Dupla Psicosocial detectada
    expect(stats.asistentes.duplaPsicosocial.tienePsicologo).toBe(true);
  });

  it('debe consolidar la dotación de personal completa del establecimiento (Docentes + Asistentes)', () => {
    const stats = calcularEstadisticasColegio(colegioMock, cursosMock, docentesMock, asignacionesMock, asistentesMock);

    // Total funcionarios = 3 docentes + 2 asistentes = 5
    expect(stats.consolidadoPersonal.totalFuncionarios).toBe(5);

    // Total horas contratadas = 118 (docentes) + 88 (asistentes) = 206 hrs
    expect(stats.consolidadoPersonal.totalHorasContratadas).toBe(206);
  });

  it('debe cuadrar exactamente la jornada docente sumando el 100% sin horas perdidas ni porcentajes fantasma', () => {
    const stats = calcularEstadisticasColegio(colegioMock, cursosMock, docentesMock, asignacionesMock, asistentesMock);

    const sumaPorcentajes =
      stats.porcentajeAula +
      stats.porcentajeNoLectivo +
      stats.porcentajeRecreo +
      stats.porcentajeInstitucional +
      stats.porcentajeVacantes;

    // La suma de los porcentajes de la jornada debe dar exactamente 100%
    expect(sumaPorcentajes).toBe(100);

    // Debe calcular con precisión las horas vacantes/libres
    expect(stats.horasVacantesLibresTotal).toBeGreaterThan(0);
  });

  it('debe calcular exactamente las horas de holgura / libres individuales por docente (sin función asignada)', () => {
    const stats = calcularEstadisticasColegio(colegioMock, cursosMock, docentesMock, asignacionesMock, asistentesMock);

    const doc1 = stats.desgloseDocentes.find(d => d.id === 'doc-1')!;
    const doc2 = stats.desgloseDocentes.find(d => d.id === 'doc-2')!;

    // doc-1 tiene 44h contrato y 14 HA asignadas (requieren 16h base MINEDUC). Sus horas libres son 44 - 16 = 28h
    expect(doc1.horasComprometidasDocente).toBe(16);
    expect(doc1.horasLibresDocente).toBe(28);

    // doc-2 tiene 30h contrato y 4 HA asignadas (requieren 5h base MINEDUC). Sus horas libres son 30 - 5 = 25h
    expect(doc2.horasComprometidasDocente).toBe(5);
    expect(doc2.horasLibresDocente).toBe(25);

    // La suma de horas libres de los docentes debe igualar exactamente a horasVacantesLibresTotal del colegio
    const sumaLibresDocentes = stats.desgloseDocentes.reduce((s, d) => s + d.horasLibresDocente, 0);
    expect(stats.horasVacantesLibresTotal).toBe(sumaLibresDocentes);
  });

  it('debe calcular estadísticas territoriales consolidadas incluyendo comunas, RUNs únicos y regla 80/20', () => {
    const colegio2: Establecimiento = {
      id: 'col-2',
      rbd: '5678',
      nombre: 'Liceo Yungay Alto',
      comuna: 'Yungay',
      regimen: 'JEC',
      porcentajePrioritarios: 85
    };

    const statsTerr = calcularEstadisticasTerritoriales(
      [colegioMock, colegio2],
      cursosMock,
      docentesMock,
      asignacionesMock,
      asistentesMock
    );

    expect(statsTerr.totalEstablecimientos).toBe(2);
    expect(statsTerr.totalDocentesPlanta).toBe(3);
    expect(statsTerr.asistentesTerritorio.totalAsistentes).toBe(2);
    expect(statsTerr.totalPersonalSlep).toBe(5);

    // Debe agrupar por comunas existentes
    expect(statsTerr.porComuna['San Ignacio']).toBeDefined();
    expect(statsTerr.porComuna['San Ignacio'].colegiosCount).toBe(1);
    expect(statsTerr.porComuna['Yungay']).toBeDefined();
    expect(statsTerr.porComuna['Yungay'].colegiosCount).toBe(1);
  });

  it('debe deduplicar docentes, asistentes y asignaciones idénticas, cuadrar fuentes con contrato y evitar decimales .3/.7/.8 en PIE', () => {
    const col: Establecimiento = {
      id: 'est-campanario',
      rbd: '3941',
      nombre: 'Liceo Campanario',
      comuna: 'Yungay',
      regimen: 'JEC',
      porcentajePrioritarios: 85 // 60/40
    };

    const cursosCol: CursoSae[] = [
      {
        id: 'cur-1',
        rbd: '3941',
        nivel: '1° Básico',
        letra: 'A',
        regimen: 'JEC',
        cupoSae: 35,
        matriculaProyectada: 28,
        regimenProporcion: '60_40'
      }
    ];

    // Docente duplicado con ID distinto + Educadora Diferencial importada como DOCENTE_AULA con fuente PIE+Subv duplicada (88h en contrato de 44h)
    const docentesConDups: Docente[] = [
      {
        id: 'doc-3941-11111111',
        rbd: '3941',
        run: '16.218.098-3',
        nombres: 'Andrea',
        apellidos: 'Polanco',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 20,
        horasSubvencionGeneralTitular: 20
      },
      {
        id: 'doc-1793895363164', // Mismo RUN en el mismo RBD, sin asignaciones
        rbd: '3941',
        run: '16.218.098-3',
        nombres: 'Andrea',
        apellidos: 'Polanco',
        calidadJuridica: 'TITULAR',
        estamento: 'DOCENTE_AULA',
        horasContrato: 20,
        horasSubvencionGeneralTitular: 20
      },
      {
        id: 'doc-dif-mal-estamento',
        rbd: '3941',
        run: '15.222.333-4',
        nombres: 'Fabiola',
        apellidos: 'Gajardo',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_AULA',
        asignaturaPrincipal: 'Educadora Diferencial',
        horasContrato: 44,
        horasSubvencionGeneralContrata: 44, // Fuente inflada heredada (44 + 44 = 88h)
        horasPieContrata: 44
      }
    ];

    expect(esDocenteEducacionEspecialPie(docentesConDups[2])).toBe(true);

    // Asignaciones con duplicado exacto + Aula de Recursos transversal (antes convertida a 2.3h decimales)
    const asigsConDups: AsignacionHoraria[] = [
      {
        id: 'asig-1',
        rbd: '3941',
        cursoId: 'cur-1',
        docenteId: 'doc-3941-11111111',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 8
      },
      {
        id: 'asig-1-dup',
        rbd: '3941',
        cursoId: 'cur-1',
        docenteId: 'doc-3941-11111111',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 8
      },
      {
        id: 'asig-recurso-3ha',
        rbd: '3941',
        cursoId: 'TRANSVERSAL',
        docenteId: 'doc-dif-mal-estamento',
        asignatura: 'Apoyo PIE - Aula de Recursos',
        tipoApoyo: 'Aula de Recursos / Refuerzo Especializado',
        horasPedagogicasAula: 3,
        horasCronologicasPie: 2.3, // Antiguo redondeo artificial
        esCoDocencia: true,
        esProporcionDocente: false
      }
    ];

    // Confirmar conversión exacta en cuartos de hora cuando aplica (3 HA * 0.75 = 2.25, jamás 2.3)
    expect(obtenerHorasCronologicasExactasAsig(asigsConDups[2])).toBe(2.25);

    const asistentesConDups: AsistenteEducacion[] = [
      {
        id: 'asist_3941_12318364_17',
        rbd: '3941',
        periodo: 2027,
        run: '12318364-K',
        nombres: 'Marcela',
        apellidos: 'Silva',
        cargoFuncion: 'Auxiliar',
        estamento: 'AUXILIAR',
        horasContrato: 44,
        horasSubvencionGeneralIndefinido: 44,
        horasPieIndefinido: 44, // Fuente inflada 44 + 44 = 88h
        activo: true
      },
      {
        id: 'asist_3941_12318364_35',
        rbd: '3941',
        periodo: 2027,
        run: '12318364-K',
        nombres: 'Marcela',
        apellidos: 'Silva',
        cargoFuncion: 'Auxiliar',
        estamento: 'AUXILIAR',
        horasContrato: 44,
        horasSubvencionGeneralIndefinido: 44,
        activo: true
      }
    ];

    const stats = calcularEstadisticasColegio(col, cursosCol, docentesConDups, asigsConDups, asistentesConDups);

    // 1. Deduplicación exacta: 2 docentes (no 3), 1 asistente (no 2)
    expect(stats.totalDocentes).toBe(2);
    expect(stats.horasContratoTotal).toBe(64); // 20 + 44
    expect(stats.asistentes.totalAsistentes).toBe(1);
    expect(stats.asistentes.totalHorasContrato).toBe(44);

    // 2. Cuadre exacto de fuentes: Subv Gen + SEP + PIE === horasContratoTotal (tanto docentes como asistentes)
    expect(stats.financiamiento.total).toBe(64);
    expect(stats.financiamiento.pieTotal).toBe(44);
    expect(stats.financiamiento.subvencionGeneralTotal).toBe(20);
    expect(stats.asistentes.subvencionGeneralHoras + stats.asistentes.sepHoras + stats.asistentes.pieHoras).toBe(44);

    // 3. Asignación duplicada eliminada (8 HA, no 16 HA) + Educadora Diferencial evalúa 3 HA Aula de Recursos por tabla 60/40 (4h contrato req -> 40h libres exactos, jamás .3/.7/.8)
    const fabiola = stats.desgloseDocentes.find(d => d.id === 'doc-dif-mal-estamento')!;
    const andrea = stats.desgloseDocentes.find(d => d.id === 'doc-3941-11111111')!;
    expect(andrea.horasAulaPedagogicas).toBe(8);
    expect(fabiola.horasAulaPedagogicas).toBe(3);
    expect(fabiola.horasComprometidasDocente).toBe(4);
    expect(fabiola.horasLibresDocente).toBe(40);
    expect(Number.isInteger(stats.horasVacantesLibresTotal)).toBe(true);

    // 4. Estadísticas territoriales coherentes con porColegio deduplicado
    const statsTerr = calcularEstadisticasTerritoriales([col], cursosCol, docentesConDups, asigsConDups, asistentesConDups);
    expect(statsTerr.totalDocentesPlanta).toBe(2);
    expect(statsTerr.asistentesTerritorio.totalAsistentes).toBe(1);
    expect(statsTerr.totalHorasPersonalSlep).toBe(108); // 64 + 44
    expect(statsTerr.totalHorasSubvencionGeneralPersonal + statsTerr.totalHorasSepPersonal + statsTerr.totalHorasPiePersonal).toBe(108);

    // 5. Verificar helpers de normalización de fuentes directamente
    const fDoc = normalizarFuentesFinanciamientoDocente(44, 'TITULAR', 44, 0, 0, 0, 3, 0);
    expect(fDoc.pieTitular).toBe(3);
    expect(fDoc.subvGenTitular).toBe(41);

    const fAst = normalizarFuentesFinanciamientoAsistente(44, 44, 0, 0, 0, 44, 0, 0);
    expect(fAst.pieIndefinido).toBe(44);
    expect(fAst.subvGenIndefinido).toBe(0);
  });

  it('Filtra cartera territorial por tipo de establecimiento (aislando Jardines VTF) y excluye No Continuidad', () => {
    const estEscuela: Establecimiento = {
      rbd: '4001',
      nombre: 'Escuela Básica Norte',
      comuna: 'Chillán',
      tipo: 'ESCUELA',
      perfilEstablecimiento: 'ESCUELA_BASICA',
      matricula: 300,
    };
    const estLiceo: Establecimiento = {
      rbd: '4002',
      nombre: 'Liceo Bicentenario',
      comuna: 'Bulnes',
      tipo: 'LICEO',
      perfilEstablecimiento: 'LICEO_HC',
      matricula: 600,
    };
    const estJardin: Establecimiento = {
      rbd: '9001',
      nombre: 'Jardín Infantil Los Peumos VTF',
      comuna: 'Chillán',
      tipo: 'JARDIN',
      perfilEstablecimiento: 'JARDIN_SALA_CUNA',
      matricula: 80,
    };

    expect(clasificarCategoriaEstablecimiento(estEscuela)).toBe('ESCUELA');
    expect(clasificarCategoriaEstablecimiento(estLiceo)).toBe('LICEO');
    expect(clasificarCategoriaEstablecimiento(estJardin)).toBe('JARDIN_VTF');

    expect(esPropuestaNoContinuidad('No Continuidad')).toBe(true);
    expect(esPropuestaNoContinuidad('no continuidad')).toBe(true);
    expect(esPropuestaNoContinuidad('Continuidad')).toBe(false);
    expect(esPropuestaNoContinuidad(undefined)).toBe(false);

    const docentesMix: Docente[] = [
      {
        id: 'd-esc-cont',
        rbd: '4001',
        nombre: 'Docente Escuela Cont',
        rut: '11.111.111-1',
        horasContrato: 44,
        propuestaGdp: 'Continuidad',
      },
      {
        id: 'd-esc-nocont',
        rbd: '4001',
        nombre: 'Docente Escuela NoCont',
        rut: '22.222.222-2',
        horasContrato: 30,
        propuestaGdp: 'No Continuidad',
      },
      {
        id: 'd-lic-cont',
        rbd: '4002',
        nombre: 'Docente Liceo Cont',
        rut: '33.333.333-3',
        horasContrato: 44,
        propuestaGdp: 'Continuidad',
      },
      {
        id: 'd-jar-cont',
        rbd: '9001',
        nombre: 'Educadora Párvulos VTF',
        rut: '44.444.444-4',
        horasContrato: 44,
        propuestaGdp: 'Continuidad',
      },
    ];

    const asistentesMix: AsistenteEducacion[] = [
      {
        id: 'a-esc-nocont',
        rbd: '4001',
        nombre: 'Asistente NoCont',
        rut: '55.555.555-5',
        estamento: 'PARADOCENTE',
        calidadJuridica: 'PLAZO_FIJO',
        horasContrato: 44,
        propuestaGdp: 'No Continuidad',
      },
      {
        id: 'a-jar-cont',
        rbd: '9001',
        nombre: 'Técnico VTF',
        rut: '66.666.666-6',
        estamento: 'TECNICO',
        calidadJuridica: 'INDEFINIDO',
        horasContrato: 44,
        propuestaGdp: 'Continuidad',
      },
    ];

    const asigsMix: AsignacionHoraria[] = [
      { id: 'as-1', rbd: '4001', docenteId: 'd-esc-cont', cursoId: 'c1', asignatura: 'Matemática', horasAula: 24, esSep: false, esPie: false },
      { id: 'as-2', rbd: '4001', docenteId: 'd-esc-nocont', cursoId: 'c1', asignatura: 'Lenguaje', horasAula: 20, esSep: false, esPie: false },
      { id: 'as-3', rbd: '9001', docenteId: 'd-jar-cont', cursoId: 'c2', asignatura: 'Párvulos', horasAula: 30, esSep: false, esPie: false },
    ];

    const cursosMix: CursoSae[] = [
      { id: 'c1', rbd: '4001', nivel: '1° Básico', letra: 'A', anio: 2026, matriculaActual: 30, cuposSae: 35, tipoJornada: 'JEC' },
      { id: 'c2', rbd: '9001', nivel: 'NT1', letra: 'A', anio: 2026, matriculaActual: 20, cuposSae: 24, tipoJornada: 'SIN_JEC' },
    ];

    const resSinVtfNiNoCont = filtrarCarteraPorTipoYContinuidad({
      colegios: [estEscuela, estLiceo, estJardin],
      cursos: cursosMix,
      docentes: docentesMix,
      asignaciones: asigsMix,
      asistentes: asistentesMix,
      categoriasSeleccionadas: CATEGORIAS_ESCOLARES_SIN_VTF,
      incluirNoContinuidad: false,
    });

    expect(resSinVtfNiNoCont.colegiosFiltrados.map(c => c.rbd)).toEqual(['4001', '4002']);
    expect(resSinVtfNiNoCont.conteosPorCategoria).toEqual({ ESCUELA: 1, LICEO: 1, JARDIN_VTF: 1 });
    expect(resSinVtfNiNoCont.docentesFiltrados.map(d => d.id)).toEqual(['d-esc-cont', 'd-lic-cont']);
    expect(resSinVtfNiNoCont.asignacionesFiltradas.map(a => a.id)).toEqual(['as-1']);
    expect(resSinVtfNiNoCont.asistentesFiltrados).toHaveLength(0);
    expect(resSinVtfNiNoCont.conteoNoContinuidadDocentes).toBe(1);
    expect(resSinVtfNiNoCont.horasNoContinuidadDocentes).toBe(30);
    expect(resSinVtfNiNoCont.conteoNoContinuidadAsistentes).toBe(1);
    expect(resSinVtfNiNoCont.horasNoContinuidadAsistentes).toBe(44);
  });
});
