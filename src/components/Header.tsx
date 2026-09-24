import React, { useState, useRef, useEffect } from 'react';
import {
  Building2, FileSpreadsheet, Layers, ClipboardCheck, ChevronDown,
  SlidersHorizontal, FileUp, PieChart, BookOpen, Users, Scale, LayoutGrid,
  Database, Search, Sparkles, BarChart3, CheckCircle2, AlertCircle,
  UserCheck, Settings
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
  const [internalEstadoGuardado, setInternalEstadoGuardado] = useState<'saved' | 'error'>('saved');
  const [internalUltimaHora, setInternalUltimaHora] = useState<string>(getUltimaHoraGuardado());
  const toolsRef = useRef<HTMLDivElement>(null);

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
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

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
    <header className="bg-[#002B49] text-white border-b border-slate-700/80 shadow-md sticky top-0 z-40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* 1. Logo y Branding (Minimalista y Elegante) */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none group flex-shrink-0"
            onClick={() => onSelectVista('cartera')}
            title="Ir a Cartera Territorial"
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

          {/* 2. Navegación Maestro Estilo Apple Segmented Pill */}
          <nav className="hidden lg:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700/60 shadow-inner space-x-1">
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

          {/* 3. Bloque Derecho: Colegio Activo, Botón Asistente y Acciones */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            
            {/* Pill Navegador de Colegios + Periodo Unificado */}
            <button
              onClick={onAbrirNavegadorColegios}
              className="flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs font-semibold text-white transition-all shadow-sm group max-w-[170px] sm:max-w-[220px]"
              title="Buscar y cambiar de escuela (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">
                {colegioActivo ? colegioActivo.nombre : 'Seleccionar Escuela'}
              </span>
              <span className="hidden xl:inline-block text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">
                ⌘K
              </span>
            </button>

            {/* Cápsula de Periodo (2026 | 2027) */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-slate-700/80 shadow-inner">
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

            {/* Botón Destacado: ¡Qué no va a saber! IA */}
            {onAbrirCopilot && (
              <button
                onClick={onAbrirCopilot}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-500/25 border border-blue-400/40 group relative"
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
                    : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
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
                    : 'bg-slate-800/90 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Herramientas, módulos técnicos y exportaciones"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden md:inline">Opciones</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl py-2 z-50 divide-y divide-slate-800 animate-fade-in">
                  
                  {/* Sección de Configuraciones & Respaldos */}
                  <div className="p-2">
                    {onAbrirConfiguraciones && (
                      <button
                        onClick={() => {
                          onAbrirConfiguraciones();
                          setToolsOpen(false);
                        }}
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-orange-300 hover:bg-slate-800 transition-colors"
                      >
                        <div className="flex items-center space-x-2">
                          <Settings className="w-4 h-4 text-orange-400" />
                          <span>Configuraciones Generales</span>
                        </div>
                        <span className="text-[10px] bg-orange-500/20 text-orange-300 px-1.5 py-0.5 rounded font-bold">
                          Ajustes
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onAbrirCentroRespaldos();
                        setToolsOpen(false);
                      }}
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors mt-0.5"
                    >
                      <div className="flex items-center space-x-2">
                        <Database className="w-4 h-4 text-emerald-400" />
                        <span>Centro de Respaldos SQLite</span>
                      </div>
                      <span className="text-[10px] font-mono text-emerald-400">
                        {internalEstadoGuardado === 'saved' ? 'Guardado' : 'Error'}
                      </span>
                    </button>

                    {onAbrirTraspasoPeriodos && (
                      <button
                        onClick={() => {
                          onAbrirTraspasoPeriodos();
                          setToolsOpen(false);
                        }}
                        className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-indigo-300 hover:bg-indigo-950/60 transition-colors mt-0.5"
                      >
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                        <span>Asistente de Traspaso 2026 ➔ 2027</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        onExportarExcel();
                        setToolsOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-200 hover:bg-slate-800 transition-colors mt-0.5"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                      <span>Descargar Excel Consolidado SLEP</span>
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

          </div>

        </div>
      </div>
    </header>
  );
};
