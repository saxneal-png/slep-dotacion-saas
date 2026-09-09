import React, { useState, useEffect } from 'react';
import { X, Key, CheckCircle, AlertCircle, Loader2, Sparkles, ExternalLink, Cpu, Check, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';
import type { GeminiModel } from '../../types/analizadorTypes';
import { geminiFetch } from '../../services/geminiApiClient';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveKey: (key: string) => void;
  selectedModel: string;
  onSelectModel: (model: string) => void;
  models: GeminiModel[];
  onUpdateModels: (models: GeminiModel[]) => void;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({
  isOpen,
  onClose,
  apiKey,
  onSaveKey,
  selectedModel,
  onSelectModel,
  models,
  onUpdateModels,
}) => {
  const [keyInput, setKeyInput] = useState(apiKey);
  const [currentModel, setCurrentModel] = useState(selectedModel || 'gemini-3.7-flash');
  const [loadingModels, setLoadingModels] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [analizarTodos, setAnalizarTodos] = useState<boolean>(
    () => localStorage.getItem('gemini_export_analizar_todos') === 'true'
  );

  useEffect(() => {
    setKeyInput(apiKey);
    setCurrentModel(selectedModel || 'gemini-3.7-flash');
    setTestResult(null);
    setAnalizarTodos(localStorage.getItem('gemini_export_analizar_todos') === 'true');
  }, [apiKey, selectedModel, isOpen]);

  if (!isOpen) return null;

  const handleMapModels = async (keyToUse?: string) => {
    const key = (keyToUse !== undefined ? keyToUse : keyInput).trim();
    if (!key || key.length < 10) {
      setTestResult({
        success: false,
        message: 'Ingresa una clave válida antes de mapear los modelos.',
      });
      return;
    }

    setLoadingModels(true);
    setTestResult(null);

    try {
      const googleRes = await geminiFetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
      if (googleRes.ok) {
        const gData = await googleRes.json();
        if (gData.models && Array.isArray(gData.models)) {
          const mappedModels: GeminiModel[] = gData.models
            .filter((m: any) => m.supportedGenerationMethods?.includes('generateContent'))
            .map((m: any) => {
              const id = m.name.replace('models/', '');
              return {
                id,
                display_name: m.displayName || id,
                description: m.description || 'Modelo Gemini',
                badge: id.includes('flash') ? 'Rápido' : id.includes('pro') ? 'Precisión' : undefined,
                is_recommended: id.includes('flash'),
              };
            });

          if (mappedModels.length > 0) {
            onUpdateModels(mappedModels);
            setTestResult({
              success: true,
              message: `¡Mapeo exitoso! Se encontraron ${mappedModels.length} modelos autorizados en Google AI Studio.`,
            });
            return;
          }
        }
      } else {
        const errJson = await googleRes.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Error HTTP ${googleRes.status}`);
      }
    } catch (e: any) {
      setTestResult({
        success: false,
        message: `No se pudieron obtener los modelos: ${e.message || 'Verifica tu conexión y clave API.'}`,
      });
    } finally {
      setLoadingModels(false);
    }
  };

  const handleTestKey = async () => {
    const key = keyInput.trim();
    if (!key) {
      setTestResult({ success: false, message: 'Por favor ingresa una API Key.' });
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const modelToTest = currentModel || 'gemini-3.7-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelToTest}:generateContent?key=${key}`;
      const resp = await geminiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Hola, confirma que respondes con OK' }] }],
          generationConfig: { maxOutputTokens: 10 },
        }),
      });

      if (resp.ok) {
        setTestResult({
          success: true,
          message: `¡Conexión exitosa! El modelo ${modelToTest} respondió correctamente a la prueba.`,
        });
      } else {
        const errData = await resp.json().catch(() => ({}));
        setTestResult({
          success: false,
          message: errData?.error?.message || `Error de conexión (Código HTTP: ${resp.status}).`,
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Error de red: ${err.message || 'No se pudo contactar a los servidores de Google.'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    onSaveKey(keyInput.trim());
    onSelectModel(currentModel);
    localStorage.setItem('gemini_export_analizar_todos', analizarTodos ? 'true' : 'false');
    onClose();
  };

  const handleToggleAnalizarTodos = () => {
    const newVal = !analizarTodos;
    setAnalizarTodos(newVal);
    localStorage.setItem('gemini_export_analizar_todos', newVal ? 'true' : 'false');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold">Configuración de Google Gemini AI</h3>
              <p className="text-xs text-slate-400">Clasificación híbrida de cargos, asignaturas y funciones escolares</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-700">
          {/* Key Input Section */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                API Key de Google AI Studio
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                Obtener API Key Gratis <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div className="flex gap-2">
              <input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Pega aquí tu clave (AIzaSy...)"
                className="flex-1 px-4 py-2.5 text-sm bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:outline-hidden font-mono"
              />
              <button
                onClick={() => handleMapModels()}
                disabled={loadingModels || !keyInput.trim()}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm flex-shrink-0"
                title="Detecta automáticamente los modelos autorizados por Google para tu clave"
              >
                {loadingModels ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                Mapear Modelos
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              🔒 Tu clave se almacena de forma privada en tu equipo (localStorage) y nunca sale a servidores externos de terceros.
            </p>
          </div>

          {/* Test Feedback */}
          {testResult && (
            <div
              className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
                testResult.success
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-800'
              }`}
            >
              {testResult.success ? (
                <CheckCircle className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div className="flex-1">
                <span className="font-semibold">{testResult.message}</span>
              </div>
            </div>
          )}

          {/* Model Selector Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-orange-500" /> Modelos Gemini Disponibles ({models.length})
              </label>
              <span className="text-[11px] font-semibold text-slate-500">
                Seleccionado: <span className="font-mono text-blue-600 font-bold">{currentModel}</span>
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1">
              {models.map((m) => {
                const isSelected = currentModel === m.id;
                return (
                  <div
                    key={m.id}
                    onClick={() => setCurrentModel(m.id)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'bg-blue-50/70 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        {m.display_name}
                        {m.badge && (
                          <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                            m.badge === 'Rápido' || m.badge === 'Nueva Generación'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
                            {m.badge}
                          </span>
                        )}
                      </span>
                      {isSelected && (
                        <div className="w-4 h-4 rounded-full bg-blue-600 text-white flex items-center justify-center flex-shrink-0">
                          <Check className="w-3 h-3" />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 line-clamp-2">{m.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Toggle: Asistente de Exportación Excel */}
          <div className="border border-teal-200 rounded-xl bg-teal-50/50 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-teal-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-teal-800">Asistente de Exportación Excel</span>
            </div>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Al exportar la Matriz Excel de Dotación, Gemini puede analizar la información para clasificar correctamente
              las secciones y generar observaciones de auditoría inteligentes por docente.
            </p>
            <button
              onClick={handleToggleAnalizarTodos}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                analizarTodos
                  ? 'border-teal-500 bg-teal-500 text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
              }`}
            >
              <div className="text-left">
                <p className="text-xs font-bold">
                  {analizarTodos ? '🤖 Analizar toda la dotación' : 'Analizar solo docentes ambiguos'}
                </p>
                <p className={`text-[10px] mt-0.5 ${analizarTodos ? 'text-teal-100' : 'text-slate-500'}`}>
                  {analizarTodos
                    ? 'Gemini revisa TODOS los docentes del colegio en cada exportación (más preciso, más tokens)'
                    : 'Gemini interviene solo cuando la clasificación local no es concluyente (más rápido)'}
                </p>
              </div>
              {analizarTodos
                ? <ToggleRight className="w-8 h-8 text-white flex-shrink-0" />
                : <ToggleLeft className="w-8 h-8 text-slate-400 flex-shrink-0" />}
            </button>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleTestKey}
            disabled={testing || !keyInput.trim()}
            className="px-4 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-orange-500" />}
            Probar Conexión
          </button>
          <div className="flex items-center gap-2">
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
              <Check className="w-4 h-4" /> Guardar y Aplicar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
