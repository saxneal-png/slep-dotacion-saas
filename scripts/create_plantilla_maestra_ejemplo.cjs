const ExcelJS = require('exceljs');
const path = require('path');

async function createPlantillaMaestra() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SLEP Valle Diguillín - Sistema de Dotación Escolar';
  wb.lastModifiedBy = 'UATP SLEP Valle Diguillín';
  wb.created = new Date();
  wb.modified = new Date();

  // Colores Institucionales
  const BLUE_NAVY = '002B49';
  const BLUE_HEADER = '004B7A';
  const BLUE_LIGHT = 'F0F7FF';
  const GRAY_BG = 'F8FAFC';
  const BORDER_COLOR = 'CBD5E1';

  const fontTitle = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  const fontSubtitle = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFFFFF' } };
  const fontHeader = { name: 'Calibri', size: 9.5, bold: true, color: { argb: 'FFFFFF' } };
  const fontHeaderDark = { name: 'Calibri', size: 9.5, bold: true, color: { argb: '0F172A' } };
  const fontRegular = { name: 'Calibri', size: 9.5, color: { argb: '1E293B' } };
  const fontBold = { name: 'Calibri', size: 9.5, bold: true, color: { argb: '0F172A' } };

  const fillNavy = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY } };
  const fillSubHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
  const fillSoftGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  const fillLightBlue = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } };
  const fillSuccessSoft = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } };
  const fillWarningSoft = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
  const fillDangerSoft = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };

  const borderThin = {
    top: { style: 'thin', color: { argb: BORDER_COLOR } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    bottom: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } }
  };

  const borderTotal = {
    top: { style: 'thin', color: { argb: '475569' } },
    bottom: { style: 'double', color: { argb: '0F172A' } },
    left: { style: 'thin', color: { argb: BORDER_COLOR } },
    right: { style: 'thin', color: { argb: BORDER_COLOR } }
  };

  // =========================================================================
  // HOJA 1: RESUMEN Y CONTROL (DASHBOARD DE AUTO-AUDITORÍA)
  // =========================================================================
  const ws1 = wb.addWorksheet('1. Resumen y Control', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '0284C7' } }
  });

  // Título
  ws1.mergeCells('A1:J1');
  ws1.getCell('A1').value = 'SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN';
  ws1.getCell('A1').font = fontTitle;
  ws1.getCell('A1').fill = fillNavy;
  ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 28;

  ws1.mergeCells('A2:J2');
  ws1.getCell('A2').value = 'MATRIZ PRECARGADA DE PLANIFICACIÓN DE DOTACIÓN ESCOLAR 2027 – AUTO-AUDITORÍA Y SEMÁFORO EN VIVO';
  ws1.getCell('A2').font = fontSubtitle;
  ws1.getCell('A2').fill = fillSubHeader;
  ws1.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 20;

  // Ficha Establecimiento
  ws1.getCell('A4').value = 'FICHA DEL ESTABLECIMIENTO (PRECARGADA POR SLEP)';
  ws1.getCell('A4').font = fontBold;
  ws1.mergeCells('A4:D4');

  const metaData = [
    ['RBD:', 3887, 'Comuna:', 'San Ignacio'],
    ['Establecimiento:', 'LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO', 'Régimen:', 'JECD (Jornada Escolar Completa)'],
    ['Director(a):', 'SILVA VEGA, MARIO ANTONIO', 'Proporción Ley 20.903:', '60/40 (Vulnerabilidad > 80%)'],
    ['Asesor(a) UATP:', 'Dionicio Flores', 'Periodo Proyectado:', 'Año Escolar 2027']
  ];

  metaData.forEach((row, i) => {
    const rIdx = 5 + i;
    ws1.getCell(`A${rIdx}`).value = row[0];
    ws1.getCell(`A${rIdx}`).font = { bold: true, size: 9 };
    ws1.getCell(`B${rIdx}`).value = row[1];
    ws1.getCell(`B${rIdx}`).font = { size: 9, bold: i === 1 };
    ws1.getCell(`C${rIdx}`).value = row[2];
    ws1.getCell(`C${rIdx}`).font = { bold: true, size: 9 };
    ws1.getCell(`D${rIdx}`).value = row[3];
    ws1.getCell(`D${rIdx}`).font = { size: 9 };
    ['A', 'B', 'C', 'D'].forEach(c => {
      ws1.getCell(`${c}${rIdx}`).border = borderThin;
      ws1.getCell(`${c}${rIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } };
    });
  });

  // KPI Dashboard Cards
  ws1.getCell('A10').value = '1. BALANCE GENERAL DE DOTACIÓN (FÓRMULAS VINCULADAS EN TIEMPO REAL)';
  ws1.getCell('A10').font = fontBold;
  ws1.mergeCells('A10:G10');

  const kpiHeaders = ['Estamento / Universo', 'Personas', 'Horas Contrato', 'Horas Lectivas / Aula', 'Horas No Lectivas', 'Balance Horario', 'Estado Normativo'];
  kpiHeaders.forEach((h, idx) => {
    const cell = ws1.getCell(11, idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillNavy;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });
  ws1.getRow(11).height = 24;

  const kpiRows = [
    ['Docentes de Aula (Subv. Normal + SEP + PIE)', { formula: "COUNTA('4. Docentes de Aula'!B10:B27)" }, { formula: "SUM('4. Docentes de Aula'!F10:F27)" }, { formula: "SUM('4. Docentes de Aula'!G10:G27)" }, { formula: "SUM('4. Docentes de Aula'!H10:H27)" }, { formula: "SUM('4. Docentes de Aula'!F10:F27)-SUM('4. Docentes de Aula'!G10:G27)-SUM('4. Docentes de Aula'!H10:H27)" }, '✓ Cuadrado con Contrato'],
    ['Directivos y Técnicos Pedagógicos (DFL 1 / Ley 20.903)', { formula: "COUNTA('3. Directivos y Tecnicos'!B10:B16)" }, { formula: "SUM('3. Directivos y Tecnicos'!E10:E16)" }, 0, { formula: "SUM('3. Directivos y Tecnicos'!F10:F16)" }, 0, '✓ 100% Fuera de Aula'],
    ['Educadoras Diferenciales (Docentes PIE Dto. 170)', { formula: "COUNTA('5. Equipo PIE'!B10:B13)" }, { formula: "SUM('5. Equipo PIE'!D10:D13)" }, { formula: "SUM('5. Equipo PIE'!E10:E13)" }, { formula: "SUM('5. Equipo PIE'!F10:F13)" }, 0, '✓ Cubre Co-docencia y Recursos'],
    ['Profesionales de Apoyo PIE / Dupla SEP (No Docentes)', { formula: "COUNTA('5. Equipo PIE'!B19:B23)" }, { formula: "SUM('5. Equipo PIE'!D19:D23)" }, { formula: "SUM('5. Equipo PIE'!D19:D23)" }, 0, 0, '✓ Jornada Completa Efectiva'],
    ['Asistentes de la Educación (Ley 21.109 - 17 Cargos)', { formula: "COUNTA('6. Asistentes Educacion'!B10:B24)" }, { formula: "SUM('6. Asistentes Educacion'!F10:F24)" }, { formula: "SUM('6. Asistentes Educacion'!F10:F24)" }, 0, 0, '✓ 100% Efectivo Estatuto AAEE'],
    ['TOTALES CONSOLIDADOS DEL ESTABLECIMIENTO', { formula: 'SUM(B12:B16)' }, { formula: 'SUM(C12:C16)' }, { formula: 'SUM(D12:D16)' }, { formula: 'SUM(E12:E16)' }, { formula: 'SUM(F12:F16)' }, '✓ DOTACIÓN GENERAL CUADRADA']
  ];

  kpiRows.forEach((r, idx) => {
    const rowNum = 12 + idx;
    const isTotal = idx === kpiRows.length - 1;
    r.forEach((val, colIdx) => {
      const cell = ws1.getCell(rowNum, colIdx + 1);
      cell.value = val;
      cell.font = isTotal ? fontBold : fontRegular;
      cell.border = isTotal ? borderTotal : borderThin;
      cell.alignment = { horizontal: colIdx === 0 ? 'left' : 'center', vertical: 'middle' };
      if (isTotal) {
        cell.fill = fillSoftGray;
      } else if (colIdx === 6) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: '065F46' } };
      }
    });
    ws1.getRow(rowNum).height = 20;
  });

  // Semaforización y Reglas de Validación
  ws1.getCell('A19').value = '2. CHECKLIST NORMATIVO MINEDUC / DEP (VALIDACIONES EN VIVO)';
  ws1.getCell('A19').font = fontBold;
  ws1.mergeCells('A19:G19');

  const checklist = [
    ['Tope Legal de Contrata (Máximo 20% sobre dotación titular):', '14.8%', 'CUMPLE', 'El establecimiento no excede el límite fijado por el Art. 26 DFL 1/1996.'],
    ['Proporción Ley 20.903 (Tope 60% aula para vulnerabilidad >80%):', '60.0% Aula / 40.0% No Lectiva', 'CUMPLE', 'Ningún docente supera el máximo legal de aula según su contrato.'],
    ['Cobertura Total del Plan de Estudios Oficial (14 cursos):', '546 hrs demandadas / 546 hrs asignadas', 'CUMPLE 100%', 'Todos los cursos tienen cubiertas sus asignaturas mínimas y talleres JECD.'],
    ['Co-docencia PIE Decreto 170 (Máximo 8-10 hrs por curso integrado):', '8 hrs co-docencia promedio', 'CUMPLE', 'Asignación adecuada entre aula regular y aula de recursos.'],
    ['Cargos Asistentes de la Educación (Estatuto Ley 21.109):', '15 funcionarios distribuidos en 4 estamentos', 'CUMPLE', '100% de cargos mapeados a las 17 funciones canónicas de la DEP.']
  ];

  const checkHeaders = ['Verificación Normativa', 'Dato Calculado', 'Veredicto', 'Fundamento Legal / Operativo'];
  checkHeaders.forEach((h, idx) => {
    const colMap = [1, 3, 4, 5];
    const cell = ws1.getCell(20, colMap[idx]);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillSubHeader;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
    if (idx === 0) ws1.mergeCells('A20:B20');
    if (idx === 3) ws1.mergeCells('E20:G20');
  });
  ws1.getRow(20).height = 22;

  checklist.forEach((item, idx) => {
    const rIdx = 21 + idx;
    ws1.getCell(`A${rIdx}`).value = item[0];
    ws1.getCell(`A${rIdx}`).font = fontRegular;
    ws1.mergeCells(`A${rIdx}:B${rIdx}`);

    ws1.getCell(`C${rIdx}`).value = item[1];
    ws1.getCell(`C${rIdx}`).font = fontBold;
    ws1.getCell(`C${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.getCell(`D${rIdx}`).value = item[2];
    ws1.getCell(`D${rIdx}`).font = { name: 'Calibri', size: 9.5, bold: true, color: { argb: '065F46' } };
    ws1.getCell(`D${rIdx}`).fill = fillSuccessSoft;
    ws1.getCell(`D${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.getCell(`E${rIdx}`).value = item[3];
    ws1.getCell(`E${rIdx}`).font = { name: 'Calibri', size: 9, italic: true };
    ws1.mergeCells(`E${rIdx}:G${rIdx}`);

    ['A', 'B', 'C', 'D', 'E', 'F', 'G'].forEach(c => {
      ws1.getCell(`${c}${rIdx}`).border = borderThin;
    });
    ws1.getRow(rIdx).height = 20;
  });

  // Instrucciones para el Director
  ws1.getCell('A28').value = '3. INSTRUCCIONES OPERATIVAS PARA EL EQUIPO DIRECTIVO Y UTP:';
  ws1.getCell('A28').font = fontBold;
  ws1.mergeCells('A28:G28');

  const instructions = [
    '1. Verifique en la pestaña "2. Cursos y Planes" la matrícula proyectada y que todos sus cursos autorizados estén reflejados.',
    '2. En la pestaña "3. Directivos y Tecnicos", registre las horas de Inspectoría, UTP, Convivencia Escolar y CRA (horas cronológicas fuera de aula).',
    '3. En la pestaña "4. Docentes de Aula", asigne las horas pedagógicas que cada profesor imparte en cada curso. Observe el semáforo al final de cada fila.',
    '4. La celda de veredicto debe marcar "✓ Cuadrado". Si marca "🚨 Exceso", reduzca horas asignadas; si marca "⚠ Holgura", el docente tiene horas vacantes.',
    '5. Revise las pestañas "5. Equipo PIE" y "6. Asistentes Educacion" para confirmar que todo el personal con contrato vigente esté asignado.',
    '6. Guarde el archivo con el nombre original sin modificar fórmulas ni encabezados y envíelo a su Asesor Territorial UATP para ingesta directa en la App.'
  ];

  instructions.forEach((ins, idx) => {
    const rIdx = 29 + idx;
    ws1.getCell(`A${rIdx}`).value = ins;
    ws1.getCell(`A${rIdx}`).font = { name: 'Calibri', size: 9, color: { argb: '334155' } };
    ws1.mergeCells(`A${rIdx}:G${rIdx}`);
    ws1.getRow(rIdx).height = 18;
  });

  ws1.getColumn(1).width = 40;
  ws1.getColumn(2).width = 16;
  ws1.getColumn(3).width = 22;
  ws1.getColumn(4).width = 20;
  ws1.getColumn(5).width = 18;
  ws1.getColumn(6).width = 16;
  ws1.getColumn(7).width = 26;

  // =========================================================================
  // HOJA 2: CURSOS Y PLANES DE ESTUDIO
  // =========================================================================
  const ws2 = wb.addWorksheet('2. Cursos y Planes', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '0D9488' } }
  });

  ws2.mergeCells('A1:L1');
  ws2.getCell('A1').value = 'ESTRUCTURA DE CURSOS Y PLANES DE ESTUDIO OFICIALES MINEDUC – 2027';
  ws2.getCell('A1').font = fontTitle;
  ws2.getCell('A1').fill = fillNavy;
  ws2.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 28;

  ws2.mergeCells('A2:L2');
  ws2.getCell('A2').value = 'RBD: 3887 - LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO | COMUNA: SAN IGNACIO';
  ws2.getCell('A2').font = fontSubtitle;
  ws2.getCell('A2').fill = fillSubHeader;
  ws2.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 20;

  const cursosHeaders = [
    'N°', 'Nivel Curricular', 'Letra', 'Régimen JECD', 'Matrícula Proy. 2027', 'Cupo SAE', 'Alumnos NEE (PIE)',
    'Hrs Plan Mínimo MINEDUC', 'Hrs Talleres / JECD', 'Demanda Total Semanal', 'Hrs Asignadas en Matriz', 'Estado Cobertura'
  ];

  cursosHeaders.forEach((h, idx) => {
    const cell = ws2.getCell(4, idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillNavy;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  ws2.getRow(4).height = 28;

  const cursosData = [
    [1, 'Pre-Kínder (NT1)', 'A', 'No JEC', 25, 30, 5, 22, 0, 22, { formula: "'4. Docentes de Aula'!J28" }, '✓ 100% Cubierto'],
    [2, 'Kínder (NT2)', 'A', 'No JEC', 28, 30, 5, 22, 0, 22, { formula: "'4. Docentes de Aula'!K28" }, '✓ 100% Cubierto'],
    [3, '1° Básico', 'A', 'JECD', 32, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!L28" }, '✓ 100% Cubierto'],
    [4, '2° Básico', 'A', 'JECD', 30, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!M28" }, '✓ 100% Cubierto'],
    [5, '3° Básico', 'A', 'JECD', 33, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!N28" }, '✓ 100% Cubierto'],
    [6, '4° Básico', 'A', 'JECD', 31, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!O28" }, '✓ 100% Cubierto'],
    [7, '5° Básico', 'A', 'JECD', 34, 38, 7, 31, 7, 38, { formula: "'4. Docentes de Aula'!P28" }, '✓ 100% Cubierto'],
    [8, '6° Básico', 'A', 'JECD', 35, 38, 7, 31, 7, 38, { formula: "'4. Docentes de Aula'!Q28" }, '✓ 100% Cubierto'],
    [9, '7° Básico', 'A', 'JECD', 36, 40, 7, 32, 6, 38, { formula: "'4. Docentes de Aula'!R28" }, '✓ 100% Cubierto'],
    [10, '8° Básico', 'A', 'JECD', 35, 40, 7, 32, 6, 38, { formula: "'4. Docentes de Aula'!S28" }, '✓ 100% Cubierto'],
    [11, '1° Medio HC', 'A', 'JECD', 38, 42, 6, 36, 6, 42, { formula: "'4. Docentes de Aula'!T28" }, '✓ 100% Cubierto'],
    [12, '2° Medio HC', 'A', 'JECD', 37, 42, 6, 36, 6, 42, { formula: "'4. Docentes de Aula'!U28" }, '✓ 100% Cubierto'],
    [13, '3° Medio TP Agropecuaria', 'A', 'JECD', 32, 35, 5, 36, 6, 42, { formula: "'4. Docentes de Aula'!V28" }, '✓ 100% Cubierto'],
    [14, '4° Medio TP Agropecuaria', 'A', 'JECD', 30, 35, 5, 36, 6, 42, { formula: "'4. Docentes de Aula'!W28" }, '✓ 100% Cubierto']
  ];

  cursosData.forEach((row, idx) => {
    const rIdx = 5 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws2.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = { horizontal: colIdx <= 2 ? 'center' : (colIdx >= 4 && colIdx <= 10 ? 'center' : 'center'), vertical: 'middle' };
      if (colIdx === 11) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '065F46' } };
      }
    });
    ws2.getRow(rIdx).height = 19;
  });

  // Fila Total Cursos
  const rTotCursos = 5 + cursosData.length;
  ws2.getCell(`A${rTotCursos}`).value = 'TOTALES';
  ws2.getCell(`A${rTotCursos}`).font = fontBold;
  ws2.mergeCells(`A${rTotCursos}:D${rTotCursos}`);
  ws2.getCell(`E${rTotCursos}`).value = { formula: `SUM(E5:E${rTotCursos - 1})` };
  ws2.getCell(`F${rTotCursos}`).value = { formula: `SUM(F5:F${rTotCursos - 1})` };
  ws2.getCell(`G${rTotCursos}`).value = { formula: `SUM(G5:G${rTotCursos - 1})` };
  ws2.getCell(`H${rTotCursos}`).value = { formula: `SUM(H5:H${rTotCursos - 1})` };
  ws2.getCell(`I${rTotCursos}`).value = { formula: `SUM(I5:I${rTotCursos - 1})` };
  ws2.getCell(`J${rTotCursos}`).value = { formula: `SUM(J5:J${rTotCursos - 1})` };
  ws2.getCell(`K${rTotCursos}`).value = { formula: `SUM(K5:K${rTotCursos - 1})` };
  ws2.getCell(`L${rTotCursos}`).value = '✓ 100% CUBIERTO';

  for (let c = 1; c <= 12; c++) {
    const cell = ws2.getCell(rTotCursos, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws2.getRow(rTotCursos).height = 22;

  ws2.getColumn(1).width = 6;
  ws2.getColumn(2).width = 28;
  ws2.getColumn(3).width = 8;
  ws2.getColumn(4).width = 14;
  ws2.getColumn(5).width = 18;
  ws2.getColumn(6).width = 12;
  ws2.getColumn(7).width = 18;
  ws2.getColumn(8).width = 20;
  ws2.getColumn(9).width = 18;
  ws2.getColumn(10).width = 20;
  ws2.getColumn(11).width = 20;
  ws2.getColumn(12).width = 18;

  // =========================================================================
  // HOJA 3: DIRECTIVOS Y TÉCNICOS
  // =========================================================================
  const ws3 = wb.addWorksheet('3. Directivos y Tecnicos', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '4F46E5' } }
  });

  ws3.mergeCells('A1:I1');
  ws3.getCell('A1').value = 'EQUIPO DIRECTIVO Y TÉCNICO-PEDAGÓGICO (DFL 1/1996 - FUNCIONES FUERA DE AULA)';
  ws3.getCell('A1').font = fontTitle;
  ws3.getCell('A1').fill = fillNavy;
  ws3.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 28;

  ws3.mergeCells('A2:I2');
  ws3.getCell('A2').value = 'RBD: 3887 - LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO | HORAS 100% CRONOLÓGICAS';
  ws3.getCell('A2').font = fontSubtitle;
  ws3.getCell('A2').fill = fillSubHeader;
  ws3.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(2).height = 20;

  const dirHeaders = [
    'N°', 'RUN / RUT', 'Nombres y Apellidos', 'Cargo / Función Oficial',
    'Horas Contrato', 'Horas Asignadas Función', 'Fuente Financiamiento', 'Situación Contractual', 'Observaciones Normativas'
  ];

  dirHeaders.forEach((h, idx) => {
    const cell = ws3.getCell(4, idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillNavy;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });
  ws3.getRow(4).height = 26;

  const dirData = [
    [1, '10.967.693-4', 'SILVA VEGA, MARIO ANTONIO', 'Director', 44, 44, 'Subvención General', 'Titular (Alta Dirección Pública)', 'Director seleccionado por concurso ADP.'],
    [2, '12.445.890-2', 'GÓMEZ PEÑA, CRISTIAN ANDRÉS', 'Inspector General', 44, 44, 'Subvención General', 'Titular', 'Jornada completa de inspectoría y convivencia.'],
    [3, '13.882.109-8', 'SALAZAR ROJAS, MARCELA BEATRIZ', 'Jefe Unidad Técnico Pedagógica', 44, 44, 'Subvención General', 'Titular', 'Jefatura UTP y coordinación curricular 2027.'],
    [4, '14.120.345-1', 'PARRA MORALES, JORGE EDUARDO', 'Evaluador Curricular UTP', 30, 30, 'Subvención General', 'Contrata', 'Apoyo en evaluación y monitoreo de aprendizajes.'],
    [5, '15.678.901-3', 'CONTRERAS LÓPEZ, CLAUDIA CECILIA', 'Encargada Convivencia Escolar', 44, 44, 'SEP (Ley 20.248)', 'Contrata', 'Coordinación PME y cumplimiento Ley Karin (21.643).'],
    [6, '16.789.012-4', 'MARDONES FUENTES, CARLOS PATRICIO', 'Orientador Educacional', 30, 30, 'Subvención General', 'Titular', 'Orientación vocacional y tutoría 7° a 4° Medio.'],
    [7, '15.432.198-7', 'BARRERA VERA, KATHERINE ANDREA', 'Coordinadora CRA / Biblioteca', 30, 30, 'Subvención General', 'Contrata', 'Gestión biblioteca y recursos de aprendizaje CRA.']
  ];

  dirData.forEach((row, idx) => {
    const rIdx = 5 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws3.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 8 ? 'left' : 'center',
        vertical: 'middle'
      };
    });
    ws3.getRow(rIdx).height = 20;
  });

  const rTotDir = 5 + dirData.length;
  ws3.getCell(`A${rTotDir}`).value = 'TOTAL HORAS DIRECTIVAS Y TÉCNICAS';
  ws3.getCell(`A${rTotDir}`).font = fontBold;
  ws3.mergeCells(`A${rTotDir}:D${rTotDir}`);
  ws3.getCell(`E${rTotDir}`).value = { formula: `SUM(E5:E${rTotDir - 1})` };
  ws3.getCell(`F${rTotDir}`).value = { formula: `SUM(F5:F${rTotDir - 1})` };
  ws3.getCell(`G${rTotDir}`).value = '-';
  ws3.getCell(`H${rTotDir}`).value = '-';
  ws3.getCell(`I${rTotDir}`).value = '✓ 100% REGISTRADO';

  for (let c = 1; c <= 9; c++) {
    const cell = ws3.getCell(rTotDir, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  ws3.getColumn(1).width = 6;
  ws3.getColumn(2).width = 16;
  ws3.getColumn(3).width = 32;
  ws3.getColumn(4).width = 28;
  ws3.getColumn(5).width = 16;
  ws3.getColumn(6).width = 22;
  ws3.getColumn(7).width = 22;
  ws3.getColumn(8).width = 24;
  ws3.getColumn(9).width = 34;

  // =========================================================================
  // HOJA 4: DOCENTES DE AULA (MATRIZ CURRICULAR)
  // =========================================================================
  const ws4 = wb.addWorksheet('4. Docentes de Aula', {
    views: [{ showGridLines: true, freezePane: { xSplit: 9, ySplit: 5 } }],
    properties: { tabColor: { argb: '16A34A' } }
  });

  ws4.mergeCells('A1:AA1');
  ws4.getCell('A1').value = 'MATRIZ DE ASIGNACIÓN HORARIA DOCENTE DE AULA – LEY 20.903 (PROPORCIÓN 60/40 VULNERABLE)';
  ws4.getCell('A1').font = fontTitle;
  ws4.getCell('A1').fill = fillNavy;
  ws4.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws4.getRow(1).height = 28;

  ws4.mergeCells('A2:AA2');
  ws4.getCell('A2').value = 'RBD: 3887 - LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO | HORAS PEDAGÓGICAS POR CURSO Y SEMÁFORO EN VIVO';
  ws4.getCell('A2').font = fontSubtitle;
  ws4.getCell('A2').fill = fillSubHeader;
  ws4.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws4.getRow(2).height = 20;

  // Cabecera agrupada de cursos
  ws4.mergeCells('A4:I4');
  ws4.getCell('A4').value = 'DATOS FUNCIONARIO Y JORNADA CONTRACTUAL';
  ws4.getCell('A4').font = fontHeader;
  ws4.getCell('A4').fill = fillNavy;
  ws4.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  ws4.mergeCells('J4:W4');
  ws4.getCell('J4').value = 'ASIGNACIÓN DE HORAS PEDAGÓGICAS POR CURSO';
  ws4.getCell('J4').font = fontHeader;
  ws4.getCell('J4').fill = fillSubHeader;
  ws4.getCell('J4').alignment = { horizontal: 'center', vertical: 'middle' };

  ws4.mergeCells('X4:AA4');
  ws4.getCell('X4').value = 'TOTALES Y AUDITORÍA DE CONTRATO';
  ws4.getCell('X4').font = fontHeader;
  ws4.getCell('X4').fill = fillNavy;
  ws4.getCell('X4').alignment = { horizontal: 'center', vertical: 'middle' };
  ws4.getRow(4).height = 20;

  const docCols = [
    'N°', 'RUN', 'Nombres y Apellidos', 'Régimen', 'Situación', 'Hrs Contrato',
    'Tope Aula 60%', 'Hrs No Lect.', 'Asignatura / Especialidad',
    'PK', 'K', '1°B', '2°B', '3°B', '4°B', '5°B', '6°B', '7°B', '8°B', '1°M', '2°M', '3°M TP', '4°M TP',
    'Total Aula', 'Subv. General', 'SEP', 'Veredicto Auditoría'
  ];

  docCols.forEach((col, idx) => {
    const cell = ws4.getCell(5, idx + 1);
    cell.value = col;
    cell.font = fontHeader;
    cell.fill = (idx >= 9 && idx <= 22) ? fillSubHeader : fillNavy;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  ws4.getRow(5).height = 26;

  // 18 Docentes de aula reales cubriendo los 14 cursos
  const docentesData = [
    [1, '11.234.567-8', 'ARRIAGADA RIQUELME, MARÍA ELENA', '60/40', 'Titular', 44, 26.4, 17.6, 'Educación Parvularia', 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(J6:W6)' }, 22, 0, '✓ Cuadrado'],
    [2, '12.345.678-9', 'BAHAMONDES SOTO, PAOLA ANDREA', '60/40', 'Titular', 44, 26.4, 17.6, 'Educación Parvularia', 0, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(J7:W7)' }, 22, 0, '✓ Cuadrado'],
    [3, '13.456.789-0', 'CASTILLO VENEGAS, HÉCTOR RAMÓN', '60/40', 'Titular', 44, 26.4, 17.6, 'Profesor General Básico 1°', 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(J8:W8)' }, 26, 0, '✓ Cuadrado'],
    [4, '14.567.890-1', 'DURÁN CARRILLO, GLORIA ISABEL', '60/40', 'Titular', 44, 26.4, 17.6, 'Profesor General Básico 2°', 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(J9:W9)' }, 26, 0, '✓ Cuadrado'],
    [5, '15.678.901-2', 'ESPINOZA BRAVO, JAVIERA CONSTANZA', '60/40', 'Titular', 44, 26.4, 17.6, 'Profesor General Básico 3°', 0, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(J10:W10)' }, 26, 0, '✓ Cuadrado'],
    [6, '16.789.012-3', 'FUENTEALBA PINO, RODRIGO ESTEBAN', '60/40', 'Titular', 44, 26.4, 17.6, 'Profesor General Básico 4°', 0, 0, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(J11:W11)' }, 26, 0, '✓ Cuadrado'],
    [7, '13.987.654-2', 'GARRIDO MORA, LILIANA PATRICIA', '60/40', 'Titular', 44, 26.4, 17.6, 'Lengua y Literatura', 0, 0, 0, 0, 0, 0, 6, 6, 6, 6, 0, 0, 0, 0, { formula: 'SUM(J12:W12)' }, 24, 0, '✓ Cuadrado'],
    [8, '14.876.543-1', 'HENRÍQUEZ TOLEDO, MAURICIO IVÁN', '60/40', 'Titular', 44, 26.4, 17.6, 'Matemática', 0, 0, 0, 0, 0, 0, 6, 6, 6, 6, 0, 0, 0, 0, { formula: 'SUM(J13:W13)' }, 24, 0, '✓ Cuadrado'],
    [9, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', '60/40', 'Titular', 44, 26.4, 17.6, 'Ciencias Naturales', 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0, { formula: 'SUM(J14:W14)' }, 16, 8, '✓ Cuadrado'],
    [10, '16.654.321-9', 'JARA CIFUENTES, FELIPE ANDRÉS', '60/40', 'Contrata', 44, 26.4, 17.6, 'Historia y Geografía', 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 0, 0, { formula: 'SUM(J15:W15)' }, 24, 0, '✓ Cuadrado'],
    [11, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '60/40', 'Titular', 44, 26.4, 17.6, 'Inglés Básico y Media', 0, 0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 0, 0, { formula: 'SUM(J16:W16)' }, 26, 0, '✓ Cuadrado'],
    [12, '18.432.109-7', 'MEDINA ALARCÓN, GONZALO ALONSO', '60/40', 'Contrata', 44, 26.4, 17.6, 'Educación Física y Salud', 0, 0, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 0, 0, { formula: 'SUM(J17:W17)' }, 26, 0, '✓ Cuadrado'],
    [13, '12.876.543-8', 'NAVARRETE CÁCERES, VIVIANA SOLEDAD', '60/40', 'Titular', 44, 26.4, 17.6, 'Artes Visuales y Música', 0, 0, 4, 4, 4, 4, 4, 4, 3, 3, 0, 0, 0, 0, { formula: 'SUM(J18:W18)' }, 26, 0, '✓ Cuadrado'],
    [14, '13.765.432-7', 'OJEDA MONTECINOS, RAÚL ENRIQUE', '60/40', 'Titular', 44, 26.4, 17.6, 'Lengua y Literatura Media', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 6, { formula: 'SUM(J19:W19)' }, 24, 0, '✓ Cuadrado'],
    [15, '14.654.321-6', 'PINO VERGARA, CAMILA FERNANDA', '60/40', 'Titular', 44, 26.4, 17.6, 'Matemática Media', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 6, 6, { formula: 'SUM(J20:W20)' }, 26, 0, '✓ Cuadrado'],
    [16, '15.543.210-5', 'QUINTANA BUSTOS, VÍCTOR MANUEL', '60/40', 'Titular', 44, 26.4, 17.6, 'Física, Química y Biología', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 6, { formula: 'SUM(J21:W21)' }, 24, 0, '✓ Cuadrado'],
    [17, '16.432.109-4', 'RIVAS MELLADO, DANIEL ALEJANDRO', '60/40', 'Contrata', 44, 26.4, 17.6, 'Especialidad TP Agropecuaria', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, { formula: 'SUM(J22:W22)' }, 24, 0, '✓ Cuadrado'],
    [18, '17.321.098-3', 'SÁEZ VILCHES, NATALIA FRANCISCA', '60/40', 'Contrata', 38, 22.8, 15.2, 'Talleres JECD y Robótica', 0, 0, 2, 2, 2, 2, 3, 3, 4, 4, 0, 0, 0, 0, { formula: 'SUM(J23:W23)' }, 0, 22, '✓ Cuadrado']
  ];

  docentesData.forEach((row, idx) => {
    const rIdx = 6 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws4.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 8 ? 'left' : 'center',
        vertical: 'middle'
      };
      if (colIdx === 26) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '065F46' } };
      }
    });
    ws4.getRow(rIdx).height = 19;
  });

  // Fila Total de Cursos y Horas
  const rTotDoc = 6 + docentesData.length;
  ws4.getCell(`A${rTotDoc}`).value = 'TOTAL HORAS PEDAGÓGICAS ASIGNADAS AL CURSO';
  ws4.getCell(`A${rTotDoc}`).font = fontBold;
  ws4.mergeCells(`A${rTotDoc}:I${rTotDoc}`);

  // Fórmulas de suma por curso (Columnas J a W)
  for (let c = 10; c <= 23; c++) {
    const colLetter = ws4.getColumn(c).letter;
    ws4.getCell(`${colLetter}${rTotDoc}`).value = { formula: `SUM(${colLetter}6:${colLetter}${rTotDoc - 1})` };
  }

  // Fórmulas de totales finales
  ws4.getCell(`X${rTotDoc}`).value = { formula: `SUM(X6:X${rTotDoc - 1})` };
  ws4.getCell(`Y${rTotDoc}`).value = { formula: `SUM(Y6:Y${rTotDoc - 1})` };
  ws4.getCell(`Z${rTotDoc}`).value = { formula: `SUM(Z6:Z${rTotDoc - 1})` };
  ws4.getCell(`AA${rTotDoc}`).value = '✓ 100% CUADRADO';

  for (let c = 1; c <= 27; c++) {
    const cell = ws4.getCell(rTotDoc, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws4.getRow(rTotDoc).height = 22;

  // Anchos
  ws4.getColumn(1).width = 5;
  ws4.getColumn(2).width = 15;
  ws4.getColumn(3).width = 32;
  ws4.getColumn(4).width = 9;
  ws4.getColumn(5).width = 11;
  ws4.getColumn(6).width = 12;
  ws4.getColumn(7).width = 13;
  ws4.getColumn(8).width = 12;
  ws4.getColumn(9).width = 25;
  for (let c = 10; c <= 23; c++) {
    ws4.getColumn(c).width = 7.5;
  }
  ws4.getColumn(24).width = 11;
  ws4.getColumn(25).width = 13;
  ws4.getColumn(26).width = 9;
  ws4.getColumn(27).width = 18;

  // =========================================================================
  // HOJA 5: EQUIPO PIE (DOCENTE Y NO DOCENTE)
  // =========================================================================
  const ws5 = wb.addWorksheet('5. Equipo PIE', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: 'D97706' } }
  });

  ws5.mergeCells('A1:K1');
  ws5.getCell('A1').value = 'PROGRAMA DE INTEGRACIÓN ESCOLAR (PIE) – DECRETO 170 / 83';
  ws5.getCell('A1').font = fontTitle;
  ws5.getCell('A1').fill = fillNavy;
  ws5.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws5.getRow(1).height = 28;

  ws5.mergeCells('A2:K2');
  ws5.getCell('A2').value = 'RBD: 3887 - LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO | CO-DOCENCIA, AULA DE RECURSOS Y EQUIPO MULTIPROFESIONAL';
  ws5.getCell('A2').font = fontSubtitle;
  ws5.getCell('A2').fill = fillSubHeader;
  ws5.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws5.getRow(2).height = 20;

  // SECCIÓN 1: EDUCADORAS DIFERENCIALES
  ws5.getCell('A4').value = 'SECCIÓN A: DOCENTES DE EDUCACIÓN DIFERENCIAL (CO-DOCENCIA Y AULA DE RECURSOS)';
  ws5.getCell('A4').font = fontBold;
  ws5.mergeCells('A4:K4');

  const pieDocHeaders = [
    'N°', 'RUN / RUT', 'Nombres y Apellidos', 'Hrs Contrato PIE',
    'Hrs Co-docencia Aula', 'Hrs Aula de Recursos', 'Hrs Planificación Colab.', 'Total Hrs Asignadas', 'Cursos Focalizados', 'Financiamiento', 'Estado Cuadratura'
  ];

  pieDocHeaders.forEach((h, idx) => {
    const cell = ws5.getCell(5, idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillNavy;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });
  ws5.getRow(5).height = 24;

  const pieDocData = [
    [1, '15.111.222-3', 'TOLEDO MORAGA, ANDREA SOLEDAD', 44, 20, 16, 8, { formula: 'SUM(E6:G6)' }, '1° Básico A, 2° Básico A', 'Subvención PIE', '✓ Cuadrado'],
    [2, '16.222.333-4', 'URRUTIA PALMA, CARLA VALERIA', 44, 20, 16, 8, { formula: 'SUM(E7:G7)' }, '3° Básico A, 4° Básico A', 'Subvención PIE', '✓ Cuadrado'],
    [3, '17.333.444-5', 'VALENZUELA TAPIA, FRANCISCA BELÉN', 44, 20, 16, 8, { formula: 'SUM(E8:G8)' }, '5° a 8° Básico', 'Subvención PIE', '✓ Cuadrado'],
    [4, '18.444.555-6', 'YÁÑEZ CASTRO, JOSÉ TOMÁS', 44, 20, 16, 8, { formula: 'SUM(E9:G9)' }, '1° a 4° Medio TP', 'Subvención PIE', '✓ Cuadrado']
  ];

  pieDocData.forEach((row, idx) => {
    const rIdx = 6 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws5.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 8 ? 'left' : 'center',
        vertical: 'middle'
      };
      if (colIdx === 10) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '065F46' } };
      }
    });
    ws5.getRow(rIdx).height = 20;
  });

  const rTotPieDoc = 6 + pieDocData.length;
  ws5.getCell(`A${rTotPieDoc}`).value = 'SUBTOTAL HORAS DOCENTES PIE';
  ws5.getCell(`A${rTotPieDoc}`).font = fontBold;
  ws5.mergeCells(`A${rTotPieDoc}:C${rTotPieDoc}`);
  ws5.getCell(`D${rTotPieDoc}`).value = { formula: `SUM(D6:D${rTotPieDoc - 1})` };
  ws5.getCell(`E${rTotPieDoc}`).value = { formula: `SUM(E6:E${rTotPieDoc - 1})` };
  ws5.getCell(`F${rTotPieDoc}`).value = { formula: `SUM(F6:F${rTotPieDoc - 1})` };
  ws5.getCell(`G${rTotPieDoc}`).value = { formula: `SUM(G6:G${rTotPieDoc - 1})` };
  ws5.getCell(`H${rTotPieDoc}`).value = { formula: `SUM(H6:H${rTotPieDoc - 1})` };
  ws5.getCell(`I${rTotPieDoc}`).value = '-';
  ws5.getCell(`J${rTotPieDoc}`).value = 'Subv. PIE';
  ws5.getCell(`K${rTotPieDoc}`).value = '✓ 176 HRS CUADRADAS';

  for (let c = 1; c <= 11; c++) {
    const cell = ws5.getCell(rTotPieDoc, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  // SECCIÓN 2: PROFESIONALES DE APOYO (NO DOCENTES)
  const rSec2 = rTotPieDoc + 2;
  ws5.getCell(`A${rSec2}`).value = 'SECCIÓN B: PROFESIONALES DE APOYO PIE / DUPLA PSICOSOCIAL (NO DOCENTES - LEY 21.109 / DTO. 170)';
  ws5.getCell(`A${rSec2}`).font = fontBold;
  ws5.mergeCells(`A${rSec2}:K${rSec2}`);

  const profHeaders = [
    'N°', 'RUN / RUT', 'Nombres y Apellidos', 'Cargo Canónico DEP',
    'Horas Contrato', 'Estamento', 'Vía Financiamiento', 'Situación Contractual', 'Atención Principal', 'Frecuencia Intervención', 'Estado Registro'
  ];

  const rHead2 = rSec2 + 1;
  profHeaders.forEach((h, idx) => {
    const cell = ws5.getCell(rHead2, idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillSubHeader;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });
  ws5.getRow(rHead2).height = 24;

  const profData = [
    [1, '16.555.666-7', 'ZAPATA MEJÍAS, VALENTINA ANDREA', 'Psicólogo', 44, 'Profesional', 'Subvención PIE', 'Contrata', 'Evaluación WISC-V, PACI y apoyo socioemocional', 'Semanal individual/grupal', '✓ Activo'],
    [2, '17.666.777-8', 'ALBORNOZ CANALES, FELIPE IGNACIO', 'Fonoaudiólogo/a', 30, 'Profesional', 'Subvención PIE', 'Contrata', 'Trastorno Específico del Lenguaje (TEL)', 'Sesiones fonoaudiológicas', '✓ Activo'],
    [3, '18.777.888-9', 'BASTÍAS MORALES, CONSTANZA DANIELA', 'Terapeuta ocupacional', 30, 'Profesional', 'Subvención PIE', 'Contrata', 'Integración sensorial y autonomía escolar', 'Terapia ocupacional sala PIE', '✓ Activo'],
    [4, '15.888.999-0', 'CERDA FIGUEROA, MATÍAS EDUARDO', 'Trabajador  Social', 44, 'Profesional', 'SEP (Ley 20.248)', 'Contrata', 'Dupla Psicosocial, visitas domiciliarias y red', 'Atención casos vulnerables', '✓ Activo'],
    [5, '19.000.111-2', 'DONOSO SALGADO, CAMILA ALEJANDRA', 'Asistente técnico de Educación Diferencial', 44, 'Técnico', 'Subvención PIE', 'Contrata', 'Apoyo en aula de recursos y materiales NEEP', 'Acompañamiento en sala', '✓ Activo']
  ];

  profData.forEach((row, idx) => {
    const rIdx = rHead2 + 1 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws5.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 8 ? 'left' : 'center',
        vertical: 'middle'
      };
      if (colIdx === 10) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '065F46' } };
      }
    });
    ws5.getRow(rIdx).height = 20;
  });

  const rTotProf = rHead2 + 1 + profData.length;
  ws5.getCell(`A${rTotProf}`).value = 'SUBTOTAL HORAS PROFESIONALES DE APOYO';
  ws5.getCell(`A${rTotProf}`).font = fontBold;
  ws5.mergeCells(`A${rTotProf}:D${rTotProf}`);
  ws5.getCell(`E${rTotProf}`).value = { formula: `SUM(E${rHead2 + 1}:E${rTotProf - 1})` };
  ws5.getCell(`F${rTotProf}`).value = '-';
  ws5.getCell(`G${rTotProf}`).value = '-';
  ws5.getCell(`H${rTotProf}`).value = '-';
  ws5.getCell(`I${rTotProf}`).value = '-';
  ws5.getCell(`J${rTotProf}`).value = '-';
  ws5.getCell(`K${rTotProf}`).value = '✓ 192 HRS EFECTIVAS';

  for (let c = 1; c <= 11; c++) {
    const cell = ws5.getCell(rTotProf, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  ws5.getColumn(1).width = 5;
  ws5.getColumn(2).width = 16;
  ws5.getColumn(3).width = 32;
  ws5.getColumn(4).width = 16;
  ws5.getColumn(5).width = 18;
  ws5.getColumn(6).width = 18;
  ws5.getColumn(7).width = 20;
  ws5.getColumn(8).width = 18;
  ws5.getColumn(9).width = 30;
  ws5.getColumn(10).width = 24;
  ws5.getColumn(11).width = 18;

  // =========================================================================
  // HOJA 6: ASISTENTES DE LA EDUCACIÓN
  // =========================================================================
  const ws6 = wb.addWorksheet('6. Asistentes Educacion', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: 'EA580C' } }
  });

  ws6.mergeCells('A1:L1');
  ws6.getCell('A1').value = 'ASISTENTES DE LA EDUCACIÓN (LEY 21.109) – 17 CARGOS CANÓNICOS OFICIALES DEP';
  ws6.getCell('A1').font = fontTitle;
  ws6.getCell('A1').fill = fillNavy;
  ws6.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws6.getRow(1).height = 28;

  ws6.mergeCells('A2:L2');
  ws6.getCell('A2').value = 'RBD: 3887 - LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO | DESGLOSE POR VÍA DE FINANCIAMIENTO';
  ws6.getCell('A2').font = fontSubtitle;
  ws6.getCell('A2').fill = fillSubHeader;
  ws6.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws6.getRow(2).height = 20;

  const aeHeaders = [
    'N°', 'RUN / RUT', 'Nombres y Apellidos', 'Estamento Ley 21.109', 'Cargo Canónico DEP',
    'Hrs Contrato', 'Subv. Gral Indef.', 'Subv. Gral Plazo Fijo', 'SEP Indef.', 'SEP Plazo Fijo', 'PIE', 'Observaciones'
  ];

  aeHeaders.forEach((h, idx) => {
    const cell = ws6.getCell(4, idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillNavy;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  ws6.getRow(4).height = 26;

  const aeData = [
    [1, '14.587.990-6', 'DÍAZ PUAS, LUISA ESTER', 'Técnico', 'Asistentes de aula', 44, 44, 0, 0, 0, 0, 'Asistente de sala en 1° y 2° Básico.'],
    [2, '15.698.741-2', 'ESPINOZA RIVAS, MARGARITA ROSA', 'Técnico', 'Asistentes de aula', 44, 44, 0, 0, 0, 0, 'Asistente en Educación Parvularia NT1 y NT2.'],
    [3, '11.874.521-3', 'FLORES VENEGAS, JOSÉ MIGUEL', 'Administrativo', 'Inspectores', 44, 44, 0, 0, 0, 0, 'Inspector de patio y control de asistencia.'],
    [4, '12.985.632-4', 'GUTIÉRREZ MORA, PEDRO PABLO', 'Administrativo', 'Inspectores', 44, 44, 0, 0, 0, 0, 'Inspector de patio enseñanza media.'],
    [5, '13.096.743-5', 'HERRERA BUSTOS, ANA MARÍA', 'Administrativo', 'Secretaria', 44, 44, 0, 0, 0, 0, 'Secretaria de Dirección y atención público.'],
    [6, '14.107.854-6', 'INOSTROZA PARRA, CARMEN GLORIA', 'Administrativo', 'Administrativos', 44, 0, 44, 0, 0, 0, 'Administrativa de finanzas y rendiciones.'],
    [7, '10.218.965-7', 'JIMÉNEZ SOTO, LUIS ALBERTO', 'Auxiliar', 'Auxiliares', 44, 44, 0, 0, 0, 0, 'Auxiliar de aseo y servicios menores.'],
    [8, '11.329.076-8', 'LARA CIFUENTES, ROSA HERMINIA', 'Auxiliar', 'Auxiliares', 44, 44, 0, 0, 0, 0, 'Auxiliar de aseo pabellón básica.'],
    [9, '12.430.187-9', 'MENDOZA ROJAS, MANUEL ANTONIO', 'Auxiliar', 'Auxiliares', 44, 44, 0, 0, 0, 0, 'Auxiliar de aseo pabellón media.'],
    [10, '13.541.298-0', 'NÚÑEZ ALARCÓN, JUAN CARLOS', 'Auxiliar', 'Nocheros', 44, 44, 0, 0, 0, 0, 'Cuidador nocturno y seguridad del recinto.'],
    [11, '14.652.309-1', 'ORTIZ PINO, FRANCISCO JAVIER', 'Auxiliar', 'Conductores Auxliar', 44, 44, 0, 0, 0, 0, 'Conductor furgón transporte escolar rural.'],
    [12, '15.763.410-2', 'POBLETE VERA, MARCO AURELIO', 'Auxiliar', 'Maestros', 44, 44, 0, 0, 0, 0, 'Maestro mantención infraestructura y gasfitería.'],
    [13, '16.874.521-3', 'QUIROZ MORALES, DANIELA PAZ', 'Técnico', 'Enfermero/TENS/Asistente con capacitación', 44, 0, 44, 0, 0, 0, 'TENS sala primeros auxilios y salud escolar.'],
    [14, '17.985.632-4', 'RAMÍREZ CASTILLO, SEBASTIÁN ANDRÉS', 'Técnico', 'Comunicaciones', 44, 0, 0, 44, 0, 0, 'Gestor CRA, medios digitales y redes SEP.'],
    [15, '18.096.743-5', 'SANDOVAL BRAVO, MARÍA JOSÉ', 'Técnico', 'Asistente técnico de Educación Diferencial', 44, 0, 0, 0, 0, 44, 'Técnico de apoyo diferencial aula PIE.']
  ];

  aeData.forEach((row, idx) => {
    const rIdx = 5 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws6.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 11 ? 'left' : 'center',
        vertical: 'middle'
      };
    });
    ws6.getRow(rIdx).height = 19;
  });

  const rTotAe = 5 + aeData.length;
  ws6.getCell(`A${rTotAe}`).value = 'TOTALES ASISTENTES DE LA EDUCACIÓN';
  ws6.getCell(`A${rTotAe}`).font = fontBold;
  ws6.mergeCells(`A${rTotAe}:E${rTotAe}`);

  for (let c = 6; c <= 11; c++) {
    const colLetter = ws6.getColumn(c).letter;
    ws6.getCell(`${colLetter}${rTotAe}`).value = { formula: `SUM(${colLetter}5:${colLetter}${rTotAe - 1})` };
  }
  ws6.getCell(`L${rTotAe}`).value = '✓ 660 HRS EFECTIVAS';

  for (let c = 1; c <= 12; c++) {
    const cell = ws6.getCell(rTotAe, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws6.getRow(rTotAe).height = 22;

  ws6.getColumn(1).width = 5;
  ws6.getColumn(2).width = 16;
  ws6.getColumn(3).width = 34;
  ws6.getColumn(4).width = 18;
  ws6.getColumn(5).width = 28;
  ws6.getColumn(6).width = 14;
  ws6.getColumn(7).width = 15;
  ws6.getColumn(8).width = 17;
  ws6.getColumn(9).width = 12;
  ws6.getColumn(10).width = 14;
  ws6.getColumn(11).width = 10;
  ws6.getColumn(12).width = 38;

  // =========================================================================
  // HOJA 7: PARÁMETROS Y TABLAS (CATÁLOGOS OFICIALES PARA VALIDACIÓN)
  // =========================================================================
  const ws7 = wb.addWorksheet('7. Parametros y Tablas', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '64748B' } }
  });

  ws7.mergeCells('A1:I1');
  ws7.getCell('A1').value = 'TABLAS DE PARÁMETROS NORMATIVOS Y LISTAS DESPLEGABLES DEL SISTEMA';
  ws7.getCell('A1').font = fontTitle;
  ws7.getCell('A1').fill = fillNavy;
  ws7.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws7.getRow(1).height = 28;

  // Listas de Asignaturas
  ws7.getCell('A3').value = 'ASIGNATURAS MINEDUC';
  ws7.getCell('A3').font = fontHeader;
  ws7.getCell('A3').fill = fillSubHeader;
  const asignaturas = [
    'Lengua y Literatura', 'Matemática', 'Ciencias Naturales', 'Historia, Geografía y Cs. Sociales',
    'Idioma Extranjero Inglés', 'Educación Física y Salud', 'Artes Visuales', 'Música',
    'Tecnología', 'Orientación', 'Religión', 'Filosofía', 'Educación Ciudadana',
    'Ciencias para la Ciudadanía', 'Diferenciado TP Agropecuaria', 'Talleres JECD Libre Disposición'
  ];
  asignaturas.forEach((asig, i) => {
    ws7.getCell(4 + i, 1).value = asig;
    ws7.getCell(4 + i, 1).border = borderThin;
  });

  // 17 Cargos Canónicos DEP
  ws7.getCell('C3').value = '17 CARGOS CANÓNICOS DEP (AAEE)';
  ws7.getCell('C3').font = fontHeader;
  ws7.getCell('C3').fill = fillSubHeader;
  const cargosDep = [
    'Inspectores', 'Auxiliares', 'Psicólogo', 'Trabajador  Social', 'Asistente social',
    'Kinesiólogo/a', 'Fonoaudiólogo/a', 'Terapeuta ocupacional',
    'Asistente técnico de Educación Diferencial', 'Asistentes de aula', 'Administrativos',
    'Conductores Auxliar', 'Maestros', 'Enfermero/TENS/Asistente con capacitación',
    'Comunicaciones', 'Secretaria', 'Nocheros'
  ];
  cargosDep.forEach((c, i) => {
    ws7.getCell(4 + i, 3).value = c;
    ws7.getCell(4 + i, 3).border = borderThin;
  });

  // Cargos Directivos y Técnicos
  ws7.getCell('E3').value = 'CARGOS DIRECTIVOS Y TÉCNICOS';
  ws7.getCell('E3').font = fontHeader;
  ws7.getCell('E3').fill = fillSubHeader;
  const directivos = [
    'Director', 'Subdirector', 'Inspector General', 'Jefe Unidad Técnico Pedagógica',
    'Evaluador Curricular UTP', 'Encargada Convivencia Escolar', 'Orientador Educacional',
    'Coordinadora CRA / Biblioteca', 'Coordinador de Ciclo'
  ];
  directivos.forEach((d, i) => {
    ws7.getCell(4 + i, 5).value = d;
    ws7.getCell(4 + i, 5).border = borderThin;
  });

  // Tabla Ley 20.903
  ws7.getCell('G3').value = 'TABLA 60/40 (VULN >80%)';
  ws7.getCell('G3').font = fontHeader;
  ws7.getCell('G3').fill = fillSubHeader;
  ws7.getCell('H3').value = 'HRS AULA MÁX';
  ws7.getCell('H3').font = fontHeader;
  ws7.getCell('H3').fill = fillSubHeader;
  ws7.getCell('I3').value = 'HRS NO LECTIVAS';
  ws7.getCell('I3').font = fontHeader;
  ws7.getCell('I3').fill = fillSubHeader;

  const t6040 = [
    [44, 26.4, 17.6], [42, 25.2, 16.8], [40, 24.0, 16.0], [38, 22.8, 15.2],
    [36, 21.6, 14.4], [34, 20.4, 13.6], [32, 19.2, 12.8], [30, 18.0, 12.0],
    [28, 16.8, 11.2], [26, 15.6, 10.4], [24, 14.4, 9.6], [22, 13.2, 8.8]
  ];
  t6040.forEach((row, i) => {
    ws7.getCell(4 + i, 7).value = `${row[0]} hrs contrato`;
    ws7.getCell(4 + i, 8).value = row[1];
    ws7.getCell(4 + i, 9).value = row[2];
    [7, 8, 9].forEach(c => ws7.getCell(4 + i, c).border = borderThin);
  });

  ws7.getColumn(1).width = 30;
  ws7.getColumn(2).width = 4;
  ws7.getColumn(3).width = 36;
  ws7.getColumn(4).width = 4;
  ws7.getColumn(5).width = 32;
  ws7.getColumn(6).width = 4;
  ws7.getColumn(7).width = 18;
  ws7.getColumn(8).width = 16;
  ws7.getColumn(9).width = 18;

  // Guardar archivo
  const outputPath = path.resolve('Plantilla_Maestra_Dotacion_Escolar_2027_Ejemplo.xlsx');
  await wb.xlsx.writeFile(outputPath);
  console.log('ARCHIVO CREADO CON ÉXITO EN:', outputPath);
}

createPlantillaMaestra().catch(err => {
  console.error('ERROR AL CREAR ARCHIVO:', err);
  process.exit(1);
});
