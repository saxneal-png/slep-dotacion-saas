import { UsuarioSistema, UserRole, PermisosRol, AuthSession } from '../types/authTypes';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, firestore } from './firebaseConfig';

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

// Matriz oficial de atribuciones por Rol
export const PERMISOS_POR_ROL: Record<UserRole, PermisosRol> = {
  admin: {
    puedeEditarDotacion: true,
    puedeEliminarRegistros: true,
    puedeConfigurarSistema: true,
    puedeGestionarUsuarios: true,
    puedeAccederTodasEscuelas: true,
    puedeVerCarteraTerritorial: true,
    puedeVerConsolidadorMaster: true,
    puedeVerAnalizadorSige: true,
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
    puedeVerCarteraTerritorial: true,
    puedeVerConsolidadorMaster: true,
    puedeVerAnalizadorSige: true,
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
    puedeVerCarteraTerritorial: false,
    puedeVerConsolidadorMaster: false,
    puedeVerAnalizadorSige: false,
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
    puedeVerCarteraTerritorial: true,
    puedeVerConsolidadorMaster: true,
    puedeVerAnalizadorSige: false,
    puedeExportarReportes: true,
    puedeUsarCopilotIa: false,
    puedeTraspasarPeriodos: false,
    esSoloLectura: true
  }
};

// Cuenta oficial de Super Usuario Administrador
// Las cuentas simuladas han sido eliminadas por requerimiento de seguridad institucional
export const USUARIOS_SEMILLA_BASE: Array<Omit<UsuarioSistema, 'passwordHash' | 'salt'> & { defaultPasswordPlain: string }> = [
  {
    id: 'user-saxneal-superadmin',
    username: 'saxneal@gmail.com',
    defaultPasswordPlain: 'slep1234',
    nombreCompleto: 'Super Administrador SLEP (saxneal)',
    email: 'saxneal@gmail.com',
    role: 'admin',
    cargo: 'Super Usuario / Administrador General del Territorio',
    activo: true
  }
];

export class AuthService {
  private static async inicializarUsuariosSiNoExisten(): Promise<UsuarioSistema[]> {
    // Purgar cuentas simuladas obsoletas de la versión 1
    localStorage.removeItem('slep_usuarios_sistema_v1');

    const raw = localStorage.getItem(STORAGE_USERS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as UsuarioSistema[];
        const tieneSaxneal = parsed.some(u => (u.email || '').toLowerCase() === 'saxneal@gmail.com');
        if (tieneSaxneal) {
          return parsed;
        }
      } catch (e) {
        console.error('Error parseando usuarios, resembrando...', e);
      }
    }

    // Sembrar super usuario oficial sin cuentas simuladas
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

  public static async login(usernameOrEmail: string, passwordPlain: string): Promise<AuthSession> {
    const cleanInput = usernameOrEmail.trim().toLowerCase();
    let usuarios = await this.getUsuarios();
    
    // Buscar usuario por username o por email
    let encontrado = usuarios.find(
      u => (u.username.toLowerCase() === cleanInput || (u.email && u.email.toLowerCase() === cleanInput)) && u.activo
    );

    // 1. Si no se encuentra en el almacenamiento local pero es saxneal@gmail.com (SuperAdmin oficial)
    if (!encontrado && (cleanInput === 'saxneal@gmail.com' || cleanInput === 'saxneal')) {
      usuarios = await this.inicializarUsuariosSiNoExisten();
      encontrado = usuarios.find(u => (u.email || '').toLowerCase() === 'saxneal@gmail.com');
    }

    // 2. Si aún no está en local pero existe en Firebase Auth, consultar Firestore /usuarios
    if (!encontrado && auth && typeof window !== 'undefined') {
      try {
        const cred = await signInWithEmailAndPassword(auth, cleanInput, passwordPlain);
        if (cred.user) {
          const uDocSnap = await getDoc(doc(firestore, 'usuarios', cred.user.uid)).catch(() => null);
          const uData = uDocSnap?.data();
          const rol = uData?.rol || (cleanInput === 'saxneal@gmail.com' ? 'admin' : 'asesor');
          const salt = generateSalt();
          const passwordHash = await hashPassword(passwordPlain, salt);
          const nuevoUsuario: UsuarioSistema = {
            id: cred.user.uid,
            username: cred.user.email || cleanInput,
            email: cred.user.email || cleanInput,
            nombreCompleto: uData?.nombreCompleto || 'Super Administrador SLEP (saxneal)',
            role: rol,
            cargo: uData?.cargo || 'Administrador General del Sistema',
            rbdAsignado: uData?.rbdAsignado || null,
            comunasPermitidas: uData?.carteraRbds || [],
            passwordHash,
            salt,
            activo: true
          };
          usuarios.push(nuevoUsuario);
          localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));
          encontrado = nuevoUsuario;
        }
      } catch (fbLoginErr: any) {
        // Ignorar si falla para emitir el error estándar de usuario no encontrado
      }
    }

    if (!encontrado) {
      throw new Error('Usuario no encontrado o cuenta deshabilitada.');
    }

    const testHash = await hashPassword(passwordPlain, encontrado.salt);
    const localPasswordOk = (testHash === encontrado.passwordHash);

    // Intentar autenticación criptográfica en Firebase Auth para sincronizar token real
    let fbSuccess = false;
    if (auth && typeof window !== 'undefined' && encontrado.email) {
      try {
        const cred = await signInWithEmailAndPassword(auth, encontrado.email, passwordPlain);
        fbSuccess = true;
        if (cred.user) {
          const uDocRef = doc(firestore, 'usuarios', cred.user.uid);
          const uDocSnap = await getDoc(uDocRef).catch(() => null);
          if (!uDocSnap || !uDocSnap.exists()) {
            await setDoc(uDocRef, {
              email: encontrado.email,
              nombreCompleto: encontrado.nombreCompleto,
              rol: encontrado.role,
              rbdAsignado: encontrado.rbdAsignado || null,
              carteraRbds: encontrado.comunasPermitidas || [],
              activo: true,
              sincronizadoEn: new Date().toISOString()
            }, { merge: true }).catch(() => {});
          }
        }
      } catch (fbErr: any) {
        // Si no existe la cuenta en Firebase Auth, registrar automáticamente la cuenta oficial
        if (fbErr?.code === 'auth/user-not-found' || fbErr?.code === 'auth/invalid-credential') {
          try {
            const newCred = await createUserWithEmailAndPassword(auth, encontrado.email, passwordPlain);
            fbSuccess = true;
            if (newCred.user) {
              const uDocRef = doc(firestore, 'usuarios', newCred.user.uid);
              await setDoc(uDocRef, {
                email: encontrado.email,
                nombreCompleto: encontrado.nombreCompleto,
                rol: encontrado.role,
                rbdAsignado: encontrado.rbdAsignado || null,
                carteraRbds: encontrado.comunasPermitidas || [],
                activo: true,
                creadoEn: new Date().toISOString()
              }, { merge: true }).catch(() => {});
            }
          } catch (createErr: any) {
            console.warn('[AuthService] Auto-registro en Firebase Auth falló:', createErr?.code || createErr?.message);
          }
        }
        if (!localPasswordOk && !fbSuccess) {
          throw new Error('Contraseña incorrecta. Verifique sus credenciales.');
        }
        console.warn('[AuthService] Firebase Auth offline o sincronizado localmente:', fbErr?.code || fbErr?.message);
      }
    }

    if (!localPasswordOk && !fbSuccess) {
      throw new Error('Contraseña incorrecta. Verifique sus credenciales.');
    }

    // Actualizar último acceso
    encontrado.ultimoAcceso = new Date().toISOString();
    localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(usuarios));

    // Si el usuario tiene una ApiKey personal configurada, activarla para la sesión actual
    if (encontrado.geminiApiKey) {
      localStorage.setItem('gemini_api_key', encontrado.geminiApiKey);
    }

    const { passwordHash: _, salt: __, ...usuarioSeguro } = encontrado;
    const session: AuthSession = {
      usuario: usuarioSeguro,
      token: (auth?.currentUser as any)?.accessToken || `token_${encontrado.id}_${Date.now()}`,
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
    if (auth && typeof window !== 'undefined') {
      fbSignOut(auth).catch(() => {});
    }
    localStorage.removeItem(STORAGE_SESSION_KEY);
  }

  public static async restablecerPasswordPorEmail(email: string, nuevaPasswordPlain?: string): Promise<string> {
    const cleanEmail = email.trim().toLowerCase();
    
    // Disparar correo oficial de recuperación vía Firebase Authentication
    if (auth && typeof window !== 'undefined') {
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
      } catch (fbErr: any) {
        console.warn('[AuthService] Firebase Auth password reset warning:', fbErr?.message);
      }
    }

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

    if (auth?.currentUser && typeof window !== 'undefined') {
      try {
        const uDocRef = doc(firestore, 'usuarios', usuario.id);
        await setDoc(uDocRef, {
          email: usuario.email || null,
          username: usuario.username,
          nombreCompleto: usuario.nombreCompleto,
          rol: usuario.role,
          cargo: usuario.cargo || null,
          rbdAsignado: usuario.rbdAsignado || null,
          carteraRbds: usuario.comunasPermitidas || [],
          activo: usuario.activo,
          actualizadoEn: new Date().toISOString()
        }, { merge: true });
      } catch (e) {
        console.warn('[AuthService] Aviso sincronizando usuario con Firestore:', e);
      }
    }
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
