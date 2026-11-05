import React, { useState, useMemo } from 'react';
import {
  Scale, Users, BookOpen, Clock, ShieldCheck, LayoutGrid,
  FileSpreadsheet, Printer, ArrowRightLeft, FileUp, FileDown, Sparkles,
  Building2, MapPin, AlertTriangle, CheckCircle2, ChevronRight, Calendar, Trash2, ShieldAlert, ChevronDown, ChevronUp, Minimize2, Maximize2,
  CloudUpload, RefreshCw, Loader2, Radio
} from 'lucide-react';
import { useColaboracionColegio } from '../services/colaboracionService';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion
} from '../types';
import { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';
import { BalanzaDiagnosticoView } from './BalanzaDiagnosticoView';
import { DocentesDotacionView } from './DocentesDotacionView';
import { AsistentesDotacionView } from './AsistentesDotacionView';
import { CurriculumDemandaView } from './CurriculumDemandaView';
import { PieAuditorView } from './PieAuditorView';
import { SalasSaeView } from './SalasSaeView';
import { MatrizExcelImportModal } from '../components/MatrizExcelImportModal';
import { ComparadorPeriodosModal } from '../components/ComparadorPeriodosModal';
import { ModalTraspasoDotacion } from '../components/ModalTraspasoDotacion';
import { ConfirmarVaciarDotacionModal } from '../components/ConfirmarVaciarDotacionModal';
import { ExportarEstablecimientoModal } from '../components/ExportarEstablecimientoModal';
import { ImportarEstablecimientoModal } from '../components/ImportarEstablecimientoModal';
import { GdpParametrosModal } from '../components/GdpParametrosModal';
import { CentroDescargasModal } from '../components/CentroDescargasModal';
import { ProgresoDotacionBar } from '../components/ProgresoDotacionBar';
import { PermisosRol } from '../types/authTypes';

export interface ColegioWorkspaceViewProps {
  colegio: Establecimiento;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  asistentes?: AsistenteEducacion[];
  diagnostico: DiagnosticoColegioCompleto | null;
  permisos?: PermisosRol | null;
  onGuardarSala: (s: SalaInfraestructura) => Promise<void> | void;
  onEliminarSala: (id: string) => Promise<void> | void;
  onGuardarCurso: (c: CursoSae) => Promise<void> | void;
  onEliminarCurso: (id: string) => Promise<void> | void;
  onGuardarDocente: (d: Docente) => Promise<void> | void;
  onEliminarDocente: (id: string) => Promise<void> | void;
  onGuardarAsistente?: (a: AsistenteEducacion) => Promise<void> | void;
  onGuardarAsistentesBatch?: (asistentes: AsistenteEducacion[], reemplazar?: boolean) => Promise<void> | void;
  onEliminarAsistente?: (id: string) => Promise<void> | void;
  onGuardarAsignacion: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion: (id: string) => Promise<void> | void;
  onAbrirModuloSige: () => void;
  onExportarExcel: () => void;
  onAbrirNavegadorColegios: () => void;
  todosLosColegios?: Establecimiento[];
  todosLosDocentes?: Docente[];
  todasLasAsignaciones?: AsignacionHoraria[];
  periodoActivo?: number;
  initialTab?: 'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas';
  onTogglePeriodo?: (p: number) => void;
  onRefreshData?: () => void;
  onLimpiarDotacionColegio?: (periodo: number, rbd: string) => Promise<void> | void;
  onExportarDotacionColegio?: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onExportarMatrizExcelColegio?: (est: Establecimiento, periodo: number) => Promise<void> | void;
  onGuardarColegio?: (est: Establecimiento) => Promise<void>;
  onAbrirCopilot?: () => void;
  onNavegarAPestana?: (pestana: any) => void;
  onGuardarApartadoNube?: (apartado: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general') => Promise<void>;
  onRefrescarApartadoNube?: (apartado: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general') => Promise<void>;
  guardandoEnNube?: boolean;
  sincronizandoNube?: boolean;
  usuarioActual?: { id: string; nombreCompleto: string; email?: string; role: string } | null;
  onTabChange?: (tab: 'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas') => void;
}

export const ColegioWorkspaceView: React.FC<ColegioWorkspaceViewProps> = ({
  colegio,
  salas,
  cursos,
  docentes,
  asignaciones,
  asistentes = [],
  diagnostico,
  permisos,
  onGuardarSala,
  onEliminarSala,
  onGuardarCurso,
  onEliminarCurso,
  onGuardarDocente,
  onEliminarDocente,
  onGuardarAsistente,
  onGuardarAsistentesBatch,
  onEliminarAsistente,
  onGuardarAsignacion,
  onEliminarAsignacion,
  onAbrirModuloSige,
  onExportarExcel,
  onAbrirNavegadorColegios,
  todosLosColegios = [],
  todosLosDocentes = [],
  todasLasAsignaciones = [],
  periodoActivo = 2027,
  initialTab,
  onTogglePeriodo,
  onRefreshData,
  onLimpiarDotacionColegio,
  onExportarDotacionColegio,
  onExportarMatrizExcelColegio,
  onGuardarColegio,
  onAbrirCopilot,
  onNavegarAPestana,
  onGuardarApartadoNube,
  onRefrescarApartadoNube,
  guardandoEnNube = false,
  sincronizandoNube = false,
  usuarioActual,
  onTabChange
}) => {
  const [tabActiva, setTabActivaState] = useState<'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas'>(initialTab || 'balanza');

  const setTabActiva = (tab: 'balanza' | 'docentes' | 'asistentes' | 'cursos' | 'pie' | 'salas') => {
    setTabActivaState(tab);
    onTabChange?.(tab);
  };

  React.useEffect(() => {
    if (initialTab) {
      setTabActivaState(initialTab);
      onTabChange?.(initialTab);
    }
  }, [initialTab, colegio.rbd]);
  const [modalMatrizAbierto, setModalMatrizAbierto] = useState(false);
  const [modalComparadorAbierto, setModalComparadorAbierto] = useState(false);
  const [modalTraspasoAbierto, setModalTraspasoAbierto] = useState(false);
  const [modalVaciarSeguroAbierto, setModalVaciarSeguroAbierto] = useState(false);
  const [modalExportarEstablecimientoAbierto, setModalExportarEstablecimientoAbierto] = useState(false);
  const [modalImportarEstablecimientoAbierto, setModalImportarEstablecimientoAbierto] = useState(false);
  const [modalGdpAbierto, setModalGdpAbierto] = useState(false);
  const [modalCentroDescargasAbierto, setModalCentroDescargasAbierto] = useState(false);
  const [menuAvanzadoAbierto, setMenuAvanzadoAbierto] = useState(false);
  const [kpisExpandidos, setKpisExpandidos] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.innerHeight <= 864) return false;
    return true;
  });
  const [alertaCambioRemoto, setAlertaCambioRemoto] = useState<{
    apartado: 'docentes' | 'asistentes' | 'cursos' | 'salas' | 'pie' | 'general';
    mensaje: string;
    timestamp: number;
  } | null>(null);
  const [toastGdp, setToastGdp] = useState<{ texto: string; tipo: 'success' | 'error' } | null>(null);

  // Colaboración multi-usuario en tiempo real (memoizado para evitar re-suscripciones innecesarias)
  const usuarioColaboracion = useMemo(() => {
    if (!usuarioActual) return null;
    return {
      id: usuarioActual.id,
      nombreCompleto: usuarioActual.nombreCompleto,
      email: usuarioActual.email,
      role: usuarioActual.role
    };
  }, [usuarioActual?.id, usuarioActual?.nombreCompleto, usuarioActual?.email, usuarioActual?.role]);

  const { usuariosEnColegio, hayOtrosUsuarios } = useColaboracionColegio({
    rbd: colegio?.rbd,
    periodo: periodoActivo,
    usuarioActual: usuarioColaboracion,
    apartadoActual: tabActiva,
    onCambioRemotoDetectado: (notif) => {
      const labelsApartados: Record<string, string> = {
        docentes: 'Docentes y Asignaciones',
        asistentes: 'Asistentes de la Educación',
        cursos: 'Cursos y Demanda',
        salas: 'Salas',
        pie: 'Programa PIE',
        general: 'Dotación'
      };
      setAlertaCambioRemoto({
        apartado: notif.apartado,
        mensaje: `Un colega acaba de actualizar el apartado de ${labelsApartados[notif.apartado] || notif.apartado}.`,
        timestamp: Date.now()
      });
    }
  });

  // Auto-compactar KPIs cuando el usuario entra a tablas densas (Docentes, Cursos, Asistentes, PIE, Salas)
  React.useEffect(() => {
    if (tabActiva !== 'balanza' && typeof window !== 'undefined' && window.innerHeight <= 920) {
      setKpisExpandidos(false);
    }
  }, [tabActiva]);

  const handleEjecutarVaciarDotacion = async () => {
    if (onLimpiarDotacionColegio) {
      await onLimpiarDotacionColegio(periodoActivo, colegio.rbd);
    }
  };

  const bg = diagnostico?.balanzaGeneral;
  const balance = bg?.superavitDeficitLectivo || 0;

  const tabs = [
    { id: 'balanza' as const, label: 'Balanza & Diagnóstico', icon: Scale, badge: balance > 0 ? `+${balance}h` : `${balance}h` },
    { id: 'docentes' as const, label: 'Nómina Docente (Ley 20.903)', icon: Users, badge: `${docentes.length}` },
    { id: 'asistentes' as const, label: 'Asistentes Educación', icon: Users, badge: `${asistentes.length}` },
    { id: 'cursos' as const, label: 'Cursos & Planes MINEDUC', icon: BookOpen, badge: `${cursos.length}` },
    { id: 'pie' as const, label: 'Auditoría PIE (Dec. 170)', icon: ShieldCheck, badge: `${bg?.horasPieDemandadas || 0}h` },
    { id: 'salas' as const, label: 'Salas & Aforo SAE (Dec. 548)', icon: LayoutGrid, badge: `${salas.length}` }
  ];

  return (
    <div className="space-y-3.5 animate-fade-in">
      
      {/* Cockpit Ejecutivo Superior Adaptativo */}
      <div className="card-elevated p-4 sm:p-5 overflow-hidden transition-all">
        <div className={`flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 ${kpisExpandidos ? 'pb-4 border-b border-slate-100 dark:border-slate-800' : ''}`}>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 font-mono">
                RBD {colegio.rbd}
              </span>
              <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold flex items-center gap-1 ${
                periodoActivo === 2027 
                  ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800' 
                  : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
              }`}>
                <Calendar className="w-3 h-3" />
                {periodoActivo === 2027 ? 'Dotación 2027' : 'Dotación 2026'}
              </span>
              <span className="text-slate-300 dark:text-slate-700">•</span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" /> {colegio.comuna}
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
              <span className="hidden sm:inline text-xs font-semibold text-slate-500 dark:text-slate-400">
                {colegio.regimen} ({colegio.porcentajePrioritarios}% SEP • {colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35'})
              </span>
              <span className="hidden lg:inline text-slate-300 dark:text-slate-700">•</span>
              <span className="hidden lg:inline text-xs text-slate-500 dark:text-slate-400">
                Dir: <strong className="text-slate-700 dark:text-slate-300">{colegio.director || 'S/I'}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap mt-1.5">
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate">
                {colegio.nombre}
              </h2>
              <button
                onClick={onAbrirNavegadorColegios}
                className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800/60 transition-colors inline-flex items-center gap-1 shrink-0"
                title="Cambiar de escuela (Ctrl+K / ⌘K)"
              >
                <span>Cambiar</span>
                <ChevronRight className="w-3 h-3" />
              </button>

              {/* Resumen KPI en línea cuando el modo compacto está activo */}
              {!kpisExpandidos && (
                <div className="hidden md:flex items-center gap-1.5 ml-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border ${
                    balance > 0 ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : balance < 0 ? 'bg-rose-50 text-rose-800 border-rose-200' : 'bg-slate-100 text-slate-700 border-slate-200'
                  }`}>
                    Balanza: {balance > 0 ? `+${balance}` : balance} HA
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Demanda: {bg?.horasAulaDemandadasCurriculo || 0} HA
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    Matrícula: {bg?.totalMatriculaProyectada || 0}
                  </span>
                  <span className="px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300">
                    PIE: {bg?.horasPieDemandadas || 0}h
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Barra de Acciones Desduplicada y Compacta */}
          <div className="flex items-center gap-1.5 flex-wrap shrink-0">
            {/* Indicador de Colaboración en Tiempo Real */}
            {hayOtrosUsuarios && (
              <div className="relative group">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-bold shadow-sm">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  </span>
                  <span>{usuariosEnColegio.length} colega{usuariosEnColegio.length > 1 ? 's' : ''} activo{usuariosEnColegio.length > 1 ? 's' : ''}</span>
                </div>
                {/* Tooltip con los usuarios y sus apartados */}
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl p-2.5 shadow-2xl z-50 text-[11px] text-slate-300 hidden group-hover:block animate-in fade-in">
                  <p className="font-bold text-white border-b border-slate-700 pb-1 mb-1.5">Trabajando ahora en esta escuela:</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {usuariosEnColegio.map((u, i) => (
                      <div key={i} className="flex flex-col border-b border-slate-800 last:border-0 pb-1">
                        <span className="font-semibold text-slate-200">{u.nombreCompleto}</span>
                        <div className="flex items-center justify-between text-[10px] text-slate-400">
                          <span>{u.role.replace('_', ' ')}</span>
                          <span className="text-amber-300 font-mono">Pestaña: {u.apartadoActivo}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Botón Guardar este Apartado en Supabase */}
            {onGuardarApartadoNube && (
              <button
                type="button"
                onClick={() => onGuardarApartadoNube(tabActiva === 'balanza' ? 'general' : tabActiva)}
                disabled={guardandoEnNube}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-md border border-emerald-400/40 transition-all active:scale-[0.98]"
                title={`Guardar exclusivamente los cambios de la pestaña "${tabs.find(t => t.id === tabActiva)?.label}" en Supabase sin sobrescribir otros apartados`}
              >
                {guardandoEnNube ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                ) : (
                  <CloudUpload className="w-3.5 h-3.5 text-emerald-200" />
                )}
                <span>Guardar {tabActiva === 'balanza' ? 'Todo' : tabs.find(t => t.id === tabActiva)?.label.split(' ')[0]}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setKpisExpandidos(!kpisExpandidos)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl text-xs font-bold transition-all"
              title={kpisExpandidos ? 'Ocultar tarjetas KPI grandes para ganar espacio vertical' : 'Mostrar tarjetas KPI detalladas'}
            >
              {kpisExpandidos ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{kpisExpandidos ? 'Compactar KPIs' : 'Ver KPIs'}</span>
            </button>

            {/* 1. Importar Matriz Excel (Oculto para Directores) */}
            {(!permisos || permisos.puedeImportarMatriz) && (
              <button
                onClick={() => setModalMatrizAbierto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm border border-slate-700/80 active:scale-[0.98]"
                title="Importar planilla Excel oficial con asignaciones"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-orange-400" />
                <span>Importar Matriz</span>
              </button>
            )}

            {/* 2. Centro de Descargas Unificado (Oculto para Directores) */}
            {(!permisos || permisos.puedeVerCentroDescargas) && (
              <button
                onClick={() => setModalCentroDescargasAbierto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                title="Descargar PAL 2027 DEP, GDP, Matriz Excel, Coeficientes Asistentes o Ficha"
              >
                <FileDown className="w-3.5 h-3.5 text-emerald-200" />
                <span>Descargas</span>
              </button>
            )}

            {/* 3. Traspaso de Dotación (Oculto para Directores) */}
            {(!permisos || permisos.puedeTraspasarPeriodos) && (
              <button
                onClick={() => setModalTraspasoAbierto(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                title="Asistente guiado de traspaso de dotación 2026 a 2027"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span className="hidden md:inline">Traspaso 26➔27</span>
                <span className="md:hidden">26➔27</span>
              </button>
            )}

            {/* 5. Exportación Directa de Matriz Oficial para Director / Menú Desplegable para Asesor y Admin */}
            {permisos && !permisos.puedeAccederTodasEscuelas ? (
              /* Director: Botón directo y limpio para Exportar Matriz Oficial Excel (.xlsx) */
              onExportarMatrizExcelColegio && (
                <button
                  onClick={() => onExportarMatrizExcelColegio(colegio, periodoActivo)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/25 active:scale-[0.98]"
                  title="Exportar Matriz Oficial Excel (.xlsx) de este establecimiento"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-100" />
                  <span>Exportar Matriz Oficial (.xlsx)</span>
                </button>
              )
            ) : (
              /* Asesor / Admin: Menú completo de Acciones & Reportes */
              <div className="relative">
                <button
                  onClick={() => setMenuAvanzadoAbierto(!menuAvanzadoAbierto)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-sm active:scale-[0.98]"
                  title="Más acciones, exportaciones y reportes"
                >
                  <span>Acciones & Reportes</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuAvanzadoAbierto ? 'rotate-180' : ''}`} />
                </button>

                {menuAvanzadoAbierto && (
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800 backdrop-blur-md">
                    
                    {/* Reportes y Exportaciones */}
                    <div className="p-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setModalComparadorAbierto(true);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors text-left"
                      >
                        <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                        <span>Comparar 2026 vs 2027</span>
                      </button>

                      {onExportarMatrizExcelColegio && (
                        <button
                          onClick={() => {
                            onExportarMatrizExcelColegio(colegio, periodoActivo);
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors text-left"
                        >
                          <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          <span>Exportar Matriz Oficial Excel (.xlsx)</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setModalGdpAbierto(true);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/60 hover:text-amber-700 dark:hover:text-amber-300 transition-colors text-left"
                      >
                        <FileSpreadsheet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                        <span>Exportar Planilla GDP Oficial (.xlsx)</span>
                      </button>

                      {onExportarDotacionColegio && (
                        <button
                          onClick={() => {
                            onExportarDotacionColegio(colegio, periodoActivo);
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 hover:text-blue-700 dark:hover:text-blue-300 transition-colors text-left"
                        >
                          <FileDown className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          <span>Exportar Ficha (.slep)</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setModalImportarEstablecimientoAbierto(true);
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <FileUp className="w-4 h-4 text-slate-500" />
                        <span>Importar Ficha (.slep)</span>
                      </button>

                      <button
                        onClick={() => {
                          onAbrirModuloSige();
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 hover:text-orange-700 dark:hover:text-orange-300 transition-colors text-left"
                      >
                        <FileUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                        <span>Cargar Nómina SIGE</span>
                      </button>

                      <button
                        onClick={() => {
                          window.print();
                          setMenuAvanzadoAbierto(false);
                        }}
                        className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                      >
                        <Printer className="w-4 h-4 text-slate-500" />
                        <span>Imprimir Informe Oficial</span>
                      </button>
                    </div>

                    {/* Zona de Peligro */}
                    {onLimpiarDotacionColegio && (
                      <div className="p-1">
                        <button
                          onClick={() => {
                            setModalVaciarSeguroAbierto(true);
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors text-left"
                        >
                          <Trash2 className="w-4 h-4 text-rose-500" />
                          <span>Vaciar Dotación del Período</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* 4 KPIs Clave en Formato Bento (Colapsable para ganar espacio vertical) */}
        {kpisExpandidos && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
          
          {/* 1. Balanza Lectiva */}
          <div className={`p-3.5 rounded-2xl border transition-all ${
            balance > 0 
              ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60 text-emerald-950 dark:text-emerald-200' 
              : balance < 0 
                ? 'bg-rose-50/70 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/60 text-rose-950 dark:text-rose-200' 
                : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200'
          }`}>
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

          {/* 2. Demanda Curricular */}
          <div className="card-elevated p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Demanda Curricular</span>
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums font-mono">
              {bg?.horasAulaDemandadasCurriculo || 0} <span className="text-xs font-normal text-slate-400">HA</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {cursos.length} cursos matriculados
            </div>
          </div>

          {/* 3. Matrícula y Aforo */}
          <div className="card-elevated p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Matrícula vs SAE</span>
              <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white mt-0.5 tabular-nums font-mono">
              {bg?.totalMatriculaProyectada || 0} <span className="text-xs font-normal text-slate-400">/ {bg?.totalCuposSae || 0} cupos</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              {salas.length} salas de clases registradas
            </div>
          </div>

          {/* 4. Demanda PIE */}
          <div className="card-elevated p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Demanda PIE Dec. 170</span>
              <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-purple-600 dark:text-purple-400 mt-0.5 tabular-nums font-mono">
              {bg?.horasPieDemandadas || 0} <span className="text-xs font-normal text-slate-400">hrs</span>
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 tabular-nums">
              + {bg?.horasColaborativasDemandadas || 0}h co-docencia obligatorias
            </div>
          </div>

        </div>
        )}
      </div>

      {/* Banner de Aviso de Actualización Remota Concurrente */}
      {alertaCambioRemoto && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-sky-950/70 border border-sky-500/40 text-sky-200 text-xs shadow-lg animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <Radio className="w-4 h-4 text-sky-400 animate-pulse shrink-0" />
            <div>
              <span className="font-bold text-white">{alertaCambioRemoto.mensaje}</span>
              <p className="text-[11px] text-sky-300/80">
                Puedes traer los cambios de ese apartado sin afectar las modificaciones que tienes abiertas en tu pestaña actual.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onRefrescarApartadoNube && (
              <button
                type="button"
                onClick={async () => {
                  await onRefrescarApartadoNube(alertaCambioRemoto.apartado);
                  setAlertaCambioRemoto(null);
                }}
                disabled={sincronizandoNube}
                className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${sincronizandoNube ? 'animate-spin' : ''}`} />
                <span>Actualizar {alertaCambioRemoto.apartado}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setAlertaCambioRemoto(null)}
              className="p-1.5 text-sky-400 hover:text-white rounded-lg"
              title="Ignorar aviso"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Flujo Guiado de 5 Pasos para Certificación Escolar (Compactado por defecto fuera de Balanza) */}
      <ProgresoDotacionBar
        cursos={cursos}
        docentes={docentes}
        asignaciones={asignaciones}
        asistentes={asistentes}
        balanceAula={balance}
        onSelectTab={(tabId) => setTabActiva(tabId)}
        defaultCollapsed={tabActiva !== 'balanza'}
      />

      {/* Navegación por Pestañas Estilizadas (Sticky para cambio rápido sin hacer scroll arriba) */}
      <div className="sticky top-14 sm:top-16 z-30 bg-canvas/95 backdrop-blur-md py-1.5 flex items-center gap-1.5 border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar text-xs font-medium">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isSelected = tabActiva === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setTabActiva(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-bold transition-all whitespace-nowrap active:scale-[0.98] ${
                isSelected
                  ? 'bg-slate-900 text-white shadow-soft-sm dark:bg-blue-600 dark:text-white'
                  : 'card-elevated text-slate-600 dark:text-slate-300 hover:text-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isSelected ? 'text-orange-400 dark:text-amber-300' : 'text-slate-400'}`} />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black tabular-nums font-mono ${
                isSelected ? 'bg-orange-500 text-white dark:bg-white/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
              }`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* Contenido de Pestaña */}
      <div className="space-y-6">
        {tabActiva === 'balanza' && (
          <BalanzaDiagnosticoView
            diagnostico={diagnostico}
            onExportarExcel={onExportarExcel}
          />
        )}

        {tabActiva === 'docentes' && (
          <DocentesDotacionView
            colegio={colegio}
            docentes={docentes}
            asignaciones={asignaciones}
            onGuardarDocente={onGuardarDocente}
            onEliminarDocente={onEliminarDocente}
            todosLosColegios={todosLosColegios}
            todosLosDocentes={todosLosDocentes}
            todasLasAsignaciones={todasLasAsignaciones}
            cursos={cursos}
            onGuardarAsignacion={onGuardarAsignacion}
            onEliminarAsignacion={onEliminarAsignacion}
            onNavegarAPestana={onNavegarAPestana || (() => setTabActiva('cursos'))}
            periodoActivo={periodoActivo}
          />
        )}

        {tabActiva === 'asistentes' && onGuardarAsistente && onEliminarAsistente && (
          <AsistentesDotacionView
            colegio={colegio}
            asistentes={asistentes}
            matricula={cursos.reduce((sum, c) => sum + (c.matriculaProyectada || 0), 0)}
            salasParvulo={salas.filter((s) => s.tipo === 'PARVULARIA').length}
            periodoActivo={periodoActivo}
            onGuardarAsistente={onGuardarAsistente}
            onGuardarAsistentesBatch={onGuardarAsistentesBatch}
            onEliminarAsistente={onEliminarAsistente}
          />
        )}

        {tabActiva === 'cursos' && (
          <CurriculumDemandaView
            colegio={colegio}
            cursos={cursos}
            docentes={docentes}
            asignaciones={asignaciones}
            onGuardarCurso={onGuardarCurso}
            onEliminarCurso={onEliminarCurso}
            onGuardarAsignacion={onGuardarAsignacion}
            onEliminarAsignacion={onEliminarAsignacion}
            periodoActivo={periodoActivo}
            onSincronizarMalla={onRefreshData}
            onGestionarPlanes={() => {
              if (onNavegarAPestana) onNavegarAPestana('planes_estudio');
            }}
          />
        )}

        {tabActiva === 'pie' && (
          <PieAuditorView
            colegio={colegio}
            cursos={cursos}
            docentes={docentes}
            asistentes={asistentes}
            asignaciones={asignaciones}
            onGuardarCurso={onGuardarCurso}
            onGuardarAsignacion={onGuardarAsignacion}
            onEliminarAsignacion={onEliminarAsignacion}
          />
        )}

        {tabActiva === 'salas' && (
          <SalasSaeView
            colegio={colegio}
            salas={salas}
            cursos={cursos}
            onGuardarSala={onGuardarSala}
            onEliminarSala={onEliminarSala}
            onGuardarCurso={onGuardarCurso}
          />
        )}
      </div>

      {/* Modales */}
      <ExportarEstablecimientoModal
        isOpen={modalExportarEstablecimientoAbierto}
        onClose={() => setModalExportarEstablecimientoAbierto(false)}
        establecimiento={colegio}
        periodo={2027}
        cursos={cursos}
        docentes={docentes}
        asistentes={asistentes}
        salas={salas}
        asignaciones={asignaciones}
      />

      <ImportarEstablecimientoModal
        isOpen={modalImportarEstablecimientoAbierto}
        onClose={() => setModalImportarEstablecimientoAbierto(false)}
        todosLosColegios={todosLosColegios}
        colegioActivo={colegio}
        periodoActivo={2027}
        onImportSuccess={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      <MatrizExcelImportModal
        isOpen={modalMatrizAbierto}
        onClose={() => setModalMatrizAbierto(false)}
        colegioActivo={colegio}
        colegios={todosLosColegios}
        periodoPorDefecto={2027}
        onImportComplete={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      <ComparadorPeriodosModal
        isOpen={modalComparadorAbierto}
        onClose={() => setModalComparadorAbierto(false)}
        colegioActivo={colegio}
        colegios={todosLosColegios}
        onPeriodoActualizado={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      <ConfirmarVaciarDotacionModal
        isOpen={modalVaciarSeguroAbierto}
        onClose={() => setModalVaciarSeguroAbierto(false)}
        colegio={colegio}
        periodoActivo={periodoActivo}
        cursosCount={cursos.length}
        docentesCount={docentes.length}
        asignacionesCount={asignaciones.length}
        onConfirmarVaciar={handleEjecutarVaciarDotacion}
        onExportarRespaldoPrevio={onExportarDotacionColegio ? () => onExportarDotacionColegio(colegio, periodoActivo) : undefined}
      />

      <ModalTraspasoDotacion
        isOpen={modalTraspasoAbierto}
        onClose={() => setModalTraspasoAbierto(false)}
        colegioActivo={colegio}
        colegios={todosLosColegios}
        periodoOrigen={2026}
        periodoDestino={2027}
        onTraspasoCompletado={() => {
          if (onRefreshData) onRefreshData();
        }}
      />

      {modalGdpAbierto && (
        <GdpParametrosModal
          isOpen={modalGdpAbierto}
          onClose={() => setModalGdpAbierto(false)}
          establecimiento={colegio}
          docentes={docentes}
          asistentes={asistentes}
          cursos={cursos}
          asignaciones={asignaciones}
          onGuardarEstablecimiento={onGuardarColegio || (async () => {})}
          onNotificar={(texto, tipo) => setToastGdp({ texto, tipo: tipo || 'success' })}
        />
      )}

      {/* Toast Flotante para Notificaciones de Exportación */}
      {toastGdp && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md animate-fade-in shadow-2xl">
          <div className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs font-bold text-white shadow-lg ${
            toastGdp.tipo === 'success' ? 'bg-emerald-600 border-emerald-500' : 'bg-rose-600 border-rose-500'
          }`}>
            <span>{toastGdp.texto}</span>
            <button
              onClick={() => setToastGdp(null)}
              className="text-white/80 hover:text-white underline text-[11px] ml-2"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Centro Unificado de Descargas & Reportes Oficiales */}
      <CentroDescargasModal
        isOpen={modalCentroDescargasAbierto}
        onClose={() => setModalCentroDescargasAbierto(false)}
        colegio={colegio}
        cursos={cursos}
        docentes={docentes}
        asignaciones={asignaciones}
        asistentes={asistentes}
        periodoActivo={periodoActivo}
        onAbrirGdpModal={() => setModalGdpAbierto(true)}
        onExportarFichaSlep={onExportarDotacionColegio ? () => onExportarDotacionColegio(colegio, periodoActivo) : undefined}
      />
    </div>
  );
};
