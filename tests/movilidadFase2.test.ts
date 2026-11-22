import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';
import {
  getDb,
  guardarEstablecimiento,
  guardarCurso,
  guardarDocente,
  guardarAsignacion,
  listarDocentes,
  listarAsignaciones,
  reiniciarTodaLaBaseDatos
} from '../src/database/db';
import {
  guardarSolicitudMovilidad,
  avanzarEstadoFlujoMovilidad,
  listarSolicitudesMovilidad,
  crearEscenarioCalce,
  listarEscenariosCalce,
  listarPropuestasEscenario,
  agregarPropuestaCalce,
  resolverRebotePropuestaCalce,
  consolidarEscenarioAprobado,
  revertirEscenarioConsolidado,
  registrarResolucionExentaEscenario
} from '../src/services/movilidadTerritorialService';
import {
  generarHtmlActaMesaMovilidad,
  exportarVacantesRemanentesConcursoExcel
} from '../src/services/movilidadActaService';
import {
  obtenerHitosDefectoPeriodo,
  evaluarEstadoHitosMovilidad
} from '../src/views/movilidad/movilidadCalendario';
import { AsignacionHoraria, CursoSae, Docente, Establecimiento } from '../src/types';

const PERIODO = 2027;
const RBD_A = '88301';
const RBD_B = '88302';

const escuelaA: Establecimiento = {
  id: `est_${RBD_A}`,
  rbd: RBD_A,
  nombre: 'ESCUELA A FASE 2',
  comuna: 'Bulnes',
  regimen: 'JEC',
  porcentajePrioritarios: 70
};

const escuelaB: Establecimiento = {
  id: `est_${RBD_B}`,
  rbd: RBD_B,
  nombre: 'ESCUELA B FASE 2',
  comuna: 'Chillán',
  regimen: 'JEC',
  porcentajePrioritarios: 72
};

const cursoA: CursoSae = {
  id: 'cur_f2_a',
  rbd: RBD_A,
  periodo: PERIODO,
  nivel: '5° Básico',
  letra: 'A',
  regimen: 'JEC',
  cupoSae: 35,
  matriculaProyectada: 30,
  alumnosNeet: 1,
  alumnosNeep: 0
};

describe('Mesa de Movilidad - Fase 2 (Reversión, Acta/Concurso y Andon)', () => {
  beforeAll(async () => {
    await getDb();
  });

  beforeEach(async () => {
    await reiniciarTodaLaBaseDatos();
    await guardarEstablecimiento(escuelaA);
    await guardarEstablecimiento(escuelaB);
    await guardarCurso(cursoA);
  });

  it('D. revertirEscenarioConsolidado restaura docentes, vacante NN, asignaciones, solicitud y escenario, y respeta candados', async () => {
    const docOrig: Docente = {
      id: 'doc_f2_orig',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '16.111.222-3',
      nombres: 'CAMILA',
      apellidos: 'ROJAS',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Lenguaje',
      situacionFinalGdp: 'Vigente'
    };
    const vacDest: Docente = {
      id: 'vac_f2_dest',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-7001`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'LENGUAJE',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      asignaturaPrincipal: 'Lenguaje',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };
    await guardarDocente(docOrig);
    await guardarDocente(vacDest);

    const asigOrig: AsignacionHoraria = {
      id: 'asig_f2_1',
      rbd: RBD_A,
      periodo: PERIODO,
      cursoId: cursoA.id,
      docenteId: docOrig.id,
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 8
    };
    await guardarAsignacion(asigOrig);

    const sol = await guardarSolicitudMovilidad(
      {
        periodo: PERIODO,
        carril: 'TRASLADO_VOLUNTARIO',
        docenteId: docOrig.id,
        runDocente: docOrig.run,
        nombreDocente: 'CAMILA ROJAS',
        rbdOrigen: RBD_A,
        calidadJuridica: 'TITULAR',
        horasContratoActual: 30,
        horasTitularesActuales: 30,
        horasDisponiblesMover: 30,
        horasRemanentes: 0,
        asignaturaPrincipal: 'Lenguaje',
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'POSTULADO',
        puntajeSalud: 40,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 30
      },
      'asesor_uatp'
    );
    await avanzarEstadoFlujoMovilidad(sol.id, 'PRE_ASIGNADO', 'asesor_uatp');
    await avanzarEstadoFlujoMovilidad(sol.id, 'NOTIFICADO_DIRECCION_ORIGEN', 'asesor_uatp');
    await avanzarEstadoFlujoMovilidad(sol.id, 'ACEPTADO_CON_FIRMA', 'asesor_uatp');

    const esc = await crearEscenarioCalce(
      { periodo: PERIODO, nombre: 'Escenario Reversion F2' },
      'asesor_uatp'
    );
    const prop = await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: docOrig.id,
        vacanteDestinoId: vacDest.id,
        solicitudMovilidadId: sol.id,
        esTrasladoCompleto: true
      },
      'asesor_uatp'
    );
    expect(prop.generaRebote).toBe(true);

    await resolverRebotePropuestaCalce({
      propuestaId: prop.id,
      estadoResolucion: 'DERIVADA_A_CONCURSO_GDP',
      rolActor: 'asesor_uatp'
    });

    const consRes = await consolidarEscenarioAprobado({
      escenarioId: esc.id,
      rolActor: 'super_usuario',
      usuarioActor: 'Subdirector Test'
    });
    expect(consRes.rebotesCreados).toBe(1);

    // Verificar estado consolidado: docente origen retirado, rebote creado y asignación reapuntada
    const docsA_Cons = await listarDocentes(RBD_A, PERIODO);
    expect(docsA_Cons.some(d => d.id === docOrig.id)).toBe(false);
    const reboteDoc = docsA_Cons.find(d => d.tipoVacante === 'REBOTE_MOVILIDAD');
    expect(reboteDoc).toBeDefined();

    const asigsCons = await listarAsignaciones(RBD_A, PERIODO);
    expect(asigsCons[0].docenteId).toBe(reboteDoc!.id);

    const docsB_Cons = await listarDocentes(RBD_B, PERIODO);
    const vacCubierta = docsB_Cons.find(d => d.id === vacDest.id)!;
    expect(vacCubierta.esVacanteNn).toBe(false);
    expect(vacCubierta.run).toBe(docOrig.run);

    // Rechazos esperados: rol no consolidador y motivo vacío/corto
    await expect(
      revertirEscenarioConsolidado({
        escenarioId: esc.id,
        motivo: 'Desistimiento del docente',
        rolActor: 'asesor_uatp',
        usuarioActor: 'Asesor'
      })
    ).rejects.toThrow(/Acceso denegado/);

    await expect(
      revertirEscenarioConsolidado({
        escenarioId: esc.id,
        motivo: 'abc',
        rolActor: 'super_usuario',
        usuarioActor: 'Super'
      })
    ).rejects.toThrow(/motivo fundado/i);

    // Reversión controlada exitosa
    const rev = await revertirEscenarioConsolidado({
      escenarioId: esc.id,
      motivo: 'Desistimiento documentado previo a emisión de resolución',
      rolActor: 'super_usuario',
      usuarioActor: 'Super'
    });
    expect(rev.rebotesEliminados).toBe(1);
    expect(rev.docentesRestaurados).toBe(2);
    expect(rev.solicitudesRestauradas).toBe(1);

    // Verificar restauración íntegra
    const docsA_Post = await listarDocentes(RBD_A, PERIODO);
    expect(docsA_Post.some(d => d.id === docOrig.id && d.run === docOrig.run)).toBe(true);
    expect(docsA_Post.some(d => d.tipoVacante === 'REBOTE_MOVILIDAD')).toBe(false);

    const asigsPost = await listarAsignaciones(RBD_A, PERIODO);
    expect(asigsPost[0].docenteId).toBe(docOrig.id);

    const docsB_Post = await listarDocentes(RBD_B, PERIODO);
    const vacRestaurada = docsB_Post.find(d => d.id === vacDest.id)!;
    expect(vacRestaurada.esVacanteNn).toBe(true);
    expect(vacRestaurada.run).toBe(vacDest.run);

    const solsPost = await listarSolicitudesMovilidad(PERIODO, 'asesor_uatp');
    expect(solsPost.find(s => s.id === sol.id)?.estadoFlujo).toBe('ACEPTADO_CON_FIRMA');

    const escPost = (await listarEscenariosCalce(PERIODO, 'asesor_uatp')).find(e => e.id === esc.id)!;
    expect(escPost.estado).toBe('BORRADOR');

    const propsPost = await listarPropuestasEscenario(esc.id, 'asesor_uatp');
    expect(propsPost[0].estado).toBe('PROPUESTA');

    // Re-consolidar + emitir resolución exenta -> bloqueo de reversión
    await consolidarEscenarioAprobado({
      escenarioId: esc.id,
      rolActor: 'super_usuario',
      usuarioActor: 'Super'
    });
    await registrarResolucionExentaEscenario({
      escenarioId: esc.id,
      numeroResolucion: 'RES-EX-999/2027',
      fechaResolucion: '2027-01-10',
      rolActor: 'gdp_validador',
      usuarioActor: 'Validador'
    });

    await expect(
      revertirEscenarioConsolidado({
        escenarioId: esc.id,
        motivo: 'Intento tras resolución',
        rolActor: 'super_usuario',
        usuarioActor: 'Super'
      })
    ).rejects.toThrow(/CONSOLIDADO/);
  });

  it('E. generarHtmlActaMesaMovilidad y exportarVacantesRemanentesConcursoExcel generan documentos completos', async () => {
    const vacSinCubrir: Docente = {
      id: 'vac_conc_1',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-9911`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'FISICA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 22,
      horasSubvencionGeneralContrata: 22,
      asignaturaPrincipal: 'Física',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      justificacionVacante: 'Cobertura Plan Común Enseñanza Media'
    };

    const html = generarHtmlActaMesaMovilidad({
      escenario: {
        id: 'esc_acta_1',
        periodo: PERIODO,
        nombre: 'Escenario Oficial Mesa',
        estado: 'CONSOLIDADO',
        version: 3
      },
      propuestas: [
        {
          id: 'prop_acta_1',
          escenarioId: 'esc_acta_1',
          periodo: PERIODO,
          docenteOrigenId: 'doc_1',
          runDocente: '15.000.111-2',
          nombreDocente: 'PEDRO MORALES',
          rbdOrigen: RBD_A,
          rbdDestino: RBD_B,
          tipoCobertura: 'DEFINITIVA',
          horasAsignadas: 30,
          minutosAsignados: 1800,
          horasPedagogicasAula: 24,
          fuenteDestino: 'SUBVENCION_GENERAL',
          indiceCompatibilidad: 92,
          generaRebote: true,
          estadoResolucionRebote: 'DERIVADA_A_CONCURSO_GDP',
          vacanteRebote: {
            rbdOrigen: RBD_A,
            horasContratoRebote: 30,
            minutosContratoRebote: 1800,
            horasPedagogicasAula: 24,
            asignaturaPrincipal: 'Matemática',
            fuenteFinanciamiento: 'SUBVENCION_GENERAL',
            asignacionesHeredadas: [],
            funcionesNoLectivasHeredadas: [],
            deltaMinutosCadena: 0
          },
          alertasNormativas: [],
          bloqueaConsolidacion: false,
          estado: 'CONSOLIDADA'
        }
      ],
      colegios: [escuelaA, escuelaB],
      vacantesSinCubrir: [vacSinCubrir],
      periodo: PERIODO,
      usuarioActor: 'Subdirector UATP'
    });

    expect(html).toContain('Acta de Mesa Territorial de Movilidad');
    expect(html).toContain('PEDRO MORALES');
    expect(html).toContain('ESCUELA A FASE 2');
    expect(html).toContain('Física');
    expect(html).toContain('Subdirector/a UATP');
    expect(html).toContain('Encargado/a GDP');

    const bytes = await exportarVacantesRemanentesConcursoExcel({
      vacantesSinCubrir: [vacSinCubrir],
      colegios: [escuelaA, escuelaB],
      periodo: PERIODO
    });
    expect(bytes.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes as any);
    const ws = wb.getWorksheet('Vacantes Concurso GDP');
    expect(ws).toBeDefined();
    expect(ws!.rowCount).toBe(2);
    expect(JSON.stringify(ws!.getRow(2).values)).toContain('Física');
  });

  it('F. evaluarEstadoHitosMovilidad clasifica correctamente COMPLETADO, EN_PLAZO, PROXIMO_VENCER y ATRASADO', () => {
    const hitos = obtenerHitosDefectoPeriodo(2027);
    // Fechas defecto: 2026-11-15, 2026-11-30, 2026-12-15, 2026-12-30, 2027-01-15
    const evals = evaluarEstadoHitosMovilidad(hitos, '2026-11-25', {
      1: true,   // aunque fecha 2026-11-15 ya pasó, está completada
      2: false,  // 2026-11-30 -> faltan 5 días -> PROXIMO_VENCER
      3: false,  // 2026-12-15 -> faltan 20 días -> EN_PLAZO
      4: false,  // 2026-12-30 -> EN_PLAZO
      5: false
    });

    expect(evals[0].estado).toBe('COMPLETADO');
    expect(evals[1].estado).toBe('PROXIMO_VENCER');
    expect(evals[1].diasRestantes).toBe(5);
    expect(evals[2].estado).toBe('EN_PLAZO');

    const evalsAtraso = evaluarEstadoHitosMovilidad(hitos, '2026-12-05', {
      1: false,
      2: false,
      3: false,
      4: false,
      5: false
    });
    expect(evalsAtraso[0].estado).toBe('ATRASADO');
    expect(evalsAtraso[1].estado).toBe('ATRASADO');
  });
});
