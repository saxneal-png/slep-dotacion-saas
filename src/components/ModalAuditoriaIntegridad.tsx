import React, { useState, useEffect } from 'react';
import {
  ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw,
  Users, Layers, Trash2, ArrowRight, Loader2, X, Sparkles
} from 'lucide-react';
import { Establecimiento } from '../types';
import {
  auditarIntegridadColegio,
  repararIntegridadColegio,
  ReporteIntegridadColegio,
  ResultadoReparacionIntegridad
} from '../services/auditoriaIntegridadDotacionService';

interface ModalAuditoriaIntegridadProps {
  isOpen: boolean;
  onClose: () => void;
  colegio: Establecimiento | null;
  periodoActivo: number;
  onReparacionCompletada?: () => void;
}

export const ModalAuditoriaIntegridad: React.FC<ModalAuditoriaIntegridadProps> = ({
  isOpen,
  onClose,
  colegio,
  periodoActivo,
  onReparacionCompletada
}) => {
  const [cargando, setCargando] = useState(false);
  const [reparando, setReparando] = useState(false);
  const [reporte, setReporte] = useState<ReporteIntegridadColegio | null>(null);
  const [resultado, setResultado] = useState<ResultadoReparacionIntegridad | null>(null);

  const cargarAuditoria = async () => {
    if (!colegio) return;
    setCargando(true);
    setResultado(null);
    try {
      const rep = await auditarIntegridadColegio(colegio.rbd, periodoActivo);
      setReporte(rep);
    } catch (err) {
      console.error('Error cargando auditoría de integridad:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen && colegio) {
      cargarAuditoria();
    } else {
      setReporte(null);
      setResultado(null);
    }
  }, [isOpen, colegio?.rbd, periodoActivo]);

  const handleEjecutarReparacion = async () => {
    if (!colegio) return;
    setReparando(true);
    try {
      const res = await repararIntegridadColegio(colegio.rbd, periodoActivo);
      setResultado(res);
      await cargarAuditoria();
      if (onReparacionCompletada) {
        onReparacionCompletada();
      }
    } catch (err: any) {
      console.error('Error ejecutando reparación:', err);
    } finally {
      setReparando(false);
    }
  };

  if (!isOpen || !colegio) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabecera */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                Auditoría y Reparación de Integridad Escolar
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300 border border-slate-700">
                  {colegio.nombre} (RBD {colegio.rbd})
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Detección y saneamiento de asignaciones duplicadas, docentes clonados y coberturas infladas.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
          {cargando ? (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
              <p className="text-slate-400 font-semibold">Auditando registros de dotación y asignaciones...</p>
            </div>
          ) : reporte ? (
            <>
              {/* Tarjetas KPI de Estado */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className={`p-4 rounded-xl border ${
                  reporte.horasTotalesInfladas > 0 ? 'bg-red-500/10 border-red-500/30 text-red-200' : 'bg-slate-800/50 border-slate-700 text-slate-200'
                }`}>
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Horas Infladas</div>
                  <div className="text-2xl font-black mt-1">
                    {reporte.horasTotalesInfladas} <span className="text-xs font-normal">HA</span>
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Exceso por duplicaciones</div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  reporte.asignacionesDuplicadas.length > 0 ? 'bg-amber-500/10 border-amber-500/30 text-amber-200' : 'bg-slate-800/50 border-slate-700 text-slate-200'
                }`}>
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Asig. Duplicadas</div>
                  <div className="text-2xl font-black mt-1">{reporte.asignacionesDuplicadas.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Casos en cursos</div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  reporte.docentesDuplicados.length > 0 ? 'bg-purple-500/10 border-purple-500/30 text-purple-200' : 'bg-slate-800/50 border-slate-700 text-slate-200'
                }`}>
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Docentes Clonados</div>
                  <div className="text-2xl font-black mt-1">{reporte.docentesDuplicados.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Mismo RUN, múltiple ID</div>
                </div>

                <div className={`p-4 rounded-xl border ${
                  reporte.asignacionesHuerfanas.length > 0 ? 'bg-sky-500/10 border-sky-500/30 text-sky-200' : 'bg-slate-800/50 border-slate-700 text-slate-200'
                }`}>
                  <div className="text-[10px] uppercase font-black tracking-wider text-slate-400">Asig. Huérfanas</div>
                  <div className="text-2xl font-black mt-1">{reporte.asignacionesHuerfanas.length}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Sin docente válido</div>
                </div>
              </div>

              {/* Banner de Resultado de Reparación Reciente */}
              {resultado && (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 flex items-start space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-bold text-emerald-300">¡Reparación de Integridad Completada con Éxito!</div>
                    <p className="text-[11px] text-emerald-200/80 mt-1">
                      Se fusionaron {resultado.docentesFusionados} docentes duplicados, se rescataron {resultado.asignacionesHuerfanasReasignadas} asignaciones huérfanas y se purgaron {resultado.asignacionesDuplicadasEliminadas} asignaciones redundantes ({resultado.horasRecuperadas} HA desinfladas).
                    </p>
                  </div>
                </div>
              )}

              {/* Sin inconsistencias */}
              {!reporte.hayInconsistencias && (
                <div className="p-8 text-center bg-slate-800/40 border border-slate-700/60 rounded-2xl space-y-2">
                  <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                  <h3 className="text-sm font-bold text-white">Base de Datos 100% Consistente</h3>
                  <p className="text-slate-400 text-xs max-w-md mx-auto">
                    No se detectaron docentes clonados, asignaciones huérfanas ni coberturas multiplicadas en este establecimiento.
                  </p>
                </div>
              )}

              {/* Detalle de Asignaciones Duplicadas / Infladas */}
              {reporte.asignacionesDuplicadas.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-amber-400" />
                      Asignaciones Multiplicadas en Cursos ({reporte.asignacionesDuplicadas.length})
                    </h3>
                    <span className="text-[11px] text-amber-300 font-mono">
                      +{reporte.horasTotalesInfladas} HA infladas en planes
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {reporte.asignacionesDuplicadas.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{item.cursoNivel}</span>
                            <span className="text-slate-400">•</span>
                            <span className="text-amber-300">{item.asignatura}</span>
                          </div>
                          <div className="text-[11px] text-slate-400">
                            Docente: <span className="text-slate-300 font-semibold">{item.docenteNombre}</span>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-3">
                          <div className="text-right">
                            <div className="font-mono font-bold text-red-300 text-xs">
                              {item.horasTotalInfladas} HA registradas
                            </div>
                            <div className="text-[10px] text-emerald-400 font-semibold">
                              Debe ser: {item.horasValidasReales} HA (Sobra: +{item.horasExcesoPurgables} HA)
                            </div>
                          </div>
                          <div className="px-2 py-1 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-black">
                            {item.asignacionesIds.length}x Copias
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalle de Docentes Clonados */}
              {reporte.docentesDuplicados.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-400" />
                    Docentes Duplicados con Múltiples IDs ({reporte.docentesDuplicados.length})
                  </h3>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {reporte.docentesDuplicados.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {item.nombres} {item.apellidos}
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            RUN: {item.runFormateado} • {item.docenteIds.length} fichas detectadas
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="px-2.5 py-1 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 text-[10px] font-bold">
                            Se unificará en: {item.docenteCanonicoId}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Detalle de Asignaciones Huérfanas */}
              {reporte.asignacionesHuerfanas.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-white text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-sky-400" />
                    Asignaciones Huérfanas ({reporte.asignacionesHuerfanas.length})
                  </h3>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {reporte.asignacionesHuerfanas.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/70 flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-white">
                            {item.asignatura} ({item.horas} HA)
                          </div>
                          <div className="text-[11px] text-slate-400">
                            ID Huérfano: <code className="text-slate-300">{item.docenteIdInexistente}</code>
                          </div>
                        </div>
                        <div>
                          {item.esRecuperable ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[10px] font-bold">
                              ✓ Reasignable a {item.docenteRecuperadoNombre}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/30 text-red-300 text-[10px] font-bold">
                              Se purgará
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Pie con Acciones */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            onClick={cargarAuditoria}
            disabled={cargando || reparando}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 border border-slate-700 transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
            <span>Re-escanear</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
            >
              Cerrar
            </button>

            {reporte && reporte.hayInconsistencias && (
              <button
                onClick={handleEjecutarReparacion}
                disabled={reparando || cargando}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-black bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-950/40 border border-emerald-400/30 transition-all disabled:opacity-50"
              >
                {reparando ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Reparando y Reconciliando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ejecutar Reparación y Limpieza Automática</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
