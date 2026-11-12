import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { Docente } from '../../types';
import { ResumenImpactoAsignacion } from '../../services/curricularPlanService';

interface DocenteSaldoStickyBarProps {
  docente: Docente;
  contratoSubvGen: number;
  contratoSep: number;
  contratoPie: number;
  totalHaLectivas: number;
  contratoCalculadoTotal: number;
  horasNoAulaTotales: number;
  saldoHoras: number;
  porcentajeLectivoReal: number;
  porcentajeLimitePonderado: number;
  esInfractorExcesoLectivo: boolean;
  minutosRecreoTotal: number;
  minutosHnlTotal: number;
  previewImpacto?: {
    etiqueta: string;
    impacto: ResumenImpactoAsignacion;
  } | null;
}

export const DocenteSaldoStickyBar: React.FC<DocenteSaldoStickyBarProps> = ({
  docente,
  contratoSubvGen,
  contratoSep,
  contratoPie,
  totalHaLectivas,
  contratoCalculadoTotal,
  horasNoAulaTotales,
  saldoHoras,
  porcentajeLectivoReal,
  porcentajeLimitePonderado,
  esInfractorExcesoLectivo,
  minutosRecreoTotal,
  minutosHnlTotal,
  previewImpacto
}) => {
  const contratoTotal = Math.max(0, Number(docente.horasContrato || 0));
  const pctOcupado = contratoTotal > 0 ? Math.min(100, Math.round((contratoCalculadoTotal / contratoTotal) * 100)) : 0;

  return (
    <div className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-700 px-4 py-3 space-y-2.5 backdrop-blur-xs">
      {/* Fila 1: Fuentes contractuales + Progreso de ocupación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-bold">
            Contrato: {contratoTotal}h
          </span>
          {contratoSubvGen > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 font-bold">
              Subv. Gral: {contratoSubvGen}h
            </span>
          )}
          {contratoSep > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-sky-100 text-sky-900 border border-sky-200 font-bold">
              SEP: {contratoSep}h
            </span>
          )}
          {contratoPie > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 font-bold">
              PIE: {contratoPie}h
            </span>
          )}
          {docente.asignaturaPrincipal && (
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200 font-sans font-bold">
              Esp: {docente.asignaturaPrincipal}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
          <span className="inline-flex items-center gap-1 font-mono">
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            Recreo: <strong>{Math.floor(minutosRecreoTotal / 60)}h {minutosRecreoTotal % 60}m</strong>
          </span>
          <span className="inline-flex items-center gap-1 font-mono">
            HNL: <strong>{Math.floor(minutosHnlTotal / 60)}h {minutosHnlTotal % 60}m</strong>
          </span>
        </div>
      </div>

      {/* Fila 2: 4 KPIs tabulares compactos + Barra de ocupación */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Aula Asignada</span>
          <span className="text-base font-black font-mono text-blue-700 dark:text-blue-400">{totalHaLectivas} HA</span>
          <span className={`ml-1.5 text-[10px] font-bold font-mono ${esInfractorExcesoLectivo ? 'text-rose-600' : 'text-slate-500'}`}>
            ({porcentajeLectivoReal}% / máx {porcentajeLimitePonderado}%)
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">No Aula / Exentas</span>
          <span className="text-base font-black font-mono text-purple-700 dark:text-purple-400">{horasNoAulaTotales}h</span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Contrato Calculado</span>
          <div className="flex items-center justify-between gap-2">
            <span className="text-base font-black font-mono text-slate-900 dark:text-white">{contratoCalculadoTotal}h</span>
            <span className="text-[10px] font-mono text-slate-500">{pctOcupado}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-1">
            <div
              className={`h-full transition-all duration-200 ${
                saldoHoras < 0 ? 'bg-rose-600' : saldoHoras === 0 ? 'bg-emerald-500' : 'bg-blue-600'
              }`}
              style={{ width: `${pctOcupado}%` }}
            />
          </div>
        </div>

        <div
          className={`rounded-lg px-2.5 py-1.5 border ${
            saldoHoras > 0
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-800'
              : saldoHoras < 0
              ? 'bg-rose-50/90 border-rose-300 text-rose-800'
              : 'bg-slate-100 border-slate-200 text-slate-700'
          }`}
        >
          <span className="text-[10px] font-bold uppercase opacity-75 block">Saldo Disponible</span>
          <div className="flex items-center justify-between">
            <span className="text-base font-black font-mono">
              {saldoHoras > 0 ? `+${saldoHoras}h` : `${saldoHoras}h`}
            </span>
            <span className="text-[10px] font-bold flex items-center gap-1">
              {saldoHoras < 0 ? (
                <>
                  <AlertTriangle className="w-3 h-3" /> Sobreasignado
                </>
              ) : saldoHoras === 0 ? (
                <>
                  <CheckCircle2 className="w-3 h-3" /> Exacto
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3 h-3" /> Libres
                </>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Simulación previa en vivo al hacer hover sobre cualquier vacante */}
      {previewImpacto && (
        <div
          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold flex flex-wrap items-center justify-between gap-2 border transition-all ${
            previewImpacto.impacto.excedeContrato || previewImpacto.impacto.excedeLectivo
              ? 'bg-rose-50 border-rose-300 text-rose-800'
              : 'bg-blue-50 border-blue-200 text-blue-900'
          }`}
        >
          <span>
            Simulación <strong>{previewImpacto.etiqueta}</strong>: Contrato calc.{' '}
            <span className="font-mono font-bold">{previewImpacto.impacto.contratoCalculadoDespues}h</span> → Saldo{' '}
            <span className="font-mono font-bold">
              {previewImpacto.impacto.saldoDespues > 0
                ? `+${previewImpacto.impacto.saldoDespues}h`
                : `${previewImpacto.impacto.saldoDespues}h`}
            </span>
          </span>
          {previewImpacto.impacto.advertencia && (
            <span className="inline-flex items-center gap-1 font-bold">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {previewImpacto.impacto.advertencia}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
