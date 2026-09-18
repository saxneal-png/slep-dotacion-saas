import React, { useState } from 'react';
import { X, FileUp, Building2, CheckCircle2, AlertTriangle, ArrowRight, ShieldAlert, Sparkles, Layers } from 'lucide-react';
import { Establecimiento } from '../types';
import { 
  EstablecimientoExportPackage, 
  importarPaqueteEstablecimiento, 
  ImportEstablecimientoResult 
} from '../database/repositories/exportImportEstablecimientoRepo';

interface ImportarEstablecimientoModalProps {
  isOpen: boolean;
  onClose: () => void;
  todosLosColegios: Establecimiento[];
  colegioActivo: Establecimiento;
  periodoActivo: number;
  onImportSuccess?: () => void;
}

export const ImportarEstablecimientoModal: React.FC<ImportarEstablecimientoModalProps> = ({
  isOpen,
  onClose,
  todosLosColegios,
  colegioActivo,
  periodoActivo,
  onImportSuccess
}) => {
  const [paquete, setPaquete] = useState<EstablecimientoExportPackage | null>(null);
  const [targetRbd, setTargetRbd] = useState<string>(colegioActivo.rbd);
  const [targetPeriodo, setTargetPeriodo] = useState<number>(periodoActivo);
  const [modo, setModo] = useState<'REEMPLAZAR' | 'FUSIONAR'>('REEMPLAZAR');
  const [cargando, setCargando] = useState(false);
  const [resultado, setResultado] = useState<ImportEstablecimientoResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setResultado(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as EstablecimientoExportPackage;
      if (parsed.formato !== 'SLEP_ESTABLECIMIENTO_PACKAGE') {
        throw new Error('El archivo no es un paquete válido de dotación de establecimiento (formato no reconocido).');
      }
      setPaquete(parsed);
      setTargetRbd(colegioActivo.rbd || parsed.establecimiento.rbd);
      setTargetPeriodo(parsed.periodo || periodoActivo);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al leer el archivo JSON.');
      setPaquete(null);
    }
  };

  const handleEjecutarImportacion = async () => {
    if (!paquete) return;
    setCargando(true);
    setErrorMsg(null);
    try {
      const res = await importarPaqueteEstablecimiento(paquete, targetRbd, targetPeriodo, modo);
      setResultado(res);
      if (res.exito && onImportSuccess) {
        onImportSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al ejecutar la importación.');
    } finally {
      setCargando(false);
    }
  };

  const colegioDestinoObj = todosLosColegios.find(c => c.rbd === targetRbd) || {
    id: `est-${targetRbd}`,
    rbd: targetRbd,
    nombre: `Establecimiento RBD ${targetRbd}`,
    comuna: 'Chillán',
    regimen: 'JEC',
    porcentajePrioritarios: 75
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col my-auto max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="bg-[#002B49] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Importar Dotación de Establecimiento</h3>
              <p className="text-xs text-slate-300">Cargar paquete (.slep.json) con selector de destino y modo de fusión</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto">
          {/* Selección de Archivo */}
          {!paquete && !resultado && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 hover:border-orange-500 bg-slate-50 hover:bg-orange-50/30 transition-all rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer text-center group">
                <FileUp className="w-10 h-10 text-slate-400 group-hover:text-orange-600 transition-colors mb-2" />
                <span className="font-bold text-sm text-slate-800">Selecciona o arrastra el archivo .slep.json</span>
                <span className="text-xs text-slate-400 mt-1">Paquetes generados mediante la función de exportación selectiva</span>
                <input 
                  type="file" 
                  accept=".json,.slep.json" 
                  className="hidden" 
                  onChange={handleArchivo}
                />
              </label>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* Datos del Paquete Detectado */}
          {paquete && !resultado && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Establecimiento de Origen:</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-semibold font-mono">
                    Período {paquete.periodo}
                  </span>
                </div>
                <div className="font-bold text-slate-800 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-600" />
                  <span>{paquete.establecimiento.nombre}</span>
                  <span className="text-xs font-mono text-slate-500">(RBD {paquete.establecimiento.rbd})</span>
                </div>
                <div className="grid grid-cols-4 gap-2 pt-1 text-center font-semibold text-[11px]">
                  <div className="bg-white p-1.5 rounded border">
                    <span className="text-slate-400 block text-[9px]">Cursos</span>
                    <span className="text-blue-700">{paquete.cursos?.length || 0}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border">
                    <span className="text-slate-400 block text-[9px]">Docentes</span>
                    <span className="text-purple-700">{paquete.docentes?.length || 0}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border">
                    <span className="text-slate-400 block text-[9px]">Asignaciones</span>
                    <span className="text-emerald-700">{paquete.asignaciones?.length || 0}</span>
                  </div>
                  <div className="bg-white p-1.5 rounded border">
                    <span className="text-slate-400 block text-[9px]">Salas</span>
                    <span className="text-amber-700">{paquete.salas?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Selector de Destino */}
              <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-3">
                <div className="flex items-center gap-1.5 font-bold text-orange-950 text-xs">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span>Configuración de Destino dentro del SLEP:</span>
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Establecimiento de Destino *</label>
                  <select
                    value={targetRbd}
                    onChange={e => setTargetRbd(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {todosLosColegios.map(c => (
                      <option key={c.rbd} value={c.rbd}>
                        {c.nombre} (RBD {c.rbd} - {c.comuna})
                      </option>
                    ))}
                  </select>
                  {targetRbd !== paquete.establecimiento.rbd && (
                    <span className="text-[10px] text-orange-700 mt-1 block">
                      ⚠️ Se clonarán los datos del colegio <strong>{paquete.establecimiento.nombre}</strong> hacia <strong>{colegioDestinoObj.nombre}</strong> (RBD {targetRbd}).
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Período de Destino *</label>
                    <select
                      value={targetPeriodo}
                      onChange={e => setTargetPeriodo(Number(e.target.value))}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value={2026}>Período 2026</option>
                      <option value={2027}>Período 2027</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-700 font-semibold mb-1 text-[11px]">Modo de Fusión *</label>
                    <select
                      value={modo}
                      onChange={e => setModo(e.target.value as any)}
                      className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    >
                      <option value="REEMPLAZAR">Reemplazar todo el período</option>
                      <option value="FUSIONAR">Combinar / Conservar existentes</option>
                    </select>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* Resultado de la Importación */}
          {resultado && (
            <div className="space-y-4 text-xs">
              <div className={`p-4 rounded-xl border ${resultado.exito ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-red-50 border-red-200 text-red-950'}`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  {resultado.exito ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-red-600" />}
                  <span>{resultado.exito ? '¡Importación Realizada con Éxito!' : 'Fallo en la Importación'}</span>
                </div>
                <p className="mt-1 text-xs">
                  {resultado.exito 
                    ? `Los datos se integraron correctamente en ${resultado.nombreColegio} (RBD ${resultado.rbdDestino}) para el período ${resultado.periodoDestino}.`
                    : resultado.error}
                </p>
              </div>

              {resultado.exito && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Cursos</span>
                    <strong className="text-sm font-bold text-blue-800">{resultado.cursosImportados}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 border rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Docentes</span>
                    <strong className="text-sm font-bold text-purple-800">{resultado.docentesImportados}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 border rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Asignaciones</span>
                    <strong className="text-sm font-bold text-emerald-800">{resultado.asignacionesImportadas}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 border rounded-lg">
                    <span className="text-slate-400 block text-[10px]">Salas</span>
                    <strong className="text-sm font-bold text-amber-800">{resultado.salasImportadas}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            {resultado ? 'Cerrar' : 'Cancelar'}
          </button>

          {paquete && !resultado && (
            <button
              type="button"
              onClick={handleEjecutarImportacion}
              disabled={cargando}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{cargando ? 'Importando a SQLite...' : 'Confirmar e Importar'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
