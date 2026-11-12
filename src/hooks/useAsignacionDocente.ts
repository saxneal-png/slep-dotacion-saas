import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AsignacionHoraria,
  CursoSae,
  Docente,
  Establecimiento,
  PlanEstudioCurricular
} from '../types';
import {
  calcularAuditoriaDocenteMultitramo,
  esNivelParvulario,
  resolverCodigoYAmbitoAsignatura
} from '@slep/mineduc-engine';
import { listarPlanesEstudio } from '../database/db';
import { calcularHorasFueraAulaDocente } from '../services/auditoriaDocenteService';
import {
  calcularMapaDisponibilidadDocentePorCursos,
  calcularSaldoDocentePorFuente,
  CursoDisponibilidadDocente,
  obtenerMateriasAfinesDocente,
  ResumenImpactoAsignacion,
  simularImpactoAsignacion
} from '../services/curricularPlanService';

export interface NuevaAsignacionInput {
  curso: CursoSae | null; // null => TRANSVERSAL
  asignatura: string;
  horas: number;
  esTallerJec?: boolean;
  esTallerSep?: boolean;
  esCoDocencia?: boolean;
  esTrabajoColaborativo?: boolean;
  esCoDocenciaParvularia?: boolean;
  tipoApoyo?: string;
  cursosCompartidosIds?: string[];
  ambitoExplicito?:
    | 'LIBRE_DISPOSICION_JEC'
    | 'PLAN_COMUN'
    | 'DIFERENCIADA_HC'
    | 'PLAN_COMUN_ELECTIVO'
    | 'ADICIONAL_EXTRA';
}

export function useAsignacionDocente(
  docente: Docente | null,
  colegio: Establecimiento,
  cursos: CursoSae[],
  asignacionesColegio: AsignacionHoraria[],
  periodoActivo: number,
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void,
  onEliminarAsignacion?: (id: string) => Promise<void> | void
) {
  const [planesDb, setPlanesDb] = useState<PlanEstudioCurricular[]>([]);

  useEffect(() => {
    let cancel = false;
    listarPlanesEstudio()
      .then(list => {
        if (!cancel) setPlanesDb(list);
      })
      .catch(() => {});
    return () => {
      cancel = true;
    };
  }, [colegio.rbd]);

  const asignacionesDocente = useMemo(() => {
    if (!docente) return [];
    return asignacionesColegio.filter(
      a => a.docenteId === docente.id || (a.coDocenteId === docente.id && a.tieneCoDocente)
    );
  }, [docente, asignacionesColegio]);

  const materiasAfines = useMemo(() => {
    if (!docente) return [];
    return obtenerMateriasAfinesDocente(docente, asignacionesColegio);
  }, [docente, asignacionesColegio]);

  const mapaCursos: CursoDisponibilidadDocente[] = useMemo(() => {
    if (!docente) return [];
    return calcularMapaDisponibilidadDocentePorCursos(
      docente,
      cursos,
      asignacionesColegio,
      planesDb,
      colegio
    );
  }, [docente, cursos, asignacionesColegio, planesDb, colegio]);

  const saldoPorFuente = useMemo(() => {
    if (!docente) return null;
    return calcularSaldoDocentePorFuente(
      docente,
      asignacionesColegio,
      colegio.porcentajePrioritarios || 0
    );
  }, [docente, asignacionesColegio, colegio.porcentajePrioritarios]);

  const resumenNormativo = useMemo(() => {
    if (!docente) return null;
    const desglose = calcularHorasFueraAulaDocente(
      docente,
      asignacionesDocente,
      colegio.porcentajePrioritarios || 0
    );
    const es60 = (colegio.porcentajePrioritarios || 0) >= 80;

    let ha65 = 0;
    let ha60 = 0;
    let pieCron = 0;
    let sepExento = 0;
    let totalHaLectivas = 0;

    for (const a of asignacionesDocente) {
      if (a.esTrabajoColaborativo) {
        pieCron += a.horasCronologicasPie || a.horasColaborativas || a.horasPedagogicasAula || 0;
        continue;
      }
      if (a.esTallerSep) {
        sepExento += Math.round((a.horasPedagogicasAula || 0) * 0.75 * 100) / 100;
        continue;
      }
      const ha = a.horasPedagogicasAula || 0;
      totalHaLectivas += ha;
      if (es60) ha60 += ha;
      else ha65 += ha;
    }

    const audit = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: ha65,
      horasAula60_40: ha60,
      horasPieCronologicas: pieCron,
      horasTallerSepExento: sepExento,
      horasNoAulaInstitucionales: desglose.horasInstitucionalesSubvGen,
      horasContratoReal: docente.horasContrato,
      aplicaArticulo69: Boolean(docente.aplicaArticulo69)
    });

    const esEducadora =
      docente.estamento === 'EDUCADORA_PARVULO' ||
      Boolean(docente.esEducadoraParvulo) ||
      Boolean(docente.cargoInstitucional && /p[aá]rvulo|infantil|prek[ií]nder|k[ií]nder/i.test(docente.cargoInstitucional));

    return {
      audit,
      desglose,
      totalHaLectivas: Math.round(totalHaLectivas * 100) / 100,
      esEducadora,
      esParvularioCurso: (c: CursoSae) => esNivelParvulario(c.nivel)
    };
  }, [docente, asignacionesDocente, colegio.porcentajePrioritarios]);

  const simular = useCallback(
    (
      curso: CursoSae | null,
      horasPedagogicas: number,
      opciones: { esTallerSep?: boolean; esTrabajoColaborativo?: boolean } = {}
    ): ResumenImpactoAsignacion | null => {
      if (!docente) return null;
      return simularImpactoAsignacion(
        docente,
        asignacionesColegio,
        curso,
        horasPedagogicas,
        colegio.porcentajePrioritarios || 0,
        opciones
      );
    },
    [docente, asignacionesColegio, colegio.porcentajePrioritarios]
  );

  const crearAsignacion = useCallback(
    async (input: NuevaAsignacionInput): Promise<AsignacionHoraria | null> => {
      if (!docente || !onGuardarAsignacion) return null;
      const nombreLimpio = input.asignatura.trim();
      if (!nombreLimpio || input.horas <= 0) return null;

      const isTransversal = !input.curso;
      const esTallerSep = Boolean(input.esTallerSep);
      const esColab = Boolean(input.esTrabajoColaborativo);
      const esTallerJec = Boolean(input.esTallerJec) && !esTallerSep && !esColab && !isTransversal;
      const compartidos = input.cursosCompartidosIds?.length ? input.cursosCompartidosIds : undefined;

      const resCod = resolverCodigoYAmbitoAsignatura(nombreLimpio, {
        nivelCurso: input.curso?.nivel,
        esJec: esTallerJec,
        esTallerSep,
        esTrabajoColaborativo: esColab,
        esDiferenciadoCompartido: Boolean(compartidos),
        ambitoExplicito: esTallerSep
          ? 'ADICIONAL_EXTRA'
          : esTallerJec
          ? 'LIBRE_DISPOSICION_JEC'
          : input.ambitoExplicito
      });

      const nueva: AsignacionHoraria = {
        id: `asig_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        rbd: colegio.rbd,
        periodo: periodoActivo,
        cursoId: input.curso ? input.curso.id : 'TRANSVERSAL',
        docenteId: docente.id,
        asignatura: nombreLimpio,
        codigoAsignatura: resCod.codigo,
        ambitoCurricular: esTallerJec ? 'LIBRE_DISPOSICION_JEC' : resCod.ambito,
        horasPedagogicasAula: Number(input.horas),
        horasCronologicasPie: esColab
          ? Number(input.horas)
          : input.tipoApoyo && /pie/i.test(input.tipoApoyo)
          ? Math.round(Number(input.horas) * 0.75 * 10) / 10
          : undefined,
        horasColaborativas: esColab ? Number(input.horas) : undefined,
        esTallerJec,
        esTallerSep,
        esCoDocencia: Boolean(input.esCoDocencia),
        esCoDocenciaParvularia: Boolean(input.esCoDocenciaParvularia),
        esTrabajoColaborativo: esColab,
        esProporcionDocente: !isTransversal && !esTallerSep && !esColab,
        tipoApoyo: input.tipoApoyo,
        cursosCompartidosIds: compartidos,
        esDiferenciadoCompartido: Boolean(compartidos)
      };

      await onGuardarAsignacion(nueva);
      return nueva;
    },
    [docente, colegio.rbd, periodoActivo, onGuardarAsignacion]
  );

  const actualizarHoras = useCallback(
    async (asig: AsignacionHoraria, nuevasHoras: number) => {
      if (!onGuardarAsignacion || nuevasHoras <= 0) return;
      await onGuardarAsignacion({
        ...asig,
        horasPedagogicasAula: nuevasHoras,
        ...(asig.esTrabajoColaborativo
          ? { horasCronologicasPie: nuevasHoras, horasColaborativas: nuevasHoras }
          : {})
      });
    },
    [onGuardarAsignacion]
  );

  const eliminar = useCallback(
    async (id: string) => {
      if (!onEliminarAsignacion) return;
      await onEliminarAsignacion(id);
    },
    [onEliminarAsignacion]
  );

  return {
    planesDb,
    asignacionesDocente,
    materiasAfines,
    mapaCursos,
    saldoPorFuente,
    resumenNormativo,
    simular,
    crearAsignacion,
    actualizarHoras,
    eliminar
  };
}
