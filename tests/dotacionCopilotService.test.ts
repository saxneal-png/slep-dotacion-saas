import { describe, it, expect } from 'vitest';
import {
  construirContextoDotacion,
  responderConsultaLocalmente
} from '../src/services/dotacionCopilotService';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, SalaInfraestructura } from '../src/types';

describe('Servicio DotacionCopilotService', () => {
  const mockColegio: Establecimiento = {
    id: 'est-1',
    rbd: '3501',
    nombre: 'Escuela República de México',
    comuna: 'Chillán',
    regimen: 'JEC',
    porcentajePrioritarios: 85,
    asesorUatp: 'Asesor UATP'
  };

  const mockSalas: SalaInfraestructura[] = [
    {
      id: 'sala-1',
      rbd: '3501',
      nombreSala: 'Sala 1',
      superficieM2: 50,
      tipo: 'REGULAR',
      aforoMaximo: 45
    }
  ];

  const mockCursos: CursoSae[] = [
    {
      id: 'c-1',
      rbd: '3501',
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      periodo: 2026,
      regimenProporcion: '60_40'
    },
    {
      id: 'c-2',
      rbd: '3501',
      nivel: '2° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 28,
      periodo: 2026,
      regimenProporcion: '60_40'
    }
  ];

  const mockDocentes: Docente[] = [
    {
      id: 'doc-1',
      rbd: '3501',
      run: '11.111.111-1',
      nombres: 'María',
      apellidos: 'González',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      periodo: 2026,
      aplicaArticulo69: true
    },
    {
      id: 'doc-2',
      rbd: '3501',
      run: '22.222.222-2',
      nombres: 'Carlos',
      apellidos: 'Pérez',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSepContrata: 30,
      periodo: 2026
    }
  ];

  const mockAsignaciones: AsignacionHoraria[] = [
    {
      id: 'asig-1',
      rbd: '3501',
      cursoId: 'c-1',
      docenteId: 'doc-1',
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 8,
      periodo: 2026
    },
    {
      id: 'asig-2',
      rbd: '3501',
      cursoId: 'c-2',
      docenteId: 'doc-1',
      asignatura: 'Matemática',
      horasPedagogicasAula: 8,
      periodo: 2026
    }
  ];

  const mockDocentesTerritorio: Docente[] = [
    ...mockDocentes,
    {
      id: 'doc-1-otro-colegio',
      rbd: '3502',
      run: '11111111-1', // Mismo RUT con formato distinto
      nombres: 'María',
      apellidos: 'González',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 10,
      periodo: 2026
    }
  ];

  const mockColegiosTerritorio: Establecimiento[] = [
    mockColegio,
    {
      id: 'est-2',
      rbd: '3502',
      nombre: 'Liceo Bicentenario San Nicolás',
      comuna: 'San Nicolás',
      regimen: 'JEC',
      porcentajePrioritarios: 75
    }
  ];

  it('construye el contexto de dotación completo correctamente', () => {
    const ctx = construirContextoDotacion(
      mockColegio,
      2026,
      mockSalas,
      mockCursos,
      mockDocentes,
      mockAsignaciones,
      mockDocentesTerritorio,
      mockColegiosTerritorio
    );

    expect(ctx.establecimiento.nombre).toBe('Escuela República de México');
    expect(ctx.cursos.length).toBe(2);
    expect(ctx.docentes.length).toBe(2);
    expect(ctx.diagnostico).toBeDefined();
    expect(ctx.resumenTexto).toContain('Escuela República de México');
    expect(ctx.resumenTexto).toContain('BALANZA DE HORAS Y DIAGNÓSTICO DOCENTE');

    // Debe detectar que María González tiene contrato en 3501 (44h) y 3502 (10h) = 54h (Infracción > 44h)
    expect(ctx.docentesMultiEscuela.length).toBe(1);
    expect(ctx.docentesMultiEscuela[0].horasTotales).toBe(54);
    expect(ctx.docentesMultiEscuela[0].esInfractor44h).toBe(true);
  });

  it('responde consultas locales de balanza y déficit', () => {
    const ctx = construirContextoDotacion(
      mockColegio,
      2026,
      mockSalas,
      mockCursos,
      mockDocentes,
      mockAsignaciones,
      mockDocentesTerritorio,
      mockColegiosTerritorio
    );

    const respuesta = responderConsultaLocalmente('¿Cuál es el balance y déficit de horas?', ctx);
    expect(respuesta).toContain('Diagnóstico de Balanza');
    expect(respuesta).toContain('Demanda Curricular Total');
  });

  it('responde consultas locales sobre docentes multi-colegio y tope 44h', () => {
    const ctx = construirContextoDotacion(
      mockColegio,
      2026,
      mockSalas,
      mockCursos,
      mockDocentes,
      mockAsignaciones,
      mockDocentesTerritorio,
      mockColegiosTerritorio
    );

    const respuesta = responderConsultaLocalmente('¿Hay profesores compartidos con otras escuelas del SLEP?', ctx);
    expect(respuesta).toContain('Docentes con Asignación en Múltiples Establecimientos');
    expect(respuesta).toContain('54 hrs');
    expect(respuesta).toContain('tope legal de 44 hrs');
  });

  it('responde consultas locales sobre Artículo 69', () => {
    const ctx = construirContextoDotacion(
      mockColegio,
      2026,
      mockSalas,
      mockCursos,
      mockDocentes,
      mockAsignaciones,
      mockDocentesTerritorio,
      mockColegiosTerritorio
    );

    const respuesta = responderConsultaLocalmente('¿Qué docentes tienen beneficio de Artículo 69?', ctx);
    expect(respuesta).toContain('Artículo 69');
    expect(respuesta).toContain('María González');
  });

  it('responde consultas locales sobre fondos SEP y financiamiento', () => {
    const ctx = construirContextoDotacion(
      mockColegio,
      2026,
      mockSalas,
      mockCursos,
      mockDocentes,
      mockAsignaciones,
      mockDocentesTerritorio,
      mockColegiosTerritorio
    );

    const respuesta = responderConsultaLocalmente('Mostrar desglose de financiamiento SEP y Subvención General', ctx);
    expect(respuesta).toContain('Desglose Financiero de la Dotación');
    expect(respuesta).toContain('Subvención General');
    expect(respuesta).toContain('Ley SEP');
  });

  it('responde consultas sobre matrícula y cursos', () => {
    const ctx = construirContextoDotacion(
      mockColegio,
      2026,
      mockSalas,
      mockCursos,
      mockDocentes,
      mockAsignaciones,
      mockDocentesTerritorio,
      mockColegiosTerritorio
    );

    const respuesta = responderConsultaLocalmente('¿Cuál es la matrícula y los cupos SAE?', ctx);
    expect(respuesta).toContain('Matrícula y Oferta Educativa');
    expect(respuesta).toContain('58 alumnos');
    expect(respuesta).toContain('70 cupos');
  });
});
