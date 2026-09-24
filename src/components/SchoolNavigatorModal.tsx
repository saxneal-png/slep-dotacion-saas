import React, { useState, useEffect, useRef } from 'react';
import { Search, School, ArrowRight, X, Building2, Users, AlertTriangle, CheckCircle2, UserCheck } from 'lucide-react';
import type { Establecimiento } from '../types';
import type { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';
import { cargarConfiguracionGeneral } from '../services/configuracionGeneralService';

export interface SchoolNavigatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  colegios: Establecimiento[];
  colegioActivo: Establecimiento | null;
  onSelectColegio: (est: Establecimiento) => void;
  diagnosticos?: DiagnosticoColegioCompleto[];
  onCrearNuevoColegio?: () => void;
}

export const SchoolNavigatorModal: React.FC<SchoolNavigatorModalProps> = ({
  isOpen,
  onClose,
  colegios,
  colegioActivo,
  onSelectColegio,
  diagnosticos = [],
  onCrearNuevoColegio
}) => {
  const [config] = useState(() => cargarConfiguracionGeneral());
  const [query, setQuery] = useState('');
  const [selectedComuna, setSelectedComuna] = useState<string>('ALL');
  const [soloMisAsesorias, setSoloMisAsesorias] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedComuna('ALL');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredColegios = colegios.filter(c => {
    if (soloMisAsesorias && config.asesorActivoNombre) {
      if (!c.asesorUatp || c.asesorUatp.toLowerCase().trim() !== config.asesorActivoNombre.toLowerCase().trim()) {
        return false;
      }
    }
    if (selectedComuna !== 'ALL' && c.comuna !== selectedComuna) return false;
    if (!query) return true;
    const q = query.toLowerCase();
    return (
      c.nombre.toLowerCase().includes(q) ||
      c.rbd.toString().includes(q) ||
      (c.comuna && c.comuna.toLowerCase().includes(q)) ||
      (c.asesorUatp && c.asesorUatp.toLowerCase().includes(q))
    );
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredColegios.length));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredColegios.length) % Math.max(1, filteredColegios.length));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredColegios[selectedIndex]) {
          onSelectColegio(filteredColegios[selectedIndex]);
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filteredColegios, selectedIndex, onSelectColegio, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div 
        className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Barra de Búsqueda estilo Spotlight */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-100 gap-3 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Buscar escuela por nombre, RBD o comuna... (o usa las flechas)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            className="flex-1 bg-transparent border-none text-slate-800 placeholder-slate-400 focus:outline-none text-base font-medium"
          />
          <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 bg-slate-200/60 px-2 py-0.5 rounded">
            ESC
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Chips de Filtro Rápido por Asesor y Comuna */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-50 border-b border-slate-100 overflow-x-auto text-[11px]">
          {config.asesorActivoNombre && (
            <button
              type="button"
              onClick={() => {
                setSoloMisAsesorias(!soloMisAsesorias);
                setSelectedIndex(0);
              }}
              className={`flex items-center gap-1 px-2.5 py-0.5 rounded-md font-bold shrink-0 transition-colors ${
                soloMisAsesorias
                  ? 'bg-orange-600 text-white shadow-xs'
                  : 'bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100'
              }`}
              title={`Filtrar solo escuelas asignadas a ${config.asesorActivoNombre}`}
            >
              <UserCheck className="w-3 h-3" />
              <span>Mis Colegios ({config.asesorActivoNombre.split(' ')[0]})</span>
            </button>
          )}

          <span className="text-slate-400 font-bold shrink-0 ml-1">Comuna:</span>
          {['ALL', 'Bulnes', 'Chillán', 'Chillán Viejo', 'El Carmen', 'Pemuco', 'San Ignacio', 'Yungay'].map(com => (
            <button
              key={com}
              type="button"
              onClick={() => {
                setSelectedComuna(com);
                setSelectedIndex(0);
              }}
              className={`px-2 py-0.5 rounded-md font-semibold shrink-0 transition-colors ${
                selectedComuna === com
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {com === 'ALL' ? 'Todas' : com}
            </button>
          ))}
        </div>

        {/* Lista de Establecimientos */}
        <div className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-slate-50">
          {filteredColegios.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <School className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.5]" />
              <p className="text-sm">No se encontraron establecimientos para "{query}"</p>
              {onCrearNuevoColegio && (
                <button
                  onClick={() => {
                    onCrearNuevoColegio();
                    onClose();
                  }}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg transition-colors"
                >
                  Crear o administrar establecimientos
                </button>
              )}
            </div>
          ) : (
            filteredColegios.map((col, idx) => {
              const isActive = colegioActivo?.id === col.id;
              const isSelected = selectedIndex === idx;
              const diag = diagnosticos.find(d => d.establecimiento.rbd === col.rbd);

              return (
                <div
                  key={col.id}
                  onClick={() => {
                    onSelectColegio(col);
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-blue-50/80 border border-blue-200/60 shadow-sm'
                      : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      isActive 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : isSelected 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-slate-100 text-slate-600'
                    }`}>
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 truncate">
                          {col.nombre}
                        </span>
                        {isActive && (
                          <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full uppercase tracking-wider">
                            Activo
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="font-mono">RBD: {col.rbd}</span>
                        <span>•</span>
                        <span>{col.regimen}</span>
                        {col.comuna && (
                          <>
                            <span>•</span>
                            <span>{col.comuna}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 pl-2">
                    {diag && (
                      <div className="hidden sm:flex items-center gap-2.5 text-[11px]">
                        <span className="flex items-center gap-1 font-semibold text-slate-600" title="Matrícula Total">
                          <Users className="w-3.5 h-3.5 text-slate-400" /> {diag.balanzaGeneral.totalMatriculaProyectada} alum.
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] flex items-center gap-1 ${
                          diag.balanzaGeneral.superavitDeficitLectivo >= 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}>
                          {diag.balanzaGeneral.superavitDeficitLectivo >= 0 ? (
                            <CheckCircle2 className="w-3 h-3" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" />
                          )}
                          {diag.balanzaGeneral.superavitDeficitLectivo >= 0 
                            ? `+${diag.balanzaGeneral.superavitDeficitLectivo}h` 
                            : `${diag.balanzaGeneral.superavitDeficitLectivo}h`}
                        </span>
                      </div>
                    )}

                    <div className={`p-1.5 rounded-lg transition-colors ${
                      isSelected ? 'text-blue-600' : 'text-slate-300'
                    }`}>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer con Atajos de Teclado y Botón Crear */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            {onCrearNuevoColegio && (
              <button
                onClick={() => {
                  onCrearNuevoColegio();
                  onClose();
                }}
                className="font-medium text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1"
              >
                + Gestionar escuelas en Cartera
              </button>
            )}
          </div>
          <div className="flex items-center gap-3 text-[11px]">
            <span><strong className="font-mono">↑↓</strong> Navegar</span>
            <span><strong className="font-mono">↵</strong> Seleccionar</span>
            <span><strong className="font-mono">ESC</strong> Cerrar</span>
          </div>
        </div>
      </div>
    </div>
  );
};
