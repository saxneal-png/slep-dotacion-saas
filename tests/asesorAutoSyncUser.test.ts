import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/services/authService';
import { colegiosVisibles } from '../src/services/scopeService';
import { Establecimiento } from '../src/types';

describe('Sincronización Automática: Registro de Asesor -> Usuario Activo', () => {
  const store: Record<string, string> = {};

  beforeEach(() => {
    for (const key of Object.keys(store)) delete store[key];
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; }
    };
  });

  it('al agregar un nuevo asesor crea automáticamente su cuenta de usuario con rol asesor_uatp y clave inicial', async () => {
    const res = await AuthService.sincronizarAsesorComoUsuario({
      nombre: 'Marcela Vega Silva',
      email: 'marcela.vega@slepvallediguillin.cl',
      cargo: 'Asesora Territorial UATP',
      carteraRbds: ['3501', '3502']
    });

    expect(res.esNuevo).toBe(true);
    expect(res.passwordTemporal).toMatch(/^Slep-[A-Za-z0-9]{10}$/);
    expect(res.usuario.role).toBe('asesor_uatp');
    expect(res.usuario.username).toBe('marcela.vega');
    expect(res.usuario.carteraRbds).toEqual(['3501', '3502']);
    expect(res.usuario.activo).toBe(true);

    // Debe poder iniciar sesión con sus credenciales generadas
    const sesion = await AuthService.login('marcela.vega@slepvallediguillin.cl', res.passwordTemporal!);
    expect(sesion.usuario.email).toBe('marcela.vega@slepvallediguillin.cl');
    expect(sesion.usuario.role).toBe('asesor_uatp');
  });

  it('al actualizar el asesor con nuevos colegios, actualiza su cartera de usuario sin resetear su clave', async () => {
    // 1. Crear
    await AuthService.sincronizarAsesorComoUsuario({
      nombre: 'Rodrigo Fuentes',
      email: 'rodrigo.fuentes@slepvallediguillin.cl',
      carteraRbds: ['3501']
    });

    // 2. Cambiar clave a una personalizada
    const usuarios = await AuthService.getUsuarios();
    const u = usuarios.find(x => x.username === 'rodrigo.fuentes')!;
    await AuthService.cambiarPassword(u.id, 'miClaveSegura99');

    // 3. Re-sincronizar sumando colegios
    const resActualizacion = await AuthService.sincronizarAsesorComoUsuario({
      nombre: 'Rodrigo Fuentes',
      email: 'rodrigo.fuentes@slepvallediguillin.cl',
      carteraRbds: ['3501', '3505', '3508']
    });

    expect(resActualizacion.esNuevo).toBe(false);
    expect(resActualizacion.usuario.carteraRbds).toEqual(expect.arrayContaining(['3501', '3505', '3508']));

    // Debe seguir logueando con su clave personalizada previa
    const loginOk = await AuthService.login('rodrigo.fuentes', 'miClaveSegura99');
    expect(loginOk).toBeDefined();
  });

  it('al iniciar sesión como el asesor creado, el scope territorial restringe su vista exclusivamente a su cartera', async () => {
    const sesion = await AuthService.sincronizarAsesorComoUsuario({
      nombre: 'Claudia Muñoz',
      email: 'claudia.munoz@slepvallediguillin.cl',
      carteraRbds: ['4001', '4002']
    });

    const listaColegios: Establecimiento[] = [
      { id: '1', rbd: '4001', nombre: 'Colegio A', comuna: 'Bulnes', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 80 },
      { id: '2', rbd: '4002', nombre: 'Colegio B', comuna: 'Bulnes', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 80 },
      { id: '3', rbd: '9999', nombre: 'Colegio Ajeno', comuna: 'Chillán', regimen: 'JORNADA_COMPLETA', porcentajePrioritarios: 80 }
    ];

    const visibles = colegiosVisibles(sesion.usuario, listaColegios);
    expect(visibles.length).toBe(2);
    expect(visibles.map(c => c.rbd)).toEqual(['4001', '4002']);
    expect(visibles.some(c => c.rbd === '9999')).toBe(false);
  });
});
