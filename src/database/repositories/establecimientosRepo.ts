import { Establecimiento } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { SupabaseDotacionService } from '../../services/supabaseDotacionService';

export async function listarEstablecimientos(): Promise<Establecimiento[]> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nombre, comuna, regimen, porcentaje_prioritarios, director, asesor_uatp, telefono, email, subvencion_sep_mensual, subvencion_pro_retencion, cupo_horas_pie_diferencial, cupo_horas_pie_asistentes FROM establecimientos ORDER BY nombre ASC");
  if (!res.length) return [];
  return res[0].values.map(row => ({
    id: String(row[0]),
    rbd: String(row[1]),
    nombre: String(row[2]),
    comuna: row[3] as any,
    regimen: row[4] as any,
    porcentajePrioritarios: Number(row[5]),
    director: row[6] ? String(row[6]) : undefined,
    asesorUatp: row[7] ? String(row[7]) : undefined,
    telefono: row[8] ? String(row[8]) : undefined,
    email: row[9] ? String(row[9]) : undefined,
    subvencionSepMensual: Number(row[10] || 0),
    subvencionProRetencion: Number(row[11] || 0),
    cupoHorasPieDiferencial: Number(row[12] || 0),
    cupoHorasPieAsistentes: Number(row[13] || 0),
  }));
}

export async function guardarEstablecimiento(e: Establecimiento, skipCloudSync: boolean = false): Promise<void> {
  const db = await getDb();
  const rbdNorm = e.rbd.trim();

  // Si el usuario o Super Usuario guarda un colegio, removerlo de la lista negra de eliminados
  await desmarcarRbdEliminado(rbdNorm);

  // Buscar por RBD o por ID para evitar violación de UNIQUE constraint
  const existing = db.exec("SELECT id FROM establecimientos WHERE rbd = ? OR id = ?", [rbdNorm, e.id]);
  if (existing.length && existing[0].values.length) {
    const existingId = String(existing[0].values[0][0]);
    db.run(`
      UPDATE establecimientos SET
        rbd=?, nombre=?, comuna=?, regimen=?, porcentaje_prioritarios=?,
        director=?, asesor_uatp=?, telefono=?, email=?,
        subvencion_sep_mensual=?, subvencion_pro_retencion=?, cupo_horas_pie_diferencial=?, cupo_horas_pie_asistentes=?
      WHERE id=?
    `, [
      rbdNorm, e.nombre.trim(), e.comuna, e.regimen, e.porcentajePrioritarios,
      e.director || null, e.asesorUatp || null, e.telefono || null, e.email || null,
      e.subvencionSepMensual || 0, e.subvencionProRetencion || 0, e.cupoHorasPieDiferencial || 0, e.cupoHorasPieAsistentes || 0,
      existingId
    ]);
  } else {
    db.run(`
      INSERT INTO establecimientos (
        id, rbd, nombre, comuna, regimen, porcentaje_prioritarios, director, asesor_uatp, telefono, email,
        subvencion_sep_mensual, subvencion_pro_retencion, cupo_horas_pie_diferencial, cupo_horas_pie_asistentes
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      e.id, rbdNorm, e.nombre.trim(), e.comuna, e.regimen, e.porcentajePrioritarios,
      e.director || null, e.asesorUatp || null, e.telefono || null, e.email || null,
      e.subvencionSepMensual || 0, e.subvencionProRetencion || 0, e.cupoHorasPieDiferencial || 0, e.cupoHorasPieAsistentes || 0
    ]);
  }
  persistDb();

  // Si había sido eliminado previamente, removerlo del registro de eliminados
  try {
    if (typeof localStorage !== 'undefined') {
      const eliminadosRaw = localStorage.getItem('slep_rbds_eliminados');
      if (eliminadosRaw) {
        const set = new Set<string>(JSON.parse(eliminadosRaw));
        if (set.delete(rbdNorm)) {
          localStorage.setItem('slep_rbds_eliminados', JSON.stringify(Array.from(set)));
        }
      }
    }
  } catch {}

  if (!skipCloudSync) {
    SupabaseDotacionService.guardarEstablecimiento(e).catch(err =>
      console.warn('[establecimientosRepo] Aviso sincronizando con Supabase:', err)
    );
  }
}

export async function obtenerEstablecimientoPorRbd(rbd: string): Promise<Establecimiento | null> {
  const db = await getDb();
  const res = db.exec("SELECT id, rbd, nombre, comuna, regimen, porcentaje_prioritarios, director, asesor_uatp, telefono, email, subvencion_sep_mensual, subvencion_pro_retencion, cupo_horas_pie_diferencial, cupo_horas_pie_asistentes FROM establecimientos WHERE rbd = ?", [rbd]);
  if (!res.length || !res[0].values.length) return null;
  const row = res[0].values[0];
  return {
    id: String(row[0]),
    rbd: String(row[1]),
    nombre: String(row[2]),
    comuna: row[3] as any,
    regimen: row[4] as any,
    porcentajePrioritarios: Number(row[5]),
    director: row[6] ? String(row[6]) : undefined,
    asesorUatp: row[7] ? String(row[7]) : undefined,
    telefono: row[8] ? String(row[8]) : undefined,
    email: row[9] ? String(row[9]) : undefined,
    subvencionSepMensual: Number(row[10] || 0),
    subvencionProRetencion: Number(row[11] || 0),
    cupoHorasPieDiferencial: Number(row[12] || 0),
    cupoHorasPieAsistentes: Number(row[13] || 0)
  };
}

export async function registrarRbdEliminado(rbd: string, usuario: string = 'Super Usuario'): Promise<void> {
  const db = await getDb();
  const clean = rbd.replace(/^est-/, '').trim();
  try {
    db.run("INSERT OR REPLACE INTO establecimientos_eliminados (rbd, eliminado_por, fecha) VALUES (?, ?, ?)", [
      clean,
      usuario,
      new Date().toISOString()
    ]);
    persistDb();
  } catch (err) {
    console.warn('[establecimientosRepo] Error registrando RBD eliminado en SQLite:', err);
  }

  // Sincronizar en localStorage como respaldo local
  try {
    if (typeof localStorage !== 'undefined') {
      const eliminadosRaw = localStorage.getItem('slep_rbds_eliminados');
      const set = new Set<string>(eliminadosRaw ? JSON.parse(eliminadosRaw) : []);
      set.add(clean);
      localStorage.setItem('slep_rbds_eliminados', JSON.stringify(Array.from(set)));
    }
  } catch {}
}

export async function desmarcarRbdEliminado(rbd: string): Promise<void> {
  const db = await getDb();
  const clean = rbd.replace(/^est-/, '').trim();
  try {
    db.run("DELETE FROM establecimientos_eliminados WHERE rbd = ?", [clean]);
    persistDb();
  } catch {}

  try {
    if (typeof localStorage !== 'undefined') {
      const eliminadosRaw = localStorage.getItem('slep_rbds_eliminados');
      if (eliminadosRaw) {
        const set = new Set<string>(JSON.parse(eliminadosRaw));
        set.delete(clean);
        localStorage.setItem('slep_rbds_eliminados', JSON.stringify(Array.from(set)));
      }
    }
  } catch {}
}

export async function listarRbdsEliminados(): Promise<Set<string>> {
  const db = await getDb();
  const set = new Set<string>();

  try {
    const res = db.exec("SELECT rbd FROM establecimientos_eliminados");
    if (res.length && res[0].values) {
      for (const row of res[0].values) {
        if (row[0]) set.add(String(row[0]).trim());
      }
    }
  } catch {}

  // Fallback localStorage
  try {
    if (typeof localStorage !== 'undefined') {
      const eliminadosRaw = localStorage.getItem('slep_rbds_eliminados');
      if (eliminadosRaw) {
        const arr = JSON.parse(eliminadosRaw);
        for (const item of arr) {
          if (item) set.add(String(item).trim());
        }
      }
    }
  } catch {}

  return set;
}

export async function esRbdEliminado(rbd: string): Promise<boolean> {
  const clean = rbd.replace(/^est-/, '').trim();
  const eliminados = await listarRbdsEliminados();
  return eliminados.has(clean);
}

export async function eliminarEstablecimiento(idOrRbd: string): Promise<void> {
  const db = await getDb();
  
  // Buscar id y rbd exactos para garantizar cascada completa
  const res = db.exec("SELECT id, rbd FROM establecimientos WHERE id = ? OR rbd = ?", [idOrRbd, idOrRbd]);
  let id = idOrRbd;
  let rbd = idOrRbd.replace(/^est-/, '').trim();
  if (res.length && res[0].values.length) {
    id = String(res[0].values[0][0]);
    rbd = String(res[0].values[0][1]);
  }

  // Eliminar en cascada en SQLite
  try { db.run("DELETE FROM asignaciones_horarias WHERE rbd = ?", [rbd]); } catch {}
  try { db.run("DELETE FROM asistentes_educacion WHERE rbd = ?", [rbd]); } catch {}
  try { db.run("DELETE FROM docentes WHERE rbd = ?", [rbd]); } catch {}
  try { db.run("DELETE FROM cursos_sae WHERE rbd = ?", [rbd]); } catch {}
  try { db.run("DELETE FROM salas_infraestructura WHERE rbd = ?", [rbd]); } catch {}
  try { db.run("DELETE FROM cartera_asesorias WHERE rbd = ?", [rbd]); } catch {}
  db.run("DELETE FROM establecimientos WHERE id = ? OR rbd = ?", [id, rbd]);
  
  persistDb();

  // Registrar RBD eliminado de forma permanente (SQLite + Supabase + localStorage)
  await registrarRbdEliminado(rbd);

  SupabaseDotacionService.eliminarEstablecimiento(rbd).catch(err =>
    console.warn('[establecimientosRepo] Aviso eliminando en Supabase:', err)
  );
}