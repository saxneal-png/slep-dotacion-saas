import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Lock, Eye, EyeOff, AlertCircle, Building2, CheckCircle2 } from 'lucide-react';
import { AuthService, hashPassword } from '../../services/authService';
import { AuthSession } from '../../types/authTypes';

interface PrimerAccesoModalProps {
  session: AuthSession;
  onSuccess: (sessionActualizada: AuthSession) => void;
}

export const PrimerAccesoModal: React.FC<PrimerAccesoModalProps> = ({ session, onSuccess }) => {
  const [actualPassword, setActualPassword] = useState('123456');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mostrarClaves, setMostrarClaves] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!actualPassword || !nuevaPassword || !confirmarPassword) {
      setError('Por favor complete todos los campos de contraseña.');
      return;
    }

    if (nuevaPassword.length < 6) {
      setError('La nueva contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (nuevaPassword.trim() === '123456' || nuevaPassword.trim() === '12346') {
      setError('Por seguridad institucional, la nueva contraseña no puede ser la clave provisoria (123456). Elija una contraseña personal segura.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    try {
      setCargando(true);
      // Validar contraseña actual con salt
      const usuarios = await AuthService.getUsuarios();
      const me = usuarios.find(u => u.id === session.usuario.id);
      if (!me) throw new Error('Usuario no encontrado en el sistema.');

      const hashActual = await hashPassword(actualPassword, me.salt);
      if (hashActual !== me.passwordHash) {
        throw new Error('La contraseña actual es incorrecta.');
      }

      // Cambiar contraseña y desactivar flag de primer acceso
      await AuthService.cambiarPassword(session.usuario.id, nuevaPassword);

      const sesionActualizada: AuthSession = {
        ...session,
        usuario: {
          ...session.usuario,
          debeCambiarPassword: false
        }
      };

      onSuccess(sesionActualizada);
    } catch (err: any) {
      setError(err?.message || 'Error al actualizar contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl">
        {/* Banner Superior Institucional */}
        <div className="p-6 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 text-white relative">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-sm shadow-inner text-white">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-orange-100 bg-white/20 px-2 py-0.5 rounded-full inline-block mb-1">
                Primer Acceso Institucional
              </span>
              <h2 className="text-lg font-black tracking-tight leading-tight">
                Cambio Obligatorio de Contraseña
              </h2>
              <p className="text-xs text-orange-100 mt-0.5">
                SLEP Valle Diguillín
              </p>
            </div>
          </div>
        </div>

        {/* Ficha Resumen del Director */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-950/60 text-orange-600 shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-bold text-slate-900 dark:text-white truncate">
              {session.usuario.nombreCompleto}
            </div>
            <div className="text-slate-500 text-[11px] truncate">
              {session.usuario.cargo || 'Director(a) de Establecimiento'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">
              {session.usuario.email || session.usuario.username}
            </div>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Por estrictas políticas de seguridad y resguardo de la información escolar del territorio, debes reemplazar la contraseña provisoria <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold font-mono text-orange-600">123456</code> por una clave personal antes de operar el sistema.
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 text-xs text-rose-700 dark:text-rose-300 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Contraseña Actual (Provisoria)
            </label>
            <div className="relative">
              <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type={mostrarClaves ? 'text' : 'password'}
                required
                value={actualPassword}
                onChange={e => setActualPassword(e.target.value)}
                placeholder="123456"
                className="w-full pl-9 pr-10 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono font-medium"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Nueva Contraseña Personal (Mín. 6 caracteres)
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type={mostrarClaves ? 'text' : 'password'}
                required
                value={nuevaPassword}
                onChange={e => setNuevaPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono font-medium"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <input
                type={mostrarClaves ? 'text' : 'password'}
                required
                value={confirmarPassword}
                onChange={e => setConfirmarPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-9 pr-10 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono font-medium"
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => setMostrarClaves(!mostrarClaves)}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium transition-colors"
            >
              {mostrarClaves ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{mostrarClaves ? 'Ocultar contraseñas' : 'Ver contraseñas'}</span>
            </button>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={cargando}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs rounded-xl shadow-lg shadow-orange-500/25 flex items-center justify-center gap-2 transition-all active:scale-[0.99] disabled:opacity-50"
            >
              {cargando ? (
                <span>Guardando nueva contraseña...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Establecer Contraseña y Continuar</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
