import {
  CambioPermisosBitacora, MatrizPermisos, MatrizRol, PermisoKey, PermisosRol, RolId
} from '../types/authTypes';
import {
  PERMISOS_POR_DEFECTO, TODAS_LAS_CLAVES, normalizarPermisos, PERMISOS_CONFIGURACIONES
} from '../security/permissionCatalog';
import { ROL_IDS, getDefinicionRol, normalizarRol } from '../security/rolesDefinitions';
import { doc, getDoc, setDoc, collection, addDoc } from 'firebase/firestore';
import { auth, firestore } from './firebaseConfig';

export const STORAGE_MATRIZ_KEY = 'slep_roles_permisos_v1';
export const STORAGE_BITACORA_KEY = 'slep_roles_permisos_bitacora_v1';
const MAX_BITACORA = 500;

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: MatrizPermisos | null = null;
/** Rol simulado por el super usuario ("Ver como rol"). Solo en memoria, no se persiste. */
let rolSimulado: RolId | null = null;

function ahora(): string {
  return new Date().toISOString();
}

function storage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function matrizPorDefecto(): MatrizPermisos {
  const fecha = ahora();
  return ROL_IDS.reduce((acc, rol) => {
    acc[rol] = {
      permisos: normalizarPermisos(rol, PERMISOS_POR_DEFECTO[rol]),
      version: 1,
      actualizadoEn: fecha,
      actualizadoPor: 'sistema'
    };
    return acc;
  }, {} as MatrizPermisos);
}

function notificar() {
  listeners.forEach(l => {
    try { l(); } catch (e) { console.error('[RolesPermisos] listener error', e); }
  });
}

function persistir(m: MatrizPermisos) {
  cache = m;
  storage()?.setItem(STORAGE_MATRIZ_KEY, JSON.stringify(m));
  notificar();
}

function registrarBitacora(entry: Omit<CambioPermisosBitacora, 'id' | 'fecha'>) {
  if (!entry.agregados.length && !entry.removidos.length) return;
  const full: CambioPermisosBitacora = {
    ...entry,
    id: `perm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fecha: ahora()
  };
  const lista = RolesPermisosService.getBitacora();
  lista.unshift(full);
  storage()?.setItem(STORAGE_BITACORA_KEY, JSON.stringify(lista.slice(0, MAX_BITACORA)));

  if (typeof window !== 'undefined' && firestore) {
    const payloadFirestore: Record<string, any> = {
      rolId: full.rolId,
      agregados: full.agregados,
      removidos: full.removidos,
      usuario: full.usuario || 'usuario_sistema',
      motivo: full.motivo?.trim() || 'Actualización manual de permisos',
      fecha: full.fecha,
      id: full.id
    };
    addDoc(collection(firestore, 'auditoria_permisos'), payloadFirestore).catch(e =>
      console.warn('[RolesPermisos] No se pudo registrar bitácora remota:', e?.code || e)
    );
  }
}

function publicarRemoto(rol: RolId, data: MatrizRol) {
  if (typeof window !== 'undefined' && firestore) {
    setDoc(doc(firestore, 'config_roles', rol), data, { merge: false }).catch(e =>
      console.warn('[RolesPermisos] No se pudo sincronizar rol con Firestore:', e?.code || e)
    );
  }
}

export interface DiffPermisos {
  agregados: PermisoKey[];
  removidos: PermisoKey[];
}

export class RolesPermisosService {
  /** Carga la matriz (localStorage + defaults). El super usuario siempre conserva todos los permisos. */
  static cargarMatriz(): MatrizPermisos {
    if (cache) return cache;
    const base = matrizPorDefecto();
    const raw = storage()?.getItem(STORAGE_MATRIZ_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<Record<string, MatrizRol>>;
        for (const rol of ROL_IDS) {
          const r = parsed[rol];
          if (r && Array.isArray(r.permisos)) {
            base[rol] = {
              permisos: normalizarPermisos(rol, r.permisos),
              version: r.version || 1,
              actualizadoEn: r.actualizadoEn || base[rol].actualizadoEn,
              actualizadoPor: r.actualizadoPor || 'desconocido'
            };
          }
        }
      } catch (e) {
        console.error('[RolesPermisos] Matriz corrupta, usando valores por defecto', e);
      }
    }
    base.super_usuario = { ...base.super_usuario, permisos: [...TODAS_LAS_CLAVES] };
    cache = base;
    return base;
  }

  /** Limpia la caché en memoria (útil en tests o tras cambios externos). */
  static invalidarCache() {
    cache = null;
  }

  static subscribe(l: Listener): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  }

  static getRolSimulado(): RolId | null {
    return rolSimulado;
  }

  /** Activa/desactiva la simulación de un rol (la validación de super usuario se hace en el hook). */
  static setRolSimulado(r: RolId | null) {
    if (rolSimulado === r) return;
    rolSimulado = r;
    notificar();
  }

  static getPermisosRol(rol: unknown): PermisoKey[] {
    const r = normalizarRol(rol);
    if (r === 'super_usuario') return [...TODAS_LAS_CLAVES];
    return this.cargarMatriz()[r].permisos;
  }

  static tienePermiso(rol: unknown, key: PermisoKey): boolean {
    const r = normalizarRol(rol);
    if (r === 'super_usuario') return true;
    return this.cargarMatriz()[r].permisos.includes(key);
  }

  static tieneAlguno(rol: unknown, keys: PermisoKey[]): boolean {
    return keys.some(key => this.tienePermiso(rol, key));
  }

  static calcularDiff(rol: RolId, nuevos: string[]): DiffPermisos {
    const actuales = new Set(this.getPermisosRol(rol));
    const normalizados = normalizarPermisos(rol, nuevos);
    const nuevosSet = new Set(normalizados);
    return {
      agregados: normalizados.filter(p => !actuales.has(p)),
      removidos: [...actuales].filter(p => !nuevosSet.has(p)) as PermisoKey[]
    };
  }

  /** Guarda los permisos de un rol. Lanza error si el rol no es editable. */
  static guardarPermisosRol(rol: RolId, permisos: string[], actor: string, motivo?: string): DiffPermisos {
    const def = getDefinicionRol(rol);
    if (!def.editable) {
      throw new Error(`El rol "${def.nombre}" no es editable: conserva siempre el dominio completo.`);
    }
    const diff = this.calcularDiff(rol, permisos);
    const m = { ...this.cargarMatriz() };
    const data: MatrizRol = {
      permisos: normalizarPermisos(rol, permisos),
      version: (m[rol]?.version || 0) + 1,
      actualizadoEn: ahora(),
      actualizadoPor: actor
    };
    m[rol] = data;
    persistir(m);
    registrarBitacora({ rolId: rol, ...diff, usuario: actor, motivo: (motivo && motivo.trim()) ? motivo.trim() : 'Actualización de permisos' });
    publicarRemoto(rol, data);
    return diff;
  }

  static restablecerRol(rol: RolId, actor: string): DiffPermisos {
    return this.guardarPermisosRol(rol, PERMISOS_POR_DEFECTO[rol], actor, 'Restablecer valores por defecto');
  }

  static restablecerTodo(actor: string): void {
    for (const rol of ROL_IDS) {
      if (getDefinicionRol(rol).editable) this.restablecerRol(rol, actor);
    }
  }

  static copiarPermisos(origen: RolId, destino: RolId, actor: string): DiffPermisos {
    return this.guardarPermisosRol(destino, this.getPermisosRol(origen), actor, `Copiado desde ${getDefinicionRol(origen).nombre}`);
  }

  static getBitacora(): CambioPermisosBitacora[] {
    const raw = storage()?.getItem(STORAGE_BITACORA_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as CambioPermisosBitacora[];
    } catch {
      return [];
    }
  }

  /** Descarga la matriz publicada en Firestore (si hay sesión remota) y la aplica localmente. */
  static async sincronizarDesdeFirestore(): Promise<boolean> {
    if (typeof window === 'undefined' || !firestore || !auth?.currentUser) return false;
    try {
      const m = { ...this.cargarMatriz() };
      let cambios = false;
      for (const rol of ROL_IDS) {
        if (rol === 'super_usuario') continue;
        const snap = await getDoc(doc(firestore, 'config_roles', rol));
        const data = snap.exists() ? (snap.data() as MatrizRol) : null;
        if (data && Array.isArray(data.permisos) && (data.version || 0) > (m[rol].version || 0)) {
          m[rol] = { ...data, permisos: normalizarPermisos(rol, data.permisos) };
          cambios = true;
        }
      }
      if (cambios) persistir(m);
      return cambios;
    } catch (e: any) {
      console.warn('[RolesPermisos] Sincronización remota no disponible:', e?.code || e?.message || e);
      return false;
    }
  }

  /** Vista agregada heredada (`PermisosRol`) derivada de la matriz granular. */
  static derivarPermisosLegados(rol: unknown): PermisosRol {
    const r = normalizarRol(rol);
    const can = (key: PermisoKey) => this.tienePermiso(r, key);
    const any = (keys: PermisoKey[]) => keys.some(can);
    const puedeEditar = any(['docentes.editar', 'curriculum.editar', 'asistentes.editar', 'salas_sae.editar', 'pie.editar', 'planes_estudio.editar']);
    return {
      puedeEditarDotacion: puedeEditar,
      puedeEliminarRegistros: any(['docentes.eliminar', 'curriculum.eliminar', 'asistentes.eliminar', 'salas_sae.eliminar']),
      puedeConfigurarSistema: any(PERMISOS_CONFIGURACIONES),
      puedeGestionarUsuarios: can('usuarios.editar'),
      puedeAccederTodasEscuelas: getDefinicionRol(r).alcance !== 'establecimiento',
      puedeVerCarteraTerritorial: can('cartera.ver'),
      puedeVerConsolidadorMaster: can('consolidador.ver'),
      puedeVerAnalizadorSige: can('analizador.ver'),
      puedeExportarReportes: can('centro_descargas.exportar'),
      puedeUsarCopilotIa: can('copilot.ejecutar'),
      puedeTraspasarPeriodos: can('traspaso_periodos.ejecutar'),
      puedeImportarMatriz: can('matriz_excel.importar'),
      puedeVerCentroDescargas: can('centro_descargas.ver'),
      esSoloLectura: !puedeEditar
    };
  }
}
