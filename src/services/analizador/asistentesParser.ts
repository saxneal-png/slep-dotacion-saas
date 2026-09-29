import * as XLSX from 'xlsx';
import { AsistenteEducacion, EstamentoAsistente } from '../../types';
import { inferirClasificacionAsistente } from '../../../packages/mineduc-engine/src/calculoAsistentes';
import { normalizarCargoAsistenteInteligente } from './intelligentCargoNormalizer';

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
 * Resuelve y combina cabeceras de múltiples filas (ej: celdas combinadas de Subvención General / SEP / PIE)
 * hacia adelante para asegurar la identificación certera de cada subvención y tipo de contrato.
 */
function resolverCabecerasMultinivel(rows: any[][]): { headerRowIndex: number; effectiveHeaders: string[] } {
  let headerRowIndex = -1;
  const maxScan = Math.min(rows.length, 10);

  // 1. Localizar fila con nombres/rut/cargo
  for (let i = 0; i < maxScan; i++) {
    const rowStr = rows[i].map((c) => cleanString(c).toUpperCase());
    const hasNombres = rowStr.some((c) => /NOMBRE|FUNCIONARIO|APELLIDO/i.test(c));
    const hasRut = rowStr.some((c) => /RUT|RUN|CEDULA/i.test(c));
    const hasFuncion = rowStr.some((c) => /FUNCI[OÓ]N|CARGO|DESEMPE/i.test(c));

    if ((hasNombres && hasRut) || (hasNombres && hasFuncion) || (hasRut && hasFuncion)) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 0;
  }

  // 2. Construir cabeceras efectivas considerando posibles filas previas o subfilas con categorías combinadas
  const targetRow = rows[headerRowIndex] || [];
  const prevRow = headerRowIndex > 0 ? rows[headerRowIndex - 1] : [];
  const nextRow = headerRowIndex + 1 < rows.length ? rows[headerRowIndex + 1] : [];

  // Comprobar si la fila previa tiene categorías de subvención combinadas (ej: SUB GENERAL, SEP, PIE)
  let prevHasSubventions = false;
  let propagatedCategory = '';
  const prevPropagated: string[] = [];

  for (let c = 0; c < Math.max(targetRow.length, prevRow.length); c++) {
    const pVal = cleanString(prevRow[c]).toUpperCase();
    if (/SUB(\s*GRAL|\s*GENERAL|\s*REGULAR)|SUBVENCION\s*GENERAL/i.test(pVal)) {
      propagatedCategory = 'SUB GENERAL';
      prevHasSubventions = true;
    } else if (/SEP|LEY\s*SEP/i.test(pVal)) {
      propagatedCategory = 'SEP';
      prevHasSubventions = true;
    } else if (/PIE|INTEGRACI[OÓ]N|DTO\s*170/i.test(pVal)) {
      propagatedCategory = 'PIE';
      prevHasSubventions = true;
    } else if (pVal.length > 0 && !/INDEFINID|PLAZO|CONTRATA|TITULAR|HORA/i.test(pVal)) {
      propagatedCategory = '';
    }
    prevPropagated.push(propagatedCategory);
  }

  const effectiveHeaders: string[] = [];
  const maxCols = Math.max(targetRow.length, nextRow.length, prevRow.length);

  for (let c = 0; c < maxCols; c++) {
    const mainVal = cleanString(targetRow[c]).toUpperCase();
    const prevCat = prevPropagated[c] || '';

    // Si la celda principal dice solo "INDEFINIDO" o "PLAZO FIJO" y arriba había "SUB GENERAL" o "SEP" o "PIE"
    if (prevHasSubventions && prevCat && /^(INDEFINID[AO]S?|PLAZO\s*FIJO|CONTRATA|TITULAR|HORAS?)$/i.test(mainVal)) {
      effectiveHeaders.push(`${prevCat} ${mainVal}`);
    } else {
      effectiveHeaders.push(mainVal);
    }
  }

  return { headerRowIndex, effectiveHeaders };
}

/**
 * Procesa la matriz bidimensional de celdas de la hoja de asistentes con identificación certera de subvención.
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

  // 1. Detectar cabeceras con resolución multinivel de subvenciones
  const { headerRowIndex, effectiveHeaders } = resolverCabecerasMultinivel(rows);
  const colMap: Record<string, number> = {};

  effectiveHeaders.forEach((colText, idx) => {
    if (!colText) return;

    // Nombres
    if (colMap['nombres'] === undefined && /NOMBRE|FUNCIONARIO|APELLIDO/i.test(colText) && !/CARGO|FUNCI/i.test(colText)) {
      colMap['nombres'] = idx;
    }
    // RUT / RUN
    else if (colMap['rut'] === undefined && /RUT|RUN|CEDULA/i.test(colText)) {
      colMap['rut'] = idx;
    }
    // Cargo o Función
    else if (colMap['funcion'] === undefined && /FUNCI[OÓ]N|CARGO|DESEMPE|ESTAMENTO/i.test(colText)) {
      colMap['funcion'] = idx;
    }
    // Horas Contrato Totales
    else if (colMap['horasContrato'] === undefined && /HORAS?\s*CONTRATO|TOTAL\s*HORAS?|TOTAL\s*HRS|HRS?\s*CONTRATO|JORNADA/i.test(colText)) {
      colMap['horasContrato'] = idx;
    }
    // SUBVENCIÓN GENERAL / REGULAR - INDEFINIDO
    else if (
      colMap['horasSubvGralInd'] === undefined &&
      (/(SUB.*GRAL|SUB.*GENERAL|SUB.*REGULAR|REGULAR).*(INDEF|TITULAR)/i.test(colText) ||
       /(INDEF|TITULAR).*(SUB.*GRAL|SUB.*GENERAL|SUB.*REGULAR|REGULAR)/i.test(colText))
    ) {
      colMap['horasSubvGralInd'] = idx;
    }
    // SUBVENCIÓN GENERAL / REGULAR - PLAZO FIJO
    else if (
      colMap['horasSubvGralPlazo'] === undefined &&
      (/(SUB.*GRAL|SUB.*GENERAL|SUB.*REGULAR|REGULAR).*(PLAZO|CONTRATA)/i.test(colText) ||
       /(PLAZO|CONTRATA).*(SUB.*GRAL|SUB.*GENERAL|SUB.*REGULAR|REGULAR)/i.test(colText))
    ) {
      colMap['horasSubvGralPlazo'] = idx;
    }
    // SEP - INDEFINIDO
    else if (
      colMap['horasSepInd'] === undefined &&
      (/(SEP|LEY\s*SEP).*(INDEF|TITULAR)/i.test(colText) ||
       /(INDEF|TITULAR).*(SEP|LEY\s*SEP)/i.test(colText))
    ) {
      colMap['horasSepInd'] = idx;
    }
    // SEP - PLAZO FIJO
    else if (
      colMap['horasSepPlazo'] === undefined &&
      (/(SEP|LEY\s*SEP).*(PLAZO|CONTRATA)/i.test(colText) ||
       /(PLAZO|CONTRATA).*(SEP|LEY\s*SEP)/i.test(colText))
    ) {
      colMap['horasSepPlazo'] = idx;
    }
    // PIE - INDEFINIDO
    else if (
      colMap['horasPieInd'] === undefined &&
      (/(PIE|INTEGRACI[OÓ]N|DTO\s*170).*(INDEF|TITULAR)/i.test(colText) ||
       /(INDEF|TITULAR).*(PIE|INTEGRACI[OÓ]N|DTO\s*170)/i.test(colText))
    ) {
      colMap['horasPieInd'] = idx;
    }
    // PIE - PLAZO FIJO
    else if (
      colMap['horasPiePlazo'] === undefined &&
      (/(PIE|INTEGRACI[OÓ]N|DTO\s*170).*(PLAZO|CONTRATA)/i.test(colText) ||
       /(PLAZO|CONTRATA).*(PIE|INTEGRACI[OÓ]N|DTO\s*170)/i.test(colText))
    ) {
      colMap['horasPiePlazo'] = idx;
    }
    // SUBVENCIÓN GENERAL UNIFICADA (cuando la planilla no separa por tipo de contrato)
    else if (
      colMap['horasSubvGralUnified'] === undefined &&
      /^(TOTAL\s*)?(SUB.*GRAL|SUB.*GENERAL|SUB.*REGULAR|SUBVENCION\s*GENERAL|HORAS\s*REGULARES|REGULAR)$/i.test(colText)
    ) {
      colMap['horasSubvGralUnified'] = idx;
    }
    // SEP UNIFICADA
    else if (
      colMap['horasSepUnified'] === undefined &&
      /^(TOTAL\s*)?(SEP|SUB.*SEP|LEY\s*SEP|CONVENIO\s*SEP|HORAS\s*SEP)$/i.test(colText)
    ) {
      colMap['horasSepUnified'] = idx;
    }
    // PIE UNIFICADA
    else if (
      colMap['horasPieUnified'] === undefined &&
      /^(TOTAL\s*)?(PIE|SUB.*PIE|PROG.*INTEGRACI[OÓ]N|DECRETO\s*170|HORAS\s*PIE)$/i.test(colText)
    ) {
      colMap['horasPieUnified'] = idx;
    }
    // Observaciones / Notas
    else if (
      colMap['observaciones'] === undefined &&
      /OBSERVACI|NOTA|COMENTARIO|DETALLE|SITUACI|ESTADO/i.test(colText)
    ) {
      colMap['observaciones'] = idx;
    }
  });

  // Fallback posicional estricto solo si no se encontraron cabeceras mínimas
  if (colMap['nombres'] === undefined && colMap['rut'] === undefined) {
    colMap['nombres'] = 0;
    colMap['rut'] = 1;
    colMap['funcion'] = 2;
    colMap['horasContrato'] = 3;
    colMap['horasSubvGralInd'] = 4;
    colMap['horasSubvGralPlazo'] = 5;
    colMap['horasSepInd'] = 6;
    colMap['horasSepPlazo'] = 7;
    colMap['horasPieInd'] = 8;
    colMap['horasPiePlazo'] = 9;
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

    const horasContratoRaw = parseNumber(colMap['horasContrato'] !== undefined ? row[colMap['horasContrato']] : 0);

    // 1. Extraer columnas divididas por tipo de contrato
    let horasSubvGralInd = parseNumber(colMap['horasSubvGralInd'] !== undefined ? row[colMap['horasSubvGralInd']] : 0);
    let horasSubvGralPlazo = parseNumber(colMap['horasSubvGralPlazo'] !== undefined ? row[colMap['horasSubvGralPlazo']] : 0);
    let horasSepInd = parseNumber(colMap['horasSepInd'] !== undefined ? row[colMap['horasSepInd']] : 0);
    let horasSepPlazo = parseNumber(colMap['horasSepPlazo'] !== undefined ? row[colMap['horasSepPlazo']] : 0);
    let horasPieInd = parseNumber(colMap['horasPieInd'] !== undefined ? row[colMap['horasPieInd']] : 0);
    let horasPiePlazo = parseNumber(colMap['horasPiePlazo'] !== undefined ? row[colMap['horasPiePlazo']] : 0);

    // 2. Extraer columnas unificadas si las divididas están ausentes
    const hSubGralUni = parseNumber(colMap['horasSubvGralUnified'] !== undefined ? row[colMap['horasSubvGralUnified']] : 0);
    const hSepUni = parseNumber(colMap['horasSepUnified'] !== undefined ? row[colMap['horasSepUnified']] : 0);
    const hPieUni = parseNumber(colMap['horasPieUnified'] !== undefined ? row[colMap['horasPieUnified']] : 0);

    if (horasSubvGralInd === 0 && horasSubvGralPlazo === 0 && hSubGralUni > 0) {
      horasSubvGralInd = hSubGralUni;
    }
    if (horasSepInd === 0 && horasSepPlazo === 0 && hSepUni > 0) {
      horasSepInd = hSepUni;
    }
    if (horasPieInd === 0 && horasPiePlazo === 0 && hPieUni > 0) {
      horasPieInd = hPieUni;
    }

    const { nombres, apellidos } = separarNombresApellidos(nombreRaw);
    const norm = normalizarCargoAsistenteInteligente(funcionRaw);
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

    // 3. Fallback contextual si las columnas de subvención venían vacías pero hay horas de contrato
    let sumFuentes = horasSubvGralInd + horasSubvGralPlazo + horasSepInd + horasSepPlazo + horasPieInd + horasPiePlazo;

    if (sumFuentes === 0 && horasContratoRaw > 0) {
      const fullText = `${funcionRaw} ${observacionesFinal}`.toUpperCase();
      if (/PIE|INTEGRACI[OÓ]N|DTO\s*170/i.test(fullText) || norm.esEquipoPie) {
        horasPieInd = horasContratoRaw;
      } else if (/SEP|PREFERENCIAL/i.test(fullText)) {
        horasSepInd = horasContratoRaw;
      } else {
        horasSubvGralInd = horasContratoRaw;
      }
      sumFuentes = horasContratoRaw;
    }

    const finalHorasContrato = horasContratoRaw > 0 ? horasContratoRaw : sumFuentes;

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
      estamento: norm.estamento || clasificacion.estamento,
      horasContrato: finalHorasContrato,
      horasSubvencionGeneralIndefinido: horasSubvGralInd,
      horasSubvencionGeneralPlazoFijo: horasSubvGralPlazo,
      horasSepIndefinido: horasSepInd,
      horasSepPlazoFijo: horasSepPlazo,
      horasPieIndefinido: horasPieInd,
      horasPiePlazoFijo: horasPiePlazo,
      esDuplaPsicosocial: norm.esDuplaPsicosocial || clasificacion.esDuplaPsicosocial,
      esEquipoPie: norm.esEquipoPie || clasificacion.esEquipoPie,
      esTecnicoParvulo: norm.esTecnicoParvulo || clasificacion.esTecnicoParvulo,
      esAuxiliarServicio: norm.esAuxiliarServicio || clasificacion.esAuxiliarServicio,
      esInspectorPatio: norm.esInspectorPatio || clasificacion.esInspectorPatio,
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
