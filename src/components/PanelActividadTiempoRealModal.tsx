import React, { useMemo, useState } from 'react';
import {
  Activity,
  Building2,
  Clock,
  ExternalLink,
  Globe,
  Radio,
  Search,
  UserCheck,
  Users,
  WifiOff,
  X
} from 'lucide-react';
import { Establecimiento } from '../types';
import { getNombreRol, ROLES_DEFINICIONES } from '../security/rolesDefinitions';
import {
  agruparPresenciaPorEstablecimiento,
  PresenciaGlobalUsuario
} from '../services/colaboracionService';

interface PanelActividadTiempoRealModalProps {
  isOpen: boolean;
  onClose: () => void;
  sesiones: PresenciaGlobalUsuario[];
  estadoConexion: 'conectado' | 'conectando' | 'offline';
  colegios: Establecimiento[];
  onIrAEscuela: (est: Establecimiento) => void;
  alcanceUsuario: 'global' | 'equipo' | 'cartera' | 'establecimiento' | null;
}

const ETIQUETAS_VISTA: Record<string, string> = {
  colegios_asesorados: 'Dashboard Territorial',
  cartera: 'Cartera Territorial',
  workflow: 'Espacio Escolar',
  consolidador: 'Consolidado Master',
  estadisticas: 'Estadísticas',
  analizador: 'Analizador de Dotación',
  sige: 'Ingesta SIGE',
  salas_sae: 'Salas & Cupos SAE',
  curriculum: 'Cursos y Currículum',
  planes_estudio: 'Planes de Estudio',
  pie: 'Auditoría PIE',
  docentes: 'Docentes Ley 20.903',
  asistentes: 'Asistentes Educación',
  balanza: 'Balanza & Diagnóstico',
  configuraciones: 'Configuraciones'
};

const ETIQUETAS_APARTADO: Record<string, string> = {
  balanza: 'Balanza',
  jardin_vtf: 'Jardín VTF',
  docentes: 'Docentes',
  asistentes: 'Asistentes',
  cursos: 'Cursos',
  pie: 'PIE',
  salas: 'Salas SAE'
};

function formatearTiempoRelativo(timestamp: number): string {
  const diffSeg = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSeg < 45) return 'Ahora mismo';
  const mins = Math.floor(diffSeg / 60);
  if (mins < 60) return `Hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  return `Hace ${hrs} h`;
}

function iniciales(nombre: string): string {
  const partes = (nombre || 'U').trim().split(/\s+/);
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

export const PanelActividadTiempoRealModal: React.FC<PanelActividadTiempoRealModalProps> = ({
  isOpen,
  onClose,
  sesiones,
  estadoConexion,
  colegios,
  onIrAEscuela,
  alcanceUsuario
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroRol, setFiltroRol] = useState<string>('TODOS');
  const [filtroEstado, setFiltroEstado] = useState<'TODOS' | 'activo' | 'ausente'>('TODOS');

  const colegiosMap = useMemo(() => {
    const map = new Map<string, Establecimiento>();
    colegios.forEach(c => map.set(c.rbd, c));
    return map;
  }, [colegios]);

  const sesionesFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return sesiones.filter(s => {
      if (filtroRol !== 'TODOS' && s.role !== filtroRol) return false;
      if (filtroEstado !== 'TODOS' && s.estado !== filtroEstado) return false;
      if (!q) return true;
      return (
        s.nombreCompleto.toLowerCase().includes(q) ||
        (s.email || '').toLowerCase().includes(q) ||
        (s.rbd || '').toLowerCase().includes(q) ||
        (s.nombreEstablecimiento || '').toLowerCase().includes(q) ||
        (s.comuna || '').toLowerCase().includes(q)
      );
    });
  }, [sesiones, busqueda, filtroRol, filtroEstado]);

  const { porEstablecimiento, enVistasGlobales } = useMemo(
    () => agruparPresenciaPorEstablecimiento(sesionesFiltradas),
    [sesionesFiltradas]
  );

  const resumenGlobal = useMemo(() => {
    const escuelasUnicas = new Set(sesiones.filter(s => s.rbd).map(s => s.rbd));
    const activosAhora = sesiones.filter(s => s.estado === 'activo').length;
    return {
      totalSesiones: sesiones.length,
      activosAhora,
      escuelasActivas: escuelasUnicas.size
    };
  }, [sesiones]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="absolute inset-0" onClick={onClose} aria-hidden="true" />

      <aside className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 bg-slate-50/80 dark:bg-slate-950/60">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 shrink-0">
              <Radio className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-900 dark:text-white truncate">
                  Actividad en Tiempo Real
                </h2>
                {estadoConexion === 'conectado' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    En vivo
                  </span>
                ) : estadoConexion === 'conectando' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                    Conectando...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/30">
                    <WifiOff className="w-3 h-3" />
                    Sin conexión
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {alcanceUsuario === 'global'
                  ? 'Monitoreo global de todas las escuelas y equipos SLEP'
                  : 'Monitoreo en vivo de los establecimientos de tu cartera'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
            aria-label="Cerrar panel de actividad"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2.5 px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Users className="w-3.5 h-3.5 text-sky-500" />
              <span>Conectados</span>
            </div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-slate-900 dark:text-white">
              {resumenGlobal.totalSesiones}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Activity className="w-3.5 h-3.5 text-emerald-500" />
              <span>Activos ahora</span>
            </div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-emerald-600 dark:text-emerald-400">
              {resumenGlobal.activosAhora}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 px-3 py-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              <Building2 className="w-3.5 h-3.5 text-amber-500" />
              <span>Escuelas activas</span>
            </div>
            <div className="mt-0.5 text-xl font-black tabular-nums text-slate-900 dark:text-white">
              {resumenGlobal.escuelasActivas}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="px-5 py-3 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2 bg-slate-50/50 dark:bg-slate-950/30">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar usuario, RBD o escuela..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            />
          </div>

          <select
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value)}
            aria-label="Filtrar por rol"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="TODOS">Todos los roles</option>
            {ROLES_DEFINICIONES.map(r => (
              <option key={r.id} value={r.id}>{r.nombre}</option>
            ))}
          </select>

          <select
            value={filtroEstado}
            onChange={(e) => setFiltroEstado(e.target.value as any)}
            aria-label="Filtrar por estado de actividad"
            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          >
            <option value="TODOS">Todos</option>
            <option value="activo">Activos ahora</option>
            <option value="ausente">Ausentes</option>
          </select>
        </div>

        {/* Contenido */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {estadoConexion === 'offline' ? (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 p-6 text-center">
              <WifiOff className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                Monitor en tiempo real no disponible sin conexión
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Esta función requiere conexión activa con Supabase Realtime para sincronizar la presencia de los usuarios.
              </p>
            </div>
          ) : porEstablecimiento.length === 0 && enVistasGlobales.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
              <UserCheck className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                No hay usuarios coincidentes activos en este momento
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Cuando directores, jefes UTP o asesores ingresen a trabajar en una escuela, aparecerán aquí automáticamente.
              </p>
            </div>
          ) : (
            <>
              {/* Agrupado por Establecimiento */}
              {porEstablecimiento.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Trabajando en Establecimientos ({porEstablecimiento.length})
                    </h3>
                  </div>

                  {porEstablecimiento.map(grupo => {
                    const estObj = colegiosMap.get(grupo.rbd);
                    return (
                      <div
                        key={grupo.rbd}
                        className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 shadow-sm overflow-hidden"
                      >
                        <div className="px-4 py-2.5 bg-slate-50/90 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-[10px] font-mono font-bold text-slate-700 dark:text-slate-200">
                                RBD {grupo.rbd}
                              </span>
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {grupo.nombreEstablecimiento}
                              </span>
                            </div>
                            {grupo.comuna && (
                              <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                {grupo.comuna} · {grupo.usuarios.length} {grupo.usuarios.length === 1 ? 'persona conectada' : 'personas conectadas'}
                              </p>
                            )}
                          </div>

                          {estObj && (
                            <button
                              type="button"
                              onClick={() => {
                                onIrAEscuela(estObj);
                                onClose();
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-[11px] font-bold transition-colors shrink-0"
                            >
                              <span>Abrir</span>
                              <ExternalLink className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                          {grupo.usuarios.map((u, idx) => {
                            const vistaLabel = ETIQUETAS_VISTA[u.vistaActiva] || u.vistaActiva;
                            const apartadoLabel = u.apartadoActivo
                              ? ETIQUETAS_APARTADO[u.apartadoActivo] || u.apartadoActivo
                              : null;

                            return (
                              <div
                                key={`${u.sessionId}-${idx}`}
                                className="px-4 py-2.5 flex items-center justify-between gap-3"
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="relative shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-black text-slate-700 dark:text-slate-200">
                                      {iniciales(u.nombreCompleto)}
                                    </div>
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                        u.estado === 'activo' ? 'bg-emerald-500' : 'bg-amber-400'
                                      }`}
                                      title={u.estado === 'activo' ? 'Activo ahora' : 'Ventana en segundo plano'}
                                    />
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                        {u.nombreCompleto}
                                      </span>
                                      {u.esSesionActual && (
                                        <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[9px] font-bold">
                                          Tú
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                                      <span>{getNombreRol(u.role)}</span>
                                      <span>·</span>
                                      <span className="font-semibold text-amber-600 dark:text-amber-300">
                                        {apartadoLabel ? `${vistaLabel} → ${apartadoLabel}` : vistaLabel}
                                      </span>
                                      <span>·</span>
                                      <span className="font-mono">{u.periodo}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="text-right shrink-0">
                                  <span
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                      u.estado === 'activo'
                                        ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                                    }`}
                                  >
                                    <Clock className="w-2.5 h-2.5" />
                                    {u.estado === 'activo' ? formatearTiempoRelativo(u.ultimaActividad) : 'Ausente'}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Usuarios en vistas globales */}
              {enVistasGlobales.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  <h3 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5" />
                    <span>En Vistas Territoriales / Globales ({enVistasGlobales.length})</span>
                  </h3>

                  <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 divide-y divide-slate-100 dark:divide-slate-800/70">
                    {enVistasGlobales.map((u, idx) => (
                      <div
                        key={`${u.sessionId}-${idx}`}
                        className="px-4 py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-black text-slate-700 dark:text-slate-200">
                              {iniciales(u.nombreCompleto)}
                            </div>
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-900 ${
                                u.estado === 'activo' ? 'bg-emerald-500' : 'bg-amber-400'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                {u.nombreCompleto}
                              </span>
                              {u.esSesionActual && (
                                <span className="px-1.5 py-0.2 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 text-[9px] font-bold">
                                  Tú
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 dark:text-slate-400">
                              {getNombreRol(u.role)} ·{' '}
                              <span className="font-semibold text-sky-600 dark:text-sky-300">
                                {ETIQUETAS_VISTA[u.vistaActiva] || u.vistaActiva}
                              </span>
                            </div>
                          </div>
                        </div>

                        <span className="text-[10px] text-slate-400 shrink-0">
                          {u.estado === 'activo' ? formatearTiempoRelativo(u.ultimaActividad) : 'Ausente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
};
