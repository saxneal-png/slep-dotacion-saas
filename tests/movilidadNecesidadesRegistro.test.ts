import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDb,
  guardarEstablecimiento,
  guardarDocente,
  reiniciarTodaLaBaseDatos
} from '../src/database/db';
import {
  crearNecesidadVacanteEscuela,
  listarNecesidadesVacanteEscuela,
  actualizarNecesidadVacanteEscuela,
  enviarNecesidadAMovilidad,
  retrotraerNecesidadDeMovilidad,
  cancelarNecesidadVacanteEscuela,
  esVacanteActivaEnMovilidad,
  listarRegistroMovimientosMovilidad,
  crearEscenarioCalce,
  agregarPropuestaCalce
} from '../src/services/movilidadTerritorialService';
import { Docente, Establecimiento } from '../src/types';

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
});
