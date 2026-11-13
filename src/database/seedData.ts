import {
  guardarEstablecimiento,
  listarEstablecimientos,
  listarRbdsEliminados,
  poblarPlanesEstudioEnDb
} from './db';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS, inferTipoPerfilCatalog } from '../data/slepSchoolsCatalog';
import { DIRECTORES_TERRITORIO } from '../data/directoresTerritorio';

/**
 * Sincroniza los 131 establecimientos del catálogo oficial en la tabla SQLite,
 * incluyendo los directores oficiales, tipos/perfiles y nombres oficiales de BDcolegios.xlsx.
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
    const tipoPerfil = inferTipoPerfilCatalog(school);
    const isJardin = school.tipo === 'JARDIN' || school.tipo === 'SALA_CUNA';

    if (!prev) {
      await guardarEstablecimiento({
        id: `est-${rbd}`,
        rbd,
        nombre: school.nombre,
        comuna: school.comuna,
        tipo: school.tipo,
        tipoPerfil,
        regimen: isJardin ? 'No JEC' : 'JEC',
        horarioApertura: isJardin ? '08:30' : undefined,
        horarioCierre: isJardin ? '16:30' : undefined,
        porcentajePrioritarios: 75.0,
        director: dirInfo?.director || school.director || undefined,
        telefono: dirInfo?.telefono || undefined,
        email: dirInfo?.email || undefined,
      }, true);
    } else if (
      !prev.tipo ||
      !prev.tipoPerfil ||
      prev.nombre !== school.nombre ||
      (dirInfo && (!prev.director || !prev.email || !prev.telefono))
    ) {
      await guardarEstablecimiento({
        ...prev,
        nombre: school.nombre,
        tipo: prev.tipo || school.tipo,
        tipoPerfil: prev.tipoPerfil || tipoPerfil,
        horarioApertura: prev.horarioApertura || (isJardin ? '08:30' : undefined),
        horarioCierre: prev.horarioCierre || (isJardin ? '16:30' : undefined),
        director: prev.director || dirInfo?.director,
        telefono: prev.telefono || dirInfo?.telefono,
        email: prev.email || dirInfo?.email,
      }, true);
    }
  }
}

export async function checkAndSeedInitialData(): Promise<void> {
  await sincronizarCatalogoEstablecimientos();
  await poblarPlanesEstudioEnDb();
}

