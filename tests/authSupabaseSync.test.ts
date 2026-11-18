import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const rpcMock = vi.fn();
  const signInWithPasswordMock = vi.fn();
  const updateUserMock = vi.fn();
  const signOutMock = vi.fn();
  const signUpMock = vi.fn();
  const fromMock = vi.fn();
  return {
    rpcMock,
    signInWithPasswordMock,
    updateUserMock,
    signOutMock,
    signUpMock,
    fromMock
  };
});

vi.mock('../src/services/supabaseClient', () => ({
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon-key',
  SUPABASE_PUBLISHABLE_KEY: 'pub-key',
  isSupabaseEnabled: () => true,
  supabase: {
    rpc: mocks.rpcMock,
    from: mocks.fromMock,
    auth: {
      signInWithPassword: mocks.signInWithPasswordMock,
      updateUser: mocks.updateUserMock,
      signOut: mocks.signOutMock,
      signUp: mocks.signUpMock,
      getSession: vi.fn(async () => ({ data: { session: { access_token: 'jwt-ok' } } }))
    }
  }
}));

import { AuthService, hashPassword, generateSalt } from '../src/services/authService';
import { colegiosVisibles, puedeAccederRbd } from '../src/services/scopeService';
import { Establecimiento } from '../src/types';
import { UsuarioSistema } from '../src/types/authTypes';

describe('Sincronización de Credenciales con Supabase Auth y RLS', () => {
  const store: Record<string, string> = {};
  let remoteRows: any[] = [];
  let upsertUsuariosCalls: any[] = [];

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
    vi.clearAllMocks();
    remoteRows = [];
    upsertUsuariosCalls = [];

    mocks.fromMock.mockImplementation((table: string) => {
      if (table === 'usuarios_sistema') {
        return {
          select: vi.fn(async () => ({ data: remoteRows, error: null })),
          upsert: vi.fn(async (payload: any) => {
            upsertUsuariosCalls.push(payload);
            return { error: null };
          }),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              neq: vi.fn(async () => ({ error: null }))
            }))
          }))
        };
      }
      if (table === 'establecimientos') {
        return {
          select: vi.fn(() => ({
            in: vi.fn(async () => ({
              data: [{ rbd: '3669' }],
              error: null
            }))
          })),
          upsert: vi.fn(async () => ({ error: null }))
        };
      }
      if (table === 'asesor_cartera') {
        return {
          delete: vi.fn(() => ({
            eq: vi.fn(async () => ({ error: null }))
          })),
          upsert: vi.fn(async () => ({ error: null }))
        };
      }
      if (table === 'configuracion_general') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn(async () => ({ data: null, error: null }))
            }))
          }))
        };
      }
      return {
        select: vi.fn(async () => ({ data: [], error: null })),
        upsert: vi.fn(async () => ({ error: null }))
      };
    });

    mocks.signOutMock.mockResolvedValue({ error: null });
    mocks.updateUserMock.mockResolvedValue({ data: { user: { id: 'uid-1' } }, error: null });
  });

  it('invoca admin_sync_user_credentials cuando el Super Usuario reinicia la contraseña', async () => {
    mocks.rpcMock.mockResolvedValue({ data: 'uid-target-1', error: null });

    const directora: UsuarioSistema = {
      id: 'user-dir-3669',
      username: 'marcelapaz.munoz@eduvallediguillin.gob.cl',
      email: 'marcelapaz.munoz@eduvallediguillin.gob.cl',
      nombreCompleto: 'Marcela Muñoz Sepúlveda',
      role: 'director_establecimiento',
      cargo: 'Directora',
      rbdAsignado: '3669',
      passwordHash: 'old',
      salt: 'old-salt',
      activo: true,
      debeCambiarPassword: true
    };

    const res = await AuthService.guardarUsuario(
      { ...directora, debeCambiarPassword: false },
      'NuevaClaveSlep#2027'
    );

    expect(res.debeCambiarPassword).toBe(false);
    expect(mocks.rpcMock).toHaveBeenCalledWith(
      'admin_sync_user_credentials',
      expect.objectContaining({
        p_user_id: 'user-dir-3669',
        p_email: 'marcelapaz.munoz@eduvallediguillin.gob.cl',
        p_password_plain: 'NuevaClaveSlep#2027',
        p_debe_cambiar_password: false
      })
    );
  });

  it('sincroniza automáticamente con verify_and_sync_auth_user en el login tras un reset y no hace upsert directo con RLS', async () => {
    const salt = generateSalt();
    const nuevaClave = 'ClaveResetada#2027';
    const hash = await hashPassword(nuevaClave, salt);

    remoteRows = [
      {
        id: 'user-utp-3669',
        username: 'marcela.luengo@eduvallediguillin.gob.cl',
        email: 'marcela.luengo@eduvallediguillin.gob.cl',
        nombre_completo: 'Marcela Luengo',
        role: 'jefe_utp_establecimiento',
        cargo: 'Jefe UTP',
        rbd_asignado: '3669',
        cartera_rbds_json: [],
        asesores_supervisados_json: [],
        comunas_permitidas_json: [],
        activo: true,
        debe_cambiar_password: false
      }
    ];

    mocks.signInWithPasswordMock
      .mockResolvedValueOnce({ data: { user: null }, error: { message: 'Invalid login credentials', status: 400 } })
      .mockResolvedValueOnce({ data: { user: { id: 'auth-uid-utp' } }, error: null });

    mocks.rpcMock.mockImplementation(async (fn: string, params?: any) => {
      if (fn === 'get_login_challenge') {
        return {
          data: [
            {
              id: 'user-utp-3669',
              email: 'marcela.luengo@eduvallediguillin.gob.cl',
              role: 'jefe_utp_establecimiento',
              activo: true,
              salt,
              kdf_prefix: 'pbkdf2_sha256$100000'
            }
          ],
          error: null
        };
      }
      if (fn === 'verify_and_sync_auth_user') {
        expect(params.p_password_plain).toBe(nuevaClave);
        expect(params.p_candidate_hash).toBe(hash);
        return { data: true, error: null };
      }
      if (fn === 'link_my_auth_uid') {
        return { data: true, error: null };
      }
      if (fn === 'get_pausa_revision_publica') {
        return { data: null, error: null };
      }
      return { data: null, error: null };
    });

    const sesion = await AuthService.login('marcela.luengo@eduvallediguillin.gob.cl', nuevaClave);
    expect(sesion.usuario.id).toBe('user-utp-3669');
    expect(mocks.signInWithPasswordMock).toHaveBeenCalledTimes(2);
    expect(mocks.rpcMock).toHaveBeenCalledWith('link_my_auth_uid');
    // Un usuario no-admin no debe intentar upsert directo a public.usuarios_sistema al loguearse
    expect(upsertUsuariosCalls.length).toBe(0);
  });

  it('cambia la contraseña propia vía updateUser + update_my_profile_secrets sin violar RLS con upsert directo', async () => {
    remoteRows = [
      {
        id: 'user-dir-3849',
        username: 'marcia.llanos@eduvallediguillin.gob.cl',
        email: 'marcia.llanos@eduvallediguillin.gob.cl',
        nombre_completo: 'Marcia Llanos Orozco',
        role: 'director_establecimiento',
        cargo: 'Directora',
        rbd_asignado: '3849',
        cartera_rbds_json: [],
        asesores_supervisados_json: [],
        comunas_permitidas_json: [],
        activo: true,
        debe_cambiar_password: true
      }
    ];

    localStorage.setItem(
      'slep_auth_session_v1',
      JSON.stringify({
        usuario: {
          id: 'user-dir-3849',
          username: 'marcia.llanos@eduvallediguillin.gob.cl',
          email: 'marcia.llanos@eduvallediguillin.gob.cl',
          nombreCompleto: 'Marcia Llanos Orozco',
          role: 'director_establecimiento',
          cargo: 'Directora',
          rbdAsignado: '3849',
          activo: true,
          debeCambiarPassword: true
        },
        token: 'token_test',
        iniciadoEn: new Date().toISOString()
      })
    );

    mocks.rpcMock.mockResolvedValue({ data: true, error: null });

    await AuthService.cambiarPassword('user-dir-3849', 'MiClavePersonal#2027');

    expect(mocks.updateUserMock).toHaveBeenCalledWith({ password: 'MiClavePersonal#2027' });
    expect(mocks.rpcMock).toHaveBeenCalledWith(
      'update_my_profile_secrets',
      expect.objectContaining({
        p_debe_cambiar_password: false,
        p_password_plain: 'MiClavePersonal#2027',
        p_password_hash: expect.stringMatching(/^pbkdf2_sha256\$100000\$/),
        p_salt: expect.any(String)
      })
    );
    expect(upsertUsuariosCalls.length).toBe(0);
    expect(AuthService.getSessionActual()?.usuario.debeCambiarPassword).toBe(false);
  });

  it('aísla estrictamente el RBD de cada director (no cruza con RBD 3888 Víctor Jara) y fusiona perfil único RLS sin duplicar', async () => {
    const colegios = [
      { id: 'est-3888', rbd: '3888', nombre: 'COLEGIO BICENTENARIO DE EXCELENCIA POLITECNICO VICTOR JARA', comuna: 'San Ignacio', regimen: 'JEC', porcentajePrioritarios: 80 },
      { id: 'est-3669', rbd: '3669', nombre: 'ESCUELA BÁSICA ROSITA O´HIGGINS RIQUELME', comuna: 'Chillán', regimen: 'JEC', porcentajePrioritarios: 80 },
      { id: 'est-3849', rbd: '3849', nombre: 'ESCUELA CAMILO HENRIQUEZ', comuna: 'El Carmen', regimen: 'JEC', porcentajePrioritarios: 80 }
    ] as Establecimiento[];

    const directora3669: UsuarioSistema = {
      id: 'user-cloud-uuid-3669',
      username: 'marcelapaz.munoz@eduvallediguillin.gob.cl',
      email: 'marcelapaz.munoz@eduvallediguillin.gob.cl',
      nombreCompleto: 'Marcela Muñoz Sepúlveda',
      role: 'director_establecimiento',
      cargo: 'Directora',
      rbdAsignado: ' 3669 ',
      activo: true
    };

    const visibles = colegiosVisibles(directora3669, colegios);
    expect(visibles.map(c => c.rbd)).toEqual(['3669']);
    expect(puedeAccederRbd(directora3669, '3669', colegios)).toBe(true);
    expect(puedeAccederRbd(directora3669, '3888', colegios)).toBe(false);

    // Simular respuesta RLS de 1 sola fila con ID diferente al de la semilla local y sin rbd_asignado
    remoteRows = [
      {
        id: 'user-cloud-alt-3849',
        username: 'marcia.llanos@eduvallediguillin.gob.cl',
        email: 'marcia.llanos@eduvallediguillin.gob.cl',
        nombre_completo: 'Marcia Llanos Orozco',
        role: 'director_establecimiento',
        cargo: 'Directora',
        rbd_asignado: null,
        cartera_rbds_json: [],
        asesores_supervisados_json: [],
        comunas_permitidas_json: [],
        activo: true,
        debe_cambiar_password: false
      }
    ];

    const usuarios = await AuthService.getUsuarios();
    const coincidenciasMarcia = usuarios.filter(u => u.email?.toLowerCase() === 'marcia.llanos@eduvallediguillin.gob.cl');
    expect(coincidenciasMarcia.length).toBe(1);
    expect(coincidenciasMarcia[0].id).toBe('user-cloud-alt-3849');
    expect(coincidenciasMarcia[0].rbdAsignado).toBe('3849');
  });
});
