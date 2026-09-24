import { describe, it, expect, beforeEach } from 'vitest';
import {
  analizarSincronizacionDotacion,
  ejecutarReconciliacionLimpia,
  ejecutarAutoAsignacionMallaDesdeNomina,
  ejecutarLimpiarTodasAsignaciones
} from '../src/services/reconciliacionDotacionService';
import {
  getDb,
  guardarEstablecimiento,
  guardarCurso,
  guardarDocente,
  guardarAsignacion,
  listarAsignaciones,
  borrarDotacionPeriodo
} from '../src/database/db';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria } from '../src/types';

describe('Servicio de Reconciliación y Sincronización Nómina-Malla', () => {
  const colegioTest: Establecimiento = {
    id: 'est-test-reconciliacion',
    rbd: '99999',
    nombre: 'Escuela de Prueba Reconciliación',
    comuna: 'Bulnes',
    regimen: 'JEC',
    porcentajePrioritarios: 75
  };

  const cursosTest: CursoSae[] = [
    {
      id: 'curso-test-1b',
      rbd: '99999',
      periodo: 2026,
      nivel: '1° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 5,
      alumnosNeep: 2
    },
    {
      id: 'curso-test-2b',
      rbd: '99999',
      periodo: 2026,
      nivel: '2° Básico',
      letra: 'A',
      regimen: 'JEC',
      cupoSae: 35,
      matriculaProyectada: 30,
      alumnosNeet: 5,
      alumnosNeep: 2
    }
  ];

  const docentesTest: Docente[] = [
    {
      id: 'doc-lenguaje-1',
      rbd: '99999',
      periodo: 2026,
      run: '11.111.111-1',
      nombres: 'María',
      apellidos: 'González',
      estamento: 'DOCENTE_AULA',
      calidadJuridica: 'TITULAR',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      asignaturaPrincipal: 'Lenguaje y Comunicación'
    },
    {
      id: 'doc-mate-1',
      rbd: '99999',
      periodo: 2026,
      run: '22.222.222-2',
      nombres: 'Carlos',
      apellidos: 'Pérez',
      estamento: 'DOCENTE_AULA',
      calidadJuridica: 'TITULAR',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      asignaturaPrincipal: 'Matemática'
    }
  ];

  beforeEach(async () => {
    await borrarDotacionPeriodo(2026, '99999');
    await guardarEstablecimiento(colegioTest);
    for (const c of cursosTest) await guardarCurso(c);
    for (const d of docentesTest) await guardarDocente(d);
  });

  it('detecta asignaciones huérfanas y duplicadas en el diagnóstico', () => {
    const asignacionesConErrores: AsignacionHoraria[] = [
      // Asignación válida
      {
        id: 'asig-1',
        rbd: '99999',
        periodo: 2026,
        cursoId: 'curso-test-1b',
        docenteId: 'doc-lenguaje-1',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 6
      },
      // Duplicado exacto de asig-1
      {
        id: 'asig-1-duplicado',
        rbd: '99999',
        periodo: 2026,
        cursoId: 'curso-test-1b',
        docenteId: 'doc-lenguaje-1',
        asignatura: 'Lenguaje y Comunicación',
        horasPedagogicasAula: 6
      },
      // Huérfana (docente no existe en la nómina)
      {
        id: 'asig-huerfana-1',
        rbd: '99999',
        periodo: 2026,
        cursoId: 'curso-test-1b',
        docenteId: 'doc-inexistente-999',
        asignatura: 'Historia',
        horasPedagogicasAula: 3
      }
    ];

    const diag = analizarSincronizacionDotacion(colegioTest, docentesTest, cursosTest, asignacionesConErrores);
    expect(diag.estaSincronizado).toBe(false);
    expect(diag.huerfanasCount).toBe(1);
    expect(diag.duplicadasCount).toBe(1);
  });

  it('ejecuta reconciliación limpia purgando huérfanas y duplicados en SQLite', async () => {
    // 1. Guardar un docente temporal que luego será borrado para simular asignación huérfana
    await guardarDocente({
      id: 'doc-antiguo-borrado',
      rbd: '99999',
      periodo: 2026,
      run: '33.333.333-3',
      nombres: 'Profesor',
      apellidos: 'Antiguo',
      estamento: 'DOCENTE_AULA',
      calidadJuridica: 'CONTRATA',
      horasContrato: 30,
      asignaturaPrincipal: 'Artes Visuales'
    });

    // 2. Guardar asignación válida, huérfana y duplicada en base de datos
    await guardarAsignacion({
      id: 'asig-valida-1',
      rbd: '99999',
      periodo: 2026,
      cursoId: 'curso-test-1b',
      docenteId: 'doc-lenguaje-1',
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 6
    });

    await guardarAsignacion({
      id: 'asig-duplicada-1',
      rbd: '99999',
      periodo: 2026,
      cursoId: 'curso-test-1b',
      docenteId: 'doc-lenguaje-1',
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 6
    });

    await guardarAsignacion({
      id: 'asig-huerfana-old',
      rbd: '99999',
      periodo: 2026,
      cursoId: 'curso-test-1b',
      docenteId: 'doc-antiguo-borrado',
      asignatura: 'Artes Visuales',
      horasPedagogicasAula: 2
    });

    // 3. Borrar el docente antiguo de la tabla docentes directamente para crear la condición huérfana
    const db = await getDb();
    db.run("PRAGMA foreign_keys = OFF;");
    db.run("DELETE FROM docentes WHERE id = 'doc-antiguo-borrado'");
    db.run("PRAGMA foreign_keys = ON;");

    const listaPrevia = await listarAsignaciones('99999', 2026);
    expect(listaPrevia.length).toBe(3);

    // Ejecutar Reconciliación Limpia
    const res = await ejecutarReconciliacionLimpia('99999', 2026);
    expect(res.huerfanasEliminadas).toBe(1);
    expect(res.duplicadasEliminadas).toBe(1);

    const listaFinal = await listarAsignaciones('99999', 2026);
    expect(listaFinal.length).toBe(1);
    expect(['asig-valida-1', 'asig-duplicada-1']).toContain(listaFinal[0].id);
    expect(listaFinal[0].asignatura).toBe('Lenguaje y Comunicación');
    expect(listaFinal[0].horasPedagogicasAula).toBe(6);
  });

  it('auto-asigna la malla curricular MINEDUC respetando especialidad docente', async () => {
    const res = await ejecutarAutoAsignacionMallaDesdeNomina(
      '99999',
      2026,
      colegioTest,
      cursosTest,
      docentesTest
    );

    expect(res.autoAsignadasCreadas).toBeGreaterThan(0);

    const asigsGuardadas = await listarAsignaciones('99999', 2026);
    expect(asigsGuardadas.length).toBe(res.autoAsignadasCreadas);

    // Verificar que a María González le asignó Lenguaje prioritariamente
    const asigsMaria = asigsGuardadas.filter(a => a.docenteId === 'doc-lenguaje-1');
    expect(asigsMaria.some(a => a.asignatura.includes('Lenguaje'))).toBe(true);

    // Verificar que a Carlos Pérez le asignó Matemática prioritariamente
    const asigsCarlos = asigsGuardadas.filter(a => a.docenteId === 'doc-mate-1');
    expect(asigsCarlos.some(a => a.asignatura.includes('Matemática'))).toBe(true);
  });

  it('limpia todas las asignaciones sin tocar los docentes ni los cursos', async () => {
    await ejecutarAutoAsignacionMallaDesdeNomina(
      '99999',
      2026,
      colegioTest,
      cursosTest,
      docentesTest
    );

    const countEliminadas = await ejecutarLimpiarTodasAsignaciones('99999', 2026);
    expect(countEliminadas).toBeGreaterThan(0);

    const asigsVacias = await listarAsignaciones('99999', 2026);
    expect(asigsVacias.length).toBe(0);
  });
});
