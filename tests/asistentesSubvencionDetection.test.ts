import { describe, it, expect } from 'vitest';
import { parseAsistentesFromRows } from '../src/services/analizador/asistentesParser';

describe('Detección Certera de Columnas y Subvenciones de Asistentes', () => {
  it('debe detectar cabeceras de 2 niveles con celdas combinadas de Subvención General, SEP y PIE', () => {
    // Fila 0: Categoría superior combinada
    // Fila 1: Sub-cabeceras de contrato
    const mockRows = [
      ['RBD 3543 - Nómina Asistentes', '', '', '', 'SUBVENCIÓN GENERAL', '', 'SEP', '', 'PIE', ''],
      ['NOMBRES', 'RUT', 'CARGO', 'HORAS CONTRATO', 'INDEFINIDO', 'PLAZO FIJO', 'INDEFINIDO', 'PLAZO FIJO', 'INDEFINIDO', 'PLAZO FIJO', 'OBSERVACIONES'],
      ['JUAN PEREZ', '11.111.111-1', 'Nochero/A', '44', '44', '0', '0', '0', '0', '0', 'Turno Noche'],
      ['MARIA ROJAS', '22.222.222-2', 'Técnico en Párvulos', '44', '0', '0', '44', '0', '0', '0', 'Convenio SEP'],
      ['CARLOS VERA', '33.333.333-3', 'Fonoaudiólogo/a', '30', '0', '0', '0', '0', '10', '20', 'Equipo PIE'],
    ];

    const result = parseAsistentesFromRows(mockRows, '3543', 2026);
    expect(result.asistentes.length).toBe(3);

    // Juan Perez: Subvención General Indefinido 44h
    const juan = result.asistentes.find((a) => a.run === '11.111.111-1');
    expect(juan).toBeDefined();
    expect(juan?.horasSubvencionGeneralIndefinido).toBe(44);
    expect(juan?.horasSubvencionGeneralPlazoFijo).toBe(0);
    expect(juan?.horasSepIndefinido).toBe(0);
    expect(juan?.horasPieIndefinido).toBe(0);
    expect(juan?.horasContrato).toBe(44);

    // Maria Rojas: SEP Indefinido 44h
    const maria = result.asistentes.find((a) => a.run === '22.222.222-2');
    expect(maria).toBeDefined();
    expect(maria?.horasSubvencionGeneralIndefinido).toBe(0);
    expect(maria?.horasSepIndefinido).toBe(44);
    expect(maria?.horasPieIndefinido).toBe(0);
    expect(maria?.horasContrato).toBe(44);

    // Carlos Vera: PIE Indefinido 10h + PIE Plazo Fijo 20h = 30h
    const carlos = result.asistentes.find((a) => a.run === '33.333.333-3');
    expect(carlos).toBeDefined();
    expect(carlos?.horasPieIndefinido).toBe(10);
    expect(carlos?.horasPiePlazoFijo).toBe(20);
    expect(carlos?.horasSubvencionGeneralIndefinido).toBe(0);
    expect(carlos?.horasSepIndefinido).toBe(0);
    expect(carlos?.horasContrato).toBe(30);
  });

  it('debe detectar columnas unificadas de subvención (SUB REGULAR, SEP, PIE)', () => {
    const mockRows = [
      ['RUT', 'FUNCIONARIO', 'FUNCIÓN', 'TOTAL HORAS', 'SUB. REGULAR', 'HORAS SEP', 'HORAS PIE'],
      ['44.444.444-4', 'ANA GOMEZ', 'Asistente Social', '44', '20', '24', '0'],
      ['55.555.555-5', 'PEDRO SOTO', 'Psicólogo', '44', '0', '0', '44'],
    ];

    const result = parseAsistentesFromRows(mockRows, '3543', 2026);
    expect(result.asistentes.length).toBe(2);

    const ana = result.asistentes.find((a) => a.run === '44.444.444-4');
    expect(ana?.horasSubvencionGeneralIndefinido).toBe(20);
    expect(ana?.horasSepIndefinido).toBe(24);
    expect(ana?.horasPieIndefinido).toBe(0);
    expect(ana?.horasContrato).toBe(44);

    const pedro = result.asistentes.find((a) => a.run === '55.555.555-5');
    expect(pedro?.horasPieIndefinido).toBe(44);
    expect(pedro?.horasSubvencionGeneralIndefinido).toBe(0);
    expect(pedro?.horasSepIndefinido).toBe(0);
    expect(pedro?.horasContrato).toBe(44);
  });

  it('debe aplicar fallback contextual si las columnas de subvención están vacías pero la nota indica la fuente', () => {
    const mockRows = [
      ['RUT', 'FUNCIONARIO', 'CARGO', 'HORAS CONTRATO', 'SUB GENERAL', 'SEP', 'PIE', 'OBSERVACIONES'],
      ['66.666.666-6', 'DIEGO TAPIA', 'Terapeuta Ocupacional (PIE)', '30', '0', '0', '0', '30 hrs programa PIE'],
    ];

    const result = parseAsistentesFromRows(mockRows, '3543', 2026);
    const diego = result.asistentes.find((a) => a.run === '66.666.666-6');
    expect(diego).toBeDefined();
    expect(diego?.horasPieIndefinido).toBe(30);
    expect(diego?.horasContrato).toBe(30);
  });
});
