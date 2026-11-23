import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowRightLeft,
  Check,
  CheckCircle2,
  Clock,
  FileCheck,
  Filter,
  RefreshCw,
  Scale,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  X,
  XCircle
} from 'lucide-react';
import {
  Establecimiento,
  EstadoRevisionSolicitudDotacion,
  SolicitudMovimientoDotacion,
  TipoMovimientoDotacion
} from '../../types';
import { AuthSession } from '../../types/authTypes';
import { usePermisos } from '../../security/PermisosContext';
import {
  derivarSolicitudAMesaMovilidad,
  listarSolicitudesMovimientoDotacion,
  sancionarSolicitudDotacion,
  visarTecnicoSolicitudDotacion
} from '../../services/solicitudesDotacionService';

export interface BandejaSolicitudesGdpPanelProps {
  periodoActivo: number;
  establecimientos: Establecimiento[];
  usuarioActual?: AuthSession['usuario'] | null;
  onDatosActualizados?: () => Promise<void> | void;
  onIrAMesaMovilidad?: () => void;
}

const ETIQUETA_TIPO: Record<TipoMovimientoDotacion, { label: string; cls: string }> = {
  AUMENTO_HORAS: { label: 'Aumento Horas', cls: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
  DISMINUCION_HORAS: { label: 'Disminución Horas', cls: 'bg-amber-100 text-amber-900 border-amber-200' },
  NO_CONTINUIDAD: { label: 'No Continuidad', cls: 'bg-rose-100 text-rose-900 border-rose-200' },
  CONTRATO_NUEVO: { label: 'Nuevo', cls: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
  CAMBIO_FUENTE: { label: 'Cambio Fuente', cls: 'bg-sky-100 text-sky-900 border-sky-200' },
  ACOGIMIENTO_ART_69: { label: 'Art. 69 (Ley 19.070)', cls: 'bg-purple-100 text-purple-900 border-purple-300' }
};

const ETIQUETA_ESTADO: Record<EstadoRevisionSolicitudDotacion, { label: string; cls: string }> = {
  PENDIENTE: { label: 'Pendiente', cls: 'bg-amber-50 text-amber-800 border-amber-300' },
  EN_REVISION_UATP: { label: 'En Revisión UATP', cls: 'bg-sky-50 text-sky-800 border-sky-300' },
  VISADO_UATP: { label: 'Visado UATP', cls: 'bg-indigo-50 text-indigo-800 border-indigo-300' },
  APROBADO: { label: 'Aprobado', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
  APROBADO_PARCIAL: { label: 'Aprobado Parcial', cls: 'bg-cyan-100 text-cyan-900 border-cyan-300' },
  RECHAZADO: { label: 'Rechazado', cls: 'bg-rose-100 text-rose-900 border-rose-300' },
  DERIVADO_MOVILIDAD: { label: 'Derivado a Movilidad', cls: 'bg-violet-100 text-violet-900 border-violet-300' }
};

export const BandejaSolicitudesGdpPanel: React.FC<BandejaSolicitudesGdpPanelProps> = ({
  periodoActivo,
  establecimientos,
  usuarioActual,
  onDatosActualizados,
  onIrAMesaMovilidad
}) => {
  const { can } = usePermisos();
  const puedeVisarUatp = can('solicitudes_dotacion.editar');
  const puedeSancionarGdp = can('solicitudes_dotacion.ejecutar');

  const [solicitudes, setSolicitudes] = useState<SolicitudMovimientoDotacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'TODOS' | TipoMovimientoDotacion>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'ABIERTAS' | EstadoRevisionSolicitudDotacion>('ABIERTAS');
  const [filtroComuna, setFiltroComuna] = useState('TODAS');
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);

  const [modalSancion, setModalSancion] = useState<{
    sol: SolicitudMovimientoDotacion;
    decision: 'APROBADO' | 'APROBADO_PARCIAL' | 'RECHAZADO' | 'VISADO_UATP';
    horasAprobadas: number;
    observacion: string;
  } | null>(null);

  const colegiosByRbd = useMemo(() => new Map(establecimientos.map(e => [e.rbd, e])), [establecimientos]);
  const comunas = useMemo(
    () => Array.from(new Set(establecimientos.map(e => e.comuna).filter(Boolean))).sort(),
    [establecimientos]
  );

  const actorNombre = usuarioActual?.email || usuarioActual?.nombreCompleto || 'nivel_central';
  const rolActor = usuarioActual?.role;

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const lista = await listarSolicitudesMovimientoDotacion({ periodo: periodoActivo });
      setSolicitudes(lista);
    } catch (err: any) {
      setFeedback({ tipo: 'error', texto: err?.message || 'Error cargando solicitudes de dotación.' });
    } finally {
      setCargando(false);
    }
  }, [periodoActivo]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const kpis = useMemo(() => {
    let pendientes = 0;
    let visadas = 0;
    let aprobadas = 0;
    let rechazadas = 0;
    let art69Pendientes = 0;

    for (const s of solicitudes) {
      if (s.estadoRevision === 'PENDIENTE' || s.estadoRevision === 'EN_REVISION_UATP') {
        pendientes++;
        if (s.tipoMovimiento === 'ACOGIMIENTO_ART_69') art69Pendientes++;
      } else if (s.estadoRevision === 'VISADO_UATP') {
        visadas++;
        if (s.tipoMovimiento === 'ACOGIMIENTO_ART_69') art69Pendientes++;
      } else if (
        s.estadoRevision === 'APROBADO' ||
        s.estadoRevision === 'APROBADO_PARCIAL' ||
        s.estadoRevision === 'DERIVADO_MOVILIDAD'
      ) {
        aprobadas++;
      } else if (s.estadoRevision === 'RECHAZADO') {
        rechazadas++;
      }
    }

    return { total: solicitudes.length, pendientes, visadas, aprobadas, rechazadas, art69Pendientes };
  }, [solicitudes]);

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return solicitudes.filter(s => {
      if (filtroTipo !== 'TODOS' && s.tipoMovimiento !== filtroTipo) return false;
      if (filtroEstado === 'ABIERTAS') {
        if (!['PENDIENTE', 'EN_REVISION_UATP', 'VISADO_UATP'].includes(s.estadoRevision)) return false;
      } else if (filtroEstado !== 'TODOS' && s.estadoRevision !== filtroEstado) {
        return false;
      }
      const comuna = s.comuna || colegiosByRbd.get(s.rbd)?.comuna || '';
      if (filtroComuna !== 'TODAS' && comuna !== filtroComuna) return false;
      if (!q) return true;
      const nombreEst = s.nombreEstablecimiento || colegiosByRbd.get(s.rbd)?.nombre || '';
      return `${s.nombreFuncionario} ${s.runFuncionario} ${s.rbd} ${nombreEst} ${s.justificacionEscuela} ${s.cargoOAsignatura || ''}`
        .toLowerCase()
        .includes(q);
    });
  }, [solicitudes, filtroTipo, filtroEstado, filtroComuna, busqueda, colegiosByRbd]);

  const handleConfirmarModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalSancion) return;
    const { sol, decision, horasAprobadas, observacion } = modalSancion;
    setProcesandoId(sol.id);
    setFeedback(null);
    try {
      if (decision === 'VISADO_UATP') {
        await visarTecnicoSolicitudDotacion({
          id: sol.id,
          estadoDestino: 'VISADO_UATP',
          observacionUatp: observacion,
          usuarioActor: actorNombre,
          rolActor
        });
        setFeedback({ tipo: 'success', texto: `Solicitud de ${sol.nombreFuncionario} visada técnicamente por UATP.` });
      } else {
        await sancionarSolicitudDotacion({
          id: sol.id,
          decision,
          horasAprobadas,
          observacionSancion: observacion,
          usuarioActor: actorNombre,
          rolActor,
          puedeSancionar: puedeSancionarGdp
        });
        setFeedback({
          tipo: 'success',
          texto: `Sanción ${decision} aplicada a ${sol.nombreFuncionario} y reflejada en nómina.`
        });
      }
      setModalSancion(null);
      await cargar();
      if (onDatosActualizados) await onDatosActualizados();
    } catch (err: any) {
      setFeedback({ tipo: 'error', texto: err?.message || 'Error procesando solicitud.' });
    } finally {
      setProcesandoId(null);
    }
  };

  const handleDerivarMovilidad = async (sol: SolicitudMovimientoDotacion) => {
    setProcesandoId(sol.id);
    setFeedback(null);
    try {
      await derivarSolicitudAMesaMovilidad({
        id: sol.id,
        usuarioActor: actorNombre,
        rolActor
      });
      await cargar();
      if (onDatosActualizados) await onDatosActualizados();
      setFeedback({
        tipo: 'success',
        texto: `${sol.nombreFuncionario} derivado a la Mesa de Movilidad para calce territorial.`
      });
    } catch (err: any) {
      setFeedback({ tipo: 'error', texto: err?.message || 'Error derivando a Mesa de Movilidad.' });
    } finally {
      setProcesandoId(null);
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between ${
            feedback.tipo === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <span>{feedback.texto}</span>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-amber-800">Pendientes Revisión</div>
          <div className="text-2xl font-black text-amber-900 tabular-nums mt-0.5">{kpis.pendientes}</div>
          <div className="text-[10px] text-amber-700">Requieren análisis UATP/GDP</div>
        </div>
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-indigo-800">Visadas UATP</div>
          <div className="text-2xl font-black text-indigo-900 tabular-nums mt-0.5">{kpis.visadas}</div>
          <div className="text-[10px] text-indigo-700">Listas para sanción GDP</div>
        </div>
        <div className="bg-purple-50/80 border border-purple-200 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-purple-800">Art. 69 Pendientes</div>
          <div className="text-2xl font-black text-purple-900 tabular-nums mt-0.5">{kpis.art69Pendientes}</div>
          <div className="text-[10px] text-purple-700">Reducción 24h crono aula</div>
        </div>
        <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-emerald-800">Aprobadas / Derivadas</div>
          <div className="text-2xl font-black text-emerald-900 tabular-nums mt-0.5">{kpis.aprobadas}</div>
          <div className="text-[10px] text-emerald-700">Aplicadas a nómina</div>
        </div>
        <div className="bg-rose-50/80 border border-rose-200 rounded-xl p-3.5">
          <div className="text-[10px] font-bold uppercase text-rose-800">Rechazadas</div>
          <div className="text-2xl font-black text-rose-900 tabular-nums mt-0.5">{kpis.rechazadas}</div>
          <div className="text-[10px] text-rose-700">Línea base restaurada</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span>Bandeja de Solicitudes GDP, Aumentos/Disminuciones y Art. 69 ({filtradas.length})</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void cargar()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${cargando ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            {onIrAMesaMovilidad && (
              <button
                type="button"
                onClick={onIrAMesaMovilidad}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Ir a Mesa de Movilidad</span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar funcionario, RUN, RBD o escuela..."
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white"
            />
          </div>

          <select
            value={filtroEstado}
            onChange={e => setFiltroEstado(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white font-semibold"
          >
            <option value="ABIERTAS">Abiertas (Pendientes / Visadas UATP)</option>
            <option value="TODOS">Todos los Estados</option>
            <option value="PENDIENTE">Pendiente</option>
            <option value="VISADO_UATP">Visado UATP</option>
            <option value="APROBADO">Aprobado</option>
            <option value="APROBADO_PARCIAL">Aprobado Parcial</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="DERIVADO_MOVILIDAD">Derivado a Movilidad</option>
          </select>

          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value as any)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white font-semibold"
          >
            <option value="TODOS">Todos los Tipos de Movimiento</option>
            <option value="AUMENTO_HORAS">Aumento de Horas</option>
            <option value="DISMINUCION_HORAS">Disminución de Horas</option>
            <option value="ACOGIMIENTO_ART_69">Acogimiento Art. 69 (Ley 19.070)</option>
            <option value="NO_CONTINUIDAD">No Continuidad</option>
            <option value="CONTRATO_NUEVO">Contrato Nuevo</option>
            <option value="CAMBIO_FUENTE">Cambio de Fuente</option>
          </select>

          <select
            value={filtroComuna}
            onChange={e => setFiltroComuna(e.target.value)}
            className="px-3 py-1.5 text-xs border border-slate-300 rounded-xl bg-white font-semibold"
          >
            <option value="TODAS">Todas las Comunas</option>
            {comunas.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto border border-slate-200 rounded-xl">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3">Establecimiento</th>
                <th className="p-3">Funcionario</th>
                <th className="p-3">Tipo Solicitud</th>
                <th className="p-3 text-center">Variación Horaria</th>
                <th className="p-3">Justificación / Observaciones</th>
                <th className="p-3">Estado</th>
                <th className="p-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtradas.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-400 text-xs">
                    {cargando
                      ? 'Cargando solicitudes...'
                      : 'No hay solicitudes que coincidan con los filtros seleccionados.'}
                  </td>
                </tr>
              ) : (
                filtradas.map(sol => {
                  const est = colegiosByRbd.get(sol.rbd);
                  const tipoMeta = ETIQUETA_TIPO[sol.tipoMovimiento];
                  const estadoMeta = ETIQUETA_ESTADO[sol.estadoRevision];
                  const esAbierta = ['PENDIENTE', 'EN_REVISION_UATP', 'VISADO_UATP'].includes(sol.estadoRevision);

                  return (
                    <tr key={sol.id} className="hover:bg-slate-50/80 align-top">
                      <td className="p-3">
                        <div className="font-bold text-slate-900">{sol.nombreEstablecimiento || est?.nombre || `RBD ${sol.rbd}`}</div>
                        <div className="text-[10px] text-slate-500">
                          RBD {sol.rbd} · {sol.comuna || est?.comuna || ''}
                        </div>
                      </td>

                      <td className="p-3">
                        <div className="font-bold text-slate-900">{sol.nombreFuncionario}</div>
                        <div className="text-[10px] font-mono text-slate-500">
                          {sol.runFuncionario} · {sol.entidadTipo} {sol.calidadJuridica ? `· ${sol.calidadJuridica}` : ''}
                        </div>
                        {sol.cargoOAsignatura && (
                          <div className="text-[10px] text-slate-600 mt-0.5">{sol.cargoOAsignatura}</div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold border ${tipoMeta.cls}`}>
                          {sol.tipoMovimiento === 'ACOGIMIENTO_ART_69' && <Scale className="w-3 h-3" />}
                          {tipoMeta.label}
                        </span>
                      </td>

                      <td className="p-3 text-center tabular-nums">
                        {sol.tipoMovimiento === 'ACOGIMIENTO_ART_69' ? (
                          <div className="text-[11px] font-bold text-purple-900">
                            Tope 24h crono (32 HA)
                            <div className="text-[10px] font-normal text-slate-500">Contrato: {sol.horasSolicitadas}h</div>
                          </div>
                        ) : (
                          <div>
                            <span className="text-slate-500">{sol.horasVigentes}h</span>
                            <span className="mx-1">→</span>
                            <span className="font-black text-slate-900">{sol.horasSolicitadas}h</span>
                            <div
                              className={`text-[10px] font-bold ${
                                sol.deltaHoras > 0
                                  ? 'text-emerald-700'
                                  : sol.deltaHoras < 0
                                  ? 'text-amber-700'
                                  : 'text-slate-500'
                              }`}
                            >
                              {sol.deltaHoras > 0 ? `+${sol.deltaHoras}h` : `${sol.deltaHoras}h`}
                              {sol.horasAprobadas !== undefined && sol.horasAprobadas !== null && (
                                <span className="ml-1 text-indigo-700">(Aprob: {sol.horasAprobadas}h)</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      <td className="p-3 max-w-xs">
                        <p className="text-slate-700 text-[11px] line-clamp-2">{sol.justificacionEscuela}</p>
                        {sol.observacionUatp && (
                          <div className="text-[10px] text-indigo-700 mt-1">
                            <strong>UATP:</strong> {sol.observacionUatp}
                          </div>
                        )}
                        {sol.observacionSancion && (
                          <div className="text-[10px] text-slate-700 mt-0.5">
                            <strong>Sanción:</strong> {sol.observacionSancion}
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-lg text-[10px] font-bold border ${estadoMeta.cls}`}>
                          {estadoMeta.label}
                        </span>
                      </td>

                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {esAbierta && puedeVisarUatp && sol.estadoRevision !== 'VISADO_UATP' && (
                            <button
                              type="button"
                              disabled={procesandoId === sol.id}
                              onClick={() =>
                                setModalSancion({
                                  sol,
                                  decision: 'VISADO_UATP',
                                  horasAprobadas: sol.horasSolicitadas,
                                  observacion: ''
                                })
                              }
                              className="px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold"
                            >
                              Visar UATP
                            </button>
                          )}

                          {esAbierta && puedeSancionarGdp && (
                            <>
                              <button
                                type="button"
                                disabled={procesandoId === sol.id}
                                onClick={() =>
                                  setModalSancion({
                                    sol,
                                    decision: 'APROBADO',
                                    horasAprobadas: sol.horasSolicitadas,
                                    observacion: 'Aprobado conforme a evaluación técnica y presupuestaria.'
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                Aprobar
                              </button>
                              {sol.tipoMovimiento !== 'ACOGIMIENTO_ART_69' && (
                                <button
                                  type="button"
                                  disabled={procesandoId === sol.id}
                                  onClick={() =>
                                    setModalSancion({
                                      sol,
                                      decision: 'APROBADO_PARCIAL',
                                      horasAprobadas: sol.horasSolicitadas,
                                      observacion: ''
                                    })
                                  }
                                  className="px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold"
                                >
                                  Parcial
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={procesandoId === sol.id}
                                onClick={() =>
                                  setModalSancion({
                                    sol,
                                    decision: 'RECHAZADO',
                                    horasAprobadas: sol.horasVigentes,
                                    observacion: ''
                                  })
                                }
                                className="px-2 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3 h-3" />
                                Rechazar
                              </button>
                            </>
                          )}

                          {sol.tipoMovimiento === 'NO_CONTINUIDAD' &&
                            sol.estadoRevision !== 'DERIVADO_MOVILIDAD' &&
                            sol.estadoRevision !== 'RECHAZADO' && (
                              <button
                                type="button"
                                disabled={procesandoId === sol.id}
                                onClick={() => void handleDerivarMovilidad(sol)}
                                className="px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-[10px] font-bold inline-flex items-center gap-1"
                              >
                                <ArrowRightLeft className="w-3 h-3" />
                                Derivar Movilidad
                              </button>
                            )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Visación / Sanción */}
      {modalSancion && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-100 pb-2">
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  {modalSancion.decision === 'VISADO_UATP'
                    ? 'Visación Técnica UATP'
                    : `Sanción GDP: ${modalSancion.decision.replace('_', ' ')}`}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {modalSancion.sol.nombreFuncionario} ({modalSancion.sol.runFuncionario}) ·{' '}
                  {ETIQUETA_TIPO[modalSancion.sol.tipoMovimiento].label}
                </p>
              </div>
              <button type="button" onClick={() => setModalSancion(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmarModal} className="space-y-3 text-xs">
              {modalSancion.decision === 'APROBADO_PARCIAL' && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Horas Aprobadas Definitivas (0 - 44 hrs)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={44}
                    required
                    value={modalSancion.horasAprobadas}
                    onChange={e =>
                      setModalSancion(s => (s ? { ...s, horasAprobadas: Number(e.target.value) } : s))
                    }
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl font-bold"
                  />
                </div>
              )}

              {modalSancion.decision === 'RECHAZADO' && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-[11px]">
                  Al rechazar, la ficha volverá a su línea base previa ({modalSancion.sol.horasVigentes}h
                  {modalSancion.sol.tipoMovimiento === 'ACOGIMIENTO_ART_69' ? ' y Art. 69 desactivado' : ''}) y la escuela verá tu observación.
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Observación / Fundamento{' '}
                  {modalSancion.decision === 'RECHAZADO' || modalSancion.decision === 'APROBADO_PARCIAL'
                    ? '*'
                    : '(opcional)'}
                </label>
                <textarea
                  rows={3}
                  required={modalSancion.decision === 'RECHAZADO' || modalSancion.decision === 'APROBADO_PARCIAL'}
                  value={modalSancion.observacion}
                  onChange={e => setModalSancion(s => (s ? { ...s, observacion: e.target.value } : s))}
                  placeholder="Ingresa fundamento técnico, presupuestario o normativo..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalSancion(null)}
                  className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 font-bold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={procesandoId === modalSancion.sol.id}
                  className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:opacity-50"
                >
                  {procesandoId === modalSancion.sol.id ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
