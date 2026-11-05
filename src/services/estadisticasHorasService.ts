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
import { normalizarRut } from '../utils/rutUtils';
import { auditarCargaDocenteIntegral } from './auditoriaDocenteService';

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

  for (const a of asistentes) {
    const hrs = Number(a.horasContrato) || 0;
    totalHoras += hrs;

    const sInd = Number(a.horasSubvencionGeneralIndefinido) || 0;
    const sPla = Number(a.horasSubvencionGeneralPlazoFijo) || 0;
    const spInd = Number(a.horasSepIndefinido) || 0;
    const spPla = Number(a.horasSepPlazoFijo) || 0;
    const pInd = Number(a.horasPieIndefinido) || 0;
    const pPla = Number(a.horasPiePlazoFijo) || 0;
    const hon = Number(a.horasHonorarios) || 0;

    const sumaFuentes = sInd + sPla + spInd + spPla + pInd + pPla + hon;
    if (sumaFuentes > 0) {
      subvGenHoras += (sInd + sPla);
      sepHoras += (spInd + spPla);
      pieHoras += (pInd + pPla);
      horasHonorarios += hon;
      horasIndefinidas += (sInd + spInd + pInd);
      horasPlazoFijo += (sPla + spPla + pPla);
    } else {
      // Inferencia por defecto si no están desglosadas las fuentes
      subvGenHoras += hrs;
      horasPlazoFijo += hrs;
    }

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
    totalAsistentes: asistentes.length,
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
    desglose: asistentes
  };
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
    const plan = obtenerPlanPorCurso(c.nivel, c.regimen);
    const hrsPlan = plan ? plan.totalHorasPlan : calcularHorasPlanCurso(c.nivel, c.regimen);
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

  // Pre-agrupar asignaciones por docenteId y coDocenteId en un solo recorrido lineal O(A)
  const asigsPorDocente = new Map<string, AsignacionHoraria[]>();
  const coAsigsPorDocente = new Map<string, AsignacionHoraria[]>();

  for (const a of asignaciones) {
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
  let horasAulaPedagogicasAsignadas = 0;
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
  let totalHorasLibresColegio = 0;

  const desgloseDocentes = docentes.map(doc => {
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

    // Financiamiento docente
    let sTit = Number(doc.horasSubvencionGeneralTitular) || 0;
    let sCon = Number(doc.horasSubvencionGeneralContrata) || 0;
    let spTit = Number(doc.horasSepTitular) || 0;
    let spCon = Number(doc.horasSepContrata) || 0;
    let pTit = Number(doc.horasPieTitular) || 0;
    let pCon = Number(doc.horasPieContrata) || 0;

    const sumaFuentesDoc = sTit + sCon + spTit + spCon + pTit + pCon;
    if (sumaFuentesDoc === 0 && hContrato > 0) {
      if (calJur === 'TITULAR') {
        sTit = hContrato;
      } else {
        sCon = hContrato;
      }
    }

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
      totalHorasSinAsignar: totalSinAsignarDoc
    } = integral;

    horasAulaPedagogicasAsignadas += haRegular;
    horasCoDocenciaTotal += haCoDocencia;
    horasTrabajoColaborativoTotal += (dColab + haTrabajoColab);

    horasLectivasMaximasPermitidas += maxHAPermitidas;
    minutosNoLectivosCalculadosTotal += auditDoc.minutosHnlTotal;
    minutosRecreoCalculadosTotal += auditDoc.minutosRecreoTotal;

    totalHorasLibresColegio += horasLibresDocente;

    horasSepSinAsignarTotal += sepSinAsignarDoc;
    horasPieSinAsignarTotal += pieSinAsignarDoc;
    horasSubvGeneralSinAsignarTotal += subvGenSinAsignarDoc;

    return {
      id: doc.id,
      run: doc.run,
      nombreCompleto: `${doc.nombres} ${doc.apellidos}`,
      estamento: doc.estamento,
      calidadJuridica: doc.calidadJuridica,
      horasContrato: hContrato,
      horasAulaPedagogicas: haRegular,
      horasNoLectivas: horasNoLectivasDoc,
      horasRecreo: horasRecreoDoc,
      horasColaborativo: dColab + haTrabajoColab,
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

  const horasAulaCronologicasAsignadas = Math.round((horasAulaPedagogicasAsignadas * 45 / 60) * 10) / 10;
  const horasNoLectivasCalculadas = Math.round((minutosNoLectivosCalculadosTotal / 60) * 10) / 10;
  const horasRecreoCalculadas = Math.round((minutosRecreoCalculadosTotal / 60) * 10) / 10;
  const horasInstitucionalesTotal = hDirectivas + hInspector + hTecnico + hCoord + hTallerSep;

  const totalFinanciamientoDocente = subvTit + subvCon + sepTit + sepCon + pieTit + pieCon;
  const minutosContratoTotal = Math.round(horasContratoTotal * 60);

  // Horas de holgura / vacantes sin función asignada (ni aula, ni directivas, ni UTP, ni talleres)
  const horasVacantesLibresTotal = totalHorasLibresColegio;

  const pctAula = horasContratoTotal > 0 ? Math.round((horasAulaCronologicasAsignadas / horasContratoTotal) * 100) : 0;
  const pctNoLectivo = horasContratoTotal > 0 ? Math.round((horasNoLectivasCalculadas / horasContratoTotal) * 100) : 0;
  const pctRecreo = horasContratoTotal > 0 ? Math.round((horasRecreoCalculadas / horasContratoTotal) * 100) : 0;
  const pctInst = horasContratoTotal > 0 ? Math.round((horasInstitucionalesTotal / horasContratoTotal) * 100) : 0;
  const pctVacantes = Math.max(0, 100 - (pctAula + pctNoLectivo + pctRecreo + pctInst));

  // Cobertura Curricular
  const coberturaCurricularPorcentaje = horasAulaDemandadasPlan > 0
    ? Math.min(100, Math.round((horasAulaPedagogicasAsignadas / horasAulaDemandadasPlan) * 100))
    : 100;
  const deficitAulaCurricular = Math.max(0, horasAulaDemandadasPlan - horasAulaPedagogicasAsignadas);

  // Calidad Jurídica y Regla 80/20
  const pctContrata = horasContratoTotal > 0
    ? Math.round(((contrataHoras + reemplazantesHoras) / horasContratoTotal) * 1000) / 10
    : 0;
  const cumpleNorma8020 = pctContrata <= 20.0;

  // 9. Estadísticas de Asistentes de la Educación
  const statsAsistentes = calcularEstadisticasAsistentesColegio(colegio, asistentes, totalMatricula);

  // 10. Consolidado Todo el Personal
  const totalFuncionarios = docentes.length + statsAsistentes.totalAsistentes;
  const totalHorasPersonal = horasContratoTotal + statsAsistentes.totalHorasContrato;

  return {
    rbd: colegio.rbd,
    nombre: colegio.nombre,
    comuna: colegio.comuna,
    regimen: colegio.regimen,
    porcentajePrioritarios: colegio.porcentajePrioritarios,
    regimenProporcion,
    totalDocentes: docentes.length,
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

    horasAulaPedagogicasAsignadas,
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

  const runsUnicosDocentes = new Set(todosLosDocentes.map(d => normalizarRut(d.run)).filter(Boolean)).size;
  const runsUnicosAsistentes = new Set(todosLosAsistentes.map(a => normalizarRut(a.run)).filter(Boolean)).size;

  let totalMatricula = 0;
  let totalCursos = 0;
  let horasContratoTotal = 0;
  let horasAulaPedagogicasTotal = 0;
  let horasAulaCronologicasTotal = 0;
  let horasNoLectivasTotal = 0;
  let horasRecreosTotal = 0;
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
    horasNoLectivasTotal += st.horasNoLectivasCalculadas;
    horasRecreosTotal += st.horasRecreoCalculadas;
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
    pc.sepTotal += (st.financiamiento.sepTotal + as.sepHoras);
    pc.pieTotal += (st.financiamiento.pieTotal + as.pieHoras);
    pc.subvGeneralTotal += (st.financiamiento.subvencionGeneralTotal + as.subvencionGeneralHoras);
    pc.balanceLectivo += st.balanceAulaLectiva;
    pc.titularesHoras += st.calidadJuridica.titularesHoras;
    pc.contrataHoras += (st.calidadJuridica.contrataHoras + st.calidadJuridica.reemplazantesHoras);
    pc.pctContrata = pc.docentesHoras > 0 ? Math.round((pc.contrataHoras / pc.docentesHoras) * 1000) / 10 : 0;
  }

  const pctAula = horasContratoTotal > 0 ? Math.round((horasAulaCronologicasTotal / horasContratoTotal) * 100) : 0;
  const pctNoLectivo = horasContratoTotal > 0 ? Math.round((horasNoLectivasTotal / horasContratoTotal) * 100) : 0;
  const pctRecreo = horasContratoTotal > 0 ? Math.round((horasRecreosTotal / horasContratoTotal) * 100) : 0;
  const pctInst = horasContratoTotal > 0 ? Math.round((hInstitucionalesTotal / horasContratoTotal) * 100) : 0;
  const pctVac = Math.max(0, 100 - (pctAula + pctNoLectivo + pctRecreo + pctInst));

  const coberturaGlobalPct = horasDemandadasPlanTotal > 0
    ? Math.min(100, Math.round((horasAulaPedagogicasTotal / horasDemandadasPlanTotal) * 100))
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
    totalDocentesPlanta: todosLosDocentes.length,
    docentesUnicosRun: runsUnicosDocentes,
    totalCursos,
    totalMatricula,

    totalPersonalSlep: todosLosDocentes.length + todosLosAsistentes.length,
    totalHorasPersonalSlep: horasContratoTotal + asistTotalHoras,
    totalHorasSubvencionGeneralPersonal: (subvTit + subvCon) + asistSubvGen,
    totalHorasSepPersonal: (sepTit + sepCon) + asistSep,
    totalHorasPiePersonal: (pieTit + pieCon) + asistPie,

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
      totalAsistentes: todosLosAsistentes.length,
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
    horasAulaPedagogicasTotal,
    horasAulaCronologicasTotal: Math.round(horasAulaCronologicasTotal * 10) / 10,
    horasNoLectivasTotal: Math.round(horasNoLectivasTotal * 10) / 10,
    horasRecreosTotal: Math.round(horasRecreosTotal * 10) / 10,
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
    horasVacantesLibresTotal,

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
