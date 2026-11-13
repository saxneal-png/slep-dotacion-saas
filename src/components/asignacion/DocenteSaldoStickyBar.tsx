import React from 'react';
import { AlertTriangle, CheckCircle2, Clock, ShieldCheck } from 'lucide-react';
import { Docente } from '../../types';
import { ResumenImpactoAsignacion } from '../../services/curricularPlanService';

interface DocenteSaldoStickyBarProps {
  docente: Docente;
  contratoSubvGen: number;
  contratoSep: number;
  contratoPie: number;
  sepAsignado?: number;
  pieAsignado?: number;
  horasInstitucionalesSubvGen?: number;
  totalHaLectivas: number;
  contratoCalculadoTotal: number;
  horasNoAulaTotales: number;
  saldoHoras: number;
  porcentajeLectivoReal: number;
  porcentajeLimitePonderado: number;
  esInfractorExcesoLectivo: boolean;
  minutosRecreoTotal: number;
  minutosHnlTotal: number;
  minutosPlanificacion40?: number;
  isEducadoraParvulo?: boolean;
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
  sepAsignado = 0,
  pieAsignado = 0,
  horasInstitucionalesSubvGen = 0,
  totalHaLectivas,
  contratoCalculadoTotal,
  horasNoAulaTotales,
  saldoHoras,
  porcentajeLectivoReal,
  porcentajeLimitePonderado,
  esInfractorExcesoLectivo,
  minutosRecreoTotal,
  minutosHnlTotal,
  minutosPlanificacion40,
  isEducadoraParvulo = false,
  previewImpacto
}) => {
  const contratoTotal = Math.max(0, Number(docente.horasContrato || 0));
  const pctOcupado = contratoTotal > 0 ? Math.min(100, Math.round((contratoCalculadoTotal / contratoTotal) * 100)) : 0;
  const plan40Mins = minutosPlanificacion40 ?? Math.round(minutosHnlTotal * 0.4);
  const hnl60Mins = Math.max(0, minutosHnlTotal - plan40Mins);
  const aulaCronMins = isEducadoraParvulo ? Math.round(totalHaLectivas * 60) : Math.round(totalHaLectivas * 45);
  const exentoMins = Math.max(0, Math.round(horasNoAulaTotales * 60));
  const totalBaseMins = Math.max(1, contratoTotal * 60, aulaCronMins + minutosRecreoTotal + minutosHnlTotal + exentoMins);
  const pctBar = (m: number) => Math.max(0, Math.min(100, Math.round((m / totalBaseMins) * 1000) / 10));
  const fmtMins = (m: number) => `${Math.floor(Math.max(0, m) / 60)}h ${Math.max(0, m) % 60}m`;

  const sepExcedido = sepAsignado > contratoSep + 0.05;
  const pieExcedido = pieAsignado > contratoPie + 0.05;

  return (
    <div className="bg-slate-50/95 dark:bg-slate-900/95 border-b border-slate-200 dark:border-slate-700 px-4 py-3 space-y-2 backdrop-blur-xs">
      {/* Fila 1: Fuentes contractuales (con avance SEP/PIE) + Recreo / HNL / 40% Planificación */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
          <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white font-bold">
            Contrato: {contratoTotal}h
          </span>
          {isEducadoraParvulo && (
            <span
              className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-300 font-sans font-extrabold"
              title="Cálculo normativo Educación Parvularia en horas cronológicas reales de 60 minutos (DTO 306/2007)"
            >
              Parvularia DTO 306 · 60m
            </span>
          )}
          {contratoSubvGen > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-900 border border-blue-200 font-bold">
              Subv. Gral: {contratoSubvGen}h
            </span>
          )}
          {(contratoSep > 0 || sepAsignado > 0) && (
            <span
              className={`px-2 py-0.5 rounded-full border font-bold ${
                sepExcedido
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : sepAsignado > 0 && sepAsignado >= contratoSep - 0.05
                  ? 'bg-sky-600 text-white border-sky-700'
                  : 'bg-sky-100 text-sky-900 border-sky-200'
              }`}
              title={`SEP asignado: ${sepAsignado}h de ${contratoSep}h contratadas`}
            >
              SEP {Math.round(sepAsignado * 10) / 10}/{contratoSep}h
            </span>
          )}
          {(contratoPie > 0 || pieAsignado > 0) && (
            <span
              className={`px-2 py-0.5 rounded-full border font-bold ${
                pieExcedido
                  ? 'bg-rose-100 text-rose-900 border-rose-300'
                  : pieAsignado > 0 && pieAsignado >= contratoPie - 0.05
                  ? 'bg-purple-600 text-white border-purple-700'
                  : 'bg-purple-100 text-purple-900 border-purple-200'
              }`}
              title={`PIE asignado: ${pieAsignado}h de ${contratoPie}h contratadas`}
            >
              PIE {Math.round(pieAsignado * 10) / 10}/{contratoPie}h
            </span>
          )}
          {docente.asignaturaPrincipal && (
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-900 border border-orange-200 font-sans font-bold">
              Esp: {docente.asignaturaPrincipal}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600 dark:text-slate-300 font-mono">
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-900 border border-amber-200/80"
            title="Minutos cronológicos de recreo según tablas MINEDUC"
          >
            <Clock className="w-3 h-3 text-amber-600" />
            Recreo: <strong>{fmtMins(minutosRecreoTotal)}</strong>
          </span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200"
            title="Total Horas No Lectivas cronológicas"
          >
            HNL: <strong>{fmtMins(minutosHnlTotal)}</strong>
          </span>
          <span
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-900 border border-emerald-200/80"
            title="40% exclusivo de HNL para preparación de la enseñanza (Ley 20.903)"
          >
            40% Plan: <strong>{fmtMins(plan40Mins)}</strong>
          </span>
        </div>
      </div>

      {/* Fila 2: 4 KPIs tabulares compactos + Barra de ocupación */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">
            {isEducadoraParvulo ? 'Aula Parv. (60m cron.)' : 'Aula Asignada'}
          </span>
          <span className={`text-base font-black font-mono ${isEducadoraParvulo ? 'text-teal-700 dark:text-teal-400' : 'text-blue-700 dark:text-blue-400'}`}>
            {totalHaLectivas} {isEducadoraParvulo ? 'h' : 'HA'}
          </span>
          <span className={`ml-1.5 text-[10px] font-bold font-mono ${esInfractorExcesoLectivo ? 'text-rose-600' : 'text-slate-500'}`}>
            ({porcentajeLectivoReal}% / máx {porcentajeLimitePonderado}%)
          </span>
        </div>

        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">No Aula / Exentas</span>
          <div className="flex items-baseline justify-between gap-1">
            <span className="text-base font-black font-mono text-purple-700 dark:text-purple-400">{horasNoAulaTotales}h</span>
            {(horasInstitucionalesSubvGen > 0 || sepAsignado > 0 || pieAsignado > 0) && (
              <span className="text-[9px] font-mono text-slate-500 truncate">
                {[
                  horasInstitucionalesSubvGen > 0 ? `Inst ${horasInstitucionalesSubvGen}h` : '',
                  sepAsignado > 0 ? `SEP ${Math.round(sepAsignado * 10) / 10}h` : '',
                  pieAsignado > 0 ? `PIE ${Math.round(pieAsignado * 10) / 10}h` : ''
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
            )}
          </div>
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

      {/* Micro-barra segmentada de composición de jornada (4px, sin ruido visual) */}
      <div
        className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden flex"
        title={`Distribución jornada: Aula ${fmtMins(aulaCronMins)} · Recreo ${fmtMins(minutosRecreoTotal)} · HNL 60% ${fmtMins(hnl60Mins)} · Planif. 40% ${fmtMins(plan40Mins)} · Exentas ${fmtMins(exentoMins)}`}
      >
        <div className="bg-blue-600 transition-all" style={{ width: `${pctBar(aulaCronMins)}%` }} />
        <div className="bg-amber-400 transition-all" style={{ width: `${pctBar(minutosRecreoTotal)}%` }} />
        <div className="bg-slate-400 transition-all" style={{ width: `${pctBar(hnl60Mins)}%` }} />
        <div className="bg-emerald-500 transition-all" style={{ width: `${pctBar(plan40Mins)}%` }} />
        <div className="bg-purple-500 transition-all" style={{ width: `${pctBar(exentoMins)}%` }} />
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
