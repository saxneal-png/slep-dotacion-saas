import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  PauseCircle,
  PlayCircle,
  Users,
  CheckCircle2,
  AlertTriangle,
  X,
  Lock,
  Clock,
  Sparkles,
  RefreshCw,
  Building2,
  ShieldCheck,
  Info
} from 'lucide-react';
import { AuthService } from '../../services/authService';
import { RolId, ResumenEstamentoPausa, EstadoPausaRevision } from '../../types/authTypes';

interface ModalControlSesionesEstamentosProps {
  isOpen: boolean;
  onClose: () => void;
  onActualizacionExitosa: (mensaje: string) => void;
  usuarioEjecutor?: string;
}

export const ModalControlSesionesEstamentos: React.FC<ModalControlSesionesEstamentosProps> = ({
  isOpen,
  onClose,
  onActualizacionExitosa,
  usuarioEjecutor
}) => {
  const [resumen, setResumen] = useState<ResumenEstamentoPausa[]>([]);
  const [cargando, setCargando] = useState(false);
  const [ejecutando, setEjecutando] = useState(false);
  const [estadoPausa, setEstadoPausa] = useState<EstadoPausaRevision | null>(null);
  const [estamentosSeleccionados, setEstamentosSeleccionados] = useState<RolId[]>(['director_establecimiento']);
  const [motivoPausa, setMotivoPausa] = useState('Inicio oficial del período de Revisión Interna Territorial UATP 2027');
  const [error, setError] = useState<string | null>(null);

  const cargarDatos = async () => {
    try {
      setCargando(true);
      setError(null);
      const estResumen = await AuthService.getResumenEstamentos();
      setResumen(estResumen);
      const pausa = AuthService.getEstadoPausaRevision();
      setEstadoPausa(pausa);
      if (pausa?.activa && pausa.rolesAfectados.length > 0) {
        setEstamentosSeleccionados(pausa.rolesAfectados);
        if (pausa.motivo) setMotivoPausa(pausa.motivo);
      }
    } catch (e: any) {
      setError(e.message || 'Error al obtener resumen de usuarios');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      cargarDatos();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const rolesPausables = resumen.filter(r => !r.esProtegido);
  const rolesProtegidos = resumen.filter(r => r.esProtegido);

  const toggleSeleccion = (rol: RolId) => {
    setEstamentosSeleccionados(prev =>
      prev.includes(rol) ? prev.filter(r => r !== rol) : [...prev, rol]
    );
  };

  const handlePausarSeleccionados = async () => {
    if (estamentosSeleccionados.length === 0) {
      setError('Por favor seleccione al menos un estamento para pausar.');
      return;
    }

    const totalAfectados = rolesPausables
      .filter(r => estamentosSeleccionados.includes(r.rol))
      .reduce((acc, curr) => acc + curr.activos, 0);

    const confirmMsg = `¿Confirmas pausar y cerrar inmediatamente las sesiones de ${totalAfectados} usuario(s) de los estamentos seleccionados?\n\nLos Asesores UATP, Coordinadores y Super Usuarios mantendrán acceso ininterrumpido.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setEjecutando(true);
      setError(null);
      const res = await AuthService.pausarAccesoMasivo(
        estamentosSeleccionados,
        motivoPausa,
        usuarioEjecutor || 'Super Usuario'
      );
      await cargarDatos();
      onActualizacionExitosa(
        `✓ Se pausó exitosamente el acceso a ${res.totalAfectados} cuenta(s) en ${res.rolesAfectados.length} estamento(s). Sesiones activas invalidadas.`
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al pausar sesiones masivamente');
    } finally {
      setEjecutando(false);
    }
  };

  const handlePausarTodosEscolares = async () => {
    const rolesTodos = rolesPausables.map(r => r.rol);
    const totalAfectados = rolesPausables.reduce((acc, curr) => acc + curr.activos, 0);

    const confirmMsg = `¿Confirmas pausar el acceso a TODOS los establecimientos escolares (${totalAfectados} usuarios activos: Directores y Jefes UTP) para iniciar la Revisión Interna?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setEjecutando(true);
      setError(null);
      const res = await AuthService.pausarAccesoMasivo(
        rolesTodos,
        motivoPausa,
        usuarioEjecutor || 'Super Usuario'
      );
      await cargarDatos();
      onActualizacionExitosa(
        `✓ Revisión Interna activada: ${res.totalAfectados} cuenta(s) de colegios en pausa. UATP con acceso exclusivo.`
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al pausar acceso escolar masivo');
    } finally {
      setEjecutando(false);
    }
  };

  const handleReactivarSeleccionados = async (rolesEspecificos?: RolId[]) => {
    const rolesAReactivar = rolesEspecificos || estamentosSeleccionados;
    if (rolesAReactivar.length === 0) {
      setError('Seleccione los estamentos a reactivar.');
      return;
    }

    const totalReactivables = rolesPausables
      .filter(r => rolesAReactivar.includes(r.rol))
      .reduce((acc, curr) => acc + curr.inactivos, 0);

    const confirmMsg = `¿Confirmas reactivar el acceso a ${totalReactivables} usuario(s) de los estamentos indicados? Podrán volver a iniciar sesión.`;

    if (!window.confirm(confirmMsg)) return;

    try {
      setEjecutando(true);
      setError(null);
      const res = await AuthService.reactivarAccesoMasivo(rolesAReactivar);
      await cargarDatos();
      onActualizacionExitosa(
        `✓ Acceso reactivado con éxito para ${res.totalReactivados} usuario(s) de ${res.rolesReactivados.length} estamento(s).`
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al reactivar sesiones');
    } finally {
      setEjecutando(false);
    }
  };

  const handleReactivarTodos = async () => {
    const confirmMsg = '¿Confirmas reanudar el acceso a TODOS los estamentos escolares? La pausa de revisión interna quedará finalizada.';
    if (!window.confirm(confirmMsg)) return;

    try {
      setEjecutando(true);
      setError(null);
      const res = await AuthService.reactivarAccesoMasivo();
      await cargarDatos();
      onActualizacionExitosa(
        `✓ Trabajo escolar reanudado: ${res.totalReactivados} usuario(s) reactivados exitosamente.`
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al reactivar todas las cuentas');
    } finally {
      setEjecutando(false);
    }
  };

  const hayPausaGlobal = Boolean(estadoPausa?.activa && estadoPausa.rolesAfectados.length > 0);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl my-8">
        {/* Header Decorativo */}
        <div className="relative p-6 bg-gradient-to-r from-slate-900 via-rose-950/40 to-slate-900 border-b border-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-rose-500/20 text-rose-400 rounded-2xl border border-rose-500/30 shadow-inner">
                <PauseCircle className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-rose-400 px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20">
                    Control de Sesiones &middot; Super Usuario
                  </span>
                  {hayPausaGlobal && (
                    <span className="text-[11px] font-bold text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center gap-1 animate-pulse">
                      <Clock className="w-3 h-3" /> Pausa Activa
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white tracking-tight mt-1">
                  Pausar / Reactivar Sesiones por Estamento
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Congela el acceso escolar para iniciar la Revisión Interna Territorial UATP preservando el equipo supervisor.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition"
              title="Cerrar ventana"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="p-3.5 bg-rose-950/60 border border-rose-700/80 rounded-2xl text-xs text-rose-300 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Banner de Salvaguardas Institucionales */}
          <div className="p-4 rounded-2xl bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <p className="font-bold text-emerald-200">
                Garantía Normativa de Acceso Territorial UATP:
              </p>
              <p className="text-emerald-300/90 leading-relaxed">
                Los <strong>Super Usuarios</strong>, <strong>Subdirector UATP</strong>, <strong>Coordinadores UATP</strong> y <strong>Asesores UATP</strong> están blindados por diseño del sistema. Sus sesiones continuarán activas ininterrumpidamente para conducir la revisión, auditoría y balance de dotaciones.
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {rolesProtegidos.map(r => (
                  <span
                    key={r.rol}
                    className="px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                  >
                    ✓ {r.nombre} ({r.activos} activos)
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Estamentos Escolares Pausables */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-blue-400" />
                Estamentos Escolares Susceptibles de Pausa
              </label>
              <span className="text-[11px] text-slate-400">
                Selecciona uno o más para aplicar la acción
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {rolesPausables.map(r => {
                const seleccionada = estamentosSeleccionados.includes(r.rol);
                const enPausa = estadoPausa?.activa && estadoPausa.rolesAfectados.includes(r.rol);

                return (
                  <div
                    key={r.rol}
                    onClick={() => toggleSeleccion(r.rol)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      seleccionada
                        ? 'bg-slate-800/90 border-blue-500/70 shadow-lg shadow-blue-950/40 ring-1 ring-blue-500/40'
                        : 'bg-slate-900/80 border-slate-700/60 hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={seleccionada}
                          onChange={() => {}} // Manejado por onClick del contenedor
                          className="w-4 h-4 rounded text-blue-600 focus:ring-0 bg-slate-950 border-slate-700 cursor-pointer"
                        />
                        <div>
                          <h4 className="text-sm font-bold text-white leading-tight">
                            {r.nombre}
                          </h4>
                          <span className="text-[11px] text-slate-400">
                            Estamento Escolar ({r.total} usuarios)
                          </span>
                        </div>
                      </div>
                      {enPausa ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                          <PauseCircle className="w-3 h-3" /> Pausado
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Activo
                        </span>
                      )}
                    </div>

                    <div className="mt-3 pt-3 border-t border-slate-700/60 grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-slate-950/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-medium">Activos</span>
                        <span className="text-sm font-black text-emerald-400 tabular-nums">
                          {r.activos}
                        </span>
                      </div>
                      <div className="bg-slate-950/60 p-2 rounded-xl">
                        <span className="text-[10px] text-slate-400 block font-medium">Pausados / Inactivos</span>
                        <span className={`text-sm font-black tabular-nums ${r.inactivos > 0 ? 'text-amber-400' : 'text-slate-500'}`}>
                          {r.inactivos}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Motivo de la Pausa */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-amber-400" />
              Motivo Visible para los Usuarios (Revisión Interna)
            </label>
            <input
              type="text"
              value={motivoPausa}
              onChange={e => setMotivoPausa(e.target.value)}
              placeholder="Ej. Revisión técnica interna territorial UATP 2027..."
              className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <p className="text-[11px] text-slate-400">
              Este mensaje se mostrará a los directores cuando su sesión sea cerrada o intenten ingresar durante la revisión.
            </p>
          </div>

          {/* Información del Estado Actual si hay Pausa */}
          {hayPausaGlobal && (
            <div className="p-3.5 rounded-2xl bg-amber-950/40 border border-amber-800/50 text-xs text-amber-300 space-y-1">
              <p className="font-bold flex items-center gap-1.5 text-amber-200">
                <Clock className="w-4 h-4 text-amber-400" />
                Pausa de Revisión Interna actualmente en vigor:
              </p>
              <p className="text-amber-300/90 text-[11px]">
                Activada por: <strong>{estadoPausa?.activadoPor || 'Super Usuario'}</strong> el {estadoPausa?.fechaActivacion ? new Date(estadoPausa.fechaActivacion).toLocaleString('es-CL') : 'N/A'}.
              </p>
              <p className="text-amber-300/90 text-[11px]">
                Estamentos afectados: {estadoPausa?.rolesAfectados.join(', ')}.
              </p>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="p-6 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          {/* Acciones de Reactivación */}
          <div className="flex items-center gap-2">
            {hayPausaGlobal && (
              <button
                type="button"
                onClick={handleReactivarTodos}
                disabled={ejecutando}
                className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-emerald-300 bg-emerald-950/60 hover:bg-emerald-900/60 border border-emerald-700/60 rounded-xl transition"
                title="Reanudar el acceso para todos los estamentos"
              >
                <PlayCircle className="w-4 h-4 text-emerald-400" />
                <span>Reactivar Todo el Acceso Escolar</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleReactivarSeleccionados()}
              disabled={ejecutando || estamentosSeleccionados.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${ejecutando ? 'animate-spin' : ''}`} />
              <span>Reactivar Seleccionados</span>
            </button>
          </div>

          {/* Acciones de Pausa */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePausarSeleccionados}
              disabled={ejecutando || estamentosSeleccionados.length === 0}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-xl shadow-md shadow-rose-950/50 transition border border-rose-500/40 disabled:opacity-50"
            >
              <PauseCircle className="w-4 h-4" />
              <span>Pausar Estamentos Seleccionados</span>
            </button>

            <button
              type="button"
              onClick={handlePausarTodosEscolares}
              disabled={ejecutando}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-black text-white bg-gradient-to-r from-rose-700 to-amber-700 hover:from-rose-600 hover:to-amber-600 rounded-xl shadow-lg shadow-rose-950/60 transition border border-rose-500/50"
              title="Congelar inmediatamente a Directores y Jefes UTP para revisión UATP"
            >
              <ShieldAlert className="w-4 h-4 text-amber-300" />
              <span>Pausar Todos los Colegios</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
