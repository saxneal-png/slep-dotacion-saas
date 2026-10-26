import { describe, it, expect, beforeEach } from 'vitest';
import { getDb } from '../src/database/dbCore';
import { guardarDocente, listarDocentes } from '../src/database/repositories/docentesRepo';
import { guardarAsignacion, listarAsignaciones } from '../src/database/repositories/asignacionesRepo';
import { calcularDiagnosticoColegio } from '../src/services/dotacionCalculationService';
import type { Docente, AsignacionHoraria, CursoSae, Establecimiento, SalaInfraestructura } from '../src/types';

describe('Correcciones Periodo 2027, Libre Disposición Fragmentada y Formación Diferenciada Compartida', () => {
  const rbd = '12345';

  beforeEach(async () => {
    const db = await getDb();
    db.run("DELETE FROM asignaciones_horarias;");
    db.run("DELETE FROM docentes;");
    db.run("DELETE FROM cursos_sae;");
    db.run("DELETE FROM establecimientos;");

    // Insertar colegio base para foreign key
    db.run(`
      INSERT INTO establecimientos (id, rbd, nombre, comuna, regimen, porcentaje_prioritarios)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [`col_${rbd}`, rbd, 'Liceo Bicentenario de Prueba', 'San Ignacio', 'JEC', 60]);

    // Insertar cursos base para foreign keys
    db.run(`
      INSERT INTO cursos_sae (id, rbd, nivel, letra, regimen, matricula_proyectada, cupo_sae, periodo)
      VALUES ('curso_3medio_a', ?, '3° Medio', 'A', 'JEC', 25, 30, 2027),
             ('curso_3medio_b', ?, '3° Medio', 'B', 'JEC', 25, 30, 2027),
             ('curso_1basico_a', ?, '1° Básico', 'A', 'JEC', 30, 35, 2027)
    `, [rbd, rbd, rbd]);
  });

  it('debe guardar y aislar docentes en periodo 2027 sin sobreescribir ni colisionar con 2026', async () => {
    const runDocente = '16.217.826-1';

    // 1. Docente existe originalmente en 2026 con 44 horas de contrato
    const docente2026: Docente = {
      id: `doc_${rbd}_2026_162178261`,
      rbd,
      run: runDocente,
      nombres: 'VALENTINA',
      apellidos: 'ALARCON JUNEMANN',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      periodo: 2026
    };
    await guardarDocente(docente2026);

    // Verificar que existe en 2026
    const docs2026 = await listarDocentes(rbd, 2026);
    expect(docs2026).toHaveLength(1);
    expect(docs2026[0].horasContrato).toBe(44);

    // 2. En periodo 2027, se proyecta o edita el docente con 38 horas
    const docente2027: Docente = {
      id: `doc_${rbd}_2027_162178261`,
      rbd,
      run: runDocente,
      nombres: 'VALENTINA',
      apellidos: 'ALARCON JUNEMANN',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 38,
      periodo: 2027
    };
    await guardarDocente(docente2027);

    // Verificar que 2027 tiene sus 38 horas y 2026 conserva sus 44 horas intactas
    const docs2027 = await listarDocentes(rbd, 2027);
    expect(docs2027).toHaveLength(1);
    expect(docs2027[0].horasContrato).toBe(38);

    const docs2026Despues = await listarDocentes(rbd, 2026);
    expect(docs2026Despues).toHaveLength(1);
    expect(docs2026Despues[0].horasContrato).toBe(44);

    // 3. Modificar el docente de 2027 a 40 horas
    await guardarDocente({
      ...docente2027,
      horasContrato: 40
    });

    const docs2027Actualizado = await listarDocentes(rbd, 2027);
    expect(docs2027Actualizado[0].horasContrato).toBe(40);
    // 2026 sigue intacto
    const docs2026SigueIntacto = await listarDocentes(rbd, 2026);
    expect(docs2026SigueIntacto[0].horasContrato).toBe(44);
  });

  it('debe persistir asignaciones con cursos compartidos (Formación Diferenciada en Paralelo Decreto 193/2019)', async () => {
    const curso3AId = 'curso_3medio_a';
    const curso3BId = 'curso_3medio_b';
    const docId = `doc_${rbd}_2027_profesor`;

    // Crear docente en DB para FK
    await guardarDocente({
      id: docId,
      rbd,
      run: '11.222.333-4',
      nombres: 'RODRIGO',
      apellidos: 'SILVA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      periodo: 2027
    });

    // Asignación de Literatura e Identidad (6 HA) dictada en paralelo a 3° Medio HC A y 3° Medio HC B
    const asigElectivo: AsignacionHoraria = {
      id: 'asig_lit_identidad_3medio',
      rbd,
      periodo: 2027,
      cursoId: curso3AId,
      docenteId: docId,
      asignatura: 'Literatura e Identidad (Electivo)',
      horasPedagogicasAula: 6,
      cursosCompartidosIds: [curso3BId],
      esDiferenciadoCompartido: true
    };

    await guardarAsignacion(asigElectivo);

    // Recuperar asignaciones desde SQLite
    const asignacionesRecuperadas = await listarAsignaciones(rbd, 2027);
    expect(asignacionesRecuperadas).toHaveLength(1);
    const asig = asignacionesRecuperadas[0];

    expect(asig.asignatura).toBe('Literatura e Identidad (Electivo)');
    expect(asig.horasPedagogicasAula).toBe(6);
    expect(asig.esDiferenciadoCompartido).toBe(true);
    expect(asig.cursosCompartidosIds).toEqual([curso3BId]);
  });

  it('debe computar las 6 HA de Formación Diferenciada compartida una sola vez al docente y cubrir la demanda de ambos cursos', () => {
    const est: Establecimiento = {
      rbd: '12345',
      nombre: 'Liceo Bicentenario Polivalente',
      comuna: 'San Ignacio',
      porcentajePrioritarios: 60,
      tipoJornada: 'JEC'
    };

    const salas: SalaInfraestructura[] = [{
      id: 'sala-1',
      rbd: '12345',
      nombreSala: 'Sala 1',
      superficieM2: 50,
      tipo: 'REGULAR',
      aforoMaximo: 35
    }];

    const cursos: CursoSae[] = [
      {
        id: 'curso_3medio_a',
        rbd: '12345',
        nivel: '3° Medio',
        letra: 'A',
        regimen: 'JEC',
        matriculaProyectada: 25,
        cupoSae: 30,
        alumnosNeet: 0,
        alumnosNeep: 0
      },
      {
        id: 'curso_3medio_b',
        rbd: '12345',
        nivel: '3° Medio',
        letra: 'B',
        regimen: 'JEC',
        matriculaProyectada: 25,
        cupoSae: 30,
        alumnosNeet: 0,
        alumnosNeep: 0
      }
    ];

    const docentes: Docente[] = [
      {
        id: 'doc_profesor_lenguaje',
        rbd: '12345',
        run: '15.111.222-3',
        nombres: 'RODRIGO',
        apellidos: 'SILVA PARRA',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_AULA',
        horasContrato: 44,
        periodo: 2027
      }
    ];

    // Asignación compartida de 6 HA
    const asignaciones: AsignacionHoraria[] = [
      {
        id: 'asig_lit_identidad_3medio',
        rbd: '12345',
        periodo: 2027,
        cursoId: 'curso_3medio_a',
        docenteId: 'doc_profesor_lenguaje',
        asignatura: 'Literatura e Identidad',
        horasPedagogicasAula: 6,
        cursosCompartidosIds: ['curso_3medio_b'],
        esDiferenciadoCompartido: true
      }
    ];

    const diagnostico = calcularDiagnosticoColegio(est, salas, cursos, docentes, asignaciones);

    // Para el docente: Rodrigo Silva debe tener exactamente 6 horas pedagógicas asignadas (NO 12)
    const estadoDoc = diagnostico.estadoDocentes.find(e => e.docente.id === 'doc_profesor_lenguaje');
    expect(estadoDoc).toBeDefined();
    expect(estadoDoc?.horasPedagogicasAsignadas).toBe(6);
    expect(estadoDoc?.horasAulaRegular).toBe(6);
  });

  it('debe permitir fragmentar las horas de libre disposición en múltiples talleres independientes', async () => {
    const cursoId = 'curso_1basico_a';

    // Insertar docentes para FK
    const doc1 = `doc_${rbd}_2027_1`;
    const doc2 = `doc_${rbd}_2027_2`;
    const doc3 = `doc_${rbd}_2027_3`;

    for (const [id, run, nom] of [
      [doc1, '1.111.111-1', 'DOC1'],
      [doc2, '2.222.222-2', 'DOC2'],
      [doc3, '3.333.333-3', 'DOC3']
    ]) {
      await guardarDocente({
        id,
        rbd,
        run,
        nombres: nom,
        apellidos: 'TEST',
        calidadJuridica: 'CONTRATA',
        estamento: 'DOCENTE_AULA',
        horasContrato: 20,
        periodo: 2027
      });
    }

    // 6 HA de libre disposición fragmentadas en 3 talleres de 2 HA cada uno
    const tallerRobotica: AsignacionHoraria = {
      id: 'asig_taller_robotica',
      rbd,
      periodo: 2027,
      cursoId,
      docenteId: doc1,
      asignatura: 'Taller de Robótica',
      horasPedagogicasAula: 2,
      esTallerJec: true
    };

    const tallerTeatro: AsignacionHoraria = {
      id: 'asig_taller_teatro',
      rbd,
      periodo: 2027,
      cursoId,
      docenteId: doc2,
      asignatura: 'Taller de Teatro y Expresión',
      horasPedagogicasAula: 2,
      esTallerJec: true
    };

    const tallerAjedrez: AsignacionHoraria = {
      id: 'asig_taller_ajedrez',
      rbd,
      periodo: 2027,
      cursoId,
      docenteId: doc3,
      asignatura: 'Taller de Ajedrez',
      horasPedagogicasAula: 2,
      esTallerJec: true
    };

    await guardarAsignacion(tallerRobotica);
    await guardarAsignacion(tallerTeatro);
    await guardarAsignacion(tallerAjedrez);

    const asigs = await listarAsignaciones(rbd, 2027);
    expect(asigs).toHaveLength(3);

    const totalHorasTalleres = asigs.reduce((s, a) => s + a.horasPedagogicasAula, 0);
    expect(totalHorasTalleres).toBe(6);
    expect(asigs.every(a => a.esTallerJec)).toBe(true);
    expect(asigs.map(a => a.asignatura)).toEqual([
      'Taller de Robótica',
      'Taller de Teatro y Expresión',
      'Taller de Ajedrez'
    ]);
  });

  it('debe actualizar correctamente la ficha de un docente existente en 2027 preservando su ID y sincronizando financiamiento y funciones no aula', async () => {
    // 1. Docente creado en 2027 (ej. tras traspaso de dotación)
    const docId2027 = `doc_${rbd}_2027_17091325-6`;
    const docInicial: Docente = {
      id: docId2027,
      rbd,
      run: '17.091.325-6',
      nombres: 'DARIO ANSELMO',
      apellidos: 'PARRA',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 42,
      horasSubvencionGeneralTitular: 42,
      horasSubvencionGeneralContrata: 0,
      periodo: 2027
    };
    await guardarDocente(docInicial);

    // Verificar guardado inicial
    let docs = await listarDocentes(rbd, 2027);
    expect(docs).toHaveLength(1);
    expect(docs[0].id).toBe(docId2027);
    expect(docs[0].horasContrato).toBe(42);

    // 2. Modificar la ficha en 2027 (cambiar horas, agregar funciones no aula y campos GDP)
    const docModificado: Docente = {
      ...docInicial,
      horasContrato: 38,
      horasSubvencionGeneralTitular: 38,
      funcionesNoAula: [
        {
          id: 'f-1',
          tipo: 'COORDINACION',
          nombre: 'Coordinación de Ciclo',
          horas: 4,
          financiamiento: 'SUBVENCION_GENERAL'
        }
      ],
      horasCoordinacion: 4,
      propuestaGdp: 'Disminución Horas',
      remuneracionMensualApp: 1550000,
      remuneracionMensual: 1550000,
      observacionesDirector: 'Ajuste contractual acordado 2027'
    };

    await guardarDocente(docModificado);

    // 3. Verificar que se actualizó el registro exacto sin duplicar
    docs = await listarDocentes(rbd, 2027);
    expect(docs).toHaveLength(1);
    const dRecup = docs[0];
    expect(dRecup.id).toBe(docId2027);
    expect(dRecup.periodo).toBe(2027);
    expect(dRecup.horasContrato).toBe(38);
    expect(dRecup.horasSubvencionGeneralTitular).toBe(38);
    expect(dRecup.horasCoordinacion).toBe(4);
    expect(dRecup.funcionesNoAula).toHaveLength(1);
    expect(dRecup.funcionesNoAula?.[0].nombre).toBe('Coordinación de Ciclo');
    expect(dRecup.remuneracionMensualApp).toBe(1550000);
    expect(dRecup.remuneracionMensual).toBe(1550000);
    expect(dRecup.observacionesDirector).toBe('Ajuste contractual acordado 2027');
    expect(dRecup.observacionesPal).toBe('Ajuste contractual acordado 2027');
  });
});
