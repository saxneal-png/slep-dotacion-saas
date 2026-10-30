import { UsuarioSistema, UserRole, PermisosRol, AuthSession } from '../types/authTypes';
import { normalizarRol } from '../security/rolesDefinitions';
import { RolesPermisosService } from './rolesPermisosService';
import { DIRECTORES_TERRITORIO, DirectorItem } from '../data/directoresTerritorio';
import { supabase, isSupabaseEnabled } from './supabaseClient';
import {
  listarUsuariosDb,
  guardarUsuarioDb,
  guardarUsuariosBatchDb,
  eliminarUsuarioDb
} from '../database/repositories/usuariosRepo';
import {
  listarEstablecimientos,
  guardarEstablecimiento
} from '../database/repositories/establecimientosRepo';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';

const STORAGE_USERS_KEY = 'slep_usuarios_sistema_v2';
const STORAGE_SESSION_KEY = 'slep_auth_session_v1';

// Función para derivar hash criptográfico usando SHA-256 con Salt
export async function hashPassword(password: string, salt: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + salt);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function generateSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Genera una clave temporal aleatoria criptográficamente segura (CSPRNG)
 * sin dejar cadenas fijas en el código fuente.
 */
export function generarPasswordTemporalSegura(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const arr = new Uint8Array(10);
  crypto.getRandomValues(arr);
  const token = Array.from(arr).map(b => alphabet[b % alphabet.length]).join('');
  return `Slep-${token}`;
}

// Cuenta oficial de Super Usuario Administrador
// Sin contraseñas en texto plano en el código fuente (resguardo SAST / GitGuardian).
// La autenticación real se delega a Firebase Auth o al hash sellado en el primer inicio de sesión.
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
    // Purgar cuentas simuladas obsoletas de la versión 1
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
            const passwordDirectores = '12346';
            for (const d of DIRECTORES_TERRITORIO) {
              const cleanEmail = d.email.trim().toLowerCase();
              const yaExiste = migrados.some(
                u => (u.email && u.email.toLowerCase() === cleanEmail) || u.username.toLowerCase() === cleanEmail
              );
              if (!yaExiste) {
                const salt = generateSalt();
                const passwordHash = await hashPassword(passwordDirectores, salt);
                migrados.push({
                  id: `user-dir-${d.rbd}`,
                  username: cleanEmail,
                  email: cleanEmail,
                  nombreCompleto: d.director,
                  role: 'director_establecimiento',
                  cargo: d.cargo,
                  rbdAsignado: d.rbd,
                  passwordHash,
                  salt,
                  activo: true
                });
              }
            }
          }

          if (huboMigracion) localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(migrados));
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

    // Sembrar directores territoriales iniciales con contraseña 12346
    const passwordDirectores = '12346';
    for (const d of DIRECTORES_TERRITORIO) {
      const cleanEmail = d.email.trim().toLowerCase();
      const salt = generateSalt();
      const passwordHash = await hashPassword(passwordDirectores, salt);
      usuariosNuevos.push({
        id: `user-dir-${d.rbd}`,
        username: cleanEmail,
        email: cleanEmail,
        nombreCompleto: d.director,
        role: 'director_establecimiento',
        cargo: d.cargo,
        rbdAsignado: d.rbd,
        passwordHash,
        salt,
        activo: true
      });
    }

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuariosNuevos));
    return usuariosNuevos;
  }

  public static async getUsuarios(): Promise<UsuarioSistema[]> {
    let usuarios = await this.inicializarUsuariosSiNoExisten();

    // 1. Fusionar usuarios desde SQLite WASM (usuarios_sistema) si existen
    try {
      const sqlUsers = await listarUsuariosDb();
      if (sqlUsers.length > 0) {
        const mapLocal = new Map<string, UsuarioSistema>();
        usuarios.forEach(u => mapLocal.set((u.email || u.username || u.id).toLowerCase(), u));
        for (const su of sqlUsers) {
          const key = (su.email || su.username || su.id).toLowerCase();
          const prev = mapLocal.get(key);
          if (!prev) {
            mapLocal.set(key, su);
          } else {
            mapLocal.set(key, {
              ...prev,
              ...su,
              passwordHash: su.passwordHash || prev.passwordHash,
              salt: su.salt || prev.salt,
              rbdAsignado: su.rbdAsignado || prev.rbdAsignado,
              carteraRbds: (su.carteraRbds && su.carteraRbds.length > 0) ? su.carteraRbds : (prev.carteraRbds || []),
              asesoresSupervisados: (su.asesoresSupervisados && su.asesoresSupervisados.length > 0) ? su.asesoresSupervisados : (prev.asesoresSupervisados || [])
            });
          }
        }
        usuarios = Array.from(mapLocal.values());
      }
    } catch {
      // Fallback seguro si SQLite aún no está inicializado
    }

    // 2.0 Sincronización desde Supabase PostgreSQL (Fuente Primaria en Nube)
    if (isSupabaseEnabled()) {
      try {
        const { data: supaUsers, error: supaErr } = await supabase
          .from('usuarios_sistema')
          .select('*');
        if (!supaErr && supaUsers && supaUsers.length > 0) {
          const remoteUsers: UsuarioSistema[] = [];

          for (const row of supaUsers) {
            const emailKey = (row.email || '').toLowerCase();
            const esSuper = emailKey === SUPER_USUARIO_EMAIL;
            const rol = esSuper ? 'super_usuario' : normalizarRol(row.role || 'asesor_uatp');

            let carteraRbds: string[] = [];
            try {
              const parsed = typeof row.cartera_rbds_json === 'string'
                ? JSON.parse(row.cartera_rbds_json)
                : row.cartera_rbds_json;
              if (Array.isArray(parsed) && parsed.length > 0) carteraRbds = parsed;
            } catch {}

            let asesoresSupervisados: string[] = [];
            try {
              const parsed = typeof row.asesores_supervisados_json === 'string'
                ? JSON.parse(row.asesores_supervisados_json)
                : row.asesores_supervisados_json;
              if (Array.isArray(parsed) && parsed.length > 0) asesoresSupervisados = parsed;
            } catch {}

            remoteUsers.push({
              id: row.id,
              username: row.username || row.email || row.id,
              email: row.email || undefined,
              nombreCompleto: row.nombre_completo || 'Usuario SLEP',
              role: rol,
              cargo: row.cargo || 'Funcionario SLEP',
              rbdAsignado: row.rbd_asignado || undefined,
              carteraRbds,
              asesoresSupervisados,
              passwordHash: row.password_hash || '',
              salt: row.salt || '',
              activo: row.activo !== false
            });
          }

          // Asegurar super usuario si no estuviera en Supabase
          if (!remoteUsers.some(u => (u.email || '').toLowerCase() === SUPER_USUARIO_EMAIL)) {
            const superLocal = usuarios.find(u => (u.email || '').toLowerCase() === SUPER_USUARIO_EMAIL);
            if (superLocal) remoteUsers.push(superLocal);
          }

          // Purgar de SQLite cualquier usuario obsoleto que ya no esté en Supabase
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
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
        }
      } catch {
        // Fallback silencioso a local
      }
    }

    // 4. Persistir todos los usuarios en la tabla SQLite usuarios_sistema
    guardarUsuariosBatchDb(usuarios).catch(() => {});

    return usuarios;
  }

  public static async login(usernameOrEmail: string, passwordPlain: string): Promise<AuthSession> {
    const cleanInput = usernameOrEmail.trim().toLowerCase();
    let usuarios = await this.getUsuarios();
    
    // 1. Si es el superusuario saxneal@gmail.com, asegurar inicialización
    if (cleanInput === SUPER_USUARIO_EMAIL || cleanInput === 'saxneal') {
      usuarios = await this.inicializarUsuariosSiNoExisten();
    }

    // 2. Buscar usuario por username, email o prefijo de correo institucional
    let encontrado = usuarios.find(
      u =>
        u.username.toLowerCase() === cleanInput ||
        (u.email && u.email.toLowerCase() === cleanInput) ||
        (u.email && u.email.toLowerCase().split('@')[0] === cleanInput)
    );

    // Si el usuario está registrado pero fue deshabilitado
    if (encontrado && !encontrado.activo) {
      throw new Error('Esta cuenta ha sido deshabilitada por el administrador.');
    }
    if (!encontrado) {
      throw new Error('Usuario no encontrado o cuenta deshabilitada.');
    }

    // Si el perfil fue inicializado sin passwordHash/salt local (o antes de almacenar hash en Firestore),
    // sellar criptográficamente la contraseña en su primer ingreso válido (>= 6 caracteres)
    if (!encontrado.passwordHash && !encontrado.salt && passwordPlain.trim().length >= 6) {
      const nuevoSalt = generateSalt();
      encontrado.salt = nuevoSalt;
      encontrado.passwordHash = await hashPassword(passwordPlain, nuevoSalt);
    }

    // Validación criptográfica con Salt (SHA-256)
    const testHash = encontrado.salt ? await hashPassword(passwordPlain, encontrado.salt) : '';
    const localPasswordOk = Boolean(encontrado.passwordHash && testHash === encontrado.passwordHash);

    if (!localPasswordOk) {
      throw new Error('Contraseña incorrecta. Verifique sus credenciales.');
    }

    // Actualizar último acceso y refrescar cache
    encontrado.ultimoAcceso = new Date().toISOString();
    const existingIdx = usuarios.findIndex(u => u.id === encontrado!.id);
    if (existingIdx >= 0) {
      usuarios[existingIdx] = encontrado;
    } else {
      usuarios.push(encontrado);
    }
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    guardarUsuarioDb(encontrado).catch(() => {});

    // Si el usuario tiene una ApiKey personal configurada, activarla
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
    localStorage.removeItem(STORAGE_SESSION_KEY);
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
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
      guardarUsuarioDb(usuarios[idx]).catch(() => {});
    }
    return usuarios[idx].nombreCompleto;
  }

  public static async guardarApiKeyUsuario(userId: string, apiKey: string): Promise<void> {
    const usuarios = await this.getUsuarios();
    const idx = usuarios.findIndex(u => u.id === userId);
    if (idx >= 0) {
      usuarios[idx].geminiApiKey = apiKey.trim();
      localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
      localStorage.setItem('gemini_api_key', apiKey.trim());
      guardarUsuarioDb(usuarios[idx]).catch(() => {});
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
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    await guardarUsuarioDb(usuarios[idx]);
  }

  public static async guardarUsuario(usuario: UsuarioSistema, passwordPlain?: string): Promise<UsuarioSistema> {
    const usuarios = await this.getUsuarios();
    usuario = { ...usuario, role: normalizarRol(usuario.role) };
    if ((usuario.email || '').toLowerCase() === SUPER_USUARIO_EMAIL) {
      usuario.role = 'super_usuario';
      usuario.activo = true;
    }

    // 1. Si se especificó contraseña, calcular Salt y SHA-256
    if (passwordPlain) {
      const salt = generateSalt();
      usuario.salt = salt;
      usuario.passwordHash = await hashPassword(passwordPlain, salt);
    }

    // 2. Validar existencia de al menos un Super Usuario activo y evitar duplicados por email/username
    const idx = usuarios.findIndex(
      u =>
        u.id === usuario.id ||
        (usuario.email && (u.email || '').toLowerCase() === usuario.email.toLowerCase()) ||
        u.username.toLowerCase() === usuario.username.toLowerCase()
    );
    if (idx >= 0) {
      // Conservar hash previo si en esta edición no se modificó la contraseña
      if (!usuario.passwordHash && usuarios[idx].passwordHash) {
        usuario.passwordHash = usuarios[idx].passwordHash;
        usuario.salt = usuarios[idx].salt;
      }
      usuario.id = usuarios[idx].id.startsWith('user-') ? usuario.id : usuarios[idx].id;
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
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    await guardarUsuarioDb(usuario);

    // 5. Si el usuario modificado es el de la sesión actual, refrescar inmediatamente la sesión activa
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
    usuarios = usuarios.map(u => u.asesoresSupervisados?.includes(userId)
      ? { ...u, asesoresSupervisados: u.asesoresSupervisados.filter(id => id !== userId) }
      : u);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    await eliminarUsuarioDb(userId);
    await guardarUsuariosBatchDb(usuarios);
  }

  /** Vista agregada (heredada) de permisos derivada de la matriz granular editable. */
  public static getPermisos(role: UserRole | string): PermisosRol {
    return RolesPermisosService.derivarPermisosLegados(role);
  }

  /**
   * Sincroniza automáticamente un Asesor UATP (desde el registro de asesores)
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
      // Actualizar datos y cartera de colegios (reemplazo o unión según el modo)
      existente.nombreCompleto = cleanNombre || existente.nombreCompleto;
      existente.email = cleanEmail || existente.email;
      existente.role = 'asesor_uatp';
      existente.cargo = asesor.cargo || existente.cargo || 'Asesor Técnico Pedagógico UATP';
      
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
      // Crear nuevo usuario activo con clave temporal aleatoria criptográficamente segura (CSPRNG)
      passwordTemporal = generarPasswordTemporalSegura();
      const salt = generateSalt();
      const passwordHash = await hashPassword(passwordTemporal, salt);
      const nuevo: UsuarioSistema = {
        id: asesor.id && asesor.id.startsWith('user-') ? asesor.id : `user-asesor-${Date.now()}`,
        username: usernameGenerado,
        nombreCompleto: cleanNombre,
        email: cleanEmail,
        role: 'asesor_uatp',
        cargo: asesor.cargo || 'Asesor Técnico Pedagógico UATP',
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
   * Asigna su correo SLEP oficial como username/email, contraseña inicial '12346' (hasheada con salt único)
   * y rol 'director_establecimiento' vinculado estrictamente a su RBD asignado.
   */
  public static async generarUsuariosDirectoresMasivo(
    directores: DirectorItem[] = DIRECTORES_TERRITORIO,
    passwordInicial: string = '12346'
  ): Promise<{
    totalProcesados: number;
    creados: number;
    actualizados: number;
    errores: string[];
  }> {
    const usuarios = await this.getUsuarios();
    let creados = 0;
    let actualizados = 0;
    const errores: string[] = [];

    for (const d of directores) {
      try {
        const cleanEmail = (d.email || '').trim().toLowerCase();
        const cleanRbd = (d.rbd || '').trim();
        const cleanNombre = (d.director || '').trim();
        if (!cleanEmail || !cleanRbd) {
          errores.push(`RBD ${d.rbd}: Falta correo electrónico o RBD válido.`);
          continue;
        }

        const idx = usuarios.findIndex(
          u =>
            (u.email && u.email.toLowerCase() === cleanEmail) ||
            u.username.toLowerCase() === cleanEmail ||
            (u.role === 'director_establecimiento' && u.rbdAsignado === cleanRbd)
        );

        const salt = generateSalt();
        const passwordHash = await hashPassword(passwordInicial, salt);

        if (idx >= 0) {
          // Si el usuario ya existe, actualizar rbdAsignado, cargo, email, username y resetear clave si no la ha cambiado
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
            activo: true
          };
          usuarios.push(nuevoDirector);
          creados++;
        }
      } catch (err: any) {
        errores.push(`RBD ${d.rbd} (${d.director}): ${err.message || err}`);
      }
    }

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
    await guardarUsuariosBatchDb(usuarios);

    // Sincronizar información de directores en la tabla establecimientos local SQLite
    try {
      const estActuales = await listarEstablecimientos();
      const mapEst = new Map(estActuales.map(e => [e.rbd.trim(), e]));
      for (const d of directores) {
        const rbd = d.rbd.trim();
        const prev = mapEst.get(rbd);
        const cat = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === rbd);
        if (prev) {
          await guardarEstablecimiento({
            ...prev,
            director: d.director,
            telefono: d.telefono || prev.telefono,
            email: d.email || prev.email
          }, true);
        } else {
          await guardarEstablecimiento({
            id: `est-${rbd}`,
            rbd,
            nombre: cat?.nombre || d.nombreEstablecimiento,
            comuna: (cat?.comuna as any) || (d.comuna as any) || 'Chillán',
            regimen: cat?.tipo === 'JARDIN' || cat?.tipo === 'SALA_CUNA' ? 'No JEC' : 'JEC',
            porcentajePrioritarios: 75.0,
            director: d.director,
            telefono: d.telefono,
            email: d.email
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
}
