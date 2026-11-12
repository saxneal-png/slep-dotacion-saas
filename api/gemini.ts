/**
 * Vercel Serverless Function: Proxy seguro para Google Gemini API.
 * Protege GEMINI_API_KEY en variables de entorno del servidor (Vercel)
 * y valida opcionalmente el JWT de Supabase Auth antes de reenviar.
 */

const ALLOWED_MODELS = new Set([
  'gemini-3.7-flash',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-2.5-pro'
]);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();
  if (!geminiApiKey) {
    res.status(503).json({ error: 'GEMINI_API_KEY no configurada en el servidor Vercel.' });
    return;
  }

  // Validación de sesión Supabase Auth cuando se envía Bearer token
  const authHeader: string = req.headers?.authorization || '';
  const supabaseUrl = (process.env.VITE_SUPABASE_URL || '').trim();
  const supabaseAnonKey = (process.env.VITE_SUPABASE_ANON_KEY || '').trim();

  if (supabaseUrl && supabaseAnonKey) {
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token de sesión requerido.' });
      return;
    }
    try {
      const userResp = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          Authorization: authHeader,
          apikey: supabaseAnonKey
        }
      });
      if (!userResp.ok) {
        res.status(401).json({ error: 'Sesión inválida o expirada.' });
        return;
      }
    } catch {
      res.status(502).json({ error: 'No se pudo verificar la sesión con Supabase Auth.' });
      return;
    }
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
    const requestedModel = typeof body.model === 'string' ? body.model.trim() : 'gemini-2.5-flash';
    const model = ALLOWED_MODELS.has(requestedModel) ? requestedModel : 'gemini-2.5-flash';
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
