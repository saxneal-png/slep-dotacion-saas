import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  Lock,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  X
} from 'lucide-react';
import {
  Docente,
  Establecimiento,
  EstadoNecesidadVacante,
  EstamentoDocente,
  RegistroMovimientoMovilidad
} from '../types';
import { ESTAMENTOS } from '../components/DocenteFormModal';
import { usePermisos } from '../security/PermisosContext';
import {
  actualizarNecesidadVacanteEscuela,
  cancelarNecesidadVacanteEscuela,
  crearNecesidadVacanteEscuela,
  listarNecesidadesVacanteEscuela,
  listarRegistroMovimientosMovilidad,
  obtenerVacantesConPropuestaActiva,
  retrotraerNecesidadDeMovilidad,
  enviarNecesidadAMovilidad
} from '../services/movilidadTerritorialService';

export interface NecesidadesDocentesViewProps {
  colegio: Establecimiento;
  periodoActivo: number;
  usuarioActor?: string;
  rolActor?: string;
  onRefreshData: () => Promise<void>;
}

type FiltroEstadoNecesidad = 'TODAS' | 'BORRADOR' | 'ENVIADA' | 'CANCELADA';

function obtenerFuenteVacanteDocente(d: Docente): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' {
  if ((d.horasPieContrata || 0) > 0 || (d.horasPieTitular || 0) > 0) return 'PIE';
  if ((d.horasSepContrata || 0) > 0 || (d.horasSepTitular || 0) > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function obtenerEstadoEfectivo(d: Docente): EstadoNecesidadVacante {
  if (d.estadoNecesidad) return d.estadoNecesidad;
  if (d.situacionFinalGdp === 'Cancelada') return 'CANCELADA';
  return 'ENVIADA';
}

const ETIQUETA_FUENTE: Record<'SUBVENCION_GENERAL' | 'SEP' | 'PIE', string> = {
  SUBVENCION_GENERAL: 'Subvención General',
  SEP: 'SEP',
  PIE: 'PIE (Dto. 170)'
};

const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  CREACION_NECESIDAD: 'Creación',
  EDICION_NECESIDAD: 'Edición',
  ENVIO_MOVILIDAD: 'Envío a Movilidad',
  RETROCESO_NECESIDAD: 'Retroceso a Borrador',
  CANCELACION_NECESIDAD: 'Cancelación'
};

export const NecesidadesDocentesView: React.FC<NecesidadesDocentesViewProps> = ({
  colegio,
  periodoActivo,
  usuarioActor = 'establecimiento',
  rolActor,
  onRefreshData
}) => {
  const { can } = usePermisos();
  const puedeEditarNecesidades = can('necesidades_docentes.editar');
  const [necesidades, setNecesidades] = useState<Docente[]>([]);
  const [bloqueadasEnMesa, setBloqueadasEnMesa] = useState<Set<string>>(new Set());
  const [movimientos, setMovimientos] = useState<RegistroMovimientoMovilidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoNecesidad>('TODAS');
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  // Modal Crear / Editar
  const [modalForm, setModalForm] = useState<{
    open: boolean;
    editingId: string | null;
    especialidad: string;
    estamento: EstamentoDocente;
    horas: number;
    fuente: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
    justificacion: string;
    guardando: boolean;
    error: string | null;
  }>({
    open: false,
    editingId: null,
    especialidad: '',
    estamento: 'DOCENTE_AULA',
    horas: 22,
    fuente: 'SUBVENCION_GENERAL',
    justificacion: '',
    guardando: false,
    error: null
  });

  // Modal Motivo (Retrotraer o Cancelar)
  const [modalMotivo, setModalMotivo] = useState<{
    open: boolean;
    tipo: 'RETROTRAER' | 'CANCELAR';
    necesidad: Docente | null;
    motivo: string;
    procesando: boolean;
    error: string | null;
  }>({
    open: false,
    tipo: 'RETROTRAER',
    necesidad: null,
    motivo: '',
    procesando: false,
    error: null
  });

  const mostrarFeedback = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setFeedback({ tipo, mensaje });
    setTimeout(() => setFeedback(null), 5500);
  };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await listarNecesidadesVacanteEscuela(colegio.rbd, periodoActivo);
      setNecesidades(lista);
      const ids = lista.map(d => d.id);
      const [enMesa, regs] = await Promise.all([
        obtenerVacantesConPropuestaActiva(ids, periodoActivo),
        listarRegistroMovimientosMovilidad({ rbd: colegio.rbd, periodo: periodoActivo, limit: 60 })
      ]);
      setBloqueadasEnMesa(enMesa);
      setMovimientos(regs.filter(r => r.entidad === 'NECESIDAD_VACANTE'));
    } catch (err: any) {
      mostrarFeedback(err?.message || 'Error cargando necesidades docentes.', 'error');
    } finally {
      setCargando(false);
    }
  }, [colegio.rbd, periodoActivo]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const resumen = useMemo(() => {
    let borradores = 0;
    let horasBorrador = 0;
    let enviadas = 0;
    let horasEnviadas = 0;
    let enGestion = 0;
    let canceladas = 0;
    for (const n of necesidades) {
      const est = obtenerEstadoEfectivo(n);
      if (est === 'BORRADOR') {
        borradores++;
        horasBorrador += n.horasContrato || 0;
      } else if (est === 'ENVIADA') {
        enviadas++;
        horasEnviadas += n.horasContrato || 0;
        if (bloqueadasEnMesa.has(n.id)) enGestion++;
      } else {
        canceladas++;
      }
    }
    return { borradores, horasBorrador, enviadas, horasEnviadas, enGestion, canceladas };
  }, [necesidades, bloqueadasEnMesa]);

  const necesidadesFiltradas = useMemo(() => {
    if (filtroEstado === 'TODAS') return necesidades;
    return necesidades.filter(n => obtenerEstadoEfectivo(n) === filtroEstado);
  }, [necesidades, filtroEstado]);

  // Poka-Yoke: detectar posible duplicado al crear
  const posibleDuplicado = useMemo(() => {
    if (!modalForm.open || modalForm.editingId) return null;
    const espNorm = modalForm.especialidad.trim().toLowerCase();
    if (!espNorm) return null;
    return (
      necesidades.find(n => {
        const est = obtenerEstadoEfectivo(n);
        if (est === 'CANCELADA') return false;
        const nEsp = (n.asignaturaPrincipal || n.apellidos || '').trim().toLowerCase();
        return nEsp === espNorm && obtenerFuenteVacanteDocente(n) === modalForm.fuente;
      }) || null
    );
  }, [modalForm.open, modalForm.editingId, modalForm.especialidad, modalForm.fuente, necesidades]);

  const abrirModalCrear = () => {
    setModalForm({
      open: true,
      editingId: null,
      especialidad: '',
      estamento: 'DOCENTE_AULA',
      horas: 22,
      fuente: 'SUBVENCION_GENERAL',
      justificacion: '',
      guardando: false,
      error: null
    });
  };

  const abrirModalEditar = (n: Docente) => {
    setModalForm({
      open: true,
      editingId: n.id,
      especialidad: n.asignaturaPrincipal || n.apellidos || '',
      estamento: n.estamento,
      horas: n.horasContrato,
      fuente: obtenerFuenteVacanteDocente(n),
      justificacion: n.justificacionVacante || '',
      guardando: false,
      error: null
    });
  };

  const handleGuardarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.especialidad.trim()) {
      setModalForm(s => ({ ...s, error: 'Ingresa la especialidad o asignatura requerida.' }));
      return;
    }
    const horasNum = Math.round(Number(modalForm.horas));
    if (!Number.isFinite(horasNum) || horasNum < 1 || horasNum > 44) {
      setModalForm(s => ({ ...s, error: 'Las horas deben estar entre 1 y 44.' }));
      return;
    }
    if (!modalForm.justificacion.trim()) {
      setModalForm(s => ({ ...s, error: 'La justificación pedagógica u operativa es obligatoria.' }));
      return;
    }

    setModalForm(s => ({ ...s, guardando: true, error: null }));
    try {
      if (modalForm.editingId) {
        await actualizarNecesidadVacanteEscuela({
          id: modalForm.editingId,
          rbd: colegio.rbd,
          periodo: periodoActivo,
          especialidad: modalForm.especialidad.trim(),
          estamento: modalForm.estamento,
          horasContrato: horasNum,
          fuenteFinanciamiento: modalForm.fuente,
          justificacion: modalForm.justificacion.trim(),
          usuarioActor,
          rolActor,
          nombreEstablecimiento: colegio.nombre,
          comuna: colegio.comuna
        });
        mostrarFeedback('Necesidad actualizada en borrador.');
      } else {
        await crearNecesidadVacanteEscuela({
          rbd: colegio.rbd,
          periodo: periodoActivo,
          especialidad: modalForm.especialidad.trim(),
          estamento: modalForm.estamento,
          horasContrato: horasNum,
          fuenteFinanciamiento: modalForm.fuente,
          justificacion: modalForm.justificacion.trim(),
          usuarioActor,
          rolActor,
          nombreEstablecimiento: colegio.nombre,
          comuna: colegio.comuna,
          estadoInicial: 'BORRADOR'
        });
        mostrarFeedback('Necesidad guardada en Borrador. Revísala y presiona "Enviar a Movilidad" cuando esté lista.');
      }
      setModalForm(s => ({ ...s, open: false, guardando: false }));
      await onRefreshData();
      await cargarDatos();
    } catch (err: any) {
      setModalForm(s => ({
        ...s,
        guardando: false,
        error: err?.message || 'Error guardando la necesidad.'
      }));
    }
  };

  const handleEnviarAMovilidad = async (n: Docente) => {
    try {
      await enviarNecesidadAMovilidad({
        id: n.id,
        rbd: colegio.rbd,
        periodo: periodoActivo,
        usuarioActor,
        rolActor,
        nombreEstablecimiento: colegio.nombre,
        comuna: colegio.comuna
      });
      await onRefreshData();
      await cargarDatos();
      mostrarFeedback(`Necesidad ${n.run} enviada a la Mesa de Movilidad SLEP.`);
    } catch (err: any) {
      mostrarFeedback(err?.message || 'Error enviando necesidad a Movilidad.', 'error');
    }
  };

  const handleConfirmarMotivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMotivo.necesidad) return;
    if (!modalMotivo.motivo.trim()) {
      setModalMotivo(s => ({ ...s, error: 'Debes ingresar un motivo para dejar registro.' }));
      return;
    }

    setModalMotivo(s => ({ ...s, procesando: true, error: null }));
    try {
      if (modalMotivo.tipo === 'RETROTRAER') {
        await retrotraerNecesidadDeMovilidad({
          id: modalMotivo.necesidad.id,
          rbd: colegio.rbd,
          motivo: modalMotivo.motivo.trim(),
          periodo: periodoActivo,
          usuarioActor,
          rolActor,
          nombreEstablecimiento: colegio.nombre,
          comuna: colegio.comuna
        });
        mostrarFeedback(`Necesidad ${modalMotivo.necesidad.run} retrotraída a Borrador para revisión.`);
      } else {
        await cancelarNecesidadVacanteEscuela({
          id: modalMotivo.necesidad.id,
          rbd: colegio.rbd,
          motivo: modalMotivo.motivo.trim(),
          periodo: periodoActivo,
          usuarioActor,
          rolActor,
          nombreEstablecimiento: colegio.nombre,
          comuna: colegio.comuna
        });
        mostrarFeedback(`Necesidad ${modalMotivo.necesidad.run} cancelada correctamente.`);
      }
      setModalMotivo({ open: false, tipo: 'RETROTRAER', necesidad: null, motivo: '', procesando: false, error: null });
      await onRefreshData();
      await cargarDatos();
    } catch (err: any) {
      setModalMotivo(s => ({
        ...s,
        procesando: false,
        error: err?.message || 'Error procesando la acción.'
      }));
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm ${
            feedback.tipo === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.mensaje}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cabecera */}
      <div className="card-elevated p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Gestión de Necesidades Docentes · {colegio.nombre}</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Revisa tus solicitudes en <strong>Borrador</strong> antes de enviarlas a Movilidad. Si cometiste un error después de enviar, puedes <strong>Retrotraer</strong> o <strong>Cancelar</strong> sin duplicar requerimientos.
          </p>
        </div>
        {puedeEditarNecesidades ? (
          <button
            type="button"
            onClick={abrirModalCrear}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Necesidad Docente</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Solo Lectura</span>
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Borradores (Por Revisar)
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-amber-900">{resumen.borradores}</span>
            <span className="text-[11px] font-semibold text-amber-700">{resumen.horasBorrador}h</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Enviadas a Movilidad
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-emerald-900">{resumen.enviadas}</span>
            <span className="text-[11px] font-semibold text-emerald-700">{resumen.horasEnviadas}h</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
            En Gestión en Mesa
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-indigo-900">{resumen.enGestion}</span>
            <span className="text-[11px] font-semibold text-indigo-700">con propuesta</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Canceladas
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-slate-800">{resumen.canceladas}</span>
            <span className="text-[11px] font-semibold text-slate-500">histórico</span>
          </div>
        </div>
      </div>

      {/* Filtros + Tabla de Necesidades */}
      <div className="card-elevated p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { id: 'TODAS', label: `Todas (${necesidades.length})` },
                { id: 'BORRADOR', label: `Borradores (${resumen.borradores})` },
                { id: 'ENVIADA', label: `Enviadas (${resumen.enviadas})` },
                { id: 'CANCELADA', label: `Canceladas (${resumen.canceladas})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltroEstado(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  filtroEstado === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {cargando ? (
          <div className="p-8 text-center text-xs text-slate-500">Cargando necesidades...</div>
        ) : necesidadesFiltradas.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700">No hay necesidades en esta vista.</p>
            <p>Usa "Nueva Necesidad Docente" para declarar horas vacantes por cubrir.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {necesidadesFiltradas.map(n => {
              const estado = obtenerEstadoEfectivo(n);
              const fuente = obtenerFuenteVacanteDocente(n);
              const enMesa = bloqueadasEnMesa.has(n.id);
              const estamentoLabel = ESTAMENTOS.find(e => e.id === n.estamento)?.label || n.estamento;

              return (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    estado === 'BORRADOR'
                      ? 'bg-amber-50/40 border-amber-300'
                      : estado === 'ENVIADA'
                      ? 'bg-white border-emerald-200'
                      : 'bg-slate-50 border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded bg-slate-900 text-white">
                          {n.run}
                        </span>
                        <span className="font-black text-sm text-slate-900">
                          {n.asignaturaPrincipal || n.apellidos}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 tabular-nums">
                          {n.horasContrato} hrs
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {ETIQUETA_FUENTE[fuente]}
                        </span>
                        <span className="text-[11px] text-slate-500">{estamentoLabel}</span>

                        {estado === 'BORRADOR' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950">
                            <Clock className="w-3 h-3" />
                            Borrador · Por revisar
                          </span>
                        )}
                        {estado === 'ENVIADA' && !enMesa && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900">
                            <CheckCircle2 className="w-3 h-3" />
                            Enviada a Movilidad
                          </span>
                        )}
                        {estado === 'ENVIADA' && enMesa && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                            <Lock className="w-3 h-3" />
                            En Gestión en Mesa de Movilidad
                          </span>
                        )}
                        {estado === 'CANCELADA' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            <Ban className="w-3 h-3" />
                            Cancelada
                          </span>
                        )}
                      </div>

                      {n.justificacionVacante && (
                        <p className="text-xs text-slate-600">
                          <strong>Justificación:</strong> {n.justificacionVacante}
                        </p>
                      )}
                      {n.motivoEstadoNecesidad && (
                        <p className="text-[11px] text-amber-900 bg-amber-100/70 px-2 py-1 rounded-lg inline-block">
                          <strong>Último motivo registrado:</strong> {n.motivoEstadoNecesidad}
                        </p>
                      )}
                    </div>

                    {/* Botones de Acción */}
                    {puedeEditarNecesidades && (
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {estado === 'BORRADOR' && (
                        <>
                          <button
                            type="button"
                            onClick={() => abrirModalEditar(n)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleEnviarAMovilidad(n)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                          >
                            <Send className="w-3.5 h-3.5" />
                            <span>Enviar a Movilidad</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setModalMotivo({
                                open: true,
                                tipo: 'CANCELAR',
                                necesidad: n,
                                motivo: '',
                                procesando: false,
                                error: null
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                        </>
                      )}

                      {estado === 'ENVIADA' && !enMesa && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setModalMotivo({
                                open: true,
                                tipo: 'RETROTRAER',
                                necesidad: n,
                                motivo: '',
                                procesando: false,
                                error: null
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Retrotraer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setModalMotivo({
                                open: true,
                                tipo: 'CANCELAR',
                                necesidad: n,
                                motivo: '',
                                procesando: false,
                                error: null
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Cancelar</span>
                          </button>
                        </>
                      )}

                      {estado === 'ENVIADA' && enMesa && (
                        <span className="text-[11px] text-indigo-800 font-semibold px-2 py-1 bg-indigo-50 rounded-lg border border-indigo-200">
                          Bloqueada: en propuesta/adjudicación UATP
                        </span>
                      )}
                    </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial local de movimientos del establecimiento */}
      <div className="card-elevated p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Registro de Movimientos del Establecimiento ({movimientos.length})
          </h3>
        </div>
        {movimientos.length === 0 ? (
          <p className="text-xs text-slate-500">Aún no hay movimientos registrados en este establecimiento.</p>
        ) : (
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {movimientos.slice(0, 20).map(m => (
              <div key={m.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                      {ETIQUETA_MOVIMIENTO[m.tipoMovimiento] || m.tipoMovimiento}
                    </span>
                    {m.codigoReferencia && (
                      <span className="font-mono text-[10px] font-bold text-indigo-700">
                        {m.codigoReferencia}
                      </span>
                    )}
                    <span className="text-slate-800 font-medium">{m.descripcion}</span>
                  </div>
                  {m.motivo && (
                    <div className="text-[11px] text-slate-500">Motivo: {m.motivo}</div>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 shrink-0 text-right tabular-nums">
                  <div className="font-semibold text-slate-700">{m.usuarioActor}</div>
                  <div>{new Date(m.fechaHora).toLocaleString('es-CL')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar Necesidad */}
      {modalForm.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleGuardarForm}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-sm">
                  {modalForm.editingId ? 'Editar Necesidad en Borrador' : 'Nueva Necesidad de Vacante Docente'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {colegio.nombre} (RBD {colegio.rbd}) · Periodo {periodoActivo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalForm(s => ({ ...s, open: false }))}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {posibleDuplicado && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Posible duplicado detectado:</strong> Ya existe la necesidad{' '}
                  <span className="font-mono font-bold">{posibleDuplicado.run}</span> para{' '}
                  <strong>{posibleDuplicado.asignaturaPrincipal}</strong> ({posibleDuplicado.horasContrato}h). Puedes editarla o retrotraerla en lugar de crear una nueva.
                </div>
              </div>
            )}

            {modalForm.error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {modalForm.error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Especialidad / Asignatura Requerida
                </label>
                <input
                  type="text"
                  required
                  list="sugerencias-especialidad-necesidad"
                  value={modalForm.especialidad}
                  onChange={e => setModalForm(s => ({ ...s, especialidad: e.target.value }))}
                  placeholder="Ej: Matemática, Lenguaje y Comunicación, Educación Diferencial..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="sugerencias-especialidad-necesidad">
                  <option value="Lenguaje y Comunicación" />
                  <option value="Matemática" />
                  <option value="Historia, Geografía y Ciencias Sociales" />
                  <option value="Ciencias Naturales" />
                  <option value="Inglés" />
                  <option value="Educación Física y Salud" />
                  <option value="Artes Visuales / Música" />
                  <option value="Educación General Básica" />
                  <option value="Educación Diferencial (PIE)" />
                  <option value="Educación Parvularia" />
                  <option value="Especialidad Técnico Profesional" />
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Estamento</label>
                  <select
                    value={modalForm.estamento}
                    onChange={e =>
                      setModalForm(s => ({ ...s, estamento: e.target.value as EstamentoDocente }))
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                  >
                    {ESTAMENTOS.map(est => (
                      <option key={est.id} value={est.id}>
                        {est.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Horas Cronológicas Semanales (1 - 44)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={44}
                    required
                    value={modalForm.horas}
                    onChange={e => setModalForm(s => ({ ...s, horas: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fuente de Financiamiento
                </label>
                <select
                  value={modalForm.fuente}
                  onChange={e =>
                    setModalForm(s => ({
                      ...s,
                      fuente: e.target.value as 'SUBVENCION_GENERAL' | 'SEP' | 'PIE'
                    }))
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="SUBVENCION_GENERAL">Subvención General (Plan de Estudio / JEC)</option>
                  <option value="SEP">SEP (Subvención Escolar Preferencial)</option>
                  <option value="PIE">PIE (Programa de Integración Escolar - Dto. 170)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Justificación Pedagógica / Operativa
                </label>
                <textarea
                  rows={3}
                  required
                  value={modalForm.justificacion}
                  onChange={e => setModalForm(s => ({ ...s, justificacion: e.target.value }))}
                  placeholder="Describe la necesidad curricular, aumento de matrícula SAE, cobertura PIE o reemplazo requerido..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalForm(s => ({ ...s, open: false }))}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={modalForm.guardando}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-50"
              >
                {modalForm.guardando
                  ? 'Guardando...'
                  : modalForm.editingId
                  ? 'Guardar Cambios'
                  : 'Guardar en Borrador'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Retrotraer / Cancelar con Motivo */}
      {modalMotivo.open && modalMotivo.necesidad && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmarMotivo}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                {modalMotivo.tipo === 'RETROTRAER'
                  ? 'Retrotraer Necesidad desde Movilidad'
                  : 'Cancelar Necesidad Docente'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMotivo(s => ({ ...s, open: false }))}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {modalMotivo.tipo === 'RETROTRAER'
                ? `La necesidad ${modalMotivo.necesidad.run} (${modalMotivo.necesidad.asignaturaPrincipal}, ${modalMotivo.necesidad.horasContrato}h) saldrá de la Bolsa de Movilidad y volverá a estado Borrador para que puedas corregirla.`
                : `La necesidad ${modalMotivo.necesidad.run} (${modalMotivo.necesidad.asignaturaPrincipal}, ${modalMotivo.necesidad.horasContrato}h) quedará cancelada y no aparecerá en Movilidad.`}
            </p>

            {modalMotivo.error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {modalMotivo.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo (obligatorio para el registro de movimientos)
              </label>
              <textarea
                rows={3}
                required
                value={modalMotivo.motivo}
                onChange={e => setModalMotivo(s => ({ ...s, motivo: e.target.value }))}
                placeholder={
                  modalMotivo.tipo === 'RETROTRAER'
                    ? 'Ej: Error en cantidad de horas o fuente de financiamiento...'
                    : 'Ej: Cobertura resuelta internamente o duplicado...'
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalMotivo(s => ({ ...s, open: false }))}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={modalMotivo.procesando}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm disabled:opacity-50 ${
                  modalMotivo.tipo === 'RETROTRAER'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {modalMotivo.procesando
                  ? 'Procesando...'
                  : modalMotivo.tipo === 'RETROTRAER'
                  ? 'Confirmar Retroceso'
                  : 'Confirmar Cancelación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
