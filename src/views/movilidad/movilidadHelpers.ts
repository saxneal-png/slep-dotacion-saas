import {
  AsignacionHoraria,
  AsistenteEducacion,
  CausalEgresoDocente,
  CursoSae,
  Docente,
  Establecimiento,
  EstadoEscenarioCalce,
  EstadoFlujoMovilidad,
  EstadoResolucionRebote,
  EstamentoAsistente,
  SolicitudMovilidad,
  TipoVacanteDocente
} from '../../types';
import {
  clasificarCategoriaEstablecimiento,
  esPropuestaNoContinuidad,
  CategoriaTipoEstablecimiento
} from '../../services/estadisticasHorasService';
import { obtenerPlanPorCurso } from '@slep/mineduc-engine';
import {
  esRolValidadorGdp,
  esRolConsolidadorMovilidad
} from '../../services/movilidadTerritorialService';

export type SubTabCol1 =
  | 'no_continuidad'
  | 'traslados'
  | 'remanentes'
  | 'asistentes_indefinidos'
  | 'egresos_gdp';

export interface OrigenSeleccionado {
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
  estamentoPersonal?: 'DOCENTE' | 'ASISTENTE';
  categoriaAsistente?: EstamentoAsistente;
  horasTitulares?: number;
  horasContrata?: number;
}

export interface PreviewNnItem {
  docente: Docente;
  motivos: string[];
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
  asignacionesCount: number;
}

export interface RemanenteItem {
  docente: Docente;
  establecimiento?: Establecimiento;
  horasContrato: number;
  horasLectivasMax: number;
  horasAsignadas: number;
  horasRemanentes: number;
}

export interface AsistenteNoContinuidadItem {
  asistente: AsistenteEducacion;
  establecimiento?: Establecimiento;
  horasIndefinidas: number;
  horasPlazoFijo: number;
  razonGdp: string;
}

export interface CasoNoContinuidadItem {
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

export interface AsignaturaDirectaVacante {
  asignatura: string;
  cursoNombre: string;
  horasPedagogicas: number;
}

export interface DeficitAsignaturaColegio {
  asignatura: string;
  horasPlan: number;
  horasCubiertas: number;
  horasPorCubrir: number;
}

export interface ResumenAsignaturasVacante {
  directas: AsignaturaDirectaVacante[];
  totalHorasDirectas: number;
  deficitEstablecimiento: DeficitAsignaturaColegio[];
}

export interface StageGateStatus {
  numero: 1 | 2 | 3 | 4 | 5;
  titulo: string;
  subtitulo: string;
  abierta: boolean;
  estadoLabel: string;
  detalle: string;
}

export const FLUJO_MOVILIDAD_SECUENCIA: EstadoFlujoMovilidad[] = [
  'POSTULADO',
  'PRE_ASIGNADO',
  'NOTIFICADO_DIRECCION_ORIGEN',
  'ACEPTADO_CON_FIRMA',
  'CONSOLIDADO'
];

export const ETIQUETAS_FLUJO: Record<
  EstadoFlujoMovilidad,
  { label: string; badgeClass: string }
> = {
  POSTULADO: {
    label: 'Postulado',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300'
  },
  PRE_ASIGNADO: {
    label: 'Pre-Asignado',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200'
  },
  NOTIFICADO_DIRECCION_ORIGEN: {
    label: 'Notificado Dir. Origen',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300'
  },
  ACEPTADO_CON_FIRMA: {
    label: 'Aceptado con Firma',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200'
  },
  CONSOLIDADO: {
    label: 'Consolidado',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700'
  },
  RESOLUCION_EMITIDA: {
    label: 'Resolución Emitida',
    badgeClass: 'bg-cyan-600 text-white border-cyan-700'
  },
  RECHAZADO: {
    label: 'Rechazado',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200'
  }
};

export const ETIQUETAS_ESTADO_ESCENARIO: Record<
  EstadoEscenarioCalce,
  { label: string; badgeClass: string }
> = {
  BORRADOR: {
    label: 'BORRADOR',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  },
  EN_REVISION: {
    label: 'EN_REVISION',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-300'
  },
  APROBADO: {
    label: 'APROBADO',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-300'
  },
  CONSOLIDADO: {
    label: 'CONSOLIDADO',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  RESOLUCION_EMITIDA: {
    label: 'RESOLUCION_EMITIDA',
    badgeClass: 'bg-cyan-600 text-white border-cyan-700'
  },
  DESCARTADO: {
    label: 'DESCARTADO',
    badgeClass: 'bg-slate-200 text-slate-700 border-slate-300'
  }
};

export const ETIQUETAS_RESOLUCION_REBOTE: Record<
  EstadoResolucionRebote,
  { label: string; badgeClass: string }
> = {
  NO_APLICA: {
    label: 'No Aplica',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-200'
  },
  PENDIENTE: {
    label: 'PENDIENTE',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  CUBIERTA_EN_CADENA: {
    label: 'Cubierta en Cadena',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300'
  },
  DERIVADA_A_CONCURSO_GDP: {
    label: 'Derivada a Concurso GDP',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-300'
  }
};

export const CAUSALES_EGRESO_OPCIONES: Array<{
  id: CausalEgresoDocente;
  label: string;
}> = [
  { id: 'renuncia_voluntaria', label: 'Renuncia Voluntaria' },
  { id: 'art_19s_no_avance', label: 'Art. 19 S Ley 20.903 (No Avance Tramo)' },
  { id: 'incentivo_retiro', label: 'Ley de Incentivo al Retiro' },
  { id: 'salud_incompatible_180d', label: 'Salud Incompatible (>180 días)' },
  { id: 'art_72_otro', label: 'Art. 72 Estatuto Docente (Otra Causal)' }
];

export const ETIQUETAS_TIPO_VACANTE: Record<
  TipoVacanteDocente,
  { label: string; className: string }
> = {
  NN_DETECTADO: {
    label: 'NN Detectado',
    className: 'bg-amber-100 text-amber-900 border-amber-300'
  },
  NECESIDAD_ESCUELA: {
    label: 'Necesidad Escuela',
    className: 'bg-indigo-100 text-indigo-800 border-indigo-300'
  },
  CONDICIONAL_EGRESO: {
    label: 'Condicional Egreso',
    className: 'bg-rose-100 text-rose-800 border-rose-300'
  },
  REBOTE_MOVILIDAD: {
    label: 'NN-Rebote',
    className: 'bg-cyan-100 text-cyan-900 border-cyan-300'
  }
};

export const ETIQUETAS_ESTAMENTO_ASISTENTE: Record<
  EstamentoAsistente,
  { label: string; badgeClass: string }
> = {
  PROFESIONAL: {
    label: 'PROFESIONAL',
    badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
  },
  TECNICO: {
    label: 'TECNICO',
    badgeClass: 'bg-teal-50 text-teal-800 border-teal-200'
  },
  ADMINISTRATIVO: {
    label: 'ADMINISTRATIVO',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200'
  },
  AUXILIAR: {
    label: 'AUXILIAR',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-200'
  },
  PARADOCENTE_INSPECTORIA: {
    label: 'PARADOCENTE_INSPECTORIA',
    badgeClass: 'bg-purple-50 text-purple-800 border-purple-200'
  }
};

export function inferirFuenteVacante(
  doc: Docente
): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' {
  const sep = (doc.horasSepTitular || 0) + (doc.horasSepContrata || 0);
  const pie = (doc.horasPieTitular || 0) + (doc.horasPieContrata || 0);
  const sg =
    (doc.horasSubvencionGeneralTitular || 0) +
    (doc.horasSubvencionGeneralContrata || 0);
  if (pie >= sep && pie > sg) return 'PIE';
  if (sep > pie && sep > sg) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

export function inferirFuenteDocente(
  doc: Docente
): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' | 'MIXTO' {
  const sg =
    (doc.horasSubvencionGeneralTitular || 0) +
    (doc.horasSubvencionGeneralContrata || 0);
  const sep = (doc.horasSepTitular || 0) + (doc.horasSepContrata || 0);
  const pie = (doc.horasPieTitular || 0) + (doc.horasPieContrata || 0);
  const activas = [sg > 0, sep > 0, pie > 0].filter(Boolean).length;
  if (activas > 1) return 'MIXTO';
  if (pie > 0) return 'PIE';
  if (sep > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

export function inferirFuenteAsistente(
  a: AsistenteEducacion
): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' | 'MIXTO' {
  const sg =
    (a.horasSubvencionGeneralIndefinido || 0) +
    (a.horasSubvencionGeneralPlazoFijo || 0);
  const sep = (a.horasSepIndefinido || 0) + (a.horasSepPlazoFijo || 0);
  const pie = (a.horasPieIndefinido || 0) + (a.horasPiePlazoFijo || 0);
  const activas = [sg > 0, sep > 0, pie > 0].filter(Boolean).length;
  if (activas > 1) return 'MIXTO';
  if (pie > 0) return 'PIE';
  if (sep > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

export function formatearMinutosAHoras(minutos: number): string {
  const minsSeguros = Math.max(0, Math.round(minutos));
  const h = Math.floor(minsSeguros / 60);
  const m = minsSeguros % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function calcularDesgloseTitularContrata(doc?: Docente | null): {
  horasTitulares: number;
  horasContrata: number;
  horasTotal: number;
} {
  if (!doc) return { horasTitulares: 0, horasContrata: 0, horasTotal: 0 };
  const total = Math.max(0, Number(doc.horasContrato || 0));
  const titSum =
    Number(doc.horasSubvencionGeneralTitular || 0) +
    Number(doc.horasSepTitular || 0) +
    Number(doc.horasPieTitular || 0);
  const contSum =
    Number(doc.horasSubvencionGeneralContrata || 0) +
    Number(doc.horasSepContrata || 0) +
    Number(doc.horasPieContrata || 0);

  if (titSum > 0 || contSum > 0) {
    const horasTitulares = Math.min(total || titSum + contSum, titSum);
    const horasContrata =
      contSum > 0 ? contSum : Math.max(0, total - horasTitulares);
    return {
      horasTitulares,
      horasContrata,
      horasTotal: total || horasTitulares + horasContrata
    };
  }

  if (doc.calidadJuridica === 'TITULAR') {
    return { horasTitulares: total, horasContrata: 0, horasTotal: total };
  }
  return { horasTitulares: 0, horasContrata: total, horasTotal: total };
}

export function calcularDesgloseAsistente(a?: AsistenteEducacion | null): {
  horasIndefinidas: number;
  horasPlazoFijo: number;
  horasHonorarios: number;
  horasTotal: number;
} {
  if (!a) {
    return {
      horasIndefinidas: 0,
      horasPlazoFijo: 0,
      horasHonorarios: 0,
      horasTotal: 0
    };
  }
  const horasIndefinidas =
    Number(a.horasSubvencionGeneralIndefinido || 0) +
    Number(a.horasSepIndefinido || 0) +
    Number(a.horasPieIndefinido || 0);
  const horasPlazoFijo =
    Number(a.horasSubvencionGeneralPlazoFijo || 0) +
    Number(a.horasSepPlazoFijo || 0) +
    Number(a.horasPiePlazoFijo || 0);
  const horasHonorarios = Number(a.horasHonorarios || 0);
  const horasTotal =
    Number(a.horasContrato || 0) ||
    horasIndefinidas + horasPlazoFijo + horasHonorarios;
  return { horasIndefinidas, horasPlazoFijo, horasHonorarios, horasTotal };
}

export function cumpleFiltroTipoEscuela(
  est: Establecimiento | undefined,
  filtro: string
): boolean {
  if (filtro === 'TODOS') return true;
  if (!est) return false;
  if (filtro.startsWith('CAT:')) {
    const cat = filtro.replace('CAT:', '') as CategoriaTipoEstablecimiento;
    return clasificarCategoriaEstablecimiento(est) === cat;
  }
  return (est.tipoPerfil || '').toUpperCase() === filtro;
}

export function etiquetaCategoriaEscuela(
  cat: CategoriaTipoEstablecimiento
): string {
  if (cat === 'LICEO') return 'Liceo';
  if (cat === 'JARDIN_VTF') return 'Jardín / Sala Cuna VTF';
  return 'Escuela';
}

export function etiquetaEstamentoDocente(estamento?: string): {
  label: string;
  badgeClass: string;
} {
  switch (estamento) {
    case 'DOCENTE_DIFERENCIAL':
      return {
        label: 'Ed. Diferencial (PIE)',
        badgeClass: 'bg-violet-50 text-violet-800 border-violet-200'
      };
    case 'EDUCADORA_PARVULO':
      return {
        label: 'Ed. Párvulos',
        badgeClass: 'bg-pink-50 text-pink-800 border-pink-200'
      };
    case 'PROFESIONAL_PAE':
      return {
        label: 'Profesional PAE',
        badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200'
      };
    case 'DIRECTIVO':
      return {
        label: 'Directivo',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200'
      };
    case 'TECNICO_PEDAGOGICO':
      return {
        label: 'Técnico-Pedagógico (UTP)',
        badgeClass: 'bg-sky-50 text-sky-800 border-sky-200'
      };
    case 'COORDINADOR_CRA':
      return {
        label: 'Coordinador CRA',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200'
      };
    case 'TECNICO_ESPECIAL':
      return {
        label: 'Técnico Especial',
        badgeClass: 'bg-teal-50 text-teal-800 border-teal-200'
      };
    case 'ASISTENTE_AULA':
      return {
        label: 'Asistente de Aula',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
      };
    case 'DOCENTE_AULA':
      return {
        label: 'Docente de Aula',
        badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200'
      };
    default:
      return {
        label: estamento || 'Otro Estamento',
        badgeClass: 'bg-slate-100 text-slate-700 border-slate-200'
      };
  }
}

export function cumpleFiltroEstamento(
  estamento: string | undefined,
  filtro: string
): boolean {
  if (filtro === 'TODOS') return true;
  if (filtro === 'DIRECTIVO_UTP') {
    return (
      estamento === 'DIRECTIVO' ||
      estamento === 'TECNICO_PEDAGOGICO' ||
      estamento === 'COORDINADOR_CRA'
    );
  }
  if (filtro === 'OTRO') {
    return (
      estamento !== 'DOCENTE_AULA' &&
      estamento !== 'DOCENTE_DIFERENCIAL' &&
      estamento !== 'EDUCADORA_PARVULO' &&
      estamento !== 'PROFESIONAL_PAE' &&
      estamento !== 'DIRECTIVO' &&
      estamento !== 'TECNICO_PEDAGOGICO' &&
      estamento !== 'COORDINADOR_CRA'
    );
  }
  return estamento === filtro;
}

export function construirCasosNoContinuidad(params: {
  docentesNoVacantes: Docente[];
  asistentesTerritorio: AsistenteEducacion[];
  solicitudes: SolicitudMovilidad[];
  colegiosByRbd: Map<string, Establecimiento>;
}): CasoNoContinuidadItem[] {
  const {
    docentesNoVacantes,
    asistentesTerritorio,
    solicitudes,
    colegiosByRbd
  } = params;

  const items: CasoNoContinuidadItem[] = [];
  const solicitudesNcPorDocId = new Map<string, SolicitudMovilidad>();
  const solicitudesNcAsistPorId = new Map<string, SolicitudMovilidad>();

  for (const s of solicitudes) {
    if (s.carril === 'NO_CONTINUIDAD_TITULAR') {
      solicitudesNcPorDocId.set(s.docenteId, s);
    } else if (s.carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO') {
      solicitudesNcAsistPorId.set(s.docenteId, s);
    }
  }

  const docentesProcesados = new Set<string>();
  for (const d of docentesNoVacantes) {
    const sol = solicitudesNcPorDocId.get(d.id);
    const esGdpNc =
      esPropuestaNoContinuidad(d.propuestaGdp) ||
      esPropuestaNoContinuidad(d.situacionFinalGdp);
    if (!esGdpNc && !sol) continue;

    docentesProcesados.add(d.id);
    const est = colegiosByRbd.get(d.rbd);
    const categoriaEscuela = est
      ? clasificarCategoriaEstablecimiento(est)
      : 'ESCUELA';
    const partesRazon = [
      sol?.fundamento?.trim(),
      d.observacionesDirector?.trim(),
      d.observacionesSlep?.trim(),
      d.observacionesPal?.trim()
    ].filter(
      (x, idx, arr): x is string => Boolean(x) && arr.indexOf(x) === idx
    );
    const razon = partesRazon.join(' | ');

    const fuentes: string[] = [];
    if (
      (d.horasSubvencionGeneralTitular || 0) +
        (d.horasSubvencionGeneralContrata || 0) >
      0
    ) {
      fuentes.push('Subv. General');
    }
    if (
      (d.horasSepTitular || 0) +
        (d.horasSepContrata || 0) +
        (d.horasTallerSep || 0) >
      0
    ) {
      fuentes.push('SEP');
    }
    if ((d.horasPieTitular || 0) + (d.horasPieContrata || 0) > 0) {
      fuentes.push('PIE');
    }

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
      cargoEspecialidad:
        d.asignaturaPrincipal || d.cargoInstitucional || d.estamento,
      horasContrato: Number(d.horasContrato || 0),
      fuenteFinanciamiento: fuentes.join(' / ') || 'Subv. General',
      propuestaGdp:
        d.propuestaGdp || (sol ? 'No Continuidad (Mesa)' : 'No Continuidad'),
      situacionFinalGdp: d.situacionFinalGdp || 'Vigente',
      razon: razon || 'Sin razón especificada en propuesta GDP',
      tieneRazon: Boolean(razon),
      origenDeteccion:
        esGdpNc && sol ? 'AMBOS' : sol ? 'SOLICITUD_MESA' : 'PROPUESTA_GDP'
    });
  }

  for (const [docId, sol] of solicitudesNcPorDocId.entries()) {
    if (docentesProcesados.has(docId)) continue;
    const est = colegiosByRbd.get(sol.rbdOrigen);
    const categoriaEscuela = est
      ? clasificarCategoriaEstablecimiento(est)
      : 'ESCUELA';
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
      fuenteFinanciamiento:
        sol.fuenteActual === 'SUBVENCION_GENERAL'
          ? 'Subv. General'
          : sol.fuenteActual,
      propuestaGdp: 'No Continuidad (Mesa)',
      situacionFinalGdp: sol.estadoFlujo,
      razon: razon || 'Sin razón especificada en solicitud',
      tieneRazon: Boolean(razon),
      origenDeteccion: 'SOLICITUD_MESA'
    });
  }

  for (const a of asistentesTerritorio) {
    const sol = solicitudesNcAsistPorId.get(a.id);
    const esNc =
      esPropuestaNoContinuidad(a.propuestaGdp) ||
      esPropuestaNoContinuidad(a.situacionFinalGdp);
    if (!esNc && !sol) continue;

    const est = colegiosByRbd.get(a.rbd);
    const categoriaEscuela = est
      ? clasificarCategoriaEstablecimiento(est)
      : 'ESCUELA';
    const partesRazon = [
      sol?.fundamento?.trim(),
      a.observacionesDirector?.trim(),
      a.observacionesSlep?.trim(),
      a.observacionesPal?.trim(),
      a.observaciones?.trim()
    ].filter(
      (x, idx, arr): x is string => Boolean(x) && arr.indexOf(x) === idx
    );
    const razon = partesRazon.join(' | ');

    const { horasIndefinidas, horasHonorarios } = calcularDesgloseAsistente(a);
    const calidad =
      horasIndefinidas > 0
        ? 'INDEFINIDO'
        : horasHonorarios > 0 && a.horasContrato <= horasHonorarios
        ? 'HONORARIOS'
        : 'PLAZO FIJO';

    const fuentes: string[] = [];
    if (
      (a.horasSubvencionGeneralIndefinido || 0) +
        (a.horasSubvencionGeneralPlazoFijo || 0) >
      0
    ) {
      fuentes.push('Subv. General');
    }
    if ((a.horasSepIndefinido || 0) + (a.horasSepPlazoFijo || 0) > 0) {
      fuentes.push('SEP');
    }
    if ((a.horasPieIndefinido || 0) + (a.horasPiePlazoFijo || 0) > 0) {
      fuentes.push('PIE');
    }
    if (horasHonorarios > 0) fuentes.push('Honorarios');

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
      propuestaGdp:
        a.propuestaGdp || (sol ? 'No Continuidad (Mesa)' : 'No Continuidad'),
      situacionFinalGdp: a.situacionFinalGdp || sol?.estadoFlujo || 'Vigente',
      razon: razon || 'Sin razón especificada en propuesta GDP',
      tieneRazon: Boolean(razon),
      origenDeteccion:
        esNc && sol ? 'AMBOS' : sol ? 'SOLICITUD_MESA' : 'PROPUESTA_GDP'
    });
  }

  return items.sort(
    (a, b) =>
      a.establecimientoNombre.localeCompare(b.establecimientoNombre, 'es') ||
      a.nombreCompleto.localeCompare(b.nombreCompleto, 'es')
  );
}

export function calcularAsignaturasPorCubrirPorVacante(params: {
  vacantesNn: Docente[];
  asignacionesTerritorio: AsignacionHoraria[];
  cursosTerritorio: CursoSae[];
}): Map<string, ResumenAsignaturasVacante> {
  const { vacantesNn, asignacionesTerritorio, cursosTerritorio } = params;
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
      const plan = obtenerPlanPorCurso(
        cur.nivel,
        cur.regimen,
        cur.especialidadTp
      );
      if (!plan) continue;
      for (const asig of plan.asignaturasBase || []) {
        const nombre = (asig.nombre || '').trim();
        if (!nombre) continue;
        planPorAsig.set(
          nombre,
          (planPorAsig.get(nombre) || 0) + (asig.horasSugeridas || 0)
        );
      }
    }

    for (const a of asigsCol) {
      if (a.esTallerSep || a.esTrabajoColaborativo) continue;
      const nombre = (a.asignatura || '').trim();
      if (!nombre) continue;
      cubiertasPorAsig.set(
        nombre,
        (cubiertasPorAsig.get(nombre) || 0) + (a.horasPedagogicasAula || 0)
      );
    }

    const lista: DeficitAsignaturaColegio[] = [];
    for (const [asigNombre, hrsPlan] of planPorAsig.entries()) {
      const normAsig = asigNombre.toLowerCase();
      let hrsCubiertas = cubiertasPorAsig.get(asigNombre) || 0;
      if (hrsCubiertas === 0) {
        for (const [k, v] of cubiertasPorAsig.entries()) {
          if (
            k.toLowerCase().includes(normAsig) ||
            normAsig.includes(k.toLowerCase())
          ) {
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
        asignatura:
          a.asignatura || v.asignaturaPrincipal || 'Asignatura por definir',
        cursoNombre: cur
          ? `${cur.nivel} ${cur.letra}`
          : a.cursoId === 'TRANSVERSAL'
          ? 'Transversal'
          : 'Curso',
        horasPedagogicas: Number(a.horasPedagogicasAula || 0)
      };
    });
    const totalHorasDirectas = directas.reduce(
      (s, d) => s + d.horasPedagogicas,
      0
    );
    mapa.set(v.id, {
      directas,
      totalHorasDirectas,
      deficitEstablecimiento: obtenerDeficitColegio(v.rbd)
    });
  }

  return mapa;
}

/**
 * Determina si el usuario actual puede ver datos sensibles de una solicitud de movilidad
 * (fundamento y puntajes individuales Ley Karin, Salud y Cuidado de Dependientes).
 *
 * NOTA DE SEGURIDAD: Este enmascarado es únicamente una mitigación de interfaz (UI);
 * la protección real de privacidad y aislamiento por cartera reside en las políticas
 * RLS de filas en PostgreSQL/Supabase (migración 20261122120000_movilidad_rls_privacidad.sql).
 */
export function puedeVerDatosSensiblesMovilidad(
  rol: unknown,
  solicitud: Pick<SolicitudMovilidad, 'creadoPor'>,
  usuarioId?: string,
  usuarioEmail?: string,
  usuarioNombre?: string
): boolean {
  if (esRolValidadorGdp(rol) || esRolConsolidadorMovilidad(rol)) {
    return true;
  }
  const creador = (solicitud.creadoPor || '').trim().toLowerCase();
  if (!creador) return false;
  const candidatos = [usuarioId, usuarioEmail, usuarioNombre]
    .map(v => (v || '').trim().toLowerCase())
    .filter(Boolean);
  return candidatos.includes(creador);
}
