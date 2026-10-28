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

  it('no debe contener cuentas simuladas (admin123, asesor123, director123) en la semilla oficial', () => {
    expect(USUARIOS_SEMILLA_BASE.length).toBe(1);
    const superUser = USUARIOS_SEMILLA_BASE[0];
    expect(superUser.email).toBe('saxneal@gmail.com');
    expect(superUser.role).toBe('admin');
    expect(superUser.defaultPasswordPlain).toBe('slep1234');

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
    expect(usuarios.length).toBe(1);
    expect(usuarios[0].email).toBe('saxneal@gmail.com');
    expect(usuarios[0].role).toBe('admin');
  });

  it('permite iniciar sesión con saxneal@gmail.com y slep1234 con permisos completos de administrador', async () => {
    const session = await AuthService.login('saxneal@gmail.com', 'slep1234');
    expect(session).toBeDefined();
    expect(session.usuario.email).toBe('saxneal@gmail.com');
    expect(session.usuario.role).toBe('admin');

    const permisos = AuthService.getPermisos(session.usuario.role);
    expect(permisos.puedeGestionarUsuarios).toBe(true);
    expect(permisos.puedeConfigurarSistema).toBe(true);
    expect(permisos.puedeAccederTodasEscuelas).toBe(true);
    expect(permisos.puedeVerCarteraTerritorial).toBe(true);
    expect(permisos.puedeVerConsolidadorMaster).toBe(true);
    expect(permisos.esSoloLectura).toBe(false);
  });

  it('rechaza intentos de login con contraseñas erróneas o usuarios simulados antiguos', async () => {
    await expect(AuthService.login('saxneal@gmail.com', 'clave_incorrecta')).rejects.toThrow();
    await expect(AuthService.login('admin', 'admin123')).rejects.toThrow(/Usuario no encontrado/);
    await expect(AuthService.login('asesor', 'asesor123')).rejects.toThrow(/Usuario no encontrado/);
  });
});
