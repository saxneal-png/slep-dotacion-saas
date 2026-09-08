import React, { useState, useMemo } from 'react';
import {
  Building2, LayoutGrid, Users, BookOpen, Clock, CheckCircle2,
  AlertTriangle, ArrowRight, ArrowLeft, Plus, Trash2, Edit,
  Printer, FileSpreadsheet, Sparkles, School, Award, Layers,
  Check, ChevronRight, UserCheck, ShieldCheck, Briefcase
} from 'lucide-react';
import {
  Establecimiento,
  SalaInfraestructura,
  CursoSae,
  Docente,
  AsignacionHoraria,
  TallerJec
} from '../types';
import {
  evaluarCapacidadSaeYInfraestructura,
  calcularDemandaNormativaPieCurso,
  calcularJornadaMinutos,
  calcularAuditoriaDocenteMultitramo,
  validarSobreasignacionDocente,
  obtenerPlanPorCurso,
  PLANES_MINEDUC
} from '@slep/mineduc-engine';
import { DiagnosticoColegioCompleto } from '../services/dotacionCalculationService';

interface ColegioWorkflowViewProps {
  colegio: Establecimiento;
  salas: SalaInfraestructura[];
  cursos: CursoSae[];
  docentes: Docente[];
  asignaciones: AsignacionHoraria[];
  diagnostico: DiagnosticoColegioCompleto | null;
  onGuardarSala: (s: SalaInfraestructura) => Promise<void> | void;
  onEliminarSala: (id: string) => Promise<void> | void;
  onGuardarCurso: (c: CursoSae) => Promise<void> | void;
  onEliminarCurso: (id: string) => Promise<void> | void;
  onGuardarDocente: (d: Docente) => Promise<void> | void;
  onEliminarDocente: (id: string) => Promise<void> | void;
  onGuardarAsignacion: (a: AsignacionHoraria) => Promise<void> | void;
  onEliminarAsignacion: (id: string) => Promise<void> | void;
  onAbrirModuloSige: () => void;
  onExportarExcel: () => void;
}

const NIVELES_EDUCACIONALES = [
  'Prekínder (NT1)', 'Kínder (NT2)',
  '1° Básico', '2° Básico', '3° Básico', '4° Básico',
  '5° Básico', '6° Básico', '7° Básico', '8° Básico',
  '1° Medio', '2° Medio',
  '3° Medio HC', '4° Medio HC',
  '3° Medio TP', '4° Medio TP'
];

const TALLERES_SUGERIDOS = [
  'Taller de Robótica y Ciencias',
  'Taller de Deporte y Vida Sana',
  'Taller de Música y Artes Escénicas',
  'Taller de Refuerzo Lector y Matemático',
  'Taller de Medio Ambiente y Sustentabilidad',
  'Taller de Idioma Inglés Comunicativo',
  'Taller de Debate y Pensamiento Crítico'
];

export const ColegioWorkflowView: React.FC<ColegioWorkflowViewProps> = ({
  colegio,
  salas,
  cursos,
  docentes,
  asignaciones,
  diagnostico,
  onGuardarSala,
  onEliminarSala,
  onGuardarCurso,
  onEliminarCurso,
  onGuardarDocente,
  onEliminarDocente,
  onGuardarAsignacion,
  onEliminarAsignacion,
  onAbrirModuloSige,
  onExportarExcel
}) => {
  const [pasoActivo, setPasoActivo] = useState<number>(1);

  // ---------------------------------------------------------------------------
  // Estado Paso 1: Salas
  // ---------------------------------------------------------------------------
  const [modalSala, setModalSala] = useState(false);
  const [editingSala, setEditingSala] = useState<SalaInfraestructura | null>(null);
  const [salaNombre, setSalaNombre] = useState('');
  const [salaM2, setSalaM2] = useState(45);
  const [salaTipo, setSalaTipo] = useState<'REGULAR' | 'PARVULARIA' | 'TALLER'>('REGULAR');
  const [salaAforoManual, setSalaAforoManual] = useState<number | ''>('');

  // ---------------------------------------------------------------------------
  // Estado Paso 2: Matrícula y Proyección
  // ---------------------------------------------------------------------------
  const [matriculasPorNivel, setMatriculasPorNivel] = useState<{ [nivel: string]: number }>({});
  const [modalCurso, setModalCurso] = useState(false);
  const [cursoNivel, setCursoNivel] = useState(NIVELES_EDUCACIONALES[2]); // 1° Básico
  const [cursoLetra, setCursoLetra] = useState('A');
  const [cursoRegimen, setCursoRegimen] = useState<'JEC' | 'No JEC'>(colegio.regimen === 'No JEC' ? 'No JEC' : 'JEC');
  const [cursoSalaId, setCursoSalaId] = useState('');
  const [cursoCupo, setCursoCupo] = useState(38);
  const [cursoMatricula, setCursoMatricula] = useState(35);

  // ---------------------------------------------------------------------------
  // Estado Paso 3: Docentes
  // ---------------------------------------------------------------------------
  const [modalDocente, setModalDocente] = useState(false);
  const [docEditing, setDocEditing] = useState<Docente | null>(null);
  const [docRun, setDocRun] = useState('');
  const [docNombres, setDocNombres] = useState('');
  const [docApellidos, setDocApellidos] = useState('');
  const [docCalidad, setDocCalidad] = useState<'TITULAR' | 'CONTRATA'>('TITULAR');
  const [docEstamento, setDocEstamento] = useState<any>('DOCENTE_AULA');
  const [docContrato, setDocContrato] = useState(44);
  const [docAsignatura, setDocAsignatura] = useState('');
  const [docArt69, setDocArt69] = useState(false);

  // ---------------------------------------------------------------------------
  // Estado Paso 4: Talleres JEC y Co-docencia
  // ---------------------------------------------------------------------------
  const [cursoSeleccionadoPaso4, setCursoSeleccionadoPaso4] = useState<string>(cursos[0]?.id || '');
  const [nuevoTallerNombre, setNuevoTallerNombre] = useState('');
  const [nuevoTallerHoras, setNuevoTallerHoras] = useState(2);

  // ---------------------------------------------------------------------------
  // Estado Paso 5: Asignación Docente y Modo de Vista
  // ---------------------------------------------------------------------------
  const [cursoSeleccionadoPaso5, setCursoSeleccionadoPaso5] = useState<string>(cursos[0]?.id || '');
  const [modoAsignacion, setModoAsignacion] = useState<'POR_CURSO' | 'POR_DOCENTE'>('POR_CURSO');

  // Cálculos de Proporción Oficial
  const regimenProporcion = colegio.porcentajePrioritarios >= 80 ? '60/40' : '65/35';
  const regimenTabla = colegio.porcentajePrioritarios >= 80 ? '60_40' : '65_35';

  // Capacidad de docentes en tiempo real para badges
  const capacidadDocentesMap = useMemo(() => {
    const map = new Map<string, { pedAsignadas: number; maxHA: number; vacantes: number; sobreasignado: boolean }>();
    for (const doc of docentes) {
      const titAsigs = asignaciones.filter(a => a.docenteId === doc.id);
      const coAsigs = asignaciones.filter(a => a.coDocenteId === doc.id && a.tieneCoDocente);
      const docAsigs = [...titAsigs, ...coAsigs];
      const pedAsignadas = docAsigs.reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const asigsRegulares = docAsigs.filter(a => !a.esCoDocencia && !a.esTallerSep && !a.esTrabajoColaborativo && a.tipoApoyo !== 'TRABAJO_COLABORATIVO');
      const ped60 = asigsRegulares
        .filter(a => {
          const c = cursos.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const ped65 = asigsRegulares
        .filter(a => {
          const c = cursos.find(x => x.id === a.cursoId);
          return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
        })
        .reduce((s, a) => s + a.horasPedagogicasAula, 0);

      const hDir = doc.horasDirectivas || 0;
      const hInsp = doc.horasInspectorGeneral || 0;
      const hTec = doc.horasTecnicoPedagogicas || 0;
      const hCoord = doc.horasCoordinacion || 0;
      const hNoAula = hDir + hInsp + hTec + hCoord;
      const hDocencia = Math.max(0, doc.horasContrato - hNoAula);

      if (hDocencia > 0) {
        const audit = calcularAuditoriaDocenteMultitramo({
          horasAula65_35: ped65,
          horasAula60_40: ped60,
          horasNoAulaInstitucionales: hNoAula,
          horasContratoReal: doc.horasContrato,
          aplicaArticulo69: Boolean(doc.aplicaArticulo69)
        });

        const maxHA = Math.floor(audit.minutosLimitePermitido / 45);
        const vacantes = Math.max(0, maxHA - pedAsignadas);
        const sobreasignado = audit.esInfractorExcesoLectivo || (doc.horasContrato > 0 && audit.saldoHoras < 0);

        map.set(doc.id, {
          pedAsignadas,
          maxHA,
          vacantes,
          sobreasignado
        });
      } else {
        map.set(doc.id, {
          pedAsignadas,
          maxHA: 0,
          vacantes: 0,
          sobreasignado: pedAsignadas > 0
        });
      }
    }
    return map;
  }, [docentes, asignaciones, cursos, colegio]);

  // Pasos de navegación
  const pasos = [
    { id: 1, titulo: '1. Salas & Capacidad', desc: 'Infraestructura y Aforo', icon: LayoutGrid, count: `${salas.length} salas` },
    { id: 2, titulo: '2. Matrícula & Cursos', desc: 'Proyección por Nivel', count: `${cursos.length} cursos` },
    { id: 3, titulo: '3. Nómina Docente', desc: 'Contratos y SIGE', count: `${docentes.length} docentes` },
    { id: 4, titulo: '4. Cursos, JEC & Co-docencia', desc: 'Planes y Talleres', count: `${cursos.reduce((s, c) => s + (c.talleresJec?.length || 0), 0)} talleres` },
    { id: 5, titulo: '5. Asignación Docente', desc: 'Matriz por Asignatura', count: `${asignaciones.length} asignadas` },
    { id: 6, titulo: '6. Horas No Aula', desc: 'Directivas, UTP, CRA', count: `${diagnostico?.balanzaGeneral.horasDirectivasTotales || 0}h dir` },
    { id: 7, titulo: '7. Consolidado Oficial', desc: 'Calculadora MINEDUC', count: `${diagnostico?.balanzaGeneral.superavitDeficitLectivo || 0}h bal` }
  ];

  // ---------------------------------------------------------------------------
  // HANDLERS PASO 1: SALAS
  // ---------------------------------------------------------------------------
  const factorPorTipo = (tipo: 'REGULAR' | 'PARVULARIA' | 'TALLER') =>
    tipo === 'PARVULARIA' ? 1.5 : tipo === 'TALLER' ? 1.8 : 1.1;

  const aforoCalculadoPaso1 = useMemo(() => {
    const factor = factorPorTipo(salaTipo);
    return Math.floor(salaM2 / factor);
  }, [salaM2, salaTipo]);

  const abrirModalNuevaSala = () => {
    setEditingSala(null);
    setSalaNombre(`Sala ${salas.length + 1}`);
    setSalaM2(45);
    setSalaTipo('REGULAR');
    setSalaAforoManual('');
    setModalSala(true);
  };

  const abrirModalEditarSala = (s: SalaInfraestructura) => {
    setEditingSala(s);
    setSalaNombre(s.nombreSala);
    setSalaM2(s.superficieM2);
    setSalaTipo(s.tipo);
    const factor = s.tipo === 'PARVULARIA' ? 1.5 : s.tipo === 'TALLER' ? 1.8 : 1.1;
    const aforoNorm = Math.floor(s.superficieM2 / factor);
    setSalaAforoManual(s.aforoMaximo !== aforoNorm ? s.aforoMaximo : '');
    setModalSala(true);
  };

  const handleGuardarSalaPaso1 = async (e: React.FormEvent) => {
    e.preventDefault();
    const aforoFinal = typeof salaAforoManual === 'number' && salaAforoManual > 0
      ? salaAforoManual
      : aforoCalculadoPaso1;

    // Nombre sugerido automático si se deja en blanco
    const nombreFinal = salaNombre.trim() || (editingSala ? editingSala.nombreSala : `Sala ${salas.length + 1}`);

    const s: SalaInfraestructura = {
      id: editingSala ? editingSala.id : `sala-${Date.now()}`,
      rbd: colegio.rbd,
      nombreSala: nombreFinal,
      superficieM2: Number(salaM2) || 45,
      tipo: salaTipo,
      aforoMaximo: aforoFinal > 0 ? aforoFinal : 40
    };
    await onGuardarSala(s);
    setEditingSala(null);
    setSalaNombre('');
    setSalaM2(45);
    setSalaAforoManual('');
    setModalSala(false);
  };

  // ---------------------------------------------------------------------------
  // HANDLERS PASO 2: MATRÍCULA Y ASISTENTE AUTOMÁTICO DE CURSOS
  // ---------------------------------------------------------------------------
  const handleAutoGenerarCursosPaso2 = async () => {
    if (!salas.length) {
      alert('Primero registra al menos una sala en el Paso 1 para poder asociar los cursos.');
      return;
    }

    const salasDisponibles = [...salas].sort((a, b) => b.aforoMaximo - a.aforoMaximo);
    let salaIdx = 0;
    let creadosCount = 0;

    for (const [nivel, matricula] of Object.entries(matriculasPorNivel)) {
      if (!matricula || matricula <= 0) continue;

      const aforoReferencia = salasDisponibles[0]?.aforoMaximo || 38;
      const cupoPorCurso = Math.min(45, Math.max(25, aforoReferencia));
      const seccionesNecesarias = Math.ceil(matricula / cupoPorCurso);

      const letras = ['A', 'B', 'C', 'D', 'E'];
      for (let i = 0; i < seccionesNecesarias; i++) {
        const letra = letras[i] || `${i + 1}`;
        const yaExiste = cursos.find(c => c.nivel === nivel && c.letra === letra);
        if (yaExiste) continue;

        const salaAsignada = salasDisponibles[salaIdx % salasDisponibles.length];
        salaIdx++;

        const matriculaSeccion = Math.round(matricula / seccionesNecesarias);

        const nuevoCurso: CursoSae = {
          id: `curso-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          rbd: colegio.rbd,
          nivel,
          letra,
          regimen: colegio.regimen === 'No JEC' ? 'No JEC' : 'JEC',
          salaId: salaAsignada ? salaAsignada.id : undefined,
          cupoSae: salaAsignada ? Math.min(salaAsignada.aforoMaximo, 45) : cupoPorCurso,
          matriculaProyectada: matriculaSeccion,
          alumnosNeet: 5,
          alumnosNeep: 2,
          talleresJec: []
        };
        await onGuardarCurso(nuevoCurso);
        creadosCount++;
      }
    }

    alert(`¡Asistente Completado! Se determinaron y generaron ${creadosCount} cursos automáticamente.`);
  };

  const handleCrearCursoManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const nuevo: CursoSae = {
      id: `curso-${Date.now()}`,
      rbd: colegio.rbd,
      nivel: cursoNivel,
      letra: cursoLetra.trim().toUpperCase(),
      regimen: cursoRegimen,
      salaId: cursoSalaId || undefined,
      cupoSae: Number(cursoCupo),
      matriculaProyectada: Number(cursoMatricula),
      alumnosNeet: 5,
      alumnosNeep: 2,
      talleresJec: []
    };
    await onGuardarCurso(nuevo);
    setModalCurso(false);
  };

  // ---------------------------------------------------------------------------
  // HANDLERS PASO 4: TALLERES JEC Y CO-DOCENCIA
  // ---------------------------------------------------------------------------
  const cursoActivoPaso4 = cursos.find(c => c.id === cursoSeleccionadoPaso4) || cursos[0];
  const planMineducPaso4 = cursoActivoPaso4 ? obtenerPlanPorCurso(cursoActivoPaso4.nivel, cursoActivoPaso4.regimen) : null;

  const handleAgregarTallerJec = async (nombreTaller: string, horasTaller: number) => {
    if (!cursoActivoPaso4) return;
    const talleresActuales = cursoActivoPaso4.talleresJec || [];
    const nuevoTaller: TallerJec = {
      id: `taller-${Date.now()}`,
      nombre: nombreTaller.trim(),
      horas: Number(horasTaller)
    };
    const actualizado: CursoSae = {
      ...cursoActivoPaso4,
      talleresJec: [...talleresActuales, nuevoTaller]
    };
    await onGuardarCurso(actualizado);
    setNuevoTallerNombre('');
  };

  const handleEliminarTallerJec = async (tallerId: string) => {
    if (!cursoActivoPaso4) return;
    const talleresActuales = (cursoActivoPaso4.talleresJec || []).filter(t => t.id !== tallerId);
    const actualizado: CursoSae = {
      ...cursoActivoPaso4,
      talleresJec: talleresActuales
    };
    await onGuardarCurso(actualizado);
  };

  const handleToggleCoDocencia = async (asignaturaNombre: string, horasAula: number) => {
    if (!cursoActivoPaso4) return;
    const asigExistente = asignaciones.find(a => a.cursoId === cursoActivoPaso4.id && a.asignatura === asignaturaNombre);

    if (asigExistente) {
      const actualizado: AsignacionHoraria = {
        ...asigExistente,
        tieneCoDocente: !asigExistente.tieneCoDocente,
        coDocenteId: !asigExistente.tieneCoDocente ? asigExistente.coDocenteId : undefined
      };
      await onGuardarAsignacion(actualizado);
    } else {
      const nueva: AsignacionHoraria = {
        id: `asig-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        rbd: colegio.rbd,
        cursoId: cursoActivoPaso4.id,
        docenteId: '',
        asignatura: asignaturaNombre,
        horasPedagogicasAula: horasAula,
        tieneCoDocente: true
      };
      await onGuardarAsignacion(nueva);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS PASO 5: ASIGNACIÓN DOCENTE A ASIGNATURAS
  // ---------------------------------------------------------------------------
  const cursoActivoPaso5 = cursos.find(c => c.id === cursoSeleccionadoPaso5) || cursos[0];
  const planPaso5 = cursoActivoPaso5 ? obtenerPlanPorCurso(cursoActivoPaso5.nivel, cursoActivoPaso5.regimen) : null;

  const listaAsignaturasYtalleresCurso5 = useMemo(() => {
    if (!cursoActivoPaso5) return [];
    const items: { nombre: string; horas: number; esTaller: boolean }[] = [];
    if (planPaso5) {
      for (const a of planPaso5.asignaturasBase) {
        items.push({ nombre: a.nombre, horas: a.horasSugeridas, esTaller: false });
      }
    }
    if (cursoActivoPaso5.talleresJec) {
      for (const t of cursoActivoPaso5.talleresJec) {
        items.push({ nombre: t.nombre, horas: t.horas, esTaller: true });
      }
    }
    return items;
  }, [cursoActivoPaso5, planPaso5]);

  const handleAsignarDocenteTitular = async (asignaturaNombre: string, horas: number, docId: string, esTaller: boolean) => {
    if (!cursoActivoPaso5) return;
    const existing = asignaciones.find(a => a.cursoId === cursoActivoPaso5.id && a.asignatura === asignaturaNombre);
    const item: AsignacionHoraria = {
      id: existing ? existing.id : `asig-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      rbd: colegio.rbd,
      cursoId: cursoActivoPaso5.id,
      docenteId: docId,
      coDocenteId: existing?.coDocenteId,
      tieneCoDocente: existing?.tieneCoDocente,
      esTallerJec: esTaller,
      asignatura: asignaturaNombre,
      horasPedagogicasAula: horas
    };
    await onGuardarAsignacion(item);
  };

  const handleAsignarCoDocente = async (asignaturaNombre: string, horas: number, coDocId: string, esTaller: boolean) => {
    if (!cursoActivoPaso5) return;
    const existing = asignaciones.find(a => a.cursoId === cursoActivoPaso5.id && a.asignatura === asignaturaNombre);
    if (!existing) {
      const item: AsignacionHoraria = {
        id: `asig-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        rbd: colegio.rbd,
        cursoId: cursoActivoPaso5.id,
        docenteId: '',
        coDocenteId: coDocId,
        tieneCoDocente: true,
        esTallerJec: esTaller,
        asignatura: asignaturaNombre,
        horasPedagogicasAula: horas
      };
      await onGuardarAsignacion(item);
    } else {
      const item: AsignacionHoraria = {
        ...existing,
        coDocenteId: coDocId,
        tieneCoDocente: true
      };
      await onGuardarAsignacion(item);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLERS PASO 6: HORAS NO AULA
  // ---------------------------------------------------------------------------
  const handleGuardarHorasNoAula = async (doc: Docente, dir: number, insp: number, tec: number, coord: number, tipoC: string) => {
    const actualizado: Docente = {
      ...doc,
      horasDirectivas: Number(dir) || 0,
      horasInspectorGeneral: Number(insp) || 0,
      horasTecnicoPedagogicas: Number(tec) || 0,
      horasCoordinacion: Number(coord) || 0,
      tipoCoordinacion: tipoC.trim() || undefined
    };
    await onGuardarDocente(actualizado);
  };

  return (
    <div className="space-y-6">
      {/* --------------------------------------------------------------------- */}
      {/* Header Institucional del Colegio */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-[#002B49] text-white p-6 rounded-2xl shadow-lg border border-slate-700 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-orange-400">
            <School className="w-4 h-4" />
            <span>SLEP Valle Diguillín • Consola de Dotación & Capacidad</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">{colegio.comuna}</span>
          </div>
          <h1 className="text-2xl font-black text-white mt-1">
            {colegio.nombre} <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-orange-400 border border-slate-700 ml-2">RBD {colegio.rbd}</span>
          </h1>
          <p className="text-xs text-slate-300 mt-1">
            Régimen: <strong>{colegio.regimen}</strong> • Alumnos Prioritarios SEP: <strong>{colegio.porcentajePrioritarios}%</strong> ({regimenProporcion})
            {colegio.director && <span> • Director(a): <strong>{colegio.director}</strong></span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onAbrirModuloSige}
            className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Importar SIGE</span>
          </button>

          <button
            onClick={onExportarExcel}
            className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Planilla Excel Oficial</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* Stepper de Navegación del Flujo (7 Pasos Guiados) */}
      {/* --------------------------------------------------------------------- */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex items-center justify-between min-w-[750px] gap-2">
          {pasos.map((p, idx) => {
            const isActivo = pasoActivo === p.id;
            const isCompletado = pasoActivo > p.id;

            return (
              <React.Fragment key={p.id}>
                <button
                  onClick={() => setPasoActivo(p.id)}
                  className={`flex-1 flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                    isActivo
                      ? 'bg-orange-50 border-2 border-orange-500 shadow-sm'
                      : isCompletado
                        ? 'bg-slate-50 hover:bg-slate-100 border border-slate-200'
                        : 'opacity-70 hover:opacity-100 hover:bg-slate-50'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${
                    isActivo
                      ? 'bg-orange-600 text-white shadow'
                      : isCompletado
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-200 text-slate-700'
                  }`}>
                    {isCompletado ? <Check className="w-4 h-4" /> : p.id}
                  </div>

                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-800 truncate">{p.titulo}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
                      <span>{p.desc}</span>
                      <span className="font-semibold text-orange-600">({p.count})</span>
                    </div>
                  </div>
                </button>

                {idx < pasos.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* PASO 1: SALAS & CAPACIDAD */}
      {/* --------------------------------------------------------------------- */}
      {pasoActivo === 1 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-orange-600 text-xs font-bold uppercase tracking-wider">
                Paso 1 • Infraestructura Escolar y Capacidad Física (Decreto 548)
              </span>
              <h2 className="text-xl font-bold text-slate-800 mt-0.5">
                Salas de Clases, Talleres y Aforos Máximos
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                Registra las dependencias escolares. El aforo se calcula automáticamente según la norma oficial (1.1 m² aula común, 1.5 m² párvulo, 1.8 m² taller), permitiendo sobrescribir manualmente el aforo autorizado si cuentas con resolución sanitaria.
              </p>
            </div>

            <button
              onClick={abrirModalNuevaSala}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Sala / Dependencia</span>
            </button>
          </div>

          {/* Grilla de Salas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {salas.map(s => {
              const cursosAsociados = cursos.filter(c => c.salaId === s.id);
              const factor = factorPorTipo(s.tipo);
              const aforoNormativo = Math.floor(s.superficieM2 / factor);
              const esManual = s.aforoMaximo !== aforoNormativo;

              return (
                <div key={s.id} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm space-y-3 hover:border-slate-300 transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 uppercase border border-slate-200">
                        {s.tipo}
                      </span>
                      <h3 className="font-bold text-slate-800 text-base mt-1">{s.nombreSala}</h3>
                      {s.pabellon && <span className="text-xs text-slate-400">Pabellón: {s.pabellon}</span>}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => abrirModalEditarSala(s)}
                        className="text-slate-400 hover:text-slate-700 p-1.5 rounded hover:bg-slate-100 transition-colors"
                        title="Editar nombre, superficie o aforo de la sala"
                      >
                        <Edit className="w-4 h-4 text-blue-600" />
                      </button>

                      <button
                        onClick={() => onEliminarSala(s.id)}
                        className="text-slate-400 hover:text-red-600 p-1.5 rounded hover:bg-red-50 transition-colors"
                        title="Eliminar sala"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t text-xs">
                    <div className="bg-slate-50 p-2 rounded-lg">
                      <span className="text-[10px] text-slate-400 font-bold block uppercase">Superficie</span>
                      <span className="font-bold text-slate-800 text-sm">{s.superficieM2} m²</span>
                    </div>

                    <div className="bg-orange-50/70 p-2 rounded-lg border border-orange-200/60">
                      <span className="text-[10px] text-orange-700 font-bold block uppercase">
                        Aforo Máximo {esManual && '(Manual)'}
                      </span>
                      <span className="font-black text-orange-600 text-sm">{s.aforoMaximo} alumnos</span>
                    </div>
                  </div>

                  <div className="text-xs text-slate-500 pt-1">
                    {cursosAsociados.length > 0 ? (
                      <span className="text-emerald-700 font-medium">
                        ✓ Ocupada por: {cursosAsociados.map(c => `${c.nivel} ${c.letra}`).join(', ')}
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">Sin cursos asignados actualmente</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Modal Nueva / Editar Sala */}
          {modalSala && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95">
                <h3 className="text-base font-bold text-slate-800 mb-1">
                  {editingSala ? 'Editar Dependencia o Sala' : 'Registrar Sala o Dependencia'}
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  {editingSala ? `Modificando los parámetros de ${editingSala.nombreSala}` : 'Ingresa el nombre y la superficie en metros cuadrados.'}
                </p>

                <form onSubmit={handleGuardarSalaPaso1} className="space-y-4 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Nombre / Identificador de la Sala
                    </label>
                    <input
                      type="text"
                      autoFocus
                      value={salaNombre}
                      onChange={e => setSalaNombre(e.target.value)}
                      placeholder={`Ej: Sala ${salas.length + 1}, Taller de Electricidad, Laboratorio`}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none text-slate-800 font-medium"
                    />
                    <span className="text-[11px] text-slate-400 mt-1 block">
                      Nombre sugerido automático. Si lo dejas vacío, se guardará como <strong>"{editingSala ? editingSala.nombreSala : `Sala ${salas.length + 1}`}"</strong>.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Tipo de Dependencia</label>
                      <select
                        value={salaTipo}
                        onChange={e => setSalaTipo(e.target.value as any)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      >
                        <option value="REGULAR">Aula Común (1.1 m²)</option>
                        <option value="PARVULARIA">Párvulos (1.5 m²)</option>
                        <option value="TALLER">Taller / Lab (1.8 m²)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Superficie Total (m²) *</label>
                      <input
                        type="number"
                        min="5"
                        max="300"
                        step="0.5"
                        required
                        value={salaM2}
                        onChange={e => setSalaM2(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-600 font-medium">Aforo Calculado Automático:</span>
                      <span className="font-bold text-slate-800 text-sm">{aforoCalculadoPaso1} alumnos</span>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Ajuste Manual de Aforo (opcional si difiere del cálculo):
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        placeholder={`Por defecto: ${aforoCalculadoPaso1}`}
                        value={salaAforoManual}
                        onChange={e => setSalaAforoManual(e.target.value ? parseInt(e.target.value) : '')}
                        className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSala(null);
                        setModalSala(false);
                      }}
                      className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow transition-colors"
                    >
                      {editingSala ? 'Actualizar Sala' : 'Guardar Sala'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 2: MATRÍCULA Y DETERMINACIÓN DE CURSOS */}
      {pasoActivo === 2 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-orange-600 text-xs font-bold uppercase tracking-wider">
                Paso 2 • Matrícula Proyectada y Determinación de Secciones
              </span>
              <h2 className="text-xl font-bold text-slate-800 mt-0.5">
                Proyección de Matrícula y Creación Asistida de Cursos
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                Ingresa la matrícula estimada por nivel educacional. El asistente determinará automáticamente cuántos cursos (A, B, C...) se requieren para cubrir la demanda respetando el aforo de las salas del Paso 1 y el tope legal de 45 estudiantes.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleAutoGenerarCursosPaso2}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
                title="Generar secciones automáticamente según la matrícula ingresada"
              >
                <Sparkles className="w-4 h-4" />
                <span>Auto-Determinar Cursos</span>
              </button>

              <button
                onClick={() => setModalCurso(true)}
                className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Curso Manual</span>
              </button>
            </div>
          </div>

          {/* Matriz de Ingreso de Matrícula por Nivel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-orange-600" />
              Ingreso de Matrícula Total Estimada por Nivel
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {NIVELES_EDUCACIONALES.map(niv => {
                const val = matriculasPorNivel[niv] || '';
                const cursosActualesNivel = cursos.filter(c => c.nivel === niv);
                const sumaMatriculaCursos = cursosActualesNivel.reduce((s, c) => s + c.matriculaProyectada, 0);

                return (
                  <div key={niv} className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                    <span className="font-bold text-slate-700 block truncate" title={niv}>{niv}</span>
                    <input
                      type="number"
                      min="0"
                      max="300"
                      value={val}
                      placeholder={sumaMatriculaCursos > 0 ? `${sumaMatriculaCursos}` : '0'}
                      onChange={e => {
                        const v = parseInt(e.target.value) || 0;
                        setMatriculasPorNivel(prev => ({ ...prev, [niv]: v }));
                      }}
                      className="w-full mt-2 px-2 py-1.5 border rounded-lg font-bold text-slate-800 text-sm focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      {cursosActualesNivel.length > 0 ? `${cursosActualesNivel.length} secc. creadas` : 'Sin cursos'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tabla de Cursos Determinados */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Nómina de Cursos del Establecimiento ({cursos.length})
              </h3>
              <span className="text-xs text-slate-500">
                Matrícula Proyectada Total: <strong>{cursos.reduce((s, c) => s + c.matriculaProyectada, 0)} estudiantes</strong>
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b">
                  <tr>
                    <th className="px-4 py-3">Nivel y Letra</th>
                    <th className="px-4 py-3 text-center">Jornada</th>
                    <th className="px-4 py-3">Sala Asignada</th>
                    <th className="px-4 py-3 text-center">Cupo SAE</th>
                    <th className="px-4 py-3 text-center">Matrícula</th>
                    <th className="px-4 py-3 text-center">Aforo PIE</th>
                    <th className="px-4 py-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {cursos.map(c => {
                    const sala = salas.find(s => s.id === c.salaId);
                    const sobrecupo = sala ? c.matriculaProyectada > sala.aforoMaximo : false;

                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {c.nivel} {c.letra}
                        </td>

                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            c.regimen === 'JEC' ? 'bg-orange-100 text-orange-800' : 'bg-blue-100 text-blue-800'
                          }`}>
                            {c.regimen}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          {sala ? (
                            <span className={`font-semibold ${sobrecupo ? 'text-red-600' : 'text-slate-700'}`}>
                              {sala.nombreSala} ({sala.superficieM2}m² - aforo {sala.aforoMaximo})
                              {sobrecupo && ' ⚠️ Sobrecupo'}
                            </span>
                          ) : (
                            <span className="text-amber-600 italic">Sin sala asignada</span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center font-bold">{c.cupoSae}</td>
                        <td className="px-4 py-3 text-center font-black text-slate-800">{c.matriculaProyectada}</td>
                        <td className="px-4 py-3 text-center text-slate-500">
                          {c.alumnosNeet} NEET / {c.alumnosNeep} NEEP
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => onEliminarCurso(c.id)}
                            className="text-slate-400 hover:text-red-600 p-1 rounded"
                            title="Eliminar curso"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Modal Crear Curso Manual */}
          {modalCurso && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
              <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
                <h3 className="text-base font-bold text-slate-800 mb-4">Crear Curso Manual</h3>
                <form onSubmit={handleCrearCursoManual} className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Nivel Educacional *</label>
                      <select
                        value={cursoNivel}
                        onChange={e => setCursoNivel(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      >
                        {NIVELES_EDUCACIONALES.map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Letra (Sección) *</label>
                      <input
                        type="text"
                        required
                        maxLength={2}
                        value={cursoLetra}
                        onChange={e => setCursoLetra(e.target.value.toUpperCase())}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold text-center"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Jornada *</label>
                      <select
                        value={cursoRegimen}
                        onChange={e => setCursoRegimen(e.target.value as any)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      >
                        <option value="JEC">JEC (Completa)</option>
                        <option value="No JEC">No JEC (Media)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Sala Asignada</label>
                      <select
                        value={cursoSalaId}
                        onChange={e => setCursoSalaId(e.target.value)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      >
                        <option value="">Seleccionar sala...</option>
                        {salas.map(s => (
                          <option key={s.id} value={s.id}>{s.nombreSala} (Aforo {s.aforoMaximo})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Cupo SAE Oficial *</label>
                      <input
                        type="number"
                        min="1"
                        max="45"
                        required
                        value={cursoCupo}
                        onChange={e => setCursoCupo(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">Matrícula Proyectada *</label>
                      <input
                        type="number"
                        min="1"
                        max="45"
                        required
                        value={cursoMatricula}
                        onChange={e => setCursoMatricula(parseInt(e.target.value) || 0)}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none font-bold"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-3 border-t">
                    <button
                      type="button"
                      onClick={() => setModalCurso(false)}
                      className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-lg shadow"
                    >
                      Crear Curso
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 4: PLANES DE ESTUDIO, TALLERES JEC Y CO-DOCENCIA */}
      {pasoActivo === 4 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-orange-600 text-xs font-bold uppercase tracking-wider">
              Paso 4 • Configuración Curricular, Talleres JEC y Co-Docencia
            </span>
            <h2 className="text-xl font-bold text-slate-800 mt-0.5">
              Planes de Estudio MINEDUC, Talleres de Libre Disposición y Aula Compartida
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Selecciona un curso para inspeccionar su malla horaria oficial MINEDUC. Agrega los talleres JEC correspondientes a las horas de libre disposición y marca si alguna asignatura contará con Co-Docencia (2 profesores en sala simultáneamente).
            </p>

            {/* Selector de Curso */}
            <div className="flex items-center gap-2 mt-4 overflow-x-auto pb-2">
              {cursos.map(c => (
                <button
                  key={c.id}
                  onClick={() => setCursoSeleccionadoPaso4(c.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    (cursoActivoPaso4?.id === c.id)
                      ? 'bg-orange-600 text-white shadow'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                  }`}
                >
                  {c.nivel} {c.letra} ({c.regimen})
                </button>
              ))}
            </div>
          </div>

          {cursoActivoPaso4 && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Columna Izquierda: Asignaturas del Plan y Switch Co-docencia */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex items-center justify-between border-b pb-3">
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">
                      Plan Curricular: {cursoActivoPaso4.nivel} {cursoActivoPaso4.letra}
                    </h3>
                    <span className="text-xs text-slate-500">
                      Régimen: <strong>{cursoActivoPaso4.regimen}</strong> • Horas Plan Base: <strong>{planMineducPaso4?.totalHorasPlan || (cursoActivoPaso4.regimen === 'JEC' ? 38 : 30)} HA</strong>
                    </span>
                  </div>

                  <span className="text-xs font-bold text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                    Total Horas Curso: {(planMineducPaso4?.totalHorasPlan || 38) + (cursoActivoPaso4.talleresJec?.reduce((s, t) => s + t.horas, 0) || 0)} HA
                  </span>
                </div>

                <div className="space-y-2">
                  <div className="text-xs font-semibold text-slate-700 mb-2">
                    Asignaturas Troncales (Activa el switch para Co-Docencia / 2 Profesores en Sala):
                  </div>

                  {planMineducPaso4?.asignaturasBase.map((asig, idx) => {
                    const asigGuardada = asignaciones.find(a => a.cursoId === cursoActivoPaso4.id && a.asignatura === asig.nombre);
                    const tieneCoDoc = Boolean(asigGuardada?.tieneCoDocente);

                    return (
                      <div
                        key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-colors ${
                          tieneCoDoc ? 'bg-purple-50/60 border-purple-200' : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-8 h-8 rounded-lg bg-white border flex items-center justify-center font-bold text-slate-700">
                            {asig.horasSugeridas}h
                          </span>
                          <div>
                            <div className="font-bold text-slate-800">{asig.nombre}</div>
                            <div className="text-[10px] text-slate-400">
                              {tieneCoDoc ? '👥 Requiere 2 Docentes (Titular + Co-docente)' : '1 Docente Titular'}
                            </div>
                          </div>
                        </div>

                        <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border shadow-sm">
                          <input
                            type="checkbox"
                            checked={tieneCoDoc}
                            onChange={() => handleToggleCoDocencia(asig.nombre, asig.horasSugeridas)}
                            className="w-4 h-4 text-purple-600 rounded"
                          />
                          <span className="font-semibold text-slate-700 text-xs">Co-Docencia</span>
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Columna Derecha: Talleres JEC de Libre Disposición */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="border-b pb-3">
                  <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-orange-600" />
                    Talleres JEC (Libre Disposición)
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Horas de talleres institucionales de la Jornada Escolar Completa para este curso.
                  </p>
                </div>

                {/* Formulario Agregar Taller */}
                <div className="p-3 bg-slate-50 rounded-xl border space-y-3 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Nombre del Taller JEC</label>
                    <input
                      type="text"
                      value={nuevoTallerNombre}
                      onChange={e => setNuevoTallerNombre(e.target.value)}
                      placeholder="Ej: Taller Deportivo, Robótica"
                      className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:outline-none"
                    />
                  </div>

                  {/* Sugerencias Rápidas */}
                  <div className="flex flex-wrap gap-1">
                    {TALLERES_SUGERIDOS.slice(0, 3).map(sug => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setNuevoTallerNombre(sug)}
                        className="text-[10px] bg-white hover:bg-slate-200 px-2 py-0.5 rounded border text-slate-600"
                      >
                        + {sug.split(' ')[2] || sug}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="block font-semibold text-slate-700 mb-1">Horas Semanales</label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={nuevoTallerHoras}
                        onChange={e => setNuevoTallerHoras(parseInt(e.target.value) || 1)}
                        className="w-full px-3 py-1.5 border rounded-lg font-bold"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={!nuevoTallerNombre.trim()}
                      onClick={() => handleAgregarTallerJec(nuevoTallerNombre, nuevoTallerHoras)}
                      className="mt-5 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-bold rounded-lg shadow"
                    >
                      Añadir
                    </button>
                  </div>
                </div>

                {/* Lista de Talleres del Curso */}
                <div className="space-y-2">
                  {(cursoActivoPaso4.talleresJec || []).map(t => (
                    <div key={t.id} className="flex items-center justify-between p-3 bg-orange-50/60 rounded-xl border border-orange-200 text-xs">
                      <div>
                        <div className="font-bold text-slate-800">{t.nombre}</div>
                        <div className="text-[10px] text-orange-700 font-semibold">{t.horas} horas pedagógicas</div>
                      </div>

                      <button
                        onClick={() => handleEliminarTallerJec(t.id)}
                        className="text-slate-400 hover:text-red-600 p-1"
                        title="Eliminar taller"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {(!cursoActivoPaso4.talleresJec || cursoActivoPaso4.talleresJec.length === 0) && (
                    <div className="text-center py-4 text-xs text-slate-400 italic">
                      No se han agregado talleres JEC a este curso todavía.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 5: ASIGNACIÓN DOCENTE */}
      {pasoActivo === 5 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-orange-600 text-xs font-bold uppercase tracking-wider">
                Paso 5 • Asignación de Profesores por Asignatura y Taller
              </span>
              <h2 className="text-xl font-bold text-slate-800 mt-0.5">
                Distribución de Profesores en Aula con Control de Sobreasignación en Vivo
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                Asigna el docente titular a cada asignatura y el co-docente en aquellas materias que tengan activada la co-docencia. Los badges reflejan en tiempo real el consumo de horas lectivas de cada profesor.
              </p>
            </div>

            <button
              onClick={() => setModoAsignacion(modoAsignacion === 'POR_CURSO' ? 'POR_DOCENTE' : 'POR_CURSO')}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl border transition-colors"
            >
              <Users className="w-4 h-4 text-slate-500" />
              <span>Ver {modoAsignacion === 'POR_CURSO' ? 'por Docente' : 'por Curso'}</span>
            </button>
          </div>

          {modoAsignacion === 'POR_CURSO' ? (
            <div className="space-y-4">
              {/* Selector de Cursos */}
              <div className="flex items-center gap-2 overflow-x-auto pb-2">
                {cursos.map(c => (
                  <button
                    key={c.id}
                    onClick={() => setCursoSeleccionadoPaso5(c.id)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                      (cursoActivoPaso5?.id === c.id)
                        ? 'bg-orange-600 text-white shadow'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border'
                    }`}
                  >
                    {c.nivel} {c.letra}
                  </button>
                ))}
              </div>

              {cursoActivoPaso5 && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">
                        Asignación Horaria: {cursoActivoPaso5.nivel} {cursoActivoPaso5.letra}
                      </h3>
                      <span className="text-xs text-slate-500">
                        Total {listaAsignaturasYtalleresCurso5.length} asignaturas y talleres evaluados
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                      <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b">
                        <tr>
                          <th className="px-4 py-3">Asignatura / Taller</th>
                          <th className="px-4 py-3 text-center">Horas</th>
                          <th className="px-4 py-3">Docente Titular</th>
                          <th className="px-4 py-3">Co-Docente (Aula Compartida)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {listaAsignaturasYtalleresCurso5.map((item, idx) => {
                          const asigActual = asignaciones.find(a => a.cursoId === cursoActivoPaso5.id && a.asignatura === item.nombre);
                          const docTitular = docentes.find(d => d.id === asigActual?.docenteId);
                          const capTitular = docTitular ? capacidadDocentesMap.get(docTitular.id) : null;

                          const coDoc = docentes.find(d => d.id === asigActual?.coDocenteId);
                          const capCoDoc = coDoc ? capacidadDocentesMap.get(coDoc.id) : null;

                          return (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <div className="font-bold text-slate-800">{item.nombre}</div>
                                <div className="text-[10px] text-slate-400">
                                  {item.esTaller ? '🌟 Taller JEC' : 'Plan Base MINEDUC'}
                                </div>
                              </td>

                              <td className="px-4 py-3 text-center font-bold text-slate-800">
                                {item.horas} HA
                              </td>

                              {/* Selector Docente Titular */}
                              <td className="px-4 py-3">
                                <div className="space-y-1">
                                  <select
                                    value={asigActual?.docenteId || ''}
                                    onChange={e => handleAsignarDocenteTitular(item.nombre, item.horas, e.target.value, item.esTaller)}
                                    className="w-full max-w-xs px-2 py-1.5 border rounded-lg font-semibold text-slate-800 text-xs focus:ring-2 focus:ring-orange-500 focus:outline-none"
                                  >
                                    <option value="">-- Sin Asignar --</option>
                                    {docentes.map(d => {
                                      const cap = capacidadDocentesMap.get(d.id);
                                      return (
                                        <option key={d.id} value={d.id}>
                                          {d.apellidos}, {d.nombres} ({cap ? `${cap.pedAsignadas}/${cap.maxHA} HA` : `${d.horasContrato}h`})
                                        </option>
                                      );
                                    })}
                                  </select>

                                  {capTitular && (
                                    <div className="text-[10px]">
                                      {capTitular.sobreasignado ? (
                                        <span className="text-red-600 font-bold">⚠️ Sobreasignado ({capTitular.pedAsignadas}/${capTitular.maxHA} HA)</span>
                                      ) : (
                                        <span className="text-emerald-700 font-medium">✓ Disponible: {capTitular.vacantes} HA vacantes ({capTitular.pedAsignadas}/${capTitular.maxHA} HA)</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Selector Co-Docente */}
                              <td className="px-4 py-3">
                                {asigActual?.tieneCoDocente ? (
                                  <div className="space-y-1">
                                    <select
                                      value={asigActual?.coDocenteId || ''}
                                      onChange={e => handleAsignarCoDocente(item.nombre, item.horas, e.target.value, item.esTaller)}
                                      className="w-full max-w-xs px-2 py-1.5 border rounded-lg font-semibold text-purple-900 bg-purple-50/50 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                                    >
                                      <option value="">-- Seleccionar Co-Docente --</option>
                                      {docentes.map(d => {
                                        const cap = capacidadDocentesMap.get(d.id);
                                        return (
                                          <option key={d.id} value={d.id}>
                                            {d.apellidos}, {d.nombres} ({cap ? `${cap.pedAsignadas}/${cap.maxHA} HA` : `${d.horasContrato}h`})
                                          </option>
                                        );
                                      })}
                                    </select>

                                    {capCoDoc && (
                                      <div className="text-[10px]">
                                        {capCoDoc.sobreasignado ? (
                                          <span className="text-red-600 font-bold">⚠️ Co-docente Sobreasignado</span>
                                        ) : (
                                          <span className="text-purple-700 font-medium">✓ Co-docente: {capCoDoc.pedAsignadas}/${capCoDoc.maxHA} HA</span>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-xs italic">
                                    Co-docencia no activada (Activar en Paso 4 si aplica)
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Vista Bidireccional: POR DOCENTE */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {docentes.map(d => {
                const cap = capacidadDocentesMap.get(d.id);
                const misAsignaciones = asignaciones.filter(a => a.docenteId === d.id || (a.coDocenteId === d.id && a.tieneCoDocente));

                return (
                  <div key={d.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-800 text-base">{d.apellidos}, {d.nombres}</h3>
                        <span className="text-xs text-slate-400 font-mono">{d.run} • Contrato: {d.horasContrato}h</span>
                      </div>

                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        cap?.sobreasignado ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {cap ? `${cap.pedAsignadas} / ${cap.maxHA} HA` : `${d.horasContrato}h`}
                      </span>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t text-xs">
                      <span className="text-[10px] font-bold text-slate-400 uppercase block">Cursos Asignados:</span>
                      {misAsignaciones.map((asig, idx) => {
                        const curso = cursos.find(c => c.id === asig.cursoId);
                        const esCoDoc = asig.coDocenteId === d.id && asig.tieneCoDocente;

                        return (
                          <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border">
                            <span className="font-semibold text-slate-800">
                              {curso ? `${curso.nivel} ${curso.letra}` : 'Curso'} • {asig.asignatura}
                              {esCoDoc && <span className="text-purple-600 font-bold ml-1">(Co-docente)</span>}
                            </span>
                            <span className="font-bold text-orange-600">{asig.horasPedagogicasAula} HA</span>
                          </div>
                        );
                      })}

                      {misAsignaciones.length === 0 && (
                        <span className="text-slate-400 italic">Sin asignaturas en aula</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PASO 6: HORAS NO AULA */}
      {pasoActivo === 6 && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-orange-600 text-xs font-bold uppercase tracking-wider">
              Paso 6 • Gestión, Directivas y Coordinaciones (Horas Fuera de Aula)
            </span>
            <h2 className="text-xl font-bold text-slate-800 mt-0.5">
              Horas Directivas, Técnico-Pedagógicas (UTP) y Coordinaciones Escolares
            </h2>
            <p className="text-xs text-slate-500 mt-1 max-w-3xl">
              Asigna las horas institucionales que no se imparten frente a curso. Al declararlas aquí, el sistema las descuenta automáticamente de la disponibilidad de aula del funcionario, garantizando que el personal de gestión (Director, Inspector, Jefe UTP, CRA, Convivencia) no sea considerado con sobreasignación en aula.
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">
                Carga de Horas No Aula por Funcionario
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b">
                  <tr>
                    <th className="px-4 py-3">Funcionario(a)</th>
                    <th className="px-4 py-3 text-center">Contrato Total</th>
                    <th className="px-3 py-3 text-center text-purple-700">Dirección</th>
                    <th className="px-3 py-3 text-center text-purple-700">Insp. Gral</th>
                    <th className="px-3 py-3 text-center text-blue-700">Jefatura UTP</th>
                    <th className="px-3 py-3 text-center text-blue-700">Coord. UTP</th>
                    <th className="px-4 py-3">Tipo de Coordinación</th>
                    <th className="px-4 py-3 text-center">HA Restante para Aula</th>
                    <th className="px-4 py-3 text-center">Guardar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docentes.map(d => {
                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-slate-800">
                          {d.apellidos}, {d.nombres}
                          <div className="text-[10px] text-slate-400 font-normal">{d.estamento}</div>
                        </td>

                        <td className="px-4 py-3 text-center font-bold text-slate-800">{d.horasContrato}h</td>

                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={d.horasContrato}
                            defaultValue={d.horasDirectivas || 0}
                            id={`dir-${d.id}`}
                            className="w-14 px-1.5 py-1 border rounded text-center font-bold text-purple-700"
                          />
                        </td>

                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={d.horasContrato}
                            defaultValue={d.horasInspectorGeneral || 0}
                            id={`insp-${d.id}`}
                            className="w-14 px-1.5 py-1 border rounded text-center font-bold text-purple-700"
                          />
                        </td>

                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={d.horasContrato}
                            defaultValue={d.horasTecnicoPedagogicas || 0}
                            id={`tec-${d.id}`}
                            className="w-14 px-1.5 py-1 border rounded text-center font-bold text-blue-700"
                          />
                        </td>

                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max={d.horasContrato}
                            defaultValue={d.horasCoordinacion || 0}
                            id={`coord-${d.id}`}
                            className="w-14 px-1.5 py-1 border rounded text-center font-bold text-blue-700"
                          />
                        </td>

                        <td className="px-4 py-3">
                          <select
                            defaultValue={d.tipoCoordinacion || 'Coordinación CRA'}
                            id={`tipocoord-${d.id}`}
                            className="px-2 py-1 border rounded text-xs text-slate-700"
                          >
                            <option value="Coordinación CRA">Coordinación CRA</option>
                            <option value="Convivencia Escolar">Convivencia Escolar</option>
                            <option value="Encargado(a) Enlaces / TIC">Encargado(a) Enlaces / TIC</option>
                            <option value="Coordinación PIE">Coordinación PIE</option>
                            <option value="Jefatura Departamento">Jefatura Departamento</option>
                            <option value="Gestión Directiva / Inspección">Gestión Directiva / Inspección</option>
                            <option value="Otro Apoyo No Aula">Otro Apoyo No Aula</option>
                          </select>
                        </td>

                        <td className="px-4 py-3 text-center font-bold text-slate-700">
                          {Math.max(0, d.horasContrato - (d.horasDirectivas || 0) - (d.horasInspectorGeneral || 0) - (d.horasTecnicoPedagogicas || 0) - (d.horasCoordinacion || 0))} hrs
                        </td>

                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={async () => {
                              const dir = parseInt((document.getElementById(`dir-${d.id}`) as HTMLInputElement)?.value) || 0;
                              const insp = parseInt((document.getElementById(`insp-${d.id}`) as HTMLInputElement)?.value) || 0;
                              const tec = parseInt((document.getElementById(`tec-${d.id}`) as HTMLInputElement)?.value) || 0;
                              const coord = parseInt((document.getElementById(`coord-${d.id}`) as HTMLInputElement)?.value) || 0;
                              const tipoC = (document.getElementById(`tipocoord-${d.id}`) as HTMLSelectElement)?.value || '';
                              await handleGuardarHorasNoAula(d, dir, insp, tec, coord, tipoC);
                              alert(`✓ Horas No Aula actualizadas para ${d.nombres} ${d.apellidos}.`);
                            }}
                            className="px-3 py-1 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded text-xs transition-colors"
                          >
                            Actualizar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* PASO 7: CONSOLIDADO Y CALCULADORA OFICIAL MINEDUC */}
      {pasoActivo === 7 && diagnostico && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="text-orange-600 text-xs font-bold uppercase tracking-wider">
                Paso 7 • Auditoría y Balanza Consolidada Oficial MINEDUC
              </span>
              <h2 className="text-xl font-bold text-slate-800 mt-0.5">
                Balanza Horaria, Proporción Lectiva/No Lectiva y Calculadora Oficial
              </h2>
              <p className="text-xs text-slate-500 mt-1 max-w-3xl">
                Cálculo oficial bajo Estatuto Docente y Ley N° 20.903. Desglose matemático exacto en Horas de Aula, Horas de Recreo proporcionales y Horas No Lectivas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl border transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Ficha Oficial</span>
              </button>

              <button
                onClick={onExportarExcel}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow transition-colors"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Descargar Excel Oficial</span>
              </button>
            </div>
          </div>

          {/* Tarjetas KPI Calculadora Oficial */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* 1. Demanda Total Curricular */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Demanda Curricular Aulas</div>
              <div className="text-3xl font-black text-[#002B49] mt-1">
                {diagnostico.balanzaGeneral.horasAulaDemandadasCurriculo} <span className="text-sm font-bold text-slate-400">HA</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {cursos.length} cursos proyectados ({diagnostico.balanzaGeneral.totalMatriculaProyectada} alumnos)
              </div>
            </div>

            {/* 2. Capacidad Docente Aula Disponible */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Capacidad Aula Disponible</div>
              <div className="text-3xl font-black text-blue-600 mt-1">
                {diagnostico.balanzaGeneral.horasLectivasDisponibles} <span className="text-sm font-bold text-slate-400">HA máx</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                Contratos: {diagnostico.balanzaGeneral.horasContratadasTotales}h (No Aula: {(diagnostico.balanzaGeneral.horasDirectivasTotales || 0) + (diagnostico.balanzaGeneral.horasInspectorGeneralTotales || 0) + (diagnostico.balanzaGeneral.horasTecnicoPedagogicasTotales || 0) + (diagnostico.balanzaGeneral.horasCoordinacionTotales || 0)}h)
              </div>
            </div>

            {/* 3. Horas Aula Asignadas Efectivas */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <div className="text-xs font-semibold text-slate-500">Horas Aula Asignadas</div>
              <div className="text-3xl font-black text-purple-600 mt-1">
                {diagnostico.balanzaGeneral.horasLectivasAsignadas} <span className="text-sm font-bold text-slate-400">HA</span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {asignaciones.length} asignaciones curriculares activas
              </div>
            </div>

            {/* 4. Balance Final */}
            <div className={`p-5 rounded-2xl border shadow-sm ${
              diagnostico.balanzaGeneral.superavitDeficitLectivo >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}>
              <div className={`text-xs font-bold ${diagnostico.balanzaGeneral.superavitDeficitLectivo >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                Balance Horario Final
              </div>
              <div className={`text-3xl font-black mt-1 ${diagnostico.balanzaGeneral.superavitDeficitLectivo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {diagnostico.balanzaGeneral.superavitDeficitLectivo >= 0 ? `+${diagnostico.balanzaGeneral.superavitDeficitLectivo}` : diagnostico.balanzaGeneral.superavitDeficitLectivo} <span className="text-sm font-bold">HA</span>
              </div>
              <div className={`text-xs font-bold mt-1 ${diagnostico.balanzaGeneral.superavitDeficitLectivo >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                {diagnostico.balanzaGeneral.superavitDeficitLectivo >= 0 ? '✓ Dotación Conforme / Superávit' : '⚠️ Déficit de Horas de Aula'}
              </div>
            </div>
          </div>

          {/* Desglose Matemática Calculadora Oficial MINEDUC por Docente */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-orange-600" />
                Desglose Aritmético de Calculadora Oficial MINEDUC (Minutos y Horas)
              </h3>
              <span className="text-xs font-bold text-slate-600">Régimen {regimenProporcion}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 uppercase font-semibold text-[10px] border-b">
                  <tr>
                    <th className="px-4 py-3">Docente</th>
                    <th className="px-4 py-3 text-center">Contrato Total</th>
                    <th className="px-4 py-3 text-center text-purple-700">No Aula</th>
                    <th className="px-4 py-3 text-center font-bold">Docencia Neta</th>
                    <th className="px-4 py-3 text-center font-bold text-emerald-700">Máx Aula (HA)</th>
                    <th className="px-4 py-3 text-center font-bold text-orange-600">HA Asignadas</th>
                    <th className="px-4 py-3 text-center">Recreo Proporcional</th>
                    <th className="px-4 py-3 text-center">Horas No Lectivas</th>
                    <th className="px-4 py-3 text-center">Estado Ley 20.903</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {docentes.map(d => {
                    const hNoAula = (d.horasDirectivas || 0) + (d.horasInspectorGeneral || 0) + (d.horasTecnicoPedagogicas || 0) + (d.horasCoordinacion || 0);
                    const hDocencia = Math.max(0, d.horasContrato - hNoAula);

                    const titAsigs = asignaciones.filter(a => a.docenteId === d.id);
                    const coAsigs = asignaciones.filter(a => a.coDocenteId === d.id && a.tieneCoDocente);
                    const docAsigs = [...titAsigs, ...coAsigs];
                    const pedAsignadas = docAsigs.reduce((s, a) => s + a.horasPedagogicasAula, 0);

                    const asigsRegulares = docAsigs.filter(a => !a.esCoDocencia && !a.esTallerSep && !a.esTrabajoColaborativo && a.tipoApoyo !== 'TRABAJO_COLABORATIVO');
                    const ped60 = asigsRegulares
                      .filter(a => {
                        const c = cursos.find(x => x.id === a.cursoId);
                        return c ? c.regimenProporcion === '60_40' : (colegio.porcentajePrioritarios >= 80);
                      })
                      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

                    const ped65 = asigsRegulares
                      .filter(a => {
                        const c = cursos.find(x => x.id === a.cursoId);
                        return c ? c.regimenProporcion !== '60_40' : (colegio.porcentajePrioritarios < 80);
                      })
                      .reduce((s, a) => s + a.horasPedagogicasAula, 0);

                    const audit = hDocencia > 0 ? calcularAuditoriaDocenteMultitramo({
                      horasAula65_35: ped65,
                      horasAula60_40: ped60,
                      horasNoAulaInstitucionales: hNoAula,
                      horasContratoReal: d.horasContrato,
                      aplicaArticulo69: Boolean(d.aplicaArticulo69)
                    }) : null;

                    const maxHA = audit ? Math.floor(audit.minutosLimitePermitido / 45) : 0;
                    const estaSobreasignado = audit ? (audit.esInfractorExcesoLectivo || (d.horasContrato > 0 && audit.saldoHoras < 0)) : pedAsignadas > 0;
                    const excesoHA = Math.max(0, pedAsignadas - maxHA);

                    return (
                      <tr key={d.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{d.apellidos}, {d.nombres}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{d.run}</div>
                        </td>

                        <td className="px-4 py-3 text-center font-bold text-slate-800">{d.horasContrato}h</td>
                        <td className="px-4 py-3 text-center text-purple-700 font-semibold">{hNoAula > 0 ? `${hNoAula}h` : '-'}</td>
                        <td className="px-4 py-3 text-center font-black text-slate-700">{hDocencia}h</td>

                        <td className="px-4 py-3 text-center font-black text-emerald-700">
                          {audit ? `${maxHA} HA` : '0 HA'}
                        </td>

                        <td className="px-4 py-3 text-center font-black text-orange-600">
                          {pedAsignadas} HA
                          {(ped60 > 0 && ped65 > 0) && (
                            <span className="block text-[9px] font-normal text-slate-400 font-mono">
                              ({ped65} en 65/35 + {ped60} en 60/40)
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-center text-slate-500">
                          {audit ? `${audit.minutosRecreoTotal} min` : '0 min'}
                        </td>

                        <td className="px-4 py-3 text-center text-slate-500">
                          {audit ? `${Math.round(audit.minutosHnlTotal / 60)}h (${audit.minutosHnlTotal}m)` : '0h'}
                        </td>

                        <td className="px-4 py-3 text-center">
                          {estaSobreasignado ? (
                            <span className="inline-flex items-center gap-1 text-red-700 font-bold bg-red-50 border border-red-200 px-2 py-0.5 rounded text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              Sobreasignado (+{excesoHA} HA)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded text-[10px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Conforme
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* Botones de Navegación Inferior (Anterior / Siguiente) */}
      {/* --------------------------------------------------------------------- */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <button
          disabled={pasoActivo === 1}
          onClick={() => setPasoActivo(prev => Math.max(1, prev - 1))}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Paso Anterior</span>
        </button>

        <span className="text-xs font-semibold text-slate-400">
          Paso {pasoActivo} de {pasos.length}
        </span>

        <button
          disabled={pasoActivo === 7}
          onClick={() => setPasoActivo(prev => Math.min(7, prev + 1))}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 font-bold text-xs text-white shadow-md disabled:opacity-30 disabled:pointer-events-none transition-colors"
        >
          <span>Siguiente Paso</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
