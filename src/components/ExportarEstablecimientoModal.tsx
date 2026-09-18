import React, { useState } from 'react';
import { X, FileDown, Building2, CheckCircle2, ShieldCheck, Layers, Users, BookOpen } from 'lucide-react';
import { Establecimiento, CursoSae, Docente, SalaInfraestructura, AsignacionHoraria } from '../types';
import { exportarPaqueteEstablecimiento } from '../database/repositories/exportImportEstablecimientoRepo';
import saveAs from 'file-saver';

interface ExportarEstablecimientoModalProps {
  isOpen: boolean;
  onClose: () => void;
  establecimiento: Establecimiento;
  periodo: number;
  cursos: CursoSae[];
  docentes: Docente[];
  salas: SalaInfraestructura[];
  asignaciones: AsignacionHoraria[];
}

export const ExportarEstablecimientoModal: React.FC<ExportarEstablecimientoModalProps> = ({
  isOpen,
  onClose,
  establecimiento,
  periodo,
  cursos,
  docentes,
  salas,
  asignaciones
}) => {
  const [exportando, setExportando] = useState(false);
  const [exito, setExito] = useState(false);

  if (!isOpen) return null;

  const handleDescargar = async () => {
    try {
      setExportando(true);
      const paquete = await exportarPaqueteEstablecimiento(establecimiento.rbd, periodo);
      const jsonStr = JSON.stringify(paquete, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const sanitizedName = establecimiento.nombre.replace(/[^a-zA-Z0-9_-]/g, '_');
      saveAs(blob, `Dotacion_${establecimiento.rbd}_${sanitizedName}_${periodo}.slep.json`);
      setExito(true);
      setTimeout(() => {
        setExito(false);
        onClose();
      }, 1500);
    } catch (err: any) {
      alert(`Error al exportar dotación del establecimiento: ${err?.message}`);
    } finally {
      setExportando(false);
    }
  };

  const totalHorasContrato = docentes.reduce((s, d) => s + (d.horasContrato || 0), 0);
  const totalHorasAsignadas = asignaciones.reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div 
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#002B49] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Exportar Dotación de Establecimiento</h3>
              <p className="text-xs text-slate-300">Generar paquete oficial (.slep.json) para intercambio o respaldo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
              <Building2 className="w-4 h-4 text-orange-600" />
              <span>{establecimiento.nombre}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 text-slate-700 font-mono">RBD: {establecimiento.rbd}</span>
            </div>
            <div className="text-xs text-slate-500 mt-1">
              Comuna: <strong>{establecimiento.comuna}</strong> • Régimen: <strong>{establecimiento.regimen}</strong> • Período: <strong>{periodo}</strong>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-700">
            Resumen de datos incluidos en el paquete:
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-center">
              <BookOpen className="w-4 h-4 text-blue-600 mx-auto mb-1" />
              <div className="text-base font-black text-blue-900">{cursos.length}</div>
              <div className="text-[10px] text-blue-700 font-medium">Cursos SAE</div>
            </div>
            <div className="p-3 bg-purple-50/70 border border-purple-100 rounded-xl text-center">
              <Users className="w-4 h-4 text-purple-600 mx-auto mb-1" />
              <div className="text-base font-black text-purple-900">{docentes.length}</div>
              <div className="text-[10px] text-purple-700 font-medium">Docentes</div>
            </div>
            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-center">
              <Layers className="w-4 h-4 text-emerald-600 mx-auto mb-1" />
              <div className="text-base font-black text-emerald-900">{asignaciones.length}</div>
              <div className="text-[10px] text-emerald-700 font-medium">Asignaciones</div>
            </div>
            <div className="p-3 bg-amber-50/70 border border-amber-100 rounded-xl text-center">
              <ShieldCheck className="w-4 h-4 text-amber-600 mx-auto mb-1" />
              <div className="text-base font-black text-amber-900">{salas.length}</div>
              <div className="text-[10px] text-amber-700 font-medium">Salas Físicas</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200 flex justify-between items-center">
            <span>Horas de Contrato Totales: <strong>{totalHorasContrato}h</strong></span>
            <span>Horas Aula Asignadas: <strong>{totalHorasAsignadas} HA</strong></span>
          </div>

          <div className="text-[11px] text-slate-400">
            ℹ️ Este archivo exportado puede ser importado en cualquier otra instalación o compartido con directores y asesores de la UATP.
          </div>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleDescargar}
            disabled={exportando || exito}
            className="flex items-center gap-2 px-5 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all"
          >
            {exito ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-white" />
                <span>¡Descargado con Éxito!</span>
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                <span>{exportando ? 'Generando paquete...' : 'Descargar Paquete (.slep.json)'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
