import React, { useState, useMemo } from 'react';
import {
  Users, Building2, Search, Filter, ArrowRight, FileSpreadsheet, Download,
  CheckCircle2, AlertTriangle, AlertCircle, ShieldCheck, Sparkles, SlidersHorizontal,
  LayoutGrid, List, UserCheck, RefreshCw, ChevronRight, Mail, Phone, MapPin,
  HelpCircle, ExternalLink, Settings, Plus, Check, ArrowUpDown
} from 'lucide-react';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, PerfilAsesor, ComunaValleDiguillin } from '../types';
import { DiagnosticoColegioCompleto, calcularDiagnosticoColegio } from '../services/dotacionCalculationService';
import { cargarConfiguracionGeneral, guardarConfiguracionGeneral, reasignarColegiosMasivo } from '../services/configuracionGeneralService';

interface ColegiosAsesoradosViewProps {
  colegios: Establecimiento[];
  colegioActivo: Establecimiento | null;
  onSelectColegio: (est: Establecimiento) => void;
  onAbrirWorkflow: (est: Establecimiento) => void;
  onExportarDotacionColegio: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onExportarMatrizExcelColegio: (est: Establecimiento, periodo: number) => Promise<void> | void;
  todosLosCursos: CursoSae[];
  todosLosDocentes: Docente[];
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
  todasLasSalas,
  todasLasAsignaciones,
  periodoActivo,
  onGuardarColegio,
  onAbrirConfiguraciones
}) => {
  // Cargar configuración de asesores
  const [config, setConfig] = useState(() => cargarConfiguracionGeneral());
  const [asesorFiltro, setAsesorFiltro] = useState<string>(config.asesorActivoNombre || 'TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComuna, setSelectedComuna] = useState<string>('ALL');
  const [selectedRegimen, setSelectedRegimen] = useState<string>('ALL');
  const [selectedEstadoBalance, setSelectedEstadoBalance] = useState<string>('ALL');
  const [vistaModo, setVistaModo] = useState<'grid' | 'table'>('grid');
  const [modalReasignarAbierto, setModalReasignarAbierto] = useState(false);
  const [colegiosSeleccionadosBatch, setColegiosSeleccionadosBatch] = useState<string[]>([]);
  const [asesorDestinoBatch, setAsesorDestinoBatch] = useState<string>(config.asesoresRegistrados[0]?.nombre || '');
  const [procesandoReasignacion, setProcesandoReasignacion] = useState(false);
  const [mensajeFeedback, setMensajeFeedback] = useState<string | null>(null);

  // Lista de nombres únicos de asesores detectados en la BD + los registrados en la configuración
  const todosLosAsesores = useMemo(() => {
    const set = new Map<string, PerfilAsesor>();
    for (const a of config.asesoresRegistrados) {
      set.set(a.nombre.toLowerCase().trim(), a);
    }
    // Asesores presentes en establecimientos que no estén registrados
    for (const c of colegios) {
      if (c.asesorUatp && !set.has(c.asesorUatp.toLowerCase().trim())) {
        set.set(c.asesorUatp.toLowerCase().trim(), {
          id: `asesor-auto-${c.asesorUatp}`,
          nombre: c.asesorUatp,
          email: 'uatp@slepvallediguillin.cl',
          cargo: 'Asesor UATP'
        });
      }
    }
    return Array.from(set.values());
  }, [config.asesoresRegistrados, colegios]);

  // Asesor actualmente seleccionado en el filtro (para ficha de asesor)
  const perfilAsesorSeleccionado = useMemo(() => {
    if (asesorFiltro === 'TODOS' || asesorFiltro === 'SIN_ASIGNAR') return null;
    return todosLosAsesores.find(a => a.nombre.toLowerCase().trim() === asesorFiltro.toLowerCase().trim()) || null;
  }, [asesorFiltro, todosLosAsesores]);

  // Diagnósticos pre-calculados de todos los colegios
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

  // Colegios filtrados
  const colegiosFiltrados = useMemo(() => {
    return colegios.filter(est => {
      // Filtro por Asesor
      if (asesorFiltro === 'SIN_ASIGNAR') {
        if (est.asesorUatp && est.asesorUatp.trim() !== '') return false;
      } else if (asesorFiltro !== 'TODOS') {
        if (!est.asesorUatp || est.asesorUatp.toLowerCase().trim() !== asesorFiltro.toLowerCase().trim()) {
          return false;
        }
      }

      // Filtro por Comuna
      if (selectedComuna !== 'ALL' && est.comuna !== selectedComuna) {
        return false;
      }

      // Filtro por Régimen
      if (selectedRegimen !== 'ALL' && est.regimen !== selectedRegimen) {
        return false;
      }

      // Filtro por Estado de Balance
      if (selectedEstadoBalance !== 'ALL') {
        const diag = diagnosticosMap.get(est.rbd);
        const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
        if (selectedEstadoBalance === 'DEFICIT' && bal >= 0) return false;
        if (selectedEstadoBalance === 'SUPERAVIT' && bal <= 0) return false;
        if (selectedEstadoBalance === 'EQUILIBRADO' && bal !== 0) return false;
      }

      // Búsqueda por texto
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

  // Métricas del grupo filtrado / asesor
  const metricasAsesor = useMemo(() => {
    let matriculaTotal = 0;
    let cursosTotal = 0;
    let cuposSaeTotal = 0;
    let horasContratadasTotal = 0;
    let horasAulaDemandadasTotal = 0;
    let horasLectivasAsignadasTotal = 0;
    let docentesTotal = 0;
    let colegiosConDeficit = 0;
    let colegiosConSuperavit = 0;
    let colegiosEquilibrados = 0;
    let totalInconsistencias = 0;

    const rbdSet = new Set(colegiosFiltrados.map(c => c.rbd));
    const docentesSet = new Set<string>();

    for (const est of colegiosFiltrados) {
      const diag = diagnosticosMap.get(est.rbd);
      if (diag) {
        matriculaTotal += diag.balanzaGeneral.totalMatriculaProyectada;
        cursosTotal += diag.balanzaGeneral.totalCursos;
        cuposSaeTotal += diag.balanzaGeneral.totalCuposSae;
        horasContratadasTotal += diag.balanzaGeneral.horasContratadasTotales;
        horasAulaDemandadasTotal += diag.balanzaGeneral.horasAulaDemandadasCurriculo;
        horasLectivasAsignadasTotal += diag.balanzaGeneral.horasLectivasAsignadas;
        
        const alertasCount = (diag.balanzaGeneral.sobreasignacionesAlertas?.length || 0) +
          (diag.balanzaGeneral.alertasInfraestructura?.length || 0) +
          (diag.balanzaGeneral.alertasAforoPie?.length || 0);
        totalInconsistencias += alertasCount;

        const bal = diag.balanzaGeneral.superavitDeficitLectivo;
        if (bal < 0) colegiosConDeficit++;
        else if (bal > 0) colegiosConSuperavit++;
        else colegiosEquilibrados++;
      }

      const docsColegio = todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo));
      for (const d of docsColegio) {
        docentesSet.add(d.run);
      }
    }

    docentesTotal = docentesSet.size;
    const balanceNeto = horasLectivasAsignadasTotal - horasAulaDemandadasTotal;

    return {
      totalColegios: colegiosFiltrados.length,
      matriculaTotal,
      cursosTotal,
      cuposSaeTotal,
      horasContratadasTotal,
      horasAulaDemandadasTotal,
      horasLectivasAsignadasTotal,
      balanceNeto,
      docentesTotal,
      colegiosConDeficit,
      colegiosConSuperavit,
      colegiosEquilibrados,
      totalInconsistencias
    };
  }, [colegiosFiltrados, diagnosticosMap, todosLosDocentes, periodoActivo]);

  // Cambiar asesor individual de un colegio directamente
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

  // Manejador para reasignación masiva
  const handleEjecutarReasignacionBatch = async () => {
    if (colegiosSeleccionadosBatch.length === 0 || !asesorDestinoBatch) return;
    setProcesandoReasignacion(true);
    try {
      await reasignarColegiosMasivo(colegiosSeleccionadosBatch, asesorDestinoBatch, colegios);
      setMensajeFeedback(`✓ Se han reasignado exitosamente ${colegiosSeleccionadosBatch.length} establecimientos a ${asesorDestinoBatch}.`);
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
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Feedback */}
      {mensajeFeedback && (
        <div className="fixed top-20 right-6 z-50 bg-slate-900 text-emerald-300 border border-emerald-500/50 px-4 py-3 rounded-xl shadow-2xl text-xs font-bold flex items-center gap-2 animate-bounce">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{mensajeFeedback}</span>
        </div>
      )}

      {/* Banner Principal del Apartado Colegios Asesorados */}
      <div className="bg-gradient-to-r from-[#002B49] via-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl border border-slate-700 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          
          {/* Título y Descripción */}
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold tracking-wide uppercase">
              <UserCheck className="w-3.5 h-3.5 text-blue-400" />
              <span>Supervisión UATP & Cartera Focalizada</span>
            </div>
            <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-3">
              Apartado Colegios Asesorados
            </h1>
            <p className="text-xs lg:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Filtra, audita y supervisa la dotación docente de los establecimientos asignados a cada asesor técnico pedagógico del SLEP Valle Diguillín.
            </p>
          </div>

          {/* Selector de Asesor Activo & Botones de Acción */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Botón Acceso Rápido: "Mi Cartera" */}
            <button
              onClick={() => setAsesorFiltro(config.asesorActivoNombre)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                asesorFiltro === config.asesorActivoNombre
                  ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white ring-2 ring-orange-400/50'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700'
              }`}
              title="Filtrar por mi usuario/asesor asignado por defecto"
            >
              <UserCheck className="w-4 h-4 text-orange-300" />
              <span>Mis Colegios ({config.asesorActivoNombre.split(' ')[0]})</span>
            </button>

            {/* Selector Desplegable de Asesor */}
            <div className="relative">
              <select
                value={asesorFiltro}
                onChange={(e) => setAsesorFiltro(e.target.value)}
                aria-label="Filtrar por Asesor Técnico UATP"
                className="appearance-none bg-slate-900 border border-slate-700 hover:border-blue-400 text-white font-semibold text-xs rounded-xl px-4 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors shadow-sm cursor-pointer"
              >
                <option value="TODOS">🌐 Todo el Territorio (121 Colegios)</option>
                <option value="SIN_ASIGNAR">⚠️ Establecimientos Sin Asignar</option>
                <optgroup label="Asesores UATP Registrados">
                  {todosLosAsesores.map((asesor) => (
                    <option key={asesor.id || asesor.nombre} value={asesor.nombre}>
                      👤 {asesor.nombre} ({colegios.filter(c => c.asesorUatp?.toLowerCase().trim() === asesor.nombre.toLowerCase().trim()).length} colegios)
                    </option>
                  ))}
                </optgroup>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400">
                <ChevronRight className="w-3.5 h-3.5 rotate-90" />
              </div>
            </div>

            {/* Botón Reasignación Masiva */}
            <button
              onClick={() => {
                setColegiosSeleccionadosBatch([]);
                setModalReasignarAbierto(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition-all shadow-md border border-indigo-400/40"
              title="Asignar o transferir múltiples escuelas a un asesor en lote"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>Reasignar Lote</span>
            </button>

            {/* Botón Configuración */}
            <button
              onClick={onAbrirConfiguraciones}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold rounded-xl transition-all border border-slate-700"
              title="Abrir Centro de Configuraciones Generales"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Configuración</span>
            </button>

          </div>

        </div>

        {/* Ficha Informativa del Asesor Seleccionado (si no es TODOS) */}
        {perfilAsesorSeleccionado && (
          <div className="mt-5 pt-4 border-t border-slate-700/80 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-md"
                style={{ backgroundColor: perfilAsesorSeleccionado.colorBadge || '#2563eb' }}
              >
                {perfilAsesorSeleccionado.nombre.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div>
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  {perfilAsesorSeleccionado.nombre}
                  {perfilAsesorSeleccionado.nombre === config.asesorActivoNombre && (
                    <span className="bg-orange-500/20 text-orange-300 border border-orange-400/40 text-[10px] px-2 py-0.5 rounded-full font-bold">
                      Asesor Activo
                    </span>
                  )}
                </div>
                <div className="text-slate-300 text-[11px] flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Mail className="w-3 h-3 text-slate-400" />
                    {perfilAsesorSeleccionado.email}
                  </span>
                  {perfilAsesorSeleccionado.telefono && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3 text-slate-400" />
                      {perfilAsesorSeleccionado.telefono}
                    </span>
                  )}
                  {perfilAsesorSeleccionado.cargo && (
                    <span className="text-slate-400 font-medium">
                      • {perfilAsesorSeleccionado.cargo}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onAbrirConfiguraciones}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 hover:text-white text-xs font-bold rounded-xl border border-indigo-400/30 transition-colors shadow-xs"
                title="Administrar los colegios asignados a este asesor"
              >
                <Building2 className="w-3.5 h-3.5 text-indigo-300" />
                <span>Gestionar Colegios de Cartera</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* KPI Cards Ejecutivas del Asesor / Cartera Filtrada */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Establecimientos</span>
            <Building2 className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{metricasAsesor.totalColegios}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">colegios en cartera</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Docentes</span>
            <Users className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{metricasAsesor.docentesTotal}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">docentes en dotación</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Cursos & SAE</span>
            <LayoutGrid className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{metricasAsesor.cursosTotal}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">{metricasAsesor.matriculaTotal} alumnos proyectados</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Horas Contrato</span>
            <ShieldCheck className="w-4 h-4 text-purple-600" />
          </div>
          <div className="mt-2">
            <span className="text-2xl font-black text-slate-900">{metricasAsesor.horasContratadasTotal}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5">hrs semanales SLEP</span>
          </div>
        </div>

        <div className={`p-4 rounded-xl border shadow-sm flex flex-col justify-between ${
          metricasAsesor.balanceNeto < 0
            ? 'bg-red-50/70 border-red-200'
            : metricasAsesor.balanceNeto > 0
            ? 'bg-blue-50/70 border-blue-200'
            : 'bg-emerald-50/70 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Balance Lectivo</span>
            <ArrowUpDown className={`w-4 h-4 ${metricasAsesor.balanceNeto < 0 ? 'text-red-600' : 'text-emerald-600'}`} />
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-black ${
              metricasAsesor.balanceNeto < 0 ? 'text-red-700' : metricasAsesor.balanceNeto > 0 ? 'text-blue-700' : 'text-emerald-700'
            }`}>
              {metricasAsesor.balanceNeto > 0 ? `+${metricasAsesor.balanceNeto}` : metricasAsesor.balanceNeto}h
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {metricasAsesor.colegiosConDeficit} con déficit / {metricasAsesor.colegiosConSuperavit} superávit
            </span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Alertas Normativas</span>
            <AlertTriangle className={`w-4 h-4 ${metricasAsesor.totalInconsistencias > 0 ? 'text-amber-500' : 'text-slate-400'}`} />
          </div>
          <div className="mt-2">
            <span className={`text-2xl font-black ${metricasAsesor.totalInconsistencias > 0 ? 'text-amber-600' : 'text-slate-700'}`}>
              {metricasAsesor.totalInconsistencias}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">alertas Ley 20.903 / PIE</span>
          </div>
        </div>

      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Buscador de texto */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por RBD, nombre de escuela, director o comuna..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filtros Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Comuna */}
          <select
            value={selectedComuna}
            onChange={(e) => setSelectedComuna(e.target.value)}
            aria-label="Filtrar por comuna"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
            aria-label="Filtrar por régimen de jornada"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
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
            aria-label="Filtrar por estado de balance docente"
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="ALL">Todos los Estados</option>
            <option value="DEFICIT">🔴 Con Déficit Horario</option>
            <option value="SUPERAVIT">🔵 Con Superávit Horario</option>
            <option value="EQUILIBRADO">🟢 Cuadre Exacto</option>
          </select>

          {/* Toggle Modo Vista (Grid vs Tabla) */}
          <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              onClick={() => setVistaModo('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                vistaModo === 'grid' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en Tarjetas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setVistaModo('table')}
              className={`p-1.5 rounded-lg transition-all ${
                vistaModo === 'table' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Vista en Tabla Detallada"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

        </div>

      </div>

      {/* Listado de Colegios Asesorados */}
      {colegiosFiltrados.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-slate-200 shadow-sm text-center max-w-lg mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4 text-slate-400">
            <Building2 className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No se encontraron establecimientos</h3>
          <p className="text-xs text-slate-500 mt-1">
            No hay colegios que coincidan con los filtros seleccionados para el asesor "{asesorFiltro}".
          </p>
          <button
            onClick={() => {
              setAsesorFiltro('TODOS');
              setSelectedComuna('ALL');
              setSelectedRegimen('ALL');
              setSelectedEstadoBalance('ALL');
              setSearchTerm('');
            }}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm"
          >
            Limpiar Filtros
          </button>
        </div>
      ) : vistaModo === 'grid' ? (
        /* VISTA GRID TARJETAS */
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
                className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between group relative ${
                  esActivo ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div>
                  
                  {/* Encabezado Tarjeta */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                          RBD {est.rbd}
                        </span>
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                          {est.comuna}
                        </span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                          es60_40 ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}>
                          {es60_40 ? '60/40' : '65/35'}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mt-2 line-clamp-2 group-hover:text-blue-600 transition-colors">
                        {est.nombre}
                      </h3>
                    </div>

                    {/* Selector / Badge de Asesor Individual */}
                    <div className="text-right flex-shrink-0">
                      <select
                        value={est.asesorUatp || 'SIN_ASIGNAR'}
                        onChange={(e) => handleCambiarAsesorColegio(est, e.target.value)}
                        aria-label={`Asignar asesor a ${est.nombre}`}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[10px] font-bold rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[140px] truncate transition-colors shadow-xs"
                        title="Cambiar asesor asignado a este colegio"
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
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      <span className="font-medium text-slate-700">Dir:</span> {est.director}
                    </p>
                  )}

                  {/* Métricas Mini */}
                  <div className="grid grid-cols-3 gap-2 mt-4 p-2.5 bg-slate-50 rounded-xl border border-slate-100 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Cursos</span>
                      <span className="text-xs font-black text-slate-800">{diag?.balanzaGeneral.totalCursos || 0}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Docentes</span>
                      <span className="text-xs font-black text-slate-800">
                        {todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo)).length}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block font-semibold">Balance</span>
                      <span className={`text-xs font-black ${
                        bal < 0 ? 'text-red-600' : bal > 0 ? 'text-blue-600' : 'text-emerald-600'
                      }`}>
                        {bal > 0 ? `+${bal}` : bal}h
                      </span>
                    </div>
                  </div>

                  {/* Alertas */}
                  {tieneAlertas && (
                    <div className="mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span className="truncate">{totalAlertas} alertas detectadas</span>
                    </div>
                  )}

                </div>

                {/* Acciones de Tarjeta */}
                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onExportarDotacionColegio(est, periodoActivo)}
                      className="p-2 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Exportar Dotación .slep para Asesor"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onExportarMatrizExcelColegio(est, periodoActivo)}
                      className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                      title="Exportar Matriz Oficial Excel (.xlsx)"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                    </button>
                  </div>

                  <button
                    onClick={() => {
                      onSelectColegio(est);
                      onAbrirWorkflow(est);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-blue-600 text-white text-xs font-bold rounded-xl transition-all shadow-sm group-hover:bg-blue-600"
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
        /* VISTA TABLA DETALLADA */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-bold text-[10px] tracking-wider border-b border-slate-200">
                <tr>
                  <th className="p-3 w-10 text-center">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todos los establecimientos filtrados"
                      checked={colegiosSeleccionadosBatch.length > 0 && colegiosSeleccionadosBatch.length === colegiosFiltrados.length}
                      onChange={handleSeleccionarTodosLosFiltrados}
                      className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="p-3">RBD</th>
                  <th className="p-3">Establecimiento</th>
                  <th className="p-3">Comuna</th>
                  <th className="p-3">Asesor UATP</th>
                  <th className="p-3 text-center">Cursos</th>
                  <th className="p-3 text-center">Matrícula</th>
                  <th className="p-3 text-center">Docentes</th>
                  <th className="p-3 text-center">Hrs Contrato</th>
                  <th className="p-3 text-center">Balance Lectivo</th>
                  <th className="p-3 text-center">Régimen</th>
                  <th className="p-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {colegiosFiltrados.map((est) => {
                  const diag = diagnosticosMap.get(est.rbd);
                  const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
                  const docsColegio = todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo));
                  const isChecked = colegiosSeleccionadosBatch.includes(est.rbd);

                  return (
                    <tr key={est.id || est.rbd} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${est.nombre}`}
                          checked={isChecked}
                          onChange={() => toggleSeleccionColegio(est.rbd)}
                          className="rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>
                      <td className="p-3 font-mono font-bold text-slate-900">{est.rbd}</td>
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{est.nombre}</div>
                        {est.director && <div className="text-[10px] text-slate-400">Dir: {est.director}</div>}
                      </td>
                      <td className="p-3 font-medium">{est.comuna}</td>
                      <td className="p-3">
                        <select
                          value={est.asesorUatp || 'SIN_ASIGNAR'}
                          onChange={(e) => handleCambiarAsesorColegio(est, e.target.value)}
                          aria-label={`Asignar asesor a ${est.nombre}`}
                          className="bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700 text-[11px] font-bold rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[150px] truncate transition-colors shadow-xs"
                        >
                          <option value="SIN_ASIGNAR">⚠️ Sin Asignar</option>
                          {todosLosAsesores.map((a) => (
                            <option key={a.id || a.nombre} value={a.nombre}>
                              👤 {a.nombre}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="p-3 text-center font-bold">{diag?.balanzaGeneral.totalCursos || 0}</td>
                      <td className="p-3 text-center">{diag?.balanzaGeneral.totalMatriculaProyectada || 0}</td>
                      <td className="p-3 text-center font-bold">{docsColegio.length}</td>
                      <td className="p-3 text-center font-bold">{diag?.balanzaGeneral.horasContratadasTotales || 0}h</td>
                      <td className="p-3 text-center">
                        <span className={`font-black px-2 py-0.5 rounded ${
                          bal < 0 ? 'bg-red-50 text-red-700' : bal > 0 ? 'bg-blue-50 text-blue-700' : 'bg-emerald-50 text-emerald-700'
                        }`}>
                          {bal > 0 ? `+${bal}` : bal}h
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold">
                          {est.regimen} ({est.porcentajePrioritarios >= 80 ? '60/40' : '65/35'})
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => onExportarDotacionColegio(est, periodoActivo)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Exportar Dotación .slep"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onExportarMatrizExcelColegio(est, periodoActivo)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Exportar Matriz Excel"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              onSelectColegio(est);
                              onAbrirWorkflow(est);
                            }}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-blue-600 text-white rounded-lg font-bold text-[11px] transition-colors"
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

      {/* Modal de Reasignación en Lote */}
      {modalReasignarAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-6 animate-in zoom-in-95 duration-200 space-y-4">
            
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ArrowUpDown className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-base">Reasignación Masiva de Colegios a Asesor</h3>
              </div>
              <button
                onClick={() => setModalReasignarAbierto(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Selecciona los establecimientos que deseas asignar o transferir y elige el asesor UATP de destino.
            </p>

            {/* Asesor Destino */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Asesor UATP de Destino:
              </label>
              <select
                value={asesorDestinoBatch}
                onChange={(e) => setAsesorDestinoBatch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500"
              >
                {todosLosAsesores.map(a => (
                  <option key={a.id || a.nombre} value={a.nombre}>
                    👤 {a.nombre} ({a.cargo || 'Asesor UATP'})
                  </option>
                ))}
              </select>
            </div>

            {/* Lista de Selección Rápida */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Establecimientos a Asignar ({colegiosSeleccionadosBatch.length} seleccionados):
                </label>
                <button
                  type="button"
                  onClick={handleSeleccionarTodosLosFiltrados}
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700"
                >
                  {colegiosSeleccionadosBatch.length === colegiosFiltrados.length ? 'Deseleccionar todos' : 'Seleccionar todos los visibles'}
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-xl p-2 divide-y divide-slate-100 bg-slate-50/50">
                {colegios.map(est => {
                  const isChecked = colegiosSeleccionadosBatch.includes(est.rbd);
                  return (
                    <label key={est.rbd} className="flex items-center justify-between p-2 hover:bg-slate-100/80 rounded-lg cursor-pointer text-xs">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSeleccionColegio(est.rbd)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="font-bold text-slate-900">{est.nombre}</span>
                        <span className="text-[10px] text-slate-400 font-mono">(RBD {est.rbd} - {est.comuna})</span>
                      </div>
                      <span className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600">
                        {est.asesorUatp || 'Sin Asignar'}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => setModalReasignarAbierto(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                onClick={handleEjecutarReasignacionBatch}
                disabled={colegiosSeleccionadosBatch.length === 0 || procesandoReasignacion}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-md"
              >
                {procesandoReasignacion ? 'Reasignando...' : `Confirmar Asignación (${colegiosSeleccionadosBatch.length})`}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
