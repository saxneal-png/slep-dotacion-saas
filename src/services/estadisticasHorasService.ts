import {
  Establecimiento,
  CursoSae,
  Docente,
  AsignacionHoraria,
  ComunaValleDiguillin
} from '../types';
import {
  calcularJornadaMinutos,
  calcularAuditoriaDocenteMultitramo,
  buscarContratoMinimoPorTabla,
  obtenerPlanPorCurso,
  calcularDemandaNormativaPieCurso
} from '@slep/mineduc-engine';
import { normalizarRut } from '../utils/rutUtils';

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

  // Horas Contractuales y de Jornada
  horasContratoTotal: number;
  minutosContratoTotal: number;

  // 1. Horas de Aula (Lectivas)
  horasAulaPedagogicasAsignadas: number;
  horasAulaCronologicasAsignadas: number; // HA * 45 / 60
  horasAulaDemandadasPlan: number; // Demanda MINEDUC + Talleres JEC
  horasLectivasMaximasPermitidas: number;
  balanceAulaLectiva: number; // Disponibles vs Demandadas

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

  // 5. Fuentes de Financiamiento
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

  // 7. Porcentajes de Distribución de la Jornada
  porcentajeAula: number;
  porcentajeNoLectivo: number;
  porcentajeRecreo: number;
  porcentajeInstitucional: number;

  // 8. Horas Sin Asignar / Vacantes desglosadas por Subvención
  horasSepSinAsignarTotal: number;
  horasPieSinAsignarTotal: number;
  horasSubvGeneralSinAsignarTotal: number;
  totalHorasSinAsignarColegio: number;

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
  }[];
}

export interface EstadisticasTerritorialesHoras {
  totalEstablecimientos: number;
  totalDocentesPlanta: number;
  docentesUnicosRun: number;
  totalCursos: number;
  totalMatricula: number;

  // Totales de Jornada
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

  // Financiamiento Consolidado
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

  // Porcentajes Globales
  porcentajeAulaGlobal: number;
  porcentajeNoLectivoGlobal: number;
  porcentajeRecreoGlobal: number;
  porcentajeInstitucionalGlobal: number;

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
      horasContrato: number;
      horasAulaPedagogicas: number;
      horasNoLectivas: number;
      horasRecreos: number;
      horasColaborativo: number;
      sepTotal: number;
      pieTotal: number;
      subvGeneralTotal: number;
      balanceLectivo: number;
    };
  };

  // Escuelas individuales procesadas
  porColegio: EstadisticasColegioHoras[];
}

/**
 * Calcula el resumen estadístico exhaustivo de horas para un establecimiento escolar específico
 */
export function calcularEstadisticasColegio(
  colegio: Establecimiento,
  cursos: CursoSae[],
  docentes: Docente[],
  asignaciones: AsignacionHoraria[]
): EstadisticasColegioHoras {
  const regimenProporcion: '60/40' | '65/35' = colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35';
  const regimenTabla = colegio.porcentajePrioritarios >= 80 ? '60_40' : '65_35';

  let totalMatricula = 0;
  let horasAulaDemandadasPlan = 0;
  let horasDemandaPieNormativa = 0;
  let horasColaborativasDemandadasPie = 0;

  // 1. Demanda de Cursos y PIE
  for (const c of cursos) {
    totalMatricula += c.matriculaProyectada || 0;
    const plan = obtenerPlanPorCurso(c.nivel, c.regimen);
    const hrsPlan = plan ? plan.totalHorasPlan : (c.regimen === 'JEC' ? 38 : 30);
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

  // 2. Acumuladores de Planta Docente
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

  const desgloseDocentes = docentes.map(doc => {
    horasContratoTotal += doc.horasContrato;

    // Financiamiento docente
    const sTit = doc.horasSubvencionGeneralTitular || (doc.calidadJuridica === 'TITULAR' && !doc.horasSepTitular && !doc.horasPieTitular ? doc.horasContrato : 0);
    const sCon = doc.horasSubvencionGeneralContrata || (doc.calidadJuridica === 'CONTRATA' && !doc.horasSepContrata && !doc.horasPieContrata ? doc.horasContrato : 0);
    const spTit = doc.horasSepTitular || 0;
    const spCon = doc.horasSepContrata || 0;
    const pTit = doc.horasPieTitular || 0;
    const pCon = doc.horasPieContrata || 0;

    subvTit += sTit;
    subvCon += sCon;
    sepTit += spTit;
    sepCon += spCon;
    pieTit += pTit;
    pieCon += pCon;

    // Institucionales
    const dDir = doc.horasDirectivas || 0;
    const dInsp = doc.horasInspectorGeneral || 0;
    const dTec = doc.horasTecnicoPedagogicas || 0;
    const dCoord = (doc.horasCoordinacion || 0) + (doc.horasCoordinacionPie || 0) + (doc.horasConvivenciaEscolar || 0) + (doc.horasExtraescolar || 0);
    const dTallerSep = doc.horasTallerSep || 0;
    const dColab = doc.horasTrabajoColaborativo || 0;

    hDirectivas += dDir;
    hInspector += dInsp;
    hTecnico += dTec;
    hCoord += dCoord;
    hTallerSep += dTallerSep;

    // Asignaciones del docente en esta escuela
    const docAsigs = asignaciones.filter(a => a.docenteId === doc.id);
    const coDocAsigs = asignaciones.filter(a => a.coDocenteId === doc.id && a.tieneCoDocente);

    const asigsRegulares = docAsigs.filter(a => !a.esCoDocencia && !a.esTallerSep && !a.esTrabajoColaborativo && a.tipoApoyo !== 'TRABAJO_COLABORATIVO');
    const asigsCoDoc = [...docAsigs.filter(a => a.esCoDocencia), ...coDocAsigs];
    const asigsColab = docAsigs.filter(a => a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO' || a.asignatura.toLowerCase().includes('colaborativ'));

    const haRegular = asigsRegulares.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
    const haCoDoc = asigsCoDoc.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
    const haColab = asigsColab.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

    horasAulaPedagogicasAsignadas += haRegular;
    horasCoDocenciaTotal += haCoDoc;
    horasTrabajoColaborativoTotal += (dColab + haColab);

    const isPieDoc = doc.estamento === 'DOCENTE_DIFERENCIAL' || ((pTit + pCon) > 0 && (sTit + sCon) === 0);
    const asigsDocenciaEfectiva = isPieDoc
      ? asigsRegulares
      : [...asigsRegulares, ...asigsCoDoc];

    const sumFuncionesNoAulaSep = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
      ? doc.funcionesNoAula.filter(f => f.financiamiento === 'SEP' || /sep/i.test(f.financiamiento || '') || /sep/i.test(f.nombre || '')).reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;
    const sumFuncionesNoAulaPie = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
      ? doc.funcionesNoAula.filter(f => f.financiamiento === 'PIE' || /pie/i.test(f.financiamiento || '') || (f.nombre && /pie/i.test(f.nombre))).reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;
    const sumFuncionesNoAulaSubvGen = (doc.funcionesNoAula && doc.funcionesNoAula.length > 0)
      ? doc.funcionesNoAula.filter(f => !/sep/i.test(f.financiamiento || '') && !/sep/i.test(f.nombre || '') && !/pie/i.test(f.financiamiento || '') && !(f.nombre && /pie/i.test(f.nombre))).reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;

    const sepExentas = isPieDoc
      ? Math.max(spTit + spCon, dTallerSep, sumFuncionesNoAulaSep)
      : (Math.max(dTallerSep, docAsigs.filter(a => a.esTallerSep).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0)) + sumFuncionesNoAulaSep);
    const pieCronologicas = isPieDoc
      ? Math.max(pTit + pCon, dColab, haColab + sumFuncionesNoAulaPie)
      : Math.max(dColab, haColab) + sumFuncionesNoAulaPie;

    const hExentas = dDir + dInsp + dTec + dCoord + sepExentas + pieCronologicas + sumFuncionesNoAulaSubvGen;
    const hAfectasDocencia = Math.max(0, doc.horasContrato - hExentas);

    // Separar horas efectivas según régimen del curso (60/40 vs 65/35) para cálculo independiente
    const ha60 = asigsDocenciaEfectiva
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80);
      })
      .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

    const ha65 = asigsDocenciaEfectiva
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
      })
      .reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

    // Auditoría multitramo oficial MINEDUC (calcula 60/40 y 65/35 por separado y suma minutos de recreo, lectivas y HNL)
    const auditDoc = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: ha65,
      horasAula60_40: ha60,
      horasPieCronologicas: pieCronologicas,
      horasTallerSepExento: sepExentas,
      horasNoAulaInstitucionales: dDir + dInsp + dTec + dCoord + sumFuncionesNoAulaSubvGen,
      horasContratoReal: doc.horasContrato,
      aplicaArticulo69: Boolean(doc.aplicaArticulo69)
    });

    const maxHAPermitidas = Math.floor(auditDoc.minutosLimitePermitido / 45);
    horasLectivasMaximasPermitidas += maxHAPermitidas;
    minutosNoLectivosCalculadosTotal += auditDoc.minutosHnlTotal;
    minutosRecreoCalculadosTotal += auditDoc.minutosRecreoTotal;

    const horasNoLectivasDoc = Math.round((auditDoc.minutosHnlTotal / 60) * 10) / 10;
    const horasRecreoDoc = Math.round((auditDoc.minutosRecreoTotal / 60) * 10) / 10;

    const asigsSepAula = isPieDoc ? [] : docAsigs.filter(a => a.esTallerSep || a.tipoApoyo === 'TALLER_SEP' || (a.esCoDocencia && (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP')));
    const pedSep65 = asigsSepAula.filter(a => { const c = cursos.find(x => x.id === a.cursoId); return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80); }).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
    const pedSep60 = asigsSepAula.filter(a => { const c = cursos.find(x => x.id === a.cursoId); return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80); }).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
    const reqSepDoc = (pedSep65 > 0 || pedSep60 > 0)
      ? (buscarContratoMinimoPorTabla(pedSep65, '65_35') + buscarContratoMinimoPorTabla(pedSep60, '60_40') + sumFuncionesNoAulaSep)
      : (dTallerSep + sumFuncionesNoAulaSep);

    const pedCurricular65 = asigsRegulares.filter(a => { const c = cursos.find(x => x.id === a.cursoId); return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80); }).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
    const pedCurricular60 = asigsRegulares.filter(a => { const c = cursos.find(x => x.id === a.cursoId); return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80); }).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
    const reqSubvDoc = buscarContratoMinimoPorTabla(pedCurricular65, '65_35') + buscarContratoMinimoPorTabla(pedCurricular60, '60_40') + dDir + dInsp + dTec + dCoord + sumFuncionesNoAulaSubvGen;

    const sepAsignadasDoc = reqSepDoc;
    const pieAsignadasDoc = (isPieDoc ? Math.max(pTit + pCon, haColab + sumFuncionesNoAulaPie) : (dColab + haColab + sumFuncionesNoAulaPie));

    const sepSinAsignarDoc = Math.max(0, (spTit + spCon) - sepAsignadasDoc);
    const pieSinAsignarDoc = Math.max(0, (pTit + pCon) - pieAsignadasDoc);
    const subvGenSinAsignarDoc = Math.max(0, (sTit + sCon) - reqSubvDoc);
    const totalSinAsignarDoc = sepSinAsignarDoc + pieSinAsignarDoc + subvGenSinAsignarDoc;

    horasSepSinAsignarTotal += sepSinAsignarDoc;
    horasPieSinAsignarTotal += pieSinAsignarDoc;
    horasSubvGeneralSinAsignarTotal += subvGenSinAsignarDoc;

    return {
      id: doc.id,
      run: doc.run,
      nombreCompleto: `${doc.nombres} ${doc.apellidos}`,
      estamento: doc.estamento,
      calidadJuridica: doc.calidadJuridica,
      horasContrato: doc.horasContrato,
      horasAulaPedagogicas: haRegular,
      horasNoLectivas: horasNoLectivasDoc,
      horasRecreo: horasRecreoDoc,
      horasColaborativo: dColab + haColab,
      horasSep: spTit + spCon,
      horasPie: pTit + pCon,
      horasSubvGeneral: sTit + sCon,
      horasInstitucionales: hExentas,
      estaSobreasignado: auditDoc.esInfractorExcesoLectivo || (doc.horasContrato > 0 && auditDoc.saldoHoras < 0),
      horasSepAsignadas: sepAsignadasDoc,
      horasSepSinAsignar: sepSinAsignarDoc,
      horasPieAsignadas: pieAsignadasDoc,
      horasPieSinAsignar: pieSinAsignarDoc,
      horasSubvGeneralSinAsignar: subvGenSinAsignarDoc,
      totalHorasSinAsignar: totalSinAsignarDoc
    };
  });

  const horasAulaCronologicasAsignadas = Math.round((horasAulaPedagogicasAsignadas * 45 / 60) * 10) / 10;
  const horasNoLectivasCalculadas = Math.round((minutosNoLectivosCalculadosTotal / 60) * 10) / 10;
  const horasRecreoCalculadas = Math.round((minutosRecreoCalculadosTotal / 60) * 10) / 10;
  const horasInstitucionalesTotal = hDirectivas + hInspector + hTecnico + hCoord + hTallerSep;

  const totalFinanciamiento = subvTit + subvCon + sepTit + sepCon + pieTit + pieCon;
  const minutosContratoTotal = Math.round(horasContratoTotal * 60);

  const pctAula = horasContratoTotal > 0 ? Math.round((horasAulaCronologicasAsignadas / horasContratoTotal) * 100) : 0;
  const pctNoLectivo = horasContratoTotal > 0 ? Math.round((horasNoLectivasCalculadas / horasContratoTotal) * 100) : 0;
  const pctRecreo = horasContratoTotal > 0 ? Math.round((horasRecreoCalculadas / horasContratoTotal) * 100) : 0;
  const pctInst = horasContratoTotal > 0 ? Math.round((horasInstitucionalesTotal / horasContratoTotal) * 100) : 0;

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

    horasContratoTotal,
    minutosContratoTotal,

    horasAulaPedagogicasAsignadas,
    horasAulaCronologicasAsignadas,
    horasAulaDemandadasPlan,
    horasLectivasMaximasPermitidas,
    balanceAulaLectiva: horasLectivasMaximasPermitidas - horasAulaDemandadasPlan,

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
      total: totalFinanciamiento
    },

    horasDirectivas: hDirectivas,
    horasInspectorGeneral: hInspector,
    horasTecnicoPedagogicas: hTecnico,
    horasCoordinacion: hCoord,
    horasTallerSepDocente: hTallerSep,
    horasInstitucionalesTotal,

    porcentajeAula: pctAula,
    porcentajeNoLectivo: pctNoLectivo,
    porcentajeRecreo: pctRecreo,
    porcentajeInstitucional: pctInst,

    horasSepSinAsignarTotal,
    horasPieSinAsignarTotal,
    horasSubvGeneralSinAsignarTotal,
    totalHorasSinAsignarColegio: horasSepSinAsignarTotal + horasPieSinAsignarTotal + horasSubvGeneralSinAsignarTotal,

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
  todasLasAsignaciones: AsignacionHoraria[]
): EstadisticasTerritorialesHoras {
  const porColegio: EstadisticasColegioHoras[] = colegios.map(col => {
    const cursosCol = todosLosCursos.filter(c => c.rbd === col.rbd);
    const docentesCol = todosLosDocentes.filter(d => d.rbd === col.rbd);
    const asigsCol = todasLasAsignaciones.filter(a => a.rbd === col.rbd);
    return calcularEstadisticasColegio(col, cursosCol, docentesCol, asigsCol);
  });

  const runsUnicos = new Set(todosLosDocentes.map(d => normalizarRut(d.run)).filter(Boolean)).size;

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

  let horasSepSinAsignarTotal = 0;
  let horasPieSinAsignarTotal = 0;
  let horasSubvGeneralSinAsignarTotal = 0;

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

    horasSepSinAsignarTotal += st.horasSepSinAsignarTotal;
    horasPieSinAsignarTotal += st.horasPieSinAsignarTotal;
    horasSubvGeneralSinAsignarTotal += st.horasSubvGeneralSinAsignarTotal;

    const com = st.comuna;
    if (!porComuna[com]) {
      porComuna[com] = {
        colegiosCount: 0,
        matriculaTotal: 0,
        horasContrato: 0,
        horasAulaPedagogicas: 0,
        horasNoLectivas: 0,
        horasRecreos: 0,
        horasColaborativo: 0,
        sepTotal: 0,
        pieTotal: 0,
        subvGeneralTotal: 0,
        balanceLectivo: 0
      };
    }
    const pc = porComuna[com];
    pc.colegiosCount += 1;
    pc.matriculaTotal += st.totalMatricula;
    pc.horasContrato += st.horasContratoTotal;
    pc.horasAulaPedagogicas += st.horasAulaPedagogicasAsignadas;
    pc.horasNoLectivas += st.horasNoLectivasCalculadas;
    pc.horasRecreos += st.horasRecreoCalculadas;
    pc.horasColaborativo += st.horasTrabajoColaborativo;
    pc.sepTotal += st.financiamiento.sepTotal;
    pc.pieTotal += st.financiamiento.pieTotal;
    pc.subvGeneralTotal += st.financiamiento.subvencionGeneralTotal;
    pc.balanceLectivo += st.balanceAulaLectiva;
  }

  const pctAula = horasContratoTotal > 0 ? Math.round((horasAulaCronologicasTotal / horasContratoTotal) * 100) : 0;
  const pctNoLectivo = horasContratoTotal > 0 ? Math.round((horasNoLectivasTotal / horasContratoTotal) * 100) : 0;
  const pctRecreo = horasContratoTotal > 0 ? Math.round((horasRecreosTotal / horasContratoTotal) * 100) : 0;
  const pctInst = horasContratoTotal > 0 ? Math.round((hInstitucionalesTotal / horasContratoTotal) * 100) : 0;

  return {
    totalEstablecimientos: colegios.length,
    totalDocentesPlanta: todosLosDocentes.length,
    docentesUnicosRun: runsUnicos,
    totalCursos,
    totalMatricula,

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

    horasSepSinAsignarTotal,
    horasPieSinAsignarTotal,
    horasSubvGeneralSinAsignarTotal,
    totalHorasSinAsignarTerritorio: horasSepSinAsignarTotal + horasPieSinAsignarTotal + horasSubvGeneralSinAsignarTotal,

    porcentajeAulaGlobal: pctAula,
    porcentajeNoLectivoGlobal: pctNoLectivo,
    porcentajeRecreoGlobal: pctRecreo,
    porcentajeInstitucionalGlobal: pctInst,

    porComuna,
    porColegio
  };
}
