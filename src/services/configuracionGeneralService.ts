import { ConfiguracionGeneral, PerfilAsesor, ParametrosMineducConfig, GeminiConfig, PreferenciasUiConfig, Establecimiento } from '../types';
import { guardarEstablecimiento, listarEstablecimientos } from '../database/db';

const STORAGE_KEY_CONFIG = 'slep_configuracion_general_v1';

export const ASESORES_INICIALES_PREDETERMINADOS: PerfilAsesor[] = [];

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
  periodoPredeterminado: 2027,
  vistaInicial: 'colegios_asesorados',
  densidadTablas: 'comoda',
  mostrarAlertasFlotantes: true,
  animacionesHabilitadas: true
};

export const CONFIGURACION_DEFAULT: ConfiguracionGeneral = {
  asesorActivoId: '',
  asesorActivoNombre: '',
  asesorActivoEmail: '',
  asesorActivoTelefono: undefined,
  asesorActivoCargo: '',
  asesoresRegistrados: [],
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
      // Migrar y limpiar de localStorage para no dejar credenciales en texto plano
      if (typeof window !== 'undefined' && window.electronAPI?.setGeminiKey) {
        window.electronAPI.setGeminiKey(legacyApiKey).catch(() => {});
        safeRemoveItem('gemini_api_key');
      }
    }
    if (legacyModel && (!config.gemini.model || config.gemini.model === 'gemini-2.5-flash')) {
      config.gemini.model = legacyModel;
    }
    if (legacyAnalizarTodos !== null) {
      config.gemini.analizarTodosAlExportar = legacyAnalizarTodos === 'true';
    }

    // Asegurar estructura completa y campos por defecto si faltan
    if (!config.asesoresRegistrados) {
      config.asesoresRegistrados = [];
    }

    // Purgar perfiles de prueba obsoletos si existían en localStorage
    const nombresPrueba = new Set([
      'rodrigo fuentes uribe',
      'marcela navarrete díaz',
      'marcela navarrete diaz',
      'claudia morales san martín',
      'claudia morales san martin',
      'gonzalo sepúlveda alarcón',
      'gonzalo sepulveda alarcon',
      'uatp valle diguillín',
      'uatp valle diguillin'
    ]);
    if (config.asesoresRegistrados.some(a => nombresPrueba.has(a.nombre.toLowerCase().trim()))) {
      config.asesoresRegistrados = config.asesoresRegistrados.filter(a => !nombresPrueba.has(a.nombre.toLowerCase().trim()));
      safeSetItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
    }
    if (config.asesorActivoNombre && nombresPrueba.has(config.asesorActivoNombre.toLowerCase().trim())) {
      config.asesorActivoId = '';
      config.asesorActivoNombre = '';
      config.asesorActivoEmail = '';
      config.asesorActivoCargo = '';
      safeSetItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
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

    // Si estamos en entorno Electron, persistir API Key de forma segura con safeStorage
    if (typeof window !== 'undefined' && window.electronAPI?.setGeminiKey) {
      window.electronAPI.setGeminiKey(config.gemini.apiKey || '').catch(err => {
        console.warn('Error al guardar API Key en safeStorage:', err);
      });
      // Purgar de localStorage para resguardar la seguridad de la clave
      safeRemoveItem('gemini_api_key');
    } else {
      // Fallback web tradicional
      if (config.gemini.apiKey) {
        safeSetItem('gemini_api_key', config.gemini.apiKey);
      } else {
        safeRemoveItem('gemini_api_key');
      }
    }

    safeSetItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
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
 * Unifica por id, correo institucional o nombre completo para evitar duplicaciones.
 */
export function guardarPerfilAsesor(asesor: PerfilAsesor): ConfiguracionGeneral {
  const config = cargarConfiguracionGeneral();
  const cleanId = (asesor.id || '').trim();
  const cleanEmail = (asesor.email || '').trim().toLowerCase();
  const cleanNombre = (asesor.nombre || '').trim().toLowerCase();

  const idx = config.asesoresRegistrados.findIndex(a => {
    if (cleanId && a.id === cleanId) return true;
    if (cleanEmail && (a.email || '').trim().toLowerCase() === cleanEmail) return true;
    if (cleanNombre && (a.nombre || '').trim().toLowerCase() === cleanNombre) return true;
    return false;
  });

  if (idx >= 0) {
    const previo = config.asesoresRegistrados[idx];
    config.asesoresRegistrados[idx] = {
      ...previo,
      ...asesor,
      id: previo.id || asesor.id,
      nombre: asesor.nombre.trim(),
      email: asesor.email.trim(),
      cargo: asesor.cargo?.trim() || previo.cargo,
      telefono: asesor.telefono?.trim() || previo.telefono,
      colorBadge: asesor.colorBadge || previo.colorBadge || '#2563eb'
    };
    if (config.asesorActivoId === previo.id || config.asesorActivoId === asesor.id) {
      config.asesorActivoNombre = asesor.nombre.trim();
      config.asesorActivoEmail = asesor.email.trim();
      config.asesorActivoTelefono = asesor.telefono;
      config.asesorActivoCargo = asesor.cargo;
    }
  } else {
    config.asesoresRegistrados.push({
      ...asesor,
      id: asesor.id || `asesor-${Date.now()}`,
      nombre: asesor.nombre.trim(),
      email: asesor.email.trim()
    });
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
 * Reconcilia bidireccionalmente el registro de Asesores UATP de la configuración con
 * los usuarios del sistema que posean el rol 'asesor_uatp'.
 */
export function sincronizarEquipoAsesoresConUsuariosLocales(
  usuarios: { id: string; username: string; nombreCompleto: string; email?: string; role: string; cargo?: string; carteraRbds?: string[] }[],
  colegios: Establecimiento[] = []
): ConfiguracionGeneral {
  const config = cargarConfiguracionGeneral();
  let huboCambios = false;

  const nombresPrueba = new Set([
    'rodrigo fuentes uribe',
    'marcela navarrete díaz',
    'marcela navarrete diaz',
    'claudia morales san martín',
    'claudia morales san martin',
    'gonzalo sepúlveda alarcón',
    'gonzalo sepulveda alarcon',
    'uatp valle diguillín',
    'uatp valle diguillin'
  ]);

  const asesoresUsuarios = usuarios.filter(u => u.role === 'asesor_uatp');

  // Purga estricta: los asesores registrados deben corresponder a usuarios activos con rol asesor_uatp
  if (asesoresUsuarios.length > 0) {
    const validEmails = new Set(asesoresUsuarios.map(u => (u.email || '').trim().toLowerCase()).filter(Boolean));
    const validUsernames = new Set(asesoresUsuarios.map(u => u.username.trim().toLowerCase()));
    const validNombres = new Set(asesoresUsuarios.map(u => u.nombreCompleto.trim().toLowerCase()));
    const validIds = new Set(asesoresUsuarios.map(u => u.id));

    const previosCount = config.asesoresRegistrados.length;
    config.asesoresRegistrados = config.asesoresRegistrados.filter(a => {
      const nom = a.nombre.trim().toLowerCase();
      const mail = (a.email || '').trim().toLowerCase();
      if (nombresPrueba.has(nom)) return false;
      return validIds.has(a.id) || validEmails.has(mail) || validNombres.has(nom);
    });

    if (config.asesoresRegistrados.length !== previosCount) {
      huboCambios = true;
    }
  }

  for (const u of asesoresUsuarios) {
    const cleanEmail = (u.email || '').trim().toLowerCase();
    const cleanNombre = u.nombreCompleto.trim().toLowerCase();

    const idx = config.asesoresRegistrados.findIndex(a =>
      a.id === u.id ||
      (cleanEmail && (a.email || '').trim().toLowerCase() === cleanEmail) ||
      (a.nombre || '').trim().toLowerCase() === cleanNombre
    );

    if (idx >= 0) {
      const previo = config.asesoresRegistrados[idx];
      if (
        previo.nombre !== u.nombreCompleto ||
        (u.email && previo.email !== u.email) ||
        (u.cargo && previo.cargo !== u.cargo)
      ) {
        config.asesoresRegistrados[idx] = {
          ...previo,
          nombre: u.nombreCompleto,
          email: u.email || previo.email,
          cargo: u.cargo || previo.cargo
        };
        huboCambios = true;
      }
    } else {
      config.asesoresRegistrados.push({
        id: u.id,
        nombre: u.nombreCompleto,
        email: u.email || `${u.username}@slepvallediguillin.cl`,
        cargo: u.cargo || 'Asesor Técnico Pedagógico UATP',
        colorBadge: '#2563eb'
      });
      huboCambios = true;
    }
  }

  if (huboCambios) {
    guardarConfiguracionGeneral(config);
  }
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
 * Actualiza la lista exacta de colegios asignados a un asesor UATP.
 * Asigna los colegios seleccionados y desasigna los que fueron removidos de su cartera.
 */
export async function actualizarColegiosDeAsesor(
  asesorNombre: string,
  rbdsSeleccionados: string[],
  colegiosActuales: Establecimiento[]
): Promise<void> {
  const rbdSet = new Set(rbdsSeleccionados.map(r => r.trim()));
  const asesorNorm = asesorNombre.trim().toLowerCase();

  for (const est of colegiosActuales) {
    const estRbd = est.rbd.trim();
    const estAsesor = (est.asesorUatp || '').trim().toLowerCase();

    if (rbdSet.has(estRbd)) {
      // Debe pertenecer a este asesor
      if (estAsesor !== asesorNorm) {
        await guardarEstablecimiento({
          ...est,
          asesorUatp: asesorNombre.trim()
        });
      }
    } else {
      // Si antes pertenecía a este asesor y ya no está seleccionado, se desasigna
      if (estAsesor === asesorNorm) {
        await guardarEstablecimiento({
          ...est,
          asesorUatp: undefined
        });
      }
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
