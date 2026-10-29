import { Establecimiento } from '../types';
import { AlcanceRol, UsuarioSistema } from '../types/authTypes';
import { getDefinicionRol, normalizarRol } from '../security/rolesDefinitions';

type UsuarioScope = Pick<UsuarioSistema, 'id' | 'role' | 'nombreCompleto' | 'rbdAsignado' | 'carteraRbds' | 'asesoresSupervisados' | 'comunasPermitidas'>;

const norm = (s?: string) => (s || '').trim().toLowerCase();

export function getAlcance(usuario: Pick<UsuarioSistema, 'role'> | null | undefined): AlcanceRol {
  if (!usuario) return 'establecimiento';
  return getDefinicionRol(normalizarRol(usuario.role)).alcance;
}

/** RBD de la cartera de un asesor: los asignados explícitamente + los que lo registran como asesorUatp. */
function rbdsDeAsesor(asesor: UsuarioScope, colegios: Establecimiento[]): Set<string> {
  const set = new Set<string>(asesor.carteraRbds || []);
  const nombre = norm(asesor.nombreCompleto);
  if (nombre) {
    colegios.forEach(c => { if (norm(c.asesorUatp) === nombre) set.add(c.rbd); });
  }
  return set;
}

/**
 * Resuelve el conjunto de establecimientos accesibles para un usuario según el alcance de su rol.
 * - global: todos
 * - equipo: cartera propia + carteras de los asesores supervisados
 * - cartera: cartera propia (si está vacía, se usa el filtro heredado por comuna; si tampoco existe, todos)
 * - establecimiento: solo `rbdAsignado`
 */
export function colegiosVisibles(
  usuario: UsuarioScope | null | undefined,
  colegios: Establecimiento[],
  usuarios: UsuarioScope[] = []
): Establecimiento[] {
  if (!usuario) return colegios;
  const alcance = getAlcance(usuario);

  if (alcance === 'global') return colegios;

  if (alcance === 'establecimiento') {
    return usuario.rbdAsignado ? colegios.filter(c => c.rbd === usuario.rbdAsignado) : [];
  }

  const rbds = rbdsDeAsesor(usuario, colegios);
  if (alcance === 'equipo') {
    const equipo = usuarios.filter(u => (usuario.asesoresSupervisados || []).includes(u.id));
    equipo.forEach(a => rbdsDeAsesor(a, colegios).forEach(r => rbds.add(r)));
  }

  if (rbds.size > 0) return colegios.filter(c => rbds.has(c.rbd));

  // Compatibilidad: cartera aún no configurada explícitamente pero con comunas preferentes
  if (usuario.comunasPermitidas?.length) {
    return colegios.filter(c => usuario.comunasPermitidas!.includes(c.comuna));
  }

  // Si tiene rol con alcance 'cartera' o 'equipo' pero no tiene colegios asignados, no debe ver todo el territorio
  if (alcance === 'cartera' || alcance === 'equipo') {
    return [];
  }

  return colegios;
}

export function puedeAccederRbd(
  usuario: UsuarioScope | null | undefined,
  rbd: string,
  colegios: Establecimiento[],
  usuarios: UsuarioScope[] = []
): boolean {
  return colegiosVisibles(usuario, colegios, usuarios).some(c => c.rbd === rbd);
}
