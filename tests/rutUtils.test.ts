import { describe, it, expect } from 'vitest';
import { normalizarRut, validarRut, formatearRut } from '../src/utils/rutUtils';

describe('rutUtils', () => {
  describe('normalizarRut', () => {
    it('debe limpiar puntos y espacios y colocar guion', () => {
      expect(normalizarRut(' 12.345.678-9 ')).toBe('12345678-9');
      expect(normalizarRut('12.345.678-K')).toBe('12345678-K');
      expect(normalizarRut('12.345.678-k')).toBe('12345678-K');
    });

    it('debe normalizar RUTs sin guion de 8 o 9 dígitos', () => {
      expect(normalizarRut('123456789')).toBe('12345678-9');
      expect(normalizarRut('9876543K')).toBe('9876543-K');
      expect(normalizarRut('76543210')).toBe('7654321-0');
    });

    it('debe manejar entradas vacías o nulas', () => {
      expect(normalizarRut('')).toBe('');
      expect(normalizarRut(null)).toBe('');
      expect(normalizarRut(undefined)).toBe('');
    });
  });

  describe('validarRut', () => {
    it('debe validar RUTs chilenos reales válidos', () => {
      // Ejemplos de RUTs válidos con algoritmo módulo 11
      // 11.111.111-1 -> 11*.. mod 11
      // 1+2+3+4+5+6+7+8+9...
      // Verifiquemos un RUT conocido: 1-9 (1*2=2 -> 11-2=9) -> '1-9'
      expect(validarRut('1-9')).toBe(true);
      // 12.345.678-5 -> 8*2+7*3+6*4+5*5+4*6+3*7+2*2+1*3 = 16+21+24+25+24+21+4+3 = 138 % 11 = 6 -> 11-6 = 5
      expect(validarRut('12.345.678-5')).toBe(true);
      expect(validarRut('123456785')).toBe(true);
    });

    it('debe rechazar RUTs con dígito verificador inválido', () => {
      expect(validarRut('12.345.678-9')).toBe(false);
      expect(validarRut('1-8')).toBe(false);
      expect(validarRut('abc')).toBe(false);
      expect(validarRut('')).toBe(false);
    });
  });

  describe('formatearRut', () => {
    it('debe formatear con puntos y guion', () => {
      expect(formatearRut('12345678-9')).toBe('12.345.678-9');
      expect(formatearRut('123456789')).toBe('12.345.678-9');
      expect(formatearRut('9876543-K')).toBe('9.876.543-K');
    });
  });
});
