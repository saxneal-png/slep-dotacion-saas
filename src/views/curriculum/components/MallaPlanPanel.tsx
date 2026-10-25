import React from 'react';
import { BookOpen, ExternalLink, Sparkles } from 'lucide-react';
import { PlanEstudioNivel } from '@slep/mineduc-engine';

interface MallaPlanPanelProps {
  planActivo: PlanEstudioNivel | null;
  onGestionarPlanes?: () => void;
}

export const MallaPlanPanel: React.FC<MallaPlanPanelProps> = ({ planActivo, onGestionarPlanes }) => {
  if (!planActivo) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs space-y-3">
        <p>No se encontró un plan de estudio oficial para este nivel.</p>
        {onGestionarPlanes && (
          <button
            type="button"
            onClick={onGestionarPlanes}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Crear / Asignar Plan Personalizado</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-center justify-between pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">
            Plan Oficial: <strong className="text-slate-900">{planActivo.nivel}</strong>
          </span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
            {planActivo.regimen} • Total: {planActivo.totalHorasPlan} HA
          </span>
        </div>

        {onGestionarPlanes && (
          <button
            type="button"
            onClick={onGestionarPlanes}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 rounded-md text-xs font-bold transition-colors shadow-xs"
            title="Ir al módulo de Planes de Estudio para duplicar o personalizar las horas y asignaturas"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Personalizar / Editar Plan</span>
            <ExternalLink className="w-3 h-3 text-orange-500 ml-0.5" />
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b">
            <tr>
              <th className="px-4 py-2.5">Subsector / Asignatura Oficial MINEDUC</th>
              <th className="px-4 py-2.5 text-center">Horas Semanales Sugeridas (HA)</th>
              <th className="px-4 py-2.5 text-center">Minutos Cronológicos</th>
              <th className="px-4 py-2.5 text-right">% del Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {planActivo.asignaturasBase.map((asig, idx) => {
              const mins = asig.horasSugeridas * 45;
              const pct = Math.round((asig.horasSugeridas / planActivo.totalHorasPlan) * 100);

              return (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="px-4 py-2.5 font-medium text-slate-800 flex items-center gap-2">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    {asig.nombre}
                  </td>
                  <td className="px-4 py-2.5 text-center font-bold text-slate-700">
                    {asig.horasSugeridas} HA
                  </td>
                  <td className="px-4 py-2.5 text-center text-slate-500">
                    {Math.floor(mins / 60)}h {mins % 60}m
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold text-slate-600">
                    {pct}%
                  </td>
                </tr>
              );
            })}

            {planActivo.horasLibreDisposicion > 0 && (
              <tr className="bg-amber-50/60 font-semibold text-amber-900">
                <td className="px-4 py-2.5">Horas de Libre Disposición (Proyecto Educativo Institucional)</td>
                <td className="px-4 py-2.5 text-center font-bold">{planActivo.horasLibreDisposicion} HA</td>
                <td className="px-4 py-2.5 text-center">
                  {Math.floor(planActivo.horasLibreDisposicion * 45 / 60)}h {(planActivo.horasLibreDisposicion * 45) % 60}m
                </td>
                <td className="px-4 py-2.5 text-right">
                  {Math.round((planActivo.horasLibreDisposicion / planActivo.totalHorasPlan) * 100)}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
