import React, { useState, useRef, useEffect } from 'react';
import {
  Building2, FileSpreadsheet, Layers, ClipboardCheck, ChevronDown,
  SlidersHorizontal, FileUp, PieChart, BookOpen, Users, Scale, LayoutGrid,
  Database, Search, Sparkles, BarChart3, CheckCircle2, CloudUpload, RefreshCw,
  UserCheck, Settings, Moon, Sun, Leaf, Eye, Menu, X, Globe,
  LogOut, ShieldAlert, KeyRound, Loader2, CloudOff, Cloud
} from 'lucide-react';
import { Establecimiento } from '../types';
import { AuthSession } from '../types/authTypes';
import { AuthService } from '../services/authService';
import { subscribePersist, getUltimaHoraGuardado } from '../database/db';

interface HeaderProps {
  session?: AuthSession | null;
  onLogout?: () => void;
  onAbrirCambiarPassword?: () => void;
  colegioActivo: Establecimiento | null;
  colegios: Establecimiento[];
  onSelectColegio: (est: Establecimiento) => void;
  vistaActiva: string;
  onSelectVista: (v: string) => void;
  onExportarExcel: () => void;
  inconsistenciasCount: number;
  onAbrirNavegadorColegios: () => void;
  onAbrirCentroRespaldos: () => void;
  estadoGuardado?: 'saved' | 'error';
  ultimaHoraGuardado?: string;
  periodoActivo: number;
  onTogglePeriodo: (p: number) => void;
  onAbrirComparadorPeriodos?: () => void;
  onAbrirTraspasoPeriodos?: () => void;
  onAbrirImportadorMatriz?: () => void;
  onAbrirCopilot?: () => void;
  onAbrirConfiguraciones?: () => void;
  onAbrirGestionEstablecimientos?: () => void;
  onGuardarCambiosEnNube?: (apartado?: any) => Promise<void>;
  guardandoEnNube?: boolean;
  onRefrescarNube?: (apartado?: any) => Promise<void>;
  sincronizandoNube?: boolean;
  estadoSincronizacionNube?: 'synced' | 'checking' | 'saving' | 'updated_remotely' | 'offline' | 'error';
  ultimaSincronizacionNube?: string;
}

export const Header: React.FC<HeaderProps> = ({
  session,
  onLogout,
  onAbrirCambiarPassword,
  colegioActivo,
  vistaActiva,
  onSelectVista,
  onExportarExcel,
  inconsistenciasCount,
  onAbrirNavegadorColegios,
  onAbrirCentroRespaldos,
  periodoActivo,
  onAbrirTraspasoPeriodos,
  onAbrirCopilot,
  onAbrirConfiguraciones,
  onAbrirGestionEstablecimientos,
  onGuardarCambiosEnNube,
  guardandoEnNube = false,
  onRefrescarNube,
  sincronizandoNube = false,
  estadoSincronizacionNube = 'synced',
  ultimaSincronizacionNube = ''
}) => {
  const permisos = session ? AuthService.getPermisos(session.usuario.role) : null;
  const [toolsOpen, setToolsOpen] = useState(false);
  const [cloudOpen, setCloudOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('slep_ui_theme') || 'slep-republicano';
  });
  const [densityMode, setDensityMode] = useState<'comfortable' | 'compact'>(() => {
    const saved = localStorage.getItem('slep_ui_density');
    if (saved === 'compact' || saved === 'comfortable') return saved;
    if (typeof window !== 'undefined' && (window.innerWidth <= 1540 || window.innerHeight <= 864)) {
      return 'compact';
    }
    return 'comfortable';
  });
  const [internalEstadoGuardado, setInternalEstadoGuardado] = useState<'saved' | 'error'>('saved');

  const toolsRef = useRef<HTMLDivElement>(null);
  const cloudRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('slep_ui_theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-density', densityMode);
    localStorage.setItem('slep_ui_density', densityMode);
  }, [densityMode]);

  useEffect(() => {
    const unsub = subscribePersist((status) => {
      setInternalEstadoGuardado(status);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (toolsRef.current && !toolsRef.current.contains(target)) setToolsOpen(false);
      if (cloudRef.current && !cloudRef.current.contains(target)) setCloudOpen(false);
      if (accountRef.current && !accountRef.current.contains(target)) setAccountOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const temasDisponibles = [
    { id: 'slep-republicano', label: 'SLEP Claro', icon: Sun, dot: '#007AFF' },
    { id: 'executive-dark', label: 'Oscuro', icon: Moon, dot: '#0A84FF' },
    { id: 'warm-earth', label: 'Tierra', icon: Globe, dot: '#9C5722' },
    { id: 'emerald-nordic', label: 'Esmeralda', icon: Leaf, dot: '#059669' },
    { id: 'high-contrast', label: 'Alto Contraste', icon: Eye, dot: '#0040C7' },
  ];

  const modulosDetallados = [
    { id: 'planes_estudio', label: 'Catálogo de Planes & EPJA 2024', icon: BookOpen, desc: 'Matrices MINEDUC y Dto. 10/2022' },
    { id: 'sige', label: 'Ingesta SIGE (MINEDUC)', icon: FileUp, desc: 'Carga de nóminas oficiales' },
    { id: 'pie', label: 'Auditoría PIE (Dec. 170)', icon: PieChart, desc: 'Cuadre horas diferencial y PAE' },
    { id: 'salas_sae', label: 'Salas & Cupos SAE (Dec. 548)', icon: LayoutGrid, desc: 'Aforos y desdoblamientos' },
    { id: 'curriculum', label: 'Planes Curriculares MINEDUC', icon: BookOpen, desc: 'Matrices de estudio por curso' },
    { id: 'docentes', label: 'Docentes & Ley 20.903', icon: Users, desc: 'Control 65/35 y sobreasignación' },
    { id: 'asistentes', label: 'Asistentes de la Educación', icon: Users, desc: 'Ley 21.109, Duplas SEP y PIE' },
    { id: 'balanza', label: 'Balanza & Diagnóstico', icon: Scale, desc: 'Superávit y déficit horario' },
  ];

  const esModuloSecundario = modulosDetallados.some(m => m.id === vistaActiva);

  const navPillClass = (id: string) =>
    `flex items-center gap-1.5 px-2.5 2xl:px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
      vistaActiva === id
        ? 'bg-brand-primary text-white shadow-sm'
        : 'text-slate-200 hover:bg-white/10 hover:text-white'
    }`;

  const inicialesUsuario = (session?.usuario.nombreCompleto || 'US')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(p => p[0]?.toUpperCase() || '')
    .join('');

  const esCloudBusy = guardandoEnNube || sincronizandoNube || estadoSincronizacionNube === 'saving' || estadoSincronizacionNube === 'checking';

  return (
    <header
      className="text-white border-b shadow-sm sticky top-0 z-40 backdrop-blur-md transition-colors duration-200"
      style={{ backgroundColor: 'var(--header-bg, #0F172A)', borderColor: 'var(--header-border, #334155)' }}
    >
      <div className="max-w-[1920px] mx-auto px-3 sm:px-5 lg:px-6">
        <div className="flex items-center justify-between h-12 sm:h-14 gap-2">

          {/* ── 1. IZQUIERDA: Branding + Selector de Escuela Activa ── */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => onSelectVista('colegios_asesorados')}
              className="flex items-center gap-2 cursor-pointer select-none group shrink-0 text-left"
              title="Ir al Dashboard Principal"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center font-black text-xs shadow-sm group-hover:scale-105 transition-transform text-white">
                VD
              </div>
              <div className="hidden 2xl:block leading-tight">
                <div className="text-[9px] uppercase tracking-wider text-amber-400 font-extrabold">
                  SLEP Valle Diguillín
                </div>
                <div className="text-xs font-black text-white tracking-tight">
                  Dotación {periodoActivo}
                </div>
              </div>
            </button>

            <span className="hidden sm:inline text-white/15">|</span>

            {(!permisos || permisos.puedeAccederTodasEscuelas) ? (
              <button
                type="button"
                onClick={onAbrirNavegadorColegios}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-xl border border-white/15 text-xs font-semibold text-white transition-all max-w-[170px] sm:max-w-[230px]"
                title="Cambiar escuela (⌘K / Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">
                  {colegioActivo ? colegioActivo.nombre : 'Seleccionar escuela'}
                </span>
                <kbd className="hidden xl:inline text-[9px] bg-black/30 px-1 py-0.2 rounded text-slate-300 font-mono shrink-0">
                  ⌘K
                </kbd>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-blue-950/60 px-2.5 py-1 rounded-xl border border-blue-500/30 text-xs font-bold text-blue-100 max-w-[210px]">
                <Building2 className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{colegioActivo ? colegioActivo.nombre : 'Colegio Asignado'}</span>
              </div>
            )}
          </div>

          {/* ── 2. CENTRO: Navegación Principal (5 destinos esenciales) ── */}
          <nav className="hidden lg:flex items-center bg-black/30 p-1 rounded-xl border border-white/10 space-x-0.5 overflow-x-auto no-scrollbar">
            {(!permisos || permisos.puedeAccederTodasEscuelas) && (
              <button
                onClick={() => onSelectVista('colegios_asesorados')}
                className={navPillClass('colegios_asesorados')}
                title="Dashboard Principal de Escuelas"
              >
                <UserCheck className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Dashboard</span>
              </button>
            )}

            {(!permisos || permisos.puedeAccederTodasEscuelas) && (
              <button onClick={() => onSelectVista('workflow')} className={navPillClass('workflow')}>
                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Espacio Escolar</span>
              </button>
            )}

            {(!permisos || permisos.puedeVerConsolidadorMaster) && (
              <button onClick={() => onSelectVista('consolidador')} className={`${navPillClass('consolidador')} relative`}>
                <Layers className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Consolidado</span>
                {inconsistenciasCount > 0 && (
                  <span className="bg-rose-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black ml-0.5 tabular-nums">
                    {inconsistenciasCount}
                  </span>
                )}
              </button>
            )}

            {(!permisos || permisos.puedeAccederTodasEscuelas) && (
              <button onClick={() => onSelectVista('estadisticas')} className={navPillClass('estadisticas')}>
                <BarChart3 className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>Estadísticas</span>
              </button>
            )}

            {(!permisos || permisos.puedeVerAnalizadorSige) && (
              <button
                onClick={() => onSelectVista('analizador')}
                className={`flex items-center gap-1.5 px-2.5 2xl:px-3 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  vistaActiva === 'analizador'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 shrink-0" />
                <span>Analizador</span>
              </button>
            )}

            {permisos && !permisos.puedeAccederTodasEscuelas && (
              <div className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs font-black bg-blue-600/25 text-blue-200 border border-blue-500/30">
                <ClipboardCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Propuesta Dotación {periodoActivo}</span>
              </div>
            )}
          </nav>

          {/* ── 3. DERECHA: 4 Controles Limpios (Cloud Unificado + IA + Módulos + Cuenta) ── */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* 3.1. Centro Cloud Unificado (Único punto de Guardado & Sincronización) */}
            {(colegioActivo || onGuardarCambiosEnNube || onRefrescarNube) && (
              <div className="relative" ref={cloudRef}>
                <button
                  type="button"
                  onClick={() => setCloudOpen(!cloudOpen)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                    estadoSincronizacionNube === 'error'
                      ? 'bg-rose-500/15 border-rose-400/40 text-rose-200'
                      : estadoSincronizacionNube === 'offline'
                      ? 'bg-slate-800/80 border-slate-600 text-slate-300'
                      : esCloudBusy
                      ? 'bg-sky-500/20 border-sky-400/40 text-sky-200'
                      : estadoSincronizacionNube === 'updated_remotely'
                      ? 'bg-sky-500/20 border-sky-400 text-sky-100'
                      : 'bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-400/30 text-emerald-200'
                  }`}
                  title="Estado de nube: Guardar o sincronizar cambios del colegio activo"
                >
                  {esCloudBusy ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-sky-300 shrink-0" />
                  ) : estadoSincronizacionNube === 'offline' ? (
                    <CloudOff className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <Cloud className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  )}
                  <span className="hidden sm:inline">
                    {guardandoEnNube
                      ? 'Guardando...'
                      : sincronizandoNube
                      ? 'Sincronizando...'
                      : estadoSincronizacionNube === 'offline'
                      ? 'Local'
                      : estadoSincronizacionNube === 'error'
                      ? 'Error Nube'
                      : 'Nube'}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-70" />
                </button>

                {cloudOpen && (
                  <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 z-50 space-y-2.5 animate-fade-in">
                    <div className="flex items-start justify-between gap-2 pb-2 border-b border-slate-800">
                      <div className="min-w-0">
                        <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">
                          Sincronización Supabase
                        </div>
                        <div className="text-xs font-bold text-white truncate mt-0.5">
                          {colegioActivo ? colegioActivo.nombre : 'Sin colegio seleccionado'}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">
                          {ultimaSincronizacionNube
                            ? `Última verificación: ${ultimaSincronizacionNube}`
                            : internalEstadoGuardado === 'saved'
                            ? 'SQLite local guardado'
                            : 'Error en respaldo local'}
                        </div>
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                        estadoSincronizacionNube === 'offline'
                          ? 'bg-slate-800 text-slate-300'
                          : estadoSincronizacionNube === 'error'
                          ? 'bg-rose-500/20 text-rose-300'
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {estadoSincronizacionNube === 'offline' ? 'Local' : estadoSincronizacionNube === 'error' ? 'Error' : 'Al día'}
                      </span>
                    </div>

                    {onGuardarCambiosEnNube && (
                      <button
                        type="button"
                        onClick={async () => {
                          setCloudOpen(false);
                          await onGuardarCambiosEnNube();
                        }}
                        disabled={guardandoEnNube || !colegioActivo}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-sm transition-all"
                      >
                        {guardandoEnNube ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CloudUpload className="w-3.5 h-3.5" />}
                        <span>Guardar cambios en la nube</span>
                      </button>
                    )}

                    {onRefrescarNube && (
                      <button
                        type="button"
                        onClick={async () => {
                          setCloudOpen(false);
                          await onRefrescarNube();
                        }}
                        disabled={sincronizandoNube || guardandoEnNube || !colegioActivo}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-sky-200 border border-slate-700 transition-all"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoNube ? 'animate-spin' : ''}`} />
                        <span>Traer última versión desde nube</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 3.2. Asistente IA Copilot */}
            {onAbrirCopilot && (!permisos || permisos.puedeUsarCopilotIa) && (
              <button
                onClick={onAbrirCopilot}
                className="hidden sm:flex items-center gap-1.5 bg-blue-600/80 hover:bg-blue-600 text-white px-2.5 py-1.5 rounded-xl text-xs font-black transition-all border border-blue-400/30"
                title="Abrir asistente IA ¡Qué no va a saber! (⌘J / Ctrl+J)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden xl:inline">IA</span>
                <kbd className="hidden 2xl:inline text-[9px] bg-black/30 px-1 rounded text-blue-100 font-mono">⌘J</kbd>
              </button>
            )}

            {/* 3.3. Menú Módulos Técnicos & Reporte Global */}
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  esModuloSecundario
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-white/10 border-white/15 text-white hover:bg-white/15'
                }`}
                title="Módulos técnicos y exportación consolidada"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline">Módulos</span>
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800 animate-fade-in">
                  <div className="p-2 space-y-1">

                    <button
                      onClick={() => { onExportarExcel(); setToolsOpen(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Descargar Excel Consolidado</span>
                    </button>
                  </div>

                  <div className="p-2 space-y-0.5 max-h-[60vh] overflow-y-auto">
                    <div className="px-3 py-1 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                      Módulos Técnicos & Ley 20.903
                    </div>
                    {modulosDetallados.map(item => {
                      const Icon = item.icon;
                      const active = vistaActiva === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => { onSelectVista(item.id); setToolsOpen(false); }}
                          className={`w-full flex items-start px-3 py-1.5 rounded-xl text-left hover:bg-slate-800 transition-colors ${
                            active ? 'bg-blue-900/60 text-white' : 'text-slate-200'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mr-2.5 mt-0.5 shrink-0 ${active ? 'text-blue-400' : 'text-amber-400'}`} />
                          <div>
                            <div className="text-xs font-bold text-white">{item.label}</div>
                            <div className="text-[10px] text-slate-400">{item.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3.4. Menú Unificado de Cuenta, Apariencia y Administración */}
            <div className="relative" ref={accountRef}>
              <button
                type="button"
                onClick={() => setAccountOpen(!accountOpen)}
                className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 transition-all"
                title={session ? `${session.usuario.nombreCompleto} (${session.usuario.role.replace('_', ' ')})` : 'Cuenta y Preferencias'}
              >
                <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-black text-white">
                  {inicialesUsuario}
                </span>
                <span className="hidden xl:inline text-xs font-bold text-white max-w-[100px] truncate">
                  {session?.usuario.nombreCompleto.split(' ')[0] || 'Cuenta'}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-300" />
              </button>

              {accountOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800 animate-fade-in">
                  {session && (
                    <div className="px-3.5 py-2">
                      <div className="text-xs font-bold text-white truncate">{session.usuario.nombreCompleto}</div>
                      <div className="text-[10px] font-mono uppercase tracking-wider text-amber-300 mt-0.5">
                        {session.usuario.role.replace(/_/g, ' ')}
                      </div>
                    </div>
                  )}

                  {/* Densidad & Tema Rápido */}
                  <div className="p-2.5 space-y-2">
                    <div className="flex items-center justify-between text-[10px] uppercase font-black text-slate-400 tracking-wider px-1">
                      <span>Densidad</span>
                      <div className="inline-flex rounded-lg bg-slate-800 p-0.5 border border-slate-700">
                        <button
                          type="button"
                          onClick={() => setDensityMode('compact')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                            densityMode === 'compact' ? 'bg-amber-500 text-white' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Compacta
                        </button>
                        <button
                          type="button"
                          onClick={() => setDensityMode('comfortable')}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all ${
                            densityMode === 'comfortable' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Cómoda
                        </button>
                      </div>
                    </div>

                    <div className="px-1">
                      <div className="text-[10px] uppercase font-black text-slate-400 tracking-wider mb-1.5">
                        Tema Visual
                      </div>
                      <div className="flex items-center justify-between gap-1">
                        {temasDisponibles.map(t => {
                          const active = currentTheme === t.id;
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => setCurrentTheme(t.id)}
                              title={t.label}
                              className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center transition-all ${
                                active
                                  ? 'border-white bg-slate-800 ring-1 ring-white/40'
                                  : 'border-slate-700/70 bg-slate-800/40 hover:bg-slate-800'
                              }`}
                            >
                              <span className="w-3.5 h-3.5 rounded-full ring-1 ring-white/30" style={{ background: t.dot }} />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Administración & Herramientas */}
                  <div className="p-2 space-y-0.5">
                    {onAbrirConfiguraciones && (!permisos || permisos.puedeConfigurarSistema) && (
                      <button
                        onClick={() => { onAbrirConfiguraciones(); setAccountOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold transition-colors ${
                          vistaActiva === 'configuraciones' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-200 hover:bg-slate-800'
                        }`}
                      >
                        <Settings className="w-4 h-4 text-amber-400" />
                        <span>Configuraciones Generales</span>
                      </button>
                    )}

                    {onAbrirGestionEstablecimientos && session?.usuario.role === 'super_usuario' && (
                      <button
                        onClick={() => { onAbrirGestionEstablecimientos(); setAccountOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-950/60 transition-colors"
                      >
                        <ShieldAlert className="w-4 h-4 text-rose-400" />
                        <span>Gestión de Establecimientos</span>
                      </button>
                    )}

                    {(!permisos || permisos.puedeConfigurarSistema) && (
                      <button
                        onClick={() => { onAbrirCentroRespaldos(); setAccountOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-emerald-400" />
                          <span>Respaldos SQLite</span>
                        </div>
                        <span className={`text-[10px] font-mono ${internalEstadoGuardado === 'saved' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {internalEstadoGuardado === 'saved' ? 'OK' : 'Error'}
                        </span>
                      </button>
                    )}

                    {onAbrirTraspasoPeriodos && (!permisos || permisos.puedeTraspasarPeriodos) && (
                      <button
                        onClick={() => { onAbrirTraspasoPeriodos(); setAccountOpen(false); }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-indigo-300 hover:bg-indigo-950/60 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Traspaso 2026 → 2027</span>
                      </button>
                    )}
                  </div>

                  {/* Sesión */}
                  {session && (
                    <div className="p-2 space-y-0.5">
                      {onAbrirCambiarPassword && (
                        <button
                          onClick={() => { onAbrirCambiarPassword(); setAccountOpen(false); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          <KeyRound className="w-4 h-4 text-amber-400" />
                          <span>Cambiar Contraseña</span>
                        </button>
                      )}
                      {onLogout && (
                        <button
                          onClick={() => { setAccountOpen(false); onLogout(); }}
                          className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-950/60 transition-colors"
                        >
                          <LogOut className="w-4 h-4 text-rose-400" />
                          <span>Cerrar Sesión</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Menú Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-1.5 rounded-xl bg-white/10 border border-white/15 text-white hover:bg-white/20"
              title="Abrir menú"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* ── 4. Mobile Drawer ── */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-white/15 animate-slide-down">
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              {[
                { id: 'colegios_asesorados', label: 'Dashboard', icon: UserCheck },
                { id: 'workflow', label: 'Espacio Escolar', icon: ClipboardCheck },
                { id: 'consolidador', label: 'Consolidado', icon: Layers },
                { id: 'estadisticas', label: 'Estadísticas', icon: BarChart3 },
                { id: 'analizador', label: 'Analizador', icon: Sparkles },
                { id: 'planes_estudio', label: 'Planes & EPJA', icon: BookOpen },
              ].map(item => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => { onSelectVista(item.id); setMobileMenuOpen(false); }}
                    className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${
                      vistaActiva === item.id
                        ? 'bg-brand-primary text-white'
                        : 'bg-black/40 text-slate-200 hover:bg-black/60'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 text-amber-400" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
