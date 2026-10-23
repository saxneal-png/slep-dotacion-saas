// =============================================================================
// REGLA DE NEGOCIO: CAPACIDAD POR SALA, AFORO DECRETO 548 Y VALIDACIÓN SAE
// =============================================================================

import { esModalidadMultigradoOCombinado, esModalidadEspecial } from './modalidades';

export interface SalaInfraestructura {
  id: string;
  rbd: string;
  nombreSala: string;
  pabellon?: string;
  superficieM2: number;
  tipo?: 'REGULAR' | 'PARVULARIA' | 'TALLER' | 'MULTIGRADO' | 'ESPECIAL';
  esParvularia?: boolean;
  esTallerOTecnico?: boolean;
}

export interface EvaluacionCapacidadSaeCurso {
  cursoNombre: string;
  salaAsignada: string;
  superficieM2: number;
  factorM2PorAlumno: number;
  aforoMaximoFisico: number;
  cupoDeclaradoSae: number;
  matriculaProyectada: number;
  techoOperativoCurso: number;
  estadoAforo: 'OPTIMO' | 'ALERTA_SOBRECUPO_FISICO' | 'SUBUTILIZADO' | 'EXCEDE_SAE';
  requiereDesdoblamiento: boolean;
  observaciones: string[];
}

/**
 * Obtiene el aforo normativo máximo según la modalidad educativa:
 * - Educación Regular (Decreto 548): 45 alumnos máx.
 * - Educación Parvularia: 35 alumnos máx.
 * - Aulas Combinadas Multigrado: 15 alumnos (3+ cursos combinados o 1° a 6°) o 25 alumnos (2 cursos combinados).
 * - Educación Especial (Decreto 83 / Decreto 170 / Decretos 87, 89, 86, 815, 1300):
 *   - TEL o Discapacidad Intelectual (Dec. 87 / 1300): 15 alumnos máx.
 *   - Auditiva, Visual o Motora (Dec. 86 / 89 / 570): 8 alumnos máx.
 *   - Autismo, Graves Alteraciones o Retos Múltiples (Dec. 815): 6 alumnos máx.
 */
export function obtenerAforoMaximoNormativo(
  modalidadOCurso: string,
  cantidadCursosCombinados: number = 2
): number {
  const m = (modalidadOCurso || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (esModalidadEspecial(m) || m.includes('especial') || m.includes('decreto 83') || m.includes('decreto 87') || m.includes('discapacidad')) {
    if (m.includes('autismo') || m.includes('multiple') || m.includes('sordoceguera') || m.includes('grave')) {
      return 6;
    }
    if (m.includes('auditiv') || m.includes('visual') || m.includes('motor') || m.includes('sordo') || m.includes('ciego')) {
      return 8;
    }
    return 15;
  }

  if (esModalidadMultigradoOCombinado(m) || m.includes('multigrado') || m.includes('combinado')) {
    if (m.includes('1 a 6') || m.includes('1° a 6°') || m.includes('1-6') || cantidadCursosCombinados >= 3) {
      return 15;
    }
    return 25;
  }

  if (m.includes('parvularia') || m.includes('kinder') || m.includes('nt1') || m.includes('nt2')) {
    return 35;
  }

  return 45;
}

/**
 * Calcula el aforo máximo físico según Decreto 548 (Infraestructura Escolar MINEDUC):
 * - Educación Regular (Básica y Media): 1.1 m² por alumno
 * - Educación Parvularia: 1.5 m² por alumno
 * - Talleres / Laboratorios / Salas Especiales: 1.8 m² por alumno
 * - Educación Especial: 2.0 m² por alumno (espacio para movilidad y apoyos)
 * Además, respeta el tope normativo de la modalidad si se especifica.
 */
export function calcularAforoFisicoSala(
  superficieM2: number,
  tipo: 'REGULAR' | 'PARVULARIA' | 'TALLER' | 'MULTIGRADO' | 'ESPECIAL' = 'REGULAR',
  modalidadOCurso?: string
): { aforoMaximo: number; factorM2: number; topeNormativoModalidad?: number } {
  let factorM2 = 1.1;
  if (tipo === 'PARVULARIA') factorM2 = 1.5;
  if (tipo === 'TALLER') factorM2 = 1.8;
  if (tipo === 'ESPECIAL') factorM2 = 2.0;

  const aforoCalculadoSuperficie = Math.floor(Math.round((superficieM2 / factorM2) * 1000) / 1000);

  let topeNormativoModalidad: number | undefined;
  if (modalidadOCurso) {
    topeNormativoModalidad = obtenerAforoMaximoNormativo(modalidadOCurso);
  } else if (tipo === 'MULTIGRADO') {
    topeNormativoModalidad = 15;
  } else if (tipo === 'ESPECIAL') {
    topeNormativoModalidad = 15;
  }

  const aforoMaximo = topeNormativoModalidad !== undefined
    ? Math.min(aforoCalculadoSuperficie, topeNormativoModalidad)
    : aforoCalculadoSuperficie;

  return { aforoMaximo: Math.max(0, aforoMaximo), factorM2, topeNormativoModalidad };
}

/**
 * Evalúa y cruza el aforo físico de sala con el cupo declarado en SAE y la matrícula proyectada
 */
export function evaluarCapacidadSaeYInfraestructura(
  cursoNombre: string,
  sala: SalaInfraestructura,
  cupoSae: number,
  matriculaProyectada: number
): EvaluacionCapacidadSaeCurso {
  let tipoDetectado: 'REGULAR' | 'PARVULARIA' | 'TALLER' | 'MULTIGRADO' | 'ESPECIAL' =
    sala.tipo || (sala.esParvularia ? 'PARVULARIA' : sala.esTallerOTecnico ? 'TALLER' : 'REGULAR');

  if (tipoDetectado === 'REGULAR') {
    if (esModalidadEspecial(cursoNombre)) tipoDetectado = 'ESPECIAL';
    else if (esModalidadMultigradoOCombinado(cursoNombre)) tipoDetectado = 'MULTIGRADO';
  }

  const { aforoMaximo, factorM2, topeNormativoModalidad } = calcularAforoFisicoSala(
    sala.superficieM2,
    tipoDetectado,
    cursoNombre
  );
  
  const observaciones: string[] = [];
  const techoOperativo = Math.min(aforoMaximo, cupoSae > 0 ? cupoSae : aforoMaximo);

  let estadoAforo: 'OPTIMO' | 'ALERTA_SOBRECUPO_FISICO' | 'SUBUTILIZADO' | 'EXCEDE_SAE' = 'OPTIMO';
  let requiereDesdoblamiento = false;

  // 1. Alerta si la matrícula proyectada excede el aforo físico normativo
  if (matriculaProyectada > aforoMaximo) {
    estadoAforo = 'ALERTA_SOBRECUPO_FISICO';
    const motivoTope = topeNormativoModalidad && aforoMaximo === topeNormativoModalidad
      ? ` (tope normativo de la modalidad: ${topeNormativoModalidad} alumnos)`
      : ` (${factorM2} m²/alumno)`;
    observaciones.push(
      `⚠️ Hacinamiento Físico: La matrícula proyectada (${matriculaProyectada}) excede el aforo normativo (${aforoMaximo} alumnos${motivoTope}).`
    );
  }

  // 2. Alerta si la matrícula supera el cupo informado/aprobado en SAE
  if (cupoSae > 0 && matriculaProyectada > cupoSae) {
    if (estadoAforo === 'OPTIMO') estadoAforo = 'EXCEDE_SAE';
    observaciones.push(
      `⚠️ Exceso SAE: Matrícula proyectada (${matriculaProyectada}) supera el cupo declarado en el Sistema de Admisión Escolar (${cupoSae}).`
    );
  }

  // 3. Inconsistencia si el cupo SAE declarado es mayor al aforo físico real de la sala
  if (cupoSae > aforoMaximo) {
    observaciones.push(
      `⚠️ Inconsistencia SAE vs Infraestructura: Se declararon ${cupoSae} cupos SAE pero la sala física solo admite ${aforoMaximo} alumnos.`
    );
  }

  // 4. Detección de necesidad de desdoblamiento
  const umbralDesdoble = topeNormativoModalidad ? topeNormativoModalidad : 45;
  if (matriculaProyectada > umbralDesdoble || matriculaProyectada > aforoMaximo * 1.15) {
    requiereDesdoblamiento = true;
    observaciones.push(
      `📢 Se recomienda desdoblar en 2 secciones (A y B) para cumplir con aforo normativo y asegurar subvención regular.`
    );
  }

  // 5. Subutilización
  if (matriculaProyectada > 0 && matriculaProyectada < aforoMaximo * 0.4) {
    if (estadoAforo === 'OPTIMO') estadoAforo = 'SUBUTILIZADO';
    observaciones.push(
      `ℹ️ Capacidad subutilizada: Sala al ${Math.round((matriculaProyectada / aforoMaximo) * 100)}% de ocupación.`
    );
  }

  if (observaciones.length === 0) {
    observaciones.push('✓ Capacidad física y cupo SAE alineados.');
  }

  return {
    cursoNombre,
    salaAsignada: sala.nombreSala,
    superficieM2: sala.superficieM2,
    factorM2PorAlumno: factorM2,
    aforoMaximoFisico: aforoMaximo,
    cupoDeclaradoSae: cupoSae,
    matriculaProyectada,
    techoOperativoCurso: techoOperativo,
    estadoAforo,
    requiereDesdoblamiento,
    observaciones
  };
}
