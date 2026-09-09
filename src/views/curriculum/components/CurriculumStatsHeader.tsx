import React from 'react';
import { BookOpen, Layers, Clock, ShieldCheck, Sparkles, BookCheck, AlertCircle } from 'lucide-react';

interface CurriculumStatsHeaderProps {
  totalCursos: number;
  totalHorasDemanda: number;
  totalHorasAsignadasDocencia: number;
  totalHorasPie: number;
  totalHorasCoDocencia: number;
  onAutoAsignarPie?: () => void;
  coberturaGlobalPct: number;
}

export const CurriculumStatsHeader: React.FC<CurriculumStatsHeaderProps> = ({
  totalCursos,
  totalHorasDemanda,
  totalHorasAsignadasDocencia,
  totalHorasPie,
  totalHorasCoDocencia,
  onAutoAsignarPie,
  coberturaGlobalPct
}) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-orange-600">
          <BookOpen className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{totalCursos}</div>
          <div className="text-xs text-slate-500 font-medium">Cursos Activos</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
          <Clock className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">{totalHorasDemanda} <span className="text-xs font-normal text-slate-400">HA</span></div>
          <div className="text-xs text-slate-500 font-medium">Demanda Curricular Total</div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
          <BookCheck className="w-5 h-5" />
        </div>
        <div>
          <div className="text-2xl font-bold text-slate-800">
            {totalHorasAsignadasDocencia} <span className="text-xs font-normal text-slate-400">/ {totalHorasDemanda}</span>
          </div>
          <div className="text-xs text-slate-500 font-medium flex items-center gap-1.5">
            <span>Docencia Asignada ({coberturaGlobalPct}%)</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="flex-1">
          <div className="text-2xl font-bold text-slate-800">{totalHorasPie} <span className="text-xs font-normal text-slate-400">hrs</span></div>
          <div className="text-xs text-slate-500 font-medium">Apoyos PIE (Dec. 170)</div>
        </div>
      </div>
    </div>
  );
};
