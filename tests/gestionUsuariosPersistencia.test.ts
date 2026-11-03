import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { AuthService } from '../src/services/authService';
import { UsuarioSistema } from '../src/types/authTypes';
import { listarUsuariosDb } from '../src/database/repositories/usuariosRepo';
import { actualizarColegiosDeAsesor } from '../src/services/configuracionGeneralService';
import { listarEstablecimientos, guardarEstablecimiento } from '../src/database/repositories/establecimientosRepo';

describe('Gestión de Usuarios: Persistencia de ediciones, carteras y roles', () => {
  const store: Record<string, string> = {};

  beforeAll(() => {
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0
    };
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('debe conservar las ediciones de un usuario (nombre, cargo, rol, email y estado) tras múltiples lecturas getUsuarios()', async () => {
    const nuevo: UsuarioSistema = {
      id: 'user-test-edicion-1',
      username: 'asesor.prueba',
      nombreCompleto: 'Asesor Prueba Inicial',
      email: 'asesor.prueba@slepvallediguillin.cl',
      role: 'asesor_uatp',
      cargo: 'Asesor UATP Inicial',
      carteraRbds: ['3743', '3745'],
      activo: true
    };

    const creado = await AuthService.guardarUsuario(nuevo, 'ClaveSegura123');
    expect(creado.id).toBe('user-test-edicion-1');

    // Editar nombre, cargo, cartera y estado
    const editadoInput: UsuarioSistema = {
      ...creado,
      nombreCompleto: 'Asesor Prueba Modificado',
      cargo: 'Asesor Senior UATP',
      carteraRbds: ['3743', '3754', '3755'],
      activo: true
    };

    const editado = await AuthService.guardarUsuario(editadoInput);
    expect(editado.nombreCompleto).toBe('Asesor Prueba Modificado');
    expect(editado.cargo).toBe('Asesor Senior UATP');
    expect(editado.carteraRbds).toEqual(['3743', '3754', '3755']);

    // Verificar en SQLite directamente
    const enSqlite = await listarUsuariosDb();
    const filaSqlite = enSqlite.find(u => u.id === 'user-test-edicion-1');
    expect(filaSqlite).toBeDefined();
    expect(filaSqlite?.nombreCompleto).toBe('Asesor Prueba Modificado');
    expect(filaSqlite?.cargo).toBe('Asesor Senior UATP');
    expect(filaSqlite?.carteraRbds).toEqual(['3743', '3754', '3755']);

    // Verificar que al volver a llamar getUsuarios() no se reviertan los cambios ni se pierda una cartera vaciada
    await AuthService.guardarUsuario({
      ...editado,
      carteraRbds: []
    });

    const listaFinal = await AuthService.getUsuarios();
    const usuarioFinal = listaFinal.find(u => u.id === 'user-test-edicion-1');
    expect(usuarioFinal).toBeDefined();
    expect(usuarioFinal?.carteraRbds).toEqual([]);

    // Limpiar usuario de prueba
    await AuthService.eliminarUsuario('user-test-edicion-1');
  }, 15000);

  it('debe desasignar colegios de otros asesores cuando se reasignan a un asesor en guardarUsuario()', async () => {
    const asesorA: UsuarioSistema = {
      id: 'user-test-asesor-a',
      username: 'asesor.a.test',
      nombreCompleto: 'Asesor A Test',
      email: 'asesor.a.test@slepvallediguillin.cl',
      role: 'asesor_uatp',
      cargo: 'Asesor UATP',
      carteraRbds: ['3743', '3745', '3754'],
      activo: true
    };

    const asesorB: UsuarioSistema = {
      id: 'user-test-asesor-b',
      username: 'asesor.b.test',
      nombreCompleto: 'Asesor B Test',
      email: 'asesor.b.test@slepvallediguillin.cl',
      role: 'asesor_uatp',
      cargo: 'Asesor UATP',
      carteraRbds: ['3755'],
      activo: true
    };

    await AuthService.guardarUsuario(asesorA, 'Clave1234');
    await AuthService.guardarUsuario(asesorB, 'Clave1234');

    // Ahora Asesor B toma el colegio 3745 que tenía Asesor A
    await AuthService.guardarUsuario({
      ...asesorB,
      carteraRbds: ['3755', '3745']
    });

    const lista = await AuthService.getUsuarios();
    const aActualizado = lista.find(u => u.id === 'user-test-asesor-a');
    const bActualizado = lista.find(u => u.id === 'user-test-asesor-b');

    expect(bActualizado?.carteraRbds).toEqual(['3755', '3745']);
    expect(aActualizado?.carteraRbds).toEqual(['3743', '3754']);

    await AuthService.eliminarUsuario('user-test-asesor-a');
    await AuthService.eliminarUsuario('user-test-asesor-b');
  }, 15000);

  it('actualizarColegiosDeAsesor debe actualizar asesorUatp incluso si el asesor cambió su nombreCompleto', async () => {
    await guardarEstablecimiento({
      id: 'est-99901',
      rbd: '99901',
      nombre: 'Escuela Test 1',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 80,
      asesorUatp: 'Nombre Antiguo Asesor'
    }, true);

    await guardarEstablecimiento({
      id: 'est-99902',
      rbd: '99902',
      nombre: 'Escuela Test 2',
      comuna: 'Bulnes',
      regimen: 'JEC',
      porcentajePrioritarios: 80,
      asesorUatp: 'Nombre Antiguo Asesor'
    }, true);

    const colegiosAntes = await listarEstablecimientos();
    // El asesor cambió su nombre a "Nombre Nuevo Asesor" y dejó solo 99901 en su cartera
    await actualizarColegiosDeAsesor(
      'Nombre Nuevo Asesor',
      ['99901'],
      colegiosAntes,
      'Nombre Antiguo Asesor'
    );

    const colegiosDespues = await listarEstablecimientos();
    const c1 = colegiosDespues.find(c => c.rbd === '99901');
    const c2 = colegiosDespues.find(c => c.rbd === '99902');

    expect(c1?.asesorUatp).toBe('Nombre Nuevo Asesor');
    expect(c2?.asesorUatp).toBeUndefined();
  });
});
