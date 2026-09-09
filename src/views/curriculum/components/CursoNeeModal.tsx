import React from 'react';
import { X, ShieldCheck } from 'lucide-react';

interface CursoNeeModalProps {
  isOpen: boolean;
  onClose: () => void;
  cursoNivel: string;
  cursoLetra: string;
  editNeet: number;
  setEditNeet: (n: number) => void;
  editNeep: number;
  setEditNeep: (n: number) => void;
  onGuardar: () => void;
}

export const CursoNeeModal: React.FC<CursoNeeModalProps> = ({
  isOpen,
  onClose,
  cursoNivel,
  cursoLetra,
  editNeet,
  setEditNeet,
  editNeep,
  setEditNeep,
  onGuardar
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            Cupos PIE ({cursoNivel} {cursoLetra})
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alumnos NEET (Transitorios - Máx. 5 Dec. 170)
            </label>
            <input
              type="number"
              min={0}
              max={15}
              value={editNeet}
              onChange={e => setEditNeet(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Alumnos NEEP (Permanentes - Máx. 2 Dec. 170)
            </label>
            <input
              type="number"
              min={0}
              max={10}
              value={editNeep}
              onChange={e => setEditNeep(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800"
            />
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg text-emerald-900">
            <p className="font-bold mb-1">Cálculo Automático de Demanda:</p>
            <p>• {editNeet > 0 ? '10 hrs cronológicas docentes (NEET)' : '0 hrs NEET'}</p>
            <p>• {editNeep > 0 ? '3 hrs adicionales (NEEP)' : '0 hrs NEEP'}</p>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onGuardar}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm"
            >
              Guardar Cupos PIE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
