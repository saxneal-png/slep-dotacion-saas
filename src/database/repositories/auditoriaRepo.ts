import { getDb, persistDb } from '../dbCore';

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
  } catch (e) {
    console.warn('Error al registrar evento de auditoría:', e);
  }
}

export async function listarEventosAuditoria(
  rbd?: string,
  periodo: number = 2026,
  limit: number = 100
): Promise<EventoAuditoria[]> {
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

    query += ` ORDER BY fecha_hora DESC, rowid DESC LIMIT ?;`;
    params.push(limit);

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
