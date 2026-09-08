import React from 'react';
import { School, Users, GraduationCap, Clock, BookOpen, ShieldAlert, CheckCircle2, Award, Layers } from 'lucide-react';
import type { KpiStats } from '../../types/analizadorTypes';

interface KpiCardsProps {
  kpis: KpiStats;
}

export const KpiCards: React.FC<KpiCardsProps> = ({ kpis }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {/* 1. Colegios */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Escuelas</span>
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
            <School className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{kpis.total_schools}</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">
            {kpis.total_comunas ? `${kpis.total_comunas} comunas territoriales` : 'Establecimientos analizados'}
          </div>
        </div>
      </div>

      {/* 2. Docentes */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Docentes</span>
          <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600">
            <Users className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{kpis.total_teachers}</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Profesores únicos</div>
        </div>
      </div>

      {/* 3. Cursos Detectados */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cursos</span>
          <div className="p-1.5 rounded-lg bg-orange-50 text-orange-600">
            <Layers className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">{kpis.total_courses || 0}</div>
          <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Cursos identificados</div>
        </div>
      </div>

      {/* 4. Horas Aula */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Horas Aula</span>
          <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600">
            <BookOpen className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {kpis.total_horas_aula.toFixed(1)}h
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            {kpis.pct_aula}% del total EE
          </div>
        </div>
      </div>

      {/* 5. Horas Técnicas */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Técnicas</span>
          <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600">
            <Award className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-emerald-600 tracking-tight">
            {kpis.total_horas_tecnicas.toFixed(1)}h
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            {kpis.pct_tecnicas}% (UTP / CRA / SEP)
          </div>
        </div>
      </div>

      {/* 6. Horas Directivas */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div className="flex items-center justify-between text-slate-500 mb-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Directivas</span>
          <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600">
            <Clock className="w-4 h-4" />
          </div>
        </div>
        <div>
          <div className="text-2xl font-black text-purple-600 tracking-tight">
            {kpis.total_horas_directivas.toFixed(1)}h
          </div>
          <div className="text-[10px] text-slate-500 font-bold mt-0.5">
            {kpis.pct_directivas}% (Directores / Inspectores)
          </div>
        </div>
      </div>
    </div>
  );
};
