import React from 'react';
import {
  AlertTriangle,
  Award,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Trash2
} from 'lucide-react';
import {
  MAX_MINUTOS_LECTIVOS_ART_69,
  TOPE_MINUTOS_SEMANALES_SLEP
} from '@slep/mineduc-engine';
import {
  Docente,
  EscenarioCalce,
  Establecimiento,
  FeatureFlagsMovilidad,
  PropuestaCalce
} from '../../types';
import {
  ETIQUETAS_ESTADO_ESCENARIO,
  ETIQUETAS_RESOLUCION_REBOTE,
  OrigenSeleccionado,
  calcularDesgloseTitularContrata,
  formatearMinutosAHoras,
  inferirFuenteVacante
} from './movilidadHelpers';

export interface SimuladorCalcePanelProps {
  flags: FeatureFlagsMovilidad;
  puedeEditarMovilidad: boolean;
  puedeValidarGdp: boolean;
  puedeConsolidar: boolean;
  operacionEnCurso: string | null;
  escenarios: EscenarioCalce[];
  escenarioActivoId: string;
  escenarioActivo: EscenarioCalce | null;
  onChangeEscenarioActivoId: (id: string) => void;
  propuestas: PropuestaCalce[];
  rebotesPendientesCount: number;
  trasladosSinFirmaCount: number;
  colegiosByRbd: Map<string, Establecimiento>;
  docentesById: Map<string, Docente>;
  origenSeleccionado: OrigenSeleccionado | null;
  onLimpiarOrigen: () => void;
  vacanteDestinoSeleccionada: Docente | null;
  onLimpiarVacanteDestino: () => void;
  tipoCobertura: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL';
  onChangeTipoCobertura: (val: 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL') => void;
  esTrasladoCompleto: boolean;
  onChangeEsTrasladoCompleto: (val: boolean) => void;
  onSimularYAgregar: () => void;
  onSugerirCalcesAutomaticos: () => void;
  onEliminarPropuesta: (propuestaId: string) => void;
  onResolverRebote: (
    propuestaId: string,
    estadoResolucion: 'CUBIERTA_EN_CADENA' | 'DERIVADA_A_CONCURSO_GDP',
    reboteCubiertoPorPropuestaId?: string
  ) => void;
  onAbrirCompararGemini: () => void;
  onAbrirResolucionExenta: () => void;
  onExportarNominaActosGdp: () => void;
}

export const SimuladorCalcePanel: React.FC<SimuladorCalcePanelProps> = ({
  flags,
  puedeEditarMovilidad,
  puedeValidarGdp,
  puedeConsolidar,
  operacionEnCurso,
  escenarios,
  escenarioActivoId,
  escenarioActivo,
  onChangeEscenarioActivoId,
  propuestas,
  rebotesPendientesCount,
  trasladosSinFirmaCount,
  colegiosByRbd,
  docentesById,
  origenSeleccionado,
  onLimpiarOrigen,
  vacanteDestinoSeleccionada,
  onLimpiarVacanteDestino,
  tipoCobertura,
  onChangeTipoCobertura,
  esTrasladoCompleto,
  onChangeEsTrasladoCompleto,
  onSimularYAgregar,
  onSugerirCalcesAutomaticos,
  onEliminarPropuesta,
  onResolverRebote,
  onAbrirCompararGemini,
  onAbrirResolucionExenta,
  onExportarNominaActosGdp
}) => {
  const escenarioConsolidado =
    escenarioActivo?.estado === 'CONSOLIDADO' ||
    escenarioActivo?.estado === 'RESOLUCION_EMITIDA';
  const estadoMeta = escenarioActivo
    ? ETIQUETAS_ESTADO_ESCENARIO[escenarioActivo.estado]
    : null;

  return (
    <section className="xl:col-span-4 card-elevated p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-600" />
          <span>2. Simulador What-If &amp; Calces</span>
        </h2>
        {escenarioActivo && estadoMeta && (
          <div className="flex items-center gap-1.5">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900 text-white tabular-nums">
              v{escenarioActivo.version ?? 1}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${estadoMeta.badgeClass}`}
            >
              {estadoMeta.label}
            </span>
          </div>
        )}
      </div>

      {escenarioActivo?.estado === 'RESOLUCION_EMITIDA' && (
        <div className="p-2.5 rounded-xl bg-cyan-50 border border-cyan-300 text-[11px] text-cyan-950 space-y-0.5">
          <div className="font-black">
            Resolución Exenta Emitida: {escenarioActivo.numeroResolucion || 'Registrada'}
          </div>
          <div className="text-[10px] text-cyan-800 tabular-nums">
            Fecha: {escenarioActivo.fechaResolucion || 'S/F'}
            {escenarioActivo.fechaVigencia
              ? ` · Vigencia: ${escenarioActivo.fechaVigencia}`
              : ''}
          </div>
        </div>
      )}

      {/* Selector de Escenario + Optimizador Global */}
      <div className="space-y-2">
        <select
          value={escenarioActivoId}
          onChange={e => onChangeEscenarioActivoId(e.target.value)}
          className="w-full px-3 py-2 text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl text-slate-800"
        >
          {escenarios.length === 0 ? (
            <option value="">Sin escenarios creados (crea uno en cabecera)</option>
          ) : (
            escenarios.map(esc => (
              <option key={esc.id} value={esc.id}>
                {esc.nombre} (v{esc.version ?? 1}) [{esc.estado}]
              </option>
            ))
          )}
        </select>

        {flags.flag_simulador_calce_automatico && puedeEditarMovilidad && (
          <button
            type="button"
            onClick={onSugerirCalcesAutomaticos}
            disabled={
              !escenarioActivo ||
              escenarioConsolidado ||
              Boolean(operacionEnCurso)
            }
            className="w-full flex items-center justify-center gap-1.5 py-2 px-3 bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all disabled:opacity-45"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Optimizar Global (Húngaro + 2ª Pasada Rebotes)</span>
          </button>
        )}
      </div>

      {/* Panel Constructor de Calce Manual */}
      <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
        <div className="text-[11px] font-black uppercase tracking-wider text-slate-700">
          Constructor de Calce Manual
        </div>

        <div className="grid grid-cols-1 gap-2">
          <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Origen (Col. 1)
              </span>
              {origenSeleccionado && (
                <button
                  type="button"
                  onClick={onLimpiarOrigen}
                  className="text-[10px] text-rose-600 font-bold hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
            {origenSeleccionado ? (
              <div className="mt-0.5 space-y-0.5">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-slate-900">
                    {origenSeleccionado.nombreDocente}
                  </span>
                  {origenSeleccionado.estamentoPersonal === 'ASISTENTE' && (
                    <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-900 text-[9px] font-black">
                      AA.EE. Ley 21.109
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {origenSeleccionado.carrilLabel} · {origenSeleccionado.horas}h (
                  {Math.round(origenSeleccionado.horas * 60)} min) ·{' '}
                  {origenSeleccionado.calidadJuridica}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic mt-0.5">
                Selecciona un funcionario o solicitud en Columna 1
              </div>
            )}
          </div>

          <div className="p-2 rounded-lg bg-white border border-slate-200 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-slate-400">
                Vacante Destino (Col. 3)
              </span>
              {vacanteDestinoSeleccionada && (
                <button
                  type="button"
                  onClick={onLimpiarVacanteDestino}
                  className="text-[10px] text-rose-600 font-bold hover:underline"
                >
                  Quitar
                </button>
              )}
            </div>
            {vacanteDestinoSeleccionada ? (
              <div className="mt-0.5">
                <div className="font-bold text-slate-900">
                  {vacanteDestinoSeleccionada.asignaturaPrincipal ||
                    vacanteDestinoSeleccionada.nombres}
                </div>
                <div className="text-[11px] text-slate-500 tabular-nums">
                  {colegiosByRbd.get(vacanteDestinoSeleccionada.rbd)?.nombre ||
                    vacanteDestinoSeleccionada.rbd}{' '}
                  · {vacanteDestinoSeleccionada.horasContrato}h (
                  {Math.round(vacanteDestinoSeleccionada.horasContrato * 60)} min)
                  · {inferirFuenteVacante(vacanteDestinoSeleccionada)}
                </div>
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic mt-0.5">
                Selecciona una vacante NN en Columna 3
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Tipo de Cobertura
            </label>
            <select
              value={tipoCobertura}
              onChange={e =>
                onChangeTipoCobertura(
                  e.target.value as 'DEFINITIVA' | 'TRANSITORIA_CONDICIONAL'
                )
              }
              className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg font-semibold"
            >
              <option value="DEFINITIVA">Definitiva (Titular/Planta)</option>
              <option value="TRANSITORIA_CONDICIONAL">
                Transitoria / Condicional
              </option>
            </select>
          </div>

          <label className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200 cursor-pointer self-end">
            <input
              type="checkbox"
              checked={esTrasladoCompleto}
              onChange={e => onChangeEsTrasladoCompleto(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600"
            />
            <span className="text-[11px] font-bold text-slate-700 leading-tight">
              Traslado completo (genera NN-Rebote)
            </span>
          </label>
        </div>

        {puedeEditarMovilidad && (
          <button
            type="button"
            onClick={onSimularYAgregar}
            disabled={
              !escenarioActivo ||
              escenarioConsolidado ||
              !origenSeleccionado ||
              !vacanteDestinoSeleccionada ||
              Boolean(operacionEnCurso)
            }
            className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-40"
          >
            Simular y Agregar al Escenario
          </button>
        )}
      </div>

      {/* Alertas de Cierre Compuerta 4 */}
      {(rebotesPendientesCount > 0 || trasladosSinFirmaCount > 0) &&
        !escenarioConsolidado && (
          <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-[11px] text-amber-950 space-y-1">
            <div className="font-black flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
              <span>Condiciones pendientes para consolidación (Compuerta 4)</span>
            </div>
            {rebotesPendientesCount > 0 && (
              <div>
                • <strong>{rebotesPendientesCount}</strong> vacante(s) NN-Rebote en estado{' '}
                <strong>PENDIENTE</strong>: cierra cada rebote como Cubierta en Cadena o Derivada a Concurso GDP.
              </div>
            )}
            {trasladosSinFirmaCount > 0 && (
              <div>
                • <strong>{trasladosSinFirmaCount}</strong> traslado(s) voluntario(s) aún no alcanzan{' '}
                <strong>ACEPTADO_CON_FIRMA</strong> en Columna 1.
              </div>
            )}
          </div>
        )}

      {/* Lista de Propuestas del Escenario */}
      <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
        {propuestas.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">
            Sin propuestas simuladas en este escenario.
          </p>
        ) : (
          propuestas.map(prop => {
            const estOrigen = colegiosByRbd.get(prop.rbdOrigen);
            const estDestino = colegiosByRbd.get(prop.rbdDestino);
            const barraColor =
              prop.indiceCompatibilidad >= 75
                ? 'bg-emerald-500'
                : prop.indiceCompatibilidad >= 50
                ? 'bg-amber-500'
                : 'bg-rose-500';
            const excede44hMin =
              prop.minutosAsignados > TOPE_MINUTOS_SEMANALES_SLEP;
            const minsLectivos = Math.round(prop.horasPedagogicasAula * 45);
            const docOrig = docentesById.get(prop.docenteOrigenId);
            const desgFallback = docOrig
              ? calcularDesgloseTitularContrata(docOrig)
              : null;
            const minsTitular =
              prop.minutosTitularesOrigen !== undefined
                ? prop.minutosTitularesOrigen
                : desgFallback
                ? desgFallback.horasTitulares * 60
                : undefined;
            const minsContrata =
              prop.minutosContrataOrigen !== undefined
                ? prop.minutosContrataOrigen
                : desgFallback
                ? desgFallback.horasContrata * 60
                : undefined;

            const estadoReboteActual = prop.estadoResolucionRebote || 'PENDIENTE';
            const rebotePendiente =
              prop.generaRebote &&
              Boolean(prop.vacanteRebote) &&
              estadoReboteActual === 'PENDIENTE';
            const reboteMeta = ETIQUETAS_RESOLUCION_REBOTE[estadoReboteActual];
            const intransferibles =
              prop.vacanteRebote?.funcionesIntransferiblesDetectadas || [];

            return (
              <div
                key={prop.id}
                className={`p-3 rounded-xl border space-y-2 ${
                  prop.bloqueaConsolidacion
                    ? 'bg-rose-50/40 border-rose-300'
                    : rebotePendiente
                    ? 'bg-amber-50/30 border-amber-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900">
                        {prop.nombreDocente}
                      </span>
                      {prop.estamentoPersonal === 'ASISTENTE' && (
                        <span className="px-1.5 py-0.2 rounded bg-teal-100 text-teal-900 text-[9px] font-black border border-teal-200">
                          AA.EE. Ley 21.109
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {estOrigen?.nombre || prop.rbdOrigen} →{' '}
                      <span className="font-bold text-slate-800">
                        {estDestino?.nombre || prop.rbdDestino}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                        prop.bloqueaConsolidacion
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : prop.estado === 'CONSOLIDADA'
                          ? 'bg-emerald-600 text-white border-emerald-700'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      }`}
                    >
                      {prop.bloqueaConsolidacion ? 'BLOQUEADA' : prop.estado}
                    </span>
                    {puedeEditarMovilidad && !escenarioConsolidado && (
                      <button
                        type="button"
                        onClick={() => onEliminarPropuesta(prop.id)}
                        className="p-1 text-slate-400 hover:text-rose-600 rounded"
                        title="Eliminar propuesta"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Barra de Compatibilidad */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold mb-1 tabular-nums">
                    <span className="text-slate-600">
                      Índice de Compatibilidad
                    </span>
                    <span className="text-slate-900">
                      {prop.indiceCompatibilidad}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${barraColor}`}
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, prop.indiceCompatibilidad)
                        )}%`
                      }}
                    />
                  </div>
                </div>

                {/* Métricas en Minutos Enteros + Desglose Contractual y Alertas Especiales */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] tabular-nums">
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold border ${
                      excede44hMin
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {formatearMinutosAHoras(prop.minutosAsignados)} (
                    {prop.minutosAsignados}/{TOPE_MINUTOS_SEMANALES_SLEP} min)
                  </span>

                  {prop.estamentoPersonal !== 'ASISTENTE' && (
                    <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 font-bold">
                      {prop.horasPedagogicasAula} HA ({minsLectivos} min aula)
                    </span>
                  )}

                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-semibold">
                    {prop.fuenteDestino} ·{' '}
                    {prop.tipoCobertura === 'DEFINITIVA'
                      ? 'Definitiva'
                      : 'Transitoria'}
                  </span>

                  {(minsTitular !== undefined || minsContrata !== undefined) && (
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 font-bold">
                      {prop.estamentoPersonal === 'ASISTENTE'
                        ? `Indef.: ${formatearMinutosAHoras(
                            minsTitular || 0
                          )} / PF: ${formatearMinutosAHoras(minsContrata || 0)}`
                        : `Titular: ${formatearMinutosAHoras(
                            minsTitular || 0
                          )} / Contrata: ${formatearMinutosAHoras(
                            minsContrata || 0
                          )}`}
                    </span>
                  )}

                  {prop.alertaMenoscaboEconomicoArt50 && (
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-950 border border-amber-300 font-black">
                      Alerta Art. 50 Prioritarios
                    </span>
                  )}

                  {prop.alertaCondicionesDificiles && (
                    <span className="px-1.5 py-0.5 rounded bg-orange-100 text-orange-950 border border-orange-300 font-black">
                      Condiciones Difíciles
                    </span>
                  )}

                  {prop.alertaHabilitacionSeremiDto352 && (
                    <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-300 font-black">
                      Habilitación SEREMI Dto. 352
                    </span>
                  )}

                  {prop.alertaItineranciaRural && (
                    <span className="px-1.5 py-0.5 rounded bg-yellow-100 text-yellow-950 border border-yellow-300 font-black">
                      Itinerancia Rural
                    </span>
                  )}

                  {prop.alertasNormativas.some(
                    a => a.includes('Artículo 69') || a.includes('Art. 69')
                  ) && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-900 font-bold border border-rose-300">
                      Excede Art. 69 (máx 32 HA / {MAX_MINUTOS_LECTIVOS_ART_69}{' '}
                      min)
                    </span>
                  )}
                </div>

                {/* Alertas Normativas / Bloqueos */}
                {(prop.motivoBloqueo || prop.alertasNormativas.length > 0) && (
                  <div className="space-y-1">
                    {prop.motivoBloqueo && (
                      <div className="p-2 rounded-lg bg-rose-100/80 border border-rose-300 text-[10px] text-rose-900 font-bold">
                        Bloqueo: {prop.motivoBloqueo}
                      </div>
                    )}
                    {prop.alertasNormativas.map((alerta, i) => (
                      <div
                        key={i}
                        className="p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-900"
                      >
                        {alerta}
                      </div>
                    ))}
                  </div>
                )}

                {/* Tarjeta Visual Vacante de Rebote (NN-Rebote) + Cierre Obligatorio */}
                {prop.generaRebote && prop.vacanteRebote && (
                  <div className="p-2.5 rounded-xl bg-cyan-50/80 border border-cyan-300 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-[11px] font-black text-cyan-900">
                      <span>Vacante de Rebote (NN-Rebote)</span>
                      <div className="flex items-center gap-1">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-black border ${reboteMeta.badgeClass}`}
                        >
                          {reboteMeta.label}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-cyan-100 text-[10px] tabular-nums">
                          Δ = {prop.vacanteRebote.deltaMinutosCadena} min
                        </span>
                      </div>
                    </div>

                    <div className="text-[10px] text-cyan-800 font-semibold tabular-nums">
                      Origen:{' '}
                      {prop.vacanteRebote.nombreEstablecimientoOrigen ||
                        prop.vacanteRebote.rbdOrigen}{' '}
                      · {prop.vacanteRebote.horasContratoRebote}h (
                      {prop.vacanteRebote.minutosContratoRebote} min) ·{' '}
                      {prop.vacanteRebote.horasPedagogicasAula} HA ·{' '}
                      {prop.vacanteRebote.fuenteFinanciamiento}
                    </div>

                    {prop.vacanteRebote.asignacionesHeredadas.length > 0 && (
                      <div className="text-[10px] text-cyan-900">
                        <span className="font-bold">Aula heredada:</span>{' '}
                        {prop.vacanteRebote.asignacionesHeredadas
                          .map(
                            a => `${a.asignatura} (${a.horasPedagogicasAula} HA)`
                          )
                          .join(', ')}
                      </div>
                    )}

                    {prop.vacanteRebote.funcionesNoLectivasHeredadas.length >
                      0 && (
                      <div className="text-[10px] text-cyan-900">
                        <span className="font-bold">
                          Funciones no lectivas heredadas:
                        </span>{' '}
                        {prop.vacanteRebote.funcionesNoLectivasHeredadas
                          .map(f => `${f.nombre} (${f.horas}h)`)
                          .join(', ')}
                      </div>
                    )}

                    {intransferibles.length > 0 && (
                      <div className="p-1.5 rounded-lg bg-rose-100/80 border border-rose-300 text-[10px] text-rose-950 space-y-0.5">
                        <span className="inline-block px-1.5 py-0.2 rounded bg-rose-700 text-white text-[9px] font-black uppercase mr-1">
                          Funciones Intransferibles
                        </span>
                        <span className="font-semibold">
                          {intransferibles.join(' · ')}
                        </span>
                      </div>
                    )}

                    {/* Selector explícito de cierre de NN-Rebote */}
                    <div className="pt-1.5 border-t border-cyan-200 space-y-1.5">
                      <label className="block text-[10px] font-black text-cyan-950">
                        Cierre de Vacante NN-Rebote (Obligatorio antes de consolidar):
                      </label>
                      <select
                        value={estadoReboteActual}
                        disabled={
                          !puedeEditarMovilidad ||
                          escenarioConsolidado ||
                          Boolean(operacionEnCurso)
                        }
                        onChange={e => {
                          const val = e.target.value;
                          if (
                            val === 'CUBIERTA_EN_CADENA' ||
                            val === 'DERIVADA_A_CONCURSO_GDP'
                          ) {
                            onResolverRebote(
                              prop.id,
                              val,
                              val === 'CUBIERTA_EN_CADENA'
                                ? prop.reboteCubiertoPorPropuestaId
                                : undefined
                            );
                          }
                        }}
                        className={`w-full px-2 py-1 text-[11px] font-bold rounded-lg border ${
                          rebotePendiente
                            ? 'bg-amber-50 border-amber-400 text-amber-950'
                            : 'bg-white border-cyan-300 text-slate-800'
                        }`}
                      >
                        <option value="PENDIENTE" disabled>
                          PENDIENTE (Bloquea consolidación)
                        </option>
                        <option value="CUBIERTA_EN_CADENA">
                          CUBIERTA_EN_CADENA (2ª Pasada / Calce Interno)
                        </option>
                        <option value="DERIVADA_A_CONCURSO_GDP">
                          DERIVADA_A_CONCURSO_GDP (Concurso / Reemplazo GDP)
                        </option>
                      </select>

                      {estadoReboteActual === 'CUBIERTA_EN_CADENA' &&
                        propuestas.length > 1 && (
                          <select
                            value={prop.reboteCubiertoPorPropuestaId || ''}
                            disabled={
                              !puedeEditarMovilidad ||
                              escenarioConsolidado ||
                              Boolean(operacionEnCurso)
                            }
                            onChange={e =>
                              onResolverRebote(
                                prop.id,
                                'CUBIERTA_EN_CADENA',
                                e.target.value || undefined
                              )
                            }
                            className="w-full px-2 py-1 text-[10px] font-semibold bg-white border border-cyan-300 rounded-lg text-slate-700"
                          >
                            <option value="">
                              Vincular propuesta que cubre este rebote (opcional)...
                            </option>
                            {propuestas
                              .filter(other => other.id !== prop.id)
                              .map(other => (
                                <option key={other.id} value={other.id}>
                                  {other.nombreDocente} →{' '}
                                  {colegiosByRbd.get(other.rbdDestino)?.nombre ||
                                    other.rbdDestino}
                                </option>
                              ))}
                          </select>
                        )}

                      {rebotePendiente && (
                        <div className="text-[10px] font-bold text-amber-900 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                          <span>
                            NN-Rebote en PENDIENTE: bloquea la consolidación hasta definir cierre.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Acciones de Compuerta 4 y Compuerta 5 */}
      <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onAbrirCompararGemini}
          disabled={escenarios.length < 2 || Boolean(operacionEnCurso)}
          className="flex-1 min-w-[140px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-bold disabled:opacity-45"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Comparar Escenarios</span>
        </button>

        {escenarioActivo &&
          (escenarioActivo.estado === 'CONSOLIDADO' ||
            escenarioActivo.estado === 'RESOLUCION_EMITIDA') &&
          (puedeConsolidar || puedeValidarGdp) && (
            <button
              type="button"
              onClick={onAbrirResolucionExenta}
              disabled={Boolean(operacionEnCurso)}
              className="flex-1 min-w-[160px] inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-700 text-white text-[11px] font-bold disabled:opacity-45"
            >
              <Award className="w-3.5 h-3.5" />
              <span>Registrar Resolución Exenta</span>
            </button>
          )}

        {escenarioActivo && propuestas.length > 0 && (
          <button
            type="button"
            onClick={onExportarNominaActosGdp}
            disabled={Boolean(operacionEnCurso)}
            className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 text-[11px] font-bold disabled:opacity-45"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-700" />
            <span>Exportar Nómina Actos GDP (.xlsx)</span>
          </button>
        )}
      </div>
    </section>
  );
};
