/**
 * Motor de Homologación y Cuadratura Normativa para Planillas DEP (PAL 2027 & GDP)
 * SLEP Valle Diguillín
 */

import { Docente, AsistenteEducacion, Establecimiento, CursoSae, AsignacionHoraria } from '../types';
import { determinarRegimenNormativo } from '@slep/mineduc-engine';

// Tablas de Referencia Normativa Oficiales de la DEP (Rango A4:D47)
// Mapeo exacto de Horas Aula Pedagógicas (HA) a [HA, Horas Lectivas Cronológicas, Horas No Lectivas Cronológicas, Jornada]
export const TABLA_65_35_OFICIAL: Record<number, { lectivasCrono: number; noLectivasCrono: number; jornada: number }> = {
  38: { lectivasCrono: 28.5, noLectivasCrono: 15.5, jornada: 44 },
  37: { lectivasCrono: 27.75, noLectivasCrono: 15.25, jornada: 43 },
  36: { lectivasCrono: 27.0, noLectivasCrono: 15.0, jornada: 42 },
  35: { lectivasCrono: 26.25, noLectivasCrono: 14.75, jornada: 41 }, // Primer match en VLOOKUP fila 7
  34: { lectivasCrono: 25.5, noLectivasCrono: 13.5, jornada: 39 },
  33: { lectivasCrono: 24.75, noLectivasCrono: 13.25, jornada: 38 },
  32: { lectivasCrono: 24.0, noLectivasCrono: 13.0, jornada: 37 },
  31: { lectivasCrono: 23.25, noLectivasCrono: 12.75, jornada: 36 },
  30: { lectivasCrono: 22.5, noLectivasCrono: 12.5, jornada: 35 },
  29: { lectivasCrono: 21.75, noLectivasCrono: 12.25, jornada: 34 },
  28: { lectivasCrono: 21.0, noLectivasCrono: 12.0, jornada: 33 },
  27: { lectivasCrono: 20.25, noLectivasCrono: 11.75, jornada: 32 },
  26: { lectivasCrono: 19.5, noLectivasCrono: 11.5, jornada: 31 },
  25: { lectivasCrono: 18.75, noLectivasCrono: 11.25, jornada: 30 },
  24: { lectivasCrono: 18.0, noLectivasCrono: 11.0, jornada: 29 },
  23: { lectivasCrono: 17.25, noLectivasCrono: 10.75, jornada: 28 },
  22: { lectivasCrono: 16.5, noLectivasCrono: 10.5, jornada: 27 },
  21: { lectivasCrono: 15.75, noLectivasCrono: 10.25, jornada: 26 },
  20: { lectivasCrono: 15.0, noLectivasCrono: 10.0, jornada: 25 },
  19: { lectivasCrono: 14.25, noLectivasCrono: 9.75, jornada: 24 },
  18: { lectivasCrono: 13.5, noLectivasCrono: 9.5, jornada: 23 },
  17: { lectivasCrono: 12.75, noLectivasCrono: 9.25, jornada: 22 },
  16: { lectivasCrono: 12.0, noLectivasCrono: 9.0, jornada: 21 },
  15: { lectivasCrono: 11.25, noLectivasCrono: 7.75, jornada: 19 },
  14: { lectivasCrono: 10.5, noLectivasCrono: 7.5, jornada: 18 },
  13: { lectivasCrono: 9.75, noLectivasCrono: 7.25, jornada: 17 },
  12: { lectivasCrono: 9.0, noLectivasCrono: 7.0, jornada: 16 },
  11: { lectivasCrono: 8.25, noLectivasCrono: 6.75, jornada: 15 },
  10: { lectivasCrono: 7.5, noLectivasCrono: 6.5, jornada: 14 },
  9: { lectivasCrono: 6.75, noLectivasCrono: 5.25, jornada: 12 },
  8: { lectivasCrono: 6.0, noLectivasCrono: 5.0, jornada: 11 },
  7: { lectivasCrono: 5.25, noLectivasCrono: 4.75, jornada: 10 },
  6: { lectivasCrono: 4.5, noLectivasCrono: 4.5, jornada: 9 },
  5: { lectivasCrono: 3.75, noLectivasCrono: 4.25, jornada: 8 },
  4: { lectivasCrono: 3.0, noLectivasCrono: 4.0, jornada: 7 },
  3: { lectivasCrono: 2.25, noLectivasCrono: 3.75, jornada: 6 },
  2: { lectivasCrono: 1.5, noLectivasCrono: 2.5, jornada: 4 },
  1: { lectivasCrono: 0.75, noLectivasCrono: 1.25, jornada: 2 }
};

export const TABLA_60_40_OFICIAL: Record<number, { lectivasCrono: number; noLectivasCrono: number; jornada: number }> = {
  35: { lectivasCrono: 26.25, noLectivasCrono: 17.75, jornada: 44 },
  34: { lectivasCrono: 25.5, noLectivasCrono: 17.5, jornada: 43 },
  33: { lectivasCrono: 24.75, noLectivasCrono: 17.25, jornada: 42 },
  32: { lectivasCrono: 24.0, noLectivasCrono: 17.0, jornada: 41 },
  31: { lectivasCrono: 23.25, noLectivasCrono: 16.75, jornada: 40 },
  30: { lectivasCrono: 22.5, noLectivasCrono: 15.5, jornada: 38 },
  29: { lectivasCrono: 21.75, noLectivasCrono: 15.25, jornada: 37 },
  28: { lectivasCrono: 21.0, noLectivasCrono: 15.0, jornada: 36 },
  27: { lectivasCrono: 20.25, noLectivasCrono: 14.75, jornada: 35 },
  26: { lectivasCrono: 19.5, noLectivasCrono: 14.5, jornada: 34 },
  25: { lectivasCrono: 18.75, noLectivasCrono: 13.25, jornada: 32 },
  24: { lectivasCrono: 18.0, noLectivasCrono: 13.0, jornada: 31 },
  23: { lectivasCrono: 17.25, noLectivasCrono: 12.75, jornada: 30 },
  22: { lectivasCrono: 16.5, noLectivasCrono: 12.5, jornada: 29 },
  21: { lectivasCrono: 15.75, noLectivasCrono: 12.25, jornada: 28 },
  20: { lectivasCrono: 15.0, noLectivasCrono: 11.0, jornada: 26 },
  19: { lectivasCrono: 14.25, noLectivasCrono: 10.75, jornada: 25 },
  18: { lectivasCrono: 13.5, noLectivasCrono: 10.5, jornada: 24 },
  17: { lectivasCrono: 12.75, noLectivasCrono: 10.25, jornada: 23 },
  16: { lectivasCrono: 12.0, noLectivasCrono: 10.0, jornada: 22 },
  15: { lectivasCrono: 11.25, noLectivasCrono: 8.75, jornada: 20 },
  14: { lectivasCrono: 10.5, noLectivasCrono: 8.5, jornada: 19 },
  13: { lectivasCrono: 9.75, noLectivasCrono: 8.25, jornada: 18 },
  12: { lectivasCrono: 9.0, noLectivasCrono: 8.0, jornada: 17 },
  11: { lectivasCrono: 8.25, noLectivasCrono: 7.75, jornada: 16 },
  10: { lectivasCrono: 7.5, noLectivasCrono: 6.5, jornada: 14 },
  9: { lectivasCrono: 6.75, noLectivasCrono: 6.25, jornada: 13 },
  8: { lectivasCrono: 6.0, noLectivasCrono: 6.0, jornada: 12 },
  7: { lectivasCrono: 5.25, noLectivasCrono: 5.75, jornada: 11 },
  6: { lectivasCrono: 4.5, noLectivasCrono: 4.5, jornada: 9 },
  5: { lectivasCrono: 3.75, noLectivasCrono: 4.25, jornada: 8 },
  4: { lectivasCrono: 3.0, noLectivasCrono: 4.0, jornada: 7 },
  3: { lectivasCrono: 2.25, noLectivasCrono: 3.75, jornada: 6 },
  2: { lectivasCrono: 1.5, noLectivasCrono: 2.5, jornada: 4 },
  1: { lectivasCrono: 0.75, noLectivasCrono: 1.25, jornada: 2 }
};

export function evaluarVlookupPal(ha: number, proporcion: '65/35' | '60/40'): { lectivasCrono: number; noLectivasCrono: number } {
  if (ha <= 0) return { lectivasCrono: 0, noLectivasCrono: 0 };
  const tabla = proporcion === '60/40' ? TABLA_60_40_OFICIAL : TABLA_65_35_OFICIAL;
  const match = tabla[ha];
  if (match) {
    return { lectivasCrono: match.lectivasCrono, noLectivasCrono: match.noLectivasCrono };
  }
  // Interpolación de respaldo para HA mayor a 38 o intermedia
  const lectivasCrono = round(ha * 0.75, 2);
  const ratio = proporcion === '60/40' ? 0.6 : 0.65;
  const jornadaAprox = round(lectivasCrono / ratio, 0);
  const noLectivasCrono = round(jornadaAprox - lectivasCrono, 2);
  return { lectivasCrono, noLectivasCrono };
}

function round(val: number, decimals: number = 2): number {
  return Number(Math.round(Number(val + 'e' + decimals)) + 'e-' + decimals);
}

export function formatRut(rutRaw: string): string {
  const clean = rutRaw.replace(/[^0-9kK]/g, '').toUpperCase();
  if (clean.length < 2) return rutRaw;
  const dv = clean.slice(-1);
  const body = clean.slice(0, -1);
  let formatted = '';
  let count = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    formatted = body[i] + formatted;
    count++;
    if (count % 3 === 0 && i !== 0) {
      formatted = '.' + formatted;
    }
  }
  return `${formatted}-${dv}`;
}

/**
 * Sanitiza valores de texto para evitar CSV / Excel Formula Injection (=, +, -, @)
 */
export function sanitizeExcelText(val: any): string {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Obtiene el máximo de Horas Aula Pedagógicas (HA) que puede albergar una jornada sin excederla en VLOOKUP
 */
export function obtenerMaxHaParaJornada(
  jornadaDisponible: number,
  proporcion: '65/35' | '60/40'
): number {
  if (jornadaDisponible <= 0) return 0;
  const tabla = proporcion === '60/40' ? TABLA_60_40_OFICIAL : TABLA_65_35_OFICIAL;
  let maxHa = 0;
  for (const [haStr, item] of Object.entries(tabla)) {
    const ha = Number(haStr);
    if (item.jornada <= jornadaDisponible && ha > maxHa) {
      maxHa = ha;
    }
  }
  return maxHa;
}

export interface PalDocenteRowData {
  rut: string;
  establecimiento: string;
  rbd: number;
  nivel: 'Educación Parvularia' | 'Educación Básica' | 'Educación Media' | 'Ed. Básica/Media';
  estamento: 'Docente' | 'Educadora de Parvulos';
  cargo: string;
  funcion: 'Función Directiva' | 'Función Técnico Pedagógica' | 'Docente aula' | 'Otros (Talleristas / Apoyo / etc.)';
  calidadContrato: 'Titular' | 'Plazo Fijo' | 'Otros';
  art69: string;
  totalHrsContrato: number; // Col J
  hrsLectivasBasica: number; // Col K
  hrsLectivasMedia: number; // Col L
  proporcionHa: '65/35' | '60/40'; // Col M
  // Formula Nativa N: =IF(K+L>0, VLOOKUP(...), 0)
  // Formula Nativa O: =IF(K+L>0, VLOOKUP(...), 0)
  hrsPieCronologicas: number; // Col P
  hrsSepCronologicas: number; // Col Q
  otrasFuncionesNoLectivas: number; // Col R (Ajustada para que Col J = N + O + P + Q + R)
  observaciones: string; // Col S
}

export interface PalAsistenteRowData {
  rut: string;
  establecimiento: string;
  rbd: number;
  nivel: 'Educación Parvularia' | 'Educación Básica' | 'Educación Media';
  estamento: 'Asistente de la Educación';
  cargo: string;
  funcion: 'Administrativo' | 'Auxiliares' | 'Técnicos' | 'Profesionales';
  calidadContrato: 'Indefinido' | 'Plazo Fijo' | 'Otros';
  totalHrsContrato: number; // Col I
  hrsLectivasSubvGeneral: number; // Col J
  hrsPie: number; // Col K
  hrsSep: number; // Col L
  observaciones: string; // Col M
}

/**
 * Transforma un Docente en una o dos filas PAL (Regla 33 de la DEP: división por contrato)
 * garantizando cuadratura matemática exacta al milímetro con las fórmulas de Excel.
 */
export function homologarDocenteAPal(
  docente: Docente,
  establecimiento: Establecimiento,
  cursosColegio: CursoSae[],
  asignacionesColegio: AsignacionHoraria[]
): PalDocenteRowData[] {
  const asigsDoc = asignacionesColegio.filter(a => a.docenteId === docente.id);
  const cursosIds = new Set(asigsDoc.map(a => a.cursoId));
  const cursosDoc = cursosColegio.filter(c => cursosIds.has(c.id));

  // 1. Detección de Nivel Pedagógico (Regla 31 DEP: Bi-nivel Básica/Media)
  let tieneParvula = cursosDoc.some(c => /kínder|kinder|transición|parvul/i.test(c.nivel)) || /párvulo|parvulo/i.test(docente.titulo || docente.funcionPrincipal || '');
  let tieneBasica = cursosDoc.some(c => /básico|basica|básica|1° a 8°/i.test(c.nivel));
  let tieneMedia = cursosDoc.some(c => /medio|media|1° a 4°/i.test(c.nivel));

  let nivelPal: 'Educación Parvularia' | 'Educación Básica' | 'Educación Media' | 'Ed. Básica/Media' = 'Educación Básica';
  if (tieneBasica && tieneMedia) {
    nivelPal = 'Ed. Básica/Media';
  } else if (tieneMedia) {
    nivelPal = 'Educación Media';
  } else if (tieneParvula && !tieneBasica) {
    nivelPal = 'Educación Parvularia';
  } else {
    nivelPal = 'Educación Básica';
  }

  // 2. Estamento y Función oficial DEP
  const esEducadora = tieneParvula && (docente.estamento === 'OTRA_ESTABLECIMIENTO' || /educadora|párvulo|parvulo/i.test(docente.titulo || docente.cargoInstitucional || ''));
  const estamentoPal: 'Docente' | 'Educadora de Parvulos' = esEducadora ? 'Educadora de Parvulos' : 'Docente';

  let funcionPal: 'Función Directiva' | 'Función Técnico Pedagógica' | 'Docente aula' | 'Otros (Talleristas / Apoyo / etc.)' = 'Docente aula';
  if (docente.horasDirectivas && docente.horasDirectivas > 0) {
    funcionPal = 'Función Directiva';
  } else if ((docente.horasTecnicoPedagogicas && docente.horasTecnicoPedagogicas > 0) || (docente.horasCoordinacion && docente.horasCoordinacion > 0) || /utp|evaluador|orientador|curricul/i.test(docente.cargoInstitucional || docente.funcionPrincipal || '')) {
    funcionPal = 'Función Técnico Pedagógica';
  } else if (asigsDoc.some(a => a.esTallerSep || a.esTallerJec)) {
    funcionPal = 'Docente aula';
  }

  const cargoPal = docente.cargoInstitucional || docente.funcionPrincipal || (funcionPal === 'Función Directiva' ? 'DIRECTOR/A' : (funcionPal === 'Función Técnico Pedagógica' ? 'JEFE/A UTP' : 'DOCENTE DE AULA'));

  // 3. Horas pedagógicas clasificadas por proporción (65/35 vs 60/40) y ciclo (Básica vs Media)
  let haBasica65 = 0;
  let haMedia65 = 0;
  let haBasica60 = 0;
  let haMedia60 = 0;

  asigsDoc.forEach(a => {
    const curso = cursosColegio.find(c => c.id === a.cursoId);
    const esMedia = curso ? /medio|media/i.test(curso.nivel) : false;

    // Determinar proporción reglamentaria del curso
    let regProp: '65/35' | '60/40' = '65/35';
    if (curso && curso.regimenProporcion) {
      regProp = curso.regimenProporcion === '60_40' ? '60/40' : '65/35';
    } else {
      const regNorm = determinarRegimenNormativo(
        establecimiento.porcentajePrioritarios || 0,
        curso?.nivel || ''
      );
      regProp = regNorm === '60_40' ? '60/40' : '65/35';
    }

    if (regProp === '60/40') {
      if (esMedia) haMedia60 += a.horasPedagogicasAula;
      else haBasica60 += a.horasPedagogicasAula;
    } else {
      if (esMedia) haMedia65 += a.horasPedagogicasAula;
      else haBasica65 += a.horasPedagogicasAula;
    }
  });

  // Si no tenía asignaciones directas por curso pero registra docente.horasAula
  const totalHaAsigs = haBasica65 + haMedia65 + haBasica60 + haMedia60;
  if (totalHaAsigs === 0 && docente.horasAula && docente.horasAula > 0) {
    const regDefault: '65/35' | '60/40' = (establecimiento.porcentajePrioritarios >= 80) ? '60/40' : '65/35';
    const esMedia = nivelPal === 'Educación Media';
    if (regDefault === '60/40') {
      if (esMedia) haMedia60 = docente.horasAula;
      else haBasica60 = docente.horasAula;
    } else {
      if (esMedia) haMedia65 = docente.horasAula;
      else haBasica65 = docente.horasAula;
    }
  }

  const totalHa65 = haBasica65 + haMedia65;
  const totalHa60 = haBasica60 + haMedia60;
  const tieneAmbasProporciones = totalHa65 > 0 && totalHa60 > 0;

  const hSubvTit = Number(docente.horasSubvencionGeneralTitular || 0);
  const hSubvCtta = Number(docente.horasSubvencionGeneralContrata || 0);
  const hSepTit = Number(docente.horasSepTitular || 0);
  const hSepCtta = Number(docente.horasSepContrata || 0);
  const hPieTit = Number(docente.horasPieTitular || 0);
  const hPieCtta = Number(docente.horasPieContrata || 0);

  const totalTit = hSubvTit + hSepTit + hPieTit;
  const totalCtta = hSubvCtta + hSepCtta + hPieCtta;
  const tieneContratosMixtos = totalTit > 0 && totalCtta > 0;

  // Función interna para armar una fila con cuadratura matemática garantizada
  const armarFila = (
    calidad: 'Titular' | 'Plazo Fijo',
    jornadaContrato: number,
    kBasica: number,
    lMedia: number,
    pieCrono: number,
    sepCrono: number,
    obsSuffix: string = '',
    proporcionEspecifica?: '65/35' | '60/40',
    nivelEspecifico?: 'Educación Parvularia' | 'Educación Básica' | 'Educación Media' | 'Ed. Básica/Media'
  ): PalDocenteRowData => {
    const prop = proporcionEspecifica || ((establecimiento.porcentajePrioritarios >= 80) ? '60/40' : '65/35');
    const niv = nivelEspecifico || nivelPal;

    // Prevenir que el cruce de tablas VLOOKUP con jornadas compartidas exceda el total de la Columna J
    const dispJornada = Math.max(0, jornadaContrato - pieCrono - sepCrono);
    const maxHaPermitida = obtenerMaxHaParaJornada(dispJornada, prop);
    let totalHa = kBasica + lMedia;
    if (totalHa > maxHaPermitida && maxHaPermitida >= 0) {
      if (totalHa > 0) {
        const ratioBas = kBasica / totalHa;
        kBasica = Math.floor(maxHaPermitida * ratioBas);
        lMedia = maxHaPermitida - kBasica;
      } else {
        kBasica = 0;
        lMedia = 0;
      }
      totalHa = kBasica + lMedia;
    }

    const { lectivasCrono, noLectivasCrono } = evaluarVlookupPal(totalHa, prop);

    // Col R absorbe la diferencia exacta para cuadrar Col J = N + O + P + Q + R
    const sumaAsignada = round(lectivasCrono + noLectivasCrono + pieCrono + sepCrono, 2);
    let otrasFunciones = round(jornadaContrato - sumaAsignada, 2);
    if (otrasFunciones < 0) {
      otrasFunciones = 0;
    }

    const obsText = [
      docente.aplicaArticulo69 ? 'Acogido Art 69 Ley 19.070' : '',
      docente.observacionesDirector || '',
      obsSuffix
    ].filter(Boolean).join(' | ');

    return {
      rut: sanitizeExcelText(formatRut(docente.run)),
      establecimiento: sanitizeExcelText(establecimiento.nombre.toUpperCase()),
      rbd: Number(establecimiento.rbd),
      nivel: niv,
      estamento: estamentoPal,
      cargo: sanitizeExcelText(cargoPal.toUpperCase()),
      funcion: funcionPal,
      calidadContrato: calidad,
      art69: docente.aplicaArticulo69 ? 'SI' : '',
      totalHrsContrato: jornadaContrato,
      hrsLectivasBasica: kBasica,
      hrsLectivasMedia: lMedia,
      proporcionHa: prop,
      hrsPieCronologicas: pieCrono,
      hrsSepCronologicas: sepCrono,
      otrasFuncionesNoLectivas: otrasFunciones,
      observaciones: sanitizeExcelText(obsText)
    };
  };

  // CASO A: Docente con horas en AMBAS proporciones (65/35 y 60/40)
  // Se crean 2 filas independientes (una por cada régimen) para garantizar exactitud total en el VLOOKUP de Excel
  if (tieneAmbasProporciones) {
    const calidadUnica: 'Titular' | 'Plazo Fijo' = (totalTit > 0 || docente.calidadJuridica === 'TITULAR') ? 'Titular' : 'Plazo Fijo';
    const jornadaTotal = docente.horasContrato || (totalTit + totalCtta);
    const pieTotal = hPieTit + hPieCtta;
    const sepTotal = hSepTit + hSepCtta;
    const dispRegular = Math.max(0, jornadaTotal - pieTotal - sepTotal);

    // Requerimiento mínimo por tabla de cada tramo
    const req65 = TABLA_65_35_OFICIAL[totalHa65]?.jornada || Math.ceil(totalHa65 * 44 / 38);
    const req60 = TABLA_60_40_OFICIAL[totalHa60]?.jornada || Math.ceil(totalHa60 * 44 / 35);
    const reqTotal = req65 + req60;

    let c65 = 0;
    let c60 = 0;
    if (dispRegular >= reqTotal) {
      // Jornada suficiente para cubrir ambos requerimientos normativos
      c65 = req65;
      c60 = req60;
      const rem = dispRegular - reqTotal;
      if (rem > 0) {
        const add65 = Math.round(rem * (req65 / reqTotal));
        c65 += add65;
        c60 = dispRegular - c65;
      }
    } else if (dispRegular > 0 && reqTotal > 0) {
      c65 = Math.round(dispRegular * (req65 / reqTotal));
      c60 = dispRegular - c65;
      if (c65 === 0 && dispRegular >= 2) {
        c65 = 1;
        c60 = dispRegular - 1;
      } else if (c60 === 0 && dispRegular >= 2) {
        c60 = 1;
        c65 = dispRegular - 1;
      }
    } else {
      c65 = Math.round(dispRegular / 2);
      c60 = dispRegular - c65;
    }

    const nivel65: 'Educación Parvularia' | 'Educación Básica' | 'Educación Media' | 'Ed. Básica/Media' =
      (haBasica65 > 0 && haMedia65 > 0) ? 'Ed. Básica/Media' : (haMedia65 > 0 ? 'Educación Media' : 'Educación Básica');
    const nivel60: 'Educación Parvularia' | 'Educación Básica' | 'Educación Media' | 'Ed. Básica/Media' =
      (haBasica60 > 0 && haMedia60 > 0) ? 'Ed. Básica/Media' : (haMedia60 > 0 ? 'Educación Media' : (tieneParvula ? 'Educación Parvularia' : 'Educación Básica'));

    const fila65 = armarFila(
      calidadUnica,
      c65 + pieTotal + sepTotal,
      haBasica65,
      haMedia65,
      pieTotal,
      sepTotal,
      'Tramo 65/35',
      '65/35',
      nivel65
    );

    const fila60 = armarFila(
      calidadUnica,
      c60,
      haBasica60,
      haMedia60,
      0,
      0,
      'Tramo 60/40',
      '60/40',
      nivel60
    );

    return [fila65, fila60];
  }

  // CASO B: Proporción única (solo 60/40, solo 65/35 o sin docencia de aula)
  const proporcionHa: '65/35' | '60/40' = totalHa60 > 0
    ? '60/40'
    : (totalHa65 > 0
      ? '65/35'
      : ((establecimiento.porcentajePrioritarios >= 80) ? '60/40' : '65/35'));

  const haBasica = haBasica65 + haBasica60;
  const haMedia = haMedia65 + haMedia60;

  // Regla 33 DEP: Si tiene contratos Titular y Contrata, desdoblar en 2 filas
  if (tieneContratosMixtos) {
    const dispTit = Math.max(0, totalTit - hPieTit - hSepTit);
    const maxHaTit = obtenerMaxHaParaJornada(dispTit, proporcionHa);
    const dispCtta = Math.max(0, totalCtta - hPieCtta - hSepCtta);
    const maxHaCtta = obtenerMaxHaParaJornada(dispCtta, proporcionHa);

    const ratioTit = totalTit / (totalTit + totalCtta);
    let kBasTit = Math.min(maxHaTit, round(haBasica * ratioTit, 0));
    let lMedTit = Math.min(Math.max(0, maxHaTit - kBasTit), round(haMedia * ratioTit, 0));

    let kBasCtta = Math.min(maxHaCtta, haBasica - kBasTit);
    let lMedCtta = Math.min(Math.max(0, maxHaCtta - kBasCtta), haMedia - lMedTit);

    const filaTit = armarFila('Titular', totalTit, kBasTit, lMedTit, hPieTit, hSepTit, 'Contrato Titular', proporcionHa);
    const filaCtta = armarFila('Plazo Fijo', totalCtta, kBasCtta, lMedCtta, hPieCtta, hSepCtta, 'Contrato Contrata', proporcionHa);
    return [filaTit, filaCtta];
  }

  // Fila única
  const calidadUnica = (totalTit > 0 || docente.calidadJuridica === 'TITULAR') ? 'Titular' : 'Plazo Fijo';
  const jornada = docente.horasContrato || (totalTit + totalCtta);
  return [armarFila(calidadUnica, jornada, haBasica, haMedia, hPieTit + hPieCtta, hSepTit + hSepCtta, '', proporcionHa)];
}

/**
 * Transforma un Asistente de la Educación en filas PAL (con desdoblamiento si tiene calidad mixta)
 */
export function homologarAsistenteAPal(
  asistente: AsistenteEducacion,
  establecimiento: Establecimiento
): PalAsistenteRowData[] {
  // Mapeo exacto de Función a los 4 estamentos que totaliza el Resumen PAL
  let funcionPal: 'Administrativo' | 'Auxiliares' | 'Técnicos' | 'Profesionales' = 'Administrativo';
  switch (asistente.estamento) {
    case 'PROFESIONAL':
      funcionPal = 'Profesionales';
      break;
    case 'TECNICO':
      funcionPal = 'Técnicos';
      break;
    case 'AUXILIAR':
      funcionPal = 'Auxiliares';
      break;
    case 'PARADOCENTE_INSPECTORIA':
    case 'ADMINISTRATIVO':
    default:
      funcionPal = 'Administrativo';
      break;
  }

  // Detección de Nivel
  let nivelPal: 'Educación Parvularia' | 'Educación Básica' | 'Educación Media' = 'Educación Básica';
  if (asistente.esTecnicoParvulo || /párvulo|parvulo/i.test(asistente.cargoFuncion)) {
    nivelPal = 'Educación Parvularia';
  } else if (/media|liceo/i.test(asistente.cargoFuncion)) {
    nivelPal = 'Educación Media';
  }

  const hGralIndef = Number(asistente.horasSubvencionGeneralIndefinido || 0);
  const hGralPlazo = Number(asistente.horasSubvencionGeneralPlazoFijo || 0);
  const hPieIndef = Number(asistente.horasPieIndefinido || 0);
  const hPiePlazo = Number(asistente.horasPiePlazoFijo || 0);
  const hSepIndef = Number(asistente.horasSepIndefinido || 0);
  const hSepPlazo = Number(asistente.horasSepPlazoFijo || 0);

  const totalIndef = hGralIndef + hPieIndef + hSepIndef;
  const totalPlazo = hGralPlazo + hPiePlazo + hSepPlazo;
  const tieneContratosMixtos = totalIndef > 0 && totalPlazo > 0;

  if (tieneContratosMixtos) {
    const filaIndef: PalAsistenteRowData = {
      rut: sanitizeExcelText(formatRut(asistente.run)),
      establecimiento: sanitizeExcelText(establecimiento.nombre.toUpperCase()),
      rbd: Number(establecimiento.rbd),
      nivel: nivelPal,
      estamento: 'Asistente de la Educación',
      cargo: sanitizeExcelText((asistente.cargoFuncion || 'ASISTENTE DE LA EDUCACIÓN').toUpperCase()),
      funcion: funcionPal,
      calidadContrato: 'Indefinido',
      totalHrsContrato: totalIndef,
      hrsLectivasSubvGeneral: hGralIndef,
      hrsPie: hPieIndef,
      hrsSep: hSepIndef,
      observaciones: sanitizeExcelText(asistente.observaciones ? `${asistente.observaciones} | Contrato Indefinido` : 'Contrato Indefinido')
    };

    const filaPlazo: PalAsistenteRowData = {
      rut: sanitizeExcelText(formatRut(asistente.run)),
      establecimiento: sanitizeExcelText(establecimiento.nombre.toUpperCase()),
      rbd: Number(establecimiento.rbd),
      nivel: nivelPal,
      estamento: 'Asistente de la Educación',
      cargo: sanitizeExcelText((asistente.cargoFuncion || 'ASISTENTE DE LA EDUCACIÓN').toUpperCase()),
      funcion: funcionPal,
      calidadContrato: 'Plazo Fijo',
      totalHrsContrato: totalPlazo,
      hrsLectivasSubvGeneral: hGralPlazo,
      hrsPie: hPiePlazo,
      hrsSep: hSepPlazo,
      observaciones: sanitizeExcelText(asistente.observaciones ? `${asistente.observaciones} | Contrato Plazo Fijo` : 'Contrato Plazo Fijo')
    };

    return [filaIndef, filaPlazo];
  }

  const calidadUnica = totalIndef > 0 ? 'Indefinido' : 'Plazo Fijo';
  const jornada = asistente.horasContrato || (totalIndef + totalPlazo);

  return [
    {
      rut: sanitizeExcelText(formatRut(asistente.run)),
      establecimiento: sanitizeExcelText(establecimiento.nombre.toUpperCase()),
      rbd: Number(establecimiento.rbd),
      nivel: nivelPal,
      estamento: 'Asistente de la Educación',
      cargo: sanitizeExcelText((asistente.cargoFuncion || 'ASISTENTE DE LA EDUCACIÓN').toUpperCase()),
      funcion: funcionPal,
      calidadContrato: calidadUnica,
      totalHrsContrato: jornada,
      hrsLectivasSubvGeneral: hGralIndef + hGralPlazo,
      hrsPie: hPieIndef + hPiePlazo,
      hrsSep: hSepIndef + hSepPlazo,
      observaciones: sanitizeExcelText(asistente.observaciones || '')
    }
  ];
}

/**
 * Infiere metadatos inteligentes para completar la Planilla GDP sin fricción
 */
export function inferirPropuestaGdp(horasVigentes: number, horasSolicitadas: number, esNuevo: boolean): string {
  if (esNuevo || horasVigentes === 0) return 'Nva. Contratación';
  if (horasSolicitadas === horasVigentes) return 'Continuidad';
  if (horasSolicitadas > horasVigentes) return 'Aumento horas';
  if (horasSolicitadas < horasVigentes) return 'Reducción horas';
  return 'Continuidad';
}

/**
 * Normaliza y homologa cualquier nombre de nivel proveniente de los cursos del SaaS
 * a las categorías y nombres de nivel oficiales utilizados en la hoja "Info Establecimiento" de la DEP.
 */
export function normalizarNivelInfoEstablecimiento(nivel: string): string {
  const n = (nivel || '').toLowerCase().trim();

  // Parvularia
  if (/pre-?k|nt1|primer nivel de transici/i.test(n)) {
    return 'Prekínder';
  }
  if (/k[ií]nder|nt2|segundo nivel de transici/i.test(n)) {
    return 'Kínder';
  }
  if (/menor y mayor|medio menor/i.test(n)) {
    return 'medio menor y mayor';
  }
  if (/nt1\s*nt2|parvulari/i.test(n)) {
    return 'NT1 NT2';
  }

  // Básica 1° a 8° Regular
  for (let i = 1; i <= 8; i++) {
    const reg = new RegExp(`^${i}[°º]?\\s*(?:b[aá]sico|b\\b)`, 'i');
    if (reg.test(n) || n === `${i}° básico` || n === `${i} básico` || n === `${i}b`) {
      return `${i}° Básico`;
    }
  }

  // Media 1° a 4° Regular (HC / TP)
  for (let i = 1; i <= 4; i++) {
    const reg = new RegExp(`^${i}[°º]?\\s*(?:medio|m\\b)`, 'i');
    if (reg.test(n) || n === `${i}° medio` || n === `${i} medio` || n === `${i}m`) {
      return `${i}° Medio`;
    }
  }

  // Multigrados y Combinados
  if (/1[°º]?\s*(?:y|\-)\s*2/i.test(n) && /b[aá]sico/i.test(n)) {
    return '1° y 2°';
  }
  if (/3[°º]?\s*(?:y|\-)\s*4/i.test(n) && /b[aá]sico/i.test(n)) {
    return '3° y 4°';
  }

  // Modalidad Adultos EPJA Básica
  if (/epja|adulto|nocturn/i.test(n) && /1[°º]?\s*nivel\s*b[aá]sico|primer\s*nivel\s*b[aá]sico/i.test(n)) {
    return '1° nivel básico';
  }
  if (/epja|adulto|nocturn/i.test(n) && /2[°º]?\s*nivel\s*b[aá]sico|segundo\s*nivel\s*b[aá]sico/i.test(n)) {
    return '2° nivel básico';
  }
  if (/epja|adulto|nocturn/i.test(n) && /3[°º]?\s*nivel\s*b[aá]sico|tercer\s*nivel\s*b[aá]sico/i.test(n)) {
    return '3° nivel básico';
  }

  // Modalidad Adultos EPJA Media
  if (/epja|adulto|nocturn/i.test(n) && /1[°º]?\s*nivel\s*m|primer\s*nivel\s*m/i.test(n)) {
    return '1° nivel medio';
  }
  if (/epja|adulto|nocturn/i.test(n) && /2[°º]?\s*nivel\s*m|segundo\s*nivel\s*m/i.test(n)) {
    return '2° nivel medio';
  }
  if (/epja/i.test(n)) {
    return 'EPJA';
  }

  // Educación Especial y Talleres Laborales
  if (/servicios menores/i.test(n)) return 'taller laboral servicios menores';
  if (/asistencia al hogar/i.test(n)) return 'taller laboral asistencia al hogar';
  if (/invernadero/i.test(n)) return 'taller laboral invernadero y reciclaje';
  if (/habilidades para la vida/i.test(n)) return 'taller laboral habilidades para la vida';
  if (/laboral|taller tl|tl\b/i.test(n)) return 'Taller Laboral';
  if (/opci[oó]n 4/i.test(n)) return 'Opción 4';
  if (/\bce\b/i.test(n)) return 'CE';

  return nivel.trim();
}

/**
 * Normaliza el string que viene en la plantilla Excel DEP en la hoja Info Establecimiento
 * para permitir comparación tolerante a acentos, espacios dobles y variaciones de redacción.
 */
export function homologarNivelExcelPal(raw: string): string {
  const s = (raw || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

  if (/pre-?kinder|nt1/i.test(s)) return 'prekinder';
  if (/kinder|nt2/i.test(s)) return 'kinder';
  if (/medio menor/i.test(s)) return 'medio menor y mayor';
  if (/nt1 nt2/i.test(s)) return 'nt1 nt2';

  for (let i = 1; i <= 8; i++) {
    if (new RegExp(`^${i}[°º]?\\s*basico`, 'i').test(s)) {
      return `${i} basico`;
    }
  }

  for (let i = 1; i <= 4; i++) {
    if (new RegExp(`^${i}[°º]?\\s*medio`, 'i').test(s)) {
      return `${i} medio`;
    }
  }

  if (/1[°º]?\s*(?:y|-)\s*2/i.test(s)) return '1 y 2';
  if (/3[°º]?\s*(?:y|-)\s*4/i.test(s)) return '3 y 4';

  if (/pimer|primer|1[°º]?\s*nivel\s*basico/i.test(s)) return '1 nivel basico';
  if (/segundo|2[°º]?\s*nivel\s*basico/i.test(s)) return '2 nivel basico';
  if (/tercer|3[°º]?\s*nivel\s*basico/i.test(s)) return '3 nivel basico';

  if (/primer|1[°º]?\s*nivel\s*m/i.test(s)) return '1 nivel medio';
  if (/segundo|2[°º]?\s*nivel\s*m/i.test(s)) return '2 nivel medio';

  if (/servicios menores/i.test(s)) return 'taller laboral servicios menores';
  if (/asistencia al hogar/i.test(s)) return 'taller laboral asistencia al hogar';
  if (/invernadero/i.test(s)) return 'taller laboral invernadero y reciclaje';
  if (/habilidades para la vida/i.test(s)) return 'taller laboral habilidades para la vida';
  if (/laboral|taller tl|\btl\b/i.test(s)) return 'taller laboral';
  if (/opcion 4/i.test(s)) return 'opcion 4';
  if (/\bce\b/i.test(s)) return 'ce';
  if (/epja/i.test(s)) return 'epja';

  return s;
}
