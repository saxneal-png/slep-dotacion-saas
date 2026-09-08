// =============================================================================
// REGLA DE NEGOCIO PURA: CÁLCULO DE JORNADA DOCENTE LEY N° 20.903
// Proporción 65/35 (General) y 60/40 (SEP Vulnerable / Rural)
// =============================================================================

export interface CalculoJornadaResult {
  contrato: number;
  horasLectivas: number;
  horasNoLectivas: number;
  horasExclusividadPedagogica: number;
  esValido: boolean;
  proporcion: '65/35' | '60/40';
  motivoInvalidez?: string;
}

/**
 * Calcula el desglose matemático de horas lectivas y no lectivas
 * conforme a la Ley N° 20.903.
 * 
 * @param horasContrato Horas semanales del contrato (1 a 44 hrs)
 * @param regimen Proporción legal ('65/35' o '60/40')
 */
export function calcularJornadaDocente(
  horasContrato: number,
  regimen: '65/35' | '60/40' = '65/35'
): CalculoJornadaResult {
  if (horasContrato < 1 || horasContrato > 44) {
    return {
      contrato: horasContrato,
      horasLectivas: 0,
      horasNoLectivas: 0,
      horasExclusividadPedagogica: 0,
      esValido: false,
      proporcion: regimen,
      motivoInvalidez: 'La jornada de contrato debe estar entre 1 y 44 horas cronológicas.',
    };
  }

  const factorLectivo = regimen === '65/35' ? 0.65 : 0.60;
  const factorNoLectivo = regimen === '65/35' ? 0.35 : 0.40;

  const horasLectivas = Number((horasContrato * factorLectivo).toFixed(1));
  const horasNoLectivas = Number((horasContrato * factorNoLectivo).toFixed(1));
  
  // Al menos el 40% de las horas no lectivas deben ser de libre disposición pedagógica (Ley 20.903)
  const horasExclusividadPedagogica = Number((horasNoLectivas * 0.40).toFixed(1));

  return {
    contrato: horasContrato,
    horasLectivas,
    horasNoLectivas,
    horasExclusividadPedagogica,
    esValido: true,
    proporcion: regimen,
  };
}
