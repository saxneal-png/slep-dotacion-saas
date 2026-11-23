import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  Briefcase,
  CheckCircle2,
  Clock,
  Edit3,
  GraduationCap,
  History,
  Lock,
  Plus,
  RotateCcw,
  Send,
  Sparkles,
  Users,
  X
} from 'lucide-react';
import {
  AsistenteEducacion,
  Docente,
  Establecimiento,
  EstadoNecesidadVacante,
  EstamentoAsistente,
  EstamentoDocente,
  RegistroMovimientoMovilidad,
  TipoFuncionNoAula,
  TipoRequerimientoVacante
} from '../types';
import { ESTAMENTOS } from '../components/DocenteFormModal';
import { usePermisos } from '../security/PermisosContext';
import {
  actualizarNecesidadVacanteAsistente,
  actualizarNecesidadVacanteEscuela,
  cancelarNecesidadVacanteAsistente,
  cancelarNecesidadVacanteEscuela,
  crearNecesidadVacanteAsistente,
  crearNecesidadVacanteEscuela,
  enviarNecesidadAMovilidad,
  enviarNecesidadAsistenteAMovilidad,
  esVacanteCargoDocente,
  listarNecesidadesVacanteAsistente,
  listarNecesidadesVacanteEscuela,
  listarRegistroMovimientosMovilidad,
  obtenerVacantesConPropuestaActiva,
  retrotraerNecesidadAsistenteDeMovilidad,
  retrotraerNecesidadDeMovilidad
} from '../services/movilidadTerritorialService';

export interface NecesidadesDocentesViewProps {
  colegio: Establecimiento;
  periodoActivo: number;
  usuarioActor?: string;
  rolActor?: string;
  onRefreshData: () => Promise<void>;
}

type FiltroEstadoNecesidad = 'TODAS' | 'BORRADOR' | 'ENVIADA' | 'CANCELADA';

interface NecesidadUnificadaItem {
  id: string;
  run: string;
  categoria: TipoRequerimientoVacante;
  titulo: string;
  estamentoLabel: string;
  horasContrato: number;
  fuente: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
  justificacion?: string;
  estado: EstadoNecesidadVacante;
  motivoEstado?: string;
  rawDocente?: Docente;
  rawAsistente?: AsistenteEducacion;
}

const ESTAMENTOS_ASISTENTE_OPCIONES: Array<{ id: EstamentoAsistente; label: string }> = [
  { id: 'PROFESIONAL', label: 'Profesional (Psicólogo, Trab. Social, Fonoaudiólogo, etc.)' },
  { id: 'TECNICO', label: 'Técnico (Párvulos, Diferencial, etc.)' },
  { id: 'PARADOCENTE_INSPECTORIA', label: 'Paradocente / Inspectoría de Patio' },
  { id: 'ADMINISTRATIVO', label: 'Administrativo / Secretaría' },
  { id: 'AUXILIAR', label: 'Auxiliar de Servicio / Aseo' }
];

const FUNCIONES_CARGO_DOCENTE: Array<{ id: TipoFuncionNoAula; label: string; estamento: EstamentoDocente }> = [
  { id: 'INSPECTORIA', label: 'Inspectoría General', estamento: 'DIRECTIVO' },
  { id: 'DIRECTIVA', label: 'Dirección / Subdirección', estamento: 'DIRECTIVO' },
  { id: 'UTP', label: 'Jefatura UTP / Curricular', estamento: 'TECNICO_PEDAGOGICO' },
  { id: 'CONVIVENCIA', label: 'Convivencia Escolar', estamento: 'TECNICO_PEDAGOGICO' },
  { id: 'ORIENTACION', label: 'Orientación', estamento: 'TECNICO_PEDAGOGICO' },
  { id: 'EVALUACION', label: 'Evaluación', estamento: 'TECNICO_PEDAGOGICO' },
  { id: 'COORDINACION', label: 'Coordinación PIE / Ciclo / CRA', estamento: 'TECNICO_PEDAGOGICO' },
  { id: 'EXTRAESCOLAR', label: 'Coordinación Extraescolar', estamento: 'TECNICO_PEDAGOGICO' }
];

function obtenerFuenteDocente(d: Docente): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' {
  if ((d.horasPieContrata || 0) > 0 || (d.horasPieTitular || 0) > 0) return 'PIE';
  if ((d.horasSepContrata || 0) > 0 || (d.horasSepTitular || 0) > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function obtenerFuenteAsistente(a: AsistenteEducacion): 'SUBVENCION_GENERAL' | 'SEP' | 'PIE' {
  if ((a.horasPiePlazoFijo || 0) > 0 || (a.horasPieIndefinido || 0) > 0) return 'PIE';
  if ((a.horasSepPlazoFijo || 0) > 0 || (a.horasSepIndefinido || 0) > 0) return 'SEP';
  return 'SUBVENCION_GENERAL';
}

function obtenerEstadoEfectivo(
  estadoNecesidad?: EstadoNecesidadVacante,
  situacionFinalGdp?: string
): EstadoNecesidadVacante {
  if (estadoNecesidad) return estadoNecesidad;
  if (situacionFinalGdp === 'Cancelada') return 'CANCELADA';
  return 'ENVIADA';
}

const ETIQUETA_FUENTE: Record<'SUBVENCION_GENERAL' | 'SEP' | 'PIE', string> = {
  SUBVENCION_GENERAL: 'Subvención General',
  SEP: 'SEP',
  PIE: 'PIE (Dto. 170)'
};

const ETIQUETA_CATEGORIA: Record<
  TipoRequerimientoVacante,
  { label: string; className: string; icon: React.ComponentType<{ className?: string }> }
> = {
  HORAS_AULA: {
    label: 'Horas Aula',
    className: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    icon: GraduationCap
  },
  CARGO_DOCENTE: {
    label: 'Cargo Directivo / UTP',
    className: 'bg-purple-100 text-purple-900 border-purple-200',
    icon: Briefcase
  },
  CARGO_ASISTENTE: {
    label: 'Asistente Ley 21.109',
    className: 'bg-teal-100 text-teal-900 border-teal-200',
    icon: Users
  }
};

const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  CREACION_NECESIDAD: 'Creación',
  EDICION_NECESIDAD: 'Edición',
  ENVIO_MOVILIDAD: 'Envío a Movilidad',
  RETROCESO_NECESIDAD: 'Retroceso a Borrador',
  CANCELACION_NECESIDAD: 'Cancelación'
};

export const NecesidadesDocentesView: React.FC<NecesidadesDocentesViewProps> = ({
  colegio,
  periodoActivo,
  usuarioActor = 'establecimiento',
  rolActor,
  onRefreshData
}) => {
  const { can } = usePermisos();
  const puedeEditarNecesidades = can('necesidades_docentes.editar');

  const [necesidadesDoc, setNecesidadesDoc] = useState<Docente[]>([]);
  const [necesidadesAst, setNecesidadesAst] = useState<AsistenteEducacion[]>([]);
  const [bloqueadasEnMesa, setBloqueadasEnMesa] = useState<Set<string>>(new Set());
  const [movimientos, setMovimientos] = useState<RegistroMovimientoMovilidad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstadoNecesidad>('TODAS');
  const [feedback, setFeedback] = useState<{ tipo: 'success' | 'error'; mensaje: string } | null>(null);

  const [modalForm, setModalForm] = useState<{
    open: boolean;
    editingId: string | null;
    tipoRequerimiento: TipoRequerimientoVacante;
    especialidadOCargo: string;
    estamentoDocente: EstamentoDocente;
    estamentoAsistente: EstamentoAsistente;
    tipoFuncionNoAula: TipoFuncionNoAula;
    horas: number;
    fuente: 'SUBVENCION_GENERAL' | 'SEP' | 'PIE';
    justificacion: string;
    guardando: boolean;
    error: string | null;
  }>({
    open: false,
    editingId: null,
    tipoRequerimiento: 'HORAS_AULA',
    especialidadOCargo: '',
    estamentoDocente: 'DOCENTE_AULA',
    estamentoAsistente: 'PROFESIONAL',
    tipoFuncionNoAula: 'INSPECTORIA',
    horas: 22,
    fuente: 'SUBVENCION_GENERAL',
    justificacion: '',
    guardando: false,
    error: null
  });

  const [modalMotivo, setModalMotivo] = useState<{
    open: boolean;
    tipo: 'RETROTRAER' | 'CANCELAR';
    item: NecesidadUnificadaItem | null;
    motivo: string;
    procesando: boolean;
    error: string | null;
  }>({
    open: false,
    tipo: 'RETROTRAER',
    item: null,
    motivo: '',
    procesando: false,
    error: null
  });

  const mostrarFeedback = (mensaje: string, tipo: 'success' | 'error' = 'success') => {
    setFeedback({ tipo, mensaje });
    setTimeout(() => setFeedback(null), 5500);
  };

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    try {
      const [docs, asts] = await Promise.all([
        listarNecesidadesVacanteEscuela(colegio.rbd, periodoActivo),
        listarNecesidadesVacanteAsistente(colegio.rbd, periodoActivo)
      ]);
      setNecesidadesDoc(docs);
      setNecesidadesAst(asts);
      const ids = [...docs.map(d => d.id), ...asts.map(a => a.id)];
      const [enMesa, regs] = await Promise.all([
        obtenerVacantesConPropuestaActiva(ids, periodoActivo),
        listarRegistroMovimientosMovilidad({ rbd: colegio.rbd, periodo: periodoActivo, limit: 60 })
      ]);
      setBloqueadasEnMesa(enMesa);
      setMovimientos(regs.filter(r => r.entidad === 'NECESIDAD_VACANTE'));
    } catch (err: any) {
      mostrarFeedback(err?.message || 'Error cargando necesidades de dotación.', 'error');
    } finally {
      setCargando(false);
    }
  }, [colegio.rbd, periodoActivo]);

  useEffect(() => {
    void cargarDatos();
  }, [cargarDatos]);

  const necesidadesUnificadas = useMemo<NecesidadUnificadaItem[]>(() => {
    const itemsDoc: NecesidadUnificadaItem[] = necesidadesDoc.map(d => ({
      id: d.id,
      run: d.run,
      categoria: esVacanteCargoDocente(d) ? 'CARGO_DOCENTE' : 'HORAS_AULA',
      titulo: d.cargoInstitucional || d.asignaturaPrincipal || d.apellidos,
      estamentoLabel: ESTAMENTOS.find(e => e.id === d.estamento)?.label || d.estamento,
      horasContrato: d.horasContrato,
      fuente: obtenerFuenteDocente(d),
      justificacion: d.justificacionVacante,
      estado: obtenerEstadoEfectivo(d.estadoNecesidad, d.situacionFinalGdp),
      motivoEstado: d.motivoEstadoNecesidad,
      rawDocente: d
    }));

    const itemsAst: NecesidadUnificadaItem[] = necesidadesAst.map(a => ({
      id: a.id,
      run: a.run,
      categoria: 'CARGO_ASISTENTE',
      titulo: a.cargoFuncion || a.apellidos,
      estamentoLabel:
        ESTAMENTOS_ASISTENTE_OPCIONES.find(e => e.id === a.estamento)?.label || a.estamento,
      horasContrato: a.horasContrato,
      fuente: obtenerFuenteAsistente(a),
      justificacion: a.justificacionVacante,
      estado: obtenerEstadoEfectivo(a.estadoNecesidad, a.situacionFinalGdp),
      motivoEstado: a.motivoEstadoNecesidad,
      rawAsistente: a
    }));

    return [...itemsDoc, ...itemsAst].sort((a, b) => b.id.localeCompare(a.id));
  }, [necesidadesDoc, necesidadesAst]);

  const resumen = useMemo(() => {
    let borradores = 0;
    let horasBorrador = 0;
    let enviadas = 0;
    let horasEnviadas = 0;
    let enGestion = 0;
    let canceladas = 0;
    for (const n of necesidadesUnificadas) {
      if (n.estado === 'BORRADOR') {
        borradores++;
        horasBorrador += n.horasContrato || 0;
      } else if (n.estado === 'ENVIADA') {
        enviadas++;
        horasEnviadas += n.horasContrato || 0;
        if (bloqueadasEnMesa.has(n.id)) enGestion++;
      } else {
        canceladas++;
      }
    }
    return { borradores, horasBorrador, enviadas, horasEnviadas, enGestion, canceladas };
  }, [necesidadesUnificadas, bloqueadasEnMesa]);

  const necesidadesFiltradas = useMemo(() => {
    if (filtroEstado === 'TODAS') return necesidadesUnificadas;
    return necesidadesUnificadas.filter(n => n.estado === filtroEstado);
  }, [necesidadesUnificadas, filtroEstado]);

  const posibleDuplicado = useMemo(() => {
    if (!modalForm.open || modalForm.editingId) return null;
    const norm = modalForm.especialidadOCargo.trim().toLowerCase();
    if (!norm) return null;
    return (
      necesidadesUnificadas.find(
        n =>
          n.estado !== 'CANCELADA' &&
          n.categoria === modalForm.tipoRequerimiento &&
          n.titulo.trim().toLowerCase() === norm &&
          n.fuente === modalForm.fuente
      ) || null
    );
  }, [
    modalForm.open,
    modalForm.editingId,
    modalForm.tipoRequerimiento,
    modalForm.especialidadOCargo,
    modalForm.fuente,
    necesidadesUnificadas
  ]);

  const abrirModalCrear = () => {
    setModalForm({
      open: true,
      editingId: null,
      tipoRequerimiento: 'HORAS_AULA',
      especialidadOCargo: '',
      estamentoDocente: 'DOCENTE_AULA',
      estamentoAsistente: 'PROFESIONAL',
      tipoFuncionNoAula: 'INSPECTORIA',
      horas: 22,
      fuente: 'SUBVENCION_GENERAL',
      justificacion: '',
      guardando: false,
      error: null
    });
  };

  const abrirModalEditar = (item: NecesidadUnificadaItem) => {
    setModalForm({
      open: true,
      editingId: item.id,
      tipoRequerimiento: item.categoria,
      especialidadOCargo: item.titulo,
      estamentoDocente: item.rawDocente?.estamento || 'DOCENTE_AULA',
      estamentoAsistente: item.rawAsistente?.estamento || 'PROFESIONAL',
      tipoFuncionNoAula: 'INSPECTORIA',
      horas: item.horasContrato,
      fuente: item.fuente,
      justificacion: item.justificacion || '',
      guardando: false,
      error: null
    });
  };

  const handleGuardarForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalForm.especialidadOCargo.trim()) {
      setModalForm(s => ({
        ...s,
        error:
          s.tipoRequerimiento === 'HORAS_AULA'
            ? 'Ingresa la especialidad o asignatura requerida.'
            : 'Ingresa el cargo o función requerida.'
      }));
      return;
    }
    const horasNum = Math.round(Number(modalForm.horas));
    if (!Number.isFinite(horasNum) || horasNum < 1 || horasNum > 44) {
      setModalForm(s => ({ ...s, error: 'Las horas deben estar entre 1 y 44.' }));
      return;
    }
    if (!modalForm.justificacion.trim()) {
      setModalForm(s => ({ ...s, error: 'La justificación operativa o normativa es obligatoria.' }));
      return;
    }

    setModalForm(s => ({ ...s, guardando: true, error: null }));
    try {
      if (modalForm.tipoRequerimiento === 'CARGO_ASISTENTE') {
        if (modalForm.editingId) {
          await actualizarNecesidadVacanteAsistente({
            id: modalForm.editingId,
            rbd: colegio.rbd,
            periodo: periodoActivo,
            cargoFuncion: modalForm.especialidadOCargo.trim(),
            estamento: modalForm.estamentoAsistente,
            horasContrato: horasNum,
            fuenteFinanciamiento: modalForm.fuente,
            justificacion: modalForm.justificacion.trim(),
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna
          });
          mostrarFeedback('Necesidad de cargo asistente actualizada en borrador.');
        } else {
          await crearNecesidadVacanteAsistente({
            rbd: colegio.rbd,
            periodo: periodoActivo,
            cargoFuncion: modalForm.especialidadOCargo.trim(),
            estamento: modalForm.estamentoAsistente,
            horasContrato: horasNum,
            fuenteFinanciamiento: modalForm.fuente,
            justificacion: modalForm.justificacion.trim(),
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna,
            estadoInicial: 'BORRADOR'
          });
          mostrarFeedback('Cargo asistente guardado en Borrador. Revísalo y presiona "Enviar a Movilidad".');
        }
      } else {
        const tipoReqDoc: 'HORAS_AULA' | 'CARGO_DOCENTE' =
          modalForm.tipoRequerimiento === 'CARGO_DOCENTE' ? 'CARGO_DOCENTE' : 'HORAS_AULA';
        if (modalForm.editingId) {
          await actualizarNecesidadVacanteEscuela({
            id: modalForm.editingId,
            rbd: colegio.rbd,
            periodo: periodoActivo,
            especialidad: modalForm.especialidadOCargo.trim(),
            estamento: modalForm.estamentoDocente,
            horasContrato: horasNum,
            fuenteFinanciamiento: modalForm.fuente,
            justificacion: modalForm.justificacion.trim(),
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna,
            tipoRequerimiento: tipoReqDoc,
            tipoFuncionNoAula: modalForm.tipoFuncionNoAula
          });
          mostrarFeedback('Necesidad actualizada en borrador.');
        } else {
          await crearNecesidadVacanteEscuela({
            rbd: colegio.rbd,
            periodo: periodoActivo,
            especialidad: modalForm.especialidadOCargo.trim(),
            estamento: modalForm.estamentoDocente,
            horasContrato: horasNum,
            fuenteFinanciamiento: modalForm.fuente,
            justificacion: modalForm.justificacion.trim(),
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna,
            estadoInicial: 'BORRADOR',
            tipoRequerimiento: tipoReqDoc,
            tipoFuncionNoAula: modalForm.tipoFuncionNoAula
          });
          mostrarFeedback('Necesidad guardada en Borrador. Revísala y presiona "Enviar a Movilidad".');
        }
      }
      setModalForm(s => ({ ...s, open: false, guardando: false }));
      await onRefreshData();
      await cargarDatos();
    } catch (err: any) {
      setModalForm(s => ({
        ...s,
        guardando: false,
        error: err?.message || 'Error guardando la necesidad.'
      }));
    }
  };

  const handleEnviarAMovilidad = async (item: NecesidadUnificadaItem) => {
    try {
      if (item.categoria === 'CARGO_ASISTENTE') {
        await enviarNecesidadAsistenteAMovilidad({
          id: item.id,
          rbd: colegio.rbd,
          periodo: periodoActivo,
          usuarioActor,
          rolActor,
          nombreEstablecimiento: colegio.nombre,
          comuna: colegio.comuna
        });
      } else {
        await enviarNecesidadAMovilidad({
          id: item.id,
          rbd: colegio.rbd,
          periodo: periodoActivo,
          usuarioActor,
          rolActor,
          nombreEstablecimiento: colegio.nombre,
          comuna: colegio.comuna
        });
      }
      await onRefreshData();
      await cargarDatos();
      mostrarFeedback(`Necesidad ${item.run} enviada a la Mesa de Movilidad SLEP.`);
    } catch (err: any) {
      mostrarFeedback(err?.message || 'Error enviando necesidad a Movilidad.', 'error');
    }
  };

  const handleConfirmarMotivo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMotivo.item) return;
    if (!modalMotivo.motivo.trim()) {
      setModalMotivo(s => ({ ...s, error: 'Debes ingresar un motivo para dejar registro.' }));
      return;
    }

    setModalMotivo(s => ({ ...s, procesando: true, error: null }));
    try {
      const item = modalMotivo.item;
      if (modalMotivo.tipo === 'RETROTRAER') {
        if (item.categoria === 'CARGO_ASISTENTE') {
          await retrotraerNecesidadAsistenteDeMovilidad({
            id: item.id,
            rbd: colegio.rbd,
            motivo: modalMotivo.motivo.trim(),
            periodo: periodoActivo,
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna
          });
        } else {
          await retrotraerNecesidadDeMovilidad({
            id: item.id,
            rbd: colegio.rbd,
            motivo: modalMotivo.motivo.trim(),
            periodo: periodoActivo,
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna
          });
        }
        mostrarFeedback(`Necesidad ${item.run} retrotraída a Borrador para revisión.`);
      } else {
        if (item.categoria === 'CARGO_ASISTENTE') {
          await cancelarNecesidadVacanteAsistente({
            id: item.id,
            rbd: colegio.rbd,
            motivo: modalMotivo.motivo.trim(),
            periodo: periodoActivo,
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna
          });
        } else {
          await cancelarNecesidadVacanteEscuela({
            id: item.id,
            rbd: colegio.rbd,
            motivo: modalMotivo.motivo.trim(),
            periodo: periodoActivo,
            usuarioActor,
            rolActor,
            nombreEstablecimiento: colegio.nombre,
            comuna: colegio.comuna
          });
        }
        mostrarFeedback(`Necesidad ${item.run} cancelada correctamente.`);
      }
      setModalMotivo({
        open: false,
        tipo: 'RETROTRAER',
        item: null,
        motivo: '',
        procesando: false,
        error: null
      });
      await onRefreshData();
      await cargarDatos();
    } catch (err: any) {
      setModalMotivo(s => ({
        ...s,
        procesando: false,
        error: err?.message || 'Error procesando la acción.'
      }));
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-sm ${
            feedback.tipo === 'success'
              ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
              : 'bg-rose-50 border-rose-300 text-rose-900'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.mensaje}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="p-1 hover:opacity-70">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Cabecera */}
      <div className="card-elevated p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>Gestión de Necesidades de Dotación · {colegio.nombre}</span>
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
            Declara <strong>Horas Aula</strong>, <strong>Cargos Directivos/UTP</strong> o <strong>Asistentes y Profesionales (Ley 21.109)</strong>. Revisa en Borrador antes de enviar a Movilidad.
          </p>
        </div>
        {puedeEditarNecesidades ? (
          <button
            type="button"
            onClick={abrirModalCrear}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs shrink-0 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Necesidad</span>
          </button>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-600 border border-slate-200 text-xs font-bold shrink-0">
            <Lock className="w-3.5 h-3.5" />
            <span>Solo Lectura</span>
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-amber-800">
            Borradores (Por Revisar)
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-amber-900">{resumen.borradores}</span>
            <span className="text-[11px] font-semibold text-amber-700">{resumen.horasBorrador}h</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
            Enviadas a Movilidad
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-emerald-900">{resumen.enviadas}</span>
            <span className="text-[11px] font-semibold text-emerald-700">{resumen.horasEnviadas}h</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-indigo-50/80 border border-indigo-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-800">
            En Gestión en Mesa
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-indigo-900">{resumen.enGestion}</span>
            <span className="text-[11px] font-semibold text-indigo-700">con propuesta</span>
          </div>
        </div>
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-600">
            Canceladas
          </div>
          <div className="mt-1 flex items-baseline gap-2 tabular-nums">
            <span className="text-2xl font-black text-slate-800">{resumen.canceladas}</span>
            <span className="text-[11px] font-semibold text-slate-500">histórico</span>
          </div>
        </div>
      </div>

      {/* Filtros + Lista */}
      <div className="card-elevated p-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'TODAS', label: `Todas (${necesidadesUnificadas.length})` },
              { id: 'BORRADOR', label: `Borradores (${resumen.borradores})` },
              { id: 'ENVIADA', label: `Enviadas (${resumen.enviadas})` },
              { id: 'CANCELADA', label: `Canceladas (${resumen.canceladas})` }
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFiltroEstado(tab.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                filtroEstado === tab.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {cargando ? (
          <div className="p-8 text-center text-xs text-slate-500">Cargando necesidades...</div>
        ) : necesidadesFiltradas.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 space-y-2">
            <p className="font-semibold text-slate-700">No hay necesidades en esta vista.</p>
            <p>Usa "Nueva Necesidad" para declarar horas aula, cargos directivos o asistentes de la educación.</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {necesidadesFiltradas.map(n => {
              const enMesa = bloqueadasEnMesa.has(n.id);
              const catMeta = ETIQUETA_CATEGORIA[n.categoria];
              const CatIcon = catMeta.icon;

              return (
                <div
                  key={n.id}
                  className={`p-3.5 rounded-xl border transition-colors ${
                    n.estado === 'BORRADOR'
                      ? 'bg-amber-50/40 border-amber-300'
                      : n.estado === 'ENVIADA'
                      ? 'bg-white border-emerald-200'
                      : 'bg-slate-50 border-slate-200 opacity-80'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[11px] font-black px-2 py-0.5 rounded bg-slate-900 text-white">
                          {n.run}
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${catMeta.className}`}>
                          <CatIcon className="w-3 h-3" />
                          {catMeta.label}
                        </span>
                        <span className="font-black text-sm text-slate-900">{n.titulo}</span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-indigo-100 text-indigo-900 tabular-nums">
                          {n.horasContrato} hrs
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {ETIQUETA_FUENTE[n.fuente]}
                        </span>
                        <span className="text-[11px] text-slate-500">{n.estamentoLabel}</span>

                        {n.estado === 'BORRADOR' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-200 text-amber-950">
                            <Clock className="w-3 h-3" />
                            Borrador · Por revisar
                          </span>
                        )}
                        {n.estado === 'ENVIADA' && !enMesa && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-900">
                            <CheckCircle2 className="w-3 h-3" />
                            Enviada a Movilidad
                          </span>
                        )}
                        {n.estado === 'ENVIADA' && enMesa && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white">
                            <Lock className="w-3 h-3" />
                            En Gestión en Mesa de Movilidad
                          </span>
                        )}
                        {n.estado === 'CANCELADA' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800">
                            <Ban className="w-3 h-3" />
                            Cancelada
                          </span>
                        )}
                      </div>

                      {n.justificacion && (
                        <p className="text-xs text-slate-600">
                          <strong>Justificación:</strong> {n.justificacion}
                        </p>
                      )}
                      {n.motivoEstado && (
                        <p className="text-[11px] text-amber-900 bg-amber-100/70 px-2 py-1 rounded-lg inline-block">
                          <strong>Último motivo registrado:</strong> {n.motivoEstado}
                        </p>
                      )}
                    </div>

                    {puedeEditarNecesidades && (
                      <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                        {n.estado === 'BORRADOR' && (
                          <>
                            <button
                              type="button"
                              onClick={() => abrirModalEditar(n)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleEnviarAMovilidad(n)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Enviar a Movilidad</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModalMotivo({
                                  open: true,
                                  tipo: 'CANCELAR',
                                  item: n,
                                  motivo: '',
                                  procesando: false,
                                  error: null
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancelar</span>
                            </button>
                          </>
                        )}

                        {n.estado === 'ENVIADA' && !enMesa && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setModalMotivo({
                                  open: true,
                                  tipo: 'RETROTRAER',
                                  item: n,
                                  motivo: '',
                                  procesando: false,
                                  error: null
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300 text-xs font-bold"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Retrotraer</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setModalMotivo({
                                  open: true,
                                  tipo: 'CANCELAR',
                                  item: n,
                                  motivo: '',
                                  procesando: false,
                                  error: null
                                })
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold"
                            >
                              <Ban className="w-3.5 h-3.5" />
                              <span>Cancelar</span>
                            </button>
                          </>
                        )}

                        {n.estado === 'ENVIADA' && enMesa && (
                          <span className="text-[11px] text-indigo-800 font-semibold px-2 py-1 bg-indigo-50 rounded-lg border border-indigo-200">
                            Bloqueada: en propuesta/adjudicación UATP
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Historial local */}
      <div className="card-elevated p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-slate-600" />
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
            Registro de Movimientos del Establecimiento ({movimientos.length})
          </h3>
        </div>
        {movimientos.length === 0 ? (
          <p className="text-xs text-slate-500">Aún no hay movimientos registrados en este establecimiento.</p>
        ) : (
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
            {movimientos.slice(0, 20).map(m => (
              <div key={m.id} className="py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-800 font-bold text-[10px]">
                      {ETIQUETA_MOVIMIENTO[m.tipoMovimiento] || m.tipoMovimiento}
                    </span>
                    {m.codigoReferencia && (
                      <span className="font-mono text-[10px] font-bold text-indigo-700">
                        {m.codigoReferencia}
                      </span>
                    )}
                    <span className="text-slate-800 font-medium">{m.descripcion}</span>
                  </div>
                  {m.motivo && <div className="text-[11px] text-slate-500">Motivo: {m.motivo}</div>}
                </div>
                <div className="text-[11px] text-slate-500 shrink-0 text-right tabular-nums">
                  <div className="font-semibold text-slate-700">{m.usuarioActor}</div>
                  <div>{new Date(m.fechaHora).toLocaleString('es-CL')}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Crear / Editar */}
      {modalForm.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleGuardarForm}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full p-5 space-y-4 my-8"
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h3 className="font-black text-slate-900 text-sm">
                  {modalForm.editingId ? 'Editar Necesidad en Borrador' : 'Nueva Necesidad de Dotación'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {colegio.nombre} (RBD {colegio.rbd}) · Periodo {periodoActivo}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalForm(s => ({ ...s, open: false }))}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector 3 tipos */}
            {!modalForm.editingId && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ¿Qué tipo de requerimiento necesita el establecimiento?
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { id: 'HORAS_AULA', label: 'Horas Aula', sub: 'Asignatura', icon: GraduationCap },
                      { id: 'CARGO_DOCENTE', label: 'Cargo Docente', sub: 'Insp. Gral / UTP', icon: Briefcase },
                      { id: 'CARGO_ASISTENTE', label: 'Asistente / Prof.', sub: 'Ley 21.109', icon: Users }
                    ] as const
                  ).map(op => {
                    const Icon = op.icon;
                    const active = modalForm.tipoRequerimiento === op.id;
                    return (
                      <button
                        key={op.id}
                        type="button"
                        onClick={() =>
                          setModalForm(s => ({
                            ...s,
                            tipoRequerimiento: op.id,
                            especialidadOCargo: '',
                            estamentoDocente: op.id === 'CARGO_DOCENTE' ? 'DIRECTIVO' : 'DOCENTE_AULA',
                            horas: op.id === 'HORAS_AULA' ? 22 : 44
                          }))
                        }
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          active
                            ? 'bg-indigo-50 border-indigo-500 ring-1 ring-indigo-300'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <Icon className={`w-4 h-4 mb-1 ${active ? 'text-indigo-700' : 'text-slate-500'}`} />
                        <div className="text-[11px] font-black text-slate-900">{op.label}</div>
                        <div className="text-[10px] text-slate-500">{op.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {posibleDuplicado && (
              <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Posible duplicado detectado:</strong> Ya existe{' '}
                  <span className="font-mono font-bold">{posibleDuplicado.run}</span> para{' '}
                  <strong>{posibleDuplicado.titulo}</strong> ({posibleDuplicado.horasContrato}h).
                </div>
              </div>
            )}

            {modalForm.error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {modalForm.error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {modalForm.tipoRequerimiento === 'HORAS_AULA'
                    ? 'Especialidad / Asignatura Requerida'
                    : 'Cargo o Función Requerida'}
                </label>
                <input
                  type="text"
                  required
                  list={
                    modalForm.tipoRequerimiento === 'HORAS_AULA'
                      ? 'sug-aula'
                      : modalForm.tipoRequerimiento === 'CARGO_DOCENTE'
                      ? 'sug-cargo-docente'
                      : 'sug-cargo-asistente'
                  }
                  value={modalForm.especialidadOCargo}
                  onChange={e => setModalForm(s => ({ ...s, especialidadOCargo: e.target.value }))}
                  placeholder={
                    modalForm.tipoRequerimiento === 'HORAS_AULA'
                      ? 'Ej: Matemática, Lenguaje, Educación Diferencial...'
                      : modalForm.tipoRequerimiento === 'CARGO_DOCENTE'
                      ? 'Ej: Inspector General, Jefe UTP, Orientador...'
                      : 'Ej: Psicólogo/a, Trabajador/a Social, Inspector de Patio...'
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <datalist id="sug-aula">
                  <option value="Lenguaje y Comunicación" />
                  <option value="Matemática" />
                  <option value="Historia, Geografía y Ciencias Sociales" />
                  <option value="Ciencias Naturales" />
                  <option value="Inglés" />
                  <option value="Educación Física y Salud" />
                  <option value="Educación General Básica" />
                  <option value="Educación Diferencial (PIE)" />
                  <option value="Educación Parvularia" />
                </datalist>
                <datalist id="sug-cargo-docente">
                  <option value="Inspector General" />
                  <option value="Jefe Técnico-Pedagógico (UTP)" />
                  <option value="Director/a" />
                  <option value="Subdirector/a" />
                  <option value="Orientador/a" />
                  <option value="Evaluador/a" />
                  <option value="Encargado/a de Convivencia Escolar" />
                  <option value="Coordinador/a PIE" />
                  <option value="Coordinador/a CRA" />
                </datalist>
                <datalist id="sug-cargo-asistente">
                  <option value="Psicólogo/a (Dupla Psicosocial)" />
                  <option value="Trabajador/a Social (Dupla Psicosocial)" />
                  <option value="Fonoaudiólogo/a (PIE)" />
                  <option value="Terapeuta Ocupacional (PIE)" />
                  <option value="Kinesiólogo/a (PIE)" />
                  <option value="Inspector/a de Patio (Paradocente)" />
                  <option value="Técnico en Educación Parvularia" />
                  <option value="Técnico en Educación Especial" />
                  <option value="Administrativo / Secretaría" />
                  <option value="Auxiliar de Servicio / Aseo" />
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {modalForm.tipoRequerimiento === 'CARGO_ASISTENTE' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Estamento Ley 21.109
                    </label>
                    <select
                      value={modalForm.estamentoAsistente}
                      onChange={e =>
                        setModalForm(s => ({
                          ...s,
                          estamentoAsistente: e.target.value as EstamentoAsistente
                        }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      {ESTAMENTOS_ASISTENTE_OPCIONES.map(est => (
                        <option key={est.id} value={est.id}>
                          {est.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : modalForm.tipoRequerimiento === 'CARGO_DOCENTE' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Función Directiva / UTP
                    </label>
                    <select
                      value={modalForm.tipoFuncionNoAula}
                      onChange={e => {
                        const fn = e.target.value as TipoFuncionNoAula;
                        const found = FUNCIONES_CARGO_DOCENTE.find(f => f.id === fn);
                        setModalForm(s => ({
                          ...s,
                          tipoFuncionNoAula: fn,
                          estamentoDocente: found?.estamento || 'DIRECTIVO'
                        }));
                      }}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      {FUNCIONES_CARGO_DOCENTE.map(fn => (
                        <option key={fn.id} value={fn.id}>
                          {fn.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Estamento</label>
                    <select
                      value={modalForm.estamentoDocente}
                      onChange={e =>
                        setModalForm(s => ({
                          ...s,
                          estamentoDocente: e.target.value as EstamentoDocente
                        }))
                      }
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                    >
                      {ESTAMENTOS.map(est => (
                        <option key={est.id} value={est.id}>
                          {est.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Horas Cronológicas Semanales (1 - 44)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={44}
                    required
                    value={modalForm.horas}
                    onChange={e => setModalForm(s => ({ ...s, horas: Number(e.target.value) }))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Fuente de Financiamiento
                </label>
                <select
                  value={modalForm.fuente}
                  onChange={e =>
                    setModalForm(s => ({
                      ...s,
                      fuente: e.target.value as 'SUBVENCION_GENERAL' | 'SEP' | 'PIE'
                    }))
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white"
                >
                  <option value="SUBVENCION_GENERAL">Subvención General</option>
                  <option value="SEP">SEP (Subvención Escolar Preferencial)</option>
                  <option value="PIE">PIE (Programa de Integración Escolar - Dto. 170)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Justificación Pedagógica / Operativa
                </label>
                <textarea
                  rows={3}
                  required
                  value={modalForm.justificacion}
                  onChange={e => setModalForm(s => ({ ...s, justificacion: e.target.value }))}
                  placeholder="Describe la necesidad curricular, cobertura de cargo directivo, dupla SEP, equipo PIE o reemplazo requerido..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalForm(s => ({ ...s, open: false }))}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={modalForm.guardando}
                className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-sm disabled:opacity-50"
              >
                {modalForm.guardando
                  ? 'Guardando...'
                  : modalForm.editingId
                  ? 'Guardar Cambios'
                  : 'Guardar en Borrador'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal Retrotraer / Cancelar */}
      {modalMotivo.open && modalMotivo.item && (
        <div className="fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmarMotivo}
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <h3 className="font-black text-slate-900 text-sm">
                {modalMotivo.tipo === 'RETROTRAER'
                  ? 'Retrotraer Necesidad desde Movilidad'
                  : 'Cancelar Necesidad'}
              </h3>
              <button
                type="button"
                onClick={() => setModalMotivo(s => ({ ...s, open: false }))}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600">
              {modalMotivo.tipo === 'RETROTRAER'
                ? `La necesidad ${modalMotivo.item.run} (${modalMotivo.item.titulo}, ${modalMotivo.item.horasContrato}h) saldrá de la Bolsa de Movilidad y volverá a Borrador.`
                : `La necesidad ${modalMotivo.item.run} (${modalMotivo.item.titulo}, ${modalMotivo.item.horasContrato}h) quedará cancelada y no aparecerá en Movilidad.`}
            </p>

            {modalMotivo.error && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {modalMotivo.error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Motivo (obligatorio para el registro de movimientos)
              </label>
              <textarea
                rows={3}
                required
                value={modalMotivo.motivo}
                onChange={e => setModalMotivo(s => ({ ...s, motivo: e.target.value }))}
                placeholder="Ingresa el motivo del cambio..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModalMotivo(s => ({ ...s, open: false }))}
                className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl"
              >
                Volver
              </button>
              <button
                type="submit"
                disabled={modalMotivo.procesando}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl shadow-sm disabled:opacity-50 ${
                  modalMotivo.tipo === 'RETROTRAER'
                    ? 'bg-amber-600 hover:bg-amber-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {modalMotivo.procesando
                  ? 'Procesando...'
                  : modalMotivo.tipo === 'RETROTRAER'
                  ? 'Confirmar Retroceso'
                  : 'Confirmar Cancelación'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
