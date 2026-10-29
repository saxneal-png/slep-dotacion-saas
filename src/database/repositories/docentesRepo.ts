import { Docente } from '../../types';
import { getDb, persistDb } from '../dbCore';
import { FirebaseDotacionService } from '../../services/firebaseDotacionService';

export async function listarDocentes(rbd: string, periodo: number = 2026): Promise<Docente[]> {
  const db = await getDb();
  const res = db.exec(`
    SELECT id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
           horas_subvencion_general_titular, horas_subvencion_general_contrata,
           horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
           horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
           horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
           periodo, horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
           horas_taller_sep, horas_trabajo_colaborativo, funciones_no_aula_json,
           horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
           accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
           situacion_final_gdp, observaciones_director, observaciones_slep
    FROM docentes WHERE rbd = ? AND (periodo = ? OR (periodo IS NULL AND ? = 2026)) ORDER BY apellidos, nombres
  `, [rbd, periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    const horasContrato = Number(row[8]);
    const calJuridica = row[6] as any;
    let subvGenTitular = Number(row[9] || 0);
    let subvGenContrata = Number(row[10] || 0);
    let sepTitular = Number(row[11] || 0);
    let sepContrata = Number(row[12] || 0);
    let pieTitular = Number(row[13] || 0);
    let pieContrata = Number(row[14] || 0);

    // Si todas las fuentes están en 0 (registro previo), inferir por defecto según calidad jurídica
    const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
    if (sumaFuentes === 0 && horasContrato > 0) {
      if (calJuridica === 'TITULAR') {
        subvGenTitular = horasContrato;
      } else {
        subvGenContrata = horasContrato;
      }
    }

    let funcionesNoAula: any[] = [];
    if (row[33]) {
      try {
        funcionesNoAula = JSON.parse(String(row[33]));
      } catch (_) {}
    }

    return {
      id: String(row[0]),
      rbd: String(row[1]),
      run: String(row[2]),
      nombres: String(row[3]),
      apellidos: String(row[4]),
      titulo: row[5] ? String(row[5]) : undefined,
      calidadJuridica: calJuridica,
      estamento: row[7] as any,
      horasContrato,
      horasSubvencionGeneralTitular: subvGenTitular,
      horasSubvencionGeneralContrata: subvGenContrata,
      horasSepTitular: sepTitular,
      horasSepContrata: sepContrata,
      horasPieTitular: pieTitular,
      horasPieContrata: pieContrata,
      horasDirectivas: Number(row[15] || 0),
      horasInspectorGeneral: Number(row[16] || 0),
      horasTecnicoPedagogicas: Number(row[17] || 0),
      horasCoordinacion: Number(row[18] || 0),
      tipoCoordinacion: row[19] ? String(row[19]) : undefined,
      horasAula: Number(row[20] || 0),
      horasIngles: Number(row[21] || 0),
      funcionPrincipal: row[22] ? String(row[22]) : undefined,
      funcionSecundaria: row[23] ? String(row[23]) : undefined,
      asignaturaPrincipal: row[24] ? String(row[24]) : undefined,
      aplicaArticulo69: Boolean(row[25]),
      periodo: row[26] ? Number(row[26]) : 2026,
      horasCoordinacionPie: Number(row[27] || 0),
      horasConvivenciaEscolar: Number(row[28] || 0),
      horasExtraescolar: Number(row[29] || 0),
      cargoInstitucional: row[30] ? String(row[30]) : undefined,
      horasTallerSep: Number(row[31] || 0),
      horasTrabajoColaborativo: Number(row[32] || 0),
      funcionesNoAula: funcionesNoAula.length > 0 ? funcionesNoAula : undefined,
      horasVigentesAnterior: row[34] !== undefined && row[34] !== null ? Number(row[34]) : horasContrato,
      propuestaGdp: row[35] ? String(row[35]) : 'Continuidad',
      remuneracionMensualApp: Number(row[36] || 0),
      remuneracionMensual: Number(row[36] || 0),
      fechaInicioContrato: row[37] ? String(row[37]) : '01-03-2026',
      fechaTerminoContrato: row[38] ? String(row[38]) : (calJuridica === 'TITULAR' ? 'Indefinido' : '28-02-2027'),
      accionPmeSep: row[39] ? String(row[39]) : undefined,
      accionPme: row[39] ? String(row[39]) : undefined,
      horasProRetencion: Number(row[40] || 0),
      descripcionFuncionGdp: row[41] ? String(row[41]) : undefined,
      estadoSancionGdp: (row[42] as any) || 'Pendiente',
      horasAprobadasGdp: Number(row[43] || 0),
      situacionFinalGdp: row[44] ? String(row[44]) : 'Vigente',
      observacionesDirector: row[45] ? String(row[45]) : undefined,
      observacionesPal: row[45] ? String(row[45]) : undefined,
      observacionesSlep: row[46] ? String(row[46]) : undefined
    };
  });
}

export async function listarTodosLosDocentesTerritorio(periodo: number = 2026): Promise<Docente[]> {
  const db = await getDb();
  const res = db.exec(`
    SELECT id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
           horas_subvencion_general_titular, horas_subvencion_general_contrata,
           horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
           horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
           horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
           periodo, horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
           horas_taller_sep, horas_trabajo_colaborativo, funciones_no_aula_json,
           horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
           accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
           situacion_final_gdp, observaciones_director, observaciones_slep
    FROM docentes
    WHERE (periodo = ? OR (periodo IS NULL AND ? = 2026))
  `, [periodo, periodo]);
  if (!res.length) return [];
  return res[0].values.map(row => {
    const horasContrato = Number(row[8]);
    const calJuridica = row[6] as any;
    let subvGenTitular = Number(row[9] || 0);
    let subvGenContrata = Number(row[10] || 0);
    let sepTitular = Number(row[11] || 0);
    let sepContrata = Number(row[12] || 0);
    let pieTitular = Number(row[13] || 0);
    let pieContrata = Number(row[14] || 0);

    const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
    if (sumaFuentes === 0 && horasContrato > 0) {
      if (calJuridica === 'TITULAR') {
        subvGenTitular = horasContrato;
      } else {
        subvGenContrata = horasContrato;
      }
    }

    let funcionesNoAula: any[] = [];
    if (row[33]) {
      try {
        funcionesNoAula = JSON.parse(String(row[33]));
      } catch (_) {}
    }

    return {
      id: String(row[0]),
      rbd: String(row[1]),
      run: String(row[2]),
      nombres: String(row[3]),
      apellidos: String(row[4]),
      titulo: row[5] ? String(row[5]) : undefined,
      calidadJuridica: calJuridica,
      estamento: row[7] as any,
      horasContrato,
      horasSubvencionGeneralTitular: subvGenTitular,
      horasSubvencionGeneralContrata: subvGenContrata,
      horasSepTitular: sepTitular,
      horasSepContrata: sepContrata,
      horasPieTitular: pieTitular,
      horasPieContrata: pieContrata,
      horasDirectivas: Number(row[15] || 0),
      horasInspectorGeneral: Number(row[16] || 0),
      horasTecnicoPedagogicas: Number(row[17] || 0),
      horasCoordinacion: Number(row[18] || 0),
      tipoCoordinacion: row[19] ? String(row[19]) : undefined,
      horasAula: Number(row[20] || 0),
      horasIngles: Number(row[21] || 0),
      funcionPrincipal: row[22] ? String(row[22]) : undefined,
      funcionSecundaria: row[23] ? String(row[23]) : undefined,
      asignaturaPrincipal: row[24] ? String(row[24]) : undefined,
      aplicaArticulo69: Boolean(row[25]),
      periodo: row[26] ? Number(row[26]) : 2026,
      horasCoordinacionPie: Number(row[27] || 0),
      horasConvivenciaEscolar: Number(row[28] || 0),
      horasExtraescolar: Number(row[29] || 0),
      cargoInstitucional: row[30] ? String(row[30]) : undefined,
      horasTallerSep: Number(row[31] || 0),
      horasTrabajoColaborativo: Number(row[32] || 0),
      funcionesNoAula: funcionesNoAula.length > 0 ? funcionesNoAula : undefined,
      horasVigentesAnterior: row[34] !== undefined && row[34] !== null ? Number(row[34]) : horasContrato,
      propuestaGdp: row[35] ? String(row[35]) : 'Continuidad',
      remuneracionMensualApp: Number(row[36] || 0),
      remuneracionMensual: Number(row[36] || 0),
      fechaInicioContrato: row[37] ? String(row[37]) : '01-03-2026',
      fechaTerminoContrato: row[38] ? String(row[38]) : (calJuridica === 'TITULAR' ? 'Indefinido' : '28-02-2027'),
      accionPmeSep: row[39] ? String(row[39]) : undefined,
      accionPme: row[39] ? String(row[39]) : undefined,
      horasProRetencion: Number(row[40] || 0),
      descripcionFuncionGdp: row[41] ? String(row[41]) : undefined,
      estadoSancionGdp: (row[42] as any) || 'Pendiente',
      horasAprobadasGdp: Number(row[43] || 0),
      situacionFinalGdp: row[44] ? String(row[44]) : 'Vigente',
      observacionesDirector: row[45] ? String(row[45]) : undefined,
      observacionesPal: row[45] ? String(row[45]) : undefined,
      observacionesSlep: row[46] ? String(row[46]) : undefined
    };
  });
}

export async function guardarDocente(d: Docente): Promise<void> {
  const db = await getDb();
  const docPeriodo = d.periodo || 2026;
  
  // Aislamiento estricto por periodo:
  // 1. Si d.id ya existe en este rbd y periodo, respetar estrictamente ese id para mantener FKs
  let docId: string = '';
  if (d.id) {
    const existingById = db.exec(
      "SELECT id FROM docentes WHERE id = ? AND rbd = ? AND periodo = ?",
      [d.id, d.rbd, docPeriodo]
    );
    if (existingById.length && existingById[0].values.length) {
      docId = d.id;
    }
  }

  // 2. Si no se encontró por ID directo, buscar por RUN normalizado en este (rbd, periodo)
  if (!docId) {
    const existingByRun = db.exec(
      "SELECT id FROM docentes WHERE rbd = ? AND run = ? AND periodo = ?", 
      [d.rbd, d.run, docPeriodo]
    );
    if (existingByRun.length && existingByRun[0].values.length) {
      docId = String(existingByRun[0].values[0][0]);
    } else {
      // Si no existe en este periodo, verificar si d.id ya está ocupado por otro periodo
      const idEnOtroPeriodo = d.id ? db.exec("SELECT id FROM docentes WHERE id = ? AND periodo != ?", [d.id, docPeriodo]) : [];
      if (d.id && (!idEnOtroPeriodo.length || !idEnOtroPeriodo[0].values.length)) {
        docId = d.id;
      } else {
        const cleanRun = d.run.replace(/[^0-9kK]/g, '');
        docId = `doc_${d.rbd}_${docPeriodo}_${cleanRun}_${Date.now()}`;
      }
    }
  }

  let subvGenTitular = Number(d.horasSubvencionGeneralTitular || 0);
  let subvGenContrata = Number(d.horasSubvencionGeneralContrata || 0);
  let sepTitular = Number(d.horasSepTitular || 0);
  let sepContrata = Number(d.horasSepContrata || 0);
  let pieTitular = Number(d.horasPieTitular || 0);
  let pieContrata = Number(d.horasPieContrata || 0);

  const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
  if (sumaFuentes === 0 && d.horasContrato > 0) {
    if (d.calidadJuridica === 'TITULAR') {
      subvGenTitular = d.horasContrato;
    } else {
      subvGenContrata = d.horasContrato;
    }
  }

  const funcionesJson = d.funcionesNoAula && d.funcionesNoAula.length > 0 ? JSON.stringify(d.funcionesNoAula) : null;

  // Soportar compatibilidad de nombres entre vistas/modales y modelo DB
  const remMensual = d.remuneracionMensualApp ?? (d as any).remuneracionMensual ?? 0;
  const pmeSep = d.accionPmeSep ?? (d as any).accionPme ?? null;
  const obsDirector = d.observacionesDirector ?? (d as any).observacionesPal ?? null;

  db.run(`
    INSERT INTO docentes (
      id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
      horas_subvencion_general_titular, horas_subvencion_general_contrata,
      horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
      horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
      horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
      horas_taller_sep, horas_trabajo_colaborativo,
      horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
      funciones_no_aula_json, periodo,
      horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
      accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
      situacion_final_gdp, observaciones_director, observaciones_slep
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      rbd=excluded.rbd, run=excluded.run, nombres=excluded.nombres, apellidos=excluded.apellidos,
      titulo=excluded.titulo, calidad_juridica=excluded.calidad_juridica,
      estamento=excluded.estamento, horas_contrato=excluded.horas_contrato,
      horas_subvencion_general_titular=excluded.horas_subvencion_general_titular,
      horas_subvencion_general_contrata=excluded.horas_subvencion_general_contrata,
      horas_sep_titular=excluded.horas_sep_titular,
      horas_sep_contrata=excluded.horas_sep_contrata,
      horas_pie_titular=excluded.horas_pie_titular,
      horas_pie_contrata=excluded.horas_pie_contrata,
      horas_directivas=excluded.horas_directivas,
      horas_inspector_general=excluded.horas_inspector_general,
      horas_tecnico_pedagogica=excluded.horas_tecnico_pedagogica,
      horas_coordinacion=excluded.horas_coordinacion, tipo_coordinacion=excluded.tipo_coordinacion,
      horas_coordinacion_pie=excluded.horas_coordinacion_pie,
      horas_convivencia_escolar=excluded.horas_convivencia_escolar,
      horas_extraescolar=excluded.horas_extraescolar,
      cargo_institucional=excluded.cargo_institucional,
      horas_taller_sep=excluded.horas_taller_sep,
      horas_trabajo_colaborativo=excluded.horas_trabajo_colaborativo,
      horas_aula=excluded.horas_aula, horas_ingles=excluded.horas_ingles,
      funcion_principal=excluded.funcion_principal, funcion_secundaria=excluded.funcion_secundaria,
      asignatura_principal=excluded.asignatura_principal, aplica_articulo_69=excluded.aplica_articulo_69,
      funciones_no_aula_json=excluded.funciones_no_aula_json,
      periodo=excluded.periodo,
      horas_vigentes_anterior=excluded.horas_vigentes_anterior,
      propuesta_gdp=excluded.propuesta_gdp,
      remuneracion_mensual_app=excluded.remuneracion_mensual_app,
      fecha_inicio_contrato=excluded.fecha_inicio_contrato,
      fecha_termino_contrato=excluded.fecha_termino_contrato,
      accion_pme_sep=excluded.accion_pme_sep,
      horas_pro_retencion=excluded.horas_pro_retencion,
      descripcion_funcion_gdp=excluded.descripcion_funcion_gdp,
      estado_sancion_gdp=excluded.estado_sancion_gdp,
      horas_aprobadas_gdp=excluded.horas_aprobadas_gdp,
      situacion_final_gdp=excluded.situacion_final_gdp,
      observaciones_director=excluded.observaciones_director,
      observaciones_slep=excluded.observaciones_slep;
  `, [
    docId, d.rbd, d.run, d.nombres, d.apellidos, d.titulo || null, d.calidadJuridica, d.estamento, d.horasContrato,
    subvGenTitular, subvGenContrata, sepTitular, sepContrata, pieTitular, pieContrata,
    d.horasDirectivas || 0, d.horasInspectorGeneral || 0, d.horasTecnicoPedagogicas || 0, d.horasCoordinacion || 0, d.tipoCoordinacion || null,
    d.horasCoordinacionPie || 0, d.horasConvivenciaEscolar || 0, d.horasExtraescolar || 0, d.cargoInstitucional || null,
    d.horasTallerSep || 0, d.horasTrabajoColaborativo || 0,
    d.horasAula || 0, d.horasIngles || 0,
    d.funcionPrincipal || null, d.funcionSecundaria || null, d.asignaturaPrincipal || null, d.aplicaArticulo69 ? 1 : 0,
    funcionesJson, docPeriodo,
    d.horasVigentesAnterior !== undefined && d.horasVigentesAnterior !== null ? d.horasVigentesAnterior : d.horasContrato,
    d.propuestaGdp || 'Continuidad',
    remMensual,
    d.fechaInicioContrato || '01-03-2026',
    d.fechaTerminoContrato || (d.calidadJuridica === 'TITULAR' ? 'Indefinido' : '28-02-2027'),
    pmeSep,
    d.horasProRetencion || 0,
    d.descripcionFuncionGdp || null,
    d.estadoSancionGdp || 'Pendiente',
    d.horasAprobadasGdp || 0,
    d.situacionFinalGdp || 'Vigente',
    obsDirector,
    d.observacionesSlep || null
  ]);
  await persistDb(true);
  FirebaseDotacionService.guardarDocente({ ...d, id: docId, periodo: docPeriodo }).catch(err =>
    console.warn('[docentesRepo] Aviso sincronizando con Firestore:', err)
  );
}

export async function guardarDocentesBatch(docentes: Docente[]): Promise<number> {
  if (!docentes.length) return 0;
  const db = await getDb();
  db.run("BEGIN TRANSACTION;");
  try {
    for (const d of docentes) {
      const docPeriodo = d.periodo || 2026;
      const existing = db.exec(
        "SELECT id FROM docentes WHERE rbd = ? AND run = ? AND periodo = ?", 
        [d.rbd, d.run, docPeriodo]
      );
      let docId: string;
      if (existing.length && existing[0].values.length) {
        docId = String(existing[0].values[0][0]);
      } else {
        const idEnOtroPeriodo = d.id ? db.exec("SELECT id FROM docentes WHERE id = ? AND periodo != ?", [d.id, docPeriodo]) : [];
        if (d.id && (!idEnOtroPeriodo.length || !idEnOtroPeriodo[0].values.length)) {
          docId = d.id;
        } else {
          const cleanRun = d.run.replace(/[^0-9kK]/g, '');
          docId = `doc_${d.rbd}_${docPeriodo}_${cleanRun}_${Date.now()}`;
        }
      }

      let subvGenTitular = Number(d.horasSubvencionGeneralTitular || 0);
      let subvGenContrata = Number(d.horasSubvencionGeneralContrata || 0);
      let sepTitular = Number(d.horasSepTitular || 0);
      let sepContrata = Number(d.horasSepContrata || 0);
      let pieTitular = Number(d.horasPieTitular || 0);
      let pieContrata = Number(d.horasPieContrata || 0);

      const sumaFuentes = subvGenTitular + subvGenContrata + sepTitular + sepContrata + pieTitular + pieContrata;
      if (sumaFuentes === 0 && d.horasContrato > 0) {
        if (d.calidadJuridica === 'TITULAR') {
          subvGenTitular = d.horasContrato;
        } else {
          subvGenContrata = d.horasContrato;
        }
      }

      const funcionesJson = d.funcionesNoAula && d.funcionesNoAula.length > 0 ? JSON.stringify(d.funcionesNoAula) : null;

      // Soportar compatibilidad de nombres entre vistas/modales y modelo DB
      const remMensual = d.remuneracionMensualApp ?? (d as any).remuneracionMensual ?? 0;
      const pmeSep = d.accionPmeSep ?? (d as any).accionPme ?? null;
      const obsDirector = d.observacionesDirector ?? (d as any).observacionesPal ?? null;

      db.run(`
        INSERT INTO docentes (
          id, rbd, run, nombres, apellidos, titulo, calidad_juridica, estamento, horas_contrato,
          horas_subvencion_general_titular, horas_subvencion_general_contrata,
          horas_sep_titular, horas_sep_contrata, horas_pie_titular, horas_pie_contrata,
          horas_directivas, horas_inspector_general, horas_tecnico_pedagogica, horas_coordinacion, tipo_coordinacion,
          horas_coordinacion_pie, horas_convivencia_escolar, horas_extraescolar, cargo_institucional,
          horas_taller_sep, horas_trabajo_colaborativo,
          horas_aula, horas_ingles, funcion_principal, funcion_secundaria, asignatura_principal, aplica_articulo_69,
          funciones_no_aula_json, periodo,
          horas_vigentes_anterior, propuesta_gdp, remuneracion_mensual_app, fecha_inicio_contrato, fecha_termino_contrato,
          accion_pme_sep, horas_pro_retencion, descripcion_funcion_gdp, estado_sancion_gdp, horas_aprobadas_gdp,
          situacion_final_gdp, observaciones_director, observaciones_slep
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          rbd=excluded.rbd, run=excluded.run, nombres=excluded.nombres, apellidos=excluded.apellidos,
          titulo=excluded.titulo, calidad_juridica=excluded.calidad_juridica,
          estamento=excluded.estamento, horas_contrato=excluded.horas_contrato,
          horas_subvencion_general_titular=excluded.horas_subvencion_general_titular,
          horas_subvencion_general_contrata=excluded.horas_subvencion_general_contrata,
          horas_sep_titular=excluded.horas_sep_titular,
          horas_sep_contrata=excluded.horas_sep_contrata,
          horas_pie_titular=excluded.horas_pie_titular,
          horas_pie_contrata=excluded.horas_pie_contrata,
          horas_directivas=excluded.horas_directivas,
          horas_inspector_general=excluded.horas_inspector_general,
          horas_tecnico_pedagogica=excluded.horas_tecnico_pedagogica,
          horas_coordinacion=excluded.horas_coordinacion, tipo_coordinacion=excluded.tipo_coordinacion,
          horas_coordinacion_pie=excluded.horas_coordinacion_pie,
          horas_convivencia_escolar=excluded.horas_convivencia_escolar,
          horas_extraescolar=excluded.horas_extraescolar,
          cargo_institucional=excluded.cargo_institucional,
          horas_taller_sep=excluded.horas_taller_sep,
          horas_trabajo_colaborativo=excluded.horas_trabajo_colaborativo,
          horas_aula=excluded.horas_aula, horas_ingles=excluded.horas_ingles,
          funcion_principal=excluded.funcion_principal, funcion_secundaria=excluded.funcion_secundaria,
          asignatura_principal=excluded.asignatura_principal, aplica_articulo_69=excluded.aplica_articulo_69,
          funciones_no_aula_json=excluded.funciones_no_aula_json,
          periodo=excluded.periodo,
          horas_vigentes_anterior=excluded.horas_vigentes_anterior,
          propuesta_gdp=excluded.propuesta_gdp,
          remuneracion_mensual_app=excluded.remuneracion_mensual_app,
          fecha_inicio_contrato=excluded.fecha_inicio_contrato,
          fecha_termino_contrato=excluded.fecha_termino_contrato,
          accion_pme_sep=excluded.accion_pme_sep,
          horas_pro_retencion=excluded.horas_pro_retencion,
          descripcion_funcion_gdp=excluded.descripcion_funcion_gdp,
          estado_sancion_gdp=excluded.estado_sancion_gdp,
          horas_aprobadas_gdp=excluded.horas_aprobadas_gdp,
          situacion_final_gdp=excluded.situacion_final_gdp,
          observaciones_director=excluded.observaciones_director,
          observaciones_slep=excluded.observaciones_slep;
      `, [
        docId, d.rbd, d.run, d.nombres, d.apellidos, d.titulo || null, d.calidadJuridica, d.estamento, d.horasContrato,
        subvGenTitular, subvGenContrata, sepTitular, sepContrata, pieTitular, pieContrata,
        d.horasDirectivas || 0, d.horasInspectorGeneral || 0, d.horasTecnicoPedagogicas || 0, d.horasCoordinacion || 0, d.tipoCoordinacion || null,
        d.horasCoordinacionPie || 0, d.horasConvivenciaEscolar || 0, d.horasExtraescolar || 0, d.cargoInstitucional || null,
        d.horasTallerSep || 0, d.horasTrabajoColaborativo || 0,
        d.horasAula || 0, d.horasIngles || 0,
        d.funcionPrincipal || null, d.funcionSecundaria || null, d.asignaturaPrincipal || null, d.aplicaArticulo69 ? 1 : 0,
        funcionesJson, docPeriodo,
        d.horasVigentesAnterior !== undefined && d.horasVigentesAnterior !== null ? d.horasVigentesAnterior : d.horasContrato,
        d.propuestaGdp || 'Continuidad',
        remMensual,
        d.fechaInicioContrato || '01-03-2026',
        d.fechaTerminoContrato || (d.calidadJuridica === 'TITULAR' ? 'Indefinido' : '28-02-2027'),
        pmeSep,
        d.horasProRetencion || 0,
        d.descripcionFuncionGdp || null,
        d.estadoSancionGdp || 'Pendiente',
        d.horasAprobadasGdp || 0,
        d.situacionFinalGdp || 'Vigente',
        obsDirector,
        d.observacionesSlep || null
      ]);
    }
    db.run("COMMIT;");
  } catch (err) {
    db.run("ROLLBACK;");
    throw err;
  }
  await persistDb(true);
  FirebaseDotacionService.guardarDocentesBatch(docentes).catch(err =>
    console.warn('[docentesRepo] Aviso sincronizando lote con Firestore:', err)
  );
  return docentes.length;
}

export async function eliminarDocente(id: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM docentes WHERE id = ?", [id]);
  await persistDb(true);
  FirebaseDotacionService.eliminarDocente(id).catch(err =>
    console.warn('[docentesRepo] Aviso eliminando en Firestore:', err)
  );
}