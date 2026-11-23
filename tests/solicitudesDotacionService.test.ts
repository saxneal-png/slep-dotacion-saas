import { beforeAll, describe, expect, it } from 'vitest';
import {
  getDb,
  guardarDocente,
  guardarEstablecimiento,
  listarDocentes
} from '../src/database/db';
import {
  derivarSolicitudAMesaMovilidad,
  detectarYRegistrarSolicitudesDocente,
  listarSolicitudesMovimientoDotacion,
  sancionarSolicitudDotacion,
  visarTecnicoSolicitudDotacion
} from '../src/services/solicitudesDotacionService';
import { normalizarPermisos, PERMISOS_POR_DEFECTO } from '../src/security/permissionCatalog';
import { Docente, Establecimiento } from '../src/types';

const EST_TEST: Establecimiento = {
  id: 'est_9911',
  rbd: '9911',
  nombre: 'Escuela Prueba Consolidación',
  comuna: 'Bulnes',
  regimen: 'JEC',
  porcentajePrioritarios: 75,
  director: 'Director Test',
  asesorUatp: 'Asesor Test'
};

const DOC_BASE: Docente = {
  id: 'doc_test_9911_1',
  rbd: '9911',
  periodo: 2027,
  run: '15.222.333-4',
  nombres: 'María Elena',
  apellidos: 'Soto Riquelme',
  calidadJuridica: 'TITULAR',
  estamento: 'DOCENTE_AULA',
  horasContrato: 30,
  horasVigentesAnterior: 30,
  horasSubvencionGeneralTitular: 30,
  asignaturaPrincipal: 'Matemática',
  propuestaGdp: 'Continuidad',
  aplicaArticulo69: false
};

describe('Solicitudes de Movimiento de Dotación, Art. 69 y Sanción GDP', () => {
  beforeAll(async () => {
    await getDb();
    await guardarEstablecimiento(EST_TEST);
    await guardarDocente(DOC_BASE);
  });

  it('1. Registra Aumento de Horas y Acogimiento Art. 69 manteniendo simulación activa pendiente de aprobación', async () => {
    const docEditado: Docente = {
      ...DOC_BASE,
      horasContrato: 36,
      horasSubvencionGeneralTitular: 36,
      propuestaGdp: 'Aumento Horas',
      aplicaArticulo69: true,
      observacionesPal: 'Aumento por nuevo curso y solicitud Art. 69 por 31 años de servicio'
    };

    const { docenteParaGuardar, solicitudesGeneradas } = await detectarYRegistrarSolicitudesDocente({
      previo: DOC_BASE,
      nuevo: docEditado,
      establecimiento: EST_TEST,
      usuarioActor: 'director@escuela9911.cl',
      rolActor: 'director_establecimiento'
    });

    await guardarDocente(docenteParaGuardar);

    expect(docenteParaGuardar.estadoSancionGdp).toBe('Pendiente');
    expect(docenteParaGuardar.horasContrato).toBe(36);
    expect(docenteParaGuardar.horasVigentesAnterior).toBe(30);
    expect(solicitudesGeneradas.map(s => s.tipoMovimiento).sort()).toEqual([
      'ACOGIMIENTO_ART_69',
      'AUMENTO_HORAS'
    ]);

    const pendientes = await listarSolicitudesMovimientoDotacion({ periodo: 2027, rbd: '9911' });
    expect(pendientes.length).toBeGreaterThanOrEqual(2);
  });

  it('2. Permite visación técnica UATP y sanción parcial GDP aplicando horas aprobadas a la nómina', async () => {
    const lista = await listarSolicitudesMovimientoDotacion({
      periodo: 2027,
      rbd: '9911',
      tipoMovimiento: 'AUMENTO_HORAS'
    });
    const solAumento = lista[0];
    expect(solAumento).toBeDefined();

    const visada = await visarTecnicoSolicitudDotacion({
      id: solAumento.id,
      estadoDestino: 'VISADO_UATP',
      observacionUatp: 'Coherente con plan de estudios 2027',
      usuarioActor: 'asesor@slep.cl',
      rolActor: 'asesor_uatp'
    });
    expect(visada.estadoRevision).toBe('VISADO_UATP');

    const sancionada = await sancionarSolicitudDotacion({
      id: solAumento.id,
      decision: 'APROBADO_PARCIAL',
      horasAprobadas: 34,
      observacionSancion: 'Se aprueban +4 hrs por techo presupuestario',
      usuarioActor: 'gdp@slep.cl',
      rolActor: 'gdp_validador',
      puedeSancionar: true
    });
    expect(sancionada.estadoRevision).toBe('APROBADO_PARCIAL');
    expect(sancionada.horasAprobadas).toBe(34);

    const docs = await listarDocentes('9911', 2027);
    const docActual = docs.find(d => d.id === DOC_BASE.id);
    expect(docActual?.horasContrato).toBe(34);
    expect(docActual?.estadoSancionGdp).toBe('Aprobado parcial.');
    expect(docActual?.horasAprobadasGdp).toBe(34);
  });

  it('3. Al rechazar solicitud de Art. 69, revierte aplicaArticulo69 sin dañar las horas vigentes', async () => {
    const lista = await listarSolicitudesMovimientoDotacion({
      periodo: 2027,
      rbd: '9911',
      tipoMovimiento: 'ACOGIMIENTO_ART_69'
    });
    const solArt69 = lista[0];
    expect(solArt69).toBeDefined();

    const rechazada = await sancionarSolicitudDotacion({
      id: solArt69.id,
      decision: 'RECHAZADO',
      observacionSancion: 'Acredita 27 años de servicio (< 30 años exigidos por Ley 19.070)',
      usuarioActor: 'gdp@slep.cl',
      rolActor: 'gdp_validador',
      puedeSancionar: true
    });
    expect(rechazada.estadoRevision).toBe('RECHAZADO');

    const docs = await listarDocentes('9911', 2027);
    const docActual = docs.find(d => d.id === DOC_BASE.id);
    expect(docActual?.aplicaArticulo69).toBe(false);
    expect(docActual?.estadoSancionGdp).toBe('Rechazado');
  });

  it('4. Permite delegar sanción (solicitudes_dotacion.ejecutar) a asesor_uatp y bloquea a director_establecimiento', () => {
    const defaultAsesor = PERMISOS_POR_DEFECTO.asesor_uatp;
    expect(defaultAsesor).toContain('solicitudes_dotacion.editar');
    expect(defaultAsesor).not.toContain('solicitudes_dotacion.ejecutar');

    const asesorDelegado = normalizarPermisos('asesor_uatp', [
      ...defaultAsesor,
      'solicitudes_dotacion.ejecutar'
    ]);
    expect(asesorDelegado).toContain('solicitudes_dotacion.ejecutar');

    const directorIntentando = normalizarPermisos('director_establecimiento', [
      'solicitudes_dotacion.ver',
      'solicitudes_dotacion.ejecutar'
    ]);
    expect(directorIntentando).not.toContain('solicitudes_dotacion.ver');
    expect(directorIntentando).not.toContain('solicitudes_dotacion.ejecutar');
  });

  it('5. Deriva No Continuidad al submódulo Mesa de Movilidad manteniendo vínculo trazable', async () => {
    const docNc: Docente = {
      ...DOC_BASE,
      id: 'doc_test_9911_2',
      run: '16.333.444-5',
      nombres: 'Carlos',
      apellidos: 'Méndez Vera',
      horasContrato: 34,
      horasVigentesAnterior: 34,
      propuestaGdp: 'No Continuidad',
      observacionesPal: 'Fusión de cursos por baja matrícula'
    };
    await guardarDocente(docNc);

    const { solicitudesGeneradas } = await detectarYRegistrarSolicitudesDocente({
      previo: { ...docNc, propuestaGdp: 'Continuidad' },
      nuevo: docNc,
      establecimiento: EST_TEST,
      usuarioActor: 'director@escuela9911.cl'
    });
    expect(solicitudesGeneradas[0]?.tipoMovimiento).toBe('NO_CONTINUIDAD');

    const derivada = await derivarSolicitudAMesaMovilidad({
      id: solicitudesGeneradas[0].id,
      usuarioActor: 'subdirector@slep.cl',
      rolActor: 'subdirector_uatp'
    });
    expect(derivada.estadoRevision).toBe('DERIVADO_MOVILIDAD');
    expect(derivada.solicitudMovilidadId).toBeTruthy();
  });
});
