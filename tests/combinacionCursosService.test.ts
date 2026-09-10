import { describe, it, expect } from 'vitest';
import {
  extraerGradosDeCurso,
  combinarCursosExistentes,
  descombinarCursoExistente
} from '../src/services/combinacionCursosService';
import { CursoSae } from '../src/types';

describe('Servicio de Combinación y Descombinación de Cursos', () => {
  describe('extraerGradosDeCurso', () => {
    it('extrae grados cuando ya están definidos en gradosCombinados', () => {
      const curso: CursoSae = {
        id: 'c1',
        rbd: '1234',
        periodo: 2026,
        nivel: 'Combinado 1° y 2°',
        letra: 'U',
        regimen: 'JEC',
        matriculaProyectada: 25,
        cupoSae: 35,
        gradosCombinados: ['1° Básico', '2° Básico']
      };
      expect(extraerGradosDeCurso(curso)).toEqual(['1° Básico', '2° Básico']);
    });

    it('extrae rango multigrado 1° a 6° Básico', () => {
      const curso: CursoSae = {
        id: 'c2',
        rbd: '1234',
        periodo: 2026,
        nivel: 'Multigrado 1° a 6° Básico',
        letra: 'U',
        regimen: 'JEC',
        matriculaProyectada: 20,
        cupoSae: 30
      };
      const grados = extraerGradosDeCurso(curso);
      expect(grados).toEqual([
        '1° Básico',
        '2° Básico',
        '3° Básico',
        '4° Básico',
        '5° Básico',
        '6° Básico'
      ]);
    });

    it('extrae pares con guión como 3°-4° Básico', () => {
      const curso: CursoSae = {
        id: 'c3',
        rbd: '1234',
        periodo: 2026,
        nivel: 'Multigrado 3°-4° Básico',
        letra: 'U',
        regimen: 'JEC',
        matriculaProyectada: 18,
        cupoSae: 30
      };
      expect(extraerGradosDeCurso(curso)).toEqual(['3° Básico', '4° Básico']);
    });

    it('extrae parvularia NT1-NT2 / Pre-Kínder y Kínder', () => {
      const curso: CursoSae = {
        id: 'c4',
        rbd: '1234',
        periodo: 2026,
        nivel: 'Multigrado NT1-NT2',
        letra: 'U',
        regimen: 'No JEC',
        matriculaProyectada: 12,
        cupoSae: 25
      };
      expect(extraerGradosDeCurso(curso)).toEqual(['Pre-Kínder', 'Kínder']);
    });

    it('devuelve el nivel regular si es un curso individual', () => {
      const curso: CursoSae = {
        id: 'c5',
        rbd: '1234',
        periodo: 2026,
        nivel: '5° Básico',
        letra: 'A',
        regimen: 'JEC',
        matriculaProyectada: 32,
        cupoSae: 38
      };
      expect(extraerGradosDeCurso(curso)).toEqual(['5° Básico']);
    });
  });

  describe('combinarCursosExistentes', () => {
    it('combina 2 cursos regulares sumando matrículas, cupos y NEE', () => {
      const curso1: CursoSae = {
        id: 'c1',
        rbd: '9999',
        periodo: 2026,
        nivel: '1° Básico',
        letra: 'A',
        regimen: 'JEC',
        regimenProporcion: '65_35',
        matriculaProyectada: 12,
        cupoSae: 30,
        alumnosNeet: 3,
        alumnosNeep: 1
      };
      const curso2: CursoSae = {
        id: 'c2',
        rbd: '9999',
        periodo: 2026,
        nivel: '2° Básico',
        letra: 'A',
        regimen: 'JEC',
        regimenProporcion: '65_35',
        matriculaProyectada: 14,
        cupoSae: 30,
        alumnosNeet: 2,
        alumnosNeep: 1
      };

      const combinado = combinarCursosExistentes([curso1, curso2]);

      expect(combinado.rbd).toBe('9999');
      expect(combinado.matriculaProyectada).toBe(26);
      expect(combinado.cupoSae).toBe(60);
      expect(combinado.alumnosNeet).toBe(5);
      expect(combinado.alumnosNeep).toBe(2);
      expect(combinado.esCombinado).toBe(true);
      expect(combinado.esMultigrado).toBe(true);
      expect(combinado.tipoModalidad).toBe('COMBINADO');
      expect(combinado.gradosCombinados).toEqual(['1° Básico', '2° Básico']);
      expect(combinado.nivel).toContain('1° Básico - 2° Básico');
    });

    it('permite personalizar el nombre, letra y proporción del curso combinado', () => {
      const curso1: CursoSae = {
        id: 'c1',
        rbd: '9999',
        periodo: 2026,
        nivel: '3° Básico',
        letra: 'A',
        regimen: 'No JEC',
        matriculaProyectada: 8,
        cupoSae: 20
      };
      const curso2: CursoSae = {
        id: 'c2',
        rbd: '9999',
        periodo: 2026,
        nivel: '4° Básico',
        letra: 'A',
        regimen: 'No JEC',
        matriculaProyectada: 10,
        cupoSae: 20
      };

      const combinado = combinarCursosExistentes([curso1, curso2], {
        nombrePersonalizado: 'Multigrado 3°-4° Básico',
        letra: 'U',
        regimen: 'JEC',
        regimenProporcion: '60_40'
      });

      expect(combinado.nivel).toBe('Multigrado 3°-4° Básico');
      expect(combinado.letra).toBe('U');
      expect(combinado.regimen).toBe('JEC');
      expect(combinado.regimenProporcion).toBe('60_40');
      expect(combinado.matriculaProyectada).toBe(18);
    });
  });

  describe('descombinarCursoExistente', () => {
    it('descombina un curso combinado de 2 grados en 2 cursos individuales con distribución exacta', () => {
      const combinado: CursoSae = {
        id: 'comb-1',
        rbd: '8888',
        periodo: 2026,
        nivel: 'Curso Combinado (1° Básico - 2° Básico)',
        letra: 'U',
        regimen: 'JEC',
        regimenProporcion: '65_35',
        matriculaProyectada: 25,
        cupoSae: 60,
        alumnosNeet: 5,
        alumnosNeep: 3,
        esCombinado: true,
        esMultigrado: true,
        tipoModalidad: 'COMBINADO',
        gradosCombinados: ['1° Básico', '2° Básico']
      };

      const separados = descombinarCursoExistente(combinado);

      expect(separados).toHaveLength(2);
      expect(separados[0].nivel).toBe('1° Básico');
      expect(separados[1].nivel).toBe('2° Básico');
      expect(separados[0].esCombinado).toBe(false);
      expect(separados[0].tipoModalidad).toBe('REGULAR');
      expect(separados[0].regimen).toBe('JEC');

      // Matrícula total se preserva exactamente: 13 + 12 = 25
      const sumaMat = separados.reduce((s, c) => s + c.matriculaProyectada, 0);
      expect(sumaMat).toBe(25);
      expect(separados[0].matriculaProyectada).toBe(13);
      expect(separados[1].matriculaProyectada).toBe(12);

      // NEET total se preserva: 3 + 2 = 5
      const sumaNeet = separados.reduce((s, c) => s + (c.alumnosNeet || 0), 0);
      expect(sumaNeet).toBe(5);

      // NEEP total se preserva: 2 + 1 = 3
      const sumaNeep = separados.reduce((s, c) => s + (c.alumnosNeep || 0), 0);
      expect(sumaNeep).toBe(3);
    });

    it('descombina un curso multigrado con nombre textual cuando gradosCombinados no estaba explícito', () => {
      const combinado: CursoSae = {
        id: 'comb-2',
        rbd: '8888',
        periodo: 2026,
        nivel: 'Multigrado 5°-6° Básico',
        letra: 'U',
        regimen: 'JEC',
        matriculaProyectada: 19,
        cupoSae: 40,
        esCombinado: true
      };

      const separados = descombinarCursoExistente(combinado);

      expect(separados).toHaveLength(2);
      expect(separados[0].nivel).toBe('5° Básico');
      expect(separados[1].nivel).toBe('6° Básico');
      expect(separados[0].matriculaProyectada + separados[1].matriculaProyectada).toBe(19);
    });
  });
});
