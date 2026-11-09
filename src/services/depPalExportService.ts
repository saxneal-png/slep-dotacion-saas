/**
 * Servicio de Ingesta y Exportación de la Planilla Final PAL 2027 DEP (Territorial)
 * SLEP Valle Diguillín
 */

import ExcelJS from 'exceljs';
import { Docente, AsistenteEducacion, Establecimiento, CursoSae, AsignacionHoraria, PlanEstudioCurricular } from '../types';
import {
  homologarDocenteAPal,
  homologarAsistenteAPal,
  sanitizeExcelText,
  homologarNivelExcelPal
} from './depHomologationEngine';
import { calcularHorasPlanCurso, obtenerPlanPorCurso } from '@slep/mineduc-engine';
import { guardarDocentesBatch } from '../database/repositories/docentesRepo';
import { guardarAsistentesBatch } from '../database/repositories/asistentesRepo';
import { guardarEstablecimiento, listarEstablecimientos } from '../database/repositories/establecimientosRepo';
import { listarPlanesEstudio } from '../database/repositories/planesEstudioRepo';
import { listarTodosLosCursos } from '../database/repositories/cursosRepo';
import { listarTodasLasAsignaciones } from '../database/repositories/asignacionesRepo';
import { extraerGradosDeCurso } from './combinacionCursosService';
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
        row.getCell(10).value = Math.max(0, Math.round(Number(f.totalHrsContrato) || 0));
        row.getCell(10).numFmt = '0';
        // Columnas K y L: Horas lectivas Básica y Media DEBEN ser estrictamente números enteros no decimales
        // ya que la planilla DEP utiliza K+L como clave entera exacta para sus fórmulas VLOOKUP nativas
        row.getCell(11).value = Math.max(0, Math.round(Number(f.hrsLectivasBasica) || 0));
        row.getCell(11).numFmt = '0';
        row.getCell(12).value = Math.max(0, Math.round(Number(f.hrsLectivasMedia) || 0));
        row.getCell(12).numFmt = '0';
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

  // 3. Sincronización Integral de Info Establecimiento con Datos Reales del SaaS (Alternativa 1: Single Source of Truth)
  if (wsEst) {
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

    // Cargar planes de estudio registrados en la BD (planes personalizados creados o asociados a cursos)
    let planesEstudioDb: PlanEstudioCurricular[] = [];
    try {
      planesEstudioDb = await listarPlanesEstudio();
    } catch (_) {}

    // Fallback de seguridad si cursosTerritorio o asignacionesTerritorio vienen vacíos
    if (cursosTerritorio.length === 0) {
      try {
        cursosTerritorio = await listarTodosLosCursos(2027);
      } catch (_) {}
    }
    if (asignacionesTerritorio.length === 0) {
      try {
        asignacionesTerritorio = await listarTodasLasAsignaciones(2027);
      } catch (_) {}
    }

    // Helper para obtener las horas de plan de estudio normativas de cada curso en el SaaS
    const calcularPlanNormativoCurso = (c: CursoSae): number => {
      let hPlan = 0;
      // 1. Plan personalizado normativo en base de datos si el curso tiene planEstudioId
      if (c.planEstudioId) {
        const planDb = planesEstudioDb.find(p => p.id === c.planEstudioId);
        if (planDb) {
          if (typeof planDb.totalHorasPlan === 'number' && planDb.totalHorasPlan > 0) {
            hPlan = planDb.totalHorasPlan;
          } else if (planDb.asignaturas && planDb.asignaturas.length > 0) {
            const suma = planDb.asignaturas.reduce((acc, a) => acc + (Number(a.horasSemanales) || 0), 0);
            hPlan = suma + (Number(planDb.horasLibreDisposicion) || 0);
          }
        }
      }
      // 2. Plan oficial normativo MINEDUC considerando nivel, régimen (JEC/No JEC) y especialidad TP
      if (hPlan <= 0) {
        const planMineduc = obtenerPlanPorCurso(c.nivel, c.regimen, c.especialidadTp);
        if (planMineduc && typeof planMineduc.totalHorasPlan === 'number' && planMineduc.totalHorasPlan > 0) {
          hPlan = planMineduc.totalHorasPlan;
        } else {
          hPlan = calcularHorasPlanCurso(c.nivel, c.regimen, c.especialidadTp);
        }
      }
      // 3. Fallback normativo seguro según régimen MINEDUC
      if (hPlan <= 0) {
        const esParv = /pre-?kinder|kinder|nt1|nt2|transicion|parvul|medio menor|medio mayor/i.test(c.nivel);
        const esTP = /tp|tecnico|profesional|especialidad/i.test(c.nivel) || Boolean(c.especialidadTp);
        if (esParv) {
          hPlan = c.regimen === 'JEC' ? 38 : 22;
        } else if (esTP) {
          hPlan = c.regimen === 'JEC' ? 42 : 36;
        } else {
          hPlan = c.regimen === 'JEC' ? 38 : 30;
        }
      }
      return hPlan;
    };

    // Mapear todas las filas preexistentes en wsEst por RBD
    interface FilaWsEst {
      rowNumber: number;
      row: ExcelJS.Row;
      nivelRaw: string;
      canonico: string;
    }
    const filasPorRbd = new Map<number, FilaWsEst[]>();

    wsEst.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return; // Omitir 3 filas de cabecera ministerial
      const rbd = Number(row.getCell(2).value || 0);
      if (rbd) {
        if (!filasPorRbd.has(rbd)) filasPorRbd.set(rbd, []);
        const nivelRaw = String(row.getCell(3).text || '').trim();
        const canonico = homologarNivelExcelPal(nivelRaw);
        filasPorRbd.get(rbd)!.push({
          rowNumber,
          row,
          nivelRaw,
          canonico
        });
      }
    });

    // Procesar cada establecimiento del territorio
    for (const est of establecimientos) {
      const rbdNum = Number(est.rbd);
      const cursosColegio = cursosTerritorio.filter(c => Number(c.rbd) === rbdNum);
      const estRegimen: '65_35' | '60_40' = (est.porcentajePrioritarios || 0) >= 80 ? '60_40' : '65_35';

      interface GrupoCursoSaaS {
        id: string;
        nivelDisplay: string;
        canonico: string;
        gradosCubiertos: string[];
        matriculaTotal: number;
        numCursos: number;
        horasPlan: number;
        regimenProporcion: '65_35' | '60_40';
        esCombinadoOMulti: boolean;
      }

      const gruposColegio: GrupoCursoSaaS[] = [];
      const gradosSecundariosDeCombinados = new Set<string>();

      for (const c of cursosColegio) {
        const hDocNoPie = horasNoPiePorCurso.get(c.id) || 0;
        const hPlan = calcularPlanNormativoCurso(c);
        const esCombinadoOMulti = Boolean(c.esMultigrado || c.esCombinado || (c.gradosCombinados && c.gradosCombinados.length > 0));
        const grados = extraerGradosDeCurso(c);
        const regimenProp: '65_35' | '60_40' = c.regimenProporcion || estRegimen;

        if (esCombinadoOMulti && grados.length > 1) {
          // Multigrado o Combinado que abarca múltiples grados
          const primerGrado = grados[0];
          const canPrincipal = homologarNivelExcelPal(primerGrado);
          const gradosCan = grados.map(g => homologarNivelExcelPal(g));

          // Registrar los grados secundarios (desde el 2do) para no asignarles cursos ni horas fantasmas
          for (let i = 1; i < gradosCan.length; i++) {
            gradosSecundariosDeCombinados.add(gradosCan[i]);
          }

          gruposColegio.push({
            id: c.id,
            nivelDisplay: c.nivel,
            canonico: canPrincipal,
            gradosCubiertos: gradosCan,
            matriculaTotal: c.matriculaProyectada || 0,
            numCursos: 1,
            horasPlan: hPlan,
            regimenProporcion: regimenProp,
            esCombinadoOMulti: true
          });
        } else {
          // Curso regular o multigrado de 1 solo grado
          const can = homologarNivelExcelPal(c.nivel);
          const clave = `${can}_${c.especialidadTp || ''}`;
          const existente = gruposColegio.find(g => !g.esCombinadoOMulti && g.id === clave);

          if (existente) {
            existente.matriculaTotal += (c.matriculaProyectada || 0);
            existente.numCursos += 1;
            existente.horasPlan = Math.max(existente.horasPlan, hPlan);
          } else {
            gruposColegio.push({
              id: clave,
              nivelDisplay: c.nivel,
              canonico: can,
              gradosCubiertos: [can],
              matriculaTotal: c.matriculaProyectada || 0,
              numCursos: 1,
              horasPlan: hPlan,
              regimenProporcion: regimenProp,
              esCombinadoOMulti: false
            });
          }
        }
      }

      const filasColegio = filasPorRbd.get(rbdNum) || [];
      const filasAsignadas = new Set<number>();
      const gruposAsignados = new Set<GrupoCursoSaaS>();

      // PASADA 1: Coincidencia canónica directa
      for (const grupo of gruposColegio) {
        const filaLibre = filasColegio.find(f => !filasAsignadas.has(f.rowNumber) && f.canonico === grupo.canonico);
        if (filaLibre) {
          if (grupo.esCombinadoOMulti) {
            filaLibre.row.getCell(3).value = grupo.nivelDisplay;
          }
          filaLibre.row.getCell(4).value = grupo.matriculaTotal;
          filaLibre.row.getCell(5).value = grupo.numCursos;
          filaLibre.row.getCell(6).value = grupo.horasPlan;
          filaLibre.row.getCell(7).value = { formula: `+E${filaLibre.rowNumber}*F${filaLibre.rowNumber}` };
          filaLibre.row.getCell(8).value = calcularHorasContratoPorPlan(grupo.numCursos * grupo.horasPlan, grupo.regimenProporcion);
          filaLibre.row.commit();

          filasAsignadas.add(filaLibre.rowNumber);
          gruposAsignados.add(grupo);
        }
      }

      // PASADA 2: Grupos restantes que no coincidieron con fila exacta
      for (const grupo of gruposColegio) {
        if (gruposAsignados.has(grupo)) continue;

        // Buscar una fila del colegio disponible (no asignada y no marcada como grado secundario)
        const filaDisponible = filasColegio.find(f => !filasAsignadas.has(f.rowNumber) && !gradosSecundariosDeCombinados.has(f.canonico));
        if (filaDisponible) {
          filaDisponible.row.getCell(3).value = grupo.nivelDisplay;
          filaDisponible.row.getCell(4).value = grupo.matriculaTotal;
          filaDisponible.row.getCell(5).value = grupo.numCursos;
          filaDisponible.row.getCell(6).value = grupo.horasPlan;
          filaDisponible.row.getCell(7).value = { formula: `+E${filaDisponible.rowNumber}*F${filaDisponible.rowNumber}` };
          filaDisponible.row.getCell(8).value = calcularHorasContratoPorPlan(grupo.numCursos * grupo.horasPlan, grupo.regimenProporcion);
          filaDisponible.row.commit();

          filasAsignadas.add(filaDisponible.rowNumber);
          gruposAsignados.add(grupo);
        } else {
          // Si el colegio no tiene más filas en la plantilla, agregar una fila nueva
          const r = wsEst.rowCount + 1;
          const newRow = wsEst.addRow([
            est.nombre.toUpperCase(),
            rbdNum,
            grupo.nivelDisplay,
            grupo.matriculaTotal,
            grupo.numCursos,
            grupo.horasPlan,
            { formula: `+E${r}*F${r}` },
            calcularHorasContratoPorPlan(grupo.numCursos * grupo.horasPlan, grupo.regimenProporcion)
          ]);
          newRow.commit();
          gruposAsignados.add(grupo);
        }
      }

      // PASADA 3: Purgar a CERO ABSOLUTO todas las filas no asignadas de este colegio en la plantilla
      // Esto elimina por completo las 40 o 46 hrs pre-impresas, los grados secundarios de multigrados
      // y cualquier curso residual ministerial que el colegio no tenga en el SaaS
      for (const f of filasColegio) {
        if (!filasAsignadas.has(f.rowNumber)) {
          f.row.getCell(4).value = 0; // Matrícula = 0
          f.row.getCell(5).value = 0; // Cursos = 0
          f.row.getCell(6).value = 0; // Horas Plan = 0
          f.row.getCell(7).value = { formula: `+E${f.rowNumber}*F${f.rowNumber}` }; // Total HA = 0
          f.row.getCell(8).value = 0; // Horas Contrato = 0
          f.row.commit();
        }
      }
    }
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(outBuffer);
}
