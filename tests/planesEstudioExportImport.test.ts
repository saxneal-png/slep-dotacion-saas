import { describe, it, expect, beforeAll } from 'vitest';
import {
  getDb,
  listarPlanesEstudio,
  poblarPlanesEstudioEnDb,
  obtenerPlanEstudioPorId
} from '../src/database/db';
import {
  importarPlanesEstudioDesdeJson,
  importarPlanesEstudioDesdeExcel
} from '../src/services/planesEstudioExportImportService';
import ExcelJS from 'exceljs';

describe('Servicio de Ingesta y Exportación Eficiente de Planes de Estudio', () => {
  beforeAll(async () => {
    await getDb();
    await poblarPlanesEstudioEnDb();
  });

  it('importa planes de estudio desde un JSON con estructura oficial EPJA 2024', async () => {
    const jsonEpja = JSON.stringify({
      informacion_curricular: {
        documento: "Bases Curriculares para la Educación de Personas Jóvenes y Adultas (EPJA)",
        decreto_supremo: "Decreto Supremo de Educación N° 10/2022",
        ministerio: "Ministerio de Educación - Gobierno de Chile",
        duracion_ano_lectivo_semanas: 36,
        organizacion_modular_sugerida: {
          modulos_obligatorios: 4,
          modulos_electivos: 2,
          duracion_modulo_semanas: 6
        }
      },
      planes_de_estudio_epja: [
        {
          nivel: "Educación Básica - Nivel 1 Test Ingesta",
          equivalencia_regular: "1° a 4° año de Educación Básica",
          total_horas_semanales_obligatorias: 10.0,
          total_horas_anuales_obligatorias: 360,
          ambitos_formativos: [
            {
              ambito: "Formación General",
              caracter: "Obligatoria",
              horas_semanales_subtotal: 10.0,
              horas_anuales_subtotal: 360,
              asignaturas: [
                { nombre: "Lenguaje y Comunicación", horas_semanales: 5.0, horas_anuales: 180, caracter: "Obligatoria" },
                { nombre: "Matemática", horas_semanales: 5.0, horas_anuales: 180, caracter: "Obligatoria" }
              ]
            }
          ]
        }
      ]
    });

    const res = await importarPlanesEstudioDesdeJson(jsonEpja);
    expect(res.exito).toBe(true);
    expect(res.planesInsertados).toBe(1);

    const planes = await listarPlanesEstudio('EPJA');
    const encontrado = planes.find(p => p.nivel.includes('Nivel 1 Test Ingesta'));
    expect(encontrado).toBeDefined();
    expect(encontrado?.totalHorasSemanalesObligatorias).toBe(10);
    expect(encontrado?.decretoSupremo).toBe('Decreto Supremo de Educación N° 10/2022');
  });

  it('importa planes de estudio desde un arreglo genérico de planes en JSON', async () => {
    const jsonGenerico = JSON.stringify([
      {
        id: 'plan-generico-robotica',
        nivel: 'Taller de Inteligencia Artificial y Robótica Educativa',
        categoria: 'MEDIA_TP',
        regimen: 'JEC',
        totalHorasSemanalesObligatorias: 36,
        horasLibreDisposicion: 6,
        totalHorasPlan: 42,
        asignaturas: [
          { nombre: 'Fundamentos de IA y Algoritmos', horasSemanales: 12, caracter: 'Obligatoria' },
          { nombre: 'Diseño Mecatrónico', horasSemanales: 10, caracter: 'Obligatoria' },
          { nombre: 'Programación en Python/C++', horasSemanales: 8, caracter: 'Obligatoria' },
          { nombre: 'Lenguaje y Comunicación', horasSemanales: 6, caracter: 'Obligatoria' }
        ]
      }
    ]);

    const res = await importarPlanesEstudioDesdeJson(jsonGenerico);
    expect(res.exito).toBe(true);
    expect(res.planesInsertados).toBe(1);

    const plan = await obtenerPlanEstudioPorId('plan-generico-robotica');
    expect(plan).toBeDefined();
    expect(plan?.totalHorasPlan).toBe(42);
    expect(plan?.asignaturas.length).toBe(4);
  });

  it('importa planes de estudio desde un archivo Excel simulado en memoria', async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('1. Resumen de Planes');
    ws.addRow(['ID Plan', 'Nivel / Modalidad', 'Categoría', 'Régimen', 'Decreto Supremo', 'Hrs. Obligatorias', 'Hrs. Libre Disp', 'Total Horas Plan', 'Total Horas Anuales']);
    ws.addRow(['plan-excel-test', '4° Medio Especialidad Minería y Metalurgia', 'MEDIA_TP', 'JEC', 'Decreto N° 452/2013', 38, 4, 42, 1512]);

    const wsAsigs = wb.addWorksheet('2. Detalle Asignaturas');
    wsAsigs.addRow(['ID Plan', 'Nivel del Plan', 'Categoría', 'Ámbito Formativo', 'Nombre Asignatura', 'Horas Semanales', 'Horas Anuales', 'Carácter']);
    wsAsigs.addRow(['plan-excel-test', '4° Medio Especialidad Minería y Metalurgia', 'MEDIA_TP', 'Formación Diferenciada TP', 'Procesos de Lixiviación y Flotación', 14, 504, 'Obligatoria']);
    wsAsigs.addRow(['plan-excel-test', '4° Medio Especialidad Minería y Metalurgia', 'MEDIA_TP', 'Formación General', 'Matemática Aplicada a Minería', 8, 288, 'Obligatoria']);

    const buffer = await wb.xlsx.writeBuffer();
    const res = await importarPlanesEstudioDesdeExcel(buffer);

    expect(res.exito).toBe(true);
    expect(res.planesInsertados).toBe(1);

    const planCargado = await obtenerPlanEstudioPorId('plan-excel-test');
    expect(planCargado).toBeDefined();
    expect(planCargado?.nivel).toBe('4° Medio Especialidad Minería y Metalurgia');
    expect(planCargado?.totalHorasPlan).toBe(42);
    expect(planCargado?.asignaturas.length).toBe(2);
  });
});
