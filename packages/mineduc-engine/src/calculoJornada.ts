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
  aplicaArticulo69?: boolean;
  minutosReduccionArticulo69?: number;
  horasReduccionArticulo69?: number;
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
 * Si aplica Artículo 69, la jornada de aula lectiva se reduce a un máximo de 24 horas cronológicas (32 HA),
 * transfiriendo automáticamente la diferencia al Tiempo No Lectivo.
 */
export function calcularJornadaMinutos(
  horasContrato: number,
  horasPedagogicasAsignadas: number,
  regimen: RegimenHorario = '65_35',
  aplicaArticulo69: boolean = false
): ResultadoCalculoJornadaMinutos {
  const tramo = obtenerTramoMineduc(horasContrato, regimen);
  const minutosContratoTotales = Math.round(horasContrato * 60);

  if (!tramo) {
    const porcentajeLectivoMax = regimen === '60_40' ? 0.60 : 0.65;
    let maxLectivoMin = Math.floor(minutosContratoTotales * porcentajeLectivoMax);
    let maxHorasPed = Math.floor(maxLectivoMin / 45);
    const minsLectivosAsignados = Math.round(horasPedagogicasAsignadas * 45);
    const minsRecreo = Math.round(minsLectivosAsignados * (180 / 1710));
    let minsNoLectivos = Math.max(0, minutosContratoTotales - minsLectivosAsignados - minsRecreo);

    let reduccionArt69Mins = 0;
    if (aplicaArticulo69 && maxLectivoMin > 1440) {
      reduccionArt69Mins = maxLectivoMin - 1440;
      maxLectivoMin = 1440;
      maxHorasPed = 32;
      minsNoLectivos += reduccionArt69Mins;
    }

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
      cumple65_35: !sobreasignado,
      aplicaArticulo69,
      minutosReduccionArticulo69: reduccionArt69Mins,
      horasReduccionArticulo69: Number((reduccionArt69Mins / 60).toFixed(2))
    };
  }

  let maxLectivasHorasPed = tramo.lectivasHorasPedagogicas;
  let maxLectivasMins = tramo.lectivasMinutosCronologicos;
  let minsNoLectivos = tramo.noLectivasMinutosCronologicos;
  let reduccionArt69Mins = 0;

  if (aplicaArticulo69 && maxLectivasMins > 1440) {
    reduccionArt69Mins = maxLectivasMins - 1440;
    maxLectivasMins = 1440;
    maxLectivasHorasPed = 32;
    minsNoLectivos += reduccionArt69Mins;
  }

  const minsLectivosAsignados = Math.round(horasPedagogicasAsignadas * 45);
  const esSobreasignado = minsLectivosAsignados > maxLectivasMins;

  const proporcionRecreo = tramo.lectivasHorasPedagogicas > 0
    ? (minsLectivosAsignados / tramo.lectivasMinutosCronologicos)
    : 0;
  const minsRecreo = Math.round(tramo.recreoMinutosCronologicos * Math.min(1, proporcionRecreo));

  const minsUsados = minsLectivosAsignados + minsRecreo + minsNoLectivos;
  const horasPedagogicasVacantes = Math.max(0, maxLectivasHorasPed - horasPedagogicasAsignadas);
  const minutosLectivosVacantes = Math.max(0, maxLectivasMins - minsLectivosAsignados);

  return {
    horasContrato,
    minutosContratoTotales,
    horasPedagogicasDisponiblesMax: maxLectivasHorasPed,
    minutosLectivosDisponiblesMax: maxLectivasMins,
    horasPedagogicasAsignadas,
    minutosLectivosAsignados: minsLectivosAsignados,
    horasPedagogicasVacantes,
    minutosLectivosVacantes,
    minutosRecreoAsignados: minsRecreo,
    minutosNoLectivosCalculados: minsNoLectivos,
    minutosUsadosTotales: minsUsados,
    esSobreasignado,
    minutosSobreasignados: esSobreasignado ? (minsLectivosAsignados - maxLectivasMins) : 0,
    cumple65_35: !esSobreasignado,
    aplicaArticulo69,
    minutosReduccionArticulo69: reduccionArt69Mins,
    horasReduccionArticulo69: Number((reduccionArt69Mins / 60).toFixed(2))
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
