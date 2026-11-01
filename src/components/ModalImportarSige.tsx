import React, { useState, useRef } from 'react';
import {
  X,
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Search,
  RefreshCw
} from 'lucide-react';
import { Docente, Establecimiento } from '../types';
import {
  decodificarArchivoSige,
  parsearPlanillaSige,
  ResultadoParseoSige
} from '../services/sigeParserService';
import { validarRut } from '../utils/rutUtils';

export interface ModalImportarSigeProps {
  isOpen: boolean;
  onClose: () => void;
  colegio: Establecimiento;
  docentesActuales: Docente[];
  periodoActivo: number;
  onGuardarBatch: (docentesNuevos: Docente[]) => Promise<void> | void;
}

export const ModalImportarSige: React.FC<ModalImportarSigeProps> = ({
  isOpen,
  onClose,
  colegio,
  docentesActuales,
  periodoActivo,
  onGuardarBatch
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [nombreArchivo, setNombreArchivo] = useState<string>('');
  const [resultado, setResultado] = useState<ResultadoParseoSige | null>(null);
  const [errorParseo, setErrorParseo] = useState<string | null>(null);
  const [filtroBusqueda, setFiltroBusqueda] = useState('');
  const [modoImportacion, setModoImportacion] = useState<'FUSIONAR' | 'REEMPLAZAR'>('FUSIONAR');
  const [guardando, setGuardando] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const procesarArchivo = async (file: File) => {
    try {
      setCargando(true);
      setErrorParseo(null);
      setNombreArchivo(file.name);

      const buffer = await file.arrayBuffer();
      // Decodificación con preservación garantizada de Windows-1252 / ISO-8859-1 (Ñ y tildes)
      const textoDecodificado = decodificarArchivoSige(buffer, file.name);

      const res = parsearPlanillaSige(textoDecodificado, colegio.rbd, periodoActivo);
      setResultado(res);
    } catch (err: any) {
      console.error('Error al procesar nómina SIGE:', err);
      setErrorParseo(err.message || 'Error desconocido al procesar el archivo SIGE.');
      setResultado(null);
    } finally {
      setCargando(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      procesarArchivo(file);
    }
  };

  const handleConfirmarImportacion = async () => {
    if (!resultado || resultado.docentesConvertidos.length === 0) return;

    try {
      setGuardando(true);
      let payloadFinal: Docente[] = [];

      if (modoImportacion === 'REEMPLAZAR') {
        payloadFinal = resultado.docentesConvertidos;
      } else {
        // Fusión inteligente por RUN
        const mapDocentes = new Map<string, Docente>();
        // 1. Agregar los actuales
        docentesActuales.forEach(d => {
          const runKey = d.run.replace(/\D/g, '');
          mapDocentes.set(runKey, d);
        });

        // 2. Actualizar o insertar con los datos de SIGE
        resultado.docentesConvertidos.forEach(dNuevo => {
          const runKey = dNuevo.run.replace(/\D/g, '');
          const existe = mapDocentes.get(runKey);

          if (existe) {
            // Actualizar manteniendo asignaciones o id original
            mapDocentes.set(runKey, {
              ...existe,
              nombres: dNuevo.nombres,
              apellidos: dNuevo.apellidos,
              horasContrato: dNuevo.horasContrato,
              horasAula: dNuevo.horasAula,
              horasDirectivas: dNuevo.horasDirectivas,
              horasTecnicoPedagogicas: dNuevo.horasTecnicoPedagogicas,
              horasIngles: dNuevo.horasIngles,
              estamento: dNuevo.estamento,
              funcionPrincipal: dNuevo.funcionPrincipal,
              asignaturaPrincipal: dNuevo.asignaturaPrincipal
            });
          } else {
            mapDocentes.set(runKey, dNuevo);
          }
        });

        payloadFinal = Array.from(mapDocentes.values());
      }

      await onGuardarBatch(payloadFinal);
      onClose();
    } catch (err: any) {
      alert(`Error al guardar docentes: ${err.message || err}`);
    } finally {
      setGuardando(false);
    }
  };

  const docentesAMostrar = (resultado?.docentesConvertidos || []).filter(d => {
    if (!filtroBusqueda.trim()) return true;
    const q = filtroBusqueda.toLowerCase();
    return (
      d.nombres.toLowerCase().includes(q) ||
      d.apellidos.toLowerCase().includes(q) ||
      d.run.toLowerCase().includes(q) ||
      (d.asignaturaPrincipal && d.asignaturaPrincipal.toLowerCase().includes(q))
    );
  });

  const rbdCoincide = resultado?.rbdDetectado === colegio.rbd;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Cabecera Modal */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-xl backdrop-blur-md">
              <FileSpreadsheet className="w-6 h-6 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                Importar Nómina Docente desde SIGE
                <span className="text-[11px] font-semibold bg-emerald-500/30 text-emerald-100 px-2 py-0.5 rounded-full border border-emerald-400/30">
                  Respeto nativo de Ñ y tildes
                </span>
              </h2>
              <p className="text-xs text-emerald-100/90">
                Establecimiento activo: <span className="font-bold underline">{colegio.nombre}</span> (RBD {colegio.rbd})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-emerald-200 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* Zona de Drop / Carga de Archivo */}
          {!resultado && (
            <div
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200 ${
                dragOver
                  ? 'border-emerald-500 bg-emerald-50/70 scale-[0.99]'
                  : 'border-slate-300 hover:border-emerald-400 bg-slate-50/60 hover:bg-emerald-50/30'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                <UploadCloud className="w-7 h-7" />
              </div>
              <p className="text-sm font-bold text-slate-800">
                Haz clic para seleccionar o arrastra tu nómina SIGE aquí
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Admite archivos <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">.csv</code> delimitados por punto y coma (Windows-1252) y libros <code className="bg-slate-200 px-1 py-0.5 rounded text-[11px]">.xlsx</code>
              </p>

              <div className="mt-4 flex items-center justify-center gap-4 text-[11px] text-slate-600">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Módulo 11 Verificado
                </span>
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  Corrección de Ñ y acentos
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Horas Contrato y Aula
                </span>
              </div>
            </div>
          )}

          {cargando && (
            <div className="p-8 text-center space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-600 animate-spin mx-auto" />
              <p className="text-xs font-semibold text-slate-600">
                Decodificando bytes y analizando estructura de SIGE...
              </p>
            </div>
          )}

          {errorParseo && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-red-800">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Error en la lectura del archivo</p>
                <p className="mt-0.5 text-red-700">{errorParseo}</p>
                <button
                  onClick={() => {
                    setErrorParseo(null);
                    setResultado(null);
                  }}
                  className="mt-2 text-red-700 font-bold underline hover:text-red-900"
                >
                  Intentar con otro archivo
                </button>
              </div>
            </div>
          )}

          {/* Previsualización tras parseo exitoso */}
          {resultado && (
            <div className="space-y-4">
              {/* Barra informativa del archivo */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-100 rounded-xl border border-slate-200 text-xs">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                  <span className="font-bold text-slate-800">{nombreArchivo}</span>
                </div>
                <div className="flex items-center gap-2">
                  {rbdCoincide ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      RBD coincide ({resultado.rbdDetectado})
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-100 text-amber-800 font-bold rounded-lg border border-amber-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                      Archivo de RBD {resultado.rbdDetectado || 'No detectado'} (se asignará a {colegio.rbd})
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setResultado(null);
                      setNombreArchivo('');
                    }}
                    className="text-slate-500 hover:text-slate-800 underline font-semibold ml-2"
                  >
                    Cambiar archivo
                  </button>
                </div>
              </div>

              {/* Métricas KPI detectadas */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                  <p className="text-[11px] font-bold uppercase text-emerald-700">Docentes Detectados</p>
                  <p className="text-xl font-extrabold text-emerald-950 mt-0.5">
                    {resultado.totales.totalDocentes}
                  </p>
                </div>
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-[11px] font-bold uppercase text-blue-700">Horas Contrato Totales</p>
                  <p className="text-xl font-extrabold text-blue-950 mt-0.5">
                    {resultado.totales.totalHorasContrato} hrs
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 rounded-xl border border-indigo-200">
                  <p className="text-[11px] font-bold uppercase text-indigo-700">Horas Aula</p>
                  <p className="text-xl font-extrabold text-indigo-950 mt-0.5">
                    {resultado.totales.totalHorasAula} hrs
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-200">
                  <p className="text-[11px] font-bold uppercase text-purple-700">Técnicas + Directivas</p>
                  <p className="text-xl font-extrabold text-purple-950 mt-0.5">
                    {resultado.totales.totalHorasTecnicas + resultado.totales.totalHorasDirectivas} hrs
                  </p>
                </div>
              </div>

              {/* Selector de Modo de Ingesta */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Modo de Incorporación en {colegio.nombre}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      modoImportacion === 'FUSIONAR'
                        ? 'bg-emerald-50/60 border-emerald-400 text-emerald-900 ring-1 ring-emerald-400'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modoImport"
                      value="FUSIONAR"
                      checked={modoImportacion === 'FUSIONAR'}
                      onChange={() => setModoImportacion('FUSIONAR')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <span className="font-bold block">Actualizar e Incorporar (Recomendado)</span>
                      <span className="text-[11px] text-slate-500">
                        Actualiza horas y cargos de docentes ya existentes por su RUN y añade a los nuevos.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-colors ${
                      modoImportacion === 'REEMPLAZAR'
                        ? 'bg-amber-50/60 border-amber-400 text-amber-900 ring-1 ring-amber-400'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="radio"
                      name="modoImport"
                      value="REEMPLAZAR"
                      checked={modoImportacion === 'REEMPLAZAR'}
                      onChange={() => setModoImportacion('REEMPLAZAR')}
                      className="mt-0.5 text-amber-600 focus:ring-amber-500"
                    />
                    <div>
                      <span className="font-bold block">Reemplazar Nómina Completa</span>
                      <span className="text-[11px] text-slate-500">
                        Sustituye la dotación del establecimiento con únicamente los docentes de este archivo.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Buscador y Tabla de Docentes */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-bold text-slate-700">
                    Vista previa de Docentes ({docentesAMostrar.length} de {resultado.docentesConvertidos.length})
                  </p>
                  <div className="relative w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Buscar por RUN, nombre o materia..."
                      value={filtroBusqueda}
                      onChange={e => setFiltroBusqueda(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    />
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 uppercase font-bold sticky top-0 text-[10px] border-b">
                      <tr>
                        <th className="px-3 py-2">RUN</th>
                        <th className="px-3 py-2">Docente</th>
                        <th className="px-3 py-2">Función / Asignatura</th>
                        <th className="px-2 py-2 text-center">Contrato</th>
                        <th className="px-2 py-2 text-center">Aula</th>
                        <th className="px-2 py-2 text-center">Téc/Dir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {docentesAMostrar.map((d, i) => {
                        const runOk = validarRut(d.run);
                        return (
                          <tr key={i} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-3 py-2 font-mono whitespace-nowrap">
                              <span className="font-semibold text-slate-800">{d.run}</span>
                              {!runOk && (
                                <span className="ml-1 text-[10px] text-amber-600 bg-amber-50 px-1 py-0.5 rounded border border-amber-200" title="Discrepancia en DV">
                                  DV?
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 font-medium text-slate-900">
                              {d.nombres} {d.apellidos}
                            </td>
                            <td className="px-3 py-2 text-slate-600">
                              <div className="font-medium text-slate-800">{d.funcionPrincipal}</div>
                              {d.asignaturaPrincipal && (
                                <div className="text-[11px] text-slate-500">{d.asignaturaPrincipal}</div>
                              )}
                            </td>
                            <td className="px-2 py-2 text-center font-bold text-slate-800">
                              {d.horasContrato} hrs
                            </td>
                            <td className="px-2 py-2 text-center text-slate-700">
                              {d.horasAula || 0}
                            </td>
                            <td className="px-2 py-2 text-center text-slate-700">
                              {(d.horasTecnicoPedagogicas || 0) + (d.horasDirectivas || 0)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pie de Modal / Botones de Acción */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>

          {resultado && (
            <button
              type="button"
              disabled={guardando || resultado.docentesConvertidos.length === 0}
              onClick={handleConfirmarImportacion}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
            >
              {guardando ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Guardando Dotación...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Subir {resultado.docentesConvertidos.length} Docentes a {colegio.nombre}
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
