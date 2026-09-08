import { MAPA_MINEDUC_65_35, MAPA_MINEDUC_60_40, MineducTramoMinutos, RegimenHorario } from './tablasMineduc';

export interface ResultadoCalculoJornadaMinutos {
  horasContrato: number;
  minutosContratoTotales: number;
  horasPedagogicasDisponiblesMax: number;
  minutosLectivosDisponiblesMax: number;
  horasPedagogicasAsignadas: number;
  minutosLectivosAsignados: number;
  horasPedagogicasVacantes: number;
  minutosLectivosVacantes: number;
  minutosRecreoAsignados: number;
  minutosNoLectivosCalculados: number;
  minutosUsadosTotales: number;
  esSobreasignado: boolean;
  minutosSobreasignados: number;
  cumple65_35: boolean;
}

/**
 * Obtiene el tramo oficial de la tabla MINEDUC según las horas contractuales (enteras).
 */
export function obtenerTramoMineduc(horasContrato: number, regimen: RegimenHorario = '65_35'): MineducTramoMinutos | null {
  const mapa = regimen === '60_40' ? MAPA_MINEDUC_60_40 : MAPA_MINEDUC_65_35;
  const horasEnteras = Math.floor(horasContrato);
  return mapa.get(horasEnteras) || null;
}

/**
 * Realiza el cálculo estricto en minutos enteros de la jornada docente.
 */
export function calcularJornadaMinutos(
  horasContrato: number,
  horasPedagogicasAsignadas: number,
  regimen: RegimenHorario = '65_35'
): ResultadoCalculoJornadaMinutos {
  const tramo = obtenerTramoMineduc(horasContrato, regimen);
  const minutosContratoTotales = Math.round(horasContrato * 60);

  if (!tramo) {
    const porcentajeLectivoMax = regimen === '60_40' ? 0.60 : 0.65;
    const maxLectivoMin = Math.floor(minutosContratoTotales * porcentajeLectivoMax);
    const maxHorasPed = Math.floor(maxLectivoMin / 45);
    const minsLectivosAsignados = Math.round(horasPedagogicasAsignadas * 45);
    const minsRecreo = Math.round(minsLectivosAsignados * (180 / 1710));
    const minsNoLectivos = Math.max(0, minutosContratoTotales - minsLectivosAsignados - minsRecreo);
    const minsUsados = minsLectivosAsignados + minsRecreo + minsNoLectivos;
    const sobreasignado = minsLectivosAsignados > maxLectivoMin;
    const pedVacantes = Math.max(0, maxHorasPed - horasPedagogicasAsignadas);
    const lectivasVacantes = Math.max(0, maxLectivoMin - minsLectivosAsignados);

    return {
      horasContrato,
      minutosContratoTotales,
      horasPedagogicasDisponiblesMax: maxHorasPed,
      minutosLectivosDisponiblesMax: maxLectivoMin,
      horasPedagogicasAsignadas,
      minutosLectivosAsignados: minsLectivosAsignados,
      horasPedagogicasVacantes: pedVacantes,
      minutosLectivosVacantes: lectivasVacantes,
      minutosRecreoAsignados: minsRecreo,
      minutosNoLectivosCalculados: minsNoLectivos,
      minutosUsadosTotales: minsUsados,
      esSobreasignado: sobreasignado,
      minutosSobreasignados: sobreasignado ? (minsLectivosAsignados - maxLectivoMin) : 0,
      cumple65_35: !sobreasignado
    };
  }

  const minsLectivosAsignados = Math.round(horasPedagogicasAsignadas * 45);
  const esSobreasignado = minsLectivosAsignados > tramo.lectivasMinutosCronologicos;

  const proporcionRecreo = tramo.lectivasHorasPedagogicas > 0
    ? (minsLectivosAsignados / tramo.lectivasMinutosCronologicos)
    : 0;
  const minsRecreo = Math.round(tramo.recreoMinutosCronologicos * Math.min(1, proporcionRecreo));

  const minsNoLectivos = tramo.noLectivasMinutosCronologicos;
  const minsUsados = minsLectivosAsignados + minsRecreo + minsNoLectivos;

  const horasPedagogicasVacantes = Math.max(0, tramo.lectivasHorasPedagogicas - horasPedagogicasAsignadas);
  const minutosLectivosVacantes = Math.max(0, tramo.lectivasMinutosCronologicos - minsLectivosAsignados);

  return {
    horasContrato,
    minutosContratoTotales,
    horasPedagogicasDisponiblesMax: tramo.lectivasHorasPedagogicas,
    minutosLectivosDisponiblesMax: tramo.lectivasMinutosCronologicos,
    horasPedagogicasAsignadas,
    minutosLectivosAsignados: minsLectivosAsignados,
    horasPedagogicasVacantes,
    minutosLectivosVacantes,
    minutosRecreoAsignados: minsRecreo,
    minutosNoLectivosCalculados: minsNoLectivos,
    minutosUsadosTotales: minsUsados,
    esSobreasignado,
    minutosSobreasignados: esSobreasignado ? (minsLectivosAsignados - tramo.lectivasMinutosCronologicos) : 0,
    cumple65_35: !esSobreasignado
  };
}

/**
 * Formatea minutos a representación legible en texto "Xh Ym" o "Xh".
 */
export function formatMinutosAHorasTexto(minutos: number): string {
  if (minutos <= 0) return '0h 0m';
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
