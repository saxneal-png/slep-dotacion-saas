import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import {
  AuthService,
  hashPassword,
  verifyPassword,
  generateSalt
} from '../src/services/authService';
import { obtenerGeminiApiKeyActiva } from '../src/services/geminiKeyResolver';
import { getDb } from '../src/database/dbCore';
import { hasAppliedMigration } from '../src/database/schema';
import geminiProxyHandler from '../api/gemini';

describe('Remediación de Seguridad y Estabilidad (Auditoría P0/P1)', () => {
  const store: Record<string, string> = {};

  beforeAll(() => {
    (globalThis as any).localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (i: number) => Object.keys(store)[i] ?? null,
      length: 0
    };
  });

  beforeEach(() => {
    localStorage.clear();
  });

  it('deriva contraseñas con PBKDF2-HMAC-SHA256 (100k iteraciones) y verifica compatibilidad con SHA-256 legado', async () => {
    const salt = generateSalt();
    const derived = await hashPassword('ClaveInstitucional#2027', salt);

    expect(derived.startsWith('pbkdf2_sha256$100000$')).toBe(true);
    expect(await verifyPassword('ClaveInstitucional#2027', salt, derived)).toBe(true);
    expect(await verifyPassword('ClaveIncorrecta', salt, derived)).toBe(false);

    // Simular hash SHA-256 legado de 64 hex chars
    const enc = new TextEncoder();
    const buf = await crypto.subtle.digest('SHA-256', enc.encode('LegacyPass2026' + salt));
    const legacyHex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    expect(await verifyPassword('LegacyPass2026', salt, legacyHex)).toBe(true);
    expect(await verifyPassword('OtroPass', salt, legacyHex)).toBe(false);
  });

  it('bloquea el autosellado de contraseña en cuentas regulares sin credenciales inicializadas (CWE-287)', async () => {
    await AuthService.getUsuarios();
    const raw = JSON.parse(localStorage.getItem('slep_usuarios_sistema_v2') || '[]');
    raw.push({
      id: 'user-sin-hash',
      username: 'usuario.sinhash',
      email: 'usuario.sinhash@eduvallediguillin.gob.cl',
      nombreCompleto: 'Usuario Sin Hash',
      role: 'director_establecimiento',
      rbdAsignado: '3656',
      passwordHash: '',
      salt: '',
      activo: true
    });
    localStorage.setItem('slep_usuarios_sistema_v2', JSON.stringify(raw));

    await expect(
      AuthService.login('usuario.sinhash@eduvallediguillin.gob.cl', 'CualquierClave6')
    ).rejects.toThrow(/no tiene credenciales inicializadas/i);
  });

  it('aísla geminiApiKey personal en sesión y limpia caché al cerrar sesión', async () => {
    await AuthService.guardarUsuario({
      id: 'user-api-test',
      username: 'asesor.apikey',
      email: 'asesor.apikey@slepvallediguillin.cl',
      nombreCompleto: 'Asesor API Key',
      role: 'asesor_uatp',
      cargo: 'Asesor UATP',
      activo: true
    }, 'PassAsesor_99');

    const session = await AuthService.login('asesor.apikey', 'PassAsesor_99');
    expect(session.usuario.id).toBe('user-api-test');

    await AuthService.guardarApiKeyUsuario('user-api-test', 'AIza-personal-key-123');
    expect(obtenerGeminiApiKeyActiva()).toBe('AIza-personal-key-123');

    // Al cerrar sesión, la key personal no debe quedar activa para el siguiente usuario
    AuthService.logout();
    expect(localStorage.getItem('gemini_api_key')).toBeNull();
    expect(AuthService.getSessionActual()).toBeNull();
  });

  it('no borra datos 2027 en SQLite cuando falta o se limpia el flag de localStorage', async () => {
    const db = await getDb();
    expect(hasAppliedMigration(db, 'clean_init_2027_v1')).toBe(true);

    db.run(`
      INSERT OR REPLACE INTO establecimientos (id, rbd, nombre, comuna, regimen, porcentaje_prioritarios)
      VALUES ('est-test-safe', '99999', 'Escuela Segura Test', 'Chillán', 'JEC', 80);
    `);
    db.run(`
      INSERT OR REPLACE INTO docentes (id, rbd, run, nombres, apellidos, calidad_juridica, estamento, horas_contrato, periodo)
      VALUES ('doc-safe-2027', '99999', '11.111.111-1', 'Docente', 'Protegido', 'TITULAR', 'DOCENTE_AULA', 44, 2027);
    `);

    // Simular borrado de localStorage por parte del navegador
    localStorage.removeItem('slep_dotacion_2027_clean_v1');

    const dbAfter = await getDb();
    const countRes = dbAfter.exec("SELECT COUNT(*) FROM docentes WHERE id = 'doc-safe-2027';");
    expect(Number(countRes[0]?.values[0]?.[0] || 0)).toBe(1);
  });

  it('acepta gemini-flash-lite-latest y exige Bearer token en /api/gemini cuando Supabase está configurado', async () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevUrl = process.env.VITE_SUPABASE_URL;
    const prevAnon = process.env.VITE_SUPABASE_ANON_KEY;
    const origFetch = globalThis.fetch;

    try {
      process.env.GEMINI_API_KEY = 'server-secret-key';
      process.env.VITE_SUPABASE_URL = 'https://example.supabase.co';
      process.env.VITE_SUPABASE_ANON_KEY = 'anon-key';

      const makeRes = () => {
        const res: any = { statusCode: 200, body: null, headers: {} as Record<string, string> };
        res.status = (code: number) => { res.statusCode = code; return res; };
        res.setHeader = (k: string, v: string) => { res.headers[k] = v; };
        res.json = (obj: any) => { res.body = obj; return res; };
        res.send = (txt: string) => { res.body = txt; return res; };
        return res;
      };

      // Sin Authorization Bearer -> debe rechazar con 401
      const resNoAuth = makeRes();
      await geminiProxyHandler(
        { method: 'POST', headers: {}, body: { model: 'gemini-flash-lite-latest', payload: { contents: [] } } },
        resNoAuth
      );
      expect(resNoAuth.statusCode).toBe(401);

      // Con Bearer válido -> valida auth/v1/user y reenvía exactamente al modelo gemini-flash-lite-latest
      const fetchMock = vi.fn(async (url: string) => {
        if (String(url).includes('/auth/v1/user')) {
          return new Response(JSON.stringify({ id: 'uid-1' }), { status: 200 });
        }
        return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }), { status: 200 });
      });
      globalThis.fetch = fetchMock as any;

      const resOk = makeRes();
      await geminiProxyHandler(
        {
          method: 'POST',
          headers: { authorization: 'Bearer valid-jwt' },
          body: { model: 'gemini-flash-lite-latest', payload: { contents: [] } }
        },
        resOk
      );
      expect(resOk.statusCode).toBe(200);
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/models/gemini-flash-lite-latest:generateContent'),
        expect.any(Object)
      );
    } finally {
      globalThis.fetch = origFetch;
      if (prevGemini === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = prevGemini;
      if (prevUrl === undefined) delete process.env.VITE_SUPABASE_URL; else process.env.VITE_SUPABASE_URL = prevUrl;
      if (prevAnon === undefined) delete process.env.VITE_SUPABASE_ANON_KEY; else process.env.VITE_SUPABASE_ANON_KEY = prevAnon;
    }
  });
});
