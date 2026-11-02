import { SigeDocenteRow, Docente, Establecimiento, EstamentoDocente, CalidadJuridicaDocente } from '../types';
import { identifySchool } from '../data/slepSchoolsCatalog';
import { validarRut, normalizarRut } from '../utils/rutUtils';
import * as XLSX from 'xlsx';

// Diccionario de rescate para reparar caracteres dañados o corruptos ('' / \ufffd)
// La clave contiene [BAD] en la posición donde se corrompió la letra
const DICCIONARIO_RESCATE: Record<string, string> = {
  // Nombres y Apellidos comunes en Chile con carácter corrupto [BAD] (\ufffd, \uFFFD, ?)
  'PE[BAD]A': 'PEÑA',
  'MU[BAD]OZ': 'MUÑOZ',
  'ACU[BAD]A': 'ACUÑA',
  'CAMA[BAD]O': 'CAMAÑO',
  'CASTA[BAD]EDA': 'CASTAÑEDA',
  'BRICE[BAD]O': 'BRICEÑO',
  'GUI[BAD]EZ': 'GUÍÑEZ',
  'GU[BAD]EZ': 'GUÍÑEZ',
  'NU[BAD]EZ': 'NÚÑEZ',
  'ZU[BAD]IGA': 'ZÚÑIGA',
  'A[BAD]EZ': 'AÑEZ',
  'I[BAD]IGO': 'IÑIGO',
  'AVENDA[BAD]O': 'AVENDAÑO',
  'D[BAD]AZ': 'DÍAZ',
  'GONZ[BAD]LEZ': 'GONZÁLEZ',
  'RODR[BAD]GUEZ': 'RODRÍGUEZ',
  'HERN[BAD]NDEZ': 'HERNÁNDEZ',
  'L[BAD]PEZ': 'LÓPEZ',
  'P[BAD]REZ': 'PÉREZ',
  'S[BAD]NCHEZ': 'SÁNCHEZ',
  'RAM[BAD]REZ': 'RAMÍREZ',
  'MART[BAD]NEZ': 'MARTÍNEZ',
  'JIM[BAD]NEZ': 'JIMÉNEZ',
  'MEL[BAD]NDEZ': 'MELÉNDEZ',
  'ALARC[BAD]N': 'ALARCÓN',
  'CORVAL[BAD]N': 'CORVALÁN',
  'MAR[BAD]A': 'MARÍA',
  'RUB[BAD]N': 'RUBÉN',
  'JOS[BAD]': 'JOSÉ',
  'TOM[BAD]S': 'TOMÁS',
  'HERN[BAD]N': 'HERNÁN',
  'AGUST[BAD]N': 'AGUSTÍN',
  'VER[BAD]NICA': 'VERÓNICA',
  'M[BAD]NICA': 'MÓNICA',
  'SEP[BAD]LVEDA': 'SEPÚLVEDA',
  'C[BAD]CERES': 'CÁCERES',
  'C[BAD]RDENAS': 'CÁRDENAS',
  'B[BAD]RBARA': 'BÁRBARA',
  'RA[BAD]L': 'RAÚL',
  'SA[BAD]L': 'SAÚL',
  'ANDR[BAD]S': 'ANDRÉS',
  'MAT[BAD]AS': 'MATÍAS',
  'SEBASTI[BAD]N': 'SEBASTIÁN',
  'CRISTI[BAD]N': 'CRISTIÁN',
  'JOAQU[BAD]N': 'JOAQUÍN',
  'BENJAM[BAD]N': 'BENJAMÍN',
  'BEL[BAD]N': 'BELÉN',
  'IN[BAD]S': 'INÉS',
  'PIL[BAD]N': 'PILÁN',
  'B[BAD]O-B[BAD]O': 'BÍO-BÍO',
  'BIO-B[BAD]O': 'BIO-BÍO',

  // Asignaturas, Cargos y Términos MINEDUC / SIGE con carácter corrupto [BAD]
  'SIN T[BAD]TULO': 'SIN TÍTULO',
  'T[BAD]TULO': 'TÍTULO',
  'PSIC[BAD]LOGO': 'PSICÓLOGO',
  'PSIC[BAD]LOGA': 'PSICÓLOGA',
  'PSIC[BAD]LOGO/A': 'PSICÓLOGO/A',
  'FONOAUDI[BAD]LOGO': 'FONOAUDIÓLOGO',
  'FONOAUDI[BAD]LOGA': 'FONOAUDIÓLOGA',
  'FONOAUDI[BAD]LOGO/A': 'FONOAUDIÓLOGO/A',
  'KINESI[BAD]LOGO': 'KINESIÓLOGO',
  'KINESI[BAD]LOGA': 'KINESIÓLOGA',
  'KINESI[BAD]LOGO/A': 'KINESIÓLOGO/A',
  'MANTENCI[BAD]N': 'MANTENCIÓN',
  'ENCARGADO/A DE MANTENCI[BAD]N': 'ENCARGADO/A DE MANTENCIÓN',
  'EDUCACI[BAD]N': 'EDUCACIÓN',
  'F[BAD]SICA': 'FÍSICA',
  'B[BAD]SICA': 'BÁSICA',
  'COMUNICACI[BAD]N': 'COMUNICACIÓN',
  'INGL[BAD]S': 'INGLÉS',
  'MATEM[BAD]TICA': 'MATEMÁTICA',
  'RELIGI[BAD]N': 'RELIGIÓN',
  'T[BAD]CNICO': 'TÉCNICO',
  'T[BAD]CNICA': 'TÉCNICA',
  'T[BAD]CNICO-PEDAG[BAD]GICA': 'TÉCNICO-PEDAGÓGICA',
  'PEDAG[BAD]GICA': 'PEDAGÓGICA',
  'PEDAG[BAD]GICO': 'PEDAGÓGICO',
  'ALIMENTACI[BAD]N': 'ALIMENTACIÓN',
  'P[BAD]RVULO': 'PÁRVULO',
  'P[BAD]RVULOS': 'PÁRVULOS',
  'PARVULARIA': 'PARVULARIA',
  'INSPECCI[BAD]N': 'INSPECCIÓN',
  'ADMINISTRACI[BAD]N': 'ADMINISTRACIÓN',
  'COORDINACI[BAD]N': 'COORDINACIÓN',
  'DIRECCI[BAD]N': 'DIRECCIÓN',
  'ORIENTACI[BAD]N': 'ORIENTACIÓN',
  'INTEGRACI[BAD]N': 'INTEGRACIÓN',
  'HABILITACI[BAD]N': 'HABILITACIÓN',
  'EVALUACI[BAD]N': 'EVALUACIÓN',
  'DURACI[BAD]N': 'DURACIÓN',
  'FUNCI[BAD]N': 'FUNCIÓN',
  'A[BAD]OS': 'AÑOS'
};

// Diccionario para cuando el exportador o sanitizador omitió completamente el caracter corrupto
const DICCIONARIO_OMISIONES: Record<string, string> = {
  'SIN TTULO': 'SIN TÍTULO',
  'TTULO': 'TÍTULO',
  'VERNICA': 'VERÓNICA',
  'MARA': 'MARÍA',
  'AEZ': 'AÑEZ',
  'MUOZ': 'MUÑOZ',
  'JOS': 'JOSÉ',
  'MANTENCIN': 'MANTENCIÓN',
  'PSICLOGO': 'PSICÓLOGO',
  'PSICLOGA': 'PSICÓLOGA',
  'PSICLOGO/A': 'PSICÓLOGO/A',
  'FONOAUDILOGO': 'FONOAUDIÓLOGO',
  'FONOAUDILOGA': 'FONOAUDIÓLOGA',
  'FONOAUDILOGO/A': 'FONOAUDIÓLOGO/A',
  'KINESILOGO': 'KINESIÓLOGO',
  'KINESILOGA': 'KINESIÓLOGA',
  'SEPLVEDA': 'SEPÚLVEDA',
  'CCERES': 'CÁCERES',
  'PEA': 'PEÑA',
  'ACUA': 'ACUÑA',
  'CAMAO': 'CAMAÑO',
  'CASTAEDA': 'CASTAÑEDA',
  'BRICEO': 'BRICEÑO',
  'GUIEZ': 'GUÍÑEZ',
  'NUEZ': 'NÚÑEZ',
  'ZUIGA': 'ZÚÑIGA',
  'DAZ': 'DÍAZ',
  'GONZLEZ': 'GONZÁLEZ',
  'RODRGUEZ': 'RODRÍGUEZ',
  'HERNNDEZ': 'HERNÁNDEZ',
  'LPEZ': 'LÓPEZ',
  'PREZ': 'PÉREZ',
  'SNCHEZ': 'SÁNCHEZ',
  'RAMREZ': 'RAMÍREZ',
  'MARTNEZ': 'MARTÍNEZ',
  'JIMNEZ': 'JIMÉNEZ',
  'MELNDEZ': 'MELÉNDEZ',
  'ALARCN': 'ALARCÓN',
  'CORVALN': 'CORVALÁN',
  'RUBN': 'RUBÉN',
  'TOMS': 'TOMÁS',
  'HERNN': 'HERNÁN',
  'AGUSTN': 'AGUSTÍN',
  'MNICA': 'MÓNICA',
  'CRDENAS': 'CÁRDENAS',
  'BRBARA': 'BÁRBARA',
  'RAL': 'RAÚL',
  'SAL': 'SAÚL',
  'ANDRS': 'ANDRÉS',
  'MATAS': 'MATÍAS',
  'SEBASTIN': 'SEBASTIÁN',
  'CRISTIN': 'CRISTIÁN',
  'JOAQUN': 'JOAQUÍN',
  'BENJAMN': 'BENJAMÍN',
  'BELN': 'BELÉN',
  'INS': 'INÉS',
  'PILN': 'PILÁN',
  'EDUCACIN': 'EDUCACIÓN',
  'FSICA': 'FÍSICA',
  'BSICA': 'BÁSICA',
  'COMUNICACIN': 'COMUNICACIÓN',
  'INGLS': 'INGLÉS',
  'MATEMTICA': 'MATEMÁTICA',
  'RELIGIN': 'RELIGIÓN',
  'TCNICO': 'TÉCNICO',
  'TCNICA': 'TÉCNICA',
  'TCNICO-PEDAGGICA': 'TÉCNICO-PEDAGÓGICA',
  'PEDAGGICA': 'PEDAGÓGICA',
  'PEDAGGICO': 'PEDAGÓGICO',
  'ALIMENTACIN': 'ALIMENTACIÓN',
  'PRVULO': 'PÁRVULO',
  'PRVULOS': 'PÁRVULOS',
  'INSPECCIN': 'INSPECCIÓN',
  'ADMINISTRACIN': 'ADMINISTRACIÓN',
  'COORDINACIN': 'COORDINACIÓN',
  'DIRECCIN': 'DIRECCIÓN',
  'ORIENTACIN': 'ORIENTACIÓN',
  'INTEGRACIN': 'INTEGRACIÓN',
  'HABILITACIN': 'HABILITACIÓN',
  'EVALUACIN': 'EVALUACIÓN',
  'DURACIN': 'DURACIÓN',
  'FUNCIN': 'FUNCIÓN',
  'AOS': 'AÑOS'
};

const MOJIBAKE_MAP: Record<string, string> = {
  'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú',
  'Ã': 'Á', 'Ã‰': 'É', 'Ã': 'Í', 'Ã“': 'Ó', 'Ãš': 'Ú',
  'Ã±': 'ñ', 'Ã‘': 'Ñ', 'Â°': '°'
};

/**
 * Limpia y normaliza texto proveniente de exportaciones SIGE.
 * Repara mojibake, tildes y eñes perdidas sin alterar nombres válidos como Marta.
 */
export function limpiarTextoMineduc(texto: string): string {
  if (!texto) return '';
  let res = texto.trim();

  // 1. Corrección de mojibake UTF-8 decodificado erróneamente
  for (const [bad, good] of Object.entries(MOJIBAKE_MAP)) {
    if (res.includes(bad)) {
      res = res.replaceAll(bad, good);
    }
  }

  // 2. Rescate de caracteres corruptos usando diccionario fonético oficial (\ufffd, \uFFFD, ?)
  if (res.includes('\ufffd') || res.includes('\uFFFD') || res.includes('�') || res.includes('')) {
    for (const [patron, reemplazo] of Object.entries(DICCIONARIO_RESCATE)) {
      const regPattern = patron.replace(/\[BAD\]/g, '[\ufffd\uFFFD]');
      const reg = new RegExp(`(^|[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ])${regPattern}(?=[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]|$)`, 'gi');
      res = res.replace(reg, (match, prefix) => prefix + reemplazo);
    }
    // Reemplazo genérico para cualquier carácter residual que quede
    res = res.replaceAll('\ufffd', '').replaceAll('\uFFFD', '').replaceAll('�', '').replaceAll('', '');
  }

  // 3. Rescate de caracteres que fueron omitidos por exportadores o recortes de codificación
  for (const [mal, bien] of Object.entries(DICCIONARIO_OMISIONES)) {
    const reg = new RegExp(`(^|[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ])${mal}(?=[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ]|$)`, 'gi');
    res = res.replace(reg, (match, prefix) => prefix + bien);
  }

  // Quitar dobles espacios
  return res.replace(/\s+/g, ' ').trim();
}

/**
 * Convierte un texto a Title Case respetando acentos y eñes
 */
export function toTitleCase(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(palabra => palabra.charAt(0).toUpperCase() + palabra.slice(1))
    .join(' ');
}

/**
 * Decodifica un ArrayBuffer a string protegiendo la codificación nativa de SIGE (Windows-1252)
 * y soportando además libros Excel (.xlsx / .xls).
 */
export function decodificarArchivoSige(buffer: ArrayBuffer, nombreArchivo: string): string {
  const ext = nombreArchivo.toLowerCase().split('.').pop() || '';

  // Si es un archivo Excel (.xlsx, .xls)
  if (['xlsx', 'xls', 'xlsm'].includes(ext)) {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    // Convertir la hoja a CSV delimitado por punto y coma (formato canónico SIGE)
    return XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
  }

  // Si es CSV o TXT crudo de SIGE:
  // Intentar con windows-1252 primero (donde 0xD1 es Ñ y 0xC1 es Á)
  try {
    const winDecoder = new TextDecoder('windows-1252');
    const textoWin = winDecoder.decode(buffer);
    // Verificar si decodificó limpiamente
    if (!textoWin.includes('')) {
      return textoWin;
    }
    // Si contiene , probar con UTF-8 por si ya venía guardado en UTF-8
    const utf8Decoder = new TextDecoder('utf-8');
    const textoUtf8 = utf8Decoder.decode(buffer);
    if (!textoUtf8.includes('')) {
      return textoUtf8;
    }
    return textoWin;
  } catch {
    const fallbackDecoder = new TextDecoder('utf-8');
    return fallbackDecoder.decode(buffer);
  }
}

export interface FuncionarioMultiEstablecimientoInfo {
  run: string;
  nombre: string;
  totalHoras: number;
  rbds: string[];
  excede44h: boolean;
}

export interface ResultadoParseoSige {
  rbdDetectado: string;
  nombreColegioDetectado: string;
  filas: SigeDocenteRow[];
  docentesConvertidos: Docente[];
  establecimientoSugerido: Establecimiento;
  establecimientosDetectados: Establecimiento[];
  funcionariosMultiEstablecimiento: FuncionarioMultiEstablecimientoInfo[];
  totales: {
    totalDocentes: number;
    totalHorasContrato: number;
    totalHorasDirectivas: number;
    totalHorasTecnicas: number;
    totalHorasAula: number;
  };
  advertencias: Array<{ linea: number; run: string; mensaje: string }>;
}

/**
 * Parsea el contenido en texto plano de una exportación oficial SIGE MINEDUC
 */
export function parsearPlanillaSige(contenidoTexto: string, rbdDestino?: string, periodo: number = 2027): ResultadoParseoSige {
  const lineas = contenidoTexto
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lineas.length === 0) {
    throw new Error('El archivo proporcionado está vacío.');
  }

  // Detectar delimitador (punto y coma prioritario en SIGE, o coma si fue exportado por Excel)
  const primeraLinea = lineas[0];
  const separador = primeraLinea.includes(';') ? ';' : ',';

  const cabeceras = primeraLinea
    .split(separador)
    .map(c => limpiarTextoMineduc(c).toUpperCase());

  // Búsqueda flexible de columnas por nombres estándar de SIGE o reportes de personal
  const getIndex = (...nombres: string[]) => {
    for (const n of nombres) {
      const idx = cabeceras.indexOf(n);
      if (idx !== -1) return idx;
    }
    // Búsqueda parcial
    for (const n of nombres) {
      const idx = cabeceras.findIndex(c => c.includes(n));
      if (idx !== -1) return idx;
    }
    return -1;
  };

  const idxRun = getIndex('DOC_RUN', 'RUN', 'RUT', 'R.U.N.', 'RUT / RUN');
  const idxDv = getIndex('DOC_DV', 'DV');
  const idxNombre = getIndex('DOC_NOMBRE', 'DOC_NOMBRES', 'NOMBRES', 'NOMBRE', 'FUNCIONARIO');
  const idxPaterno = getIndex('DOC_PATERNO', 'APELLIDO_PATERNO', 'PATERNO');
  const idxMaterno = getIndex('DOC_MATERNO', 'APELLIDO_MATERNO', 'MATERNO');
  const idxRbd = getIndex('RBD', 'COLEGIO');
  const idxNombreEsta = getIndex('NOMBRE_ESTA', 'NOMBRE_ESTAB', 'ESTABLECIMIENTO', 'ESCUELA');
  const idxFuncP = getIndex('FUNCION_PRINCIPAL', 'CARGO / FUNCIÓN', 'CARGO', 'FUNCION');
  const idxFuncS = getIndex('FUNCION_SECUNDARIA');
  const idxHorasContrato = getIndex('HORAS_CONTRATO', 'HORAS CONTRATO', 'HRS_CONTRATO');
  const idxHorasIngles = getIndex('HORAS_INGLES');
  const idxHorasDirectivas = getIndex('HORAS_DIRECTIVAS', 'DIRECTIVAS');
  const idxHorasTecnicas = getIndex('HORAS_TECNICO_PEDAGOGICA', 'HORAS_TECNICAS', 'TÉCNICAS');
  const idxHorasAula = getIndex('HORAS_AULA', 'AULA');
  const idxPedF1 = getIndex('HORAS_PEDAGOGICAS_FUNCION_1');
  const idxPedF2 = getIndex('HORAS_PEDAGOGICAS_FUNCION_2');
  const idxSec1 = getIndex('SECTOR_FUNCION_1');
  const idxSubSec1 = getIndex('SUB_SECTOR_FUNCION_1');
  const idxSec2 = getIndex('SECTOR_FUNCION_2');
  const idxSubSec2 = getIndex('SUB_SECTOR_FUNCION_2');
  const idxIdoneidad = getIndex('ESTADO_IDONEIDAD');

  if (idxRun === -1) {
    throw new Error('Formato no reconocido: No se encontró la columna de RUN / RUT en el archivo.');
  }

  const filas: SigeDocenteRow[] = [];
  const advertencias: Array<{ linea: number; run: string; mensaje: string }> = [];
  let rbdDetectado = rbdDestino || '';
  let nombreColegioDetectado = '';

  for (let i = 1; i < lineas.length; i++) {
    const cols = lineas[i].split(separador).map(c => c.trim());
    if (cols.length < 3) continue;

    const rawRunStr = cols[idxRun] || '';
    if (!rawRunStr || rawRunStr === '--') continue;

    // Obtener RUN y DV
    let runNumStr = '';
    let dv = '';

    if (idxDv !== -1 && cols[idxDv]) {
      runNumStr = rawRunStr.replace(/\D/g, '');
      dv = cols[idxDv].trim().toUpperCase();
    } else {
      const norm = normalizarRut(rawRunStr);
      if (norm.includes('-')) {
        const parts = norm.split('-');
        runNumStr = parts[0];
        dv = parts[1].toUpperCase();
      } else {
        runNumStr = rawRunStr.replace(/\D/g, '');
      }
    }

    if (!runNumStr) continue;

    const runCompleto = dv ? `${runNumStr}-${dv}` : runNumStr;
    const esRutValido = validarRut(runCompleto);
    if (!esRutValido && dv) {
      advertencias.push({
        linea: i + 1,
        run: runCompleto,
        mensaje: `El RUN ${runCompleto} presenta inconsistencia con el dígito verificador Módulo 11.`
      });
    }

    // Nombres y Apellidos
    let nombres = '';
    let apellidos = '';

    if (idxPaterno !== -1) {
      const pat = limpiarTextoMineduc(cols[idxPaterno] || '');
      const mat = idxMaterno !== -1 ? limpiarTextoMineduc(cols[idxMaterno] || '') : '';
      apellidos = `${pat} ${mat}`.trim();
      nombres = limpiarTextoMineduc(cols[idxNombre] || '');
    } else if (idxNombre !== -1) {
      // Si viene una columna combinada "Funcionario" o "Nombre Completo"
      const fullName = limpiarTextoMineduc(cols[idxNombre] || '');
      const parts = fullName.split(' ');
      if (parts.length >= 3) {
        nombres = parts.slice(0, parts.length - 2).join(' ');
        apellidos = parts.slice(parts.length - 2).join(' ');
      } else if (parts.length === 2) {
        nombres = parts[0];
        apellidos = parts[1];
      } else {
        nombres = fullName;
        apellidos = 'Docente';
      }
    }

    const rbdFila = idxRbd !== -1 ? cols[idxRbd]?.trim() : '';
    const nombreEstaFila = idxNombreEsta !== -1 ? limpiarTextoMineduc(cols[idxNombreEsta] || '') : '';

    if (!rbdDetectado && rbdFila) rbdDetectado = rbdFila;
    if (!nombreColegioDetectado && nombreEstaFila) nombreColegioDetectado = nombreEstaFila;

    const funcP = idxFuncP !== -1 ? limpiarTextoMineduc(cols[idxFuncP] || '') : 'DOCENTE DE AULA';
    const funcS = idxFuncS !== -1 ? limpiarTextoMineduc(cols[idxFuncS] || '') : '--';
    
    const parseIntSafe = (idx: number) => {
      if (idx === -1) return 0;
      const v = cols[idx]?.replace(/\D/g, '');
      return v ? parseInt(v, 10) : 0;
    };

    const hContrato = parseIntSafe(idxHorasContrato);
    const hIngles = parseIntSafe(idxHorasIngles);
    const hDirectivas = parseIntSafe(idxHorasDirectivas);
    const hTecnicas = parseIntSafe(idxHorasTecnicas);
    const hAula = parseIntSafe(idxHorasAula);
    const hPed1 = parseIntSafe(idxPedF1);
    const hPed2 = parseIntSafe(idxPedF2);
    const sec1 = idxSec1 !== -1 ? limpiarTextoMineduc(cols[idxSec1] || '') : '';
    const subSec1 = idxSubSec1 !== -1 ? limpiarTextoMineduc(cols[idxSubSec1] || '') : '';
    const sec2 = idxSec2 !== -1 ? limpiarTextoMineduc(cols[idxSec2] || '') : '';
    const subSec2 = idxSubSec2 !== -1 ? limpiarTextoMineduc(cols[idxSubSec2] || '') : '';
    const idoneidad = idxIdoneidad !== -1 ? cols[idxIdoneidad]?.trim() || 'OK' : 'OK';

    filas.push({
      runCompleto,
      run: runNumStr,
      dv,
      nombres: toTitleCase(nombres),
      apellidos: toTitleCase(apellidos),
      rbd: rbdFila || rbdDetectado,
      nombreEstablecimiento: nombreEstaFila || nombreColegioDetectado,
      funcionPrincipal: funcP || 'DOCENTE DE AULA',
      funcionSecundaria: funcS,
      horasContrato: hContrato,
      horasIngles: hIngles,
      horasDirectivas: hDirectivas,
      horasTecnicoPedagogica: hTecnicas,
      horasAula: hAula,
      horasPedagogicasFuncion1: hPed1,
      horasPedagogicasFuncion2: hPed2,
      sectorFuncion1: sec1,
      subSectorFuncion1: subSec1,
      sectorFuncion2: sec2,
      subSectorFuncion2: subSec2,
      estadoIdoneidad: idoneidad
    });
  }

  // Convertir a modelos Docente de la aplicación respetando el RBD propio de cada fila
  const docentesConvertidos: Docente[] = filas.map(f => {
    const rbdDocente = f.rbd || rbdDestino || rbdDetectado || '0';
    let estamento: EstamentoDocente = 'DOCENTE_AULA';
    const funcUpper = f.funcionPrincipal.toUpperCase();
    const sec1Upper = f.sectorFuncion1.toUpperCase();

    if (funcUpper.includes('DIRECTOR') || funcUpper.includes('INSPECTOR') || funcUpper.includes('ORIENTADOR')) {
      estamento = 'DIRECTIVO';
    } else if (
      funcUpper.includes('TÉCNICO') ||
      funcUpper.includes('TECNICO') ||
      funcUpper.includes('PEDAGÓGICA') ||
      funcUpper.includes('UTP')
    ) {
      estamento = 'TECNICO_PEDAGOGICO';
    } else if (
      funcUpper.includes('DIFERENCIAL') ||
      sec1Upper.includes('ESPECIAL') ||
      sec1Upper.includes('DIFERENCIAL')
    ) {
      estamento = 'DOCENTE_DIFERENCIAL';
    } else if (funcUpper.includes('CRA')) {
      estamento = 'COORDINADOR_CRA';
    } else if (funcUpper.includes('OTRA')) {
      estamento = 'OTRA_ESTABLECIMIENTO';
    }

    let asignatura = f.subSectorFuncion1 !== '--' && f.subSectorFuncion1 ? f.subSectorFuncion1 : f.sectorFuncion1;
    if (!asignatura || asignatura === '--') asignatura = f.funcionPrincipal;

    return {
      id: `doc-${rbdDocente}-${f.run}`,
      rbd: rbdDocente,
      periodo: periodo,
      run: f.runCompleto,
      nombres: f.nombres,
      apellidos: f.apellidos,
      titulo: f.funcionPrincipal,
      calidadJuridica: 'TITULAR' as CalidadJuridicaDocente,
      estamento,
      horasContrato: f.horasContrato,
      horasSubvencionGeneralTitular: f.horasContrato,
      horasSubvencionGeneralContrata: 0,
      horasSepTitular: 0,
      horasSepContrata: 0,
      horasPieTitular: 0,
      horasPieContrata: 0,
      horasDirectivas: f.horasDirectivas,
      horasTecnicoPedagogicas: f.horasTecnicoPedagogica,
      horasAula: f.horasAula,
      horasIngles: f.horasIngles,
      funcionPrincipal: f.funcionPrincipal,
      funcionSecundaria: f.funcionSecundaria !== '--' ? f.funcionSecundaria : undefined,
      asignaturaPrincipal: toTitleCase(asignatura),
      aplicaArticulo69: false
    };
  });

  const schoolMatch = identifySchool(rbdDetectado) || identifySchool(nombreColegioDetectado);
  const nombreFinal = schoolMatch ? schoolMatch.nombre : (nombreColegioDetectado || `Establecimiento RBD ${rbdDetectado}`);
  const comunaFinal = schoolMatch ? schoolMatch.comuna : 'Chillán';

  const establecimientoSugerido: Establecimiento = {
    id: `est-${rbdDetectado}`,
    rbd: rbdDetectado,
    nombre: nombreFinal,
    comuna: comunaFinal,
    regimen: schoolMatch?.tipo === 'JARDIN' || schoolMatch?.tipo === 'SALA_CUNA' ? 'No JEC' : 'JEC',
    porcentajePrioritarios: 80,
    asesorUatp: 'UATP SLEP Valle Diguillín'
  };

  const totales = {
    totalDocentes: filas.length,
    totalHorasContrato: filas.reduce((s, f) => s + f.horasContrato, 0),
    totalHorasDirectivas: filas.reduce((s, f) => s + f.horasDirectivas, 0),
    totalHorasTecnicas: filas.reduce((s, f) => s + f.horasTecnicoPedagogica, 0),
    totalHorasAula: filas.reduce((s, f) => s + f.horasAula, 0)
  };

  // Control de funcionarios multi-establecimiento y validación estricta de tope 44 horas
  const horasPorRunMap = new Map<string, {
    run: string;
    nombre: string;
    contratos: Array<{ rbd: string; nombreColegio: string; horas: number }>;
    totalHoras: number;
  }>();

  for (const f of filas) {
    const r = f.runCompleto;
    const rbdFila = f.rbd || rbdDestino || rbdDetectado || '0';
    const actual = horasPorRunMap.get(r) || {
      run: r,
      nombre: `${f.apellidos}, ${f.nombres}`,
      contratos: [],
      totalHoras: 0
    };
    actual.contratos.push({
      rbd: rbdFila,
      nombreColegio: f.nombreEstablecimiento || nombreColegioDetectado,
      horas: f.horasContrato
    });
    actual.totalHoras += f.horasContrato;
    horasPorRunMap.set(r, actual);
  }

  const funcionariosMultiEstablecimiento: FuncionarioMultiEstablecimientoInfo[] = [];

  for (const [run, data] of horasPorRunMap.entries()) {
    const rbdsDistintos = Array.from(new Set(data.contratos.map(c => c.rbd)));
    const esMulti = rbdsDistintos.length > 1;
    const excede44h = data.totalHoras > 44;

    if (esMulti) {
      funcionariosMultiEstablecimiento.push({
        run,
        nombre: data.nombre,
        totalHoras: data.totalHoras,
        rbds: rbdsDistintos,
        excede44h
      });
    }

    if (excede44h) {
      advertencias.push({
        linea: 0,
        run,
        mensaje: `Docente ${data.nombre} (RUN ${run}) excede el tope legal de 44 horas semanales: acumula ${data.totalHoras} hrs contratadas entre ${rbdsDistintos.length} establecimientos (RBDs: ${rbdsDistintos.join(', ')}).`
      });
    }
  }

  // Identificar todos los establecimientos detectados en el archivo
  const rbdsEncontrados = Array.from(new Set(filas.map(f => f.rbd).filter(Boolean)));
  if (!rbdsEncontrados.includes(rbdDetectado) && rbdDetectado) {
    rbdsEncontrados.unshift(rbdDetectado);
  }

  const establecimientosDetectados: Establecimiento[] = rbdsEncontrados.map(rbd => {
    const filaMatch = filas.find(f => f.rbd === rbd);
    const catalogMatch = identifySchool(rbd) || (filaMatch?.nombreEstablecimiento ? identifySchool(filaMatch.nombreEstablecimiento) : null);
    return {
      id: `est-${rbd}`,
      rbd,
      nombre: catalogMatch?.nombre || filaMatch?.nombreEstablecimiento || `Colegio RBD ${rbd}`,
      comuna: catalogMatch?.comuna || 'Chillán',
      regimen: catalogMatch?.tipo === 'JARDIN' || catalogMatch?.tipo === 'SALA_CUNA' ? 'No JEC' : 'JEC',
      porcentajePrioritarios: 80,
      asesorUatp: 'UATP SLEP Valle Diguillín'
    };
  });

  return {
    rbdDetectado,
    nombreColegioDetectado,
    filas,
    docentesConvertidos,
    establecimientoSugerido,
    establecimientosDetectados: establecimientosDetectados.length ? establecimientosDetectados : [establecimientoSugerido],
    funcionariosMultiEstablecimiento,
    totales,
    advertencias
  };
}
