import { UsuarioSistema } from '../../types/authTypes';
import { getDb, persistDb } from '../dbCore';
import { normalizarRol } from '../../security/rolesDefinitions';
import { supabase, isSupabaseEnabled } from '../../services/supabaseClient';
import { SupabaseDotacionService } from '../../services/supabaseDotacionService';

export function parseJsonArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(v => String(v).trim()).filter(v => Boolean(v) && v !== 'S/RBD');
  }
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(v => Boolean(v) && v !== 'S/RBD');
      }
      if (typeof parsed === 'string') {
        const parsed2 = JSON.parse(parsed);
        if (Array.isArray(parsed2)) {
          return parsed2.map(v => String(v).trim()).filter(v => Boolean(v) && v !== 'S/RBD');
        }
      }
    } catch {}
  }
  return [];
}

function sanitizeRbdAsignado(rbd?: string | null): string | null {
  if (!rbd) return null;
  const clean = String(rbd).trim();
  if (!clean || clean.toUpperCase() === 'S/RBD' || clean.toLowerCase() === 'null') {
    return null;
  }
  return clean;
}

export async function listarUsuariosDb(): Promise<UsuarioSistema[]> {
  try {
    const db = await getDb();
    const res = db.exec(`
      SELECT id, username, email, nombre_completo, role, cargo, rbd_asignado,
             cartera_rbds_json, asesores_supervisados_json, comunas_permitidas_json,
             password_hash, salt, gemini_api_key, activo, ultimo_acceso, debe_cambiar_password
      FROM usuarios_sistema
      ORDER BY nombre_completo ASC
    `);
    if (!res.length) return [];
    return res[0].values.map(row => {
      const carteraRbds = parseJsonArray(row[7]);
      const asesoresSupervisados = parseJsonArray(row[8]);
      const comunasArr = parseJsonArray(row[9]);
      const comunasPermitidas = comunasArr.length > 0 ? comunasArr : undefined;
      return {
        id: String(row[0]),
        username: String(row[1]),
        email: row[2] ? String(row[2]) : String(row[1]),
        nombreCompleto: String(row[3]),
        role: normalizarRol(row[4]),
        cargo: row[5] ? String(row[5]) : 'Funcionario SLEP',
        rbdAsignado: sanitizeRbdAsignado(row[6] ? String(row[6]) : null) || undefined,
        carteraRbds,
        asesoresSupervisados,
        comunasPermitidas,
        passwordHash: row[10] ? String(row[10]) : '',
        salt: row[11] ? String(row[11]) : '',
        geminiApiKey: row[12] ? String(row[12]) : undefined,
        activo: row[13] !== undefined && row[13] !== null ? Boolean(row[13]) : true,
        ultimoAcceso: row[14] ? String(row[14]) : undefined,
        debeCambiarPassword: row[15] !== undefined && row[15] !== null ? Boolean(row[15]) : false
      };
    });
  } catch (err) {
    console.warn('[usuariosRepo] Error listando usuarios desde SQLite:', err);
    return [];
  }
}

export async function guardarUsuarioDb(u: UsuarioSistema, skipCloudSync: boolean = false): Promise<void> {
  const carteraArr = (u.carteraRbds || []).map(r => String(r).trim()).filter(r => Boolean(r) && r !== 'S/RBD');
  const asesoresArr = (u.asesoresSupervisados || []).map(a => String(a).trim()).filter(Boolean);
  const comunasArr = (u.comunasPermitidas || []).map(c => String(c).trim()).filter(Boolean);

  const carteraJson = JSON.stringify(carteraArr);
  const asesoresJson = JSON.stringify(asesoresArr);
  const comunasJson = JSON.stringify(comunasArr);
  const rbdClean = sanitizeRbdAsignado(u.rbdAsignado);
  const usernameClean = (u.username || u.email || u.id).trim().toLowerCase();
  const emailClean = u.email ? u.email.trim().toLowerCase() : null;

  try {
    const db = await getDb();
    db.run(`
      INSERT INTO usuarios_sistema (
        id, username, email, nombre_completo, role, cargo, rbd_asignado,
        cartera_rbds_json, asesores_supervisados_json, comunas_permitidas_json,
        password_hash, salt, gemini_api_key, activo, ultimo_acceso, debe_cambiar_password
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        ultimo_acceso=excluded.ultimo_acceso,
        debe_cambiar_password=excluded.debe_cambiar_password;
    `, [
      u.id,
      usernameClean,
      emailClean,
      u.nombreCompleto,
      u.role,
      u.cargo || null,
      rbdClean,
      carteraJson,
      asesoresJson,
      comunasJson,
      u.passwordHash || null,
      u.salt || null,
      u.geminiApiKey || null,
      u.activo !== false ? 1 : 0,
      u.ultimoAcceso || null,
      u.debeCambiarPassword ? 1 : 0
    ]);
    await persistDb();
  } catch (err) {
    console.warn('[usuariosRepo] Error guardando usuario en SQLite:', err);
  }

  if (!skipCloudSync && isSupabaseEnabled()) {
    // Asegurar que el establecimiento referenciado en rbd_asignado exista en Supabase
    if (rbdClean) {
      await SupabaseDotacionService.asegurarEstablecimientosExisten([rbdClean]);
    }

    const payload: Record<string, any> = {
      id: u.id,
      username: usernameClean,
      email: emailClean,
      nombre_completo: u.nombreCompleto,
      role: u.role,
      cargo: u.cargo || null,
      rbd_asignado: rbdClean,
      cartera_rbds_json: carteraJson,
      asesores_supervisados_json: asesoresJson,
      comunas_permitidas_json: comunasJson,
      password_hash: u.passwordHash || null,
      salt: u.salt || null,
      gemini_api_key: u.geminiApiKey || null,
      activo: u.activo !== false,
      ultimo_acceso: u.ultimoAcceso || null,
      debe_cambiar_password: u.debeCambiarPassword ?? false,
      updated_at: new Date().toISOString()
    };

    let { error } = await supabase
      .from('usuarios_sistema')
      .upsert(payload, { onConflict: 'id' });

    // Si falla por UNIQUE constraint en username o email (23505) debido a un registro con otro ID en Supabase
    if (error && error.code === '23505') {
      try {
        if (emailClean) {
          await supabase
            .from('usuarios_sistema')
            .delete()
            .eq('email', emailClean)
            .neq('id', u.id);
        }
        await supabase
          .from('usuarios_sistema')
          .delete()
          .eq('username', usernameClean)
          .neq('id', u.id);

        const retry = await supabase
          .from('usuarios_sistema')
          .upsert(payload, { onConflict: 'id' });
        error = retry.error;
      } catch (conflictErr) {
        console.warn('[usuariosRepo] Aviso resolviendo conflicto UNIQUE en Supabase:', conflictErr);
      }
    }

    // Si falla por FK constraint en rbd_asignado (23503), reintentar con rbd_asignado = null
    if (error && error.code === '23503') {
      const retryFk = await supabase
        .from('usuarios_sistema')
        .upsert({ ...payload, rbd_asignado: null }, { onConflict: 'id' });
      error = retryFk.error;
    }

    if (error) {
      console.error('[usuariosRepo] Error guardando usuario en Supabase:', error);
      throw new Error(`No se pudo guardar el usuario en Supabase: ${error.message}`);
    }

    // Sincronizar tabla relacional asesor_cartera en Supabase
    try {
      await supabase.from('asesor_cartera').delete().eq('usuario_id', u.id);
      if ((u.role === 'asesor_uatp' || u.role === 'coordinador_uatp') && carteraArr.length > 0) {
        await SupabaseDotacionService.asegurarEstablecimientosExisten(carteraArr);
        const rowsCartera = carteraArr.map(rbd => ({
          usuario_id: u.id,
          rbd,
          rol_asignacion: u.role === 'coordinador_uatp' ? 'COORDINADOR' : 'TITULAR'
        }));
        await supabase.from('asesor_cartera').upsert(rowsCartera, { onConflict: 'usuario_id,rbd' });
      }
    } catch (carteraErr) {
      console.warn('[usuariosRepo] Aviso sincronizando asesor_cartera en Supabase:', carteraErr);
    }
  }
}

export async function guardarUsuariosBatchDb(usuarios: UsuarioSistema[], skipCloudSync: boolean = false): Promise<void> {
  if (!usuarios.length) return;
  try {
    const db = await getDb();
    db.run("BEGIN TRANSACTION;");
    try {
      for (const u of usuarios) {
        const carteraArr = (u.carteraRbds || []).map(r => String(r).trim()).filter(r => Boolean(r) && r !== 'S/RBD');
        const asesoresArr = (u.asesoresSupervisados || []).map(a => String(a).trim()).filter(Boolean);
        const comunasArr = (u.comunasPermitidas || []).map(c => String(c).trim()).filter(Boolean);

        const carteraJson = JSON.stringify(carteraArr);
        const asesoresJson = JSON.stringify(asesoresArr);
        const comunasJson = JSON.stringify(comunasArr);
        const rbdClean = sanitizeRbdAsignado(u.rbdAsignado);

        db.run(`
          INSERT INTO usuarios_sistema (
            id, username, email, nombre_completo, role, cargo, rbd_asignado,
            cartera_rbds_json, asesores_supervisados_json, comunas_permitidas_json,
            password_hash, salt, gemini_api_key, activo, ultimo_acceso, debe_cambiar_password
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
            ultimo_acceso=excluded.ultimo_acceso,
            debe_cambiar_password=excluded.debe_cambiar_password;
        `, [
          u.id,
          (u.username || u.email || u.id).trim().toLowerCase(),
          u.email ? u.email.trim().toLowerCase() : null,
          u.nombreCompleto,
          u.role,
          u.cargo || null,
          rbdClean,
          carteraJson,
          asesoresJson,
          comunasJson,
          u.passwordHash || null,
          u.salt || null,
          u.geminiApiKey || null,
          u.activo !== false ? 1 : 0,
          u.ultimoAcceso || null,
          u.debeCambiarPassword ? 1 : 0
        ]);
      }
      db.run("COMMIT;");
      await persistDb();

      if (!skipCloudSync && isSupabaseEnabled()) {
        const seenEmails = new Set<string>();
        const seenUsernames = new Set<string>();
        const usersDb = usuarios.map(u => {
          let emailVal = u.email ? u.email.trim().toLowerCase() : null;
          if (emailVal && seenEmails.has(emailVal)) {
            emailVal = null;
          } else if (emailVal) {
            seenEmails.add(emailVal);
          }

          let usernameVal = (u.username || u.email || u.id).trim().toLowerCase();
          if (seenUsernames.has(usernameVal)) {
            usernameVal = `${usernameVal}_${u.id}`;
          }
          seenUsernames.add(usernameVal);

          const carteraArr = (u.carteraRbds || []).map(r => String(r).trim()).filter(r => Boolean(r) && r !== 'S/RBD');
          const asesoresArr = (u.asesoresSupervisados || []).map(a => String(a).trim()).filter(Boolean);
          const comunasArr = (u.comunasPermitidas || []).map(c => String(c).trim()).filter(Boolean);

          return {
            id: u.id,
            username: usernameVal,
            email: emailVal,
            nombre_completo: u.nombreCompleto,
            role: u.role,
            cargo: u.cargo || null,
            rbd_asignado: sanitizeRbdAsignado(u.rbdAsignado),
            cartera_rbds_json: JSON.stringify(carteraArr),
            asesores_supervisados_json: JSON.stringify(asesoresArr),
            comunas_permitidas_json: JSON.stringify(comunasArr),
            password_hash: u.passwordHash || null,
            salt: u.salt || null,
            gemini_api_key: u.geminiApiKey || null,
            activo: u.activo !== false,
            ultimo_acceso: u.ultimoAcceso || null,
            debe_cambiar_password: u.debeCambiarPassword ?? false,
            updated_at: new Date().toISOString()
          };
        });

        // Subir en bloques de 100 esperando su finalización real
        try {
          for (let i = 0; i < usersDb.length; i += 100) {
            const chunk = usersDb.slice(i, i + 100);
            const { error } = await supabase.from('usuarios_sistema').upsert(chunk, { onConflict: 'id' });
            if (error) {
              console.warn('[usuariosRepo] Aviso sincronizando bloque de usuarios en Supabase:', error);
            }
          }
        } catch (err) {
          console.warn('[usuariosRepo] Aviso sincronizando lote en Supabase:', err);
        }
      }
    } catch (txErr) {
      db.run("ROLLBACK;");
      throw txErr;
    }
  } catch (err) {
    console.warn('[usuariosRepo] Error guardando lote de usuarios en SQLite:', err);
  }
}

export async function eliminarUsuarioDb(id: string, skipCloudSync: boolean = false): Promise<void> {
  try {
    const db = await getDb();
    db.run("DELETE FROM usuarios_sistema WHERE id = ?", [id]);
    await persistDb();
  } catch (err) {
    console.warn('[usuariosRepo] Error eliminando usuario de SQLite:', err);
  }

  if (!skipCloudSync && isSupabaseEnabled()) {
    try {
      await supabase.from('asesor_cartera').delete().eq('usuario_id', id);
    } catch {}
    const { error } = await supabase.from('usuarios_sistema').delete().eq('id', id);
    if (error) {
      console.error('[usuariosRepo] Error eliminando usuario de Supabase:', error);
      throw new Error(`No se pudo eliminar el usuario en Supabase: ${error.message}`);
    }
  }
}
