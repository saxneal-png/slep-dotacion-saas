import React from 'react';
import { Search } from 'lucide-react';

interface CurriculumFilterBarProps {
  busqueda: string;
  onBusquedaChange: (s: string) => void;
  filtroCiclo: 'TODOS' | 'PARVULARIA' | 'BASICA' | 'MEDIA_HC' | 'MEDIA_TP' | 'MULTIGRADO_COMBINADO' | 'EPJA' | 'ESPECIAL';
  onFiltroCicloChange: (f: 'TODOS' | 'PARVULARIA' | 'BASICA' | 'MEDIA_HC' | 'MEDIA_TP' | 'MULTIGRADO_COMBINADO' | 'EPJA' | 'ESPECIAL') => void;
  filtroRegimen: 'TODOS' | 'JEC' | 'No JEC';
  onFiltroRegimenChange: (r: 'TODOS' | 'JEC' | 'No JEC') => void;
  filtroCobertura: 'TODOS' | 'COMPLETO' | 'DEFICIT' | 'SOBRE';
  onFiltroCoberturaChange: (c: 'TODOS' | 'COMPLETO' | 'DEFICIT' | 'SOBRE') => void;
}

export const CurriculumFilterBar: React.FC<CurriculumFilterBarProps> = ({
  busqueda,
  onBusquedaChange,
  filtroCiclo,
  onFiltroCicloChange,
  filtroRegimen,
  onFiltroRegimenChange,
  filtroCobertura,
  onFiltroCoberturaChange
}) => {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm text-xs">
      <div className="flex items-center gap-2 flex-1 min-w-[200px]">
        <div className="relative w-full max-w-xs">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nivel o letra..."
            value={busqueda}
            onChange={e => onBusquedaChange(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-orange-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filtroCiclo}
          onChange={e => onFiltroCicloChange(e.target.value as any)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-orange-500"
        >
          <option value="TODOS">Todos los Ciclos</option>
          <option value="PARVULARIA">Educación Parvularia</option>
          <option value="BASICA">Educación Básica</option>
          <option value="MEDIA_HC">Media Humanístico-Científica</option>
          <option value="MEDIA_TP">Media Técnico-Profesional</option>
          <option value="MULTIGRADO_COMBINADO">Multigrado / Combinados</option>
          <option value="EPJA">Educación de Adultos (EPJA)</option>
          <option value="ESPECIAL">Educación Especial / Laboral</option>
        </select>

        <select
          value={filtroRegimen}
          onChange={e => onFiltroRegimenChange(e.target.value as any)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-orange-500"
        >
          <option value="TODOS">Todos los Regímenes</option>
          <option value="JEC">Jornada Completa (JEC)</option>
          <option value="No JEC">Media Jornada (Sin JEC)</option>
        </select>

        <select
          value={filtroCobertura}
          onChange={e => onFiltroCoberturaChange(e.target.value as any)}
          className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-orange-500"
        >
          <option value="TODOS">Toda Cobertura</option>
          <option value="COMPLETO">100% Cubierto</option>
          <option value="DEFICIT">Con Déficit Horario</option>
          <option value="SOBRE">Con Sobreasignación</option>
        </select>
      </div>
    </div>
  );
};
