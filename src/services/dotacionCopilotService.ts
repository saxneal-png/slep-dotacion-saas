import {
  Establecimiento,
  CursoSae,
  Docente,
  AsignacionHoraria,
  SalaInfraestructura
} from '../types';
import { calcularDiagnosticoColegio, DiagnosticoColegioCompleto } from './dotacionCalculationService';
import { geminiFetch } from './geminiApiClient';
import { normalizarRut, formatearRut } from '../utils/rutUtils';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';

export interface CopilotMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  source?: 'local' | 'gemini';
  metadata?: {
    colegioNombre?: string;
    periodo?: number;
    accionesSugeridas?: { label: string; action: string }[];
  };
}

export interface DotacionContextoCompleto {
  establecimiento: Establecimiento;
  periodo: number;
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  diagnostico: DiagnosticoColegioCompleto;
  todosLosDocentesTerritorio: Docente[];
  docentesMultiEscuela: {
    run: string;
    nombre: string;
    horasTotales: number;
    escuelas: { rbd: string; nombre?: string; horas: number }[];
    esInfractor44h: boolean;
  }[];
  resumenTexto: string;
}

/**
 * Serializa en un formato enriquecido y estructurado todo el contexto de la dotación activa.
 */
export function construirContextoDotacion(
  establecimiento: Establecimiento,
  periodo: number,
  salas: SalaInfraestructura[],
  cursos: CursoSae[],
  docentes: Docente[],
  asignaciones: AsignacionHoraria[],
  todosLosDocentesTerritorio: Docente[] = [],
  todosLosEstablecimientos: Establecimiento[] = []
): DotacionContextoCompleto {
  const cursosColegio = cursos.filter(c => c.rbd === establecimiento.rbd && (c.periodo === undefined || c.periodo === periodo));
  const docentesColegio = docentes.filter(d => d.rbd === establecimiento.rbd && (d.periodo === undefined || d.periodo === periodo));
  const asignacionesColegio = asignaciones.filter(a => a.rbd === establecimiento.rbd && (a.periodo === undefined || a.periodo === periodo));

  const diagnostico = calcularDiagnosticoColegio(
    establecimiento,
    salas,
    cursosColegio,
    docentesColegio,
    asignacionesColegio
  );

  // Análisis de docentes multi-escuela en el territorio
  const docentesPorRun = new Map<string, { doc: Docente; estNombre?: string }[]>();
  for (const d of todosLosDocentesTerritorio.filter(doc => (doc.periodo === undefined || doc.periodo === periodo))) {
    const runLimpio = normalizarRut(d.run);
    if (!docentesPorRun.has(runLimpio)) {
      docentesPorRun.set(runLimpio, []);
    }
    const est = todosLosEstablecimientos.find(e => e.rbd === d.rbd);
    docentesPorRun.get(runLimpio)!.push({ doc: d, estNombre: est?.nombre });
  }

  const docentesMultiEscuela: DotacionContextoCompleto['docentesMultiEscuela'] = [];
  for (const [run, list] of docentesPorRun.entries()) {
    if (list.length > 1) {
      const estaEnEsteColegio = list.some(item => item.doc.rbd === establecimiento.rbd);
      if (estaEnEsteColegio) {
        const horasTotales = list.reduce((sum, item) => sum + item.doc.horasContrato, 0);
        docentesMultiEscuela.push({
          run: formatearRut(run),
          nombre: `${list[0].doc.nombres} ${list[0].doc.apellidos}`,
          horasTotales,
          escuelas: list.map(item => ({
            rbd: item.doc.rbd,
            nombre: item.estNombre || `RBD ${item.doc.rbd}`,
            horas: item.doc.horasContrato
          })),
          esInfractor44h: horasTotales > 44
        });
      }
    }
  }

  // Identificar Director(a) del establecimiento desde la ficha o catálogo maestro
  const catSchool = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === establecimiento.rbd);
  const directorOficial = establecimiento.director || catSchool?.director || 'No especificado en ficha';
  const directorNorm = directorOficial.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

  // Generar resumen en texto estructurado optimizado para prompts LLM
  const b = diagnostico.balanzaGeneral;
  const asignaturasDeficit = diagnostico.diagnosticoPorEspecialidad.filter(esp => esp.balance < 0);
  const asignaturasSuperavit = diagnostico.diagnosticoPorEspecialidad.filter(esp => esp.balance > 0);

  let resumen = `=== INFORMACIÓN GENERAL DEL ESTABLECIMIENTO ===\n`;
  resumen += `• Nombre: ${establecimiento.nombre} (RBD: ${establecimiento.rbd})\n`;
  resumen += `• Comuna: ${establecimiento.comuna} | Período: ${periodo}\n`;
  resumen += `• Director(a) Titular / Encargado(a): ${directorOficial}\n`;
  resumen += `• Régimen: ${establecimiento.regimen} | % Alumnos Prioritarios: ${establecimiento.porcentajePrioritarios}% (Régimen Docente: ${establecimiento.porcentajePrioritarios >= 80 ? '60/40' : '65/35'})\n`;
  resumen += `• Matrícula Total Proyectada: ${b.totalMatriculaProyectada} alumnos en ${b.totalCursos} cursos | Cupos SAE: ${b.totalCuposSae}\n\n`;

  resumen += `=== BALANZA DE HORAS Y DIAGNÓSTICO DOCENTE ===\n`;
  resumen += `• Horas de Aula Demandadas por Planes de Estudio: ${b.horasAulaDemandadasCurriculo} HA\n`;
  resumen += `• Horas Lectivas Máximas Disponibles en Planta: ${b.horasLectivasDisponibles} HA\n`;
  resumen += `• Horas Lectivas Efectivamente Asignadas: ${b.horasLectivasAsignadas} HA\n`;
  resumen += `• Balance Neto de Dotación: ${b.superavitDeficitLectivo >= 0 ? '+' : ''}${b.superavitDeficitLectivo} HA (${b.superavitDeficitLectivo >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'})\n`;
  resumen += `• Total Horas de Contrato Contratadas: ${b.horasContratadasTotales} hrs\n`;
  resumen += `  - Horas Directivas (Dirección/Subdirección): ${b.horasDirectivasTotales}h\n`;
  resumen += `  - Inspectoría General: ${b.horasInspectorGeneralTotales}h\n`;
  resumen += `  - Jefe/Apoyo Técnico Pedagógico (UTP): ${b.horasTecnicoPedagogicasTotales}h\n`;
  resumen += `  - Coordinaciones y Apoyos: ${b.horasCoordinacionTotales}h\n`;
  resumen += `• Demanda PIE (Decreto 170): ${b.horasPieDemandadas} hrs cronológicas | Colaborativas: ${b.horasColaborativasDemandadas} hrs\n\n`;

  if (asignaturasDeficit.length > 0) {
    resumen += `=== ASIGNATURAS CON DÉFICIT DE HORAS ===\n`;
    for (const esp of asignaturasDeficit) {
      resumen += `• ${esp.asignatura}: Demandadas ${esp.horasDemandadas} HA, Asignadas ${esp.horasAsignadas} HA (Faltan ${Math.abs(esp.balance)} HA). Docentes: ${esp.docentesAsignados.join(', ') || 'Ninguno'}\n`;
    }
    resumen += `\n`;
  }

  if (asignaturasSuperavit.length > 0) {
    resumen += `=== ASIGNATURAS CON SUPERÁVIT DE HORAS ===\n`;
    for (const esp of asignaturasSuperavit) {
      resumen += `• ${esp.asignatura}: Demandadas ${esp.horasDemandadas} HA, Asignadas ${esp.horasAsignadas} HA (Exceso de +${esp.balance} HA)\n`;
    }
    resumen += `\n`;
  }

  resumen += `=== PLANTA DOCENTE Y EQUIPO DIRECTIVO (${docentesColegio.length} FUNCIONARIOS) ===\n`;
  for (const ed of diagnostico.estadoDocentes) {
    const d = ed.docente;
    const subGral = (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0);
    const sep = (d.horasSepTitular || 0) + (d.horasSepContrata || 0);
    const pie = (d.horasPieTitular || 0) + (d.horasPieContrata || 0);

    const docNombreCompleto = `${d.nombres} ${d.apellidos}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const docApellidosNombres = `${d.apellidos} ${d.nombres}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
    const isDirector = Boolean(
      (directorNorm !== 'no especificado en ficha' && directorNorm !== '' && (docNombreCompleto.includes(directorNorm) || directorNorm.includes(docNombreCompleto) || docApellidosNombres.includes(directorNorm))) ||
      /director|directora|rector/i.test(d.cargoInstitucional || '') ||
      /director|directora/i.test(d.funcionPrincipal || '')
    );

    const cargoEfectivo = isDirector
      ? 'DIRECTOR(A)'
      : (d.cargoInstitucional || (d.estamento === 'DIRECTIVO' ? 'CARGO DIRECTIVO' : (d.estamento === 'TECNICO_PEDAGOGICO' ? 'TÉCNICO PEDAGÓGICO / UTP' : (d.estamento === 'DOCENTE_DIFERENCIAL' ? 'DOCENTE DIFERENCIAL (PIE)' : 'DOCENTE DE AULA'))));

    const hDir = d.horasDirectivas || (isDirector ? d.horasContrato : 0);
    const hInsp = d.horasInspectorGeneral || 0;
    const hTec = d.horasTecnicoPedagogicas || 0;
    const hCoord = d.horasCoordinacion || 0;

    const desgloseNoAula = [];
    if (hDir > 0) desgloseNoAula.push(`Directivas ${hDir}h`);
    if (hInsp > 0) desgloseNoAula.push(`Inspectoría ${hInsp}h`);
    if (hTec > 0) desgloseNoAula.push(`UTP ${hTec}h`);
    if (hCoord > 0) desgloseNoAula.push(`Coord ${hCoord}h`);
    const desgloseStr = desgloseNoAula.length > 0 ? ` [Funciones Fuera de Aula: ${desgloseNoAula.join(', ')}]` : '';

    const estadoAlerta = ed.estaSobreasignado ? ` [🚨 SOBREASIGNADO +${ed.excesoHoras} HA]` : ` [✓ Correcto]`;
    const art69 = d.aplicaArticulo69 ? ` [Art. 69 Activo]` : '';
    const directivoTag = isDirector
      ? ` [⭐ DIRECTORA/DIRECTOR - Exento/a de docencia de aula por Estatuto Docente DFL 1 / Ley 20.903]`
      : (d.estamento === 'DIRECTIVO' || hDir > 0 ? ` [⭐ DIRECTIVO]` : '');

    const sinAsignarDetalle = [];
    if (!isDirector && ed.horasAulaRegular === 0 && d.horasContrato > 0 && hDir === 0 && hInsp === 0 && hTec === 0) {
      if ((ed.horasSepSinAsignar || 0) > 0) sinAsignarDetalle.push(`SEP sin asignar: ${ed.horasSepSinAsignar}h`);
      if ((ed.horasPieSinAsignar || 0) > 0) sinAsignarDetalle.push(`PIE sin asignar: ${ed.horasPieSinAsignar}h`);
      if ((ed.horasSubvGeneralSinAsignar || 0) > 0) sinAsignarDetalle.push(`Subv sin asignar: ${ed.horasSubvGeneralSinAsignar}h`);
    }
    const sinAsignarStr = sinAsignarDetalle.length > 0 ? ` [⚠️ ${sinAsignarDetalle.join(', ')}]` : '';

    resumen += `• ${d.nombres} ${d.apellidos} (${d.run}) [Cargo: ${cargoEfectivo}] - ${d.calidadJuridica} (${d.horasContrato}h: Subv ${subGral}h, SEP ${sep}h, PIE ${pie}h). Horas Aula Asignadas: ${ed.horasAulaRegular || 0} HA / Máx ${ed.horasLectivasMaximas} HA.${desgloseStr}${directivoTag}${estadoAlerta}${art69}${sinAsignarStr}\n`;
  }
  resumen += `\n`;

  const docentesConSinAsignar = diagnostico.estadoDocentes.filter(ed => ((ed.horasSepSinAsignar || 0) > 0 || (ed.horasPieSinAsignar || 0) > 0 || (ed.horasSubvGeneralSinAsignar || 0) > 0));
  if (docentesConSinAsignar.length > 0) {
    resumen += `=== HORAS CONTRATADAS SIN ASIGNAR (DISPONIBLES) ===\n`;
    for (const ed of docentesConSinAsignar) {
      const items = [
        (ed.horasSepSinAsignar || 0) > 0 ? `${ed.horasSepSinAsignar}h SEP` : null,
        (ed.horasPieSinAsignar || 0) > 0 ? `${ed.horasPieSinAsignar}h PIE` : null,
        (ed.horasSubvGeneralSinAsignar || 0) > 0 ? `${ed.horasSubvGeneralSinAsignar}h Subv. Gral` : null
      ].filter(Boolean).join(', ');
      resumen += `• ${ed.docente.nombres} ${ed.docente.apellidos} (${ed.docente.run}): ${items} disponibles sin función asignada.\n`;
    }
    resumen += `\n`;
  }

  if (docentesMultiEscuela.length > 0) {
    resumen += `=== DOCENTES COMPARTIDOS EN MÚLTIPLES ESTABLECIMIENTOS ===\n`;
    for (const d of docentesMultiEscuela) {
      const detalleEscuelas = d.escuelas.map(e => `${e.nombre} (${e.horas}h)`).join(' + ');
      const alerta44 = d.esInfractor44h ? ` 🚨 SUPERA LÍMITE LEGAL DE 44H (+${d.horasTotales - 44}h)` : ` ✓ Cumple tope`;
      resumen += `• ${d.nombre} (${d.run}): Total ${d.horasTotales} hrs [${detalleEscuelas}].${alerta44}\n`;
    }
    resumen += `\n`;
  }

  if (b.sobreasignacionesAlertas && b.sobreasignacionesAlertas.length > 0) {
    resumen += `=== ALERTAS NORMATIVAS Y FINANCIERAS ACTIVAS ===\n`;
    for (const al of b.sobreasignacionesAlertas) {
      resumen += `• ${al}\n`;
    }
    resumen += `\n`;
  }

  if (b.alertasInfraestructura && b.alertasInfraestructura.length > 0) {
    resumen += `=== ALERTAS DE INFRAESTRUCTURA Y SALAS ===\n`;
    for (const al of b.alertasInfraestructura) {
      resumen += `• ${al}\n`;
    }
    resumen += `\n`;
  }

  return {
    establecimiento,
    periodo,
    cursos: cursosColegio,
    docentes: docentesColegio,
    asignaciones: asignacionesColegio,
    diagnostico,
    todosLosDocentesTerritorio,
    docentesMultiEscuela,
    resumenTexto: resumen
  };
}

/**
 * Motor local determinista de intenciones (offline, 0ms latencia, sin API Key).
 */
export function responderConsultaLocalmente(
  pregunta: string,
  contexto: DotacionContextoCompleto
): string {
  const q = pregunta.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const b = contexto.diagnostico.balanzaGeneral;
  const est = contexto.establecimiento;

  // 1. Preguntas sobre Directores, Equipo Directivo y Horas Directivas
  if (q.includes('director') || q.includes('directora') || q.includes('directiv') || q.includes('quien dirige') || q.includes('liderazgo') || q.includes('inspector') || q.includes('utp') || q.includes('jefe utp')) {
    const catSchool = SLEP_VALLE_DIGUILLIN_SCHOOLS.find(s => s.rbd === est.rbd);
    const dirNombre = est.director || catSchool?.director || 'Director/a Titular del Establecimiento';
    const dirNorm = dirNombre.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

    const directivos = contexto.diagnostico.estadoDocentes.filter(ed => {
      const d = ed.docente;
      const nomCompleto = `${d.nombres} ${d.apellidos}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const apNomCompleto = `${d.apellidos} ${d.nombres}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
      const isDir = Boolean(dirNorm && (nomCompleto.includes(dirNorm) || dirNorm.includes(nomCompleto) || apNomCompleto.includes(dirNorm)));
      const isCargoDir = Boolean(d.cargoInstitucional && /director|directora|rector|inspector|utp/i.test(d.cargoInstitucional));
      const hasHorasDir = (d.horasDirectivas || 0) > 0 || (d.horasInspectorGeneral || 0) > 0 || (d.horasTecnicoPedagogicas || 0) > 0;
      return isDir || isCargoDir || hasHorasDir || d.estamento === 'DIRECTIVO' || d.estamento === 'TECNICO_PEDAGOGICO';
    });

    let detalleDirectivos = '';
    if (directivos.length > 0) {
      detalleDirectivos = directivos.map(ed => {
        const d = ed.docente;
        const nomCompleto = `${d.nombres} ${d.apellidos}`.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const isDir = Boolean(dirNorm && nomCompleto.includes(dirNorm)) || /director|directora|rector/i.test(d.cargoInstitucional || '');
        const cargo = isDir ? 'DIRECTORA / DIRECTOR' : (d.cargoInstitucional || (d.estamento === 'DIRECTIVO' ? 'EQUIPO DIRECTIVO' : 'TÉCNICO PEDAGÓGICO / UTP'));
        const hDir = d.horasDirectivas || (isDir ? d.horasContrato : 0);
        const hInsp = d.horasInspectorGeneral || 0;
        const hUtp = d.horasTecnicoPedagogicas || 0;
        return `• **${d.nombres} ${d.apellidos}** (${d.run}):\n` +
          `  - **Cargo:** ${cargo}\n` +
          `  - **Jornada Contractual:** ${d.horasContrato} hrs cronológicas (${d.calidadJuridica})\n` +
          `  - **Distribución de Horas:** Directivas: ${hDir}h | Inspectoría: ${hInsp}h | UTP: ${hUtp}h | Aula: ${ed.horasAulaRegular} HA\n` +
          `  - **Estado Normativo:** ✅ Conforme a Estatuto Docente DFL 1 (Función de Liderazgo y Gestión Institucional).`;
      }).join('\n\n');
    } else {
      detalleDirectivos = `• **Director(a) Designado(a):** **${dirNombre}**\n  - El establecimiento cuenta con ${b.horasDirectivasTotales} hrs directivas registradas en la balanza general.`;
    }

    return `### Equipo Directivo y Gestión Institucional — ${est.nombre} (${contexto.periodo})\n\n` +
      `Bajo la normativa del **Estatuto Docente (DFL 1/1996)** y la **Ley N° 20.903**, la función directiva superior lidera la conducción pedagógica e institucional del establecimiento educacional:\n\n` +
      `* **Director(a) Titular / Encargado(a):** **${dirNombre}**\n` +
      `* **Total Horas Directivas Institucionales:** **${b.horasDirectivasTotales} hrs** (Dirección y Subdirección)\n` +
      `* **Total Horas Inspectoría General:** **${b.horasInspectorGeneralTotales} hrs**\n` +
      `* **Total Horas Técnico-Pedagógicas (UTP):** **${b.horasTecnicoPedagogicasTotales} hrs**\n\n` +
      `**Nómina de Funcionarios Directivos y Técnicos:**\n\n` +
      detalleDirectivos + `\n\n` +
      `> ℹ️ *Resguardo Legal (DFL 1 / Ley 20.903):* Los cargos de Dirección y Subdirección con jornada exclusiva de gestión institucional (0 Horas Aula) están exceptuados de las proporciones lectivas de aula 65/35 o 60/40, estando su contrato 100% resguardado para liderazgo escolar.`;
  }

  // 2. Preguntas de Balance General / Déficit / Superávit
  if (q.includes('balance') || q.includes('balanza') || q.includes('deficit') || q.includes('superavit') || q.includes('horas faltan') || q.includes('horas sobran') || q.includes('resumen general')) {
    const estado = b.superavitDeficitLectivo > 0 
      ? `🟢 **Superávit de +${b.superavitDeficitLectivo} Horas Aula (HA)**`
      : b.superavitDeficitLectivo < 0
        ? `🔴 **Déficit de ${Math.abs(b.superavitDeficitLectivo)} Horas Aula (HA)**`
        : `🟢 **Dotación Perfectamente Equilibrada (0 HA de diferencia)**`;

    const asignaturasDef = contexto.diagnostico.diagnosticoPorEspecialidad.filter(e => e.balance < 0);
    let defTxt = '';
    if (asignaturasDef.length > 0) {
      defTxt = `\n\n**Asignaturas con déficit de cobertura:**\n` + 
        asignaturasDef.map(e => `• **${e.asignatura}:** Faltan **${Math.abs(e.balance)} HA** (Demandadas: ${e.horasDemandadas} HA, Asignadas: ${e.horasAsignadas} HA)`).join('\n');
    }

    return `### Diagnóstico de Balanza — ${est.nombre} (${contexto.periodo})\n\n` +
      `* **Estado de la Balanza:** ${estado}\n` +
      `* **Demanda Curricular Total:** ${b.horasAulaDemandadasCurriculo} Horas Aula\n` +
      `* **Capacidad Lectiva de Planta:** ${b.horasLectivasDisponibles} Horas Aula\n` +
      `* **Horas Lectivas Asignadas:** ${b.horasLectivasAsignadas} Horas Aula\n` +
      `* **Total Horas Contrato:** ${b.horasContratadasTotales} hrs cronológicas en ${contexto.docentes.length} docentes\n` +
      `* **Régimen de Proporción:** ${est.porcentajePrioritarios >= 80 ? '60/40 (Vulnerable ≥ 80%)' : '65/35 (Regular)'}` +
      defTxt;
  }

  // 3. Preguntas sobre Sobreasignación / Exceso de horas aula
  if (q.includes('sobreasigna') || q.includes('exceso') || q.includes('limite') || q.includes('infractor') || q.includes('tope aula')) {
    const sobreasignados = contexto.diagnostico.estadoDocentes.filter(e => e.estaSobreasignado);
    if (sobreasignados.length === 0) {
      return `### Auditoría de Sobreasignación — ${est.nombre}\n\n` +
        `✅ **No hay docentes sobreasignados en este establecimiento.**\n` +
        `Todos los ${contexto.docentes.length} docentes cumplen con los límites de docencia de aula de la Ley 20.903.`;
    }

    const items = sobreasignados.map(e => {
      const d = e.docente;
      return `• 🚨 **${d.nombres} ${d.apellidos}** (${d.run}): Asignadas **${e.horasAulaRegular} HA** de un máximo permitido de **${e.horasLectivasMaximas} HA** (+${e.excesoHoras} HA en exceso). Contrato: ${d.horasContrato}h.`;
    }).join('\n');

    return `### 🚨 Alerta de Sobreasignación Docente — ${est.nombre}\n\n` +
      `Se han detectado **${sobreasignados.length} docentes** con exceso de horas lectivas de aula:\n\n${items}\n\n` +
      `> **Recomendación UATP:** Reasignar las horas excedentes a docentes con horas vacantes o ajustar las funciones no lectivas según la Ley 20.903.`;
  }

  // 4. Preguntas sobre Docentes Compartidos / Multi-Escuela / 44 Horas
  if (q.includes('compartido') || q.includes('multi') || q.includes('44') || q.includes('otro colegio') || q.includes('otra escuela') || q.includes('territorio')) {
    if (contexto.docentesMultiEscuela.length === 0) {
      return `### Docentes Multi-Establecimiento — ${est.nombre}\n\n` +
        `✅ **Ningún docente de este establecimiento registra contratos paralelos en otras escuelas del SLEP en el período ${contexto.periodo}.**`;
    }

    const items = contexto.docentesMultiEscuela.map(d => {
      const detalle = d.escuelas.map(e => `_${e.nombre}_ (${e.horas}h)`).join(' + ');
      const alerta = d.esInfractor44h 
        ? `\n  - 🚨 **Infracción Legal:** Suma **${d.horasTotales} hrs**, excediendo el tope legal de 44 hrs (+${d.horasTotales - 44}h).`
        : `\n  - ✓ Total acumulado: **${d.horasTotales} hrs** (dentro del límite legal).`;
      return `• **${d.nombre}** (${d.run}):\n  - Distribución: ${detalle}${alerta}`;
    }).join('\n\n');

    return `### Docentes con Asignación en Múltiples Establecimientos SLEP\n\n` +
      `Se detectaron **${contexto.docentesMultiEscuela.length} docentes** de ${est.nombre} que también prestan servicios en otras dependencias del territorio:\n\n${items}`;
  }

  // 5. Preguntas sobre Artículo 69 (Reducción horaria)
  if (q.includes('articulo 69') || q.includes('art 69') || q.includes('artículo 69') || q.includes('reduccion') || q.includes('beneficio edad')) {
    const art69Docentes = contexto.docentes.filter(d => d.aplicaArticulo69);
    if (art69Docentes.length === 0) {
      return `### Beneficio Artículo 69 del Estatuto Docente — ${est.nombre}\n\n` +
        `ℹ️ Actualmente **no hay docentes con el Artículo 69 activo** en este establecimiento.\n\n` +
        `*El Artículo 69 permite a docentes con al menos 30 años de servicio o edad legal de jubilación limitar su tiempo de aula a un máximo de 24 horas cronológicas semanales (32 HA).*`;
    }

    const items = art69Docentes.map(d => {
      const estado = contexto.diagnostico.estadoDocentes.find(ed => ed.docente.id === d.id);
      const ha = estado?.horasAulaRegular || 0;
      const cumpleTope = ha <= 32;
      return `• **${d.nombres} ${d.apellidos}** (${d.run}): ${d.horasContrato}h contrato. Horas aula asignadas: **${ha} HA / máx 32 HA**. ${cumpleTope ? '✅ Cumple tope Art. 69' : '🚨 Supera tope de 32 HA'}`;
    }).join('\n');

    return `### Docentes Acogidos al Artículo 69 — ${est.nombre}\n\n` +
      `Hay **${art69Docentes.length} docentes** con el beneficio registrado:\n\n${items}`;
  }

  // 6. Preguntas sobre Financiamiento (Subvención General, SEP, PIE)
  if (q.includes('sep') || q.includes('pie') || q.includes('financiamiento') || q.includes('fondos') || q.includes('titular') || q.includes('contrata')) {
    let totSubvTit = 0, totSubvCtta = 0, totSepTit = 0, totSepCtta = 0, totPieTit = 0, totPieCtta = 0;
    for (const d of contexto.docentes) {
      totSubvTit += Number(d.horasSubvencionGeneralTitular || 0);
      totSubvCtta += Number(d.horasSubvencionGeneralContrata || 0);
      totSepTit += Number(d.horasSepTitular || 0);
      totSepCtta += Number(d.horasSepContrata || 0);
      totPieTit += Number(d.horasPieTitular || 0);
      totPieCtta += Number(d.horasPieContrata || 0);
    }
    const totSubv = totSubvTit + totSubvCtta;
    const totSep = totSepTit + totSepCtta;
    const totPie = totPieTit + totPieCtta;
    const granTotal = totSubv + totSep + totPie;

    return `### Desglose Financiero de la Dotación — ${est.nombre} (${contexto.periodo})\n\n` +
      `| Fuente de Financiamiento | Titulares | Contrata | Total Horas | % del Total |\n` +
      `| :--- | :---: | :---: | :---: | :---: |\n` +
      `| **Subvención General** | ${totSubvTit}h | ${totSubvCtta}h | **${totSubv}h** | ${granTotal > 0 ? ((totSubv / granTotal) * 100).toFixed(1) : 0}% |\n` +
      `| **Ley SEP** | ${totSepTit}h | ${totSepCtta}h | **${totSep}h** | ${granTotal > 0 ? ((totSep / granTotal) * 100).toFixed(1) : 0}% |\n` +
      `| **Programa PIE** | ${totPieTit}h | ${totPieCtta}h | **${totPie}h** | ${granTotal > 0 ? ((totPie / granTotal) * 100).toFixed(1) : 0}% |\n` +
      `| **TOTAL PLANTA** | **${totSubvTit + totSepTit + totPieTit}h** | **${totSubvCtta + totSepCtta + totPieCtta}h** | **${granTotal}h** | **100%** |\n\n` +
      `> ℹ️ *Normativa MINEDUC:* Las horas del Plan de Estudio regular deben cubrirse exclusivamente con Subvención General. Los fondos SEP y PIE deben destinarse a reforzamiento, co-docencia y apoyos especializados.`;
  }

  // 7. Preguntas sobre Matrícula y Cursos
  if (q.includes('matricula') || q.includes('cupo') || q.includes('cursos') || q.includes('alumnos') || q.includes('sae')) {
    return `### Matrícula y Oferta Educativa — ${est.nombre} (${contexto.periodo})\n\n` +
      `* **Matrícula Proyectada Total:** **${b.totalMatriculaProyectada} alumnos**\n` +
      `* **Cupos Totales SAE:** **${b.totalCuposSae} cupos**\n` +
      `* **Cantidad de Cursos:** **${contexto.cursos.length} cursos**\n` +
      `* **Demanda PIE:** ${b.horasPieDemandadas} horas cronológicas de apoyo según Decreto 170.\n\n` +
      `**Cursos Registrados:**\n` +
      contexto.cursos.map(c => `• ${c.nivel} ${c.letra}: ${c.matriculaProyectada} alumnos (Cupo SAE: ${c.cupoSae}) - ${c.regimen}`).join('\n');
  }

  // Respuesta por defecto con resumen ejecutivo y sugerencias
  return `### Resumen Ejecutivo de Dotación — ${est.nombre} (${contexto.periodo})\n\n` +
    `Hola. Estoy analizando en tiempo real la dotación de **${est.nombre}** para el período **${contexto.periodo}**.\n\n` +
    `* **Balanza Horaria:** ${b.superavitDeficitLectivo >= 0 ? `Superávit de +${b.superavitDeficitLectivo} HA` : `Déficit de ${Math.abs(b.superavitDeficitLectivo)} HA`}\n` +
    `* **Planta Docente y Directivos:** ${contexto.docentes.length} funcionarios (${b.horasContratadasTotales} horas de contrato totales, ${b.horasDirectivasTotales}h directivas)\n` +
    `* **Matrícula:** ${b.totalMatriculaProyectada} alumnos en ${contexto.cursos.length} cursos\n\n` +
    `**Preguntas rápidas que puedes hacerme:**\n` +
    `• *"¿Quién es el director/a y cómo está distribuida su jornada?"*\n` +
    `• *"¿Cuáles son las horas directivas y técnicas del establecimiento?"*\n` +
    `• *"¿Qué asignaturas tienen déficit de horas?"*\n` +
    `• *"¿Hay docentes sobreasignados según la Ley 20.903?"*\n` +
    `• *"¿Qué profesores tienen contrato en otros colegios del SLEP?"*\n` +
    `• *(Con Gemini AI activado)* *"Redacta un informe de balance de dotación para el Director Ejecutivo"*`;
}

/**
 * Consulta a la API de Google Gemini enviando el contexto completo y el historial de la conversación.
 */
export async function consultarCopilotGemini(
  pregunta: string,
  contexto: DotacionContextoCompleto,
  historial: { role: 'user' | 'model'; text: string }[] = [],
  apiKey?: string,
  modelName: string = 'gemini-2.5-flash-lite'
): Promise<string> {
  const effectiveApiKey = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : '') || '';
  if (!effectiveApiKey) {
    // Si no hay API key configurada, responder con el motor local
    return responderConsultaLocalmente(pregunta, contexto);
  }

  const systemInstruction = `Eres "¡Qué no va a saber! IA", el asistente inteligente oficial de dotación docente, legislación educacional chilena y planificación escolar del Servicio Local de Educación Pública (SLEP) Valle Diguillín.

Tus conocimientos clave son:
1. Estatuto Docente DFL 1/1996 y Ley 20.903:
   - Los cargos de Director(a), Subdirector(a) e Inspector(a) General constituyen la FUNCIÓN DIRECTIVA SUPERIOR del establecimiento.
   - Los directores y directivos con dedicación institucional (ej. 44 horas cronológicas y 0 Horas Aula de docencia) están 100% apegados a la ley para funciones de liderazgo y gestión escolar, y están EXCEPTUADOS de impartir horas lectivas frente a alumnos. No representan "horas de aula vacantes ni desocupadas".
   - Proporción 65/35 (general) y 60/40 (en establecimientos con 80% o más de alumnos prioritarios) aplicable a docentes de aula.
2. DFL 1 Estatuto Docente (Límite legal territorial de 44 horas semanales, horas no lectivas, Artículo 69 para docentes mayores con 30 años de servicio).
3. Decreto 548 (Aforos físicos de salas: 1.11 m²/alumno en aula regular, 1.50 m² en párvulos, 1.80 m² en talleres).
4. Decreto 170 (Programa de Integración Escolar PIE: apoyos y horas de trabajo colaborativo).
5. Ley 20.248 (Subvención Escolar Preferencial SEP: pertinencia del gasto y horas no aula).
6. Planes de Estudio MINEDUC y distribución curricular.

ESTADO ACTUAL DE LA DOTACIÓN QUE ESTÁS ANALIZANDO:
${contexto.resumenTexto}

INSTRUCCIONES DE RESPUESTA:
- Cuando te pregunten por el Director(a) o Equipo Directivo, identifica con precisión su nombre, cargo, horas de contrato y su fundamento legal bajo el DFL 1 (gestión y liderazgo directivo).
- Responde siempre de forma precisa, ejecutiva, fundamentada en los datos reales suministrados arriba y citando la normativa aplicable cuando sea pertinente.
- Utiliza formato Markdown con títulos, listas con viñetas, negritas y tablas cuando ayude a la claridad.
- Si te piden redactar una propuesta o informe, proporciona un texto profesional listo para ser presentado a directores de establecimientos o al Director Ejecutivo del SLEP.
- Sé conciso y directo, evitando rodeos innecesarios.`;

  const contents = [
    ...historial.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    })),
    {
      role: 'user',
      parts: [{ text: pregunta }]
    }
  ];

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${effectiveApiKey}`;

  const response = await geminiFetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: {
        parts: [{ text: systemInstruction }]
      },
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048
      }
    })
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMsg = errorData?.error?.message || `Error HTTP ${response.status}`;
    console.warn('Fallo llamada Gemini Copilot, usando motor local:', errorMsg);
    
    let explicacionError = `No se pudo conectar con Gemini AI (${errorMsg}).`;
    if (errorMsg.includes('ERR_NAME_NOT_RESOLVED') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
      explicacionError = 'Sin conexión a internet o el dominio de Google AI no pudo resolverse en la red (ERR_NAME_NOT_RESOLVED).';
    }
    
    // Fallback al motor determinista local
    return responderConsultaLocalmente(pregunta, contexto) + `\n\n> ℹ️ *Modo Local Activo: ${explicacionError} Se generó respuesta 100% determinista con el motor normativo de dotación SLEP.*`;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return responderConsultaLocalmente(pregunta, contexto);
  }

  return text;
}
