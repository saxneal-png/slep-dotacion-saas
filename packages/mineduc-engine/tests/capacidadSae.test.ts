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
});
