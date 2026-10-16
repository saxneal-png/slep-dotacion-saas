import React, { useState, useMemo } from 'react';
import {
  Users, Building2, Search, Filter, ArrowRight, FileSpreadsheet, Download,
  CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, Sparkles, SlidersHorizontal,
  LayoutGrid, List, UserCheck, RefreshCw, ChevronRight, ChevronDown, Mail, Phone, MapPin,
  HelpCircle, ExternalLink, Settings, Plus, Check, ArrowUpDown, X, Globe, User
} from 'lucide-react';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, PerfilAsesor, AsistenteEducacion } from '../types';
import { DiagnosticoColegioCompleto, calcularDiagnosticoColegio } from '../services/dotacionCalculationService';
import { cargarConfiguracionGeneral, reasignarColegiosMasivo } from '../services/configuracionGeneralService';
import { GdpParametrosModal } from '../components/GdpParametrosModal';

interface ColegiosAsesoradosViewProps {
  colegios: Establecimiento[];
  colegioActivo: Establecimiento | null;
  onSelectColegio: (est: Establecimiento) => void;
  onAbrirWorkflow: (est: Establecimiento) => void;
  onExportarDotacionColegio: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onExportarMatrizExcelColegio: (est: Establecimiento, periodo: number) => Promise<void> | void;
  todosLosCursos: CursoSae[];
  todosLosDocentes: Docente[];
  todosLosAsistentes?: AsistenteEducacion[];
  todasLasSalas: any[];
  todasLasAsignaciones: AsignacionHoraria[];
  periodoActivo: number;
  onGuardarColegio: (est: Establecimiento) => Promise<void>;
  onAbrirConfiguraciones: () => void;
}

export const ColegiosAsesoradosView: React.FC<ColegiosAsesoradosViewProps> = ({
  colegios,
  colegioActivo,
  onSelectColegio,
  onAbrirWorkflow,
  onExportarDotacionColegio,
  onExportarMatrizExcelColegio,
  todosLosCursos,
  todosLosDocentes,
  todosLosAsistentes = [],
  todasLasSalas,
  todasLasAsignaciones,
  periodoActivo,
  onGuardarColegio,
  onAbrirConfiguraciones
}) => {
  const [config] = useState(() => cargarConfiguracionGeneral());
  const [asesorFiltro, setAsesorFiltro] = useState<string>(config.asesorActivoNombre || 'TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComuna, setSelectedComuna] = useState<string>('ALL');
  const [selectedRegimen, setSelectedRegimen] = useState<string>('ALL');
  const [selectedEstadoBalance, setSelectedEstadoBalance] = useState<string>('ALL');
  const [vistaModo, setVistaModo] = useState<'grid' | 'table'>('grid');
  const [modalReasignarAbierto, setModalReasignarAbierto] = useState(false);
  const [colegioParaGdp, setColegioParaGdp] = useState<Establecimiento | null>(null);
  const [colegiosSeleccionadosBatch, setColegiosSeleccionadosBatch] = useState<string[]>([]);
  const [asesorDestinoBatch, setAsesorDestinoBatch] = useState<string>(config.asesoresRegistrados[0]?.nombre || '');
  const [procesandoReasignacion, setProcesandoReasignacion] = useState(false);
  const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);

  // Lista de asesores únicos
  const todosLosAsesores = useMemo(() => {
    const map = new Map<string, PerfilAsesor>();
    for (const a of config.asesoresRegistrados) {
      map.set(a.nombre.toLowerCase().trim(), a);
    }
    for (const c of colegios) {
      if (c.asesorUatp && !map.has(c.asesorUatp.toLowerCase().trim())) {
        map.set(c.asesorUatp.toLowerCase().trim(), {
          id: `asesor-auto-${c.asesorUatp}`,
          nombre: c.asesorUatp,
          email: 'uatp@slepvallediguillin.cl',
          cargo: 'Asesor UATP'
        });
      }
    }
    return Array.from(map.values());
  }, [config.asesoresRegistrados, colegios]);

  // Perfil del Asesor actualmente filtrado
  const perfilAsesorSeleccionado = useMemo(() => {
    if (asesorFiltro === 'TODOS' || asesorFiltro === 'SIN_ASIGNAR') return null;
    return todosLosAsesores.find(a => a.nombre.toLowerCase().trim() === asesorFiltro.toLowerCase().trim()) || null;
  }, [asesorFiltro, todosLosAsesores]);

  // Diagnósticos precalculados
  const diagnosticosMap = useMemo(() => {
    const map = new Map<string, DiagnosticoColegioCompleto>();
    for (const est of colegios) {
      const cList = todosLosCursos.filter(c => c.rbd === est.rbd && (c.periodo === undefined || c.periodo === periodoActivo));
      const dList = todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo));
      const sList = todasLasSalas.filter(s => s.rbd === est.rbd);
      const aList = todasLasAsignaciones.filter(a => a.rbd === est.rbd && (a.periodo === undefined || a.periodo === periodoActivo));
      map.set(est.rbd, calcularDiagnosticoColegio(est, sList, cList, dList, aList));
    }
    return map;
  }, [colegios, todosLosCursos, todosLosDocentes, todasLasSalas, todasLasAsignaciones, periodoActivo]);

  // Filtrado reactivo de colegios
  const colegiosFiltrados = useMemo(() => {
    return colegios.filter(est => {
      if (asesorFiltro === 'SIN_ASIGNAR') {
        if (est.asesorUatp && est.asesorUatp.trim() !== '') return false;
      } else if (asesorFiltro !== 'TODOS') {
        if (!est.asesorUatp || est.asesorUatp.toLowerCase().trim() !== asesorFiltro.toLowerCase().trim()) {
          return false;
        }
      }

      if (selectedComuna !== 'ALL' && est.comuna !== selectedComuna) {
        return false;
      }

      if (selectedRegimen !== 'ALL' && est.regimen !== selectedRegimen) {
        return false;
      }

      if (selectedEstadoBalance !== 'ALL') {
        const diag = diagnosticosMap.get(est.rbd);
        const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
        if (selectedEstadoBalance === 'DEFICIT' && bal >= 0) return false;
        if (selectedEstadoBalance === 'SUPERAVIT' && bal <= 0) return false;
        if (selectedEstadoBalance === 'EQUILIBRADO' && bal !== 0) return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        const matchNombre = est.nombre.toLowerCase().includes(q);
        const matchRbd = est.rbd.toLowerCase().includes(q);
        const matchComuna = (est.comuna || '').toLowerCase().includes(q);
        const matchDirector = (est.director || '').toLowerCase().includes(q);
        const matchAsesor = (est.asesorUatp || '').toLowerCase().includes(q);
        return matchNombre || matchRbd || matchComuna || matchDirector || matchAsesor;
      }

      return true;
    });
  }, [colegios, asesorFiltro, selectedComuna, selectedRegimen, selectedEstadoBalance, searchTerm, diagnosticosMap]);

  // Métricas agregadas
  const metricasAsesor = useMemo(() => {
    let matriculaTotal = 0;
    let cursosTotal = 0;
    let cuposSaeTotal = 0;
    let horasContratadasTotal = 0;
    let horasAulaDemandadasTotal = 0;
    let horasLectivasAsignadasTotal = 0;
    let balanceNeto = 0;
    let colegiosConDeficit = 0;
    let colegiosConSuperavit = 0;
    let colegiosEquilibrados = 0;
    let totalInconsistencias = 0;

    const docentesSet = new Set<string>();

    for (const est of colegiosFiltrados) {
      const diag = diagnosticosMap.get(est.rbd);
      if (diag) {
        matriculaTotal += diag.balanzaGeneral.totalMatriculaProyectada || 0;
        cursosTotal += diag.balanzaGeneral.totalCursos || 0;
        cuposSaeTotal += diag.balanzaGeneral.totalCuposSae || 0;
        horasContratadasTotal += diag.balanzaGeneral.horasContratadasTotales || 0;
        horasAulaDemandadasTotal += diag.balanzaGeneral.horasAulaDemandadasCurriculo || 0;
        horasLectivasAsignadasTotal += diag.balanzaGeneral.horasLectivasAsignadas || 0;
        
        const bal = diag.balanzaGeneral.superavitDeficitLectivo || 0;
        balanceNeto += bal;
        if (bal < 0) colegiosConDeficit++;
        else if (bal > 0) colegiosConSuperavit++;
        else colegiosEquilibrados++;

        totalInconsistencias += (diag.balanzaGeneral.sobreasignacionesAlertas?.length || 0) +
          (diag.balanzaGeneral.alertasInfraestructura?.length || 0) +
          (diag.balanzaGeneral.alertasAforoPie?.length || 0);
      }

      for (const d of todosLosDocentes) {
        if (d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo)) {
          docentesSet.add(d.run);
        }
      }
    }

    return {
      totalColegios: colegiosFiltrados.length,
      matriculaTotal,
      cursosTotal,
      cuposSaeTotal,
      horasContratadasTotal,
      horasAulaDemandadasTotal,
      horasLectivasAsignadasTotal,
      balanceNeto,
      docentesTotal: docentesSet.size,
      colegiosConDeficit,
      colegiosConSuperavit,
      colegiosEquilibrados,
      totalInconsistencias
    };
  }, [colegiosFiltrados, diagnosticosMap, todosLosDocentes, periodoActivo]);

  // Handlers de reasignación
  const handleCambiarAsesorColegio = async (est: Establecimiento, nuevoAsesor: string) => {
    const asesorValor = nuevoAsesor === 'SIN_ASIGNAR' || nuevoAsesor.trim() === '' ? undefined : nuevoAsesor.trim();
    try {
      const actualizado: Establecimiento = {
        ...est,
        asesorUatp: asesorValor
      };
      await onGuardarColegio(actualizado);
      setMensajeFeedback(
        asesorValor
          ? `✓ "${est.nombre}" reasignado a ${asesorValor}.`
          : `✓ "${est.nombre}" marcado como Sin Asignar.`
      );
      setTimeout(() => setMensajeFeedback(null), 3000);
    } catch (e: any) {
      alert(`Error al reasignar colegio: ${e.message || e}`);
    }
  };

  const handleEjecutarReasignacionBatch = async () => {
    if (colegiosSeleccionadosBatch.length === 0 || !asesorDestinoBatch) return;
    setProcesandoReasignacion(true);
    try {
      await reasignarColegiosMasivo(colegiosSeleccionadosBatch, asesorDestinoBatch, colegios);
      setMensajeFeedback(`✓ Se han reasignado ${colegiosSeleccionadosBatch.length} establecimientos a ${asesorDestinoBatch}.`);
      setColegiosSeleccionadosBatch([]);
      setModalReasignarAbierto(false);
      setTimeout(() => setMensajeFeedback(null), 4000);
    } catch (e: any) {
      alert(`Error al reasignar: ${e.message || e}`);
    } finally {
      setProcesandoReasignacion(false);
    }
  };

  const handleSeleccionarTodosLosFiltrados = () => {
    if (colegiosSeleccionadosBatch.length === colegiosFiltrados.length) {
      setColegiosSeleccionadosBatch([]);
    } else {
      setColegiosSeleccionadosBatch(colegiosFiltrados.map(c => c.rbd));
    }
  };

  const toggleSeleccionColegio = (rbd: string) => {
    setColegiosSeleccionadosBatch(prev => 
      prev.includes(rbd) ? prev.filter(r => r !== rbd) : [...prev, rbd]
    );
  };

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Toast Feedback */}
      {mensajeFeedback && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-emerald-300 border border-emerald-500/50 px-4 py-3 rounded-2xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-scale-in backdrop-blur-md">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{mensajeFeedback}</span>
        </div>
      )}

      {/* ── 1. COMANDO EJECUTIVO UATP (Apple Clean Design) ── */}
      <div className="card-elevated p-5 sm:p-6 bg-gradient-to-r from-surface-card via-surface-card to-slate-50/50 dark:to-slate-900/50 border border-border-subtle relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          
          {/* Título & Badge Institucional */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 text-[11px] font-extrabold uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Supervisión Territorial UATP</span>
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                • {colegios.length} Establecimientos en Territorio
              </span>
            </div>
            
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
              Control de Dotación & Asesorías Escolares
            </h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 max-w-xl leading-relaxed">
              Monitoreo analítico de horas lectivas, contratos Ley 20.903 y balance horario por asesor técnico.
            </p>
          </div>

          {/* Selector de Cartera & Botonera Artesanal */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* Segmented Control de Cartera */}
            <div className="flex items-center bg-slate-100 dark:bg-slate-800/90 p-1 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-inner">
              <button
                onClick={() => setAsesorFiltro(config.asesorActivoNombre)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  asesorFiltro === config.asesorActivoNombre
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Mis Colegios</span>
              </button>

              <button
                onClick={() => setAsesorFiltro('TODOS')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                  asesorFiltro === 'TODOS'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                }`}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>Todo ({colegios.length})</span>
              </button>

              {/* Selector Desplegable de Asesor */}
              <div className="relative">
                <select
                  value={asesorFiltro === config.asesorActivoNombre || asesorFiltro === 'TODOS' ? '' : asesorFiltro}
                  onChange={(e) => {
                    if (e.target.value) setAsesorFiltro(e.target.value);
                  }}
                  aria-label="Seleccionar otro asesor"
                  className={`appearance-none bg-transparent pl-2.5 pr-7 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors focus:outline-none ${
                    asesorFiltro !== config.asesorActivoNombre && asesorFiltro !== 'TODOS'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-700'
                  }`}
                >
                  <option value="" disabled className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                    Otro asesor...
                  </option>
                  <option value="SIN_ASIGNAR" className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                    ⚠️ Sin Asignar
                  </option>
                  {todosLosAsesores.map((a) => (
                    <option key={a.id || a.nombre} value={a.nombre} className="text-slate-900 dark:text-slate-100 bg-white dark:bg-slate-900">
                      👤 {a.nombre}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
              </div>
            </div>

            {/* Reasignar Lote */}
            <button
              onClick={() => {
                setColegiosSeleccionadosBatch([]);
                setModalReasignarAbierto(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 text-xs font-bold rounded-2xl border border-indigo-200 dark:border-indigo-800 transition-all shadow-xs active:scale-[0.98]"
              title="Reasignar colegios en lote"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reasignar Lote</span>
            </button>

            {/* Ajustes */}
            <button
              onClick={onAbrirConfiguraciones}
              className="p-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 rounded-2xl border border-slate-200 dark:border-slate-700 transition-all shadow-xs"
              title="Configuraciones UATP"
            >
              <Settings className="w-4 h-4 text-slate-600 dark:text-slate-300" />
            </button>

          </div>

        </div>

        {/* Ficha Dinámica del Asesor Seleccionado */}
        {perfilAsesorSeleccionado && (
          <div className="mt-4 pt-4 border-t border-border-subtle flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs text-white shadow-sm ring-1 ring-black/10"
                style={{ backgroundColor: perfilAsesorSeleccionado.colorBadge || '#007AFF' }}
              >
                {perfilAsesorSeleccionado.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <div className="font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
                  <span>{perfilAsesorSeleccionado.nombre}</span>
                  <span className="bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    {colegiosFiltrados.length} escuelas asignadas
                  </span>
                </div>
                <div className="text-slate-500 dark:text-slate-400 text-[11px] flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 font-medium">
                    <Mail className="w-3 h-3" />
                    {perfilAsesorSeleccionado.email}
                  </span>
                  {perfilAsesorSeleccionado.telefono && (
                    <span className="flex items-center gap-1 font-medium">
                      <Phone className="w-3 h-3" />
                      {perfilAsesorSeleccionado.telefono}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              onClick={onAbrirConfiguraciones}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              <span>Gestionar perfil de asesor</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* ── 2. DASHBOARD KPI (Bento Grid) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        {/* 1. Colegios */}
        <div className="card-elevated p-4 flex flex-col justify-between group hover:border-blue-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Escuelas</span>
            <div className="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{metricasAsesor.totalColegios}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5">en esta cartera</span>
          </div>
        </div>

        {/* 2. Docentes */}
        <div className="card-elevated p-4 flex flex-col justify-between group hover:border-indigo-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Docentes</span>
            <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{metricasAsesor.docentesTotal}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5">profesionales activos</span>
          </div>
        </div>

        {/* 3. Cursos */}
        <div className="card-elevated p-4 flex flex-col justify-between group hover:border-emerald-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cursos & SAE</span>
            <div className="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <LayoutGrid className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{metricasAsesor.cursosTotal}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5 tabular-nums">
              {metricasAsesor.matriculaTotal} matrícula total
            </span>
          </div>
        </div>

        {/* 4. Horas Contrato */}
        <div className="card-elevated p-4 flex flex-col justify-between group hover:border-purple-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Horas Contrato</span>
            <div className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black text-slate-900 dark:text-white tabular-nums">{metricasAsesor.horasContratadasTotal}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5">hrs cronológicas SLEP</span>
          </div>
        </div>

        {/* 5. Balance Territorial */}
        <div className={`p-4 rounded-2xl border transition-all flex flex-col justify-between shadow-xs ${
          metricasAsesor.balanceNeto < 0
            ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-900 text-rose-950 dark:text-rose-100'
            : metricasAsesor.balanceNeto > 0
            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-900 text-blue-950 dark:text-blue-100'
            : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-900 text-emerald-950 dark:text-emerald-100'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider">Balance Horario</span>
            <ArrowUpDown className="w-4 h-4 opacity-80" />
          </div>
          <div className="mt-3">
            <span className="text-2xl font-black tabular-nums">
              {metricasAsesor.balanceNeto > 0 ? `+${metricasAsesor.balanceNeto}` : metricasAsesor.balanceNeto}h
            </span>
            <span className="text-[11px] font-bold opacity-80 block mt-0.5">
              {metricasAsesor.colegiosConDeficit} déficit / {metricasAsesor.colegiosConSuperavit} superávit
            </span>
          </div>
        </div>

        {/* 6. Salud Normativa */}
        <div className="card-elevated p-4 flex flex-col justify-between group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">Salud Normativa</span>
            <div className={`p-1.5 rounded-xl ${metricasAsesor.totalInconsistencias > 0 ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'}`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className={`text-2xl font-black tabular-nums ${metricasAsesor.totalInconsistencias > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}`}>
              {metricasAsesor.totalInconsistencias}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 font-semibold block mt-0.5">
              {metricasAsesor.totalInconsistencias === 0 ? '✓ 100% Cuadrado' : 'alertas por auditar'}
            </span>
          </div>
        </div>

      </div>

      {/* ── 3. BARRA DE FILTROS & BÚSQUEDA ── */}
      <div className="card-elevated p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-sm">
        
        {/* Buscador */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por RBD, nombre, director o comuna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filtros Dropdowns & Píldoras */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Comuna */}
          <select
            value={selectedComuna}
            onChange={(e) => setSelectedComuna(e.target.value)}
            aria-label="Filtrar por comuna"
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Todas las Comunas</option>
            <option value="Bulnes">Bulnes</option>
            <option value="Chillán">Chillán</option>
            <option value="Chillán Viejo">Chillán Viejo</option>
            <option value="El Carmen">El Carmen</option>
            <option value="Pemuco">Pemuco</option>
            <option value="San Ignacio">San Ignacio</option>
            <option value="Yungay">Yungay</option>
          </select>

          {/* Régimen */}
          <select
            value={selectedRegimen}
            onChange={(e) => setSelectedRegimen(e.target.value)}
            aria-label="Filtrar por régimen"
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Todo Régimen</option>
            <option value="JEC">JEC</option>
            <option value="No JEC">No JEC</option>
            <option value="Mixto">Mixto</option>
          </select>

          {/* Estado de Balance */}
          <select
            value={selectedEstadoBalance}
            onChange={(e) => setSelectedEstadoBalance(e.target.value)}
            aria-label="Filtrar por estado de balance"
            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs font-bold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="DEFICIT">🔴 Con Déficit</option>
            <option value="SUPERAVIT">🔵 Con Superávit</option>
            <option value="EQUILIBRADO">🟢 Cuadre Exacto</option>
          </select>

          {/* Contador de resultados */}
          <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 px-2">
            {colegiosFiltrados.length} escuelas
          </span>

          {/* Switcher Modo Vista Grid / Table */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setVistaModo('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                vistaModo === 'grid' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Vista en Cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setVistaModo('table')}
              className={`p-1.5 rounded-lg transition-all ${
                vistaModo === 'table' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
              }`}
              title="Vista en Tabla"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* ── 4. LISTADO DE ESTABLECIMIENTOS ── */}
      {colegiosFiltrados.length === 0 ? (
        <div className="card-elevated p-12 text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">No se encontraron establecimientos</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            No hay colegios que coincidan con los filtros para "{asesorFiltro}".
          </p>
          <button
            onClick={() => {
              setAsesorFiltro('TODOS');
              setSelectedComuna('ALL');
              setSelectedRegimen('ALL');
              setSelectedEstadoBalance('ALL');
              setSearchTerm('');
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-sm active:scale-[0.98]"
          >
            Limpiar Filtros
          </button>
        </div>
      ) : vistaModo === 'grid' ? (
        /* VISTA GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {colegiosFiltrados.map((est) => {
            const diag = diagnosticosMap.get(est.rbd);
            const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
            const esActivo = colegioActivo?.id === est.id || colegioActivo?.rbd === est.rbd;
            const totalAlertas = (diag?.balanzaGeneral.sobreasignacionesAlertas?.length || 0) +
              (diag?.balanzaGeneral.alertasInfraestructura?.length || 0) +
              (diag?.balanzaGeneral.alertasAforoPie?.length || 0);
            const tieneAlertas = totalAlertas > 0;
            const es60_40 = est.porcentajePrioritarios >= (config.parametrosMineduc.umbralPrioritarios60_40 || 80);

            return (
              <div
                key={est.id || est.rbd}
                className={`card-elevated p-5 flex flex-col justify-between group relative transition-all duration-200 hover:-translate-y-0.5 ${
                  esActivo ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-md' : ''
                }`}
              >
                <div>
                  
                  {/* Header de la tarjeta */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-black bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded-lg border border-slate-300 dark:border-slate-700">
                          RBD {est.rbd}
                        </span>
                        <span className="text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-lg border border-blue-200 dark:border-blue-800">
                          {est.comuna}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                          es60_40
                            ? 'bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700'
                        }`}>
                          {es60_40 ? '60/40' : '65/35'}
                        </span>
                      </div>
                      
                      <h3 className="font-black text-slate-900 dark:text-white text-sm mt-2.5 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors leading-tight">
                        {est.nombre}
                      </h3>
                    </div>

                    {/* Asesor Asignado Selector */}
                    <div className="text-right flex-shrink-0">
                      <select
                        value={est.asesorUatp || 'SIN_ASIGNAR'}
                        onChange={(e) => handleCambiarAsesorColegio(est, e.target.value)}
                        aria-label={`Asignar asesor a ${est.nombre}`}
                        className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-600 text-slate-800 dark:text-slate-100 text-[10px] font-extrabold rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[130px] truncate transition-colors"
                      >
                        <option value="SIN_ASIGNAR">⚠️ Sin Asignar</option>
                        {todosLosAsesores.map((a) => (
                          <option key={a.id || a.nombre} value={a.nombre}>
                            👤 {a.nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Director */}
                  {est.director && (
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1.5 truncate">
                      <span className="font-bold text-slate-700 dark:text-slate-200">Dir:</span> {est.director}
                    </p>
                  )}

                  {/* 3 Pilares de Métricas */}
                  <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-center">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">Cursos</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">{diag?.balanzaGeneral.totalCursos || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">Docentes</span>
                      <span className="text-xs font-black text-slate-900 dark:text-white tabular-nums">
                        {todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo)).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block font-bold">Balance</span>
                      <span className={`text-xs font-black tabular-nums ${
                        bal < 0 ? 'text-rose-600 dark:text-rose-400' : bal > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'
                      }`}>
                        {bal > 0 ? `+${bal}` : bal}h
                      </span>
                    </div>
                  </div>

                  {/* Alertas Normativas */}
                  {tieneAlertas && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-900 dark:text-amber-200 text-[11px] font-bold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                      <span className="truncate">{totalAlertas} alertas normativas</span>
                    </div>
                  )}

                </div>

                {/* Barra de Acciones */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onExportarDotacionColegio(est, periodoActivo)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition-colors"
                      title="Exportar Dotación (.slep)"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onExportarMatrizExcelColegio(est, periodoActivo)}
                      className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition-colors"
                      title="Descargar Matriz Oficial Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setColegioParaGdp(est)}
                      className="p-2 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
                      title="Exportar Planilla GDP Oficial (.xlsx) y Parámetros SEP/PIE"
                    >
                      <FileSpreadsheet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onSelectColegio(est);
                      onAbrirWorkflow(est);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl transition-all shadow-sm active:scale-[0.98]"
                  >
                    <span>Espacio Escolar</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* VISTA TABLA */
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 uppercase font-black text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-700">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los colegios filtrados"
                      checked={colegiosSeleccionadosBatch.length > 0 && colegiosSeleccionadosBatch.length === colegiosFiltrados.length}
                      onChange={handleSeleccionarTodosLosFiltrados}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">RBD & Establecimiento</th>
                  <th className="p-3">Comuna</th>
                  <th className="p-3">Régimen</th>
                  <th className="p-3 text-center">Docentes</th>
                  <th className="p-3 text-center">Cursos</th>
                  <th className="p-3 text-center">Balance</th>
                  <th className="p-3">Asesor UATP</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                {colegiosFiltrados.map((est) => {
                  const diag = diagnosticosMap.get(est.rbd);
                  const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
                  const seleccionado = colegiosSeleccionadosBatch.includes(est.rbd);
                  return (
                    <tr key={est.id || est.rbd} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={seleccionado}
                          onChange={() => toggleSeleccionColegio(est.rbd)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900 dark:text-white">{est.nombre}</div>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">RBD: {est.rbd}</div>
                      </td>
                      <td className="p-3 font-semibold text-slate-700 dark:text-slate-300">{est.comuna}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700">
                          {est.regimen}
                        </span>
                      </td>
                      <td className="p-3 text-center font-black tabular-nums">
                        {todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo)).length}
                      </td>
                      <td className="p-3 text-center font-black tabular-nums">
                        {diag?.balanzaGeneral.totalCursos || 0}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-black tabular-nums ${
                          bal < 0 ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300' :
                          bal > 0 ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        }`}>
                          {bal > 0 ? `+${bal}` : bal}h
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {est.asesorUatp || '⚠️ Sin Asignar'}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setColegioParaGdp(est)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition-colors"
                            title="Exportar Planilla GDP Oficial (.xlsx) y Parámetros SEP/PIE"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </button>
                          <button
                            onClick={() => {
                              onSelectColegio(est);
                              onAbrirWorkflow(est);
                            }}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow-xs"
                          >
                            Abrir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. MODAL REASIGNACIÓN EN LOTE ── */}
      {modalReasignarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="card-elevated max-w-md w-full max-h-[90vh] overflow-y-auto custom-scrollbar p-6 shadow-2xl space-y-4 border border-border-subtle animate-scale-in my-auto">
            <div className="flex items-center justify-between pb-3 border-b border-border-subtle shrink-0">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-indigo-600" />
                <h3 className="font-black text-slate-900 dark:text-white text-base">Reasignar Colegios en Lote</h3>
              </div>
              <button
                onClick={() => setModalReasignarAbierto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Selecciona el asesor de destino para los <strong>{colegiosSeleccionadosBatch.length}</strong> colegios seleccionados.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-800 dark:text-slate-200 block">
                Asesor UATP de Destino:
              </label>
              <select
                value={asesorDestinoBatch}
                onChange={(e) => setAsesorDestinoBatch(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white text-xs font-bold rounded-xl p-2.5 focus:ring-2 focus:ring-blue-500"
              >
                <option value="SIN_ASIGNAR">⚠️ Dejar como Sin Asignar</option>
                {todosLosAsesores.map((a) => (
                  <option key={a.id || a.nombre} value={a.nombre}>
                    👤 {a.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border-subtle">
              <button
                onClick={() => setModalReasignarAbierto(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 rounded-xl"
              >
                Cancelar
              </button>
              <button
                onClick={handleEjecutarReasignacionBatch}
                disabled={procesandoReasignacion || colegiosSeleccionadosBatch.length === 0}
                className="px-4 py-2 text-xs font-black bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl shadow-md"
              >
                {procesandoReasignacion ? 'Reasignando...' : `Confirmar (${colegiosSeleccionadosBatch.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. MODAL PARÁMETROS Y EXPORTACIÓN GDP OFICIAL ── */}
      {colegioParaGdp && (
        <GdpParametrosModal
          isOpen={!!colegioParaGdp}
          onClose={() => setColegioParaGdp(null)}
          establecimiento={colegioParaGdp}
          docentes={todosLosDocentes.filter(d => String(d.rbd) === String(colegioParaGdp.rbd))}
          asistentes={(todosLosAsistentes || []).filter(a => String(a.rbd) === String(colegioParaGdp.rbd))}
          cursos={todosLosCursos.filter(c => String(c.rbd) === String(colegioParaGdp.rbd))}
          asignaciones={todasLasAsignaciones.filter(a => String(a.rbd) === String(colegioParaGdp.rbd))}
          onGuardarEstablecimiento={onGuardarColegio}
          onNotificar={(msg) => setMensajeFeedback(msg)}
        />
      )}

    </div>
  );
};
