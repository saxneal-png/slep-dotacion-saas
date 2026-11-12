import React, { useState, useMemo, useRef } from 'react';
import {
  Users, Building2, Search, FileSpreadsheet, Download,
  CheckCircle2, AlertTriangle, AlertCircle, LayoutGrid, List,
  ChevronRight, ChevronDown, Settings, Plus, Check, X, Globe,
  MoreVertical, Upload, Trash2, FileUp, ArrowRightLeft
} from 'lucide-react';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria, PerfilAsesor, AsistenteEducacion } from '../types';
import { DiagnosticoColegioCompleto, calcularDiagnosticoColegio } from '../services/dotacionCalculationService';
import { cargarConfiguracionGeneral, reasignarColegiosMasivo } from '../services/configuracionGeneralService';
import { GdpParametrosModal } from '../components/GdpParametrosModal';
import { usePermisos } from '../security/PermisosContext';
import { AuthService } from '../services/authService';
import { UsuarioSistema } from '../types/authTypes';

export interface ColegiosAsesoradosViewProps {
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
  usuariosSistema?: UsuarioSistema[];
  onEliminarColegio?: (rbd: string) => Promise<void>;
  onExportarCarteraSlep?: () => Promise<void>;
  onImportarCarteraSlep?: (file: File) => Promise<void>;
  onAbrirModuloSige?: () => void;
  onAbrirGestionEstablecimientos?: () => void;
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
  onAbrirConfiguraciones,
  usuariosSistema = [],
  onEliminarColegio,
  onExportarCarteraSlep,
  onImportarCarteraSlep,
  onAbrirModuloSige,
  onAbrirGestionEstablecimientos
}) => {
  const { rol, legado: permisos, esSuperUsuario } = usePermisos();
  const session = useMemo(() => AuthService.getSessionActual(), []);
  const [config] = useState(() => cargarConfiguracionGeneral());
  const importCarteraInputRef = useRef<HTMLInputElement>(null);

  const [asesorFiltro, setAsesorFiltro] = useState<string>(() => {
    if (rol === 'asesor_uatp' && session?.usuario.nombreCompleto) {
      return session.usuario.nombreCompleto;
    }
    return 'TODOS';
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedComuna, setSelectedComuna] = useState<string>('ALL');
  const [selectedRegimen, setSelectedRegimen] = useState<string>('ALL');
  const [selectedEstadoBalance, setSelectedEstadoBalance] = useState<string>('ALL');
  const [vistaModo, setVistaModo] = useState<'grid' | 'table'>('table');

  const [menuAccionesToolbarAbierto, setMenuAccionesToolbarAbierto] = useState(false);
  const [menuFilaAbiertoRbd, setMenuFilaAbiertoRbd] = useState<string | null>(null);

  const [modalReasignarAbierto, setModalReasignarAbierto] = useState(false);
  const [colegioParaGdp, setColegioParaGdp] = useState<Establecimiento | null>(null);
  const [colegiosSeleccionadosBatch, setColegiosSeleccionadosBatch] = useState<string[]>([]);
  const [asesorDestinoBatch, setAsesorDestinoBatch] = useState<string>(config.asesoresRegistrados[0]?.nombre || '');
  const [procesandoReasignacion, setProcesandoReasignacion] = useState(false);
  const [mensajeFeedback, setMensajeFeedback] = useState<{ texto: string; tipo: 'ok' | 'error' } | null>(null);

  const NOMBRES_PRUEBA_SET = useMemo(() => new Set([
    'rodrigo fuentes uribe',
    'marcela navarrete díaz',
    'marcela navarrete diaz',
    'claudia morales san martín',
    'claudia morales san martin',
    'gonzalo sepúlveda alarcón',
    'gonzalo sepulveda alarcon',
    'uatp valle diguillín',
    'uatp valle diguillin'
  ]), []);

  const todosLosAsesores = useMemo(() => {
    const map = new Map<string, PerfilAsesor>();
    for (const a of config.asesoresRegistrados) {
      const key = a.nombre.toLowerCase().trim();
      if (!NOMBRES_PRUEBA_SET.has(key)) map.set(key, a);
    }
    for (const u of (usuariosSistema || [])) {
      if (u.role === 'asesor_uatp') {
        const key = u.nombreCompleto.toLowerCase().trim();
        if (!NOMBRES_PRUEBA_SET.has(key) && !map.has(key)) {
          map.set(key, {
            id: u.id,
            nombre: u.nombreCompleto,
            email: u.email || 'uatp@slepvallediguillin.cl',
            cargo: u.cargo || 'Asesor(a) UATP'
          });
        }
      }
    }
    if (rol === 'asesor_uatp' && session?.usuario.nombreCompleto) {
      const key = session.usuario.nombreCompleto.toLowerCase().trim();
      if (!NOMBRES_PRUEBA_SET.has(key) && !map.has(key)) {
        map.set(key, {
          id: session.usuario.id,
          nombre: session.usuario.nombreCompleto,
          email: session.usuario.email || 'uatp@slepvallediguillin.cl',
          cargo: session.usuario.cargo || 'Asesor(a) UATP'
        });
      }
    }
    for (const c of colegios) {
      if (c.asesorUatp) {
        const key = c.asesorUatp.toLowerCase().trim();
        if (!NOMBRES_PRUEBA_SET.has(key) && !map.has(key)) {
          map.set(key, {
            id: `asesor-auto-${c.asesorUatp}`,
            nombre: c.asesorUatp,
            email: 'uatp@slepvallediguillin.cl',
            cargo: 'Asesor UATP'
          });
        }
      }
    }
    return Array.from(map.values());
  }, [config.asesoresRegistrados, colegios, rol, session, usuariosSistema, NOMBRES_PRUEBA_SET]);

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

  const comunasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const c of colegios) {
      if (c.comuna) set.add(c.comuna);
    }
    return Array.from(set).sort();
  }, [colegios]);

  const regimenesDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const c of colegios) {
      if (c.regimen) set.add(c.regimen);
    }
    return Array.from(set).sort();
  }, [colegios]);

  const colegiosFiltrados = useMemo(() => {
    return colegios.filter(est => {
      if (asesorFiltro === 'SIN_ASIGNAR') {
        if (est.asesorUatp && est.asesorUatp.trim() !== '') return false;
      } else if (asesorFiltro !== 'TODOS') {
        const matchPorNombre = est.asesorUatp && est.asesorUatp.toLowerCase().trim() === asesorFiltro.toLowerCase().trim();
        const matchPorCarteraSesion =
          session?.usuario.nombreCompleto.toLowerCase().trim() === asesorFiltro.toLowerCase().trim() &&
          (session?.usuario.carteraRbds || []).includes(est.rbd);
        const asesorUser = (usuariosSistema || []).find(u => u.nombreCompleto.toLowerCase().trim() === asesorFiltro.toLowerCase().trim());
        const matchPorCarteraUsuario = asesorUser && (asesorUser.carteraRbds || []).includes(est.rbd);
        if (!matchPorNombre && !matchPorCarteraSesion && !matchPorCarteraUsuario) {
          return false;
        }
      }

      if (selectedComuna !== 'ALL' && est.comuna !== selectedComuna) return false;
      if (selectedRegimen !== 'ALL' && est.regimen !== selectedRegimen) return false;

      if (selectedEstadoBalance !== 'ALL') {
        const diag = diagnosticosMap.get(est.rbd);
        const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
        if (selectedEstadoBalance === 'DEFICIT' && bal >= 0) return false;
        if (selectedEstadoBalance === 'SUPERAVIT' && bal <= 0) return false;
        if (selectedEstadoBalance === 'EQUILIBRADO' && bal !== 0) return false;
      }

      if (searchTerm) {
        const q = searchTerm.toLowerCase().trim();
        return (
          est.nombre.toLowerCase().includes(q) ||
          est.rbd.toLowerCase().includes(q) ||
          (est.comuna || '').toLowerCase().includes(q) ||
          (est.director || '').toLowerCase().includes(q) ||
          (est.asesorUatp || '').toLowerCase().includes(q)
        );
      }

      return true;
    });
  }, [colegios, asesorFiltro, selectedComuna, selectedRegimen, selectedEstadoBalance, searchTerm, diagnosticosMap, session, usuariosSistema]);

  const metricasAsesor = useMemo(() => {
    let matriculaTotal = 0;
    let cursosTotal = 0;
    let cuposSaeTotal = 0;
    let horasContratadasTotal = 0;
    let balanceNeto = 0;
    let colegiosConDeficit = 0;
    let colegiosConSuperavit = 0;
    let totalInconsistencias = 0;
    const docentesSet = new Set<string>();

    for (const est of colegiosFiltrados) {
      const diag = diagnosticosMap.get(est.rbd);
      if (diag) {
        matriculaTotal += diag.balanzaGeneral.totalMatriculaProyectada || 0;
        cursosTotal += diag.balanzaGeneral.totalCursos || 0;
        cuposSaeTotal += diag.balanzaGeneral.totalCuposSae || 0;
        horasContratadasTotal += diag.balanzaGeneral.horasContratadasTotales || 0;

        const bal = diag.balanzaGeneral.superavitDeficitLectivo || 0;
        balanceNeto += bal;
        if (bal < 0) colegiosConDeficit++;
        else if (bal > 0) colegiosConSuperavit++;

        totalInconsistencias +=
          (diag.balanzaGeneral.sobreasignacionesAlertas?.length || 0) +
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
      balanceNeto,
      docentesTotal: docentesSet.size,
      colegiosConDeficit,
      colegiosConSuperavit,
      totalInconsistencias
    };
  }, [colegiosFiltrados, diagnosticosMap, todosLosDocentes, periodoActivo]);

  const mostrarFeedback = (texto: string, tipo: 'ok' | 'error' = 'ok') => {
    setMensajeFeedback({ texto, tipo });
    setTimeout(() => setMensajeFeedback(null), 4000);
  };

  const handleCambiarAsesorColegio = async (est: Establecimiento, nuevoAsesor: string) => {
    const asesorValor = nuevoAsesor === 'SIN_ASIGNAR' || nuevoAsesor.trim() === '' ? undefined : nuevoAsesor.trim();
    try {
      await onGuardarColegio({ ...est, asesorUatp: asesorValor });
      mostrarFeedback(`"${est.nombre}" asignado a ${asesorValor || 'Sin Asignar'}.`);
    } catch {
      mostrarFeedback('Error al reasignar asesor del establecimiento.', 'error');
    }
  };

  const handleEjecutarReasignacionMasiva = async () => {
    if (colegiosSeleccionadosBatch.length === 0) return;
    setProcesandoReasignacion(true);
    try {
      const target = asesorDestinoBatch === 'SIN_ASIGNAR' ? '' : asesorDestinoBatch;
      await reasignarColegiosMasivo(colegiosSeleccionadosBatch, target, colegios);
      for (const rbd of colegiosSeleccionadosBatch) {
        const est = colegios.find(c => c.rbd === rbd);
        if (est) {
          await onGuardarColegio({ ...est, asesorUatp: target || undefined });
        }
      }
      mostrarFeedback(`${colegiosSeleccionadosBatch.length} escuela(s) reasignadas a ${target || 'Sin Asignar'}.`);
      setColegiosSeleccionadosBatch([]);
      setModalReasignarAbierto(false);
    } catch {
      mostrarFeedback('Error al ejecutar la reasignación en lote.', 'error');
    } finally {
      setProcesandoReasignacion(false);
    }
  };

  const toggleSeleccionBatch = (rbd: string) => {
    setColegiosSeleccionadosBatch(prev =>
      prev.includes(rbd) ? prev.filter(item => item !== rbd) : [...prev, rbd]
    );
  };

  const todosFiltradosSeleccionados =
    colegiosFiltrados.length > 0 && colegiosFiltrados.every(c => colegiosSeleccionadosBatch.includes(c.rbd));

  const toggleSeleccionTodos = () => {
    if (todosFiltradosSeleccionados) {
      setColegiosSeleccionadosBatch([]);
    } else {
      setColegiosSeleccionadosBatch(colegiosFiltrados.map(c => c.rbd));
    }
  };

  const hayFiltrosActivos =
    searchTerm.trim() !== '' ||
    selectedComuna !== 'ALL' ||
    selectedRegimen !== 'ALL' ||
    selectedEstadoBalance !== 'ALL';

  const miNombre = session?.usuario.nombreCompleto || '';
  const tieneMiCartera = Boolean(miNombre && (rol === 'asesor_uatp' || todosLosAsesores.some(a => a.nombre.toLowerCase().trim() === miNombre.toLowerCase().trim())));

  return (
    <div className="space-y-3 animate-fade-in">
      {/* Feedback Toast */}
      {mensajeFeedback && (
        <div className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm ${
          mensajeFeedback.tipo === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200'
            : 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
        }`}>
          <span className="flex items-center gap-2">
            {mensajeFeedback.tipo === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            {mensajeFeedback.texto}
          </span>
          <button onClick={() => setMensajeFeedback(null)} className="opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 1. Toolbar Slim 1-Línea (Reemplaza Hero gigante de 220px) */}
      <div className="card-elevated px-3.5 py-2.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2.5">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-600 dark:text-orange-400 shrink-0" />
            <h1 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
              Dashboard Escuelas
            </h1>
            <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono ${
              periodoActivo === 2027
                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
            }`}>
              {periodoActivo}
            </span>
          </div>

          {/* Selector de Alcance: Mis Colegios / Territorio / Sin Asignar */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-xs">
            {tieneMiCartera && (
              <button
                type="button"
                onClick={() => setAsesorFiltro(miNombre)}
                className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                  asesorFiltro.toLowerCase().trim() === miNombre.toLowerCase().trim()
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Mis Colegios
              </button>
            )}
            <button
              type="button"
              onClick={() => setAsesorFiltro('TODOS')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all inline-flex items-center gap-1 ${
                asesorFiltro === 'TODOS'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Globe className="w-3 h-3" />
              <span>Territorio ({colegios.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setAsesorFiltro('SIN_ASIGNAR')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                asesorFiltro === 'SIN_ASIGNAR'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Sin Asignar
            </button>
          </div>

          {/* Selector rápido por Asesor específico */}
          <select
            value={asesorFiltro}
            onChange={(e) => setAsesorFiltro(e.target.value)}
            aria-label="Filtrar por asesor UATP"
            className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-orange-500/30 max-w-[200px]"
          >
            <option value="TODOS">Todos los Asesores</option>
            <option value="SIN_ASIGNAR">Sin Asesor Asignado</option>
            {todosLosAsesores.map(a => (
              <option key={a.id} value={a.nombre}>{a.nombre}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {colegiosSeleccionadosBatch.length > 0 && (
            <div className="flex items-center gap-1.5 bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-800/60 px-2.5 py-1 rounded-xl">
              <span className="text-xs font-bold text-orange-800 dark:text-orange-300 tabular-nums">
                {colegiosSeleccionadosBatch.length} selec.
              </span>
              <button
                type="button"
                onClick={() => setModalReasignarAbierto(true)}
                className="px-2 py-0.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1"
              >
                <ArrowRightLeft className="w-3 h-3" />
                <span>Reasignar</span>
              </button>
              <button
                type="button"
                onClick={() => setColegiosSeleccionadosBatch([])}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Limpiar selección"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Toggle Vista Tabla (Default) / Tarjetas */}
          <div className="inline-flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setVistaModo('table')}
              className={`p-1.5 rounded-lg transition-all ${
                vistaModo === 'table'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista Tabla Compacta"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setVistaModo('grid')}
              className={`p-1.5 rounded-lg transition-all ${
                vistaModo === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Vista Tarjetas"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Botón Nuevo / Gestionar Colegios (cuando está permitido) */}
          {onAbrirGestionEstablecimientos && (!permisos || esSuperUsuario || permisos.puedeAccederTodasEscuelas) && (
            <button
              type="button"
              onClick={onAbrirGestionEstablecimientos}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Colegios</span>
            </button>
          )}

          {/* Menú Unificado de Cartera & Herramientas (reemplaza CarteraView) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuAccionesToolbarAbierto(!menuAccionesToolbarAbierto)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 transition-all"
            >
              <span>Cartera</span>
              <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuAccionesToolbarAbierto ? 'rotate-180' : ''}`} />
            </button>

            {menuAccionesToolbarAbierto && (
              <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1.5 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
                <div className="p-1 space-y-0.5">
                  {onAbrirModuloSige && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuAccionesToolbarAbierto(false);
                        onAbrirModuloSige();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/50 text-left"
                    >
                      <FileUp className="w-4 h-4 text-orange-500" />
                      <span>Ingestar Nómina SIGE</span>
                    </button>
                  )}
                  {onExportarCarteraSlep && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuAccionesToolbarAbierto(false);
                        onExportarCarteraSlep();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50 text-left"
                    >
                      <Download className="w-4 h-4 text-blue-500" />
                      <span>Exportar Cartera (.slep)</span>
                    </button>
                  )}
                  {onImportarCarteraSlep && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuAccionesToolbarAbierto(false);
                        importCarteraInputRef.current?.click();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                    >
                      <Upload className="w-4 h-4 text-slate-500" />
                      <span>Importar Cartera (.slep)</span>
                    </button>
                  )}
                </div>

                <div className="p-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMenuAccionesToolbarAbierto(false);
                      if (colegiosSeleccionadosBatch.length === 0 && colegiosFiltrados.length > 0) {
                        setColegiosSeleccionadosBatch(colegiosFiltrados.map(c => c.rbd));
                      }
                      setModalReasignarAbierto(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/50 text-left"
                  >
                    <Users className="w-4 h-4 text-indigo-500" />
                    <span>Reasignar Cartera en Lote</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuAccionesToolbarAbierto(false);
                      onAbrirConfiguraciones();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-left"
                  >
                    <Settings className="w-4 h-4 text-slate-500" />
                    <span>Configuraciones UATP</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Input oculto para importar cartera .slep */}
      {onImportarCarteraSlep && (
        <input
          ref={importCarteraInputRef}
          type="file"
          accept=".slep,.json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f && onImportarCarteraSlep) { void onImportarCarteraSlep(f); } e.target.value = ""; }}
        />
      )}

      {/* 2. KPI Ribbon Clickeable (5 métricas compactas, Jidoka: alertas solo si > 0) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => setSelectedEstadoBalance('ALL')}
          className={`card-elevated px-3 py-2 text-left transition-all hover:border-slate-300 dark:hover:border-slate-600 ${
            selectedEstadoBalance === 'ALL' ? 'ring-1 ring-slate-300 dark:ring-slate-600' : ''
          }`}
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Escuelas</div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums font-mono">{metricasAsesor.totalColegios}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{metricasAsesor.cursosTotal} cursos</span>
          </div>
        </button>

        <div className="card-elevated px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Matrícula / SAE</div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums font-mono">{metricasAsesor.matriculaTotal.toLocaleString('es-CL')}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{metricasAsesor.cuposSaeTotal.toLocaleString('es-CL')} cupos</span>
          </div>
        </div>

        <div className="card-elevated px-3 py-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Docentes</div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className="text-lg font-black text-slate-900 dark:text-white tabular-nums font-mono">{metricasAsesor.docentesTotal}</span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{metricasAsesor.horasContratadasTotal.toLocaleString('es-CL')}h</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSelectedEstadoBalance(selectedEstadoBalance === 'DEFICIT' ? 'ALL' : 'DEFICIT')}
          className={`card-elevated px-3 py-2 text-left transition-all ${
            selectedEstadoBalance === 'DEFICIT'
              ? 'ring-2 ring-rose-500/60 bg-rose-50/40 dark:bg-rose-950/20'
              : metricasAsesor.colegiosConDeficit > 0
                ? 'hover:border-rose-300 dark:hover:border-rose-800'
                : ''
          }`}
          title="Clic para filtrar escuelas en déficit"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">En Déficit</div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className={`text-lg font-black tabular-nums font-mono ${
              metricasAsesor.colegiosConDeficit > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'
            }`}>
              {metricasAsesor.colegiosConDeficit}
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
              {metricasAsesor.totalInconsistencias > 0 ? `${metricasAsesor.totalInconsistencias} alertas` : 'Sin alertas'}
            </span>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedEstadoBalance(selectedEstadoBalance === 'SUPERAVIT' ? 'ALL' : 'SUPERAVIT')}
          className={`card-elevated px-3 py-2 text-left transition-all col-span-2 sm:col-span-1 ${
            selectedEstadoBalance === 'SUPERAVIT' ? 'ring-2 ring-emerald-500/60 bg-emerald-50/40 dark:bg-emerald-950/20' : ''
          }`}
          title="Clic para filtrar escuelas con superávit"
        >
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Balanza Neta</div>
          <div className="flex items-baseline justify-between mt-0.5">
            <span className={`text-lg font-black tabular-nums font-mono ${
              metricasAsesor.balanceNeto > 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : metricasAsesor.balanceNeto < 0
                  ? 'text-rose-600 dark:text-rose-400'
                  : 'text-slate-700 dark:text-slate-200'
            }`}>
              {metricasAsesor.balanceNeto > 0 ? `+${metricasAsesor.balanceNeto}` : metricasAsesor.balanceNeto} HA
            </span>
            <span className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">{metricasAsesor.colegiosConSuperavit} sup.</span>
          </div>
        </button>
      </div>

      {/* 3. Barra de Búsqueda y Filtros en 1 Línea */}
      <div className="card-elevated px-3 py-2 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar escuela, RBD, comuna o director..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
          />
        </div>

        <select
          value={selectedComuna}
          onChange={(e) => setSelectedComuna(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="ALL">Todas las Comunas</option>
          {comunasDisponibles.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={selectedRegimen}
          onChange={(e) => setSelectedRegimen(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="ALL">Todos los Regímenes</option>
          {regimenesDisponibles.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <select
          value={selectedEstadoBalance}
          onChange={(e) => setSelectedEstadoBalance(e.target.value)}
          className="px-2.5 py-1.5 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
        >
          <option value="ALL">Estado: Todos</option>
          <option value="DEFICIT">En Déficit (&lt; 0 HA)</option>
          <option value="SUPERAVIT">Con Superávit (&gt; 0 HA)</option>
          <option value="EQUILIBRADO">Equilibrado (0 HA)</option>
        </select>

        {hayFiltrosActivos && (
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setSelectedComuna('ALL');
              setSelectedRegimen('ALL');
              setSelectedEstadoBalance('ALL');
            }}
            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1"
          >
            <X className="w-3.5 h-3.5" />
            <span>Limpiar</span>
          </button>
        )}
      </div>

      {/* 4. Contenido Principal: Tabla Compacta (Default) o Grid */}
      {colegiosFiltrados.length === 0 ? (
        <div className="card-elevated p-10 text-center">
          <Building2 className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
            No se encontraron establecimientos con los filtros actuales.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Prueba cambiando el alcance a "Territorio" o limpiando la búsqueda.
          </p>
        </div>
      ) : vistaModo === 'table' ? (
        <div className="card-elevated overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <th className="py-2.5 pl-3 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={todosFiltradosSeleccionados}
                      onChange={toggleSeleccionTodos}
                      aria-label="Seleccionar todas las escuelas"
                      className="rounded border-slate-300 dark:border-slate-600 text-orange-600 focus:ring-orange-500"
                    />
                  </th>
                  <th className="py-2.5 px-2">RBD</th>
                  <th className="py-2.5 px-2">Establecimiento</th>
                  <th className="py-2.5 px-2 hidden md:table-cell">Comuna</th>
                  <th className="py-2.5 px-2 hidden lg:table-cell">Asesor UATP</th>
                  <th className="py-2.5 px-2 text-right">Matrícula</th>
                  <th className="py-2.5 px-2 text-right hidden sm:table-cell">Docentes</th>
                  <th className="py-2.5 px-2 text-right">Balanza HA</th>
                  <th className="py-2.5 px-2 text-center hidden md:table-cell">Alertas</th>
                  <th className="py-2.5 pl-2 pr-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {colegiosFiltrados.map(est => {
                  const diag = diagnosticosMap.get(est.rbd);
                  const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
                  const mat = diag?.balanzaGeneral.totalMatriculaProyectada || 0;
                  const cursosCnt = diag?.balanzaGeneral.totalCursos || 0;
                  const docsCnt = todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo)).length;
                  const alertasCnt =
                    (diag?.balanzaGeneral.sobreasignacionesAlertas?.length || 0) +
                    (diag?.balanzaGeneral.alertasInfraestructura?.length || 0) +
                    (diag?.balanzaGeneral.alertasAforoPie?.length || 0);
                  const isActivo = colegioActivo?.rbd === est.rbd;
                  const isChecked = colegiosSeleccionadosBatch.includes(est.rbd);

                  return (
                    <tr
                      key={est.rbd}
                      className={`group transition-colors hover:bg-slate-50/90 dark:hover:bg-slate-800/40 ${
                        isActivo ? 'bg-orange-50/40 dark:bg-orange-950/20' : ''
                      }`}
                    >
                      <td className="py-2 pl-3 pr-2">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSeleccionBatch(est.rbd)}
                          aria-label={`Seleccionar ${est.nombre}`}
                          className="rounded border-slate-300 dark:border-slate-600 text-orange-600 focus:ring-orange-500"
                        />
                      </td>
                      <td className="py-2 px-2 font-mono font-bold text-slate-600 dark:text-slate-300 whitespace-nowrap">
                        {est.rbd}
                      </td>
                      <td className="py-2 px-2">
                        <button
                          type="button"
                          onClick={() => onAbrirWorkflow(est)}
                          className="text-left font-bold text-slate-900 dark:text-white hover:text-orange-600 dark:hover:text-orange-400 transition-colors flex items-center gap-1.5"
                        >
                          <span className="truncate max-w-[240px] xl:max-w-[320px]">{est.nombre}</span>
                          {isActivo && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 shrink-0">
                              Activo
                            </span>
                          )}
                        </button>
                        <div className="text-[10px] text-slate-400 truncate max-w-[240px]">
                          {est.regimen} · {est.director || 'Sin director'}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-slate-600 dark:text-slate-300 hidden md:table-cell whitespace-nowrap">
                        {est.comuna}
                      </td>
                      <td className="py-2 px-2 hidden lg:table-cell">
                        <select
                          value={est.asesorUatp || 'SIN_ASIGNAR'}
                          onChange={(e) => handleCambiarAsesorColegio(est, e.target.value)}
                          className="px-2 py-1 rounded-lg text-[11px] font-medium bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 text-slate-700 dark:text-slate-300 max-w-[170px]"
                        >
                          <option value="SIN_ASIGNAR">Sin asignar</option>
                          {todosLosAsesores.map(a => (
                            <option key={a.id} value={a.nombre}>{a.nombre}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">
                        {mat} <span className="text-[10px] text-slate-400">({cursosCnt}c)</span>
                      </td>
                      <td className="py-2 px-2 text-right tabular-nums font-mono text-slate-700 dark:text-slate-200 hidden sm:table-cell">
                        {docsCnt}
                      </td>
                      <td className="py-2 px-2 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-lg font-mono font-bold tabular-nums ${
                          bal > 0
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                            : bal < 0
                              ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                        }`}>
                          {bal > 0 ? `+${bal}` : bal}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-center hidden md:table-cell">
                        {alertasCnt > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 font-bold tabular-nums">
                            <AlertTriangle className="w-3 h-3" />
                            {alertasCnt}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">—</span>
                        )}
                      </td>
                      <td className="py-2 pl-2 pr-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1 relative">
                          <button
                            type="button"
                            onClick={() => onAbrirWorkflow(est)}
                            className="px-2.5 py-1 rounded-lg bg-slate-900 dark:bg-blue-600 hover:bg-orange-600 dark:hover:bg-blue-500 text-white text-[11px] font-bold transition-colors inline-flex items-center gap-1"
                          >
                            <span>Abrir</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => setMenuFilaAbiertoRbd(menuFilaAbiertoRbd === est.rbd ? null : est.rbd)}
                            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                            title="Más opciones"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>

                          {menuFilaAbiertoRbd === est.rbd && (
                            <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1 z-40 text-left animate-fade-in">
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuFilaAbiertoRbd(null);
                                  onSelectColegio(est);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Check className="w-3.5 h-3.5 text-orange-500" />
                                <span>Seleccionar como Activo</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuFilaAbiertoRbd(null);
                                  onExportarMatrizExcelColegio(est, periodoActivo);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Exportar Matriz (.xlsx)</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuFilaAbiertoRbd(null);
                                  setColegioParaGdp(est);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                                <span>Generar Planilla GDP</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setMenuFilaAbiertoRbd(null);
                                  onExportarDotacionColegio(est, periodoActivo);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                              >
                                <Download className="w-3.5 h-3.5 text-blue-600" />
                                <span>Exportar Ficha (.slep)</span>
                              </button>
                              {onEliminarColegio && (!permisos || esSuperUsuario) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuFilaAbiertoRbd(null);
                                    if (window.confirm(`¿Eliminar "${est.nombre}" (RBD ${est.rbd}) del catálogo?`)) {
                                      onEliminarColegio(est.rbd);
                                    }
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-t border-slate-100 dark:border-slate-800 mt-1 pt-1.5"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Eliminar Colegio</span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Vista Tarjetas Limpia (con checkbox para Reasignar Lote y menú ⋮ único) */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {colegiosFiltrados.map(est => {
            const diag = diagnosticosMap.get(est.rbd);
            const bal = diag?.balanzaGeneral.superavitDeficitLectivo || 0;
            const mat = diag?.balanzaGeneral.totalMatriculaProyectada || 0;
            const cursosCnt = diag?.balanzaGeneral.totalCursos || 0;
            const docsCnt = todosLosDocentes.filter(d => d.rbd === est.rbd && (d.periodo === undefined || d.periodo === periodoActivo)).length;
            const alertasCnt =
              (diag?.balanzaGeneral.sobreasignacionesAlertas?.length || 0) +
              (diag?.balanzaGeneral.alertasInfraestructura?.length || 0) +
              (diag?.balanzaGeneral.alertasAforoPie?.length || 0);
            const isActivo = colegioActivo?.rbd === est.rbd;
            const isChecked = colegiosSeleccionadosBatch.includes(est.rbd);

            return (
              <div
                key={est.rbd}
                className={`card-elevated p-4 flex flex-col justify-between gap-3 transition-all ${
                  isActivo ? 'ring-2 ring-orange-500/60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleSeleccionBatch(est.rbd)}
                      aria-label={`Seleccionar ${est.nombre}`}
                      className="mt-1 rounded border-slate-300 dark:border-slate-600 text-orange-600 focus:ring-orange-500"
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                          RBD {est.rbd}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">{est.comuna}</span>
                      </div>
                      <h3 className="font-bold text-sm text-slate-900 dark:text-white truncate mt-1">
                        {est.nombre}
                      </h3>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {est.regimen} · {est.asesorUatp || 'Sin asesor'}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-lg text-xs font-mono font-bold tabular-nums shrink-0 ${
                    bal > 0
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300'
                      : bal < 0
                        ? 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                  }`}>
                    {bal > 0 ? `+${bal}` : bal} HA
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 py-2 px-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-center">
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Matrícula</div>
                    <div className="text-xs font-black text-slate-900 dark:text-white tabular-nums font-mono">{mat} ({cursosCnt}c)</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Docentes</div>
                    <div className="text-xs font-black text-slate-900 dark:text-white tabular-nums font-mono">{docsCnt}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Alertas</div>
                    <div className={`text-xs font-black tabular-nums font-mono ${alertasCnt > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {alertasCnt > 0 ? alertasCnt : 'OK'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1 relative">
                  <button
                    type="button"
                    onClick={() => onAbrirWorkflow(est)}
                    className="flex-1 py-1.5 px-3 rounded-xl bg-slate-900 dark:bg-blue-600 hover:bg-orange-600 dark:hover:bg-blue-500 text-white text-xs font-bold transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Abrir Espacio</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setMenuFilaAbiertoRbd(menuFilaAbiertoRbd === est.rbd ? null : est.rbd)}
                    className="p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500"
                    title="Exportar y opciones"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </button>

                  {menuFilaAbiertoRbd === est.rbd && (
                    <div className="absolute right-0 bottom-full mb-1 w-52 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 py-1 z-40 text-left animate-fade-in">
                      <button
                        type="button"
                        onClick={() => {
                          setMenuFilaAbiertoRbd(null);
                          onExportarMatrizExcelColegio(est, periodoActivo);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Exportar Matriz (.xlsx)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuFilaAbiertoRbd(null);
                          setColegioParaGdp(est);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/50"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600" />
                        <span>Generar Planilla GDP</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMenuFilaAbiertoRbd(null);
                          onExportarDotacionColegio(est, periodoActivo);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      >
                        <Download className="w-3.5 h-3.5 text-blue-600" />
                        <span>Exportar Ficha (.slep)</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Reasignación Masiva */}
      {modalReasignarAbierto && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-md w-full p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-black text-slate-900 dark:text-white">
                Reasignar {colegiosSeleccionadosBatch.length} Escuela(s)
              </h3>
              <button onClick={() => setModalReasignarAbierto(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1.5">
                Asesor UATP de Destino
              </label>
              <select
                value={asesorDestinoBatch}
                onChange={(e) => setAsesorDestinoBatch(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
              >
                <option value="SIN_ASIGNAR">Sin Asesor (Dejar disponible)</option>
                {todosLosAsesores.map(a => (
                  <option key={a.id} value={a.nombre}>{a.nombre}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalReasignarAbierto(false)}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={procesandoReasignacion || colegiosSeleccionadosBatch.length === 0}
                onClick={handleEjecutarReasignacionMasiva}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white"
              >
                {procesandoReasignacion ? 'Reasignando...' : 'Confirmar Reasignación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Parámetros GDP */}
      {colegioParaGdp && (
        <GdpParametrosModal
          isOpen={Boolean(colegioParaGdp)}
          onClose={() => setColegioParaGdp(null)}
          establecimiento={colegioParaGdp}
          cursos={todosLosCursos.filter(c => c.rbd === colegioParaGdp.rbd && (c.periodo === undefined || c.periodo === periodoActivo))}
          docentes={todosLosDocentes.filter(d => d.rbd === colegioParaGdp.rbd && (d.periodo === undefined || d.periodo === periodoActivo))}
          asignaciones={todasLasAsignaciones.filter(a => a.rbd === colegioParaGdp.rbd && (a.periodo === undefined || a.periodo === periodoActivo))}
          asistentes={todosLosAsistentes.filter(a => a.rbd === colegioParaGdp.rbd && (a.periodo === undefined || a.periodo === periodoActivo))}
          onGuardarEstablecimiento={onGuardarColegio}
          onNotificar={(msg, tipo) => mostrarFeedback(msg, tipo === 'error' ? 'error' : 'ok')}
        />
      )}
    </div>
  );
};
