import ExcelJS from 'exceljs';
import {
  DiagnosticoColegioCompleto,
  consolidarCarteraTerritorial,
  obtenerDocentesConsolidadosTerritorio,
  obtenerAsistentesConsolidadosTerritorio
} from './dotacionCalculationService';
import { Establecimiento, Docente, AsignacionHoraria, CursoSae, AsistenteEducacion } from '../types';

/**
 * Genera el archivo Excel corporativo oficial para el SLEP Valle Diguillín
 * Compatible con Microsoft Excel en Español (fórmulas SUMA, SI, BUSCARV).
 */
export async function generarExcelConsolidadoSlep(
  establecimientos: Establecimiento[],
  docentes: Docente[],
  diagnosticos: DiagnosticoColegioCompleto[],
  asesorNombre: string = 'UATP SLEP Valle Diguillín',
  asignaciones: AsignacionHoraria[] = [],
  cursos: CursoSae[] = [],
  asistentes: AsistenteEducacion[] = []
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

  // Precomputar resumen de Asistentes de la Educación activos por RBD
  const asistentesPorRbd = new Map<string, { count: number; horas: number }>();
  for (const a of asistentes) {
    if (a.activo === false) continue;
    const rbdKey = String(a.rbd);
    const prev = asistentesPorRbd.get(rbdKey) || { count: 0, horas: 0 };
    prev.count += 1;
    prev.horas += Number(a.horasContrato || 0);
    asistentesPorRbd.set(rbdKey, prev);
  }

  // ===========================================================================
  // HOJA 1: RESUMEN TERRITORIAL
  // ===========================================================================
  const wsResumen = workbook.addWorksheet('Resumen Territorial SLEP', {
    views: [{ showGridLines: true }]
  });

  wsResumen.mergeCells('A1:K1');
  const titleCell = wsResumen.getCell('A1');
  titleCell.value = 'SERVICIO LOCAL DE EDUCACIÓN PÚBLICA VALLE DIGUILLÍN';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = headerFill;
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(1).height = 30;

  wsResumen.mergeCells('A2:K2');
  const subCell = wsResumen.getCell('A2');
  subCell.value = `INFORME CONSOLIDADO DE MATRIZ DE DOTACIÓN DOCENTE, ASISTENTES Y CAPACIDAD SAE - ASESORÍA UATP (${new Date().toLocaleDateString('es-CL')})`;
  subCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FFFFFF' } };
  subCell.fill = titleFill;
  subCell.alignment = { horizontal: 'center', vertical: 'middle' };
  wsResumen.getRow(2).height = 22;

  // Encabezados
  const headersResumen = [
    'RBD', 'Establecimiento', 'Comuna', 'Régimen', 'Matrícula Proy.', 'Cupo SAE',
    'Horas Curriculares', 'Horas Docentes Disp.', 'Balance (Superávit/Déficit)',
    'Asistentes (N°)', 'Horas Asistentes'
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
    const asisRbd = asistentesPorRbd.get(String(bg.rbd)) || { count: 0, horas: 0 };
    row.values = [
      bg.rbd,
      bg.nombre,
      bg.comuna,
      diag.establecimiento.regimen,
      bg.totalMatriculaProyectada,
      bg.totalCuposSae,
      bg.horasAulaDemandadasCurriculo,
      bg.horasLectivasDisponibles,
      bg.superavitDeficitLectivo,
      asisRbd.count,
      asisRbd.horas
    ];

    // Formato de celdas
    for (let col = 1; col <= 11; col++) {
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
  totalRow.getCell(10).value = { formula: `SUM(J5:J${rowIdx - 1})` };
  totalRow.getCell(11).value = { formula: `SUM(K5:K${rowIdx - 1})` };

  for (let c = 1; c <= 11; c++) {
    const cell = totalRow.getCell(c);
    cell.border = { top: { style: 'double' }, bottom: { style: 'double' } };
    cell.font = { bold: true };
    if (c >= 5) cell.alignment = { horizontal: 'right' };
  }

  wsResumen.columns = [
    { width: 10 }, { width: 35 }, { width: 18 }, { width: 12 },
    { width: 16 }, { width: 14 }, { width: 18 }, { width: 20 }, { width: 24 },
    { width: 16 }, { width: 18 }
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
      const excedeSae = ev.estadoAforo === 'EXCEDE_SAE' || (ev.cupoDeclaradoSae > 0 && ev.matriculaProyectada > ev.cupoDeclaradoSae);
      row.values = [
        diag.establecimiento.rbd,
        diag.establecimiento.nombre,
        ev.cursoNombre,
        ev.salaAsignada,
        ev.superficieM2,
        ev.aforoMaximoFisico,
        ev.cupoDeclaradoSae,
        ev.matriculaProyectada,
        excedeSae
          ? 'EXCEDE CUPO SAE'
          : ev.estadoAforo === 'SUBUTILIZADO'
            ? 'SUBUTILIZADO'
            : ev.estadoAforo === 'ALERTA_SOBRECUPO_FISICO'
              ? 'AFORO NO EVALUADO'
              : 'CONFORME A NORMA'
      ];

      for (let col = 1; col <= 9; col++) {
        const c = row.getCell(col);
        c.border = borderStyle;
        if (col === 9 && excedeSae) {
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

  const headersIncons = ['Tipo Alerta', 'RUN Funcionario', 'Nombre Funcionario', 'Horas Totales', 'Detalle Escuelas'];
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

  const asistentesTerritorio = obtenerAsistentesConsolidadosTerritorio(establecimientos, asistentes);
  for (const asis of asistentesTerritorio) {
    if (!asis.excedeLimiteSlep) continue;
    const row = wsCruces.getRow(rInc);
    row.values = [
      'EXCESO_JORNADA_ASISTENTE',
      asis.run,
      `${asis.nombres} ${asis.apellidos}`.trim(),
      asis.horasTotalesSlep,
      asis.contratos.map(c => `${c.colegio.nombre} (${c.horasContrato}h)`).join(' + ')
    ];
    for (let c = 1; c <= 5; c++) {
      const cell = row.getCell(c);
      cell.border = borderStyle;
      if (c === 1 || c === 4) {
        cell.font = { color: { argb: 'DC2626' }, bold: true };
      }
    }
    rInc++;
  }

  wsCruces.columns = [
    { width: 24 }, { width: 16 }, { width: 26 }, { width: 14 }, { width: 45 }
  ];

  // ===========================================================================
  // HOJA 5: NÓMINA DOCENTE TERRITORIAL & FINANCIAMIENTO (SUBV. GENERAL / SEP / PIE)
  // ===========================================================================
  const docentesTerritorio = obtenerDocentesConsolidadosTerritorio(establecimientos, docentes, asignaciones, cursos);
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

  // ===========================================================================
  // HOJA 6: NÓMINA DE ASISTENTES DE LA EDUCACIÓN (DETALLE POR ESTABLECIMIENTO)
  // ===========================================================================
  const estMap = new Map<string, Establecimiento>(establecimientos.map(e => [String(e.rbd), e]));
  const asistentesActivos = asistentes.filter(a => a.activo !== false);

  const wsAsistentes = workbook.addWorksheet('Nómina Asistentes (Detalle)', {
    views: [{ showGridLines: true }]
  });

  const headersAsis = [
    'RBD', 'Colegio', 'RUN', 'Nombres y Apellidos', 'Estamento', 'Cargo / Función',
    'Total Contrato (hrs)',
    'Subv. Gen. Indef.', 'Subv. Gen. Plazo Fijo',
    'SEP Indef.', 'SEP Plazo Fijo',
    'PIE Indef.', 'PIE Plazo Fijo',
    'Honorarios', 'Pro-Retención',
    'Clasificación / Flags', 'Estado Contrato'
  ];
  wsAsistentes.getRow(1).values = headersAsis;
  wsAsistentes.getRow(1).height = 25;
  headersAsis.forEach((_, idx) => {
    const c = wsAsistentes.getRow(1).getCell(idx + 1);
    c.fill = headerFill;
    c.font = headerFont;
    c.alignment = { horizontal: 'center', vertical: 'middle' };
    c.border = borderStyle;
  });

  let rAsis = 2;
  for (const a of asistentesActivos) {
    const est = estMap.get(String(a.rbd));
    const subInd = Number(a.horasSubvencionGeneralIndefinido || 0);
    const subPf = Number(a.horasSubvencionGeneralPlazoFijo || 0);
    const sepInd = Number(a.horasSepIndefinido || 0);
    const sepPf = Number(a.horasSepPlazoFijo || 0);
    const pieInd = Number(a.horasPieIndefinido || 0);
    const piePf = Number(a.horasPiePlazoFijo || 0);
    const hon = Number(a.horasHonorarios || 0);
    const proRet = Number(a.horasProRetencion || 0);
    const horasContrato = Number(a.horasContrato || 0);

    const flags: string[] = [];
    if (a.esDuplaPsicosocial) flags.push('Dupla Psicosocial');
    if (a.esEquipoPie || pieInd + piePf > 0) flags.push('Equipo PIE');
    if (a.esTecnicoParvulo) flags.push('Técnico Párvulo');
    if (a.esAuxiliarServicio) flags.push('Auxiliar Servicio');
    if (a.esInspectorPatio) flags.push('Inspector Patio');
    if (a.esVtf) flags.push('VTF');

    const estadoContrato = horasContrato > 44
      ? `EXCESO (+${horasContrato - 44}h)`
      : horasContrato <= 0
        ? 'SIN HORAS'
        : 'CONFORME (≤44h)';

    const row = wsAsistentes.getRow(rAsis);
    row.values = [
      a.rbd,
      est ? est.nombre : `RBD ${a.rbd}`,
      a.run,
      `${a.apellidos}, ${a.nombres}`.trim().replace(/^,\s*/, ''),
      a.estamento,
      a.cargoFuncion || '',
      horasContrato,
      subInd,
      subPf,
      sepInd,
      sepPf,
      pieInd,
      piePf,
      hon,
      proRet,
      flags.join(', ') || 'Estándar',
      estadoContrato
    ];

    for (let col = 1; col <= 17; col++) {
      const c = row.getCell(col);
      c.border = borderStyle;
      if (col >= 7 && col <= 15) {
        c.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      if (col === 17 && horasContrato > 44) {
        c.font = { color: { argb: 'DC2626' }, bold: true };
      }
    }
    rAsis++;
  }

  if (rAsis > 2) {
    const totalAsisRow = wsAsistentes.getRow(rAsis);
    totalAsisRow.getCell(2).value = 'TOTAL ASISTENTES DE LA EDUCACIÓN';
    totalAsisRow.getCell(2).font = { bold: true };
    const colsSum = ['G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O'];
    colsSum.forEach((colLetter, i) => {
      totalAsisRow.getCell(7 + i).value = { formula: `SUM(${colLetter}2:${colLetter}${rAsis - 1})` };
    });
    for (let c = 1; c <= 17; c++) {
      const cell = totalAsisRow.getCell(c);
      cell.border = { top: { style: 'double' }, bottom: { style: 'double' } };
      cell.font = { bold: true };
      if (c >= 7 && c <= 15) cell.alignment = { horizontal: 'right' };
    }
  }

  wsAsistentes.columns = [
    { width: 10 }, { width: 32 }, { width: 15 }, { width: 28 }, { width: 22 }, { width: 28 },
    { width: 18 },
    { width: 16 }, { width: 18 },
    { width: 12 }, { width: 14 },
    { width: 12 }, { width: 14 },
    { width: 13 }, { width: 14 },
    { width: 28 }, { width: 20 }
  ];

  // ===========================================================================
  // HOJA 7: NÓMINA ASISTENTES TERRITORIAL & FINANCIAMIENTO (LEY 21.109)
  // ===========================================================================
  const wsAsisTerritorial = workbook.addWorksheet('Nómina Asistentes Territorial', {
    views: [{ showGridLines: true }]
  });

  wsAsisTerritorial.mergeCells('A1:N1');
  const tAsis = wsAsisTerritorial.getCell('A1');
  tAsis.value = 'NÓMINA CONSOLIDADA DE ASISTENTES DE LA EDUCACIÓN, ESTABLECIMIENTOS Y FUENTES DE FINANCIAMIENTO';
  tAsis.font = headerFont;
  tAsis.fill = headerFill;
  tAsis.alignment = { horizontal: 'center' };

  const headersAsisTerritorial = [
    'RUN',
    'Nombres y Apellidos',
    'Estamento Principal',
    'Cargos / Funciones',
    'Establecimientos Asignados',
    'Horas Totales SLEP',
    'Indefinido (hrs)',
    'Plazo Fijo (hrs)',
    'Subv. General (hrs)',
    'SEP (hrs)',
    'PIE (hrs)',
    'Honorarios (hrs)',
    'Pro-Retención (hrs)',
    'Estado Legal (≤44h)'
  ];
  wsAsisTerritorial.getRow(3).values = headersAsisTerritorial;
  headersAsisTerritorial.forEach((_, idx) => {
    const c = wsAsisTerritorial.getRow(3).getCell(idx + 1);
    c.fill = titleFill;
    c.font = headerFont;
    c.border = borderStyle;
  });

  let rAsisTer = 4;
  for (const asis of asistentesTerritorio) {
    const row = wsAsisTerritorial.getRow(rAsisTer);
    const detalleColegios = asis.contratos
      .map(c => `${c.colegio.nombre} (${c.horasContrato}h)`)
      .join('; ');
    const estado = asis.excedeLimiteSlep
      ? `EXCESO (+${asis.excesoHorasSlep}h)`
      : 'CONFORME (≤44h)';

    row.values = [
      asis.run,
      `${asis.nombres} ${asis.apellidos}`.trim(),
      asis.estamentoPrincipal,
      asis.cargosPrincipales.join(', '),
      detalleColegios,
      asis.horasTotalesSlep,
      asis.resumenFinanciamiento.indefinido,
      asis.resumenFinanciamiento.plazoFijo,
      asis.resumenFinanciamiento.subvencionGeneral,
      asis.resumenFinanciamiento.sep,
      asis.resumenFinanciamiento.pie,
      asis.resumenFinanciamiento.honorarios,
      asis.resumenFinanciamiento.proRetencion,
      estado
    ];

    for (let c = 1; c <= 14; c++) {
      const cell = row.getCell(c);
      cell.border = borderStyle;
      if (c >= 6 && c <= 13) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      }
      if (c === 14 && asis.excedeLimiteSlep) {
        cell.font = { color: { argb: 'DC2626' }, bold: true };
      }
    }
    rAsisTer++;
  }

  wsAsisTerritorial.columns = [
    { width: 15 }, { width: 30 }, { width: 20 }, { width: 28 }, { width: 45 },
    { width: 18 }, { width: 16 }, { width: 16 }, { width: 18 }, { width: 14 },
    { width: 14 }, { width: 16 }, { width: 18 }, { width: 22 }
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
    if (typeof (navigator as any) !== 'undefined' && (navigator as any).msSaveOrOpenBlob) {
      return (navigator as any).msSaveOrOpenBlob(blob, defaultFilename);
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = defaultFilename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
      } catch (_) {}
    }, 2500);
    return true;
  }
  return false;
}

