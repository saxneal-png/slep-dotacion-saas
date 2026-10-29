/**
 * Roles oficiales del sistema de Dotación SLEP Valle Diguillín.
 * - super_usuario: dominio completo de la aplicación (inmutable).
 * - subdirector_uatp: supervisión territorial global.
 * - coordinador_uatp: supervisa un equipo de asesores y sus carteras.
 * - asesor_uatp: gestiona su cartera de establecimientos.
 * - director_establecimiento / jefe_utp_establecimiento: acotados a un RBD.
 */
export type RolId =
  | 'super_usuario'
  | 'subdirector_uatp'
  | 'coordinador_uatp'
  | 'asesor_uatp'
  | 'director_establecimiento'
  | 'jefe_utp_establecimiento';

/** Alias retrocompatible: todo el código existente usa `UserRole`. */
export type UserRole = RolId;

/** Roles de versiones anteriores, migrados automáticamente al cargar usuarios. */
export type LegacyRole = 'admin' | 'asesor' | 'director_colegio' | 'auditor';

export type AccionPermiso = 'ver' | 'editar' | 'eliminar' | 'importar' | 'exportar' | 'ejecutar';

/** Clave granular de permiso con formato `modulo.accion` (ej. `docentes.editar`). */
export type PermisoKey = `${string}.${AccionPermiso}`;

/** Alcance de datos (sobre qué colegios opera el rol). Independiente de los permisos. */
export type AlcanceRol = 'global' | 'equipo' | 'cartera' | 'establecimiento';

export interface DefinicionRol {
  id: RolId;
  nombre: string;
  nombreCorto: string;
  descripcion: string;
  alcance: AlcanceRol;
  /** 0 = máxima jerarquía. Un usuario no puede asignar roles de nivel inferior (número menor) al propio. */
  nivel: number;
  /** El super usuario no es editable desde la matriz (salvaguarda anti-bloqueo). */
  editable: boolean;
  color: string;
}

/** Estado persistido de la matriz para un rol. */
export interface MatrizRol {
  permisos: PermisoKey[];
  version: number;
  actualizadoEn: string;
  actualizadoPor: string;
}

export type MatrizPermisos = Record<RolId, MatrizRol>;

export interface CambioPermisosBitacora {
  id: string;
  rolId: RolId;
  agregados: PermisoKey[];
  removidos: PermisoKey[];
  usuario: string;
  fecha: string;
  motivo?: string;
}

export interface UsuarioSistema {
  id: string;
  username: string;
  nombreCompleto: string;
  email: string;
  role: UserRole;
  cargo: string;
  passwordHash: string;
  salt: string;
  rbdAsignado?: string; // Director / Jefe UTP: restringe la vista a un solo colegio
  carteraRbds?: string[]; // Asesor UATP: RBD de su cartera
  asesoresSupervisados?: string[]; // Coordinador UATP: ids de usuarios asesores de su equipo
  comunasPermitidas?: string[]; // (Heredado) filtro opcional por comuna
  geminiApiKey?: string; // ApiKey personal de Gemini del Asesor/Usuario
  activo: boolean;
  ultimoAcceso?: string;
}

/**
 * Vista agregada (heredada) de permisos. Se deriva automáticamente de la matriz granular
 * para mantener compatibilidad con componentes existentes.
 */
export interface PermisosRol {
  puedeEditarDotacion: boolean;
  puedeEliminarRegistros: boolean;
  puedeConfigurarSistema: boolean;
  puedeGestionarUsuarios: boolean;
  puedeAccederTodasEscuelas: boolean;
  puedeVerCarteraTerritorial: boolean;
  puedeVerConsolidadorMaster: boolean;
  puedeVerAnalizadorSige: boolean;
  puedeExportarReportes: boolean;
  puedeUsarCopilotIa: boolean;
  puedeTraspasarPeriodos: boolean;
  puedeImportarMatriz: boolean;
  puedeVerCentroDescargas: boolean;
  esSoloLectura: boolean;
}

export interface AuthSession {
  usuario: Omit<UsuarioSistema, 'passwordHash' | 'salt'>;
  token: string;
  iniciadoEn: string;
}
