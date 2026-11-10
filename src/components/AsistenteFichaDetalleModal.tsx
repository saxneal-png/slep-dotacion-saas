import React from 'react';
import {
  X,
  User,
  Building2,
  Briefcase,
  Clock,
  FileText,
  ShieldAlert,
  CheckCircle2,
  Coins,
  Printer,
  Calendar,
  AlertTriangle
} from 'lucide-react';
import type { AsistenteConsolidadoTerritorial, EstamentoAsistente } from '../types';
import { imprimirFichaAsistente } from '../services/asistenteFichaImpresionService';

interface AsistenteFichaDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  asistenteConsolidado: AsistenteConsolidadoTerritorial | null;
}

const ESTAMENTO_META: Record<EstamentoAsistente, { label: string; badgeCls: string }> = {
  PROFESIONAL: {
    label: 'Profesional',
    badgeCls: 'bg-purple-500/25 text-purple-200 border-purple-400/40'
  },
  TECNICO: {
    label: 'Técnico',
    badgeCls: 'bg-sky-500/25 text-sky-200 border-sky-400/40'
  },
  ADMINISTRATIVO: {
    label: 'Administrativo',
    badgeCls: 'bg-slate-600/50 text-slate-200 border-slate-500/50'
  },
  AUXILIAR: {
    label: 'Auxiliar de Servicios',
    badgeCls: 'bg-amber-500/25 text-amber-200 border-amber-400/40'
  },
  PARADOCENTE_INSPECTORIA: {
    label: 'Administrativo (Paradocente)',
    badgeCls: 'bg-slate-600/50 text-slate-200 border-slate-500/50'
  }
};

export const AsistenteFichaDetalleModal: React.FC<AsistenteFichaDetalleModalProps> = ({
  isOpen,
  onClose,
  asistenteConsolidado
}) => {
  if (!isOpen || !asistenteConsolidado) return null;

  const asis = asistenteConsolidado;
  const estMeta = ESTAMENTO_META[asis.estamentoPrincipal] || ESTAMENTO_META.ADMINISTRATIVO;
  const { resumenFinanciamiento: rf } = asis;

  const clasificaciones: Array<{ label: string; cls: string }> = [];
  if (asis.esDuplaPsicosocial) {
    clasificaciones.push({ label: 'Dupla Psicosocial', cls: 'bg-pink-100 text-pink-800 border-pink-200' });
  }
  if (asis.esEquipoPie) {
    clasificaciones.push({ label: 'Equipo PIE (Dto. 170)', cls: 'bg-purple-100 text-purple-800 border-purple-200' });
  }
  if (asis.esTecnicoParvulo) {
    clasificaciones.push({ label: 'Técnico en Párvulos', cls: 'bg-blue-100 text-blue-800 border-blue-200' });
  }
  if (asis.esAuxiliarServicio) {
    clasificaciones.push({ label: 'Auxiliar de Servicios', cls: 'bg-amber-100 text-amber-800 border-amber-200' });
  }
  if (asis.esInspectorPatio) {
    clasificaciones.push({ label: 'Inspectoría / Patio', cls: 'bg-slate-100 text-slate-800 border-slate-200' });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera Principal */}
        <div className="bg-[#002B49] text-white p-6 relative shrink-0">
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <button
              type="button"
              onClick={() => imprimirFichaAsistente(asis)}
              title="Imprimir / Guardar en PDF"
              className="p-1.5 rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition-colors"
            >
              <Printer className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-16">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
                <User className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-white">
                    {asis.nombres} {asis.apellidos}
                  </h2>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    RUN: {asis.run}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${estMeta.badgeCls}`}>
                    {estMeta.label} (Ley 21.109)
                  </span>
                  {asis.excedeLimiteSlep ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-200 border border-red-400/50 animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5" /> Infracción SLEP (&gt;44h)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Jornada Legal Conforme
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1.5 flex-wrap">
                  <span className="flex items-center gap-1 font-semibold text-amber-300">
                    <Briefcase className="w-3.5 h-3.5" />
                    {asis.cargosPrincipales.join(' • ') || 'Asistente de la Educación'}
                  </span>
                  <span>•</span>
                  <span className="font-semibold text-orange-400">
                    {asis.contratos.length} contrato(s) en el SLEP
                  </span>
                </div>
              </div>
            </div>

            {/* Totalizador Horario Territorial */}
            <div className="text-right sm:border-l sm:border-slate-700/80 sm:pl-6 shrink-0">
              <div className="text-3xl font-black text-white font-mono">
                {asis.horasTotalesSlep} <span className="text-sm font-semibold text-slate-300 font-sans">hrs/sem</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {asis.horasTotalesSlep <= 44
                  ? `Tope legal: 44 hrs (${44 - asis.horasTotalesSlep}h disponibles)`
                  : `+${asis.excesoHorasSlep}h sobre el tope legal`}
              </div>
            </div>
          </div>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          {/* Tarjetas KPI de Resumen Contractual y Financiamiento */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Clock className="w-4 h-4 text-amber-600" /> Jornada Semanal SLEP
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1 font-mono">
                {asis.horasTotalesSlep} hrs
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {asis.contratos.length} establecimiento(s) asignado(s)
              </div>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <FileText className="w-4 h-4 text-emerald-600" /> Calidad Contractual
              </div>
              <div className="text-xs font-medium text-slate-800 mt-1.5 space-y-0.5 font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">Indefinido:</span>
                  <strong className="text-emerald-800">{rf.indefinido}h</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600 font-sans">Plazo Fijo:</span>
                  <strong className="text-amber-800">{rf.plazoFijo}h</strong>
                </div>
                {rf.honorarios > 0 && (
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-sans">Honorarios:</span>
                    <strong className="text-teal-700">{rf.honorarios}h</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Coins className="w-4 h-4 text-slate-600" /> Fuentes de Financiamiento
              </div>
              <div className="text-xs font-medium text-slate-800 mt-1.5 space-y-0.5 font-mono">
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500 font-sans">Subv. Gen:</span>
                  <span><strong>{rf.subvencionGeneralIndefinido}I</strong> / <strong>{rf.subvencionGeneralPlazoFijo}PF</strong></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-purple-700 font-sans">SEP:</span>
                  <span className="text-purple-700"><strong>{rf.sepIndefinido}I</strong> / <strong>{rf.sepPlazoFijo}PF</strong></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-blue-700 font-sans">PIE:</span>
                  <span className="text-blue-700"><strong>{rf.pieIndefinido}I</strong> / <strong>{rf.piePlazoFijo}PF</strong></span>
                </div>
                {rf.proRetencion > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span className="text-amber-700 font-sans">Pro-Retención:</span>
                    <strong className="text-amber-700">{rf.proRetencion}h</strong>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                <Briefcase className="w-4 h-4 text-blue-600" /> Clasificación Operativa
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {clasificaciones.length > 0 ? (
                  clasificaciones.map((cl, i) => (
                    <span key={i} className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${cl.cls}`}>
                      {cl.label}
                    </span>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-500 italic">
                    Función general de estamento
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Desglose por Establecimiento */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#002B49]" />
                Contratos, Funciones y Detalle DEP / GDP por Establecimiento ({asis.contratos.length})
              </h3>
              <span className="text-xs text-slate-500">
                Estatuto Ley N° 21.109 / Código del Trabajo
              </span>
            </div>

            <div className="space-y-4">
              {asis.contratos.map((c, idx) => {
                const a = c.asistente;
                const ff = c.fuentesFinanciamiento;
                const totalFuentes =
                  ff.subvencionGeneralIndefinido +
                  ff.subvencionGeneralPlazoFijo +
                  ff.sepIndefinido +
                  ff.sepPlazoFijo +
                  ff.pieIndefinido +
                  ff.piePlazoFijo +
                  ff.honorarios +
                  ff.proRetencion;
                const tieneDescuadre = totalFuentes > 0 && Math.abs(totalFuentes - c.horasContrato) > 0.05;

                const tieneMetadataGdp = Boolean(
                  a.descripcionFuncionGdp ||
                  a.accionPmeSep ||
                  a.accionPme ||
                  a.propuestaGdp ||
                  a.estadoSancionGdp ||
                  a.horasAprobadasGdp !== undefined ||
                  a.situacionFinalGdp ||
                  a.horasVigentesAnterior !== undefined ||
                  a.fechaInicioContrato ||
                  a.fechaTerminoContrato ||
                  a.remuneracionMensualApp ||
                  a.remuneracionMensual ||
                  a.observaciones ||
                  a.observacionesDirector ||
                  a.observacionesSlep ||
                  a.observacionesPal
                );

                return (
                  <div key={a.id || idx} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3.5">
                    {/* Encabezado del Colegio */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200/70 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-xs shadow-sm">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">
                            {c.colegio.nombre}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            RBD {c.colegio.rbd} • {c.colegio.comuna}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {a.estadoSancionGdp && (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
                            a.estadoSancionGdp === 'Aprobado'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                              : a.estadoSancionGdp === 'Rechazado'
                              ? 'bg-rose-100 text-rose-800 border-rose-200'
                              : 'bg-amber-100 text-amber-800 border-amber-200'
                          }`}>
                            GDP: {a.estadoSancionGdp}
                          </span>
                        )}
                        <span className="px-3 py-1 bg-slate-900 text-white font-black text-xs rounded-lg font-mono">
                          {c.horasContrato} hrs
                        </span>
                      </div>
                    </div>

                    {/* Cargo y Descripción de Funciones */}
                    <div className="bg-white p-3.5 rounded-lg border border-slate-200/80 space-y-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                            Cargo / Función Desempeñada
                          </span>
                          <span className="text-sm font-bold text-slate-900">
                            {a.cargoFuncion || 'Sin cargo especificado'}
                          </span>
                        </div>
                        {tieneDescuadre && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-semibold">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                            Descuadre fuentes ({totalFuentes}h vs {c.horasContrato}h)
                          </span>
                        )}
                      </div>

                      {a.descripcionFuncionGdp && (
                        <div className="pt-2 border-t border-slate-100 text-xs text-slate-700">
                          <span className="font-bold text-slate-600 block text-[11px] mb-0.5">
                            Descripción Detallada de Funciones (GDP / Establecimiento):
                          </span>
                          <p className="leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                            {a.descripcionFuncionGdp}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Desglose de Fuentes de Financiamiento en este Contrato */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Coins className="w-3 h-3 text-slate-400" />
                        Financiamiento y Calidad Contractual en este Establecimiento:
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-700 block text-xs">Subvención General</span>
                          <div className="flex justify-between text-[11px] text-slate-500 mt-1 font-mono">
                            <span>Indef: <strong>{ff.subvencionGeneralIndefinido}h</strong></span>
                            <span>PF: <strong>{ff.subvencionGeneralPlazoFijo}h</strong></span>
                          </div>
                        </div>
                        <div className="bg-purple-50/40 p-2.5 rounded-lg border border-purple-100">
                          <span className="font-bold text-purple-900 block text-xs">SEP (Ley 20.248)</span>
                          <div className="flex justify-between text-[11px] text-purple-700 mt-1 font-mono">
                            <span>Indef: <strong>{ff.sepIndefinido}h</strong></span>
                            <span>PF: <strong>{ff.sepPlazoFijo}h</strong></span>
                          </div>
                        </div>
                        <div className="bg-blue-50/40 p-2.5 rounded-lg border border-blue-100">
                          <span className="font-bold text-blue-900 block text-xs">PIE (Dec. 170)</span>
                          <div className="flex justify-between text-[11px] text-blue-700 mt-1 font-mono">
                            <span>Indef: <strong>{ff.pieIndefinido}h</strong></span>
                            <span>PF: <strong>{ff.piePlazoFijo}h</strong></span>
                          </div>
                        </div>
                        <div className="bg-teal-50/40 p-2.5 rounded-lg border border-teal-100">
                          <span className="font-bold text-teal-900 block text-xs">Otras Fuentes</span>
                          <div className="flex justify-between text-[11px] text-teal-700 mt-1 font-mono">
                            <span>Hon: <strong>{ff.honorarios}h</strong></span>
                            <span>Pro-R: <strong>{ff.proRetencion}h</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Metadata Contractual / DEP / GDP */}
                    {tieneMetadataGdp && (
                      <div className="bg-indigo-50/40 border border-indigo-100 rounded-lg p-3 text-xs space-y-2">
                        <div className="font-bold text-indigo-950 flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                          <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                          Antecedentes Contractuales, PME y Planilla GDP / PAL
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                          {(a.fechaInicioContrato || a.fechaTerminoContrato) && (
                            <div className="bg-white p-2 rounded border border-indigo-100">
                              <span className="text-slate-400 block">Vigencia Contrato:</span>
                              <strong className="text-slate-800">
                                {a.fechaInicioContrato || '—'} al {a.fechaTerminoContrato || 'Indefinido'}
                              </strong>
                            </div>
                          )}
                          {(a.remuneracionMensualApp || a.remuneracionMensual) && (
                            <div className="bg-white p-2 rounded border border-indigo-100">
                              <span className="text-slate-400 block">Remuneración Mensual:</span>
                              <strong className="text-slate-800 font-mono">
                                ${Number(a.remuneracionMensualApp || a.remuneracionMensual || 0).toLocaleString('es-CL')}
                              </strong>
                            </div>
                          )}
                          {(a.horasVigentesAnterior !== undefined || a.horasAprobadasGdp !== undefined) && (
                            <div className="bg-white p-2 rounded border border-indigo-100">
                              <span className="text-slate-400 block">Horas Vigentes / Aprob. GDP:</span>
                              <strong className="text-slate-800 font-mono">
                                Vig: {a.horasVigentesAnterior ?? '—'}h • Aprob: {a.horasAprobadasGdp ?? '—'}h
                              </strong>
                            </div>
                          )}
                          {(a.accionPmeSep || a.accionPme) && (
                            <div className="bg-white p-2 rounded border border-indigo-100 sm:col-span-2">
                              <span className="text-slate-400 block">Acción PME / SEP:</span>
                              <strong className="text-slate-800">{a.accionPmeSep || a.accionPme}</strong>
                            </div>
                          )}
                          {(a.propuestaGdp || a.situacionFinalGdp) && (
                            <div className="bg-white p-2 rounded border border-indigo-100">
                              <span className="text-slate-400 block">Propuesta / Situación GDP:</span>
                              <strong className="text-slate-800">
                                {[a.propuestaGdp, a.situacionFinalGdp].filter(Boolean).join(' • ')}
                              </strong>
                            </div>
                          )}
                        </div>

                        {(a.observaciones || a.observacionesDirector || a.observacionesSlep || a.observacionesPal) && (
                          <div className="space-y-1 text-[11px] bg-white p-2.5 rounded border border-indigo-100">
                            {a.observaciones && (
                              <div><strong className="text-slate-600">Observaciones:</strong> {a.observaciones}</div>
                            )}
                            {a.observacionesDirector && (
                              <div><strong className="text-slate-600">Obs. Director:</strong> {a.observacionesDirector}</div>
                            )}
                            {a.observacionesSlep && (
                              <div><strong className="text-indigo-700">Obs. SLEP:</strong> {a.observacionesSlep}</div>
                            )}
                            {a.observacionesPal && (
                              <div><strong className="text-purple-700">Obs. PAL:</strong> {a.observacionesPal}</div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-500">
            Total territorial SLEP: <strong>{asis.horasTotalesSlep} horas semanales</strong>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => imprimirFichaAsistente(asis)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir Ficha Oficial
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
            >
              Cerrar Ficha
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
