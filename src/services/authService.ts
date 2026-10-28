import { UsuarioSistema, UserRole, PermisosRol, AuthSession } from '../types/authTypes';

const STORAGE_USERS_KEY = 'slep_usuarios_sistema_v1';
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

// Matriz oficial de atribuciones por Rol
export const PERMISOS_POR_ROL: Record<UserRole, PermisosRol> = {
  admin: {
    puedeEditarDotacion: true,
    puedeEliminarRegistros: true,
    puedeConfigurarSistema: true,
    puedeGestionarUsuarios: true,
    puedeAccederTodasEscuelas: true,
    puedeExportarReportes: true,
    puedeUsarCopilotIa: true,
    puedeTraspasarPeriodos: true,
    esSoloLectura: false
  },
  asesor: {
    puedeEditarDotacion: true,
    puedeEliminarRegistros: true,
    puedeConfigurarSistema: false,
    puedeGestionarUsuarios: false,
    puedeAccederTodasEscuelas: true,
    puedeExportarReportes: true,
    puedeUsarCopilotIa: true,
    puedeTraspasarPeriodos: true,
    esSoloLectura: false
  },
  director_colegio: {
    puedeEditarDotacion: true,
    puedeEliminarRegistros: false,
    puedeConfigurarSistema: false,
    puedeGestionarUsuarios: false,
    puedeAccederTodasEscuelas: false,
    puedeExportarReportes: true,
    puedeUsarCopilotIa: true,
    puedeTraspasarPeriodos: false,
    esSoloLectura: false
  },
  auditor: {
    puedeEditarDotacion: false,
    puedeEliminarRegistros: false,
    puedeConfigurarSistema: false,
    puedeGestionarUsuarios: false,
    puedeAccederTodasEscuelas: true,
    puedeExportarReportes: true,
    puedeUsarCopilotIa: false,
    puedeTraspasarPeriodos: false,
    esSoloLectura: true
  }
};

// Cuentas iniciales predeterminadas
// Nota: en primer inicio se calculan y guardan los hashes de contraseñas de demostración
export const USUARIOS_SEMILLA_BASE: Array<Omit<UsuarioSistema, 'passwordHash' | 'salt'> & { defaultPasswordPlain: string }> = [
  {
    id: 'user-admin-1',
    username: 'admin',
    defaultPasswordPlain: 'admin123',
    nombreCompleto: 'Director Ejecutivo / Administrador SLEP',
    email: 'direccion@slepvallediguillin.cl',
    role: 'admin',
    cargo: 'Administrador General del Sistema',
    activo: true
  },
  {
    id: 'user-asesor-1',
    username: 'asesor',
    defaultPasswordPlain: 'asesor123',
    nombreCompleto: 'Rodrigo Fuentes Uribe',
    email: 'rodrigo.fuentes@slepvallediguillin.cl',
    role: 'asesor',
    cargo: 'Asesor Técnico Pedagógico Territorial',
    comunasPermitidas: ['Bulnes', 'Chillán Viejo', 'San Ignacio', 'Yungay', 'Chillán', 'El Carmen', 'Pemuco'],
    activo: true
  },
  {
    id: 'user-director-1',
    username: 'director',
    defaultPasswordPlain: 'director123',
    nombreCompleto: 'Directora Liceo Bicentenario',
    email: 'direccion.liceo@slepvallediguillin.cl',
    role: 'director_colegio',
    cargo: 'Directora de Establecimiento',
    rbdAsignado: '3501', // Vinculado a establecimiento base
    activo: true
  },
  {
    id: 'user-auditor-1',
    username: 'auditor',
    defaultPasswordPlain: 'auditor123',
    nombreCompleto: 'Auditoría Ministerial DEP - MINEDUC',
    email: 'auditoria@educacionpublica.gob.cl',
    role: 'auditor',
    cargo: 'Fiscalizador / Revisor de Dotación',
    activo: true
  }
];

export class AuthService {
  private static async inicializarUsuariosSiNoExisten(): Promise<UsuarioSistema[]> {
    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      try {
        return JSON.parse(raw) as UsuarioSistema[];
      } catch (e) {
        console.error('Error parseando usuarios, resembrando...', e);
      }
    }

    // Sembrar usuarios iniciales con hashing
    const usuariosNuevos: UsuarioSistema[] = [];
    for (const u of USUARIOS_SEMILLA_BASE) {
      const salt = generateSalt();
      const passwordHash = await hashPassword(u.defaultPasswordPlain, salt);
      usuariosNuevos.push({
        id: u.id,
        username: u.username,
        nombreCompleto: u.nombreCompleto,
        email: u.email,
        role: u.role,
        cargo: u.cargo,
        passwordHash,
        salt,
        rbdAsignado: u.rbdAsignado,
        comunasPermitidas: u.comunasPermitidas,
        activo: u.activo
      });
    }

    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuariosNuevos));
    return usuariosNuevos;
  }

  public static async getUsuarios(): Promise<UsuarioSistema[]> {
    return this.inicializarUsuariosSiNoExisten();
  }

  public static async login(username: string, passwordPlain: string): Promise<AuthSession> {
    const usuarios = await this.getUsuarios();
    const cleanUser = username.trim().toLowerCase();
    const encontrado = usuarios.find(u => u.username.toLowerCase() === cleanUser && u.activo);

    if (!encontrado) {
      throw new Error('Usuario no encontrado o cuenta deshabilitada.');
    }

    const testHash = await hashPassword(passwordPlain, encontrado.salt);
    if (testHash !== encontrado.passwordHash) {
      throw new Error('Contraseña incorrecta. Verifique sus credenciales.');
    }

    // Actualizar último acceso
    encontrado.ultimoAcceso = new Date().toISOString();
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));

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
      return JSON.parse(raw) as AuthSession;
    } catch {
      return null;
    }
  }

  public static logout(): void {
    localStorage.removeItem(STORAGE_SESSION_KEY);
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
  }

  public static async guardarUsuario(usuario: UsuarioSistema): Promise<void> {
    const usuarios = await this.getUsuarios();
    const idx = usuarios.findIndex(u => u.id === usuario.id);
    if (idx >= 0) {
      usuarios[idx] = usuario;
    } else {
      usuarios.push(usuario);
    }
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
  }

  public static async eliminarUsuario(userId: string): Promise<void> {
    let usuarios = await this.getUsuarios();
    usuarios = usuarios.filter(u => u.id !== userId);
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
  }

  public static getPermisos(role: UserRole): PermisosRol {
    return PERMISOS_POR_ROL[role] || PERMISOS_POR_ROL.auditor;
  }
}
