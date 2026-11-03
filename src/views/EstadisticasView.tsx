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
  ArrowUpRight,
  RefreshCw,
  GraduationCap,
  Briefcase,
  UserCheck,
  HeartHandshake,
  Award
} from 'lucide-react';
import {
  Establecimiento,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion,
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
  todosLosAsistentes?: AsistenteEducacion[];
  asistentesColegioActivo?: AsistenteEducacion[];
  periodoActivo: number;
  onNavegarColegio?: (est: Establecimiento) => void;
  onExportarExcelGlobal?: () => void;
  onRecargarDatos?: () => Promise<void> | void;
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
  todosLosAsistentes = [],
  asistentesColegioActivo = [],
  periodoActivo,
  onNavegarColegio,
  onExportarExcelGlobal,
  onRecargarDatos
}) => {
  const [vistaModo, setVistaModo] = useState<'territorial' | 'intra_escuela'>('territorial');
  const [enfoqueEstamento, setEnfoqueEstamento] = useState<'consolidado' | 'docentes' | 'asistentes'>('consolidado');
  const [comunaFiltro, setComunaFiltro] = useState<string>('TODAS');
  const [busquedaColegioTabla, setBusquedaColegioTabla] = useState<string>('');
  const [recargandoDatos, setRecargandoDatos] = useState(false);

  // Estadísticas Territoriales Calculadas
  const statsTerritoriales = useMemo(() => {
    return calcularEstadisticasTerritoriales(
      colegios,
      todosLosCursos,
      todosLosDocentes,
      todasLasAsignaciones,
      todosLosAsistentes
    );
  }, [colegios, todosLosCursos, todosLosDocentes, todasLasAsignaciones, todosLosAsistentes]);

  // Estadísticas Intra-Escuela del Colegio Activo
  const statsColegioActivo = useMemo(() => {
    if (!colegioActivo) return null;
    const cursosCol = todosLosCursos.filter(c => c.rbd === colegioActivo.rbd);
    const docentesCol = todosLosDocentes.filter(d => d.rbd === colegioActivo.rbd);
    const asigsCol = todasLasAsignaciones.filter(a => a.rbd === colegioActivo.rbd);
    const asistCol = todosLosAsistentes.length > 0
      ? todosLosAsistentes.filter(a => a.rbd === colegioActivo.rbd)
      : asistentesColegioActivo;
    return calcularEstadisticasColegio(colegioActivo, cursosCol, docentesCol, asigsCol, asistCol);
  }, [colegioActivo, todosLosCursos, todosLosDocentes, todasLasAsignaciones, todosLosAsistentes, asistentesColegioActivo]);

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
      {/* Encabezado Principal y Controles de Navegación */}
      <div className="bg-[#002B49] text-white p-6 rounded-2xl border border-slate-700 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-orange-600/30 border border-orange-500/40 text-orange-400 text-xs font-bold">
              <BarChart3 className="w-4 h-4" />
              <span>Gestión Estratégica de Dotación de Personal</span>
              <span className="text-slate-400">• Periodo {periodoActivo}</span>
            </div>
            <h2 className="text-2xl font-bold text-white mt-2">
              Panoramas & Auditoría de Personal SLEP Valle Diguillín
            </h2>
            <p className="text-xs text-slate-300 mt-1 max-w-3xl">
              Análisis consolidado de docentes (titulares, contrata, postulando a titularidad, Ley 20.903) y asistentes de la educación (Ley 21.109), financiamiento por subvención y cobertura curricular.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onRecargarDatos && (
              <button
                type="button"
                onClick={async () => {
                  setRecargandoDatos(true);
                  try {
                    await onRecargarDatos();
                  } finally {
                    setRecargandoDatos(false);
                  }
                }}
                disabled={recargandoDatos}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow transition-all border border-blue-400 active:scale-95 disabled:opacity-60"
                title={`Sincronizar base de datos del Periodo ${periodoActivo}`}
              >
                <RefreshCw className={`w-4 h-4 ${recargandoDatos ? 'animate-spin' : ''}`} />
                <span>{recargandoDatos ? `Sincronizando ${periodoActivo}...` : `Actualizar Datos ${periodoActivo}`}</span>
              </button>
            )}

            {/* Segmented Control de Nivel: Territorial vs Intra-Escuela */}
            <div className="bg-slate-900/90 p-1 rounded-xl border border-slate-700 flex items-center">
              <button
                type="button"
                onClick={() => setVistaModo('territorial')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
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

        {/* Barra de Filtro de Estamento / Enfoque */}
        <div className="mt-5 pt-4 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <span className="font-semibold text-slate-400">Enfoque de Análisis:</span>
            <div className="inline-flex p-0.5 rounded-lg bg-slate-800/90 border border-slate-700">
              <button
                type="button"
                onClick={() => setEnfoqueEstamento('consolidado')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold text-xs transition-all ${
                  enfoqueEstamento === 'consolidado'
                    ? 'bg-slate-200 text-slate-900 shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Consolidado SLEP (Docentes + Asistentes)</span>
              </button>
              <button
                type="button"
                onClick={() => setEnfoqueEstamento('docentes')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold text-xs transition-all ${
                  enfoqueEstamento === 'docentes'
                    ? 'bg-blue-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <GraduationCap className="w-3.5 h-3.5" />
                <span>Dotación Docente (Ley 20.903)</span>
              </button>
              <button
                type="button"
                onClick={() => setEnfoqueEstamento('asistentes')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-bold text-xs transition-all ${
                  enfoqueEstamento === 'asistentes'
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white'
                }`}
              >
                <Briefcase className="w-3.5 h-3.5" />
                <span>Asistentes de la Educación (Ley 21.109)</span>
              </button>
            </div>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {colegios.length} establecimientos • {statsTerritoriales.totalDocentesPlanta} docentes • {statsTerritoriales.asistentesTerritorio.totalAsistentes} asistentes
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MODO 1: PANORAMA TERRITORIAL (SLEP VALLE DIGUILLÍN)                        */}
      {/* ========================================================================= */}
      {vistaModo === 'territorial' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* ENFOQUE 1: CONSOLIDADO PERSONAL SLEP */}
          {enfoqueEstamento === 'consolidado' && (
            <div className="space-y-6">
              {/* Tarjetas Maestras de Dotación de Todo el Servicio Local */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Dotación Total Personal */}
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Fuerza Laboral Total SLEP</span>
                    <span className="p-2 bg-blue-50 text-blue-700 rounded-xl">
                      <Users className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    {statsTerritoriales.totalPersonalSlep.toLocaleString()} <span className="text-xs font-bold text-slate-500">funcionarios</span>
                  </div>
                  <div className="text-xs text-slate-600 mt-1 font-semibold">
                    {statsTerritoriales.totalHorasPersonalSlep.toLocaleString()} horas contratadas totales
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                    <span>Docentes: <strong>{statsTerritoriales.totalDocentesPlanta}</strong></span>
                    <span>Asistentes: <strong>{statsTerritoriales.asistentesTerritorio.totalAsistentes}</strong></span>
                  </div>
                </div>

                {/* 2. Planta Docente & Semáforo 80/20 */}
                <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Dotación Docente</span>
                    <span className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                      <GraduationCap className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-blue-900 mt-2">
                    {statsTerritoriales.horasContratoTotal.toLocaleString()} <span className="text-xs font-bold text-blue-500">hrs</span>
                  </div>
                  <div className="text-xs text-blue-800 mt-1 font-semibold">
                    {statsTerritoriales.totalDocentesPlanta} docentes ({statsTerritoriales.docentesUnicosRun} RUNs)
                  </div>
                  <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between text-[11px]">
                    <span className="text-blue-900 font-medium">Contrata vs Titular:</span>
                    <span className={`px-2 py-0.5 rounded-md font-black text-[10px] ${
                      statsTerritoriales.calidadJuridicaDocente.cumpleNorma8020
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-800 border border-amber-300'
                    }`}>
                      {statsTerritoriales.calidadJuridicaDocente.porcentajeContrata}% Contrata (Límite 20%)
                    </span>
                  </div>
                </div>

                {/* 3. Asistentes de la Educación */}
                <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Asistentes Educación</span>
                    <span className="p-2 bg-emerald-100 text-emerald-700 rounded-xl">
                      <Briefcase className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-emerald-900 mt-2">
                    {statsTerritoriales.asistentesTerritorio.totalHoras.toLocaleString()} <span className="text-xs font-bold text-emerald-500">hrs</span>
                  </div>
                  <div className="text-xs text-emerald-800 mt-1 font-semibold">
                    {statsTerritoriales.asistentesTerritorio.totalAsistentes} funcionarios ({statsTerritoriales.asistentesTerritorio.asistentesUnicosRun} RUNs)
                  </div>
                  <div className="mt-3 pt-3 border-t border-emerald-100 flex items-center justify-between text-[11px] text-emerald-800">
                    <span>Indefinidos: <strong>{statsTerritoriales.asistentesTerritorio.porcentajeIndefinidos}%</strong></span>
                    <span>Plazo Fijo: <strong>{statsTerritoriales.asistentesTerritorio.porcentajePlazoFijo}%</strong></span>
                  </div>
                </div>

                {/* 4. Subvención & Financiamiento Consolidado */}
                <div className="bg-white p-5 rounded-2xl border border-purple-200 bg-purple-50/20 shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-purple-700 uppercase tracking-wider">Financiamiento SLEP</span>
                    <span className="p-2 bg-purple-100 text-purple-700 rounded-xl">
                      <Coins className="w-5 h-5" />
                    </span>
                  </div>
                  <div className="text-3xl font-black text-purple-900 mt-2">
                    {statsTerritoriales.totalHorasPersonalSlep.toLocaleString()} <span className="text-xs font-bold text-purple-500">hrs totales</span>
                  </div>
                  <div className="text-xs text-purple-800 mt-1 font-semibold">
                    Subv. General: {statsTerritoriales.totalHorasSubvencionGeneralPersonal.toLocaleString()}h
                  </div>
                  <div className="mt-3 pt-3 border-t border-purple-100 flex items-center justify-between text-[11px] text-purple-800">
                    <span>SEP: <strong>{statsTerritoriales.totalHorasSepPersonal.toLocaleString()}h</strong></span>
                    <span>PIE: <strong>{statsTerritoriales.totalHorasPiePersonal.toLocaleString()}h</strong></span>
                  </div>
                </div>
              </div>

              {/* Comparativa Territorial por Comuna (Bulnes, Chillán, Chillán Viejo, El Carmen, Pemuco, San Ignacio, Yungay) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-orange-600" />
                      Distribución Territorial de Dotación por Comuna
                    </h3>
                    <p className="text-xs text-slate-500">
                      Consolidado de colegios, matrícula proyectada, dotación docente y asistentes en las 7 comunas del SLEP.
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    Total Matrícula: {statsTerritoriales.totalMatricula.toLocaleString()} alumnos
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                      <tr>
                        <th className="px-3 py-2.5">Comuna</th>
                        <th className="px-2 py-2.5 text-center">Colegios</th>
                        <th className="px-2 py-2.5 text-center">Matrícula</th>
                        <th className="px-2 py-2.5 text-center text-blue-700">Docentes</th>
                        <th className="px-2 py-2.5 text-center text-blue-700">Hrs Docentes</th>
                        <th className="px-2 py-2.5 text-center text-emerald-700">Asistentes</th>
                        <th className="px-2 py-2.5 text-center text-emerald-700">Hrs Asistentes</th>
                        <th className="px-2 py-2.5 text-center">Subv. General</th>
                        <th className="px-2 py-2.5 text-center text-purple-700">SEP</th>
                        <th className="px-2 py-2.5 text-center text-blue-700">PIE</th>
                        <th className="px-2 py-2.5 text-center font-black">Regla 80/20 (% Contrata)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {COMUNAS.map(com => {
                        const data = statsTerritoriales.porComuna[com] || {
                          colegiosCount: 0,
                          matriculaTotal: 0,
                          docentesCount: 0,
                          docentesHoras: 0,
                          asistentesCount: 0,
                          asistentesHoras: 0,
                          subvGeneralTotal: 0,
                          sepTotal: 0,
                          pieTotal: 0,
                          pctContrata: 0
                        };
                        const cumple20 = data.pctContrata <= 20.0;
                        return (
                          <tr key={com} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-slate-900">{com}</td>
                            <td className="px-2 py-2.5 text-center">{data.colegiosCount}</td>
                            <td className="px-2 py-2.5 text-center font-semibold">{data.matriculaTotal.toLocaleString()}</td>
                            <td className="px-2 py-2.5 text-center font-bold text-blue-800">{data.docentesCount}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-blue-900">{data.docentesHoras.toLocaleString()}h</td>
                            <td className="px-2 py-2.5 text-center font-bold text-emerald-800">{data.asistentesCount}</td>
                            <td className="px-2 py-2.5 text-center font-mono text-emerald-900">{data.asistentesHoras.toLocaleString()}h</td>
                            <td className="px-2 py-2.5 text-center font-mono">{data.subvGeneralTotal.toLocaleString()}h</td>
                            <td className="px-2 py-2.5 text-center font-mono text-purple-700">{data.sepTotal.toLocaleString()}h</td>
                            <td className="px-2 py-2.5 text-center font-mono text-blue-700">{data.pieTotal.toLocaleString()}h</td>
                            <td className="px-2 py-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                                cumple20 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                              }`}>
                                {data.pctContrata}% {cumple20 ? '✓' : '⚠'}
                              </span>
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

          {/* ENFOQUE 2: DOTACIÓN DOCENTE (LEY 20.903 & ESTATUTO DOCENTE) */}
          {enfoqueEstamento === 'docentes' && (
            <div className="space-y-6">
              {/* Tarjetas KPI de Dotación Docente */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                {/* 1. Total Contratado */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Total Contratado</span>
                  <div className="text-xl font-black text-slate-900 mt-1">
                    {statsTerritoriales.horasContratoTotal.toLocaleString()} <span className="text-xs font-bold text-slate-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    {statsTerritoriales.totalDocentesPlanta} docentes ({statsTerritoriales.docentesUnicosRun} RUNs)
                  </span>
                </div>

                {/* 2. Titulares vs Contrata (Regla 80/20) */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Calidad Jurídica</span>
                  <div className="text-lg font-black text-slate-900 mt-1 flex items-baseline gap-1">
                    <span>{statsTerritoriales.calidadJuridicaDocente.titularesHoras}h</span>
                    <span className="text-xs font-normal text-slate-400">Tit /</span>
                    <span className="text-blue-700">{statsTerritoriales.calidadJuridicaDocente.contrataHoras}h</span>
                    <span className="text-xs font-normal text-slate-400">Con</span>
                  </div>
                  <div className="text-[11px] mt-0.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                      statsTerritoriales.calidadJuridicaDocente.cumpleNorma8020
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}>
                      {statsTerritoriales.calidadJuridicaDocente.porcentajeContrata}% a Contrata (Máx 20%)
                    </span>
                  </div>
                </div>

                {/* 3. Horas de Aula Asignadas */}
                <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Aula Asignada</span>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    {statsTerritoriales.horasAulaPedagogicasTotal.toLocaleString()} <span className="text-xs font-bold text-blue-400">HA</span>
                  </div>
                  <span className="text-[11px] text-blue-700 mt-0.5 block font-semibold">
                    {statsTerritoriales.horasAulaCronologicasTotal}h cron. ({statsTerritoriales.porcentajeAulaGlobal}%)
                  </span>
                </div>

                {/* 4. Proporciones y Recreos Ley 20.903 */}
                <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">No Lectivas + Recreos</span>
                  <div className="text-xl font-black text-purple-900 mt-1">
                    {(statsTerritoriales.horasNoLectivasTotal + statsTerritoriales.horasRecreosTotal).toFixed(1)} <span className="text-xs font-bold text-purple-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-purple-700 mt-0.5 block font-semibold">
                    HNL: {statsTerritoriales.horasNoLectivasTotal}h • Rec: {statsTerritoriales.horasRecreosTotal}h
                  </span>
                </div>

                {/* 5. Gestión Institucional Exenta */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Gestión Institucional</span>
                  <div className="text-xl font-black text-slate-800 mt-1">
                    {statsTerritoriales.horasInstitucionalesTotal.toLocaleString()} <span className="text-xs font-bold text-slate-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Dir: {statsTerritoriales.horasDirectivasTotal}h • UTP: {statsTerritoriales.horasTecnicoPedagogicasTotal}h
                  </span>
                </div>

                {/* 6. Horas Vacantes / Libres */}
                <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Horas Libres (Holgura)</span>
                  <div className="text-xl font-black text-amber-900 mt-1">
                    {statsTerritoriales.horasVacantesLibresTotal.toLocaleString()} <span className="text-xs font-bold text-amber-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-amber-700 mt-0.5 block font-semibold">
                    {statsTerritoriales.porcentajeVacantesGlobal}% contrato no asignado
                  </span>
                </div>
              </div>

              {/* Barra de Cuadre Completo de Jornada Docente (Suma 100%) */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <Scale className="w-4 h-4 text-orange-600" />
                      Estructura y Cuadre de la Jornada Docente Territorial ({statsTerritoriales.horasContratoTotal} hrs contratadas)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Composición exacta de las horas pagadas: Horas de Aula Asignadas + Proporción No Lectiva + Recreos Normativos + Institucionales Exentas + Horas Libres.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-semibold">
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-600"></span> Aula ({statsTerritoriales.porcentajeAulaGlobal}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-600"></span> Proporción ({statsTerritoriales.porcentajeNoLectivoGlobal}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500"></span> Recreos ({statsTerritoriales.porcentajeRecreoGlobal}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-slate-400"></span> Institucional ({statsTerritoriales.porcentajeInstitucionalGlobal}%)</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span> Libres ({statsTerritoriales.porcentajeVacantesGlobal}%)</span>
                  </div>
                </div>

                {/* Barra Multi-Segmento */}
                <div className="w-full h-7 rounded-xl overflow-hidden flex shadow-inner bg-slate-100 p-0.5">
                  <div
                    style={{ width: `${Math.max(5, statsTerritoriales.porcentajeAulaGlobal)}%` }}
                    className="bg-blue-600 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all first:rounded-l-lg"
                    title={`Aula: ${statsTerritoriales.horasAulaCronologicasTotal}h (${statsTerritoriales.porcentajeAulaGlobal}%)`}
                  >
                    Aula {statsTerritoriales.porcentajeAulaGlobal}%
                  </div>
                  <div
                    style={{ width: `${Math.max(5, statsTerritoriales.porcentajeNoLectivoGlobal)}%` }}
                    className="bg-purple-600 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                    title={`No Lectivo: ${statsTerritoriales.horasNoLectivasTotal}h (${statsTerritoriales.porcentajeNoLectivoGlobal}%)`}
                  >
                    No Lect. {statsTerritoriales.porcentajeNoLectivoGlobal}%
                  </div>
                  <div
                    style={{ width: `${Math.max(4, statsTerritoriales.porcentajeRecreoGlobal)}%` }}
                    className="bg-amber-500 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                    title={`Recreos: ${statsTerritoriales.horasRecreosTotal}h (${statsTerritoriales.porcentajeRecreoGlobal}%)`}
                  >
                    Rec. {statsTerritoriales.porcentajeRecreoGlobal}%
                  </div>
                  <div
                    style={{ width: `${Math.max(3, statsTerritoriales.porcentajeInstitucionalGlobal)}%` }}
                    className="bg-slate-400 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                    title={`Institucional: ${statsTerritoriales.horasInstitucionalesTotal}h (${statsTerritoriales.porcentajeInstitucionalGlobal}%)`}
                  >
                    Inst. {statsTerritoriales.porcentajeInstitucionalGlobal}%
                  </div>
                  <div
                    style={{ width: `${Math.max(4, statsTerritoriales.porcentajeVacantesGlobal)}%` }}
                    className="bg-emerald-500 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all last:rounded-r-lg"
                    title={`Horas Libres: ${statsTerritoriales.horasVacantesLibresTotal}h (${statsTerritoriales.porcentajeVacantesGlobal}%)`}
                  >
                    Libres {statsTerritoriales.porcentajeVacantesGlobal}%
                  </div>
                </div>

                {/* Cobertura Curricular y Bolsas de Financiamiento */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 block">Subvención General</span>
                    <div className="text-base font-black text-slate-900 mt-0.5">
                      {statsTerritoriales.financiamiento.subvencionGeneralTotal.toLocaleString()} <span className="text-[11px] font-normal text-slate-500">hrs</span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono">
                      Titular: {statsTerritoriales.financiamiento.subvencionGeneralTitular}h • Contrata: {statsTerritoriales.financiamiento.subvencionGeneralContrata}h
                    </div>
                  </div>

                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 text-xs">
                    <span className="font-bold text-purple-900 block">SEP (Ley 20.248)</span>
                    <div className="text-base font-black text-purple-900 mt-0.5">
                      {statsTerritoriales.financiamiento.sepTotal.toLocaleString()} <span className="text-[11px] font-normal text-purple-600">hrs</span>
                    </div>
                    <div className="text-[11px] text-purple-700 mt-1 font-mono">
                      Titular: {statsTerritoriales.financiamiento.sepTitular}h • Contrata: {statsTerritoriales.financiamiento.sepContrata}h
                    </div>
                  </div>

                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 text-xs">
                    <span className="font-bold text-blue-900 block">PIE (Decreto 170)</span>
                    <div className="text-base font-black text-blue-900 mt-0.5">
                      {statsTerritoriales.financiamiento.pieTotal.toLocaleString()} <span className="text-[11px] font-normal text-blue-600">hrs</span>
                    </div>
                    <div className="text-[11px] text-blue-700 mt-1 font-mono">
                      Titular: {statsTerritoriales.financiamiento.pieTitular}h • Contrata: {statsTerritoriales.financiamiento.pieContrata}h
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ENFOQUE 3: ASISTENTES DE LA EDUCACIÓN (LEY 21.109) */}
          {enfoqueEstamento === 'asistentes' && (
            <div className="space-y-6">
              {/* Tarjetas KPI de Asistentes de la Educación */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Dotación Asistentes</span>
                  <div className="text-3xl font-black text-slate-900 mt-2">
                    {statsTerritoriales.asistentesTerritorio.totalAsistentes} <span className="text-xs font-bold text-slate-400">personas</span>
                  </div>
                  <span className="text-xs text-slate-500 mt-1 block">
                    {statsTerritoriales.asistentesTerritorio.totalHoras.toLocaleString()} horas semanales contratadas
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
                  <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider block">Calidad Contractual</span>
                  <div className="text-xl font-black text-emerald-900 mt-2">
                    {statsTerritoriales.asistentesTerritorio.horasIndefinidas}h <span className="text-xs font-normal text-emerald-600">Indefinido</span>
                  </div>
                  <span className="text-xs text-emerald-700 mt-1 block">
                    Plazo Fijo: {statsTerritoriales.asistentesTerritorio.horasPlazoFijo}h • Honorarios: {statsTerritoriales.asistentesTerritorio.horasHonorarios}h
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-blue-200 bg-blue-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wider block">Duplas & Equipo PIE</span>
                  <div className="text-xl font-black text-blue-900 mt-2">
                    {statsTerritoriales.asistentesTerritorio.totalDuplasPsicosociales} <span className="text-xs font-normal text-blue-600">Duplas Psicosociales</span>
                  </div>
                  <span className="text-xs text-blue-700 mt-1 block">
                    {statsTerritoriales.asistentesTerritorio.totalEquipoPie} profesionales equipo multidisciplinario PIE
                  </span>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider block">Ratio Auxiliares Aseo</span>
                  <div className="text-xl font-black text-amber-900 mt-2">
                    1 : {statsTerritoriales.asistentesTerritorio.ratioAlumnosPorAuxiliar} <span className="text-xs font-normal text-amber-700">alumnos</span>
                  </div>
                  <span className="text-xs text-amber-700 mt-1 block">
                    {statsTerritoriales.asistentesTerritorio.auxiliares.count} auxiliares ({statsTerritoriales.asistentesTerritorio.auxiliares.horas}h)
                  </span>
                </div>
              </div>

              {/* Desglose por Estamentos Ley 21.109 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 border-b pb-3">
                  <Briefcase className="w-4 h-4 text-emerald-600" />
                  Distribución por Estamentos Ley 21.109
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3">
                  <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-200">
                    <span className="text-[10px] font-bold text-blue-700 uppercase block">Profesionales</span>
                    <div className="text-lg font-black text-blue-900 mt-1">{statsTerritoriales.asistentesTerritorio.profesionales.count} pers</div>
                    <span className="text-[11px] text-blue-700 font-mono">{statsTerritoriales.asistentesTerritorio.profesionales.horas} hrs</span>
                  </div>

                  <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200">
                    <span className="text-[10px] font-bold text-purple-700 uppercase block">Técnicos</span>
                    <div className="text-lg font-black text-purple-900 mt-1">{statsTerritoriales.asistentesTerritorio.tecnicos.count} pers</div>
                    <span className="text-[11px] text-purple-700 font-mono">{statsTerritoriales.asistentesTerritorio.tecnicos.horas} hrs</span>
                  </div>

                  <div className="p-3 bg-slate-100 rounded-xl border border-slate-300">
                    <span className="text-[10px] font-bold text-slate-700 uppercase block">Administrativos</span>
                    <div className="text-lg font-black text-slate-900 mt-1">{statsTerritoriales.asistentesTerritorio.administrativos.count} pers</div>
                    <span className="text-[11px] text-slate-700 font-mono">{statsTerritoriales.asistentesTerritorio.administrativos.horas} hrs</span>
                  </div>

                  <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
                    <span className="text-[10px] font-bold text-amber-700 uppercase block">Auxiliares de Servicio</span>
                    <div className="text-lg font-black text-amber-900 mt-1">{statsTerritoriales.asistentesTerritorio.auxiliares.count} pers</div>
                    <span className="text-[11px] text-amber-700 font-mono">{statsTerritoriales.asistentesTerritorio.auxiliares.horas} hrs</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tabla Comparativa de Establecimientos del Territorio */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden space-y-3 p-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-600" />
                  Matriz Territorial de Establecimientos ({colegiosTablaFiltrados.length} de {colegios.length})
                </h3>
                <p className="text-xs text-slate-500">
                  Desglose oficial de dotación docente, calidad jurídica, asistentes y horas disponibles escuela por escuela.
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
                  >
                  </input>
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
                    <th className="px-2 py-2.5 text-center text-blue-700">Docentes</th>
                    <th className="px-2 py-2.5 text-center text-blue-800">Hrs Docente</th>
                    <th className="px-2 py-2.5 text-center">Regla 80/20</th>
                    <th className="px-2 py-2.5 text-center text-emerald-700">Asistentes</th>
                    <th className="px-2 py-2.5 text-center text-emerald-800">Hrs Asist.</th>
                    <th className="px-2 py-2.5 text-center text-purple-700">Aula (HA)</th>
                    <th className="px-2 py-2.5 text-center">SEP</th>
                    <th className="px-2 py-2.5 text-center">PIE</th>
                    <th className="px-2 py-2.5 text-center text-amber-700">Horas Libres</th>
                    <th className="px-2 py-2.5 text-center">Cobertura Plan</th>
                    <th className="px-2 py-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {colegiosTablaFiltrados.map(st => {
                    const estReal = colegios.find(c => c.rbd === st.rbd);
                    const cumple8020 = st.calidadJuridica.cumpleNorma8020;

                    return (
                      <tr key={st.rbd} className="hover:bg-slate-50 transition-colors">
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
                        <td className="px-2 py-2.5 text-center font-bold text-blue-800">
                          {st.totalDocentes}
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-slate-800">
                          {st.horasContratoTotal}h
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                            cumple8020 ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}>
                            {st.calidadJuridica.porcentajeContrata}%
                          </span>
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-emerald-800">
                          {st.asistentes.totalAsistentes}
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-emerald-900">
                          {st.asistentes.totalHorasContrato}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-bold text-purple-700">
                          {st.horasAulaPedagogicasAsignadas} HA
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono">
                          {st.financiamiento.sepTotal + st.asistentes.sepHoras}h
                        </td>
                        <td className="px-2 py-2.5 text-center font-mono">
                          {st.financiamiento.pieTotal + st.asistentes.pieHoras}h
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          {st.horasVacantesLibresTotal > 0 ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                              {st.horasVacantesLibresTotal}h
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">0h</span>
                          )}
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            st.coberturaCurricularPorcentaje >= 100
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {st.coberturaCurricularPorcentaje}%
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
                    {statsColegioActivo.totalDocentes} docentes planta
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Regla 80/20</span>
                  <div className="text-lg font-black text-slate-900 mt-1">
                    {statsColegioActivo.calidadJuridica.porcentajeContrata}% <span className="text-xs font-normal text-slate-400">Contrata</span>
                  </div>
                  <span className="text-[11px] text-slate-500 mt-0.5 block">
                    Tit: {statsColegioActivo.calidadJuridica.titularesHoras}h • Con: {statsColegioActivo.calidadJuridica.contrataHoras}h
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-blue-200 bg-blue-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-blue-700 uppercase block">Aula Asignada</span>
                  <div className="text-xl font-black text-blue-900 mt-1">
                    {statsColegioActivo.horasAulaPedagogicasAsignadas} <span className="text-xs font-bold text-blue-400">HA</span>
                  </div>
                  <span className="text-[11px] text-blue-700 mt-0.5 block font-semibold">
                    {statsColegioActivo.horasAulaCronologicasAsignadas} hrs cron. ({statsColegioActivo.porcentajeAula}%)
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-purple-200 bg-purple-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-purple-700 uppercase block">No Lectivo + Recreos</span>
                  <div className="text-xl font-black text-purple-900 mt-1">
                    {(statsColegioActivo.horasNoLectivasCalculadas + statsColegioActivo.horasRecreoCalculadas).toFixed(1)} <span className="text-xs font-bold text-purple-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-purple-700 mt-0.5 block font-semibold">
                    HNL: {statsColegioActivo.horasNoLectivasCalculadas}h • Rec: {statsColegioActivo.horasRecreoCalculadas}h
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-emerald-700 uppercase block">Asistentes Educación</span>
                  <div className="text-xl font-black text-emerald-900 mt-1">
                    {statsColegioActivo.asistentes.totalAsistentes} <span className="text-xs font-bold text-emerald-400">pers</span>
                  </div>
                  <span className="text-[11px] text-emerald-700 mt-0.5 block font-semibold">
                    {statsColegioActivo.asistentes.totalHorasContrato}h contratadas
                  </span>
                </div>

                <div className="bg-white p-4 rounded-xl border border-amber-200 bg-amber-50/20 shadow-sm">
                  <span className="text-[10px] font-bold text-amber-700 uppercase block">Horas Libres</span>
                  <div className="text-xl font-black text-amber-900 mt-1">
                    {statsColegioActivo.horasVacantesLibresTotal} <span className="text-xs font-bold text-amber-400">hrs</span>
                  </div>
                  <span className="text-[11px] text-amber-700 mt-0.5 block font-semibold">
                    {statsColegioActivo.porcentajeVacantes}% sin asignar
                  </span>
                </div>
              </div>

              {/* Medidor de Cuadre de Jornada Escolar Intra-Escuela */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                    <Scale className="w-4 h-4 text-orange-600" />
                    Composición y Cuadre de la Jornada Docente ({statsColegioActivo.nombre})
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Minutos Contratados: {statsColegioActivo.minutosContratoTotal} min ({statsColegioActivo.horasContratoTotal} hrs)
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
                    className="bg-slate-400 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all"
                  >
                    Inst. {statsColegioActivo.porcentajeInstitucional}%
                  </div>
                  <div
                    style={{ width: `${Math.max(4, statsColegioActivo.porcentajeVacantes)}%` }}
                    className="bg-emerald-500 h-full flex items-center justify-center text-[11px] font-black text-white px-2 transition-all last:rounded-r-lg"
                  >
                    Libres {statsColegioActivo.porcentajeVacantes}%
                  </div>
                </div>

                {/* Desglose de Financiamiento Escolar */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 block">Subvención General</span>
                    <div className="text-sm font-black text-slate-900 mt-0.5">
                      {statsColegioActivo.financiamiento.subvencionGeneralTotal + statsColegioActivo.asistentes.subvencionGeneralHoras} hrs
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Docentes: {statsColegioActivo.financiamiento.subvencionGeneralTotal}h • Asistentes: {statsColegioActivo.asistentes.subvencionGeneralHoras}h
                    </span>
                  </div>

                  <div className="bg-purple-50/50 p-3 rounded-xl border border-purple-200 text-xs">
                    <span className="font-bold text-purple-900 block">SEP</span>
                    <div className="text-sm font-black text-purple-900 mt-0.5">
                      {statsColegioActivo.financiamiento.sepTotal + statsColegioActivo.asistentes.sepHoras} hrs
                    </div>
                    <span className="text-[10px] text-purple-700 font-mono">
                      Docentes: {statsColegioActivo.financiamiento.sepTotal}h • Asistentes: {statsColegioActivo.asistentes.sepHoras}h
                    </span>
                  </div>

                  <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-200 text-xs">
                    <span className="font-bold text-blue-900 block">PIE</span>
                    <div className="text-sm font-black text-blue-900 mt-0.5">
                      {statsColegioActivo.financiamiento.pieTotal + statsColegioActivo.asistentes.pieHoras} hrs
                    </div>
                    <span className="text-[10px] text-blue-700 font-mono">
                      Docentes: {statsColegioActivo.financiamiento.pieTotal}h • Asistentes: {statsColegioActivo.asistentes.pieHoras}h
                    </span>
                  </div>
                </div>
              </div>

              {/* Nómina Detallada Docente */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
                <div className="border-b pb-2 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <GraduationCap className="w-4 h-4 text-blue-600" />
                      Nómina de Planta Docente ({statsColegioActivo.desgloseDocentes.length} funcionarios)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Desglose individual de calidad jurídica, horas de aula, no lectivo, recreos y holgura horaria.
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                      <tr>
                        <th className="px-3 py-2.5">Funcionario</th>
                        <th className="px-2 py-2.5">Calidad Jurídica</th>
                        <th className="px-2 py-2.5 text-center">Horas Contrato</th>
                        <th className="px-2 py-2.5 text-center text-blue-700">Aula (HA)</th>
                        <th className="px-2 py-2.5 text-center text-purple-700">No Lectivo</th>
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
                        <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5 font-bold text-slate-900">
                            {d.nombreCompleto}
                            <span className="block text-[10px] text-slate-400 font-mono font-normal">{d.run}</span>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              d.calidadJuridica === 'TITULAR'
                                ? 'bg-blue-100 text-blue-800'
                                : d.calidadJuridica === 'POSTULANDO_A_TITULARIDAD'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}>
                              {d.calidadJuridica}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-center font-bold text-slate-800">{d.horasContrato}h</td>
                          <td className="px-2 py-2.5 text-center font-bold text-blue-700">{d.horasAulaPedagogicas} HA</td>
                          <td className="px-2 py-2.5 text-center font-semibold text-purple-700">{d.horasNoLectivas}h</td>
                          <td className="px-2 py-2.5 text-center font-semibold text-amber-700">{d.horasRecreo}h</td>
                          <td className="px-2 py-2.5 text-center font-semibold text-emerald-700">{d.horasColaborativo}h</td>
                          <td className="px-2 py-2.5 text-center font-mono">{d.horasSep}h</td>
                          <td className="px-2 py-2.5 text-center font-mono">{d.horasPie}h</td>
                          <td className="px-2 py-2.5 text-center font-mono">{d.horasSubvGeneral}h</td>
                          <td className="px-2 py-2.5 text-center">
                            {d.estaSobreasignado ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                                Sobreasignado
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                Conforme
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Nómina Detallada de Asistentes de la Educación */}
              {statsColegioActivo.asistentes.totalAsistentes > 0 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden p-4 space-y-3">
                  <div className="border-b pb-2 flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-emerald-600" />
                        Nómina de Asistentes de la Educación ({statsColegioActivo.asistentes.totalAsistentes} funcionarios)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Personal regido por Ley 21.109: Profesionales, Técnicos, Administrativos y Auxiliares de Servicio.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                        <tr>
                          <th className="px-3 py-2.5">Funcionario</th>
                          <th className="px-2 py-2.5">Cargo / Función</th>
                          <th className="px-2 py-2.5 text-center">Estamento</th>
                          <th className="px-2 py-2.5 text-center">Horas Contrato</th>
                          <th className="px-2 py-2.5 text-center">Subv. General</th>
                          <th className="px-2 py-2.5 text-center">SEP</th>
                          <th className="px-2 py-2.5 text-center">PIE</th>
                          <th className="px-2 py-2.5 text-center">Clasificación Operativa</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {statsColegioActivo.asistentes.desglose.map(a => (
                          <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-2.5 font-bold text-slate-900">
                              {a.nombres} {a.apellidos}
                              <span className="block text-[10px] text-slate-400 font-mono font-normal">{a.run}</span>
                            </td>
                            <td className="px-2 py-2.5 font-semibold text-slate-800">{a.cargoFuncion}</td>
                            <td className="px-2 py-2.5 text-center">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                                {a.estamento}
                              </span>
                            </td>
                            <td className="px-2 py-2.5 text-center font-bold text-slate-900">{a.horasContrato}h</td>
                            <td className="px-2 py-2.5 text-center font-mono">
                              {(Number(a.horasSubvencionGeneralIndefinido) || 0) + (Number(a.horasSubvencionGeneralPlazoFijo) || 0)}h
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono">
                              {(Number(a.horasSepIndefinido) || 0) + (Number(a.horasSepPlazoFijo) || 0)}h
                            </td>
                            <td className="px-2 py-2.5 text-center font-mono">
                              {(Number(a.horasPieIndefinido) || 0) + (Number(a.horasPiePlazoFijo) || 0)}h
                            </td>
                            <td className="px-2 py-2.5 text-center">
                              {a.esDuplaPsicosocial && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800 mr-1">
                                  Dupla
                                </span>
                              )}
                              {a.esEquipoPie && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 mr-1">
                                  PIE
                                </span>
                              )}
                              {a.esAuxiliarServicio && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                                  Aseo
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-500">
              Selecciona un establecimiento escolar para ver su ficha y auditoría intra-escuela.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
