import { describe, it, expect } from 'vitest';
import fs from 'fs';
import {
  normalizarEncabezadoCurso,
  extraerHorasCelda,
  normalizarRut,
  separarNombresApellidos,
  parseMatrizExcel
} from '../src/services/excelMatrixParserService';

describe('excelMatrixParserService', () => {
  describe('normalizarEncabezadoCurso', () => {
    it('normaliza niveles de párvulo', () => {
      expect(normalizarEncabezadoCurso('NT1')).toEqual({
        nivel: 'Pre-Kínder',
        letra: 'A',
        regimen: 'No JEC',
        esMultigrado: false
      });
      expect(normalizarEncabezadoCurso('Pk A')).toEqual({
        nivel: 'Pre-Kínder',
        letra: 'A',
        regimen: 'No JEC',
        esMultigrado: false
      });
      expect(normalizarEncabezadoCurso('NT2')).toEqual({
        nivel: 'Kínder',
        letra: 'A',
        regimen: 'No JEC',
        esMultigrado: false
      });
      expect(normalizarEncabezadoCurso('KB')).toEqual({
        nivel: 'Kínder',
        letra: 'B',
        regimen: 'No JEC',
        esMultigrado: false
      });
    });

    it('normaliza niveles de básica con palabra Básico y abreviados', () => {
      expect(normalizarEncabezadoCurso('1° BÁSICO')).toEqual({
        nivel: '1° Básico',
        letra: 'A',
        regimen: 'JEC',
        esMultigrado: false
      });
      expect(normalizarEncabezadoCurso('4°A')).toEqual({
        nivel: '4° Básico',
        letra: 'A',
        regimen: 'JEC',
        esMultigrado: false
      });
      expect(normalizarEncabezadoCurso('8°B')).toEqual({
        nivel: '8° Básico',
        letra: 'B',
        regimen: 'JEC',
        esMultigrado: false
      });
      expect(normalizarEncabezadoCurso('1B')).toEqual({
        nivel: '1° Básico',
        letra: 'B',
        regimen: 'JEC',
        esMultigrado: false
      });
    });

    it('normaliza niveles de media', () => {
      expect(normalizarEncabezadoCurso('1°MA')).toEqual({
        nivel: '1° Medio',
        letra: 'A',
        regimen: 'JEC',
        esMultigrado: false
      });
      expect(normalizarEncabezadoCurso('4°MB')).toEqual({
        nivel: '4° Medio',
        letra: 'B',
        regimen: 'JEC',
        esMultigrado: false
      });
    });

    it('normaliza cursos multigrado y laborales', () => {
      expect(normalizarEncabezadoCurso('NT1-NT2')).toEqual({
        nivel: 'Multigrado NT1-NT2',
        letra: 'U',
        regimen: 'No JEC',
        esMultigrado: true
      });
      expect(normalizarEncabezadoCurso('LABORAL 1')).toEqual({
        nivel: 'Laboral 1',
        letra: 'U',
        regimen: 'No JEC',
        esMultigrado: false
      });
    });

    it('descarta encabezados de control y metadatos', () => {
      expect(normalizarEncabezadoCurso('NOMBRES')).toBeNull();
      expect(normalizarEncabezadoCurso('RUN')).toBeNull();
      expect(normalizarEncabezadoCurso('HORAS CONTRATO')).toBeNull();
      expect(normalizarEncabezadoCurso('TITULARES SUB GRAL')).toBeNull();
      expect(normalizarEncabezadoCurso('TOTAL HA*')).toBeNull();
      expect(normalizarEncabezadoCurso('OBSERVACIONES')).toBeNull();
    });
  });

  describe('extraerHorasCelda', () => {
    it('extrae números directos y decimales', () => {
      expect(extraerHorasCelda(30)).toBe(30);
      expect(extraerHorasCelda(44.5)).toBe(44.5);
      expect(extraerHorasCelda('10,5')).toBe(10.5);
      expect(extraerHorasCelda('38 hrs')).toBe(38);
    });

    it('maneja strings de tiempo hh:mm', () => {
      expect(extraerHorasCelda('10:30')).toBe(10.5);
      expect(extraerHorasCelda('0:45')).toBe(0.75);
    });

    it('maneja objetos y celdas vacías', () => {
      expect(extraerHorasCelda(null)).toBe(0);
      expect(extraerHorasCelda(undefined)).toBe(0);
      expect(extraerHorasCelda({ result: 24 })).toBe(24);
    });
  });

  describe('normalizarRut y separarNombresApellidos', () => {
    it('normaliza RUTs', () => {
      expect(normalizarRut('10.245.939-3')).toBe('10245939-3');
      expect(normalizarRut('102459393')).toBe('10245939-3');
    });

    it('separa nombres y apellidos por coma', () => {
      const res = separarNombresApellidos('ACEVEDO AGURTO, SELEDINA MARISA');
      expect(res.apellidos).toBe('ACEVEDO AGURTO');
      expect(res.nombres).toBe('SELEDINA MARISA');
    });
  });

  describe('parseMatrizExcel con archivo real', () => {
    const realPath = 'C:/Users/DionicioFelipeFlores/Downloads/Dotación Liceo Narciso T.xlsx';
    it('parsea correctamente la planilla real de Narciso T.', async () => {
      if (!fs.existsSync(realPath)) {
        console.warn('Archivo de prueba Narciso T. no encontrado, saltando prueba de integración');
        return;
      }

      const buffer = fs.readFileSync(realPath);
      const res = await parseMatrizExcel(buffer, 'Dotación Liceo Narciso T.xlsx');

      expect(res.cursos.length).toBeGreaterThanOrEqual(25);
      expect(res.docentes.length).toBeGreaterThan(50);
      expect(res.totalAsignaciones).toBeGreaterThan(150);

      // Primer docente de prueba: SELEDINA MARISA ACEVEDO AGURTO
      const d1 = res.docentes.find(d => d.run === '10245939-3');
      expect(d1).toBeDefined();
      if (d1) {
        expect(d1.horasContrato).toBe(33);
        expect(d1.titularSubGral).toBe(30);
        expect(d1.titularPie).toBe(3);
        expect(d1.asignaciones.length).toBeGreaterThan(0);
        const asigLenguaje = d1.asignaciones.find(a => a.asignatura.toLowerCase().includes('lenguaje'));
        expect(asigLenguaje).toBeDefined();
        if (asigLenguaje) {
          expect(asigLenguaje.nivelCurso).toBe('1° Básico');
          expect(asigLenguaje.horasPedagogicasAula).toBe(10);
        }
      }
    });
  });
});
