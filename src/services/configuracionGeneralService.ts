import { ConfiguracionGeneral, PerfilAsesor, ParametrosMineducConfig, GeminiConfig, PreferenciasUiConfig, Establecimiento } from '../types';
import { guardarEstablecimiento, listarEstablecimientos } from '../database/db';

const STORAGE_KEY_CONFIG = 'slep_configuracion_general_v1';

export const ASESORES_INICIALES_PREDETERMINADOS: PerfilAsesor[] = [
  {
    id: 'asesor-1',
    nombre: 'Rodrigo Fuentes Uribe',
    email: 'rodrigo.fuentes@slepvallediguillin.cl',
    telefono: '+56 9 8452 1140',
    cargo: 'Asesor Técnico Pedagógico UATP',
    comunasPreferentes: ['Bulnes', 'Chillán Viejo'],
    colorBadge: '#2563eb' // blue-600
  },
  {
    id: 'asesor-2',
    nombre: 'Marcela Navarrete Díaz',
    email: 'marcela.navarrete@slepvallediguillin.cl',
    telefono: '+56 9 9234 5580',
    cargo: 'Asesora Técnico Pedagógica UATP',
    comunasPreferentes: ['San Ignacio', 'Yungay'],
    colorBadge: '#7c3aed' // purple-600
  },
  {
    id: 'asesor-3',
    nombre: 'Claudia Morales San Martín',
    email: 'claudia.morales@slepvallediguillin.cl',
    telefono: '+56 9 7123 9944',
    cargo: 'Coordinadora de Acompañamiento UATP',
    comunasPreferentes: ['Chillán', 'El Carmen'],
    colorBadge: '#059669' // emerald-600
  },
  {
    id: 'asesor-4',
    nombre: 'Gonzalo Sepúlveda Alarcón',
    email: 'gonzalo.sepulveda@slepvallediguillin.cl',
    telefono: '+56 9 6345 8812',
    cargo: 'Asesor Especialista PIE & Inclusión',
    comunasPreferentes: ['Pemuco', 'Yungay'],
    colorBadge: '#ea580c' // orange-600
  },
  {
    id: 'asesor-5',
    nombre: 'UATP Valle Diguillín',
    email: 'uatp@slepvallediguillin.cl',
    telefono: '+56 42 283 5000',
    cargo: 'Equipo Central UATP',
    comunasPreferentes: ['Chillán', 'Bulnes', 'Chillán Viejo', 'El Carmen', 'Pemuco', 'San Ignacio', 'Yungay'],
    colorBadge: '#475569' // slate-600
  }
];

export const PARAMETROS_MINEDUC_DEFAULT: ParametrosMineducConfig = {
  umbralPrioritarios60_40: 80,
  duracionHoraPedagogicaMin: 45,
  minutosRecreoPorHora: 10,
  topeHorasDocenteSlep: 44,
  horasPieDocenteBasePorCurso: 3,
  horasPaeBasePorCurso: 7,
  validacionesEstrictas: true,
  restringirFinanciamientoSepPieEnPlanComun: true
};

export const GEMINI_CONFIG_DEFAULT: GeminiConfig = {
  apiKey: '',
  model: 'gemini-2.5-flash',
  analizarTodosAlExportar: false,
  modoEstrictoCopilot: true,
  temperatura: 0.2
};

export const UI_CONFIG_DEFAULT: PreferenciasUiConfig = {
  periodoPredeterminado: 2026,
  vistaInicial: 'colegios_asesorados',
  densidadTablas: 'comoda',
  mostrarAlertasFlotantes: true,
  animacionesHabilitadas: true
};

export const CONFIGURACION_DEFAULT: ConfiguracionGeneral = {
  asesorActivoId: 'asesor-1',
  asesorActivoNombre: 'Rodrigo Fuentes Uribe',
  asesorActivoEmail: 'rodrigo.fuentes@slepvallediguillin.cl',
  asesorActivoTelefono: '+56 9 8452 1140',
  asesorActivoCargo: 'Asesor Técnico Pedagógico UATP',
  asesoresRegistrados: ASESORES_INICIALES_PREDETERMINADOS,
  parametrosMineduc: PARAMETROS_MINEDUC_DEFAULT,
  gemini: GEMINI_CONFIG_DEFAULT,
  ui: UI_CONFIG_DEFAULT,
  ultimaModificacion: new Date().toISOString()
};

const inMemoryStorage = new Map<string, string>();

function safeGetItem(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem(key);
    }
  } catch (_) {}
  return inMemoryStorage.get(key) || null;
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, value);
    }
  } catch (_) {}
  inMemoryStorage.set(key, value);
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(key);
    }
  } catch (_) {}
  inMemoryStorage.delete(key);
}

/**
 * Carga la configuración general desde localStorage con sincronización retrocompatible.
 */
export function cargarConfiguracionGeneral(): ConfiguracionGeneral {
  try {
    const data = safeGetItem(STORAGE_KEY_CONFIG);
    let config: ConfiguracionGeneral;

    if (data) {
      config = JSON.parse(data);
    } else {
      config = { ...CONFIGURACION_DEFAULT };
    }

    // Sincronizar llaves sueltas de Gemini existentes
    const legacyApiKey = safeGetItem('gemini_api_key');
    const legacyModel = safeGetItem('gemini_model');
    const legacyAnalizarTodos = safeGetItem('gemini_export_analizar_todos');

    if (legacyApiKey && !config.gemini.apiKey) {
      config.gemini.apiKey = legacyApiKey;
    }
    if (legacyModel && (!config.gemini.model || config.gemini.model === 'gemini-2.5-flash')) {
      config.gemini.model = legacyModel;
    }
    if (legacyAnalizarTodos !== null) {
      config.gemini.analizarTodosAlExportar = legacyAnalizarTodos === 'true';
    }

    // Asegurar estructura completa y campos por defecto si faltan
    if (!config.asesoresRegistrados || config.asesoresRegistrados.length === 0) {
      config.asesoresRegistrados = ASESORES_INICIALES_PREDETERMINADOS;
    }
    if (!config.parametrosMineduc) {
      config.parametrosMineduc = { ...PARAMETROS_MINEDUC_DEFAULT };
    }
    if (!config.gemini) {
      config.gemini = { ...GEMINI_CONFIG_DEFAULT };
    }
    if (!config.ui) {
      config.ui = { ...UI_CONFIG_DEFAULT };
    }

    return config;
  } catch (e) {
    console.error('Error al cargar configuración general:', e);
    return { ...CONFIGURACION_DEFAULT };
  }
}

/**
 * Guarda la configuración general en localStorage y sincroniza variables globales.
 */
export function guardarConfiguracionGeneral(config: ConfiguracionGeneral): void {
  try {
    config.ultimaModificacion = new Date().toISOString();
    safeSetItem(STORAGE_KEY_CONFIG, JSON.stringify(config));

    // Sincronizar con llaves legacy que usan otros servicios
    if (config.gemini.apiKey) {
      safeSetItem('gemini_api_key', config.gemini.apiKey);
    } else {
      safeRemoveItem('gemini_api_key');
    }
    safeSetItem('gemini_model', config.gemini.model || 'gemini-2.5-flash');
    safeSetItem('gemini_export_analizar_todos', String(config.gemini.analizarTodosAlExportar));
  } catch (e) {
    console.error('Error al guardar configuración general:', e);
  }
}

/**
 * Obtiene el asesor activo configurado en el sistema.
 */
export function obtenerAsesorActivo(): PerfilAsesor {
  const config = cargarConfiguracionGeneral();
  const asesor = config.asesoresRegistrados.find(a => a.id === config.asesorActivoId || a.nombre === config.asesorActivoNombre);
  if (asesor) return asesor;
  return {
    id: config.asesorActivoId || 'asesor-1',
    nombre: config.asesorActivoNombre || 'Rodrigo Fuentes Uribe',
    email: config.asesorActivoEmail || 'rodrigo.fuentes@slepvallediguillin.cl',
    telefono: config.asesorActivoTelefono,
    cargo: config.asesorActivoCargo || 'Asesor Técnico Pedagógico UATP'
  };
}

/**
 * Establece el asesor activo actual.
 */
export function establecerAsesorActivo(asesorId: string): ConfiguracionGeneral {
  const config = cargarConfiguracionGeneral();
  const asesor = config.asesoresRegistrados.find(a => a.id === asesorId);
  if (asesor) {
    config.asesorActivoId = asesor.id;
    config.asesorActivoNombre = asesor.nombre;
    config.asesorActivoEmail = asesor.email;
    config.asesorActivoTelefono = asesor.telefono;
    config.asesorActivoCargo = asesor.cargo;
    guardarConfiguracionGeneral(config);
  }
  return config;
}

/**
 * Agrega o actualiza un asesor en la lista de asesores registrados.
 */
export function guardarPerfilAsesor(asesor: PerfilAsesor): ConfiguracionGeneral {
  const config = cargarConfiguracionGeneral();
  const idx = config.asesoresRegistrados.findIndex(a => a.id === asesor.id);
  if (idx >= 0) {
    config.asesoresRegistrados[idx] = asesor;
    if (config.asesorActivoId === asesor.id) {
      config.asesorActivoNombre = asesor.nombre;
      config.asesorActivoEmail = asesor.email;
      config.asesorActivoTelefono = asesor.telefono;
      config.asesorActivoCargo = asesor.cargo;
    }
  } else {
    config.asesoresRegistrados.push(asesor);
  }
  guardarConfiguracionGeneral(config);
  return config;
}

/**
 * Elimina un asesor del registro.
 */
export function eliminarPerfilAsesor(asesorId: string): ConfiguracionGeneral {
  const config = cargarConfiguracionGeneral();
  config.asesoresRegistrados = config.asesoresRegistrados.filter(a => a.id !== asesorId);
  if (config.asesorActivoId === asesorId && config.asesoresRegistrados.length > 0) {
    const primer = config.asesoresRegistrados[0];
    config.asesorActivoId = primer.id;
    config.asesorActivoNombre = primer.nombre;
    config.asesorActivoEmail = primer.email;
    config.asesorActivoTelefono = primer.telefono;
    config.asesorActivoCargo = primer.cargo;
  }
  guardarConfiguracionGeneral(config);
  return config;
}

/**
 * Reasigna masivamente un conjunto de establecimientos por RBD a un asesor UATP en SQLite.
 */
export async function reasignarColegiosMasivo(
  rbds: string[],
  nuevoAsesorNombre: string,
  colegiosActuales: Establecimiento[]
): Promise<void> {
  const rbdSet = new Set(rbds.map(r => r.trim()));
  for (const est of colegiosActuales) {
    if (rbdSet.has(est.rbd.trim())) {
      const actualizado: Establecimiento = {
        ...est,
        asesorUatp: nuevoAsesorNombre.trim() || undefined
      };
      await guardarEstablecimiento(actualizado);
    }
  }
}

/**
 * Restablece todas las configuraciones a sus valores de fábrica.
 */
export function restablecerConfiguracionPorDefecto(): ConfiguracionGeneral {
  const def = { ...CONFIGURACION_DEFAULT, ultimaModificacion: new Date().toISOString() };
  guardarConfiguracionGeneral(def);
  return def;
}
