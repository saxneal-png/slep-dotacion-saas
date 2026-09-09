import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import {
  generarExcelMatrizDotacionColegio,
  obtenerEtiquetaCortaCurso,
  ordenarCursosEstablecimiento,
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

  it('genera un archivo Excel válido con formato [h]:mm y estructura según el modelo', async () => {
    const establecimiento: Establecimiento = {
      id: 'est-3641',
      rbd: '3641',
      nombre: 'Escuela Rural El Carmen',
      comuna: 'El Carmen',
      regimen: 'JEC',
      porcentajePrioritarios: 75, // Régimen 65/35
      director: 'Director Prueba',
      asesorUatp: 'Asesor UATP'
    };

    const cursos: CursoSae[] = [
      { id: 'c-1b', rbd: '3641', nivel: '1° Básico', letra: 'B', regimen: 'JEC', cupoSae: 30, matriculaProyectada: 30, alumnosNeet: 0, alumnosNeep: 0 }
    ];

    const docente: Docente = {
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

    const asignaciones: AsignacionHoraria[] = [
      { id: 'a-1', rbd: '3641', cursoId: 'c-1b', docenteId: 'doc-1', asignatura: 'Lenguaje', horasPedagogicasAula: 8 },
      { id: 'a-2', rbd: '3641', cursoId: 'c-1b', docenteId: 'doc-1', asignatura: 'Matemáticas', horasPedagogicasAula: 6 },
      { id: 'a-3', rbd: '3641', cursoId: 'c-1b', docenteId: 'doc-1', asignatura: 'Historia', horasPedagogicasAula: 3 }
    ];

    const buffer = await generarExcelMatrizDotacionColegio(
      establecimiento,
      [docente],
      cursos,
      asignaciones
    );

    expect(buffer).toBeInstanceOf(Uint8Array);
    expect(buffer.length).toBeGreaterThan(1000);

    // Cargar en ExcelJS para verificar estructura de celdas
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as any);
    const ws = wb.worksheets[0];

    expect(ws).toBeDefined();
    expect(ws.name).toContain('3641');

    // Fila 1: Encabezados
    expect(ws.getRow(1).getCell(3).value).toContain('HORAS');
    expect(ws.getRow(1).getCell(10).value).toBe('1B');
    expect(ws.getRow(1).getCell(11).value).toBe('TOTAL HA*');

    // Fila 2: Docente Maestro
    expect(ws.getRow(2).getCell(1).value).toBe('Bravo de Peralta Reyes, Magdielin');
    expect(ws.getRow(2).getCell(2).value).toBe('22.250.8874-4');
    expect(ws.getRow(2).getCell(3).value).toBe(42);
    expect(ws.getRow(2).getCell(5).value).toBe(35);
    expect(ws.getRow(2).getCell(7).value).toBe(4);
    expect(ws.getRow(2).getCell(9).value).toBe(3);

    // Fila 3: Lenguaje (8 HA en 1B -> 6:00 en Sub Gral)
    expect(ws.getRow(3).getCell(1).value).toBe('Lenguaje');
    expect(ws.getRow(3).getCell(10).value).toBe(8);
    expect(ws.getRow(3).getCell(12).numFmt).toBe('[h]:mm');

    // Verificar que existen filas de Recreo y Horas no lectivas con formato [h]:mm
    let tieneRecreo6535 = false;
    let tieneHnl6535 = false;
    let tieneTotal = false;

    ws.eachRow((row) => {
      const v = row.getCell(1).value;
      if (v === 'Recreo 65/35') {
        tieneRecreo6535 = true;
        expect(row.getCell(12).numFmt).toBe('[h]:mm');
      }
      if (v === 'Horas no lectivas 65/35') {
        tieneHnl6535 = true;
        expect(row.getCell(12).numFmt).toBe('[h]:mm');
      }
      if (v === 'Total') {
        tieneTotal = true;
        expect(row.getCell(12).numFmt).toBe('[h]:mm');
        expect(row.getCell(15).numFmt).toBe('[h]:mm');
      }
    });

    expect(tieneRecreo6535).toBe(true);
    expect(tieneHnl6535).toBe(true);
    expect(tieneTotal).toBe(true);
  });
});
