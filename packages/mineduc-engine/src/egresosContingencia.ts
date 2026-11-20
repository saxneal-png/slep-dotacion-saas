/**
 * Motor Jurídico-Normativo de Egresos Proyectados y Vacantes Condicionales
 * Normativa: Ley 20.903 (Art. 19 S), DFL 1/1996 Estatuto Docente (Art. 72 y salud incompatible),
 * resguardo contra doble titularidad y doble conteo en PAL 2027 / GDP.
 *
 * @slep/mineduc-engine - 100% puro, sin dependencias externas.
 */

export type CausalEgresoEngine =
  | 'renuncia_voluntaria'
  | 'art_19s_no_avance'
  | 'incentivo_retiro'
  | 'salud_incompatible_180d'
  | 'art_72_otro';

export type CertezaEgresoEngine = 'confirmado' | 'en_tramite';

export type ImpactoPresupuestarioEngine =
  | 'con_recuperacion_sil'
  | 'costo_doble_pendiente'
  | 'sin_impacto_doble';

export interface EgresoProyectadoInput {
  causal: CausalEgresoEngine;
  certeza: CertezaEgresoEngine;
  excepcionJubilacion3Anios?: boolean;
  cpeipNotificacionFirme?: boolean;
  fechaCese?: string;
  numeroDecreto?: string;
  horasLiberadas: number;
  impactoPresupuestario?: ImpactoPresupuestarioEngine;
}

export interface EvaluacionJuridicaEgreso {
  liberaVacante: boolean;
  esVacanteCondicional: boolean;
  permiteCoberturaTransitoria: boolean;
  permiteConsolidacionDefinitiva: boolean;
  motivoBloqueoDefinitivo?: string;
  impactoPresupuestarioSugerido: ImpactoPresupuestarioEngine;
  alertasNormativas: string[];
}

/**
 * Evalúa si un egreso proyectado libera vacante real o vacante condicional,
 * determinando el impacto presupuestario y las restricciones de consolidación.
 */
export function evaluarEgresoProyectado(
  input: EgresoProyectadoInput
): EvaluacionJuridicaEgreso {
  const alertasNormativas: string[] = [];

  if (
    input.causal === 'art_19s_no_avance' &&
    input.excepcionJubilacion3Anios === true
  ) {
    const motivoBloqueo =
      'Excepción Art. 19 S Ley 20.903: docente a 3 años o menos de edad de jubilación conserva cargo hasta retiro y NO libera vacante.';
    alertasNormativas.push(motivoBloqueo);
    return {
      liberaVacante: false,
      esVacanteCondicional: false,
      permiteCoberturaTransitoria: false,
      permiteConsolidacionDefinitiva: false,
      motivoBloqueoDefinitivo: motivoBloqueo,
      impactoPresupuestarioSugerido: 'sin_impacto_doble',
      alertasNormativas,
    };
  }

  if (input.certeza === 'en_tramite') {
    const motivoBloqueo =
      'Egreso en trámite genera Vacante Condicional: se permite reemplazo/cobertura transitoria, pero se bloquea consolidar titularidad definitiva para evitar doble titularidad y doble conteo en PAL 2027 / GDP.';
    const impactoPresupuestarioSugerido: ImpactoPresupuestarioEngine =
      input.causal === 'salud_incompatible_180d'
        ? 'con_recuperacion_sil'
        : 'costo_doble_pendiente';

    alertasNormativas.push(motivoBloqueo);
    if (impactoPresupuestarioSugerido === 'con_recuperacion_sil') {
      alertasNormativas.push(
        'Causal de salud incompatible (>180 días): cobertura transitoria sujeta a recuperación de subsidio por incapacidad laboral (SIL).'
      );
    } else {
      alertasNormativas.push(
        'Contingencia presupuestaria: posible costo doble transitorio mientras concluye tramitación del egreso.'
      );
    }

    return {
      liberaVacante: true,
      esVacanteCondicional: true,
      permiteCoberturaTransitoria: true,
      permiteConsolidacionDefinitiva: false,
      motivoBloqueoDefinitivo: motivoBloqueo,
      impactoPresupuestarioSugerido,
      alertasNormativas,
    };
  }

  // Certeza === 'confirmado'
  const tieneFechaCese = Boolean(input.fechaCese && input.fechaCese.trim().length > 0);
  const tieneNumeroDecreto = Boolean(
    input.numeroDecreto && input.numeroDecreto.trim().length > 0
  );

  if (
    input.causal === 'art_19s_no_avance' &&
    input.cpeipNotificacionFirme !== true
  ) {
    const motivoCpeip =
      'Egreso Art. 19 S Ley 20.903 condicional: falta Notificación CPEIP firme / plazo de reposición vencido antes de liberar titularidad definitiva (solo se habilita cobertura transitoria mientras concluye reposición).';
    alertasNormativas.push(motivoCpeip);
    if (!tieneFechaCese || !tieneNumeroDecreto) {
      alertasNormativas.push(
        'Adicionalmente falta fecha de cese y/o N° de decreto/resolución registrado.'
      );
    }
    return {
      liberaVacante: true,
      esVacanteCondicional: true,
      permiteCoberturaTransitoria: true,
      permiteConsolidacionDefinitiva: false,
      motivoBloqueoDefinitivo: motivoCpeip,
      impactoPresupuestarioSugerido: 'costo_doble_pendiente',
      alertasNormativas,
    };
  }

  if (tieneFechaCese && tieneNumeroDecreto) {
    if (input.horasLiberadas <= 0) {
      alertasNormativas.push(
        'Egreso confirmado con 0 horas liberadas registradas; verificar carga horaria asociada.'
      );
    }
    return {
      liberaVacante: true,
      esVacanteCondicional: false,
      permiteCoberturaTransitoria: true,
      permiteConsolidacionDefinitiva: true,
      impactoPresupuestarioSugerido: 'sin_impacto_doble',
      alertasNormativas,
    };
  }

  const motivoFaltantes =
    'Egreso confirmado sin fecha de cese y/o N° de decreto/resolución: se solicita registrar ambos antecedentes para habilitar consolidación definitiva sin riesgo en PAL 2027 / GDP.';
  alertasNormativas.push(motivoFaltantes);

  return {
    liberaVacante: true,
    esVacanteCondicional: true,
    permiteCoberturaTransitoria: true,
    permiteConsolidacionDefinitiva: false,
    motivoBloqueoDefinitivo: motivoFaltantes,
    impactoPresupuestarioSugerido:
      input.causal === 'salud_incompatible_180d'
        ? 'con_recuperacion_sil'
        : 'costo_doble_pendiente',
    alertasNormativas,
  };
}

/**
 * Valida si un movimiento de cobertura o consolidación puede ejecutarse sobre una vacante
 * originada por un egreso proyectado.
 */
export function validarConsolidacionSobreEgreso(
  egreso: EgresoProyectadoInput,
  calidadDocenteEntrante: string,
  tipoCobertura: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL'
): { permitido: boolean; motivoBloqueo?: string; alertas: string[] } {
  const evaluacion = evaluarEgresoProyectado(egreso);
  const alertas = [...evaluacion.alertasNormativas];
  const calidadNormalizada = (calidadDocenteEntrante || '').trim().toUpperCase();

  if (!evaluacion.liberaVacante) {
    return {
      permitido: false,
      motivoBloqueo:
        evaluacion.motivoBloqueoDefinitivo ||
        'El egreso proyectado no libera vacante disponible.',
      alertas,
    };
  }

  if (
    evaluacion.esVacanteCondicional &&
    (tipoCobertura === 'DEFINITIVA' || calidadNormalizada === 'TITULAR')
  ) {
    const motivoBloqueo =
      evaluacion.motivoBloqueoDefinitivo ||
      'Vacante Condicional: se bloquea consolidación definitiva e ingreso de docente TITULAR para evitar doble titularidad y doble conteo en PAL 2027 / GDP.';
    if (!alertas.includes(motivoBloqueo)) {
      alertas.push(motivoBloqueo);
    }
    return {
      permitido: false,
      motivoBloqueo,
      alertas,
    };
  }

  if (
    evaluacion.esVacanteCondicional &&
    tipoCobertura === 'TRANSITORIA_CONDICIONAL' &&
    calidadNormalizada !== 'TITULAR'
  ) {
    alertas.push(
      'Cobertura transitoria autorizada de forma condicional, sujeta a emisión de decreto definitivo y fecha de cese.'
    );
    return {
      permitido: true,
      alertas,
    };
  }

  return {
    permitido: true,
    alertas,
  };
}
