import React from 'react';
import { 
  X, 
  User, 
  Building2, 
  BookOpen, 
  Clock, 
  Coffee, 
  FileText, 
  ShieldAlert, 
  CheckCircle2, 
  Scale, 
  Layers, 
  Coins, 
  GraduationCap,
  AlertTriangle
} from 'lucide-react';
import type { DocenteConsolidadoTerritorial, ContratoDocenteColegio } from '../types';

interface DocenteFichaDetalleModalProps {
  isOpen: boolean;
  onClose: () => void;
  docenteConsolidado: DocenteConsolidadoTerritorial | null;
}

export const DocenteFichaDetalleModal: React.FC<DocenteFichaDetalleModalProps> = ({
  isOpen,
  onClose,
  docenteConsolidado
}) => {
  if (!isOpen || !docenteConsolidado) return null;

  const doc = docenteConsolidado;

  // Formato minutos a "X h Y m"
  const formatMins = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const totalMinutosRecreo = doc.contratos.reduce((s, c) => s + c.minutosRecreoMineduc, 0);
  const totalMinutosNoLectivos = doc.contratos.reduce((s, c) => s + c.minutosNoLectivosMineduc, 0);
  const totalMinutosLectivos = doc.contratos.reduce((s, c) => s + c.horasPedagogicasAsignadas * 45, 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera Principal */}
        <div className="bg-[#002B49] text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pr-8">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
                <User className="w-7 h-7" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-black text-white">
                    {doc.nombres} {doc.apellidos}
                  </h2>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    RUN: {doc.run}
                  </span>
                  {doc.excedeLimiteSlep ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/30 text-red-300 border border-red-500/50 animate-pulse">
                      <ShieldAlert className="w-3.5 h-3.5" /> Infracción SLEP (&gt;44h)
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Carga Legal Conforme
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-300 mt-1.5 flex-wrap">
                  {doc.titulo && (
                    <span className="flex items-center gap-1">
                      <GraduationCap className="w-3.5 h-3.5 text-blue-400" /> {doc.titulo}
                    </span>
                  )}
                  <span>•</span>
                  <span>{doc.estamentoPrincipal.replace('_', ' ')}</span>
                  <span>•</span>
                  <span className="font-semibold text-orange-400">
                    {doc.contratos.length} contrato(s) en el SLEP
                  </span>
                </div>
              </div>
            </div>

            {/* Totalizador Horario Territorial */}
            <div className="text-right sm:border-l sm:border-slate-700/80 sm:pl-6 shrink-0">
              <div className="text-3xl font-black text-white">
                {doc.horasTotalesSlep} <span className="text-sm font-semibold text-slate-300">hrs/sem</span>
              </div>
              <div className="text-[11px] text-slate-400">
                {doc.horasTotalesSlep <= 44 ? `Tope legal: 44 hrs (${44 - doc.horasTotalesSlep}h disponibles)` : `+${doc.excesoHorasSlep}h sobre el tope legal`}
              </div>
            </div>
          </div>
        </div>

        {/* Cuerpo con Scroll */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* Tarjetas KPI de Distribución General de Tiempo */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-blue-50/70 p-3.5 rounded-xl border border-blue-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
                <BookOpen className="w-4 h-4 text-blue-600" /> Aula Lectiva
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {doc.totalHorasPedagogicasAula} <span className="text-xs font-normal text-slate-500">HA</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono mt-0.5">
                {formatMins(totalMinutosLectivos)} cronológicos
              </div>
            </div>

            <div className="bg-amber-50/70 p-3.5 rounded-xl border border-amber-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <Coffee className="w-4 h-4 text-amber-600" /> Recreos MINEDUC
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatMins(totalMinutosRecreo)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Proporcional oficial por ley
              </div>
            </div>

            <div className="bg-emerald-50/70 p-3.5 rounded-xl border border-emerald-100">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <FileText className="w-4 h-4 text-emerald-600" /> Tiempo No Lectivo
              </div>
              <div className="text-xl font-bold text-slate-900 mt-1">
                {formatMins(totalMinutosNoLectivos)}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Planificación & evaluación
              </div>
            </div>

            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                <Coins className="w-4 h-4 text-slate-600" /> Fuentes de Financiación (7 Métricas)
              </div>
              <div className="text-xs font-medium text-slate-800 mt-1.5 space-y-0.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Contrato:</span>
                  <strong className="text-slate-900">{doc.horasTotalesSlep}h</strong>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-slate-500">Subv. Gen:</span>
                  <span><strong>{doc.resumenFinanciamiento.subvencionGeneralTitular || 0}T</strong> / <strong>{doc.resumenFinanciamiento.subvencionGeneralContrata || 0}C</strong></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-purple-700">SEP:</span>
                  <span className="text-purple-700"><strong>{doc.resumenFinanciamiento.sepTitular || 0}T</strong> / <strong>{doc.resumenFinanciamiento.sepContrata || 0}C</strong></span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span className="text-blue-700">PIE:</span>
                  <span className="text-blue-700"><strong>{doc.resumenFinanciamiento.pieTitular || 0}T</strong> / <strong>{doc.resumenFinanciamiento.pieContrata || 0}C</strong></span>
                </div>
              </div>
            </div>
          </div>

          {/* Desglose por Establecimiento Escolar */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-[#002B49]" />
                Contratos y Carga Horaria por Establecimiento ({doc.contratos.length})
              </h3>
              <span className="text-xs text-slate-500">
                Tablas oficiales MINEDUC aplicadas por escuela
              </span>
            </div>

            <div className="space-y-4">
              {doc.contratos.map((c, idx) => {
                const subTit = c.fuentesFinanciamiento.subvencionGeneralTitular;
                const subCon = c.fuentesFinanciamiento.subvencionGeneralContrata;
                const sepTit = c.fuentesFinanciamiento.sepTitular;
                const sepCon = c.fuentesFinanciamiento.sepContrata;
                const pieTit = c.fuentesFinanciamiento.pieTitular;
                const pieCon = c.fuentesFinanciamiento.pieContrata;

                return (
                  <div key={idx} className="bg-slate-50/70 border border-slate-200 rounded-xl p-4.5 space-y-3.5">
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

                      <div className="flex items-center gap-2">
                        {/* Badge Artículo 69 */}
                        {(c.aplicaArticulo69 || c.docente?.aplicaArticulo69) && (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 bg-amber-100 text-amber-800 border-amber-200">
                            ⚖️ Art. 69 (Máx 24h)
                          </span>
                        )}

                        {/* Badge Régimen 65/35 o 60/40 */}
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border flex items-center gap-1.5 ${
                          c.regimen === '60/40'
                            ? 'bg-purple-100 text-purple-800 border-purple-200'
                            : 'bg-blue-100 text-blue-800 border-blue-200'
                        }`}>
                          <Scale className="w-3.5 h-3.5" />
                          Régimen Ley 20.903: <strong>{c.regimen}</strong>
                        </span>

                        <span className="px-3 py-1 bg-slate-900 text-white font-black text-xs rounded-lg">
                          {c.docente.horasContrato} hrs
                        </span>
                      </div>
                    </div>

                    {/* Fila de Tiempos Normativos de este Contrato */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs bg-white p-3 rounded-lg border border-slate-200/80">
                      <div>
                        <span className="text-slate-500 block text-[11px]">Tope Legal Aula:</span>
                        {c.esExentoProporcion ? (
                          <span className="text-slate-400 font-semibold text-xs italic">Exento (No Aula)</span>
                        ) : (
                          <>
                            <strong className="text-slate-800 text-sm">{c.maxHorasPedagogicasMineduc} HA</strong>
                            <span className="text-[10px] text-slate-400 block font-mono">({formatMins(c.minutosLectivosMineduc)})</span>
                          </>
                        )}
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Aula Regular Asignada:</span>
                        <strong className={`text-sm ${c.estaSobreasignado ? 'text-red-600' : 'text-emerald-700'}`}>
                          {c.horasAulaRegular !== undefined ? c.horasAulaRegular : c.horasPedagogicasAsignadas} HA
                        </strong>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          {c.horasCoDocencia ? `+${c.horasCoDocencia}h Co-Doc • ` : ''}
                          ({formatMins((c.horasAulaRegular !== undefined ? c.horasAulaRegular : c.horasPedagogicasAsignadas) * 45)})
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Recreo Tabla MINEDUC:</span>
                        <strong className="text-slate-800 text-sm">{c.esExentoProporcion ? '0m' : formatMins(c.minutosRecreoMineduc)}</strong>
                        <span className="text-[10px] text-slate-400 block font-mono">({c.esExentoProporcion ? 0 : c.minutosRecreoMineduc} mins)</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block text-[11px]">Tiempo No Lectivo:</span>
                        <strong className="text-slate-800 text-sm">{c.esExentoProporcion ? '0m' : formatMins(c.minutosNoLectivosMineduc)}</strong>
                        <span className="text-[10px] text-slate-400 block font-mono">
                          ({c.esExentoProporcion ? 0 : c.minutosNoLectivosMineduc} mins • 40%: {formatMins(c.minutosHnlPlanificacion40 || Math.round(c.minutosNoLectivosMineduc * 0.40))})
                        </span>
                      </div>
                    </div>

                    {/* Auditoría Multitramo (Ley 20.903) & Desglose de Carga */}
                    {c.contratoCalculadoTotal !== undefined && (
                      <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-800 flex items-center gap-1.5">
                            <Scale className="w-4 h-4 text-indigo-600" />
                            Auditoría Multitramo MINEDUC (65/35 + 60/40 + PIE)
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            c.estadoSaldo === 'HOLGURA' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                            c.estadoSaldo === 'DEFICIT' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                            'bg-slate-200 text-slate-800'
                          }`}>
                            Contrato Requerido: {c.contratoCalculadoTotal}h (Saldo: {c.saldoHoras && c.saldoHoras > 0 ? `+${c.saldoHoras}h Libres` : c.saldoHoras && c.saldoHoras < 0 ? `${c.saldoHoras}h Déficit` : 'Exacto'})
                          </span>
                        </div>

                        {/* Alerta de Infracción Legal o Conformidad Ponderada */}
                        {c.esInfractorExcesoLectivo ? (
                          <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs flex items-center gap-2">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                            <span>
                              <strong>Infracción Ley 20.903:</strong> Carga de aula del <strong>{c.porcentajeLectivoReal}%</strong> excede el límite ponderado legal de <strong>{c.porcentajeLimitePonderado}%</strong>.
                            </span>
                          </div>
                        ) : c.docente.horasContrato > 0 && (
                          <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-[11px] flex items-center gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Proporción lectiva ({c.porcentajeLectivoReal}%) cumple con el límite ponderado legal de {c.porcentajeLimitePonderado}%.</span>
                          </div>
                        )}

                        {/* Alerta de Improcedencia Financiera: Plan de Estudio o JEC con SEP/PIE */}
                        {c.esImprocedenteFinanciamientoSepPie && (
                          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs space-y-1">
                            <div className="flex items-center gap-2 font-bold text-amber-800">
                              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>⚠️ Alerta de Financiamiento (Improcedencia SEP / PIE)</span>
                            </div>
                            <p className="text-[11px] text-amber-900 leading-relaxed">
                              El Plan de Estudio y las horas JEC deben financiarse <strong>exclusivamente con Subvención General</strong>.
                              El docente imparte <strong>{c.horasAulaPlanEstudioYJec} HA</strong> que exigen <strong>{c.contratoReqSubvencionGeneral} hrs</strong> de Subvención General, pero su contrato solo dispone de <strong>{c.subvencionGeneralContratoTotal} hrs</strong> (Déficit: <strong>{c.deficitSubvencionGeneral} hrs</strong> cubiertas improcedentemente con fondos SEP o PIE).
                            </p>
                          </div>
                        )}

                        {/* Alerta de Régimen Especial Artículo 69 */}
                        {(c.aplicaArticulo69 || c.docente?.aplicaArticulo69) && (
                          <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs space-y-1">
                            <div className="flex items-center gap-2 font-bold text-amber-800">
                              <Scale className="w-4 h-4 text-amber-600 shrink-0" />
                              <span>⚖️ Régimen Especial: Artículo 69 Ley 19.070 (Reducción 30+ Años de Servicio)</span>
                            </div>
                            <p className="text-[11px] text-amber-900 leading-relaxed">
                              El docente se encuentra acogido a la reducción voluntaria de jornada de aula por antigüedad docente. Su tope lectivo máximo legal es de <strong>24h cronológicas (32 Horas Aula)</strong>.
                              {(c.horasReduccionArticulo69 || 0) > 0 ? (
                                <span> Se transfirieron automáticamente <strong>{c.horasReduccionArticulo69} hrs ({formatMins(c.minutosReduccionArticulo69 || (c.horasReduccionArticulo69 || 0) * 60)})</strong> de aula hacia Tiempo No Lectivo (HNL).</span>
                              ) : null}
                            </p>
                          </div>
                        )}

                        {/* División de Jornada y Barra de Distribución */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                          <div className="space-y-1 bg-white p-2.5 rounded-lg border border-slate-200">
                            <span className="font-bold text-slate-700 block text-[11px]">Distribución de Jornada Docente:</span>
                            <div className="flex justify-between text-slate-600 text-[11px]">
                              <span>Tramo Regular 65/35:</span>
                              <span className="font-semibold text-indigo-700">{c.contratoPonderado65_35 || 0} hrs ({c.horasAula65_35 || 0} HA aula)</span>
                            </div>
                            <div className="flex justify-between text-slate-600 text-[11px]">
                              <span>Tramo Vulnerable 60/40:</span>
                              <span className="font-semibold text-purple-700">{c.contratoPonderado60_40 || 0} hrs ({c.horasAula60_40 || 0} HA aula)</span>
                            </div>
                            {Boolean(c.horasPieCronologicas ?? c.horasPieSepCronologicas) && (
                              <div className="flex justify-between text-slate-600 text-[11px] border-t border-slate-100 pt-1">
                                <span>Apoyo Directo PIE:</span>
                                <span className="font-semibold text-blue-700">{c.horasPieCronologicas ?? c.horasPieSepCronologicas} hrs cron</span>
                              </div>
                            )}
                            {Boolean(c.horasTallerSepExento) && (
                              <div className="flex justify-between text-slate-600 text-[11px] border-t border-slate-100 pt-1">
                                <span>Taller SEP Exento:</span>
                                <span className="font-semibold text-purple-700">{c.horasTallerSepExento} hrs cron</span>
                              </div>
                            )}
                          </div>

                          <div className="space-y-1.5 bg-white p-2.5 rounded-lg border border-slate-200 flex flex-col justify-center">
                            <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                              <span>Distribución Temporal</span>
                              <span className="text-slate-500">Planif 40%: <strong>{formatMins(c.minutosHnlPlanificacion40 || 0)}</strong></span>
                            </div>
                            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                              <div style={{ width: `${Math.min(100, c.porcentajeLectivoReal || 0)}%` }} className="bg-indigo-500 h-full" title={`Aula: ${c.porcentajeLectivoReal}%`} />
                              <div style={{ width: `${Math.min(100, ((c.minutosRecreoMineduc || 0) / Math.max(1, c.docente.horasContrato * 60)) * 100)}%` }} className="bg-amber-400 h-full" title={`Recreo: ${formatMins(c.minutosRecreoMineduc || 0)}`} />
                              <div style={{ width: `${Math.min(100, ((c.minutosNoLectivosMineduc || 0) / Math.max(1, c.docente.horasContrato * 60)) * 100)}%` }} className="bg-emerald-400 h-full" title={`HNL: ${formatMins(c.minutosNoLectivosMineduc || 0)}`} />
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-500 text-center">
                              <span className="text-indigo-600 font-semibold">● Aula</span>
                              <span className="text-amber-600 font-semibold">● Recreo</span>
                              <span className="text-emerald-600 font-semibold">● HNL</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Desglose de Funciones Fuera de Aula / Administrativas y Exentas */}
                    {Boolean(
                      (c.funcionesNoAula && c.funcionesNoAula.length > 0) ||
                      (c.docente?.funcionesNoAula && c.docente.funcionesNoAula.length > 0) ||
                      (c.horasDirectivas || 0) + (c.horasInspectorGeneral || 0) + (c.horasTecnicoPedagogicas || 0) + (c.horasCoordinacion || 0) + (c.horasTallerSep || c.horasTallerSepExento || 0) + (c.horasTrabajoColaborativo || c.horasPieCronologicas || 0)
                    ) && (
                      <div className="bg-purple-50/60 border border-purple-200 rounded-lg p-3 text-xs">
                        <div className="font-bold text-purple-900 flex items-center justify-between mb-1">
                          <span className="flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5 text-purple-600" />
                            Funciones Fuera de Aula / Administrativas (Exentas de Proporción Ley 20.903)
                          </span>
                          <span className="text-[10px] bg-purple-200/80 text-purple-800 px-2 py-0.5 rounded-full font-bold">
                            Total: {(c.funcionesNoAula || c.docente?.funcionesNoAula || []).length > 0
                              ? (c.funcionesNoAula || c.docente?.funcionesNoAula || []).reduce((acc: number, f: any) => acc + (f.horas || 0), 0) + (c.horasTallerSep || c.horasTallerSepExento || 0) + (c.horasTrabajoColaborativo || c.horasPieCronologicas || 0)
                              : (c.horasDirectivas || 0) + (c.horasInspectorGeneral || 0) + (c.horasTecnicoPedagogicas || 0) + (c.horasCoordinacion || 0) + (c.horasTallerSep || c.horasTallerSepExento || 0) + (c.horasTrabajoColaborativo || c.horasPieCronologicas || 0)
                            } hrs
                          </span>
                        </div>

                        {/* Listado de Múltiples Funciones si existen */}
                        {(c.funcionesNoAula || c.docente?.funcionesNoAula || []).length > 0 ? (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px] mt-2">
                            {(c.funcionesNoAula || c.docente?.funcionesNoAula || []).map((f: any, fIdx: number) => (
                              <div key={f.id || fIdx} className="bg-white p-2 rounded border border-purple-100 flex items-center justify-between shadow-xs">
                                <div>
                                  <span className="font-semibold text-purple-900 block capitalize">{f.tipo.replace('_', ' ')}</span>
                                  {f.nombre && <span className="text-[10px] text-slate-500 block truncate max-w-[140px]">{f.nombre}</span>}
                                </div>
                                <span className="font-mono font-bold text-xs text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                                  {f.horas} hrs
                                </span>
                              </div>
                            ))}
                            {Boolean(c.horasTallerSep || c.horasTallerSepExento) && (
                              <div className="bg-white p-2 rounded border border-purple-100 flex items-center justify-between">
                                <span className="text-slate-600 block">Taller SEP</span>
                                <strong className="text-emerald-800 font-bold">{c.horasTallerSep || c.horasTallerSepExento} hrs</strong>
                              </div>
                            )}
                            {Boolean(c.horasTrabajoColaborativo || c.horasPieCronologicas) && (
                              <div className="bg-white p-2 rounded border border-purple-100 flex items-center justify-between">
                                <span className="text-slate-600 block">Trabajo Colaborativo</span>
                                <strong className="text-indigo-800 font-bold">{c.horasTrabajoColaborativo || c.horasPieCronologicas} hrs</strong>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-[11px] mt-2">
                            <div className="bg-white p-2 rounded border border-purple-100">
                              <span className="text-slate-500 block">Dirección:</span>
                              <strong className="text-purple-800 font-bold">{c.horasDirectivas || 0} hrs</strong>
                            </div>
                            <div className="bg-white p-2 rounded border border-purple-100">
                              <span className="text-slate-500 block">Inspectoría:</span>
                              <strong className="text-purple-800 font-bold">{c.horasInspectorGeneral || 0} hrs</strong>
                            </div>
                            <div className="bg-white p-2 rounded border border-purple-100">
                              <span className="text-slate-500 block">Jefatura UTP:</span>
                              <strong className="text-blue-800 font-bold">{c.horasTecnicoPedagogicas || 0} hrs</strong>
                            </div>
                            <div className="bg-white p-2 rounded border border-purple-100">
                              <span className="text-slate-500 block">Coord. UTP:</span>
                              <strong className="text-blue-800 font-bold">
                                {c.horasCoordinacion || 0} hrs {c.docente.tipoCoordinacion ? `(${c.docente.tipoCoordinacion})` : ''}
                              </strong>
                            </div>
                            <div className="bg-white p-2 rounded border border-purple-100">
                              <span className="text-slate-500 block">Taller SEP:</span>
                              <strong className="text-emerald-800 font-bold">{c.horasTallerSep || c.horasTallerSepExento || 0} hrs</strong>
                            </div>
                            <div className="bg-white p-2 rounded border border-purple-100">
                              <span className="text-slate-500 block">Trabajo Colab.:</span>
                              <strong className="text-indigo-800 font-bold">{c.horasTrabajoColaborativo || c.horasPieCronologicas || 0} hrs</strong>
                            </div>
                          </div>
                        )}
                        <p className="text-[10px] text-purple-700 mt-2 italic">
                          * El régimen 65/35 o 60/40 solo aplica sobre horas de aula regular ({c.horasDocenciaNeta}h netas). Los directivos, UTP, talleres SEP, trabajo colaborativo y funciones no aula están exentos.
                        </p>
                      </div>
                    )}

                    {/* Desglose de Fuentes de Financiamiento en esta Escuela */}
                    <div>
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                        <Coins className="w-3 h-3 text-slate-400" />
                        Financiamiento y Calidad Jurídica en este Contrato:
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="bg-white p-2.5 rounded-lg border border-slate-200">
                          <span className="font-bold text-slate-700 block text-xs">Subvención General</span>
                          <div className="flex justify-between text-[11px] text-slate-500 mt-1">
                            <span>Titular: <strong>{subTit}h</strong></span>
                            <span>Contrata: <strong>{subCon}h</strong></span>
                          </div>
                        </div>
                        <div className="bg-purple-50/40 p-2.5 rounded-lg border border-purple-100">
                          <span className="font-bold text-purple-900 block text-xs">SEP (Ley 20.248)</span>
                          <div className="flex justify-between text-[11px] text-purple-700 mt-1">
                            <span>Titular: <strong>{sepTit}h</strong></span>
                            <span>Contrata: <strong>{sepCon}h</strong></span>
                          </div>
                        </div>
                        <div className="bg-blue-50/40 p-2.5 rounded-lg border border-blue-100">
                          <span className="font-bold text-blue-900 block text-xs">PIE (Dec. 170)</span>
                          <div className="flex justify-between text-[11px] text-blue-700 mt-1">
                            <span>Titular: <strong>{pieTit}h</strong></span>
                            <span>Contrata: <strong>{pieCon}h</strong></span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Asignaciones Horarias en esta Escuela */}
                    {c.asignaciones.length > 0 ? (
                      <div>
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                          <BookOpen className="w-3 h-3 text-slate-400" />
                          Cursos y Asignaturas Impartidas ({c.asignaciones.length}):
                        </div>
                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b">
                              <tr>
                                <th className="px-3 py-2">Curso / Nivel</th>
                                <th className="px-3 py-2">Asignatura</th>
                                <th className="px-3 py-2 text-center">Horas Pedagógicas</th>
                                <th className="px-3 py-2 text-center">Horas Cronológicas</th>
                                <th className="px-3 py-2">Modalidad</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {c.asignaciones.map((asig, aIdx) => (
                                <tr key={aIdx} className="hover:bg-slate-50/60">
                                  <td className="px-3 py-2 font-medium text-slate-800">
                                    Curso ID: {asig.cursoId}
                                  </td>
                                  <td className="px-3 py-2 text-slate-700">
                                    {asig.asignatura}
                                  </td>
                                  <td className="px-3 py-2 text-center font-bold text-blue-700">
                                    {asig.horasPedagogicasAula} HA
                                  </td>
                                  <td className="px-3 py-2 text-center font-mono text-slate-500">
                                    {formatMins(asig.horasPedagogicasAula * 45)}
                                  </td>
                                  <td className="px-3 py-2 text-slate-500">
                                    {asig.tieneCoDocente ? 'Co-Docencia' : asig.esTallerJec ? 'Taller JEC' : 'Aula Regular'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic bg-white p-2.5 rounded-lg border border-dashed border-slate-200">
                        Sin asignaturas de aula asociadas en este establecimiento (funciones directivas, técnicas o de coordinación).
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Total territorial SLEP: <strong>{doc.horasTotalesSlep} horas semanales</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors"
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
};
