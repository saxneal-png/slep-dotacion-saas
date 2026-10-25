import React from 'react';
import {
  BookOpen, Users, Layers, Scale, CheckCircle2, AlertTriangle, ChevronRight, HelpCircle
} from 'lucide-react';
import { CursoSae, Docente, AsignacionHoraria, AsistenteEducacion } from '../types';

export interface ProgresoDotacionBarProps {
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  asistentes?: AsistenteEducacion[];
  balanceAula: number;
  onSelectTab: (tabId: 'cursos' | 'docentes' | 'asistentes' | 'balanza') => void;
}

export const ProgresoDotacionBar: React.FC<ProgresoDotacionBarProps> = ({
  cursos,
  docentes,
  asignaciones,
  asistentes = [],
  balanceAula,
  onSelectTab
}) => {
  // 1. Cursos
  const tieneCursos = cursos.length > 0;
  const matriculaTotal = cursos.reduce((s, c) => s + (c.matriculaProyectada || 0), 0);

  // 2. Docentes
  const tieneDocentes = docentes.length > 0;
  const horasContratoTotal = docentes.reduce((s, d) => s + (d.horasContrato || 0), 0);

  // 3. Asignaciones de Aula
  const tieneAsignaciones = asignaciones.length > 0;
  const horasAulaTotal = asignaciones.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

  // 4. Asistentes
  const tieneAsistentes = asistentes.length > 0;
  const asistentesSinRun = asistentes.filter(a => !a.run || a.run === 'Sin RUN' || a.run.trim() === '').length;

  // 5. Balanza
  const balanzaEquilibrada = Math.abs(balanceAula) <= 2;

  // Cálculo de Porcentaje Global de Avance (0 a 100%)
  const checks = [
    tieneCursos ? 20 : 0,
    tieneDocentes ? 20 : 0,
    tieneAsignaciones ? 20 : 0,
    tieneAsistentes && asistentesSinRun === 0 ? 20 : (tieneAsistentes ? 10 : 0),
    balanzaEquilibrada ? 20 : (balanceAula > 0 ? 15 : 10)
  ];
  const porcentajeTotal = checks.reduce((a, b) => a + b, 0);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-3.5 shadow-xs space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            Flujo Guiado de Dotación Escolar
          </span>
          <span className="text-[11px] text-slate-400 font-medium">
            (Paso 1 al 5 para certificar la dotación del establecimiento)
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-semibold">Avance General:</span>
          <div className="w-28 bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                porcentajeTotal === 100 ? 'bg-emerald-500' : 'bg-gradient-to-r from-orange-500 to-indigo-500'
              }`}
              style={{ width: `${porcentajeTotal}%` }}
            />
          </div>
          <span className={`font-mono font-bold text-xs ${porcentajeTotal === 100 ? 'text-emerald-600' : 'text-slate-800 dark:text-white'}`}>
            {porcentajeTotal}%
          </span>
        </div>
      </div>

      {/* Tarjetas de Pasos Interactivos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 text-xs">
        {/* Paso 1: Cursos SAE */}
        <button
          type="button"
          onClick={() => onSelectTab('cursos')}
          className={`p-2 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
            tieneCursos
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
              : 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 ring-1 ring-amber-400'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">1. Cursos SAE</span>
            {tieneCursos ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
          </div>
          <div className="mt-1 font-extrabold text-xs">
            {tieneCursos ? `${cursos.length} cursos (${matriculaTotal} mat.)` : 'Faltan cursos'}
          </div>
        </button>

        {/* Paso 2: Planta Docente */}
        <button
          type="button"
          onClick={() => onSelectTab('docentes')}
          className={`p-2 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
            tieneDocentes
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">2. Planta Docente</span>
            {tieneDocentes ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />}
          </div>
          <div className="mt-1 font-extrabold text-xs">
            {tieneDocentes ? `${docentes.length} doc. (${horasContratoTotal}h)` : 'Ingresar docentes'}
          </div>
        </button>

        {/* Paso 3: Asignación de Aula & Planes */}
        <button
          type="button"
          onClick={() => onSelectTab('docentes')}
          className={`p-2 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
            tieneAsignaciones
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">3. Carga Lectiva</span>
            {tieneAsignaciones ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />}
          </div>
          <div className="mt-1 font-extrabold text-xs">
            {tieneAsignaciones ? `${horasAulaTotal} HA asignadas` : 'Asignar asignaturas'}
          </div>
        </button>

        {/* Paso 4: Asistentes de la Educación */}
        <button
          type="button"
          onClick={() => onSelectTab('asistentes')}
          className={`p-2 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
            tieneAsistentes && asistentesSinRun === 0
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
              : asistentesSinRun > 0
                ? 'bg-amber-50/60 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">4. Asistentes</span>
            {tieneAsistentes && asistentesSinRun === 0 ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
            )}
          </div>
          <div className="mt-1 font-extrabold text-xs">
            {tieneAsistentes ? `${asistentes.length} asistentes ${asistentesSinRun > 0 ? `(${asistentesSinRun} sin RUN)` : ''}` : 'Ingresar asistentes'}
          </div>
        </button>

        {/* Paso 5: Balanza Diagnóstica */}
        <button
          type="button"
          onClick={() => onSelectTab('balanza')}
          className={`p-2 rounded-xl border text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex flex-col justify-between ${
            balanzaEquilibrada
              ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 text-emerald-950 dark:text-emerald-200'
              : balanceAula > 0
                ? 'bg-blue-50/60 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-950 dark:text-blue-200'
                : 'bg-rose-50/60 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800 text-rose-950 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wide opacity-75">5. Balanza de Aula</span>
            <Scale className="w-3.5 h-3.5" />
          </div>
          <div className="mt-1 font-extrabold text-xs">
            {balanceAula > 0 ? `+${balanceAula} HA (Holgura)` : balanceAula < 0 ? `${balanceAula} HA (Déficit)` : 'Equilibrio 0 HA'}
          </div>
        </button>
      </div>
    </div>
  );
};
