import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Search,
  Filter,
  Users,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Download,
  Database,
  Loader2,
  Briefcase,
  HelpCircle,
  Clock,
  HeartHandshake,
  ShieldCheck,
  Edit2,
  Check,
  X,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  AsistenteAnalizadoRecord,
  clasificarAsistentesConIa,
  RawAsistenteInput
} from '../../services/analizador/asistentesClassifier';
import { AsistenteEducacion, EstamentoAsistente, Establecimiento } from '../../types';
import { guardarAsistentesBatch, listarEstablecimientos, guardarEstablecimiento } from '../../database/db';
import { LevantamientoCoeficienteModal } from './LevantamientoCoeficienteModal';

export interface AsistentesAnalizadorViewProps {
  asistentes: AsistenteAnalizadoRecord[];
  apiKey: string;
  selectedModel: string;
  onUpdateAsistentes: (actualizados: AsistenteAnalizadoRecord[]) => void;
  onSyncWithDatabase?: () => Promise<void>;
  onNavigateToColegio?: (rbd: string, tab?: string) => void;
  onOpenApiKeyModal: () => void;
}

const ESTAMENTO_COLORS: Record<EstamentoAsistente, { label: string; bg: string; text: string; border: string }> = {
  PROFESIONAL: {
    label: 'Profesional',
    bg: 'bg-purple-50 dark:bg-purple-950/40',
    text: 'text-purple-700 dark:text-purple-300',
    border: 'border-purple-200 dark:border-purple-800'
  },
  TECNICO: {
    label: 'Técnico',
    bg: 'bg-blue-50 dark:bg-blue-950/40',
    text: 'text-blue-700 dark:text-blue-300',
    border: 'border-blue-200 dark:border-blue-800'
  },
  ADMINISTRATIVO: {
    label: 'Administrativo',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    border: 'border-slate-200 dark:border-slate-700'
  },
  AUXILIAR: {
    label: 'Auxiliar de Servicios',
    bg: 'bg-amber-50 dark:bg-amber-950/40',
    text: 'text-amber-700 dark:text-amber-300',
    border: 'border-amber-200 dark:border-amber-800'
  },
  PARADOCENTE_INSPECTORIA: {
    label: 'Paradocente / Inspectoría',
    bg: 'bg-emerald-50 dark:bg-emerald-950/40',
    text: 'text-emerald-700 dark:text-emerald-300',
    border: 'border-emerald-200 dark:border-emerald-800'
  }
};

export const AsistentesAnalizadorView: React.FC<AsistentesAnalizadorViewProps> = ({
  asistentes,
  apiKey,
  selectedModel,
  onUpdateAsistentes,
  onSyncWithDatabase,
  onNavigateToColegio,
  onOpenApiKeyModal
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstamento, setFiltroEstamento] = useState<string>('TODOS');
  const [filtroCuadratura, setFiltroCuadratura] = useState<string>('TODOS');
  const [filtroColegio, setFiltroColegio] = useState<string>('TODOS');
  const [isClassifyingAi, setIsClassifyingAi] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [isSavingDb, setIsSavingDb] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isLevantamientoModalOpen, setIsLevantamientoModalOpen] = useState(false);

  // Modal de edición rápida
  const [asistenteEdicion, setAsistenteEdicion] = useState<AsistenteAnalizadoRecord | null>(null);

  const colegiosUnicos = useMemo(() => {
    const map = new Map<string, { rbd: string; nombre: string }>();
    asistentes.forEach((a) => {
      if (a.rbd && !map.has(a.rbd)) {
        map.set(a.rbd, { rbd: a.rbd, nombre: a.establishment || `RBD ${a.rbd}` });
      }
    });
    return Array.from(map.values());
  }, [asistentes]);

  const filtrados = useMemo(() => {
    return asistentes.filter((a) => {
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const str = `${a.run} ${a.nombres} ${a.apellidos} ${a.cargo_original} ${a.cargo_estandar} ${a.observaciones_ia || ''} ${a.establishment}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      if (filtroEstamento !== 'TODOS' && a.estamento !== filtroEstamento) return false;
      if (filtroCuadratura !== 'TODOS' && a.estado_cuadratura !== filtroCuadratura) return false;
      if (filtroColegio !== 'TODOS' && a.rbd !== filtroColegio) return false;
      return true;
    });
  }, [asistentes, busqueda, filtroEstamento, filtroCuadratura, filtroColegio]);

  // Resumen métrico
  const totalHoras = useMemo(() => asistentes.reduce((acc, a) => acc + (a.horas_contrato || 0), 0), [asistentes]);
  const totalIa = useMemo(() => asistentes.filter((a) => a.fuente_clasificacion === 'IA_GEMINI').length, [asistentes]);
  const duplasCount = useMemo(() => asistentes.filter((a) => a.es_dupla_psicosocial).length, [asistentes]);
  const pieCount = useMemo(() => asistentes.filter((a) => a.es_equipo_pie).length, [asistentes]);
  const descuadresCount = useMemo(() => asistentes.filter((a) => a.estado_cuadratura !== 'CUADRADA').length, [asistentes]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleClasificarConIa = async () => {
    if (!apiKey) {
      onOpenApiKeyModal();
      return;
    }

    setIsClassifyingAi(true);
    setProgress({ current: 0, total: asistentes.length });

    try {
      const inputs: RawAsistenteInput[] = asistentes.map((a) => ({
        id: a.id,
        rbd: a.rbd,
        establishment: a.establishment,
        comuna: a.comuna,
        file_name: a.file_name,
        run: a.run,
        nombres: a.nombres,
        apellidos: a.apellidos,
        cargo_original: a.cargo_original,
        horas_contrato: a.horas_contrato,
        horas_subvencion_general_indefinido: a.horas_subvencion_general_indefinido,
        horas_subvencion_general_plazo_fijo: a.horas_subvencion_general_plazo_fijo,
        horas_sep_indefinido: a.horas_sep_indefinido,
        horas_sep_plazo_fijo: a.horas_sep_plazo_fijo,
        horas_pie_indefinido: a.horas_pie_indefinido,
        horas_pie_plazo_fijo: a.horas_pie_plazo_fijo,
        observaciones_originales: a.observaciones_originales || a.observaciones_ia,
      }));

      const enriquecidos = await clasificarAsistentesConIa(
        inputs,
        apiKey,
        selectedModel,
        undefined,
        (current, total) => setProgress({ current, total })
      );

      onUpdateAsistentes(enriquecidos);
      showToast(`¡Auditoría IA completada! Se clasificaron y ordenaron las notas de ${enriquecidos.length} asistentes.`);
    } catch (e: any) {
      showToast(`Error durante clasificación IA: ${e.message}`, 'error');
    } finally {
      setIsClassifyingAi(false);
      setProgress(null);
    }
  };

  const [lastSavedRbd, setLastSavedRbd] = useState<string | null>(null);

  const handleGuardarEnBaseDatos = async () => {
    if (asistentes.length === 0) return;
    setIsSavingDb(true);

    try {
      const existingColegios = await listarEstablecimientos();
      const existingRbdSet = new Set(existingColegios.map((c) => c.rbd));

      // Agrupar asistentes por RBD
      const mapPorRbd = new Map<string, AsistenteEducacion[]>();

      for (const a of asistentes) {
        // Asegurar que el colegio exista
        if (a.rbd && !existingRbdSet.has(a.rbd)) {
          await guardarEstablecimiento({
            id: `est-${a.rbd}`,
            rbd: a.rbd,
            nombre: a.establishment || `Establecimiento RBD ${a.rbd}`,
            comuna: (a.comuna as any) || 'Chillán',
            regimen: 'JEC',
            porcentajePrioritarios: 75,
          });
          existingRbdSet.add(a.rbd);
        }

        const item: AsistenteEducacion = {
          id: a.id,
          rbd: a.rbd,
          periodo: 2027,
          run: a.run,
          nombres: a.nombres,
          apellidos: a.apellidos,
          cargoFuncion: a.cargo_estandar || a.cargo_original,
          estamento: a.estamento,
          horasContrato: a.horas_contrato,
          horasSubvencionGeneralIndefinido: a.horas_subvencion_general_indefinido,
          horasSubvencionGeneralPlazoFijo: a.horas_subvencion_general_plazo_fijo,
          horasSepIndefinido: a.horas_sep_indefinido,
          horasSepPlazoFijo: a.horas_sep_plazo_fijo,
          horasPieIndefinido: a.horas_pie_indefinido,
          horasPiePlazoFijo: a.horas_pie_plazo_fijo,
          esDuplaPsicosocial: a.es_dupla_psicosocial,
          esEquipoPie: a.es_equipo_pie,
          esTecnicoParvulo: a.es_tecnico_parvulo,
          esAuxiliarServicio: a.es_auxiliar_servicio,
          esInspectorPatio: a.es_inspector_patio,
          observaciones: a.observaciones_ia || a.observaciones_originales,
          activo: true
        };

        if (!mapPorRbd.has(a.rbd)) {
          mapPorRbd.set(a.rbd, []);
        }
        mapPorRbd.get(a.rbd)!.push(item);
      }

      for (const [rbd, lista] of mapPorRbd.entries()) {
        await guardarAsistentesBatch(lista, rbd, 2027, true);
      }

      if (onSyncWithDatabase) {
        await onSyncWithDatabase();
      }

      const primerRbd = mapPorRbd.keys().next().value || null;
      setLastSavedRbd(primerRbd);
      showToast(`¡Traspaso exitoso! Se guardaron ${asistentes.length} asistentes en SQLite (Período 2027).`);
    } catch (e: any) {
      showToast(`Error al guardar en base de datos: ${e.message}`, 'error');
    } finally {
      setIsSavingDb(false);
    }
  };

  const handleExportarExcel = () => {
    const data = filtrados.map((a) => ({
      RBD: a.rbd,
      Establecimiento: a.establishment,
      Comuna: a.comuna || '',
      RUN: a.run,
      Nombres: a.nombres,
      Apellidos: a.apellidos,
      'Cargo Original': a.cargo_original,
      'Cargo Estandarizado (IA)': a.cargo_estandar,
      Estamento: ESTAMENTO_COLORS[a.estamento]?.label || a.estamento,
      'Horas Contrato': a.horas_contrato,
      'Subv. Gral Indefinido': a.horas_subvencion_general_indefinido,
      'Subv. Gral Plazo Fijo': a.horas_subvencion_general_plazo_fijo,
      'SEP Indefinido': a.horas_sep_indefinido,
      'SEP Plazo Fijo': a.horas_sep_plazo_fijo,
      'PIE Indefinido': a.horas_pie_indefinido,
      'PIE Plazo Fijo': a.horas_pie_plazo_fijo,
      'Dupla Psicosocial': a.es_dupla_psicosocial ? 'SÍ' : 'NO',
      'Equipo PIE': a.es_equipo_pie ? 'SÍ' : 'NO',
      'Técnico Párvulos': a.es_tecnico_parvulo ? 'SÍ' : 'NO',
      'Auxiliar Servicio': a.es_auxiliar_servicio ? 'SÍ' : 'NO',
      'Inspector Patio': a.es_inspector_patio ? 'SÍ' : 'NO',
      'Observaciones IA / Notas': a.observaciones_ia || '',
      'Justificación IA': a.justificacion_ia || '',
      'Confianza IA': a.confianza_ia,
      'Fuente Clasificación': a.fuente_clasificacion,
      'Estado Cuadratura': a.estado_cuadratura
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistentes_Analizador');
    XLSX.writeFile(wb, `Analisis_Asistentes_SLEP_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleGuardarEdicionManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (!asistenteEdicion) return;

    const actualizados = asistentes.map((a) => (a.id === asistenteEdicion.id ? asistenteEdicion : a));
    onUpdateAsistentes(actualizados);
    setAsistenteEdicion(null);
    showToast('Registro de asistente actualizado manualmente.');
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 shadow-lg border transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
            <span className="text-sm font-semibold">{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Cockpit Bento de Tarjetas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Asistentes */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Asistentes Ingeridos
            </span>
            <span className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {asistentes.length}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ({totalHoras} hrs contratadas)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-slate-400" />
            <span>{colegiosUnicos.length} Establecimientos detectados</span>
          </div>
        </div>

        {/* Clasificación IA Gemini */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Auditoría con IA
            </span>
            <span className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-600">
              <Sparkles className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-purple-700 dark:text-purple-300">
              {totalIa}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              de {asistentes.length} auditados con IA
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Modelo activo: <strong className="text-slate-700 dark:text-slate-300">{selectedModel}</strong>
          </div>
        </div>

        {/* Duplas SEP y Especialistas PIE */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Duplas SEP & PIE
            </span>
            <span className="p-2 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-600">
              <HeartHandshake className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <div>
              <span className="text-2xl font-black text-pink-700 dark:text-pink-300">{duplasCount}</span>
              <span className="text-[10px] font-bold text-slate-400 block">Duplas SEP</span>
            </div>
            <div className="h-8 w-px bg-slate-200 dark:bg-slate-800" />
            <div>
              <span className="text-2xl font-black text-teal-700 dark:text-teal-300">{pieCount}</span>
              <span className="text-[10px] font-bold text-slate-400 block">Especialistas PIE</span>
            </div>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            Fonoaudiólogos, Terapeutas, Psicólogos
          </div>
        </div>

        {/* Estado de Cuadratura & Alertas */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cuadratura Horaria
            </span>
            <span
              className={`p-2 rounded-xl ${
                descuadresCount > 0
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-600'
                  : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600'
              }`}
            >
              {descuadresCount > 0 ? <AlertTriangle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span
              className={`text-3xl font-black ${
                descuadresCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {descuadresCount === 0 ? '100% OK' : `${descuadresCount} alertas`}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {descuadresCount === 0
              ? 'Todas las fuentes cuadran con las horas de contrato'
              : 'Revisa las alertas de exceso o descuadre'}
          </div>
        </div>
      </div>

      {/* Barra de Controles y Filtros */}
      <div className="card-elevated p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto flex-1 flex-wrap">
          {/* Búsqueda */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por RUN, nombre, cargo o notas IA..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

          {/* Filtro Colegio */}
          {colegiosUnicos.length > 1 && (
            <select
              value={filtroColegio}
              onChange={(e) => setFiltroColegio(e.target.value)}
              className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-medium"
            >
              <option value="TODOS">Todos los Colegios ({colegiosUnicos.length})</option>
              {colegiosUnicos.map((c) => (
                <option key={c.rbd} value={c.rbd}>
                  {c.nombre} (RBD {c.rbd})
                </option>
              ))}
            </select>
          )}

          {/* Filtro Estamento */}
          <select
            value={filtroEstamento}
            onChange={(e) => setFiltroEstamento(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-medium"
          >
            <option value="TODOS">Todos los Estamentos</option>
            <option value="PROFESIONAL">Profesionales</option>
            <option value="TECNICO">Técnicos</option>
            <option value="ADMINISTRATIVO">Administrativos</option>
            <option value="AUXILIAR">Auxiliares de Servicio</option>
            <option value="PARADOCENTE_INSPECTORIA">Paradocentes / Inspectoría</option>
          </select>

          {/* Filtro Cuadratura */}
          <select
            value={filtroCuadratura}
            onChange={(e) => setFiltroCuadratura(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-medium"
          >
            <option value="TODOS">Todas las Cuadraturas</option>
            <option value="CUADRADA">Cuadradas (OK)</option>
            <option value="DESCUADRADA">Descuadradas</option>
            <option value="EXCESO_LEGAL">Exceso Legal (&gt;44h)</option>
          </select>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          {/* Botón Clasificar con IA Gemini */}
          <button
            onClick={handleClasificarConIa}
            disabled={isClassifyingAi || asistentes.length === 0}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/25 flex items-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
            title="Usar IA Gemini para ordenar notas, resolver cargos complejos y estructurar estamentos"
          >
            {isClassifyingAi ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                <span>
                  Clasificando con IA {progress ? `(${progress.current}/${progress.total})` : '...'}
                </span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Auditar y Clasificar con IA</span>
              </>
            )}
          </button>

          {/* Botón Sincronizar Base de Datos */}
          <button
            onClick={handleGuardarEnBaseDatos}
            disabled={isSavingDb || asistentes.length === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-500/25 flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
            title="Guardar asistentes procesados directamente en la base de datos SQLite"
          >
            {isSavingDb ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Guardando...</span>
              </>
            ) : (
              <>
                <Database className="w-3.5 h-3.5" />
                <span>Traspasar a SQLite</span>
              </>
            )}
          </button>

          {/* Botón Ir a Dotación Escolar */}
          {onNavigateToColegio && (filtroColegio !== 'TODOS' || lastSavedRbd) && (
            <button
              onClick={() => {
                const targetRbd = filtroColegio !== 'TODOS' ? filtroColegio : lastSavedRbd!;
                onNavigateToColegio(targetRbd, 'asistentes');
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-md shadow-orange-500/25 flex items-center gap-1.5 transition-all active:scale-[0.98]"
              title={`Ir a la Dotación de Asistentes del RBD ${filtroColegio !== 'TODOS' ? filtroColegio : lastSavedRbd}`}
            >
              <Briefcase className="w-3.5 h-3.5 text-amber-200" />
              <span>Ver en Dotación (RBD {filtroColegio !== 'TODOS' ? filtroColegio : lastSavedRbd})</span>
            </button>
          )}

          {/* Botón Levantamiento Coeficiente Oficial */}
          <button
            onClick={() => setIsLevantamientoModalOpen(true)}
            disabled={asistentes.length === 0}
            className="px-3.5 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
            title="Generar la Planilla Oficial de Levantamiento de Coeficientes de Asistentes para Establecimientos Educacionales"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-orange-300" />
            <span>Levantamiento Coeficiente Oficial</span>
          </button>

          {/* Botón Exportar */}
          <button
            onClick={handleExportarExcel}
            disabled={asistentes.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors disabled:opacity-50"
            title="Descargar matriz en Excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Excel</span>
          </button>
        </div>
      </div>

      {/* Tabla de Asistentes Analizados */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Funcionario / Establecimiento</th>
                <th className="py-3 px-4">Cargo Original $\rightarrow$ Normalizado IA</th>
                <th className="py-3 px-4">Estamento</th>
                <th className="py-3 px-4 text-center">Horas Contrato</th>
                <th className="py-3 px-4 text-center">Subv. Gral (Ind/PF)</th>
                <th className="py-3 px-4 text-center">SEP (Ind/PF)</th>
                <th className="py-3 px-4 text-center">PIE (Ind/PF)</th>
                <th className="py-3 px-4">Notas &amp; Dictamen IA</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtrados.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">No se encontraron registros de asistentes</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Carga una planilla Excel que contenga la hoja "Asistentes" en la pestaña de Carga.
                    </p>
                  </td>
                </tr>
              ) : (
                filtrados.map((a) => {
                  const estStyle = ESTAMENTO_COLORS[a.estamento] || ESTAMENTO_COLORS.PARADOCENTE_INSPECTORIA;

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group">
                      {/* Funcionario y Establecimiento */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {a.apellidos ? `${a.apellidos}, ${a.nombres}` : a.nombres}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] font-mono text-slate-400">{a.run || 'Sin RUN'}</span>
                          <span className="text-slate-300 dark:text-slate-700">•</span>
                          <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">
                            {a.establishment} (RBD {a.rbd})
                          </span>
                        </div>
                      </td>

                      {/* Cargo original vs estandarizado */}
                      <td className="py-3 px-4 max-w-[200px]">
                        <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                          <span>{a.cargo_estandar}</span>
                          {a.fuente_clasificacion === 'IA_GEMINI' && (
                            <span title="Normalizado por Google Gemini IA">
                              <Sparkles className="w-3 h-3 text-purple-600 inline shrink-0" />
                            </span>
                          )}
                        </div>
                        {a.cargo_original !== a.cargo_estandar && (
                          <div className="text-[10px] text-slate-400 truncate mt-0.5" title={`Original: ${a.cargo_original}`}>
                            Orig: {a.cargo_original}
                          </div>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {a.es_dupla_psicosocial && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
                              Dupla SEP
                            </span>
                          )}
                          {a.es_equipo_pie && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              PIE
                            </span>
                          )}
                          {a.es_tecnico_parvulo && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              Párvulos
                            </span>
                          )}
                          {a.es_auxiliar_servicio && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              Auxiliar
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Estamento */}
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-bold border ${estStyle.bg} ${estStyle.text} ${estStyle.border}`}
                        >
                          {estStyle.label}
                        </span>
                      </td>

                      {/* Horas Contrato */}
                      <td className="py-3 px-4 text-center font-mono font-black text-sm text-slate-900 dark:text-white">
                        <div className="flex items-center justify-center gap-1">
                          <span>{a.horas_contrato}h</span>
                          {a.estado_cuadratura === 'DESCUADRADA' && (
                            <span title="Descuadre en financiamientos">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline" />
                            </span>
                          )}
                          {a.estado_cuadratura === 'EXCESO_LEGAL' && (
                            <span title="Excede límite legal de 44 hrs">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Subv. Gral */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-slate-900 dark:text-white font-bold">
                          {a.horas_subvencion_general_indefinido}h
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-slate-500">{a.horas_subvencion_general_plazo_fijo}h</span>
                      </td>

                      {/* SEP */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-amber-700 dark:text-amber-400 font-bold">
                          {a.horas_sep_indefinido}h
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-amber-600 dark:text-amber-500">{a.horas_sep_plazo_fijo}h</span>
                      </td>

                      {/* PIE */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-purple-700 dark:text-purple-400 font-bold">
                          {a.horas_pie_indefinido}h
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-purple-600 dark:text-purple-500">{a.horas_pie_plazo_fijo}h</span>
                      </td>

                      {/* Notas y Dictamen IA */}
                      <td className="py-3 px-4 max-w-[220px]">
                        {a.observaciones_ia ? (
                          <div className="text-xs text-slate-700 dark:text-slate-300 font-medium bg-slate-50 dark:bg-slate-800/80 p-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                            {a.observaciones_ia}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic text-[11px]">Sin notas</span>
                        )}
                        {a.justificacion_ia && (
                          <div className="text-[10px] text-purple-700 dark:text-purple-300 mt-1 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{a.justificacion_ia}</span>
                          </div>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => setAsistenteEdicion(a)}
                          className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                          title="Editar manualmente clasificación o notas"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Edición Rápida */}
      {asistenteEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-orange-600" />
                <h3 className="font-black text-slate-900 dark:text-white">Editar Clasificación de Asistente</h3>
              </div>
              <button onClick={() => setAsistenteEdicion(null)} className="text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarEdicionManual} className="p-6 space-y-4 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">Nombre Completo</label>
                  <input
                    type="text"
                    disabled
                    value={`${asistenteEdicion.nombres} ${asistenteEdicion.apellidos}`}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">RUN</label>
                  <input
                    type="text"
                    disabled
                    value={asistenteEdicion.run}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Cargo Estandarizado (Normalizado)
                </label>
                <input
                  type="text"
                  required
                  value={asistenteEdicion.cargo_estandar}
                  onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, cargo_estandar: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Estamento Legal (Ley 21.109)
                </label>
                <select
                  value={asistenteEdicion.estamento}
                  onChange={(e) =>
                    setAsistenteEdicion({
                      ...asistenteEdicion,
                      estamento: e.target.value as EstamentoAsistente
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white font-bold"
                >
                  <option value="PROFESIONAL">Profesional</option>
                  <option value="TECNICO">Técnico</option>
                  <option value="ADMINISTRATIVO">Administrativo</option>
                  <option value="AUXILIAR">Auxiliar de Servicios</option>
                  <option value="PARADOCENTE_INSPECTORIA">Paradocente / Inspectoría</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Notas y Observaciones Limpias (IA)
                </label>
                <textarea
                  rows={2}
                  value={asistenteEdicion.observaciones_ia || ''}
                  onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, observaciones_ia: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setAsistenteEdicion(null)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-500/25"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Levantamiento de Coeficiente Oficial */}
      <LevantamientoCoeficienteModal
        isOpen={isLevantamientoModalOpen}
        onClose={() => setIsLevantamientoModalOpen(false)}
        asistentes={asistentes}
        apiKey={apiKey}
        selectedModel={selectedModel}
        onOpenApiKeyModal={onOpenApiKeyModal}
      />
    </div>
  );
};
