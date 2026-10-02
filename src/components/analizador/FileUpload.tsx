import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, Trash2, Play, Sparkles, FolderUp, BookOpen, Wrench, Shield, Code, Cpu, Key, Calendar } from 'lucide-react';
import type { GeminiModel } from '../../types/analizadorTypes';

interface FileUploadProps {
  onProcessFiles: (files: File[]) => Promise<void>;
  loading: boolean;
  onOpenPromptModal: () => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  models: GeminiModel[];
  onOpenKeyModal: () => void;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onProcessFiles,
  loading,
  onOpenPromptModal,
  selectedModel,
  onSelectModel,
  models,
  onOpenKeyModal,
}) => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files).filter((f) =>
        /\.(xlsx|xls|csv)$/i.test(f.name)
      );
      setSelectedFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter((f) =>
        /\.(xlsx|xls|csv)$/i.test(f.name)
      );
      setSelectedFiles((prev) => [...prev, ...droppedFiles]);
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartProcessing = () => {
    if (selectedFiles.length > 0) {
      onProcessFiles(selectedFiles);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Banner Informativo Ejecutivo */}
      <div className="bg-gradient-to-r from-[#002B49] via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-slate-700">
        <div className="relative z-10 max-w-3xl">
          <div className="flex flex-wrap gap-2 items-center mb-3">
            <div className="inline-flex items-center space-x-2 bg-orange-500/20 text-orange-300 px-3 py-1 rounded-full text-xs font-bold border border-orange-400/30">
              <Sparkles className="w-3.5 h-3.5 text-orange-400" />
              <span>Analizador de Dotación Docente SLEP</span>
            </div>

            <div className="inline-flex items-center space-x-2 bg-slate-800/80 text-slate-200 px-3 py-1 rounded-full text-xs font-semibold border border-slate-700">
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              <span>Modelo IA:</span>
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel(e.target.value)}
                className="bg-slate-900 text-white text-xs font-bold rounded px-2 py-0.5 border border-slate-600 focus:outline-hidden cursor-pointer"
                title="Cambiar modelo de IA activo"
              >
                {models.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.display_name || m.id} {m.badge ? `(${m.badge})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={onOpenKeyModal}
              className="inline-flex items-center space-x-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-3 py-1 rounded-full text-xs font-bold border border-amber-400/30 transition-colors"
            >
              <Key className="w-3.5 h-3.5" />
              <span>Configurar API Key</span>
            </button>
          </div>

          <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white mb-2">
            Consolidación Masiva con Detección de Cursos y Carga Docente
          </h2>
          <p className="text-blue-100/90 text-sm leading-relaxed mb-4">
            Carga una o múltiples planillas de dotación escolar (<strong>.xlsx, .xls o .csv</strong>). El motor híbrido clasifica
            las funciones en <span className="font-bold text-amber-300">Aula</span>, <span className="font-bold text-emerald-300">Técnica</span> o <span className="font-bold text-purple-300">Directiva</span>,
            identifica automáticamente los <strong>cursos atendidos</strong> (Prekínder a 4° Medio / Multigrado) y calcula la <strong>carga horaria exacta asignada a cada docente</strong>.
          </p>

          <div className="flex flex-wrap gap-2.5 items-center">
            <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-700 px-3 py-1.5 rounded-xl text-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
              <span className="font-semibold text-slate-200">Asistencia Inteligente de Ingesta:</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30 text-[10px]">
                Activa (Gemini + Normativa MINEDUC)
              </span>
            </div>

            <button
              onClick={onOpenPromptModal}
              className="inline-flex items-center space-x-1.5 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-bold border border-white/20 transition-colors"
            >
              <Code className="w-3.5 h-3.5 text-orange-400" />
              <span>Ver/Editar Prompt IA</span>
            </button>
          </div>
        </div>
      </div>

      {/* Zona Drag & Drop */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-white shadow-xs ${
          dragOver ? 'border-orange-500 bg-orange-50/40 scale-[1.005]' : 'border-slate-300 hover:border-slate-400'
        }`}
      >
        <div className="max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto shadow-xs">
            <Upload className="w-8 h-8" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-800">
              Arrastra y suelta tus planillas aquí
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Compatible con archivos de Excel (<strong>.xlsx, .xls</strong>) y planillas de texto (<strong>.csv</strong>).
            </p>
          </div>

          <div className="flex justify-center gap-3 pt-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              multiple
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <input
              type="file"
              ref={folderInputRef}
              onChange={handleFileChange}
              multiple
              // @ts-ignore
              webkitdirectory=""
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-colors shadow-sm flex items-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-orange-400" /> Seleccionar Archivos
            </button>
            <button
              onClick={() => folderInputRef.current?.click()}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors border border-slate-300 flex items-center gap-2"
            >
              <FolderUp className="w-4 h-4 text-slate-600" /> Seleccionar Carpeta
            </button>
          </div>
        </div>
      </div>

      {/* Lista de Archivos Seleccionados */}
      {selectedFiles.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4 text-orange-500" />
              <span className="text-xs font-bold text-slate-800">
                Planillas preparadas para análisis ({selectedFiles.length})
              </span>
            </div>
            <button
              onClick={() => setSelectedFiles([])}
              className="text-xs font-bold text-red-600 hover:text-red-700 transition-colors"
            >
              Limpiar lista
            </button>
          </div>

          <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
            {selectedFiles.map((file, idx) => (
              <div key={idx} className="p-3 px-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600 font-mono text-xs font-bold">
                    {file.name.endsWith('.csv') ? 'CSV' : 'XLS'}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-800 truncate max-w-md">{file.name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeFile(idx)}
                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                  title="Quitar de la lista"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end">
            <button
              onClick={handleStartProcessing}
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-md transition-all"
            >
              <Play className="w-4 h-4 fill-white" />
              <span>Procesar {selectedFiles.length} Planilla{selectedFiles.length > 1 ? 's' : ''}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
