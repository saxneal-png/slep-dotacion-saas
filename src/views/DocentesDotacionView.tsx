import React, { useState, useMemo, useDeferredValue } from 'react';
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
  Filter,
  BookOpen,
  ClipboardPaste,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ModalPegarDesdeExcel } from '../components/ModalPegarDesdeExcel';
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
import { DocenteFormModal, ESTAMENTOS, TIPOS_FUNCIONES_LABELS } from '../components/DocenteFormModal';
import { DocenteAsignacionPanel } from '../components/DocenteAsignacionPanel';

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
  onNavegarAPestana?: (pestana: any) => void;
}

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
  onEliminarAsignacion,
  onNavegarAPestana
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Docente | null>(null);
  const [docenteFicha, setDocenteFicha] = useState<DocenteConsolidadoTerritorial | null>(null);
  const [expandedDocenteId, setExpandedDocenteId] = useState<string | null>(null);
  const [modalPegarAbierto, setModalPegarAbierto] = useState(false);

  // Filtros de búsqueda de docentes
  const [busquedaDocente, setBusquedaDocente] = useState('');
  const deferredBusqueda = useDeferredValue(busquedaDocente);
  const [filtroEstamento, setFiltroEstamento] = useState<string>('TODOS');
  const [filtroEstadoCarga, setFiltroEstadoCarga] = useState<'TODOS' | 'SOBREASIGNADOS' | 'HOLGURA' | 'EXACTO'>('TODOS');
  const [filtroCalidad, setFiltroCalidad] = useState<'TODOS' | 'TITULAR' | 'CONTRATA'>('TODOS');
  const [filtroFinanciamiento, setFiltroFinanciamiento] = useState<'TODOS' | 'SUBV_GRAL' | 'SEP' | 'PIE'>('TODOS');
  const [filtroMultiEscuela, setFiltroMultiEscuela] = useState<boolean>(false);
  const [ordenDocentes, setOrdenDocentes] = useState<'APELLIDOS_ASC' | 'HORAS_DESC' | 'HORAS_ASC' | 'VACANTES_DESC'>('APELLIDOS_ASC');

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
    setModalOpen(true);
  };

  const abrirModalEditar = (d: Docente) => {
    setEditingDoc(d);
    setModalOpen(true);
  };

  const verFichaDocente = (d: Docente) => {
    const consolidado = consolidadosTerritoriales.find(c => c.run.trim() === d.run.trim());
    if (consolidado) {
      setDocenteFicha(consolidado);
    }
  };

  // Resúmenes de sobreasignación considerando horas directivas, inspectoría, UTP, coordinaciones, taller SEP y trabajo colaborativo (Memorizado)
  const docentesAuditados = useMemo(() => {
    return docentes.map(d => {
      const asigs = asignaciones.filter(a => a.docenteId === d.id || (a.coDocenteId === d.id && a.tieneCoDocente));
      const asigsCoDocencia = asigs.filter(a => (a.coDocenteId === d.id && a.tieneCoDocente) || a.esCoDocencia || a.esAgrupacionFlexible || a.tipoApoyo === 'CO_DOCENCIA' || a.tipoApoyo === 'AGRUPACION_FLEXIBLE' || a.tipoApoyo === 'REFUERZO_AULA' || a.tipoApoyo === 'APOYO_DOCENTE');
      const asigsTallerSep = asigs.filter(a => a.docenteId === d.id && (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP') && !asigsCoDocencia.includes(a));
      const asigsTrabajoColab = asigs.filter(a => a.docenteId === d.id && (a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO'));

      const asigsCoDocenciaPie = asigsCoDocencia.filter(a => 
        Boolean(a.horasCronologicasPie) || 
        (a.tipoApoyo && /pie|recurso|co-docencia en aula regular|apoyo especializado|cl[ií]nico/i.test(a.tipoApoyo)) || 
        (a.asignatura && /pie|decreto 170|recurso/i.test(a.asignatura)) ||
        d.estamento === 'DOCENTE_DIFERENCIAL' || 
        (Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0) > 0 && Number(d.horasSubvencionGeneralTitular || 0) + Number(d.horasSubvencionGeneralContrata || 0) === 0)
      );
      const asigsCoDocenciaSep = asigsCoDocencia.filter(a => 
        !asigsCoDocenciaPie.includes(a) && 
        Boolean(a.esTallerSep || a.tipoApoyo === 'TALLER_SEP' || (a.tipoApoyo && /sep/i.test(a.tipoApoyo)) || (a.asignatura && /sep/i.test(a.asignatura)))
      );
      const asigsCoDocenciaSubvGen = asigsCoDocencia.filter(a => 
        !asigsCoDocenciaPie.includes(a) && 
        !asigsCoDocenciaSep.includes(a)
      );

      const asigsAulaRegular = [
        ...asigs.filter(a => a.docenteId === d.id && !asigsCoDocencia.includes(a) && !asigsTallerSep.includes(a) && !asigsTrabajoColab.includes(a)),
        ...asigsCoDocenciaSubvGen
      ];

      const pedAulaRegular = asigsAulaRegular.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedCoDocencia = asigsCoDocencia.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTallerSep = asigsTallerSep.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTrabajoColab = asigsTrabajoColab.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const pedTotalAsignadas = asigs.reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const hDir = d.horasDirectivas || 0;
      const hInsp = d.horasInspectorGeneral || 0;
      const hTec = d.horasTecnicoPedagogicas || 0;
      const hCoord = d.horasCoordinacion || 0;
      const hCoordPie = d.horasCoordinacionPie || 0;
      const hConv = d.horasConvivenciaEscolar || 0;
      const hExtra = d.horasExtraescolar || 0;
      const hTallerSepDoc = d.horasTallerSep || 0;
      const hColabDoc = d.horasTrabajoColaborativo || 0;

      const subTotalDoc = Number(d.horasSubvencionGeneralTitular || 0) + Number(d.horasSubvencionGeneralContrata || 0);
      const contratoSepDoc = Number(d.horasSepTitular || 0) + Number(d.horasSepContrata || 0);
      const contratoPieDoc = Number(d.horasPieTitular || 0) + Number(d.horasPieContrata || 0);

      const isPieDoc = d.estamento === 'DOCENTE_DIFERENCIAL' || (contratoPieDoc > 0 && subTotalDoc === 0);
      const isSepDoc = contratoSepDoc > 0 && contratoPieDoc === 0 && subTotalDoc === 0;

      const isSepFin = (f: any) => {
        if (f.financiamiento && /sep/i.test(f.financiamiento)) return true;
        if (f.tipo === 'COORDINACION_SEP') return true;
        return false;
      };

      const isPieFin = (f: any) => {
        if (f.financiamiento && /pie/i.test(f.financiamiento)) return true;
        if (f.tipo === 'COORDINACION_PIE') return true;
        if (f.nombre && /\bpie\b/i.test(f.nombre)) return true;
        if (isPieDoc && (!f.financiamiento || f.financiamiento === 'PIE')) return true;
        return false;
      };

      const sumFuncionesNoAula = (d.funcionesNoAula && d.funcionesNoAula.length > 0)
        ? d.funcionesNoAula.reduce((s, f) => s + (Number(f.horas) || 0), 0)
        : 0;
      const sumFuncionesNoAulaSep = (d.funcionesNoAula && d.funcionesNoAula.length > 0)
        ? d.funcionesNoAula.filter(f => isSepFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
        : 0;
      const sumFuncionesNoAulaPie = (d.funcionesNoAula && d.funcionesNoAula.length > 0)
        ? d.funcionesNoAula.filter(f => isPieFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
        : 0;
      const sumFuncionesNoAulaSubvGen = (d.funcionesNoAula && d.funcionesNoAula.length > 0)
        ? d.funcionesNoAula.filter(f => !isSepFin(f) && !isPieFin(f)).reduce((s, f) => s + (Number(f.horas) || 0), 0)
        : (hDir + hInsp + hTec + hCoord + hConv + hExtra);

      const cronTrabajoColab = asigsTrabajoColab.reduce((s, a) => s + (a.horasCronologicasPie ?? a.horasPedagogicasAula), 0);
      const cronCoDocenciaPie = asigsCoDocenciaPie.reduce((s, a) => s + (a.horasCronologicasPie ?? a.horasPedagogicasAula), 0);
      const cronCoDocenciaSep = asigsCoDocenciaSep.reduce((s, a) => s + (a.horasCronologicasPie ?? a.horasPedagogicasAula), 0);
      const cronTallerSep = asigsTallerSep.reduce((s, a) => s + (a.horasCronologicasPie ?? a.horasPedagogicasAula), 0);

      const cronApoyoPie = cronTrabajoColab + cronCoDocenciaPie;
      const cronSepTotal = cronTallerSep + cronCoDocenciaSep;

      // Docencia efectiva de aula lectiva que requiere proporción Ley 20.903 (HNL + recreos)
      // Para docentes con contrato SEP estándar de aula (como Laura de la Hoz), las horas de aula (co-docencia y talleres) forman parte de su carga lectiva regulada
      const asigsTallerSepLectivos = (hTallerSepDoc > 0) ? [] : asigsTallerSep;
      const asigsCandidatasAula = [...asigsAulaRegular, ...asigsCoDocenciaSep, ...asigsTallerSepLectivos];
      const pedCandidatas = asigsCandidatasAula.reduce((s, a) => s + a.horasPedagogicasAula, 0);
      const esSepProporcional = isSepDoc && (d.horasContrato > 0 && buscarContratoMinimoPorTabla(pedCandidatas, regimenTabla) <= d.horasContrato);

      const asigsDocenciaAulaEfectiva = (isPieDoc || (isSepDoc && !esSepProporcional))
        ? asigsAulaRegular
        : asigsCandidatasAula;

      const sepExentas = (isPieDoc || (isSepDoc && !esSepProporcional))
        ? Math.max(contratoSepDoc, hTallerSepDoc, cronSepTotal + sumFuncionesNoAulaSep)
        : (hTallerSepDoc + sumFuncionesNoAulaSep);

      const pieCronologicas = isPieDoc
        ? Math.max(contratoPieDoc, hColabDoc + hCoordPie, cronApoyoPie + sumFuncionesNoAulaPie)
        : Math.max(cronApoyoPie + sumFuncionesNoAulaPie, hColabDoc + hCoordPie);

      const hInstNoAula = sumFuncionesNoAulaSubvGen;
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

      const ped65 = asigsDocenciaAulaEfectiva
        .filter(a => {
          const c = cursos.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const ped60 = asigsDocenciaAulaEfectiva
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

      const sepPieTotalDoc = contratoSepDoc + contratoPieDoc;
      const pedCurricular65 = asigsAulaRegular
        .filter(a => {
          const c = cursos.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const pedCurricular60 = asigsAulaRegular
        .filter(a => {
          const c = cursos.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const reqSubvDoc = buscarContratoMinimoPorTabla(pedCurricular65, '65_35') + buscarContratoMinimoPorTabla(pedCurricular60, '60_40') + sumFuncionesNoAulaSubvGen;
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
  }, [docentes, asignaciones, colegio, cursos, consolidadosTerritoriales, regimenTabla, regimenProporcion]);

  const sobreasignadosCount = docentesAuditados.filter(item => item.valSobre.estaSobreasignado).length;

  const hayFiltrosDocenteActivos = busquedaDocente !== '' || filtroEstamento !== 'TODOS' || filtroEstadoCarga !== 'TODOS' || filtroCalidad !== 'TODOS' || filtroFinanciamiento !== 'TODOS' || filtroMultiEscuela;

  const limpiarFiltrosDocentes = () => {
    setBusquedaDocente('');
    setFiltroEstamento('TODOS');
    setFiltroEstadoCarga('TODOS');
    setFiltroCalidad('TODOS');
    setFiltroFinanciamiento('TODOS');
    setFiltroMultiEscuela(false);
    setOrdenDocentes('APELLIDOS_ASC');
  };

  // Filtrado de docentes para búsqueda rápida
  const docentesFiltrados = useMemo(() => {
    return docentesAuditados.filter(({ docente: d, auditMulti, valSobre, esImprocedenteFinanciamiento, docTerritorial }) => {
      const q = deferredBusqueda.toLowerCase().trim();
      const matchTexto = q === '' ||
        `${d.nombres} ${d.apellidos}`.toLowerCase().includes(q) ||
        d.run.toLowerCase().includes(q) ||
        (d.asignaturaPrincipal || '').toLowerCase().includes(q) ||
        (d.titulo || '').toLowerCase().includes(q);

      const matchEstamento = filtroEstamento === 'TODOS' || d.estamento === filtroEstamento;
      const matchCalidad = filtroCalidad === 'TODOS' || d.calidadJuridica === filtroCalidad;

      let matchFinanciamiento = true;
      if (filtroFinanciamiento === 'SUBV_GRAL') {
        matchFinanciamiento = (d.horasSubvencionGeneralTitular || 0) + (d.horasSubvencionGeneralContrata || 0) > 0;
      } else if (filtroFinanciamiento === 'SEP') {
        matchFinanciamiento = (d.horasSepTitular || 0) + (d.horasSepContrata || 0) + (d.horasTallerSep || 0) > 0;
      } else if (filtroFinanciamiento === 'PIE') {
        matchFinanciamiento = (d.horasPieTitular || 0) + (d.horasPieContrata || 0) + (d.horasCoordinacionPie || 0) > 0;
      }

      const matchMulti = !filtroMultiEscuela || (docTerritorial && docTerritorial.contratos.length > 1);

      let matchEstado = true;
      if (filtroEstadoCarga === 'SOBREASIGNADOS') {
        matchEstado = auditMulti.esInfractorExcesoLectivo || valSobre.estaSobreasignado || auditMulti.estadoSaldo === 'DEFICIT' || esImprocedenteFinanciamiento;
      } else if (filtroEstadoCarga === 'HOLGURA') {
        matchEstado = auditMulti.estadoSaldo === 'HOLGURA';
      } else if (filtroEstadoCarga === 'EXACTO') {
        matchEstado = auditMulti.estadoSaldo === 'EXACTO';
      }

      return matchTexto && matchEstamento && matchCalidad && matchFinanciamiento && matchMulti && matchEstado;
    }).sort((a, b) => {
      if (ordenDocentes === 'APELLIDOS_ASC') {
        const apeA = `${a.docente.apellidos} ${a.docente.nombres}`.toLowerCase();
        const apeB = `${b.docente.apellidos} ${b.docente.nombres}`.toLowerCase();
        return apeA.localeCompare(apeB);
      }
      if (ordenDocentes === 'HORAS_DESC') return b.docente.horasContrato - a.docente.horasContrato;
      if (ordenDocentes === 'HORAS_ASC') return a.docente.horasContrato - b.docente.horasContrato;
      if (ordenDocentes === 'VACANTES_DESC') return (b.calculo?.horasPedagogicasVacantes || 0) - (a.calculo?.horasPedagogicasVacantes || 0);
      return 0;
    });
  }, [docentesAuditados, deferredBusqueda, filtroEstamento, filtroEstadoCarga, filtroCalidad, filtroFinanciamiento, filtroMultiEscuela, ordenDocentes]);

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
          {onNavegarAPestana && (
            <button
              type="button"
              onClick={() => onNavegarAPestana('planes_estudio')}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors border border-slate-300 shadow-xs"
              title="Ver, editar, duplicar o crear planes de estudio curriculares"
            >
              <BookOpen className="w-4 h-4 text-orange-600" />
              <span>Gestionar Planes</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setModalPegarAbierto(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-colors shadow-xs"
            title="Copiar y pegar múltiples docentes desde una planilla Excel"
          >
            <ClipboardPaste className="w-4 h-4 text-indigo-600" />
            <span>Pegar desde Excel</span>
          </button>

          <button
            onClick={abrirModalNuevo}
            className="flex items-center gap-1.5 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold shadow-sm transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Docente</span>
          </button>
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
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
          {/* 1. Estamento */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Estamento
            </label>
            <select
              value={filtroEstamento}
              onChange={(e) => setFiltroEstamento(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="TODOS">Todos los Estamentos ({docentes.length})</option>
              {ESTAMENTOS.map(est => (
                <option key={est.id} value={est.id}>
                  {est.label}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Calidad Jurídica */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Calidad Jurídica
            </label>
            <select
              value={filtroCalidad}
              onChange={(e) => setFiltroCalidad(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="TODOS">Titulares y Contratas</option>
              <option value="TITULAR">Solo Titulares</option>
              <option value="CONTRATA">Solo Contratas</option>
            </select>
          </div>

          {/* 3. Fuente de Financiamiento */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Financiamiento
            </label>
            <select
              value={filtroFinanciamiento}
              onChange={(e) => setFiltroFinanciamiento(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="TODOS">Cualquier Fuente</option>
              <option value="SUBV_GRAL">Con Subv. General</option>
              <option value="SEP">Con Horas SEP</option>
              <option value="PIE">Con Horas PIE</option>
            </select>
          </div>

          {/* 4. Ordenamiento */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">
              Ordenar por
            </label>
            <select
              value={ordenDocentes}
              onChange={(e) => setOrdenDocentes(e.target.value as any)}
              className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-200 rounded-lg bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              <option value="APELLIDOS_ASC">Apellidos (A → Z)</option>
              <option value="HORAS_DESC">Horas Contrato (Mayor → Menor)</option>
              <option value="HORAS_ASC">Horas Contrato (Menor → Mayor)</option>
              <option value="VACANTES_DESC">Horas Vacantes Disponibles</option>
            </select>
          </div>

          {/* 5. Filtro Multi-Escuela */}
          <div className="flex flex-col justify-end">
            <button
              type="button"
              onClick={() => setFiltroMultiEscuela(!filtroMultiEscuela)}
              className={`w-full py-1.5 px-2.5 text-xs font-bold rounded-lg border transition-all flex items-center justify-center gap-1.5 ${
                filtroMultiEscuela
                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>Multi-Escuela</span>
            </button>
          </div>
        </div>

        {/* Barra de búsqueda de texto y estados rápidos */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={busquedaDocente}
              onChange={(e) => setBusquedaDocente(e.target.value)}
              placeholder="Buscar docente por nombre, RUN, título o asignatura..."
              className="w-full pl-9 pr-8 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none placeholder-slate-400 font-medium bg-slate-50 focus:bg-white"
            />
            {busquedaDocente && (
              <button
                onClick={() => setBusquedaDocente('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5"
                title="Limpiar búsqueda"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
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

            {hayFiltrosDocenteActivos && (
              <button
                onClick={limpiarFiltrosDocentes}
                className="px-2.5 py-1 text-[11px] font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg transition-colors"
                title="Restablecer todos los filtros"
              >
                Restablecer
              </button>
            )}

            {/* Botón Exportación Rápida WYSIWYG */}
            <button
              type="button"
              onClick={() => {
                const data = docentesFiltrados.map(({ docente: d, auditMulti, calculo, pedAsignadas }) => ({
                  RUN: d.run,
                  Nombres: d.nombres,
                  Apellidos: d.apellidos,
                  Estamento: d.estamento,
                  'Calidad Jurídica': d.calidadJuridica,
                  'Horas Contrato': d.horasContrato,
                  'Subv. Gral Titular': d.horasSubvencionGeneralTitular || 0,
                  'Subv. Gral Contrata': d.horasSubvencionGeneralContrata || 0,
                  'SEP Titular': d.horasSepTitular || 0,
                  'SEP Contrata': d.horasSepContrata || 0,
                  'PIE Titular': d.horasPieTitular || 0,
                  'PIE Contrata': d.horasPieContrata || 0,
                  'Horas Aula Asignadas': pedAsignadas || 0,
                  'Tope Máximo Aula (HA)': calculo?.horasPedagogicasDisponiblesMax || 0,
                  'Saldo Horas': auditMulti.saldoHoras,
                  'Estado Carga': auditMulti.saldoHoras < 0 ? 'SOBREASIGNADO' : auditMulti.saldoHoras > 0 ? 'HOLGURA' : 'EXACTO'
                }));
                const ws = XLSX.utils.json_to_sheet(data);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Docentes');
                const nombreLimpio = colegio.nombre.replace(/[/\\?%*:|"<>]/g, '').replace(/\s+/g, '_');
                XLSX.writeFile(wb, `Nomina_Docente_${nombreLimpio}_RBD_${colegio.rbd}.xlsx`);
              }}
              className="flex items-center gap-1.5 px-3 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors shadow-xs"
              title="Descargar exactamente esta lista filtrada a un archivo Excel"
            >
              <Download className="w-3.5 h-3.5 text-emerald-600" />
              <span>Exportar Lista (.xlsx)</span>
            </button>
          </div>
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
                    <tr key={`exp-${d.id}`} className="bg-slate-50/95 border-b border-slate-200">
                      <td colSpan={11} className="p-4">
                        <DocenteAsignacionPanel
                          docente={d}
                          colegio={colegio}
                          cursos={cursos}
                          asignaciones={asignaciones}
                          onGuardarAsignacion={onGuardarAsignacion}
                          onEliminarAsignacion={onEliminarAsignacion}
                        />
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

      {/* Modal Nuevo / Editar Docente con Desglose de Financiamiento (Aislado y Optimizado) */}
      <DocenteFormModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onGuardarDocente={onGuardarDocente}
        editingDoc={editingDoc}
        rbd={colegio.rbd}
      />

      {/* Modal Ficha 360° del Docente */}
      <DocenteFichaDetalleModal
        isOpen={Boolean(docenteFicha)}
        onClose={() => setDocenteFicha(null)}
        docenteConsolidado={docenteFicha}
        cursos={cursos}
      />

      {/* Modal Pegar Docentes desde Excel */}
      <ModalPegarDesdeExcel
        isOpen={modalPegarAbierto}
        onClose={() => setModalPegarAbierto(false)}
        tipo="DOCENTES"
        rbd={colegio.rbd}
        periodoActivo={cursos[0]?.periodo || 2026}
        onGuardarBatch={async (items) => {
          for (const d of items) {
            await onGuardarDocente(d);
          }
        }}
      />
    </div>
  );
};
