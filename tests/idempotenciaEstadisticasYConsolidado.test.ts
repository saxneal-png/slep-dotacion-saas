import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/dbCore';
import { guardarCurso, listarTodosLosCursos } from '../src/database/repositories/cursosRepo';
import { guardarDocente, guardarDocentesBatch, listarTodosLosDocentesTerritorio } from '../src/database/repositories/docentesRepo';
import { guardarAsistente, guardarAsistentesBatch, listarTodosLosAsistentesTerritorio } from '../src/database/repositories/asistentesRepo';
import { guardarAsignacion, listarTodasLasAsignaciones } from '../src/database/repositories/asignacionesRepo';
import { guardarEstablecimiento } from '../src/database/repositories/establecimientosRepo';
import { calcularDiagnosticoColegio, consolidarCarteraTerritorial } from '../src/services/dotacionCalculationService';
import { calcularEstadisticasColegio, calcularEstadisticasTerritoriales } from '../src/services/estadisticasHorasService';
import { Establecimiento, CursoSae, Docente, AsistenteEducacion, AsignacionHoraria } from '../src/types';

describe('Blindaje e Idempotencia de Estadísticas y Consolidado', () => {
  const RBD_TEST = '88888';

  const estMock: Establecimiento = {
    id: `est-${RBD_TEST}`,
    rbd: RBD_TEST,
    nombre: 'Liceo Bicentenario TP Larqui',
    comuna: 'Bulnes',
    regimen: 'JEC',
    porcentajePrioritarios: 75
  };

  beforeEach(async () => {
    const db = await getDb();
    db.run('DELETE FROM asignaciones_horarias WHERE rbd = ?', [RBD_TEST]);
    db.run('DELETE FROM docentes WHERE rbd = ?', [RBD_TEST]);
    db.run('DELETE FROM cursos_sae WHERE rbd = ?', [RBD_TEST]);
    db.run('DELETE FROM asistentes_educacion WHERE rbd = ?', [RBD_TEST]);
    db.run('DELETE FROM establecimientos WHERE rbd = ?', [RBD_TEST]);
    await guardarEstablecimiento(estMock, true);
  });

  it('1. Cursos TP con especialidad calculan 42 HA tanto en Consolidado como en Estadísticas', async () => {
    const cursoTp: CursoSae = {
      id: `cur_tp_${RBD_TEST}`,
      rbd: RBD_TEST,
      nivel: '3° Medio',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 0,
      alumnosNeep: 0,
      periodo: 2027,
      regimenProporcion: '65_35',
      especialidadTp: 'Gastronomía'
    };

    await guardarCurso(cursoTp, true);

    const diag = calcularDiagnosticoColegio(estMock, [], [cursoTp], [], []);
    expect(diag.balanzaGeneral.horasAulaDemandadasCurriculo).toBe(42);

    const stats = calcularEstadisticasColegio(estMock, [cursoTp], [], [], []);
    expect(stats.horasAulaDemandadasPlan).toBe(42);
  });

  it('2. Deduplicación estricta de Docentes por (rbd, periodo, RUN): no duplica al re-guardar con otro ID', async () => {
    const doc1: Docente = {
      id: `doc_local_${RBD_TEST}`,
      rbd: RBD_TEST,
      run: '15.111.222-3',
      nombres: 'María',
      apellidos: 'Pérez',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      periodo: 2027
    };
    await guardarDocente(doc1, true);

    let docs = (await listarTodosLosDocentesTerritorio(2027)).filter(d => d.rbd === RBD_TEST);
    expect(docs.length).toBe(1);
    expect(docs[0].horasContrato).toBe(44);

    // Re-ingesta o sincronización desde nube con un ID remoto tipo UUID pero mismo RUN
    const docRemoto: Docente = {
      id: `uuid-remoto-${RBD_TEST}-123`,
      rbd: RBD_TEST,
      run: '15111222-3',
      nombres: 'María',
      apellidos: 'Pérez',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      periodo: 2027
    };
    await guardarDocentesBatch([docRemoto], true);

    docs = (await listarTodosLosDocentesTerritorio(2027)).filter(d => d.rbd === RBD_TEST);
    // Debe haber exactamente 1 docente, sin duplicar las horas
    expect(docs.length).toBe(1);
    expect(docs[0].horasContrato).toBe(44);
    expect(docs[0].id).toBe(`uuid-remoto-${RBD_TEST}-123`);
  });

  it('3. Deduplicación estricta de Asistentes por (rbd, periodo, RUN)', async () => {
    const ast1: AsistenteEducacion = {
      id: `ast_local_${RBD_TEST}`,
      rbd: RBD_TEST,
      run: '18.333.444-5',
      nombres: 'Carlos',
      apellidos: 'Muñoz',
      cargoFuncion: 'Inspector de Patio',
      estamento: 'PARADOCENTE',
      horasContrato: 44,
      periodo: 2027
    };
    await guardarAsistente(ast1, true);

    let asts = (await listarTodosLosAsistentesTerritorio(2027)).filter(a => a.rbd === RBD_TEST);
    expect(asts.length).toBe(1);

    const astRemoto: AsistenteEducacion = {
      id: `uuid-ast-${RBD_TEST}-789`,
      rbd: RBD_TEST,
      run: '18333444-5',
      nombres: 'Carlos',
      apellidos: 'Muñoz',
      cargoFuncion: 'Inspector de Patio',
      estamento: 'PARADOCENTE',
      horasContrato: 44,
      periodo: 2027
    };
    await guardarAsistentesBatch([astRemoto], RBD_TEST, 2027, false, true);

    asts = (await listarTodosLosAsistentesTerritorio(2027)).filter(a => a.rbd === RBD_TEST);
    expect(asts.length).toBe(1);
    expect(asts[0].id).toBe(`uuid-ast-${RBD_TEST}-789`);
  });

  it('4. Saneamiento automático de Asignaciones huérfanas en listarTodasLasAsignaciones', async () => {
    const cursoValido: CursoSae = {
      id: `cur_valido_${RBD_TEST}`,
      rbd: RBD_TEST,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 25,
      periodo: 2027
    };
    await guardarCurso(cursoValido, true);

    const asigValida: AsignacionHoraria = {
      id: `asig_val_${RBD_TEST}`,
      rbd: RBD_TEST,
      cursoId: `cur_valido_${RBD_TEST}`,
      docenteId: `doc_1_${RBD_TEST}`,
      asignatura: 'Lenguaje',
      horasPedagogicasAula: 8,
      periodo: 2027
    };
    await guardarAsignacion(asigValida, true);

    const asigHuerfana: AsignacionHoraria = {
      id: `asig_huerf_${RBD_TEST}`,
      rbd: RBD_TEST,
      cursoId: 'cur_inexistente_borrado',
      docenteId: `doc_1_${RBD_TEST}`,
      asignatura: 'Matemática',
      horasPedagogicasAula: 6,
      periodo: 2027
    };
    await guardarAsignacion(asigHuerfana, true);

    // listarTodasLasAsignaciones debe purgar automáticamente la asignación del curso inexistente
    const asignaciones = (await listarTodasLasAsignaciones(2027)).filter(a => a.rbd === RBD_TEST);
    expect(asignaciones.length).toBe(1);
    expect(asignaciones[0].id).toBe(`asig_val_${RBD_TEST}`);
  });

  it('5. Invarianza territorial: 5 ejecuciones de consolidación y estadísticas dan números idénticos', async () => {
    const curso: CursoSae = {
      id: `cur_inv_${RBD_TEST}`,
      rbd: RBD_TEST,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 30,
      matriculaProyectada: 28,
      periodo: 2027
    };
    await guardarCurso(curso, true);

    const doc: Docente = {
      id: `doc_inv_${RBD_TEST}`,
      rbd: RBD_TEST,
      run: '12.345.678-9',
      nombres: 'Rosa',
      apellidos: 'Gómez',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      periodo: 2027
    };
    await guardarDocente(doc, true);

    const asig: AsignacionHoraria = {
      id: `asig_inv_${RBD_TEST}`,
      rbd: RBD_TEST,
      cursoId: `cur_inv_${RBD_TEST}`,
      docenteId: `doc_inv_${RBD_TEST}`,
      asignatura: 'Lenguaje',
      horasPedagogicasAula: 8,
      periodo: 2027
    };
    await guardarAsignacion(asig, true);

    const ast: AsistenteEducacion = {
      id: `ast_inv_${RBD_TEST}`,
      rbd: RBD_TEST,
      run: '9.876.543-2',
      nombres: 'Pedro',
      apellidos: 'Soto',
      cargoFuncion: 'Auxiliar',
      estamento: 'AUXILIAR',
      horasContrato: 44,
      periodo: 2027
    };
    await guardarAsistente(ast, true);

    let baselineDemandadas = 0;
    let baselineDisponibles = 0;

    for (let iter = 0; iter < 5; iter++) {
      const allCursos = (await listarTodosLosCursos(2027)).filter(c => c.rbd === RBD_TEST);
      const allDocs = (await listarTodosLosDocentesTerritorio(2027)).filter(d => d.rbd === RBD_TEST);
      const allAsigs = (await listarTodasLasAsignaciones(2027)).filter(a => a.rbd === RBD_TEST);
      const allAsts = (await listarTodosLosAsistentesTerritorio(2027)).filter(a => a.rbd === RBD_TEST);

      expect(allCursos.length).toBe(1);
      expect(allDocs.length).toBe(1);
      expect(allAsigs.length).toBe(1);
      expect(allAsts.length).toBe(1);

      const diag = calcularDiagnosticoColegio(estMock, [], allCursos, allDocs, allAsigs);
      const cons = consolidarCarteraTerritorial([estMock], allDocs, [diag]);
      const stats = calcularEstadisticasTerritoriales([estMock], allCursos, allDocs, allAsigs, allAsts);

      if (iter === 0) {
        baselineDemandadas = diag.balanzaGeneral.horasAulaDemandadasCurriculo;
        baselineDisponibles = diag.balanzaGeneral.horasLectivasDisponibles;
      } else {
        expect(diag.balanzaGeneral.horasAulaDemandadasCurriculo).toBe(baselineDemandadas);
        expect(diag.balanzaGeneral.horasLectivasDisponibles).toBe(baselineDisponibles);
        expect(stats.horasDemandadasPlanTotal).toBe(baselineDemandadas);
      }
    }
  });
});
