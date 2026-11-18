import {
  Establecimiento,
  CursoSae,
  Docente,
  AsignacionHoraria,
  AsistenteEducacion,
  ComunaValleDiguillin
} from '../types';
import {
  calcularJornadaMinutos,
  calcularAuditoriaDocenteMultitramo,
  buscarContratoMinimoPorTabla,
  obtenerPlanPorCurso,
  calcularHorasPlanCurso,
  calcularDemandaNormativaPieCurso
} from '@slep/mineduc-engine';
import { normalizarRut, claveDedupFuncionario } from '../utils/rutUtils';
import {
  auditarCargaDocenteIntegral,
  normalizarFuentesFinanciamientoDocente,
  normalizarFuentesFinanciamientoAsistente
} from './auditoriaDocenteService';

export type CategoriaTipoEstablecimiento = 'ESCUELA' | 'LICEO' | 'JARDIN_VTF';

export const TODAS_LAS_CATEGORIAS_ESTABLECIMIENTO: CategoriaTipoEstablecimiento[] = [
  'ESCUELA',
  'LICEO',
  'JARDIN_VTF'
];

export const CATEGORIAS_ESCOLARES_SIN_VTF: CategoriaTipoEstablecimiento[] = [
  'ESCUELA',
  'LICEO'
];

/**
 * Clasifica un establecimiento en una categoría homogénea para filtros territoriales
 * (Escuelas, Liceos, o Jardines y Salas Cuna VTF).
 */
export function clasificarCategoriaEstablecimiento(est: Establecimiento): CategoriaTipoEstablecimiento {
  const tipo = String(est.tipo || '').toUpperCase();
  const perfil = String(est.tipoPerfil || '').toUpperCase();
  const nombre = String(est.nombre || '');
  if (
    tipo === 'JARDIN' ||
    tipo === 'SALA_CUNA' ||
    perfil === 'JARDIN_SALA_CUNA' ||
    /jard[ií]n|sala\s*cuna|\bvtf\b/i.test(nombre)
  ) {
    return 'JARDIN_VTF';
  }
  if (tipo === 'LICEO' || perfil.startsWith('LICEO') || /\bliceo\b/i.test(nombre)) {
    return 'LICEO';
  }
  return 'ESCUELA';
}

/**
 * Detecta si un funcionario (docente o asistente) tiene propuesta GDP de "No Continuidad".
 */
export function esPropuestaNoContinuidad(propuestaGdp?: string): boolean {
  if (!propuestaGdp) return false;
  const norm = propuestaGdp
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return /\bno\s+continuidad\b/.test(norm);
}

export interface ResultadoFiltroCartera {
  colegiosFiltrados: Establecimiento[];
  rbdsPermitidos: Set<string>;
  cursosFiltrados: CursoSae[];
  docentesFiltrados: Docente[];
  asignacionesFiltradas: AsignacionHoraria[];
  asistentesFiltrados: AsistenteEducacion[];
  conteosPorCategoria: Record<CategoriaTipoEstablecimiento, number>;
  conteoNoContinuidadDocentes: number;
  horasNoContinuidadDocentes: number;
  conteoNoContinuidadAsistentes: number;
  horasNoContinuidadAsistentes: number;
}

/**
 * Filtra establecimientos, cursos, docentes, asignaciones y asistentes según los tipos
 * de establecimiento seleccionados y la inclusión/exclusión de funcionarios con "No Continuidad".
 */
export function filtrarCarteraPorTipoYContinuidad(params: {
  colegios: Establecimiento[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  asistentes: AsistenteEducacion[];
  categoriasSeleccionadas: CategoriaTipoEstablecimiento[];
  incluirNoContinuidad: boolean;
}): ResultadoFiltroCartera {
  const {
    colegios,
    cursos,
    docentes,
    asignaciones,
    asistentes,
    categoriasSeleccionadas,
    incluirNoContinuidad
  } = params;

  const conteosPorCategoria: Record<CategoriaTipoEstablecimiento, number> = {
    ESCUELA: 0,
    LICEO: 0,
    JARDIN_VTF: 0
  };
  const setCategorias = new Set<CategoriaTipoEstablecimiento>(categoriasSeleccionadas);
  const colegiosFiltrados: Establecimiento[] = [];
  const rbdsPermitidos = new Set<string>();

  for (const col of colegios) {
    const cat = clasificarCategoriaEstablecimiento(col);
    conteosPorCategoria[cat]++;
    if (setCategorias.has(cat)) {
      colegiosFiltrados.push(col);
      rbdsPermitidos.add(col.rbd);
    }
  }

  let conteoNoContinuidadDocentes = 0;
  let horasNoContinuidadDocentes = 0;
  const docentesFiltrados: Docente[] = [];
  const docentesPermitidosIds = new Set<string>();

  for (const d of docentes) {
    if (!rbdsPermitidos.has(d.rbd)) continue;
    if (esPropuestaNoContinuidad(d.propuestaGdp)) {
      conteoNoContinuidadDocentes++;
      horasNoContinuidadDocentes += Number(d.horasContrato) || 0;
      if (!incluirNoContinuidad) continue;
    }
    docentesFiltrados.push(d);
    docentesPermitidosIds.add(d.id);
  }

  let conteoNoContinuidadAsistentes = 0;
  let horasNoContinuidadAsistentes = 0;
  const asistentesFiltrados: AsistenteEducacion[] = [];

  for (const a of asistentes) {
    if (!rbdsPermitidos.has(a.rbd)) continue;
    if (esPropuestaNoContinuidad(a.propuestaGdp)) {
      conteoNoContinuidadAsistentes++;
      horasNoContinuidadAsistentes += Number(a.horasContrato) || 0;
      if (!incluirNoContinuidad) continue;
    }
    asistentesFiltrados.push(a);
  }

  const cursosFiltrados = cursos.filter(c => rbdsPermitidos.has(c.rbd));
  const asignacionesFiltradas = asignaciones.filter(
    a => rbdsPermitidos.has(a.rbd) && (incluirNoContinuidad || docentesPermitidosIds.has(a.docenteId))
  );

  return {
    colegiosFiltrados,
    rbdsPermitidos,
    cursosFiltrados,
    docentesFiltrados,
    asignacionesFiltradas,
    asistentesFiltrados,
    conteosPorCategoria,
    conteoNoContinuidadDocentes,
    horasNoContinuidadDocentes,
    conteoNoContinuidadAsistentes,
    horasNoContinuidadAsistentes
  };
}

export interface EstadisticasAsistentesColegio {
  totalAsistentes: number;
  totalHorasContrato: number;
  horasIndefinidas: number;
  horasPlazoFijo: number;
  horasHonorarios: number;
  porcentajeIndefinidos: number;
  porcentajePlazoFijo: number;

  // Desglose por Estamentos Ley 21.109
  profesionalesCount: number;
  profesionalesHoras: number;
  tecnicosCount: number;
  tecnicosHoras: number;
  administrativosCount: number; // Incluye administrativos y paradocentes/inspectoría
  administrativosHoras: number;
  auxiliaresCount: number;
  auxiliaresHoras: number;

  // Desglose por Subvención
  subvencionGeneralHoras: number;
  sepHoras: number;
  pieHoras: number;

  // Indicadores
  ratioAlumnosPorAuxiliar: number;
  duplaPsicosocial: {
    tienePsicologo: boolean;
    tieneTrabajadorSocial: boolean;
    horasTotales: number;
  };
  equipoPie: {
    cantidad: number;
    horasTotales: number;
  };
  desglose: AsistenteEducacion[];
}

export interface EstadisticasColegioHoras {
  rbd: string;
  nombre: string;
  comuna: ComunaValleDiguillin;
  regimen: string;
  porcentajePrioritarios: number;
  regimenProporcion: '60/40' | '65/35';
  totalDocentes: number;
  totalCursos: number;
  totalMatricula: number;

  // Calidad Jurídica Docente (Estatuto Docente Art. 4° bis - Regla 80/20)
  calidadJuridica: {
    titularesCount: number;
    titularesHoras: number;
    contrataCount: number;
    contrataHoras: number;
    postulandoTitularidadCount: number;
    postulandoTitularidadHoras: number;
    reemplazantesCount: number;
    reemplazantesHoras: number;
    porcentajeContrata: number; // Horas Contrata / Total Horas (%)
    cumpleNorma8020: boolean; // porcentajeContrata <= 20%
  };

  // Horas Contractuales y de Jornada Docente
  horasContratoTotal: number;
  minutosContratoTotal: number;

  // 1. Horas de Aula (Lectivas)
  horasAulaPedagogicasAsignadas: number;
  horasAulaCronologicasAsignadas: number; // HA * 45 / 60
  horasAulaDemandadasPlan: number; // Demanda MINEDUC + Talleres JEC
  horasLectivasMaximasPermitidas: number;
  balanceAulaLectiva: number; // Disponibles vs Demandadas
  coberturaCurricularPorcentaje: number; // Asignadas / Demandadas (%)
  deficitAulaCurricular: number; // Demandadas - Asignadas (horas faltantes)

  // 2. Horas de Proporción (No Lectivas según Ley 20.903)
  horasNoLectivasCalculadas: number;
  minutosNoLectivosCalculados: number;

  // 3. Horas y Minutos de Recreos normativos ("creos")
  horasRecreoCalculadas: number;
  minutosRecreoCalculados: number;

  // 4. Trabajo Colaborativo y Co-Docencia
  horasTrabajoColaborativo: number;
  horasCoDocencia: number;
  horasDemandaPieNormativa: number;
  horasColaborativasDemandadasPie: number;

  // 5. Fuentes de Financiamiento Docente
  financiamiento: {
    subvencionGeneralTitular: number;
    subvencionGeneralContrata: number;
    subvencionGeneralTotal: number;
    sepTitular: number;
    sepContrata: number;
    sepTotal: number;
    pieTitular: number;
    pieContrata: number;
    pieTotal: number;
    total: number;
  };

  // 6. Horas Institucionales / No Aula
  horasDirectivas: number;
  horasInspectorGeneral: number;
  horasTecnicoPedagogicas: number;
  horasCoordinacion: number;
  horasTallerSepDocente: number;
  horasInstitucionalesTotal: number;

  // 7. Distribución Cuadrada de la Jornada Docente (Suma 100%)
  horasVacantesLibresTotal: number; // Horas pagadas no asignadas
  porcentajeAula: number;
  porcentajeNoLectivo: number;
  porcentajeRecreo: number;
  porcentajeInstitucional: number;
  porcentajeVacantes: number;

  // 8. Horas Sin Asignar / Vacantes desglosadas por Subvención
  horasSepSinAsignarTotal: number;
  horasPieSinAsignarTotal: number;
  horasSubvGeneralSinAsignarTotal: number;
  totalHorasSinAsignarColegio: number;

  // 9. Asistentes de la Educación (Ley 21.109)
  asistentes: EstadisticasAsistentesColegio;

  // 10. Consolidado de Todo el Personal (Docentes + Asistentes)
  consolidadoPersonal: {
    totalFuncionarios: number;
    totalHorasContratadas: number;
    subvencionGeneralHoras: number;
    sepHoras: number;
    pieHoras: number;
  };

  // Detalle por docente para la vista intra-escuela
  desgloseDocentes: {
    id: string;
    run: string;
    nombreCompleto: string;
    estamento: string;
    calidadJuridica: string;
    horasContrato: number;
    horasAulaPedagogicas: number;
    horasNoLectivas: number;
    horasRecreo: number;
    horasColaborativo: number;
    horasSep: number;
    horasPie: number;
    horasSubvGeneral: number;
    horasInstitucionales: number;
    estaSobreasignado: boolean;
    horasSepAsignadas: number;
    horasSepSinAsignar: number;
    horasPieAsignadas: number;
    horasPieSinAsignar: number;
    horasSubvGeneralSinAsignar: number;
    totalHorasSinAsignar: number;
    horasLibresDocente: number;
    horasComprometidasDocente: number;
  }[];
}

export interface EstadisticasTerritorialesHoras {
  totalEstablecimientos: number;
  totalDocentesPlanta: number;
  docentesUnicosRun: number;
  totalCursos: number;
  totalMatricula: number;

  // Consolidado Global de Personal SLEP (Docentes + Asistentes)
  totalPersonalSlep: number;
  totalHorasPersonalSlep: number;
  totalHorasSubvencionGeneralPersonal: number;
  totalHorasSepPersonal: number;
  totalHorasPiePersonal: number;

  // Calidad Jurídica Docente Territorial (Regla 80/20)
  calidadJuridicaDocente: {
    titularesCount: number;
    titularesHoras: number;
    contrataCount: number;
    contrataHoras: number;
    postulandoTitularidadCount: number;
    postulandoTitularidadHoras: number;
    reemplazantesCount: number;
    reemplazantesHoras: number;
    porcentajeContrata: number;
    cumpleNorma8020: boolean;
  };

  // Asistentes de la Educación Territoriales
  asistentesTerritorio: {
    totalAsistentes: number;
    asistentesUnicosRun: number;
    totalHoras: number;
    horasIndefinidas: number;
    horasPlazoFijo: number;
    horasHonorarios: number;
    porcentajeIndefinidos: number;
    porcentajePlazoFijo: number;
    profesionales: { count: number; horas: number };
    tecnicos: { count: number; horas: number };
    administrativos: { count: number; horas: number };
    auxiliares: { count: number; horas: number };
    financiamiento: {
      subvencionGeneral: number;
      sep: number;
      pie: number;
    };
    ratioAlumnosPorAuxiliar: number;
    totalDuplasPsicosociales: number;
    totalEquipoPie: number;
  };

  // Totales de Jornada Docente
  horasContratoTotal: number;
  horasAulaPedagogicasTotal: number;
  horasAulaCronologicasTotal: number;
  horasNoLectivasTotal: number;
  horasRecreosTotal: number;
  horasColaborativoTotal: number;
  horasCoDocenciaTotal: number;
  horasDemandadasPlanTotal: number;
  horasLectivasMaximasTotal: number;
  balanceLectivoGlobal: number;
  coberturaCurricularGlobalPct: number;
  deficitCurricularGlobalTotal: number;

  // Financiamiento Consolidado Docente
  financiamiento: {
    subvencionGeneralTitular: number;
    subvencionGeneralContrata: number;
    subvencionGeneralTotal: number;
    sepTitular: number;
    sepContrata: number;
    sepTotal: number;
    pieTitular: number;
    pieContrata: number;
    pieTotal: number;
    total: number;
  };

  // Institucionales Totales
  horasDirectivasTotal: number;
  horasInspectorGeneralTotal: number;
  horasTecnicoPedagogicasTotal: number;
  horasCoordinacionTotal: number;
  horasInstitucionalesTotal: number;
  horasVacantesLibresTotal: number;

  // Porcentajes Globales de Jornada Docente
  porcentajeAulaGlobal: number;
  porcentajeNoLectivoGlobal: number;
  porcentajeRecreoGlobal: number;
  porcentajeInstitucionalGlobal: number;
  porcentajeVacantesGlobal: number;

  // Horas sin asignar territoriales
  horasSepSinAsignarTotal: number;
  horasPieSinAsignarTotal: number;
  horasSubvGeneralSinAsignarTotal: number;
  totalHorasSinAsignarTerritorio: number;

  // Agrupado por Comuna
  porComuna: {
    [comuna: string]: {
      colegiosCount: number;
      matriculaTotal: number;
      docentesCount: number;
      docentesHoras: number;
      asistentesCount: number;
      asistentesHoras: number;
      horasContrato: number;
      horasAulaPedagogicas: number;
      horasNoLectivas: number;
      horasRecreos: number;
      horasColaborativo: number;
      sepTotal: number;
      pieTotal: number;
      subvGeneralTotal: number;
      balanceLectivo: number;
      titularesHoras: number;
      contrataHoras: number;
      pctContrata: number;
    };
  };

  // Escuelas individuales procesadas
  porColegio: EstadisticasColegioHoras[];
}

/**
 * Calcula el resumen estadístico de Asistentes de la Educación para un colegio
 */
export function calcularEstadisticasAsistentesColegio(
  colegio: Establecimiento,
  asistentes: AsistenteEducacion[],
  matricula: number = 0
): EstadisticasAsistentesColegio {
  let totalHoras = 0;
  let horasIndefinidas = 0;
  let horasPlazoFijo = 0;
  let horasHonorarios = 0;

  let profCount = 0;
  let profHoras = 0;
  let tecCount = 0;
  let tecHoras = 0;
  let admCount = 0;
  let admHoras = 0;
  let auxCount = 0;
  let auxHoras = 0;

  let subvGenHoras = 0;
  let sepHoras = 0;
  let pieHoras = 0;

  let tienePsicologo = false;
  let tieneTrabajadorSocial = false;
  let horasDupla = 0;
  let pieCount = 0;
  let pieHorasTotales = 0;

  const asistentesActivosBrutos = asistentes.filter(a => a.activo !== false);
  const asistOrdenados = [...asistentesActivosBrutos].sort((a, b) => {
    const sumA =
      (Number(a.horasSubvencionGeneralIndefinido) || 0) +
      (Number(a.horasSubvencionGeneralPlazoFijo) || 0) +
      (Number(a.horasSepIndefinido) || 0) +
      (Number(a.horasSepPlazoFijo) || 0) +
      (Number(a.horasPieIndefinido) || 0) +
      (Number(a.horasPiePlazoFijo) || 0);
    const sumB =
      (Number(b.horasSubvencionGeneralIndefinido) || 0) +
      (Number(b.horasSubvencionGeneralPlazoFijo) || 0) +
      (Number(b.horasSepIndefinido) || 0) +
      (Number(b.horasSepPlazoFijo) || 0) +
      (Number(b.horasPieIndefinido) || 0) +
      (Number(b.horasPiePlazoFijo) || 0);
    return sumB - sumA;
  });
  const seenAstKeys = new Set<string>();
  const asistentesActivos: AsistenteEducacion[] = [];
  for (const a of asistOrdenados) {
    const key = claveDedupFuncionario(a.rbd || colegio.rbd, a.run, a.id);
    if (seenAstKeys.has(key)) continue;
    seenAstKeys.add(key);
    asistentesActivos.push(a);
  }

  for (const a of asistentesActivos) {
    const hrs = Number(a.horasContrato) || 0;
    totalHoras += hrs;

    const fuentes = normalizarFuentesFinanciamientoAsistente(
      hrs,
      Number(a.horasSubvencionGeneralIndefinido) || 0,
      Number(a.horasSubvencionGeneralPlazoFijo) || 0,
      Number(a.horasSepIndefinido) || 0,
      Number(a.horasSepPlazoFijo) || 0,
      Number(a.horasPieIndefinido) || 0,
      Number(a.horasPiePlazoFijo) || 0,
      Number(a.horasHonorarios) || 0
    );
    const sInd = fuentes.subvGenIndefinido;
    const sPla = fuentes.subvGenPlazoFijo;
    const spInd = fuentes.sepIndefinido;
    const spPla = fuentes.sepPlazoFijo;
    const pInd = fuentes.pieIndefinido;
    const pPla = fuentes.piePlazoFijo;
    const hon = fuentes.honorarios;

    subvGenHoras += sInd + sPla;
    sepHoras += spInd + spPla;
    pieHoras += pInd + pPla;
    horasHonorarios += hon;
    horasIndefinidas += sInd + spInd + pInd;
    horasPlazoFijo += sPla + spPla + pPla;

    // Estamentos Ley 21.109
    const est = String(a.estamento || '').toUpperCase();
    if (est === 'PROFESIONAL') {
      profCount++;
      profHoras += hrs;
    } else if (est === 'TECNICO') {
      tecCount++;
      tecHoras += hrs;
    } else if (est === 'AUXILIAR') {
      auxCount++;
      auxHoras += hrs;
    } else {
      // ADMINISTRATIVO y PARADOCENTE_INSPECTORIA
      admCount++;
      admHoras += hrs;
    }

    // Dupla Psicosocial
    const cargoNorm = (a.cargoFuncion || '').toLowerCase();
    if (a.esDuplaPsicosocial || /psic[oó]log|trabajador.*social|asistente.*social/i.test(cargoNorm)) {
      if (/psic[oó]log/i.test(cargoNorm)) tienePsicologo = true;
      if (/trabajador.*social|asistente.*social/i.test(cargoNorm)) tieneTrabajadorSocial = true;
      horasDupla += hrs;
    }

    // Equipo PIE
    if (a.esEquipoPie || (pInd + pPla) > 0 || /fonoaudi|terapeuta|kinesi/i.test(cargoNorm)) {
      pieCount++;
      pieHorasTotales += hrs;
    }
  }

  const pctIndefinido = totalHoras > 0 ? Math.round((horasIndefinidas / totalHoras) * 100) : 0;
  const pctPlazoFijo = totalHoras > 0 ? Math.round((horasPlazoFijo / totalHoras) * 100) : 0;
  const ratioAux = auxCount > 0 && matricula > 0 ? Math.round(matricula / auxCount) : 0;

  return {
    totalAsistentes: asistentesActivos.length,
    totalHorasContrato: totalHoras,
    horasIndefinidas,
    horasPlazoFijo,
    horasHonorarios,
    porcentajeIndefinidos: pctIndefinido,
    porcentajePlazoFijo: pctPlazoFijo,
    profesionalesCount: profCount,
    profesionalesHoras: profHoras,
    tecnicosCount: tecCount,
    tecnicosHoras: tecHoras,
    administrativosCount: admCount,
    administrativosHoras: admHoras,
    auxiliaresCount: auxCount,
    auxiliaresHoras: auxHoras,
    subvencionGeneralHoras: subvGenHoras,
    sepHoras,
    pieHoras,
    ratioAlumnosPorAuxiliar: ratioAux,
    duplaPsicosocial: {
      tienePsicologo,
      tieneTrabajadorSocial,
      horasTotales: horasDupla
    },
    equipoPie: {
      cantidad: pieCount,
      horasTotales: pieHorasTotales
    },
    desglose: asistentesActivos
  };
}

const GENERIC_TALLER_JEC_RX = /^(taller(\s+jec)?(\s*\/\s*libre\s+disposici[oó]n)?|taller\s+de\s+libre\s+disposici[oó]n|taller\s+institucional(\s+transversal)?)$/i;

function calcularPorcentajesJornadaDocente(
  horasContratoTotal: number,
  horasAulaCronologicas: number,
  horasNoLectivas: number,
  horasRecreos: number,
  horasInstitucionales: number,
  horasVacantes: number
): {
  pctAula: number;
  pctNoLectivo: number;
  pctRecreo: number;
  pctInst: number;
  pctVacantes: number;
} {
  if (horasContratoTotal <= 0) {
    return { pctAula: 0, pctNoLectivo: 0, pctRecreo: 0, pctInst: 0, pctVacantes: 0 };
  }
  const pctVacantes = horasVacantes <= 0
    ? 0
    : Math.min(100, Math.max(0, Math.round((horasVacantes / horasContratoTotal) * 100)));
  let pctAula = Math.max(0, Math.round((horasAulaCronologicas / horasContratoTotal) * 100));
  let pctNoLectivo = Math.max(0, Math.round((horasNoLectivas / horasContratoTotal) * 100));
  let pctRecreo = Math.max(0, Math.round((horasRecreos / horasContratoTotal) * 100));
  let pctInst = Math.max(0, Math.round((horasInstitucionales / horasContratoTotal) * 100));

  const sum = pctAula + pctNoLectivo + pctRecreo + pctInst + pctVacantes;
  if (sum !== 100) {
    const diff = 100 - sum;
    // Ajustar el segmento no-vacante predominante para cerrar exactamente en 100% sin inventar % libres cuando holgura = 0h
    if (pctNoLectivo + diff >= 0 && pctNoLectivo >= pctAula && pctNoLectivo >= pctInst) {
      pctNoLectivo += diff;
    } else if (pctAula + diff >= 0 && pctAula >= pctInst) {
      pctAula += diff;
    } else if (pctInst + diff >= 0) {
      pctInst += diff;
    } else if (pctRecreo + diff >= 0) {
      pctRecreo += diff;
    }
  }
  return { pctAula, pctNoLectivo, pctRecreo, pctInst, pctVacantes };
}

/**
 * Calcula el resumen estadístico exhaustivo de horas y personal para un establecimiento escolar específico
 */
export function calcularEstadisticasColegio(
  colegio: Establecimiento,
  cursos: CursoSae[],
  docentes: Docente[],
  asignaciones: AsignacionHoraria[],
  asistentes: AsistenteEducacion[] = []
): EstadisticasColegioHoras {
  const regimenProporcion: '60/40' | '65/35' = colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35';

  // Índices en memoria O(1)
  const cursosMap = new Map<string, CursoSae>();
  let totalMatricula = 0;
  let horasAulaDemandadasPlan = 0;
  let horasDemandaPieNormativa = 0;
  let horasColaborativasDemandadasPie = 0;

  // 1. Demanda de Cursos y PIE
  for (const c of cursos) {
    cursosMap.set(c.id, c);
    totalMatricula += c.matriculaProyectada || 0;
    const plan = obtenerPlanPorCurso(c.nivel, c.regimen, c.especialidadTp);
    const hrsPlan = plan ? plan.totalHorasPlan : calcularHorasPlanCurso(c.nivel, c.regimen, c.especialidadTp);
    const hrsTalleres = (c.talleresJec || []).reduce((sum, t) => sum + t.horas, 0);
    horasAulaDemandadasPlan += (hrsPlan + hrsTalleres);

    const isJec = c.regimen === 'JEC';
    const cNeet = c.alumnosNeet !== undefined ? c.alumnosNeet : 0;
    const cNeep = c.alumnosNeep !== undefined ? c.alumnosNeep : 0;
    if (cNeet > 0 || cNeep > 0) {
      const pie = calcularDemandaNormativaPieCurso(cNeet, cNeep, isJec);
      horasDemandaPieNormativa += pie.horasTotalCronologicas;
      horasColaborativasDemandadasPie += pie.horasTrabajoColaborativoCronologicas;
    }
  }

  // Pre-deduplicación defensiva de asignaciones exactas (excluyendo talleres genéricos JEC) y docentes por RUN
  const rawAsigCountByDoc = new Map<string, number>();
  for (const a of asignaciones) {
    if (a.docenteId) {
      rawAsigCountByDoc.set(a.docenteId, (rawAsigCountByDoc.get(a.docenteId) || 0) + 1);
    }
    if (a.coDocenteId && a.tieneCoDocente) {
      rawAsigCountByDoc.set(a.coDocenteId, (rawAsigCountByDoc.get(a.coDocenteId) || 0) + 1);
    }
  }

  const docentesOrdenados = [...docentes].sort(
    (a, b) => (rawAsigCountByDoc.get(b.id) || 0) - (rawAsigCountByDoc.get(a.id) || 0)
  );
  const docentesDedup: Docente[] = [];
  const docIdByDedupKey = new Map<string, string>();
  const docIdAliasMap = new Map<string, string>();

  for (const doc of docentesOrdenados) {
    const key = claveDedupFuncionario(doc.rbd || colegio.rbd, doc.run, doc.id);
    const canonicalId = docIdByDedupKey.get(key);
    if (canonicalId) {
      docIdAliasMap.set(doc.id, canonicalId);
      continue;
    }
    docIdByDedupKey.set(key, doc.id);
    docIdAliasMap.set(doc.id, doc.id);
    docentesDedup.push(doc);
  }

  const seenExactAsigKeys = new Set<string>();
  const asignacionesDedup: AsignacionHoraria[] = [];
  for (const a of asignaciones) {
    const canonicalDocId = docIdAliasMap.get(a.docenteId) || a.docenteId;
    const canonicalCoDocId = a.coDocenteId ? (docIdAliasMap.get(a.coDocenteId) || a.coDocenteId) : a.coDocenteId;
    const asigNorm = (a.asignatura || '').trim().toLowerCase();
    const haNorm = Number(a.horasPedagogicasAula) || 0;
    const esTallerGenerico = GENERIC_TALLER_JEC_RX.test(asigNorm) ||
      (asigNorm.includes('taller jec') && asigNorm.includes('libre disposic'));
    if (!esTallerGenerico && canonicalDocId) {
      const exactKey = `${a.cursoId || ''}__${canonicalDocId}__${asigNorm}__${haNorm}`;
      if (seenExactAsigKeys.has(exactKey)) {
        continue;
      }
      seenExactAsigKeys.add(exactKey);
    }
    asignacionesDedup.push(
      canonicalDocId !== a.docenteId || canonicalCoDocId !== a.coDocenteId
        ? { ...a, docenteId: canonicalDocId, coDocenteId: canonicalCoDocId }
        : a
    );
  }

  // 1.1 Talleres Institucionales / Transversales (no asociados a un curso específico)
  const asignacionesTransversales = asignacionesDedup.filter(
    a => !a.cursoId || a.cursoId === 'TRANSVERSAL' || a.cursoId === 'SIN_CURSO'
  );
  for (const asig of asignacionesTransversales) {
    const hrs = asig.horasPedagogicasAula || 0;
    if (hrs > 0) {
      horasAulaDemandadasPlan += hrs;
    }
  }

  // Pre-agrupar asignaciones por docenteId y coDocenteId en un solo recorrido lineal O(A)
  const asigsPorDocente = new Map<string, AsignacionHoraria[]>();
  const coAsigsPorDocente = new Map<string, AsignacionHoraria[]>();

  for (const a of asignacionesDedup) {
    if (a.docenteId) {
      let arr = asigsPorDocente.get(a.docenteId);
      if (!arr) {
        arr = [];
        asigsPorDocente.set(a.docenteId, arr);
      }
      arr.push(a);
    }
    if (a.coDocenteId && a.tieneCoDocente) {
      let arr = coAsigsPorDocente.get(a.coDocenteId);
      if (!arr) {
        arr = [];
        coAsigsPorDocente.set(a.coDocenteId, arr);
      }
      arr.push(a);
    }
  }

  // 2. Acumuladores de Calidad Jurídica Docente (Estatuto Docente)
  let titularesCount = 0;
  let titularesHoras = 0;
  let contrataCount = 0;
  let contrataHoras = 0;
  let postulandoTitularidadCount = 0;
  let postulandoTitularidadHoras = 0;
  let reemplazantesCount = 0;
  let reemplazantesHoras = 0;

  // 3. Acumuladores de Planta Docente
  let horasContratoTotal = 0;
  let horasAulaCurricularAsignadas = 0;
  let horasAulaPedagogicasAsignadas = 0;
  let minutosAulaCronologicaEfectiva = 0;
  let horasLectivasMaximasPermitidas = 0;
  let minutosNoLectivosCalculadosTotal = 0;
  let minutosRecreoCalculadosTotal = 0;
  let horasTrabajoColaborativoTotal = 0;
  let horasCoDocenciaTotal = 0;

  let subvTit = 0;
  let subvCon = 0;
  let sepTit = 0;
  let sepCon = 0;
  let pieTit = 0;
  let pieCon = 0;

  let hDirectivas = 0;
  let hInspector = 0;
  let hTecnico = 0;
  let hCoord = 0;
  let hTallerSep = 0;
  let horasSepSinAsignarTotal = 0;
  let horasPieSinAsignarTotal = 0;
  let horasSubvGeneralSinAsignarTotal = 0;
  let totalMinutosLibresColegio = 0;

  const desgloseDocentes = docentesDedup.map(doc => {
    const hContrato = Number(doc.horasContrato) || 0;
    horasContratoTotal += hContrato;

    // Clasificación de Calidad Jurídica
    const calJur = (doc.calidadJuridica || '').toUpperCase();
    if (calJur === 'TITULAR') {
      titularesCount++;
      titularesHoras += hContrato;
    } else if (calJur === 'POSTULANDO_A_TITULARIDAD') {
      postulandoTitularidadCount++;
      postulandoTitularidadHoras += hContrato;
    } else if (calJur === 'REEMPLAZANTE') {
      reemplazantesCount++;
      reemplazantesHoras += hContrato;
    } else {
      contrataCount++;
      contrataHoras += hContrato;
    }

    // Financiamiento docente normalizado (garantiza suma exacta = horasContrato)
    const fuentesDoc = normalizarFuentesFinanciamientoDocente(
      hContrato,
      calJur,
      Number(doc.horasSubvencionGeneralTitular) || 0,
      Number(doc.horasSubvencionGeneralContrata) || 0,
      Number(doc.horasSepTitular) || 0,
      Number(doc.horasSepContrata) || 0,
      Number(doc.horasPieTitular) || 0,
      Number(doc.horasPieContrata) || 0
    );
    const sTit = fuentesDoc.subvGenTitular;
    const sCon = fuentesDoc.subvGenContrata;
    const spTit = fuentesDoc.sepTitular;
    const spCon = fuentesDoc.sepContrata;
    const pTit = fuentesDoc.pieTitular;
    const pCon = fuentesDoc.pieContrata;

    subvTit += sTit;
    subvCon += sCon;
    sepTit += spTit;
    sepCon += spCon;
    pieTit += pTit;
    pieCon += pCon;

    // Institucionales
    const dDir = Number(doc.horasDirectivas) || 0;
    const dInsp = Number(doc.horasInspectorGeneral) || 0;
    const dTec = Number(doc.horasTecnicoPedagogicas) || 0;
    const dCoord = (Number(doc.horasCoordinacion) || 0) + (Number(doc.horasCoordinacionPie) || 0) + (Number(doc.horasConvivenciaEscolar) || 0) + (Number(doc.horasExtraescolar) || 0);
    const dTallerSep = Number(doc.horasTallerSep) || 0;
    const dColab = Number(doc.horasTrabajoColaborativo) || 0;

    hDirectivas += dDir;
    hInspector += dInsp;
    hTecnico += dTec;
    hCoord += dCoord;
    hTallerSep += dTallerSep;

    // Asignaciones del docente en esta escuela desde mapa precalculado
    const docAsigs = asigsPorDocente.get(doc.id) || [];
    const coDocAsigs = coAsigsPorDocente.get(doc.id) || [];

    // Auditoría oficial unificada (sin doble resta de funcionesNoAula y con soporte completo de co-docencia/PIE)
    const integral = auditarCargaDocenteIntegral(
      doc,
      docAsigs,
      coDocAsigs,
      cursosMap,
      colegio.porcentajePrioritarios
    );

    const {
      auditDoc,
      haRegular,
      haCoDocencia,
      haTrabajoColab,
      haDocenciaEfectiva,
      maxHAPermitidas,
      horasNoLectivasCronologicas: horasNoLectivasDoc,
      horasRecreoCronologicas: horasRecreoDoc,
      horasExentasTotales: hExentas,
      estaSobreasignado,
      horasComprometidasDocente,
      horasLibresDocente,
      reqSepDoc: sepAsignadasDoc,
      pieAsignadasDoc,
      horasSepSinAsignar: sepSinAsignarDoc,
      horasPieSinAsignar: pieSinAsignarDoc,
      horasSubvGenSinAsignar: subvGenSinAsignarDoc,
      totalHorasSinAsignar: totalSinAsignarDoc,
      isEducadoraParvulo
    } = integral;

    horasAulaCurricularAsignadas += haRegular;
    horasAulaPedagogicasAsignadas += haDocenciaEfectiva;
    minutosAulaCronologicaEfectiva += Math.round(
      haDocenciaEfectiva * (isEducadoraParvulo ? 60 : 45)
    );
    horasCoDocenciaTotal += haCoDocencia;
    const hColabDocEfectivo = Math.max(dColab, haTrabajoColab);
    horasTrabajoColaborativoTotal += hColabDocEfectivo;

    horasLectivasMaximasPermitidas += maxHAPermitidas;
    minutosNoLectivosCalculadosTotal += auditDoc.minutosHnlTotal;
    minutosRecreoCalculadosTotal += auditDoc.minutosRecreoTotal;

    const minLibresDoc = Math.round(horasLibresDocente * 60);
    totalMinutosLibresColegio += minLibresDoc;

    horasSepSinAsignarTotal = Number((horasSepSinAsignarTotal + sepSinAsignarDoc).toFixed(2));
    horasPieSinAsignarTotal = Number((horasPieSinAsignarTotal + pieSinAsignarDoc).toFixed(2));
    horasSubvGeneralSinAsignarTotal = Number((horasSubvGeneralSinAsignarTotal + subvGenSinAsignarDoc).toFixed(2));

    return {
      id: doc.id,
      run: doc.run,
      nombreCompleto: `${doc.nombres} ${doc.apellidos}`,
      estamento: doc.estamento,
      calidadJuridica: doc.calidadJuridica,
      horasContrato: hContrato,
      horasAulaPedagogicas: Number(haDocenciaEfectiva.toFixed(2)),
      horasNoLectivas: horasNoLectivasDoc,
      horasRecreo: horasRecreoDoc,
      horasColaborativo: hColabDocEfectivo,
      horasSep: spTit + spCon,
      horasPie: pTit + pCon,
      horasSubvGeneral: sTit + sCon,
      horasInstitucionales: hExentas,
      estaSobreasignado,
      horasSepAsignadas: sepAsignadasDoc,
      horasSepSinAsignar: sepSinAsignarDoc,
      horasPieAsignadas: pieAsignadasDoc,
      horasPieSinAsignar: pieSinAsignarDoc,
      horasSubvGeneralSinAsignar: subvGenSinAsignarDoc,
      totalHorasSinAsignar: totalSinAsignarDoc,
      horasLibresDocente,
      horasComprometidasDocente
    };
  });

  const horasAulaPedagogicasRedondeadas = Number(horasAulaPedagogicasAsignadas.toFixed(2));
  const horasAulaCronologicasAsignadas = Number((minutosAulaCronologicaEfectiva / 60).toFixed(4));
  const horasNoLectivasCalculadas = Number((minutosNoLectivosCalculadosTotal / 60).toFixed(4));
  const horasRecreoCalculadas = Number((minutosRecreoCalculadosTotal / 60).toFixed(4));
  const horasInstitucionalesTotal = hDirectivas + hInspector + hTecnico + hCoord + hTallerSep;

  const totalFinanciamientoDocente = subvTit + subvCon + sepTit + sepCon + pieTit + pieCon;
  const minutosContratoTotal = Math.round(horasContratoTotal * 60);

  // Horas de holgura / vacantes sin función asignada (ni aula, ni directivas, ni UTP, ni talleres)
  const horasVacantesLibresTotal = Number((totalMinutosLibresColegio / 60).toFixed(2));

  const {
    pctAula,
    pctNoLectivo,
    pctRecreo,
    pctInst,
    pctVacantes
  } = calcularPorcentajesJornadaDocente(
    horasContratoTotal,
    horasAulaCronologicasAsignadas,
    horasNoLectivasCalculadas,
    horasRecreoCalculadas,
    horasInstitucionalesTotal,
    horasVacantesLibresTotal
  );

  // Cobertura Curricular (solo aula titular del plan curricular, sin inflar con co-docencia)
  const coberturaCurricularPorcentaje = horasAulaDemandadasPlan > 0
    ? Math.min(100, Math.round((horasAulaCurricularAsignadas / horasAulaDemandadasPlan) * 100))
    : 100;
  const deficitAulaCurricular = Math.max(0, Number((horasAulaDemandadasPlan - horasAulaCurricularAsignadas).toFixed(2)));

  // Calidad Jurídica y Regla 80/20
  const pctContrata = horasContratoTotal > 0
    ? Math.round(((contrataHoras + reemplazantesHoras) / horasContratoTotal) * 1000) / 10
    : 0;
  const cumpleNorma8020 = pctContrata <= 20.0;

  // 9. Estadísticas de Asistentes de la Educación
  const statsAsistentes = calcularEstadisticasAsistentesColegio(colegio, asistentes, totalMatricula);

  // 10. Consolidado Todo el Personal
  const totalFuncionarios = docentesDedup.length + statsAsistentes.totalAsistentes;
  const totalHorasPersonal = horasContratoTotal + statsAsistentes.totalHorasContrato;

  return {
    rbd: colegio.rbd,
    nombre: colegio.nombre,
    comuna: colegio.comuna,
    regimen: colegio.regimen,
    porcentajePrioritarios: colegio.porcentajePrioritarios,
    regimenProporcion,
    totalDocentes: docentesDedup.length,
    totalCursos: cursos.length,
    totalMatricula,

    calidadJuridica: {
      titularesCount,
      titularesHoras,
      contrataCount,
      contrataHoras,
      postulandoTitularidadCount,
      postulandoTitularidadHoras,
      reemplazantesCount,
      reemplazantesHoras,
      porcentajeContrata: pctContrata,
      cumpleNorma8020
    },

    horasContratoTotal,
    minutosContratoTotal,

    horasAulaPedagogicasAsignadas: horasAulaPedagogicasRedondeadas,
    horasAulaCronologicasAsignadas,
    horasAulaDemandadasPlan,
    horasLectivasMaximasPermitidas,
    balanceAulaLectiva: horasLectivasMaximasPermitidas - horasAulaDemandadasPlan,
    coberturaCurricularPorcentaje,
    deficitAulaCurricular,

    horasNoLectivasCalculadas,
    minutosNoLectivosCalculados: minutosNoLectivosCalculadosTotal,

    horasRecreoCalculadas,
    minutosRecreoCalculados: minutosRecreoCalculadosTotal,

    horasTrabajoColaborativo: horasTrabajoColaborativoTotal,
    horasCoDocencia: horasCoDocenciaTotal,
    horasDemandaPieNormativa,
    horasColaborativasDemandadasPie,

    financiamiento: {
      subvencionGeneralTitular: subvTit,
      subvencionGeneralContrata: subvCon,
      subvencionGeneralTotal: subvTit + subvCon,
      sepTitular: sepTit,
      sepContrata: sepCon,
      sepTotal: sepTit + sepCon,
      pieTitular: pieTit,
      pieContrata: pieCon,
      pieTotal: pieTit + pieCon,
      total: totalFinanciamientoDocente
    },

    horasDirectivas: hDirectivas,
    horasInspectorGeneral: hInspector,
    horasTecnicoPedagogicas: hTecnico,
    horasCoordinacion: hCoord,
    horasTallerSepDocente: hTallerSep,
    horasInstitucionalesTotal,

    horasVacantesLibresTotal,
    porcentajeAula: pctAula,
    porcentajeNoLectivo: pctNoLectivo,
    porcentajeRecreo: pctRecreo,
    porcentajeInstitucional: pctInst,
    porcentajeVacantes: pctVacantes,

    horasSepSinAsignarTotal,
    horasPieSinAsignarTotal,
    horasSubvGeneralSinAsignarTotal,
    totalHorasSinAsignarColegio: horasSepSinAsignarTotal + horasPieSinAsignarTotal + horasSubvGeneralSinAsignarTotal,

    asistentes: statsAsistentes,

    consolidadoPersonal: {
      totalFuncionarios,
      totalHorasContratadas: totalHorasPersonal,
      subvencionGeneralHoras: (subvTit + subvCon) + statsAsistentes.subvencionGeneralHoras,
      sepHoras: (sepTit + sepCon) + statsAsistentes.sepHoras,
      pieHoras: (pieTit + pieCon) + statsAsistentes.pieHoras
    },

    desgloseDocentes
  };
}

/**
 * Calcula las estadísticas territoriales agregadas para el 100% de la cartera SLEP
 */
export function calcularEstadisticasTerritoriales(
  colegios: Establecimiento[],
  todosLosCursos: CursoSae[],
  todosLosDocentes: Docente[],
  todasLasAsignaciones: AsignacionHoraria[],
  todosLosAsistentes: AsistenteEducacion[] = []
): EstadisticasTerritorialesHoras {
  // Pre-agrupación O(N) por RBD para evitar filtros cuadráticos O(Colegios * N)
  const cursosPorRbd = new Map<string, CursoSae[]>();
  for (const c of todosLosCursos) {
    let arr = cursosPorRbd.get(c.rbd);
    if (!arr) {
      arr = [];
      cursosPorRbd.set(c.rbd, arr);
    }
    arr.push(c);
  }

  const docentesPorRbd = new Map<string, Docente[]>();
  for (const d of todosLosDocentes) {
    let arr = docentesPorRbd.get(d.rbd);
    if (!arr) {
      arr = [];
      docentesPorRbd.set(d.rbd, arr);
    }
    arr.push(d);
  }

  const asigsPorRbd = new Map<string, AsignacionHoraria[]>();
  for (const a of todasLasAsignaciones) {
    let arr = asigsPorRbd.get(a.rbd);
    if (!arr) {
      arr = [];
      asigsPorRbd.set(a.rbd, arr);
    }
    arr.push(a);
  }

  const asistPorRbd = new Map<string, AsistenteEducacion[]>();
  for (const ast of todosLosAsistentes) {
    let arr = asistPorRbd.get(ast.rbd);
    if (!arr) {
      arr = [];
      asistPorRbd.set(ast.rbd, arr);
    }
    arr.push(ast);
  }

  const porColegio: EstadisticasColegioHoras[] = colegios.map(col => {
    const cursosCol = cursosPorRbd.get(col.rbd) || [];
    const docentesCol = docentesPorRbd.get(col.rbd) || [];
    const asigsCol = asigsPorRbd.get(col.rbd) || [];
    const asistCol = asistPorRbd.get(col.rbd) || [];
    return calcularEstadisticasColegio(col, cursosCol, docentesCol, asigsCol, asistCol);
  });

  const totalDocentesPlanta = porColegio.reduce((s, c) => s + c.totalDocentes, 0);
  const totalAsistentesTerritorio = porColegio.reduce((s, c) => s + c.asistentes.totalAsistentes, 0);
  const runsUnicosDocentes = new Set(
    porColegio.flatMap(c => c.desgloseDocentes.map(d => normalizarRut(d.run))).filter(Boolean)
  ).size;
  const runsUnicosAsistentes = new Set(
    porColegio.flatMap(c => c.asistentes.desglose.map(a => normalizarRut(a.run))).filter(Boolean)
  ).size;

  let totalMatricula = 0;
  let totalCursos = 0;
  let horasContratoTotal = 0;
  let horasAulaPedagogicasTotal = 0;
  let horasAulaCronologicasTotal = 0;
  let minutosNoLectivosGlobalTotal = 0;
  let minutosRecreoGlobalTotal = 0;
  let horasColaborativoTotal = 0;
  let horasCoDocenciaTotal = 0;
  let horasDemandadasPlanTotal = 0;
  let horasLectivasMaximasTotal = 0;
  let balanceLectivoGlobal = 0;
  let deficitCurricularGlobalTotal = 0;

  // Calidad Jurídica Docente Territorial
  let titularesDocCount = 0;
  let titularesDocHoras = 0;
  let contrataDocCount = 0;
  let contrataDocHoras = 0;
  let postTitDocCount = 0;
  let postTitDocHoras = 0;
  let reemplazoDocCount = 0;
  let reemplazoDocHoras = 0;

  let subvTit = 0;
  let subvCon = 0;
  let sepTit = 0;
  let sepCon = 0;
  let pieTit = 0;
  let pieCon = 0;

  let hDirectivasTotal = 0;
  let hInspectorTotal = 0;
  let hTecnicoTotal = 0;
  let hCoordTotal = 0;
  let hInstitucionalesTotal = 0;
  let horasVacantesLibresTotal = 0;

  let horasSepSinAsignarTotal = 0;
  let horasPieSinAsignarTotal = 0;
  let horasSubvGeneralSinAsignarTotal = 0;

  // Asistentes Territoriales Agregados
  let asistTotalHoras = 0;
  let asistHorasIndefinidas = 0;
  let asistHorasPlazoFijo = 0;
  let asistHorasHonorarios = 0;
  let asistProfCount = 0;
  let asistProfHoras = 0;
  let asistTecCount = 0;
  let asistTecHoras = 0;
  let asistAdmCount = 0;
  let asistAdmHoras = 0;
  let asistAuxCount = 0;
  let asistAuxHoras = 0;
  let asistSubvGen = 0;
  let asistSep = 0;
  let asistPie = 0;
  let totalDuplas = 0;
  let totalEquipoPie = 0;

  const porComuna: EstadisticasTerritorialesHoras['porComuna'] = {};

  for (const st of porColegio) {
    totalMatricula += st.totalMatricula;
    totalCursos += st.totalCursos;
    horasContratoTotal += st.horasContratoTotal;
    horasAulaPedagogicasTotal += st.horasAulaPedagogicasAsignadas;
    horasAulaCronologicasTotal += st.horasAulaCronologicasAsignadas;
    minutosNoLectivosGlobalTotal += st.minutosNoLectivosCalculados;
    minutosRecreoGlobalTotal += st.minutosRecreoCalculados;
    horasColaborativoTotal += st.horasTrabajoColaborativo;
    horasCoDocenciaTotal += st.horasCoDocencia;
    horasDemandadasPlanTotal += st.horasAulaDemandadasPlan;
    horasLectivasMaximasTotal += st.horasLectivasMaximasPermitidas;
    balanceLectivoGlobal += st.balanceAulaLectiva;
    deficitCurricularGlobalTotal += st.deficitAulaCurricular;

    titularesDocCount += st.calidadJuridica.titularesCount;
    titularesDocHoras += st.calidadJuridica.titularesHoras;
    contrataDocCount += st.calidadJuridica.contrataCount;
    contrataDocHoras += st.calidadJuridica.contrataHoras;
    postTitDocCount += st.calidadJuridica.postulandoTitularidadCount;
    postTitDocHoras += st.calidadJuridica.postulandoTitularidadHoras;
    reemplazoDocCount += st.calidadJuridica.reemplazantesCount;
    reemplazoDocHoras += st.calidadJuridica.reemplazantesHoras;

    subvTit += st.financiamiento.subvencionGeneralTitular;
    subvCon += st.financiamiento.subvencionGeneralContrata;
    sepTit += st.financiamiento.sepTitular;
    sepCon += st.financiamiento.sepContrata;
    pieTit += st.financiamiento.pieTitular;
    pieCon += st.financiamiento.pieContrata;

    hDirectivasTotal += st.horasDirectivas;
    hInspectorTotal += st.horasInspectorGeneral;
    hTecnicoTotal += st.horasTecnicoPedagogicas;
    hCoordTotal += st.horasCoordinacion;
    hInstitucionalesTotal += st.horasInstitucionalesTotal;
    horasVacantesLibresTotal += st.horasVacantesLibresTotal;

    horasSepSinAsignarTotal += st.horasSepSinAsignarTotal;
    horasPieSinAsignarTotal += st.horasPieSinAsignarTotal;
    horasSubvGeneralSinAsignarTotal += st.horasSubvGeneralSinAsignarTotal;

    // Asistentes
    const as = st.asistentes;
    asistTotalHoras += as.totalHorasContrato;
    asistHorasIndefinidas += as.horasIndefinidas;
    asistHorasPlazoFijo += as.horasPlazoFijo;
    asistHorasHonorarios += as.horasHonorarios;
    asistProfCount += as.profesionalesCount;
    asistProfHoras += as.profesionalesHoras;
    asistTecCount += as.tecnicosCount;
    asistTecHoras += as.tecnicosHoras;
    asistAdmCount += as.administrativosCount;
    asistAdmHoras += as.administrativosHoras;
    asistAuxCount += as.auxiliaresCount;
    asistAuxHoras += as.auxiliaresHoras;
    asistSubvGen += as.subvencionGeneralHoras;
    asistSep += as.sepHoras;
    asistPie += as.pieHoras;
    if (as.duplaPsicosocial.tienePsicologo && as.duplaPsicosocial.tieneTrabajadorSocial) totalDuplas++;
    totalEquipoPie += as.equipoPie.cantidad;

    const com = st.comuna;
    if (!porComuna[com]) {
      porComuna[com] = {
        colegiosCount: 0,
        matriculaTotal: 0,
        docentesCount: 0,
        docentesHoras: 0,
        asistentesCount: 0,
        asistentesHoras: 0,
        horasContrato: 0,
        horasAulaPedagogicas: 0,
        horasNoLectivas: 0,
        horasRecreos: 0,
        horasColaborativo: 0,
        sepTotal: 0,
        pieTotal: 0,
        subvGeneralTotal: 0,
        balanceLectivo: 0,
        titularesHoras: 0,
        contrataHoras: 0,
        pctContrata: 0
      };
    }
    const pc = porComuna[com];
    pc.colegiosCount += 1;
    pc.matriculaTotal += st.totalMatricula;
    pc.docentesCount += st.totalDocentes;
    pc.docentesHoras += st.horasContratoTotal;
    pc.asistentesCount += as.totalAsistentes;
    pc.asistentesHoras += as.totalHorasContrato;
    pc.horasContrato += st.horasContratoTotal;
    pc.horasAulaPedagogicas += st.horasAulaPedagogicasAsignadas;
    pc.horasNoLectivas += st.horasNoLectivasCalculadas;
    pc.horasRecreos += st.horasRecreoCalculadas;
    pc.horasColaborativo += st.horasTrabajoColaborativo;
    pc.sepTotal = Number((pc.sepTotal + st.financiamiento.sepTotal + as.sepHoras).toFixed(2));
    pc.pieTotal = Number((pc.pieTotal + st.financiamiento.pieTotal + as.pieHoras).toFixed(2));
    pc.subvGeneralTotal = Number((pc.subvGeneralTotal + st.financiamiento.subvencionGeneralTotal + as.subvencionGeneralHoras).toFixed(2));
    pc.balanceLectivo += st.balanceAulaLectiva;
    pc.titularesHoras += st.calidadJuridica.titularesHoras;
    pc.contrataHoras += (st.calidadJuridica.contrataHoras + st.calidadJuridica.reemplazantesHoras);
    pc.pctContrata = pc.docentesHoras > 0 ? Math.round((pc.contrataHoras / pc.docentesHoras) * 1000) / 10 : 0;
  }

  const horasNoLectivasTotal = Number((minutosNoLectivosGlobalTotal / 60).toFixed(4));
  const horasRecreosTotal = Number((minutosRecreoGlobalTotal / 60).toFixed(4));
  const horasVacantesLibresRounded = Number(horasVacantesLibresTotal.toFixed(2));

  const {
    pctAula,
    pctNoLectivo,
    pctRecreo,
    pctInst,
    pctVacantes: pctVac
  } = calcularPorcentajesJornadaDocente(
    horasContratoTotal,
    horasAulaCronologicasTotal,
    horasNoLectivasTotal,
    horasRecreosTotal,
    hInstitucionalesTotal,
    horasVacantesLibresRounded
  );

  // Cobertura Curricular territorial coherente (sobre demanda curricular plan sin inflar)
  const totalAulaCurricularAsignada = Math.max(0, horasDemandadasPlanTotal - deficitCurricularGlobalTotal);
  const coberturaGlobalPct = horasDemandadasPlanTotal > 0
    ? Math.min(100, Math.round((totalAulaCurricularAsignada / horasDemandadasPlanTotal) * 100))
    : 100;

  // Calidad Jurídica Docente Territorial (Regla 80/20)
  const pctContrataTerritorial = horasContratoTotal > 0
    ? Math.round(((contrataDocHoras + reemplazoDocHoras) / horasContratoTotal) * 1000) / 10
    : 0;
  const cumpleNorma8020Territorial = pctContrataTerritorial <= 20.0;

  // Asistentes ratios
  const pctAsistIndef = asistTotalHoras > 0 ? Math.round((asistHorasIndefinidas / asistTotalHoras) * 100) : 0;
  const pctAsistPlazo = asistTotalHoras > 0 ? Math.round((asistHorasPlazoFijo / asistTotalHoras) * 100) : 0;
  const ratioAuxTerritorial = asistAuxCount > 0 && totalMatricula > 0 ? Math.round(totalMatricula / asistAuxCount) : 0;

  return {
    totalEstablecimientos: colegios.length,
    totalDocentesPlanta,
    docentesUnicosRun: runsUnicosDocentes,
    totalCursos,
    totalMatricula,

    totalPersonalSlep: totalDocentesPlanta + totalAsistentesTerritorio,
    totalHorasPersonalSlep: horasContratoTotal + asistTotalHoras,
    totalHorasSubvencionGeneralPersonal: Number(((subvTit + subvCon) + asistSubvGen).toFixed(2)),
    totalHorasSepPersonal: Number(((sepTit + sepCon) + asistSep).toFixed(2)),
    totalHorasPiePersonal: Number(((pieTit + pieCon) + asistPie).toFixed(2)),

    calidadJuridicaDocente: {
      titularesCount: titularesDocCount,
      titularesHoras: titularesDocHoras,
      contrataCount: contrataDocCount,
      contrataHoras: contrataDocHoras,
      postulandoTitularidadCount: postTitDocCount,
      postulandoTitularidadHoras: postTitDocHoras,
      reemplazantesCount: reemplazoDocCount,
      reemplazantesHoras: reemplazoDocHoras,
      porcentajeContrata: pctContrataTerritorial,
      cumpleNorma8020: cumpleNorma8020Territorial
    },

    asistentesTerritorio: {
      totalAsistentes: totalAsistentesTerritorio,
      asistentesUnicosRun: runsUnicosAsistentes,
      totalHoras: asistTotalHoras,
      horasIndefinidas: asistHorasIndefinidas,
      horasPlazoFijo: asistHorasPlazoFijo,
      horasHonorarios: asistHorasHonorarios,
      porcentajeIndefinidos: pctAsistIndef,
      porcentajePlazoFijo: pctAsistPlazo,
      profesionales: { count: asistProfCount, horas: asistProfHoras },
      tecnicos: { count: asistTecCount, horas: asistTecHoras },
      administrativos: { count: asistAdmCount, horas: asistAdmHoras },
      auxiliares: { count: asistAuxCount, horas: asistAuxHoras },
      financiamiento: {
        subvencionGeneral: asistSubvGen,
        sep: asistSep,
        pie: asistPie
      },
      ratioAlumnosPorAuxiliar: ratioAuxTerritorial,
      totalDuplasPsicosociales: totalDuplas,
      totalEquipoPie: totalEquipoPie
    },

    horasContratoTotal,
    horasAulaPedagogicasTotal: Number(horasAulaPedagogicasTotal.toFixed(2)),
    horasAulaCronologicasTotal: Number(horasAulaCronologicasTotal.toFixed(4)),
    horasNoLectivasTotal,
    horasRecreosTotal,
    horasColaborativoTotal,
    horasCoDocenciaTotal,
    horasDemandadasPlanTotal,
    horasLectivasMaximasTotal,
    balanceLectivoGlobal,
    coberturaCurricularGlobalPct: coberturaGlobalPct,
    deficitCurricularGlobalTotal,

    financiamiento: {
      subvencionGeneralTitular: subvTit,
      subvencionGeneralContrata: subvCon,
      subvencionGeneralTotal: subvTit + subvCon,
      sepTitular: sepTit,
      sepContrata: sepCon,
      sepTotal: sepTit + sepCon,
      pieTitular: pieTit,
      pieContrata: pieCon,
      pieTotal: pieTit + pieCon,
      total: subvTit + subvCon + sepTit + sepCon + pieTit + pieCon
    },

    horasDirectivasTotal: hDirectivasTotal,
    horasInspectorGeneralTotal: hInspectorTotal,
    horasTecnicoPedagogicasTotal: hTecnicoTotal,
    horasCoordinacionTotal: hCoordTotal,
    horasInstitucionalesTotal: hInstitucionalesTotal,
    horasVacantesLibresTotal: horasVacantesLibresRounded,

    horasSepSinAsignarTotal,
    horasPieSinAsignarTotal,
    horasSubvGeneralSinAsignarTotal,
    totalHorasSinAsignarTerritorio: horasSepSinAsignarTotal + horasPieSinAsignarTotal + horasSubvGeneralSinAsignarTotal,

    porcentajeAulaGlobal: pctAula,
    porcentajeNoLectivoGlobal: pctNoLectivo,
    porcentajeRecreoGlobal: pctRecreo,
    porcentajeInstitucionalGlobal: pctInst,
    porcentajeVacantesGlobal: pctVac,

    porComuna,
    porColegio
  };
}
