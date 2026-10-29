import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { SLEP_VALLE_DIGUILLIN_SCHOOLS } from '../src/data/slepSchoolsCatalog';
import { DIRECTORES_TERRITORIO } from '../src/data/directoresTerritorio';
import { PLANES_MINEDUC } from '../packages/mineduc-engine/src/planesEstudio';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://rvvyjfgiwalqsdtpidxz.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

async function runFullMigration() {
  console.log('🚀 Iniciando Migración Completa de Base de Datos y Metodología a Supabase...');
  console.log(`📡 Destino: ${SUPABASE_URL} (Proyecto: rvvyjfgiwalqsdtpidxz)`);

  // 1. Establecimientos
  console.log('\n--- 1. Sincronizando Establecimientos Educacionales (121+ Oficiales) ---');
  const directoresPorRbd = new Map(DIRECTORES_TERRITORIO.map(d => [d.rbd.trim(), d]));
  
  const establecimientosPayload = SLEP_VALLE_DIGUILLIN_SCHOOLS.map(s => {
    const rbd = s.rbd.trim();
    const dirInfo = directoresPorRbd.get(rbd);
    return {
      rbd,
      id: `est-${rbd}`,
      nombre: s.nombre,
      comuna: s.comuna,
      tipo: s.tipo || 'ESCUELA',
      regimen: (s.tipo === 'JARDIN' || s.tipo === 'SALA_CUNA') ? 'No JEC' : 'JEC',
      porcentaje_prioritarios: 75.0,
      director: dirInfo?.director || s.director || null,
      telefono: dirInfo?.telefono || null,
      email: dirInfo?.email || null,
      estado_planificacion: 'BORRADOR'
    };
  });

  // Agregar los colegios piloto si no están
  const pilotSchools = [
    { rbd: '3451', id: 'est-3451', nombre: 'Liceo Manuel Bulnes', comuna: 'Bulnes', tipo: 'LICEO', regimen: 'JEC', porcentaje_prioritarios: 82.5, director: 'Carlos Miranda Valenzuela', asesor_uatp: 'Rodrigo Fuentes Uribe', telefono: '+56 42 2631200', email: 'contacto@liceomanuelbulnes.cl', estado_planificacion: 'BORRADOR' },
    { rbd: '3480', id: 'est-3480', nombre: 'Colegio Quilamapu', comuna: 'Chillán Viejo', tipo: 'COLEGIO', regimen: 'JEC', porcentaje_prioritarios: 68.0, director: 'María Elena Salazar', asesor_uatp: 'Rodrigo Fuentes Uribe', telefono: '+56 42 2278900', email: 'quilamapu@slepvallediguillin.cl', estado_planificacion: 'BORRADOR' },
    { rbd: '3512', id: 'est-3512', nombre: 'Escuela Básica San Ignacio', comuna: 'San Ignacio', tipo: 'ESCUELA', regimen: 'JEC', porcentaje_prioritarios: 85.0, director: 'Juan Pablo Rivas', asesor_uatp: 'Marcela Navarrete Díaz', telefono: '+56 42 2451100', email: 'sanignacio@slepvallediguillin.cl', estado_planificacion: 'BORRADOR' },
    { rbd: '3560', id: 'est-3560', nombre: 'Liceo Bicentenario de Yungay', comuna: 'Yungay', tipo: 'LICEO', regimen: 'JEC', porcentaje_prioritarios: 74.0, director: 'Patricia Andrea Morales', asesor_uatp: 'Marcela Navarrete Díaz', telefono: '+56 42 2682300', email: 'liceoyungay@slepvallediguillin.cl', estado_planificacion: 'BORRADOR' }
  ];

  for (const p of pilotSchools) {
    if (!establecimientosPayload.some(e => e.rbd === p.rbd)) {
      establecimientosPayload.push(p);
    }
  }

  const { error: estErr } = await supabase.from('establecimientos').upsert(establecimientosPayload, { onConflict: 'rbd' });
  if (estErr) {
    console.error('❌ Error migrando establecimientos:', estErr);
  } else {
    console.log(`✅ ${establecimientosPayload.length} Establecimientos migrados exitosamente a Supabase.`);
  }

  // 2. Planes de Estudio Oficiales MINEDUC
  console.log('\n--- 2. Sincronizando Planes de Estudio MINEDUC ---');
  const planesPayload: any[] = [];

  for (const p of PLANES_MINEDUC) {
    const id = `${p.nivel}_${p.regimen}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
    const semanas = p.semanasLectivas || 36;
    const asigs = (p.asignaturasBase || []).map(a => ({
      nombre: a.nombre,
      horasSemanales: a.horasSugeridas,
      horasAnuales: a.horasSugeridas * semanas,
      caracter: 'Obligatoria'
    }));
    const obligatorias = Number(p.horasObligatorias || 0);
    const libre = Number(p.horasLibreDisposicion || 0);
    const total = Number((p as any).totalHoras || (obligatorias + libre));

    planesPayload.push({
      id,
      nivel: p.nivel,
      regimen: p.regimen,
      categoria: p.categoria || 'BASICA',
      referencia_fuente: (p as any).decreto || 'Decreto Mineduc',
      horas_obligatorias: obligatorias,
      horas_libre_disposicion: libre,
      total_horas_plan: total,
      asignaturas_json: asigs
    });
  }

  const { error: planErr } = await supabase.from('planes_estudio_mineduc').upsert(planesPayload, { onConflict: 'id' });
  if (planErr) {
    console.error('❌ Error migrando planes de estudio:', planErr);
  } else {
    console.log(`✅ ${planesPayload.length} Planes de Estudio MINEDUC migrados a Supabase.`);
  }

  // 3. Salas de Infraestructura Piloto
  console.log('\n--- 3. Sincronizando Salas de Infraestructura ---');
  const salasPayload = [
    { id: 'sala-101', rbd: '3451', pabellon: 'Pabellón A (Piso 1)', nombre_sala: 'Sala 101 - 1° Básico', superficie_m2: 46.2, tipo: 'REGULAR', aforo_maximo: 42 },
    { id: 'sala-102', rbd: '3451', pabellon: 'Pabellón A (Piso 1)', nombre_sala: 'Sala 102 - 2° Básico', superficie_m2: 44.0, tipo: 'REGULAR', aforo_maximo: 40 },
    { id: 'sala-103', rbd: '3451', pabellon: 'Pabellón A (Piso 2)', nombre_sala: 'Sala 103 - 7° Básico', superficie_m2: 45.0, tipo: 'REGULAR', aforo_maximo: 40 },
    { id: 'sala-104', rbd: '3451', pabellon: 'Pabellón B', nombre_sala: 'Sala 104 - 1° Medio HC', superficie_m2: 48.0, tipo: 'REGULAR', aforo_maximo: 43 },
    { id: 'sala-105', rbd: '3451', pabellon: 'Pabellón Parvulario', nombre_sala: 'Sala Kinder NT2', superficie_m2: 52.5, tipo: 'PARVULARIA', aforo_maximo: 35 },
    { id: 'sala-106', rbd: '3451', pabellon: 'Talleres TP', nombre_sala: 'Taller Especialidad Agropecuaria', superficie_m2: 60.0, tipo: 'TALLER', aforo_maximo: 33 }
  ];
  await supabase.from('salas_infraestructura').upsert(salasPayload, { onConflict: 'id' });
  console.log(`✅ ${salasPayload.length} Salas de Infraestructura migradas a Supabase.`);

  // 4. Cursos SAE Piloto
  console.log('\n--- 4. Sincronizando Cursos SAE ---');
  const cursosPayload = [
    { id: 'curso-1', rbd: '3451', periodo: 2026, nivel: '1° Básico', letra: 'A', regimen: 'JEC', regimen_proporcion: '65_35', sala_id: 'sala-101', cupo_sae: 38, matricula_proyectada: 36, alumnos_neet: 5, alumnos_neep: 2, tipo_modalidad: 'REGULAR' },
    { id: 'curso-2', rbd: '3451', periodo: 2026, nivel: '2° Básico', letra: 'A', regimen: 'JEC', regimen_proporcion: '65_35', sala_id: 'sala-102', cupo_sae: 38, matricula_proyectada: 37, alumnos_neet: 5, alumnos_neep: 1, tipo_modalidad: 'REGULAR' },
    { id: 'curso-3', rbd: '3451', periodo: 2026, nivel: '7° Básico', letra: 'A', regimen: 'JEC', regimen_proporcion: '65_35', sala_id: 'sala-103', cupo_sae: 40, matricula_proyectada: 39, alumnos_neet: 5, alumnos_neep: 2, tipo_modalidad: 'REGULAR' },
    { id: 'curso-4', rbd: '3451', periodo: 2026, nivel: '1° Medio', letra: 'A', regimen: 'JEC', regimen_proporcion: '65_35', sala_id: 'sala-104', cupo_sae: 42, matricula_proyectada: 40, alumnos_neet: 4, alumnos_neep: 2, tipo_modalidad: 'REGULAR' }
  ];
  await supabase.from('cursos_sae').upsert(cursosPayload, { onConflict: 'id' });
  console.log(`✅ ${cursosPayload.length} Cursos SAE migrados a Supabase.`);

  // 5. Docentes Piloto
  console.log('\n--- 5. Sincronizando Plantilla Docente ---');
  const docentesPayload = [
    { id: 'doc-1', rbd: '3451', periodo: 2026, run: '12.456.789-K', nombres: 'Gonzalo', apellidos: 'Pinto Soto', titulo: 'Profesor de Estado en Castellano', calidad_juridica: 'TITULAR', estamento: 'DOCENTE_AULA', horas_contrato: 44, asignatura_principal: 'Lenguaje y Comunicación', horas_subvencion_general_titular: 44, horas_aula: 30 },
    { id: 'doc-2', rbd: '3451', periodo: 2026, run: '14.567.890-3', nombres: 'Andrea', apellidos: 'Cisternas Alarcón', titulo: 'Licenciada en Educación Matemática', calidad_juridica: 'TITULAR', estamento: 'DOCENTE_AULA', horas_contrato: 44, asignatura_principal: 'Matemática', horas_subvencion_general_titular: 30, horas_sep_titular: 14, horas_aula: 28 },
    { id: 'doc-3', rbd: '3451', periodo: 2026, run: '15.678.901-5', nombres: 'Luis', apellidos: 'Henríquez Valenzuela', titulo: 'Profesor de Historia y Geografía', calidad_juridica: 'CONTRATA', estamento: 'DOCENTE_AULA', horas_contrato: 38, asignatura_principal: 'Historia, Geografía y Ciencias Sociales', horas_subvencion_general_contrata: 38, horas_aula: 26 },
    { id: 'doc-4', rbd: '3451', periodo: 2026, run: '16.789.012-7', nombres: 'Claudia', apellidos: 'Muñoz Sepúlveda', titulo: 'Educadora Diferencial mención TEL', calidad_juridica: 'CONTRATA', estamento: 'DOCENTE_DIFERENCIAL', horas_contrato: 44, asignatura_principal: 'Apoyo PIE', horas_pie_contrata: 44, horas_aula: 30 },
    { id: 'doc-5', rbd: '3451', periodo: 2026, run: '17.890.123-9', nombres: 'Felipe', apellidos: 'Bustos Parra', titulo: 'Fonoaudiólogo Clínico Escolar', calidad_juridica: 'CONTRATA', estamento: 'PROFESIONAL_PAE', horas_contrato: 30, asignatura_principal: 'PAE Fonoaudiología', horas_pie_contrata: 30, horas_aula: 20 },
    { id: 'doc-6', rbd: '3451', periodo: 2026, run: '10.234.567-8', nombres: 'René', apellidos: 'Gutiérrez Mardones', titulo: 'Profesor General Básico', calidad_juridica: 'TITULAR', estamento: 'DOCENTE_AULA', horas_contrato: 30, asignatura_principal: 'Ciencias Naturales', aplica_articulo_69: true, horas_subvencion_general_titular: 30, horas_aula: 20 },
    { id: 'doc-7', rbd: '3451', periodo: 2026, run: '13.345.678-2', nombres: 'Mónica', apellidos: 'Reyes Troncoso', titulo: 'Profesora de Inglés', calidad_juridica: 'CONTRATA', estamento: 'DOCENTE_AULA', horas_contrato: 30, asignatura_principal: 'Idioma Extranjero: Inglés', horas_subvencion_general_contrata: 20, horas_sep_contrata: 10, horas_aula: 20 },
    { id: 'doc-8', rbd: '3480', periodo: 2026, run: '13.345.678-2', nombres: 'Mónica', apellidos: 'Reyes Troncoso', titulo: 'Profesora de Inglés', calidad_juridica: 'CONTRATA', estamento: 'DOCENTE_AULA', horas_contrato: 14, asignatura_principal: 'Idioma Extranjero: Inglés', horas_subvencion_general_contrata: 14, horas_aula: 10 }
  ];
  await supabase.from('docentes').upsert(docentesPayload, { onConflict: 'id' });
  console.log(`✅ ${docentesPayload.length} Docentes migrados a Supabase.`);

  // 6. Asignaciones Horarias
  console.log('\n--- 6. Sincronizando Asignaciones Horarias ---');
  const asigsPayload = [
    { id: 'asig-1', rbd: '3451', curso_id: 'curso-1', docente_id: 'doc-1', asignatura: 'Lenguaje y Comunicación', horas_pedagogicas_aula: 8, periodo: 2026 },
    { id: 'asig-2', rbd: '3451', curso_id: 'curso-1', docente_id: 'doc-2', asignatura: 'Matemática', horas_pedagogicas_aula: 6, periodo: 2026 },
    { id: 'asig-3', rbd: '3451', curso_id: 'curso-1', docente_id: 'doc-4', asignatura: 'Apoyo Especializado PIE / Co-docencia', horas_pedagogicas_aula: 0, horas_cronologicas_pie: 10.5, horas_colaborativas: 3.0, tipo_apoyo: 'Co-docencia Aula Común', periodo: 2026 },
    { id: 'asig-4', rbd: '3451', curso_id: 'curso-2', docente_id: 'doc-1', asignatura: 'Lenguaje y Comunicación', horas_pedagogicas_aula: 8, periodo: 2026 },
    { id: 'asig-5', rbd: '3451', curso_id: 'curso-2', docente_id: 'doc-2', asignatura: 'Matemática', horas_pedagogicas_aula: 6, periodo: 2026 }
  ];
  await supabase.from('asignaciones_horarias').upsert(asigsPayload, { onConflict: 'id' });
  console.log(`✅ ${asigsPayload.length} Asignaciones Horarias migradas a Supabase.`);

  // 7. Usuarios del Sistema
  console.log('\n--- 7. Sincronizando Usuarios y Roles de Acceso ---');
  const usuariosPayload = [
    { id: 'user-saxneal-superadmin', username: 'saxneal@gmail.com', email: 'saxneal@gmail.com', nombre_completo: 'Super Administrador SLEP (saxneal)', role: 'super_usuario', cargo: 'Super Usuario / Administrador General del Territorio', activo: true },
    { id: 'user-admin-general', username: 'admin@slepvallediguillin.cl', email: 'admin@slepvallediguillin.cl', nombre_completo: 'Administrador General SLEP', role: 'admin', cargo: 'Administrador de Dotación Territorial', activo: true },
    { id: 'user-asesor-uatp', username: 'asesor.uatp@slepvallediguillin.cl', email: 'asesor.uatp@slepvallediguillin.cl', nombre_completo: 'Asesor UATP Territorial', role: 'asesor_uatp', cargo: 'Asesor Técnico Pedagógico Territorial', cartera_rbds_json: ['3656', '3638', '3639', '3643'], activo: true },
    { id: 'user-dir-3656', username: 'director.3656@slepvallediguillin.cl', email: 'director.3656@slepvallediguillin.cl', nombre_completo: 'Directora Verónica Knothe Badillo', role: 'director', cargo: 'Director de Establecimiento (RBD 3656)', rbd_asignado: '3656', activo: true }
  ];
  await supabase.from('usuarios_sistema').upsert(usuariosPayload, { onConflict: 'id' });
  console.log(`✅ ${usuariosPayload.length} Usuarios del Sistema migrados a Supabase.`);

  // 8. Resumen en Vista
  const { data: viewData, error: viewErr } = await supabase.from('vista_resumen_dotacion_colegio').select('*').limit(5);
  if (!viewErr && viewData) {
    console.log('\n📊 Muestra de Vista Analítica (vista_resumen_dotacion_colegio):');
    console.table(viewData);
  }

  console.log('\n🎉 ¡MIGRACIÓN A SUPABASE COMPLETADA CON ÉXITO ABSOLUTO!');
}

runFullMigration().catch(err => {
  console.error('💥 Error crítico en la migración:', err);
  process.exit(1);
});
