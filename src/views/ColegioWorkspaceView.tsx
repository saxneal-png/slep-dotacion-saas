import React, { useState, useMemo } from 'react';
import {
  Scale, Users, BookOpen, ShieldCheck, LayoutGrid,
  FileSpreadsheet, Printer, FileUp, FileDown, Sparkles,
  MapPin, ChevronRight, Calendar, Trash2, ShieldAlert, ChevronDown,
  RefreshCw, Radio
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
import { ModalAuditoriaIntegridad } from '../components/ModalAuditoriaIntegridad';
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
  onGuardarAsignacionesBatch?: (asigs: AsignacionHoraria[]) => Promise<void> | void;
  onEliminarAsignacion: (id: string) => Promise<void> | void;
  onAbrirModuloSige: () => void;
  onExportarExcel: () => void;
  onAbrirNavegadorColegios: () => void;
  todosLosColegios?: Establecimiento[];
  todosLosDocentes?: Docente[];
  todasLasAsignaciones?: AsignacionHoraria[];
  todosLosCursos?: CursoSae[];
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
  onGuardarAsignacionesBatch,
  onEliminarAsignacion,
  onAbrirModuloSige,
  onExportarExcel,
  onAbrirNavegadorColegios,
  todosLosColegios = [],
  todosLosDocentes = [],
  todasLasAsignaciones = [],
  todosLosCursos = [],
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
  const [modalIntegridadAbierto, setModalIntegridadAbierto] = useState(false);
  const [menuAvanzadoAbierto, setMenuAvanzadoAbierto] = useState(false);
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

  const handleEjecutarVaciarDotacion = async () => {
    if (onLimpiarDotacionColegio) {
      await onLimpiarDotacionColegio(periodoActivo, colegio.rbd);
    }
  };

  const bg = diagnostico?.balanzaGeneral;
  const balance = bg?.superavitDeficitLectivo || 0;

  const porcentajeAvance = useMemo(() => {
    let completados = 0;
    if (cursos.length > 0) completados++;
    if (docentes.length > 0) completados++;
    if (asignaciones.length > 0) completados++;
    if (asistentes.length > 0) completados++;
    if (balance >= 0 && cursos.length > 0 && docentes.length > 0) completados++;
    return Math.round((completados / 5) * 100);
  }, [cursos.length, docentes.length, asignaciones.length, asistentes.length, balance]);

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
      
      {/* Cockpit Slim 1-Línea (Jobs + Toyota Lean: Cero ruido, máximo espacio de tabla) */}
      <div className="card-elevated px-3.5 py-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <span className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 font-mono shrink-0">
              RBD {colegio.rbd}
            </span>
            <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight truncate max-w-full sm:max-w-[320px] xl:max-w-[440px]">
              {colegio.nombre}
            </h2>
            <button
              onClick={onAbrirNavegadorColegios}
              className="text-[11px] font-bold text-orange-600 dark:text-orange-400 hover:text-orange-700 bg-orange-50 dark:bg-orange-950/40 hover:bg-orange-100 px-2 py-0.5 rounded-lg border border-orange-200 dark:border-orange-800/60 transition-colors inline-flex items-center gap-0.5 shrink-0"
              title="Cambiar de escuela (Ctrl+K / ⌘K)"
            >
              <span>Cambiar</span>
              <ChevronRight className="w-3 h-3" />
            </button>

            <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 truncate">
              <span className="inline-flex items-center gap-1 font-semibold">
                <MapPin className="w-3 h-3 text-slate-400" /> {colegio.comuna}
              </span>
              <span>·</span>
              <span>{colegio.regimen}</span>
              <span>·</span>
              <span className="font-mono font-semibold">{colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35'}</span>
              <span>·</span>
              <span className="truncate max-w-[160px]" title={colegio.director || 'S/I'}>
                Dir: {colegio.director || 'S/I'}
              </span>
            </span>

            <span
              className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold border shrink-0 ${
                balance > 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60'
                  : balance < 0
                    ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/60'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
              }`}
              title="Balanza de horas lectivas en aula"
            >
              Balanza {balance > 0 ? `+${balance}` : balance} HA
            </span>

            <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold inline-flex items-center gap-1 shrink-0 ${
              periodoActivo === 2027
                ? 'bg-indigo-100 dark:bg-indigo-950/60 text-indigo-800 dark:text-indigo-300'
                : 'bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300'
            }`}>
              <Calendar className="w-2.5 h-2.5" />
              {periodoActivo}
            </span>
          </div>

          {/* Acciones Consolidadas (Sin botón Guardar duplicado; vive en el Header global) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {hayOtrosUsuarios && (
              <div className="relative group">
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-bold">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  <span>{usuariosEnColegio.length} activo{usuariosEnColegio.length > 1 ? 's' : ''}</span>
                </div>
                <div className="absolute right-0 top-full mt-1.5 w-64 bg-slate-900 border border-slate-700 rounded-xl p-2.5 shadow-2xl z-50 text-[11px] text-slate-300 hidden group-hover:block">
                  <p className="font-bold text-white border-b border-slate-700 pb-1 mb-1.5">Editando en este colegio:</p>
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

            {permisos && !permisos.puedeAccederTodasEscuelas ? (
              onExportarMatrizExcelColegio && (
                <button
                  onClick={() => onExportarMatrizExcelColegio(colegio, periodoActivo)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                  title="Exportar Matriz Oficial Excel (.xlsx) de este establecimiento"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-100" />
                  <span>Exportar Matriz (.xlsx)</span>
                </button>
              )
            ) : (
              <>
                {(!permisos || permisos.puedeVerCentroDescargas) && (
                  <button
                    onClick={() => setModalCentroDescargasAbierto(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-[0.98]"
                    title="Descargar PAL 2027 DEP, GDP, Matriz Excel, Coeficientes Asistentes o Ficha"
                  >
                    <FileDown className="w-3.5 h-3.5 text-emerald-100" />
                    <span>Descargas</span>
                  </button>
                )}

                <div className="relative">
                  <button
                    onClick={() => setMenuAvanzadoAbierto(!menuAvanzadoAbierto)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-all border border-slate-200 dark:border-slate-700 shadow-sm active:scale-[0.98]"
                    title="Importación, auditoría, traspaso y exportaciones"
                  >
                    <span>Herramientas</span>
                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${menuAvanzadoAbierto ? 'rotate-180' : ''}`} />
                  </button>

                  {menuAvanzadoAbierto && (
                    <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 py-2 z-50 animate-fade-in divide-y divide-slate-100 dark:divide-slate-800">
                      <div className="p-1 space-y-0.5">
                        {(!permisos || permisos.puedeImportarMatriz) && (
                          <button
                            onClick={() => {
                              setModalMatrizAbierto(true);
                              setMenuAvanzadoAbierto(false);
                            }}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 transition-colors text-left"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-orange-500" />
                            <span>Importar Matriz Excel</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            onAbrirModuloSige();
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-orange-50 dark:hover:bg-orange-950/60 transition-colors text-left"
                        >
                          <FileUp className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                          <span>Cargar Nómina SIGE</span>
                        </button>

                        <button
                          onClick={() => {
                            setModalIntegridadAbierto(true);
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors text-left"
                        >
                          <ShieldAlert className="w-4 h-4 text-amber-500" />
                          <span>Reparar Integridad</span>
                        </button>
                      </div>

                      <div className="p-1 space-y-0.5">
                        <button
                          onClick={() => {
                            setModalComparadorAbierto(true);
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors text-left"
                        >
                          <Scale className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          <span>Comparar 2026 vs 2027</span>
                        </button>

                        {(!permisos || permisos.puedeTraspasarPeriodos) && (
                          <button
                            onClick={() => {
                              setModalTraspasoAbierto(true);
                              setMenuAvanzadoAbierto(false);
                            }}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 transition-colors text-left"
                          >
                            <Sparkles className="w-4 h-4 text-indigo-500" />
                            <span>Traspaso 2026 ➔ 2027</span>
                          </button>
                        )}
                      </div>

                      <div className="p-1 space-y-0.5">
                        {onExportarMatrizExcelColegio && (
                          <button
                            onClick={() => {
                              onExportarMatrizExcelColegio(colegio, periodoActivo);
                              setMenuAvanzadoAbierto(false);
                            }}
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors text-left"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            <span>Exportar Matriz Oficial (.xlsx)</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setModalGdpAbierto(true);
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-amber-50 dark:hover:bg-amber-950/60 transition-colors text-left"
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
                            className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-950/60 transition-colors text-left"
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
                            window.print();
                            setMenuAvanzadoAbierto(false);
                          }}
                          className="w-full flex items-center space-x-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
                        >
                          <Printer className="w-4 h-4 text-slate-500" />
                          <span>Imprimir Informe Oficial</span>
                        </button>
                      </div>

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
              </>
            )}
          </div>
        </div>
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

      {/* Navegación por Pestañas Estilizadas (Sticky bajo Header 12/14 + Píldora de Avance) */}
      <div className="sticky top-12 sm:top-14 z-30 bg-canvas/95 backdrop-blur-md py-1.5 flex items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-medium min-w-0">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isSelected = tabActiva === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setTabActiva(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap active:scale-[0.98] ${
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

        <button
          type="button"
          onClick={() => setTabActiva('balanza')}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0 tabular-nums"
          title="Ver progreso completo de certificación en Balanza & Diagnóstico"
        >
          <span className={`w-1.5 h-1.5 rounded-full ${porcentajeAvance === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} />
          <span>Avance {porcentajeAvance}%</span>
        </button>
      </div>

      {/* Contenido de Pestaña */}
      <div className="space-y-4">
        {tabActiva === 'balanza' && (
          <BalanzaDiagnosticoView
            diagnostico={diagnostico}
            onExportarExcel={onExportarExcel}
            cursos={cursos}
            docentes={docentes}
            asignaciones={asignaciones}
            asistentes={asistentes}
            salas={salas}
            onSelectTab={(t) => setTabActiva(t)}
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
            todosLosCursos={todosLosCursos}
            cursos={cursos}
            onGuardarAsignacion={onGuardarAsignacion}
            onGuardarAsignacionesBatch={onGuardarAsignacionesBatch}
            onEliminarAsignacion={onEliminarAsignacion}
            onNavegarAPestana={onNavegarAPestana || (() => setTabActiva('cursos'))}
            periodoActivo={periodoActivo}
            usuarioActualId={usuarioActual?.id}
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

      {/* Modal de Auditoría y Reparación de Integridad Escolar */}
      <ModalAuditoriaIntegridad
        isOpen={modalIntegridadAbierto}
        onClose={() => setModalIntegridadAbierto(false)}
        colegio={colegio}
        periodoActivo={periodoActivo}
        onReparacionCompletada={() => {
          if (onRefreshData) onRefreshData();
        }}
      />
    </div>
  );
};
