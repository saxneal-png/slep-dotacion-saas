import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
  EstablecimientoLevantamiento,
  generarMatrizLevantamientoEstablecimiento
} from './asistentesLevantamientoRollup';
import { AsistenteAnalizadoRecord } from './asistentesClassifier';
import { AsistenteEducacion } from '../../types';

/**
 * Da formato y añade una hoja de Levantamiento de Coeficiente a un libro ExcelJS
 */
export function agregarHojaLevantamientoEstablecimiento(
  workbook: ExcelJS.Workbook,
  data: EstablecimientoLevantamiento,
  sheetName?: string
): ExcelJS.Worksheet {
  // Limitar nombre de hoja a 31 caracteres válidos para Excel
  const safeName = (sheetName || data.nombreEstablecimiento || `RBD ${data.rbd}`)
    .replace(/[:\\/?*\[\]]/g, '')
    .slice(0, 31);

  const ws = workbook.addWorksheet(safeName, {
    views: [{ showGridLines: true }]
  });

  // Configurar anchos de columna
  ws.columns = [
    { width: 38 }, // A: Cargo / función
    { width: 26 }, // B: CANTIDAD DE FUNCIONARIOS
    { width: 16 }, // C: SUB REGULAR
    { width: 14 }, // D: PIE
    { width: 14 }, // E: SEP
    { width: 16 }, // F: TOTAL
    { width: 45 }, // G: Observaciones
  ];

  const fontName = 'Calibri';

  // Fila 1: Título Principal
  ws.mergeCells('A1:G1');
  const titleCell = ws.getCell('A1');
  titleCell.value = 'COEFICIENTE ASISTENTES DE LA EDUCACIÓN PARA  EE';
  titleCell.font = { name: fontName, size: 12, bold: true, color: { argb: 'FF002060' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  ws.getRow(1).height = 24;

  // Fila 4: Nombre del Establecimiento
  const labelEstCell = ws.getCell('A4');
  labelEstCell.value = 'Nombre del Establecimiento';
  labelEstCell.font = { name: fontName, size: 11, bold: true };
  labelEstCell.alignment = { vertical: 'middle' };

  ws.mergeCells('B4:G4');
  const nameEstCell = ws.getCell('B4');
  nameEstCell.value = `${data.nombreEstablecimiento.toUpperCase()} (RBD: ${data.rbd}${data.comuna ? ` - ${data.comuna}` : ''})`;
  nameEstCell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FF1F4E78' } };
  nameEstCell.alignment = { vertical: 'middle' };
  ws.getRow(4).height = 20;

  // Fila 6: Instrucciones
  ws.mergeCells('A6:G6');
  const instrCell = ws.getCell('A6');
  instrCell.value = 'Instrucciones: Por cada función o cargo que no aparezca en la lista precargada, debe ingresar en "Otros" y registrar en "Observaciones" la función, como se señala en el ejemplo.';
  instrCell.font = { name: fontName, size: 9.5, italic: true, color: { argb: 'FF595959' } };
  instrCell.alignment = { vertical: 'middle', wrapText: true };
  ws.getRow(6).height = 24;

  // Fila 9: Encabezados de Tabla
  const headers = [
    'Cargo / función',
    'CANTIDAD DE FUCIONARIOS',
    'SUB REGULAR',
    'PIE',
    'SEP',
    'TOTAL',
    'Observaciones'
  ];

  const headerRow = ws.getRow(9);
  headerRow.height = 28;
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: fontName, size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF2F2F2' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'thin', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
    cell.alignment = { vertical: 'middle', horizontal: idx === 0 || idx === 6 ? 'left' : 'center', wrapText: true };
  });

  // Filas de Datos (Fila 10 en adelante)
  let currentRowNum = 10;
  data.rows.forEach((r) => {
    const row = ws.getRow(currentRowNum);
    row.height = 20;

    const isOtro = r.isOtro || r.cargoFuncion.startsWith('OTROS');
    const rowFont = {
      name: fontName,
      size: 10.5,
      color: isOtro && r.cantidadFuncionarios > 0 ? { argb: 'FFC00000' } : { argb: 'FF000000' }
    };

    // A: Cargo / función
    const cellA = row.getCell(1);
    cellA.value = r.cargoFuncion;
    cellA.font = rowFont;
    cellA.alignment = { vertical: 'middle' };

    // B: CANTIDAD DE FUNCIONARIOS
    const cellB = row.getCell(2);
    cellB.value = r.cantidadFuncionarios > 0 ? r.cantidadFuncionarios : (r.cantidadFuncionarios === 0 && !isOtro ? 0 : null);
    cellB.font = rowFont;
    cellB.alignment = { vertical: 'middle', horizontal: 'center' };

    // C: SUB REGULAR
    const cellC = row.getCell(3);
    cellC.value = r.horasSubRegular > 0 ? r.horasSubRegular : null;
    cellC.font = rowFont;
    cellC.alignment = { vertical: 'middle', horizontal: 'right' };
    cellC.numFmt = '#,##0.##';

    // D: PIE
    const cellD = row.getCell(4);
    cellD.value = r.horasPie > 0 ? r.horasPie : null;
    cellD.font = rowFont;
    cellD.alignment = { vertical: 'middle', horizontal: 'right' };
    cellD.numFmt = '#,##0.##';

    // E: SEP
    const cellE = row.getCell(5);
    cellE.value = r.horasSep > 0 ? r.horasSep : null;
    cellE.font = rowFont;
    cellE.alignment = { vertical: 'middle', horizontal: 'right' };
    cellE.numFmt = '#,##0.##';

    // F: TOTAL (Fórmula dinámina =SUM(C#:E#))
    const cellF = row.getCell(6);
    cellF.value = { formula: `SUM(C${currentRowNum}:E${currentRowNum})` };
    cellF.font = rowFont;
    cellF.alignment = { vertical: 'middle', horizontal: 'right' };
    cellF.numFmt = '#,##0.##';

    // G: Observaciones
    const cellG = row.getCell(7);
    cellG.value = r.observaciones || null;
    cellG.font = isOtro && r.observaciones.startsWith('( Señalar') ? { ...rowFont, italic: true, color: { argb: 'FF7F7F7F' } } : rowFont;
    cellG.alignment = { vertical: 'middle', wrapText: true };

    // Bordes para toda la fila de datos
    for (let c = 1; c <= 7; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    }

    currentRowNum++;
  });

  const lastDataRow = currentRowNum - 1;

  // Fila de TOTAL GENERAL
  const totalRow = ws.getRow(currentRowNum);
  totalRow.height = 24;

  const cellTotA = totalRow.getCell(1);
  cellTotA.value = 'TOTAL GENERAL';
  cellTotA.font = { name: fontName, size: 11, bold: true, color: { argb: 'FF000000' } };
  cellTotA.alignment = { vertical: 'middle' };

  const cellTotB = totalRow.getCell(2);
  cellTotB.value = { formula: `SUM(B10:B${lastDataRow})` };
  cellTotB.font = { name: fontName, size: 11, bold: true };
  cellTotB.alignment = { vertical: 'middle', horizontal: 'center' };

  const cellTotC = totalRow.getCell(3);
  cellTotC.value = { formula: `SUM(C10:C${lastDataRow})` };
  cellTotC.font = { name: fontName, size: 11, bold: true };
  cellTotC.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotC.numFmt = '#,##0.##';

  const cellTotD = totalRow.getCell(4);
  cellTotD.value = { formula: `SUM(D10:D${lastDataRow})` };
  cellTotD.font = { name: fontName, size: 11, bold: true };
  cellTotD.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotD.numFmt = '#,##0.##';

  const cellTotE = totalRow.getCell(5);
  cellTotE.value = { formula: `SUM(E10:E${lastDataRow})` };
  cellTotE.font = { name: fontName, size: 11, bold: true };
  cellTotE.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotE.numFmt = '#,##0.##';

  const cellTotF = totalRow.getCell(6);
  cellTotF.value = { formula: `SUM(F10:F${lastDataRow})` };
  cellTotF.font = { name: fontName, size: 11, bold: true, color: { argb: 'FF002060' } };
  cellTotF.alignment = { vertical: 'middle', horizontal: 'right' };
  cellTotF.numFmt = '#,##0.##';

  const cellTotG = totalRow.getCell(7);
  cellTotG.value = '';

  for (let c = 1; c <= 7; c++) {
    const cell = totalRow.getCell(c);
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFEAECEE' }
    };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF000000' } },
      left: { style: 'thin', color: { argb: 'FF000000' } },
      bottom: { style: 'double', color: { argb: 'FF000000' } },
      right: { style: 'thin', color: { argb: 'FF000000' } },
    };
  }

  return ws;
}

/**
 * Exporta un archivo Excel oficial para un único establecimiento
 */
export async function exportarLevantamientoIndividualExcel(
  asistentes: (AsistenteAnalizadoRecord | AsistenteEducacion)[],
  rbd: string,
  nombreEstablecimiento: string,
  comuna?: string,
  interpretacionIa?: any[],
  matrizPersonalizada?: EstablecimientoLevantamiento
): Promise<Blob> {
  const matriz = matrizPersonalizada || generarMatrizLevantamientoEstablecimiento(
    asistentes,
    rbd,
    nombreEstablecimiento,
    comuna,
    interpretacionIa
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SLEP Valle Diguillín - Sistema de Dotación';
  workbook.lastModifiedBy = 'Analizador de Dotación IA';
  workbook.created = new Date();
  workbook.modified = new Date();

  agregarHojaLevantamientoEstablecimiento(workbook, matriz, 'Levantamiento Coeficiente');

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const filename = `Levantamiento_Coeficiente_Asistentes_RBD_${rbd}_${nombreEstablecimiento.replace(/\s+/g, '_')}.xlsx`;
  saveAs(blob, filename);
  return blob;
}

/**
 * Exporta un archivo Excel consolidado multi-colegio (con pestaña de resumen territorial + hoja por cada colegio)
 */
export async function exportarLevantamientoConsolidadoSlepExcel(
  asistentesPorColegio: Array<{
    rbd: string;
    nombreEstablecimiento: string;
    comuna?: string;
    asistentes: (AsistenteAnalizadoRecord | AsistenteEducacion)[];
    matrizPersonalizada?: EstablecimientoLevantamiento;
  }>,
  interpretacionIaGlobal?: any[]
): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SLEP Valle Diguillín - Sistema de Dotación';
  workbook.lastModifiedBy = 'Analizador de Dotación IA';
  workbook.created = new Date();
  workbook.modified = new Date();

  // 1. Hoja de Resumen Territorial SLEP
  const wsResumen = workbook.addWorksheet('RESUMEN TERRITORIAL SLEP', {
    views: [{ showGridLines: true }]
  });

  wsResumen.columns = [
    { width: 12 }, // RBD
    { width: 42 }, // Establecimiento
    { width: 18 }, // Comuna
    { width: 22 }, // Total Funcionarios
    { width: 18 }, // Horas Sub Regular
    { width: 16 }, // Horas PIE
    { width: 16 }, // Horas SEP
    { width: 18 }, // Total Horas
  ];

  wsResumen.mergeCells('A1:H1');
  const titResumen = wsResumen.getCell('A1');
  titResumen.value = 'SERVICIO LOCAL DE EDUCACIÓN PÚBLICA - RESUMEN DE COEFICIENTES ASISTENTES DE LA EDUCACIÓN';
  titResumen.font = { name: 'Calibri', size: 12, bold: true, color: { argb: 'FF002060' } };
  titResumen.alignment = { vertical: 'middle', horizontal: 'center' };
  wsResumen.getRow(1).height = 24;

  const headersResumen = [
    'RBD',
    'ESTABLECIMIENTO',
    'COMUNA',
    'CANTIDAD FUNCIONARIOS',
    'HORAS SUB REGULAR',
    'HORAS PIE',
    'HORAS SEP',
    'TOTAL HORAS'
  ];

  const hRow = wsResumen.getRow(3);
  hRow.height = 26;
  headersResumen.forEach((h, idx) => {
    const cell = hRow.getCell(idx + 1);
    cell.value = h;
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF000000' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
    cell.alignment = { vertical: 'middle', horizontal: idx <= 2 ? 'left' : 'center', wrapText: true };
  });

  let rIdx = 4;
  const matrices: EstablecimientoLevantamiento[] = [];

  for (const col of asistentesPorColegio) {
    const matriz = col.matrizPersonalizada || generarMatrizLevantamientoEstablecimiento(
      col.asistentes,
      col.rbd,
      col.nombreEstablecimiento,
      col.comuna,
      interpretacionIaGlobal
    );
    matrices.push(matriz);

    const row = wsResumen.getRow(rIdx);
    row.height = 20;

    row.getCell(1).value = col.rbd;
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(2).value = col.nombreEstablecimiento;
    row.getCell(2).alignment = { vertical: 'middle' };

    row.getCell(3).value = col.comuna || 'Territorio';
    row.getCell(3).alignment = { vertical: 'middle' };

    row.getCell(4).value = matriz.totalGeneral.cantidadFuncionarios;
    row.getCell(4).alignment = { vertical: 'middle', horizontal: 'center' };

    row.getCell(5).value = matriz.totalGeneral.horasSubRegular;
    row.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(5).numFmt = '#,##0.##';

    row.getCell(6).value = matriz.totalGeneral.horasPie;
    row.getCell(6).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(6).numFmt = '#,##0.##';

    row.getCell(7).value = matriz.totalGeneral.horasSep;
    row.getCell(7).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(7).numFmt = '#,##0.##';

    row.getCell(8).value = matriz.totalGeneral.totalHoras;
    row.getCell(8).alignment = { vertical: 'middle', horizontal: 'right' };
    row.getCell(8).numFmt = '#,##0.##';

    for (let c = 1; c <= 8; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
        right: { style: 'thin', color: { argb: 'FFD9D9D9' } },
      };
    }

    rIdx++;
  }

  // Fila Total Territorial
  const totRow = wsResumen.getRow(rIdx);
  totRow.height = 24;
  totRow.getCell(1).value = 'TOTAL TERRITORIO';
  totRow.getCell(1).font = { bold: true };
  totRow.getCell(4).value = { formula: `SUM(D4:D${rIdx - 1})` };
  totRow.getCell(4).font = { bold: true };
  totRow.getCell(4).alignment = { horizontal: 'center' };
  totRow.getCell(5).value = { formula: `SUM(E4:E${rIdx - 1})` };
  totRow.getCell(5).font = { bold: true };
  totRow.getCell(5).numFmt = '#,##0.##';
  totRow.getCell(6).value = { formula: `SUM(F4:F${rIdx - 1})` };
  totRow.getCell(6).font = { bold: true };
  totRow.getCell(6).numFmt = '#,##0.##';
  totRow.getCell(7).value = { formula: `SUM(G4:G${rIdx - 1})` };
  totRow.getCell(7).font = { bold: true };
  totRow.getCell(7).numFmt = '#,##0.##';
  totRow.getCell(8).value = { formula: `SUM(H4:H${rIdx - 1})` };
  totRow.getCell(8).font = { bold: true, color: { argb: 'FF002060' } };
  totRow.getCell(8).numFmt = '#,##0.##';

  for (let c = 1; c <= 8; c++) {
    const cell = totRow.getCell(c);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEAECEE' } };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'double' },
      right: { style: 'thin' },
    };
  }

  // 2. Agregar cada establecimiento como hoja individual
  matrices.forEach((matriz) => {
    agregarHojaLevantamientoEstablecimiento(workbook, matriz);
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });

  const filename = `Consolidado_Levantamiento_Coeficiente_Asistentes_SLEP_${new Date().getFullYear()}.xlsx`;
  saveAs(blob, filename);
  return blob;
}
