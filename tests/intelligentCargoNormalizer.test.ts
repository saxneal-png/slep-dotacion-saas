import { describe, it, expect } from 'vitest';
import {
  normalizarCargoAsistenteInteligente,
  lemmatizeSpanishWord,
  sanitizeText,
  levenshteinDistance
} from '../src/services/analizador/intelligentCargoNormalizer';
import {
  generarMatrizLevantamientoEstablecimiento,
  clasificarFuncionLevantamientoHeuristica
} from '../src/services/analizador/asistentesLevantamientoRollup';
import { AsistenteEducacion } from '../src/types';

describe('Intelligent Cargo Normalizer & Typo Resilience Suite', () => {
  describe('Sanitización y Lematización en Español', () => {
    it('debe sanitizar puntuación y tildes correctamente', () => {
      expect(sanitizeText('Nochero.')).toBe('nochero');
      expect(sanitizeText('  NOCHERO / TURNO NOCHE - 44H  ')).toBe('nochero turno noche 44h');
      expect(sanitizeText('Psicólogo(a)')).toBe('psicologo a');
      expect(sanitizeText('Técnico en Párvulos...')).toBe('tecnico en parvulos');
    });

    it('debe lematizar plurales a singulares correctamente', () => {
      expect(lemmatizeSpanishWord('nocheros')).toBe('nochero');
      expect(lemmatizeSpanishWord('nocheras')).toBe('nochero');
      expect(lemmatizeSpanishWord('rondines')).toBe('rondin');
      expect(lemmatizeSpanishWord('inspectores')).toBe('inspector');
      expect(lemmatizeSpanishWord('inspectoras')).toBe('inspector');
      expect(lemmatizeSpanishWord('auxiliares')).toBe('auxiliar');
      expect(lemmatizeSpanishWord('choferes')).toBe('chofer');
      expect(lemmatizeSpanishWord('conductores')).toBe('conductor');
      expect(lemmatizeSpanishWord('parvulos')).toBe('parvulo');
      expect(lemmatizeSpanishWord('maestros')).toBe('maestro');
      expect(lemmatizeSpanishWord('psicologos')).toBe('psicologo');
      expect(lemmatizeSpanishWord('fonoaudiologos')).toBe('fonoaudiologo');
    });

    it('debe calcular distancia de Levenshtein para tolerancia a errores tipográficos', () => {
      expect(levenshteinDistance('nochero', 'nocherro')).toBe(1);
      expect(levenshteinDistance('psicologo', 'psicolgo')).toBe(1);
      expect(levenshteinDistance('parvulo', 'parbulo')).toBe(1);
    });
  });

  describe('Normalización Canónica de Nocheros / Nochero/A', () => {
    const variantesNochero = [
      'nochero',
      'nocheros',
      'Nochero',
      'NOCHERO',
      'NOCHEROS',
      'Nochero/A',
      'Nochero/a',
      'nochera',
      'nocheras',
      'Nochero.',
      'Rondín',
      'Rondin',
      'rondines',
      'Sereno',
      'serenos',
      'Cuidador nocturno',
      'Guardia nocturno'
    ];

    variantesNochero.forEach((variante) => {
      it(`debe reconocer y clasificar "${variante}" como Nochero/A (Nocheros)`, () => {
        const norm = normalizarCargoAsistenteInteligente(variante);
        expect(norm.cargoEstandar).toBe('NOCHERO/A');
        expect(norm.estamento).toBe('AUXILIAR');
        expect(norm.funcionLevantamiento).toBe('Nocheros');
        expect(norm.esAuxiliarServicio).toBe(true);

        const heuristica = clasificarFuncionLevantamientoHeuristica(variante);
        expect(heuristica.funcion).toBe('Nocheros');
      });
    });
  });

  describe('Normalización Canónica de Otras Funciones con Plurales y Variantes', () => {
    it('debe clasificar variantes de Diferencial al mismo cargo canónico', () => {
      const v1 = normalizarCargoAsistenteInteligente('ASISTENTE EDUCACION DIFERENCIAL');
      const v2 = normalizarCargoAsistenteInteligente('Asistente técnico de Educación Diferencial');
      const v3 = normalizarCargoAsistenteInteligente('técnicos diferenciales');

      expect(v1.funcionLevantamiento).toBe('Asistente técnico de Educación Diferencial');
      expect(v2.funcionLevantamiento).toBe('Asistente técnico de Educación Diferencial');
      expect(v3.funcionLevantamiento).toBe('Asistente técnico de Educación Diferencial');
      expect(v1.esEquipoPie).toBe(true);
    });

    it('debe clasificar variantes de Párvulo / Aula al mismo cargo canónico', () => {
      const v1 = normalizarCargoAsistenteInteligente('TECNICO EN PARVULOS');
      const v2 = normalizarCargoAsistenteInteligente('Asistente de párvulos');
      const v3 = normalizarCargoAsistenteInteligente('Técnico parvularia');

      expect(v1.funcionLevantamiento).toBe('Asistentes de aula');
      expect(v2.funcionLevantamiento).toBe('Asistentes de aula');
      expect(v3.funcionLevantamiento).toBe('Asistentes de aula');
      expect(v1.esTecnicoParvulo).toBe(true);
    });

    it('debe clasificar variantes de Inspectores al mismo cargo canónico', () => {
      const v1 = normalizarCargoAsistenteInteligente('INSPECTORES');
      const v2 = normalizarCargoAsistenteInteligente('Inspector de Patio');
      const v3 = normalizarCargoAsistenteInteligente('paradocentes');

      expect(v1.funcionLevantamiento).toBe('Inspectores');
      expect(v2.funcionLevantamiento).toBe('Inspectores');
      expect(v3.funcionLevantamiento).toBe('Inspectores');
      expect(v1.esInspectorPatio).toBe(true);
    });

    it('debe clasificar variantes de Choferes / Conductores al mismo cargo canónico', () => {
      const v1 = normalizarCargoAsistenteInteligente('Choferes');
      const v2 = normalizarCargoAsistenteInteligente('Conductor furgón escolar');

      expect(v1.funcionLevantamiento).toBe('Conductores Auxliar');
      expect(v2.funcionLevantamiento).toBe('Conductores Auxliar');
    });

    it('debe clasificar variantes de Maestros de mantención al mismo cargo canónico', () => {
      const v1 = normalizarCargoAsistenteInteligente('maestros');
      const v2 = normalizarCargoAsistenteInteligente('Gasfiter y mantención');

      expect(v1.funcionLevantamiento).toBe('Maestros');
      expect(v2.funcionLevantamiento).toBe('Maestros');
    });
  });

  describe('Agregación Exacta en la Matriz de Levantamiento (1 + 1 = 2)', () => {
    it('debe consolidar "nochero" y "nocheros" en 1 sola fila con 2 funcionarios y suma de horas', () => {
      const mockAsistentes: AsistenteEducacion[] = [
        {
          id: 'ast-1',
          rbd: '3543',
          run: '11.111.111-1',
          nombres: 'JUAN',
          apellidos: 'PEREZ',
          cargoFuncion: 'nochero',
          estamento: 'AUXILIAR',
          horasContrato: 44,
          horasSubvencionGeneralIndefinido: 44,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 0,
          horasSepPlazoFijo: 0,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 0,
        },
        {
          id: 'ast-2',
          rbd: '3543',
          run: '22.222.222-2',
          nombres: 'PEDRO',
          apellidos: 'GOMEZ',
          cargoFuncion: 'Nocheros',
          estamento: 'AUXILIAR',
          horasContrato: 44,
          horasSubvencionGeneralIndefinido: 44,
          horasSubvencionGeneralPlazoFijo: 0,
          horasSepIndefinido: 0,
          horasSepPlazoFijo: 0,
          horasPieIndefinido: 0,
          horasPiePlazoFijo: 0,
        },
      ];

      const matriz = generarMatrizLevantamientoEstablecimiento(
        mockAsistentes,
        '3543',
        'Liceo San Martín',
        'San Ignacio'
      );

      // Verificar la fila Nocheros
      const filaNochero = matriz.rows.find((r) => r.cargoFuncion === 'Nocheros');
      expect(filaNochero).toBeDefined();
      expect(filaNochero?.cantidadFuncionarios).toBe(2); // 1 + 1 = 2
      expect(filaNochero?.horasSubRegular).toBe(88); // 44 + 44 = 88
      expect(filaNochero?.totalHoras).toBe(88);

      // Total general
      expect(matriz.totalGeneral.cantidadFuncionarios).toBe(2);
      expect(matriz.totalGeneral.totalHoras).toBe(88);
    });
  });
});
