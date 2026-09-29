import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  FileSpreadsheet,
  Download,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  X,
  Edit2,
  RefreshCw,
  Eye,
  Info,
  Layers
} from 'lucide-react';
import { AsistenteAnalizadoRecord } from '../../services/analizador/asistentesClassifier';
import {
  EstablecimientoLevantamiento,
  generarMatrizLevantamientoEstablecimiento,
  interpretarAsistentesConIaParaLevantamiento,
  FUNCIONES_CANONICAS_LEVANTAMIENTO,
  LevantamientoRow
} from '../../services/analizador/asistentesLevantamientoRollup';
import {
  exportarLevantamientoIndividualExcel,
  exportarLevantamientoConsolidadoSlepExcel
} from '../../services/analizador/asistentesLevantamientoExporter';

interface LevantamientoCoeficienteModalProps {
  isOpen: boolean;
  onClose: () => void;
  asistentes: AsistenteAnalizadoRecord[];
  apiKey: string;
  selectedModel: string;
  onOpenApiKeyModal: () => void;
}

export const LevantamientoCoeficienteModal: React.FC<LevantamientoCoeficienteModalProps> = ({
  isOpen,
  onClose,
  asistentes,
  apiKey,
  selectedModel,
  onOpenApiKeyModal
}) => {
  // Lista de colegios únicos detectados
  const colegios = useMemo(() => {
    const map = new Map<string, { rbd: string; nombre: string; comuna?: string; count: number }>();
    asistentes.forEach((a) => {
      const rbd = a.rbd || '00000';
      const existing = map.get(rbd);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(rbd, {
          rbd,
          nombre: a.establishment || `Establecimiento RBD ${rbd}`,
          comuna: a.comuna || 'Territorio',
          count: 1
        });
      }
    });
    return Array.from(map.values());
  }, [asistentes]);

  const [selectedRbd, setSelectedRbd] = useState<string>(colegios[0]?.rbd || 'ALL');

  useEffect(() => {
    if (colegios.length > 0 && (selectedRbd === 'ALL' || !colegios.some((c) => c.rbd === selectedRbd))) {
      setSelectedRbd(colegios[0].rbd);
    }
  }, [colegios]);

  const [isProcessingIa, setIsProcessingIa] = useState(false);
  const [interpretacionIaMap, setInterpretacionIaMap] = useState<Map<string, any>>(new Map());
  const [iaProcessedCount, setIaProcessedCount] = useState<number>(0);
  const [exporting, setExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Asistentes del colegio seleccionado
  const asistentesColegioActivo = useMemo(() => {
    if (selectedRbd === 'ALL') return asistentes;
    return asistentes.filter((a) => a.rbd === selectedRbd);
  }, [asistentes, selectedRbd]);

  const colegioActivo = useMemo(() => {
    return colegios.find((c) => c.rbd === selectedRbd) || {
      rbd: selectedRbd,
      nombre: 'ESTABLECIMIENTO EDUCACIONAL',
      comuna: 'Territorio'
    };
  }, [colegios, selectedRbd]);

  // Generar la matriz para el colegio activo
  const matrizActiva = useMemo(() => {
    const interpretacionArray = Array.from(interpretacionIaMap.values());
    return generarMatrizLevantamientoEstablecimiento(
      asistentesColegioActivo,
      colegioActivo.rbd,
      colegioActivo.nombre,
      colegioActivo.comuna,
      interpretacionArray.length > 0 ? interpretacionArray : undefined
    );
  }, [asistentesColegioActivo, colegioActivo, interpretacionIaMap]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleInterpretarConIa = async () => {
    if (!apiKey) {
      onOpenApiKeyModal();
      return;
    }

    setIsProcessingIa(true);
    try {
      const itemsToProcess = selectedRbd === 'ALL' ? asistentes : asistentesColegioActivo;
      const resultados = await interpretarAsistentesConIaParaLevantamiento(
        itemsToProcess,
        apiKey,
        selectedModel
      );

      const newMap = new Map(interpretacionIaMap);
      resultados.forEach((res) => {
        newMap.set(res.id, res);
      });

      setInterpretacionIaMap(newMap);
      setIaProcessedCount(newMap.size);
      showToast(`¡IA Gemini interpretó exitosamente ${resultados.length} cargos y observaciones!`);
    } catch (err: any) {
      showToast(`Error al interpretar con IA: ${err.message || err}`);
    } finally {
      setIsProcessingIa(false);
    }
  };

  const handleExportIndividual = async () => {
    setExporting(true);
    try {
      const interpretacionArray = Array.from(interpretacionIaMap.values());
      await exportarLevantamientoIndividualExcel(
        asistentesColegioActivo,
        colegioActivo.rbd,
        colegioActivo.nombre,
        colegioActivo.comuna,
        interpretacionArray.length > 0 ? interpretacionArray : undefined
      );
      showToast('Planilla Excel Oficial exportada exitosamente.');
    } catch (err: any) {
      showToast(`Error al exportar: ${err.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  const handleExportConsolidado = async () => {
    setExporting(true);
    try {
      const colegiosData = colegios.map((c) => ({
        rbd: c.rbd,
        nombreEstablecimiento: c.nombre,
        comuna: c.comuna,
        asistentes: asistentes.filter((a) => a.rbd === c.rbd)
      }));

      const interpretacionArray = Array.from(interpretacionIaMap.values());
      await exportarLevantamientoConsolidadoSlepExcel(
        colegiosData,
        interpretacionArray.length > 0 ? interpretacionArray : undefined
      );
      showToast(`Consolidado SLEP (${colegios.length} colegios) exportado exitosamente.`);
    } catch (err: any) {
      showToast(`Error al exportar consolidado: ${err.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabecera Fija */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold tracking-tight">
                  Levantamiento de Coeficiente Asistentes de la Educación
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Formato Oficial EE
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Matriz de 17 funciones canónicas + OTROS con desglose de subvenciones (Regular, PIE, SEP) y apoyo de IA.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Notificación Toast interna */}
        {toastMessage && (
          <div className="bg-slate-800 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-slate-700 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Barra de Control y Acciones */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Selector de Colegio */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-slate-500" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Establecimiento:</span>
            <select
              value={selectedRbd}
              onChange={(e) => setSelectedRbd(e.target.value)}
              className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none max-w-xs"
            >
              {colegios.map((c) => (
                <option key={c.rbd} value={c.rbd}>
                  {c.nombre} (RBD: {c.rbd} - {c.count} asist.)
                </option>
              ))}
            </select>
          </div>

          {/* Botones de IA y Exportación */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón IA */}
            <button
              onClick={handleInterpretarConIa}
              disabled={isProcessingIa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-xs transition-all disabled:opacity-50"
            >
              {isProcessingIa ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              )}
              <span>Interpretar y Ajustar con IA ({selectedModel})</span>
            </button>

            {/* Exportar Colegio Actual */}
            <button
              onClick={handleExportIndividual}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel Colegio ({colegioActivo.rbd})</span>
            </button>

            {/* Exportar Consolidado Territorial SLEP */}
            {colegios.length > 1 && (
              <button
                onClick={handleExportConsolidado}
                disabled={exporting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-all disabled:opacity-50"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Exportar Consolidado SLEP ({colegios.length} EE)</span>
              </button>
            )}
          </div>
        </div>

        {/* Estado de IA e Información */}
        <div className="px-6 py-2 bg-blue-50/60 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/40 flex items-center justify-between text-xs text-blue-800 dark:text-blue-300 shrink-0">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              {iaProcessedCount > 0 ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ {iaProcessedCount} registros enriquecidos y estandarizados por Gemini AI con resolución de notas.
                </span>
              ) : (
                <span>
                  Generando matriz basada en <strong>clasificación normativa local</strong>. Pulsa "Interpretar con IA" para depurar notas complejas.
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-bold">
            <span>Funcionarios: <strong>{matrizActiva.totalGeneral.cantidadFuncionarios}</strong></span>
            <span>Subv. Reg: <strong>{matrizActiva.totalGeneral.horasSubRegular}h</strong></span>
            <span>PIE: <strong>{matrizActiva.totalGeneral.horasPie}h</strong></span>
            <span>SEP: <strong>{matrizActiva.totalGeneral.horasSep}h</strong></span>
            <span className="text-blue-700 dark:text-blue-300">Total: <strong>{matrizActiva.totalGeneral.totalHoras}h</strong></span>
          </div>
        </div>

        {/* Tabla Previa Desplazable */}
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                  <th className="py-3 px-4 w-1/4">Cargo / función</th>
                  <th className="py-3 px-3 text-center">CANTIDAD DE FUNCIONARIOS</th>
                  <th className="py-3 px-3 text-right">SUB REGULAR</th>
                  <th className="py-3 px-3 text-right">PIE</th>
                  <th className="py-3 px-3 text-right">SEP</th>
                  <th className="py-3 px-3 text-right font-black text-blue-700 dark:text-blue-400">TOTAL</th>
                  <th className="py-3 px-4 w-1/3">Observaciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40 font-mono">
                {matrizActiva.rows.map((row, idx) => {
                  const hasData = row.cantidadFuncionarios > 0 || row.totalHoras > 0;
                  const isOtro = row.isOtro || row.cargoFuncion.startsWith('OTROS');

                  return (
                    <tr
                      key={idx}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors ${
                        hasData ? 'font-medium text-slate-800 dark:text-slate-100' : 'text-slate-400 dark:text-slate-500'
                      } ${isOtro && hasData ? 'bg-orange-50/40 dark:bg-orange-950/20' : ''}`}
                    >
                      <td className="py-2.5 px-4 font-sans font-semibold">
                        <div className="flex items-center gap-1.5">
                          {isOtro ? (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200">
                              OTROS
                            </span>
                          ) : (
                            <span>{row.cargoFuncion}</span>
                          )}
                        </div>
                      </td>

                      <td className="py-2.5 px-3 text-center font-bold">
                        {row.cantidadFuncionarios > 0 ? (
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-100 text-[11px]">
                            {row.cantidadFuncionarios}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {row.horasSubRegular > 0 ? `${row.horasSubRegular}h` : '-'}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {row.horasPie > 0 ? `${row.horasPie}h` : '-'}
                      </td>

                      <td className="py-2.5 px-3 text-right">
                        {row.horasSep > 0 ? `${row.horasSep}h` : '-'}
                      </td>

                      <td className="py-2.5 px-3 text-right font-black text-blue-600 dark:text-blue-400">
                        {row.totalHoras > 0 ? `${row.totalHoras}h` : '-'}
                      </td>

                      <td className="py-2.5 px-4 font-sans text-slate-600 dark:text-slate-300">
                        {row.observaciones || ''}
                      </td>
                    </tr>
                  );
                })}

                {/* Fila Total General */}
                <tr className="bg-slate-100 dark:bg-slate-750 font-bold border-t-2 border-slate-300 dark:border-slate-600 text-slate-900 dark:text-white">
                  <td className="py-3 px-4 font-black">TOTAL GENERAL</td>
                  <td className="py-3 px-3 text-center text-sm text-blue-700 dark:text-blue-300 font-black">
                    {matrizActiva.totalGeneral.cantidadFuncionarios}
                  </td>
                  <td className="py-3 px-3 text-right">
                    {matrizActiva.totalGeneral.horasSubRegular}h
                  </td>
                  <td className="py-3 px-3 text-right">
                    {matrizActiva.totalGeneral.horasPie}h
                  </td>
                  <td className="py-3 px-3 text-right">
                    {matrizActiva.totalGeneral.horasSep}h
                  </td>
                  <td className="py-3 px-3 text-right text-sm text-blue-700 dark:text-blue-300 font-black">
                    {matrizActiva.totalGeneral.totalHoras}h
                  </td>
                  <td className="py-3 px-4 font-normal text-slate-500 italic">
                    Cuadratura oficial calculada
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pie de Modal */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Fórmulas dinámicas Excel <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">=SUM(C10:E10)</code> integradas en la exportación.
          </p>

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 text-slate-700 dark:text-slate-200 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
