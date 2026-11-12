import React, { useState, useMemo } from 'react';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Layers,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Users,
  X
} from 'lucide-react';
import { AsignacionHoraria, CursoSae, Docente, Establecimiento } from '../../types';
import { useAsignacionDocente } from '../../hooks/useAsignacionDocente';
import { ResumenImpactoAsignacion } from '../../services/curricularPlanService';
import { DocenteSaldoStickyBar } from './DocenteSaldoStickyBar';
import { AsignacionQuickPopover, QuickPopoverSeed } from './AsignacionQuickPopover';
import { DocenteAsignacionPanel } from '../DocenteAsignacionPanel';

interface DocenteAsignacionDrawerProps {
  isOpen: boolean;
  docente: Docente | null;
  docentesLista: Docente[];
  onSelectDocente: (d: Docente) => void;
  onClose: () => void;
  colegio: Establecimiento;
  cursos: CursoSae[];
  asignaciones: AsignacionHoraria[];
  periodoActivo: number;
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

export const DocenteAsignacionDrawer: React.FC<DocenteAsignacionDrawerProps> = ({
  isOpen,
  docente,
  docentesLista,
  onSelectDocente,
  onClose,
  colegio,
  cursos,
  asignaciones,
  periodoActivo,
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  const [tab, setTab] = useState<'matriz' | 'carga' | 'normativa'>('matriz');
  const [filtroCursos, setFiltroCursos] = useState<'AFINES' | 'VACANTES' | 'TODOS'>('VACANTES');
  const [busquedaCurso, setBusquedaCurso] = useState('');
  const [popoverSeed, setPopoverSeed] = useState<QuickPopoverSeed | null>(null);
  const [previewHover, setPreviewHover] = useState<{
    etiqueta: string;
    impacto: ResumenImpactoAsignacion;
  } | null>(null);

  const {
    asignacionesDocente,
    materiasAfines,
    mapaCursos,
    saldoPorFuente,
    resumenNormativo,
    simular,
    crearAsignacion,
    actualizarHoras,
    eliminar
  } = useAsignacionDocente(
    docente,
    colegio,
    cursos,
    asignaciones,
    periodoActivo,
    onGuardarAsignacion,
    onEliminarAsignacion
  );

  const idxActual = useMemo(() => {
    if (!docente) return -1;
    return docentesLista.findIndex(d => d.id === docente.id);
  }, [docente, docentesLista]);

  const cursosFiltrados = useMemo(() => {
    const q = busquedaCurso.trim().toLowerCase();
    return mapaCursos.filter(item => {
      if (q && !`${item.curso.nivel} ${item.curso.letra} ${item.infoPlan.nombrePlan}`.toLowerCase().includes(q)) {
        return false;
      }
      if (filtroCursos === 'AFINES') return item.tieneAfinidad;
      if (filtroCursos === 'VACANTES') return item.totalHorasFaltantesPlan > 0.01 || item.horasAsignadasDocenteEnCurso > 0;
      return true;
    });
  }, [mapaCursos, busquedaCurso, filtroCursos]);

  if (!isOpen || !docente || !resumenNormativo || !saldoPorFuente) return null;

  const { audit, desglose, totalHaLectivas } = resumenNormativo;
  const cursosMap = new Map(cursos.map(c => [c.id, c]));

  const irDocente = (delta: number) => {
    if (docentesLista.length <= 1 || idxActual < 0) return;
    const nextIdx = (idxActual + delta + docentesLista.length) % docentesLista.length;
    onSelectDocente(docentesLista[nextIdx]);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-6xl bg-white dark:bg-slate-900 h-full shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-700 animate-in slide-in-from-right duration-200">
        {/* Top Bar del Drawer */}
        <div className="px-4 py-3 bg-blue-900 text-white flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-white/15 shrink-0">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-black truncate">
                  {docente.apellidos}, {docente.nombres}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/20 font-mono">
                  {docente.run}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-700">
                  {docente.calidadJuridica}
                </span>
              </div>
              <p className="text-[11px] text-blue-100 truncate">
                {docente.cargoInstitucional || docente.estamento} · {colegio.nombre} (RBD {colegio.rbd})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => irDocente(-1)}
              disabled={docentesLista.length <= 1}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
              title="Docente anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <select
              value={docente.id}
              onChange={e => {
                const target = docentesLista.find(d => d.id === e.target.value);
                if (target) onSelectDocente(target);
              }}
              className="max-w-[200px] px-2 py-1 rounded-lg bg-blue-950/70 border border-blue-700 text-xs font-semibold text-white focus:outline-none"
            >
              {docentesLista.map(d => (
                <option key={d.id} value={d.id} className="text-slate-900 bg-white">
                  {d.apellidos}, {d.nombres} ({d.horasContrato}h)
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => irDocente(1)}
              disabled={docentesLista.length <= 1}
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-40"
              title="Siguiente docente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="ml-2 p-1.5 rounded-lg bg-white/10 hover:bg-rose-600 transition-colors"
              title="Cerrar panel (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Barra Sticky de Saldo y Simulación */}
        <DocenteSaldoStickyBar
          docente={docente}
          contratoSubvGen={saldoPorFuente.contratoSubvGen}
          contratoSep={saldoPorFuente.contratoSep}
          contratoPie={saldoPorFuente.contratoPie}
          totalHaLectivas={totalHaLectivas}
          contratoCalculadoTotal={audit.contratoCalculadoTotal}
          horasNoAulaTotales={desglose.horasExentasTotales}
          saldoHoras={audit.saldoHoras}
          porcentajeLectivoReal={audit.porcentajeLectivoReal}
          porcentajeLimitePonderado={audit.porcentajeLimitePonderado}
          esInfractorExcesoLectivo={audit.esInfractorExcesoLectivo}
          minutosRecreoTotal={audit.minutosRecreoTotal}
          minutosHnlTotal={audit.minutosHnlTotal}
          previewImpacto={previewHover}
        />

        {/* Navegación Interna del Drawer */}
        <div className="px-4 py-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setTab('matriz')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                tab === 'matriz'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Matriz Panorámica de Cursos ({cursos.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('carga')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                tab === 'carga'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Carga Actual ({asignacionesDocente.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('normativa')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors ${
                tab === 'normativa'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Normativa Especial (Parvularia / PIE / Manual)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() =>
              setPopoverSeed({
                curso: cursos[0] || null,
                asignatura: docente.asignaturaPrincipal || 'Taller Institucional',
                horasSugeridas: 2,
                esTallerSep: saldoPorFuente.esDocenteSepPuro
              })
            }
            className="px-3 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white inline-flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Bloque Personalizado</span>
          </button>
        </div>

        {/* Cuerpo Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {tab === 'matriz' && (
            <div className="space-y-3">
              {/* Filtros de la Matriz Panorámica */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 dark:bg-slate-800/60 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={busquedaCurso}
                    onChange={e => setBusquedaCurso(e.target.value)}
                    placeholder="Filtrar curso o plan (ej. 1° Básico, TP, 3° Medio)..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-200 text-[11px]">
                  {[
                    { id: 'AFINES' as const, label: `Afines (${mapaCursos.filter(c => c.tieneAfinidad).length})` },
                    { id: 'VACANTES' as const, label: 'Con Vacantes' },
                    { id: 'TODOS' as const, label: `Todos (${cursos.length})` }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setFiltroCursos(opt.id)}
                      className={`px-2.5 py-1 rounded-md font-bold transition-colors ${
                        filtroCursos === opt.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {cursosFiltrados.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-slate-300 rounded-xl text-xs text-slate-500">
                  No hay cursos que coincidan con este filtro. Prueba cambiar a <strong>Con Vacantes</strong> o <strong>Todos</strong>.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {cursosFiltrados.map(item => {
                    const { curso, infoPlan, disponibilidad, horasAsignadasDocenteEnCurso, totalHorasFaltantesPlan } = item;
                    return (
                      <div
                        key={curso.id}
                        className={`rounded-xl border p-3 space-y-2.5 transition-all ${
                          item.tieneAfinidad
                            ? 'bg-emerald-50/30 border-emerald-200'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-sm font-black text-slate-900 dark:text-white">
                                {curso.nivel} {curso.letra}
                              </span>
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                {curso.regimen}
                              </span>
                              {item.tieneAfinidad && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 inline-flex items-center gap-0.5">
                                  <Sparkles className="w-2.5 h-2.5" /> Afín
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 truncate">{infoPlan.nombrePlan}</p>
                          </div>

                          <div className="text-right font-mono text-[11px] shrink-0">
                            {horasAsignadasDocenteEnCurso > 0 && (
                              <span className="block font-bold text-blue-700">
                                Docente aquí: {horasAsignadasDocenteEnCurso} HA
                              </span>
                            )}
                            <span
                              className={`font-bold ${
                                totalHorasFaltantesPlan <= 0.01 ? 'text-emerald-600' : 'text-amber-700'
                              }`}
                            >
                              {totalHorasFaltantesPlan <= 0.01
                                ? '✓ Plan cubierto'
                                : `Faltan ${totalHorasFaltantesPlan} HA`}
                            </span>
                          </div>
                        </div>

                        {/* Chips de Asignaturas Pendientes (1 clic asigna; engranaje personaliza) */}
                        <div className="flex flex-wrap gap-1.5">
                          {disponibilidad.disponibles.map(asig => {
                            const esAfin = materiasAfines.some(m => m.toLowerCase() === asig.nombre.toLowerCase());
                            return (
                              <div
                                key={asig.nombre}
                                onMouseEnter={() => {
                                  const imp = simular(curso, asig.horasDisponibles);
                                  if (imp) setPreviewHover({ etiqueta: `${asig.nombre} (${curso.nivel} ${curso.letra})`, impacto: imp });
                                }}
                                onMouseLeave={() => setPreviewHover(null)}
                                className={`inline-flex items-center rounded-lg border text-[11px] overflow-hidden shadow-2xs ${
                                  esAfin
                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                                    : 'bg-slate-50 border-slate-200 text-slate-800'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    crearAsignacion({
                                      curso,
                                      asignatura: asig.nombre,
                                      horas: asig.horasDisponibles
                                    })
                                  }
                                  className="px-2 py-1 font-semibold hover:bg-emerald-100/80 inline-flex items-center gap-1 transition-colors"
                                  title={`Clic para asignar ${asig.horasDisponibles} HA de ${asig.nombre}`}
                                >
                                  <Plus className="w-3 h-3 text-emerald-600" />
                                  <span>{asig.nombre}</span>
                                  <span className="font-mono font-black px-1 rounded bg-white/80 text-[10px]">
                                    {asig.horasDisponibles}h
                                  </span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPopoverSeed({
                                      curso,
                                      asignatura: asig.nombre,
                                      horasSugeridas: asig.horasDisponibles,
                                      maxHorasPlan: asig.horasDisponibles
                                    })
                                  }
                                  className="px-1.5 py-1 border-l border-slate-200/80 hover:bg-slate-200/70 text-slate-500"
                                  title="Ajustar horas o modalidad antes de asignar"
                                >
                                  <SlidersHorizontal className="w-3 h-3" />
                                </button>
                              </div>
                            );
                          })}

                          {disponibilidad.horasLibreDisponibles > 0 && (
                            <button
                              type="button"
                              onClick={() =>
                                setPopoverSeed({
                                  curso,
                                  asignatura: 'Taller JEC / Libre Disposición',
                                  horasSugeridas: Math.min(2, disponibilidad.horasLibreDisponibles),
                                  maxHorasPlan: disponibilidad.horasLibreDisponibles,
                                  esTallerJec: true
                                })
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Libre Disp. JEC ({disponibilidad.horasLibreDisponibles}h)</span>
                            </button>
                          )}

                          {/* Botones rápidos de Co-Docencia / SEP / PIE */}
                          <button
                            type="button"
                            onClick={() =>
                              setPopoverSeed({
                                curso,
                                asignatura: saldoPorFuente.esDocentePiePuro
                                  ? 'Apoyo PIE - Co-docencia Aula Común (Decreto 170)'
                                  : saldoPorFuente.esDocenteSepPuro
                                  ? 'Co-Docencia SEP'
                                  : 'Co-Docencia / Apoyo Aula',
                                horasSugeridas: 2,
                                esCoDocencia: !saldoPorFuente.esDocenteSepPuro,
                                esTallerSep: saldoPorFuente.esDocenteSepPuro
                              })
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-800 text-[11px] font-bold"
                          >
                            <Users className="w-3 h-3" />
                            <span>+ Apoyo / Taller</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === 'carga' && (
            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-slate-800">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-100 dark:bg-slate-900 text-slate-600 dark:text-slate-300 uppercase text-[10px] font-bold border-b">
                  <tr>
                    <th className="px-3 py-2.5">Curso</th>
                    <th className="px-3 py-2.5">Asignatura / Apoyo</th>
                    <th className="px-3 py-2.5 text-center">Modalidad</th>
                    <th className="px-3 py-2.5 text-center">Horas</th>
                    <th className="px-3 py-2.5 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {asignacionesDocente.map(a => {
                    const c = cursosMap.get(a.cursoId);
                    return (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/40">
                        <td className="px-3 py-2 font-bold text-slate-800 dark:text-white">
                          {c ? `${c.nivel} ${c.letra}` : a.cursoId === 'TRANSVERSAL' ? 'Transversal' : a.cursoId}
                        </td>
                        <td className="px-3 py-2 font-medium text-slate-700 dark:text-slate-200">{a.asignatura}</td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              a.esTallerSep
                                ? 'bg-sky-100 text-sky-800'
                                : a.esTrabajoColaborativo || (a.tipoApoyo && /pie/i.test(a.tipoApoyo))
                                ? 'bg-purple-100 text-purple-800'
                                : a.esTallerJec
                                ? 'bg-amber-100 text-amber-800'
                                : a.esCoDocencia
                                ? 'bg-indigo-100 text-indigo-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {a.esTallerSep
                              ? 'SEP'
                              : a.esTrabajoColaborativo
                              ? 'Colaborativo'
                              : a.esTallerJec
                              ? 'JEC'
                              : a.esCoDocencia
                              ? 'Co-Docencia'
                              : 'Plan Regular'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1 font-mono">
                            <button
                              type="button"
                              onClick={() =>
                                a.horasPedagogicasAula > 1 &&
                                actualizarHoras(a, Math.round((a.horasPedagogicasAula - 1) * 100) / 100)
                              }
                              className="w-6 h-6 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-10 text-center font-bold">{a.horasPedagogicasAula}h</span>
                            <button
                              type="button"
                              onClick={() =>
                                actualizarHoras(a, Math.round((a.horasPedagogicasAula + 1) * 100) / 100)
                              }
                              className="w-6 h-6 rounded border border-slate-200 hover:bg-slate-100 flex items-center justify-center"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => eliminar(a.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50"
                            title="Eliminar asignación"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {asignacionesDocente.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                        Sin asignaciones todavía. Cambia a la pestaña "Matriz Panorámica de Cursos" para asignar en 1 clic.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'normativa' && (
            <DocenteAsignacionPanel
              docente={docente}
              colegio={colegio}
              cursos={cursos}
              asignaciones={asignaciones}
              docentes={docentesLista}
              periodoActivo={periodoActivo}
              onGuardarAsignacion={onGuardarAsignacion}
              onEliminarAsignacion={onEliminarAsignacion}
            />
          )}
        </div>
      </div>

      <AsignacionQuickPopover
        seed={popoverSeed}
        docente={docente}
        cursos={cursos}
        simular={simular}
        onConfirmar={async input => {
          await crearAsignacion(input);
        }}
        onCerrar={() => setPopoverSeed(null)}
      />
    </div>
  );
};
