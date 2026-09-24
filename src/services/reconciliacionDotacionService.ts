import { Establecimiento, CursoSae, Docente, AsignacionHoraria } from '../types';
import {
  obtenerPlanPorCurso,
  calcularJornadaDocente,
  esModalidadTp,
  esModalidadMultigradoOCombinado,
  esModalidadAdultos,
  esModalidadEspecial
} from '@slep/mineduc-engine';
import {
  reconciliarYLimpiarAsignacionesEnDb,
  limpiarAsignacionesDeColegio,
  guardarAsignacionesBatch
} from '../database/db';

export interface DiagnosticoSincronizacion {
  rbd: string;
  periodo: number;
  totalDocentes: number;
  totalCursos: number;
  totalAsignaciones: number;
  huerfanasCount: number;
  duplicadasCount: number;
  estaSincronizado: boolean;
  docentesConHorasDisponibles: {
    docente: Docente;
    horasContrato: number;
    horasLectivasMaximas: number;
    horasAsignadas: number;
    horasDisponibles: number;
  }[];
  cursosIncompletos: {
    curso: CursoSae;
    horasPlan: number;
    horasAsignadas: number;
    deficit: number;
  }[];
  resumenMensaje: string;
}

export interface ResultadoReconciliacion {
  huerfanasEliminadas: number;
  duplicadasEliminadas: number;
  autoAsignadasCreadas: number;
  mensaje: string;
}

/**
 * Analiza el estado de sincronización e integridad entre la Nómina de Docentes y la Malla de Asignaciones.
 */
export function analizarSincronizacionDotacion(
  colegio: Establecimiento,
  docentes: Docente[],
  cursos: CursoSae[],
  asignaciones: AsignacionHoraria[]
): DiagnosticoSincronizacion {
  const rbd = colegio.rbd;
  const periodo = docentes[0]?.periodo || cursos[0]?.periodo || 2026;
  const docMap = new Map(docentes.map(d => [d.id, d]));
  const cursoMap = new Map(cursos.map(c => [c.id, c]));

  // 1. Detectar asignaciones huérfanas
  let huerfanasCount = 0;
  for (const a of asignaciones) {
    const docExiste = a.docenteId === 'SIN_DOCENTE' || a.docenteId === '' || docMap.has(a.docenteId);
    const cursoExiste = a.cursoId === 'TRANSVERSAL' || a.cursoId === 'SIN_CURSO' || cursoMap.has(a.cursoId);
    if (!docExiste || !cursoExiste) {
      huerfanasCount++;
    }
  }

  // 2. Detectar asignaciones exactamente duplicadas
  const seenKeys = new Set<string>();
  let duplicadasCount = 0;
  for (const a of asignaciones) {
    const key = `${a.cursoId}_${a.docenteId}_${(a.asignatura || '').trim().toLowerCase()}_${a.tipoApoyo || ''}_${a.horasPedagogicasAula}`;
    if (seenKeys.has(key)) {
      duplicadasCount++;
    } else {
      seenKeys.add(key);
    }
  }

  // 3. Evaluar disponibilidad horaria de cada docente
  const proporcionColegio = colegio.porcentajePrioritarios >= 80 ? '60_40' : '65_35';
  const docentesConHorasDisponibles = docentes
    .filter(d => d.estamento === 'DOCENTE_AULA' || d.estamento === 'DOCENTE_DIFERENCIAL')
    .map(d => {
      const propDoc = d.aplicaArticulo69 ? '60/40' : (proporcionColegio === '60_40' ? '60/40' : '65/35');
      const contratoAula = (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0);
      const horasLectivas = calcularJornadaDocente(contratoAula || d.horasContrato, propDoc).horasLectivas;
      
      const asigsD = asignaciones.filter(a => a.docenteId === d.id);
      const horasAsignadas = asigsD.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
      const horasDisponibles = Math.max(0, Math.round(horasLectivas - horasAsignadas));

      return {
        docente: d,
        horasContrato: d.horasContrato,
        horasLectivasMaximas: Math.round(horasLectivas),
        horasAsignadas,
        horasDisponibles
      };
    })
    .filter(item => item.horasDisponibles > 0);

  // 4. Evaluar cursos con déficit de cobertura
  const cursosIncompletos = cursos.map(c => {
    const plan = obtenerPlanPorCurso(c.nivel, c.regimen, c.especialidadTp);
    const hrsPlan = plan ? plan.totalHorasPlan : (c.regimen === 'JEC' ? 38 : 30);
    const asigsC = asignaciones.filter(a => 
      a.cursoId === c.id && 
      !a.tipoApoyo?.toLowerCase().includes('pie') && 
      !a.esCoDocencia && 
      !a.esTallerSep
    );
    const horasAsignadas = asigsC.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);
    const deficit = Math.max(0, hrsPlan - horasAsignadas);

    return {
      curso: c,
      horasPlan: hrsPlan,
      horasAsignadas,
      deficit
    };
  }).filter(c => c.deficit > 0);

  const estaSincronizado = huerfanasCount === 0 && duplicadasCount === 0;

  let resumenMensaje = '🟢 Nómina y Malla Curricular 100% sincronizadas sin datos obsoletos.';
  if (huerfanasCount > 0 || duplicadasCount > 0) {
    const partes: string[] = [];
    if (huerfanasCount > 0) partes.push(`${huerfanasCount} asignación(es) precargadas u obsoletas`);
    if (duplicadasCount > 0) partes.push(`${duplicadasCount} asignación(es) duplicadas`);
    resumenMensaje = `⚠️ Se detectaron ${partes.join(' y ')} que distorsionan el total de horas.`;
  }

  return {
    rbd,
    periodo,
    totalDocentes: docentes.length,
    totalCursos: cursos.length,
    totalAsignaciones: asignaciones.length,
    huerfanasCount,
    duplicadasCount,
    estaSincronizado,
    docentesConHorasDisponibles,
    cursosIncompletos,
    resumenMensaje
  };
}

/**
 * Ejecuta la purga y reconciliación limpia en SQLite, eliminando registros precargados obsoletos o duplicados.
 */
export async function ejecutarReconciliacionLimpia(
  rbd: string,
  periodo: number = 2026
): Promise<ResultadoReconciliacion> {
  const { huerfanasEliminadas, duplicadasEliminadas } = await reconciliarYLimpiarAsignacionesEnDb(rbd, periodo);
  const total = huerfanasEliminadas + duplicadasEliminadas;
  const mensaje = total > 0
    ? `Reconciliación completada: se eliminaron ${huerfanasEliminadas} asignaciones obsoletas y ${duplicadasEliminadas} duplicadas.`
    : 'La malla ya se encontraba limpia y sincronizada con la nómina actual.';

  return {
    huerfanasEliminadas,
    duplicadasEliminadas,
    autoAsignadasCreadas: 0,
    mensaje
  };
}

/**
 * Normaliza nombres de asignaturas para comparación pedagógica
 */
function normalizarTexto(txt: string): string {
  return txt
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .trim();
}

/**
 * Evalúa compatibilidad entre una asignatura de la malla y un docente
 */
function calcularAfinidadDocenteAsignatura(docente: Docente, nombreAsignatura: string): number {
  const normAsig = normalizarTexto(nombreAsignatura);
  const normPrinc = normalizarTexto(docente.asignaturaPrincipal || '');
  const normTitulo = normalizarTexto(docente.titulo || '');

  // Coincidencia exacta o fuerte
  if (normPrinc && (normAsig.includes(normPrinc) || normPrinc.includes(normAsig))) return 100;
  if (normTitulo && (normAsig.includes(normTitulo) || normTitulo.includes(normAsig))) return 80;

  // Heurísticas pedagógicas por palabra clave
  if (/lengua|castellano|comunicacion|literatura/i.test(normAsig) && /lengua|castellano|comunicacion|basica/i.test(`${normPrinc} ${normTitulo}`)) return 70;
  if (/matematica|algebra|geometria|calculo/i.test(normAsig) && /matematica|fisica|basica/i.test(`${normPrinc} ${normTitulo}`)) return 70;
  if (/historia|geografia|sociales|ciudadana/i.test(normAsig) && /historia|sociales|filosofia|basica/i.test(`${normPrinc} ${normTitulo}`)) return 70;
  if (/ciencias|biologia|quimica|fisica|naturales/i.test(normAsig) && /ciencias|biologia|quimica|fisica|naturales|basica/i.test(`${normPrinc} ${normTitulo}`)) return 70;
  if (/ingles|idioma|extranjero/i.test(normAsig) && /ingles|traduccion|idioma/i.test(`${normPrinc} ${normTitulo}`)) return 70;
  if (/educacion fisica|salud|deporte/i.test(normAsig) && /fisica|deporte|salud|motricidad/i.test(`${normPrinc} ${normTitulo}`)) return 70;
  if (/artes|musica|plastica|visual/i.test(normAsig) && /arte|musica|plastica|visual/i.test(`${normPrinc} ${normTitulo}`)) return 70;
  if (/tecnologia|computacion|informatica|enlaces/i.test(normAsig) && /tecno|comput|infor|enlace/i.test(`${normPrinc} ${normTitulo}`)) return 70;

  // Docente de Educación Básica Generalista
  if (/general basica|profesor basica|educacion basica/i.test(`${normPrinc} ${normTitulo}`)) return 50;

  return 10;
}

/**
 * Auto-asigna inteligentemente las asignaturas de la malla MINEDUC a los cursos
 * basándose en las horas de contrato y especialidad de los docentes de la nómina.
 */
export async function ejecutarAutoAsignacionMallaDesdeNomina(
  rbd: string,
  periodo: number = 2026,
  colegio: Establecimiento,
  cursos: CursoSae[],
  docentes: Docente[]
): Promise<ResultadoReconciliacion> {
  // 1. Primero purgar datos obsoletos
  await reconciliarYLimpiarAsignacionesEnDb(rbd, periodo);

  // 2. Filtrar docentes de aula disponibles
  const proporcionColegio = colegio.porcentajePrioritarios >= 80 ? '60_40' : '65_35';
  
  // Mapa mutable de horas lectivas disponibles por docente
  const disponibilidad = new Map<string, number>();
  for (const d of docentes) {
    if (d.estamento === 'DOCENTE_AULA') {
      const propDoc = d.aplicaArticulo69 ? '60/40' : (proporcionColegio === '60_40' ? '60/40' : '65/35');
      const contratoAula = (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0);
      const horasLectivas = Math.round(calcularJornadaDocente(contratoAula || d.horasContrato, propDoc).horasLectivas);
      disponibilidad.set(d.id, horasLectivas);
    }
  }

  const nuevasAsignaciones: AsignacionHoraria[] = [];
  let autoCreadas = 0;

  // 3. Recorrer cada curso del establecimiento
  for (const curso of cursos) {
    const plan = obtenerPlanPorCurso(curso.nivel, curso.regimen, curso.especialidadTp);
    if (!plan || !plan.asignaturasBase || plan.asignaturasBase.length === 0) continue;

    for (const asigPlan of plan.asignaturasBase) {
      const horasRequeridas = asigPlan.horasSugeridas || 2;
      
      // Buscar al mejor docente disponible según afinidad
      let mejorDocente: Docente | null = null;
      let mejorAfinidad = -1;
      let mejorDisp = -1;

      for (const d of docentes) {
        if (d.estamento !== 'DOCENTE_AULA') continue;
        const disp = disponibilidad.get(d.id) || 0;
        if (disp <= 0) continue;

        const afinidad = calcularAfinidadDocenteAsignatura(d, asigPlan.nombre);
        if (afinidad > mejorAfinidad || (afinidad === mejorAfinidad && disp > mejorDisp)) {
          mejorAfinidad = afinidad;
          mejorDisp = disp;
          mejorDocente = d;
        }
      }

      if (mejorDocente && mejorDisp > 0) {
        const horasAAsignar = Math.min(horasRequeridas, mejorDisp);
        const asigId = `auto_asig_${rbd}_${periodo}_${curso.id}_${mejorDocente.id}_${Date.now()}_${autoCreadas}`;

        nuevasAsignaciones.push({
          id: asigId,
          rbd,
          periodo,
          cursoId: curso.id,
          docenteId: mejorDocente.id,
          asignatura: asigPlan.nombre,
          horasPedagogicasAula: horasAAsignar,
          esTallerJec: false,
          esTallerSep: false,
          esProporcionDocente: false,
          esCoDocencia: false,
          esAgrupacionFlexible: false,
          esTrabajoColaborativo: false
        });

        disponibilidad.set(mejorDocente.id, Math.max(0, mejorDisp - horasAAsignar));
        autoCreadas++;
      }
    }
  }

  if (nuevasAsignaciones.length > 0) {
    await guardarAsignacionesBatch(nuevasAsignaciones);
  }

  return {
    huerfanasEliminadas: 0,
    duplicadasEliminadas: 0,
    autoAsignadasCreadas: autoCreadas,
    mensaje: `Se auto-generaron y distribuyeron con éxito ${autoCreadas} asignaciones curriculares MINEDUC para ${cursos.length} cursos.`
  };
}

/**
 * Limpia todas las asignaciones horarias del colegio de forma segura.
 */
export async function ejecutarLimpiarTodasAsignaciones(
  rbd: string,
  periodo: number = 2026
): Promise<number> {
  return await limpiarAsignacionesDeColegio(rbd, periodo);
}
