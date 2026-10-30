import React, { useState } from 'react';
import { 
  X, 
  FileUp, 
  Building2, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  RefreshCw, 
  GitMerge, 
  Calendar, 
  ShieldAlert, 
  Sparkles,
  Users,
  GraduationCap,
  DoorOpen,
  ArrowRightLeft
} from 'lucide-react';
import { Establecimiento } from '../types';
import { 
  PaqueteEstablecimientoNormalizado,
  normalizarPaqueteEstablecimiento,
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
  const [paquete, setPaquete] = useState<PaqueteEstablecimientoNormalizado | null>(null);
  const [nombreArchivo, setNombreArchivo] = useState<string>('');
  const [targetRbd, setTargetRbd] = useState<string>(colegioActivo.rbd);
  const [targetPeriodo, setTargetPeriodo] = useState<number>(periodoActivo || 2026);
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
    setNombreArchivo(file.name);

    try {
      const text = await file.text();
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        throw new Error('El archivo no contiene un formato JSON válido. Compruebe que el archivo .slep no esté dañado.');
      }

      const paqueteNorm = normalizarPaqueteEstablecimiento(parsed, colegioActivo);
      if (!paqueteNorm.valido || !paqueteNorm.establecimiento?.rbd) {
        throw new Error(paqueteNorm.error || 'El archivo no contiene una ficha o dotación de establecimiento reconocible (.slep o .json).');
      }

      setPaquete(paqueteNorm);
      setTargetRbd(colegioActivo.rbd || paqueteNorm.establecimiento.rbd);
      setTargetPeriodo(periodoActivo || paqueteNorm.periodo || 2026);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al leer el archivo de dotación.');
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

  const handleResetArchivo = () => {
    setPaquete(null);
    setNombreArchivo('');
    setResultado(null);
    setErrorMsg(null);
  };

  const colegioDestinoObj = todosLosColegios.find(c => String(c.rbd) === String(targetRbd)) || {
    id: `est-${targetRbd}`,
    rbd: targetRbd,
    nombre: `Establecimiento RBD ${targetRbd}`,
    comuna: 'Territorio SLEP',
    regimen: 'JEC',
    porcentajePrioritarios: 75
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto">
      <div 
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="bg-[#002B49] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-orange-500/20 text-orange-400 border border-orange-500/30">
              <FileUp className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base">Importar Ficha de Dotación (.slep)</h3>
              <p className="text-xs text-slate-300">Cargar paquete escolar con selección de período y modo de integración</p>
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
          {/* PASO 1: Selección de Archivo (.slep, .slep.json, .json) */}
          {!paquete && !resultado && (
            <div className="space-y-4">
              <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-orange-500 bg-slate-50 dark:bg-slate-800/50 hover:bg-orange-50/30 dark:hover:bg-orange-950/20 transition-all rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer text-center group">
                <FileUp className="w-10 h-10 text-slate-400 group-hover:text-orange-600 transition-colors mb-2" />
                <span className="font-bold text-sm text-slate-800 dark:text-slate-100">
                  Selecciona o arrastra el archivo de dotación escolar
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Formatos compatibles: <strong>.slep</strong>, <strong>.slep.json</strong> o <strong>.json</strong>
                </span>
                <span className="text-[11px] text-orange-600 dark:text-orange-400 font-semibold mt-2 px-3 py-1 bg-orange-50 dark:bg-orange-950/50 rounded-full border border-orange-200 dark:border-orange-800/60">
                  Ficha portable individual o respaldo territorial
                </span>
                <input 
                  type="file" 
                  accept=".slep,.slep.json,.json" 
                  className="hidden" 
                  onChange={handleArchivo}
                />
              </label>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* PASO 2: Configuración de Destino, Período y Modo de Fusión */}
          {paquete && !resultado && (
            <div className="space-y-4 text-xs">
              {/* Tarjeta de Resumen del Archivo Cargado */}
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Archivo Cargado: {nombreArchivo || 'Ficha .slep'}
                  </span>
                  <button
                    type="button"
                    onClick={handleResetArchivo}
                    className="text-[11px] text-orange-600 hover:text-orange-700 font-bold hover:underline"
                  >
                    Cambiar archivo
                  </button>
                </div>

                <div className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-orange-600 shrink-0" />
                  <span>{paquete.establecimiento.nombre}</span>
                  <span className="text-xs font-mono text-slate-500 dark:text-slate-400">(RBD {paquete.establecimiento.rbd})</span>
                  <span className="text-[10px] ml-auto px-2 py-0.5 rounded bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 font-mono font-semibold">
                    Año {paquete.periodo}
                  </span>
                </div>

                {/* Métricas contenidas */}
                <div className="grid grid-cols-5 gap-1.5 pt-1 text-center font-semibold text-[11px]">
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cursos</span>
                    <span className="text-blue-700 dark:text-blue-400 font-bold">{paquete.cursos?.length || 0}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Docentes</span>
                    <span className="text-purple-700 dark:text-purple-400 font-bold">{paquete.docentes?.length || 0}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Asistentes</span>
                    <span className="text-amber-700 dark:text-amber-400 font-bold">{paquete.asistentes?.length || 0}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Asignaciones</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-bold">{paquete.asignaciones?.length || 0}</span>
                  </div>
                  <div className="bg-white dark:bg-slate-900 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Salas</span>
                    <span className="text-indigo-700 dark:text-indigo-400 font-bold">{paquete.salas?.length || 0}</span>
                  </div>
                </div>
              </div>

              {/* Parámetros de Destino */}
              <div className="p-4 bg-orange-50/50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/60 rounded-xl space-y-4">
                <div className="flex items-center gap-1.5 font-bold text-orange-950 dark:text-orange-300 text-xs">
                  <Sparkles className="w-4 h-4 text-orange-600" />
                  <span>Configuración de Integración en el SLEP:</span>
                </div>

                {/* 1. Selector de Establecimiento Destino */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px]">
                    1. Establecimiento de Destino *
                  </label>
                  <select
                    value={targetRbd}
                    onChange={e => setTargetRbd(e.target.value)}
                    className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {todosLosColegios.map(c => (
                      <option key={c.rbd} value={c.rbd}>
                        {c.nombre} (RBD {c.rbd} - {c.comuna})
                      </option>
                    ))}
                  </select>
                  {String(targetRbd) !== String(paquete.establecimiento.rbd) && (
                    <span className="text-[10px] text-orange-700 dark:text-orange-400 mt-1 flex items-center gap-1 font-medium">
                      <ArrowRightLeft className="w-3.5 h-3.5" />
                      Se transferirán los datos del colegio <strong>{paquete.establecimiento.nombre}</strong> hacia <strong>{colegioDestinoObj.nombre}</strong> (RBD {targetRbd}).
                    </span>
                  )}
                </div>

                {/* 2. Selector de Período Escolar Destino */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1 text-[11px] flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-orange-600" />
                    <span>2. ¿A qué Período Escolar desea importar la información? *</span>
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setTargetPeriodo(2026)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center ${
                        targetPeriodo === 2026
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-blue-400'
                      }`}
                    >
                      <span className="text-sm">2026</span>
                      <span className="text-[9px] font-normal opacity-90">Año Escolar 2026</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetPeriodo(2027)}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center justify-center ${
                        targetPeriodo === 2027
                          ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                          : 'bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:border-purple-400'
                      }`}
                    >
                      <span className="text-sm">2027</span>
                      <span className="text-[9px] font-normal opacity-90">Proyección PAL 2027</span>
                    </button>

                    <div className="flex items-center">
                      <input
                        type="number"
                        min={2020}
                        max={2035}
                        value={targetPeriodo}
                        onChange={e => setTargetPeriodo(Number(e.target.value))}
                        className="w-full p-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-center text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-orange-500 focus:outline-none"
                        placeholder="Otro año..."
                      />
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 block">
                    La dotación se registrará bajo el año escolar <strong>{targetPeriodo}</strong>.
                  </span>
                </div>

                {/* 3. Selector de Modo: Reemplazar o Fusionar */}
                <div>
                  <label className="block text-slate-700 dark:text-slate-300 font-semibold mb-1.5 text-[11px] flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-orange-600" />
                    <span>3. ¿Cómo desea incorporar la información en la escuela? *</span>
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* Modo REEMPLAZAR */}
                    <div
                      onClick={() => setModo('REEMPLAZAR')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        modo === 'REEMPLAZAR'
                          ? 'bg-red-50 dark:bg-red-950/40 border-red-500 ring-2 ring-red-500/20 text-red-950 dark:text-red-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <RefreshCw className={`w-4 h-4 ${modo === 'REEMPLAZAR' ? 'text-red-600' : 'text-slate-400'}`} />
                            <span>Reemplazar</span>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            modo === 'REEMPLAZAR' ? 'bg-red-200 text-red-800 dark:bg-red-900/60 dark:text-red-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            Sustitución Total
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 mt-1">
                          Elimina la dotación previa del establecimiento en el período <strong>{targetPeriodo}</strong> y carga de forma limpia exactamente lo que contiene el archivo.
                        </p>
                      </div>
                      <div className="mt-2 text-[9px] text-red-700 dark:text-red-400 font-semibold">
                        ⚠️ Sobreescribirá la dotación actual del año {targetPeriodo}
                      </div>
                    </div>

                    {/* Modo FUSIONAR */}
                    <div
                      onClick={() => setModo('FUSIONAR')}
                      className={`p-3 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                        modo === 'FUSIONAR'
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-950 dark:text-emerald-200'
                          : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:border-slate-400'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-1.5 font-bold text-xs">
                            <GitMerge className={`w-4 h-4 ${modo === 'FUSIONAR' ? 'text-emerald-600' : 'text-slate-400'}`} />
                            <span>Fusionar</span>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            modo === 'FUSIONAR' ? 'bg-emerald-200 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}>
                            Combinación Segura
                          </span>
                        </div>
                        <p className="text-[10px] leading-relaxed text-slate-600 dark:text-slate-400 mt-1">
                          Conserva los docentes, asistentes y cursos ya existentes en el período <strong>{targetPeriodo}</strong>. Actualiza coincidencias (por RUN o curso) e inserta los nuevos sin borrar datos.
                        </p>
                      </div>
                      <div className="mt-2 text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">
                        ✓ No borra funcionarios ya registrados
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>
          )}

          {/* PASO 3: Resultado de la Importación */}
          {resultado && (
            <div className="space-y-4 text-xs">
              <div className={`p-4 rounded-xl border ${resultado.exito ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-950 dark:text-emerald-200' : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-950 dark:text-red-200'}`}>
                <div className="flex items-center gap-2 font-bold text-sm">
                  {resultado.exito ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <ShieldAlert className="w-5 h-5 text-red-600" />}
                  <span>{resultado.exito ? '¡Dotación Importada con Éxito!' : 'Fallo en la Importación'}</span>
                </div>
                <p className="mt-1 text-xs">
                  {resultado.exito 
                    ? `Los datos se integraron correctamente en ${resultado.nombreColegio} (RBD ${resultado.rbdDestino}) para el período ${resultado.periodoDestino} en modo ${resultado.modoAplicado === 'REEMPLAZAR' ? 'Sustitución Total' : 'Fusión Combinada'}.`
                    : resultado.error}
                </p>
              </div>

              {resultado.exito && (
                <div className="grid grid-cols-5 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Cursos</span>
                    <strong className="text-sm font-bold text-blue-800 dark:text-blue-300">{resultado.cursosImportados}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Docentes</span>
                    <strong className="text-sm font-bold text-purple-800 dark:text-purple-300">{resultado.docentesImportados}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Asistentes</span>
                    <strong className="text-sm font-bold text-amber-800 dark:text-amber-300">{resultado.asistentesImportados}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Asignaciones</span>
                    <strong className="text-sm font-bold text-emerald-800 dark:text-emerald-300">{resultado.asignacionesImportadas}</strong>
                  </div>
                  <div className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <span className="text-slate-400 block text-[9px] uppercase font-bold">Salas</span>
                    <strong className="text-sm font-bold text-indigo-800 dark:text-indigo-300">{resultado.salasImportadas}</strong>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Barra Inferior con Botones */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/80 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            {resultado ? 'Cerrar' : 'Cancelar'}
          </button>

          {paquete && !resultado && (
            <button
              type="button"
              onClick={handleEjecutarImportacion}
              disabled={cargando}
              className={`flex items-center gap-2 px-5 py-2 text-white rounded-xl text-xs font-bold shadow-md transition-all ${
                modo === 'REEMPLAZAR' 
                  ? 'bg-orange-600 hover:bg-orange-700 disabled:opacity-50' 
                  : 'bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50'
              }`}
            >
              {cargando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Procesando Importación...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Confirmar e Importar al Período {targetPeriodo} ({modo === 'REEMPLAZAR' ? 'Reemplazar' : 'Fusionar'})
                  </span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
