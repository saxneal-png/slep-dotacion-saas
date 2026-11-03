import { describe, it, expect } from 'vitest';
import {
  calcularEstadisticasColegio,
  calcularEstadisticasTerritoriales,
  calcularEstadisticasAsistentesColegio
} from '../src/services/estadisticasHorasService';
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
});
