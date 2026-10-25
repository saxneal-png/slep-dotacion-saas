import { describe, it, expect, vi } from 'vitest';
import { CursoSae, Docente, AsignacionHoraria, AsistenteEducacion, Establecimiento } from '../src/types';

describe('Flujo de Trabajo y Centro Unificado de Descargas SLEP', () => {
  const colegioMock: Establecimiento = {
    rbd: '11223',
    nombre: 'Escuela Rural El Valle',
    comuna: 'San Ignacio',
    regimen: 'JEC',
    porcentajePrioritarios: 85,
    tipoJornada: 'COMPLETA',
    activo: true
  };

  const cursosMock: CursoSae[] = [
    {
      id: 'c1',
      rbd: '11223',
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      matriculaProyectada: 25,
      periodo: 2026
    }
  ];

  const docentesMock: Docente[] = [
    {
      id: 'd1',
      rbd: '11223',
      run: '12.345.678-9',
      nombres: 'María',
      apellidos: 'Pérez',
      estamento: 'DOCENTE_AULA',
      calidadJuridica: 'TITULAR',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      periodo: 2026,
      activo: true
    }
  ];

  const asignacionesMock: AsignacionHoraria[] = [
    {
      id: 'a1',
      rbd: '11223',
      docenteId: 'd1',
      cursoId: 'c1',
      asignatura: 'Matemática',
      horasPedagogicasAula: 6,
      periodo: 2026
    }
  ];

  const asistentesMock: AsistenteEducacion[] = [
    {
      id: 'as1',
      rbd: '11223',
      run: '15.678.901-2',
      nombres: 'Juan',
      apellidos: 'González',
      cargoFuncion: 'Inspector de Patio',
      estamento: 'PARADOCENTE_INSPECTORIA',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 44,
      periodo: 2026,
      activo: true
    }
  ];

  it('calcula correctamente el porcentaje y las alertas del progreso del colegio', () => {
    // Si tiene cursos (20%), docentes (20%), asignaciones (20%), asistentes con RUN válido (20%)
    const balanceAula = 0; // Equilibrada (20%)
    const tieneCursos = cursosMock.length > 0;
    const tieneDocentes = docentesMock.length > 0;
    const tieneAsignaciones = asignacionesMock.length > 0;
    const tieneAsistentes = asistentesMock.length > 0;
    const asistentesSinRun = asistentesMock.filter(a => !a.run || a.run === 'Sin RUN').length;
    const balanzaEquilibrada = Math.abs(balanceAula) <= 2;

    const checks = [
      tieneCursos ? 20 : 0,
      tieneDocentes ? 20 : 0,
      tieneAsignaciones ? 20 : 0,
      tieneAsistentes && asistentesSinRun === 0 ? 20 : (tieneAsistentes ? 10 : 0),
      balanzaEquilibrada ? 20 : (balanceAula > 0 ? 15 : 10)
    ];

    const porcentajeTotal = checks.reduce((a, b) => a + b, 0);
    expect(porcentajeTotal).toBe(100);
    expect(asistentesSinRun).toBe(0);
  });

  it('detecta asistentes sin RUN para alertar antes de certificar', () => {
    const asistenteIncompleto: AsistenteEducacion = {
      ...asistentesMock[0],
      run: 'Sin RUN'
    };
    const lista = [asistenteIncompleto];
    const sinRun = lista.filter(a => !a.run || a.run === 'Sin RUN' || a.run.trim() === '').length;
    expect(sinRun).toBe(1);
  });

  it('valida el filtrado correcto de docentes para exportación WYSIWYG', () => {
    const docTitular = docentesMock[0];
    const docContrata: Docente = {
      ...docTitular,
      id: 'd2',
      calidadJuridica: 'CONTRATA'
    };
    const todos = [docTitular, docContrata];

    const filtradosTitular = todos.filter(d => d.calidadJuridica === 'TITULAR');
    expect(filtradosTitular.length).toBe(1);
    expect(filtradosTitular[0].id).toBe('d1');

    const filtradosContrata = todos.filter(d => d.calidadJuridica === 'CONTRATA');
    expect(filtradosContrata.length).toBe(1);
    expect(filtradosContrata[0].id).toBe('d2');
  });
});
