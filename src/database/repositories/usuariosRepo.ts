import { UsuarioSistema } from '../../types/authTypes';
import { getDb, persistDb } from '../dbCore';
import { normalizarRol } from '../../security/rolesDefinitions';

export async function listarUsuariosDb(): Promise<UsuarioSistema[]> {
  try {
    const db = await getDb();
    const res = db.exec(`
      SELECT id, username, email, nombre_completo, role, cargo, rbd_asignado,
             cartera_rbds_json, asesores_supervisados_json, comunas_permitidas_json,
             password_hash, salt, gemini_api_key, activo, ultimo_acceso
      FROM usuarios_sistema
      ORDER BY nombre_completo ASC
    `);
    if (!res.length) return [];
    return res[0].values.map(row => {
      let carteraRbds: string[] = [];
      let asesoresSupervisados: string[] = [];
      let comunasPermitidas: string[] | undefined = undefined;
      if (row[7]) {
        try { carteraRbds = JSON.parse(String(row[7])); } catch {}
      }
      if (row[8]) {
        try { asesoresSupervisados = JSON.parse(String(row[8])); } catch {}
      }
      if (row[9]) {
        try { comunasPermitidas = JSON.parse(String(row[9])); } catch {}
      }
      return {
        id: String(row[0]),
        username: String(row[1]),
        email: row[2] ? String(row[2]) : String(row[1]),
        nombreCompleto: String(row[3]),
        role: normalizarRol(row[4]),
        cargo: row[5] ? String(row[5]) : 'Funcionario SLEP',
        rbdAsignado: row[6] ? String(row[6]) : undefined,
        carteraRbds,
        asesoresSupervisados,
        comunasPermitidas,
        passwordHash: row[10] ? String(row[10]) : '',
        salt: row[11] ? String(row[11]) : '',
        geminiApiKey: row[12] ? String(row[12]) : undefined,
        activo: row[13] !== undefined && row[13] !== null ? Boolean(row[13]) : true,
        ultimoAcceso: row[14] ? String(row[14]) : undefined
      };
    });
  } catch (err) {
    console.warn('[usuariosRepo] Error listando usuarios desde SQLite:', err);
    return [];
  }
}

export async function guardarUsuarioDb(u: UsuarioSistema): Promise<void> {
  try {
    const db = await getDb();
    const carteraJson = u.carteraRbds && u.carteraRbds.length ? JSON.stringify(u.carteraRbds) : null;
    const asesoresJson = u.asesoresSupervisados && u.asesoresSupervisados.length ? JSON.stringify(u.asesoresSupervisados) : null;
    const comunasJson = u.comunasPermitidas && u.comunasPermitidas.length ? JSON.stringify(u.comunasPermitidas) : null;

    db.run(`
      INSERT INTO usuarios_sistema (
        id, username, email, nombre_completo, role, cargo, rbd_asignado,
        cartera_rbds_json, asesores_supervisados_json, comunas_permitidas_json,
        password_hash, salt, gemini_api_key, activo, ultimo_acceso
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        username=excluded.username,
        email=excluded.email,
        nombre_completo=excluded.nombre_completo,
        role=excluded.role,
        cargo=excluded.cargo,
        rbd_asignado=excluded.rbd_asignado,
        cartera_rbds_json=excluded.cartera_rbds_json,
        asesores_supervisados_json=excluded.asesores_supervisados_json,
        comunas_permitidas_json=excluded.comunas_permitidas_json,
        password_hash=excluded.password_hash,
        salt=excluded.salt,
        gemini_api_key=excluded.gemini_api_key,
        activo=excluded.activo,
        ultimo_acceso=excluded.ultimo_acceso;
    `, [
      u.id,
      u.username,
      u.email || null,
      u.nombreCompleto,
      u.role,
      u.cargo || null,
      u.rbdAsignado || null,
      carteraJson,
      asesoresJson,
      comunasJson,
      u.passwordHash || null,
      u.salt || null,
      u.geminiApiKey || null,
      u.activo !== false ? 1 : 0,
      u.ultimoAcceso || null
    ]);
    await persistDb();
  } catch (err) {
    console.warn('[usuariosRepo] Error guardando usuario en SQLite:', err);
  }
}

export async function guardarUsuariosBatchDb(usuarios: UsuarioSistema[]): Promise<void> {
  if (!usuarios.length) return;
  try {
    const db = await getDb();
    db.run("BEGIN TRANSACTION;");
    try {
      for (const u of usuarios) {
        const carteraJson = u.carteraRbds && u.carteraRbds.length ? JSON.stringify(u.carteraRbds) : null;
        const asesoresJson = u.asesoresSupervisados && u.asesoresSupervisados.length ? JSON.stringify(u.asesoresSupervisados) : null;
        const comunasJson = u.comunasPermitidas && u.comunasPermitidas.length ? JSON.stringify(u.comunasPermitidas) : null;

        db.run(`
          INSERT INTO usuarios_sistema (
            id, username, email, nombre_completo, role, cargo, rbd_asignado,
            cartera_rbds_json, asesores_supervisados_json, comunas_permitidas_json,
            password_hash, salt, gemini_api_key, activo, ultimo_acceso
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            username=excluded.username,
            email=excluded.email,
            nombre_completo=excluded.nombre_completo,
            role=excluded.role,
            cargo=excluded.cargo,
            rbd_asignado=excluded.rbd_asignado,
            cartera_rbds_json=excluded.cartera_rbds_json,
            asesores_supervisados_json=excluded.asesores_supervisados_json,
            comunas_permitidas_json=excluded.comunas_permitidas_json,
            password_hash=excluded.password_hash,
            salt=excluded.salt,
            gemini_api_key=excluded.gemini_api_key,
            activo=excluded.activo,
            ultimo_acceso=excluded.ultimo_acceso;
        `, [
          u.id,
          u.username,
          u.email || null,
          u.nombreCompleto,
          u.role,
          u.cargo || null,
          u.rbdAsignado || null,
          carteraJson,
          asesoresJson,
          comunasJson,
          u.passwordHash || null,
          u.salt || null,
          u.geminiApiKey || null,
          u.activo !== false ? 1 : 0,
          u.ultimoAcceso || null
        ]);
      }
      db.run("COMMIT;");
      await persistDb();
    } catch (txErr) {
      db.run("ROLLBACK;");
      throw txErr;
    }
  } catch (err) {
    console.warn('[usuariosRepo] Error guardando lote de usuarios en SQLite:', err);
  }
}

export async function eliminarUsuarioDb(id: string): Promise<void> {
  try {
    const db = await getDb();
    db.run("DELETE FROM usuarios_sistema WHERE id = ?", [id]);
    await persistDb();
  } catch (err) {
    console.warn('[usuariosRepo] Error eliminando usuario de SQLite:', err);
  }
}
