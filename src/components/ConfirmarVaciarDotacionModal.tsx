import React, { useState, useEffect } from 'react';
import { ShieldAlert, Trash2, X, AlertTriangle, ShieldCheck, Download, CheckCircle2 } from 'lucide-react';
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
  onExportarRespaldoPrevio?: () => Promise<void> | void;
}

export const ConfirmarVaciarDotacionModal: React.FC<ConfirmarVaciarDotacionModalProps> = ({
  isOpen,
  onClose,
  colegio,
  periodoActivo,
  cursosCount,
  docentesCount,
  asignacionesCount,
  onConfirmarVaciar,
  onExportarRespaldoPrevio
}) => {
  const [confirmText, setConfirmText] = useState('');
  const [ejecutando, setEjecutando] = useState(false);
  const [respaldando, setRespaldando] = useState(false);
  const [respaldadoExitoso, setRespaldadoExitoso] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const codigoRequerido = colegio.rbd.trim();

  useEffect(() => {
    if (isOpen) {
      setConfirmText('');
      setError(null);
      setEjecutando(false);
      setRespaldando(false);
      setRespaldadoExitoso(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const esValido = confirmText.trim().toLowerCase() === codigoRequerido.toLowerCase() ||
                  confirmText.trim().toUpperCase() === 'VACIAR';

  const handleExportarRespaldo = async () => {
    if (!onExportarRespaldoPrevio || respaldando) return;
    try {
      setRespaldando(true);
      await onExportarRespaldoPrevio();
      setRespaldadoExitoso(true);
    } catch (err: any) {
      setError(`Error al generar respaldo previo: ${err.message || err}`);
    } finally {
      setRespaldando(false);
    }
  };

  const handleConfirmar = async () => {
    if (!esValido || ejecutando) return;
    setEjecutando(true);
    setError(null);
    try {
      await onConfirmarVaciar();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al vaciar la dotación de este establecimiento.');
      setEjecutando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-red-200 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera de Alerta */}
        <div className="bg-gradient-to-r from-red-600 to-rose-700 px-6 py-4 flex items-center justify-between text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-xs flex items-center justify-center shrink-0 border border-white/20">
              <ShieldAlert className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Vaciar Dotación de Establecimiento</h3>
              <p className="text-[11px] text-red-100 font-medium">Afectación exclusiva a {colegio.nombre}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={ejecutando}
            className="p-1.5 rounded-lg hover:bg-white/10 text-red-100 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto">
          {/* Tarjeta de Establecimiento Objetivo */}
          <div className="bg-red-50/70 border border-red-200 rounded-xl p-4 text-xs text-red-950 space-y-2.5">
            <div className="flex items-center gap-2 font-bold text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>¿Confirmas vaciar la dotación de este colegio?</span>
            </div>

            <p className="leading-relaxed text-slate-700">
              Se eliminarán todos los cursos, docentes y asignaciones de <strong className="text-red-900 font-bold">{colegio.nombre}</strong> (RBD: <span className="font-mono font-bold text-red-800">{colegio.rbd}</span>) correspondientes al <strong>Periodo {periodoActivo}</strong>.
            </p>

            {/* Métricas a eliminar */}
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              <div className="bg-white p-2.5 rounded-lg border border-red-200 text-center shadow-2xs">
                <span className="block text-lg font-black text-red-700">{cursosCount}</span>
                <span className="text-[10px] font-sans font-semibold text-slate-500">Cursos</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-red-200 text-center shadow-2xs">
                <span className="block text-lg font-black text-red-700">{docentesCount}</span>
                <span className="text-[10px] font-sans font-semibold text-slate-500">Docentes</span>
              </div>
              <div className="bg-white p-2.5 rounded-lg border border-red-200 text-center shadow-2xs">
                <span className="block text-lg font-black text-red-700">{asignacionesCount}</span>
                <span className="text-[10px] font-sans font-semibold text-slate-500">Asignaciones</span>
              </div>
            </div>
          </div>

          {/* Garantía de Aislamiento de Red */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-start gap-2.5 shadow-2xs">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <div className="font-bold text-emerald-950">Garantía de Aislamiento Territorial</div>
              <div className="text-[11px] text-emerald-800 leading-relaxed">
                Esta acción es <strong>100% local</strong>. Las demás escuelas del SLEP Valle Diguillín y las salas físicas de este colegio permanecerán <strong>intactas</strong>.
              </div>
            </div>
          </div>

          {/* Botón de Respaldo Previo Recomendado */}
          {onExportarRespaldoPrevio && (
            <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-xs flex items-center justify-between gap-3 shadow-2xs">
              <div className="space-y-0.5">
                <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                  <span>Recomendación de Seguridad</span>
                </div>
                <div className="text-[10px] text-indigo-700">
                  Descarga una copia de seguridad (.slep) de esta escuela antes de vaciar.
                </div>
              </div>
              <button
                type="button"
                onClick={handleExportarRespaldo}
                disabled={respaldando || ejecutando}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shrink-0 shadow-2xs ${
                  respaldadoExitoso
                    ? 'bg-emerald-600 text-white cursor-default'
                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                }`}
              >
                {respaldadoExitoso ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Respaldo Listo</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>{respaldando ? 'Guardando...' : 'Respaldar .slep'}</span>
                  </>
                )}
              </button>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-100 border border-red-300 text-red-800 rounded-lg text-xs font-semibold">
              {error}
            </div>
          )}

          {/* Campo de Doble Factor / Confirmación Escrita */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">
                Para desbloquear, escribe el RBD <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">{codigoRequerido}</span> o la palabra <span className="font-mono text-red-700 bg-red-50 px-1.5 py-0.5 rounded border border-red-200">VACIAR</span>:
              </label>
            </div>
            <div className="relative">
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={`Escribe ${codigoRequerido} o VACIAR`}
                disabled={ejecutando}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none font-mono font-bold"
                autoFocus
              />
              {!esValido && confirmText.length > 0 && (
                <span className="absolute right-3 top-2.5 text-[11px] text-amber-600 font-medium font-sans">
                  Esperando RBD o VACIAR...
                </span>
              )}
              {esValido && (
                <span className="absolute right-3 top-2.5 text-[11px] text-emerald-600 font-bold font-sans flex items-center gap-1">
                  ✓ Desbloqueado
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              setConfirmText(codigoRequerido);
            }}
            disabled={ejecutando || esValido}
            className={`text-[11px] font-semibold transition-colors ${
              esValido ? 'text-slate-400 opacity-50 cursor-default' : 'text-slate-500 hover:text-slate-800 underline'
            }`}
          >
            Auto-completar RBD ({codigoRequerido})
          </button>

          <div className="flex items-center gap-2.5">
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
                  ? 'bg-red-600 hover:bg-red-700 text-white cursor-pointer hover:shadow-md'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Trash2 className="w-4 h-4" />
              <span>{ejecutando ? 'Vaciando dotación...' : `Confirmar y Vaciar ${colegio.nombre}`}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
