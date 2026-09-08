// =============================================================================
// REGLA DE NEGOCIO: CAPACIDAD POR SALA, AFORD DECRETO 548 Y VALIDACIÓN SAE
// =============================================================================

export interface SalaInfraestructura {
  id: string;
  rbd: string;
  nombreSala: string;
  pabellon?: string;
  superficieM2: number;
  tipo?: 'REGULAR' | 'PARVULARIA' | 'TALLER';
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
 * Calcula el aforo máximo físico según Decreto 548 (Infraestructura Escolar MINEDUC):
 * - Educación Regular (Básica y Media): 1.1 m² por alumno
 * - Educación Parvularia: 1.5 m² por alumno
 * - Talleres / Laboratorios / Salas Especiales: 1.8 m² por alumno
 */
export function calcularAforoFisicoSala(
  superficieM2: number,
  tipo: 'REGULAR' | 'PARVULARIA' | 'TALLER' = 'REGULAR'
): { aforoMaximo: number; factorM2: number } {
  let factorM2 = 1.1;
  if (tipo === 'PARVULARIA') factorM2 = 1.5;
  if (tipo === 'TALLER') factorM2 = 1.8;

  const aforoMaximo = Math.floor(Math.round((superficieM2 / factorM2) * 1000) / 1000);
  return { aforoMaximo: Math.max(0, aforoMaximo), factorM2 };
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
  const tipo = sala.tipo || (sala.esParvularia ? 'PARVULARIA' : sala.esTallerOTecnico ? 'TALLER' : 'REGULAR');
  const { aforoMaximo, factorM2 } = calcularAforoFisicoSala(sala.superficieM2, tipo);
  
  const observaciones: string[] = [];
  const techoOperativo = Math.min(aforoMaximo, cupoSae > 0 ? cupoSae : aforoMaximo);

  let estadoAforo: 'OPTIMO' | 'ALERTA_SOBRECUPO_FISICO' | 'SUBUTILIZADO' | 'EXCEDE_SAE' = 'OPTIMO';
  let requiereDesdoblamiento = false;

  // 1. Alerta si la matrícula proyectada excede el aforo físico normativo
  if (matriculaProyectada > aforoMaximo) {
    estadoAforo = 'ALERTA_SOBRECUPO_FISICO';
    observaciones.push(
      `⚠️ Hacinamiento Físico: La matrícula proyectada (${matriculaProyectada}) excede el aforo normativo (${aforoMaximo} alumnos a ${factorM2} m²/alumno).`
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

  // 4. Detección de necesidad de desdoblamiento (si aforo físico es superado por más del 15% o excede 45 alumnos)
  if (matriculaProyectada > 45 || matriculaProyectada > aforoMaximo * 1.15) {
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
