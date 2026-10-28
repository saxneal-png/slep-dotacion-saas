import React, { useState } from 'react';
import { KeyRound, Mail, ArrowLeft, CheckCircle2, AlertCircle, ShieldAlert, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthService } from '../../services/authService';

interface OlvidoPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (mensaje: string) => void;
}

export const OlvidoPasswordModal: React.FC<OlvidoPasswordModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const [email, setEmail] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !nuevaPassword || !confirmarPassword) {
      setError('Por favor complete todos los campos.');
      return;
    }

    if (nuevaPassword.length < 4) {
      setError('La nueva contraseña debe tener un mínimo de 4 caracteres.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    try {
      setCargando(true);
      const nombreUsuario = await AuthService.restablecerPasswordPorEmail(email, nuevaPassword);
      onSuccess(`Contraseña restablecida exitosamente para ${nombreUsuario}. Ya puede iniciar sesión.`);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al restablecer la contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md">
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 shadow-2xl">
        <div className="p-6 pb-4 bg-gradient-to-r from-amber-900/30 via-slate-900 to-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-600/30 rounded-xl border border-amber-500/40 text-amber-400">
              <KeyRound className="w-7 h-7" />
            </div>
            <div>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-amber-400">
                Recuperación de Acceso
              </span>
              <h2 className="text-xl font-bold text-white tracking-tight">
                ¿Olvidó su contraseña?
              </h2>
              <p className="text-xs text-slate-400">
                Ingrese su correo institucional para definir una nueva clave
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2.5 text-xs text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Correo Electrónico Institucional
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="ej: asesor.uatp@slepvallediguillin.cl"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                required
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                value={nuevaPassword}
                onChange={e => setNuevaPassword(e.target.value)}
                placeholder="Mínimo 4 caracteres"
                className="w-full pl-9 pr-10 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 transition"
              >
                {mostrarPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <input
                type={mostrarPassword ? 'text' : 'password'}
                value={confirmarPassword}
                onChange={e => setConfirmarPassword(e.target.value)}
                placeholder="Repita la nueva contraseña"
                className="w-full pl-9 pr-3 py-2 text-sm bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={cargando}
              className="w-1/2 py-2 px-3 text-sm font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Volver al Login
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="w-1/2 py-2 px-3 text-sm font-medium text-white bg-amber-600 hover:bg-amber-500 active:bg-amber-700 disabled:opacity-50 rounded-lg transition flex items-center justify-center gap-1.5 shadow-lg shadow-amber-600/30"
            >
              {cargando ? (
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Restablecer
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
