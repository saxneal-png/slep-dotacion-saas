import React, { useState, useMemo, useEffect } from 'react';
import { Check, Plus, Search, Trash2, Users, X } from 'lucide-react';
import { AsignacionHoraria, CursoSae, Docente, Establecimiento, PlanEstudioCurricular } from '../../types';
import { esNivelParvulario, resolverCodigoYAmbitoAsignatura } from '@slep/mineduc-engine';
import { listarPlanesEstudio } from '../../database/db';
import { auditarCargaDocenteIntegral } from '../../services/auditoriaDocenteService';
import {
  calcularDisponibilidadCurso,
  calcularEstadoCursosParvularios,
  resolverPlanCurso,
  sonAsignaturasEquivalentes
} from '../../services/curricularPlanService';

interface SabanaCurricularViewProps {
  colegio: Establecimiento;
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  periodoActivo: number;
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

interface CeldaActiva {
  curso: CursoSae;
  asignatura: string;
  horasPlan: number;
}

export const SabanaCurricularView: React.FC<SabanaCurricularViewProps> = ({
  colegio,
  cursos,
  docentes,
  asignaciones,
  periodoActivo,
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  const [planesDb, setPlanesDb] = useState<PlanEstudioCurricular[]>([]);
  const [filtroTexto, setFiltroTexto] = useState('');
  const [soloConVacantes, setSoloConVacantes] = useState(false);
  const [celdaActiva, setCeldaActiva] = useState<CeldaActiva | null>(null);
  const [docenteSeleccionadoId, setDocenteSeleccionadoId] = useState('');
  const [horasInput, setHorasInput] = useState(2);
  const [asignaturaInput, setAsignaturaInput] = useState('');

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

  const cursosMap = useMemo(() => new Map(cursos.map(c => [c.id, c])), [cursos]);

  const docentesConSaldo = useMemo(() => {
    return docentes
      .map(d => {
        const propias = asignaciones.filter(a => a.docenteId === d.id);
        const coDoc = asignaciones.filter(a => a.coDocenteId === d.id && a.tieneCoDocente);
        const integral = auditarCargaDocenteIntegral(
          d,
          propias,
          coDoc,
          cursosMap,
          colegio.porcentajePrioritarios || 0
        );
        const contratoSep = Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0);
        const contratoPie = Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0);
        const haAsignadas = Math.round(integral.haDocenciaEfectiva * 100) / 100;
        const maxAula = Math.round(integral.maxHAPermitidas * 100) / 100;
        const libresAula = Math.max(0, Math.round((maxAula - haAsignadas) * 100) / 100);
        return {
          docente: d,
          saldoHoras: integral.saldoHoras,
          isEducadora: integral.isEducadoraParvulo,
          haAsignadas,
          maxAula,
          libresAula,
          contratoSep,
          sepAsignado: integral.reqSepDoc,
          contratoPie,
          pieAsignado: integral.pieAsignadasDoc,
          minutosRecreo: integral.auditDoc.minutosRecreoTotal,
          minutosHnl: integral.auditDoc.minutosHnlTotal,
          minutosPlan40: integral.auditDoc.minutosHnlPlanificacion40
        };
      })
      .sort((a, b) => b.saldoHoras - a.saldoHoras || a.docente.apellidos.localeCompare(b.docente.apellidos));
  }, [docentes, asignaciones, cursosMap, colegio.porcentajePrioritarios]);

  const mapaParvulario = useMemo(
    () =>
      calcularEstadoCursosParvularios(
        cursos,
        docentes,
        asignaciones,
        colegio.porcentajePrioritarios || 0,
        colegio.regimenProporcion
      ),
    [cursos, docentes, asignaciones, colegio.porcentajePrioritarios, colegio.regimenProporcion]
  );

  const docentesMap = useMemo(() => new Map(docentes.map(d => [d.id, d])), [docentes]);
  const FILA_PARVULARIA_DTO306 = 'Permanencia DTO 306 / BCEP (60m cron.)';

  // Planes resueltos por curso
  const infoPorCurso = useMemo(() => {
    const map = new Map<
      string,
      {
        plan: ReturnType<typeof resolverPlanCurso>;
        disp: ReturnType<typeof calcularDisponibilidadCurso>;
      }
    >();
    for (const c of cursos) {
      const plan = resolverPlanCurso(c, planesDb);
      const disp = calcularDisponibilidadCurso(c, plan, asignaciones);
      map.set(c.id, { plan, disp });
    }
    return map;
  }, [cursos, planesDb, asignaciones]);

  // Lista única de asignaturas presentes en los planes de la escuela (+ fila unificada DTO 306 si hay párvulos)
  const asignaturasFilas = useMemo(() => {
    const nombresMap = new Map<string, string>();
    let hayParvularia = false;
    for (const c of cursos) {
      if (esNivelParvulario(c.nivel)) {
        hayParvularia = true;
        continue;
      }
      const info = infoPorCurso.get(c.id);
      if (!info) continue;
      for (const a of info.disp.todas) {
        const key = a.nombre.trim().toLowerCase();
        if (!nombresMap.has(key)) nombresMap.set(key, a.nombre.trim());
      }
    }
    if (hayParvularia) {
      nombresMap.set(FILA_PARVULARIA_DTO306.toLowerCase(), FILA_PARVULARIA_DTO306);
    }
    const q = filtroTexto.trim().toLowerCase();
    return Array.from(nombresMap.values())
      .filter(nombre => {
        if (q && !nombre.toLowerCase().includes(q)) return false;
        if (soloConVacantes) {
          if (nombre === FILA_PARVULARIA_DTO306) {
            return Array.from(mapaParvulario.values()).some(p => !p.resultado.coberturaCompletaPermanencia);
          }
          return cursos.some(c => {
            if (esNivelParvulario(c.nivel)) return false;
            const info = infoPorCurso.get(c.id);
            const item = info?.disp.todas.find(x => sonAsignaturasEquivalentes(x.nombre, nombre));
            return item && item.horasDisponibles > 0.01;
          });
        }
        return true;
      })
      .sort((a, b) => {
        if (a === FILA_PARVULARIA_DTO306) return -1;
        if (b === FILA_PARVULARIA_DTO306) return 1;
        return a.localeCompare(b);
      });
  }, [cursos, infoPorCurso, filtroTexto, soloConVacantes, mapaParvulario]);

  const abrirCelda = (curso: CursoSae, asignatura: string, horasPlan: number, horasDisp: number) => {
    setCeldaActiva({ curso, asignatura, horasPlan });
    setAsignaturaInput(asignatura);
    setHorasInput(horasDisp > 0 ? horasDisp : Math.min(2, horasPlan));
    const afin = docentesConSaldo.find(
      d =>
        d.saldoHoras > 0 &&
        d.docente.asignaturaPrincipal &&
        sonAsignaturasEquivalentes(d.docente.asignaturaPrincipal, asignatura)
    );
    setDocenteSeleccionadoId(afin?.docente.id || docentesConSaldo[0]?.docente.id || '');
  };

  const asignacionesCeldaActiva = useMemo(() => {
    if (!celdaActiva) return [];
    const esParv = esNivelParvulario(celdaActiva.curso.nivel);
    return asignaciones.filter(
      a =>
        (a.cursoId === celdaActiva.curso.id ||
          Boolean(a.cursosCompartidosIds?.includes(celdaActiva.curso.id))) &&
        !a.esTallerSep &&
        !a.esTrabajoColaborativo &&
        (esParv ? true : sonAsignaturasEquivalentes(a.asignatura, celdaActiva.asignatura))
    );
  }, [celdaActiva, asignaciones]);

  const docResumenSeleccionado = useMemo(
    () => docentesConSaldo.find(x => x.docente.id === docenteSeleccionadoId) || null,
    [docentesConSaldo, docenteSeleccionadoId]
  );

  const handleGuardarCelda = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!celdaActiva || !docenteSeleccionadoId || !onGuardarAsignacion || horasInput <= 0) return;
    const esParv = esNivelParvulario(celdaActiva.curso.nivel);
    const nombreFinal =
      asignaturaInput.trim() ||
      (esParv ? 'Atención Directa Parvularia (DTO 306)' : celdaActiva.asignatura);
    const resCod = resolverCodigoYAmbitoAsignatura(nombreFinal, {
      nivelCurso: celdaActiva.curso.nivel,
      esJec: false
    });
    const estadoParv = esParv ? mapaParvulario.get(celdaActiva.curso.id) : null;
    const esSegundaEd = Boolean(
      estadoParv?.titularDocente && estadoParv.titularDocente.id !== docenteSeleccionadoId
    );
    await onGuardarAsignacion({
      id: `asig_sabana_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      cursoId: celdaActiva.curso.id,
      docenteId: docenteSeleccionadoId,
      asignatura: nombreFinal,
      codigoAsignatura: resCod.codigo,
      ambitoCurricular: resCod.ambito,
      horasPedagogicasAula: Number(horasInput),
      esTallerJec: false,
      esCoDocencia: esSegundaEd,
      esCoDocenciaParvularia: esSegundaEd,
      esProporcionDocente: true
    });
  };

  if (cursos.length === 0) {
    return (
      <div className="card-elevated p-8 text-center text-xs text-slate-500">
        No hay cursos cargados en este establecimiento para construir la sábana curricular.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Barra de controles de la Sábana */}
      <div className="card-elevated p-3 flex flex-wrap items-center justify-between gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            value={filtroTexto}
            onChange={e => setFiltroTexto(e.target.value)}
            placeholder="Filtrar asignatura (ej. Matemática, Historia, Lenguaje)..."
            className="w-full pl-8 pr-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer px-2.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200">
          <input
            type="checkbox"
            checked={soloConVacantes}
            onChange={e => setSoloConVacantes(e.target.checked)}
            className="rounded border-slate-300"
          />
          <span>Solo filas con horas vacantes</span>
        </label>
      </div>

      {/* Grilla Sábana Densa */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full text-[11px] border-collapse">
            <thead className="bg-blue-900 text-white sticky top-0 z-20">
              <tr>
                <th className="sticky left-0 z-30 bg-blue-950 px-3 py-2.5 text-left font-black uppercase min-w-[200px] border-r border-blue-800">
                  Asignatura / Curso
                </th>
                {cursos.map(c => (
                  <th
                    key={c.id}
                    className="px-2.5 py-2 text-center font-bold min-w-[125px] border-r border-blue-800/60"
                  >
                    <div className="font-black">
                      {c.nivel} {c.letra}
                    </div>
                    <div className="text-[9px] text-blue-200 font-normal flex items-center justify-center gap-1">
                      <span>{c.regimen}</span>
                      {esNivelParvulario(c.nivel) && (
                        <span className="px-1 rounded bg-teal-500/30 text-teal-100 font-bold">
                          DTO 306 · 60m
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {asignaturasFilas.map(asigNombre => (
                <tr key={asigNombre} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40">
                  <td className="sticky left-0 z-10 bg-white dark:bg-slate-900 px-3 py-2 font-bold text-slate-800 dark:text-white border-r border-slate-200 dark:border-slate-700">
                    {asigNombre}
                  </td>
                  {cursos.map(c => {
                    const esParv = esNivelParvulario(c.nivel);
                    if (esParv && asigNombre === FILA_PARVULARIA_DTO306) {
                      const estadoParv = mapaParvulario.get(c.id);
                      if (!estadoParv) return <td key={c.id} className="px-2 py-2 text-center text-slate-300 border-r border-slate-100">—</td>;
                      const res = estadoParv.resultado;
                      const hrsPlanCron = Math.round((res.permanenciaMinutos / 60) * 100) / 100;
                      const hrsCubiertasCron = Math.round((res.minutosCubiertosTotales / 60) * 100) / 100;
                      const hrsFaltantesCron = Math.max(0, Math.round((res.minutosDeficitRestante / 60) * 100) / 100);
                      const asigsParvCurso = asignaciones.filter(
                        a => (a.cursoId === c.id || Boolean(a.cursosCompartidosIds?.includes(c.id))) && !a.esTrabajoColaborativo
                      );
                      return (
                        <td key={c.id} className="p-1 border-r border-slate-100 align-middle">
                          <button
                            type="button"
                            onClick={() =>
                              abrirCelda(c, 'Atención Directa Parvularia (DTO 306)', hrsPlanCron, hrsFaltantesCron)
                            }
                            className={`w-full px-2 py-1.5 rounded-lg border text-left transition-all ${
                              res.coberturaCompletaPermanencia
                                ? 'bg-teal-50 border-teal-300 text-teal-900 hover:bg-teal-100'
                                : hrsCubiertasCron > 0
                                ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                                : 'bg-white border-dashed border-teal-300 text-slate-600 hover:bg-teal-50/40'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-1 font-mono font-black text-[10px]">
                              <span>{hrsCubiertasCron}/{hrsPlanCron}h 60m</span>
                              {asigsParvCurso.length > 1 && (
                                <span className="px-1 rounded bg-teal-100 text-teal-900 inline-flex items-center gap-0.5">
                                  <Users className="w-2.5 h-2.5" /> {asigsParvCurso.length}
                                </span>
                              )}
                            </div>
                            <div className="truncate text-[10px] font-semibold mt-0.5">
                              {estadoParv.titularDocente ? (
                                <span>
                                  {estadoParv.titularDocente.apellidos.split(' ')[0]} {estadoParv.titularDocente.nombres.charAt(0)}. ({res.porcentajeCoberturaPermanencia}%)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-0.5 text-teal-700">
                                  <Plus className="w-2.5 h-2.5" /> Sin educadora
                                </span>
                              )}
                            </div>
                            {!res.coberturaCompletaPermanencia && (
                              <div className="truncate text-[9px] font-bold text-amber-800 mt-0.5">
                                {res.segundaEducadoraRequerida
                                  ? `Req. 2da Ed: ${res.minutosDeficitRestanteTexto}`
                                  : `Faltan ${res.minutosDeficitRestanteTexto}`}
                              </div>
                            )}
                          </button>
                        </td>
                      );
                    }

                    if (esParv) {
                      return (
                        <td
                          key={c.id}
                          className="px-2 py-2 text-center text-slate-300 border-r border-slate-100 bg-slate-50/30"
                        >
                          —
                        </td>
                      );
                    }

                    const info = infoPorCurso.get(c.id);
                    const itemPlan = info?.disp.todas.find(x => sonAsignaturasEquivalentes(x.nombre, asigNombre));
                    if (!itemPlan) {
                      return (
                        <td
                          key={c.id}
                          className="px-2 py-2 text-center text-slate-300 border-r border-slate-100 bg-slate-50/30"
                        >
                          —
                        </td>
                      );
                    }

                    const asigsCelda = asignaciones.filter(
                      a =>
                        (a.cursoId === c.id || Boolean(a.cursosCompartidosIds?.includes(c.id))) &&
                        !a.esTallerSep &&
                        !a.esTrabajoColaborativo &&
                        sonAsignaturasEquivalentes(a.asignatura, asigNombre)
                    );

                    const cubierta = itemPlan.horasDisponibles <= 0.01;
                    const parcial = !cubierta && itemPlan.horasAsignadas > 0;
                    const primerDoc = asigsCelda[0] ? docentesMap.get(asigsCelda[0].docenteId) : null;

                    return (
                      <td key={c.id} className="p-1 border-r border-slate-100 align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            abrirCelda(c, itemPlan.nombre, itemPlan.horasPlan, itemPlan.horasDisponibles)
                          }
                          className={`w-full px-2 py-1.5 rounded-lg border text-left transition-all ${
                            cubierta
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 hover:bg-emerald-100'
                              : parcial
                              ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100'
                              : 'bg-white border-dashed border-slate-300 text-slate-600 hover:border-blue-400 hover:bg-blue-50/40'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1 font-mono font-black text-[10px]">
                            <span>
                              {itemPlan.horasAsignadas}/{itemPlan.horasPlan}h
                            </span>
                            {asigsCelda.length > 1 && (
                              <span className="px-1 rounded bg-purple-100 text-purple-800 inline-flex items-center gap-0.5">
                                <Users className="w-2.5 h-2.5" /> {asigsCelda.length}
                              </span>
                            )}
                          </div>
                          <div className="truncate text-[10px] font-semibold mt-0.5">
                            {primerDoc ? (
                              <span>
                                {primerDoc.apellidos.split(' ')[0]} {primerDoc.nombres.charAt(0)}.
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-0.5 text-amber-700">
                                <Plus className="w-2.5 h-2.5" /> Vacante
                              </span>
                            )}
                          </div>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Editor de Celda de la Sábana */}
      {celdaActiva && (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-md w-full overflow-hidden">
            <div className={`px-4 py-3 text-white flex items-center justify-between ${esNivelParvulario(celdaActiva.curso.nivel) ? 'bg-teal-900' : 'bg-blue-900'}`}>
              <div>
                <h4 className="text-sm font-bold">{celdaActiva.asignatura}</h4>
                <p className="text-[11px] text-blue-100">
                  {celdaActiva.curso.nivel} {celdaActiva.curso.letra} ·{' '}
                  {esNivelParvulario(celdaActiva.curso.nivel)
                    ? `Permanencia DTO 306: ${celdaActiva.horasPlan}h (60m cron.)`
                    : `Plan: ${celdaActiva.horasPlan} HA`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCeldaActiva(null)}
                className="p-1 rounded-lg hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              {asignacionesCeldaActiva.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase text-slate-500 block">
                    Docentes Asignados en esta Celda
                  </span>
                  {asignacionesCeldaActiva.map(a => {
                    const doc = docentesMap.get(a.docenteId);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200"
                      >
                        <div>
                          <p className="font-bold text-slate-800">
                            {doc ? `${doc.apellidos}, ${doc.nombres}` : a.docenteId}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {a.asignatura} ·{' '}
                            <strong className="font-mono">
                              {a.horasPedagogicasAula} {esNivelParvulario(celdaActiva.curso.nivel) ? 'h cron.' : 'HA'}
                            </strong>
                          </p>
                        </div>
                        {onEliminarAsignacion && (
                          <button
                            type="button"
                            onClick={() => onEliminarAsignacion(a.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <form onSubmit={handleGuardarCelda} className="space-y-2.5 pt-2 border-t border-slate-200">
                <span className="text-[10px] font-bold uppercase text-blue-800 block">
                  Agregar Docente a esta Celda
                </span>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Docente</label>
                  <select
                    value={docenteSeleccionadoId}
                    onChange={e => setDocenteSeleccionadoId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                    required
                  >
                    {docentesConSaldo.map(({ docente, isEducadora, haAsignadas, maxAula, libresAula }) => (
                      <option key={docente.id} value={docente.id}>
                        {docente.apellidos}, {docente.nombres} {isEducadora ? '[Parv 60m] ' : ''}
                        [Aula: {haAsignadas}/{maxAula}h · {libresAula <= 0.05 ? 'Tope completo' : `+${libresAula}h disp.`}]
                      </option>
                    ))}
                  </select>
                  {docResumenSeleccionado && (
                    <div className="mt-1.5 px-2 py-1 rounded-md bg-slate-50 border border-slate-200 flex flex-wrap items-center gap-1.5 text-[10px] font-mono text-slate-600">
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold ${
                          docResumenSeleccionado.libresAula <= 0.05
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-teal-100 text-teal-900'
                        }`}
                      >
                        Aula {docResumenSeleccionado.haAsignadas}/{docResumenSeleccionado.maxAula}h{' '}
                        {docResumenSeleccionado.libresAula <= 0.05
                          ? '✓ Tope'
                          : `(+${docResumenSeleccionado.libresAula}h disp.)`}
                      </span>
                      {(docResumenSeleccionado.contratoSep > 0 || docResumenSeleccionado.sepAsignado > 0) && (
                        <span className="px-1.5 py-0.2 rounded bg-sky-100 text-sky-900 font-bold">
                          SEP {Math.round(docResumenSeleccionado.sepAsignado * 10) / 10}/{docResumenSeleccionado.contratoSep}h
                        </span>
                      )}
                      {(docResumenSeleccionado.contratoPie > 0 || docResumenSeleccionado.pieAsignado > 0) && (
                        <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-900 font-bold">
                          PIE {Math.round(docResumenSeleccionado.pieAsignado * 10) / 10}/{docResumenSeleccionado.contratoPie}h
                        </span>
                      )}
                      <span>
                        Rec {Math.floor(docResumenSeleccionado.minutosRecreo / 60)}h{docResumenSeleccionado.minutosRecreo % 60}m · HNL {Math.floor(docResumenSeleccionado.minutosHnl / 60)}h{docResumenSeleccionado.minutosHnl % 60}m (40%: {Math.floor(docResumenSeleccionado.minutosPlan40 / 60)}h{docResumenSeleccionado.minutosPlan40 % 60}m)
                      </span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      Asignatura / Eje
                    </label>
                    <input
                      type="text"
                      value={asignaturaInput}
                      onChange={e => setAsignaturaInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-semibold"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      {esNivelParvulario(celdaActiva.curso.nivel) ? 'Horas (60m)' : 'Horas (HA)'}
                    </label>
                    <input
                      type="number"
                      step={esNivelParvulario(celdaActiva.curso.nivel) ? '0.25' : '0.5'}
                      min="0.25"
                      max="44"
                      value={horasInput}
                      onChange={e => setHorasInput(Number(e.target.value) || 0.5)}
                      className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white font-mono font-bold text-center"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setCeldaActiva(null)}
                    className="px-3 py-1.5 rounded-lg font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Asignar</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
