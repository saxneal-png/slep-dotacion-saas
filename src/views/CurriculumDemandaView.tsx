import React, { useState, useMemo } from 'react';
import {
  BookOpen, Plus, Clock, Trash2, Layers, ShieldCheck, Users,
  Edit2, AlertCircle, CheckCircle2, UserCheck, Sparkles,
  BookCheck, AlertTriangle, ChevronRight, X, HeartHandshake,
  Stethoscope, GraduationCap, School, Wrench
} from 'lucide-react';
import {
  Establecimiento,
  CursoSae,
  Docente,
  AsignacionHoraria,
  EstamentoDocente
} from '../types';
import {
  PLANES_MINEDUC,
  obtenerPlanPorCurso,
  calcularDemandaNormativaPieCurso,
  autoAsignarHorasPieCursos,
  esModalidadAdultos,
  esModalidadMultigradoOCombinado,
  esModalidadEspecial,
  esModalidadLaboral,
  esModalidadTp
} from '@slep/mineduc-engine';
import {
  ModalAsignarDocencia,
  ModalAsignarCoDocencia,
  ModalAsignarPie
} from '../components/CurriculumAsignacionModals';
import { ModalCombinarCursos } from '../components/ModalCombinarCursos';
import { ModalDescombinarCurso } from '../components/ModalDescombinarCurso';
import { CursoModalForm } from './curriculum/components/CursoModalForm';
import { CursoNeeModal } from './curriculum/components/CursoNeeModal';
import { MallaPlanPanel } from './curriculum/components/MallaPlanPanel';
import { CurriculumStatsHeader } from './curriculum/components/CurriculumStatsHeader';
import { CurriculumFilterBar } from './curriculum/components/CurriculumFilterBar';
import { NIVELES_TP_ESPECIALIDADES } from './curriculum/types';

export interface CurriculumDemandaViewProps {
  colegio: Establecimiento | null;
  cursos: CursoSae[];
  docentes?: Docente[];
  asignaciones?: AsignacionHoraria[];
  onGuardarCurso: (curso: CursoSae) => void;
  onEliminarCurso: (id: string) => void;
  onGuardarAsignacion?: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion?: (id: string) => Promise<void> | void;
  periodoActivo?: number;
}

const NIVELES_REGULARES = [
  'Pre-Kínder', 'Kínder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
  '1° Medio', '2° Medio',
  '3° Medio (Humanístico-Científico)', '4° Medio (Humanístico-Científico)',
  '3° Medio (Técnico-Profesional)', '4° Medio (Técnico-Profesional)'
];

const NIVELES_MULTIGRADO_PRESETS = [
  'Multigrado NT1-NT2',
  'Multigrado 1°-2° Básico',
  'Multigrado 3°-4° Básico',
  'Multigrado 5°-6° Básico',
  'Multigrado 7°-8° Básico',
  'Multigrado 1° a 6° Básico',
  'Multigrado 1° a 8° Básico'
];

const NIVELES_EPJA_OFICIALES = [
  { id: 'EPJA Básica - 1° Nivel Básico (1° a 4° Básico)', label: 'EPJA Básica - 1° Nivel (1° a 4° Básico - 20 HA)', horasDefecto: 20, ciclo: 'Básica Adultos' },
  { id: 'EPJA Básica - 2° Nivel Básico (5° a 6° Básico)', label: 'EPJA Básica - 2° Nivel (5° a 6° Básico - 22 HA)', horasDefecto: 22, ciclo: 'Básica Adultos' },
  { id: 'EPJA Básica - 3° Nivel Básico (7° a 8° Básico)', label: 'EPJA Básica - 3° Nivel (7° a 8° Básico - 22 HA)', horasDefecto: 22, ciclo: 'Básica Adultos' },
  { id: 'EPJA Media HC - 1° Nivel Medio (1° y 2° Medio)', label: 'EPJA Media HC - 1° Nivel (1° y 2° Medio - 26 HA)', horasDefecto: 26, ciclo: 'Media HC Adultos' },
  { id: 'EPJA Media HC - 2° Nivel Medio (3° y 4° Medio)', label: 'EPJA Media HC - 2° Nivel (3° y 4° Medio - 26 HA)', horasDefecto: 26, ciclo: 'Media HC Adultos' },
  { id: 'EPJA Media TP - 1° Nivel Medio (1° y 2° Medio TP)', label: 'EPJA Media TP - 1° Nivel (1° y 2° Medio TP - 32 HA)', horasDefecto: 32, ciclo: 'Media TP Adultos' },
  { id: 'EPJA Media TP - 2° Nivel Medio (3° y 4° Medio TP)', label: 'EPJA Media TP - 2° Nivel (3° y 4° Medio TP - 34 HA)', horasDefecto: 34, ciclo: 'Media TP Adultos' }
];

const GRADOS_COMBINABLES = [
  'Pre-Kínder', 'Kínder',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
  '1° Medio', '2° Medio', '3° Medio', '4° Medio',
  '1° Nivel Básico Adultos', '2° Nivel Básico Adultos', '3° Nivel Básico Adultos',
  '1° Nivel Medio Adultos', '2° Nivel Medio Adultos'
];

const TIPOS_APOYO_PIE = [
  { id: 'Co-Docencia en Aula Regular', label: 'Co-Docencia en Aula Regular (Docente Diferencial)', estamentoSugerido: 'DOCENTE_DIFERENCIAL' },
  { id: 'Aula de Recursos / Apoyo Especializado', label: 'Aula de Recursos / Apoyo Especializado', estamentoSugerido: 'DOCENTE_DIFERENCIAL' },
  { id: 'Apoyo Multidisciplinario / Clínico PAE', label: 'Apoyo Profesional PAE (Fonoaudiólogo / Psicólogo / TO)', estamentoSugerido: 'PROFESIONAL_PAE' },
  { id: 'Apoyo Técnico en Aula', label: 'Apoyo Técnico en Educación Especial', estamentoSugerido: 'TECNICO_ESPECIAL' },
  { id: 'Trabajo Colaborativo / Co-Planificación', label: 'Trabajo Colaborativo Art. 86 (Docente de Aula)', estamentoSugerido: 'DOCENTE_AULA' }
];

export const CurriculumDemandaView: React.FC<CurriculumDemandaViewProps> = ({
  colegio,
  cursos,
  docentes = [],
  asignaciones = [],
  onGuardarCurso,
  onEliminarCurso,
  onGuardarAsignacion,
  onEliminarAsignacion,
  periodoActivo = 2026
}) => {
  // Modal de Curso Avanzado
  const [modalCursoOpen, setModalCursoOpen] = useState(false);
  const [categoriaModalCurso, setCategoriaModalCurso] = useState<'REGULAR' | 'MULTIGRADO' | 'COMBINADO' | 'EPJA'>('REGULAR');
  const [nivel, setNivel] = useState('1° Básico');
  const [gradosCombinadosSeleccionados, setGradosCombinadosSeleccionados] = useState<string[]>(['1° Básico', '2° Básico']);
  const [nombrePersonalizadoCombinado, setNombrePersonalizadoCombinado] = useState('');
  const [letra, setLetra] = useState('A');
  const [regimen, setRegimen] = useState<'JEC' | 'No JEC'>('JEC');
  const [regimenProporcionModal, setRegimenProporcionModal] = useState<'65_35' | '60_40'>('65_35');
  const [cupoSae, setCupoSae] = useState(38);
  const [matriculaProyectada, setMatriculaProyectada] = useState(35);
  const [alumnosNeet, setAlumnosNeet] = useState(5);
  const [alumnosNeep, setAlumnosNeep] = useState(2);

  // Curso seleccionado y subpestaña activa
  const [cursoSeleccionadoPlan, setCursoSeleccionadoPlan] = useState<string>(cursos[0]?.id || '');
  const [tabCurso, setTabCurso] = useState<'docencia' | 'codocencia' | 'pie' | 'malla'>('docencia');
  const [busquedaCurso, setBusquedaCurso] = useState('');
  const [filtroCicloCurso, setFiltroCicloCurso] = useState<'TODOS' | 'PARVULARIA' | 'BASICA' | 'MEDIA_HC' | 'MEDIA_TP' | 'MULTIGRADO_COMBINADO' | 'EPJA' | 'ESPECIAL'>('TODOS');
  const [filtroRegimenCurso, setFiltroRegimenCurso] = useState<'TODOS' | 'JEC' | 'No JEC'>('TODOS');
  const [filtroCoberturaCurso, setFiltroCoberturaCurso] = useState<'TODOS' | 'COMPLETO' | 'DEFICIT' | 'SOBRE'>('TODOS');

  // Modales Asignación Aislados (0 lag al tipear)
  const [modalDocencia, setModalDocencia] = useState<{
    isOpen: boolean;
    editandoAsig: AsignacionHoraria | null;
    asignaturaSugerida?: string;
    horasSugeridas?: number;
  }>({ isOpen: false, editandoAsig: null });

  const [modalCoDocencia, setModalCoDocencia] = useState<{
    isOpen: boolean;
    editandoAsig: AsignacionHoraria | null;
    asignaturaSugerida?: string;
    horasSugeridas?: number;
  }>({ isOpen: false, editandoAsig: null });

  const [modalPie, setModalPie] = useState<{
    isOpen: boolean;
    editandoAsig: AsignacionHoraria | null;
  }>({ isOpen: false, editandoAsig: null });

  // Modal Ajuste NEET/NEEP del Curso
  const [modalNeeOpen, setModalNeeOpen] = useState(false);
  const [editNeet, setEditNeet] = useState(5);
  const [editNeep, setEditNeep] = useState(2);

  // Modales Combinar / Descombinar Cursos
  const [modalCombinarOpen, setModalCombinarOpen] = useState(false);
  const [cursoInicialCombinar, setCursoInicialCombinar] = useState<string | undefined>(undefined);
  const [modalDescombinarState, setModalDescombinarState] = useState<{
    isOpen: boolean;
    curso: CursoSae | null;
  }>({ isOpen: false, curso: null });

  const handleConfirmarCombinarCursos = async (cursosIdsSeleccionados: string[], nuevoCurso: CursoSae) => {
    await onGuardarCurso(nuevoCurso);

    if (onGuardarAsignacion) {
      const asigsATraspasar = asignaciones.filter(a => a.cursoId && cursosIdsSeleccionados.includes(a.cursoId));
      for (const a of asigsATraspasar) {
        await onGuardarAsignacion({
          ...a,
          cursoId: nuevoCurso.id
        });
      }
    }

    for (const cid of cursosIdsSeleccionados) {
      await onEliminarCurso(cid);
    }

    setCursoSeleccionadoPlan(nuevoCurso.id);
  };

  const handleConfirmarDescombinarCurso = async (cursoCombinadoId: string, cursosSeparados: CursoSae[]) => {
    for (const cs of cursosSeparados) {
      await onGuardarCurso(cs);
    }

    await onEliminarCurso(cursoCombinadoId);

    if (cursosSeparados.length > 0) {
      setCursoSeleccionadoPlan(cursosSeparados[0].id);
    }
  };

  if (!colegio) {
    return (
      <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-500">
        Selecciona un establecimiento en la barra superior.
      </div>
    );
  }

  // Helper para discriminar si una asignación es de Apoyo PIE (Decreto 170)
  const esApoyoPie = (a: AsignacionHoraria) => {
    return (
      a.tipoApoyo === 'PIE' ||
      (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('pie')) ||
      (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('recurso')) ||
      (a.tipoApoyo && a.tipoApoyo.toLowerCase().includes('co-docencia en aula regular')) ||
      (a.asignatura && a.asignatura.toLowerCase().includes('pie'))
    );
  };

  // Helper para discriminar Co-Docencia no PIE / Agrupaciones Flexibles (independiente de su fuente de financiamiento)
  const esCoDocenciaNoPie = (a: AsignacionHoraria) => {
    if (esApoyoPie(a)) return false;
    return (
      a.esCoDocencia === true ||
      a.esAgrupacionFlexible === true ||
      a.tipoApoyo === 'CO_DOCENCIA' ||
      a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ||
      a.tipoApoyo === 'REFUERZO_AULA' ||
      a.tipoApoyo === 'APOYO_DOCENTE' ||
      (a.tipoApoyo && /agrupaci|co.*docenc|codocenc|refuerzo|apoyo.*doc/i.test(a.tipoApoyo)) ||
      (a.asignatura && /agrupaci/i.test(a.asignatura)) ||
      (a.asignatura && /co.*docenc|codocenc|docenc.*compartida/i.test(a.asignatura) && !a.asignatura.toLowerCase().includes('pie'))
    );
  };

  // Cálculo de disponibilidad y carga horaria de cada docente/asistente
  const disponibilidadDocentes = useMemo(() => {
    const mapa = new Map<string, { horasAsignadas: number; horasLibres: number }>();
    for (const d of docentes) {
      const asigsD = asignaciones.filter(a => a.docenteId === d.id || (a.coDocenteId === d.id && a.tieneCoDocente));
      const totalAsig = asigsD.reduce((sum, a) => {
        return sum + (a.horasPedagogicasAula || a.horasCronologicasPie || 0);
      }, 0);
      mapa.set(d.id, {
        horasAsignadas: totalAsig,
        horasLibres: Math.max(0, d.horasContrato - totalAsig)
      });
    }
    return mapa;
  }, [docentes, asignaciones]);

  const handleCrearCurso = (e: React.FormEvent) => {
    e.preventDefault();
    let nivelFinal = nivel;
    let esMulti = false;
    let esComb = false;
    let tipoMod: 'REGULAR' | 'MULTIGRADO' | 'COMBINADO' | 'EPJA_BASICA' | 'EPJA_MEDIA_HC' | 'EPJA_MEDIA_TP' | 'ESPECIAL' = 'REGULAR';

    if (categoriaModalCurso === 'MULTIGRADO') {
      esMulti = true;
      tipoMod = 'MULTIGRADO';
      nivelFinal = nivel;
    } else if (categoriaModalCurso === 'COMBINADO') {
      esComb = true;
      tipoMod = 'COMBINADO';
      nivelFinal = nombrePersonalizadoCombinado.trim() || `Curso Combinado (${gradosCombinadosSeleccionados.join(' - ')})`;
    } else if (categoriaModalCurso === 'EPJA') {
      esMulti = false;
      nivelFinal = nivel;
      if (nivel.includes('Media TP')) tipoMod = 'EPJA_MEDIA_TP';
      else if (nivel.includes('Media HC')) tipoMod = 'EPJA_MEDIA_HC';
      else tipoMod = 'EPJA_BASICA';
    }

    const nuevo: CursoSae = {
      id: `curso-${Date.now()}`,
      rbd: colegio.rbd,
      periodo: periodoActivo,
      nivel: nivelFinal,
      letra: letra.trim().toUpperCase() || 'U',
      regimen,
      regimenProporcion: regimenProporcionModal,
      cupoSae: Number(cupoSae),
      matriculaProyectada: Number(matriculaProyectada),
      alumnosNeet: Number(alumnosNeet),
      alumnosNeep: Number(alumnosNeep),
      esMultigrado: esMulti,
      esCombinado: esComb,
      tipoModalidad: tipoMod,
      gradosCombinados: categoriaModalCurso === 'COMBINADO' ? gradosCombinadosSeleccionados : undefined
    };
    onGuardarCurso(nuevo);
    setModalCursoOpen(false);
    setCursoSeleccionadoPlan(nuevo.id);
  };

  const esModoTransversal = cursoSeleccionadoPlan === 'TRANSVERSAL';
  const cursoActivo = esModoTransversal ? null : (cursos.find(c => c.id === cursoSeleccionadoPlan) || cursos[0]);
  const esCursoTp = Boolean(
    cursoActivo && (
      esModalidadTp(cursoActivo.nivel) ||
      (cursoActivo.especialidadTp && esModalidadTp(cursoActivo.especialidadTp)) ||
      /\btp\b/i.test(cursoActivo.nivel) ||
      /t[eé]cnico/i.test(cursoActivo.nivel) ||
      (colegio && /t[eé]cnico|industrial|comercial|polit[eé]cnico|agr[ií]cola/i.test(colegio.nombre) && /^[34]°?\s*medio/i.test(cursoActivo.nivel))
    )
  );
  const planActivo = cursoActivo ? obtenerPlanPorCurso(cursoActivo.nivel, cursoActivo.regimen, cursoActivo.especialidadTp) : null;
  const horasPlanCurso = planActivo ? planActivo.totalHorasPlan : (esCursoTp ? 42 : (cursoActivo?.regimen === 'JEC' ? 38 : 30));

  // Asignaciones transversales / institucionales (sin curso asociado)
  const asignacionesTransversales = useMemo(() => {
    return asignaciones.filter(a => !a.cursoId || a.cursoId === 'TRANSVERSAL' || a.cursoId === 'SIN_CURSO');
  }, [asignaciones]);

  const totalHorasTransversales = asignacionesTransversales.reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);

  // Asignaciones del curso activo
  const asignacionesCurso = useMemo(() => {
    if (!cursoActivo) return [];
    return asignaciones.filter(a => a.cursoId === cursoActivo.id);
  }, [asignaciones, cursoActivo]);

  // Solo las horas de Malla Regular y Talleres JEC oficiales del plan suman a la cobertura del plan de estudio (38h/30h)
  // Las horas SEP, Co-Docencia no PIE, Agrupaciones Flexibles, Trabajo Colaborativo y PIE NO suman al plan de estudio del curso
  const asignacionesPlanRegularCurso = useMemo(() => {
    return asignacionesCurso.filter(
      a => !esApoyoPie(a) &&
           !esCoDocenciaNoPie(a) &&
           !a.esTallerSep &&
           a.tipoApoyo !== 'TALLER_SEP' &&
           !a.esTrabajoColaborativo &&
           a.tipoApoyo !== 'TRABAJO_COLABORATIVO'
    );
  }, [asignacionesCurso]);

  // Asignaciones de Co-Docencia No PIE y Agrupaciones Flexibles
  const asignacionesCoDocenciaCurso = useMemo(() => {
    return asignacionesCurso.filter(a => esCoDocenciaNoPie(a));
  }, [asignacionesCurso]);

  // Asignaciones de Apoyo PIE (Decreto 170)
  const asignacionesPieCurso = useMemo(() => {
    return asignacionesCurso.filter(a => esApoyoPie(a));
  }, [asignacionesCurso]);

  // Asignaciones generales de docencia (no PIE)
  const asignacionesDocenciaCurso = useMemo(() => {
    return asignacionesCurso.filter(a => !esApoyoPie(a) && !esCoDocenciaNoPie(a));
  }, [asignacionesCurso]);

  // Sumas del curso activo: La co-docencia y talleres SEP NO inflan el plan de estudio regular
  const totalHorasDocenciaAsignadas = asignacionesPlanRegularCurso.reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);
  const totalHorasCoDocenciaAsignadas = asignacionesCoDocenciaCurso.reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);
  const totalHorasTallerSepAsignadas = asignacionesCurso.filter(a => a.esTallerSep || a.tipoApoyo === 'TALLER_SEP').reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);
  const totalHorasColaborativoAsignadas = asignacionesCurso.filter(a => a.esTrabajoColaborativo || a.tipoApoyo === 'TRABAJO_COLABORATIVO').reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);
  const totalHorasPieAsignadas = asignacionesPieCurso.reduce((sum, a) => sum + (a.horasCronologicasPie || a.horasPedagogicasAula || 0), 0);

  // Demanda normativa PIE según Decreto 170 y Ord. 2398
  const demandaPieCurso = useMemo(() => {
    if (!cursoActivo) {
      return calcularDemandaNormativaPieCurso(0, 0, true);
    }
    const neet = cursoActivo.alumnosNeet !== undefined ? cursoActivo.alumnosNeet : 5;
    const neep = cursoActivo.alumnosNeep !== undefined ? cursoActivo.alumnosNeep : 2;
    const isJec = cursoActivo.regimen === 'JEC';
    return calcularDemandaNormativaPieCurso(neet, neep, isJec);
  }, [cursoActivo]);

  // Desglose de horas PIE asignadas en este curso por rol
  const desglosePieAsignado = useMemo(() => {
    let dif = 0;
    let pae = 0;
    let colab = 0;

    for (const a of asignacionesPieCurso) {
      const doc = docentes.find(d => d.id === a.docenteId);
      const hrs = a.horasCronologicasPie || a.horasPedagogicasAula || 0;
      const tipo = (a.tipoApoyo || '').toLowerCase();

      if (doc?.estamento === 'DOCENTE_DIFERENCIAL' || tipo.includes('diferencial') || tipo.includes('co-docencia')) {
        dif += hrs;
      } else if (doc?.estamento === 'PROFESIONAL_PAE' || tipo.includes('pae') || tipo.includes('clínico') || tipo.includes('clinico') || tipo.includes('fono') || tipo.includes('psico')) {
        pae += hrs;
      } else if (doc?.estamento === 'DOCENTE_AULA' || tipo.includes('colaborativ')) {
        colab += hrs;
      } else {
        dif += hrs;
      }
    }

    return { dif, pae, colab, total: dif + pae + colab };
  }, [asignacionesPieCurso, docentes]);

  // Demanda total calculada de horas aula de todo el colegio (incluye cursos + talleres transversales)
  const totalHorasDemandaColegio = useMemo(() => {
    const sumCursos = cursos.reduce((sum, c) => {
      const plan = obtenerPlanPorCurso(c.nivel, c.regimen);
      const horasTalleres = (c.talleresJec || []).reduce((s, t) => s + t.horas, 0);
      return sum + (plan ? plan.totalHorasPlan : c.regimen === 'JEC' ? 38 : 30) + horasTalleres;
    }, 0);
    return sumCursos + totalHorasTransversales;
  }, [cursos, totalHorasTransversales]);

  // Total de horas docencia del plan regular asignadas en todo el colegio (sin inflar con SEP ni Co-Docencia)
  const totalHorasAsignadasDocenciaColegio = asignaciones.filter(a =>
    !esApoyoPie(a) &&
    !esCoDocenciaNoPie(a) &&
    !a.esTallerSep &&
    a.tipoApoyo !== 'TALLER_SEP' &&
    !a.esTrabajoColaborativo &&
    a.tipoApoyo !== 'TRABAJO_COLABORATIVO'
  ).reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);

  // Handlers para abrir los modales aislados (0 lag)
  const abrirModalNuevaDocencia = (asignaturaSugerida?: string, horasSugeridas?: number) => {
    setModalDocencia({
      isOpen: true,
      editandoAsig: null,
      asignaturaSugerida,
      horasSugeridas
    });
  };

  const abrirModalEditarDocencia = (asig: AsignacionHoraria) => {
    setModalDocencia({
      isOpen: true,
      editandoAsig: asig
    });
  };

  const abrirModalNuevaCoDocencia = (asigSugerida?: string, hrsSugeridas?: number) => {
    setModalCoDocencia({
      isOpen: true,
      editandoAsig: null,
      asignaturaSugerida: asigSugerida,
      horasSugeridas: hrsSugeridas
    });
  };

  const abrirModalEditarCoDocencia = (asig: AsignacionHoraria) => {
    setModalCoDocencia({
      isOpen: true,
      editandoAsig: asig
    });
  };

  const abrirModalNuevoPie = () => {
    setModalPie({
      isOpen: true,
      editandoAsig: null
    });
  };

  const abrirModalEditarPie = (asig: AsignacionHoraria) => {
    setModalPie({
      isOpen: true,
      editandoAsig: asig
    });
  };

  // Auto-asignación asistida Jidoka para PIE en este curso
  const handleAutoAsignarPieCurso = async () => {
    if (!cursoActivo || !onGuardarAsignacion) return;

    const educadores = docentes.filter(d => d.estamento === 'DOCENTE_DIFERENCIAL');
    const asistentesPae = docentes.filter(d => d.estamento === 'PROFESIONAL_PAE');
    const docentesAula = docentes.filter(d => d.estamento === 'DOCENTE_AULA');

    if (educadores.length === 0 && asistentesPae.length === 0) {
      alert('No se encontraron Educadoras Diferenciales ni Profesionales Asistentes PAE en la dotación del establecimiento.');
      return;
    }

    const hrsDifDemandadas = demandaPieCurso.horasDiferencialDecimal;
    const hrsPaeDemandadas = demandaPieCurso.horasPaeDecimal;

    let asignadasCount = 0;

    // 1. Asignar Docente Diferencial si falta cobertura
    if (desglosePieAsignado.dif < hrsDifDemandadas && educadores.length > 0) {
      // Buscar el educador con más horas disponibles
      const docDif = educadores.reduce((best, cur) => {
        const dispBest = disponibilidadDocentes.get(best.id)?.horasLibres || 0;
        const dispCur = disponibilidadDocentes.get(cur.id)?.horasLibres || 0;
        return dispCur > dispBest ? cur : best;
      }, educadores[0]);

      const falta = parseFloat((hrsDifDemandadas - desglosePieAsignado.dif).toFixed(1));
      const asigDif: AsignacionHoraria = {
        id: `auto-pie-dif-${cursoActivo.id}-${Date.now()}`,
        rbd: colegio.rbd,
        periodo: periodoActivo,
        cursoId: cursoActivo.id,
        docenteId: docDif.id,
        asignatura: 'Apoyo PIE - Co-Docencia Aula Común (Decreto 170)',
        horasPedagogicasAula: Math.round(falta * 1.333),
        horasCronologicasPie: falta,
        esCoDocencia: true,
        tipoApoyo: 'Co-Docencia en Aula Regular'
      };
      await onGuardarAsignacion(asigDif);
      asignadasCount++;
    }

    // 2. Asignar Profesional PAE si falta cobertura
    if (desglosePieAsignado.pae < hrsPaeDemandadas && asistentesPae.length > 0) {
      const paeDoc = asistentesPae.reduce((best, cur) => {
        const dispBest = disponibilidadDocentes.get(best.id)?.horasLibres || 0;
        const dispCur = disponibilidadDocentes.get(cur.id)?.horasLibres || 0;
        return dispCur > dispBest ? cur : best;
      }, asistentesPae[0]);

      const faltaPae = parseFloat((hrsPaeDemandadas - desglosePieAsignado.pae).toFixed(1));
      const asigPae: AsignacionHoraria = {
        id: `auto-pie-pae-${cursoActivo.id}-${Date.now()}`,
        rbd: colegio.rbd,
        periodo: periodoActivo,
        cursoId: cursoActivo.id,
        docenteId: paeDoc.id,
        asignatura: `Apoyo Especializado PAE - ${paeDoc.titulo || 'Profesional Asistente'}`,
        horasPedagogicasAula: Math.round(faltaPae * 1.333),
        horasCronologicasPie: faltaPae,
        esCoDocencia: true,
        tipoApoyo: 'Apoyo Multidisciplinario / Clínico PAE'
      };
      await onGuardarAsignacion(asigPae);
      asignadasCount++;
    }

    // 3. Asignar Horas Colaborativas si faltan (3.0 hrs Art. 86)
    if (desglosePieAsignado.colab < 3.0 && docentesAula.length > 0) {
      const docAula = docentesAula[0];
      const asigColab: AsignacionHoraria = {
        id: `auto-pie-colab-${cursoActivo.id}-${Date.now()}`,
        rbd: colegio.rbd,
        periodo: periodoActivo,
        cursoId: cursoActivo.id,
        docenteId: docAula.id,
        asignatura: 'Trabajo Colaborativo / Co-Planificación (Art. 86)',
        horasPedagogicasAula: 4,
        horasCronologicasPie: 3.0,
        esCoDocencia: true,
        tipoApoyo: 'Trabajo Colaborativo / Co-Planificación'
      };
      await onGuardarAsignacion(asigColab);
      asignadasCount++;
    }

    alert(`¡Asignación Inteligente Jidoka Completada! Se generaron ${asignadasCount} asignaciones PIE para ${cursoActivo.nivel} ${cursoActivo.letra}.`);
  };

  const hayFiltrosCursoActivos = busquedaCurso !== '' || filtroCicloCurso !== 'TODOS' || filtroRegimenCurso !== 'TODOS' || filtroCoberturaCurso !== 'TODOS';

  const limpiarFiltrosCurso = () => {
    setBusquedaCurso('');
    setFiltroCicloCurso('TODOS');
    setFiltroRegimenCurso('TODOS');
    setFiltroCoberturaCurso('TODOS');
  };

  // Cursos filtrados por búsqueda y filtros de ciclo / régimen / cobertura
  const cursosFiltrados = cursos.filter(c => {
    const q = busquedaCurso.toLowerCase().trim();
    const matchTexto = q === '' || `${c.nivel} ${c.letra} ${c.especialidadTp || ''}`.toLowerCase().includes(q);

    let matchCiclo = true;
    const n = c.nivel.toLowerCase();
    const esLiceoTp = Boolean(colegio && /t[eé]cnico|industrial|comercial|polit[eé]cnico|agr[ií]cola/i.test(colegio.nombre));
    const esTP = Boolean(
      esModalidadTp(c.nivel) ||
      (c.especialidadTp && esModalidadTp(c.especialidadTp)) ||
      n.includes('tp') ||
      n.includes('técnico') ||
      n.includes('tecnico') ||
      n.includes('profesional') ||
      n.includes('especialidad') ||
      (esLiceoTp && /^[34]°?\s*medio/i.test(c.nivel))
    );

    if (filtroCicloCurso === 'PARVULARIA') {
      matchCiclo = (n.includes('nt1') || n.includes('nt2') || n.includes('kínder') || n.includes('kinder') || ((n.includes('párv') || n.includes('parv')) && !n.includes('medio') && !esTP)) && !esModalidadAdultos(c.nivel) && !esModalidadEspecial(c.nivel);
    } else if (filtroCicloCurso === 'BASICA') {
      matchCiclo = (n.includes('básico') || n.includes('basico') || n.includes('básica') || n.includes('basica')) && !esModalidadAdultos(c.nivel) && !c.esMultigrado && !c.esCombinado && !esModalidadMultigradoOCombinado(c.nivel) && !esModalidadEspecial(c.nivel);
    } else if (filtroCicloCurso === 'MEDIA_HC') {
      matchCiclo = (n.includes('medio') || n.includes('media')) && !esTP && !esModalidadAdultos(c.nivel) && !esModalidadEspecial(c.nivel);
    } else if (filtroCicloCurso === 'MEDIA_TP') {
      matchCiclo = esTP && !esModalidadAdultos(c.nivel) && !esModalidadEspecial(c.nivel);
    } else if (filtroCicloCurso === 'MULTIGRADO_COMBINADO') {
      matchCiclo = Boolean(c.esMultigrado || c.esCombinado || esModalidadMultigradoOCombinado(c.nivel));
    } else if (filtroCicloCurso === 'EPJA') {
      matchCiclo = Boolean(esModalidadAdultos(c.nivel) || c.tipoModalidad?.startsWith('EPJA'));
    } else if (filtroCicloCurso === 'ESPECIAL') {
      matchCiclo = Boolean(esModalidadEspecial(c.nivel) || c.tipoModalidad === 'ESPECIAL' || c.tipoModalidad === 'LABORAL' || esModalidadLaboral(c.nivel));
    }

    const matchRegimen = filtroRegimenCurso === 'TODOS' || c.regimen === filtroRegimenCurso;

    let matchCobertura = true;
    if (filtroCoberturaCurso !== 'TODOS') {
      const plan = obtenerPlanPorCurso(c.nivel, c.regimen);
      const hrsPlan = plan ? plan.totalHorasPlan : (c.regimen === 'JEC' ? 38 : 30);
      const asigsDoc = asignaciones.filter(a => a.cursoId === c.id && !esApoyoPie(a));
      const totDocAsig = asigsDoc.reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);

      if (filtroCoberturaCurso === 'COMPLETO') matchCobertura = totDocAsig === hrsPlan;
      else if (filtroCoberturaCurso === 'DEFICIT') matchCobertura = totDocAsig < hrsPlan;
      else if (filtroCoberturaCurso === 'SOBRE') matchCobertura = totDocAsig > hrsPlan;
    }

    return matchTexto && matchCiclo && matchRegimen && matchCobertura;
  });

  return (
    <div className="space-y-6">
      {/* Resumen Superior */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-orange-50 border border-orange-200 text-orange-700 text-[11px] font-bold">
            <School className="w-3.5 h-3.5" />
            Bases Curriculares Oficiales MINEDUC, Multigrado, EPJA & Decreto 170
          </div>
          <h2 className="text-xl font-bold text-slate-800 mt-1">
            Planes de Estudio & Asignación Docente / PIE - {colegio.nombre}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Asigna asignaturas de la malla obligatoria, multigrado, EPJA y co-docencia de inclusión a cada curso con control normativo de horas en tiempo real.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-50 p-2.5 px-4 rounded-lg border border-slate-200 text-right">
            <div className="text-[10px] uppercase font-bold text-slate-500">Demanda Total Malla</div>
            <div className="text-lg font-black text-[#002B49] flex items-center gap-1 justify-end">
              <Clock className="w-4 h-4 text-orange-600" />
              <span>{totalHorasDemandaColegio}</span>
              <span className="text-[10px] font-bold text-slate-400">HA/sem</span>
            </div>
            <div className="text-[10px] text-slate-500 font-semibold">
              Cubierto: {totalHorasAsignadasDocenciaColegio} HA ({totalHorasDemandaColegio > 0 ? Math.round((totalHorasAsignadasDocenciaColegio / totalHorasDemandaColegio) * 100) : 0}%)
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalCombinarOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-lg shadow-xs transition-all cursor-pointer"
            title="Combinar dos o más cursos del establecimiento en un aula multigrado/combinada"
          >
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>Combinar Cursos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCategoriaModalCurso('REGULAR');
              setNivel('1° Básico');
              setRegimen('JEC');
              setModalCursoOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Agregar Curso</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Columna Izquierda: Lista de Cursos del Colegio con Badges de Docencia y PIE */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5 truncate">
              <Layers className="w-4 h-4 text-slate-600 shrink-0" />
              <span>Cursos ({cursos.length})</span>
            </h3>
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setCursoInicialCombinar(undefined);
                  setModalCombinarOpen(true);
                }}
                className="text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                title="Combinar 2 o más cursos creados"
              >
                <Layers className="w-3 h-3 text-indigo-600" />
                <span>Combinar</span>
              </button>
              <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg">
                {cursosFiltrados.length} visibles
              </span>
            </div>
          </div>

          {/* Panel de Filtros de Cursos */}
          <div className="space-y-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/80">
            {/* Buscador de cursos */}
            <div className="relative">
              <input
                type="text"
                placeholder="Buscar curso (ej: 1° Básico, Multigrado, EPJA)..."
                value={busquedaCurso}
                onChange={e => setBusquedaCurso(e.target.value)}
                className="w-full px-3 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:bg-white focus:outline-none"
              />
              {busquedaCurso && (
                <button
                  onClick={() => setBusquedaCurso('')}
                  className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              {/* Ciclo */}
              <select
                value={filtroCicloCurso}
                onChange={(e) => setFiltroCicloCurso(e.target.value as any)}
                className="w-full px-2 py-1 text-[11px] font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-orange-500"
              >
                <option value="TODOS">Todos los Ciclos</option>
                <option value="PARVULARIA">Parvularia Regular</option>
                <option value="BASICA">Básica Regular (1°-8°)</option>
                <option value="MEDIA_HC">Media HC Regular</option>
                <option value="MEDIA_TP">Media TP Regular</option>
                <option value="MULTIGRADO_COMBINADO">Multigrado / Combinados</option>
                <option value="EPJA">Adultos (EPJA)</option>
                <option value="ESPECIAL">Educación Especial / Laboral</option>
              </select>

              {/* Régimen */}
              <select
                value={filtroRegimenCurso}
                onChange={(e) => setFiltroRegimenCurso(e.target.value as any)}
                className="w-full px-2 py-1 text-[11px] font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-orange-500"
              >
                <option value="TODOS">JEC y No JEC</option>
                <option value="JEC">Solo JEC</option>
                <option value="No JEC">Solo No JEC</option>
              </select>
            </div>

            <div className="flex items-center justify-between gap-1.5 pt-1">
              <select
                value={filtroCoberturaCurso}
                onChange={(e) => setFiltroCoberturaCurso(e.target.value as any)}
                className="w-full px-2 py-1 text-[11px] font-semibold border border-slate-200 rounded-lg bg-white text-slate-700 focus:ring-2 focus:ring-orange-500"
              >
                <option value="TODOS">Todas las Coberturas</option>
                <option value="COMPLETO">100% Cubierto</option>
                <option value="DEFICIT">Con Horas Faltantes</option>
                <option value="SOBRE">Con Sobreasignación</option>
              </select>

              {hayFiltrosCursoActivos && (
                <button
                  onClick={limpiarFiltrosCurso}
                  className="shrink-0 px-2 py-1 text-[10px] font-bold text-orange-700 bg-orange-100/70 hover:bg-orange-200/80 rounded-md transition-colors"
                  title="Restablecer filtros"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
            {/* Card especial: Talleres Transversales / Institucionales */}
            <div
              onClick={() => setCursoSeleccionadoPlan('TRANSVERSAL')}
              className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-1.5 ${
                cursoSeleccionadoPlan === 'TRANSVERSAL'
                  ? 'border-amber-500 bg-amber-50/60 shadow-sm ring-1 ring-amber-400/30'
                  : 'border-slate-200 bg-amber-50/20 hover:bg-amber-50/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Talleres Transversales</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold">
                    Institucional
                  </span>
                </div>
                <span className="text-[11px] font-extrabold text-amber-700">
                  {totalHorasTransversales} HA
                </span>
              </div>
              <div className="text-[10px] text-slate-500 flex items-center justify-between">
                <span>{asignacionesTransversales.length} taller(es) registrados</span>
                <span className="font-semibold text-slate-600">Sin curso fijo</span>
              </div>
            </div>

            {cursosFiltrados.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-6">No hay cursos registrados o que coincidan con la búsqueda.</p>
            ) : (
              cursosFiltrados.map(c => {
                const isSelected = cursoActivo?.id === c.id;
                const plan = obtenerPlanPorCurso(c.nivel, c.regimen);
                const hrsPlan = plan ? plan.totalHorasPlan : c.regimen === 'JEC' ? 38 : 30;

                // Horas de docencia asignadas en el plan regular de este curso (sin inflar por SEP, Co-Docencia ni PIE)
                const asigsPlanReg = asignaciones.filter(a =>
                  a.cursoId === c.id &&
                  !esApoyoPie(a) &&
                  !esCoDocenciaNoPie(a) &&
                  !a.esTallerSep &&
                  a.tipoApoyo !== 'TALLER_SEP' &&
                  !a.esTrabajoColaborativo &&
                  a.tipoApoyo !== 'TRABAJO_COLABORATIVO'
                );
                const totDocPlanAsig = asigsPlanReg.reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);

                // Horas de Co-Docencia No PIE y Agrupaciones Flexibles
                const asigsCoDoc = asignaciones.filter(a => a.cursoId === c.id && esCoDocenciaNoPie(a));
                const totCoDoc = asigsCoDoc.reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);

                // Horas de Talleres SEP
                const asigsSep = asignaciones.filter(a => a.cursoId === c.id && (a.esTallerSep || a.tipoApoyo === 'TALLER_SEP'));
                const totSep = asigsSep.reduce((sum, a) => sum + (a.horasPedagogicasAula || 0), 0);

                // Demanda y asignación PIE en este curso
                const cNeet = c.alumnosNeet !== undefined ? c.alumnosNeet : 5;
                const cNeep = c.alumnosNeep !== undefined ? c.alumnosNeep : 2;
                const demPie = calcularDemandaNormativaPieCurso(cNeet, cNeep, c.regimen === 'JEC');
                const asigsPie = asignaciones.filter(a => a.cursoId === c.id && esApoyoPie(a));
                const totPieAsig = asigsPie.reduce((sum, a) => sum + (a.horasCronologicasPie || a.horasPedagogicasAula || 0), 0);

                const coberturaDocPct = hrsPlan > 0 ? Math.round((totDocPlanAsig / hrsPlan) * 100) : 0;
                const docColor = totDocPlanAsig === hrsPlan ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
                                 totDocPlanAsig > hrsPlan ? 'text-red-700 bg-red-50 border-red-200' :
                                 'text-amber-700 bg-amber-50 border-amber-200';

                return (
                  <div
                    key={c.id}
                    onClick={() => setCursoSeleccionadoPlan(c.id)}
                    className={`p-3 rounded-xl border text-xs cursor-pointer transition-all space-y-2 ${
                      isSelected
                        ? 'border-orange-500 bg-orange-50/40 shadow-sm ring-1 ring-orange-400/30'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-800 flex flex-wrap items-center gap-1.5">
                          <span>{c.nivel} {c.letra}</span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                            {c.regimen}
                          </span>
                          {c.esMultigrado || esModalidadMultigradoOCombinado(c.nivel) ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-100 text-cyan-800 font-bold border border-cyan-200">
                              Multigrado
                            </span>
                          ) : null}
                          {c.esCombinado ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-bold border border-purple-200">
                              Combinado
                            </span>
                          ) : null}
                          {esModalidadAdultos(c.nivel) || c.tipoModalidad?.startsWith('EPJA') ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 font-bold border border-indigo-200">
                              EPJA
                            </span>
                          ) : null}
                          {plan?.categoria === 'MEDIA_TP' || esModalidadTp(c.nivel) || (c.especialidadTp && esModalidadTp(c.especialidadTp)) || c.nivel.toLowerCase().includes('tp') || c.nivel.toLowerCase().includes('especialidad') ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-bold border border-amber-200">
                              Técnico-Profesional
                            </span>
                          ) : null}
                          {esModalidadLaboral(c.nivel) || c.tipoModalidad === 'LABORAL' ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                              Nivel Laboral (Dec. 87)
                            </span>
                          ) : ((esModalidadEspecial(c.nivel) || c.tipoModalidad === 'ESPECIAL') && !esModalidadTp(c.nivel) && !c.especialidadTp) ? (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-teal-100 text-teal-800 font-bold border border-teal-200">
                              Educación Especial (Dec. 83)
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Matrícula: <strong className="text-slate-700">{c.matriculaProyectada}</strong> est. (Cupo {c.cupoSae})
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        {(c.esCombinado || c.tipoModalidad === 'COMBINADO' || (c.gradosCombinados && c.gradosCombinados.length >= 2)) ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setModalDescombinarState({ isOpen: true, curso: c });
                            }}
                            title="Descombinar este curso en sus grados individuales"
                            className="text-purple-700 hover:text-purple-900 bg-purple-100/80 hover:bg-purple-200 border border-purple-300 px-2 py-0.5 rounded transition-colors text-[10px] font-bold flex items-center gap-1 shadow-2xs"
                          >
                            <Layers className="w-3 h-3 text-purple-700" />
                            <span>Descombinar</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCursoInicialCombinar(c.id);
                              setModalCombinarOpen(true);
                            }}
                            title="Combinar este curso con otros cursos del establecimiento"
                            className="text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors text-[10px] font-semibold flex items-center gap-0.5 border border-indigo-200/60"
                          >
                            <Layers className="w-3 h-3 text-indigo-500" />
                            <span>Combinar</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Eliminar ${c.nivel} ${c.letra} y todas sus asignaciones?`)) {
                              onEliminarCurso(c.id);
                            }
                          }}
                          title="Eliminar curso"
                          className="text-slate-400 hover:text-red-600 p-1 transition-colors rounded hover:bg-red-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Badges de Cobertura */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100">
                      {/* Badge Docencia Plan Regular */}
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold ${docColor}`}>
                        <BookOpen className="w-3 h-3" />
                        {totDocPlanAsig}/{hrsPlan} HA ({coberturaDocPct}%)
                      </span>

                      {/* Badge Co-Docencia no PIE */}
                      {totCoDoc > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold text-indigo-700 bg-indigo-50 border-indigo-200">
                          <Users className="w-3 h-3 text-indigo-600" />
                          {totCoDoc}h Co-Doc
                        </span>
                      )}

                      {/* Badge SEP */}
                      {totSep > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold text-emerald-700 bg-emerald-50 border-emerald-200">
                          <Sparkles className="w-3 h-3 text-emerald-600" />
                          {totSep}h SEP
                        </span>
                      )}

                      {/* Badge PIE */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[10px] font-bold text-purple-700 bg-purple-50 border-purple-200">
                        <ShieldCheck className="w-3 h-3 text-purple-600" />
                        {totPieAsig.toFixed(1)}/{demPie.horasTotalCronologicas.toFixed(1)}h PIE
                      </span>

                      {/* Alumnos NEE */}
                      <span className="text-[10px] font-medium text-slate-500 ml-auto">
                        {cNeet}T • {cNeep}P
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Columna Derecha: Panel Principal del Curso con Subpestañas o Panel de Talleres Transversales */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-5">
          {cursoSeleccionadoPlan === 'TRANSVERSAL' ? (
            <div className="space-y-6">
              {/* Cabecera de Talleres Transversales */}
              <div className="flex flex-col md:flex-row md:items-start justify-between border-b pb-4 gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                      <Sparkles className="w-3 h-3 text-amber-600" />
                      Nivel Institucional / Extraescolar
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                      Sin Curso Específico
                    </span>
                  </div>
                  <h3 className="text-xl font-black text-slate-800 mt-1">
                    Talleres Institucionales & Transversales
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Talleres extraescolares, robótica, academias, deportes, artes, teatro y refuerzo pedagógico SEP transversal.
                  </p>
                </div>

                <button
                  onClick={() => abrirModalNuevaDocencia('Taller de Robótica / Extraescolar', 4)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Taller Transversal</span>
                </button>
              </div>

              {/* Métricas de Talleres Transversales */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-amber-50/50 rounded-xl border border-amber-200">
                  <span className="text-[10px] font-bold text-amber-800 uppercase block">Total Horas Transversales</span>
                  <div className="text-xl font-black text-amber-900 mt-1 flex items-baseline gap-1">
                    <span>{totalHorasTransversales}</span>
                    <span className="text-xs font-semibold text-amber-700">HA/sem</span>
                  </div>
                  <span className="text-[10px] text-amber-700 mt-0.5 block">Suman a la demanda del colegio</span>
                </div>

                <div className="p-3.5 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">Talleres SEP</span>
                  <div className="text-xl font-black text-emerald-900 mt-1 flex items-baseline gap-1">
                    <span>{asignacionesTransversales.filter(a => a.esTallerSep).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0)}</span>
                    <span className="text-xs font-semibold text-emerald-700">HA/sem</span>
                  </div>
                  <span className="text-[10px] text-emerald-700 mt-0.5 block">Financiamiento SEP / Exento</span>
                </div>

                <div className="p-3.5 bg-blue-50/50 rounded-xl border border-blue-200">
                  <span className="text-[10px] font-bold text-blue-800 uppercase block">Talleres Regulares</span>
                  <div className="text-xl font-black text-blue-900 mt-1 flex items-baseline gap-1">
                    <span>{asignacionesTransversales.filter(a => !a.esTallerSep).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0)}</span>
                    <span className="text-xs font-semibold text-blue-700">HA/sem</span>
                  </div>
                  <span className="text-[10px] text-blue-700 mt-0.5 block">Subvención General</span>
                </div>
              </div>

              {/* Tabla de Talleres Transversales */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[11px] border-b">
                    <tr>
                      <th className="px-4 py-3">Nombre del Taller</th>
                      <th className="px-3 py-3">Docente a Cargo</th>
                      <th className="px-3 py-3 text-center">Horas Pedagógicas</th>
                      <th className="px-3 py-3 text-center">Tipo / Financiamiento</th>
                      <th className="px-4 py-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {asignacionesTransversales.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-400">
                          <p className="font-semibold text-sm">No hay talleres transversales registrados.</p>
                          <p className="text-xs mt-1">Haz clic en "Crear Taller Transversal" para agregar academias o talleres institucionales.</p>
                        </td>
                      </tr>
                    ) : (
                      asignacionesTransversales.map(asig => {
                        const doc = docentes.find(d => d.id === asig.docenteId);
                        return (
                          <tr key={asig.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-bold text-slate-800">
                              <div className="flex items-center gap-2">
                                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                                <span>{asig.asignatura}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3">
                              {doc ? (
                                <div>
                                  <div className="font-semibold text-slate-800">{doc.nombres} {doc.apellidos}</div>
                                  <div className="text-[10px] text-slate-400 font-mono">{doc.run}</div>
                                </div>
                              ) : (
                                <span className="text-amber-600 italic font-semibold">Sin docente asignado</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center font-black text-slate-900 text-sm">
                              {asig.horasPedagogicasAula} HA
                            </td>
                            <td className="px-3 py-3 text-center">
                              {asig.esTallerSep ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  SEP Extracurricular
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                                  Regular / Institucional
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => abrirModalEditarDocencia(asig)}
                                  className="text-slate-400 hover:text-blue-600 p-1 rounded hover:bg-blue-50"
                                  title="Editar taller"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    if (confirm(`¿Eliminar el taller "${asig.asignatura}"?`)) {
                                      if (onEliminarAsignacion) await onEliminarAsignacion(asig.id);
                                    }
                                  }}
                                  className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50"
                                  title="Eliminar taller"
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

              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  <strong>Cálculo Automático en Planta & Carga Horaria:</strong> Cada taller transversal se contabiliza automáticamente en la carga del docente asignado, se valida contra las tablas MINEDUC de la Ley 20.903 y se agrega a la demanda global del establecimiento.
                </span>
              </div>
            </div>
          ) : cursoActivo && planActivo ? (
            <div>
              {/* Cabecera del Curso Activo */}
              <div className="flex flex-col md:flex-row md:items-start justify-between border-b pb-4 gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-2 py-0.5 rounded border border-orange-200">
                      {planActivo.nivel} ({cursoActivo.regimen})
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Proporción: {cursoActivo.regimenProporcion === '60_40' ? '60/40' : '65/35'}
                    </span>
                    <button
                      onClick={() => {
                        setEditNeet(cursoActivo.alumnosNeet !== undefined ? cursoActivo.alumnosNeet : 5);
                        setEditNeep(cursoActivo.alumnosNeep !== undefined ? cursoActivo.alumnosNeep : 2);
                        setModalNeeOpen(true);
                      }}
                      className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-0.5 rounded border border-purple-200 flex items-center gap-1 transition-colors"
                      title="Editar cupos PIE del curso"
                    >
                      <Users className="w-3 h-3" />
                      PIE: {cursoActivo.alumnosNeet || 0} NEET / {cursoActivo.alumnosNeep || 0} NEEP
                      <Edit2 className="w-2.5 h-2.5 ml-0.5 text-purple-500" />
                    </button>
                    {(cursoActivo.esCombinado || cursoActivo.tipoModalidad === 'COMBINADO' || (cursoActivo.gradosCombinados && cursoActivo.gradosCombinados.length >= 2)) && (
                      <button
                        type="button"
                        onClick={() => setModalDescombinarState({ isOpen: true, curso: cursoActivo })}
                        className="text-[10px] font-bold uppercase tracking-wider text-purple-700 bg-purple-100/70 hover:bg-purple-200/80 px-2 py-0.5 rounded border border-purple-300 flex items-center gap-1 transition-colors"
                        title="Descombinar este curso en grados individuales"
                      >
                        <Layers className="w-3 h-3 text-purple-600" />
                        <span>Descombinar Curso</span>
                      </button>
                    )}
                  </div>

                  <h3 className="text-xl font-black text-slate-800 mt-1">
                    {cursoActivo.nivel} {cursoActivo.letra}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Plan MINEDUC: {horasPlanCurso} HA | Matrícula: {cursoActivo.matriculaProyectada} estudiantes | Aforo SAE: {cursoActivo.cupoSae}
                  </p>

                  {esCursoTp && (
                    <div className="mt-2.5 p-2.5 bg-orange-50/90 rounded-xl border border-orange-200/80 flex flex-wrap items-center gap-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-orange-950">
                        <Wrench className="w-3.5 h-3.5 text-orange-600" />
                        <span>Especialidad TP:</span>
                      </div>
                      <select
                        value={cursoActivo.especialidadTp || cursoActivo.nivel}
                        onChange={(e) => {
                          const nuevaEsp = e.target.value;
                          onGuardarCurso({
                            ...cursoActivo,
                            especialidadTp: nuevaEsp,
                            nivel: nuevaEsp
                          });
                        }}
                        className="px-2.5 py-1 text-xs font-semibold bg-white border border-orange-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-orange-500 max-w-md truncate"
                      >
                        <option value="">-- Seleccionar Especialidad Oficial MINEDUC --</option>
                        {NIVELES_TP_ESPECIALIDADES.map((tp) => (
                          <option key={tp} value={tp}>
                            {tp}
                          </option>
                        ))}
                      </select>
                      {(!cursoActivo.especialidadTp && (cursoActivo.nivel.includes('Técnico-Profesional') || cursoActivo.nivel.toLowerCase().includes('tp'))) && (
                        <span className="text-[11px] font-bold text-orange-700">
                          ⚠️ Asigna una especialidad para ver los módulos técnicos de 42 HA.
                        </span>
                      )}
                    </div>
                  )}

                  {/* Controles de Ajuste Rápido del Curso */}
                  <div className="flex flex-wrap items-center gap-4 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Jornada:</span>
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => onGuardarCurso({ ...cursoActivo, regimen: 'JEC' })}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                            cursoActivo.regimen === 'JEC'
                              ? 'bg-orange-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          JEC (38h)
                        </button>
                        <button
                          type="button"
                          onClick={() => onGuardarCurso({ ...cursoActivo, regimen: 'No JEC' })}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                            cursoActivo.regimen === 'No JEC'
                              ? 'bg-slate-800 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          No JEC (30h)
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-bold text-slate-600">Régimen Docente:</span>
                      <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
                        <button
                          type="button"
                          onClick={() => onGuardarCurso({ ...cursoActivo, regimenProporcion: '65_35' })}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                            (cursoActivo.regimenProporcion || '65_35') === '65_35'
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          65/35 (Estándar)
                        </button>
                        <button
                          type="button"
                          onClick={() => onGuardarCurso({ ...cursoActivo, regimenProporcion: '60_40' })}
                          className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all ${
                            cursoActivo.regimenProporcion === '60_40'
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          60/40 (Vulnerabilidad)
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Resumen Indicador de Cobertura del Curso */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-right min-w-[200px] flex-shrink-0">
                  <div className="text-[10px] uppercase font-bold text-slate-500">Plan de Estudio (Malla + JEC)</div>
                  <div className="text-2xl font-black text-[#002B49] flex items-center gap-1 justify-end">
                    <span>{totalHorasDocenciaAsignadas}</span>
                    <span className="text-slate-400 text-sm font-bold">/ {horasPlanCurso} HA</span>
                  </div>
                  <div className={`text-[11px] font-bold mt-0.5 ${
                    totalHorasDocenciaAsignadas === horasPlanCurso ? 'text-emerald-600' :
                    totalHorasDocenciaAsignadas > horasPlanCurso ? 'text-red-600' : 'text-amber-600'
                  }`}>
                    {totalHorasDocenciaAsignadas === horasPlanCurso ? '✓ Plan 100% Cubierto' :
                     totalHorasDocenciaAsignadas > horasPlanCurso ? `⚠️ Exceso de ${totalHorasDocenciaAsignadas - horasPlanCurso} HA` :
                     `Faltan ${horasPlanCurso - totalHorasDocenciaAsignadas} HA`}
                  </div>
                  {(totalHorasCoDocenciaAsignadas > 0 || totalHorasTallerSepAsignadas > 0 || totalHorasColaborativoAsignadas > 0) && (
                    <div className="text-[10px] text-slate-500 mt-1 pt-1 border-t border-slate-200 flex justify-end gap-2 flex-wrap">
                      {totalHorasCoDocenciaAsignadas > 0 && (
                        <span className="text-indigo-700 font-semibold">+{totalHorasCoDocenciaAsignadas} HA Co-Docencia (Exenta de Plan)</span>
                      )}
                      {totalHorasTallerSepAsignadas > 0 && (
                        <span className="text-emerald-700 font-semibold">+{totalHorasTallerSepAsignadas} HA SEP (Exenta de Plan)</span>
                      )}
                      {totalHorasColaborativoAsignadas > 0 && (
                        <span className="text-purple-700 font-semibold">+{totalHorasColaborativoAsignadas} HA Colab (Exenta)</span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Selector de Subpestañas del Curso */}
              <div className="flex border-b border-slate-200 mt-2">
                <button
                  type="button"
                  onClick={() => setTabCurso('docencia')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    tabCurso === 'docencia'
                      ? 'border-orange-600 text-orange-600 bg-orange-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Docencia de Aula ({totalHorasDocenciaAsignadas}/{horasPlanCurso} HA)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabCurso('codocencia')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    tabCurso === 'codocencia'
                      ? 'border-indigo-600 text-indigo-700 bg-indigo-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Users className="w-4 h-4 text-indigo-600" />
                  <span>Co-Docencia & Agrupaciones ({totalHorasCoDocenciaAsignadas} HA)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabCurso('pie')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    tabCurso === 'pie'
                      ? 'border-purple-600 text-purple-700 bg-purple-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <ShieldCheck className="w-4 h-4 text-purple-600" />
                  <span>Apoyo PIE ({totalHorasPieAsignadas.toFixed(1)}/{demandaPieCurso.horasTotalCronologicas.toFixed(1)} hrs)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTabCurso('malla')}
                  className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition-all ${
                    tabCurso === 'malla'
                      ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <BookCheck className="w-4 h-4" />
                  <span>Malla Oficial MINEDUC</span>
                </button>
              </div>

              {/* ========================================================= */}
              {/* SUBPESTAÑA 1: DOCENCIA DE AULA CURRICULAR REGULAR         */}
              {/* ========================================================= */}
              {tabCurso === 'docencia' && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-orange-50/60 p-3 rounded-lg border border-orange-100">
                    <div>
                      <h4 className="text-xs font-bold text-orange-950">Malla Curricular Obligatoria</h4>
                      <p className="text-[11px] text-orange-800/80">
                        Asigna profesores y horas pedagógicas semanales (HA) para cubrir el plan obligatorio de este curso.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => abrirModalNuevaDocencia()}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-lg shadow-xs transition-all whitespace-nowrap"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Asignar Docente / Asignatura</span>
                    </button>
                  </div>

                  {/* Tabla de Asignaciones de Aula Regular */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b">
                        <tr>
                          <th className="px-4 py-2.5">Asignatura</th>
                          <th className="px-4 py-2.5">Docente Asignado</th>
                          <th className="px-4 py-2.5 text-center">Horas Aula (HA)</th>
                          <th className="px-4 py-2.5 text-center">Tipo</th>
                          <th className="px-4 py-2.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {asignacionesPlanRegularCurso.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                              No hay docentes ni asignaturas asignadas a este curso aún. Haz clic en <strong>"+ Asignar Docente / Asignatura"</strong> o selecciona una materia del plan sugerido abajo.
                            </td>
                          </tr>
                        ) : (
                          asignacionesPlanRegularCurso.map(a => {
                            const doc = docentes.find(d => d.id === a.docenteId);
                            const disp = doc ? disponibilidadDocentes.get(doc.id) : null;

                            return (
                              <tr key={a.id} className="hover:bg-slate-50/70">
                                <td className="px-4 py-2.5 font-medium text-slate-800 flex items-center gap-2">
                                  <BookOpen className="w-3.5 h-3.5 text-orange-600 flex-shrink-0" />
                                  <span>{a.asignatura}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {doc ? (
                                    <div>
                                      <div className="font-bold text-slate-800">{doc.nombres} {doc.apellidos}</div>
                                      <div className="text-[10px] text-slate-500">
                                        RUN: {doc.run} • Contrato: {doc.horasContrato}h (Asig: {disp?.horasAsignadas || 0}h)
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-red-500 italic">Docente no encontrado (ID: {a.docenteId})</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-center font-bold text-slate-800">
                                  {a.horasPedagogicasAula} HA
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {a.esTallerJec ? (
                                    <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold">
                                      Taller JEC
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                                      Plan Regular
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => abrirModalEditarDocencia(a)}
                                      className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors"
                                      title="Editar horas o docente"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`¿Eliminar la asignación de ${a.asignatura}?`)) {
                                          if (onEliminarAsignacion) await onEliminarAsignacion(a.id);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                      title="Eliminar asignación"
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

                  {/* Sugerencias Rápidas de Asignaturas del Plan MINEDUC */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2.5">
                    <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                      Asignaturas Sugeridas por el Plan Oficial ({planActivo.nivel})
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {planActivo.asignaturasBase.map((asig, i) => {
                        const yaAsignada = asignacionesPlanRegularCurso.some(a =>
                          a.asignatura.toLowerCase().includes(asig.nombre.toLowerCase()) ||
                          asig.nombre.toLowerCase().includes(a.asignatura.toLowerCase())
                        );

                        return (
                          <div
                            key={i}
                            className={`p-2.5 rounded-lg border text-xs flex items-center justify-between transition-all ${
                              yaAsignada
                                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-900'
                                : 'bg-white border-slate-200 hover:border-orange-400'
                            }`}
                          >
                            <div>
                              <div className="font-bold flex items-center gap-1">
                                {yaAsignada ? <CheckCircle2 className="w-3 h-3 text-emerald-600" /> : null}
                                <span className="truncate max-w-[130px]">{asig.nombre}</span>
                              </div>
                              <div className="text-[10px] text-slate-500">Plan: {asig.horasSugeridas} HA</div>
                            </div>

                            {!yaAsignada && (
                              <button
                                type="button"
                                onClick={() => abrirModalNuevaDocencia(asig.nombre, asig.horasSugeridas)}
                                className="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-800 text-[10px] font-bold rounded transition-colors"
                              >
                                + Asignar
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* ========================================================= */}
              {/* SUBPESTAÑA 2: CO-DOCENCIA & AGRUPACIONES FLEXIBLES (NO PIE) */}
              {/* ========================================================= */}
              {tabCurso === 'codocencia' && (
                <div className="space-y-4 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-indigo-50/70 p-4 rounded-xl border border-indigo-200">
                    <div>
                      <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 text-[11px] font-bold mb-1">
                        <Users className="w-3.5 h-3.5 text-indigo-700" />
                        Co-Enseñanza & Apoyo Pedagógico en Sala (No PIE)
                      </div>
                      <h4 className="text-sm font-bold text-indigo-950">
                        Co-Docencia, Agrupaciones Flexibles y Refuerzo de Aula
                      </h4>
                      <p className="text-[11px] text-indigo-900/80 mt-0.5 max-w-xl">
                        Asigna docentes o funcionarios de apoyo (segundo profesor, división de grupos, refuerzo pedagógico). Suman horas al contrato del funcionario pero <strong>no inflan el plan de estudio oficial del curso</strong> ({horasPlanCurso} HA).
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => abrirModalNuevaCoDocencia()}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      <span>+ Asignar Co-Docencia</span>
                    </button>
                  </div>

                  {/* Tarjetas Resumen de Co-Docencia */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-100">
                      <span className="text-[10px] uppercase font-bold text-indigo-800 block">Total Horas Co-Docencia</span>
                      <div className="text-xl font-black text-indigo-950 mt-0.5 flex items-baseline gap-1">
                        <span>{totalHorasCoDocenciaAsignadas}</span>
                        <span className="text-xs font-semibold text-indigo-700">HA</span>
                      </div>
                      <span className="text-[10px] text-indigo-600 mt-0.5 block">Suma a carga de docentes</span>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200">
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Agrupaciones Flexibles</span>
                      <div className="text-xl font-black text-slate-800 mt-0.5 flex items-baseline gap-1">
                        <span>
                          {asignacionesCoDocenciaCurso.filter(a => a.esAgrupacionFlexible || a.tipoApoyo === 'AGRUPACION_FLEXIBLE').reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0)}
                        </span>
                        <span className="text-xs font-semibold text-slate-500">HA</span>
                      </div>
                      <span className="text-[10px] text-slate-400 mt-0.5 block">División modular de cursos</span>
                    </div>

                    <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100">
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">Financiadas con SEP</span>
                      <div className="text-xl font-black text-emerald-950 mt-0.5 flex items-baseline gap-1">
                        <span>
                          {asignacionesCoDocenciaCurso.filter(a => a.esTallerSep).reduce((s, a) => s + (a.horasPedagogicasAula || 0), 0)}
                        </span>
                        <span className="text-xs font-semibold text-emerald-700">HA</span>
                      </div>
                      <span className="text-[10px] text-emerald-600 mt-0.5 block">Refuerzo SEP en aula</span>
                    </div>
                  </div>

                  {/* Tabla de Asignaciones de Co-Docencia */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-indigo-50/60 text-indigo-950 uppercase font-semibold text-[10px] border-b border-indigo-100">
                        <tr>
                          <th className="px-4 py-2.5">Asignatura Apoyada</th>
                          <th className="px-4 py-2.5">Docente / Funcionario de Apoyo</th>
                          <th className="px-4 py-2.5">Modalidad de Apoyo</th>
                          <th className="px-4 py-2.5 text-center">Horas Aula (HA)</th>
                          <th className="px-4 py-2.5 text-center">Financiamiento</th>
                          <th className="px-4 py-2.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {asignacionesCoDocenciaCurso.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-slate-400 italic">
                              No hay registros de co-docencia ni agrupaciones flexibles en este curso. Usa el botón <strong>"+ Asignar Co-Docencia"</strong> para agregar un docente de apoyo en sala.
                            </td>
                          </tr>
                        ) : (
                          asignacionesCoDocenciaCurso.map(a => {
                            const doc = docentes.find(d => d.id === a.docenteId);
                            const disp = doc ? disponibilidadDocentes.get(doc.id) : null;

                            return (
                              <tr key={a.id} className="hover:bg-indigo-50/30">
                                <td className="px-4 py-2.5 font-bold text-slate-800 flex items-center gap-2">
                                  <Users className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                                  <span>{a.asignatura}</span>
                                </td>
                                <td className="px-4 py-2.5">
                                  {doc ? (
                                    <div>
                                      <div className="font-bold text-slate-800">{doc.nombres} {doc.apellidos}</div>
                                      <div className="text-[10px] text-slate-500">
                                        RUN: {doc.run} • {doc.estamento} • Contrato: {doc.horasContrato}h (Asig: {disp?.horasAsignadas || 0}h)
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-amber-600 italic">Docente no especificado</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  {a.esAgrupacionFlexible || a.tipoApoyo === 'AGRUPACION_FLEXIBLE' ? (
                                    <span className="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">
                                      Agrupación Flexible
                                    </span>
                                  ) : a.tipoApoyo === 'REFUERZO_AULA' ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                      Refuerzo en Sala
                                    </span>
                                  ) : a.tipoApoyo === 'APOYO_DOCENTE' ? (
                                    <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                                      Apoyo Docente
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-bold text-[10px]">
                                      Co-Docencia (2° Docente)
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-center font-bold text-indigo-900 text-sm">
                                  {a.horasPedagogicasAula} HA
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {a.esTallerSep ? (
                                    <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                                      SEP (Exento)
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-semibold">
                                      Subv. General
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => abrirModalEditarCoDocencia(a)}
                                      className="p-1 text-slate-400 hover:text-indigo-600 rounded transition-colors"
                                      title="Editar co-docencia"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`¿Eliminar el apoyo de co-docencia en ${a.asignatura}?`)) {
                                          if (onEliminarAsignacion) await onEliminarAsignacion(a.id);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                      title="Eliminar co-docencia"
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
              )}

              {/* ========================================================= */}
              {/* SUBPESTAÑA 3: APOYO PIE (DECRETO 170 / CO-DOCENCIA & PAE) */}
              {/* ========================================================= */}
              {tabCurso === 'pie' && (
                <div className="space-y-4 pt-2">
                  {/* Banner Normativo Decreto 170 / Ord. 2398 */}
                  <div className="bg-gradient-to-r from-purple-950 via-slate-900 to-indigo-950 text-white p-5 rounded-xl border border-purple-900 shadow-sm space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-purple-600/30 border border-purple-500/40 text-purple-300 text-[11px] font-bold">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          Decreto 170/2009 & Ordinario N° 2398 MINEDUC
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">
                          Demanda y Co-Docencia PIE: {cursoActivo.nivel} {cursoActivo.letra}
                        </h4>
                        <p className="text-xs text-purple-200/80 mt-0.5 max-w-xl">
                          Calculado según los {demandaPieCurso.neetCount} estudiantes NEET y {demandaPieCurso.neepCount} NEEP en régimen {cursoActivo.regimen}.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setEditNeet(cursoActivo.alumnosNeet !== undefined ? cursoActivo.alumnosNeet : 5);
                            setEditNeep(cursoActivo.alumnosNeep !== undefined ? cursoActivo.alumnosNeep : 2);
                            setModalNeeOpen(true);
                          }}
                          className="px-3 py-1.5 bg-purple-800/60 hover:bg-purple-700 text-purple-100 text-xs font-bold rounded-lg border border-purple-600 transition-colors"
                        >
                          Ajustar Cupos PIE
                        </button>

                        <button
                          type="button"
                          onClick={handleAutoAsignarPieCurso}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all"
                          title="Auto-asignar horas PIE con docentes y asistentes disponibles en el establecimiento"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>⚡ Auto-Asignar PIE (Jidoka)</span>
                        </button>
                      </div>
                    </div>

                    {/* Tarjetas de Demanda Normativa Calculada */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2">
                      <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                        <div className="text-[10px] uppercase font-bold text-purple-200">Educador(a) Diferencial</div>
                        <div className="text-lg font-black text-white">
                          {demandaPieCurso.horasDiferencialHHMM} <span className="text-xs font-normal text-purple-300">({demandaPieCurso.horasDiferencialDecimal}h)</span>
                        </div>
                        <div className={`text-[10px] font-bold ${desglosePieAsignado.dif >= demandaPieCurso.horasDiferencialDecimal ? 'text-emerald-400' : 'text-amber-300'}`}>
                          Asignadas: {desglosePieAsignado.dif.toFixed(1)}h
                        </div>
                      </div>

                      <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                        <div className="text-[10px] uppercase font-bold text-purple-200">Profesional Asistente PAE</div>
                        <div className="text-lg font-black text-white">
                          {demandaPieCurso.horasPaeHHMM} <span className="text-xs font-normal text-purple-300">({demandaPieCurso.horasPaeDecimal}h)</span>
                        </div>
                        <div className={`text-[10px] font-bold ${desglosePieAsignado.pae >= demandaPieCurso.horasPaeDecimal ? 'text-emerald-400' : 'text-amber-300'}`}>
                          Asignadas: {desglosePieAsignado.pae.toFixed(1)}h
                        </div>
                      </div>

                      <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                        <div className="text-[10px] uppercase font-bold text-purple-200">Trabajo Colaborativo</div>
                        <div className="text-lg font-black text-white">
                          03:00 <span className="text-xs font-normal text-purple-300">(3.0h Art.86)</span>
                        </div>
                        <div className={`text-[10px] font-bold ${desglosePieAsignado.colab >= 3.0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                          Asignadas: {desglosePieAsignado.colab.toFixed(1)}h
                        </div>
                      </div>

                      <div className="bg-white/10 p-3 rounded-lg border border-white/10">
                        <div className="text-[10px] uppercase font-bold text-purple-200">Total Demanda Dec. 170</div>
                        <div className="text-lg font-black text-amber-300">
                          {demandaPieCurso.horasTotalCronologicas.toFixed(1)} hrs
                        </div>
                        <div className={`text-[10px] font-bold ${demandaPieCurso.cumpleAforo ? 'text-emerald-400' : 'text-red-400'}`}>
                          {demandaPieCurso.cumpleAforo ? '✓ Aforo Cumplido' : '⚠️ Aforo Excedido'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Acciones y Botón Asignar PIE */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">
                        Profesionales y Asistentes Asignados al Apoyo PIE ({asignacionesPieCurso.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Incluye Educadoras Diferenciales, Asistentes de la Educación Profesionales (PAE) y Técnicos.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={abrirModalNuevoPie}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Asignar Profesional PIE</span>
                    </button>
                  </div>

                  {/* Tabla de Asignaciones PIE */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-purple-50/60 text-purple-950 uppercase font-semibold text-[10px] border-b border-purple-100">
                        <tr>
                          <th className="px-4 py-2.5">Profesional / Asistente</th>
                          <th className="px-4 py-2.5">Estamento / Rol</th>
                          <th className="px-4 py-2.5">Tipo de Apoyo Decreto 170</th>
                          <th className="px-4 py-2.5 text-center">Horas Cronológicas</th>
                          <th className="px-4 py-2.5 text-right">Acciones</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {asignacionesPieCurso.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-400 italic">
                              No se han asignado profesionales PIE a este curso. Usa el botón <strong>"+ Asignar Profesional PIE"</strong> o <strong>"⚡ Auto-Asignar PIE"</strong>.
                            </td>
                          </tr>
                        ) : (
                          asignacionesPieCurso.map(a => {
                            const doc = docentes.find(d => d.id === a.docenteId);
                            const disp = doc ? disponibilidadDocentes.get(doc.id) : null;

                            // Badge de rol
                            let estamentoBadge = (
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {doc?.estamento || 'Personal'}
                              </span>
                            );

                            if (doc?.estamento === 'DOCENTE_DIFERENCIAL') {
                              estamentoBadge = (
                                <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold inline-flex items-center gap-1">
                                  <GraduationCap className="w-3 h-3" />
                                  Docente Diferencial
                                </span>
                              );
                            } else if (doc?.estamento === 'PROFESIONAL_PAE') {
                              estamentoBadge = (
                                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold inline-flex items-center gap-1">
                                  <Stethoscope className="w-3 h-3" />
                                  Asistente Profesional PAE
                                </span>
                              );
                            } else if (doc?.estamento === 'TECNICO_ESPECIAL' || doc?.estamento === 'ASISTENTE_AULA') {
                              estamentoBadge = (
                                <span className="px-2 py-0.5 rounded bg-cyan-100 text-cyan-800 text-[10px] font-bold inline-flex items-center gap-1">
                                  <HeartHandshake className="w-3 h-3" />
                                  Asistente Técnico
                                </span>
                              );
                            } else if (doc?.estamento === 'DOCENTE_AULA') {
                              estamentoBadge = (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold inline-flex items-center gap-1">
                                  <BookOpen className="w-3 h-3" />
                                  Docente Regular (Colaborativo)
                                </span>
                              );
                            }

                            return (
                              <tr key={a.id} className="hover:bg-slate-50/70">
                                <td className="px-4 py-2.5">
                                  {doc ? (
                                    <div>
                                      <div className="font-bold text-slate-800">{doc.nombres} {doc.apellidos}</div>
                                      <div className="text-[10px] text-slate-500">
                                        RUN: {doc.run} {doc.titulo ? `• ${doc.titulo}` : ''} • Contrato: {doc.horasContrato}h (Asig: {disp?.horasAsignadas || 0}h)
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-red-500 italic">Funcionario no encontrado (ID: {a.docenteId})</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5">
                                  {estamentoBadge}
                                </td>
                                <td className="px-4 py-2.5 font-medium text-slate-700">
                                  <div className="flex items-center gap-1.5">
                                    <ShieldCheck className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                                    <span>{a.tipoApoyo || a.asignatura}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2.5 text-center font-bold text-purple-900">
                                  {a.horasCronologicasPie || a.horasPedagogicasAula} hrs/sem
                                </td>
                                <td className="px-4 py-2.5 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <button
                                      type="button"
                                      onClick={() => abrirModalEditarPie(a)}
                                      className="p-1 text-slate-400 hover:text-purple-600 rounded transition-colors"
                                      title="Editar asignación PIE"
                                    >
                                      <Edit2 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        if (confirm(`¿Eliminar la asignación de apoyo PIE para este curso?`)) {
                                          if (onEliminarAsignacion) await onEliminarAsignacion(a.id);
                                        }
                                      }}
                                      className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                                      title="Eliminar asignación"
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
              )}

              {/* SUBPESTAÑA 3: MALLA Y PLAN OFICIAL MINEDUC */}
              {tabCurso === 'malla' && (
                <MallaPlanPanel planActivo={planActivo} />
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Selecciona un curso para inspeccionar su docencia, apoyo PIE y requerimientos curriculares oficiales.
            </div>
          )}
        </div>
      </div>

      {/* MODAL 1: AGREGAR CURSO (REGULAR, MULTIGRADO, COMBINADO, EPJA) */}
      <CursoModalForm
        isOpen={modalCursoOpen}
        onClose={() => setModalCursoOpen(false)}
        rbd={colegio.rbd}
        periodoActivo={periodoActivo}
        cursosExistentes={cursos}
        onGuardarCurso={onGuardarCurso}
        onCombinarCursos={handleConfirmarCombinarCursos}
        onCursoCreado={(nuevoId) => setCursoSeleccionadoPlan(nuevoId)}
      />

      {/* MODALES AISLADOS DE ASIGNACIÓN (0 LAG AL TIPEAR) */}
      {onGuardarAsignacion && (
        <>
          <ModalAsignarDocencia
            isOpen={modalDocencia.isOpen}
            onClose={() => setModalDocencia({ isOpen: false, editandoAsig: null })}
            onGuardar={onGuardarAsignacion}
            cursoActivo={cursoActivo}
            esModoTransversal={esModoTransversal}
            colegio={colegio}
            periodoActivo={periodoActivo}
            editandoAsig={modalDocencia.editandoAsig}
            asignaturaSugerida={modalDocencia.asignaturaSugerida}
            horasSugeridas={modalDocencia.horasSugeridas}
            docentes={docentes}
            disponibilidadDocentes={disponibilidadDocentes}
            planActivo={planActivo}
          />

          <ModalAsignarCoDocencia
            isOpen={modalCoDocencia.isOpen}
            onClose={() => setModalCoDocencia({ isOpen: false, editandoAsig: null })}
            onGuardar={onGuardarAsignacion}
            cursoActivo={cursoActivo}
            colegio={colegio}
            periodoActivo={periodoActivo}
            editandoAsig={modalCoDocencia.editandoAsig}
            asignaturaSugerida={modalCoDocencia.asignaturaSugerida}
            horasSugeridas={modalCoDocencia.horasSugeridas}
            docentes={docentes}
            disponibilidadDocentes={disponibilidadDocentes}
            planActivo={planActivo}
            horasPlanCurso={horasPlanCurso}
          />

          <ModalAsignarPie
            isOpen={modalPie.isOpen}
            onClose={() => setModalPie({ isOpen: false, editandoAsig: null })}
            onGuardar={onGuardarAsignacion}
            cursoActivo={cursoActivo}
            colegio={colegio}
            periodoActivo={periodoActivo}
            editandoAsig={modalPie.editandoAsig}
            docentes={docentes}
            disponibilidadDocentes={disponibilidadDocentes}
            demandaPieCurso={demandaPieCurso}
          />
        </>
      )}

      {/* MODAL 4: AJUSTAR ALUMNOS NEET / NEEP DEL CURSO */}
      {cursoActivo && (
        <CursoNeeModal
          isOpen={modalNeeOpen}
          onClose={() => setModalNeeOpen(false)}
          cursoNivel={cursoActivo.nivel}
          cursoLetra={cursoActivo.letra}
          editNeet={editNeet}
          setEditNeet={setEditNeet}
          editNeep={editNeep}
          setEditNeep={setEditNeep}
          onGuardar={() => {
            onGuardarCurso({
              ...cursoActivo,
              alumnosNeet: Number(editNeet),
              alumnosNeep: Number(editNeep)
            });
            setModalNeeOpen(false);
          }}
        />
      )}

      {/* MODAL 5: COMBINAR CURSOS EXISTENTES */}
      <ModalCombinarCursos
        isOpen={modalCombinarOpen}
        onClose={() => {
          setModalCombinarOpen(false);
          setCursoInicialCombinar(undefined);
        }}
        cursos={cursos}
        cursoInicialId={cursoInicialCombinar}
        onConfirmarCombinacion={handleConfirmarCombinarCursos}
      />

      {/* MODAL 6: DESCOMBINAR CURSO COMBINADO */}
      <ModalDescombinarCurso
        isOpen={modalDescombinarState.isOpen}
        onClose={() => setModalDescombinarState({ isOpen: false, curso: null })}
        curso={modalDescombinarState.curso}
        onConfirmarDescombinacion={handleConfirmarDescombinarCurso}
      />
    </div>
  );
};
