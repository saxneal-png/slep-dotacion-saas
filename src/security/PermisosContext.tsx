import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { AlcanceRol, AuthSession, PermisoKey, PermisosRol, RolId } from '../types/authTypes';
import { RolesPermisosService } from '../services/rolesPermisosService';
import { getDefinicionRol, normalizarRol } from './rolesDefinitions';
import { PERMISO_POR_VISTA, PERMISOS_CONFIGURACIONES } from './permissionCatalog';

export interface PermisosContextValue {
  /** Rol efectivo (el simulado si el super usuario está usando "Ver como rol"). */
  rol: RolId | null;
  /** Rol real del usuario autenticado. */
  rolReal: RolId | null;
  alcance: AlcanceRol;
  esSuperUsuario: boolean;
  /** `true` si el rol tiene el permiso. Deny-by-default sin sesión. */
  can: (key: PermisoKey) => boolean;
  canAny: (keys: PermisoKey[]) => boolean;
  /** `true` si el rol puede navegar a la vista indicada. */
  puedeVerVista: (vista: string) => boolean;
  /** Vista agregada heredada para componentes existentes. */
  legado: PermisosRol | null;
  /** Rol simulado ("Ver como rol"), solo disponible para el super usuario. */
  rolSimulado: RolId | null;
  setRolSimulado: (r: RolId | null) => void;
}

const PermisosContext = createContext<PermisosContextValue | null>(null);

/** Construye el evaluador de permisos para un rol (usable fuera de React). */
export function crearEvaluador(rol: RolId | null) {
  const can = (key: PermisoKey) => (rol ? RolesPermisosService.tienePermiso(rol, key) : false);
  const canAny = (keys: PermisoKey[]) => keys.some(can);
  const puedeVerVista = (vista: string) => {
    if (!rol) return false;
    if (vista === 'configuraciones') return canAny(PERMISOS_CONFIGURACIONES);
    const req = PERMISO_POR_VISTA[vista];
    return req ? can(req) : true;
  };
  return { can, canAny, puedeVerVista };
}

/**
 * Hook que calcula el evaluador de permisos para una sesión. Se re-evalúa automáticamente
 * cuando el Super Usuario modifica la matriz o activa "Ver como rol".
 */
export function useEvaluadorPermisos(session: AuthSession | null): PermisosContextValue {
  const [version, setVersion] = useState(0);

  useEffect(() => RolesPermisosService.subscribe(() => setVersion(v => v + 1)), []);

  // Sincroniza la matriz publicada al iniciar sesión / limpia simulación al salir
  useEffect(() => {
    if (session) RolesPermisosService.sincronizarDesdeFirestore().catch(() => {});
    else RolesPermisosService.setRolSimulado(null);
  }, [session?.usuario.id]);

  const rolReal: RolId | null = session ? normalizarRol(session.usuario.role) : null;
  const esSuperReal = rolReal === 'super_usuario';
  const simulado = esSuperReal ? RolesPermisosService.getRolSimulado() : null;
  const rol = simulado || rolReal;

  return useMemo<PermisosContextValue>(() => {
    const ev = crearEvaluador(rol);
    return {
      rol,
      rolReal,
      alcance: rol ? getDefinicionRol(rol).alcance : 'establecimiento',
      esSuperUsuario: rol === 'super_usuario',
      ...ev,
      legado: rol ? RolesPermisosService.derivarPermisosLegados(rol) : null,
      rolSimulado: simulado,
      setRolSimulado: (r: RolId | null) => { if (esSuperReal) RolesPermisosService.setRolSimulado(r); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rol, rolReal, version, simulado, esSuperReal]);
}

/** Provider: recibe el valor calculado por `useEvaluadorPermisos` (o la sesión directamente). */
export const PermisosProvider: React.FC<{ value: PermisosContextValue; children: React.ReactNode }> = ({ value, children }) => (
  <PermisosContext.Provider value={value}>{children}</PermisosContext.Provider>
);

/** Hook de permisos. Fuera del Provider devuelve un evaluador que deniega todo. */
export function usePermisos(): PermisosContextValue {
  const ctx = useContext(PermisosContext);
  if (ctx) return ctx;
  const ev = crearEvaluador(null);
  return {
    rol: null, rolReal: null, alcance: 'establecimiento', esSuperUsuario: false, legado: null,
    rolSimulado: null, setRolSimulado: () => {}, ...ev
  };
}

/** Renderiza `children` solo si el usuario tiene el permiso (o alguno de la lista). */
export const Can: React.FC<{ permiso: PermisoKey | PermisoKey[]; fallback?: React.ReactNode; children: React.ReactNode }> = ({
  permiso, fallback = null, children
}) => {
  const { can, canAny } = usePermisos();
  const ok = Array.isArray(permiso) ? canAny(permiso) : can(permiso);
  return <>{ok ? children : fallback}</>;
};
