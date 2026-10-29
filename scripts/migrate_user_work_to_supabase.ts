import fs from 'fs';
import initSqlJs from 'sql.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rvvyjfgiwalqsdtpidxz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runMigrateUserWork() {
  console.log('========================================================================');
  console.log('🌟 MIGRACIÓN MAESTRA DE DATOS DE TRABAJO (LOCAL / INDEXEDDB / FIRESTORE)');
  console.log('📡 Destino Supabase: ' + SUPABASE_URL);
  console.log('========================================================================\n');

  // 1. Cargar Base de Datos Local SQLite
  const sqliteFile = 'database/extracted_local_database.sqlite';
  if (!fs.existsSync(sqliteFile)) {
    throw new Error('No se encontró el archivo: ' + sqliteFile);
  }
  const fileBytes = fs.readFileSync(sqliteFile);
  const SQL = await initSqlJs();
  const db = new SQL.Database(fileBytes);

  function getRows(sqlQuery: string) {
    const res = db.exec(sqlQuery);
    if (!res.length) return [];
    const columns = res[0].columns;
    return res[0].values.map(row => {
      const obj: Record<string, any> = {};
      columns.forEach((col, idx) => {
        obj[col] = row[idx];
      });
      return obj;
    });
  }

  // 2. Establecimientos
  console.log('--- 1. Migrando Establecimientos Educacionales ---');
  const establecimientosRows = getRows('SELECT * FROM establecimientos;');
  const estPayload = establecimientosRows.map(e => ({
    rbd: String(e.rbd).trim(),
    id: e.id || `est-${String(e.rbd).trim()}`,
    nombre: e.nombre,
    comuna: e.comuna,
    tipo: e.tipo || (e.nombre.toLowerCase().includes('liceo') ? 'LICEO' : e.nombre.toLowerCase().includes('jardin') ? 'JARDIN' : 'ESCUELA'),
    regimen: e.regimen || 'JEC',
    porcentaje_prioritarios: Number(e.porcentaje_prioritarios ?? 75),
    director: e.director || null,
    asesor_uatp: e.asesor_uatp || null,
    telefono: e.telefono || null,
    email: e.email || null,
    subvencion_sep_mensual: Number(e.subvencion_sep_mensual || 0),
    subvencion_pro_retencion: Number(e.subvencion_pro_retencion || 0),
    cupo_horas_pie_diferencial: Number(e.cupo_horas_pie_diferencial || 0),
    cupo_horas_pie_asistentes: Number(e.cupo_horas_pie_asistentes || 0),
    estado_planificacion: e.estado_planificacion || 'BORRADOR'
  }));

  for (let i = 0; i < estPayload.length; i += 100) {
    const chunk = estPayload.slice(i, i + 100);
    const { error } = await supabase.from('establecimientos').upsert(chunk, { onConflict: 'rbd' });
    if (error) console.error('Error en lote establecimientos:', error);
  }
  console.log(`✅ ${estPayload.length} Establecimientos migrados.`);

  // 3. Salas de Infraestructura
  console.log('\n--- 2. Migrando Salas de Infraestructura ---');
  const salasRows = getRows('SELECT * FROM salas_infraestructura;');
  const salasPayload = salasRows.map(s => ({
    id: s.id,
    rbd: String(s.rbd).trim(),
    pabellon: s.pabellon || null,
    nombre_sala: s.nombre_sala,
    superficie_m2: Number(s.superficie_m2 || 45),
    tipo: s.tipo || 'REGULAR',
    aforo_maximo: Number(s.aforo_maximo || 35)
  }));
  if (salasPayload.length) {
    const { error } = await supabase.from('salas_infraestructura').upsert(salasPayload, { onConflict: 'id' });
    if (error) console.error('Error salas:', error);
  }
  console.log(`✅ ${salasPayload.length} Salas migradas.`);

  // 4. Planes de Estudio MINEDUC
  console.log('\n--- 3. Migrando Planes de Estudio MINEDUC ---');
  const planesRows = getRows('SELECT * FROM planes_estudio_mineduc;');
  const planesPayload = planesRows.map(p => {
    let asigs: any = [];
    try {
      asigs = typeof p.asignaturas_json === 'string' ? JSON.parse(p.asignaturas_json) : (p.asignaturas_json || []);
    } catch (_) {}
    return {
      id: p.id,
      nivel: p.nivel,
      regimen: p.regimen,
      categoria: p.categoria || 'BASICA',
      referencia_fuente: p.referencia_fuente || 'MINEDUC',
      horas_obligatorias: Number(p.horas_obligatorias || 0),
      horas_libre_disposicion: Number(p.horas_libre_disposicion || 0),
      total_horas_plan: Number(p.total_horas_plan || 0),
      asignaturas_json: asigs
    };
  });
  for (let i = 0; i < planesPayload.length; i += 100) {
    const chunk = planesPayload.slice(i, i + 100);
    const { error } = await supabase.from('planes_estudio_mineduc').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error planes:', error);
  }
  console.log(`✅ ${planesPayload.length} Planes de Estudio migrados.`);

  // 5. Cursos SAE
  console.log('\n--- 4. Migrando Cursos SAE ---');
  const cursosRows = getRows('SELECT * FROM cursos_sae;');
  const cursosPayload = cursosRows.map(c => {
    let talleres: any = [];
    let grados: any = [];
    try {
      talleres = typeof c.talleres_jec_json === 'string' ? JSON.parse(c.talleres_jec_json) : (c.talleres_jec_json || []);
    } catch (_) {}
    try {
      grados = typeof c.grados_combinados_json === 'string' ? JSON.parse(c.grados_combinados_json) : (c.grados_combinados_json || []);
    } catch (_) {}

    return {
      id: c.id,
      rbd: String(c.rbd).trim(),
      periodo: Number(c.periodo || 2026),
      nivel: c.nivel,
      letra: c.letra || 'A',
      regimen: c.regimen || 'JEC',
      regimen_proporcion: c.regimen_proporcion || '65_35',
      sala_id: c.sala_id || null,
      cupo_sae: Number(c.cupo_sae || 35),
      matricula_proyectada: Number(c.matricula_proyectada || 30),
      alumnos_neet: Number(c.alumnos_neet || 0),
      alumnos_neep: Number(c.alumnos_neep || 0),
      talleres_jec_json: talleres,
      es_multigrado: Boolean(c.es_multigrado),
      es_combinado: Boolean(c.es_combinado),
      tipo_modalidad: c.tipo_modalidad || 'REGULAR',
      grados_combinados_json: grados,
      especialidad_tp: c.especialidad_tp || null,
      plan_estudio_id: c.plan_estudio_id || null
    };
  });

  for (let i = 0; i < cursosPayload.length; i += 100) {
    const chunk = cursosPayload.slice(i, i + 100);
    const { error } = await supabase.from('cursos_sae').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error cursos chunk:', error);
  }
  console.log(`✅ ${cursosPayload.length} Cursos SAE migrados.`);

  // 6. Docentes
  console.log('\n--- 5. Migrando Docentes y Personal Ley 20.903 ---');
  const docentesRows = getRows('SELECT * FROM docentes;');
  const docentesPayload = docentesRows.map(d => {
    let funcionesNoAula: any = [];
    try {
      funcionesNoAula = typeof d.funciones_no_aula_json === 'string'
        ? JSON.parse(d.funciones_no_aula_json)
        : (d.funciones_no_aula_json || []);
    } catch (_) {}

    return {
      id: d.id,
      rbd: String(d.rbd).trim(),
      periodo: Number(d.periodo || 2026),
      run: String(d.run || '').trim(),
      nombres: d.nombres,
      apellidos: d.apellidos,
      titulo: d.titulo || null,
      calidad_juridica: d.calidad_juridica || 'TITULAR',
      estamento: d.estamento || 'DOCENTE_AULA',
      horas_contrato: Number(d.horas_contrato || 44),
      horas_subvencion_general_titular: Number(d.horas_subvencion_general_titular || 0),
      horas_subvencion_general_contrata: Number(d.horas_subvencion_general_contrata || 0),
      horas_sep_titular: Number(d.horas_sep_titular || 0),
      horas_sep_contrata: Number(d.horas_sep_contrata || 0),
      horas_pie_titular: Number(d.horas_pie_titular || 0),
      horas_pie_contrata: Number(d.horas_pie_contrata || 0),
      horas_directivas: Number(d.horas_directivas || 0),
      horas_inspector_general: Number(d.horas_inspector_general || 0),
      horas_tecnico_pedagogica: Number(d.horas_tecnico_pedagogica || d.horas_tecnico_pedagogicas || 0),
      horas_coordinacion: Number(d.horas_coordinacion || 0),
      tipo_coordinacion: d.tipo_coordinacion || null,
      horas_taller_sep: Number(d.horas_taller_sep || 0),
      horas_trabajo_colaborativo: Number(d.horas_trabajo_colaborativo || 0),
      horas_coordinacion_pie: Number(d.horas_coordinacion_pie || 0),
      horas_convivencia_escolar: Number(d.horas_convivencia_escolar || 0),
      horas_extraescolar: Number(d.horas_extraescolar || 0),
      cargo_institucional: d.cargo_institucional || null,
      horas_aula: Number(d.horas_aula || 0),
      horas_ingles: Number(d.horas_ingles || 0),
      funcion_principal: d.funcion_principal || null,
      funcion_secundaria: d.funcion_secundaria || null,
      asignatura_principal: d.asignatura_principal || null,
      aplica_articulo_69: Boolean(d.aplica_articulo_69),
      funciones_no_aula_json: funcionesNoAula,
      horas_vigentes_anterior: Number(d.horas_vigentes_anterior || 0),
      propuesta_gdp: d.propuesta_gdp || 'Continuidad',
      remuneracion_mensual_app: Number(d.remuneracion_mensual_app || 0),
      fecha_inicio_contrato: d.fecha_inicio_contrato || '2026-03-01',
      fecha_termino_contrato: d.fecha_termino_contrato || '2027-02-28',
      accion_pme_sep: d.accion_pme_sep || null,
      horas_pro_retencion: Number(d.horas_pro_retencion || 0),
      descripcion_funcion_gdp: d.descripcion_funcion_gdp || null,
      estado_sancion_gdp: d.estado_sancion_gdp || 'Pendiente',
      horas_aprobadas_gdp: Number(d.horas_aprobadas_gdp || 0),
      situacion_final_gdp: d.situacion_final_gdp || 'Vigente',
      observaciones_director: d.observaciones_director || null,
      observaciones_slep: d.observaciones_slep || null
    };
  });

  for (let i = 0; i < docentesPayload.length; i += 100) {
    const chunk = docentesPayload.slice(i, i + 100);
    const { error } = await supabase.from('docentes').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error docentes chunk:', error);
  }
  console.log(`✅ ${docentesPayload.length} Docentes migrados.`);

  // 7. Asignaciones Horarias
  console.log('\n--- 6. Migrando Asignaciones Horarias ---');
  const asigsRows = getRows('SELECT * FROM asignaciones_horarias;');
  const asigsPayload = asigsRows.map(a => {
    let compartidos: any = [];
    try {
      compartidos = typeof a.cursos_compartidos_json === 'string'
        ? JSON.parse(a.cursos_compartidos_json)
        : (a.cursos_compartidos_json || []);
    } catch (_) {}

    return {
      id: a.id,
      rbd: String(a.rbd).trim(),
      curso_id: a.curso_id,
      docente_id: a.docente_id,
      co_docente_id: a.co_docente_id || null,
      tiene_co_docente: Boolean(a.tiene_co_docente),
      es_taller_jec: Boolean(a.es_taller_jec),
      asignatura: a.asignatura || 'Sin Asignatura',
      horas_pedagogicas_aula: Number(a.horas_pedagogicas_aula || 0),
      horas_cronologicas_pie: Number(a.horas_cronologicas_pie || 0),
      horas_colaborativas: Number(a.horas_colaborativas || 0),
      tipo_apoyo: a.tipo_apoyo || null,
      periodo: Number(a.periodo || 2026),
      es_taller_sep: Boolean(a.es_taller_sep),
      es_trabajo_colaborativo: Boolean(a.es_trabajo_colaborativo),
      es_proporcion_docente: Boolean(a.es_proporcion_docente),
      es_co_docencia: Boolean(a.es_co_docencia),
      es_agrupacion_flexible: Boolean(a.es_agrupacion_flexible),
      cursos_compartidos_json: compartidos,
      es_diferenciado_compartido: Boolean(a.es_diferenciado_compartido)
    };
  });

  for (let i = 0; i < asigsPayload.length; i += 100) {
    const chunk = asigsPayload.slice(i, i + 100);
    const { error } = await supabase.from('asignaciones_horarias').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error asignaciones chunk:', error);
  }
  console.log(`✅ ${asigsPayload.length} Asignaciones Horarias migradas.`);

  // 8. Asistentes de la Educación
  console.log('\n--- 7. Migrando Asistentes de la Educación ---');
  const astRows = getRows('SELECT * FROM asistentes_educacion;');
  const astPayload = astRows.map(ast => ({
    id: ast.id,
    rbd: String(ast.rbd).trim(),
    periodo: Number(ast.periodo || 2026),
    run: String(ast.run || '').trim(),
    nombres: ast.nombres,
    apellidos: ast.apellidos,
    cargo_funcion: ast.cargo_funcion,
    estamento: ast.estamento,
    horas_contrato: Number(ast.horas_contrato || 44),
    horas_subvencion_general_indefinido: Number(ast.horas_subvencion_general_indefinido || 0),
    horas_subvencion_general_plazo_fijo: Number(ast.horas_subvencion_general_plazo_fijo || 0),
    horas_sep_indefinido: Number(ast.horas_sep_indefinido || 0),
    horas_sep_plazo_fijo: Number(ast.horas_sep_plazo_fijo || 0),
    horas_pie_indefinido: Number(ast.horas_pie_indefinido || 0),
    horas_pie_plazo_fijo: Number(ast.horas_pie_plazo_fijo || 0),
    es_dupla_psicosocial: Boolean(ast.es_dupla_psicosocial),
    es_equipo_pie: Boolean(ast.es_equipo_pie),
    es_tecnico_parvulo: Boolean(ast.es_tecnico_parvulo),
    es_auxiliar_servicio: Boolean(ast.es_auxiliar_servicio),
    es_inspector_patio: Boolean(ast.es_inspector_patio),
    observaciones: ast.observaciones || null,
    activo: ast.activo !== 0 && ast.activo !== false,
    horas_vigentes_anterior: Number(ast.horas_vigentes_anterior || 0),
    propuesta_gdp: ast.propuesta_gdp || 'Continuidad',
    remuneracion_mensual_app: Number(ast.remuneracion_mensual_app || 0),
    fecha_inicio_contrato: ast.fecha_inicio_contrato || '2026-03-01',
    fecha_termino_contrato: ast.fecha_termino_contrato || '2027-02-28',
    accion_pme_sep: ast.accion_pme_sep || null,
    horas_pro_retencion: Number(ast.horas_pro_retencion || 0),
    descripcion_funcion_gdp: ast.descripcion_funcion_gdp || null,
    estado_sancion_gdp: ast.estado_sancion_gdp || 'Pendiente',
    horas_aprobadas_gdp: Number(ast.horas_aprobadas_gdp || 0),
    situacion_final_gdp: ast.situacion_final_gdp || 'Vigente',
    observaciones_director: ast.observaciones_director || null,
    observaciones_slep: ast.observaciones_slep || null
  }));

  for (let i = 0; i < astPayload.length; i += 100) {
    const chunk = astPayload.slice(i, i + 100);
    const { error } = await supabase.from('asistentes_educacion').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error asistentes chunk:', error);
  }
  console.log(`✅ ${astPayload.length} Asistentes de la Educación migrados.`);

  // 9. Usuarios desde Firestore Dump
  console.log('\n--- 8. Migrando Usuarios desde Firebase Firestore ---');
  const firestoreUsers = JSON.parse(fs.readFileSync('database/firestore_users_dump.json', 'utf8'));
  const seenIds = new Set<string>();
  const seenUsernames = new Set<string>();
  const seenEmails = new Set<string>();
  const usersPayload: any[] = [];

  for (const u of firestoreUsers) {
    if (seenIds.has(u.id)) continue;
    seenIds.add(u.id);

    let uname = (u.username || u.email || u.id).trim().toLowerCase();
    if (seenUsernames.has(uname)) {
      uname = `${uname}_${u.id.substring(0, 6)}`;
    }
    seenUsernames.add(uname);

    let emailVal = u.email ? u.email.trim().toLowerCase() : null;
    if (emailVal && seenEmails.has(emailVal)) {
      emailVal = null; // evitar violación de unique constraint si hay duplicate email
    } else if (emailVal) {
      seenEmails.add(emailVal);
    }

    usersPayload.push({
      id: u.id,
      username: uname,
      email: emailVal,
      nombre_completo: u.nombreCompleto || u.username || 'Usuario SLEP',
      role: u.rol || 'director',
      cargo: u.cargo || null,
      rbd_asignado: u.rbdAsignado || null,
      cartera_rbds_json: u.carteraRbds || [],
      asesores_supervisados_json: u.asesoresSupervisados || [],
      comunas_permitidas_json: u.comunasPermitidas || [],
      password_hash: u.passwordHash || null,
      salt: u.salt || null,
      gemini_api_key: u.geminiApiKey || null,
      activo: u.activo !== false
    });
  }

  for (let i = 0; i < usersPayload.length; i += 100) {
    const chunk = usersPayload.slice(i, i + 100);
    const { error } = await supabase.from('usuarios_sistema').upsert(chunk, { onConflict: 'id' });
    if (error) console.error('Error usuarios chunk:', error);
  }
  console.log(`✅ ${usersPayload.length} Usuarios migrados desde Firestore.`);

  // 10. Cartera de Asesores
  console.log('\n--- 9. Sincronizando Cartera de Asesores UATP ---');
  const userIdsValidos = new Set(usersPayload.map(u => u.id));
  const rbdValidos = new Set(estPayload.map(e => e.rbd));
  const carteraInserts: Array<{ usuario_id: string; rbd: string }> = [];

  for (const u of firestoreUsers) {
    if (userIdsValidos.has(u.id) && Array.isArray(u.carteraRbds) && u.carteraRbds.length > 0) {
      for (const rbd of u.carteraRbds) {
        const cleanRbd = String(rbd).trim();
        if (rbdValidos.has(cleanRbd)) {
          carteraInserts.push({ usuario_id: u.id, rbd: cleanRbd });
        }
      }
    }
  }

  if (carteraInserts.length > 0) {
    for (let i = 0; i < carteraInserts.length; i += 100) {
      const chunk = carteraInserts.slice(i, i + 100);
      const { error } = await supabase.from('asesor_cartera').upsert(chunk, { onConflict: 'usuario_id,rbd' });
      if (error) console.error('Error asesor cartera chunk:', error);
    }
  }
  console.log(`✅ ${carteraInserts.length} Asignaciones de cartera sincronizadas.`);

  console.log('\n🎉 ¡MIGRACIÓN TOTAL DE INFORMACIÓN LOCAL Y FIRESTORE A SUPABASE FINALIZADA CON ÉXITO!');
}

runMigrateUserWork().catch(err => {
  console.error('💥 Error en migración de datos de trabajo:', err);
  process.exit(1);
});
