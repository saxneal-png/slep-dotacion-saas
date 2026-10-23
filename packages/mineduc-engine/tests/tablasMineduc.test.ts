import { describe, it, expect } from 'vitest';
import { MAPA_MINEDUC_65_35, MAPA_MINEDUC_60_40, parseHHMMToMinutes } from '../src/tablasMineduc';
import { calcularJornadaMinutos, formatMinutosAHorasTexto, obtenerTramoMineduc, determinarRegimenNormativo } from '../src/calculoJornada';

describe('Motor Core MINEDUC - Tablas Oficiales e Inmutabilidad', () => {
  it('debe tener registradas las 44 tramos contractuales en el régimen 65/35', () => {
    expect(MAPA_MINEDUC_65_35.size).toBe(44);
  });

  it('debe tener registradas las 44 tramos contractuales en el régimen 60/40', () => {
    expect(MAPA_MINEDUC_60_40.size).toBe(44);
  });

  it('debe mantener inmutables las entradas de la tabla MINEDUC', () => {
    const tramo44 = MAPA_MINEDUC_65_35.get(44);
    expect(tramo44).toBeDefined();
    if (tramo44) {
      expect(Object.isFrozen(tramo44)).toBe(true);
      expect(() => {
        (tramo44 as any).lectivasHorasPedagogicas = 99;
      }).toThrow();
    }
  });

  it('debe calcular exactamente los minutos para 44 horas (2.640 min totales, 1.710 min lectivos, 180 min recreo, 750 min no lectivos)', () => {
    const tramo = obtenerTramoMineduc(44, '65_35');
    expect(tramo).toBeDefined();
    expect(tramo?.contratoMinutosTotales).toBe(2640);
    expect(tramo?.lectivasHorasPedagogicas).toBe(38);
    expect(tramo?.lectivasMinutosCronologicos).toBe(1710); // 38 * 45
    expect(tramo?.recreoMinutosCronologicos).toBe(180);  // 3h 0m
    expect(tramo?.noLectivasMinutosCronologicos).toBe(750); // 12h 30m
    expect(tramo!.lectivasMinutosCronologicos + tramo!.recreoMinutosCronologicos + tramo!.noLectivasMinutosCronologicos).toBe(2640);
  });

  it('debe parsear correctamente cadenas de horas y minutos a minutos enteros', () => {
    expect(parseHHMMToMinutes('28 h 30 m')).toBe(1710);
    expect(parseHHMMToMinutes('3 h 0 m')).toBe(180);
    expect(parseHHMMToMinutes('12 h 30 m')).toBe(750);
    expect(parseHHMMToMinutes('0 h 45 m')).toBe(45);
    expect(parseHHMMToMinutes('0 h 4 m')).toBe(4);
  });
});

describe('Motor Core MINEDUC - Validación de los 44 tramos normativos (Discrepancia Cero)', () => {
  it('todos los tramos de 1 a 44 horas en 65/35 deben sumar exactamente el total de minutos del contrato', () => {
    for (let h = 1; h <= 44; h++) {
      const tramo = MAPA_MINEDUC_65_35.get(h);
      expect(tramo).toBeDefined();
      const sumaMinutos = tramo!.lectivasMinutosCronologicos + tramo!.recreoMinutosCronologicos + tramo!.noLectivasMinutosCronologicos;
      expect(sumaMinutos).toBe(tramo!.contratoMinutosTotales);
      expect(tramo!.contratoMinutosTotales).toBe(h * 60);
    }
  });

  it('todos los tramos de 1 a 44 horas en 60/40 deben sumar exactamente el total de minutos del contrato', () => {
    for (let h = 1; h <= 44; h++) {
      const tramo = MAPA_MINEDUC_60_40.get(h);
      expect(tramo).toBeDefined();
      const sumaMinutos = tramo!.lectivasMinutosCronologicos + tramo!.recreoMinutosCronologicos + tramo!.noLectivasMinutosCronologicos;
      expect(sumaMinutos).toBe(tramo!.contratoMinutosTotales);
      expect(tramo!.contratoMinutosTotales).toBe(h * 60);
    }
  });
});

describe('Motor Core MINEDUC - Aritmética y Casos Borde de Jornada', () => {
  it('debe calcular correctamente un contrato de 44 hrs asignado al 100% de su capacidad lectiva (38 HA)', () => {
    const res = calcularJornadaMinutos(44, 38, '65_35');
    expect(res.minutosContratoTotales).toBe(2640);
    expect(res.minutosLectivosAsignados).toBe(1710);
    expect(res.minutosRecreoAsignados).toBe(180);
    expect(res.minutosNoLectivosCalculados).toBe(750);
    expect(res.minutosUsadosTotales).toBe(2640);
    expect(res.horasPedagogicasVacantes).toBe(0);
    expect(res.minutosLectivosVacantes).toBe(0);
    expect(res.esSobreasignado).toBe(false);
    expect(res.cumple65_35).toBe(true);
  });

  it('debe detectar sobreasignación si se asignan 39 HA en un contrato de 44 hrs', () => {
    const res = calcularJornadaMinutos(44, 39, '65_35');
    expect(res.esSobreasignado).toBe(true);
    expect(res.cumple65_35).toBe(false);
    expect(res.minutosSobreasignados).toBe(45); // 1 HA excedida = 45 minutos
  });

  it('debe calcular vacantes si un contrato de 30 hrs (26 HA max) tiene solo 15 HA asignadas', () => {
    const res = calcularJornadaMinutos(30, 15, '65_35');
    expect(res.esSobreasignado).toBe(false);
    expect(res.cumple65_35).toBe(true);
    expect(res.minutosLectivosAsignados).toBe(675); // 15 * 45
    expect(res.horasPedagogicasDisponiblesMax).toBe(26);
    expect(res.horasPedagogicasVacantes).toBe(11); // 26 - 15 = 11 HA vacantes
    expect(res.minutosLectivosVacantes).toBe(495); // 11 * 45 = 495 min
  });

  it('debe formatear minutos legibles', () => {
    expect(formatMinutosAHorasTexto(90)).toBe('1h 30m');
    expect(formatMinutosAHorasTexto(120)).toBe('2h');
    expect(formatMinutosAHorasTexto(0)).toBe('0h 0m');
  });

  it('debe calcular exactamente los 2.640 minutos contractuales bajo Artículo 69 (32 HA max)', () => {
    // 44h contrato, 32 HA asignadas con Artículo 69
    const res = calcularJornadaMinutos(44, 32, '65_35', true);
    expect(res.minutosContratoTotales).toBe(2640);
    expect(res.horasPedagogicasDisponiblesMax).toBe(32);
    expect(res.minutosLectivosDisponiblesMax).toBe(1440); // 32 * 45 = 24h cronológicas
    expect(res.minutosLectivosAsignados).toBe(1440);
    expect(res.esSobreasignado).toBe(false);
    expect(res.cumple65_35).toBe(true);
    // Recreo escalado y Tiempo No Lectivo deben sumar exactamente 2640 min
    expect(res.minutosUsadosTotales).toBe(2640);
    expect(res.minutosLectivosAsignados + res.minutosRecreoAsignados + res.minutosNoLectivosCalculados).toBe(2640);
  });

  it('determinarRegimenNormativo resuelve correctamente 60/40 para establecimientos vulnerables y primer ciclo', () => {
    // Establecimiento con 85% prioritarios -> 60/40 en todos los niveles
    expect(determinarRegimenNormativo(85, '5° Básico')).toBe('60_40');
    expect(determinarRegimenNormativo(80, false)).toBe('60_40');

    // Establecimiento con 65% prioritarios: 60/40 en NT1 a 4° Básico, 65/35 en niveles superiores
    expect(determinarRegimenNormativo(65, 'NT1')).toBe('60_40');
    expect(determinarRegimenNormativo(65, '2° Básico A')).toBe('60_40');
    expect(determinarRegimenNormativo(65, true)).toBe('60_40');
    expect(determinarRegimenNormativo(65, '5° Básico B')).toBe('65_35');
    expect(determinarRegimenNormativo(65, false)).toBe('65_35');

    // Establecimiento con 50% prioritarios -> 65/35
    expect(determinarRegimenNormativo(50, '1° Básico')).toBe('65_35');
  });
});
