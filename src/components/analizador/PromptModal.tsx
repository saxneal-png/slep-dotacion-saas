import React, { useState, useEffect } from 'react';
import { X, Sparkles, RotateCcw, Save, Copy, Check } from 'lucide-react';
import { DEFAULT_GEMINI_PROMPT } from '../../services/analizador/classifier';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (msg: string, type?: 'success' | 'error') => void;
}

export const PromptModal: React.FC<PromptModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const [prompt, setPrompt] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      const saved = localStorage.getItem('gemini_custom_prompt');
      setPrompt(saved || DEFAULT_GEMINI_PROMPT);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    localStorage.setItem('gemini_custom_prompt', prompt);
    onNotify('¡Prompt ministerial actualizado correctamente!');
    onClose();
  };

  const handleReset = () => {
    localStorage.removeItem('gemini_custom_prompt');
    setPrompt(DEFAULT_GEMINI_PROMPT);
    onNotify('Prompt restablecido a la versión oficial SLEP');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    onNotify('Prompt copiado al portapapeles');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Prompt del Sistema (Google Gemini)</h3>
              <p className="text-xs text-slate-400">Instrucciones y directrices del Estatuto Docente enviadas al modelo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Editor */}
        <div className="p-6 flex-1 flex flex-col space-y-3 overflow-hidden text-slate-700">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Editor de Prompt Ministerial
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={handleReset}
                className="text-xs font-semibold text-orange-700 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-2.5 py-1 rounded-lg border border-orange-200 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Restablecer Oficial
              </button>
            </div>
          </div>

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="flex-1 w-full min-h-[350px] p-4 text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden leading-relaxed resize-none text-slate-800"
          />

          <p className="text-[11px] text-slate-500">
            💡 Mantén la etiqueta <code className="text-blue-600 font-bold">{'{activities_json}'}</code> en el texto para que el sistema inserte la lista de asignaturas y cargos a clasificar.
          </p>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-md transition-all flex items-center gap-1.5"
          >
            <Save className="w-4 h-4" /> Guardar Cambios
          </button>
        </div>
      </div>
    </div>
  );
};
