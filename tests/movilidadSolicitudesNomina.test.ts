import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDb,
  guardarDocente,
  guardarEstablecimiento,
  listarDocentes,
  reiniciarTodaLaBaseDatos
} from '../src/database/db';
import {
  detectarYRegistrarSolicitudesDocente,
  listarSolicitudesMovimientoDotacion,
  sancionarSolicitudDotacion
} from '../src/services/solicitudesDotacionService';
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
});
