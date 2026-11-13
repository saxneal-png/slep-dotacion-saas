import React from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { PlanEstudioNivel } from '@slep/mineduc-engine';
import { InfoPlanResuelto } from '../../../services/curricularPlanService';

interface MallaPlanPanelProps {
  planActivo: PlanEstudioNivel | null;
  infoPlanActual?: InfoPlanResuelto | null;
  onGestionarPlanes?: () => void;
  onPersonalizarPlanColegio?: () => void;
}

export const MallaPlanPanel: React.FC<MallaPlanPanelProps> = ({
  planActivo,
  infoPlanActual,
  onPersonalizarPlanColegio
}) => {
  const asignaturasAMostrar = infoPlanActual?.asignaturas?.length
    ? infoPlanActual.asignaturas.map(a => ({ nombre: a.nombre, horasSugeridas: a.horas }))
    : (planActivo?.asignaturasBase || []);
  const horasLibre = infoPlanActual ? infoPlanActual.horasLibreDisposicion : (planActivo?.horasLibreDisposicion || 0);
  const totalHoras = infoPlanActual?.totalHorasPlan || planActivo?.totalHorasPlan || asignaturasAMostrar.reduce((s, a) => s + a.horasSugeridas, 0) + horasLibre;
  const esPersonalizado = Boolean(infoPlanActual?.esPersonalizadoBd);

  if (!planActivo && asignaturasAMostrar.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400 text-xs space-y-3">
        <p>No se encontró un plan de estudio oficial para este nivel.</p>
        {onPersonalizarPlanColegio && (
          <button
            type="button"
            onClick={onPersonalizarPlanColegio}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 text-white rounded-lg text-xs font-bold hover:bg-orange-700 shadow-xs"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Personalizar Plan del Establecimiento</span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-2">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-slate-700">
            {esPersonalizado ? 'Plan Personalizado Escuela:' : 'Plan Oficial:'}{' '}
            <strong className="text-slate-900">{infoPlanActual?.nombrePlan || planActivo?.nivel}</strong>
          </span>
          <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
            {infoPlanActual?.esJec ? 'JEC' : (planActivo?.regimen || 'No JEC')} • Total: {totalHoras} HA
          </span>
          {esPersonalizado && (
            <span className="text-[10px] bg-orange-100 text-orange-800 border border-orange-200 px-2 py-0.5 rounded font-bold">
              Exclusivo Establecimiento
            </span>
          )}
        </div>

        {onPersonalizarPlanColegio && (
          <button
            type="button"
            onClick={onPersonalizarPlanColegio}
            className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 hover:bg-orange-100 text-orange-800 border border-orange-300 rounded-md text-xs font-bold transition-colors shadow-xs"
            title="Crear asignaturas o ajustar horas exclusivamente para este establecimiento sin afectar la base general MINEDUC"
          >
            <Sparkles className="w-3.5 h-3.5 text-orange-600" />
            <span>Personalizar Plan de la Escuela</span>
          </button>
        )}
      </div>

      <div className="overflow-x-auto border border-slate-200 rounded-xl">
        <table className="w-full text-left text-xs text-slate-600">
          <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b">
            <tr>
              <th className="px-4 py-2.5">Subsector / Asignatura</th>
              <th className="px-4 py-2.5 text-center">Horas Semanales (HA)</th>
              <th className="px-4 py-2.5 text-center">Minutos Cronológicos</th>
              <th className="px-4 py-2.5 text-right">% del Plan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {asignaturasAMostrar.map((asig, idx) => {
              const mins = asig.horasSugeridas * 45;
              const pct = totalHoras > 0 ? Math.round((asig.horasSugeridas / totalHoras) * 100) : 0;

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

            {horasLibre > 0 && (
              <tr className="bg-amber-50/60 font-semibold text-amber-900">
                <td className="px-4 py-2.5">Horas de Libre Disposición (Proyecto Educativo Institucional)</td>
                <td className="px-4 py-2.5 text-center font-bold">{horasLibre} HA</td>
                <td className="px-4 py-2.5 text-center">
                  {Math.floor(horasLibre * 45 / 60)}h {(horasLibre * 45) % 60}m
                </td>
                <td className="px-4 py-2.5 text-right">
                  {totalHoras > 0 ? Math.round((horasLibre / totalHoras) * 100) : 0}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
