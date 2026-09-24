import React, { useState, useEffect } from 'react';
import {
  Settings, UserCheck, Shield, Sparkles, Sliders, Database, Save, RotateCcw,
  Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, Key, ExternalLink,
  Bot, Eye, HelpCircle, FileSpreadsheet, HardDrive, RefreshCw, Check,
  Mail, Phone, MapPin, Building2, Layers, Users, Search
} from 'lucide-react';
import {
  ConfiguracionGeneral,
  PerfilAsesor,
  ParametrosMineducConfig,
  GeminiConfig,
  PreferenciasUiConfig,
  Establecimiento,
  ComunaValleDiguillin
} from '../types';
import {
  cargarConfiguracionGeneral,
  guardarConfiguracionGeneral,
  guardarPerfilAsesor,
  eliminarPerfilAsesor,
  establecerAsesorActivo,
  restablecerConfiguracionPorDefecto,
  reasignarColegiosMasivo,
  actualizarColegiosDeAsesor
} from '../services/configuracionGeneralService';
import { sincronizarCatalogoEstablecimientos } from '../database/seedData';

interface ConfiguracionesGeneralesViewProps {
  colegios: Establecimiento[];
  onColegiosActualizados?: () => Promise<void>;
  onExportarSqlite: () => void;
  onImportarSqlite: (file: File) => void;
  onExportarCarteraSlep: () => void;
  onImportarCarteraSlep: (file: File) => void;
  onVolver?: () => void;
}

const COMUNAS_DISPONIBLES: ComunaValleDiguillin[] = [
  'Bulnes',
  'Chillán',
  'Chillán Viejo',
  'El Carmen',
  'Pemuco',
  'San Ignacio',
  'Yungay'
];

export const ConfiguracionesGeneralesView: React.FC<ConfiguracionesGeneralesViewProps> = ({
  colegios,
  onColegiosActualizados,
  onExportarSqlite,
  onImportarSqlite,
  onExportarCarteraSlep,
  onImportarCarteraSlep,
  onVolver
}) => {
  const [config, setConfig] = useState<ConfiguracionGeneral>(() => cargarConfiguracionGeneral());
  const [tabActiva, setTabActiva] = useState<'perfil' | 'normativa' | 'ia' | 'ui' | 'db'>('perfil');
  const [mensajeGuardado, setMensajeGuardado] = useState<string | null>(null);
  const [probandoGemini, setProbandoGemini] = useState(false);
  const [resultadoTestGemini, setResultadoTestGemini] = useState<{ exito: boolean; mensaje: string } | null>(null);

  // Modal para agregar/editar asesor
  const [modalAsesorAbierto, setModalAsesorAbierto] = useState(false);
  const [asesorEnEdicion, setAsesorEnEdicion] = useState<PerfilAsesor | null>(null);
  const [formNombreAsesor, setFormNombreAsesor] = useState('');
  const [formEmailAsesor, setFormEmailAsesor] = useState('');
  const [formTelefonoAsesor, setFormTelefonoAsesor] = useState('');
  const [formCargoAsesor, setFormCargoAsesor] = useState('Asesor Técnico Pedagógico UATP');
  const [formComunasAsesor, setFormComunasAsesor] = useState<ComunaValleDiguillin[]>([]);
  const [formColorBadge, setFormColorBadge] = useState('#2563eb');
  const [formColegiosAsignados, setFormColegiosAsignados] = useState<string[]>([]);
  const [busquedaColegioModal, setBusquedaColegioModal] = useState('');
  const [filtroComunaModal, setFiltroComunaModal] = useState<string>('ALL');
  const [guardandoAsesor, setGuardandoAsesor] = useState(false);

  const mostrarMensaje = (msg: string) => {
    setMensajeGuardado(msg);
    setTimeout(() => setMensajeGuardado(null), 3500);
  };

  // Guardar configuración completa
  const handleGuardarConfig = (nuevaConfig: ConfiguracionGeneral) => {
    setConfig(nuevaConfig);
    guardarConfiguracionGeneral(nuevaConfig);
    mostrarMensaje('✓ Configuración guardada y sincronizada correctamente.');
  };

  // Cambio en parámetros normativos MINEDUC
  const handleNormativaChange = <K extends keyof ParametrosMineducConfig>(
    key: K,
    value: ParametrosMineducConfig[K]
  ) => {
    const actualizada: ConfiguracionGeneral = {
      ...config,
      parametrosMineduc: {
        ...config.parametrosMineduc,
        [key]: value
      }
    };
    handleGuardarConfig(actualizada);
  };

  // Cambio en configuración de Gemini AI
  const handleGeminiChange = <K extends keyof GeminiConfig>(
    key: K,
    value: GeminiConfig[K]
  ) => {
    const actualizada: ConfiguracionGeneral = {
      ...config,
      gemini: {
        ...config.gemini,
        [key]: value
      }
    };
    handleGuardarConfig(actualizada);
  };

  // Cambio en preferencias de UI
  const handleUiChange = <K extends keyof PreferenciasUiConfig>(
    key: K,
    value: PreferenciasUiConfig[K]
  ) => {
    const actualizada: ConfiguracionGeneral = {
      ...config,
      ui: {
        ...config.ui,
        [key]: value
      }
    };
    handleGuardarConfig(actualizada);
  };

  // Probar conexión de Gemini API
  const handleProbarGeminiApi = async () => {
    if (!config.gemini.apiKey) {
      setResultadoTestGemini({ exito: false, mensaje: 'Por favor ingresa una API Key antes de probar.' });
      return;
    }
    setProbandoGemini(true);
    setResultadoTestGemini(null);
    try {
      const resp = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model || 'gemini-2.5-flash'}:generateContent?key=${config.gemini.apiKey.trim()}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Responde exactamente "CONEXION_EXITOSA" si recibes este mensaje de prueba.' }] }]
          })
        }
      );
      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `Error HTTP ${resp.status}`);
      }
      const data = await resp.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      setResultadoTestGemini({
        exito: true,
        mensaje: `✓ Conexión exitosa con Google Gemini (${config.gemini.model || 'gemini-2.5-flash'}). Respuesta recibida: "${text.trim()}".`
      });
    } catch (e: any) {
      setResultadoTestGemini({
        exito: false,
        mensaje: `✗ Error de conexión con Gemini API: ${e.message || e}`
      });
    } finally {
      setProbandoGemini(false);
    }
  };

  // Manejo de Modal de Asesor
  const abrirModalNuevoAsesor = () => {
    setAsesorEnEdicion(null);
    setFormNombreAsesor('');
    setFormEmailAsesor('@slepvallediguillin.cl');
    setFormTelefonoAsesor('+56 9 ');
    setFormCargoAsesor('Asesor Técnico Pedagógico UATP');
    setFormComunasAsesor([]);
    setFormColorBadge('#2563eb');
    setFormColegiosAsignados([]);
    setBusquedaColegioModal('');
    setFiltroComunaModal('ALL');
    setModalAsesorAbierto(true);
  };

  const abrirModalEditarAsesor = (asesor: PerfilAsesor) => {
    setAsesorEnEdicion(asesor);
    setFormNombreAsesor(asesor.nombre);
    setFormEmailAsesor(asesor.email);
    setFormTelefonoAsesor(asesor.telefono || '');
    setFormCargoAsesor(asesor.cargo || 'Asesor Técnico Pedagógico UATP');
    setFormComunasAsesor(asesor.comunasPreferentes || []);
    setFormColorBadge(asesor.colorBadge || '#2563eb');
    
    // Colegios actualmente asignados a este asesor
    const rbdsAsignados = colegios
      .filter(c => c.asesorUatp?.toLowerCase().trim() === asesor.nombre.toLowerCase().trim())
      .map(c => c.rbd);
    setFormColegiosAsignados(rbdsAsignados);
    setBusquedaColegioModal('');
    setFiltroComunaModal('ALL');
    setModalAsesorAbierto(true);
  };

  const handleGuardarModalAsesor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formNombreAsesor.trim()) return;

    setGuardandoAsesor(true);
    try {
      const asesorGuardar: PerfilAsesor = {
        id: asesorEnEdicion ? asesorEnEdicion.id : `asesor-${Date.now()}`,
        nombre: formNombreAsesor.trim(),
        email: formEmailAsesor.trim(),
        telefono: formTelefonoAsesor.trim() || undefined,
        cargo: formCargoAsesor.trim() || undefined,
        comunasPreferentes: formComunasAsesor,
        colorBadge: formColorBadge
      };

      const configActualizada = guardarPerfilAsesor(asesorGuardar);
      setConfig(configActualizada);

      // Actualizar asignación exacta de colegios por RBD
      await actualizarColegiosDeAsesor(asesorGuardar.nombre, formColegiosAsignados, colegios);

      if (onColegiosActualizados) {
        await onColegiosActualizados();
      }

      setModalAsesorAbierto(false);
      mostrarMensaje(`✓ Asesor "${asesorGuardar.nombre}" y su cartera de ${formColegiosAsignados.length} colegios guardados correctamente.`);
    } catch (err: any) {
      alert(`Error al guardar asesor y cartera de colegios: ${err.message || err}`);
    } finally {
      setGuardandoAsesor(false);
    }
  };

  const toggleColegioEnModal = (rbd: string) => {
    setFormColegiosAsignados(prev =>
      prev.includes(rbd) ? prev.filter(r => r !== rbd) : [...prev, rbd]
    );
  };

  const colegiosFiltradosModal = colegios.filter(c => {
    if (filtroComunaModal !== 'ALL' && c.comuna !== filtroComunaModal) return false;
    if (busquedaColegioModal.trim()) {
      const q = busquedaColegioModal.toLowerCase().trim();
      const mNom = c.nombre.toLowerCase().includes(q);
      const mRbd = c.rbd.toLowerCase().includes(q);
      const mCom = (c.comuna || '').toLowerCase().includes(q);
      return mNom || mRbd || mCom;
    }
    return true;
  });

  const handleEliminarAsesor = (asesorId: string, asesorNombre: string) => {
    if (confirm(`¿Estás seguro de eliminar al asesor "${asesorNombre}" de la lista registrada?`)) {
      const configActualizada = eliminarPerfilAsesor(asesorId);
      setConfig(configActualizada);
      mostrarMensaje(`✓ Asesor "${asesorNombre}" eliminado.`);
    }
  };

  const handleSeleccionarAsesorActivo = (asesorId: string) => {
    const configActualizada = establecerAsesorActivo(asesorId);
    setConfig(configActualizada);
    mostrarMensaje(`✓ Asesor activo cambiado a "${configActualizada.asesorActivoNombre}".`);
  };

  // Re-sincronizar Catálogo Maestro de 121 escuelas
  const handleResincronizarCatalogo = async () => {
    if (confirm('¿Deseas sincronizar y asegurar que los 121 establecimientos del SLEP Valle Diguillín estén presentes en la base de datos?')) {
      await sincronizarCatalogoEstablecimientos();
      if (onColegiosActualizados) await onColegiosActualizados();
      mostrarMensaje('✓ Catálogo maestro de 121 establecimientos sincronizado exitosamente.');
    }
  };

  // Restablecer fábrica
  const handleRestablecerFabrica = () => {
    if (confirm('¿Restablecer todas las configuraciones generales a sus valores predeterminados?')) {
      const def = restablecerConfiguracionPorDefecto();
      setConfig(def);
      mostrarMensaje('✓ Configuraciones restablecidas a valores de fábrica.');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notificación */}
      {mensajeGuardado && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-emerald-300 border border-emerald-500/50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{mensajeGuardado}</span>
        </div>
      )}

      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-[#002B49] flex items-center justify-center text-white shadow-md">
            <Settings className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Centro de Configuraciones Generales
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Administración de perfil de asesor, parámetros normativos MINEDUC, Google Gemini IA y preferencias del sistema.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onVolver && (
            <button
              onClick={onVolver}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              Volver
            </button>
          )}
          <button
            onClick={() => handleGuardarConfig(config)}
            className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </div>

      {/* Navegación por Pestañas */}
      <div className="flex items-center gap-1.5 overflow-x-auto bg-slate-200/70 p-1 rounded-2xl border border-slate-300/60 shadow-inner">
        
        <button
          onClick={() => setTabActiva('perfil')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'perfil'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <UserCheck className="w-4 h-4 text-blue-600" />
          <span>Perfil & Asesores UATP</span>
        </button>

        <button
          onClick={() => setTabActiva('normativa')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'normativa'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Shield className="w-4 h-4 text-emerald-600" />
          <span>Normativa & Motor MINEDUC</span>
        </button>

        <button
          onClick={() => setTabActiva('ia')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'ia'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Sparkles className="w-4 h-4 text-orange-500" />
          <span>Gemini IA & Copilot</span>
        </button>

        <button
          onClick={() => setTabActiva('ui')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'ui'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Sliders className="w-4 h-4 text-purple-600" />
          <span>Interfaz & Visualización</span>
        </button>

        <button
          onClick={() => setTabActiva('db')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'db'
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <Database className="w-4 h-4 text-slate-700" />
          <span>Base de Datos & Respaldos</span>
        </button>

      </div>

      {/* CONTENIDO DE LAS PESTAÑAS */}

      {/* 1. PESTAÑA PERFIL & ASESORES UATP */}
      {tabActiva === 'perfil' && (
        <div className="space-y-6">
          
          {/* Tarjeta de Asesor Activo */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <UserCheck className="w-5 h-5 text-blue-600" />
                  Asesor UATP Activo en la Sesión
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Este asesor se utiliza como filtro por defecto en "Mis Colegios Asesorados" y en la firma de exportaciones.
                </p>
              </div>

              {/* Selector de Asesor Activo */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-bold text-slate-600">Cambiar a:</label>
                <select
                  value={config.asesorActivoId}
                  onChange={(e) => handleSeleccionarAsesorActivo(e.target.value)}
                  className="bg-slate-50 border border-slate-300 text-slate-800 text-xs font-bold rounded-xl px-3 py-2 focus:ring-2 focus:ring-blue-500"
                >
                  {config.asesoresRegistrados.map((a) => (
                    <option key={a.id} value={a.id}>
                      👤 {a.nombre}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Datos del Asesor Activo */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={config.asesorActivoNombre}
                  onChange={(e) => {
                    const act = { ...config, asesorActivoNombre: e.target.value };
                    handleGuardarConfig(act);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Correo Institucional</label>
                <input
                  type="email"
                  value={config.asesorActivoEmail}
                  onChange={(e) => {
                    const act = { ...config, asesorActivoEmail: e.target.value };
                    handleGuardarConfig(act);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Teléfono Móvil</label>
                <input
                  type="text"
                  value={config.asesorActivoTelefono || ''}
                  placeholder="+56 9 1234 5678"
                  onChange={(e) => {
                    const act = { ...config, asesorActivoTelefono: e.target.value };
                    handleGuardarConfig(act);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cargo / Estamento UATP</label>
                <input
                  type="text"
                  value={config.asesorActivoCargo || ''}
                  onChange={(e) => {
                    const act = { ...config, asesorActivoCargo: e.target.value };
                    handleGuardarConfig(act);
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Registro de Asesores UATP del Territorio */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-5 h-5 text-indigo-600" />
                  Equipo de Asesores Técnicos UATP ({config.asesoresRegistrados.length})
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Gestiona los asesores disponibles para asignarles carteras de escuelas y liceos.
                </p>
              </div>

              <button
                onClick={abrirModalNuevoAsesor}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nuevo Asesor UATP</span>
              </button>
            </div>

            {/* Listado de Asesores */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {config.asesoresRegistrados.map((asesor) => {
                const colegiosAsignados = colegios.filter(
                  c => c.asesorUatp?.toLowerCase().trim() === asesor.nombre.toLowerCase().trim()
                );
                const esActivo = config.asesorActivoId === asesor.id || config.asesorActivoNombre === asesor.nombre;

                return (
                  <div
                    key={asesor.id}
                    className={`p-4 rounded-xl border flex flex-col justify-between transition-all ${
                      esActivo ? 'bg-blue-50/50 border-blue-400 ring-2 ring-blue-400/20' : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-sm"
                            style={{ backgroundColor: asesor.colorBadge || '#2563eb' }}
                          >
                            {asesor.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 text-xs">{asesor.nombre}</h4>
                            <p className="text-[10px] text-slate-500 font-medium">{asesor.cargo || 'Asesor UATP'}</p>
                          </div>
                        </div>

                        {esActivo && (
                          <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                            Activo
                          </span>
                        )}
                      </div>

                      <div className="mt-3 space-y-1 text-[11px] text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span className="truncate">{asesor.email}</span>
                        </div>
                        {asesor.telefono && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{asesor.telefono}</span>
                          </div>
                        )}
                      </div>

                      {/* Comunas preferentes */}
                      {asesor.comunasPreferentes && asesor.comunasPreferentes.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {asesor.comunasPreferentes.map(c => (
                            <span key={c} className="text-[9px] bg-white border border-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-semibold">
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-2">
                      <button
                        onClick={() => abrirModalEditarAsesor(asesor)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-bold rounded-lg transition-colors border border-indigo-200/60"
                        title="Gestionar y asignar colegios a este asesor"
                      >
                        <Building2 className="w-3.5 h-3.5" />
                        <span>Gestionar Colegios ({colegiosAsignados.length})</span>
                      </button>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => abrirModalEditarAsesor(asesor)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors"
                          title="Editar Asesor"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleEliminarAsesor(asesor.id, asesor.nombre)}
                          disabled={config.asesoresRegistrados.length <= 1}
                          className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-white rounded-lg transition-colors disabled:opacity-30"
                          title="Eliminar Asesor"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* 2. PESTAÑA NORMATIVA & MOTOR MINEDUC */}
      {tabActiva === 'normativa' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              Parámetros del Motor de Cálculo & Normativa Educacional
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Configura los umbrales de la Ley 20.903, Decreto 170 PIE, Decreto 548 y reglas de asignación territorial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            
            {/* Umbral Prioritarios 60/40 */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Umbral Prioritarios Ley 20.903 (Régimen 60/40)
                </label>
                <span className="text-xs font-black text-purple-700 bg-purple-100 px-2 py-0.5 rounded-lg">
                  {config.parametrosMineduc.umbralPrioritarios60_40}%
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Establecimientos con porcentaje de alumnos prioritarios mayor o igual a este umbral aplican automáticamente 60% lectivo y 40% no lectivo.
              </p>
              <input
                type="range"
                min="50"
                max="90"
                step="5"
                value={config.parametrosMineduc.umbralPrioritarios60_40}
                onChange={(e) => handleNormativaChange('umbralPrioritarios60_40', Number(e.target.value))}
                className="w-full cursor-pointer accent-purple-600"
              />
            </div>

            {/* Tope Horas Semanales SLEP */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Tope Máximo Horario Territorial (DFL 1 / Ley 20.903)
                </label>
                <span className="text-xs font-black text-blue-700 bg-blue-100 px-2 py-0.5 rounded-lg">
                  {config.parametrosMineduc.topeHorasDocenteSlep} hrs/semana
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Límite legal estricto de horas de contrato que un docente puede acumular en todo el territorio del SLEP Valle Diguillín.
              </p>
              <input
                type="number"
                min="30"
                max="48"
                value={config.parametrosMineduc.topeHorasDocenteSlep}
                onChange={(e) => handleNormativaChange('topeHorasDocenteSlep', Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
              />
            </div>

            {/* Duración Hora Pedagógica */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Duración Hora Pedagógica Oficial
                </label>
                <span className="text-xs font-black text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-lg">
                  {config.parametrosMineduc.duracionHoraPedagogicaMin} min (0.75h)
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Equivalencia cronológica de cada bloque pedagógico para conversión de matrices lectivas.
              </p>
              <input
                type="number"
                min="40"
                max="60"
                value={config.parametrosMineduc.duracionHoraPedagogicaMin}
                onChange={(e) => handleNormativaChange('duracionHoraPedagogicaMin', Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
              />
            </div>

            {/* Horas PIE Base por Curso */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">
                  Horas PIE Docente Base por Curso con NEET (Decreto 170)
                </label>
                <span className="text-xs font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">
                  {config.parametrosMineduc.horasPieDocenteBasePorCurso} hrs cronológicas
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Horas cronológicas mínimas de apoyo en aula común y co-docencia por curso integrado.
              </p>
              <input
                type="number"
                min="1"
                max="10"
                value={config.parametrosMineduc.horasPieDocenteBasePorCurso}
                onChange={(e) => handleNormativaChange('horasPieDocenteBasePorCurso', Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800"
              />
            </div>

          </div>

          {/* Validaciones Estrictas */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Políticas de Validación y Auditoría
            </h4>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={config.parametrosMineduc.validacionesEstrictas}
                onChange={(e) => handleNormativaChange('validacionesEstrictas', e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Validaciones Estrictas de Sobreasignación</span>
                <span className="text-[11px] text-slate-500">
                  Generar alertas automáticas cuando un docente supere el límite de horas aula según proporción 65/35 o 60/40.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={config.parametrosMineduc.restringirFinanciamientoSepPieEnPlanComun}
                onChange={(e) => handleNormativaChange('restringirFinanciamientoSepPieEnPlanComun', e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">
                  Restricción Financiera SEP / PIE en Plan de Estudio Regular
                </span>
                <span className="text-[11px] text-slate-500">
                  Advertir cuando horas de asignaturas obligatorias del plan común sean cargadas improcedentemente a fondos SEP o PIE.
                </span>
              </div>
            </label>
          </div>

        </div>
      )}

      {/* 3. PESTAÑA GEMINI IA & COPILOT */}
      {tabActiva === 'ia' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Configuración de Inteligencia Artificial (Google Gemini & Copilot)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Habilita auditorías autónomas, respuestas normativas instantáneas y sugerencias de optimización horaria.
            </p>
          </div>

          <div className="space-y-4 pt-2">
            
            {/* API Key */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-orange-500" />
                Google Gemini API Key
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  placeholder="AIzaSy..."
                  value={config.gemini.apiKey}
                  onChange={(e) => handleGeminiChange('apiKey', e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-900 focus:bg-white focus:ring-2 focus:ring-orange-500"
                />
                <button
                  onClick={handleProbarGeminiApi}
                  disabled={probandoGemini}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${probandoGemini ? 'animate-spin' : ''}`} />
                  <span>{probandoGemini ? 'Probando...' : 'Probar Conexión'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Obtén tu API key gratuita en <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google AI Studio</a>.
              </p>
            </div>

            {/* Resultado de Test de Gemini */}
            {resultadoTestGemini && (
              <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                resultadoTestGemini.exito ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
              }`}>
                {resultadoTestGemini.exito ? <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
                <span>{resultadoTestGemini.mensaje}</span>
              </div>
            )}

            {/* Selector de Modelo */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Modelo de Lenguaje (LLM)
                </label>
                <select
                  value={config.gemini.model}
                  onChange={(e) => handleGeminiChange('model', e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-orange-500 cursor-pointer"
                >
                  <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash (Ultrarrápido y Recomendado)</option>
                  <option value="gemini-1.5-pro">🧠 Gemini 1.5 Pro (Máximo Razonamiento Normativo)</option>
                  <option value="gemini-1.5-flash">⚡ Gemini 1.5 Flash (Ligero)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Temperatura ({config.gemini.temperatura})
                </label>
                <input
                  type="range"
                  min="0.0"
                  max="1.0"
                  step="0.1"
                  value={config.gemini.temperatura}
                  onChange={(e) => handleGeminiChange('temperatura', Number(e.target.value))}
                  className="w-full cursor-pointer accent-orange-500 mt-2"
                />
                <div className="flex justify-between text-[10px] text-slate-400 mt-1 font-semibold">
                  <span>0.0 (Preciso / Normativo)</span>
                  <span>1.0 (Creativo)</span>
                </div>
              </div>
            </div>

            {/* Opciones Adicionales de IA */}
            <div className="pt-3 space-y-3">
              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.gemini.analizarTodosAlExportar}
                  onChange={(e) => handleGeminiChange('analizarTodosAlExportar', e.target.checked)}
                  className="mt-0.5 rounded text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Análisis Automático con IA al Exportar Matriz Oficial Excel
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Incluir dictamen y resumen normativo generado por Gemini en la pestaña de observaciones de la planilla Excel.
                  </span>
                </div>
              </label>

              <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.gemini.modoEstrictoCopilot}
                  onChange={(e) => handleGeminiChange('modoEstrictoCopilot', e.target.checked)}
                  className="mt-0.5 rounded text-orange-500 focus:ring-orange-500"
                />
                <div>
                  <span className="text-xs font-bold text-slate-900 block">
                    Modo Normativo Estricto en Copilot "¡Qué no va a saber!"
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Citar artículos legales exactos (DFL 1, Ley 20.903, Ley 21.040, Dto 170, Dto 548) en cada recomendación.
                  </span>
                </div>
              </label>
            </div>

          </div>
        </div>
      )}

      {/* 4. PESTAÑA INTERFAZ & VISUALIZACIÓN */}
      {tabActiva === 'ui' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Sliders className="w-5 h-5 text-purple-600" />
              Preferencias de Interfaz & Visualización
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Personaliza el módulo inicial, la densidad de las tablas y el periodo de trabajo por defecto.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            
            {/* Periodo Predeterminado */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Periodo Escolar Inicial
              </label>
              <select
                value={config.ui.periodoPredeterminado}
                onChange={(e) => handleUiChange('periodoPredeterminado', Number(e.target.value) as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value={2026}>Dotación 2026 (Actual)</option>
                <option value={2027}>Proyección 2027</option>
              </select>
            </div>

            {/* Vista Inicial */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Módulo Inicial al Abrir la App
              </label>
              <select
                value={config.ui.vistaInicial}
                onChange={(e) => handleUiChange('vistaInicial', e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="colegios_asesorados">👤 Colegios Asesorados (Recomendado)</option>
                <option value="cartera">🏢 Cartera Territorial Completa</option>
                <option value="workflow">📋 Espacio de Trabajo Escolar</option>
                <option value="consolidador">📊 Consolidado Territorial</option>
                <option value="estadisticas">📈 Estadísticas y Cuadraturas</option>
                <option value="analizador">✨ Analizador de Nóminas</option>
              </select>
            </div>

            {/* Densidad de Tablas */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <label className="text-xs font-bold text-slate-800 block">
                Densidad de Tablas y Listados
              </label>
              <select
                value={config.ui.densidadTablas}
                onChange={(e) => handleUiChange('densidadTablas', e.target.value as any)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800"
              >
                <option value="comoda">Cómoda (Mayor Espaciado y Legibilidad)</option>
                <option value="compacta">Compacta (Máxima Densidad de Datos)</option>
              </select>
            </div>

          </div>

          {/* Opciones Visuales */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={config.ui.mostrarAlertasFlotantes}
                onChange={(e) => handleUiChange('mostrarAlertasFlotantes', e.target.checked)}
                className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Notificaciones Toasts de Guardado</span>
                <span className="text-[11px] text-slate-500">
                  Mostrar avisos flotantes de confirmación al realizar operaciones exitosas.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <input
                type="checkbox"
                checked={config.ui.animacionesHabilitadas}
                onChange={(e) => handleUiChange('animacionesHabilitadas', e.target.checked)}
                className="mt-0.5 rounded text-purple-600 focus:ring-purple-500"
              />
              <div>
                <span className="text-xs font-bold text-slate-900 block">Micro-animaciones Suaves</span>
                <span className="text-[11px] text-slate-500">
                  Habilitar transiciones fluidas de apertura de modales y tarjetas.
                </span>
              </div>
            </label>
          </div>

        </div>
      )}

      {/* 5. PESTAÑA BASE DE DATOS & RESPALDOS */}
      {tabActiva === 'db' && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-6">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Database className="w-5 h-5 text-slate-700" />
              Mantenimiento, Respaldos & Catálogo Territorial
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Descarga copias maestras en formato SQLite (.sqlite) y Cartera SLEP (.slep), o sincroniza el catálogo oficial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            
            {/* Tarjeta SQLite */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="w-5 h-5 text-blue-600" />
                <h4 className="font-bold text-slate-900 text-xs">Base de Datos SQLite (.sqlite)</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Archivo binario que contiene todas las tablas, docentes, cursos, asignaciones y auditorías territoriales.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={onExportarSqlite}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Exportar BD SQLite</span>
                </button>
                <label className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                  <Database className="w-3.5 h-3.5" />
                  <span>Restaurar BD SQLite</span>
                  <input
                    type="file"
                    accept=".sqlite,.db"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportarSqlite(f);
                    }}
                  />
                </label>
              </div>
            </div>

            {/* Tarjeta Cartera SLEP */}
            <div className="p-5 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-emerald-600" />
                <h4 className="font-bold text-slate-900 text-xs">Cartera Territorial Interoperable (.slep)</h4>
              </div>
              <p className="text-[11px] text-slate-500">
                Paquete de datos estructurado JSON con metadatos del asesor para intercambio entre computadores.
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={onExportarCarteraSlep}
                  className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Exportar Cartera .slep</span>
                </button>
                <label className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Importar Cartera .slep</span>
                  <input
                    type="file"
                    accept=".slep,.json"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onImportarCarteraSlep(f);
                    }}
                  />
                </label>
              </div>
            </div>

          </div>

          {/* Sincronización y Restablecimiento */}
          <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={handleResincronizarCatalogo}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-sincronizar Catálogo Oficial (121 Escuelas)</span>
            </button>

            <button
              onClick={handleRestablecerFabrica}
              className="flex items-center gap-1.5 px-4 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl transition-colors border border-red-200"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Restablecer Todo a Valores de Fábrica</span>
            </button>
          </div>

        </div>
      )}

      {/* Modal Agregar / Editar Asesor UATP con Asignación de Colegios (RBDs) */}
      {modalAsesorAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full p-6 animate-in zoom-in-95 duration-200 space-y-4 my-8">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {asesorEnEdicion ? `Editar Asesor: ${asesorEnEdicion.nombre}` : 'Registrar Nuevo Asesor UATP'}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Configura los datos del asesor y asigna directamente los establecimientos (RBDs) de su cartera.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAsesorAbierto(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold p-1 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGuardarModalAsesor} className="space-y-4">
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* COLUMNA IZQUIERDA: DATOS PERSONALES DEL ASESOR (5 cols) */}
                <div className="lg:col-span-5 space-y-3 pr-0 lg:pr-2 border-b lg:border-b-0 lg:border-r border-slate-200/80 pb-4 lg:pb-0">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Datos del Asesor UATP</span>
                  </h4>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nombre Completo *</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Carolina Henríquez Soto"
                      value={formNombreAsesor}
                      onChange={(e) => setFormNombreAsesor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Correo Institucional *</label>
                    <input
                      type="email"
                      required
                      placeholder="carolina.henriquez@slepvallediguillin.cl"
                      value={formEmailAsesor}
                      onChange={(e) => setFormEmailAsesor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Teléfono</label>
                    <input
                      type="text"
                      placeholder="+56 9 8765 4321"
                      value={formTelefonoAsesor}
                      onChange={(e) => setFormTelefonoAsesor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Cargo Institucional</label>
                    <input
                      type="text"
                      placeholder="Asesor Técnico Pedagógico UATP"
                      value={formCargoAsesor}
                      onChange={(e) => setFormCargoAsesor(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Color Distintivo Badge</label>
                    <div className="flex items-center gap-2">
                      {['#2563eb', '#7c3aed', '#059669', '#ea580c', '#db2777', '#0891b2', '#475569'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFormColorBadge(c)}
                          className={`w-6 h-6 rounded-full transition-transform ${formColorBadge === c ? 'scale-125 ring-2 ring-offset-2 ring-slate-800 shadow-md' : 'opacity-70 hover:opacity-100'}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Comunas de Referencia</label>
                    <div className="grid grid-cols-2 gap-1.5 p-2 bg-slate-50 rounded-xl border border-slate-200 max-h-28 overflow-y-auto">
                      {COMUNAS_DISPONIBLES.map((c) => {
                        const checked = formComunasAsesor.includes(c);
                        return (
                          <label key={c} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setFormComunasAsesor(prev =>
                                  prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                                );
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                            <span>{c}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA: ASIGNACIÓN DE COLEGIOS INDIVIDUALES (RBDs) (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                        <Building2 className="w-4 h-4 text-indigo-600" />
                        <span>Cartera de Colegios Asignados ({formColegiosAsignados.length})</span>
                      </h4>
                      <p className="text-[10px] text-slate-500">
                        Marca los colegios que asesorará. Los asesores gestionan colegios específicos, no comunas completas.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const visibles = colegiosFiltradosModal.map(c => c.rbd);
                          const todosSeleccionados = visibles.every(r => formColegiosAsignados.includes(r));
                          if (todosSeleccionados) {
                            setFormColegiosAsignados(prev => prev.filter(r => !visibles.includes(r)));
                          } else {
                            setFormColegiosAsignados(prev => Array.from(new Set([...prev, ...visibles])));
                          }
                        }}
                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
                      >
                        {colegiosFiltradosModal.every(c => formColegiosAsignados.includes(c.rbd))
                          ? 'Deseleccionar visibles'
                          : `Marcar visibles (${colegiosFiltradosModal.length})`}
                      </button>
                      {formColegiosAsignados.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setFormColegiosAsignados([])}
                          className="text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-lg transition-colors"
                        >
                          Limpiar
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Filtro y Buscador de Colegios */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar por RBD o nombre..."
                        value={busquedaColegioModal}
                        onChange={(e) => setBusquedaColegioModal(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <select
                      value={filtroComunaModal}
                      onChange={(e) => setFiltroComunaModal(e.target.value)}
                      className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="ALL">Todas las Comunas</option>
                      {COMUNAS_DISPONIBLES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  {/* Lista con Checkboxes de los 121 Establecimientos */}
                  <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl p-2 bg-slate-50/50 space-y-1">
                    {colegiosFiltradosModal.length === 0 ? (
                      <p className="text-xs text-center text-slate-400 py-6">
                        No se encontraron establecimientos con ese filtro.
                      </p>
                    ) : (
                      colegiosFiltradosModal.map((est) => {
                        const checked = formColegiosAsignados.includes(est.rbd);
                        const asesorActual = (est.asesorUatp || '').trim();
                        const esDeOtro = asesorActual && asesorActual.toLowerCase() !== formNombreAsesor.trim().toLowerCase();

                        return (
                          <label
                            key={est.rbd}
                            className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-xs ${
                              checked
                                ? 'bg-indigo-50/80 border-indigo-300 ring-1 ring-indigo-400/40'
                                : 'bg-white border-slate-200/80 hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0 pr-2">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleColegioEnModal(est.rbd)}
                                className="rounded text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-700 px-1.5 py-0.2 rounded border border-slate-200">
                                    RBD {est.rbd}
                                  </span>
                                  <span className="text-[10px] font-bold text-slate-500">
                                    • {est.comuna}
                                  </span>
                                </div>
                                <div className="font-bold text-slate-900 truncate mt-0.5" title={est.nombre}>
                                  {est.nombre}
                                </div>
                              </div>
                            </div>

                            <div className="flex-shrink-0 text-right">
                              {checked ? (
                                <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Asignado
                                </span>
                              ) : esDeOtro ? (
                                <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[9px] font-semibold px-1.5 py-0.5 rounded truncate max-w-[110px] inline-block" title={`Asignado a ${asesorActual}`}>
                                  {asesorActual}
                                </span>
                              ) : (
                                <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                  Disponible
                                </span>
                              )}
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 flex items-center justify-between px-1">
                    <span>Total en sistema: {colegios.length} escuelas</span>
                    <span className="font-bold text-indigo-700">
                      {formColegiosAsignados.length} en la cartera de {formNombreAsesor || 'este asesor'}
                    </span>
                  </div>

                </div>

              </div>

              {/* Botones Pie de Modal */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setModalAsesorAbierto(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoAsesor || !formNombreAsesor.trim()}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>
                    {guardandoAsesor
                      ? 'Guardando...'
                      : asesorEnEdicion
                      ? `Guardar Cambios (${formColegiosAsignados.length} colegios)`
                      : `Crear Asesor (${formColegiosAsignados.length} colegios)`}
                  </span>
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
