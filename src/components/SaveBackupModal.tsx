import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Upload, 
  Database, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileSpreadsheet, 
  X,
  HardDrive,
  FileCode,
  Trash2,
  ShieldAlert,
  RotateCcw
} from 'lucide-react';
import type { Establecimiento, CursoSae, SalaInfraestructura, Docente, AsignacionHoraria } from '../types';
import { subscribePersist, getUltimaHoraGuardado } from '../database/db';

export interface SaveBackupModalProps {
  isOpen: boolean;
  onClose: () => void;
  ultimaHoraGuardado?: string;
  estadoGuardado?: 'saved' | 'error';
  errorGuardado?: string;
  colegios: Establecimiento[];
  colegioActivo?: Establecimiento | null;
  periodoActivo?: number;
  docentes: Docente[];
  cursos: CursoSae[];
  salas: SalaInfraestructura[];
  asignaciones: AsignacionHoraria[];
  onExportarSqlite: () => void;
  onImportarSqlite: (file: File) => Promise<void>;
  onExportarCarteraSlep: () => void;
  onImportarCarteraSlep: (file: File) => Promise<void>;
  onBorrarDotacionPeriodo?: (periodo: number, rbd?: string) => Promise<void>;
  onReiniciarBaseDatos?: () => Promise<void>;
}

export const SaveBackupModal: React.FC<SaveBackupModalProps> = ({
  isOpen,
  onClose,
  ultimaHoraGuardado: propUltimaHora,
  estadoGuardado: propEstado,
  errorGuardado: propError,
  colegios,
  colegioActivo,
  periodoActivo = 2026,
  docentes,
  cursos,
  salas,
  asignaciones,
  onExportarSqlite,
  onImportarSqlite,
  onExportarCarteraSlep,
  onImportarCarteraSlep,
  onBorrarDotacionPeriodo,
  onReiniciarBaseDatos
}) => {
  const [isImporting, setIsImporting] = useState(false);
  const [localEstado, setLocalEstado] = useState<'saved' | 'error'>(propEstado || 'saved');
  const [localHora, setLocalHora] = useState<string>(propUltimaHora || getUltimaHoraGuardado());
  const [localError, setLocalError] = useState<string | undefined>(propError);

  useEffect(() => {
    if (!isOpen) return;
    const unsub = subscribePersist((status, time, err) => {
      setLocalEstado(status);
      setLocalHora(time);
      if (err) setLocalError(err);
    });
    return unsub;
  }, [isOpen]);

  const estadoGuardado = propEstado || localEstado;
  const ultimaHoraGuardado = propUltimaHora || localHora;
  const errorGuardado = propError || localError;

  if (!isOpen) return null;

  const handleFileSqlite = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('¿Está seguro de restaurar una base de datos SQLite? Esto reemplazará toda la información actual.')) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      await onImportarSqlite(file);
      onClose();
    } catch (err: any) {
      alert(`Error al importar SQLite: ${err.message || err}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  const handleFileSlep = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm('¿Desea incorporar la cartera territorial desde este archivo?')) {
      e.target.value = '';
      return;
    }

    setIsImporting(true);
    try {
      await onImportarCarteraSlep(file);
      onClose();
    } catch (err: any) {
      alert(`Error al importar cartera: ${err.message || err}`);
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="w-full max-w-xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Centro de Guardado y Respaldos</h2>
              <p className="text-xs text-slate-500">Gestión de persistencia SQLite y archivos de respaldo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-200/80 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
          {/* Status persistencia */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/80">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <HardDrive className={`w-5 h-5 mt-0.5 shrink-0 ${estadoGuardado === 'saved' ? 'text-emerald-600' : 'text-red-600'}`} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-800">Persistencia Activa (SQLite)</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      estadoGuardado === 'saved' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {estadoGuardado === 'saved' ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" /> Conectado & Seguro
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3" /> Error de sincronización
                        </>
                      )}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Cada ajuste curricular, docente o infraestructura se resguarda automáticamente en el motor SQLite local.
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-600 mt-2 font-mono">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Último guardado automático: <strong>{ultimaHoraGuardado || 'Recién sincronizado'}</strong></span>
                  </div>
                  {errorGuardado && (
                    <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                      {errorGuardado}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Estadísticas de Datos */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-base font-bold text-slate-800">{colegios.length}</div>
              <div className="text-[11px] text-slate-500">Escuelas</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-base font-bold text-slate-800">{cursos.length}</div>
              <div className="text-[11px] text-slate-500">Cursos</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-base font-bold text-slate-800">{docentes.length}</div>
              <div className="text-[11px] text-slate-500">Docentes</div>
            </div>
            <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
              <div className="text-base font-bold text-slate-800">{salas.length}</div>
              <div className="text-[11px] text-slate-500">Salas/Espacios</div>
            </div>
          </div>

          {/* Respaldos Externos */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Copias de Seguridad Fuera del Equipo
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Exportar SQLite Binario */}
              <button
                onClick={onExportarSqlite}
                className="flex items-start gap-3 p-3 text-left rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 transition-all group"
              >
                <div className="p-2 bg-blue-100 text-blue-700 rounded-lg group-hover:scale-105 transition-transform">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Descargar Base (.sqlite)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Respaldo binario completo y portable de toda la base.
                  </div>
                </div>
              </button>

              {/* Exportar Cartera .slep */}
              <button
                onClick={onExportarCarteraSlep}
                className="flex items-start gap-3 p-3 text-left rounded-xl border border-slate-200 hover:border-orange-300 hover:bg-orange-50/40 transition-all group"
              >
                <div className="p-2 bg-orange-100 text-orange-700 rounded-lg group-hover:scale-105 transition-transform">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Exportar Cartera (.slep)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Intercambio JSON cifrado y comprimido para asesores UATP.
                  </div>
                </div>
              </button>
            </div>

            {/* Opciones de Restauración */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <label className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/50 hover:bg-blue-50/20 cursor-pointer transition-all">
                <div className="flex items-center gap-2.5">
                  <Upload className="w-4 h-4 text-blue-600" />
                  <span className="text-xs font-semibold text-slate-700">Restaurar .sqlite</span>
                </div>
                <span className="text-[10px] font-semibold text-blue-600 px-2 py-0.5 bg-white border border-slate-200 rounded shadow-sm">
                  Examinar
                </span>
                <input
                  type="file"
                  accept=".sqlite,.db"
                  onChange={handleFileSqlite}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-dashed border-slate-300 hover:border-orange-400 bg-slate-50/50 hover:bg-orange-50/20 cursor-pointer transition-all">
                <div className="flex items-center gap-2.5">
                  <Upload className="w-4 h-4 text-orange-600" />
                  <span className="text-xs font-semibold text-slate-700">Importar .slep</span>
                </div>
                <span className="text-[10px] font-semibold text-orange-600 px-2 py-0.5 bg-white border border-slate-200 rounded shadow-sm">
                  Examinar
                </span>
                <input
                  type="file"
                  accept=".slep,.json"
                  onChange={handleFileSlep}
                  disabled={isImporting}
                  className="hidden"
                />
              </label>
            </div>

            {/* Zona de Peligro: Borrado Masivo */}
            <div className="space-y-3 pt-3 border-t border-red-100">
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-600" />
                <h3 className="text-xs font-bold text-red-900 uppercase tracking-wider">
                  Zona de Peligro • Borrado Masivo de Información
                </h3>
              </div>
              <p className="text-[11px] text-slate-500">
                Permite depurar y restablecer la información cargada en SQLite de forma masiva ante reprocesamientos o reestructuraciones.
              </p>

              <div className="space-y-2.5">
                {/* Borrar Dotación del Colegio Activo */}
                {colegioActivo ? (
                  <div className="p-3.5 bg-orange-50/80 border border-orange-200 rounded-xl flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-start gap-2.5">
                      <Trash2 className="w-4 h-4 text-orange-600 mt-0.5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold text-orange-950 truncate max-w-[280px]">
                          Vaciar Dotación de {colegioActivo.nombre}
                        </div>
                        <div className="text-[10px] text-orange-800 mt-0.5">
                          RBD: <span className="font-mono font-bold">{colegioActivo.rbd}</span> • Periodo {periodoActivo}. Las demás escuelas de la red permanecerán intactas.
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        if (confirm(`¿CONFIRMAS VACIAR LA DOTACIÓN DE "${colegioActivo.nombre}" (RBD ${colegioActivo.rbd}) para el Periodo ${periodoActivo}?\n\nEsta acción solo afectará a este colegio. Los demás colegios no serán modificados.`)) {
                          if (onBorrarDotacionPeriodo) {
                            await onBorrarDotacionPeriodo(periodoActivo, colegioActivo.rbd);
                            onClose();
                          }
                        }
                      }}
                      className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shrink-0 shadow-2xs transition-colors"
                    >
                      Vaciar Colegio
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-500 flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-slate-400 shrink-0" />
                    <span>Selecciona un establecimiento en el menú superior para vaciar su dotación de forma individual y segura.</span>
                  </div>
                )}
              </div>

              {/* Reiniciar Base de Datos Completa */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    const promptVal = prompt('Para REINICIAR COMPLETAMENTE la base de datos a su estado de fábrica inicial, escribe "REINICIAR":');
                    if (promptVal === 'REINICIAR') {
                      if (onReiniciarBaseDatos) {
                        await onReiniciarBaseDatos();
                        onClose();
                      }
                    } else if (promptVal !== null) {
                      alert('Texto de confirmación incorrecto. Operación cancelada.');
                    }
                  }}
                  className="w-full p-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reiniciar Base de Datos a Estado de Fábrica</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
