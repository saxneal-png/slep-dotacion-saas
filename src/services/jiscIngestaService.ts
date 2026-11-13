/**
 * Servicio de Ingesta Multi-Libro para Plataforma JISC (JUNJI / VTF)
 * Soporta los 5 libros oficiales:
 *  1. Base de datos JISC 2026.xlsx (Cod. UE, Tipo EE, Localidad, Contraparte UATP, Dirección, Directora)
 *  2. Directoras SC_JI_ Rut Ingreso SLEP 2026.xlsx (Cohorte 2023, limpieza RUT/mojibake)
 *  3. B3 SLEP VALLE DIGUILLIN.xlsx (Nómina nominal por niño, edad en meses, fecha retiro, Extensión Horaria)
 *  4. Matricula por nivel.xlsx (Capacidad autorizada y matrícula por nivel)
 *  5. Planilla dotación JISC 2026.xlsx (Educadoras, Técnicos y Directora asignados por nivel)
 */

import ExcelJS from 'exceljs';
import {
  CursoSae,
  Docente,
  Establecimiento,
  JiscNivelParvularia,
  JiscParvuloB3,
  SubtipoNivelJisc,
} from '../types';
import {
  findSchoolByRbd,
  identifySchool,
  resolveCanonicalRbd,
} from '../data/slepSchoolsCatalog';
import { normalizarRut } from '../utils/rutUtils';
import {
  guardarEstablecimiento,
  listarEstablecimientos,
} from '../database/repositories/establecimientosRepo';
import {
  guardarCursosBatch,
  listarTodosLosCursos,
} from '../database/repositories/cursosRepo';
import { guardarDocentesBatch } from '../database/repositories/docentesRepo';
import {
  guardarJiscNivelesBatch,
  guardarParvulosB3Batch,
  listarTodosJiscNiveles,
} from '../database/repositories/jiscParvulariaRepo';
import {
  inferirSubtipoNivelVtf,
  obtenerPlanPorCurso,
} from '@slep/mineduc-engine';

/** Mapeo oficial de Cod. UE JUNJI (1610xxxx) -> RBD canónico BDcolegios */
export const JISC_COD_UE_TO_RBD: Record<string, string> = {
  '16108003': '34713', // RAYITO DE SOL (San Ignacio / Pueblo Seco)
  '16109001': '34722', // CAMPANITA (Yungay)
  '16109002': '34724', // ANGELITOS DE AMOR (Yungay)
  '16109003': '34725', // CUNCUNITA (Yungay)
  '16109004': '34726', // MUNDO DE AMOR (Yungay)
  '16109005': '34727', // PARQUE ESTADIO (Yungay)
  '16105001': '34671', // PAPELUCHO (Pemuco)
  '16105002': '34672', // SALA CUNA PASITOS (Pemuco)
  '16102002': '34622', // MIS ANGELITOS (Bulnes)
  '16102003': '34623', // INFANCIA FELIZ (Bulnes)
  '16102004': '34624', // MIS CARIÑOSITOS (Bulnes)
  '16102005': '34626', // MIS PEQUEÑOS DUENDECITOS (Bulnes)
  '16102006': '34627', // MIS PRIMEROS PASOS (Bulnes)
  '16102008': '34621', // MIS PEQUEÑOS CORAZONES (Bulnes)
  '16103002': '34640', // PADRE HURTADO (Chillán Viejo)
  '16103004': '34643', // RÍOS DEL SUR (Chillán Viejo)
  '16103005': '34644', // RUCAPEQUÉN (Chillán Viejo)
  '16103006': '34645', // LAS MANITOS (Chillán Viejo)
  '16103007': '36646', // RIOS DEL SUR 2 - HAPPY DAY (alias JISC 34646 -> 36646)
  '16103008': '34647', // EDUARDO FREI (Chillán Viejo)
  '16101010': '34591', // PEQUEÑO ARCOIRIS (Chillán)
  '16101011': '34593', // MANITOS MAGICAS (Chillán)
  '16101012': '34594', // PEQUEÑA LUNITA (Chillán)
  '16101013': '34595', // LUZ DE KERUBIEL (Chillán)
  '16101014': '34596', // GOTITAS DE AMOR (Chillán)
  '16101015': '34597', // LOS ARTESANITOS (Chillán)
  '16101016': '34598', // CAPULLITO (Chillán)
  '16101017': '34599', // ESTRELLITAS DE LUZ (Chillán)
  '16101018': '34600', // RAYITO DE SOL (Chillán)
  '16101020': '34602', // LOS GIRASOLES (Chillán)
  '16101021': '34603', // RINCONCITO ENCANTADO (Chillán)
  '16101022': '34604', // MIS PRIMEROS PASITOS (Chillán)
  '16101023': '34605', // CASITA DEL SOL (Chillán)
  '16101024': '34606', // ROBLIN (Chillán)
  '16101025': '34607', // MI PRIMERA ESTACIÓN (Chillán)
  '16101026': '34609', // TEJITAS (Chillán)
  '16101027': '34610', // MARÍA INÉS FÜLLER (Chillán)
  '16101028': '34612', // CASTILLO ESPERANZA (Chillán)
  '16101031': '34615', // BRISAS DEL VOLCÁN (Chillán)
  '16101032': '34616', // PASITOS AL FUTURO (Chillán)
  '16101033': '34617', // MIS PRIMEROS SUEÑOS (Chillán)
  '16101034': '34618', // SEMILLITAS (Chillán)
};

function sanitizeMojibake(input: string): string {
  if (!input) return '';
  return input
    .replace(/Ã‘/g, 'Ñ')
    .replace(/Ã±/g, 'ñ')
    .replace(/Ã¡/g, 'á')
    .replace(/Ã©/g, 'é')
    .replace(/Ã­/g, 'í')
    .replace(/Ã³/g, 'ó')
    .replace(/Ãº/g, 'ú')
    .replace(/Ã\x81/g, 'Á')
    .replace(/Ã\x89/g, 'É')
    .replace(/Ã\x8D/g, 'Í')
    .replace(/Ã\x93/g, 'Ó')
    .replace(/Ã\x9A/g, 'Ú')
    .replace(/Ã¼/g, 'ü')
    .replace(/\s+/g, ' ')
    .trim();
}

function cellText(val: any): string {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object' && 'result' in val) return sanitizeMojibake(String(val.result ?? ''));
  if (typeof val === 'object' && 'text' in val) return sanitizeMojibake(String(val.text ?? ''));
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return sanitizeMojibake(String(val));
}

function cellNumber(val: any): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'object' && 'result' in val) return Number(val.result) || 0;
  const n = Number(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function normalizeNorm(txt: string): string {
  return sanitizeMojibake(txt)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function resolverRbdJiscPorNombre(
  nombreRaw: string,
  comunaRaw?: string,
  establecimientosActuales?: Establecimiento[]
): string | undefined {
  const norm = normalizeNorm(nombreRaw);
  const comunaNorm = normalizeNorm(comunaRaw || '');

  // Disambiguar explícitamente los dos "Rayito de Sol" y alias de nombre corto JISC
  if (norm.includes('RAYITO DE SOL')) {
    if (norm.includes('PUEBLO SECO') || comunaNorm.includes('IGNACIO')) return '34713';
    if (comunaNorm.includes('CHILLAN') || norm === 'RAYITO DE SOL') return '34600';
  }
  if (norm.includes('CAMPANITA')) return '34722';
  if (norm.includes('HAPPY DAY') || (norm.includes('RIOS DEL SUR') && norm.includes('2'))) return '36646';
  if (norm.includes('RIOS DEL SUR')) return '34643';
  if (norm.includes('CASTILLITO') || norm.includes('CASTILLO ESPERANZA')) return '34612';
  if (norm.includes('PARQUE ESTADIO')) return '34727';
  if (norm.includes('PASITOS AL FUTURO')) return '34616';
  if (norm.includes('SALA CUNA PASITOS') || norm === 'PASITOS') return '34672';

  if (establecimientosActuales?.length) {
    const matchEst = establecimientosActuales.find((e) => {
      if (e.nombreFantasia && normalizeNorm(e.nombreFantasia) === norm) return true;
      const en = normalizeNorm(e.nombre);
      return en === norm || en.includes(norm);
    });
    if (matchEst) return matchEst.rbd;
  }

  const found = identifySchool(nombreRaw);
  return found?.rbd;
}

function labelSubtipoNivel(subtipo: SubtipoNivelJisc): string {
  switch (subtipo) {
    case 'SALA_CUNA_MENOR':
      return 'Sala Cuna Menor';
    case 'SALA_CUNA_MAYOR':
      return 'Sala Cuna Mayor';
    case 'SALA_CUNA_HETEROGENEA':
      return 'Sala Cuna Heterogénea';
    case 'MEDIO_MENOR':
      return 'Nivel Medio Menor';
    case 'MEDIO_MAYOR':
      return 'Nivel Medio Mayor';
    case 'MEDIO_HETEROGENEO':
      return 'Nivel Medio Mixto';
    case 'HETEROGENEO':
      return 'Grupo Heterogéneo';
    case 'TRANSICION':
      return 'Nivel Transición';
  }
}

export interface ResultadoIngestaJisc {
  archivosProcesados: string[];
  establecimientosActualizados: number;
  nivelesActualizados: number;
  cursosSincronizados: number;
  parvulosB3Cargados: number;
  directorasSincronizadas: number;
  alertas: string[];
}

async function sincronizarCursosDesdeNivelesJisc(
  niveles: JiscNivelParvularia[],
  periodo: number
): Promise<number> {
  if (!niveles.length) return 0;
  const existentes = await listarTodosLosCursos(periodo);
  const cursosById = new Map(existentes.map((c) => [c.id, c]));
  const batch: CursoSae[] = [];

  for (const n of niveles) {
    const cursoId = `cur_jisc_${n.rbd}_${periodo}_g${n.correlGrupo}`;
    const esSalaCuna =
      n.subtipoNivel === 'SALA_CUNA_MENOR' ||
      n.subtipoNivel === 'SALA_CUNA_MAYOR' ||
      n.subtipoNivel === 'SALA_CUNA_HETEROGENEA';
    const plan = obtenerPlanPorCurso(n.nivelNombre, 'No JEC');
    const letra = n.correlGrupo <= 26 ? String.fromCharCode(64 + n.correlGrupo) : String(n.correlGrupo);
    const prev = cursosById.get(cursoId);

    batch.push({
      id: cursoId,
      rbd: n.rbd,
      periodo,
      nivel: n.nivelNombre,
      letra: prev?.letra || letra,
      regimen: 'No JEC',
      regimenProporcion: '65_35',
      salaId: prev?.salaId,
      cupoSae: n.capacidadAutorizada || prev?.cupoSae || (esSalaCuna ? 20 : 32),
      matriculaProyectada: n.matriculaActiva,
      alumnosNeet: prev?.alumnosNeet || 0,
      alumnosNeep: prev?.alumnosNeep || 0,
      tipoModalidad: esSalaCuna ? 'SALA_CUNA' : 'PARVULARIA_VTF',
      planEstudioId: plan?.nivel || prev?.planEstudioId,
      edadMesesMinima: n.edadMesesMin ?? prev?.edadMesesMinima,
      edadMesesMaxima: n.edadMesesMax ?? prev?.edadMesesMaxima,
      codigoGrupoJisc: String(n.correlGrupo),
      horarioJornada: `${n.horarioInicio || '08:30'}-${n.horarioFin || '16:30'}`,
      tieneExtensionHoraria: n.tieneExtensionHoraria,
      matriculaExtension: n.matriculaExtension || 0,
      jornadaNivel: n.jornada || 'COMPLETA',
    });
  }

  await guardarCursosBatch(batch, false);
  return batch.length;
}

/**
 * Procesa uno o múltiples archivos Excel de Plataforma JISC en el orden normativo correcto:
 *  1) Base de datos JISC -> 2) Directoras Cohorte 2023 -> 3) Matrícula por nivel -> 4) Planilla dotación -> 5) B3 nominal
 */
export async function ingestarArchivosJisc(
  files: Array<{ name: string; buffer: ArrayBuffer }>,
  periodo: number = 2027
): Promise<ResultadoIngestaJisc> {
  const resultado: ResultadoIngestaJisc = {
    archivosProcesados: [],
    establecimientosActualizados: 0,
    nivelesActualizados: 0,
    cursosSincronizados: 0,
    parvulosB3Cargados: 0,
    directorasSincronizadas: 0,
    alertas: [],
  };

  interface ParsedFile {
    name: string;
    kind: 'BASE_DATOS_JISC' | 'DIRECTORAS_COHORTE' | 'MATRICULA_NIVEL' | 'DOTACION_JISC' | 'B3_NOMINAL' | 'DESCONOCIDO';
    workbook: ExcelJS.Workbook;
  }

  const parsed: ParsedFile[] = [];
  for (const f of files) {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(f.buffer);
    const sheets = wb.worksheets.map((w) => w.name);
    let kind: ParsedFile['kind'] = 'DESCONOCIDO';

    if (sheets.includes('SLEP Cohorte 2023')) {
      kind = 'DIRECTORAS_COHORTE';
    } else if (sheets.includes('Matricula por nivel')) {
      kind = 'MATRICULA_NIVEL';
    } else if (sheets.includes('Dotación por nivel') || sheets.includes('Dotacion por nivel')) {
      kind = 'DOTACION_JISC';
    } else {
      const ws1 = wb.worksheets[0];
      const headerRow = ws1 ? ws1.getRow(1).values : [];
      const joined = Array.isArray(headerRow)
        ? headerRow.map((v) => cellText(v).toUpperCase()).join('|')
        : '';
      if (joined.includes('COD_ESTABLEC') && joined.includes('CORREL_GRUPO')) {
        kind = 'B3_NOMINAL';
      } else if (joined.includes('COD. UE') && joined.includes('TIPO DE EE')) {
        kind = 'BASE_DATOS_JISC';
      }
    }

    parsed.push({ name: f.name, kind, workbook: wb });
  }

  const order: Record<ParsedFile['kind'], number> = {
    BASE_DATOS_JISC: 1,
    DIRECTORAS_COHORTE: 2,
    MATRICULA_NIVEL: 3,
    DOTACION_JISC: 4,
    B3_NOMINAL: 5,
    DESCONOCIDO: 99,
  };
  parsed.sort((a, b) => order[a.kind] - order[b.kind]);

  const codUeToRbd = new Map<string, string>(Object.entries(JISC_COD_UE_TO_RBD));
  const estList = await listarEstablecimientos();
  const estByRbd = new Map<string, Establecimiento>(estList.map((e) => [e.rbd.trim(), e]));
  for (const e of estList) {
    if (e.codigoJunji) codUeToRbd.set(e.codigoJunji.trim(), e.rbd.trim());
  }

  for (const pf of parsed) {
    if (pf.kind === 'DESCONOCIDO') {
      resultado.alertas.push(`Archivo no reconocido como planilla JISC compatible: ${pf.name}`);
      continue;
    }

    // -------------------------------------------------------------------------
    // 1. BASE DE DATOS JISC 2026.xlsx
    // -------------------------------------------------------------------------
    if (pf.kind === 'BASE_DATOS_JISC') {
      const ws = pf.workbook.worksheets[0];
      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const codUe = cellText(row.getCell(2).value);
        const rbdRaw = cellText(row.getCell(3).value);
        if (!codUe && !rbdRaw) continue;

        const rbd = resolveCanonicalRbd(rbdRaw) || codUeToRbd.get(codUe) || '';
        if (!rbd) continue;
        if (codUe) codUeToRbd.set(codUe, rbd);

        const localidad = cellText(row.getCell(4).value);
        const contraparte = cellText(row.getCell(5).value);
        const tipoEe = cellText(row.getCell(6).value).toUpperCase();
        const nomFantasia = cellText(row.getCell(7).value);
        const correoInst = cellText(row.getCell(8).value).replace('eduvalleduguillin.cl', 'eduvallediguillin.cl');
        const nombreDir = cellText(row.getCell(9).value);
        const telDir = cellText(row.getCell(11).value);
        const correoDir = cellText(row.getCell(12).value).replace('eduvalleduguillin.cl', 'eduvallediguillin.cl');
        const direccion = cellText(row.getCell(13).value);

        const prev = estByRbd.get(rbd);
        const cat = findSchoolByRbd(rbd);
        const tipo = tipoEe === 'SC' ? 'SALA_CUNA' : (prev?.tipo || cat?.tipo || 'JARDIN');
        const modalidades =
          tipoEe === 'SC'
            ? ['SALA_CUNA']
            : tipoEe === 'JI'
            ? ['NIVEL_MEDIO']
            : ['SALA_CUNA', 'NIVEL_MEDIO'];

        const updated: Establecimiento = {
          id: prev?.id || `est-${rbd}`,
          rbd,
          nombre: cat?.nombre || prev?.nombre || nomFantasia,
          comuna: prev?.comuna || cat?.comuna || 'Chillán',
          tipo,
          tipoPerfil: 'JARDIN_SALA_CUNA',
          modalidadesAutorizadas: modalidades,
          codigoJunji: codUe || prev?.codigoJunji,
          nombreFantasia: nomFantasia || prev?.nombreFantasia,
          localidad: localidad || prev?.localidad,
          direccion: direccion || prev?.direccion,
          horarioApertura: prev?.horarioApertura || '08:30',
          horarioCierre: prev?.horarioCierre || '16:30',
          regimen: 'No JEC',
          porcentajePrioritarios: prev?.porcentajePrioritarios ?? 75,
          director: nombreDir || prev?.director,
          asesorUatp: contraparte || prev?.asesorUatp,
          telefono: telDir || prev?.telefono,
          email: correoInst || correoDir || prev?.email,
          subvencionSepMensual: prev?.subvencionSepMensual,
          subvencionProRetencion: prev?.subvencionProRetencion,
          cupoHorasPieDiferencial: prev?.cupoHorasPieDiferencial,
          cupoHorasPieAsistentes: prev?.cupoHorasPieAsistentes,
        };
        await guardarEstablecimiento(updated, true);
        estByRbd.set(rbd, updated);
        resultado.establecimientosActualizados++;
      }
      resultado.archivosProcesados.push(pf.name);
    }

    // -------------------------------------------------------------------------
    // 2. DIRECTORAS SC_JI_ Rut Ingreso SLEP 2026.xlsx (Cohorte 2023)
    // -------------------------------------------------------------------------
    if (pf.kind === 'DIRECTORAS_COHORTE') {
      const ws = pf.workbook.getWorksheet('SLEP Cohorte 2023');
      if (!ws) continue;
      const directorasDoc: Docente[] = [];

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const slep = normalizeNorm(cellText(row.getCell(1).value));
        if (!slep.includes('DIGUILL')) continue;

        const rbdRaw = cellText(row.getCell(4).value);
        const rbd = resolveCanonicalRbd(rbdRaw);
        if (!rbd) continue;

        const nombreEst = cellText(row.getCell(5).value);
        const directoraNombre = cellText(row.getCell(8).value);
        const rutDir = normalizarRut(cellText(row.getCell(9).value));
        const correoDir = cellText(row.getCell(10).value).replace('eduvalleduguillin.cl', 'eduvallediguillin.cl');
        const telDir = cellText(row.getCell(11).value);
        const direccion = cellText(row.getCell(12).value);

        const prev = estByRbd.get(rbd);
        const cat = findSchoolByRbd(rbd);
        const updated: Establecimiento = {
          id: prev?.id || `est-${rbd}`,
          rbd,
          nombre: cat?.nombre || prev?.nombre || nombreEst,
          comuna: prev?.comuna || cat?.comuna || 'Chillán',
          tipo: prev?.tipo || cat?.tipo || 'JARDIN',
          tipoPerfil: 'JARDIN_SALA_CUNA',
          modalidadesAutorizadas: prev?.modalidadesAutorizadas || ['SALA_CUNA', 'NIVEL_MEDIO'],
          codigoJunji: prev?.codigoJunji,
          nombreFantasia: prev?.nombreFantasia || nombreEst,
          localidad: prev?.localidad,
          direccion: direccion || prev?.direccion,
          horarioApertura: prev?.horarioApertura || '08:30',
          horarioCierre: prev?.horarioCierre || '16:30',
          regimen: 'No JEC',
          porcentajePrioritarios: prev?.porcentajePrioritarios ?? 75,
          director: directoraNombre || prev?.director,
          asesorUatp: prev?.asesorUatp,
          telefono: telDir || prev?.telefono,
          email: prev?.email || correoDir,
        };
        await guardarEstablecimiento(updated, true);
        estByRbd.set(rbd, updated);

        if (rutDir && directoraNombre) {
          const cleanRun = rutDir.replace(/[^0-9kK]/g, '');
          const partes = directoraNombre.split(' ');
          const nombres = partes.slice(0, Math.max(1, partes.length - 2)).join(' ');
          const apellidos = partes.slice(Math.max(1, partes.length - 2)).join(' ');
          directorasDoc.push({
            id: `vtf_dir_${rbd}_${cleanRun}`,
            rbd,
            periodo,
            run: rutDir,
            nombres: nombres || directoraNombre,
            apellidos,
            calidadJuridica: 'TITULAR',
            estamento: 'DIRECTIVO',
            horasContrato: 44,
            horasSubvencionGeneralTitular: 44,
            horasDirectivas: 44,
            cargoInstitucional: 'DIRECTORA DE JARDÍN INFANTIL',
            funcionPrincipal: 'Función Directiva',
            esEducadoraParvulo: true,
            esVtf: true,
            funcionVtf: 'Función Directiva',
            propuestaGdp: 'Continuidad',
            horasVigentesAnterior: 44,
          });
          resultado.directorasSincronizadas++;
        }
      }

      if (directorasDoc.length > 0) {
        await guardarDocentesBatch(directorasDoc);
      }
      resultado.archivosProcesados.push(pf.name);
    }

    // -------------------------------------------------------------------------
    // 3. MATRICULA POR NIVEL.xlsx
    // -------------------------------------------------------------------------
    if (pf.kind === 'MATRICULA_NIVEL') {
      const ws = pf.workbook.getWorksheet('Matricula por nivel');
      if (!ws) continue;

      const nivelesExistentes = await listarTodosJiscNiveles(periodo);
      const nivelesMap = new Map<string, JiscNivelParvularia>();
      for (const n of nivelesExistentes) {
        nivelesMap.set(`${n.rbd}__${n.subtipoNivel}`, n);
      }

      const defs: Array<{ colMat: number; colCap: number; subtipo: SubtipoNivelJisc }> = [
        { colMat: 2, colCap: 9, subtipo: 'SALA_CUNA_MENOR' },
        { colMat: 3, colCap: 10, subtipo: 'SALA_CUNA_MAYOR' },
        { colMat: 4, colCap: 11, subtipo: 'SALA_CUNA_HETEROGENEA' },
        { colMat: 5, colCap: 12, subtipo: 'MEDIO_MENOR' },
        { colMat: 6, colCap: 13, subtipo: 'MEDIO_MAYOR' },
        { colMat: 7, colCap: 14, subtipo: 'MEDIO_HETEROGENEO' },
      ];

      const batchNiveles: JiscNivelParvularia[] = [];
      for (let r = 3; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const nombreEst = cellText(row.getCell(1).value);
        if (!nombreEst || normalizeNorm(nombreEst).startsWith('TOTAL')) continue;

        const rbd = resolverRbdJiscPorNombre(nombreEst, undefined, Array.from(estByRbd.values()));
        if (!rbd) {
          resultado.alertas.push(`Matricula por nivel: no se encontró RBD para "${nombreEst}".`);
          continue;
        }
        const est = estByRbd.get(rbd);
        let correlCounter = 1;

        for (const d of defs) {
          const mat = cellNumber(row.getCell(d.colMat).value);
          const cap = cellNumber(row.getCell(d.colCap).value);
          if (mat === 0 && cap === 0) continue;

          const key = `${rbd}__${d.subtipo}`;
          const prev = nivelesMap.get(key);
          const correl = prev?.correlGrupo || correlCounter++;

          const item: JiscNivelParvularia = {
            id: prev?.id || `jisc_niv_${rbd}_${periodo}_${d.subtipo}`,
            rbd,
            periodo,
            codigoUeJunji: prev?.codigoUeJunji || est?.codigoJunji,
            correlGrupo: correl,
            nivelNombre: labelSubtipoNivel(d.subtipo),
            subtipoNivel: d.subtipo,
            esHeterogeneo: d.subtipo.includes('HETEROGEN'),
            capacidadAutorizada: cap || mat,
            matriculaActiva: mat,
            retiros: prev?.retiros || 0,
            asistenciaPromedio: prev?.asistenciaPromedio || 0,
            edadMesesMin: prev?.edadMesesMin,
            edadMesesMax: prev?.edadMesesMax,
            jornada: prev?.jornada || 'COMPLETA',
            horarioInicio: prev?.horarioInicio || '08:30',
            horarioFin: prev?.horarioFin || '16:30',
            tieneExtensionHoraria: prev?.tieneExtensionHoraria || false,
            matriculaExtension: prev?.matriculaExtension || 0,
            educadorasAsignadasJisc: prev?.educadorasAsignadasJisc || 0,
            tecnicosAsignadosJisc: prev?.tecnicosAsignadosJisc || 0,
            directorasAsignadasJisc: prev?.directorasAsignadasJisc || 0,
            fuenteDato: 'MATRICULA_NIVEL',
          };
          batchNiveles.push(item);
          nivelesMap.set(key, item);
        }
      }

      if (batchNiveles.length > 0) {
        await guardarJiscNivelesBatch(batchNiveles);
        resultado.nivelesActualizados += batchNiveles.length;
        resultado.cursosSincronizados += await sincronizarCursosDesdeNivelesJisc(batchNiveles, periodo);
      }
      resultado.archivosProcesados.push(pf.name);
    }

    // -------------------------------------------------------------------------
    // 4. PLANILLA DOTACIÓN JISC 2026.xlsx
    // -------------------------------------------------------------------------
    if (pf.kind === 'DOTACION_JISC') {
      const ws = pf.workbook.getWorksheet('Dotación por nivel') || pf.workbook.getWorksheet('Dotacion por nivel');
      if (!ws) continue;

      const nivelesExistentes = await listarTodosJiscNiveles(periodo);
      const batchUpdate: JiscNivelParvularia[] = [];
      let currentEstName = '';
      let currentComuna = '';

      for (let r = 5; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const estCell = cellText(row.getCell(2).value);
        const comCell = cellText(row.getCell(3).value);
        const nivelCell = cellText(row.getCell(4).value);

        if (estCell) currentEstName = estCell;
        if (comCell) currentComuna = comCell;
        if (!currentEstName || !nivelCell) continue;
        if (normalizeNorm(currentEstName).startsWith('TOTAL')) continue;

        const rbd = resolverRbdJiscPorNombre(currentEstName, currentComuna, Array.from(estByRbd.values()));
        if (!rbd) continue;

        const subtipo = inferirSubtipoNivelVtf(nivelCell);
        const educ = cellNumber(row.getCell(5).value);
        const tec = cellNumber(row.getCell(6).value);
        const dir = cellNumber(row.getCell(7).value);

        const match = nivelesExistentes.find(
          (n) => n.rbd === rbd && (n.subtipoNivel === subtipo || normalizeNorm(n.nivelNombre) === normalizeNorm(nivelCell))
        );
        if (match) {
          batchUpdate.push({
            ...match,
            educadorasAsignadasJisc: educ,
            tecnicosAsignadosJisc: tec,
            directorasAsignadasJisc: dir,
            fuenteDato: match.fuenteDato === 'B3' ? 'B3' : 'DOTACION_JISC',
          });
        } else {
          batchUpdate.push({
            id: `jisc_niv_${rbd}_${periodo}_${subtipo}`,
            rbd,
            periodo,
            codigoUeJunji: estByRbd.get(rbd)?.codigoJunji,
            correlGrupo: nivelesExistentes.filter((n) => n.rbd === rbd).length + 1,
            nivelNombre: nivelCell,
            subtipoNivel: subtipo,
            esHeterogeneo: subtipo.includes('HETEROGEN'),
            capacidadAutorizada: subtipo.includes('SALA_CUNA') ? 20 : 32,
            matriculaActiva: 0,
            retiros: 0,
            jornada: 'COMPLETA',
            horarioInicio: '08:30',
            horarioFin: '16:30',
            tieneExtensionHoraria: false,
            matriculaExtension: 0,
            educadorasAsignadasJisc: educ,
            tecnicosAsignadosJisc: tec,
            directorasAsignadasJisc: dir,
            fuenteDato: 'DOTACION_JISC',
          });
        }
      }

      if (batchUpdate.length > 0) {
        await guardarJiscNivelesBatch(batchUpdate);
        resultado.nivelesActualizados += batchUpdate.length;
      }
      resultado.archivosProcesados.push(pf.name);
    }

    // -------------------------------------------------------------------------
    // 5. B3 SLEP VALLE DIGUILLIN.xlsx (Fuente nominal de párvulos y edades reales)
    // -------------------------------------------------------------------------
    if (pf.kind === 'B3_NOMINAL') {
      const ws = pf.workbook.worksheets[0];
      const headersRow = ws.getRow(1);
      const colIdx = new Map<string, number>();
      headersRow.eachCell((cell, colNumber) => {
        const key = cellText(cell.value).toUpperCase().trim();
        if (key) colIdx.set(key, colNumber);
      });

      const idxCodEst = colIdx.get('COD_ESTABLEC') || 5;
      const idxNomEst = colIdx.get('NOM_ESTABLEC') || 7;
      const idxCorrel = colIdx.get('CORREL_GRUPO') || 8;
      const idxDescNivel = colIdx.get('DESC_NIVEL') || 9;
      const idxDescProg = colIdx.get('DESC_PROG') || 11;
      const idxCapAt = colIdx.get('CAPACIDAD_AT') || 12;
      const idxRun = colIdx.get('RUN') || 13;
      const idxDv = colIdx.get('DV_RUN') || 14;
      const idxFechaInc = colIdx.get('FECHA_INCORPORACION') || 17;
      const idxFechaRet = colIdx.get('FECHA_RETIRO') || 18;
      const idxFechaNac = colIdx.get('FECHA_NAC') || 22;
      const idxEdadMeses = colIdx.get('EDAD_MESES_AL_ULTIMO_DIA_MES') || 24;
      const idxDescJorna = colIdx.get('DESC_JORNA') || 25;
      const idxAsist = colIdx.get('ASISTENCIA') || 30;
      const idxDiasTrab = colIdx.get('DIAS_TRABAJADOS') || 32;
      const idxNee = colIdx.get('NEE_SI_NO') || 55;
      const idxExtHora = colIdx.get('EXT_HORA_SI_NO') || 57;

      const existentes = await listarTodosJiscNiveles(periodo);
      const prevMap = new Map(existentes.map((n) => [`${n.rbd}__${n.correlGrupo}`, n]));

      interface GrupoAgg {
        rbd: string;
        codUe: string;
        correlGrupo: number;
        descNivel: string;
        codPrograma: string;
        capacidadAt: number;
        activos: number;
        retiros: number;
        edadMin?: number;
        edadMax?: number;
        extCount: number;
        asistSum: number;
        diasSum: number;
        jornadaRaw: string;
      }

      const gruposAgg = new Map<string, GrupoAgg>();
      const parvulosPorRbd = new Map<string, JiscParvuloB3[]>();

      for (let r = 2; r <= ws.rowCount; r++) {
        const row = ws.getRow(r);
        const codUe = cellText(row.getCell(idxCodEst).value);
        const nomEst = cellText(row.getCell(idxNomEst).value);
        if (!codUe && !nomEst) continue;

        const rbd = codUeToRbd.get(codUe) || resolverRbdJiscPorNombre(nomEst, undefined, Array.from(estByRbd.values()));
        if (!rbd) continue;

        const correlGrupo = cellNumber(row.getCell(idxCorrel).value) || 1;
        const descNivel = cellText(row.getCell(idxDescNivel).value) || 'Nivel Medio Mixto';
        const codPrograma = cellText(row.getCell(idxDescProg).value);
        const capacidadAt = cellNumber(row.getCell(idxCapAt).value);
        const runBody = cellText(row.getCell(idxRun).value);
        const dv = cellText(row.getCell(idxDv).value);
        const rutParvulo = runBody ? `${runBody}-${dv}` : '';
        const fechaInc = cellText(row.getCell(idxFechaInc).value);
        const fechaRet = cellText(row.getCell(idxFechaRet).value);
        const fechaNac = cellText(row.getCell(idxFechaNac).value);
        const edadMeses = cellNumber(row.getCell(idxEdadMeses).value);
        const jornadaRaw = cellText(row.getCell(idxDescJorna).value).toUpperCase();
        const presentesMes = cellNumber(row.getCell(idxAsist).value);
        const diasTrab = cellNumber(row.getCell(idxDiasTrab).value);
        const neeStr = cellText(row.getCell(idxNee).value).toUpperCase();
        const extStr = cellText(row.getCell(idxExtHora).value).toUpperCase();
        const activo = !fechaRet;
        const tieneExt = extStr === 'SI' || extStr === 'S' || extStr === '1' || extStr === 'TRUE';

        const pctAsist = diasTrab > 0 ? Math.round((presentesMes / diasTrab) * 1000) / 10 : 0;
        const parvuloId = `b3_${rbd}_${periodo}_g${correlGrupo}_${rutParvulo || r}`;

        if (!parvulosPorRbd.has(rbd)) parvulosPorRbd.set(rbd, []);
        parvulosPorRbd.get(rbd)!.push({
          id: parvuloId,
          rbd,
          periodo,
          codigoUeJunji: codUe,
          correlGrupo,
          descNivel,
          rutParvulo: rutParvulo || undefined,
          edadMeses,
          fechaNacimiento: fechaNac || undefined,
          fechaIngreso: fechaInc || undefined,
          fechaRetiro: fechaRet || undefined,
          activo,
          presentesMes,
          diasTrabajadosMes: diasTrab,
          porcentajeAsistencia: pctAsist,
          requiereNee: neeStr === 'SI' || neeStr === 'S' || neeStr === '1',
        });

        const gKey = `${rbd}__${correlGrupo}`;
        if (!gruposAgg.has(gKey)) {
          gruposAgg.set(gKey, {
            rbd,
            codUe,
            correlGrupo,
            descNivel,
            codPrograma,
            capacidadAt,
            activos: 0,
            retiros: 0,
            extCount: 0,
            asistSum: 0,
            diasSum: 0,
            jornadaRaw,
          });
        }
        const agg = gruposAgg.get(gKey)!;
        if (capacidadAt > agg.capacidadAt) agg.capacidadAt = capacidadAt;
        if (activo) {
          agg.activos++;
          if (edadMeses > 0) {
            agg.edadMin = agg.edadMin === undefined ? edadMeses : Math.min(agg.edadMin, edadMeses);
            agg.edadMax = agg.edadMax === undefined ? edadMeses : Math.max(agg.edadMax, edadMeses);
          }
          if (tieneExt) agg.extCount++;
          agg.asistSum += presentesMes;
          agg.diasSum += diasTrab;
        } else {
          agg.retiros++;
        }
      }

      // Guardar nómina nominal B3 reemplazada por RBD
      for (const [rbd, lista] of parvulosPorRbd.entries()) {
        await guardarParvulosB3Batch(lista, { rbd, periodo });
        resultado.parvulosB3Cargados += lista.length;
      }

      // Consolidar niveles JISC y sincronizar cursos SAE
      const nivelesB3: JiscNivelParvularia[] = [];
      for (const agg of gruposAgg.values()) {
        const subtipo = inferirSubtipoNivelVtf(agg.descNivel);
        const prev = prevMap.get(`${agg.rbd}__${agg.correlGrupo}`) ||
          existentes.find((n) => n.rbd === agg.rbd && n.subtipoNivel === subtipo);

        const asistenciaProm = agg.diasSum > 0 ? Math.round((agg.asistSum / agg.diasSum) * 1000) / 10 : 0;
        const jor: JiscNivelParvularia['jornada'] = agg.jornadaRaw.includes('MAÑANA') || agg.jornadaRaw.includes('MANANA')
          ? 'MANANA'
          : agg.jornadaRaw.includes('TARDE')
          ? 'TARDE'
          : 'COMPLETA';

        nivelesB3.push({
          id: prev?.id || `jisc_niv_${agg.rbd}_${periodo}_g${agg.correlGrupo}`,
          rbd: agg.rbd,
          periodo,
          codigoUeJunji: agg.codUe,
          correlGrupo: agg.correlGrupo,
          codPrograma: agg.codPrograma || undefined,
          nivelNombre: agg.descNivel,
          subtipoNivel: subtipo,
          esHeterogeneo: subtipo.includes('HETEROGEN'),
          capacidadAutorizada: agg.capacidadAt || prev?.capacidadAutorizada || 28,
          matriculaActiva: agg.activos,
          retiros: agg.retiros,
          asistenciaPromedio: asistenciaProm,
          edadMesesMin: agg.edadMin,
          edadMesesMax: agg.edadMax,
          edadMinimaCriterio: agg.edadMin,
          jornada: jor,
          horarioInicio: '08:30',
          horarioFin: agg.extCount > 0 ? '19:30' : '16:30',
          tieneExtensionHoraria: agg.extCount > 0,
          matriculaExtension: agg.extCount,
          educadorasAsignadasJisc: prev?.educadorasAsignadasJisc || 0,
          tecnicosAsignadosJisc: prev?.tecnicosAsignadosJisc || 0,
          directorasAsignadasJisc: prev?.directorasAsignadasJisc || 0,
          fuenteDato: 'B3',
        });

        // Asegurar horario de extensión en establecimiento si detectamos párvulos con EXT_HORA
        const est = estByRbd.get(agg.rbd);
        if (est && agg.extCount > 0 && !est.horarioExtensionCierre) {
          const updEst: Establecimiento = {
            ...est,
            horarioApertura: est.horarioApertura || '08:30',
            horarioCierre: est.horarioCierre || '16:30',
            horarioExtensionInicio: '16:30',
            horarioExtensionCierre: '19:30',
          };
          await guardarEstablecimiento(updEst, true);
          estByRbd.set(agg.rbd, updEst);
        }
      }

      if (nivelesB3.length > 0) {
        await guardarJiscNivelesBatch(nivelesB3);
        resultado.nivelesActualizados += nivelesB3.length;
        resultado.cursosSincronizados += await sincronizarCursosDesdeNivelesJisc(nivelesB3, periodo);
      }
      resultado.archivosProcesados.push(pf.name);
    }
  }

  return resultado;
}
