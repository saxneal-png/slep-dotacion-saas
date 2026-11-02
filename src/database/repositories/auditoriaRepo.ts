import { getDb, persistDb } from '../dbCore';
import { supabase, isSupabaseEnabled } from '../../services/supabaseClient';

export interface EventoAuditoria {
  id: string;
  rbd: string;
  periodo: number;
  tipoEvento: 'CREACION' | 'ACTUALIZACION' | 'ELIMINACION' | 'IMPORTACION' | 'TRASPASO' | 'PROYECCION' | 'REINICIO';
  entidad: 'DOCENTE' | 'CURSO' | 'SALA' | 'ASIGNACION' | 'ESTABLECIMIENTO' | 'DOTACION_COMPLETA';
  entidadId?: string;
  descripcion: string;
  detallesJson?: string;
  fechaHora: string;
}

export async function registrarEventoAuditoria(params: {
  rbd: string;
  periodo?: number;
  tipoEvento: 'CREACION' | 'ACTUALIZACION' | 'ELIMINACION' | 'IMPORTACION' | 'TRASPASO' | 'PROYECCION' | 'REINICIO';
  entidad: 'DOCENTE' | 'CURSO' | 'SALA' | 'ASIGNACION' | 'ESTABLECIMIENTO' | 'DOTACION_COMPLETA';
  entidadId?: string;
  descripcion: string;
  detalles?: any;
}): Promise<void> {
  try {
    const db = await getDb();
    const id = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const periodo = params.periodo ?? 2026;
    const fechaHora = new Date().toISOString();
    const detallesJson = params.detalles ? JSON.stringify(params.detalles) : null;

    db.run(
      `INSERT INTO auditoria_cambios (id, rbd, periodo, tipo_evento, entidad, entidad_id, descripcion, detalles_json, fecha_hora)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        id,
        params.rbd,
        periodo,
        params.tipoEvento,
        params.entidad,
        params.entidadId || null,
        params.descripcion,
        detallesJson,
        fechaHora
      ]
    );

    persistDb();

    if (isSupabaseEnabled()) {
      supabase.from('auditoria_cambios').insert({
        id,
        rbd: params.rbd,
        periodo,
        tipo_evento: params.tipoEvento,
        entidad: params.entidad,
        entidad_id: params.entidadId || null,
        descripcion: params.descripcion,
        detalles_json: params.detalles || null,
        fecha_hora: fechaHora
      }).then(() => {}, (err: any) => console.warn('[auditoriaRepo] Aviso guardando auditoría en Supabase:', err));
    }
  } catch (e) {
    console.warn('Error al registrar evento de auditoría:', e);
  }
}

export async function listarEventosAuditoria(
  rbd?: string,
  periodo: number = 2026,
  limit: number = 1000
): Promise<EventoAuditoria[]> {
  if (isSupabaseEnabled()) {
    try {
      let query = supabase.from('auditoria_cambios').select('*');
      if (rbd) {
        query = query.eq('rbd', rbd);
      }
      query = query.eq('periodo', periodo).order('fecha_hora', { ascending: false });
      if (limit > 0) {
        query = query.limit(limit);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map((row: any) => ({
          id: row.id,
          rbd: row.rbd,
          periodo: Number(row.periodo || periodo),
          tipoEvento: row.tipo_evento,
          entidad: row.entidad,
          entidadId: row.entidad_id || undefined,
          descripcion: row.descripcion,
          detallesJson: typeof row.detalles_json === 'string' ? row.detalles_json : JSON.stringify(row.detalles_json),
          fechaHora: row.fecha_hora
        }));
      }
    } catch (_) {}
  }

  try {
    const db = await getDb();
    let query = `
      SELECT id, rbd, periodo, tipo_evento, entidad, entidad_id, descripcion, detalles_json, fecha_hora
      FROM auditoria_cambios
    `;
    const params: any[] = [];

    if (rbd) {
      query += ` WHERE rbd = ? AND (periodo = ? OR periodo IS NULL)`;
      params.push(rbd, periodo);
    } else {
      query += ` WHERE (periodo = ? OR periodo IS NULL)`;
      params.push(periodo);
    }

    if (limit > 0) {
      query += ` ORDER BY fecha_hora DESC, rowid DESC LIMIT ?;`;
      params.push(limit);
    } else {
      query += ` ORDER BY fecha_hora DESC, rowid DESC;`;
    }

    const res = db.exec(query, params);
    if (!res.length) return [];

    return res[0].values.map(row => ({
      id: String(row[0]),
      rbd: String(row[1]),
      periodo: Number(row[2] || 2026),
      tipoEvento: row[3] as any,
      entidad: row[4] as any,
      entidadId: row[5] ? String(row[5]) : undefined,
      descripcion: String(row[6]),
      detallesJson: row[7] ? String(row[7]) : undefined,
      fechaHora: String(row[8])
    }));
  } catch (e) {
    console.warn('Error al listar eventos de auditoría:', e);
    return [];
  }
}
