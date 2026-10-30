import React, { useState } from 'react';
import { X, FileDown, Building2, CheckCircle2, ShieldCheck, Layers, Users, BookOpen, GraduationCap } from 'lucide-react';
import { Establecimiento, CursoSae, Docente, SalaInfraestructura, AsignacionHoraria, AsistenteEducacion } from '../types';
import { exportarPaqueteEstablecimiento } from '../database/repositories/exportImportEstablecimientoRepo';
import { guardarArchivoNativoOEnNavegador } from '../services/excelReportService';
import saveAs from 'file-saver';

interface ExportarEstablecimientoModalProps {
  isOpen: boolean;
  onClose: () => void;
  establecimiento: Establecimiento;
  periodo: number;
  cursos: CursoSae[];
  docentes: Docente[];
  asistentes?: AsistenteEducacion[];
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
  asistentes = [],
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
      const sanitizedName = establecimiento.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
      const filename = `Dotacion_${sanitizedName}_RBD${establecimiento.rbd}_${periodo}.slep`;

      const guardado = await guardarArchivoNativoOEnNavegador(
        jsonStr,
        filename,
        'application/json;charset=utf-8',
        [
          { name: 'Fichas de Dotación SLEP (*.slep)', extensions: ['slep', 'json', 'slep.json'] },
          { name: 'Archivos JSON (*.json)', extensions: ['json'] }
        ]
      );

      if (!guardado) {
        // Fallback a saveAs en caso de navegador tradicional sin File System Access API
        const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
        saveAs(blob, filename);
      }

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
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#002B49] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <FileDown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Exportar Ficha de Dotación (.slep)</h3>
              <p className="text-xs text-slate-300">Generar archivo portable oficial (.slep) para intercambio o respaldo</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-xs">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100 text-sm">
              <Building2 className="w-4 h-4 text-orange-600" />
              <span>{establecimiento.nombre}</span>
              <span className="text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-mono">
                RBD: {establecimiento.rbd}
              </span>
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Comuna: <strong>{establecimiento.comuna}</strong> • Régimen: <strong>{establecimiento.regimen}</strong> • Período: <strong>{periodo}</strong>
            </div>
          </div>

          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Resumen de datos que se incluirán en el archivo .slep:
          </div>

          <div className="grid grid-cols-5 gap-2 text-center">
            <div className="p-2.5 bg-blue-50/70 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/60 rounded-xl">
              <BookOpen className="w-4 h-4 text-blue-600 dark:text-blue-400 mx-auto mb-1" />
              <div className="text-base font-black text-blue-900 dark:text-blue-200">{cursos.length}</div>
              <div className="text-[10px] text-blue-700 dark:text-blue-300 font-medium">Cursos</div>
            </div>
            <div className="p-2.5 bg-purple-50/70 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/60 rounded-xl">
              <Users className="w-4 h-4 text-purple-600 dark:text-purple-400 mx-auto mb-1" />
              <div className="text-base font-black text-purple-900 dark:text-purple-200">{docentes.length}</div>
              <div className="text-[10px] text-purple-700 dark:text-purple-300 font-medium">Docentes</div>
            </div>
            <div className="p-2.5 bg-amber-50/70 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/60 rounded-xl">
              <GraduationCap className="w-4 h-4 text-amber-600 dark:text-amber-400 mx-auto mb-1" />
              <div className="text-base font-black text-amber-900 dark:text-amber-200">{asistentes.length}</div>
              <div className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">Asistentes</div>
            </div>
            <div className="p-2.5 bg-emerald-50/70 dark:bg-emerald-950/40 border border-emerald-100 dark:border-emerald-900/60 rounded-xl">
              <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400 mx-auto mb-1" />
              <div className="text-base font-black text-emerald-900 dark:text-emerald-200">{asignaciones.length}</div>
              <div className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">Asignaciones</div>
            </div>
            <div className="p-2.5 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-100 dark:border-indigo-900/60 rounded-xl">
              <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mx-auto mb-1" />
              <div className="text-base font-black text-indigo-900 dark:text-indigo-200">{salas.length}</div>
              <div className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">Salas</div>
            </div>
          </div>

          <div className="text-[11px] text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-lg border border-slate-200 dark:border-slate-700 flex justify-between items-center">
            <span>Horas Contrato Docentes: <strong>{totalHorasContrato}h</strong></span>
            <span>Horas Aula Asignadas: <strong>{totalHorasAsignadas} HA</strong></span>
          </div>

          <div className="text-[11px] text-slate-400 dark:text-slate-500">
            ℹ️ Este archivo <strong>.slep</strong> es portable y puede ser importado en cualquier otra instalación o compartido con directores y asesores del SLEP.
          </div>
        </div>

        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
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
                <span>{exportando ? 'Generando archivo...' : 'Descargar Ficha (.slep)'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
