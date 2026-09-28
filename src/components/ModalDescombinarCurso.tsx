import React, { useState, useMemo } from 'react';
import { GitFork, X, AlertTriangle, CheckCircle2, School, ArrowRight, Layers } from 'lucide-react';
import { CursoSae } from '../types';
import { descombinarCursoExistente, extraerGradosDeCurso } from '../services/combinacionCursosService';

interface ModalDescombinarCursoProps {
  isOpen: boolean;
  onClose: () => void;
  curso: CursoSae | null;
  onConfirmarDescombinacion: (cursoCombinadoId: string, cursosSeparados: CursoSae[]) => Promise<void> | void;
}

export const ModalDescombinarCurso: React.FC<ModalDescombinarCursoProps> = ({
  isOpen,
  onClose,
  curso,
  onConfirmarDescombinacion
}) => {
  const [procesando, setProcesando] = useState(false);

  const cursosSeparados = useMemo(() => {
    if (!curso) return [];
    return descombinarCursoExistente(curso);
  }, [curso]);

  const grados = useMemo(() => {
    if (!curso) return [];
    return extraerGradosDeCurso(curso);
  }, [curso]);

  if (!isOpen || !curso) return null;

  const handleEjecutar = async () => {
    try {
      setProcesando(true);
      await onConfirmarDescombinacion(curso.id, cursosSeparados);
      onClose();
    } catch (err: any) {
      alert(`Error al descombinar el curso: ${err?.message || err}`);
    } finally {
      setProcesando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[90vh] border border-slate-200 my-auto flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Cabecera */}
        <div className="p-5 pb-4 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">
                Descombinar Curso
              </h3>
              <p className="text-xs text-slate-500">
                Separa este curso combinado/multigrado en cursos regulares independientes por grado.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs">
          {/* Advertencia */}
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-950 space-y-1">
              <h4 className="font-bold text-amber-900">
                ¿Confirmas que deseas descombinar {curso.nivel} {curso.letra}?
              </h4>
              <p>
                El curso combinado actual se eliminará y se restablecerán {cursosSeparados.length} cursos regulares independientes para cada grado con su plan de estudio individual.
              </p>
            </div>
          </div>

          {/* Comparativa: Curso Actual vs Cursos Resultantes */}
          <div className="space-y-3">
            {/* Curso Actual */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs">
              <span className="text-[10px] uppercase font-bold text-slate-500 block mb-1">
                Curso Combinado Actual (Se eliminará):
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{curso.nivel} {curso.letra}</div>
                  <div className="text-[11px] text-slate-500">
                    Jornada: {curso.regimen} • Proporción: {curso.regimenProporcion === '60_40' ? '60/40' : '65/35'}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-slate-900">{curso.matriculaProyectada} estudiantes</div>
                  <div className="text-[11px] text-purple-700 font-bold">{curso.alumnosNeet || 0}T • {curso.alumnosNeep || 0}P PIE</div>
                </div>
              </div>
            </div>

            {/* Cursos Nuevos que se crearán */}
            <div className="bg-purple-50/50 p-3.5 rounded-xl border border-purple-100 text-xs space-y-2">
              <span className="text-[10px] uppercase font-bold text-purple-900 block">
                Nuevos Cursos Individuales que se Crearán ({cursosSeparados.length}):
              </span>
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {cursosSeparados.map((cs, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 bg-white rounded-lg border border-purple-200 text-[11px]"
                  >
                    <div className="flex items-center gap-2">
                      <School className="w-3.5 h-3.5 text-purple-600" />
                      <span className="font-bold text-slate-800">{cs.nivel} {cs.letra}</span>
                      <span className="text-[10px] text-slate-500">({cs.regimen})</span>
                    </div>
                    <div className="text-right font-semibold text-slate-700">
                      <span>{cs.matriculaProyectada} est.</span>
                      <span className="text-[10px] text-purple-600 ml-2">({cs.alumnosNeet}T / {cs.alumnosNeep}P)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Botones de Acción */}
        <div className="shrink-0 p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={procesando}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEjecutar}
            disabled={procesando}
            className="flex items-center gap-1.5 px-5 py-2 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-xl shadow-md transition-all cursor-pointer"
          >
            {procesando ? (
              <span>Descombinando curso...</span>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar y Descombinar</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
