import { describe, it, expect } from 'vitest';
import { AsignacionHoraria, CursoSae, Docente, Establecimiento } from '../src/types';
import { auditarCargaDocenteIntegral, esDocenteEducadoraParvulos } from '../src/services/auditoriaDocenteService';
import { homologarDocenteAPal } from '../src/services/depHomologationEngine';

describe('Docentes de Aula Regular en cursos de Educación Parvularia (cálculo en 45 min)', () => {
  const colegio: Establecimiento = {
    id: 'est-1',
    rbd: '3971',
    nombre: 'Escuela Demo',
    comuna: 'Chillán',
    regimen: 'JEC',
    porcentajePrioritarios: 75
  };

  const kinder: CursoSae = {
    id: 'curso-kinder-a',
    rbd: '3971',
    periodo: 2027,
    nivel: 'Kínder',
    letra: 'A',
    regimen: 'JEC',
    cupoSae: 30,
    matriculaProyectada: 22
  };

  const primeroBasico: CursoSae = {
    id: 'curso-1b-a',
    rbd: '3971',
    periodo: 2027,
    nivel: '1° Básico',
    letra: 'A',
    regimen: 'JEC',
    regimenProporcion: '65_35',
    cupoSae: 35,
    matriculaProyectada: 28
  };

  const profeEdFisica: Docente = {
    id: 'doc-edfis-1',
    rbd: '3971',
    run: '16.555.444-3',
    nombres: 'Carlos',
    apellidos: 'Mendoza',
    estamento: 'DOCENTE_AULA',
    calidadJuridica: 'TITULAR',
    asignaturaPrincipal: 'Educación Física y Salud',
    horasContrato: 35,
    horasSubvencionGeneralTitular: 35
  };

  it('calcula al docente de aula regular con horas en Kínder + Básica en bloques de 45 min y régimen 65/35', () => {
    expect(esDocenteEducadoraParvulos(profeEdFisica)).toBe(false);

    const asigs: AsignacionHoraria[] = [
      {
        id: 'a-kinder',
        rbd: '3971',
        cursoId: kinder.id,
        docenteId: profeEdFisica.id,
        asignatura: 'Taller de Educación Física',
        horasPedagogicasAula: 4,
        esCoDocencia: true,
        esProporcionDocente: true
      },
      {
        id: 'a-1b',
        rbd: '3971',
        cursoId: primeroBasico.id,
        docenteId: profeEdFisica.id,
        asignatura: 'Educación Física y Salud',
        horasPedagogicasAula: 26
      }
    ];

    const cursosMap = new Map<string, CursoSae>([
      [kinder.id, kinder],
      [primeroBasico.id, primeroBasico]
    ]);

    const audit = auditarCargaDocenteIntegral(profeEdFisica, asigs, [], cursosMap, 75);

    expect(audit.isEducadoraParvulo).toBe(false);
    // 4 HA en Kínder + 26 HA en 1° Básico = 30 HA (45 min) en 65/35 -> 35h contrato
    expect(audit.ha65_35).toBe(30);
    expect(audit.ha60_40).toBe(0);
    expect(audit.auditDoc.req65_35).toBe(35);
    expect(audit.auditDoc.contratoCalculadoTotal).toBe(35);
    expect(audit.auditDoc.saldoHoras).toBe(0);
    expect(audit.auditDoc.esInfractorExcesoLectivo).toBe(false);
  });

  it('no clasifica al docente de aula regular como Educadora de Párvulos en homologarDocenteAPal cuando solo tiene horas en Kínder', () => {
    const profeSoloKinder: Docente = {
      ...profeEdFisica,
      id: 'doc-edfis-2',
      horasContrato: 6,
      horasSubvencionGeneralTitular: 6
    };

    const asigSoloKinder: AsignacionHoraria = {
      id: 'a-kinder-only',
      rbd: '3971',
      cursoId: kinder.id,
      docenteId: profeSoloKinder.id,
      asignatura: 'Educación Física',
      horasPedagogicasAula: 4,
      esProporcionDocente: true
    };

    const filasPal = homologarDocenteAPal(
      profeSoloKinder,
      colegio,
      [kinder],
      [asigSoloKinder]
    );

    expect(filasPal.length).toBeGreaterThan(0);
    expect(filasPal[0].estamento).toBe('Docente');
    expect(filasPal[0].nivel).not.toBe('Educación Parvularia');
    expect(filasPal[0].nivel).toBe('Educación Básica');
    expect(filasPal[0].proporcionHa).toBe('65/35');
    expect(filasPal[0].hrsLectivasBasica).toBe(4);
  });
});
