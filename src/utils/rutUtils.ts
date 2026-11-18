/**
 * Utilidades para normalización, validación y formateo de RUT / RUN chileno.
 */

/**
 * Limpia un RUT eliminando puntos, guiones y espacios, dejando solo números y letra K mayúscula
 * para su uso seguro en claves e identificadores determinísticos (ej: 123456789 o 12345678K).
 */
export function limpiarRutParaId(val: any): string {
  if (!val) return '';
  return String(val).toUpperCase().replace(/[^0-9K]/g, '');
}

/**
 * Limpia y normaliza un RUT a su formato canónico sin puntos y con guion (ej: 12345678-9 o 12345678-K).
 */
export function normalizarRut(val: any): string {
  if (!val) return '';
  let str = String(val).trim().toUpperCase();
  // Eliminar puntos, comas, espacios y barras
  str = str.replace(/[.,\s/]/g, '');
  if (!str) return '';

  if (str.includes('-')) {
    const parts = str.split('-');
    const cuerpo = parts[0].replace(/\D/g, '');
    const dv = parts[parts.length - 1].trim();
    if (cuerpo) {
      return `${cuerpo}-${dv}`;
    }
  } else if (str.length >= 7 && str.length <= 9) {
    const cuerpo = str.slice(0, -1);
    const dv = str.slice(-1);
    return `${cuerpo}-${dv}`;
  }

  return str;
}

/**
 * Valida un RUT utilizando el algoritmo Módulo 11 oficial chileno.
 */
export function validarRut(rut: string): boolean {
  const norm = normalizarRut(rut);
  if (!norm || !norm.includes('-')) return false;

  const [cuerpoStr, dvStr] = norm.split('-');
  const cuerpo = parseInt(cuerpoStr, 10);
  if (isNaN(cuerpo) || cuerpo <= 0) return false;

  let suma = 0;
  let multiplicador = 2;

  for (let i = cuerpoStr.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpoStr.charAt(i), 10) * multiplicador;
    multiplicador = multiplicador === 7 ? 2 : multiplicador + 1;
  }

  const resto = suma % 11;
  const dvEsperadoNum = 11 - resto;
  let dvEsperado = '';

  if (dvEsperadoNum === 11) {
    dvEsperado = '0';
  } else if (dvEsperadoNum === 10) {
    dvEsperado = 'K';
  } else {
    dvEsperado = String(dvEsperadoNum);
  }

  return dvStr === dvEsperado;
}

/**
 * Formatea un RUT al estándar visual chileno con puntos y guion (ej: 12.345.678-9).
 */
export function formatearRut(rut: string): string {
  const norm = normalizarRut(rut);
  if (!norm || !norm.includes('-')) return rut;

  const [cuerpo, dv] = norm.split('-');
  const cuerpoFormateado = cuerpo.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cuerpoFormateado}-${dv}`;
}

const PLACEHOLDER_RUNS_DEDUP = new Set([
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '12344556679',
  '0000000',
  '00000000',
  '000000000'
]);

/**
 * Indica si una cadena RUN representa un identificador real apto para deduplicación
 * (descarta vacíos, textos "POR PROVEER", "N/N" o secuencias ficticias repetidas).
 */
export function esRunValidoParaDedup(val: any): boolean {
  const clean = limpiarRutParaId(val);
  if (clean.length < 7 || clean.length > 9) return false;
  if (!/^[0-9]{6,8}[0-9K]$/.test(clean)) return false;
  if (PLACEHOLDER_RUNS_DEDUP.has(clean)) return false;
  if (/^(\d)\1+$/.test(clean)) return false;
  return true;
}

/**
 * Retorna clave única de deduplicación para un funcionario en un RBD:
 * usa el RUN limpio cuando es válido y preserva el ID en cargos vacantes ("Por proveer").
 */
export function claveDedupFuncionario(rbd: string, run: any, fallbackId: string): string {
  const rbdClean = String(rbd || '').trim();
  if (esRunValidoParaDedup(run)) {
    return `${rbdClean}_${limpiarRutParaId(run)}`;
  }
  return `${rbdClean}__ID_${String(fallbackId || '').trim()}`;
}

