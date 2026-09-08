import React, { useState, useEffect } from 'react';
import {
  Scale, ArrowRight, ArrowUpRight, ArrowDownRight, Minus, Users,
  BookOpen, Clock, Layers, Sparkles, X, Search, Filter, AlertCircle,
  Building2, CheckCircle2, TrendingUp, TrendingDown
} from 'lucide-react';
import { Establecimiento, ComparativaPeriodosResult } from '../types';
import { getComparativaPeriodos, proyectarPeriodoColegio } from '../database/db';

interface ComparadorPeriodosModalProps {
  isOpen: boolean;
  onClose: () => void;
  colegioActivo: Establecimiento | null;
  colegios: Establecimiento[];
  onPeriodoActualizado?: () => void;
}

export const ComparadorPeriodosModal: React.FC<ComparadorPeriodosModalProps> = ({
  isOpen,
  onClose,
  colegioActivo,
  colegios,
  onPeriodoActualizado
}) => {
  const [rbdSeleccionado, setRbdSeleccionado] = useState<string>(colegioActivo?.rbd || (colegios[0]?.rbd || ''));
  const [loading, setLoading] = useState(false);
  const [projecting, setProjecting] = useState(false);
  const [comparativa, setComparativa] = useState<ComparativaPeriodosResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filtroTipo, setFiltroTipo] = useState<string>('TODOS');
  const [searchTerm, setSearchTerm] = useState('');

  const cargarComparativa = async (rbd: string) => {
    if (!rbd) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await getComparativaPeriodos(rbd, 2026, 2027);
      setComparativa(res);
    } catch (err: any) {
      console.error('Error al cargar comparativa:', err);
      setErrorMsg(err.message || 'Error al calcular la comparativa.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && rbdSeleccionado) {
      cargarComparativa(rbdSeleccionado);
    }
  }, [isOpen, rbdSeleccionado]);

  if (!isOpen) return null;

  const handleEjecutarProyeccion = async () => {
    if (!rbdSeleccionado) return;
    const confirm = window.confirm(
      '¿Desea proyectar la dotación del año 2026 hacia el año 2027? Se promoverán los niveles de los cursos (ej: 1°B -> 2°B) y se replicarán los contratos docentes vigentes.'
    );
    if (!confirm) return;

    setProjecting(true);
    try {
      await proyectarPeriodoColegio(rbdSeleccionado, 2026, 2027, {
        promoverCursos: true,
        replicarAsignaciones: true
      });
      await cargarComparativa(rbdSeleccionado);
      if (onPeriodoActualizado) onPeriodoActualizado();
    } catch (err: any) {
      alert(`Error al proyectar dotación: ${err.message}`);
    } finally {
      setProjecting(false);
    }
  };

  const variacionesFiltradas = comparativa?.variacionesDocentes.filter(v => {
    const matchesSearch = v.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.run.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (filtroTipo === 'TODOS') return true;
    return v.tipoVariacion === filtroTipo;
  }) || [];

  const colegioObj = colegios.find(c => c.rbd === rbdSeleccionado);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header Steve Jobs Style */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Comparador Analítico 2026 Actual vs 2027 Proyección
                <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-semibold px-2 py-0.5 rounded-full border border-indigo-500/30">
                  Planificación Estratégica SLEP
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Auditoría comparativa de cursos, dotación contratada, balance lectivo y variaciones de horas docentes
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Selector de Colegio */}
            <select
              value={rbdSeleccionado}
              onChange={(e) => setRbdSeleccionado(e.target.value)}
              className="bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500"
            >
              {colegios.map(c => (
                <option key={c.rbd} value={c.rbd}>
                  RBD {c.rbd} - {c.nombre}
                </option>
              ))}
            </select>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido Principal con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {loading && (
            <div className="flex items-center justify-center space-x-3 p-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-300">
                Calculando balances cruzados y comparando dotaciones 2026 y 2027...
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {comparativa && !loading && (
            <>
              {/* Alerta si 2027 aún no tiene datos proyectados */}
              {comparativa.periodoB.totalCursos === 0 && (
                <div className="p-4 bg-amber-950/40 border border-amber-800/60 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 text-xs text-amber-200">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0" />
                    <div>
                      <strong className="block font-bold">La Dotación 2027 aún no ha sido proyectada para este colegio.</strong>
                      <span className="text-amber-300/80">Puedes proyectarla en un clic promoviendo la cohorte 2026 hacia el año escolar 2027.</span>
                    </div>
                  </div>
                  <button
                    onClick={handleEjecutarProyeccion}
                    disabled={projecting}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-xl shadow-md transition-all flex-shrink-0"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>{projecting ? 'Proyectando...' : 'Proyectar Dotación 2027'}</span>
                  </button>
                </div>
              )}

              {/* Tarjetas Comparativas Lado a Lado */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {/* 1. Matrícula Total */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-2">
                    <span>Matrícula SAE</span>
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-lg font-black text-white">{comparativa.periodoA.matriculaTotal}</div>
                      <div className="text-[10px] text-slate-400">2026 Actual</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-right">
                      <div className="text-lg font-black text-indigo-300">{comparativa.periodoB.matriculaTotal}</div>
                      <div className="text-[10px] text-slate-400">2027 Proy.</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 text-[10px] flex items-center justify-between font-bold">
                    <span>Variación:</span>
                    <span className={comparativa.deltaMatricula >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {comparativa.deltaMatricula >= 0 ? `+${comparativa.deltaMatricula}` : comparativa.deltaMatricula} alumnos
                    </span>
                  </div>
                </div>

                {/* 2. Cursos Totales */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-2">
                    <span>Total Cursos</span>
                    <BookOpen className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-lg font-black text-white">{comparativa.periodoA.totalCursos}</div>
                      <div className="text-[10px] text-slate-400">2026 Actual</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-right">
                      <div className="text-lg font-black text-indigo-300">{comparativa.periodoB.totalCursos}</div>
                      <div className="text-[10px] text-slate-400">2027 Proy.</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 text-[10px] flex items-center justify-between font-bold">
                    <span>Variación:</span>
                    <span className={comparativa.deltaCursos >= 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      {comparativa.deltaCursos >= 0 ? `+${comparativa.deltaCursos}` : comparativa.deltaCursos} cursos
                    </span>
                  </div>
                </div>

                {/* 3. Horas Contratadas */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-2">
                    <span>Horas Contrato</span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className="text-lg font-black text-white">{comparativa.periodoA.horasContratoTotal} hrs</div>
                      <div className="text-[10px] text-slate-400">2026 ({comparativa.periodoA.docentesTotal} doc.)</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-right">
                      <div className="text-lg font-black text-indigo-300">{comparativa.periodoB.horasContratoTotal} hrs</div>
                      <div className="text-[10px] text-slate-400">2027 ({comparativa.periodoB.docentesTotal} doc.)</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 text-[10px] flex items-center justify-between font-bold">
                    <span>Delta Contrato:</span>
                    <span className={comparativa.deltaHorasContrato >= 0 ? 'text-blue-400' : 'text-purple-400'}>
                      {comparativa.deltaHorasContrato >= 0 ? `+${comparativa.deltaHorasContrato}` : comparativa.deltaHorasContrato} hrs
                    </span>
                  </div>
                </div>

                {/* 4. Balance Lectivo (Superávit / Déficit) */}
                <div className="bg-slate-800/60 p-4 rounded-xl border border-slate-700/80 flex flex-col justify-between">
                  <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-between mb-2">
                    <span>Balance Lectivo</span>
                    <Scale className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="flex items-baseline justify-between">
                    <div>
                      <div className={`text-lg font-black ${comparativa.periodoA.balanceLectivo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {comparativa.periodoA.balanceLectivo >= 0 ? `+${comparativa.periodoA.balanceLectivo}` : comparativa.periodoA.balanceLectivo} hrs
                      </div>
                      <div className="text-[10px] text-slate-400">2026 Actual</div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500" />
                    <div className="text-right">
                      <div className={`text-lg font-black ${comparativa.periodoB.balanceLectivo >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {comparativa.periodoB.balanceLectivo >= 0 ? `+${comparativa.periodoB.balanceLectivo}` : comparativa.periodoB.balanceLectivo} hrs
                      </div>
                      <div className="text-[10px] text-slate-400">2027 Proy.</div>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/60 text-[10px] flex items-center justify-between font-bold">
                    <span>Impacto Balance:</span>
                    <span className={comparativa.deltaBalanceLectivo >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                      {comparativa.deltaBalanceLectivo >= 0 ? `+${comparativa.deltaBalanceLectivo}` : comparativa.deltaBalanceLectivo} hrs
                    </span>
                  </div>
                </div>
              </div>

              {/* Fuentes de Financiamiento Comparadas */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-300">
                  Distribución de Financiamiento de Dotación (Horas Contratadas)
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <div className="text-slate-400 font-bold mb-1">Subvención General</div>
                    <div className="flex items-center justify-between">
                      <span>2026: <strong className="text-white">{comparativa.periodoA.subvencionGeneralTotal} hrs</strong></span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span>2027: <strong className="text-indigo-300">{comparativa.periodoB.subvencionGeneralTotal} hrs</strong></span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <div className="text-slate-400 font-bold mb-1">Subvención SEP</div>
                    <div className="flex items-center justify-between">
                      <span>2026: <strong className="text-white">{comparativa.periodoA.sepTotal} hrs</strong></span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span>2027: <strong className="text-indigo-300">{comparativa.periodoB.sepTotal} hrs</strong></span>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800">
                    <div className="text-slate-400 font-bold mb-1">Programa PIE</div>
                    <div className="flex items-center justify-between">
                      <span>2026: <strong className="text-white">{comparativa.periodoA.pieTotal} hrs</strong></span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span>2027: <strong className="text-indigo-300">{comparativa.periodoB.pieTotal} hrs</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tabla de Variaciones Docentes entre 2026 y 2027 */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xs font-bold text-slate-200">
                      Variaciones en la Dotación Docente ({variacionesFiltradas.length} de {comparativa.variacionesDocentes.length})
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Detección de aumentos, reducciones, nuevas contrataciones y desvinculaciones
                    </p>
                  </div>

                  {/* Filtros y Buscador */}
                  <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <div className="relative flex-1 sm:w-48">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Buscar docente..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 text-xs text-white rounded-lg pl-8 pr-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>

                    <select
                      value={filtroTipo}
                      onChange={(e) => setFiltroTipo(e.target.value)}
                      className="bg-slate-800 border border-slate-700 text-xs text-white rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="TODOS">Todos los tipos</option>
                      <option value="AUMENTO_HORAS">Aumento de Horas</option>
                      <option value="REDUCCION_HORAS">Reducción de Horas</option>
                      <option value="NUEVO_CONTRATO">Nuevas Contrataciones</option>
                      <option value="EGRESO">Egresos / Bajas</option>
                      <option value="SIN_CAMBIO">Sin Variación</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-900/90 text-slate-400 font-bold border-b border-slate-800 uppercase text-[10px]">
                      <tr>
                        <th className="px-3 py-2.5">Docente</th>
                        <th className="px-3 py-2.5">RUN</th>
                        <th className="px-3 py-2.5 text-center">Horas 2026</th>
                        <th className="px-3 py-2.5 text-center">Horas 2027</th>
                        <th className="px-3 py-2.5 text-center">Variación</th>
                        <th className="px-3 py-2.5">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-medium">
                      {variacionesFiltradas.map((v, i) => (
                        <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                          <td className="px-3 py-2 text-white font-bold">{v.nombre}</td>
                          <td className="px-3 py-2 text-slate-400 font-mono text-[11px]">{v.run}</td>
                          <td className="px-3 py-2 text-center text-slate-300">{v.horasA} hrs</td>
                          <td className="px-3 py-2 text-center text-indigo-300 font-bold">{v.horasB} hrs</td>
                          <td className="px-3 py-2 text-center">
                            {v.deltaHoras > 0 && (
                              <span className="inline-flex items-center text-emerald-400 font-bold">
                                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" /> +{v.deltaHoras} hrs
                              </span>
                            )}
                            {v.deltaHoras < 0 && (
                              <span className="inline-flex items-center text-red-400 font-bold">
                                <ArrowDownRight className="w-3.5 h-3.5 mr-0.5" /> {v.deltaHoras} hrs
                              </span>
                            )}
                            {v.deltaHoras === 0 && (
                              <span className="text-slate-500 text-[11px]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            {v.tipoVariacion === 'NUEVO_CONTRATO' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800">
                                Nuevo Contrato
                              </span>
                            )}
                            {v.tipoVariacion === 'AUMENTO_HORAS' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                Aumento Jornada
                              </span>
                            )}
                            {v.tipoVariacion === 'REDUCCION_HORAS' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                Reducción Jornada
                              </span>
                            )}
                            {v.tipoVariacion === 'EGRESO' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-950 text-red-300 border border-red-800">
                                Baja 2027
                              </span>
                            )}
                            {v.tipoVariacion === 'SIN_CAMBIO' && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-800 text-slate-400">
                                Sin Variación
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {colegioObj && (
              <span>Establecimiento: <strong className="text-slate-200">{colegioObj.nombre}</strong></span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleEjecutarProyeccion}
              disabled={projecting || !comparativa}
              className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{projecting ? 'Proyectando...' : 'Re-Proyectar Dotación 2027'}</span>
            </button>

            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
