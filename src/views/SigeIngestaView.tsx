import React, { useState } from 'react';
import { FileUp, Building2, Users, Clock, Award, CheckCircle2, AlertCircle } from 'lucide-react';
import { Establecimiento, ComunaValleDiguillin, RegimenJornada } from '../types';
import { parsearPlanillaSige } from '../services/sigeParserService';

interface SigeIngestaViewProps {
  onIngestarSigeCompleto: (
    establecimiento: Establecimiento,
    docentes: ReturnType<typeof parsearPlanillaSige>['docentesConvertidos']
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

export const SigeIngestaView: React.FC<SigeIngestaViewProps> = ({
  onIngestarSigeCompleto
}) => {
  const [textoPegado, setTextoPegado] = useState('');
  const [resultadoParseo, setResultadoParseo] = useState<ReturnType<typeof parsearPlanillaSige> | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [comunaSeleccionada, setComunaSeleccionada] = useState<ComunaValleDiguillin>('Bulnes');
  const [regimenSeleccionado, setRegimenSeleccionado] = useState<RegimenJornada>('JEC');
  const [prioritarios, setPrioritarios] = useState(80);
  const [cargando, setCargando] = useState(false);
  const [exitoMsg, setExitoMsg] = useState<string | null>(null);

  const procesarTexto = (contenido: string) => {
    try {
      setErrorMsg(null);
      setExitoMsg(null);
      const res = parsearPlanillaSige(contenido);
      setResultadoParseo(res);
    } catch (err: any) {
      setErrorMsg(`Error al procesar archivo SIGE: ${err.message}`);
      setResultadoParseo(null);
    }
  };

  const handleArchivoSeleccionado = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      let text = '';
      try {
        const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
        text = utf8Decoder.decode(buffer);
      } catch {
        const winDecoder = new TextDecoder('windows-1252');
        text = winDecoder.decode(buffer);
      }
      setTextoPegado(text);
      procesarTexto(text);
    } catch (err: any) {
      setErrorMsg(`Error al leer archivo: ${err.message}`);
    }
  };

  const handleConfirmarIngesta = async () => {
    if (!resultadoParseo) return;
    setCargando(true);
    try {
      const estFinal: Establecimiento = {
        id: `est-${resultadoParseo.rbdDetectado}`,
        rbd: resultadoParseo.rbdDetectado,
        nombre: resultadoParseo.nombreColegioDetectado || `Colegio RBD ${resultadoParseo.rbdDetectado}`,
        comuna: comunaSeleccionada,
        regimen: regimenSeleccionado,
        porcentajePrioritarios: prioritarios,
        asesorUatp: 'UATP SLEP Valle Diguillín'
      };

      await onIngestarSigeCompleto(estFinal, resultadoParseo.docentesConvertidos);
      setExitoMsg(`✓ Ingesta completada con éxito: Colegio ${estFinal.nombre} y ${resultadoParseo.docentesConvertidos.length} funcionarios ingresados.`);
    } catch (err: any) {
      setErrorMsg(`Error al guardar en base de datos: ${err.message}`);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner de Bienvenida Módulo SIGE */}
      <div className="bg-[#002B49] text-white p-6 rounded-xl border border-slate-700 shadow-md">
        <div className="flex items-center gap-2 text-orange-400 text-xs font-bold uppercase tracking-wider">
          <FileUp className="w-4 h-4" />
          Módulo Oficial de Ingesta SIGE MINEDUC
        </div>
        <h2 className="text-xl font-bold text-white mt-1">
          Importador Automatizado de Nómina Docente desde SIGE
        </h2>
        <p className="text-xs text-slate-300 mt-1 max-w-3xl">
          Carga directamente los archivos CSV/texto exportados desde el Sistema de Información General de Estudiantes (SIGE).
          El sistema extrae automáticamente el RBD, la nómina completa de docentes, directivos, horas técnico-pedagógicas y horas de aula.
        </p>
      </div>

      {/* Selector de Entrada: Subir Archivo o Pegar Texto */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <label className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-lg cursor-pointer shadow transition-colors">
            <FileUp className="w-4 h-4" />
            <span>Seleccionar Archivo CSV / TXT de SIGE</span>
            <input
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleArchivoSeleccionado}
            />
          </label>

          <span className="text-xs text-slate-400">o pega directamente el texto con encabezado separado por punto y coma (;)</span>
        </div>

        <div>
          <textarea
            rows={4}
            value={textoPegado}
            onChange={e => {
              setTextoPegado(e.target.value);
              if (e.target.value.includes('DOC_RUN') && e.target.value.includes('RBD')) {
                procesarTexto(e.target.value);
              }
            }}
            placeholder="Pega aquí el contenido copiado desde la exportación SIGE (ej: DOC_RUN;DOC_DV;DOC_NOMBRE;DOC_PATERNO;...)"
            className="w-full p-3 font-mono text-[11px] border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-slate-700"
          />
        </div>

        {errorMsg && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{errorMsg}</span>
          </div>
        )}

        {exitoMsg && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{exitoMsg}</span>
          </div>
        )}
      </div>

      {/* Previsualización del Colegio y Nómina Detectada */}
      {resultadoParseo && (
        <div className="space-y-6">
          {/* Tarjeta de Confirmación de Datos del Colegio */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-orange-600" />
              Establecimiento Detectado en la Planilla SIGE
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs">
              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">RBD Oficial</span>
                <span className="text-base font-black text-slate-800">{resultadoParseo.rbdDetectado}</span>
              </div>

              <div>
                <span className="text-slate-400 text-[10px] uppercase font-bold block">Nombre Colegio</span>
                <span className="font-bold text-slate-800">{resultadoParseo.nombreColegioDetectado}</span>
              </div>

              <div>
                <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Comuna Territorio *</label>
                <select
                  value={comunaSeleccionada}
                  onChange={e => setComunaSeleccionada(e.target.value as ComunaValleDiguillin)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-800"
                >
                  {COMUNAS.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-slate-500 text-[10px] uppercase font-bold block mb-1">Régimen Jornada *</label>
                <select
                  value={regimenSeleccionado}
                  onChange={e => setRegimenSeleccionado(e.target.value as RegimenJornada)}
                  className="w-full bg-white border border-slate-300 rounded px-2 py-1 font-semibold text-slate-800"
                >
                  <option value="JEC">JEC (Completa)</option>
                  <option value="No JEC">No JEC (Media)</option>
                  <option value="Mixto">Mixto (JEC y No JEC por nivel)</option>
                </select>
              </div>
            </div>

            {/* Métricas Agregadas SIGE */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
              <div className="p-3 bg-white border rounded-lg text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Total Funcionarios</div>
                <div className="text-xl font-black text-slate-800">{resultadoParseo.totales.totalDocentes}</div>
              </div>

              <div className="p-3 bg-white border rounded-lg text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Contrato</div>
                <div className="text-xl font-black text-orange-600">{resultadoParseo.totales.totalHorasContrato}h</div>
              </div>

              <div className="p-3 bg-white border rounded-lg text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Directivas</div>
                <div className="text-xl font-black text-purple-600">{resultadoParseo.totales.totalHorasDirectivas}h</div>
              </div>

              <div className="p-3 bg-white border rounded-lg text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Técnico-Pedagógicas</div>
                <div className="text-xl font-black text-blue-600">{resultadoParseo.totales.totalHorasTecnicas}h</div>
              </div>

              <div className="p-3 bg-white border rounded-lg text-center">
                <div className="text-[10px] text-slate-400 font-bold uppercase">Horas Aula Declaradas</div>
                <div className="text-xl font-black text-emerald-600">{resultadoParseo.totales.totalHorasAula}h</div>
              </div>
            </div>

            {/* Botón de Confirmación */}
            <div className="pt-2 flex justify-end">
              <button
                disabled={cargando}
                onClick={handleConfirmarIngesta}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-lg shadow-md transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{cargando ? 'Guardando en Base de Datos...' : 'Ingestar Establecimiento y Dotación a SQLite'}</span>
              </button>
            </div>
          </div>

          {/* Tabla Detalle de Docentes Previsualizados */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-orange-600" />
                Detalle de Docentes y Funcionarios a Importar ({resultadoParseo.filas.length})
              </h3>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b sticky top-0">
                  <tr>
                    <th className="px-4 py-2.5">RUN</th>
                    <th className="px-4 py-2.5">Docente</th>
                    <th className="px-4 py-2.5">Función Principal</th>
                    <th className="px-4 py-2.5">Sector / Subsector</th>
                    <th className="px-4 py-2.5 text-center">Contrato</th>
                    <th className="px-4 py-2.5 text-center">H. Directivas</th>
                    <th className="px-4 py-2.5 text-center">H. Técnicas</th>
                    <th className="px-4 py-2.5 text-center">H. Aula</th>
                    <th className="px-4 py-2.5 text-center">Idoneidad</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {resultadoParseo.filas.map((f, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono font-medium">{f.runCompleto}</td>
                      <td className="px-4 py-2 font-bold text-slate-800">{f.apellidos}, {f.nombres}</td>
                      <td className="px-4 py-2 font-semibold text-purple-800">{f.funcionPrincipal}</td>
                      <td className="px-4 py-2 text-slate-600">{f.subSectorFuncion1 !== '--' ? f.subSectorFuncion1 : f.sectorFuncion1}</td>
                      <td className="px-4 py-2 text-center font-bold text-slate-800">{f.horasContrato}h</td>
                      <td className="px-4 py-2 text-center font-semibold text-purple-700">{f.horasDirectivas}h</td>
                      <td className="px-4 py-2 text-center font-semibold text-blue-700">{f.horasTecnicoPedagogica}h</td>
                      <td className="px-4 py-2 text-center font-bold text-emerald-700">{f.horasAula}h</td>
                      <td className="px-4 py-2 text-center">
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
