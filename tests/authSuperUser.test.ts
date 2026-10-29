import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { AuthService, USUARIOS_SEMILLA_BASE } from '../src/services/authService';

describe('Autenticación y Super Usuario Oficial SLEP', () => {
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

  it('no debe contener cuentas simuladas ni contraseñas en texto plano en la semilla oficial', () => {
    expect(USUARIOS_SEMILLA_BASE.length).toBe(1);
    const superUser = USUARIOS_SEMILLA_BASE[0] as any;
    expect(superUser.email).toBe('saxneal@gmail.com');
    expect(superUser.role).toBe('super_usuario');
    expect(superUser.defaultPasswordPlain).toBeUndefined();

    // Verificar que ninguna cuenta simulada previa esté en la semilla
    const usernames = USUARIOS_SEMILLA_BASE.map(u => u.username);
    expect(usernames).not.toContain('admin');
    expect(usernames).not.toContain('asesor');
    expect(usernames).not.toContain('director');
    expect(usernames).not.toContain('auditor');
  });

  it('purga usuarios de la versión 1 y siembra exclusivamente al superusuario saxneal@gmail.com', async () => {
    // Simular que el localStorage tenía la versión antigua con cuentas demo
    localStorage.setItem('slep_usuarios_sistema_v1', JSON.stringify([
      { id: 'user-admin-1', username: 'admin', role: 'admin' }
    ]));

    const usuarios = await AuthService.getUsuarios();
    expect(localStorage.getItem('slep_usuarios_sistema_v1')).toBeNull();
    const superUser = usuarios.find(u => u.email === 'saxneal@gmail.com');
    expect(superUser).toBeDefined();
    expect(superUser?.email).toBe('saxneal@gmail.com');
    expect(superUser?.role).toBe('super_usuario');
  });

  it('permite iniciar sesión con saxneal@gmail.com sellando criptográficamente su contraseña en el primer acceso', async () => {
    const testPass = 'ClaveSeguraTest_99';
    const session = await AuthService.login('saxneal@gmail.com', testPass);
    expect(session).toBeDefined();
    expect(session.usuario.email).toBe('saxneal@gmail.com');
    expect(session.usuario.role).toBe('super_usuario');

    const permisos = AuthService.getPermisos(session.usuario.role);
    expect(permisos.puedeGestionarUsuarios).toBe(true);
    expect(permisos.puedeConfigurarSistema).toBe(true);
    expect(permisos.puedeAccederTodasEscuelas).toBe(true);
    expect(permisos.puedeVerCarteraTerritorial).toBe(true);
    expect(permisos.puedeVerConsolidadorMaster).toBe(true);
    expect(permisos.esSoloLectura).toBe(false);
  });

  it('rechaza intentos de login con contraseñas erróneas o usuarios simulados antiguos', async () => {
    await AuthService.login('saxneal@gmail.com', 'ClaveRealSellada_88');
    await expect(AuthService.login('saxneal@gmail.com', 'clave_incorrecta')).rejects.toThrow();
    await expect(AuthService.login('admin', 'admin123')).rejects.toThrow(/Usuario no encontrado/);
    await expect(AuthService.login('asesor', 'asesor123')).rejects.toThrow(/Usuario no encontrado/);
  });

  it('permite crear y habilitar un nuevo usuario desde el SaaS y autenticarse con sus credenciales', async () => {
    // 1. Super Usuario crea a Javier Álvarez como Director de Colegio
    const nuevoUsuario = {
      id: 'user-javier-test',
      username: 'javier.alvarez',
      email: 'javier.alvarez@slepvallediguillin.gob.cl',
      nombreCompleto: 'Javier Álvarez',
      role: 'director_colegio' as any,
      cargo: 'Director de Establecimiento',
      rbdAsignado: '3656',
      carteraRbds: [],
      asesoresSupervisados: [],
      activo: true
    };

    const testUserPass = 'ClavePruebaDirector_77';
    await AuthService.guardarUsuario(nuevoUsuario as any, testUserPass);

    // 2. Verificar que Javier Álvarez puede iniciar sesión con su email o con su username
    const sesionEmail = await AuthService.login('javier.alvarez@slepvallediguillin.gob.cl', testUserPass);
    expect(sesionEmail.usuario.username).toBe('javier.alvarez');
    expect(sesionEmail.usuario.rbdAsignado).toBe('3656');
    expect(sesionEmail.usuario.role).toBe('director_establecimiento');

    const sesionUsername = await AuthService.login('javier.alvarez', testUserPass);
    expect(sesionUsername.usuario.id).toBe('user-javier-test');

    // 3. Deshabilitar usuario mediante toggleEstadoUsuario
    await AuthService.toggleEstadoUsuario('user-javier-test', false);

    // 4. Intentar ingresar con usuario deshabilitado debe ser rechazado
    await expect(AuthService.login('javier.alvarez', testUserPass)).rejects.toThrow(/deshabilitada/);

    // 5. Rehabilitar usuario
    await AuthService.toggleEstadoUsuario('user-javier-test', true);
    const sesionRehabilitada = await AuthService.login('javier.alvarez', testUserPass);
    expect(sesionRehabilitada.usuario.activo).toBe(true);
  });

  it('impide deshabilitar la cuenta del Super Usuario oficial', async () => {
    const usuarios = await AuthService.getUsuarios();
    const superUser = usuarios.find(u => u.email === 'saxneal@gmail.com')!;
    await expect(AuthService.toggleEstadoUsuario(superUser.id, false)).rejects.toThrow(/No es posible deshabilitar la cuenta del Super Usuario/);
  });
});
