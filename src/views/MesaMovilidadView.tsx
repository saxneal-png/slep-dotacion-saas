import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AlertTriangle, Award, CheckCircle2, FileCheck2, RotateCcw, ScanSearch, ShieldAlert, Sparkles, X } from 'lucide-react';
import { saveAs } from 'file-saver';
import {
  Establecimiento, Docente, AsignacionHoraria, AsistenteEducacion, CursoSae,
  FeatureFlagsMovilidad, EgresoProyectado, CausalEgresoDocente, CertezaJuridicaEgreso,
  SolicitudMovilidad, EscenarioCalce, PropuestaCalce, TipoVacanteDocente
} from '../types';
import { AuthSession, EstadoPausaRevision, RolId } from '../types/authTypes';
import { usePermisos } from '../security/PermisosContext';
import { obtenerFeatureFlagsMovilidad, puedeUsuarioAccederMesaMovilidad } from '../services/configuracionGeneralService';
import { AuthService } from '../services/authService';
import {
  esRolNivelCentralMovilidad, esRolValidadorGdp, esRolConsolidadorMovilidad,
  esVacanteActivaEnMovilidad,
  previsualizarEscaneoVacantesNn, escanearYSanearVacantesNnTerritorio,
  listarEgresosProyectados, guardarEgresoProyectado, eliminarEgresoProyectado, reincorporarTitularContingencia,
  listarSolicitudesMovilidad, guardarSolicitudMovilidad, avanzarEstadoFlujoMovilidad, eliminarSolicitudMovilidad,
  detectarDocentesHorasRemanentes, detectarAsistentesIndefinidosNoContinuidad, calcularProyeccionTechoPisoHoras, ProyeccionTechoPisoHoras,
  listarEscenariosCalce, crearEscenarioCalce, duplicarEscenarioCalce, listarPropuestasEscenario,
  agregarPropuestaCalce, eliminarPropuestaCalce, resolverRebotePropuestaCalce,
  generarSugerenciasCalceAutomatico, consolidarEscenarioAprobado, revertirEscenarioConsolidado, registrarResolucionExentaEscenario, exportarNominaActosAdministrativosGdp,
  contarSyncPendientesMovilidad, reintentarSyncPendientesMovilidad
} from '../services/movilidadTerritorialService';
import {
  generarHtmlActaMesaMovilidad,
  generarHtmlNotificacionMovilidad,
  imprimirActaMesaMovilidad,
  descargarActaWordMesaMovilidad,
  exportarVacantesRemanentesConcursoExcel
} from '../services/movilidadActaService';
import { LaMesaPanel } from './movilidad/LaMesaPanel';
import {
  CandidatoSugeridoMesa,
  CasoVacanteLaMesa,
  construirCasosLaMesa
} from './movilidad/laMesaEngine';
import { generarResumenComparativoEscenariosGemini, ResumenComparativoEscenariosResult } from '../services/movilidadGeminiService';
import { evaluarEgresoProyectado, calcularPuntajePrioridadMovilidad } from '@slep/mineduc-engine';
import { esPropuestaNoContinuidad } from '../services/estadisticasHorasService';
import {
  AsistenteNoContinuidadItem, CAUSALES_EGRESO_OPCIONES, ETIQUETAS_FLUJO, FLUJO_MOVILIDAD_SECUENCIA,
  OrigenSeleccionado, PreviewNnItem, RemanenteItem, SubTabCol1, calcularAsignaturasPorCubrirPorVacante,
  construirCasosNoContinuidad, cumpleFiltroEstamento, cumpleFiltroTipoEscuela, inferirFuenteAsistente, inferirFuenteDocente, inferirFuenteVacante
} from './movilidad/movilidadHelpers';
import { StageGatesHeader } from './movilidad/StageGatesHeader';
import { ColaMovilidadPanel } from './movilidad/ColaMovilidadPanel';
import { SimuladorCalcePanel } from './movilidad/SimuladorCalcePanel';
import { BolsaVacantesPanel, HomologacionTpModal, VacanteAsignaturasModal } from './movilidad/BolsaVacantesPanel';
import { AnalisisNoContinuidadPanel } from './movilidad/AnalisisNoContinuidadPanel';
import { RegistroMovimientosPanel } from './movilidad/RegistroMovimientosPanel';

export interface MesaMovilidadViewProps {
  colegios: Establecimiento[];
  docentesTerritorio: Docente[];
  asignacionesTerritorio: AsignacionHoraria[];
  asistentesTerritorio?: AsistenteEducacion[];
  cursosTerritorio?: CursoSae[];
  periodoActivo: number;
  usuarioActual: AuthSession['usuario'];
  onDatosActualizados: () => Promise<void>;
}

function filtrarDocentesBusqueda(lista: Docente[], qRaw: string, colegiosByRbd: Map<string, Establecimiento>): Docente[] {
  const q = qRaw.toLowerCase().trim();
  return lista.filter(d => !q || `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) || d.run.toLowerCase().includes(q) || (colegiosByRbd.get(d.rbd)?.nombre || '').toLowerCase().includes(q)).slice(0, 60);
}

function crearBaseSolicitudDocente(doc: Docente, periodo: number, comunaOrigen: string | undefined, creadoPor: string, horasTitulares: number) {
  return {
    periodo, docenteId: doc.id, runDocente: doc.run, nombreDocente: `${doc.nombres} ${doc.apellidos}`.trim(),
    rbdOrigen: doc.rbd, comunaOrigen, calidadJuridica: doc.calidadJuridica, horasContratoActual: doc.horasContrato,
    horasTitularesActuales: horasTitulares, horasDisponiblesMover: doc.horasContrato, horasRemanentes: 0,
    asignaturaPrincipal: doc.asignaturaPrincipal, tituloMencion: doc.titulo, aplicaArticulo69: doc.aplicaArticulo69,
    fuenteActual: inferirFuenteDocente(doc), estadoFlujo: 'POSTULADO' as const, creadoPor
  };
}

const ModalShell: React.FC<{ title: React.ReactNode; subtitle?: string; onClose: () => void; maxWidth?: string; children: React.ReactNode }> = ({
  title, subtitle, onClose, maxWidth = 'max-w-lg', children
}) => (
  <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-2xl ${maxWidth} w-full p-5 space-y-4 my-6 max-h-[90vh] overflow-y-auto`}>
      <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
        <div>
          <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">{title}</h3>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 shrink-0"><X className="w-4 h-4" /></button>
      </div>
      {children}
    </div>
  </div>
);

const FormFooter: React.FC<{ onCancel: () => void; submitLabel: string; submitClass: string; disabled?: boolean }> = ({
  onCancel, submitLabel, submitClass, disabled
}) => (
  <div className="flex justify-end gap-2">
    <button type="button" onClick={onCancel} className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl">Cancelar</button>
    <button type="submit" disabled={disabled} className={`px-4 py-1.5 text-xs font-bold text-white rounded-xl disabled:opacity-50 ${submitClass}`}>{submitLabel}</button>
  </div>
);

/**
 * Vista ejecutiva territorial de la Mesa de Movilidad en 5 Compuertas Stage-Gates.
 * Auto-protegida estrictamente para roles de nivel central SLEP/UATP/GDP.
 */
export const MesaMovilidadView: React.FC<MesaMovilidadViewProps> = (props) => {
  const { rol, can } = usePermisos();
  const [flags, setFlags] = useState<FeatureFlagsMovilidad>(() => obtenerFeatureFlagsMovilidad());
  useEffect(() => {
    const syncFlags = () => setFlags(obtenerFeatureFlagsMovilidad());
    window.addEventListener('slep:config_updated', syncFlags);
    return () => window.removeEventListener('slep:config_updated', syncFlags);
  }, []);

  if (
    !rol || rol === 'director_establecimiento' || rol === 'jefe_utp_establecimiento' ||
    !esRolNivelCentralMovilidad(rol) || !can('mesa_movilidad.ver') || !flags.modulo_movilidad_activo ||
    !puedeUsuarioAccederMesaMovilidad({ id: props.usuarioActual.id, role: rol }, flags)
  ) {
    return null;
  }
  return <MesaMovilidadWorkspace {...props} rol={rol} flags={flags} />;
};

const MesaMovilidadWorkspace: React.FC<MesaMovilidadViewProps & { rol: RolId; flags: FeatureFlagsMovilidad }> = ({
  colegios, docentesTerritorio, asignacionesTerritorio, asistentesTerritorio = [],
  cursosTerritorio = [], periodoActivo, usuarioActual, onDatosActualizados, rol, flags
}) => {
  const { can, todosLosRoles } = usePermisos();
  const puedeEditarMovilidad = can('mesa_movilidad.editar') || can('mesa_movilidad.crear');
  const puedeEliminarMovilidad = can('mesa_movilidad.eliminar');
  const rolParaGdp: RolId = esRolValidadorGdp(rol) ? rol : todosLosRoles.find(r => esRolValidadorGdp(r)) || rol;
  const puedeValidarGdp = esRolValidadorGdp(rolParaGdp) || can('gdp_validador.editar');
  const puedeConsolidar = esRolConsolidadorMovilidad(rol);
  const actorNombre = usuarioActual.email || usuarioActual.nombreCompleto;

  const colegiosByRbd = useMemo(() => new Map(colegios.map(c => [c.rbd, c])), [colegios]);
  const docentesById = useMemo(() => new Map(docentesTerritorio.map(d => [d.id, d])), [docentesTerritorio]);
  const docentesNoVacantes = useMemo(() => docentesTerritorio.filter(d => !d.esVacanteNn), [docentesTerritorio]);
  const vacantesNn = useMemo(() => docentesTerritorio.filter(esVacanteActivaEnMovilidad), [docentesTerritorio]);
  const comunasDisponibles = useMemo(() => Array.from(new Set(colegios.map(c => c.comuna).filter(Boolean))).sort((a, b) => a.localeCompare(b)), [colegios]);

  const [egresos, setEgresos] = useState<EgresoProyectado[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudMovilidad[]>([]);
  const [remanentes, setRemanentes] = useState<RemanenteItem[]>([]);
  const [asistentesIndefRaw, setAsistentesIndefRaw] = useState<AsistenteNoContinuidadItem[]>([]);
  const [proyeccionTechoPiso, setProyeccionTechoPiso] = useState<ProyeccionTechoPisoHoras | null>(null);
  const [previewNnPendientes, setPreviewNnPendientes] = useState(0);
  const [pausaRevision, setPausaRevision] = useState<EstadoPausaRevision | null>(() => AuthService.getEstadoPausaRevision());
  const [escenarios, setEscenarios] = useState<EscenarioCalce[]>([]);
  const [escenarioActivoId, setEscenarioActivoId] = useState('');
  const [propuestas, setPropuestas] = useState<PropuestaCalce[]>([]);
  const [cargando, setCargando] = useState(true);
  const [operacionEnCurso, setOperacionEnCurso] = useState<string | null>(null);
  const [syncPendientes, setSyncPendientes] = useState(0);
  const [reintentandoSync, setReintentandoSync] = useState(false);
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);
  const mostrarFeedback = useCallback((mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setFeedback({ tipo, mensaje }); setTimeout(() => setFeedback(null), 5500);
  }, []);
  const refrescarSync = useCallback(() => {
    void contarSyncPendientesMovilidad().then(setSyncPendientes).catch(() => {});
  }, []);

  const [vistaInternaMesa, setVistaInternaMesa] = useState<'la_mesa' | 'tablero' | 'analisis_no_continuidad' | 'registro_movimientos'>('tablero');
  const [tabCol1, setTabCol1] = useState<SubTabCol1>(() => (
    flags.flag_no_continuidad_titulares ? 'no_continuidad' : flags.flag_traslados_voluntarios ? 'traslados' : flags.flag_egresos_contingencia ? 'egresos_gdp' : 'asistentes_indefinidos'
  ));
  const [origenSeleccionado, setOrigenSeleccionado] = useState<OrigenSeleccionado | null>(null);
  const [vacanteDestinoId, setVacanteDestinoId] = useState('');
  const [tipoCobertura, setTipoCobertura] = useState<'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL'>('DEFINITIVA');
  const [esTrasladoCompleto, setEsTrasladoCompleto] = useState(true);
  const [filtroEstamentoCol1, setFiltroEstamentoCol1] = useState('TODOS');
  const [filtroTipoEscuelaRemanente, setFiltroTipoEscuelaRemanente] = useState('TODOS');
  const [ncForm, setNcForm] = useState({ busqueda: '', sinMarcaGdp: false, docId: '', comunaDest: '', fundamento: '' });
  const [vacFiltros, setVacFiltros] = useState<{ tipo: 'TODAS' | TipoVacanteDocente; comuna: string; fuente: 'TODAS' | 'SUBVENCION_GENERAL' | 'SEP' | 'PIE'; q: string }>({
    tipo: 'TODAS', comuna: 'TODAS', fuente: 'TODAS', q: ''
  });

  const [nuevoEscModal, setNuevoEscModal] = useState({ open: false, nombre: '', desc: '' });
  const [clonarEscNombre, setClonarEscNombre] = useState<string | null>(null);
  const [previewNnModal, setPreviewNnModal] = useState<{ open: boolean; loading: boolean; items: PreviewNnItem[] }>({ open: false, loading: false, items: [] });
  const [modalConsolidar, setModalConsolidar] = useState(false);
  const [vacanteAsignaturasModal, setVacanteAsignaturasModal] = useState<Docente | null>(null);
  const [vacanteHomologacionModal, setVacanteHomologacionModal] = useState<Docente | null>(null);
  const [trasladoModal, setTrasladoModal] = useState({ open: false, q: '', docId: '', rbdDest: '', comunaDest: '', leyKarin: 0, salud: 0, dependientes: 0, rural: 0, antiguedad: 0, fundamento: '' });
  const [egresoModal, setEgresoModal] = useState({ open: false, editId: undefined as string | undefined, q: '', docId: '', causal: 'renuncia_voluntaria' as CausalEgresoDocente, certeza: 'en_tramite' as CertezaJuridicaEgreso, excepcion3Anios: false, cpeipFirme: false, fechaCese: '', decreto: '', obs: '', generarVacante: true });
  const [reversoModal, setReversoModal] = useState<{ egreso: EgresoProyectado; motivo: string } | null>(null);
  const [modalRevertirEscenario, setModalRevertirEscenario] = useState<{ open: boolean; motivo: string }>({ open: false, motivo: '' });
  const [resolucionModal, setResolucionModal] = useState<{ numero: string; fecha: string; vigencia: string } | null>(null);
  const [comparativaState, setComparativaState] = useState<{ open: boolean; a: string; b: string; loading: boolean; result: ResumenComparativoEscenariosResult | null }>({ open: false, a: '', b: '', loading: false, result: null });

  useEffect(() => {
    const disp: SubTabCol1[] = [];
    if (flags.flag_no_continuidad_titulares) disp.push('no_continuidad');
    if (flags.flag_traslados_voluntarios) disp.push('traslados');
    disp.push('remanentes', 'asistentes_indefinidos');
    if (flags.flag_egresos_contingencia) disp.push('egresos_gdp');
    if (!disp.includes(tabCol1)) setTabCol1(disp[0]);
  }, [flags, tabCol1]);

  useEffect(() => {
    const syncPausa = () => setPausaRevision(AuthService.getEstadoPausaRevision());
    window.addEventListener('slep:sesiones_pausadas', syncPausa);
    window.addEventListener('slep:sesiones_reactivadas', syncPausa);
    return () => { window.removeEventListener('slep:sesiones_pausadas', syncPausa); window.removeEventListener('slep:sesiones_reactivadas', syncPausa); };
  }, []);

  const vacanteDestinoSeleccionada = useMemo(() => vacantesNn.find(v => v.id === vacanteDestinoId) || null, [vacantesNn, vacanteDestinoId]);
  useEffect(() => {
    if (vacanteDestinoSeleccionada?.vacanteCondicional) setTipoCobertura('TRANSITORIA_CONDICIONAL');
    else if (vacanteDestinoSeleccionada) setTipoCobertura('DEFINITIVA');
  }, [vacanteDestinoSeleccionada]);

  const recargarPropuestas = useCallback(async (escId: string) => {
    if (!escId) { setPropuestas([]); return; }
    try { setPropuestas(await listarPropuestasEscenario(escId, rol)); }
    catch (err: any) { mostrarFeedback(`Error cargando propuestas: ${err.message || err}`, 'error'); }
  }, [rol, mostrarFeedback]);

  const recargarModuloMovilidad = useCallback(async () => {
    setCargando(true);
    try {
      const [egs, sols, rems, escs, asts, techoPiso, prevNn, pausaNube] = await Promise.all([
        listarEgresosProyectados(periodoActivo, rol), listarSolicitudesMovilidad(periodoActivo, rol),
        detectarDocentesHorasRemanentes(periodoActivo, rol), listarEscenariosCalce(periodoActivo, rol),
        detectarAsistentesIndefinidosNoContinuidad(periodoActivo, rol), calcularProyeccionTechoPisoHoras(periodoActivo, rol),
        previsualizarEscaneoVacantesNn(periodoActivo),
        AuthService.sincronizarEstadoPausaDesdeNube().catch(() => AuthService.getEstadoPausaRevision())
      ]);
      setEgresos(egs); setSolicitudes(sols); setRemanentes(rems); setEscenarios(escs);
      setAsistentesIndefRaw(asts); setProyeccionTechoPiso(techoPiso);
      setPreviewNnPendientes(prevNn.filter(i => !i.docente.esVacanteNn || !i.docente.tipoVacante).length);
      setPausaRevision(pausaNube || AuthService.getEstadoPausaRevision());
      setEscenarioActivoId(prev => (prev && escs.some(e => e.id === prev) ? prev : escs[0]?.id || ''));
    } catch (err: any) { mostrarFeedback(`Error cargando datos de movilidad: ${err.message || err}`, 'error'); }
    finally { setCargando(false); }
  }, [periodoActivo, rol, mostrarFeedback]);

  useEffect(() => { recargarModuloMovilidad(); }, [recargarModuloMovilidad]);
  useEffect(() => { recargarPropuestas(escenarioActivoId); }, [escenarioActivoId, recargarPropuestas]);
  useEffect(() => {
    let activo = true;
    reintentarSyncPendientesMovilidad(rol)
      .catch(() => {})
      .finally(() => {
        if (activo) refrescarSync();
      });
    const onPendiente = () => refrescarSync();
    window.addEventListener('slep:movilidad_sync_pendiente', onPendiente);
    return () => {
      activo = false;
      window.removeEventListener('slep:movilidad_sync_pendiente', onPendiente);
    };
  }, [rol, refrescarSync]);

  const handleReintentarSync = async () => {
    setReintentandoSync(true);
    try {
      const res = await reintentarSyncPendientesMovilidad(rol);
      if (res.ok > 0 && res.fallidos === 0) {
        mostrarFeedback(`Se sincronizaron ${res.ok} cambio(s) pendiente(s) con Supabase.`);
      } else if (res.fallidos > 0) {
        mostrarFeedback(
          `Sincronizados ${res.ok}; ${res.fallidos} cambio(s) siguen pendientes en cola.`,
          'error'
        );
      }
    } catch (err: any) {
      mostrarFeedback(`Error reintentando sincronización: ${err?.message || err}`, 'error');
    } finally {
      refrescarSync();
      setReintentandoSync(false);
    }
  };

  const refrescarEscenariosYPropuestas = useCallback(async (escId?: string) => {
    setEscenarios(await listarEscenariosCalce(periodoActivo, rol));
    if (escId) await recargarPropuestas(escId);
  }, [periodoActivo, rol, recargarPropuestas]);

  const ejecutarOperacion = useCallback(async (label: string, fn: () => Promise<void>, ctxErr: string) => {
    setOperacionEnCurso(label);
    try { await fn(); }
    catch (err: any) {
      const msg = String(err?.message || err);
      if (msg.includes('CONFLICTO_VERSION')) {
        await refrescarEscenariosYPropuestas(escenarioActivoId).catch(() => {});
        mostrarFeedback(`Conflicto de versión detectado: otro usuario modificó el escenario y se recargó la vista. (${msg})`, 'error');
      } else { mostrarFeedback(`${ctxErr}: ${msg}`, 'error'); }
    } finally { setOperacionEnCurso(null); }
  }, [escenarioActivoId, refrescarEscenariosYPropuestas, mostrarFeedback]);

  const escenarioActivo = useMemo(() => escenarios.find(e => e.id === escenarioActivoId) || null, [escenarios, escenarioActivoId]);

  const colas = useMemo(() => {
    const idsNc = new Set(solicitudes.filter(s => s.carril === 'NO_CONTINUIDAD_TITULAR').map(s => s.docenteId));
    const idsAst = new Set(solicitudes.filter(s => s.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO').map(s => s.docenteId));
    const docPend = docentesNoVacantes.filter(d => !idsNc.has(d.id) && (esPropuestaNoContinuidad(d.propuestaGdp) || esPropuestaNoContinuidad(d.situacionFinalGdp)));
    const porPrioridad = (a: SolicitudMovilidad, b: SolicitudMovilidad) => b.puntajePrioridadTotal - a.puntajePrioridadTotal;
    return {
      titularesNcDisp: filtrarDocentesBusqueda(docentesNoVacantes.filter(d => !idsNc.has(d.id) && (esPropuestaNoContinuidad(d.propuestaGdp) || esPropuestaNoContinuidad(d.situacionFinalGdp) || (ncForm.sinMarcaGdp && d.calidadJuridica === 'TITULAR'))), ncForm.busqueda, colegiosByRbd),
      docPendCount: docPend.length,
      docPendFiltrados: docPend.filter(d => cumpleFiltroEstamento(d.estamento, filtroEstamentoCol1)),
      solNcFiltradas: solicitudes.filter(s => s.carril === 'NO_CONTINUIDAD_TITULAR' && cumpleFiltroEstamento(docentesById.get(s.docenteId)?.estamento, filtroEstamentoCol1)).sort(porPrioridad),
      solTrasladosFiltradas: solicitudes.filter(s => s.carril === 'TRASLADO_VOLUNTARIO' && cumpleFiltroEstamento(docentesById.get(s.docenteId)?.estamento, filtroEstamentoCol1)).sort(porPrioridad),
      solAsistentesFiltradas: solicitudes.filter(s => s.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO').sort(porPrioridad),
      asistentesPendientes: asistentesIndefRaw.filter(i => !idsAst.has(i.asistente.id)),
      remanentesFiltrados: remanentes.filter(i => cumpleFiltroEstamento(i.docente.estamento, filtroEstamentoCol1) && (filtroTipoEscuelaRemanente === 'TODOS' || cumpleFiltroTipoEscuela(i.establecimiento || colegiosByRbd.get(i.docente.rbd), filtroTipoEscuelaRemanente))),
      egresosFiltrados: egresos.filter(eg => cumpleFiltroEstamento(docentesById.get(eg.docenteId)?.estamento, filtroEstamentoCol1))
    };
  }, [solicitudes, docentesNoVacantes, ncForm.sinMarcaGdp, ncForm.busqueda, colegiosByRbd, filtroEstamentoCol1, docentesById, asistentesIndefRaw, remanentes, filtroTipoEscuelaRemanente, egresos]);

  const vacantesFiltradas = useMemo(() => {
    const q = vacFiltros.q.toLowerCase().trim();
    return vacantesNn.filter(v => {
      if (vacFiltros.tipo !== 'TODAS' && (v.tipoVacante || 'NN_DETECTADO') !== vacFiltros.tipo) return false;
      const est = colegiosByRbd.get(v.rbd);
      if (vacFiltros.comuna !== 'TODAS' && est?.comuna !== vacFiltros.comuna) return false;
      if (vacFiltros.fuente !== 'TODAS' && inferirFuenteVacante(v) !== vacFiltros.fuente) return false;
      return !q || (v.asignaturaPrincipal || '').toLowerCase().includes(q) || `${v.nombres} ${v.apellidos}`.toLowerCase().includes(q) ||
        (v.run || '').toLowerCase().includes(q) || v.rbd.toLowerCase().includes(q) || (est?.nombre || '').toLowerCase().includes(q) || (est?.comuna || '').toLowerCase().includes(q);
    });
  }, [vacantesNn, vacFiltros, colegiosByRbd]);

  const casosNoContinuidadConsolidados = useMemo(() => construirCasosNoContinuidad({ docentesNoVacantes, asistentesTerritorio, solicitudes, colegiosByRbd }), [docentesNoVacantes, asistentesTerritorio, solicitudes, colegiosByRbd]);
  const asignaturasPorCubrirPorVacante = useMemo(() => calcularAsignaturasPorCubrirPorVacante({ vacantesNn, asignacionesTerritorio, cursosTerritorio }), [vacantesNn, asignacionesTerritorio, cursosTerritorio]);

  const metricasEscenario = useMemo(() => {
    const solMap = new Map(solicitudes.map(s => [s.id, s]));
    const bloqueadas = propuestas.filter(p => p.bloqueaConsolidacion).length;
    const sinFirma = new Set(propuestas.filter(p => {
      const sol = p.solicitudMovilidadId ? solMap.get(p.solicitudMovilidadId) : undefined;
      return sol?.carril === 'TRASLADO_VOLUNTARIO' && !['ACEPTADO_CON_FIRMA', 'CONSOLIDADO', 'RESOLUCION_EMITIDA'].includes(sol.estadoFlujo);
    }).map(p => p.solicitudMovilidadId!));
    return {
      totalPropuestas: propuestas.length, propuestasValidas: propuestas.length - bloqueadas, propuestasBloqueadas: bloqueadas,
      rebotesGenerados: propuestas.filter(p => p.generaRebote).length,
      rebotesPendientesCount: propuestas.filter(p => p.generaRebote && p.estadoResolucionRebote !== 'CUBIERTA_EN_CADENA' && p.estadoResolucionRebote !== 'DERIVADA_A_CONCURSO_GDP').length,
      trasladosSinFirmaCount: sinFirma.size
    };
  }, [propuestas, solicitudes]);

  const kpis = useMemo(() => {
    const egrAct = egresos.filter(e => e.estadoReversion !== 'REVERTIDO_REINCORPORADO');
    return {
      vacantesActivas: vacantesNn.length, vacantesCondicionales: vacantesNn.filter(v => v.vacanteCondicional).length,
      egresosConfirmados: egrAct.filter(e => e.certeza === 'confirmado').length, egresosEnTramite: egrAct.filter(e => e.certeza === 'en_tramite').length,
      egresosTotales: egrAct.length, egresosArt19SinReposicionFirme: egrAct.filter(e => e.causal === 'art_19s_no_avance' && !e.excepcionJubilacion3Anios && !e.cpeipNotificacionFirme).length,
      solicitudesActivas: solicitudes.filter(s => !['CONSOLIDADO', 'RESOLUCION_EMITIDA', 'RECHAZADO'].includes(s.estadoFlujo)).length,
      totalSolicitudes: solicitudes.length, remanentesCount: remanentes.length,
      ncTitularesColaCount: solicitudes.filter(s => s.carril === 'NO_CONTINUIDAD_TITULAR' && s.estadoFlujo !== 'RECHAZADO').length,
      ncTitularesPendientesCount: colas.docPendCount,
      asistentesIndefinidosCount: colas.solAsistentesFiltradas.length + colas.asistentesPendientes.length,
      trasladosCount: solicitudes.filter(s => s.carril === 'TRASLADO_VOLUNTARIO' && s.estadoFlujo !== 'RECHAZADO').length
    };
  }, [vacantesNn, egresos, solicitudes, remanentes.length, colas.docPendCount, colas.solAsistentesFiltradas.length, colas.asistentesPendientes.length]);

  const escenarioConsolidado = escenarioActivo?.estado === 'CONSOLIDADO' || escenarioActivo?.estado === 'RESOLUCION_EMITIDA';
  const consolidacionDeshabilitada = !escenarioActivo || escenarioConsolidado || metricasEscenario.propuestasBloqueadas > 0 || metricasEscenario.rebotesPendientesCount > 0 || metricasEscenario.trasladosSinFirmaCount > 0 || propuestas.length === 0 || Boolean(operacionEnCurso);
  const tooltipConsolidacion = !escenarioActivo ? 'Selecciona o crea un escenario primero'
    : escenarioConsolidado ? `Este escenario ya se encuentra ${escenarioActivo.estado}`
    : propuestas.length === 0 ? 'El escenario no tiene propuestas de calce para consolidar'
    : metricasEscenario.propuestasBloqueadas > 0 ? `Bloqueado: existen ${metricasEscenario.propuestasBloqueadas} propuesta(s) con impedimento normativo`
    : metricasEscenario.rebotesPendientesCount > 0 ? `Bloqueado: existen ${metricasEscenario.rebotesPendientesCount} vacante(s) NN-Rebote en estado PENDIENTE`
    : metricasEscenario.trasladosSinFirmaCount > 0 ? `Bloqueado: existen ${metricasEscenario.trasladosSinFirmaCount} traslado(s) voluntario(s) sin ACEPTADO_CON_FIRMA`
    : 'Ejecutar transacción atómica de consolidación territorial';

  const modalDerivados = useMemo(() => {
    const docEgr = docentesNoVacantes.find(d => d.id === egresoModal.docId) || null;
    return {
      puntajeTraslado: calcularPuntajePrioridadMovilidad({
        carril: 'TRASLADO_VOLUNTARIO', puntajeLeyKarin: trasladoModal.leyKarin, puntajeSalud: trasladoModal.salud,
        puntajeCuidadoDependientes: trasladoModal.dependientes, puntajeDistanciaRural: trasladoModal.rural, puntajeAntiguedad: trasladoModal.antiguedad
      }),
      docsTraslado: filtrarDocentesBusqueda(docentesNoVacantes, trasladoModal.q, colegiosByRbd),
      docsEgreso: filtrarDocentesBusqueda(docentesNoVacantes, egresoModal.q, colegiosByRbd),
      docEgr,
      evalEgreso: evaluarEgresoProyectado({
        causal: egresoModal.causal, certeza: egresoModal.certeza,
        excepcionJubilacion3Anios: egresoModal.causal === 'art_19s_no_avance' ? egresoModal.excepcion3Anios : false,
        cpeipNotificacionFirme: egresoModal.causal === 'art_19s_no_avance' ? egresoModal.cpeipFirme : undefined,
        fechaCese: egresoModal.fechaCese || undefined, numeroDecreto: egresoModal.decreto || undefined, horasLiberadas: docEgr?.horasContrato || 0
      })
    };
  }, [docentesNoVacantes, trasladoModal, egresoModal, colegiosByRbd]);

  // Handlers de Compuertas, Cola, Simulador y Actos GDP
  const handleActivarPausaRevision = () => ejecutarOperacion('Activando pausa de revisión UATP...', async () => {
    const res = await AuthService.pausarAccesoMasivo(AuthService.getRolesPausables(), `Cierre Compuerta 1 · Mesa de Movilidad Territorial ${periodoActivo}`, actorNombre);
    setPausaRevision(AuthService.getEstadoPausaRevision());
    mostrarFeedback(`Pausa de revisión activada (${res.totalAfectados} usuario(s) pausados; roles UATP/GDP preservados).`);
  }, 'Error activando pausa de revisión');

  const handleCrearEscenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEscModal.nombre.trim()) return;
    ejecutarOperacion('Creando escenario...', async () => {
      const creado = await crearEscenarioCalce({ periodo: periodoActivo, nombre: nuevoEscModal.nombre.trim(), descripcion: nuevoEscModal.desc.trim() || undefined, creadoPor: actorNombre }, rol);
      setEscenarios(prev => [creado, ...prev]); setEscenarioActivoId(creado.id); setNuevoEscModal({ open: false, nombre: '', desc: '' });
      mostrarFeedback(`Escenario "${creado.nombre}" creado.`);
    }, 'Error al crear escenario');
  };

  const handleClonarEscenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escenarioActivo || !clonarEscNombre?.trim()) return;
    ejecutarOperacion('Clonando escenario...', async () => {
      const clonado = await duplicarEscenarioCalce(escenarioActivo.id, clonarEscNombre.trim(), rol, actorNombre);
      setEscenarios(prev => [clonado, ...prev]); setEscenarioActivoId(clonado.id); setClonarEscNombre(null);
      mostrarFeedback(`Escenario clonado como "${clonado.nombre}".`);
    }, 'Error al clonar escenario');
  };

  const handleAbrirEscaneoNn = async () => {
    setPreviewNnModal({ open: true, loading: true, items: [] });
    try {
      const pend = (await previsualizarEscaneoVacantesNn(periodoActivo)).filter(i => !i.docente.esVacanteNn || !i.docente.tipoVacante);
      setPreviewNnModal({ open: true, loading: false, items: pend }); setPreviewNnPendientes(pend.length);
    } catch (err: any) {
      mostrarFeedback(`Error previsualizando escaneo NN: ${err.message || err}`, 'error'); setPreviewNnModal({ open: false, loading: false, items: [] });
    }
  };

  const handleConfirmarSaneamientoNn = () => ejecutarOperacion('Ejecutando saneamiento NN territorial...', async () => {
    const res = await escanearYSanearVacantesNnTerritorio({ periodo: periodoActivo, rolActor: rol, usuarioActor: actorNombre });
    await onDatosActualizados(); await recargarModuloMovilidad(); setPreviewNnModal({ open: false, loading: false, items: [] });
    mostrarFeedback(`Saneamiento completado: ${res.escaneados} escaneados, ${res.marcadosNn} marcados NN y ${res.asignacionesPreservadas} asignaciones preservadas.`);
  }, 'Error ejecutando saneamiento NN');

  const handleConfirmarConsolidacion = () => escenarioActivo && ejecutarOperacion('Consolidando escenario atómicamente (RPC)...', async () => {
    const res = await consolidarEscenarioAprobado({ escenarioId: escenarioActivo.id, rolActor: rol, usuarioActor: actorNombre, expectedVersion: escenarioActivo.version ?? 1 });
    setModalConsolidar(false); await onDatosActualizados(); await recargarModuloMovilidad(); await recargarPropuestas(escenarioActivo.id);
    mostrarFeedback(`Escenario consolidado (${res.modoEjecucion}): ${res.propuestasConsolidadas} propuestas, ${res.vacantesReemplazadas} vacantes reemplazadas, ${res.rebotesCreados} rebotes.`);
  }, 'Error consolidando escenario');

  const registrarNoContinuidadDocente = (doc: Docente, fundamento: string, comunaDest?: string, limpiar = false) =>
    ejecutarOperacion('Registrando No Continuidad Art. 42...', async () => {
      const horasTit = (doc.horasSubvencionGeneralTitular || 0) + (doc.horasSepTitular || 0) + (doc.horasPieTitular || 0) || doc.horasContrato;
      await guardarSolicitudMovilidad({
        ...crearBaseSolicitudDocente(doc, periodoActivo, colegiosByRbd.get(doc.rbd)?.comuna, actorNombre, horasTit),
        carril: 'NO_CONTINUIDAD_TITULAR', comunaDestinoPreferente: comunaDest || undefined,
        puntajeSalud: 0, puntajeLeyKarin: 0, puntajeCuidadoDependientes: 0, puntajeDistanciaRural: 0, puntajeAntiguedad: 50, fundamento
      }, rol);
      if (limpiar) setNcForm(f => ({ ...f, docId: '', comunaDest: '', fundamento: '' }));
      await recargarModuloMovilidad(); mostrarFeedback(`Formalizado ${doc.nombres} ${doc.apellidos} en cola Art. 42.`);
    }, 'Error guardando no continuidad');

  const handleCrearNoContinuidad = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = docentesNoVacantes.find(d => d.id === ncForm.docId);
    if (doc) registrarNoContinuidadDocente(doc, ncForm.fundamento.trim() || 'Resguardo Art. 42 por no continuidad de horas titulares en origen', ncForm.comunaDest, true);
  };

  const handleAgregarAsistenteACola = (item: AsistenteNoContinuidadItem) => ejecutarOperacion('Agregando Asistente Ley 21.109 a cola...', async () => {
    const a = item.asistente;
    await guardarSolicitudMovilidad({
      periodo: periodoActivo, carril: 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO', docenteId: a.id, runDocente: a.run,
      nombreDocente: `${a.nombres} ${a.apellidos}`.trim(), rbdOrigen: a.rbd, comunaOrigen: (item.establecimiento || colegiosByRbd.get(a.rbd))?.comuna,
      calidadJuridica: 'TITULAR', estamentoPersonal: 'ASISTENTE', categoriaAsistente: a.estamento, horasContratoActual: a.horasContrato,
      horasTitularesActuales: item.horasIndefinidas, horasContrataActuales: item.horasPlazoFijo, horasDisponiblesMover: a.horasContrato,
      horasRemanentes: 0, asignaturaPrincipal: a.cargoFuncion || a.estamento, fuenteActual: inferirFuenteAsistente(a), estadoFlujo: 'POSTULADO',
      puntajeSalud: 0, puntajeLeyKarin: 0, puntajeCuidadoDependientes: 0, puntajeDistanciaRural: 0, puntajeAntiguedad: 50,
      fundamento: item.razonGdp || 'No Continuidad Asistente Indefinido (Ley 21.109)', creadoPor: actorNombre
    }, rol);
    await recargarModuloMovilidad(); mostrarFeedback(`${a.nombres} ${a.apellidos} agregado a Cola AA.EE. Indefinidos (Ley 21.109).`);
  }, 'Error agregando asistente a cola');

  const handleGuardarTraslado = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = docentesNoVacantes.find(d => d.id === trasladoModal.docId);
    if (!doc) return;
    ejecutarOperacion('Guardando solicitud de traslado...', async () => {
      const horasTit = (doc.horasSubvencionGeneralTitular || 0) + (doc.horasSepTitular || 0) + (doc.horasPieTitular || 0);
      await guardarSolicitudMovilidad({
        ...crearBaseSolicitudDocente(doc, periodoActivo, colegiosByRbd.get(doc.rbd)?.comuna, actorNombre, horasTit),
        carril: 'TRASLADO_VOLUNTARIO', rbdDestinoPreferente: trasladoModal.rbdDest || undefined, comunaDestinoPreferente: trasladoModal.comunaDest || undefined,
        puntajeSalud: trasladoModal.salud, puntajeLeyKarin: trasladoModal.leyKarin, puntajeCuidadoDependientes: trasladoModal.dependientes,
        puntajeDistanciaRural: trasladoModal.rural, puntajeAntiguedad: trasladoModal.antiguedad, fundamento: trasladoModal.fundamento.trim() || undefined
      }, rol);
      setTrasladoModal(m => ({ ...m, open: false, docId: '', fundamento: '' })); await recargarModuloMovilidad();
      mostrarFeedback('Solicitud de traslado voluntario ingresada y ponderada.');
    }, 'Error guardando traslado');
  };

  const handleAvanzarFlujo = (sol: SolicitudMovilidad) => {
    const idx = FLUJO_MOVILIDAD_SECUENCIA.indexOf(sol.estadoFlujo);
    if (idx < 0 || idx >= FLUJO_MOVILIDAD_SECUENCIA.length - 1) return;
    const sig = FLUJO_MOVILIDAD_SECUENCIA[idx + 1];
    if (sig === 'CONSOLIDADO' && !puedeConsolidar) { mostrarFeedback('Solo Subdirector UATP o Super Usuario puede pasar a CONSOLIDADO.', 'error'); return; }
    ejecutarOperacion('Actualizando estado de flujo...', async () => {
      await avanzarEstadoFlujoMovilidad(sol.id, sig, rol); await recargarModuloMovilidad();
      mostrarFeedback(`Estado de ${sol.nombreDocente} avanzado a ${ETIQUETAS_FLUJO[sig].label}.`);
    }, 'Error actualizando estado');
  };

  const handleGuardarEgreso = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = modalDerivados.docEgr;
    if (!doc) return;
    const asigAula = asignacionesTerritorio.filter(a => a.docenteId === doc.id && (a.periodo === undefined || a.periodo === periodoActivo)).reduce((acc, a) => acc + (a.horasPedagogicasAula || 0), 0);
    ejecutarOperacion('Validando y guardando egreso proyectado...', async () => {
      const res = await guardarEgresoProyectado({
        id: egresoModal.editId, rbd: doc.rbd, periodo: periodoActivo, docenteId: doc.id, runDocente: doc.run,
        nombreDocente: `${doc.nombres} ${doc.apellidos}`.trim(), asignaturaPrincipal: doc.asignaturaPrincipal,
        horasLiberadas: doc.horasContrato, horasAulaLiberadas: asigAula, fuenteFinanciamiento: inferirFuenteDocente(doc),
        calidadJuridica: doc.calidadJuridica, causal: egresoModal.causal, certeza: egresoModal.certeza,
        excepcionJubilacion3Anios: egresoModal.causal === 'art_19s_no_avance' ? egresoModal.excepcion3Anios : false,
        cpeipNotificacionFirme: egresoModal.causal === 'art_19s_no_avance' ? egresoModal.cpeipFirme : false,
        fechaCese: egresoModal.fechaCese || undefined, numeroDecreto: egresoModal.decreto || undefined,
        impactoPresupuestario: modalDerivados.evalEgreso.impactoPresupuestarioSugerido, validadoPor: actorNombre, observaciones: egresoModal.obs.trim() || undefined
      }, rolParaGdp, modalDerivados.evalEgreso.liberaVacante ? egresoModal.generarVacante : false);
      setEgresoModal(m => ({ ...m, open: false })); await recargarModuloMovilidad(); if (res.vacanteGenerada) await onDatosActualizados();
      mostrarFeedback(res.vacanteGenerada ? `Egreso guardado y vacante ${res.vacanteGenerada.vacanteCondicional ? 'condicional ' : ''}generada en bolsa NN.` : 'Egreso proyectado guardado.');
    }, 'Error guardando egreso');
  };

  const handleConfirmarReversoEgreso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversoModal || !reversoModal.motivo.trim()) return;
    ejecutarOperacion('Ejecutando reverso controlado y restitución de titular...', async () => {
      const res = await reincorporarTitularContingencia({ egresoId: reversoModal.egreso.id, motivo: reversoModal.motivo.trim(), rolActor: rolParaGdp, usuarioActor: actorNombre });
      setReversoModal(null); await onDatosActualizados(); await recargarModuloMovilidad();
      mostrarFeedback(`Titular restituido: ${res.asignacionesReapuntadas} asignación(es) restaurada(s) y vacante transitoria archivada.`);
    }, 'Error reincorporando titular');
  };

  const handleSimularYAgregar = () => escenarioActivo && origenSeleccionado && vacanteDestinoSeleccionada &&
    ejecutarOperacion('Evaluando calce normativo en minutos enteros...', async () => {
      await agregarPropuestaCalce({
        escenarioId: escenarioActivo.id, periodo: periodoActivo, docenteOrigenId: origenSeleccionado.docenteId,
        vacanteDestinoId: vacanteDestinoSeleccionada.id, solicitudMovilidadId: origenSeleccionado.solicitudMovilidadId,
        egresoOrigenId: vacanteDestinoSeleccionada.origenEgresoId || undefined, tipoCobertura, esTrasladoCompleto,
        expectedVersion: escenarioActivo.version ?? 1, estamentoPersonal: origenSeleccionado.estamentoPersonal || 'DOCENTE'
      }, rol);
      await refrescarEscenariosYPropuestas(escenarioActivo.id); mostrarFeedback('Propuesta evaluada y agregada al escenario What-If.');
    }, 'Error simulando calce');

  const handleResolverRebote = (propuestaId: string, estadoResolucion: 'CUBIERTA_EN_CADENA' | 'DERIVADA_A_CONCURSO_GDP', reboteCubiertoPorPropuestaId?: string) =>
    escenarioActivo && ejecutarOperacion('Registrando cierre de vacante NN-Rebote...', async () => {
      await resolverRebotePropuestaCalce({ propuestaId, estadoResolucion, reboteCubiertoPorPropuestaId, rolActor: rol, expectedVersion: escenarioActivo.version });
      await refrescarEscenariosYPropuestas(escenarioActivo.id); mostrarFeedback(`NN-Rebote marcado como ${estadoResolucion}.`);
    }, 'Error resolviendo rebote');

  const handleGuardarResolucionExenta = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escenarioActivo || !resolucionModal) return;
    ejecutarOperacion('Emitiendo Resolución Exenta GDP...', async () => {
      const res = await registrarResolucionExentaEscenario({
        escenarioId: escenarioActivo.id, numeroResolucion: resolucionModal.numero, fechaResolucion: resolucionModal.fecha,
        fechaVigencia: resolucionModal.vigencia || undefined, rolActor: rolParaGdp, usuarioActor: actorNombre, expectedVersion: escenarioActivo.version
      });
      setResolucionModal(null); await recargarModuloMovilidad(); await recargarPropuestas(escenarioActivo.id);
      mostrarFeedback(`Resolución Exenta ${res.escenario.numeroResolucion} emitida (${res.propuestasActualizadas} propuestas, ${res.solicitudesActualizadas} solicitudes).`);
    }, 'Error registrando Resolución Exenta');
  };

  const handleExportarNominaActosGdp = () => escenarioActivo && ejecutarOperacion('Generando Nómina Oficial Actos Administrativos GDP (.xlsx)...', async () => {
    const bytes = await exportarNominaActosAdministrativosGdp({ escenarioId: escenarioActivo.id, periodo: periodoActivo, rolActor: rol });
    saveAs(new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Nomina_Actos_GDP_${escenarioActivo.nombre.replace(/[^a-zA-Z0-9_-]+/g, '_')}_${periodoActivo}.xlsx`);
    mostrarFeedback(`Nómina Actos GDP exportada para escenario "${escenarioActivo.nombre}".`);
  }, 'Error exportando Nómina Actos GDP');

  const vacantesSinCubrir = useMemo(() => {
    const cubiertas = new Set(propuestas.map(p => p.vacanteDestinoId).filter(Boolean) as string[]);
    return vacantesNn.filter(v => !cubiertas.has(v.id));
  }, [vacantesNn, propuestas]);

  const solicitudesById = useMemo(
    () => new Map(solicitudes.map(s => [s.id, s])),
    [solicitudes]
  );

  const casosLaMesa = useMemo(
    () =>
      construirCasosLaMesa({
        vacantesNn,
        solicitudes,
        docentesTerritorio: docentesNoVacantes,
        propuestas,
        colegiosByRbd
      }),
    [vacantesNn, solicitudes, docentesNoVacantes, propuestas, colegiosByRbd]
  );

  const handleAceptarCandidatoLaMesa = (caso: CasoVacanteLaMesa, cand: CandidatoSugeridoMesa) => {
    if (!escenarioActivo) return;
    ejecutarOperacion('Agregando propuesta desde La Mesa...', async () => {
      await agregarPropuestaCalce(
        {
          escenarioId: escenarioActivo.id,
          periodo: periodoActivo,
          docenteOrigenId: cand.solicitud.docenteId,
          vacanteDestinoId: caso.vacante.id,
          solicitudMovilidadId: cand.solicitud.id,
          egresoOrigenId: caso.vacante.origenEgresoId || undefined,
          tipoCobertura: caso.vacante.vacanteCondicional ? 'TRANSITORIA_CONDICIONAL' : 'DEFINITIVA',
          esTrasladoCompleto: cand.candidato.esTrasladoCompleto !== false,
          expectedVersion: escenarioActivo.version ?? 1,
          estamentoPersonal: 'DOCENTE'
        },
        rol
      );
      await refrescarEscenariosYPropuestas(escenarioActivo.id);
      mostrarFeedback(`Propuesta aceptada: ${cand.solicitud.nombreDocente} asignado a vacante.`);
    }, 'Error aceptando propuesta en La Mesa');
  };

  const handleImprimirNotificacion = (solicitud: SolicitudMovilidad, propuesta?: PropuestaCalce) => {
    try {
      const html = generarHtmlNotificacionMovilidad({
        solicitud,
        propuesta,
        estOrigen: colegiosByRbd.get(solicitud.rbdOrigen),
        estDestino: colegiosByRbd.get(propuesta?.rbdDestino || solicitud.rbdDestinoPreferente || ''),
        periodo: periodoActivo,
        usuarioActor: actorNombre
      });
      imprimirActaMesaMovilidad(html);
    } catch (err: any) {
      mostrarFeedback(`Error emitiendo notificación: ${err?.message || err}`, 'error');
    }
  };

  const handleConfirmarRevertirEscenario = (e: React.FormEvent) => {
    e.preventDefault();
    if (!escenarioActivo) return;
    ejecutarOperacion('Revirtiendo consolidación y restaurando snapshot...', async () => {
      const res = await revertirEscenarioConsolidado({
        escenarioId: escenarioActivo.id,
        motivo: modalRevertirEscenario.motivo,
        rolActor: rol,
        usuarioActor: actorNombre
      });
      setModalRevertirEscenario({ open: false, motivo: '' });
      await onDatosActualizados();
      await recargarModuloMovilidad();
      await refrescarEscenariosYPropuestas(escenarioActivo.id);
      mostrarFeedback(`Consolidación revertida (v${res.nuevaVersion}): ${res.docentesRestaurados} docente(s), ${res.rebotesEliminados} rebote(s) eliminados.`);
    }, 'Error revirtiendo consolidación');
  };

  const handleImprimirActaMesa = () => {
    if (!escenarioActivo) return;
    try {
      const html = generarHtmlActaMesaMovilidad({
        escenario: escenarioActivo,
        propuestas,
        colegios,
        vacantesSinCubrir,
        periodo: periodoActivo,
        usuarioActor: actorNombre
      });
      imprimirActaMesaMovilidad(html);
    } catch (err: any) {
      mostrarFeedback(`Error abriendo acta imprimible: ${err?.message || err}`, 'error');
    }
  };

  const handleDescargarActaWord = () => {
    if (!escenarioActivo) return;
    const html = generarHtmlActaMesaMovilidad({
      escenario: escenarioActivo,
      propuestas,
      colegios,
      vacantesSinCubrir,
      periodo: periodoActivo,
      usuarioActor: actorNombre
    });
    const nombreSeguro = escenarioActivo.nombre.replace(/[^a-zA-Z0-9_-]+/g, '_');
    descargarActaWordMesaMovilidad(html, `Acta_Mesa_Movilidad_${nombreSeguro}_${periodoActivo}.doc`);
    mostrarFeedback(`Acta Word descargada para escenario "${escenarioActivo.nombre}".`);
  };

  const handleExportarVacantesConcurso = () => ejecutarOperacion('Exportando vacantes remanentes para concurso GDP (.xlsx)...', async () => {
    const bytes = await exportarVacantesRemanentesConcursoExcel({
      vacantesSinCubrir,
      colegios,
      periodo: periodoActivo
    });
    saveAs(
      new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `Vacantes_Concurso_GDP_${periodoActivo}.xlsx`
    );
    mostrarFeedback(`Exportadas ${vacantesSinCubrir.length} vacante(s) remanentes a Excel.`);
  }, 'Error exportando vacantes para concurso');

  const ejecutarComparativaGemini = async (idA: string, idB: string) => {
    const targets = escenarios.filter(e => e.id === idA || e.id === idB);
    if (targets.length === 0) return;
    setComparativaState(s => ({ ...s, loading: true }));
    try {
      const listas = await Promise.all(targets.map(e => listarPropuestasEscenario(e.id, rol)));
      const mapProps: Record<string, PropuestaCalce[]> = {};
      targets.forEach((e, idx) => { mapProps[e.id] = listas[idx] || []; });
      const result = await generarResumenComparativoEscenariosGemini({
        escenarios: targets, propuestasPorEscenario: mapProps, periodo: periodoActivo,
        contextoTerritorial: `SLEP Valle Diguillín · ${colegios.length} establecimientos · ${vacantesNn.length} vacantes NN`
      });
      setComparativaState(s => ({ ...s, loading: false, result }));
    } catch (err: any) {
      setComparativaState(s => ({ ...s, loading: false }));
      mostrarFeedback(`Error comparando escenarios: ${err.message || err}`, 'error');
    }
  };

  const handleAbrirCompararGemini = () => {
    if (escenarios.length < 2) return;
    const a = escenarioActivo?.id || escenarios[0].id;
    const b = (escenarios.find(e => e.id !== a) || escenarios[1]).id;
    setComparativaState({ open: true, a, b, loading: true, result: null });
    void ejecutarComparativaGemini(a, b);
  };
  const abrirResolucionModal = () => escenarioActivo && setResolucionModal({
    numero: escenarioActivo.numeroResolucion || '', fecha: escenarioActivo.fechaResolucion || new Date().toISOString().slice(0, 10), vigencia: escenarioActivo.fechaVigencia || '2027-03-01'
  });

  return (
    <div className="space-y-4">
      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm ${feedback.tipo === 'success' ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-rose-50 border-rose-300 text-rose-900'}`}>
          <div className="flex items-center gap-2">{feedback.tipo === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />}<span>{feedback.mensaje}</span></div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:opacity-70"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      <StageGatesHeader
        periodoActivo={periodoActivo} puedeEditarMovilidad={puedeEditarMovilidad} puedeValidarGdp={puedeValidarGdp} puedeConsolidar={puedeConsolidar}
        operacionEnCurso={operacionEnCurso} escenariosCount={escenarios.length} escenarioActivo={escenarioActivo} pausaRevision={pausaRevision}
        previewNnPendientes={previewNnPendientes} proyeccionTechoPiso={proyeccionTechoPiso} kpis={kpis} metricasEscenario={metricasEscenario}
        consolidacionDeshabilitada={consolidacionDeshabilitada} tooltipConsolidacion={tooltipConsolidacion} vistaInternaMesa={vistaInternaMesa}
        casosNoContinuidadCount={casosNoContinuidadConsolidados.length} onCambiarVistaInterna={setVistaInternaMesa}
        onSelectSubTabCola={tab => { setVistaInternaMesa('tablero'); setTabCol1(tab); }}
        onAbrirNuevoEscenario={() => setNuevoEscModal({ open: true, nombre: `Escenario_Mesa_v${escenarios.length + 1}`, desc: '' })}
        onAbrirClonarEscenario={() => escenarioActivo && setClonarEscNombre(`${escenarioActivo.nombre} (Copia)`)}
        onAbrirEscaneoNn={handleAbrirEscaneoNn} onActivarPausaRevision={handleActivarPausaRevision} onAbrirConsolidar={() => setModalConsolidar(true)}
        onAbrirCompararGemini={handleAbrirCompararGemini} onAbrirResolucionExenta={abrirResolucionModal} onExportarNominaActosGdp={handleExportarNominaActosGdp}
        onAbrirRevertirConsolidacion={() => setModalRevertirEscenario({ open: true, motivo: '' })}
        onImprimirActaMesa={handleImprimirActaMesa}
        onDescargarActaWord={handleDescargarActaWord}
        onExportarVacantesConcurso={handleExportarVacantesConcurso}
        syncPendientes={syncPendientes} onReintentarSync={handleReintentarSync} reintentandoSync={reintentandoSync}
      />

      {vistaInternaMesa === 'la_mesa' ? (
        <LaMesaPanel
          periodoActivo={periodoActivo}
          escenarioActivo={escenarioActivo}
          escenarioConsolidado={escenarioConsolidado}
          puedeEditarMovilidad={puedeEditarMovilidad}
          operacionEnCurso={operacionEnCurso}
          casos={casosLaMesa}
          colegiosByRbd={colegiosByRbd}
          solicitudesById={solicitudesById}
          onAceptarCandidato={handleAceptarCandidatoLaMesa}
          onEliminarPropuesta={propId =>
            escenarioActivo &&
            ejecutarOperacion(
              'Eliminando propuesta...',
              async () => {
                await eliminarPropuestaCalce(propId, rol);
                await refrescarEscenariosYPropuestas(escenarioActivo.id);
              },
              'Error eliminando propuesta'
            )
          }
          onImprimirNotificacion={handleImprimirNotificacion}
          onIrATableroTecnico={() => setVistaInternaMesa('tablero')}
        />
      ) : vistaInternaMesa === 'analisis_no_continuidad' ? (
        <AnalisisNoContinuidadPanel casosNoContinuidadConsolidados={casosNoContinuidadConsolidados} colegiosByRbd={colegiosByRbd} comunasDisponibles={comunasDisponibles} periodoActivo={periodoActivo} onFeedback={mostrarFeedback} />
      ) : vistaInternaMesa === 'registro_movimientos' ? (
        <RegistroMovimientosPanel periodoActivo={periodoActivo} colegios={colegios} />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <ColaMovilidadPanel
            periodoActivo={periodoActivo} flags={flags} cargando={cargando} operacionEnCurso={operacionEnCurso}
            puedeEditarMovilidad={puedeEditarMovilidad} puedeEliminarMovilidad={puedeEliminarMovilidad} puedeValidarGdp={puedeValidarGdp}
            rolActual={rol} usuarioId={usuarioActual.id} usuarioEmail={usuarioActual.email} usuarioNombre={usuarioActual.nombreCompleto}
            tabCol1={tabCol1} onChangeTabCol1={setTabCol1} filtroEstamentoCol1={filtroEstamentoCol1} onChangeFiltroEstamentoCol1={setFiltroEstamentoCol1}
            filtroTipoEscuelaRemanente={filtroTipoEscuelaRemanente} onChangeFiltroTipoEscuelaRemanente={setFiltroTipoEscuelaRemanente}
            colegiosByRbd={colegiosByRbd} docentesById={docentesById} comunasDisponibles={comunasDisponibles} origenSeleccionado={origenSeleccionado}
            onSelectOrigen={setOrigenSeleccionado} busquedaTitularNc={ncForm.busqueda} onChangeBusquedaTitularNc={v => setNcForm(f => ({ ...f, busqueda: v }))}
            docenteNcId={ncForm.docId} onChangeDocenteNcId={v => setNcForm(f => ({ ...f, docId: v }))}
            incluirTitularesSinMarcaGdp={ncForm.sinMarcaGdp} onChangeIncluirTitularesSinMarcaGdp={v => setNcForm(f => ({ ...f, sinMarcaGdp: v }))}
            comunaDestNc={ncForm.comunaDest} onChangeComunaDestNc={v => setNcForm(f => ({ ...f, comunaDest: v }))}
            fundamentoNc={ncForm.fundamento} onChangeFundamentoNc={v => setNcForm(f => ({ ...f, fundamento: v }))}
            titularesDisponiblesNc={colas.titularesNcDisp} solicitudesNoContinuidadFiltradas={colas.solNcFiltradas}
            docentesNoContinuidadPendientesFiltrados={colas.docPendFiltrados} onCrearNoContinuidad={handleCrearNoContinuidad}
            onFormalizarNoContinuidadDesdeGdp={doc => registrarNoContinuidadDocente(doc, [doc.observacionesDirector, doc.observacionesSlep, doc.observacionesPal].map(x => (x || '').trim()).filter(Boolean).join(' | ') || 'No Continuidad informada en Propuesta GDP')}
            solicitudesTrasladosFiltradas={colas.solTrasladosFiltradas} onAbrirModalTraslado={() => setTrasladoModal(m => ({ ...m, open: true }))} onAvanzarFlujo={handleAvanzarFlujo}
            onEliminarSolicitud={sol => ejecutarOperacion('Eliminando solicitud...', async () => { await eliminarSolicitudMovilidad(sol.id, rol); if (origenSeleccionado?.solicitudMovilidadId === sol.id) setOrigenSeleccionado(null); await recargarModuloMovilidad(); mostrarFeedback(`Solicitud de ${sol.nombreDocente} eliminada.`); }, 'Error eliminando solicitud')}
            remanentesTotalCount={remanentes.length} remanentesFiltrados={colas.remanentesFiltrados}
            solicitudesAsistentesFiltradas={colas.solAsistentesFiltradas} asistentesNoContinuidadPendientes={colas.asistentesPendientes}
            onAgregarAsistenteACola={handleAgregarAsistenteACola} egresosFiltrados={colas.egresosFiltrados}
            onAbrirModalNuevoEgreso={() => setEgresoModal({ open: true, editId: undefined, q: '', docId: '', causal: 'renuncia_voluntaria', certeza: 'en_tramite', excepcion3Anios: false, cpeipFirme: false, fechaCese: '', decreto: '', obs: '', generarVacante: true })}
            onAbrirModalEditarEgreso={eg => setEgresoModal({ open: true, editId: eg.id, q: '', docId: eg.docenteId, causal: eg.causal, certeza: eg.certeza, excepcion3Anios: eg.excepcionJubilacion3Anios, cpeipFirme: Boolean(eg.cpeipNotificacionFirme), fechaCese: eg.fechaCese || '', decreto: eg.numeroDecreto || '', obs: eg.observaciones || '', generarVacante: !eg.vacanteDocenteId })}
            onEliminarEgreso={eg => ejecutarOperacion('Eliminando egreso proyectado...', async () => { await eliminarEgresoProyectado(eg.id, rolParaGdp); await recargarModuloMovilidad(); mostrarFeedback(`Egreso de ${eg.nombreDocente} eliminado.`); }, 'Error eliminando egreso')}
            onAbrirReversoEgreso={eg => setReversoModal({ egreso: eg, motivo: '' })}
          />
          <SimuladorCalcePanel
            flags={flags} puedeEditarMovilidad={puedeEditarMovilidad} puedeValidarGdp={puedeValidarGdp} puedeConsolidar={puedeConsolidar}
            operacionEnCurso={operacionEnCurso} escenarios={escenarios} escenarioActivoId={escenarioActivoId} escenarioActivo={escenarioActivo}
            onChangeEscenarioActivoId={setEscenarioActivoId} propuestas={propuestas} rebotesPendientesCount={metricasEscenario.rebotesPendientesCount}
            trasladosSinFirmaCount={metricasEscenario.trasladosSinFirmaCount} colegiosByRbd={colegiosByRbd} docentesById={docentesById}
            origenSeleccionado={origenSeleccionado} onLimpiarOrigen={() => setOrigenSeleccionado(null)}
            vacanteDestinoSeleccionada={vacanteDestinoSeleccionada} onLimpiarVacanteDestino={() => setVacanteDestinoId('')}
            tipoCobertura={tipoCobertura} onChangeTipoCobertura={setTipoCobertura} esTrasladoCompleto={esTrasladoCompleto}
            onChangeEsTrasladoCompleto={setEsTrasladoCompleto} onSimularYAgregar={handleSimularYAgregar}
            onSugerirCalcesAutomaticos={() => escenarioActivo && ejecutarOperacion('Calculando optimización global (Húngaro + 2ª Pasada Rebotes)...', async () => { const gen = await generarSugerenciasCalceAutomatico(escenarioActivo.id, periodoActivo, rol); await refrescarEscenariosYPropuestas(escenarioActivo.id); mostrarFeedback(gen.length > 0 ? `Se generaron ${gen.length} sugerencias óptimas de calce territorial.` : 'No se encontraron nuevos calces automáticos sobre el umbral normativo.'); }, 'Error en calce automático')}
            onEliminarPropuesta={propId => escenarioActivo && ejecutarOperacion('Eliminando propuesta...', async () => { await eliminarPropuestaCalce(propId, rol); await refrescarEscenariosYPropuestas(escenarioActivo.id); }, 'Error eliminando propuesta')}
            onResolverRebote={handleResolverRebote} onAbrirCompararGemini={handleAbrirCompararGemini}
            onAbrirResolucionExenta={abrirResolucionModal} onExportarNominaActosGdp={handleExportarNominaActosGdp}
          />
          <BolsaVacantesPanel
            vacantesFiltradas={vacantesFiltradas} filtroTipoVacante={vacFiltros.tipo} onChangeFiltroTipoVacante={t => setVacFiltros(f => ({ ...f, tipo: t }))}
            filtroComunaVacante={vacFiltros.comuna} onChangeFiltroComunaVacante={c => setVacFiltros(f => ({ ...f, comuna: c }))}
            filtroFuenteVacante={vacFiltros.fuente} onChangeFiltroFuenteVacante={ft => setVacFiltros(f => ({ ...f, fuente: ft }))}
            busquedaVacante={vacFiltros.q} onChangeBusquedaVacante={q => setVacFiltros(f => ({ ...f, q }))}
            comunasDisponibles={comunasDisponibles} vacanteDestinoId={vacanteDestinoId} onSelectVacanteDestino={setVacanteDestinoId}
            colegiosByRbd={colegiosByRbd} asignaturasPorCubrirPorVacante={asignaturasPorCubrirPorVacante}
            onVerAsignaturasModal={setVacanteAsignaturasModal} origenSeleccionado={origenSeleccionado} onAbrirHomologacionTp={setVacanteHomologacionModal}
          />
        </div>
      )}

      {nuevoEscModal.open && (
        <ModalShell title="Nuevo Escenario What-If" onClose={() => setNuevoEscModal(s => ({ ...s, open: false }))} maxWidth="max-w-md">
          <form onSubmit={handleCrearEscenario} className="space-y-3">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Escenario</label><input type="text" required value={nuevoEscModal.nombre} onChange={e => setNuevoEscModal(s => ({ ...s, nombre: e.target.value }))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Descripción (opcional)</label><textarea rows={2} value={nuevoEscModal.desc} onChange={e => setNuevoEscModal(s => ({ ...s, desc: e.target.value }))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            <FormFooter onCancel={() => setNuevoEscModal(s => ({ ...s, open: false }))} submitLabel="Crear Escenario" submitClass="bg-indigo-600" />
          </form>
        </ModalShell>
      )}
      {clonarEscNombre !== null && escenarioActivo && (
        <ModalShell title={`Clonar Escenario "${escenarioActivo.nombre}"`} onClose={() => setClonarEscNombre(null)} maxWidth="max-w-md">
          <form onSubmit={handleClonarEscenario} className="space-y-4">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Copia</label><input type="text" required value={clonarEscNombre} onChange={e => setClonarEscNombre(e.target.value)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            <FormFooter onCancel={() => setClonarEscNombre(null)} submitLabel="Clonar Escenario" submitClass="bg-indigo-600" />
          </form>
        </ModalShell>
      )}
      {previewNnModal.open && (
        <ModalShell title={<><ScanSearch className="w-5 h-5 text-amber-600" /><span>Previsualización de Saneamiento NN Territorial ({periodoActivo})</span></>} onClose={() => setPreviewNnModal(s => ({ ...s, open: false }))} maxWidth="max-w-2xl">
          {previewNnModal.loading ? <div className="py-10 text-center text-xs text-slate-500">Analizando nómina territorial y dígito verificador Módulo 11...</div>
            : previewNnModal.items.length === 0 ? <div className="py-8 text-center text-xs text-slate-500">No se detectaron nuevos registros NN o ficticios pendientes de saneamiento.</div>
            : <div className="space-y-2 max-h-80 overflow-y-auto pr-1">{previewNnModal.items.map(item => (
                <div key={item.docente.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between gap-2"><div className="text-xs font-bold text-slate-900">{item.docente.nombres} {item.docente.apellidos} <span className="font-mono text-slate-500">({item.docente.run || 'Sin RUN'})</span></div><span className={`px-2 py-0.5 rounded text-[10px] font-black ${item.confianza === 'ALTA' ? 'bg-rose-100 text-rose-800' : item.confianza === 'MEDIA' ? 'bg-amber-100 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>Confianza {item.confianza}</span></div>
                  <div className="text-[11px] text-slate-600">{colegiosByRbd.get(item.docente.rbd)?.nombre || item.docente.rbd} · {item.docente.horasContrato}h · <span className="font-semibold text-indigo-700">{item.asignacionesCount} asignaciones preservadas</span></div>
                  <div className="text-[10px] text-amber-800">{item.motivos.join(' · ')}</div>
                </div>
              ))}</div>}
          <div className="flex items-center justify-between pt-2 border-t border-slate-100"><span className="text-[11px] text-slate-500">Las asignaciones horarias existentes se conservarán íntegras.</span><div className="flex gap-2"><button type="button" onClick={() => setPreviewNnModal(s => ({ ...s, open: false }))} className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl">Cancelar</button><button type="button" disabled={previewNnModal.loading || previewNnModal.items.length === 0 || Boolean(operacionEnCurso)} onClick={handleConfirmarSaneamientoNn} className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50">Confirmar Saneamiento ({previewNnModal.items.length})</button></div></div>
        </ModalShell>
      )}
      {modalConsolidar && escenarioActivo && (
        <ModalShell title={<><FileCheck2 className="w-5 h-5 text-emerald-600" /><span>Confirmar Consolidación Territorial Atómica</span></>} subtitle={`Escenario: ${escenarioActivo.nombre} (v${escenarioActivo.version ?? 1})`} onClose={() => setModalConsolidar(false)}>
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5 tabular-nums"><div>• Propuestas válidas a ejecutar: <strong>{metricasEscenario.propuestasValidas}</strong></div><div>• Vacantes NN de destino reemplazadas: <strong>{metricasEscenario.propuestasValidas}</strong></div><div>• Vacantes NN-Rebote en escuelas de origen: <strong>{metricasEscenario.rebotesGenerados}</strong></div></div>
          <p className="text-[11px] text-slate-600">Esta operación ejecutará una transacción atómica (RPC / SQLite) con verificación optimista de versión y sincronizará las dotaciones.</p>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setModalConsolidar(false)} className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl">Cancelar</button><button type="button" onClick={handleConfirmarConsolidacion} disabled={Boolean(operacionEnCurso)} className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50">Ejecutar Consolidación Definitiva</button></div>
        </ModalShell>
      )}
      {trasladoModal.open && (
        <ModalShell title="Nueva Solicitud de Traslado Voluntario (Rúbrica Ponderada)" onClose={() => setTrasladoModal(m => ({ ...m, open: false }))} maxWidth="max-w-xl">
          <form onSubmit={handleGuardarTraslado} className="space-y-3">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Docente Solicitante</label><input type="text" value={trasladoModal.q} onChange={e => setTrasladoModal(m => ({ ...m, q: e.target.value }))} placeholder="Filtrar por nombre, RUN o establecimiento..." className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg mb-1.5" /><select required value={trasladoModal.docId} onChange={e => setTrasladoModal(m => ({ ...m, docId: e.target.value }))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"><option value="">Selecciona docente...</option>{modalDerivados.docsTraslado.map(d => <option key={d.id} value={d.id}>{d.nombres} {d.apellidos} ({d.run}) — {d.horasContrato}h · {colegiosByRbd.get(d.rbd)?.nombre || d.rbd}</option>)}</select></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Comuna Destino Preferente</label><select value={trasladoModal.comunaDest} onChange={e => setTrasladoModal(m => ({ ...m, comunaDest: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"><option value="">Sin preferencia</option>{comunasDisponibles.map(c => <option key={c} value={c}>{c}</option>)}</select></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Escuela Preferente (Opcional)</label><select value={trasladoModal.rbdDest} onChange={e => setTrasladoModal(m => ({ ...m, rbdDest: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"><option value="">Cualquier escuela</option>{colegios.map(c => <option key={c.rbd} value={c.rbd}>{c.nombre} ({c.comuna})</option>)}</select></div>
            </div>
            <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
              <div className="flex items-center justify-between text-xs font-black text-indigo-900"><span>Rúbrica Territorial Ponderada (0 - 100 pts)</span><span className="px-2 py-0.5 rounded bg-indigo-600 text-white tabular-nums">Total: {modalDerivados.puntajeTraslado} pts</span></div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">{([['Ley Karin (30%)', 'leyKarin'], ['Salud (25%)', 'salud'], ['Depend. (20%)', 'dependientes'], ['Rural (15%)', 'rural'], ['Antig. (10%)', 'antiguedad']] as const).map(([lbl, k]) => (<label key={k} className="block"><span className="font-bold text-slate-700 block">{lbl}</span><input type="number" min={0} max={100} value={trasladoModal[k]} onChange={e => setTrasladoModal(m => ({ ...m, [k]: Number(e.target.value) }))} className="w-full mt-1 px-2 py-1 border border-slate-300 rounded bg-white tabular-nums" /></label>))}</div>
            </div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Fundamento / Antecedentes</label><textarea rows={2} value={trasladoModal.fundamento} onChange={e => setTrasladoModal(m => ({ ...m, fundamento: e.target.value }))} placeholder="Detalle clínico, Ley Karin, cercanía familiar..." className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            <FormFooter onCancel={() => setTrasladoModal(m => ({ ...m, open: false }))} submitLabel="Guardar Solicitud" submitClass="bg-indigo-600" disabled={!trasladoModal.docId || Boolean(operacionEnCurso)} />
          </form>
        </ModalShell>
      )}
      {egresoModal.open && (
        <ModalShell title={egresoModal.editId ? 'Editar Egreso Proyectado GDP' : 'Registrar Egreso Proyectado GDP'} onClose={() => setEgresoModal(m => ({ ...m, open: false }))} maxWidth="max-w-xl">
          <form onSubmit={handleGuardarEgreso} className="space-y-3">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Docente</label>{!egresoModal.editId && <input type="text" value={egresoModal.q} onChange={e => setEgresoModal(m => ({ ...m, q: e.target.value }))} placeholder="Buscar docente por nombre, RUN o escuela..." className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg mb-1.5" />}<select required disabled={Boolean(egresoModal.editId)} value={egresoModal.docId} onChange={e => setEgresoModal(m => ({ ...m, docId: e.target.value }))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl disabled:bg-slate-100"><option value="">Selecciona docente...</option>{modalDerivados.docsEgreso.map(d => <option key={d.id} value={d.id}>{d.nombres} {d.apellidos} ({d.run}) — {d.horasContrato}h · {colegiosByRbd.get(d.rbd)?.nombre || d.rbd}</option>)}</select></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Causal de Egreso</label><select value={egresoModal.causal} onChange={e => setEgresoModal(m => ({ ...m, causal: e.target.value as CausalEgresoDocente }))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl">{CAUSALES_EGRESO_OPCIONES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}</select></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Certeza Jurídica</label><select value={egresoModal.certeza} onChange={e => setEgresoModal(m => ({ ...m, certeza: e.target.value as CertezaJuridicaEgreso }))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"><option value="en_tramite">En Trámite (Vacante Condicional)</option><option value="confirmado">Confirmado (Decreto y Fecha de Cese)</option></select></div>
            </div>
            {egresoModal.causal === 'art_19s_no_avance' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-2">
                <label className="flex items-start gap-2 cursor-pointer"><input type="checkbox" checked={egresoModal.excepcion3Anios} onChange={e => setEgresoModal(m => ({ ...m, excepcion3Anios: e.target.checked }))} className="mt-0.5 rounded border-amber-400 text-amber-700" /><span className="text-xs font-bold text-amber-950">Excepción Art. 19 S: docente se encuentra a 3 años o menos de la edad legal de jubilación</span></label>
                {egresoModal.excepcion3Anios && <div className="text-[11px] text-rose-800 font-bold">Alerta normativa: Al marcar esta excepción, el docente conserva su cargo y NO libera vacante.</div>}
                <label className="flex items-start gap-2 cursor-pointer pt-1 border-t border-amber-200"><input type="checkbox" checked={egresoModal.cpeipFirme} onChange={e => setEgresoModal(m => ({ ...m, cpeipFirme: e.target.checked }))} className="mt-0.5 rounded border-emerald-500 text-emerald-700" /><span className="text-xs font-bold text-amber-950">Notificación CPEIP firme / plazo de reposición vencido</span></label>
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Cese</label><input type="date" value={egresoModal.fechaCese} onChange={e => setEgresoModal(m => ({ ...m, fechaCese: e.target.value }))} className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg" /></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">N° Decreto / Resolución</label><input type="text" value={egresoModal.decreto} onChange={e => setEgresoModal(m => ({ ...m, decreto: e.target.value }))} placeholder="Ej: Res. Ex. N° 1245" className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg" /></div>
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]"><div className="font-bold text-slate-800">Evaluación Normativa Automática:</div><div className="text-slate-600">Libera vacante: <strong>{modalDerivados.evalEgreso.liberaVacante ? 'Sí' : 'No'}</strong> · Condicional: <strong>{modalDerivados.evalEgreso.esVacanteCondicional ? 'Sí' : 'No'}</strong> · Consolidación definitiva: <strong>{modalDerivados.evalEgreso.permiteConsolidacionDefinitiva ? 'Habilitada' : 'Bloqueada'}</strong></div>{modalDerivados.evalEgreso.alertasNormativas.map((a, idx) => <div key={idx} className="text-amber-800">{a}</div>)}</div>
            {modalDerivados.evalEgreso.liberaVacante && <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer"><input type="checkbox" checked={egresoModal.generarVacante} onChange={e => setEgresoModal(m => ({ ...m, generarVacante: e.target.checked }))} className="rounded border-emerald-400 text-emerald-700" /><span className="text-xs font-bold text-emerald-900">Generar vacante vinculada {modalDerivados.evalEgreso.esVacanteCondicional ? '(condicional)' : ''} en Bolsa NN</span></label>}
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Observaciones GDP</label><textarea rows={2} value={egresoModal.obs} onChange={e => setEgresoModal(m => ({ ...m, obs: e.target.value }))} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            <FormFooter onCancel={() => setEgresoModal(m => ({ ...m, open: false }))} submitLabel="Guardar Egreso GDP" submitClass="bg-emerald-600" disabled={!egresoModal.docId || Boolean(operacionEnCurso)} />
          </form>
        </ModalShell>
      )}
      {reversoModal && (
        <ModalShell title={<><RotateCcw className="w-4 h-4 text-amber-600" /><span>Reincorporar Titular (Reverso Controlado)</span></>} subtitle={`${reversoModal.egreso.nombreDocente} (${reversoModal.egreso.runDocente}) · ${colegiosByRbd.get(reversoModal.egreso.rbd)?.nombre || reversoModal.egreso.rbd}`} onClose={() => setReversoModal(null)}>
          <form onSubmit={handleConfirmarReversoEgreso} className="space-y-3">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-950">Esta acción restituirá al titular como Vigente, reapuntará las asignaciones horarias desde la vacante condicional de regreso al titular y archivará la vacante transitoria.</div>
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Motivo fundamentado obligatorio</label><textarea rows={3} required value={reversoModal.motivo} onChange={e => setReversoModal(r => r ? { ...r, motivo: e.target.value } : r)} placeholder="Ej: Acogida reposición administrativa CPEIP Art. 19 S o alta médica..." className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            <FormFooter onCancel={() => setReversoModal(null)} submitLabel="Confirmar Reincorporación" submitClass="bg-amber-600 hover:bg-amber-700" disabled={!reversoModal.motivo.trim() || Boolean(operacionEnCurso)} />
          </form>
        </ModalShell>
      )}
      {modalRevertirEscenario.open && escenarioActivo && (
        <ModalShell title={<><RotateCcw className="w-4 h-4 text-rose-600" /><span>Revertir Consolidación de Escenario</span></>} subtitle={`Escenario: ${escenarioActivo.nombre} (v${escenarioActivo.version ?? 1})`} onClose={() => setModalRevertirEscenario({ open: false, motivo: '' })} maxWidth="max-w-md">
          <form onSubmit={handleConfirmarRevertirEscenario} className="space-y-3">
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-950">
              Esta operación restaurará los registros previos desde el snapshot de consolidación, eliminará las vacantes NN-Rebote generadas, revertirá las solicitudes a su estado anterior y dejará el escenario nuevamente en <strong>BORRADOR</strong>.
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Motivo fundamentado obligatorio (mín. 5 caracteres)</label>
              <textarea
                rows={3}
                required
                minLength={5}
                value={modalRevertirEscenario.motivo}
                onChange={e => setModalRevertirEscenario(s => ({ ...s, motivo: e.target.value }))}
                placeholder="Ej: Desistimiento documentado del docente o ajuste normativo previo a resolución..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <FormFooter onCancel={() => setModalRevertirEscenario({ open: false, motivo: '' })} submitLabel="Confirmar Reversión" submitClass="bg-rose-600 hover:bg-rose-700" disabled={modalRevertirEscenario.motivo.trim().length < 5 || Boolean(operacionEnCurso)} />
          </form>
        </ModalShell>
      )}
      {resolucionModal && escenarioActivo && (
        <ModalShell title={<><Award className="w-4 h-4 text-cyan-600" /><span>Registrar Resolución Exenta (RESOLUCION_EMITIDA)</span></>} subtitle={`Escenario: ${escenarioActivo.nombre} (v${escenarioActivo.version ?? 1})`} onClose={() => setResolucionModal(null)} maxWidth="max-w-md">
          <form onSubmit={handleGuardarResolucionExenta} className="space-y-3">
            <div><label className="block text-xs font-bold text-slate-700 mb-1">Número de Resolución Exenta</label><input type="text" required value={resolucionModal.numero} onChange={e => setResolucionModal(r => r ? { ...r, numero: e.target.value } : r)} placeholder="Ej: Res. Ex. N° 2048/2027" className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Fecha Resolución</label><input type="date" required value={resolucionModal.fecha} onChange={e => setResolucionModal(r => r ? { ...r, fecha: e.target.value } : r)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
              <div><label className="block text-xs font-bold text-slate-700 mb-1">Fecha Vigencia</label><input type="date" value={resolucionModal.vigencia} onChange={e => setResolucionModal(r => r ? { ...r, vigencia: e.target.value } : r)} className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl" /></div>
            </div>
            <FormFooter onCancel={() => setResolucionModal(null)} submitLabel="Emitir Resolución Exenta" submitClass="bg-cyan-600 hover:bg-cyan-700" disabled={!resolucionModal.numero.trim() || !resolucionModal.fecha || Boolean(operacionEnCurso)} />
          </form>
        </ModalShell>
      )}

      {vacanteAsignaturasModal && <VacanteAsignaturasModal vacante={vacanteAsignaturasModal} colegiosByRbd={colegiosByRbd} asignaturasPorCubrirPorVacante={asignaturasPorCubrirPorVacante} onSelectDestino={setVacanteDestinoId} onClose={() => setVacanteAsignaturasModal(null)} />}
      {vacanteHomologacionModal && <HomologacionTpModal vacante={vacanteHomologacionModal} origenSeleccionado={origenSeleccionado} docentesById={docentesById} colegiosByRbd={colegiosByRbd} cursosTerritorio={cursosTerritorio} onClose={() => setVacanteHomologacionModal(null)} onError={msg => mostrarFeedback(msg, 'error')} />}

      {comparativaState.open && (
        <ModalShell title={<><Sparkles className="w-4 h-4 text-indigo-600" /><span>Comparativa Ejecutiva de Escenarios (Gemini + Motor Determinista)</span></>} onClose={() => setComparativaState(s => ({ ...s, open: false }))} maxWidth="max-w-3xl">
          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-[11px] text-emerald-950 font-bold flex items-start gap-2"><ShieldAlert className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" /><span>Garantía Jurídica: Ningún puntaje de traslado voluntario ni prioridad legal fue asignado o modificado por IA (puntajesModificadosPorIa: false).</span></div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
            <select value={comparativaState.a} onChange={e => setComparativaState(s => ({ ...s, a: e.target.value }))} className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-xl">{escenarios.map(e => <option key={e.id} value={e.id}>{e.nombre} (v{e.version ?? 1})</option>)}</select>
            <select value={comparativaState.b} onChange={e => setComparativaState(s => ({ ...s, b: e.target.value }))} className="px-2.5 py-1.5 text-xs font-bold border border-slate-300 rounded-xl">{escenarios.map(e => <option key={e.id} value={e.id}>{e.nombre} (v{e.version ?? 1})</option>)}</select>
            <button type="button" disabled={comparativaState.loading} onClick={() => ejecutarComparativaGemini(comparativaState.a, comparativaState.b)} className="px-3 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl disabled:opacity-50">{comparativaState.loading ? 'Analizando...' : 'Analizar Comparativa'}</button>
          </div>
          {comparativaState.loading ? <div className="py-8 text-center text-xs text-slate-500">Evaluando cumplimiento normativo determinista y redactando síntesis ejecutiva...</div>
            : comparativaState.result && (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1">
                  <div className="flex items-center justify-between gap-2"><span className="font-black text-indigo-950">Resumen Ejecutivo ({comparativaState.result.origenAnalisis})</span>{comparativaState.result.escenarioRecomendadoNombre && <span className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-black">Sugerido: {comparativaState.result.escenarioRecomendadoNombre}</span>}</div>
                  <p className="text-slate-700 leading-relaxed">{comparativaState.result.resumenEjecutivo}</p>
                </div>
                <div className="border border-slate-200 rounded-xl overflow-hidden">
                  <table className="w-full text-left text-xs"><thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700"><tr><th className="p-2">Escenario</th><th className="p-2">Estado</th><th className="p-2 text-right">Válidas / Bloq.</th><th className="p-2 text-right">Rebotes Pend.</th><th className="p-2 text-right">Score Normativo</th></tr></thead><tbody className="divide-y divide-slate-200">{comparativaState.result.comparativaEscenarios.map(c => (<tr key={c.escenarioId}><td className="p-2 font-bold text-slate-900">{c.nombre}</td><td className="p-2 text-[11px]">{c.estado}</td><td className="p-2 text-right tabular-nums"><span className="text-emerald-700 font-bold">{c.propuestasValidas}</span> / <span className="text-rose-700 font-bold">{c.propuestasBloqueadas}</span></td><td className="p-2 text-right tabular-nums font-bold">{c.rebotesPendientes}</td><td className="p-2 text-right tabular-nums font-black text-indigo-800">{c.puntajeDeterministicRanking}</td></tr>))}</tbody></table>
                </div>
                {comparativaState.result.alertasJuridicasClave.length > 0 && <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 space-y-1"><div className="font-black text-amber-950">Alertas Jurídicas Clave</div>{comparativaState.result.alertasJuridicasClave.map((a, i) => <div key={i} className="text-[11px] text-amber-900">• {a}</div>)}</div>}
                {comparativaState.result.recomendacionesOperativas.length > 0 && <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1"><div className="font-black text-slate-800">Recomendaciones Operativas</div>{comparativaState.result.recomendacionesOperativas.map((r, i) => <div key={i} className="text-[11px] text-slate-700">• {r}</div>)}</div>}
                <div className="text-[10px] text-slate-500 italic">{comparativaState.result.notaNormativa}</div>
              </div>
            )}
        </ModalShell>
      )}
    </div>
  );
};
