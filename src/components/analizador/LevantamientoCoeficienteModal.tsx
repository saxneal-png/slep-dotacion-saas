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
  Layers,
  Plus,
  Trash2,
  UserCheck,
  Search,
  Check,
  RotateCcw
} from 'lucide-react';
import { AsistenteAnalizadoRecord } from '../../services/analizador/asistentesClassifier';
import {
  EstablecimientoLevantamiento,
  generarMatrizLevantamientoEstablecimiento,
  interpretarAsistentesConIaParaLevantamiento,
  FUNCIONES_CANONICAS_LEVANTAMIENTO,
  FuncionCanonicaLevantamiento,
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
  // 1. Lista de colegios únicos detectados
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
  const [activeTab, setActiveTab] = useState<'matriz' | 'desglose'>('matriz');
  const [busquedaFuncionario, setBusquedaFuncionario] = useState('');

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

  // Mapa de matrices editadas manualmente por colegio (key: rbd)
  const [matricesEditadas, setMatricesEditadas] = useState<Record<string, EstablecimientoLevantamiento>>({});

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

  // Matriz base calculada para el colegio activo
  const matrizBase = useMemo(() => {
    const interpretacionArray = Array.from(interpretacionIaMap.values());
    return generarMatrizLevantamientoEstablecimiento(
      asistentesColegioActivo,
      colegioActivo.rbd,
      colegioActivo.nombre,
      colegioActivo.comuna,
      interpretacionArray.length > 0 ? interpretacionArray : undefined
    );
  }, [asistentesColegioActivo, colegioActivo, interpretacionIaMap]);

  // Matriz actual visible (editada o base)
  const matrizActiva = useMemo(() => {
    return matricesEditadas[selectedRbd] || matrizBase;
  }, [matricesEditadas, selectedRbd, matrizBase]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Función para recalcular los totales de una matriz editada
  const recalcularTotalesMatriz = (rows: LevantamientoRow[], rbd: string, nombre: string, comuna?: string): EstablecimientoLevantamiento => {
    const rowsActualizadas = rows.map((r) => ({
      ...r,
      totalHoras: (Number(r.horasSubRegular) || 0) + (Number(r.horasPie) || 0) + (Number(r.horasSep) || 0)
    }));

    const totalGeneral = rowsActualizadas.reduce(
      (acc, r) => ({
        cantidadFuncionarios: acc.cantidadFuncionarios + (Number(r.cantidadFuncionarios) || 0),
        horasSubRegular: acc.horasSubRegular + (Number(r.horasSubRegular) || 0),
        horasPie: acc.horasPie + (Number(r.horasPie) || 0),
        horasSep: acc.horasSep + (Number(r.horasSep) || 0),
        totalHoras: acc.totalHoras + r.totalHoras,
      }),
      { cantidadFuncionarios: 0, horasSubRegular: 0, horasPie: 0, horasSep: 0, totalHoras: 0 }
    );

    return {
      rbd,
      nombreEstablecimiento: nombre,
      comuna,
      rows: rowsActualizadas,
      totalGeneral
    };
  };

  // Manejo de edición de celdas en la matriz
  const handleEditCell = (rowIndex: number, field: keyof LevantamientoRow, value: any) => {
    const currentRows = [...(matrizActiva.rows || [])];
    if (!currentRows[rowIndex]) return;

    currentRows[rowIndex] = {
      ...currentRows[rowIndex],
      [field]: field === 'observaciones' || field === 'cargoFuncion' ? value : Number(value) || 0
    };

    const nuevaMatriz = recalcularTotalesMatriz(currentRows, colegioActivo.rbd, colegioActivo.nombre, colegioActivo.comuna);
    setMatricesEditadas((prev) => ({
      ...prev,
      [selectedRbd]: nuevaMatriz
    }));
  };

  // Agregar una nueva fila de tipo OTROS
  const handleAddFilaOtro = () => {
    const currentRows = [...(matrizActiva.rows || [])];
    currentRows.push({
      cargoFuncion: 'OTROS ',
      cantidadFuncionarios: 1,
      horasSubRegular: 0,
      horasPie: 0,
      horasSep: 0,
      totalHoras: 0,
      observaciones: 'Nueva Función / Cargo',
      isOtro: true
    });

    const nuevaMatriz = recalcularTotalesMatriz(currentRows, colegioActivo.rbd, colegioActivo.nombre, colegioActivo.comuna);
    setMatricesEditadas((prev) => ({
      ...prev,
      [selectedRbd]: nuevaMatriz
    }));
    showToast('Fila "OTROS" agregada a la matriz.');
  };

  // Eliminar una fila de OTROS
  const handleDeleteFilaOtro = (rowIndex: number) => {
    const currentRows = [...(matrizActiva.rows || [])];
    if (currentRows[rowIndex]?.isOtro) {
      currentRows.splice(rowIndex, 1);
      const nuevaMatriz = recalcularTotalesMatriz(currentRows, colegioActivo.rbd, colegioActivo.nombre, colegioActivo.comuna);
      setMatricesEditadas((prev) => ({
        ...prev,
        [selectedRbd]: nuevaMatriz
      }));
      showToast('Fila eliminada.');
    }
  };

  // Restablecer cambios manuales del colegio actual
  const handleRestablecerColegio = () => {
    const copia = { ...matricesEditadas };
    delete copia[selectedRbd];
    setMatricesEditadas(copia);
    showToast('Valores de la matriz restablecidos.');
  };

  // Reasignar la función oficial de un funcionario individual en la pestaña de Desglose
  const handleReasignarFuncionario = (
    asistenteId: string,
    nuevaFuncion: FuncionCanonicaLevantamiento | 'OTROS ',
    cargoDetalleOtro: string = '',
    horasSub?: number,
    horasPie?: number,
    horasSep?: number,
    observaciones?: string
  ) => {
    const asist = asistentes.find((a) => a.id === asistenteId);
    if (!asist) return;

    const subGral = asist.horas_subvencion_general_indefinido + asist.horas_subvencion_general_plazo_fijo;
    const pie = asist.horas_pie_indefinido + asist.horas_pie_plazo_fijo;
    const sep = asist.horas_sep_indefinido + asist.horas_sep_plazo_fijo;
    const total = asist.horas_contrato || (subGral + pie + sep);

    const subRegularFinal = horasSub !== undefined ? horasSub : (subGral > 0 ? subGral : Math.max(0, total - pie - sep));
    const pieFinal = horasPie !== undefined ? horasPie : pie;
    const sepFinal = horasSep !== undefined ? horasSep : sep;

    const newMap = new Map(interpretacionIaMap);
    newMap.set(asistenteId, {
      id: asistenteId,
      rut: asist.run,
      nombre: `${asist.nombres} ${asist.apellidos}`.trim(),
      funcion_oficial: nuevaFuncion,
      cargo_detalle_otro: cargoDetalleOtro || (nuevaFuncion === 'OTROS ' ? asist.cargo_original : ''),
      horas_sub_regular: subRegularFinal,
      horas_pie: pieFinal,
      horas_sep: sepFinal,
      horas_totales: total || (subRegularFinal + pieFinal + sepFinal),
      observaciones: observaciones !== undefined ? observaciones : (asist.observaciones_ia || asist.observaciones_originales || '')
    });

    setInterpretacionIaMap(newMap);

    // Eliminar la versión editada fija para que se regenere con la nueva asignación
    const copia = { ...matricesEditadas };
    delete copia[asist.rbd];
    setMatricesEditadas(copia);

    showToast(`Asignación actualizada para ${asist.nombres} ${asist.apellidos} $\rightarrow$ ${nuevaFuncion}`);
  };

  // Interpretar con IA Gemini
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

      // Limpiar matrices editadas fijas para que tomen las clasificaciones de IA
      const copia = { ...matricesEditadas };
      itemsToProcess.forEach((a) => {
        delete copia[a.rbd];
      });
      setMatricesEditadas(copia);

      showToast(`¡IA Gemini interpretó y homologó exitosamente ${resultados.length} cargos y notas!`);
    } catch (err: any) {
      showToast(`Error al interpretar con IA: ${err.message || err}`);
    } finally {
      setIsProcessingIa(false);
    }
  };

  // Exportar colegio individual con la matriz editada
  const handleExportIndividual = async () => {
    setExporting(true);
    try {
      await exportarLevantamientoIndividualExcel(
        asistentesColegioActivo,
        colegioActivo.rbd,
        colegioActivo.nombre,
        colegioActivo.comuna,
        undefined,
        matrizActiva
      );
      showToast('Planilla Excel Oficial exportada exitosamente.');
    } catch (err: any) {
      showToast(`Error al exportar: ${err.message || err}`);
    } finally {
      setExporting(false);
    }
  };

  // Exportar consolidado territorial con las matrices editadas
  const handleExportConsolidado = async () => {
    setExporting(true);
    try {
      const colegiosData = colegios.map((c) => ({
        rbd: c.rbd,
        nombreEstablecimiento: c.nombre,
        comuna: c.comuna,
        asistentes: asistentes.filter((a) => a.rbd === c.rbd),
        matrizPersonalizada: matricesEditadas[c.rbd]
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

  // Filtrado de funcionarios para el desglose
  const funcionariosFiltrados = useMemo(() => {
    return asistentesColegioActivo.filter((a) => {
      if (!busquedaFuncionario.trim()) return true;
      const q = busquedaFuncionario.toLowerCase();
      return (
        a.run.toLowerCase().includes(q) ||
        `${a.nombres} ${a.apellidos}`.toLowerCase().includes(q) ||
        a.cargo_original.toLowerCase().includes(q) ||
        (a.cargo_estandar || '').toLowerCase().includes(q) ||
        (a.observaciones_ia || '').toLowerCase().includes(q)
      );
    });
  }, [asistentesColegioActivo, busquedaFuncionario]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-7xl max-h-[95vh] flex flex-col overflow-hidden">
        
        {/* Cabecera Fija */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold tracking-tight">
                  Levantamiento de Coeficiente Asistentes de la Educación
                </h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/30">
                  Formato Oficial EE
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-yellow-300" />
                  Homologación Inteligente
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Resuelve nomenclaturas similares (*Asistente Diferencial $\rightarrow$ Asistente Técnico Diferencial*, *Técnico en Párvulos $\rightarrow$ Asistentes de Aula*), edita celdas antes de exportar y genera la plantilla oficial.
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
          <div className="bg-slate-850 text-white px-4 py-2 text-xs font-semibold flex items-center justify-between border-b border-slate-700 animate-in slide-in-from-top-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Barra de Control, Selector y Pestañas de Edición */}
        <div className="p-4 bg-slate-50 dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Selector de Colegio & Pestañas */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-500" />
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Colegio:</span>
              <select
                value={selectedRbd}
                onChange={(e) => setSelectedRbd(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none max-w-xs"
              >
                {colegios.map((c) => (
                  <option key={c.rbd} value={c.rbd}>
                    {c.nombre} (RBD: {c.rbd} - {c.count} asist.)
                  </option>
                ))}
              </select>
            </div>

            {/* Pestañas: Matriz vs Desglose */}
            <div className="flex items-center bg-slate-200 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('matriz')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'matriz'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>1. Matriz de Coeficiente (17 Funciones)</span>
              </button>

              <button
                onClick={() => setActiveTab('desglose')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTab === 'desglose'
                    ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-300 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
                }`}
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>2. Reasignación por Funcionario ({asistentesColegioActivo.length})</span>
              </button>
            </div>
          </div>

          {/* Botones de IA y Exportación */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Botón IA */}
            <button
              onClick={handleInterpretarConIa}
              disabled={isProcessingIa}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-500 hover:to-indigo-500 shadow-xs transition-all disabled:opacity-50"
              title="Analizar con Gemini para resolver automáticamente nomenclaturas similares y notas"
            >
              {isProcessingIa ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              )}
              <span>Interpretar y Homologar con IA</span>
            </button>

            {/* Exportar Colegio Actual */}
            <button
              onClick={handleExportIndividual}
              disabled={exporting}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-all disabled:opacity-50"
              title="Descargar la plantilla Excel oficial para el colegio activo con todas las ediciones"
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
                title="Generar un libro Excel con una hoja por colegio y un resumen territorial"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Exportar Consolidado SLEP ({colegios.length} EE)</span>
              </button>
            )}
          </div>
        </div>

        {/* Barra de Estado y Cuadratura */}
        <div className="px-6 py-2.5 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-100 dark:border-blue-900/50 flex flex-wrap items-center justify-between text-xs text-blue-900 dark:text-blue-200 shrink-0 gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
            <span>
              {matricesEditadas[selectedRbd] ? (
                <span className="font-bold text-amber-700 dark:text-amber-300">
                  ✎ Matriz personalizada con ediciones manuales en tiempo real.
                </span>
              ) : iaProcessedCount > 0 ? (
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  ✓ {iaProcessedCount} cargos homologados por Gemini AI. Puedes editar cualquier celda antes de exportar.
                </span>
              ) : (
                <span>
                  Clasificación heurística aplicada. Puedes editar los valores o reclasificar funcionarios.
                </span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-4 text-[11px] font-bold">
            <span>Funcionarios: <strong className="text-slate-900 dark:text-white">{matrizActiva.totalGeneral.cantidadFuncionarios}</strong></span>
            <span>Subv. Reg: <strong>{matrizActiva.totalGeneral.horasSubRegular}h</strong></span>
            <span>PIE: <strong>{matrizActiva.totalGeneral.horasPie}h</strong></span>
            <span>SEP: <strong>{matrizActiva.totalGeneral.horasSep}h</strong></span>
            <span className="text-blue-700 dark:text-blue-300">Total: <strong className="text-sm">{matrizActiva.totalGeneral.totalHoras}h</strong></span>

            {matricesEditadas[selectedRbd] && (
              <button
                onClick={handleRestablecerColegio}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[10px]"
                title="Descartar ediciones manuales y volver al cálculo base"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer</span>
              </button>
            )}
          </div>
        </div>

        {/* Contenido Principal: Matriz de Coeficiente (Pestaña 1) */}
        {activeTab === 'matriz' && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Puedes editar directamente los valores en la tabla. Las horas totales y el total general se calculan dinámicamente.
              </p>

              <button
                onClick={handleAddFilaOtro}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Agregar Función "OTROS"</span>
              </button>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4 w-[28%]">Cargo / función</th>
                    <th className="py-3 px-3 text-center w-[12%]">CANTIDAD DE FUNCIONARIOS</th>
                    <th className="py-3 px-3 text-right w-[10%]">SUB REGULAR</th>
                    <th className="py-3 px-3 text-right w-[10%]">PIE</th>
                    <th className="py-3 px-3 text-right w-[10%]">SEP</th>
                    <th className="py-3 px-3 text-right w-[10%] font-black text-blue-700 dark:text-blue-400">TOTAL</th>
                    <th className="py-3 px-4 w-[18%]">Observaciones</th>
                    <th className="py-3 px-2 text-center w-[2%]"></th>
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
                        {/* A: Cargo / Función */}
                        <td className="py-2 px-4 font-sans font-semibold">
                          {isOtro ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-orange-100 text-orange-800 dark:bg-orange-900/60 dark:text-orange-200">
                                OTROS
                              </span>
                              <input
                                type="text"
                                value={row.cargoFuncion.replace(/^OTROS\s*/, '')}
                                onChange={(e) => handleEditCell(idx, 'cargoFuncion', `OTROS ${e.target.value}`)}
                                placeholder="Nombre de la función"
                                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs font-semibold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                              />
                            </div>
                          ) : (
                            <span>{row.cargoFuncion}</span>
                          )}
                        </td>

                        {/* B: CANTIDAD DE FUNCIONARIOS */}
                        <td className="py-2 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            value={row.cantidadFuncionarios === 0 ? '' : row.cantidadFuncionarios}
                            onChange={(e) => handleEditCell(idx, 'cantidadFuncionarios', e.target.value)}
                            placeholder="0"
                            className="w-14 text-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* C: SUB REGULAR */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.horasSubRegular === 0 ? '' : row.horasSubRegular}
                            onChange={(e) => handleEditCell(idx, 'horasSubRegular', e.target.value)}
                            placeholder="0"
                            className="w-16 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* D: PIE */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.horasPie === 0 ? '' : row.horasPie}
                            onChange={(e) => handleEditCell(idx, 'horasPie', e.target.value)}
                            placeholder="0"
                            className="w-16 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* E: SEP */}
                        <td className="py-2 px-3 text-right">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.horasSep === 0 ? '' : row.horasSep}
                            onChange={(e) => handleEditCell(idx, 'horasSep', e.target.value)}
                            placeholder="0"
                            className="w-16 text-right bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* F: TOTAL (Calculado dinámico) */}
                        <td className="py-2 px-3 text-right font-black text-blue-600 dark:text-blue-400">
                          {row.totalHoras > 0 ? `${row.totalHoras}h` : '-'}
                        </td>

                        {/* G: Observaciones */}
                        <td className="py-2 px-4 font-sans">
                          <input
                            type="text"
                            value={row.observaciones || ''}
                            onChange={(e) => handleEditCell(idx, 'observaciones', e.target.value)}
                            placeholder="Detalle de cargo, reemplazos o licencias"
                            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-800 dark:text-slate-200 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>

                        {/* Acción eliminar si es OTROS */}
                        <td className="py-2 px-2 text-center">
                          {isOtro && (
                            <button
                              onClick={() => handleDeleteFilaOtro(idx)}
                              className="text-slate-400 hover:text-rose-500 p-1 rounded transition-colors"
                              title="Eliminar fila OTROS"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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
                    <td className="py-3 px-4 font-normal text-slate-500 italic" colSpan={2}>
                      Cuadratura oficial calculada
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Contenido Secundario: Reasignación por Funcionario (Pestaña 2) */}
        {activeTab === 'desglose' && (
          <div className="flex-1 overflow-auto p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative flex-1 max-w-md w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrar por RUN, nombre o cargo original..."
                  value={busquedaFuncionario}
                  onChange={(e) => setBusquedaFuncionario(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Mostrando {funcionariosFiltrados.length} de {asistentesColegioActivo.length} funcionarios
              </span>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700">
                    <th className="py-3 px-4 w-[25%]">Funcionario / RUN</th>
                    <th className="py-3 px-4 w-[22%]">Cargo Original / Ingerido</th>
                    <th className="py-3 px-4 w-[28%] text-blue-700 dark:text-blue-300 font-black">
                      Función Asignada en Levantamiento
                    </th>
                    <th className="py-3 px-3 text-center w-[10%]">Horas</th>
                    <th className="py-3 px-4 w-[15%]">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/40">
                  {funcionariosFiltrados.map((a) => {
                    const iaInfo = interpretacionIaMap.get(a.id);
                    const funcionAsignada: FuncionCanonicaLevantamiento | 'OTROS ' =
                      iaInfo?.funcion_oficial ||
                      (matrizActiva.rows.find((r) => r.cargoFuncion === a.cargo_estandar)?.cargoFuncion as any) ||
                      'Asistentes de aula';

                    const cargoDetalle = iaInfo?.cargo_detalle_otro || '';
                    const obsPersonal = iaInfo?.observaciones || a.observaciones_ia || a.observaciones_originales || '';

                    const subGral = a.horas_subvencion_general_indefinido + a.horas_subvencion_general_plazo_fijo;
                    const pie = a.horas_pie_indefinido + a.horas_pie_plazo_fijo;
                    const sep = a.horas_sep_indefinido + a.horas_sep_plazo_fijo;

                    return (
                      <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors">
                        {/* Funcionario */}
                        <td className="py-2.5 px-4 font-semibold text-slate-900 dark:text-white">
                          <div>{a.nombres} {a.apellidos}</div>
                          <div className="text-[11px] font-mono text-slate-400">{a.run}</div>
                        </td>

                        {/* Cargo Original */}
                        <td className="py-2.5 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          <div>{a.cargo_original}</div>
                          {a.cargo_estandar && a.cargo_estandar !== a.cargo_original && (
                            <div className="text-[11px] text-purple-600 dark:text-purple-400 font-semibold">
                              IA: {a.cargo_estandar}
                            </div>
                          )}
                        </td>

                        {/* Selector de Función Oficial */}
                        <td className="py-2.5 px-4">
                          <div className="space-y-1">
                            <select
                              value={funcionAsignada}
                              onChange={(e) =>
                                handleReasignarFuncionario(
                                  a.id,
                                  e.target.value as any,
                                  cargoDetalle,
                                  undefined,
                                  undefined,
                                  undefined,
                                  obsPersonal
                                )
                              }
                              className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                            >
                              {FUNCIONES_CANONICAS_LEVANTAMIENTO.map((fn) => (
                                <option key={fn} value={fn}>
                                  {fn}
                                </option>
                              ))}
                              <option value="OTROS ">OTROS (Especificar función)</option>
                            </select>

                            {funcionAsignada === 'OTROS ' && (
                              <input
                                type="text"
                                placeholder="Especifica el cargo (ej. Nutricionista)"
                                value={cargoDetalle}
                                onChange={(e) =>
                                  handleReasignarFuncionario(
                                    a.id,
                                    'OTROS ',
                                    e.target.value,
                                    undefined,
                                    undefined,
                                    undefined,
                                    obsPersonal
                                  )
                                }
                                className="w-full bg-white dark:bg-slate-900 border border-orange-300 dark:border-orange-800 rounded px-2 py-1 text-xs font-semibold text-orange-800 dark:text-orange-200"
                              />
                            )}
                          </div>
                        </td>

                        {/* Horas */}
                        <td className="py-2.5 px-3 text-center font-mono">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{a.horas_contrato}h</div>
                          <div className="text-[10px] text-slate-400">
                            {subGral > 0 && `Reg:${subGral}h `}
                            {pie > 0 && `PIE:${pie}h `}
                            {sep > 0 && `SEP:${sep}h`}
                          </div>
                        </td>

                        {/* Observaciones */}
                        <td className="py-2.5 px-4 font-sans">
                          <input
                            type="text"
                            value={obsPersonal}
                            onChange={(e) =>
                              handleReasignarFuncionario(
                                a.id,
                                funcionAsignada,
                                cargoDetalle,
                                undefined,
                                undefined,
                                undefined,
                                e.target.value
                              )
                            }
                            placeholder="Notas o reemplazos"
                            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-xs text-slate-700 dark:text-slate-300"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pie de Modal */}
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-850 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Fórmulas dinámicas Excel <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-slate-700 dark:text-slate-300">=SUM(C10:E10)</code> integradas en la exportación oficial.
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
