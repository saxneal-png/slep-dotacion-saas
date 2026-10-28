import React, { useState, useRef, useEffect } from 'react';
import {
  Building2, FileSpreadsheet, Layers, ClipboardCheck, ChevronDown,
  SlidersHorizontal, FileUp, PieChart, BookOpen, Users, Scale, LayoutGrid,
  Database, Search, Sparkles, BarChart3, CheckCircle2,
  UserCheck, Settings, Palette, Moon, Sun, Leaf, Eye, Menu, X, Globe,
  LogOut, ShieldAlert
} from 'lucide-react';
import { Establecimiento } from '../types';
import { AuthSession } from '../types/authTypes';
import { AuthService } from '../services/authService';
import { subscribePersist, getUltimaHoraGuardado } from '../database/db';

interface HeaderProps {
  session?: AuthSession | null;
  onLogout?: () => void;
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
}

export const Header: React.FC<HeaderProps> = ({
  session,
  onLogout,
  colegioActivo,
  colegios,
  onSelectColegio,
  vistaActiva,
  onSelectVista,
  onExportarExcel,
  inconsistenciasCount,
  onAbrirNavegadorColegios,
  onAbrirCentroRespaldos,
  periodoActivo,
  onTogglePeriodo,
  onAbrirComparadorPeriodos,
  onAbrirTraspasoPeriodos,
  onAbrirImportadorMatriz,
  onAbrirCopilot,
  onAbrirConfiguraciones
}) => {
  const permisos = session ? AuthService.getPermisos(session.usuario.role) : null;
  const [toolsOpen, setToolsOpen]       = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('slep_ui_theme') || 'slep-republicano';
  });
  const [internalEstadoGuardado, setInternalEstadoGuardado] = useState<'saved' | 'error'>('saved');
  const [internalUltimaHora, setInternalUltimaHora] = useState<string>(getUltimaHoraGuardado());

  const toolsRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Aplica el tema al <html> y persiste en localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('slep_ui_theme', currentTheme);
  }, [currentTheme]);

  useEffect(() => {
    const unsub = subscribePersist((status, time) => {
      setInternalEstadoGuardado(status);
      setInternalUltimaHora(time);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) setToolsOpen(false);
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) setThemeMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const temasDisponibles = [
    { id: 'slep-republicano', label: 'Institucional SLEP (Claro)', icon: Sun,   dot: '#007AFF' },
    { id: 'executive-dark',   label: 'Executive Dark (Noche)',     icon: Moon,  dot: '#0A84FF' },
    { id: 'warm-earth',       label: 'Warm Earth (Tierra)',        icon: Globe, dot: '#9C5722' },
    { id: 'emerald-nordic',   label: 'Emerald Nordic (Esmeralda)', icon: Leaf,  dot: '#059669' },
    { id: 'high-contrast',    label: 'Alto Contraste (AAA)',       icon: Eye,   dot: '#0040C7' },
  ];

  const modulosDetallados = [
    { id: 'planes_estudio', label: 'Catálogo de Planes & EPJA 2024', icon: BookOpen,   desc: 'Matrices MINEDUC y Dto. 10/2022' },
    { id: 'sige',           label: 'Ingesta SIGE (MINEDUC)',         icon: FileUp,     desc: 'Carga de nóminas oficiales' },
    { id: 'pie',            label: 'Auditoría PIE (Dec. 170)',        icon: PieChart,   desc: 'Cuadre horas diferencial y PAE' },
    { id: 'salas_sae',      label: 'Salas & Cupos SAE (Dec. 548)',   icon: LayoutGrid, desc: 'Aforos y desdoblamientos' },
    { id: 'curriculum',     label: 'Planes Curriculares MINEDUC',     icon: BookOpen,   desc: 'Matrices de estudio por curso' },
    { id: 'docentes',       label: 'Docentes & Ley 20.903',           icon: Users,      desc: 'Control 65/35 y sobreasignación' },
    { id: 'asistentes',     label: 'Asistentes de la Educación',      icon: Users,      desc: 'Ley 21.109, Duplas SEP y PIE' },
    { id: 'balanza',        label: 'Balanza & Diagnóstico',            icon: Scale,      desc: 'Superávit y déficit horario' },
  ];

  const esModuloSecundario = modulosDetallados.some(m => m.id === vistaActiva);

  // Clases con alto contraste para navegación
  const navPillClass = (id: string) =>
    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
      vistaActiva === id
        ? 'bg-brand-primary text-white shadow-md'
        : 'text-slate-100 hover:bg-white/10 hover:text-white'
    }`;

  return (
    <header
      className="text-white border-b shadow-md sticky top-0 z-40 backdrop-blur-md transition-colors duration-200"
      style={{ backgroundColor: 'var(--header-bg, #0F172A)', borderColor: 'var(--header-border, #334155)' }}
    >
      <div className="max-w-[1720px] mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2 sm:gap-3">

          {/* ── 1. Logo / Branding ── */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none group flex-shrink-0"
            onClick={() => onSelectVista('colegios_asesorados')}
            title="Ir a Colegios Asesorados"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center font-black text-sm shadow-md group-hover:scale-105 transition-transform text-white">
              VD
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 font-extrabold leading-tight">
                SLEP Valle Diguillín
              </div>
              <h1 className="text-sm font-black text-white tracking-tight leading-none">
                Dotación Docente
              </h1>
            </div>
          </div>

          {/* ── 2. Navegación Principal ── */}
          <nav className="hidden lg:flex items-center bg-black/40 p-1 rounded-xl border border-white/15 shadow-inner space-x-0.5">
            {(!permisos || permisos.puedeAccederTodasEscuelas) && (
              <button onClick={() => onSelectVista('colegios_asesorados')} className={navPillClass('colegios_asesorados')} title="Colegios Asesorados">
                <UserCheck className="w-3.5 h-3.5 text-amber-400" />
                <span>Colegios Asesorados</span>
              </button>
            )}

            {(!permisos || permisos.puedeVerCarteraTerritorial) && (
              <button onClick={() => onSelectVista('cartera')} className={navPillClass('cartera')}>
                <Building2 className="w-3.5 h-3.5 text-sky-400" />
                <span>Cartera</span>
              </button>
            )}

            <button onClick={() => onSelectVista('workflow')} className={navPillClass('workflow')}>
              <ClipboardCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Espacio Escolar</span>
            </button>

            {(!permisos || permisos.puedeVerConsolidadorMaster) && (
              <button onClick={() => onSelectVista('consolidador')} className={`${navPillClass('consolidador')} relative`}>
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Consolidado</span>
                {inconsistenciasCount > 0 && (
                  <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black ml-0.5 animate-pulse">
                    {inconsistenciasCount}
                  </span>
                )}
              </button>
            )}

            {(!permisos || permisos.puedeAccederTodasEscuelas) && (
              <button onClick={() => onSelectVista('estadisticas')} className={navPillClass('estadisticas')}>
                <BarChart3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Estadísticas</span>
              </button>
            )}

            {(!permisos || permisos.puedeVerAnalizadorSige) && (
              <button
                onClick={() => onSelectVista('analizador')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  vistaActiva === 'analizador'
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'text-amber-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Analizador</span>
              </button>
            )}
          </nav>

          {/* ── 3. Controles Derecha ── */}
          <div className="flex items-center space-x-1.5 flex-shrink-0">

            {/* Buscador de Colegios (Deshabilitado o restringido para rol director de escuela) */}
            {(!permisos || permisos.puedeAccederTodasEscuelas) ? (
              <button
                onClick={onAbrirNavegadorColegios}
                className="flex items-center space-x-2 bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-xl border border-white/20 text-xs font-bold text-white transition-all shadow-sm group max-w-[170px] sm:max-w-[220px]"
                title="Buscar escuela (⌘K / Ctrl+K)"
              >
                <Search className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <span className="truncate text-xs font-semibold text-white">
                  {colegioActivo ? colegioActivo.nombre : 'Seleccionar escuela'}
                </span>
                <kbd className="hidden xl:inline text-[9px] bg-white/10 px-1 py-0.5 rounded text-white font-mono border border-white/20">
                  ⌘K
                </kbd>
              </button>
            ) : (
              <div className="flex items-center space-x-2 bg-blue-950/60 px-3 py-1.5 rounded-xl border border-blue-500/40 text-xs font-bold text-blue-200 shadow-sm max-w-[170px] sm:max-w-[240px]">
                <Building2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                <span className="truncate text-xs font-bold text-white">
                  {colegioActivo ? colegioActivo.nombre : 'Colegio Asignado'}
                </span>
              </div>
            )}

            {/* Selector Periodo (2026 | 2027) */}
            <div className="flex items-center bg-black/40 p-0.5 rounded-xl border border-white/20 shadow-inner">
              <button
                onClick={() => onTogglePeriodo(2026)}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  periodoActivo === 2026
                    ? 'bg-brand-primary text-white shadow-md'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >2026</button>
              <button
                onClick={() => onTogglePeriodo(2027)}
                className={`px-2.5 py-1 rounded-lg text-xs font-extrabold transition-all ${
                  periodoActivo === 2027
                    ? 'bg-brand-primary text-white shadow-md'
                    : 'text-slate-200 hover:text-white hover:bg-white/10'
                }`}
              >2027</button>
            </div>

            {/* Theme Switcher */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="p-2 rounded-xl bg-black/40 hover:bg-black/60 border border-white/20 text-white transition-all shadow-sm"
                title="Cambiar tema visual"
              >
                <Palette className="w-4 h-4 text-amber-400" />
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 animate-fade-in backdrop-blur-md">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-black text-slate-400 tracking-wider">
                    Temas de Personalización
                  </div>
                  <div className="p-1 space-y-1">
                    {temasDisponibles.map(t => {
                      const Icon = t.icon;
                      const active = currentTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => { setCurrentTheme(t.id); setThemeMenuOpen(false); }}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                            active
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-200 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
                            <span className="w-3 h-3 rounded-full inline-block shrink-0 ring-1 ring-white/30" style={{ background: t.dot }} />
                            <Icon className="w-4 h-4" />
                            <span>{t.label}</span>
                          </div>
                          {active && <CheckCircle2 className="w-4 h-4 text-white" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Botón IA Copilot */}
            {onAbrirCopilot && (
              <button
                onClick={onAbrirCopilot}
                className="hidden sm:flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-black transition-all shadow-md border border-blue-400/40 group"
                title="Abrir asistente IA (⌘J / Ctrl+J)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                <span className="tracking-tight">¡Qué no va a saber! IA</span>
                <kbd className="hidden md:inline text-[9px] bg-black/40 px-1 py-0.2 rounded text-blue-200 font-mono">⌘J</kbd>
              </button>
            )}

            {/* Configuraciones (Solo usuarios con permiso o admin) */}
            {onAbrirConfiguraciones && (!permisos || permisos.puedeConfigurarSistema) && (
              <button
                onClick={onAbrirConfiguraciones}
                className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                  vistaActiva === 'configuraciones'
                    ? 'bg-amber-500 text-white border-amber-400 shadow-md'
                    : 'bg-black/40 border-white/20 text-slate-200 hover:text-white hover:bg-black/60'
                }`}
                title="Centro de Configuraciones Generales"
              >
                <Settings className="w-4 h-4 text-amber-400" />
              </button>
            )}

            {/* Perfil de Usuario y Logout */}
            {session && (
              <div className="flex items-center gap-1.5 pl-1 border-l border-white/15">
                <div className="hidden xl:flex flex-col text-right leading-tight max-w-[120px]">
                  <span className="text-[11px] font-bold text-white truncate">
                    {session.usuario.nombreCompleto}
                  </span>
                  <span className="text-[9px] font-mono uppercase tracking-wider text-amber-300 truncate">
                    {session.usuario.role.replace('_', ' ')}
                  </span>
                </div>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-2 rounded-xl bg-red-600/20 hover:bg-red-600/40 border border-red-500/40 text-red-200 hover:text-white transition-all shadow-sm"
                    title={`Cerrar sesión (${session.usuario.username})`}
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}

            {/* Menú Opciones / Herramientas */}
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                  esModuloSecundario
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                    : 'bg-black/40 border-white/20 text-white hover:bg-black/60'
                }`}
                title="Herramientas y módulos técnicos"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden md:inline font-bold">Opciones</span>
                <ChevronDown className="w-3 h-3 text-slate-300" />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800 animate-fade-in backdrop-blur-md">
                  <div className="p-2 space-y-1">
                    {(!permisos || permisos.puedeConfigurarSistema) && (
                      <button
                        onClick={() => { onAbrirCentroRespaldos(); setToolsOpen(false); }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-emerald-400" />
                          <span>Centro de Respaldos SQLite</span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold ${internalEstadoGuardado === 'saved' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {internalEstadoGuardado === 'saved' ? 'Activo' : 'Error'}
                        </span>
                      </button>
                    )}

                    {onAbrirTraspasoPeriodos && (!permisos || permisos.puedeTraspasarPeriodos) && (
                      <button
                        onClick={() => { onAbrirTraspasoPeriodos(); setToolsOpen(false); }}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-indigo-300 hover:bg-indigo-950/60 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Asistente Traspaso 2026 → 2027</span>
                      </button>
                    )}

                    <button
                      onClick={() => { onExportarExcel(); setToolsOpen(false); }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold text-white hover:bg-slate-800 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Descargar Excel Consolidado</span>
                    </button>
                  </div>

                  <div className="p-2 space-y-1">
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
                            <div className="text-[10px] text-slate-300 font-medium">{item.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Menú Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-black/40 border border-white/20 text-white hover:bg-black/60"
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
                { id: 'colegios_asesorados', label: 'Asesorados', icon: UserCheck },
                { id: 'cartera',             label: 'Cartera',    icon: Building2 },
                { id: 'workflow',            label: 'Espacio Escolar', icon: ClipboardCheck },
                { id: 'planes_estudio',      label: 'Planes & EPJA', icon: BookOpen },
                { id: 'consolidador',        label: 'Consolidado',icon: Layers },
                { id: 'estadisticas',        label: 'Estadísticas',icon: BarChart3 },
                { id: 'analizador',          label: 'Analizador', icon: Sparkles },
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
