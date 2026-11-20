import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ArrowRightLeft,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Plus,
  Copy,
  ScanSearch,
  Sparkles,
  Trash2,
  Lock,
  Search,
  Building2,
  FileCheck2,
  Layers,
  ChevronRight,
  X,
  RefreshCw,
  UserCheck,
  FileSpreadsheet,
  BookOpen,
  Eye
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  Establecimiento,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion,
  CursoSae,
  FeatureFlagsMovilidad,
  EgresoProyectado,
  CausalEgresoDocente,
  CertezaJuridicaEgreso,
  SolicitudMovilidad,
  EstadoFlujoMovilidad,
  EscenarioCalce,
  PropuestaCalce,
  TipoVacanteDocente
} from '../types';
import { AuthSession, RolId } from '../types/authTypes';
import { usePermisos } from '../security/PermisosContext';
import { obtenerFeatureFlagsMovilidad, puedeUsuarioAccederMesaMovilidad } from '../services/configuracionGeneralService';
import {
  esRolNivelCentralMovilidad,
  esRolValidadorGdp,
  esRolConsolidadorMovilidad,
  previsualizarEscaneoVacantesNn,
  escanearYSanearVacantesNnTerritorio,
  listarEgresosProyectados,
  guardarEgresoProyectado,
  eliminarEgresoProyectado,
  listarSolicitudesMovilidad,
  guardarSolicitudMovilidad,
  avanzarEstadoFlujoMovilidad,
  eliminarSolicitudMovilidad,
  detectarDocentesHorasRemanentes,
  listarEscenariosCalce,
  crearEscenarioCalce,
  duplicarEscenarioCalce,
  listarPropuestasEscenario,
  agregarPropuestaCalce,
  eliminarPropuestaCalce,
  generarSugerenciasCalceAutomatico,
  consolidarEscenarioAprobado
} from '../services/movilidadTerritorialService';
import {
  evaluarEgresoProyectado,
  calcularPuntajePrioridadMovilidad,
  obtenerPlanPorCurso,
  TOPE_MINUTOS_SEMANALES_SLEP,
  MAX_MINUTOS_LECTIVOS_ART_69
} from '@slep/mineduc-engine';
import {
  clasificarCategoriaEstablecimiento,
  esPropuestaNoContinuidad,
  CategoriaTipoEstablecimiento
} from '../services/estadisticasHorasService';

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

type SubTabCol1 = 'no_continuidad' | 'traslados' | 'remanentes' | 'egresos_gdp';

interface OrigenSeleccionado {
  docenteId: string;
  solicitudMovilidadId?: string;
  nombreDocente: string;
  runDocente: string;
  rbdOrigen: string;
  carrilLabel: string;
  horas: number;
  calidadJuridica: string;
  asignatura?: string;
  aplicaArticulo69?: boolean;
}

interface PreviewNnItem {
  docente: Docente;
  motivos: string[];
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
  asignacionesCount: number;
}

interface RemanenteItem {
  docente: Docente;
  establecimiento?: Establecimiento;
  horasContrato: number;
  horasLectivasMax: number;
  horasAsignadas: number;
  horasRemanentes: number;
}

const FLUJO_MOVILIDAD_SECUENCIA: EstadoFlujoMovilidad[] = [
  'POSTULADO',
  'PRE_ASIGNADO',
  'NOTIFICADO_DIRECCION_ORIGEN',
  'ACEPTADO_CON_FIRMA',
  'CONSOLIDADO'
];

const ETIQUETAS_FLUJO: Record<EstadoFlujoMovilidad, { label: string; badgeClass: string }> = {
  POSTULADO: { label: 'Postulado', badgeClass: 'bg-slate-100 text-slate-700 border-slate-300' },
  PRE_ASIGNADO: { label: 'Pre-Asignado', badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  NOTIFICADO_DIRECCION_ORIGEN: { label: 'Notificado Dir. Origen', badgeClass: 'bg-amber-50 text-amber-800 border-amber-300' },
  ACEPTADO_CON_FIRMA: { label: 'Aceptado con Firma', badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CONSOLIDADO: { label: 'Consolidado', badgeClass: 'bg-emerald-600 text-white border-emerald-700' },
  RECHAZADO: { label: 'Rechazado', badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' }
};

const CAUSALES_EGRESO_OPCIONES: Array<{ id: CausalEgresoDocente; label: string }> = [
  { id: 'renuncia_voluntaria', label: 'Renuncia Voluntaria' },
  { id: 'art_19s_no_avance', label: 'Art. 19 S Ley 20.903 (No Avance Tramo)' },
  { id: 'incentivo_retiro', label: 'Ley de Incentivo al Retiro' },
  { id: 'salud_incompatible_180d', label: 'Salud Incompatible (>180 días)' },
  { id: 'art_72_otro', label: 'Art. 72 Estatuto Docente (Otra Causal)' }
];

const ETIQUETAS_TIPO_VACANTE: Record<TipoVacanteDocente, { label: string; className: string }> = {
  NN_DETECTADO: { label: 'NN Detectado', className: 'bg-amber-100 text-amber-900 border-amber-300' },
  NECESIDAD_ESCUELA: { label: 'Necesidad Escuela', className: 'bg-indigo-100 text-indigo-800 border-indigo-300' },
  CONDICIONAL_EGRESO: { label: 'Condicional Egreso', className: 'bg-rose-100 text-rose-800 border-rose-300' },
  REBOTE_MOVILIDAD: { label: 'NN-Rebote', className: 'bg-cyan-100 text-cyan-900 border-cyan-300' }
};

function inferirFuenteVacante(doc: Docente): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' {
  const sep = (doc.horasSepTitular || 0) + (doc.horasSepContrata || 0);
  const pie = (doc.horasPieTitular || 0) + (doc.horasPieContrata || 0);
  const sg = (doc.horasSubvencionGeneralTitular || 0) + (doc.horasSubvencionGeneralContrata || 0);
  if (pie >= sep && pie > sg) return 'PIE';
  if (sep > pie && sep > sg) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function inferirFuenteDocente(doc: Docente): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' | 'MIXTO' {
  const sg = (doc.horasSubvencionGeneralTitular || 0) + (doc.horasSubvencionGeneralContrata || 0);
  const sep = (doc.horasSepTitular || 0) + (doc.horasSepContrata || 0);
  const pie = (doc.horasPieTitular || 0) + (doc.horasPieContrata || 0);
  const activas = [sg > 0, sep > 0, pie > 0].filter(Boolean).length;
  if (activas > 1) return 'MIXTO';
  if (pie > 0) return 'PIE';
  if (sep > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function formatearMinutosAHoras(minutos: number): string {
  const minsSeguros = Math.max(0, Math.round(minutos));
  const h = Math.floor(minsSeguros / 60);
  const m = minsSeguros % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

interface CasoNoContinuidadItem {
  id: string;
  estamentoTipo: 'DOCENTE' | 'ASISTENTE';
  rbd: string;
  establecimientoNombre: string;
  comuna: string;
  categoriaEscuela: CategoriaTipoEstablecimiento;
  tipoPerfilEscuela: string;
  run: string;
  nombreCompleto: string;
  calidadJuridica: string;
  cargoEspecialidad: string;
  horasContrato: number;
  fuenteFinanciamiento: string;
  propuestaGdp: string;
  situacionFinalGdp: string;
  razon: string;
  tieneRazon: boolean;
  origenDeteccion: 'PROPUESTA_GDP' | 'SOLICITUD_MESA' | 'AMBOS';
}

interface AsignaturaDirectaVacante {
  asignatura: string;
  cursoNombre: string;
  horasPedagogicas: number;
}

interface DeficitAsignaturaColegio {
  asignatura: string;
  horasPlan: number;
  horasCubiertas: number;
  horasPorCubrir: number;
}

interface ResumenAsignaturasVacante {
  directas: AsignaturaDirectaVacante[];
  totalHorasDirectas: number;
  deficitEstablecimiento: DeficitAsignaturaColegio[];
}

function cumpleFiltroTipoEscuela(est: Establecimiento | undefined, filtro: string): boolean {
  if (filtro === 'TODOS') return true;
  if (!est) return false;
  if (filtro.startsWith('CAT:')) {
    const cat = filtro.replace('CAT:', '') as CategoriaTipoEstablecimiento;
    return clasificarCategoriaEstablecimiento(est) === cat;
  }
  return (est.tipoPerfil || '').toUpperCase() === filtro;
}

function etiquetaCategoriaEscuela(cat: CategoriaTipoEstablecimiento): string {
  if (cat === 'LICEO') return 'Liceo';
  if (cat === 'JARDIN_VTF') return 'Jardín / Sala Cuna VTF';
  return 'Escuela';
}

/**
 * Vista ejecutiva territorial de la Mesa de Movilidad, Saneamiento NN,
 * Egresos Proyectados GDP y Simulador What-If.
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
    !rol ||
    rol === 'director_establecimiento' ||
    rol === 'jefe_utp_establecimiento' ||
    !esRolNivelCentralMovilidad(rol) ||
    !can('mesa_movilidad.ver') ||
    !flags.modulo_movilidad_activo ||
    !puedeUsuarioAccederMesaMovilidad({ id: props.usuarioActual.id, role: rol }, flags)
  ) {
    return null;
  }

  return <MesaMovilidadWorkspace {...props} rol={rol} flags={flags} />;
};

interface MesaMovilidadWorkspaceProps extends MesaMovilidadViewProps {
  rol: RolId;
  flags: FeatureFlagsMovilidad;
}

const MesaMovilidadWorkspace: React.FC<MesaMovilidadWorkspaceProps> = ({
  colegios,
  docentesTerritorio,
  asignacionesTerritorio,
  asistentesTerritorio = [],
  cursosTerritorio = [],
  periodoActivo,
  usuarioActual,
  onDatosActualizados,
  rol,
  flags
}) => {
  const { can } = usePermisos();
  const puedeEditarMovilidad = can('mesa_movilidad.editar') || can('mesa_movilidad.crear');
  const puedeEliminarMovilidad = can('mesa_movilidad.eliminar');
  const puedeValidarGdp = esRolValidadorGdp(rol) || can('gdp_validador.editar');
  const puedeConsolidar = esRolConsolidadorMovilidad(rol);

  const colegiosByRbd = useMemo(() => {
    const map = new Map<string, Establecimiento>();
    for (const c of colegios) map.set(c.rbd, c);
    return map;
  }, [colegios]);

  const docentesNoVacantes = useMemo(
    () => docentesTerritorio.filter(d => !d.esVacanteNn),
    [docentesTerritorio]
  );

  const vacantesNn = useMemo(
    () => docentesTerritorio.filter(d => d.esVacanteNn === true),
    [docentesTerritorio]
  );

  // Datos cargados desde el servicio territorial
  const [egresos, setEgresos] = useState<EgresoProyectado[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudMovilidad[]>([]);
  const [remanentes, setRemanentes] = useState<RemanenteItem[]>([]);
  const [escenarios, setEscenarios] = useState<EscenarioCalce[]>([]);
  const [escenarioActivoId, setEscenarioActivoId] = useState<string>('');
  const [propuestas, setPropuestas] = useState<PropuestaCalce[]>([]);
  const [cargando, setCargando] = useState<boolean>(true);
  const [operacionEnCurso, setOperacionEnCurso] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  const mostrarFeedback = useCallback((mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setFeedback({ tipo, mensaje });
    setTimeout(() => setFeedback(null), 5000);
  }, []);

  // Sub-pestaña activa en Columna 1
  const [tabCol1, setTabCol1] = useState<SubTabCol1>(() => {
    if (flags.flag_no_continuidad_titulares) return 'no_continuidad';
    if (flags.flag_traslados_voluntarios) return 'traslados';
    if (flags.flag_egresos_contingencia) return 'egresos_gdp';
    return 'remanentes';
  });

  useEffect(() => {
    const disponibles: SubTabCol1[] = [];
    if (flags.flag_no_continuidad_titulares) disponibles.push('no_continuidad');
    if (flags.flag_traslados_voluntarios) disponibles.push('traslados');
    disponibles.push('remanentes');
    if (flags.flag_egresos_contingencia) disponibles.push('egresos_gdp');

    if (!disponibles.includes(tabCol1)) {
      setTabCol1(disponibles[0]);
    }
  }, [flags, tabCol1]);

  // Selección activa para constructor de calce manual
  const [origenSeleccionado, setOrigenSeleccionado] = useState<OrigenSeleccionado | null>(null);
  const [vacanteDestinoId, setVacanteDestinoId] = useState<string>('');
  const [tipoCobertura, setTipoCobertura] = useState<'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL'>('DEFINITIVA');
  const [esTrasladoCompleto, setEsTrasladoCompleto] = useState<boolean>(true);

  const vacanteDestinoSeleccionada = useMemo(
    () => vacantesNn.find(v => v.id === vacanteDestinoId) || null,
    [vacantesNn, vacanteDestinoId]
  );

  useEffect(() => {
    if (vacanteDestinoSeleccionada?.vacanteCondicional) {
      setTipoCobertura('TRANSITORIA_CONDICIONAL');
    } else if (vacanteDestinoSeleccionada) {
      setTipoCobertura('DEFINITIVA');
    }
  }, [vacanteDestinoSeleccionada]);

  // Carga inicial / recarga de datos de movilidad
  const recargarModuloMovilidad = useCallback(async () => {
    setCargando(true);
    try {
      const [egs, sols, rems, escs] = await Promise.all([
        listarEgresosProyectados(periodoActivo, rol),
        listarSolicitudesMovilidad(periodoActivo, rol),
        detectarDocentesHorasRemanentes(periodoActivo, rol),
        listarEscenariosCalce(periodoActivo, rol)
      ]);
      setEgresos(egs);
      setSolicitudes(sols);
      setRemanentes(rems);
      setEscenarios(escs);

      setEscenarioActivoId(prev => {
        if (prev && escs.some((e: EscenarioCalce) => e.id === prev)) return prev;
        return escs[0]?.id || '';
      });
    } catch (err: any) {
      mostrarFeedback(`Error cargando datos de movilidad: ${err.message || err}`, 'error');
    } finally {
      setCargando(false);
    }
  }, [periodoActivo, rol, mostrarFeedback]);

  useEffect(() => {
    recargarModuloMovilidad();
  }, [recargarModuloMovilidad]);

  const recargarPropuestas = useCallback(async (escId: string) => {
    if (!escId) {
      setPropuestas([]);
      return;
    }
    try {
      const lista = await listarPropuestasEscenario(escId, rol);
      setPropuestas(lista);
    } catch (err: any) {
      mostrarFeedback(`Error cargando propuestas del escenario: ${err.message || err}`, 'error');
    }
  }, [rol, mostrarFeedback]);

  useEffect(() => {
    recargarPropuestas(escenarioActivoId);
  }, [escenarioActivoId, recargarPropuestas]);

  const escenarioActivo = useMemo(
    () => escenarios.find(e => e.id === escenarioActivoId) || null,
    [escenarios, escenarioActivoId]
  );

  // KPIs calculados en tiempo real
  const metricasEscenario = useMemo(() => {
    const total = propuestas.length;
    const bloqueadas = propuestas.filter(p => p.bloqueaConsolidacion).length;
    const validas = total - bloqueadas;
    const rebotes = propuestas.filter(p => p.generaRebote).length;
    return {
      totalPropuestas: total,
      propuestasValidas: validas,
      propuestasBloqueadas: bloqueadas,
      rebotesGenerados: rebotes
    };
  }, [propuestas]);

  const kpis = useMemo(() => {
    const vacantesCondicionales = vacantesNn.filter(v => v.vacanteCondicional).length;
    const egresosConfirmados = egresos.filter(e => e.certeza === 'confirmado').length;
    const egresosEnTramite = egresos.filter(e => e.certeza === 'en_tramite').length;
    const solicitudesActivas = solicitudes.filter(s => s.estadoFlujo !== 'CONSOLIDADO' && s.estadoFlujo !== 'RECHAZADO').length;
    return {
      vacantesActivas: vacantesNn.length,
      vacantesCondicionales,
      egresosConfirmados,
      egresosEnTramite,
      solicitudesActivas,
      totalSolicitudes: solicitudes.length
    };
  }, [vacantesNn, egresos, solicitudes]);

  // ── Modales de Cabecera (Escenarios, Escaneo NN, Consolidación) ──
  const [modalNuevoEscenario, setModalNuevoEscenario] = useState(false);
  const [nuevoEscenarioNombre, setNuevoEscenarioNombre] = useState('');
  const [nuevoEscenarioDesc, setNuevoEscenarioDesc] = useState('');

  const [modalClonarEscenario, setModalClonarEscenario] = useState(false);
  const [clonarEscenarioNombre, setClonarEscenarioNombre] = useState('');

  const [modalPreviewNn, setModalPreviewNn] = useState(false);
  const [previewNnItems, setPreviewNnItems] = useState<PreviewNnItem[]>([]);
  const [cargandoPreviewNn, setCargandoPreviewNn] = useState(false);

  const [modalConsolidar, setModalConsolidar] = useState(false);

  const handleCrearEscenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoEscenarioNombre.trim()) return;
    setOperacionEnCurso('Creando escenario...');
    try {
      const creado = await crearEscenarioCalce(
        {
          periodo: periodoActivo,
          nombre: nuevoEscenarioNombre.trim(),
          descripcion: nuevoEscenarioDesc.trim() || undefined,
          creadoPor: usuarioActual.email || usuarioActual.nombreCompleto
        },
        rol
      );
      setEscenarios(prev => [creado, ...prev]);
      setEscenarioActivoId(creado.id);
      setModalNuevoEscenario(false);
      setNuevoEscenarioNombre('');
      setNuevoEscenarioDesc('');
      mostrarFeedback(`Escenario "${creado.nombre}" creado.`);
    } catch (err: any) {
      mostrarFeedback(`Error al crear escenario: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleClonarEscenario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!escenarioActivo || !clonarEscenarioNombre.trim()) return;
    setOperacionEnCurso('Clonando escenario...');
    try {
      const clonado = await duplicarEscenarioCalce(
        escenarioActivo.id,
        clonarEscenarioNombre.trim(),
        rol,
        usuarioActual.email || usuarioActual.nombreCompleto
      );
      setEscenarios(prev => [clonado, ...prev]);
      setEscenarioActivoId(clonado.id);
      setModalClonarEscenario(false);
      mostrarFeedback(`Escenario clonado como "${clonado.nombre}".`);
    } catch (err: any) {
      mostrarFeedback(`Error al clonar escenario: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleAbrirEscaneoNn = async () => {
    setModalPreviewNn(true);
    setCargandoPreviewNn(true);
    try {
      const items = await previsualizarEscaneoVacantesNn(periodoActivo);
      setPreviewNnItems(items);
    } catch (err: any) {
      mostrarFeedback(`Error previsualizando escaneo NN: ${err.message || err}`, 'error');
      setModalPreviewNn(false);
    } finally {
      setCargandoPreviewNn(false);
    }
  };

  const handleConfirmarSaneamientoNn = async () => {
    setOperacionEnCurso('Ejecutando saneamiento NN territorial...');
    try {
      const res = await escanearYSanearVacantesNnTerritorio({
        periodo: periodoActivo,
        rolActor: rol,
        usuarioActor: usuarioActual.email || usuarioActual.nombreCompleto
      });
      await onDatosActualizados();
      await recargarModuloMovilidad();
      setModalPreviewNn(false);
      mostrarFeedback(
        `Saneamiento completado: ${res.escaneados} docentes escaneados, ${res.marcadosNn} marcados como NN y ${res.asignacionesPreservadas} asignaciones preservadas.`
      );
    } catch (err: any) {
      mostrarFeedback(`Error ejecutando saneamiento NN: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleConfirmarConsolidacion = async () => {
    if (!escenarioActivo) return;
    setOperacionEnCurso('Consolidando escenario atómicamente...');
    try {
      const res = await consolidarEscenarioAprobado({
        escenarioId: escenarioActivo.id,
        rolActor: rol,
        usuarioActor: usuarioActual.email || usuarioActual.nombreCompleto
      });
      setModalConsolidar(false);
      await onDatosActualizados();
      await recargarModuloMovilidad();
      await recargarPropuestas(escenarioActivo.id);
      mostrarFeedback(
        `Escenario consolidado: ${res.propuestasConsolidadas} propuestas aplicadas, ${res.vacantesReemplazadas} vacantes reemplazadas, ${res.rebotesCreados} rebotes creados en ${res.rbdsAfectados.length} RBDs.`
      );
    } catch (err: any) {
      mostrarFeedback(`Error consolidando escenario: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  // ── Formularios Columna 1: No Continuidad, Traslados, Egresos GDP ──
  const [busquedaTitularNc, setBusquedaTitularNc] = useState('');
  const [docenteNcId, setDocenteNcId] = useState('');
  const [comunaDestNc, setComunaDestNc] = useState('');
  const [fundamentoNc, setFundamentoNc] = useState('');

  const titularesDisponiblesNc = useMemo(() => {
    const q = busquedaTitularNc.toLowerCase().trim();
    return docentesNoVacantes
      .filter(d => d.calidadJuridica === 'TITULAR')
      .filter(d =>
        !q ||
        `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) ||
        d.run.toLowerCase().includes(q) ||
        (colegiosByRbd.get(d.rbd)?.nombre || '').toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [docentesNoVacantes, busquedaTitularNc, colegiosByRbd]);

  const handleCrearNoContinuidad = async (e: React.FormEvent) => {
    e.preventDefault();
    const doc = docentesNoVacantes.find(d => d.id === docenteNcId);
    if (!doc) return;
    const est = colegiosByRbd.get(doc.rbd);
    const horasTit =
      (doc.horasSubvencionGeneralTitular || 0) + (doc.horasSepTitular || 0) + (doc.horasPieTitular || 0) ||
      doc.horasContrato;
    setOperacionEnCurso('Registrando no continuidad Art. 42...');
    try {
      await guardarSolicitudMovilidad(
        {
          periodo: periodoActivo,
          carril: 'NO_CONTINUIDAD_TITULAR',
          docenteId: doc.id,
          runDocente: doc.run,
          nombreDocente: `${doc.nombres} ${doc.apellidos}`.trim(),
          rbdOrigen: doc.rbd,
          comunaOrigen: est?.comuna,
          comunaDestinoPreferente: comunaDestNc || undefined,
          calidadJuridica: doc.calidadJuridica,
          horasContratoActual: doc.horasContrato,
          horasTitularesActuales: horasTit,
          horasDisponiblesMover: doc.horasContrato,
          horasRemanentes: 0,
          asignaturaPrincipal: doc.asignaturaPrincipal,
          tituloMencion: doc.titulo,
          aplicaArticulo69: doc.aplicaArticulo69,
          fuenteActual: inferirFuenteDocente(doc),
          estadoFlujo: 'POSTULADO',
          puntajeSalud: 0,
          puntajeLeyKarin: 0,
          puntajeCuidadoDependientes: 0,
          puntajeDistanciaRural: 0,
          puntajeAntiguedad: 50,
          fundamento: fundamentoNc.trim() || 'Resguardo Art. 42 por no continuidad de horas titulares en origen',
          creadoPor: usuarioActual.email || usuarioActual.nombreCompleto
        },
        rol
      );
      setDocenteNcId('');
      setComunaDestNc('');
      setFundamentoNc('');
      await recargarModuloMovilidad();
      mostrarFeedback('Solicitud de No Continuidad (Art. 42) agregada a la cola prioritaria.');
    } catch (err: any) {
      mostrarFeedback(`Error guardando solicitud: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  // Modal / Form Traslado Voluntario con Rúbrica Ponderada
  const [modalTrasladoAbierto, setModalTrasladoAbierto] = useState(false);
  const [busquedaDocTraslado, setBusquedaDocTraslado] = useState('');
  const [docTrasladoId, setDocTrasladoId] = useState('');
  const [rbdDestTraslado, setRbdDestTraslado] = useState('');
  const [comunaDestTraslado, setComunaDestTraslado] = useState('');
  const [puntajeLeyKarin, setPuntajeLeyKarin] = useState(0);
  const [puntajeSalud, setPuntajeSalud] = useState(0);
  const [puntajeDependientes, setPuntajeDependientes] = useState(0);
  const [puntajeDistanciaRural, setPuntajeDistanciaRural] = useState(0);
  const [puntajeAntiguedad, setPuntajeAntiguedad] = useState(0);
  const [fundamentoTraslado, setFundamentoTraslado] = useState('');

  const puntajeTrasladoPreview = useMemo(
    () =>
      calcularPuntajePrioridadMovilidad({
        carril: 'TRASLADO_VOLUNTARIO',
        puntajeLeyKarin,
        puntajeSalud,
        puntajeCuidadoDependientes: puntajeDependientes,
        puntajeDistanciaRural,
        puntajeAntiguedad
      }),
    [puntajeLeyKarin, puntajeSalud, puntajeDependientes, puntajeDistanciaRural, puntajeAntiguedad]
  );

  const docentesFiltradosTraslado = useMemo(() => {
    const q = busquedaDocTraslado.toLowerCase().trim();
    return docentesNoVacantes
      .filter(
        d =>
          !q ||
          `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) ||
          d.run.toLowerCase().includes(q) ||
          (colegiosByRbd.get(d.rbd)?.nombre || '').toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [docentesNoVacantes, busquedaDocTraslado, colegiosByRbd]);

  const handleGuardarTraslado = async (e: React.FormEvent) => {
    e.preventDefault();
    const doc = docentesNoVacantes.find(d => d.id === docTrasladoId);
    if (!doc) return;
    const est = colegiosByRbd.get(doc.rbd);
    const horasTit =
      (doc.horasSubvencionGeneralTitular || 0) + (doc.horasSepTitular || 0) + (doc.horasPieTitular || 0);
    setOperacionEnCurso('Guardando solicitud de traslado...');
    try {
      await guardarSolicitudMovilidad(
        {
          periodo: periodoActivo,
          carril: 'TRASLADO_VOLUNTARIO',
          docenteId: doc.id,
          runDocente: doc.run,
          nombreDocente: `${doc.nombres} ${doc.apellidos}`.trim(),
          rbdOrigen: doc.rbd,
          comunaOrigen: est?.comuna,
          rbdDestinoPreferente: rbdDestTraslado || undefined,
          comunaDestinoPreferente: comunaDestTraslado || undefined,
          calidadJuridica: doc.calidadJuridica,
          horasContratoActual: doc.horasContrato,
          horasTitularesActuales: horasTit,
          horasDisponiblesMover: doc.horasContrato,
          horasRemanentes: 0,
          asignaturaPrincipal: doc.asignaturaPrincipal,
          tituloMencion: doc.titulo,
          aplicaArticulo69: doc.aplicaArticulo69,
          fuenteActual: inferirFuenteDocente(doc),
          estadoFlujo: 'POSTULADO',
          puntajeSalud,
          puntajeLeyKarin,
          puntajeCuidadoDependientes: puntajeDependientes,
          puntajeDistanciaRural,
          puntajeAntiguedad,
          fundamento: fundamentoTraslado.trim() || undefined,
          creadoPor: usuarioActual.email || usuarioActual.nombreCompleto
        },
        rol
      );
      setModalTrasladoAbierto(false);
      setDocTrasladoId('');
      setFundamentoTraslado('');
      await recargarModuloMovilidad();
      mostrarFeedback('Solicitud de traslado voluntario ingresada y ponderada.');
    } catch (err: any) {
      mostrarFeedback(`Error guardando traslado: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleAvanzarFlujo = async (sol: SolicitudMovilidad) => {
    const idx = FLUJO_MOVILIDAD_SECUENCIA.indexOf(sol.estadoFlujo);
    if (idx < 0 || idx >= FLUJO_MOVILIDAD_SECUENCIA.length - 1) return;
    const siguiente = FLUJO_MOVILIDAD_SECUENCIA[idx + 1];
    if (siguiente === 'CONSOLIDADO' && !puedeConsolidar) {
      mostrarFeedback('Solo Subdirector UATP o Super Usuario puede pasar una solicitud a CONSOLIDADO.', 'error');
      return;
    }
    setOperacionEnCurso('Actualizando estado de flujo...');
    try {
      await avanzarEstadoFlujoMovilidad(sol.id, siguiente, rol);
      await recargarModuloMovilidad();
      mostrarFeedback(`Estado de ${sol.nombreDocente} avanzado a ${ETIQUETAS_FLUJO[siguiente].label}.`);
    } catch (err: any) {
      mostrarFeedback(`Error actualizando estado: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleEliminarSolicitud = async (sol: SolicitudMovilidad) => {
    setOperacionEnCurso('Eliminando solicitud...');
    try {
      await eliminarSolicitudMovilidad(sol.id, rol);
      if (origenSeleccionado?.solicitudMovilidadId === sol.id) {
        setOrigenSeleccionado(null);
      }
      await recargarModuloMovilidad();
      mostrarFeedback(`Solicitud de ${sol.nombreDocente} eliminada.`);
    } catch (err: any) {
      mostrarFeedback(`Error eliminando solicitud: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  // Formulario Egreso Proyectado GDP
  const [modalEgresoAbierto, setModalEgresoAbierto] = useState(false);
  const [egresoEditId, setEgresoEditId] = useState<string | undefined>(undefined);
  const [busquedaDocEgreso, setBusquedaDocEgreso] = useState('');
  const [egresoDocId, setEgresoDocId] = useState('');
  const [egresoCausal, setEgresoCausal] = useState<CausalEgresoDocente>('renuncia_voluntaria');
  const [egresoCerteza, setEgresoCerteza] = useState<CertezaJuridicaEgreso>('en_tramite');
  const [egresoExcepcion3Anios, setEgresoExcepcion3Anios] = useState(false);
  const [egresoFechaCese, setEgresoFechaCese] = useState('');
  const [egresoDecreto, setEgresoDecreto] = useState('');
  const [egresoObs, setEgresoObs] = useState('');
  const [egresoGenerarVacante, setEgresoGenerarVacante] = useState(true);

  const docEgresoSeleccionado = useMemo(
    () => docentesNoVacantes.find(d => d.id === egresoDocId) || null,
    [docentesNoVacantes, egresoDocId]
  );

  const evaluacionEgresoPreview = useMemo(
    () =>
      evaluarEgresoProyectado({
        causal: egresoCausal,
        certeza: egresoCerteza,
        excepcionJubilacion3Anios: egresoCausal === 'art_19s_no_avance' ? egresoExcepcion3Anios : false,
        fechaCese: egresoFechaCese || undefined,
        numeroDecreto: egresoDecreto || undefined,
        horasLiberadas: docEgresoSeleccionado?.horasContrato || 0
      }),
    [egresoCausal, egresoCerteza, egresoExcepcion3Anios, egresoFechaCese, egresoDecreto, docEgresoSeleccionado]
  );

  const docentesFiltradosEgreso = useMemo(() => {
    const q = busquedaDocEgreso.toLowerCase().trim();
    return docentesNoVacantes
      .filter(
        d =>
          !q ||
          `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) ||
          d.run.toLowerCase().includes(q) ||
          (colegiosByRbd.get(d.rbd)?.nombre || '').toLowerCase().includes(q)
      )
      .slice(0, 60);
  }, [docentesNoVacantes, busquedaDocEgreso, colegiosByRbd]);

  const abrirModalNuevoEgreso = () => {
    setEgresoEditId(undefined);
    setEgresoDocId('');
    setEgresoCausal('renuncia_voluntaria');
    setEgresoCerteza('en_tramite');
    setEgresoExcepcion3Anios(false);
    setEgresoFechaCese('');
    setEgresoDecreto('');
    setEgresoObs('');
    setEgresoGenerarVacante(true);
    setModalEgresoAbierto(true);
  };

  const abrirModalEditarEgreso = (eg: EgresoProyectado) => {
    setEgresoEditId(eg.id);
    setEgresoDocId(eg.docenteId);
    setEgresoCausal(eg.causal);
    setEgresoCerteza(eg.certeza);
    setEgresoExcepcion3Anios(eg.excepcionJubilacion3Anios);
    setEgresoFechaCese(eg.fechaCese || '');
    setEgresoDecreto(eg.numeroDecreto || '');
    setEgresoObs(eg.observaciones || '');
    setEgresoGenerarVacante(!eg.vacanteDocenteId);
    setModalEgresoAbierto(true);
  };

  const handleGuardarEgreso = async (e: React.FormEvent) => {
    e.preventDefault();
    const doc = docEgresoSeleccionado;
    if (!doc) return;
    const asigAula = asignacionesTerritorio
      .filter(a => a.docenteId === doc.id && (a.periodo === undefined || a.periodo === periodoActivo))
      .reduce((acc, a) => acc + (a.horasPedagogicasAula || 0), 0);

    setOperacionEnCurso('Validando y guardando egreso proyectado...');
    try {
      const res = await guardarEgresoProyectado(
        {
          id: egresoEditId,
          rbd: doc.rbd,
          periodo: periodoActivo,
          docenteId: doc.id,
          runDocente: doc.run,
          nombreDocente: `${doc.nombres} ${doc.apellidos}`.trim(),
          asignaturaPrincipal: doc.asignaturaPrincipal,
          horasLiberadas: doc.horasContrato,
          horasAulaLiberadas: asigAula,
          fuenteFinanciamiento: inferirFuenteDocente(doc),
          calidadJuridica: doc.calidadJuridica,
          causal: egresoCausal,
          certeza: egresoCerteza,
          excepcionJubilacion3Anios: egresoCausal === 'art_19s_no_avance' ? egresoExcepcion3Anios : false,
          fechaCese: egresoFechaCese || undefined,
          numeroDecreto: egresoDecreto || undefined,
          impactoPresupuestario: evaluacionEgresoPreview.impactoPresupuestarioSugerido,
          validadoPor: usuarioActual.email || usuarioActual.nombreCompleto,
          observaciones: egresoObs.trim() || undefined
        },
        rol,
        evaluacionEgresoPreview.liberaVacante ? egresoGenerarVacante : false
      );
      setModalEgresoAbierto(false);
      await recargarModuloMovilidad();
      if (res.vacanteGenerada) {
        await onDatosActualizados();
      }
      mostrarFeedback(
        res.vacanteGenerada
          ? `Egreso guardado y vacante ${res.vacanteGenerada.vacanteCondicional ? 'condicional ' : ''}generada en bolsa NN.`
          : 'Egreso proyectado guardado correctamente.'
      );
    } catch (err: any) {
      mostrarFeedback(`Error guardando egreso: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleEliminarEgreso = async (eg: EgresoProyectado) => {
    setOperacionEnCurso('Eliminando egreso proyectado...');
    try {
      await eliminarEgresoProyectado(eg.id, rol);
      await recargarModuloMovilidad();
      mostrarFeedback(`Egreso proyectado de ${eg.nombreDocente} eliminado.`);
    } catch (err: any) {
      mostrarFeedback(`Error eliminando egreso: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  // ── Acciones Columna 2: Calces Manual y Automático ──
  const handleSimularYAgregar = async () => {
    if (!escenarioActivo || !origenSeleccionado || !vacanteDestinoSeleccionada) return;
    setOperacionEnCurso('Evaluando calce normativo en minutos enteros...');
    try {
      await agregarPropuestaCalce(
        {
          escenarioId: escenarioActivo.id,
          periodo: periodoActivo,
          docenteOrigenId: origenSeleccionado.docenteId,
          vacanteDestinoId: vacanteDestinoSeleccionada.id,
          solicitudMovilidadId: origenSeleccionado.solicitudMovilidadId,
          egresoOrigenId: vacanteDestinoSeleccionada.origenEgresoId || undefined,
          tipoCobertura,
          esTrasladoCompleto
        },
        rol
      );
      await recargarPropuestas(escenarioActivo.id);
      mostrarFeedback('Propuesta evaluada y agregada al escenario What-If.');
    } catch (err: any) {
      mostrarFeedback(`Error simulando calce: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleSugerirCalcesAutomaticos = async () => {
    if (!escenarioActivo) return;
    setOperacionEnCurso('Calculando sugerencias automáticas de calce territorial...');
    try {
      const generadas = await generarSugerenciasCalceAutomatico(escenarioActivo.id, periodoActivo, rol);
      await recargarPropuestas(escenarioActivo.id);
      mostrarFeedback(
        generadas.length > 0
          ? `Se generaron ${generadas.length} sugerencias óptimas de calce territorial.`
          : 'No se encontraron nuevos calces automáticos sobre el umbral normativo.'
      );
    } catch (err: any) {
      mostrarFeedback(`Error en calce automático: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  const handleEliminarPropuesta = async (propuestaId: string) => {
    if (!escenarioActivo) return;
    setOperacionEnCurso('Eliminando propuesta...');
    try {
      await eliminarPropuestaCalce(propuestaId, rol);
      await recargarPropuestas(escenarioActivo.id);
    } catch (err: any) {
      mostrarFeedback(`Error eliminando propuesta: ${err.message || err}`, 'error');
    } finally {
      setOperacionEnCurso(null);
    }
  };

  // ── Filtros Columna 3: Bolsa de Vacantes NN ──
  const [filtroTipoVacante, setFiltroTipoVacante] = useState<'TODAS' | TipoVacanteDocente>('TODAS');
  const [filtroComunaVacante, setFiltroComunaVacante] = useState<string>('TODAS');
  const [filtroFuenteVacante, setFiltroFuenteVacante] = useState<'TODAS' | 'SUBVENCION_GENERAL' | 'SEP' | 'PIE'>('TODAS');
  const [busquedaVacante, setBusquedaVacante] = useState<string>('');

  const comunasDisponibles = useMemo(() => {
    const set = new Set<string>();
    for (const c of colegios) {
      if (c.comuna) set.add(c.comuna);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [colegios]);

  const vacantesFiltradas = useMemo(() => {
    const q = busquedaVacante.toLowerCase().trim();
    return vacantesNn.filter(v => {
      const tipo: TipoVacanteDocente = v.tipoVacante || 'NN_DETECTADO';
      if (filtroTipoVacante !== 'TODAS' && tipo !== filtroTipoVacante) return false;
      const est = colegiosByRbd.get(v.rbd);
      if (filtroComunaVacante !== 'TODAS' && est?.comuna !== filtroComunaVacante) return false;
      const fuente = inferirFuenteVacante(v);
      if (filtroFuenteVacante !== 'TODAS' && fuente !== filtroFuenteVacante) return false;
      if (q) {
        const hayMatch =
          (v.asignaturaPrincipal || '').toLowerCase().includes(q) ||
          `${v.nombres} ${v.apellidos}`.toLowerCase().includes(q) ||
          (v.run || '').toLowerCase().includes(q) ||
          v.rbd.toLowerCase().includes(q) ||
          (est?.nombre || '').toLowerCase().includes(q) ||
          (est?.comuna || '').toLowerCase().includes(q);
        if (!hayMatch) return false;
      }
      return true;
    });
  }, [vacantesNn, filtroTipoVacante, filtroComunaVacante, filtroFuenteVacante, busquedaVacante, colegiosByRbd]);

  // ── Vista interna del módulo + Filtro Tipo Escuela en Remanentes ──
  const [vistaInternaMesa, setVistaInternaMesa] = useState<'tablero' | 'analisis_no_continuidad'>('tablero');
  const [filtroTipoEscuelaRemanente, setFiltroTipoEscuelaRemanente] = useState<string>('TODOS');
  const [vacanteAsignaturasModal, setVacanteAsignaturasModal] = useState<Docente | null>(null);

  const remanentesFiltrados = useMemo(() => {
    if (filtroTipoEscuelaRemanente === 'TODOS') return remanentes;
    return remanentes.filter(item => {
      const est = item.establecimiento || colegiosByRbd.get(item.docente.rbd);
      return cumpleFiltroTipoEscuela(est, filtroTipoEscuelaRemanente);
    });
  }, [remanentes, filtroTipoEscuelaRemanente, colegiosByRbd]);

  // ── Análisis y Exportación de No Continuidad (Docentes + Asistentes) ──
  const [busquedaNcAnalisis, setBusquedaNcAnalisis] = useState<string>('');
  const [filtroEstamentoNc, setFiltroEstamentoNc] = useState<'TODOS' | 'DOCENTE' | 'ASISTENTE'>('TODOS');
  const [filtroTipoEscuelaNc, setFiltroTipoEscuelaNc] = useState<string>('TODOS');
  const [filtroComunaNc, setFiltroComunaNc] = useState<string>('TODAS');
  const [filtroRazonNc, setFiltroRazonNc] = useState<'TODAS' | 'CON_RAZON' | 'SIN_RAZON'>('TODAS');
  const [exportandoNc, setExportandoNc] = useState<boolean>(false);

  const casosNoContinuidadConsolidados = useMemo<CasoNoContinuidadItem[]>(() => {
    const items: CasoNoContinuidadItem[] = [];
    const solicitudesNcPorDocId = new Map<string, SolicitudMovilidad>();
    for (const s of solicitudes) {
      if (s.carril === 'NO_CONTINUIDAD_TITULAR') {
        solicitudesNcPorDocId.set(s.docenteId, s);
      }
    }

    const docentesProcesados = new Set<string>();
    for (const d of docentesNoVacantes) {
      const sol = solicitudesNcPorDocId.get(d.id);
      const esGdpNc = esPropuestaNoContinuidad(d.propuestaGdp) || esPropuestaNoContinuidad(d.situacionFinalGdp);
      if (!esGdpNc && !sol) continue;

      docentesProcesados.add(d.id);
      const est = colegiosByRbd.get(d.rbd);
      const categoriaEscuela = est ? clasificarCategoriaEstablecimiento(est) : 'ESCUELA';
      const partesRazon = [
        sol?.fundamento?.trim(),
        d.observacionesDirector?.trim(),
        d.observacionesSlep?.trim(),
        d.observacionesPal?.trim()
      ].filter((x, idx, arr): x is string => Boolean(x) && arr.indexOf(x) === idx);
      const razon = partesRazon.join(' | ');

      const fuentes: string[] = [];
      if ((d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0) > 0) fuentes.push('Subv. General');
      if ((d.horasSepTitular || 0) + (d.horasSepContrata || 0) + (d.horasTallerSep || 0) > 0) fuentes.push('SEP');
      if ((d.horasPieTitular || 0) + (d.horasPieContrata || 0) > 0) fuentes.push('PIE');

      items.push({
        id: `nc-doc-${d.id}`,
        estamentoTipo: 'DOCENTE',
        rbd: d.rbd,
        establecimientoNombre: est?.nombre || `RBD ${d.rbd}`,
        comuna: est?.comuna || 'Sin comuna',
        categoriaEscuela,
        tipoPerfilEscuela: est?.tipoPerfil || categoriaEscuela,
        run: d.run,
        nombreCompleto: `${d.nombres} ${d.apellidos}`.trim(),
        calidadJuridica: d.calidadJuridica,
        cargoEspecialidad: d.asignaturaPrincipal || d.cargoInstitucional || d.estamento,
        horasContrato: Number(d.horasContrato || 0),
        fuenteFinanciamiento: fuentes.join(' / ') || 'Subv. General',
        propuestaGdp: d.propuestaGdp || (sol ? 'No Continuidad (Mesa)' : 'No Continuidad'),
        situacionFinalGdp: d.situacionFinalGdp || 'Vigente',
        razon: razon || 'Sin razón especificada en propuesta GDP',
        tieneRazon: Boolean(razon),
        origenDeteccion: esGdpNc && sol ? 'AMBOS' : sol ? 'SOLICITUD_MESA' : 'PROPUESTA_GDP'
      });
    }

    // Solicitudes de No Continuidad cuyo docente no estaba en docentesNoVacantes
    for (const [docId, sol] of solicitudesNcPorDocId.entries()) {
      if (docentesProcesados.has(docId)) continue;
      const est = colegiosByRbd.get(sol.rbdOrigen);
      const categoriaEscuela = est ? clasificarCategoriaEstablecimiento(est) : 'ESCUELA';
      const razon = (sol.fundamento || '').trim();
      items.push({
        id: `nc-sol-${sol.id}`,
        estamentoTipo: 'DOCENTE',
        rbd: sol.rbdOrigen,
        establecimientoNombre: est?.nombre || `RBD ${sol.rbdOrigen}`,
        comuna: est?.comuna || sol.comunaOrigen || 'Sin comuna',
        categoriaEscuela,
        tipoPerfilEscuela: est?.tipoPerfil || categoriaEscuela,
        run: sol.runDocente,
        nombreCompleto: sol.nombreDocente,
        calidadJuridica: sol.calidadJuridica,
        cargoEspecialidad: sol.asignaturaPrincipal || 'Docente',
        horasContrato: Number(sol.horasContratoActual || 0),
        fuenteFinanciamiento: sol.fuenteActual === 'SUBVENCION_GENERAL' ? 'Subv. General' : sol.fuenteActual,
        propuestaGdp: 'No Continuidad (Mesa)',
        situacionFinalGdp: sol.estadoFlujo,
        razon: razon || 'Sin razón especificada en solicitud',
        tieneRazon: Boolean(razon),
        origenDeteccion: 'SOLICITUD_MESA'
      });
    }

    // Asistentes de la Educación con No Continuidad
    for (const a of asistentesTerritorio) {
      const esNc = esPropuestaNoContinuidad(a.propuestaGdp) || esPropuestaNoContinuidad(a.situacionFinalGdp);
      if (!esNc) continue;
      const est = colegiosByRbd.get(a.rbd);
      const categoriaEscuela = est ? clasificarCategoriaEstablecimiento(est) : 'ESCUELA';
      const partesRazon = [
        a.observacionesDirector?.trim(),
        a.observacionesSlep?.trim(),
        a.observacionesPal?.trim(),
        a.observaciones?.trim()
      ].filter((x, idx, arr): x is string => Boolean(x) && arr.indexOf(x) === idx);
      const razon = partesRazon.join(' | ');

      const calidad =
        (a.horasSubvencionGeneralIndefinido || 0) + (a.horasSepIndefinido || 0) + (a.horasPieIndefinido || 0) > 0
          ? 'INDEFINIDO'
          : (a.horasHonorarios || 0) > 0 && a.horasContrato <= (a.horasHonorarios || 0)
          ? 'HONORARIOS'
          : 'PLAZO FIJO';

      const fuentes: string[] = [];
      if ((a.horasSubvencionGeneralIndefinido || 0) + (a.horasSubvencionGeneralPlazoFijo || 0) > 0) fuentes.push('Subv. General');
      if ((a.horasSepIndefinido || 0) + (a.horasSepPlazoFijo || 0) > 0) fuentes.push('SEP');
      if ((a.horasPieIndefinido || 0) + (a.horasPiePlazoFijo || 0) > 0) fuentes.push('PIE');
      if ((a.horasHonorarios || 0) > 0) fuentes.push('Honorarios');

      items.push({
        id: `nc-ae-${a.id}`,
        estamentoTipo: 'ASISTENTE',
        rbd: a.rbd,
        establecimientoNombre: est?.nombre || `RBD ${a.rbd}`,
        comuna: est?.comuna || 'Sin comuna',
        categoriaEscuela,
        tipoPerfilEscuela: est?.tipoPerfil || categoriaEscuela,
        run: a.run,
        nombreCompleto: `${a.nombres} ${a.apellidos}`.trim(),
        calidadJuridica: calidad,
        cargoEspecialidad: a.cargoFuncion || a.estamento,
        horasContrato: Number(a.horasContrato || 0),
        fuenteFinanciamiento: fuentes.join(' / ') || 'Subv. General',
        propuestaGdp: a.propuestaGdp || 'No Continuidad',
        situacionFinalGdp: a.situacionFinalGdp || 'Vigente',
        razon: razon || 'Sin razón especificada en propuesta GDP',
        tieneRazon: Boolean(razon),
        origenDeteccion: 'PROPUESTA_GDP'
      });
    }

    return items.sort((a, b) => a.establecimientoNombre.localeCompare(b.establecimientoNombre, 'es') || a.nombreCompleto.localeCompare(b.nombreCompleto, 'es'));
  }, [docentesNoVacantes, asistentesTerritorio, solicitudes, colegiosByRbd]);

  const casosNoContinuidadFiltrados = useMemo(() => {
    const q = busquedaNcAnalisis.toLowerCase().trim();
    return casosNoContinuidadConsolidados.filter(item => {
      if (filtroEstamentoNc !== 'TODOS' && item.estamentoTipo !== filtroEstamentoNc) return false;
      const est = colegiosByRbd.get(item.rbd);
      if (!cumpleFiltroTipoEscuela(est, filtroTipoEscuelaNc)) return false;
      if (filtroComunaNc !== 'TODAS' && item.comuna !== filtroComunaNc) return false;
      if (filtroRazonNc === 'CON_RAZON' && !item.tieneRazon) return false;
      if (filtroRazonNc === 'SIN_RAZON' && item.tieneRazon) return false;
      if (q) {
        const hit =
          item.nombreCompleto.toLowerCase().includes(q) ||
          item.run.toLowerCase().includes(q) ||
          item.establecimientoNombre.toLowerCase().includes(q) ||
          item.rbd.toLowerCase().includes(q) ||
          item.cargoEspecialidad.toLowerCase().includes(q) ||
          item.razon.toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    });
  }, [casosNoContinuidadConsolidados, busquedaNcAnalisis, filtroEstamentoNc, filtroTipoEscuelaNc, filtroComunaNc, filtroRazonNc, colegiosByRbd]);

  const resumenNoContinuidad = useMemo(() => {
    const docentesCount = casosNoContinuidadFiltrados.filter(c => c.estamentoTipo === 'DOCENTE').length;
    const asistentesCount = casosNoContinuidadFiltrados.filter(c => c.estamentoTipo === 'ASISTENTE').length;
    const horasTotales = casosNoContinuidadFiltrados.reduce((s, c) => s + c.horasContrato, 0);
    const conResguardoEstabilidad = casosNoContinuidadFiltrados.filter(c => c.calidadJuridica === 'TITULAR' || c.calidadJuridica === 'INDEFINIDO').length;
    const sinRazonCount = casosNoContinuidadFiltrados.filter(c => !c.tieneRazon).length;

    const porTipoEscuela = new Map<string, { cantidad: number; horas: number }>();
    const porRazon = new Map<string, number>();
    for (const c of casosNoContinuidadFiltrados) {
      const catLabel = etiquetaCategoriaEscuela(c.categoriaEscuela);
      const prev = porTipoEscuela.get(catLabel) || { cantidad: 0, horas: 0 };
      porTipoEscuela.set(catLabel, { cantidad: prev.cantidad + 1, horas: prev.horas + c.horasContrato });
      porRazon.set(c.razon, (porRazon.get(c.razon) || 0) + 1);
    }

    return {
      docentesCount,
      asistentesCount,
      horasTotales,
      conResguardoEstabilidad,
      sinRazonCount,
      porTipoEscuela: Array.from(porTipoEscuela.entries()).sort((a, b) => b[1].cantidad - a[1].cantidad),
      topRazones: Array.from(porRazon.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6)
    };
  }, [casosNoContinuidadFiltrados]);

  const handleExportarExcelNoContinuidad = async () => {
    setExportandoNc(true);
    try {
      const wb = new ExcelJS.Workbook();
      const wsResumen = wb.addWorksheet('Resumen Analítico');
      wsResumen.columns = [
        { header: 'Indicador / Categoría', key: 'indicador', width: 42 },
        { header: 'Cantidad Casos', key: 'cantidad', width: 18 },
        { header: 'Horas Contrato', key: 'horas', width: 18 }
      ];
      wsResumen.getRow(1).font = { bold: true };
      wsResumen.addRow({ indicador: 'Total Casos No Continuidad', cantidad: casosNoContinuidadFiltrados.length, horas: resumenNoContinuidad.horasTotales });
      wsResumen.addRow({
        indicador: 'Docentes (Ley 20.903)',
        cantidad: resumenNoContinuidad.docentesCount,
        horas: casosNoContinuidadFiltrados.filter(c => c.estamentoTipo === 'DOCENTE').reduce((s, c) => s + c.horasContrato, 0)
      });
      wsResumen.addRow({
        indicador: 'Asistentes de la Educación (Ley 21.109)',
        cantidad: resumenNoContinuidad.asistentesCount,
        horas: casosNoContinuidadFiltrados.filter(c => c.estamentoTipo === 'ASISTENTE').reduce((s, c) => s + c.horasContrato, 0)
      });
      wsResumen.addRow({ indicador: 'Titulares / Indefinidos (Resguardo Art. 42)', cantidad: resumenNoContinuidad.conResguardoEstabilidad, horas: '' });
      wsResumen.addRow({ indicador: 'Casos sin razón especificada', cantidad: resumenNoContinuidad.sinRazonCount, horas: '' });
      wsResumen.addRow({});
      wsResumen.addRow({ indicador: 'Desglose por Tipo de Establecimiento', cantidad: 'Casos', horas: 'Horas' }).font = { bold: true };
      for (const [tipo, data] of resumenNoContinuidad.porTipoEscuela) {
        wsResumen.addRow({ indicador: tipo, cantidad: data.cantidad, horas: data.horas });
      }

      const wsDetalle = wb.addWorksheet('Detalle No Continuidad');
      wsDetalle.columns = [
        { header: 'RBD', key: 'rbd', width: 10 },
        { header: 'Establecimiento', key: 'establecimiento', width: 34 },
        { header: 'Tipo Escuela', key: 'tipoEscuela', width: 20 },
        { header: 'Comuna', key: 'comuna', width: 16 },
        { header: 'Estamento', key: 'estamento', width: 14 },
        { header: 'RUN', key: 'run', width: 14 },
        { header: 'Nombre Completo', key: 'nombre', width: 30 },
        { header: 'Calidad Jurídica', key: 'calidad', width: 16 },
        { header: 'Cargo / Especialidad', key: 'cargo', width: 26 },
        { header: 'Horas Contrato', key: 'horas', width: 14 },
        { header: 'Fuente Financiamiento', key: 'fuente', width: 22 },
        { header: 'Propuesta GDP', key: 'propuesta', width: 20 },
        { header: 'Situación Final GDP', key: 'situacion', width: 18 },
        { header: 'Razón / Fundamento', key: 'razon', width: 48 }
      ];
      wsDetalle.getRow(1).font = { bold: true };
      for (const item of casosNoContinuidadFiltrados) {
        wsDetalle.addRow({
          rbd: item.rbd,
          establecimiento: item.establecimientoNombre,
          tipoEscuela: etiquetaCategoriaEscuela(item.categoriaEscuela),
          comuna: item.comuna,
          estamento: item.estamentoTipo === 'DOCENTE' ? 'Docente' : 'Asistente de la Educación',
          run: item.run,
          nombre: item.nombreCompleto,
          calidad: item.calidadJuridica,
          cargo: item.cargoEspecialidad,
          horas: item.horasContrato,
          fuente: item.fuenteFinanciamiento,
          propuesta: item.propuestaGdp,
          situacion: item.situacionFinalGdp,
          razon: item.razon
        });
      }

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      saveAs(blob, `Analisis_No_Continuidad_SLEP_${periodoActivo}.xlsx`);
      setFeedback({ tipo: 'success', mensaje: `Exportado Excel con ${casosNoContinuidadFiltrados.length} casos de No Continuidad.` });
    } catch (e: any) {
      setFeedback({ tipo: 'error', mensaje: e?.message || 'Error al exportar Excel de No Continuidad.' });
    } finally {
      setExportandoNc(false);
    }
  };

  // ── Asignaturas por Cubrir en Bolsa de Vacantes ──
  const asignaturasPorCubrirPorVacante = useMemo(() => {
    const mapa = new Map<string, ResumenAsignaturasVacante>();
    const cursosPorId = new Map<string, CursoSae>();
    const cursosPorRbd = new Map<string, CursoSae[]>();
    for (const c of cursosTerritorio) {
      cursosPorId.set(c.id, c);
      const arr = cursosPorRbd.get(c.rbd) || [];
      arr.push(c);
      cursosPorRbd.set(c.rbd, arr);
    }

    const vacantesIdsSet = new Set(vacantesNn.map(v => v.id));
    const asigsPorVacanteId = new Map<string, AsignacionHoraria[]>();
    const asigsRealesPorRbd = new Map<string, AsignacionHoraria[]>();

    for (const a of asignacionesTerritorio) {
      if (a.docenteId && vacantesIdsSet.has(a.docenteId)) {
        const arr = asigsPorVacanteId.get(a.docenteId) || [];
        arr.push(a);
        asigsPorVacanteId.set(a.docenteId, arr);
      } else if (a.docenteId && a.docenteId !== 'SIN_DOCENTE') {
        const arr = asigsRealesPorRbd.get(a.rbd) || [];
        arr.push(a);
        asigsRealesPorRbd.set(a.rbd, arr);
      }
    }

    const deficitCachePorRbd = new Map<string, DeficitAsignaturaColegio[]>();
    const obtenerDeficitColegio = (rbd: string): DeficitAsignaturaColegio[] => {
      if (deficitCachePorRbd.has(rbd)) return deficitCachePorRbd.get(rbd)!;
      const cursosCol = cursosPorRbd.get(rbd) || [];
      const asigsCol = asigsRealesPorRbd.get(rbd) || [];
      const planPorAsig = new Map<string, number>();
      const cubiertasPorAsig = new Map<string, number>();

      for (const cur of cursosCol) {
        const plan = obtenerPlanPorCurso(cur.nivel, cur.regimen, cur.especialidadTp);
        if (!plan) continue;
        for (const asig of plan.asignaturasBase || []) {
          const nombre = (asig.nombre || '').trim();
          if (!nombre) continue;
          planPorAsig.set(nombre, (planPorAsig.get(nombre) || 0) + (asig.horasSugeridas || 0));
        }
      }

      for (const a of asigsCol) {
        if (a.esTallerSep || a.esTrabajoColaborativo) continue;
        const nombre = (a.asignatura || '').trim();
        if (!nombre) continue;
        cubiertasPorAsig.set(nombre, (cubiertasPorAsig.get(nombre) || 0) + (a.horasPedagogicasAula || 0));
      }

      const lista: DeficitAsignaturaColegio[] = [];
      for (const [asigNombre, hrsPlan] of planPorAsig.entries()) {
        const normAsig = asigNombre.toLowerCase();
        let hrsCubiertas = cubiertasPorAsig.get(asigNombre) || 0;
        if (hrsCubiertas === 0) {
          for (const [k, v] of cubiertasPorAsig.entries()) {
            if (k.toLowerCase().includes(normAsig) || normAsig.includes(k.toLowerCase())) {
              hrsCubiertas += v;
            }
          }
        }
        const porCubrir = Math.max(0, hrsPlan - hrsCubiertas);
        if (porCubrir > 0) {
          lista.push({
            asignatura: asigNombre,
            horasPlan: hrsPlan,
            horasCubiertas: hrsCubiertas,
            horasPorCubrir: porCubrir
          });
        }
      }
      lista.sort((a, b) => b.horasPorCubrir - a.horasPorCubrir);
      deficitCachePorRbd.set(rbd, lista);
      return lista;
    };

    for (const v of vacantesNn) {
      const asigsDirectas = asigsPorVacanteId.get(v.id) || [];
      const directas: AsignaturaDirectaVacante[] = asigsDirectas.map(a => {
        const cur = cursosPorId.get(a.cursoId);
        return {
          asignatura: a.asignatura || v.asignaturaPrincipal || 'Asignatura por definir',
          cursoNombre: cur ? `${cur.nivel} ${cur.letra}` : (a.cursoId === 'TRANSVERSAL' ? 'Transversal' : 'Curso'),
          horasPedagogicas: Number(a.horasPedagogicasAula || 0)
        };
      });
      const totalHorasDirectas = directas.reduce((s, d) => s + d.horasPedagogicas, 0);
      mapa.set(v.id, {
        directas,
        totalHorasDirectas,
        deficitEstablecimiento: obtenerDeficitColegio(v.rbd)
      });
    }

    return mapa;
  }, [vacantesNn, asignacionesTerritorio, cursosTerritorio]);

  const solicitudesNoContinuidad = useMemo(
    () =>
      solicitudes
        .filter(s => s.carril === 'NO_CONTINUIDAD_TITULAR')
        .sort((a, b) => b.puntajePrioridadTotal - a.puntajePrioridadTotal),
    [solicitudes]
  );

  const solicitudesTraslados = useMemo(
    () =>
      solicitudes
        .filter(s => s.carril === 'TRASLADO_VOLUNTARIO')
        .sort((a, b) => b.puntajePrioridadTotal - a.puntajePrioridadTotal),
    [solicitudes]
  );

  const escenarioConsolidado = escenarioActivo?.estado === 'CONSOLIDADO';
  const consolidacionDeshabilitada =
    !escenarioActivo ||
    escenarioConsolidado ||
    metricasEscenario.propuestasBloqueadas > 0 ||
    propuestas.length === 0 ||
    Boolean(operacionEnCurso);

  const tooltipConsolidacion = !escenarioActivo
    ? 'Selecciona o crea un escenario primero'
    : escenarioConsolidado
    ? 'Este escenario ya se encuentra CONSOLIDADO'
    : propuestas.length === 0
    ? 'El escenario no tiene propuestas de calce para consolidar'
    : metricasEscenario.propuestasBloqueadas > 0
    ? `Bloqueado: existen ${metricasEscenario.propuestasBloqueadas} propuestas con impedimento normativo o egreso en trámite`
    : 'Ejecutar transacción atómica de consolidación territorial';

  return (
    <div className="space-y-4">
      {/* Feedback Toast */}
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm ${
            feedback.tipo === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.mensaje}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cabecera Ejecutiva */}
      <div className="card-elevated p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white flex items-center justify-center shadow-sm shrink-0">
              <ArrowRightLeft className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                  Mesa Territorial de Movilidad &amp; Calce SLEP {periodoActivo}
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Motor en Minutos Enteros
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Gestión centralizada de vacantes NN, egresos proyectados GDP, traslados prioritarios (Art. 42) y simulación What-If con rebotes balanceados.
              </p>
            </div>
          </div>

          {/* Botonera de Acciones Ejecutivas */}
          <div className="flex items-center gap-2 flex-wrap">
            {puedeEditarMovilidad && (
              <button
                type="button"
                onClick={() => {
                  setNuevoEscenarioNombre(`Escenario_Mesa_v${escenarios.length + 1}`);
                  setModalNuevoEscenario(true);
                }}
                disabled={Boolean(operacionEnCurso)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 text-indigo-600" />
                <span>Nuevo Escenario</span>
              </button>
            )}

            {puedeEditarMovilidad && escenarioActivo && (
              <button
                type="button"
                onClick={() => {
                  setClonarEscenarioNombre(`${escenarioActivo.nombre} (Copia)`);
                  setModalClonarEscenario(true);
                }}
                disabled={Boolean(operacionEnCurso)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Clonar</span>
              </button>
            )}

            {puedeEditarMovilidad && (
              <button
                type="button"
                onClick={handleAbrirEscaneoNn}
                disabled={Boolean(operacionEnCurso)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
              >
                <ScanSearch className="w-3.5 h-3.5 text-amber-600" />
                <span>Escanear y Sanear NN</span>
              </button>
            )}

            {puedeConsolidar && (
              <button
                type="button"
                onClick={() => setModalConsolidar(true)}
                disabled={consolidacionDeshabilitada}
                title={tooltipConsolidacion}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Consolidar Escenario Aprobado</span>
              </button>
            )}
          </div>
        </div>

        {/* KPIs Ejecutivos en tabular-nums */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200/80">
          <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
              Vacantes NN Activas
            </div>
            <div className="mt-1 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-black text-amber-900">{kpis.vacantesActivas}</span>
              <span className="text-[11px] font-semibold text-amber-700">
                ({kpis.vacantesCondicionales} condicionales)
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
              Egresos Proyectados GDP
            </div>
            <div className="mt-1 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-black text-rose-900">{egresos.length}</span>
              <span className="text-[11px] font-semibold text-rose-700">
                {kpis.egresosConfirmados} confirmados · {kpis.egresosEnTramite} en trámite
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
              Solicitudes en Cola
            </div>
            <div className="mt-1 flex items-baseline gap-2 tabular-nums">
              <span className="text-2xl font-black text-indigo-900">{kpis.solicitudesActivas}</span>
              <span className="text-[11px] font-semibold text-indigo-700">
                de {kpis.totalSolicitudes} totales · {remanentes.length} remanentes
              </span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate">
              Escenario: {escenarioActivo ? escenarioActivo.nombre : 'Sin escenario'}
            </div>
            <div className="mt-1 flex items-center gap-2 text-[11px] font-bold tabular-nums flex-wrap">
              <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
                Válidas: {metricasEscenario.propuestasValidas}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
                Bloq.: {metricasEscenario.propuestasBloqueadas}
              </span>
              <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
                Rebotes: {metricasEscenario.rebotesGenerados}
              </span>
            </div>
          </div>
        </div>

        {/* Selector de Modo del Módulo */}
        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
          <button
            type="button"
            onClick={() => setVistaInternaMesa('tablero')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              vistaInternaMesa === 'tablero'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Tablero de Calce Territorial (3 Columnas)</span>
          </button>
          <button
            type="button"
            onClick={() => setVistaInternaMesa('analisis_no_continuidad')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
              vistaInternaMesa === 'analisis_no_continuidad'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
            }`}
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Análisis &amp; Exportación No Continuidad (Docentes y AA.EE.)</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
              vistaInternaMesa === 'analisis_no_continuidad' ? 'bg-white/20 text-white' : 'bg-rose-200 text-rose-900'
            }`}>
              {casosNoContinuidadConsolidados.length}
            </span>
          </button>
        </div>
      </div>

      {/* ══ APARTADO: ANÁLISIS Y EXPORTACIÓN DE NO CONTINUIDAD (DOCENTES Y ASISTENTES) ══ */}
      {vistaInternaMesa === 'analisis_no_continuidad' && (
        <div className="space-y-4">
          <div className="card-elevated p-4 space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-600" />
                  <span>Análisis Territorial de Casos de No Continuidad ({casosNoContinuidadFiltrados.length})</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Consolidado de Docentes (Ley 20.903) y Asistentes de la Educación (Ley 21.109) con propuesta o solicitud de No Continuidad y sus fundamentos.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportarExcelNoContinuidad}
                disabled={exportandoNc || casosNoContinuidadFiltrados.length === 0}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{exportandoNc ? 'Exportando...' : 'Exportar Excel (.xlsx)'}</span>
              </button>
            </div>

            {/* KPIs Analíticos */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-[10px] font-bold uppercase text-slate-500">Total Casos</div>
                <div className="text-xl font-black text-slate-900 tabular-nums mt-0.5">{casosNoContinuidadFiltrados.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
                <div className="text-[10px] font-bold uppercase text-indigo-800">Docentes</div>
                <div className="text-xl font-black text-indigo-900 tabular-nums mt-0.5">{resumenNoContinuidad.docentesCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200">
                <div className="text-[10px] font-bold uppercase text-teal-800">Asistentes (AA.EE.)</div>
                <div className="text-xl font-black text-teal-900 tabular-nums mt-0.5">{resumenNoContinuidad.asistentesCount}</div>
              </div>
              <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
                <div className="text-[10px] font-bold uppercase text-amber-800">Horas Totales</div>
                <div className="text-xl font-black text-amber-900 tabular-nums mt-0.5">{resumenNoContinuidad.horasTotales}h</div>
              </div>
              <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
                <div className="text-[10px] font-bold uppercase text-rose-800">Titulares / Indefinidos</div>
                <div className="text-xl font-black text-rose-900 tabular-nums mt-0.5">
                  {resumenNoContinuidad.conResguardoEstabilidad}
                </div>
              </div>
            </div>

            {/* Desglose por Tipo de Escuela y Top Razones */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Distribución por Tipo de Establecimiento
                </div>
                {resumenNoContinuidad.porTipoEscuela.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin registros con los filtros actuales.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {resumenNoContinuidad.porTipoEscuela.map(([tipo, data]) => (
                      <span key={tipo} className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-xs font-bold text-slate-800 tabular-nums">
                        {tipo}: {data.cantidad} ({data.horas}h)
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                  Principales Razones Registradas ({resumenNoContinuidad.sinRazonCount} sin razón)
                </div>
                {resumenNoContinuidad.topRazones.length === 0 ? (
                  <p className="text-xs text-slate-400">Sin razones registradas.</p>
                ) : (
                  <div className="space-y-1">
                    {resumenNoContinuidad.topRazones.map(([razon, cnt]) => (
                      <div key={razon} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-slate-700 truncate">{razon}</span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 font-black text-[10px] tabular-nums shrink-0">
                          {cnt}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Filtros */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              <div className="relative md:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={busquedaNcAnalisis}
                  onChange={e => setBusquedaNcAnalisis(e.target.value)}
                  placeholder="Buscar por nombre, RUN, escuela, especialidad o razón..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
                />
              </div>

              <select
                value={filtroEstamentoNc}
                onChange={e => setFiltroEstamentoNc(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="TODOS">Todos los estamentos</option>
                <option value="DOCENTE">Solo Docentes</option>
                <option value="ASISTENTE">Solo Asistentes (AA.EE.)</option>
              </select>

              <select
                value={filtroTipoEscuelaNc}
                onChange={e => setFiltroTipoEscuelaNc(e.target.value)}
                className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
              >
                <option value="TODOS">Todo tipo de escuela</option>
                <option value="CAT:ESCUELA">Escuelas</option>
                <option value="CAT:LICEO">Liceos</option>
                <option value="CAT:JARDIN_VTF">Jardines / Salas Cuna VTF</option>
                <option value="ESCUELA_BASICA">Escuela Básica</option>
                <option value="LICEO_HC">Liceo HC</option>
                <option value="LICEO_TP">Liceo TP</option>
                <option value="LICEO_POLIVALENTE">Liceo Polivalente</option>
                <option value="ESCUELA_ESPECIAL">Escuela Especial</option>
                <option value="EPJA">EPJA</option>
              </select>

              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={filtroComunaNc}
                  onChange={e => setFiltroComunaNc(e.target.value)}
                  className="px-2 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="TODAS">Comunas</option>
                  {comunasDisponibles.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <select
                  value={filtroRazonNc}
                  onChange={e => setFiltroRazonNc(e.target.value as any)}
                  className="px-2 py-1.5 text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                >
                  <option value="TODAS">Razón: Todas</option>
                  <option value="CON_RAZON">Con razón</option>
                  <option value="SIN_RAZON">Sin razón</option>
                </select>
              </div>
            </div>

            {/* Tabla de Casos */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-slate-100 text-slate-700 font-black uppercase text-[10px]">
                  <tr>
                    <th className="p-2.5">Estamento</th>
                    <th className="p-2.5">Funcionario / RUN</th>
                    <th className="p-2.5">Establecimiento / Tipo</th>
                    <th className="p-2.5">Calidad / Horas</th>
                    <th className="p-2.5">Cargo / Especialidad</th>
                    <th className="p-2.5">Propuesta / Estado</th>
                    <th className="p-2.5">Razón / Fundamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {casosNoContinuidadFiltrados.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        No se registran casos de No Continuidad para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    casosNoContinuidadFiltrados.map(item => (
                      <tr key={item.id} className="hover:bg-slate-50/80">
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                            item.estamentoTipo === 'DOCENTE'
                              ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                              : 'bg-teal-50 text-teal-800 border-teal-200'
                          }`}>
                            {item.estamentoTipo === 'DOCENTE' ? 'Docente' : 'Asistente'}
                          </span>
                        </td>
                        <td className="p-2.5">
                          <div className="font-bold text-slate-900">{item.nombreCompleto}</div>
                          <div className="text-[11px] font-mono text-slate-500">{item.run}</div>
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-800">{item.establecimientoNombre}</div>
                          <div className="text-[10px] text-slate-500">
                            {etiquetaCategoriaEscuela(item.categoriaEscuela)} · {item.comuna} · RBD {item.rbd}
                          </div>
                        </td>
                        <td className="p-2.5 tabular-nums">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            item.calidadJuridica === 'TITULAR' || item.calidadJuridica === 'INDEFINIDO'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}>
                            {item.calidadJuridica}
                          </span>
                          <div className="text-[11px] font-black text-slate-800 mt-0.5">{item.horasContrato}h</div>
                          <div className="text-[10px] text-slate-500">{item.fuenteFinanciamiento}</div>
                        </td>
                        <td className="p-2.5 text-slate-700">{item.cargoEspecialidad}</td>
                        <td className="p-2.5">
                          <div className="font-bold text-rose-700">{item.propuestaGdp}</div>
                          <div className="text-[10px] text-slate-500">{item.situacionFinalGdp}</div>
                        </td>
                        <td className="p-2.5 max-w-xs">
                          <span className={item.tieneRazon ? 'text-slate-800' : 'text-amber-700 italic'}>
                            {item.razon}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Layout Principal de 3 Columnas */}
      {vistaInternaMesa === 'tablero' && (
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* ══ COLUMNA 1: Cola de Movilidad & Egresos Proyectados ══ */}
        <section className="xl:col-span-4 card-elevated p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-indigo-600" />
              <span>1. Cola de Movilidad &amp; Egresos</span>
            </h2>
            {cargando && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
          </div>

          {/* Sub-pestañas condicionales según Feature Flags */}
          <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
            {flags.flag_no_continuidad_titulares && (
              <button
                type="button"
                onClick={() => setTabCol1('no_continuidad')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  tabCol1 === 'no_continuidad'
                    ? 'bg-white text-rose-700 shadow-xs border border-rose-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                No Continuidad ({solicitudesNoContinuidad.length})
              </button>
            )}

            {flags.flag_traslados_voluntarios && (
              <button
                type="button"
                onClick={() => setTabCol1('traslados')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  tabCol1 === 'traslados'
                    ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Traslados ({solicitudesTraslados.length})
              </button>
            )}

            <button
              type="button"
              onClick={() => setTabCol1('remanentes')}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                tabCol1 === 'remanentes'
                  ? 'bg-white text-amber-800 shadow-xs border border-amber-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Remanentes ({remanentes.length})
            </button>

            {flags.flag_egresos_contingencia && (
              <button
                type="button"
                onClick={() => setTabCol1('egresos_gdp')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  tabCol1 === 'egresos_gdp'
                    ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Egresos GDP ({egresos.length})
              </button>
            )}
          </div>

          {/* ── Subtab: No Continuidad Titulares (Art. 42) ── */}
          {tabCol1 === 'no_continuidad' && flags.flag_no_continuidad_titulares && (
            <div className="space-y-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-black block">Protección Art. 42 Estatuto Docente</span>
                  <span>
                    Prohibición estricta de menoscabo en horas titulares y remuneración. Prioridad territorial crítica (&ge; 1000 pts).
                  </span>
                </div>
              </div>

              {puedeEditarMovilidad && (
                <form onSubmit={handleCrearNoContinuidad} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="text-[11px] font-bold text-slate-700">
                    Ingreso Rápido Titular Sin Continuidad
                  </div>
                  <input
                    type="text"
                    value={busquedaTitularNc}
                    onChange={e => setBusquedaTitularNc(e.target.value)}
                    placeholder="Buscar titular por nombre, RUN o escuela..."
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  />
                  <select
                    value={docenteNcId}
                    onChange={e => setDocenteNcId(e.target.value)}
                    required
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="">Selecciona docente titular...</option>
                    {titularesDisponiblesNc.map(d => (
                      <option key={d.id} value={d.id}>
                        {d.nombres} {d.apellidos} ({d.run}) — {d.horasContrato}h · {colegiosByRbd.get(d.rbd)?.nombre || d.rbd}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <select
                      value={comunaDestNc}
                      onChange={e => setComunaDestNc(e.target.value)}
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="">Comuna destino (cualquiera)</option>
                      {comunasDisponibles.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={fundamentoNc}
                      onChange={e => setFundamentoNc(e.target.value)}
                      placeholder="Motivo / fusión / reducción"
                      className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={!docenteNcId || Boolean(operacionEnCurso)}
                    className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
                  >
                    Agregar a Cola Art. 42
                  </button>
                </form>
              )}

              <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
                {solicitudesNoContinuidad.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No hay titulares en cola de no continuidad para el periodo {periodoActivo}.
                  </p>
                ) : (
                  solicitudesNoContinuidad.map(sol => {
                    const seleccionado = origenSeleccionado?.solicitudMovilidadId === sol.id;
                    const badgeFlujo = ETIQUETAS_FLUJO[sol.estadoFlujo];
                    const idxFlujo = FLUJO_MOVILIDAD_SECUENCIA.indexOf(sol.estadoFlujo);
                    const puedeAvanzar = idxFlujo >= 0 && idxFlujo < FLUJO_MOVILIDAD_SECUENCIA.length - 1;
                    return (
                      <div
                        key={sol.id}
                        className={`p-3 rounded-xl border transition-all space-y-2 ${
                          seleccionado
                            ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-slate-900">{sol.nombreDocente}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {sol.runDocente} · {colegiosByRbd.get(sol.rbdOrigen)?.nombre || sol.rbdOrigen}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 tabular-nums shrink-0">
                            Pts {sol.puntajePrioridadTotal}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={`px-2 py-0.5 rounded font-bold border ${badgeFlujo.badgeClass}`}>
                            {badgeFlujo.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold tabular-nums">
                            {sol.horasTitularesActuales}h Titulares / {sol.horasContratoActual}h Total
                          </span>
                          {sol.asignaturaPrincipal && (
                            <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                              {sol.asignaturaPrincipal}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              setOrigenSeleccionado({
                                docenteId: sol.docenteId,
                                solicitudMovilidadId: sol.id,
                                nombreDocente: sol.nombreDocente,
                                runDocente: sol.runDocente,
                                rbdOrigen: sol.rbdOrigen,
                                carrilLabel: 'No Continuidad Art. 42',
                                horas: sol.horasDisponiblesMover,
                                calidadJuridica: sol.calidadJuridica,
                                asignatura: sol.asignaturaPrincipal,
                                aplicaArticulo69: sol.aplicaArticulo69
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                              seleccionado
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {seleccionado ? '✓ Origen Activo' : 'Seleccionar Origen'}
                          </button>

                          <div className="flex items-center gap-1">
                            {puedeEditarMovilidad && puedeAvanzar && (
                              <button
                                type="button"
                                onClick={() => handleAvanzarFlujo(sol)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                                title="Avanzar siguiente etapa de flujo"
                              >
                                <span>Avanzar</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {puedeEliminarMovilidad && sol.estadoFlujo !== 'CONSOLIDADO' && (
                              <button
                                type="button"
                                onClick={() => handleEliminarSolicitud(sol)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Eliminar solicitud"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── Subtab: Traslados Voluntarios ── */}
          {tabCol1 === 'traslados' && flags.flag_traslados_voluntarios && (
            <div className="space-y-3">
              {puedeEditarMovilidad && (
                <button
                  type="button"
                  onClick={() => setModalTrasladoAbierto(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Nueva Solicitud de Traslado (Rúbrica Ponderada)</span>
                </button>
              )}

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {solicitudesTraslados.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    No existen solicitudes de traslado voluntario registradas.
                  </p>
                ) : (
                  solicitudesTraslados.map(sol => {
                    const seleccionado = origenSeleccionado?.solicitudMovilidadId === sol.id;
                    const badgeFlujo = ETIQUETAS_FLUJO[sol.estadoFlujo];
                    const idxFlujo = FLUJO_MOVILIDAD_SECUENCIA.indexOf(sol.estadoFlujo);
                    const puedeAvanzar = idxFlujo >= 0 && idxFlujo < FLUJO_MOVILIDAD_SECUENCIA.length - 1;

                    return (
                      <div
                        key={sol.id}
                        className={`p-3 rounded-xl border transition-all space-y-2 ${
                          seleccionado
                            ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-slate-900">{sol.nombreDocente}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {sol.runDocente} · {colegiosByRbd.get(sol.rbdOrigen)?.nombre || sol.rbdOrigen}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 tabular-nums shrink-0">
                            Pts {sol.puntajePrioridadTotal}
                          </span>
                        </div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          <span className={`px-2 py-0.5 rounded font-bold border ${badgeFlujo.badgeClass}`}>
                            {badgeFlujo.label}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold tabular-nums">
                            {sol.horasContratoActual}h · {sol.calidadJuridica}
                          </span>
                          {sol.comunaDestinoPreferente && (
                            <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-semibold">
                              Destino: {sol.comunaDestinoPreferente}
                            </span>
                          )}
                        </div>

                        <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 tabular-nums">
                          <span>Karin: {sol.puntajeLeyKarin}</span>
                          <span>Salud: {sol.puntajeSalud}</span>
                          <span>Dep.: {sol.puntajeCuidadoDependientes}</span>
                          <span>Dist.: {sol.puntajeDistanciaRural}</span>
                          <span>Antig.: {sol.puntajeAntiguedad}</span>
                        </div>

                        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() =>
                              setOrigenSeleccionado({
                                docenteId: sol.docenteId,
                                solicitudMovilidadId: sol.id,
                                nombreDocente: sol.nombreDocente,
                                runDocente: sol.runDocente,
                                rbdOrigen: sol.rbdOrigen,
                                carrilLabel: 'Traslado Voluntario',
                                horas: sol.horasDisponiblesMover,
                                calidadJuridica: sol.calidadJuridica,
                                asignatura: sol.asignaturaPrincipal,
                                aplicaArticulo69: sol.aplicaArticulo69
                              })
                            }
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                              seleccionado
                                ? 'bg-indigo-600 text-white'
                                : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                            }`}
                          >
                            {seleccionado ? '✓ Origen Activo' : 'Seleccionar Origen'}
                          </button>

                          <div className="flex items-center gap-1">
                            {puedeEditarMovilidad && puedeAvanzar && (
                              <button
                                type="button"
                                onClick={() => handleAvanzarFlujo(sol)}
                                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                                title={`Avanzar a ${ETIQUETAS_FLUJO[FLUJO_MOVILIDAD_SECUENCIA[idxFlujo + 1]].label}`}
                              >
                                <span>Avanzar</span>
                                <ChevronRight className="w-3 h-3" />
                              </button>
                            )}
                            {puedeEliminarMovilidad && sol.estadoFlujo !== 'CONSOLIDADO' && (
                              <button
                                type="button"
                                onClick={() => handleEliminarSolicitud(sol)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Eliminar solicitud"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── Subtab: Docentes con Horas Remanentes ── */}
          {tabCol1 === 'remanentes' && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2">
                <select
                  value={filtroTipoEscuelaRemanente}
                  onChange={e => setFiltroTipoEscuelaRemanente(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-300 rounded-xl"
                  title="Filtrar docentes con horas remanentes por tipo de establecimiento"
                >
                  <option value="TODOS">Tipo de Escuela: Todos ({remanentes.length})</option>
                  <option value="CAT:ESCUELA">Escuelas (Básica / Especial)</option>
                  <option value="CAT:LICEO">Liceos (HC / TP / Polivalente)</option>
                  <option value="CAT:JARDIN_VTF">Jardines y Salas Cuna VTF</option>
                  <option value="ESCUELA_BASICA">Escuela Básica</option>
                  <option value="LICEO_HC">Liceo HC</option>
                  <option value="LICEO_TP">Liceo TP</option>
                  <option value="LICEO_POLIVALENTE">Liceo Polivalente</option>
                  <option value="ESCUELA_ESPECIAL">Escuela Especial</option>
                  <option value="EPJA">EPJA (Adultos)</option>
                </select>
                {filtroTipoEscuelaRemanente !== 'TODOS' && (
                  <button
                    type="button"
                    onClick={() => setFiltroTipoEscuelaRemanente('TODOS')}
                    className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
                  >
                    Limpiar
                  </button>
                )}
              </div>

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
              {remanentesFiltrados.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No se detectaron docentes titulares con horas lectivas subutilizadas para el tipo seleccionado.
                </p>
              ) : (
                remanentesFiltrados.map(item => {
                  const seleccionado =
                    !origenSeleccionado?.solicitudMovilidadId &&
                    origenSeleccionado?.docenteId === item.docente.id;
                  return (
                    <div
                      key={item.docente.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        seleccionado
                          ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {item.docente.nombres} {item.docente.apellidos}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {item.docente.run} · {item.establecimiento?.nombre || item.docente.rbd}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 tabular-nums shrink-0">
                          +{item.horasRemanentes}h Libres
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-600 tabular-nums">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">
                          Contrato: {item.horasContrato}h
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">
                          Aula: {item.horasAsignadas} / {item.horasLectivasMax} HA
                        </span>
                        {item.docente.asignaturaPrincipal && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                            {item.docente.asignaturaPrincipal}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOrigenSeleccionado({
                            docenteId: item.docente.id,
                            nombreDocente: `${item.docente.nombres} ${item.docente.apellidos}`.trim(),
                            runDocente: item.docente.run,
                            rbdOrigen: item.docente.rbd,
                            carrilLabel: 'Horas Remanentes',
                            horas: item.horasRemanentes,
                            calidadJuridica: item.docente.calidadJuridica,
                            asignatura: item.docente.asignaturaPrincipal,
                            aplicaArticulo69: item.docente.aplicaArticulo69
                          })
                        }
                        className={`w-full py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                          seleccionado
                            ? 'bg-indigo-600 text-white'
                            : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {seleccionado ? '✓ Origen Seleccionado' : 'Usar Remanente como Origen'}
                      </button>
                    </div>
                  );
                })
              )}
              </div>
            </div>
          )}

          {/* ── Subtab: Egresos Proyectados GDP ── */}
          {tabCol1 === 'egresos_gdp' && flags.flag_egresos_contingencia && (
            <div className="space-y-3">
              {puedeValidarGdp ? (
                <button
                  type="button"
                  onClick={abrirModalNuevoEgreso}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Registrar Egreso Proyectado (GDP)</span>
                </button>
              ) : (
                <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span>Solo Validador GDP, Subdirector UATP o Super Usuario puede registrar o modificar egresos.</span>
                </div>
              )}

              <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
                {egresos.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">
                    Sin egresos proyectados registrados para {periodoActivo}.
                  </p>
                ) : (
                  egresos.map(eg => {
                    const causalLabel = CAUSALES_EGRESO_OPCIONES.find(c => c.id === eg.causal)?.label || eg.causal;
                    const esConfirmado = eg.certeza === 'confirmado';
                    return (
                      <div key={eg.id} className="p-3 rounded-xl bg-white border border-slate-200 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-xs font-black text-slate-900">{eg.nombreDocente}</div>
                            <div className="text-[11px] font-mono text-slate-500">
                              {eg.runDocente} · {colegiosByRbd.get(eg.rbd)?.nombre || eg.rbd}
                            </div>
                          </div>
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-black tabular-nums">
                            {eg.horasLiberadas}h
                          </span>
                        </div>

                        <div className="text-[11px] font-semibold text-slate-700">{causalLabel}</div>

                        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                          {esConfirmado ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                              Confirmado {eg.numeroDecreto ? `· Dec. ${eg.numeroDecreto}` : ''} {eg.fechaCese ? `· ${eg.fechaCese}` : ''}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                              En Trámite (Vacante Condicional)
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 rounded font-bold border ${
                              eg.impactoPresupuestario === 'con_recuperacion_sil'
                                ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                                : eg.impactoPresupuestario === 'costo_doble_pendiente'
                                ? 'bg-rose-50 text-rose-800 border-rose-200'
                                : 'bg-slate-50 text-slate-700 border-slate-200'
                            }`}
                          >
                            {eg.impactoPresupuestario === 'con_recuperacion_sil'
                              ? 'Con Recuperación SIL'
                              : eg.impactoPresupuestario === 'costo_doble_pendiente'
                              ? 'Costo Doble Pendiente'
                              : 'Sin Impacto Doble'}
                          </span>
                        </div>

                        {eg.causal === 'art_19s_no_avance' && eg.excepcionJubilacion3Anios && (
                          <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-800 font-semibold">
                            Excepción ≤ 3 años de jubilación (Art. 19 S): NO libera vacante.
                          </div>
                        )}

                        {puedeValidarGdp && (
                          <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                            <button
                              type="button"
                              onClick={() => abrirModalEditarEgreso(eg)}
                              className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEliminarEgreso(eg)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Eliminar egreso"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </section>

        {/* ══ COLUMNA 2: Lienzo de Simulación & Escenarios What-If ══ */}
        <section className="xl:col-span-4 card-elevated p-4 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-600" />
              <span>2. Simulador What-If &amp; Calces</span>
            </h2>
            {escenarioActivo && (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${
                  escenarioConsolidado
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                }`}
              >
                {escenarioActivo.estado}
              </span>
            )}
          </div>

          {/* Selector de Escenario + Calce Automático */}
          <div className="space-y-2">
            <select
              value={escenarioActivoId}
              onChange={e => setEscenarioActivoId(e.target.value)}
              className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
            >
              {escenarios.length === 0 ? (
                <option value="">Sin escenarios creados (crea uno en cabecera)</option>
              ) : (
                escenarios.map(esc => (
                  <option key={esc.id} value={esc.id}>
                    {esc.nombre} [{esc.estado}]
                  </option>
                ))
              )}
            </select>

            {flags.flag_simulador_calce_automatico && puedeEditarMovilidad && (
              <button
                type="button"
                onClick={handleSugerirCalcesAutomaticos}
                disabled={!escenarioActivo || escenarioConsolidado || Boolean(operacionEnCurso)}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-45"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Sugerir Calces Automáticos</span>
              </button>
            )}
          </div>

          {/* Panel Constructor de Calce Manual */}
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
              Constructor de Calce Manual
            </div>

            <div className="grid grid-cols-1 gap-2">
              <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Origen (Col. 1)</span>
                  {origenSeleccionado && (
                    <button
                      type="button"
                      onClick={() => setOrigenSeleccionado(null)}
                      className="text-[10px] text-rose-600 font-bold hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {origenSeleccionado ? (
                  <div className="mt-0.5">
                    <div className="font-bold text-slate-900">{origenSeleccionado.nombreDocente}</div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {origenSeleccionado.carrilLabel} · {origenSeleccionado.horas}h ({Math.round(origenSeleccionado.horas * 60)} min) · {origenSeleccionado.calidadJuridica}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic mt-0.5">
                    Selecciona un docente o solicitud en Columna 1
                  </div>
                )}
              </div>

              <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase text-slate-400">Vacante Destino (Col. 3)</span>
                  {vacanteDestinoSeleccionada && (
                    <button
                      type="button"
                      onClick={() => setVacanteDestinoId('')}
                      className="text-[10px] text-rose-600 font-bold hover:underline"
                    >
                      Quitar
                    </button>
                  )}
                </div>
                {vacanteDestinoSeleccionada ? (
                  <div className="mt-0.5">
                    <div className="font-bold text-slate-900">
                      {vacanteDestinoSeleccionada.asignaturaPrincipal || vacanteDestinoSeleccionada.nombres}
                    </div>
                    <div className="text-[11px] text-slate-500 tabular-nums">
                      {colegiosByRbd.get(vacanteDestinoSeleccionada.rbd)?.nombre || vacanteDestinoSeleccionada.rbd} ·{' '}
                      {vacanteDestinoSeleccionada.horasContrato}h ({Math.round(vacanteDestinoSeleccionada.horasContrato * 60)} min) ·{' '}
                      {inferirFuenteVacante(vacanteDestinoSeleccionada)}
                    </div>
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 italic mt-0.5">
                    Selecciona una vacante NN en Columna 3
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
                  Tipo de Cobertura
                </label>
                <select
                  value={tipoCobertura}
                  onChange={e => setTipoCobertura(e.target.value as 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL')}
                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
                >
                  <option value="DEFINITIVA">Definitiva (Titular/Planta)</option>
                  <option value="TRANSITORIA_CONDICIONAL">Transitoria / Condicional</option>
                </select>
              </div>

              <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer self-end">
                <input
                  type="checkbox"
                  checked={esTrasladoCompleto}
                  onChange={e => setEsTrasladoCompleto(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600"
                />
                <span className="text-[11px] font-bold text-slate-700 leading-tight">
                  Traslado completo (genera NN-Rebote)
                </span>
              </label>
            </div>

            {puedeEditarMovilidad && (
              <button
                type="button"
                onClick={handleSimularYAgregar}
                disabled={
                  !escenarioActivo ||
                  escenarioConsolidado ||
                  !origenSeleccionado ||
                  !vacanteDestinoSeleccionada ||
                  Boolean(operacionEnCurso)
                }
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
              >
                Simular y Agregar al Escenario
              </button>
            )}
          </div>

          {/* Lista de Propuestas del Escenario */}
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
            {propuestas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Sin propuestas simuladas en este escenario.
              </p>
            ) : (
              propuestas.map(prop => {
                const estOrigen = colegiosByRbd.get(prop.rbdOrigen);
                const estDestino = colegiosByRbd.get(prop.rbdDestino);
                const barraColor =
                  prop.indiceCompatibilidad >= 75
                    ? 'bg-emerald-500'
                    : prop.indiceCompatibilidad >= 50
                    ? 'bg-amber-500'
                    : 'bg-rose-500';
                const excede44hMin = prop.minutosAsignados > TOPE_MINUTOS_SEMANALES_SLEP;
                const minsLectivos = Math.round(prop.horasPedagogicasAula * 45);

                return (
                  <div
                    key={prop.id}
                    className={`p-3 rounded-xl border space-y-2 ${
                      prop.bloqueaConsolidacion
                        ? 'bg-rose-50/40 border-rose-300'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900">{prop.nombreDocente}</div>
                        <div className="text-[11px] text-slate-500">
                          {estOrigen?.nombre || prop.rbdOrigen} →{' '}
                          <span className="font-bold text-slate-800">{estDestino?.nombre || prop.rbdDestino}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                            prop.bloqueaConsolidacion
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : prop.estado === 'CONSOLIDADA'
                              ? 'bg-emerald-600 text-white border-emerald-700'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }`}
                        >
                          {prop.bloqueaConsolidacion ? 'BLOQUEADA' : prop.estado}
                        </span>
                        {puedeEditarMovilidad && !escenarioConsolidado && (
                          <button
                            type="button"
                            onClick={() => handleEliminarPropuesta(prop.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Eliminar propuesta"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Barra de Compatibilidad */}
                    <div>
                      <div className="flex items-center justify-between text-[10px] font-bold mb-1 tabular-nums">
                        <span className="text-slate-600">Índice de Compatibilidad</span>
                        <span className="text-slate-900">{prop.indiceCompatibilidad}%</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barraColor}`}
                          style={{ width: `${Math.min(100, Math.max(0, prop.indiceCompatibilidad))}%` }}
                        />
                      </div>
                    </div>

                    {/* Métricas en Minutos Enteros */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold border ${
                          excede44hMin
                            ? 'bg-rose-100 text-rose-800 border-rose-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {formatearMinutosAHoras(prop.minutosAsignados)} ({prop.minutosAsignados}/{TOPE_MINUTOS_SEMANALES_SLEP} min)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold">
                        {prop.horasPedagogicasAula} HA ({minsLectivos} min aula)
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                        {prop.fuenteDestino} · {prop.tipoCobertura === 'DEFINITIVA' ? 'Definitiva' : 'Transitoria'}
                      </span>
                      {prop.alertasNormativas.some(a => a.includes('Artículo 69') || a.includes('Art. 69')) && (
                        <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 font-bold border border-rose-300">
                          Excede Art. 69 (máx 32 HA / {MAX_MINUTOS_LECTIVOS_ART_69} min)
                        </span>
                      )}
                    </div>

                    {/* Alertas Normativas / Bloqueos */}
                    {(prop.motivoBloqueo || prop.alertasNormativas.length > 0) && (
                      <div className="space-y-1">
                        {prop.motivoBloqueo && (
                          <div className="p-2 rounded-lg bg-rose-100/80 border border-rose-300 text-[10px] text-rose-900 font-bold">
                            Bloqueo: {prop.motivoBloqueo}
                          </div>
                        )}
                        {prop.alertasNormativas.map((alerta, i) => (
                          <div
                            key={i}
                            className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900"
                          >
                            {alerta}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Tarjeta Visual Vacante de Rebote (NN-Rebote) */}
                    {prop.generaRebote && prop.vacanteRebote && (
                      <div className="p-2.5 rounded-xl bg-cyan-50/80 border border-cyan-300 space-y-1.5">
                        <div className="flex items-center justify-between text-[11px] font-black text-cyan-900">
                          <span>Vacante de Rebote (NN-Rebote)</span>
                          <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-[10px] tabular-nums">
                            Δ = {prop.vacanteRebote.deltaMinutosCadena} min
                          </span>
                        </div>
                        <div className="text-[10px] text-cyan-800 font-semibold tabular-nums">
                          Origen: {prop.vacanteRebote.nombreEstablecimientoOrigen || prop.vacanteRebote.rbdOrigen} ·{' '}
                          {prop.vacanteRebote.horasContratoRebote}h ({prop.vacanteRebote.minutosContratoRebote} min) ·{' '}
                          {prop.vacanteRebote.horasPedagogicasAula} HA · {prop.vacanteRebote.fuenteFinanciamiento}
                        </div>
                        {prop.vacanteRebote.asignacionesHeredadas.length > 0 && (
                          <div className="text-[10px] text-cyan-900">
                            <span className="font-bold">Aula heredada:</span>{' '}
                            {prop.vacanteRebote.asignacionesHeredadas
                              .map(a => `${a.asignatura} (${a.horasPedagogicasAula} HA)`)
                              .join(', ')}
                          </div>
                        )}
                        {prop.vacanteRebote.funcionesNoLectivasHeredadas.length > 0 && (
                          <div className="text-[10px] text-cyan-900">
                            <span className="font-bold">Funciones no lectivas heredadas:</span>{' '}
                            {prop.vacanteRebote.funcionesNoLectivasHeredadas
                              .map(f => `${f.nombre} (${f.horas}h)`)
                              .join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ══ COLUMNA 3: Bolsa de Vacantes NN y Rebotes ══ */}
        <section className="xl:col-span-4 card-elevated p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-amber-600" />
              <span>3. Bolsa de Vacantes NN ({vacantesFiltradas.length})</span>
            </h2>
          </div>

          {/* Filtros de Vacantes */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={busquedaVacante}
                onChange={e => setBusquedaVacante(e.target.value)}
                placeholder="Buscar por especialidad, escuela, RBD o comuna..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <select
                value={filtroTipoVacante}
                onChange={e => setFiltroTipoVacante(e.target.value as any)}
                className="px-2 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="TODAS">Todos los tipos</option>
                <option value="NN_DETECTADO">NN Detectado</option>
                <option value="NECESIDAD_ESCUELA">Necesidad Escuela</option>
                <option value="CONDICIONAL_EGRESO">Condicional Egreso</option>
                <option value="REBOTE_MOVILIDAD">NN-Rebote</option>
              </select>

              <select
                value={filtroComunaVacante}
                onChange={e => setFiltroComunaVacante(e.target.value)}
                className="px-2 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="TODAS">Todas comunas</option>
                {comunasDisponibles.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>

              <select
                value={filtroFuenteVacante}
                onChange={e => setFiltroFuenteVacante(e.target.value as any)}
                className="px-2 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-200 rounded-lg"
              >
                <option value="TODAS">Todas fuentes</option>
                <option value="SUBVENCION_GENERAL">Subv. General</option>
                <option value="SEP">SEP</option>
                <option value="PIE">PIE</option>
              </select>
            </div>
          </div>

          {/* Lista de Tarjetas Clickeables */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {vacantesFiltradas.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No hay vacantes NN que coincidan con los filtros actuales.
              </div>
            ) : (
              vacantesFiltradas.map(v => {
                const est = colegiosByRbd.get(v.rbd);
                const tipo: TipoVacanteDocente = v.tipoVacante || 'NN_DETECTADO';
                const tipoMeta = ETIQUETAS_TIPO_VACANTE[tipo];
                const fuente = inferirFuenteVacante(v);
                const seleccionada = vacanteDestinoId === v.id;
                const resumenAsig = asignaturasPorCubrirPorVacante.get(v.id);
                const directas = resumenAsig?.directas || [];
                const deficit = resumenAsig?.deficitEstablecimiento || [];

                return (
                  <div
                    key={v.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setVacanteDestinoId(seleccionada ? '' : v.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setVacanteDestinoId(seleccionada ? '' : v.id);
                      }
                    }}
                    className={`w-full text-left p-3 rounded-xl border transition-all space-y-1.5 cursor-pointer ${
                      seleccionada
                        ? 'bg-indigo-50/80 border-indigo-500 ring-1 ring-indigo-300 shadow-xs'
                        : v.vacanteCondicional
                        ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900">
                          {v.asignaturaPrincipal || `${v.nombres} ${v.apellidos}`}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {est?.nombre || `RBD ${v.rbd}`} {est?.comuna ? `· ${est.comuna}` : ''}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-slate-900 text-white text-[11px] font-black tabular-nums shrink-0">
                        {v.horasContrato}h
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span className={`px-1.5 py-0.5 rounded font-bold border ${tipoMeta.className}`}>
                        {tipoMeta.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold">
                        {fuente === 'SUBVENCION_GENERAL' ? 'Subv. General' : fuente}
                      </span>
                      <span className="font-mono text-slate-400">{v.run}</span>
                    </div>

                    {/* Asignaturas por cubrir */}
                    {(directas.length > 0 || deficit.length > 0) && (
                      <div className="pt-1 space-y-1">
                        <div className="flex flex-wrap gap-1">
                          {directas.slice(0, 3).map((d, idx) => (
                            <span
                              key={`${v.id}-dir-${idx}`}
                              className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold tabular-nums"
                            >
                              {d.asignatura} · {d.horasPedagogicas} HA ({d.cursoNombre})
                            </span>
                          ))}
                          {directas.length === 0 &&
                            deficit.slice(0, 3).map((def, idx) => (
                              <span
                                key={`${v.id}-def-${idx}`}
                                className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold tabular-nums"
                              >
                                Déficit: {def.asignatura} ({def.horasPorCubrir} HA)
                              </span>
                            ))}
                        </div>
                      </div>
                    )}

                    {v.vacanteCondicional && (
                      <div className="px-2 py-1 rounded-lg bg-rose-100 text-rose-900 border border-rose-300 text-[10px] font-black flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3 shrink-0" />
                        <span>Condicional — Solo Cobertura Transitoria</span>
                      </div>
                    )}

                    {v.justificacionVacante && (
                      <p className="text-[10px] text-slate-600 line-clamp-2">{v.justificacionVacante}</p>
                    )}

                    <div className="pt-1 flex items-center justify-between gap-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          setVacanteAsignaturasModal(v);
                        }}
                        className="inline-flex items-center gap-1 text-[10px] font-black text-indigo-700 hover:text-indigo-900 hover:underline"
                      >
                        <Eye className="w-3 h-3" />
                        <span>
                          Ver asignaturas por cubrir (
                          {directas.length > 0 ? `${directas.length} asig.` : `${deficit.length} déficit`})
                        </span>
                      </button>
                      <span className="text-[10px] font-semibold text-slate-400">
                        {seleccionada ? '✓ Seleccionada' : 'Clic para elegir'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
      )}

      {/* ══ MODAL: Nuevo Escenario ══ */}
      {modalNuevoEscenario && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleCrearEscenario}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">Nuevo Escenario What-If</h3>
              <button type="button" onClick={() => setModalNuevoEscenario(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nombre del Escenario</label>
                <input
                  type="text"
                  required
                  value={nuevoEscenarioNombre}
                  onChange={e => setNuevoEscenarioNombre(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Descripción (opcional)</label>
                <textarea
                  rows={2}
                  value={nuevoEscenarioDesc}
                  onChange={e => setNuevoEscenarioDesc(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalNuevoEscenario(false)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl"
              >
                Crear Escenario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ MODAL: Clonar Escenario ══ */}
      {modalClonarEscenario && escenarioActivo && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleClonarEscenario}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">Clonar Escenario "{escenarioActivo.nombre}"</h3>
              <button type="button" onClick={() => setModalClonarEscenario(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nombre de la Copia</label>
              <input
                type="text"
                required
                value={clonarEscenarioNombre}
                onChange={e => setClonarEscenarioNombre(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalClonarEscenario(false)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl"
              >
                Clonar Escenario
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ MODAL: Previsualización y Confirmación de Saneamiento NN ══ */}
      {modalPreviewNn && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <ScanSearch className="w-5 h-5 text-amber-600" />
                <h3 className="font-black text-slate-900 text-sm">
                  Previsualización de Saneamiento NN Territorial ({periodoActivo})
                </h3>
              </div>
              <button type="button" onClick={() => setModalPreviewNn(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            {cargandoPreviewNn ? (
              <div className="py-10 text-center text-xs text-slate-500">
                Analizando nómina territorial y dígito verificador Módulo 11...
              </div>
            ) : previewNnItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No se detectaron nuevos registros NN o ficticios pendientes de saneamiento.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {previewNnItems.map(item => (
                  <div key={item.docente.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold text-slate-900">
                        {item.docente.nombres} {item.docente.apellidos}{' '}
                        <span className="font-mono text-slate-500">({item.docente.run || 'Sin RUN'})</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black ${
                          item.confianza === 'ALTA'
                            ? 'bg-rose-100 text-rose-800'
                            : item.confianza === 'MEDIA'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}
                      >
                        Confianza {item.confianza}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {colegiosByRbd.get(item.docente.rbd)?.nombre || item.docente.rbd} · {item.docente.horasContrato}h ·{' '}
                      <span className="font-semibold text-indigo-700">
                        {item.asignacionesCount} asignaciones preservadas
                      </span>
                    </div>
                    <div className="text-[10px] text-amber-800">{item.motivos.join(' · ')}</div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <span className="text-[11px] text-slate-500">
                Las asignaciones horarias existentes se conservarán íntegras.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setModalPreviewNn(false)}
                  className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={cargandoPreviewNn || previewNnItems.length === 0 || Boolean(operacionEnCurso)}
                  onClick={handleConfirmarSaneamientoNn}
                  className="px-4 py-1.5 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl disabled:opacity-50"
                >
                  Confirmar Saneamiento ({previewNnItems.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Confirmación Atómica de Consolidación ══ */}
      {modalConsolidar && escenarioActivo && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-slate-100">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <FileCheck2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-sm">
                  Confirmar Consolidación Territorial Atómica
                </h3>
                <p className="text-[11px] text-slate-500">
                  Escenario: {escenarioActivo.nombre}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 space-y-1.5 tabular-nums">
              <div>• Propuestas válidas a ejecutar: <strong>{metricasEscenario.propuestasValidas}</strong></div>
              <div>• Vacantes NN de destino reemplazadas: <strong>{metricasEscenario.propuestasValidas}</strong></div>
              <div>• Vacantes NN-Rebote en escuelas de origen: <strong>{metricasEscenario.rebotesGenerados}</strong></div>
            </div>

            <p className="text-[11px] text-slate-600">
              Esta operación ejecutará una transacción atómica en SQLite y sincronizará los movimientos aprobados con las dotaciones de cada establecimiento involucrado.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalConsolidar(false)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarConsolidacion}
                disabled={Boolean(operacionEnCurso)}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl disabled:opacity-50"
              >
                Ejecutar Consolidación Definitiva
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ MODAL: Nueva Solicitud de Traslado con Rúbrica Ponderada ══ */}
      {modalTrasladoAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleGuardarTraslado}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                Nueva Solicitud de Traslado Voluntario (Rúbrica Ponderada)
              </h3>
              <button type="button" onClick={() => setModalTrasladoAbierto(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Docente Solicitante</label>
                <input
                  type="text"
                  value={busquedaDocTraslado}
                  onChange={e => setBusquedaDocTraslado(e.target.value)}
                  placeholder="Filtrar por nombre, RUN o establecimiento..."
                  className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg mb-1.5"
                />
                <select
                  required
                  value={docTrasladoId}
                  onChange={e => setDocTrasladoId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                >
                  <option value="">Selecciona docente...</option>
                  {docentesFiltradosTraslado.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.nombres} {d.apellidos} ({d.run}) — {d.horasContrato}h · {colegiosByRbd.get(d.rbd)?.nombre || d.rbd}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Comuna Destino Preferente</label>
                  <select
                    value={comunaDestTraslado}
                    onChange={e => setComunaDestTraslado(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="">Sin preferencia</option>
                    {comunasDisponibles.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Escuela Preferente (Opcional)</label>
                  <select
                    value={rbdDestTraslado}
                    onChange={e => setRbdDestTraslado(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  >
                    <option value="">Cualquier escuela</option>
                    {colegios.map(c => (
                      <option key={c.rbd} value={c.rbd}>{c.nombre} ({c.comuna})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between text-xs font-black text-indigo-900">
                  <span>Rúbrica Territorial Ponderada (0 - 100 pts)</span>
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white tabular-nums">
                    Total: {puntajeTrasladoPreview} pts
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                  <label className="block">
                    <span className="font-bold text-slate-700 block">Ley Karin (30%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={puntajeLeyKarin}
                      onChange={e => setPuntajeLeyKarin(Number(e.target.value))}
                      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded bg-white tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="font-bold text-slate-700 block">Salud (25%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={puntajeSalud}
                      onChange={e => setPuntajeSalud(Number(e.target.value))}
                      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded bg-white tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="font-bold text-slate-700 block">Depend. (20%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={puntajeDependientes}
                      onChange={e => setPuntajeDependientes(Number(e.target.value))}
                      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded bg-white tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="font-bold text-slate-700 block">Rural (15%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={puntajeDistanciaRural}
                      onChange={e => setPuntajeDistanciaRural(Number(e.target.value))}
                      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded bg-white tabular-nums"
                    />
                  </label>
                  <label className="block">
                    <span className="font-bold text-slate-700 block">Antig. (10%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={puntajeAntiguedad}
                      onChange={e => setPuntajeAntiguedad(Number(e.target.value))}
                      className="w-full mt-1 px-2 py-1 border border-slate-300 rounded bg-white tabular-nums"
                    />
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Fundamento / Antecedentes</label>
                <textarea
                  rows={2}
                  value={fundamentoTraslado}
                  onChange={e => setFundamentoTraslado(e.target.value)}
                  placeholder="Detalle clínico, Ley Karin, cercanía familiar o trayectoria..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalTrasladoAbierto(false)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!docTrasladoId || Boolean(operacionEnCurso)}
                className="px-4 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl disabled:opacity-50"
              >
                Guardar Solicitud
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ MODAL: Alta / Edición Egreso Proyectado GDP ══ */}
      {modalEgresoAbierto && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleGuardarEgreso}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full p-5 space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                {egresoEditId ? 'Editar Egreso Proyectado GDP' : 'Registrar Egreso Proyectado GDP'}
              </h3>
              <button type="button" onClick={() => setModalEgresoAbierto(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Docente</label>
                {!egresoEditId && (
                  <input
                    type="text"
                    value={busquedaDocEgreso}
                    onChange={e => setBusquedaDocEgreso(e.target.value)}
                    placeholder="Buscar docente por nombre, RUN o escuela..."
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg mb-1.5"
                  />
                )}
                <select
                  required
                  disabled={Boolean(egresoEditId)}
                  value={egresoDocId}
                  onChange={e => setEgresoDocId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl disabled:bg-slate-100"
                >
                  <option value="">Selecciona docente...</option>
                  {docentesFiltradosEgreso.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.nombres} {d.apellidos} ({d.run}) — {d.horasContrato}h · {colegiosByRbd.get(d.rbd)?.nombre || d.rbd}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Causal de Egreso</label>
                  <select
                    value={egresoCausal}
                    onChange={e => setEgresoCausal(e.target.value as CausalEgresoDocente)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  >
                    {CAUSALES_EGRESO_OPCIONES.map(c => (
                      <option key={c.id} value={c.id}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Certeza Jurídica</label>
                  <select
                    value={egresoCerteza}
                    onChange={e => setEgresoCerteza(e.target.value as CertezaJuridicaEgreso)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                  >
                    <option value="en_tramite">En Trámite (Vacante Condicional)</option>
                    <option value="confirmado">Confirmado (Decreto y Fecha de Cese)</option>
                  </select>
                </div>
              </div>

              {egresoCausal === 'art_19s_no_avance' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 space-y-1.5">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={egresoExcepcion3Anios}
                      onChange={e => setEgresoExcepcion3Anios(e.target.checked)}
                      className="mt-0.5 rounded border-amber-400 text-amber-700"
                    />
                    <span className="text-xs font-bold text-amber-950">
                      Excepción Art. 19 S: docente se encuentra a 3 años o menos de la edad legal de jubilación
                    </span>
                  </label>
                  {egresoExcepcion3Anios && (
                    <div className="text-[11px] text-rose-800 font-bold">
                      Alerta normativa: Al marcar esta excepción, el docente conserva su cargo y NO libera vacante.
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Fecha de Cese</label>
                  <input
                    type="date"
                    value={egresoFechaCese}
                    onChange={e => setEgresoFechaCese(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">N° Decreto / Resolución</label>
                  <input
                    type="text"
                    value={egresoDecreto}
                    onChange={e => setEgresoDecreto(e.target.value)}
                    placeholder="Ej: Res. Ex. N° 1245"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              {/* Evaluación Jurídica en vivo desde @slep/mineduc-engine */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                <div className="font-bold text-slate-800">
                  Evaluación Normativa Automática:
                </div>
                <div className="text-slate-600">
                  Libera vacante: <strong>{evaluacionEgresoPreview.liberaVacante ? 'Sí' : 'No'}</strong> ·{' '}
                  Condicional: <strong>{evaluacionEgresoPreview.esVacanteCondicional ? 'Sí' : 'No'}</strong> ·{' '}
                  Consolidación definitiva: <strong>{evaluacionEgresoPreview.permiteConsolidacionDefinitiva ? 'Habilitada' : 'Bloqueada'}</strong>
                </div>
                {evaluacionEgresoPreview.alertasNormativas.map((a, idx) => (
                  <div key={idx} className="text-amber-800">{a}</div>
                ))}
              </div>

              {evaluacionEgresoPreview.liberaVacante && (
                <label className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={egresoGenerarVacante}
                    onChange={e => setEgresoGenerarVacante(e.target.checked)}
                    className="rounded border-emerald-400 text-emerald-700"
                  />
                  <span className="text-xs font-bold text-emerald-900">
                    Generar vacante vinculada {evaluacionEgresoPreview.esVacanteCondicional ? '(condicional)' : ''} en Bolsa NN
                  </span>
                </label>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Observaciones GDP</label>
                <textarea
                  rows={2}
                  value={egresoObs}
                  onChange={e => setEgresoObs(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalEgresoAbierto(false)}
                className="px-3 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!egresoDocId || Boolean(operacionEnCurso)}
                className="px-4 py-1.5 text-xs font-bold bg-emerald-600 text-white rounded-xl disabled:opacity-50"
              >
                Guardar Egreso GDP
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ══ MODAL: Asignaturas por Cubrir de la Vacante ══ */}
      {vacanteAsignaturasModal && (() => {
        const est = colegiosByRbd.get(vacanteAsignaturasModal.rbd);
        const resumen = asignaturasPorCubrirPorVacante.get(vacanteAsignaturasModal.id);
        const directas = resumen?.directas || [];
        const deficit = resumen?.deficitEstablecimiento || [];
        return (
          <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full p-5 space-y-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-start justify-between gap-3 pb-2 border-b border-slate-100">
                <div>
                  <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-indigo-600" />
                    <span>Asignaturas por Cubrir — {vacanteAsignaturasModal.asignaturaPrincipal || `${vacanteAsignaturasModal.nombres} ${vacanteAsignaturasModal.apellidos}`}</span>
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {est?.nombre || `RBD ${vacanteAsignaturasModal.rbd}`} · {vacanteAsignaturasModal.horasContrato}h contrato · RUN {vacanteAsignaturasModal.run}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVacanteAsignaturasModal(null)}
                  className="p-1 text-slate-400 hover:text-slate-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="text-xs font-black text-slate-800 mb-1.5">
                    1. Asignaciones horarias vinculadas a esta vacante ({resumen?.totalHorasDirectas || 0} HA)
                  </div>
                  {directas.length === 0 ? (
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
                      Esta vacante no tiene cursos/asignaciones vinculadas directamente todavía. Especialidad declarada:{' '}
                      <strong className="text-slate-800">{vacanteAsignaturasModal.asignaturaPrincipal || 'No especificada'}</strong>.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                          <tr>
                            <th className="p-2">Asignatura</th>
                            <th className="p-2">Curso</th>
                            <th className="p-2 text-right">Horas Aula (HA)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {directas.map((d, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-bold text-slate-800">{d.asignatura}</td>
                              <td className="p-2 text-slate-600">{d.cursoNombre}</td>
                              <td className="p-2 text-right font-black tabular-nums">{d.horasPedagogicas} HA</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-black text-slate-800 mb-1.5">
                    2. Asignaturas con déficit curricular pendiente en el establecimiento ({deficit.length})
                  </div>
                  {deficit.length === 0 ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800">
                      No se detecta déficit curricular pendiente en los planes del establecimiento.
                    </div>
                  ) : (
                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-amber-50 text-[10px] font-black uppercase text-amber-900">
                          <tr>
                            <th className="p-2">Asignatura</th>
                            <th className="p-2 text-right">Plan (HA)</th>
                            <th className="p-2 text-right">Cubiertas (HA)</th>
                            <th className="p-2 text-right">Por Cubrir (HA)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {deficit.map((def, idx) => (
                            <tr key={idx}>
                              <td className="p-2 font-bold text-slate-800">{def.asignatura}</td>
                              <td className="p-2 text-right tabular-nums text-slate-600">{def.horasPlan}</td>
                              <td className="p-2 text-right tabular-nums text-slate-600">{def.horasCubiertas}</td>
                              <td className="p-2 text-right font-black tabular-nums text-rose-700">{def.horasPorCubrir} HA</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setVacanteDestinoId(vacanteAsignaturasModal.id);
                    setVacanteAsignaturasModal(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl"
                >
                  Seleccionar como Destino
                </button>
                <button
                  type="button"
                  onClick={() => setVacanteAsignaturasModal(null)}
                  className="px-3.5 py-1.5 text-xs font-bold bg-slate-100 text-slate-700 rounded-xl"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
