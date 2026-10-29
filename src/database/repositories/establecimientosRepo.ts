import { Establecimiento } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { FirebaseDotacionService } from '../../services/firebaseDotacionService';
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
  if (!skipCloudSync) {
    SupabaseDotacionService.guardarEstablecimiento(e).catch(err =>
      console.warn('[establecimientosRepo] Aviso sincronizando con Supabase:', err)
    );
    FirebaseDotacionService.guardarEstablecimiento(e).catch(err =>
      console.warn('[establecimientosRepo] Aviso sincronizando con Firestore:', err)
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

export async function eliminarEstablecimiento(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM establecimientos WHERE id = ?", [id]);
  persistDb();
  SupabaseDotacionService.eliminarEstablecimiento(id).catch(err =>
    console.warn('[establecimientosRepo] Aviso eliminando en Supabase:', err)
  );
  FirebaseDotacionService.eliminarEstablecimiento(id).catch(err =>
    console.warn('[establecimientosRepo] Aviso eliminando en Firestore:', err)
  );
}