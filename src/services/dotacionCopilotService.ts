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

  // Generar resumen en texto estructurado optimizado para prompts LLM
  const b = diagnostico.balanzaGeneral;
  const asignaturasDeficit = diagnostico.diagnosticoPorEspecialidad.filter(esp => esp.balance < 0);
  const asignaturasSuperavit = diagnostico.diagnosticoPorEspecialidad.filter(esp => esp.balance > 0);
  const docentesConSobreasignacion = diagnostico.estadoDocentes.filter(ed => ed.estaSobreasignado);
  const docentesConArt69 = docentesColegio.filter(d => d.aplicaArticulo69);

  let resumen = `=== INFORMACIÓN GENERAL DEL ESTABLECIMIENTO ===\n`;
  resumen += `• Nombre: ${establecimiento.nombre} (RBD: ${establecimiento.rbd})\n`;
  resumen += `• Comuna: ${establecimiento.comuna} | Período: ${periodo}\n`;
  resumen += `• Régimen: ${establecimiento.regimen} | % Alumnos Prioritarios: ${establecimiento.porcentajePrioritarios}% (Régimen Docente: ${establecimiento.porcentajePrioritarios >= 80 ? '60/40' : '65/35'})\n`;
  resumen += `• Matrícula Total Proyectada: ${b.totalMatriculaProyectada} alumnos en ${b.totalCursos} cursos | Cupos SAE: ${b.totalCuposSae}\n\n`;

  resumen += `=== BALANZA DE HORAS Y DIAGNÓSTICO DOCENTE ===\n`;
  resumen += `• Horas de Aula Demandadas por Planes de Estudio: ${b.horasAulaDemandadasCurriculo} HA\n`;
  resumen += `• Horas Lectivas Máximas Disponibles en Planta: ${b.horasLectivasDisponibles} HA\n`;
  resumen += `• Horas Lectivas Efectivamente Asignadas: ${b.horasLectivasAsignadas} HA\n`;
  resumen += `• Balance Neto de Dotación: ${b.superavitDeficitLectivo >= 0 ? '+' : ''}${b.superavitDeficitLectivo} HA (${b.superavitDeficitLectivo >= 0 ? 'SUPERÁVIT' : 'DÉFICIT'})\n`;
  resumen += `• Total Horas de Contrato Contratadas: ${b.horasContratadasTotales} hrs\n`;
  resumen += `  - Directivas: ${b.horasDirectivasTotales}h | Inspectoría: ${b.horasInspectorGeneralTotales}h | UTP: ${b.horasTecnicoPedagogicasTotales}h | Coordinación: ${b.horasCoordinacionTotales}h\n`;
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

  resumen += `=== PLANTA DOCENTE (${docentesColegio.length} DOCENTES) ===\n`;
  for (const ed of diagnostico.estadoDocentes) {
    const d = ed.docente;
    const subGral = (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0);
    const sep = (d.horasSepTitular || 0) + (d.horasSepContrata || 0);
    const pie = (d.horasPieTitular || 0) + (d.horasPieContrata || 0);
    const estadoAlerta = ed.estaSobreasignado ? ` [🚨 SOBREASIGNADO +${ed.excesoHoras} HA]` : ` [✓ Correcto]`;
    const art69 = d.aplicaArticulo69 ? ` [Art. 69 Activo]` : '';
    resumen += `• ${d.nombres} ${d.apellidos} (${d.run}) - ${d.calidadJuridica} (${d.horasContrato}h: Subv ${subGral}h, SEP ${sep}h, PIE ${pie}h). Horas Aula Asignadas: ${ed.horasAulaRegular || 0} HA / Máx ${ed.horasLectivasMaximas} HA. Vacantes: ${ed.horasVacantes}h.${estadoAlerta}${art69}\n`;
  }
  resumen += `\n`;

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

  // 1. Preguntas de Balance General / Déficit / Superávit
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

  // 2. Preguntas sobre Sobreasignación / Exceso de horas aula
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

  // 3. Preguntas sobre Docentes Compartidos / Multi-Escuela / 44 Horas
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

  // 4. Preguntas sobre Artículo 69 (Reducción horaria)
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

  // 5. Preguntas sobre Financiamiento (Subvención General, SEP, PIE)
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

  // 6. Preguntas sobre Matrícula y Cursos
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
    `* **Planta Docente:** ${contexto.docentes.length} docentes (${b.horasContratadasTotales} horas de contrato totales)\n` +
    `* **Matrícula:** ${b.totalMatriculaProyectada} alumnos en ${contexto.cursos.length} cursos\n\n` +
    `**Preguntas rápidas que puedes hacerme:**\n` +
    `• *"¿Qué asignaturas tienen déficit de horas?"*\n` +
    `• *"¿Hay docentes sobreasignados según la Ley 20.903?"*\n` +
    `• *"¿Qué profesores tienen contrato en otros colegios del SLEP?"*\n` +
    `• *"Mostrar distribución de fondos Subvención General, SEP y PIE"*\n` +
    `• *(Con Gemini AI activado)* *"Redacta una propuesta de reasignación horaria"*`;
}

/**
 * Consulta a la API de Google Gemini enviando el contexto completo y el historial de la conversación.
 */
export async function consultarCopilotGemini(
  pregunta: string,
  contexto: DotacionContextoCompleto,
  historial: { role: 'user' | 'model'; text: string }[] = [],
  apiKey?: string,
  modelName: string = 'gemini-2.5-flash'
): Promise<string> {
  const effectiveApiKey = apiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') : '') || '';
  if (!effectiveApiKey) {
    // Si no hay API key configurada, responder con el motor local
    return responderConsultaLocalmente(pregunta, contexto);
  }

  const systemInstruction = `Eres "Copilot UATP", un asistente experto en gestión de dotación docente, legislación educacional chilena y planificación escolar del Servicio Local de Educación Pública (SLEP) Valle Diguillín.

Tus conocimientos clave son:
1. Ley 20.903 (Carrera Docente y Proporción 65/35 y 60/40 en establecimientos con 80% o más de alumnos prioritarios).
2. DFL 1 Estatuto Docente (Límite legal territorial de 44 horas semanales, horas no lectivas, Artículo 69 para docentes mayores con 30 años de servicio).
3. Decreto 548 (Aforos físicos de salas: 1.11 m²/alumno en aula regular, 1.50 m² en párvulos, 1.80 m² en talleres).
4. Decreto 170 (Programa de Integración Escolar PIE: apoyos y horas de trabajo colaborativo).
5. Ley 20.248 (Subvención Escolar Preferencial SEP: pertinencia del gasto y horas no aula).
6. Planes de Estudio MINEDUC y distribución curricular.

ESTADO ACTUAL DE LA DOTACIÓN QUE ESTÁS ANALIZANDO:
${contexto.resumenTexto}

INSTRUCCIONES DE RESPUESTA:
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
    // Fallback al motor local con aviso
    return responderConsultaLocalmente(pregunta, contexto) + `\n\n> ⚠️ *Nota: No se pudo conectar con Gemini AI (${errorMsg}). Se generó respuesta con el motor determinista local.*`;
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    return responderConsultaLocalmente(pregunta, contexto);
  }

  return text;
}
