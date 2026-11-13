import { UsuarioSistema, UserRole, PermisosRol, AuthSession, RolId, EstadoPausaRevision, ResumenEstamentoPausa } from '../types/authTypes';
import { normalizarRol, ROLES_DEFINICIONES } from '../security/rolesDefinitions';
import { RolesPermisosService } from './rolesPermisosService';
import { DIRECTORES_TERRITORIO, DirectorItem } from '../data/directoresTerritorio';
import { supabase, isSupabaseEnabled } from './supabaseClient';
import {
  listarUsuariosDb,
  guardarUsuarioDb,
  guardarUsuariosBatchDb,
  eliminarUsuarioDb,
  actualizarEstadoUsuariosMasivoDb,
  parseJsonArray
} from '../database/repositories/usuariosRepo';
import {
  listarEstablecimientos,
  guardarEstablecimiento,
  listarRbdsEliminados
} from '../database/repositories/establecimientosRepo';
import { SupabaseDotacionService } from './supabaseDotacionService';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';

const STORAGE_USERS_KEY = 'slep_usuarios_sistema_v2';
const STORAGE_SESSION_KEY = 'slep_auth_session_v1';
export const STORAGE_PAUSA_KEY = 'slep_pausa_revision_interna_v1';

/**
 * Roles estrictamente excluidos y blindados de cualquier inactivación o pausa masiva.
 * Garantiza que Super Usuarios, Asesores UATP, Coordinadores UATP y Subdirectores mantengan acceso ininterrumpido.
 */
export const ROLES_EXENTOS_PAUSA: readonly RolId[] = [
  'super_usuario',
  'subdirector_uatp',
  'coordinador_uatp',
  'asesor_uatp'
] as const;

/**
 * Roles que corresponden al estamento de establecimientos escolares,
 * cuyo trabajo de edición se congela temporalmente para iniciar la revisión interna UATP.
 */
export const ROLES_PAUSABLES_ESTAMENTO: readonly RolId[] = [
  'director_establecimiento',
  'jefe_utp_establecimiento'
] as const;

// FunciÃ³n para derivar hash criptogrÃ¡fico usando SHA-256 con Salt
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_PREFIX = 'pbkdf2_sha256';

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function legacySha256Hash(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(hashBuffer));
}

export async function hashPassword(password: string, salt: string, iterations: number = PBKDF2_ITERATIONS): Promise<string> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: encoder.encode(salt),
      iterations,
      hash: 'SHA-256'
    },
    keyMaterial,
    256
  );
  return `${PBKDF2_PREFIX}$${iterations}$${bytesToHex(new Uint8Array(derivedBits))}`;
}

export async function verifyPassword(passwordPlain: string, salt: string, storedHash: string): Promise<boolean> {
  if (!salt || !storedHash) return false;
  if (storedHash.startsWith(`${PBKDF2_PREFIX}$`)) {
    const parts = storedHash.split('$');
    const iterations = Number(parts[1]);
    if (parts.length !== 3 || !Number.isFinite(iterations) || iterations < 10000) {
      return false;
    }
    const candidate = await hashPassword(passwordPlain, salt, iterations);
    return timingSafeEqualStr(candidate, storedHash);
  }
  const legacyCandidate = await legacySha256Hash(passwordPlain, salt);
  return timingSafeEqualStr(legacyCandidate, storedHash);
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera una clave temporal aleatoria criptogrÃ¡ficamente segura (CSPRNG)
 * sin dejar cadenas fijas en el cÃ³digo fuente.
 */
export function generarPasswordTemporalSegura(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  const token = Array.from(arr).map(b => alphabet[b % alphabet.length]).join('');
  return `Slep-${token}`;
}

// Cuenta oficial de Super Usuario Administrador
// Sin contraseÃ±as en texto plano en el cÃ³digo fuente (resguardo SAST / GitGuardian).
// La autenticaciÃ³n real se delega a Firebase Auth o al hash sellado en el primer inicio de sesiÃ³n.
export const USUARIOS_SEMILLA_BASE: Array<Omit<UsuarioSistema, 'passwordHash' | 'salt'>> = [
  {
    id: 'user-saxneal-superadmin',
    username: 'saxneal@gmail.com',
    nombreCompleto: 'Super Administrador SLEP (saxneal)',
    email: 'saxneal@gmail.com',
    role: 'super_usuario',
    cargo: 'Super Usuario / Administrador General del Territorio',
    activo: true
  }
];

const SUPER_USUARIO_EMAIL = 'saxneal@gmail.com';

const SUPABASE_USER_PUBLIC_COLUMNS =
  'id, username, email, nombre_completo, role, cargo, rbd_asignado, cartera_rbds_json, asesores_supervisados_json, comunas_permitidas_json, gemini_api_key, activo, debe_cambiar_password, ultimo_acceso, auth_uid';

function isNetworkAuthError(err: any): boolean {
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('err_name_not_resolved') ||
    msg.includes('enotfound') ||
    msg.includes('fetch') ||
    err?.status === 0 ||
    (typeof err?.status === 'number' && err.status >= 500)
  );
}

function sanitizarUsuariosParaLocalStorage(usuarios: UsuarioSistema[], currentUserId?: string): UsuarioSistema[] {
  return usuarios.map(u => {
    const esPropio = Boolean(currentUserId && u.id === currentUserId);
    if (esPropio) return u;
    const { geminiApiKey: _omitKey, ...resto } = u;
    return resto;
  });
}

/** Migra roles heredados (admin/asesor/director_colegio/auditor) a los roles UATP vigentes. */
export function migrarUsuario(u: UsuarioSistema): { usuario: UsuarioSistema; cambiado: boolean } {
  let cambiado = false;
  const rol = (u.email || '').toLowerCase() === SUPER_USUARIO_EMAIL ? 'super_usuario' : normalizarRol(u.role);
  const out: UsuarioSistema = { ...u };
  if (rol !== u.role) { out.role = rol; cambiado = true; }
  return { usuario: out, cambiado };
}

export class AuthService {
  private static async inicializarUsuariosSiNoExisten(): Promise<UsuarioSistema[]> {
    // Purgar cuentas simuladas obsoletas de la versiÃ³n 1
    localStorage.removeItem('slep_usuarios_sistema_v1');

    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UsuarioSistema[];
        const tieneSaxneal = parsed.some(u => (u.email || '').toLowerCase() === SUPER_USUARIO_EMAIL);
        if (tieneSaxneal) {
          let huboMigracion = false;
          let migrados = parsed.map(u => {
            const r = migrarUsuario(u);
            if (r.cambiado) huboMigracion = true;
            return r.usuario;
          });

          // Verificar si ya se sembraron los directores del territorio
          const tieneDirectores = migrados.some(u => u.role === 'director_establecimiento');
          if (!tieneDirectores && DIRECTORES_TERRITORIO.length > 0) {
            huboMigracion = true;
            const passwordDirectores = '123456';
            const faltantes = DIRECTORES_TERRITORIO.filter(d => {
              const cleanEmail = d.email.trim().toLowerCase();
              return !migrados.some(
                u => (u.email && u.email.toLowerCase() === cleanEmail) || u.username.toLowerCase() === cleanEmail
              );
            });
            const nuevosDirectores = await Promise.all(
              faltantes.map(async d => {
                const cleanEmail = d.email.trim().toLowerCase();
                const salt = generateSalt();
                const passwordHash = await hashPassword(passwordDirectores, salt);
                return {
                  id: `user-dir-${d.rbd}`,
                  username: cleanEmail,
                  email: cleanEmail,
                  nombreCompleto: d.director,
                  role: 'director_establecimiento' as const,
                  cargo: d.cargo,
                  rbdAsignado: d.rbd,
                  passwordHash,
                  salt,
                  activo: true,
                  debeCambiarPassword: true
                };
              })
            );
            migrados.push(...nuevosDirectores);
          }

          if (huboMigracion) {
            localStorage.setItem(
              STORAGE_USERS_KEY,
              JSON.stringify(sanitizarUsuariosParaLocalStorage(migrados, this.getSessionActual()?.usuario.id))
            );
          }
          return migrados;
        }
      } catch (e) {
        console.error('Error parseando usuarios, resembrando...', e);
      }
    }

    // Sembrar super usuario oficial sin contraseñas en texto plano en el código
    const env = (import.meta as any).env || {};
    const initialSalt = env.VITE_SUPERADMIN_INITIAL_SALT || '';
    const initialHash = env.VITE_SUPERADMIN_INITIAL_HASH || '';

    const usuariosNuevos: UsuarioSistema[] = [];
    for (const u of USUARIOS_SEMILLA_BASE) {
      usuariosNuevos.push({
        id: u.id,
        username: u.username,
        nombreCompleto: u.nombreCompleto,
        email: u.email,
        role: u.role,
        cargo: u.cargo,
        passwordHash: initialHash,
        salt: initialSalt,
        rbdAsignado: u.rbdAsignado,
        comunasPermitidas: u.comunasPermitidas,
        activo: u.activo
      });
    }

    // Sembrar directores territoriales iniciales con contraseña 123456
    const passwordDirectores = '123456';
    const directoresSemilla = await Promise.all(
      DIRECTORES_TERRITORIO.map(async d => {
        const cleanEmail = d.email.trim().toLowerCase();
        const salt = generateSalt();
        const passwordHash = await hashPassword(passwordDirectores, salt);
        return {
          id: `user-dir-${d.rbd}`,
          username: cleanEmail,
          email: cleanEmail,
          nombreCompleto: d.director,
          role: 'director_establecimiento' as const,
          cargo: d.cargo,
          rbdAsignado: d.rbd,
          passwordHash,
          salt,
          activo: true,
          debeCambiarPassword: true
        };
      })
    );
    usuariosNuevos.push(...directoresSemilla);

    localStorage.setItem(
      STORAGE_USERS_KEY,
      JSON.stringify(sanitizarUsuariosParaLocalStorage(usuariosNuevos, this.getSessionActual()?.usuario.id))
    );
    return usuariosNuevos;
  }

  /**
   * Obtiene de forma síncrona/instantánea los usuarios guardados en caché local (localStorage).
   * Permite renderizado optimista sin esperar la respuesta de red de Supabase.
   */
  public static getUsuariosLocal(): UsuarioSistema[] {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as UsuarioSistema[];
    } catch {
      return [];
    }
  }

  public static async getUsuarios(): Promise<UsuarioSistema[]> {
    let usuarios = await this.inicializarUsuariosSiNoExisten();

    // 1. Fusionar usuarios desde SQLite WASM (usuarios_sistema) si existen
    let huboCambiosParaSqlite = false;
    let sqlUsersLen = 0;
    try {
      const sqlUsers = await listarUsuariosDb();
      sqlUsersLen = sqlUsers.length;
      if (sqlUsers.length > 0) {
        const mapLocal = new Map<string, UsuarioSistema>();
        usuarios.forEach(u => mapLocal.set(u.id, u));
        for (const su of sqlUsers) {
          let prevKey = su.id;
          let prev = mapLocal.get(prevKey);
          if (!prev) {
            const matchEntry = Array.from(mapLocal.entries()).find(([, u]) =>
              (su.email && (u.email || '').toLowerCase() === su.email.toLowerCase()) ||
              u.username.toLowerCase() === su.username.toLowerCase()
            );
            if (matchEntry) {
              prevKey = matchEntry[0];
              prev = matchEntry[1];
              mapLocal.delete(prevKey);
            }
          }
          if (!prev) {
            mapLocal.set(su.id, su);
          } else {
            mapLocal.set(su.id, {
              ...prev,
              ...su,
              passwordHash: su.passwordHash || prev.passwordHash,
              salt: su.salt || prev.salt,
              rbdAsignado: su.rbdAsignado !== undefined ? su.rbdAsignado : prev.rbdAsignado,
              debeCambiarPassword: su.debeCambiarPassword !== undefined ? su.debeCambiarPassword : prev.debeCambiarPassword,
              carteraRbds: su.carteraRbds !== undefined ? su.carteraRbds : (prev.carteraRbds || []),
              asesoresSupervisados: su.asesoresSupervisados !== undefined ? su.asesoresSupervisados : (prev.asesoresSupervisados || [])
            });
          }
        }
        usuarios = Array.from(mapLocal.values());
      }
    } catch {
      // Fallback seguro si SQLite aÃºn no estÃ¡ inicializado
    }

    // 2.0 Sincronización desde Supabase PostgreSQL (Fuente Primaria en Nube, sin exponer password_hash ni salt)
    if (isSupabaseEnabled()) {
      try {
        const { data: supaUsers, error: supaErr } = await supabase
          .from('usuarios_sistema')
          .select(SUPABASE_USER_PUBLIC_COLUMNS);

        if (!supaErr && supaUsers && supaUsers.length > 0) {
          const mapLocalById = new Map(usuarios.map(u => [u.id, u]));
          const activeUserId = this.getSessionActual()?.usuario.id;
          const remoteUsers: UsuarioSistema[] = [];

          for (const row of supaUsers as any[]) {
            const emailKey = (row.email || '').toLowerCase();
            const esSuper = emailKey === SUPER_USUARIO_EMAIL;
            const rol = esSuper ? 'super_usuario' : normalizarRol(row.role || 'asesor_uatp');

            const carteraRbds = parseJsonArray(row.cartera_rbds_json);
            const asesoresSupervisados = parseJsonArray(row.asesores_supervisados_json);
            const comunasArr = parseJsonArray(row.comunas_permitidas_json);
            const prevLocal = mapLocalById.get(row.id);

            remoteUsers.push({
              id: row.id,
              username: row.username || row.email || row.id,
              email: row.email || row.username || `${row.id}@slepvallediguillin.cl`,
              nombreCompleto: row.nombre_completo || 'Usuario SLEP',
              role: rol,
              cargo: row.cargo || 'Funcionario SLEP',
              rbdAsignado: row.rbd_asignado && row.rbd_asignado !== 'S/RBD' ? String(row.rbd_asignado).trim() : undefined,
              carteraRbds,
              asesoresSupervisados,
              comunasPermitidas: comunasArr.length > 0 ? comunasArr : undefined,
              passwordHash: prevLocal?.passwordHash || '',
              salt: prevLocal?.salt || '',
              geminiApiKey: row.gemini_api_key || (row.id === activeUserId ? prevLocal?.geminiApiKey : undefined),
              activo: row.activo !== false,
              debeCambiarPassword: Boolean(row.debe_cambiar_password),
              ultimoAcceso: row.ultimo_acceso || undefined
            });
          }

          if (remoteUsers.length > 1) {
            // Vista administrativa completa: asegurar superusuario y purgar obsoletos en SQLite
            if (!remoteUsers.some(u => (u.email || '').toLowerCase() === SUPER_USUARIO_EMAIL)) {
              const superLocal = usuarios.find(u => (u.email || '').toLowerCase() === SUPER_USUARIO_EMAIL);
              if (superLocal) remoteUsers.push(superLocal);
            }
            try {
              const { getDb, persistDb } = await import('../database/dbCore');
              const db = await getDb();
              const validIds = remoteUsers.map(u => u.id);
              const placeholders = validIds.map(() => '?').join(',');
              if (placeholders) {
                db.run('DELETE FROM usuarios_sistema WHERE id NOT IN (' + placeholders + ')', validIds);
                await persistDb();
              }
            } catch (_) {}
            usuarios = remoteUsers;
          } else {
            // Vista filtrada por RLS (usuario no-admin recibe únicamente su propio perfil): fusionar sin borrar directorio local
            for (const ru of remoteUsers) {
              const idx = usuarios.findIndex(u => u.id === ru.id);
              if (idx >= 0) usuarios[idx] = ru;
              else usuarios.push(ru);
            }
          }

          huboCambiosParaSqlite = true;
          localStorage.setItem(
            STORAGE_USERS_KEY,
            JSON.stringify(sanitizarUsuariosParaLocalStorage(usuarios, activeUserId))
          );
        }
      } catch {
        // Fallback silencioso a local
      }
    }

    // 4. Persistir todos los usuarios en la tabla SQLite local (sin re-subir en segundo plano a Supabase)
    if (huboCambiosParaSqlite || sqlUsersLen < usuarios.length) {
      await guardarUsuariosBatchDb(usuarios, true).catch(() => {});
    }

    return usuarios;
  }

  public static async login(usernameOrEmail: string, passwordPlain: string): Promise<AuthSession> {
    const cleanInput = usernameOrEmail.trim().toLowerCase();
    let usuarios = await this.getUsuarios();

    // 1. Si es el superusuario saxneal@gmail.com, asegurar inicialización local base
    if (cleanInput === SUPER_USUARIO_EMAIL || cleanInput === 'saxneal') {
      usuarios = await this.inicializarUsuariosSiNoExisten();
    }

    const buscarUsuarioEnLista = (lista: UsuarioSistema[], targetEmail?: string) =>
      lista.find(
        u =>
          (targetEmail && u.email && u.email.toLowerCase() === targetEmail) ||
          u.username.toLowerCase() === cleanInput ||
          (u.email && u.email.toLowerCase() === cleanInput) ||
          (u.email && u.email.toLowerCase().split('@')[0] === cleanInput)
      );

    let encontrado = buscarUsuarioEnLista(usuarios);
    let authenticatedViaSupabase = false;

    // 2. Autenticación primaria contra Supabase Auth cuando está habilitado (habilita JWT + RLS estricto)
    if (isSupabaseEnabled()) {
      let resolvedEmail = encontrado?.email?.toLowerCase() || (cleanInput.includes('@') ? cleanInput : '');
      try {
        const { data: rpcRows, error: rpcErr } = await supabase.rpc('resolve_login_profile', { p_login: cleanInput });
        if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0 && rpcRows[0]?.email) {
          resolvedEmail = String(rpcRows[0].email).trim().toLowerCase();
          if (rpcRows[0].activo === false) {
            throw new Error('Esta cuenta ha sido deshabilitada por el administrador.');
          }
        }
      } catch (rpcException: any) {
        if (rpcException?.message?.includes('deshabilitada')) {
          throw rpcException;
        }
      }

      if (resolvedEmail) {
        try {
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: resolvedEmail,
            password: passwordPlain
          });

          if (!authError && authData?.user) {
            authenticatedViaSupabase = true;
            await supabase.rpc('link_my_auth_uid').then(() => {}, () => {});
            usuarios = await this.getUsuarios();
            encontrado = buscarUsuarioEnLista(usuarios, resolvedEmail);
          } else if (authError && !isNetworkAuthError(authError)) {
            // Verificar si corresponde a cuenta heredada aún no migrada a auth.users
            const localMatch =
              encontrado &&
              encontrado.salt &&
              encontrado.passwordHash &&
              (await verifyPassword(passwordPlain, encontrado.salt, encontrado.passwordHash));

            if (localMatch) {
              const { data: signUpData } = await supabase.auth.signUp({
                email: resolvedEmail,
                password: passwordPlain
              });
              if (signUpData?.session || signUpData?.user) {
                authenticatedViaSupabase = Boolean(signUpData?.session);
                if (authenticatedViaSupabase) {
                  await supabase.rpc('link_my_auth_uid').then(() => {}, () => {});
                }
              }
            } else {
              throw new Error('Contraseña incorrecta. Verifique sus credenciales.');
            }
          }
        } catch (authFlowErr: any) {
          if (!isNetworkAuthError(authFlowErr)) {
            throw authFlowErr;
          }
          // Si falló por red/offline, continúa hacia validación local PBKDF2 en caché SQLite
        }
      }
    }

    // Si el usuario está registrado pero fue deshabilitado o su estamento está en pausa de revisión interna
    if (encontrado) {
      const rolNorm = normalizarRol(encontrado.role);
      const esProtegido = (encontrado.email || '').toLowerCase() === SUPER_USUARIO_EMAIL || ROLES_EXENTOS_PAUSA.includes(rolNorm);
      if (!encontrado.activo || !esProtegido) {
        const pausa = (await this.sincronizarEstadoPausaDesdeNube().catch(() => null)) || this.getEstadoPausaRevision();
        if (pausa?.activa && pausa.rolesAfectados.includes(rolNorm) && !esProtegido) {
          if (authenticatedViaSupabase) await supabase.auth.signOut().catch(() => {});
          throw new Error(
            `Acceso pausado por Revisión Interna UATP: El trabajo para su estamento se encuentra suspendido temporalmente mientras el equipo territorial realiza la auditoría de dotación. Motivo: ${pausa.motivo || 'Revisión técnica en curso'}.`
          );
        }
        if (!encontrado.activo) {
          if (authenticatedViaSupabase) await supabase.auth.signOut().catch(() => {});
          throw new Error('Esta cuenta ha sido deshabilitada por el administrador.');
        }
      }
    }
    if (!encontrado) {
      if (authenticatedViaSupabase) await supabase.auth.signOut().catch(() => {});
      throw new Error('Usuario no encontrado o cuenta deshabilitada.');
    }

    // 3. Validación criptográfica local PBKDF2 (obligatoria en modo offline / Vitest; en online actualiza verificador local)
    if (!authenticatedViaSupabase) {
      const esSuperUsuarioInicial =
        (encontrado.email || '').toLowerCase() === SUPER_USUARIO_EMAIL &&
        !encontrado.passwordHash &&
        !encontrado.salt &&
        passwordPlain.trim().length >= 6;

      if (esSuperUsuarioInicial) {
        const nuevoSalt = generateSalt();
        encontrado.salt = nuevoSalt;
        encontrado.passwordHash = await hashPassword(passwordPlain, nuevoSalt);
      }

      if (!encontrado.passwordHash || !encontrado.salt) {
        throw new Error('La cuenta no tiene credenciales inicializadas. Solicite restablecimiento al administrador.');
      }

      const localPasswordOk = await verifyPassword(passwordPlain, encontrado.salt, encontrado.passwordHash);
      if (!localPasswordOk) {
        throw new Error('Contraseña incorrecta. Verifique sus credenciales.');
      }

      // Migrar automáticamente hashes SHA-256 legados a PBKDF2-HMAC-SHA256 tras verificar
      if (!encontrado.passwordHash.startsWith(`${PBKDF2_PREFIX}$`)) {
        const nuevoSalt = generateSalt();
        encontrado.salt = nuevoSalt;
        encontrado.passwordHash = await hashPassword(passwordPlain, nuevoSalt);
      }
    } else if (!encontrado.passwordHash || !encontrado.passwordHash.startsWith(`${PBKDF2_PREFIX}$`)) {
      // Actualizar verificador local PBKDF2 para resiliencia offline tras autenticar con Supabase Auth
      const nuevoSalt = generateSalt();
      encontrado.salt = nuevoSalt;
      encontrado.passwordHash = await hashPassword(passwordPlain, nuevoSalt);
    }

    // Actualizar último acceso y refrescar cache
    encontrado.ultimoAcceso = new Date().toISOString();
    const existingIdx = usuarios.findIndex(u => u.id === encontrado!.id);
    if (existingIdx >= 0) {
      usuarios[existingIdx] = encontrado;
    } else {
      usuarios.push(encontrado);
    }
    localStorage.setItem(
      STORAGE_USERS_KEY,
      JSON.stringify(sanitizarUsuariosParaLocalStorage(usuarios, encontrado.id))
    );
    guardarUsuarioDb(encontrado).catch(() => {});

    // Si el usuario tiene una ApiKey personal configurada, activarla solo durante su sesión
    if (encontrado.geminiApiKey) {
      localStorage.setItem('gemini_api_key', encontrado.geminiApiKey);
    }

    const { passwordHash: _, salt: __, ...usuarioSeguro } = encontrado;
    const session: AuthSession = {
      usuario: usuarioSeguro,
      token: `token_${encontrado.id}_${Date.now()}`,
      iniciadoEn: new Date().toISOString()
    };

    localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    return session;
  }

  public static getSessionActual(): AuthSession | null {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (!raw) return null;
    try {
      const s = JSON.parse(raw) as AuthSession;
      if (s?.usuario) {
        const rol = (s.usuario.email || '').toLowerCase() === SUPER_USUARIO_EMAIL ? 'super_usuario' : normalizarRol(s.usuario.role);
        if (rol !== s.usuario.role) {
          s.usuario = { ...s.usuario, role: rol };
          localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(s));
        }
      }
      return s;
    } catch {
      return null;
    }
  }

  public static logout(): void {
    const sesionPrevia = this.getSessionActual();
    localStorage.removeItem(STORAGE_SESSION_KEY);
    if (isSupabaseEnabled()) {
      supabase.auth.signOut().catch(() => {});
    }
    // Limpieza de claves temporales de sincronización y API key personal para evitar contaminación cruzada entre sesiones
    if (typeof localStorage !== 'undefined') {
      try {
        if (
          sesionPrevia?.usuario?.geminiApiKey &&
          localStorage.getItem('gemini_api_key') === sesionPrevia.usuario.geminiApiKey
        ) {
          localStorage.removeItem('gemini_api_key');
        }
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('slep_last_cartera_sync_') || key.startsWith('slep_ui_colegio_activo'))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
      } catch (_) {}
    }
  }

  public static async verificarPasswordActual(usuario: UsuarioSistema, actualPasswordPlain: string): Promise<boolean> {
    if (usuario.passwordHash && usuario.salt) {
      const ok = await verifyPassword(actualPasswordPlain, usuario.salt, usuario.passwordHash);
      if (ok) return true;
    }
    if (isSupabaseEnabled() && usuario.email) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: usuario.email,
          password: actualPasswordPlain
        });
        return !error && Boolean(data?.user);
      } catch {
        return false;
      }
    }
    return false;
  }

  public static async restablecerPasswordPorEmail(email: string, nuevaPasswordPlain?: string): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    const usuarios = await this.getUsuarios();
    const idx = usuarios.findIndex(u => (u.email || '').toLowerCase() === cleanEmail);
    if (idx === -1) {
      throw new Error('No se encontró ninguna cuenta asociada a este correo electrónico institucional.');
    }

    if (nuevaPasswordPlain) {
      const salt = generateSalt();
      const passwordHash = await hashPassword(nuevaPasswordPlain, salt);
      usuarios[idx].salt = salt;
      usuarios[idx].passwordHash = passwordHash;
      localStorage.setItem(
        STORAGE_USERS_KEY,
        JSON.stringify(sanitizarUsuariosParaLocalStorage(usuarios, this.getSessionActual()?.usuario.id))
      );
      await guardarUsuarioDb(usuarios[idx]);
    }
    return usuarios[idx].nombreCompleto;
  }

  public static async guardarApiKeyUsuario(userId: string, apiKey: string): Promise<void> {
    const cleanKey = apiKey.trim();
    const usuarios = await this.getUsuarios();
    const idx = usuarios.findIndex(u => u.id === userId);
    if (idx >= 0) {
      usuarios[idx].geminiApiKey = cleanKey || undefined;
      localStorage.setItem(
        STORAGE_USERS_KEY,
        JSON.stringify(sanitizarUsuariosParaLocalStorage(usuarios, userId))
      );
      if (cleanKey) {
        localStorage.setItem('gemini_api_key', cleanKey);
      } else {
        localStorage.removeItem('gemini_api_key');
      }

      const sesionActual = this.getSessionActual();
      if (sesionActual && sesionActual.usuario.id === userId) {
        sesionActual.usuario.geminiApiKey = cleanKey || undefined;
        localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sesionActual));
      }

      if (isSupabaseEnabled()) {
        try {
          const { error } = await supabase.rpc('update_my_profile_secrets', {
            p_gemini_api_key: cleanKey
          });
          if (!error) {
            await guardarUsuarioDb(usuarios[idx], true);
            return;
          }
        } catch (_) {}
      }
      await guardarUsuarioDb(usuarios[idx]);
    }
  }

  public static async cambiarPassword(userId: string, nuevaPasswordPlain: string): Promise<void> {
    const usuarios = await this.getUsuarios();
    const idx = usuarios.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Usuario no encontrado');

    const salt = generateSalt();
    const passwordHash = await hashPassword(nuevaPasswordPlain, salt);
    usuarios[idx].salt = salt;
    usuarios[idx].passwordHash = passwordHash;
    usuarios[idx].debeCambiarPassword = false;
    localStorage.setItem(
      STORAGE_USERS_KEY,
      JSON.stringify(sanitizarUsuariosParaLocalStorage(usuarios, this.getSessionActual()?.usuario.id))
    );

    const sesionActual = this.getSessionActual();
    const esUsuarioActual = Boolean(
      sesionActual && (sesionActual.usuario.id === userId || sesionActual.usuario.username === usuarios[idx].username)
    );

    if (esUsuarioActual && isSupabaseEnabled()) {
      await supabase.auth.updateUser({ password: nuevaPasswordPlain }).catch(() => {});
      await supabase.rpc('update_my_profile_secrets', { p_debe_cambiar_password: false }).then(() => {}, () => {});
    }

    await guardarUsuarioDb(usuarios[idx]);

    // Refrescar sesión activa si corresponde al usuario autenticado
    if (sesionActual && esUsuarioActual) {
      sesionActual.usuario.debeCambiarPassword = false;
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sesionActual));
    }
  }

  public static async guardarUsuario(usuario: UsuarioSistema, passwordPlain?: string): Promise<UsuarioSistema> {
    const usuarios = await this.getUsuarios();
    const cleanUsername = (usuario.username || usuario.email || usuario.id).trim().toLowerCase();
    const cleanEmail = usuario.email
      ? usuario.email.trim().toLowerCase()
      : (cleanUsername.includes('@') ? cleanUsername : `${cleanUsername}@slepvallediguillin.cl`);
    usuario = {
      ...usuario,
      username: cleanUsername,
      email: cleanEmail,
      nombreCompleto: (usuario.nombreCompleto || '').trim(),
      role: normalizarRol(usuario.role),
      carteraRbds: (usuario.carteraRbds || []).map(r => String(r).trim()).filter(r => Boolean(r) && r !== 'S/RBD'),
      asesoresSupervisados: (usuario.asesoresSupervisados || []).map(a => String(a).trim()).filter(Boolean)
    };
    if ((usuario.email || '').toLowerCase() === SUPER_USUARIO_EMAIL) {
      usuario.role = 'super_usuario';
      usuario.activo = true;
    }

    // 1. Si se especificÃ³ contraseÃ±a, calcular Salt y SHA-256
    if (passwordPlain) {
      const salt = generateSalt();
      usuario.salt = salt;
      usuario.passwordHash = await hashPassword(passwordPlain, salt);
    }

    // 2. Buscar primero por id exacto; si no existe, por email o username
    let idx = usuarios.findIndex(u => u.id === usuario.id);
    if (idx === -1) {
      idx = usuarios.findIndex(
        u =>
          (usuario.email && (u.email || '').toLowerCase() === usuario.email.toLowerCase()) ||
          u.username.toLowerCase() === usuario.username.toLowerCase()
      );
    }

    if (idx >= 0) {
      // Conservar hash y metadatos previos si en esta ediciÃ³n no fueron modificados
      if (!usuario.passwordHash && usuarios[idx].passwordHash) {
        usuario.passwordHash = usuarios[idx].passwordHash;
        usuario.salt = usuarios[idx].salt;
      }
      if (usuario.ultimoAcceso === undefined && usuarios[idx].ultimoAcceso) {
        usuario.ultimoAcceso = usuarios[idx].ultimoAcceso;
      }
      if (usuario.geminiApiKey === undefined && usuarios[idx].geminiApiKey) {
        usuario.geminiApiKey = usuarios[idx].geminiApiKey;
      }
      if (usuario.comunasPermitidas === undefined && usuarios[idx].comunasPermitidas) {
        usuario.comunasPermitidas = usuarios[idx].comunasPermitidas;
      }
      if (usuario.debeCambiarPassword === undefined && usuarios[idx].debeCambiarPassword !== undefined) {
        usuario.debeCambiarPassword = usuarios[idx].debeCambiarPassword;
      }
      // Preservar siempre la clave primaria existente para que el UPDATE en SQLite/Supabase sea exacto
      usuario.id = usuarios[idx].id;
    }

    // Verificar que otro usuario distinto no tenga el mismo username o email
    const conflictoOtro = usuarios.find((u, i) =>
      i !== idx &&
      (
        u.username.toLowerCase() === usuario.username.toLowerCase() ||
        (usuario.email && u.email && u.email.toLowerCase() === usuario.email.toLowerCase())
      )
    );
    if (conflictoOtro) {
      throw new Error(`Ya existe otro usuario registrado con el login o correo "${usuario.username}" (${conflictoOtro.nombreCompleto}).`);
    }

    const resultante = idx >= 0
      ? usuarios.map((u, i) => (i === idx ? usuario : u))
      : [...usuarios, usuario];
    if (!resultante.some(u => u.role === 'super_usuario' && u.activo)) {
      throw new Error('Debe existir al menos un Super Usuario activo en el sistema.');
    }

    if (idx >= 0) {
      usuarios[idx] = usuario;
    } else {
      usuarios.push(usuario);
    }

    // Si este usuario es asesor_uatp y se le asignaron RBDs en carteraRbds,
    // desasignar esos mismos RBDs de las carteras explÃ­citas de otros asesores_uatp para evitar duplicidad.
    const otrosAsesoresModificados: UsuarioSistema[] = [];
    if (usuario.role === 'asesor_uatp' && usuario.carteraRbds && usuario.carteraRbds.length > 0) {
      const rbdSet = new Set(usuario.carteraRbds);
      for (let i = 0; i < usuarios.length; i++) {
        const otro = usuarios[i];
        if (otro.id !== usuario.id && normalizarRol(otro.role) === 'asesor_uatp' && otro.carteraRbds && otro.carteraRbds.length > 0) {
          const filtrada = otro.carteraRbds.filter(r => !rbdSet.has(r.trim()));
          if (filtrada.length !== otro.carteraRbds.length) {
            usuarios[i] = { ...otro, carteraRbds: filtrada };
            otrosAsesoresModificados.push(usuarios[i]);
          }
        }
      }
    }

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    await guardarUsuarioDb(usuario);
    for (const otroMod of otrosAsesoresModificados) {
      await guardarUsuarioDb(otroMod);
    }

    // 5. Si el usuario modificado es el de la sesiÃ³n actual, refrescar inmediatamente la sesiÃ³n activa
    const sesionActual = this.getSessionActual();
    if (sesionActual && (sesionActual.usuario.id === usuario.id || sesionActual.usuario.username === usuario.username)) {
      const { passwordHash: _, salt: __, ...usuarioSeguro } = usuario;
      const sesionActualizada: AuthSession = {
        ...sesionActual,
        usuario: usuarioSeguro
      };
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(sesionActualizada));
    }

    return usuario;
  }

  public static async toggleEstadoUsuario(userId: string, nuevoEstado: boolean): Promise<UsuarioSistema> {
    const usuarios = await this.getUsuarios();
    const idx = usuarios.findIndex(u => u.id === userId);
    if (idx === -1) throw new Error('Usuario no encontrado.');

    const u = usuarios[idx];
    if ((u.email || '').toLowerCase() === SUPER_USUARIO_EMAIL && !nuevoEstado) {
      throw new Error('No es posible deshabilitar la cuenta del Super Usuario oficial.');
    }

    u.activo = nuevoEstado;
    usuarios[idx] = u;
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    await guardarUsuarioDb(u);

    return u;
  }

  public static async eliminarUsuario(userId: string): Promise<void> {
    let usuarios = await this.getUsuarios();
    const objetivo = usuarios.find(u => u.id === userId);
    if (objetivo && (objetivo.email || '').toLowerCase() === SUPER_USUARIO_EMAIL) {
      throw new Error('La cuenta oficial de Super Usuario no puede eliminarse.');
    }
    usuarios = usuarios.filter(u => u.id !== userId);
    if (!usuarios.some(u => u.role === 'super_usuario' && u.activo)) {
      throw new Error('Debe existir al menos un Super Usuario activo en el sistema.');
    }
    // Quitar referencias del usuario eliminado en equipos de coordinadores
    const coordinadoresModificados: UsuarioSistema[] = [];
    usuarios = usuarios.map(u => {
      if (u.asesoresSupervisados?.includes(userId)) {
        const actualizado = {
          ...u,
          asesoresSupervisados: u.asesoresSupervisados.filter(id => id !== userId)
        };
        coordinadoresModificados.push(actualizado);
        return actualizado;
      }
      return u;
    });
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    await eliminarUsuarioDb(userId);
    for (const coord of coordinadoresModificados) {
      await guardarUsuarioDb(coord);
    }
  }

  /** Vista agregada (heredada) de permisos derivada de la matriz granular editable. */
  public static getPermisos(role: UserRole | string): PermisosRol {
    return RolesPermisosService.derivarPermisosLegados(role);
  }

  /**
   * Sincroniza automÃ¡ticamente un Asesor UATP (desde el registro de asesores)
   * asegurando que exista como cuenta de usuario activa con rol 'asesor_uatp' y su cartera de colegios.
   */
  public static async sincronizarAsesorComoUsuario(asesor: {
    id?: string;
    nombre: string;
    email: string;
    telefono?: string;
    cargo?: string;
    carteraRbds?: string[];
  }, modoCartera: 'reemplazar' | 'agregar' = 'reemplazar'): Promise<{ usuario: UsuarioSistema; esNuevo: boolean; passwordTemporal?: string }> {
    const cleanEmail = (asesor.email || '').trim().toLowerCase();
    const cleanNombre = (asesor.nombre || '').trim();
    if (!cleanEmail && !cleanNombre) {
      throw new Error('El asesor debe tener al menos un nombre o correo institucional.');
    }

    const usuarios = await this.getUsuarios();
    // Buscar si ya existe por email o por username o por nombre
    const usernameGenerado = cleanEmail ? cleanEmail.split('@')[0] : cleanNombre.toLowerCase().replace(/\s+/g, '.');

    let existente = usuarios.find(u =>
      (cleanEmail && (u.email || '').toLowerCase() === cleanEmail) ||
      u.username.toLowerCase() === usernameGenerado ||
      u.nombreCompleto.toLowerCase() === cleanNombre.toLowerCase()
    );

    let passwordTemporal: string | undefined = undefined;

    if (existente) {
      // Actualizar datos y cartera de colegios (reemplazo o uniÃ³n segÃºn el modo)
      existente.nombreCompleto = cleanNombre || existente.nombreCompleto;
      existente.email = cleanEmail || existente.email;
      existente.role = 'asesor_uatp';
      existente.cargo = asesor.cargo || existente.cargo || 'Asesor TÃ©cnico PedagÃ³gico UATP';
      
      const nuevosRbds = asesor.carteraRbds || [];
      if (modoCartera === 'reemplazar') {
        existente.carteraRbds = Array.from(new Set(nuevosRbds));
      } else {
        existente.carteraRbds = Array.from(new Set([...(existente.carteraRbds || []), ...nuevosRbds]));
      }

      existente.activo = true;
      await this.guardarUsuario(existente);
      return { usuario: existente, esNuevo: false };
    } else {
      // Crear nuevo usuario activo con clave temporal aleatoria criptogrÃ¡ficamente segura (CSPRNG)
      passwordTemporal = generarPasswordTemporalSegura();
      const salt = generateSalt();
      const passwordHash = await hashPassword(passwordTemporal, salt);
      const nuevo: UsuarioSistema = {
        id: asesor.id && asesor.id.startsWith('user-') ? asesor.id : `user-asesor-${Date.now()}`,
        username: usernameGenerado,
        nombreCompleto: cleanNombre,
        email: cleanEmail,
        role: 'asesor_uatp',
        cargo: asesor.cargo || 'Asesor TÃ©cnico PedagÃ³gico UATP',
        passwordHash,
        salt,
        carteraRbds: Array.from(new Set(asesor.carteraRbds || [])),
        activo: true
      };

      await this.guardarUsuario(nuevo, passwordTemporal);
      return { usuario: nuevo, esNuevo: true, passwordTemporal };
    }
  }

  /**
   * Genera masivamente los usuarios directores de escuelas y liceos del territorio SLEP.
   * Asigna su correo SLEP oficial como username/email, contraseÃ±a inicial '123456' (hasheada con salt Ãºnico)
   * y rol 'director_establecimiento' vinculado estrictamente a su RBD asignado.
   */
  public static async generarUsuariosDirectoresMasivo(
    directores: DirectorItem[] = DIRECTORES_TERRITORIO,
    passwordInicial: string = '123456'
  ): Promise<{
    totalProcesados: number;
    creados: number;
    actualizados: number;
    errores: string[];
  }> {
    const usuarios = await this.getUsuarios();
    const eliminados = await listarRbdsEliminados();
    let creados = 0;
    let actualizados = 0;
    const errores: string[] = [];

    // Precalcular hashes PBKDF2 en paralelo solo para registros que realmente requieren credencial nueva o reset
    const validosConCreds = await Promise.all(
      directores.map(async d => {
        const cleanEmail = (d.email || '').trim().toLowerCase();
        const cleanRbd = (d.rbd || '').trim();
        if (!cleanEmail || !cleanRbd || eliminados.has(cleanRbd)) {
          return { d, cleanEmail, cleanRbd, salt: '', passwordHash: '' };
        }
        const existente = usuarios.find(
          u =>
            (u.email && u.email.toLowerCase() === cleanEmail) ||
            u.username.toLowerCase() === cleanEmail ||
            (u.role === 'director_establecimiento' && u.rbdAsignado === cleanRbd)
        );
        if (
          existente &&
          existente.salt &&
          existente.passwordHash?.startsWith(`${PBKDF2_PREFIX}$`) &&
          existente.debeCambiarPassword &&
          passwordInicial === '123456'
        ) {
          return { d, cleanEmail, cleanRbd, salt: existente.salt, passwordHash: existente.passwordHash };
        }
        const salt = generateSalt();
        const passwordHash = await hashPassword(passwordInicial, salt);
        return { d, cleanEmail, cleanRbd, salt, passwordHash };
      })
    );

    for (const item of validosConCreds) {
      const { d, cleanEmail, cleanRbd, salt, passwordHash } = item;
      try {
        const cleanNombre = (d.director || '').trim();
        if (!cleanEmail || !cleanRbd) {
          errores.push(`RBD ${d.rbd}: Falta correo electrónico o RBD válido.`);
          continue;
        }

        // Respetar colegios eliminados por el Super Usuario
        if (eliminados.has(cleanRbd)) {
          continue;
        }

        const idx = usuarios.findIndex(
          u =>
            (u.email && u.email.toLowerCase() === cleanEmail) ||
            u.username.toLowerCase() === cleanEmail ||
            (u.role === 'director_establecimiento' && u.rbdAsignado === cleanRbd)
        );

        if (idx >= 0) {
          // Si el usuario ya existe, actualizar rbdAsignado, cargo, email, username y resetear clave
          const uExistente = usuarios[idx];
          uExistente.username = cleanEmail;
          uExistente.email = cleanEmail;
          uExistente.nombreCompleto = cleanNombre || uExistente.nombreCompleto;
          uExistente.role = 'director_establecimiento';
          uExistente.cargo = d.cargo || `Director(a) - ${d.nombreEstablecimiento}`;
          uExistente.rbdAsignado = cleanRbd;
          uExistente.passwordHash = passwordHash;
          uExistente.salt = salt;
          uExistente.activo = true;
          uExistente.debeCambiarPassword = true;
          actualizados++;
        } else {
          // Crear nuevo usuario director
          const nuevoDirector: UsuarioSistema = {
            id: `user-dir-${cleanRbd}-${Date.now().toString(36)}`,
            username: cleanEmail,
            email: cleanEmail,
            nombreCompleto: cleanNombre || `Director(a) RBD ${cleanRbd}`,
            role: 'director_establecimiento',
            cargo: d.cargo || `Director(a) - ${d.nombreEstablecimiento}`,
            passwordHash,
            salt,
            rbdAsignado: cleanRbd,
            activo: true,
            debeCambiarPassword: true
          };
          usuarios.push(nuevoDirector);
          creados++;
        }
      } catch (err: any) {
        errores.push(`RBD ${d.rbd} (${d.director}): ${err.message || err}`);
      }
    }

    localStorage.setItem(
      STORAGE_USERS_KEY,
      JSON.stringify(sanitizarUsuariosParaLocalStorage(usuarios, this.getSessionActual()?.usuario.id))
    );
    await guardarUsuariosBatchDb(usuarios);

    // Sincronizar informaciÃ³n de directores en la tabla establecimientos local SQLite
    try {
      const estActuales = await listarEstablecimientos();
      const mapEst = new Map(estActuales.map(e => [e.rbd.trim(), e]));
      for (const d of directores) {
        const rbd = d.rbd.trim();
        if (eliminados.has(rbd)) continue;
        const prev = mapEst.get(rbd);
        const cat = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === rbd);
        if (prev) {
          await guardarEstablecimiento({
            ...prev,
            director: d.director,
            telefono: d.telefono || prev.telefono,
            email: d.correoEE || d.email || prev.email
          }, true);
        } else if (cat) {
          await guardarEstablecimiento({
            id: `est-${rbd}`,
            rbd,
            nombre: cat.nombre,
            comuna: (cat?.comuna as any) || (d.comuna as any) || 'ChillÃ¡n',
            regimen: cat?.tipo === 'JARDIN' || cat?.tipo === 'SALA_CUNA' ? 'No JEC' : 'JEC',
            porcentajePrioritarios: 75.0,
            director: d.director,
            telefono: d.telefono,
            email: d.correoEE || d.email
          }, true);
        }
      }
    } catch (estErr) {
      console.warn('[AuthService] Aviso actualizando directores en establecimientos:', estErr);
    }

    return {
      totalProcesados: directores.length,
      creados,
      actualizados,
      errores
    };
  }

  /**
   * Obtiene el estado actual de la pausa de revisión interna territorial desde caché local.
   */
  public static getEstadoPausaRevision(): EstadoPausaRevision | null {
    try {
      const raw = localStorage.getItem(STORAGE_PAUSA_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as EstadoPausaRevision;
    } catch {
      return null;
    }
  }

  /**
   * Persiste el estado de pausa en Supabase (configuracion_general id='pausa_revision_interna')
   * para sincronizar entre todos los equipos del territorio.
   */
  public static async guardarEstadoPausaEnNube(estadoPausa: EstadoPausaRevision | null): Promise<void> {
    if (!isSupabaseEnabled()) return;
    try {
      const payloadPausa: EstadoPausaRevision = estadoPausa && estadoPausa.activa
        ? estadoPausa
        : { activa: false, rolesAfectados: [] };
      const { error } = await supabase
        .from('configuracion_general')
        .upsert(
          {
            id: 'pausa_revision_interna',
            ui_config_json: payloadPausa,
            actualizado_por: payloadPausa.activadoPor || 'Super Usuario',
            ultima_modificacion: new Date().toISOString()
          },
          { onConflict: 'id' }
        );
      if (error) {
        console.warn('[AuthService] Aviso guardando estado de pausa en Supabase:', error.message);
      }
    } catch (err) {
      console.warn('[AuthService] Aviso sincronizando pausa en Supabase:', err);
    }
  }

  /**
   * Descarga y sincroniza el estado de pausa de revisión interna desde Supabase.
   */
  public static async sincronizarEstadoPausaDesdeNube(): Promise<EstadoPausaRevision | null> {
    if (!isSupabaseEnabled()) {
      return this.getEstadoPausaRevision();
    }
    try {
      let uiConfigJson: any = null;
      const rpcRes = await supabase.rpc('get_pausa_revision_publica');
      if (!rpcRes.error && rpcRes.data) {
        uiConfigJson = rpcRes.data;
      } else {
        const { data, error } = await supabase
          .from('configuracion_general')
          .select('ui_config_json')
          .eq('id', 'pausa_revision_interna')
          .maybeSingle();
        if (!error && data?.ui_config_json) {
          uiConfigJson = data.ui_config_json;
        }
      }

      if (uiConfigJson) {
        const raw = uiConfigJson as Partial<EstadoPausaRevision>;
        if (raw.activa && Array.isArray(raw.rolesAfectados) && raw.rolesAfectados.length > 0) {
          const estado: EstadoPausaRevision = {
            activa: true,
            rolesAfectados: raw.rolesAfectados,
            motivo: raw.motivo,
            activadoPor: raw.activadoPor,
            fechaActivacion: raw.fechaActivacion
          };
          localStorage.setItem(STORAGE_PAUSA_KEY, JSON.stringify(estado));
          return estado;
        } else {
          localStorage.removeItem(STORAGE_PAUSA_KEY);
          return null;
        }
      }
    } catch (err) {
      console.warn('[AuthService] Aviso leyendo estado de pausa desde Supabase:', err);
    }
    return this.getEstadoPausaRevision();
  }

  /**
   * Retorna los roles excluidos/protegidos por diseño institucional de cualquier pausa.
   */
  public static getRolesExentosPausa(): RolId[] {
    return [...ROLES_EXENTOS_PAUSA];
  }

  /**
   * Retorna los roles de estamento escolar susceptibles de ser pausados.
   */
  public static getRolesPausables(): RolId[] {
    return [...ROLES_PAUSABLES_ESTAMENTO];
  }

  /**
   * Obtiene un resumen en vivo de usuarios totales, activos e inactivos por estamento/rol.
   */
  public static async getResumenEstamentos(): Promise<ResumenEstamentoPausa[]> {
    const [usuarios] = await Promise.all([
      this.getUsuarios(),
      this.sincronizarEstadoPausaDesdeNube().catch(() => null)
    ]);
    return ROLES_DEFINICIONES.map(def => {
      const usersRol = usuarios.filter(u => normalizarRol(u.role) === def.id);
      const activos = usersRol.filter(u => u.activo !== false).length;
      const inactivos = usersRol.length - activos;
      return {
        rol: def.id,
        nombre: def.nombre,
        nombreCorto: def.nombreCorto,
        total: usersRol.length,
        activos,
        inactivos,
        esProtegido: ROLES_EXENTOS_PAUSA.includes(def.id),
        alcance: def.alcance,
        color: def.color
      };
    });
  }

  /**
   * Pausa masivamente el acceso a los estamentos seleccionados para iniciar la revisión interna.
   * Cierra las sesiones activas de dichos estamentos y bloquea nuevos accesos.
   * GARANTÍA: Asesores UATP, Coordinadores UATP, Subdirectores y Super Usuarios son estrictamente preservados.
   */
  public static async pausarAccesoMasivo(
    roles: RolId[],
    motivo: string = 'Revisión técnica interna UATP',
    usuarioEjecutor?: string
  ): Promise<{ totalAfectados: number; rolesAfectados: RolId[] }> {
    // Filtrar estrictamente excluyendo cualquier rol protegido
    const rolesValidos = Array.from(new Set(roles)).filter(r => !ROLES_EXENTOS_PAUSA.includes(r));
    if (rolesValidos.length === 0) {
      throw new Error('No se seleccionó ningún estamento válido para pausar o todos los roles seleccionados están protegidos por diseño.');
    }

    const usuarios = await this.getUsuarios();
    const modificados: UsuarioSistema[] = [];

    const usuariosActualizados = usuarios.map(u => {
      const emailNorm = (u.email || '').toLowerCase();
      const rolNorm = normalizarRol(u.role);

      // Nunca alterar al super usuario oficial ni a los roles protegidos
      if (emailNorm === SUPER_USUARIO_EMAIL || ROLES_EXENTOS_PAUSA.includes(rolNorm)) {
        return u;
      }

      if (rolesValidos.includes(rolNorm) && u.activo) {
        const uModificado: UsuarioSistema = { ...u, activo: false };
        modificados.push(uModificado);
        return uModificado;
      }
      return u;
    });

    // Acumular con cualquier estamento ya pausado previamente
    const estadoPrevio = this.getEstadoPausaRevision();
    const rolesAcumulados = Array.from(
      new Set([...(estadoPrevio?.activa ? estadoPrevio.rolesAfectados : []), ...rolesValidos])
    );

    const estadoPausa: EstadoPausaRevision = {
      activa: true,
      rolesAfectados: rolesAcumulados,
      motivo: motivo.trim() || 'Revisión técnica interna territorial UATP',
      activadoPor: usuarioEjecutor || 'Super Usuario',
      fechaActivacion: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_PAUSA_KEY, JSON.stringify(estadoPausa));
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuariosActualizados));

    // Persistir en SQLite WASM y Supabase (UPDATE directo del campo activo + estado global en configuracion_general)
    if (modificados.length > 0) {
      await actualizarEstadoUsuariosMasivoDb(modificados.map(m => m.id), false);
    }
    await this.guardarEstadoPausaEnNube(estadoPausa);

    // Invalidar sesión activa local si el usuario autenticado pertenece al estamento pausado
    const sesionActual = this.getSessionActual();
    if (sesionActual) {
      const miRol = normalizarRol(sesionActual.usuario.role);
      const miEmail = (sesionActual.usuario.email || '').toLowerCase();
      if (miEmail !== SUPER_USUARIO_EMAIL && !ROLES_EXENTOS_PAUSA.includes(miRol) && rolesValidos.includes(miRol)) {
        this.logout();
      }
    }

    // Emitir evento para invalidación reactiva de sesiones en navegadores
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('slep:sesiones_pausadas', { detail: estadoPausa }));
    }

    return {
      totalAfectados: modificados.length,
      rolesAfectados: rolesValidos
    };
  }

  /**
   * Reactiva el acceso masivamente para los estamentos especificados (o todos los pausados).
   */
  public static async reactivarAccesoMasivo(
    roles?: RolId[]
  ): Promise<{ totalReactivados: number; rolesReactivados: RolId[] }> {
    const estadoPrevio = this.getEstadoPausaRevision();
    const rolesAReactivar = (roles && roles.length > 0
      ? Array.from(new Set(roles))
      : (estadoPrevio?.rolesAfectados || ROLES_PAUSABLES_ESTAMENTO.slice())
    ).filter(r => !ROLES_EXENTOS_PAUSA.includes(r));

    const usuarios = await this.getUsuarios();
    const modificados: UsuarioSistema[] = [];

    const usuariosActualizados = usuarios.map(u => {
      const rolNorm = normalizarRol(u.role);
      if (rolesAReactivar.includes(rolNorm) && !u.activo) {
        const uMod: UsuarioSistema = { ...u, activo: true };
        modificados.push(uMod);
        return uMod;
      }
      return u;
    });

    // Actualizar estado de pausa
    const rolesRestantes = (estadoPrevio?.rolesAfectados || []).filter(r => !rolesAReactivar.includes(r));
    let nuevoEstadoPausa: EstadoPausaRevision | null = null;
    if (rolesRestantes.length === 0) {
      localStorage.removeItem(STORAGE_PAUSA_KEY);
    } else {
      nuevoEstadoPausa = {
        ...(estadoPrevio || { activa: true, rolesAfectados: rolesRestantes }),
        activa: true,
        rolesAfectados: rolesRestantes
      };
      localStorage.setItem(STORAGE_PAUSA_KEY, JSON.stringify(nuevoEstadoPausa));
    }

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuariosActualizados));

    if (modificados.length > 0) {
      await actualizarEstadoUsuariosMasivoDb(modificados.map(m => m.id), true);
    }
    await this.guardarEstadoPausaEnNube(nuevoEstadoPausa);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('slep:sesiones_reactivadas', { detail: { rolesReactivados: rolesAReactivar } }));
    }

    return {
      totalReactivados: modificados.length,
      rolesReactivados: rolesAReactivar
    };
  }

  /**
   * Verifica de forma síncrona/local si una sesión activa sigue siendo válida en el sistema.
   * Si la cuenta fue inactivada o el estamento fue pausado por revisión interna, retorna valida: false.
   */
  public static verificarSesionValida(session: AuthSession | null): { valida: boolean; motivo?: string } {
    if (!session || !session.usuario) {
      return { valida: false, motivo: 'Sesión no iniciada.' };
    }

    const emailNorm = (session.usuario.email || '').toLowerCase();
    const rolNorm = normalizarRol(session.usuario.role);

    // Super usuario oficial siempre es válido
    if (emailNorm === SUPER_USUARIO_EMAIL || rolNorm === 'super_usuario') {
      return { valida: true };
    }

    const usuarios = this.getUsuariosLocal();
    const yo = usuarios.find(u => u.id === session.usuario.id || (u.email && u.email.toLowerCase() === emailNorm));
    const pausa = this.getEstadoPausaRevision();

    // Si hay pausa activa para su rol y no es un rol protegido UATP, invalidar de inmediato
    if (!ROLES_EXENTOS_PAUSA.includes(rolNorm) && pausa?.activa && pausa.rolesAfectados.includes(rolNorm)) {
      return {
        valida: false,
        motivo: 'Sesión pausada: El acceso a su estamento se encuentra suspendido temporalmente por inicio del período de Revisión Interna UATP (' + (pausa.motivo || 'Auditoría técnica') + ').'
      };
    }

    if (yo && !yo.activo) {
      return {
        valida: false,
        motivo: 'Su cuenta ha sido deshabilitada por el administrador del sistema.'
      };
    }

    return { valida: true };
  }

  /**
   * Verifica contra Supabase (en la nube) si la sesión activa sigue habilitada
   * o si el Super Usuario activó una pausa de revisión interna desde otro equipo.
   */
  public static async verificarSesionRemota(session: AuthSession | null): Promise<{ valida: boolean; motivo?: string }> {
    const checkLocal = this.verificarSesionValida(session);
    if (!checkLocal.valida) {
      return checkLocal;
    }
    if (!session || !session.usuario || !isSupabaseEnabled()) {
      return checkLocal;
    }

    const emailNorm = (session.usuario.email || '').toLowerCase();
    const rolNorm = normalizarRol(session.usuario.role);
    if (emailNorm === SUPER_USUARIO_EMAIL || rolNorm === 'super_usuario') {
      return { valida: true };
    }

    try {
      const [userResp, pausaRemota] = await Promise.all([
        supabase
          .from('usuarios_sistema')
          .select('activo, role')
          .eq('id', session.usuario.id)
          .maybeSingle(),
        this.sincronizarEstadoPausaDesdeNube().catch(() => this.getEstadoPausaRevision())
      ]);

      const rolEfectivo = userResp.data?.role ? normalizarRol(userResp.data.role) : rolNorm;

      if (!ROLES_EXENTOS_PAUSA.includes(rolEfectivo) && pausaRemota?.activa && pausaRemota.rolesAfectados.includes(rolEfectivo)) {
        return {
          valida: false,
          motivo: 'Sesión pausada: El acceso a su estamento se encuentra suspendido temporalmente por inicio del período de Revisión Interna UATP (' + (pausaRemota.motivo || 'Auditoría técnica') + ').'
        };
      }

      if (!userResp.error && userResp.data && userResp.data.activo === false) {
        // Actualizar caché local
        const locales = this.getUsuariosLocal();
        if (locales.length > 0) {
          const actualizados = locales.map(u => (u.id === session.usuario.id ? { ...u, activo: false } : u));
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(actualizados));
        }
        return {
          valida: false,
          motivo: 'Su cuenta ha sido deshabilitada por el administrador del sistema.'
        };
      }
    } catch (err) {
      console.warn('[AuthService] Aviso verificando sesión remota:', err);
    }

    return { valida: true };
  }
}
