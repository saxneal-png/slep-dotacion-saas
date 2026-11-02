const { createClient } = require('@supabase/supabase-js');
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rvvyjfgiwalqsdtpidxz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function resetDotacion() {
  console.log('================================================================');
  console.log('🧹 INICIANDO LIMPIEZA TOTAL DE DATOS DE ESCUELAS PARA DOTACIÓN 2027');
  console.log('================================================================');
  console.log('📡 Conectando a Supabase Cloud...');

  // 1. Verificar conteo previo en Supabase
  const tablesToClear = [
    'asignaciones_horarias',
    'cursos_sae',
    'docentes',
    'asistentes_educacion',
    'salas_infraestructura'
  ];

  console.log('\n📊 Estado previo en Supabase Cloud:');
  for (const t of tablesToClear) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(` - ${t}: ${count} registros`);
  }

  // 2. Ejecutar borrado en Supabase en orden de integridad referencial
  // En Supabase, para hacer DELETE sin WHERE id = x masivo, usamos .neq('id', '___no_match___')
  console.log('\n🗑️  Borrando datos en Supabase Cloud...');
  for (const t of tablesToClear) {
    const { error, count } = await supabase
      .from(t)
      .delete({ count: 'exact' })
      .neq('id', '___non_existent_id___');

    if (error) {
      console.error(`❌ Error borrando ${t} en Supabase:`, error.message);
      throw error;
    }
    console.log(` ✅ ${t} eliminado: ${count ?? 'OK'}`);
  }

  // 3. Verificar estado post-borrado en Supabase
  console.log('\n📊 Verificación en Supabase Cloud post-limpieza:');
  for (const t of tablesToClear) {
    const { count } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(` - ${t}: ${count} registros`);
  }

  // Verificar que usuarios, roles, carteras y establecimientos queden INTACTOS
  const { count: countUsuarios } = await supabase.from('usuarios_sistema').select('*', { count: 'exact', head: true });
  const { count: countCartera } = await supabase.from('asesor_cartera').select('*', { count: 'exact', head: true });
  const { count: countEstablecimientos } = await supabase.from('establecimientos').select('*', { count: 'exact', head: true });
  const { count: countPlanes } = await supabase.from('planes_estudio_mineduc').select('*', { count: 'exact', head: true });

  console.log('\n🔒 Verificación de entidades preservadas en Supabase Cloud:');
  console.log(` - usuarios_sistema: ${countUsuarios} (PRESERVADOS)`);
  console.log(` - asesor_cartera: ${countCartera} (PRESERVADOS)`);
  console.log(` - establecimientos: ${countEstablecimientos} (PRESERVADOS)`);
  console.log(` - planes_estudio_mineduc: ${countPlanes} (PRESERVADOS)`);

  // 4. Limpieza en base SQLite local (database/extracted_local_database.sqlite)
  const sqlitePath = path.join(__dirname, '..', 'database', 'extracted_local_database.sqlite');
  if (fs.existsSync(sqlitePath)) {
    console.log('\n🧹 Limpiando SQLite local (extracted_local_database.sqlite)...');
    const SQL = await initSqlJs();
    const dbBuffer = fs.readFileSync(sqlitePath);
    const db = new SQL.Database(dbBuffer);

    db.run("BEGIN TRANSACTION;");
    try {
      db.run("DELETE FROM asignaciones_horarias;");
      db.run("DELETE FROM cursos_sae;");
      db.run("DELETE FROM docentes;");
      db.run("DELETE FROM asistentes_educacion;");
      db.run("DELETE FROM salas_infraestructura;");
      db.run("COMMIT;");
      console.log(' ✅ Tablas de dotación y escuelas vaciadas en SQLite local.');
    } catch (err) {
      db.run("ROLLBACK;");
      throw err;
    }

    const exportedBytes = db.export();
    fs.writeFileSync(sqlitePath, Buffer.from(exportedBytes));
    console.log(' ✅ Archivo SQLite guardado y sincronizado con éxito.');

    // Verificación SQLite
    for (const t of tablesToClear) {
      const res = db.exec(`SELECT count(*) FROM ${t}`);
      console.log(` - SQLite ${t}: ${res[0]?.values[0]?.[0]} registros`);
    }
  }

  console.log('\n================================================================');
  console.log('✨ LIMPIEZA COMPLETADA CON ÉXITO: LISTO PARA DOTACIÓN 2027 EN LIMPIO');
  console.log('================================================================\n');
}

resetDotacion().catch(err => {
  console.error('Fatal error en limpieza:', err);
  process.exit(1);
});
