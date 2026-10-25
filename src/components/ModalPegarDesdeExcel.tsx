import React, { useState } from 'react';
import {
  X, ClipboardPaste, CheckCircle2, AlertTriangle, Users,
  ArrowRight, FileSpreadsheet, Sparkles, Check
} from 'lucide-react';
import { Docente, AsistenteEducacion, EstamentoDocente, EstamentoAsistente } from '../types';
import { validarRut, normalizarRut } from '../utils/rutUtils';
import { inferirClasificacionAsistente } from '../../packages/mineduc-engine/src/calculoAsistentes';

export interface ModalPegarDesdeExcelProps {
  isOpen: boolean;
  onClose: () => void;
  tipo: 'DOCENTES' | 'ASISTENTES';
  rbd: string;
  periodoActivo: number;
  onGuardarBatch: (items: any[]) => Promise<void> | void;
}

interface RegistroParseado {
  id: string;
  run: string;
  runValido: boolean;
  nombres: string;
  apellidos: string;
  cargoOEstamento: string;
  horasContrato: number;
  horasSubvGral: number;
  horasSep: number;
  horasPie: number;
  rawText: string;
}

export const ModalPegarDesdeExcel: React.FC<ModalPegarDesdeExcelProps> = ({
  isOpen,
  onClose,
  tipo,
  rbd,
  periodoActivo,
  onGuardarBatch
}) => {
  const [textoPegado, setTextoPegado] = useState('');
  const [registros, setRegistros] = useState<RegistroParseado[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [paso, setPaso] = useState<'pegar' | 'revisar'>('pegar');

  if (!isOpen) return null;

  const procesarTexto = (texto: string) => {
    setTextoPegado(texto);
    if (!texto.trim()) {
      setRegistros([]);
      return;
    }

    const lineas = texto.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    const parseados: RegistroParseado[] = [];

    lineas.forEach((linea, idx) => {
      // Ignorar cabeceras típicas
      if (/^run|^rut|^nombre|^cargo|^horas|^estamento/i.test(linea) && idx === 0) return;

      // Separación por tabulación (copiado desde Excel) o por punto y coma / comas
      const cols = linea.includes('\t')
        ? linea.split('\t')
        : linea.includes(';')
          ? linea.split(';')
          : linea.split(',');

      const c = cols.map(item => item.trim());

      let run = '';
      let nombres = '';
      let apellidos = '';
      let cargo = tipo === 'DOCENTES' ? 'DOCENTE_AULA' : 'PARADOCENTE_INSPECTORIA';
      let horas = 44;
      let subv = 0;
      let sep = 0;
      let pie = 0;

      // Detección heurística de columnas:
      // Caso 1: [RUN, Nombres, Apellidos, Horas, Cargo...]
      // Caso 2: [RUN, Nombre Completo, Cargo, Horas...]
      if (c.length >= 2) {
        // Columna 0: RUN
        run = c[0].replace(/\./g, '').trim();

        // Columna 1: Nombre
        const partesNombre = c[1].split(' ');
        if (c.length >= 3 && isNaN(Number(c[2]))) {
          // c[1] es nombres, c[2] es apellidos
          nombres = c[1];
          apellidos = c[2];
          if (c[3] && !isNaN(Number(c[3]))) horas = Number(c[3]);
          else if (c[3]) cargo = c[3];
          if (c[4] && !isNaN(Number(c[4]))) horas = Number(c[4]);
        } else {
          // Nombre completo en c[1]
          if (partesNombre.length >= 3) {
            apellidos = `${partesNombre[partesNombre.length - 2]} ${partesNombre[partesNombre.length - 1]}`;
            nombres = partesNombre.slice(0, partesNombre.length - 2).join(' ');
          } else if (partesNombre.length === 2) {
            nombres = partesNombre[0];
            apellidos = partesNombre[1];
          } else {
            nombres = c[1];
          }
          if (c[2] && isNaN(Number(c[2]))) cargo = c[2];
          else if (c[2] && !isNaN(Number(c[2]))) horas = Number(c[2]);

          if (c[3] && !isNaN(Number(c[3]))) horas = Number(c[3]);
        }

        // Subvención, SEP, PIE si existen en columnas subsiguientes
        if (c[4] && !isNaN(Number(c[4]))) subv = Number(c[4]);
        if (c[5] && !isNaN(Number(c[5]))) sep = Number(c[5]);
        if (c[6] && !isNaN(Number(c[6]))) pie = Number(c[6]);
      }

      const runNormalizado = normalizarRut(run);
      const runValido = validarRut(runNormalizado);

      if (nombres || run) {
        parseados.push({
          id: `batch_${Date.now()}_${idx}`,
          run: runNormalizado || run,
          runValido,
          nombres: nombres || 'Funcionario',
          apellidos: apellidos || '',
          cargoOEstamento: cargo,
          horasContrato: horas > 0 ? horas : 44,
          horasSubvGral: subv,
          horasSep: sep,
          horasPie: pie,
          rawText: linea
        });
      }
    });

    setRegistros(parseados);
  };

  const handleConfirmarGuardar = async () => {
    if (registros.length === 0) return;
    try {
      setGuardando(true);

      if (tipo === 'DOCENTES') {
        const payloadDocentes: Docente[] = registros.map(r => ({
          id: `doc_${rbd}_${r.run.replace(/[^0-9kK]/g, '')}_${Date.now()}`,
          rbd,
          periodo: periodoActivo,
          run: r.run,
          nombres: r.nombres,
          apellidos: r.apellidos,
          estamento: (r.cargoOEstamento as EstamentoDocente) || 'DOCENTE_AULA',
          calidadJuridica: 'TITULAR',
          horasContrato: r.horasContrato,
          horasSubvencionGeneralTitular: r.horasSubvGral || (r.horasSep === 0 && r.horasPie === 0 ? r.horasContrato : 0),
          horasSubvencionGeneralContrata: 0,
          horasSepTitular: r.horasSep,
          horasSepContrata: 0,
          horasPieTitular: r.horasPie,
          horasPieContrata: 0,
          activo: true
        }));
        await onGuardarBatch(payloadDocentes);
      } else {
        const payloadAsistentes: AsistenteEducacion[] = registros.map(r => {
          const inferencia = inferirClasificacionAsistente(r.cargoOEstamento);
          return {
            id: `asist_${rbd}_${r.run.replace(/[^0-9kK]/g, '')}_${Date.now()}`,
            rbd,
            periodo: periodoActivo,
            run: r.run,
            nombres: r.nombres,
            apellidos: r.apellidos,
            cargoFuncion: r.cargoOEstamento,
            estamento: inferencia.estamento as EstamentoAsistente,
            horasContrato: r.horasContrato,
            horasSubvencionGeneralIndefinido: r.horasSubvGral || (r.horasSep === 0 && r.horasPie === 0 ? r.horasContrato : 0),
            horasSubvencionGeneralPlazoFijo: 0,
            horasSepIndefinido: r.horasSep,
            horasSepPlazoFijo: 0,
            horasPieIndefinido: r.horasPie,
            horasPiePlazoFijo: 0,
            esDuplaPsicosocial: inferencia.esDuplaPsicosocial,
            esEquipoPie: inferencia.esEquipoPie,
            esTecnicoParvulo: inferencia.esTecnicoParvulo,
            esAuxiliarServicio: inferencia.esAuxiliarServicio,
            esInspectorPatio: inferencia.esInspectorPatio,
            activo: true
          };
        });
        await onGuardarBatch(payloadAsistentes);
      }

      onClose();
    } catch (err: any) {
      alert(`Error al guardar registros en lote: ${err.message || err}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-3xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Cabecera */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-orange-400">
              <ClipboardPaste className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">
                Importación Rápida: Pegar {tipo === 'DOCENTES' ? 'Docentes' : 'Asistentes'} desde Excel
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Copia las filas de tu archivo Excel o planilla SIGE y pégalas directamente aquí abajo
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {paso === 'pegar' ? (
            <div className="space-y-3">
              <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 p-3 rounded-xl text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong>Formato sugerido de columnas en Excel:</strong>
                  <div className="font-mono text-[11px] bg-white/80 dark:bg-black/30 p-1.5 rounded border border-amber-200 dark:border-amber-900">
                    Columna 1: RUN | Columna 2: Nombre Completo | Columna 3: Cargo o Función | Columna 4: Horas Contrato
                  </div>
                </div>
              </div>

              <textarea
                value={textoPegado}
                onChange={(e) => procesarTexto(e.target.value)}
                placeholder="Haz clic aquí y presiona Ctrl + V para pegar tus filas de Excel..."
                rows={10}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-2xl p-4 text-xs font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 outline-none"
              />

              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Registros detectados: <strong>{registros.length}</strong></span>
                {registros.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaso('revisar')}
                    className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-bold shadow-sm transition-all"
                  >
                    <span>Previsualizar y Corregir ({registros.length})</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Previsualización de {registros.length} registros listos para ingresar:
                </span>
                <button
                  type="button"
                  onClick={() => setPaso('pegar')}
                  className="text-xs text-orange-600 font-bold hover:underline"
                >
                  ← Volver a pegar texto
                </button>
              </div>

              <div className="max-h-72 overflow-y-auto border border-slate-200 dark:border-slate-800 rounded-xl">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase border-b">
                    <tr>
                      <th className="px-3 py-2">RUN</th>
                      <th className="px-3 py-2">Nombres y Apellidos</th>
                      <th className="px-3 py-2">Cargo / Estamento</th>
                      <th className="px-3 py-2 text-center">Horas</th>
                      <th className="px-3 py-2 text-center">Estado RUN</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    {registros.map((r, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/60">
                        <td className="px-3 py-2 font-mono">{r.run}</td>
                        <td className="px-3 py-2 font-semibold text-slate-900 dark:text-white">
                          {r.nombres} {r.apellidos}
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.cargoOEstamento}</td>
                        <td className="px-3 py-2 text-center font-bold text-slate-800 dark:text-white">
                          {r.horasContrato}h
                        </td>
                        <td className="px-3 py-2 text-center">
                          {r.runValido ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 font-bold">
                              <CheckCircle2 className="w-3 h-3" /> Válido
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 font-bold">
                              <AlertTriangle className="w-3 h-3" /> Revisar
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors"
          >
            Cancelar
          </button>

          {paso === 'revisar' && (
            <button
              type="button"
              onClick={handleConfirmarGuardar}
              disabled={guardando || registros.length === 0}
              className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all disabled:opacity-50"
            >
              {guardando ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              <span>Confirmar y Guardar {registros.length} Registros</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
