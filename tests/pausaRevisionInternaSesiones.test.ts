import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import {
  AuthService,
  hashPassword,
  ROLES_EXENTOS_PAUSA,
  ROLES_PAUSABLES_ESTAMENTO,
  STORAGE_PAUSA_KEY
} from '../src/services/authService';
import { DIRECTORES_TERRITORIO } from '../src/data/directoresTerritorio';
import { UsuarioSistema, AuthSession } from '../src/types/authTypes';

describe('Control de Sesiones Masivo y Pausa por Revisión Interna UATP', () => {
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

  beforeEach(async () => {
    localStorage.clear();
    // Inicializar usuarios semilla y directores
    await AuthService.getUsuarios();
  });

  it('clasifica estrictamente los roles protegidos (UATP y Super Usuario) y los pausables (Estamentos Escolares)', () => {
    const protegidos = AuthService.getRolesExentosPausa();
    expect(protegidos).toContain('super_usuario');
    expect(protegidos).toContain('coordinador_uatp');
    expect(protegidos).toContain('asesor_uatp');
    expect(protegidos).toContain('subdirector_uatp');

    const pausables = AuthService.getRolesPausables();
    expect(pausables).toContain('director_establecimiento');
    expect(pausables).toContain('jefe_utp_establecimiento');
    // Ningún rol protegido puede ser considerado pausable
    for (const prot of protegidos) {
      expect(pausables).not.toContain(prot);
    }
  });

  it('calcula el resumen de estamentos en tiempo real indicando cuentas activas, inactivas y protección', async () => {
    const resumen = await AuthService.getResumenEstamentos();
    expect(resumen.length).toBeGreaterThanOrEqual(6);

    const dirResumen = resumen.find(r => r.rol === 'director_establecimiento');
    expect(dirResumen).toBeDefined();
    expect(dirResumen?.total).toBe(131);
    expect(dirResumen?.activos).toBe(131);
    expect(dirResumen?.inactivos).toBe(0);
    expect(dirResumen?.esProtegido).toBe(false);

    const superResumen = resumen.find(r => r.rol === 'super_usuario');
    expect(superResumen).toBeDefined();
    expect(superResumen?.activos).toBeGreaterThanOrEqual(1);
    expect(superResumen?.esProtegido).toBe(true);
  });

  it('rechaza pausar si solo se especifican roles exentos protegidos', async () => {
    await expect(
      AuthService.pausarAccesoMasivo(['asesor_uatp', 'coordinador_uatp', 'super_usuario'])
    ).rejects.toThrow(/protegidos por diseño/i);
  });

  it('pausa masivamente las sesiones y cuentas de directores para revisión interna sin tocar al equipo UATP', async () => {
    // Agregar un asesor de prueba para verificar que no se afecte
    await AuthService.guardarUsuario({
      id: 'user-asesor-prueba-uatp',
      username: 'asesor.prueba@slepvallediguillin.cl',
      email: 'asesor.prueba@slepvallediguillin.cl',
      nombreCompleto: 'Asesor UATP Prueba',
      role: 'asesor_uatp',
      cargo: 'Asesor UATP',
      passwordHash: 'hash',
      salt: 'salt',
      activo: true
    });

    const resultado = await AuthService.pausarAccesoMasivo(
      ['director_establecimiento'],
      'Auditoría técnica de asignaciones y sobrecupos 2027',
      'Super Administrador'
    );

    expect(resultado.totalAfectados).toBe(131);
    expect(resultado.rolesAfectados).toEqual(['director_establecimiento']);

    // Verificar usuarios actualizados
    const usuarios = await AuthService.getUsuarios();
    const directores = usuarios.filter(u => u.role === 'director_establecimiento');
    expect(directores.every(d => d.activo === false)).toBe(true);

    // Asesor UATP y Super Usuario deben permanecer activos
    const asesor = usuarios.find(u => u.id === 'user-asesor-prueba-uatp');
    expect(asesor?.activo).toBe(true);

    const superUser = usuarios.find(u => u.role === 'super_usuario');
    expect(superUser?.activo).toBe(true);

    // Estado de la pausa guardado
    const estadoPausa = AuthService.getEstadoPausaRevision();
    expect(estadoPausa?.activa).toBe(true);
    expect(estadoPausa?.rolesAfectados).toContain('director_establecimiento');
    expect(estadoPausa?.motivo).toContain('Auditoría técnica');
  });

  it('bloquea el login de un director pausado entregando un mensaje explicativo de Revisión Interna', async () => {
    await AuthService.pausarAccesoMasivo(['director_establecimiento'], 'Revisión territorial');

    const primerDirector = DIRECTORES_TERRITORIO[0];
    await expect(
      AuthService.login(primerDirector.email, '123456')
    ).rejects.toThrow(/Acceso pausado por Revisión Interna UATP/i);
  });

  it('invalida sesiones activas de directores mediante verificarSesionValida pero preserva asesores', async () => {
    await AuthService.pausarAccesoMasivo(['director_establecimiento']);

    const sesionDirector: AuthSession = {
      usuario: {
        id: `user-dir-${DIRECTORES_TERRITORIO[0].rbd}`,
        username: DIRECTORES_TERRITORIO[0].email,
        email: DIRECTORES_TERRITORIO[0].email,
        nombreCompleto: DIRECTORES_TERRITORIO[0].director,
        role: 'director_establecimiento',
        cargo: 'Director',
        activo: false
      },
      token: 'tok-123',
      iniciadoEn: new Date().toISOString()
    };

    const valDirector = AuthService.verificarSesionValida(sesionDirector);
    expect(valDirector.valida).toBe(false);
    expect(valDirector.motivo).toContain('Sesión pausada');

    const sesionSuper: AuthSession = {
      usuario: {
        id: 'user-saxneal-superadmin',
        username: 'saxneal@gmail.com',
        email: 'saxneal@gmail.com',
        nombreCompleto: 'Super Administrador',
        role: 'super_usuario',
        cargo: 'Super Usuario',
        activo: true
      },
      token: 'tok-admin',
      iniciadoEn: new Date().toISOString()
    };

    const valSuper = AuthService.verificarSesionValida(sesionSuper);
    expect(valSuper.valida).toBe(true);
  });

  it('reactiva masivamente el acceso a los directores restableciendo el inicio de sesión', async () => {
    await AuthService.pausarAccesoMasivo(['director_establecimiento']);

    // Ahora reactivamos
    const resReactivacion = await AuthService.reactivarAccesoMasivo(['director_establecimiento']);
    expect(resReactivacion.totalReactivados).toBe(131);

    const usuarios = await AuthService.getUsuarios();
    const directores = usuarios.filter(u => u.role === 'director_establecimiento');
    expect(directores.every(d => d.activo === true)).toBe(true);

    const pausa = AuthService.getEstadoPausaRevision();
    expect(pausa).toBeNull();

    // Ahora el login del director funciona
    const primerDirector = DIRECTORES_TERRITORIO[0];
    const session = await AuthService.login(primerDirector.email, '123456');
    expect(session.usuario.email).toBe(primerDirector.email);
    expect(session.usuario.activo).toBe(true);
  });
});
