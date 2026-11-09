/**
 * Servicio de Proyección de Matrícula Territorial SLEP Valle Diguillín
 * Basado en la serie histórica (2021-2025) y corte oficial a agosto 2026
 * de "BASE DE DATOS COMPLETA" (base completa.xlsx).
 */

import { homologarNivelExcelPal } from './depHomologationEngine';
import datosHistoricosRaw from './datosBaseCompletaMatricula.json';

export interface RegistroMatriculaHistorica {
  rbd: string;
  nivel: string;
  cod?: string;
  esp?: string;
  m21: number;
  m22: number;
  m23: number;
  m24: number;
  m25: number;
  ago26: number;
  cupos27?: number;
  cur27?: number;
  cuposRex?: number;
}

export interface ProyeccionNivelResultado {
  rbd: string;
  nivelCanonico: string;
  matriculaProyectada: number;
  cursosSugeridos: number;
  metodoAplicado: 'PROMEDIO_HISTORICO_ABSORCION' | 'PROMOCION_COHORTE_PREVIA' | 'CUPO_REX_INFRAESTRUCTURA' | 'DATO_DIRECTO_AGOSTO';
  detalle: string;
}

export interface OpcionesProyeccionNivel {
  especialidad?: string;
  indiceFila?: number;
  cursosActivosSaaS?: string[]; // lista de niveles canónicos activos en el SaaS para este colegio
}

const REGISTROS_BASE: RegistroMatriculaHistorica[] = datosHistoricosRaw as RegistroMatriculaHistorica[];

/**
 * Consolida múltiples registros históricos del mismo nivel (ej. especialidades TP en 3° y 4° Medio)
 * sumando sus matrículas históricas, corte de agosto y cupos REX.
 */
function consolidarRegistrosNivel(registros: RegistroMatriculaHistorica[]): RegistroMatriculaHistorica {
  if (registros.length === 1) return registros[0];
  const primer = registros[0];
  let m21 = 0, m22 = 0, m23 = 0, m24 = 0, m25 = 0, ago26 = 0, cur27 = 0, cupos27 = 0;
  let cuposRex = 0;
  let tieneRex = false;

  for (const r of registros) {
    m21 += r.m21 || 0;
    m22 += r.m22 || 0;
    m23 += r.m23 || 0;
    m24 += r.m24 || 0;
    m25 += r.m25 || 0;
    ago26 += r.ago26 || 0;
    cur27 += r.cur27 || 0;
    cupos27 += r.cupos27 || 0;
    if (r.cuposRex !== undefined && r.cuposRex > 0) {
      cuposRex += r.cuposRex;
      tieneRex = true;
    }
  }

  return {
    rbd: primer.rbd,
    nivel: primer.nivel,
    cod: primer.cod,
    esp: 'Consolidado Nivel',
    m21,
    m22,
    m23,
    m24,
    m25,
    ago26,
    cur27,
    cupos27,
    cuposRex: tieneRex ? cuposRex : undefined
  };
}

// Mapeo canónico inverso de nivel previo para la promoción de cohortes
const MAPA_NIVEL_PREVIO: Record<string, string> = {
  'kinder': 'prekinder',
  '1 basico': 'kinder',
  '2 basico': '1 basico',
  '3 basico': '2 basico',
  '4 basico': '3 basico',
  '5 basico': '4 basico',
  '6 basico': '5 basico',
  '7 basico': '6 basico',
  '8 basico': '7 basico',
  '1 medio': '8 basico',
  '2 medio': '1 medio',
  '3 medio': '2 medio',
  '4 medio': '3 medio'
};

/**
 * Calcula el promedio histórico de absorción considerando todos los años registrados con datos válidos
 */
export function calcularPromedioHistoricoAbsorcion(reg: RegistroMatriculaHistorica): number {
  const valores = [reg.m21, reg.m22, reg.m23, reg.m24, reg.m25, reg.ago26].filter(v => typeof v === 'number' && v > 0);
  if (valores.length === 0) return reg.ago26 || reg.m25 || 0;
  const suma = valores.reduce((acc, curr) => acc + curr, 0);
  return Math.round(suma / valores.length);
}

/**
 * Obtiene todos los registros de la base histórica asociados a un RBD
 */
export function obtenerRegistrosPorRbd(rbd: string | number): RegistroMatriculaHistorica[] {
  const rbdStr = String(rbd).trim();
  return REGISTROS_BASE.filter(r => r.rbd === rbdStr);
}

/**
 * Determina la matrícula proyectada para un RBD y nivel específico,
 * aplicando las reglas normativas territoriales del SLEP:
 * 1. Resguardo de topes por Resolución Exenta (REX) de capacidad de salas.
 * 2. Nodos de entrada territorial y absorción externa (Pre-Kínder, 1° Básico con/sin Kínder, 7° Básico sin 6° básico, 1° Medio con demanda externa).
 * 3. Promoción natural de la cohorte anterior (Agosto 2026).
 * 4. Adaptación a la estructura de cursos activa y trabajada en el SaaS.
 */
export function proyectarMatriculaNivel(
  rbd: string | number,
  nivelRaw: string,
  opciones?: OpcionesProyeccionNivel
): ProyeccionNivelResultado {
  const rbdStr = String(rbd).trim();
  const nivelCanonico = homologarNivelExcelPal(nivelRaw);
  const registrosEstablecimiento = obtenerRegistrosPorRbd(rbdStr);

  const regsNivelActual = registrosEstablecimiento.filter(
    r => homologarNivelExcelPal(r.nivel) === nivelCanonico
  );

  let regNivelActual: RegistroMatriculaHistorica | undefined;
  if (opciones?.indiceFila !== undefined && regsNivelActual[opciones.indiceFila]) {
    regNivelActual = regsNivelActual[opciones.indiceFila];
  } else if (opciones?.especialidad) {
    regNivelActual = regsNivelActual.find(r => r.esp?.toLowerCase().includes(opciones.especialidad!.toLowerCase())) || (regsNivelActual.length > 0 ? consolidarRegistrosNivel(regsNivelActual) : undefined);
  } else if (regsNivelActual.length > 0) {
    regNivelActual = consolidarRegistrosNivel(regsNivelActual);
  }

  // Fallback si el establecimiento o nivel no está en la base de datos
  if (!regNivelActual && registrosEstablecimiento.length === 0) {
    return {
      rbd: rbdStr,
      nivelCanonico,
      matriculaProyectada: 0,
      cursosSugeridos: 0,
      metodoAplicado: 'DATO_DIRECTO_AGOSTO',
      detalle: 'Establecimiento sin antecedentes en base histórica'
    };
  }

  // 1. Resguardo REX si existe cupo fijado explícito por capacidad física de salas
  if (regNivelActual && regNivelActual.cuposRex !== undefined && regNivelActual.cuposRex > 0) {
    return {
      rbd: rbdStr,
      nivelCanonico,
      matriculaProyectada: regNivelActual.cuposRex,
      cursosSugeridos: regNivelActual.cur27 || 1,
      metodoAplicado: 'CUPO_REX_INFRAESTRUCTURA',
      detalle: `Fijado por REX de capacidad de salas (${regNivelActual.cuposRex} cupos)`
    };
  }

  // Identificar si el colegio cuenta con los distintos niveles en su oferta (SaaS activo o base histórica)
  const nivelesSaaS = opciones?.cursosActivosSaaS;
  const tienePrekinder = nivelesSaaS
    ? nivelesSaaS.includes('prekinder')
    : registrosEstablecimiento.some(r => homologarNivelExcelPal(r.nivel) === 'prekinder');
  const tieneKinder = nivelesSaaS
    ? nivelesSaaS.includes('kinder')
    : registrosEstablecimiento.some(r => homologarNivelExcelPal(r.nivel) === 'kinder');
  const tiene6toBasico = nivelesSaaS
    ? nivelesSaaS.includes('6 basico')
    : registrosEstablecimiento.some(r => homologarNivelExcelPal(r.nivel) === '6 basico');
  const tiene8voBasico = nivelesSaaS
    ? nivelesSaaS.includes('8 basico')
    : registrosEstablecimiento.some(r => homologarNivelExcelPal(r.nivel) === '8 basico');

  // 2. Pre-Kínder (Nodo inicial puro: promedio histórico de absorción)
  if (nivelCanonico === 'prekinder') {
    const avg = regNivelActual ? calcularPromedioHistoricoAbsorcion(regNivelActual) : 0;
    return {
      rbd: rbdStr,
      nivelCanonico,
      matriculaProyectada: avg,
      cursosSugeridos: regNivelActual?.cur27 || (avg > 0 ? 1 : 0),
      metodoAplicado: 'PROMEDIO_HISTORICO_ABSORCION',
      detalle: `Promedio histórico de absorción de Pre-Kínder (${avg} estudiantes)`
    };
  }

  // 3. 1° Básico (Nodo de absorción externa: egresados de escuelas de lenguaje y jardines externos)
  if (nivelCanonico === '1 basico') {
    const avg1B = regNivelActual ? calcularPromedioHistoricoAbsorcion(regNivelActual) : 0;

    // Caso 3.1: Escuela sin Kínder (100% captación externa)
    if (!tieneKinder) {
      return {
        rbd: rbdStr,
        nivelCanonico,
        matriculaProyectada: avg1B,
        cursosSugeridos: regNivelActual?.cur27 || (avg1B > 0 ? 1 : 0),
        metodoAplicado: 'PROMEDIO_HISTORICO_ABSORCION',
        detalle: `Escuela sin Kínder: Proyección por absorción histórica en 1° Básico (${avg1B})`
      };
    }

    // Caso 3.2: Escuela con Kínder propio (absorbe Kínder interno + externos de escuelas de lenguaje)
    const regsKinder = registrosEstablecimiento.filter(r => homologarNivelExcelPal(r.nivel) === 'kinder');
    const regKinder = regsKinder.length > 0 ? consolidarRegistrosNivel(regsKinder) : undefined;
    const agoKinder = regKinder?.ago26 || 0;

    // Si históricamente capta significativamente más alumnos de los que promueve su Kínder interno
    const matCalculada = Math.max(agoKinder, avg1B);
    return {
      rbd: rbdStr,
      nivelCanonico,
      matriculaProyectada: matCalculada,
      cursosSugeridos: regNivelActual?.cur27 || (matCalculada > 0 ? 1 : 0),
      metodoAplicado: matCalculada === avg1B ? 'PROMEDIO_HISTORICO_ABSORCION' : 'PROMOCION_COHORTE_PREVIA',
      detalle: `1° Básico con Kínder: max(Kínder ${agoKinder}, Histórico 1B ${avg1B}) = ${matCalculada}`
    };
  }

  // 4. 7° Básico (Nodo de entrada en Liceos que no tienen básica completa 1°-6°)
  if (nivelCanonico === '7 basico' && !tiene6toBasico) {
    const avg7B = regNivelActual ? calcularPromedioHistoricoAbsorcion(regNivelActual) : 0;
    return {
      rbd: rbdStr,
      nivelCanonico,
      matriculaProyectada: avg7B,
      cursosSugeridos: regNivelActual?.cur27 || (avg7B > 0 ? 1 : 0),
      metodoAplicado: 'PROMEDIO_HISTORICO_ABSORCION',
      detalle: `Liceo sin 6° básico: Absorción histórica en 7° Básico (${avg7B})`
    };
  }

  // 5. 1° Medio (Nodo de articulación comunal: egresados de escuelas básicas)
  if (nivelCanonico === '1 medio') {
    const avg1M = regNivelActual ? calcularPromedioHistoricoAbsorcion(regNivelActual) : 0;

    // Caso 5.1: Liceo que no tiene 8° básico
    if (!tiene8voBasico) {
      return {
        rbd: rbdStr,
        nivelCanonico,
        matriculaProyectada: avg1M,
        cursosSugeridos: regNivelActual?.cur27 || (avg1M > 0 ? 1 : 0),
        metodoAplicado: 'PROMEDIO_HISTORICO_ABSORCION',
        detalle: `Liceo sin 8° básico: Absorción histórica en 1° Medio (${avg1M})`
      };
    }

    // Caso 5.2: Liceo con 8° básico pero con alta captación externa comprobada
    const regs8B = registrosEstablecimiento.filter(r => homologarNivelExcelPal(r.nivel) === '8 basico');
    const reg8B = regs8B.length > 0 ? consolidarRegistrosNivel(regs8B) : undefined;
    const ago8B = reg8B?.ago26 || 0;
    const mat1M = Math.max(ago8B, avg1M);
    return {
      rbd: rbdStr,
      nivelCanonico,
      matriculaProyectada: mat1M,
      cursosSugeridos: regNivelActual?.cur27 || (mat1M > 0 ? 1 : 0),
      metodoAplicado: mat1M === avg1M ? 'PROMEDIO_HISTORICO_ABSORCION' : 'PROMOCION_COHORTE_PREVIA',
      detalle: `1° Medio con 8° básico: max(8° Básico ${ago8B}, Histórico 1M ${avg1M}) = ${mat1M}`
    };
  }

  // 6. Cursos con continuidad regular (Promoción natural de la cohorte previa de Agosto 2026)
  const nivelPrevioCanonico = MAPA_NIVEL_PREVIO[nivelCanonico];
  if (nivelPrevioCanonico) {
    const regsPrevio = registrosEstablecimiento.filter(
      r => homologarNivelExcelPal(r.nivel) === nivelPrevioCanonico
    );
    const regPrevio = regsPrevio.length > 0 ? consolidarRegistrosNivel(regsPrevio) : undefined;
    if (regPrevio && regPrevio.ago26 !== undefined && regPrevio.ago26 > 0) {
      return {
        rbd: rbdStr,
        nivelCanonico,
        matriculaProyectada: regPrevio.ago26,
        cursosSugeridos: regNivelActual?.cur27 || (regPrevio.ago26 > 0 ? 1 : 0),
        metodoAplicado: 'PROMOCION_COHORTE_PREVIA',
        detalle: `Promoción de cohorte anterior (${regPrevio.nivel} agosto 2026 = ${regPrevio.ago26})`
      };
    }
  }

  // 7. Cursos Especiales, Talleres Laborales, Opción 4 o EPJA (Dato directo de agosto 2026 o histórico)
  const matDirecta = regNivelActual?.ago26 || regNivelActual?.m25 || (regNivelActual ? calcularPromedioHistoricoAbsorcion(regNivelActual) : 0);
  return {
    rbd: rbdStr,
    nivelCanonico,
    matriculaProyectada: matDirecta,
    cursosSugeridos: regNivelActual?.cur27 || (matDirecta > 0 ? 1 : 0),
    metodoAplicado: 'DATO_DIRECTO_AGOSTO',
    detalle: `Carga directa de matrícula para modalidad ${nivelRaw} (${matDirecta})`
  };
}

/**
 * Distribuye la matrícula total de un nivel entre las secciones / cursos existentes en el SaaS
 */
export function distribuirMatriculaEnCursos<T extends { id: string; letra?: string; cupoSae?: number }>(
  cursosSecciones: T[],
  matriculaTotalNivel: number
): Map<string, number> {
  const mapa = new Map<string, number>();
  const totalCursos = cursosSecciones.length;

  if (totalCursos === 0) return mapa;

  if (totalCursos === 1) {
    mapa.set(cursosSecciones[0].id, matriculaTotalNivel);
    return mapa;
  }

  // Distribución equitativa con asignación de residuo a las primeras letras (A, B...)
  const basePorCurso = Math.floor(matriculaTotalNivel / totalCursos);
  let residuo = matriculaTotalNivel % totalCursos;

  // Ordenar por letra A, B, C...
  const ordenados = [...cursosSecciones].sort((a, b) => (a.letra || 'A').localeCompare(b.letra || 'A'));

  for (const c of ordenados) {
    let cuota = basePorCurso;
    if (residuo > 0) {
      cuota += 1;
      residuo--;
    }
    mapa.set(c.id, cuota);
  }

  return mapa;
}
