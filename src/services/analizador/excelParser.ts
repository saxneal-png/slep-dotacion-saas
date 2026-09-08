import * as XLSX from 'xlsx';
import { TeacherRecord, TeacherCourseAssignment } from '../../types/analizadorTypes';
import { normalizeCourseHeader, resolveCourseNameByHeader, extractCoursesFromActivityText } from './courseExtractor';
import { identifySchool } from '../../data/slepSchoolsCatalog';

export interface ParsedSchoolResult {
  rbd: string;
  establishment: string;
  comuna?: string;
  matricula: number;
  teachers: TeacherRecord[];
}

export function cleanStr(val: any): string {
  if (val === null || val === undefined) return '';
  return String(val).trim();
}

export function isRut(val: any): boolean {
  const s = cleanStr(val);
  if (!s) return false;
  const sClean = s.replace(/,/g, '.').replace(/\s+/g, '');
  if (/\b\d{1,2}\.?\d{3}\.?\d{3}[-‐][0-9kK]\b/.test(sClean)) return true;
  if (/\b\d{7,8}[-‐]?[kK]\b/.test(sClean)) return true;
  if (/^\d{7,9}$/.test(sClean)) return true;
  return false;
}

export function isBlockSummaryLabel(s: string): boolean {
  const sClean = s.trim().toLowerCase();
  if (!sClean) return false;
  if (/^(resumen\s*bloque|bloque\s*subvenci[oó]n|total\s*bloque)\b/i.test(sClean)) {
    return true;
  }
  if (/\b(sub\s*general|sub\s*sep|sub\s*pie|subvenci[oó]n|horas?\s*plan)\s*[:\s]*\d+\s*h/i.test(sClean)) {
    return true;
  }
  return false;
}

export function isSummaryOrTotalLabel(s: string): boolean {
  const sClean = s.trim().toLowerCase();
  if (!sClean) return false;
  const patterns = [
    /^(total|subtotal|sub-total|sub\s*total|resumen|suma|promedio|totales|carga\s*horaria|total\s*general|total\s*docente|total\s*contrato|total\s*horas|total\s*hrs)\b/,
    /^(rbd|escuela|colegio|liceo|slep|servicio\s*local|simbolog[ií]a|observacion(es)?)\b/,
  ];
  return patterns.some((p) => p.test(sClean));
}

export function looksLikeTeacherName(s: string): boolean {
  const sClean = s.trim();
  if (sClean.length < 3) return false;
  if (isSummaryOrTotalLabel(sClean)) return false;
  const sLower = sClean.toLowerCase();

  if (['vacante', 'por contratar', 'reemplazo', 'sin asignar', 'a contratar', 'docente nuevo', 'profesor nuevo', 'pendiente', 'profesional de apoyo'].some((k) => sLower.includes(k))) {
    return true;
  }

  if ([
    'recreo', 'taller', 'asignatura', 'docencia', 'planificacion', 'planificación',
    'tiempo', 'artículo', 'art.', 'horas', 'formacion', 'formación', 'historia',
    'lenguaje', 'matematica', 'matemática', 'ciencias', 'artes', 'musica', 'música',
    'educacion', 'educación', 'ingles', 'inglés', 'filosofia', 'filosofía', 'biologia',
    'biología', 'quimica', 'química', 'fisica', 'física', 'tecnologia', 'tecnología',
    'religion', 'religión', 'orientacion', 'orientación', 'cra', 'pie', 'sep', 'utp'
  ].some((k) => sLower.startsWith(k))) {
    return false;
  }
  const parts = sClean.split(/\s+/);
  return parts.length >= 2 || sClean.length >= 5;
}

export function extractRoleFromName(name: string): { cleanName: string; role: string } {
  const m = name.match(/\(([^)]+)\)/);
  if (m) {
    const role = m[1].trim();
    const cleanName = name.replace(/\s*\([^)]+\)/, '').trim();
    return { cleanName, role };
  }
  return { cleanName: name.trim(), role: '' };
}

/**
 * Convierte cualquier valor horario a horas cronológicas exactas.
 */
export function parseHoursCell(val: any): number {
  if (val === null || val === undefined) return 0.0;
  if (typeof val === 'number') {
    if (isNaN(val)) return 0.0;
    if (val > 0.0 && val < 1.0) {
      const converted = val * 24.0;
      if (converted > 0 && converted <= 50) return Math.round(converted * 100) / 100;
    }
    if (val > 0 && val <= 50) return Math.round(val * 100) / 100;
    return 0.0;
  }

  const s = cleanStr(val);
  if (!s || s === '-' || s === '.' || s.toLowerCase() === 'nan') return 0.0;

  if (/^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$|^\d{4}[/-]\d{1,2}[/-]\d{1,2}$/.test(s)) return 0.0;

  const dayTimeMatch = s.match(/(\d+)\s*days?,\s*(\d+):(\d{1,2})(?::(\d{1,2}))?/i);
  if (dayTimeMatch) {
    const days = parseInt(dayTimeMatch[1], 10);
    const h = parseInt(dayTimeMatch[2], 10);
    const m = parseInt(dayTimeMatch[3] || '0', 10);
    const sec = parseInt(dayTimeMatch[4] || '0', 10);
    const totalH = days * 24.0 + h + m / 60.0 + sec / 3600.0;
    if (totalH > 0 && totalH <= 60) {
      return Math.round(totalH * 100) / 100;
    }
  }

  const timeMatch = s.match(/\[?(\d+)\]?:(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?/i);
  if (timeMatch) {
    let h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2] || '0', 10);
    const sec = parseInt(timeMatch[3] || '0', 10);
    const ampm = timeMatch[4] ? timeMatch[4].toUpperCase() : null;

    if (ampm) {
      if (ampm === 'AM') {
        if (h === 12) h = 0;
      } else if (ampm === 'PM') {
        if (h < 12) h += 12;
      }
    }

    const totalH = h + m / 60.0 + sec / 3600.0;
    if (totalH > 0 && totalH <= 50) {
      return Math.round(totalH * 100) / 100;
    }
    if (totalH === 0) return 0.0;
  }

  const hmMatch = s.match(/(\d+)\s*h(?:rs?|oras?)?\s*(\d+)\s*m(?:in(?:utos?)?)?/i);
  if (hmMatch) {
    const h = parseInt(hmMatch[1], 10);
    const m = parseInt(hmMatch[2] || '0', 10);
    const totalH = h + m / 60.0;
    if (totalH > 0 && totalH <= 50) {
      return Math.round(totalH * 100) / 100;
    }
  }

  const textHrsMatch = s.match(/(?:^|\b)(\d+(?:[.,]\d+)?)\s*(?:hrs?|horas?)\b/i);
  if (textHrsMatch) {
    const parsed = parseFloat(textHrsMatch[1].replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0 && parsed <= 50) {
      return Math.round(parsed * 100) / 100;
    }
  }

  const numMatch = s.match(/^\s*(\d+(?:[.,]\d+)?)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1].replace(',', '.'));
    if (!isNaN(parsed)) {
      if (parsed > 0.0 && parsed < 1.0) {
        const converted = parsed * 24.0;
        if (converted > 0 && converted <= 50) return Math.round(converted * 100) / 100;
      }
      if (parsed > 0 && parsed <= 50) {
        return Math.round(parsed * 100) / 100;
      }
    }
  }

  return 0.0;
}

/**
 * Analiza un archivo Excel (.xlsx, .xls) o CSV con identificación integrada de cursos y carga horaria.
 */
export async function parseExcelBrowser(file: File, fileIndex: number = 0): Promise<ParsedSchoolResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    raw: false,
  });

  const detailKeywords = ['detalle', 'nomina', 'nómina', 'planta', 'distribucion', 'distribución'];
  const generalKeywords = ['dotaci', 'planilla', 'horas', 'docente'];
  const excludeKeywords = ['resumen', 'consolidado', 'grafic', 'portada', 'totales'];

  let sheetName = workbook.SheetNames[0];
  let foundDetail = false;
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase();
    if (detailKeywords.some((k) => lower.includes(k))) {
      sheetName = name;
      foundDetail = true;
      break;
    }
  }

  if (!foundDetail) {
    for (const name of workbook.SheetNames) {
      const lower = name.toLowerCase();
      if (generalKeywords.some((k) => lower.includes(k)) && !excludeKeywords.some((ex) => lower.includes(ex))) {
        sheetName = name;
        break;
      }
    }
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`No se pudo leer la hoja en ${file.name}`);
  }

  const data: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
    raw: false,
  });

  let rbd = '';
  let establishment = '';
  let matricula = 0;
  let headerRowIdx = -1;

  const maxRows = Math.min(data.length, 50);

  for (let r = 0; r < maxRows; r++) {
    const row = data[r] || [];
    const rowText = row.slice(0, 15).map(cleanStr).join(' ');

    if (!rbd) {
      const rbdMatch = rowText.match(/rbd\s*[:\.\-]?\s*(\d+)/i);
      if (rbdMatch) {
        rbd = rbdMatch[1];
      } else {
        for (let c = 0; c < row.length; c++) {
          const val = cleanStr(row[c]);
          if (/^1\d{4,5}$/.test(val)) {
            rbd = val;
            break;
          }
        }
      }
    }

    if (!establishment) {
      const estMatch = rowText.match(/(?:establecimiento|colegio|escuela|liceo)\s*[:\.\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s\.\-]+)/i);
      if (estMatch && estMatch[1].trim().length > 3) {
        establishment = estMatch[1].trim().toUpperCase();
      }
    }

    if (matricula === 0) {
      const matMatch = rowText.match(/matr[ií]cula\s*[:\.\-]?\s*(\d+)/i);
      if (matMatch) {
        matricula = parseInt(matMatch[1], 10);
      }
    }

    const rowLower = row.map((c) => cleanStr(c).toLowerCase()).join(' ');
    const hasDocente = ['docente', 'nombre', 'profesor', 'funcionario', 'run', 'rut', 'personal'].some((k) => rowLower.includes(k));
    const hasHoras = ['hora', 'hrs', 'asignatura', 'cargo', 'total ha', 'total hc', 'funcion', 'jornada', 'actividad', 'especialidad'].some((k) => rowLower.includes(k));
    if (hasDocente && hasHoras && headerRowIdx === -1) {
      headerRowIdx = r;
    }
  }

  // 1. En planillas oficiales SLEP, los encabezados de columnas están situados en la Fila 2 (índice 1 en base 0)
  if (data.length > 1) {
    const row1Lower = (data[1] || []).map((c) => cleanStr(c).toLowerCase());
    const hasDocenteFila2 = ['nombre', 'docente', 'run', 'rut', 'personal'].some((k) => row1Lower.some((c) => c.includes(k)));
    const hasHorasFila2 = ['hora', 'contrato', 'total ha', 'pie', 'sep', 'sub gral'].some((k) => row1Lower.some((c) => c.includes(k)));
    if (hasDocenteFila2 && hasHorasFila2) {
      headerRowIdx = 1;
    }
  }

  if (headerRowIdx === -1) {
    for (let r = 0; r < maxRows; r++) {
      const rowLower = (data[r] || []).map((c) => cleanStr(c).toLowerCase());
      if (rowLower.some((x) => x.includes('docente') || x.includes('nombre') || x.includes('rut') || x.includes('run'))) {
        headerRowIdx = r;
        break;
      }
    }
  }

  if (headerRowIdx === -1) headerRowIdx = 0;

  if (!rbd) {
    const filenameRbd = file.name.match(/(?:^|[^0-9])(\d{4,6})(?=[^0-9]|$)/);
    rbd = filenameRbd ? filenameRbd[1] : 'S/RBD';
  }

  if (!establishment || establishment.length < 3) {
    let cleanName = file.name.replace(/\.[^/.]+$/, '');
    cleanName = cleanName.replace(/(planilla|dotacion|slep|de|prueba|proyeccion|\d{4})/gi, '').trim();
    establishment = cleanName.replace(/^[ -_]+|[ -_]+$/g, '').toUpperCase() || 'ESTABLECIMIENTO SIN NOMBRE';
  }

  // Enriquecer e identificar automáticamente el establecimiento oficial y su comuna
  const catalogSchool = identifySchool(rbd, file.name) || identifySchool(establishment, file.name);
  let comuna = '';
  if (catalogSchool) {
    rbd = catalogSchool.rbd;
    establishment = catalogSchool.nombre;
    comuna = catalogSchool.comuna;
  }

  const headersRow1 = (data[headerRowIdx] || []).map((c) => cleanStr(c).toLowerCase());
  let hasSubHeader = false;
  let headersRow2: string[] = [];

  if (headerRowIdx + 1 < data.length) {
    headersRow2 = (data[headerRowIdx + 1] || []).map((c) => cleanStr(c).toLowerCase());
    const countH2 = headersRow2.filter((h) => ['run', 'rut', 'nombre', 'cargo', 'asignatura', 'hora', 'sub', 'total'].some((k) => h.includes(k))).length;
    if (countH2 >= 2) {
      hasSubHeader = true;
    }
  }

  const headers: string[] = [];
  const maxCols = Math.max(headersRow1.length, headersRow2.length);
  for (let c = 0; c < maxCols; c++) {
    const h1 = headersRow1[c] || '';
    const h2 = hasSubHeader && headersRow2[c] ? headersRow2[c] : '';
    if (h1 && h2 && h1 !== h2) {
      headers.push(`${h1} ${h2}`);
    } else if (h2) {
      headers.push(h2);
    } else {
      headers.push(h1);
    }
  }

  const dataStartIdx = hasSubHeader ? headerRowIdx + 2 : headerRowIdx + 1;

  let colNombres = -1;
  let colRun = -1;
  let colContrato = -1;
  let colTitularSubGral = -1;
  let colContrataSubGral = -1;
  let colTitularSep = -1;
  let colContrataSep = -1;
  let colTitularPie = -1;
  let colContrataPie = -1;
  let colTotalHa = -1;
  let colSubGral = -1;
  let colSubSep = -1;
  let colSubPie = -1;
  let colTotalHc = -1;
  let colActividad = -1;
  let colHorasSimple = -1;
  let colCursoExplicit = -1;
  let colObs = -1;

  for (let idx = 0; idx < headers.length; idx++) {
    const h = headers[idx];
    if (!h) continue;

    if (colNombres === -1 && ['nombre', 'docente', 'profesor', 'funcionario', 'apellidos', 'personal', 'nombres'].some((k) => h.includes(k))) {
      colNombres = idx;
    } else if (colRun === -1 && ['run', 'rut', 'cedula', 'identificacion'].some((k) => h.includes(k))) {
      colRun = idx;
    } else if (colContrato === -1 && [
      'horas contrato', 'hrs contrato', 'hrs. contrato', 'total horas contrato',
      'total hrs contrato', 'total contrato', 'horas totales', 'total horas',
      'horas semanales', 'total carga horaria'
    ].some((k) => h.includes(k))) {
      colContrato = idx;
    } else if (colContrataPie === -1 && (h.includes('contrata') && h.includes('pie'))) {
      colContrataPie = idx;
    } else if (colTitularPie === -1 && (h.includes('titular') && h.includes('pie'))) {
      colTitularPie = idx;
    } else if (colContrataSep === -1 && (h.includes('contrata') && h.includes('sep'))) {
      colContrataSep = idx;
    } else if (colTitularSep === -1 && (h.includes('titular') && h.includes('sep'))) {
      colTitularSep = idx;
    } else if (colTotalHa === -1 && (h.includes('total ha') || h.includes('horas aula') || h.includes('total h aula') || h === 'total ha*')) {
      colTotalHa = idx;
    } else if (colSubGral === -1 && ((h.includes('hc') || h.includes('total')) && (h.includes('gral') || h.includes('general')) && !['titular', 'contrata', 'indefinid', 'plazo'].some((k) => h.includes(k)))) {
      colSubGral = idx;
    } else if (colSubSep === -1 && ((h.includes('hc') || h.includes('total')) && h.includes('sep') && !['titular', 'contrata', 'indefinid', 'plazo'].some((k) => h.includes(k)))) {
      colSubSep = idx;
    } else if (colSubPie === -1 && ((h.includes('hc') || h.includes('total')) && h.includes('pie') && !['titular', 'contrata', 'indefinid', 'plazo'].some((k) => h.includes(k)))) {
      colSubPie = idx;
    } else if (colTotalHc === -1 && ((h === 'total hc' || h === 'total hc*' || h === 'total hc**') || ((h.includes('total') && h.includes('hc')) && !['gral', 'sep', 'pie', 'ha', 'curso'].some((k) => h.includes(k))) || h.includes('total cronologicas') || h.includes('total cronológicas'))) {
      colTotalHc = idx;
    } else if (colCursoExplicit === -1 && ['curso', 'grado', 'nivel curso', 'cursos asignados'].some((k) => h.includes(k))) {
      colCursoExplicit = idx;
    } else if (colActividad === -1 && ['asignatura', 'cargo', 'funcion', 'función', 'actividad', 'rol', 'especialidad', 'materia', 'descripcion', 'descripción'].some((k) => h.includes(k))) {
      colActividad = idx;
    } else if (colHorasSimple === -1 && ['horas asignadas', 'horas lectivas', 'jornada', 'horas', 'hora', 'hrs'].some((k) => h.includes(k))) {
      colHorasSimple = idx;
    } else if (colObs === -1 && ['observac', 'comentarios', 'detalle'].some((k) => h.includes(k))) {
      colObs = idx;
    }
  }

  const courseColumns: Array<{ colIdx: number; cursoCompleto: string; nivel: string; letra: string }> = [];

  // REGLA OFICIAL SLEP: Todas las columnas situadas entre "CONTRATA PIE" y "TOTAL HA*" son cursos
  let colLeftBoundary = -1;
  if (colContrataPie !== -1) colLeftBoundary = colContrataPie;
  else if (colTitularPie !== -1) colLeftBoundary = colTitularPie;
  else if (colSubPie !== -1) colLeftBoundary = colSubPie;
  else if (colContrataSep !== -1) colLeftBoundary = colContrataSep;

  let colRightBoundary = colTotalHa !== -1 ? colTotalHa : -1;

  if (colLeftBoundary !== -1 && colRightBoundary !== -1 && colRightBoundary > colLeftBoundary + 1) {
    for (let c = colLeftBoundary + 1; c < colRightBoundary; c++) {
      const h = headers[c];
      if (!h) continue;
      const cInfo = resolveCourseNameByHeader(h);
      courseColumns.push({
        colIdx: c,
        cursoCompleto: cInfo.cursoCompleto,
        nivel: cInfo.nivel,
        letra: cInfo.letra,
      });
    }
  } else {
    // Fallback: Si no se detectaron ambas columnas límite, escanear individualmente
    for (let idx = 0; idx < headers.length; idx++) {
      const h = headers[idx];
      if (!h) continue;
      if (
        idx === colNombres || idx === colRun || idx === colContrato ||
        idx === colTotalHa || idx === colTotalHc || idx === colSubGral ||
        idx === colSubSep || idx === colSubPie || idx === colActividad
      ) {
        continue;
      }
      const normCurso = normalizeCourseHeader(h);
      if (normCurso) {
        courseColumns.push({
          colIdx: idx,
          cursoCompleto: normCurso.cursoCompleto,
          nivel: normCurso.nivel,
          letra: normCurso.letra,
        });
      }
    }
  }

  if (colNombres === -1) colNombres = 0;

  const hasCourseColumns = courseColumns.length > 0;
  const hasSubventionColumns = (colSubGral !== -1 || colSubSep !== -1 || colSubPie !== -1 || colTotalHa !== -1);
  const isFlatStructure = (colActividad !== -1 && !hasSubventionColumns && !hasCourseColumns) && (colHorasSimple !== -1 || colContrato !== -1 || colTotalHc !== -1);

  interface TeacherTempData {
    name: string;
    rut: string;
    contract: number;
    activities: Array<{
      name: string;
      hours: number;
      curso?: string;
      desgloseCursos?: TeacherCourseAssignment[];
    }>;
    seenCount: number;
  }

  const teachersByKey = new Map<string, TeacherTempData>();

  // CASO 1: Formato Plano (columnas explícitas de actividad)
  if (isFlatStructure) {
    let currentTeacher = '';
    let currentRut = '';
    let currentContract = 0.0;

    for (let r = dataStartIdx; r < data.length; r++) {
      const row = data[r] || [];
      let nombreRaw = colNombres !== -1 && colNombres < row.length ? cleanStr(row[colNombres]) : '';
      let runRaw = colRun !== -1 && colRun < row.length ? cleanStr(row[colRun]) : '';
      const actRaw = colActividad !== -1 && colActividad < row.length ? cleanStr(row[colActividad]) : '';
      const cursoRaw = colCursoExplicit !== -1 && colCursoExplicit < row.length ? cleanStr(row[colCursoExplicit]) : '';

      const rowStrLower = row.slice(0, 5).map(cleanStr).join(' ').toLowerCase();
      if (isSummaryOrTotalLabel(rowStrLower) || isSummaryOrTotalLabel(nombreRaw)) {
        continue;
      }

      if (isRut(nombreRaw) && !isRut(runRaw)) {
        nombreRaw = runRaw;
        runRaw = cleanStr(row[colNombres]);
      }

      const contratoNum = colContrato !== -1 && colContrato < row.length ? parseHoursCell(row[colContrato]) : 0.0;
      const hSimple = colHorasSimple !== -1 && colHorasSimple < row.length ? parseHoursCell(row[colHorasSimple]) : 0.0;
      const totHc = colTotalHc !== -1 && colTotalHc < row.length ? parseHoursCell(row[colTotalHc]) : 0.0;

      if (nombreRaw && !isSummaryOrTotalLabel(nombreRaw)) {
        currentTeacher = nombreRaw;
      }
      if (runRaw) {
        currentRut = runRaw.replace(/,/g, '.').replace(/\s+/g, '');
      }
      if (contratoNum > 0) {
        currentContract = contratoNum;
      } else if (totHc > 0) {
        currentContract = totHc;
      }

      const { cleanName: cleanTname, role: roleInName } = extractRoleFromName(currentTeacher);
      const tKey = currentRut || cleanTname;
      if (!tKey) continue;

      if (!teachersByKey.has(tKey)) {
        teachersByKey.set(tKey, {
          name: cleanTname,
          rut: currentRut,
          contract: currentContract,
          activities: [],
          seenCount: 1,
        });
      } else {
        const entry = teachersByKey.get(tKey)!;
        entry.seenCount++;
        if (currentContract > entry.contract) {
          entry.contract = currentContract;
        }
      }

      const actH = hSimple > 0 ? hSimple : totHc > 0 ? totHc : contratoNum;
      const baseAct = actRaw || roleInName || 'Docencia de Aula';

      // Extracción de cursos
      let detectedCurso = cursoRaw;
      let cleanAsignatura = baseAct;
      const desgloseCursos: TeacherCourseAssignment[] = [];

      if (!detectedCurso) {
        const parsedCourse = extractCoursesFromActivityText(baseAct);
        if (parsedCourse.cursos.length > 0) {
          detectedCurso = parsedCourse.cursos[0];
          cleanAsignatura = parsedCourse.asignaturaLimpia || baseAct;
          for (const c of parsedCourse.cursos) {
            desgloseCursos.push({
              curso: c,
              asignatura: cleanAsignatura,
              horas: Math.round((actH / parsedCourse.cursos.length) * 100) / 100,
              tipo: 'AULA',
            });
          }
        }
      } else {
        desgloseCursos.push({
          curso: detectedCurso,
          asignatura: cleanAsignatura,
          horas: actH,
          tipo: 'AULA',
        });
      }

      if (actH > 0) {
        teachersByKey.get(tKey)!.activities.push({
          name: baseAct,
          hours: actH,
          curso: detectedCurso || undefined,
          desgloseCursos: desgloseCursos.length > 0 ? desgloseCursos : undefined,
        });
      }
    }
  } else {
    // CASO 2: Formato SLEP Jerárquico o Formato Matricial (columnas de cursos)
    let r = dataStartIdx;
    let currentSection = '';

    while (r < data.length) {
      const row = data[r] || [];
      const c1 = cleanStr(row[colNombres]);
      const c2 = colRun !== -1 && colRun < row.length ? cleanStr(row[colRun]) : '';
      const obs = colObs !== -1 && colObs < row.length ? cleanStr(row[colObs]) : '';

      const hasRun = colRun !== -1 ? isRut(c2) : false;
      const contratoNum = colContrato !== -1 && colContrato < row.length ? parseHoursCell(row[colContrato]) : 0.0;

      const hGralMaster = colSubGral !== -1 && colSubGral < row.length ? parseHoursCell(row[colSubGral]) : 0.0;
      const hSepMaster = colSubSep !== -1 && colSubSep < row.length ? parseHoursCell(row[colSubSep]) : 0.0;
      const hPieMaster = colSubPie !== -1 && colSubPie < row.length ? parseHoursCell(row[colSubPie]) : 0.0;
      const totHcMaster = colTotalHc !== -1 && colTotalHc < row.length ? parseHoursCell(row[colTotalHc]) : 0.0;
      const totHaMaster = colTotalHa !== -1 && colTotalHa < row.length ? parseHoursCell(row[colTotalHa]) : 0.0;
      const anyMasterH = (contratoNum > 0 || hGralMaster > 0 || hSepMaster > 0 || hPieMaster > 0 || totHcMaster > 0 || totHaMaster > 0);

      if (!c2 && c1 && !anyMasterH && ['PROGRAMA PIE', 'EQUIPO PIE', 'DOCENTES PIE', 'CO DOCENTES', 'EQUIPO GESTIÓN', 'ASISTENTES', 'SIMBOLOGÍA', 'RESUMEN'].some((k) => c1.toUpperCase().includes(k)) && !looksLikeTeacherName(c1)) {
        currentSection = c1.toUpperCase();
        r++;
        continue;
      }

      if (isSummaryOrTotalLabel(c1)) {
        r++;
        continue;
      }

      const isValidTeacher = hasRun || (looksLikeTeacherName(c1) && (anyMasterH || c1 !== ''));
      if (!isValidTeacher) {
        r++;
        continue;
      }

      const { cleanName: teacherName, role: roleInName } = extractRoleFromName(c1);
      const cleanRut = c2 ? c2.replace(/,/g, '.').replace(/\s+/g, '') : '';
      const tKey = cleanRut || teacherName;
      if (!tKey) {
        r++;
        continue;
      }

      const subActivities: Array<{
        name: string;
        hours: number;
        curso?: string;
        desgloseCursos?: TeacherCourseAssignment[];
        isBlock: boolean;
      }> = [];

      let subR = r + 1;

      while (subR < data.length) {
        const subRow = data[subR] || [];
        const subC1 = cleanStr(subRow[colNombres]);
        const subC2 = colRun !== -1 && colRun < subRow.length ? cleanStr(subRow[colRun]) : '';

        if (colRun !== -1 && isRut(subC2)) break;
        const subContrato = colContrato !== -1 && colContrato < subRow.length ? parseHoursCell(subRow[colContrato]) : 0.0;
        if (looksLikeTeacherName(subC1) && subContrato > 0) break;

        const hGral = colSubGral !== -1 && colSubGral < subRow.length ? parseHoursCell(subRow[colSubGral]) : 0.0;
        const hSep = colSubSep !== -1 && colSubSep < subRow.length ? parseHoursCell(subRow[colSubSep]) : 0.0;
        const hPie = colSubPie !== -1 && colSubPie < subRow.length ? parseHoursCell(subRow[colSubPie]) : 0.0;
        const totHc = colTotalHc !== -1 && colTotalHc < subRow.length ? parseHoursCell(subRow[colTotalHc]) : 0.0;
        const totHa = colTotalHa !== -1 && colTotalHa < subRow.length ? parseHoursCell(subRow[colTotalHa]) : 0.0;

        let h = hGral + hSep + hPie;
        if (h === 0.0 && totHc > 0.0) h = totHc;
        if (h === 0.0 && totHa > 0.0) h = (totHa * 45.0) / 60.0;

        // Si existen columnas de cursos, calcular horas por curso en esta subfila
        const rowCourseAssignments: TeacherCourseAssignment[] = [];
        if (hasCourseColumns) {
          for (const cCol of courseColumns) {
            if (cCol.colIdx < subRow.length) {
              const hCurso = parseHoursCell(subRow[cCol.colIdx]);
              if (hCurso > 0) {
                rowCourseAssignments.push({
                  curso: cCol.cursoCompleto,
                  nivel: cCol.nivel,
                  letra: cCol.letra,
                  asignatura: subC1 || 'Docencia de Aula',
                  horas: hCurso,
                  tipo: 'AULA',
                });
              }
            }
          }
        }

        const sumMatrixHours = rowCourseAssignments.reduce((acc, a) => acc + a.horas, 0);
        if (h === 0 && sumMatrixHours > 0) {
          h = sumMatrixHours;
        }

        if (!subC2 && subC1 && h === 0 && ['PROGRAMA PIE', 'EQUIPO PIE', 'DOCENTES PIE', 'CO DOCENTES', 'EQUIPO GESTIÓN', 'SIMBOLOGÍA', 'RESUMEN'].some((k) => subC1.toUpperCase().includes(k)) && !looksLikeTeacherName(subC1)) {
          break;
        }

        if (isSummaryOrTotalLabel(subC1)) {
          subR++;
          break;
        }

        if (subC1 || sumMatrixHours > 0) {
          const isBlock = isBlockSummaryLabel(subC1);
          if (h > 0) {
            // Extracción de curso si no se obtuvieron de las columnas
            let singleCourse: string | undefined = undefined;
            let finalDesglose = rowCourseAssignments;

            if (finalDesglose.length === 0) {
              const parsedCourse = extractCoursesFromActivityText(subC1);
              if (parsedCourse.cursos.length > 0) {
                singleCourse = parsedCourse.cursos[0];
                finalDesglose = parsedCourse.cursos.map((c) => ({
                  curso: c,
                  asignatura: parsedCourse.asignaturaLimpia || subC1,
                  horas: Math.round((h / parsedCourse.cursos.length) * 100) / 100,
                  tipo: 'AULA',
                }));
              }
            } else {
              singleCourse = finalDesglose.map((a) => a.curso).join(', ');
            }

            subActivities.push({
              name: subC1 || 'Asignatura / Función',
              hours: Math.round(h * 100) / 100,
              curso: singleCourse,
              desgloseCursos: finalDesglose.length > 0 ? finalDesglose : undefined,
              isBlock,
            });
          }
        }

        subR++;
      }

      if (!teachersByKey.has(tKey)) {
        teachersByKey.set(tKey, {
          name: teacherName,
          rut: cleanRut,
          contract: contratoNum,
          activities: [],
          seenCount: 1,
        });
      } else {
        const entry = teachersByKey.get(tKey)!;
        entry.seenCount++;
        if (contratoNum > entry.contract) {
          entry.contract = contratoNum;
        }
      }

      const tEntry = teachersByKey.get(tKey)!;
      const nonBlockItems = subActivities.filter((item) => !item.isBlock);
      const validItems = nonBlockItems.length > 0 ? nonBlockItems : subActivities;

      if (validItems.length > 0) {
        for (const item of validItems) {
          tEntry.activities.push({
            name: item.name,
            hours: item.hours,
            curso: item.curso,
            desgloseCursos: item.desgloseCursos,
          });
        }
      } else {
        let masterH = hGralMaster + hSepMaster + hPieMaster;
        if (totHcMaster > masterH) masterH = totHcMaster;
        if (contratoNum > masterH) masterH = contratoNum;
        if (masterH === 0.0 && totHaMaster > 0.0) masterH = (totHaMaster * 45.0) / 60.0;

        let actName = roleInName;
        if (!actName) {
          if (currentSection.includes('PIE') || hPieMaster > 0) actName = 'Docente PIE';
          else if (currentSection.includes('CO DOCENTE')) actName = 'Co-docente';
          else if (obs) actName = obs;
          else actName = 'Docencia de Aula';
        }

        // Revisar si la fila maestra misma contiene horas en las columnas de cursos
        const masterCourseAssignments: TeacherCourseAssignment[] = [];
        if (hasCourseColumns) {
          for (const cCol of courseColumns) {
            if (cCol.colIdx < row.length) {
              const hCurso = parseHoursCell(row[cCol.colIdx]);
              if (hCurso > 0) {
                masterCourseAssignments.push({
                  curso: cCol.cursoCompleto,
                  nivel: cCol.nivel,
                  letra: cCol.letra,
                  asignatura: actName || 'Docencia de Aula',
                  horas: hCurso,
                  tipo: 'AULA',
                });
              }
            }
          }
        }

        const sumMatrixHours = masterCourseAssignments.reduce((acc, a) => acc + a.horas, 0);
        if (masterH === 0 && sumMatrixHours > 0) {
          masterH = sumMatrixHours;
        }

        const effH = masterH > 0 ? masterH : contratoNum;

        if (masterCourseAssignments.length > 0) {
          for (const mAsig of masterCourseAssignments) {
            tEntry.activities.push({
              name: `${actName || 'Docencia de Aula'} (${mAsig.curso})`,
              hours: mAsig.horas,
              curso: mAsig.curso,
              desgloseCursos: [mAsig],
            });
          }

          const remanente = Math.round((effH - sumMatrixHours) * 100) / 100;
          if (remanente > 0) {
            tEntry.activities.push({
              name: 'Horas no lectivas / Preparación y Gestión',
              hours: remanente,
              curso: undefined,
              desgloseCursos: undefined,
            });
          }
        } else if (effH > 0) {
          const parsedC = extractCoursesFromActivityText(actName);
          const singleC = parsedC.cursos[0];
          const desglose = parsedC.cursos.map((c) => ({
            curso: c,
            asignatura: parsedC.asignaturaLimpia || actName,
            horas: Math.round((effH / parsedC.cursos.length) * 100) / 100,
            tipo: 'AULA' as const,
          }));

          tEntry.activities.push({
            name: actName,
            hours: Math.round(effH * 100) / 100,
            curso: singleC,
            desgloseCursos: desglose.length > 0 ? desglose : undefined,
          });
        }
      }

      r = subR;
    }
  }

  // Consolidar docentes y auditar la carga asignada
  const teachersData: TeacherRecord[] = [];

  teachersByKey.forEach((tData, tIdx) => {
    let totH = Math.round(tData.activities.reduce((acc, a) => acc + a.hours, 0) * 100) / 100;
    const decl = tData.contract > 0 ? tData.contract : totH;
    if (tData.activities.length === 0 && decl > 0) {
      tData.activities.push({ name: 'Docencia de Aula', hours: decl });
      totH = decl;
    }

    const isOver44 = (totH > 44.05 || decl > 44.05);
    let warn = '';
    if (isOver44) {
      const maxVal = Math.max(totH, decl);
      const diff = Math.round((maxVal - 44.0) * 100) / 100;
      warn = `⚠️ Supera el tope legal de 44 hrs semanales: registra ${maxVal.toFixed(1)} hrs (+${diff.toFixed(1)} hrs de sobrecarga).`;
    }

    const diferenciaCarga = Math.round((totH - decl) * 100) / 100;
    let estadoCarga: TeacherRecord['estado_carga'] = 'CUADRADA';
    if (isOver44) estadoCarga = 'EXCESO_LEGAL';
    else if (diferenciaCarga > 0.5) estadoCarga = 'SOBREASIGNADA';
    else if (diferenciaCarga < -0.5) estadoCarga = 'SUBASIGNADA';

    // Recolectar todos los cursos únicos de este profesor
    const allTeacherCourses = new Set<string>();
    tData.activities.forEach((act) => {
      if (act.curso) allTeacherCourses.add(act.curso);
      if (act.desgloseCursos) {
        act.desgloseCursos.forEach((d) => allTeacherCourses.add(d.curso));
      }
    });
    const teacherCourseList = Array.from(allTeacherCourses);

    tData.activities.forEach((act, actIdx) => {
      teachersData.push({
        id: `${rbd}-${fileIndex}-${tIdx}-${actIdx}`,
        file_name: file.name,
        rbd,
        establishment,
        comuna,
        rut: tData.rut,
        teacher_name: tData.name,
        activity: act.name,
        curso: act.curso,
        cursos_asignados: teacherCourseList,
        desglose_cursos: act.desgloseCursos,
        hours: act.hours,
        category: 'AULA', // Se asigna temporalmente y luego el clasificador la precisa
        source: 'Pendiente Clasificación',
        total_declared: decl,
        total_teacher_hours: totH,
        diferencia_carga: diferenciaCarga,
        estado_carga: estadoCarga,
        is_over_legal_limit: isOver44,
        legal_limit_warning: warn,
      });
    });
  });

  return {
    rbd,
    establishment,
    comuna,
    matricula,
    teachers: teachersData,
  };
}
