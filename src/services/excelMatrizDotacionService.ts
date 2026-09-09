import ExcelJS from 'exceljs';
import { Establecimiento, Docente, CursoSae, AsignacionHoraria } from '../types';
import { obtenerTramoMineduc, RAW_65_35, RAW_60_40, parseHHMMToMinutes } from '@slep/mineduc-engine';
import { normalizeText } from './analizador/classifier';
import {
  clasificarDocentesConGemini,
  generarObservacionesConGemini,
  GeminiExportOptions,
} from './geminiExportAssistant';

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
export function obtenerMinutosRecreoYHnl(horasSubGral: number, es6040: boolean): { recreoMinutos: number; hnlMinutos: number } {
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
 * Clasifica a los docentes en dos apartados principales:
 * 1. Docentes con Plan de Estudio Regular (Aula troncal, asignaturas, párvulos).
 * 2. Docentes PIE, Codocentes, Talleristas de apoyo/extensión y Equipo Directivo/Gestión.
 *
 * Si se suministra un geminiMap (resultado de la IA), la clasificación de Gemini
 * tiene prioridad cuando la confianza es ALTA o MEDIA.
 */
export function clasificarDocentesEnSecciones(
  docentes: Docente[],
  asignaciones: AsignacionHoraria[],
  geminiMap?: Map<string, import('./geminiExportAssistant').GeminiSeccionResult>
): {
  seccion1_PlanEstudio: Docente[];
  seccion2_ApoyoYDirectivos: Docente[];
} {
  const seccion1: Docente[] = [];
  const seccion2: Docente[] = [];

  for (const doc of docentes) {
    // Si Gemini analizó a este docente con confianza ALTA o MEDIA, usar su resultado
    const geminiResult = geminiMap?.get(doc.id);
    if (geminiResult && (geminiResult.confianza === 'ALTA' || geminiResult.confianza === 'MEDIA')) {
      if (geminiResult.seccion === 'SECCION_1') {
        seccion1.push(doc);
      } else {
        seccion2.push(doc);
      }
      continue;
    }

    // Clasificación local como respaldo (o para confianza BAJA de Gemini)
    // La BD almacena el UUID interno del docente en docenteId (no el RUN).
    // Comparar únicamente por doc.id para garantizar la vinculación correcta.
    const asigsDoc = asignaciones.filter(a => a.docenteId === doc.id);

    const esDirectivoOTecnico = doc.estamento === 'DIRECTIVO' ||
      doc.estamento === 'TECNICO_PEDAGOGICO' ||
      doc.estamento === 'COORDINADOR_CRA' ||
      (Number(doc.horasDirectivas || 0) + Number(doc.horasTecnicoPedagogicas || 0) + Number(doc.horasInspectorGeneral || 0)) >= doc.horasContrato;

    const esDocentePieOpae = doc.estamento === 'DOCENTE_DIFERENCIAL' ||
      doc.estamento === 'PROFESIONAL_PAE' ||
      doc.estamento === 'TECNICO_ESPECIAL' ||
      doc.estamento === 'ASISTENTE_AULA' ||
      (Number(doc.horasPieTitular || 0) + Number(doc.horasPieContrata || 0)) >= (doc.horasContrato * 0.7);

    // Revisar asignaciones del docente
    let tieneAsignaturasPlanEstudio = false;
    let soloEsCodocenciaOTaller = true;

    for (const a of asigsDoc) {
      const nombreNorm = normalizeText(a.asignatura || '');
      const esCoDoc = Boolean(a.esCoDocencia || nombreNorm.includes('co-doc') || nombreNorm.includes('codoc'));
      const esTallerExt = Boolean(a.esTallerSep || nombreNorm.includes('extension') || nombreNorm.includes('extraescolar'));
      const esAulaRecursos = nombreNorm.includes('aula de recursos') || nombreNorm.includes('aula comun y aula de recursos');

      if (!esCoDoc && !esTallerExt && !esAulaRecursos && Number(a.horasPedagogicasAula || 0) > 0) {
        tieneAsignaturasPlanEstudio = true;
        soloEsCodocenciaOTaller = false;
      }
    }

    // Si tiene asignaturas regulares del plan de estudio y no es directivo puro ni PIE exclusivo
    if (tieneAsignaturasPlanEstudio && !esDirectivoOTecnico && !esDocentePieOpae) {
      seccion1.push(doc);
    } else if (asigsDoc.length > 0 && !soloEsCodocenciaOTaller && !esDirectivoOTecnico && !esDocentePieOpae) {
      seccion1.push(doc);
    } else {
      // Pertenece a Sección 2 (PIE, Co-docentes, Talleristas, Directivos)
      seccion2.push(doc);
    }
  }

  // Ordenar alfabéticamente dentro de cada sección
  const sortDoc = (a: Docente, b: Docente) => {
    const cmpApellidos = (a.apellidos || '').localeCompare(b.apellidos || '');
    if (cmpApellidos !== 0) return cmpApellidos;
    return (a.nombres || '').localeCompare(b.nombres || '');
  };

  return {
    seccion1_PlanEstudio: seccion1.sort(sortDoc),
    seccion2_ApoyoYDirectivos: seccion2.sort(sortDoc)
  };
}

/**
 * Genera el archivo Excel oficial de la Matriz de Dotación por Escuela
 * con formato fiel al modelo SLEP Valle Diguillín (Google Sheets oficial),
 * separando la Sección 1 (Plan de Estudio) de la Sección 2 (PIE, Codocentes, Talleristas y Directivos)
 * y formateando celdas horarias en [h]:mm.
 *
 * @param geminiOptions Opcional. Si se suministra una apiKey, Gemini AI clasifica las secciones
 *                      y genera observaciones de auditoría inteligentes para cada docente.
 *                      Si analizarTodos = true, analiza toda la dotación (no solo ambiguos).
 */
export async function generarExcelMatrizDotacionColegio(
  establecimiento: Establecimiento,
  docentes: Docente[],
  cursos: CursoSae[],
  asignaciones: AsignacionHoraria[],
  geminiOptions?: GeminiExportOptions
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

  // Definición de columnas
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
  const colIndexObservaciones = colIndexTotalHa + 5;
  const totalColumnas = colIndexObservaciones;

  const colTotalHaLetter = getColumnLetter(colIndexTotalHa);
  const colSubGralLetter = getColumnLetter(colIndexTotalHcSubGral);
  const colSepLetter = getColumnLetter(colIndexTotalHcSubSep);
  const colPieLetter = getColumnLetter(colIndexTotalHcSubPie);
  const colTotalHcLetter = getColumnLetter(colIndexTotalHc);

  // Estilos
  const headerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '000000' } // Negro sólido institucional
  };

  const headerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 8.5,
    bold: true,
    color: { argb: 'FFFFFF' }
  };

  const sectionDividerFill: ExcelJS.FillPattern = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: '1E293B' } // Slate oscuro institucional
  };

  const sectionDividerFont: Partial<ExcelJS.Font> = {
    name: 'Calibri',
    size: 10,
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

  const borderDoubleTotalRow: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: '000000' } },
    left: { style: 'thin', color: { argb: 'D1D5DB' } },
    bottom: { style: 'double', color: { argb: '000000' } },
    right: { style: 'thin', color: { argb: 'D1D5DB' } }
  };

  // Función interna para renderizar una fila de encabezados de tabla
  const renderizarEncabezado = (rowIdx: number) => {
    const row = ws.getRow(rowIdx);
    row.height = 36;

    row.getCell(colIndexDocente).value = 'NOMBRES';
    row.getCell(colIndexRut).value = 'RUN';
    row.getCell(colIndexContrato).value = 'HORAS\nCONTRATO';
    row.getCell(colIndexTitSubGral).value = 'TITULARES SUB\nGRAL';
    row.getCell(colIndexCttaSubGral).value = 'CONTRATA SUB\nGRAL';
    row.getCell(colIndexTitSep).value = 'TITULARES SEP';
    row.getCell(colIndexCttaSep).value = 'CONTRATA SEP';
    row.getCell(colIndexTitPie).value = 'TITULARES PIE';
    row.getCell(colIndexCttaPie).value = 'CONTRATA\nPIE';

    cursosOrdenados.forEach((curso, idx) => {
      const colIdx = colIndexInicioCursos + idx;
      row.getCell(colIdx).value = obtenerEtiquetaCortaCurso(curso.nivel, curso.letra);
    });

    row.getCell(colIndexTotalHa).value = 'TOTAL HA*';
    row.getCell(colIndexTotalHcSubGral).value = 'TOTAL HC** Sub.\nGral';
    row.getCell(colIndexTotalHcSubSep).value = 'TOTAL HC** Sub.\nSEP';
    row.getCell(colIndexTotalHcSubPie).value = 'TOTAL HC** Sub.\nPIE';
    row.getCell(colIndexTotalHc).value = 'TOTAL HC';
    row.getCell(colIndexObservaciones).value = 'OBSERVACIONES / AUDITORÍA';

    for (let c = 1; c <= totalColumnas; c++) {
      const cell = row.getCell(c);
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
  };

  const es6040 = (establecimiento.porcentajePrioritarios || 0) >= 80;

  // Clasificar docentes en Sección 1 (Plan de Estudio) y Sección 2 (Apoyo, PIE, Codocentes, Talleristas, Directivos)
  const docentesColegio = docentes.filter(d => d.rbd === establecimiento.rbd);

  // ===========================================================================
  // ASISTENCIA GEMINI AI (opcional)
  // Cuando se suministra apiKey + analizarTodos=true, Gemini analiza toda la
  // dotación. Si analizarTodos=false (defecto), solo procesa docentes ambiguos.
  // ===========================================================================
  let geminiSeccionMap = new Map<string, import('./geminiExportAssistant').GeminiSeccionResult>();
  let geminiObservacionesMap = new Map<string, string>();

  if (geminiOptions?.apiKey) {
    // Determinar qué docentes enviar a Gemini
    let docentesParaGemini = docentesColegio;

    if (!geminiOptions.analizarTodos) {
      // Modo selectivo: solo docentes "ambiguos" (sin asignaciones claras o con estamento mixto)
      docentesParaGemini = docentesColegio.filter(doc => {
        const asigsDoc = asignaciones.filter(a => a.rbd === establecimiento.rbd && a.docenteId === doc.id);
        const tieneAsigClaras = asigsDoc.some(a =>
          !a.esCoDocencia && !a.esTallerSep && !a.esTrabajoColaborativo &&
          Number(a.horasPedagogicasAula || 0) > 0
        );
        const esClaramenteAula = doc.estamento === 'DOCENTE_AULA' && tieneAsigClaras;
        const esClaramentePie = doc.estamento === 'DOCENTE_DIFERENCIAL' &&
          (Number(doc.horasPieTitular || 0) + Number(doc.horasPieContrata || 0)) >= doc.horasContrato * 0.7;
        const esClaramenteDirectivo = ['DIRECTIVO', 'TECNICO_PEDAGOGICO', 'COORDINADOR_CRA'].includes(doc.estamento);
        // Es ambiguo si no cae claramente en ninguna categoría
        return !esClaramenteAula && !esClaramentePie && !esClaramenteDirectivo;
      });
    }

    // Ejecutar ambas llamadas en paralelo para minimizar latencia
    const [seccionesIA, observacionesIA] = await Promise.all([
      clasificarDocentesConGemini(docentesParaGemini, asignaciones, establecimiento, geminiOptions),
      generarObservacionesConGemini(docentesColegio, asignaciones, establecimiento, geminiOptions),
    ]);

    geminiSeccionMap = seccionesIA;
    geminiObservacionesMap = observacionesIA;
  }

  const { seccion1_PlanEstudio, seccion2_ApoyoYDirectivos } = clasificarDocentesEnSecciones(
    docentesColegio,
    asignaciones,
    geminiSeccionMap
  );

  // ===========================================================================
  // 1. SECCIÓN 1: DOCENTES DE PLAN DE ESTUDIO / AULA REGULAR
  // ===========================================================================
  let currentRowIdx = 1;
  renderizarEncabezado(currentRowIdx);
  currentRowIdx++;

  const firstTeacherRowSection1 = currentRowIdx;
  const filasSujetasTotalesCursos: number[] = [];

  for (const docente of seccion1_PlanEstudio) {
    // 1. Fila Maestra del Docente
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

    if (docente.aplicaArticulo69) {
      const obsGemini = geminiObservacionesMap.get(docente.id);
      masterRow.getCell(colIndexObservaciones).value = obsGemini
        ? `[IA] ${obsGemini}`
        : 'Ley reducción horaria: 24 de 30 en aula (Art. 69)';
      masterRow.getCell(colIndexObservaciones).font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: '2563EB' } };
    } else {
      const obsGemini = geminiObservacionesMap.get(docente.id);
      if (obsGemini) {
        masterRow.getCell(colIndexObservaciones).value = `[IA] ${obsGemini}`;
        masterRow.getCell(colIndexObservaciones).font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: '0F766E' } };
      }
    }

    for (let c = 1; c <= totalColumnas; c++) {
      masterRow.getCell(c).border = borderThin;
    }

    currentRowIdx++;

    // Asignaciones del docente en este establecimiento — vincular por UUID interno
    const asigsDocente = asignaciones.filter(
      a => a.rbd === establecimiento.rbd && a.docenteId === docente.id
    );

    const asignaturasMap = new Map<string, Map<string, number>>();
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

    // Filas de Asignaturas
    for (const [nombreAsignatura, cursosMap] of asignaturasMap.entries()) {
      const subjectRow = ws.getRow(currentRowIdx);
      subjectRow.height = 17;

      subjectRow.getCell(colIndexDocente).value = nombreAsignatura;
      subjectRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
      subjectRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

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

      // Conversión HA -> Horas Cronológicas en formato [h]:mm
      const valorHorasDia = (sumaHaFila * 45) / 1440;
      subjectRow.getCell(colIndexTotalHcSubGral).value = {
        formula: `((${colTotalHaLetter}${currentRowIdx}*45)/60)/24`,
        result: valorHorasDia
      };
      subjectRow.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      subjectRow.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      subjectRow.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };

      for (let c = 1; c <= totalColumnas; c++) {
        subjectRow.getCell(c).border = borderThin;
      }

      filasSujetasTotalesCursos.push(currentRowIdx);
      lastSubjectRow = currentRowIdx;
      currentRowIdx++;
    }

    // Horas SEP: la suma de titular+contrata + tallerSep (que son adicionales, no alternativas)
    const horasSepTotal = Number(docente.horasSepTitular || 0) + Number(docente.horasSepContrata || 0);
    const horasSepTaller = Number(docente.horasTallerSep || 0);
    const horasSepEfectivas = horasSepTotal + horasSepTaller; // SUMA: tallerSep es complementario

    if (horasSepEfectivas > 0) {
      const sepRow = ws.getRow(currentRowIdx);
      sepRow.height = 17;
      sepRow.getCell(colIndexDocente).value = docente.cargoInstitucional || 'Coordinación Ciclo';
      sepRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
      sepRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

      sepRow.getCell(colIndexTotalHcSubSep).value = horasSepEfectivas / 24;
      sepRow.getCell(colIndexTotalHcSubSep).numFmt = '[h]:mm';
      sepRow.getCell(colIndexTotalHcSubSep).alignment = { horizontal: 'center', vertical: 'middle' };
      sepRow.getCell(colIndexTotalHcSubSep).font = { name: 'Calibri', size: 9 };

      for (let c = 1; c <= totalColumnas; c++) sepRow.getCell(c).border = borderThin;
      currentRowIdx++;
    }

    // Horas PIE: suma de titular+contrata + trabajo colaborativo + coordinación PIE
    const horasPieTotal = Number(docente.horasPieTitular || 0) + Number(docente.horasPieContrata || 0);
    const horasPieColab = Number(docente.horasTrabajoColaborativo || 0) + Number(docente.horasCoordinacionPie || 0);
    const horasPieEfectivas = horasPieTotal + horasPieColab; // SUMA: todas son complementarias

    if (horasPieEfectivas > 0) {
      const pieRow = ws.getRow(currentRowIdx);
      pieRow.height = 17;
      pieRow.getCell(colIndexDocente).value = 'Colaborativo PIE';
      pieRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
      pieRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

      pieRow.getCell(colIndexTotalHcSubPie).value = horasPieEfectivas / 24;
      pieRow.getCell(colIndexTotalHcSubPie).numFmt = '[h]:mm';
      pieRow.getCell(colIndexTotalHcSubPie).alignment = { horizontal: 'center', vertical: 'middle' };
      pieRow.getCell(colIndexTotalHcSubPie).font = { name: 'Calibri', size: 9 };

      for (let c = 1; c <= totalColumnas; c++) pieRow.getCell(c).border = borderThin;
      currentRowIdx++;
    }

    // Ley 20.903 — Recreo y Horas No Lectivas (solo el régimen que aplica al establecimiento)
    const subGralDeclarado = Number(docente.horasSubvencionGeneralTitular || 0) + Number(docente.horasSubvencionGeneralContrata || 0);
    const subGralEfectivo = subGralDeclarado > 0
      ? subGralDeclarado
      : Math.max(0, Number(docente.horasContrato || 0) - horasSepEfectivas - horasPieEfectivas);

    const { recreoMinutos, hnlMinutos } = obtenerMinutosRecreoYHnl(subGralEfectivo, es6040);

    // Fila Recreo — solo el régimen del colegio
    const rowRecreo = ws.getRow(currentRowIdx);
    rowRecreo.height = 17;
    rowRecreo.getCell(colIndexDocente).value = es6040 ? 'Recreo 60/40' : 'Recreo 65/35';
    rowRecreo.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
    rowRecreo.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };
    if (subGralEfectivo > 0 && recreoMinutos > 0) {
      rowRecreo.getCell(colIndexTotalHcSubGral).value = recreoMinutos / 1440;
      rowRecreo.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      rowRecreo.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      rowRecreo.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };
    }
    for (let c = 1; c <= totalColumnas; c++) rowRecreo.getCell(c).border = borderThin;
    currentRowIdx++;

    // Fila Horas No Lectivas — solo el régimen del colegio
    const rowHnl = ws.getRow(currentRowIdx);
    rowHnl.height = 17;
    rowHnl.getCell(colIndexDocente).value = es6040 ? 'Horas no lectivas 60/40' : 'Horas no lectivas 65/35';
    rowHnl.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };
    rowHnl.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };
    if (subGralEfectivo > 0 && hnlMinutos > 0) {
      rowHnl.getCell(colIndexTotalHcSubGral).value = hnlMinutos / 1440;
      rowHnl.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
      rowHnl.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
      rowHnl.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9 };
    }
    for (let c = 1; c <= totalColumnas; c++) rowHnl.getCell(c).border = borderThin;
    currentRowIdx++;

    const lastDetailRow = currentRowIdx - 1;

    // Fila Total del Docente
    const totalRow = ws.getRow(currentRowIdx);
    totalRow.height = 18;

    totalRow.getCell(colIndexDocente).value = 'Total';
    totalRow.getCell(colIndexDocente).font = { name: 'Calibri', size: 9, bold: true };
    totalRow.getCell(colIndexDocente).alignment = { horizontal: 'left', vertical: 'middle' };

    if (lastSubjectRow >= firstSubjectRow) {
      totalRow.getCell(colIndexTotalHa).value = {
        formula: `SUM(${colTotalHaLetter}${firstSubjectRow}:${colTotalHaLetter}${lastSubjectRow})`
      };
    } else {
      totalRow.getCell(colIndexTotalHa).value = 0;
    }
    totalRow.getCell(colIndexTotalHa).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHa).font = { name: 'Calibri', size: 9, bold: true };

    totalRow.getCell(colIndexTotalHcSubGral).value = {
      formula: `SUM(${colSubGralLetter}${firstDetailRow}:${colSubGralLetter}${lastDetailRow})`,
      result: subGralEfectivo / 24
    };
    totalRow.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
    totalRow.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHcSubGral).font = { name: 'Calibri', size: 9, bold: true };

    totalRow.getCell(colIndexTotalHcSubSep).value = {
      formula: `SUM(${colSepLetter}${firstDetailRow}:${colSepLetter}${lastDetailRow})`,
      result: horasSepEfectivas / 24
    };
    totalRow.getCell(colIndexTotalHcSubSep).numFmt = '[h]:mm';
    totalRow.getCell(colIndexTotalHcSubSep).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHcSubSep).font = { name: 'Calibri', size: 9, bold: true };

    totalRow.getCell(colIndexTotalHcSubPie).value = {
      formula: `SUM(${colPieLetter}${firstDetailRow}:${colPieLetter}${lastDetailRow})`,
      result: horasPieEfectivas / 24
    };
    totalRow.getCell(colIndexTotalHcSubPie).numFmt = '[h]:mm';
    totalRow.getCell(colIndexTotalHcSubPie).alignment = { horizontal: 'center', vertical: 'middle' };
    totalRow.getCell(colIndexTotalHcSubPie).font = { name: 'Calibri', size: 9, bold: true };

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
  }

  // Fila de Cierre Sección 1: Totales de Carga Horaria por Curso (Demanda Plan de Estudio)
  const filaTotalCursos = ws.getRow(currentRowIdx);
  filaTotalCursos.height = 20;
  filaTotalCursos.getCell(colIndexDocente).value = 'TOTAL CARGA LECTIVA CURSOS';
  filaTotalCursos.getCell(colIndexDocente).font = { name: 'Calibri', size: 9, bold: true };

  cursosOrdenados.forEach((curso, idx) => {
    const colIdx = colIndexInicioCursos + idx;
    const colLetter = getColumnLetter(colIdx);
    if (filasSujetasTotalesCursos.length > 0) {
      filaTotalCursos.getCell(colIdx).value = {
        formula: `SUM(${colLetter}${firstTeacherRowSection1}:${colLetter}${currentRowIdx - 1})`
      };
    } else {
      filaTotalCursos.getCell(colIdx).value = 0;
    }
    filaTotalCursos.getCell(colIdx).alignment = { horizontal: 'center', vertical: 'middle' };
    filaTotalCursos.getCell(colIdx).font = { name: 'Calibri', size: 9, bold: true };
  });

  if (filasSujetasTotalesCursos.length > 0) {
    filaTotalCursos.getCell(colIndexTotalHa).value = {
      formula: `SUM(${colTotalHaLetter}${firstTeacherRowSection1}:${colTotalHaLetter}${currentRowIdx - 1})`
    };
  } else {
    filaTotalCursos.getCell(colIndexTotalHa).value = 0;
  }
  filaTotalCursos.getCell(colIndexTotalHa).alignment = { horizontal: 'center', vertical: 'middle' };
  filaTotalCursos.getCell(colIndexTotalHa).font = { name: 'Calibri', size: 9, bold: true };

  for (let c = 1; c <= totalColumnas; c++) {
    filaTotalCursos.getCell(c).border = borderDoubleTotalRow;
  }
  currentRowIdx += 2;

  // ===========================================================================
  // 2. SECCIÓN 2: DOCENTES PIE, CO-DOCENTES, TALLERISTAS Y GESTIÓN DIRECTIVA
  // ===========================================================================
  if (seccion2_ApoyoYDirectivos.length > 0) {
    // Fila de Título Separador Institucional
    const bannerRow = ws.getRow(currentRowIdx);
    bannerRow.height = 24;
    ws.mergeCells(`A${currentRowIdx}:${getColumnLetter(totalColumnas)}${currentRowIdx}`);
    bannerRow.getCell(1).value = `APARTADO 2: DOTACIÓN DE APOYO PIE, CO-DOCENCIA, TALLERISTAS Y GESTIÓN INSTITUCIONAL (${establecimiento.nombre.toUpperCase()})`;
    bannerRow.getCell(1).fill = sectionDividerFill;
    bannerRow.getCell(1).font = sectionDividerFont;
    bannerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    currentRowIdx++;

    // Segundo Encabezado de Columnas
    renderizarEncabezado(currentRowIdx);
    currentRowIdx++;

    for (const docente of seccion2_ApoyoYDirectivos) {
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

      // Observación de auditoría Gemini AI (si disponible)
      const obsGeminiS2 = geminiObservacionesMap.get(docente.id);
      if (obsGeminiS2) {
        masterRow.getCell(colIndexObservaciones).value = `[IA] ${obsGeminiS2}`;
        masterRow.getCell(colIndexObservaciones).font = { name: 'Calibri', size: 8.5, italic: true, color: { argb: '0F766E' } };
      }

      for (let c = 1; c <= totalColumnas; c++) {
        masterRow.getCell(c).border = borderThin;
      }
      currentRowIdx++;

      // Desglose de funciones de la Sección 2 — vincular por UUID interno
      const asigsDocente = asignaciones.filter(
        a => a.rbd === establecimiento.rbd && a.docenteId === docente.id
      );

      // 1. Asignaciones registradas
      for (const asig of asigsDocente) {
        const row = ws.getRow(currentRowIdx);
        row.height = 17;
        row.getCell(colIndexDocente).value = asig.asignatura || 'Apoyo Pedagógico';
        row.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };

        const asigNorm = normalizeText(asig.asignatura || '');
        const esPie = asig.esTrabajoColaborativo || asigNorm.includes('pie') || asigNorm.includes('recursos') || (asig.horasCronologicasPie || 0) > 0;
        const esSep = asig.esTallerSep || asigNorm.includes('sep') || asigNorm.includes('extension');

        const horasValor = Number(asig.horasCronologicasPie || asig.horasPedagogicasAula || 0);

        if (esPie) {
          row.getCell(colIndexTotalHcSubPie).value = horasValor / 24;
          row.getCell(colIndexTotalHcSubPie).numFmt = '[h]:mm';
          row.getCell(colIndexTotalHcSubPie).alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (esSep) {
          row.getCell(colIndexTotalHcSubSep).value = horasValor / 24;
          row.getCell(colIndexTotalHcSubSep).numFmt = '[h]:mm';
          row.getCell(colIndexTotalHcSubSep).alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          row.getCell(colIndexTotalHcSubGral).value = horasValor / 24;
          row.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
          row.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        for (let c = 1; c <= totalColumnas; c++) row.getCell(c).border = borderThin;
        currentRowIdx++;
      }

      // 2. Funciones directivas/institucionales si no estaban en asignaciones
      if (asigsDocente.length === 0) {
        let funcionNombre = docente.cargoInstitucional || 'Gestión Institucional';
        if (docente.estamento === 'DIRECTIVO') funcionNombre = 'Directora / Equipo Directivo';
        if (docente.estamento === 'TECNICO_PEDAGOGICO') funcionNombre = 'Jefe Unidad Técnico Pedagógica (UTP)';
        if (docente.estamento === 'DOCENTE_DIFERENCIAL') funcionNombre = 'Docente Especialista PIE';

        const row = ws.getRow(currentRowIdx);
        row.height = 17;
        row.getCell(colIndexDocente).value = funcionNombre;
        row.getCell(colIndexDocente).font = { name: 'Calibri', size: 9 };

        const esPieDoc = (Number(docente.horasPieTitular || 0) + Number(docente.horasPieContrata || 0)) > 0 || docente.estamento === 'DOCENTE_DIFERENCIAL';
        const esSepDoc = (Number(docente.horasSepTitular || 0) + Number(docente.horasSepContrata || 0)) > 0;

        if (esPieDoc) {
          row.getCell(colIndexTotalHcSubPie).value = docente.horasContrato / 24;
          row.getCell(colIndexTotalHcSubPie).numFmt = '[h]:mm';
          row.getCell(colIndexTotalHcSubPie).alignment = { horizontal: 'center', vertical: 'middle' };
        } else if (esSepDoc) {
          row.getCell(colIndexTotalHcSubSep).value = docente.horasContrato / 24;
          row.getCell(colIndexTotalHcSubSep).numFmt = '[h]:mm';
          row.getCell(colIndexTotalHcSubSep).alignment = { horizontal: 'center', vertical: 'middle' };
        } else {
          row.getCell(colIndexTotalHcSubGral).value = docente.horasContrato / 24;
          row.getCell(colIndexTotalHcSubGral).numFmt = '[h]:mm';
          row.getCell(colIndexTotalHcSubGral).alignment = { horizontal: 'center', vertical: 'middle' };
        }

        for (let c = 1; c <= totalColumnas; c++) row.getCell(c).border = borderThin;
        currentRowIdx++;
      }
    }
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
    [colIndexTotalHc]: 12,
    [colIndexObservaciones]: 30
  };

  for (let c = 1; c <= totalColumnas; c++) {
    if (c >= colIndexInicioCursos && c <= colIndexFinCursos) {
      ws.getColumn(c).width = 5.5;
    } else if (columnWidths[c]) {
      ws.getColumn(c).width = columnWidths[c];
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}
