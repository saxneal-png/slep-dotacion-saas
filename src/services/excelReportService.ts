import ExcelJS from 'exceljs';
import {
  DiagnosticoColegioCompleto,
  consolidarCarteraTerritorial,
  obtenerDocentesConsolidadosTerritorio
} from './dotacionCalculationService';
import { Establecimiento, Docente, AsignacionHoraria } from '../types';

/**
 * Genera el archivo Excel corporativo oficial para el SLEP Valle Diguillín
 * Compatible con Microsoft Excel en Español (fórmulas SUMA, SI, BUSCARV).
 */
export async function generarExcelConsolidadoSlep(
  establecimientos: Establecimiento[],
  docentes: Docente[],
  diagnosticos: DiagnosticoColegioCompleto[],
  asesorNombre: string = 'UATP SLEP Valle Diguillín',
  asignaciones: AsignacionHoraria[] = []
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SLEP Valle Diguillín - Sistema de Dotación Docente';
  workbook.lastModifiedBy = asesorNombre;
  workbook.created = new Date();
  workbook.modified = new Date();

  // Estilos de cabecera institucional
  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '002B49' } // Azul Institucional SLEP
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 11,
    bold: true,
    color: { argb: 'FFFFFF' }
  };

  const titleFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '004B7A' }
  };

  const borderStyle: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'CBD5E1' } },
    left: { style: 'thin', color: { argb: 'CBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    right: { style: 'thin', color: { argb: 'CBD5E1' } }
  };

  // ===========================================================================
  // HOJA 1: RESUMEN TERRITORIAL
  // ===========================================================================
  const wsResumen = workbook.addWorksheet('Resumen Territorial SLEP', {
    views: [{ showGridLines: true }]
  });

  wsResumen.mergeCells('A1:G1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = 'SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = headerFill;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(1).height = 30;

  wsResumen.mergeCells('A2:G2');
  const subCell = wsResumen.getCell('A2');
  subCell.value = `INFORME CONSOLIDADO DE MATRIZ DE DOTACIÓN DOCENTE Y CAPACIDAD SAE - ASESORÍA UATP (${new Date().toLocaleDateString('es-CL')})`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFFFFF' } };
  subCell.fill = titleFill;
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(2).height = 22;

  // Encabezados
  const headersResumen = [
    'RBD', 'Establecimiento', 'Comuna', 'Régimen', 'Matrícula Proy.', 'Cupo SAE',
    'Horas Curriculares', 'Horas Docentes Disp.', 'Balance (Superávit/Déficit)'
  ];
  wsResumen.getRow(4).values = headersResumen;
  wsResumen.getRow(4).height = 25;

  headersResumen.forEach((_, idx) => {
    const cell = wsResumen.getRow(4).getCell(idx + 1);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = borderStyle;
  });

  let rowIdx = 5;
  for (const diag of diagnosticos) {
    const row = wsResumen.getRow(rowIdx);
    const bg = diag.balanzaGeneral;
    row.values = [
      bg.rbd,
      bg.nombre,
      bg.comuna,
      diag.establecimiento.regimen,
      bg.totalMatriculaProyectada,
      bg.totalCuposSae,
      bg.horasAulaDemandadasCurriculo,
      bg.horasLectivasDisponibles,
      bg.superavitDeficitLectivo
    ];

    // Formato de celdas
    for (let col = 1; col <= 9; col++) {
      const c = row.getCell(col);
      c.border = borderStyle;
      if (col >= 5) c.alignment = { horizontal: 'right', vertical: 'middle' };
      if (col === 9) {
        if (bg.superavitDeficitLectivo < 0) {
          c.font = { color: { argb: 'DC2626' }, bold: true }; // Rojo para déficit
        } else {
          c.font = { color: { argb: '16A34A' }, bold: true }; // Verde para superávit
        }
      }
    }
    rowIdx++;
  }

  // Fila de Totales con fórmula SUMA en español
  const totalRow = wsResumen.getRow(rowIdx);
  totalRow.getCell(2).value = 'TOTAL CONSOLIDADO TERRITORIAL';
  totalRow.getCell(2).font = { bold: true };
  totalRow.getCell(5).value = { formula: `SUM(E5:E${rowIdx - 1})` };
  totalRow.getCell(6).value = { formula: `SUM(F5:F${rowIdx - 1})` };
  totalRow.getCell(7).value = { formula: `SUM(G5:G${rowIdx - 1})` };
  totalRow.getCell(8).value = { formula: `SUM(H5:H${rowIdx - 1})` };
  totalRow.getCell(9).value = { formula: `SUM(I5:I${rowIdx - 1})` };

  for (let c = 1; c <= 9; c++) {
    const cell = totalRow.getCell(c);
    cell.border = { top: { style: 'double' }, bottom: { style: 'double' } };
    cell.font = { bold: true };
    if (c >= 5) cell.alignment = { horizontal: 'right' };
  }

  wsResumen.columns = [
    { width: 10 }, { width: 35 }, { width: 18 }, { width: 12 },
    { width: 16 }, { width: 14 }, { width: 18 }, { width: 20 }, { width: 24 }
  ];

  // ===========================================================================
  // HOJA 2: NÓMINA DE DOCENTES Y AUDITORÍA DE SOBREASIGNACIÓN (LEY 20.903)
  // ===========================================================================
  const wsDocentes = workbook.addWorksheet('Nómina Docente y Ley 20.903', {
    views: [{ showGridLines: true }]
  });

  const headersDoc = [
    'RBD', 'Colegio', 'RUN Docente', 'Nombres y Apellidos', 'Calidad Jurídica', 'Estamento',
    'Total Contrato (hrs)',
    'Subv. Gen. Titular', 'Subv. Gen. Contrata',
    'SEP Titular', 'SEP Contrata',
    'PIE Titular', 'PIE Contrata',
    'Horas Aula Regular (HA)', 'Horas Co-Docencia (HA)', 'Horas Taller SEP (HA)', 'Horas Trabajo Colaborativo (HA)', 'Horas No Aula (hrs)',
    'Máx. Horas Aula Permitidas (HA)', 'Estado Ley 20.903'
  ];
  wsDocentes.getRow(1).values = headersDoc;
  wsDocentes.getRow(1).height = 25;
  headersDoc.forEach((_, idx) => {
    const c = wsDocentes.getRow(1).getCell(idx + 1);
    c.fill = headerFill;
    c.font = headerFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderStyle;
  });

  let rDoc = 2;
  for (const diag of diagnosticos) {
    for (const dState of diag.estadoDocentes) {
      const d = dState.docente;
      const subTit = Number(d.horasSubvencionGeneralTitular || 0);
      const subCon = Number(d.horasSubvencionGeneralContrata || 0);
      const sepTit = Number(d.horasSepTitular || 0);
      const sepCon = Number(d.horasSepContrata || 0);
      const pieTit = Number(d.horasPieTitular || 0);
      const pieCon = Number(d.horasPieContrata || 0);

      const hNoAula = (d.horasDirectivas || 0) + (d.horasInspectorGeneral || 0) + (d.horasTecnicoPedagogicas || 0) + (d.horasCoordinacion || 0);

      const row = wsDocentes.getRow(rDoc);
      row.values = [
        diag.establecimiento.rbd,
        diag.establecimiento.nombre,
        d.run,
        `${d.apellidos}, ${d.nombres}`,
        d.calidadJuridica,
        d.estamento,
        d.horasContrato,
        subTit,
        subCon,
        sepTit,
        sepCon,
        pieTit,
        pieCon,
        dState.horasAulaRegular !== undefined ? dState.horasAulaRegular : dState.horasPedagogicasAsignadas,
        dState.horasCoDocencia || 0,
        dState.horasTallerSep || (d.horasTallerSep || 0),
        dState.horasTrabajoColaborativo || (d.horasTrabajoColaborativo || 0),
        hNoAula,
        dState.horasLectivasMaximas,
        dState.estaSobreasignado
          ? `SOBREASIGNADO (+${dState.excesoHoras}h)`
          : dState.horasVacantes > 0
            ? `DISPONIBLE (${dState.horasVacantes}h vacantes)`
            : 'CARGA COMPLETA (100%)'
      ];

      for (let col = 1; col <= 20; col++) {
        const c = row.getCell(col);
        c.border = borderStyle;
        if (col === 20) {
          if (dState.estaSobreasignado) {
            c.font = { color: { argb: 'DC2626' }, bold: true };
          } else if (dState.horasVacantes > 0) {
            c.font = { color: { argb: '2563EB' } };
          }
        }
      }
      rDoc++;
    }
  }

  wsDocentes.columns = [
    { width: 10 }, { width: 30 }, { width: 15 }, { width: 28 }, { width: 16 }, { width: 22 },
    { width: 18 },
    { width: 16 }, { width: 16 },
    { width: 14 }, { width: 14 },
    { width: 14 }, { width: 14 },
    { width: 20 }, { width: 18 }, { width: 18 }, { width: 22 }, { width: 18 },
    { width: 24 }, { width: 26 }
  ];

  // ===========================================================================
  // HOJA 3: CRUCE DE CAPACIDAD DE SALAS E INFRAESTRUCTURA (SAE)
  // ===========================================================================
  const wsSalas = workbook.addWorksheet('Salas, Aforo y SAE', {
    views: [{ showGridLines: true }]
  });

  const headersSalas = [
    'RBD', 'Colegio', 'Curso / Nivel', 'Sala Asignada', 'Superficie (m²)',
    'Aforo Físico Normativo', 'Cupo SAE Declarado', 'Matrícula Proyectada', 'Diagnóstico Aforo'
  ];
  wsSalas.getRow(1).values = headersSalas;
  wsSalas.getRow(1).height = 25;
  headersSalas.forEach((_, idx) => {
    const c = wsSalas.getRow(1).getCell(idx + 1);
    c.fill = headerFill;
    c.font = headerFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderStyle;
  });

  let rSalas = 2;
  for (const diag of diagnosticos) {
    for (const ev of diag.evaluacionesSalasSae) {
      const row = wsSalas.getRow(rSalas);
      row.values = [
        diag.establecimiento.rbd,
        diag.establecimiento.nombre,
        ev.cursoNombre,
        ev.salaAsignada,
        ev.superficieM2,
        ev.aforoMaximoFisico,
        ev.cupoDeclaradoSae,
        ev.matriculaProyectada,
        ev.estadoAforo === 'ALERTA_SOBRECUPO_FISICO'
          ? 'HACINAMIENTO FÍSICO'
          : ev.estadoAforo === 'EXCEDE_SAE'
            ? 'EXCEDE CUPO SAE'
            : ev.estadoAforo === 'SUBUTILIZADO'
              ? 'SUBUTILIZADO'
              : 'CONFORME A NORMA'
      ];

      for (let col = 1; col <= 9; col++) {
        const c = row.getCell(col);
        c.border = borderStyle;
        if (col === 9 && (ev.estadoAforo === 'ALERTA_SOBRECUPO_FISICO' || ev.estadoAforo === 'EXCEDE_SAE')) {
          c.font = { color: { argb: 'DC2626' }, bold: true };
        }
      }
      rSalas++;
    }
  }

  wsSalas.columns = [
    { width: 10 }, { width: 30 }, { width: 18 }, { width: 24 }, { width: 16 },
    { width: 22 }, { width: 18 }, { width: 20 }, { width: 24 }
  ];

  // ===========================================================================
  // HOJA 4: AUDITORÍA CRUZADA TERRITORIAL (VACANTES Y RUTS DUPLICADOS)
  // ===========================================================================
  const consolidacion = consolidarCarteraTerritorial(establecimientos, docentes, diagnosticos);
  const wsCruces = workbook.addWorksheet('Inconsistencias y Vacantes Cruzadas', {
    views: [{ showGridLines: true }]
  });

  wsCruces.mergeCells('A1:E1');
  const tIncons = wsCruces.getCell('A1');
  tIncons.value = 'ALERTAS DE SOBRECARGA HORARIA O DUPLICIDAD CRUZADA ENTRE ESCUELAS';
  tIncons.font = headerFont;
  tIncons.fill = headerFill;
  tIncons.alignment = { horizontal: 'center' };

  const headersIncons = ['Tipo Alerta', 'RUN Docente', 'Nombre Docente', 'Horas Totales', 'Detalle Escuelas'];
  wsCruces.getRow(3).values = headersIncons;
  headersIncons.forEach((_, idx) => {
    const c = wsCruces.getRow(3).getCell(idx + 1);
    c.fill = titleFill;
    c.font = headerFont;
    c.border = borderStyle;
  });

  let rInc = 4;
  for (const inc of consolidacion.inconsistencias) {
    const row = wsCruces.getRow(rInc);
    row.values = [
      inc.tipo,
      inc.run,
      inc.docenteNombre,
      inc.horasTotalesSumadas,
      inc.colegiosInvolucrados.join(' + ')
    ];
    for (let c = 1; c <= 5; c++) {
      row.getCell(c).border = borderStyle;
    }
    rInc++;
  }

  wsCruces.columns = [
    { width: 24 }, { width: 16 }, { width: 26 }, { width: 14 }, { width: 45 }
  ];

  // ===========================================================================
  // HOJA 5: NÓMINA DOCENTE TERRITORIAL & FINANCIAMIENTO (SUBV. GENERAL / SEP / PIE)
  // ===========================================================================
  const docentesTerritorio = obtenerDocentesConsolidadosTerritorio(establecimientos, docentes, asignaciones);
  const wsNominaTerritorial = workbook.addWorksheet('Nómina Docente Territorial', {
    views: [{ showGridLines: true }]
  });

  wsNominaTerritorial.mergeCells('A1:J1');
  const tDoc = wsNominaTerritorial.getCell('A1');
  tDoc.value = 'NÓMINA CONSOLIDADA DE DOCENTES, ESTABLECIMIENTOS Y FUENTES DE FINANCIAMIENTO';
  tDoc.font = headerFont;
  tDoc.fill = headerFill;
  tDoc.alignment = { horizontal: 'center' };

  const headersNomina = [
    'RUN',
    'Nombres y Apellidos',
    'Estamento',
    'Establecimientos Asignados',
    'Horas Totales SLEP',
    'Horas Aula (HA)',
    'Subv. General (hrs)',
    'SEP (hrs)',
    'PIE (hrs)',
    'Estado Legal (≤44h)'
  ];
  wsNominaTerritorial.getRow(3).values = headersNomina;
  headersNomina.forEach((_, idx) => {
    const c = wsNominaTerritorial.getRow(3).getCell(idx + 1);
    c.fill = titleFill;
    c.font = headerFont;
    c.border = borderStyle;
  });

  let rNomina = 4;
  for (const doc of docentesTerritorio) {
    const row = wsNominaTerritorial.getRow(rNomina);
    const detalleColegios = doc.contratos.map(c => `${c.colegio.nombre} (${c.docente.horasContrato}h - ${c.regimen})`).join('; ');
    const estado = doc.excedeLimiteSlep ? `EXCESO (+${doc.excesoHorasSlep}h)` : 'CONFORME (≤44h)';

    row.values = [
      doc.run,
      `${doc.nombres} ${doc.apellidos}`,
      doc.estamentoPrincipal,
      detalleColegios,
      doc.horasTotalesSlep,
      doc.totalHorasPedagogicasAula,
      doc.resumenFinanciamiento.subvencionGeneral,
      doc.resumenFinanciamiento.sep,
      doc.resumenFinanciamiento.pie,
      estado
    ];

    for (let c = 1; c <= 10; c++) {
      const cell = row.getCell(c);
      cell.border = borderStyle;
      if (c === 10 && doc.excedeLimiteSlep) {
        cell.font = { color: { argb: 'DC2626' }, bold: true };
      }
    }
    rNomina++;
  }

  wsNominaTerritorial.columns = [
    { width: 15 }, { width: 30 }, { width: 22 }, { width: 45 }, { width: 18 },
    { width: 16 }, { width: 18 }, { width: 14 }, { width: 14 }, { width: 22 }
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

/**
 * Guardado seguro con soporte para Electron Save Dialog nativo o descarga de navegador
 */
export async function guardarArchivoNativoOEnNavegador(
  data: Uint8Array | string,
  defaultFilename: string,
  mimeType: string = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  filters: { name: string; extensions: string[] }[] = [{ name: 'Libro de Excel (*.xlsx)', extensions: ['xlsx'] }]
): Promise<boolean> {
  const electron = (typeof window !== 'undefined' && (window as any).electronAPI);
  if (electron?.isDesktop && electron?.saveFileDialog && electron?.writeFile) {
    const filePath = await electron.saveFileDialog({
      defaultPath: defaultFilename,
      filters
    });
    if (!filePath) return false;
    const res = await electron.writeFile(filePath, data);
    if (!res.success) throw new Error(res.error);
    return true;
  } else if (typeof window !== 'undefined') {
    const blob = new Blob([data as any], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultFilename;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
  return false;
}

