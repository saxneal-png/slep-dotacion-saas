import { describe, it, expect } from 'vitest';
import { 
  buscarContratoMinimoPorTabla, 
  calcularAuditoriaDocenteMultitramo 
} from '../src';

describe('Motor MINEDUC - B�squeda Inversa y Auditoría Multitramo', () => {
  it('buscarContratoMinimoPorTabla encuentra la jornada correcta según tramos oficiales', () => {
    expect(buscarContratoMinimoPorTabla(0, '65_35')).toBe(0);
    expect(buscarContratoMinimoPorTabla(1, '65_35')).toBe(1);
    expect(buscarContratoMinimoPorTabla(28, '65_35')).toBe(32);
    expect(buscarContratoMinimoPorTabla(38, '65_35')).toBe(44);
    expect(buscarContratoMinimoPorTabla(20, '65_35')).toBe(23);

    expect(buscarContratoMinimoPorTabla(10, '60_40')).toBe(12);
    expect(buscarContratoMinimoPorTabla(15, '60_40')).toBe(19);
    expect(buscarContratoMinimoPorTabla(35, '60_40')).toBe(44);
  });

  it('audita caso regular puro con holgura (Andrea González)', () => {
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 28,
      horasAula60_40: 0,
      horasPieSepCronologicas: 0,
      horasContratoReal: 44
    });

    expect(res.req65_35).toBe(32);
    expect(res.req60_40).toBe(0);
    expect(res.contratoCalculadoTotal).toBe(32);
    expect(res.saldoHoras).toBe(12);
    expect(res.estadoSaldo).toBe('HOLGURA');
    expect(res.esInfractorExcesoLectivo).toBe(false);
    expect(res.minutosLectivosAula).toBe(28 * 45);
  });

  it('audita caso mixto coexistente 65/35 + 60/40 + PIE (Carlos Rojas)', () => {
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 20,
      horasAula60_40: 10,
      horasPieSepCronologicas: 4,
      horasContratoReal: 44
    });

    expect(res.req65_35).toBe(23);
    expect(res.req60_40).toBe(12);
    expect(res.horasPieSep).toBe(4);
    expect(res.contratoCalculadoTotal).toBe(39); // 23 + 12 + 4
    expect(res.contratoRegularBase).toBe(40); // 44 - 4
    expect(res.contratoPonderado65_35).toBe(26);
    expect(res.contratoPonderado60_40).toBe(14);
    expect(res.saldoHoras).toBe(5); // 44 - 39
    expect(res.estadoSaldo).toBe('HOLGURA');
    expect(res.esInfractorExcesoLectivo).toBe(false);
    expect(res.minutosRecreoTotal).toBeGreaterThan(0);
    expect(res.minutosHnlPlanificacion40).toBeGreaterThan(0);
  });

  it('audita caso con déficit contractual (María Vargas)', () => {
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 0,
      horasAula60_40: 15,
      horasPieSepCronologicas: 2,
      horasContratoReal: 20
    });

    expect(res.req60_40).toBe(19);
    expect(res.contratoCalculadoTotal).toBe(21);
    expect(res.saldoHoras).toBe(-1);
    expect(res.estadoSaldo).toBe('DEFICIT');
  });

  it('detecta infracción legal por exceso lectivo (35 HA en 40h contrato)', () => {
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 35,
      horasAula60_40: 0,
      horasPieSepCronologicas: 0,
      horasContratoReal: 40
    });

    expect(res.esInfractorExcesoLectivo).toBe(true);
    expect(res.porcentajeLectivoReal).toBe(65.6);
    expect(res.porcentajeLimitePonderado).toBe(65.0);
  });

  it('resuelve correctamente la fila inferior ante horas lectivas duplicadas (ej. 35 HA -> 40h contrato)', () => {
    // 35 HA en 65/35 existe en 40h (26h15m / 2h44m / 11h01m) y 41h (26h15m / 2h48m / 11h57m)
    // El motor debe resolver a la fila inferior (40h)
    const contratoMin = buscarContratoMinimoPorTabla(35, '65_35');
    expect(contratoMin).toBe(40);
  });

  it('calcula horas vacantes considerando horas no aula institucionales (directivas/UTP)', () => {
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 20, // req: 23h
      horasAula60_40: 0,
      horasPieSepCronologicas: 4,
      horasNoAulaInstitucionales: 6, // UTP / Jefatura No Aula
      horasContratoReal: 44
    });

    expect(res.req65_35).toBe(23);
    expect(res.horasPieSep).toBe(4);
    expect(res.horasNoAula).toBe(6);
    // 23 + 4 + 6 = 33
    expect(res.contratoCalculadoTotal).toBe(33);
    // Vacantes: 44 - 33 = 11
    expect(res.saldoHoras).toBe(11);
    expect(res.horasVacantes).toBe(11);
    expect(res.estadoSaldo).toBe('HOLGURA');
  });
});
