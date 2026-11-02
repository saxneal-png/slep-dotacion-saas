import React from 'react';
import { Scale, CheckCircle2, AlertTriangle, FileSpreadsheet, Printer } from 'lucide-react';
import { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';

interface BalanzaDiagnosticoViewProps {
  diagnostico: DiagnosticoColegioCompleto | null;
  onExportarExcel: () => void;
}

export const BalanzaDiagnosticoView: React.FC<BalanzaDiagnosticoViewProps> = ({
  diagnostico,
  onExportarExcel
}) => {
  if (!diagnostico) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        Selecciona un establecimiento en la barra superior para visualizar su diagnóstico.
      </div>
    );
  }

  const { establecimiento: est, balanzaGeneral: bg, diagnosticoPorEspecialidad: espList } = diagnostico;
  const esSuperavit = bg.superavitDeficitLectivo >= 0;

  return (
    <div className="space-y-4">
      {/* Barra de Resumen de Capacidad y Horas Institucionales Fuera de Aula */}
      <div className="card-elevated p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <Scale className="w-4 h-4 text-orange-600" />
            <h3 className="text-sm font-black text-slate-800 dark:text-white">
              Diagnóstico de Capacidad Contractual & Funciones Institucionales
            </h3>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-blue-50 text-blue-800 border border-blue-200">
              Capacidad Aula Máx: {bg.horasLectivasDisponibles} HA
            </span>
            <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded-lg bg-slate-100 text-slate-700">
              Contrato Total: {bg.horasContratadasTotales}h
            </span>
          </div>
          <p className="text-[11px] text-slate-500">
            Las horas directivas (Dirección/Subdirección e Inspectoría General) y técnico-pedagógicas (UTP y Coordinaciones) están exentas de proporción lectiva/no lectiva Ley 20.903.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="bg-purple-50/80 px-2.5 py-1.5 rounded-lg border border-purple-200 text-center">
            <span className="text-[10px] text-purple-700 block">Dirección</span>
            <strong className="text-purple-900 font-mono font-bold text-xs">{bg.horasDirectivasTotales || 0}h</strong>
          </div>
          <div className="bg-purple-50/80 px-2.5 py-1.5 rounded-lg border border-purple-200 text-center">
            <span className="text-[10px] text-purple-700 block">Inspectoría</span>
            <strong className="text-purple-900 font-mono font-bold text-xs">{bg.horasInspectorGeneralTotales || 0}h</strong>
          </div>
          <div className="bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-200 text-center">
            <span className="text-[10px] text-blue-700 block">Jefatura UTP</span>
            <strong className="text-blue-900 font-mono font-bold text-xs">{bg.horasTecnicoPedagogicasTotales || 0}h</strong>
          </div>
          <div className="bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-200 text-center">
            <span className="text-[10px] text-blue-700 block">Coord. UTP</span>
            <strong className="text-blue-900 font-mono font-bold text-xs">{bg.horasCoordinacionTotales || 0}h</strong>
          </div>

          <button
            onClick={onExportarExcel}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exportar Diagnóstico</span>
          </button>
        </div>
      </div>

      {/* Alertas Críticas (Sobreasignación, Infraestructura, PIE) */}
      {(bg.sobreasignacionesAlertas.length > 0 || bg.alertasInfraestructura.length > 0 || bg.alertasAforoPie.length > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-xs text-amber-900 space-y-2">
          <h4 className="font-bold flex items-center gap-1.5 text-amber-800 text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            Alertas de Cumplimiento Normativo & Inconsistencias Detectadas
          </h4>
          <ul className="list-disc pl-5 space-y-1">
            {bg.sobreasignacionesAlertas.map((al, idx) => (
              <li key={`sobre-${idx}`} className="font-medium text-red-700">{al}</li>
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
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-orange-600" />
            Balanza por Especialidad y Asignatura (Demanda vs. Asignación)
          </h3>
          <span className="text-xs text-slate-500">
            {espList.length} asignaturas evaluadas
          </span>
        </div>

        <div className="overflow-x-auto max-h-[65vh]">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-slate-700 uppercase font-semibold text-[11px] border-b">
              <tr>
                <th className="px-4 py-3">Especialidad / Asignatura</th>
                <th className="px-4 py-3 text-center">Horas Demandadas</th>
                <th className="px-4 py-3 text-center">Horas Cubiertas</th>
                <th className="px-4 py-3 text-center">Balance Horario</th>
                <th className="px-4 py-3">Docentes Asignados</th>
                <th className="px-4 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {espList.map((esp, idx) => (
                <tr key={idx} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-bold text-slate-800">
                    {esp.asignatura}
                  </td>

                  <td className="px-4 py-3 text-center font-medium">
                    {esp.horasDemandadas} HA
                  </td>

                  <td className="px-4 py-3 text-center font-bold text-slate-800">
                    {esp.horasAsignadas} HA
                  </td>

                  <td className={`px-4 py-3 text-center font-bold ${
                    esp.balance < 0 ? 'text-red-600' : esp.balance > 0 ? 'text-emerald-600' : 'text-slate-600'
                  }`}>
                    {esp.balance > 0 ? `+${esp.balance}` : esp.balance} HA
                  </td>

                  <td className="px-4 py-3 text-slate-600">
                    {esp.docentesAsignados.length > 0 ? (
                      <span className="text-[11px] font-medium">{esp.docentesAsignados.join(', ')}</span>
                    ) : (
                      <span className="text-slate-400 italic">Sin docentes asignados</span>
                    )}
                  </td>

                  <td className="px-4 py-3 text-center">
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
