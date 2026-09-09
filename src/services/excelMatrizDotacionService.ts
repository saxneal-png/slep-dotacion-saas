import ExcelJS from 'exceljs';
import { Establecimiento, Docente, CursoSae, AsignacionHoraria } from '../types';
import { obtenerTramoMineduc, RAW_65_35, RAW_60_40, parseHHMMToMinutes } from '@slep/mineduc-engine';

/**
 * Convierte un índice numérico de columna (1-based: 1=A, 2=B, etc.) a letra Excel (A, B, ..., Z, AA, AB, ...)
 */
export function getColumnLetter(colIndex: number): string {
  let temp = colIndex;
  let letter = '';
  while (temp > 0) {
    const mod = (temp - 1) % 26;
    letter = String.fromCharCode(65 + mod) + letter;
    temp = Math.floor((temp - mod) / 26);
  }
  return letter;
}

/**
 * Genera la etiqueta corta estándar de curso (ej: PkA, KB, 1A, 1B, 8C, 1MA, etc.)
 */
export function obtenerEtiquetaCortaCurso(nivel: string, letra: string): string {
  const l = (letra || 'A').toUpperCase().trim();
  const n = (nivel || '').trim().toLowerCase();

  if (n.includes('pre-k') || n.includes('nt1') || n.includes('pk') || n.includes('primer nivel de transición')) {
    return `Pk${l}`;
  }
  if (n.includes('kínder') || n.includes('kinder') || n.includes('nt2') || n.includes('segundo nivel de transición') || /^k\b/.test(n)) {
    return `K${l}`;
  }

  const mMedio = n.match(/([1-4])°?\s*(?:m|medio)/i);
  if (mMedio) {
    return `${mMedio[1]}M${l}`;
  }

  const mBasico = n.match(/([1-8])°?\s*(?:b|b[aá]sico)?/i);
  if (mBasico && parseInt(mBasico[1], 10) >= 1 && parseInt(mBasico[1], 10) <= 8) {
    return `${mBasico[1]}${l}`;
  }

  return `${nivel} ${letra}`.trim();
}

/**
 * Ordena cursos siguiendo la secuencia pedagógica chilena: Parvularia -> Básica -> Media -> EPJA / Otros
 */
export function ordenarCursosEstablecimiento(cursos: CursoSae[]): CursoSae[] {
  const pesoNivel = (nivel: string): number => {
    const n = (nivel || '').toLowerCase();
    if (n.includes('pre-k') || n.includes('nt1') || n.includes('pk')) return 10;
    if (n.includes('kínder') || n.includes('kinder') || n.includes('nt2') || /^k\b/.test(n)) return 20;
    const mBasico = n.match(/([1-8])°?\s*b/i) || n.match(/([1-8])°?/);
    if (mBasico && parseInt(mBasico[1], 10) >= 1 && parseInt(mBasico[1], 10) <= 8) {
      return 100 + parseInt(mBasico[1], 10) * 10;
    }
    const mMedio = n.match(/([1-4])°?\s*m/i);
    if (mMedio) return 300 + parseInt(mMedio[1], 10) * 10;
    return 500;
  };

  return [...cursos].sort((a, b) => {
    const pA = pesoNivel(a.nivel);
    const pB = pesoNivel(b.nivel);
    if (pA !== pB) return pA - pB;
    return (a.letra || 'A').localeCompare(b.letra || 'A');
  });
}

/**
 * Obtiene los minutos de recreo y horas no lectivas según el régimen y las horas de Subvención General
 */
function obtenerMinutosRecreoYHnl(horasSubGral: number, es6040: boolean): { recreoMinutos: number; hnlMinutos: number } {
  const horasEnteras = Math.round(horasSubGral);
  if (horasEnteras <= 0) {
    return { recreoMinutos: 0, hnlMinutos: 0 };
  }

  const rawLista = es6040 ? RAW_60_40 : RAW_65_35;
  const encontrado = rawLista.find(item => item.jornada === Math.min(44, Math.max(1, horasEnteras)));

  if (encontrado) {
    return {
      recreoMinutos: parseHHMMToMinutes(encontrado.recreo),
      hnlMinutos: parseHHMMToMinutes(encontrado.hnl)
    };
  }

  const tramo = obtenerTramoMineduc(horasEnteras, es6040 ? '60_40' : '65_35');
  if (tramo) {
    return {
      recreoMinutos: tramo.recreoMinutosCronologicos,
      hnlMinutos: tramo.noLectivasMinutosCronologicos
    };
  }

  // Fallback proporcional si está fuera del mapa 1-44
  const totalMin = horasSubGral * 60;
  const maxLectivo = totalMin * (es6040 ? 0.60 : 0.65);
  const recreo = Math.round(maxLectivo * (180 / 1710));
  const hnl = Math.max(0, totalMin - maxLectivo - recreo);
  return { recreoMinutos: recreo, hnlMinutos: hnl };
}

/**
 * Genera el archivo Excel oficial de la Matriz de Dotación por Escuela
 * con formato fiel al modelo SLEP Valle Diguillín y celdas horarias en [h]:mm.
 */
export async function generarExcelMatrizDotacionColegio(
  establecimiento: Establecimiento,
  docentes: Docente[],
  cursos: CursoSae[],
  asignaciones: AsignacionHoraria[]
): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SLEP Valle Diguillín - Sistema Consolidador de Dotación';
  workbook.lastModifiedBy = establecimiento.asesorUatp || 'UATP SLEP Valle Diguillín';
  workbook.created = new Date();
  workbook.modified = new Date();

  const sheetName = `RBD ${establecimiento.rbd}`.slice(0, 31);
  const ws = workbook.addWorksheet(sheetName, {
    views: [{ showGridLines: true }]
  });

  // Preparar y ordenar los cursos de la escuela
  let cursosOrdenados = ordenarCursosEstablecimiento(cursos.filter(c => c.rbd === establecimiento.rbd));
  if (cursosOrdenados.length === 0) {
    // Si no hay cursos registrados, intentar derivar cursos únicos desde las asignaciones
    const cursoIdsUnicos = new Set<string>();
    for (const a of asignaciones) {
      if (a.rbd === establecimiento.rbd && a.cursoId) {
        cursoIdsUnicos.add(a.cursoId);
      }
    }
    cursosOrdenados = Array.from(cursoIdsUnicos).map(cId => ({
      id: cId,
      rbd: establecimiento.rbd,
      nivel: cId,
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 30,
      alumnosNeet: 0,
      alumnosNeep: 0
    }));
    cursosOrdenados = ordenarCursosEstablecimiento(cursosOrdenados);
  }

  // Definición de columnas fijas y dinámicas
  // Col 1: Docente / Asignatura
  // Col 2: RUT
  // Col 3: HORAS CONTRATO
  // Col 4: TITULARES SUB GRAL
  // Col 5: CONTRATA SUB GRAL
  // Col 6: TITULARES SEP
  // Col 7: CONTRATA SEP
  // Col 8: TITULARES PIE
  // Col 9: CONTRATA PIE
  // Col 10 .. (9 + N): Cursos
  // Col (10 + N): TOTAL HA*
  // Col (11 + N): TOTAL HC** Sub. Gral
  // Col (12 + N): TOTAL HC** Sub. SEP
  // Col (13 + N): TOTAL HC** Sub. PIE
  // Col (14 + N): TOTAL HC

  const colIndexDocente = 1;
  const colIndexRut = 2;
  const colIndexContrato = 3;
  const colIndexTitSubGral = 4;
  const colIndexCttaSubGral = 5;
  const colIndexTitSep = 6;
  const colIndexCttaSep = 7;
  const colIndexTitPie = 8;
  const colIndexCttaPie = 9;

  const colIndexInicioCursos = 10;
  const numCursos = cursosOrdenados.length;
  const colIndexFinCursos = numCursos > 0 ? colIndexInicioCursos + numCursos - 1 : colIndexInicioCursos;

  const colIndexTotalHa = colIndexInicioCursos + numCursos;
  const colIndexTotalHcSubGral = colIndexTotalHa + 1;
  const colIndexTotalHcSubSep = colIndexTotalHa + 2;
  const colIndexTotalHcSubPie = colIndexTotalHa + 3;
  const colIndexTotalHc = colIndexTotalHa + 4;
  const totalColumnas = colIndexTotalHc;

  const colTotalHaLetter = getColumnLetter(colIndexTotalHa);
  const colSubGralLetter = getColumnLetter(colIndexTotalHcSubGral);
  const colSepLetter = getColumnLetter(colIndexTotalHcSubSep);
  const colPieLetter = getColumnLetter(colIndexTotalHcSubPie);
  const colTotalHcLetter = getColumnLetter(colIndexTotalHc);

  // Estilos
  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '000000' } // Negro sólido idéntico al modelo
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 8.5,
    bold: true,
    color: { argb: 'FFFFFF' }
  };

  const borderThin: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'D1D5DB' } },
    left: { style: 'thin', color: { argb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { argb: 'D1D5DB' } },
    right: { style: 'thin', color: { argb: 'D1D5DB' } }
  };

  const borderTotalRow: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: '000000' } },
    left: { style: 'thin', color: { argb: 'D1D5DB' } },
    bottom: { style: 'thin', color: { argb: '000000' } },
    right: { style: 'thin', color: { argb: 'D1D5DB' } }
  };

  // 1. Configuración de la Fila de Encabezado (Fila 1)
  const headerRow = ws.getRow(1);
  headerRow.height = 36;

  headerRow.getCell(colIndexDocente).value = '';
  headerRow.getCell(colIndexRut).value = '';
  headerRow.getCell(colIndexContrato).value = 'HORAS\nCONTRATO';
  headerRow.getCell(colIndexTitSubGral).value = 'TITULARES SUB\nGRAL';
  headerRow.getCell(colIndexCttaSubGral).value = 'CONTRATA SUB\nGRAL';
  headerRow.getCell(colIndexTitSep).value = 'TITULARES SEP';
  headerRow.getCell(colIndexCttaSep).value = 'CONTRATA SEP';
  headerRow.getCell(colIndexTitPie).value = 'TITULARES PIE';
  headerRow.getCell(colIndexCttaPie).value = 'CONTRATA\nPIE';

  // Encabezados de cursos
  cursosOrdenados.forEach((curso, idx) => {
    const colIdx = colIndexInicioCursos + idx;
    headerRow.getCell(colIdx).value = obtenerEtiquetaCortaCurso(curso.nivel, curso.letra);
  });

  headerRow.getCell(colIndexTotalHa).value = 'TOTAL HA*';
  headerRow.getCell(colIndexTotalHcSubGral).value = 'TOTAL HC** Sub.\nGral';
  headerRow.getCell(colIndexTotalHcSubSep).value = 'TOTAL HC** Sub.\nSEP';
  headerRow.getCell(colIndexTotalHcSubPie).value = 'TOTAL HC** Sub.\nPIE';
  headerRow.getCell(colIndexTotalHc).value = 'TOTAL HC';

  for (let c = 1; c <= totalColumnas; c++) {
    const cell = headerRow.getCell(c);
    cell.fill = headerFill;
    cell.font = headerFont;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: '374151' } },
      left: { style: 'thin', color: { argb: '374151' } },
      bottom: { style: 'thin', color: { argb: '374151' } },
      right: { style: 'thin', color: { argb: '374151' } }
    };
  }

  // Filtrar y ordenar docentes del colegio
  const docentesColegio = docentes
    .filter(d => d.rbd === establecimiento.rbd)
    .sort((a, b) => {
      const cmpApellidos = (a.apellidos || '').localeCompare(b.apellidos || '');
      if (cmpApellidos !== 0) return cmpApellidos;
      return (a.nombres || '').localeCompare(b.nombres || '');
    });

  const es6040 = (establecimiento.porcentajePrioritarios || 0) >= 80;

  let currentRowIdx = 2;

  // Renderizar cada bloque de docente
  for (const docente of docentesColegio) {
    const teacherStartRow = currentRowIdx;

    // 1. Fila Maestra del Docente (Nombre, RUN, Horas de contrato y desglose de financiamiento)
    const masterRow = ws.getRow(currentRowIdx);
    masterRow.height = 18;

    const nombreDocente = `${docente.apellidos || ''}, ${docente.nombres || ''}`.trim() || 'Docente';
    masterRow.getCell(colIndexDocente).value = nombreDocente;
    masterRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9, bold: true };
    masterRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

    masterRow.getCell(colIndexRut).value = docente.run || '';
    masterRow.getCell(colIndexRut).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexRut).font = { name: 'Calibri', size: 9 };

    masterRow.getCell(colIndexContrato).value = docente.horasContrato || null;
    masterRow.getCell(colIndexContrato).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexContrato).font = { name: 'Calibri', size: 9, bold: true };

    masterRow.getCell(colIndexTitSubGral).value = docente.horasSubvencionGeneralTitular || null;
    masterRow.getCell(colIndexTitSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexTitSubGral).font = { name: 'Calibri', size: 9 };

    masterRow.getCell(colIndexCttaSubGral).value = docente.horasSubvencionGeneralContrata || null;
    masterRow.getCell(colIndexCttaSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexCttaSubGral).font = { name: 'Calibri', size: 9 };

    masterRow.getCell(colIndexTitSep).value = docente.horasSepTitular || null;
    masterRow.getCell(colIndexTitSep).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexTitSep).font = { name: 'Calibri', size: 9 };

    masterRow.getCell(colIndexCttaSep).value = docente.horasSepContrata || null;
    masterRow.getCell(colIndexCttaSep).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexCttaSep).font = { name: 'Calibri', size: 9 };

    masterRow.getCell(colIndexTitPie).value = docente.horasPieTitular || null;
    masterRow.getCell(colIndexTitPie).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexTitPie).font = { name: 'Calibri', size: 9 };

    masterRow.getCell(colIndexCttaPie).value = docente.horasPieContrata || null;
    masterRow.getCell(colIndexCttaPie).alignment = { horizontal: 'center', vertical: 'middle' };
    masterRow.getCell(colIndexCttaPie).font = { name: 'Calibri', size: 9 };

    for (let c = 1; c <= totalColumnas; c++) {
      masterRow.getCell(c).border = borderThin;
    }

    currentRowIdx++;

    // Obtener asignaciones horarias del docente en este colegio
    const asigsDocente = asignaciones.filter(
      a => a.rbd === establecimiento.rbd && (a.docenteId === docente.id || a.docenteId === docente.run)
    );

    // Agrupar asignaciones regulares de aula por asignatura
    const asignaturasMap = new Map<string, Map<string, number>>(); // Asignatura -> (CursoId -> HorasAula)

    for (const asig of asigsDocente) {
      const asigNombre = (asig.asignatura || 'Docencia Aula').trim();
      if (!asignaturasMap.has(asigNombre)) {
        asignaturasMap.set(asigNombre, new Map<string, number>());
      }
      const cursoMap = asignaturasMap.get(asigNombre)!;
      const hActuales = cursoMap.get(asig.cursoId) || 0;
      cursoMap.set(asig.cursoId, hActuales + Number(asig.horasPedagogicasAula || 0));
    }

    const firstDetailRow = currentRowIdx;
    let firstSubjectRow = currentRowIdx;
    let lastSubjectRow = currentRowIdx - 1;

    // 2. Filas de Asignaturas / Carga Lectiva en Cursos
    for (const [nombreAsignatura, cursosMap] of asignaturasMap.entries()) {
      const subjectRow = ws.getRow(currentRowIdx);
      subjectRow.height = 17;

      subjectRow.getCell(colIndexDocente).value = nombreAsignatura;
      subjectRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
      subjectRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

      // Llenar horas en cada columna de curso
      let sumaHaFila = 0;
      cursosOrdenados.forEach((curso, idx) => {
        const colIdx = colIndexInicioCursos + idx;
        const horasEnCurso = cursosMap.get(curso.id) || 0;
        if (horasEnCurso > 0) {
          subjectRow.getCell(colIdx).value = horasEnCurso;
          subjectRow.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
          subjectRow.getCell(colIdx).font = { name: 'Calibri', size: 9 };
          sumaHaFila += horasEnCurso;
        }
      });

      // TOTAL HA* (Fórmula =SUMA de las columnas de cursos de esa fila)
      if (numCursos > 0) {
        const colStartLetter = getColumnLetter(colIndexInicioCursos);
        const colEndLetter = getColumnLetter(colIndexFinCursos);
        subjectRow.getCell(colIndexTotalHa).value = {
          formula: `SUM(${colStartLetter}${currentRowIdx}:${colEndLetter}${currentRowIdx})`,
          result: sumaHaFila
        };
      } else {
        subjectRow.getCell(colIndexTotalHa).value = sumaHaFila > 0 ? sumaHaFila : null;
      }
      subjectRow.getCell(colIndexTotalHa).alignment = { horizontal: 'center', vertical: 'middle' };
      subjectRow.getCell(colIndexTotalHa).font = { name: 'Calibri', size: 9 };

      // TOTAL HC** Sub. Gral: Horas cronológicas equivalentes (HA * 45 / 60) en formato de hora [h]:mm
      // En Excel, 1 día = 24 hrs. Por lo tanto valor en días = (HA * 45 / 60) / 24 = HA * 45 / 1440.
      const valorHorasDia = (sumaHaFila * 45) / 1440;
      subjectRow.getCell(colIndexTotalHcSubGral).value = {
        formula: `(${colTotalHaLetter}${currentRowIdx}*45/60)/24`,
        result: valorHorasDia
      };
      subjectRow.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      subjectRow.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      subjectRow.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };

      for (let c = 1; c <= totalColumnas; c++) {
        subjectRow.getCell(c).border = borderThin;
      }

      lastSubjectRow = currentRowIdx;
      currentRowIdx++;
    }

    // 3. Filas de Funciones No Aula y Financiamiento Específico (SEP, PIE, Directivas/UTP)
    // a) SEP (Coordinación SEP / Taller SEP / Asesoría)
    const horasSepTotal = Number(docente.horasSepTitular || 0) + Number(docente.horasSepContrata || 0);
    const horasSepTaller = Number(docente.horasTallerSep || 0);
    const horasSepEfectivas = Math.max(horasSepTotal, horasSepTaller);

    if (horasSepEfectivas > 0) {
      const sepRow = ws.getRow(currentRowIdx);
      sepRow.height = 17;
      sepRow.getCell(colIndexDocente).value = docente.cargoInstitucional || 'Coordinación Ciclo';
      sepRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
      sepRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

      const valorSepDia = horasSepEfectivas / 24;
      sepRow.getCell(colIndexTotalHcSubSep).value = valorSepDia;
      sepRow.getCell(colIndexTotalHcSubSep).numFmt = '[h]:mm';
      sepRow.getCell(colIndexTotalHcSubSep).alignment = { horizontal: 'center', vertical: 'middle' };
      sepRow.getCell(colIndexTotalHcSubSep).font = { name: 'Calibri', size: 9 };

      for (let c = 1; c <= totalColumnas; c++) {
        sepRow.getCell(c).border = borderThin;
      }
      currentRowIdx++;
    }

    // b) PIE (Trabajo Colaborativo / Coordinación PIE)
    const horasPieTotal = Number(docente.horasPieTitular || 0) + Number(docente.horasPieContrata || 0);
    const horasPieColab = Number(docente.horasTrabajoColaborativo || 0) + Number(docente.horasCoordinacionPie || 0);
    const horasPieEfectivas = Math.max(horasPieTotal, horasPieColab);

    if (horasPieEfectivas > 0) {
      const pieRow = ws.getRow(currentRowIdx);
      pieRow.height = 17;
      pieRow.getCell(colIndexDocente).value = 'Colaborativo PIE';
      pieRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
      pieRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

      const valorPieDia = horasPieEfectivas / 24;
      pieRow.getCell(colIndexTotalHcSubPie).value = valorPieDia;
      pieRow.getCell(colIndexTotalHcSubPie).numFmt = '[h]:mm';
      pieRow.getCell(colIndexTotalHcSubPie).alignment = { horizontal: 'center', vertical: 'middle' };
      pieRow.getCell(colIndexTotalHcSubPie).font = { name: 'Calibri', size: 9 };

      for (let c = 1; c <= totalColumnas; c++) {
        pieRow.getCell(c).border = borderThin;
      }
      currentRowIdx++;
    }

    // c) Funciones No Aula Subvención General (Directivas, UTP, Inspectoría, Coordinación)
    const funcionesNoAulaList: { nombre: string; horas: number }[] = [];
    if (Number(docente.horasDirectivas || 0) > 0) {
      funcionesNoAulaList.push({ nombre: 'Horas Directivas', horas: Number(docente.horasDirectivas) });
    }
    if (Number(docente.horasTecnicoPedagogicas || 0) > 0) {
      funcionesNoAulaList.push({ nombre: 'Jefatura UTP / Técnico Pedagógica', horas: Number(docente.horasTecnicoPedagogicas) });
    }
    if (Number(docente.horasInspectorGeneral || 0) > 0) {
      funcionesNoAulaList.push({ nombre: 'Inspectoría General', horas: Number(docente.horasInspectorGeneral) });
    }
    if (Number(docente.horasCoordinacion || 0) > 0) {
      funcionesNoAulaList.push({ nombre: 'Coordinación UTP', horas: Number(docente.horasCoordinacion) });
    }

    for (const fNoAula of funcionesNoAulaList) {
      const fRow = ws.getRow(currentRowIdx);
      fRow.height = 17;
      fRow.getCell(colIndexDocente).value = fNoAula.nombre;
      fRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
      fRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

      const valorDia = fNoAula.horas / 24;
      fRow.getCell(colIndexTotalHcSubGral).value = valorDia;
      fRow.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      fRow.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      fRow.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };

      for (let c = 1; c <= totalColumnas; c++) {
        fRow.getCell(c).border = borderThin;
      }
      currentRowIdx++;
    }

    // 4. Cálculo y Filas de Recreo y Horas No Lectivas (Ley 20.903)
    const subGralDeclarado = Number(docente.horasSubvencionGeneralTitular || 0) + Number(docente.horasSubvencionGeneralContrata || 0);
    const subGralEfectivo = subGralDeclarado > 0
      ? subGralDeclarado
      : Math.max(0, Number(docente.horasContrato || 0) - horasSepEfectivas - horasPieEfectivas);

    const { recreoMinutos, hnlMinutos } = obtenerMinutosRecreoYHnl(subGralEfectivo, es6040);

    // a) Recreo 60/40
    const rowRec6040 = ws.getRow(currentRowIdx);
    rowRec6040.height = 17;
    rowRec6040.getCell(colIndexDocente).value = 'Recreo 60/40';
    rowRec6040.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
    if (es6040 && subGralEfectivo > 0 && recreoMinutos > 0) {
      rowRec6040.getCell(colIndexTotalHcSubGral).value = recreoMinutos / 1440;
      rowRec6040.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      rowRec6040.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      rowRec6040.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };
    }
    for (let c = 1; c <= totalColumnas; c++) rowRec6040.getCell(c).border = borderThin;
    currentRowIdx++;

    // b) Recreo 65/35
    const rowRec6535 = ws.getRow(currentRowIdx);
    rowRec6535.height = 17;
    rowRec6535.getCell(colIndexDocente).value = 'Recreo 65/35';
    rowRec6535.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
    if (!es6040 && subGralEfectivo > 0 && recreoMinutos > 0) {
      rowRec6535.getCell(colIndexTotalHcSubGral).value = recreoMinutos / 1440;
      rowRec6535.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      rowRec6535.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      rowRec6535.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };
    }
    for (let c = 1; c <= totalColumnas; c++) rowRec6535.getCell(c).border = borderThin;
    currentRowIdx++;

    // c) Horas no lectivas 60/40
    const rowHnl6040 = ws.getRow(currentRowIdx);
    rowHnl6040.height = 17;
    rowHnl6040.getCell(colIndexDocente).value = 'Horas no lectivas 60/40';
    rowHnl6040.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
    if (es6040 && subGralEfectivo > 0 && hnlMinutos > 0) {
      rowHnl6040.getCell(colIndexTotalHcSubGral).value = hnlMinutos / 1440;
      rowHnl6040.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      rowHnl6040.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      rowHnl6040.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };
    }
    for (let c = 1; c <= totalColumnas; c++) rowHnl6040.getCell(c).border = borderThin;
    currentRowIdx++;

    // d) Horas no lectivas 65/35
    const rowHnl6535 = ws.getRow(currentRowIdx);
    rowHnl6535.height = 17;
    rowHnl6535.getCell(colIndexDocente).value = 'Horas no lectivas 65/35';
    rowHnl6535.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
    if (!es6040 && subGralEfectivo > 0 && hnlMinutos > 0) {
      rowHnl6535.getCell(colIndexTotalHcSubGral).value = hnlMinutos / 1440;
      rowHnl6535.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      rowHnl6535.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      rowHnl6535.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };
    }
    for (let c = 1; c <= totalColumnas; c++) rowHnl6535.getCell(c).border = borderThin;
    currentRowIdx++;

    const lastDetailRow = currentRowIdx - 1;

    // 5. Fila Total del Docente
    const totalRow = ws.getRow(currentRowIdx);
    totalRow.height = 18;

    totalRow.getCell(colIndexDocente).value = 'Total';
    totalRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9, bold: true };
    totalRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

    // Total HA* (Suma de las asignaturas)
    if (lastSubjectRow >= firstSubjectRow) {
      totalRow.getCell(colIndexTotalHa).value = {
        formula: `SUM(${colTotalHaLetter}${firstSubjectRow}:${colTotalHaLetter}${lastSubjectRow})`
      };
    } else {
      totalRow.getCell(colIndexTotalHa).value = 0;
    }
    totalRow.getCell(colIndexTotalHa).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHa).font = { name: 'Calibri', size: 9, bold: true };

    // Total HC Sub. Gral
    totalRow.getCell(colIndexTotalHcSubGral).value = {
      formula: `SUM(${colSubGralLetter}${firstDetailRow}:${colSubGralLetter}${lastDetailRow})`,
      result: subGralEfectivo / 24
    };
    totalRow.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
    totalRow.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9, bold: true };

    // Total HC Sub. SEP
    totalRow.getCell(colIndexTotalHcSubSep).value = {
      formula: `SUM(${colSepLetter}${firstDetailRow}:${colSepLetter}${lastDetailRow})`,
      result: horasSepEfectivas / 24
    };
    totalRow.getCell(colIndexTotalHcSubSep).numFmt = '[h]:mm';
    totalRow.getCell(colIndexTotalHcSubSep).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHcSubSep).font = { name: 'Calibri', size: 9, bold: true };

    // Total HC Sub. PIE
    totalRow.getCell(colIndexTotalHcSubPie).value = {
      formula: `SUM(${colPieLetter}${firstDetailRow}:${colPieLetter}${lastDetailRow})`,
      result: horasPieEfectivas / 24
    };
    totalRow.getCell(colIndexTotalHcSubPie).numFmt = '[h]:mm';
    totalRow.getCell(colIndexTotalHcSubPie).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHcSubPie).font = { name: 'Calibri', size: 9, bold: true };

    // TOTAL HC (Sub. Gral + Sub. SEP + Sub. PIE)
    totalRow.getCell(colIndexTotalHc).value = {
      formula: `SUM(${colSubGralLetter}${currentRowIdx}:${colPieLetter}${currentRowIdx})`,
      result: (Number(docente.horasContrato) || (subGralEfectivo + horasSepEfectivas + horasPieEfectivas)) / 24
    };
    totalRow.getCell(colIndexTotalHc).numFmt = '[h]:mm';
    totalRow.getCell(colIndexTotalHc).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHc).font = { name: 'Calibri', size: 9, bold: true };

    for (let c = 1; c <= totalColumnas; c++) {
      totalRow.getCell(c).border = borderTotalRow;
    }

    currentRowIdx++;

    // Fila en blanco de separación entre docentes
    currentRowIdx++;
  }

  // Dimensionamiento óptimo de columnas
  const columnWidths: { [col: number]: number } = {
    [colIndexDocente]: 34,
    [colIndexRut]: 14,
    [colIndexContrato]: 11,
    [colIndexTitSubGral]: 12,
    [colIndexCttaSubGral]: 12,
    [colIndexTitSep]: 11,
    [colIndexCttaSep]: 11,
    [colIndexTitPie]: 11,
    [colIndexCttaPie]: 11,
    [colIndexTotalHa]: 10,
    [colIndexTotalHcSubGral]: 13,
    [colIndexTotalHcSubSep]: 13,
    [colIndexTotalHcSubPie]: 13,
    [colIndexTotalHc]: 12
  };

  for (let c = 1; c <= totalColumnas; c++) {
    if (c >= colIndexInicioCursos && c <= colIndexFinCursos) {
      ws.getColumn(c).width = 5.5; // Columnas de cursos compactas
    } else if (columnWidths[c]) {
      ws.getColumn(c).width = columnWidths[c];
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
