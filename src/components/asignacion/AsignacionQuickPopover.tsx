import React, { useState, useEffect } from 'react';
import { AlertTriangle, Check, Minus, Plus, Sparkles, X } from 'lucide-react';
import { CursoSae, Docente } from '../../types';
import { CATALOGO_BCEP_PARVULARIA, esNivelParvulario } from '@slep/mineduc-engine';
import { esDocenteEducadoraParvulos } from '../../services/auditoriaDocenteService';
import { ResumenImpactoAsignacion } from '../../services/curricularPlanService';
import { NuevaAsignacionInput } from '../../hooks/useAsignacionDocente';

export interface QuickPopoverSeed {
  curso: CursoSae | null;
  asignatura: string;
  horasSugeridas: number;
  maxHorasPlan?: number;
  esTallerJec?: boolean;
  esTallerSep?: boolean;
  esCoDocencia?: boolean;
  esCoDocenciaParvularia?: boolean;
  esTrabajoColaborativo?: boolean;
  tipoApoyo?: string;
}

interface AsignacionQuickPopoverProps {
  seed: QuickPopoverSeed | null;
  docente: Docente;
  cursos: CursoSae[];
  simular: (
    curso: CursoSae | null,
    horas: number,
    opciones?: {
      esTallerSep?: boolean;
      esTrabajoColaborativo?: boolean;
      esCoDocencia?: boolean;
      esCoDocenciaParvularia?: boolean;
    }
  ) => ResumenImpactoAsignacion | null;
  onConfirmar: (input: NuevaAsignacionInput) => Promise<void>;
  onCerrar: () => void;
}

export const AsignacionQuickPopover: React.FC<AsignacionQuickPopoverProps> = ({
  seed,
  docente,
  cursos,
  simular,
  onConfirmar,
  onCerrar
}) => {
  const [asignatura, setAsignatura] = useState('');
  const [horas, setHoras] = useState(2);
  const [modalidad, setModalidad] = useState<'REGULAR' | 'PARV_CODOCENCIA' | 'TALLER_JEC' | 'TALLER_SEP' | 'CO_DOCENCIA' | 'PIE_COLAB'>('REGULAR');
  const [compartirCursos, setCompartirCursos] = useState(false);
  const [cursosCompartidos, setCursosCompartidos] = useState<string[]>([]);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!seed) return;
    setAsignatura(seed.asignatura);
    setHoras(seed.horasSugeridas > 0 ? seed.horasSugeridas : 2);
    if (seed.esTrabajoColaborativo) setModalidad('PIE_COLAB');
    else if (seed.esTallerSep) setModalidad('TALLER_SEP');
    else if (seed.esCoDocenciaParvularia) setModalidad('PARV_CODOCENCIA');
    else if (seed.esCoDocencia) setModalidad('CO_DOCENCIA');
    else if (seed.esTallerJec) setModalidad('TALLER_JEC');
    else setModalidad('REGULAR');
    setCompartirCursos(false);
    setCursosCompartidos([]);
  }, [seed]);

  if (!seed) return null;

  const esParvulariaCurso = Boolean(seed.curso && esNivelParvulario(seed.curso.nivel));
  const esEducadora = esDocenteEducadoraParvulos(docente);
  const esFlujoParvularia = esParvulariaCurso || (esEducadora && !seed.curso);
  const esTallerSep = modalidad === 'TALLER_SEP';
  const esTrabajoColaborativo = modalidad === 'PIE_COLAB';
  const esTallerJec = modalidad === 'TALLER_JEC';
  const esCoDocenciaParvularia = modalidad === 'PARV_CODOCENCIA';
  const esCoDocencia = modalidad === 'CO_DOCENCIA' || esCoDocenciaParvularia;

  const impacto = simular(seed.curso, horas, {
    esTallerSep,
    esTrabajoColaborativo,
    esCoDocencia,
    esCoDocenciaParvularia
  });
  const esCiencias = /^ciencias naturales$/i.test(asignatura.trim());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asignatura.trim() || horas <= 0) return;
    setGuardando(true);
    try {
      await onConfirmar({
        curso: seed.curso,
        asignatura: asignatura.trim(),
        horas,
        esTallerJec,
        esTallerSep,
        esCoDocencia,
        esCoDocenciaParvularia,
        esTrabajoColaborativo,
        tipoApoyo: esCoDocenciaParvularia
          ? '2DA_EDUCADORA_DTO306'
          : esCoDocencia
          ? 'CO_DOCENCIA'
          : esTrabajoColaborativo
          ? 'Trabajo Colaborativo Art. 86'
          : seed.tipoApoyo,
        cursosCompartidosIds: compartirCursos ? cursosCompartidos : undefined
      });
      onCerrar();
    } finally {
      setGuardando(false);
    }
  };

  const otrosCursos = seed.curso ? cursos.filter(c => c.id !== seed.curso?.id) : [];

  return (
    <div className="fixed inset-0 z-[70] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
      >
        <div className="px-4 py-3 bg-blue-900 text-white flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold leading-tight">Configurar Bloque Horario</h4>
            <p className="text-[11px] text-blue-100">
              {docente.nombres} {docente.apellidos} ·{' '}
              {seed.curso ? `${seed.curso.nivel} ${seed.curso.letra}` : 'Taller Transversal'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            className="p-1 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3.5 text-xs">
          {/* Nombre de la asignatura / taller */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Asignatura, Módulo o Taller
            </label>
            <input
              type="text"
              value={asignatura}
              onChange={e => setAsignatura(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-blue-600 focus:outline-none"
              required
            />
            {esCiencias && (
              <div className="flex flex-wrap items-center gap-1 mt-1.5">
                <span className="text-[10px] text-slate-500 font-semibold">¿Dividir eje?</span>
                {['Biología', 'Física', 'Química'].map(eje => (
                  <button
                    key={eje}
                    type="button"
                    onClick={() => {
                      setAsignatura(eje);
                      setHoras(2);
                    }}
                    className="px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold"
                  >
                    + {eje} (2 HA)
                  </button>
                ))}
              </div>
            )}
            {esFlujoParvularia && (
              <div className="mt-1.5 space-y-1">
                <span className="text-[10px] text-teal-700 font-bold block">
                  Núcleos BCEP / Atención Directa Parvularia (60m cron.):
                </span>
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => setAsignatura('Atención Directa y Co-Docencia Parvularia (DTO 306)')}
                    className="px-2 py-0.5 rounded bg-teal-600 text-white text-[10px] font-bold hover:bg-teal-700"
                  >
                    Atención Directa DTO 306
                  </button>
                  {CATALOGO_BCEP_PARVULARIA.slice(0, 6).map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setAsignatura(b.nucleo)}
                      className="px-2 py-0.5 rounded bg-teal-50 hover:bg-teal-100 text-teal-900 border border-teal-200 text-[10px] font-semibold"
                    >
                      {b.nucleo}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Stepper de horas */}
          <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/70 p-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
            <div>
              <span className="font-bold text-slate-700 dark:text-slate-200 block">
                {esFlujoParvularia ? 'Horas Cronológicas (60m)' : 'Horas a Asignar'}
              </span>
              {seed.maxHorasPlan ? (
                <span className="text-[10px] text-slate-500">
                  {esFlujoParvularia
                    ? `Déficit permanencia: ${seed.maxHorasPlan}h cron.`
                    : `Vacante del plan: ${seed.maxHorasPlan} HA`}
                </span>
              ) : null}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setHoras(h => Math.max(0.25, Math.round((h - 1) * 100) / 100))}
                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <input
                type="number"
                step={esFlujoParvularia ? '0.25' : '0.5'}
                min="0.25"
                max="44"
                value={horas}
                onChange={e => setHoras(Math.max(0.25, Number(e.target.value) || 0.5))}
                className="w-16 text-center py-1 font-mono font-black text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
              />
              <button
                type="button"
                onClick={() => setHoras(h => Math.min(44, Math.round((h + 1) * 100) / 100))}
                className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:bg-slate-100"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Modalidad / Financiamiento */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
              Modalidad / Financiamiento
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { id: 'REGULAR' as const, label: esFlujoParvularia ? 'Titular Parvularia (60m)' : 'Plan Regular', cls: 'border-blue-300 bg-blue-50 text-blue-900' },
                ...(esFlujoParvularia
                  ? [{ id: 'PARV_CODOCENCIA' as const, label: '2da Educadora DTO 306', cls: 'border-teal-300 bg-teal-50 text-teal-900' }]
                  : []),
                { id: 'TALLER_JEC' as const, label: 'Libre Disp. JEC', cls: 'border-amber-300 bg-amber-50 text-amber-900' },
                { id: 'TALLER_SEP' as const, label: 'Taller / Refuerzo SEP', cls: 'border-sky-300 bg-sky-50 text-sky-900' },
                { id: 'CO_DOCENCIA' as const, label: 'Co-Docencia Aula', cls: 'border-indigo-300 bg-indigo-50 text-indigo-900' },
                { id: 'PIE_COLAB' as const, label: 'Trab. Colaborativo PIE', cls: 'border-purple-300 bg-purple-50 text-purple-900' }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModalidad(m.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border text-left transition-all ${
                    modalidad === m.id
                      ? `${m.cls} ring-2 ring-offset-1 ring-blue-500`
                      : 'border-slate-200 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cursos compartidos opcional */}
          {seed.curso && otrosCursos.length > 0 && modalidad === 'REGULAR' && (
            <div className="pt-1">
              <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={compartirCursos}
                  onChange={e => {
                    setCompartirCursos(e.target.checked);
                    if (!e.target.checked) setCursosCompartidos([]);
                  }}
                  className="rounded border-slate-300"
                />
                <span>Agrupación o Electivo Compartido con otros cursos</span>
              </label>
              {compartirCursos && (
                <div className="mt-1.5 flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-slate-50 rounded-lg border border-slate-200">
                  {otrosCursos.map(c => {
                    const checked = cursosCompartidos.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setCursosCompartidos(prev =>
                            checked ? prev.filter(id => id !== c.id) : [...prev, c.id]
                          )
                        }
                        className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          checked
                            ? 'bg-blue-600 text-white border-blue-700'
                            : 'bg-white text-slate-700 border-slate-300'
                        }`}
                      >
                        {c.nivel} {c.letra}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Vista previa de impacto normativo */}
          {impacto && (
            <div
              className={`p-2.5 rounded-xl border text-[11px] space-y-1 ${
                impacto.excedeContrato || impacto.excedeLectivo
                  ? 'bg-rose-50 border-rose-300 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              <div className="flex items-center justify-between font-mono font-bold">
                <span>Saldo actual: {impacto.saldoAntes > 0 ? `+${impacto.saldoAntes}h` : `${impacto.saldoAntes}h`}</span>
                <span>→</span>
                <span>Nuevo saldo: {impacto.saldoDespues > 0 ? `+${impacto.saldoDespues}h` : `${impacto.saldoDespues}h`}</span>
              </div>
              {impacto.advertencia ? (
                <p className="flex items-center gap-1 font-bold">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  {impacto.advertencia}
                </p>
              ) : (
                <p className="flex items-center gap-1 font-semibold">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  Cumple proporción lectiva ({impacto.porcentajeLectivoDespues}% / máx {impacto.porcentajeLimite}%).
                </p>
              )}
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border-t border-slate-200 dark:border-slate-700 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCerrar}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={guardando || !asignatura.trim() || horas <= 0}
            className="px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            <Check className="w-3.5 h-3.5" />
            <span>{guardando ? 'Guardando...' : 'Asignar Bloque'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
