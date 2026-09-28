import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Sparkles,
  Send,
  X,
  Bot,
  User,
  Key,
  Trash2,
  Copy,
  Check,
  Zap,
  HelpCircle,
  Settings,
  Scale,
  AlertTriangle,
  Users,
  ShieldCheck,
  ChevronRight,
  BookOpen
} from 'lucide-react';
import {
  Establecimiento,
  CursoSae,
  Docente,
  AsignacionHoraria,
  SalaInfraestructura
} from '../types';
import {
  construirContextoDotacion,
  responderConsultaLocalmente,
  consultarCopilotGemini,
  CopilotMessage,
  DotacionContextoCompleto
} from '../services/dotacionCopilotService';

interface DotacionCopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  establecimiento: Establecimiento | null;
  periodo: number;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  todosLosDocentesTerritorio: Docente[];
  todosLosEstablecimientos: Establecimiento[];
}

export const DotacionCopilotDrawer: React.FC<DotacionCopilotDrawerProps> = ({
  isOpen,
  onClose,
  establecimiento,
  periodo,
  salas,
  cursos,
  docentes,
  asignaciones,
  todosLosDocentesTerritorio,
  todosLosEstablecimientos
}) => {
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [modalConfigAbierto, setModalConfigAbierto] = useState(false);

  // Configuración Gemini (sincronizada automáticamente con la clave general de la aplicación)
  const [apiKey, setApiKey] = useState<string>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_api_key') || '' : '';
  });
  const [modelName, setModelName] = useState<string>(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('gemini_copilot_model') || 'gemini-2.5-flash-lite' : 'gemini-2.5-flash-lite';
  });

  // Sincronizar automáticamente la API Key general cada vez que se abre el drawer
  useEffect(() => {
    if (isOpen && typeof localStorage !== 'undefined') {
      const globalKey = localStorage.getItem('gemini_api_key') || '';
      setApiKey(globalKey);
      const savedModel = localStorage.getItem('gemini_copilot_model') || 'gemini-2.5-flash-lite';
      setModelName(savedModel);
    }
  }, [isOpen]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Serializar contexto en tiempo real
  const contexto = useMemo<DotacionContextoCompleto | null>(() => {
    if (!establecimiento) return null;
    return construirContextoDotacion(
      establecimiento,
      periodo,
      salas,
      cursos,
      docentes,
      asignaciones,
      todosLosDocentesTerritorio,
      todosLosEstablecimientos
    );
  }, [
    establecimiento,
    periodo,
    salas,
    cursos,
    docentes,
    asignaciones,
    todosLosDocentesTerritorio,
    todosLosEstablecimientos
  ]);

  // Mensaje de bienvenida inicial
  useEffect(() => {
    if (isOpen && messages.length === 0 && establecimiento && contexto) {
      const b = contexto.diagnostico.balanzaGeneral;
      const estadoBalanza = b.superavitDeficitLectivo >= 0 
        ? `Superávit de +${b.superavitDeficitLectivo} HA` 
        : `Déficit de ${Math.abs(b.superavitDeficitLectivo)} HA`;

      const bienvenida: CopilotMessage = {
        id: 'msg-welcome',
        sender: 'assistant',
        text: `Hola, soy **¡Qué no va a saber! IA**, tu asistente inteligente oficial para la dotación de **${establecimiento.nombre}** (RBD ${establecimiento.rbd}, Período ${periodo}).\n\n` +
          `• **Estado de la Balanza:** ${b.superavitDeficitLectivo >= 0 ? '🟢' : '🔴'} **${estadoBalanza}** (${b.horasAulaDemandadasCurriculo} HA demandadas vs ${b.horasLectivasAsignadas} HA asignadas)\n` +
          `• **Planta Docente:** ${contexto.docentes.length} docentes (${b.horasContratadasTotales}h totales)\n` +
          `• **Matrícula:** ${b.totalMatriculaProyectada} alumnos en ${contexto.cursos.length} cursos\n\n` +
          `¿Qué deseas consultar o calcular? Selecciona una pregunta rápida o escribe tu consulta.`,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        source: apiKey ? 'gemini' : 'local'
      };
      setMessages([bienvenida]);
    }
  }, [isOpen, establecimiento, periodo, contexto, apiKey, messages.length]);

  // Auto-scroll al final de los mensajes
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus en el input al abrir
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputValue).trim();
    if (!prompt || loading || !contexto) return;

    const userMsg: CopilotMessage = {
      id: `msg-user-${Date.now()}`,
      sender: 'user',
      text: prompt,
      timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInputValue('');
    setLoading(true);

    try {
      let respuestaTexto = '';
      let source: 'gemini' | 'local' = 'local';

      if (apiKey.trim()) {
        source = 'gemini';
        const historial = messages
          .filter(m => m.id !== 'msg-welcome')
          .slice(-6)
          .map(m => ({
            role: m.sender === 'user' ? ('user' as const) : ('model' as const),
            text: m.text
          }));

        respuestaTexto = await consultarCopilotGemini(
          prompt,
          contexto,
          historial,
          apiKey.trim(),
          modelName
        );
      } else {
        source = 'local';
        // Respuesta determinista instantánea
        respuestaTexto = responderConsultaLocalmente(prompt, contexto);
      }

      const botMsg: CopilotMessage = {
        id: `msg-bot-${Date.now()}`,
        sender: 'assistant',
        text: respuestaTexto,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        source
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      const errorMsg: CopilotMessage = {
        id: `msg-err-${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ Ocurrió un error al procesar la consulta: ${err?.message || err}. Puedes probar usando el motor local.`,
        timestamp: new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' }),
        source: 'local'
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleCopiarTexto = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const handleGuardarConfig = () => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('gemini_api_key', apiKey.trim());
      localStorage.setItem('gemini_copilot_model', modelName);
    }
    setModalConfigAbierto(false);
  };

  const sugerenciasRapidas = [
    { label: '📊 Balance & Déficits', prompt: '¿Cuál es el balance general de horas y qué asignaturas tienen déficit?' },
    { label: '🚨 Sobreasignación Docente', prompt: '¿Qué docentes están sobreasignados o exceden el límite de docencia de aula?' },
    { label: '🏫 Docentes Multi-Colegio', prompt: '¿Hay docentes con asignación en múltiples establecimientos del SLEP?' },
    { label: '💰 Desglose SEP y PIE', prompt: 'Mostrar desglose de financiamiento Subvención General, SEP y PIE' },
    { label: '👴 Artículo 69', prompt: '¿Qué docentes tienen beneficio de reducción horaria del Artículo 69?' },
    { label: '📝 Redactar Propuesta', prompt: 'Redacta una propuesta de ajuste para cubrir las horas deficitarias de la dotación' }
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-full sm:max-w-xl md:max-w-2xl bg-white dark:bg-slate-900 shadow-2xl flex flex-col border-l border-slate-200 dark:border-slate-800 transition-transform duration-300 ease-out">
          
          {/* Header */}
          <div className="px-4 sm:px-6 py-4 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-b border-blue-900/40 text-white flex items-center justify-between shadow-sm shrink-0">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md shadow-blue-500/30 flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center space-x-2">
                  <h2 className="text-sm sm:text-base font-black tracking-tight text-white truncate flex items-center gap-1.5">
                    <span>¡Qué no va a saber! IA</span>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                  </h2>
                  <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30">
                    {periodo}
                  </span>
                  {apiKey.trim() ? (
                    <span className="flex items-center space-x-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Zap className="w-3 h-3" />
                      <span>Gemini AI</span>
                    </span>
                  ) : (
                    <span className="flex items-center space-x-1 px-2 py-0.5 text-[11px] font-medium rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      <Zap className="w-3 h-3" />
                      <span>Motor Local</span>
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-300 truncate mt-0.5">
                  {establecimiento ? establecimiento.nombre : 'Sin colegio seleccionado'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => setModalConfigAbierto(true)}
                title="Configuración de IA Gemini"
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setMessages([])}
                title="Limpiar conversación"
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={onClose}
                title="Cerrar (Esc)"
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors ml-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Sugerencias Rápidas / Chips */}
          <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 overflow-x-auto scrollbar-none flex items-center space-x-2 shrink-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex-shrink-0 flex items-center">
              <HelpCircle className="w-3 h-3 mr-1" />
              Sugerencias:
            </span>
            {sugerenciasRapidas.map((sug, idx) => (
              <button
                key={idx}
                disabled={loading || !contexto}
                onClick={() => handleSendMessage(sug.prompt)}
                className="px-2.5 py-1 text-xs font-medium rounded-full bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/40 hover:text-blue-600 dark:hover:text-blue-300 border border-slate-200 dark:border-slate-600 shadow-sm transition-all whitespace-nowrap flex-shrink-0 disabled:opacity-50"
              >
                {sug.label}
              </button>
            ))}
          </div>

          {/* Message List */}
          <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-4 bg-slate-50/50 dark:bg-slate-950/40 custom-scrollbar">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex items-start space-x-3 ${msg.sender === 'user' ? 'flex-row-reverse space-x-reverse' : ''}`}
              >
                {/* Avatar */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white'
                      : 'bg-gradient-to-tr from-slate-800 to-blue-950 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  {msg.sender === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                {/* Bubble */}
                <div className={`max-w-[85%] group relative ${msg.sender === 'user' ? 'text-right' : 'text-left'}`}>
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none'
                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-tl-none'
                    }`}
                  >
                    {/* Contenido con formateo simple para markdown */}
                    <div className="space-y-2 whitespace-pre-wrap font-sans">
                      {msg.text.split('\n\n').map((paragraph, pIdx) => {
                        // Render de tablas markdown
                        if (paragraph.includes('|') && paragraph.includes('\n|')) {
                          const lines = paragraph.split('\n').filter(l => l.trim().startsWith('|'));
                          if (lines.length >= 2) {
                            const headers = lines[0].split('|').slice(1, -1).map(h => h.trim());
                            const rows = lines.slice(2).map(r => r.split('|').slice(1, -1).map(c => c.trim()));
                            return (
                              <div key={pIdx} className="overflow-x-auto my-2 rounded-lg border border-slate-200 dark:border-slate-700">
                                <table className="w-full text-xs text-left">
                                  <thead className="bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 font-semibold">
                                    <tr>
                                      {headers.map((h, i) => (
                                        <th key={i} className="px-2.5 py-1.5 border-b border-slate-200 dark:border-slate-700">{h.replace(/\*\*/g, '')}</th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {rows.map((row, rIdx) => (
                                      <tr key={rIdx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                        {row.map((cell, cIdx) => (
                                          <td key={cIdx} className="px-2.5 py-1.5">{cell.replace(/\*\*/g, '')}</td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            );
                          }
                        }

                        // Formateo de títulos y párrafos
                        if (paragraph.startsWith('### ')) {
                          return (
                            <h4 key={pIdx} className="text-sm font-bold text-blue-600 dark:text-blue-400 mt-2 mb-1">
                              {paragraph.replace('### ', '')}
                            </h4>
                          );
                        }

                        // Formateo de alertas blockquote
                        if (paragraph.startsWith('> ')) {
                          return (
                            <div key={pIdx} className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border-l-4 border-blue-500 text-xs text-slate-700 dark:text-slate-300 my-1">
                              {paragraph.replace('> ', '')}
                            </div>
                          );
                        }

                        return <p key={pIdx}>{paragraph}</p>;
                      })}
                    </div>
                  </div>

                  {/* Metadata & Copy Button */}
                  <div className={`flex items-center space-x-2 mt-1 text-[11px] text-slate-400 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <span>{msg.timestamp}</span>
                    {msg.source && (
                      <span className="px-1.5 py-0.2 rounded text-[10px] bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase font-mono">
                        {msg.source}
                      </span>
                    )}
                    {msg.sender === 'assistant' && (
                      <button
                        onClick={() => handleCopiarTexto(msg.id, msg.text)}
                        title="Copiar respuesta"
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-600 flex items-center space-x-1"
                      >
                        {copiedId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-500" />
                            <span className="text-emerald-500">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copiar</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start space-x-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-slate-800 to-blue-950 text-blue-300 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="rounded-2xl rounded-tl-none px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs flex items-center space-x-2 shadow-sm">
                  <Sparkles className="w-4 h-4 text-blue-500 animate-pulse" />
                  <span>Analizando dotación y normativa MINEDUC...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 shrink-0">
            <div className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all shadow-inner">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  apiKey.trim()
                    ? `Haz una pregunta sobre la dotación de ${establecimiento?.nombre || 'este colegio'}...`
                    : `Consulta la dotación (Modo Local)...`
                }
                rows={2}
                className="w-full p-3 pr-12 bg-transparent text-slate-800 dark:text-slate-100 placeholder-slate-400 text-sm resize-none focus:outline-none scrollbar-none"
              />
              <button
                disabled={!inputValue.trim() || loading}
                onClick={() => handleSendMessage()}
                className="absolute right-2.5 bottom-2.5 p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 disabled:hover:bg-blue-600 transition-all shadow-sm"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
              <span>Presiona <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">Enter</kbd> para enviar, <kbd className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 font-mono text-[10px]">Shift+Enter</kbd> para salto</span>
              {!apiKey.trim() && (
                <button
                  onClick={() => setModalConfigAbierto(true)}
                  className="text-blue-500 hover:underline flex items-center space-x-1"
                >
                  <Key className="w-3 h-3 mr-0.5" />
                  <span>Activar Gemini AI</span>
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Modal de Configuración Gemini */}
      {modalConfigAbierto && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto custom-scrollbar bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4 my-auto">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 shrink-0">
              <div className="flex items-center space-x-2 text-slate-800 dark:text-slate-100 font-bold">
                <Sparkles className="w-5 h-5 text-blue-500" />
                <span>Configuración de Gemini AI</span>
              </div>
              <button
                onClick={() => setModalConfigAbierto(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              La API Key configurada aquí se comparte automáticamente con todos los módulos de la aplicación (Analizador de Nóminas, Exportador de Matriz y Copilot). Utiliza el modelo <strong>Gemini 2.5 Flash Lite</strong> para máxima velocidad y eficiencia.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  API Key de Google Gemini
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Modelo de Lenguaje
                </label>
                <select
                  value={modelName}
                  onChange={e => setModelName(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                >
                  <option value="gemini-2.5-flash-lite">Gemini 2.5 Flash Lite (Ultrarrápido y Económico - Predeterminado)</option>
                  <option value="gemini-flash-lite-latest">Gemini Flash Lite Latest</option>
                  <option value="gemini-2.5-flash">Gemini 2.5 Flash (Estándar)</option>
                  <option value="gemini-2.5-pro">Gemini 2.5 Pro (Razonamiento Complejo)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                onClick={() => setModalConfigAbierto(false)}
                className="px-4 py-2 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                onClick={handleGuardarConfig}
                className="px-4 py-2 text-xs font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-500 shadow-sm"
              >
                Guardar Configuración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
