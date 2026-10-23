import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import ExcelJS from 'exceljs';
import {
  evaluarVlookupPal,
  formatRut,
  homologarDocenteAPal,
  homologarAsistenteAPal,
  inferirPropuestaGdp,
  sanitizeExcelText,
  TABLA_65_35_OFICIAL,
  TABLA_60_40_OFICIAL
} from '../src/services/depHomologationEngine';
import { Docente, AsistenteEducacion, Establecimiento } from '../src/types';
import { generarExcelConsolidadoPalDEP } from '../src/services/depPalExportService';
import { generarExcelGdpColegio } from '../src/services/depGdpExportService';

describe('Motor de Homologación DEP (PAL y GDP)', () => {
  it('formatea correctamente los RUN con puntos y guion', () => {
    expect(formatRut('100057115')).toBe('10.005.711-5');
    expect(formatRut('10.005.711-5')).toBe('10.005.711-5');
    expect(formatRut('12345678k')).toBe('12.345.678-K');
  });

  it('evalúa exactamente el VLOOKUP en Tabla 65-35 y Tabla 60-40', () => {
    const res65 = evaluarVlookupPal(38, '65/35');
    expect(res65.lectivasCrono).toBe(28.5);
    expect(res65.noLectivasCrono).toBe(15.5);

    const res60 = evaluarVlookupPal(35, '60/40');
    expect(res60.lectivasCrono).toBe(26.25);
    expect(res60.noLectivasCrono).toBe(17.75);
  });

  it('homologa un Docente con jornada 44 hrs y asegura cuadratura J = N + O + P + Q + R', () => {
    const est: Establecimiento = {
      id: 'est_3659',
      rbd: '3659',
      nombre: 'ESCUELA ARTURO MERINO BENITEZ',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 85 // >= 80% aplica 60/40
    };

    const doc: Docente = {
      id: 'doc_1',
      rbd: '3659',
      run: '10.123.456-7',
      nombres: 'JUAN PEREZ',
      apellidos: 'GOMEZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      horasAula: 35,
      cargoInstitucional: 'DOCENTE DE AULA'
    };

    const filas = homologarDocenteAPal(doc, est, [], []);
    expect(filas.length).toBe(1);
    const f = filas[0];

    expect(f.proporcionHa).toBe('60/40');
    expect(f.totalHrsContrato).toBe(44);
    expect(f.hrsLectivasBasica).toBe(35);

    // Evaluar N y O
    const { lectivasCrono, noLectivasCrono } = evaluarVlookupPal(35, '60/40');
    expect(lectivasCrono).toBe(26.25);
    expect(noLectivasCrono).toBe(17.75);

    const sumaTotal = lectivasCrono + noLectivasCrono + f.hrsPieCronologicas + f.hrsSepCronologicas + f.otrasFuncionesNoLectivas;
    expect(Math.abs(sumaTotal - f.totalHrsContrato)).toBeLessThan(0.01);
  });

  it('desdobla un Docente con contratos mixtos Titular y Contrata (Regla 33 DEP)', () => {
    const est: Establecimiento = {
      id: 'est_3663',
      rbd: '3663',
      nombre: 'ESCUELA REPUBLICA DE MEXICO',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 70 // 65/35
    };

    const doc: Docente = {
      id: 'doc_mixto',
      rbd: '3663',
      run: '12.345.678-9',
      nombres: 'MARIA',
      apellidos: 'LOPEZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 30,
      horasSepContrata: 14,
      horasAula: 30
    };

    const filas = homologarDocenteAPal(doc, est, [], []);
    expect(filas.length).toBe(2);
    expect(filas[0].calidadContrato).toBe('Titular');
    expect(filas[0].totalHrsContrato).toBe(30);
    expect(filas[1].calidadContrato).toBe('Plazo Fijo');
    expect(filas[1].totalHrsContrato).toBe(14);
    expect(filas[0].totalHrsContrato + filas[1].totalHrsContrato).toBe(44);
  });

  it('homologa un Asistente de la Educación cuadrando exactamente Col I = J + K + L', () => {
    const est: Establecimiento = {
      id: 'est_3659',
      rbd: '3659',
      nombre: 'ESCUELA ARTURO MERINO BENITEZ',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 75
    };

    const ae: AsistenteEducacion = {
      id: 'ae_1',
      rbd: '3659',
      periodo: 2026,
      run: '15.678.901-2',
      nombres: 'CARLOS',
      apellidos: 'SILVA',
      cargoFuncion: 'PSICOLOGO PIE',
      estamento: 'PROFESIONAL',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 20,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 24,
      horasPiePlazoFijo: 0,
      activo: true
    };

    const filas = homologarAsistenteAPal(ae, est);
    expect(filas.length).toBe(1);
    const f = filas[0];
    expect(f.funcion).toBe('Profesionales');
    expect(f.totalHrsContrato).toBe(44);
    expect(f.hrsLectivasSubvGeneral + f.hrsPie + f.hrsSep).toBe(44);
  });
});

describe('Generación de Libros Excel Oficiales (PAL 2027 y GDP)', () => {
  const est: Establecimiento = {
    id: 'est_3659',
    rbd: '3659',
    nombre: 'ESCUELA ARTURO MERINO BENITEZ',
    comuna: 'Chillán',
    regimen: 'JEC',
    porcentajePrioritarios: 82,
    subvencionSepMensual: 15000000,
    subvencionProRetencion: 3500000,
    cupoHorasPieDiferencial: 88,
    cupoHorasPieAsistentes: 44
  };

  const docentes: Docente[] = [
    {
      id: 'doc_1',
      rbd: '3659',
      run: '10.005.711-5',
      nombres: 'MARIO',
      apellidos: 'SOTO',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      horasAula: 35,
      cargoInstitucional: 'DOCENTE DE AULA'
    },
    {
      id: 'doc_pie',
      rbd: '3659',
      run: '14.555.666-7',
      nombres: 'ANA',
      apellidos: 'DURAN',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 44,
      horasPieContrata: 44,
      cargoInstitucional: 'DOCENTE DIFERENCIAL'
    }
  ];

  const asistentes: AsistenteEducacion[] = [
    {
      id: 'ae_1',
      rbd: '3659',
      periodo: 2026,
      run: '16.777.888-9',
      nombres: 'PEDRO',
      apellidos: 'CASTRO',
      cargoFuncion: 'AUXILIAR DE SERVICIOS',
      estamento: 'AUXILIAR',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 44,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      activo: true
    }
  ];

  it('sanitizeExcelText neutraliza inyecciones de fórmulas maliciosas', () => {
    expect(sanitizeExcelText('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(sanitizeExcelText('+12345678')).toBe("'+12345678");
    expect(sanitizeExcelText('-cmd|/C calc!A0')).toBe("'-cmd|/C calc!A0");
    expect(sanitizeExcelText('@SUM(B1)')).toBe("'@SUM(B1)");
    expect(sanitizeExcelText('Docente Regular')).toBe('Docente Regular');
    expect(sanitizeExcelText(null)).toBe('');
  });

  it('genera la Planilla Final PAL 2027 DEP preservando fórmulas nativas de Excel', async () => {
    const bytes = await generarExcelConsolidadoPalDEP([est], docentes, asistentes);
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(100000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as any);

    const wsDoc = wb.getWorksheet('Info Funcionario (DOCENTE)');
    expect(wsDoc).toBeDefined();

    // Fila 3 debe tener la fórmula nativa en Cols N y O
    const row3 = wsDoc!.getRow(3);
    expect(row3.getCell(1).value).toBe('10.005.711-5');
    expect(row3.getCell(3).value).toBe(3659);
    expect(typeof row3.getCell(14).value).toBe('object'); // Celda con fórmula
    expect((row3.getCell(14).value as any).formula).toContain('VLOOKUP');
    expect((row3.getCell(15).value as any).formula).toContain('VLOOKUP');

    // Hoja Resumen no debe estar corrupta
    const wsResumen = wb.getWorksheet('Resumen');
    expect(wsResumen).toBeDefined();
    expect(wsResumen!.getCell('B3').value).toBeDefined();
  }, 15000);

  it('genera la Planilla GDP oficial del colegio con sus 6 hojas y fórmulas nativas', async () => {
    const bytes = await generarExcelGdpColegio(est, docentes, asistentes);
    expect(bytes).toBeDefined();
    expect(bytes.length).toBeGreaterThan(30000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as any);

    expect(wb.getWorksheet('PIE')).toBeDefined();
    expect(wb.getWorksheet('SEP')).toBeDefined();
    expect(wb.getWorksheet('Subv. Normal - Docentes Tit')).toBeDefined();
    expect(wb.getWorksheet('Subv. Normal - Docentes Ctta.')).toBeDefined();
    expect(wb.getWorksheet('Subv. Normal AA.EE')).toBeDefined();

    const wsPie = wb.getWorksheet('PIE')!;
    // Celda M4 debe contener la fórmula del verificador
    expect(wsPie.getCell('M4').value).toBeDefined();
    expect((wsPie.getCell('M4').value as any).formula).toBe('IF(F4<>H4,"Revisar","Correcto")');
    // F4 debe tener el cupo
    expect(wsPie.getCell('F4').value).toBe(88);

    const wsSep = wb.getWorksheet('SEP')!;
    expect(wsSep.getCell('D4').value).toBe(15000000);
    // R4 debe tener la fórmula de % inversión
    expect((wsSep.getCell('R4').value as any).formula).toBe('P5/D4');
  });
});
