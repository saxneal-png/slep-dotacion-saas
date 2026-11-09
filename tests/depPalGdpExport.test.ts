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
import { generarExcelConsolidadoPalDEP, calcularHorasContratoPorPlan } from '../src/services/depPalExportService';
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

  it('desdobla un Docente con horas en ambas proporciones (65/35 y 60/40) en dos filas con Columna M correspondiente', () => {
    // Escuela con 70% prioritarios: Ciclo inicial (Prekínder a 4° Básico) es 60/40, de 5° Básico en adelante es 65/35
    const est: Establecimiento = {
      id: 'est_3672',
      rbd: '3672',
      nombre: 'ESC. BASICA ARTURO MUTIZABAL SOTOMAYOR',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 70
    };

    const cursosColegio: any[] = [
      { id: 'c_2b', rbd: '3672', nivel: '2° Básico', letra: 'A', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 20 },
      { id: 'c_6b', rbd: '3672', nivel: '6° Básico', letra: 'A', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 20 }
    ];

    const docMultitramo: Docente = {
      id: 'doc_multi',
      rbd: '3672',
      run: '14.567.890-1',
      nombres: 'PATRICIO',
      apellidos: 'CONTRERAS',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      cargoInstitucional: 'DOCENTE DE AULA'
    };

    // 16 horas en 2° Básico (régimen 60/40, req 22 hrs) y 17 horas en 6° Básico (régimen 65/35, req 22 hrs)
    // Suman exactamente 44 hrs de jornada de contrato completa
    const asigs: any[] = [
      { id: 'asig_1', rbd: '3672', cursoId: 'c_2b', docenteId: 'doc_multi', asignatura: 'Lenguaje 2B', horasPedagogicasAula: 16 },
      { id: 'asig_2', rbd: '3672', cursoId: 'c_6b', docenteId: 'doc_multi', asignatura: 'Matemática 6B', horasPedagogicasAula: 17 }
    ];

    const filas = homologarDocenteAPal(docMultitramo, est, cursosColegio, asigs);
    expect(filas.length).toBe(2);

    const fila65 = filas.find(f => f.proporcionHa === '65/35');
    const fila60 = filas.find(f => f.proporcionHa === '60/40');

    expect(fila65).toBeDefined();
    expect(fila60).toBeDefined();

    // Verificación de horas aula por tramo
    expect(fila65!.hrsLectivasBasica).toBe(17);
    expect(fila60!.hrsLectivasBasica).toBe(16);

    // Verificación de Columna M seleccionada
    expect(fila65!.proporcionHa).toBe('65/35');
    expect(fila60!.proporcionHa).toBe('60/40');

    // Cuadratura de jornada total: la suma debe ser exactamente 44 hrs
    expect(fila65!.totalHrsContrato + fila60!.totalHrsContrato).toBe(44);

    // Cuadratura matemática de cada fila con fórmulas VLOOKUP
    const v65 = evaluarVlookupPal(fila65!.hrsLectivasBasica + fila65!.hrsLectivasMedia, '65/35');
    const suma65 = v65.lectivasCrono + v65.noLectivasCrono + fila65!.hrsPieCronologicas + fila65!.hrsSepCronologicas + fila65!.otrasFuncionesNoLectivas;
    expect(Math.abs(suma65 - fila65!.totalHrsContrato)).toBeLessThan(0.01);

    const v60 = evaluarVlookupPal(fila60!.hrsLectivasBasica + fila60!.hrsLectivasMedia, '60/40');
    const suma60 = v60.lectivasCrono + v60.noLectivasCrono + fila60!.hrsPieCronologicas + fila60!.hrsSepCronologicas + fila60!.otrasFuncionesNoLectivas;
    expect(Math.abs(suma60 - fila60!.totalHrsContrato)).toBeLessThan(0.01);
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

    // Verificación de sincronización de Info Establecimiento
    const wsEst = wb.getWorksheet('Info Establecimiento');
    expect(wsEst).toBeDefined();
    const rowRbd3659 = wsEst!.getRow(4); // o buscar fila con 3659
    let encontradaFila3659 = false;
    wsEst!.eachRow((r, n) => {
      if (n > 3 && Number(r.getCell(2).value) === 3659) {
        encontradaFila3659 = true;
        expect(r.getCell(7).value).toBeDefined(); // Fórmula +E*F
        expect((r.getCell(7).value as any).formula).toContain('+E');
      }
    });
    expect(encontradaFila3659).toBe(true);

    // Test de inclusión de asignaturas adicionales excluyendo PIE
    const curso1B = {
      id: 'cur_1b',
      rbd: '3659',
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC' as const,
      cupoSae: 30,
      matriculaProyectada: 25,
      alumnosNeet: 5,
      alumnosNeep: 2
    };

    const asigs: any[] = [
      { id: 'a1', rbd: '3659', cursoId: 'cur_1b', docenteId: 'doc_1', asignatura: 'Lenguaje', horasPedagogicasAula: 8 },
      { id: 'a2', rbd: '3659', cursoId: 'cur_1b', docenteId: 'doc_1', asignatura: 'Matemática', horasPedagogicasAula: 8 },
      { id: 'a3', rbd: '3659', cursoId: 'cur_1b', docenteId: 'doc_1', asignatura: 'Taller Robótica Adicional', horasPedagogicasAula: 4 }, // Adicional no PIE
      { id: 'a4', rbd: '3659', cursoId: 'cur_1b', docenteId: 'doc_pie', asignatura: 'Apoyo Aula de Recursos PIE', horasPedagogicasAula: 10, tipoApoyo: 'PIE' } // Debe excluirse
    ];

    const bytesConAsigs = await generarExcelConsolidadoPalDEP([est], docentes, asistentes, [curso1B], asigs);
    const wbConAsigs = new ExcelJS.Workbook();
    await wbConAsigs.xlsx.load(bytesConAsigs as any);
    const wsEstConAsigs = wbConAsigs.getWorksheet('Info Establecimiento')!;

    let fila1B: any = null;
    wsEstConAsigs.eachRow((r, n) => {
      if (n > 3 && Number(r.getCell(2).value) === 3659 && r.getCell(3).text.includes('1° Básico')) {
        fila1B = r;
      }
    });

    expect(fila1B).toBeDefined();
    // Alternativa 1: La matrícula por nivel es la del SaaS ingresada/proyectada por el director (25)
    expect(Number(fila1B.getCell(4).value)).toBe(25); // Matricula directa del SaaS
    // Los cursos por nivel y las horas plan son los existentes y trabajados en el SaaS
    expect(Number(fila1B.getCell(5).value)).toBe(1);  // Cursos del SaaS
    expect(Number(fila1B.getCell(6).value)).toBe(38); // Horas Plan del SaaS (38h JEC)
    // Total horas docentes Col H calcula las horas contractuales reglamentarias según tabla oficial
    // En 60/40 (est con 85% prioritarios): Math.ceil(38 * 44 / 35) = 48 horas de contrato
    expect(Number(fila1B.getCell(8).value)).toBe(48);
  }, 15000);

  it('exporta cursos multigrado / combinados asignando la titularidad sin duplicar cursos, sin matrícula externa y erradicando horas residuales', async () => {
    const estRural: Establecimiento = {
      id: 'est_3691',
      rbd: '3691',
      nombre: 'ESCUELA PAUL HARRIS',
      comuna: 'CHILLAN',
      porcentajePrioritarios: 85
    };

    const cursoCombinado: CursoSae = {
      id: 'cur_comb_1_2',
      rbd: '3691',
      nivel: 'Combinado 1°-2° Básico',
      letra: 'U',
      regimen: 'JEC',
      cupoSae: 20,
      matriculaProyectada: 16,
      alumnosNeet: 0,
      alumnosNeep: 0,
      esCombinado: true,
      gradosCombinados: ['1° Básico', '2° Básico']
    };

    const bytes = await generarExcelConsolidadoPalDEP([estRural], [], [], [cursoCombinado]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as any);
    const wsEst = wb.getWorksheet('Info Establecimiento')!;

    let f1B: any = null;
    let f2B: any = null;
    let f3B: any = null;

    wsEst.eachRow((r, n) => {
      if (n > 3 && Number(r.getCell(2).value) === 3691) {
        if (r.getCell(3).text.includes('1°') || r.getCell(3).text.includes('Combinado')) f1B = r;
        if (r.getCell(3).text.includes('2° Básico')) f2B = r;
        if (r.getCell(3).text.includes('3° Básico')) f3B = r;
      }
    });

    expect(f1B).toBeDefined();
    expect(f2B).toBeDefined();

    // El curso combinado es computado en el grado titular con su matrícula y horas 100% reales del SaaS
    expect(Number(f1B.getCell(4).value)).toBe(16); // Matrícula real del SaaS
    expect(Number(f1B.getCell(5).value)).toBe(1);  // 1 curso combinado
    expect(Number(f1B.getCell(6).value)).toBe(38); // 38 hrs plan del SaaS
    expect(Number(f1B.getCell(8).value)).toBe(48); // 48 hrs docente contrato (60/40)

    // El grado secundario integrado en el multigrado queda en 0 absoluto para no duplicar dotación ni arrastrar residuos
    expect(Number(f2B.getCell(4).value)).toBe(0);
    expect(Number(f2B.getCell(5).value)).toBe(0);
    expect(Number(f2B.getCell(6).value)).toBe(0); // Sin residuos de 40 hrs
    expect(Number(f2B.getCell(8).value)).toBe(0);

    // Filas no existentes en el SaaS (ej: 3° Básico) quedan purgadas a 0
    if (f3B) {
      expect(Number(f3B.getCell(4).value)).toBe(0);
      expect(Number(f3B.getCell(5).value)).toBe(0);
      expect(Number(f3B.getCell(6).value)).toBe(0); // Sin residuos de 40 hrs
      expect(Number(f3B.getCell(8).value)).toBe(0);
    }
  }, 15000);

  it('incluye dinámicamente colegios ausentes en la plantilla ministerial base preservando fórmulas nativas', async () => {
    // RBD 34591 es uno de los 47 colegios que no venían originalmente en la hoja Info Establecimiento del template DEP
    const estNuevo: Establecimiento = {
      id: 'est_34591',
      rbd: '34591',
      nombre: 'SALA CUNA Y JARDIN INFANTIL EL MANZANITO',
      comuna: 'SAN CARLOS',
      porcentajePrioritarios: 82
    };

    const cursoParv: CursoSae = {
      id: 'cur_manzanito_1',
      rbd: '34591',
      nivel: 'Medio Menor y Mayor',
      letra: 'A',
      regimen: 'No JEC',
      cupoSae: 24,
      matriculaProyectada: 20,
      alumnosNeet: 0,
      alumnosNeep: 0
    };

    const bytes = await generarExcelConsolidadoPalDEP([estNuevo], [], [], [cursoParv]);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as any);
    const wsEst = wb.getWorksheet('Info Establecimiento')!;

    let filaNueva: any = null;
    wsEst.eachRow((r, n) => {
      if (n > 3 && Number(r.getCell(2).value) === 34591) {
        filaNueva = r;
      }
    });

    expect(filaNueva).toBeDefined();
    expect(filaNueva.getCell(1).text).toContain('EL MANZANITO');
    expect(Number(filaNueva.getCell(2).value)).toBe(34591);
    expect(filaNueva.getCell(3).text).toBe('Medio Menor y Mayor');
    expect(Number(filaNueva.getCell(4).value)).toBe(20);
    expect(Number(filaNueva.getCell(5).value)).toBe(1);
    expect(Number(filaNueva.getCell(6).value)).toBeGreaterThan(0);
    // La fórmula nativa =+E*F debe estar presente y referenciar a su fila
    const formulaCell = filaNueva.getCell(7).value;
    expect(typeof formulaCell === 'object' && 'formula' in formulaCell).toBe(true);
  }, 15000);

  it('calcula con precisión matemática las horas de contrato docente reglamentarias según tabla MINEDUC (65/35 y 60/40)', () => {
    // Régimen Regular 65/35 (Max HA = 38 por 44 hrs)
    expect(calcularHorasContratoPorPlan(0, '65_35')).toBe(0);
    expect(calcularHorasContratoPorPlan(22, '65_35')).toBe(26);
    expect(calcularHorasContratoPorPlan(38, '65_35')).toBe(44);
    expect(calcularHorasContratoPorPlan(40, '65_35')).toBe(47);
    expect(calcularHorasContratoPorPlan(42, '65_35')).toBe(49);
    expect(calcularHorasContratoPorPlan(80, '65_35')).toBe(93);

    // Régimen Vulnerable 60/40 (Max HA = 35 por 44 hrs)
    expect(calcularHorasContratoPorPlan(0, '60_40')).toBe(0);
    expect(calcularHorasContratoPorPlan(30, '60_40')).toBe(38);
    expect(calcularHorasContratoPorPlan(35, '60_40')).toBe(44);
    expect(calcularHorasContratoPorPlan(38, '60_40')).toBe(48);
    expect(calcularHorasContratoPorPlan(40, '60_40')).toBe(51);
    expect(calcularHorasContratoPorPlan(80, '60_40')).toBe(101);
  });

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
