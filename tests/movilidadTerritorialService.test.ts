import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import {
  getDb,
  guardarEstablecimiento,
  guardarCurso,
  guardarDocente,
  guardarAsistente,
  guardarAsignacion,
  listarDocentes,
  listarAsistentes,
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
  reincorporarTitularContingencia,
  listarSolicitudesMovilidad,
  guardarSolicitudMovilidad,
  avanzarEstadoFlujoMovilidad,
  detectarDocentesHorasRemanentes,
  detectarAsistentesIndefinidosNoContinuidad,
  calcularProyeccionTechoPisoHoras,
  listarEscenariosCalce,
  crearEscenarioCalce,
  duplicarEscenarioCalce,
  listarPropuestasEscenario,
  agregarPropuestaCalce,
  resolverRebotePropuestaCalce,
  generarSugerenciasCalceAutomatico,
  consolidarEscenarioAprobado,
  registrarResolucionExentaEscenario,
  exportarNominaActosAdministrativosGdp
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
import { AsistenteEducacion, CursoSae, Docente, Establecimiento } from '../src/types';

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
    expect(propuesta.estadoResolucionRebote).toBe('PENDIENTE');
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

    // Debe bloquear consolidación mientras el NN-Rebote siga en estado PENDIENTE
    await expect(
      consolidarEscenarioAprobado({
        escenarioId: escenario.id,
        rolActor: 'subdirector_uatp',
        usuarioActor: 'Subdirector UATP'
      })
    ).rejects.toThrow(/PENDIENTE/);

    // Cierre explícito del NN-Rebote
    const propResuelta = await resolverRebotePropuestaCalce({
      propuestaId: propuesta.id,
      estadoResolucion: 'DERIVADA_A_CONCURSO_GDP',
      rolActor: 'asesor_uatp'
    });
    expect(propResuelta.estadoResolucionRebote).toBe('DERIVADA_A_CONCURSO_GDP');

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
    expect(resCons.modoEjecucion).toBe('SQLITE_LOCAL');
    expect(resCons.nuevaVersion).toBeGreaterThanOrEqual(2);

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

  it('8. Colisión de vacanteDestinoId, colisión de docenteOrigenId en traslado completo y acumulación parcial > 2640 min en agregarPropuestaCalce()', async () => {
    const doc1: Docente = {
      id: 'doc_col_1',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '15.432.109-8',
      nombres: 'ANDREA',
      apellidos: 'PEREZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Lenguaje'
    };
    const doc2: Docente = {
      id: 'doc_col_2',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '11.222.333-9',
      nombres: 'CARLOS',
      apellidos: 'LAGOS',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Lenguaje'
    };
    const docParcial: Docente = {
      id: 'doc_col_parcial',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '13.444.555-6',
      nombres: 'SOFIA',
      apellidos: 'ARAYA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 20,
      horasSubvencionGeneralContrata: 20,
      asignaturaPrincipal: 'Matemática'
    };

    const vacB1: Docente = {
      id: 'vac_col_b1',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-1001`,
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
    const vacB2: Docente = {
      id: 'vac_col_b2',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-1002`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'LENGUAJE 2',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      asignaturaPrincipal: 'Lenguaje',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };
    const vacParcial1: Docente = {
      id: 'vac_col_p1',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-1003`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'MATEMATICA 1',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 16,
      horasSubvencionGeneralContrata: 16,
      asignaturaPrincipal: 'Matemática',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };
    const vacParcial2: Docente = {
      id: 'vac_col_p2',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-1004`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'MATEMATICA 2',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 14,
      horasSubvencionGeneralContrata: 14,
      asignaturaPrincipal: 'Matemática',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };

    await guardarDocente(doc1);
    await guardarDocente(doc2);
    await guardarDocente(docParcial);
    await guardarDocente(vacB1);
    await guardarDocente(vacB2);
    await guardarDocente(vacParcial1);
    await guardarDocente(vacParcial2);

    const esc = await crearEscenarioCalce({ periodo: PERIODO, nombre: 'Escenario Colisiones' }, 'asesor_uatp');

    // 8A: Colisión de vacanteDestinoId
    await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: doc1.id,
        vacanteDestinoId: vacB1.id,
        esTrasladoCompleto: true
      },
      'asesor_uatp'
    );

    await expect(
      agregarPropuestaCalce(
        {
          escenarioId: esc.id,
          periodo: PERIODO,
          docenteOrigenId: doc2.id,
          vacanteDestinoId: vacB1.id,
          esTrasladoCompleto: true
        },
        'asesor_uatp'
      )
    ).rejects.toThrow(/Colisión de vacante/i);

    // 8B: Colisión de docenteOrigenId en traslado completo
    await expect(
      agregarPropuestaCalce(
        {
          escenarioId: esc.id,
          periodo: PERIODO,
          docenteOrigenId: doc1.id,
          vacanteDestinoId: vacB2.id,
          esTrasladoCompleto: true
        },
        'asesor_uatp'
      )
    ).rejects.toThrow(/Colisión de docente/i);

    // 8C: Acumulación parcial (20h conservadas + 16h = 2160 min OK; luego + 14h = 3000 min > 2640 min)
    const propParcial1 = await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: docParcial.id,
        vacanteDestinoId: vacParcial1.id,
        esTrasladoCompleto: false
      },
      'asesor_uatp'
    );
    expect(propParcial1.bloqueaConsolidacion).toBe(false);
    expect(propParcial1.minutosAsignados).toBe(960);

    await expect(
      agregarPropuestaCalce(
        {
          escenarioId: esc.id,
          periodo: PERIODO,
          docenteOrigenId: docParcial.id,
          vacanteDestinoId: vacParcial2.id,
          esTrasladoCompleto: false
        },
        'asesor_uatp'
      )
    ).rejects.toThrow(/2640|Colisión de jornada/i);
  });

  it('9. Candado de máquina de estados en consolidarEscenarioAprobado() cuando TRASLADO_VOLUNTARIO sigue en POSTULADO', async () => {
    const docOrigen: Docente = {
      id: 'doc_estado_1',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '17.654.321-3',
      nombres: 'PAULA',
      apellidos: 'DIAZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Historia'
    };
    const vacDest: Docente = {
      id: 'vac_estado_1',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-2001`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'HISTORIA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      asignaturaPrincipal: 'Historia',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };

    await guardarDocente(docOrigen);
    await guardarDocente(vacDest);

    const sol = await guardarSolicitudMovilidad(
      {
        periodo: PERIODO,
        carril: 'TRASLADO_VOLUNTARIO',
        docenteId: docOrigen.id,
        runDocente: docOrigen.run,
        nombreDocente: 'PAULA DIAZ',
        rbdOrigen: RBD_A,
        calidadJuridica: 'TITULAR',
        horasContratoActual: 30,
        horasTitularesActuales: 30,
        horasDisponiblesMover: 30,
        horasRemanentes: 0,
        asignaturaPrincipal: 'Historia',
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'POSTULADO',
        puntajeSalud: 20,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 40
      },
      'asesor_uatp'
    );

    const esc = await crearEscenarioCalce({ periodo: PERIODO, nombre: 'Candado Estados' }, 'asesor_uatp');
    const prop = await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: docOrigen.id,
        vacanteDestinoId: vacDest.id,
        solicitudMovilidadId: sol.id,
        esTrasladoCompleto: true
      },
      'asesor_uatp'
    );
    await resolverRebotePropuestaCalce({
      propuestaId: prop.id,
      estadoResolucion: 'DERIVADA_A_CONCURSO_GDP',
      rolActor: 'asesor_uatp'
    });

    await expect(
      consolidarEscenarioAprobado({
        escenarioId: esc.id,
        rolActor: 'super_usuario',
        usuarioActor: 'Super Usuario'
      })
    ).rejects.toThrow(/ACEPTADO_CON_FIRMA/);
  });

  it('10. Preservación de desglose mixto (30h Titular + 14h Contrata) al consolidar en vacante 44h', async () => {
    const docMixto: Docente = {
      id: 'doc_mixto_44',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '18.234.567-9',
      nombres: 'JORGE',
      apellidos: 'FUENTES',
      titulo: 'Profesor de Matemática',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 30,
      horasSubvencionGeneralContrata: 0,
      horasSepTitular: 0,
      horasSepContrata: 14,
      asignaturaPrincipal: 'Matemática'
    };
    const vac44: Docente = {
      id: 'vac_mixto_dest_44',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-3001`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'MATEMATICA 44H',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralContrata: 44,
      asignaturaPrincipal: 'Matemática',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };

    await guardarDocente(docMixto);
    await guardarDocente(vac44);

    const sol = await guardarSolicitudMovilidad(
      {
        periodo: PERIODO,
        carril: 'NO_CONTINUIDAD_TITULAR',
        docenteId: docMixto.id,
        runDocente: docMixto.run,
        nombreDocente: 'JORGE FUENTES',
        rbdOrigen: RBD_A,
        calidadJuridica: 'TITULAR',
        horasContratoActual: 44,
        horasTitularesActuales: 30,
        horasContrataActuales: 14,
        horasDisponiblesMover: 44,
        horasRemanentes: 0,
        asignaturaPrincipal: 'Matemática',
        fuenteActual: 'MIXTO',
        estadoFlujo: 'POSTULADO',
        puntajeSalud: 0,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 50
      },
      'asesor_uatp'
    );
    await avanzarEstadoFlujoMovilidad(sol.id, 'PRE_ASIGNADO', 'asesor_uatp');
    await avanzarEstadoFlujoMovilidad(sol.id, 'NOTIFICADO_DIRECCION_ORIGEN', 'asesor_uatp');

    const esc = await crearEscenarioCalce({ periodo: PERIODO, nombre: 'Mixto 30+14' }, 'asesor_uatp');
    const prop = await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: docMixto.id,
        vacanteDestinoId: vac44.id,
        solicitudMovilidadId: sol.id,
        esTrasladoCompleto: true
      },
      'asesor_uatp'
    );

    expect(prop.minutosTitularesOrigen).toBe(1800);
    expect(prop.minutosContrataOrigen).toBe(840);
    expect(prop.bloqueaConsolidacion).toBe(false);

    await resolverRebotePropuestaCalce({
      propuestaId: prop.id,
      estadoResolucion: 'DERIVADA_A_CONCURSO_GDP',
      rolActor: 'asesor_uatp'
    });

    const cons = await consolidarEscenarioAprobado({
      escenarioId: esc.id,
      rolActor: 'subdirector_uatp',
      usuarioActor: 'Subdirector UATP'
    });
    expect(cons.vacantesReemplazadas).toBe(1);

    const docsDest = await listarDocentes(RBD_B, PERIODO);
    const jorgeDest = docsDest.find(d => d.id === vac44.id)!;
    expect(jorgeDest).toBeDefined();
    expect(jorgeDest.calidadJuridica).toBe('TITULAR');
    expect(jorgeDest.horasSubvencionGeneralTitular).toBe(30);
    expect(jorgeDest.horasSubvencionGeneralContrata).toBe(14);
    expect(jorgeDest.horasSepTitular).toBe(0);
    expect(jorgeDest.horasSepContrata).toBe(0);
  });

  it('11. Conflicto optimista de versión (expectedVersion obsoleto lanza CONFLICTO_VERSION)', async () => {
    const doc1: Docente = {
      id: 'doc_ver_1',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '15.123.456-9',
      nombres: 'ELENA',
      apellidos: 'ROJAS',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Lenguaje'
    };
    const vac1: Docente = {
      id: 'vac_ver_1',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-4001`,
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
    const vac2: Docente = {
      ...vac1,
      id: 'vac_ver_2',
      run: `VAC-${RBD_B}-4002`
    };
    await guardarDocente(doc1);
    await guardarDocente(vac1);
    await guardarDocente(vac2);

    const esc = await crearEscenarioCalce({ periodo: PERIODO, nombre: 'Control Optimista' }, 'asesor_uatp');
    expect(esc.version).toBe(1);

    // Agregar propuesta con expectedVersion: 1 -> sube a v2
    const prop = await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: doc1.id,
        vacanteDestinoId: vac1.id,
        expectedVersion: 1
      },
      'asesor_uatp'
    );

    // Intentar agregar otra propuesta con expectedVersion obsoleto (1) -> CONFLICTO_VERSION
    await expect(
      agregarPropuestaCalce(
        {
          escenarioId: esc.id,
          periodo: PERIODO,
          docenteOrigenId: doc1.id,
          vacanteDestinoId: vac2.id,
          expectedVersion: 1
        },
        'asesor_uatp'
      )
    ).rejects.toThrow(/CONFLICTO_VERSION/);

    // Intentar resolver rebote con expectedVersion obsoleto (1) -> CONFLICTO_VERSION
    await expect(
      resolverRebotePropuestaCalce({
        propuestaId: prop.id,
        estadoResolucion: 'DERIVADA_A_CONCURSO_GDP',
        rolActor: 'asesor_uatp',
        expectedVersion: 1
      })
    ).rejects.toThrow(/CONFLICTO_VERSION/);

    await resolverRebotePropuestaCalce({
      propuestaId: prop.id,
      estadoResolucion: 'DERIVADA_A_CONCURSO_GDP',
      rolActor: 'asesor_uatp',
      expectedVersion: 2
    });

    // Consolidar con expectedVersion obsoleto (2, ya está en 3) -> CONFLICTO_VERSION
    await expect(
      consolidarEscenarioAprobado({
        escenarioId: esc.id,
        rolActor: 'super_usuario',
        usuarioActor: 'Super Usuario',
        expectedVersion: 2
      })
    ).rejects.toThrow(/CONFLICTO_VERSION/);
  });

  it('12. Reverso Controlado (reincorporarTitularContingencia) restituye titular + asignaciones_horarias y archiva cobertura condicional', async () => {
    const titular: Docente = {
      id: 'doc_rev_tit',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '15.123.450-K',
      nombres: 'MATIAS',
      apellidos: 'GONZALEZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Matemática',
      propuestaGdp: 'Egreso proyectado',
      situacionFinalGdp: 'Cese'
    };
    await guardarDocente(titular);

    const resEgr = await guardarEgresoProyectado(
      {
        rbd: RBD_A,
        periodo: PERIODO,
        docenteId: titular.id,
        runDocente: titular.run,
        nombreDocente: 'MATIAS GONZALEZ',
        asignaturaPrincipal: 'Matemática',
        horasLiberadas: 30,
        horasAulaLiberadas: 22,
        fuenteFinanciamiento: 'SUBVENCION_GENERAL',
        calidadJuridica: 'TITULAR',
        causal: 'salud_incompatible_180d',
        certeza: 'en_tramite',
        excepcionJubilacion3Anios: false,
        impactoPresupuestario: 'con_recuperacion_sil'
      },
      'gdp_validador',
      true
    );
    const vacCond = resEgr.vacanteGenerada!;
    expect(vacCond).toBeDefined();

    // Asignación temporalmente apuntada a la vacante condicional
    await guardarAsignacion({
      id: 'asig_rev_1',
      rbd: RBD_A,
      periodo: PERIODO,
      cursoId: cursoA1.id,
      docenteId: vacCond.id,
      asignatura: 'Matemática',
      horasPedagogicasAula: 10
    });

    // Asesor UATP no puede revertir (solo validador GDP o superior)
    await expect(
      reincorporarTitularContingencia({
        egresoId: resEgr.egreso.id,
        motivo: 'Alta médica COMPIN',
        rolActor: 'asesor_uatp'
      })
    ).rejects.toThrow(/Acceso denegado/);

    const revRes = await reincorporarTitularContingencia({
      egresoId: resEgr.egreso.id,
      motivo: 'Resolución COMPIN favorable: docente se reincorpora a sus funciones titulares',
      rolActor: 'gdp_validador',
      usuarioActor: 'Validador GDP'
    });

    expect(revRes.egreso.estadoReversion).toBe('REVERTIDO_REINCORPORADO');
    expect(revRes.egreso.motivoReversion).toContain('COMPIN');
    expect(revRes.asignacionesReapuntadas).toBe(1);
    expect(revRes.docenteTitularRestituido?.situacionFinalGdp).toBe('Vigente');
    expect(revRes.docenteTitularRestituido?.propuestaGdp).toBe('Continuidad');

    const docsPost = await listarDocentes(RBD_A, PERIODO);
    const vacArchivada = docsPost.find(d => d.id === vacCond.id)!;
    expect(vacArchivada.esVacanteNn).toBe(false);
    expect(vacArchivada.vacanteCondicional).toBe(false);
    expect(vacArchivada.propuestaGdp).toBe('Archivado por Reincorporación Titular');
    expect(vacArchivada.situacionFinalGdp).toBe('Cese');

    const asigsPost = await listarAsignaciones(RBD_A, PERIODO);
    expect(asigsPost[0].docenteId).toBe(titular.id);

    const aud = await listarEventosAuditoria(RBD_A, PERIODO);
    expect(aud.some(e => e.descripcion.includes('Reverso controlado'))).toBe(true);
  });

  it('13. registrarResolucionExentaEscenario (RESOLUCION_EMITIDA) y exportación ExcelJS de Actos GDP', async () => {
    const docOrig: Docente = {
      id: 'doc_res_1',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '16.789.012-1',
      nombres: 'MARCELA',
      apellidos: 'SILVA',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Ciencias Naturales'
    };
    const vacDest: Docente = {
      id: 'vac_res_1',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-5001`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'CIENCIAS NATURALES',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      asignaturaPrincipal: 'Ciencias Naturales',
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };
    await guardarDocente(docOrig);
    await guardarDocente(vacDest);

    const sol = await guardarSolicitudMovilidad(
      {
        periodo: PERIODO,
        carril: 'TRASLADO_VOLUNTARIO',
        docenteId: docOrig.id,
        runDocente: docOrig.run,
        nombreDocente: 'MARCELA SILVA',
        rbdOrigen: RBD_A,
        calidadJuridica: 'TITULAR',
        horasContratoActual: 30,
        horasTitularesActuales: 30,
        horasDisponiblesMover: 30,
        horasRemanentes: 0,
        asignaturaPrincipal: 'Ciencias Naturales',
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'POSTULADO',
        puntajeSalud: 50,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 40
      },
      'asesor_uatp'
    );
    await avanzarEstadoFlujoMovilidad(sol.id, 'PRE_ASIGNADO', 'asesor_uatp');
    await avanzarEstadoFlujoMovilidad(sol.id, 'NOTIFICADO_DIRECCION_ORIGEN', 'asesor_uatp');
    await avanzarEstadoFlujoMovilidad(sol.id, 'ACEPTADO_CON_FIRMA', 'asesor_uatp');

    const esc = await crearEscenarioCalce({ periodo: PERIODO, nombre: 'Escenario Acto GDP' }, 'asesor_uatp');
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
    await resolverRebotePropuestaCalce({
      propuestaId: prop.id,
      estadoResolucion: 'DERIVADA_A_CONCURSO_GDP',
      rolActor: 'asesor_uatp'
    });

    await consolidarEscenarioAprobado({
      escenarioId: esc.id,
      rolActor: 'subdirector_uatp',
      usuarioActor: 'Subdirector UATP'
    });

    // Asesor UATP no puede registrar resolución exenta
    await expect(
      registrarResolucionExentaEscenario({
        escenarioId: esc.id,
        numeroResolucion: 'RES-EX-1024/2027',
        fechaResolucion: '2027-02-15',
        rolActor: 'asesor_uatp'
      })
    ).rejects.toThrow(/Acceso denegado/);

    const resEx = await registrarResolucionExentaEscenario({
      escenarioId: esc.id,
      numeroResolucion: 'RES-EX-1024/2027',
      fechaResolucion: '2027-02-15',
      fechaVigencia: '2027-03-01',
      rolActor: 'gdp_validador',
      usuarioActor: 'Validador GDP'
    });

    expect(resEx.escenario.estado).toBe('RESOLUCION_EMITIDA');
    expect(resEx.escenario.numeroResolucion).toBe('RES-EX-1024/2027');
    expect(resEx.escenario.fechaVigencia).toBe('2027-03-01');
    expect(resEx.propuestasActualizadas).toBe(1);
    expect(resEx.solicitudesActualizadas).toBe(1);

    const propsPost = await listarPropuestasEscenario(esc.id, 'asesor_uatp');
    expect(propsPost[0].estado).toBe('CONSOLIDADA');
    expect(propsPost[0].numeroResolucion).toBe('RES-EX-1024/2027');

    const solsPost = await listarSolicitudesMovilidad(PERIODO, 'asesor_uatp');
    expect(solsPost[0].estadoFlujo).toBe('RESOLUCION_EMITIDA');
    expect(solsPost[0].numeroResolucion).toBe('RES-EX-1024/2027');

    // Validar exportación ExcelJS
    const xlsxBytes = await exportarNominaActosAdministrativosGdp({
      escenarioId: esc.id,
      periodo: PERIODO,
      rolActor: 'asesor_uatp'
    });
    expect(xlsxBytes.byteLength).toBeGreaterThan(0);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(xlsxBytes as any);
    const wsActos = wb.getWorksheet('Actos Destinación y Traslado');
    const wsRebotes = wb.getWorksheet('Rebotes y Concursos GDP');
    expect(wsActos).toBeDefined();
    expect(wsRebotes).toBeDefined();

    const filaActo = wsActos!.getRow(2);
    const textoFilaActo = filaActo.values ? JSON.stringify(filaActo.values) : '';
    expect(textoFilaActo).toContain('RES-EX-1024/2027');
    expect(textoFilaActo).toContain('MARCELA SILVA');

    const filaRebote = wsRebotes!.getRow(2);
    const textoFilaRebote = filaRebote.values ? JSON.stringify(filaRebote.values) : '';
    expect(textoFilaRebote).toContain('DERIVADA_A_CONCURSO_GDP');
    expect(textoFilaRebote).toContain(RBD_A);
  });

  it('14. detectarAsistentesIndefinidosNoContinuidad (Ley 21.109) y calcularProyeccionTechoPisoHoras (techo > piso con egreso condicional)', async () => {
    const astIndefNc: AsistenteEducacion = {
      id: 'ast_indef_nc',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '15.432.109-8',
      nombres: 'CARLA',
      apellidos: 'MUÑOZ',
      cargoFuncion: 'Técnico en Párvulos',
      estamento: 'TECNICO',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 30,
      horasSubvencionGeneralPlazoFijo: 14,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      activo: true,
      propuestaGdp: 'No continuidad por ajuste dotación',
      observacionesDirector: 'Fusión de nivel NT1'
    };
    const astPlazoFijoNc: AsistenteEducacion = {
      id: 'ast_pf_nc',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '12.345.678-5',
      nombres: 'LUIS',
      apellidos: 'TAPIA',
      cargoFuncion: 'Auxiliar de Servicios',
      estamento: 'AUXILIAR',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 0,
      horasSubvencionGeneralPlazoFijo: 44,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      activo: true,
      propuestaGdp: 'No continuidad'
    };
    const astIndefCont: AsistenteEducacion = {
      id: 'ast_indef_cont',
      rbd: RBD_B,
      periodo: PERIODO,
      run: '10.005.711-5',
      nombres: 'ROSA',
      apellidos: 'VEGA',
      cargoFuncion: 'Psicóloga',
      estamento: 'PROFESIONAL',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 44,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      activo: true,
      propuestaGdp: 'Continuidad'
    };

    await guardarAsistente(astIndefNc);
    await guardarAsistente(astPlazoFijoNc);
    await guardarAsistente(astIndefCont);

    const asistentesNc = await detectarAsistentesIndefinidosNoContinuidad(PERIODO, 'asesor_uatp');
    expect(asistentesNc.length).toBe(1);
    expect(asistentesNc[0].asistente.id).toBe(astIndefNc.id);
    expect(asistentesNc[0].horasIndefinidas).toBe(30);
    expect(asistentesNc[0].horasPlazoFijo).toBe(14);
    expect(asistentesNc[0].razonGdp).toContain('Fusión de nivel NT1');

    // Proyección Techo vs Piso con docente titular con egreso en_tramite y vacante condicional
    const docTitular1: Docente = {
      id: 'doc_tp_1',
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
    const docTitular2: Docente = {
      id: 'doc_tp_2',
      rbd: RBD_A,
      periodo: PERIODO,
      run: '14.555.666-K',
      nombres: 'MARTA',
      apellidos: 'RIVAS',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 44,
      horasSubvencionGeneralTitular: 44,
      situacionFinalGdp: 'Vigente'
    };
    const vacConfirmada: Docente = {
      id: 'vac_tp_conf',
      rbd: RBD_B,
      periodo: PERIODO,
      run: `VAC-${RBD_B}-8001`,
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'INGLES',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 22,
      horasSubvencionGeneralContrata: 22,
      esVacanteNn: true,
      tipoVacante: 'NECESIDAD_ESCUELA',
      vacanteCondicional: false
    };

    await guardarDocente(docTitular1);
    await guardarDocente(docTitular2);
    await guardarDocente(vacConfirmada);

    await guardarEgresoProyectado(
      {
        rbd: RBD_A,
        periodo: PERIODO,
        docenteId: docTitular1.id,
        runDocente: docTitular1.run,
        nombreDocente: 'ROBERTO SILVA',
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

    const proy = await calcularProyeccionTechoPisoHoras(PERIODO, 'asesor_uatp');
    expect(proy.periodo).toBe(PERIODO);
    expect(proy.horasContratadasActivas).toBe(74);
    expect(proy.horasVacantesConfirmadasSinTitular).toBe(22);
    expect(proy.horasVacantesCondicionales).toBe(30);
    expect(proy.horasPisoSiEgresanCondicionales).toBe(96);
    expect(proy.horasTechoAntes1Marzo).toBe(126);
    expect(proy.horasTechoAntes1Marzo).toBeGreaterThan(proy.horasPisoSiEgresanCondicionales);
    expect(proy.detallePorRbd.length).toBe(2);
    const detA = proy.detallePorRbd.find(d => d.rbd === RBD_A)!;
    expect(detA.horasTechoAntes1Marzo).toBeGreaterThan(detA.horasPisoSiEgresanCondicionales);
  });
});
