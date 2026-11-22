import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Printer,
  Search,
  Sparkles,
  Trash2,
  UserCheck
} from 'lucide-react';
import { Docente, EscenarioCalce, Establecimiento, PropuestaCalce, SolicitudMovilidad } from '../../types';
import { CandidatoSugeridoMesa, CasoVacanteLaMesa } from './laMesaEngine';

export interface LaMesaPanelProps {
  periodoActivo: number;
  escenarioActivo: EscenarioCalce | null;
  escenarioConsolidado: boolean;
  puedeEditarMovilidad: boolean;
  operacionEnCurso: string | null;
  casos: CasoVacanteLaMesa[];
  colegiosByRbd: Map<string, Establecimiento>;
  solicitudesById: Map<string, SolicitudMovilidad>;
  onAceptarCandidato: (caso: CasoVacanteLaMesa, candidato: CandidatoSugeridoMesa) => void;
  onEliminarPropuesta: (propuestaId: string) => void;
  onImprimirNotificacion: (solicitud: SolicitudMovilidad, propuesta?: PropuestaCalce) => void;
  onIrATableroTecnico: () => void;
}

const ETIQUETA_CARRIL: Record<SolicitudMovilidad['carril'], string> = {
  NO_CONTINUIDAD_TITULAR: 'Titular sin continuidad (Art. 42)',
  TRASLADO_VOLUNTARIO: 'Traslado voluntario',
  HORAS_REMANENTES: 'Completar horas remanentes',
  NO_CONTINUIDAD_ASISTENTE_INDEFINIDO: 'AA.EE. Indefinido (Ley 21.109)'
};

function badgeSemaforo(semaforo: 'VERDE' | 'AMARILLO' | 'ROJO') {
  if (semaforo === 'VERDE') {
    return {
      dot: 'bg-emerald-500',
      box: 'bg-emerald-50 border-emerald-200 text-emerald-950',
      label: 'Recomendado'
    };
  }
  if (semaforo === 'AMARILLO') {
    return {
      dot: 'bg-amber-500',
      box: 'bg-amber-50 border-amber-200 text-amber-950',
      label: 'Revisar alerta'
    };
  }
  return {
    dot: 'bg-rose-500',
    box: 'bg-rose-50 border-rose-200 text-rose-950',
    label: 'Bloqueado'
  };
}

export const LaMesaPanel: React.FC<LaMesaPanelProps> = ({
  periodoActivo,
  escenarioActivo,
  escenarioConsolidado,
  puedeEditarMovilidad,
  operacionEnCurso,
  casos,
  colegiosByRbd,
  solicitudesById,
  onAceptarCandidato,
  onEliminarPropuesta,
  onImprimirNotificacion,
  onIrATableroTecnico
}) => {
  const [filtroEstado, setFiltroEstado] = useState<'POR_DECIDIR' | 'TODAS' | 'CUBIERTAS'>('POR_DECIDIR');
  const [busqueda, setBusqueda] = useState('');
  const [alternativasAbiertas, setAlternativasAbiertas] = useState<Record<string, boolean>>({});
  const [porQueAbierto, setPorQueAbierto] = useState<Record<string, boolean>>({});

  const total = casos.length;
  const cubiertasCount = casos.filter(c => c.estado === 'CUBIERTA').length;
  const porDecidirCount = total - cubiertasCount;
  const pct = total > 0 ? Math.round((cubiertasCount / total) * 100) : 0;

  const casosFiltrados = useMemo(() => {
    const q = busqueda.toLowerCase().trim();
    return casos.filter(caso => {
      if (filtroEstado === 'POR_DECIDIR' && caso.estado !== 'ABIERTA') return false;
      if (filtroEstado === 'CUBIERTAS' && caso.estado !== 'CUBIERTA') return false;
      if (!q) return true;
      const est = caso.establecimiento;
      const texto = [
        caso.vacante.asignaturaPrincipal,
        caso.vacante.nombres,
        caso.vacante.apellidos,
        caso.vacante.rbd,
        est?.nombre,
        est?.comuna,
        caso.propuesta?.nombreDocente,
        caso.candidatosSugeridos[0]?.solicitud.nombreDocente
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return texto.includes(q);
    });
  }, [casos, filtroEstado, busqueda]);

  const toggleAlternativas = (id: string) =>
    setAlternativasAbiertas(prev => ({ ...prev, [id]: !prev[id] }));
  const togglePorQue = (key: string) =>
    setPorQueAbierto(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-4">
      {/* Cabecera estilo Jobs */}
      <div className="card-elevated p-4 sm:p-5 space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-600" />
              <span>Mesa de Dotación {periodoActivo} · Vista Guiada</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              <strong>{cubiertasCount}</strong> de <strong>{total}</strong> vacantes cubiertas ({pct}%) ·{' '}
              <span className="font-bold text-indigo-700">{porDecidirCount} requieren decisión</span>
              {escenarioActivo ? ` · Escenario activo: ${escenarioActivo.nombre}` : ' · Sin escenario activo'}
            </p>
          </div>
          <button
            type="button"
            onClick={onIrATableroTecnico}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 text-xs font-bold self-start"
          >
            <span>Ir al Tablero Técnico</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Barra de progreso */}
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-600 to-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(
              [
                { id: 'POR_DECIDIR', label: `Por decidir (${porDecidirCount})` },
                { id: 'TODAS', label: `Todas (${total})` },
                { id: 'CUBIERTAS', label: `Cubiertas (${cubiertasCount})` }
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFiltroEstado(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                  filtroEstado === tab.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative sm:w-72">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder="Buscar especialidad, escuela o docente..."
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Lista de Casos */}
      {casosFiltrados.length === 0 ? (
        <div className="card-elevated p-8 text-center text-xs text-slate-500">
          No hay vacantes que coincidan con el filtro seleccionado.
        </div>
      ) : (
        <div className="space-y-3">
          {casosFiltrados.map(caso => {
            const v: Docente = caso.vacante;
            const est = caso.establecimiento;
            const esp = v.asignaturaPrincipal || `${v.nombres} ${v.apellidos}`.trim();
            const principal = caso.candidatosSugeridos[0];
            const alternativas = caso.candidatosSugeridos.slice(1);
            const verAlt = Boolean(alternativasAbiertas[v.id]);

            return (
              <div
                key={v.id}
                className={`card-elevated p-4 space-y-3 border ${
                  caso.estado === 'CUBIERTA'
                    ? 'border-emerald-200 bg-emerald-50/20'
                    : 'border-slate-200'
                }`}
              >
                {/* Encabezado de la Vacante */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-black text-slate-900 dark:text-white">
                        {esp} · <span className="tabular-nums">{v.horasContrato}h</span>
                      </h3>
                      {v.vacanteCondicional && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300">
                          Vacante Condicional
                        </span>
                      )}
                      {caso.estado === 'CUBIERTA' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-300">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Cubierta</span>
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      {est?.nombre || `RBD ${v.rbd}`}
                      {est?.comuna ? ` (${est.comuna})` : ''} · <span className="font-mono">{v.run}</span>
                    </div>
                  </div>
                </div>

                {/* Caso CUBIERTA */}
                {caso.estado === 'CUBIERTA' && caso.propuesta && (
                  <div className="p-3 rounded-xl bg-white border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{caso.propuesta.nombreDocente}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {caso.propuesta.estado}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-600 tabular-nums">
                        Origen: {colegiosByRbd.get(caso.propuesta.rbdOrigen)?.nombre || caso.propuesta.rbdOrigen} ·{' '}
                        {caso.propuesta.horasAsignadas}h · Compatibilidad {caso.propuesta.indiceCompatibilidad}%
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {caso.propuesta.solicitudMovilidadId &&
                        solicitudesById.has(caso.propuesta.solicitudMovilidadId) && (
                          <button
                            type="button"
                            onClick={() =>
                              onImprimirNotificacion(
                                solicitudesById.get(caso.propuesta!.solicitudMovilidadId!)!,
                                caso.propuesta
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-xs font-bold"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            <span>Emitir Notificación</span>
                          </button>
                        )}
                      {!escenarioConsolidado && puedeEditarMovilidad && (
                        <button
                          type="button"
                          onClick={() => onEliminarPropuesta(caso.propuesta!.id)}
                          disabled={Boolean(operacionEnCurso)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Quitar</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Caso ABIERTA */}
                {caso.estado === 'ABIERTA' && !principal && (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      <span>Sin candidatos compatibles en cola sobre el umbral mínimo.</span>
                    </span>
                    <button
                      type="button"
                      onClick={onIrATableroTecnico}
                      className="text-xs font-bold text-indigo-700 hover:underline"
                    >
                      Buscar manualmente
                    </button>
                  </div>
                )}

                {caso.estado === 'ABIERTA' && principal && (
                  <div className="space-y-2">
                    {[principal, ...(verAlt ? alternativas : [])].map((cand, idx) => {
                      const meta = badgeSemaforo(cand.explicacion.semaforo);
                      const porQueKey = `${v.id}_${cand.solicitud.id}`;
                      const verDetalle = Boolean(porQueAbierto[porQueKey]);

                      return (
                        <div
                          key={cand.solicitud.id}
                          className={`p-3 rounded-xl border space-y-2 ${meta.box}`}
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${meta.dot}`} />
                                <span className="text-xs font-black">
                                  {idx === 0 ? 'Propuesta: ' : `Alternativa ${idx}: `}
                                  {cand.solicitud.nombreDocente}
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-white/80 border border-slate-300 text-[10px] font-bold text-slate-700">
                                  {ETIQUETA_CARRIL[cand.solicitud.carril]}
                                </span>
                              </div>
                              <div className="text-xs font-medium">{cand.explicacion.resumenCorto}</div>
                            </div>

                            <div className="flex items-center gap-2 flex-wrap shrink-0">
                              <button
                                type="button"
                                onClick={() => onAceptarCandidato(caso, cand)}
                                disabled={
                                  !escenarioActivo ||
                                  escenarioConsolidado ||
                                  !puedeEditarMovilidad ||
                                  Boolean(operacionEnCurso)
                                }
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs disabled:opacity-45"
                              >
                                Aceptar propuesta
                              </button>
                              {idx === 0 && alternativas.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleAlternativas(v.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-bold"
                                >
                                  <span>Ver alternativas ({alternativas.length})</span>
                                  {verAlt ? (
                                    <ChevronUp className="w-3.5 h-3.5" />
                                  ) : (
                                    <ChevronDown className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => togglePorQue(porQueKey)}
                                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold"
                              >
                                {verDetalle ? 'Ocultar por qué' : 'Por qué'}
                              </button>
                            </div>
                          </div>

                          {verDetalle && (
                            <div className="p-2.5 rounded-lg bg-white/90 border border-slate-200 text-[11px] text-slate-700 space-y-1">
                              {cand.explicacion.detallesTecnicos.map((d, i) => (
                                <div key={i}>• {d}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
