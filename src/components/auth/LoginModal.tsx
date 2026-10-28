import React, { useState } from 'react';
import { ShieldCheck, Lock, User, KeyRound, AlertCircle, Sparkles, Building2, Eye, EyeOff } from 'lucide-react';
import { AuthService, USUARIOS_SEMILLA_BASE } from '../../services/authService';
import { AuthSession, UserRole } from '../../types/authTypes';

interface LoginModalProps {
  onLoginSuccess: (session: AuthSession) => void;
  onAbrirOlvidoPassword?: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ onLoginSuccess, onAbrirOlvidoPassword }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!username.trim() || !password) {
      setError('Por favor complete usuario y contraseña.');
      return;
    }

    try {
      setCargando(true);
      const session = await AuthService.login(username, password);
      onLoginSuccess(session);
    } catch (err: any) {
      setError(err?.message || 'Error al autenticar.');
    } finally {
      setCargando(false);
    }
  };

  const handleSeleccionarDemo = (u: typeof USUARIOS_SEMILLA_BASE[number]) => {
    setUsername(u.username);
    setPassword(u.defaultPasswordPlain);
    setError(null);
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return { label: 'Admin SLEP', color: 'bg-red-500/20 text-red-300 border-red-500/40' };
      case 'asesor':
        return { label: 'Asesor UATP', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' };
      case 'director_colegio':
        return { label: 'Director Colegio', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
      case 'auditor':
        return { label: 'Auditor DEP', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl">
        {/* Banner Superior Decorativo */}
        <div className="relative p-6 pb-4 bg-gradient-to-r from-blue-900/40 via-indigo-900/30 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-600/30 rounded-xl border border-blue-500/40 text-blue-400">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-blue-400">
                Seguridad & Control de Acceso
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                SLEP Valle Diguillín
              </h2>
              <p className="text-xs text-slate-400">
                Sistema Consolidador de Dotación & Auditoría
              </p>
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-red-300 rounded-lg bg-red-950/50 border border-red-800/60 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Usuario Institucional
            </label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="admin, asesor, director..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type={mostrarPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2 text-sm bg-slate-950/80 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition"
              >
                {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {onAbrirOlvidoPassword && (
              <div className="flex justify-end mt-1.5">
                <button
                  type="button"
                  onClick={onAbrirOlvidoPassword}
                  className="text-xs text-amber-400 hover:text-amber-300 transition hover:underline"
                >
                  ¿Ha olvidado su contraseña?
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={cargando}
            className="w-full py-2.5 px-4 mt-2 font-medium text-sm text-white bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 rounded-lg shadow-lg shadow-blue-600/30 transition flex items-center justify-center gap-2"
          >
            {cargando ? (
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                Ingresar a la Plataforma
              </>
            )}
          </button>
        </form>

        {/* Selector Rápido de Perfiles de Prueba */}
        <div className="p-5 pt-3 bg-slate-950/90 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 mb-2.5 text-[11px] font-semibold text-slate-400">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Acceso rápido por Rol (Demostración Oficial):</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {USUARIOS_SEMILLA_BASE.map(u => {
              const badge = getRoleBadge(u.role);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSeleccionarDemo(u)}
                  className="flex flex-col items-start p-2 text-left bg-slate-900 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700 rounded-lg transition group"
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs font-semibold text-slate-200 group-hover:text-blue-300">
                      {u.username}
                    </span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded border font-medium ${badge.color}`}>
                      {badge.label}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">
                    Clave: {u.defaultPasswordPlain}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
