import { describe, it, expect, beforeEach } from 'vitest';
import * as XLSX from 'xlsx';
import path from 'path';
import initSqlJs, { Database } from 'sql.js';
import { INIT_SCHEMA_SQL, runMigrations } from '../src/database/schema';
import { parseAsistentesFromWorkbook } from '../src/services/analizador/asistentesParser';
import { inferirClasificacionAsistente, calcularDiagnosticoAsistentes } from '../packages/mineduc-engine/src/calculoAsistentes';
import {
  guardarAsistente,
  guardarAsistentesBatch,
  listarAsistentes,
  listarTodosLosAsistentesTerritorio,
  eliminarAsistente,
  obtenerAsistentePorId
} from '../src/database/repositories/asistentesRepo';

describe('Módulo de Dotación de Asistentes de la Educación', () => {
  let db: Database;

  beforeEach(async () => {
    const SQL = await initSqlJs();
    db = new SQL.Database();
    runMigrations(db);
  });

  it('debe parsear correctamente la hoja "Asistentes" del archivo real Planilla Dotación Pueblo Seco Santa Clara 2026.xlsx', () => {
    const filePath = path.resolve(process.cwd(), 'Planilla Dotación Pueblo Seco Santa Clara 2026.xlsx');
    const workbook = XLSX.readFile(filePath);
    
    const result = parseAsistentesFromWorkbook(workbook, '3543', 2026);

    expect(result.sheetNameFound).toBe('Asistentes');
    expect(result.totalFuncionarios).toBe(23);
    expect(result.totalHoras).toBe(844);

    // Verificar caso multi-financiamiento de Nicole Andrea Reyes González (22h SEP + 22h PIE = 44h)
    const nicole = result.asistentes.find(a => a.run === '16.993.910-1');
    expect(nicole).toBeDefined();
    expect(nicole?.cargoFuncion).toBe('ASISTENTE SOCIAL');
    expect(nicole?.estamento).toBe('PROFESIONAL');
    expect(nicole?.esDuplaPsicosocial).toBe(true);
    expect(nicole?.horasContrato).toBe(44);
    expect(nicole?.horasSepIndefinido).toBe(22);
    expect(nicole?.horasPieIndefinido).toBe(22);

    // Verificar totales por fuentes
    const sumSubGralInd = result.asistentes.reduce((s, a) => s + a.horasSubvencionGeneralIndefinido, 0);
    const sumSubGralPf = result.asistentes.reduce((s, a) => s + a.horasSubvencionGeneralPlazoFijo, 0);
    const sumSepInd = result.asistentes.reduce((s, a) => s + a.horasSepIndefinido, 0);
    const sumSepPf = result.asistentes.reduce((s, a) => s + a.horasSepPlazoFijo, 0);
    const sumPieInd = result.asistentes.reduce((s, a) => s + a.horasPieIndefinido, 0);
    const sumPiePf = result.asistentes.reduce((s, a) => s + a.horasPiePlazoFijo, 0);

    expect(sumSubGralInd).toBe(344);
    expect(sumSubGralPf).toBe(82);
    expect(sumSepInd).toBe(82);
    expect(sumSepPf).toBe(76);
    expect(sumPieInd).toBe(222);
    expect(sumPiePf).toBe(38);
  });

  it('debe inferir adecuadamente los estamentos y flags normativos', () => {
    const psi = inferirClasificacionAsistente('PSICOLOGO/A');
    expect(psi.estamento).toBe('PROFESIONAL');
    expect(psi.esDuplaPsicosocial).toBe(true);

    const fono = inferirClasificacionAsistente('FONOAUDIÓLOGO/A');
    expect(fono.estamento).toBe('PROFESIONAL');
    expect(fono.esEquipoPie).toBe(true);

    const parv = inferirClasificacionAsistente('TECNICO EN PARVULOS');
    expect(parv.estamento).toBe('TECNICO');
    expect(parv.esTecnicoParvulo).toBe(true);

    const aux = inferirClasificacionAsistente('AUXILIAR DE SERVICIOS');
    expect(aux.estamento).toBe('AUXILIAR');
    expect(aux.esAuxiliarServicio).toBe(true);

    const insp = inferirClasificacionAsistente('INSPECTOR/A');
    expect(insp.estamento).toBe('PARADOCENTE_INSPECTORIA');
    expect(insp.esInspectorPatio).toBe(true);

    const sec = inferirClasificacionAsistente('SECRETARIA ADMINISTRATIVA');
    expect(sec.estamento).toBe('ADMINISTRATIVO');
  });

  it('debe calcular diagnósticos y ratios de asistentes correctamente', () => {
    const filePath = path.resolve(process.cwd(), 'Planilla Dotación Pueblo Seco Santa Clara 2026.xlsx');
    const workbook = XLSX.readFile(filePath);
    const parseRes = parseAsistentesFromWorkbook(workbook, '3543', 2026);

    const diagnostico = calcularDiagnosticoAsistentes(parseRes.asistentes, {
      rbd: '3543',
      periodo: 2026,
      matricula: 450,
      salasParvulo: 2
    });

    expect(diagnostico.totalAsistentes).toBe(23);
    expect(diagnostico.totalHoras).toBe(844);
    expect(diagnostico.totalHorasSubvencionGeneral).toBe(426); // 344 + 82
    expect(diagnostico.totalHorasSep).toBe(158); // 82 + 76
    expect(diagnostico.totalHorasPie).toBe(260); // 222 + 38
    expect(diagnostico.duplaPsicosocial.tienePsicologo).toBe(true);
    expect(diagnostico.duplaPsicosocial.tieneTrabajadorSocial).toBe(true);
    expect(diagnostico.duplaPsicosocial.estadoCobertura).toBe('COMPLETA');
    expect(diagnostico.equipoPie.cantidadProfesionales).toBeGreaterThan(0);
    expect(diagnostico.auxiliaresAseo.cantidad).toBe(3);
    expect(diagnostico.tecnicosParvulo.cantidad).toBe(2);
  });

  it('debe persistir, consultar y eliminar asistentes en SQLite WASM', async () => {
    // Insertar colegio base
    db.run(`
      INSERT INTO establecimientos (id, rbd, nombre, comuna, regimen, porcentaje_prioritarios)
      VALUES ('est_1', '3543', 'Escuela Pueblo Seco', 'San Ignacio', 'JEC', 85.0);
    `);

    const filePath = path.resolve(process.cwd(), 'Planilla Dotación Pueblo Seco Santa Clara 2026.xlsx');
    const workbook = XLSX.readFile(filePath);
    const parseRes = parseAsistentesFromWorkbook(workbook, '3543', 2026);

    // Guardar batch
    await guardarAsistentesBatch(db, parseRes.asistentes, '3543', 2026, true);

    const guardados = await listarAsistentes(db, '3543', 2026);
    expect(guardados.length).toBe(23);

    const primerAsistente = guardados[0];
    const buscado = await obtenerAsistentePorId(db, primerAsistente.id);
    expect(buscado).toBeDefined();
    expect(buscado?.run).toBe(primerAsistente.run);

    // Eliminar uno
    await eliminarAsistente(db, primerAsistente.id);
    const restantes = await listarAsistentes(db, '3543', 2026);
    expect(restantes.length).toBe(22);

    // Listar territorio
    const todosTerritorio = await listarTodosLosAsistentesTerritorio(db, 2026);
    expect(todosTerritorio.length).toBe(22);
  });
});
