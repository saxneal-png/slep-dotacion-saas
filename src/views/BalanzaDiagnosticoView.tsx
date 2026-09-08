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
    <div className="space-y-6">
      {/* Encabezado y Resumen del Diagnóstico */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-orange-600 text-xs font-bold uppercase tracking-wider">
              Diagnóstico Integral de Dotación
            </span>
            <span className="text-slate-400">•</span>
            <span className="text-xs font-semibold text-slate-600">{est.comuna} (RBD {est.rbd})</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mt-0.5">
            Balanza Horaria y Proyección - {est.nombre}
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Cruce consolidado entre Demanda Curricular MINEDUC + Demanda PIE versus Disponibilidad Contractual Docente.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg border transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimir Informe</span>
          </button>

          <button
            onClick={onExportarExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Descargar Excel Oficial</span>
          </button>
        </div>
      </div>

      {/* Tarjetas KPI de la Balanza */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Demanda Curricular Aula */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Demanda Curricular Aulas</div>
          <div className="text-2xl font-black text-[#002B49] mt-1">
            {bg.horasAulaDemandadasCurriculo} <span className="text-xs font-bold text-slate-400">HA</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {bg.totalCursos} cursos ({bg.totalMatriculaProyectada} estudiantes proyectados)
          </div>
        </div>

        {/* Demanda PIE Decreto 170 */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Demanda PIE (Dec. 170)</div>
          <div className="text-2xl font-black text-orange-600 mt-1">
            {bg.horasPieDemandadas} <span className="text-xs font-bold text-slate-400">hrs</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            + {bg.horasColaborativasDemandadas}h obligatorias co-docencia (Art. 86)
          </div>
        </div>

        {/* Disponibilidad Horas Lectivas */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-slate-500 text-xs font-medium">Capacidad Aula Disponible</div>
          <div className="text-2xl font-black text-blue-600 mt-1">
            {bg.horasLectivasDisponibles} <span className="text-xs font-bold text-slate-400">HA máx</span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Contrato: {bg.horasContratadasTotales}h (Dir: {bg.horasDirectivasTotales || 0}h, Insp: {bg.horasInspectorGeneralTotales || 0}h, UTP: {bg.horasTecnicoPedagogicasTotales || 0}h, Coord: {bg.horasCoordinacionTotales || 0}h)
          </div>
        </div>

        {/* Superávit / Déficit */}
        <div className={`p-5 rounded-xl border shadow-sm ${
          esSuperavit ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'
        }`}>
          <div className={`text-xs font-bold ${esSuperavit ? 'text-emerald-800' : 'text-red-800'}`}>
            Balance General de Dotación
          </div>
          <div className={`text-2xl font-black mt-1 ${esSuperavit ? 'text-emerald-700' : 'text-red-700'}`}>
            {esSuperavit ? `+${bg.superavitDeficitLectivo}` : bg.superavitDeficitLectivo} <span className="text-xs font-bold">HA</span>
          </div>
          <div className={`text-[11px] font-semibold mt-1 ${esSuperavit ? 'text-emerald-700' : 'text-red-700'}`}>
            {esSuperavit ? '✓ Superávit de horas docentes' : '⚠️ Déficit de horas de aula'}
          </div>
        </div>
      </div>

      {/* Desglose de Horas Institucionales Fuera de Aula (Exentas de Proporción) */}
      <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="space-y-0.5">
          <div className="font-bold text-purple-900 flex items-center gap-1.5 text-sm">
            <span>Horas Institucionales Fuera de Aula: {(bg.horasDirectivasTotales || 0) + (bg.horasInspectorGeneralTotales || 0) + (bg.horasTecnicoPedagogicasTotales || 0) + (bg.horasCoordinacionTotales || 0)} hrs</span>
            <span className="text-[10px] bg-purple-200 text-purple-800 font-bold px-2 py-0.5 rounded-full">Exentas de Proporción Ley 20.903</span>
          </div>
          <p className="text-slate-600 text-[11px]">
            Las horas directivas (Dirección/Subdirección e Inspectoría General) y técnico-pedagógicas (Jefatura UTP y Coordinaciones CRA, Enlaces, Convivencia) son funciones institucionales que no se imparten frente a estudiantes, por lo que no llevan cálculo de proporción docente (65/35 o 60/40).
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-white px-3 py-2 rounded-lg border border-purple-200 text-center">
            <span className="text-[10px] text-slate-500 block">Dirección / Subdir.</span>
            <strong className="text-purple-900 font-bold text-sm">{bg.horasDirectivasTotales || 0}h</strong>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg border border-purple-200 text-center">
            <span className="text-[10px] text-slate-500 block">Inspectoría General</span>
            <strong className="text-purple-900 font-bold text-sm">{bg.horasInspectorGeneralTotales || 0}h</strong>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg border border-blue-200 text-center">
            <span className="text-[10px] text-slate-500 block">Jefatura UTP</span>
            <strong className="text-blue-900 font-bold text-sm">{bg.horasTecnicoPedagogicasTotales || 0}h</strong>
          </div>
          <div className="bg-white px-3 py-2 rounded-lg border border-blue-200 text-center">
            <span className="text-[10px] text-slate-500 block">Coordinaciones UTP</span>
            <strong className="text-blue-900 font-bold text-sm">{bg.horasCoordinacionTotales || 0}h</strong>
          </div>
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
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <Scale className="w-4 h-4 text-orange-600" />
            Balanza por Especialidad y Asignatura (Demanda vs. Asignación)
          </h3>
          <span className="text-xs text-slate-500">
            {espList.length} asignaturas evaluadas
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
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
