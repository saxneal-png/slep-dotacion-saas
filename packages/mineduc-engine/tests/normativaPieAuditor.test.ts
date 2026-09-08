import { describe, it, expect } from 'vitest';
import {
  calcularDemandaNormativaPieCurso,
  autoAsignarHorasPieCursos,
  hhmmToDec,
  decToHhmm
} from '../src/normativaPieAuditor';

describe('Motor Normativo PIE (Decreto 170 / Ord. 2398)', () => {
  it('convierte correctamente entre HH:MM y decimal', () => {
    expect(hhmmToDec('08:15')).toBe(8.25);
    expect(hhmmToDec('10:30')).toBe(10.5);
    expect(hhmmToDec('05:30')).toBe(5.5);
    expect(decToHhmm(8.25)).toBe('08:15');
    expect(decToHhmm(10.5)).toBe('10:30');
    expect(decToHhmm(5.5)).toBe('05:30');
  });

  it('calcula la demanda para curso con JEC y aforo completo estándar (5 NEET + 2 NEEP = 16h)', () => {
    const res = calcularDemandaNormativaPieCurso(5, 2, true);
    expect(res.horasTotalCronologicas).toBe(16);
    expect(res.horasDiferencialHHMM).toBe('10:30');
    expect(res.horasPaeHHMM).toBe('05:30');
    expect(res.horasDiferencialDecimal).toBe(10.5);
    expect(res.horasPaeDecimal).toBe(5.5);
    expect(res.horasTrabajoColaborativoCronologicas).toBe(3.0);
    expect(res.cumpleAforo).toBe(true);
  });

  it('calcula la demanda para curso SIN JEC y aforo completo estándar (5 NEET + 2 NEEP = 13h)', () => {
    const res = calcularDemandaNormativaPieCurso(5, 2, false);
    expect(res.horasTotalCronologicas).toBe(13);
    expect(res.horasDiferencialHHMM).toBe('09:00');
    expect(res.horasPaeHHMM).toBe('04:00');
    expect(res.horasDiferencialDecimal).toBe(9.0);
    expect(res.horasPaeDecimal).toBe(4.0);
    expect(res.cumpleAforo).toBe(true);
  });

  it('calcula la demanda para curso con solo NEET (5 NEET + 0 NEEP = 10h JEC / 7h Sin JEC)', () => {
    const resJec = calcularDemandaNormativaPieCurso(5, 0, true);
    expect(resJec.horasTotalCronologicas).toBe(10);
    expect(resJec.horasDiferencialHHMM).toBe('06:15');
    expect(resJec.horasPaeHHMM).toBe('03:45');

    const resSinJec = calcularDemandaNormativaPieCurso(5, 0, false);
    expect(resSinJec.horasTotalCronologicas).toBe(7);
    expect(resSinJec.horasDiferencialHHMM).toBe('04:30');
    expect(resSinJec.horasPaeHHMM).toBe('02:30');
  });

  it('detecta aforo excedido cuando hay más de 5 NEET o más de 2 NEEP', () => {
    const res = calcularDemandaNormativaPieCurso(6, 3, true);
    expect(res.cumpleAforo).toBe(false);
    expect(res.observacionNormativa).toContain('Aforo excedido');
  });

  it('realiza auto-asignación Jidoka cubriendo horas diferenciales y colaborativas', () => {
    const cursos = [
      { nombre: '1° Básico A', regimen: 'JEC', alumnos_neet: 5, alumnos_neep: 2 }
    ];
    const profesionales = [
      { run: '11.111.111-1', nombre: 'Edu Diferencial 1', tipo_profesional: 'Docente Diferencial' as const, horasContratadas: 20 },
      { run: '22.222.222-2', nombre: 'Fonoaudióloga 1', tipo_profesional: 'Profesional Asistente PAE' as const, horasContratadas: 10 },
      { run: '33.333.333-3', nombre: 'Docente Titular', tipo_profesional: 'Docente de Aula (Trabajo Colaborativo)' as const, horasContratadas: 44 }
    ];

    const balance = autoAsignarHorasPieCursos(cursos, profesionales);
    expect(balance.totalDemandaDiferencial).toBe(10.5);
    expect(balance.totalDemandaPae).toBe(5.5);
    expect(balance.totalDemandaTrabajoColaborativo).toBe(3.0);
    expect(balance.totalHorasAsignadasDiferencial).toBe(10.5);
    expect(balance.totalHorasAsignadasPae).toBe(5.5);
    expect(balance.totalHorasAsignadasColaborativo).toBe(3.0);
    expect(balance.cursosCubiertosAlCienPorciento).toBe(true);
  });
});
