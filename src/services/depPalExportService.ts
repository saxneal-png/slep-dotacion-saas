/**
 * Servicio de Ingesta y Exportación de la Planilla Final PAL 2027 DEP (Territorial)
 * SLEP Valle Diguillín
 */

import ExcelJS from 'exceljs';
import { Docente, AsistenteEducacion, Establecimiento, CursoSae, AsignacionHoraria } from '../types';
import {
  homologarDocenteAPal,
  homologarAsistenteAPal,
  sanitizeExcelText,
  homologarNivelExcelPal
} from './depHomologationEngine';
import { calcularHorasPlanCurso, determinarRegimenNormativo } from '@slep/mineduc-engine';
import { proyectarMatriculaNivel } from './proyeccionMatriculaService';
import { guardarDocentesBatch } from '../database/repositories/docentesRepo';
import { guardarAsistentesBatch } from '../database/repositories/asistentesRepo';
import { guardarEstablecimiento, listarEstablecimientos } from '../database/repositories/establecimientosRepo';
import { cargarPlantillaOficialBuffer } from './templateLoaderService';

/**
 * Calcula las horas de contrato docente reglamentarias MINEDUC para una demanda de aula (Total HA),
 * aplicando la proporción legal del establecimiento y nivel (Ley N° 20.903 y DFL 1/1996)
 * con las adecuaciones de la tabla reglamentaria oficial:
 * - Régimen 65/35: jornada de 44 hrs cubre hasta 38 HA -> Math.ceil(totalHA * 44 / 38)
 * - Régimen 60/40: jornada de 44 hrs cubre hasta 35 HA -> Math.ceil(totalHA * 44 / 35)
 */
export function calcularHorasContratoPorPlan(
  totalHA: number,
  regimen: '65_35' | '60_40' = '65_35'
): number {
  if (totalHA <= 0) return 0;
  const maxHA = regimen === '60_40' ? 35 : 38;
  return Math.ceil((totalHA * 44) / maxHA);
}

/**
 * Obtiene el buffer de la plantilla oficial PAL 2027
 */
async function obtenerPlantillaPalBuffer(): Promise<ArrayBuffer> {
  return await cargarPlantillaOficialBuffer('Planilla_Final_PAL_2027_DEP_Template.xlsx');
}

/**
 * Ingesta territorial: Lee el libro PAL 2027 oficial e importa todos los Docentes y Asistentes a la app
 */
export async function importarPlanillaPalDEP(
  fileBuffer: ArrayBuffer | Uint8Array,
  periodo: number = 2027
): Promise<{
  docentesImportados: number;
  asistentesImportados: number;
  colegiosDetectados: number;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);

  const colegiosExistentes = await listarEstablecimientos();
  const colegiosMap = new Map<number, Establecimiento>();
  colegiosExistentes.forEach(c => colegiosMap.set(Number(c.rbd), c));

  // 1. Ingesta de Info Funcionario (DOCENTE)
  const wsDocentes = workbook.getWorksheet('Info Funcionario (DOCENTE)');
  const docentesNuevos: Docente[] = [];

  if (wsDocentes) {
    wsDocentes.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return; // Omitir cabeceras
      const rutRaw = String(row.getCell(1).text || '').trim();
      const nombreEE = String(row.getCell(2).text || '').trim();
      const rbdNum = Number(row.getCell(3).value || 0);

      if (!rutRaw || !rbdNum) return;

      // Asegurar que el colegio exista en memoria para mapeos sin persistir arbitrariamente en DB
      if (!colegiosMap.has(rbdNum) && nombreEE) {
        const nuevoColegio: Establecimiento = {
          id: `est_${rbdNum}`,
          rbd: String(rbdNum),
          nombre: nombreEE,
          comuna: 'Chillán',
          regimen: 'JEC',
          porcentajePrioritarios: 75
        };
        colegiosMap.set(rbdNum, nuevoColegio);
      }

      const calidadContratoStr = String(row.getCell(8).text || '').toLowerCase();
      const calidadJuridica = calidadContratoStr.includes('titular') ? 'TITULAR' : 'CONTRATA';
      const cargoStr = String(row.getCell(6).text || '').trim();
      const funcionStr = String(row.getCell(7).text || '').trim();
      const art69Str = String(row.getCell(9).text || '').trim();

      const totalHrsContrato = Number(row.getCell(10).value || 0);
      const hrsBasica = Number(row.getCell(11).value || 0);
      const hrsMedia = Number(row.getCell(12).value || 0);
      const hrsPie = Number(row.getCell(16).value || 0);
      const hrsSep = Number(row.getCell(17).value || 0);
      const otrasFunciones = Number(row.getCell(18).value || 0);
      const obs = String(row.getCell(19).text || '').trim();

      // Desglose por fuente según calidad jurídica
      let subvTit = 0;
      let subvCtta = 0;
      let pieTit = 0;
      let pieCtta = 0;
      let sepTit = 0;
      let sepCtta = 0;

      const hrsSubvencion = Math.max(0, totalHrsContrato - (hrsPie + hrsSep));
      if (calidadJuridica === 'TITULAR') {
        subvTit = hrsSubvencion;
        pieTit = hrsPie;
        sepTit = hrsSep;
      } else {
        subvCtta = hrsSubvencion;
        pieCtta = hrsPie;
        sepCtta = hrsSep;
      }

      docentesNuevos.push({
        id: `pal_doc_${rbdNum}_${rutRaw.replace(/[^0-9kK]/g, '')}`,
        rbd: String(rbdNum),
        periodo,
        run: rutRaw,
        nombres: cargoStr || 'Docente',
        apellidos: '',
        calidadJuridica,
        estamento: /educadora/i.test(String(row.getCell(5).text || '')) ? 'OTRA_ESTABLECIMIENTO' : 'DOCENTE_AULA',
        horasContrato: totalHrsContrato,
        horasSubvencionGeneralTitular: subvTit,
        horasSubvencionGeneralContrata: subvCtta,
        horasPieTitular: pieTit,
        horasPieContrata: pieCtta,
        horasSepTitular: sepTit,
        horasSepContrata: sepCtta,
        horasAula: hrsBasica + hrsMedia,
        cargoInstitucional: cargoStr,
        funcionPrincipal: funcionStr,
        aplicaArticulo69: /si|art/i.test(art69Str),
        horasDirectivas: /directiv/i.test(funcionStr) ? otrasFunciones : 0,
        horasTecnicoPedagogicas: /técnico|pedagóg/i.test(funcionStr) ? otrasFunciones : 0,
        observacionesDirector: obs,
        propuestaGdp: 'Continuidad',
        horasVigentesAnterior: totalHrsContrato
      });
    });

    if (docentesNuevos.length > 0) {
      await guardarDocentesBatch(docentesNuevos);
    }
  }

  // 2. Ingesta de Info Funcionario (AE)
  const wsAsistentes = workbook.getWorksheet('Info Funcionario (AE)');
  const asistentesNuevos: AsistenteEducacion[] = [];

  if (wsAsistentes) {
    wsAsistentes.eachRow((row, rowNumber) => {
      if (rowNumber <= 2) return;
      const rutRaw = String(row.getCell(1).text || '').trim();
      const rbdNum = Number(row.getCell(3).value || 0);

      if (!rutRaw || !rbdNum) return;

      const cargoStr = String(row.getCell(6).text || '').trim();
      const funcionStr = String(row.getCell(7).text || '').trim();
      const calidadContratoStr = String(row.getCell(8).text || '').toLowerCase();
      const esIndefinido = calidadContratoStr.includes('indefinido');

      let estamento: any = 'ADMINISTRATIVO';
      if (/profesional/i.test(funcionStr)) estamento = 'PROFESIONAL';
      else if (/técnic/i.test(funcionStr)) estamento = 'TECNICO';
      else if (/auxiliar/i.test(funcionStr)) estamento = 'AUXILIAR';

      const totalHrs = Number(row.getCell(9).value || 0);
      const hGral = Number(row.getCell(10).value || 0);
      const hPie = Number(row.getCell(11).value || 0);
      const hSep = Number(row.getCell(12).value || 0);
      const obs = String(row.getCell(13).text || '').trim();

      asistentesNuevos.push({
        id: `pal_ae_${rbdNum}_${rutRaw.replace(/[^0-9kK]/g, '')}`,
        rbd: String(rbdNum),
        periodo,
        run: rutRaw,
        nombres: cargoStr || 'Asistente',
        apellidos: '',
        cargoFuncion: cargoStr,
        estamento,
        horasContrato: totalHrs,
        horasSubvencionGeneralIndefinido: esIndefinido ? hGral : 0,
        horasSubvencionGeneralPlazoFijo: !esIndefinido ? hGral : 0,
        horasSepIndefinido: esIndefinido ? hSep : 0,
        horasSepPlazoFijo: !esIndefinido ? hSep : 0,
        horasPieIndefinido: esIndefinido ? hPie : 0,
        horasPiePlazoFijo: !esIndefinido ? hPie : 0,
        esTecnicoParvulo: /párvulo|parvulo/i.test(cargoStr),
        esAuxiliarServicio: estamento === 'AUXILIAR',
        observaciones: obs,
        activo: true,
        propuestaGdp: 'Continuidad',
        horasVigentesAnterior: totalHrs
      });
    });

    if (asistentesNuevos.length > 0) {
      await guardarAsistentesBatch(asistentesNuevos);
    }
  }

  return {
    docentesImportados: docentesNuevos.length,
    asistentesImportados: asistentesNuevos.length,
    colegiosDetectados: colegiosMap.size
  };
}

/**
 * Exporta el libro oficial PAL 2027 DEP (Territorial Único)
 * Respetando estrictamente las fórmulas nativas de Excel y rellenando solo las celdas de entrada.
 */
export async function generarExcelConsolidadoPalDEP(
  establecimientos: Establecimiento[],
  docentesTerritorio: Docente[],
  asistentesTerritorio: AsistenteEducacion[],
  cursosTerritorio: CursoSae[] = [],
  asignacionesTerritorio: AsignacionHoraria[] = []
): Promise<Uint8Array> {
  const plantillaBuffer = await obtenerPlantillaPalBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(plantillaBuffer);

  // Sanitización de esquema OpenXML (ECMA-376):
  // Desactivar fitToPage para evitar problemas de compatibilidad en hojas PAL
  workbook.eachSheet((ws) => {
    if (ws.pageSetup) {
      ws.pageSetup.fitToPage = false;
    }
  });

  const wsDoc = workbook.getWorksheet('Info Funcionario (DOCENTE)');
  const wsAe = workbook.getWorksheet('Info Funcionario (AE)');
  const wsEst = workbook.getWorksheet('Info Establecimiento');

  if (!wsDoc || !wsAe) {
    throw new Error('La plantilla base no contiene las hojas requeridas Info Funcionario (DOCENTE) o (AE)');
  }

  // 1. Poblado de Info Funcionario (DOCENTE)
  // Limpiar filas anteriores de la tabla manteniendo estilos de fila 3
  const rowStartDoc = 3;
  let currentRowDoc = rowStartDoc;

  for (const est of establecimientos) {
    const docColegio = docentesTerritorio.filter(d => String(d.rbd) === String(est.rbd));
    const cursosColegio = cursosTerritorio.filter(c => String(c.rbd) === String(est.rbd));
    const asigsColegio = asignacionesTerritorio.filter(a => String(a.rbd) === String(est.rbd));

    for (const d of docColegio) {
      const filasHomologadas = homologarDocenteAPal(d, est, cursosColegio, asigsColegio);

      for (const f of filasHomologadas) {
        const row = wsDoc.getRow(currentRowDoc);

        // Inputs (Cols A a M, y Cols P a S) con sanitización de inyección de fórmulas
        row.getCell(1).value = sanitizeExcelText(f.rut);
        row.getCell(2).value = sanitizeExcelText(f.establecimiento);
        row.getCell(3).value = f.rbd;
        row.getCell(4).value = f.nivel;
        row.getCell(5).value = f.estamento;
        row.getCell(6).value = sanitizeExcelText(f.cargo);
        row.getCell(7).value = f.funcion;
        row.getCell(8).value = f.calidadContrato;
        row.getCell(9).value = f.art69;
        row.getCell(10).value = f.totalHrsContrato;
        row.getCell(11).value = f.hrsLectivasBasica;
        row.getCell(12).value = f.hrsLectivasMedia;
        row.getCell(13).value = f.proporcionHa;

        // FÓRMULAS NATIVAS DE EXCEL (Cols N y O) - NO quemar valores estáticos
        row.getCell(14).value = {
          formula: `IF(K${currentRowDoc}+L${currentRowDoc}>0,VLOOKUP(K${currentRowDoc}+L${currentRowDoc},IF(M${currentRowDoc}="65/35",'Tabla 65-35'!$A$4:$D$47,'Tabla 60-40'!$A$4:$D$47),2,0),0)`
        };
        row.getCell(15).value = {
          formula: `IF(K${currentRowDoc}+L${currentRowDoc}>0,VLOOKUP(K${currentRowDoc}+L${currentRowDoc},IF(M${currentRowDoc}="65/35",'Tabla 65-35'!$A$4:$D$47,'Tabla 60-40'!$A$4:$D$47),3,0),0)`
        };

        // Inputs restantes (Cols P a S)
        row.getCell(16).value = f.hrsPieCronologicas;
        row.getCell(17).value = f.hrsSepCronologicas;
        row.getCell(18).value = f.otrasFuncionesNoLectivas;
        row.getCell(19).value = sanitizeExcelText(f.observaciones);

        row.commit();
        currentRowDoc++;
      }
    }
  }

  // Si quedaron filas residuales de la plantilla previa, limpiarlas
  if (wsDoc.rowCount > currentRowDoc - 1) {
    const maxCleanDoc = Math.min(wsDoc.rowCount, currentRowDoc + 200);
    for (let r = currentRowDoc; r <= maxCleanDoc; r++) {
      const row = wsDoc.getRow(r);
      if (row.hasValues) {
        for (let c = 1; c <= 19; c++) {
          row.getCell(c).value = null;
        }
        row.commit();
      }
    }
  }

  // 2. Poblado de Info Funcionario (AE)
  const rowStartAe = 3;
  let currentRowAe = rowStartAe;

  for (const est of establecimientos) {
    const aeColegio = asistentesTerritorio.filter(a => String(a.rbd) === String(est.rbd));

    for (const a of aeColegio) {
      const filasHomologadas = homologarAsistenteAPal(a, est);

      for (const f of filasHomologadas) {
        const row = wsAe.getRow(currentRowAe);

        row.getCell(1).value = sanitizeExcelText(f.rut);
        row.getCell(2).value = sanitizeExcelText(f.establecimiento);
        row.getCell(3).value = f.rbd;
        row.getCell(4).value = f.nivel;
        row.getCell(5).value = f.estamento;
        row.getCell(6).value = sanitizeExcelText(f.cargo);
        row.getCell(7).value = f.funcion;
        row.getCell(8).value = f.calidadContrato;
        row.getCell(9).value = f.totalHrsContrato;
        row.getCell(10).value = f.hrsLectivasSubvGeneral;
        row.getCell(11).value = f.hrsPie;
        row.getCell(12).value = f.hrsSep;
        row.getCell(13).value = sanitizeExcelText(f.observaciones);

        row.commit();
        currentRowAe++;
      }
    }
  }

  if (wsAe.rowCount > currentRowAe - 1) {
    const maxCleanAe = Math.min(wsAe.rowCount, currentRowAe + 200);
    for (let r = currentRowAe; r <= maxCleanAe; r++) {
      const row = wsAe.getRow(r);
      if (row.hasValues) {
        for (let c = 1; c <= 13; c++) {
          row.getCell(c).value = null;
        }
        row.commit();
      }
    }
  }

  // 3. Sincronización Integral de Info Establecimiento con Datos Reales del SaaS
  if (wsEst) {
    const rbdsExportados = new Set(establecimientos.map(e => Number(e.rbd)));
    const esExportacionTerritorialCompleta = establecimientos.length > 20;

    // Helper para discriminar si una asignación es de Apoyo PIE (Decreto 170 / Aula de Recursos / Co-docencia PIE)
    const esAsignacionPie = (a: AsignacionHoraria) => {
      const ta = (a.tipoApoyo || '').toLowerCase();
      const asig = (a.asignatura || '').toLowerCase();
      return (
        ta === 'pie' ||
        ta.includes('pie') ||
        ta.includes('recurso') ||
        ta.includes('decreto 170') ||
        asig.includes('pie') ||
        asig.includes('decreto 170') ||
        asig.includes('aula de recurso')
      );
    };

    // Indexar asignaciones no PIE (Aula regular, talleres JEC, electivos, asignaturas adicionales, etc.)
    // agrupadas por cursoId
    const horasNoPiePorCurso = new Map<string, number>();
    for (const asig of asignacionesTerritorio) {
      if (asig.cursoId && !esAsignacionPie(asig)) {
        const h = Number(asig.horasPedagogicasAula || 0);
        if (h > 0) {
          horasNoPiePorCurso.set(asig.cursoId, (horasNoPiePorCurso.get(asig.cursoId) || 0) + h);
        }
      }
    }

    // Mapa de establecimientos por RBD
    const estMap = new Map<number, Establecimiento>();
    establecimientos.forEach(e => estMap.set(Number(e.rbd), e));

    // Estructura de cursos reales del SaaS adaptados por RBD y nivel canónico
    interface CursoSaaSEfectivo {
      curso: CursoSae;
      horasPlanEfectivas: number;
    }
    const cursosPorClave = new Map<string, CursoSaaSEfectivo[]>();
    const nivelesActivosPorColegio = new Map<number, Set<string>>();

    cursosTerritorio.forEach(c => {
      const rbdNum = Number(c.rbd);
      const canonico = homologarNivelExcelPal(c.nivel);
      const key = `${rbdNum}_${canonico}`;

      if (!cursosPorClave.has(key)) {
        cursosPorClave.set(key, []);
      }
      if (!nivelesActivosPorColegio.has(rbdNum)) {
        nivelesActivosPorColegio.set(rbdNum, new Set());
      }
      nivelesActivosPorColegio.get(rbdNum)!.add(canonico);

      // Horas plan efectivas del SaaS:
      // Se toma el plan oficial del curso + talleres JEC, y si hay asignaciones adicionales
      // cargadas en la malla (no PIE), se respeta el valor mayor para no truncar planes en desarrollo.
      const horasCargadasCursoNoPie = horasNoPiePorCurso.get(c.id) || 0;
      let hPlanFallback = calcularHorasPlanCurso(c.nivel, c.regimen);
      const hTalleres = (c.talleresJec || []).reduce((sum, t) => sum + (t.horas || 0), 0);
      hPlanFallback += hTalleres;

      const hPlanEfectivoCurso = Math.max(hPlanFallback, horasCargadasCursoNoPie);

      cursosPorClave.get(key)!.push({
        curso: c,
        horasPlanEfectivas: hPlanEfectivoCurso
      });
    });

    // Pre-contar cuántas filas existen en Info Establecimiento para cada RBD y nivel canónico
    const totalFilasPorClave = new Map<string, number>();
    wsEst.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return;
      const rbd = Number(row.getCell(2).value || 0);
      if (rbdsExportados.has(rbd)) {
        const nivelRaw = String(row.getCell(3).text || '').trim();
        const canonico = homologarNivelExcelPal(nivelRaw);
        const key = `${rbd}_${canonico}`;
        totalFilasPorClave.set(key, (totalFilasPorClave.get(key) || 0) + 1);
      }
    });

    const filaIndexPorClave = new Map<string, number>();

    wsEst.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return; // Cabeceras
      const rbd = Number(row.getCell(2).value || 0);

      // Si se exporta un colegio individual o subconjunto, no alterar los RBDs ajenos
      if (!esExportacionTerritorialCompleta && !rbdsExportados.has(rbd)) {
        return;
      }

      // Si el RBD está en el alcance de los establecimientos exportados
      if (rbdsExportados.has(rbd)) {
        const nivelRaw = String(row.getCell(3).text || '').trim();
        const nivelCanonico = homologarNivelExcelPal(nivelRaw);
        const key = `${rbd}_${nivelCanonico}`;

        const filaIdx = filaIndexPorClave.get(key) || 0;
        filaIndexPorClave.set(key, filaIdx + 1);

        const totalFilas = totalFilasPorClave.get(key) || 1;
        const cursosReales = cursosPorClave.get(key) || [];

        const colE_cursosPrev = Number(row.getCell(5).value || 0);
        const colF_planPrev = Number(row.getCell(6).value || 0);
        const colH_docPrev = Number(row.getCell(8).value || 0);

        // Detectar si la plantilla base ministerial de la DEP tenía régimen 60/40 para esta fila
        const totPlanPrev = colE_cursosPrev * colF_planPrev;
        const era60_40EnTemplate = totPlanPrev > 0 && colH_docPrev === Math.ceil(totPlanPrev * 44 / 35);

        const estActual = estMap.get(rbd);
        let regimenNivel: '65_35' | '60_40' = '65_35';
        const primerCurso = cursosReales[0]?.curso;
        if (primerCurso && primerCurso.regimenProporcion) {
          regimenNivel = primerCurso.regimenProporcion;
        } else if (estActual && estActual.porcentajePrioritarios !== undefined) {
          regimenNivel = determinarRegimenNormativo(estActual.porcentajePrioritarios, nivelRaw, 80);
        } else if (era60_40EnTemplate) {
          regimenNivel = '60_40';
        }

        // Si el nivel NO existe o no tiene cursos en el SaaS para este colegio: vaciar a 0
        if (cursosReales.length === 0) {
          row.getCell(4).value = 0;
          row.getCell(5).value = 0;
          row.getCell(7).value = { formula: `+E${rowNumber}*F${rowNumber}` };
          row.getCell(8).value = 0;
          row.commit();
          return;
        }

        // Si el nivel SÍ existe en el SaaS:
        // Proyectar matrícula desde BASE COMPLETA adaptada a la estructura activa del colegio
        const nivelesActivosColegio = nivelesActivosPorColegio.get(rbd);
        const proyTotalNivel = proyectarMatriculaNivel(rbd, nivelRaw, {
          cursosActivosSaaS: nivelesActivosColegio ? Array.from(nivelesActivosColegio) : undefined
        });

        let matProyectadaNivel = proyTotalNivel.matriculaProyectada;
        // Fallback a matrícula de cursos del SaaS si no existieran antecedentes en Base Completa
        if (matProyectadaNivel === 0) {
          matProyectadaNivel = cursosReales.reduce((sum, c) => sum + (c.curso.matriculaProyectada || 0), 0);
        }

        // Caso 1: Nivel con una única fila en la plantilla (caso estándar 98% de la oferta)
        if (totalFilas === 1) {
          const numCursos = cursosReales.length;
          // Las horas plan son las que existen y han sido trabajadas en el SaaS
          const maxPlanSaaS = Math.max(...cursosReales.map(c => c.horasPlanEfectivas));
          const hPlan = maxPlanSaaS > 0 ? maxPlanSaaS : (colF_planPrev > 0 ? colF_planPrev : 38);
          const totalHA = numCursos * hPlan;
          const horasContrato = calcularHorasContratoPorPlan(totalHA, regimenNivel);

          row.getCell(4).value = matProyectadaNivel;
          row.getCell(5).value = numCursos;
          row.getCell(6).value = hPlan;
          row.getCell(7).value = { formula: `+E${rowNumber}*F${rowNumber}` };
          row.getCell(8).value = horasContrato;
          row.commit();
          return;
        }

        // Caso 2: Nivel con múltiples filas en la plantilla (ej. Liceos TP con especialidades)
        if (filaIdx < cursosReales.length) {
          const cursoActual = cursosReales[filaIdx];
          const esUltimaFila = (filaIdx === totalFilas - 1);
          // Si quedan cursos restantes no asignados, la última fila los absorbe
          const cursosAsignados = esUltimaFila ? (cursosReales.length - filaIdx) : 1;
          const hPlan = cursoActual.horasPlanEfectivas > 0 ? cursoActual.horasPlanEfectivas : (colF_planPrev > 0 ? colF_planPrev : 38);

          // Proyección adaptada a esta sección / fila
          const proyFila = proyectarMatriculaNivel(rbd, nivelRaw, {
            indiceFila: filaIdx,
            especialidad: cursoActual.curso.especialidadTp,
            cursosActivosSaaS: nivelesActivosColegio ? Array.from(nivelesActivosColegio) : undefined
          });

          let matFila = proyFila.matriculaProyectada;
          if (matFila === 0 || matFila === matProyectadaNivel) {
            // Distribuir equitativamente la matrícula proyectada del nivel entre los cursos del SaaS
            const cuotaBase = Math.floor(matProyectadaNivel / cursosReales.length);
            const residuo = matProyectadaNivel % cursosReales.length;
            matFila = cuotaBase + (filaIdx < residuo ? 1 : 0);
          }

          const totalHA = cursosAsignados * hPlan;
          const horasContrato = calcularHorasContratoPorPlan(totalHA, regimenNivel);

          row.getCell(4).value = matFila;
          row.getCell(5).value = cursosAsignados;
          row.getCell(6).value = hPlan;
          row.getCell(7).value = { formula: `+E${rowNumber}*F${rowNumber}` };
          row.getCell(8).value = horasContrato;
        } else {
          // Fila sobrante en la plantilla sin cursos reales en el SaaS
          row.getCell(4).value = 0;
          row.getCell(5).value = 0;
          row.getCell(7).value = { formula: `+E${rowNumber}*F${rowNumber}` };
          row.getCell(8).value = 0;
        }

        row.commit();
      }
    });
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(outBuffer);
}
