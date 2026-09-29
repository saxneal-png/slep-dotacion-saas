import * as XLSX from 'xlsx';
import { AsistenteEducacion, EstamentoAsistente } from '../../types';
import { inferirClasificacionAsistente } from '../../../packages/mineduc-engine/src/calculoAsistentes';

export interface ParseAsistentesResult {
  asistentes: AsistenteEducacion[];
  totalFuncionarios: number;
  totalHoras: number;
  sheetNameFound?: string;
  advertencias: string[];
}

function cleanString(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

function parseNumber(val: any): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : Math.round(val * 100) / 100;
  }
  const s = String(val).trim().replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.round(n * 100) / 100;
}

function isSummaryRow(row: any[]): boolean {
  if (!row || row.length === 0) return true;
  const firstCol = cleanString(row[0]).toLowerCase();
  const secondCol = cleanString(row[1]).toLowerCase();
  const thirdCol = cleanString(row[2]).toLowerCase();

  const isSummaryWord = (txt: string) =>
    /^(total|totales|subtotal|resumen|suma|promedio)\b/i.test(txt);

  if (isSummaryWord(firstCol) || isSummaryWord(secondCol) || isSummaryWord(thirdCol)) {
    return true;
  }

  // Si todas las primeras 3 columnas están vacías, suele ser fila de sumatorias
  if (!firstCol && !secondCol && !thirdCol) {
    return true;
  }

  return false;
}

function separarNombresApellidos(nombreCompleto: string): { nombres: string; apellidos: string } {
  const clean = cleanString(nombreCompleto);
  if (!clean) return { nombres: '', apellidos: '' };

  if (clean.includes(',')) {
    const parts = clean.split(',');
    return {
      apellidos: cleanString(parts[0]),
      nombres: cleanString(parts.slice(1).join(' '))
    };
  }

  const tokens = clean.split(/\s+/);
  if (tokens.length === 1) {
    return { nombres: tokens[0], apellidos: '' };
  }
  if (tokens.length === 2) {
    return { nombres: tokens[0], apellidos: tokens[1] };
  }
  if (tokens.length >= 3) {
    // Convención habitual chilena: 2 apellidos y 1 o 2 nombres
    return {
      nombres: tokens.slice(0, tokens.length - 2).join(' '),
      apellidos: tokens.slice(tokens.length - 2).join(' ')
    };
  }

  return { nombres: clean, apellidos: '' };
}

/**
 * Analiza un Workbook de Excel y extrae la dotación de Asistentes de la Educación.
 */
export function parseAsistentesFromWorkbook(
  workbook: XLSX.WorkBook,
  rbd: string,
  periodo: number = 2026
): ParseAsistentesResult {
  const advertencias: string[] = [];
  let targetSheetName = '';

  // 1. Buscar la hoja de asistentes
  for (const name of workbook.SheetNames) {
    const n = name.toLowerCase().trim();
    if (n.includes('asistent') || n.includes('no docente') || n.includes('codocencia')) {
      targetSheetName = name;
      break;
    }
  }

  if (!targetSheetName) {
    return {
      asistentes: [],
      totalFuncionarios: 0,
      totalHoras: 0,
      advertencias: ['No se encontró una hoja de "Asistentes" en el archivo Excel.']
    };
  }

  const sheet = workbook.Sheets[targetSheetName];
  const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  return parseAsistentesFromRows(rawData, rbd, periodo, targetSheetName);
}

/**
 * Procesa la matriz bidimensional de celdas de la hoja de asistentes.
 */
export function parseAsistentesFromRows(
  rows: any[][],
  rbd: string,
  periodo: number = 2026,
  sheetNameFound: string = 'Asistentes'
): ParseAsistentesResult {
  const advertencias: string[] = [];
  if (!rows || rows.length < 2) {
    return {
      asistentes: [],
      totalFuncionarios: 0,
      totalHoras: 0,
      sheetNameFound,
      advertencias: ['La hoja de asistentes no contiene suficientes filas de datos.']
    };
  }

  // 1. Detectar fila de cabeceras (buscar fila que contenga 'NOMBRES', 'RUT' o 'FUNCIÓN')
  let headerRowIndex = -1;
  let colMap: Record<string, number> = {};

  for (let i = 0; i < Math.min(rows.length, 10); i++) {
    const row = rows[i].map((c) => cleanString(c).toUpperCase());
    const hasNombres = row.some((c) => /NOMBRE|FUNCIONARIO|APELLIDO/i.test(c));
    const hasRut = row.some((c) => /RUT|RUN|CEDULA/i.test(c));
    const hasFuncion = row.some((c) => /FUNCI[OÓ]N|CARGO|DESEMPE/i.test(c));

    if ((hasNombres && hasRut) || (hasNombres && hasFuncion)) {
      headerRowIndex = i;
      // Mapear columnas
      row.forEach((colText, idx) => {
        if (/NOMBRE|FUNCIONARIO/i.test(colText)) colMap['nombres'] = idx;
        else if (/RUT|RUN|CEDULA/i.test(colText)) colMap['rut'] = idx;
        else if (/FUNCI[OÓ]N|CARGO|DESEMPE/i.test(colText)) colMap['funcion'] = idx;
        else if (/HORAS?\s*CONTRATO|TOTAL\s*HORAS?|TOTAL\s*HRS/i.test(colText)) colMap['horasContrato'] = idx;
        else if (/INDEFINID[AO]S?\s*SUB(\s*GRAL|\s*GENERAL)?/i.test(colText)) colMap['horasSubvGralInd'] = idx;
        else if (/PLAZO\s*FIJO\s*SUB(\s*GRAL|\s*GENERAL)?/i.test(colText)) colMap['horasSubvGralPlazo'] = idx;
        else if (/INDEFINID[AO]S?\s*SEP/i.test(colText)) colMap['horasSepInd'] = idx;
        else if (/PLAZO\s*FIJO\s*SEP/i.test(colText)) colMap['horasSepPlazo'] = idx;
        else if (/INDEFINID[AO]S?\s*PIE/i.test(colText)) colMap['horasPieInd'] = idx;
        else if (/PLAZO\s*FIJO\s*PIE/i.test(colText)) colMap['horasPiePlazo'] = idx;
        else if (/OBSERVACI|NOTA|COMENTARIO|DETALLE|SITUACI|ESTADO/i.test(colText)) colMap['observaciones'] = idx;
      });
      break;
    }
  }

  // Fallback a índices posicionales estándar de la planilla modelo si no se detectaron cabeceras explícitas
  if (headerRowIndex === -1) {
    headerRowIndex = 1; // Segunda fila
    colMap = {
      nombres: 0,
      rut: 1,
      funcion: 2,
      horasContrato: 3,
      horasSubvGralInd: 4,
      horasSubvGralPlazo: 5,
      horasSepInd: 6,
      horasSepPlazo: 7,
      horasPieInd: 8,
      horasPiePlazo: 9
    };
  }

  const asistentes: AsistenteEducacion[] = [];
  const runsVistos = new Set<string>();

  for (let r = headerRowIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    if (isSummaryRow(row)) continue;

    const nombreRaw = cleanString(colMap['nombres'] !== undefined ? row[colMap['nombres']] : row[0]);
    const rutRaw = cleanString(colMap['rut'] !== undefined ? row[colMap['rut']] : row[1]);
    const funcionRaw = cleanString(colMap['funcion'] !== undefined ? row[colMap['funcion']] : row[2]);

    if (!nombreRaw && !rutRaw) continue;
    if (nombreRaw.toLowerCase().startsWith('total') || rutRaw.toLowerCase().startsWith('total')) continue;

    const horasContrato = parseNumber(colMap['horasContrato'] !== undefined ? row[colMap['horasContrato']] : row[3]);
    const horasSubvGralInd = parseNumber(colMap['horasSubvGralInd'] !== undefined ? row[colMap['horasSubvGralInd']] : row[4]);
    const horasSubvGralPlazo = parseNumber(colMap['horasSubvGralPlazo'] !== undefined ? row[colMap['horasSubvGralPlazo']] : row[5]);
    const horasSepInd = parseNumber(colMap['horasSepInd'] !== undefined ? row[colMap['horasSepInd']] : row[6]);
    const horasSepPlazo = parseNumber(colMap['horasSepPlazo'] !== undefined ? row[colMap['horasSepPlazo']] : row[7]);
    const horasPieInd = parseNumber(colMap['horasPieInd'] !== undefined ? row[colMap['horasPieInd']] : row[8]);
    const horasPiePlazo = parseNumber(colMap['horasPiePlazo'] !== undefined ? row[colMap['horasPiePlazo']] : row[9]);

    const { nombres, apellidos } = separarNombresApellidos(nombreRaw);
    const clasificacion = inferirClasificacionAsistente(funcionRaw);

    // Extraer observaciones explícitas o notas entre paréntesis en cargo/nombre
    const obsExplicit = colMap['observaciones'] !== undefined ? cleanString(row[colMap['observaciones']]) : '';
    const noteInCargo = (funcionRaw.match(/\((.*?)\)/) || [])[1] || '';
    const noteInNombre = (nombreRaw.match(/\((.*?)\)/) || [])[1] || '';
    
    // Capturar posibles columnas de notas adicionales al final de la fila
    const extraColsNotes: string[] = [];
    for (let c = 10; c < row.length; c++) {
      const extraTxt = cleanString(row[c]);
      if (extraTxt && !/^\d+$/.test(extraTxt) && extraTxt.length > 2 && c !== colMap['observaciones']) {
        extraColsNotes.push(extraTxt);
      }
    }

    const obsArray = [obsExplicit, noteInCargo, noteInNombre, ...extraColsNotes].filter(Boolean);
    const observacionesFinal = Array.from(new Set(obsArray)).join('; ');

    // Calcular suma de financiamientos
    const sumFuentes = horasSubvGralInd + horasSubvGralPlazo + horasSepInd + horasSepPlazo + horasPieInd + horasPiePlazo;
    const finalHorasContrato = horasContrato > 0 ? horasContrato : sumFuentes;

    const cleanRun = rutRaw.replace(/\s+/g, '');
    const id = `asist_${rbd}_${cleanRun || 's_run'}_${r}`;

    if (cleanRun && runsVistos.has(cleanRun)) {
      advertencias.push(`RUT duplicado detectado en fila ${r + 1}: ${cleanRun} (${nombreRaw})`);
    }
    if (cleanRun) runsVistos.add(cleanRun);

    asistentes.push({
      id,
      rbd,
      periodo,
      run: cleanRun,
      nombres: nombres || nombreRaw,
      apellidos: apellidos || 'Sin Apellidos',
      cargoFuncion: funcionRaw || 'Asistente de la Educación',
      estamento: clasificacion.estamento,
      horasContrato: finalHorasContrato,
      horasSubvencionGeneralIndefinido: horasSubvGralInd,
      horasSubvencionGeneralPlazoFijo: horasSubvGralPlazo,
      horasSepIndefinido: horasSepInd,
      horasSepPlazoFijo: horasSepPlazo,
      horasPieIndefinido: horasPieInd,
      horasPiePlazoFijo: horasPiePlazo,
      esDuplaPsicosocial: clasificacion.esDuplaPsicosocial,
      esEquipoPie: clasificacion.esEquipoPie,
      esTecnicoParvulo: clasificacion.esTecnicoParvulo,
      esAuxiliarServicio: clasificacion.esAuxiliarServicio,
      esInspectorPatio: clasificacion.esInspectorPatio,
      observaciones: observacionesFinal || undefined,
      activo: true
    });
  }

  const totalHoras = asistentes.reduce((sum, a) => sum + (a.horasContrato || 0), 0);

  return {
    asistentes,
    totalFuncionarios: asistentes.length,
    totalHoras,
    sheetNameFound,
    advertencias
  };
}
