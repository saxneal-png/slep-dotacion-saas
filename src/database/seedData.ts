import {
  guardarEstablecimiento,
  listarEstablecimientos,
  listarRbdsEliminados,
  poblarPlanesEstudioEnDb
} from './db';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../data/slepSchoolsCatalog';
import { DIRECTORES_TERRITORIO } from '../data/directoresTerritorio';

/**
 * Sincroniza los 121 establecimientos del catálogo oficial en la tabla SQLite,
 * incluyendo los directores oficiales, correos y teléfonos del territorio.
 */
export async function sincronizarCatalogoEstablecimientos(forzarIgnorarEliminados: boolean = false): Promise<void> {
  const existing = await listarEstablecimientos();
  const existingMap = new Map(existing.map(e => [e.rbd.trim(), e]));
  const directoresPorRbd = new Map(DIRECTORES_TERRITORIO.map(d => [d.rbd.trim(), d]));

  let rbdsEliminados = new Set<string>();
  if (!forzarIgnorarEliminados) {
    try {
      rbdsEliminados = await listarRbdsEliminados();
    } catch {}
  }

  for (const school of SLEP_VALLE_DIGUILLIN_SCHOOLS) {
    const rbd = school.rbd.trim();
    if (rbdsEliminados.has(rbd)) continue; // Respetar eliminación hecha por el super usuario
    const dirInfo = directoresPorRbd.get(rbd);
    const prev = existingMap.get(rbd);

    if (!prev) {
      await guardarEstablecimiento({
        id: `est-${rbd}`,
        rbd,
        nombre: school.nombre,
        comuna: school.comuna,
        regimen: school.tipo === 'JARDIN' || school.tipo === 'SALA_CUNA' ? 'No JEC' : 'JEC',
        porcentajePrioritarios: 75.0,
        director: dirInfo?.director || school.director || undefined,
        telefono: dirInfo?.telefono || undefined,
        email: dirInfo?.email || undefined,
      }, true);
    } else if (dirInfo && (!prev.director || !prev.email || !prev.telefono)) {
      await guardarEstablecimiento({
        ...prev,
        director: prev.director || dirInfo.director,
        telefono: prev.telefono || dirInfo.telefono,
        email: prev.email || dirInfo.email,
      }, true);
    }
  }
}

export async function checkAndSeedInitialData(): Promise<void> {
  await sincronizarCatalogoEstablecimientos();
  await poblarPlanesEstudioEnDb();
}

