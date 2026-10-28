import React, { useState } from 'react';
import { KeyRound, Check, AlertCircle, X, Shield, Lock, Eye, EyeOff } from 'lucide-react';
import { AuthService, hashPassword } from '../../services/authService';
import { AuthSession } from '../../types/authTypes';

interface CambiarPasswordModalProps {
  session: AuthSession;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (mensaje: string) => void;
}

export const CambiarPasswordModal: React.FC<CambiarPasswordModalProps> = ({
  session,
  isOpen,
  onClose,
  onSuccess
}) => {
  const [actualPassword, setActualPassword] = useState('');
  const [nuevaPassword, setNuevaPassword] = useState('');
  const [confirmarPassword, setConfirmarPassword] = useState('');
  const [mostrarClaves, setMostrarClaves] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!actualPassword || !nuevaPassword || !confirmarPassword) {
      setError('Por favor complete todos los campos.');
      return;
    }

    if (nuevaPassword.length < 4) {
      setError('La nueva contraseña debe tener al menos 4 caracteres.');
      return;
    }

    if (nuevaPassword !== confirmarPassword) {
      setError('La nueva contraseña y su confirmación no coinciden.');
      return;
    }

    try {
      setCargando(true);
      // Validar contraseña actual
      const usuarios = await AuthService.getUsuarios();
      const me = usuarios.find(u => u.id === session.usuario.id);
      if (!me) throw new Error('Usuario no encontrado en el sistema.');

      const hashActual = await hashPassword(actualPassword, me.salt);
      if (hashActual !== me.passwordHash) {
        throw new Error('La contraseña actual es incorrecta.');
      }

      // Cambiar contraseña
      await AuthService.cambiarPassword(session.usuario.id, nuevaPassword);
      onSuccess('¡Contraseña actualizada exitosamente!');
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al actualizar contraseña.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between p-5 bg-slate-800/80 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-600/30 rounded-xl border border-blue-500/40 text-blue-400">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cambiar mi Contraseña</h3>
              <p className="text-[11px] text-slate-400">Usuario: {session.usuario.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3.5">
          {error && (
            <div className="p-3 text-xs text-red-300 rounded-xl bg-red-950/60 border border-red-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Contraseña Actual
            </label>
            <div className="relative">
              <input
                type={mostrarClaves ? 'text' : 'password'}
                required
                value={actualPassword}
                onChange={e => setActualPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-3 pr-10 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setMostrarClaves(!mostrarClaves)}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200"
              >
                {mostrarClaves ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Nueva Contraseña
            </label>
            <input
              type={mostrarClaves ? 'text' : 'password'}
              required
              value={nuevaPassword}
              onChange={e => setNuevaPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">
              Confirmar Nueva Contraseña
            </label>
            <input
              type={mostrarClaves ? 'text' : 'password'}
              required
              value={confirmarPassword}
              onChange={e => setConfirmarPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-300 hover:text-white"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={cargando}
              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-md transition flex items-center gap-1.5"
            >
              {cargando ? 'Guardando...' : 'Actualizar Contraseña'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
