import { limpiarRutParaId } from './rutUtils';

/**
 * Normaliza un texto eliminando diacríticos/tildes, colapsando espacios y convirtiendo a minúsculas.
 */
export function normalizarTextoBusqueda(texto?: string | null): string {
  if (!texto) return '';
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function esTokenRut(rawToken: string): boolean {
  const norm = normalizarTextoBusqueda(rawToken);
  if (!norm || !/\d/.test(norm)) return false;
  // Solo dígitos, 'k', puntos, guiones o espacios
  return /^[0-9k.\-\s]+$/i.test(norm);
}

export interface BusquedaFuncionarioTarget {
  run?: string;
  nombres?: string;
  apellidos?: string;
  extras?: Array<string | undefined | null>;
}

export interface ResultadoCoincidenciaBusqueda {
  match: boolean;
  score: number;
}

/**
 * Evalúa si una consulta coincide con un funcionario (docente o asistente) por nombre completo,
 * apellidos, RUN (con o sin puntos/guion) o metadatos adicionales (cargo, funciones, colegio).
 */
export function coincideBusquedaFuncionario(
  query: string,
  target: BusquedaFuncionarioTarget
): ResultadoCoincidenciaBusqueda {
  const qNorm = normalizarTextoBusqueda(query);
  if (!qNorm) return { match: true, score: 0 };

  const runRaw = target.run || '';
  const runClean = limpiarRutParaId(runRaw);
  const qCleanRut = esTokenRut(qNorm) ? limpiarRutParaId(qNorm) : '';

  let bestScore = 0;

  if (qCleanRut.length >= 2 && runClean) {
    if (runClean === qCleanRut) {
      return { match: true, score: 100 };
    }
    if (runClean.startsWith(qCleanRut)) {
      bestScore = Math.max(bestScore, 85);
    } else if (runClean.includes(qCleanRut)) {
      bestScore = Math.max(bestScore, 65);
    }
  }

  const nombresNorm = normalizarTextoBusqueda(target.nombres);
  const apellidosNorm = normalizarTextoBusqueda(target.apellidos);
  const nombreCompleto = `${nombresNorm} ${apellidosNorm}`.trim();
  const nombreInvertido = `${apellidosNorm} ${nombresNorm}`.trim();
  const extrasNorm = normalizarTextoBusqueda(
    (target.extras || []).filter(Boolean).join(' ')
  );
  const runNorm = normalizarTextoBusqueda(runRaw);
  const searchableAll = `${nombreCompleto} ${nombreInvertido} ${runNorm} ${extrasNorm}`.trim();

  const rawTokens = query.trim().split(/\s+/).filter(Boolean);
  if (rawTokens.length === 0) return { match: true, score: 0 };

  let allInNombre = true;
  const allMatch = rawTokens.every((rawTok) => {
    const tokNorm = normalizarTextoBusqueda(rawTok);
    if (!tokNorm) return true;

    const inNombre = nombreCompleto.includes(tokNorm) || nombreInvertido.includes(tokNorm);
    if (!inNombre) allInNombre = false;

    if (searchableAll.includes(tokNorm)) return true;

    if (esTokenRut(rawTok) && runClean) {
      const tokRut = limpiarRutParaId(rawTok);
      if (tokRut.length >= 2 && runClean.includes(tokRut)) {
        return true;
      }
    }
    return false;
  });

  if (allMatch) {
    if (nombreCompleto.startsWith(qNorm) || nombreInvertido.startsWith(qNorm)) {
      bestScore = Math.max(bestScore, 75);
    } else if (allInNombre) {
      bestScore = Math.max(bestScore, 55);
    } else {
      bestScore = Math.max(bestScore, 35);
    }
  }

  return bestScore > 0 ? { match: true, score: bestScore } : { match: false, score: 0 };
}
