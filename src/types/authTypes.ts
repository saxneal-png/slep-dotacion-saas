export type UserRole = 'admin' | 'asesor' | 'director_colegio' | 'auditor';

export interface UsuarioSistema {
  id: string;
  username: string;
  nombreCompleto: string;
  email: string;
  role: UserRole;
  cargo: string;
  passwordHash: string;
  salt: string;
  rbdAsignado?: string; // Para rol 'director_colegio': restringe la vista a un solo colegio
  comunasPermitidas?: string[]; // Para rol 'asesor': filtrar comunas específicas
  activo: boolean;
  ultimoAcceso?: string;
}

export interface PermisosRol {
  puedeEditarDotacion: boolean;
  puedeEliminarRegistros: boolean;
  puedeConfigurarSistema: boolean;
  puedeGestionarUsuarios: boolean;
  puedeAccederTodasEscuelas: boolean;
  puedeExportarReportes: boolean;
  puedeUsarCopilotIa: boolean;
  puedeTraspasarPeriodos: boolean;
  esSoloLectura: boolean;
}

export interface AuthSession {
  usuario: Omit<UsuarioSistema, 'passwordHash' | 'salt'>;
  token: string;
  iniciadoEn: string;
}
