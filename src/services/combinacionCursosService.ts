import { CursoSae } from '../types';

/**
 * Normaliza y extrae la lista de grados individuales de un curso
 * ya sea que provenga de `gradosCombinados`, o de un nombre compuesto.
 */
export function extraerGradosDeCurso(curso: CursoSae): string[] {
  if (curso.gradosCombinados && curso.gradosCombinados.length > 0) {
    return [...curso.gradosCombinados];
  }

  const nivel = (curso.nivel || '').trim();

  // Caso: "Multigrado 1° a 6° Básico" o "1° a 6° Básico"
  const matchRangoBasica = nivel.match(/([1-8])°?\s*a\s*([1-8])°?\s*Básico/i);
  if (matchRangoBasica) {
    const inicio = parseInt(matchRangoBasica[1], 10);
    const fin = parseInt(matchRangoBasica[2], 10);
    const grados: string[] = [];
    for (let i = inicio; i <= fin; i++) {
      grados.push(`${i}° Básico`);
    }
    return grados;
  }

  // Caso: "1°-2° Básico" o "1° - 2° Básico" o "1° y 2° Básico" o "1° / 2° Básico"
  const matchParesBasica = nivel.match(/([1-8])°?\s*[-/yea]+\s*([1-8])°?\s*Básico/i);
  if (matchParesBasica) {
    return [`${matchParesBasica[1]}° Básico`, `${matchParesBasica[2]}° Básico`];
  }

  // Caso: "NT1-NT2" o "Pre-Kínder y Kínder"
  if (/nt1|pre-?k[ií]nder/i.test(nivel) && /nt2|k[ií]nder/i.test(nivel)) {
    return ['Pre-Kínder', 'Kínder'];
  }

  // Caso: Separado por comas o guiones genéricos
  if (nivel.includes(',') || nivel.includes(' - ') || nivel.includes(' / ')) {
    const partes = nivel.split(/,|\s+-\s+|\s+\/\s+/).map(p => p.trim()).filter(Boolean);
    if (partes.length > 1) {
      return partes;
    }
  }

  // Si es un curso regular individual
  return [nivel];
}

/**
 * Combina múltiples cursos existentes en un único CursoSae combinado / multigrado.
 */
export function combinarCursosExistentes(
  cursos: CursoSae[],
  opciones?: {
    nombrePersonalizado?: string;
    letra?: string;
    regimen?: 'JEC' | 'No JEC';
    regimenProporcion?: '65_35' | '60_40';
  }
): CursoSae {
  if (!cursos || cursos.length === 0) {
    throw new Error('Se requiere al menos un curso para combinar.');
  }

  const primerCurso = cursos[0];
  const rbd = primerCurso.rbd;
  const periodo = primerCurso.periodo || 2026;

  // Extraer todos los grados individuales sin duplicados
  const todosLosGrados: string[] = [];
  for (const c of cursos) {
    const grados = extraerGradosDeCurso(c);
    for (const g of grados) {
      if (!todosLosGrados.includes(g)) {
        todosLosGrados.push(g);
      }
    }
  }

  // Calcular sumatorias de capacidad y matrícula
  const matriculaProyectada = cursos.reduce((sum, c) => sum + (c.matriculaProyectada || 0), 0);
  const cupoSae = cursos.reduce((sum, c) => sum + (c.cupoSae || 0), 0);
  const alumnosNeet = cursos.reduce((sum, c) => sum + (c.alumnosNeet || 0), 0);
  const alumnosNeep = cursos.reduce((sum, c) => sum + (c.alumnosNeep || 0), 0);

  // Régimen por defecto: JEC si alguno es JEC
  const regimenDefecto: 'JEC' | 'No JEC' = cursos.some(c => c.regimen === 'JEC') ? 'JEC' : 'No JEC';
  const regimenFinal = opciones?.regimen || regimenDefecto;

  // Proporción por defecto: 60_40 si la mayoría es 60_40, de lo contrario 65_35
  const cuenta6040 = cursos.filter(c => c.regimenProporcion === '60_40').length;
  const regimenProporcionFinal = opciones?.regimenProporcion || (cuenta6040 >= cursos.length / 2 ? '60_40' : '65_35');

  // Nombre sugerido automático
  let nombreSugerido = '';
  if (todosLosGrados.length <= 3) {
    nombreSugerido = `Curso Combinado (${todosLosGrados.join(' - ')})`;
  } else {
    nombreSugerido = `Multigrado (${todosLosGrados[0]} a ${todosLosGrados[todosLosGrados.length - 1]})`;
  }
  const nivelFinal = (opciones?.nombrePersonalizado && opciones.nombrePersonalizado.trim()) || nombreSugerido;
  const letraFinal = (opciones?.letra && opciones.letra.trim().toUpperCase()) || 'U';

  const cursoCombinado: CursoSae = {
    id: `curso-comb-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    rbd,
    periodo,
    nivel: nivelFinal,
    letra: letraFinal,
    regimen: regimenFinal,
    regimenProporcion: regimenProporcionFinal,
    cupoSae,
    matriculaProyectada,
    alumnosNeet,
    alumnosNeep,
    esMultigrado: true,
    esCombinado: true,
    tipoModalidad: 'COMBINADO',
    gradosCombinados: todosLosGrados
  };

  return cursoCombinado;
}

/**
 * Descombina un curso combinado en cursos individuales por grado.
 */
export function descombinarCursoExistente(cursoCombinado: CursoSae): CursoSae[] {
  const grados = extraerGradosDeCurso(cursoCombinado);

  if (grados.length === 0) {
    return [cursoCombinado];
  }

  const cantidad = grados.length;
  const rbd = cursoCombinado.rbd;
  const periodo = cursoCombinado.periodo || 2026;
  const regimen = cursoCombinado.regimen || 'JEC';
  const regimenProporcion = cursoCombinado.regimenProporcion || '65_35';
  const letra = cursoCombinado.letra === 'U' ? 'A' : (cursoCombinado.letra || 'A');

  // Distribución de matrícula
  const totalMatricula = cursoCombinado.matriculaProyectada || 0;
  const matBase = Math.floor(totalMatricula / cantidad);
  let matResto = totalMatricula % cantidad;

  // Distribución de cupos SAE
  const totalCupo = cursoCombinado.cupoSae || (cantidad * 35);
  const cupoBase = Math.floor(totalCupo / cantidad);
  let cupoResto = totalCupo % cantidad;

  // Distribución de NEET y NEEP
  const totalNeet = cursoCombinado.alumnosNeet || 0;
  const neetBase = Math.floor(totalNeet / cantidad);
  let neetResto = totalNeet % cantidad;

  const totalNeep = cursoCombinado.alumnosNeep || 0;
  const neepBase = Math.floor(totalNeep / cantidad);
  let neepResto = totalNeep % cantidad;

  const cursosSeparados: CursoSae[] = grados.map((grado, idx) => {
    const matItem = matBase + (matResto > 0 ? 1 : 0);
    if (matResto > 0) matResto--;

    const cupoItem = cupoBase + (cupoResto > 0 ? 1 : 0);
    if (cupoResto > 0) cupoResto--;

    const neetItem = neetBase + (neetResto > 0 ? 1 : 0);
    if (neetResto > 0) neetResto--;

    const neepItem = neepBase + (neepResto > 0 ? 1 : 0);
    if (neepResto > 0) neepResto--;

    return {
      id: `curso-descomb-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
      rbd,
      periodo,
      nivel: grado,
      letra,
      regimen,
      regimenProporcion,
      cupoSae: cupoItem > 0 ? cupoItem : 35,
      matriculaProyectada: matItem,
      alumnosNeet: neetItem,
      alumnosNeep: neepItem,
      esMultigrado: false,
      esCombinado: false,
      tipoModalidad: 'REGULAR',
      gradosCombinados: undefined
    };
  });

  return cursosSeparados;
}
