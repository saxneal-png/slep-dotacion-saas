import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  Trash2, 
  Edit, 
  Eye, 
  Building2, 
  Coins, 
  Scale, 
  ShieldAlert,
  GraduationCap,
  Layers,
  ChevronDown,
  ChevronUp,
  Save,
  X,
  Clock,
  Search,
  Filter
} from 'lucide-react';
import { 
  Establecimiento, 
  Docente, 
  AsignacionHoraria, 
  CursoSae,
  CalidadJuridicaDocente, 
  EstamentoDocente,
  DocenteConsolidadoTerritorial,
  FuncionNoAulaDocente,
  TipoFuncionNoAula,
  FuenteFinanciamientoFuncion
} from '../types';
import { calcularJornadaMinutos, validarSobreasignacionDocente, calcularAuditoriaDocenteMultitramo, buscarContratoMinimoPorTabla } from '@slep/mineduc-engine';
import { obtenerDocentesConsolidadosTerritorio } from '../services/dotacionCalculationService';
import { DocenteFichaDetalleModal } from '../components/DocenteFichaDetalleModal';

interface DocentesDotacionViewProps {
  colegio: Establecimiento | null;
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  onGuardarDocente: (docente: Docente) => void;
  onEliminarDocente: (id: string) => void;
  todosLosColegios?: Establecimiento[];
  todosLosDocentes?: Docente[];
  todasLasAsignaciones?: AsignacionHoraria[];
  cursos?: CursoSae[];
  onGuardarAsignacion?: (asig: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
}

const ESTAMENTOS: { id: EstamentoDocente; label: string }[] = [
  { id: 'DOCENTE_AULA', label: 'Docente de Aula Regular' },
  { id: 'DOCENTE_DIFERENCIAL', label: 'Docente Educación Diferencial (PIE)' },
  { id: 'PROFESIONAL_PAE', label: 'Profesional Asistente PAE (Fono/Psico/TO)' },
  { id: 'TECNICO_ESPECIAL', label: 'Técnico en Educación Especial' },
  { id: 'DIRECTIVO', label: 'Directivo (Director / Inspector / UTP)' },
  { id: 'TECNICO_PEDAGOGICO', label: 'Técnico Pedagógico' },
  { id: 'COORDINADOR_CRA', label: 'Coordinador CRA' }
];

const TIPOS_FUNCIONES_LABELS: Record<TipoFuncionNoAula, { label: string; defaultNombre: string; badgeColor: string }> = {
  DIRECTIVA: { label: 'Gestión Directiva (Dirección / Subdirección)', defaultNombre: 'Dirección / Subdirección', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  INSPECTORIA: { label: 'Inspectoría General', defaultNombre: 'Inspectoría General', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' },
  UTP: { label: 'Jefatura Técnico-Pedagógica (UTP)', defaultNombre: 'Jefatura UTP', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  COORDINACION: { label: 'Coordinación Pedagógica UTP', defaultNombre: 'Coordinación UTP', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  CONVIVENCIA: { label: 'Encargado Convivencia Escolar', defaultNombre: 'Convivencia Escolar', badgeColor: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  CRA: { label: 'Coordinación CRA (Biblioteca)', defaultNombre: 'Coordinador CRA', badgeColor: 'bg-amber-100 text-amber-800 border-amber-200' },
  ENLACES: { label: 'Enlaces / Informática Educativa', defaultNombre: 'Coordinador Enlaces / TIC', badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200' },
  EXTRAESCOLAR: { label: 'Actividades Extraescolares / ACLE', defaultNombre: 'Encargado Extraescolar', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  EVALUACION: { label: 'Evaluador Pedagógico', defaultNombre: 'Evaluador Pedagógico', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' },
  ORIENTACION: { label: 'Orientación Educacional', defaultNombre: 'Orientador Educacional', badgeColor: 'bg-teal-100 text-teal-800 border-teal-200' },
  GREMIAL: { label: 'Horas Gremiales / Dirigencia Docente', defaultNombre: 'Horas Gremiales', badgeColor: 'bg-rose-100 text-rose-800 border-rose-200' },
  ADMINISTRATIVA: { label: 'Función Administrativa / Apoyo Institucional', defaultNombre: 'Apoyo Administrativo', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' },
  OTRA: { label: 'Otra Función Fuera de Aula', defaultNombre: 'Función No Aula', badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' }
};

export const DocentesDotacionView: React.FC<DocentesDotacionViewProps> = ({
  colegio,
  docentes,
  asignaciones,
  onGuardarDocente,
  onEliminarDocente,
  todosLosColegios = [],
  todosLosDocentes = [],
  todasLasAsignaciones = [],
  cursos = [],
  onGuardarAsignacion,
  onEliminarAsignacion
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Docente | null>(null);
  const [docenteFicha, setDocenteFicha] = useState<DocenteConsolidadoTerritorial | null>(null);
  const [expandedDocenteId, setExpandedDocenteId] = useState<string | null>(null);
  const [nuevaAsigDocenteId, setNuevaAsigDocenteId] = useState<string | null>(null);
  const [nuevaAsigCursoId, setNuevaAsigCursoId] = useState<string>(cursos[0]?.id || 'TRANSVERSAL');
  const [nuevaAsigNombre, setNuevaAsigNombre] = useState<string>('Lenguaje y Comunicación');
  const [nuevaAsigHoras, setNuevaAsigHoras] = useState<number>(4);
  const [nuevaAsigEsTallerSep, setNuevaAsigEsTallerSep] = useState<boolean>(false);

  // Filtros de búsqueda de docentes
  const [busquedaDocente, setBusquedaDocente] = useState('');
  const [filtroEstamento, setFiltroEstamento] = useState<string>('TODOS');
  const [filtroEstadoCarga, setFiltroEstadoCarga] = useState<'TODOS' | 'SOBREASIGNADOS' | 'HOLGURA' | 'EXACTO'>('TODOS');

  const [run, setRun] = useState('');
  const [nombres, setNombres] = useState('');
  const [apellidos, setApellidos] = useState('');
  const [titulo, setTitulo] = useState('');
  const [calidadJuridica, setCalidadJuridica] = useState<CalidadJuridicaDocente>('TITULAR');
  const [estamento, setEstamento] = useState<EstamentoDocente>('DOCENTE_AULA');
  const [horasContrato, setHorasContrato] = useState(44);
  const [asignaturaPrincipal, setAsignaturaPrincipal] = useState('Lenguaje y Comunicación');
  const [aplicaArticulo69, setAplicaArticulo69] = useState(false);

  // Múltiples Funciones No Aula / Administrativas
  const [funcionesNoAula, setFuncionesNoAula] = useState<FuncionNoAulaDocente[]>([]);
  const [nuevaFuncionTipo, setNuevaFuncionTipo] = useState<TipoFuncionNoAula>('COORDINACION');
  const [nuevaFuncionNombre, setNuevaFuncionNombre] = useState('');
  const [nuevaFuncionHoras, setNuevaFuncionHoras] = useState<number>(2);
  const [nuevaFuncionFinanciamiento, setNuevaFuncionFinanciamiento] = useState<FuenteFinanciamientoFuncion>('SUBVENCION_GENERAL');

  const [horasDirectivas, setHorasDirectivas] = useState(0);
  const [horasInspectorGeneral, setHorasInspectorGeneral] = useState(0);
  const [horasTecnicoPedagogicas, setHorasTecnicoPedagogicas] = useState(0);
  const [horasCoordinacion, setHorasCoordinacion] = useState(0);
  const [tipoCoordinacion, setTipoCoordinacion] = useState('');

  // Fuentes de Financiamiento desglosadas
  const [horasSubvGeneralTitular, setHorasSubvGeneralTitular] = useState<number>(44);
  const [horasSubvGeneralContrata, setHorasSubvGeneralContrata] = useState<number>(0);
  const [horasSepTitular, setHorasSepTitular] = useState<number>(0);
  const [horasSepContrata, setHorasSepContrata] = useState<number>(0);
  const [horasPieTitular, setHorasPieTitular] = useState<number>(0);
  const [horasPieContrata, setHorasPieContrata] = useState<number>(0);

  // Funciones exentas de proporción
  const [horasTallerSep, setHorasTallerSep] = useState<number>(0);
  const [horasTrabajoColaborativo, setHorasTrabajoColaborativo] = useState<number>(0);

  if (!colegio) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        Selecciona un establecimiento en la barra superior.
      </div>
    );
  }

  const regimenTabla = colegio.porcentajePrioritarios >= 80 ? '60_40' : '65_35';
  const regimenProporcion = colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35';

  // Consolidado territorial para detectar multi-escuelas
  const consolidadosTerritoriales = useMemo(() => {
    const cols = todosLosColegios.length ? todosLosColegios : [colegio];
    const docs = todosLosDocentes.length ? todosLosDocentes : docentes;
    const asigs = todasLasAsignaciones.length ? todasLasAsignaciones : asignaciones;
    return obtenerDocentesConsolidadosTerritorio(cols, docs, asigs);
  }, [todosLosColegios, todosLosDocentes, todasLasAsignaciones, colegio, docentes, asignaciones]);

  const abrirModalNuevo = () => {
    setEditingDoc(null);
    setRun('');
    setNombres('');
    setApellidos('');
    setTitulo('');
    setCalidadJuridica('TITULAR');
    setEstamento('DOCENTE_AULA');
    setHorasContrato(44);
    setFuncionesNoAula([]);
    setNuevaFuncionTipo('COORDINACION');
    setNuevaFuncionNombre('');
    setNuevaFuncionHoras(2);
    setNuevaFuncionFinanciamiento('SUBVENCION_GENERAL');
    setHorasDirectivas(0);
    setHorasInspectorGeneral(0);
    setHorasTecnicoPedagogicas(0);
    setHorasCoordinacion(0);
    setTipoCoordinacion('');
    setHorasTallerSep(0);
    setHorasTrabajoColaborativo(0);
    setAsignaturaPrincipal('Lenguaje y Comunicación');
    setAplicaArticulo69(false);
    setHorasSubvGeneralTitular(44);
    setHorasSubvGeneralContrata(0);
    setHorasSepTitular(0);
    setHorasSepContrata(0);
    setHorasPieTitular(0);
    setHorasPieContrata(0);
    setModalOpen(true);
  };

  const abrirModalEditar = (d: Docente) => {
    setEditingDoc(d);
    setRun(d.run);
    setNombres(d.nombres);
    setApellidos(d.apellidos);
    setTitulo(d.titulo || '');
    setCalidadJuridica(d.calidadJuridica);
    setEstamento(d.estamento);
    setHorasContrato(d.horasContrato);
    
    // Cargar o migrar funciones no aula dinámicas
    if (d.funcionesNoAula && d.funcionesNoAula.length > 0) {
      setFuncionesNoAula([...d.funcionesNoAula]);
    } else {
      const legacyList: FuncionNoAulaDocente[] = [];
      if (d.horasDirectivas) legacyList.push({ id: `f-${Date.now()}-1`, tipo: 'DIRECTIVA', nombre: 'Gestión Directiva (Dirección/Subdirección)', horas: d.horasDirectivas, financiamiento: 'SUBVENCION_GENERAL' });
      if (d.horasInspectorGeneral) legacyList.push({ id: `f-${Date.now()}-2`, tipo: 'INSPECTORIA', nombre: 'Inspectoría General', horas: d.horasInspectorGeneral, financiamiento: 'SUBVENCION_GENERAL' });
      if (d.horasTecnicoPedagogicas) legacyList.push({ id: `f-${Date.now()}-3`, tipo: 'UTP', nombre: 'Jefatura Técnico-Pedagógica (UTP)', horas: d.horasTecnicoPedagogicas, financiamiento: 'SUBVENCION_GENERAL' });
      if (d.horasCoordinacion) legacyList.push({ id: `f-${Date.now()}-4`, tipo: 'COORDINACION', nombre: d.tipoCoordinacion ? `Coordinación UTP (${d.tipoCoordinacion})` : 'Coordinación Pedagógica UTP', horas: d.horasCoordinacion, financiamiento: 'SUBVENCION_GENERAL' });
      setFuncionesNoAula(legacyList);
    }

    setNuevaFuncionTipo('COORDINACION');
    setNuevaFuncionNombre('');
    setNuevaFuncionHoras(2);
    setNuevaFuncionFinanciamiento('SUBVENCION_GENERAL');

    setHorasDirectivas(d.horasDirectivas || 0);
    setHorasInspectorGeneral(d.horasInspectorGeneral || 0);
    setHorasTecnicoPedagogicas(d.horasTecnicoPedagogicas || 0);
    setHorasCoordinacion(d.horasCoordinacion || 0);
    setTipoCoordinacion(d.tipoCoordinacion || '');
    setHorasTallerSep(d.horasTallerSep || 0);
    setHorasTrabajoColaborativo(d.horasTrabajoColaborativo || 0);
    setAsignaturaPrincipal(d.asignaturaPrincipal || '');
    setAplicaArticulo69(Boolean(d.aplicaArticulo69));

    // Si ya tiene financiamiento guardado
    let subTit = d.horasSubvencionGeneralTitular || 0;
    let subCon = d.horasSubvencionGeneralContrata || 0;
    let sepTit = d.horasSepTitular || 0;
    let sepCon = d.horasSepContrata || 0;
    let pieTit = d.horasPieTitular || 0;
    let pieCon = d.horasPieContrata || 0;

    const suma = subTit + subCon + sepTit + sepCon + pieTit + pieCon;
    if (suma === 0 && d.horasContrato > 0) {
      if (d.calidadJuridica === 'TITULAR') {
        subTit = d.horasContrato;
      } else {
        subCon = d.horasContrato;
      }
    }

    setHorasSubvGeneralTitular(subTit);
    setHorasSubvGeneralContrata(subCon);
    setHorasSepTitular(sepTit);
    setHorasSepContrata(sepCon);
    setHorasPieTitular(pieTit);
    setHorasPieContrata(pieCon);

    setModalOpen(true);
  };

  const agregarFuncionNoAula = () => {
    if (!nuevaFuncionHoras || nuevaFuncionHoras <= 0) return;
    const defaultInfo = TIPOS_FUNCIONES_LABELS[nuevaFuncionTipo];
    const nombreFinal = nuevaFuncionNombre.trim() || defaultInfo.defaultNombre;
    const item: FuncionNoAulaDocente = {
      id: `func-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipo: nuevaFuncionTipo,
      nombre: nombreFinal,
      horas: Number(nuevaFuncionHoras),
      financiamiento: nuevaFuncionFinanciamiento
    };
    setFuncionesNoAula(prev => [...prev, item]);
    setNuevaFuncionNombre('');
    setNuevaFuncionHoras(2);
    setNuevaFuncionFinanciamiento('SUBVENCION_GENERAL');
  };

  const eliminarFuncionNoAula = (id: string) => {
    setFuncionesNoAula(prev => prev.filter(f => f.id !== id));
  };

  const totalHorasFuncionesNoAula = useMemo(() => {
    return funcionesNoAula.reduce((s, f) => s + (Number(f.horas) || 0), 0);
  }, [funcionesNoAula]);

  const sumaFinanciamiento = 
    horasSubvGeneralTitular + horasSubvGeneralContrata +
    horasSepTitular + horasSepContrata +
    horasPieTitular + horasPieContrata;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let finalFunciones = [...funcionesNoAula];
    // Auto-commit si el usuario escribió datos en la fila pero no presionó el botón "+" antes de Guardar Docente
    if (nuevaFuncionHoras > 0 && nuevaFuncionNombre.trim()) {
      finalFunciones.push({
        id: `func-${Date.now()}-pending`,
        tipo: nuevaFuncionTipo,
        nombre: nuevaFuncionNombre.trim(),
        horas: Number(nuevaFuncionHoras),
        financiamiento: nuevaFuncionFinanciamiento
      });
    }

    const dirHours = finalFunciones.filter(f => f.tipo === 'DIRECTIVA').reduce((s, f) => s + Number(f.horas || 0), 0);
    const inspHours = finalFunciones.filter(f => f.tipo === 'INSPECTORIA').reduce((s, f) => s + Number(f.horas || 0), 0);
    const utpHours = finalFunciones.filter(f => f.tipo === 'UTP' || f.tipo === 'EVALUACION' || f.tipo === 'ORIENTACION').reduce((s, f) => s + Number(f.horas || 0), 0);
    const coordHours = finalFunciones.filter(f => f.tipo === 'COORDINACION' || f.tipo === 'CONVIVENCIA' || f.tipo === 'CRA' || f.tipo === 'ENLACES' || f.tipo === 'EXTRAESCOLAR' || f.tipo === 'GREMIAL' || f.tipo === 'ADMINISTRATIVA' || f.tipo === 'OTRA').reduce((s, f) => s + Number(f.horas || 0), 0);

    const doc: Docente = {
      id: editingDoc ? editingDoc.id : `doc-${Date.now()}`,
      rbd: colegio.rbd,
      run: run.trim(),
      nombres: nombres.trim(),
      apellidos: apellidos.trim(),
      titulo: titulo.trim() || undefined,
      calidadJuridica,
      estamento,
      horasContrato: Number(horasContrato),
      horasSubvencionGeneralTitular: Number(horasSubvGeneralTitular) || 0,
      horasSubvencionGeneralContrata: Number(horasSubvGeneralContrata) || 0,
      horasSepTitular: Number(horasSepTitular) || 0,
      horasSepContrata: Number(horasSepContrata) || 0,
      horasPieTitular: Number(horasPieTitular) || 0,
      horasPieContrata: Number(horasPieContrata) || 0,
      horasDirectivas: dirHours || Number(horasDirectivas) || 0,
      horasInspectorGeneral: inspHours || Number(horasInspectorGeneral) || 0,
      horasTecnicoPedagogicas: utpHours || Number(horasTecnicoPedagogicas) || 0,
      horasCoordinacion: coordHours || Number(horasCoordinacion) || 0,
      tipoCoordinacion: tipoCoordinacion.trim() || undefined,
      funcionesNoAula: finalFunciones.length > 0 ? finalFunciones : undefined,
      horasTallerSep: Number(horasTallerSep) || 0,
      horasTrabajoColaborativo: Number(horasTrabajoColaborativo) || 0,
      asignaturaPrincipal: asignaturaPrincipal.trim() || undefined,
      aplicaArticulo69
    };
    onGuardarDocente(doc);
    setModalOpen(false);
  };

  const verFichaDocente = (d: Docente) => {
    const consolidado = consolidadosTerritoriales.find(c => c.run.trim() === d.run.trim());
    if (consolidado) {
      setDocenteFicha(consolidado);
    }
  };

  // Resúmenes de sobreasignación considerando horas directivas, inspectoría, UTP, coordinaciones, taller SEP y trabajo colaborativo
  const docentesAuditados = docentes.map(d => {
    const asigs = asignaciones.filter(a => a.docenteId === d.id || (a.coDocenteId === d.id && a.tieneCoDocente));
    const asigsCoDocencia = asigs.filter(a => (a.coDocenteId === d.id && a.tieneCoDocente) || a.esCoDocencia || a.esAgrupacionFlexible || a.tipoApoyo === 'CO_DOCENCIA' || a.tipoApoyo === 'AGRUPACION_FLEXIBLE' || a.tipoApoyo === 'REFUERZO_AULA' || a.tipoApoyo === 'APOYO_DOCENTE');
    const asigsTallerSep = asigs.filter(a => a.docenteId === d.id && (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP'));
    const asigsTrabajoColab = asigs.filter(a => a.docenteId === d.id && (a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO'));
    const asigsAulaRegular = asigs.filter(a => a.docenteId === d.id && !asigsCoDocencia.includes(a) && !asigsTallerSep.includes(a) && !asigsTrabajoColab.includes(a));

    const pedAulaRegular = asigsAulaRegular.reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const pedCoDocencia = asigsCoDocencia.reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const pedTallerSep = asigsTallerSep.reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const pedTrabajoColab = asigsTrabajoColab.reduce((s, a) => s + a.horasPedagogicasAula, 0);
    const pedTotalAsignadas = pedAulaRegular + pedCoDocencia + pedTallerSep + pedTrabajoColab;

    const hDir = d.horasDirectivas || 0;
    const hInsp = d.horasInspectorGeneral || 0;
    const hTec = d.horasTecnicoPedagogicas || 0;
    const hCoord = d.horasCoordinacion || 0;
    const hCoordPie = d.horasCoordinacionPie || 0;
    const hConv = d.horasConvivenciaEscolar || 0;
    const hExtra = d.horasExtraescolar || 0;
    const hTallerSepDoc = d.horasTallerSep || 0;
    const hColabDoc = d.horasTrabajoColaborativo || 0;

    const sepExentas = Math.max(hTallerSepDoc, pedTallerSep);
    const pieCronologicas = Math.max(hColabDoc, pedTrabajoColab, hCoordPie, (d.estamento === 'DOCENTE_DIFERENCIAL' || ((Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0)) > 0 && pedAulaRegular === 0) ? (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0)) : ((Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0)) > 0 ? (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0)) : 0)));

    const sumFuncionesNoAula = (d.funcionesNoAula && d.funcionesNoAula.length > 0)
      ? d.funcionesNoAula.reduce((s, f) => s + (Number(f.horas) || 0), 0)
      : 0;
    const hInstNoAula = sumFuncionesNoAula > 0
      ? sumFuncionesNoAula
      : (hDir + hInsp + hTec + hCoord + hConv + hExtra);
    const hExentas = hInstNoAula + sepExentas + pieCronologicas;
    const horasParaDocencia = Math.max(0, d.horasContrato - hExentas);
    const esExento = horasParaDocencia === 0;

    // La proporción Ley 20.903 solo aplica sobre horas de aula regular
    const calculo = !esExento
      ? calcularJornadaMinutos(horasParaDocencia, pedAulaRegular, regimenTabla, Boolean(d.aplicaArticulo69))
      : {
          horasContrato: 0,
          minutosContratoTotales: 0,
          horasPedagogicasDisponiblesMax: 0,
          minutosLectivosDisponiblesMax: 0,
          horasPedagogicasAsignadas: pedAulaRegular,
          minutosLectivosAsignados: pedAulaRegular * 45,
          horasPedagogicasVacantes: 0,
          minutosLectivosVacantes: 0,
          minutosRecreoAsignados: 0,
          minutosNoLectivosCalculados: 0,
          minutosUsadosTotales: 0,
          esSobreasignado: pedAulaRegular > 0,
          minutosSobreasignados: pedAulaRegular * 45,
          cumple65_35: pedAulaRegular === 0,
          aplicaArticulo69: Boolean(d.aplicaArticulo69),
          minutosReduccionArticulo69: 0,
          horasReduccionArticulo69: 0
        };

    const valSobre = !esExento
      ? validarSobreasignacionDocente(horasParaDocencia, pedAulaRegular, regimenProporcion)
      : {
          estaSobreasignado: pedAulaRegular > 0,
          horasAsignadas: pedAulaRegular,
          horasMaxLectivasPermitidas: 0,
          excesoHoras: pedAulaRegular,
          mensaje: pedAulaRegular > 0 ? `Funcionario No Aula con ${pedAulaRegular} HA asignadas.` : 'Exento (Gestión Institucional / No Aula).'
        };

    const ped65 = asigsAulaRegular
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const ped60 = asigsAulaRegular
      .filter(a => {
        const c = cursos.find(x => x.id === a.cursoId);
        return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80);
      })
      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

    const auditMulti = calcularAuditoriaDocenteMultitramo({
      horasAula65_35: ped65,
      horasAula60_40: ped60,
      horasPieCronologicas: pieCronologicas,
      horasTallerSepExento: sepExentas,
      horasPieSepCronologicas: pieCronologicas,
      horasNoAulaInstitucionales: hInstNoAula,
      horasContratoReal: d.horasContrato,
      aplicaArticulo69: Boolean(d.aplicaArticulo69)
    });

    const docTerritorial = consolidadosTerritoriales.find(c => c.run.trim() === d.run.trim());

    const subTotalDoc = Number(d.horasSubvencionGeneralTitular || 0) + Number(d.horasSubvencionGeneralContrata || 0);
    const sepPieTotalDoc = Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0) + Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0);
    const reqSubvDoc = buscarContratoMinimoPorTabla(pedAulaRegular, regimenTabla);
    const esImprocedenteFinanciamiento = reqSubvDoc > subTotalDoc && sepPieTotalDoc > 0 && pedAulaRegular > 0;
    const deficitFinanciamiento = esImprocedenteFinanciamiento ? (reqSubvDoc - subTotalDoc) : 0;

    return {
      docente: d,
      pedAsignadas: pedTotalAsignadas,
      pedAulaRegular,
      pedCoDocencia,
      pedTallerSep,
      pedTrabajoColab,
      ped65,
      ped60,
      pieCronologicas,
      sepExentas,
      horasParaDocencia,
      calculo,
      valSobre,
      auditMulti,
      esExento,
      hDir,
      hInsp,
      hTec,
      hCoord,
      hTallerSepDoc,
      hColabDoc,
      docTerritorial,
      esImprocedenteFinanciamiento,
      deficitFinanciamiento,
      reqSubvDoc,
      subTotalDoc
    };
  });

  const sobreasignadosCount = docentesAuditados.filter(item => item.valSobre.estaSobreasignado).length;

  // Filtrado de docentes para búsqueda rápida
  const docentesFiltrados = useMemo(() => {
    return docentesAuditados.filter(({ docente: d, auditMulti, valSobre, esImprocedenteFinanciamiento }) => {
      const q = busquedaDocente.toLowerCase().trim();
      const matchTexto = q === '' ||
        `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) ||
        d.run.toLowerCase().includes(q) ||
        (d.asignaturaPrincipal || '').toLowerCase().includes(q) ||
        (d.titulo || '').toLowerCase().includes(q);

      const matchEstamento = filtroEstamento === 'TODOS' || d.estamento === filtroEstamento;

      let matchEstado = true;
      if (filtroEstadoCarga === 'SOBREASIGNADOS') {
        matchEstado = auditMulti.esInfractorExcesoLectivo || valSobre.estaSobreasignado || auditMulti.estadoSaldo === 'DEFICIT' || esImprocedenteFinanciamiento;
      } else if (filtroEstadoCarga === 'HOLGURA') {
        matchEstado = auditMulti.estadoSaldo === 'HOLGURA';
      } else if (filtroEstadoCarga === 'EXACTO') {
        matchEstado = auditMulti.estadoSaldo === 'EXACTO';
      }

      return matchTexto && matchEstamento && matchEstado;
    });
  }, [docentesAuditados, busquedaDocente, filtroEstamento, filtroEstadoCarga]);

  return (
    <div className="space-y-6">
      {/* Banner Superior Ley 20.903 y Régimen Escolar */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              Dotación Docente & Ley 20.903
            </h2>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              colegio.porcentajePrioritarios >= 80 ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
            }`}>
              Régimen {regimenProporcion} ({colegio.porcentajePrioritarios}% Prioritarios SEP)
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Gestión de planta docente, horas directivas, técnicas, fuentes de financiamiento (Subv. General, SEP, PIE) y control de topes según tablas oficiales MINEDUC.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={abrirModalNuevo}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Docente</span>
          </button>
        </div>
      </div>

      {/* Barra de Búsqueda y Filtros Rápidos de Nómina */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2 relative">
          <Search className="w-4 h-4 text-orange-500 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={busquedaDocente}
            onChange={(e) => setBusquedaDocente(e.target.value)}
            placeholder="🔍 Buscar docente por nombre, apellido, RUN, título o asignatura..."
            className="w-full pl-9 pr-8 py-2.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-slate-400 font-medium shadow-xs"
          />
          {busquedaDocente && (
            <button
              onClick={() => setBusquedaDocente('')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filtroEstamento}
              onChange={(e) => setFiltroEstamento(e.target.value)}
              className="px-2.5 py-2 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="TODOS">Todos los Estamentos ({docentes.length})</option>
              {ESTAMENTOS.map(est => (
                <option key={est.id} value={est.id}>
                  {est.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px]">
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('TODOS')}
              className={`px-2.5 py-1.5 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'TODOS'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('SOBREASIGNADOS')}
              className={`px-2.5 py-1.5 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'SOBREASIGNADOS'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Alertas ({sobreasignadosCount})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('HOLGURA')}
              className={`px-2.5 py-1.5 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'HOLGURA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Holgura
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('EXACTO')}
              className={`px-2.5 py-1.5 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'EXACTO'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              Exacto
            </button>
          </div>

          <span className="text-[11px] font-bold text-slate-700 bg-orange-50 border border-orange-200 px-2.5 py-1.5 rounded-lg">
            {docentesFiltrados.length} de {docentes.length} docentes
          </span>
        </div>
      </div>

      {/* Compendio de Financiamiento y Dotación (7 Métricas Oficiales) */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <div className="flex items-center gap-2">
            <Coins className="w-4 h-4 text-orange-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Compendio de Financiamiento Oficial de Planta ({colegio.nombre})
            </h3>
          </div>
          <span className="text-[11px] font-bold text-slate-500 font-mono">
            Total Planta: {docentes.reduce((s, d) => s + d.horasContrato, 0)} hrs contratadas
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {/* 1. Total Contrato */}
          <div className="bg-slate-900 text-white p-3 rounded-xl">
            <span className="text-[10px] text-slate-300 font-semibold block uppercase">1. Total Contrato</span>
            <span className="text-xl font-black">{docentes.reduce((s, d) => s + d.horasContrato, 0)} <span className="text-xs font-normal text-slate-400">hrs</span></span>
          </div>

          {/* 2. Subv. General Titular */}
          <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-xl">
            <span className="text-[10px] text-emerald-800 font-semibold block uppercase">2. Subv. Gen. Titular</span>
            <span className="text-xl font-black text-emerald-900">{docentes.reduce((s, d) => s + (d.horasSubvencionGeneralTitular || 0), 0)} <span className="text-xs font-normal text-emerald-700">hrs</span></span>
          </div>

          {/* 3. Subv. General Contrata */}
          <div className="bg-emerald-50/50 border border-emerald-200 p-3 rounded-xl">
            <span className="text-[10px] text-emerald-800 font-semibold block uppercase">3. Subv. Gen. Contrata</span>
            <span className="text-xl font-black text-emerald-800">{docentes.reduce((s, d) => s + (d.horasSubvencionGeneralContrata || 0), 0)} <span className="text-xs font-normal text-emerald-600">hrs</span></span>
          </div>

          {/* 4. SEP Titular */}
          <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
            <span className="text-[10px] text-purple-800 font-semibold block uppercase">4. SEP Titular</span>
            <span className="text-xl font-black text-purple-900">{docentes.reduce((s, d) => s + (d.horasSepTitular || 0), 0)} <span className="text-xs font-normal text-purple-700">hrs</span></span>
          </div>

          {/* 5. SEP Contrata */}
          <div className="bg-purple-50/50 border border-purple-200 p-3 rounded-xl">
            <span className="text-[10px] text-purple-800 font-semibold block uppercase">5. SEP Contrata</span>
            <span className="text-xl font-black text-purple-800">{docentes.reduce((s, d) => s + (d.horasSepContrata || 0), 0)} <span className="text-xs font-normal text-purple-600">hrs</span></span>
          </div>

          {/* 6. PIE Titular */}
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl">
            <span className="text-[10px] text-blue-800 font-semibold block uppercase">6. PIE Titular</span>
            <span className="text-xl font-black text-blue-900">{docentes.reduce((s, d) => s + (d.horasPieTitular || 0), 0)} <span className="text-xs font-normal text-blue-700">hrs</span></span>
          </div>

          {/* 7. PIE Contrata */}
          <div className="bg-blue-50/50 border border-blue-200 p-3 rounded-xl">
            <span className="text-[10px] text-blue-800 font-semibold block uppercase">7. PIE Contrata</span>
            <span className="text-xl font-black text-blue-800">{docentes.reduce((s, d) => s + (d.horasPieContrata || 0), 0)} <span className="text-xs font-normal text-blue-600">hrs</span></span>
          </div>
        </div>
      </div>

      {/* Indicadores Estadísticos MINEDUC Multitramo (Ley 20.903) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Contratos Requeridos</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-extrabold text-indigo-600">
              {docentesAuditados.reduce((s, item) => s + item.auditMulti.contratoCalculadoTotal, 0)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">hrs</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Lookup acumulado MINEDUC</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Contratos Reales</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-extrabold text-slate-800">
              {docentes.reduce((s, d) => s + d.horasContrato, 0)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">hrs</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Jornadas pagadas en planta</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Horas PIE / SEP</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-extrabold text-purple-600">
              {docentesAuditados.reduce((s, item) => s + (item.pieCronologicas + item.sepExentas), 0)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">hrs</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Apoyo cronológico directo</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Sobrante Total (Holgura)</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-extrabold text-emerald-600">
              +{docentesAuditados.reduce((s, item) => s + (item.auditMulti.saldoHoras > 0 ? item.auditMulti.saldoHoras : 0), 0)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">hrs</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Horas libres contratadas</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Déficit (Faltan Contratar)</span>
          <div className="flex items-baseline gap-1 mt-1.5">
            <span className="text-2xl font-extrabold text-rose-600">
              -{docentesAuditados.reduce((s, item) => s + (item.auditMulti.saldoHoras < 0 ? Math.abs(item.auditMulti.saldoHoras) : 0), 0)}
            </span>
            <span className="text-xs text-slate-400 font-semibold">hrs</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">Déficit de cobertura de aula</span>
        </div>
      </div>

      {/* Alerta de Sobreasignación Local */}
      {sobreasignadosCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>
              <strong>Alerta de Incumplimiento Ley 20.903:</strong> Se han detectado <strong>{sobreasignadosCount} docente(s)</strong> con asignación de aula superior al límite máximo o exceso lectivo ponderado.
            </span>
          </div>
        </div>
      )}

      {/* Barra de Búsqueda y Filtros de Docentes */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex-1 flex items-center gap-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={busquedaDocente}
            onChange={(e) => setBusquedaDocente(e.target.value)}
            placeholder="Buscar docente por nombre, RUN, título o asignatura..."
            className="w-full pl-9 pr-8 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-slate-400 font-medium"
          />
          {busquedaDocente && (
            <button
              onClick={() => setBusquedaDocente('')}
              className="absolute right-2.5 text-slate-400 hover:text-slate-600 p-0.5"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={filtroEstamento}
              onChange={(e) => setFiltroEstamento(e.target.value)}
              className="px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="TODOS">Todos los Estamentos ({docentes.length})</option>
              {ESTAMENTOS.map(est => (
                <option key={est.id} value={est.id}>
                  {est.label}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-[11px]">
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('TODOS')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'TODOS'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('SOBREASIGNADOS')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'SOBREASIGNADOS'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-700 hover:bg-rose-50'
              }`}
            >
              Alertas ({sobreasignadosCount})
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('HOLGURA')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'HOLGURA'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              Holgura
            </button>
            <button
              type="button"
              onClick={() => setFiltroEstadoCarga('EXACTO')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                filtroEstadoCarga === 'EXACTO'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-blue-700 hover:bg-blue-50'
              }`}
            >
              Exacto
            </button>
          </div>

          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
            {docentesFiltrados.length} de {docentes.length}
          </span>
        </div>
      </div>

      {/* Tabla de Docentes */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
              <tr>
                <th className="px-4 py-3">Docente</th>
                <th className="px-3 py-3 text-center">Calidad</th>
                <th className="px-3 py-3 text-center bg-indigo-50/40">Aula 65/35<br /><span className="text-[9px] font-normal text-slate-400 font-mono">(HA)</span></th>
                <th className="px-3 py-3 text-center bg-purple-50/40">Aula 60/40<br /><span className="text-[9px] font-normal text-slate-400 font-mono">(HA)</span></th>
                <th className="px-3 py-3 text-center">PIE / SEP<br /><span className="text-[9px] font-normal text-slate-400 font-mono">(cron)</span></th>
                <th className="px-3 py-3 text-center bg-slate-100/60">Contrato Calculado<br /><span className="text-[9px] font-normal text-slate-400 font-mono">(Lookup)</span></th>
                <th className="px-3 py-3 text-center">Contrato Real<br /><span className="text-[9px] font-normal text-slate-400 font-mono">(Pagado)</span></th>
                <th className="px-4 py-3 text-center">Saldos / Alertas</th>
                <th className="px-3 py-3 text-center">HNL Base<br /><span className="text-[9px] font-normal text-slate-400 font-mono">(Recreo)</span></th>
                <th className="px-3 py-3 text-center">40% Planif.<br /><span className="text-[9px] font-normal text-slate-400 font-mono">(Prep. Docente)</span></th>
                <th className="px-4 py-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {docentesFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-slate-400">
                    <p className="text-sm font-semibold">No se encontraron docentes con los filtros aplicados.</p>
                    <p className="text-xs text-slate-400 mt-1">Prueba cambiando el término de búsqueda o seleccionando otro estamento/estado.</p>
                  </td>
                </tr>
              ) : (
                docentesFiltrados.map(({ docente: d, pedAsignadas, pedAulaRegular, pedCoDocencia, pedTallerSep, pedTrabajoColab, ped65, ped60, pieCronologicas, sepExentas, calculo, valSobre, auditMulti, esExento, hDir, hInsp, hTec, hCoord, hTallerSepDoc, hColabDoc, docTerritorial, esImprocedenteFinanciamiento, deficitFinanciamiento }) => {
                const esMultiEscuela = docTerritorial && docTerritorial.contratos.length > 1;
                const hnlHoras = Math.floor(auditMulti.minutosHnlTotal / 60);
                const hnlMins = auditMulti.minutosHnlTotal % 60;
                const recHoras = Math.floor(auditMulti.minutosRecreoTotal / 60);
                const recMins = auditMulti.minutosRecreoTotal % 60;
                const planHoras = Math.floor(auditMulti.minutosHnlPlanificacion40 / 60);
                const planMins = auditMulti.minutosHnlPlanificacion40 % 60;

                return (
                  <React.Fragment key={d.id}>
                    <tr className="hover:bg-slate-50/80">
                    <td className="px-4 py-3">
                      <div className="font-bold text-slate-800">
                        {d.nombres} {d.apellidos}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono">
                        {d.run} {d.asignaturaPrincipal ? `• ${d.asignaturaPrincipal}` : ''}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {esMultiEscuela && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <Building2 className="w-3 h-3" />
                            Multi-Escuela ({docTerritorial.horasTotalesSlep}h en SLEP)
                          </span>
                        )}
                        {d.aplicaArticulo69 && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title="Artículo 69: reducción de aula a máx. 24h cronológicas (32 HA) por 30+ años de docencia">
                            ⚖️ Art. 69 (Máx 24h)
                          </span>
                        )}
                        {Boolean(d.funcionesNoAula && d.funcionesNoAula.length > 0) && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 text-purple-800 border border-purple-200" title={d.funcionesNoAula?.map(f => `${f.nombre}: ${f.horas}h (${f.financiamiento || 'Subv. Gen'})`).join(', ')}>
                            🏢 {d.funcionesNoAula?.length} func. no aula ({d.funcionesNoAula?.reduce((s, f) => s + (Number(f.horas) || 0), 0)}h)
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="font-medium text-slate-700 text-[11px]">
                        {d.estamento.replace('_', ' ')}
                      </div>
                      <div className="flex items-center justify-center gap-1 mt-0.5 text-[10px] text-slate-500">
                        <span className={`px-1.5 py-0.2 rounded font-semibold ${
                          d.calidadJuridica === 'TITULAR' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                        }`}>
                          {d.calidadJuridica}
                        </span>
                      </div>
                    </td>

                    {/* Aula 65/35 */}
                    <td className="px-3 py-3 text-center bg-indigo-50/15">
                      <span className="font-bold text-slate-800 text-xs">{ped65} HA</span>
                    </td>

                    {/* Aula 60/40 */}
                    <td className="px-3 py-3 text-center bg-purple-50/15">
                      <span className="font-bold text-slate-800 text-xs">{ped60} HA</span>
                    </td>

                    {/* PIE / SEP */}
                    <td className="px-3 py-3 text-center">
                      {(pieCronologicas + sepExentas) > 0 ? (
                        <span className="font-bold text-purple-700 text-xs">{pieCronologicas + sepExentas} hrs</span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* Contrato Calculado (Lookup) */}
                    <td className="px-3 py-3 text-center bg-slate-50/70">
                      <div className="flex flex-col items-center">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-50 text-indigo-700 border border-blue-200">
                          {auditMulti.contratoCalculadoTotal} hrs
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5 font-mono">
                          (Base: {auditMulti.req65_35 + auditMulti.req60_40}h + {pieCronologicas + sepExentas}h PIE/SEP)
                        </span>
                      </div>
                    </td>

                    {/* Contrato Real */}
                    <td className="px-3 py-3 text-center font-bold text-slate-900 text-sm">
                      {d.horasContrato} hrs
                    </td>

                    {/* Saldos / Alertas */}
                    <td className="px-4 py-3 text-center">
                      {d.horasContrato === 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">Por Auditar</span>
                      ) : auditMulti.esInfractorExcesoLectivo ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Exceso Lectivo
                          </span>
                          <span className="text-[9px] text-rose-600 font-semibold">
                            {auditMulti.porcentajeLectivoReal}% (&gt; {auditMulti.porcentajeLimitePonderado}%)
                          </span>
                        </div>
                      ) : auditMulti.saldoHoras > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          +{auditMulti.saldoHoras} hrs (Libres)
                        </span>
                      ) : auditMulti.saldoHoras < 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          {auditMulti.saldoHoras} hrs (Déficit)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                          Exacto (0)
                        </span>
                      )}

                      {esImprocedenteFinanciamiento && (
                        <div className="mt-1">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300" title={`Déficit de ${deficitFinanciamiento}h de Subvención General cubiertas improcedentemente con fondos SEP o PIE`}>
                            <AlertTriangle className="w-3 h-3 text-amber-700 shrink-0" />
                            Improcedencia SEP/PIE (-{deficitFinanciamiento}h)
                          </span>
                        </div>
                      )}
                    </td>

                    {/* HNL Base */}
                    <td className="px-3 py-3 text-center">
                      <div className="text-slate-800 font-bold text-xs">
                        {hnlHoras}h {hnlMins}m
                      </div>
                      <div className="text-[9px] text-slate-400">
                        Recreo: <strong>{recHoras}h {recMins}m</strong>
                      </div>
                    </td>

                    {/* 40% Planificación Docente */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-xs font-bold text-emerald-600">
                        {planHoras}h {planMins}m
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setExpandedDocenteId(expandedDocenteId === d.id ? null : d.id)}
                          className={`p-1 rounded transition-colors ${
                            expandedDocenteId === d.id
                              ? 'text-orange-600 bg-orange-100'
                              : 'text-slate-400 hover:text-orange-600 hover:bg-orange-50'
                          }`}
                          title="Ver y ajustar asignaturas/cursos asignados"
                        >
                          {expandedDocenteId === d.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => verFichaDocente(d)}
                          className="text-blue-600 hover:text-blue-800 p-1 rounded hover:bg-blue-50 transition-colors"
                          title="Ver Ficha 360° con desglose oficial"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => abrirModalEditar(d)}
                          className="text-slate-400 hover:text-slate-700 p-1 rounded hover:bg-slate-100 transition-colors"
                          title="Editar docente"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar al docente ${d.nombres} ${d.apellidos}?`)) {
                              onEliminarDocente(d.id);
                            }
                          }}
                          className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                          title="Eliminar docente"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedDocenteId === d.id && (
                    <tr key={`exp-${d.id}`} className="bg-slate-50/90 border-b border-slate-200">
                      <td colSpan={11} className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-orange-600" />
                            <span>Carga Horaria & Asignaciones de {d.nombres} {d.apellidos}</span>
                          </h4>
                          <button
                            type="button"
                            onClick={() => {
                              setNuevaAsigDocenteId(d.id);
                              setNuevaAsigCursoId(cursos[0]?.id || '');
                            }}
                            className="px-2.5 py-1 text-[11px] font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-md flex items-center gap-1 shadow-xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Asignar Nueva Asignatura / Curso</span>
                          </button>
                        </div>

                        {/* Formulario rápida nueva asignación */}
                        {nuevaAsigDocenteId === d.id && (
                          <div className="p-3 bg-white border border-orange-200 rounded-lg flex flex-wrap items-center gap-3 text-xs shadow-sm">
                            <div className="flex-1 min-w-[150px]">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Asignatura</label>
                              <input
                                type="text"
                                value={nuevaAsigNombre}
                                onChange={(e) => setNuevaAsigNombre(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs font-medium"
                                placeholder="Ej: Matemática"
                              />
                            </div>
                            <div className="min-w-[180px]">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Curso o Modalidad</label>
                              <select
                                value={nuevaAsigCursoId}
                                onChange={(e) => setNuevaAsigCursoId(e.target.value)}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs bg-white font-medium"
                              >
                                <option value="TRANSVERSAL">🌟 Taller Institucional / Transversal (Sin Curso)</option>
                                {cursos.map(c => (
                                  <option key={c.id} value={c.id}>
                                    {c.nivel} {c.letra} ({c.regimen})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="w-20">
                              <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Horas Aula</label>
                              <input
                                type="number"
                                value={nuevaAsigHoras}
                                onChange={(e) => setNuevaAsigHoras(Number(e.target.value))}
                                className="w-full px-2 py-1 border border-slate-200 rounded text-xs text-center font-bold"
                                min={1}
                                max={44}
                              />
                            </div>
                            <div className="flex items-center gap-1.5 pt-4">
                              <label className="flex items-center gap-1 cursor-pointer text-[11px] font-semibold text-slate-700">
                                <input
                                  type="checkbox"
                                  checked={nuevaAsigEsTallerSep}
                                  onChange={(e) => setNuevaAsigEsTallerSep(e.target.checked)}
                                />
                                <span>Taller Extracurricular SEP</span>
                              </label>
                            </div>
                            <div className="flex items-center gap-2 pt-4">
                              <button
                                type="button"
                                onClick={async () => {
                                  if (!nuevaAsigNombre.trim() || !nuevaAsigCursoId) return;
                                  const newAsig: AsignacionHoraria = {
                                    id: `asig-${Date.now()}`,
                                    rbd: colegio.rbd,
                                    periodo: d.periodo || 2026,
                                    cursoId: nuevaAsigCursoId,
                                    docenteId: d.id,
                                    asignatura: nuevaAsigNombre.trim(),
                                    horasPedagogicasAula: Number(nuevaAsigHoras),
                                    esTallerJec: /taller/i.test(nuevaAsigNombre),
                                    esTallerSep: nuevaAsigEsTallerSep,
                                    esProporcionDocente: false
                                  };
                                  if (onGuardarAsignacion) await onGuardarAsignacion(newAsig);
                                  setNuevaAsigDocenteId(null);
                                }}
                                className="px-3 py-1 bg-emerald-600 text-white font-bold rounded hover:bg-emerald-700 text-xs"
                              >
                                Guardar
                              </button>
                              <button
                                type="button"
                                onClick={() => setNuevaAsigDocenteId(null)}
                                className="px-2 py-1 text-slate-500 hover:text-slate-800 text-xs"
                              >
                                Cancelar
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Lista de Asignaciones Actuales */}
                        <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-xs">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-slate-100 text-slate-600 font-semibold text-[10px] border-b">
                              <tr>
                                <th className="px-3 py-2">Asignatura</th>
                                <th className="px-3 py-2">Curso / Nivel</th>
                                <th className="px-3 py-2 text-center">Horas Pedagógicas</th>
                                <th className="px-3 py-2 text-center">Tipo</th>
                                <th className="px-3 py-2 text-center">Acciones</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {asignaciones.filter(a => a.docenteId === d.id).map(a => {
                                return (
                                  <tr key={a.id} className="hover:bg-slate-50">
                                    <td className="px-3 py-2 font-semibold text-slate-800">
                                      <input
                                        type="text"
                                        defaultValue={a.asignatura}
                                        onBlur={async (e) => {
                                          const val = e.target.value.trim();
                                          if (val && val !== a.asignatura && onGuardarAsignacion) {
                                            await onGuardarAsignacion({ ...a, asignatura: val });
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        }}
                                        className="bg-transparent hover:bg-slate-100 focus:bg-white border-b border-transparent focus:border-orange-500 px-1 py-0.5 text-xs font-semibold text-slate-800 rounded outline-none w-full"
                                      />
                                    </td>
                                    <td className="px-3 py-2">
                                      <select
                                        value={a.cursoId || 'TRANSVERSAL'}
                                        onChange={async (e) => {
                                          if (onGuardarAsignacion) {
                                            await onGuardarAsignacion({ ...a, cursoId: e.target.value });
                                          }
                                        }}
                                        className="bg-transparent hover:bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 text-xs font-medium text-slate-700"
                                      >
                                        <option value="TRANSVERSAL">🌟 Taller Transversal (Sin Curso)</option>
                                        {cursos.map(c => (
                                          <option key={c.id} value={c.id}>
                                            {c.nivel} {c.letra} ({c.regimen})
                                          </option>
                                        ))}
                                      </select>
                                    </td>
                                    <td className="px-3 py-2 text-center font-bold text-slate-800">
                                      <input
                                        type="number"
                                        defaultValue={a.horasPedagogicasAula}
                                        min={1}
                                        max={44}
                                        onBlur={async (e) => {
                                          const h = Number(e.target.value);
                                          if (h > 0 && h !== a.horasPedagogicasAula && onGuardarAsignacion) {
                                            await onGuardarAsignacion({ ...a, horasPedagogicasAula: h });
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                        }}
                                        className="w-16 text-center font-black bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded px-1 py-0.5 text-xs"
                                      />
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      {(a.cursoId === 'TRANSVERSAL' || !a.cursoId || a.cursoId === 'SIN_CURSO') ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                          🌟 Taller Transversal
                                        </span>
                                      ) : a.esTallerSep ? (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                          SEP Extracurricular
                                        </span>
                                      ) : (
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600">
                                          Plan Regular
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (confirm(`¿Eliminar la asignación de ${a.asignatura}?`)) {
                                            if (onEliminarAsignacion) await onEliminarAsignacion(a.id);
                                          }
                                        }}
                                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                        title="Eliminar asignación"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                              {asignaciones.filter(a => a.docenteId === d.id).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                                    Este docente no tiene asignaturas ni cursos asignados actualmente.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            }))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Nuevo / Editar Docente con Desglose de Financiamiento */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 border border-slate-200 my-auto max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900 mb-3 flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" />
              {editingDoc ? `Editar: ${editingDoc.nombres} ${editingDoc.apellidos}` : 'Registrar Docente en Dotación'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">RUN *</label>
                  <input
                    type="text"
                    required
                    value={run}
                    onChange={e => setRun(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    placeholder="Ej: 12.345.678-9"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Horas Contrato Totales (1 a 44) *</label>
                  <input
                    type="number"
                    min="1"
                    max="44"
                    required
                    value={horasContrato}
                    onChange={e => {
                      const val = parseInt(e.target.value) || 0;
                      setHorasContrato(val);
                      // Ajustar por defecto a subvención general si es nuevo
                      if (!editingDoc) {
                        if (calidadJuridica === 'TITULAR') {
                          setHorasSubvGeneralTitular(val);
                          setHorasSubvGeneralContrata(0);
                        } else {
                          setHorasSubvGeneralContrata(val);
                          setHorasSubvGeneralTitular(0);
                        }
                      }
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nombres *</label>
                  <input
                    type="text"
                    required
                    value={nombres}
                    onChange={e => setNombres(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Apellidos *</label>
                  <input
                    type="text"
                    required
                    value={apellidos}
                    onChange={e => setApellidos(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estamento *</label>
                  <select
                    value={estamento}
                    onChange={e => setEstamento(e.target.value as EstamentoDocente)}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    {ESTAMENTOS.map(est => (
                      <option key={est.id} value={est.id}>{est.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Calidad Jurídica Predominante *</label>
                  <select
                    value={calidadJuridica}
                    onChange={e => {
                      const cal = e.target.value as CalidadJuridicaDocente;
                      setCalidadJuridica(cal);
                    }}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  >
                    <option value="TITULAR">Titular</option>
                    <option value="CONTRATA">Contrata</option>
                  </select>
                </div>
              </div>

              {/* SECCIÓN DESGLOSE FUENTES DE FINANCIAMIENTO */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                    <Coins className="w-4 h-4 text-orange-600" />
                    Desglose por Fuentes de Financiamiento (Horas)
                  </span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    sumaFinanciamiento === horasContrato 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    Suma: {sumaFinanciamiento} / {horasContrato} hrs
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {/* Subvención General */}
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-2">
                    <span className="font-bold text-slate-700 block text-[11px]">Subvención General</span>
                    <div>
                      <label className="block text-[10px] text-slate-500">Titular (hrs):</label>
                      <input
                        type="number"
                        min="0"
                        max="44"
                        value={horasSubvGeneralTitular}
                        onChange={e => setHorasSubvGeneralTitular(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Contrata (hrs):</label>
                      <input
                        type="number"
                        min="0"
                        max="44"
                        value={horasSubvGeneralContrata}
                        onChange={e => setHorasSubvGeneralContrata(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </div>
                  </div>

                  {/* SEP */}
                  <div className="bg-purple-50/50 p-2.5 rounded-lg border border-purple-100 space-y-2">
                    <span className="font-bold text-purple-900 block text-[11px]">SEP (Ley 20.248)</span>
                    <div>
                      <label className="block text-[10px] text-purple-700">Titular (hrs):</label>
                      <input
                        type="number"
                        min="0"
                        max="44"
                        value={horasSepTitular}
                        onChange={e => setHorasSepTitular(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-purple-700">Contrata (hrs):</label>
                      <input
                        type="number"
                        min="0"
                        max="44"
                        value={horasSepContrata}
                        onChange={e => setHorasSepContrata(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </div>
                  </div>

                  {/* PIE */}
                  <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 space-y-2">
                    <span className="font-bold text-blue-900 block text-[11px]">PIE (Dec. 170)</span>
                    <div>
                      <label className="block text-[10px] text-blue-700">Titular (hrs):</label>
                      <input
                        type="number"
                        min="0"
                        max="44"
                        value={horasPieTitular}
                        onChange={e => setHorasPieTitular(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-blue-700">Contrata (hrs):</label>
                      <input
                        type="number"
                        min="0"
                        max="44"
                        value={horasPieContrata}
                        onChange={e => setHorasPieContrata(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border rounded text-xs"
                      />
                    </div>
                  </div>
                </div>

                {sumaFinanciamiento !== horasContrato && (
                  <p className="text-[11px] text-amber-700 font-medium">
                    ⚠️ La suma de las horas por fuente ({sumaFinanciamiento}h) difiere de las horas totales de contrato ({horasContrato}h).
                  </p>
                )}
              </div>

              {/* SECCIÓN HORAS INSTITUCIONALES / ADMINISTRATIVAS FUERA DE AULA */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                      <ShieldAlert className="w-4 h-4 text-purple-600" />
                      Funciones Fuera de Aula / Administrativas (Exentas de Proporción Aula)
                    </span>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      Permite registrar múltiples funciones (Directivas, Inspectoría, UTP, Coordinaciones CRA/Enlaces/Convivencia, Horas Gremiales, Apoyo Administrativo, etc.). No llevan cálculo de proporción 65/35 o 60/40.
                    </p>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-200 shrink-0">
                    Total: {totalHorasFuncionesNoAula} hrs
                  </span>
                </div>

                {/* Lista de funciones ya agregadas */}
                {funcionesNoAula.length > 0 ? (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {funcionesNoAula.map(f => {
                      const meta = TIPOS_FUNCIONES_LABELS[f.tipo] || { label: f.tipo, defaultNombre: f.nombre, badgeColor: 'bg-slate-100 text-slate-800 border-slate-200' };
                      const metaFinanc = f.financiamiento === 'SEP'
                        ? { label: 'SEP', badgeColor: 'bg-purple-100 text-purple-800 border-purple-200' }
                        : f.financiamiento === 'PIE'
                        ? { label: 'PIE', badgeColor: 'bg-blue-100 text-blue-800 border-blue-200' }
                        : { label: 'Subv. Gen', badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200' };

                      return (
                        <div key={f.id} className="flex items-center justify-between p-2 bg-white rounded-lg border border-slate-200 text-xs shadow-sm">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${meta.badgeColor}`}>
                              {f.tipo}
                            </span>
                            <span className="font-semibold text-slate-800">{f.nombre}</span>
                            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold border ${metaFinanc.badgeColor}`}>
                              {metaFinanc.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <strong className="text-purple-900 font-bold bg-purple-50 px-2 py-0.5 rounded border border-purple-100">{f.horas} hrs</strong>
                            <button
                              type="button"
                              onClick={() => eliminarFuncionNoAula(f.id)}
                              className="text-red-500 hover:text-red-700 p-1 hover:bg-red-50 rounded transition-colors"
                              title="Eliminar función"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-2.5 px-3 bg-white rounded-lg border border-dashed border-slate-300 text-slate-400 text-xs">
                    Sin funciones fuera de aula agregadas. El docente tendrá sus horas disponibles para aula regular.
                  </div>
                )}

                {/* Formulario para agregar una nueva función */}
                <div className="bg-white p-3 rounded-lg border border-purple-100 space-y-2">
                  <span className="font-bold text-purple-950 block text-[11px] flex items-center gap-1">
                    <Plus className="w-3.5 h-3.5 text-purple-600" />
                    Agregar Nueva Función Fuera de Aula / Administrativa:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Tipo / Categoría</label>
                      <select
                        value={nuevaFuncionTipo}
                        onChange={e => {
                          const t = e.target.value as TipoFuncionNoAula;
                          setNuevaFuncionTipo(t);
                          if (!nuevaFuncionNombre) {
                            setNuevaFuncionNombre(TIPOS_FUNCIONES_LABELS[t]?.defaultNombre || '');
                          }
                        }}
                        className="w-full px-2 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      >
                        {Object.entries(TIPOS_FUNCIONES_LABELS).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="sm:col-span-4">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Nombre / Descripción</label>
                      <input
                        type="text"
                        value={nuevaFuncionNombre}
                        onChange={e => setNuevaFuncionNombre(e.target.value)}
                        placeholder="Ej: Encargado Convivencia Escolar"
                        className="w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none"
                      />
                    </div>

                    <div className="sm:col-span-3">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Financiamiento</label>
                      <select
                        value={nuevaFuncionFinanciamiento}
                        onChange={e => setNuevaFuncionFinanciamiento(e.target.value as FuenteFinanciamientoFuncion)}
                        className="w-full px-2 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-purple-400 focus:outline-none font-medium"
                      >
                        <option value="SUBVENCION_GENERAL">Subvención General</option>
                        <option value="SEP">SEP (Ley 20.248)</option>
                        <option value="PIE">PIE (Dec. 170)</option>
                      </select>
                    </div>

                    <div className="sm:col-span-1">
                      <label className="block text-[10px] font-semibold text-slate-600 mb-0.5">Horas</label>
                      <input
                        type="number"
                        min="1"
                        max={horasContrato}
                        value={nuevaFuncionHoras}
                        onChange={e => setNuevaFuncionHoras(parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-purple-400 focus:outline-none font-semibold text-center"
                      />
                    </div>

                    <div className="sm:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={agregarFuncionNoAula}
                        className="w-full h-[30px] bg-purple-600 hover:bg-purple-700 text-white rounded-lg flex items-center justify-center shadow-sm transition-colors text-xs font-bold"
                        title="Añadir función a la lista"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Bloque Talleres SEP y Trabajo Colaborativo (Exentos) */}
                <div className="bg-white p-3 rounded-lg border border-emerald-100 space-y-2">
                  <span className="font-bold text-emerald-900 block text-[11px]">
                    Talleres SEP y Trabajo Colaborativo (Apoyo Directo Exento)
                  </span>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                        Horas Taller SEP (hrs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={horasContrato}
                        value={horasTallerSep}
                        onChange={e => setHorasTallerSep(parseInt(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">Refuerzo SEP fuera de plan regular</span>
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-slate-600 mb-1">
                        Trabajo Colaborativo Art. 86 (hrs)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={horasContrato}
                        value={horasTrabajoColaborativo}
                        onChange={e => setHorasTrabajoColaborativo(parseInt(e.target.value) || 0)}
                        className="w-full px-2.5 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-400 focus:outline-none"
                      />
                      <span className="text-[10px] text-slate-400">Co-planificación Dec. 170</span>
                    </div>
                  </div>
                </div>

                <div className="p-2 bg-purple-50/50 rounded-lg border border-purple-100 flex items-center justify-between text-[11px] text-slate-600">
                  <span>Horas disponibles para docencia lectiva de aula:</span>
                  <strong className="text-purple-900 font-bold">
                    {Math.max(0, horasContrato - totalHorasFuncionesNoAula - horasTallerSep - horasTrabajoColaborativo)} hrs
                  </strong>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Asignatura Principal de Desempeño</label>
                <input
                  type="text"
                  value={asignaturaPrincipal}
                  onChange={e => setAsignaturaPrincipal(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                  placeholder="Ej: Lenguaje y Comunicación, Matemática, etc."
                />
              </div>

              {/* Bloque Artículo 69 */}
              <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl space-y-1.5">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="art69"
                    checked={aplicaArticulo69}
                    onChange={e => setAplicaArticulo69(e.target.checked)}
                    className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 border-amber-300"
                  />
                  <label htmlFor="art69" className="text-xs font-bold text-amber-900 flex items-center gap-1.5 cursor-pointer">
                    <Scale className="w-4 h-4 text-amber-700" />
                    Aplica Artículo 69 (Reducción voluntaria de aula por 30+ años de docencia)
                  </label>
                </div>
                <p className="text-[11px] text-amber-800 leading-relaxed pl-6">
                  Permite ejercer un <strong>máximo de 24 horas cronológicas de aula (32 Horas Aula)</strong>. La diferencia de horas con respecto a la tabla oficial MINEDUC se <strong>asigna automáticamente a sus horas no lectivas</strong> para labores pedagógicas.
                </p>
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-bold shadow-sm transition-colors"
                >
                  {editingDoc ? 'Guardar Cambios' : 'Registrar Docente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ficha 360° del Docente */}
      <DocenteFichaDetalleModal
        isOpen={Boolean(docenteFicha)}
        onClose={() => setDocenteFicha(null)}
        docenteConsolidado={docenteFicha}
      />
    </div>
  );
};
