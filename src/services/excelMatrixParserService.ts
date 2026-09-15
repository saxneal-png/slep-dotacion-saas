import ExcelJS from 'exceljs';
import {
  CursoDetectadoExcel,
  DocenteMatrizExcel,
  AsignacionMatrizExcel,
  MatrizExcelParseResult
} from '../types';
import { identifySchool } from '../data/slepSchoolsCatalog';
import { normalizarRut } from '../utils/rutUtils';
import { obtenerPlanPorCurso } from '@slep/mineduc-engine';

export { normalizarRut };

export function normalizarEncabezadoCurso(header: string): { nivel: string; letra: string; regimen: 'JEC' | 'No JEC'; esMultigrado: boolean } | null {
  if (!header) return null;
  const raw = header.trim();
  const clean = raw.toUpperCase().replace(/\s+/g, ' ');

  if (/^(NOMBRES?|RUN|RUT|HORAS?|TITULAR(ES)?|CONTRATA|TOTAL|OBSERVA|SUBV|SUB\b|CARGO|FUNCION|ESTAMENTO)/i.test(clean)) {
    return null;
  }

  // 1. EPJA - Educación de Adultos
  if (/(?:EPJA|ADULTO)/i.test(clean) || /(?:PRIMER|SEGUNDO|TERCER|[123]°?)\s*NIVEL/i.test(clean)) {
    const letraMatch = clean.match(/\b([A-Z])\b$/);
    const letra = letraMatch ? letraMatch[1] : 'A';
    if (/OFICIO/i.test(clean)) {
      return { nivel: 'EPJA Media TP - Oficios (1° a 4° Medio TP)', letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/TP|T[EÉ]CNICO|PROFESIONAL|ESPECIALIDAD/i.test(clean)) {
      if (/(?:2|SEGUNDO|3|4|TERCER|CUARTO)/i.test(clean)) {
        return { nivel: 'EPJA Media TP - 2° y 3° Nivel Medio (3° y 4° Medio TP)', letra, regimen: 'No JEC', esMultigrado: false };
      }
      return { nivel: 'EPJA Media TP - 1° Nivel Medio (1° y 2° Medio TP)', letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/MEDIO|SECUNDARIA|HC|HUMAN/i.test(clean)) {
      if (/(?:2|SEGUNDO|3|4)/i.test(clean)) {
        return { nivel: 'EPJA Media HC - 2° Nivel Medio (3° y 4° Medio)', letra, regimen: 'No JEC', esMultigrado: false };
      }
      return { nivel: 'EPJA Media HC - 1° Nivel Medio (1° y 2° Medio)', letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/(?:3|TERCER|7|8)/i.test(clean)) {
      return { nivel: 'EPJA Básica - 3° Nivel Básico (7° a 8° Básico)', letra, regimen: 'No JEC', esMultigrado: false };
    }
    if (/(?:2|SEGUNDO|5|6)/i.test(clean)) {
      return { nivel: 'EPJA Básica - 2° Nivel Básico (5° a 6° Básico)', letra, regimen: 'No JEC', esMultigrado: false };
    }
    return { nivel: 'EPJA Básica - 1° Nivel Básico (1° a 4° Básico)', letra, regimen: 'No JEC', esMultigrado: false };
  }

  // 1.5 Especialidades Técnico-Profesionales (Decretos 452/2013 y 0954/2015)
  if (/(?:ELECTRIC|PROGRAMAC|GASTRONOM|PARVULO|ADMINISTRAC|CONSTRUCC|MECANIC|AGROPEC|ELABORACION|ALIMENTO|EDIFICAC|TERMINACION|VIAL|MATRICER|HERRAMIENTA|COCINA|PASTEL)/i.test(clean)) {
    const letraMatch = clean.match(/\b([A-Z])\b$/);
    const letra = letraMatch ? letraMatch[1] : 'A';
    const planDetectado = obtenerPlanPorCurso(clean, 'JEC');
    if (planDetectado) {
      return { nivel: planDetectado.nivel, letra, regimen: 'JEC', esMultigrado: false };
    }
  }

  // 2. Cursos Combinados
  if (/COMBINAD/i.test(clean) || /COMB\b/i.test(clean)) {
    return { nivel: `Curso Combinado ${raw}`, letra: 'U', regimen: 'JEC', esMultigrado: true };
  }

  // 3. Multigrado Parvularia NT1-NT2
  if (/^(?:NT1\s*[-/]\s*NT2|PRE-?K(?:INDER)?\s*[-/]\s*K(?:INDER)?)/i.test(clean)) {
    return { nivel: 'Multigrado NT1-NT2', letra: 'U', regimen: 'No JEC', esMultigrado: true };
  }

  // 4. Multigrado Básica (ej: 1°-2° Básico, 1 a 6, 1-2-3-4)
  const multiBasicaMatch = clean.match(/^([1-8])°?\s*[-/aA]\s*([1-8])°?(?:\s*[-/]\s*([1-8])°?)?(?:\s*B[AÁ]SICO)?$/i);
  if (multiBasicaMatch) {
    return { nivel: `Multigrado ${raw}`, letra: 'U', regimen: 'JEC', esMultigrado: true };
  }

  const laboralMatch = clean.match(/^LABORAL\s*([0-9]+)$/i);
  if (laboralMatch) {
    return { nivel: `Laboral ${laboralMatch[1]}`, letra: 'U', regimen: 'No JEC', esMultigrado: false };
  }

  if (/^(?:NT1|PK|PRE-?K(?:INDER)?)\s*([A-Z])?$/i.test(clean)) {
    const m = clean.match(/^(?:NT1|PK|PRE-?K(?:INDER)?)\s*([A-Z])?$/i);
    const letra = m && m[1] ? m[1].toUpperCase() : 'A';
    return { nivel: 'Pre-Kínder', letra, regimen: 'No JEC', esMultigrado: false };
  }
  if (/^(?:NT2|K|K(?:INDER)?)\s*([A-Z])?$/i.test(clean)) {
    const m = clean.match(/^(?:NT2|K|K(?:INDER)?)\s*([A-Z])?$/i);
    const letra = m && m[1] ? m[1].toUpperCase() : 'A';
    return { nivel: 'Kínder', letra, regimen: 'No JEC', esMultigrado: false };
  }

  const mediaMatch = clean.match(/^([1-4])°?\s*(?:M|MED|MEDIO)\s*([A-Z])?$/i);
  if (mediaMatch) {
    const num = mediaMatch[1];
    const letra = mediaMatch[2] ? mediaMatch[2].toUpperCase() : 'A';
    return { nivel: `${num}° Medio`, letra, regimen: 'JEC', esMultigrado: false };
  }

  const basicaPalabraMatch = clean.match(/^([1-8])°?\s*B[AÁ]SICO(?:\s*([A-Z]))?$/i);
  if (basicaPalabraMatch) {
    const num = basicaPalabraMatch[1];
    const letra = basicaPalabraMatch[2] ? basicaPalabraMatch[2].toUpperCase() : 'A';
    return { nivel: `${num}° Básico`, letra, regimen: 'JEC', esMultigrado: false };
  }

  const basicaAbrevMatch = clean.match(/^([1-8])°?\s*([A-Z])$/i);
  if (basicaAbrevMatch) {
    const num = basicaAbrevMatch[1];
    const letra = basicaAbrevMatch[2].toUpperCase();
    return { nivel: `${num}° Básico`, letra, regimen: 'JEC', esMultigrado: false };
  }

  const basicaDigitoMatch = clean.match(/^([1-8])°?$/);
  if (basicaDigitoMatch) {
    const num = basicaDigitoMatch[1];
    return { nivel: `${num}° Básico`, letra: 'U', regimen: 'JEC', esMultigrado: false };
  }

  return null;
}

export function extraerHorasCelda(val: any): number {
  if (val === null || val === undefined || val === '') return 0;

  if (typeof val === 'object' && val !== null) {
    if ('result' in val) {
      return extraerHorasCelda(val.result);
    }
    if (val instanceof Date) {
      const hours = val.getHours();
      const mins = val.getMinutes();
      const total = hours + mins / 60;
      if (total > 0 && total <= 50) return Math.round(total * 100) / 100;
      return 0;
    }
  }

  if (typeof val === 'number') {
    if (isNaN(val)) return 0;
    if (val > 0 && val < 1) {
      const conv = val * 24;
      if (conv > 0 && conv <= 50) return Math.round(conv * 100) / 100;
    }
    if (val > 0 && val <= 50) return Math.round(val * 100) / 100;
    return 0;
  }

  const str = String(val).trim();
  if (!str) return 0;

  const timeMatch = str.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const h = parseInt(timeMatch[1], 10);
    const m = parseInt(timeMatch[2], 10);
    const total = h + m / 60;
    if (total > 0 && total <= 50) return Math.round(total * 100) / 100;
  }

  const numMatch = str.match(/^(\d+(?:[.,]\d+)?)/);
  if (numMatch) {
    const parsed = parseFloat(numMatch[1].replace(',', '.'));
    if (!isNaN(parsed)) {
      if (parsed > 0 && parsed < 1) {
        const conv = parsed * 24;
        if (conv > 0 && conv <= 50) return Math.round(conv * 100) / 100;
      }
      if (parsed > 0 && parsed <= 50) return Math.round(parsed * 100) / 100;
    }
  }

  return 0;
}

export function separarNombresApellidos(nombreCompleto: string): { nombres: string; apellidos: string } {
  const clean = nombreCompleto.trim();
  if (clean.includes(',')) {
    const parts = clean.split(',');
    const apellidos = parts[0].trim();
    const nombres = parts.slice(1).join(' ').trim();
    return { nombres: nombres || 'Docente', apellidos: apellidos || 'Sin Apellido' };
  }

  const parts = clean.split(/\s+/);
  if (parts.length <= 2) {
    return { nombres: parts[0] || 'Docente', apellidos: parts[1] || '' };
  }
  const nombres = parts.slice(0, 2).join(' ');
  const apellidos = parts.slice(2).join(' ');
  return { nombres, apellidos };
}

function esFilaResumenOTotal(txt: string): boolean {
  if (!txt) return false;
  const clean = txt.trim().toLowerCase();
  return /^(total|subtotal|sub-total|resumen|suma|promedio|totales|carga\s*horaria|rbd|escuela|colegio|liceo)\b/i.test(clean);
}

export async function parseMatrizExcel(
  data: ArrayBuffer | Uint8Array,
  fileName: string
): Promise<MatrizExcelParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as any);

  if (!workbook.worksheets.length) {
    throw new Error('El archivo Excel no contiene hojas de cálculo.');
  }

  const detailKeywords = ['detalle', 'nomina', 'nómina', 'planta', 'distribucion', 'distribución', 'dotacion', 'dotación'];
  let worksheet = workbook.worksheets[0];
  for (const ws of workbook.worksheets) {
    const nameLow = ws.name.toLowerCase();
    if (detailKeywords.some(k => nameLow.includes(k))) {
      worksheet = ws;
      break;
    }
  }

  let rbdDetectado: string | undefined = undefined;
  let nombreEstablecimientoDetectado: string | undefined = undefined;
  let periodoDetectado = 2026;

  const filePeriodoMatch = fileName.match(/\b(202[5-9])\b/);
  if (filePeriodoMatch) {
    periodoDetectado = parseInt(filePeriodoMatch[1], 10);
  }

  const fileRbdMatch = fileName.match(/\b(\d{4,6})\b/);
  if (fileRbdMatch) {
    rbdDetectado = fileRbdMatch[1];
  }

  for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    for (let c = 1; c <= Math.min(15, worksheet.columnCount); c++) {
      const val = row.getCell(c).value;
      if (!val) continue;
      const strVal = String(val).trim();

      if (!filePeriodoMatch) {
        const pMatch = strVal.match(/\b(202[5-9])\b/);
        if (pMatch) periodoDetectado = parseInt(pMatch[1], 10);
      }

      if (!rbdDetectado) {
        const rbdMatch = strVal.match(/rbd\s*[:\.\-]?\s*(\d{4,6})/i);
        if (rbdMatch) rbdDetectado = rbdMatch[1];
      }

      if (!nombreEstablecimientoDetectado && /^(LICEO|ESCUELA|COLEGIO)\b/i.test(strVal)) {
        nombreEstablecimientoDetectado = strVal.split(/[-–—(]/)[0].trim();
      }
    }
  }

  let comunaDetectada: string | undefined = undefined;
  const catalogoSchool = identifySchool(rbdDetectado, fileName) || identifySchool(nombreEstablecimientoDetectado, fileName);
  if (catalogoSchool) {
    rbdDetectado = catalogoSchool.rbd;
    nombreEstablecimientoDetectado = catalogoSchool.nombre;
    comunaDetectada = catalogoSchool.comuna;
  }

  let headerRowIndex = -1;
  for (let r = 1; r <= Math.min(15, worksheet.rowCount); r++) {
    const row = worksheet.getRow(r);
    let rowText = '';
    for (let c = 1; c <= 15; c++) {
      rowText += ' ' + String(row.getCell(c).value || '').toUpperCase();
    }
    if (rowText.includes('NOMBRES') || rowText.includes('DOCENTE') || (rowText.includes('RUN') && rowText.includes('CONTRATO'))) {
      headerRowIndex = r;
      break;
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 2;
  }

  const headerRow = worksheet.getRow(headerRowIndex);
  let colNombres = 1;
  let colRun = 2;
  let colContrato = 3;
  let colTitularSubGral = -1;
  let colContrataSubGral = -1;
  let colTitularSep = -1;
  let colContrataSep = -1;
  let colTitularPie = -1;
  let colContrataPie = -1;
  let colTotalHa = -1;
  let colTotalHcSubGral = -1;
  let colTotalHcSubSep = -1;
  let colTotalHcSubPie = -1;
  let colTotalHc = -1;
  let colObservaciones = -1;

  const cursosDetectados: CursoDetectadoExcel[] = [];

  for (let c = 1; c <= worksheet.columnCount; c++) {
    const cellVal = headerRow.getCell(c).value;
    if (!cellVal) continue;
    const h = String(cellVal).trim();
    const hUpper = h.toUpperCase();

    if (hUpper === 'NOMBRES' || hUpper === 'NOMBRE' || hUpper === 'NOMBRE DOCENTE') {
      colNombres = c;
    } else if (hUpper === 'RUN' || hUpper === 'RUT') {
      colRun = c;
    } else if (hUpper.includes('HORAS CONTRATO') || hUpper.includes('HRS CONTRATO') || hUpper === 'CONTRATO') {
      colContrato = c;
    } else if (hUpper.includes('TITULAR') && (hUpper.includes('SUB') || hUpper.includes('GRAL') || hUpper.includes('NORMAL'))) {
      colTitularSubGral = c;
    } else if (hUpper.includes('CONTRATA') && (hUpper.includes('SUB') || hUpper.includes('GRAL') || hUpper.includes('NORMAL'))) {
      colContrataSubGral = c;
    } else if (hUpper.includes('TITULAR') && hUpper.includes('SEP')) {
      colTitularSep = c;
    } else if (hUpper.includes('CONTRATA') && hUpper.includes('SEP')) {
      colContrataSep = c;
    } else if (hUpper.includes('TITULAR') && hUpper.includes('PIE')) {
      colTitularPie = c;
    } else if (hUpper.includes('CONTRATA') && hUpper.includes('PIE')) {
      colContrataPie = c;
    } else if (hUpper.includes('TOTAL H') && (hUpper.includes('AULA') || hUpper.includes('HA'))) {
      colTotalHa = c;
    } else if (hUpper.includes('TOTAL HC') && (hUpper.includes('GRAL') || hUpper.includes('NORMAL'))) {
      colTotalHcSubGral = c;
    } else if (hUpper.includes('TOTAL HC') && hUpper.includes('SEP')) {
      colTotalHcSubSep = c;
    } else if (hUpper.includes('TOTAL HC') && hUpper.includes('PIE')) {
      colTotalHcSubPie = c;
    } else if (hUpper === 'TOTAL HC' || (hUpper.includes('TOTAL') && hUpper.includes('HC') && !hUpper.includes('SUB'))) {
      colTotalHc = c;
    } else if (hUpper.includes('OBSERVAC')) {
      colObservaciones = c;
    } else {
      const infoCurso = normalizarEncabezadoCurso(h);
      if (infoCurso) {
        cursosDetectados.push({
          colIndex: c,
          headerRaw: h,
          nivel: infoCurso.nivel,
          letra: infoCurso.letra,
          regimen: infoCurso.regimen,
          esMultigrado: infoCurso.esMultigrado
        });
      }
    }
  }

  const docentes: DocenteMatrizExcel[] = [];
  const alertas: string[] = [];
  let r = headerRowIndex + 1;

  while (r <= worksheet.rowCount) {
    const row = worksheet.getRow(r);
    const c1 = String(row.getCell(colNombres).value || '').trim();
    const c2 = String(row.getCell(colRun).value || '').trim();

    if (esFilaResumenOTotal(c1) && !c2) {
      r++;
      continue;
    }

    const rutLimpio = normalizarRut(c2);
    const horasContratoMaster = extraerHorasCelda(row.getCell(colContrato).value);
    const titGral = colTitularSubGral !== -1 ? extraerHorasCelda(row.getCell(colTitularSubGral).value) : 0;
    const cttaGral = colContrataSubGral !== -1 ? extraerHorasCelda(row.getCell(colContrataSubGral).value) : 0;
    const titSep = colTitularSep !== -1 ? extraerHorasCelda(row.getCell(colTitularSep).value) : 0;
    const cttaSep = colContrataSep !== -1 ? extraerHorasCelda(row.getCell(colContrataSep).value) : 0;
    const titPie = colTitularPie !== -1 ? extraerHorasCelda(row.getCell(colTitularPie).value) : 0;
    const cttaPie = colContrataPie !== -1 ? extraerHorasCelda(row.getCell(colContrataPie).value) : 0;

    const tieneHorasFinanciamiento = (titGral + cttaGral + titSep + cttaSep + titPie + cttaPie) > 0;
    const esFilaMaestraDocente = (rutLimpio !== '' && rutLimpio.length >= 7) ||
      (c1 !== '' && (horasContratoMaster > 0 || tieneHorasFinanciamiento));

    if (!esFilaMaestraDocente) {
      r++;
      continue;
    }

    const { nombres, apellidos } = separarNombresApellidos(c1);
    const totalContratoEfectivo = horasContratoMaster > 0 ? horasContratoMaster : (titGral + cttaGral + titSep + cttaSep + titPie + cttaPie);

    const docenteItem: DocenteMatrizExcel = {
      nombres,
      apellidos,
      run: rutLimpio || `TEMP-${r}`,
      horasContrato: totalContratoEfectivo,
      titularSubGral: titGral,
      contrataSubGral: cttaGral,
      titularSep: titSep,
      contrataSep: cttaSep,
      titularPie: titPie,
      contrataPie: cttaPie,
      totalHa: colTotalHa !== -1 ? extraerHorasCelda(row.getCell(colTotalHa).value) : undefined,
      totalHcSubGral: colTotalHcSubGral !== -1 ? extraerHorasCelda(row.getCell(colTotalHcSubGral).value) : undefined,
      totalHcSubSep: colTotalHcSubSep !== -1 ? extraerHorasCelda(row.getCell(colTotalHcSubSep).value) : undefined,
      totalHcSubPie: colTotalHcSubPie !== -1 ? extraerHorasCelda(row.getCell(colTotalHcSubPie).value) : undefined,
      totalHc: colTotalHc !== -1 ? extraerHorasCelda(row.getCell(colTotalHc).value) : undefined,
      observaciones: colObservaciones !== -1 ? String(row.getCell(colObservaciones).value || '').trim() : undefined,
      asignaciones: []
    };

    let subR = r + 1;
    while (subR <= worksheet.rowCount) {
      const subRow = worksheet.getRow(subR);
      const subC1 = String(subRow.getCell(colNombres).value || '').trim();
      const subC2 = String(subRow.getCell(colRun).value || '').trim();
      const subContrato = extraerHorasCelda(subRow.getCell(colContrato).value);
      const subRut = normalizarRut(subC2);

      if (subRut && subRut.length >= 7) break;
      if (subContrato > 0 && !subC1.toLowerCase().startsWith('total')) break;
      if (esFilaResumenOTotal(subC1)) {
        subR++;
        break;
      }

      const subC1Low = subC1.toLowerCase();

      if (subC1Low.includes('recreo')) {
        const hRecreo = colTotalHcSubGral !== -1 ? extraerHorasCelda(subRow.getCell(colTotalHcSubGral).value) :
          extraerHorasCelda(subRow.getCell(colTotalHa).value);
        if (subC1Low.includes('60/40')) {
          docenteItem.recreos6040 = hRecreo;
        } else {
          docenteItem.recreos6535 = hRecreo;
        }
      } else if (subC1Low.includes('no lectiva') || subC1Low.includes('no lectivo')) {
        const hNoLectiva = colTotalHcSubGral !== -1 ? extraerHorasCelda(subRow.getCell(colTotalHcSubGral).value) :
          extraerHorasCelda(subRow.getCell(colTotalHa).value);
        if (subC1Low.includes('60/40')) {
          docenteItem.horasNoLectivas6040 = hNoLectiva;
        } else {
          docenteItem.horasNoLectivas6535 = hNoLectiva;
        }
      } else if (subC1 !== '') {
        const asignaturaNombre = subC1;
        for (const cursoCol of cursosDetectados) {
          const hAula = extraerHorasCelda(subRow.getCell(cursoCol.colIndex).value);
          if (hAula > 0) {
            docenteItem.asignaciones.push({
              docenteRun: docenteItem.run,
              docenteNombre: `${docenteItem.nombres} ${docenteItem.apellidos}`,
              asignatura: asignaturaNombre,
              nivelCurso: cursoCol.nivel,
              letraCurso: cursoCol.letra,
              horasPedagogicasAula: hAula,
              esTallerJec: asignaturaNombre.toLowerCase().includes('taller') || asignaturaNombre.toLowerCase().includes('jec')
            });
          }
        }
      }

      subR++;
    }

    docentes.push(docenteItem);
    r = subR;
  }

  let totalAsignaciones = 0;
  let totalHorasAulaAsignadas = 0;
  let totalHorasContrato = 0;

  for (const d of docentes) {
    totalHorasContrato += d.horasContrato;
    totalAsignaciones += d.asignaciones.length;
    for (const a of d.asignaciones) {
      totalHorasAulaAsignadas += a.horasPedagogicasAula;
    }
  }

  if (cursosDetectados.length === 0) {
    alertas.push('No se detectaron columnas de cursos específicas (se procesaron docentes en formato plano).');
  }

  return {
    archivoNombre: fileName,
    hojaSeleccionada: worksheet.name,
    rbdDetectado,
    nombreEstablecimientoDetectado,
    comunaDetectada,
    periodoDetectado,
    cursos: cursosDetectados,
    docentes,
    totalAsignaciones,
    totalHorasContrato,
    totalHorasAulaAsignadas: Math.round(totalHorasAulaAsignadas * 100) / 100,
    alertas
  };
}
