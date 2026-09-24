import ExcelJS from 'exceljs';
import { PlanEstudioCurricular, AsignaturaPlanEstudio, AmbitoFormativoPlan } from '../types';
import {
  guardarPlanEstudio,
  listarPlanesEstudio,
  poblarPlanesEstudioEnDb
} from '../database/db';

export interface IngestaPlanesResultado {
  exito: boolean;
  planesProcesados: number;
  planesInsertados: number;
  mensajes: string[];
  errores: string[];
}

/**
 * Exporta los planes de estudio en formato JSON estructurado oficial.
 */
export function exportarPlanesEstudioJson(
  planes: PlanEstudioCurricular[],
  nombreArchivo: string = 'planes_estudio_slep_valle_diguillin.json'
): void {
  const payload = {
    version: '2.0.0',
    fecha_exportacion: new Date().toISOString(),
    territorio: 'SLEP Valle Diguillín',
    total_planes: planes.length,
    planes_de_estudio: planes
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exporta los planes de estudio en una planilla Excel (.xlsx) altamente estructurada con ExcelJS.
 */
export async function exportarPlanesEstudioExcel(
  planes: PlanEstudioCurricular[],
  nombreArchivo: string = 'Catalogo_Planes_Estudio_MINEDUC_EPJA_2024.xlsx'
): Promise<void> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'SLEP Valle Diguillín';
  wb.created = new Date();

  // 1. Hoja Resumen General de Planes
  const wsGeneral = wb.addWorksheet('1. Resumen de Planes', {
    views: [{ showGridLines: true }]
  });

  wsGeneral.columns = [
    { header: 'ID Plan', key: 'id', width: 28 },
    { header: 'Nivel / Modalidad', key: 'nivel', width: 45 },
    { header: 'Categoría', key: 'categoria', width: 18 },
    { header: 'Régimen', key: 'regimen', width: 12 },
    { header: 'Decreto Supremo / Fuente', key: 'decreto', width: 35 },
    { header: 'Hrs. Sem. Obligatorias', key: 'horas_obligatorias', width: 22 },
    { header: 'Hrs. Libre Disp.', key: 'horas_libre_disp', width: 18 },
    { header: 'Total Hrs. Plan (Semanal)', key: 'total_horas_plan', width: 24 },
    { header: 'Total Hrs. Anuales', key: 'total_horas_anuales', width: 20 },
    { header: 'N° Asignaturas', key: 'num_asignaturas', width: 16 },
    { header: 'Organización Modular', key: 'modular', width: 28 },
    { header: 'Personalizado', key: 'personalizado', width: 14 }
  ];

  // Estilo Encabezado General
  const headerRow = wsGeneral.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '002B49' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  planes.forEach((p) => {
    const modStr = p.organizacionModular
      ? `${p.organizacionModular.modulosObligatorios} Oblig. + ${p.organizacionModular.modulosElectivos} Elec. (${p.organizacionModular.duracionModuloSemanas} sem/mód)`
      : 'Estructura Semanal Regular';

    const row = wsGeneral.addRow({
      id: p.id,
      nivel: p.nivel,
      categoria: p.categoria,
      regimen: p.regimen,
      decreto: p.decretoSupremo || 'MINEDUC Oficial',
      horas_obligatorias: p.totalHorasSemanalesObligatorias,
      horas_libre_disp: p.horasLibreDisposicion || 0,
      total_horas_plan: p.totalHorasPlan || p.totalHorasSemanalesObligatorias,
      total_horas_anuales: p.totalHorasAnualesObligatorias || (p.totalHorasSemanalesObligatorias * 36),
      num_asignaturas: p.asignaturas?.length || 0,
      modular: modStr,
      personalizado: p.esPersonalizado ? 'SÍ' : 'NO'
    });

    row.height = 20;
    row.getCell('horas_obligatorias').alignment = { horizontal: 'center' };
    row.getCell('horas_libre_disp').alignment = { horizontal: 'center' };
    row.getCell('total_horas_plan').alignment = { horizontal: 'center' };
    row.getCell('total_horas_anuales').alignment = { horizontal: 'center' };
    row.getCell('num_asignaturas').alignment = { horizontal: 'center' };
    row.getCell('personalizado').alignment = { horizontal: 'center' };
  });

  // 2. Hoja Detalle de Asignaturas
  const wsAsigs = wb.addWorksheet('2. Detalle Asignaturas', {
    views: [{ showGridLines: true }]
  });

  wsAsigs.columns = [
    { header: 'ID Plan', key: 'plan_id', width: 25 },
    { header: 'Nivel del Plan', key: 'plan_nivel', width: 40 },
    { header: 'Categoría', key: 'categoria', width: 16 },
    { header: 'Ámbito Formativo', key: 'ambito', width: 32 },
    { header: 'Nombre Asignatura / Módulo', key: 'asignatura', width: 38 },
    { header: 'Horas Semanales', key: 'horas_semanales', width: 18 },
    { header: 'Horas Anuales', key: 'horas_anuales', width: 16 },
    { header: 'Carácter', key: 'caracter', width: 16 }
  ];

  const headerRowAsigs = wsAsigs.getRow(1);
  headerRowAsigs.height = 26;
  headerRowAsigs.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '003865' } };
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  planes.forEach((p) => {
    p.asignaturas?.forEach((a) => {
      const row = wsAsigs.addRow({
        plan_id: p.id,
        plan_nivel: p.nivel,
        categoria: p.categoria,
        ambito: a.ambito || 'Formación General',
        asignatura: a.nombre,
        horas_semanales: a.horasSemanales,
        horas_anuales: a.horasAnuales || (a.horasSemanales * 36),
        caracter: a.caracter || 'Obligatoria'
      });
      row.height = 19;
      row.getCell('horas_semanales').alignment = { horizontal: 'center' };
      row.getCell('horas_anuales').alignment = { horizontal: 'center' };
      row.getCell('caracter').alignment = { horizontal: 'center' };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Ingesta e importa planes de estudio desde un objeto o texto JSON.
 * Soporta formatos:
 * 1. Objeto raíz con `planes_de_estudio_epja` o `planes_de_estudio`
 * 2. Arreglo directo `PlanEstudioCurricular[]`
 * 3. Objeto individual `PlanEstudioCurricular`
 */
export async function importarPlanesEstudioDesdeJson(
  contenido: string | object
): Promise<IngestaPlanesResultado> {
  const mensajes: string[] = [];
  const errores: string[] = [];
  let insertados = 0;
  let procesados = 0;

  try {
    let data: any = typeof contenido === 'string' ? JSON.parse(contenido) : contenido;

    let listaPlanes: any[] = [];

    // Formato 1: JSON oficial EPJA (Bases Curriculares Decreto 10/2022)
    if (data.planes_de_estudio_epja && Array.isArray(data.planes_de_estudio_epja)) {
      const info = data.informacion_curricular || {};
      for (const item of data.planes_de_estudio_epja) {
        const id = `epja_2024_${item.nivel}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
        const asigs: AsignaturaPlanEstudio[] = [];
        const ambitos: AmbitoFormativoPlan[] = [];

        if (item.ambitos_formativos && Array.isArray(item.ambitos_formativos)) {
          for (const amb of item.ambitos_formativos) {
            const asigsAmbito: AsignaturaPlanEstudio[] = [];
            if (amb.asignaturas && Array.isArray(amb.asignaturas)) {
              for (const a of amb.asignaturas) {
                const asigItem: AsignaturaPlanEstudio = {
                  nombre: a.nombre,
                  horasSemanales: Number(a.horas_semanales || 2),
                  horasAnuales: a.horas_anuales ? Number(a.horas_anuales) : Number(a.horas_semanales || 2) * 36,
                  caracter: a.caracter || 'Obligatoria',
                  ambito: amb.ambito
                };
                asigsAmbito.push(asigItem);
                asigs.push(asigItem);
              }
            } else if (amb.catalogo_asignaturas_elegibles) {
              const asigItem: AsignaturaPlanEstudio = {
                nombre: `${amb.ambito} (${amb.catalogo_asignaturas_elegibles.join(' / ')})`,
                horasSemanales: Number(amb.horas_semanales_subtotal || 2),
                horasAnuales: amb.horas_anuales_subtotal ? Number(amb.horas_anuales_subtotal) : Number(amb.horas_semanales_subtotal || 2) * 36,
                caracter: amb.caracter?.includes('Electiva') ? 'Electiva' : 'Instrumental',
                ambito: amb.ambito
              };
              asigsAmbito.push(asigItem);
              asigs.push(asigItem);
            }

            ambitos.push({
              ambito: amb.ambito,
              caracter: amb.caracter,
              horasSemanalesSubtotal: Number(amb.horas_semanales_subtotal || 0),
              horasAnualesSubtotal: amb.horas_anuales_subtotal ? Number(amb.horas_anuales_subtotal) : undefined,
              asignaturas: asigsAmbito,
              catalogoAsignaturasElegibles: amb.catalogo_asignaturas_elegibles
            });
          }
        }

        const planFormateado: PlanEstudioCurricular = {
          id,
          nivel: item.nivel,
          equivalenciaRegular: item.equivalencia_regular,
          regimen: 'No JEC',
          categoria: 'EPJA',
          documento: info.documento || 'Bases Curriculares EPJA',
          decretoSupremo: info.decreto_supremo || 'Decreto Supremo N° 10/2022',
          ministerio: info.ministerio || 'Ministerio de Educación - Gobierno de Chile',
          duracionAnoLectivoSemanas: info.duracion_ano_lectivo_semanas || 36,
          totalHorasSemanalesObligatorias: Number(item.total_horas_semanales_obligatorias || 10),
          totalHorasAnualesObligatorias: Number(item.total_horas_anuales_obligatorias || 360),
          totalHorasSemanalesConOpcionales: item.total_horas_semanales_con_opcionales ? Number(item.total_horas_semanales_con_opcionales) : undefined,
          totalHorasAnualesConOpcionales: item.total_horas_anuales_con_opcionales ? Number(item.total_horas_anuales_con_opcionales) : undefined,
          horasLibreDisposicion: 0,
          totalHorasPlan: Number(item.total_horas_semanales_obligatorias || 10),
          ambitosFormativos: ambitos,
          asignaturas: asigs,
          organizacionModular: info.organizacion_modular_sugerida,
          esPersonalizado: false
        };

        listaPlanes.push(planFormateado);
      }
    }
    // Formato 2: Contenedor con `planes_de_estudio`
    else if (data.planes_de_estudio && Array.isArray(data.planes_de_estudio)) {
      listaPlanes = data.planes_de_estudio;
    }
    // Formato 3: Arreglo de planes
    else if (Array.isArray(data)) {
      listaPlanes = data;
    }
    // Formato 4: Objeto individual de plan
    else if (data.nivel && (data.totalHorasSemanalesObligatorias !== undefined || data.asignaturas)) {
      listaPlanes = [data];
    } else {
      throw new Error('El archivo JSON no contiene una estructura reconocida de planes de estudio.');
    }

    procesados = listaPlanes.length;

    for (const p of listaPlanes) {
      if (!p.nivel) {
        errores.push(`Se omitió un registro por no tener campo 'nivel' definido.`);
        continue;
      }

      const id = p.id || `plan_${p.nivel}_${p.regimen || 'jec'}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const planAInsertar: PlanEstudioCurricular = {
        id,
        nivel: String(p.nivel),
        equivalenciaRegular: p.equivalenciaRegular,
        regimen: (p.regimen === 'No JEC' || p.regimen === 'NO_JEC') ? 'No JEC' : 'JEC',
        categoria: p.categoria || 'OTRO',
        documento: p.documento,
        decretoSupremo: p.decretoSupremo,
        ministerio: p.ministerio,
        duracionAnoLectivoSemanas: p.duracionAnoLectivoSemanas ? Number(p.duracionAnoLectivoSemanas) : 36,
        totalHorasSemanalesObligatorias: Number(p.totalHorasSemanalesObligatorias || p.horasObligatorias || 30),
        totalHorasAnualesObligatorias: p.totalHorasAnualesObligatorias ? Number(p.totalHorasAnualesObligatorias) : Number(p.totalHorasSemanalesObligatorias || 30) * 36,
        horasLibreDisposicion: Number(p.horasLibreDisposicion || 0),
        totalHorasPlan: Number(p.totalHorasPlan || p.totalHorasSemanalesObligatorias || 30),
        ambitosFormativos: p.ambitosFormativos,
        asignaturas: Array.isArray(p.asignaturas) ? p.asignaturas.map((a: any) => ({
          nombre: a.nombre || 'Asignatura',
          horasSemanales: Number(a.horasSemanales || a.horas || 2),
          horasAnuales: a.horasAnuales ? Number(a.horasAnuales) : Number(a.horasSemanales || a.horas || 2) * 36,
          caracter: a.caracter || 'Obligatoria',
          ambito: a.ambito
        })) : [],
        organizacionModular: p.organizacionModular,
        esPersonalizado: p.esPersonalizado !== false
      };

      await guardarPlanEstudio(planAInsertar);
      insertados++;
    }

    mensajes.push(`✓ Ingesta completada con éxito: ${insertados} de ${procesados} planes de estudio procesados y persistidos en SQLite.`);
    return {
      exito: true,
      planesProcesados: procesados,
      planesInsertados: insertados,
      mensajes,
      errores
    };
  } catch (err: any) {
    return {
      exito: false,
      planesProcesados: procesados,
      planesInsertados: insertados,
      mensajes,
      errores: [err.message || 'Error inesperado al procesar JSON de planes de estudio.']
    };
  }
}

/**
 * Ingesta e importa planes de estudio desde una planilla Excel (.xlsx).
 */
export async function importarPlanesEstudioDesdeExcel(
  file: File | ArrayBuffer
): Promise<IngestaPlanesResultado> {
  const mensajes: string[] = [];
  const errores: string[] = [];
  let insertados = 0;
  let procesados = 0;

  try {
    const buffer = file instanceof File ? await file.arrayBuffer() : file;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);

    const ws = wb.getWorksheet('1. Resumen de Planes') || wb.worksheets[0];
    if (!ws) throw new Error('No se encontró ninguna hoja válida en el archivo Excel.');

    const rows: any[] = [];
    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Encabezado
      const values = row.values as any[];
      if (values && values.length > 2) {
        rows.push({
          id: values[1] ? String(values[1]).trim() : undefined,
          nivel: values[2] ? String(values[2]).trim() : undefined,
          categoria: values[3] ? String(values[3]).trim() : 'OTRO',
          regimen: values[4] && String(values[4]).toLowerCase().includes('no') ? 'No JEC' : 'JEC',
          decreto: values[5] ? String(values[5]).trim() : undefined,
          horasObligatorias: values[6] ? Number(values[6]) : 30,
          horasLibreDisp: values[7] ? Number(values[7]) : 0,
          totalHorasPlan: values[8] ? Number(values[8]) : 30,
          totalHorasAnuales: values[9] ? Number(values[9]) : undefined,
        });
      }
    });

    procesados = rows.length;

    // Buscar hoja de detalle de asignaturas si existe
    const wsAsigs = wb.getWorksheet('2. Detalle Asignaturas') || wb.worksheets[1];
    const asigsMap = new Map<string, AsignaturaPlanEstudio[]>();

    if (wsAsigs) {
      wsAsigs.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const vals = row.values as any[];
        if (vals && vals.length >= 6) {
          const planId = vals[1] ? String(vals[1]).trim() : undefined;
          const planNivel = vals[2] ? String(vals[2]).trim() : undefined;
          const ambito = vals[4] ? String(vals[4]).trim() : undefined;
          const asigNombre = vals[5] ? String(vals[5]).trim() : undefined;
          const horasSem = vals[6] ? Number(vals[6]) : 2;
          const horasAnu = vals[7] ? Number(vals[7]) : horasSem * 36;
          const caracter = vals[8] ? String(vals[8]).trim() : 'Obligatoria';

          if (asigNombre && (planId || planNivel)) {
            const key = planId || planNivel!;
            if (!asigsMap.has(key)) asigsMap.set(key, []);
            asigsMap.get(key)!.push({
              nombre: asigNombre,
              horasSemanales: horasSem,
              horasAnuales: horasAnu,
              caracter: (caracter as any) || 'Obligatoria',
              ambito
            });
          }
        }
      });
    }

    for (const r of rows) {
      if (!r.nivel) continue;
      const id = r.id || `plan_${r.nivel}_${r.regimen}`.toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      const asignaturas = asigsMap.get(id) || asigsMap.get(r.nivel) || [
        { nombre: 'Plan Común Obligatorio', horasSemanales: r.horasObligatorias, horasAnuales: r.horasObligatorias * 36, caracter: 'Obligatoria' as const }
      ];

      const plan: PlanEstudioCurricular = {
        id,
        nivel: r.nivel,
        categoria: r.categoria as any,
        regimen: r.regimen,
        decretoSupremo: r.decreto,
        totalHorasSemanalesObligatorias: r.horasObligatorias,
        horasLibreDisposicion: r.horasLibreDisp,
        totalHorasPlan: r.totalHorasPlan || r.horasObligatorias,
        totalHorasAnualesObligatorias: r.totalHorasAnuales || (r.horasObligatorias * 36),
        asignaturas,
        esPersonalizado: true
      };

      await guardarPlanEstudio(plan);
      insertados++;
    }

    mensajes.push(`✓ Ingesta desde Excel exitosa: ${insertados} planes de estudio procesados y cargados en SQLite.`);
    return {
      exito: true,
      planesProcesados: procesados,
      planesInsertados: insertados,
      mensajes,
      errores
    };
  } catch (err: any) {
    return {
      exito: false,
      planesProcesados: procesados,
      planesInsertados: insertados,
      mensajes,
      errores: [err.message || 'Error al procesar archivo Excel de planes de estudio.']
    };
  }
}
