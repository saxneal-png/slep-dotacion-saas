/**
 * Servicio de Ingesta y Exportación de la Planilla Final PAL 2027 DEP (Territorial)
 * SLEP Valle Diguillín
 */

import ExcelJS from 'exceljs';
import { Docente, AsistenteEducacion, Establecimiento, CursoSae, AsignacionHoraria } from '../types';
import { homologarDocenteAPal, homologarAsistenteAPal } from './depHomologationEngine';
import { guardarDocentesBatch } from '../database/repositories/docentesRepo';
import { guardarAsistentesBatch } from '../database/repositories/asistentesRepo';
import { guardarEstablecimiento, listarEstablecimientos } from '../database/repositories/establecimientosRepo';

/**
 * Obtiene el buffer de la plantilla oficial PAL 2027
 */
async function obtenerPlantillaPalBuffer(): Promise<ArrayBuffer> {
  // 1. Intentar cargar desde public/templates (vía fetch en navegador/Electron)
  if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
    try {
      const res = await fetch('./templates/Planilla_Final_PAL_2027_DEP_Template.xlsx');
      if (res.ok) {
        return await res.arrayBuffer();
      }
    } catch (_) {}
  }

  // 2. Intentar cargar en entorno Node.js / Electron si está disponible
  if (typeof process !== 'undefined' && (process as any).versions?.node) {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      const localPath = path.resolve('public/templates/Planilla_Final_PAL_2027_DEP_Template.xlsx');
      const buf = await fs.readFile(localPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch (_) {}
  }

  throw new Error('No se pudo localizar la plantilla base Planilla_Final_PAL_2027_DEP_Template.xlsx');
}

/**
 * Ingesta territorial: Lee el libro PAL 2027 oficial e importa todos los Docentes y Asistentes a la app
 */
export async function importarPlanillaPalDEP(
  fileBuffer: ArrayBuffer | Uint8Array,
  periodo: number = 2026
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

      // Asegurar que el colegio exista
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
        guardarEstablecimiento(nuevoColegio).catch(console.error);
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

        // Inputs (Cols A a M, y Cols P a S)
        row.getCell(1).value = f.rut;
        row.getCell(2).value = f.establecimiento;
        row.getCell(3).value = f.rbd;
        row.getCell(4).value = f.nivel;
        row.getCell(5).value = f.estamento;
        row.getCell(6).value = f.cargo;
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
        row.getCell(19).value = f.observaciones;

        row.commit();
        currentRowDoc++;
      }
    }
  }

  // Si quedaron filas residuales de la plantilla previa, limpiarlas
  if (wsDoc.rowCount > currentRowDoc - 1) {
    for (let r = currentRowDoc; r <= wsDoc.rowCount; r++) {
      const row = wsDoc.getRow(r);
      for (let c = 1; c <= 19; c++) {
        row.getCell(c).value = null;
      }
      row.commit();
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

        row.getCell(1).value = f.rut;
        row.getCell(2).value = f.establecimiento;
        row.getCell(3).value = f.rbd;
        row.getCell(4).value = f.nivel;
        row.getCell(5).value = f.estamento;
        row.getCell(6).value = f.cargo;
        row.getCell(7).value = f.funcion;
        row.getCell(8).value = f.calidadContrato;
        row.getCell(9).value = f.totalHrsContrato;
        row.getCell(10).value = f.hrsLectivasSubvGeneral;
        row.getCell(11).value = f.hrsPie;
        row.getCell(12).value = f.hrsSep;
        row.getCell(13).value = f.observaciones;

        row.commit();
        currentRowAe++;
      }
    }
  }

  if (wsAe.rowCount > currentRowAe - 1) {
    for (let r = currentRowAe; r <= wsAe.rowCount; r++) {
      const row = wsAe.getRow(r);
      for (let c = 1; c <= 13; c++) {
        row.getCell(c).value = null;
      }
      row.commit();
    }
  }

  // 3. Sincronización de Info Establecimiento (preservando fórmula Col G = +E*F)
  if (wsEst && cursosTerritorio.length > 0) {
    // Si hay cursos, actualizar cursos y matrícula de cada nivel
    const nivelesCounts = new Map<string, { cursos: number; matricula: number }>();
    cursosTerritorio.forEach(c => {
      const key = `${c.rbd}_${c.nivel.trim().toLowerCase()}`;
      const prev = nivelesCounts.get(key) || { cursos: 0, matricula: 0 };
      nivelesCounts.set(key, {
        cursos: prev.cursos + 1,
        matricula: prev.matricula + (c.matriculaProyectada || 0)
      });
    });

    wsEst.eachRow((row, rowNumber) => {
      if (rowNumber <= 3) return;
      const rbd = Number(row.getCell(2).value || 0);
      const nivelStr = String(row.getCell(3).text || '').trim().toLowerCase();
      const match = nivelesCounts.get(`${rbd}_${nivelStr}`);
      if (match) {
        row.getCell(4).value = match.matricula;
        row.getCell(5).value = match.cursos;
        // Col G conserva su fórmula nativa =+E*F
        row.getCell(7).value = { formula: `+E${rowNumber}*F${rowNumber}` };
        row.commit();
      }
    });
  }

  const outBuffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(outBuffer);
}
