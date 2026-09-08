// =============================================================================
// REGLA DE NEGOCIO PURA: CONTROL DE SOBREASIGNACIÓN Y LÍMITES DE DOTACIÓN
// =============================================================================
import { calcularJornadaMinutos } from './calculoJornada';
import { RegimenHorario } from './tablasMineduc';

export interface ValidacionSobreasignacionResult {
  estaSobreasignado: boolean;
  horasAsignadas: number;
  horasMaxLectivasPermitidas: number;
  excesoHoras: number;
  mensaje: string;
}

/**
 * Valida si la carga horaria de aula asignada a un docente (en horas pedagógicas de 45 min)
 * excede el máximo legal de horas lectivas de su contrato conforme a los tramos de la Ley 20.903.
 */
export function validarSobreasignacionDocente(
  horasContrato: number,
  horasLectivasAsignadas: number,
  regimen: '65/35' | '60/40' = '65/35'
): ValidacionSobreasignacionResult {
  const regimenTabla: RegimenHorario = regimen === '60/40' ? '60_40' : '65_35';
  const calculo = calcularJornadaMinutos(horasContrato, horasLectivasAsignadas, regimenTabla);
  
  const maxLectivasPedagogicas = calculo.horasPedagogicasDisponiblesMax;
  const estaSobreasignado = calculo.esSobreasignado;
  const exceso = estaSobreasignado ? Math.max(0, horasLectivasAsignadas - maxLectivasPedagogicas) : 0;

  return {
    estaSobreasignado,
    horasAsignadas: horasLectivasAsignadas,
    horasMaxLectivasPermitidas: maxLectivasPedagogicas,
    excesoHoras: exceso,
    mensaje: estaSobreasignado
      ? `Infracción Ley 20.903: El docente tiene ${horasLectivasAsignadas} HA lectivas asignadas pero su máximo legal es ${maxLectivasPedagogicas} HA (+${exceso} HA de exceso).`
      : 'Carga horaria lectiva conforme a la normativa vigente.',
  };
}
