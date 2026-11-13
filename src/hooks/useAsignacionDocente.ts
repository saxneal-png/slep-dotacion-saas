import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AsignacionHoraria,
  CursoSae,
  Docente,
  Establecimiento,
  PlanEstudioCurricular
} from '../types';
import {
  esNivelParvulario,
  resolverCodigoYAmbitoAsignatura
} from '@slep/mineduc-engine';
import { listarPlanesEstudio } from '../database/db';
import { auditarCargaDocenteIntegral } from '../services/auditoriaDocenteService';
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
  onEliminarAsignacion?: (id: string) => Promise<void> | void,
  docentesColegio: Docente[] = []
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
      colegio,
      docentesColegio
    );
  }, [docente, cursos, asignacionesColegio, planesDb, colegio, docentesColegio]);

  const saldoPorFuente = useMemo(() => {
    if (!docente) return null;
    return calcularSaldoDocentePorFuente(
      docente,
      asignacionesColegio,
      colegio.porcentajePrioritarios || 0,
      cursos
    );
  }, [docente, asignacionesColegio, colegio.porcentajePrioritarios, cursos]);

  const cursosMap = useMemo(() => new Map(cursos.map(c => [c.id, c])), [cursos]);

  const resumenNormativo = useMemo(() => {
    if (!docente) return null;
    const propias = asignacionesColegio.filter(a => a.docenteId === docente.id);
    const coDoc = asignacionesColegio.filter(
      a => a.coDocenteId === docente.id && a.tieneCoDocente
    );
    const integral = auditarCargaDocenteIntegral(
      docente,
      propias,
      coDoc,
      cursosMap,
      colegio.porcentajePrioritarios || 0
    );

    const totalLectiva = Math.round(integral.haDocenciaEfectiva * 100) / 100;
    const maxAulaPermitida = Math.round(integral.maxHAPermitidas * 100) / 100;
    const horasAulaLibres = Math.max(0, Math.round((maxAulaPermitida - totalLectiva) * 100) / 100);

    return {
      audit: integral.auditDoc,
      integral,
      desglose: {
        horasInstitucionalesSubvGen: integral.horasInstitucionalesSubvGen,
        sepExentasCronologicas: integral.sepExentasCronologicas,
        pieCronologicas: integral.pieCronologicas,
        horasExentasTotales: integral.horasExentasTotales,
        horasParaDocenciaAula: integral.horasParaDocenciaAula
      },
      totalHaLectivas: totalLectiva,
      maxAulaPermitida,
      horasAulaLibres,
      esEducadora: integral.isEducadoraParvulo,
      esParvularioCurso: (c: CursoSae) => esNivelParvulario(c.nivel)
    };
  }, [docente, asignacionesColegio, cursosMap, colegio.porcentajePrioritarios]);

  const simular = useCallback(
    (
      curso: CursoSae | null,
      horasPedagogicas: number,
      opciones: {
        esTallerSep?: boolean;
        esTrabajoColaborativo?: boolean;
        esCoDocencia?: boolean;
        esCoDocenciaParvularia?: boolean;
      } = {}
    ): ResumenImpactoAsignacion | null => {
      if (!docente) return null;
      return simularImpactoAsignacion(
        docente,
        asignacionesColegio,
        curso,
        horasPedagogicas,
        colegio.porcentajePrioritarios || 0,
        { ...opciones, cursosColegio: cursos }
      );
    },
    [docente, asignacionesColegio, colegio.porcentajePrioritarios, cursos]
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
