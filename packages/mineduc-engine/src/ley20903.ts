// =============================================================================
// REGLA DE NEGOCIO PURA: CÁLCULO DE JORNADA DOCENTE LEY N° 20.903
// Proporción 65/35 (General) y 60/40 (SEP Vulnerable / Rural) según Tablas MINEDUC
// =============================================================================

import { MAPA_MINEDUC_60_40, MAPA_MINEDUC_65_35 } from './tablasMineduc';

export interface CalculoJornadaResult {
  contrato: number;
  horasLectivas: number;
  horasNoLectivas: number;
  horasExclusividadPedagogica: number;
  minutosLectivos: number;
  minutosRecreo: number;
  minutosNoLectivos: number;
  esValido: boolean;
  proporcion: '65/35' | '60/40';
  motivoInvalidez?: string;
}

/**
 * Calcula el desglose oficial de horas lectivas, recreo y no lectivas
 * conforme a las tablas oficiales MINEDUC (Ley N° 20.903) en minutos enteros.
 *
 * @param horasContrato Horas semanales del contrato (1 a 44 hrs)
 * @param regimen Proporción legal ('65/35' o '60/40')
 */
export function calcularJornadaDocente(
  horasContrato: number,
  regimen: '65/35' | '60/40' = '65/35'
): CalculoJornadaResult {
  const horasEnteras = Math.round(horasContrato);
  if (horasContrato < 1 || horasContrato > 44 || Math.abs(horasContrato - horasEnteras) > 1e-6) {
    return {
      contrato: horasContrato,
      horasLectivas: 0,
      horasNoLectivas: 0,
      horasExclusividadPedagogica: 0,
      minutosLectivos: 0,
      minutosRecreo: 0,
      minutosNoLectivos: 0,
      esValido: false,
      proporcion: regimen,
      motivoInvalidez: 'La jornada de contrato debe ser un entero entre 1 y 44 horas cronológicas.',
    };
  }

  const mapa = regimen === '60/40' ? MAPA_MINEDUC_60_40 : MAPA_MINEDUC_65_35;
  const tramo = mapa.get(horasEnteras)!;
  const minutosLectivos = tramo.lectivasMinutosCronologicos;
  const minutosRecreo = tramo.recreoMinutosCronologicos;
  const minutosNoLectivos = tramo.noLectivasMinutosCronologicos;
  const minutosHnlTotal = minutosNoLectivos + minutosRecreo;
  const minutosExclusividad = Math.ceil((minutosHnlTotal * 40) / 100);

  return {
    contrato: horasEnteras,
    horasLectivas: Number((minutosLectivos / 60).toFixed(2)),
    horasNoLectivas: Number((minutosHnlTotal / 60).toFixed(2)),
    horasExclusividadPedagogica: Number((minutosExclusividad / 60).toFixed(2)),
    minutosLectivos,
    minutosRecreo,
    minutosNoLectivos,
    esValido: true,
    proporcion: regimen,
  };
}
