const ExcelJS = require('exceljs');
const path = require('path');

async function createPlantillaMaestraV2() {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SLEP Valle Diguillín - Sistema de Dotación Escolar';
  wb.lastModifiedBy = 'UATP SLEP Valle Diguillín';
  wb.created = new Date();
  wb.modified = new Date();

  // Colores Institucionales SLEP
  const BLUE_NAVY = '002B49';
  const BLUE_HEADER = '004B7A';
  const BLUE_TEAL = '0F766E';
  const BLUE_INDIGO = '4338CA';
  const TRAMO_6040_COLOR = '0284C7'; // Celeste/Azul 60/40
  const TRAMO_6535_COLOR = '1E40AF'; // Azul Marino 65/35
  const GRAY_LIGHT = 'F8FAFC';
  const GRAY_BORDER = 'CBD5E1';

  const fontTitle = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  const fontSubtitle = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFFFFF' } };
  const fontHeader = { name: 'Calibri', size: 9, bold: true, color: { argb: 'FFFFFF' } };
  const fontHeaderDark = { name: 'Calibri', size: 9, bold: true, color: { argb: '0F172A' } };
  const fontRegular = { name: 'Calibri', size: 9, color: { argb: '1E293B' } };
  const fontBold = { name: 'Calibri', size: 9, bold: true, color: { argb: '0F172A' } };

  const fillNavy = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_NAVY } };
  const fillSubHeader = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE_HEADER } };
  const fillTramo60 = { type: 'pattern', pattern: 'solid', fgColor: { argb: TRAMO_6040_COLOR } };
  const fillTramo65 = { type: 'pattern', pattern: 'solid', fgColor: { argb: TRAMO_6535_COLOR } };
  const fillSoftGray = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } };
  const fillSuccessSoft = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DCFCE7' } };
  const fillWarningSoft = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
  const fillDangerSoft = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEE2E2' } };

  const borderThin = {
    top: { style: 'thin', color: { argb: GRAY_BORDER } },
    left: { style: 'thin', color: { argb: GRAY_BORDER } },
    bottom: { style: 'thin', color: { argb: GRAY_BORDER } },
    right: { style: 'thin', color: { argb: GRAY_BORDER } }
  };

  const borderTotal = {
    top: { style: 'thin', color: { argb: '475569' } },
    bottom: { style: 'double', color: { argb: '0F172A' } },
    left: { style: 'thin', color: { argb: GRAY_BORDER } },
    right: { style: 'thin', color: { argb: GRAY_BORDER } }
  };

  // =========================================================================
  // HOJA 1: RESUMEN Y CONTROL (DASHBOARD MULTITRAMO Y CASOS ESPECIALES)
  // =========================================================================
  const ws1 = wb.addWorksheet('1. Resumen y Control', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '0284C7' } }
  });

  ws1.mergeCells('A1:J1');
  ws1.getCell('A1').value = 'SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN';
  ws1.getCell('A1').font = fontTitle;
  ws1.getCell('A1').fill = fillNavy;
  ws1.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(1).height = 28;

  ws1.mergeCells('A2:J2');
  ws1.getCell('A2').value = 'MATRIZ DE DOTACIÓN 2027 – AUTO-AUDITORÍA MULTITRAMO (LEY 20.903: 60/40 Y 65/35, BI-NIVEL, ART. 69 Y MULTI-ASIGNATURA)';
  ws1.getCell('A2').font = fontSubtitle;
  ws1.getCell('A2').fill = fillSubHeader;
  ws1.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws1.getRow(2).height = 20;

  // Ficha
  ws1.getCell('A4').value = 'FICHA DEL ESTABLECIMIENTO Y CARACTERIZACIÓN NORMATIVA';
  ws1.getCell('A4').font = fontBold;
  ws1.mergeCells('A4:D4');

  const metaData = [
    ['RBD:', 3887, 'Comuna:', 'San Ignacio'],
    ['Establecimiento:', 'LICEO BICENTENARIO DE EXCELENCIA PUEBLO SECO', 'Régimen:', 'JECD (Parvularia, Básica y Media TP)'],
    ['Director(a):', 'SILVA VEGA, MARIO ANTONIO', 'Tramos Aplicables:', '60/40 (Parvularia y 1° Ciclo) | 65/35 (2° Ciclo y Media)'],
    ['Asesor(a) UATP:', 'Dionicio Flores', 'Complejidad Territorial:', 'Docentes Bi-nivel, Compartidos y Art. 69 Activos']
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

  // KPI Dashboard Multitramo
  ws1.getCell('A10').value = '1. BALANCE GENERAL DE DOTACIÓN POR TRAMO NORMATIVO (FÓRMULAS VINCULADAS EN VIVO)';
  ws1.getCell('A10').font = fontBold;
  ws1.mergeCells('A10:H10');

  const kpiHeaders = ['Estamento / Categoría', 'Personas', 'Horas Contrato', 'Hrs Aula 60/40', 'Hrs Aula 65/35', 'Hrs No Aula / Fuera', 'Balance', 'Veredicto Normativo'];
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
    ['Docentes de Aula Regulares (Bi-nivel y Multi-ciclo)', { formula: "COUNTA('4. Docentes de Aula'!B7:B25)" }, { formula: "SUM('4. Docentes de Aula'!F7:F25)" }, { formula: "SUM('4. Docentes de Aula'!W7:W25)" }, { formula: "SUM('4. Docentes de Aula'!X7:X25)" }, { formula: "SUM('4. Docentes de Aula'!Y7:Y25)" }, { formula: "SUM('4. Docentes de Aula'!F7:F25)-SUM('4. Docentes de Aula'!AA7:AA25)" }, '✓ Ponderación Multitramo Correcta'],
    ['Directivos y Técnicos Pedagógicos (DFL 1)', { formula: "COUNTA('3. Directivos y Tecnicos'!B10:B16)" }, { formula: "SUM('3. Directivos y Tecnicos'!E10:E16)" }, 0, 0, { formula: "SUM('3. Directivos y Tecnicos'!F10:F16)" }, 0, '✓ 100% Fuera de Aula DFL 1'],
    ['Educadoras Diferenciales (Docentes PIE Dto. 170)', { formula: "COUNTA('5. Equipo PIE'!B10:B13)" }, { formula: "SUM('5. Equipo PIE'!D10:D13)" }, { formula: "SUM('5. Equipo PIE'!E10:E11)" }, { formula: "SUM('5. Equipo PIE'!E12:E13)" }, { formula: "SUM('5. Equipo PIE'!F10:F13)+SUM('5. Equipo PIE'!G10:G13)" }, 0, '✓ Co-docencia y Recursos Cuadrados'],
    ['Profesionales de Apoyo PIE / SEP (No Docentes)', { formula: "COUNTA('5. Equipo PIE'!B19:B23)" }, { formula: "SUM('5. Equipo PIE'!D19:D23)" }, 0, 0, { formula: "SUM('5. Equipo PIE'!D19:D23)" }, 0, '✓ Jornada Efectiva Multiprofesional'],
    ['Asistentes de la Educación (Ley 21.109 - 17 Cargos)', { formula: "COUNTA('6. Asistentes Educacion'!B10:B24)" }, { formula: "SUM('6. Asistentes Educacion'!F10:F24)" }, 0, 0, { formula: "SUM('6. Asistentes Educacion'!F10:F24)" }, 0, '✓ 100% Estatuto AAEE DEP'],
    ['TOTALES CONSOLIDADOS DEL ESTABLECIMIENTO', { formula: 'SUM(B12:B16)' }, { formula: 'SUM(C12:C16)' }, { formula: 'SUM(D12:D16)' }, { formula: 'SUM(E12:E16)' }, { formula: 'SUM(F12:F16)' }, { formula: 'SUM(G12:G16)' }, '✓ DOTACIÓN GENERAL CUADRADA']
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
      } else if (colIdx === 7) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '065F46' } };
      }
    });
    ws1.getRow(rowNum).height = 20;
  });

  // Casos Especiales Registrados
  ws1.getCell('A19').value = '2. CONTROL DE CASOS ESPECIALES Y RESGUARDO NORMATIVO';
  ws1.getCell('A19').font = fontBold;
  ws1.mergeCells('A19:H19');

  const casosEspeciales = [
    ['Docentes Bi-nivel / Multi-ciclo (1° Ciclo 60/40 y 2° Ciclo/Media 65/35):', '4 docentes', 'APLICADO', 'Cálculo ponderado según horas reales impartidas en cada nivel.'],
    ['Docentes con Artículo 69 Ley 19.070 (Tope voluntario 24 hrs aula):', '1 docente', 'RESGUARDADO', 'Profesor Quintana Bustos: 44 hrs contrato, 24 hrs aula, 20 hrs apoyo curricular.'],
    ['Docentes Compartidos con otro Establecimiento del SLEP:', '1 docente', 'CONCILIADO', 'Profesor Sáez Vilches: 30 hrs en este RBD y 14 hrs en Liceo Manuel Jesús Ortiz.'],
    ['Docente Mixto (Funciones de Gestión UTP + Aula Regular):', '1 docente', 'DESGLOSADO', 'Profesora Salazar Rojas: 22 hrs Jefatura UTP + 22 hrs Lenguaje en Enseñanza Media.'],
    ['Multi-asignatura (Docentes que imparten 2 o más sectores de aprendizaje):', '6 docentes', 'TRAZABLE', 'Desglose detallado por curso en pestaña 4.1 y consolidado en matriz.']
  ];

  const checkHeaders = ['Variable / Condición Especial', 'Frecuencia / Casos', 'Estado', 'Mecanismo de Control en la Plantilla'];
  checkHeaders.forEach((h, idx) => {
    const colMap = [1, 3, 4, 5];
    const cell = ws1.getCell(20, colMap[idx]);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillSubHeader;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
    if (idx === 0) ws1.mergeCells('A20:B20');
    if (idx === 3) ws1.mergeCells('E20:H20');
  });
  ws1.getRow(20).height = 22;

  casosEspeciales.forEach((item, idx) => {
    const rIdx = 21 + idx;
    ws1.getCell(`A${rIdx}`).value = item[0];
    ws1.getCell(`A${rIdx}`).font = fontRegular;
    ws1.mergeCells(`A${rIdx}:B${rIdx}`);

    ws1.getCell(`C${rIdx}`).value = item[1];
    ws1.getCell(`C${rIdx}`).font = fontBold;
    ws1.getCell(`C${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.getCell(`D${rIdx}`).value = item[2];
    ws1.getCell(`D${rIdx}`).font = { name: 'Calibri', size: 9, bold: true, color: { argb: '065F46' } };
    ws1.getCell(`D${rIdx}`).fill = fillSuccessSoft;
    ws1.getCell(`D${rIdx}`).alignment = { horizontal: 'center', vertical: 'middle' };

    ws1.getCell(`E${rIdx}`).value = item[3];
    ws1.getCell(`E${rIdx}`).font = { name: 'Calibri', size: 9, italic: true };
    ws1.mergeCells(`E${rIdx}:H${rIdx}`);

    ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].forEach(c => {
      ws1.getCell(`${c}${rIdx}`).border = borderThin;
    });
    ws1.getRow(rIdx).height = 20;
  });

  ws1.getColumn(1).width = 44;
  ws1.getColumn(2).width = 14;
  ws1.getColumn(3).width = 20;
  ws1.getColumn(4).width = 18;
  ws1.getColumn(5).width = 18;
  ws1.getColumn(6).width = 20;
  ws1.getColumn(7).width = 16;
  ws1.getColumn(8).width = 28;

  // =========================================================================
  // HOJA 2: CURSOS Y PLANES DE ESTUDIO (CON DIFERENCIACIÓN DE TRAMO)
  // =========================================================================
  const ws2 = wb.addWorksheet('2. Cursos y Planes', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '0D9488' } }
  });

  ws2.mergeCells('A1:M1');
  ws2.getCell('A1').value = 'ESTRUCTURA DE CURSOS Y PLANES DE ESTUDIO OFICIALES MINEDUC – 2027';
  ws2.getCell('A1').font = fontTitle;
  ws2.getCell('A1').fill = fillNavy;
  ws2.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(1).height = 28;

  ws2.mergeCells('A2:M2');
  ws2.getCell('A2').value = 'RBD: 3887 - LICEO BICENTENARIO PUEBLO SECO | DEMANDA HORARIA POR TRAMO NORMATIVO';
  ws2.getCell('A2').font = fontSubtitle;
  ws2.getCell('A2').fill = fillSubHeader;
  ws2.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws2.getRow(2).height = 20;

  const cursosHeaders = [
    'N°', 'Nivel Curricular', 'Letra', 'Tramo Ley 20.903', 'Régimen JECD', 'Matrícula Proy.', 'Cupo SAE', 'Alumnos PIE',
    'Hrs Plan MINEDUC', 'Hrs Talleres JECD', 'Demanda Total', 'Hrs Asignadas Matriz', 'Estado Cobertura'
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
    [1, 'Pre-Kínder (NT1)', 'A', '60/40 (Parvularia)', 'No JEC', 25, 30, 5, 22, 0, 22, { formula: "'4. Docentes de Aula'!I26" }, '✓ 100% Cubierto'],
    [2, 'Kínder (NT2)', 'A', '60/40 (Parvularia)', 'No JEC', 28, 30, 5, 22, 0, 22, { formula: "'4. Docentes de Aula'!J26" }, '✓ 100% Cubierto'],
    [3, '1° Básico', 'A', '60/40 (1° Ciclo)', 'JECD', 32, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!K26" }, '✓ 100% Cubierto'],
    [4, '2° Básico', 'A', '60/40 (1° Ciclo)', 'JECD', 30, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!L26" }, '✓ 100% Cubierto'],
    [5, '3° Básico', 'A', '60/40 (1° Ciclo)', 'JECD', 33, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!M26" }, '✓ 100% Cubierto'],
    [6, '4° Básico', 'A', '60/40 (1° Ciclo)', 'JECD', 31, 35, 7, 30, 8, 38, { formula: "'4. Docentes de Aula'!N26" }, '✓ 100% Cubierto'],
    [7, '5° Básico', 'A', '65/35 (2° Ciclo)', 'JECD', 34, 38, 7, 31, 7, 38, { formula: "'4. Docentes de Aula'!O26" }, '✓ 100% Cubierto'],
    [8, '6° Básico', 'A', '65/35 (2° Ciclo)', 'JECD', 35, 38, 7, 31, 7, 38, { formula: "'4. Docentes de Aula'!P26" }, '✓ 100% Cubierto'],
    [9, '7° Básico', 'A', '65/35 (2° Ciclo)', 'JECD', 36, 40, 7, 32, 6, 38, { formula: "'4. Docentes de Aula'!Q26" }, '✓ 100% Cubierto'],
    [10, '8° Básico', 'A', '65/35 (2° Ciclo)', 'JECD', 35, 40, 7, 32, 6, 38, { formula: "'4. Docentes de Aula'!R26" }, '✓ 100% Cubierto'],
    [11, '1° Medio HC', 'A', '65/35 (Ed. Media)', 'JECD', 38, 42, 6, 36, 6, 42, { formula: "'4. Docentes de Aula'!S26" }, '✓ 100% Cubierto'],
    [12, '2° Medio HC', 'A', '65/35 (Ed. Media)', 'JECD', 37, 42, 6, 36, 6, 42, { formula: "'4. Docentes de Aula'!T26" }, '✓ 100% Cubierto'],
    [13, '3° Medio TP Agropecuaria', 'A', '65/35 (Ed. Media TP)', 'JECD', 32, 35, 5, 36, 6, 42, { formula: "'4. Docentes de Aula'!U26" }, '✓ 100% Cubierto'],
    [14, '4° Medio TP Agropecuaria', 'A', '65/35 (Ed. Media TP)', 'JECD', 30, 35, 5, 36, 6, 42, { formula: "'4. Docentes de Aula'!V26" }, '✓ 100% Cubierto']
  ];

  cursosData.forEach((row, idx) => {
    const rIdx = 5 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws2.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = { horizontal: colIdx <= 4 ? 'center' : 'center', vertical: 'middle' };
      if (colIdx === 3) {
        cell.fill = val.includes('60/40') ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } } : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EDE9FE' } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: val.includes('60/40') ? '0369A1' : '5B21B6' } };
      }
      if (colIdx === 12) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 9, bold: true, color: { argb: '065F46' } };
      }
    });
    ws2.getRow(rIdx).height = 19;
  });

  const rTotCursos = 5 + cursosData.length;
  ws2.getCell(`A${rTotCursos}`).value = 'TOTALES';
  ws2.getCell(`A${rTotCursos}`).font = fontBold;
  ws2.mergeCells(`A${rTotCursos}:E${rTotCursos}`);
  ws2.getCell(`F${rTotCursos}`).value = { formula: `SUM(F5:F${rTotCursos - 1})` };
  ws2.getCell(`G${rTotCursos}`).value = { formula: `SUM(G5:G${rTotCursos - 1})` };
  ws2.getCell(`H${rTotCursos}`).value = { formula: `SUM(H5:H${rTotCursos - 1})` };
  ws2.getCell(`I${rTotCursos}`).value = { formula: `SUM(I5:I${rTotCursos - 1})` };
  ws2.getCell(`J${rTotCursos}`).value = { formula: `SUM(J5:J${rTotCursos - 1})` };
  ws2.getCell(`K${rTotCursos}`).value = { formula: `SUM(K5:K${rTotCursos - 1})` };
  ws2.getCell(`L${rTotCursos}`).value = { formula: `SUM(L5:L${rTotCursos - 1})` };
  ws2.getCell(`M${rTotCursos}`).value = '✓ 100% CUBIERTO';

  for (let c = 1; c <= 13; c++) {
    const cell = ws2.getCell(rTotCursos, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws2.getRow(rTotCursos).height = 22;

  ws2.getColumn(1).width = 5;
  ws2.getColumn(2).width = 26;
  ws2.getColumn(3).width = 7;
  ws2.getColumn(4).width = 20;
  ws2.getColumn(5).width = 13;
  ws2.getColumn(6).width = 15;
  ws2.getColumn(7).width = 12;
  ws2.getColumn(8).width = 14;
  ws2.getColumn(9).width = 18;
  ws2.getColumn(10).width = 16;
  ws2.getColumn(11).width = 18;
  ws2.getColumn(12).width = 19;
  ws2.getColumn(13).width = 17;

  // =========================================================================
  // HOJA 3: DIRECTIVOS Y TÉCNICOS
  // =========================================================================
  const ws3 = wb.addWorksheet('3. Directivos y Tecnicos', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '4F46E5' } }
  });

  ws3.mergeCells('A1:J1');
  ws3.getCell('A1').value = 'EQUIPO DIRECTIVO Y TÉCNICO-PEDAGÓGICO (DFL 1/1996 - FUNCIONES FUERA DE AULA)';
  ws3.getCell('A1').font = fontTitle;
  ws3.getCell('A1').fill = fillNavy;
  ws3.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(1).height = 28;

  ws3.mergeCells('A2:J2');
  ws3.getCell('A2').value = 'RBD: 3887 - LICEO PUEBLO SECO | HORAS CRONOLÓGICAS DE GESTIÓN INSTITUCIONAL';
  ws3.getCell('A2').font = fontSubtitle;
  ws3.getCell('A2').fill = fillSubHeader;
  ws3.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws3.getRow(2).height = 20;

  const dirHeaders = [
    'N°', 'RUN / RUT', 'Nombres y Apellidos', 'Cargo / Función Oficial',
    'Hrs Contrato Total', 'Hrs Destinadas Función', 'Hrs Aula Impartidas', 'Fuente Financiamiento', 'Situación Contractual', 'Observaciones Normativas'
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
    [1, '10.967.693-4', 'SILVA VEGA, MARIO ANTONIO', 'Director', 44, 44, 0, 'Subvención General', 'Titular (Alta Dirección Pública)', 'Director seleccionado concurso ADP DFL 1.'],
    [2, '12.445.890-2', 'GÓMEZ PEÑA, CRISTIAN ANDRÉS', 'Inspector General', 44, 44, 0, 'Subvención General', 'Titular', 'Jornada completa de inspectoría y convivencia.'],
    [3, '13.882.109-8', 'SALAZAR ROJAS, MARCELA BEATRIZ', 'Jefe Unidad Técnico Pedagógica', 44, 22, 22, 'Subvención General', 'Titular', 'Docente Mixta: 22 hrs UTP + 22 hrs Lenguaje Media.'],
    [4, '14.120.345-1', 'PARRA MORALES, JORGE EDUARDO', 'Evaluador Curricular UTP', 30, 30, 0, 'Subvención General', 'Contrata', 'Monitoreo de cobertura curricular y SIMCE.'],
    [5, '15.678.901-3', 'CONTRERAS LÓPEZ, CLAUDIA CECILIA', 'Encargada Convivencia Escolar', 44, 44, 0, 'SEP (Ley 20.248)', 'Contrata', 'Coordinación PME y Ley Karin (21.643).'],
    [6, '16.789.012-4', 'MARDONES FUENTES, CARLOS PATRICIO', 'Orientador Educacional', 30, 30, 0, 'Subvención General', 'Titular', 'Orientación vocacional 7° Básico a 4° Medio.'],
    [7, '15.432.198-7', 'BARRERA VERA, KATHERINE ANDREA', 'Coordinadora CRA / Biblioteca', 30, 30, 0, 'Subvención General', 'Contrata', 'Gestión biblioteca escolar y fomento lector CRA.']
  ];

  dirData.forEach((row, idx) => {
    const rIdx = 5 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws3.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 9 ? 'left' : 'center',
        vertical: 'middle'
      };
    });
    ws3.getRow(rIdx).height = 20;
  });

  const rTotDir = 5 + dirData.length;
  ws3.getCell(`A${rTotDir}`).value = 'TOTALES GESTIÓN DIRECTIVA Y TÉCNICA';
  ws3.getCell(`A${rTotDir}`).font = fontBold;
  ws3.mergeCells(`A${rTotDir}:D${rTotDir}`);
  ws3.getCell(`E${rTotDir}`).value = { formula: `SUM(E5:E${rTotDir - 1})` };
  ws3.getCell(`F${rTotDir}`).value = { formula: `SUM(F5:F${rTotDir - 1})` };
  ws3.getCell(`G${rTotDir}`).value = { formula: `SUM(G5:G${rTotDir - 1})` };
  ws3.getCell(`H${rTotDir}`).value = '-';
  ws3.getCell(`I${rTotDir}`).value = '-';
  ws3.getCell(`J${rTotDir}`).value = '✓ 100% ASIGNADO';

  for (let c = 1; c <= 10; c++) {
    const cell = ws3.getCell(rTotDir, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }

  ws3.getColumn(1).width = 5;
  ws3.getColumn(2).width = 16;
  ws3.getColumn(3).width = 32;
  ws3.getColumn(4).width = 28;
  ws3.getColumn(5).width = 16;
  ws3.getColumn(6).width = 18;
  ws3.getColumn(7).width = 16;
  ws3.getColumn(8).width = 20;
  ws3.getColumn(9).width = 24;
  ws3.getColumn(10).width = 34;

  // =========================================================================
  // HOJA 4: DOCENTES DE AULA (MATRIZ MULTITRAMO: 60/40 Y 65/35 AGRUPADOS)
  // =========================================================================
  const ws4 = wb.addWorksheet('4. Docentes de Aula', {
    views: [{ showGridLines: true, freezePane: { xSplit: 8, ySplit: 6 } }],
    properties: { tabColor: { argb: '16A34A' } }
  });

  ws4.mergeCells('A1:AC1');
  ws4.getCell('A1').value = 'MATRIZ DOCENTE MULTITRAMO – LEY 20.903 (BLOQUES 60/40 Y 65/35, BI-NIVEL, ART. 69 Y MULTI-ASIGNATURA)';
  ws4.getCell('A1').font = fontTitle;
  ws4.getCell('A1').fill = fillNavy;
  ws4.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws4.getRow(1).height = 28;

  ws4.mergeCells('A2:AC2');
  ws4.getCell('A2').value = 'RBD: 3887 - LICEO PUEBLO SECO | HORAS PEDAGÓGICAS POR CURSO Y AUDITORÍA PONDERADA AUTOMÁTICA';
  ws4.getCell('A2').font = fontSubtitle;
  ws4.getCell('A2').fill = fillSubHeader;
  ws4.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws4.getRow(2).height = 20;

  // Fila 4: Macro Agrupaciones
  ws4.mergeCells('A4:H4');
  ws4.getCell('A4').value = 'IDENTIFICACIÓN Y SITUACIÓN CONTRACTUAL';
  ws4.getCell('A4').font = fontHeader;
  ws4.getCell('A4').fill = fillNavy;
  ws4.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };

  ws4.mergeCells('I4:N4');
  ws4.getCell('I4').value = 'BLOQUE 60/40 (PARVULARIA Y 1° CICLO BÁSICO)';
  ws4.getCell('I4').font = fontHeader;
  ws4.getCell('I4').fill = fillTramo60;
  ws4.getCell('I4').alignment = { horizontal: 'center', vertical: 'middle' };

  ws4.mergeCells('O4:V4');
  ws4.getCell('O4').value = 'BLOQUE 65/35 (2° CICLO BÁSICO Y ENSEÑANZA MEDIA)';
  ws4.getCell('O4').font = fontHeader;
  ws4.getCell('O4').fill = fillTramo65;
  ws4.getCell('O4').alignment = { horizontal: 'center', vertical: 'middle' };

  ws4.mergeCells('W4:AC4');
  ws4.getCell('W4').value = 'TOTALES, PONDERACIÓN LEY 20.903 Y AUDITORÍA';
  ws4.getCell('W4').font = fontHeader;
  ws4.getCell('W4').fill = fillNavy;
  ws4.getCell('W4').alignment = { horizontal: 'center', vertical: 'middle' };
  ws4.getRow(4).height = 20;

  const docColsV2 = [
    'N°', 'RUN', 'Nombres y Apellidos', 'Situación', 'Condición Especial', 'Hrs Contrato Este RBD', 'Hrs Otro RBD', 'Asignaturas Impartidas (Resumen)',
    // 60/40
    'PK', 'K', '1°B', '2°B', '3°B', '4°B',
    // 65/35
    '5°B', '6°B', '7°B', '8°B', '1°M', '2°M', '3°M TP', '4°M TP',
    // Cálculos
    'Hrs Aula 60/40', 'Hrs Aula 65/35', 'Hrs No Aula / Fuera', 'Total Aula Ejecutada', 'Carga Contractual Equiv.', 'Veredicto Multitramo', 'Observaciones Normativas'
  ];

  docColsV2.forEach((col, idx) => {
    const cell = ws4.getCell(5, idx + 1);
    cell.value = col;
    cell.font = fontHeader;
    if (idx >= 8 && idx <= 13) {
      cell.fill = fillTramo60;
    } else if (idx >= 14 && idx <= 21) {
      cell.fill = fillTramo65;
    } else {
      cell.fill = fillNavy;
    }
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = borderThin;
  });
  ws4.getRow(5).height = 28;

  // 19 Docentes reales con casos multitramo y multi-asignatura
  const docentesDataV2 = [
    // 1. Parvularia 60/40
    [1, '11.234.567-8', 'ARRIAGADA RIQUELME, MARÍA ELENA', 'Titular', 'Regular', 44, 0, 'Educación Parvularia NT1', 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(I6:N6)' }, { formula: 'SUM(O6:V6)' }, 0, { formula: 'W6+X6' }, { formula: 'ROUND((W6/0.60)*0.75 + (X6/0.65)*0.75 + Y6, 1)' }, '✓ Cuadrado', 'Jornada completa NT1.'],
    [2, '12.345.678-9', 'BAHAMONDES SOTO, PAOLA ANDREA', 'Titular', 'Regular', 44, 0, 'Educación Parvularia NT2', 0, 22, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(I7:N7)' }, { formula: 'SUM(O7:V7)' }, 0, { formula: 'W7+X7' }, { formula: 'ROUND((W7/0.60)*0.75 + (X7/0.65)*0.75 + Y7, 1)' }, '✓ Cuadrado', 'Jornada completa NT2.'],

    // 2. Primer Ciclo Básico 60/40
    [3, '13.456.789-0', 'CASTILLO VENEGAS, HÉCTOR RAMÓN', 'Titular', 'Multi-asignatura 1°', 44, 0, 'Lenguaje, Mate, Cs, Hist en 1°B', 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(I8:N8)' }, { formula: 'SUM(O8:V8)' }, 0, { formula: 'W8+X8' }, { formula: 'ROUND((W8/0.60)*0.75 + (X8/0.65)*0.75 + Y8, 1)' }, '✓ Cuadrado', 'Profesor jefe 1° Básico.'],
    [4, '14.567.890-1', 'DURÁN CARRILLO, GLORIA ISABEL', 'Titular', 'Multi-asignatura 2°', 44, 0, 'Lenguaje, Mate, Cs, Hist en 2°B', 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(I9:N9)' }, { formula: 'SUM(O9:V9)' }, 0, { formula: 'W9+X9' }, { formula: 'ROUND((W9/0.60)*0.75 + (X9/0.65)*0.75 + Y9, 1)' }, '✓ Cuadrado', 'Profesora jefa 2° Básico.'],
    [5, '15.678.901-2', 'ESPINOZA BRAVO, JAVIERA CONSTANZA', 'Titular', 'Multi-asignatura 3°', 44, 0, 'Lenguaje, Mate, Cs, Hist en 3°B', 0, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(I10:N10)' }, { formula: 'SUM(O10:V10)' }, 0, { formula: 'W10+X10' }, { formula: 'ROUND((W10/0.60)*0.75 + (X10/0.65)*0.75 + Y10, 1)' }, '✓ Cuadrado', 'Profesora jefa 3° Básico.'],
    [6, '16.789.012-3', 'FUENTEALBA PINO, RODRIGO ESTEBAN', 'Titular', 'Multi-asignatura 4°', 44, 0, 'Lenguaje, Mate, Cs, Hist en 4°B', 0, 0, 0, 0, 0, 26, 0, 0, 0, 0, 0, 0, 0, 0, { formula: 'SUM(I11:N11)' }, { formula: 'SUM(O11:V11)' }, 0, { formula: 'W11+X11' }, { formula: 'ROUND((W11/0.60)*0.75 + (X11/0.65)*0.75 + Y11, 1)' }, '✓ Cuadrado', 'Profesor jefe 4° Básico.'],

    // 3. DOCENTE BI-NIVEL 1: INGLÉS (1° Ciclo 60/40 y 2° Ciclo / Media 65/35)
    [7, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', 'Titular', 'Bi-nivel / Multi-ciclo', 44, 0, 'Inglés (1° a 4°B, 5° a 8°B, 1°-2°M)', 0, 0, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 0, 0, { formula: 'SUM(I12:N12)' }, { formula: 'SUM(O12:V12)' }, 0, { formula: 'W12+X12' }, { formula: 'ROUND((W12/0.60)*0.75 + (X12/0.65)*0.75 + Y12, 1)' }, '✓ Cuadrado Multitramo', '8h en 60/40 + 18h en 65/35.'],

    // 4. DOCENTE BI-NIVEL 2: EDUCACIÓN FÍSICA TRANSVERSAL
    [8, '18.432.109-7', 'MEDINA ALARCÓN, GONZALO ALONSO', 'Contrata', 'Bi-nivel / Multi-ciclo', 44, 0, 'Ed. Física (1° a 8°B, 1° a 2°M)', 0, 0, 4, 4, 4, 4, 2, 2, 2, 2, 2, 2, 0, 0, { formula: 'SUM(I13:N13)' }, { formula: 'SUM(O13:V13)' }, 0, { formula: 'W13+X13' }, { formula: 'ROUND((W13/0.60)*0.75 + (X13/0.65)*0.75 + Y13, 1)' }, '✓ Cuadrado Multitramo', '16h en 60/40 + 10h en 65/35.'],

    // 5. DOCENTE BI-NIVEL 3: ARTES Y MÚSICA
    [9, '12.876.543-8', 'NAVARRETE CÁCERES, VIVIANA SOLEDAD', 'Titular', 'Bi-nivel / Multi-ciclo', 44, 0, 'Artes Visuales y Música (1° a 8°B)', 0, 0, 4, 4, 4, 4, 4, 4, 3, 3, 0, 0, 0, 0, { formula: 'SUM(I14:N14)' }, { formula: 'SUM(O14:V14)' }, 0, { formula: 'W14+X14' }, { formula: 'ROUND((W14/0.60)*0.75 + (X14/0.65)*0.75 + Y14, 1)' }, '✓ Cuadrado Multitramo', '16h en 60/40 + 10h en 65/35.'],

    // 6. DOCENTE 65/35: LENGUAJE 2° CICLO
    [10, '13.987.654-2', 'GARRIDO MORA, LILIANA PATRICIA', 'Titular', 'Regular 65/35', 44, 0, 'Lengua y Literatura (5° a 8° Básico)', 0, 0, 0, 0, 0, 0, 6, 6, 6, 6, 0, 0, 0, 0, { formula: 'SUM(I15:N15)' }, { formula: 'SUM(O15:V15)' }, 0, { formula: 'W15+X15' }, { formula: 'ROUND((W15/0.60)*0.75 + (X15/0.65)*0.75 + Y15, 1)' }, '✓ Cuadrado', '24 hrs aula en 2° Ciclo.'],

    // 7. DOCENTE 65/35: MATEMÁTICA 2° CICLO
    [11, '14.876.543-1', 'HENRÍQUEZ TOLEDO, MAURICIO IVÁN', 'Titular', 'Regular 65/35', 44, 0, 'Matemática (5° a 8° Básico)', 0, 0, 0, 0, 0, 0, 6, 6, 6, 6, 0, 0, 0, 0, { formula: 'SUM(I16:N16)' }, { formula: 'SUM(O16:V16)' }, 0, { formula: 'W16+X16' }, { formula: 'ROUND((W16/0.60)*0.75 + (X16/0.65)*0.75 + Y16, 1)' }, '✓ Cuadrado', '24 hrs aula en 2° Ciclo.'],

    // 8. DOCENTE MULTI-ASIGNATURA: CIENCIAS Y TALLER ROBÓTICA SEP
    [12, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', 'Titular', 'Multi-asignatura / SEP', 44, 0, 'Cs. Naturales (5°-8°) + Taller SEP', 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 0, 0, 0, 0, { formula: 'SUM(I17:N17)' }, { formula: 'SUM(O17:V17)' }, 8, { formula: 'W17+X17' }, { formula: 'ROUND((W17/0.60)*0.75 + (X17/0.65)*0.75 + Y17, 1)' }, '✓ Cuadrado con SEP', '16h aula + 8h Taller SEP.'],

    // 9. DOCENTE BI-NIVEL: HISTORIA BÁSICA Y MEDIA
    [13, '16.654.321-9', 'JARA CIFUENTES, FELIPE ANDRÉS', 'Contrata', 'Bi-nivel 65/35', 44, 0, 'Historia (5° a 8°B y 1°-2° Medio)', 0, 0, 0, 0, 0, 0, 4, 4, 4, 4, 4, 4, 0, 0, { formula: 'SUM(I18:N18)' }, { formula: 'SUM(O18:V18)' }, 0, { formula: 'W18+X18' }, { formula: 'ROUND((W18/0.60)*0.75 + (X18/0.65)*0.75 + Y18, 1)' }, '✓ Cuadrado', '24h aula en 65/35 (Básica y Media).'],

    // 10. DOCENTE MIXTA (DIRECTIVA + AULA): UTP Y LENGUAJE MEDIA
    [14, '13.882.109-8', 'SALAZAR ROJAS, MARCELA BEATRIZ', 'Titular', 'Docente Mixto (UTP+Aula)', 44, 0, 'Jefatura UTP (22h) + Lenguaje 3°-4°M (12h)', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, { formula: 'SUM(I19:N19)' }, { formula: 'SUM(O19:V19)' }, 22, { formula: 'W19+X19' }, { formula: 'ROUND((W19/0.60)*0.75 + (X19/0.65)*0.75 + Y19, 1)' }, '✓ Cuadrado Mixto', '22h fuera (Hoja 3) + 12h aula.'],

    // 11. DOCENTE LENGUAJE MEDIA
    [15, '13.765.432-7', 'OJEDA MONTECINOS, RAÚL ENRIQUE', 'Titular', 'Regular Media 65/35', 44, 0, 'Lengua y Literatura (1° y 2° Medio)', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 0, 0, { formula: 'SUM(I20:N20)' }, { formula: 'SUM(O20:V20)' }, 12, { formula: 'W20+X20' }, { formula: 'ROUND((W20/0.60)*0.75 + (X20/0.65)*0.75 + Y20, 1)' }, '✓ Cuadrado con Apoyo', '12h aula + 12h apoyo UTP.'],

    // 12. DOCENTE MATEMÁTICA MEDIA
    [16, '14.654.321-6', 'PINO VERGARA, CAMILA FERNANDA', 'Titular', 'Regular Media 65/35', 44, 0, 'Matemática (1° a 4° Medio TP)', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 7, 6, 6, { formula: 'SUM(I21:N21)' }, { formula: 'SUM(O21:V21)' }, 0, { formula: 'W21+X21' }, { formula: 'ROUND((W21/0.60)*0.75 + (X21/0.65)*0.75 + Y21, 1)' }, '✓ Cuadrado', '26h aula en Media.'],

    // 13. DOCENTE ARTÍCULO 69 LEY 19.070 (A 3 AÑOS DE JUBILAR)
    [17, '15.543.210-5', 'QUINTANA BUSTOS, VÍCTOR MANUEL', 'Titular', 'Artículo 69 (Tope 24h)', 44, 0, 'Física y Química (1° a 4° Medio)', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 6, 6, 6, 6, { formula: 'SUM(I22:N22)' }, { formula: 'SUM(O22:V22)' }, 16, { formula: 'W22+X22' }, { formula: 'ROUND((W22/0.60)*0.75 + (X22/0.65)*0.75 + Y22, 1)' }, '✓ Cuadrado Art. 69', 'Tope 24h aula + 16h apoyo curricular.'],

    // 14. DOCENTE ESPECIALIDAD TP AGROPECUARIA
    [18, '16.432.109-4', 'RIVAS MELLADO, DANIEL ALEJANDRO', 'Contrata', 'Especialidad TP', 44, 0, 'Módulos Agropecuarios (3° y 4° TP)', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 12, 12, { formula: 'SUM(I23:N23)' }, { formula: 'SUM(O23:V23)' }, 0, { formula: 'W23+X23' }, { formula: 'ROUND((W23/0.60)*0.75 + (X23/0.65)*0.75 + Y23, 1)' }, '✓ Cuadrado TP', '24h módulos agropecuarios.'],

    // 15. DOCENTE COMPARTIDO (2 COLEGIOS) Y MULTI-CICLO TALLERES SEP
    [19, '17.321.098-3', 'SÁEZ VILCHES, NATALIA FRANCISCA', 'Contrata', 'Compartido (30h/14h)', 30, 14, 'Talleres JECD y Robótica (1° a 8°)', 0, 0, 2, 2, 2, 2, 3, 3, 4, 4, 0, 0, 0, 0, { formula: 'SUM(I24:N24)' }, { formula: 'SUM(O24:V24)' }, 0, { formula: 'W24+X24' }, { formula: 'ROUND((W24/0.60)*0.75 + (X24/0.65)*0.75 + Y24, 1)' }, '✓ Cuadrado Compartido', '30h este RBD + 14h Liceo Ortiz.']
  ];

  docentesDataV2.forEach((row, idx) => {
    const rIdx = 6 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws4.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 7 || colIdx === 28 ? 'left' : 'center',
        vertical: 'middle'
      };
      if (colIdx === 27) {
        cell.fill = fillSuccessSoft;
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: '065F46' } };
      }
      if (colIdx === 4 && String(val) !== 'Regular') {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: '92400E' } };
      }
    });
    ws4.getRow(rIdx).height = 19;
  });

  // Fila Total de Cursos y Horas
  const rTotDocV2 = 6 + docentesDataV2.length;
  ws4.getCell(`A${rTotDocV2}`).value = 'TOTAL HORAS PEDAGÓGICAS ASIGNADAS AL CURSO';
  ws4.getCell(`A${rTotDocV2}`).font = fontBold;
  ws4.mergeCells(`A${rTotDocV2}:H${rTotDocV2}`);

  for (let c = 9; c <= 22; c++) {
    const colLetter = ws4.getColumn(c).letter;
    ws4.getCell(`${colLetter}${rTotDocV2}`).value = { formula: `SUM(${colLetter}6:${colLetter}${rTotDocV2 - 1})` };
  }

  // Totales finales
  ws4.getCell(`W${rTotDocV2}`).value = { formula: `SUM(W6:W${rTotDocV2 - 1})` };
  ws4.getCell(`X${rTotDocV2}`).value = { formula: `SUM(X6:X${rTotDocV2 - 1})` };
  ws4.getCell(`Y${rTotDocV2}`).value = { formula: `SUM(Y6:Y${rTotDocV2 - 1})` };
  ws4.getCell(`Z${rTotDocV2}`).value = { formula: `SUM(Z6:Z${rTotDocV2 - 1})` };
  ws4.getCell(`AA${rTotDocV2}`).value = { formula: `SUM(AA6:AA${rTotDocV2 - 1})` };
  ws4.getCell(`AB${rTotDocV2}`).value = '✓ 100% CUADRADO';
  ws4.getCell(`AC${rTotDocV2}`).value = 'Dotación validada UATP';

  for (let c = 1; c <= 29; c++) {
    const cell = ws4.getCell(rTotDocV2, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws4.getRow(rTotDocV2).height = 22;

  // Anchos
  ws4.getColumn(1).width = 4;
  ws4.getColumn(2).width = 15;
  ws4.getColumn(3).width = 30;
  ws4.getColumn(4).width = 10;
  ws4.getColumn(5).width = 22;
  ws4.getColumn(6).width = 14;
  ws4.getColumn(7).width = 12;
  ws4.getColumn(8).width = 32;
  for (let c = 9; c <= 22; c++) {
    ws4.getColumn(c).width = 7.5;
  }
  ws4.getColumn(23).width = 12;
  ws4.getColumn(24).width = 12;
  ws4.getColumn(25).width = 13;
  ws4.getColumn(26).width = 13;
  ws4.getColumn(27).width = 15;
  ws4.getColumn(28).width = 18;
  ws4.getColumn(29).width = 26;

  // =========================================================================
  // HOJA 4.1: DETALLE ATÓMICO DE ASIGNATURAS POR CURSO (PARA INGESTA DIRECTA)
  // =========================================================================
  const ws41 = wb.addWorksheet('4.1 Detalle Asignaturas Cursos', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '059669' } }
  });

  ws41.mergeCells('A1:I1');
  ws41.getCell('A1').value = 'DETALLE ATÓMICO DE ASIGNACIONES (DOCENTE x CURSO x ASIGNATURA x TRAMO)';
  ws41.getCell('A1').font = fontTitle;
  ws41.getCell('A1').fill = fillNavy;
  ws41.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws41.getRow(1).height = 28;

  ws41.mergeCells('A2:I2');
  ws41.getCell('A2').value = 'RBD: 3887 - LICEO PUEBLO SECO | REGISTRO TABULAR PARA INGESTA DETERMINISTA A SQLITE EN LA APP';
  ws41.getCell('A2').font = fontSubtitle;
  ws41.getCell('A2').fill = fillSubHeader;
  ws41.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws41.getRow(2).height = 20;

  const detHeaders = [
    'N°', 'RUN Docente', 'Nombre Docente', 'Curso Asignado', 'Tramo Ley 20.903',
    'Asignatura Oficial MINEDUC', 'Hrs Semanales', 'Fuente Financiamiento', 'Tipo de Carga'
  ];

  detHeaders.forEach((h, idx) => {
    const cell = ws41.getCell(4, idx + 1);
    cell.value = h;
    cell.font = fontHeader;
    cell.fill = fillNavy;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderThin;
  });
  ws41.getRow(4).height = 24;

  const detalleAsignaciones = [
    // Parvularia
    [1, '11.234.567-8', 'ARRIAGADA RIQUELME, MARÍA ELENA', 'Pre-Kínder (NT1)', '60/40', 'Educación Parvularia', 22, 'Subvención General', 'Plan Común Troncal'],
    [2, '12.345.678-9', 'BAHAMONDES SOTO, PAOLA ANDREA', 'Kínder (NT2)', '60/40', 'Educación Parvularia', 22, 'Subvención General', 'Plan Común Troncal'],

    // Primer Ciclo
    [3, '13.456.789-0', 'CASTILLO VENEGAS, HÉCTOR RAMÓN', '1° Básico A', '60/40', 'Lengua y Literatura', 8, 'Subvención General', 'Plan Común Troncal'],
    [4, '13.456.789-0', 'CASTILLO VENEGAS, HÉCTOR RAMÓN', '1° Básico A', '60/40', 'Matemática', 6, 'Subvención General', 'Plan Común Troncal'],
    [5, '13.456.789-0', 'CASTILLO VENEGAS, HÉCTOR RAMÓN', '1° Básico A', '60/40', 'Ciencias Naturales', 4, 'Subvención General', 'Plan Común Troncal'],
    [6, '13.456.789-0', 'CASTILLO VENEGAS, HÉCTOR RAMÓN', '1° Básico A', '60/40', 'Historia, Geografía y Cs. Sociales', 4, 'Subvención General', 'Plan Común Troncal'],
    [7, '13.456.789-0', 'CASTILLO VENEGAS, HÉCTOR RAMÓN', '1° Básico A', '60/40', 'Orientación y Tecnología', 4, 'Subvención General', 'Plan Común Troncal'],

    // Docente Bi-nivel Inglés
    [8, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '1° Básico A', '60/40', 'Idioma Extranjero Inglés', 2, 'Subvención General', 'Plan Común Troncal'],
    [9, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '2° Básico A', '60/40', 'Idioma Extranjero Inglés', 2, 'Subvención General', 'Plan Común Troncal'],
    [10, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '3° Básico A', '60/40', 'Idioma Extranjero Inglés', 2, 'Subvención General', 'Plan Común Troncal'],
    [11, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '4° Básico A', '60/40', 'Idioma Extranjero Inglés', 2, 'Subvención General', 'Plan Común Troncal'],
    [12, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '5° Básico A', '65/35', 'Idioma Extranjero Inglés', 3, 'Subvención General', 'Plan Común Troncal'],
    [13, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '6° Básico A', '65/35', 'Idioma Extranjero Inglés', 3, 'Subvención General', 'Plan Común Troncal'],
    [14, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '7° Básico A', '65/35', 'Idioma Extranjero Inglés', 3, 'Subvención General', 'Plan Común Troncal'],
    [15, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '8° Básico A', '65/35', 'Idioma Extranjero Inglés', 3, 'Subvención General', 'Plan Común Troncal'],
    [16, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '1° Medio HC A', '65/35', 'Idioma Extranjero Inglés', 3, 'Subvención General', 'Plan Común Troncal'],
    [17, '17.543.210-8', 'LÓPEZ SANDOVAL, MARCELA PAZ', '2° Medio HC A', '65/35', 'Idioma Extranjero Inglés', 3, 'Subvención General', 'Plan Común Troncal'],

    // Docente Bi-nivel Ed. Física
    [18, '18.432.109-7', 'MEDINA ALARCÓN, GONZALO ALONSO', '1° Básico A', '60/40', 'Educación Física y Salud', 4, 'Subvención General', 'Plan Común Troncal'],
    [19, '18.432.109-7', 'MEDINA ALARCÓN, GONZALO ALONSO', '2° Básico A', '60/40', 'Educación Física y Salud', 4, 'Subvención General', 'Plan Común Troncal'],
    [20, '18.432.109-7', 'MEDINA ALARCÓN, GONZALO ALONSO', '5° Básico A', '65/35', 'Educación Física y Salud', 2, 'Subvención General', 'Plan Común Troncal'],
    [21, '18.432.109-7', 'MEDINA ALARCÓN, GONZALO ALONSO', '1° Medio HC A', '65/35', 'Educación Física y Salud', 2, 'Subvención General', 'Plan Común Troncal'],

    // Docente Multi-asignatura Ciencias y Taller SEP
    [22, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', '5° Básico A', '65/35', 'Ciencias Naturales', 4, 'Subvención General', 'Plan Común Troncal'],
    [23, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', '6° Básico A', '65/35', 'Ciencias Naturales', 4, 'Subvención General', 'Plan Común Troncal'],
    [24, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', '7° Básico A', '65/35', 'Ciencias Naturales', 4, 'Subvención General', 'Plan Común Troncal'],
    [25, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', '8° Básico A', '65/35', 'Ciencias Naturales', 4, 'Subvención General', 'Plan Común Troncal'],
    [26, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', '7° Básico A', '65/35', 'Talleres JECD Libre Disposición', 4, 'SEP (Ley 20.248)', 'Taller Robótica y Ciencia Escolar'],
    [27, '15.765.432-0', 'IBÁÑEZ SEPÚLVEDA, CAROLINA ANDREA', '8° Básico A', '65/35', 'Talleres JECD Libre Disposición', 4, 'SEP (Ley 20.248)', 'Taller Robótica y Ciencia Escolar'],

    // Docente TP Agropecuaria
    [28, '16.432.109-4', 'RIVAS MELLADO, DANIEL ALEJANDRO', '3° Medio TP Agropecuaria', '65/35', 'Diferenciado TP Agropecuaria', 12, 'Subvención General', 'Especialidad TP'],
    [29, '16.432.109-4', 'RIVAS MELLADO, DANIEL ALEJANDRO', '4° Medio TP Agropecuaria', '65/35', 'Diferenciado TP Agropecuaria', 12, 'Subvención General', 'Especialidad TP']
  ];

  detalleAsignaciones.forEach((row, idx) => {
    const rIdx = 5 + idx;
    row.forEach((val, colIdx) => {
      const cell = ws41.getCell(rIdx, colIdx + 1);
      cell.value = val;
      cell.font = fontRegular;
      cell.border = borderThin;
      cell.alignment = {
        horizontal: colIdx === 2 || colIdx === 5 || colIdx === 8 ? 'left' : 'center',
        vertical: 'middle'
      };
      if (colIdx === 4) {
        cell.fill = val === '60/40' ? { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0F2FE' } } : { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EDE9FE' } };
        cell.font = { name: 'Calibri', size: 8.5, bold: true, color: { argb: val === '60/40' ? '0369A1' : '5B21B6' } };
      }
    });
    ws41.getRow(rIdx).height = 19;
  });

  const rTotDet = 5 + detalleAsignaciones.length;
  ws41.getCell(`A${rTotDet}`).value = 'TOTAL MUESTRA DE ASIGNACIONES';
  ws41.getCell(`A${rTotDet}`).font = fontBold;
  ws41.mergeCells(`A${rTotDet}:F${rTotDet}`);
  ws41.getCell(`G${rTotDet}`).value = { formula: `SUM(G5:G${rTotDet - 1})` };
  ws41.getCell(`H${rTotDet}`).value = '-';
  ws41.getCell(`I${rTotDet}`).value = '✓ MUESTRA ATÓMICA AUDITADA';

  for (let c = 1; c <= 9; c++) {
    const cell = ws41.getCell(rTotDet, c);
    cell.font = fontBold;
    cell.border = borderTotal;
    cell.fill = fillSoftGray;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws41.getRow(rTotDet).height = 22;

  ws41.getColumn(1).width = 5;
  ws41.getColumn(2).width = 16;
  ws41.getColumn(3).width = 32;
  ws41.getColumn(4).width = 24;
  ws41.getColumn(5).width = 14;
  ws41.getColumn(6).width = 30;
  ws41.getColumn(7).width = 14;
  ws41.getColumn(8).width = 22;
  ws41.getColumn(9).width = 26;

  // =========================================================================
  // HOJA 5: EQUIPO PIE
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
  ws5.getCell('A2').value = 'RBD: 3887 - LICEO PUEBLO SECO | CO-DOCENCIA POR CICLO, RECURSOS Y EQUIPO MULTIPROFESIONAL';
  ws5.getCell('A2').font = fontSubtitle;
  ws5.getCell('A2').fill = fillSubHeader;
  ws5.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
  ws5.getRow(2).height = 20;

  // SECCIÓN 1: EDUCADORAS
  ws5.getCell('A4').value = 'SECCIÓN A: DOCENTES DE EDUCACIÓN DIFERENCIAL (CO-DOCENCIA Y AULA DE RECURSOS)';
  ws5.getCell('A4').font = fontBold;
  ws5.mergeCells('A4:K4');

  const pieDocHeaders = [
    'N°', 'RUN / RUT', 'Nombres y Apellidos', 'Hrs Contrato PIE',
    'Hrs Co-docencia Aula', 'Hrs Aula de Recursos', 'Hrs Planificación Colab.', 'Total Hrs Asignadas', 'Cursos y Ciclos Focalizados', 'Financiamiento', 'Estado Cuadratura'
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
    [1, '15.111.222-3', 'TOLEDO MORAGA, ANDREA SOLEDAD', 44, 20, 16, 8, { formula: 'SUM(E6:G6)' }, '1° Ciclo (1° y 2° Básico A)', 'Subvención PIE', '✓ Cuadrado'],
    [2, '16.222.333-4', 'URRUTIA PALMA, CARLA VALERIA', 44, 20, 16, 8, { formula: 'SUM(E7:G7)' }, '1° Ciclo (3° y 4° Básico A)', 'Subvención PIE', '✓ Cuadrado'],
    [3, '17.333.444-5', 'VALENZUELA TAPIA, FRANCISCA BELÉN', 44, 20, 16, 8, { formula: 'SUM(E8:G8)' }, '2° Ciclo (5° a 8° Básico A)', 'Subvención PIE', '✓ Cuadrado'],
    [4, '18.444.555-6', 'YÁÑEZ CASTRO, JOSÉ TOMÁS', 44, 20, 16, 8, { formula: 'SUM(E9:G9)' }, 'Enseñanza Media (1° a 4° TP)', 'Subvención PIE', '✓ Cuadrado']
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

  // SECCIÓN 2: PROFESIONALES DE APOYO
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
  ws6.getCell('A2').value = 'RBD: 3887 - LICEO PUEBLO SECO | DESGLOSE POR VÍA DE FINANCIAMIENTO Y ESTAMENTO';
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
  // HOJA 7: PARÁMETROS Y TABLAS NORMATIVAS (CON TABLAS 60/40 Y 65/35)
  // =========================================================================
  const ws7 = wb.addWorksheet('7. Parametros y Tablas', {
    views: [{ showGridLines: true }],
    properties: { tabColor: { argb: '64748B' } }
  });

  ws7.mergeCells('A1:J1');
  ws7.getCell('A1').value = 'PARÁMETROS NORMATIVOS Y TABLAS OFICIALES DE CONVERSIÓN MINEDUC (LEY 20.903)';
  ws7.getCell('A1').font = fontTitle;
  ws7.getCell('A1').fill = fillNavy;
  ws7.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  ws7.getRow(1).height = 28;

  // Asignaturas
  ws7.getCell('A3').value = 'ASIGNATURAS MINEDUC';
  ws7.getCell('A3').font = fontHeader;
  ws7.getCell('A3').fill = fillSubHeader;
  const asignaturas = [
    'Educación Parvularia', 'Lengua y Literatura', 'Matemática', 'Ciencias Naturales',
    'Historia, Geografía y Cs. Sociales', 'Idioma Extranjero Inglés', 'Educación Física y Salud',
    'Artes Visuales', 'Música', 'Tecnología', 'Orientación', 'Religión', 'Filosofía',
    'Educación Ciudadana', 'Ciencias para la Ciudadanía', 'Diferenciado TP Agropecuaria',
    'Talleres JECD Libre Disposición'
  ];
  asignaturas.forEach((asig, i) => {
    ws7.getCell(4 + i, 1).value = asig;
    ws7.getCell(4 + i, 1).border = borderThin;
  });

  // Cargos Canónicos DEP
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

  // Tabla 60/40
  ws7.getCell('E3').value = 'TABLA 60/40 (PARV. Y 1° CICLO)';
  ws7.getCell('E3').font = fontHeader;
  ws7.getCell('E3').fill = fillTramo60;
  ws7.getCell('F3').value = 'HRS AULA';
  ws7.getCell('F3').font = fontHeader;
  ws7.getCell('F3').fill = fillTramo60;

  const t6040 = [
    [44, 26.4], [42, 25.2], [40, 24.0], [38, 22.8],
    [36, 21.6], [34, 20.4], [32, 19.2], [30, 18.0],
    [28, 16.8], [26, 15.6], [24, 14.4], [22, 13.2]
  ];
  t6040.forEach((row, i) => {
    ws7.getCell(4 + i, 5).value = `${row[0]} hrs contrato`;
    ws7.getCell(4 + i, 6).value = row[1];
    [5, 6].forEach(c => ws7.getCell(4 + i, c).border = borderThin);
  });

  // Tabla 65/35
  ws7.getCell('H3').value = 'TABLA 65/35 (2° CICLO Y MEDIA)';
  ws7.getCell('H3').font = fontHeader;
  ws7.getCell('H3').fill = fillTramo65;
  ws7.getCell('I3').value = 'HRS AULA';
  ws7.getCell('I3').font = fontHeader;
  ws7.getCell('I3').fill = fillTramo65;

  const t6535 = [
    [44, 28.6], [42, 27.3], [40, 26.0], [38, 24.7],
    [36, 23.4], [34, 22.1], [32, 20.8], [30, 19.5],
    [28, 18.2], [26, 16.9], [24, 15.6], [22, 14.3]
  ];
  t6535.forEach((row, i) => {
    ws7.getCell(4 + i, 8).value = `${row[0]} hrs contrato`;
    ws7.getCell(4 + i, 9).value = row[1];
    [8, 9].forEach(c => ws7.getCell(4 + i, c).border = borderThin);
  });

  ws7.getColumn(1).width = 32;
  ws7.getColumn(2).width = 4;
  ws7.getColumn(3).width = 34;
  ws7.getColumn(4).width = 4;
  ws7.getColumn(5).width = 18;
  ws7.getColumn(6).width = 14;
  ws7.getColumn(7).width = 4;
  ws7.getColumn(8).width = 18;
  ws7.getColumn(9).width = 14;

  const outputPath = path.resolve('Plantilla_Maestra_Dotacion_Escolar_2027_v2_Multitramo.xlsx');
  await wb.xlsx.writeFile(outputPath);
  console.log('ARCHIVO V2 CREADO CON ÉXITO EN:', outputPath);
}

createPlantillaMaestraV2().catch(err => {
  console.error('ERROR AL CREAR ARCHIVO V2:', err);
  process.exit(1);
});
