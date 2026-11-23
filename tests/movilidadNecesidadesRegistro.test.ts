import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDb,
  guardarAsistente,
  guardarEstablecimiento,
  guardarDocente,
  listarAsistentes,
  reiniciarTodaLaBaseDatos
} from '../src/database/db';
import {
  crearNecesidadVacanteEscuela,
  crearNecesidadVacanteAsistente,
  listarNecesidadesVacanteEscuela,
  listarNecesidadesVacanteAsistente,
  actualizarNecesidadVacanteEscuela,
  actualizarNecesidadVacanteAsistente,
  enviarNecesidadAMovilidad,
  enviarNecesidadAsistenteAMovilidad,
  retrotraerNecesidadDeMovilidad,
  cancelarNecesidadVacanteEscuela,
  esVacanteActivaEnMovilidad,
  esVacanteAsistenteActivaEnMovilidad,
  esVacanteCargoDocente,
  listarRegistroMovimientosMovilidad,
  crearEscenarioCalce,
  agregarPropuestaCalce,
  consolidarEscenarioAprobado,
  revertirEscenarioConsolidado
} from '../src/services/movilidadTerritorialService';
import { AsistenteEducacion, Docente, Establecimiento } from '../src/types';

const PERIODO = 2027;
const RBD_A = '88401';
const RBD_B = '88402';

const escuelaA: Establecimiento = {
  id: `est_${RBD_A}`,
  rbd: RBD_A,
  nombre: 'ESCUELA PILOTO NECESIDADES',
  comuna: 'Bulnes',
  regimen: 'JEC',
  porcentajePrioritarios: 70,
  tipoPerfil: 'BASICA',
  modalidadesAutorizadas: ['BASICA']
};

const escuelaB: Establecimiento = {
  id: `est_${RBD_B}`,
  rbd: RBD_B,
  nombre: 'LICEO DESTINO MOVILIDAD',
  comuna: 'Quillón',
  regimen: 'JEC',
  porcentajePrioritarios: 65,
  tipoPerfil: 'LICEO_HC',
  modalidadesAutorizadas: ['MEDIA']
};

describe('Ciclo de Vida de Necesidades Docentes y Registro de Movimientos', () => {
  beforeEach(async () => {
    await getDb();
    await reiniciarTodaLaBaseDatos();
    await guardarEstablecimiento(escuelaA);
    await guardarEstablecimiento(escuelaB);
  });

  it('1. Crea necesidad en BORRADOR (no visible en Movilidad), permite editar y luego enviar a Movilidad', async () => {
    const creada = await crearNecesidadVacanteEscuela({
      rbd: RBD_A,
      periodo: PERIODO,
      especialidad: 'Matemática',
      estamento: 'DOCENTE_AULA',
      horasContrato: 20,
      fuenteFinanciamiento: 'SUBVENCION_GENERAL',
      justificacion: 'Cobertura inicial 7° y 8°',
      usuarioActor: 'director.bulnes@slep.cl',
      rolActor: 'director_establecimiento'
    });

    expect(creada.estadoNecesidad).toBe('BORRADOR');
    expect(esVacanteActivaEnMovilidad(creada)).toBe(false);

    const editada = await actualizarNecesidadVacanteEscuela({
      id: creada.id,
      rbd: RBD_A,
      periodo: PERIODO,
      especialidad: 'Matemática',
      estamento: 'DOCENTE_AULA',
      horasContrato: 24,
      fuenteFinanciamiento: 'SEP',
      justificacion: 'Ajuste de horas por plan de mejora SEP',
      usuarioActor: 'director.bulnes@slep.cl',
      rolActor: 'director_establecimiento'
    });

    expect(editada.horasContrato).toBe(24);
    expect(editada.horasSepContrata).toBe(24);
    expect(editada.estadoNecesidad).toBe('BORRADOR');

    const enviada = await enviarNecesidadAMovilidad({
      id: creada.id,
      rbd: RBD_A,
      periodo: PERIODO,
      usuarioActor: 'director.bulnes@slep.cl',
      rolActor: 'director_establecimiento'
    });

    expect(enviada.estadoNecesidad).toBe('ENVIADA');
    expect(esVacanteActivaEnMovilidad(enviada)).toBe(true);

    const lista = await listarNecesidadesVacanteEscuela(RBD_A, PERIODO);
    expect(lista).toHaveLength(1);
    expect(lista[0].estadoNecesidad).toBe('ENVIADA');
  });

  it('2. Permite retrotraer a BORRADOR y cancelar, registrando quién, dónde, cuándo y motivo', async () => {
    const creada = await crearNecesidadVacanteEscuela({
      rbd: RBD_A,
      periodo: PERIODO,
      especialidad: 'Inglés',
      estamento: 'DOCENTE_AULA',
      horasContrato: 18,
      fuenteFinanciamiento: 'SUBVENCION_GENERAL',
      justificacion: 'Horas segundo ciclo',
      usuarioActor: 'utp.bulnes@slep.cl',
      rolActor: 'jefe_utp_establecimiento',
      estadoInicial: 'ENVIADA'
    });

    expect(esVacanteActivaEnMovilidad(creada)).toBe(true);

    // No se puede editar mientras está ENVIADA
    await expect(
      actualizarNecesidadVacanteEscuela({
        id: creada.id,
        rbd: RBD_A,
        periodo: PERIODO,
        especialidad: 'Inglés',
        estamento: 'DOCENTE_AULA',
        horasContrato: 20,
        fuenteFinanciamiento: 'SUBVENCION_GENERAL',
        justificacion: 'Intento sin retrotraer',
        usuarioActor: 'utp.bulnes@slep.cl'
      })
    ).rejects.toThrow(/retrotraerla/i);

    const retrotraida = await retrotraerNecesidadDeMovilidad({
      id: creada.id,
      rbd: RBD_A,
      periodo: PERIODO,
      motivo: 'Error en cantidad de horas declaradas',
      usuarioActor: 'director.bulnes@slep.cl',
      rolActor: 'director_establecimiento'
    });

    expect(retrotraida.estadoNecesidad).toBe('BORRADOR');
    expect(esVacanteActivaEnMovilidad(retrotraida)).toBe(false);

    const cancelada = await cancelarNecesidadVacanteEscuela({
      id: creada.id,
      rbd: RBD_A,
      periodo: PERIODO,
      motivo: 'Cubierta con redistribución horaria interna',
      usuarioActor: 'director.bulnes@slep.cl',
      rolActor: 'director_establecimiento'
    });

    expect(cancelada.estadoNecesidad).toBe('CANCELADA');
    expect(cancelada.situacionFinalGdp).toBe('Cancelada');
    expect(esVacanteActivaEnMovilidad(cancelada)).toBe(false);

    const registro = await listarRegistroMovimientosMovilidad({ periodo: PERIODO, rbd: RBD_A });
    const tipos = registro.map(r => r.tipoMovimiento);
    expect(tipos).toContain('CREACION_NECESIDAD');
    expect(tipos).toContain('ENVIO_MOVILIDAD');
    expect(tipos).toContain('RETROCESO_NECESIDAD');
    expect(tipos).toContain('CANCELACION_NECESIDAD');

    const movRetro = registro.find(r => r.tipoMovimiento === 'RETROCESO_NECESIDAD');
    expect(movRetro?.usuarioActor).toBe('director.bulnes@slep.cl');
    expect(movRetro?.nombreEstablecimiento).toBe('ESCUELA PILOTO NECESIDADES');
    expect(movRetro?.comuna).toBe('Bulnes');
    expect(movRetro?.estadoAnterior).toBe('ENVIADA');
    expect(movRetro?.estadoNuevo).toBe('BORRADOR');
    expect(movRetro?.motivo).toBe('Error en cantidad de horas declaradas');
    expect(movRetro?.fechaHora).toBeTruthy();
  });

  it('3. Bloquea retroceso o cancelación si la vacante ya tiene una propuesta activa en la Mesa de Movilidad', async () => {
    const vacante = await crearNecesidadVacanteEscuela({
      rbd: RBD_A,
      periodo: PERIODO,
      especialidad: 'Lenguaje y Comunicación',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      fuenteFinanciamiento: 'SUBVENCION_GENERAL',
      justificacion: 'Cobertura enseñanza básica',
      usuarioActor: 'director.bulnes@slep.cl',
      estadoInicial: 'ENVIADA'
    });

    const docenteOrigen: Docente = {
      id: 'doc_origen_88402',
      rbd: RBD_B,
      periodo: PERIODO,
      run: '14.555.666-7',
      nombres: 'MARÍA',
      apellidos: 'PÉREZ SOTO',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      asignaturaPrincipal: 'Lenguaje y Comunicación',
      situacionFinalGdp: 'Vigente'
    };
    await guardarDocente(docenteOrigen);

    const escenario = await crearEscenarioCalce(
      {
        periodo: PERIODO,
        nombre: 'Escenario Bloqueo Retroceso',
        creadoPor: 'uatp@slep.cl'
      },
      'subdirector_uatp'
    );

    await agregarPropuestaCalce(
      {
        escenarioId: escenario.id,
        periodo: PERIODO,
        docenteOrigenId: docenteOrigen.id,
        rbdDestino: RBD_A,
        vacanteDestinoId: vacante.id,
        horasAsignadas: 30,
        fuenteDestino: 'SUBVENCION_GENERAL'
      },
      'subdirector_uatp'
    );

    await expect(
      retrotraerNecesidadDeMovilidad({
        id: vacante.id,
        rbd: RBD_A,
        periodo: PERIODO,
        motivo: 'Intento de retroceso con propuesta activa',
        usuarioActor: 'director.bulnes@slep.cl'
      })
    ).rejects.toThrow(/propuesta o adjudicación activa/i);

    await expect(
      cancelarNecesidadVacanteEscuela({
        id: vacante.id,
        rbd: RBD_A,
        periodo: PERIODO,
        motivo: 'Intento de cancelación con propuesta activa',
        usuarioActor: 'director.bulnes@slep.cl'
      })
    ).rejects.toThrow(/propuesta o adjudicación activa/i);
  });

  it('4. Crea y envía un Cargo Directivo/UTP (Inspector General 44h) sin horas aula', async () => {
    const cargo = await crearNecesidadVacanteEscuela({
      rbd: RBD_A,
      periodo: PERIODO,
      especialidad: 'Inspector General',
      estamento: 'DIRECTIVO',
      horasContrato: 44,
      fuenteFinanciamiento: 'SUBVENCION_GENERAL',
      justificacion: 'Vacante por jubilación titular Inspectoría General',
      usuarioActor: 'director.bulnes@slep.cl',
      tipoRequerimiento: 'CARGO_DOCENTE',
      tipoFuncionNoAula: 'INSPECTORIA'
    });

    expect(cargo.estadoNecesidad).toBe('BORRADOR');
    expect(esVacanteCargoDocente(cargo)).toBe(true);
    expect(cargo.cargoInstitucional).toBe('Inspector General');
    expect(cargo.horasInspectorGeneral).toBe(44);
    expect(esVacanteActivaEnMovilidad(cargo)).toBe(false);

    const enviada = await enviarNecesidadAMovilidad({
      id: cargo.id,
      rbd: RBD_A,
      periodo: PERIODO,
      usuarioActor: 'director.bulnes@slep.cl'
    });
    expect(esVacanteActivaEnMovilidad(enviada)).toBe(true);
  });

  it('5. Crea, edita, envía, calza, consolida y revierte un Cargo Asistente Ley 21.109 (Psicólogo SEP)', async () => {
    const vacAst = await crearNecesidadVacanteAsistente({
      rbd: RBD_A,
      periodo: PERIODO,
      cargoFuncion: 'Psicólogo/a (Dupla Psicosocial)',
      estamento: 'PROFESIONAL',
      horasContrato: 22,
      fuenteFinanciamiento: 'SEP',
      justificacion: 'Cobertura dupla psicosocial PME-SEP',
      usuarioActor: 'director.bulnes@slep.cl'
    });

    expect(vacAst.estadoNecesidad).toBe('BORRADOR');
    expect(vacAst.esDuplaPsicosocial).toBe(true);
    expect(esVacanteAsistenteActivaEnMovilidad(vacAst)).toBe(false);

    const editadaAst = await actualizarNecesidadVacanteAsistente({
      id: vacAst.id,
      rbd: RBD_A,
      periodo: PERIODO,
      cargoFuncion: 'Psicólogo/a (Dupla Psicosocial)',
      estamento: 'PROFESIONAL',
      horasContrato: 30,
      fuenteFinanciamiento: 'SEP',
      justificacion: 'Ampliación jornada dupla psicosocial SEP',
      usuarioActor: 'director.bulnes@slep.cl'
    });
    expect(editadaAst.horasContrato).toBe(30);

    const enviadaAst = await enviarNecesidadAsistenteAMovilidad({
      id: vacAst.id,
      rbd: RBD_A,
      periodo: PERIODO,
      usuarioActor: 'director.bulnes@slep.cl'
    });
    expect(esVacanteAsistenteActivaEnMovilidad(enviadaAst)).toBe(true);

    const listaAst = await listarNecesidadesVacanteAsistente(RBD_A, PERIODO);
    expect(listaAst).toHaveLength(1);

    const astOrigen: AsistenteEducacion = {
      id: 'ast_origen_88402',
      rbd: RBD_B,
      periodo: PERIODO,
      run: '16.222.333-4',
      nombres: 'CAMILA',
      apellidos: 'ROJAS VERA',
      cargoFuncion: 'Psicólogo/a',
      estamento: 'PROFESIONAL',
      horasContrato: 30,
      horasSubvencionGeneralIndefinido: 0,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 30,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      esDuplaPsicosocial: true,
      activo: true
    };
    await guardarAsistente(astOrigen);

    const esc = await crearEscenarioCalce(
      { periodo: PERIODO, nombre: 'Escenario Cargo Asistente' },
      'subdirector_uatp'
    );
    const prop = await agregarPropuestaCalce(
      {
        escenarioId: esc.id,
        periodo: PERIODO,
        docenteOrigenId: astOrigen.id,
        vacanteDestinoId: vacAst.id,
        estamentoPersonal: 'ASISTENTE',
        horasAsignadas: 30,
        fuenteDestino: 'SEP',
        estadoResolucionRebote: 'DERIVADA_A_CONCURSO_GDP'
      },
      'subdirector_uatp'
    );
    expect(prop.estamentoPersonal).toBe('ASISTENTE');
    expect(prop.bloqueaConsolidacion).toBe(false);

    await consolidarEscenarioAprobado({
      escenarioId: esc.id,
      periodo: PERIODO,
      rolActor: 'subdirector_uatp',
      usuarioActor: 'uatp@slep.cl',
      forzarSinPausa: true,
      forzarConPendientesNn: true
    });

    const astDestino = await listarAsistentes(RBD_A, PERIODO);
    const cubierto = astDestino.find(a => a.run === '16.222.333-4');
    expect(cubierto).toBeDefined();
    expect(cubierto?.esVacanteNn).toBe(false);
    expect(astDestino.some(a => a.run === vacAst.run)).toBe(false);

    await revertirEscenarioConsolidado({
      escenarioId: esc.id,
      periodo: PERIODO,
      motivo: 'Prueba reversión cargo asistente',
      rolActor: 'subdirector_uatp',
      usuarioActor: 'uatp@slep.cl'
    });

    const astDestinoPost = await listarAsistentes(RBD_A, PERIODO);
    expect(astDestinoPost.some(a => a.id === vacAst.id)).toBe(true);
    expect(astDestinoPost.some(a => a.run === '16.222.333-4')).toBe(false);
  });
});
