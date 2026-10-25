import React, { useState } from 'react';
import {
  X, FileSpreadsheet, Download, Sparkles, Building2,
  Scale, Users, ShieldCheck, Printer, FileDown, CheckCircle2,
  AlertCircle, HelpCircle, Layers, ExternalLink
} from 'lucide-react';
import { Establecimiento, Docente, AsistenteEducacion, CursoSae, AsignacionHoraria } from '../types';
import { generarExcelMatrizDotacionColegio } from '../services/excelMatrizDotacionService';
import { generarExcelConsolidadoPalDEP } from '../services/depPalExportService';
import { exportarLevantamientoIndividualExcel } from '../services/analizador/asistentesLevantamientoExporter';
import { guardarArchivoNativoOEnNavegador } from '../services/excelReportService';

export interface CentroDescargasModalProps {
  isOpen: boolean;
  onClose: () => void;
  colegio: Establecimiento;
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  asistentes?: AsistenteEducacion[];
  periodoActivo: number;
  onAbrirGdpModal?: () => void;
  onExportarFichaSlep?: () => void;
}

export const CentroDescargasModal: React.FC<CentroDescargasModalProps> = ({
  isOpen,
  onClose,
  colegio,
  cursos,
  docentes,
  asignaciones,
  asistentes = [],
  periodoActivo,
  onAbrirGdpModal,
  onExportarFichaSlep
}) => {
  const [descargando, setDescargando] = useState<string | null>(null);
  const [mensajeEstado, setMensajeEstado] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  if (!isOpen) return null;

  const handleDescargarMatriz = async () => {
    try {
      setDescargando('matriz');
      setMensajeEstado(null);

      const geminiApiKey = localStorage.getItem('gemini_api_key') || '';
      const geminiModel = localStorage.getItem('gemini_model') || 'gemini-2.5-flash';
      const geminiAnalizarTodos = localStorage.getItem('gemini_export_analizar_todos') === 'true';

      const geminiOptions = geminiApiKey
        ? { apiKey: geminiApiKey, modelName: geminiModel, analizarTodos: geminiAnalizarTodos }
        : undefined;

      const bytes = await generarExcelMatrizDotacionColegio(
        colegio,
        docentes,
        cursos,
        asignaciones,
        geminiOptions
      );

      const nombreLimpio = colegio.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
      const filename = `Matriz_Dotacion_${nombreLimpio}_RBD_${colegio.rbd}_${periodoActivo}.xlsx`;

      await guardarArchivoNativoOEnNavegador(
        bytes,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        [{ name: 'Planillas Microsoft Excel', extensions: ['xlsx'] }]
      );

      setMensajeEstado({
        tipo: 'success',
        texto: `Matriz Curricular de Dotación (${colegio.nombre}) exportada exitosamente.`
      });
    } catch (e: any) {
      setMensajeEstado({
        tipo: 'error',
        texto: `Error al exportar Matriz: ${e.message || e}`
      });
    } finally {
      setDescargando(null);
    }
  };

  const handleDescargarPalColegio = async () => {
    try {
      setDescargando('pal');
      setMensajeEstado(null);

      const bytes = await generarExcelConsolidadoPalDEP(
        [colegio],
        docentes,
        asistentes,
        cursos,
        asignaciones
      );

      const nombreLimpio = colegio.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
      const filename = `PAL_2027_DEP_${nombreLimpio}_RBD_${colegio.rbd}_${Date.now()}.xlsx`;

      await guardarArchivoNativoOEnNavegador(
        bytes,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        [{ name: 'Planilla Oficial PAL 2027 DEP', extensions: ['xlsx'] }]
      );

      setMensajeEstado({
        tipo: 'success',
        texto: 'Planilla Oficial PAL 2027 DEP generada con éxito con fórmulas nativas preservadas.'
      });
    } catch (e: any) {
      setMensajeEstado({
        tipo: 'error',
        texto: `Error al exportar PAL 2027: ${e.message || e}`
      });
    } finally {
      setDescargando(null);
    }
  };

  const handleDescargarLevantamientoAsistentes = async () => {
    try {
      setDescargando('asistentes');
      setMensajeEstado(null);

      await exportarLevantamientoIndividualExcel(
        asistentes,
        colegio.rbd,
        colegio.nombre,
        colegio.comuna
      );

      setMensajeEstado({
        tipo: 'success',
        texto: 'Planilla Oficial de Coeficientes de Asistentes exportada exitosamente.'
      });
    } catch (e: any) {
      setMensajeEstado({
        tipo: 'error',
        texto: `Error al exportar asistentes: ${e.message || e}`
      });
    } finally {
      setDescargando(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera del Modal */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight flex items-center gap-2">
                Centro de Descargas & Reportes Oficiales
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-400/30 font-mono">
                  Período {periodoActivo}
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                {colegio.nombre} • RBD: {colegio.rbd} • {colegio.comuna}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensaje de Estado / Feedback */}
        {mensajeEstado && (
          <div className={`p-3.5 mx-6 mt-4 rounded-xl text-xs font-semibold flex items-center justify-between ${
            mensajeEstado.tipo === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800'
              : 'bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200 dark:border-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              {mensajeEstado.tipo === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{mensajeEstado.texto}</span>
            </div>
            <button onClick={() => setMensajeEstado(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Contenido con Categorías de Entregables */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* CATEGORÍA 1: Entregables Oficiales DEP & MINEDUC */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-100 text-purple-900 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                1. Formatos Oficiales DEP (Dirección de Educación Pública)
              </span>
              <span className="text-[11px] text-slate-400">Requeridos para auditorías y validación de planta</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta PAL 2027 */}
              <div className="p-4 rounded-2xl border border-purple-200 dark:border-purple-900/60 bg-purple-50/40 dark:bg-purple-950/20 hover:border-purple-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Plan Anual Local (PAL 2027 DEP)
                      </h4>
                    </div>
                    <span className="text-[10px] bg-purple-200/60 dark:bg-purple-900/60 text-purple-900 dark:text-purple-200 px-2 py-0.5 rounded font-bold">
                      Oficial DEP
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    Libro Excel oficial del Plan Anual Local 2027. Incluye las hojas normativas <em>Docentes</em> y <em>Asistentes</em> preservando el 100% de las fórmulas nativas de Excel.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-purple-200/60 dark:border-purple-900/40 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-purple-700 dark:text-purple-300">
                    {docentes.length} Docentes • {asistentes.length} Asistentes
                  </span>
                  <button
                    type="button"
                    onClick={handleDescargarPalColegio}
                    disabled={descargando === 'pal'}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    {descargando === 'pal' ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Descargar PAL (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta GDP */}
              <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/40 dark:bg-amber-950/20 hover:border-amber-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Planilla GDP (Gestión Dotación)
                      </h4>
                    </div>
                    <span className="text-[10px] bg-amber-200/60 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded font-bold">
                      Oficial DEP
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    Planilla oficial de Gestión de Dotación de Personal. Contiene el diagnóstico de matrícula, capacidad de aula, dotación docente y asistentes con parámetros ajustables.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-200/60 dark:border-amber-900/40 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-amber-800 dark:text-amber-300">
                    {cursos.length} Cursos SAE registrados
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onAbrirGdpModal) onAbrirGdpModal();
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Configurar y Exportar GDP</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CATEGORÍA 2: Planillas Técnicas de Trabajo SLEP */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                2. Planillas Técnicas de Trabajo Territorial
              </span>
              <span className="text-[11px] text-slate-400">Herramientas de cálculo analítico y asignación curricular</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta Matriz Curricular */}
              <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20 hover:border-emerald-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Matriz Oficial de Dotación ([h]:mm)
                      </h4>
                    </div>
                    <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-900/60 text-emerald-900 dark:text-emerald-200 px-2 py-0.5 rounded font-bold">
                      SLEP Diguillín
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    Planilla de cruce de Cursos vs Docentes con formato oficial ministerial, cálculo de horas pedagógicas a cronológicas, talleres JEC y resumen por curso.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-emerald-800 dark:text-emerald-300">
                    {asignaciones.length} Asignaciones de aula
                  </span>
                  <button
                    type="button"
                    onClick={handleDescargarMatriz}
                    disabled={descargando === 'matriz'}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    {descargando === 'matriz' ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Descargar Matriz (.xlsx)</span>
                  </button>
                </div>
              </div>

              {/* Tarjeta Coeficientes Asistentes */}
              <div className="p-4 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 hover:border-blue-300 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      <h4 className="font-extrabold text-sm text-slate-900 dark:text-white">
                        Levantamiento Oficial de Asistentes
                      </h4>
                    </div>
                    <span className="text-[10px] bg-blue-200/60 dark:bg-blue-900/60 text-blue-900 dark:text-blue-200 px-2 py-0.5 rounded font-bold">
                      Estamento No Docente
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                    Planilla técnica que analiza los coeficientes de asistentes de la educación, duplas psicosociales, técnicos de párvulos, inspectores y auxiliares de servicio.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-blue-200/60 dark:border-blue-900/40 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-blue-800 dark:text-blue-300">
                    {asistentes.length} Asistentes registrados
                  </span>
                  <button
                    type="button"
                    onClick={handleDescargarLevantamientoAsistentes}
                    disabled={descargando === 'asistentes'}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-sm transition-all disabled:opacity-50"
                  >
                    {descargando === 'asistentes' ? (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Download className="w-3.5 h-3.5" />
                    )}
                    <span>Descargar Coeficientes (.xlsx)</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* CATEGORÍA 3: Respaldos, Fichas e Impresión */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-300">
                3. Respaldos Portables e Impresión
              </span>
              <span className="text-[11px] text-slate-400">Formatos para firma y transferencia entre asesores</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Tarjeta Ficha .slep */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FileDown className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white">Ficha Portable del Colegio (.slep)</h5>
                    <p className="text-[11px] text-slate-500">Respaldo íntegro para transferir a otro equipo</p>
                  </div>
                </div>
                {onExportarFichaSlep && (
                  <button
                    type="button"
                    onClick={onExportarFichaSlep}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-800 dark:text-white rounded-xl text-xs font-bold transition-colors"
                  >
                    Exportar .slep
                  </button>
                )}
              </div>

              {/* Tarjeta Imprimir */}
              <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Printer className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                  <div>
                    <h5 className="font-bold text-xs text-slate-900 dark:text-white">Informe Oficial para Impresión</h5>
                    <p className="text-[11px] text-slate-500">Vista limpia apta para firma y archivo físico (PDF)</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    window.print();
                  }}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors"
                >
                  Imprimir / PDF
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer del Modal */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Sparkles className="w-4 h-4 text-orange-500" />
            <span>Todos los archivos se generan 100% de manera local y segura.</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
