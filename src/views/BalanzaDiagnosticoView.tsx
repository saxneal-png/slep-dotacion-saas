import React from 'react';
import {
  Scale,
  CheckCircle2,
  AlertTriangle,
  FileSpreadsheet,
  BookOpen,
  LayoutGrid,
  ShieldCheck,
  HelpCircle
} from 'lucide-react';
import { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';
import { CursoSae, Docente, AsignacionHoraria, AsistenteEducacion, SalaInfraestructura } from '../types';
import { ProgresoDotacionBar } from '../components/ProgresoDotacionBar';

interface BalanzaDiagnosticoViewProps {
  diagnostico: DiagnosticoColegioCompleto | null;
  onExportarExcel: () => void;
  cursos?: CursoSae[];
  docentes?: Docente[];
  asignaciones?: AsignacionHoraria[];
  asistentes?: AsistenteEducacion[];
  salas?: SalaInfraestructura[];
  onSelectTab?: (tabId: 'cursos' | 'docentes' | 'asistentes' | 'balanza') => void;
}

export const BalanzaDiagnosticoView: React.FC<BalanzaDiagnosticoViewProps> = ({
  diagnostico,
  onExportarExcel,
  cursos = [],
  docentes = [],
  asignaciones = [],
  asistentes = [],
  salas = [],
  onSelectTab
}) => {
  if (!diagnostico) {
    return (
      <div className="p-8 text-center card-elevated text-slate-500 dark:text-slate-400">
        Selecciona un establecimiento en la barra superior para visualizar su diagnóstico.
      </div>
    );
  }

  const { balanzaGeneral: bg, diagnosticoPorEspecialidad: espList } = diagnostico;
  const balance = bg.superavitDeficitLectivo || 0;

  return (
    <div className="space-y-4">
      {/* 4 KPIs Ejecutivos del Establecimiento (Ubicación única en Balanza) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            balance > 0
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200'
              : balance < 0
              ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200'
              : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider opacity-75">Balanza de Aula</span>
            <Scale className="w-4 h-4 opacity-75" />
          </div>
          <div className="text-xl sm:text-2xl font-black mt-0.5 tabular-nums font-mono">
            {balance > 0 ? `+${balance} HA` : `${balance} HA`}
          </div>
          <div className="text-[11px] font-medium opacity-80 mt-0.5">
            {balance > 0
              ? 'Superávit disponible para refuerzo'
              : balance < 0
              ? 'Déficit docente por cubrir'
              : 'Dotación exactamente equilibrada'}
          </div>
        </div>

        <div className="card-elevated p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Demanda Curricular
            </span>
            <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums font-mono">
            {bg.horasAulaDemandadasCurriculo || 0} <span className="text-xs font-normal text-slate-400">HA</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {bg.totalCursos || cursos.length} cursos registrados
          </div>
        </div>

        <div className="card-elevated p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Matrícula vs SAE
            </span>
            <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums font-mono">
            {bg.totalMatriculaProyectada || 0}{' '}
            <span className="text-xs font-normal text-slate-400">/ {bg.totalCuposSae || 0} cupos</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            {salas.length > 0 ? `${salas.length} salas registradas` : 'Capacidad física SAE'}
          </div>
        </div>

        <div className="card-elevated p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Demanda PIE Dec. 170
            </span>
            <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums font-mono">
            {bg.horasPieDemandadas || 0} <span className="text-xs font-normal text-slate-400">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
            + {bg.horasColaborativasDemandadas || 0}h co-docencia obligatorias
          </div>
        </div>
      </div>

      {/* Flujo Guiado de 5 Pasos para Certificación Escolar (Solo dentro de Balanza) */}
      {onSelectTab && (
        <ProgresoDotacionBar
          cursos={cursos}
          docentes={docentes}
          asignaciones={asignaciones}
          asistentes={asistentes}
          balanceAula={balance}
          onSelectTab={onSelectTab}
          defaultCollapsed={false}
        />
      )}

      {/* Barra Compacta de Capacidad Contractual & Funciones Institucionales */}
      <div className="card-elevated px-4 py-3 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Scale className="w-4 h-4 text-orange-600 shrink-0" />
          <h3 className="text-xs sm:text-sm font-black text-slate-800 dark:text-white">
            Capacidad Contractual & Funciones Institucionales
          </h3>
          <span
            className="text-slate-400 hover:text-slate-600 cursor-help"
            title="Las horas directivas (Dirección/Subdirección e Inspectoría General) y técnico-pedagógicas (UTP y Coordinaciones) están exentas de proporción lectiva/no lectiva Ley 20.903."
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
            Aula Máx: {bg.horasLectivasDisponibles} HA
          </span>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            Contrato Total: {bg.horasContratadasTotales}h
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <div className="bg-purple-50/80 dark:bg-purple-950/30 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800/60 text-center">
            <span className="text-[10px] text-purple-700 dark:text-purple-300 mr-1.5">Dirección</span>
            <strong className="text-purple-900 dark:text-purple-200 font-mono font-bold text-xs tabular-nums">{bg.horasDirectivasTotales || 0}h</strong>
          </div>
          <div className="bg-purple-50/80 dark:bg-purple-950/30 px-2.5 py-1 rounded-lg border border-purple-200 dark:border-purple-800/60 text-center">
            <span className="text-[10px] text-purple-700 dark:text-purple-300 mr-1.5">Inspectoría</span>
            <strong className="text-purple-900 dark:text-purple-200 font-mono font-bold text-xs tabular-nums">{bg.horasInspectorGeneralTotales || 0}h</strong>
          </div>
          <div className="bg-blue-50/80 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800/60 text-center">
            <span className="text-[10px] text-blue-700 dark:text-blue-300 mr-1.5">UTP</span>
            <strong className="text-blue-900 dark:text-blue-200 font-mono font-bold text-xs tabular-nums">{bg.horasTecnicoPedagogicasTotales || 0}h</strong>
          </div>
          <div className="bg-blue-50/80 dark:bg-blue-950/30 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800/60 text-center">
            <span className="text-[10px] text-blue-700 dark:text-blue-300 mr-1.5">Coord.</span>
            <strong className="text-blue-900 dark:text-blue-200 font-mono font-bold text-xs tabular-nums">{bg.horasCoordinacionTotales || 0}h</strong>
          </div>

          <button
            onClick={onExportarExcel}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar Excel</span>
          </button>
        </div>
      </div>

      {/* Alertas Críticas (Jidoka: solo visibles cuando hay anomalía real) */}
      {(bg.sobreasignacionesAlertas.length > 0 || bg.alertasInfraestructura.length > 0 || bg.alertasAforoPie.length > 0) && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-xs text-amber-900 dark:text-amber-200 space-y-1.5">
          <h4 className="font-bold flex items-center gap-1.5 text-amber-800 dark:text-amber-300 text-xs sm:text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Alertas de Cumplimiento Normativo & Inconsistencias Detectadas
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {bg.sobreasignacionesAlertas.map((al, idx) => (
              <li key={`sobre-${idx}`} className="font-medium text-red-700 dark:text-red-300">{al}</li>
            ))}
            {bg.alertasInfraestructura.map((al, idx) => (
              <li key={`infra-${idx}`}>{al}</li>
            ))}
            {bg.alertasAforoPie.map((al, idx) => (
              <li key={`pie-${idx}`}>{al}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Desglose de Balanza por Especialidad / Subsector */}
      <div className="card-elevated overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-orange-600" />
            Balanza por Especialidad y Asignatura (Demanda vs. Asignación)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
            {espList.length} asignaturas
          </span>
        </div>

        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-left text-xs text-slate-600 dark:text-slate-300">
            <thead className="sticky top-0 z-10 bg-slate-50/95 dark:bg-slate-800/95 backdrop-blur-xs text-slate-700 dark:text-slate-200 uppercase font-semibold text-[11px] border-b dark:border-slate-700">
              <tr>
                <th className="px-4 py-2.5">Especialidad / Asignatura</th>
                <th className="px-4 py-2.5 text-center">Horas Demandadas</th>
                <th className="px-4 py-2.5 text-center">Horas Cubiertas</th>
                <th className="px-4 py-2.5 text-center">Balance Horario</th>
                <th className="px-4 py-2.5">Docentes Asignados</th>
                <th className="px-4 py-2.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {espList.map((esp, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="px-4 py-2.5 font-bold text-slate-800 dark:text-white">
                    {esp.asignatura}
                  </td>

                  <td className="px-4 py-2.5 text-center font-medium tabular-nums">
                    {esp.horasDemandadas} HA
                  </td>

                  <td className="px-4 py-2.5 text-center font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                    {esp.horasAsignadas} HA
                  </td>

                  <td
                    className={`px-4 py-2.5 text-center font-bold tabular-nums ${
                      esp.balance < 0 ? 'text-red-600 dark:text-red-400' : esp.balance > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {esp.balance > 0 ? `+${esp.balance}` : esp.balance} HA
                  </td>

                  <td className="px-4 py-2.5 text-slate-600 dark:text-slate-300">
                    {esp.docentesAsignados.length > 0 ? (
                      <span className="text-[11px] font-medium">{esp.docentesAsignados.join(', ')}</span>
                    ) : (
                      <span className="text-slate-400 italic">Sin docentes asignados</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-center">
                    {esp.balance < 0 ? (
                      <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">
                        Déficit ({Math.abs(esp.balance)}h faltantes)
                      </span>
                    ) : esp.balance > 0 ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                        Superávit (+{esp.balance}h)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-slate-700 font-semibold bg-slate-100 px-2 py-0.5 rounded text-[10px]">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        Cuadrado (100%)
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
