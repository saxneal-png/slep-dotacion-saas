import {
  CarrilMovilidad as CarrilMovilidadEngine,
  DocenteCandidatoCalce,
  ResultadoEvaluacionCalce,
  sugerirCalcesAutomaticos,
  VacanteObjetivoCalce
} from '@slep/mineduc-engine';
import {
  Docente,
  Establecimiento,
  PropuestaCalce,
  SolicitudMovilidad
} from '../../types';
import { inferirFuenteDocente, inferirFuenteVacante } from './movilidadHelpers';

export interface ExplicacionHumanaCalce {
  semaforo: 'VERDE' | 'AMARILLO' | 'ROJO';
  resumenCorto: string;
  detallesTecnicos: string[];
}

export interface CandidatoSugeridoMesa {
  solicitud: SolicitudMovilidad;
  candidato: DocenteCandidatoCalce;
  evaluacion: ResultadoEvaluacionCalce;
  puntajePrioridad: number;
  explicacion: ExplicacionHumanaCalce;
}

export interface CasoVacanteLaMesa {
  vacante: Docente;
  establecimiento?: Establecimiento;
  estado: 'ABIERTA' | 'CUBIERTA';
  propuesta?: PropuestaCalce;
  candidatosSugeridos: CandidatoSugeridoMesa[];
}

export function construirExplicacionHumanaCalce(
  evaluacion: ResultadoEvaluacionCalce,
  params: {
    horasContratoDocente: number;
    horasVacante: number;
    calidadJuridica: string;
    comunaOrigen?: string;
    comunaDestino?: string;
  }
): ExplicacionHumanaCalce {
  const semaforo: 'VERDE' | 'AMARILLO' | 'ROJO' = evaluacion.bloqueaConsolidacion
    ? 'ROJO'
    : evaluacion.alertasNormativas.length > 0 || evaluacion.indiceCompatibilidad < 75
    ? 'AMARILLO'
    : 'VERDE';

  const partes: string[] = [];

  if (evaluacion.puntajeIdoneidad >= 100) {
    partes.push('Especialidad exacta');
  } else if (evaluacion.puntajeIdoneidad >= 75) {
    partes.push('Especialidad afín');
  } else if (evaluacion.puntajeIdoneidad >= 55) {
    partes.push('Habilitación generalista');
  } else {
    partes.push('Especialidad distinta');
  }

  if (evaluacion.distanciaKm === 0) {
    partes.push('Misma comuna');
  } else if (evaluacion.distanciaKm > 0) {
    partes.push(`${evaluacion.distanciaKm} km`);
  }

  if (evaluacion.alertaMenoscaboArt42) {
    partes.push('Menor jornada titular');
  } else if (evaluacion.excedeTope44h) {
    partes.push('Excede tope 44h');
  } else {
    partes.push(`Mantiene jornada (${params.horasVacante}h)`);
  }

  if (semaforo === 'VERDE') {
    partes.push('Cumple normativa');
  }

  const detallesTecnicos: string[] = [
    `Régimen destino: ${evaluacion.regimenDestino} · Compatibilidad: ${evaluacion.indiceCompatibilidad}%`,
    `Minutos totales multi-escuela: ${evaluacion.minutosTotalesMultiEscuela}/2640 min`
  ];
  if (evaluacion.motivoBloqueo) {
    detallesTecnicos.push(`Bloqueo: ${evaluacion.motivoBloqueo}`);
  }
  for (const alerta of evaluacion.alertasNormativas) {
    if (!detallesTecnicos.includes(alerta)) {
      detallesTecnicos.push(alerta);
    }
  }

  return {
    semaforo,
    resumenCorto: partes.join(' · '),
    detallesTecnicos
  };
}

function mapCarrilToEngine(carril: SolicitudMovilidad['carril']): CarrilMovilidadEngine {
  return carril === 'NO_CONTINUIDAD_ASISTENTE_INDEFINIDO'
    ? 'NO_CONTINUIDAD_TITULAR'
    : carril;
}

export function construirCasosLaMesa(params: {
  vacantesNn: Docente[];
  solicitudes: SolicitudMovilidad[];
  docentesTerritorio: Docente[];
  propuestas: PropuestaCalce[];
  colegiosByRbd: Map<string, Establecimiento>;
}): CasoVacanteLaMesa[] {
  const { vacantesNn, solicitudes, docentesTerritorio, propuestas, colegiosByRbd } = params;

  const propPorVacanteId = new Map<string, PropuestaCalce>();
  const docentesEnPropuestas = new Set<string>();
  for (const p of propuestas) {
    if (p.vacanteDestinoId) propPorVacanteId.set(p.vacanteDestinoId, p);
    docentesEnPropuestas.add(p.docenteOrigenId);
  }

  const docMap = new Map<string, Docente>(docentesTerritorio.map(d => [d.id, d]));

  const solicitudesElegibles = solicitudes.filter(
    s =>
      s.estamentoPersonal !== 'ASISTENTE' &&
      s.estadoFlujo !== 'CONSOLIDADO' &&
      s.estadoFlujo !== 'RESOLUCION_EMITIDA' &&
      s.estadoFlujo !== 'RECHAZADO' &&
      !docentesEnPropuestas.has(s.docenteId)
  );

  const candidatosPorDocId = new Map<string, { solicitud: SolicitudMovilidad; candidato: DocenteCandidatoCalce }>();
  const candidatosDisponibles: DocenteCandidatoCalce[] = [];

  for (const sol of solicitudesElegibles) {
    const doc = docMap.get(sol.docenteId);
    const estOrig = colegiosByRbd.get(sol.rbdOrigen);
    const carrilEngine = mapCarrilToEngine(sol.carril);
    const esTrasladoCompleto = sol.carril !== 'HORAS_REMANENTES';

    const cand: DocenteCandidatoCalce = {
      docenteId: sol.docenteId,
      calidadJuridica: doc?.calidadJuridica || sol.calidadJuridica,
      asignaturaDocente: sol.asignaturaPrincipal || doc?.asignaturaPrincipal || doc?.funcionPrincipal,
      tituloMencion: sol.tituloMencion || doc?.titulo,
      aplicaArticulo69: sol.aplicaArticulo69 ?? Boolean(doc?.aplicaArticulo69),
      horasContratoActual: doc?.horasContrato ?? sol.horasContratoActual,
      horasTitularesActuales: sol.horasTitularesActuales,
      horasConservadasEnOrigen: esTrasladoCompleto ? 0 : (doc?.horasContrato ?? sol.horasContratoActual),
      fuenteOrigen: doc ? inferirFuenteDocente(doc) : sol.fuenteActual,
      rbdOrigen: sol.rbdOrigen,
      porcentajePrioritariosOrigen: estOrig?.porcentajePrioritarios,
      comunaOrigen: sol.comunaOrigen || estOrig?.comuna,
      carril: carrilEngine,
      esTrasladoCompleto,
      prioridadMovilidad: {
        carril: carrilEngine,
        puntajeSalud: sol.puntajeSalud,
        puntajeLeyKarin: sol.puntajeLeyKarin,
        puntajeCuidadoDependientes: sol.puntajeCuidadoDependientes,
        puntajeDistanciaRural: sol.puntajeDistanciaRural,
        puntajeAntiguedad: sol.puntajeAntiguedad,
        horasRemanentes: sol.horasRemanentes
      }
    };

    if (!candidatosPorDocId.has(sol.docenteId)) {
      candidatosPorDocId.set(sol.docenteId, { solicitud: sol, candidato: cand });
      candidatosDisponibles.push(cand);
    }
  }

  const casos: CasoVacanteLaMesa[] = [];

  for (const vacante of vacantesNn) {
    const estDest = colegiosByRbd.get(vacante.rbd);
    const prop = propPorVacanteId.get(vacante.id);

    if (prop) {
      casos.push({
        vacante,
        establecimiento: estDest,
        estado: 'CUBIERTA',
        propuesta: prop,
        candidatosSugeridos: []
      });
      continue;
    }

    const vacanteObj: VacanteObjetivoCalce = {
      vacanteId: vacante.id,
      rbdDestino: vacante.rbd,
      horasVacante: Number(vacante.horasContrato || 0),
      horasPedagogicasVacante: Number(vacante.horasAula || 0),
      asignaturaVacante: vacante.asignaturaPrincipal || vacante.apellidos,
      fuenteDestino: inferirFuenteVacante(vacante),
      porcentajePrioritariosDestino: estDest?.porcentajePrioritarios ?? 75,
      comunaDestino: estDest?.comuna,
      esVacanteCondicional:
        vacante.vacanteCondicional === true ||
        (vacante.tipoVacante === 'CONDICIONAL_EGRESO' && vacante.vacanteCondicional !== false)
    };

    const sugerencias = sugerirCalcesAutomaticos(candidatosDisponibles, vacanteObj, 40, 3);
    const candidatosSugeridos: CandidatoSugeridoMesa[] = [];

    for (const sug of sugerencias) {
      const ref = candidatosPorDocId.get(sug.candidato.docenteId);
      if (!ref) continue;
      candidatosSugeridos.push({
        solicitud: ref.solicitud,
        candidato: sug.candidato,
        evaluacion: sug.evaluacion,
        puntajePrioridad: sug.puntajePrioridad,
        explicacion: construirExplicacionHumanaCalce(sug.evaluacion, {
          horasContratoDocente: sug.candidato.horasContratoActual,
          horasVacante: vacanteObj.horasVacante,
          calidadJuridica: sug.candidato.calidadJuridica,
          comunaOrigen: sug.candidato.comunaOrigen,
          comunaDestino: vacanteObj.comunaDestino
        })
      });
    }

    casos.push({
      vacante,
      establecimiento: estDest,
      estado: 'ABIERTA',
      candidatosSugeridos
    });
  }

  casos.sort((a, b) => {
    if (a.estado !== b.estado) {
      return a.estado === 'ABIERTA' ? -1 : 1;
    }
    if (a.estado === 'ABIERTA') {
      const aTiene = a.candidatosSugeridos.length > 0;
      const bTiene = b.candidatosSugeridos.length > 0;
      if (aTiene !== bTiene) return aTiene ? -1 : 1;
      if (aTiene && bTiene) {
        return (
          b.candidatosSugeridos[0].evaluacion.indiceCompatibilidad -
          a.candidatosSugeridos[0].evaluacion.indiceCompatibilidad
        );
      }
    }
    return 0;
  });

  return casos;
}
