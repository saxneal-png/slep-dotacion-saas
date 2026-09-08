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

  it('detecta infracción legal por exceso lectivo real sobre tabla (36 HA en 40h contrato)', () => {
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 36, // excede las 35 HA oficiales de 40h
      horasAula60_40: 0,
      horasPieSepCronologicas: 0,
      horasContratoReal: 40
    });

    expect(res.esInfractorExcesoLectivo).toBe(true);
    expect(res.porcentajeLectivoReal).toBe(67.5);
    expect(res.porcentajeLimitePonderado).toBe(65.6);
  });

  it('audita caso de 32h en 65/35 con 28 HA (Ángela Vaccaro) y valida cumplimiento conforme a tabla oficial', () => {
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 28, // exactamente el tope oficial de 32h en tabla
      horasAula60_40: 0,
      horasPieCronologicas: 3, // 3h PIE
      horasContratoReal: 35    // 32h regular + 3h PIE
    });

    expect(res.req65_35).toBe(32);
    expect(res.horasPie).toBe(3);
    expect(res.contratoCalculadoTotal).toBe(35);
    expect(res.contratoRegularBase).toBe(32);
    expect(res.saldoHoras).toBe(0);
    expect(res.estadoSaldo).toBe('EXACTO');
    expect(res.esInfractorExcesoLectivo).toBe(false); // CUMPLE legalmente
    expect(res.minutosLectivosAula).toBe(28 * 45); // 1260 mins
    expect(res.minutosLimitePermitido).toBe(1260); // 1260 mins según tabla
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

  it('audita correctamente docente con 31h Subv + 5h SEP + 3h PIE (total 39h) y 27 HA', () => {
    // Caso real: 27 HA aula regular en 65/35, 3h PIE (trabajo colaborativo), 5h SEP para docencia (afecta a 65/35)
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 27, // req: 31h
      horasAula60_40: 0,
      horasPieCronologicas: 3, // Solo 3h PIE
      horasTallerSepExento: 0, // Las 5h SEP financian aula regular
      horasContratoReal: 39
    });

    expect(res.req65_35).toBe(31);
    expect(res.horasPie).toBe(3);
    expect(res.horasTallerSep).toBe(0);
    expect(res.contratoCalculadoTotal).toBe(34); // 31 + 3 = 34h
    expect(res.contratoRegularBase).toBe(36); // 39 - 3 = 36h base regular para 65/35
    expect(res.contratoPonderado65_35).toBe(36);
    expect(res.saldoHoras).toBe(5); // 39 - 34 = 5h
    expect(res.horasVacantes).toBe(5);
    expect(res.estadoSaldo).toBe('HOLGURA');
    // 27 HA (20h 15m) en 36h base es 56.3% <= 65% legal -> CUMPLE sin infracción
    expect(res.esInfractorExcesoLectivo).toBe(false);
    expect(res.porcentajeLectivoReal).toBe(56.3);
    expect(res.porcentajeLimitePonderado).toBe(64.6);
  });

  it('audita correctamente docente con 37h Subv + 2h SEP Taller + 3h PIE (total 42h) y 32 HA aula', () => {
    // Caso real: 32 HA aula regular en 65/35 (req 37h), 2h SEP taller extraprogramático, 3h PIE trabajo colaborativo
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 32, // req: 37h
      horasAula60_40: 0,
      horasPieCronologicas: 3, // 3h PIE colaborativo
      horasTallerSepExento: 2, // 2h SEP taller extraprogramático
      horasContratoReal: 42
    });

    expect(res.req65_35).toBe(37);
    expect(res.horasPie).toBe(3);
    expect(res.horasTallerSep).toBe(2);
    expect(res.contratoCalculadoTotal).toBe(42); // 37 + 3 + 2 = 42h
    expect(res.contratoRegularBase).toBe(37); // 42 - 3 - 2 = 37h base regular
    expect(res.contratoPonderado65_35).toBe(37);
    expect(res.saldoHoras).toBe(0); // Exacto
    expect(res.horasVacantes).toBe(0); // 0 vacantes
    expect(res.estadoSaldo).toBe('EXACTO');
    expect(res.esInfractorExcesoLectivo).toBe(false);
    expect(res.minutosLectivosAula).toBe(32 * 45); // 1440 mins
    expect(res.minutosLimitePermitido).toBe(1440); // 1440 mins según tabla oficial de 37h
  });

  it('audita caso real de Docente PIE 39h (11h apoyo aula + 28h coordinación PIE) con resultado EXACTO', () => {
    // Caso reportado: Docente PIE de 39h contrata, 11h apoyo co-docencia / colaboración en aula,
    // y 28h de Coordinadora PIE de primer ciclo (función no aula financiada con PIE).
    // El requerimiento debe ser exactamente 39h (no 67h).
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: 0, // No imparte aula regular (su apoyo es PIE)
      horasAula60_40: 0,
      horasPieCronologicas: 39, // 11h apoyo + 28h coordinación PIE cubiertas por su contrato PIE
      horasTallerSepExento: 0,
      horasNoAulaInstitucionales: 0, // La coordinación PIE ya está en horasPieCronologicas
      horasContratoReal: 39
    });

    expect(res.req65_35).toBe(0);
    expect(res.req60_40).toBe(0);
    expect(res.horasPie).toBe(39);
    expect(res.horasNoAula).toBe(0);
    expect(res.contratoCalculadoTotal).toBe(39);
    expect(res.contratoRealTotal).toBe(39);
    expect(res.saldoHoras).toBe(0);
    expect(res.horasVacantes).toBe(0);
    expect(res.estadoSaldo).toBe('EXACTO');
    expect(res.esInfractorExcesoLectivo).toBe(false);
  });

  it('audita caso mixto con proporción 60/40 y 65/35 por cursos (10 HA en 60/40 y 10 HA en 65/35)', () => {
    // Requerimiento exacto del usuario:
    // 10 horas en 60/40: 7h 30m lectivas cronológicas, 0h 49m recreo y 3h 41m no lectivo (12h contrato requeridas)
    // 10 horas en 65/35: 7h 30m lectivas cronológicas, 0h 45m recreo y 2h 45m no lectivo (11h contrato requeridas)
    // Suma: 20 horas aula, 15h 00m lectivas (900m), 1h 34m recreo (94m), 6h 26m no lectivo (386m) -> 23h contrato
    const res = calcularAuditoriaDocenteMultitramo({
      horasAula60_40: 10,
      horasAula65_35: 10,
      horasContratoReal: 23
    });

    // Detalle tramo 60/40
    expect(res.req60_40).toBe(12);
    expect(res.detalle60_40.jornada).toBe(12);
    expect(res.detalle60_40.lectivasMinutos).toBe(450); // 7h 30m
    expect(res.detalle60_40.lectivasTexto).toBe('7 h 30 m');
    expect(res.detalle60_40.recreoMinutos).toBe(49); // 0h 49m
    expect(res.detalle60_40.recreoTexto).toBe('0 h 49 m');
    expect(res.detalle60_40.hnlMinutos).toBe(221); // 3h 41m
    expect(res.detalle60_40.hnlTexto).toBe('3 h 41 m');

    // Detalle tramo 65/35
    expect(res.req65_35).toBe(11);
    expect(res.detalle65_35.jornada).toBe(11);
    expect(res.detalle65_35.lectivasMinutos).toBe(450); // 7h 30m
    expect(res.detalle65_35.lectivasTexto).toBe('7 h 30 m');
    expect(res.detalle65_35.recreoMinutos).toBe(45); // 0h 45m
    expect(res.detalle65_35.recreoTexto).toBe('0 h 45 m');
    expect(res.detalle65_35.hnlMinutos).toBe(165); // 2h 45m
    expect(res.detalle65_35.hnlTexto).toBe('2 h 45 m');

    // Totales sumados
    expect(res.contratoCalculadoTotal).toBe(23); // 12 + 11
    expect(res.minutosLectivosAula).toBe(900); // 20 HA * 45 = 900m (15h 00m)
    expect(res.minutosLectivosTablaTotal).toBe(900); // 450 + 450 = 900m (15h 00m)
    expect(res.minutosRecreoTotal).toBe(94); // 49 + 45 = 94m (1h 34m)
    expect(res.minutosHnlTotal).toBe(386); // 221 + 165 = 386m (6h 26m)
    expect(res.minutosHnlPlanificacion40).toBe(154); // 386 * 0.40 = 154m (2h 34m)
    expect(res.saldoHoras).toBe(0);
    expect(res.estadoSaldo).toBe('EXACTO');
    expect(res.esInfractorExcesoLectivo).toBe(false);
  });
});
