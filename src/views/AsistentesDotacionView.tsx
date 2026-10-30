import React, { useState, useMemo } from 'react';
import {
  Users, UserPlus, Search, Filter, AlertTriangle, ShieldCheck, HeartHandshake,
  Sparkles, CheckCircle2, Download, Upload, Trash2, Edit2, X, Plus, Clock,
  Briefcase, Award, Check, FileSpreadsheet, Building2, ChevronDown, ChevronUp,
  ClipboardPaste
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ModalPegarDesdeExcel } from '../components/ModalPegarDesdeExcel';
import {
  AsistenteEducacion,
  EstamentoAsistente,
  Establecimiento
} from '../types';
import {
  calcularDiagnosticoAsistentes,
  inferirClasificacionAsistente
} from '../../packages/mineduc-engine/src/calculoAsistentes';
import { parseAsistentesFromWorkbook } from '../services/analizador/asistentesParser';
import { exportarLevantamientoIndividualExcel } from '../services/analizador/asistentesLevantamientoExporter';

export interface AsistentesDotacionViewProps {
  colegio: Establecimiento;
  asistentes: AsistenteEducacion[];
  matricula?: number;
  salasParvulo?: number;
  periodoActivo?: number;
  onGuardarAsistente: (asistente: AsistenteEducacion) => Promise<void> | void;
  onGuardarAsistentesBatch?: (asistentes: AsistenteEducacion[], reemplazar?: boolean) => Promise<void> | void;
  onEliminarAsistente: (id: string) => Promise<void> | void;
}

const ESTAMENTO_LABELS: Record<EstamentoAsistente, { label: string; bg: string; text: string; border: string }> = {
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

export const AsistentesDotacionView: React.FC<AsistentesDotacionViewProps> = ({
  colegio,
  asistentes,
  matricula = 0,
  salasParvulo = 0,
  periodoActivo = 2027,
  onGuardarAsistente,
  onGuardarAsistentesBatch,
  onEliminarAsistente
}) => {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstamento, setFiltroEstamento] = useState<string>('TODOS');
  const [filtroFuente, setFiltroFuente] = useState<string>('TODAS');
  const [filtroContrato, setFiltroContrato] = useState<string>('TODOS');

  // Estado del Modal de Asistente
  const [modalAbierto, setModalAbierto] = useState(false);
  const [asistenteEdicion, setAsistenteEdicion] = useState<Partial<AsistenteEducacion> | null>(null);
  const [modalImportarAbierto, setModalImportarAbierto] = useState(false);
  const [seccionGdpAbierta, setSeccionGdpAbierta] = useState(false);
  const [archivoExcel, setArchivoExcel] = useState<File | null>(null);
  const [modalPegarAbierto, setModalPegarAbierto] = useState(false);
  const [notificacion, setNotificacion] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  const diagnostico = useMemo(() => {
    return calcularDiagnosticoAsistentes(asistentes, {
      rbd: colegio.rbd,
      periodo: periodoActivo,
      matricula,
      salasParvulo
    });
  }, [asistentes, colegio.rbd, periodoActivo, matricula, salasParvulo]);

  const asistentesFiltrados = useMemo(() => {
    return asistentes.filter((a) => {
      if (a.activo === false) return false;

      // Filtro de búsqueda
      if (busqueda.trim()) {
        const q = busqueda.toLowerCase().trim();
        const fullName = `${a.nombres} ${a.apellidos}`.toLowerCase();
        const run = (a.run || '').toLowerCase();
        const cargo = (a.cargoFuncion || '').toLowerCase();
        if (!fullName.includes(q) && !run.includes(q) && !cargo.includes(q)) {
          return false;
        }
      }

      // Filtro Estamento
      if (filtroEstamento !== 'TODOS' && a.estamento !== filtroEstamento) {
        return false;
      }

      // Filtro Fuente
      if (filtroFuente === 'SUBV_GRAL') {
        const h = (a.horasSubvencionGeneralIndefinido || 0) + (a.horasSubvencionGeneralPlazoFijo || 0);
        if (h <= 0) return false;
      } else if (filtroFuente === 'SEP') {
        const h = (a.horasSepIndefinido || 0) + (a.horasSepPlazoFijo || 0);
        if (h <= 0) return false;
      } else if (filtroFuente === 'PIE') {
        const h = (a.horasPieIndefinido || 0) + (a.horasPiePlazoFijo || 0);
        if (h <= 0) return false;
      }

      // Filtro Contrato
      if (filtroContrato === 'INDEFINIDO') {
        const hInd = (a.horasSubvencionGeneralIndefinido || 0) + (a.horasSepIndefinido || 0) + (a.horasPieIndefinido || 0);
        if (hInd <= 0) return false;
      } else if (filtroContrato === 'PLAZO_FIJO') {
        const hPf = (a.horasSubvencionGeneralPlazoFijo || 0) + (a.horasSepPlazoFijo || 0) + (a.horasPiePlazoFijo || 0);
        if (hPf <= 0) return false;
      }

      return true;
    });
  }, [asistentes, busqueda, filtroEstamento, filtroFuente, filtroContrato]);

  const abrirModalNuevo = () => {
    setAsistenteEdicion({
      id: `asist_${colegio.rbd}_${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      run: '',
      nombres: '',
      apellidos: '',
      cargoFuncion: '',
      estamento: 'PARADOCENTE_INSPECTORIA',
      horasContrato: 44,
      horasSubvencionGeneralIndefinido: 44,
      horasSubvencionGeneralPlazoFijo: 0,
      horasSepIndefinido: 0,
      horasSepPlazoFijo: 0,
      horasPieIndefinido: 0,
      horasPiePlazoFijo: 0,
      esDuplaPsicosocial: false,
      esEquipoPie: false,
      esTecnicoParvulo: false,
      esAuxiliarServicio: false,
      esInspectorPatio: false,
      activo: true
    });
    setModalAbierto(true);
  };

  const abrirModalEditar = (a: AsistenteEducacion) => {
    setAsistenteEdicion({ ...a });
    setModalAbierto(true);
  };

  const handleCargoChange = (cargo: string) => {
    if (!asistenteEdicion) return;
    const inferencia = inferirClasificacionAsistente(cargo);
    setAsistenteEdicion({
      ...asistenteEdicion,
      cargoFuncion: cargo,
      estamento: inferencia.estamento,
      esDuplaPsicosocial: inferencia.esDuplaPsicosocial,
      esEquipoPie: inferencia.esEquipoPie,
      esTecnicoParvulo: inferencia.esTecnicoParvulo,
      esAuxiliarServicio: inferencia.esAuxiliarServicio,
      esInspectorPatio: inferencia.esInspectorPatio
    });
  };

  const handleGuardarAsistente = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!asistenteEdicion) return;

    if (!asistenteEdicion.nombres?.trim() || !asistenteEdicion.cargoFuncion?.trim()) {
      setNotificacion({ tipo: 'error', mensaje: 'Debes ingresar el nombre y cargo del asistente.' });
      return;
    }

    const hGralInd = Number(asistenteEdicion.horasSubvencionGeneralIndefinido) || 0;
    const hGralPf = Number(asistenteEdicion.horasSubvencionGeneralPlazoFijo) || 0;
    const hSepInd = Number(asistenteEdicion.horasSepIndefinido) || 0;
    const hSepPf = Number(asistenteEdicion.horasSepPlazoFijo) || 0;
    const hPieInd = Number(asistenteEdicion.horasPieIndefinido) || 0;
    const hPiePf = Number(asistenteEdicion.horasPiePlazoFijo) || 0;

    const totalHoras = hGralInd + hGralPf + hSepInd + hSepPf + hPieInd + hPiePf;
    const horasContrato = Number(asistenteEdicion.horasContrato) > 0 ? Number(asistenteEdicion.horasContrato) : totalHoras;

    const payload: AsistenteEducacion = {
      id: asistenteEdicion.id || `asist_${colegio.rbd}_${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      run: asistenteEdicion.run?.trim() || 'Sin RUN',
      nombres: asistenteEdicion.nombres.trim(),
      apellidos: asistenteEdicion.apellidos?.trim() || '',
      cargoFuncion: asistenteEdicion.cargoFuncion.trim(),
      estamento: (asistenteEdicion.estamento as EstamentoAsistente) || 'PARADOCENTE_INSPECTORIA',
      horasContrato,
      horasSubvencionGeneralIndefinido: hGralInd,
      horasSubvencionGeneralPlazoFijo: hGralPf,
      horasSepIndefinido: hSepInd,
      horasSepPlazoFijo: hSepPf,
      horasPieIndefinido: hPieInd,
      horasPiePlazoFijo: hPiePf,
      esDuplaPsicosocial: !!asistenteEdicion.esDuplaPsicosocial,
      esEquipoPie: !!asistenteEdicion.esEquipoPie,
      esTecnicoParvulo: !!asistenteEdicion.esTecnicoParvulo,
      esAuxiliarServicio: !!asistenteEdicion.esAuxiliarServicio,
      esInspectorPatio: !!asistenteEdicion.esInspectorPatio,
      observaciones: asistenteEdicion.observaciones?.trim(),
      fechaInicioContrato: asistenteEdicion.fechaInicioContrato || undefined,
      fechaTerminoContrato: asistenteEdicion.fechaTerminoContrato || undefined,
      propuestaGdp: asistenteEdicion.propuestaGdp || 'Continuidad',
      remuneracionMensual: Number(asistenteEdicion.remuneracionMensual) || 0,
      accionPme: asistenteEdicion.accionPme?.trim() || undefined,
      horasProRetencion: Number(asistenteEdicion.horasProRetencion) || 0,
      horasVigentesAnterior: Number(asistenteEdicion.horasVigentesAnterior) || Number(horasContrato),
      observacionesPal: asistenteEdicion.observacionesPal?.trim() || undefined,
      activo: true
    };

    await onGuardarAsistente(payload);
    setModalAbierto(false);
    setAsistenteEdicion(null);
    setNotificacion({ tipo: 'success', mensaje: 'Asistente de la educación guardado exitosamente.' });
    setTimeout(() => setNotificacion(null), 3000);
  };

  const handleExportarExcel = () => {
    const data = asistentes.map((a) => ({
      RBD: a.rbd,
      RUN: a.run,
      Nombres: a.nombres,
      Apellidos: a.apellidos,
      Función: a.cargoFuncion,
      Estamento: ESTAMENTO_LABELS[a.estamento]?.label || a.estamento,
      'Horas Contrato': a.horasContrato,
      'Indefinidas Sub Gral': a.horasSubvencionGeneralIndefinido || 0,
      'Plazo Fijo Sub Gral': a.horasSubvencionGeneralPlazoFijo || 0,
      'Indefinidas SEP': a.horasSepIndefinido || 0,
      'Plazo Fijo SEP': a.horasSepPlazoFijo || 0,
      'Indefinidas PIE': a.horasPieIndefinido || 0,
      'Plazo Fijo PIE': a.horasPiePlazoFijo || 0,
      'Dupla Psicosocial': a.esDuplaPsicosocial ? 'SÍ' : 'NO',
      'Equipo PIE': a.esEquipoPie ? 'SÍ' : 'NO',
      'Técnico Párvulo': a.esTecnicoParvulo ? 'SÍ' : 'NO',
      'Auxiliar Servicio': a.esAuxiliarServicio ? 'SÍ' : 'NO'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Asistentes');
    XLSX.writeFile(wb, `Dotacion_Asistentes_RBD_${colegio.rbd}_${periodoActivo}.xlsx`);
  };

  const handleExportarLevantamientoOficial = async () => {
    try {
      await exportarLevantamientoIndividualExcel(
        asistentes,
        colegio.rbd,
        colegio.nombre,
        colegio.comuna
      );
      setNotificacion({
        tipo: 'success',
        mensaje: '¡Planilla Oficial de Levantamiento de Coeficiente exportada exitosamente!'
      });
      setTimeout(() => setNotificacion(null), 3500);
    } catch (err: any) {
      setNotificacion({
        tipo: 'error',
        mensaje: `Error al exportar planilla oficial: ${err.message || err}`
      });
    }
  };

  const handleProcesarArchivoExcel = async () => {
    if (!archivoExcel) return;
    try {
      const buffer = await archivoExcel.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const parseRes = parseAsistentesFromWorkbook(wb, colegio.rbd, periodoActivo);

      if (parseRes.asistentes.length === 0) {
        setNotificacion({
          tipo: 'error',
          mensaje: parseRes.advertencias[0] || 'No se encontraron registros de asistentes en el archivo.'
        });
        return;
      }

      if (onGuardarAsistentesBatch) {
        await onGuardarAsistentesBatch(parseRes.asistentes, true);
      } else {
        for (const a of parseRes.asistentes) {
          await onGuardarAsistente(a);
        }
      }

      setModalImportarAbierto(false);
      setArchivoExcel(null);
      setNotificacion({
        tipo: 'success',
        mensaje: `Se importaron exitosamente ${parseRes.totalFuncionarios} asistentes (${parseRes.totalHoras} hrs).`
      });
      setTimeout(() => setNotificacion(null), 4000);
    } catch (err: any) {
      setNotificacion({ tipo: 'error', mensaje: `Error al procesar archivo: ${err.message}` });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Notificación flotante */}
      {notificacion && (
        <div
          className={`p-4 rounded-2xl flex items-center justify-between gap-3 shadow-lg border transition-all ${
            notificacion.tipo === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950/60 border-rose-200 text-rose-800 dark:text-rose-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {notificacion.tipo === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            )}
            <span className="text-sm font-semibold">{notificacion.mensaje}</span>
          </div>
          <button onClick={() => setNotificacion(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Alertas Normativas */}
      {diagnostico.alertas.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 space-y-2">
          <div className="flex items-center gap-2 font-bold text-sm">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Observaciones y Alertas de Dotación No Docente:</span>
          </div>
          <ul className="text-xs space-y-1 list-disc list-inside text-amber-800 dark:text-amber-300">
            {diagnostico.alertas.map((al, idx) => (
              <li key={idx}>{al}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Cockpit Ejecutivo de Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Asistentes */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Asistentes
            </span>
            <span className="p-2 rounded-xl bg-orange-50 dark:bg-orange-950/60 text-orange-600">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900 dark:text-white">
              {diagnostico.totalAsistentes}
            </span>
            <span className="text-xs font-semibold text-slate-500">
              ({diagnostico.totalHoras} hrs totales)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
            <span>Indefinidos: <strong>{diagnostico.totalHorasIndefinidas}h</strong></span>
            <span>•</span>
            <span>Plazo Fijo: <strong>{diagnostico.totalHorasPlazoFijo}h</strong></span>
          </div>
        </div>

        {/* Fuentes de Financiamiento */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Fuentes Financiamiento
            </span>
            <span className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-1 text-center">
            <div className="p-1.5 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <div className="text-[10px] font-bold text-slate-500">Subv. Gral</div>
              <div className="text-sm font-black text-slate-900 dark:text-white">
                {diagnostico.totalHorasSubvencionGeneral}h
              </div>
            </div>
            <div className="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/40">
              <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400">SEP</div>
              <div className="text-sm font-black text-amber-900 dark:text-amber-200">
                {diagnostico.totalHorasSep}h
              </div>
            </div>
            <div className="p-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40">
              <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400">PIE</div>
              <div className="text-sm font-black text-purple-900 dark:text-purple-200">
                {diagnostico.totalHorasPie}h
              </div>
            </div>
          </div>
        </div>

        {/* Dupla Psicosocial SEP */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Dupla Psicosocial
            </span>
            <span className="p-2 rounded-xl bg-pink-50 dark:bg-pink-950/60 text-pink-600">
              <HeartHandshake className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wide border ${
                diagnostico.duplaPsicosocial.estadoCobertura === 'COMPLETA'
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : diagnostico.duplaPsicosocial.estadoCobertura === 'PARCIAL'
                  ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300'
              }`}
            >
              {diagnostico.duplaPsicosocial.estadoCobertura === 'COMPLETA'
                ? 'Dupla Completa'
                : diagnostico.duplaPsicosocial.estadoCobertura === 'PARCIAL'
                ? 'Dupla Incompleta'
                : 'Sin Dupla'}
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-2">
            <span>Psicólogo: {diagnostico.duplaPsicosocial.horasPsicologia}h</span>
            <span>•</span>
            <span>Trab. Social: {diagnostico.duplaPsicosocial.horasTrabajoSocial}h</span>
          </div>
        </div>

        {/* Apoyo PIE y Auxiliares */}
        <div className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Equipo PIE & Auxiliares
            </span>
            <span className="p-2 rounded-xl bg-teal-50 dark:bg-teal-950/60 text-teal-600">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-lg font-black text-slate-900 dark:text-white">
              {diagnostico.equipoPie.cantidadProfesionales} PIE ({diagnostico.equipoPie.horasTotales}h)
            </span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            {diagnostico.auxiliaresAseo.cantidad} Auxiliares ({diagnostico.auxiliaresAseo.horasTotales}h)
            {matricula > 0 && ` • 1 cada ${diagnostico.auxiliaresAseo.ratioAlumnosPorAuxiliar} alumnos`}
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
              placeholder="Buscar por RUN, nombre, cargo..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-4 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>

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

          {/* Filtro Fuente */}
          <select
            value={filtroFuente}
            onChange={(e) => setFiltroFuente(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-medium"
          >
            <option value="TODAS">Todas las Fuentes</option>
            <option value="SUBV_GRAL">Subvención General</option>
            <option value="SEP">Ley SEP</option>
            <option value="PIE">Programa PIE</option>
          </select>

          {/* Filtro Contrato */}
          <select
            value={filtroContrato}
            onChange={(e) => setFiltroContrato(e.target.value)}
            className="px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:outline-none font-medium"
          >
            <option value="TODOS">Todos los Contratos</option>
            <option value="INDEFINIDO">Indefinido</option>
            <option value="PLAZO_FIJO">Plazo Fijo</option>
          </select>
        </div>

        {/* Botones de Acción */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
          <button
            type="button"
            onClick={() => setModalPegarAbierto(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 flex items-center gap-1.5 transition-colors shadow-xs"
            title="Copiar y pegar múltiples asistentes desde Excel"
          >
            <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600" />
            <span>Pegar desde Excel</span>
          </button>

          <button
            onClick={() => setModalImportarAbierto(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Cargar nómina de asistentes desde archivo Excel"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Importar Excel</span>
          </button>

          <button
            onClick={handleExportarLevantamientoOficial}
            disabled={asistentes.length === 0}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-500/25 flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
            title="Descargar Planilla Oficial de Levantamiento de Coeficientes de Asistentes"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-orange-300" />
            <span>Levantamiento Coeficiente</span>
          </button>

          <button
            onClick={() => {
              const data = asistentesFiltrados.map((a) => ({
                RBD: a.rbd,
                RUN: a.run,
                Nombres: a.nombres,
                Apellidos: a.apellidos,
                Función: a.cargoFuncion,
                Estamento: ESTAMENTO_LABELS[a.estamento]?.label || a.estamento,
                'Horas Contrato': a.horasContrato,
                'Indefinidas Sub Gral': a.horasSubvencionGeneralIndefinido || 0,
                'Plazo Fijo Sub Gral': a.horasSubvencionGeneralPlazoFijo || 0,
                'Indefinidas SEP': a.horasSepIndefinido || 0,
                'Plazo Fijo SEP': a.horasSepPlazoFijo || 0,
                'Indefinidas PIE': a.horasPieIndefinido || 0,
                'Plazo Fijo PIE': a.horasPiePlazoFijo || 0,
                'Dupla Psicosocial': a.esDuplaPsicosocial ? 'SÍ' : 'NO',
                'Equipo PIE': a.esEquipoPie ? 'SÍ' : 'NO',
                'Técnico Párvulo': a.esTecnicoParvulo ? 'SÍ' : 'NO',
                'Auxiliar Servicio': a.esAuxiliarServicio ? 'SÍ' : 'NO'
              }));
              const ws = XLSX.utils.json_to_sheet(data);
              const wb = XLSX.utils.book_new();
              XLSX.utils.book_append_sheet(wb, ws, 'Asistentes');
              const nombreLimpio = colegio.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
              XLSX.writeFile(wb, `Nomina_Asistentes_${nombreLimpio}_RBD_${colegio.rbd}.xlsx`);
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:hover:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800 flex items-center gap-1.5 transition-colors shadow-xs"
            title="Descargar exactamente esta lista filtrada a un archivo Excel"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Exportar Vista (.xlsx)</span>
          </button>

          <button
            onClick={abrirModalNuevo}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-500/20 flex items-center gap-1.5 transition-all active:scale-[0.98]"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Nuevo Asistente</span>
          </button>
        </div>
      </div>

      {/* Tabla de Asistentes */}
      <div className="card-elevated overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider text-[11px]">
                <th className="py-3 px-4">Funcionario / RUN</th>
                <th className="py-3 px-4">Función / Cargo</th>
                <th className="py-3 px-4">Estamento</th>
                <th className="py-3 px-4 text-center">Horas Contrato</th>
                <th className="py-3 px-4 text-center">Subv. Gral (Ind / PF)</th>
                <th className="py-3 px-4 text-center">SEP (Ind / PF)</th>
                <th className="py-3 px-4 text-center">PIE (Ind / PF)</th>
                <th className="py-3 px-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {asistentesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="font-semibold">No se encontraron asistentes de la educación</p>
                    <p className="text-[11px] text-slate-500 mt-1">
                      Carga la nómina desde Excel o agrega un nuevo funcionario manualmente.
                    </p>
                  </td>
                </tr>
              ) : (
                asistentesFiltrados.map((a) => {
                  const estStyle = ESTAMENTO_LABELS[a.estamento] || ESTAMENTO_LABELS.PARADOCENTE_INSPECTORIA;
                  const totalHorasCalculadas =
                    (a.horasSubvencionGeneralIndefinido || 0) +
                    (a.horasSubvencionGeneralPlazoFijo || 0) +
                    (a.horasSepIndefinido || 0) +
                    (a.horasSepPlazoFijo || 0) +
                    (a.horasPieIndefinido || 0) +
                    (a.horasPiePlazoFijo || 0);

                  const tieneDescuadre = Math.abs(totalHorasCalculadas - a.horasContrato) > 0.05;

                  return (
                    <tr
                      key={a.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Funcionario */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">
                          {a.apellidos ? `${a.apellidos}, ${a.nombres}` : a.nombres}
                        </div>
                        <div className="text-[11px] font-mono text-slate-400 mt-0.5">
                          {a.run || 'Sin RUN'}
                        </div>
                      </td>

                      {/* Cargo / Función */}
                      <td className="py-3 px-4">
                        <span className="font-semibold text-slate-700 dark:text-slate-200">
                          {a.cargoFuncion}
                        </span>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {a.esDuplaPsicosocial && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-pink-100 text-pink-700 dark:bg-pink-950/60 dark:text-pink-300">
                              Dupla Psicosocial
                            </span>
                          )}
                          {a.esEquipoPie && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                              Equipo PIE
                            </span>
                          )}
                          {a.esTecnicoParvulo && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                              Párvulos
                            </span>
                          )}
                          {a.esAuxiliarServicio && (
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
                          <span>{a.horasContrato}h</span>
                          {tieneDescuadre && (
                            <span title="Descuadre: Las fuentes no suman las horas del contrato">
                              <AlertTriangle className="w-3.5 h-3.5 text-amber-500 inline" />
                            </span>
                          )}
                          {a.horasContrato > 44 && (
                            <span title="Supera el límite legal máximo de 44 horas semanales">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-500 inline" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Subv. Gral */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-slate-900 dark:text-white font-bold">
                          {a.horasSubvencionGeneralIndefinido || 0}h
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-slate-500">
                          {a.horasSubvencionGeneralPlazoFijo || 0}h
                        </span>
                      </td>

                      {/* SEP */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-amber-700 dark:text-amber-400 font-bold">
                          {a.horasSepIndefinido || 0}h
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-amber-600 dark:text-amber-500">
                          {a.horasSepPlazoFijo || 0}h
                        </span>
                      </td>

                      {/* PIE */}
                      <td className="py-3 px-4 text-center font-mono">
                        <span className="text-purple-700 dark:text-purple-400 font-bold">
                          {a.horasPieIndefinido || 0}h
                        </span>
                        <span className="text-slate-400 mx-1">/</span>
                        <span className="text-purple-600 dark:text-purple-500">
                          {a.horasPiePlazoFijo || 0}h
                        </span>
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => abrirModalEditar(a)}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors"
                            title="Editar asistente"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => onEliminarAsistente(a.id)}
                            className="p-1.5 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-950/50 text-rose-600 transition-colors"
                            title="Eliminar funcionario"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Creación / Edición */}
      {modalAbierto && asistenteEdicion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-2xl bg-orange-50 dark:bg-orange-950/60 text-orange-600">
                  <Briefcase className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {asistenteEdicion.id?.startsWith('asist_') ? 'Registrar Asistente de la Educación' : 'Editar Asistente'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Establecimiento: {colegio.nombre} (RBD {colegio.rbd})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setModalAbierto(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleGuardarAsistente} className="p-6 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    RUN / RUT
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="12.345.678-9"
                    value={asistenteEdicion.run || ''}
                    onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, run: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Nombres
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. Luisa Ester"
                    value={asistenteEdicion.nombres || ''}
                    onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, nombres: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Díaz Puas"
                    value={asistenteEdicion.apellidos || ''}
                    onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, apellidos: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Función / Cargo Desempeñado
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. ASISTENTE DE SALA, PSICOLOGO/A, AUXILIAR..."
                    value={asistenteEdicion.cargoFuncion || ''}
                    onChange={(e) => handleCargoChange(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Estamento Funcional (Ley 21.109)
                  </label>
                  <select
                    value={asistenteEdicion.estamento || 'PARADOCENTE_INSPECTORIA'}
                    onChange={(e) =>
                      setAsistenteEdicion({ ...asistenteEdicion, estamento: e.target.value as EstamentoAsistente })
                    }
                    className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-orange-500 font-semibold"
                  >
                    <option value="PROFESIONAL">Profesional</option>
                    <option value="TECNICO">Técnico</option>
                    <option value="ADMINISTRATIVO">Administrativo</option>
                    <option value="AUXILIAR">Auxiliar de Servicios Menores</option>
                    <option value="PARADOCENTE_INSPECTORIA">Paradocente / Inspectoría</option>
                  </select>
                </div>
              </div>

              {/* Desglose de Horas y Financiamiento */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    Carga Horaria Semanal (Máx. 44 hrs)
                  </span>
                  <div className="text-xs font-bold text-orange-600">
                    Horas Contrato: {asistenteEdicion.horasContrato || 0} hrs
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Subv. Gral Indefinido
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={44}
                      value={asistenteEdicion.horasSubvencionGeneralIndefinido ?? 0}
                      onChange={(e) =>
                        setAsistenteEdicion({
                          ...asistenteEdicion,
                          horasSubvencionGeneralIndefinido: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                      Subv. Gral Plazo Fijo
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={44}
                      value={asistenteEdicion.horasSubvencionGeneralPlazoFijo ?? 0}
                      onChange={(e) =>
                        setAsistenteEdicion({
                          ...asistenteEdicion,
                          horasSubvencionGeneralPlazoFijo: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-600 mb-1">
                      SEP Indefinido
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={44}
                      value={asistenteEdicion.horasSepIndefinido ?? 0}
                      onChange={(e) =>
                        setAsistenteEdicion({
                          ...asistenteEdicion,
                          horasSepIndefinido: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-amber-600 mb-1">
                      SEP Plazo Fijo
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={44}
                      value={asistenteEdicion.horasSepPlazoFijo ?? 0}
                      onChange={(e) =>
                        setAsistenteEdicion({
                          ...asistenteEdicion,
                          horasSepPlazoFijo: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-600 mb-1">
                      PIE Indefinido
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={44}
                      value={asistenteEdicion.horasPieIndefinido ?? 0}
                      onChange={(e) =>
                        setAsistenteEdicion({
                          ...asistenteEdicion,
                          horasPieIndefinido: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-purple-600 mb-1">
                      PIE Plazo Fijo
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={44}
                      value={asistenteEdicion.horasPiePlazoFijo ?? 0}
                      onChange={(e) =>
                        setAsistenteEdicion({
                          ...asistenteEdicion,
                          horasPiePlazoFijo: Number(e.target.value)
                        })
                      }
                      className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700"
                    />
                  </div>
                </div>
              </div>

              {/* Flags operacionales */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!asistenteEdicion.esDuplaPsicosocial}
                    onChange={(e) =>
                      setAsistenteEdicion({ ...asistenteEdicion, esDuplaPsicosocial: e.target.checked })
                    }
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>Dupla Psicosocial</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!asistenteEdicion.esEquipoPie}
                    onChange={(e) =>
                      setAsistenteEdicion({ ...asistenteEdicion, esEquipoPie: e.target.checked })
                    }
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>Equipo PIE</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!asistenteEdicion.esTecnicoParvulo}
                    onChange={(e) =>
                      setAsistenteEdicion({ ...asistenteEdicion, esTecnicoParvulo: e.target.checked })
                    }
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>Técnico Párvulos</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!asistenteEdicion.esAuxiliarServicio}
                    onChange={(e) =>
                      setAsistenteEdicion({ ...asistenteEdicion, esAuxiliarServicio: e.target.checked })
                    }
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>Auxiliar de Aseo</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!asistenteEdicion.esInspectorPatio}
                    onChange={(e) =>
                      setAsistenteEdicion({ ...asistenteEdicion, esInspectorPatio: e.target.checked })
                    }
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                  />
                  <span>Inspector de Patio</span>
                </label>
              </div>

              {/* Sección Desplegable: Parámetros GDP & Contrato Oficial DEP */}
              <div className="bg-slate-50 dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-xs">
                <button
                  type="button"
                  onClick={() => setSeccionGdpAbierta(!seccionGdpAbierta)}
                  className="w-full px-4 py-3 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200/70 dark:hover:bg-slate-700/60 flex items-center justify-between text-left transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                      Parámetros GDP & Contrato Oficial DEP (Proyección Ministerial 2027)
                    </span>
                  </div>
                  {seccionGdpAbierta ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {seccionGdpAbierta && (
                  <div className="p-4 space-y-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 animate-fade-in text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Propuesta Dotación GDP
                        </label>
                        <select
                          value={asistenteEdicion.propuestaGdp || 'Continuidad'}
                          onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, propuestaGdp: e.target.value as any })}
                          className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-medium"
                        >
                          <option value="Continuidad">Continuidad</option>
                          <option value="No Continuidad">No Continuidad</option>
                          <option value="Aumento Horas">Aumento Horas</option>
                          <option value="Disminución Horas">Disminución Horas</option>
                          <option value="Nuevo">Nuevo</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Fecha Inicio Contrato
                        </label>
                        <input
                          type="date"
                          value={asistenteEdicion.fechaInicioContrato || ''}
                          onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, fechaInicioContrato: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Fecha Término Contrato
                        </label>
                        <input
                          type="date"
                          value={asistenteEdicion.fechaTerminoContrato || ''}
                          onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, fechaTerminoContrato: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Remuneración Mensual ($)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          value={asistenteEdicion.remuneracionMensual || ''}
                          placeholder="Ej: 750000"
                          onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, remuneracionMensual: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Acción PME (SEP)
                        </label>
                        <input
                          type="text"
                          value={asistenteEdicion.accionPme || ''}
                          placeholder="Ej: A-2 Apoyo Psicosocial"
                          onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, accionPme: e.target.value })}
                          className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                          Horas Pro-Retención
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={44}
                          value={asistenteEdicion.horasProRetencion || ''}
                          placeholder="0"
                          onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, horasProRetencion: parseInt(e.target.value) || 0 })}
                          className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-center font-bold"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Observaciones Oficiales DEP (PAL)
                      </label>
                      <input
                        type="text"
                        value={asistenteEdicion.observacionesPal || ''}
                        placeholder="Ej: Asistente técnico titular D.F.L. 1..."
                        onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, observacionesPal: e.target.value })}
                        className="w-full px-3 py-1.5 border rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Observaciones
                </label>
                <textarea
                  rows={2}
                  placeholder="Notas internas, decretos, traslados..."
                  value={asistenteEdicion.observaciones || ''}
                  onChange={(e) => setAsistenteEdicion({ ...asistenteEdicion, observaciones: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-500/25"
                >
                  Guardar Funcionario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de Importación Excel */}
      {modalImportarAbierto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-orange-600" />
                <h3 className="font-black text-slate-900 dark:text-white">Importar Nómina Asistentes</h3>
              </div>
              <button onClick={() => setModalImportarAbierto(false)} className="text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Sube la planilla Excel de dotación. El sistema buscará automáticamente la hoja "Asistentes" e importará los funcionarios para el colegio <strong>{colegio.nombre}</strong>.
            </p>

            <div className="border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-6 text-center hover:border-orange-500 transition-colors">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={(e) => setArchivoExcel(e.target.files?.[0] || null)}
                className="hidden"
                id="file-asistentes-input"
              />
              <label htmlFor="file-asistentes-input" className="cursor-pointer space-y-2 block">
                <Upload className="w-8 h-8 mx-auto text-orange-600 opacity-80" />
                <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {archivoExcel ? archivoExcel.name : 'Haz clic para seleccionar archivo Excel'}
                </div>
                <div className="text-[10px] text-slate-400">Archivos .xlsx o .xls</div>
              </label>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setModalImportarAbierto(false)}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!archivoExcel}
                onClick={handleProcesarArchivoExcel}
                className="px-4 py-2 text-xs font-bold rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white"
              >
                Procesar e Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Pegar Asistentes desde Excel */}
      <ModalPegarDesdeExcel
        isOpen={modalPegarAbierto}
        onClose={() => setModalPegarAbierto(false)}
        tipo="ASISTENTES"
        rbd={colegio.rbd}
        periodoActivo={periodoActivo}
        onGuardarBatch={async (items) => {
          if (onGuardarAsistentesBatch) {
            await onGuardarAsistentesBatch(items);
          } else {
            for (const a of items) {
              await onGuardarAsistente(a);
            }
          }
        }}
      />
    </div>
  );
};
