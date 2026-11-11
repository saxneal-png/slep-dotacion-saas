import type { Docente, EstamentoDocente } from '../types';

export const FILTRO_ESTAMENTO_FUERA_AULA = 'FUNCIONES_FUERA_AULA';

const ESTAMENTOS_INSTITUCIONALES_FUERA_AULA = new Set<EstamentoDocente>([
  'DIRECTIVO',
  'TECNICO_PEDAGOGICO',
  'COORDINADOR_CRA',
  'OTRA_ESTABLECIMIENTO'
]);

/**
 * Determina si el nombre de una función corresponde a Trabajo Colaborativo (Art. 86 / Dec. 170).
 */
export function esFuncionTrabajoColaborativo(nombre?: string | null): boolean {
  if (!nombre) return false;
  return /trabajo\s*colaborativ|co-?planificaci[oó]n|art\.?\s*86/i.test(nombre);
}

/**
 * Evalúa si un docente cumple funciones fuera del aula (directivas, UTP, inspectoría,
 * coordinaciones, convivencia, CRA, extraescolar, orientación, evaluación, administrativas, etc.),
 * excluyendo explícitamente horas de Trabajo Colaborativo y horas de Taller SEP.
 */
export function tieneFuncionesFueraDeAulaSinColaborativo(docente: Docente): boolean {
  if (ESTAMENTOS_INSTITUCIONALES_FUERA_AULA.has(docente.estamento)) {
    return true;
  }

  if (docente.funcionesNoAula && docente.funcionesNoAula.length > 0) {
    const tieneOtraFuncion = docente.funcionesNoAula.some(
      (f) => Number(f.horas || 0) > 0 && !esFuncionTrabajoColaborativo(f.nombre)
    );
    if (tieneOtraFuncion) {
      return true;
    }
  }

  const horasInstitucionales =
    Number(docente.horasDirectivas || 0) +
    Number(docente.horasInspectorGeneral || 0) +
    Number(docente.horasTecnicoPedagogicas || 0) +
    Number(docente.horasCoordinacion || 0) +
    Number(docente.horasCoordinacionPie || 0) +
    Number(docente.horasConvivenciaEscolar || 0) +
    Number(docente.horasExtraescolar || 0);

  return horasInstitucionales > 0;
}
