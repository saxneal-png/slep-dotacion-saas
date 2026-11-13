import ExcelJS from 'exceljs';
import {
  AsistenteEducacion,
  CalidadJuridicaDocente,
  Docente,
  Establecimiento,
  EstamentoAsistente,
} from '../types';
import {
  findSchoolByRbd,
  resolveCanonicalRbd,
} from '../data/slepSchoolsCatalog';
import { esJardinOSalaCuna } from '../utils/establishmentTypeHelpers';
import { limpiarRutParaId, normalizarRut } from '../utils/rutUtils';
import {
  guardarAsistentesBatch,
  guardarDocentesBatch,
  listarAsistentes,
  listarDocentes,
  listarEstablecimientos,
} from '../database/db';

export interface ImportCentroCostoVtfOptions {
  /** Si se indica, importa únicamente ese RBD VTF; si se omite, importa los 42 Jardines/Salas Cuna */
  rbdFiltro?: string;
}

export interface ImportCentroCostoVtfResult {
  hojaUtilizada: string;
  filasLeidas: number;
  unidadesAfectadas: number;
  rbdsAfectados: string[];
  docentesImportados: number;
  asistentesImportados: number;
  directorasImportadas: number;
  educadorasImportadas: number;
  tecnicosImportados: number;
  otrosAsistentesImportados: number;
  sinRbdResueltos: number;
  omitidosNoVtf: number;
  omitidosPorFiltroRbd: number;
  duplicadosConsolidados: number;
  alertas: string[];
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function cellText(val: unknown): string {
  if (val == null) return '';
  if (typeof val === 'object') {
    const anyVal = val as Record<string, unknown>;
    if ('result' in anyVal && anyVal.result != null) return String(anyVal.result).trim();
    if ('text' in anyVal && anyVal.text != null) return String(anyVal.text).trim();
    if (Array.isArray(anyVal.richText)) {
      return anyVal.richText.map((t: any) => String(t?.text || '')).join('').trim();
    }
  }
  return String(val).trim();
}

function cellNumber(val: unknown): number {
  const s = cellText(val).replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

function resolveRbdFromRow(rbdRaw: string, centroCosto: string): { rbd: string; fueResueltoSinRbd: boolean } {
  const clean = resolveCanonicalRbd(rbdRaw);
  if (clean && /^\d+$/.test(clean)) {
    return { rbd: clean, fueResueltoSinRbd: false };
  }
  const upperCc = centroCosto
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (upperCc.includes('RIOS DEL SUR') && upperCc.includes('SALA CUNA')) {
    return { rbd: '36646', fueResueltoSinRbd: true };
  }
  return { rbd: '', fueResueltoSinRbd: false };
}

function esUnidadVtfValida(rbd: string, estByRbd: Map<string, Establecimiento>): boolean {
  if (!rbd) return false;
  const est = estByRbd.get(rbd);
  if (est) return esJardinOSalaCuna(est);
  const cat = findSchoolByRbd(rbd);
  return Boolean(cat && (cat.tipo === 'JARDIN' || cat.tipo === 'SALA_CUNA'));
}

function mapCalidadDocente(tipoContrato: string): CalidadJuridicaDocente {
  const upper = tipoContrato.toUpperCase();
  if (upper.includes('TITULAR') || upper.includes('INDEFINIDO')) return 'TITULAR';
  return 'CONTRATA';
}

function mapEstamentoOtros(cargoUpper: string, categoriaUpper: string): EstamentoAsistente {
  if (cargoUpper.includes('AUXILIAR')) return 'AUXILIAR';
  if (cargoUpper.includes('ADMINISTRATIV')) return 'ADMINISTRATIVO';
  if (cargoUpper.includes('INSPECTOR')) return 'PARADOCENTE_INSPECTORIA';
  if (
    categoriaUpper.includes('PROFESIONAL') ||
    cargoUpper.includes('PSICOLOG') ||
    cargoUpper.includes('FONOAUDIOLOG') ||
    cargoUpper.includes('SOCIAL') ||
    cargoUpper.includes('TERAPEUTA')
  ) {
    return 'PROFESIONAL';
  }
  return 'AUXILIAR';
}

function findHeaderRowAndCols(ws: ExcelJS.Worksheet): {
  headerRow: number;
  cols: Record<string, number>;
} | null {
  const maxScan = Math.min(ws.rowCount, 12);
  for (let r = 1; r <= maxScan; r++) {
    const row = ws.getRow(r);
    const cols: Record<string, number> = {};
    row.eachCell((cell, colNum) => {
      const key = normalizeHeader(cell.value);
      if (key) cols[key] = colNum;
    });
    const hasRun = 'r u n' in cols || 'run' in cols;
    const hasCc = 'centro costo' in cols;
    const hasCargo = 'cargo' in cols;
    if (hasRun && hasCc && hasCargo) {
      return { headerRow: r, cols };
    }
  }
  return null;
}

function getCol(cols: Record<string, number>, ...candidates: string[]): number | undefined {
  for (const c of candidates) {
    if (cols[c] !== undefined) return cols[c];
  }
  return undefined;
}

/**
 * Importa la nómina consolidada de funcionarios VTF desde el reporte
 * `DetalleDotacionCentroCosto (2).xlsx` (priorizando `Hoja1`, que viene deduplicada).
 */
export async function importarDetalleCentroCostoVtf(
  buffer: ArrayBuffer,
  periodo: number = 2027,
  options: ImportCentroCostoVtfOptions = {}
): Promise<ImportCentroCostoVtfResult> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);

  // Priorizar Hoja1 (tabla deduplicada), con respaldo a la primera hoja con encabezados válidos
  const orderedSheets = [...wb.worksheets].sort((a, b) => {
    const aPref = a.name.trim().toLowerCase() === 'hoja1' ? 0 : 1;
    const bPref = b.name.trim().toLowerCase() === 'hoja1' ? 0 : 1;
    return aPref - bPref;
  });

  let targetWs: ExcelJS.Worksheet | null = null;
  let headerMeta: { headerRow: number; cols: Record<string, number> } | null = null;
  for (const ws of orderedSheets) {
    const meta = findHeaderRowAndCols(ws);
    if (meta) {
      targetWs = ws;
      headerMeta = meta;
      break;
    }
  }

  if (!targetWs || !headerMeta) {
    throw new Error(
      'No se encontró una hoja compatible con DetalleDotacionCentroCosto (se requieren columnas R.U.N., Centro Costo y Cargo).'
    );
  }

  const { headerRow, cols } = headerMeta;
  const colRun = getCol(cols, 'r u n', 'run')!;
  const colApPat = getCol(cols, 'apellido paterno');
  const colApMat = getCol(cols, 'apellido materno');
  const colNombres = getCol(cols, 'nombres');
  const colTramo = getCol(cols, 'tramo docente', 'tramo');
  const colCategoria = getCol(cols, 'categoria');
  const colIngreso = getCol(cols, 'ingreso');
  const colTermino = getCol(cols, 'termino');
  const colPrograma = getCol(cols, 'programa');
  const colCentroCosto = getCol(cols, 'centro costo')!;
  const colRbd = getCol(cols, 'rbd');
  const colCargo = getCol(cols, 'cargo')!;
  const colTipoContrato = getCol(cols, 'tipo contrato');
  const colHoras = getCol(cols, 'horas contrato');
  const colPrincipalActivo = getCol(cols, 'principal activo');

  const estList = await listarEstablecimientos();
  const estByRbd = new Map<string, Establecimiento>(estList.map(e => [e.rbd.trim(), e]));
  const rbdFiltroClean = options.rbdFiltro ? resolveCanonicalRbd(options.rbdFiltro) : undefined;

  const result: ImportCentroCostoVtfResult = {
    hojaUtilizada: targetWs.name,
    filasLeidas: 0,
    unidadesAfectadas: 0,
    rbdsAfectados: [],
    docentesImportados: 0,
    asistentesImportados: 0,
    directorasImportadas: 0,
    educadorasImportadas: 0,
    tecnicosImportados: 0,
    otrosAsistentesImportados: 0,
    sinRbdResueltos: 0,
    omitidosNoVtf: 0,
    omitidosPorFiltroRbd: 0,
    duplicadosConsolidados: 0,
    alertas: [],
  };

  if (targetWs.name.trim().toLowerCase() !== 'hoja1') {
    result.alertas.push(
      `Se usó la hoja "${targetWs.name}" (no se encontró "Hoja1"); los registros repetidos se deduplicaron por RUN+RBD+Cargo.`
    );
  }

  const seenKeys = new Set<string>();
  const docentesPorRbd = new Map<string, Docente[]>();
  const asistentesPorRbd = new Map<string, AsistenteEducacion[]>();
  const rbdsSet = new Set<string>();

  for (let r = headerRow + 1; r <= targetWs.rowCount; r++) {
    const row = targetWs.getRow(r);
    const runRaw = cellText(row.getCell(colRun).value);
    if (!runRaw) continue;
    result.filasLeidas++;

    if (colPrincipalActivo) {
      const activoFlag = cellText(row.getCell(colPrincipalActivo).value).toUpperCase();
      if (activoFlag === 'NO') continue;
    }

    const centroCosto = cellText(row.getCell(colCentroCosto).value);
    const rbdRaw = colRbd ? cellText(row.getCell(colRbd).value) : '';
    const { rbd, fueResueltoSinRbd } = resolveRbdFromRow(rbdRaw, centroCosto);

    if (!esUnidadVtfValida(rbd, estByRbd)) {
      result.omitidosNoVtf++;
      continue;
    }

    if (rbdFiltroClean && rbd !== rbdFiltroClean) {
      result.omitidosPorFiltroRbd++;
      continue;
    }

    if (fueResueltoSinRbd) {
      result.sinRbdResueltos++;
    }

    const runFormatted = normalizarRut(runRaw);
    const runClean = limpiarRutParaId(runRaw);
    if (!runClean) continue;

    const cargoRaw = cellText(row.getCell(colCargo).value) || 'FUNCION NO DEFINIDA';
    const cargoUpper = cargoRaw
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    const dedupKey = `${rbd}|${runClean}|${cargoUpper}`;
    if (seenKeys.has(dedupKey)) {
      result.duplicadosConsolidados++;
      continue;
    }
    seenKeys.add(dedupKey);

    const apPat = colApPat ? cellText(row.getCell(colApPat).value) : '';
    const apMat = colApMat ? cellText(row.getCell(colApMat).value) : '';
    const apellidos = [apPat, apMat].filter(Boolean).join(' ').trim() || 'S/I';
    const nombres = (colNombres ? cellText(row.getCell(colNombres).value) : '') || 'S/I';
    const tramo = colTramo ? cellText(row.getCell(colTramo).value) : '';
    const categoria = colCategoria ? cellText(row.getCell(colCategoria).value) : '';
    const ingreso = colIngreso ? cellText(row.getCell(colIngreso).value) : '';
    const termino = colTermino ? cellText(row.getCell(colTermino).value) : '';
    const programa = colPrograma ? cellText(row.getCell(colPrograma).value) : '';
    const tipoContrato = colTipoContrato ? cellText(row.getCell(colTipoContrato).value) : 'Indefinido';
    const horas = Math.min(44, Math.max(1, Math.round(colHoras ? cellNumber(row.getCell(colHoras).value) : 44) || 44));

    const notasPartes = [
      `Centro Costo: ${centroCosto}`,
      `Contrato: ${tipoContrato}`,
      ingreso ? `Ingreso: ${ingreso}` : '',
      termino ? `Término: ${termino}` : '',
      tramo ? `Tramo: ${tramo}` : '',
      programa ? `Programa: ${programa}` : '',
    ].filter(Boolean);
    const observaciones = notasPartes.join(' · ');

    rbdsSet.add(rbd);

    const esDirector = cargoUpper.includes('DIRECTOR');
    const esEducadoraODocente =
      !esDirector && (cargoUpper.includes('EDUCADORA') || cargoUpper.includes('DOCENTE'));

    if (esDirector || esEducadoraODocente) {
      const calidad = mapCalidadDocente(tipoContrato);
      const isTitular = calidad === 'TITULAR';
      const funcionVtf = esDirector ? 'Función Directiva' : 'Educadora de Párvulos';
      const horasAula = esDirector ? 0 : Math.round(horas * 0.65);

      const doc: Docente = {
        id: `doc-${rbd}-${periodo}-${runClean}`,
        rbd,
        periodo,
        run: runFormatted,
        nombres,
        apellidos,
        titulo: esDirector ? 'Educadora de Párvulos / Dirección' : 'Educadora de Párvulos',
        calidadJuridica: calidad,
        estamento: esDirector ? 'DIRECTIVO' : 'EDUCADORA_PARVULO',
        horasContrato: horas,
        horasSubvencionGeneralTitular: isTitular ? horas : 0,
        horasSubvencionGeneralContrata: isTitular ? 0 : horas,
        horasSepTitular: 0,
        horasSepContrata: 0,
        horasPieTitular: 0,
        horasPieContrata: 0,
        horasDirectivas: esDirector ? horas : 0,
        horasAula,
        cargoInstitucional: cargoRaw,
        esEducadoraParvulo: !esDirector,
        fechaInicioContrato: ingreso || undefined,
        fechaTerminoContrato: termino || undefined,
        observacionesPal: observaciones,
        esVtf: true,
        funcionVtf,
      };

      const arr = docentesPorRbd.get(rbd) || [];
      arr.push(doc);
      docentesPorRbd.set(rbd, arr);

      result.docentesImportados++;
      if (esDirector) result.directorasImportadas++;
      else result.educadorasImportadas++;
    } else {
      const esTecnico =
        cargoUpper.includes('TECNICO EN PARVULO') ||
        cargoUpper.includes('ASISTENTE DE PARVULO') ||
        cargoUpper.includes('TECNICO PARVUL');
      const funcionVtf = esTecnico
        ? 'Técnico de Educación Parvularia'
        : 'Otros asistentes de la educación';
      const estamento: AsistenteEducacion['estamento'] = esTecnico
        ? 'TECNICO'
        : mapEstamentoOtros(cargoUpper, categoria.toUpperCase());
      const esPlazoFijo =
        tipoContrato.toUpperCase().includes('PLAZO') ||
        tipoContrato.toUpperCase().includes('REEMPLAZO') ||
        tipoContrato.toUpperCase().includes('CONTRATA');

      const asist: AsistenteEducacion = {
        id: `asist-${rbd}-${periodo}-${runClean}`,
        rbd,
        periodo,
        run: runFormatted,
        nombres,
        apellidos,
        cargoFuncion: cargoRaw,
        estamento,
        horasContrato: horas,
        horasSubvencionGeneralIndefinido: esPlazoFijo ? 0 : horas,
        horasSubvencionGeneralPlazoFijo: esPlazoFijo ? horas : 0,
        horasSepIndefinido: 0,
        horasSepPlazoFijo: 0,
        horasPieIndefinido: 0,
        horasPiePlazoFijo: 0,
        esTecnicoParvulo: esTecnico,
        esAuxiliarServicio: estamento === 'AUXILIAR',
        observaciones,
        observacionesPal: observaciones,
        fechaInicioContrato: ingreso || undefined,
        fechaTerminoContrato: termino || undefined,
        activo: true,
        esVtf: true,
        funcionVtf,
      };

      const arr = asistentesPorRbd.get(rbd) || [];
      arr.push(asist);
      asistentesPorRbd.set(rbd, arr);

      result.asistentesImportados++;
      if (esTecnico) result.tecnicosImportados++;
      else result.otrosAsistentesImportados++;
    }
  }

  // Fusionar preservando metadatos JISC (grupoJiscId, turnos) si ya existen en la BD
  const allDocentesToSave: Docente[] = [];
  for (const [rbd, incomingDocs] of docentesPorRbd.entries()) {
    const existentes = await listarDocentes(rbd, periodo);
    const byId = new Map<string, Docente>(existentes.map(d => [d.id, d]));
    const byRun = new Map<string, Docente>(
      existentes.map(d => [limpiarRutParaId(d.run), d])
    );

    for (const d of incomingDocs) {
      const prev = byId.get(d.id) || byRun.get(limpiarRutParaId(d.run));
      allDocentesToSave.push(
        prev
          ? {
              ...prev,
              ...d,
              id: prev.id,
              grupoJiscId: prev.grupoJiscId || d.grupoJiscId,
              horaIngresoTurno: prev.horaIngresoTurno || d.horaIngresoTurno,
              horaSalidaTurno: prev.horaSalidaTurno || d.horaSalidaTurno,
            }
          : d
      );
    }
  }

  const allAsistentesToSave: AsistenteEducacion[] = [];
  for (const [rbd, incomingAsists] of asistentesPorRbd.entries()) {
    const existentes = await listarAsistentes(rbd, periodo);
    const byId = new Map<string, AsistenteEducacion>(existentes.map(a => [a.id, a]));
    const byRun = new Map<string, AsistenteEducacion>(
      existentes.map(a => [limpiarRutParaId(a.run), a])
    );

    for (const a of incomingAsists) {
      const prev = byId.get(a.id) || byRun.get(limpiarRutParaId(a.run));
      allAsistentesToSave.push(
        prev
          ? {
              ...prev,
              ...a,
              id: prev.id,
              grupoJiscId: prev.grupoJiscId || a.grupoJiscId,
              horaIngresoTurno: prev.horaIngresoTurno || a.horaIngresoTurno,
              horaSalidaTurno: prev.horaSalidaTurno || a.horaSalidaTurno,
            }
          : a
      );
    }
  }

  if (allDocentesToSave.length > 0) {
    await guardarDocentesBatch(allDocentesToSave, false);
  }
  if (allAsistentesToSave.length > 0) {
    await guardarAsistentesBatch(allAsistentesToSave);
  }

  result.rbdsAfectados = Array.from(rbdsSet).sort();
  result.unidadesAfectadas = result.rbdsAfectados.length;
  return result;
}
