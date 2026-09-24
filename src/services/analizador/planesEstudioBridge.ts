import { PlanEstudioCurricular } from '../../types';
import { listarPlanesEstudio } from '../../database/db';
import { obtenerPlanPorCurso } from '@slep/mineduc-engine';

// Caché en memoria para acceso sincrónico ultrarrápido durante el procesamiento de planillas
let planesEstudioCache: PlanEstudioCurricular[] = [];
let cacheInicializada = false;

/**
 * Normaliza cadenas de texto para comparaciones flexibles
 */
function normStr(text: string): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Carga o refresca la caché de planes de estudio desde la base de datos SQLite.
 */
export async function inicializarPlanesEstudioAnalizador(): Promise<PlanEstudioCurricular[]> {
  try {
    const planesDb = await listarPlanesEstudio();
    planesEstudioCache = planesDb;
    cacheInicializada = true;
    return planesDb;
  } catch (err) {
    console.warn('Error al cargar planes de estudio desde SQLite para el analizador:', err);
    return planesEstudioCache;
  }
}

/**
 * Establece manualmente la caché de planes de estudio.
 */
export function setPlanesEstudioAnalizadorCache(planes: PlanEstudioCurricular[]): void {
  planesEstudioCache = planes || [];
  cacheInicializada = true;
}

/**
 * Obtiene la lista actual de planes de estudio en memoria.
 */
export function getPlanesEstudioAnalizadorCache(): PlanEstudioCurricular[] {
  return planesEstudioCache;
}

/**
 * Busca el plan de estudio curricular aplicable a un curso o nivel.
 * Consulta primero la base de datos dinámica (incluyendo EPJA 2024, TP y personalizados).
 * Si no encuentra coincidencia, consulta el motor normativo base.
 */
export function buscarPlanEstudioAnalizador(
  nivelOCurso: string,
  regimen?: string
): PlanEstudioCurricular | null {
  if (!nivelOCurso) return null;

  const targetNorm = normStr(nivelOCurso);
  const regNorm = normStr(regimen || '');
  const reqNoJec = regNorm.includes('no');

  // 1. Búsqueda en la base de datos dinámica de planes de estudio
  if (planesEstudioCache.length > 0) {
    // 1.1 Coincidencia exacta de nivel
    const matchExacto = planesEstudioCache.find((p) => {
      const pNivelNorm = normStr(p.nivel);
      if (pNivelNorm !== targetNorm) return false;
      if (!regimen) return true;
      const planNoJec = normStr(p.regimen).includes('no');
      return reqNoJec === planNoJec;
    });
    if (matchExacto) return matchExacto;

    // 1.2 Reconocimiento especial para EPJA 2024 (Decreto 10/2022)
    if (targetNorm.includes('epja') || targetNorm.includes('adult') || targetNorm.includes('nivel')) {
      if (targetNorm.includes('basica') || targetNorm.includes('basic')) {
        if (targetNorm.includes('1') || targetNorm.includes('primer')) {
          const epjaB1 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('basica - nivel 1'));
          if (epjaB1) return epjaB1;
        }
        if (targetNorm.includes('2') || targetNorm.includes('segundo')) {
          const epjaB2 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('basica - nivel 2'));
          if (epjaB2) return epjaB2;
        }
        if (targetNorm.includes('3') || targetNorm.includes('tercer')) {
          const epjaB3 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('basica - nivel 3'));
          if (epjaB3) return epjaB3;
        }
      }
      if (targetNorm.includes('media')) {
        if (targetNorm.includes('oficio')) {
          if (targetNorm.includes('2') || targetNorm.includes('segundo')) {
            const epjaOf2 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('oficios - nivel 2'));
            if (epjaOf2) return epjaOf2;
          }
          const epjaOf1 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('oficios - nivel 1'));
          if (epjaOf1) return epjaOf1;
        }
        if (targetNorm.includes('tp') || targetNorm.includes('especialidad')) {
          if (targetNorm.includes('3') || targetNorm.includes('tercer')) {
            const epjaTp3 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('especialidades - nivel 3'));
            if (epjaTp3) return epjaTp3;
          }
          if (targetNorm.includes('2') || targetNorm.includes('segundo')) {
            const epjaTp2 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('especialidades - nivel 2'));
            if (epjaTp2) return epjaTp2;
          }
          const epjaTp1 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('especialidades - nivel 1'));
          if (epjaTp1) return epjaTp1;
        }
        if (targetNorm.includes('2') || targetNorm.includes('segundo') || targetNorm.includes('3') || targetNorm.includes('4')) {
          const epjaHc2 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('humanistico-cientifica - nivel 2'));
          if (epjaHc2) return epjaHc2;
        }
        const epjaHc1 = planesEstudioCache.find(p => p.categoria === 'EPJA' && normStr(p.nivel).includes('humanistico-cientifica - nivel 1'));
        if (epjaHc1) return epjaHc1;
      }
    }

    // 1.3 Coincidencia por especialidad TP o personalizada
    const matchParcial = planesEstudioCache.find((p) => {
      const pNivelNorm = normStr(p.nivel);
      // Evitar que "1° Básico" haga match parcial con "1° a 4° Básico"
      if (pNivelNorm === targetNorm) return true;
      if (p.categoria === 'MEDIA_TP' || p.esPersonalizado) {
        return pNivelNorm.includes(targetNorm) || targetNorm.includes(pNivelNorm);
      }
      return false;
    });
    if (matchParcial) return matchParcial;
  }

  // 2. Fallback al motor normativo estático si aún no está en caché o no coincidió
  const fallback = obtenerPlanPorCurso(nivelOCurso, (regimen as any) || 'JEC');
  if (fallback) {
    return {
      id: `fallback-${fallback.nivel}`,
      nivel: fallback.nivel,
      regimen: fallback.regimen,
      categoria: fallback.categoria || 'OTRO',
      decretoSupremo: fallback.referenciaFuente,
      totalHorasSemanalesObligatorias: fallback.horasObligatorias,
      totalHorasAnualesObligatorias: fallback.horasObligatorias * 36,
      horasLibreDisposicion: fallback.horasLibreDisposicion,
      totalHorasPlan: fallback.totalHorasPlan,
      asignaturas: (fallback.asignaturasBase || []).map(a => ({
        nombre: a.nombre,
        horasSemanales: a.horasSugeridas,
        horasAnuales: a.horasSugeridas * 36,
        caracter: 'Obligatoria'
      }))
    };
  }

  return null;
}

/**
 * Obtiene la lista de nombres de asignaturas oficiales sugeridas para un curso,
 * extrayendo tanto las materias del plan como los ámbitos formativos.
 */
export function getAsignaturasSugeridasPorPlanAnalizador(nivel: string): string[] {
  const plan = buscarPlanEstudioAnalizador(nivel);
  if (plan && plan.asignaturas && plan.asignaturas.length > 0) {
    const list: string[] = [];
    plan.asignaturas.forEach(a => {
      if (a.nombre) list.push(a.nombre);
    });

    if (plan.ambitosFormativos) {
      plan.ambitosFormativos.forEach(amb => {
        if (amb.catalogoAsignaturasElegibles) {
          list.push(...amb.catalogoAsignaturasElegibles);
        }
      });
    }

    list.push('Apoyo PIE / Codocencia', 'Talleres JEC / Libre Disposición', 'Funciones Institucionales / No Lectivas');
    return Array.from(new Set(list));
  }

  return [];
}

/**
 * Retorna un conjunto de todas las asignaturas conocidas en todos los planes cargados.
 */
export function getTodasLasAsignaturasConocidas(): Set<string> {
  const set = new Set<string>();
  for (const p of planesEstudioCache) {
    p.asignaturas?.forEach(a => {
      if (a.nombre) set.add(a.nombre.trim());
    });
    p.ambitosFormativos?.forEach(amb => {
      amb.catalogoAsignaturasElegibles?.forEach(eleg => set.add(eleg.trim()));
    });
  }
  return set;
}
