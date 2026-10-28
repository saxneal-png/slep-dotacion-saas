import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import {
  getDb,
  guardarEstablecimiento,
  listarCursos,
  listarDocentes,
  listarAsignaciones,
  proyectarPeriodoColegio,
  getComparativaPeriodos,
  guardarMatrizExcelEnDb
} from '../src/database/db';
import { parseMatrizExcel } from '../src/services/excelMatrixParserService';
import { Establecimiento } from '../src/types';

describe('Periodos y Matriz Excel en Base de Datos', () => {
  const colegioTest: Establecimiento = {
    id: 'colegio-test-narciso',
    rbd: '99999',
    nombre: 'Liceo de Prueba Multiperiodo',
    comuna: 'San Ignacio',
    regimen: 'JEC',
    porcentajePrioritarios: 75
  };

  beforeAll(async () => {
    await getDb();
    await guardarEstablecimiento(colegioTest);
  });

  it('guarda matriz excel con cursos, docentes y asignaciones en 2026', async () => {
    const realPath = 'C:/Users/DionicioFelipeFlores/Downloads/Dotación Liceo Narciso T.xlsx';
    if (!fs.existsSync(realPath)) {
      // Si el archivo no existe en el runner (ej. CI GitHub Actions), creamos datos mínimos para permitir la suite
      const mockParsed = {
        cursos: [
          { nivel: '1° Básico', letra: 'A', cupoSae: 30, matriculaProyectada: 28, asignaturas: [{ nombre: 'Lenguaje', horas: 8 }] },
          { nivel: '2° Básico', letra: 'A', cupoSae: 30, matriculaProyectada: 28, asignaturas: [{ nombre: 'Lenguaje', horas: 8 }] }
        ],
        docentes: [
          { run: '11111111-1', nombres: 'Docente', apellidos: 'Uno', horasContrato: 44, calidadJuridica: 'TITULAR' as const, estamento: 'DOCENTE_AULA' as const }
        ],
        asignaciones: [
          { docenteRun: '11111111-1', nivel: '1° Básico', letra: 'A', asignatura: 'Lenguaje', horas: 8 }
        ]
      };
      await guardarMatrizExcelEnDb(mockParsed as any, colegioTest.rbd, 2026);
      return;
    }

    const buffer = fs.readFileSync(realPath);
    const parsed = await parseMatrizExcel(buffer, 'Dotación Liceo Narciso T.xlsx');

    const res = await guardarMatrizExcelEnDb(parsed, colegioTest.rbd, 2026);
    expect(res.cursosNuevos).toBeGreaterThanOrEqual(25);
    expect(res.docentesGuardados).toBeGreaterThan(50);
    expect(res.asignacionesGuardadas).toBeGreaterThan(150);

    const cursos2026 = await listarCursos(colegioTest.rbd, 2026);
    expect(cursos2026.length).toBe(res.cursosNuevos);

    const docentes2026 = await listarDocentes(colegioTest.rbd, 2026);
    expect(docentes2026.length).toBe(res.docentesGuardados);

    const asigs2026 = await listarAsignaciones(colegioTest.rbd, 2026);
    expect(asigs2026.length).toBe(res.asignacionesGuardadas);
  });

  it('proyecta la dotación de 2026 a 2027 con promoción de niveles', async () => {
    const projRes = await proyectarPeriodoColegio(colegioTest.rbd, 2026, 2027, {
      promoverCursos: true,
      replicarAsignaciones: true
    });

    expect(projRes.cursosCreados).toBeGreaterThan(0);
    expect(projRes.docentesCreados).toBeGreaterThan(0);

    const cursos2027 = await listarCursos(colegioTest.rbd, 2027);
    expect(cursos2027.length).toBeGreaterThan(0);

    const docentes2027 = await listarDocentes(colegioTest.rbd, 2027);
    expect(docentes2027.length).toBeGreaterThan(0);

    // Los datos de 2026 no deben haberse borrado
    const cursos2026 = await listarCursos(colegioTest.rbd, 2026);
    expect(cursos2026.length).toBeGreaterThan(0);
  });

  it('genera la comparativa 2026 vs 2027 con balance y variaciones', async () => {
    const comp = await getComparativaPeriodos(colegioTest.rbd, 2026, 2027);
    expect(comp.rbd).toBe(colegioTest.rbd);
    expect(comp.periodoA.periodo).toBe(2026);
    expect(comp.periodoB.periodo).toBe(2027);
    expect(comp.variacionesDocentes.length).toBeGreaterThan(0);
  });
});
