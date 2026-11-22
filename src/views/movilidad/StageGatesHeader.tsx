import React from 'react';
import {
  AlertTriangle,
  ArrowRightLeft,
  Award,
  Copy,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  Layers,
  Lock,
  PauseCircle,
  Plus,
  Printer,
  RefreshCw,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Unlock
} from 'lucide-react';
import { EscenarioCalce } from '../../types';
import { EstadoPausaRevision } from '../../types/authTypes';
import type { ProyeccionTechoPisoHoras } from '../../services/movilidadTerritorialService';
import { SubTabCol1 } from './movilidadHelpers';
import { evaluarEstadoHitosMovilidad, obtenerHitosDefectoPeriodo } from './movilidadCalendario';

export interface StageGatesHeaderProps {
  periodoActivo: number;
  puedeEditarMovilidad: boolean;
  puedeValidarGdp: boolean;
  puedeConsolidar: boolean;
  operacionEnCurso: string | null;
  escenariosCount: number;
  escenarioActivo: EscenarioCalce | null;
  pausaRevision: EstadoPausaRevision | null;
  previewNnPendientes: number;
  proyeccionTechoPiso: ProyeccionTechoPisoHoras | null;
  kpis: {
    vacantesActivas: number;
    vacantesCondicionales: number;
    egresosConfirmados: number;
    egresosEnTramite: number;
    egresosTotales: number;
    egresosArt19SinReposicionFirme: number;
    solicitudesActivas: number;
    totalSolicitudes: number;
    remanentesCount: number;
    ncTitularesColaCount: number;
    ncTitularesPendientesCount: number;
    asistentesIndefinidosCount: number;
    trasladosCount: number;
  };
  metricasEscenario: {
    totalPropuestas: number;
    propuestasValidas: number;
    propuestasBloqueadas: number;
    rebotesGenerados: number;
    rebotesPendientesCount: number;
    trasladosSinFirmaCount: number;
  };
  consolidacionDeshabilitada: boolean;
  tooltipConsolidacion: string;
  vistaInternaMesa: 'la_mesa' | 'tablero' | 'analisis_no_continuidad';
  casosNoContinuidadCount: number;
  onCambiarVistaInterna: (vista: 'la_mesa' | 'tablero' | 'analisis_no_continuidad') => void;
  onSelectSubTabCola: (tab: SubTabCol1) => void;
  onAbrirNuevoEscenario: () => void;
  onAbrirClonarEscenario: () => void;
  onAbrirEscaneoNn: () => void;
  onActivarPausaRevision: () => void;
  onAbrirConsolidar: () => void;
  onAbrirCompararGemini: () => void;
  onAbrirResolucionExenta: () => void;
  onExportarNominaActosGdp: () => void;
  onAbrirRevertirConsolidacion?: () => void;
  onImprimirActaMesa?: () => void;
  onDescargarActaWord?: () => void;
  onExportarVacantesConcurso?: () => void;
  syncPendientes: number;
  onReintentarSync: () => void;
  reintentandoSync: boolean;
}

export const StageGatesHeader: React.FC<StageGatesHeaderProps> = ({
  periodoActivo,
  puedeEditarMovilidad,
  puedeValidarGdp,
  puedeConsolidar,
  operacionEnCurso,
  escenariosCount,
  escenarioActivo,
  pausaRevision,
  previewNnPendientes,
  proyeccionTechoPiso,
  kpis,
  metricasEscenario,
  consolidacionDeshabilitada,
  tooltipConsolidacion,
  vistaInternaMesa,
  casosNoContinuidadCount,
  onCambiarVistaInterna,
  onSelectSubTabCola,
  onAbrirNuevoEscenario,
  onAbrirClonarEscenario,
  onAbrirEscaneoNn,
  onActivarPausaRevision,
  onAbrirConsolidar,
  onAbrirCompararGemini,
  onAbrirResolucionExenta,
  onExportarNominaActosGdp,
  onAbrirRevertirConsolidacion,
  onImprimirActaMesa,
  onDescargarActaWord,
  onExportarVacantesConcurso,
  syncPendientes,
  onReintentarSync,
  reintentandoSync
}) => {
  const gate1Abierta = Boolean(pausaRevision?.activa) && previewNnPendientes === 0;
  const gate2Abierta =
    kpis.egresosEnTramite === 0 && kpis.egresosArt19SinReposicionFirme === 0;
  const totalColaPriorizada =
    kpis.ncTitularesColaCount +
    kpis.asistentesIndefinidosCount +
    kpis.trasladosCount +
    kpis.remanentesCount;
  const gate3Abierta =
    totalColaPriorizada > 0 && kpis.ncTitularesPendientesCount === 0;
  const gate4Abierta =
    Boolean(escenarioActivo) &&
    metricasEscenario.totalPropuestas > 0 &&
    metricasEscenario.propuestasBloqueadas === 0 &&
    metricasEscenario.rebotesPendientesCount === 0 &&
    metricasEscenario.trasladosSinFirmaCount === 0;
  const esConsolidado = escenarioActivo?.estado === 'CONSOLIDADO';
  const esResolucionEmitida = escenarioActivo?.estado === 'RESOLUCION_EMITIDA';
  const gate5Abierta = esConsolidado || esResolucionEmitida;

  const hoyIso = new Date().toISOString().slice(0, 10);
  const hitosAndon = evaluarEstadoHitosMovilidad(
    obtenerHitosDefectoPeriodo(periodoActivo),
    hoyIso,
    { 1: gate1Abierta, 2: gate2Abierta, 3: gate3Abierta, 4: gate4Abierta, 5: gate5Abierta }
  );
  const hitosAtrasados = hitosAndon.filter(h => h.estado === 'ATRASADO');
  const hitosProximos = hitosAndon.filter(h => h.estado === 'PROXIMO_VENCER');
  const hitoUrgente = hitosAtrasados[0] || hitosProximos[0] || null;

  return (
    <div className="card-elevated p-4 sm:p-5 space-y-4">
      {/* Encabezado Principal + Acciones de Escenario */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-cyan-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <ArrowRightLeft className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-black text-slate-900 dark:text-white tracking-tight">
                Mesa Territorial de Movilidad &amp; Calce SLEP {periodoActivo}
              </h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-indigo-100 text-indigo-800 border border-indigo-200">
                Motor en Minutos Enteros
              </span>
              {escenarioActivo && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-slate-900 text-white tabular-nums">
                  v{escenarioActivo.version ?? 1}
                </span>
              )}
              {esResolucionEmitida && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-cyan-600 text-white border border-cyan-700">
                  RESOLUCION_EMITIDA{' '}
                  {escenarioActivo?.numeroResolucion
                    ? `· Res. Ex. ${escenarioActivo.numeroResolucion}`
                    : ''}
                </span>
              )}
              {syncPendientes > 0 && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-900 border border-amber-300 tabular-nums">
                  <span>
                    {syncPendientes} {syncPendientes === 1 ? 'cambio' : 'cambios'} sin sincronizar
                  </span>
                  <button
                    type="button"
                    onClick={onReintentarSync}
                    disabled={reintentandoSync}
                    className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded bg-amber-700 hover:bg-amber-800 text-white text-[10px] font-black transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-2.5 h-2.5 ${reintentandoSync ? 'animate-spin' : ''}`} />
                    <span>{reintentandoSync ? 'Reintentando...' : 'Reintentar'}</span>
                  </button>
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Flujo gobernado en 5 Compuertas UATP ↔ GDP: saneamiento NN, egresos condicionales, cola Ley 20.903 / Ley 21.109, calce bipartito y actos administrativos.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {puedeEditarMovilidad && (
            <button
              type="button"
              onClick={onAbrirNuevoEscenario}
              disabled={Boolean(operacionEnCurso)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5 text-indigo-600" />
              <span>Nuevo Escenario</span>
            </button>
          )}

          {puedeEditarMovilidad && escenarioActivo && (
            <button
              type="button"
              onClick={onAbrirClonarEscenario}
              disabled={Boolean(operacionEnCurso)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              <Copy className="w-3.5 h-3.5 text-slate-600" />
              <span>Clonar</span>
            </button>
          )}

          {puedeEditarMovilidad && (
            <button
              type="button"
              onClick={onAbrirEscaneoNn}
              disabled={Boolean(operacionEnCurso)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-xs font-bold transition-colors disabled:opacity-50"
            >
              <ScanSearch className="w-3.5 h-3.5 text-amber-600" />
              <span>Escanear y Sanear NN</span>
            </button>
          )}

          {puedeConsolidar && (
            <button
              type="button"
              onClick={onAbrirConsolidar}
              disabled={consolidacionDeshabilitada}
              title={tooltipConsolidacion}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Consolidar Escenario (RPC)</span>
            </button>
          )}
        </div>
      </div>

      {/* ══ 5 Compuertas Stage-Gates UATP ↔ GDP ══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5 pt-2 border-t border-slate-200/80">
        {/* Compuerta 1: Cierre & Saneamiento NN */}
        <div
          className={`p-3 rounded-xl border space-y-2 transition-colors ${
            gate1Abierta
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-amber-50/60 border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
              Compuerta 1 · Cierre &amp; NN
            </span>
            {gate1Abierta ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            )}
          </div>
          <div className="space-y-1 text-[11px] tabular-nums">
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-600">Pausa UATP:</span>
              <span
                className={`px-1.5 py-0.5 rounded font-black text-[10px] ${
                  pausaRevision?.activa
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {pausaRevision?.activa ? 'Activa' : 'Inactiva'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-1">
              <span className="text-slate-600">Pendientes NN:</span>
              <span
                className={`font-black ${
                  previewNnPendientes === 0 ? 'text-emerald-800' : 'text-amber-900'
                }`}
              >
                {previewNnPendientes}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-1 pt-1">
            {!pausaRevision?.activa && puedeConsolidar && (
              <button
                type="button"
                onClick={onActivarPausaRevision}
                disabled={Boolean(operacionEnCurso)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-bold disabled:opacity-50"
                title="Pausar acceso temporal de directores y jefes UTP durante revisión interna"
              >
                <PauseCircle className="w-3 h-3" />
                <span>Activar Pausa</span>
              </button>
            )}
            {puedeEditarMovilidad && (
              <button
                type="button"
                onClick={onAbrirEscaneoNn}
                disabled={Boolean(operacionEnCurso)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-[10px] font-bold disabled:opacity-50"
              >
                <ScanSearch className="w-3 h-3" />
                <span>Sanear NN</span>
              </button>
            )}
          </div>
        </div>

        {/* Compuerta 2: Certeza de Egresos GDP */}
        <div
          onClick={() => onSelectSubTabCola('egresos_gdp')}
          role="button"
          tabIndex={0}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectSubTabCola('egresos_gdp');
            }
          }}
          className={`p-3 rounded-xl border space-y-2 cursor-pointer transition-colors ${
            gate2Abierta
              ? 'bg-emerald-50/60 border-emerald-300 hover:border-emerald-400'
              : 'bg-rose-50/50 border-rose-300 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
              Compuerta 2 · Egresos GDP
            </span>
            {gate2Abierta ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            )}
          </div>
          <div className="space-y-1 text-[11px] tabular-nums">
            <div className="text-slate-700 font-semibold">
              <strong className="text-emerald-800">{kpis.egresosConfirmados}</strong> conf. ·{' '}
              <strong className="text-amber-800">{kpis.egresosEnTramite}</strong> en trámite
            </div>
            {kpis.egresosArt19SinReposicionFirme > 0 && (
              <div className="text-[10px] font-bold text-rose-800">
                {kpis.egresosArt19SinReposicionFirme} Art. 19 S sin CPEIP firme
              </div>
            )}
            <div className="pt-1 border-t border-slate-200/70 text-[10px] font-bold text-slate-700">
              <div>Techo vs Piso (1° mar):</div>
              <div className="text-indigo-900">
                {proyeccionTechoPiso
                  ? `${proyeccionTechoPiso.horasTechoAntes1Marzo}h Techo / ${proyeccionTechoPiso.horasPisoSiEgresanCondicionales}h Piso`
                  : 'Calculando proyección...'}
              </div>
            </div>
          </div>
        </div>

        {/* Compuerta 3: Priorización de Cola */}
        <div
          className={`p-3 rounded-xl border space-y-2 transition-colors ${
            gate3Abierta
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-indigo-50/50 border-indigo-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
              Compuerta 3 · Cola Prioritaria
            </span>
            {gate3Abierta ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-indigo-700 shrink-0" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-1 text-[10px] font-bold tabular-nums">
            <button
              type="button"
              onClick={() => onSelectSubTabCola('no_continuidad')}
              className="px-1.5 py-1 rounded bg-white/90 hover:bg-rose-50 border border-slate-200 text-left text-slate-800"
            >
              NC Tit.: <span className="text-rose-700">{kpis.ncTitularesColaCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSubTabCola('asistentes_indefinidos')}
              className="px-1.5 py-1 rounded bg-white/90 hover:bg-teal-50 border border-slate-200 text-left text-slate-800"
            >
              AA.EE.: <span className="text-teal-700">{kpis.asistentesIndefinidosCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSubTabCola('traslados')}
              className="px-1.5 py-1 rounded bg-white/90 hover:bg-indigo-50 border border-slate-200 text-left text-slate-800"
            >
              Trasl.: <span className="text-indigo-700">{kpis.trasladosCount}</span>
            </button>
            <button
              type="button"
              onClick={() => onSelectSubTabCola('remanentes')}
              className="px-1.5 py-1 rounded bg-white/90 hover:bg-amber-50 border border-slate-200 text-left text-slate-800"
            >
              Rem.: <span className="text-amber-800">{kpis.remanentesCount}</span>
            </button>
          </div>
        </div>

        {/* Compuerta 4: Simulación & Consenso */}
        <div
          className={`p-3 rounded-xl border space-y-2 transition-colors ${
            gate4Abierta
              ? 'bg-emerald-50/60 border-emerald-300'
              : 'bg-amber-50/50 border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
              Compuerta 4 · Simulación
            </span>
            {gate4Abierta ? (
              <Unlock className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            )}
          </div>
          <div className="space-y-1 text-[10px] tabular-nums">
            <div className="flex items-center justify-between gap-1 font-bold text-slate-800">
              <span className="truncate">
                {escenarioActivo ? escenarioActivo.nombre : 'Sin escenario'}
              </span>
              {escenarioActivo && (
                <span className="px-1.5 py-0.2 rounded bg-slate-900 text-white shrink-0">
                  v{escenarioActivo.version ?? 1}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-1 font-bold">
              <span
                className={`px-1.5 py-0.5 rounded ${
                  metricasEscenario.propuestasBloqueadas > 0
                    ? 'bg-rose-100 text-rose-800'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                Bloq: {metricasEscenario.propuestasBloqueadas}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${
                  metricasEscenario.rebotesPendientesCount > 0
                    ? 'bg-amber-200 text-amber-950'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                Rebotes Pend: {metricasEscenario.rebotesPendientesCount}
              </span>
              <span
                className={`px-1.5 py-0.5 rounded ${
                  metricasEscenario.trasladosSinFirmaCount > 0
                    ? 'bg-amber-200 text-amber-950'
                    : 'bg-white text-slate-700 border border-slate-200'
                }`}
              >
                Sin Firma: {metricasEscenario.trasladosSinFirmaCount}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onAbrirCompararGemini}
            disabled={escenariosCount < 2 || Boolean(operacionEnCurso)}
            title={
              escenariosCount < 2
                ? 'Requiere al menos 2 escenarios para comparar con Gemini'
                : 'Comparar dos escenarios What-If con asistente Gemini'
            }
            className="w-full inline-flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold disabled:opacity-45"
          >
            <Sparkles className="w-3 h-3" />
            <span>Comparar Escenarios (Gemini)</span>
          </button>
        </div>

        {/* Compuerta 5: Consolidación & Actos */}
        <div
          className={`p-3 rounded-xl border space-y-2 transition-colors ${
            esResolucionEmitida
              ? 'bg-cyan-50/70 border-cyan-400'
              : esConsolidado
              ? 'bg-emerald-50/70 border-emerald-300'
              : 'bg-slate-50 border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-800">
              Compuerta 5 · Actos GDP
            </span>
            {gate5Abierta ? (
              <Unlock className="w-3.5 h-3.5 text-cyan-700 shrink-0" />
            ) : (
              <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            )}
          </div>
          <div className="text-[10px] font-bold">
            {esResolucionEmitida ? (
              <span className="inline-block px-2 py-0.5 rounded bg-cyan-600 text-white">
                RESOLUCION_EMITIDA · {escenarioActivo?.numeroResolucion || 'S/N'}
              </span>
            ) : esConsolidado ? (
              <span className="inline-block px-2 py-0.5 rounded bg-emerald-600 text-white">
                CONSOLIDADO (Pend. Res. Exenta)
              </span>
            ) : (
              <span className="text-slate-500">Pendiente consolidación RPC</span>
            )}
          </div>
          <div className="flex flex-wrap gap-1">
            {puedeConsolidar && !gate5Abierta && (
              <button
                type="button"
                onClick={onAbrirConsolidar}
                disabled={consolidacionDeshabilitada}
                title={tooltipConsolidacion}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold disabled:opacity-45"
              >
                <FileCheck2 className="w-3 h-3" />
                <span>Consolidar (RPC)</span>
              </button>
            )}
            {(esConsolidado || esResolucionEmitida) &&
              (puedeConsolidar || puedeValidarGdp) && (
                <button
                  type="button"
                  onClick={onAbrirResolucionExenta}
                  disabled={Boolean(operacionEnCurso)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white text-[10px] font-bold disabled:opacity-45"
                >
                  <Award className="w-3 h-3" />
                  <span>Registrar Resolución Exenta</span>
                </button>
              )}
            {escenarioActivo && metricasEscenario.totalPropuestas > 0 && (
              <button
                type="button"
                onClick={onExportarNominaActosGdp}
                disabled={Boolean(operacionEnCurso)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold disabled:opacity-45"
              >
                <FileSpreadsheet className="w-3 h-3 text-emerald-700" />
                <span>Exportar Nómina Actos GDP (.xlsx)</span>
              </button>
            )}
            {puedeConsolidar && esConsolidado && onAbrirRevertirConsolidacion && (
              <button
                type="button"
                onClick={onAbrirRevertirConsolidacion}
                disabled={Boolean(operacionEnCurso)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-300 text-[10px] font-bold disabled:opacity-45"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Revertir Consolidación</span>
              </button>
            )}
            {escenarioActivo && onImprimirActaMesa && (
              <button
                type="button"
                onClick={onImprimirActaMesa}
                disabled={Boolean(operacionEnCurso)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold disabled:opacity-45"
              >
                <Printer className="w-3 h-3 text-indigo-700" />
                <span>Imprimir Acta</span>
              </button>
            )}
            {escenarioActivo && onDescargarActaWord && (
              <button
                type="button"
                onClick={onDescargarActaWord}
                disabled={Boolean(operacionEnCurso)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold disabled:opacity-45"
              >
                <FileText className="w-3 h-3 text-blue-700" />
                <span>Acta Word (.doc)</span>
              </button>
            )}
            {escenarioActivo && onExportarVacantesConcurso && (
              <button
                type="button"
                onClick={onExportarVacantesConcurso}
                disabled={Boolean(operacionEnCurso)}
                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-[10px] font-bold disabled:opacity-45"
              >
                <FileSpreadsheet className="w-3 h-3 text-amber-700" />
                <span>Vacantes Concurso (.xlsx)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Franja Andon de Calendario e Hitos */}
      {hitoUrgente && (
        <div
          className={`px-3 py-2 rounded-xl border text-[11px] flex flex-wrap items-center justify-between gap-2 tabular-nums ${
            hitosAtrasados.length > 0
              ? 'bg-rose-50 border-rose-300 text-rose-950'
              : 'bg-amber-50 border-amber-300 text-amber-950'
          }`}
        >
          <div className="flex items-center gap-2 font-bold">
            <AlertTriangle
              className={`w-3.5 h-3.5 shrink-0 ${
                hitosAtrasados.length > 0 ? 'text-rose-600' : 'text-amber-600'
              }`}
            />
            <span>
              Alerta Andon: {hitosAtrasados.length} hito(s) atrasado(s) · {hitosProximos.length} próximo(s) a vencer
            </span>
          </div>
          <div className="text-[11px] font-semibold">
            Más urgente: <strong>Compuerta {hitoUrgente.compuerta} ({hitoUrgente.titulo})</strong> — fecha límite{' '}
            <span className="font-mono font-bold">{hitoUrgente.fechaLimiteIso}</span>
          </div>
        </div>
      )}

      {/* KPIs Ejecutivos en tabular-nums */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-200/80">
        <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Vacantes NN Activas
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-amber-900">
              {kpis.vacantesActivas}
            </span>
            <span className="text-[11px] font-semibold text-amber-700">
              ({kpis.vacantesCondicionales} condicionales)
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-rose-800">
            Egresos Proyectados GDP
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-rose-900">
              {kpis.egresosTotales}
            </span>
            <span className="text-[11px] font-semibold text-rose-700">
              {kpis.egresosConfirmados} confirmados · {kpis.egresosEnTramite} en trámite
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
            Solicitudes en Cola
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-indigo-900">
              {kpis.solicitudesActivas}
            </span>
            <span className="text-[11px] font-semibold text-indigo-700">
              de {kpis.totalSolicitudes} totales · {kpis.remanentesCount} remanentes
            </span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600 truncate">
            Escenario: {escenarioActivo ? escenarioActivo.nombre : 'Sin escenario'}
          </div>
          <div className="mt-1 flex items-center gap-2 text-[11px] font-bold tabular-nums flex-wrap">
            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              Válidas: {metricasEscenario.propuestasValidas}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-800">
              Bloq.: {metricasEscenario.propuestasBloqueadas}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800">
              Rebotes: {metricasEscenario.rebotesGenerados}
            </span>
          </div>
        </div>
      </div>

      {/* Selector de Modo del Módulo */}
      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/80">
        <button
          type="button"
          onClick={() => onCambiarVistaInterna('la_mesa')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            vistaInternaMesa === 'la_mesa'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>La Mesa (Vista Guiada)</span>
        </button>
        <button
          type="button"
          onClick={() => onCambiarVistaInterna('tablero')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            vistaInternaMesa === 'tablero'
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Tablero de Calce Territorial (3 Columnas)</span>
        </button>
        <button
          type="button"
          onClick={() => onCambiarVistaInterna('analisis_no_continuidad')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
            vistaInternaMesa === 'analisis_no_continuidad'
              ? 'bg-rose-700 text-white shadow-xs'
              : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
          }`}
        >
          <FileSpreadsheet className="w-3.5 h-3.5" />
          <span>
            Análisis &amp; Exportación No Continuidad (Docentes y AA.EE.)
          </span>
          <span
            className={`px-1.5 py-0.2 rounded-full text-[10px] font-black tabular-nums ${
              vistaInternaMesa === 'analisis_no_continuidad'
                ? 'bg-white/20 text-white'
                : 'bg-rose-200 text-rose-900'
            }`}
          >
            {casosNoContinuidadCount}
          </span>
        </button>
      </div>
    </div>
  );
};
