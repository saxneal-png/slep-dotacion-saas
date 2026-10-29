import { DefinicionRol, LegacyRole, RolId } from '../types/authTypes';

/** Definición oficial y ordenada (por jerarquía) de los roles del SaaS. */
export const ROLES_DEFINICIONES: DefinicionRol[] = [
  {
    id: 'super_usuario',
    nombre: 'Super Usuario',
    nombreCorto: 'Super Usuario',
    descripcion: 'Dominio completo de la aplicación: configuración, usuarios, roles y todos los establecimientos.',
    alcance: 'global',
    nivel: 0,
    editable: false,
    color: 'rose'
  },
  {
    id: 'subdirector_uatp',
    nombre: 'Subdirector UATP',
    nombreCorto: 'Subdirector',
    descripcion: 'Supervisión territorial global de la dotación, consolidados, estadísticas y reportes.',
    alcance: 'global',
    nivel: 1,
    editable: true,
    color: 'violet'
  },
  {
    id: 'coordinador_uatp',
    nombre: 'Coordinador UATP',
    nombreCorto: 'Coordinador',
    descripcion: 'Coordina un equipo de asesores y gestiona los establecimientos de sus carteras.',
    alcance: 'equipo',
    nivel: 2,
    editable: true,
    color: 'indigo'
  },
  {
    id: 'asesor_uatp',
    nombre: 'Asesor UATP',
    nombreCorto: 'Asesor',
    descripcion: 'Gestiona y valida la dotación de los establecimientos de su cartera asignada.',
    alcance: 'cartera',
    nivel: 3,
    editable: true,
    color: 'sky'
  },
  {
    id: 'director_establecimiento',
    nombre: 'Director Establecimiento',
    nombreCorto: 'Director',
    descripcion: 'Propone y edita la dotación de su establecimiento asignado.',
    alcance: 'establecimiento',
    nivel: 4,
    editable: true,
    color: 'emerald'
  },
  {
    id: 'jefe_utp_establecimiento',
    nombre: 'Jefe UTP Establecimiento',
    nombreCorto: 'Jefe UTP',
    descripcion: 'Gestiona el currículum y planes de estudio de su establecimiento asignado.',
    alcance: 'establecimiento',
    nivel: 4,
    editable: true,
    color: 'teal'
  }
];

export const ROL_IDS: RolId[] = ROLES_DEFINICIONES.map(r => r.id);

export const ROL_POR_DEFECTO_DESCONOCIDO: RolId = 'jefe_utp_establecimiento';

/** Migración de roles heredados de versiones anteriores. */
export const MAPA_ROLES_HEREDADOS: Record<LegacyRole, RolId> = {
  admin: 'super_usuario',
  asesor: 'asesor_uatp',
  director_colegio: 'director_establecimiento',
  auditor: 'subdirector_uatp'
};

export function esRolValido(r: unknown): r is RolId {
  return typeof r === 'string' && (ROL_IDS as string[]).includes(r);
}

/** Normaliza cualquier valor de rol (nuevo o heredado) a un `RolId` válido. Deny-by-default. */
export function normalizarRol(r: unknown): RolId {
  if (esRolValido(r)) return r;
  if (typeof r === 'string' && r in MAPA_ROLES_HEREDADOS) {
    return MAPA_ROLES_HEREDADOS[r as LegacyRole];
  }
  return ROL_POR_DEFECTO_DESCONOCIDO;
}

export function getDefinicionRol(r: RolId): DefinicionRol {
  return ROLES_DEFINICIONES.find(d => d.id === r) || ROLES_DEFINICIONES[ROLES_DEFINICIONES.length - 1];
}

export function getNombreRol(r: unknown): string {
  return getDefinicionRol(normalizarRol(r)).nombre;
}

/** Roles que un usuario con `rolActor` puede asignar (mismo nivel o inferior; super usuario asigna todo). */
export function rolesAsignablesPor(rolActor: RolId): DefinicionRol[] {
  const actor = getDefinicionRol(rolActor);
  if (actor.id === 'super_usuario') return ROLES_DEFINICIONES;
  return ROLES_DEFINICIONES.filter(d => d.nivel > actor.nivel);
}
