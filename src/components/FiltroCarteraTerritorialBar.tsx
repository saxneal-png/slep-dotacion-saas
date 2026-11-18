import React from 'react';
import { Building2, Check, Filter, UserMinus } from 'lucide-react';
import {
  CategoriaTipoEstablecimiento,
  CATEGORIAS_ESCOLARES_SIN_VTF,
  TODAS_LAS_CATEGORIAS_ESTABLECIMIENTO
} from '../services/estadisticasHorasService';

interface FiltroCarteraTerritorialBarProps {
  categoriasSeleccionadas: CategoriaTipoEstablecimiento[];
  onChangeCategorias: (next: CategoriaTipoEstablecimiento[]) => void;
  incluirNoContinuidad: boolean;
  onChangeIncluirNoContinuidad: (incluir: boolean) => void;
  conteosPorCategoria: Record<CategoriaTipoEstablecimiento, number>;
  conteoNoContinuidadDocentes: number;
  horasNoContinuidadDocentes: number;
  conteoNoContinuidadAsistentes?: number;
  horasNoContinuidadAsistentes?: number;
}

const OPCIONES_TIPO: Array<{
  id: CategoriaTipoEstablecimiento;
  label: string;
}> = [
  { id: 'ESCUELA', label: 'Escuelas' },
  { id: 'LICEO', label: 'Liceos' },
  { id: 'JARDIN_VTF', label: 'Jardines y Salas Cuna VTF' }
];

export const FiltroCarteraTerritorialBar: React.FC<FiltroCarteraTerritorialBarProps> = ({
  categoriasSeleccionadas,
  onChangeCategorias,
  incluirNoContinuidad,
  onChangeIncluirNoContinuidad,
  conteosPorCategoria,
  conteoNoContinuidadDocentes,
  horasNoContinuidadDocentes,
  conteoNoContinuidadAsistentes = 0,
  horasNoContinuidadAsistentes = 0
}) => {
  const toggleCategoria = (cat: CategoriaTipoEstablecimiento) => {
    if (categoriasSeleccionadas.includes(cat)) {
      // Evitar dejar 0 tipos seleccionados accidentalmente si es el último activo
      if (categoriasSeleccionadas.length === 1) return;
      onChangeCategorias(categoriasSeleccionadas.filter(c => c !== cat));
    } else {
      onChangeCategorias([...categoriasSeleccionadas, cat]);
    }
  };

  const esTodos =
    categoriasSeleccionadas.length === TODAS_LAS_CATEGORIAS_ESTABLECIMIENTO.length;
  const esSoloEscolares =
    categoriasSeleccionadas.length === 2 &&
    categoriasSeleccionadas.includes('ESCUELA') &&
    categoriasSeleccionadas.includes('LICEO') &&
    !categoriasSeleccionadas.includes('JARDIN_VTF');
  const esSoloVtf =
    categoriasSeleccionadas.length === 1 && categoriasSeleccionadas[0] === 'JARDIN_VTF';

  const totalNoContinuidadHrs = horasNoContinuidadDocentes + horasNoContinuidadAsistentes;
  const totalNoContinuidadPers = conteoNoContinuidadDocentes + conteoNoContinuidadAsistentes;

  return (
    <div className="bg-white dark:bg-slate-900/90 px-4 py-3 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
      {/* Selector múltiple de Tipos de Establecimiento */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mr-1">
          <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          Recintos en Totales:
        </span>

        {/* Atajos rápidos */}
        <div className="inline-flex p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 mr-1">
          <button
            type="button"
            onClick={() => onChangeCategorias(TODAS_LAS_CATEGORIAS_ESTABLECIMIENTO)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              esTodos
                ? 'bg-slate-800 dark:bg-slate-200 text-white dark:text-slate-900 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todos
          </button>
          <button
            type="button"
            onClick={() => onChangeCategorias(CATEGORIAS_ESCOLARES_SIN_VTF)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              esSoloEscolares
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Solo Escuelas y Liceos
          </button>
          <button
            type="button"
            onClick={() => onChangeCategorias(['JARDIN_VTF'])}
            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all ${
              esSoloVtf
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Solo Jardines VTF
          </button>
        </div>

        {/* Checkboxes individuales por tipo */}
        <div className="flex flex-wrap items-center gap-1.5">
          {OPCIONES_TIPO.map(op => {
            const activo = categoriasSeleccionadas.includes(op.id);
            const count = conteosPorCategoria[op.id] || 0;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => toggleCategoria(op.id)}
                aria-pressed={activo}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                  activo
                    ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 border-blue-300 dark:border-blue-700 shadow-xs'
                    : 'bg-slate-50 dark:bg-slate-800/60 text-slate-400 dark:text-slate-500 border-slate-200 dark:border-slate-700 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <span
                  className={`w-3.5 h-3.5 rounded flex items-center justify-center border ${
                    activo
                      ? 'bg-blue-600 border-blue-600 text-white'
                      : 'bg-white dark:bg-slate-900 border-slate-300 dark:border-slate-600'
                  }`}
                >
                  {activo && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                </span>
                <span>{op.label}</span>
                <span className="text-[10px] font-mono opacity-80">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Toggle de Proyección: Incluir o excluir "No Continuidad" */}
      <div className="flex items-center justify-between xl:justify-end gap-2 pt-2 xl:pt-0 border-t xl:border-t-0 border-slate-100 dark:border-slate-800">
        <label
          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold cursor-pointer select-none transition-all ${
            incluirNoContinuidad
              ? 'bg-amber-50/70 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700'
              : 'bg-emerald-50/70 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700'
          }`}
          title="Marca o desmarca si deseas sumar en los totales a los funcionarios marcados con propuesta GDP 'No Continuidad'."
        >
          <input
            type="checkbox"
            checked={incluirNoContinuidad}
            onChange={e => onChangeIncluirNoContinuidad(e.target.checked)}
            className="w-3.5 h-3.5 rounded accent-blue-600 cursor-pointer"
          />
          <UserMinus className="w-3.5 h-3.5 shrink-0" />
          <span>Incluir &quot;No Continuidad&quot;</span>
          <span className="px-1.5 py-0.5 rounded bg-white/80 dark:bg-slate-900/80 text-[10px] font-mono border border-current/20">
            {conteoNoContinuidadDocentes} doc ({horasNoContinuidadDocentes.toLocaleString('es-CL')}h)
            {totalNoContinuidadPers > conteoNoContinuidadDocentes
              ? ` • +${conteoNoContinuidadAsistentes} asist (${horasNoContinuidadAsistentes.toLocaleString('es-CL')}h)`
              : ''}
          </span>
        </label>
        {!incluirNoContinuidad && totalNoContinuidadHrs > 0 && (
          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 px-2 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <Filter className="w-3 h-3" />
            Excluidas -{totalNoContinuidadHrs.toLocaleString('es-CL')}h
          </span>
        )}
      </div>
    </div>
  );
};
