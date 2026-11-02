import React, { useState } from 'react';
import {
  FileUp,
  Building2,
  Users,
  Clock,
  Award,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  UserCheck,
  Layers,
  MapPin,
  Check
} from 'lucide-react';
import { Establecimiento, ComunaValleDiguillin, RegimenJornada, AsistenteEducacion, Docente } from '../types';
import { parsearPlanillaSige, decodificarArchivoSige, ResultadoParseoSige } from '../services/sigeParserService';
import { parsearAsistentesSige, esEncabezadoAsistentesSige, ResultadoParseoAsistentesSige } from '../services/sigeAsistentesParser';
import { guardarAsistentesBatch } from '../database/repositories/asistentesRepo';
import { guardarDocentesBatch } from '../database/repositories/docentesRepo';
import { guardarEstablecimiento } from '../database/repositories/establecimientosRepo';
import { getDb, persistDb } from '../database/dbCore';

interface SigeIngestaViewProps {
  onIngestarSigeCompleto: (
    establecimiento: Establecimiento,
    docentes: Docente[]
  ) => Promise<void>;
  onIngestarAsistentesSigeCompleto?: (
    establecimiento: Establecimiento,
    asistentes: AsistenteEducacion[]
  ) => Promise<void>;
  onCerrar?: () => void;
}

const COMUNAS: ComunaValleDiguillin[] = [
  'Bulnes',
  'Chillán',
  'Chillán Viejo',
  'El Carmen',
  'Pemuco',
  'San Ignacio',
  'Yungay'
];

type TipoNomina = 'DOCENTES' | 'ASISTENTES';

export const SigeIngestaView: React.FC<SigeIngestaViewProps> = ({
  onIngestarSigeCompleto,
  onIngestarAsistentesSigeCompleto
}) => {
  const [tipoNomina, setTipoNomina] = useState<TipoNomina>('DOCENTES');
  const [textoPegado, setTextoPegado] = useState('');
  const [resultadoDocentes, setResultadoDocentes] = useState<ResultadoParseoSige | null>(null);
  const [resultadoAsistentes, setResultadoAsistentes] = useState<ResultadoParseoAsistentesSige | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [comunaSeleccionada, setComunaSeleccionada] = useState<ComunaValleDiguillin>('Bulnes');
  const [regimenSeleccionado, setRegimenSeleccionado] = useState<RegimenJornada>('JEC');
  const [prioritarios, setPrioritarios] = useState(80);
  const [cargando, setCargando] = useState(false);
  const [exitoMsg, setExitoMsg] = useState<string | null>(null);

  const procesarTexto = (contenido: string, tipoForzado?: TipoNomina) => {
    try {
      setErrorMsg(null);
      setExitoMsg(null);

      // Auto-detección de tipo de nómina según encabezados
      const esAsistente = esEncabezadoAsistentesSige(contenido);
      const targetTipo = tipoForzado || (esAsistente ? 'ASISTENTES' : 'DOCENTES');
      setTipoNomina(targetTipo);

      if (targetTipo === 'ASISTENTES') {
        const res = parsearAsistentesSige(contenido);
        setResultadoAsistentes(res);
        setResultadoDocentes(null);
        if (res.establecimientoSugerido.comuna) {
          setComunaSeleccionada(res.establecimientoSugerido.comuna);
        }
      } else {
        const res = parsearPlanillaSige(contenido);
        setResultadoDocentes(res);
        setResultadoAsistentes(null);
        if (res.establecimientoSugerido.comuna) {
          setComunaSeleccionada(res.establecimientoSugerido.comuna);
        }
      }
    } catch (err: any) {
      setErrorMsg(`Error al procesar archivo SIGE: ${err.message}`);
      setResultadoDocentes(null);
      setResultadoAsistentes(null);
    }
  };

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const text = decodificarArchivoSige(buffer, file.name);
      setTextoPegado(text);
      procesarTexto(text);
    } catch (err: any) {
      setErrorMsg(`Error al leer archivo: ${err.message}`);
    }
  };

  const handleConfirmarIngestaDocentes = async () => {
    if (!resultadoDocentes) return;
    setCargando(true);
    try {
      // 1. Guardar todos los establecimientos detectados en el archivo (asociados por columna RBD)
      const establecimientosAGuardar = resultadoDocentes.establecimientosDetectados.length
        ? resultadoDocentes.establecimientosDetectados
        : [resultadoDocentes.establecimientoSugerido];

      for (const est of establecimientosAGuardar) {
        await guardarEstablecimiento({
          ...est,
          comuna: est.comuna || comunaSeleccionada,
          regimen: est.regimen || regimenSeleccionado,
          porcentajePrioritarios: prioritarios,
          asesorUatp: est.asesorUatp || 'UATP SLEP Valle Diguillín'
        });
      }

      // 2. Guardar docentes en batch preservando su propio RBD
      await guardarDocentesBatch(resultadoDocentes.docentesConvertidos);
      await persistDb(true);

      const primerEst = establecimientosAGuardar[0];
      await onIngestarSigeCompleto(primerEst, resultadoDocentes.docentesConvertidos);

      setExitoMsg(
        `✓ Ingesta Docente completada: ${establecimientosAGuardar.length} establecimiento(s) y ${resultadoDocentes.docentesConvertidos.length} contratos docentes asociados por RBD a SQLite.`
      );
    } catch (err: any) {
      setErrorMsg(`Error al guardar en base de datos: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  const handleConfirmarIngestaAsistentes = async () => {
    if (!resultadoAsistentes) return;
    setCargando(true);
    try {
      // 1. Guardar todos los establecimientos detectados en el archivo
      const establecimientosAGuardar = resultadoAsistentes.establecimientosDetectados.length
        ? resultadoAsistentes.establecimientosDetectados
        : [resultadoAsistentes.establecimientoSugerido];

      for (const est of establecimientosAGuardar) {
        await guardarEstablecimiento({
          ...est,
          comuna: est.comuna || comunaSeleccionada,
          regimen: est.regimen || regimenSeleccionado,
          porcentajePrioritarios: prioritarios,
          asesorUatp: est.asesorUatp || 'UATP SLEP Valle Diguillín'
        });
      }

      // 2. Guardar asistentes en batch preservando su propio RBD
      const db = await getDb();
      await guardarAsistentesBatch(db, resultadoAsistentes.asistentesConvertidos, undefined, 2026, true);
      await persistDb(true);

      const primerEst = establecimientosAGuardar[0];
      if (onIngestarAsistentesSigeCompleto) {
        await onIngestarAsistentesSigeCompleto(primerEst, resultadoAsistentes.asistentesConvertidos);
      }

      setExitoMsg(
        `✓ Ingesta Asistentes completada: ${establecimientosAGuardar.length} establecimiento(s) y ${resultadoAsistentes.asistentesConvertidos.length} contratos de asistentes asociados por RBD a SQLite.`
      );
    } catch (err: any) {
      setErrorMsg(`Error al guardar asistentes en base de datos: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida Módulo SIGE */}
      <div className="bg-[#002B49] text-white p-6 rounded-2xl border border-slate-700 shadow-md">
        <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider">
          <FileUp className="w-4 h-4" />
          Módulo Oficial de Ingesta SIGE MINEDUC
        </div>
        <h2 className="text-xl font-bold text-white mt-1">
          Importador Automatizado de Nóminas Oficiales (Docentes y Asistentes)
        </h2>
        <p className="text-xs text-slate-300 mt-1 max-w-3xl">
          Carga nóminas descargadas desde SIGE en formato CSV, TXT o Excel.
          Los funcionarios se asocian rigurosamente según su <strong>columna RBD</strong> (admitiendo funcionarios con desempeño simultáneo en más de un establecimiento, verificando el límite normativo de <strong>44 horas semanales</strong>).
        </p>

        {/* Selector de Pestañas de Nómina */}
        <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700/60">
          <button
            type="button"
            onClick={() => {
              setTipoNomina('DOCENTES');
              if (textoPegado) procesarTexto(textoPegado, 'DOCENTES');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              tipoNomina === 'DOCENTES'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Nómina Docente</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTipoNomina('ASISTENTES');
              if (textoPegado) procesarTexto(textoPegado, 'ASISTENTES');
            }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              tipoNomina === 'ASISTENTES'
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Nómina Asistentes de la Educación</span>
          </button>
        </div>
      </div>

      {/* Selector de Entrada: Subir Archivo o Pegar Texto */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl cursor-pointer shadow transition-colors">
            <FileUp className="w-4 h-4" />
            <span>Seleccionar Archivo SIGE (.csv, .txt, .xlsx)</span>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="hidden"
              onChange={handleArchivoSeleccionado}
            />
          </label>

          <span className="text-xs text-slate-400">
            o pega directamente el texto copiado desde SIGE (delimitado por punto y coma ;)
          </span>
        </div>

        <div>
          <textarea
            rows={4}
            value={textoPegado}
            onChange={e => {
              const val = e.target.value;
              setTextoPegado(val);
              if (val.includes('ASISTENTE_RUN') || val.includes('DOC_RUN')) {
                procesarTexto(val);
              }
            }}
            placeholder={
              tipoNomina === 'ASISTENTES'
                ? 'Pega aquí la nómina de Asistentes (ej: ASISTENTE_RUN;ASISTENTE_DV;ASISTENTE_NOMBRE;ASISTENTE_PATERNO;...)'
                : 'Pega aquí la nómina de Docentes (ej: DOC_RUN;DOC_DV;DOC_NOMBRE;DOC_PATERNO;...)'
            }
            className="w-full p-3 font-mono text-[11px] border border-slate-300 rounded-xl focus:ring-2 focus:ring-orange-500 focus:outline-none text-slate-700"
          />
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {exitoMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{exitoMsg}</span>
          </div>
        )}
      </div>

      {/* Previsualización Nómina Asistentes */}
      {resultadoAsistentes && tipoNomina === 'ASISTENTES' && (
        <div className="space-y-6">
          {/* Panel de Establecimientos Detectados por Columna RBD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-600" />
                Establecimientos Detectados por Columna RBD ({resultadoAsistentes.establecimientosDetectados.length})
              </h3>
              {resultadoAsistentes.establecimientosDetectados.length > 1 && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Nómina Multi-Establecimiento
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {resultadoAsistentes.establecimientosDetectados.map(est => {
                const countEnColegio = resultadoAsistentes.asistentesConvertidos.filter(a => a.rbd === est.rbd).length;
                const horasEnColegio = resultadoAsistentes.asistentesConvertidos
                  .filter(a => a.rbd === est.rbd)
                  .reduce((sum, a) => sum + a.horasContrato, 0);

                return (
                  <div key={est.rbd} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">RBD {est.rbd} • {est.comuna}</div>
                      <div className="text-xs font-bold text-slate-800 truncate max-w-[200px]" title={est.nombre}>
                        {est.nombre}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-orange-600">{countEnColegio} func.</div>
                      <div className="text-[10px] font-semibold text-slate-500">{horasEnColegio} hrs</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Métricas Agregadas Asistentes */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Contratos</div>
                <div className="text-xl font-black text-slate-800">{resultadoAsistentes.totales.totalAsistentes}</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Contrato</div>
                <div className="text-xl font-black text-orange-600">{resultadoAsistentes.totales.totalHorasContrato}h</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Auxiliares Servicio</div>
                <div className="text-xl font-black text-blue-600">{resultadoAsistentes.totales.totalAuxiliares}</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Inspectores / Patio</div>
                <div className="text-xl font-black text-purple-600">{resultadoAsistentes.totales.totalParadocentes}</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Profesionales / Dupla</div>
                <div className="text-xl font-black text-emerald-600">
                  {resultadoAsistentes.totales.totalProfesionales} ({resultadoAsistentes.totales.totalDuplas} Duplas)
                </div>
              </div>
            </div>

            {/* Control Normativo: Funcionarios Multi-Establecimiento y Tope 44h */}
            {resultadoAsistentes.funcionariosMultiEstablecimiento.length > 0 && (
              <div className="pt-2">
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span>Funcionarios con contratos en más de un establecimiento ({resultadoAsistentes.funcionariosMultiEstablecimiento.length})</span>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-800">Límite legal permitido: máx. 44 horas semanales</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {resultadoAsistentes.funcionariosMultiEstablecimiento.map(f => (
                      <div
                        key={f.run}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          f.excede44h
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-white border-amber-200 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{f.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            RUN: {f.run} • RBDs: {f.rbds.join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black block ${
                              f.excede44h ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {f.totalHoras}h {f.excede44h ? '⚠️ >44h' : '✓ OK'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Botón de Confirmación */}
            <div className="pt-2 flex justify-end">
              <button
                disabled={cargando}
                onClick={handleConfirmarIngestaAsistentes}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{cargando ? 'Guardando en Base de Datos...' : 'Ingestar Asistentes de la Educación a SQLite'}</span>
              </button>
            </div>
          </div>

          {/* Tabla Detalle de Asistentes Previsualizados */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-orange-600" />
                Detalle de Asistentes a Importar ({resultadoAsistentes.filas.length})
              </h3>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">RBD / Colegio</th>
                    <th className="px-3 py-2.5">RUN</th>
                    <th className="px-3 py-2.5">Funcionario</th>
                    <th className="px-3 py-2.5">Cargo / Función</th>
                    <th className="px-3 py-2.5">Título</th>
                    <th className="px-3 py-2.5 text-center">Horas</th>
                    <th className="px-3 py-2.5 text-center">Estamento</th>
                    <th className="px-3 py-2.5 text-center">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultadoAsistentes.filas.map((f, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-800">
                        {f.rbd}
                        <span className="block text-[9px] font-normal text-slate-400 truncate max-w-[120px]">{f.nombreEstablecimiento}</span>
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">{f.runCompleto}</td>
                      <td className="px-3 py-2 font-bold text-slate-800">{f.apellidos}, {f.nombres}</td>
                      <td className="px-3 py-2 font-semibold text-slate-700">{f.cargoCompuesto}</td>
                      <td className="px-3 py-2 text-slate-500 text-[11px]">{f.titulo !== 'SIN TÍTULO' ? `${f.titulo}` : 'Sin título'}</td>
                      <td className="px-3 py-2 text-center font-bold text-orange-600">{f.horasContrato}h</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          f.estamentoDetectado === 'PROFESIONAL' ? 'bg-emerald-100 text-emerald-800' :
                          f.estamentoDetectado === 'AUXILIAR' ? 'bg-blue-100 text-blue-800' :
                          f.estamentoDetectado === 'TECNICO' ? 'bg-purple-100 text-purple-800' :
                          'bg-amber-100 text-amber-800'
                        }`}>
                          {f.estamentoDetectado}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                          {f.estadoAsistente}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Previsualización Nómina Docente */}
      {resultadoDocentes && tipoNomina === 'DOCENTES' && (
        <div className="space-y-6">
          {/* Panel de Establecimientos Detectados por Columna RBD */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-orange-600" />
                Establecimientos Detectados por Columna RBD ({resultadoDocentes.establecimientosDetectados.length})
              </h3>
              {resultadoDocentes.establecimientosDetectados.length > 1 && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-100 text-blue-800 flex items-center gap-1">
                  <Layers className="w-3 h-3" /> Nómina Multi-Establecimiento
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {resultadoDocentes.establecimientosDetectados.map(est => {
                const countEnColegio = resultadoDocentes.docentesConvertidos.filter(d => d.rbd === est.rbd).length;
                const horasEnColegio = resultadoDocentes.docentesConvertidos
                  .filter(d => d.rbd === est.rbd)
                  .reduce((sum, d) => sum + d.horasContrato, 0);

                return (
                  <div key={est.rbd} className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-slate-400">RBD {est.rbd} • {est.comuna}</div>
                      <div className="text-xs font-bold text-slate-800 truncate max-w-[200px]" title={est.nombre}>
                        {est.nombre}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-black text-orange-600">{countEnColegio} doc.</div>
                      <div className="text-[10px] font-semibold text-slate-500">{horasEnColegio} hrs</div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Métricas Agregadas SIGE Docentes */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Contratos</div>
                <div className="text-xl font-black text-slate-800">{resultadoDocentes.totales.totalDocentes}</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Contrato</div>
                <div className="text-xl font-black text-orange-600">{resultadoDocentes.totales.totalHorasContrato}h</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Directivas</div>
                <div className="text-xl font-black text-purple-600">{resultadoDocentes.totales.totalHorasDirectivas}h</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Técnicas</div>
                <div className="text-xl font-black text-blue-600">{resultadoDocentes.totales.totalHorasTecnicas}h</div>
              </div>

              <div className="p-3 bg-white border rounded-xl text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Aula</div>
                <div className="text-xl font-black text-emerald-600">{resultadoDocentes.totales.totalHorasAula}h</div>
              </div>
            </div>

            {/* Control Normativo: Docentes Multi-Establecimiento y Tope 44h */}
            {resultadoDocentes.funcionariosMultiEstablecimiento.length > 0 && (
              <div className="pt-2">
                <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                      <Users className="w-4 h-4 text-amber-600" />
                      <span>Docentes con contratos en más de un establecimiento ({resultadoDocentes.funcionariosMultiEstablecimiento.length})</span>
                    </div>
                    <span className="text-[10px] font-semibold text-amber-800">Límite legal permitido: máx. 44 horas semanales</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {resultadoDocentes.funcionariosMultiEstablecimiento.map(f => (
                      <div
                        key={f.run}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between ${
                          f.excede44h
                            ? 'bg-rose-50 border-rose-200 text-rose-900'
                            : 'bg-white border-amber-200 text-slate-800'
                        }`}
                      >
                        <div>
                          <div className="font-bold">{f.nombre}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            RUN: {f.run} • RBDs: {f.rbds.join(', ')}
                          </div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-black block ${
                              f.excede44h ? 'bg-rose-600 text-white animate-pulse' : 'bg-emerald-100 text-emerald-800'
                            }`}
                          >
                            {f.totalHoras}h {f.excede44h ? '⚠️ >44h' : '✓ OK'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Botón de Confirmación */}
            <div className="pt-2 flex justify-end">
              <button
                disabled={cargando}
                onClick={handleConfirmarIngestaDocentes}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-md transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{cargando ? 'Guardando en Base de Datos...' : 'Ingestar Docentes a SQLite'}</span>
              </button>
            </div>
          </div>

          {/* Tabla Detalle de Docentes Previsualizados */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-600" />
                Detalle de Docentes a Importar ({resultadoDocentes.filas.length})
              </h3>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b sticky top-0">
                  <tr>
                    <th className="px-3 py-2.5">RBD / Colegio</th>
                    <th className="px-3 py-2.5">RUN</th>
                    <th className="px-3 py-2.5">Docente</th>
                    <th className="px-3 py-2.5">Función Principal</th>
                    <th className="px-3 py-2.5">Sector / Subsector</th>
                    <th className="px-3 py-2.5 text-center">Contrato</th>
                    <th className="px-3 py-2.5 text-center">H. Directivas</th>
                    <th className="px-3 py-2.5 text-center">H. Técnicas</th>
                    <th className="px-3 py-2.5 text-center">H. Aula</th>
                    <th className="px-3 py-2.5 text-center">Idoneidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultadoDocentes.filas.map((f, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-3 py-2 font-mono text-[11px] font-bold text-slate-800">
                        {f.rbd}
                        <span className="block text-[9px] font-normal text-slate-400 truncate max-w-[120px]">{f.nombreEstablecimiento}</span>
                      </td>
                      <td className="px-3 py-2 font-mono font-medium">{f.runCompleto}</td>
                      <td className="px-3 py-2 font-bold text-slate-800">{f.apellidos}, {f.nombres}</td>
                      <td className="px-3 py-2 font-semibold text-purple-800">{f.funcionPrincipal}</td>
                      <td className="px-3 py-2 text-slate-600">{f.subSectorFuncion1 !== '--' ? f.subSectorFuncion1 : f.sectorFuncion1}</td>
                      <td className="px-3 py-2 text-center font-bold text-slate-800">{f.horasContrato}h</td>
                      <td className="px-3 py-2 text-center font-semibold text-purple-700">{f.horasDirectivas}h</td>
                      <td className="px-3 py-2 text-center font-semibold text-blue-700">{f.horasTecnicoPedagogica}h</td>
                      <td className="px-3 py-2 text-center font-bold text-emerald-700">{f.horasAula}h</td>
                      <td className="px-3 py-2 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {f.estadoIdoneidad}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
