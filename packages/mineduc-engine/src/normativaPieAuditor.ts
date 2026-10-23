// =============================================================================
// REGLA DE NEGOCIO PURA: MOTOR DE AUDITORÍA Y CUADRE PIE (NORMATIVA PIEAUDITOR)
// Basado en Decreto 170/2009 y Ordinario N° 2398 (20/12/2023) MINEDUC Chile
// =============================================================================

import { esModalidadAdultos } from './modalidades';

export interface ItemNormativaPie {
  neet: { cantidad_estudiantes: number; horas_cronologicas: number };
  neep: { cantidad_estudiantes: number; horas_cronologicas: number };
  total_horas_cronologicas: number;
  distribucion_profesionales: {
    profesor_educacion_diferencial: string; // HH:MM
    profesional_asistente_educacion: string; // HH:MM
  };
}

export interface MatrizNormativaPie {
  con_jec: ItemNormativaPie[];
  sin_jec: ItemNormativaPie[];
}

export const MATRIZ_NORMATIVA_PIE: MatrizNormativaPie = {
  con_jec: [
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 1, horas_cronologicas: 3 },
      total_horas_cronologicas: 13,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "08:15",
        profesional_asistente_educacion: "04:45"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 2, horas_cronologicas: 6 },
      total_horas_cronologicas: 16,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "10:30",
        profesional_asistente_educacion: "05:30"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 3, horas_cronologicas: 9 },
      total_horas_cronologicas: 19,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "12:45",
        profesional_asistente_educacion: "06:15"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 4, horas_cronologicas: 12 },
      total_horas_cronologicas: 22,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "15:00",
        profesional_asistente_educacion: "07:00"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 5, horas_cronologicas: 15 },
      total_horas_cronologicas: 25,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "17:15",
        profesional_asistente_educacion: "07:45"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 6, horas_cronologicas: 18 },
      total_horas_cronologicas: 28,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "19:30",
        profesional_asistente_educacion: "08:30"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 7, horas_cronologicas: 21 },
      total_horas_cronologicas: 31,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "21:45",
        profesional_asistente_educacion: "09:15"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 8, horas_cronologicas: 24 },
      total_horas_cronologicas: 34,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "24:00",
        profesional_asistente_educacion: "10:00"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 9, horas_cronologicas: 27 },
      total_horas_cronologicas: 37,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "26:15",
        profesional_asistente_educacion: "10:45"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 10 },
      neep: { cantidad_estudiantes: 10, horas_cronologicas: 30 },
      total_horas_cronologicas: 40,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "28:30",
        profesional_asistente_educacion: "11:30"
      }
    }
  ],
  sin_jec: [
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 1, horas_cronologicas: 3 },
      total_horas_cronologicas: 10,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "06:45",
        profesional_asistente_educacion: "03:15"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 2, horas_cronologicas: 6 },
      total_horas_cronologicas: 13,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "09:00",
        profesional_asistente_educacion: "04:00"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 3, horas_cronologicas: 9 },
      total_horas_cronologicas: 16,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "11:15",
        profesional_asistente_educacion: "04:45"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 4, horas_cronologicas: 12 },
      total_horas_cronologicas: 19,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "13:30",
        profesional_asistente_educacion: "05:30"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 5, horas_cronologicas: 15 },
      total_horas_cronologicas: 22,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "15:45",
        profesional_asistente_educacion: "06:15"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 6, horas_cronologicas: 18 },
      total_horas_cronologicas: 25,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "18:00",
        profesional_asistente_educacion: "07:00"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 7, horas_cronologicas: 21 },
      total_horas_cronologicas: 28,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "20:15",
        profesional_asistente_educacion: "07:45"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 8, horas_cronologicas: 24 },
      total_horas_cronologicas: 31,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "22:30",
        profesional_asistente_educacion: "08:30"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 9, horas_cronologicas: 27 },
      total_horas_cronologicas: 34,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "24:45",
        profesional_asistente_educacion: "09:15"
      }
    },
    {
      neet: { cantidad_estudiantes: 5, horas_cronologicas: 7 },
      neep: { cantidad_estudiantes: 10, horas_cronologicas: 30 },
      total_horas_cronologicas: 37,
      distribucion_profesionales: {
        profesor_educacion_diferencial: "27:00",
        profesional_asistente_educacion: "10:00"
      }
    }
  ]
};

export function hhmmToDec(hhmmStr: string): number {
  if (!hhmmStr || !hhmmStr.includes(':')) {
    const parsed = parseFloat(hhmmStr);
    return isNaN(parsed) ? 0 : parsed;
  }
  const parts = hhmmStr.split(':');
  const hrs = parseFloat(parts[0]) || 0;
  const mins = parseFloat(parts[1]) || 0;
  return parseFloat((hrs + mins / 60.0).toFixed(4));
}

export function decToHhmm(hoursDecimal: number): string {
  const hrs = Math.floor(hoursDecimal);
  let mins = Math.round((hoursDecimal - hrs) * 60);
  let finalHrs = hrs;
  if (mins === 60) {
    finalHrs += 1;
    mins = 0;
  }
  return `${String(finalHrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export interface ResultadoDemandaPieCurso {
  horasTotalCronologicas: number;
  horasDiferencialDecimal: number;
  horasDiferencialHHMM: string;
  horasPaeDecimal: number;
  horasPaeHHMM: string;
  horasTrabajoColaborativoCronologicas: number; // 3.0 hrs mínimas reglamentarias (Art. 86 Dec. 170 / Ley 20.903)
  neetCount: number;
  neepCount: number;
  isJec: boolean;
  cumpleAforo: boolean;
  observacionNormativa: string;
}

/**
 * Calcula la demanda horaria normativa PIE de un curso según la tabla oficial Decreto 170 y Ord. 2398
 */
export function calcularDemandaNormativaPieCurso(
  neetCount: number,
  neepCount: number,
  isJec: boolean
): ResultadoDemandaPieCurso {
  const regKey = isJec ? 'con_jec' : 'sin_jec';
  const table = MATRIZ_NORMATIVA_PIE[regKey];

  let reqEdDif = 0;
  let reqPae = 0;
  let reqTotal = 0;

  if (neetCount === 0 && neepCount === 0) {
    return {
      horasTotalCronologicas: 0,
      horasDiferencialDecimal: 0,
      horasDiferencialHHMM: "00:00",
      horasPaeDecimal: 0,
      horasPaeHHMM: "00:00",
      horasTrabajoColaborativoCronologicas: 0,
      neetCount: 0,
      neepCount: 0,
      isJec,
      cumpleAforo: true,
      observacionNormativa: "Curso sin matrícula PIE asignada."
    };
  }

  // Caso 1: Solo NEET (sin NEEP)
  if (neepCount === 0 && neetCount > 0) {
    if (isJec) {
      reqEdDif = 6.25; // 06:15
      reqPae = 3.75;   // 03:45
      reqTotal = 10.0;
    } else {
      reqEdDif = 4.50; // 04:30
      reqPae = 2.50;   // 02:30
      reqTotal = 7.0;
    }
  } else {
    // Caso 2: Con NEEP
    const match = table.find(item => item.neep.cantidad_estudiantes === neepCount);
    if (match) {
      reqEdDif = hhmmToDec(match.distribucion_profesionales.profesor_educacion_diferencial);
      reqPae = hhmmToDec(match.distribucion_profesionales.profesional_asistente_educacion);
      reqTotal = match.total_horas_cronologicas;
    } else {
      // Proyección para más de 10 NEEP
      const lastItem = table[table.length - 1];
      const baseEd = hhmmToDec(lastItem.distribucion_profesionales.profesor_educacion_diferencial);
      const basePae = hhmmToDec(lastItem.distribucion_profesionales.profesional_asistente_educacion);
      const extraNeep = Math.max(0, neepCount - lastItem.neep.cantidad_estudiantes);
      reqEdDif = baseEd + extraNeep * 2.25;
      reqPae = basePae + extraNeep * 0.75;
      reqTotal = lastItem.total_horas_cronologicas + extraNeep * 3;
    }
  }

  const cumpleAforo = neetCount <= 5 && neepCount <= 2;
  const observacionNormativa = cumpleAforo
    ? `Aforo reglamentario Decreto 170 (${neetCount} NEET + ${neepCount} NEEP). Demanda: ${decToHhmm(reqTotal)} hrs (${decToHhmm(reqEdDif)} Diferencial + ${decToHhmm(reqPae)} PAE) + 3h Trabajo Colaborativo.`
    : `⚠️ Aforo excedido (${neetCount}/5 NEET, ${neepCount}/2 NEEP). Requiere autorización fundada de la SEREMI de Educación.`;

  return {
    horasTotalCronologicas: parseFloat(reqTotal.toFixed(2)),
    horasDiferencialDecimal: parseFloat(reqEdDif.toFixed(2)),
    horasDiferencialHHMM: decToHhmm(reqEdDif),
    horasPaeDecimal: parseFloat(reqPae.toFixed(2)),
    horasPaeHHMM: decToHhmm(reqPae),
    horasTrabajoColaborativoCronologicas: 3.0,
    neetCount,
    neepCount,
    isJec,
    cumpleAforo,
    observacionNormativa
  };
}

export interface ProfesionalDisponiblePie {
  run: string;
  nombre: string;
  cargo?: string;
  tipo_profesional: 'Docente Diferencial' | 'Profesional Asistente PAE' | 'Técnico en Educación Especial' | 'Docente de Aula (Trabajo Colaborativo)';
  horasContratadas: number;
  asignatura?: string;
}

export interface CursoParaAutoAsignar {
  nombre: string;
  nivel?: string;
  regimen?: string;
  alumnos_neet?: number;
  alumnos_neep?: number;
  docente_titular_run?: string;
}

export interface AsignacionSugeridaPie {
  id: string;
  funcionario_run: string;
  nombre?: string;
  cargo?: string;
  tipo_profesional: 'Docente Diferencial' | 'Profesional Asistente PAE' | 'Técnico en Educación Especial' | 'Docente de Aula (Trabajo Colaborativo)';
  horas_asignadas: number;
  tipo_apoyo: 'Co-docencia Aula Común' | 'Aula de Recursos' | 'Apoyo Técnico en Aula' | 'Trabajo Colaborativo / Co-Planificación' | 'Ambas';
  docente_aula_asignatura?: string;
}

export interface ResultadoAutoAsignacionPie {
  asignacionesPorCurso: {
    [cursoNombre: string]: AsignacionSugeridaPie[];
  };
  totalDemandaDiferencial: number;
  totalDemandaPae: number;
  totalDemandaTrabajoColaborativo: number;
  totalHorasAsignadasDiferencial: number;
  totalHorasAsignadasPae: number;
  totalHorasAsignadasTecnicos: number;
  totalHorasAsignadasColaborativo: number;
  saldoHorasDiferencial: number;
  saldoHorasPae: number;
  saldoHorasTecnicos: number;
  saldoHorasColaborativo: number;
  cursosCubiertosAlCienPorciento: boolean;
  resumenPokaYoke: string[];
}

/**
 * Algoritmo Jidoka (Lean/Toyota) de auto-balance y asignación integral de horas PIE
 */
export function autoAsignarHorasPieCursos(
  cursos: CursoParaAutoAsignar[],
  profesionales: ProfesionalDisponiblePie[]
): ResultadoAutoAsignacionPie {
  const asignacionesPorCurso: { [cursoNombre: string]: AsignacionSugeridaPie[] } = {};
  const resumenPokaYoke: string[] = [];

  const educadores = profesionales
    .filter(p => p.tipo_profesional === 'Docente Diferencial')
    .map(p => ({ ...p, horasRestantes: p.horasContratadas }));

  const asistentes = profesionales
    .filter(p => p.tipo_profesional === 'Profesional Asistente PAE')
    .map(p => ({ ...p, horasRestantes: p.horasContratadas }));

  const tecnicos = profesionales
    .filter(p => p.tipo_profesional === 'Técnico en Educación Especial')
    .map(p => ({ ...p, horasRestantes: p.horasContratadas }));

  const docentesAula = profesionales
    .filter(p => p.tipo_profesional === 'Docente de Aula (Trabajo Colaborativo)')
    .map(p => ({ ...p, horasRestantes: p.horasContratadas }));

  let totalDemandaDiferencial = 0;
  let totalDemandaPae = 0;
  let totalDemandaTrabajoColaborativo = 0;
  let totalHorasAsignadasDiferencial = 0;
  let totalHorasAsignadasPae = 0;
  let totalHorasAsignadasTecnicos = 0;
  let totalHorasAsignadasColaborativo = 0;

  for (const curso of cursos) {
    const isJec = curso.regimen === 'JEC';
    const neet = curso.alumnos_neet ?? 0;
    const neep = curso.alumnos_neep ?? 0;
    const esEpja = esModalidadAdultos(curso.nombre) || (curso.nivel ? esModalidadAdultos(curso.nivel) : false);

    // Excluir del cobro de 3.0h de Trabajo Colaborativo (Art. 86) a cursos sin matrícula PIE y a modalidades de Educación de Adultos (EPJA)
    const tienePie = (neet > 0 || neep > 0) && !esEpja;
    const demanda = tienePie
      ? calcularDemandaNormativaPieCurso(neet, neep, isJec)
      : {
          horasTotalCronologicas: 0,
          horasDiferencialDecimal: 0,
          horasDiferencialHHMM: "00:00",
          horasPaeDecimal: 0,
          horasPaeHHMM: "00:00",
          horasTrabajoColaborativoCronologicas: 0,
          neetCount: neet,
          neepCount: neep,
          isJec,
          cumpleAforo: true,
          observacionNormativa: esEpja ? "EPJA no elegible para Programa de Integración Escolar (PIE)." : "Curso sin matrícula PIE asignada."
        };

    totalDemandaDiferencial += demanda.horasDiferencialDecimal;
    totalDemandaPae += demanda.horasPaeDecimal;

    const horasColabRequeridas = tienePie ? demanda.horasTrabajoColaborativoCronologicas : 0;
    totalDemandaTrabajoColaborativo += horasColabRequeridas;

    const asigsCurso: AsignacionSugeridaPie[] = [];

    // 1. Asignar horas Docente Diferencial (Co-docencia aula común)
    let horasDifFaltantes = demanda.horasDiferencialDecimal;
    for (const doc of educadores) {
      if (horasDifFaltantes <= 0) break;
      if (doc.horasRestantes > 0) {
        const horasAAsignar = Math.min(doc.horasRestantes, horasDifFaltantes);
        doc.horasRestantes -= horasAAsignar;
        horasDifFaltantes -= horasAAsignar;
        totalHorasAsignadasDiferencial += horasAAsignar;

        asigsCurso.push({
          id: `auto-dif-${curso.nombre}-${doc.run}`,
          funcionario_run: doc.run,
          nombre: doc.nombre,
          cargo: doc.cargo || 'Docente Diferencial',
          tipo_profesional: 'Docente Diferencial',
          horas_asignadas: parseFloat(horasAAsignar.toFixed(1)),
          tipo_apoyo: 'Co-docencia Aula Común',
        });
      }
    }

    if (horasDifFaltantes > 0) {
      resumenPokaYoke.push(`⚠️ ${curso.nombre}: Faltan ${horasDifFaltantes.toFixed(1)}h de Educador Diferencial.`);
    }

    // 2. Asignar horas Asistente PAE Profesional (Aula de recursos / apoyo clínico)
    let horasPaeFaltantes = demanda.horasPaeDecimal;
    for (const asis of asistentes) {
      if (horasPaeFaltantes <= 0) break;
      if (asis.horasRestantes > 0) {
        const horasAAsignar = Math.min(asis.horasRestantes, horasPaeFaltantes);
        asis.horasRestantes -= horasAAsignar;
        horasPaeFaltantes -= horasAAsignar;
        totalHorasAsignadasPae += horasAAsignar;

        asigsCurso.push({
          id: `auto-pae-${curso.nombre}-${asis.run}`,
          funcionario_run: asis.run,
          nombre: asis.nombre,
          cargo: asis.cargo || 'Profesional Asistente PAE',
          tipo_profesional: 'Profesional Asistente PAE',
          horas_asignadas: parseFloat(horasAAsignar.toFixed(1)),
          tipo_apoyo: 'Aula de Recursos',
        });
      }
    }

    if (horasPaeFaltantes > 0) {
      resumenPokaYoke.push(`⚠️ ${curso.nombre}: Faltan ${horasPaeFaltantes.toFixed(1)}h de Asistente PAE.`);
    }

    // 3. Asignar Asistente Técnico en Educación Especial (si hay disponibles y tiene PIE)
    if (tienePie) {
      for (const tec of tecnicos) {
        if (tec.horasRestantes >= 2.0) {
          const horasTec = Math.min(tec.horasRestantes, isJec ? 4.0 : 2.5);
          tec.horasRestantes -= horasTec;
          totalHorasAsignadasTecnicos += horasTec;

          asigsCurso.push({
            id: `auto-tec-${curso.nombre}-${tec.run}`,
            funcionario_run: tec.run,
            nombre: tec.nombre,
            cargo: tec.cargo || 'Técnico en Educación Especial',
            tipo_profesional: 'Técnico en Educación Especial',
            horas_asignadas: parseFloat(horasTec.toFixed(1)),
            tipo_apoyo: 'Apoyo Técnico en Aula',
          });
          break;
        }
      }
    }

    // 4. Asignar Docente de Aula Regular (3.0 hrs de Trabajo Colaborativo Decreto 170 Art. 86 si corresponde)
    if (horasColabRequeridas > 0) {
      let horasColabFaltantes = horasColabRequeridas;
      const docenteTitularMatch = curso.docente_titular_run
        ? docentesAula.find(d => d.run === curso.docente_titular_run)
        : null;

      if (docenteTitularMatch && docenteTitularMatch.horasRestantes >= horasColabRequeridas) {
        docenteTitularMatch.horasRestantes -= horasColabRequeridas;
        horasColabFaltantes = 0;
        totalHorasAsignadasColaborativo += horasColabRequeridas;

        asigsCurso.push({
          id: `auto-colab-${curso.nombre}-${docenteTitularMatch.run}`,
          funcionario_run: docenteTitularMatch.run,
          nombre: docenteTitularMatch.nombre,
          cargo: docenteTitularMatch.cargo || 'Docente de Aula',
          tipo_profesional: 'Docente de Aula (Trabajo Colaborativo)',
          horas_asignadas: horasColabRequeridas,
          tipo_apoyo: 'Trabajo Colaborativo / Co-Planificación',
          docente_aula_asignatura: docenteTitularMatch.asignatura || 'Lenguaje y Matemática',
        });
      } else {
        for (const docA of docentesAula) {
          if (horasColabFaltantes <= 0) break;
          if (docA.horasRestantes > 0) {
            const horasColab = Math.min(docA.horasRestantes, horasColabFaltantes);
            docA.horasRestantes -= horasColab;
            horasColabFaltantes -= horasColab;
            totalHorasAsignadasColaborativo += horasColab;

            asigsCurso.push({
              id: `auto-colab-${curso.nombre}-${docA.run}`,
              funcionario_run: docA.run,
              nombre: docA.nombre,
              cargo: docA.cargo || 'Docente de Aula',
              tipo_profesional: 'Docente de Aula (Trabajo Colaborativo)',
              horas_asignadas: parseFloat(horasColab.toFixed(1)),
              tipo_apoyo: 'Trabajo Colaborativo / Co-Planificación',
              docente_aula_asignatura: docA.asignatura || 'Asignatura Troncal',
            });
          }
        }
      }

      if (horasColabFaltantes > 0) {
        resumenPokaYoke.push(`ℹ️ ${curso.nombre}: Faltan ${horasColabFaltantes.toFixed(1)}h de Trabajo Colaborativo con Docente de Aula (Art. 86).`);
      }
    }

    asignacionesPorCurso[curso.nombre] = asigsCurso;
  }

  const saldoHorasDiferencial = educadores.reduce((sum, d) => sum + d.horasRestantes, 0);
  const saldoHorasPae = asistentes.reduce((sum, a) => sum + a.horasRestantes, 0);
  const saldoHorasTecnicos = tecnicos.reduce((sum, t) => sum + t.horasRestantes, 0);
  const saldoHorasColaborativo = docentesAula.reduce((sum, c) => sum + c.horasRestantes, 0);
  const cursosCubiertosAlCienPorciento = !resumenPokaYoke.some(m => m.startsWith('⚠️'));

  if (cursosCubiertosAlCienPorciento) {
    resumenPokaYoke.unshift('✓ Auto-balance Jidoka Integral: Demanda cubierta según Decreto 170, Decreto 83 y Art. 86.');
  }

  return {
    asignacionesPorCurso,
    totalDemandaDiferencial: parseFloat(totalDemandaDiferencial.toFixed(1)),
    totalDemandaPae: parseFloat(totalDemandaPae.toFixed(1)),
    totalDemandaTrabajoColaborativo,
    totalHorasAsignadasDiferencial: parseFloat(totalHorasAsignadasDiferencial.toFixed(1)),
    totalHorasAsignadasPae: parseFloat(totalHorasAsignadasPae.toFixed(1)),
    totalHorasAsignadasTecnicos: parseFloat(totalHorasAsignadasTecnicos.toFixed(1)),
    totalHorasAsignadasColaborativo: parseFloat(totalHorasAsignadasColaborativo.toFixed(1)),
    saldoHorasDiferencial: parseFloat(saldoHorasDiferencial.toFixed(1)),
    saldoHorasPae: parseFloat(saldoHorasPae.toFixed(1)),
    saldoHorasTecnicos: parseFloat(saldoHorasTecnicos.toFixed(1)),
    saldoHorasColaborativo: parseFloat(saldoHorasColaborativo.toFixed(1)),
    cursosCubiertosAlCienPorciento,
    resumenPokaYoke,
  };
}
