import React, { useState, useMemo } from 'react';
import { 
  Layers, 
  ShieldAlert, 
  FileUp, 
  FileSpreadsheet, 
  MapPin, 
  CheckCircle, 
  CheckCircle2,
  ArrowRightLeft, 
  School,
  Users,
  Search,
  Building2,
  Coins,
  Scale,
  Eye,
  AlertTriangle,
  GraduationCap
} from 'lucide-react';
import { 
  Establecimiento, 
  Docente, 
  AsignacionHoraria, 
  InconsistenciaTerritorial,
  DocenteConsolidadoTerritorial 
} from '../types';
import { 
  DiagnosticoColegioCompleto, 
  consolidarCarteraTerritorial,
  obtenerDocentesConsolidadosTerritorio
} from '../services/dotacionCalculationService';
import { DocenteFichaDetalleModal } from '../components/DocenteFichaDetalleModal';

interface ConsolidadorMasterViewProps {
  establecimientos: Establecimiento[];
  docentes: Docente[];
  diagnosticos: DiagnosticoColegioCompleto[];
  asignaciones?: AsignacionHoraria[];
  onImportarCarteraSlep: (file: File) => void;
  onExportarExcel: () => void;
}

export const ConsolidadorMasterView: React.FC<ConsolidadorMasterViewProps> = ({
  establecimientos,
  docentes,
  diagnosticos,
  asignaciones = [],
  onImportarCarteraSlep,
  onExportarExcel
}) => {
  const [tabActiva, setTabActiva] = useState<'balance' | 'docentes'>('balance');
  const [filtroDocentes, setFiltroDocentes] = useState('');
  const [docenteFicha, setDocenteFicha] = useState<DocenteConsolidadoTerritorial | null>(null);

  const consolidacion = consolidarCarteraTerritorial(establecimientos, docentes, diagnosticos);
  const { inconsistencias, resumenPorComuna, vacantesCruzadas } = consolidacion;

  const totalColegios = establecimientos.length;
  const totalMatriculaTerritorial = diagnosticos.reduce((s, d) => s + d.balanzaGeneral.totalMatriculaProyectada, 0);
  const totalCuposSaeTerritorial = diagnosticos.reduce((s, d) => s + d.balanzaGeneral.totalCuposSae, 0);
  const totalHorasDemandadas = diagnosticos.reduce((s, d) => s + d.balanzaGeneral.horasAulaDemandadasCurriculo, 0);
  const totalHorasDisponibles = diagnosticos.reduce((s, d) => s + d.balanzaGeneral.horasLectivasDisponibles, 0);
  const balanceGlobal = totalHorasDisponibles - totalHorasDemandadas;

  // Nómina Territorial Consolidada de Docentes por RUN
  const docentesConsolidados = useMemo(() => {
    return obtenerDocentesConsolidadosTerritorio(establecimientos, docentes, asignaciones);
  }, [establecimientos, docentes, asignaciones]);

  const docentesMultiEscuelaCount = docentesConsolidados.filter(d => d.contratos.length > 1).length;
  const docentesExceso44hCount = docentesConsolidados.filter(d => d.excedeLimiteSlep).length;

  const totalSubvTitSlep = docentesConsolidados.reduce((s, d) => s + (d.resumenFinanciamiento.subvencionGeneralTitular || 0), 0);
  const totalSubvConSlep = docentesConsolidados.reduce((s, d) => s + (d.resumenFinanciamiento.subvencionGeneralContrata || 0), 0);
  const totalSepTitSlep = docentesConsolidados.reduce((s, d) => s + (d.resumenFinanciamiento.sepTitular || 0), 0);
  const totalSepConSlep = docentesConsolidados.reduce((s, d) => s + (d.resumenFinanciamiento.sepContrata || 0), 0);
  const totalPieTitSlep = docentesConsolidados.reduce((s, d) => s + (d.resumenFinanciamiento.pieTitular || 0), 0);
  const totalPieConSlep = docentesConsolidados.reduce((s, d) => s + (d.resumenFinanciamiento.pieContrata || 0), 0);
  const totalHorasTerritorioSlep = docentesConsolidados.reduce((s, d) => s + d.horasTotalesSlep, 0);

  const docentesFiltrados = useMemo(() => {
    const q = filtroDocentes.toLowerCase().trim();
    if (!q) return docentesConsolidados;
    return docentesConsolidados.filter(d => 
      d.nombres.toLowerCase().includes(q) ||
      d.apellidos.toLowerCase().includes(q) ||
      d.run.toLowerCase().includes(q) ||
      d.colegiosNombres.some(cn => cn.toLowerCase().includes(q))
    );
  }, [docentesConsolidados, filtroDocentes]);

  return (
    <div className="space-y-6">
      {/* Banner Superior Consolidador Master */}
      <div className="bg-[#002B49] text-white p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-600/30 border border-orange-500/40 text-orange-400 text-[11px] font-bold">
              <Layers className="w-3.5 h-3.5" />
              Consolidador Territorial de Dotación Docente
            </div>
            <h2 className="text-xl font-bold text-white mt-2">
              Matriz Única Territorial - SLEP Valle Diguillín
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Agrupa y audita los levantamientos de los asesores UATP de Bulnes, Chillán Viejo, El Carmen,
              Pemuco, San Ignacio y Yungay. Fiscaliza la asignación en múltiples escuelas, fuentes de financiamiento y topes legales de 44 hrs.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg cursor-pointer transition-colors border border-slate-600">
              <FileUp className="w-4 h-4 text-orange-400" />
              <span>Ingestar Asesores (.slep)</span>
              <input
                type="file"
                multiple
                accept=".slep,.json"
                className="hidden"
                onChange={async e => {
                  const files = e.target.files;
                  if (files && files.length > 0) {
                    for (let i = 0; i < files.length; i++) {
                      await onImportarCarteraSlep(files[i]);
                    }
                  }
                }}
              />
            </label>

            <button
              onClick={onExportarExcel}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow transition-colors"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Exportar Matriz Global Excel</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selector de Pestañas del Consolidador */}
      <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setTabActiva('balance')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'balance'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>Balance Territorial & Inconsistencias</span>
          {inconsistencias.length > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1">
              {inconsistencias.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setTabActiva('docentes')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            tabActiva === 'docentes'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Nómina Territorial & Multi-Contratos</span>
          <span className="bg-slate-100 text-slate-700 text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 border">
            {docentesConsolidados.length} docentes
          </span>
          {docentesExceso44hCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold ml-1 animate-pulse">
              {docentesExceso44hCount} &gt;44h
            </span>
          )}
        </button>
      </div>

      {/* VISTA 1: BALANCE TERRITORIAL & INCONSISTENCIAS */}
      {tabActiva === 'balance' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Tarjetas KPI Consolidadas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Establecimientos en Cartera</div>
              <div className="text-2xl font-black text-[#002B49] mt-1">{totalColegios} colegios</div>
              <div className="text-[11px] text-slate-500 mt-1">
                En 6 comunas de Valle Diguillín
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Matrícula vs. Cupos SAE</div>
              <div className="text-2xl font-black text-slate-800 mt-1">
                {totalMatriculaTerritorial} <span className="text-xs font-normal text-slate-500">/ {totalCuposSaeTerritorial} SAE</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Ocupación: {totalCuposSaeTerritorial > 0 ? Math.round((totalMatriculaTerritorial / totalCuposSaeTerritorial) * 100) : 0}%
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Demanda Total Curricular</div>
              <div className="text-2xl font-black text-orange-600 mt-1">
                {totalHorasDemandadas} <span className="text-xs font-bold text-slate-400">HA/sem</span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Planes de estudio MINEDUC consolidados
              </div>
            </div>

            <div className={`p-5 rounded-xl border shadow-sm ${
              balanceGlobal >= 0 ? 'bg-emerald-50/70 border-emerald-200' : 'bg-red-50/70 border-red-200'
            }`}>
              <div className={`text-xs font-bold ${balanceGlobal >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                Balance Territorial Global
              </div>
              <div className={`text-2xl font-black mt-1 ${balanceGlobal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {balanceGlobal >= 0 ? `+${balanceGlobal}` : balanceGlobal} <span className="text-xs font-bold">HA</span>
              </div>
              <div className={`text-[11px] font-semibold mt-1 ${balanceGlobal >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {balanceGlobal >= 0 ? '✓ Cobertura territorial completa' : '⚠️ Déficit neto a nivel SLEP'}
              </div>
            </div>
          </div>

          {/* Sección Inconsistencias Cruzadas (RUT Duplicado / Sobrecarga) */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                Auditoría de Inconsistencias Territoriales y Sobrecarga Cruzada (&gt;44h)
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border">
                {inconsistencias.length} caso(s) detectado(s)
              </span>
            </div>

            {inconsistencias.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
                <span>No se detectaron RUTs duplicados con sobrecarga horaria ni inconsistencias cruzadas entre los colegios.</span>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {inconsistencias.map((inc, idx) => (
                  <div key={idx} className="p-4 hover:bg-slate-50 text-xs flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          inc.tipo === 'EXCESO_JORNADA_GLOBAL'
                            ? 'bg-red-100 text-red-800 border border-red-200 animate-pulse'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}>
                          {inc.tipo === 'EXCESO_JORNADA_GLOBAL' ? 'SOBRECARGA ILEGAL (>44h)' : 'DOCENTE COMPARTIDO'}
                        </span>
                        <span className="font-bold text-slate-800 text-sm">
                          {inc.docenteNombre} (RUN: {inc.run})
                        </span>
                      </div>

                      <p className="text-slate-600 mt-1.5">{inc.descripcion}</p>

                      <div className="mt-2 flex items-center gap-1.5 text-slate-500">
                        <School className="w-3.5 h-3.5" />
                        <span className="font-medium">Establecimientos involucrados:</span>
                        <span>{inc.colegiosInvolucrados.join(' • ')}</span>
                      </div>
                    </div>

                    <div className="text-right whitespace-nowrap">
                      <span className="text-lg font-black text-slate-800">{inc.horasTotalesSumadas} hrs</span>
                      <span className="block text-[10px] text-slate-400">Total semanal</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Balance por Comuna */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-orange-600" />
                Consolidado Comunal del SLEP Valle Diguillín
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                  <tr>
                    <th className="px-4 py-3">Comuna</th>
                    <th className="px-4 py-3 text-center">N° Colegios</th>
                    <th className="px-4 py-3 text-center">Matrícula Total</th>
                    <th className="px-4 py-3 text-center">Cupos SAE</th>
                    <th className="px-4 py-3 text-center">Horas Curriculares</th>
                    <th className="px-4 py-3 text-center">Horas Docentes Disp.</th>
                    <th className="px-4 py-3 text-center">Balance Horario</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {Object.entries(resumenPorComuna).map(([comuna, data]) => (
                    <tr key={comuna} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-bold text-slate-800">{comuna}</td>
                      <td className="px-4 py-3 text-center font-semibold">{data.colegiosCount}</td>
                      <td className="px-4 py-3 text-center">{data.matriculaTotal}</td>
                      <td className="px-4 py-3 text-center">{data.cuposSaeTotal}</td>
                      <td className="px-4 py-3 text-center font-semibold">{data.horasDemandadasTotal} HA</td>
                      <td className="px-4 py-3 text-center font-semibold">{data.horasDisponiblesTotal} HA</td>
                      <td className={`px-4 py-3 text-center font-bold ${
                        data.balanceHoras < 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}>
                        {data.balanceHoras >= 0 ? `+${data.balanceHoras}` : data.balanceHoras} HA
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Emparejador de Vacantes Cruzadas */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-orange-600" />
              Oportunidades de Movilidad y Compensación de Vacantes Cruzadas
            </h3>
            <p className="text-xs text-slate-500">
              El motor compara déficits de una escuela con superávits de colegios cercanos en la misma comuna o comunas vecinas para optimizar la dotación sin necesidad de nuevas contrataciones.
            </p>

            <div className="space-y-3">
              {vacantesCruzadas.map((vc, idx) => (
                <div key={idx} className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-2">
                  <div className="font-bold text-slate-800 text-sm flex items-center justify-between">
                    <span>{vc.asignatura}</span>
                    <span className="text-[10px] font-normal text-slate-500">
                      {vc.colegiosConDeficit.length} colegio(s) con déficit • {vc.colegiosConSuperavit.length} con superávit
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <div className="p-2.5 bg-red-50/60 border border-red-200 rounded">
                      <div className="text-[10px] font-bold text-red-800 uppercase mb-1">Colegios que requieren horas:</div>
                      {vc.colegiosConDeficit.map((def, dIdx) => (
                        <div key={dIdx} className="text-slate-700 flex justify-between">
                          <span>{def.colegio} ({def.comuna}):</span>
                          <strong className="text-red-700">-{def.deficit} HA</strong>
                        </div>
                      ))}
                    </div>

                    <div className="p-2.5 bg-emerald-50/60 border border-emerald-200 rounded">
                      <div className="text-[10px] font-bold text-emerald-800 uppercase mb-1">Colegios con horas disponibles:</div>
                      {vc.colegiosConSuperavit.length > 0 ? (
                        vc.colegiosConSuperavit.map((sup, sIdx) => (
                          <div key={sIdx} className="text-slate-700 flex justify-between">
                            <span>{sup.colegio} ({sup.comuna}):</span>
                            <strong className="text-emerald-700">+{sup.superavit} HA</strong>
                          </div>
                        ))
                      ) : (
                        <span className="text-slate-400 italic">No hay colegios con superávit en esta área.</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 2: NÓMINA TERRITORIAL DE DOCENTES (MULTI-CONTRATOS) */}
      {tabActiva === 'docentes' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Tarjetas KPI de Docentes Territoriales */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Total Docentes SLEP</div>
              <div className="text-2xl font-black text-slate-800 mt-1">
                {docentesConsolidados.length}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                RUTs únicos en el territorio
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Docentes Multi-Escuela</div>
              <div className="text-2xl font-black text-indigo-600 mt-1">
                {docentesMultiEscuelaCount}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Con contratos en 2 o más colegios
              </div>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <div className="text-slate-500 text-xs font-medium">Financiamiento Territorial (7 Métricas)</div>
              <div className="text-xs text-slate-700 mt-1 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-[11px]">Total SLEP:</span>
                  <strong>{totalHorasTerritorioSlep}h</strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Subv. Gen:</span>
                  <span><strong>{totalSubvTitSlep}T</strong> / <strong>{totalSubvConSlep}C</strong></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-purple-700">SEP:</span>
                  <span className="text-purple-700"><strong>{totalSepTitSlep}T</strong> / <strong>{totalSepConSlep}C</strong></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-blue-700">PIE:</span>
                  <span className="text-blue-700"><strong>{totalPieTitSlep}T</strong> / <strong>{totalPieConSlep}C</strong></span>
                </div>
              </div>
            </div>

            <div className={`p-5 rounded-xl border shadow-sm ${
              docentesExceso44hCount > 0 ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'
            }`}>
              <div className={`text-xs font-bold ${docentesExceso44hCount > 0 ? 'text-red-800' : 'text-emerald-800'}`}>
                Fiscalización Límite SLEP (&gt;44h)
              </div>
              <div className={`text-2xl font-black mt-1 ${docentesExceso44hCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {docentesExceso44hCount} {docentesExceso44hCount === 1 ? 'caso' : 'casos'}
              </div>
              <div className={`text-[11px] font-semibold mt-1 ${docentesExceso44hCount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {docentesExceso44hCount > 0 ? '⚠️ Infracción al Estatuto Docente' : '✓ Cero infracciones territoriales'}
              </div>
            </div>
          </div>

          {/* Barra de Búsqueda y Filtros */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Buscar docente por nombre, apellidos, RUN o establecimiento..."
              value={filtroDocentes}
              onChange={e => setFiltroDocentes(e.target.value)}
              className="flex-1 text-xs text-slate-800 placeholder-slate-400 bg-transparent focus:outline-none"
            />
            {filtroDocentes && (
              <button
                onClick={() => setFiltroDocentes('')}
                className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
              >
                Limpiar
              </button>
            )}
          </div>

          {/* Tabla de Docentes Territoriales */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                  <tr>
                    <th className="px-4 py-3">Docente</th>
                    <th className="px-4 py-3">Establecimientos & Horas Asignadas</th>
                    <th className="px-4 py-3 text-center">Total SLEP</th>
                    <th className="px-4 py-3 text-center">Aula Asignada</th>
                    <th className="px-4 py-3">Financiamiento (Subv/SEP/PIE)</th>
                    <th className="px-4 py-3 text-center">Estado Legal</th>
                    <th className="px-4 py-3 text-center">Ficha 360°</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {docentesFiltrados.map((doc, idx) => {
                    const esMulti = doc.contratos.length > 1;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">
                            {doc.nombres} {doc.apellidos}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            RUN: {doc.run} {doc.titulo ? `• ${doc.titulo}` : ''}
                          </div>
                        </td>

                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {doc.contratos.map((c, cIdx) => (
                              <div key={cIdx} className="flex items-center gap-2 text-[11px]">
                                <span className="font-semibold text-slate-800">
                                  {c.colegio.nombre}:
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-slate-100 font-bold text-slate-700 font-mono">
                                  {c.docente.horasContrato}h
                                </span>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                  c.regimen === '60/40' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {c.regimen}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className={`text-sm font-black ${
                            doc.excedeLimiteSlep ? 'text-red-600' : 'text-slate-900'
                          }`}>
                            {doc.horasTotalesSlep} hrs
                          </span>
                          {esMulti && (
                            <span className="block text-[10px] text-indigo-600 font-semibold">
                              {doc.contratos.length} colegios
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-orange-600 text-sm">
                            {doc.totalHorasAulaRegular !== undefined ? doc.totalHorasAulaRegular : doc.totalHorasPedagogicasAula} HA
                          </span>
                          {(doc.totalHorasCoDocencia || 0) > 0 && (
                            <span className="block text-[10px] text-purple-700 font-semibold mt-0.5">
                              +{doc.totalHorasCoDocencia}h Co-Docencia
                            </span>
                          )}
                          {((doc.totalHorasTallerSep || 0) + (doc.totalHorasTrabajoColaborativo || 0)) > 0 && (
                            <span className="block text-[10px] text-emerald-700 mt-0.5">
                              +{ (doc.totalHorasTallerSep || 0) + (doc.totalHorasTrabajoColaborativo || 0) }h Exentas
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <div className="text-[11px] font-mono space-y-0.5">
                            <div>Subv: <strong>{doc.resumenFinanciamiento.subvencionGeneralTitular || 0}T</strong> / <strong>{doc.resumenFinanciamiento.subvencionGeneralContrata || 0}C</strong></div>
                            <div className="text-purple-700">SEP: <strong>{doc.resumenFinanciamiento.sepTitular || 0}T</strong> / <strong>{doc.resumenFinanciamiento.sepContrata || 0}C</strong></div>
                            <div className="text-blue-700">PIE: <strong>{doc.resumenFinanciamiento.pieTitular || 0}T</strong> / <strong>{doc.resumenFinanciamiento.pieContrata || 0}C</strong></div>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-center">
                          {doc.excedeLimiteSlep ? (
                            <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px] animate-pulse">
                              <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                              Exceso SLEP (+{doc.excesoHorasSlep}h)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Legal (&le;44h)
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDocenteFicha(doc)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold transition-colors"
                            title="Ver Ficha 360°"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Ficha</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Ficha 360° del Docente */}
      <DocenteFichaDetalleModal
        isOpen={Boolean(docenteFicha)}
        onClose={() => setDocenteFicha(null)}
        docenteConsolidado={docenteFicha}
      />
    </div>
  );
};
