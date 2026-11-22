import { describe, it, expect } from 'vitest';
import { evaluarCalceDocenteVacante } from '@slep/mineduc-engine';
import {
  construirExplicacionHumanaCalce,
  construirCasosLaMesa
} from '../src/views/movilidad/laMesaEngine';
import { generarHtmlNotificacionMovilidad } from '../src/services/movilidadActaService';
import { Docente, Establecimiento, PropuestaCalce, SolicitudMovilidad } from '../src/types';

const PERIODO = 2027;

const estA: Establecimiento = {
  id: 'est_1',
  rbd: '1001',
  nombre: 'Escuela Los Robles',
  comuna: 'Bulnes',
  regimen: 'JEC',
  porcentajePrioritarios: 75
};

const estB: Establecimiento = {
  id: 'est_2',
  rbd: '1002',
  nombre: 'Liceo Valle Sol',
  comuna: 'Chillán',
  regimen: 'JEC',
  porcentajePrioritarios: 72
};

describe('Mesa de Movilidad - Fase 3 (La Mesa y Notificación Nemawashi)', () => {
  it('G1. construirExplicacionHumanaCalce clasifica VERDE, AMARILLO y ROJO con frases claras', () => {
    const evalVerde = evaluarCalceDocenteVacante({
      docenteId: 'd1',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Lenguaje',
      horasContratoActual: 30,
      horasTitularesActuales: 30,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      comunaOrigen: 'Bulnes',
      carril: 'NO_CONTINUIDAD_TITULAR',
      vacanteId: 'v1',
      rbdDestino: '1001',
      horasVacante: 30,
      asignaturaVacante: 'Lenguaje',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 75,
      comunaDestino: 'Bulnes'
    });
    const expVerde = construirExplicacionHumanaCalce(evalVerde, {
      horasContratoDocente: 30,
      horasVacante: 30,
      calidadJuridica: 'TITULAR',
      comunaOrigen: 'Bulnes',
      comunaDestino: 'Bulnes'
    });
    expect(expVerde.semaforo).toBe('VERDE');
    expect(expVerde.resumenCorto).toContain('Especialidad exacta');
    expect(expVerde.resumenCorto).toContain('Misma comuna');
    expect(expVerde.resumenCorto).toContain('Cumple normativa');

    const evalAmarillo = evaluarCalceDocenteVacante({
      docenteId: 'd2',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Lenguaje',
      horasContratoActual: 30,
      horasTitularesActuales: 30,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      comunaOrigen: 'Bulnes',
      vacanteId: 'v2',
      rbdDestino: '1002',
      horasVacante: 30,
      asignaturaVacante: 'Lenguaje',
      fuenteDestino: 'SEP',
      porcentajePrioritariosDestino: 72,
      comunaDestino: 'Chillán'
    });
    const expAmarillo = construirExplicacionHumanaCalce(evalAmarillo, {
      horasContratoDocente: 30,
      horasVacante: 30,
      calidadJuridica: 'TITULAR',
      comunaOrigen: 'Bulnes',
      comunaDestino: 'Chillán'
    });
    expect(expAmarillo.semaforo).toBe('AMARILLO');
    expect(expAmarillo.detallesTecnicos.some(t => t.includes('SEP'))).toBe(true);

    const evalRojo = evaluarCalceDocenteVacante({
      docenteId: 'd3',
      calidadJuridica: 'TITULAR',
      asignaturaDocente: 'Matemática',
      horasContratoActual: 44,
      horasTitularesActuales: 44,
      fuenteOrigen: 'SUBVENCION_GENERAL',
      comunaOrigen: 'Bulnes',
      vacanteId: 'v3',
      rbdDestino: '1002',
      horasVacante: 22,
      asignaturaVacante: 'Matemática',
      fuenteDestino: 'SUBVENCION_GENERAL',
      porcentajePrioritariosDestino: 72,
      comunaDestino: 'Chillán'
    });
    const expRojo = construirExplicacionHumanaCalce(evalRojo, {
      horasContratoDocente: 44,
      horasVacante: 22,
      calidadJuridica: 'TITULAR',
      comunaOrigen: 'Bulnes',
      comunaDestino: 'Chillán'
    });
    expect(expRojo.semaforo).toBe('ROJO');
    expect(expRojo.resumenCorto).toContain('Menor jornada titular');
    expect(expRojo.detallesTecnicos.some(t => t.includes('Bloqueo:'))).toBe(true);
  });

  it('G2. construirCasosLaMesa ordena casos ABIERTA antes de CUBIERTA y propone candidato compatible', () => {
    const colegiosByRbd = new Map<string, Establecimiento>([
      [estA.rbd, estA],
      [estB.rbd, estB]
    ]);

    const docCand: Docente = {
      id: 'doc_cand_1',
      rbd: estA.rbd,
      periodo: PERIODO,
      run: '16.555.444-3',
      nombres: 'MARIA',
      apellidos: 'SOTO',
      calidadJuridica: 'TITULAR',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralTitular: 30,
      asignaturaPrincipal: 'Lenguaje'
    };

    const vacCubierta: Docente = {
      id: 'vac_cubierta',
      rbd: estA.rbd,
      periodo: PERIODO,
      run: 'VAC-1001-01',
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'HISTORIA',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 20,
      horasSubvencionGeneralContrata: 20,
      asignaturaPrincipal: 'Historia',
      esVacanteNn: true
    };

    const vacAbierta: Docente = {
      id: 'vac_abierta',
      rbd: estB.rbd,
      periodo: PERIODO,
      run: 'VAC-1002-02',
      nombres: 'VACANTE POR PROVEER',
      apellidos: 'LENGUAJE',
      calidadJuridica: 'CONTRATA',
      estamento: 'DOCENTE_AULA',
      horasContrato: 30,
      horasSubvencionGeneralContrata: 30,
      asignaturaPrincipal: 'Lenguaje',
      esVacanteNn: true
    };

    const solicitudes: SolicitudMovilidad[] = [
      {
        id: 'sol_cand_1',
        periodo: PERIODO,
        carril: 'NO_CONTINUIDAD_TITULAR',
        docenteId: docCand.id,
        runDocente: docCand.run,
        nombreDocente: 'MARIA SOTO',
        rbdOrigen: estA.rbd,
        comunaOrigen: 'Bulnes',
        calidadJuridica: 'TITULAR',
        horasContratoActual: 30,
        horasTitularesActuales: 30,
        horasDisponiblesMover: 30,
        horasRemanentes: 0,
        asignaturaPrincipal: 'Lenguaje',
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'POSTULADO',
        puntajeSalud: 0,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 50,
        puntajePrioridadTotal: 1025
      }
    ];

    const propuestas: PropuestaCalce[] = [
      {
        id: 'prop_cub_1',
        escenarioId: 'esc_1',
        periodo: PERIODO,
        docenteOrigenId: 'doc_otro',
        runDocente: '14.000.111-2',
        nombreDocente: 'JUAN DIAZ',
        rbdOrigen: estB.rbd,
        rbdDestino: estA.rbd,
        vacanteDestinoId: vacCubierta.id,
        tipoCobertura: 'DEFINITIVA',
        horasAsignadas: 20,
        minutosAsignados: 1200,
        horasPedagogicasAula: 15,
        fuenteDestino: 'SUBVENCION_GENERAL',
        indiceCompatibilidad: 90,
        generaRebote: false,
        alertasNormativas: [],
        bloqueaConsolidacion: false,
        estado: 'PROPUESTA'
      }
    ];

    const casos = construirCasosLaMesa({
      vacantesNn: [vacCubierta, vacAbierta],
      solicitudes,
      docentesTerritorio: [docCand],
      propuestas,
      colegiosByRbd
    });

    expect(casos.length).toBe(2);
    expect(casos[0].vacante.id).toBe(vacAbierta.id);
    expect(casos[0].estado).toBe('ABIERTA');
    expect(casos[0].candidatosSugeridos.length).toBe(1);
    expect(casos[0].candidatosSugeridos[0].solicitud.id).toBe('sol_cand_1');
    expect(casos[0].candidatosSugeridos[0].explicacion.semaforo).toBe('VERDE');

    expect(casos[1].vacante.id).toBe(vacCubierta.id);
    expect(casos[1].estado).toBe('CUBIERTA');
    expect(casos[1].propuesta?.id).toBe('prop_cub_1');
  });

  it('H. generarHtmlNotificacionMovilidad incluye datos clave y bloques de firma', () => {
    const html = generarHtmlNotificacionMovilidad({
      solicitud: {
        id: 'sol_notif_1',
        periodo: PERIODO,
        carril: 'TRASLADO_VOLUNTARIO',
        docenteId: 'd1',
        runDocente: '15.888.999-K',
        nombreDocente: 'ELENA VERGARA',
        rbdOrigen: estA.rbd,
        rbdDestinoPreferente: estB.rbd,
        calidadJuridica: 'TITULAR',
        horasContratoActual: 30,
        horasTitularesActuales: 30,
        horasDisponiblesMover: 30,
        horasRemanentes: 0,
        fuenteActual: 'SUBVENCION_GENERAL',
        estadoFlujo: 'PRE_ASIGNADO',
        puntajeSalud: 0,
        puntajeLeyKarin: 0,
        puntajeCuidadoDependientes: 0,
        puntajeDistanciaRural: 0,
        puntajeAntiguedad: 40,
        puntajePrioridadTotal: 4
      },
      estOrigen: estA,
      estDestino: estB,
      periodo: PERIODO,
      usuarioActor: 'Asesor UATP'
    });

    expect(html).toContain('Notificación de Propuesta de Movilidad Territorial 2027');
    expect(html).toContain('ELENA VERGARA');
    expect(html).toContain('15.888.999-K');
    expect(html).toContain('Escuela Los Robles');
    expect(html).toContain('Liceo Valle Sol');
    expect(html).toContain('Dirección Establecimiento de Origen');
    expect(html).toContain('Funcionario/a Notificado/a');
  });
});
