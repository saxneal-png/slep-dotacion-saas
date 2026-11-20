import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Lock,
  Plus,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  UserCheck
} from 'lucide-react';
import {
  Docente,
  EgresoProyectado,
  Establecimiento,
  EstamentoAsistente,
  FeatureFlagsMovilidad,
  SolicitudMovilidad
} from '../../types';
import {
  AsistenteNoContinuidadItem,
  CAUSALES_EGRESO_OPCIONES,
  ETIQUETAS_ESTAMENTO_ASISTENTE,
  ETIQUETAS_FLUJO,
  FLUJO_MOVILIDAD_SECUENCIA,
  OrigenSeleccionado,
  RemanenteItem,
  SubTabCol1,
  calcularDesgloseTitularContrata,
  etiquetaEstamentoDocente
} from './movilidadHelpers';

export interface ColaMovilidadPanelProps {
  periodoActivo: number;
  flags: FeatureFlagsMovilidad;
  cargando: boolean;
  operacionEnCurso: string | null;
  puedeEditarMovilidad: boolean;
  puedeEliminarMovilidad: boolean;
  puedeValidarGdp: boolean;
  tabCol1: SubTabCol1;
  onChangeTabCol1: (tab: SubTabCol1) => void;
  filtroEstamentoCol1: string;
  onChangeFiltroEstamentoCol1: (val: string) => void;
  filtroTipoEscuelaRemanente: string;
  onChangeFiltroTipoEscuelaRemanente: (val: string) => void;
  colegiosByRbd: Map<string, Establecimiento>;
  docentesById: Map<string, Docente>;
  comunasDisponibles: string[];
  origenSeleccionado: OrigenSeleccionado | null;
  onSelectOrigen: (origen: OrigenSeleccionado) => void;
  // No Continuidad Docentes
  busquedaTitularNc: string;
  onChangeBusquedaTitularNc: (val: string) => void;
  docenteNcId: string;
  onChangeDocenteNcId: (val: string) => void;
  incluirTitularesSinMarcaGdp: boolean;
  onChangeIncluirTitularesSinMarcaGdp: (val: boolean) => void;
  comunaDestNc: string;
  onChangeComunaDestNc: (val: string) => void;
  fundamentoNc: string;
  onChangeFundamentoNc: (val: string) => void;
  titularesDisponiblesNc: Docente[];
  solicitudesNoContinuidadFiltradas: SolicitudMovilidad[];
  docentesNoContinuidadPendientesFiltrados: Docente[];
  onCrearNoContinuidad: (e: React.FormEvent) => void;
  onFormalizarNoContinuidadDesdeGdp: (doc: Docente) => void;
  // Traslados
  solicitudesTrasladosFiltradas: SolicitudMovilidad[];
  onAbrirModalTraslado: () => void;
  onAvanzarFlujo: (sol: SolicitudMovilidad) => void;
  onEliminarSolicitud: (sol: SolicitudMovilidad) => void;
  // Remanentes
  remanentesTotalCount: number;
  remanentesFiltrados: RemanenteItem[];
  // AA.EE. Indefinidos (Ley 21.109)
  solicitudesAsistentesFiltradas: SolicitudMovilidad[];
  asistentesNoContinuidadPendientes: AsistenteNoContinuidadItem[];
  onAgregarAsistenteACola: (item: AsistenteNoContinuidadItem) => void;
  // Egresos GDP
  egresosFiltrados: EgresoProyectado[];
  onAbrirModalNuevoEgreso: () => void;
  onAbrirModalEditarEgreso: (eg: EgresoProyectado) => void;
  onEliminarEgreso: (eg: EgresoProyectado) => void;
  onAbrirReversoEgreso: (eg: EgresoProyectado) => void;
}

export const ColaMovilidadPanel: React.FC<ColaMovilidadPanelProps> = ({
  periodoActivo,
  flags,
  cargando,
  operacionEnCurso,
  puedeEditarMovilidad,
  puedeEliminarMovilidad,
  puedeValidarGdp,
  tabCol1,
  onChangeTabCol1,
  filtroEstamentoCol1,
  onChangeFiltroEstamentoCol1,
  filtroTipoEscuelaRemanente,
  onChangeFiltroTipoEscuelaRemanente,
  colegiosByRbd,
  docentesById,
  comunasDisponibles,
  origenSeleccionado,
  onSelectOrigen,
  busquedaTitularNc,
  onChangeBusquedaTitularNc,
  docenteNcId,
  onChangeDocenteNcId,
  incluirTitularesSinMarcaGdp,
  onChangeIncluirTitularesSinMarcaGdp,
  comunaDestNc,
  onChangeComunaDestNc,
  fundamentoNc,
  onChangeFundamentoNc,
  titularesDisponiblesNc,
  solicitudesNoContinuidadFiltradas,
  docentesNoContinuidadPendientesFiltrados,
  onCrearNoContinuidad,
  onFormalizarNoContinuidadDesdeGdp,
  solicitudesTrasladosFiltradas,
  onAbrirModalTraslado,
  onAvanzarFlujo,
  onEliminarSolicitud,
  remanentesTotalCount,
  remanentesFiltrados,
  solicitudesAsistentesFiltradas,
  asistentesNoContinuidadPendientes,
  onAgregarAsistenteACola,
  egresosFiltrados,
  onAbrirModalNuevoEgreso,
  onAbrirModalEditarEgreso,
  onEliminarEgreso,
  onAbrirReversoEgreso
}) => {
  const [filtroEstamentoAsistente, setFiltroEstamentoAsistente] = useState<
    'TODOS' | EstamentoAsistente
  >('TODOS');

  const solicitudesAsistentesVisibles = solicitudesAsistentesFiltradas.filter(
    s =>
      filtroEstamentoAsistente === 'TODOS' ||
      s.categoriaAsistente === filtroEstamentoAsistente
  );

  const asistentesPendientesVisibles = asistentesNoContinuidadPendientes.filter(
    item =>
      filtroEstamentoAsistente === 'TODOS' ||
      item.asistente.estamento === filtroEstamentoAsistente
  );

  const totalAsistentesTab =
    solicitudesAsistentesFiltradas.length +
    asistentesNoContinuidadPendientes.length;

  return (
    <section className="xl:col-span-4 card-elevated p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-indigo-600" />
          <span>1. Cola de Movilidad &amp; Egresos</span>
        </h2>
        {cargando && <RefreshCw className="w-3.5 h-3.5 text-slate-400 animate-spin" />}
      </div>

      {/* Filtro Transversal por Estamento */}
      <div className="flex items-center gap-2">
        <select
          value={filtroEstamentoCol1}
          onChange={e => onChangeFiltroEstamentoCol1(e.target.value)}
          className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-300 rounded-xl"
          title="Filtrar cola por estamento (Docente Aula, Diferencial, Educadora de Párvulos, etc.)"
        >
          <option value="TODOS">Estamento: Todos</option>
          <option value="DOCENTE_AULA">Docente de Aula</option>
          <option value="DOCENTE_DIFERENCIAL">Docente Diferencial (PIE)</option>
          <option value="EDUCADORA_PARVULO">Educadora de Párvulos</option>
          <option value="PROFESIONAL_PAE">Profesional PAE</option>
          <option value="DIRECTIVO_UTP">Directivo / Técnico-Pedagógico (UTP)</option>
          <option value="OTRO">Otros Estamentos</option>
        </select>
        {filtroEstamentoCol1 !== 'TODOS' && (
          <button
            type="button"
            onClick={() => onChangeFiltroEstamentoCol1('TODOS')}
            className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
          >
            Limpiar
          </button>
        )}
      </div>

      {/* Sub-pestañas */}
      <div className="flex flex-wrap gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
        {flags.flag_no_continuidad_titulares && (
          <button
            type="button"
            onClick={() => onChangeTabCol1('no_continuidad')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              tabCol1 === 'no_continuidad'
                ? 'bg-white text-rose-700 shadow-xs border border-rose-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            No Continuidad (
            {solicitudesNoContinuidadFiltradas.length +
              docentesNoContinuidadPendientesFiltrados.length}
            )
          </button>
        )}

        {flags.flag_traslados_voluntarios && (
          <button
            type="button"
            onClick={() => onChangeTabCol1('traslados')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              tabCol1 === 'traslados'
                ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Traslados ({solicitudesTrasladosFiltradas.length})
          </button>
        )}

        <button
          type="button"
          onClick={() => onChangeTabCol1('remanentes')}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
            tabCol1 === 'remanentes'
              ? 'bg-white text-amber-800 shadow-xs border border-amber-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          Remanentes ({remanentesFiltrados.length})
        </button>

        <button
          type="button"
          onClick={() => onChangeTabCol1('asistentes_indefinidos')}
          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
            tabCol1 === 'asistentes_indefinidos'
              ? 'bg-white text-teal-800 shadow-xs border border-teal-200'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          AA.EE. Indefinidos ({totalAsistentesTab})
        </button>

        {flags.flag_egresos_contingencia && (
          <button
            type="button"
            onClick={() => onChangeTabCol1('egresos_gdp')}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
              tabCol1 === 'egresos_gdp'
                ? 'bg-white text-emerald-800 shadow-xs border border-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Egresos GDP ({egresosFiltrados.length})
          </button>
        )}
      </div>

      {/* ── Subtab: No Continuidad Titulares (Art. 42) ── */}
      {tabCol1 === 'no_continuidad' && flags.flag_no_continuidad_titulares && (
        <div className="space-y-3">
          <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block">
                Protección Art. 42 Estatuto Docente
              </span>
              <span>
                Resguardo estricto de horas titulares (las horas a contrata vencen el 28/feb sin constituir menoscabo). Prioridad crítica (&ge; 1000 pts).
              </span>
            </div>
          </div>

          {puedeEditarMovilidad && (
            <form
              onSubmit={onCrearNoContinuidad}
              className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2"
            >
              <div className="text-[11px] font-bold text-slate-700">
                Ingreso Rápido Titular Sin Continuidad
              </div>
              <input
                type="text"
                value={busquedaTitularNc}
                onChange={e => onChangeBusquedaTitularNc(e.target.value)}
                placeholder="Buscar docente sin continuidad por nombre, RUN o escuela..."
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
              <select
                value={docenteNcId}
                onChange={e => onChangeDocenteNcId(e.target.value)}
                required
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              >
                <option value="">
                  {titularesDisponiblesNc.length > 0
                    ? `Selecciona docente (${titularesDisponiblesNc.length} disponibles)...`
                    : 'Sin docentes con marca GDP de No Continuidad'}
                </option>
                {titularesDisponiblesNc.map(d => {
                  const desg = calcularDesgloseTitularContrata(d);
                  return (
                    <option key={d.id} value={d.id}>
                      {d.nombres} {d.apellidos} ({d.run}) —{' '}
                      {etiquetaEstamentoDocente(d.estamento).label} ·{' '}
                      {desg.horasTitulares}h Tit. + {desg.horasContrata}h Cont. ·{' '}
                      {colegiosByRbd.get(d.rbd)?.nombre || d.rbd}
                    </option>
                  );
                })}
              </select>
              <label className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirTitularesSinMarcaGdp}
                  onChange={e => {
                    onChangeIncluirTitularesSinMarcaGdp(e.target.checked);
                    onChangeDocenteNcId('');
                  }}
                  className="w-3.5 h-3.5 accent-rose-600"
                />
                <span>
                  Incluir titulares sin marca GDP de No Continuidad (excepción)
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  value={comunaDestNc}
                  onChange={e => onChangeComunaDestNc(e.target.value)}
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                >
                  <option value="">Comuna destino (cualquiera)</option>
                  {comunasDisponibles.map(c => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={fundamentoNc}
                  onChange={e => onChangeFundamentoNc(e.target.value)}
                  placeholder="Motivo / fusión / reducción"
                  className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg"
                />
              </div>
              <button
                type="submit"
                disabled={!docenteNcId || Boolean(operacionEnCurso)}
                className="w-full py-1.5 px-3 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                Agregar a Cola Art. 42
              </button>
            </form>
          )}

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {solicitudesNoContinuidadFiltradas.length === 0 &&
            docentesNoContinuidadPendientesFiltrados.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No hay docentes en cola ni con propuesta GDP de No Continuidad para los filtros actuales ({periodoActivo}).
              </p>
            ) : (
              <>
                {solicitudesNoContinuidadFiltradas.map(sol => {
                  const seleccionado =
                    origenSeleccionado?.solicitudMovilidadId === sol.id;
                  const badgeFlujo = ETIQUETAS_FLUJO[sol.estadoFlujo];
                  const idxFlujo = FLUJO_MOVILIDAD_SECUENCIA.indexOf(
                    sol.estadoFlujo
                  );
                  const puedeAvanzar =
                    idxFlujo >= 0 &&
                    idxFlujo < FLUJO_MOVILIDAD_SECUENCIA.length - 1;
                  const docRef = docentesById.get(sol.docenteId);
                  const estamentoMeta = etiquetaEstamentoDocente(
                    docRef?.estamento
                  );
                  const desglose = docRef
                    ? calcularDesgloseTitularContrata(docRef)
                    : {
                        horasTitulares: sol.horasTitularesActuales,
                        horasContrata:
                          sol.horasContrataActuales ??
                          Math.max(
                            0,
                            sol.horasContratoActual - sol.horasTitularesActuales
                          ),
                        horasTotal: sol.horasContratoActual
                      };

                  return (
                    <div
                      key={sol.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        seleccionado
                          ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {sol.nombreDocente}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {sol.runDocente} ·{' '}
                            {colegiosByRbd.get(sol.rbdOrigen)?.nombre ||
                              sol.rbdOrigen}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 tabular-nums shrink-0">
                          Pts {sol.puntajePrioridadTotal}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded font-bold border ${badgeFlujo.badgeClass}`}
                        >
                          {badgeFlujo.label}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold border ${estamentoMeta.badgeClass}`}
                        >
                          {estamentoMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-900 border border-rose-200 font-bold tabular-nums">
                          {desglose.horasTitulares}h Titular +{' '}
                          {desglose.horasContrata}h Contrata
                        </span>
                        {sol.asignaturaPrincipal && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                            {sol.asignaturaPrincipal}
                          </span>
                        )}
                      </div>

                      {sol.fundamento && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">
                          {sol.fundamento}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectOrigen({
                              docenteId: sol.docenteId,
                              solicitudMovilidadId: sol.id,
                              nombreDocente: sol.nombreDocente,
                              runDocente: sol.runDocente,
                              rbdOrigen: sol.rbdOrigen,
                              carrilLabel: 'No Continuidad Art. 42',
                              horas: sol.horasDisponiblesMover,
                              calidadJuridica: sol.calidadJuridica,
                              asignatura: sol.asignaturaPrincipal,
                              aplicaArticulo69: sol.aplicaArticulo69,
                              estamentoPersonal: 'DOCENTE',
                              horasTitulares: desglose.horasTitulares,
                              horasContrata: desglose.horasContrata
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            seleccionado
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {seleccionado ? '✓ Origen Activo' : 'Seleccionar Origen'}
                        </button>

                        <div className="flex items-center gap-1">
                          {puedeEditarMovilidad && puedeAvanzar && (
                            <button
                              type="button"
                              onClick={() => onAvanzarFlujo(sol)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                              title="Avanzar siguiente etapa de flujo"
                            >
                              <span>Avanzar</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                          {puedeEliminarMovilidad &&
                            sol.estadoFlujo !== 'CONSOLIDADO' &&
                            sol.estadoFlujo !== 'RESOLUCION_EMITIDA' && (
                              <button
                                type="button"
                                onClick={() => onEliminarSolicitud(sol)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Eliminar solicitud"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {docentesNoContinuidadPendientesFiltrados.map(doc => {
                  const seleccionado =
                    !origenSeleccionado?.solicitudMovilidadId &&
                    origenSeleccionado?.docenteId === doc.id;
                  const estamentoMeta = etiquetaEstamentoDocente(doc.estamento);
                  const desglose = calcularDesgloseTitularContrata(doc);
                  const razonGdp = [
                    doc.observacionesDirector,
                    doc.observacionesSlep,
                    doc.observacionesPal
                  ]
                    .map(x => (x || '').trim())
                    .filter(Boolean)
                    .join(' | ');
                  return (
                    <div
                      key={`gdp-nc-${doc.id}`}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        seleccionado
                          ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-300'
                          : 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {doc.nombres} {doc.apellidos}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {doc.run} ·{' '}
                            {colegiosByRbd.get(doc.rbd)?.nombre || doc.rbd}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          Propuesta GDP
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold border ${estamentoMeta.badgeClass}`}
                        >
                          {estamentoMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-900 border border-rose-200 font-bold tabular-nums">
                          {desglose.horasTitulares}h Titular +{' '}
                          {desglose.horasContrata}h Contrata
                        </span>
                        {doc.asignaturaPrincipal && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                            {doc.asignaturaPrincipal}
                          </span>
                        )}
                      </div>

                      {razonGdp && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">
                          {razonGdp}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-rose-100">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectOrigen({
                              docenteId: doc.id,
                              nombreDocente: `${doc.nombres} ${doc.apellidos}`.trim(),
                              runDocente: doc.run,
                              rbdOrigen: doc.rbd,
                              carrilLabel: 'No Continuidad (Propuesta GDP)',
                              horas: doc.horasContrato,
                              calidadJuridica: doc.calidadJuridica,
                              asignatura: doc.asignaturaPrincipal,
                              aplicaArticulo69: doc.aplicaArticulo69,
                              estamentoPersonal: 'DOCENTE',
                              horasTitulares: desglose.horasTitulares,
                              horasContrata: desglose.horasContrata
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            seleccionado
                              ? 'bg-indigo-600 text-white'
                              : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                          }`}
                        >
                          {seleccionado ? '✓ Origen Activo' : 'Seleccionar Origen'}
                        </button>

                        {puedeEditarMovilidad && (
                          <button
                            type="button"
                            onClick={() => onFormalizarNoContinuidadDesdeGdp(doc)}
                            disabled={Boolean(operacionEnCurso)}
                            className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold disabled:opacity-50"
                          >
                            Formalizar en Cola Art. 42
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Subtab: Traslados Voluntarios ── */}
      {tabCol1 === 'traslados' && flags.flag_traslados_voluntarios && (
        <div className="space-y-3">
          {puedeEditarMovilidad && (
            <button
              type="button"
              onClick={onAbrirModalTraslado}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nueva Solicitud de Traslado (Rúbrica Ponderada)</span>
            </button>
          )}

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {solicitudesTrasladosFiltradas.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No existen solicitudes de traslado voluntario para el filtro actual.
              </p>
            ) : (
              solicitudesTrasladosFiltradas.map(sol => {
                const seleccionado =
                  origenSeleccionado?.solicitudMovilidadId === sol.id;
                const badgeFlujo = ETIQUETAS_FLUJO[sol.estadoFlujo];
                const idxFlujo = FLUJO_MOVILIDAD_SECUENCIA.indexOf(
                  sol.estadoFlujo
                );
                const puedeAvanzar =
                  idxFlujo >= 0 &&
                  idxFlujo < FLUJO_MOVILIDAD_SECUENCIA.length - 1;
                const faltaFirmaOrigen =
                  sol.estadoFlujo !== 'ACEPTADO_CON_FIRMA' &&
                  sol.estadoFlujo !== 'CONSOLIDADO' &&
                  sol.estadoFlujo !== 'RESOLUCION_EMITIDA' &&
                  sol.estadoFlujo !== 'RECHAZADO';
                const docRef = docentesById.get(sol.docenteId);
                const estamentoMeta = etiquetaEstamentoDocente(docRef?.estamento);

                return (
                  <div
                    key={sol.id}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      seleccionado
                        ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-300'
                        : faltaFirmaOrigen
                        ? 'bg-amber-50/35 border-amber-300 hover:border-amber-400'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900">
                          {sol.nombreDocente}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {sol.runDocente} ·{' '}
                          {colegiosByRbd.get(sol.rbdOrigen)?.nombre ||
                            sol.rbdOrigen}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-100 text-indigo-800 border border-indigo-200 tabular-nums shrink-0">
                        Pts {sol.puntajePrioridadTotal}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span
                        className={`px-2 py-0.5 rounded font-bold border ${badgeFlujo.badgeClass}`}
                      >
                        {badgeFlujo.label}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold border ${estamentoMeta.badgeClass}`}
                      >
                        {estamentoMeta.label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold tabular-nums">
                        {sol.horasContratoActual}h · {sol.calidadJuridica}
                      </span>
                      {sol.comunaDestinoPreferente && (
                        <span className="px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-800 font-semibold">
                          Destino: {sol.comunaDestinoPreferente}
                        </span>
                      )}
                    </div>

                    {faltaFirmaOrigen && (
                      <div className="px-2 py-1 rounded-lg bg-amber-100/80 border border-amber-300 text-[10px] font-bold text-amber-950 flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>
                            Pendiente alcanzar ACEPTADO_CON_FIRMA antes de consolidar
                          </span>
                        </span>
                        {puedeEditarMovilidad && puedeAvanzar && (
                          <button
                            type="button"
                            onClick={() => onAvanzarFlujo(sol)}
                            className="px-2 py-0.5 rounded bg-amber-700 hover:bg-amber-800 text-white text-[10px] font-black shrink-0"
                          >
                            Avanzar →
                          </button>
                        )}
                      </div>
                    )}

                    <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 tabular-nums">
                      <span>Karin: {sol.puntajeLeyKarin}</span>
                      <span>Salud: {sol.puntajeSalud}</span>
                      <span>Dep.: {sol.puntajeCuidadoDependientes}</span>
                      <span>Dist.: {sol.puntajeDistanciaRural}</span>
                      <span>Antig.: {sol.puntajeAntiguedad}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectOrigen({
                            docenteId: sol.docenteId,
                            solicitudMovilidadId: sol.id,
                            nombreDocente: sol.nombreDocente,
                            runDocente: sol.runDocente,
                            rbdOrigen: sol.rbdOrigen,
                            carrilLabel: 'Traslado Voluntario',
                            horas: sol.horasDisponiblesMover,
                            calidadJuridica: sol.calidadJuridica,
                            asignatura: sol.asignaturaPrincipal,
                            aplicaArticulo69: sol.aplicaArticulo69,
                            estamentoPersonal: 'DOCENTE'
                          })
                        }
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                          seleccionado
                            ? 'bg-indigo-600 text-white'
                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700'
                        }`}
                      >
                        {seleccionado ? '✓ Origen Activo' : 'Seleccionar Origen'}
                      </button>

                      <div className="flex items-center gap-1">
                        {puedeEditarMovilidad && puedeAvanzar && (
                          <button
                            type="button"
                            onClick={() => onAvanzarFlujo(sol)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                            title={`Avanzar a ${
                              ETIQUETAS_FLUJO[
                                FLUJO_MOVILIDAD_SECUENCIA[idxFlujo + 1]
                              ].label
                            }`}
                          >
                            <span>Avanzar</span>
                            <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        {puedeEliminarMovilidad &&
                          sol.estadoFlujo !== 'CONSOLIDADO' &&
                          sol.estadoFlujo !== 'RESOLUCION_EMITIDA' && (
                            <button
                              type="button"
                              onClick={() => onEliminarSolicitud(sol)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Eliminar solicitud"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Subtab: Docentes con Horas Remanentes ── */}
      {tabCol1 === 'remanentes' && (
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <select
              value={filtroTipoEscuelaRemanente}
              onChange={e => onChangeFiltroTipoEscuelaRemanente(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-300 rounded-xl"
              title="Filtrar docentes con horas remanentes por tipo de establecimiento"
            >
              <option value="TODOS">
                Tipo de Escuela: Todos ({remanentesTotalCount})
              </option>
              <option value="CAT:ESCUELA">Escuelas (Básica / Especial)</option>
              <option value="CAT:LICEO">Liceos (HC / TP / Polivalente)</option>
              <option value="CAT:JARDIN_VTF">
                Jardines y Salas Cuna VTF
              </option>
              <option value="ESCUELA_BASICA">Escuela Básica</option>
              <option value="LICEO_HC">Liceo HC</option>
              <option value="LICEO_TP">Liceo TP</option>
              <option value="LICEO_POLIVALENTE">Liceo Polivalente</option>
              <option value="ESCUELA_ESPECIAL">Escuela Especial</option>
              <option value="EPJA">EPJA (Adultos)</option>
            </select>
            {filtroTipoEscuelaRemanente !== 'TODOS' && (
              <button
                type="button"
                onClick={() => onChangeFiltroTipoEscuelaRemanente('TODOS')}
                className="px-2 py-1 text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-slate-100 rounded-lg"
              >
                Limpiar
              </button>
            )}
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {remanentesFiltrados.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No se detectaron docentes titulares con horas lectivas subutilizadas para el tipo seleccionado.
              </p>
            ) : (
              remanentesFiltrados.map(item => {
                const seleccionado =
                  !origenSeleccionado?.solicitudMovilidadId &&
                  origenSeleccionado?.docenteId === item.docente.id;
                return (
                  <div
                    key={item.docente.id}
                    className={`p-3 rounded-xl border transition-all space-y-2 ${
                      seleccionado
                        ? 'bg-indigo-50/70 border-indigo-500 ring-1 ring-indigo-300'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900">
                          {item.docente.nombres} {item.docente.apellidos}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {item.docente.run} ·{' '}
                          {item.establecimiento?.nombre || item.docente.rbd}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 tabular-nums shrink-0">
                        +{item.horasRemanentes}h Libres
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px] text-slate-600 tabular-nums">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold border ${
                          etiquetaEstamentoDocente(item.docente.estamento)
                            .badgeClass
                        }`}
                      >
                        {etiquetaEstamentoDocente(item.docente.estamento).label}
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">
                        Contrato: {item.horasContrato}h
                      </span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-100 font-semibold">
                        Aula: {item.horasAsignadas} / {item.horasLectivasMax} HA
                      </span>
                      {item.docente.asignaturaPrincipal && (
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-semibold">
                          {item.docente.asignaturaPrincipal}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onSelectOrigen({
                          docenteId: item.docente.id,
                          nombreDocente: `${item.docente.nombres} ${item.docente.apellidos}`.trim(),
                          runDocente: item.docente.run,
                          rbdOrigen: item.docente.rbd,
                          carrilLabel: 'Horas Remanentes',
                          horas: item.horasRemanentes,
                          calidadJuridica: item.docente.calidadJuridica,
                          asignatura: item.docente.asignaturaPrincipal,
                          aplicaArticulo69: item.docente.aplicaArticulo69,
                          estamentoPersonal: 'DOCENTE'
                        })
                      }
                      className={`w-full py-1 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                        seleccionado
                          ? 'bg-indigo-600 text-white'
                          : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {seleccionado
                        ? '✓ Origen Seleccionado'
                        : 'Usar Remanente como Origen'}
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Subtab: AA.EE. Indefinidos (Ley 21.109) ── */}
      {tabCol1 === 'asistentes_indefinidos' && (
        <div className="space-y-3">
          <div className="p-2.5 rounded-xl bg-teal-50 border border-teal-200 text-[11px] text-teal-950 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <span className="font-black block">
                Resguardo Asistentes Indefinidos (Ley N° 21.109)
              </span>
              <span>
                Estabilidad de horas indefinidas y prohibición de degradación de estamento (Profesional, Técnico, Administrativo, Paradocente, Auxiliar).
              </span>
            </div>
          </div>

          <select
            value={filtroEstamentoAsistente}
            onChange={e =>
              setFiltroEstamentoAsistente(
                e.target.value as 'TODOS' | EstamentoAsistente
              )
            }
            className="w-full px-2.5 py-1.5 text-[11px] font-semibold bg-slate-50 border border-slate-300 rounded-xl"
          >
            <option value="TODOS">
              Estamento AA.EE.: Todos ({totalAsistentesTab})
            </option>
            <option value="PROFESIONAL">PROFESIONAL</option>
            <option value="TECNICO">TECNICO</option>
            <option value="ADMINISTRATIVO">ADMINISTRATIVO</option>
            <option value="PARADOCENTE_INSPECTORIA">
              PARADOCENTE_INSPECTORIA
            </option>
            <option value="AUXILIAR">AUXILIAR</option>
          </select>

          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1">
            {solicitudesAsistentesVisibles.length === 0 &&
            asistentesPendientesVisibles.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                No se registran asistentes de la educación indefinidos con No Continuidad para {periodoActivo}.
              </p>
            ) : (
              <>
                {solicitudesAsistentesVisibles.map(sol => {
                  const seleccionado =
                    origenSeleccionado?.solicitudMovilidadId === sol.id;
                  const badgeFlujo = ETIQUETAS_FLUJO[sol.estadoFlujo];
                  const idxFlujo = FLUJO_MOVILIDAD_SECUENCIA.indexOf(
                    sol.estadoFlujo
                  );
                  const puedeAvanzar =
                    idxFlujo >= 0 &&
                    idxFlujo < FLUJO_MOVILIDAD_SECUENCIA.length - 1;
                  const estCat = sol.categoriaAsistente || 'ADMINISTRATIVO';
                  const estMeta = ETIQUETAS_ESTAMENTO_ASISTENTE[estCat];
                  const hrsIndef = sol.horasTitularesActuales || 0;
                  const hrsPf =
                    sol.horasContrataActuales ??
                    Math.max(0, sol.horasContratoActual - hrsIndef);

                  return (
                    <div
                      key={sol.id}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        seleccionado
                          ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-300'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {sol.nombreDocente}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {sol.runDocente} ·{' '}
                            {colegiosByRbd.get(sol.rbdOrigen)?.nombre ||
                              sol.rbdOrigen}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-teal-100 text-teal-900 border border-teal-200 shrink-0">
                          Ley 21.109
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span
                          className={`px-2 py-0.5 rounded font-bold border ${badgeFlujo.badgeClass}`}
                        >
                          {badgeFlujo.label}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold border ${estMeta.badgeClass}`}
                        >
                          {estMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200 font-bold tabular-nums">
                          {hrsIndef}h Indefinido + {hrsPf}h Plazo Fijo
                        </span>
                      </div>

                      {sol.fundamento && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">
                          {sol.fundamento}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectOrigen({
                              docenteId: sol.docenteId,
                              solicitudMovilidadId: sol.id,
                              nombreDocente: sol.nombreDocente,
                              runDocente: sol.runDocente,
                              rbdOrigen: sol.rbdOrigen,
                              carrilLabel: `AA.EE. Indefinido (${estCat})`,
                              horas: sol.horasDisponiblesMover,
                              calidadJuridica: 'INDEFINIDO',
                              asignatura: sol.asignaturaPrincipal,
                              estamentoPersonal: 'ASISTENTE',
                              categoriaAsistente: estCat,
                              horasTitulares: hrsIndef,
                              horasContrata: hrsPf
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            seleccionado
                              ? 'bg-teal-600 text-white'
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-800'
                          }`}
                        >
                          {seleccionado ? '✓ Origen Activo' : 'Seleccionar Origen'}
                        </button>

                        <div className="flex items-center gap-1">
                          {puedeEditarMovilidad && puedeAvanzar && (
                            <button
                              type="button"
                              onClick={() => onAvanzarFlujo(sol)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                            >
                              <span>Avanzar</span>
                              <ChevronRight className="w-3 h-3" />
                            </button>
                          )}
                          {puedeEliminarMovilidad &&
                            sol.estadoFlujo !== 'CONSOLIDADO' &&
                            sol.estadoFlujo !== 'RESOLUCION_EMITIDA' && (
                              <button
                                type="button"
                                onClick={() => onEliminarSolicitud(sol)}
                                className="p-1 text-slate-400 hover:text-rose-600 rounded"
                                title="Eliminar solicitud"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {asistentesPendientesVisibles.map(item => {
                  const a = item.asistente;
                  const seleccionado =
                    !origenSeleccionado?.solicitudMovilidadId &&
                    origenSeleccionado?.docenteId === a.id &&
                    origenSeleccionado?.estamentoPersonal === 'ASISTENTE';
                  const estMeta = ETIQUETAS_ESTAMENTO_ASISTENTE[a.estamento];
                  return (
                    <div
                      key={`ae-pend-${a.id}`}
                      className={`p-3 rounded-xl border transition-all space-y-2 ${
                        seleccionado
                          ? 'bg-teal-50/70 border-teal-500 ring-1 ring-teal-300'
                          : 'bg-teal-50/25 border-teal-200 hover:border-teal-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            {a.nombres} {a.apellidos}
                          </div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {a.run} ·{' '}
                            {item.establecimiento?.nombre ||
                              colegiosByRbd.get(a.rbd)?.nombre ||
                              a.rbd}
                          </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 shrink-0">
                          GDP AA.EE.
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span
                          className={`px-1.5 py-0.5 rounded font-bold border ${estMeta.badgeClass}`}
                        >
                          {estMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-900 border border-teal-200 font-bold tabular-nums">
                          {item.horasIndefinidas}h Indefinido +{' '}
                          {item.horasPlazoFijo}h Plazo Fijo
                        </span>
                        {a.cargoFuncion && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                            {a.cargoFuncion}
                          </span>
                        )}
                      </div>

                      {item.razonGdp && (
                        <p className="text-[10px] text-slate-600 line-clamp-2">
                          {item.razonGdp}
                        </p>
                      )}

                      <div className="flex items-center justify-between gap-2 pt-1 border-t border-teal-100">
                        <button
                          type="button"
                          onClick={() =>
                            onSelectOrigen({
                              docenteId: a.id,
                              nombreDocente: `${a.nombres} ${a.apellidos}`.trim(),
                              runDocente: a.run,
                              rbdOrigen: a.rbd,
                              carrilLabel: `AA.EE. Indefinido (${a.estamento})`,
                              horas: a.horasContrato,
                              calidadJuridica: 'INDEFINIDO',
                              asignatura: a.cargoFuncion || a.estamento,
                              estamentoPersonal: 'ASISTENTE',
                              categoriaAsistente: a.estamento,
                              horasTitulares: item.horasIndefinidas,
                              horasContrata: item.horasPlazoFijo
                            })
                          }
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                            seleccionado
                              ? 'bg-teal-600 text-white'
                              : 'bg-teal-50 hover:bg-teal-100 text-teal-800'
                          }`}
                        >
                          {seleccionado ? '✓ Origen Activo' : 'Seleccionar Origen'}
                        </button>

                        {puedeEditarMovilidad && (
                          <button
                            type="button"
                            onClick={() => onAgregarAsistenteACola(item)}
                            disabled={Boolean(operacionEnCurso)}
                            className="px-2.5 py-1 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[10px] font-bold disabled:opacity-50"
                          >
                            Agregar a Cola Ley 21.109
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Subtab: Egresos Proyectados GDP ── */}
      {tabCol1 === 'egresos_gdp' && flags.flag_egresos_contingencia && (
        <div className="space-y-3">
          {puedeValidarGdp ? (
            <button
              type="button"
              onClick={onAbrirModalNuevoEgreso}
              className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Egreso Proyectado (GDP)</span>
            </button>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-100 border border-slate-200 text-[11px] text-slate-600 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>
                Solo Validador GDP, Subdirector UATP o Super Usuario puede registrar o modificar egresos.
              </span>
            </div>
          )}

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {egresosFiltrados.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">
                Sin egresos proyectados registrados para {periodoActivo} con el filtro actual.
              </p>
            ) : (
              egresosFiltrados.map(eg => {
                const causalLabel =
                  CAUSALES_EGRESO_OPCIONES.find(c => c.id === eg.causal)?.label ||
                  eg.causal;
                const esConfirmado = eg.certeza === 'confirmado';
                const esRevertido =
                  eg.estadoReversion === 'REVERTIDO_REINCORPORADO';
                const estamentoMeta = etiquetaEstamentoDocente(
                  docentesById.get(eg.docenteId)?.estamento
                );

                return (
                  <div
                    key={eg.id}
                    className={`p-3 rounded-xl border space-y-2 ${
                      esRevertido
                        ? 'bg-slate-50 border-slate-300 opacity-85'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-black text-slate-900">
                          {eg.nombreDocente}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500">
                          {eg.runDocente} ·{' '}
                          {colegiosByRbd.get(eg.rbd)?.nombre || eg.rbd}
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 text-[10px] font-black tabular-nums">
                        {eg.horasLiberadas}h
                      </span>
                    </div>

                    <div className="text-[11px] font-semibold text-slate-700">
                      {causalLabel}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                      <span
                        className={`px-1.5 py-0.5 rounded font-bold border ${estamentoMeta.badgeClass}`}
                      >
                        {estamentoMeta.label}
                      </span>

                      {esRevertido && (
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-white font-black border border-slate-900">
                          REVERTIDO_REINCORPORADO
                        </span>
                      )}

                      {esConfirmado ? (
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                          Confirmado{' '}
                          {eg.numeroDecreto ? `· Dec. ${eg.numeroDecreto}` : ''}{' '}
                          {eg.fechaCese ? `· ${eg.fechaCese}` : ''}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-bold border border-amber-300">
                          En Trámite (Vacante Condicional)
                        </span>
                      )}

                      {eg.causal === 'art_19s_no_avance' && (
                        <span
                          className={`px-2 py-0.5 rounded font-bold border ${
                            eg.cpeipNotificacionFirme
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                              : 'bg-rose-50 text-rose-800 border-rose-300'
                          }`}
                        >
                          {eg.cpeipNotificacionFirme
                            ? 'CPEIP Notificación Firme'
                            : 'Sin CPEIP Firme / En Reposición'}
                        </span>
                      )}

                      <span
                        className={`px-2 py-0.5 rounded font-bold border ${
                          eg.impactoPresupuestario === 'con_recuperacion_sil'
                            ? 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            : eg.impactoPresupuestario ===
                              'costo_doble_pendiente'
                            ? 'bg-rose-50 text-rose-800 border-rose-200'
                            : 'bg-slate-50 text-slate-700 border-slate-200'
                        }`}
                      >
                        {eg.impactoPresupuestario === 'con_recuperacion_sil'
                          ? 'Con Recuperación SIL'
                          : eg.impactoPresupuestario === 'costo_doble_pendiente'
                          ? 'Costo Doble Pendiente'
                          : 'Sin Impacto Doble'}
                      </span>
                    </div>

                    {eg.causal === 'art_19s_no_avance' &&
                      eg.excepcionJubilacion3Anios && (
                        <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-[10px] text-rose-800 font-semibold">
                          Excepción &le; 3 años de jubilación (Art. 19 S): NO libera vacante.
                        </div>
                      )}

                    {esRevertido && eg.motivoReversion && (
                      <div className="p-2 rounded-lg bg-slate-100 border border-slate-300 text-[10px] text-slate-700">
                        <strong>Motivo Reincorporación:</strong>{' '}
                        {eg.motivoReversion}
                        {eg.fechaReversion ? ` (${eg.fechaReversion.slice(0, 10)})` : ''}
                      </div>
                    )}

                    {puedeValidarGdp && (
                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                        {!esRevertido && (
                          <button
                            type="button"
                            onClick={() => onAbrirReversoEgreso(eg)}
                            disabled={Boolean(operacionEnCurso)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-bold disabled:opacity-50"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reincorporar Titular (Reverso Controlado)</span>
                          </button>
                        )}
                        {!esRevertido && (
                          <button
                            type="button"
                            onClick={() => onAbrirModalEditarEgreso(eg)}
                            className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold"
                          >
                            Editar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onEliminarEgreso(eg)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Eliminar egreso"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </section>
  );
};
