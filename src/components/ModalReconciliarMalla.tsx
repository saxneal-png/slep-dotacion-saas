import React, { useState, useMemo } from 'react';
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Trash2,
  Layers,
  Users,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Check
} from 'lucide-react';
import { Establecimiento, CursoSae, Docente, AsignacionHoraria } from '../types';
import {
  analizarSincronizacionDotacion,
  ejecutarReconciliacionLimpia,
  ejecutarAutoAsignacionMallaDesdeNomina,
  ejecutarLimpiarTodasAsignaciones
} from '../services/reconciliacionDotacionService';

interface ModalReconciliarMallaProps {
  isOpen: boolean;
  onClose: () => void;
  colegio: Establecimiento;
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  periodoActivo: number;
  onSincronizacionCompletada: () => Promise<void> | void;
}

export const ModalReconciliarMalla: React.FC<ModalReconciliarMallaProps> = ({
  isOpen,
  onClose,
  colegio,
  cursos,
  docentes,
  asignaciones,
  periodoActivo,
  onSincronizacionCompletada
}) => {
  const [ejecutandoAccion, setEjecutandoAccion] = useState<string | null>(null);
  const [mensajeResultado, setMensajeResultado] = useState<string | null>(null);
  const [confirmarLimpiezaTotal, setConfirmarLimpiezaTotal] = useState(false);

  // Diagnóstico en tiempo real
  const diagnostico = useMemo(() => {
    if (!isOpen || !colegio) return null;
    return analizarSincronizacionDotacion(colegio, docentes, cursos, asignaciones);
  }, [isOpen, colegio, docentes, cursos, asignaciones]);

  if (!isOpen || !colegio) return null;

  const handleReconciliarLimpia = async () => {
    try {
      setEjecutandoAccion('reconciliar');
      const res = await ejecutarReconciliacionLimpia(colegio.rbd, periodoActivo);
      await onSincronizacionCompletada();
      setMensajeResultado(res.mensaje);
    } catch (err: any) {
      alert(`Error al reconciliar: ${err.message || err}`);
    } finally {
      setEjecutandoAccion(null);
    }
  };

  const handleAutoAsignar = async () => {
    if (asignaciones.length > 0) {
      if (!confirm('Esta acción limpiará asignaciones duplicadas y auto-completará la malla curricular con los docentes activos de la nómina. ¿Deseas continuar?')) {
        return;
      }
    }
    try {
      setEjecutandoAccion('autoasignar');
      const res = await ejecutarAutoAsignacionMallaDesdeNomina(
        colegio.rbd,
        periodoActivo,
        colegio,
        cursos,
        docentes
      );
      await onSincronizacionCompletada();
      setMensajeResultado(res.mensaje);
    } catch (err: any) {
      alert(`Error al auto-asignar: ${err.message || err}`);
    } finally {
      setEjecutandoAccion(null);
    }
  };

  const handleLimpiarMalla = async () => {
    try {
      setEjecutandoAccion('limpiar');
      const count = await ejecutarLimpiarTodasAsignaciones(colegio.rbd, periodoActivo);
      await onSincronizacionCompletada();
      setConfirmarLimpiezaTotal(false);
      setMensajeResultado(`Se eliminaron ${count} asignaciones horarias. Los cursos ahora están limpios para nueva asignación.`);
    } catch (err: any) {
      alert(`Error al limpiar asignaciones: ${err.message || err}`);
    } finally {
      setEjecutandoAccion(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Cabecera Estilo Apple / MINEDUC */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-[#002B49] text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500/30 text-orange-200 uppercase tracking-wider">
                  Reconciliación Inteligente
                </span>
                <span className="text-[11px] text-slate-300">
                  RBD {colegio.rbd} • Periodo {periodoActivo}
                </span>
              </div>
              <h3 className="text-lg font-black text-white tracking-tight mt-0.5">
                Sincronizar Malla con Nómina Ley
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Cuerpo del Modal */}
        <div className="p-6 overflow-y-auto space-y-6">

          {/* Mensaje de Éxito si una acción acaba de concluir */}
          {mensajeResultado && (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 font-medium">
                <strong className="block font-bold">¡Operación Realizada con Éxito!</strong>
                <span>{mensajeResultado}</span>
              </div>
            </div>
          )}

          {/* Tarjeta de Diagnóstico y Estado en Vivo */}
          {diagnostico && (
            <div className={`p-4 rounded-xl border ${
              diagnostico.estaSincronizado
                ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  {diagnostico.estaSincronizado ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      {diagnostico.estaSincronizado ? 'Malla Sincronizada' : 'Discrepancias Detectadas'}
                    </h4>
                    <p className="text-xs mt-0.5">{diagnostico.resumenMensaje}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-center">
                  <div className="bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block font-semibold">Docentes</span>
                    <strong className="text-xs text-slate-800 font-black">{diagnostico.totalDocentes}</strong>
                  </div>
                  <div className="bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block font-semibold">Cursos</span>
                    <strong className="text-xs text-slate-800 font-black">{diagnostico.totalCursos}</strong>
                  </div>
                  <div className="bg-white/80 px-2.5 py-1 rounded-lg border border-slate-200/80 shadow-2xs">
                    <span className="text-[10px] text-slate-500 block font-semibold">Asignaciones</span>
                    <strong className="text-xs text-slate-800 font-black">{diagnostico.totalAsignaciones}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Opciones de Sincronización y Reconciliación */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Selecciona una Metodología de Sincronización
            </h4>

            {/* OPCIÓN 1: Reconciliación Limpia (Recomendada) */}
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/30 hover:bg-blue-50/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-100 text-blue-800 border border-blue-200">
                    Recomendado
                  </span>
                  <h5 className="text-sm font-bold text-slate-900">
                    1. Reconciliar y Purgar Duplicados
                  </h5>
                </div>
                <p className="text-xs text-slate-600 max-w-md">
                  Elimina asignaciones huérfanas de prueba y registros duplicados. Preserva todas tus asignaciones válidas creadas.
                </p>
              </div>
              <button
                type="button"
                disabled={ejecutandoAccion !== null}
                onClick={handleReconciliarLimpia}
                className="shrink-0 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {ejecutandoAccion === 'reconciliar' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Reconciliando...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Ejecutar Reconciliación</span>
                  </>
                )}
              </button>
            </div>

            {/* OPCIÓN 2: Auto-Generar Malla Asistida (Jidoka) */}
            <div className="p-4 rounded-xl border border-orange-200 bg-orange-50/30 hover:bg-orange-50/60 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-800 border border-orange-200">
                    Automático
                  </span>
                  <h5 className="text-sm font-bold text-slate-900">
                    2. Auto-Asignar Malla Oficial MINEDUC
                  </h5>
                </div>
                <p className="text-xs text-slate-600 max-w-md">
                  Distribuye automáticamente las horas de la malla obligatoria en cada curso según las especialidades y capacidad lectiva de tus docentes.
                </p>
              </div>
              <button
                type="button"
                disabled={ejecutandoAccion !== null}
                onClick={handleAutoAsignar}
                className="shrink-0 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {ejecutandoAccion === 'autoasignar' ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generando Malla...</span>
                  </>
                ) : (
                  <>
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Auto-Asignar Malla</span>
                  </>
                )}
              </button>
            </div>

            {/* OPCIÓN 3: Limpiar Solo Malla / Asignaciones */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-slate-50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                    Reinicio
                  </span>
                  <h5 className="text-sm font-bold text-slate-800">
                    3. Limpiar Solo Malla (Asignaciones)
                  </h5>
                </div>
                <p className="text-xs text-slate-500 max-w-md">
                  Deja los cursos en 0 HA para armar la distribución desde cero. No modifica los docentes, contratos ni salas.
                </p>
              </div>

              {confirmarLimpiezaTotal ? (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleLimpiarMalla}
                    disabled={ejecutandoAccion !== null}
                    className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Confirmar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmarLimpiezaTotal(false)}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold rounded-xl transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={ejecutandoAccion !== null}
                  onClick={() => setConfirmarLimpiezaTotal(true)}
                  className="shrink-0 px-4 py-2.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5 text-slate-400" />
                  <span>Vaciar Asignaciones</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Pie del Modal */}
        <div className="p-4 px-6 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Persistencia garantizada bajo SQLite WASM e IndexedDB</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>

      </div>
    </div>
  );
};
