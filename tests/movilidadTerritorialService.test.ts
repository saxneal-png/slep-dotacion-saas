import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  getDb,
  guardarEstablecimiento,
  guardarCurso,
  guardarDocente,
  guardarAsignacion,
  listarDocentes,
  listarAsignaciones,
  listarEventosAuditoria,
  reiniciarTodaLaBaseDatos
} from '../src/database/db';
import {
  esRolNivelCentralMovilidad,
  esRolValidadorGdp,
  esRolConsolidadorMovilidad,
  filtrarDocentesSinDobleConteoCondicional,
  previsualizarEscaneoVacantesNn,
  escanearYSanearVacantesNnTerritorio,
  crearNecesidadVacanteEscuela,
  listarEgresosProyectados,
  guardarEgresoProyectado,
  eliminarEgresoProyectado,
  listarSolicitudesMovilidad,
  guardarSolicitudMovilidad,
  avanzarEstadoFlujoMovilidad,
  detectarDocentesHorasRemanentes,
  listarEscenariosCalce,
  crearEscenarioCalce,
  duplicarEscenarioCalce,
  listarPropuestasEscenario,
  agregarPropuestaCalce,
  generarSugerenciasCalceAutomatico,
  consolidarEscenarioAprobado
} from '../src/services/movilidadTerritorialService';
import {
  analizarSincronizacionDotacion,
  detectarVacantesNnEnColegio
} from '../src/services/reconciliacionDotacionService';
import {
  calcularDiagnosticoColegio,
  consolidarCarteraTerritorial,
  obtenerDocentesConsolidadosTerritorio
} from '../src/services/dotacionCalculationService';
import { generarExcelConsolidadoPalDEP } from '../src/services/depPalExportService';
import { generarExcelGdpColegio } from '../src/services/depGdpExportService';
import ExcelJS from 'exceljs';
import {
  actualizarFeatureFlagsMovilidad,
  FEATURE_FLAGS_MOVILIDAD_DEFAULT
} from '../src/services/configuracionGeneralService';
import { CursoSae, Docente, Establecimiento } from '../src/types';

const PERIODO = 2027;
const RBD_A = '88101';
const RBD_B = '88102';

const escuelaA: Establecimiento = {
  id: `est_${RBD_A}`,
  rbd: RBD_A,
  nombre: 'ESCUELA ORIGEN LOS TILOS',
  comuna: 'Bulnes',
  regimen: 'JEC',
  porcentajePrioritarios: 72
};

const escuelaB: Establecimiento = {
  id: `est_${RBD_B}`,
  rbd: RBD_B,
  nombre: 'ESCUELA DESTINO LAS ROSAS',
  comuna: 'Chillán',
  regimen: 'JEC',
  porcentajePrioritarios: 74
};

const cursoA1: CursoSae = {
  id: 'cur_a_5b',
  rbd: RBD_A,
  periodo: PERIODO,
  nivel: '5° Básico',
  letra: 'A',
  regimen: 'JEC',
  cupoSae: 35,
  matriculaProyectada: 30,
  alumnosNeet: 2,
  alumnosNeep: 1
};

const cursoB1: CursoSae = {
  id: 'cur_b_6b',
  rbd: RBD_B,
  periodo: PERIODO,
  nivel: '6° Básico',
  letra: 'A',
  regimen: 'JEC',
  cupoSae: 35,
  matriculaProyectada: 28,
  alumnosNeet: 2,
  alumnosNeep: 0
};

describe('movilidadTerritorialService - Mesa de Movilidad Territorial y Contingencia', () => {
  beforeAll(async () => {
    await getDb();
  });

  beforeEach(async () => {
    await reiniciarTodaLaBaseDatos();
    const db = await getDb();
    db.run('DELETE FROM auditoria_cambios;');
    actualizarFeatureFlagsMovilidad({ ...FEATURE_FLAGS_MOVILIDAD_DEFAULT }, 'test-reset');

    await guardarEstablecimiento(escuelaA);
    await guardarEstablecimiento(escuelaB);
    await guardarCurso(cursoA1);
    await guardarCurso(cursoB1);
  });

  it('1. Aislamiento por rol: director_establecimiento y jefe_utp_establecimiento quedan bloqueados en todos los flujos de movilidad y egresos', async () => {
    expect(esRolNivelCentralMovilidad('director_establecimiento')).toBe(false);
    expect(esRolNivelCentralMovilidad('jefe_utp_establecimiento')).toBe(false);
    expect(esRolNivelCentralMovilidad('asesor_uatp')).toBe(true);
    expect(esRolNivelCentralMovilidad('gdp_validador')).toBe(true);
    expect(esRolValidadorGdp('asesor_uatp')).toBe(false);
    expect(esRolValidadorGdp('gdp_validador')).toBe(true);
    expect(esRolConsolidadorMovilidad('gdp_validador')).toBe(false);
    expect(esRolConsolidadorMovilidad('asesor_uatp')).toBe(false);
    expect(esRolConsolidadorMovilidad('subdirector_uatp')).toBe(true);
    expect(esRolConsolidadorMovilidad('super_usuario')).toBe(true);

    for (const rolEscuela of ['director_establecimiento', 'jefe_utp_establecimiento'] as const) {
      await expect(listarEgresosProyectados(PERIODO, rolEscuela)).rejects.toThrow(/Acceso denegado/);
      await expect(
        guardarEgresoProyectado(
          {
            rbd: RBD_A,
            periodo: PERIODO,
            docenteId: 'doc_x',
            runDocente: '10.005.711-5',
            nombreDocente: 'MARIO SOTO',
            horasLiberadas: 30,
            horasAulaLiberadas: 20,
            fuenteFinanciamiento: 'SUBVENCION_GENERAL',
            calidadJuridica: 'TITULAR',
            causal: 'renuncia_voluntaria',
            certeza: 'en_tramite',
            excepcionJubilacion3Anios: false,
            impactoPresupuestario: 'costo_doble_pendiente'
          },
          rolEscuela
        )
      ).rejects.toThrow(/Acceso denegado/);

      await expect(listarSolicitudesMovilidad(PERIODO, rolEscuela)).rejects.toThrow(/Acceso denegado/);
      await expect(
        guardarSolicitudMovilidad(
          {
            periodo: PERIODO,
            carril: 'TRASLADO_VOLUNTARIO',
            docenteId: 'doc_x',
            runDocente: '10.005.711-5',
            nombreDocente: 'MARIO SOTO',
            rbdOrigen: RBD_A,
            calidadJuridica: 'TITULAR',
            horasContratoActual: 30,
            horasTitularesActuales: 30,
            horasDisponiblesMover: 30,
            horasRemanentes: 0,
            fuenteActual: 'SUBVENCION_GENERAL',
            estadoFlujo: 'POSTULADO',
            puntajeSalud: 0,
            puntajeLeyKarin: 0,
            puntajeCuidadoDependientes: 0,
            puntajeDistanciaRural: 0,
            puntajeAntiguedad: 10
          },
          rolEscuela
        )
      ).rejects.toThrow(/Acceso denegado/);

      await expect(listarEscenariosCalce(PERIODO, rolEscuela)).rejects.toThrow(/Acceso denegado/);
      await expect(
        crearEscenarioCalce({ periodo: PERIODO, nombre: 'Escenario no autorizado' }, rolEscuela)
      ).rejects.toThrow(/Acceso denegado/);
      await expect(
        escanearYSanearVacantesNnTerritorio({ periodo: PERIODO, rolActor: rolEscuela })
      ).rejects.toThrow(/Acceso denegado/);
    }
  });

  it('2. Saneamiento batch de vacantes NN ("NN", "POR PROVEER", RUN "11.111.111-1") marca esVacanteNn = true y preserva 100% sus asignaciones_horarias', async () => {
    const docReal: Docente = {
      id: 'doc_real_valid',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '10.005.711-5',
      nombres: 'MARIO',
      apellidos: 'SOTO',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      asignaturaPrincipal: 'Lenguaje'
    };
    const docNn1: Docente = {
      id: 'doc_nn_1',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '',
      nombres: 'N.N.',
      apellidos: 'MATEMATICA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      asignaturaPrincipal: 'Matemática'
    };
    const docPorProveer: Docente = {
      id: 'doc_nn_2',
      rbd: RBD_B,
      periodo: PERIODO,
      run: '99.999.999-9',
      nombres: 'DOCENTE',
      apellidos: 'POR PROVEER',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 22,
      horasSepContrata: 22,
      asignaturaPrincipal: 'Historia'
    };
    const docRunFicticio: Docente = {
      id: 'doc_nn_3',
      rbd: RBD_B,
      periodo: PERIODO,
      run: '11.111.111-1',
      nombres: 'CARGO',
      apellidos: 'VACANTE CIENCIAS',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 15,
      horasPieContrata: 15,
      asignaturaPrincipal: 'Ciencias Naturales'
    };

    await guardarDocente(docReal);
    await guardarDocente(docNn1);
    await guardarDocente(docPorProveer);
    await guardarDocente(docRunFicticio);

    await guardarAsignacion({
      id: 'asig_nn_1',
      rbd: RBD_A,
      periodo: PERIODO,
      cursoId: cursoA1.id,
      docenteId: docNn1.id,
      asignatura: 'Matemática',
      horasPedagogicasAula: 8
    });
    await guardarAsignacion({
      id: 'asig_nn_2',
      rbd: RBD_B,
      periodo: PERIODO,
      cursoId: cursoB1.id,
      docenteId: docPorProveer.id,
      asignatura: 'Historia',
      horasPedagogicasAula: 4
    });

    const preview = await previsualizarEscaneoVacantesNn(PERIODO);
    expect(preview.length).toBe(3);
    expect(preview.map(p => p.docente.id).sort()).toEqual(['doc_nn_1', 'doc_nn_2', 'doc_nn_3']);
    expect(preview.find(p => p.docente.id === 'doc_nn_1')?.asignacionesCount).toBe(1);

    // Integración con reconciliacionDotacionService
    const docsA = await listarDocentes(RBD_A, PERIODO);
    const asigsA = await listarAsignaciones(RBD_A, PERIODO);
    const diagSyncA = analizarSincronizacionDotacion(escuelaA, docsA, [cursoA1], asigsA);
    expect(diagSyncA.vacantesNnCount).toBe(1);
    const nnDetectadasA = detectarVacantesNnEnColegio(docsA, asigsA);
    expect(nnDetectadasA[0].horasAulaAsignadas).toBe(8);
    expect(nnDetectadasA[0].fuentesFinanciamiento.subvencionGeneral).toBe(30);

    const resSaneamiento = await escanearYSanearVacantesNnTerritorio({
      periodo: PERIODO,
      rolActor: 'asesor_uatp',
      usuarioActor: 'Asesor UATP'
    });

    expect(resSaneamiento.escaneados).toBe(4);
    expect(resSaneamiento.marcadosNn).toBe(3);
    expect(resSaneamiento.asignacionesPreservadas).toBe(2);
    expect(resSaneamiento.idsMarcados.sort()).toEqual(['doc_nn_1', 'doc_nn_2', 'doc_nn_3']);

    const docsPostA = await listarDocentes(RBD_A, PERIODO);
    const nn1Post = docsPostA.find(d => d.id === 'doc_nn_1')!;
    expect(nn1Post.esVacanteNn).toBe(true);
    expect(nn1Post.horasSubvencionGeneralContrata).toBe(30);

    const docsPostB = await listarDocentes(RBD_B, PERIODO);
    const nn2Post = docsPostB.find(d => d.id === 'doc_nn_2')!;
    const nn3Post = docsPostB.find(d => d.id === 'doc_nn_3')!;
    expect(nn2Post.esVacanteNn).toBe(true);
    expect(nn2Post.horasSepContrata).toBe(22);
    expect(nn3Post.esVacanteNn).toBe(true);
    expect(nn3Post.horasPieContrata).toBe(15);

    // Las asignaciones_horarias permanecen 100% intactas
    const asigsPostA = await listarAsignaciones(RBD_A, PERIODO);
    const asigsPostB = await listarAsignaciones(RBD_B, PERIODO);
    expect(asigsPostA.length).toBe(1);
    expect(asigsPostA[0].docenteId).toBe('doc_nn_1');
    expect(asigsPostA[0].horasPedagogicasAula).toBe(8);
    expect(asigsPostB.length).toBe(1);
    expect(asigsPostB[0].docenteId).toBe('doc_nn_2');

    // Auditoría registrada por cada RBD
    const audA = await listarEventosAuditoria(RBD_A, PERIODO);
    const audB = await listarEventosAuditoria(RBD_B, PERIODO);
    expect(audA.length).toBeGreaterThanOrEqual(1);
    expect(audB.length).toBeGreaterThanOrEqual(1);
  });

  it('3. crearNecesidadVacanteEscuela respeta flag_saneamiento_nn_escuelas y crea vacante estructurada sin RUN falso', async () => {
    actualizarFeatureFlagsMovilidad({ flag_saneamiento_nn_escuelas: false }, 'admin');
    await expect(
      crearNecesidadVacanteEscuela({
        rbd: RBD_A,
        periodo: PERIODO,
        especialidad: 'Inglés',
        estamento: 'DOCENTE_AULA',
        horasContrato: 22,
        fuenteFinanciamiento: 'SEP',
        justificacion: 'Cobertura de inglés segundo ciclo'
      })
    ).rejects.toThrow(/flag_saneamiento_nn_escuelas/);

    actualizarFeatureFlagsMovilidad({ flag_saneamiento_nn_escuelas: true }, 'admin');

    await expect(
      crearNecesidadVacanteEscuela({
        rbd: RBD_A,
        periodo: PERIODO,
        especialidad: 'Inglés',
        estamento: 'DOCENTE_AULA',
        horasContrato: 45,
        fuenteFinanciamiento: 'SEP',
        justificacion: 'Exceso horas'
      })
    ).rejects.toThrow(/1 y 44/);

    const vacante = await crearNecesidadVacanteEscuela({
      rbd: RBD_A,
      periodo: PERIODO,
      especialidad: 'Inglés',
      estamento: 'DOCENTE_AULA',
      horasContrato: 22,
      fuenteFinanciamiento: 'SEP',
      justificacion: 'Cobertura obligatoria de inglés 5° a 8° Básico',
      usuarioActor: 'Director Escuela A'
    });

    expect(vacante.id).toMatch(new RegExp(`^vac_esc_${RBD_A}_${PERIODO}_`));
    expect(vacante.run).toMatch(new RegExp(`^VAC-${RBD_A}-\\d{4}$`));
    expect(vacante.nombres).toBe('VACANTE POR PROVEER');
    expect(vacante.apellidos).toBe('INGLÉS');
    expect(vacante.esVacanteNn).toBe(true);
    expect(vacante.tipoVacante).toBe('NECESIDAD_ESCUELA');
    expect(vacante.vacanteCondicional).toBe(false);
    expect(vacante.horasSepContrata).toBe(22);
    expect(vacante.horasSubvencionGeneralContrata).toBe(0);
    expect(vacante.horasPieContrata).toBe(0);

    const enDb = (await listarDocentes(RBD_A, PERIODO)).find(d => d.id === vacante.id);
    expect(enDb).toBeDefined();
    expect(enDb?.justificacionVacante).toBe('Cobertura obligatoria de inglés 5° a 8° Básico');
  });

  it('4. Egreso Art. 19 S con excepción 3 años NO libera vacante; egreso en_tramite crea vacante condicional y BLOQUEA consolidar titular definitivo', async () => {
    const docenteEgresa: Docente = {
      id: 'doc_egr_1',
      rbd: RBD_B,
      periodo: PERIODO,
      run: '14.555.666-K',
      nombres: 'ANA',
      apellidos: 'DURAN',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Matemática',
      situacionFinalGdp: 'Vigente'
    };
    const docenteEntranteTitular: Docente = {
      id: 'doc_tit_entrante',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '12.345.678-5',
      nombres: 'LUIS',
      apellidos: 'MORALES',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Matemática'
    };

    await guardarDocente(docenteEgresa);
    await guardarDocente(docenteEntranteTitular);

    // Caso 4A: Art. 19 S con excepción <= 3 años de jubilación
    const res19s = await guardarEgresoProyectado(
      {
        rbd: RBD_B,
        periodo: PERIODO,
        docenteId: docenteEgresa.id,
        runDocente: docenteEgresa.run,
        nombreDocente: 'ANA DURAN',
        asignaturaPrincipal: 'Matemática',
        horasLiberadas: 30,
        horasAulaLiberadas: 22,
        fuenteFinanciamiento: 'SUBVENCION_GENERAL',
        calidadJuridica: 'TITULAR',
        causal: 'art_19s_no_avance',
        certeza: 'en_tramite',
        excepcionJubilacion3Anios: true,
        impactoPresupuestario: 'sin_impacto_doble'
      },
      'gdp_validador',
      true
    );

    expect(res19s.evaluacion.liberaVacante).toBe(false);
    expect(res19s.vacanteGenerada).toBeUndefined();
    expect(res19s.egreso.vacanteDocenteId).toBeUndefined();

    // Caso 4B: Egreso en trámite (renuncia voluntaria) crea vacante condicional
    const resTramite = await guardarEgresoProyectado(
      {
        rbd: RBD_B,
        periodo: PERIODO,
        docenteId: docenteEgresa.id,
        runDocente: docenteEgresa.run,
        nombreDocente: 'ANA DURAN',
        asignaturaPrincipal: 'Matemática',
        horasLiberadas: 30,
        horasAulaLiberadas: 22,
        fuenteFinanciamiento: 'SUBVENCION_GENERAL',
        calidadJuridica: 'TITULAR',
        causal: 'renuncia_voluntaria',
        certeza: 'en_tramite',
        excepcionJubilacion3Anios: false,
        impactoPresupuestario: 'costo_doble_pendiente'
      },
      'gdp_validador',
      true
    );

    expect(resTramite.evaluacion.liberaVacante).toBe(true);
    expect(resTramite.evaluacion.esVacanteCondicional).toBe(true);
    expect(resTramite.vacanteGenerada).toBeDefined();
    const vacCond = resTramite.vacanteGenerada!;
    expect(vacCond.vacanteCondicional).toBe(true);
    expect(vacCond.tipoVacante).toBe('CONDICIONAL_EGRESO');
    expect(vacCond.reemplazoDeRun).toBe(docenteEgresa.run);

    // Si luego cambia a Art. 19 S con excepción, debe limpiar vacante previa
    const egresoTmp = await guardarEgresoProyectado(
      {
        id: 'egr_limpieza_19s',
        rbd: RBD_B,
        periodo: PERIODO,
        docenteId: docenteEgresa.id,
        runDocente: docenteEgresa.run,
        nombreDocente: 'ANA DURAN',
        asignaturaPrincipal: 'Matemática',
        horasLiberadas: 30,
        horasAulaLiberadas: 22,
        fuenteFinanciamiento: 'SUBVENCION_GENERAL',
        calidadJuridica: 'TITULAR',
        causal: 'art_19s_no_avance',
        certeza: 'en_tramite',
        excepcionJubilacion3Anios: false,
        impactoPresupuestario: 'costo_doble_pendiente'
      },
      'gdp_validador',
      true
    );
    expect(egresoTmp.vacanteGenerada).toBeDefined();
    const egresoTmpIdVac = egresoTmp.vacanteGenerada!.id;

    const egresoLimpiado = await guardarEgresoProyectado(
      {
        id: 'egr_limpieza_19s',
        rbd: RBD_B,
        periodo: PERIODO,
        docenteId: docenteEgresa.id,
        runDocente: docenteEgresa.run,
        nombreDocente: 'ANA DURAN',
        asignaturaPrincipal: 'Matemática',
        horasLiberadas: 30,
        horasAulaLiberadas: 22,
        fuenteFinanciamiento: 'SUBVENCION_GENERAL',
        calidadJuridica: 'TITULAR',
        causal: 'art_19s_no_avance',
        certeza: 'en_tramite',
        excepcionJubilacion3Anios: true,
        impactoPresupuestario: 'sin_impacto_doble'
      },
      'gdp_validador',
      true
    );
    expect(egresoLimpiado.egreso.vacanteDocenteId).toBeUndefined();
    const docsCheck = await listarDocentes(RBD_B, PERIODO);
    expect(docsCheck.some(d => d.id === egresoTmpIdVac)).toBe(false);
    await eliminarEgresoProyectado('egr_limpieza_19s', 'gdp_validador');

    // Proponer titular definitivo sobre la vacante condicional de resTramite -> debe BLOQUEAR consolidación
    const escenario = await crearEscenarioCalce(
      { periodo: PERIODO, nombre: 'Escenario Bloqueo Condicional', creadoPor: 'Asesor UATP' },
      'asesor_uatp'
    );
    const propuestaBloqueada = await agregarPropuestaCalce(
      {
        escenarioId: escenario.id,
        periodo: PERIODO,
        docenteOrigenId: docenteEntranteTitular.id,
        vacanteDestinoId: vacCond.id,
        egresoOrigenId: resTramite.egreso.id,
        tipoCobertura: 'DEFINITIVA'
      },
      'asesor_uatp'
    );

    expect(propuestaBloqueada.bloqueaConsolidacion).toBe(true);
    expect(propuestaBloqueada.estado).toBe('BLOQUEADA');
    expect(propuestaBloqueada.motivoBloqueo).toMatch(/Vacante Condicional|en trámite/i);

    await expect(
      consolidarEscenarioAprobado({
        escenarioId: escenario.id,
        rolActor: 'super_usuario',
        usuarioActor: 'Super Usuario'
      })
    ).rejects.toThrow(/Consolidación bloqueada/);
  });

  it('5. Consolidación atómica (permitida para subdirector_uatp/super_usuario, denegada para asesor_uatp/gdp_validador) reemplaza NN destino, crea NN-Rebote en Escuela A heredando asignaciones/funciones y registra auditoría', async () => {
    const docenteOrigenA: Docente = {
      id: 'doc_origen_a',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '15.432.109-8',
      nombres: 'CLAUDIA',
      apellidos: 'VERA',
      titulo: 'Profesora de Lenguaje y Comunicación',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      horasAula: 22,
      asignaturaPrincipal: 'Lenguaje y Comunicación',
      aplicaArticulo69: false,
      funcionesNoAula: [
        {
          id: 'fn_cra_1',
          tipo: 'CRA',
          nombre: 'Encargada CRA',
          horas: 4,
          financiamiento: 'SUBVENCION_GENERAL'
        }
      ]
    };

    const vacanteDestinoB: Docente = {
      id: 'vac_dest_b',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-5501`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'LENGUAJE Y COMUNICACIÓN',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      horasAula: 22,
      asignaturaPrincipal: 'Lenguaje y Comunicación',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };

    await guardarDocente(docenteOrigenA);
    await guardarDocente(vacanteDestinoB);

    await guardarAsignacion({
      id: 'asig_origen_a_1',
      rbd: RBD_A,
      periodo: PERIODO,
      cursoId: cursoA1.id,
      docenteId: docenteOrigenA.id,
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 8
    });

    await guardarAsignacion({
      id: 'asig_dest_b_1',
      rbd: RBD_B,
      periodo: PERIODO,
      cursoId: cursoB1.id,
      docenteId: vacanteDestinoB.id,
      asignatura: 'Lenguaje y Comunicación',
      horasPedagogicasAula: 8
    });

    const solicitud = await guardarSolicitudMovilidad(
      {
        periodo: PERIODO,
        carril: 'TRASLADO_VOLUNTARIO',
        docenteId: docenteOrigenA.id,
        runDocente: docenteOrigenA.run,
        nombreDocente: 'CLAUDIA VERA',
        rbdOrigen: RBD_A,
        comunaOrigen: 'Bulnes',
        rbdDestinoPreferente: RBD_B,
        comunaDestinoPreferente: 'Chillán',
        calidadJuridica: 'TITULAR',
        horasContratoActual: 30,
        horasTitularesActuales: 30,
        horasDisponiblesMover: 30,
        horasRemanentes: 0,
        asignaturaPrincipal: 'Lenguaje y Comunicación',
        tituloMencion: 'Profesora de Lenguaje y Comunicación',
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'POSTULADO',
        puntajeSalud: 80,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 50,
        puntajeDistanciaRural: 40,
        puntajeAntiguedad: 60
      },
      'asesor_uatp'
    );

    expect(solicitud.puntajePrioridadTotal).toBeGreaterThan(0);

    // Validar transiciones de flujo
    await expect(
      avanzarEstadoFlujoMovilidad(solicitud.id, 'ACEPTADO_CON_FIRMA', 'asesor_uatp')
    ).rejects.toThrow(/Transición de estado inválida/);

    await avanzarEstadoFlujoMovilidad(solicitud.id, 'PRE_ASIGNADO', 'asesor_uatp');
    await avanzarEstadoFlujoMovilidad(solicitud.id, 'NOTIFICADO_DIRECCION_ORIGEN', 'asesor_uatp');
    const solFirmada = await avanzarEstadoFlujoMovilidad(
      solicitud.id,
      'ACEPTADO_CON_FIRMA',
      'asesor_uatp'
    );
    expect(solFirmada.estadoFlujo).toBe('ACEPTADO_CON_FIRMA');

    const escenario = await crearEscenarioCalce(
      { periodo: PERIODO, nombre: 'Plan Consolidación Oficial', creadoPor: 'Asesor UATP' },
      'asesor_uatp'
    );

    const propuesta = await agregarPropuestaCalce(
      {
        escenarioId: escenario.id,
        periodo: PERIODO,
        docenteOrigenId: docenteOrigenA.id,
        vacanteDestinoId: vacanteDestinoB.id,
        solicitudMovilidadId: solicitud.id,
        tipoCobertura: 'DEFINITIVA',
        esTrasladoCompleto: true
      },
      'asesor_uatp'
    );

    expect(propuesta.bloqueaConsolidacion).toBe(false);
    expect(propuesta.generaRebote).toBe(true);
    expect(propuesta.vacanteRebote).toBeDefined();
    expect(propuesta.vacanteRebote!.horasContratoRebote).toBe(30);
    expect(propuesta.vacanteRebote!.minutosContratoRebote).toBe(1800);
    expect(propuesta.vacanteRebote!.asignacionesHeredadas.length).toBe(1);
    expect(propuesta.vacanteRebote!.funcionesNoLectivasHeredadas.length).toBe(1);

    // Duplicar escenario preserva propuestas en nuevo borrador
    const escCopia = await duplicarEscenarioCalce(escenario.id, 'Plan Copia', 'asesor_uatp', 'Asesor');
    const propsCopia = await listarPropuestasEscenario(escCopia.id, 'asesor_uatp');
    expect(propsCopia.length).toBe(1);

    // Denegada consolidación para asesor_uatp y gdp_validador
    await expect(
      consolidarEscenarioAprobado({
        escenarioId: escenario.id,
        rolActor: 'asesor_uatp',
        usuarioActor: 'Asesor UATP'
      })
    ).rejects.toThrow(/Acceso denegado/);
    await expect(
      consolidarEscenarioAprobado({
        escenarioId: escenario.id,
        rolActor: 'gdp_validador',
        usuarioActor: 'Validador GDP'
      })
    ).rejects.toThrow(/Acceso denegado/);

    // Ejecución atómica por subdirector_uatp
    const resCons = await consolidarEscenarioAprobado({
      escenarioId: escenario.id,
      rolActor: 'subdirector_uatp',
      usuarioActor: 'Subdirector UATP'
    });

    expect(resCons.propuestasConsolidadas).toBe(1);
    expect(resCons.vacantesReemplazadas).toBe(1);
    expect(resCons.rebotesCreados).toBe(1);
    expect(resCons.rbdsAfectados.sort()).toEqual([RBD_A, RBD_B]);

    // En Escuela B: el registro NN destino conserva su ID y asignaciones pero ahora tiene RUN y datos reales
    const docsB = await listarDocentes(RBD_B, PERIODO);
    const reemplazadaB = docsB.find(d => d.id === vacanteDestinoB.id)!;
    expect(reemplazadaB).toBeDefined();
    expect(reemplazadaB.run).toBe(docenteOrigenA.run);
    expect(reemplazadaB.nombres).toBe('CLAUDIA');
    expect(reemplazadaB.apellidos).toBe('VERA');
    expect(reemplazadaB.esVacanteNn).toBe(false);
    expect(reemplazadaB.calidadJuridica).toBe('TITULAR');
    expect(reemplazadaB.horasSubvencionGeneralTitular).toBe(30);

    const asigsB = await listarAsignaciones(RBD_B, PERIODO);
    expect(asigsB.length).toBe(1);
    expect(asigsB[0].docenteId).toBe(vacanteDestinoB.id);
    expect(asigsB[0].horasPedagogicasAula).toBe(8);

    // En Escuela A: fila origen retirada, NN-Rebote creada heredando asignaciones y funciones no lectivas
    const docsA = await listarDocentes(RBD_A, PERIODO);
    expect(docsA.some(d => d.id === docenteOrigenA.id)).toBe(false);
    const reboteA = docsA.find(d => d.tipoVacante === 'REBOTE_MOVILIDAD')!;
    expect(reboteA).toBeDefined();
    expect(reboteA.esVacanteNn).toBe(true);
    expect(reboteA.run).toMatch(new RegExp(`^REB-${RBD_A}-`));
    expect(reboteA.nombres).toBe('VACANTE REBOTE');
    expect(reboteA.horasContrato).toBe(30);
    expect(reboteA.funcionesNoAula?.length).toBe(1);
    expect(reboteA.funcionesNoAula?.[0].tipo).toBe('CRA');

    const asigsA = await listarAsignaciones(RBD_A, PERIODO);
    expect(asigsA.length).toBe(1);
    expect(asigsA[0].docenteId).toBe(reboteA.id);
    expect(asigsA[0].cursoId).toBe(cursoA1.id);
    expect(asigsA[0].horasPedagogicasAula).toBe(8);

    // No existe doble conteo multi-escuela del RUN trasladado
    const consolidados = obtenerDocentesConsolidadosTerritorio(
      [escuelaA, escuelaB],
      [...docsA, ...docsB],
      [...asigsA, ...asigsB],
      [cursoA1, cursoB1]
    );
    const claudiaCons = consolidados.find(c => c.run === docenteOrigenA.run)!;
    expect(claudiaCons).toBeDefined();
    expect(claudiaCons.contratos.length).toBe(1);
    expect(claudiaCons.horasTotalesSlep).toBe(30);
    expect(claudiaCons.excedeLimiteSlep).toBe(false);

    // Auditoría registrada en ambos RBDs
    const audA = await listarEventosAuditoria(RBD_A, PERIODO);
    const audB = await listarEventosAuditoria(RBD_B, PERIODO);
    expect(audA.some(e => e.tipoEvento === 'TRASPASO')).toBe(true);
    expect(audB.some(e => e.tipoEvento === 'TRASPASO')).toBe(true);
  });

  it('6. filtrarDocentesSinDobleConteoCondicional excluye vacante condicional cuando el titular sigue activo y evita doble conteo en diagnóstico y consolidado', () => {
    const titularActivo: Docente = {
      id: 'doc_tit_activo',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '16.789.012-1',
      nombres: 'ROBERTO',
      apellidos: 'SILVA',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      situacionFinalGdp: 'Vigente'
    };

    const vacanteCondicional: Docente = {
      id: 'vac_cond_1',
      rbd: RBD_A,
      periodo: PERIODO,
      run: `VAC-EGR-${RBD_A}-0001`,
      nombres: 'VACANTE CONDICIONAL',
      apellidos: 'MATEMATICA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralContrata: 44,
      esVacanteNn: true,
      tipoVacante: 'CONDICIONAL_EGRESO',
      vacanteCondicional: true,
      reemplazoDeRun: '16789012-1' // formato sin puntos para verificar normalización
    };

    const resConActivo = filtrarDocentesSinDobleConteoCondicional([titularActivo, vacanteCondicional]);
    expect(resConActivo.docentesEfectivos.map(d => d.id)).toEqual(['doc_tit_activo']);
    expect(resConActivo.excluidosCondicionales.map(d => d.id)).toEqual(['vac_cond_1']);

    // Diagnóstico colegio y consolidador territorial no deben sumar 88h
    const diag = calcularDiagnosticoColegio(
      escuelaA,
      [],
      [cursoA1],
      [titularActivo, vacanteCondicional],
      []
    );
    expect(diag.balanzaGeneral.horasContratadasTotales).toBe(44);
    expect(diag.estadoDocentes.length).toBe(1);

    const cartera = consolidarCarteraTerritorial(
      [escuelaA],
      [titularActivo, vacanteCondicional],
      [diag]
    );
    expect(cartera.inconsistencias.length).toBe(0);

    const consolidados = obtenerDocentesConsolidadosTerritorio(
      [escuelaA],
      [titularActivo, vacanteCondicional],
      [],
      [cursoA1]
    );
    expect(consolidados.length).toBe(1);
    expect(consolidados[0].horasTotalesSlep).toBe(44);

    // Cuando el titular cambia a 'Cese' o 'Renuncia', la vacante condicional pasa a ser efectiva
    const titularCesado: Docente = { ...titularActivo, situacionFinalGdp: 'Cese' };
    const resConCese = filtrarDocentesSinDobleConteoCondicional([titularCesado, vacanteCondicional]);
    expect(resConCese.excluidosCondicionales.length).toBe(0);
    expect(resConCese.docentesEfectivos.map(d => d.id).sort()).toEqual(['doc_tit_activo', 'vac_cond_1']);

    const titularRenuncia: Docente = { ...titularActivo, situacionFinalGdp: 'Renuncia' };
    const resConRenuncia = filtrarDocentesSinDobleConteoCondicional([titularRenuncia, vacanteCondicional]);
    expect(resConRenuncia.excluidosCondicionales.length).toBe(0);
  });

  it('6B. Exportadores PAL 2027 y GDP excluyen vacantes condicionales con titular activo para evitar doble conteo', async () => {
    const titularActivo: Docente = {
      id: 'doc_pal_tit',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '16.789.012-1',
      nombres: 'ROBERTO',
      apellidos: 'SILVA',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      situacionFinalGdp: 'Vigente'
    };

    const vacanteCondicional: Docente = {
      id: 'vac_pal_cond',
      rbd: RBD_A,
      periodo: PERIODO,
      run: `VAC-EGR-${RBD_A}-0002`,
      nombres: 'VACANTE CONDICIONAL',
      apellidos: 'MATEMATICA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      esVacanteNn: true,
      tipoVacante: 'CONDICIONAL_EGRESO',
      vacanteCondicional: true,
      reemplazoDeRun: '16.789.012-1'
    };

    const palBytes = await generarExcelConsolidadoPalDEP(
      [escuelaA],
      [titularActivo, vacanteCondicional],
      [],
      [cursoA1],
      []
    );
    const wbPal = new ExcelJS.Workbook();
    await wbPal.xlsx.load(palBytes as any);
    const wsDocPal = wbPal.getWorksheet('Info Funcionario (DOCENTE)')!;
    const rutsPal: string[] = [];
    wsDocPal.eachRow((row, rowNumber) => {
      if (rowNumber >= 3) {
        const val = String(row.getCell(1).value || '').trim();
        if (val) rutsPal.push(val);
      }
    });
    expect(rutsPal).toEqual(['16.789.012-1']);

    const gdpBytes = await generarExcelGdpColegio(
      escuelaA,
      [titularActivo, vacanteCondicional],
      [],
      [cursoA1],
      []
    );
    const wbGdp = new ExcelJS.Workbook();
    await wbGdp.xlsx.load(gdpBytes as any);
    const wsCttaGdp = wbGdp.getWorksheet('Subv. Normal - Docentes Ctta.')!;
    const nombresCtta: string[] = [];
    wsCttaGdp.eachRow((row, rowNumber) => {
      if (rowNumber >= 10) {
        const val = String(row.getCell('C').value || '').trim();
        if (val) nombresCtta.push(val);
      }
    });
    expect(nombresCtta.some(n => n.includes('VACANTE CONDICIONAL'))).toBe(false);
  }, 15000);

  it('7. detectarDocentesHorasRemanentes y generarSugerenciasCalceAutomatico operan en minutos enteros y respetan flags', async () => {
    const docConRemanente: Docente = {
      id: 'doc_rem_1',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '10.005.711-5',
      nombres: 'MARIO',
      apellidos: 'SOTO',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      asignaturaPrincipal: 'Matemática'
    };
    const vacDest: Docente = {
      id: 'vac_dest_auto',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-9090`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'MATEMATICA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralContrata: 44,
      asignaturaPrincipal: 'Matemática',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };

    await guardarDocente(docConRemanente);
    await guardarDocente(vacDest);
    await guardarAsignacion({
      id: 'asig_rem_1',
      rbd: RBD_A,
      periodo: PERIODO,
      cursoId: cursoA1.id,
      docenteId: docConRemanente.id,
      asignatura: 'Matemática',
      horasPedagogicasAula: 20
    });

    const remanentes = await detectarDocentesHorasRemanentes(PERIODO, 'asesor_uatp');
    expect(remanentes.length).toBe(1);
    expect(remanentes[0].docente.id).toBe(docConRemanente.id);
    // 44h en 65/35 = 38 HA máx; 20 HA asignadas => 18 HA remanentes
    expect(remanentes[0].horasLectivasMax).toBe(38);
    expect(remanentes[0].horasAsignadas).toBe(20);
    expect(remanentes[0].horasRemanentes).toBe(18);

    await guardarSolicitudMovilidad(
      {
        periodo: PERIODO,
        carril: 'NO_CONTINUIDAD_TITULAR',
        docenteId: docConRemanente.id,
        runDocente: docConRemanente.run,
        nombreDocente: 'MARIO SOTO',
        rbdOrigen: RBD_A,
        comunaOrigen: 'Bulnes',
        calidadJuridica: 'TITULAR',
        horasContratoActual: 44,
        horasTitularesActuales: 44,
        horasDisponiblesMover: 44,
        horasRemanentes: 18,
        asignaturaPrincipal: 'Matemática',
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'POSTULADO',
        puntajeSalud: 0,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 40
      },
      'asesor_uatp'
    );

    const escenario = await crearEscenarioCalce(
      { periodo: PERIODO, nombre: 'Simulador Auto' },
      'asesor_uatp'
    );

    actualizarFeatureFlagsMovilidad({ flag_simulador_calce_automatico: false }, 'admin');
    await expect(
      generarSugerenciasCalceAutomatico(escenario.id, PERIODO, 'asesor_uatp')
    ).rejects.toThrow(/flag_simulador_calce_automatico/);

    actualizarFeatureFlagsMovilidad({ flag_simulador_calce_automatico: true }, 'admin');
    const sugerencias = await generarSugerenciasCalceAutomatico(escenario.id, PERIODO, 'asesor_uatp');
    expect(sugerencias.length).toBe(1);
    expect(sugerencias[0].docenteOrigenId).toBe(docConRemanente.id);
    expect(sugerencias[0].vacanteDestinoId).toBe(vacDest.id);
    expect(sugerencias[0].bloqueaConsolidacion).toBe(false);
  });
});
