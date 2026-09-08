import { describe, it, expect } from 'vitest';
import {
  calcularEstadisticasColegio,
  calcularEstadisticasTerritoriales
} from '../src/services/estadisticasHorasService';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria } from '../src/types';

describe('Servicio Estadístico de Horas (Aula, Proporciones, Recreos, SEP, PIE)', () => {
  const mockColegio: Establecimiento = {
    id: 'est-1234',
    rbd: '1234',
    nombre: 'Escuela Rural Los Héroes',
    comuna: 'Bulnes',
    regimen: 'JEC',
    porcentajePrioritarios: 85 // Régimen 60/40
  };

  const mockCursos: CursoSae[] = [
    {
      id: 'c-1',
      rbd: '1234',
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 28,
      alumnosNeet: 5,
      alumnosNeep: 2
    }
  ];

  const mockDocentes: Docente[] = [
    {
      id: 'd-1',
      rbd: '1234',
      run: '11.111.111-1',
      nombres: 'Juan',
      apellidos: 'Pérez',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 30,
      horasSepTitular: 14,
      horasTallerSep: 0,
      horasTrabajoColaborativo: 2
    },
    {
      id: 'd-2',
      rbd: '1234',
      run: '22.222.222-2',
      nombres: 'María',
      apellidos: 'González',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 30,
      horasPieContrata: 30,
      horasDirectivas: 0
    }
  ];

  const mockAsignaciones: AsignacionHoraria[] = [
    {
      id: 'a-1',
      rbd: '1234',
      cursoId: 'c-1',
      docenteId: 'd-1',
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 8
    },
    {
      id: 'a-2',
      rbd: '1234',
      cursoId: 'c-1',
      docenteId: 'd-2',
      esCoDocencia: true,
      tipoApoyo: 'Co-Docencia en Aula Regular',
      asignatura: 'Apoyo PIE Lenguaje',
      horasPedagogicasAula: 6
    }
  ];

  it('calcula correctamente las estadísticas intra-escuela con desglose exacto', () => {
    const stats = calcularEstadisticasColegio(
      mockColegio,
      mockCursos,
      mockDocentes,
      mockAsignaciones
    );

    expect(stats.rbd).toBe('1234');
    expect(stats.regimenProporcion).toBe('60/40');
    expect(stats.horasContratoTotal).toBe(74); // 44 + 30
    expect(stats.horasAulaPedagogicasAsignadas).toBe(8); // solo regular de d-1
    expect(stats.horasCoDocencia).toBe(6); // co-docencia de d-2
    expect(stats.horasTrabajoColaborativo).toBe(2);
    expect(stats.financiamiento.sepTitular).toBe(14);
    expect(stats.financiamiento.pieContrata).toBe(30);
    expect(stats.financiamiento.subvencionGeneralTitular).toBe(30);
    expect(stats.horasNoLectivasCalculadas).toBeGreaterThan(0);
    expect(stats.horasRecreoCalculadas).toBeGreaterThan(0);
    expect(stats.desgloseDocentes.length).toBe(2);
  });

  it('calcula correctamente las estadísticas territoriales agregadas', () => {
    const statsTerr = calcularEstadisticasTerritoriales(
      [mockColegio],
      mockCursos,
      mockDocentes,
      mockAsignaciones
    );

    expect(statsTerr.totalEstablecimientos).toBe(1);
    expect(statsTerr.totalDocentesPlanta).toBe(2);
    expect(statsTerr.horasContratoTotal).toBe(74);
    expect(statsTerr.porComuna['Bulnes']).toBeDefined();
    expect(statsTerr.porComuna['Bulnes'].colegiosCount).toBe(1);
    expect(statsTerr.porComuna['Bulnes'].horasContrato).toBe(74);
  });
});
