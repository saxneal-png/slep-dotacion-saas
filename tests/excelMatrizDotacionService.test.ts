import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  generarExcelMatrizDotacionColegio,
  obtenerEtiquetaCortaCurso,
  ordenarCursosEstablecimiento,
  clasificarDocentesEnSecciones,
  generarVeredictoAuditoria,
  getColumnLetter
} from '../src/services/excelMatrizDotacionService';
import { Establecimiento, Docente, CursoSae, AsignacionHoraria } from '../src/types';

describe('excelMatrizDotacionService', () => {
  it('genera correctamente las letras de columnas', () => {
    expect(getColumnLetter(1)).toBe('A');
    expect(getColumnLetter(2)).toBe('B');
    expect(getColumnLetter(26)).toBe('Z');
    expect(getColumnLetter(27)).toBe('AA');
    expect(getColumnLetter(28)).toBe('AB');
  });

  it('evalúa correctamente los veredictos de auditoría contractual', () => {
    // 1. Caso cuadrado exacto
    const cuadrado = generarVeredictoAuditoria(44, 44, 44);
    expect(cuadrado.texto).toContain('✓ Dotación cuadrada');
    expect(cuadrado.esAlerta).toBe(false);

    // 2. Caso con holgura (horas vacantes)
    const holgura = generarVeredictoAuditoria(43, 42, 39);
    expect(holgura.texto).toContain('⚠ Holgura: Realiza 42h de 43h (1h vacantes)');
    expect(holgura.esAlerta).toBe(true);

    // 3. Caso sobreasignado
    const sobre = generarVeredictoAuditoria(30, 35, 35);
    expect(sobre.texto).toContain('🚨 Sobreasignado: Asignadas 35h para 30h (+5h exceso)');
    expect(sobre.esAlerta).toBe(true);

    // 4. Caso con Art. 69 e IA
    const art69 = generarVeredictoAuditoria(44, 44, 44, true, 'Observación Gemini');
    expect(art69.texto).toContain('Art. 69');
    expect(art69.texto).toContain('[IA] Observación Gemini');
  });

  it('obtiene etiquetas cortas estándar para cursos chilenos', () => {
    expect(obtenerEtiquetaCortaCurso('Pre-Kínder', 'A')).toBe('PkA');
    expect(obtenerEtiquetaCortaCurso('Kínder', 'B')).toBe('KB');
    expect(obtenerEtiquetaCortaCurso('1° Básico', 'A')).toBe('1A');
    expect(obtenerEtiquetaCortaCurso('1° Básico', 'B')).toBe('1B');
    expect(obtenerEtiquetaCortaCurso('8° Básico', 'C')).toBe('8C');
    expect(obtenerEtiquetaCortaCurso('1° Medio', 'A')).toBe('1MA');
    expect(obtenerEtiquetaCortaCurso('4° Medio', 'B')).toBe('4MB');
  });

  it('ordena los cursos por nivel educativo de forma natural', () => {
    const cursos: CursoSae[] = [
      { id: 'c3', rbd: '3641', nivel: '8° Básico', letra: 'A', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 30, alumnosNeet: 0, alumnosNeep: 0 },
      { id: 'c1', rbd: '3641', nivel: 'Pre-Kínder', letra: 'A', regimen: 'No JEC', cupoSae: 25, matriculaProyectada: 25, alumnosNeet: 0, alumnosNeep: 0 },
      { id: 'c2', rbd: '3641', nivel: '1° Básico', letra: 'B', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 30, alumnosNeet: 0, alumnosNeep: 0 },
      { id: 'c4', rbd: '3641', nivel: '1° Básico', letra: 'A', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 30, alumnosNeet: 0, alumnosNeep: 0 }
    ];

    const ordenados = ordenarCursosEstablecimiento(cursos);
    expect(ordenados.map(c => `${c.nivel} ${c.letra}`)).toEqual([
      'Pre-Kínder A',
      '1° Básico A',
      '1° Básico B',
      '8° Básico A'
    ]);
  });

  it('clasifica correctamente a los docentes en Sección 1 (Plan de Estudio) y Sección 2 (PIE/Codocentes/Directivos)', () => {
    const docAula: Docente = {
      id: 'doc-1',
      rbd: '3641',
      run: '11.111.111-1',
      nombres: 'Juan',
      apellidos: 'Pérez',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44
    };

    const docPie: Docente = {
      id: 'doc-2',
      rbd: '3641',
      run: '22.222.222-2',
      nombres: 'María',
      apellidos: 'Gómez',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 32,
      horasPieContrata: 32
    };

    const docDirectivo: Docente = {
      id: 'doc-3',
      rbd: '3641',
      run: '33.333.333-3',
      nombres: 'Pedro',
      apellidos: 'López',
      calidadJuridica: 'TITULAR',
      estamento: 'DIRECTIVO',
      horasContrato: 44,
      horasDirectivas: 44
    };

    const asigs: AsignacionHoraria[] = [
      { id: 'a1', rbd: '3641', docenteId: 'doc-1', cursoId: 'c1', asignatura: 'Lenguaje', horasPedagogicasAula: 8 },
      { id: 'a2', rbd: '3641', docenteId: 'doc-2', cursoId: 'c1', asignatura: 'Co-docencia', horasPedagogicasAula: 32, esCoDocencia: true }
    ];

    const res = clasificarDocentesEnSecciones([docAula, docPie, docDirectivo], asigs);
    expect(res.seccion1_PlanEstudio.map(d => d.id)).toEqual(['doc-1']);
    expect(res.seccion2_ApoyoYDirectivos.map(d => d.id)).toEqual(['doc-2', 'doc-3']);
  });

  it('genera un archivo Excel válido con estructura de dos secciones, totales de curso y formato [h]:mm', async () => {
    const establecimiento: Establecimiento = {
      id: 'est-3641',
      rbd: '3641',
      nombre: 'Escuela Rural El Carmen',
      comuna: 'El Carmen',
      regimen: 'JEC',
      porcentajePrioritarios: 75,
      director: 'Director Prueba',
      asesorUatp: 'Asesor UATP'
    };

    const cursos: CursoSae[] = [
      { id: 'c-1b', rbd: '3641', nivel: '1° Básico', letra: 'B', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 30, alumnosNeet: 0, alumnosNeep: 0 }
    ];

    const docenteAula: Docente = {
      id: 'doc-1',
      rbd: '3641',
      run: '22.250.8874-4',
      nombres: 'Magdielin',
      apellidos: 'Bravo de Peralta Reyes',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 42,
      horasSubvencionGeneralContrata: 35,
      horasSepContrata: 4,
      horasPieContrata: 3,
      cargoInstitucional: 'Coordinación Ciclo'
    };

    const docentePie: Docente = {
      id: 'doc-2',
      rbd: '3641',
      run: '18.281.913-1',
      nombres: 'Natalia',
      apellidos: 'Bórquez Barría',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_DIFERENCIAL',
      horasContrato: 39,
      horasPieContrata: 39
    };

    const asignaciones: AsignacionHoraria[] = [
      { id: 'a-1', rbd: '3641', cursoId: 'c-1b', docenteId: 'doc-1', asignatura: 'Lenguaje', horasPedagogicasAula: 8 },
      { id: 'a-2', rbd: '3641', cursoId: 'c-1b', docenteId: 'doc-1', asignatura: 'Matemáticas', horasPedagogicasAula: 6 },
      { id: 'a-3', rbd: '3641', cursoId: 'c-1b', docenteId: 'doc-2', asignatura: 'Aula común y aula de recursos', horasPedagogicasAula: 11, horasCronologicasPie: 11 }
    ];

    const buffer = await generarExcelMatrizDotacionColegio(
      establecimiento,
      [docenteAula, docentePie],
      cursos,
      asignaciones
    );

    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(1000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    expect(ws).toBeDefined();

    // Validar encabezado Sección 1
    expect(ws.getRow(1).getCell(3).value).toContain('HORAS');
    expect(ws.getRow(1).getCell(10).value).toBe('1B');

    // Validar Docente de Sección 1
    expect(ws.getRow(2).getCell(1).value).toBe('Bravo de Peralta Reyes, Magdielin');

    // Validar que existe la fila de totales de cursos y el banner de Sección 2
    let tieneFilaTotalCursos = false;
    let tieneBannerSeccion2 = false;
    let tieneDocenteSeccion2 = false;

    ws.eachRow((row) => {
      const v = String(row.getCell(1).value || '');
      if (v.includes('TOTAL CARGA LECTIVA CURSOS')) tieneFilaTotalCursos = true;
      if (v.includes('APARTADO 2')) tieneBannerSeccion2 = true;
      if (v.includes('Bórquez Barría, Natalia')) tieneDocenteSeccion2 = true;
    });

    expect(tieneFilaTotalCursos).toBe(true);
    expect(tieneBannerSeccion2).toBe(true);
    expect(tieneDocenteSeccion2).toBe(true);
  });

  it('calcula las proporciones normativas basadas en horas aula y refleja holguras en la auditoría', async () => {
    const establecimiento: Establecimiento = {
      id: 'est-3641',
      rbd: '3641',
      nombre: 'Escuela República de México',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 75,
      director: 'Director Prueba',
      asesorUatp: 'Asesor UATP'
    };

    const cursos: CursoSae[] = [
      { id: 'c-1a', rbd: '3641', nivel: '1° Básico', letra: 'A', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 30, alumnosNeet: 0, alumnosNeep: 0 }
    ];

    // Docente: 43 hrs contrato (40 SubGral, 3 PIE) con 34 HA asignadas
    // 34 HA según tabla oficial MINEDUC 65/35 -> 39h requeridas (25:30 aula + 2:40 recreo + 10:50 HNL)
    // Carga efectiva = 39h SubGral + 3h PIE = 42h. Holgura = 43 - 42 = 1h vacante.
    const docenteAlonzo: Docente = {
      id: 'doc-alonzo',
      rbd: '3641',
      run: '23.455.981-8',
      nombres: 'Josefina',
      apellidos: 'Alonzo Gómez',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 43,
      horasSubvencionGeneralTitular: 40,
      horasPieContrata: 3
    };

    const asignaciones: AsignacionHoraria[] = [
      { id: 'a-1', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Lenguaje y Comunicación', horasPedagogicasAula: 8 },
      { id: 'a-2', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Matemática', horasPedagogicasAula: 6 },
      { id: 'a-3', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Historia', horasPedagogicasAula: 3 },
      { id: 'a-4', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Ciencias Naturales', horasPedagogicasAula: 3 },
      { id: 'a-5', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Artes Visuales', horasPedagogicasAula: 2 },
      { id: 'a-6', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Tecnología', horasPedagogicasAula: 1 },
      { id: 'a-7', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Música', horasPedagogicasAula: 6 },
      { id: 'a-8', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Orientación', horasPedagogicasAula: 1 },
      { id: 'a-9', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Taller socioemocional', horasPedagogicasAula: 2 },
      { id: 'a-10', rbd: '3641', cursoId: 'c-1a', docenteId: 'doc-alonzo', asignatura: 'Taller AELE', horasPedagogicasAula: 2 }
    ];

    const buffer = await generarExcelMatrizDotacionColegio(
      establecimiento,
      [docenteAlonzo],
      cursos,
      asignaciones
    );

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    // Buscar la fila Total del docente
    let filaTotalDocente: ExcelJS.Row | null = null;
    let filaMaestraDocente: ExcelJS.Row | null = null;
    ws.eachRow((row) => {
      if (row.getCell(1).value === 'Total') {
        filaTotalDocente = row;
      }
      if (String(row.getCell(1).value || '').includes('Alonzo Gómez')) {
        filaMaestraDocente = row;
      }
    });

    expect(filaTotalDocente).not.toBeNull();
    expect(filaMaestraDocente).not.toBeNull();

    const colTotalHa = 11; // 1 curso -> col 10 es 1A, col 11 es TOTAL HA*
    const colSubGral = 12;
    const colSep = 13;
    const colPie = 14;
    const colTotalHc = 15;
    const colObservaciones = 16;

    // TOTAL HA* debe ser 34
    expect(filaTotalDocente!.getCell(colTotalHa).value).toEqual({
      formula: 'SUM(K3:K12)'
    });

    const getHoras = (cellVal: any): number => {
      const res = cellVal?.result !== undefined ? cellVal.result : cellVal;
      if (typeof res === 'number') return res * 24;
      if (res instanceof Date) {
        // ExcelJS interpreta números > 1 con formato de fecha/hora como fecha desde epoch 1899-12-30
        const epoch = new Date(Date.UTC(1899, 11, 30, 0, 0, 0)).getTime();
        return (res.getTime() - epoch) / (1000 * 60 * 60);
      }
      return 0;
    };

    // SubGral Total normativo para 34 HA es 39 hrs exactas cerradas
    expect(getHoras(filaTotalDocente!.getCell(colSubGral).value)).toBeCloseTo(39, 1);

    // PIE Total debe ser 3 hrs exactas cerradas
    expect(getHoras(filaTotalDocente!.getCell(colPie).value)).toBeCloseTo(3, 1);

    // TOTAL HC ejecutado debe ser 42 hrs exactas cerradas (39 + 3)
    expect(getHoras(filaTotalDocente!.getCell(colTotalHc).value)).toBeCloseTo(42, 1);

    // La columna de auditoría en la fila maestra del docente debe evidenciar la holgura de 1h
    const obsVal = String(filaMaestraDocente!.getCell(colObservaciones).value);
    expect(obsVal).toContain('⚠ Holgura: Realiza 42h de 43h (1h vacantes)');
  });
});
