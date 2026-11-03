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
  GraduationCap,
  Download,
  RefreshCw,
  Sparkles,
  FolderArchive,
  X,
  Check,
  Settings,
  Filter
} from 'lucide-react';
import { 
  Establecimiento, 
  Docente, 
  AsignacionHoraria, 
  InconsistenciaTerritorial,
  DocenteConsolidadoTerritorial,
  AsistenteEducacion,
  CursoSae
} from '../types';
import { 
  DiagnosticoColegioCompleto, 
  consolidarCarteraTerritorial,
  obtenerDocentesConsolidadosTerritorio
} from '../services/dotacionCalculationService';
import { DocenteFichaDetalleModal } from '../components/DocenteFichaDetalleModal';
import { GdpParametrosModal } from '../components/GdpParametrosModal';
import { importarPlanillaPalDEP, generarExcelConsolidadoPalDEP } from '../services/depPalExportService';
import { generarExcelGdpColegio } from '../services/depGdpExportService';
import { guardarArchivoNativoOEnNavegador } from '../services/excelReportService';

interface ConsolidadorMasterViewProps {
  establecimientos: Establecimiento[];
  docentes: Docente[];
  asistentes?: AsistenteEducacion[];
  cursos?: CursoSae[];
  diagnosticos: DiagnosticoColegioCompleto[];
  asignaciones?: AsignacionHoraria[];
  onImportarCarteraSlep: (file: File) => void;
  onExportarExcel: () => void;
  onRecargarDatos?: () => Promise<void> | void;
  onGuardarColegio?: (est: Establecimiento) => Promise<void>;
}

export const ConsolidadorMasterView: React.FC<ConsolidadorMasterViewProps> = ({
  establecimientos,
  docentes,
  asistentes = [],
  cursos = [],
  diagnosticos,
  asignaciones = [],
  onImportarCarteraSlep,
  onExportarExcel,
  onRecargarDatos,
  onGuardarColegio
}) => {
  const [tabActiva, setTabActiva] = useState<'balance' | 'docentes'>('balance');
  const [filtroDocentes, setFiltroDocentes] = useState('');
  const [docenteFicha, setDocenteFicha] = useState<DocenteConsolidadoTerritorial | null>(null);
  const [procesandoPal, setProcesandoPal] = useState(false);
  const [recargandoDatos, setRecargandoDatos] = useState(false);
  const [feedbackPal, setFeedbackPal] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  
  // Estados para Modal de Exportación GDP (Individual o Masivo)
  const [modalGdpAbierto, setModalGdpAbierto] = useState(false);
  const [colegioGdpId, setColegioGdpId] = useState<string>(establecimientos[0]?.rbd || '');
  const [filtroColegioGdp, setFiltroColegioGdp] = useState<string>('');
  const [modoExportacionGdp, setModoExportacionGdp] = useState<'individual' | 'masivo'>('individual');
  const [progresoMasivo, setProgresoMasivo] = useState<{ actual: number; total: number; nombre: string } | null>(null);
  const [colegioParaParametros, setColegioParaParametros] = useState<Establecimiento | null>(null);

  const handleImportarPalOficial = async (file: File) => {
    try {
      setProcesandoPal(true);
      setFeedbackPal(null);
      const buffer = await file.arrayBuffer();
      const resultado = await importarPlanillaPalDEP(buffer, 2027);
      setFeedbackPal({
        tipo: 'success',
        texto: `¡Planilla PAL importada exitosamente! Se procesaron ${resultado.docentesImportados} registros docentes y ${resultado.asistentesImportados} asistentes en ${resultado.colegiosDetectados} colegios.`
      });
      if (onRecargarDatos) {
        await onRecargarDatos();
      }
    } catch (err: any) {
      setFeedbackPal({
        tipo: 'error',
        texto: `Error al importar Planilla PAL: ${err.message || err}`
      });
    } finally {
      setProcesandoPal(false);
    }
  };

  const handleExportarPalOficial = async () => {
    try {
      setProcesandoPal(true);
      setFeedbackPal(null);
      const bytes = await generarExcelConsolidadoPalDEP(
        establecimientos,
        docentes,
        asistentes,
        cursos,
        asignaciones
      );
      await guardarArchivoNativoOEnNavegador(
        bytes,
        `Planilla_Final_PAL_2027_DEP_SLEP_Valle_Diguillin_${Date.now()}.xlsx`
      );
      setFeedbackPal({
        tipo: 'success',
        texto: 'Planilla Final PAL 2027 DEP generada con éxito, preservando el 100% de las fórmulas nativas de Excel.'
      });
    } catch (err: any) {
      setFeedbackPal({
        tipo: 'error',
        texto: `Error al exportar Planilla PAL DEP: ${err.message || err}`
      });
    } finally {
      setProcesandoPal(false);
    }
  };

  const handleExportarGdpIndividual = async (est: Establecimiento) => {
    try {
      setProcesandoPal(true);
      setFeedbackPal(null);
      const docColegio = docentes.filter(d => String(d.rbd) === String(est.rbd));
      const aeColegio = asistentes.filter(a => String(a.rbd) === String(est.rbd));
      const curColegio = cursos.filter(c => String(c.rbd) === String(est.rbd));
      const asigColegio = asignaciones.filter(a => String(a.rbd) === String(est.rbd));

      const bytes = await generarExcelGdpColegio(est, docColegio, aeColegio, curColegio, asigColegio);
      const nombreLimpio = est.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
      const filename = `Planilla_GDP_${nombreLimpio}_RBD_${est.rbd}.xlsx`;

      await guardarArchivoNativoOEnNavegador(
        bytes,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        [{ name: 'Planilla Oficial GDP Microsoft Excel', extensions: ['xlsx'] }]
      );

      setFeedbackPal({
        tipo: 'success',
        texto: `✓ Planilla GDP individual de ${est.nombre} (RBD ${est.rbd}) exportada con éxito (6 hojas oficiales con fórmulas nativas).`
      });
      setModalGdpAbierto(false);
    } catch (err: any) {
      setFeedbackPal({
        tipo: 'error',
        texto: `Error al exportar Planilla GDP: ${err.message || err}`
      });
    } finally {
      setProcesandoPal(false);
    }
  };

  const handleExportarTodasLasGdp = async () => {
    try {
      setProcesandoPal(true);
      setFeedbackPal(null);
      let count = 0;
      const total = establecimientos.length;
      for (let i = 0; i < total; i++) {
        const est = establecimientos[i];
        setProgresoMasivo({ actual: i + 1, total, nombre: est.nombre });
        const docColegio = docentes.filter(d => String(d.rbd) === String(est.rbd));
        const aeColegio = asistentes.filter(a => String(a.rbd) === String(est.rbd));
        const curColegio = cursos.filter(c => String(c.rbd) === String(est.rbd));
        const asigColegio = asignaciones.filter(a => String(a.rbd) === String(est.rbd));
        
        const bytes = await generarExcelGdpColegio(est, docColegio, aeColegio, curColegio, asigColegio);
        const nombreLimpio = est.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
        const filename = `Planilla_GDP_${nombreLimpio}_RBD_${est.rbd}.xlsx`;

        await guardarArchivoNativoOEnNavegador(
          bytes,
          filename,
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          [{ name: 'Planilla Oficial GDP Microsoft Excel', extensions: ['xlsx'] }]
        );
        count++;
      }
      setFeedbackPal({
        tipo: 'success',
        texto: `✓ Se generaron exitosamente las planillas GDP para los ${count} colegios del territorio.`
      });
      setModalGdpAbierto(false);
    } catch (err: any) {
      setFeedbackPal({
        tipo: 'error',
        texto: `Error al generar planillas GDP en lote: ${err.message || err}`
      });
    } finally {
      setProcesandoPal(false);
      setProgresoMasivo(null);
    }
  };

  const [filtroTipoDocente, setFiltroTipoDocente] = useState<'todos' | 'multicontrato' | 'exceso'>('todos');

  const consolidacion = consolidarCarteraTerritorial(establecimientos, docentes, diagnosticos);
  const { inconsistencias, docentesCompartidos, resumenPorComuna, vacantesCruzadas } = consolidacion;

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
    let filtrados = docentesConsolidados;

    if (filtroTipoDocente === 'multicontrato') {
      filtrados = filtrados.filter(d => d.contratos.length > 1);
    } else if (filtroTipoDocente === 'exceso') {
      filtrados = filtrados.filter(d => d.excedeLimiteSlep);
    }

    const q = filtroDocentes.toLowerCase().trim();
    if (!q) return filtrados;
    return filtrados.filter(d => 
      d.nombres.toLowerCase().includes(q) ||
      d.apellidos.toLowerCase().includes(q) ||
      d.run.toLowerCase().includes(q) ||
      d.colegiosNombres.some(cn => cn.toLowerCase().includes(q))
    );
  }, [docentesConsolidados, filtroDocentes, filtroTipoDocente]);

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
                className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg shadow transition-all border border-blue-400 active:scale-95 disabled:opacity-60"
                title="Leer la información actual disponible en la base de datos (Periodo 2027)"
              >
                <RefreshCw className={`w-4 h-4 ${recargandoDatos ? 'animate-spin' : ''}`} />
                <span>{recargandoDatos ? 'Actualizando 2027...' : 'Actualizar Información 2027'}</span>
              </button>
            )}

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

      {/* ── CENTRO OFICIAL DEP (PLANILLA PAL 2027 & GDP) ── */}
      <div className="bg-gradient-to-r from-blue-900/10 via-indigo-900/10 to-slate-900/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-slate-900/40 border border-blue-200 dark:border-blue-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20 shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                  Centro de Intercambio Oficial DEP (Planilla PAL 2027 & GDP)
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  Estándar Ministerial
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                Poblado y homologación automática al milímetro preservando fórmulas nativas de Excel (<code className="font-mono text-[11px] bg-slate-200 dark:bg-slate-800 px-1 rounded">VLOOKUP</code>, <code className="font-mono text-[11px] bg-slate-200 dark:bg-slate-800 px-1 rounded">SUMIFS</code>, tablas 65/35 y 60/40).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón Importar PAL Oficial */}
            <label className="flex items-center gap-1.5 px-3.5 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold rounded-xl cursor-pointer transition-all border border-slate-300 dark:border-slate-700 shadow-sm active:scale-[0.98]">
              <FileUp className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>Importar PAL Oficial (.xlsx)</span>
              <input
                type="file"
                accept=".xlsx"
                className="hidden"
                disabled={procesandoPal}
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleImportarPalOficial(file);
                  e.target.value = '';
                }}
              />
            </label>

            {/* Botón Exportar Planilla Final PAL 2027 DEP */}
            <button
              onClick={handleExportarPalOficial}
              disabled={procesandoPal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-blue-600/20 active:scale-[0.98]"
              title="Genera el libro único territorial con hojas DOCENTE, AE y Establecimiento para envío a la DEP"
            >
              {procesandoPal ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4 text-blue-100" />
              )}
              <span>Exportar PAL 2027 DEP (Territorial)</span>
            </button>

            {/* Botón Exportar Planilla Oficial GDP (Individual o Lote) */}
            <button
              onClick={() => {
                if (!colegioGdpId && establecimientos.length > 0) {
                  setColegioGdpId(establecimientos[0].rbd);
                }
                setModalGdpAbierto(true);
              }}
              disabled={procesandoPal}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-black rounded-xl transition-all shadow-md shadow-amber-600/20 active:scale-[0.98]"
              title="Abre el centro de exportación de Planilla GDP oficial para descargar por colegio individual o en lote territorial"
            >
              <FolderArchive className="w-4 h-4 text-amber-100" />
              <span>Exportar Planilla GDP (.xlsx)</span>
            </button>
          </div>
        </div>

        {/* Notificaciones y Feedback de Operaciones PAL/GDP */}
        {feedbackPal && (
          <div className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium animate-fade-in ${
            feedbackPal.tipo === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
          }`}>
            <div className="flex items-center gap-2">
              {feedbackPal.tipo === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              )}
              <span>{feedbackPal.texto}</span>
            </div>
            <button
              onClick={() => setFeedbackPal(null)}
              className="text-xs font-bold underline opacity-80 hover:opacity-100"
            >
              Cerrar
            </button>
          </div>
        )}
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
          {inconsistencias.length > 0 ? (
            <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 animate-pulse">
              {inconsistencias.length} {inconsistencias.length === 1 ? 'alerta' : 'alertas'}
            </span>
          ) : (
            <span className="bg-emerald-100 text-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 border border-emerald-200">
              0 alertas
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

          {/* Sección 1: Auditoría de Inconsistencias Normativas Reales (>44h) */}
          {inconsistencias.length === 0 ? (
            <div className="bg-gradient-to-r from-emerald-50/80 to-teal-50/80 border border-emerald-200/90 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3.5">
                <div className="p-3 bg-emerald-600 text-white rounded-xl shadow-sm">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-black text-emerald-950">
                      Cero Inconsistencias Normativas en el Territorio
                    </h4>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                      100% Conforme a Ley
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800/90 mt-0.5">
                    No se registran funcionarios docentes que superen el límite legal de 44 hrs semanales ni sobrecargas horarias indebidas entre escuelas.
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 border border-emerald-200 text-emerald-800 text-xs font-bold">
                <Scale className="w-4 h-4 text-emerald-600" />
                <span>Estatuto Docente DFL 1</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border-2 border-red-200 shadow-md overflow-hidden animate-in fade-in">
              <div className="px-6 py-4 bg-red-50/90 border-b border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-600 text-white rounded-xl shadow-sm">
                    <ShieldAlert className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-red-950 flex items-center gap-2">
                      <span>Auditoría de Inconsistencias Normativas: Exceso de Jornada Global (&gt;44h)</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-200 text-red-900">
                        Infracción Legal
                      </span>
                    </h3>
                    <p className="text-xs text-red-800 mt-0.5">
                      Vulneración al Art. 26 del Estatuto Docente (DFL 1). La jornada ordinaria territorial de trabajo no puede exceder 44 hrs cronológicas semanales.
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black px-3 py-1 rounded-full bg-red-600 text-white self-start sm:self-auto shadow-sm">
                  {inconsistencias.length} caso(s) infractor(es)
                </span>
              </div>

              <div className="divide-y divide-red-100">
                {inconsistencias.map((inc, idx) => (
                  <div key={idx} className="p-4 bg-red-50/30 hover:bg-red-50/60 text-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded font-black text-[10px] bg-red-600 text-white">
                          INFRACCIÓN SLEP (&gt;44h)
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {inc.docenteNombre}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">
                          RUN: {inc.run}
                        </span>
                      </div>

                      <p className="text-red-900 font-medium">{inc.descripcion}</p>

                      <div className="flex items-center gap-1.5 text-slate-600 pt-0.5">
                        <School className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="font-semibold text-[11px]">Colegios:</span>
                        <span className="text-[11px]">{inc.colegiosInvolucrados.join(' • ')}</span>
                      </div>
                    </div>

                    <div className="text-right whitespace-nowrap bg-white px-3.5 py-2 rounded-xl border border-red-200 self-end md:self-auto shrink-0">
                      <span className="text-lg font-black text-red-700">{inc.horasTotalesSumadas} hrs</span>
                      <span className="block text-[10px] font-bold text-red-600">
                        +{((inc.horasTotalesSumadas || 0) - 44)} hrs sobre el límite legal
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sección 2: Catálogo de Planta Docente Compartida (Multicontrato Conforme a Norma <=44h) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-indigo-50/70 via-slate-50 to-white border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm shadow-indigo-500/20">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900">
                      Planta Docente Compartida (Multicontrato Inter-Escuelas)
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 border border-indigo-200">
                      Conforme a Ley (&le;44h)
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Docentes asignados en dos o más escuelas del territorio sin superar el tope legal de 44 hrs. Se refleja el desglose de horas por establecimiento y la holgura disponible.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-start sm:self-auto">
                <span className="text-xs font-bold px-3 py-1 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200 shadow-sm">
                  {docentesCompartidos.length} docentes compartidos
                </span>
              </div>
            </div>

            {docentesCompartidos.length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-xs">
                No se registran docentes con contratos compartidos entre múltiples colegios.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[460px] overflow-y-auto">
                {docentesCompartidos.map((dc, idx) => {
                  const docenteMatch = docentesConsolidados.find(d => d.run === dc.run);
                  return (
                    <div key={idx} className="p-4 hover:bg-slate-50/80 text-xs flex flex-col lg:flex-row lg:items-center justify-between gap-3 transition-colors">
                      <div className="space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 text-sm">
                            {dc.docenteNombre}
                          </span>
                          <span className="font-mono text-slate-400 text-[11px]">
                            RUN: {dc.run}
                          </span>
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            dc.horasDisponiblesHastaTope > 0
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}>
                            {dc.horasDisponiblesHastaTope > 0
                              ? `+${dc.horasDisponiblesHastaTope} hrs disponibles`
                              : 'Jornada Completa (44 hrs)'}
                          </span>
                        </div>

                        {/* Desglose visual por establecimiento */}
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {dc.colegiosInvolucrados.map((col, cIdx) => (
                            <div key={cIdx} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/90 hover:bg-slate-200/70 text-slate-700 text-[11px] border border-slate-200">
                              <School className="w-3.5 h-3.5 text-slate-400" />
                              <span className="font-semibold">{col.colegio}</span>
                              <span className="font-mono font-black text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-indigo-100">
                                {col.horas}h
                              </span>
                              {col.comuna && (
                                <span className="text-[10px] text-slate-400">({col.comuna})</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 self-end lg:self-auto">
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900">
                            {dc.horasTotalesSumadas} hrs
                          </span>
                          <span className="block text-[10px] text-slate-400">Total semanal SLEP</span>
                        </div>

                        {docenteMatch && (
                          <button
                            type="button"
                            onClick={() => setDocenteFicha(docenteMatch)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-bold transition-all border border-blue-200 shadow-sm active:scale-95"
                            title="Abrir Ficha Técnica 360°"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Ficha</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
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

          {/* Barra de Búsqueda y Filtros Rápidos */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-slate-500 mr-1 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5" />
                  Filtrar nómina:
                </span>
                <button
                  type="button"
                  onClick={() => setFiltroTipoDocente('todos')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroTipoDocente === 'todos'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  Todos ({docentesConsolidados.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipoDocente('multicontrato')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroTipoDocente === 'multicontrato'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Solo Multicontrato ({docentesMultiEscuelaCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroTipoDocente('exceso')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                    filtroTipoDocente === 'exceso'
                      ? 'bg-red-600 text-white shadow-sm'
                      : 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>Con Infracción &gt;44h ({docentesExceso44hCount})</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-500 font-medium self-end sm:self-auto">
                Mostrando <strong className="text-slate-800">{docentesFiltrados.length}</strong> de {docentesConsolidados.length} docentes
              </div>
            </div>

            <div className="flex items-center gap-2 bg-slate-50 px-3.5 py-2 rounded-lg border border-slate-200 focus-within:border-blue-500 focus-within:bg-white transition-all">
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
                  type="button"
                  onClick={() => setFiltroDocentes('')}
                  className="text-xs text-slate-400 hover:text-slate-600 font-semibold"
                >
                  Limpiar
                </button>
              )}
            </div>
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

      {/* ── MODAL EXPORTACIÓN PLANILLA OFICIAL GDP (INDIVIDUAL O MASIVA) ── */}
      {modalGdpAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden my-auto animate-scale-in">
            {/* Header del Modal */}
            <div className="bg-gradient-to-r from-[#002B49] via-slate-900 to-indigo-950 p-5 px-6 text-white flex items-center justify-between border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 rounded-2xl border border-amber-500/30 text-amber-400">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-amber-600/30 text-amber-300 border border-amber-500/40">
                    Formato Oficial DEP (6 Hojas)
                  </div>
                  <h3 className="text-base font-black text-white mt-1">
                    Exportación de Planilla Oficial GDP
                  </h3>
                  <p className="text-xs text-slate-300">
                    Elige si deseas exportar un establecimiento de forma individual o la cartera territorial completa.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setModalGdpAbierto(false);
                  setProgresoMasivo(null);
                }}
                disabled={procesandoPal}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Pestañas de Modo: Individual vs Masivo */}
            <div className="p-5 space-y-4">
              <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-2xl">
                <button
                  type="button"
                  onClick={() => setModoExportacionGdp('individual')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                    modoExportacionGdp === 'individual'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  <span>Exportación Individual (Por Colegio)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModoExportacionGdp('masivo')}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black transition-all ${
                    modoExportacionGdp === 'masivo'
                      ? 'bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                  }`}
                >
                  <FolderArchive className="w-4 h-4" />
                  <span>Exportación Masiva ({establecimientos.length} Colegios)</span>
                </button>
              </div>

              {/* CONTENIDO MODO INDIVIDUAL */}
              {modoExportacionGdp === 'individual' && (
                <div className="space-y-4 animate-fade-in">
                  {/* Buscador de Colegio */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filtrar colegio por nombre o RBD..."
                      value={filtroColegioGdp}
                      onChange={e => setFiltroColegioGdp(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* Selector Desplegable de Colegios */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      Selecciona el Establecimiento a Exportar:
                    </label>
                    <select
                      value={colegioGdpId}
                      onChange={e => setColegioGdpId(e.target.value)}
                      className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-xs font-bold focus:ring-2 focus:ring-blue-500"
                    >
                      {establecimientos
                        .filter(est => {
                          const q = filtroColegioGdp.toLowerCase().trim();
                          if (!q) return true;
                          return est.nombre.toLowerCase().includes(q) || String(est.rbd).includes(q) || est.comuna.toLowerCase().includes(q);
                        })
                        .map(est => (
                          <option key={est.rbd} value={est.rbd}>
                            [RBD {est.rbd}] {est.nombre} ({est.comuna})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Tarjeta de Resumen del Colegio Seleccionado */}
                  {(() => {
                    const estSel = establecimientos.find(est => String(est.rbd) === String(colegioGdpId)) || establecimientos[0];
                    if (!estSel) return null;
                    const docSel = docentes.filter(d => String(d.rbd) === String(estSel.rbd));
                    const aeSel = asistentes.filter(a => String(a.rbd) === String(estSel.rbd));
                    const curSel = cursos.filter(c => String(c.rbd) === String(estSel.rbd));
                    const totalHrsDoc = docSel.reduce((s, d) => s + (d.horasContrato || 0), 0);
                    const totalHrsAe = aeSel.reduce((s, a) => s + (a.horasContrato || 0), 0);

                    return (
                      <div className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-[10px] font-black px-2 py-0.5 rounded bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-300">
                                RBD {estSel.rbd}
                              </span>
                              <span className="text-[11px] font-bold text-slate-500">
                                {estSel.comuna}
                              </span>
                            </div>
                            <h4 className="font-black text-sm text-slate-900 dark:text-white mt-1">
                              {estSel.nombre}
                            </h4>
                            <p className="text-[11px] text-slate-500">
                              Asesor UATP: {estSel.asesorUatp || '⚠️ Sin Asignar'}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setColegioParaParametros(estSel)}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-xl transition-colors border border-slate-200 dark:border-slate-700"
                            title="Ajustar subvenciones SEP/Pro-Retención y cupos PIE antes de exportar"
                          >
                            <Settings className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Chips de dotación */}
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[10px] font-bold text-slate-400">DOCENTES</span>
                            <span className="text-xs font-black text-slate-800 dark:text-white">
                              {docSel.length} func.
                            </span>
                            <span className="block text-[9px] text-slate-400">{totalHrsDoc}h contratadas</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[10px] font-bold text-slate-400">ASISTENTES</span>
                            <span className="text-xs font-black text-slate-800 dark:text-white">
                              {aeSel.length} func.
                            </span>
                            <span className="block text-[9px] text-slate-400">{totalHrsAe}h contratadas</span>
                          </div>
                          <div className="bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-700">
                            <span className="block text-[10px] font-bold text-slate-400">CURSOS</span>
                            <span className="text-xs font-black text-slate-800 dark:text-white">
                              {curSel.length} cursos
                            </span>
                            <span className="block text-[9px] text-slate-400">Planes MINEDUC</span>
                          </div>
                        </div>

                        {/* Parámetros Financieros Actuales */}
                        <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-2">
                          <span>Subvención SEP: <strong>${(estSel.subvencionSepMensual || 0).toLocaleString('es-CL')}/mes</strong></span>
                          <span>Pro-Retención: <strong>${(estSel.subvencionProRetencion || 0).toLocaleString('es-CL')}</strong></span>
                        </div>

                        {/* Botón de Exportación Individual */}
                        <div className="pt-2 flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleExportarGdpIndividual(estSel)}
                            disabled={procesandoPal}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/20 active:scale-[0.98]"
                          >
                            {procesandoPal ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Download className="w-4 h-4" />
                            )}
                            <span>Descargar Planilla GDP Individual (.xlsx)</span>
                          </button>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* CONTENIDO MODO MASIVO */}
              {modoExportacionGdp === 'masivo' && (
                <div className="space-y-4 animate-fade-in text-xs">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/40 rounded-2xl border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
                    <div className="flex items-center gap-2 font-black text-sm">
                      <FolderArchive className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <span>Exportación Territorial Completa</span>
                    </div>
                    <p className="text-xs">
                      Esta operación generará de manera consecutiva los <strong>{establecimientos.length} archivos Excel individuales (.xlsx)</strong> de Planilla GDP para todos los establecimientos de Bulnes, Chillán Viejo, El Carmen, Pemuco, San Ignacio y Yungay.
                    </p>
                  </div>

                  {progresoMasivo && (
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-2">
                      <div className="flex items-center justify-between font-bold text-xs">
                        <span>Generando colegio {progresoMasivo.actual} de {progresoMasivo.total}...</span>
                        <span className="font-mono text-blue-600">
                          {Math.round((progresoMasivo.actual / progresoMasivo.total) * 100)}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 dark:bg-slate-700 h-2.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-500 h-full rounded-full transition-all duration-200"
                          style={{ width: `${(progresoMasivo.actual / progresoMasivo.total) * 100}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {progresoMasivo.nombre}
                      </p>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={handleExportarTodasLasGdp}
                      disabled={procesandoPal}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 disabled:opacity-50 text-white rounded-xl text-xs font-black transition-all shadow-md shadow-amber-600/20 active:scale-[0.98]"
                    >
                      {procesandoPal ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <FolderArchive className="w-4 h-4" />
                      )}
                      <span>Exportar los {establecimientos.length} Colegios en Lote</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal para editar parámetros de establecimiento si se requiere */}
      {colegioParaParametros && (
        <GdpParametrosModal
          isOpen={Boolean(colegioParaParametros)}
          onClose={() => setColegioParaParametros(null)}
          establecimiento={colegioParaParametros}
          docentes={docentes.filter(d => String(d.rbd) === String(colegioParaParametros.rbd))}
          asistentes={asistentes.filter(a => String(a.rbd) === String(colegioParaParametros.rbd))}
          cursos={cursos.filter(c => String(c.rbd) === String(colegioParaParametros.rbd))}
          asignaciones={asignaciones.filter(a => String(a.rbd) === String(colegioParaParametros.rbd))}
          onGuardarEstablecimiento={onGuardarColegio || (async () => {})}
          onNotificar={(msg, tipo) => setFeedbackPal({ tipo: tipo || 'success', texto: msg })}
        />
      )}
    </div>
  );
};
