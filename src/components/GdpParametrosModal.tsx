import React, { useState } from 'react';
import { X, FileSpreadsheet, Download, DollarSign, Users, ShieldCheck, Check, Sparkles } from 'lucide-react';
import { Establecimiento, Docente, AsistenteEducacion, CursoSae, AsignacionHoraria } from '../types';
import { generarExcelGdpColegio } from '../services/depGdpExportService';
import { guardarArchivoNativoOEnNavegador } from '../services/excelReportService';

interface GdpParametrosModalProps {
  isOpen: boolean;
  onClose: () => void;
  establecimiento: Establecimiento;
  docentes: Docente[];
  asistentes: AsistenteEducacion[];
  cursos?: CursoSae[];
  asignaciones?: AsignacionHoraria[];
  onGuardarEstablecimiento: (est: Establecimiento) => Promise<void>;
  onNotificar?: (mensaje: string, tipo?: 'success' | 'error') => void;
}

export const GdpParametrosModal: React.FC<GdpParametrosModalProps> = ({
  isOpen,
  onClose,
  establecimiento,
  docentes,
  asistentes,
  cursos = [],
  asignaciones = [],
  onGuardarEstablecimiento,
  onNotificar
}) => {
  const [subvSep, setSubvSep] = useState<number>(establecimiento.subvencionSepMensual || 0);
  const [subvProRet, setSubvProRet] = useState<number>(establecimiento.subvencionProRetencion || 0);
  const [cupoPieDoc, setCupoPieDoc] = useState<number>(establecimiento.cupoHorasPieDiferencial || 0);
  const [cupoPieAe, setCupoPieAe] = useState<number>(establecimiento.cupoHorasPieAsistentes || 0);
  const [guardando, setGuardando] = useState(false);
  const [exportando, setExportando] = useState(false);

  if (!isOpen) return null;

  // Cálculos automáticos de referencia para asistir al usuario
  const docPieHoras = docentes
    .filter(d => (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0) > 0) || d.estamento === 'DOCENTE_DIFERENCIAL')
    .reduce((s, d) => s + (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0) || d.horasContrato || 0), 0);

  const aePieHoras = asistentes
    .filter(a => (Number(a.horasPieIndefinido || 0) + Number(a.horasPiePlazoFijo || 0) > 0) || a.esEquipoPie)
    .reduce((s, a) => s + (Number(a.horasPieIndefinido || 0) + Number(a.horasPiePlazoFijo || 0) || a.horasContrato || 0), 0);

  const handleAutoCompletarCupos = () => {
    setCupoPieDoc(docPieHoras);
    setCupoPieAe(aePieHoras);
  };

  const handleGuardar = async () => {
    try {
      setGuardando(true);
      const updated: Establecimiento = {
        ...establecimiento,
        subvencionSepMensual: subvSep,
        subvencionProRetencion: subvProRet,
        cupoHorasPieDiferencial: cupoPieDoc,
        cupoHorasPieAsistentes: cupoPieAe
      };
      await onGuardarEstablecimiento(updated);
      onNotificar?.('Parámetros GDP del establecimiento actualizados correctamente.', 'success');
      onClose();
    } catch (e: any) {
      onNotificar?.(`Error al guardar: ${e.message || e}`, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const handleExportarGdp = async () => {
    try {
      setExportando(true);
      const estActualizado: Establecimiento = {
        ...establecimiento,
        subvencionSepMensual: subvSep,
        subvencionProRetencion: subvProRet,
        cupoHorasPieDiferencial: cupoPieDoc || docPieHoras,
        cupoHorasPieAsistentes: cupoPieAe || aePieHoras
      };

      const bytes = await generarExcelGdpColegio(
        estActualizado,
        docentes,
        asistentes,
        cursos,
        asignaciones
      );

      const nombreLimpio = establecimiento.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
      const filename = `Planilla_GDP_${nombreLimpio}_RBD_${establecimiento.rbd}_2026.xlsx`;

      await guardarArchivoNativoOEnNavegador(
        bytes,
        filename,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        [{ name: 'Planilla Oficial GDP Microsoft Excel', extensions: ['xlsx'] }]
      );

      onNotificar?.(`✓ Planilla GDP de ${establecimiento.nombre} generada con éxito (6 hojas completas).`, 'success');
    } catch (e: any) {
      onNotificar?.(`Error al exportar Planilla GDP: ${e.message || e}`, 'error');
    } finally {
      setExportando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col">
        {/* Cabecera */}
        <div className="bg-gradient-to-r from-[#002B49] to-slate-800 p-6 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-orange-500/20 rounded-xl border border-orange-500/30 text-orange-400">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-orange-600/30 text-orange-300 border border-orange-500/40">
                Sanción y Presupuesto SLEP
              </div>
              <h3 className="text-lg font-bold text-white mt-1">
                Planilla GDP: {establecimiento.nombre}
              </h3>
              <p className="text-xs text-slate-300">
                RBD: {establecimiento.rbd} • Comuna: {establecimiento.comuna}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Contenido / Formulario */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 p-4 rounded-xl text-xs text-amber-800 dark:text-amber-200 flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 flex-shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div>
              <p className="font-bold">Fórmulas Nativas Preservadas:</p>
              <p className="mt-0.5">
                Al exportar, la aplicación respetará al milímetro todas las fórmulas de Excel predefinidas por la DEP en las 6 hojas (`PIE`, `SEP`, `Subv. Normal Titulares`, `Contrata`, `AA.EE` y `Pro-Retención`). Estos parámetros alimentan las celdas clave de cabecera.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Subvención SEP Mensual (D4) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Subvención SEP Mensual (Agosto)
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">Alimenta la celda D4 de la hoja SEP para calcular % de inversión.</p>
              <div className="relative mt-2">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  value={subvSep || ''}
                  onChange={(e) => setSubvSep(Number(e.target.value) || 0)}
                  placeholder="Ej: 15000000"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 font-semibold"
                />
              </div>
            </div>

            {/* Subvención Pro-Retención Anual (D4) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Fondo Pro-Retención Disponible
              </label>
              <p className="text-[11px] text-slate-500 mt-0.5">Alimenta la celda D4 de la hoja Pro-Retención.</p>
              <div className="relative mt-2">
                <DollarSign className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  value={subvProRet || ''}
                  onChange={(e) => setSubvProRet(Number(e.target.value) || 0)}
                  placeholder="Ej: 3500000"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 font-semibold"
                />
              </div>
            </div>

            {/* Cupo Horas Docentes PIE (F4) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Cupo Horas Docentes PIE (F4)
                </label>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                  Docentes: {docPieHoras} hrs
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Total de horas asignadas Dto. 170 (Celda F4).</p>
              <div className="relative mt-2">
                <Users className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  value={cupoPieDoc || ''}
                  onChange={(e) => setCupoPieDoc(Number(e.target.value) || 0)}
                  placeholder={`Sugerido: ${docPieHoras}`}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 font-semibold"
                />
              </div>
            </div>

            {/* Cupo Horas Asistentes PIE (F39) */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                  Cupo Asistentes PIE (F39)
                </label>
                <span className="text-[10px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                  Asistentes: {aePieHoras} hrs
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Total horas asistentes PIE (Celda F39).</p>
              <div className="relative mt-2">
                <Users className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="number"
                  value={cupoPieAe || ''}
                  onChange={(e) => setCupoPieAe(Number(e.target.value) || 0)}
                  placeholder={`Sugerido: ${aePieHoras}`}
                  className="w-full pl-9 pr-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-orange-500 font-semibold"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAutoCompletarCupos}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Sugerir cupos PIE a partir de la nómina actual
            </button>
          </div>
        </div>

        {/* Barra de Acciones */}
        <div className="p-4 bg-slate-100 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Cerrar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleGuardar}
              disabled={guardando}
              className="px-4 py-2 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              {guardando ? 'Guardando...' : 'Guardar Parámetros'}
            </button>

            <button
              type="button"
              onClick={handleExportarGdp}
              disabled={exportando}
              className="px-5 py-2 text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white rounded-lg shadow-md hover:shadow-orange-500/20 transition-all flex items-center gap-1.5"
            >
              <Download className="w-3.5 h-3.5" />
              {exportando ? 'Generando Excel...' : 'Exportar Planilla GDP (.xlsx)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
