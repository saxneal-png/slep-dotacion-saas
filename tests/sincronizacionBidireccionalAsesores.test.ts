import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/services/authService';
import {
  guardarPerfilAsesor,
  sincronizarEquipoAsesoresConUsuariosLocales,
  cargarConfiguracionGeneral,
  actualizarColegiosDeAsesor
} from '../src/services/configuracionGeneralService';
import { colegiosVisibles } from '../src/services/scopeService';
import { Establecimiento } from '../src/types';

describe('Sincronización Bidireccional Asesores UATP, Cartera y Aislamiento Territorial', () => {
  const store: Record<string, string> = {};

  const colegiosMock: Establecimiento[] = [
    { id: '1', rbd: '1001', nombre: 'Escuela Bulnes Centro', comuna: 'Bulnes', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 80, asesorUatp: 'Patricio Asesor' },
    { id: '2', rbd: '1002', nombre: 'Liceo San Ignacio', comuna: 'San Ignacio', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 75, asesorUatp: 'Patricio Asesor' },
    { id: '3', rbd: '1003', nombre: 'Escuela Pemuco Sur', comuna: 'Pemuco', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 90, asesorUatp: 'Lorena Asesora' },
    { id: '4', rbd: '1004', nombre: 'Colegio Yungay', comuna: 'Yungay', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 85 }
  ];

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    };
  });

  it('1. Al crear un usuario Asesor UATP, este se sincroniza en el Equipo de Asesores de la configuración general', async () => {
    const usuarioAsesor = {
      id: 'user-patricio-1',
      username: 'patricio.asesor',
      nombreCompleto: 'Patricio Asesor',
      email: 'patricio.asesor@slepvallediguillin.cl',
      role: 'asesor_uatp' as const,
      cargo: 'Asesor Técnico Pedagógico UATP',
      carteraRbds: ['1001', '1002'],
      activo: true
    };

    await AuthService.guardarUsuario(usuarioAsesor as any);

    // Reconciliar con la configuración general
    const usuarios = await AuthService.getUsuarios();
    const config = sincronizarEquipoAsesoresConUsuariosLocales(usuarios, colegiosMock);

    const asesorEncontrado = config.asesoresRegistrados.find(
      a => a.nombre.toLowerCase().trim() === 'patricio asesor' || a.email === 'patricio.asesor@slepvallediguillin.cl'
    );
    expect(asesorEncontrado).toBeDefined();
    expect(asesorEncontrado?.nombre).toBe('Patricio Asesor');
  });

  it('2. Al modificar la cartera de escuelas asignadas (quitar y agregar), se actualiza exactamente en el usuario sin retener escuelas removidas', async () => {
    // Crear inicialmente con 1001 y 1002
    await AuthService.sincronizarAsesorComoUsuario({
      nombre: 'Lorena Asesora',
      email: 'lorena.asesora@slepvallediguillin.cl',
      carteraRbds: ['1001', '1002']
    });

    let usuarios = await AuthService.getUsuarios();
    let lorena = usuarios.find(u => u.username === 'lorena.asesora')!;
    expect(lorena.carteraRbds).toEqual(['1001', '1002']);

    // Ahora se modifica su cartera: se le quita 1001 y se le deja solo 1003
    await AuthService.sincronizarAsesorComoUsuario({
      nombre: 'Lorena Asesora',
      email: 'lorena.asesora@slepvallediguillin.cl',
      carteraRbds: ['1003']
    }, 'reemplazar');

    usuarios = await AuthService.getUsuarios();
    lorena = usuarios.find(u => u.username === 'lorena.asesora')!;
    expect(lorena.carteraRbds).toEqual(['1003']);
    expect(lorena.carteraRbds).not.toContain('1001');
    expect(lorena.carteraRbds).not.toContain('1002');
  });

  it('3. Un Asesor UATP en Cartera ve estrictamente sus colegios asignados y no todo el territorio', () => {
    // Asesor con 2 colegios (1001 y 1002)
    const asesor = {
      id: 'user-patricio-1',
      role: 'asesor_uatp' as const,
      nombreCompleto: 'Patricio Asesor',
      carteraRbds: ['1001', '1002']
    };

    const visibles = colegiosVisibles(asesor, colegiosMock);
    expect(visibles.length).toBe(2);
    expect(visibles.map(c => c.rbd)).toEqual(['1001', '1002']);
    expect(visibles.some(c => c.rbd === '1003')).toBe(false);
    expect(visibles.some(c => c.rbd === '1004')).toBe(false);

    // Asesor sin ningún colegio asignado: debe ver 0 colegios (no los 4)
    const asesorSinColegios = {
      id: 'user-vacio-1',
      role: 'asesor_uatp' as const,
      nombreCompleto: 'Asesor Sin Colegios',
      carteraRbds: []
    };

    const visiblesVacio = colegiosVisibles(asesorSinColegios, colegiosMock);
    expect(visiblesVacio.length).toBe(0);
  });
});
