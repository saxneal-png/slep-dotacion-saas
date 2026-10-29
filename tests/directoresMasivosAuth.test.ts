import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import { AuthService, hashPassword } from '../src/services/authService';
import { DIRECTORES_TERRITORIO } from '../src/data/directoresTerritorio';
import { listarUsuariosDb, listarEstablecimientos } from '../src/database/db';

describe('Aprovisionamiento Masivo de Usuarios Directores de Establecimiento', () => {
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

  it('cuenta con el catálogo completo de 89 directores del territorio', () => {
    expect(DIRECTORES_TERRITORIO.length).toBe(89);
    for (const d of DIRECTORES_TERRITORIO) {
      expect(d.email).toContain('@eduvallediguillin.gob.cl');
      expect(d.username).toContain('@eduvallediguillin.gob.cl');
      expect(d.rbd).toBeTruthy();
      expect(d.role).toBe('director_establecimiento');
    }
  });

  it('siembra automáticamente los directores al inicializar usuarios en AuthService', async () => {
    const usuarios = await AuthService.getUsuarios();
    expect(usuarios.length).toBeGreaterThanOrEqual(90); // Super admin + 89 directores

    const directorJose = usuarios.find(u => u.email === 'jose.becerra@eduvallediguillin.gob.cl');
    expect(directorJose).toBeDefined();
    expect(directorJose?.username).toBe('jose.becerra@eduvallediguillin.gob.cl');
    expect(directorJose?.role).toBe('director_establecimiento');
    expect(directorJose?.rbdAsignado).toBe('17742');
    expect(directorJose?.activo).toBe(true);

    // Verificar que la contraseña coincide con el hash SHA-256 de '12346' con su salt
    const computedHash = await hashPassword('12346', directorJose!.salt);
    expect(computedHash).toBe(directorJose!.passwordHash);
  });

  it('ejecuta generarUsuariosDirectoresMasivo actualizando y creando cuentas idempotentemente', async () => {
    const res = await AuthService.generarUsuariosDirectoresMasivo(DIRECTORES_TERRITORIO, '12346');
    expect(res.totalProcesados).toBe(89);
    expect(res.errores.length).toBe(0);

    const usuarios = await AuthService.getUsuarios();
    const directores = usuarios.filter(u => u.role === 'director_establecimiento');
    expect(directores.length).toBe(89);

    // Segundo pase idempotente: no debe duplicar cuentas
    const res2 = await AuthService.generarUsuariosDirectoresMasivo(DIRECTORES_TERRITORIO, '12346');
    expect(res2.totalProcesados).toBe(89);
    expect(res2.creados).toBe(0);
    expect(res2.actualizados).toBe(89);

    const usuarios2 = await AuthService.getUsuarios();
    const directores2 = usuarios2.filter(u => u.role === 'director_establecimiento');
    expect(directores2.length).toBe(89);
  });

  it('permite autenticación exitosa con el correo del director y clave 12346', async () => {
    await AuthService.getUsuarios();
    const sesion = await AuthService.login('mario.silva@eduvallediguillin.gob.cl', '12346');
    expect(sesion).toBeDefined();
    expect(sesion.usuario.email).toBe('mario.silva@eduvallediguillin.gob.cl');
    expect(sesion.usuario.role).toBe('director_establecimiento');
    expect(sesion.usuario.rbdAsignado).toBe('3980');
  });

  it('persiste los 89 directores en la base de datos SQLite (usuarios_sistema y establecimientos)', async () => {
    await AuthService.generarUsuariosDirectoresMasivo(DIRECTORES_TERRITORIO, '12346');

    const usuariosDb = await listarUsuariosDb();
    const directoresDb = usuariosDb.filter(u => u.role === 'director_establecimiento');
    expect(directoresDb.length).toBe(89);

    const establecimientosDb = await listarEstablecimientos();
    const estBecerra = establecimientosDb.find(e => e.rbd === '17742');
    expect(estBecerra).toBeDefined();
    expect(estBecerra?.director).toBe('José Becerra');
    expect(estBecerra?.email).toBe('jose.becerra@eduvallediguillin.gob.cl');
  });
});
