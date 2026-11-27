import { describe, it, expect, vi } from 'vitest';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { generarExcelConsolidadoSlep } from '../src/services/excelReportService';
import { calcularDiagnosticoColegio } from '../src/services/dotacionCalculationService';
import { exportConsolidatedExcelBrowser } from '../src/services/analizador/excelExporter';
import type { Establecimiento, Docente, AsistenteEducacion } from '../src/types';
import type { SchoolSummary, TeacherRecord } from '../src/types/analizadorTypes';
import type { AsistenteAnalizadoRecord } from '../src/services/analizador/asistentesClassifier';

vi.mock('file-saver', () => ({
  saveAs: vi.fn(),
  default: vi.fn()
}));

describe('Exportación Consolidado SLEP con Asistentes de la Educación', () => {
  const establecimientos: Establecimiento[] = [
    {
      id: 'est-1',
      rbd: '3638',
      nombre: 'LICEO MARTA BRUNET',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 60
    },
    {
      id: 'est-2',
      rbd: '3976',
      nombre: 'LICEO MANUEL BULNES',
      comuna: 'Bulnes',
      regimen: 'JEC',
      porcentajePrioritarios: 70
    }
  ];

  const docentes: Docente[] = [
    {
      id: 'doc-1',
      rbd: '3638',
      run: '12.345.678-9',
      nombres: 'María',
      apellidos: 'Pérez',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      horasSubvencionGeneralContrata: 0,
      horasSepTitular: 0,
      horasSepContrata: 0,
      horasPieTitular: 0,
      horasPieContrata: 0,
      activo: true
    }
  ];

  const asistentes: AsistenteEducacion[] = [
    {
      id: 'asis-1',
      rbd: '3638',
      periodo: 2027,
      run: '15.111.222-3',
      nombres: 'Carla',
      apellidos: 'Soto',
      cargoFuncion: 'Psicóloga',
      estamento: 'PROFESIONAL',
      horasContrato: 30,
      horasSubvencionGeneralIndefinido: 0,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 20,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 10,
      horasPiePlazoFijo: 0,
      esDuplaPsicosocial: true,
      esEquipoPie: true,
      activo: true
    },
    {
      id: 'asis-2',
      rbd: '3976',
      periodo: 2027,
      run: '15.111.222-3',
      nombres: 'Carla',
      apellidos: 'Soto',
      cargoFuncion: 'Psicóloga',
      estamento: 'PROFESIONAL',
      horasContrato: 22,
      horasSubvencionGeneralIndefinido: 0,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 22,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      esDuplaPsicosocial: true,
      activo: true
    },
    {
      id: 'asis-inactivo',
      rbd: '3638',
      periodo: 2027,
      run: '19.999.888-7',
      nombres: 'Inactivo',
      apellidos: 'Test',
      cargoFuncion: 'Auxiliar',
      estamento: 'AUXILIAR',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 44,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      activo: false
    }
  ];

  it('generarExcelConsolidadoSlep incluye hojas y totales de asistentes de la educación', async () => {
    const diagnosticos = establecimientos.map(est =>
      calcularDiagnosticoColegio(
        est,
        [],
        [],
        docentes.filter(d => d.rbd === est.rbd),
        []
      )
    );

    const bytes = await generarExcelConsolidadoSlep(
      establecimientos,
      docentes,
      diagnosticos,
      'Asesor UATP',
      [],
      [],
      asistentes
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);

    const sheetNames = wb.worksheets.map(ws => ws.name);
    expect(sheetNames).toContain('Resumen Territorial SLEP');
    expect(sheetNames.some(n => n.startsWith('Inconsistencias y Vacantes'))).toBe(true);
    expect(sheetNames).toContain('Nómina Asistentes (Detalle)');
    expect(sheetNames).toContain('Nómina Asistentes Territorial');

    // Verificar Resumen Territorial (excluye asistente inactivo)
    const wsResumen = wb.getWorksheet('Resumen Territorial SLEP')!;
    expect(wsResumen.getRow(4).getCell(10).value).toBe('Asistentes (N°)');
    expect(wsResumen.getRow(4).getCell(11).value).toBe('Horas Asistentes');
    expect(wsResumen.getRow(5).getCell(10).value).toBe(1);
    expect(wsResumen.getRow(5).getCell(11).value).toBe(30);
    expect(wsResumen.getRow(6).getCell(10).value).toBe(1);
    expect(wsResumen.getRow(6).getCell(11).value).toBe(22);
    expect(wsResumen.getRow(7).getCell(10).value).toEqual({ formula: 'SUM(J5:J6)' });
    expect(wsResumen.getRow(7).getCell(11).value).toEqual({ formula: 'SUM(K5:K6)' });

    // Verificar Inconsistencia de exceso >44h para asistente multicontrato (30+22=52h)
    const wsCruces = wb.worksheets.find(ws => ws.name.startsWith('Inconsistencias y Vacantes'))!;
    expect(wsCruces.getRow(4).getCell(1).value).toBe('EXCESO_JORNADA_ASISTENTE');
    expect(wsCruces.getRow(4).getCell(2).value).toBe('15111222-3');
    expect(wsCruces.getRow(4).getCell(4).value).toBe(52);

    // Verificar Nómina Asistentes (Detalle)
    const wsAsisDet = wb.getWorksheet('Nómina Asistentes (Detalle)')!;
    expect(wsAsisDet.getRow(2).getCell(1).value).toBe('3638');
    expect(wsAsisDet.getRow(2).getCell(7).value).toBe(30);
    expect(wsAsisDet.getRow(3).getCell(1).value).toBe('3976');
    expect(wsAsisDet.getRow(3).getCell(7).value).toBe(22);
    expect(wsAsisDet.getRow(4).getCell(7).value).toEqual({ formula: 'SUM(G2:G3)' });

    // Verificar Nómina Asistentes Territorial
    const wsAsisTer = wb.getWorksheet('Nómina Asistentes Territorial')!;
    expect(wsAsisTer.getRow(4).getCell(1).value).toBe('15111222-3');
    expect(wsAsisTer.getRow(4).getCell(6).value).toBe(52);
    expect(wsAsisTer.getRow(4).getCell(14).value).toBe('EXCESO (+8h)');
  });

  it('exportConsolidatedExcelBrowser incluye hoja de asistentes cuando existen registros', async () => {
    const { saveAs } = await import('file-saver');
    const saveAsMock = vi.mocked(saveAs);
    saveAsMock.mockClear();

    const schools: SchoolSummary[] = [
      {
        rbd: '3638',
        establishment: 'LICEO MARTA BRUNET',
        comuna: 'Chillán',
        matricula: 500,
        horas_aula: 200,
        horas_directivas: 44,
        horas_tecnicas: 44,
        total_horas_ee: 288,
        teachers_count: 10,
        courses_count: 12,
        has_discrepancy: false
      }
    ];
    const teachers: TeacherRecord[] = [];
    const asistentesAnalizados: AsistenteAnalizadoRecord[] = [
      {
        id: 'aa-1',
        rbd: '3638',
        establishment: 'LICEO MARTA BRUNET',
        comuna: 'Chillán',
        file_name: 'test.xlsx',
        run: '15.111.222-3',
        nombres: 'Carla',
        apellidos: 'Soto',
        cargo_original: 'Psicóloga',
        cargo_estandar: 'PSICÓLOGO/A',
        estamento: 'PROFESIONAL',
        horas_contrato: 40,
        horas_subvencion_general_indefinido: 0,
        horas_subvencion_general_plazo_fijo: 0,
        horas_sep_indefinido: 40,
        horas_sep_plazo_fijo: 0,
        horas_pie_indefinido: 0,
        horas_pie_plazo_fijo: 0,
        es_dupla_psicosocial: true,
        es_equipo_pie: false,
        es_tecnico_parvulo: false,
        es_auxiliar_servicio: false,
        es_inspector_patio: false,
        confianza_ia: 'ALTA',
        fuente_clasificacion: 'REGLA_LOCAL',
        estado_cuadratura: 'CUADRADA',
        alertas: []
      }
    ];

    exportConsolidatedExcelBrowser(schools, teachers, [], [], asistentesAnalizados);

    expect(saveAsMock).toHaveBeenCalledTimes(1);
    const blobArg = saveAsMock.mock.calls[0][0] as Blob;
    const buffer = await blobArg.arrayBuffer();
    const wbParsed = XLSX.read(buffer, { type: 'array' });
    expect(wbParsed.SheetNames).toContain('CONSOLIDADO SLEP');
    expect(wbParsed.SheetNames).toContain('ASISTENTES DE LA EDUCACIÓN');
    const consolidadoRows = XLSX.utils.sheet_to_json<any[]>(wbParsed.Sheets['CONSOLIDADO SLEP'], { header: 1 });
    expect(consolidadoRows[3]).toContain('ASISTENTES (N°)');
    expect(consolidadoRows[3]).toContain('HORAS ASISTENTES');
    expect(consolidadoRows[4]).toContain(1);
    expect(consolidadoRows[4]).toContain(40);
  });
});
