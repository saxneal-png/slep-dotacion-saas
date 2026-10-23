import { describe, it, expect } from 'vitest';
import {
  calcularAforoFisicoSala,
  evaluarCapacidadSaeYInfraestructura
} from '../src/capacidadSae';

describe('Capacidad de Infraestructura y Cruce con SAE (Decreto 548)', () => {
  it('calcula aforo físico estándar a 1.1 m² por estudiante', () => {
    const res = calcularAforoFisicoSala(45, 'REGULAR');
    expect(res.aforoMaximo).toBe(40); // 45 / 1.1 = 40.9 -> 40 alumnos
    expect(res.factorM2).toBe(1.1);
  });

  it('calcula aforo de educación parvularia a 1.5 m² por estudiante', () => {
    const res = calcularAforoFisicoSala(45, 'PARVULARIA');
    expect(res.aforoMaximo).toBe(30); // 45 / 1.5 = 30 alumnos
    expect(res.factorM2).toBe(1.5);
  });

  it('detecta alerta de hacinamiento físico cuando la matrícula excede el aforo normativo', () => {
    const sala = {
      id: 'sala-1',
      rbd: '1234',
      nombreSala: 'Sala 1',
      superficieM2: 33 // 33 / 1.1 = 30 alumnos max
    };

    const evaluacion = evaluarCapacidadSaeYInfraestructura('1° Básico A', sala, 35, 33);
    expect(evaluacion.aforoMaximoFisico).toBe(30);
    expect(evaluacion.estadoAforo).toBe('ALERTA_SOBRECUPO_FISICO');
    expect(evaluacion.observaciones.some(o => o.includes('Hacinamiento Físico'))).toBe(true);
  });

  it('detecta inconsistencia cuando los cupos SAE declarados superan el espacio físico', () => {
    const sala = {
      id: 'sala-2',
      rbd: '1234',
      nombreSala: 'Sala 2',
      superficieM2: 35 // 35 / 1.1 = 31 alumnos
    };

    const evaluacion = evaluarCapacidadSaeYInfraestructura('3° Medio B', sala, 40, 30);
    expect(evaluacion.observaciones.some(o => o.includes('Inconsistencia SAE vs Infraestructura'))).toBe(true);
  });

  it('aplica tope normativo para aulas combinadas multigrado (máx 15 para 1°-6° o 3+ cursos)', () => {
    const sala = {
      id: 'sala-rural',
      rbd: '5678',
      nombreSala: 'Sala Multigrado Grande',
      superficieM2: 55 // Superficie física permitiría 50 alumnos (55 / 1.1)
    };

    const evaluacion = evaluarCapacidadSaeYInfraestructura('Multigrado 1° a 6° Básico', sala, 20, 18);
    // El aforo máximo debe estar topado normativamente a 15 alumnos
    expect(evaluacion.aforoMaximoFisico).toBe(15);
    expect(evaluacion.estadoAforo).toBe('ALERTA_SOBRECUPO_FISICO');
    expect(evaluacion.observaciones.some(o => o.includes('tope normativo de la modalidad: 15 alumnos'))).toBe(true);
  });

  it('aplica tope normativo para escuelas especiales (Decreto 170 / Decreto 83)', () => {
    const sala = {
      id: 'sala-especial',
      rbd: '9999',
      nombreSala: 'Sala Especial Trastornos Auditivos',
      superficieM2: 40
    };

    const evaluacion = evaluarCapacidadSaeYInfraestructura('Educación Especial Discapacidad Auditiva', sala, 10, 9);
    // Máx 8 alumnos para discapacidad auditiva
    expect(evaluacion.aforoMaximoFisico).toBe(8);
    expect(evaluacion.estadoAforo).toBe('ALERTA_SOBRECUPO_FISICO');
  });
});
