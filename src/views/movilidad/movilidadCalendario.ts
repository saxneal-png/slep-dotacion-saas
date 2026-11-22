export type EstadoHitoAndon = 'COMPLETADO' | 'EN_PLAZO' | 'PROXIMO_VENCER' | 'ATRASADO';

export interface HitoCalendarioMovilidad {
  id: string;
  orden: number;
  titulo: string;
  fechaLimiteIso: string;
  compuerta: 1 | 2 | 3 | 4 | 5;
}

export interface EvaluacionHitoAndon extends HitoCalendarioMovilidad {
  estado: EstadoHitoAndon;
  diasRestantes: number;
}

export function obtenerHitosDefectoPeriodo(periodo: number): HitoCalendarioMovilidad[] {
  const anioPrevio = periodo - 1;
  return [
    {
      id: `hito_1_${periodo}`,
      orden: 1,
      titulo: 'Cierre y Saneamiento NN Territorial',
      fechaLimiteIso: `${anioPrevio}-11-15`,
      compuerta: 1
    },
    {
      id: `hito_2_${periodo}`,
      orden: 2,
      titulo: 'Validación de Egresos Proyectados GDP',
      fechaLimiteIso: `${anioPrevio}-11-30`,
      compuerta: 2
    },
    {
      id: `hito_3_${periodo}`,
      orden: 3,
      titulo: 'Cierre Cola Prioritaria y Solicitudes',
      fechaLimiteIso: `${anioPrevio}-12-15`,
      compuerta: 3
    },
    {
      id: `hito_4_${periodo}`,
      orden: 4,
      titulo: 'Aprobación de Calces, Rebotes y Firmas',
      fechaLimiteIso: `${anioPrevio}-12-30`,
      compuerta: 4
    },
    {
      id: `hito_5_${periodo}`,
      orden: 5,
      titulo: 'Consolidación y Emisión de Resoluciones',
      fechaLimiteIso: `${periodo}-01-15`,
      compuerta: 5
    }
  ];
}

function parseIsoUtcMidnight(isoDate: string): number {
  const clean = isoDate.slice(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  return Date.UTC(y || 2026, (m || 1) - 1, d || 1);
}

export function evaluarEstadoHitosMovilidad(
  hitos: HitoCalendarioMovilidad[],
  hoyIso: string,
  compuertasAbiertas: Record<1 | 2 | 3 | 4 | 5, boolean>
): EvaluacionHitoAndon[] {
  const hoyMs = parseIsoUtcMidnight(hoyIso);

  return hitos.map(h => {
    const limiteMs = parseIsoUtcMidnight(h.fechaLimiteIso);
    const diasRestantes = Math.round((limiteMs - hoyMs) / (1000 * 60 * 60 * 24));

    let estado: EstadoHitoAndon;
    if (compuertasAbiertas[h.compuerta]) {
      estado = 'COMPLETADO';
    } else if (diasRestantes < 0) {
      estado = 'ATRASADO';
    } else if (diasRestantes <= 7) {
      estado = 'PROXIMO_VENCER';
    } else {
      estado = 'EN_PLAZO';
    }

    return {
      ...h,
      estado,
      diasRestantes
    };
  });
}
