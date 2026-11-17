/**
 * Vercel Serverless Function: Proxy seguro para Google Gemini API.
 * Protege GEMINI_API_KEY en variables de entorno del servidor (Vercel)
 * y valida opcionalmente el JWT de Supabase Auth antes de reenviar.
 */

export const config = {
  maxDuration: 60
};

const ALLOWED_MODELS = new Set([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-2.0-flash',
  'gemini-2.5-pro'
]);

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitBuckets.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    return false;
  }
  entry.count += 1;
  return true;
}

export default async function handler(req: any, res: any) {
  const allowedOrigin = (process.env.ALLOWED_ORIGIN || '').trim();
  const origin = String(req.headers?.origin || '');
  if (allowedOrigin && origin && origin !== allowedOrigin) {
    res.status(403).json({ error: 'Origen no autorizado.' });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!geminiApiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el servidor Vercel.' });
    return;
  }

  // Validación estricta fail-closed de sesión Supabase Auth
  const authHeader: string = req.headers?.authorization || '';
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: 'Autenticación Supabase no configurada en el servidor.' });
    return;
  }
  if (!authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token de sesión requerido.' });
    return;
  }

  let userId = 'anon';
  try {
    const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authHeader,
        apikey: supabaseAnonKey
      },
      signal: AbortSignal.timeout(4000)
    });
    if (!userResp.ok) {
      res.status(401).json({ error: 'Sesión inválida o expirada.' });
      return;
    }
    const userData: any = await userResp.json();
    userId = String(userData?.id || 'unknown');

    // Verificar que el usuario siga activo en usuarios_sistema
    const profileResp = await fetch(
      `${supabaseUrl}/rest/v1/usuarios_sistema?select=activo,role&auth_uid=eq.${encodeURIComponent(userId)}&limit=1`,
      {
        headers: {
          Authorization: authHeader,
          apikey: supabaseAnonKey
        }
      }
    );
    if (profileResp.ok) {
      const profiles: any[] = await profileResp.json();
      if (profiles.length > 0 && profiles[0].activo === false) {
        res.status(403).json({ error: 'Cuenta pausada o deshabilitada.' });
        return;
      }
    }
  } catch {
    res.status(502).json({ error: 'No se pudo verificar la sesión con Supabase Auth.' });
    return;
  }

  if (!checkRateLimit(userId)) {
    res.status(429).json({ error: 'Límite de solicitudes IA excedido. Intente en un minuto.' });
    return;
  }

  try {
    const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    if (rawBody.length > 512_000) {
      res.status(413).json({ error: 'Payload excede el tamaño máximo permitido.' });
      return;
    }
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const requestedModel = typeof body.model === 'string' ? body.model.trim() : 'gemini-2.5-flash';
    if (!ALLOWED_MODELS.has(requestedModel)) {
      res.status(400).json({ error: `Modelo no permitido: ${requestedModel}` });
      return;
    }
    const model = requestedModel;
    const payload = body.payload;

    if (!payload || typeof payload !== 'object') {
      res.status(400).json({ error: 'Payload inválido.' });
      return;
    }

    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': geminiApiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.send(text);
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Error interno en proxy Gemini.' });
  }
}
