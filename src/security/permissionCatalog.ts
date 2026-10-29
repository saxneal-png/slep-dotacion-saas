import { AccionPermiso, PermisoKey, RolId } from '../types/authTypes';

export type GrupoPermiso =
  | 'territorial'
  | 'establecimiento'
  | 'datos'
  | 'procesos'
  | 'ia'
  | 'administracion';

export interface ModuloPermiso {
  id: string;
  nombre: string;
  descripcion: string;
  grupo: GrupoPermiso;
  acciones: AccionPermiso[];
  /** Funciones de alto impacto (borrado masivo, traspasos, BD). Se destacan en la UI. */
  critico?: boolean;
  /** Solo el super usuario puede tenerlo. No es delegable. */
  reservadoSuperUsuario?: boolean;
}

export const GRUPOS_PERMISOS: { id: GrupoPermiso; nombre: string; descripcion: string }[] = [
  { id: 'territorial', nombre: 'Gestión Territorial', descripcion: 'Vistas multi-establecimiento del territorio SLEP' },
  { id: 'establecimiento', nombre: 'Espacio del Establecimiento', descripcion: 'Dotación, currículum y recursos de cada colegio' },
  { id: 'datos', nombre: 'Datos, Ingesta y Reportes', descripcion: 'Importaciones, exportaciones y descargas' },
  { id: 'procesos', nombre: 'Procesos Críticos', descripcion: 'Operaciones masivas e irreversibles' },
  { id: 'ia', nombre: 'Inteligencia Artificial', descripcion: 'Asistentes Gemini y Copilot' },
  { id: 'administracion', nombre: 'Administración del Sistema', descripcion: 'Configuración, usuarios y seguridad' }
];

export const ACCIONES_ETIQUETAS: Record<AccionPermiso, string> = {
  ver: 'Ver',
  editar: 'Crear / Editar',
  eliminar: 'Eliminar',
  importar: 'Importar',
  exportar: 'Exportar',
  ejecutar: 'Ejecutar'
};

export const ACCIONES_ORDEN: AccionPermiso[] = ['ver', 'editar', 'eliminar', 'importar', 'exportar', 'ejecutar'];

/** Catálogo maestro de funciones del SaaS. Fuente única de verdad para matriz, guards y pruebas. */
export const CATALOGO_PERMISOS: ModuloPermiso[] = [
  // ── Territorial ──
  { id: 'colegios_asesorados', nombre: 'Colegios Asesorados', descripcion: 'Panel de establecimientos asesorados', grupo: 'territorial', acciones: ['ver'] },
  { id: 'cartera', nombre: 'Cartera Territorial', descripcion: 'Cartera de colegios y reasignación de asesores', grupo: 'territorial', acciones: ['ver', 'editar'] },
  { id: 'consolidador', nombre: 'Consolidado Master', descripcion: 'Consolidado territorial de dotación e inconsistencias', grupo: 'territorial', acciones: ['ver', 'exportar'] },
  { id: 'estadisticas', nombre: 'Estadísticas', descripcion: 'Indicadores y estadísticas de horas', grupo: 'territorial', acciones: ['ver', 'exportar'] },

  // ── Establecimiento ──
  { id: 'workflow', nombre: 'Espacio Escolar', descripcion: 'Espacio de trabajo del establecimiento', grupo: 'establecimiento', acciones: ['ver'] },
  { id: 'salas_sae', nombre: 'Salas & Cupos SAE', descripcion: 'Infraestructura y aforos Dto. 548', grupo: 'establecimiento', acciones: ['ver', 'editar', 'eliminar'] },
  { id: 'curriculum', nombre: 'Cursos y Currículum', descripcion: 'Cursos, mallas y demanda curricular', grupo: 'establecimiento', acciones: ['ver', 'editar', 'eliminar'] },
  { id: 'planes_estudio', nombre: 'Planes de Estudio', descripcion: 'Catálogo de planes MINEDUC y EPJA', grupo: 'establecimiento', acciones: ['ver', 'editar'] },
  { id: 'docentes', nombre: 'Docentes Ley 20.903', descripcion: 'Nómina docente y asignaciones horarias', grupo: 'establecimiento', acciones: ['ver', 'editar', 'eliminar'] },
  { id: 'asistentes', nombre: 'Asistentes de la Educación', descripcion: 'Ley 21.109, duplas SEP y PIE', grupo: 'establecimiento', acciones: ['ver', 'editar', 'eliminar'] },
  { id: 'pie', nombre: 'Auditoría PIE', descripcion: 'Cuadre de horas Dto. 170', grupo: 'establecimiento', acciones: ['ver', 'editar'] },
  { id: 'balanza', nombre: 'Balanza & Diagnóstico', descripcion: 'Superávit y déficit horario', grupo: 'establecimiento', acciones: ['ver'] },

  // ── Datos ──
  { id: 'sige', nombre: 'Ingesta SIGE', descripcion: 'Carga de nóminas oficiales MINEDUC', grupo: 'datos', acciones: ['ver', 'importar'] },
  { id: 'analizador', nombre: 'Analizador de Dotación', descripcion: 'Análisis masivo de planillas de dotación', grupo: 'datos', acciones: ['ver', 'importar', 'exportar'] },
  { id: 'matriz_excel', nombre: 'Importar Matriz Excel', descripcion: 'Importación de matriz de dotación desde Excel', grupo: 'datos', acciones: ['importar'] },
  { id: 'establecimiento_slep', nombre: 'Archivos .slep', descripcion: 'Importar / exportar dotación por establecimiento', grupo: 'datos', acciones: ['importar', 'exportar'] },
  { id: 'centro_descargas', nombre: 'Centro de Descargas', descripcion: 'Reportes Excel y fichas', grupo: 'datos', acciones: ['ver', 'exportar'] },
  { id: 'planillas_dep', nombre: 'Planillas DEP (PAL / GDP)', descripcion: 'Exportación de planillas oficiales DEP', grupo: 'datos', acciones: ['exportar'] },

  // ── Procesos críticos ──
  { id: 'traspaso_periodos', nombre: 'Traspaso de Periodos', descripcion: 'Proyección interanual 2026 → 2027', grupo: 'procesos', acciones: ['ejecutar'], critico: true },
  { id: 'vaciar_dotacion', nombre: 'Vaciar / Reconciliar Dotación', descripcion: 'Purga y reconciliación masiva de datos', grupo: 'procesos', acciones: ['ejecutar'], critico: true },

  // ── IA ──
  { id: 'copilot', nombre: 'Copilot de Dotación', descripcion: 'Asistente IA conversacional', grupo: 'ia', acciones: ['ejecutar'] },
  { id: 'gemini_export', nombre: 'Asistente Gemini de Exportación', descripcion: 'Análisis IA al exportar matrices', grupo: 'ia', acciones: ['ejecutar'] },

  // ── Administración ──
  { id: 'config_normativa', nombre: 'Parámetros Normativos MINEDUC', descripcion: 'Motor normativo y planes de estudio base', grupo: 'administracion', acciones: ['ver', 'editar'] },
  { id: 'config_ia_ui', nombre: 'Configuración IA e Interfaz', descripcion: 'Perfil, Gemini y preferencias de interfaz', grupo: 'administracion', acciones: ['ver', 'editar'] },
  { id: 'base_datos', nombre: 'Base de Datos y Respaldos', descripcion: 'Respaldos SQLite, sincronización y restablecimiento', grupo: 'administracion', acciones: ['ver', 'ejecutar'], critico: true },
  { id: 'usuarios', nombre: 'Gestión de Usuarios', descripcion: 'Cuentas, contraseñas y asignaciones', grupo: 'administracion', acciones: ['ver', 'editar', 'eliminar'], critico: true },
  { id: 'roles', nombre: 'Roles y Permisos', descripcion: 'Matriz de permisos por rol', grupo: 'administracion', acciones: ['ver', 'editar'], critico: true, reservadoSuperUsuario: true }
];

export const k = (modulo: string, accion: AccionPermiso): PermisoKey => `${modulo}.${accion}` as PermisoKey;

/** Todas las claves válidas del catálogo. */
export const TODAS_LAS_CLAVES: PermisoKey[] = CATALOGO_PERMISOS.flatMap(m => m.acciones.map(a => k(m.id, a)));

const CLAVES_SET = new Set<string>(TODAS_LAS_CLAVES);

export function esClaveValida(key: string): key is PermisoKey {
  return CLAVES_SET.has(key);
}

export function getModulo(id: string): ModuloPermiso | undefined {
  return CATALOGO_PERMISOS.find(m => m.id === id);
}

export function esClaveReservada(key: PermisoKey): boolean {
  const [mod] = key.split('.');
  return !!getModulo(mod)?.reservadoSuperUsuario;
}

// ── Helpers para construir la matriz por defecto ──
const todo = (...mods: string[]): PermisoKey[] =>
  mods.flatMap(id => (getModulo(id)?.acciones || []).map(a => k(id, a)));
const solo = (accion: AccionPermiso, ...mods: string[]): PermisoKey[] =>
  mods.filter(id => getModulo(id)?.acciones.includes(accion)).map(id => k(id, accion));

const MODS_TERRITORIAL = ['colegios_asesorados', 'cartera', 'consolidador', 'estadisticas'];
const MODS_ESTABLECIMIENTO = ['workflow', 'salas_sae', 'curriculum', 'planes_estudio', 'docentes', 'asistentes', 'pie', 'balanza'];
const MODS_DATOS = ['sige', 'analizador', 'matriz_excel', 'establecimiento_slep', 'centro_descargas', 'planillas_dep'];

/** Matriz por defecto (propuesta aprobada en el plan de implementación). */
export const PERMISOS_POR_DEFECTO: Record<RolId, PermisoKey[]> = {
  super_usuario: [...TODAS_LAS_CLAVES],

  subdirector_uatp: [
    ...todo(...MODS_TERRITORIAL),
    ...solo('ver', ...MODS_ESTABLECIMIENTO),
    k('sige', 'ver'),
    k('analizador', 'ver'), k('analizador', 'exportar'),
    k('establecimiento_slep', 'exportar'),
    ...todo('centro_descargas', 'planillas_dep'),
    ...todo('copilot', 'gemini_export'),
    k('config_normativa', 'ver'), k('config_ia_ui', 'ver'), k('base_datos', 'ver'), k('usuarios', 'ver')
  ],

  coordinador_uatp: [
    ...todo(...MODS_TERRITORIAL),
    ...todo(...MODS_ESTABLECIMIENTO),
    ...todo(...MODS_DATOS),
    ...todo('traspaso_periodos', 'vaciar_dotacion'),
    ...todo('copilot', 'gemini_export')
  ],

  asesor_uatp: [
    ...solo('ver', ...MODS_TERRITORIAL),
    ...todo(...MODS_ESTABLECIMIENTO),
    ...todo(...MODS_DATOS),
    ...todo('copilot', 'gemini_export')
  ],

  director_establecimiento: [
    k('workflow', 'ver'),
    k('salas_sae', 'ver'), k('salas_sae', 'editar'),
    k('curriculum', 'ver'), k('curriculum', 'editar'),
    k('planes_estudio', 'ver'),
    k('docentes', 'ver'), k('docentes', 'editar'),
    k('asistentes', 'ver'), k('asistentes', 'editar'),
    k('pie', 'ver'), k('pie', 'editar'),
    k('balanza', 'ver'),
    ...todo('centro_descargas', 'planillas_dep')
  ],

  jefe_utp_establecimiento: [
    k('workflow', 'ver'),
    k('salas_sae', 'ver'),
    k('curriculum', 'ver'), k('curriculum', 'editar'),
    k('planes_estudio', 'ver'), k('planes_estudio', 'editar'),
    k('docentes', 'ver'),
    k('asistentes', 'ver'),
    k('pie', 'ver'),
    k('balanza', 'ver'),
    ...todo('centro_descargas', 'planillas_dep')
  ]
};

/**
 * Normaliza un conjunto de permisos aplicando las reglas de dependencia:
 * - cualquier acción distinta de `ver` implica `ver` (si el módulo tiene `ver`);
 * - se descartan claves inválidas y duplicadas;
 * - las claves reservadas solo se conservan para el super usuario.
 */
export function normalizarPermisos(rolId: RolId, permisos: string[]): PermisoKey[] {
  const set = new Set<PermisoKey>();
  for (const p of permisos) {
    if (!esClaveValida(p)) continue;
    if (rolId !== 'super_usuario' && esClaveReservada(p)) continue;
    set.add(p);
    const [mod, accion] = p.split('.') as [string, AccionPermiso];
    if (accion !== 'ver' && getModulo(mod)?.acciones.includes('ver')) {
      set.add(k(mod, 'ver'));
    }
  }
  return TODAS_LAS_CLAVES.filter(c => set.has(c));
}

/** Mapa vista de la app → permiso requerido para acceder (guard de navegación). */
export const PERMISO_POR_VISTA: Record<string, PermisoKey> = {
  colegios_asesorados: 'colegios_asesorados.ver',
  cartera: 'cartera.ver',
  consolidador: 'consolidador.ver',
  estadisticas: 'estadisticas.ver',
  workflow: 'workflow.ver',
  salas_sae: 'salas_sae.ver',
  curriculum: 'curriculum.ver',
  planes_estudio: 'planes_estudio.ver',
  docentes: 'docentes.ver',
  asistentes: 'asistentes.ver',
  pie: 'pie.ver',
  balanza: 'balanza.ver',
  sige: 'sige.ver',
  analizador: 'analizador.ver'
};

/** Permisos que habilitan la vista de Configuraciones (basta con uno). */
export const PERMISOS_CONFIGURACIONES: PermisoKey[] = [
  'config_normativa.ver', 'config_ia_ui.ver', 'base_datos.ver', 'usuarios.ver', 'roles.ver'
];
