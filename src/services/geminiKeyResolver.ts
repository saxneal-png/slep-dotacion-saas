/**
 * geminiKeyResolver.ts
 * Resuelve la API Key de Gemini activa respetando la soberanía del perfil del usuario.
 * Prioridad:
 * 1. API Key personal del usuario en sesión activa (AuthService)
 * 2. API Key general institucional configurada en Configuraciones Generales
 * 3. Fallback de localStorage ('gemini_api_key')
 */

import { AuthService } from './authService';
import { cargarConfiguracionGeneral } from './configuracionGeneralService';

export function obtenerGeminiApiKeyActiva(): string {
  // 1. Clave personal del usuario autenticado en su perfil
  try {
    const session = AuthService.getSessionActual();
    const userKey = session?.usuario?.geminiApiKey?.trim();
    if (userKey) {
      return userKey;
    }
  } catch (_) {}

  // 2. Clave institucional configurada en Configuraciones Generales
  try {
    const config = cargarConfiguracionGeneral();
    const configKey = config?.gemini?.apiKey?.trim();
    if (configKey) {
      return configKey;
    }
  } catch (_) {}

  // 3. Fallback en localStorage
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const localKey = localStorage.getItem('gemini_api_key')?.trim();
      if (localKey) {
        return localKey;
      }
    } catch (_) {}
  }

  return '';
}

export function tieneGeminiApiKeyActiva(): boolean {
  return obtenerGeminiApiKeyActiva().length > 0;
}
