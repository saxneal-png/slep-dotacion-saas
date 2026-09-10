import React, { useState, useRef, useEffect } from 'react';
import {
  Building2, FileSpreadsheet, Layers, ClipboardCheck, ChevronDown,
  SlidersHorizontal, FileUp, PieChart, BookOpen, Users, Scale, LayoutGrid,
  Database, Search, ShieldCheck, Sparkles, BarChart3
} from 'lucide-react';
import { Establecimiento } from '../types';

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
  estadoGuardado: 'saved' | 'error';
  ultimaHoraGuardado: string;
  periodoActivo: number;
  onTogglePeriodo: (p: number) => void;
  onAbrirComparadorPeriodos?: () => void;
  onAbrirImportadorMatriz?: () => void;
  onAbrirCopilot?: () => void;
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
  estadoGuardado,
  ultimaHoraGuardado,
  periodoActivo,
  onTogglePeriodo,
  onAbrirComparadorPeriodos,
  onAbrirImportadorMatriz,
  onAbrirCopilot
}) => {
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef<HTMLDivElement>(null);

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
    <header className="bg-[#002B49] text-white border-b border-slate-700/80 shadow-lg sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo y Branding */}
          <div
            className="flex items-center space-x-3 cursor-pointer select-none group flex-shrink-0"
            onClick={() => onSelectVista('cartera')}
            title="Ir a Cartera Territorial"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center font-black text-lg shadow-md group-hover:scale-105 transition-transform text-white">
              VD
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-orange-400 font-bold">
                SLEP Valle Diguillín • UATP
              </div>
              <h1 className="text-sm sm:text-base font-bold text-slate-100 tracking-tight leading-tight">
                Consolidador de Dotación
              </h1>
            </div>
          </div>

          {/* 3 PILARES MAESTROS (Estilo Segmented Control de Apple) */}
          <nav className="hidden md:flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-700/70 shadow-inner">
            <button
              onClick={() => onSelectVista('cartera')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'cartera'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Cartera Territorial</span>
            </button>

            <button
              onClick={() => onSelectVista('workflow')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'workflow'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Espacio Escolar</span>
            </button>

            <button
              onClick={() => onSelectVista('estadisticas')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'estadisticas'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
              <span>Estadísticas</span>
            </button>

            <button
              onClick={() => onSelectVista('consolidador')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all relative ${
                vistaActiva === 'consolidador'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Consolidado SLEP</span>
              {inconsistenciasCount > 0 && (
                <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-black ml-0.5 animate-pulse">
                  {inconsistenciasCount}
                </span>
              )}
            </button>

            <button
              onClick={() => onSelectVista('analizador')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                vistaActiva === 'analizador'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-sm'
                  : 'text-orange-300 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Analizador & IA</span>
            </button>
          </nav>

          {/* Selector de Colegio Activo, Periodo, Guardado y Herramientas */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Cápsula de Periodo (2026 Actual vs 2027 Proyección) */}
            <div className="flex items-center bg-slate-900/90 p-0.5 rounded-xl border border-slate-700/80 shadow-inner">
              <button
                onClick={() => onTogglePeriodo(2026)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  periodoActivo === 2026
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Dotación del año escolar en curso 2026"
              >
                2026
              </button>
              <button
                onClick={() => onTogglePeriodo(2027)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                  periodoActivo === 2027
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Proyección de dotación para el año escolar 2027"
              >
                2027 Proy.
              </button>
            </div>

            {/* Pill Navegador de Colegios (Spotlight / Cmd+K) */}
            <button
              onClick={onAbrirNavegadorColegios}
              className="flex items-center space-x-2 bg-slate-800/90 hover:bg-slate-700/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs font-semibold text-white transition-all shadow-sm group max-w-[190px] sm:max-w-[250px]"
              title="Abrir buscador rápido de escuelas y liceos (Ctrl+K)"
            >
              <Search className="w-3.5 h-3.5 text-orange-400 flex-shrink-0 group-hover:scale-110 transition-transform" />
              <span className="truncate">
                {colegioActivo ? colegioActivo.nombre : 'Seleccionar Escuela'}
              </span>
              <span className="hidden sm:inline-block text-[9px] bg-slate-900/80 px-1.5 py-0.5 rounded text-slate-300 font-mono border border-slate-700">
                ⌘K
              </span>
            </button>

            {/* Insignia de Guardado SQLite en Vivo */}
            <button
              onClick={onAbrirCentroRespaldos}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                estadoGuardado === 'saved'
                  ? 'bg-emerald-950/60 border-emerald-700/80 text-emerald-300 hover:bg-emerald-900/80'
                  : 'bg-red-950/60 border-red-700/80 text-red-300 hover:bg-red-900/80'
              }`}
              title={`Base de datos local activa. Último guardado: ${ultimaHoraGuardado}. Clic para abrir el Centro de Guardado.`}
            >
              <span className={`w-2 h-2 rounded-full ${estadoGuardado === 'saved' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`}></span>
              <span className="hidden xl:inline text-[11px] text-slate-300">Guardado ({ultimaHoraGuardado})</span>
              <Database className="w-3.5 h-3.5 text-orange-400" />
            </button>

            {/* Menú de submódulos analíticos opcionales */}
            <div className="relative" ref={toolsRef}>
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                  esModuloSecundario
                    ? 'bg-orange-500/20 border-orange-500 text-orange-300'
                    : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
                title="Módulos técnicos y auditorías específicas"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-orange-400" />
                <span className="hidden lg:inline">Auditorías</span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {toolsOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl py-2 z-50 divide-y divide-slate-800">
                  <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                    Módulos Especializados
                  </div>
                  <div className="py-1">
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
                          className={`w-full flex items-start px-3 py-2 text-left hover:bg-slate-800 transition-colors ${
                            active ? 'bg-blue-950/60 text-blue-300' : 'text-slate-300'
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

            {/* Botón Copilot IA */}
            {onAbrirCopilot && (
              <button
                onClick={onAbrirCopilot}
                className="flex items-center space-x-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/30 border border-blue-400/30 group"
                title="Abrir Copilot Asistente de Dotación (Ctrl+J / ⌘J)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-pulse group-hover:rotate-12 transition-transform" />
                <span>Copilot IA</span>
                <span className="hidden sm:inline-block text-[9px] bg-black/30 px-1 py-0.2 rounded text-blue-200 font-mono">
                  ⌘J
                </span>
              </button>
            )}

            {/* Exportar Excel */}
            <button
              onClick={onExportarExcel}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm"
              title="Descargar planilla Excel de dotación"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span className="hidden sm:inline">Excel</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
