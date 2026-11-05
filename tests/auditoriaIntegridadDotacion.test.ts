import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/dbCore';
import { guardarEstablecimiento } from '../src/database/repositories/establecimientosRepo';
import { guardarCurso } from '../src/database/repositories/cursosRepo';
import { guardarDocente, listarDocentes } from '../src/database/repositories/docentesRepo';
import { guardarAsignacion, listarAsignaciones } from '../src/database/repositories/asignacionesRepo';
import {
  auditarIntegridadColegio,
  repararIntegridadColegio
} from '../src/services/auditoriaIntegridadDotacionService';
import { Docente, CursoSae, AsignacionHoraria } from '../src/types';

describe('Auditoría y Reparación de Integridad de Dotación (Caso Ciencias Naturales y Duplicaciones)', () => {
  const RBD_TEST = '99999';
  const PERIODO = 2027;

  beforeEach(async () => {
    const db = await getDb();
    db.run('DELETE FROM asignaciones_horarias WHERE rbd = ?', [RBD_TEST]);
    db.run('DELETE FROM docentes WHERE rbd = ?', [RBD_TEST]);
    db.run('DELETE FROM cursos_sae WHERE rbd = ?', [RBD_TEST]);
    db.run('DELETE FROM establecimientos WHERE rbd = ?', [RBD_TEST]);

    // Crear colegio de prueba
    await guardarEstablecimiento({
      id: `est-${RBD_TEST}`,
      rbd: RBD_TEST,
      nombre: 'Colegio Polivalente Integridad Test',
      comuna: 'Chillán',
      regimen: 'JEC',
      porcentajePrioritarios: 75
    });

    // Crear 2° Básico A (Plan oficial Ciencias Naturales: 3 HA)
    const curso2Basico: CursoSae = {
      id: `curso_${RBD_TEST}_${PERIODO}_2__Básico_A`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      nivel: '2° Básico',
      letra: 'A',
      regimen: 'No JEC',
      cupoSae: 35,
      matriculaProyectada: 30
    };
    await guardarCurso(curso2Basico);

    // Crear 6° Básico A (Plan oficial Ciencias Naturales: 3 HA o 4 HA)
    const curso6Basico: CursoSae = {
      id: `curso_${RBD_TEST}_${PERIODO}_6__Básico_A`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      nivel: '6° Básico',
      letra: 'A',
      regimen: 'No JEC',
      cupoSae: 35,
      matriculaProyectada: 30
    };
    await guardarCurso(curso6Basico);

    // Crear 2° Medio A (Plan oficial Ciencias Naturales: 6 HA)
    const curso2Medio: CursoSae = {
      id: `curso_${RBD_TEST}_${PERIODO}_2__Medio_A`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      nivel: '2° Medio',
      letra: 'A',
      regimen: 'No JEC',
      cupoSae: 35,
      matriculaProyectada: 30
    };
    await guardarCurso(curso2Medio);

    // Inyectar Docente 1 con RUN con puntos (ej: 16.734.523-9)
    const doc1: Docente = {
      id: `doc_${RBD_TEST}_${PERIODO}_167345239`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      run: '16.734.523-9',
      nombres: 'LEYLA NATACHA',
      apellidos: 'FLORES ANDRADE',
      horasContrato: 44,
      horasAula: 35,
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA'
    };
    await guardarDocente(doc1);

    // Inyectar Docente 2 (Clon de importación con diferente ID y RUN desnormalizado)
    db.run(`
      INSERT INTO docentes (id, rbd, periodo, run, nombres, apellidos, horas_contrato, horas_aula, calidad_juridica, estamento)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      `doc_${RBD_TEST}_${PERIODO}_16734523_9_CLON`,
      RBD_TEST,
      PERIODO,
      '16734523-9',
      'Leyla Natacha',
      'Flores Andrade',
      44,
      35,
      'TITULAR',
      'DOCENTE_AULA'
    ]);

    // Inyectar 3 asignaciones repetidas de Ciencias Naturales en 2° Básico A (3 HA x 3 = 9 HA infladas)
    await guardarAsignacion({
      id: `asig_1`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      cursoId: curso2Basico.id,
      docenteId: doc1.id,
      asignatura: 'Ciencias Naturales',
      horasPedagogicasAula: 3
    });
    await guardarAsignacion({
      id: `asig_2`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      cursoId: curso2Basico.id,
      docenteId: `doc_${RBD_TEST}_${PERIODO}_16734523_9_CLON`,
      asignatura: 'Ciencias Naturales',
      horasPedagogicasAula: 3
    });
    await guardarAsignacion({
      id: `asig_3`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      cursoId: curso2Basico.id,
      docenteId: `doc_HUERFANO_INEXISTENTE_167345239`,
      asignatura: 'Ciencias Naturales',
      horasPedagogicasAula: 3
    });

    // Inyectar 4 asignaciones repetidas en 6° Básico A (3 HA x 4 = 12 HA infladas)
    for (let i = 1; i <= 4; i++) {
      await guardarAsignacion({
        id: `asig_6b_${i}`,
        rbd: RBD_TEST,
        periodo: PERIODO,
        cursoId: curso6Basico.id,
        docenteId: doc1.id,
        asignatura: 'Ciencias Naturales',
        horasPedagogicasAula: 3
      });
    }

    // Inyectar una asignación válida sin duplicar en 2° Medio A (6 HA)
    await guardarAsignacion({
      id: `asig_2m_1`,
      rbd: RBD_TEST,
      periodo: PERIODO,
      cursoId: curso2Medio.id,
      docenteId: doc1.id,
      asignatura: 'Ciencias Naturales',
      horasPedagogicasAula: 6
    });
  });

  it('debe detectar docentes clonados, asignaciones huérfanas y horas infladas en la auditoría', async () => {
    const reporte = await auditarIntegridadColegio(RBD_TEST, PERIODO);

    expect(reporte.hayInconsistencias).toBe(true);
    expect(reporte.docentesDuplicados.length).toBe(1);
    expect(reporte.docentesDuplicados[0].cleanRun).toBe('167345239');

    // Debe detectar la asignación huérfana de doc_HUERFANO_INEXISTENTE_167345239 como recuperable
    expect(reporte.asignacionesHuerfanas.length).toBeGreaterThanOrEqual(1);
    const huerf = reporte.asignacionesHuerfanas.find(h => h.asignacionId === 'asig_3');
    expect(huerf).toBeDefined();
    expect(huerf?.esRecuperable).toBe(true);

    // Debe detectar que en 2° Básico hay 6 HA de exceso (9 - 3) y en 6° Básico hay 9 HA de exceso (12 - 3)
    // Horas totales infladas: 6 + 9 = 15 HA
    expect(reporte.horasTotalesInfladas).toBe(15);
  });

  it('debe ejecutar la reparación y sanear la base de datos dejando las coberturas correctas', async () => {
    const resultado = await repararIntegridadColegio(RBD_TEST, PERIODO);

    expect(resultado.docentesFusionados).toBe(1);
    expect(resultado.asignacionesHuerfanasReasignadas).toBe(1);
    expect(resultado.horasRecuperadas).toBe(15);

    // Verificar docentes en la DB
    const docentesPost = await listarDocentes(RBD_TEST, PERIODO);
    expect(docentesPost.length).toBe(1);
    expect(docentesPost[0].run).toBe('16734523-9');

    // Verificar asignaciones en 2° Básico A: debe quedar SOLO 1 de 3 HA
    const asigsPost = await listarAsignaciones(RBD_TEST, PERIODO);
    const asigs2B = asigsPost.filter(a => a.cursoId === `curso_${RBD_TEST}_${PERIODO}_2__Básico_A`);
    expect(asigs2B.length).toBe(1);
    expect(asigs2B[0].horasPedagogicasAula).toBe(3);

    // Verificar asignaciones en 6° Básico A: debe quedar SOLO 1 de 3 HA
    const asigs6B = asigsPost.filter(a => a.cursoId === `curso_${RBD_TEST}_${PERIODO}_6__Básico_A`);
    expect(asigs6B.length).toBe(1);
    expect(asigs6B[0].horasPedagogicasAula).toBe(3);

    // Verificar asignaciones en 2° Medio A: se mantiene intacta la de 6 HA
    const asigs2M = asigsPost.filter(a => a.cursoId === `curso_${RBD_TEST}_${PERIODO}_2__Medio_A`);
    expect(asigs2M.length).toBe(1);
    expect(asigs2M[0].horasPedagogicasAula).toBe(6);

    // Ejecutar re-auditoría: debe certificar 100% de consistencia
    const auditoriaPost = await auditarIntegridadColegio(RBD_TEST, PERIODO);
    expect(auditoriaPost.hayInconsistencias).toBe(false);
    expect(auditoriaPost.horasTotalesInfladas).toBe(0);
    expect(auditoriaPost.docentesDuplicados.length).toBe(0);
    expect(auditoriaPost.asignacionesHuerfanas.length).toBe(0);
    expect(auditoriaPost.asignacionesDuplicadas.length).toBe(0);
  });
});
