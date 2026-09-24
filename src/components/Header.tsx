import React, { useState, useRef, useEffect } from 'react';
import {
  Building2, FileSpreadsheet, Layers, ClipboardCheck, ChevronDown,
  SlidersHorizontal, FileUp, PieChart, BookOpen, Users, Scale, LayoutGrid,
  Database, Search, Sparkles, BarChart3, CheckCircle2, AlertCircle,
  UserCheck, Settings, Palette, Moon, Sun, Leaf, Eye, Menu, X
} from 'lucide-react';
import { Establecimiento } from '../types';
import { subscribePersist, getUltimaHoraGuardado } from '../database/db';

interface HeaderProps {
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
  const [toolsOpen, setToolsOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currentTheme, setCurrentTheme] = useState<string>(() => {
    return localStorage.getItem('slep_ui_theme') || 'slep-republicano';
  });

  const [internalEstadoGuardado, setInternalEstadoGuardado] = useState<'saved' | 'error'>('saved');
  const [internalUltimaHora, setInternalUltimaHora] = useState<string>(getUltimaHoraGuardado());
  
  const toolsRef = useRef<HTMLDivElement>(null);
  const themeRef = useRef<HTMLDivElement>(null);

  // Inicializar tema visual en el elemento HTML
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
      if (toolsRef.current && !toolsRef.current.contains(event.target as Node)) {
        setToolsOpen(false);
      }
      if (themeRef.current && !themeRef.current.contains(event.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const temasDisponibles = [
    { id: 'slep-republicano', label: 'Institucional SLEP', icon: Sun, color: 'bg-blue-600 text-white' },
    { id: 'executive-dark', label: 'Executive Dark', icon: Moon, color: 'bg-slate-900 text-sky-400' },
    { id: 'emerald-nordic', label: 'Emerald Nordic', icon: Leaf, color: 'bg-emerald-600 text-white' },
    { id: 'high-contrast', label: 'Alto Contraste', icon: Eye, color: 'bg-black text-yellow-400 border border-white' }
  ];

  const modulosDetallados = [
    { id: 'sige', label: 'Ingesta SIGE (MINEDUC)', icon: FileUp, desc: 'Carga de nóminas oficiales' },
    { id: 'pie', label: 'Auditoría PIE (Dec. 170)', icon: PieChart, desc: 'Cuadre horas diferencial y PAE' },
    { id: 'salas_sae', label: 'Salas & Cupos SAE (Dec. 548)', icon: LayoutGrid, desc: 'Aforos y desdoblamientos' },
    { id: 'curriculum', label: 'Planes Curriculares MINEDUC', icon: BookOpen, desc: 'Matrices de estudio oficiales' },
    { id: 'docentes', label: 'Docentes & Ley 20.903', icon: Users, desc: 'Control 65/35 y sobreasignación' },
    { id: 'balanza', label: 'Balanza & Diagnóstico', icon: Scale, desc: 'Superávit y déficit horario' }
  ];

  const esModuloSecundario = modulosDetallados.some(m => m.id === vistaActiva);

  return (
    <header className="bg-[#002B49] text-white border-b border-slate-700/80 shadow-md sticky top-0 z-40 backdrop-blur-md transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* 1. Logo y Branding */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none group flex-shrink-0"
            onClick={() => onSelectVista('colegios_asesorados')}
            title="Ir a Colegios Asesorados"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 flex items-center justify-center font-black text-sm shadow-md group-hover:scale-105 transition-transform text-white">
              VD
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] uppercase tracking-wider text-orange-400 font-bold leading-tight">
                SLEP Valle Diguillín
              </div>
              <h1 className="text-sm font-bold text-slate-100 tracking-tight leading-none">
                Dotación Docente
              </h1>
            </div>
          </div>

          {/* 2. Navegación Principal Estilo Segmented Pill */}
          <nav className="hidden lg:flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/60 shadow-inner space-x-1">
            <button
              onClick={() => onSelectVista('colegios_asesorados')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'colegios_asesorados'
                  ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
              title="Apartado Colegios Asesorados por Asesor UATP"
            >
              <UserCheck className="w-3.5 h-3.5 text-orange-400" />
              <span>Colegios Asesorados</span>
            </button>

            <button
              onClick={() => onSelectVista('cartera')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'cartera'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Cartera</span>
            </button>

            <button
              onClick={() => onSelectVista('workflow')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'workflow'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Espacio Escolar</span>
            </button>

            <button
              onClick={() => onSelectVista('consolidador')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                vistaActiva === 'consolidador'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Consolidado</span>
              {inconsistenciasCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black ml-0.5 animate-pulse">
                  {inconsistenciasCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectVista('estadisticas')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'estadisticas'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
              <span>Estadísticas</span>
            </button>

            <button
              onClick={() => onSelectVista('analizador')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'analizador'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm'
                  : 'text-orange-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Analizador Nóminas</span>
            </button>
          </nav>

          {/* 3. Controles & Acciones de la Derecha */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            
            {/* Pill Navegador de Colegios */}
            <button
              onClick={onAbrirNavegadorColegios}
              className="flex items-center space-x-2 bg-slate-900/80 hover:bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs font-semibold text-white transition-all shadow-sm group max-w-[150px] sm:max-w-[200px]"
              title="Buscar y cambiar de escuela (Ctrl+K / ⌘K)"
            >
              <Search className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate text-[11px] sm:text-xs">
                {colegioActivo ? colegioActivo.nombre : 'Seleccionar Escuela'}
              </span>
              <span className="hidden xl:inline-block text-[9px] bg-slate-800 px-1 py-0.2 rounded text-slate-400 font-mono border border-slate-700">
                ⌘K
              </span>
            </button>

            {/* Cápsula de Periodo (2026 | 2027) */}
            <div className="flex items-center bg-slate-900/80 p-0.5 rounded-xl border border-slate-700/80 shadow-inner">
              <button
                onClick={() => onTogglePeriodo(2026)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  periodoActivo === 2026
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Dotación 2026 Actual"
              >
                2026
              </button>
              <button
                onClick={() => onTogglePeriodo(2027)}
                className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
                  periodoActivo === 2027
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Proyección 2027"
              >
                2027
              </button>
            </div>

            {/* Selector de Tema Visual (Theme Switcher) */}
            <div className="relative" ref={themeRef}>
              <button
                onClick={() => setThemeMenuOpen(!themeMenuOpen)}
                className="p-2 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white transition-all shadow-sm"
                title="Cambiar tema de personalización visual"
              >
                <Palette className="w-4 h-4 text-amber-400" />
              </button>

              {themeMenuOpen && (
                <div className="absolute right-0 mt-2 w-52 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl py-2 z-50 animate-fade-in backdrop-blur-md">
                  <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Temas de Personalización
                  </div>
                  <div className="p-1 space-y-1">
                    {temasDisponibles.map(t => {
                      const Icon = t.icon;
                      const active = currentTheme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => {
                            setCurrentTheme(t.id);
                            setThemeMenuOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all ${
                            active ? 'bg-blue-600/30 text-blue-300 border border-blue-500/40' : 'text-slate-300 hover:bg-slate-800'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Icon className="w-3.5 h-3.5" />
                            <span>{t.label}</span>
                          </div>
                          {active && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Botón Destacado: ¡Qué no va a saber! IA */}
            {onAbrirCopilot && (
              <button
                onClick={onAbrirCopilot}
                className="hidden sm:flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 border border-blue-400/40 group relative"
                title="Abrir asistente inteligente ¡Qué no va a saber! IA (Ctrl+J / ⌘J)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                <span className="font-bold tracking-tight">¡Qué no va a saber! IA</span>
                <span className="hidden md:inline-block text-[9px] bg-black/30 px-1 py-0.2 rounded text-blue-200 font-mono">
                  ⌘J
                </span>
              </button>
            )}

            {/* Botón de Acceso Directo a Configuraciones */}
            {onAbrirConfiguraciones && (
              <button
                onClick={onAbrirConfiguraciones}
                className={`p-2 rounded-xl border text-xs font-semibold transition-all ${
                  vistaActiva === 'configuraciones'
                    ? 'bg-orange-500 text-white border-orange-400 shadow-md'
                    : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Centro de Configuraciones Generales"
              >
                <Settings className="w-4 h-4 text-orange-400" />
              </button>
            )}

            {/* Menú Unificado: Herramientas & Opciones */}
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  esModuloSecundario
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                    : 'bg-slate-900/80 border-slate-700/80 text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Herramientas, módulos técnicos y exportaciones"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden md:inline">Opciones</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800 animate-fade-in backdrop-blur-md">
                  
                  {/* Respaldos & Exportaciones */}
                  <div className="p-2 space-y-0.5">
                    <button
                      onClick={() => {
                        onAbrirCentroRespaldos();
                        setToolsOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <div className="flex items-center space-x-2">
                        <Database className="w-4 h-4 text-emerald-400" />
                        <span>Centro de Respaldos SQLite</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {internalEstadoGuardado === 'saved' ? 'Activo' : 'Error'}
                      </span>
                    </button>

                    {onAbrirTraspasoPeriodos && (
                      <button
                        onClick={() => {
                          onAbrirTraspasoPeriodos();
                          setToolsOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-300 hover:bg-indigo-950/60 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Asistente Traspaso 2026 ➔ 2027</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onExportarExcel();
                        setToolsOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Descargar Excel Consolidado</span>
                    </button>
                  </div>

                  {/* Módulos Técnicos */}
                  <div className="p-2 space-y-0.5">
                    <div className="px-3 py-1 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Módulos Técnicos & Ley 20.903
                    </div>
                    {modulosDetallados.map((item) => {
                      const Icon = item.icon;
                      const active = vistaActiva === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => {
                            onSelectVista(item.id);
                            setToolsOpen(false);
                          }}
                          className={`w-full flex items-start px-3 py-1.5 rounded-xl text-left hover:bg-slate-800 transition-colors ${
                            active ? 'bg-blue-950/80 text-blue-300' : 'text-slate-300'
                          }`}
                        >
                          <Icon className={`w-4 h-4 mr-2.5 mt-0.5 shrink-0 ${active ? 'text-blue-400' : 'text-orange-400'}`} />
                          <div>
                            <div className="text-xs font-semibold">{item.label}</div>
                            <div className="text-[10px] text-slate-400">{item.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                </div>
              )}
            </div>

            {/* Botón Menú Mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl bg-slate-900/80 border border-slate-700/80 text-slate-300 hover:text-white"
              title="Abrir menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

          </div>

        </div>

        {/* Drawer / Menú desplegable Mobile */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-700/80 animate-slide-down">
            <div className="grid grid-cols-2 gap-1.5 pb-2">
              <button
                onClick={() => { onSelectVista('colegios_asesorados'); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${
                  vistaActiva === 'colegios_asesorados' ? 'bg-blue-600 text-white' : 'bg-slate-900/60 text-slate-300'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5 text-orange-400" />
                <span>Asesorados</span>
              </button>
              <button
                onClick={() => { onSelectVista('cartera'); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${
                  vistaActiva === 'cartera' ? 'bg-blue-600 text-white' : 'bg-slate-900/60 text-slate-300'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Cartera</span>
              </button>
              <button
                onClick={() => { onSelectVista('workflow'); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${
                  vistaActiva === 'workflow' ? 'bg-blue-600 text-white' : 'bg-slate-900/60 text-slate-300'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Espacio Escolar</span>
              </button>
              <button
                onClick={() => { onSelectVista('consolidador'); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${
                  vistaActiva === 'consolidador' ? 'bg-blue-600 text-white' : 'bg-slate-900/60 text-slate-300'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Consolidado</span>
              </button>
              <button
                onClick={() => { onSelectVista('estadisticas'); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${
                  vistaActiva === 'estadisticas' ? 'bg-blue-600 text-white' : 'bg-slate-900/60 text-slate-300'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
                <span>Estadísticas</span>
              </button>
              <button
                onClick={() => { onSelectVista('analizador'); setMobileMenuOpen(false); }}
                className={`flex items-center gap-2 p-2 rounded-xl text-xs font-bold ${
                  vistaActiva === 'analizador' ? 'bg-orange-600 text-white' : 'bg-slate-900/60 text-orange-300'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                <span>Analizador</span>
              </button>
            </div>
          </div>
        )}

      </div>
    </header>
  );
};
