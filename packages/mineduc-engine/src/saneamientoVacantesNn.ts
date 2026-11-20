/**
 * Motor de Saneamiento y Detección de Vacantes NN / Ficticias
 * @slep/mineduc-engine - 100% puro, sin dependencias externas.
 */

export interface DocenteCandidatoNn {
  id: string;
  rbd: string;
  run?: string;
  nombres?: string;
  apellidos?: string;
  esVacanteNn?: boolean;
  tipoVacante?: string;
  horasContrato?: number;
  asignaturaPrincipal?: string;
}

export interface ResultadoDeteccionNn {
  esVacanteNn: boolean;
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
  motivos: string[];
  tipoVacanteSugerido: 'NN_DETECTADO' | 'NECESIDAD_ESCUELA';
  runDetectadoComoFicticio: boolean;
  nombreDetectadoComoFicticio: boolean;
}

export interface ResumenEscaneoNn<T extends DocenteCandidatoNn> {
  totalEscaneados: number;
  totalDetectados: number;
  detectados: Array<{ docente: T; deteccion: ResultadoDeteccionNn }>;
}

const PLACEHOLDERS_RUN_CONOCIDOS = new Set<string>([
  '123456789',
  '12345678K',
  '987654321',
  '000000000',
  '111111111',
  '222222222',
  '333333333',
  '444444444',
  '555555555',
  '666666666',
  '777777777',
  '888888888',
  '999999999',
]);

const PATRON_NN_NOMBRE = /\bN\.?\s*N(?:\.|\b)/;
const PATRON_NECESIDAD_NOMBRE =
  /(POR\s+PROVEER|VACANTE|SIN\s+DOCENTE|POR\s+CONTRATAR|A\s+CONCURSO|PENDIENTE\s+CONTRATACION|CARGO\s+VACANTE)/;
const PATRON_XXXX_NOMBRE = /XXXX+/;

function normalizarTextoSinTildes(texto?: string): string {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Limpia puntos, guiones y espacios, y valida el dígito verificador chileno (Módulo 11).
 * Rechaza largos < 7 o > 9, cuerpo <= 0, dígitos repetidos (ej. 111111111, 000000000, 999999999)
 * y placeholders como 123456789.
 */
export function validarDigitoVerificadorRun(run: string): boolean {
  if (!run || typeof run !== 'string') return false;

  const limpio = run.replace(/[.\-\s]/g, '').toUpperCase();
  if (limpio.length < 7 || limpio.length > 9) return false;
  if (!/^\d+[0-9K]$/.test(limpio)) return false;

  if (/^(\d)\1+$/.test(limpio)) return false;
  if (PLACEHOLDERS_RUN_CONOCIDOS.has(limpio)) return false;

  const cuerpoStr = limpio.slice(0, -1);
  const dvIngresado = limpio.slice(-1);

  if (/^(\d)\1+$/.test(cuerpoStr)) return false;

  const cuerpo = parseInt(cuerpoStr, 10);
  if (!Number.isFinite(cuerpo) || cuerpo <= 0) return false;

  let suma = 0;
  let multiplicador = 2;
  for (let i = cuerpoStr.length - 1; i >= 0; i--) {
    suma += Number(cuerpoStr[i]) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvCalculado = 11 - resto;
  const dvEsperado =
    dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : String(dvCalculado);

  return dvIngresado === dvEsperado;
}

/**
 * Analiza un registro docente para detectar si corresponde a una vacante NN / cargo ficticio
 * heredado de cargas históricas.
 */
export function detectarDocenteVacanteNn(
  docente: DocenteCandidatoNn
): ResultadoDeteccionNn {
  const motivos: string[] = [];

  const rawRun = (docente.run ?? '').trim();
  const rawRunNorm = normalizarTextoSinTildes(rawRun);
  const cleanRun = rawRun.replace(/[.\-\s]/g, '').toUpperCase();

  const runVacio = cleanRun.length === 0;
  const esPrefijoFicticio =
    rawRunNorm.startsWith('VAC-') ||
    cleanRun.startsWith('VAC') ||
    cleanRun.startsWith('NN') ||
    cleanRun.startsWith('XXXX');
  const esRunPlaceholderExplicito =
    rawRunNorm === '0-0' ||
    rawRunNorm === '1-9' ||
    cleanRun === '00' ||
    cleanRun === '19' ||
    cleanRun === '111111111' ||
    cleanRun === '999999999' ||
    cleanRun === '123456789' ||
    cleanRun === '000000000' ||
    (cleanRun.length >= 2 && /^(\d)\1+$/.test(cleanRun));

  const esRunExplicitamenteFicticio =
    esPrefijoFicticio || esRunPlaceholderExplicito;

  let runDetectadoComoFicticio = false;
  let soloFallaModulo11 = false;

  if (runVacio) {
    runDetectadoComoFicticio = true;
    motivos.push('RUN vacío o sin identificar');
  } else if (esRunExplicitamenteFicticio) {
    runDetectadoComoFicticio = true;
    motivos.push(`RUN ficticio o marcador de vacante (${rawRun})`);
  } else if (!validarDigitoVerificadorRun(rawRun)) {
    runDetectadoComoFicticio = true;
    soloFallaModulo11 = true;
    motivos.push(`RUN inválido según Módulo 11 (${rawRun})`);
  }

  const nombreCompletoNorm = normalizarTextoSinTildes(
    `${docente.nombres ?? ''} ${docente.apellidos ?? ''}`
  );

  const coincidePatronNn = PATRON_NN_NOMBRE.test(nombreCompletoNorm);
  const coincidePatronNecesidad = PATRON_NECESIDAD_NOMBRE.test(nombreCompletoNorm);
  const coincidePatronXxxx = PATRON_XXXX_NOMBRE.test(nombreCompletoNorm);
  const nombreDetectadoComoFicticio =
    coincidePatronNn || coincidePatronNecesidad || coincidePatronXxxx;

  if (coincidePatronNn) {
    motivos.push('Nombre contiene marcador explícito NN / N.N.');
  }
  if (coincidePatronNecesidad) {
    motivos.push('Nombre describe cargo por proveer o vacante institucional');
  }
  if (coincidePatronXxxx) {
    motivos.push('Nombre contiene marcador ficticio XXXX');
  }

  let tipoVacanteSugerido: 'NN_DETECTADO' | 'NECESIDAD_ESCUELA' = 'NN_DETECTADO';
  if (docente.tipoVacante === 'NECESIDAD_ESCUELA') {
    tipoVacanteSugerido = 'NECESIDAD_ESCUELA';
  } else if (
    (coincidePatronNecesidad || rawRunNorm.startsWith('VAC-') || cleanRun.startsWith('VAC')) &&
    !coincidePatronNn &&
    !cleanRun.startsWith('NN')
  ) {
    tipoVacanteSugerido = 'NECESIDAD_ESCUELA';
  }

  if (docente.esVacanteNn === true) {
    const motivosFinales = [
      'Registro marcado previamente como vacante NN',
      ...motivos,
    ];
    return {
      esVacanteNn: true,
      confianza: 'ALTA',
      motivos: motivosFinales,
      tipoVacanteSugerido,
      runDetectadoComoFicticio,
      nombreDetectadoComoFicticio,
    };
  }

  const esVacanteNn = runDetectadoComoFicticio || nombreDetectadoComoFicticio;

  let confianza: 'ALTA' | 'MEDIA' | 'BAJA' = 'BAJA';
  if (esVacanteNn) {
    if (
      nombreDetectadoComoFicticio ||
      esRunExplicitamenteFicticio ||
      (runVacio && nombreCompletoNorm.length === 0)
    ) {
      confianza = 'ALTA';
    } else if (soloFallaModulo11 || runVacio) {
      confianza = 'MEDIA';
    }
  }

  return {
    esVacanteNn,
    confianza,
    motivos,
    tipoVacanteSugerido,
    runDetectadoComoFicticio,
    nombreDetectadoComoFicticio,
  };
}

/**
 * Escanea una nómina completa y retorna el resumen con todos los registros detectados como NN.
 */
export function escanearNominaVacantesNn<T extends DocenteCandidatoNn>(
  docentes: T[]
): ResumenEscaneoNn<T> {
  const detectados: Array<{ docente: T; deteccion: ResultadoDeteccionNn }> = [];

  for (const docente of docentes) {
    const deteccion = detectarDocenteVacanteNn(docente);
    if (deteccion.esVacanteNn) {
      detectados.push({ docente, deteccion });
    }
  }

  return {
    totalEscaneados: docentes.length,
    totalDetectados: detectados.length,
    detectados,
  };
}
