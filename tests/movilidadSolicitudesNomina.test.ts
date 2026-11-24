import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDb,
  guardarDocente,
  guardarEstablecimiento,
  listarDocentes,
  reiniciarTodaLaBaseDatos
} from '../src/database/db';
import {
  actualizarSolicitudMovimientoEscuela,
  detectarYRegistrarSolicitudesDocente,
  listarSolicitudesMovimientoDotacion,
  retirarSolicitudMovimientoEscuela,
  sancionarSolicitudDotacion
} from '../src/services/solicitudesDotacionService';
import {
  guardarSolicitudTrasladoEscuela,
  listarSolicitudesTrasladoEscuela,
  retirarSolicitudTrasladoEscuela
} from '../src/services/movilidadTerritorialService';
import { Docente, Establecimiento } from '../src/types';

const PERIODO = 2027;
const RBD = '88501';

const escuela: Establecimiento = {
  id: `est_${RBD}`,
  rbd: RBD,
  nombre: 'LICEO PRUEBA SOLICITUDES',
  comuna: 'Chillán',
  regimen: 'JEC',
  porcentajePrioritarios: 68
};

describe('Solicitudes de Nómina (Horas, Art. 69 y Autorización Docente Dto. 352)', () => {
  beforeEach(async () => {
    await getDb();
    await reiniciarTodaLaBaseDatos();
    await guardarEstablecimiento(escuela);
  });

  it('1. Detecta AUMENTO_HORAS, ACOGIMIENTO_ART_69 y AUTORIZACION_DOCENTE_DTO_352 desde la ficha docente', async () => {
    const previo: Docente = {
      id: 'doc_sol_1',
      rbd: RBD,
      periodo: PERIODO,
      run: '15.111.222-3',
      nombres: 'JUAN',
      apellidos: 'GONZÁLEZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasVigentesAnterior: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Matemática',
      aplicaArticulo69: false,
      requiereAutorizacionDocente: false,
      propuestaGdp: 'Continuidad',
      situacionFinalGdp: 'Vigente'
    };
    await guardarDocente(previo);

    const nuevo: Docente = {
      ...previo,
      horasContrato: 36,
      horasSubvencionGeneralTitular: 36,
      propuestaGdp: 'Aumento Horas',
      aplicaArticulo69: true,
      requiereAutorizacionDocente: true,
      habilitacionSeremiRbd: RBD,
      habilitacionSeremiAsignatura: 'Física',
      observacionesDirector: 'Solicita Art. 69 y habilitación Dto. 352 en Física'
    };
    await guardarDocente(nuevo);

    const { solicitudesGeneradas: generadas } = await detectarYRegistrarSolicitudesDocente({
      previo,
      nuevo,
      establecimiento: escuela,
      usuarioActor: 'director@slep.cl',
      rolActor: 'director_establecimiento'
    });

    const tipos = generadas.map(s => s.tipoMovimiento);
    expect(tipos).toContain('ACOGIMIENTO_ART_69');
    expect(tipos).toContain('AUTORIZACION_DOCENTE_DTO_352');
    expect(tipos).toContain('AUMENTO_HORAS');

    const listadas = await listarSolicitudesMovimientoDotacion({ periodo: PERIODO, rbd: RBD });
    expect(listadas.length).toBeGreaterThanOrEqual(3);
  });

  it('2. Sanción GDP aprueba Art. 69 y al rechazar Autorización Docente Dto. 352 revierte requiereAutorizacionDocente', async () => {
    const previo: Docente = {
      id: 'doc_sol_2',
      rbd: RBD,
      periodo: PERIODO,
      run: '16.333.444-5',
      nombres: 'ANA',
      apellidos: 'MUÑOZ',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 24,
      horasVigentesAnterior: 24,
      horasSubvencionGeneralContrata: 24,
      asignaturaPrincipal: 'Química',
      aplicaArticulo69: false,
      requiereAutorizacionDocente: false,
      situacionFinalGdp: 'Vigente'
    };
    await guardarDocente(previo);

    const nuevo: Docente = {
      ...previo,
      aplicaArticulo69: true,
      requiereAutorizacionDocente: true
    };
    await guardarDocente(nuevo);

    const { solicitudesGeneradas: generadas } = await detectarYRegistrarSolicitudesDocente({
      previo,
      nuevo,
      establecimiento: escuela,
      usuarioActor: 'director@slep.cl',
      rolActor: 'director_establecimiento'
    });

    const solArt69 = generadas.find(s => s.tipoMovimiento === 'ACOGIMIENTO_ART_69')!;
    const solAut = generadas.find(s => s.tipoMovimiento === 'AUTORIZACION_DOCENTE_DTO_352')!;

    await sancionarSolicitudDotacion({
      id: solArt69.id,
      decision: 'APROBADO',
      observacionSancion: 'Cumple 30 años de servicio',
      usuarioActor: 'gdp@slep.cl',
      rolActor: 'gdp_validador'
    });

    await sancionarSolicitudDotacion({
      id: solAut.id,
      decision: 'RECHAZADO',
      observacionSancion: 'Falta resolución SEREMI vigente',
      usuarioActor: 'gdp@slep.cl',
      rolActor: 'gdp_validador'
    });

    const docs = await listarDocentes(RBD, PERIODO);
    const actualizado = docs.find(d => d.id === nuevo.id)!;
    expect(actualizado.aplicaArticulo69).toBe(true);
    expect(actualizado.requiereAutorizacionDocente).toBe(false);
    expect(actualizado.estadoSancionGdp).toBe('Rechazado');
  });

  it('3. Permite al establecimiento editar y retirar solicitudes de horas y traslados pendientes', async () => {
    const docBase: Docente = {
      id: 'doc_sol_3',
      rbd: RBD,
      periodo: PERIODO,
      run: '17.444.555-6',
      nombres: 'CARLOS',
      apellidos: 'DÍAZ',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasVigentesAnterior: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Historia',
      situacionFinalGdp: 'Vigente'
    };
    await guardarDocente(docBase);

    const docAumento: Docente = { ...docBase, horasContrato: 36, propuestaGdp: 'Aumento Horas' };
    await guardarDocente(docAumento);
    const { solicitudesGeneradas } = await detectarYRegistrarSolicitudesDocente({
      previo: docBase,
      nuevo: docAumento,
      establecimiento: escuela,
      usuarioActor: 'director@slep.cl',
      rolActor: 'director_establecimiento'
    });
    const solHrs = solicitudesGeneradas.find(s => s.tipoMovimiento === 'AUMENTO_HORAS')!;

    const editada = await actualizarSolicitudMovimientoEscuela({
      id: solHrs.id,
      rbd: RBD,
      horasSolicitadas: 38,
      justificacionEscuela: 'Ajuste definitivo por 2 cursos nuevos',
      usuarioActor: 'director@slep.cl'
    });
    expect(editada.horasSolicitadas).toBe(38);
    expect(editada.deltaHoras).toBe(8);

    await retirarSolicitudMovimientoEscuela({
      id: solHrs.id,
      rbd: RBD,
      motivo: 'Error de planificación',
      usuarioActor: 'director@slep.cl'
    });
    const docsPost = await listarDocentes(RBD, PERIODO);
    expect(docsPost.find(d => d.id === docBase.id)?.horasContrato).toBe(30);

    // Traslado voluntario desde la escuela
    const tras = await guardarSolicitudTrasladoEscuela({
      periodo: PERIODO,
      docente: docBase,
      comunaOrigen: escuela.comuna,
      comunaDestinoPreferente: 'Bulnes',
      fundamento: 'Acercamiento familiar',
      usuarioActor: 'director@slep.cl',
      nombreEstablecimiento: escuela.nombre
    });
    const listaTras = await listarSolicitudesTrasladoEscuela(RBD, PERIODO);
    expect(listaTras).toHaveLength(1);
    expect(listaTras[0].comunaDestinoPreferente).toBe('Bulnes');

    await retirarSolicitudTrasladoEscuela({
      id: tras.id,
      rbd: RBD,
      motivo: 'Docente desiste de traslado',
      periodo: PERIODO,
      usuarioActor: 'director@slep.cl'
    });
    expect(await listarSolicitudesTrasladoEscuela(RBD, PERIODO)).toHaveLength(0);
  });
});
