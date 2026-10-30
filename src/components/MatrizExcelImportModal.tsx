import React, { useState, useRef } from 'react';
import {
  FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, Users,
  BookOpen, Clock, Layers, ArrowRight, X, Sparkles, Building2, Calendar
} from 'lucide-react';
import { Establecimiento, MatrizExcelParseResult } from '../types';
import { parseMatrizExcel } from '../services/excelMatrixParserService';
import { guardarMatrizExcelEnDb } from '../database/db';

interface MatrizExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  colegioActivo: Establecimiento | null;
  colegios: Establecimiento[];
  periodoPorDefecto: number;
  onImportComplete: (rbd: string, periodo: number) => void;
}

export const MatrizExcelImportModal: React.FC<MatrizExcelImportModalProps> = ({
  isOpen,
  onClose,
  colegioActivo,
  colegios,
  periodoPorDefecto,
  onImportComplete
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [parseResult, setParseResult] = useState<MatrizExcelParseResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [rbdDestino, setRbdDestino] = useState<string>(colegioActivo?.rbd || (colegios[0]?.rbd || ''));
  const [periodoDestino, setPeriodoDestino] = useState<number>(periodoPorDefecto || 2027);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = async (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMsg(null);
    setSuccessMsg(null);
    setParsing(true);

    try {
      const buffer = await selectedFile.arrayBuffer();
      const result = await parseMatrizExcel(buffer, selectedFile.name);
      setParseResult(result);

      // Si se detectó un RBD en la planilla y coincide con un colegio, auto-seleccionarlo
      if (result.rbdDetectado) {
        const found = colegios.find(c => c.rbd === result.rbdDetectado);
        if (found) {
          setRbdDestino(found.rbd);
        }
      }

      // Si se detectó un año (2026 o 2027) en el archivo, sugerirlo
      if (result.periodoDetectado === 2026 || result.periodoDetectado === 2027) {
        setPeriodoDestino(result.periodoDetectado);
      }
    } catch (err: any) {
      console.error('Error al parsear Excel:', err);
      setErrorMsg(err.message || 'Error al procesar el archivo Excel. Asegúrese de que tenga formato .xlsx válido.');
      setParseResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleConfirmarImportacion = async () => {
    if (!parseResult || !rbdDestino) return;
    setSaving(true);
    setErrorMsg(null);

    try {
      const stats = await guardarMatrizExcelEnDb(parseResult, rbdDestino, periodoDestino);
      setSuccessMsg(`¡Importación exitosa! Se procesaron ${stats.docentesGuardados} docentes, ${stats.cursosNuevos} cursos nuevos y ${stats.asignacionesGuardadas} asignaciones horarias vinculadas al periodo ${periodoDestino}.`);
      setTimeout(() => {
        onImportComplete(rbdDestino, periodoDestino);
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Error al guardar en base de datos:', err);
      setErrorMsg(`Error al guardar en base de datos: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const colegioSeleccionado = colegios.find(c => c.rbd === rbdDestino);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Steve Jobs Style */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                Importar Matriz Excel de Carga Horaria
                <span className="text-[10px] bg-blue-500/20 text-blue-300 font-semibold px-2 py-0.5 rounded-full border border-blue-500/30">
                  Detección Automática de Cursos
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Interpreta la planilla territorial con desglose por columnas de cursos (NT1 a 4°M) y asignaturas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-200">
          {/* Configuración de Destino (Colegio y Periodo) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-800/40 p-4 rounded-xl border border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-orange-400" />
                Establecimiento Destino
              </label>
              <select
                value={rbdDestino}
                onChange={(e) => setRbdDestino(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-3 py-2 text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
              >
                {colegios.map(c => (
                  <option key={c.rbd} value={c.rbd}>
                    RBD {c.rbd} - {c.nombre} ({c.comuna})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-blue-400" />
                Periodo / Año de Dotación
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPeriodoDestino(2026)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    periodoDestino === 2026
                      ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  2026 (Actual)
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodoDestino(2027)}
                  className={`py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    periodoDestino === 2027
                      ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  2027 (Proyección)
                </button>
              </div>
            </div>
          </div>

          {/* Zona de Arrastre / Selección de Archivo */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
              dragActive
                ? 'border-blue-500 bg-blue-500/10 scale-[0.99]'
                : file
                  ? 'border-emerald-500/80 bg-emerald-950/20'
                  : 'border-slate-700 hover:border-slate-500 bg-slate-950/30'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
              accept=".xlsx,.xls"
              className="hidden"
            />

            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-blue-400">
                <Upload className="w-6 h-6" />
              </div>
              <div>
                <p className="text-sm font-bold text-white">
                  {file ? file.name : 'Arrastra tu archivo Excel aquí o haz clic para buscar'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Compatible con planillas territoriales SLEP (ej. "Dotación Liceo Narciso T.xlsx" o nóminas detalladas)
                </p>
              </div>
            </div>
          </div>

          {/* Feedback de Carga */}
          {parsing && (
            <div className="flex items-center justify-center space-x-3 p-4 bg-slate-800/60 rounded-xl border border-slate-700">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-xs font-semibold text-slate-300">
                Analizando estructura matricial, detectando columnas de cursos y asignaturas...
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 bg-red-950/60 border border-red-800/80 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-800/80 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Vista Previa de Datos Detectados */}
          {parseResult && !parsing && (
            <div className="space-y-4">
              {/* Tarjetas de Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] uppercase font-bold">Cursos Detectados</span>
                    <BookOpen className="w-3.5 h-3.5 text-blue-400" />
                  </div>
                  <div className="text-xl font-black text-white">{parseResult.cursos.length}</div>
                  <div className="text-[10px] text-slate-400">Columnas de aula</div>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] uppercase font-bold">Docentes</span>
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                  <div className="text-xl font-black text-white">{parseResult.docentes.length}</div>
                  <div className="text-[10px] text-slate-400">Profesionales en nómina</div>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] uppercase font-bold">Horas Contrato</span>
                    <Clock className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="text-xl font-black text-white">{parseResult.totalHorasContrato} hrs</div>
                  <div className="text-[10px] text-slate-400">Jornada contratada</div>
                </div>

                <div className="bg-slate-800/60 p-3 rounded-xl border border-slate-700/70">
                  <div className="flex items-center justify-between text-slate-400 mb-1">
                    <span className="text-[11px] uppercase font-bold">Horas Asignadas</span>
                    <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  </div>
                  <div className="text-xl font-black text-white">{parseResult.totalHorasAulaAsignadas} hrs</div>
                  <div className="text-[10px] text-slate-400">{parseResult.totalAsignaciones} cruces materia-curso</div>
                </div>
              </div>

              {/* Lista de Cursos Identificados */}
              {parseResult.cursos.length > 0 && (
                <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                  <div className="text-xs font-bold text-slate-300 mb-2 flex items-center justify-between">
                    <span>Malla de Cursos Identificados en Encabezados ({parseResult.cursos.length})</span>
                    <span className="text-[10px] text-slate-400">Se vincularán automáticamente a este colegio</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                    {parseResult.cursos.map((c, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 bg-blue-950/70 text-blue-300 border border-blue-800/80 rounded-md font-semibold"
                      >
                        {c.nivel} {c.letra}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Muestra de Docentes y Asignaciones */}
              <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-800">
                <div className="text-xs font-bold text-slate-300 mb-2">
                  Vista Previa de Docentes y Asignaturas (primeros 5 de {parseResult.docentes.length})
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {parseResult.docentes.slice(0, 5).map((d, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-slate-900/80 rounded-lg border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-2"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{d.nombres} {d.apellidos}</span>
                          <span className="text-[10px] text-slate-400 font-mono">({d.run})</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Contrato: <strong className="text-slate-200">{d.horasContrato} hrs</strong>
                          {d.titularSubGral > 0 && ` • Titular Sub. Gral: ${d.titularSubGral} hrs`}
                          {d.titularPie > 0 && ` • PIE: ${d.titularPie} hrs`}
                          {d.titularSep > 0 && ` • SEP: ${d.titularSep} hrs`}
                        </div>
                      </div>

                      <div className="text-right flex-shrink-0">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                          {d.asignaciones.length} asignaciones ({d.asignaciones.reduce((s, a) => s + a.horasPedagogicasAula, 0)} hrs aula)
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            {colegioSeleccionado && (
              <span>Destino: <strong className="text-slate-200">{colegioSeleccionado.nombre}</strong> ({periodoDestino})</span>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancelar
            </button>

            <button
              onClick={handleConfirmarImportacion}
              disabled={!parseResult || saving || parsing}
              className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold text-white transition-all shadow-md ${
                !parseResult || saving || parsing
                  ? 'bg-slate-700 opacity-50 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-blue-500/20'
              }`}
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Importar a Dotación {periodoDestino}</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
