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
  geminiApiKey?: string; // ApiKey personal de Gemini del Asesor/Usuario
  activo: boolean;
  ultimoAcceso?: string;
}

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
