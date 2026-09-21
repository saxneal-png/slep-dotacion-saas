import { describe, it, expect } from 'vitest';
import { construirContextoDotacion, responderConsultaLocalmente } from '../src/services/dotacionCopilotService';
import type { Establecimiento, Docente, CursoSae, AsignacionHoraria, SalaInfraestructura } from '../src/types';

describe('Copilot IA y Detección de Directivos / Horas Directivas', () => {
  const colegioPacheco: Establecimiento = {
    id: 'est_3656',
    rbd: '3656',
    nombre: 'LICEO POLIVALENTE JUAN PACHECO ALTAMIRANO',
    comuna: 'Chillán Viejo',
    regimen: 'JEC',
    porcentajePrioritarios: 88,
    director: 'Verónica Knothe Badillo'
  };

  const salasMock: SalaInfraestructura[] = [];
  const cursosMock: CursoSae[] = [
    {
      id: 'c_1',
      rbd: '3656',
      periodo: 2026,
      nivel: '1° Medio',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 32
    }
  ];

  const docentesMock: Docente[] = [
    {
      id: 'doc_dir',
      rbd: '3656',
      periodo: 2026,
      run: '9.084.088-6',
      nombres: 'Verónica',
      apellidos: 'Knothe Badillo',
      titulo: 'Profesora de Estado',
      calidadJuridica: 'TITULAR',
      estamento: 'DIRECTIVO',
      cargoInstitucional: 'DIRECTORA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      horasDirectivas: 44,
      horasAula: 0
    },
    {
      id: 'doc_prof',
      rbd: '3656',
      periodo: 2026,
      run: '16.789.012-3',
      nombres: 'Carlos',
      apellidos: 'Muñoz Soto',
      titulo: 'Profesor de Matemática',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      horasAula: 30
    }
  ];

  const asignacionesMock: AsignacionHoraria[] = [
    {
      id: 'asig_1',
      rbd: '3656',
      periodo: 2026,
      cursoId: 'c_1',
      docenteId: 'doc_prof',
      asignatura: 'Matemática',
      horasPedagogicasAula: 6
    }
  ];

  it('construye el contexto enriquecido identificando a la Directora y sus horas de liderazgo DFL 1', () => {
    const contexto = construirContextoDotacion(
      colegioPacheco,
      2026,
      salasMock,
      cursosMock,
      docentesMock,
      asignacionesMock
    );

    expect(contexto.resumenTexto).toContain('Director(a) Titular / Encargado(a): Verónica Knothe Badillo');
    expect(contexto.resumenTexto).toContain('Horas Directivas (Dirección/Subdirección): 44h');
    expect(contexto.resumenTexto).toContain('Verónica Knothe Badillo');
    expect(contexto.resumenTexto).toContain('DIRECTORA/DIRECTOR - Exento/a de docencia de aula por Estatuto Docente DFL 1');
    expect(contexto.resumenTexto).toContain('9.084.088-6');
  });

  it('responde localmente con precisión ante consultas sobre el Director/a y su jornada', () => {
    const contexto = construirContextoDotacion(
      colegioPacheco,
      2026,
      salasMock,
      cursosMock,
      docentesMock,
      asignacionesMock
    );

    const respuesta = responderConsultaLocalmente('¿Quién es la directora del liceo y cuántas horas directivas tiene?', contexto);

    expect(respuesta).toContain('Verónica Knothe Badillo');
    expect(respuesta).toContain('DIRECTORA / DIRECTOR');
    expect(respuesta).toContain('44 hrs cronológicas');
    expect(respuesta).toContain('Directivas: 44h');
    expect(respuesta).toContain('Estatuto Docente (DFL 1/1996)');
    expect(respuesta).toContain('exceptuados de las proporciones lectivas de aula');
  });
});
