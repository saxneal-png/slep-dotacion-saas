import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  Building2,
  Clock,
  Coins,
  FileSpreadsheet,
  Layers,
  MapPin,
  PieChart,
  Printer,
  Scale,
  School,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import {
  Establecimiento,
  CursoSae,
  Docente,
  AsignacionHoraria,
  ComunaValleDiguillin
} from '../types';
import {
  calcularEstadisticasTerritoriales,
  calcularEstadisticasColegio,
  EstadisticasTerritorialesHoras,
  EstadisticasColegioHoras
} from '../services/estadisticasHorasService';

interface EstadisticasViewProps {
  colegios: Establecimiento[];
  colegioActivo: Establecimiento | null;
  onSelectColegio: (est: Establecimiento) => void;
  todosLosCursos: CursoSae[];
  todosLosDocentes: Docente[];
  todasLasAsignaciones: AsignacionHoraria[];
  periodoActivo: number;
  onNavegarColegio?: (est: Establecimiento) => void;
  onExportarExcelGlobal?: () => void;
}

const COMUNAS: ComunaValleDiguillin[] = [
  'Bulnes',
  'Chillán',
  'Chillán Viejo',
  'El Carmen',
  'Pemuco',
  'San Ignacio',
  'Yungay'
];

export const EstadisticasView: React.FC<EstadisticasViewProps> = ({
  colegios,
  colegioActivo,
  onSelectColegio,
  todosLosCursos,
  todosLosDocentes,
  todasLasAsignaciones,
  periodoActivo,
  onNavegarColegio,
  onExportarExcelGlobal
}) => {
  const [vistaModo, setVistaModo] = useState<'territorial' | 'intra_escuela'>('territorial');
  const [comunaFiltro, setComunaFiltro] = useState<string>('TODAS');
  const [busquedaColegioTabla, setBusquedaColegioTabla] = useState<string>('');

  // Estadísticas Territoriales Calculadas
  const statsTerritoriales = useMemo(() => {
    return calcularEstadisticasTerritoriales(
      colegios,
      todosLosCursos,
      todosLosDocentes,
      todasLasAsignaciones
    );
  }, [colegios, todosLosCursos, todosLosDocentes, todasLasAsignaciones]);

  // Estadísticas Intra-Escuela del Colegio Activo
  const statsColegioActivo = useMemo(() => {
    if (!colegioActivo) return null;
    const cursosCol = todosLosCursos.filter(c => c.rbd === colegioActivo.rbd);
    const docentesCol = todosLosDocentes.filter(d => d.rbd === colegioActivo.rbd);
    const asigsCol = todasLasAsignaciones.filter(a => a.rbd === colegioActivo.rbd);
    return calcularEstadisticasColegio(colegioActivo, cursosCol, docentesCol, asigsCol);
  }, [colegioActivo, todosLosCursos, todosLosDocentes, todasLasAsignaciones]);

  // Lista de colegios territorial filtrada para la tabla comparativa
  const colegiosTablaFiltrados = useMemo(() => {
    return statsTerritoriales.porColegio.filter(st => {
      const matchComuna = comunaFiltro === 'TODAS' || st.comuna === comunaFiltro;
      const q = busquedaColegioTabla.toLowerCase().trim();
      const matchTexto = q === '' || st.nombre.toLowerCase().includes(q) || st.rbd.includes(q);
      return matchComuna && matchTexto;
    });
  }, [statsTerritoriales, comunaFiltro, busquedaColegioTabla]);

  return (
    <div className="space-y-6">
      {/* Encabezado Principal y Segmented Control (Territorial vs Intra-Escuela) */}
      <div className="bg-[#002B49] text-white p-6 rounded-2xl border border-slate-700 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-600/30 border border-orange-500/40 text-orange-400 text-xs font-bold">
              <BarChart3 className="w-4 h-4" />
              <span>Panorama Estadístico Oficial de Dotación & Jornada</span>
              <span className="text-slate-400">• Periodo {periodoActivo}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-2">
              Distribución Horaria de Aula, Proporciones, Recreos y Financiamiento
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Auditoría estadística en minutos y horas cronológicas/pedagógicas según Ley 20.903 (65/35 y 60/40),
              recreos normativos ("creos"), horas colaborativas Art. 86, SEP, PIE y Subvención General.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Segmented Control de Nivel */}
            <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-700 flex items-center">
              <button
                type="button"
                onClick={() => setVistaModo('territorial')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  vistaModo === 'territorial'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Panorama Territorial</span>
              </button>
              <button
                type="button"
                onClick={() => setVistaModo('intra_escuela')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  vistaModo === 'intra_escuela'
                    ? 'bg-orange-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                <School className="w-3.5 h-3.5" />
                <span>Intra-Escuela</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold border border-slate-600 transition-colors"
              title="Imprimir reporte estadístico"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Imprimir</span>
            </button>

            {onExportarExcelGlobal && (
              <button
                type="button"
                onClick={onExportarExcelGlobal}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Exportar Excel</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODO 1: PANORAMA TERRITORIAL (SLEP VALLE DIGUILLÍN)                        */}
      {/* ========================================================================= */}
      {vistaModo === 'territorial' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Tarjetas KPI Principales de la Jornada Territorial */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
            {/* 1. Total Contrato */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Contratado</span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {statsTerritoriales.horasContratoTotal.toLocaleString()} <span className="text-xs font-bold text-slate-400">hrs</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                {statsTerritoriales.totalDocentesPlanta} docentes ({statsTerritoriales.docentesUnicosRun} RUNs)
              </span>
            </div>

            {/* 2. Horas de Aula */}
            <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Horas de Aula</span>
              <div className="text-xl font-black text-blue-900 mt-1">
                {statsTerritoriales.horasAulaPedagogicasTotal.toLocaleString()} <span className="text-xs font-bold text-blue-400">HA</span>
              </div>
              <span className="text-[11px] text-blue-700/80 mt-0.5 block font-semibold">
                {statsTerritoriales.horasAulaCronologicasTotal} hrs cron. ({statsTerritoriales.porcentajeAulaGlobal}%)
              </span>
            </div>

            {/* 3. Proporciones (No Lectivas) */}
            <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
              <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">Proporciones (No Lect.)</span>
              <div className="text-xl font-black text-purple-900 mt-1">
                {statsTerritoriales.horasNoLectivasTotal.toLocaleString()} <span className="text-xs font-bold text-purple-400">hrs</span>
              </div>
              <span className="text-[11px] text-purple-700/80 mt-0.5 block font-semibold">
                Ley 20.903 ({statsTerritoriales.porcentajeNoLectivoGlobal}% jornada)
              </span>
            </div>

            {/* 4. Recreos Normativos ("creos") */}
            <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
              <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Recreos Normativos</span>
              <div className="text-xl font-black text-amber-900 mt-1">
                {statsTerritoriales.horasRecreosTotal.toLocaleString()} <span className="text-xs font-bold text-amber-400">hrs</span>
              </div>
              <span className="text-[11px] text-amber-700/80 mt-0.5 block font-semibold">
                Descanso legal ({statsTerritoriales.porcentajeRecreoGlobal}%)
              </span>
            </div>

            {/* 5. Trabajo Colaborativo / PIE */}
            <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">Colaborativo & Co-Doc.</span>
              <div className="text-xl font-black text-emerald-900 mt-1">
                {(statsTerritoriales.horasColaborativoTotal + statsTerritoriales.horasCoDocenciaTotal).toLocaleString()} <span className="text-xs font-bold text-emerald-400">hrs</span>
              </div>
              <span className="text-[11px] text-emerald-700/80 mt-0.5 block font-semibold">
                Art. 86 ({statsTerritoriales.horasColaborativoTotal}h) + Co-Doc ({statsTerritoriales.horasCoDocenciaTotal}h)
              </span>
            </div>

            {/* 6. Horas Institucionales / No Aula */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Gestión Institucional</span>
              <div className="text-xl font-black text-slate-800 mt-1">
                {statsTerritoriales.horasInstitucionalesTotal.toLocaleString()} <span className="text-xs font-bold text-slate-400">hrs</span>
              </div>
              <span className="text-[11px] text-slate-500 mt-0.5 block">
                Dir: {statsTerritoriales.horasDirectivasTotal}h • UTP: {statsTerritoriales.horasTecnicoPedagogicasTotal}h
              </span>
            </div>
          </div>

          {/* Gráfico Visual de Composición de la Jornada Territorial */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-orange-600" />
                  Estructura Territorial de la Jornada Docente ({statsTerritoriales.horasContratoTotal} hrs totales)
                </h3>
                <p className="text-xs text-slate-500">
                  Desglose formal según dictámenes MINEDUC: Horas de Aula + Proporciones No Lectivas + Recreos Proporcionales + Institucionales.
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600 inline-block"></span> Aula ({statsTerritoriales.porcentajeAulaGlobal}%)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-600 inline-block"></span> Proporción ({statsTerritoriales.porcentajeNoLectivoGlobal}%)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500 inline-block"></span> Recreos ({statsTerritoriales.porcentajeRecreoGlobal}%)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400 inline-block"></span> Institucional ({statsTerritoriales.porcentajeInstitucionalGlobal}%)</span>
              </div>
            </div>

            {/* Barra Multi-Segmento de Proporciones */}
            <div className="w-full h-7 rounded-xl overflow-hidden flex shadow-inner bg-slate-100 p-0.5">
              <div
                style={{ width: `${Math.max(5, statsTerritoriales.porcentajeAulaGlobal)}%` }}
                className="bg-blue-600 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all first:rounded-l-lg"
                title={`Aula: ${statsTerritoriales.horasAulaCronologicasTotal} hrs (${statsTerritoriales.porcentajeAulaGlobal}%)`}
              >
                Aula {statsTerritoriales.porcentajeAulaGlobal}%
              </div>
              <div
                style={{ width: `${Math.max(5, statsTerritoriales.porcentajeNoLectivoGlobal)}%` }}
                className="bg-purple-600 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                title={`Proporción No Lectiva: ${statsTerritoriales.horasNoLectivasTotal} hrs (${statsTerritoriales.porcentajeNoLectivoGlobal}%)`}
              >
                No Lect. {statsTerritoriales.porcentajeNoLectivoGlobal}%
              </div>
              <div
                style={{ width: `${Math.max(4, statsTerritoriales.porcentajeRecreoGlobal)}%` }}
                className="bg-amber-500 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                title={`Recreos: ${statsTerritoriales.horasRecreosTotal} hrs (${statsTerritoriales.porcentajeRecreoGlobal}%)`}
              >
                Recreos {statsTerritoriales.porcentajeRecreoGlobal}%
              </div>
              <div
                style={{ width: `${Math.max(3, statsTerritoriales.porcentajeInstitucionalGlobal)}%` }}
                className="bg-slate-400 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all last:rounded-r-lg"
                title={`Institucional: ${statsTerritoriales.horasInstitucionalesTotal} hrs (${statsTerritoriales.porcentajeInstitucionalGlobal}%)`}
              >
                Inst. {statsTerritoriales.porcentajeInstitucionalGlobal}%
              </div>
            </div>

            {/* Fila de Bolsas de Financiamiento Territorial (SEP, PIE, Subvención) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                <span className="font-bold text-slate-700 block">Subvención General</span>
                <div className="text-base font-black text-slate-900 mt-0.5">
                  {statsTerritoriales.financiamiento.subvencionGeneralTotal} <span className="text-[11px] font-normal text-slate-500">hrs</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-1 font-mono">
                  Titular: {statsTerritoriales.financiamiento.subvencionGeneralTitular}h • Contrata: {statsTerritoriales.financiamiento.subvencionGeneralContrata}h
                </div>
              </div>

              <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 text-xs">
                <span className="font-bold text-purple-900 block">Subvención Escolar Preferencial (SEP)</span>
                <div className="text-base font-black text-purple-900 mt-0.5">
                  {statsTerritoriales.financiamiento.sepTotal} <span className="text-[11px] font-normal text-purple-600">hrs</span>
                </div>
                <div className="text-[11px] text-purple-700 mt-1 font-mono">
                  Titular: {statsTerritoriales.financiamiento.sepTitular}h • Contrata: {statsTerritoriales.financiamiento.sepContrata}h
                </div>
              </div>

              <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 text-xs">
                <span className="font-bold text-blue-900 block">Programa de Integración Escolar (PIE)</span>
                <div className="text-base font-black text-blue-900 mt-0.5">
                  {statsTerritoriales.financiamiento.pieTotal} <span className="text-[11px] font-normal text-blue-600">hrs</span>
                </div>
                <div className="text-[11px] text-blue-700 mt-1 font-mono">
                  Titular: {statsTerritoriales.financiamiento.pieTitular}h • Contrata: {statsTerritoriales.financiamiento.pieContrata}h
                </div>
              </div>
            </div>
          </div>

          {/* Tabla Comparativa de Escuelas del Territorio */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  Matriz Territorial de Establecimientos ({colegiosTablaFiltrados.length} de {colegios.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Desglose exacto de horas de aula, proporciones, recreos y balance escuela por escuela.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                {/* Selector de Comuna */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-500">Comuna:</span>
                  <select
                    value={comunaFiltro}
                    onChange={(e) => setComunaFiltro(e.target.value)}
                    className="text-xs font-semibold bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="TODAS">Todas las Comunas</option>
                    {COMUNAS.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                {/* Buscador de Colegio */}
                <div className="relative w-64">
                  <input
                    type="text"
                    value={busquedaColegioTabla}
                    onChange={(e) => setBusquedaColegioTabla(e.target.value)}
                    placeholder="Filtrar por nombre o RBD..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:bg-white"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                  <tr>
                    <th className="px-3 py-2.5">Establecimiento</th>
                    <th className="px-2 py-2.5 text-center">Régimen</th>
                    <th className="px-2 py-2.5 text-center">Contrato</th>
                    <th className="px-2 py-2.5 text-center text-blue-700">Aula (HA)</th>
                    <th className="px-2 py-2.5 text-center text-purple-700">Proporción</th>
                    <th className="px-2 py-2.5 text-center text-amber-700">Recreos</th>
                    <th className="px-2 py-2.5 text-center text-emerald-700">Colab.</th>
                    <th className="px-2 py-2.5 text-center">SEP</th>
                    <th className="px-2 py-2.5 text-center">PIE</th>
                    <th className="px-2 py-2.5 text-center">Subv. Gral</th>
                    <th className="px-2 py-2.5 text-center">Balance Aula</th>
                    <th className="px-2 py-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {colegiosTablaFiltrados.map(st => {
                    const esSuperavit = st.balanceAulaLectiva >= 0;
                    const estReal = colegios.find(c => c.rbd === st.rbd);

                    return (
                      <tr key={st.rbd} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-3 py-2.5">
                          <div className="font-bold text-slate-900">{st.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            RBD {st.rbd} • {st.comuna}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            st.regimenProporcion === '60/40' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}>
                            {st.regimenProporcion}
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-slate-800">
                          {st.horasContratoTotal}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-blue-700">
                          {st.horasAulaPedagogicasAsignadas} HA
                        </td>
                        <td className="px-2 py-2.5 text-center font-semibold text-purple-700">
                          {st.horasNoLectivasCalculadas}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-semibold text-amber-700">
                          {st.horasRecreoCalculadas}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-semibold text-emerald-700">
                          {st.horasTrabajoColaborativo}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono">
                          {st.financiamiento.sepTotal}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono">
                          {st.financiamiento.pieTotal}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono">
                          {st.financiamiento.subvencionGeneralTotal}h
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            esSuperavit ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {esSuperavit ? `+${st.balanceAulaLectiva}` : st.balanceAulaLectiva} HA
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <button
                            onClick={() => {
                              if (estReal) {
                                onSelectColegio(estReal);
                                setVistaModo('intra_escuela');
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold transition-colors"
                            title="Ver desglose intra-escuela"
                          >
                            <span>Detalle</span>
                            <ArrowUpRight className="w-3 h-3" />
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

      {/* ========================================================================= */}
      {/* MODO 2: PANORAMA INTRA-ESCUELA (FICHA ESCOLAR DETALLADA)                   */}
      {/* ========================================================================= */}
      {vistaModo === 'intra_escuela' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Barra de Selección de Colegio Intra-Escuela */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center font-black text-base">
                🏫
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-slate-500">Establecimiento Seleccionado</span>
                <div className="flex items-center gap-2">
                  <select
                    value={colegioActivo?.id || ''}
                    onChange={(e) => {
                      const est = colegios.find(c => c.id === e.target.value);
                      if (est) onSelectColegio(est);
                    }}
                    className="text-base font-bold text-slate-900 bg-transparent border-b border-slate-300 focus:outline-none focus:border-orange-500 pr-4"
                  >
                    {colegios.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.nombre} (RBD {c.rbd} - {c.comuna})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {colegioActivo && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2.5 py-1 rounded-lg font-bold ${
                  colegioActivo.porcentajePrioritarios >= 80 ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-blue-100 text-blue-900 border border-blue-200'
                }`}>
                  Régimen {colegioActivo.porcentajePrioritarios >= 80 ? '60/40' : '65/35'} ({colegioActivo.porcentajePrioritarios}% Prioritarios SEP)
                </span>
                {onNavegarColegio && (
                  <button
                    onClick={() => onNavegarColegio(colegioActivo)}
                    className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-xs font-bold shadow-xs transition-colors"
                  >
                    Ir al Espacio Escolar →
                  </button>
                )}
              </div>
            )}
          </div>

          {statsColegioActivo ? (
            <>
              {/* KPIs de la Escuela Activa */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Horas Contrato</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {statsColegioActivo.horasContratoTotal} <span className="text-xs font-bold text-slate-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {statsColegioActivo.totalDocentes} funcionarios
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Horas Aula Asignadas</span>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    {statsColegioActivo.horasAulaPedagogicasAsignadas} <span className="text-xs font-bold text-blue-400">HA</span>
                  </div>
                  <span className="text-[11px] text-blue-700 mt-0.5 block font-semibold">
                    {statsColegioActivo.horasAulaCronologicasAsignadas} hrs cron. ({statsColegioActivo.porcentajeAula}%)
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-purple-700 uppercase block">Proporción No Lectiva</span>
                  <div className="text-xl font-black text-purple-900 mt-1">
                    {statsColegioActivo.horasNoLectivasCalculadas} <span className="text-xs font-bold text-purple-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-purple-700 mt-0.5 block font-semibold">
                    {statsColegioActivo.minutosNoLectivosCalculados} min ({statsColegioActivo.porcentajeNoLectivo}%)
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">Recreos Normativos</span>
                  <div className="text-xl font-black text-amber-900 mt-1">
                    {statsColegioActivo.horasRecreoCalculadas} <span className="text-xs font-bold text-amber-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-amber-700 mt-0.5 block font-semibold">
                    {statsColegioActivo.minutosRecreoCalculados} min ("creos")
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Colaborativo & Co-Doc.</span>
                  <div className="text-xl font-black text-emerald-900 mt-1">
                    {statsColegioActivo.horasTrabajoColaborativo + statsColegioActivo.horasCoDocencia} <span className="text-xs font-bold text-emerald-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 mt-0.5 block font-semibold">
                    Art. 86 ({statsColegioActivo.horasTrabajoColaborativo}h)
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Balanza Lectiva</span>
                  <div className={`text-xl font-black mt-1 ${statsColegioActivo.balanceAulaLectiva >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {statsColegioActivo.balanceAulaLectiva >= 0 ? `+${statsColegioActivo.balanceAulaLectiva}` : statsColegioActivo.balanceAulaLectiva} <span className="text-xs font-bold text-slate-400">HA</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Demanda: {statsColegioActivo.horasAulaDemandadasPlan} HA
                  </span>
                </div>
              </div>

              {/* Medidor de Cuadre de Jornada Escolar Intra-Escuela */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-orange-600" />
                    Composición de la Carga Horaria Escolar ({statsColegioActivo.nombre})
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Minutos Contratados Totales: {statsColegioActivo.minutosContratoTotal} min
                  </span>
                </div>

                <div className="w-full h-7 rounded-xl overflow-hidden flex shadow-inner bg-slate-100 p-0.5">
                  <div
                    style={{ width: `${Math.max(5, statsColegioActivo.porcentajeAula)}%` }}
                    className="bg-blue-600 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all first:rounded-l-lg"
                  >
                    Aula {statsColegioActivo.porcentajeAula}%
                  </div>
                  <div
                    style={{ width: `${Math.max(5, statsColegioActivo.porcentajeNoLectivo)}%` }}
                    className="bg-purple-600 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                  >
                    No Lect. {statsColegioActivo.porcentajeNoLectivo}%
                  </div>
                  <div
                    style={{ width: `${Math.max(4, statsColegioActivo.porcentajeRecreo)}%` }}
                    className="bg-amber-500 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                  >
                    Recreos {statsColegioActivo.porcentajeRecreo}%
                  </div>
                  <div
                    style={{ width: `${Math.max(3, statsColegioActivo.porcentajeInstitucional)}%` }}
                    className="bg-slate-400 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all last:rounded-r-lg"
                  >
                    Inst. {statsColegioActivo.porcentajeInstitucional}%
                  </div>
                </div>

                {/* Desglose de Financiamiento de la Escuela */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 block">Subvención General</span>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {statsColegioActivo.financiamiento.subvencionGeneralTotal} hrs
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Titular: {statsColegioActivo.financiamiento.subvencionGeneralTitular}h • Contrata: {statsColegioActivo.financiamiento.subvencionGeneralContrata}h
                    </span>
                  </div>

                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 text-xs">
                    <span className="font-bold text-purple-900 block">SEP</span>
                    <div className="text-sm font-black text-purple-900 mt-0.5">
                      {statsColegioActivo.financiamiento.sepTotal} hrs
                    </div>
                    <span className="text-[10px] text-purple-700 font-mono">
                      Titular: {statsColegioActivo.financiamiento.sepTitular}h • Contrata: {statsColegioActivo.financiamiento.sepContrata}h
                    </span>
                  </div>

                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 text-xs">
                    <span className="font-bold text-blue-900 block">PIE</span>
                    <div className="text-sm font-black text-blue-900 mt-0.5">
                      {statsColegioActivo.financiamiento.pieTotal} hrs
                    </div>
                    <span className="text-[10px] text-blue-700 font-mono">
                      Titular: {statsColegioActivo.financiamiento.pieTitular}h • Contrata: {statsColegioActivo.financiamiento.pieContrata}h
                    </span>
                  </div>
                </div>
              </div>

              {/* Tabla Detallada Docente por Docente */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
                <div className="border-b pb-2">
                  <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Users className="w-4 h-4 text-slate-600" />
                    Nómina Detallada de Planta Docente ({statsColegioActivo.desgloseDocentes.length} funcionarios)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aporte individual de cada docente a las horas de aula, proporciones no lectivas, recreos, colaborativo y fuentes de financiamiento.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                      <tr>
                        <th className="px-3 py-2.5">Funcionario</th>
                        <th className="px-2 py-2.5">Estamento / Calidad</th>
                        <th className="px-2 py-2.5 text-center">Horas Contrato</th>
                        <th className="px-2 py-2.5 text-center text-blue-700">Aula (HA)</th>
                        <th className="px-2 py-2.5 text-center text-purple-700">Proporción</th>
                        <th className="px-2 py-2.5 text-center text-amber-700">Recreos</th>
                        <th className="px-2 py-2.5 text-center text-emerald-700">Colab.</th>
                        <th className="px-2 py-2.5 text-center">SEP</th>
                        <th className="px-2 py-2.5 text-center">PIE</th>
                        <th className="px-2 py-2.5 text-center">Subv. Gral</th>
                        <th className="px-2 py-2.5 text-center">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {statsColegioActivo.desgloseDocentes.map(d => (
                        <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2">
                            <div className="font-bold text-slate-900">{d.nombreCompleto}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{d.run}</div>
                          </td>
                          <td className="px-2 py-2">
                            <div className="text-slate-700 font-medium">{d.estamento.replace('_', ' ')}</div>
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              d.calidadJuridica === 'TITULAR' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {d.calidadJuridica}
                            </span>
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-slate-800">
                            {d.horasContrato}h
                          </td>
                          <td className="px-2 py-2 text-center font-bold text-blue-700">
                            {d.horasAulaPedagogicas} HA
                          </td>
                          <td className="px-2 py-2 text-center font-semibold text-purple-700">
                            {d.horasNoLectivas}h
                          </td>
                          <td className="px-2 py-2 text-center font-semibold text-amber-700">
                            {d.horasRecreo}h
                          </td>
                          <td className="px-2 py-2 text-center font-semibold text-emerald-700">
                            {d.horasColaborativo}h
                          </td>
                          <td className="px-2 py-2 text-center font-mono">
                            {d.horasSep}h
                          </td>
                          <td className="px-2 py-2 text-center font-mono">
                            {d.horasPie}h
                          </td>
                          <td className="px-2 py-2 text-center font-mono">
                            {d.horasSubvGeneral}h
                          </td>
                          <td className="px-2 py-2 text-center">
                            {d.estaSobreasignado ? (
                              <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Sobreasignado
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[10px] font-bold inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Normal
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
              Selecciona un colegio para visualizar sus estadísticas intra-escuela.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
