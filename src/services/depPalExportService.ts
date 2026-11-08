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
import { calcularHorasPlanCurso } from '@slep/mineduc-engine';
import { proyectarMatriculaNivel } from './proyeccionMatriculaService';
import { guardarDocentesBatch } from '../database/repositories/docentesRepo';
import { guardarAsistentesBatch } from '../database/repositories/asistentesRepo';
import { guardarEstablecimiento, listarEstablecimientos } from '../database/repositories/establecimientosRepo';
import { cargarPlantillaOficialBuffer } from './templateLoaderService';

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

    // Indexar cursos por RBD y nivel canónico
    // Clave: `${rbd}_${nivelCanónico}`
    interface EstadisticaNivel {
      cursos: number;
      matricula: number;
      horasPlanSemana: number;
      horasDocentes: number;
    }
    const nivelesStats = new Map<string, EstadisticaNivel>();

    cursosTerritorio.forEach(c => {
      const rbdNum = Number(c.rbd);
      const canonico = homologarNivelExcelPal(c.nivel);
      const key = `${rbdNum}_${canonico}`;

      const prev = nivelesStats.get(key) || {
        cursos: 0,
        matricula: 0,
        horasPlanSemana: 0,
        horasDocentes: 0
      };

      // Cálculo de horas efectivas del plan de estudio cargado en este curso:
      // Se toman las horas efectivamente cargadas en la malla/asignaciones del curso
      // (asignaturas base + electivos + talleres JEC + asignaturas adicionales), EXCLUYENDO las horas PIE.
      const horasCargadasCursoNoPie = horasNoPiePorCurso.get(c.id) || 0;

      // Fallback a horas del plan curricular oficial + talleres JEC si no tuviese asignaciones aún
      let hPlanFallback = calcularHorasPlanCurso(c.nivel, c.regimen);
      const hTalleres = (c.talleresJec || []).reduce((sum, t) => sum + (t.horas || 0), 0);
      hPlanFallback += hTalleres;

      const hPlanEfectivoCurso = horasCargadasCursoNoPie > 0 ? horasCargadasCursoNoPie : hPlanFallback;

      nivelesStats.set(key, {
        cursos: prev.cursos + 1,
        matricula: prev.matricula + (c.matriculaProyectada || 0),
        horasPlanSemana: Math.max(prev.horasPlanSemana, hPlanEfectivoCurso),
        horasDocentes: prev.horasDocentes + horasCargadasCursoNoPie
      });
    });

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
        const match = nivelesStats.get(`${rbd}_${nivelCanonico}`);

        if (match && match.cursos > 0) {
          // Proyectar matrícula según serie histórica (2021-2025) y agosto 2026 de BASE DE DATOS COMPLETA
          // si el curso no tuviese matrícula cargada o se requiera alineación territorial.
          let matriculaFinal = match.matricula;
          if (matriculaFinal === 0) {
            const proy = proyectarMatriculaNivel(rbd, nivelRaw);
            matriculaFinal = proy.matriculaProyectada;
          }

          // Datos reales desde el SaaS y proyección de base completa
          row.getCell(4).value = matriculaFinal;
          row.getCell(5).value = match.cursos;
          if (match.horasPlanSemana > 0) {
            row.getCell(6).value = match.horasPlanSemana;
          }
          // Col G: Total Hrs Plan Estudio con fórmula nativa =+E*F
          row.getCell(7).value = { formula: `+E${rowNumber}*F${rowNumber}` };
          // Col H: Total Horas Docentes reales asignadas en la dotación del SaaS (excluyendo PIE)
          row.getCell(8).value = match.horasDocentes > 0 ? match.horasDocentes : Number(row.getCell(8).value || 0);
        } else {
          // El nivel no existe o fue cerrado en el SaaS para este colegio: vaciar a 0
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
