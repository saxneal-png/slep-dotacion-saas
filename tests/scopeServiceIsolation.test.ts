import { describe, it, expect } from 'vitest';
import { colegiosVisibles, puedeAccederRbd } from '../src/services/scopeService';
import { Establecimiento } from '../src/types';

const crearEscuela = (rbd: string, nombre: string, comuna: string, asesorUatp?: string): Establecimiento => ({
  id: `est-${rbd}`,
  rbd,
  nombre,
  comuna,
  regimen: 'JEC',
  porcentajePrioritarios: 85,
  asesorUatp
});

describe('Aislamiento estricto de cartera para Asesores UATP', () => {
  const escuelas: Establecimiento[] = [
    crearEscuela('1001', 'Escuela A', 'Bulnes', 'Ana Asesora'),
    crearEscuela('1002', 'Escuela B', 'Pemuco', 'Bruno Asesor'),
    crearEscuela('1003', 'Escuela C', 'Yungay', 'Ana Asesora'),
    crearEscuela('1004', 'Escuela D', 'El Carmen', undefined)
  ];

  it('muestra exclusivamente los colegios asignados al asesor y excluye los de otros asesores', () => {
    const ana = {
      id: 'u-ana',
      role: 'asesor_uatp' as const,
      nombreCompleto: 'Ana Asesora',
      carteraRbds: ['1001', '1003']
    };
    const visibles = colegiosVisibles(ana, escuelas);
    expect(visibles.map(e => e.rbd)).toEqual(['1001', '1003']);
    expect(puedeAccederRbd(ana, '1002', escuelas)).toBe(false);
  });

  it('evita cruces si un RBD quedó residual en carteraRbds pero en establecimientos pertenece explícitamente a otro asesor', () => {
    const anaConResiduo = {
      id: 'u-ana',
      role: 'asesor_uatp' as const,
      nombreCompleto: 'Ana Asesora',
      carteraRbds: ['1001', '1002'] // 1002 pertenece explícitamente a Bruno Asesor
    };
    const visibles = colegiosVisibles(anaConResiduo, escuelas);
    expect(visibles.map(e => e.rbd)).toEqual(['1001', '1003']);
    expect(puedeAccederRbd(anaConResiduo, '1002', escuelas)).toBe(false);
  });

  it('retorna arreglo vacío si el asesor UATP no tiene colegios asignados ni comunasPermitidas', () => {
    const sinCartera = {
      id: 'u-nuevo',
      role: 'asesor_uatp' as const,
      nombreCompleto: 'Asesor Nuevo',
      carteraRbds: []
    };
    expect(colegiosVisibles(sinCartera, escuelas)).toEqual([]);
  });
});
