import { describe, it, expect } from 'vitest';
import {
  esFuncionTrabajoColaborativo,
  tieneFuncionesFueraDeAulaSinColaborativo
} from '../src/utils/docenteFiltrosUtils';
import type { Docente } from '../src/types';

function crearDocenteBase(overrides: Partial<Docente> = {}): Docente {
  return {
    id: 'doc-1',
    rbd: '3451',
    run: '12345678-9',
    nombres: 'María',
    apellidos: 'González',
    calidadJuridica: 'TITULAR',
    estamento: 'DOCENTE_AULA',
    horasContrato: 44,
    ...overrides
  };
}

describe('Filtro de Docentes con Funciones Fuera del Aula (sin Trabajo Colaborativo)', () => {
  it('incluye docentes con estamentos institucionales fuera de aula', () => {
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ estamento: 'DIRECTIVO' }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ estamento: 'TECNICO_PEDAGOGICO' }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ estamento: 'COORDINADOR_CRA' }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ estamento: 'OTRA_ESTABLECIMIENTO' }))).toBe(true);
  });

  it('incluye docentes de aula con funcionesNoAula distintas a trabajo colaborativo', () => {
    const doc = crearDocenteBase({
      estamento: 'DOCENTE_AULA',
      funcionesNoAula: [
        {
          id: 'f-1',
          tipo: 'COORDINACION',
          nombre: 'Coordinación UTP Primer Ciclo',
          horas: 8,
          financiamiento: 'SUBVENCION_GENERAL'
        }
      ]
    });

    expect(tieneFuncionesFueraDeAulaSinColaborativo(doc)).toBe(true);
  });

  it('incluye docentes con campos numéricos legados de funciones fuera de aula', () => {
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ horasDirectivas: 10 }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ horasInspectorGeneral: 20 }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ horasTecnicoPedagogicas: 15 }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ horasCoordinacion: 6 }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ horasCoordinacionPie: 4 }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ horasConvivenciaEscolar: 12 }))).toBe(true);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(crearDocenteBase({ horasExtraescolar: 4 }))).toBe(true);
  });

  it('excluye docentes que solo tienen horasTrabajoColaborativo o horasTallerSep', () => {
    const docSoloColab = crearDocenteBase({
      estamento: 'DOCENTE_AULA',
      horasTrabajoColaborativo: 3
    });
    const docDiferencialSoloColab = crearDocenteBase({
      estamento: 'DOCENTE_DIFERENCIAL',
      horasTrabajoColaborativo: 6
    });
    const docSoloTallerSep = crearDocenteBase({
      estamento: 'DOCENTE_AULA',
      horasTallerSep: 4
    });

    expect(tieneFuncionesFueraDeAulaSinColaborativo(docSoloColab)).toBe(false);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(docDiferencialSoloColab)).toBe(false);
    expect(tieneFuncionesFueraDeAulaSinColaborativo(docSoloTallerSep)).toBe(false);
  });

  it('excluye entradas en funcionesNoAula que correspondan únicamente a trabajo colaborativo', () => {
    expect(esFuncionTrabajoColaborativo('Trabajo Colaborativo Art. 86')).toBe(true);
    expect(esFuncionTrabajoColaborativo('Co-planificación PIE')).toBe(true);

    const doc = crearDocenteBase({
      funcionesNoAula: [
        {
          id: 'f-colab',
          tipo: 'OTRA',
          nombre: 'Trabajo Colaborativo PIE',
          horas: 3,
          financiamiento: 'PIE'
        }
      ]
    });

    expect(tieneFuncionesFueraDeAulaSinColaborativo(doc)).toBe(false);
  });

  it('incluye docentes que combinan trabajo colaborativo con otra función fuera de aula', () => {
    const docMixto = crearDocenteBase({
      horasTrabajoColaborativo: 3,
      funcionesNoAula: [
        {
          id: 'f-1',
          tipo: 'CONVIVENCIA',
          nombre: 'Encargado de Convivencia Escolar',
          horas: 10,
          financiamiento: 'SEP'
        }
      ]
    });

    expect(tieneFuncionesFueraDeAulaSinColaborativo(docMixto)).toBe(true);
  });
});
