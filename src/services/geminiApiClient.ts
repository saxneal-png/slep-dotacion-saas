/**
 * Cliente seguro universal para llamadas a la API de Google Gemini.
 *
 * En la aplicación de escritorio Electron, las llamadas fetch desde el renderer (file://)
 * son bloqueadas por Chromium debido a políticas de CORS. Este módulo redirige automáticamente
 * las solicitudes a través del proceso principal de Node.js (net.fetch) cuando está en Electron,
 * y usa window.fetch nativo cuando está en el navegador web.
 */

declare global {
  interface Window {
    electronAPI?: {
      geminiRequest?: (url: string, options?: any) => Promise<{ ok: boolean; status: number; data: string; error?: string }>;
      saveFileDialog?: (options: any) => Promise<string | null>;
      openFileDialog?: (options: any) => Promise<string | null>;
      writeFile?: (filePath: string, content: string | Uint8Array) => Promise<{ success: boolean; error?: string }>;
      readFile?: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      getVersion?: () => Promise<string>;
      isDesktop?: boolean;
    };
  }
}

export interface GeminiResponseWrapper {
  ok: boolean;
  status: number;
  json: () => Promise<any>;
  text: () => Promise<string>;
}

export async function geminiFetch(url: string, options?: RequestInit): Promise<GeminiResponseWrapper> {
  // Si estamos en entorno Electron de escritorio con IPC disponible
  if (typeof window !== 'undefined' && window.electronAPI && typeof window.electronAPI.geminiRequest === 'function') {
    const ipcResult = await window.electronAPI.geminiRequest(url, {
      method: options?.method || 'GET',
      headers: (options?.headers as any) || undefined,
      body: typeof options?.body === 'string' ? options.body : undefined
    });

    return {
      ok: ipcResult.ok,
      status: ipcResult.status,
      json: async () => {
        try {
          return JSON.parse(ipcResult.data);
        } catch (e) {
          throw new Error(`Respuesta no es JSON valido: ${(ipcResult.data || '').slice(0, 100)}`);
        }
      },
      text: async () => ipcResult.data
    };
  }

  // Si estamos en navegador estandar o en entorno Node/Vitest
  const resp = await fetch(url, options);
  return {
    ok: resp.ok,
    status: resp.status,
    json: () => resp.json(),
    text: () => resp.text()
  };
}

/**
 * Función utilitaria para invocar Gemini con fallback secuencial de modelos.
 */
export async function generateGeminiResponse(
  prompt: string,
  apiKey: string,
  modelName: string = 'gemini-3.7-flash'
): Promise<string> {
  const candidateModels = [
    modelName,
    'gemini-3.7-flash',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ].filter((v, i, a) => a.indexOf(v) === i);

  let lastError: any = null;

  for (const m of candidateModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
      const resp = await geminiFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.1,
          },
        }),
      });

      if (!resp.ok) continue;

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) return text;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('No se pudo obtener respuesta de la API de Gemini');
}

