import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, X, AlertTriangle } from 'lucide-react';
import { Establecimiento } from '../types';

interface ConfirmarVaciarDotacionModalProps {
  isOpen: boolean;
  onClose: () => void;
  colegio: Establecimiento;
  periodoActivo: number;
  cursosCount: number;
  docentesCount: number;
  asignacionesCount: number;
  onConfirmarVaciar: () => Promise<void>;
}

export const ConfirmarVaciarDotacionModal: React.FC<ConfirmarVaciarDotacionModalProps> = ({
  isOpen,
  onClose,
  colegio,
  periodoActivo,
  cursosCount,
  docentesCount,
  asignacionesCount,
  onConfirmarVaciar
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [ejecutando, setEjecutando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codigoRequerido = colegio.rbd.trim();

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(null);
      setEjecutando(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const esValido = confirmText.trim().toLowerCase() === codigoRequerido.toLowerCase() ||
                  confirmText.trim().toUpperCase() === 'VACIAR';

  const handleConfirmar = async () => {
    if (!esValido || ejecutando) return;
    setEjecutando(true);
    setError(null);
    try {
      await onConfirmarVaciar();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al vaciar la dotación.');
      setEjecutando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera de Alerta Destructiva */}
        <div className="bg-red-600 px-6 py-4 flex items-center justify-between text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-700 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold">Zona de Protección de Datos</h3>
              <p className="text-xs text-red-100">Acción destructiva e irreversible</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={ejecutando}
            className="p-1.5 rounded-lg hover:bg-red-700 text-red-200 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-800 space-y-2">
            <div className="flex items-center gap-2 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>¿Estás seguro de que deseas vaciar la dotación de este establecimiento?</span>
            </div>
            <p>
              Estás a punto de eliminar toda la dotación del colegio <strong className="underline">{colegio.nombre}</strong> (RBD {colegio.rbd}) para el <strong>Periodo {periodoActivo}</strong>.
            </p>
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-red-200/80 text-center font-mono">
              <div className="bg-white/80 p-2 rounded border border-red-200">
                <span className="block text-base font-black text-red-700">{cursosCount}</span>
                <span className="text-[10px] text-slate-600">Cursos</span>
              </div>
              <div className="bg-white/80 p-2 rounded border border-red-200">
                <span className="block text-base font-black text-red-700">{docentesCount}</span>
                <span className="text-[10px] text-slate-600">Docentes</span>
              </div>
              <div className="bg-white/80 p-2 rounded border border-red-200">
                <span className="block text-base font-black text-red-700">{asignacionesCount}</span>
                <span className="text-[10px] text-slate-600">Asignaciones</span>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            ℹ️ <strong>Nota de Seguridad:</strong> El establecimiento escolar y su infraestructura física (salas) <strong>no se borrarán</strong> de la cartera territorial.
          </div>

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Campo de Doble Factor / Confirmación Escrita */}
          <div className="space-y-1.5 pt-1">
            <label className="block text-xs font-bold text-slate-700">
              Para desbloquear la eliminación, escribe el RBD <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{codigoRequerido}</span> o la palabra <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">VACIAR</span>:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={`Escribe ${codigoRequerido} o VACIAR`}
              disabled={ejecutando}
              className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none font-mono"
            />
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={ejecutando}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handleConfirmar}
            disabled={!esValido || ejecutando}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl shadow transition-all ${
              esValido && !ejecutando
                ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>{ejecutando ? 'Vaciando dotación...' : `Confirmar y Vaciar Dotación ${periodoActivo}`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
